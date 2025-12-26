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

const RAPID_API_KEY = "cb7d574582mshf8c7d0e5d409675p1f854fjsn"; 
const PAYSTACK_PUB_KEY = "pk_live_xxxxxxxxxxxxxxxxxxxxxxxx"; 

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
let currentUser = null;
let currentBalance = 0;

// === SAFETY LOADER: Fixes buttons not clicking ===
document.addEventListener('DOMContentLoaded', () => {
    console.log("VELOBET SAFE LOAD");

    // BUTTONS
    document.getElementById('google-login-btn').onclick = () => signInWithPopup(auth, new GoogleAuthProvider());
    
    document.getElementById('email-login-btn').onclick = () => {
        const e = document.getElementById('login-email').value;
        const p = document.getElementById('login-pass').value;
        if(e && p) signInWithEmailAndPassword(auth, e, p).catch(err => alert("Login Error: " + err.message));
    };

    document.getElementById('email-register-btn').onclick = () => {
        const n = document.getElementById('reg-nick').value;
        const e = document.getElementById('reg-email').value;
        const p = document.getElementById('reg-pass').value;
        if(!n) return alert("Username is required");
        
        createUserWithEmailAndPassword(auth, e, p).then(async (c) => {
            // Force create profile
            await setDoc(doc(db, "users", c.user.uid), { 
                nickname: n, email: e, balance: 0, uid: c.user.uid, history: [] 
            });
            window.location.reload();
        }).catch(err => alert("Register Error: " + err.message));
    };

    // NAV
    document.getElementById('goto-register').onclick = () => toggleForms(true);
    document.getElementById('goto-login').onclick = () => toggleForms(false);
    document.getElementById('logout-btn').onclick = () => signOut(auth).then(()=>window.location.reload());

    // GAME & NAV
    document.getElementById('nav-sports').onclick = () => switchTab('sports');
    document.getElementById('nav-aviator').onclick = () => switchTab('aviator');
    document.getElementById('nav-profile').onclick = () => switchTab('profile');
    
    document.getElementById('bet-btn').onclick = placeBet;
    document.getElementById('inc-bet').onclick = () => adjustBet(50);
    document.getElementById('dec-bet').onclick = () => adjustBet(-50);
    
    document.querySelectorAll('.chip-btn').forEach(btn => {
        btn.onclick = () => document.getElementById('bet-amount').value = btn.dataset.val;
    });

    // MODALS
    document.getElementById('open-deposit-modal').onclick = () => showModal('deposit-modal');
    document.getElementById('cancel-deposit').onclick = () => hideModal('deposit-modal');
    document.getElementById('confirm-deposit').onclick = processDeposit;

    document.getElementById('open-withdraw-modal').onclick = () => showModal('withdraw-modal');
    document.getElementById('cancel-withdraw').onclick = () => hideModal('withdraw-modal');
    document.getElementById('confirm-withdraw').onclick = processWithdraw;
    
    document.getElementById('save-nickname-btn').onclick = saveNick;
});

function toggleForms(showRegister) {
    document.getElementById('login-form').classList.toggle('hidden', showRegister);
    document.getElementById('register-form').classList.toggle('hidden', !showRegister);
}

function showModal(id) { document.getElementById(id).style.display = 'flex'; }
function hideModal(id) { document.getElementById(id).style.display = 'none'; }

// === AUTH & BLANK SCREEN FIX ===
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        const userRef = doc(db, "users", user.uid);
        
        try {
            const snap = await getDoc(userRef);
            if (snap.exists() && snap.data().nickname) {
                initDashboard(snap.data());
            } else {
                // If profile missing, create it or show modal
                if(!snap.exists()) await setDoc(userRef, { email: user.email, balance: 0, uid: user.uid, history: [] }, {merge:true});
                document.getElementById('auth-screen').classList.remove('active');
                document.getElementById('nickname-modal').style.display = 'flex';
            }
        } catch (e) {
            // ERROR FAILSAFE: If DB fails, load dashboard as Guest so screen isn't blank
            console.error("DB Error", e);
            initDashboard({ nickname: "Guest", balance: 0 });
        }
    } else {
        document.getElementById('dashboard-screen').classList.remove('active'); // Hide dashboard
        document.getElementById('dashboard-screen').classList.add('hidden');
        document.getElementById('auth-screen').classList.add('active'); // Show auth
    }
});

async function saveNick() {
    const nick = document.getElementById('google-nickname-input').value;
    if(nick) {
        await updateDoc(doc(db, "users", currentUser.uid), { nickname: nick });
        window.location.reload();
    }
}

