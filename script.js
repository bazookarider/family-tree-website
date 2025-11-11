import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  doc,
  getDocs,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBE3R...your-key...",
  authDomain: "cyou-db8f0.firebaseapp.com",
  projectId: "cyou-db8f0",
  storageBucket: "cyou-db8f0.appspot.com",
  messagingSenderId: "32168636726",
  appId: "1:32168636726:web:583e079d03e1f66198dceb"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// DOM elements
const joinContainer = document.getElementById("joinContainer");
const chatContainer = document.getElementById("chatContainer");
const nameInput = document.getElementById("nameInput");
const joinBtn = document.getElementById("joinBtn");
const chatBox = document.getElementById("chatBox");
const msgInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const themeToggle = document.getElementById("themeToggle");
const clearChat = document.getElementById("clearChat");
const nameError = document.getElementById("nameError");

let username = "";
let theme = localStorage.getItem("theme") || "light";
if (theme === "dark") document.body.classList.add("dark");

themeToggle.addEventListener("click", () => {
  document.body.classList.toggle("dark");
  localStorage.setItem("theme", document.body.classList.contains("dark") ? "dark" : "light");
});

// Auto-login
const savedName = localStorage.getItem("cyou_username");
if (savedName) {
  username = savedName;
  joinContainer.style.display = "none";
  chatContainer.style.display = "flex";
  listenForMessages();
}

joinBtn.addEventListener("click", async () => {
  const enteredName = nameInput.value.trim();
  if (!enteredName) return;

  // check duplicate name
  const presenceSnap = await getDocs(collection(db, "cyou_presence"));
  const nameExists = presenceSnap.docs.some(doc => doc.id === enteredName);
  if (nameExists) {
    nameError.textContent = "⚠️ Name already exists. Choose another.";
    return;
  }

  username = enteredName;
  localStorage.setItem("cyou_username", username);
  await addDoc(collection(db, "cyou_presence"), { name: username, online: true });
  joinContainer.style.display = "none";
  chatContainer.style.display = "flex";
  listenForMessages();
});

sendBtn.addEventListener("click", sendMessage);
msgInput.addEventListener("keypress", e => {
  if (e.key === "Enter") sendMessage();
});

async function sendMessage() {
  const text = msgInput.value.trim();
  if (!text) return;

  const docRef = await addDoc(collection(db, "cyou_messages"), {
    name: username,
    text,
    createdAt: serverTimestamp(),
    delivered: false
  });

  // After short delay, mark delivered
  setTimeout(async () => {
    await updateDoc(docRef, { delivered: true });
  }, 800);

  msgInput.value = "";
}

function listenForMessages() {
  const q = query(collection(db, "cyou_messages"), orderBy("createdAt"));
  onSnapshot(q, snapshot => {
    chatBox.innerHTML = "";
    snapshot.forEach(msgDoc => {
      const msg = msgDoc.data();
      const isYou = msg.name === username;

      const div = document.createElement("div");
      div.classList.add("message", isYou ? "you" : "them");

      const meta = document.createElement("div");
      meta.className = "meta";
      if (isYou) {
        meta.textContent = msg.delivered ? "✓✓" : "✓";
      }

      div.innerHTML = `
        <div><strong>${isYou ? "You" : msg.name}</strong>: ${msg.text}</div>
      `;
      div.appendChild(meta);
      chatBox.appendChild(div);
    });
    chatBox.scrollTop = chatBox.scrollHeight;
  });
}

clearChat.addEventListener("click", () => {
  chatBox.innerHTML = "";
});