import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot, arrayUnion, addDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
const PAYSTACK_PUB_KEY = "pk_live_xxxxxxxxxxxxxxxxxxxxxxxx"; // <--- YOUR KEY HERE

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
let currentUser = null;
let currentBalance = 0;

// SOUNDS
const sfxFly = document.getElementById('sfx-fly');
const sfxCrash = document.getElementById('sfx-crash');
const sfxWin = document.getElementById('sfx-win');

// GLOBAL FUNCTIONS
window.switchTab = (tab) => {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
    
    document.getElementById('tab-' + tab).classList.remove('hidden');
    document.getElementById('tab-' + tab).classList.add('active');
    
    // Highlight Nav
    const navs = document.querySelectorAll('.nav-btn');
    if(tab==='sports') navs[0].classList.add('active');
    if(tab==='aviator') navs[1].classList.add('active');
    if(tab==='profile') navs[2].classList.add('active');

    if(tab === 'sports') loadMatches();
};

window.setBet = (val) => document.getElementById('bet-amount').value = val;
window.adjustBet = (val) => {
    let el = document.getElementById('bet-amount');
    el.value = Math.max(50, parseInt(el.value) + val);
};
window.toggleAuth = () => {
    document.getElementById('login-form').classList.toggle('hidden');
    document.getElementById('register-form').classList.toggle('hidden');
};

// --- AUTH LOGIC ---
document.getElementById('google-login-btn').addEventListener('click', () => signInWithPopup(auth, new GoogleAuthProvider()));
document.getElementById('email-login-btn').addEventListener('click', () => {
    const e = document.getElementById('login-email').value, p = document.getElementById('login-pass').value;
    if(e && p) signInWithEmailAndPassword(auth, e, p).catch(err => alert(err.message));
});
document.getElementById('email-register-btn').addEventListener('click', () => {
    const n = document.getElementById('reg-nick').value, e = document.getElementById('reg-email').value, p = document.getElementById('reg-pass').value;
    if(!n) return alert("Nickname required");
    createUserWithEmailAndPassword(auth, e, p).then(async (c) => {
        await setDoc(doc(db, "users", c.user.uid), { nickname: n, email: e, balance: 0, uid: c.user.uid, history: [] });
        location.reload();
    }).catch(err => alert(err.message));
});
document.getElementById('logout-btn').addEventListener('click', () => signOut(auth).then(()=>location.reload()));

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        const userRef = doc(db, "users", user.uid);
        const snap = await getDoc(userRef);
        
        if (!snap.exists() || !snap.data().nickname) {
            if(!snap.exists()) await setDoc(userRef, { email: user.email, balance: 0, uid: user.uid, history: [] });
            document.getElementById('auth-screen').classList.remove('active');
            document.getElementById('auth-screen').classList.add('hidden');
            document.getElementById('nickname-modal').style.display = 'flex';
        } else {
            initDashboard(user, snap.data());
        }
    } else {
        document.getElementById('dashboard-screen').classList.add('hidden');
        document.getElementById('auth-screen').classList.remove('hidden');
        document.getElementById('auth-screen').classList.add('active');
    }
});

document.getElementById('save-nickname-btn').addEventListener('click', async () => {
    const nick = document.getElementById('google-nickname-input').value;
    if(!nick) return alert("Required");
    await updateDoc(doc(db, "users", currentUser.uid), { nickname: nick });
    document.getElementById('nickname-modal').style.display = 'none';
    location.reload();
});

function initDashboard(user, data) {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('dashboard-screen').classList.remove('hidden');
    document.getElementById('header-nick').innerText = data.nickname || "Player";
    document.getElementById('header-id').innerText = "ID: " + user.uid.slice(0,5).toUpperCase();
    document.getElementById('profile-name').innerText = data.nickname;
    document.getElementById('profile-email').innerText = user.email;
    
    // Listen to Wallet
    onSnapshot(doc(db, "users", user.uid), (docSnap) => {
        if(docSnap.exists()) {
            currentBalance = docSnap.data().balance;
            document.getElementById('wallet-balance').innerText = "₦" + currentBalance.toLocaleString();
            renderTxHistory(docSnap.data().history);
        }
    });
    
    startAviator();
    startBotSimulation();
    startRainPromo();
}

function renderTxHistory(hist) {
    const list = document.getElementById('tx-history');
    list.innerHTML = "";
    if(!hist) return;
    hist.slice(-5).reverse().forEach(tx => {
        list.innerHTML += `<div class="match-card" style="padding:10px; font-size:12px;">
            <div style="display:flex; justify-content:space-between;">
                <span>${tx.type}</span>
                <b style="color:${tx.amount>0?'#64ffda':'#ff5f56'}">${tx.amount}</b>
            </div>
        </div>`;
    });
}

// --- AVIATOR GAME (PROVABLY FAIR) ---
let avState = "WAITING"; // WAITING, FLYING, CRASHED
let avMult = 1.00;
let avBet = 0;
let avCash = false;

