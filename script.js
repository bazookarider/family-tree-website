 import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot, arrayUnion, addDoc, collection } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

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
const PAYSTACK_PUB_KEY = "pk_live_xxxxxxxxxxxxxxxxxxxxxxxx"; // PASTE YOUR KEY

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

// --- AUTH ---
document.getElementById('login-btn').addEventListener('click', () => {
    signInWithPopup(auth, new GoogleAuthProvider()).catch(err => alert(err.message));
});
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
        startAviatorEngine(); // Start the global game loop
    }
});

// --- DATA & WALLET ---
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
                    item.className = 'match-card'; // Reuse style
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

// --- PAYMENTS (DEPOSIT & WITHDRAW) ---
// Deposit
document.getElementById('open-deposit-modal').addEventListener('click', () => document.getElementById('deposit-modal').style.display = 'flex');
document.getElementById('cancel-deposit').addEventListener('click', () => document.getElementById('deposit-modal').style.display = 'none');
document.getElementById('confirm-deposit').addEventListener('click', () => {
    const amount = parseInt(document.getElementById('deposit-input').value);
    if (!amount || amount < 100) return alert("Min deposit ₦100");
    document.getElementById('deposit-modal').style.display = 'none';
    
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
    
    // Deduct immediately
    updateDoc(doc(db, "users", currentUser.uid), {
        balance: currentBalance - amount,
        history: arrayUnion({type: "Withdraw Request", amount: -amount, date: new Date().toISOString()})
    });
    
    document.getElementById('withdraw-modal').style.display = 'none';
    alert("Withdrawal request sent! Funds will arrive shortly.");
});

// --- SPORTS ENGINE (VIRTUAL FALLBACK) ---
async function loadMatches() {
    const list = document.getElementById('fixtures-list');
    const today = new Date().toISOString().split('T')[0];
    
    // Try API First
    try {
        const res = await fetch(`https://api-football-v1.p.rapidapi.com/v3/fixtures?date=${today}`, {
            headers: { 'X-RapidAPI-Key': RAPID_API_KEY, 'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com' }
        });
        const data = await res.json();
        
        if (data.response && data.response.length > 0) {
            renderMatches(data.response.slice(0, 15));
        } else {
            generateVirtualMatches(); // Fallback if API is empty
        }
    } catch (e) {
        generateVirtualMatches(); // Fallback if API fails
    }
}

function generateVirtualMatches() {
    const list = document.getElementById('fixtures-list');
    list.innerHTML = `<div style="padding:10px; background:#233554; border-radius:8px; margin-bottom:10px; text-align:center;">
        <i class="ri-gamepad-line"></i> Virtual League (24/7)
    </div>`;
    
    const teams = ["Man City", "Liverpool", "Arsenal", "Real Madrid", "Barca", "Chelsea", "Juventus", "Bayern"];
    for(let i=0; i<8; i+=2) {
        const home = teams[i];
        const away = teams[i+1];
        const odds = (Math.random() * 2 + 1.1).toFixed(2);
        
        const card = document.createElement('div');
        card.className = 'match-card';
        card.innerHTML = `
            <div>
                <div style="font-weight:bold;">${home} vs ${away}</div>
                <span class="live-badge">VIRTUAL LIVE</span>
            </div>
            <button onclick="openBetslip('${home} vs ${away}', ${odds})" style="background:#233554; color:var(--neon-green); border:1px solid var(--neon-green); padding:5px 15px; border-radius:5px; font-weight:bold;">
                ${odds}
            </button>
        `;
        list.appendChild(card);
    }
}

function renderMatches(matches) {
    const list = document.getElementById('fixtures-list');
    list.innerHTML = "";
    matches.forEach(m => {
        const card = document.createElement('div');
        card.className = 'match-card';
        card.innerHTML = `
            <div>
                <div style="font-weight:bold;">${m.teams.home.name} <br> ${m.teams.away.name}</div>
                <small>${new Date(m.fixture.date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</small>
            </div>
             <button onclick="openBetslip('${m.teams.home.name} vs ${m.teams.away.name}', 1.90)" style="background:#233554; color:white; border:none; padding:8px 15px; border-radius:5px;">
                1.90
            </button>
        `;
        list.appendChild(card);
    });
}

// Sports Betslip
window.openBetslip = (match, odds) => {
    document.getElementById('betslip-match').innerText = match;
    document.getElementById('betslip-odds').innerText = odds + "x";
    document.getElementById('betslip-modal').style.display = 'flex';
};
window.closeBetslip = () => document.getElementById('betslip-modal').style.display = 'none';

