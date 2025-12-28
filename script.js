 import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot, arrayUnion, collection, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDJFQnwOs-fetKVy0Ow43vktz8xwefZMks",
    authDomain: "cyou-db8f0.firebaseapp.com",
    databaseURL: "https://cyou-db8f0-default-rtdb.firebaseio.com",
    projectId: "cyou-db8f0",
    storageBucket: "cyou-db8f0.firebasestorage.app",
    messagingSenderId: "873569975141",
    appId: "1:873569975141:web:147eb7b7b4043a38c9bf8c",
    measurementId: "G-T66B50HFJ8"
};

const PAYSTACK_PUB_KEY = "pk_live_xxxxxxxxxxxxxxxxxxxxxxxx"; 

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
let currentUser = null;
let currentBalance = 0;

// === SAFETY LOAD ===
document.addEventListener('DOMContentLoaded', () => {
    // AUTH
    const googleBtn = document.getElementById('google-login-btn');
    if(googleBtn) googleBtn.onclick = () => signInWithPopup(auth, new GoogleAuthProvider());

    const regBtn = document.getElementById('email-register-btn');
    if(regBtn) regBtn.onclick = () => {
        const n = document.getElementById('reg-nick').value;
        const e = document.getElementById('reg-email').value;
        const p = document.getElementById('reg-pass').value;
        if(!n) return alert("Username required");
        createUserWithEmailAndPassword(auth, e, p).then(async (c) => {
            await setDoc(doc(db, "users", c.user.uid), { nickname: n, email: e, balance: 0, uid: c.user.uid, history: [] });
            window.location.reload();
        }).catch(err => alert(err.message));
    };

    const loginBtn = document.getElementById('email-login-btn');
    if(loginBtn) loginBtn.onclick = () => {
        signInWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-pass').value)
        .catch(err => alert(err.message));
    };

    // NAV
    document.getElementById('goto-register').onclick = () => toggleForms(true);
    document.getElementById('goto-login').onclick = () => toggleForms(false);
    document.getElementById('logout-btn').onclick = () => signOut(auth).then(()=>window.location.reload());

    document.getElementById('nav-aviator').onclick = () => switchTab('aviator');
    document.getElementById('nav-spin').onclick = () => switchTab('spin');
    document.getElementById('nav-profile').onclick = () => switchTab('profile');

    // GAME
    document.getElementById('bet-btn').onclick = placeAviatorBet;
    document.querySelectorAll('.chip-btn').forEach(b => b.onclick = () => document.getElementById('bet-amount').value = b.dataset.val);
    document.getElementById('inc-bet').onclick = () => adjustBet(50);
    document.getElementById('dec-bet').onclick = () => adjustBet(-50);
    
    // SPIN
    document.getElementById('btn-lemon').onclick = () => spinColor('lemon');
    document.getElementById('btn-navy').onclick = () => spinColor('navy');

    // MODALS
    document.getElementById('open-deposit-modal').onclick = () => document.getElementById('deposit-modal').style.display='flex';
    document.getElementById('cancel-deposit').onclick = () => document.getElementById('deposit-modal').style.display='none';
    document.getElementById('confirm-deposit').onclick = processDeposit;

    document.getElementById('open-withdraw-modal').onclick = () => document.getElementById('withdraw-modal').style.display='flex';
    document.getElementById('cancel-withdraw').onclick = () => document.getElementById('withdraw-modal').style.display='none';
    document.getElementById('confirm-withdraw').onclick = processWithdraw;
    
    document.getElementById('save-nickname-btn').onclick = saveNick;
});

function toggleForms(showReg) {
    document.getElementById('login-form').classList.toggle('hidden', showReg);
    document.getElementById('register-form').classList.toggle('hidden', !showReg);
}

// === AUTH STATE ===
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        const userRef = doc(db, "users", user.uid);
        try {
            const snap = await getDoc(userRef);
            if (snap.exists() && snap.data().nickname) {
                initDashboard(snap.data());
            } else {
                if(!snap.exists()) await setDoc(userRef, { email: user.email, balance: 0, uid: user.uid, history: [] }, {merge:true});
                document.getElementById('auth-screen').classList.remove('active');
                document.getElementById('nickname-modal').style.display = 'flex';
            }
        } catch (e) {
            initDashboard({ nickname: "Guest", balance: 0 });
        }
    } else {
        document.getElementById('dashboard-screen').classList.add('hidden');
        document.getElementById('auth-screen').classList.remove('hidden');
        document.getElementById('auth-screen').classList.add('active');
    }
});

async function saveNick() {
    const n = document.getElementById('google-nickname-input').value;
    if(n) { await updateDoc(doc(db, "users", currentUser.uid), { nickname: n }); window.location.reload(); }
}

