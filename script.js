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

// ---- UI elements
const nameInput = document.getElementById("nameInput");
const enterBtn = document.getElementById("enterBtn");
const onlineCountEl = document.getElementById("onlineCount");
const onlineUsersEl = document.getElementById("onlineUsers");
const messagesEl = document.getElementById("messages");
const sendForm = document.getElementById("sendForm");
const messageInput = document.getElementById("messageInput");
const typingIndicator = document.getElementById("typingIndicator");

// Simple client-side state
let currentUser = null;
let displayName = null;
let typingTimeout = null;
let heartbeatInterval = null;
const HEARTBEAT_MS = 5000; // update online presence every 5s
const PRESENCE_FRESH_MS = 12000; // mark as online if updated within 12s

// Allow pressing Enter to join
nameInput.addEventListener("keyup", (e) => {
  if (e.key === "Enter") enterBtn.click();
});

enterBtn.addEventListener("click", async () => {
  const name = (nameInput.value || "").trim();
  if (!name) {
    alert("Please enter a display name before joining.");
    return;
  }
  displayName = name;
  localStorage.setItem("cyou_name", displayName);
  await signInAnonymously(auth);
});

// Auto-fill name if saved
const savedName = localStorage.getItem("cyou_name");
if (savedName) nameInput.value = savedName;

// Auth state handling
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    if (!displayName) {
      displayName = localStorage.getItem("cyou_name") || ("User" + user.uid.slice(0,5));
    }
    enterUI();
    startPresence();
    subscribeToMessages();
    subscribeToPresence();
    subscribeToTyping();
  } else {
    currentUser = null;
  }
});

// UI enabling
function enterUI(){
  nameInput.disabled = true;
  enterBtn.disabled = true;
  messageInput.disabled = false;
  messageInput.focus();
}

// ---- Sending messages
sendForm.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const text = (messageInput.value || "").trim();
  if (!text) return;
  const messagesCol = collection(db, "cyou_messages");

  await addDoc(messagesCol, {
    text,
    createdAt: serverTimestamp(),
    uid: currentUser.uid,
    name: displayName,
    seenBy: [currentUser.uid]
  });

  messageInput.value = "";
  setTyping(false);
});

// ---- Typing indicator mechanism
let lastTypedAt = 0;
messageInput.addEventListener("input", () => {
  setTyping(true);
  lastTypedAt = Date.now();
  if (typingTimeout) clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    if (Date.now() - lastTypedAt >= 1600) setTyping(false);
  }, 1600);
});

async function setTyping(isTyping){
  if (!currentUser) return;
  const docRef = doc(db, "cyou_typing", currentUser.uid);
  await setDoc(docRef, {
    uid: currentUser.uid,
    name: displayName,
    typing: isTyping,
    lastUpdated: serverTimestamp()
  });
}

function subscribeToTyping(){
  const q = collection(db, "cyou_typing");
  onSnapshot(q, (snap) => {
    const typers = [];
    snap.forEach(d => {
      const data = d.data();
      if (data.typing) typers.push(data.name || "Someone");
    });
    if (typers.length === 0) {
      typingIndicator.textContent = "";
    } else if (typers.length === 1) {
      typingIndicator.textContent = `${typers[0]} is typing...`;
    } else {
      typingIndicator.textContent = `${typers.slice(0,3).join(", ")} are typing...`;
    }
  });
}

// ---- Presence (online users)
async function startPresence(){
  if (!currentUser) return;
  const ref = doc(db, "cyou_presence", currentUser.uid);

  await setDoc(ref, {
    uid: currentUser.uid,
    name: displayName,
    lastActive: serverTimestamp()
  });

  heartbeatInterval = setInterval(async () => {
    try {
      await setDoc(ref, {
        uid: currentUser.uid,
        name: displayName,
        lastActive: serverTimestamp()
      });
    } catch (e) {
      console.error("heartbeat error", e);
    }
  }, HEARTBEAT_MS);

  window.addEventListener("beforeunload", async () => {
    try { await deleteDoc(ref); } catch(e){ /* ignore */ }
  });
}

function subscribeToPresence(){
  const q = collection(db, "cyou_presence");
  onSnapshot(q, (snap) => {
    const now = Date.now();
    const online = [];
    snap.forEach(d => {
      const data = d.data();
      const lastActive = data.lastActive;
      let isOnline = true;
      if (lastActive && lastActive.toMillis) {
        isOnline = (now - lastActive.toMillis()) < PRESENCE_FRESH_MS;
      }
      if (isOnline) online.push({name: data.name || "User", uid: data.uid});
    });

    onlineUsersEl.innerHTML = "";
    online.forEach(u => {
      const li = document.createElement("li");
      li.textContent = u.name;
      onlineUsersEl.appendChild(li);
    });
    onlineCountEl.textContent = online.length;
  });
}

// ---- Messages subscription & rendering
function subscribeToMessages(){
  const messagesCol = collection(db, "cyou_messages");
  const q = query(messagesCol, orderBy("createdAt"));

  onSnapshot(q, (snap) => {
    messagesEl.innerHTML = "";
    const docs = [];
    snap.forEach(d => docs.push({id: d.id, data: d.data()}));

    for (const d of docs) {
      renderMessage(d.id, d.data);
    }
    messagesEl.scrollTop = messagesEl.scrollHeight;
    markVisibleMessagesAsSeen(docs);
  });
}

function renderMessage(id, data){
  const div = document.createElement("div");
  const isMe = data.uid === currentUser.uid;
  div.className = "message " + (isMe ? "me" : "other");
  const text = document.createElement("div");
  text.className = "text";
  text.textContent = data.text;
  div.appendChild(text);

  const meta = document.createElement("div");
  meta.className = "meta";

  const author = document.createElement("span");
  author.className = "author";
  author.textContent = isMe ? "You" : (data.name || "User");

  const time = document.createElement("span");
  time.className = "time";
  const ts = data.createdAt && data.createdAt.toDate ? data.createdAt.toDate() : new Date();
  time.textContent = formatTime(ts);

  meta.appendChild(author);
  meta.appendChild(document.createTextNode(" • "));
  meta.appendChild(time);

  const seen = document.createElement("span");
  seen.className = "seen";
  const seenBy = Array.isArray(data.seenBy) ? data.seenBy : [];
  if (seenBy.length > 1) {
    seen.textContent = ` • seen (${seenBy.length})`;
  } else if (seenBy.length === 1 && isMe) {
    seen.textContent = ` • sent`;
  } else {
    seen.textContent = "";
  }
  meta.appendChild(seen);

  div.appendChild(meta);
  messagesEl.appendChild(div);
}

async function markVisibleMessagesAsSeen(docs){
  const batchLimit = 50;
  const visible = docs.slice(-batchLimit);
  for (const d of visible) {
    const mDocRef = doc(db, "cyou_messages", d.id);
    try {
      const current = await getDoc(mDocRef);
      if (!current.exists()) continue;
      const data = current.data();
      const seenBy = Array.isArray(data.seenBy) ? data.seenBy : [];
      if (!seenBy.includes(currentUser.uid)) {
        await updateDoc(mDocRef, { seenBy: [...seenBy, currentUser.uid] });
      }
    } catch (e) {}
  }
}

function pad(n){ return n<10 ? "0"+n : n; }
function formatTime(d){
  try {
    const hh = pad(d.getHours());
    const mm = pad(d.getMinutes());
    const dd = pad(d.getDate());
    const mmn = pad(d.getMonth()+1);
    return `${hh}:${mm} ${dd}/${mmn}`;
  } catch(e) {
    return "";
  }
}

// ---- initial UI state
messageInput.disabled = true;