import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import {
  getAuth, signInAnonymously, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, serverTimestamp,
  onSnapshot, query, orderBy, doc, setDoc, updateDoc, getDoc, getDocs
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

/*
  Put your config here (I corrected storageBucket to .appspot.com)
*/
const firebaseConfig = {
  apiKey: "AIzaSyDJFQnwOs-fetKVy0Ow43vktz8xwefZMks",
  authDomain: "cyou-db8f0.firebaseapp.com",
  projectId: "cyou-db8f0",
  storageBucket: "cyou-db8f0.appspot.com",
  messagingSenderId: "873569975141",
  appId: "1:873569975141:web:147eb7b7b4043a38c9bf8c",
  measurementId: "G-T66B50HFJ8"
};

// init
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// UI refs
const nameInput = document.getElementById("nameInput");
const enterBtn = document.getElementById("enterBtn");
const onlineCountEl = document.getElementById("onlineCount");
const onlineUsersEl = document.getElementById("onlineUsers");
const messagesEl = document.getElementById("messages");
const sendForm = document.getElementById("sendForm");
const messageInput = document.getElementById("messageInput");
const typingIndicator = document.getElementById("typingIndicator");

// state
let currentUser = null;
let displayName = localStorage.getItem("cyou_name") || "";
let typingTimeout = null;
let heartbeatInterval = null;
const HEARTBEAT_MS = 5000;
const PRESENCE_FRESH_MS = 12000;

// prefill name if remembered
if (displayName) nameInput.value = displayName;

// Ensure initial UI state
messageInput.disabled = true;

// Join flow
enterBtn.addEventListener("click", async () => {
  const name = (nameInput.value || "").trim();
  if (!name) return alert("Please enter a display name before joining.");
  displayName = name;
  localStorage.setItem("cyou_name", displayName);

  try {
    await signInAnonymously(auth);
    console.log("Signing in anonymously...");
  } catch (err) {
    console.error("Sign-in error:", err);
    alert("Sign-in failed. Check console.");
  }
});

// Keep Enter key for convenience
nameInput.addEventListener("keyup", (e) => { if (e.key === "Enter") enterBtn.click(); });

// Auth listener
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    if (!displayName) displayName = localStorage.getItem("cyou_name") || ("User" + user.uid.slice(0,5));
    console.log("Signed in:", user.uid, "as", displayName);
    enterUI();
    startPresence();
    subscribeToPresence();
    subscribeToTyping();
    subscribeToMessages();
  } else {
    currentUser = null;
    messageInput.disabled = true;
  }
});

function enterUI(){
  nameInput.disabled = true;
  enterBtn.disabled = true;
  messageInput.disabled = false;
  messageInput.focus();
}

// Send message
sendForm.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const text = (messageInput.value || "").trim();
  if (!text || !currentUser) return;
  try {
    // create message with server timestamp and initial status 'sent'
    const ref = await addDoc(collection(db, "cyou_messages"), {
      text,
      name: displayName,
      uid: currentUser.uid,
      createdAt: serverTimestamp(),
      seenBy: [],       // who has seen this message
      status: "sent"    // sent -> delivered -> seen
    });
    // As soon as write completes, mark delivered (others reading will see it)
    await updateDoc(ref, { status: "delivered" });
    messageInput.value = "";
    setTyping(false);
  } catch (err) {
    console.error("Send error:", err);
    alert("Could not send message. Check console.");
  }
});

// Typing indicator (uses Firestore collection 'cyou_typing' with doc id = uid)
let lastTypedAt = 0;
messageInput.addEventListener("input", () => {
  setTyping(true);
  lastTypedAt = Date.now();
  if (typingTimeout) clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    if (Date.now() - lastTypedAt >= 1400) setTyping(false);
  }, 1400);
});

async function setTyping(isTyping) {
  if (!currentUser) return;
  const docRef = doc(db, "cyou_typing", currentUser.uid);
  try {
    await setDoc(docRef, {
      uid: currentUser.uid,
      name: displayName,
      typing: isTyping,
      lastUpdated: serverTimestamp()
    });
  } catch (err) {
    console.warn("Typing error:", err);
  }
}

function subscribeToTyping(){
  const col = collection(db, "cyou_typing");
  onSnapshot(col, (snap) => {
    const typers = [];
    snap.forEach(d => {
      const data = d.data();
      if (data.typing && data.uid !== (currentUser && currentUser.uid)) {
        typers.push(data.name || "Someone");
      }
    });
    if (typers.length === 0) typingIndicator.textContent = "";
    else if (typers.length === 1) typingIndicator.textContent = `${typers[0]} is typing...`;
    else typingIndicator.textContent = `${typers.slice(0,3).join(", ")} are typing...`;
  }, (err) => {
    console.warn("Typing onSnapshot error", err);
  });
}

