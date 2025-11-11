// script.js (module)
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import {
  getAuth, signInAnonymously, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, serverTimestamp,
  onSnapshot, query, orderBy, doc, setDoc, updateDoc, deleteDoc, getDoc
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

/* ---------------------------
   🔥 CYOU Firebase Config
---------------------------- */
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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* --- rest of your logic stays unchanged --- */
// Everything from your previous working version goes below this comment (join, send message, presence, typing, etc.)
const joinBox = document.getElementById("join-box");
const chatBox = document.getElementById("chat-box");
const nameInput = document.getElementById("name-input");
const joinBtn = document.getElementById("join-btn");
const messageInput = document.getElementById("message-input");
const sendBtn = document.getElementById("send-btn");
const chatArea = document.getElementById("chat-area");
const typingIndicator = document.getElementById("typing-indicator");
const onlineCount = document.getElementById("online-count");

let username = "";
let typingTimeout;

// Anonymous login
signInAnonymously(auth);

onAuthStateChanged(auth, (user) => {
  if (user) console.log("Signed in anonymously:", user.uid);
});

joinBtn.addEventListener("click", () => {
  username = nameInput.value.trim();
  if (!username) return alert("Enter your name first!");
  joinBox.classList.add("hidden");
  chatBox.classList.remove("hidden");
  addPresence();
  listenForMessages();
  listenForTyping();
});

sendBtn.addEventListener("click", sendMessage);
messageInput.addEventListener("input", handleTyping);

async function sendMessage() {
  const text = messageInput.value.trim();
  if (!text) return;
  await addDoc(collection(db, "cyou_messages"), {
    name: username,
    text,
    createdAt: serverTimestamp(),
  });
  messageInput.value = "";
  setTyping(false);
}

function listenForMessages() {
  const q = query(collection(db, "cyou_messages"), orderBy("createdAt"));
  onSnapshot(q, (snapshot) => {
    chatArea.innerHTML = "";
    snapshot.forEach((doc) => {
      const msg = doc.data();
      const isYou = msg.name === username;
      const div = document.createElement("div");
      div.classList.add("message", isYou ? "you" : "other");
      div.innerHTML = `
        <strong>${msg.name}</strong><br>
        ${msg.text}
        <span class="meta">${new Date(
          msg.createdAt?.toDate?.() || Date.now()
        ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
      `;
      chatArea.appendChild(div);
    });
    chatArea.scrollTop = chatArea.scrollHeight;
  });
}

async function addPresence() {
  const userRef = doc(db, "cyou_presence", username);
  await setDoc(userRef, { online: true });
  onSnapshot(collection(db, "cyou_presence"), (snap) => {
    const onlineUsers = snap.docs.filter((d) => d.data().online).length;
    onlineCount.textContent = `${onlineUsers} online`;
  });
  window.addEventListener("beforeunload", () => {
    deleteDoc(userRef);
  });
}

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
    const typers = snap.docs
      .map((d) => d.id)
      .filter((n) => n !== username);
    typingIndicator.textContent = typers.length
      ? `${typers.join(", ")} typing...`
      : "";
  });
}