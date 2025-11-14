 // script.js (module)
// CYOU: final stable build with robust join flow and clearer mobile error messages
// Features: edit once, delete-for-all, reply (WhatsApp style), copy, seen timestamps, dark mode, typing indicator.
// Uses Firestore. Keep Firestore rules in test mode while developing.

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, serverTimestamp,
  onSnapshot, query, orderBy, limitToLast,
  doc, setDoc, updateDoc, arrayUnion, getDoc
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

/* --- firebase config (your project) --- */
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
const loginScreen = document.getElementById("loginScreen");
const nameInput = document.getElementById("nameInput");
const nameError = document.getElementById("nameError");
const joinBtn = document.getElementById("joinBtn");
const envHint = document.getElementById("envHint");

const chatApp = document.getElementById("chatApp");
const messagesEl = document.getElementById("messages");
const typingIndicator = document.getElementById("typingIndicator");
const sendForm = document.getElementById("sendForm");
const messageInput = document.getElementById("messageInput");
const themeToggle = document.getElementById("themeToggle");

const replyPreview = document.getElementById("replyPreview");
const replyName = document.getElementById("replyName");
const replyText = document.getElementById("replyText");
const cancelReply = document.getElementById("cancelReply");

/* state */
let currentUser = null;
let displayName = localStorage.getItem("cyou_name") || "";
let typingTimeout = null;
let replyTo = null; // {id, name, text}
const HEARTBEAT_MS = 5000;

/* prefill name */
if (displayName) nameInput.value = displayName;

/* Environment hint: HTTPS required on many browsers for auth */
if (window.location.protocol !== 'https:' && !location.hostname.match(/localhost|127.0.0.1/)) {
  envHint.textContent = "⚠️ Warning: site is not served over HTTPS — sign-in may fail in Chrome. Use your HTTPS-hosted link.";
}

/* theme init */
const savedTheme = localStorage.getItem("cyou_theme");
const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
if (!savedTheme) {
  if (prefersDark) document.body.classList.add('dark');
} else if (savedTheme === 'dark') {
  document.body.classList.add('dark');
}
themeToggle.textContent = document.body.classList.contains('dark') ? '☀️' : '🌙';
themeToggle.addEventListener('click', () => {
  document.body.classList.toggle('dark');
  const isDark = document.body.classList.contains('dark');
  themeToggle.textContent = isDark ? '☀️' : '🌙';
  localStorage.setItem('cyou_theme', isDark ? 'dark' : 'light');
});

/* helper */
function pad(n){ return n<10 ? "0"+n : n; }
function safeText(t){ return (t || "").toString(); }

/* Auto-join if name saved */
if (displayName) {
  (async () => {
    try {
      const userRef = doc(db, "cyou_users", displayName);
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        await setDoc(userRef, { online: true, lastSeen: serverTimestamp() });
      } else {
        await setDoc(userRef, { online: true, lastSeen: serverTimestamp() }, { merge: true });
      }
      try {
        const cred = await signInAnonymously(auth);
        currentUser = cred.user;
        afterSignIn();
      } catch (err) {
        alert("Sign-in failed on auto-join: [" + (err.code||"no-code") + "] " + (err.message||String(err)));
        console.error("Auto sign-in error:", err);
      }
    } catch (e) { console.warn("Auto-join setup error:", e); }
  })();
}

/* JOIN flow */
joinBtn.addEventListener("click", async () => {
  nameError.textContent = "";
  const name = (nameInput.value || "").trim();
  if (!name) { nameError.textContent = "Please type a name."; return; }

  try {
    const userRef = doc(db, "cyou_users", name);
    const snap = await getDoc(userRef);
    const saved = localStorage.getItem("cyou_name");
    if (snap.exists()) {
      const data = snap.data();
      if (data.online && saved !== name) {
        nameError.textContent = "Username already taken — choose another.";
        return;
      }
    }

    displayName = name;
    localStorage.setItem("cyou_name", displayName);
    await setDoc(userRef, { online: true, lastSeen: serverTimestamp() }, { merge: true });

    try {
      const cred = await signInAnonymously(auth);
      currentUser = cred.user;
      afterSignIn();
    } catch (err) {
      console.error("Sign-in error:", err);
      // show mobile-friendly alert with code + message
      alert("Sign-in failed: [" + (err.code||"no-code") + "] " + (err.message||String(err)) + "\n\nCheck: Anonymous sign-in enabled, Firestore rules, and Authorized domains.");
      nameError.textContent = "Could not join — check console / alerts for details.";
    }
  } catch (err) {
    console.error("Join error:", err);
    alert("Could not join — unexpected error: " + (err && err.message ? err.message : String(err)));
  }
});

/* After sign-in: show chat and start listeners */
function afterSignIn(){
  loginScreen.classList.add("hidden");
  chatApp.classList.remove("hidden");
  messageInput.disabled = false;
  messageInput.focus();

  subscribeTyping();
  subscribeMessages();
  startPresence(); // presence used internally for ticks/lastSeen
}

