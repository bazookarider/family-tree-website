// script.js (module) — final CYOU with delete/edit once, dark mode, no emoji panel, no online counter
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, serverTimestamp,
  onSnapshot, query, orderBy, limitToLast,
  doc, setDoc, updateDoc, arrayUnion, getDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

/* === Firebase config (your project) === */
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

const chatApp = document.getElementById("chatApp");
const messagesEl = document.getElementById("messages");
const typingIndicator = document.getElementById("typingIndicator");
const sendForm = document.getElementById("sendForm");
const messageInput = document.getElementById("messageInput");
const themeToggle = document.getElementById("themeToggle");

/* state */
let currentUser = null;
let displayName = localStorage.getItem("cyou_name") || "";
let typingTimeout = null;
let presenceInterval = null;
const HEARTBEAT_MS = 5000;
const PRESENCE_FRESH_MS = 14000;

/* prefill name if saved */
if (displayName) nameInput.value = displayName;

/* THEME: prefer system on first load, then store choice */
const savedTheme = localStorage.getItem("cyou_theme");
const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
if (!savedTheme) {
  if (prefersDark) document.body.classList.add('dark');
} else if (savedTheme === 'dark') {
  document.body.classList.add('dark');
} // else default light
themeToggle.textContent = document.body.classList.contains('dark') ? '☀️' : '🌙';
themeToggle.addEventListener('click', () => {
  document.body.classList.toggle('dark');
  const isDark = document.body.classList.contains('dark');
  themeToggle.textContent = isDark ? '☀️' : '🌙';
  localStorage.setItem('cyou_theme', isDark ? 'dark' : 'light');
});

/* helper */
function pad(n){ return n<10 ? "0"+n : n; }

/* Auto-join if we have saved name (ensures user doc exists then sign in) */
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
        alert("Sign-in failed on auto-join: " + (err && err.message ? err.message : String(err)));
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
      alert("Could not join — signInAnonymously failed: " + (err && err.message ? err.message : String(err)));
      nameError.textContent = "Could not join — check network or Firebase settings.";
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

  // presence updates (kept backend but we don't render online list)
  startPresence();
}

/* PRESENCE (kept for ticks accuracy but not displayed) */
async function startPresence(){
  if (!currentUser || !displayName) return;
  const presenceRef = doc(db, "cyou_presence", currentUser.uid);
  try { await setDoc(presenceRef, { uid: currentUser.uid, name: displayName, lastActive: serverTimestamp() }); }
  catch (e) { console.warn("presence set error", e); }

  presenceInterval = setInterval(async () => {
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

/* SEND MESSAGE */
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
      deliveredBy: [],
      seenBy: [],
      edited: false,
      deleted: false,
      editCount: 0
    });
    try { await updateDoc(ref, { status: "delivered" }); } catch(e){}
    messageInput.value = "";
    setTyping(false);
  } catch (e) {
    console.error("send error", e);
    alert("Could not send message (see console).");
  }
});

/* SUBSCRIBE MESSAGES + auto-scroll + mark delivered/seen */
function subscribeMessages(){
  const q = query(collection(db, "cyou_messages"), orderBy("createdAt"), limitToLast(25));
  onSnapshot(q, async (snap) => {
    const docs = [];
    snap.forEach(d => docs.push({ id: d.id, data: d.data() }));
    messagesEl.innerHTML = "";
    for (const m of docs) renderMessage(m.id, m.data);

    // smooth scroll to bottom
    const lastChild = messagesEl.lastElementChild;
    if (lastChild) lastChild.scrollIntoView({ behavior: 'smooth', block: 'end' });

    // mark delivered & seen by this client (if not sender)
    for (const m of docs) {
      if (m.data.uid !== currentUser.uid) {
        try {
          const mRef = doc(db, "cyou_messages", m.id);
          await updateDoc(mRef, { deliveredBy: arrayUnion(currentUser.uid) });
          await updateDoc(mRef, { seenBy: arrayUnion(currentUser.uid) });
          await updateDoc(mRef, { status: "seen" });
        } catch (e) { /* ignore */ }
      }
    }
  }, (err) => console.error("messages subscribe error", err));
}

/* RENDER message with edit/delete UI for your messages */
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

  // content
  const content = document.createElement("div");
  content.textContent = data.text || "";
  div.appendChild(content);

  // meta
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

  // show edited label if edited
  if (data.edited) {
    const edited = document.createElement("span");
    edited.textContent = " (edited)";
    edited.style.fontStyle = "italic";
    edited.style.opacity = "0.9";
    meta.appendChild(edited);
  }

  // ticks for sender
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

  // add interaction: tap/long-press opens options for own messages (edit/delete)
  if (isMe) {
    div.style.cursor = "pointer";
    attachMessageActions(div, id, data);
  }

  messagesEl.appendChild(div);
}

/* Attach edit/delete actions: allows one edit, and delete for everyone */
function attachMessageActions(el, id, data){
  let pressTimer = null;
  const longPressMs = 500;

  function openOptions(){
    // simple prompt-based options so it works on mobile: Edit / Delete / Cancel
    const choice = prompt("Options: type EDIT to edit once, DELETE to delete for everyone, or CANCEL to close.").trim();
    if (!choice) return;
    if (choice.toLowerCase() === "delete") {
      deleteMessageConfirm(id);
    } else if (choice.toLowerCase() === "edit") {
      if (data.editCount && data.editCount >= 1) {
        alert("You can edit this message only once.");
        return;
      }
      const newText = prompt("Edit message (you can edit once):", data.text || "");
      if (newText === null) return;
      if (newText.trim() === "") { alert("Edit cancelled: cannot set empty message."); return; }
      editMessage(id, newText.trim(), (data.editCount||0) + 1);
    }
  }

  // long-press (touch) support
  el.addEventListener("touchstart", (e) => {
    pressTimer = window.setTimeout(openOptions, longPressMs);
  });
  el.addEventListener("touchend", (e) => {
    if (pressTimer) clearTimeout(pressTimer);
  });
  // click fallback (desktop)
  el.addEventListener("click", (e) => {
    // small delay to avoid accidental open on quick taps
    // quick tap = ignore, double-tap could be used; we open options on single click for accessibility
    openOptions();
  });
}

/* delete message (mark deleted for everyone) */
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

/* edit message once */
async function editMessage(id, newText, newEditCount){
  try {
    const mRef = doc(db, "cyou_messages", id);
    await updateDoc(mRef, { text: newText, edited: true, editCount: newEditCount });
  } catch (e) {
    console.error("edit error", e);
    alert("Could not edit message.");
  }
}

/* Emoji removed: we do not build or show emoji panel (user requested) */

/* helper insertAtCursor kept for future (unused now) */
function insertAtCursor(el, text) {
  const start = el.selectionStart || 0;
  const end = el.selectionEnd || 0;
  el.value = el.value.slice(0, start) + text + el.value.slice(end);
  el.selectionStart = el.selectionEnd = start + text.length;
  el.dispatchEvent(new Event('input'));
}

console.log("CYOU final upgraded script loaded");