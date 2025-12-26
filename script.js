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
const PAYSTACK_PUB_KEY = "pk_live_xxxxxxxxxxxxxxxxxxxxxxxx"; 

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
let currentUser = null;
let currentBalance = 0;

// --- UTILS ---
window.switchTab = (tab) => {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
    
    document.getElementById('tab-' + tab).classList.remove('hidden');
    document.getElementById('tab-' + tab).classList.add('active');
    
    // Nav Active State
    const btns = document.querySelectorAll('.nav-btn');
    if(tab==='sports') btns[0].classList.add('active');
    if(tab==='aviator') btns[1].classList.add('active');
    if(tab==='profile') btns[2].classList.add('active');

    if(tab === 'sports') loadMatches();
};

window.setBet = (val) => document.getElementById('bet-amount').value = val;
window.adjustBet = (val) => {
    let el = document.getElementById('bet-amount');
    el.value = Math.max(50, parseInt(el.value) + val);
};
window.toggleAuth = (mode) => {
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('register-form').classList.add('hidden');
    if(mode === 'register') document.getElementById('register-form').classList.remove('hidden');
    else document.getElementById('login-form').classList.remove('hidden');
};
window.closeBetslip = () => document.getElementById('betslip-modal').style.display = 'none';

// --- AUTH ---
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
            initDashboard(snap.data());
        }
    } else {
        document.getElementById('dashboard-screen').classList.add('hidden');
        document.getElementById('auth-screen').classList.remove('hidden');
        document.getElementById('auth-screen').classList.add('active');
    }
});

// Auth Buttons
document.getElementById('google-login-btn').addEventListener('click', () => signInWithPopup(auth, new GoogleAuthProvider()));
document.getElementById('email-login-btn').addEventListener('click', () => {
    const e = document.getElementById('login-email').value, p = document.getElementById('login-pass').value;
    if(e && p) signInWithEmailAndPassword(auth, e, p).catch(err => alert(err.message));
});
document.getElementById('email-register-btn').addEventListener('click', () => {
    const n = document.getElementById('reg-nick').value, e = document.getElementById('reg-email').value, p = document.getElementById('reg-pass').value;
    if(n && e && p) {
        createUserWithEmailAndPassword(auth, e, p).then(async (c) => {
            await setDoc(doc(db, "users", c.user.uid), { nickname: n, email: e, balance: 0, uid: c.user.uid, history: [] });
            location.reload();
        }).catch(err => alert(err.message));
    }
});
document.getElementById('save-nickname-btn').addEventListener('click', async () => {
    const nick = document.getElementById('google-nickname-input').value;
    if(nick) {
        await updateDoc(doc(db, "users", currentUser.uid), { nickname: nick });
        location.reload();
    }
});
document.getElementById('logout-btn').addEventListener('click', () => signOut(auth).then(()=>location.reload()));

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
            renderHistory(docSnap.data().history);
        }
    });

    startAviator();
    startBotSimulation();
    loadMatches(); // Load sports immediately
}

function renderHistory(hist) {
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

// --- AVIATOR (SILENT, 10s ROUNDS) ---
let avState = "WAITING";
let avMult = 1.00;
let avBet = 0;
let avCash = false;

function startAviator() {
    setInterval(() => {
        const now = Date.now();
        const loop = now % 10000; // 10 Seconds Loop
        
        if (loop < 3000) { // WAITING (3s)
            if(avState !== "WAITING") {
                avState = "WAITING";
                document.getElementById('status-text').innerText = "NEXT ROUND...";
                document.getElementById('multiplier-display').innerText = "1.00x";
                document.getElementById('multiplier-display').style.color = "white";
                document.getElementById('rocket-icon').style.transform = "rotate(0deg)";
                
                const btn = document.getElementById('bet-btn');
                if(avBet > 0 && !avCash) {
                    avBet = 0; // Lost
                    btn.innerText = "LOST";
                    btn.style.background = "#333";
                    setTimeout(() => { btn.innerText = "BET"; btn.style.background = "var(--neon-green)"; }, 1500);
                } else {
                    btn.innerText = "BET";
                    btn.style.background = "var(--neon-green)";
                }
            }
        } else { // FLYING (7s)
            avState = "FLYING";
            const flyTime = loop - 3000;
            // Faster curve for 10s rounds
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
            } else {
                document.getElementById('multiplier-display').innerText = avMult + "x";
                if(avBet > 0 && !avCash) {
                    const btn = document.getElementById('bet-btn');
                    btn.innerText = "CASH OUT " + Math.floor(avBet * avMult);
                    btn.style.background = "var(--neon-red)";
                    // Auto Cashout
                    if(document.getElementById('auto-cashout-toggle').checked && avMult >= document.getElementById('auto-cashout-val').value) {
                        doCashout();
                    }
                }
            }
        }
    }, 100);
}

document.getElementById('bet-btn').addEventListener('click', () => {
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
});

function doCashout() {
    avCash = true;
    const win = Math.floor(avBet * avMult);
    updateDoc(doc(db, "users", currentUser.uid), { balance: currentBalance + win, history: arrayUnion({type:"Win Aviator", amount:win, date:new Date().toISOString()}) });
    document.getElementById('bet-btn').innerText = "WON " + win;
    document.getElementById('bet-btn').style.background = "var(--neon-green)";
}