// Presence (collection 'cyou_presence' with doc id = uid)
async function startPresence(){
  if (!currentUser) return;
  const refDoc = doc(db, "cyou_presence", currentUser.uid);
  try {
    await setDoc(refDoc, {
      uid: currentUser.uid,
      name: displayName,
      lastActive: serverTimestamp()
    });
  } catch(e){ console.warn("presence initial set", e); }

  heartbeatInterval = setInterval(async () => {
    try {
      await setDoc(refDoc, {
        uid: currentUser.uid,
        name: displayName,
        lastActive: serverTimestamp()
      });
    } catch (e) { console.warn("presence heartbeat", e); }
  }, HEARTBEAT_MS);

  // best-effort remove on unload
  window.addEventListener("beforeunload", async () => {
    try { await updateDoc(refDoc, { lastActive: serverTimestamp() }); } catch(e){}
  });
}

function subscribeToPresence(){
  const col = collection(db, "cyou_presence");
  onSnapshot(col, (snap) => {
    const now = Date.now();
    const online = [];
    snap.forEach(d => {
      const data = d.data();
      const lastActive = data.lastActive;
      let isOnline = true;
      if (lastActive && lastActive.toMillis) {
        isOnline = (now - lastActive.toMillis()) < PRESENCE_FRESH_MS;
      }
      if (isOnline) online.push({ name: data.name || "User", uid: data.uid });
    });

    onlineUsersEl.innerHTML = "";
    online.forEach(u => {
      const li = document.createElement("li");
      li.textContent = u.name;
      onlineUsersEl.appendChild(li);
    });
    onlineCountEl.textContent = online.length;
  }, (err) => {
    console.warn("Presence onSnapshot error", err);
  });
}

// Messages subscription (last 6 messages)
function subscribeToMessages(){
  const q = query(collection(db, "cyou_messages"), orderBy("createdAt"));
  onSnapshot(q, (snap) => {
    const docs = [];
    snap.forEach(d => docs.push({ id: d.id, data: d.data() }));
    // keep only last 6 messages
    const last = docs.slice(-6);
    messagesEl.innerHTML = "";
    last.forEach(d => renderMessage(d.id, d.data));
    messagesEl.scrollTop = messagesEl.scrollHeight;

    // After rendering, mark messages as seen/delivered appropriately
    markMessagesSeen(last);
  }, (err) => {
    console.error("Messages onSnapshot error:", err);
    alert("Could not load messages. Check console.");
  });
}

async function markMessagesSeen(docs) {
  if (!currentUser) return;
  for (const d of docs) {
    const data = d.data;
    const id = d.id;
    // If message not by current user, and current user hasn't seen it, add to seenBy
    if (data.uid !== currentUser.uid) {
      const seenBy = Array.isArray(data.seenBy) ? data.seenBy : [];
      if (!seenBy.includes(currentUser.uid)) {
        try {
          const mRef = doc(db, "cyou_messages", id);
          await updateDoc(mRef, { seenBy: [...seenBy, currentUser.uid], status: "seen" });
        } catch (e) {
          // concurrent updates might fail sometimes; ignore
        }
      }
    }
  }
}

function renderMessage(id, data) {
  const div = document.createElement("div");
  const isMe = data.uid === (currentUser && currentUser.uid);
  div.className = "message " + (isMe ? "me" : "other");

  // text
  const text = document.createElement("div");
  text.className = "text";
  text.textContent = data.text || "";
  div.appendChild(text);

  // meta (name, time, ticks)
  const meta = document.createElement("div");
  meta.className = "meta";

  const author = document.createElement("span");
  author.className = "author";
  author.textContent = isMe ? "You" : (data.name || "User");

  const time = document.createElement("span");
  time.className = "time";
  const ts = data.createdAt && data.createdAt.toDate ? data.createdAt.toDate() : new Date();
  time.textContent = `${formatTime(ts)}`;

  const ticks = document.createElement("span");
  ticks.className = "ticks";
  // tick logic
  // sent -> delivered -> seen
  const status = data.status || "sent";
  if (isMe) {
    if (status === "sent") {
      ticks.textContent = "✔"; ticks.style.color = "gray";
    } else if (status === "delivered") {
      ticks.textContent = "✔✔"; ticks.style.color = "gray";
    } else if (status === "seen") {
      ticks.textContent = "✔✔"; ticks.style.color = "#2b88ff";
    } else {
      ticks.textContent = "✔"; ticks.style.color = "gray";
    }
  } else {
    ticks.textContent = ""; // other people's messages don't show ticks for you
  }

  // assemble meta
  meta.appendChild(author);
  meta.appendChild(document.createTextNode(" • "));
  meta.appendChild(time);
  if (isMe) {
    meta.appendChild(document.createTextNode(" "));
    meta.appendChild(ticks);
  }

  div.appendChild(meta);
  messagesEl.appendChild(div);
}

function pad(n){ return n<10 ? "0"+n : n; }
function formatTime(d){
  try {
    const hh = pad(d.getHours());
    const mm = pad(d.getMinutes());
    return `${hh}:${mm}`;
  } catch(e) { return ""; }
}

// UI state at start
messageInput.disabled = true;