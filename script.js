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

const PAYSTACK_PUB_KEY = "pk_live_114f32ca016af833aecc705ff519c58c499ecf59"; 

// Init
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
let currentUser = null;
let currentBalance = 0;

// === 1. SAFETY LOAD ===
document.addEventListener('DOMContentLoaded', () => {
    console.log("APP LOADED");

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

    document.getElementById('goto-register').onclick = () => toggleForms(true);
    document.getElementById('goto-login').onclick = () => toggleForms(false);
    document.getElementById('logout-btn').onclick = () => signOut(auth).then(()=>window.location.reload());

    // NAV
    document.getElementById('nav-aviator').onclick = () => switchTab('aviator');
    document.getElementById('nav-spin').onclick = () => switchTab('spin');
    document.getElementById('nav-profile').onclick = () => switchTab('profile');

    // MODALS
    document.getElementById('open-deposit-modal').onclick = () => document.getElementById('deposit-modal').style.display='flex';
    document.getElementById('cancel-deposit').onclick = () => document.getElementById('deposit-modal').style.display='none';
    document.getElementById('confirm-deposit').onclick = processDeposit;
    document.getElementById('save-nickname-btn').onclick = saveNick;

    // AVIATOR CONTROLS
    document.getElementById('bet-btn').onclick = placeAviatorBet;
    document.querySelectorAll('.chip-btn').forEach(b => b.onclick = () => document.getElementById('bet-amount').value = b.dataset.val);
    document.getElementById('inc-bet').onclick = () => adjustBet(50);
    document.getElementById('dec-bet').onclick = () => adjustBet(-50);

    // SPIN CONTROLS
    document.getElementById('btn-lemon').onclick = () => spinColor('lemon');
    document.getElementById('btn-navy').onclick = () => spinColor('navy');
});

function toggleForms(showReg) {
    document.getElementById('login-form').classList.toggle('hidden', showReg);
    document.getElementById('register-form').classList.toggle('hidden', !showReg);
}

// === 2. AUTH STATE & DASHBOARD ===
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
            initDashboard({ nickname: "Guest", balance: 0 }); // Fallback
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
    document.getElementById('auth-screen').classList.remove('active'); // Hide Auth
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('nickname-modal').style.display = 'none';
    
    document.getElementById('dashboard-screen').classList.remove('hidden');
    document.getElementById('dashboard-screen').classList.add('active');

    document.getElementById('header-nick').innerText = data.nickname || "Player";
    document.getElementById('profile-name').innerText = data.nickname || "Player";
    document.getElementById('profile-email').innerText = currentUser.email;

    onSnapshot(doc(db, "users", currentUser.uid), (docSnap) => {
        if(docSnap.exists()) {
            currentBalance = docSnap.data().balance;
            document.getElementById('wallet-balance').innerText = currentBalance.toLocaleString();
            renderHistory(docSnap.data().history);
        }
    });

    startAviatorEngine();
}

function renderHistory(hist) {
    const list = document.getElementById('tx-history');
    list.innerHTML = "";
    if(!hist) return;
    hist.slice(-10).reverse().forEach(tx => {
        list.innerHTML += `<div class="match-card">
            <span>${tx.type}</span>
            <span style="color:${tx.amount>0?'#64ffda':'#ff5f56'}">${tx.amount}</span>
        </div>`;
    });
}

// === 3. YOUR EXACT AVIATOR LOGIC ===
function generateCrashPoint() {
    const random = Math.random();
    const houseEdge = 0.96; 
    let crashPoint = Math.floor((houseEdge / (1 - random)) * 100) / 100;
    if (crashPoint < 1.00) return 1.00;
    if (crashPoint > 1000) return 1000.00;
    return crashPoint;
}

let avState="WAITING", avMult=1.00, avBet=0, avCash=false, crashPoint=1.00;

