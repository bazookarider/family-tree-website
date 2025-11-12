import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import {
  getAuth, signInAnonymously, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, serverTimestamp, query, orderBy, onSnapshot,
  doc, setDoc, getDoc, updateDoc
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDJFQnwOs-fetKVy0Ow43vktz8xwefZMks",
  authDomain: "cyou-db8f0.firebaseapp.com",
  projectId: "cyou-db8f0",
  storageBucket: "cyou-db8f0.firebasestorage.app",
  messagingSenderId: "873569975141",
  appId: "1:873569975141:web:147eb7b7b4043a38c9bf8c"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const joinScreen = document.getElementById("joinScreen");
const chatApp = document.getElementById("chatApp");
const nameInput = document.getElementById("nameInput");
const checkBtn = document.getElementById("checkBtn");
const nameError = document.getElementById("nameError");
const modeSelect = document.getElementById("modeSelect");
const privateBox = document.getElementById("privateBox");
const publicBtn = document.getElementById("publicBtn");
const privateBtn = document.getElementById("privateBtn");
const partnerInput = document.getElementById("partnerInput");
const joinPrivateBtn = document.getElementById("joinPrivateBtn");

const messagesEl = document.getElementById("messages");
const typingIndicator = document.getElementById("typingIndicator");
const sendForm = document.getElementById("sendForm");
const messageInput = document.getElementById("messageInput");

let currentUser = null;
let displayName = null;
let chatMode = null;
let chatRoom = "public";

checkBtn.onclick = async () => {
  const name = nameInput.value.trim();
  if (!name) return;
  const exists = await getDoc(doc(db, "cyou_users", name));
  if (exists.exists()) {
    nameError.textContent = "Username already taken!";
    return;
  }
  nameError.textContent = "";
  displayName = name;
  await setDoc(doc(db, "cyou_users", name), { online: true, lastSeen: serverTimestamp() });
  modeSelect.classList.remove("hidden");
};

publicBtn.onclick = async () => {
  chatMode = "public";
  await signIn();
};

privateBtn.onclick = () => {
  privateBox.classList.remove("hidden");
};

joinPrivateBtn.onclick = async () => {
  const partner = partnerInput.value.trim();
  if (!partner) return;
  chatMode = "private";
  chatRoom = [displayName, partner].sort().join("_");
  await signIn();
};

async function signIn(){
  await signInAnonymously(auth);
  onAuthStateChanged(auth, (user) => {
    if (user) {
      currentUser = user;
      joinScreen.classList.add("hidden");
      chatApp.classList.remove("hidden");
      subscribeMessages();
    }
  });
}

sendForm.onsubmit = async (e) => {
  e.preventDefault();
  const text = messageInput.value.trim();
  if (!text) return;
  await addDoc(collection(db, `cyou_${chatRoom}`), {
    name: displayName,
    uid: currentUser.uid,
    text,
    createdAt: serverTimestamp(),
    seen: []
  });
  messageInput.value = "";
};

function subscribeMessages(){
  const q = query(collection(db, `cyou_${chatRoom}`), orderBy("createdAt"));
  onSnapshot(q, (snap) => {
    messagesEl.innerHTML = "";
    snap.forEach(docu => {
      const m = docu.data();
      const div = document.createElement("div");
      const isMe = m.name === displayName;
      div.className = "message " + (isMe ? "me" : "other");
      div.innerHTML = `
        <div>${m.text}</div>
        <div class="meta">
          ${isMe ? "You" : m.name} • ${formatTime(m.createdAt?.toDate?.() || new Date())}
          ${renderTicks(m, isMe)}
        </div>`;
      messagesEl.appendChild(div);
    });
    messagesEl.scrollTop = messagesEl.scrollHeight;
  });
}

function renderTicks(m, isMe){
  if (!isMe) return "";
  const seen = (m.seen || []).length;
  if (seen === 0) return "✓";
  if (seen === 1) return `<span style="color:gray">✓✓</span>`;
  return `<span style="color:var(--tick-blue)">✓✓</span>`;
}

function formatTime(d){
  return `${d.getHours().toString().padStart(2,"0")}:${d.getMinutes().toString().padStart(2,"0")}`;
}