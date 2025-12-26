 import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot, arrayUnion, addDoc, collection } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

const RAPID_API_KEY = "cb7d574582mshf8c7d0e5d409675p1f854fjsn"; 
const PAYSTACK_PUB_KEY = "pk_live_xxxxxxxxxxxxxxxxxxxxxxxx"; 

// Initialize
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
let currentUser = null;
let currentBalance = 0;

// --- WAIT FOR DOM TO LOAD (FIXES BUTTONS) ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("App Loaded");

    // AUTH BUTTONS
    document.getElementById('google-login-btn').onclick = () => signInWithPopup(auth, new GoogleAuthProvider());
    
    document.getElementById('email-login-btn').onclick = () => {
        const e = document.getElementById('login-email').value;
        const p = document.getElementById('login-pass').value;
        if(e && p) signInWithEmailAndPassword(auth, e, p).catch(err => alert(err.message));
    };

    document.getElementById('email-register-btn').onclick = () => {
        const n = document.getElementById('reg-nick').value;
        const e = document.getElementById('reg-email').value;
        const p = document.getElementById('reg-pass').value;
        if(!n) return alert("Username required");
        
        createUserWithEmailAndPassword(auth, e, p).then(async (c) => {
            await setDoc(doc(db, "users", c.user.uid), { nickname: n, email: e, balance: 0, uid: c.user.uid, history: [] });
            location.reload();
        }).catch(err => alert(err.message));
    };

    document.getElementById('goto-register').onclick = () => {
        document.getElementById('login-form').classList.add('hidden');
        document.getElementById('register-form').classList.remove('hidden');
    };
    
    document.getElementById('goto-login').onclick = () => {
        document.getElementById('register-form').classList.add('hidden');
        document.getElementById('login-form').classList.remove('hidden');
    };

    document.getElementById('logout-btn').onclick = () => signOut(auth).then(()=>location.reload());

    // GAME CONTROLS
    document.getElementById('bet-btn').onclick = placeBet;
    document.getElementById('inc-bet').onclick = () => adjustBet(50);
    document.getElementById('dec-bet').onclick = () => adjustBet(-50);
    
    document.querySelectorAll('.chip-btn').forEach(btn => {
        btn.onclick = () => document.getElementById('bet-amount').value = btn.dataset.val;
    });

    // NAV
    document.getElementById('nav-sports').onclick = () => switchTab('sports');
    document.getElementById('nav-aviator').onclick = () => switchTab('aviator');
    document.getElementById('nav-profile').onclick = () => switchTab('profile');

    // MODALS
    document.getElementById('open-deposit-modal').onclick = () => document.getElementById('deposit-modal').style.display = 'flex';
    document.getElementById('cancel-deposit').onclick = () => document.getElementById('deposit-modal').style.display = 'none';
    document.getElementById('confirm-deposit').onclick = processDeposit;

    document.getElementById('open-withdraw-modal').onclick = () => document.getElementById('withdraw-modal').style.display = 'flex';
    document.getElementById('cancel-withdraw').onclick = () => document.getElementById('withdraw-modal').style.display = 'none';
    document.getElementById('confirm-withdraw').onclick = processWithdraw;
    
    document.getElementById('save-nickname-btn').onclick = saveNick;
});

// --- AUTH STATE ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        const userRef = doc(db, "users", user.uid);
        const snap = await getDoc(userRef);
        
        if (!snap.exists() || !snap.data().nickname) {
            if(!snap.exists()) await setDoc(userRef, { email: user.email, balance: 0, uid: user.uid, history: [] });
            document.getElementById('auth-screen').classList.remove('active');
            document.getElementById('nickname-modal').style.display = 'flex';
        } else {
            initDashboard(snap.data());
        }
    } else {
        document.getElementById('dashboard-screen').classList.add('hidden');
        document.getElementById('auth-screen').classList.remove('hidden');
        document.getElementById('auth-screen').classList.add('active');
    }
});

async function saveNick() {
    const nick = document.getElementById('google-nickname-input').value;
    if(nick) {
        await updateDoc(doc(db, "users", currentUser.uid), { nickname: nick });
        location.reload();
    }
}

