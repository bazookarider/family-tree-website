 // USING STABLE FIREBASE 10.7.1
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
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
const PAYSTACK_PUB_KEY = "pk_live_114f32ca016af833aecc705ff519c58c499ecf59"; // PASTE YOUR KEY

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

// --- AUTH LOGIC (LOGIN / REGISTER / FORGOT) ---
// Toggle Forms
document.getElementById('show-register').addEventListener('click', () => {
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('register-form').classList.remove('hidden');
});
document.getElementById('show-login').addEventListener('click', () => {
    document.getElementById('register-form').classList.add('hidden');
    document.getElementById('login-form').classList.remove('hidden');
});

// Google Login
document.getElementById('google-login-btn').addEventListener('click', () => {
    signInWithPopup(auth, new GoogleAuthProvider()).catch(err => alert("Error: " + err.message));
});

// Email Login
document.getElementById('email-login-btn').addEventListener('click', () => {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-pass').value;
    if(!email || !pass) return alert("Fill all fields");
    signInWithEmailAndPassword(auth, email, pass).catch(err => alert("Login Failed: " + err.message));
});

// Forgot Password
document.getElementById('forgot-btn').addEventListener('click', () => {
    const email = document.getElementById('login-email').value;
    if(!email) return alert("Please enter your email address first.");
    sendPasswordResetEmail(auth, email).then(() => alert("Reset Link Sent to " + email)).catch(err => alert(err.message));
});

// Register with Nickname Check
document.getElementById('email-register-btn').addEventListener('click', async () => {
    const nick = document.getElementById('reg-nickname').value;
    const email = document.getElementById('reg-email').value;
    const pass = document.getElementById('reg-pass').value;
    
    if(!nick || !email || !pass) return alert("Fill all fields");
    
    // Check Nickname Uniqueness
    const q = query(collection(db, "users"), where("nickname", "==", nick));
    const snap = await getDocs(q);
    if(!snap.empty) return alert("Nickname taken! Choose another.");
    
    createUserWithEmailAndPassword(auth, email, pass).then(async (cred) => {
        // Save Nickname
        await setDoc(doc(db, "users", cred.user.uid), { 
            nickname: nick, email: email, balance: 0, uid: cred.user.uid, history: [] 
        });
        location.reload();
    }).catch(err => alert(err.message));
});

// Logout
document.getElementById('logout-btn').addEventListener('click', () => {
    signOut(auth).then(() => location.reload());
});

// --- AUTH STATE CHANGE (Fixes Blank Screen) ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        // Check if user has a profile doc
        const userRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(userRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            // If they have nickname, Go to Dashboard
            if (data.nickname) {
                showDashboard(data);
            } else {
                // If Google Login but no Nickname yet -> Show Modal
                document.getElementById('auth-screen').classList.remove('active');
                document.getElementById('nickname-modal').style.display = 'flex';
            }
        } else {
            // New Google User -> Create Doc -> Show Nickname Modal
            await setDoc(userRef, { email: user.email, balance: 0, uid: user.uid, history: [] });
            document.getElementById('auth-screen').classList.remove('active');
            document.getElementById('nickname-modal').style.display = 'flex';
        }
    } else {
        // Not Logged In -> Show Auth Screen
        document.getElementById('dashboard-screen').classList.remove('active');
        document.getElementById('auth-screen').classList.add('active');
    }
});

// Save Nickname for Google Users
document.getElementById('save-nickname-btn').addEventListener('click', async () => {
    const nick = document.getElementById('google-nickname-input').value;
    if(!nick) return alert("Enter a nickname");
    
    const q = query(collection(db, "users"), where("nickname", "==", nick));
    const snap = await getDocs(q);
    if(!snap.empty) return alert("Nickname taken!");

    await updateDoc(doc(db, "users", currentUser.uid), { nickname: nick });
    document.getElementById('nickname-modal').style.display = 'none';
    const updatedSnap = await getDoc(doc(db, "users", currentUser.uid));
    showDashboard(updatedSnap.data());
});

