import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, onSnapshot, addDoc, serverTimestamp, query, orderBy, where } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDJFQnwOs-fetKVy0Ow43vktz8xwefZMks",
    authDomain: "cyou-db8f0.firebaseapp.com",
    projectId: "cyou-db8f0",
    databaseURL: "https://cyou-db8f0-default-rtdb.firebaseio.com",
    appId: "1:873569975141:web:147eb7b7b4043a38c9bf8c"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ←←← CHANGE THIS TO YOUR REAL EMAIL (the only admin) ←←←
const ADMIN_EMAIL = "bazookarider@gmail.com";   // ← PUT YOUR EXACT EMAIL HERE

// Login & Register
document.getElementById("loginBtn")?.addEventListener("click", () => {
  const email = document.getElementById("email").value;
  const pass = document.getElementById("password").value;
  signInWithEmailAndPassword(auth, email, pass).catch(e => alert(e.message));
});
document.getElementById("registerBtn")?.addEventListener("click", () => {
  const email = document.getElementById("email").value;
  const pass = document.getElementById("password").value;
  createUserWithEmailAndPassword(auth, email, pass).catch(e => alert(e.message));
});

// Main Auth
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    document.getElementById("authSection").classList.remove("hidden");
    document.getElementById("freeSection").classList.add("hidden");
    return;
  }

  document.getElementById("authSection").classList.add("hidden");
  document.getElementById("freeSection").classList.remove("hidden");

  // Show VIP content if approved
  const vipSnap = await getDoc(doc(db, "vipUsers", user.uid));
  if (vipSnap.exists() && vipSnap.data().isApproved) {
    document.getElementById("vipLocked").classList.add("hidden");
    document.getElementById("vipSection").classList.remove("hidden");
    loadChat();
  }

  // ADMIN PANEL (works even if not VIP)
  if (user.email === ADMIN_EMAIL) {
    // Floating Admin Button
    if (!document.getElementById("adminBtn")) {
      const btn = document.createElement("div");
      btn.id = "adminBtn";
      btn.innerHTML = "ADMIN";
      btn.className = "fixed bottom-6 right-6 bg-red-600 text-white font-bold px-6 py-4 rounded-full shadow-2xl z-50 animate-bounce cursor-pointer text-xl";
      btn.onclick = () => document.getElementById("adminPanel").classList.toggle("hidden");
      document.body.appendChild(btn);
    }

    // Admin Panel
    if (!document.getElementById("adminPanel")) {
      const panel = document.createElement("div");
      panel.id = "adminPanel";
      panel.className = "hidden fixed inset-0 bg-black/95 z-50 p-6 overflow-y-auto";
      panel.innerHTML = `
        <div class="bg-gray-900 rounded-xl p-8 max-w-2xl mx-auto">
          <h2 class="text-4xl font-bold text-yellow-400 mb-6 text-center">ADMIN PANEL</h2>
          <button onclick="auth.signOut()" class="bg-red-600 px-6 py-2 rounded mb-4">Logout</button>
          <h3 class="text-2xl mt-6 mb-4 text-green-400">Pending Payments</h3>
          <div id="pendingList" class="space-y-4"></div>
        </div>
      `;
      document.body.appendChild(panel);
      loadPendingPayments();
    }
  }
});

// WhatsApp Payment
window.payViaWhatsApp = () => {
  if (!auth.currentUser) return alert("Login first!");
  const text = encodeURIComponent(`Hello! I paid ₦1,000 for VIP. Email: ${auth.currentUser.email}`);
  window.open(`https://wa.me/2347056353236?text=${text}`, "_blank");

  setDoc(doc(db, "vipUsers", auth.currentUser.uid), {
    email: auth.currentUser.email,
    amount: 1000,
    timestamp: serverTimestamp(),
    isApproved: false
  }, { merge: true });
};

// Approve User
window.approveUser = (uid) => {
  setDoc(doc(db, "vipUsers", uid), { isApproved: true }, { merge: true });
  alert("VIP Approved!");
};

// Load Pending
function loadPendingPayments() {
  const q = query(collection(db, "vipUsers"), where("isApproved", "==", false));
  onSnapshot(q, (snap) => {
    const list = document.getElementById("pendingList");
    if (!list) return;
    list.innerHTML = snap.empty ? "<p>No pending</p>" : "";
    snap.forEach(d => {
      const data = d.data();
      list.innerHTML += `
        <div class="bg-gray-800 p-4 rounded flex justify-between items-center">
          <div><strong>${data.email}</strong><br>₦1000</div>
          <button onclick="approveUser('${d.id}')" class="bg-green-600 px-6 py-2 rounded">Approve</button>
        </div>
      `;
    });
  });
}

// Chat
function loadChat() {
  const q = query(collection(db, "vipChat"), orderBy("timestamp"));
  onSnapshot(q, snap => {
    const msg = document.getElementById("chatMessages");
    msg.innerHTML = "";
    snap.forEach(d => {
      const m = d.data();
      msg.innerHTML += `<div class="mb-2"><strong>\( {m.name}:</strong> \){m.text}</div>`;
    });
    msg.scrollTop = msg.scrollHeight;
  });

  document.getElementById("sendChat").onclick = () => {
    const input = document.getElementById("chatInput");
    if (input.value.trim()) {
      addDoc(collection(db, "vipChat"), {
        name: auth.currentUser.email.split("@")[0],
        text: input.value,
        timestamp: serverTimestamp()
      });
      input.value = "";
    }
  };
}