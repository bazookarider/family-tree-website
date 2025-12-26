 // USING STABLE FIREBASE 10.7.1 - THIS WILL FIX THE LOGIN ISSUE
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
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

// --- KEYS (DOUBLE CHECK THESE) ---
const RAPID_API_KEY = "cb7d574582mshf8c7d0e5d409675p1f854fjsn"; 
const PAYSTACK_PUB_KEY = "pk_live_114f32ca016af833aecc705ff519c58c499ecf59"; // <--- PASTE PAYSTACK KEY HERE (NOT RAPIDAPI)

// Init
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
let currentUser = null;
let currentBalance = 0;

// --- GLOBAL HELPERS ---
window.switchTab = (tab) => {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
    document.getElementById('tab-' + tab).classList.add('active');
    document.getElementById('btn-' + tab).classList.add('active');
    if (tab === 'sports') loadMatches();
};

window.setBet = (val) => { document.getElementById('bet-amount').value = val; };
window.adjustBet = (val) => { 
    let el = document.getElementById('bet-amount'); 
    el.value = Math.max(50, parseInt(el.value) + val); 
};
window.closeBetslip = () => document.getElementById('betslip-modal').style.display = 'none';

// --- AUTH (FIXED) ---
const loginBtn = document.getElementById('login-btn');
if(loginBtn) {
    loginBtn.addEventListener('click', () => {
        // Added Error Alert so you know if it fails
        signInWithPopup(auth, new GoogleAuthProvider()).catch(err => alert("Login Failed: " + err.message));
    });
}
document.getElementById('logout-btn').addEventListener('click', () => {
    signOut(auth).then(() => location.reload());
});

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('auth-screen').classList.remove('active');
        document.getElementById('dashboard-screen').classList.add('active');
        
        document.getElementById('user-name').innerText = user.displayName.split(' ')[0];
        document.getElementById('user-id').innerText = "ID: " + user.uid.slice(0, 5).toUpperCase();
        document.getElementById('profile-name').innerText = user.displayName;
        document.getElementById('profile-email').innerText = user.email;
        
        loadUserData();
        loadMatches(); 
        startAviatorEngine();
    }
});

// --- USER DATA ---
function loadUserData() {
    onSnapshot(doc(db, "users", currentUser.uid), (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            currentBalance = data.balance || 0;
            document.getElementById('wallet-balance').innerText = "₦" + currentBalance.toLocaleString();
            
            const historyList = document.getElementById('tx-history');
            historyList.innerHTML = "";
            if (data.history) {
                data.history.slice(-10).reverse().forEach(tx => {
                    const color = tx.amount > 0 ? 'var(--neon-green)' : 'var(--neon-red)';
                    const item = document.createElement('div');
                    item.className = 'match-card';
                    item.style.padding = "10px";
                    item.innerHTML = `
                        <div><small>${new Date(tx.date).toLocaleDateString()}</small><br><b>${tx.type}</b></div>
                        <div style="color:${color}; font-weight:bold;">${tx.amount > 0 ? '+' : ''}₦${Math.abs(tx.amount)}</div>
                    `;
                    historyList.appendChild(item);
                });
            }
        } else {
            setDoc(doc(db, "users", currentUser.uid), { balance: 0, uid: currentUser.uid, history: [] });
        }
    });
}

// --- PAYMENTS (PAYSTACK) ---
document.getElementById('open-deposit-modal').addEventListener('click', () => document.getElementById('deposit-modal').style.display = 'flex');
document.getElementById('cancel-deposit').addEventListener('click', () => document.getElementById('deposit-modal').style.display = 'none');
document.getElementById('confirm-deposit').addEventListener('click', () => {
    const amount = parseInt(document.getElementById('deposit-input').value);
    if (!amount || amount < 100) return alert("Min deposit ₦100");
    document.getElementById('deposit-modal').style.display = 'none';
    
    // Safety check for common key errors
    if(PAYSTACK_PUB_KEY.startsWith("cb7d")) {
        alert("ERROR: You pasted the RapidAPI key into Paystack! Please find your 'pk_live_...' key.");
        return;
    }

    let handler = PaystackPop.setup({
        key: PAYSTACK_PUB_KEY, email: currentUser.email, amount: amount * 100, currency: "NGN",
        callback: function(res) {
            const newBal = currentBalance + amount;
            updateDoc(doc(db, "users", currentUser.uid), { 
                balance: newBal, history: arrayUnion({type: "Deposit", amount: amount, date: new Date().toISOString()})
            });
        }
    });
    handler.openIframe();
});

