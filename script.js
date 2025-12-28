import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
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

const PAYSTACK_PUB_KEY = "pk_live_xxxxxxxxxxxxxxxxxxxxxxxx"; 

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
let currentUser = null;
let currentBalance = 0;

document.addEventListener('DOMContentLoaded', () => {
    // AUTH
    const googleBtn = document.getElementById('google-login-btn');
    if(googleBtn) googleBtn.onclick = () => signInWithPopup(auth, new GoogleAuthProvider());

    const regBtn = document.getElementById('email-register-btn');
    if(regBtn) regBtn.onclick = () => {
        const n = document.getElementById('reg-nick').value;
        const e = document.getElementById('reg-email').value;
        const p = document.getElementById('reg-pass').value;
        if(!n) return alert("Username required");
        createUserWithEmailAndPassword(auth, e, p).then(async (c) => {
            await setDoc(doc(db, "users", c.user.uid), { nickname: n, email: e, balance: 0, uid: c.user.uid, history: [] });
            window.location.reload();
        }).catch(err => alert(err.message));
    };

    const loginBtn = document.getElementById('email-login-btn');
    if(loginBtn) loginBtn.onclick = () => {
        signInWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-pass').value)
        .catch(err => alert(err.message));
    };

    document.getElementById('forgot-btn').onclick = () => {
        const e = document.getElementById('login-email').value;
        if(!e) return alert("Enter email first");
        sendPasswordResetEmail(auth, e).then(()=>alert("Reset link sent!")).catch(e=>alert(e.message));
    };

    document.getElementById('goto-register').onclick = () => toggleForms(true);
    document.getElementById('goto-login').onclick = () => toggleForms(false);
    document.getElementById('logout-btn').onclick = () => signOut(auth).then(()=>window.location.reload());

    // NAV
    document.getElementById('nav-aviator').onclick = () => switchTab('aviator');
    document.getElementById('nav-spin').onclick = () => switchTab('spin');
    document.getElementById('nav-profile').onclick = () => switchTab('profile');

    // GAME CONTROLS
    document.getElementById('bet-btn').onclick = placeAviatorBet;
    document.querySelectorAll('.chip-btn').forEach(b => b.onclick = () => document.getElementById('bet-amount').value = b.dataset.val);
    document.getElementById('inc-bet').onclick = () => adjustBet(50);
    document.getElementById('dec-bet').onclick = () => adjustBet(-50);

    // SPIN CONTROLS
    document.getElementById('btn-lemon').onclick = () => spinColor('lemon');
    document.getElementById('btn-navy').onclick = () => spinColor('navy');

    // MODALS
    document.getElementById('open-deposit-modal').onclick = () => document.getElementById('deposit-modal').style.display='flex';
    document.getElementById('cancel-deposit').onclick = () => document.getElementById('deposit-modal').style.display='none';
    document.getElementById('confirm-deposit').onclick = processDeposit;

    document.getElementById('open-withdraw-modal').onclick = () => document.getElementById('withdraw-modal').style.display='flex';
    document.getElementById('cancel-withdraw').onclick = () => document.getElementById('withdraw-modal').style.display='none';
    document.getElementById('confirm-withdraw').onclick = processWithdraw;
    document.getElementById('save-nickname-btn').onclick = saveNick;
});

function toggleForms(showReg) {
    document.getElementById('login-form').classList.toggle('hidden', showReg);
    document.getElementById('register-form').classList.toggle('hidden', !showReg);
}

// === AUTH STATE ===
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        const userRef = doc(db, "users", user.uid);
        try {
            const snap = await getDoc(userRef);
            if (snap.exists() && snap.data().nickname) {
                initDashboard(snap.data());
            } else {
                if(!snap.exists()) await setDoc(userRef, { email: user.email, balance: 0, uid: user.uid, history: [] }, {merge:true});
                document.getElementById('auth-screen').classList.remove('active');
                document.getElementById('nickname-modal').style.display = 'flex';
            }
        } catch (e) {
            initDashboard({ nickname: "Guest", balance: 0 }); 
        }
    } else {
        document.getElementById('dashboard-screen').classList.add('hidden');
        document.getElementById('auth-screen').classList.remove('hidden');
        document.getElementById('auth-screen').classList.add('active');
    }
});

async function saveNick() {
    const n = document.getElementById('google-nickname-input').value;
    if(n) { await updateDoc(doc(db, "users", currentUser.uid), { nickname: n }); window.location.reload(); }
}

function initDashboard(data) {
    document.getElementById('auth-screen').classList.remove('active'); 
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('nickname-modal').style.display = 'none';
    
    document.getElementById('dashboard-screen').classList.remove('hidden');
    document.getElementById('dashboard-screen').classList.add('active');

    document.getElementById('header-nick').innerText = data.nickname || "Player";
    document.getElementById('profile-name').innerText = data.nickname || "Player";
    document.getElementById('profile-email').innerText = currentUser.email;
    document.getElementById('profile-id').innerText = "ID: " + currentUser.uid.slice(0,6).toUpperCase();

    onSnapshot(doc(db, "users", currentUser.uid), (docSnap) => {
        if(docSnap.exists()) {
            currentBalance = docSnap.data().balance;
            document.getElementById('wallet-balance').innerText
