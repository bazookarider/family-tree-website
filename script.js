 import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot, arrayUnion, collection, query, where, getDocs, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
const PAYSTACK_PUB_KEY = "pk_live_xxxxxxxxxxxxxxxxxxxxxxxx"; // YOUR KEY HERE

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
let currentUser = null;
let currentBalance = 0;

// --- SOUNDS ---
// You can replace these URLs with your own mp3 links later
const soundFly = new Audio('https://assets.mixkit.co/active_storage/sfx/2573/2573-preview.mp3'); 
const soundCrash = new Audio('https://assets.mixkit.co/active_storage/sfx/2572/2572-preview.mp3'); 
soundFly.loop = true;

// --- GLOBAL UTILS ---
window.toggleAuth = () => {
    const login = document.getElementById('login-form');
    const reg = document.getElementById('register-form');
    if(login.style.display === 'none') { login.style.display='block'; reg.style.display='none'; }
    else { login.style.display='none'; reg.style.display='block'; }
};

window.switchTab = (tab) => {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
    
    // Find the button inside nav that was clicked (approximate logic)
    const navs = document.querySelectorAll('.nav-btn');
    if(tab === 'sports') navs[0].classList.add('active');
    if(tab === 'aviator') navs[1].classList.add('active');
    if(tab === 'profile') navs[2].classList.add('active');

    document.getElementById('tab-' + tab).classList.add('active');
    if (tab === 'sports') loadMatches();
};

window.setBet = (val) => document.getElementById('bet-amount').value = val;
window.toggleBetslip = () => document.getElementById('betslip-panel').classList.remove('open');

// --- AUTH ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        const userRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(userRef);
        
        // Ensure profile exists
        if (!docSnap.exists() || !docSnap.data().nickname) {
            // Force create/update if missing
            await setDoc(userRef, { 
                email: user.email, 
                nickname: user.displayName || "Player", 
                balance: 0, 
                uid: user.uid, 
                history: [] 
            }, { merge: true });
        }

        document.getElementById('auth-screen').classList.remove('active');
        document.getElementById('dashboard-screen').classList.add('active');
        document.getElementById('bottom-nav').classList.remove('hidden'); // Show Bottom Nav

        // Update UI
        const data = (await getDoc(userRef)).data();
        document.getElementById('header-nick').innerText = data.nickname;
        document.getElementById('header-id').innerText = "ID: " + user.uid.slice(0,5).toUpperCase();
        document.getElementById('profile-name').innerText = data.nickname;
        document.getElementById('profile-email').innerText = data.email;
        
        loadWallet();
        startAviator();
        loadMatches();
    } else {
        document.getElementById('dashboard-screen').classList.remove('active');
        document.getElementById('bottom-nav').classList.add('hidden');
        document.getElementById('auth-screen').classList.add('active');
    }
});

// Login Handlers
document.getElementById('google-login-btn').addEventListener('click', () => signInWithPopup(auth, new GoogleAuthProvider()));
document.getElementById('email-login-btn').addEventListener('click', () => {
    signInWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-pass').value)
    .catch(e => alert(e.message));
});
document.getElementById('email-register-btn').addEventListener('click', () => {
    const nick = document.getElementById('reg-nick').value;
    const email = document.getElementById('reg-email').value;
    const pass = document.getElementById('reg-pass').value;
    if(!nick) return alert("Nickname required");
    createUserWithEmailAndPassword(auth, email, pass).then(async (cred) => {
        await setDoc(doc(db, "users", cred.user.uid), { nickname: nick, email: email, balance: 0, uid: cred.user.uid, history: [] });
    }).catch(e => alert(e.message));
});
document.getElementById('logout-btn').addEventListener('click', () => signOut(auth).then(()=>location.reload()));

// --- WALLET ---
function loadWallet() {
    onSnapshot(doc(db, "users", currentUser.uid), (snap) => {
        if(snap.exists()) {
            const data = snap.data();
            currentBalance = data.balance || 0;
            document.getElementById('wallet-balance').innerText = "₦" + currentBalance.toLocaleString();
            
            // Transaction History (Profile)
            const list = document.getElementById('tx-history');
            list.innerHTML = "";
            if(data.history) {
                data.history.slice(-10).reverse().forEach(tx => {
                    const color = tx.amount > 0 ? '#64ffda' : '#ff5f56';
                    list.innerHTML += `<div style="display:flex; justify-content:space-between; padding:8px; border-bottom:1px solid #222;">
                        <span>${tx.type}</span>
                        <span style="color:${color}">${tx.amount}</span>
                    </div>`;
                });
            }
        }
    });
}