function showDashboard(userData) {
    document.getElementById('auth-screen').classList.remove('active');
    document.getElementById('auth-screen').classList.add('hidden'); 
    document.getElementById('dashboard-screen').classList.add('active');
    document.getElementById('dashboard-screen').classList.remove('hidden');

    document.getElementById('user-nickname').innerText = userData.nickname || "Player";
    document.getElementById('user-id').innerText = "ID: " + currentUser.uid.slice(0, 5).toUpperCase();
    document.getElementById('profile-name').innerText = userData.nickname;
    document.getElementById('profile-email').innerText = currentUser.email;
    
    loadUserData();
    loadMatches();
    startAviatorEngine();
}

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
        }
    });
}

// --- DEPOSIT ---
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

// --- WITHDRAWAL (WHATSAPP APPROVAL) ---
document.getElementById('open-withdraw-modal').addEventListener('click', () => document.getElementById('withdraw-modal').style.display = 'flex');
document.getElementById('cancel-withdraw').addEventListener('click', () => document.getElementById('withdraw-modal').style.display = 'none');

document.getElementById('confirm-withdraw').addEventListener('click', async () => {
    const amount = parseInt(document.getElementById('withdraw-amount').value);
    const bank = document.getElementById('withdraw-bank').value;
    const acctName = document.getElementById('withdraw-name').value;
    
    if (amount > currentBalance) return alert("Insufficient funds");
    if (!bank || !acctName) return alert("Enter bank details");

    // 1. Deduct Balance Immediately
    await updateDoc(doc(db, "users", currentUser.uid), {
        balance: currentBalance - amount,
        history: arrayUnion({type: "Withdrawal", amount: -amount, date: new Date().toISOString()})
    });

    document.getElementById('withdraw-modal').style.display = 'none';

    // 2. Generate WhatsApp Message
    const msg = `*NEW WITHDRAWAL REQUEST*%0A%0A` +
                `🆔 User ID: ${currentUser.uid.slice(0,5).toUpperCase()}%0A` +
                `👤 Nickname: ${document.getElementById('user-nickname').innerText}%0A` +
                `💰 Amount: ₦${amount}%0A` +
                `🏦 Bank: ${bank}%0A` +
                `📛 Name: ${acctName}%0A%0A` +
                `Please approve and transfer.`;

    // 3. Open WhatsApp
    window.open(`https://wa.me/2347056353236?text=${msg}`, '_blank');
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
        if (data.response && data.response.length > 0) renderMatches(data.response);
        else generateVirtualMatches(); 
    } catch (e) { generateVirtualMatches(); }
}

function renderMatches(matches) {
    const list = document.getElementById('fixtures-list');
    list.innerHTML = "";
    matches.sort((a, b) => (['1H','2H','HT'].includes(a.fixture.status.short) ? -1 : 1));

    matches.slice(0, 30).forEach(m => {
        const home = m.teams.home.name;
        const away = m.teams.away.name;
        const status = m.fixture.status.short;
        let badge = status === 'NS' ? '<span class="time-badge">UPCOMING</span>' : '<span class="live-badge">LIVE</span>';
        let right = status === 'NS' ? new Date(m.fixture.date).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : `${m.goals.home}-${m.goals.away}`;
        
        const card = document.createElement('div');
        card.className = 'match-card';
        card.innerHTML = `<div><b>${home} vs ${away}</b><br>${badge}</div><div style="text-align:right;">${right}<br><button onclick="openBetslip('${home} vs ${away}', 1.50)" style="margin-top:5px;background:#233554;color:white;border:none;padding:5px;">1.50x</button></div>`;
        list.appendChild(card);
    });
}

function generateVirtualMatches() {
    const list = document.getElementById('fixtures-list');
    list.innerHTML = `<div style="padding:10px; background:#233554; text-align:center;">Virtual League</div>`;
    const teams = ["Man City", "Liverpool", "Arsenal", "Madrid", "Barca", "Chelsea"];
    for(let i=0; i<6; i+=2) {
        list.innerHTML += `<div class="match-card"><div><b>${teams[i]} vs ${teams[i+1]}</b><br><span class="live-badge">VIRTUAL</span></div><button style="background:#233554; color:white; padding:5px;">1.85x</button></div>`;
    }
}

