import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
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

// CHANGE THIS TO YOUR REAL EMAIL (the only admin)
const ADMIN_EMAIL = "abdulkareemgloo@gmail.com";   // ← PUT YOUR EMAIL HERE

document.getElementById("loginBtn").onclick = () => signInWithEmailAndPassword(auth, document.getElementById("email").value, document.getElementById("password").value).catch(e => alert(e.message));
document.getElementById("registerBtn").onclick = () => createUserWithEmailAndPassword(auth, document.getElementById("email").value, document.getElementById("password").value).catch(e => alert(e.message));

onAuthStateChanged(auth, async (user) => {
  if (user) {
    document.getElementById("authSection").classList.add("hidden");
    document.getElementById("freeSection").classList.remove("hidden");

    const vipSnap = await getDoc(doc(db, "vipUsers", user.uid));
    if (vipSnap.exists() && vipSnap.data().isApproved) {
      document.getElementById("vipLocked").classList.add("hidden");
      document.getElementById("vipSection").classList.remove("hidden");
      loadChat();
    }

    // ADMIN PANEL (only you)
    if (user.email === ADMIN_EMAIL) {
      document.body.insertAdjacentHTML('beforeend', `
        <div class="fixed bottom-4 right-4 bg-red-600 p-4 rounded-full shadow-2xl z-50 animate-bounce cursor-pointer" onclick="toggleAdminPanel()">
          <span class="text-3xl">Admin</span>
        </div>
        <div id="adminPanel" class="hidden fixed inset-0 bg-black/95 z-50 p-6 overflow-y-auto">
          <div class="bg-gray-900 rounded-xl p-8 max-w-2xl mx-auto">
            <h2 class="text-4xl font-bold text-yellow-400 mb-6">ADMIN PANEL</h2>
            <button onclick="toggleAdminPanel()" class="float-right text-3xl">Close</button>
            <h3 class="text-2xl mt-8 mb-4">Pending Payments</h3>
            <div id="pendingList" class="space-y-4"></div>
          </div>
        </div>
      `);
      loadPendingPayments();
    }
  }
});

window.payViaWhatsApp = () => {
  const email = auth.currentUser?.email || document.getElementById("email").value;
  const text = encodeURIComponent(`Hello NaijaSureOdds! I just paid ₦1,000 for VIP (50% OFF). My email: ${email}`);
  window.open(`https://wa.me/2347056353236?text=${text}`, "_blank");

  // Auto-save pending payment
  if (auth.currentUser) {
    setDoc(doc(db, "vipUsers", auth.currentUser.uid), {
      email: auth.currentUser.email,
      amount: 1000,
      timestamp: serverTimestamp(),
      isApproved: false
    }, { merge: true });
  }
};

window.toggleAdminPanel = () => document.getElementById("adminPanel")?.classList.toggle("hidden");

async function loadPendingPayments() {
  const q = query(collection(db, "vipUsers"), where("isApproved", "==", false));
  onSnapshot(q, (snap) => {
    const list = document.getElementById("pendingList");
    if (!list) return;
    list.innerHTML = snap.empty ? "<p>No pending payments</p>" : "";
    snap.forEach(d => {
      const data = d.data();
      const div = document.createElement("div");
      div.className = "bg-gray-800 p-4 rounded flex justify-between items-center";
      div.innerHTML = `
        <div><strong>\( {data.email}</strong><br>₦ \){data.amount || 1000} • ${data.timestamp?.toDate().toLocaleString() || "Just now"}</div>
        <button onclick="approveUser('${d.id}')" class="bg-green-600 px-6 py-2 rounded font-bold">Approve VIP</button>
      `;
      list.appendChild(div);
    });
  });
}

window.approveUser = async (uid) => {
  await setDoc(doc(db, "vipUsers", uid), { isApproved: true }, { merge: true });
  alert("VIP Approved! User now has full access.");
};

function loadChat() {
  const q = query(collection(db, "vipChat"), orderBy("timestamp"));
  onSnapshot(q, (snap) => {
    const messages = document.getElementById("chatMessages");
    messages.innerHTML = "";
    snap.forEach(d => {
      const m = d.data();
      messages.innerHTML += `<div class="mb-2"><strong>\( {m.name}:</strong> \){m.text}</div>`;
    });
    messages.scrollTop = messages.scrollHeight;
  });

  document.getElementById("sendChat").onclick = async () => {
    const input = document.getElementById("chatInput");
    if (input.value.trim() && auth.currentUser) {
      await addDoc(collection(db, "vipChat"), {
        name: auth.currentUser.email.split("@")[0],
        text: input.value,
        timestamp: serverTimestamp()
      });
      input.value = "";
    }
  };
}