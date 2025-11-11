// script.js (module)
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import {
  getAuth, signInAnonymously, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, serverTimestamp,
  onSnapshot, query, orderBy, doc, setDoc, updateDoc, getDoc
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

/* === Firebase config (your project) ===
   storageBucket corrected to .appspot.com
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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// UI references
const nameInput = document.getElementById("nameInput");
const enterBtn = document.getElementById("enterBtn");
const onlineCountEl = document.getElementById("onlineCount");
const onlineUsersEl = document.getElementById("onlineUsers");
const messagesEl = document.getElementById("messages");
const sendForm = document.getElementById("sendForm");
const messageInput = document.getElementById("messageInput");
const typingIndicator = document.getElementById("typingIndicator");
const emojiBtn = document.getElementById("emojiBtn");
const emojiPanel = document.getElementById("emojiPanel");
const themeToggle = document.getElementById("themeToggle");

// state
let currentUser = null;
let displayName = localStorage.getItem("cyou_name") || "";
let typingTimeout = null;
let heartbeatInterval = null;
const HEARTBEAT_MS = 5000;
const PRESENCE_FRESH_MS = 12000;

// some helpers
function $(id){ return document.getElementById(id); }
function nowMs(){ return Date.now(); }
function pad(n){ return n<10 ? "0"+n : n; }
function formatTime(d){ try { return `${pad(d.getHours())}:${pad(d.getMinutes())}` } catch(e){ return ''; } }

// prefill name if saved
if (displayName) nameInput.value = displayName;

// UI start state
messageInput.disabled = true;

// THEME: init from localStorage
const savedTheme = localStorage.getItem("cyou_theme") || "light";
if (savedTheme === "dark") document.body.classList.add("dark");
themeToggle.textContent = document.body.classList.contains("dark") ? "☀️" : "🌙";
themeToggle.addEventListener("click", () => {
  document.body.classList.toggle("dark");
  const isDark = document.body.classList.contains("dark");
  themeToggle.textContent = isDark ? "☀️" : "🌙";
  localStorage.setItem("cyou_theme", isDark ? "dark" : "light");
});

// EMOJI: simple list (expand anytime)
const emojiList = ["😀","😁","😄","😅","😂","🤣","😊","😍","😘","😎","😇","🤩","🤗","😜","🤪","😴","😢","😭","😡","👍","👎","🙏","🔥","🌟"];
function buildEmojiPanel(){
  emojiPanel.innerHTML = "";
  emojiList.forEach(e => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "emoji";
    b.textContent = e;
    b.addEventListener("click", () => {
      insertAtCursor(messageInput, e);
      messageInput.focus();
      emojiPanel.classList.add("hidden");
    });
    emojiPanel.appendChild(b);
  });
}
buildEmojiPanel();

emojiBtn.addEventListener("click", (ev) => {
  emojiPanel.classList.toggle("hidden");
  emojiPanel.setAttribute("aria-hidden", emojiPanel.classList.contains("hidden"));
});

// helper to insert emoji at cursor
function insertAtCursor(el, text) {
  const start = el.selectionStart || 0;
  const end = el.selectionEnd || 0;
  el.value = el.value.slice(0, start) + text + el.value.slice(end);
  el.selectionStart = el.selectionEnd = start + text.length;
  el.dispatchEvent(new Event('input'));
}

// JOIN flow
enterBtn.addEventListener("click", async () => {
  const name = (nameInput.value || "").trim();
  if (!name) return alert("Please enter a display name before joining.");
  displayName = name;
  localStorage.setItem("cyou_name", displayName);
  try {
    await signInAnonymously(auth);
  } catch (err) {
    console.error("Sign-in error:", err);
    alert("Sign-in failed (see console).");
  }
});
nameInput.addEventListener("keyup", (e) => { if (e.key === "Enter") enterBtn.click(); });

// auth state
onAuthStateChanged(auth, async (user) => {
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

// SENDING messages
sendForm.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const text = (messageInput.value || "").trim();
  if (!text || !currentUser) return;
  try {
    const ref = await addDoc(collection(db, "cyou_messages"), {
      text,
      name: displayName,
      uid: currentUser.uid,
      createdAt: serverTimestamp(),
      seenBy: [],
      status: "sent"
    });
    // mark delivered (quick local update)
    await updateDoc(ref, { status: "delivered" });
    messageInput.value = "";
    setTyping(false);
  } catch (err) {
    console.error("Send error:", err);
    alert("Could not send message. Check console.");
  }
});

// TYPING indicator (per-user)
let lastTypedAt = 0;
messageInput.addEventListener("input", () => {
  setTyping(true);
  lastTypedAt = nowMs();
  if (typingTimeout) clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    if (nowMs() - lastTypedAt >= 1400) setTyping(false);
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
      if (data.typing && data.uid !== (currentUser && currentUser.uid)) typers.push(data.name || "Someone");
    });
    if (typers.length === 0) typingIndicator.textContent = "";
    else if (typers.length === 1) typingIndicator.textContent = `${typers[0]} is typing...`;
    else typingIndicator.textContent = `${typers.slice(0,3).join(", ")} are typing...`;
  }, (err) => console.warn("Typing onSnapshot error", err));
}

// PRESENCE: best-effort auto-remove presence when disconnecting
async function startPresence(){
  if (!currentUser) return;
  const refDoc = doc(db, "cyou_presence", currentUser.uid);
  try {
    await setDoc(refDoc, { uid: currentUser.uid, name: displayName, lastActive: serverTimestamp() });
  } catch (e) { console.warn("presence init", e); }

  heartbeatInterval = setInterval(async () => {
    try {
      await setDoc(refDoc, { uid: currentUser.uid, name: displayName, lastActive: serverTimestamp() });
    } catch (e) { console.warn("presence heartbeat", e); }
  }, HEARTBEAT_MS);

  // attempt to delete presence on unload (best-effort)
  window.addEventListener("beforeunload", async () => {
    try {
      const docRef = doc(db, "cyou_presence", currentUser.uid);
      await updateDoc(docRef, { lastActive: serverTimestamp() });
    } catch (e) { /* ignore */ }
  });

  // when tab hidden, still update lastActive so others see you as alive or not
  document.addEventListener("visibilitychange", async () => {
    try {
      const docRef = doc(db, "cyou_presence", currentUser.uid);
      await setDoc(docRef, { uid: currentUser.uid, name: displayName, lastActive: serverTimestamp() });
    } catch(e){}
  });
}

