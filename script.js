 import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot, arrayUnion, collection } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

// Init
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
let currentUser = null;
let currentBalance = 0;

console.log("SCRIPT LOADED - BUTTONS SHOULD WORK NOW");

// ==========================================
// 1. GLOBAL FUNCTIONS (So HTML can see them)
// ==========================================

window.handleGoogleLogin = () => {
    console.log("Google Login Clicked");
    signInWithPopup(auth, new GoogleAuthProvider()).catch(e => showToast(e.message, 'error'));
};

window.handleEmailLogin = () => {
    console.log("Email Login Clicked");
    const e = document.getElementById('login-email').value;
    const p = document.getElementById('login-pass').value;
    if(e && p) signInWithEmailAndPassword(auth, e, p).catch(err => showToast(err.message, 'error'));
    else showToast("Enter Email & Password", 'error');
};

window.handleRegister = () => {
    console.log("Register Clicked");
    const n = document.getElementById('reg-nick').value;
    const e = document.getElementById('reg-email').value;
    const p = document.getElementById('reg-pass').value;
    if(!n) return showToast("Username Required", 'error');
    
    createUserWithEmailAndPassword(auth, e, p).then(async (c) => {
        await setDoc(doc(db, "users", c.user.uid), { nickname: n, email: e, balance: 0, uid: c.user.uid, history: [] });
        window.location.reload();
    }).catch(err => showToast(err.message, 'error'));
};

window.handleForgot = () => {
    const email = document.getElementById('login-email').value;
    if(email) sendPasswordResetEmail(auth, email).then(()=>showToast("Reset link sent!", 'success')).catch(e=>showToast(e.message, 'error'));
    else showToast("Enter email in login box first", 'error');
};

window.handleLogout = () => {
    signOut(auth).then(() => window.location.reload());
};

// Navigation
window.toggleForms = (showReg) => {
    document.getElementById('login-form').classList.toggle('hidden', showReg);
    document.getElementById('register-form').classList.toggle('hidden', !showReg);
};

window.switchTab = (tabName) => {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
    
    document.getElementById('tab-' + tabName).classList.remove('hidden');
    document.getElementById('tab-' + tabName).classList.add('active');
    document.getElementById('nav-' + tabName).classList.add('active');
};

// Modals
window.openModal = (id) => document.getElementById(id).style.display = 'flex';
window.closeModal = (id) => document.getElementById(id).style.display = 'none';

// Game Inputs
window.adjustBet = (val) => {
    let el = document.getElementById('bet-amount');
    el.value = Math.max(50, parseInt(el.value) + val);
};
window.setChip = (val) => document.getElementById('bet-amount').value = val;

// ==========================================
// 2. AUTH & DATA LOADING
// ==========================================

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        const userRef = doc(db, "users", user.uid);
        try {
            const snap = await getDoc(userRef);
            if (snap.exists() && snap.data().nickname) initDashboard(snap.data());
            else {
                if(!snap.exists()) await setDoc(userRef, { email: user.email, balance: 0, uid: user.uid, history: [] }, {merge:true});
                document.getElementById('auth-screen').style.display = 'none';
                document.getElementById('nickname-modal').style.display = 'flex';
            }
        } catch (e) { initDashboard({ nickname: "Guest", balance: 0 }); }
    } else {
        document.getElementById('dashboard-screen').style.display = 'none';
        document.getElementById('auth-screen').style.display = 'block';
    }
});

window.saveNick = async () => {
    const n = document.getElementById('google-nickname-input').value;
    if(n) { await updateDoc(doc(db, "users", currentUser.uid), { nickname: n }); window.location.reload(); }
};

function initDashboard(data) {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('nickname-modal').style.display = 'none';
    document.getElementById('dashboard-screen').style.display = 'block';

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
}

function renderTxHistory(hist) {
    const list = document.getElementById('tx-history');
    list.innerHTML = "";
    if(!hist) return;
    hist.slice(-15).reverse().forEach((tx, i) => {
        const div = document.createElement('div');
        div.className = 'tx-item';
        div.innerHTML = `<div><b>${tx.type}</b><br><small style="color:#888">${new Date(tx.date).toLocaleDateString()}</small></div>
                         <div class="tx-amt ${tx.amount>0?'pos':'neg'}">${tx.amount>0?'+':''}₦${Math.abs(tx.amount)}</div>`;
        div.onclick = () => showReceipt(tx, i);
        list.appendChild(div);
    });
}

function showReceipt(tx, i) {
    document.getElementById('rcpt-type').innerText = tx.type;
    document.getElementById('rcpt-amt').innerText = "₦" + Math.abs(tx.amount);
    document.getElementById('rcpt-date').innerText = new Date(tx.date).toLocaleString();
    document.getElementById('receipt-modal').style.display = 'flex';
}

function showToast(msg, type) {
    const box = document.getElementById('toast-box');
    box.innerHTML = `<div class="toast ${type}">${msg}</div>`;
    setTimeout(() => box.innerHTML = "", 3000);
}

// ==========================================
// 3. AVIATOR ENGINE (VERY SLOW)
// ==========================================
let avState="WAITING", avMult=1.00, avBet=0, avCash=false, crashPoint=1.00;