function initDashboard(data) {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('dashboard-screen').classList.remove('hidden');
    
    document.getElementById('header-nick').innerText = data.nickname;
    document.getElementById('profile-name').innerText = data.nickname;
    document.getElementById('profile-email').innerText = currentUser.email;
    document.getElementById('profile-id').innerText = "ID: " + currentUser.uid.slice(0,6).toUpperCase();

    // Wallet Listener
    onSnapshot(doc(db, "users", currentUser.uid), (docSnap) => {
        if(docSnap.exists()) {
            currentBalance = docSnap.data().balance;
            document.getElementById('wallet-balance').innerText = currentBalance.toLocaleString();
            renderTxHistory(docSnap.data().history);
        }
    });

    startAviator();
    startBotSimulation();
    loadMatches(); // Sports
}

function renderTxHistory(hist) {
    const list = document.getElementById('tx-history');
    list.innerHTML = "";
    if(!hist) return;
    hist.slice(-10).reverse().forEach(tx => {
        list.innerHTML += `<div class="match-card" style="font-size:12px; padding:10px;">
            <div style="display:flex; justify-content:space-between;">
                <span>${tx.type}</span>
                <span style="color:${tx.amount>0?'var(--neon-green)':'var(--neon-red)'}">${tx.amount}</span>
            </div>
        </div>`;
    });
}

// --- AVIATOR (SILENT, 10s) ---
let avState = "WAITING";
let avMult = 1.00;
let avBet = 0;
let avCash = false;

function startAviator() {
    setInterval(() => {
        const now = Date.now();
        const loop = now % 10000; // 10s loop
        
        if (loop < 3000) { // WAITING
            if(avState !== "WAITING") {
                avState = "WAITING";
                document.getElementById('status-text').innerText = "NEXT ROUND...";
                document.getElementById('multiplier-display').innerText = "1.00x";
                document.getElementById('multiplier-display').style.color = "white";
                document.getElementById('rocket-icon').style.transform = "rotate(0deg)";
                
                const btn = document.getElementById('bet-btn');
                if(avBet > 0 && !avCash) {
                    avBet = 0; 
                    btn.innerText = "LOST";
                    btn.style.background = "#333";
                    setTimeout(() => { btn.innerText = "BET"; btn.style.background = "var(--neon-green)"; }, 1500);
                } else {
                    btn.innerText = "BET";
                    btn.style.background = "var(--neon-green)";
                }
            }
        } else { // FLYING
            avState = "FLYING";
            const flyTime = loop - 3000;
            avMult = (1 + (flyTime/1000) * 0.3).toFixed(2);
            document.getElementById('status-text').innerText = "FLYING";
            document.getElementById('rocket-icon').style.transform = "translate(5px, -5px)";

            const seed = Math.floor(now / 10000);
            const crash = ((seed % 6) + 1.1).toFixed(2);

            if (parseFloat(avMult) >= parseFloat(crash)) {
                avState = "CRASHED";
                document.getElementById('multiplier-display').innerText = crash + "x";
                document.getElementById('multiplier-display').style.color = "var(--neon-red)";
                document.getElementById('status-text').innerText = "CRASHED";
                // Add History Only Once
                const hist = document.getElementById('round-history');
                if(hist.firstChild && hist.firstChild.innerText !== crash+"x") {
                    hist.innerHTML = `<span class="history-pill ${crash>=2?'purple':'blue'}">${crash}x</span>` + hist.innerHTML;
                }
            } else {
                document.getElementById('multiplier-display').innerText = avMult + "x";
                if(avBet > 0 && !avCash) {
                    const btn = document.getElementById('bet-btn');
                    btn.innerText = "CASH OUT " + Math.floor(avBet * avMult);
                    btn.style.background = "var(--neon-red)";
                    
                    if(document.getElementById('auto-cashout-toggle').checked && avMult >= document.getElementById('auto-cashout-val').value) {
                        doCashout();
                    }
                }
            }
        }
    }, 100);
}

function placeBet() {
    if(avState === "WAITING" && avBet === 0) {
        const amt = parseInt(document.getElementById('bet-amount').value);
        if(amt > currentBalance) return alert("Low Funds");
        avBet = amt; avCash = false;
        updateDoc(doc(db, "users", currentUser.uid), { balance: currentBalance - amt, history: arrayUnion({type:"Bet Aviator", amount:-amt, date:new Date().toISOString()}) });
        document.getElementById('bet-btn').innerText = "BET PLACED";
        document.getElementById('bet-btn').style.background = "#ff9900";
    } else if (avState === "FLYING" && avBet > 0 && !avCash) {
        doCashout();
    }
}

function doCashout() {
    avCash = true;
    const win = Math.floor(avBet * avMult);
    updateDoc(doc(db, "users", currentUser.uid), { balance: currentBalance + win, history: arrayUnion({type:"Win Aviator", amount:win, date:new Date().toISOString()}) });
    document.getElementById('bet-btn').innerText = "WON " + win;
    document.getElementById('bet-btn').style.background = "var(--neon-green)";
}