function subscribeToPresence(){
  const col = collection(db, "cyou_presence");
  onSnapshot(col, (snap) => {
    const now = nowMs();
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
  }, (err) => console.warn("Presence onSnapshot error", err));
}

// MESSAGES subscription: last 6 messages, smooth auto-scroll
function subscribeToMessages(){
  const q = query(collection(db, "cyou_messages"), orderBy("createdAt"));
  onSnapshot(q, (snap) => {
    const docs = [];
    snap.forEach(d => docs.push({ id: d.id, data: d.data() }));
    const last = docs.slice(-6);
    messagesEl.innerHTML = "";
    last.forEach(d => renderMessage(d.id, d.data));
    // smooth auto-scroll: scroll into view last child
    const lastChild = messagesEl.lastElementChild;
    if (lastChild) lastChild.scrollIntoView({ behavior: 'smooth', block: 'end' });
    markMessagesSeen(last);
  }, (err) => {
    console.error("Messages onSnapshot error:", err);
    alert("Could not load messages. Check console.");
  });
}

// mark messages as seen for messages not by me
async function markMessagesSeen(docs){
  if (!currentUser) return;
  for (const d of docs) {
    const data = d.data; const id = d.id;
    if (data.uid !== currentUser.uid) {
      const seenBy = Array.isArray(data.seenBy) ? data.seenBy : [];
      if (!seenBy.includes(currentUser.uid)) {
        try {
          const mRef = doc(db, "cyou_messages", id);
          await updateDoc(mRef, { seenBy: [...seenBy, currentUser.uid], status: "seen" });
        } catch (e) { /* ignore concurrency errors */ }
      }
    }
  }
}

function renderMessage(id, data){
  const div = document.createElement("div");
  const isMe = data.uid === (currentUser && currentUser.uid);
  div.className = "message " + (isMe ? "me" : "other");

  const text = document.createElement("div");
  text.className = "text";
  text.textContent = data.text || "";
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

  const ticks = document.createElement("span");
  ticks.className = "ticks";
  const status = data.status || "sent";
  if (isMe) {
    if (status === "sent") { ticks.textContent = "✔"; ticks.style.color = "gray"; }
    else if (status === "delivered") { ticks.textContent = "✔✔"; ticks.style.color = "gray"; }
    else if (status === "seen") { ticks.textContent = "✔✔"; ticks.style.color = "#2b88ff"; }
    else { ticks.textContent = "✔"; ticks.style.color = "gray"; }
  } else {
    ticks.textContent = "";
  }

  meta.appendChild(author);
  meta.appendChild(document.createTextNode(" • "));
  meta.appendChild(time);
  if (isMe) { meta.appendChild(document.createTextNode(" ")); meta.appendChild(ticks); }

  div.appendChild(meta);
  messagesEl.append