function initDashboard(data) {
    document.getElementById('auth-screen').classList.remove('active');
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('nickname-modal').style.display = 'none';
    
    document.getElementById('dashboard-screen').classList.remove('hidden');
    document.getElementById('dashboard-screen').classList.add('active');

    document.getElementById('header-nick').innerText = data.nickname || "Player";
    document.getElementById('profile-name').innerText = data.nickname || "Player";
    document.getElementById('profile-email').innerText = currentUser.email;
    document.getElementById('profile-id').innerText = "ID: " + currentUser.uid.slice(0,6).toUpperCase();

    onSnapshot(doc(db, "users", currentUser.uid), (docSnap) => {
        if(docSnap.exists()) {
            currentBalance = docSnap.data().balance;
            document.getElementById('wallet-balance').innerText = currentBalance.toLocaleString();
            renderTxHistory(docSnap.data().history);
        }
    });

    startAviatorEngine();
    startBotSimulation();
}

// === TRANSACTION HISTORY & RECEIPTS ===
function renderTxHistory(hist) {
    const list = document.getElementById('tx-history');
    list.innerHTML = "";
    if(!hist) return;
    
    // Sort Newest First
    const sorted = [...hist].reverse();
    
    sorted.forEach((tx, index) => {
        // Create Transaction Item
        const div = document.createElement('div');
        div.className = 'tx-item';
        div.innerHTML = `
            <div>
                <div style="font-weight:bold;">${tx.type}</div>
                <div class="tx-type">${new Date(tx.date).toLocaleDateString()}</div>
            </div>
            <div class="tx-amount ${tx.amount > 0 ? 'pos' : 'neg'}">
                ${tx.amount > 0 ? '+' : ''}₦${Math.abs(tx.amount).toLocaleString()}
            </div>
        `;
        
        // ADD CLICK EVENT FOR RECEIPT
        div.onclick = () => showReceipt(tx, index);
        list.appendChild(div);
    });
}

function showReceipt(tx, index) {
    document.getElementById('rcpt-type').innerText = tx.type;
    document.getElementById('rcpt-amt').innerText = "₦" + Math.abs(tx.amount).toLocaleString();
    document.getElementById('rcpt-date').innerText = new Date(tx.date).toLocaleString();
    document.getElementById('rcpt-id').innerText = "#" + (currentUser.uid.slice(0,4) + index).toUpperCase();
    document.getElementById('receipt-modal').style.display = 'flex';
}

// === DEPOSIT & WITHDRAW (WHATSAPP) ===
function processDeposit() {
    const amt = parseInt(document.getElementById('deposit-input').value);
    if(amt < 100) return alert("Min 100");
    document.getElementById('deposit-modal').style.display='none';
    
    let h = PaystackPop.setup({
        key: PAYSTACK_PUB_KEY, email: currentUser.email, amount: amt*100, currency: "NGN",
        callback: function(r) { 
            updateDoc(doc(db, "users", currentUser.uid), { 
                balance: currentBalance + amt, 
                history: arrayUnion({type:"Deposit", amount:amt, date:new Date().toISOString()}) 
            }); 
        }
    });
    h.openIframe();
}

function processWithdraw() {
    const amt = parseInt(document.getElementById('withdraw-amount').value);
    const bank = document.getElementById('withdraw-bank').value;
    const acct = document.getElementById('withdraw-acct').value;
    const name = document.getElementById('withdraw-name').value;

    if(amt > currentBalance) return alert("Insufficient Balance");
    if(!bank || !acct || !name) return alert("Please fill all bank details");

    // 1. Deduct Balance & Record
    updateDoc(doc(db, "users", currentUser.uid), { 
        balance: currentBalance - amt, 
        history: arrayUnion({type:"Withdrawal", amount:-amt, date:new Date().toISOString()}) 
    });

    document.getElementById('withdraw-modal').style.display='none';

    // 2. Open WhatsApp
    const msg = `*WITHDRAWAL REQUEST*%0A%0A` +
                `🆔 User ID: ${currentUser.uid.slice(0,5).toUpperCase()}%0A` +
                `💰 Amount: ₦${amt.toLocaleString()}%0A` +
                `🏦 Bank: ${bank}%0A` +
                `🔢 Acct: ${acct}%0A` +
                `👤 Name: ${name}%0A%0A` +
                `Please process this payment.`;
    
    window.open(`https://wa.me/2349125297720?text=${msg}`, '_blank');
}

// === AVIATOR LOGIC ===
let avState="WAITING", avMult=1.00, avBet=0, avCash=false;

