 import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } 
from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs } 
from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDSmyGbIfE0TQOpsrocU9EpY5f6oFlhz2k",
  authDomain: "fifa-league-manager-2f64f.firebaseapp.com",
  projectId: "fifa-league-manager-2f64f",
  storageBucket: "fifa-league-manager-2f64f.firebasestorage.app",
  messagingSenderId: "682215688542",
  appId: "1:682215688542:web:1d441e9c741861d45267cf",
  measurementId: "G-X8QQ1N8J4M"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// Elements
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const adminPanel = document.getElementById("adminPanel");
const leaguesGrid = document.getElementById("leaguesGrid");

// Login
loginBtn.onclick = () => signInWithPopup(auth, provider);

// Logout
logoutBtn.onclick = () => signOut(auth);

// Auth State
onAuthStateChanged(auth, (user) => {
  if (user) {
    loginBtn.style.display = "none";
    logoutBtn.style.display = "flex";
    adminPanel.style.display = "block";
  } else {
    loginBtn.style.display = "flex";
    logoutBtn.style.display = "none";
    adminPanel.style.display = "none";
  }
});

// Create League
document.getElementById("createLeagueBtn").onclick = async () => {
  const name = document.getElementById("leagueName").value.trim();
  const user = auth.currentUser;

  if (!name || !user) return;

  await addDoc(collection(db, "leagues"), {
    name: name,
    ownerId: user.uid,
    ownerName: user.displayName,
    createdAt: new Date()
  });

  document.getElementById("leagueName").value = "";
  loadLeagues();
};

// Load Leagues
async function loadLeagues() {
  leaguesGrid.innerHTML = "";
  const snapshot = await getDocs(collection(db, "leagues"));

  snapshot.forEach(doc => {
    const league = doc.data();

    leaguesGrid.innerHTML += `
      <div class="league-card">
        <h3>${league.name}</h3>
        <p>Owner: ${league.ownerName}</p>
      </div>
    `;
  });
}

loadLeagues();