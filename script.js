// script.js (module)
// Public-only optimized CYOU chat: auto-login, auto-scroll, typing, presence, ticks (Firestore)

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import {
  getAuth, signInAnonymously, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, serverTimestamp,
  onSnapshot, query, orderBy, limitToLast,
  doc, setDoc, updateDoc, arrayUnion, getDoc
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

/* --- firebase config (same project) --- */
const firebaseConfig = {
  apiKey: "AIzaSyDJFQnwOs-fetKVy0Ow43vktz8xwefZMks",
  authDomain: "cyou-db8f0.firebaseapp.com",
  projectId: "cyou-db8f0",
  storageBucket: "cyou-db8f0.appspot.com",
  messagingSenderId: "873569975141",
  appId: "1:873569975141:web:147eb7b7b4043a38c9bf8c",
  measurementId: "G-T66B50HFJ8"
};

/* init */
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* UI refs */
const joinScreen = document.getElementById("joinScreen");
const joinBtn = document.getElementById("joinBtn");
const nameInput = document.getElementById("nameInput");
const nameError = document.getElementById("nameError");

const chatApp = document.getElementById("chatApp");
const messagesEl = document.getElementById("messages");
const typingIndicator = document.getElementById("typingIndicator");
const sendForm = document.getElementById("sendForm");
const messageInput = document.getElementById("messageInput");
const onlineCountEl = document.getElementById("onlineCount");

const emojiBtn = document.getElementById("emojiBtn");
const emojiPanel = document.getElementById("emojiPanel");

let currentUser = null;
let displayName = localStorage.getItem("cyou_name") || "";
let typingTimeout = null;
let presenceInterval = null;
const HEARTBEAT_MS = 5000;
const PRESENCE_FRESH_MS = 14000; // consider online if lastActive < 14s

// prefill name if saved
if (displayName) nameInput.value = displayName;

// fast-join when a name is saved
if (displayName) {
  // verify user doc exists; if not, create
  (async () => {
    try {
      const userDocRef = doc(db, "cyou_users", displayName);
      const snapshot = await getDoc(userDocRef);
      if (!snapshot.exists()) {
        await setDoc(userDocRef, { online: true, lastSeen: serverTimestamp() });
      }
      // sign in anonymously to get uid and start presence
      await signInAnonymously(auth);
    } catch (e) {
      console.warn("Auto-join error:", e);
    }
  })();
}

// --- JOIN flow (enter name -> join public)
joinBtn.addEventListener("click", async () => {
  const name = (nameInput.value || "").trim();
  if (!name) return;
  try {
    // check if username exists and is online (collision)
    const userRef = doc(db, "cyou_users", name);
    const snapshot = await getDoc(userRef);
    if (snapshot.exists()) {
      const data = snapshot.data();
      // If doc exists but this browser already has that name saved, allow (auto rejoin)
      const saved = localStorage.getItem("cyou_name");
      if (saved === name) {
        // allow rejoin
      } else if (data.online) {
        nameError.textContent = "Username already taken — choose another.";
        return;
      }
    }
    // set local and write user doc (mark online)
    displayName = name;
    localStorage.setItem("cyou_name", displayName);
    await setDoc(doc(db, "cyou_users", displayName), { online: true, lastSeen: serverTimestamp() });
    // sign in anonymously
    await signInAnonymously(auth);
  } catch (err) {
    console.error("Join error:", err);
    nameError.textContent = "Could not join — check console.";
  }
});

// Auth state
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    enterUI();
    startPresence();
    subscribePresence();
    subscribeTyping();
    subscribeMessages();
  } else {
    // signed out (rare)
    currentUser = null;
  }
});

function enterUI(){
  joinScreen.classList.add("hidden");
  chatApp.classList.remove("hidden");
  messageInput.disabled = false;
  messageInput.focus();
}

// --- Presence (user list & online count)
async function startPresence(){
  if (!currentUser || !displayName) return;
  const ref = doc(db, "cyou_presence", currentUser.uid);
  try {
    await setDoc(ref, { uid: currentUser.uid, name: displayName, lastActive: serverTimestamp() });
  } catch (e) { console.warn("presence set error", e); }

  presenceInterval = setInterval(async () => {
    try {
      await setDoc(ref, { uid: currentUser.uid, name: displayName, lastActive: serverTimestamp() });
    } catch (e) { console.warn("presence heartbeat", e); }
  }, HEARTBEAT_MS);

  window.addEventListener("beforeunload", async () => {
    try {
      const userDoc = doc(db, "cyou_users", displayName);
      await updateDoc(userDoc, { online: false, lastSeen: serverTimestamp() });
      const presenceRef = doc(db, "cyou_presence", currentUser.uid);
      await setDoc(presenceRef, { uid: currentUser.uid, name: displayName, lastActive: serverTimestamp() });
    } catch (e) {}
  });
}

function subscribePresence(){
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
      if (isOnline) online.push(data.name || "User");
    });
    onlineCountEl.textContent = online.length;
  }, (err) => console.warn("presence onSnapshot", err));
}

// --- Typing (per-user)
let lastTypedAt = 0;
messageInput.addEventListener("input", () => {
  setTyping(true);
  lastTypedAt = Date.now();
  if (typingTimeout) clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    if (Date.now() - lastTypedAt >= 1400) setTyping(false);
  }, 1400);
});