function initDashboard(data) {
    // FORCE DASHBOARD VISIBILITY
    document.getElementById('auth-screen').classList.remove('active');
    document.getElementById('auth-screen').style.display = 'none'; 
    document.getElementById('nickname-modal').style.display = 'none';
    
    const dash = document.getElementById('dashboard-screen');
    dash.classList.remove('hidden');
    dash.classList.add('active'); // Ensure active class handles display

    document.getElementById('header-nick').innerText = data.nickname || "Player";
    document.getElementById('profile-name').innerText = data.nickname || "Player";
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
    loadMatches();
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

// === AVIATOR LOGIC ===
let avState="WAITING", avMult=1.00, avBet=0, avCash=false;

function startAviator() {
    setInterval(() => {
        const now = Date.now(), loop = now % 10000;
        
        if (loop < 3000) { // WAITING
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
                const hist = document.getElementById('round-history');
                if(!hist.firstChild || hist.firstChild.innerText !== crash+"x") {
                    hist.innerHTML = `<span class="history-pill ${crash>=2?'purple':'blue'}">${crash}x</span>` + hist.innerHTML;
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

function placeBet() {
    if(avState === "WAITING" && avBet === 0) {
        const amt = parseInt(document.getElementById('bet-amount').value);
        if(amt > currentBalance) return alert("Insufficient Balance");
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

// --- BOTS & SPORTS ---
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

async function loadMatches() {
    const list = document.getElementById('fixtures-list');
    list.innerHTML = '<div class="loader" style="text-align:center;">Loading...</div>';
    const today = new Date().toISOString().split('T')[0];
    try {
        const res = await fetch(`https://api-football-v1.p.rapidapi.com/v3/fixtures?date=${today}`, { headers: { 'X-RapidAPI-Key': RAPID_API_KEY, 'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com' } });
        const data = await res.json();
        if(data.response && data.response.length > 0) renderMatches(data.response);
        else renderVirtuals();
    } catch(e) { renderVirtuals(); }
}

function renderVirtuals() {
    const list = document.getElementById('fixtures-list');
    list.innerHTML = `<div style="text-align:center; padding:10px; color:#888;">Simulated Live League (24/7)</div>`;
    const teams = [ ["Man City", "Liverpool"], ["Arsenal", "Chelsea"], ["Real Madrid", "Barca"] ];
    teams.forEach(pair => {
        const odds = (Math.random()*2+1.2).toFixed(2);
        list.innerHTML += `<div class="match-card"><div><b>${pair[0]}</b> vs <b>${pair[1]}</b><br><span class="live-badge" style="background:#bd34fe;">V-LIVE</span></div><button class="neon-btn" style="width:auto; padding:5px 15px; font-size:12px;">${odds}</button></div>`;
    });
}

function renderMatches(matches) {
    const list = document.getElementById('fixtures-list');
    list.innerHTML = "";
    matches.slice(0,20).forEach(m => {
        const odds = (Math.random()*2+1.2).toFixed(2);
        list.innerHTML += `<div class="match-card"><div><b>${m.teams.home.name}</b> vs <b>${m.teams.away.name}</b><br><span class="live-badge" style="background:#333; color:#ccc;">UPCOMING</span></div><button class="neon-btn" style="width:auto; padding:5px 15px; font-size:12px;">${odds}</button></div>`;
    });
}

// UTILS
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
    if(PAYSTACK_PUB_KEY.startsWith("cb7d")) return alert("Wrong Key!");
    let h = PaystackPop.setup({
        key: PAYSTACK_PUB_KEY, email: currentUser.email, amount: amt*100, currency: "NGN",
        callback: function(r) { updateDoc(doc(db, "users", currentUser.uid), { balance: currentBalance + amt, history: arrayUnion({type:"Deposit", amount:amt, date:new Date().toISOString()}) }); }
    });
    h.openIframe();
}

function processWithdraw() {
    const amt = parseInt(document.getElementById('withdraw-amount').value);
    if(amt > currentBalance) return alert("Insufficient Balance");
    updateDoc(doc(db, "users", currentUser.uid), { balance: currentBalance - amt, history: arrayUnion({type:"Withdraw", amount:-amt, date:new Date().toISOString()}) });
    document.getElementById('withdraw-modal').style.display='none';
    window.open(`https://wa.me/2347056353236?text=Withdraw ${amt}`, '_blank');
}