// Withdraw
document.getElementById('open-withdraw-modal').addEventListener('click', () => document.getElementById('withdraw-modal').style.display = 'flex');
document.getElementById('cancel-withdraw').addEventListener('click', () => document.getElementById('withdraw-modal').style.display = 'none');
document.getElementById('confirm-withdraw').addEventListener('click', async () => {
    const amount = parseInt(document.getElementById('withdraw-amount').value);
    const details = document.getElementById('withdraw-bank').value;
    if (amount > currentBalance) return alert("Insufficient funds");
    
    await addDoc(collection(db, "withdrawals"), {
        uid: currentUser.uid, amount: amount, details: details, status: "Pending", date: new Date().toISOString()
    });
    updateDoc(doc(db, "users", currentUser.uid), {
        balance: currentBalance - amount,
        history: arrayUnion({type: "Withdraw Request", amount: -amount, date: new Date().toISOString()})
    });
    document.getElementById('withdraw-modal').style.display = 'none';
    alert("Withdrawal request sent!");
});

// --- SPORTS FEED ---
async function loadMatches() {
    const list = document.getElementById('fixtures-list');
    list.innerHTML = '<div class="loader"><i class="ri-loader-4-line spin"></i> Loading Games...</div>';
    
    const today = new Date().toISOString().split('T')[0];
    try {
        const res = await fetch(`https://api-football-v1.p.rapidapi.com/v3/fixtures?date=${today}`, {
            headers: { 'X-RapidAPI-Key': RAPID_API_KEY, 'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com' }
        });
        const data = await res.json();
        
        if (data.response && data.response.length > 0) {
            renderMatches(data.response);
        } else {
            generateVirtualMatches(); 
        }
    } catch (e) {
        generateVirtualMatches(); 
    }
}