function startAviatorEngine() {
    setInterval(() => {
        const now = Date.now(), loop = now % 12000;
        if (loop < 4000) { 
            if(avState !== "WAITING") {
                avState = "WAITING";
                document.getElementById('status-text').innerText = "NEXT ROUND...";
                document.getElementById('multiplier-display').innerText = "1.00x";
                document.getElementById('multiplier-display').style.color = "white";
                document.getElementById('rocket-icon').style.transform = "rotate(0deg)";
                const btn = document.getElementById('bet-btn');
                if(avBet > 0 && !avCash) { avBet = 0; btn.innerText = "LOST"; btn.style.background = "#333"; }
                else { btn.innerText = "BET"; btn.style.background = "var(--neon-green)"; btn.style.color = "#0a192f"; }
            }
        } else { 
            avState = "FLYING";
            const flyTime = loop - 4000;
            avMult = (1 + (flyTime/1000) * 0.3).toFixed(2);
            document.getElementById('status-text').innerText = "FLYING";
            document.getElementById('rocket-icon').style.transform = "translate(5px, -5px)";
            const crash = ((Math.floor(now/12000) % 6) + 1.1).toFixed(2);

            if (parseFloat(avMult) >= parseFloat(crash)) {
                avState = "CRASHED";
                document.getElementById('multiplier-display').innerText = crash + "x";
                document.getElementById('multiplier-display').style.color = "var(--neon-red)";
                document.getElementById('status-text').innerText = "CRASHED";
                const hist = document.getElementById('round-history');
                if(!hist.firstChild || hist.firstChild.innerText !== crash+"x") {
                    let c = crash >= 10 ? 'red' : (crash >= 2 ? 'purple' : 'blue');
                    hist.innerHTML = `<span class="history-pill ${c}">${crash}x</span>` + hist.innerHTML;
                }
            } else {
                document.getElementById('multiplier-display').innerText = avMult + "x";
                if(avBet > 0 && !avCash) {
                    const btn = document.getElementById('bet-btn');
                    btn.innerText = "CASH OUT " + Math.floor(avBet * avMult);
                    btn.style.background = "var(--neon-red)"; btn.style.color = "white";
                    if(document.getElementById('auto-cashout-toggle').checked && avMult >= document.getElementById('auto-cashout-val').value) doCashout();
                }
            }
        }
    }, 100);
}

function placeAviatorBet() {
    if(avState === "WAITING" && avBet === 0) {
        const amt = parseInt(document.getElementById('bet-amount').value);
        if(amt > currentBalance) return alert("Low Funds");
        avBet = amt; avCash = false;
        updateDoc(doc(db, "users", currentUser.uid), { balance: currentBalance - amt, history: arrayUnion({type:"Bet Aviator", amount:-amt, date:new Date().toISOString()}) });
        document.getElementById('bet-btn').innerText = "BET PLACED";
        document.getElementById('bet-btn').style.background = "#ff9900";
    } else if (avState === "FLYING" && avBet > 0 && !avCash) doCashout();
}

function doCashout() {
    avCash = true;
    const win = Math.floor(avBet * avMult);
    updateDoc(doc(db, "users", currentUser.uid), { balance: currentBalance + win, history: arrayUnion({type:"Win Aviator", amount:win, date:new Date().toISOString()}) });
    document.getElementById('bet-btn').innerText = "WON " + win;
    document.getElementById('bet-btn').style.background = "var(--neon-green)";
    document.getElementById('bet-btn').style.color = "#0a192f";
}

// === SPIN GAME ===
function spinColor(choice) {
    const amt = parseInt(document.getElementById('spin-amount').value);
    if(amt > currentBalance) return alert("Low Funds");
    updateDoc(doc(db, "users", currentUser.uid), { balance: currentBalance - amt, history: arrayUnion({type:"Bet Spin", amount:-amt, date:new Date().toISOString()}) });

    const card = document.getElementById('spin-card');
    const resultIcon = document.getElementById('spin-result-icon');
    card.classList.add('flip');
    
    setTimeout(() => {
        const rand = Math.random();
        let outcome = rand <= 0.5 ? 'lemon' : 'navy';
        resultIcon.style.backgroundColor = outcome === 'lemon' ? '#64ffda' : '#0a192f';
        
        if(choice === outcome) {
            const win = amt * 2;
            updateDoc(doc(db, "users", currentUser.uid), { balance: currentBalance + win, history: arrayUnion({type:"Win Spin", amount:win, date:new Date().toISOString()}) });
            alert("WIN! " + win);
        } else {
            alert("LOST!");
        }
        setTimeout(() => card.classList.remove('flip'), 1000);
    }, 600);
}

// UTILS
function switchTab(tab) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
    document.getElementById('tab-' + tab).classList.remove('hidden');
    document.getElementById('tab-' + tab).classList.add('active');
    document.getElementById('nav-' + tab).classList.add('active');
}

function adjustBet(val) {
    let el = document.getElementById('bet-amount');
    el.value = Math.max(50, parseInt(el.value) + val);
}

function startBotSimulation() {
    const names = ["Winner22", "Player_X", "Speedy", "Lucky77", "ProGamer", "King01"];
    const list = document.getElementById('live-bets-list');
    setInterval(() => {
        if(avState === "FLYING") {
            const name = names[Math.floor(Math.random()*names.length)];
            const amt = [100, 200, 500, 1000][Math.floor(Math.random()*4)];
            const div = document.createElement('div');
            div.className = "bot-row win";
            div.innerHTML = `<span>${name}</span> <span>+${amt}</span>`;
            list.prepend(div);
            if(list.children.length > 8) list.removeChild(list.lastChild);
        }
    }, 1500);
}