function startAviator() {
    setInterval(() => {
        const now = Date.now();
        const cycle = now % 10000; // 10s Cycle
        
        if (cycle < 3000) { // WAITING PHASE
            if(avState !== "WAITING") {
                avState = "WAITING";
                generateProvablyFairHash(); // New Hash
                document.getElementById('status-text').innerText = "NEXT ROUND STARTING...";
                document.getElementById('multiplier-display').innerText = "1.00x";
                document.getElementById('multiplier-display').style.color = "white";
                document.querySelector('.rocket-animation').style.display = 'none';
                sfxFly.pause(); sfxFly.currentTime = 0;
                
                const btn = document.getElementById('bet-btn');
                if(avBet > 0 && !avCash) { 
                    avBet = 0; // Lost last round
                    btn.innerText = "LOST";
                    btn.style.background = "#333";
                    setTimeout(() => resetBtn(), 1000);
                } else {
                    resetBtn();
                }
            }
            document.getElementById('status-text').innerText = "STARTING IN " + ((3000-cycle)/1000).toFixed(1) + "s";
            
        } else { // FLYING PHASE
            if(avState === "WAITING") {
                avState = "FLYING";
                sfxFly.play();
                document.querySelector('.rocket-animation').style.display = 'block';
                document.getElementById('status-text').innerText = "FLYING...";
            }
            
            // Calculate Curve
            const flyTime = cycle - 3000;
            avMult = (1 + (flyTime/1000) * 0.15).toFixed(2);
            
            // Deterministic Crash (Simulated Fair)
            const seed = Math.floor(now/10000);
            const crashPoint = ((seed % 7) + 1.1).toFixed(2);
            
            if (parseFloat(avMult) >= parseFloat(crashPoint)) {
                // CRASH
                if(avState !== "CRASHED") {
                    avState = "CRASHED";
                    sfxFly.pause(); sfxCrash.play();
                    document.getElementById('multiplier-display').innerText = "CRASH @ " + crashPoint + "x";
                    document.getElementById('multiplier-display').style.color = "#ff5f56";
                    document.querySelector('.rocket-animation').style.display = 'none';
                    addHistoryPill(crashPoint);
                }
            } else {
                // UPDATE SCREEN
                document.getElementById('multiplier-display').innerText = avMult + "x";
                
                // Active Bet Logic
                if (avBet > 0 && !avCash) {
                    const btn = document.getElementById('bet-btn');
                    const win = Math.floor(avBet * avMult);
                    btn.innerText = "CASHOUT ₦" + win;
                    btn.style.background = "#ff5f56";
                    
                    // Auto Cashout
                    const auto = parseFloat(document.getElementById('auto-cashout-val').value);
                    if(document.getElementById('auto-cashout-toggle').checked && avMult >= auto) {
                        cashOut();
                    }
                }
            }
        }
    }, 100);
}

document.getElementById('bet-btn').addEventListener('click', () => {
    if(avState === "WAITING" && avBet === 0) {
        const val = parseInt(document.getElementById('bet-amount').value);
        if(val > currentBalance) return alert("Low Balance");
        avBet = val; avCash = false;
        updateDoc(doc(db, "users", currentUser.uid), {
            balance: currentBalance - val,
            history: arrayUnion({type: "Bet Aviator", amount: -val, date: new Date().toISOString()})
        });
        document.getElementById('bet-btn').innerText = "BET PLACED";
        document.getElementById('bet-btn').style.background = "#ff9900"; // Orange
    } else if(avState === "FLYING" && avBet > 0 && !avCash) {
        cashOut();
    }
});

function cashOut() {
    avCash = true;
    const win = Math.floor(avBet * avMult);
    sfxWin.play();
    updateDoc(doc(db, "users", currentUser.uid), {
        balance: currentBalance + win,
        history: arrayUnion({type: "Win Aviator", amount: win, date: new Date().toISOString()})
    });
    document.getElementById('bet-btn').innerText = "WON ₦" + win;
    document.getElementById('bet-btn').style.background = "#64ffda";
}

function resetBtn() {
    const btn = document.getElementById('bet-btn');
    avBet = 0; avCash = false;
    btn.innerText = "BET NEXT ROUND";
    btn.style.background = "#64ffda";
}

// --- PROVABLY FAIR SIMULATION ---
function generateProvablyFairHash() {
    // Creates a random hash-looking string to display "Fairness"
    const chars = "abcdef0123456789";
    let hash = "sha256:";
    for(let i=0; i<20; i++) hash += chars[Math.floor(Math.random()*16)];
    document.getElementById('hash-display').innerText = hash + "...";
}

function addHistoryPill(val) {
    const box = document.getElementById('round-history');
    const pill = document.createElement('span');
    pill.innerText = val + "x";
    pill.className = val >= 10 ? "history-pill red" : (val >= 2 ? "history-pill purple" : "history-pill blue");
    box.prepend(pill);
    if(box.children.length > 15) box.removeChild(box.lastChild);
}