/* PRESENCE (internal only, not displayed) */
async function startPresence(){
  if (!currentUser || !displayName) return;
  const presenceRef = doc(db, "cyou_presence", currentUser.uid);
  try { await setDoc(presenceRef, { uid: currentUser.uid, name: displayName, lastActive: serverTimestamp() }); }
  catch (e) { console.warn("presence set error", e); }

  setInterval(async () => {
    try { await setDoc(presenceRef, { uid: currentUser.uid, name: displayName, lastActive: serverTimestamp() }); }
    catch (e) { console.warn("presence heartbeat error", e); }
  }, HEARTBEAT_MS);

  window.addEventListener("beforeunload", async () => {
    try { await setDoc(doc(db, "cyou_users", displayName), { online: false, lastSeen: serverTimestamp() }, { merge: true }); }
    catch (e) {}
  });
}

/* TYPING indicator */
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

/* SEND (supports replyTo) */
sendForm.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const text = (messageInput.value || "").trim();
  if (!text || !currentUser) return;

  // if editing (editId stored globally)
  const editId = window._cyou_editId || null;
  if (editId) {
    try {
      const mRef = doc(db, "cyou_messages", editId);
      const mSnap = await getDoc(mRef);
      if (!mSnap.exists()) { alert("Message not found for edit."); window._cyou_editId = null; return; }
      const md = mSnap.data();
      if (md.editCount && md.editCount >= 1) { alert("You can edit only once."); window._cyou_editId = null; return; }
      await updateDoc(mRef, { text, edited: true, editCount: (md.editCount||0) + 1, editedAt: serverTimestamp() });
      window._cyou_editId = null;
      messageInput.value = "";
      return;
    } catch (err) {
      console.error("edit save error", err);
      alert("Could not save edit.");
      return;
    }
  }

  const payload = {
    text,
    name: displayName,
    uid: currentUser.uid,
    createdAt: serverTimestamp(),
    deliveredBy: [],
    seenBy: [],
    seenAt: {},
    edited: false,
    deleted: false,
    editCount: 0,
    replyTo: replyTo ? { id: replyTo.id, name: replyTo.name, text: replyTo.text } : null
  };

  try {
    const ref = await addDoc(collection(db, "cyou_messages"), payload);
    try { await updateDoc(ref, { status: "delivered" }); } catch(e){}
    messageInput.value = "";
    clearReply();
    setTyping(false);
  } catch (e) {
    console.error("send error", e);
    alert("Could not send message (see console).");
  }
});

/* SUBSCRIBE MESSAGES */
function subscribeMessages(){
  const q = query(collection(db, "cyou_messages"), orderBy("createdAt"), limitToLast(50));
  onSnapshot(q, async (snap) => {
    const docs = [];
    snap.forEach(d => docs.push({ id: d.id, data: d.data() }));
    messagesEl.innerHTML = "";
    for (const m of docs) renderMessage(m.id, m.data);

    // auto-scroll to bottom
    const lastChild = messagesEl.lastElementChild;
    if (lastChild) lastChild.scrollIntoView({ behavior: 'smooth', block: 'end' });

    // mark delivered & seen by this client (if not sender)
    for (const m of docs) {
      if (m.data.uid !== currentUser.uid) {
        try {
          const mRef = doc(db, "cyou_messages", m.id);
          await updateDoc(mRef, { deliveredBy: arrayUnion(currentUser.uid) });
          const field = `seenAt.${currentUser.uid}`;
          await updateDoc(mRef, { seenBy: arrayUnion(currentUser.uid), [field]: serverTimestamp(), status: "seen" });
        } catch (e) { /* ignore concurrency errors */ }
      }
    }
  }, (err) => console.error("messages subscribe error", err));
}