function renderMatches(matches) {
    const list = document.getElementById('fixtures-list');
    list.innerHTML = "";
    matches.sort((a, b) => {
        const isLiveA = ['1H','2H','HT'].includes(a.fixture.status.short);
        const isLiveB = ['1H','2H','HT'].includes(b.fixture.status.short);
        if (isLiveA && !isLiveB) return -1;
        if (!isLiveA && isLiveB) return 1;
        return 0;
    });

    matches.slice(0, 30).forEach(m => {
        const home = m.teams.home.name;
        const away = m.teams.away.name;
        const status = m.fixture.status.short;
        let badge = "";
        let right = "";

        if (status === 'NS') {
            const time = new Date(m.fixture.date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
            badge = `<span class="time-badge">UPCOMING</span>`;
            right = `<span style="color:#8892b0; font-weight:bold;">${time}</span>`;
        } else if (['1H','2H','HT'].includes(status)) {
            badge = `<span class="live-badge">LIVE ${m.fixture.status.elapsed}'</span>`;
            right = `<span style="color:var(--neon-green); font-weight:bold;">${m.goals.home} - ${m.goals.away}</span>`;
        } else {
            badge = `<span style="background:#233554; color:#666; font-size:10px; padding:2px;">FT</span>`;
            right = `<span style="color:#666;">${m.goals.home} - ${m.goals.away}</span>`;
        }

        const odds = (Math.random() * 1.5 + 1.2).toFixed(2); 

        const card = document.createElement('div');
        card.className = 'match-card';
        card.innerHTML = `
            <div><div style="font-weight:bold;">${home} <br> ${away}</div>${badge}</div>
            <div style="text-align:right;">${right}<br>
                <button onclick="openBetslip('${home} vs ${away}', ${odds})" style="margin-top:5px; background:#233554; color:white; border:none; padding:5px 12px; border-radius:5px;">${odds}x</button>
            </div>
        `;
        list.appendChild(card);
    });
}

// Betslip
window.openBetslip = (match, odds) => {
    document.getElementById('betslip-match').innerText = match;
    document.getElementById('betslip-odds').innerText = odds + "x";
    document.getElementById('betslip-modal').style.display = 'flex';
};

document.getElementById('place-sports-bet').addEventListener('click', () => {
    const amount = 100;
    if(amount > currentBalance) return alert("Low Balance");
    updateDoc(doc(db, "users", currentUser.uid), {
        balance: currentBalance - amount,
        history: arrayUnion({type: "Bet (Sports)", amount: -amount, date: new Date().toISOString()})
    });
    document.getElementById('betslip-modal').style.display = 'none';
    alert("Bet Placed!");
});

function generateVirtualMatches() {
    const list = document.getElementById('fixtures-list');
    list.innerHTML = `<div style="padding:10px; background:#233554; text-align:center;">Virtual League</div>`;
    const teams = ["Man City", "Liverpool", "Arsenal", "Madrid", "Barca", "Chelsea"];
    for(let i=0; i<6; i+=2) {
        const card = document.createElement('div');
        card.className = 'match-card';
        card.innerHTML = `
            <div><b>${teams[i]} vs ${teams[i+1]}</b><br><span class="live-badge" style="background:var(--purple);">VIRTUAL</span></div>
            <button style="background:#233554; color:white; padding:5px;">1.85x</button>
        `;
        list.appendChild(card);
    }
}

// --- AVIATOR ENGINE ---
let gameActive = false;
let userBet = 0;
let hasCashedOut = false;
let currentMultiplier = 1.00;

function startAviatorEngine() {
    setInterval(() => {
        const now = Date.now();
        const roundTime = now % 10000;
        
        if (roundTime < 3000) { // Waiting
            gameActive = false;
            document.getElementById('status-text').innerText = "NEXT ROUND: " + ((3000-roundTime)/1000).toFixed(1) + "s";
            document.getElementById('multiplier-display').innerText = "1.00x";
            document.getElementById('multiplier-display').style.color = "white";
            
            const btn = document.getElementById('bet-btn');
            if(!userBet) {
                btn.innerText = "BET NEXT ROUND";
                btn.style.background = "var(--neon-green)";
            } else {
                btn.innerText = "BET PLACED";
                btn.style.background = "#ff9900";
            }
            if(document.getElementById('round-history').children.length === 0) addHistoryPill((Math.random()*3+1).toFixed(2));
            
        } else { // Flying
            gameActive = true;
            document.getElementById('status-text').innerText = "FLYING...";
            const flyTime = roundTime - 3000;
            currentMultiplier = (1 + (flyTime/1000)*0.2).toFixed(2);
            
            const crashSeed = Math.floor(now/10000);
            const crashPoint = ((crashSeed % 5) + 1.2).toFixed(2);
            
            if(currentMultiplier >= crashPoint) {
                document.getElementById('multiplier-display').innerText = "CRASH @ " + crashPoint + "x";
                document.getElementById('multiplier-display').style.color = "var(--neon-red)";
                if(userBet > 0 && !hasCashedOut) {
                    userBet = 0; 
                    document.getElementById('bet-btn').innerText = "LOST";
                    document.getElementById('bet-btn').style.background = "#333";
                }
            } else {
                document.getElementById('multiplier-display').innerText = currentMultiplier + "x";
                if(userBet > 0 && !hasCashedOut) {
                    const btn = document.getElementById('bet-btn');
                    btn.innerText = "CASHOUT ₦" + Math.floor(userBet * currentMultiplier);
                    btn.style.background = "var(--neon-red)";
                    const autoVal = parseFloat(document.getElementById('auto-cashout-val').value);
                    if(document.getElementById('auto-cashout-toggle').checked && currentMultiplier >= autoVal) doCashout();
                }
            }
        }
    }, 100);
}

document.getElementById('bet-btn').addEventListener('click', () => {
    if(!gameActive) {
        const val = parseInt(document.getElementById('bet-amount').value);
        if(val > currentBalance) return alert("Low Balance");
        userBet = val;
        hasCashedOut = false;
        updateDoc(doc(db, "users", currentUser.uid), {
            balance: currentBalance - val,
            history: arrayUnion({type: "Bet (Aviator)", amount: -val, date: new Date().toISOString()})
        });
    } else if(gameActive && userBet > 0 && !hasCashedOut) {
        doCashout();
    }
});

function doCashout() {
    hasCashedOut = true;
    const win = Math.floor(userBet * currentMultiplier);
    updateDoc(doc(db, "users", currentUser.uid), {
        balance: currentBalance + win,
        history: arrayUnion({type: "Win (Aviator)", amount: win, date: new Date().toISOString()})
    });
    userBet = 0;
    document.getElementById('bet-btn').innerText = "WON ₦" + win;
    document.getElementById('bet-btn').style.background = "var(--neon-green)";
}

function addHistoryPill(val) {
    const box = document.getElementById('round-history');
    const pill = document.createElement('span');
    pill.innerText = val + "x";
    pill.className = val > 2.0 ? "history-pill purple" : "history-pill blue";
    if(val > 10) pill.className = "history-pill red";
    box.prepend(pill);
    if(box.children.length > 10) box.removeChild(box.lastChild);
}