// Deposit & Withdraw (Simplified)
document.getElementById('btn-deposit').addEventListener('click', () => {
    const amount = parseInt(prompt("Amount to Deposit:"));
    if(!amount) return;
    let handler = PaystackPop.setup({
        key: PAYSTACK_PUB_KEY, email: currentUser.email, amount: amount * 100, currency: "NGN",
        callback: function(res) {
            updateDoc(doc(db, "users", currentUser.uid), { 
                balance: currentBalance + amount, 
                history: arrayUnion({type: "Deposit", amount: amount, date: new Date().toISOString()})
            });
        }
    });
    handler.openIframe();
});

document.getElementById('btn-withdraw').addEventListener('click', async () => {
    const amount = parseInt(prompt("Amount to Withdraw:"));
    const bank = prompt("Bank Name & Account No:");
    if(amount > currentBalance) return alert("Insufficient funds");
    await updateDoc(doc(db, "users", currentUser.uid), {
        balance: currentBalance - amount,
        history: arrayUnion({type: "Withdrawal", amount: -amount, date: new Date().toISOString()})
    });
    window.open(`https://wa.me/2347056353236?text=WithdrawRequest:${amount}|Bank:${bank}|ID:${currentUser.uid}`, '_blank');
});

// --- SPORTS (REAL + VIRTUAL FALLBACK) ---
async function loadMatches() {
    const list = document.getElementById('fixtures-list');
    list.innerHTML = '<div style="text-align:center; padding:20px;">Checking Live Games...</div>';
    
    // 1. Try Real API
    const today = new Date().toISOString().split('T')[0];
    try {
        const res = await fetch(`https://api-football-v1.p.rapidapi.com/v3/fixtures?date=${today}`, {
            headers: { 'X-RapidAPI-Key': RAPID_API_KEY, 'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com' }
        });
        const data = await res.json();
        
        if (data.response && data.response.length > 0) {
            renderList(data.response);
        } else {
            renderVirtual(); // No real games found
        }
    } catch (e) {
        renderVirtual(); // Error or Limit Reached
    }
}

function renderList(matches) {
    const list = document.getElementById('fixtures-list');
    list.innerHTML = "";
    matches.sort((a,b) => (['1H','2H'].includes(a.fixture.status.short) ? -1 : 1)); // Live first
    
    matches.slice(0, 20).forEach(m => {
        const home = m.teams.home.name;
        const away = m.teams.away.name;
        const odds = (Math.random()*2+1.1).toFixed(2);
        const isLive = ['1H','2H'].includes(m.fixture.status.short);
        
        const div = document.createElement('div');
        div.className = 'match-card';
        div.innerHTML = `<div><b>${home}</b><br>vs<br><b>${away}</b></div>
                         <div>${isLive ? '<span class="live-badge">LIVE</span>' : '<span class="time-badge">UPCOMING</span>'}
                         <br><button class="neon-btn" style="padding:5px 10px; margin-top:5px;" onclick="openBetslip('${home} v ${away}', ${odds})">${odds}</button></div>`;
        list.appendChild(div);
    });
}

function renderVirtual() {
    const list = document.getElementById('fixtures-list');
    list.innerHTML = `<div style="text-align:center; padding:10px; color:var(--neon-green);">API Limit / No Games - Showing Virtuals</div>`;
    const teams = ["Man City", "Real Madrid", "Barca", "Chelsea", "Arsenal", "Liverpool"];
    for(let i=0; i<6; i+=2) {
        const div = document.createElement('div');
        div.className = 'match-card';
        div.innerHTML = `<div><b>${teams[i]}</b><br>vs<br><b>${teams[i+1]}</b></div>
                         <div><span class="live-badge" style="background:#bd34fe;">VIRTUAL</span>
                         <br><button class="neon-btn" style="padding:5px 10px; margin-top:5px;" onclick="openBetslip('${teams[i]} v ${teams[i+1]}', 1.85)">1.85</button></div>`;
        list.appendChild(div);
    }
}

// Betslip Logic
window.openBetslip = (match, odds) => {
    document.getElementById('betslip-panel').classList.add('open');
    document.getElementById('betslip-match-name').innerText = match;
    document.getElementById('betslip-odds').innerText = odds;
};