function startAviatorEngine() {
    setInterval(() => {
        const now = Date.now(), loop = now % 20000; // 20 Seconds Loop (Very Long)
        
        if (loop < 5000) { // 5s Waiting (Countdown)
            if(avState !== "WAITING") {
                avState = "WAITING";
                // 96% RTP
                const r = Math.random();
                crashPoint = Math.floor((0.96 / (1 - r)) * 100) / 100;
                if(crashPoint < 1.00) crashPoint = 1.00;
                
                document.getElementById('plane-icon').style.transform = "translate(0,0)";
                document.getElementById('multiplier-display').innerText = "1.00x";
                document.getElementById('multiplier-display').style.color = "white";
                document.getElementById('av-receipt').classList.add('hidden');
                
                const btn = document.getElementById('bet-btn');
                if(avBet > 0 && !avCash) { 
                    avBet = 0; btn.innerText = "LOST"; btn.style.background = "#333";
                } else { 
                    btn.innerText = "BET NEXT ROUND"; btn.style.background = "var(--neon-green)"; btn.style.color = "#0a192f"; 
                }
            }
            // Countdown Text
            const sec = Math.ceil((5000 - loop)/1000);
            document.getElementById('status-text').innerText = `STARTS IN ${sec}s`;

        } else { // FLYING (15s Duration)
            avState = "FLYING";
            const flyTime = loop - 5000;
            
            // SUPER SLOW GROWTH (0.05 factor)
            avMult = (1 + (flyTime/15000) * 0.05 * crashPoint).toFixed(2);
            if(avMult > crashPoint) avMult = crashPoint;

            // Plane Movement
            const x = (flyTime / 15000) * 260; 
            const y = (flyTime / 15000) * -180;
            document.getElementById('plane-icon').style.transform = `translate(${x}px, ${y}px)`;

            if (parseFloat(avMult) >= crashPoint) {
                avState = "CRASHED";
                document.getElementById('multiplier-display').innerText = crashPoint + "x";
                document.getElementById('multiplier-display').style.color = "var(--neon-red)";
                document.getElementById('status-text').innerText = "CRASHED";
                
                // Add History Pill (Purple/Blue/Pink)
                const hist = document.getElementById('round-history');
                if(!hist.firstChild || hist.firstChild.innerText !== crashPoint+"x") {
                    let c = crashPoint >= 10 ? 'pink' : (crashPoint >= 2 ? 'purple' : 'blue');
                    hist.innerHTML = `<span class="pill ${c}">${crashPoint}x</span>` + hist.innerHTML;
                }
            } else {
                document.getElementById('multiplier-display').innerText = avMult + "x";
                document.getElementById('status-text').innerText = "FLYING...";
                if(avBet > 0 && !avCash) {
                    const btn = document.getElementById('bet-btn');
                    btn.innerText = "CASH OUT " + Math.floor(avBet * avMult);
                    btn.style.background = "var(--neon-red)"; btn.style.color = "white";
                    if(document.getElementById('auto-cashout-toggle').checked && avMult >= document.getElementById('auto-cashout-val').value) window.doCashout();
                }
            }
        }
    }, 500); // Update every 0.5s (Very Slow Ticks)
}

window.placeAviatorBet = () => {
    if(avState === "WAITING" && avBet === 0) {
        const amt = parseInt(document.getElementById('bet-amount').value);
        if(amt > currentBalance) return showToast("Low Funds", 'error');
        avBet = amt; avCash = false;
        updateDoc(doc(db, "users", currentUser.uid), { balance: currentBalance - amt, history: arrayUnion({type:"Bet Aviator", amount:-amt, date:new Date().toISOString()}) });
        document.getElementById('bet-btn').innerText = "BET PLACED";
        document.getElementById('bet-btn').style.background = "#ff9900";
    } else if (avState === "FLYING" && avBet > 0 && !avCash) window.doCashout();
};

window.doCashout = () => {
    avCash = true;
    const win = Math.floor(avBet * avMult);
    updateDoc(doc(db, "users", currentUser.uid), { balance: currentBalance + win, history: arrayUnion({type:"Win Aviator", amount:win, date:new Date().toISOString()}) });
    document.getElementById('bet-btn').innerText = "WON";
    document.getElementById('bet-btn').style.background = "var(--neon-green)";
    document.getElementById('av-rcpt-text').innerText = "WON ₦" + win;
    document.getElementById('av-receipt').classList.remove('hidden');
    showToast("WON ₦" + win, 'success');
};

// === PAYMENT FUNCTIONS ===
window.processDeposit = () => {
    const amt = parseInt(document.getElementById('deposit-input').value);
    if(amt < 100) return showToast("Min Deposit 100", 'error');
    document.getElementById('deposit-modal').style.display='none';
    let h = PaystackPop.setup({
        key: PAYSTACK_PUB_KEY, email: currentUser.email, amount: amt*100, currency: "NGN",
        callback: function(r) { updateDoc(doc(db, "users", currentUser.uid), { balance: currentBalance + amt, history: arrayUnion({type:"Deposit", amount:amt, date:new Date().toISOString()}) }); }
    });
    h.openIframe();
};

window.processWithdraw = () => {
    const amt = parseInt(document.getElementById('withdraw-amount').value);
    const bank = document.getElementById('withdraw-bank').value;
    const acct = document.getElementById('withdraw-acct').value;
    const name = document.getElementById('withdraw-name').value;
    
    if(amt > currentBalance) return showToast("Insufficient Funds", 'error');
    if(amt < 200) return showToast("Min Withdraw 200", 'error');
    if(!bank || !acct) return showToast("Fill all details", 'error');
    
    updateDoc(doc(db, "users", currentUser.uid), { balance: currentBalance - amt, history: arrayUnion({type:"Withdrawal", amount:-amt, date:new Date().toISOString()}) });
    document.getElementById('withdraw-modal').style.display='none';
    const msg = `*WITHDRAW REQUEST*%0AUser: ${currentUser.uid.slice(0,5)}%0AAmt: ₦${amt}%0ABank: ${bank}%0AAcct: ${acct}%0AName: ${name}`;
    window.open(`https://wa.me/2349125297720?text=${msg}`, '_blank');
};
