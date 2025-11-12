// script.js (final version)
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

/* ---------------------------
   🌐 DOM Elements
---------------------------- */
const joinSection = document.getElementById("joinSection");
const chatSection = document.getElementById("chatSection");
const nameInput = document.getElementById("nameInput");
const enterBtn = document.getElementById("enterBtn");
const messageInput = document.getElementById("messageInput");
const sendForm = document.getElementById("sendForm");
const messagesDiv = document.getElementById("messages");
const typingIndicator = document.getElementById("typingIndicator");
const onlineCount = document.getElementById("onlineCount");
const onlineUsersList = document.getElementById("onlineUsers");

let username = localStorage.getItem("cyou_username") || "";
let typingTimeout;

/* ---------------------------
   👤 Auth & Join
---------------------------- */
signInAnonymously(auth);
onAuthStateChanged(auth, (user) => {
  if (user) console.log("Signed in anonymously:", user.uid);
});

enterBtn.addEventListener("click", async () => {
  const name = nameInput.value.trim();
  if (!name) return alert("Enter your name first!");

  // Check if name already exists
  const userDoc = await getDoc(doc(db, "cyou_presence", name));
  if (userDoc.exists()) {
    return alert("That name is already in use. Choose another one!");
  }

  username = name;
  localStorage.setItem("cyou_username", username);

  joinSection.style.display = "none";
  chatSection.style.display = "flex";

  await addPresence();
  listenForMessages();
  listenForTyping();
});

/* Auto-join if stored */
if (username) {
  joinSection.style.display = "none";
  chatSection.style.display = "flex";
  addPresence();
  listenForMessages();
  listenForTyping();
}

/* ---------------------------
   💬 Messaging
---------------------------- */
sendForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = messageInput.value.trim();
  if (!text) return;

  const newMsg = {
    name: username,
    text,
    createdAt: serverTimestamp(),
    seen: false,
    deleted: false
  };

  const docRef = await addDoc(collection(db, "cyou_messages"), newMsg);
  updateDoc(docRef, { id: docRef.id });

  messageInput.value = "";
  setTyping(false);
});

function listenForMessages() {
  const q = query(collection(db, "cyou_messages"), orderBy("createdAt"));
  onSnapshot(q, (snapshot) => {
    messagesDiv.innerHTML = "";
    snapshot.forEach((docSnap) => {
      const msg = docSnap.data();
      const isYou = msg.name === username;
      const div = document.createElement("div");
      div.classList.add("message", isYou ? "me" : "other");

      if (msg.deleted) {
        div.innerHTML = `<em>Message deleted</em>`;
      } else {
        div.innerHTML = `
          <strong>${msg.name}</strong><br>
          ${msg.text}
          <span class="meta">
            ${new Date(msg.createdAt?.toDate?.() || Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            ${isYou ? (msg.seen ? "✓✓" : "✓") : ""}
          </span>
        `;
      }

      // Delete button for own messages
      if (isYou && !msg.deleted) {
        const delBtn = document.createElement("button");
        delBtn.textContent = "🗑";
        delBtn.classList.add("delete-btn");
        delBtn.onclick = async () => {
          await updateDoc(doc(db, "cyou_messages", docSnap.id), { deleted: true });
        };
        div.appendChild(delBtn);
      }

      messagesDiv.appendChild(div);
    });
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  });
}

/* ---------------------------
   👥 Presence
---------------------------- */
async function addPresence() {
  const userRef = doc(db, "cyou_presence", username);
  await setDoc(userRef, { online: true });
  onSnapshot(collection(db, "cyou_presence"), (snap) => {
    const users = snap.docs.filter((d) => d.data().online);
    onlineCount.textContent = users.length;
    onlineUsersList.innerHTML = "";
    users.forEach((d) => {
      const li = document.createElement("li");
      li.innerHTML = `<span class="user-dot online"></span>${d.id}`;
      onlineUsersList.appendChild(li);
    });
  });
  window.addEventListener("beforeunload", () => {
    deleteDoc(userRef);
  });
}

/* ---------------------------
   ⌨ Typing Indicator
---------------------------- */
messageInput.addEventListener("input", handleTyping);

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
      .map((d) => ({ name: d.id, ...d.data() }))
      .filter((d) => d.typing && d.name !== username);

    typingIndicator.textContent = typers.length
      ? `${typers.map((t) => `${t.name} is typing...`).join(", ")}`
      : "";
  });
}