document.getElementById('place-sports-bet').addEventListener('click', () => {
    const amount = parseInt(document.getElementById('sports-bet-amount').value);
    if(amount > currentBalance) return alert("Insufficient Balance");
    
    updateDoc(doc(db, "users", currentUser.uid), {
        balance: currentBalance - amount,
        history: arrayUnion({type: "Bet (Sports)", amount: -amount, date: new Date().toISOString()})
    });
    closeBetslip();
    alert("Bet Placed!");
});

// --- AVIATOR ENGINE (SYNCED GLOBAL TIME) ---
let gameActive = false;
let currentMultiplier = 1.00;
let userBet = 0;
let hasCashedOut = false;

function startAviatorEngine() {
    // This loops runs every 100ms
    setInterval(() => {
        const now = Date.now();
        const roundDuration = 10000; // 10 seconds per round
        const timeInRound = now % roundDuration;
        
        // 1. WAITING PHASE (First 3 seconds)
        if (timeInRound < 3000) {
            gameActive = false;
            document.getElementById('status-text').innerText = "NEXT ROUND IN " + ((3000 - timeInRound)/1000).toFixed(1) + "s";
            document.getElementById('multiplier-display').innerText = "1.00x";
            document.getElementById('multiplier-display').style.color = "white";
            document.getElementById('bet-btn').innerText = "BET NEXT ROUND";
            document.getElementById('bet-btn').classList.remove('cashout');
            
            // Randomly generate history pills if list is empty
            if(document.getElementById('round-history').children.length === 0) {
                addHistoryPill((Math.random() * 10).toFixed(2));
            }
        } 
        // 2. FLYING PHASE (3s to 10s)
        else {
            gameActive = true;
            document.getElementById('status-text').innerText = "FLYING...";
            
            // Calculate Multiplier based on time passed
            // This ensures all users see the same number at the same time
            const flyTime = timeInRound - 3000;
            currentMultiplier = (1 + (flyTime / 1000) * 0.2).toFixed(2); // Linear growth
            
            // Deterministic Crash: Use the minute/10sec block to decide crash point
            const crashSeed = Math.floor(now / roundDuration);
            const crashPoint = ((crashSeed % 5) + 1.2).toFixed(2); // Simple mock crash logic

            if (currentMultiplier >= crashPoint) {
                // CRASHED
                document.getElementById('multiplier-display').innerText = "CRASH @ " + crashPoint + "x";
                document.getElementById('multiplier-display').style.color = "var(--neon-red)";
                if(userBet > 0 && !hasCashedOut) {
                    userBet = 0; // Lost
                    document.getElementById('bet-btn').innerText = "LOST";
                }
            } else {
                // STILL FLYING
                document.getElementById('multiplier-display').innerText = currentMultiplier + "x";
                document.getElementById('multiplier-display').style.color = "white";
                
                // Auto Cashout Check
                const autoVal = parseFloat(document.getElementById('auto-cashout-val').value);
                const useAuto = document.getElementById('auto-cashout-toggle').checked;
                if(userBet > 0 && !hasCashedOut && useAuto && currentMultiplier >= autoVal) {
                    doCashout();
                }
            }
        }
    }, 100);
}

document.getElementById('bet-btn').addEventListener('click', () => {
    if (!gameActive && userBet === 0) {
        // Place Bet for NEXT round
        const amount = parseInt(document.getElementById('bet-amount').value);
        if (amount > currentBalance) return alert("Low Balance");
        
        userBet = amount;
        hasCashedOut = false;
        
        // Deduct
        updateDoc(doc(db, "users", currentUser.uid), {
            balance: currentBalance - amount,
            history: arrayUnion({type: "Bet (Aviator)", amount: -amount, date: new Date().toISOString()})
        });
        
        document.getElementById('bet-btn').innerText = "BET PLACED (WAITING)";
    } 
    else if (gameActive && userBet > 0 && !hasCashedOut) {
        // Cash Out
        doCashout();
    }
});

function doCashout() {
    hasCashedOut = true;
    const winAmount = Math.floor(userBet * currentMultiplier);
    
    updateDoc(doc(db, "users", currentUser.uid), {
        balance: currentBalance + winAmount,
        history: arrayUnion({type: "Win (Aviator)", amount: winAmount, date: new Date().toISOString()})
    });
    
    userBet = 0;
    document.getElementById('bet-btn').innerText = "WON ₦" + winAmount;
    document.getElementById('bet-btn').classList.add('cashout');
    document.getElementById('multiplier-display').style.color = "var(--neon-green)";
}

function addHistoryPill(val) {
    const box = document.getElementById('round-history');
    const pill = document.createElement('span');
    pill.innerText = val + "x";
    pill.className = val > 2.0 ? "history-pill purple" : "history-pill blue";
    if (val > 10) pill.className = "history-pill red"; // Super high
    box.prepend(pill);
    if(box.children.length > 10) box.removeChild(box.lastChild);
}
