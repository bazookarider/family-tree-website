import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import {
  getAuth, signInAnonymously, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, serverTimestamp,
  onSnapshot, query, orderBy, doc, setDoc, updateDoc, deleteDoc, getDoc
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

/* Firebase Config */
const firebaseConfig = {
  apiKey: "AIzaSyDJFQnwOs-fetKVy0Ow43vktz8xwefZMks",
  authDomain: "cyou-db8f0.firebaseapp.com",
  projectId: "cyou-db8f0",
  storageBucket: "cyou-db8f0.firebasestorage.app",
  messagingSenderId: "873569975141",
  appId: "1:873569975141:web:147eb7b7b4043a38c9bf8c",
  measurementId: "G-T66B50HFJ8"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* DOM */
const joinSection = document.getElementById("joinSection");
const chatSection = document.getElementById("chatSection");
const nameInput = document.getElementById("nameInput");
const enterBtn = document.getElementById("enterBtn");
const messageInput = document.getElementById("messageInput");
const sendForm = document.getElementById("sendForm");
const messagesDiv = document.getElementById("messages");
const typingIndicator = document.getElementById("typingIndicator");
const onlineCount = document.getElementById("onlineCount");
const themeToggle = document.getElementById("themeToggle");

let username = "";
let typingTimeout;

signInAnonymously(auth);
onAuthStateChanged(auth, (user) => {
  if (user) console.log("Signed in:", user.uid);
});

/* THEME */
themeToggle.onclick = () => {
  document.body.classList.toggle("dark");
  localStorage.setItem("cyou_theme", document.body.classList.contains("dark") ? "dark" : "light");
};
if (localStorage.getItem("cyou_theme") === "dark") {
  document.body.classList.add("dark");
}

/* JOIN */
enterBtn.addEventListener("click", async () => {
  username = nameInput.value.trim();
  if (!username) return alert("Enter your name first!");

  const userRef = doc(db, "cyou_presence", username);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) {
    alert("⚠️ This name already exists. Choose another.");
    return;
  }

  localStorage.setItem("cyou_username", username);
  joinSection.style.display = "none";
  chatSection.style.display = "flex";
  await addPresence();
  listenForMessages();
  listenForTyping();
});

sendForm.addEventListener("submit", sendMessage);
messageInput.addEventListener("input", handleTyping);

async function sendMessage(e) {
  e.preventDefault();
  const text = messageInput.value.trim();
  if (!text) return;

  const msgRef = await addDoc(collection(db, "cyou_messages"), {
    name: username,
    text,
    createdAt: serverTimestamp(),
    seen: false
  });

  messageInput.value = "";
  setTyping(false);

  setTimeout(() => updateDoc(msgRef, { delivered: true }), 800);
}

/* Listen for messages */
function listenForMessages() {
  const q = query(collection(db, "cyou_messages"), orderBy("createdAt"));
  onSnapshot(q, (snapshot) => {
    messagesDiv.innerHTML = "";
    snapshot.forEach((docSnap) => {
      const msg = docSnap.data();
      const isYou = msg.name === username;

      if (!isYou && !msg.seen) updateDoc(docSnap.ref, { seen: true });

      const div = document.createElement("div");
      div.classList.add("message", isYou ? "me" : "other");
      div.innerHTML = `
        <strong>${msg.name}</strong><br>${msg.text}
        <div class="meta">
          ${msg.createdAt ? new Date(msg.createdAt.toDate()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
          ${isYou ? (msg.seen ? "✓✓" : msg.delivered ? "✓" : "") : ""}
        </div>
      `;
      messagesDiv.appendChild(div);
    });
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  });
}

/* Typing */
async function handleTyping() {
  setTyping(true);
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => setTyping(false), 2000);
}

async function setTyping(state) {
  await setDoc(doc(db, "cyou_typing", username), { typing: state });
}

function listenForTyping() {
  onSnapshot(collection(db, "cyou_typing"), (snap) => {
    const typers = snap.docs.map((d) => d.id).filter((n) => n !== username);
    typingIndicator.textContent = typers.length ? `${typers.join(", ")} typing...` : "";
  });
}

/* Presence */
async function addPresence() {
  const userRef = doc(db, "cyou_presence", username);
  await setDoc(userRef, { online: true });
  onSnapshot(collection(db, "cyou_presence"), (snap) => {
    const onlineUsers = snap.docs.filter((d) => d.data().online).length;
    onlineCount.textContent = onlineUsers;
  });
  window.addEventListener("beforeunload", () => {
    deleteDoc(userRef);
  });
}