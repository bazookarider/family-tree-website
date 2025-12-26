 // Import Firebase SDKs (Using the exact version you provided: 12.7.0)
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-analytics.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, addDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

// --- YOUR CONFIGURATION ---
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

// --- API KEYS ---
// I extracted this from your screenshot. Please double check the last few letters if they were cut off.
const RAPID_API_KEY = "cb7d574582mshf8c7d0e5d409675p1f854fjsn"; 
// Paste your Paystack Public Key below
const PAYSTACK_PUB_KEY = "pk_live_114f32ca016af833aecc705ff519c58c499ecf59"; 

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let currentBalance = 0;

// --- AUTHENTICATION ---
const loginBtn = document.getElementById('login-btn');
loginBtn.addEventListener('click', () => {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider).catch(err => alert(err.message));
});

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('auth-screen').classList.remove('active');
        document.getElementById('dashboard-screen').classList.add('active');
        document.getElementById('user-name').innerText = user.displayName;
        loadUserData();
    }
});

// --- DATABASE FUNCTIONS ---
async function loadUserData() {
    const userRef = doc(db, "users", currentUser.uid);
    // Listen for real-time balance updates
    onSnapshot(userRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            currentBalance = data.balance || 0;
            document.getElementById('wallet-balance').innerText = "₦" + currentBalance.toLocaleString();
            document.getElementById('safe-withdraw').innerText = "₦" + (currentBalance * 0.75).toLocaleString(); // 75% Rule
        } else {
            // New user, give 0 balance
            setDoc(userRef, { balance: 0, uid: currentUser.uid });
        }
    });
}

// --- PAYMENTS (DEPOSIT & WITHDRAW) ---
document.getElementById('deposit-btn').addEventListener('click', () => {
    const amount = prompt("Enter amount to deposit (NGN):");
    if (!amount) return;
    
    // Paystack Pop-up
    let handler = PaystackPop.setup({
        key: PAYSTACK_PUB_KEY,
        email: currentUser.email,
        amount: amount * 100, // Paystack is in kobo
        currency: "NGN",
        callback: function(response) {
            // Payment Success: Update Firebase
            const newBal = currentBalance + parseInt(amount);
            updateDoc(doc(db, "users", currentUser.uid), { balance: newBal });
            alert("Deposit Successful! Wallet updated.");
        },
        onClose: function() {
            alert("Transaction cancelled.");
        }
    });
    handler.openIframe();
});

document.getElementById('withdraw-btn').addEventListener('click', async () => {
    // Option B: Manual Request
    const amount = prompt("How much do you want to withdraw?");
    if (amount > currentBalance) {
        alert("Insufficient funds!");
        return;
    }
    
    // Create Request in DB
    await addDoc(collection(db, "transactions"), {
        uid: currentUser.uid,
        type: "withdraw_request",
        amount: parseInt(amount),
        status: "pending",
        timestamp: new Date()
    });
    
    // Deduct immediately (to prevent double withdraw)
    updateDoc(doc(db, "users", currentUser.uid), { 
        balance: currentBalance - parseInt(amount) 
    });
    
    alert("Withdrawal Request Sent! Admin will process it shortly.");
});

// --- SPORTS API (LIVE GAMES) ---
window.switchTab = async (tabName) => {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
    document.getElementById('tab-' + tabName).classList.add('active');
    
    if (tabName === 'sports') {
        loadMatches();
    }
};

async function loadMatches() {
    const list = document.getElementById('fixtures-list');
    list.innerHTML = '<div class="loader"><i class="ri-loader-4-line spin"></i> Loading Live Games...</div>';
    
    // FETCH FROM API-FOOTBALL
    const options = {
        method: 'GET',
        headers: {
            'X-RapidAPI-Key': RAPID_API_KEY,
            'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
        }
    };

    try {
        // Fetching "Live" matches
        const response = await fetch('https://api-football-v1.p.rapidapi.com/v3/fixtures?live=all', options);
        const data = await response.json();
        
        list.innerHTML = ''; // Clear loader
        
        if (!data.response || data.response.length === 0) {
            list.innerHTML = '<p>No live games right now. Check back later.</p>';
            return;
        }

        data.response.slice(0, 10).forEach(match => { // Show top 10
            const home = match.teams.home.name;
            const away = match.teams.away.name;
            const score = `${match.goals.home} - ${match.goals.away}`;
            
            const card = document.createElement('div');
            card.className = 'match-card';
            card.innerHTML = `
                <div>
                    <div class="teams">${home} vs ${away}</div>
                    <small>Live: ${match.fixture.status.elapsed}'</small>
                </div>
                <div class="odds">${score}</div>
            `;
            list.appendChild(card);
        });
    } catch (error) {
        console.error(error);
        list.innerHTML = '<p style="color:red">Error loading matches. API Limit?</p>';
    }
}

// --- AVIATOR GAME LOGIC ---
let multiplier = 1.00;
let gameRunning = false;
let gameInterval;

document.getElementById('bet-btn').addEventListener('click', () => {
    if (gameRunning) {
        // CASH OUT LOGIC
        clearInterval(gameInterval);
        gameRunning = false;
        
        const betAmount = parseInt(document.getElementById('bet-amount').value);
        const winAmount = Math.floor(betAmount * multiplier);
        
        updateDoc(doc(db, "users", currentUser.uid), { 
            balance: currentBalance + winAmount 
        });
        
        document.getElementById('bet-btn').innerText = "PLACE BET";
        document.getElementById('bet-btn').style.background = "var(--neon-green)";
        alert(`Cashed Out at ${multiplier}x! You won ₦${winAmount}`);
        
    } else {
        // START GAME
        const betAmount = parseInt(document.getElementById('bet-amount').value);
        if (betAmount > currentBalance) { alert("Low Balance!"); return; }
        
        // Deduct Bet
        updateDoc(doc(db, "users", currentUser.uid), { 
            balance: currentBalance - betAmount 
        });
        
        gameRunning = true;
        document.getElementById('bet-btn').innerText = "CASH OUT";
        document.getElementById('bet-btn').style.background = "var(--neon-red)";
        
        multiplier = 1.00;
        const crashPoint = (Math.random() * 5) + 1; // Crashes between 1.00x and 6.00x
        
        gameInterval = setInterval(() => {
            multiplier += 0.01;
            document.getElementById('multiplier-display').innerText = multiplier.toFixed(2) + "x";
            
            if (multiplier >= crashPoint) {
                // CRASH!
                clearInterval(gameInterval);
                gameRunning = false;
                document.getElementById('multiplier-display').innerText = "CRASHED @ " + multiplier.toFixed(2) + "x";
                document.getElementById('bet-btn').innerText = "PLACE BET";
                document.getElementById('bet-btn').style.background = "var(--neon-green)";
            }
        }, 100); // Speed
    }
});