// --- BOTS (GENERIC NAMES) ---
function startBotSimulation() {
    const names = ["User884", "Winner22", "Player_X", "Speedy", "Lucky77", "ProGamer", "King01"];
    const list = document.getElementById('live-bets-list');
    setInterval(() => {
        if(avState === "FLYING") {
            const name = names[Math.floor(Math.random()*names.length)];
            const amt = [100, 200, 500, 1000][Math.floor(Math.random()*4)];
            const action = Math.random() > 0.6 ? "win" : "bet";
            
            const div = document.createElement('div');
            div.className = "bot-row " + (action === "win" ? "win" : "");
            div.innerHTML = `<span>${name}</span> <span>${action==="win"?"+":""}${amt}</span>`;
            list.prepend(div);
            if(list.children.length > 8) list.removeChild(list.lastChild);
        }
    }, 1500);
}

// --- SPORTS (ALWAYS SHOWS MATCHES) ---
async function loadMatches() {
    const list = document.getElementById('fixtures-list');
    list.innerHTML = '<div class="loader" style="text-align:center;">Loading...</div>';
    const today = new Date().toISOString().split('T')[0];
    try {
        const res = await fetch(`https://api-football-v1.p.rapidapi.com/v3/fixtures?date=${today}`, {
            headers: { 'X-RapidAPI-Key': RAPID_API_KEY, 'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com' }
        });
        const data = await res.json();
        if(data.response && data.response.length > 0) renderMatches(data.response);
        else renderVirtuals();
    } catch(e) { renderVirtuals(); }
}

function renderVirtuals() {
    const list = document.getElementById('fixtures-list');
    list.innerHTML = `<div style="text-align:center; padding:10px; color:#888;">Simulated Live League (24/7)</div>`;
    const teams = [ ["Man City", "Liverpool"], ["Arsenal", "Chelsea"], ["Real Madrid", "Barca"], ["Bayern", "Dortmund"] ];
    teams.forEach(pair => {
        const odds = (Math.random()*2+1.2).toFixed(2);
        list.innerHTML += `<div class="match-card">
            <div><b>${pair[0]}</b> vs <b>${pair[1]}</b><br><span class="live-badge">V-LIVE</span></div>
            <button class="neon-btn" style="width:auto; padding:5px 15px;" onclick="alert('Bet Placed!')">${odds}</button>
        </div>`;
    });
}

function renderMatches(matches) {
    const list = document.getElementById('fixtures-list');
    list.innerHTML = "";
    matches.slice(0,20).forEach(m => {
        const home = m.teams.home.name;
        const away = m.teams.away.name;
        const odds = (Math.random()*2+1.2).toFixed(2);
        list.innerHTML += `<div class="match-card">
            <div><b>${home}</b> vs <b>${away}</b><br><span class="live-badge" style="background:#222; color:#ccc;">UPCOMING</span></div>
            <button class="neon-btn" style="width:auto; padding:5px 15px;" onclick="alert('Bet Placed!')">${odds}</button>
        </div>`;
    });
}

// --- HELPERS ---
function switchTab(tab) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
    
    document.getElementById('tab-' + tab).classList.remove('hidden');
    document.getElementById('tab-' + tab).classList.add('active');
    
    if(tab==='sports') document.getElementById('nav-sports').classList.add('active');
    if(tab==='aviator') document.getElementById('nav-aviator').classList.add('active');
    if(tab==='profile') document.getElementById('nav-profile').classList.add('active');

    if(tab === 'sports') loadMatches();
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
        callback: function(r) {
            updateDoc(doc(db, "users", currentUser.uid), { balance: currentBalance + amt, history: arrayUnion({type:"Deposit", amount:amt, date:new Date().toISOString()}) });
        }
    });
    h.openIframe();
}

function processWithdraw() {
    const amt = parseInt(document.getElementById('withdraw-amount').value);
    if(amt > currentBalance) return alert("Low Funds");
    updateDoc(doc(db, "users", currentUser.uid), { balance: currentBalance - amt, history: arrayUnion({type:"Withdraw", amount:-amt, date:new Date().toISOString()}) });
    document.getElementById('withdraw-modal').style.display='none';
    const bank = document.getElementById('withdraw-bank').value;
    window.open(`https://wa.me/2347056353236?text=Withdraw ${amt} to ${bank}`, '_blank');
}
