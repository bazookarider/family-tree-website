import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, onSnapshot, addDoc, serverTimestamp, query, orderBy } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

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

// Login / Register
document.getElementById("loginBtn").onclick = () => signInWithEmailAndPassword(auth, email.value, password.value).catch(e => alert(e.message));
document.getElementById("registerBtn").onclick = () => createUserWithEmailAndPassword(auth, email.value, password.value).catch(e => alert(e.message));

const email = document.getElementById("email");
const password = document.getElementById("password");

// Auth State
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
  }
});

// WhatsApp Payment Button
window.payViaWhatsApp = () => {
  const text = encodeURIComponent(`Hello NaijaSureOdds! I want VIP access (50% off ₦1,000). My email: ${auth.currentUser?.email || email.value}`);
  window.open(`https://wa.me/2347056353236?text=${text}`, "_blank");
};

// Live Chat
function loadChat() {
  const q = query(collection(db, "vipChat"), orderBy("timestamp"));
  onSnapshot(q, (snap) => {
    document.getElementById("chatMessages").innerHTML = "";
    snap.forEach(d => {
      const m = d.data();
      const div = document.createElement("div");
      div.className = "mb-2";
      div.innerHTML = `<strong>\( {m.name}:</strong> \){m.text}`;
      document.getElementById("chatMessages").appendChild(div);
    });
    document.getElementById("chatMessages").scrollTop = document.getElementById("chatMessages").scrollHeight;
  });

  document.getElementById("sendChat").onclick = async () => {
    const input = document.getElementById("chatInput");
    if (input.value.trim()) {
      await addDoc(collection(db, "vipChat"), {
        name: auth.currentUser.email.split("@")[0],
        text: input.value,
        timestamp: serverTimestamp()
      });
      input.value = "";
    }
  };
}