/* RENDER message */
function renderMessage(id, data){
  const div = document.createElement("div");
  const isMe = data.uid === (currentUser && currentUser.uid);

  if (data.deleted) {
    div.className = "message deleted";
    div.textContent = "This message was deleted.";
    messagesEl.appendChild(div);
    return;
  }

  div.className = "message " + (isMe ? "me" : "other");
  div.tabIndex = 0;

  // quoted reply
  if (data.replyTo && data.replyTo.name) {
    const quote = document.createElement("div");
    quote.className = "quote";
    quote.style.fontSize = "13px";
    quote.style.opacity = "0.9";
    quote.style.marginBottom = "6px";
    quote.textContent = `${data.replyTo.name}: ${safeText(data.replyTo.text).slice(0,120)}`;
    div.appendChild(quote);
  }

  const content = document.createElement("div");
  content.textContent = safeText(data.text);
  div.appendChild(content);

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

  if (data.edited) {
    const edited = document.createElement("span");
    edited.className = "edited";
    edited.textContent = " (edited)";
    meta.appendChild(edited);
  }

  if (isMe) {
    const ticks = document.createElement("span");
    ticks.className = "ticks";
    const seenCount = Array.isArray(data.seenBy) ? data.seenBy.length : 0;
    const deliveredCount = Array.isArray(data.deliveredBy) ? data.deliveredBy.length : 0;
    if (seenCount > 0) { ticks.textContent = "✔✔"; ticks.style.color = "var(--tick-blue)"; }
    else if (deliveredCount > 0) { ticks.textContent = "✔✔"; ticks.style.color = "var(--tick-gray)"; }
    else { ticks.textContent = "✔"; ticks.style.color = "var(--tick-gray)"; }
    meta.appendChild(document.createTextNode(" "));
    meta.appendChild(ticks);
  }

  div.appendChild(meta);

  // actions for own messages
  if (isMe) {
    const actions = document.createElement("div");
    actions.className = "msg-actions";

    // edit
    const editBtn = document.createElement("button");
    editBtn.title = "Edit (once)";
    editBtn.innerHTML = "✏️";
    editBtn.className = "icon-btn";
    editBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (data.editCount && data.editCount >= 1) { alert("You can edit only once."); return; }
      messageInput.focus();
      messageInput.value = data.text || "";
      replyTo = null;
      showReply();
      window._cyou_editId = id;
      alert("Edit mode: change message in input and press Send. You can edit only once.");
    });
    actions.appendChild(editBtn);

    // delete
    const delBtn = document.createElement("button");
    delBtn.title = "Delete for everyone";
    delBtn.innerHTML = "🗑️";
    delBtn.className = "icon-btn";
    delBtn.addEventListener("click", (e) => { e.stopPropagation(); deleteMessageConfirm(id); });
    actions.appendChild(delBtn);

    // copy
    const copyBtn = document.createElement("button");
    copyBtn.title = "Copy message";
    copyBtn.innerHTML = "📋";
    copyBtn.className = "icon-btn";
    copyBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      navigator.clipboard?.writeText(data.text || "")?.then(() => alert("Copied to clipboard")).catch(() => alert("Copy failed"));
    });
    actions.appendChild(copyBtn);

    // seen info
    const seenBtn = document.createElement("button");
    seenBtn.title = "Seen info";
    seenBtn.innerHTML = "👁️";
    seenBtn.className = "icon-btn";
    seenBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      try {
        const mRef = doc(db, "cyou_messages", id);
        const mSnap = await getDoc(mRef);
        if (!mSnap.exists()) { alert("No message info"); return; }
        const md = mSnap.data();
        const seenAt = md.seenAt || {};
        const keys = Object.keys(seenAt);
        if (keys.length === 0) { alert("No one has read this yet."); return; }
        const lines = keys.map(k => {
          const t = seenAt[k];
          const when = t && t.toDate ? t.toDate() : new Date();
          return `${k} at ${pad(when.getHours())}:${pad(when.getMinutes())}`;
        }).join("\n");
        alert("Seen by:\n" + lines);
      } catch (err) {
        console.error("seen info error", err);
        alert("Failed to fetch seen info");
      }
    });
    actions.appendChild(seenBtn);

    div.appendChild(actions);
  } else {
    // clicking other's message => set reply
    div.addEventListener("click", () => {
      replyTo = { id, name: data.name || "User", text: data.text || "" };
      showReply();
      messageInput.focus();
    });
    // long-press copy (context menu) fallback
    div.addEventListener("contextmenu", (e) => { e.preventDefault(); navigator.clipboard?.writeText(data.text||"")?.then(()=>alert("Copied")); });
  }

  messagesEl.appendChild(div);
}

/* delete message */
async function deleteMessageConfirm(id){
  if (!confirm("Delete this message for everyone?")) return;
  try {
    const mRef = doc(db, "cyou_messages", id);
    await updateDoc(mRef, { deleted: true, text: "", status: "deleted" });
  } catch (e) {
    console.error("delete error", e);
    alert("Could not delete message.");
  }
}

/* reply preview helpers */
function clearReply(){
  replyTo = null;
  showReply();
}
function showReply(){
  if (!replyTo) {
    replyPreview.classList.add("hidden-el");
    replyName.textContent = "";
    replyText.textContent = "";
  } else {
    replyPreview.classList.remove("hidden-el");
    replyName.textContent = replyTo.name + " ·";
    replyText.textContent = " " + (replyTo.text || "").slice(0,120);
  }
}
cancelReply?.addEventListener?.("click", (e) => { e.preventDefault(); clearReply(); });

/* helper insertAtCursor (kept for future) */
function insertAtCursor(el, text) {
  const start = el.selectionStart || 0;
  const end = el.selectionEnd || 0;
  el.value = el.value.slice(0, start) + text + el.value.slice(end);
  el.selectionStart = el.selectionEnd = start + text.length;
  el.dispatchEvent(new Event('input'));
}

console.log("CYOU final stable script loaded");

/* ---------------------------------------------------------
  PRIVATE CHAT NOTE (how to implement without changing Firebase setup)
  - Use a unique path for each private room, e.g.:
      /private_chats/{roomId}/messages
    where roomId could be a deterministic string like "alice_bob" (sorted usernames)
  - When user selects "Private", create or join that room and subscribe the same way
  - No change to Realtime/Firestore rules required if auth & rules already permit
--------------------------------------------------------- */