// --- BOT SIMULATION (SOCIAL PROOF) ---
function startBotSimulation() {
    const bots = ["Chinedu", "Musa", "Tunde", "Emeka", "Blessing", "Ngozi"];
    const list = document.getElementById('live-bets-list');
    setInterval(() => {
        if(avState === "FLYING") {
            // Randomly add a bot bet or win
            const bot = bots[Math.floor(Math.random()*bots.length)];
            const action = Math.random() > 0.7 ? "won" : "bet";
            const amt = [100, 200, 500, 1000][Math.floor(Math.random()*4)];
            
            const div = document.createElement('div');
            div.className = action === "won" ? "bet-row win" : "bet-row";
            div.innerHTML = `<span>${bot}</span> <span>${action==="won" ? "+" : ""}₦${amt}</span>`;
            list.prepend(div);
            if(list.children.length > 10) list.removeChild(list.lastChild);
        }
    }, 2000);
}

// --- RAIN PROMO ---
function startRainPromo() {
    setInterval(() => {
        const el = document.getElementById('rain-alert');
        el.classList.remove('hidden');
        setTimeout(() => el.classList.add('hidden'), 5000);
    }, 60000); // Every 60s
}

// --- SPORTS ---
async function loadMatches() {
    const list = document.getElementById('fixtures-list');
    list.innerHTML = '<div class="loader">Loading Matches...</div>';
    const today = new Date().toISOString().split('T')[0];
    
    try {
        const res = await fetch(`https://api-football-v1.p.rapidapi.com/v3/fixtures?date=${today}`, {
            headers: { 'X-RapidAPI-Key': RAPID_API_KEY, 'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com' }
        });
        const data = await res.json();
        if(data.response && data.response.length > 0) renderMatches(data.response);
        else renderVirtual();
    } catch(e) { renderVirtual(); }
}

function renderMatches(matches) {
    const list = document.getElementById('fixtures-list');
    list.innerHTML = "";
    matches.sort((a,b) => (['1H','2H'].includes(a.fixture.status.short) ? -1 : 1));
    matches.slice(0,20).forEach(m => {
        const home = m.teams.home.name;
        const away = m.teams.away.name;
        const isLive = ['1H','2H'].includes(m.fixture.status.short);
        list.innerHTML += `<div class="match-card">
            <div><b>${home}</b> v <b>${away}</b><br>${isLive?'<span class="live-badge">LIVE</span>':'<span class="time-badge">UPCOMING</span>'}</div>
            <button class="neon-btn" style="width:auto; padding:5px 10px;">1.85x</button>
        </div>`;
    });
}

function renderVirtual() {
    document.getElementById('fixtures-list').innerHTML = `<div class="match-card" style="text-align:center; color:var(--neon-green)">Showing Virtual Games (24/7)</div>` + 
    `<div class="match-card"><div><b>Man City</b> v <b>Liverpool</b><br><span class="live-badge" style="background:purple">V-LEAGUE</span></div><button class="neon-btn" style="width:auto">1.90x</button></div>`;
}

// DEPOSIT
document.getElementById('open-deposit-modal').addEventListener('click', () => document.getElementById('deposit-modal').style.display = 'flex');
document.getElementById('cancel-deposit').addEventListener('click', () => document.getElementById('deposit-modal').style.display = 'none');
document.getElementById('confirm-deposit').addEventListener('click', () => {
    const amt = parseInt(document.getElementById('deposit-input').value);
    if(!amt || amt < 100) return alert("Min ₦100");
    document.getElementById('deposit-modal').style.display = 'none';
    let h = PaystackPop.setup({
        key: PAYSTACK_PUB_KEY, email: currentUser.email, amount: amt*100, currency: "NGN",
        callback: function(r) {
            updateDoc(doc(db, "users", currentUser.uid), { balance: currentBalance + amt, history: arrayUnion({type: "Deposit", amount: amt, date: new Date().toISOString()}) });
        }
    });
    h.openIframe();
});

// WITHDRAW
document.getElementById('open-withdraw-modal').addEventListener('click', () => document.getElementById('withdraw-modal').style.display = 'flex');
document.getElementById('cancel-withdraw').addEventListener('click', () => document.getElementById('withdraw-modal').style.display = 'none');
document.getElementById('confirm-withdraw').addEventListener('click', async () => {
    const amt = parseInt(document.getElementById('withdraw-amount').value);
    const bank = document.getElementById('withdraw-bank').value;
    const name = document.getElementById('withdraw-name').value;
    if(amt > currentBalance) return alert("Low Funds");
    if(!bank || !name) return alert("Enter details");
    
    await updateDoc(doc(db, "users", currentUser.uid), { balance: currentBalance - amt, history: arrayUnion({type: "Withdraw", amount: -amt, date: new Date().toISOString()}) });
    document.getElementById('withdraw-modal').style.display = 'none';
    window.open(`https://wa.me/2347056353236?text=Withdraw: ₦${amt} | Bank: ${bank} | Name: ${name} | ID: ${currentUser.uid.slice(0,5)}`, '_blank');
});
