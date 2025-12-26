// IMPORT FIREBASE (v12.7.0)
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot, arrayUnion } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

// --- CONFIGURATION ---
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

// --- KEYS ---
const RAPID_API_KEY = "cb7d574582mshf8c7d0e5d409675p1f854fjsn"; 
const PAYSTACK_PUB_KEY = "pk_live_114f32ca016af833aecc705ff519c58c499ecf59"; // PASTE YOUR KEY HERE

// Init
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
let currentUser = null;
let currentBalance = 0;

// --- GLOBAL FUNCTIONS (Fix for Buttons) ---
// We attach these to 'window' so HTML buttons can see them
window.switchTab = (tabName) => {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
    
    // Show selected tab
    document.getElementById('tab-' + tabName).classList.add('active');
    document.getElementById('btn-' + tabName).classList.add('active');

    if (tabName === 'sports') loadMatches();
};

window.setBet = (val) => { 
    document.getElementById('bet-amount').value = val; 
};

// --- AUTH & LOAD ---
const loginBtn = document.getElementById('login-btn');
if(loginBtn) {
    loginBtn.addEventListener('click', () => {
        signInWithPopup(auth, new GoogleAuthProvider()).catch(err => alert(err.message));
    });
}

document.getElementById('logout-btn').addEventListener('click', () => {
    signOut(auth).then(() => location.reload());
});

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('auth-screen').classList.remove('active');
        document.getElementById('auth-screen').classList.add('hidden'); // Ensure it hides
        document.getElementById('dashboard-screen').classList.add('active');
        document.getElementById('dashboard-screen').classList.remove('hidden');

        // Update Header Info
        document.getElementById('user-name').innerText = user.displayName.split(' ')[0];
        document.getElementById('user-id').innerText = "ID: " + user.uid.slice(0, 6).toUpperCase();
        document.getElementById('profile-name').innerText = user.displayName;
        document.getElementById('profile-email').innerText = user.email;

        loadUserData();
        loadMatches(); // Load sports by default
    }
});

// --- DATA SYNC ---
function loadUserData() {
    const userRef = doc(db, "users", currentUser.uid);
    onSnapshot(userRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            currentBalance = data.balance || 0;
            document.getElementById('wallet-balance').innerText = "₦" + currentBalance.toLocaleString();
            
            // Transaction History
            const historyList = document.getElementById('tx-history');
            historyList.innerHTML = ""; 
            if (data.history && data.history.length > 0) {
                data.history.slice(-5).reverse().forEach(tx => {
                    const item = document.createElement('div');
                    item.style.padding = "10px";
                    item.style.borderBottom = "1px solid #233554";
                    item.innerHTML = `
                        <div style="display:flex; justify-content:space-between;">
                            <small style="color:#8892b0">${new Date(tx.date).toLocaleDateString()}</small>
                            <b class="${tx.amount > 0 ? 'text-green' : 'text-red'}">₦${tx.amount}</b>
                        </div>
                        <div style="font-size:12px;">${tx.type}</div>
                    `;
                    historyList.appendChild(item);
                });
            } else {
                historyList.innerHTML = '<p style="text-align:center; opacity:0.5;">No transactions yet.</p>';
            }
        } else {
            setDoc(userRef, { balance: 0, uid: currentUser.uid, history: [] });
        }
    });
}

// --- DEPOSITS ---
const depositModal = document.getElementById('deposit-modal');
document.getElementById('open-deposit-modal').addEventListener('click', () => {
    depositModal.style.display = 'flex';
});
document.getElementById('cancel-deposit').addEventListener('click', () => {
    depositModal.style.display = 'none';
});

document.getElementById('confirm-deposit').addEventListener('click', () => {
    const amount = document.getElementById('deposit-input').value;
    if (!amount || amount < 100) { alert("Minimum deposit is ₦100"); return; }
    
    depositModal.style.display = 'none';

    let handler = PaystackPop.setup({
        key: PAYSTACK_PUB_KEY,
        email: currentUser.email,
        amount: amount * 100,
        currency: "NGN",
        callback: function(response) {
            const newBal = currentBalance + parseInt(amount);
            const tx = { type: "Deposit", amount: parseInt(amount), date: new Date().toISOString() };
            updateDoc(doc(db, "users", currentUser.uid), { 
                balance: newBal,
                history: arrayUnion(tx)
            });
            alert("Deposit Successful!");
        },
        onClose: function() { alert("Transaction cancelled."); }
    });
    handler.openIframe();
});