document.getElementById('place-sports-bet').addEventListener('click', () => {
    const stake = parseInt(document.getElementById('sports-stake').value);
    if(stake > currentBalance) return alert("Low Balance");
    updateDoc(doc(db, "users", currentUser.uid), {
        balance: currentBalance - stake,
        history: arrayUnion({type: "Bet (Sports)", amount: -stake, date: new Date().toISOString()})
    });
    alert("Bet Placed!");
    toggleBetslip();
});

// --- AVIATOR (Last 20 History + Sound) ---
let avActive=false, avBet=0, avCash=false, avMult=1.00;
let historyLog = [1.20, 5.40, 1.10, 2.30]; // Fake initial history

function startAviator() {
    renderHistory();
    setInterval(() => {
        const now = Date.now();
        const loop = now % 10000;
        
        if (loop < 3000) { // Waiting
            avActive = false;
            document.getElementById('status-text').innerText = "NEXT ROUND IN " + ((3000-loop)/1000).toFixed(1);
            document.getElementById('multiplier-display').innerText = "1.00x";
            document.getElementById('multiplier-display').style.color = "white";
            document.querySelector('.rocket-animation').style.display = 'none';
            soundFly.pause();
            
            const btn = document.getElementById('bet-btn');
            if(!avBet) { btn.innerText = "BET NEXT ROUND"; btn.style.background = "transparent"; }
            else { btn.innerText = "BET PLACED (" + avBet + ")"; btn.style.background = "#ff9900"; }
            
        } else { // Flying
            if(!avActive) { soundFly.play(); document.querySelector('.rocket-animation').style.display = 'block'; }
            avActive = true;
            document.getElementById('status-text').innerText = "FLYING...";
            avMult = (1 + (loop-3000)/1000 * 0.15).toFixed(2);
            
            const seed = Math.floor(now/10000);
            const crash = ((seed % 7) + 1.1).toFixed(2); // Simple crash logic
            
            if(avMult >= crash) {
                // CRASH
                document.getElementById('multiplier-display').innerText = "CRASH @ " + crash + "x";
                document.getElementById('multiplier-display').style.color = "var(--neon-red)";
                document.querySelector('.rocket-animation').style.display = 'none';
                soundFly.pause();
                
                // Only play crash sound once per round
                if(avActive) { soundCrash.play(); addToHistory(crash); } 
                avActive = false; // Stop updates until next loop

                if(avBet > 0 && !avCash) { 
                    avBet = 0; // Lost
                    document.getElementById('bet-btn').innerText = "LOST";
                }
            } else {
                document.getElementById('multiplier-display').innerText = avMult + "x";
                if(avBet > 0 && !avCash) {
                    const btn = document.getElementById('bet-btn');
                    btn.innerText = "CASHOUT ₦" + Math.floor(avBet*avMult);
                    btn.style.background = "var(--neon-green)";
                    btn.style.color = "#0a192f";
                    
                    const auto = parseFloat(document.getElementById('auto-cashout-val').value);
                    if(document.getElementById('auto-cashout-toggle').checked && avMult >= auto) doAviatorCashout();
                }
            }
        }
    }, 100);
}

document.getElementById('bet-btn').addEventListener('click', () => {
    if(!avActive) {
        // Place Bet
        const val = parseInt(document.getElementById('bet-amount').value);
        if(val > currentBalance) return alert("Low Balance");
        avBet = val; avCash = false;
        updateDoc(doc(db, "users", currentUser.uid), { balance: currentBalance - val, history: arrayUnion({type: "Bet (Aviator)", amount: -val, date: new Date().toISOString()}) });
    } else if(avActive && avBet > 0 && !avCash) {
        doAviatorCashout();
    }
});

function doAviatorCashout() {
    avCash = true;
    const win = Math.floor(avBet * avMult);
    updateDoc(doc(db, "users", currentUser.uid), { balance: currentBalance + win, history: arrayUnion({type: "Win (Aviator)", amount: win, date: new Date().toISOString()}) });
    avBet = 0;
    document.getElementById('bet-btn').innerText = "WON ₦" + win;
}

function addToHistory(val) {
    historyLog.unshift(val);
    if(historyLog.length > 20) historyLog.pop();
    renderHistory();
}

function renderHistory() {
    const box = document.getElementById('round-history');
    box.innerHTML = "";
    historyLog.forEach(h => {
        let color = "blue";
        if(h >= 2.0) color = "purple";
        if(h >= 10.0) color = "red";
        box.innerHTML += `<span class="history-pill ${color}">${h}x</span>`;
    });
}