function startAviatorEngine() {
    setInterval(() => {
        const now = Date.now(), loop = now % 12000; // 12s loop
        
        if (loop < 4000) { // WAITING (4s)
            if(avState !== "WAITING") {
                avState = "WAITING";
                crashPoint = generateCrashPoint(); // NEW CRASH POINT
                document.getElementById('status-text').innerText = "NEXT ROUND...";
                document.getElementById('multiplier-display').innerText = "1.00x";
                document.getElementById('multiplier-display').style.color = "white";
                document.getElementById('plane-icon').style.transform = "translate(0, 0)";
                document.getElementById('plane-icon').style.color = "#ff5f56";
                document.getElementById('crash-msg').classList.add('hidden');
                
                const btn = document.getElementById('bet-btn');
                if(avBet > 0 && !avCash) { avBet = 0; btn.innerText = "LOST"; btn.style.background = "#333"; }
                else { btn.innerText = "BET NEXT ROUND"; btn.style.background = "var(--neon-green)"; btn.style.color = "#0a192f"; }
            }
        } else { // FLYING
            avState = "FLYING";
            const flyTime = loop - 4000;
            // Animation: Move from Bottom-Left to Top-Right
            const x = (flyTime / 8000) * 200; // Move Right
            const y = (flyTime / 8000) * -150; // Move Up
            document.getElementById('plane-icon').style.transform = `translate(${x}px, ${y}px)`;
            
            // Linear Growth for display
            avMult = (1 + (flyTime/1000) * 0.15 * crashPoint).toFixed(2);
            if(avMult > crashPoint) avMult = crashPoint; // Cap at crash

            if (parseFloat(avMult) >= crashPoint) {
                avState = "CRASHED";
                document.getElementById('multiplier-display').innerText = crashPoint + "x";
                document.getElementById('multiplier-display').style.color = "var(--neon-red)";
                document.getElementById('status-text').innerText = "CRASHED";
                document.getElementById('crash-msg').classList.remove('hidden');
                
                // Add History
                const hist = document.getElementById('round-history');
                if(!hist.firstChild || hist.firstChild.innerText !== crashPoint+"x") {
                    let color = crashPoint >= 10 ? 'red' : (crashPoint >= 2 ? 'purple' : 'blue');
                    hist.innerHTML = `<span class="history-pill ${color}">${crashPoint}x</span>` + hist.innerHTML;
                }
            } else {
                document.getElementById('multiplier-display').innerText = avMult + "x";
                document.getElementById('status-text').innerText = "FLYING";
                
                if(avBet > 0 && !avCash) {
                    const btn = document.getElementById('bet-btn');
                    btn.innerText = "CASH OUT " + Math.floor(avBet * avMult);
                    btn.style.background = "var(--neon-red)"; btn.style.color = "white";
                    
                    if(document.getElementById('auto-cashout-toggle').checked && avMult >= document.getElementById('auto-cashout-val').value) {
                        doCashout();
                    }
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
}

// === 4. SPIN DA BOTTLE (RED/BLACK STYLE) ===
function spinColor(choice) {
    const amt = parseInt(document.getElementById('spin-amount').value);
    if(amt > currentBalance) return alert("Low Funds");
    
    // Deduct
    updateDoc(doc(db, "users", currentUser.uid), { balance: currentBalance - amt, history: arrayUnion({type:"Bet Spin", amount:-amt, date:new Date().toISOString()}) });

    const card = document.getElementById('spin-card');
    const resultIcon = document.getElementById('spin-result-icon');
    
    // Animation
    card.classList.add('flip');
    
    setTimeout(() => {
        // Logic: 0-0.5 = Lemon, 0.6-1 = Navy
        const rand = Math.random();
        let outcome = rand <= 0.5 ? 'lemon' : 'navy';
        
        // Show result
        resultIcon.style.backgroundColor = outcome === 'lemon' ? '#64ffda' : '#0a192f';
        resultIcon.style.border = "4px solid white";
        
        // Win/Loss
        if(choice === outcome) {
            const win = amt * 2;
            updateDoc(doc(db, "users", currentUser.uid), { balance: currentBalance + win, history: arrayUnion({type:"Win Spin", amount:win, date:new Date().toISOString()}) });
            alert("WIN! " + win);
        } else {
            alert("LOST!");
        }
        
        // Reset
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

function processDeposit() {
    const amt = parseInt(document.getElementById('deposit-input').value);
    if(amt < 100) return alert("Min 100");
    document.getElementById('deposit-modal').style.display='none';
    let h = PaystackPop.setup({
        key: PAYSTACK_PUB_KEY, email: currentUser.email, amount: amt*100, currency: "NGN",
        callback: function(r) { updateDoc(doc(db, "users", currentUser.uid), { balance: currentBalance + amt, history: arrayUnion({type:"Deposit", amount:amt, date:new Date().toISOString()}) }); }
    });
    h.openIframe();
}