async function setTyping(isTyping){
  if (!currentUser) return;
  try {
    await setDoc(doc(db, "cyou_typing", currentUser.uid), {
      uid: currentUser.uid,
      name: displayName,
      typing: isTyping,
      lastUpdated: serverTimestamp()
    });
  } catch (e) { console.warn("typing set error", e); }
}

function subscribeTyping(){
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
  }, (err) => console.warn("typing subscribe error", err));
}

// --- Send message (public)
sendForm.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const text = (messageInput.value || "").trim();
  if (!text || !currentUser) return;
  try {
    // create message; deliveredBy and seenBy start empty
    const ref = await addDoc(collection(db, "cyou_messages"), {
      text,
      name: displayName,
      uid: currentUser.uid,
      createdAt: serverTimestamp(),
      deliveredBy: [],
      seenBy: []
    });
    // optimistic delivered update (this marks as delivered locally quickly)
    try { await updateDoc(ref, { status: "delivered" }); } catch(e){}
    messageInput.value = "";
    setTyping(false);
  } catch (e) {
    console.error("send error", e);
    alert("Could not send message (see console).");
  }
});

// --- Listen messages: limitToLast(6) for low bandwidth + auto-scroll
function subscribeMessages(){
  const q = query(collection(db, "cyou_messages"), orderBy("createdAt"), limitToLast(6));
  onSnapshot(q, async (snap) => {
    // build array of docs in order
    const docs = [];
    snap.forEach(d => docs.push({ id: d.id, data: d.data() }));
    messagesEl.innerHTML = "";

    for (const m of docs) {
      renderMessage(m.id, m.data);
    }

    // auto-scroll: smooth to bottom
    const last = messagesEl.lastElementChild;
    if (last) last.scrollIntoView({ behavior: 'smooth', block: 'end' });

    // mark this client as having delivered these messages (if not sender)
    for (const m of docs) {
      if (m.data.uid !== currentUser.uid) {
        try {
          const mRef = doc(db, "cyou_messages", m.id);
          await updateDoc(mRef, { deliveredBy: arrayUnion(currentUser.uid) });
        } catch (e){ /* ignore race */ }
      }
    }

    // mark seen (if message not by me) — add this client to seenBy and set status seen
    for (const m of docs) {
      if (m.data.uid !== currentUser.uid) {
        try {
          const mRef = doc(db, "cyou_messages", m.id);
          await updateDoc(mRef, { seenBy: arrayUnion(currentUser.uid), status: "seen" });
        } catch (e){ /* ignore */ }
      }
    }
  }, (err) => {
    console.error("messages subscribe error", err);
  });
}

// --- Render a message
function renderMessage(id, data){
  const div = document.createElement("div");
  const isMe = data.uid === (currentUser && currentUser.uid);
  div.className = "message " + (isMe ? "me" : "other");

  // text
  const content = document.createElement("div");
  content.textContent = data.text || "";
  div.appendChild(content);

  // meta: author/time/ticks
  const meta = document.createElement("div");
  meta.className = "meta";

  const author = document.createElement("span");
  author.textContent = isMe ? "You" : (data.name || "User");

  const time = document.createElement("span");
  time.className = "time";
  const ts = data.createdAt && data.createdAt.toDate ? data.createdAt.toDate() : new Date();
  time.textContent = `${pad(ts.getHours())}:${pad(ts.getMinutes())}`;

  meta.appendChild(author);
  meta.appendChild(document.createTextNode(" • "));
  meta.appendChild(time);

  // ticks (only show for messages I sent)
  if (isMe) {
    const ticks = document.createElement("span");
    ticks.className = "ticks";

    const seenCount = Array.isArray(data.seenBy) ? data.seenBy.length : 0;
    const deliveredCount = Array.isArray(data.deliveredBy) ? data.deliveredBy.length : 0;

    if (seenCount > 0) {
      ticks.textContent = "✔✔";
      ticks.style.color = "var(--tick-blue)";
    } else if (deliveredCount > 0) {
      ticks.textContent = "✔✔";
      ticks.style.color = "var(--tick-gray)";
    } else {
      ticks.textContent = "✔";
      ticks.style.color = "var(--tick-gray)";
    }
    meta.appendChild(document.createTextNode(" "));
    meta.appendChild(ticks);
  }

  div.appendChild(meta);
  messagesEl.appendChild(div);
}

// small pad helper
function pad(n){ return (n<10 ? "0"+n : n); }

// --- Emoji picker (simple)
const emojiList = ["😀","😁","😄","😂","😊","😍","😜","😎","🤗","🤩","😴","😢","😭","👍","👏","🙏","🔥"];
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
emojiBtn.addEventListener("click", () => {
  emojiPanel.classList.toggle("hidden");
});

// insert at cursor
function insertAtCursor(el, text) {
  const start = el.selectionStart || 0;
  const end = el.selectionEnd || 0;
  el.value = el.value.slice(0, start) + text + el.value.slice(end);
  el.selectionStart = el.selectionEnd = start + text.length;
  el.dispatchEvent(new Event('input'));
}

// done
console.log("CYOU public script loaded");