// --- SPORTS FEED ---
async function loadMatches() {
    const list = document.getElementById('fixtures-list');
    list.innerHTML = '<div class="loader"><i class="ri-loader-4-line spin"></i> Loading Schedule...</div>';
    
    const today = new Date().toISOString().split('T')[0];
    const options = {
        method: 'GET',
        headers: {
            'X-RapidAPI-Key': RAPID_API_KEY,
            'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
        }
    };

    try {
        const response = await fetch(`https://api-football-v1.p.rapidapi.com/v3/fixtures?date=${today}`, options);
        const data = await response.json();
        
        list.innerHTML = '';
        if (!data.response || data.response.length === 0) {
            list.innerHTML = '<p style="text-align:center; padding:20px;">No live games right now. Check back later.</p>';
            return;
        }

        data.response.slice(0, 15).forEach(match => { 
            const home = match.teams.home.name;
            const away = match.teams.away.name;
            const score = match.goals.home !== null ? `${match.goals.home} - ${match.goals.away}` : "vs";
            const time = new Date(match.fixture.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            
            const item = document.createElement('div');
            item.className = 'stat-card'; // Reuse card style
            item.style.display = 'flex';
            item.style.justifyContent = 'space-between';
            item.style.alignItems = 'center';
            item.style.textAlign = 'left';
            item.innerHTML = `
                <div>
                    <div style="font-weight:bold;">${home} <br> ${away}</div>
                    <small style="color:#8892b0">${time}</small>
                </div>
                <div style="font-size:18px; color:var(--neon-green); font-weight:bold;">${score}</div>
            `;
            list.appendChild(item);
        });
    } catch (error) {
        list.innerHTML = '<p style="text-align:center;">No live games right now. Check back later.</p>';
    }
}

// --- AVIATOR LOGIC ---
let multiplier = 1.00;
let gameRunning = false;
let gameInterval;

document.getElementById('bet-btn').addEventListener('click', () => {
    if (gameRunning) {
        cashOut();
    } else {
        const betAmount = parseInt(document.getElementById('bet-amount').value);
        if (betAmount > currentBalance) { alert("Insufficient Balance!"); return; }
        
        // Deduct Bet
        const tx = { type: "Bet (Aviator)", amount: -betAmount, date: new Date().toISOString() };
        updateDoc(doc(db, "users", currentUser.uid), { 
            balance: currentBalance - betAmount,
            history: arrayUnion(tx)
        });

        startGame(betAmount);
    }
});

function startGame(betAmount) {
    gameRunning = true;
    const btn = document.getElementById('bet-btn');
    btn.innerText = "CASH OUT";
    btn.style.background = "var(--neon-red)";
    
    multiplier = 1.00;
    const crashPoint = (Math.random() * 5) + 1.1; 
    const autoCashVal = parseFloat(document.getElementById('auto-cashout-val').value);
    const useAuto = document.getElementById('auto-cashout-toggle').checked;

    gameInterval = setInterval(() => {
        multiplier += 0.01;
        document.getElementById('multiplier-display').innerText = multiplier.toFixed(2) + "x";

        if (useAuto && multiplier >= autoCashVal) cashOut();

        if (multiplier >= crashPoint) {
            clearInterval(gameInterval);
            gameRunning = false;
            document.getElementById('multiplier-display').innerText = "CRASHED @ " + multiplier.toFixed(2) + "x";
            document.getElementById('multiplier-display').style.color = "var(--neon-red)";
            btn.innerText = "PLACE BET";
            btn.style.background = "var(--neon-green)";
        }
    }, 80);
}

function cashOut() {
    if (!gameRunning) return;
    clearInterval(gameInterval);
    gameRunning = false;
    
    const betAmount = parseInt(document.getElementById('bet-amount').value);
    const winAmount = Math.floor(betAmount * multiplier);
    
    const tx = { type: "Win (Aviator)", amount: winAmount, date: new Date().toISOString() };
    updateDoc(doc(db, "users", currentUser.uid), { 
        balance: currentBalance + winAmount,
        history: arrayUnion(tx)
    });

    const btn = document.getElementById('bet-btn');
    btn.innerText = "WON ₦" + winAmount;
    document.getElementById('multiplier-display').style.color = "var(--neon-green)";
    
    setTimeout(() => {
        btn.innerText = "PLACE BET";
        btn.style.background = "var(--neon-green)";
        document.getElementById('multiplier-display').style.color = "white";
    }, 2000);
}