// --- BOT SIMULATION (GENERIC NAMES) ---
function startBotSimulation() {
    const names = ["User882", "Winner99", "Player_X", "Speedy", "Lucky77", "ProGamer", "BetKing01"];
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

// --- SPORTS (FORCE VIRTUAL FALLBACK) ---
async function loadMatches() {
    const list = document.getElementById('fixtures-list');
    list.innerHTML = '<div class="loader">Loading Matches...</div>';
    
    // We try the API, but if it fails OR returns 0 matches, we FORCE Virtuals
    const today = new Date().toISOString().split('T')[0];
    try {
        const res = await fetch(`https://api-football-v1.p.rapidapi.com/v3/fixtures?date=${today}`, {
            headers: { 'X-RapidAPI-Key': RAPID_API_KEY, 'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com' }
        });
        const data = await res.json();
        
        if(data.response && data.response.length > 0) {
            renderMatches(data.response);
        } else {
            renderVirtuals(); // Force virtuals if empty
        }
    } catch(e) {
        renderVirtuals(); // Force virtuals on error
    }
}

function renderVirtuals() {
    const list = document.getElementById('fixtures-list');
    list.innerHTML = `<div style="text-align:center; padding:10px; color:#888;">Simulated Live League (24/7)</div>`;
    
    const teams = [
        ["Man City", "Liverpool"], ["Arsenal", "Chelsea"], ["Real Madrid", "Barca"],
        ["Bayern", "Dortmund"], ["Juventus", "Milan"], ["PSG", "Lyon"]
    ];
    
    teams.forEach(pair => {
        const odds = (Math.random()*2+1.2).toFixed(2);
        const div = document.createElement('div');
        div.className = "match-card";
        div.innerHTML = `
            <div><b>${pair[0]}</b> vs <b>${pair[1]}</b><br><span class="live-badge">V-LIVE</span></div>
            <button class="neon-btn" style="width:auto; padding:5px 15px;" onclick="openBetslip('${pair[0]} v ${pair[1]}', ${odds})">${odds}</button>
        `;
        list.appendChild(div);
    });
}

function renderMatches(matches) {
    const list = document.getElementById('fixtures-list');
    list.innerHTML = "";
    matches.slice(0,20).forEach(m => {
        const home = m.teams.home.name;
        const away = m.teams.away.name;
        const odds = (Math.random()*2+1.2).toFixed(2);
        const div = document.createElement('div');
        div.className = "match-card";
        div.innerHTML = `
            <div><b>${home}</b> vs <b>${away}</b><br><span class="live-badge" style="background:#222; color:#ccc;">UPCOMING</span></div>
            <button class="neon-btn" style="width:auto; padding:5px 15px;" onclick="openBetslip('${home} v ${away}', ${odds})">${odds}</button>
        `;
        list.appendChild(div);
    });
}

// Betslip
window.openBetslip = (m, o) => {
    document.getElementById('betslip-match').innerText = m;
    document.getElementById('betslip-odds').innerText = o;
    document.getElementById('betslip-modal').style.display = 'flex';
};
document.getElementById('place-sports-bet').addEventListener('click', () => {
    const amt = 100; 
    if(amt > currentBalance) return alert("Low Funds");
    updateDoc(doc(db, "users", currentUser.uid), { balance: currentBalance - amt, history: arrayUnion({type:"Bet Sports", amount:-amt, date:new Date().toISOString()}) });
    document.getElementById('betslip-modal').style.display = 'none';
    alert("Bet Placed!");
});

// PAYMENTS
document.getElementById('open-deposit-modal').addEventListener('click', () => document.getElementById('deposit-modal').style.display='flex');
document.getElementById('cancel-deposit').addEventListener('click', () => document.getElementById('deposit-modal').style.display='none');
document.getElementById('confirm-deposit').addEventListener('click', () => {
    const amt = parseInt(document.getElementById('deposit-input').value);
    if(amt < 100) return alert("Min 100");
    document.getElementById('deposit-modal').style.display='none';
    
    // Safety check
    if(PAYSTACK_PUB_KEY.startsWith("cb7d")) return alert("Wrong Key! You used RapidAPI key in Paystack slot.");

    let h = PaystackPop.setup({
        key: PAYSTACK_PUB_KEY, email: currentUser.email, amount: amt*100, currency: "NGN",
        callback: function(r) {
            updateDoc(doc(db, "users", currentUser.uid), { balance: currentBalance + amt, history: arrayUnion({type:"Deposit", amount:amt, date:new Date().toISOString()}) });
        }
    });
    h.openIframe();
});

document.getElementById('open-withdraw-modal').addEventListener('click', () => document.getElementById('withdraw-modal').style.display='flex');
document.getElementById('cancel-withdraw').addEventListener('click', () => document.getElementById('withdraw-modal').style.display='none');
document.getElementById('confirm-withdraw').addEventListener('click', async () => {
    const amt = parseInt(document.getElementById('withdraw-amount').value);
    if(amt > currentBalance) return alert("Low Funds");
    await updateDoc(doc(db, "users", currentUser.uid), { balance: currentBalance - amt, history: arrayUnion({type:"Withdraw", amount:-amt, date:new Date().toISOString()}) });
    document.getElementById('withdraw-modal').style.display='none';
    const bank = document.getElementById('withdraw-bank').value;
    window.open(`https://wa.me/2347056353236?text=Withdraw ${amt} to ${bank}`, '_blank');
});
```[How to Create Aviator Game using HTML, CSS & JavaScript | Full Tutorial 🚀](https://www.youtube.com/watch?v=yvGvavtwq3w)
This video is relevant because it provides a tutorial on creating a similar Aviator game using HTML, CSS, and JavaScript, which can help in understanding and customizing the game logic and design.
http://googleusercontent.com/youtube_content/24 *YouTube video views will be stored in your YouTube History, and your data will be stored and used by YouTube according to its [Terms of Service](https://www.youtube.com/static?template=terms)*


