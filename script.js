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

// --- KEYS (VERIFY THESE) ---
// I checked your screenshot. This is the correct RapidAPI key.
const RAPID_API_KEY = "cb7d574582mshf8c7d0e5d409675p1f854fjsn"; 

// ⚠️ PASTE YOUR PUBLIC KEY HERE CAREFULLY ⚠️
// It must start with 'pk_live_' or 'pk_test_'. No spaces inside the quotes.
const PAYSTACK_PUB_KEY = "pk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"; 

// Init
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
let currentUser = null;
let currentBalance = 0;

// --- AUTH & PROFILE ---
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
        
        // Populate Profile Info
        document.getElementById('user-name').innerText = user.displayName.split(' ')[0]; // First name only
        document.getElementById('user-id').innerText = "ID: " + user.uid.slice(0, 6).toUpperCase();
        document.getElementById('profile-name').innerText = user.displayName;
        document.getElementById('profile-email').innerText = user.email;

        loadUserData();
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
            
            // Load Transaction History
            const historyList = document.getElementById('tx-history');
            historyList.innerHTML = ""; // Clear old
            if (data.history && data.history.length > 0) {
                // Show last 5 transactions (reversed)
                data.history.slice(-5).reverse().forEach(tx => {
                    const item = document.createElement('div');
                    item.className = 'match-card'; // Reuse card style
                    item.style.padding = "10px";
                    item.innerHTML = `
                        <div><small>${new Date(tx.date).toLocaleDateString()}</small><br><b>${tx.type}</b></div>
                        <div class="text-green">₦${tx.amount}</div>
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

// --- DEPOSITS (CUSTOM MODAL + PAYSTACK) ---
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
    
    // Safety Check for Key
    if (PAYSTACK_PUB_KEY.includes("xxx") || PAYSTACK_PUB_KEY.length < 10) {
        alert("ERROR: Invalid Paystack Key. Please update script.js with your pk_live_ key.");
        return;
    }

    depositModal.style.display = 'none';

    let handler = PaystackPop.setup({
        key: PAYSTACK_PUB_KEY,
        email: currentUser.email,
        amount: amount * 100,
        currency: "NGN",
        callback: function(response) {
            // Success
            const newBal = currentBalance + parseInt(amount);
            const tx = { type: "Deposit", amount: parseInt(amount), date: new Date().toISOString() };
            
            updateDoc(doc(db, "users", currentUser.uid), { 
                balance: newBal,
                history: arrayUnion(tx)
            });
            alert("Deposit Successful!");
        },
        onClose: function() {
            alert("Transaction cancelled.");
        }
    });
    handler.openIframe();
});

// --- SPORTS FEED (TODAY'S GAMES) ---
window.switchTab = (tab) => {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
    document.getElementById('tab-' + tab).classList.add('active');
    
    if (tab === 'sports') loadMatches();
};

async function loadMatches() {
    const list = document.getElementById('fixtures-list');
    list.innerHTML = '<div class="loader"><i class="ri-loader-4-line spin"></i> Loading Schedule...</div>';
    
    // Get Today's Date in YYYY-MM-DD
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('date-display').innerText = today;

    const options = {
        method: 'GET',
        headers: {
            'X-RapidAPI-Key': RAPID_API_KEY,
            'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
        }
    };

    try {
        // Fetch TODAY's fixtures (not just live)
        const response = await fetch(`https://api-football-v1.p.rapidapi.com/v3/fixtures?date=${today}`, options);
        const data = await response.json();
        
        list.innerHTML = '';
        
        if (!data.response || data.response.length === 0) {
            list.innerHTML = '<p style="text-align:center;">No games scheduled for today.</p>';
            return;
        }

        // Show top 20 matches (Priority: Live > Not Started > Finished)
        const matches = data.response.slice(0, 20); 

        matches.forEach(match => {
            const home = match.teams.home.name;
            const away = match.teams.away.name;
            const status = match.fixture.status.short; // "1H", "FT", "NS"
            const score = match.goals.home !== null ? `${match.goals.home} - ${match.goals.away}` : "vs";
            
            let badgeClass = "time-badge";
            let badgeText = new Date(match.fixture.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

            if (['1H','2H','HT','ET'].includes(status)) {
                badgeClass = "live-badge";
                badgeText = "LIVE " + match.fixture.status.elapsed + "'";
            } else if (status === 'FT') {
                badgeText = "Finished";
            }

            const card = document.createElement('div');
            card.className = 'match-card';
            card.innerHTML = `
                <div>
                    <div style="font-weight:bold; margin-bottom:4px;">${home} <br> ${away}</div>
                    <span class="${badgeClass}">${badgeText}</span>
                </div>
                <div style="font-size:18px; font-weight:bold; color:var(--neon-green);">${score}</div>
            `;
            list.appendChild(card);
        });
    } catch (error) {
        console.error(error);
        list.innerHTML = '<p style="color:red; text-align:center;">API Error. Limit Reached?</p>';
    }
}

// --- AVIATOR (AUTO CASHOUT + CHIPS) ---
window.setBet = (val) => { document.getElementById('bet-amount').value = val; };

let multiplier = 1.00;
let gameRunning = false;
let gameInterval;

document.getElementById('bet-btn').addEventListener('click', () => {
    if (gameRunning) {
        // MANUAL CASH OUT
        cashOut();
    } else {
        // PLACE BET
        const betAmount = parseInt(document.getElementById('bet-amount').value);
        if (betAmount > currentBalance) { alert("Low Balance!"); return; }
        
        // Deduct
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
    const crashPoint = (Math.random() * 5) + 1.1; // Min 1.1x
    const autoCashVal = parseFloat(document.getElementById('auto-cashout-val').value);
    const useAuto = document.getElementById('auto-cashout-toggle').checked;

    gameInterval = setInterval(() => {
        multiplier += 0.01;
        document.getElementById('multiplier-display').innerText = multiplier.toFixed(2) + "x";

        // Auto Cash Out Check
        if (useAuto && multiplier >= autoCashVal) {
            cashOut(betAmount); // Force cashout
        }

        // Crash Check
        if (multiplier >= crashPoint) {
            clearInterval(gameInterval);
            gameRunning = false;
            document.getElementById('multiplier-display').innerText = "CRASHED @ " + multiplier.toFixed(2) + "x";
            document.getElementById('multiplier-display').style.color = "var(--neon-red)";
            btn.innerText = "PLACE BET";
            btn.style.background = "var(--neon-green)";
        }
    }, 80); // Speed
}

function cashOut(originalBet) {
    if (!gameRunning) return;
    clearInterval(gameInterval);
    gameRunning = false;
    
    // Calculate Win
    // If called by auto, we use the current multiplier
    const betAmount = parseInt(document.getElementById('bet-amount').value);
    const winAmount = Math.floor(betAmount * multiplier);
    
    const tx = { type: "Win (Aviator)", amount: winAmount, date: new Date().toISOString() };
    updateDoc(doc(db, "users", currentUser.uid), { 
        balance: currentBalance + winAmount,
        history: arrayUnion(tx)
    });

    document.getElementById('multiplier-display').style.color = "var(--neon-green)";
    const btn = document.getElementById('bet-btn');
    btn.innerText = "WIN: ₦" + winAmount;
    setTimeout(() => {
        btn.innerText = "PLACE BET";
        btn.style.background = "var(--neon-green)";
        document.getElementById('multiplier-display').style.color = "white";
    }, 2000);
}