// Betslip
window.openBetslip = (m, o) => { document.getElementById('betslip-match').innerText = m; document.getElementById('betslip-odds').innerText = o; document.getElementById('betslip-modal').style.display = 'flex'; };
document.getElementById('place-sports-bet').addEventListener('click', () => {
    if(100 > currentBalance) return alert("Low Balance");
    updateDoc(doc(db, "users", currentUser.uid), { balance: currentBalance - 100, history: arrayUnion({type: "Bet (Sports)", amount: -100, date: new Date().toISOString()}) });
    document.getElementById('betslip-modal').style.display = 'none';
});

// --- AVIATOR ---
let gameActive=false, userBet=0, hasCashedOut=false, currentMultiplier=1.00;
function startAviatorEngine() {
    setInterval(() => {
        const now = Date.now(), roundTime = now % 10000;
        if (roundTime < 3000) {
            gameActive = false;
            document.getElementById('status-text').innerText = "NEXT ROUND: " + ((3000-roundTime)/1000).toFixed(1) + "s";
            document.getElementById('multiplier-display').innerText = "1.00x";
            document.getElementById('multiplier-display').style.color = "white";
            const btn = document.getElementById('bet-btn');
            if(!userBet) { btn.innerText="BET NEXT ROUND"; btn.style.background="var(--neon-green)"; }
            else { btn.innerText="BET PLACED"; btn.style.background="#ff9900"; }
            if(document.getElementById('round-history').children.length === 0) addHistoryPill((Math.random()*3+1).toFixed(2));
        } else {
            gameActive = true;
            document.getElementById('status-text').innerText = "FLYING...";
            currentMultiplier = (1 + (roundTime-3000)/1000 * 0.2).toFixed(2);
            const crashPoint = ((Math.floor(now/10000) % 5) + 1.2).toFixed(2);
            
            if(currentMultiplier >= crashPoint) {
                document.getElementById('multiplier-display').innerText = "CRASH @ " + crashPoint + "x";
                document.getElementById('multiplier-display').style.color = "var(--neon-red)";
                if(userBet>0 && !hasCashedOut) { userBet=0; document.getElementById('bet-btn').innerText="LOST"; document.getElementById('bet-btn').style.background="#333"; }
            } else {
                document.getElementById('multiplier-display').innerText = currentMultiplier + "x";
                if(userBet>0 && !hasCashedOut) {
                    const btn = document.getElementById('bet-btn');
                    btn.innerText = "CASHOUT ₦" + Math.floor(userBet*currentMultiplier);
                    btn.style.background = "var(--neon-red)";
                    if(document.getElementById('auto-cashout-toggle').checked && currentMultiplier >= document.getElementById('auto-cashout-val').value) doCashout();
                }
            }
        }
    }, 100);
}

document.getElementById('bet-btn').addEventListener('click', () => {
    const val = parseInt(document.getElementById('bet-amount').value);
    if(!gameActive) {
        if(val > currentBalance) return alert("Low Balance");
        userBet = val; hasCashedOut = false;
        updateDoc(doc(db, "users", currentUser.uid), { balance: currentBalance - val, history: arrayUnion({type: "Bet (Aviator)", amount: -val, date: new Date().toISOString()}) });
    } else if(gameActive && userBet > 0 && !hasCashedOut) doCashout();
});

function doCashout() {
    hasCashedOut = true;
    const win = Math.floor(userBet * currentMultiplier);
    updateDoc(doc(db, "users", currentUser.uid), { balance: currentBalance + win, history: arrayUnion({type: "Win (Aviator)", amount: win, date: new Date().toISOString()}) });
    userBet = 0; document.getElementById('bet-btn').innerText = "WON ₦" + win; document.getElementById('bet-btn').style.background = "var(--neon-green)";
}

function addHistoryPill(val) {
    const box = document.getElementById('round-history');
    const pill = document.createElement('span'); pill.innerText = val + "x"; pill.className = val > 2.0 ? "history-pill purple" : "history-pill blue";
    if(val > 10) pill.className = "history-pill red";
    box.prepend(pill); if(box.children.length > 10) box.removeChild(box.lastChild);
}
