import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import {
  getAuth, signInAnonymously, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, serverTimestamp,
  onSnapshot, query, orderBy, doc, setDoc, deleteDoc
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

let username = "";
let typingTimeout;

/* ---------------------------
   👤 Authentication
---------------------------- */
signInAnonymously(auth);
onAuthStateChanged(auth, (user) => {
  if (user) console.log("Signed in anonymously:", user.uid);
});

/* ---------------------------
   🚪 Join Chat
---------------------------- */
enterBtn.addEventListener("click", () => {
  username = nameInput.value.trim();
  if (!username) return alert("Please enter your name first!");

  joinSection.style.display = "none";
  chatSection.style.display = "flex";

  addPresence();
  listenForMessages();
  listenForTyping();
});

/* ---------------------------
   💬 Send Message
---------------------------- */
sendForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = messageInput.value.trim();
  if (!text) return;

  await addDoc(collection(db, "cyou_messages"), {
    name: username,
    text,
    createdAt: serverTimestamp(),
  });

  messageInput.value = "";
  setTyping(false);
});

/* ---------------------------
   📡 Listen for Messages
---------------------------- */
function listenForMessages() {
  const q = query(collection(db, "cyou_messages"), orderBy("createdAt"));
  onSnapshot(q, (snapshot) => {
    messagesDiv.innerHTML = "";
    snapshot.forEach((doc) => {
      const msg = doc.data();
      const isYou = msg.name === username;
      const div = document.createElement("div");
      div.classList.add("message", isYou ? "me" : "other");
      div.innerHTML = `
        <strong>${msg.name}</strong><br>
        ${msg.text}
        <div class="meta">${new Date(
          msg.createdAt?.toDate?.() || Date.now()
        ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
      `;
      messagesDiv.appendChild(div);
    });
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  });
}

/* ---------------------------
   👥 Online Presence
---------------------------- */
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

/* ---------------------------
   ✍️ Typing Indicator (Animated)
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
      .filter((d) => d.data().typing)
      .map((d) => d.id)
      .filter((n) => n !== username);

    if (typers.length) {
      typingIndicator.innerHTML = `${typers.join(", ")} typing <span class="dot"></span><span class="dot"></span><span class="dot"></span>`;
    } else {
      typingIndicator.innerHTML = "";
    }
  });
}