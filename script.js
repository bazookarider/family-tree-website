// Log everything to console for debugging
console.log("Script loading...");

const firebaseConfig = {
  apiKey: "AIzaSyDJFQnwOs-fetKVy0Ow43vktz8xwefZMks",
  authDomain: "cyou-db8f0.firebaseapp.com",
  projectId: "cyou-db8f0",
  storageBucket: "cyou-db8f0.firebasestorage.app",
  messagingSenderId: "873569975141",
  appId: "1:873569975141:web:147eb7b7b4043a38c9bf8c"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
const ADMIN_UID = "J1wGDrL0W9hYSZEM910k9oVz3uU2";

console.log("Firebase initialized");

auth.onAuthStateChanged(user => {
  console.log("Auth state changed:", user ? user.email : "No user");
  if (user) {
    document.getElementById("auth").style.display = "none";
    document.getElementById("app").style.display = "block";
    document.getElementById("status").innerText = `Welcome, ${user.email}`;
    loadFreeTips();
    if (user.uid === ADMIN_UID) {
      document.getElementById("adminBtn").innerHTML = `<br><button onclick="adminPanel()" style="background:red">ADMIN PANEL</button>`;
    }
  } else {
    document.getElementById("auth").style.display = "block";
    document.getElementById("app").style.display = "none";
    document.getElementById("status").innerText = 'Please login or register';
  }
});

// Direct button event listeners (bypasses onclick issues)
document.addEventListener('DOMContentLoaded', () => {
  console.log("DOM loaded – attaching buttons");
  document.getElementById('regBtn').addEventListener('click', register);
  document.getElementById('logBtn').addEventListener('click', login);
});

function register() {
  console.log("Register clicked");
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const msg = document.getElementById("msg");
  if (!email || !password) { 
    msg.innerText = 'Enter email & password'; 
    console.log("Missing fields");
    return; 
  }
  auth.createUserWithEmailAndPassword(email, password)
    .then(() => { 
      msg.innerText = 'Registered! Logging in...'; 
      console.log("Registered success");
    })
    .catch(error => { 
      msg.innerText = error.message; 
      console.log("Register error:", error.message);
    });
}

function login() {
  console.log("Login clicked");
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const msg = document.getElementById("msg");
  if (!email || !password) { 
    msg.innerText = 'Enter email & password'; 
    console.log("Missing fields");
    return; 
  }
  auth.signInWithEmailAndPassword(email, password)
    .then(() => { 
      msg.innerText = 'Logged in!'; 
      console.log("Login success");
    })
    .catch(error => { 
      msg.innerText = error.message; 
      console.log("Login error:", error.message);
    });
}

function logout() { 
  console.log("Logout clicked");
  auth.signOut(); 
}

function loadFreeTips() {
  console.log("Loading free tips");
  const today = new Date().toISOString().slice(0,10);
  db.collection("freeTips").doc(today).get().then(snap => {
    const div = document.getElementById("free");
    if (snap.exists) {
      div.innerHTML = snap.data().games.map(g => `<p>• ${g}</p>`).join('');
    } else {
      div.innerHTML = "<p>No free tips today – check back later!</p>";
    }
  }).catch(e => console.log("Tips error:", e));
}

function checkVip() {
  console.log("Check VIP clicked");
  const uid = auth.currentUser.uid;
  db.collection("users").doc(uid).get().then(userDoc => {
    if (userDoc.exists && userDoc.data().isVip) {
      const today = new Date().toISOString().slice(0,10);
      db.collection("vipTips").doc(today).get().then(snap => {
        const div = document.getElementById("vip");
        div.style.display = "block";
        if (snap.exists) {
          div.innerHTML = snap.data().games.map(g => `<p>• ${g}</p>`).join('');
        } else {
          div.innerHTML = "<p>VIP tips loading soon...</p>";
        }
      });
    } else {
      alert(`Pay ₦500/week to:\n\nOpay: 9125297720\nName: Abdulkarim Aliyu\n\nThen send proof to WhatsApp:\n+2349125297720`);
    }
  });
}

function adminPanel() {
  console.log("Admin panel opened");
  const games = prompt("Paste today's games (one per line):\n\nExample:\nMan Utd vs Chelsea - Over 2.5\nBarca win");
  if (!games) return;
  const today = new Date().toISOString().slice(0,10);
  const isVip = confirm("Post as VIP tips?");
  const ref = db.collection(isVip ? "vipTips" : "freeTips").doc(today);
  ref.set({
    games: games.split("\n").filter(x => x.trim())
  }).then(() => alert("Posted successfully!")).catch(e => alert("Error: " + e.message));
}