import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, updateDoc, doc } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDJFQnwOs-fetKVy0Ow43vktz8xwefZMks",
  authDomain: "cyou-db8f0.firebaseapp.com",
  projectId: "cyou-db8f0",
  storageBucket: "cyou-db8f0.firebasestorage.app",
  messagingSenderId: "873569975141",
  appId: "1:873569975141:web:147eb7b7b4043a38c9bf8c",
  measurementId: "G-T66B50HFJ8",
  databaseURL: "https://cyou-db8f0-default-rtdb.firebaseio.com"
};

// Init Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const rtdb = getDatabase(app);
const auth = getAuth(app);

// Elements
const joinSection = document.getElementById("join-section");
const chatSection = document.getElementById("chat-section");
const usernameInput = document.getElementById("usernameInput");
const joinBtn = document.getElementById("joinBtn");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const messagesDiv = document.getElementById("messages");
const typingIndicator = document.getElementById("typingIndicator");

let username = localStorage.getItem("cyouUser") || "";
let typingRef;
let currentUserId;

// Auto-login memory
if (username) {
  showChat();
} else {
  joinSection.classList.remove("hidden");
}

joinBtn.addEventListener("click", async () => {
  username = usernameInput.value.trim();
  if (!username) return alert("Please enter your name");
  localStorage.setItem("cyouUser", username);
  await signInAnonymously(auth);
});

onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUserId = user.uid;
    showChat();
  }
});

function showChat() {
  joinSection.classList.add("hidden");
  chatSection.classList.remove("hidden");
  listenMessages();
  setupTyping();
}

// Typing indicator setup
function setupTyping() {
  typingRef = ref(rtdb, "typing");
  messageInput.addEventListener("input", () => {
    set(typingRef, { user: username, typing: messageInput.value.length > 0 });
  });
  onValue(typingRef, (snapshot) => {
    const data = snapshot.val();
    if (data && data.typing && data.user !== username) {
      typingIndicator.classList.remove("hidden");
    } else {
      typingIndicator.classList.add("hidden");
    }
  });
}

// Send message
sendBtn.addEventListener("click", async () => {
  const text = messageInput.value.trim();
  if (!text) return;
  try {
    const docRef = await addDoc(collection(db, "messages"), {
      text,
      user: username,
      sentAt: serverTimestamp(),
      status: "sent"
    });
    messageInput.value = "";
    updateDoc(doc(db, "messages", docRef.id), { status: "delivered" });
  } catch (e) {
    alert("Failed to send message");
  }
});

// Listen messages
function listenMessages() {
  const q = query(collection(db, "messages"), orderBy("sentAt"));
  onSnapshot(q, (snapshot) => {
    messagesDiv.innerHTML = "";
    let messages = [];
    snapshot.forEach((doc) => messages.push({ id: doc.id, ...doc.data() }));

    messages = messages.slice(-6);
    messages.forEach((msg) => renderMessage(msg));
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  });
}

function renderMessage(msg) {
  const div = document.createElement("div");
  div.classList.add("message");
  if (msg.user === username) div.classList.add("self");

  let tick = "✔"; // single tick
  if (msg.status === "delivered") tick = "✔✔";
  if (msg.status === "seen") tick = "✔✔";
  const color = msg.status === "seen" ? "blue" : "gray";

  const time = msg.sentAt?.toDate?.().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) || "";

  div.innerHTML = `
    <b>${msg.user}</b>: ${msg.text}
    <div class="timestamp">${time} <span class="ticks" style="color:${color}">${tick}</span></div>
  `;
  messagesDiv.appendChild(div);
}