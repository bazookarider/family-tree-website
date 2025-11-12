 // script.js (module) — fixed join flow, auto-login, Firestore public chat (last-6 messages), typing, presence, ticks

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import {
  getAuth, signInAnonymously
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, serverTimestamp,
  onSnapshot, query, orderBy, limitToLast,
  doc, setDoc, updateDoc, arrayUnion, getDoc
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

/* Firebase config (kept to your project) */
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
const onlineCountEl = document.getElementById("onlineCount");

const emojiBtn = document.getElementById("emojiBtn");
const emojiPanel = document.getElementById("emojiPanel");

/* state */
let currentUser = null;
let displayName = localStorage.getItem("cyou_name") || "";
let typingTimeout = null;
let presenceInterval = null;
const HEARTBEAT_MS = 5000;
const PRESENCE_FRESH_MS = 14000;

/* prefill */
if (displayName) nameInput.value = displayName;

/* Utility */
function pad(n){ return n<10 ? "0"+n : n; }

/* Auto-join if we have a saved name */
if (displayName) {
  (async () => {
    try {
      // ensure user document exists or mark online
      const userRef = doc(db, "cyou_users", displayName);
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        await setDoc(userRef, { online: true, lastSeen: serverTimestamp() });
      } else {
        await setDoc(userRef, { online: true, lastSeen: serverTimestamp() }, { merge: true });
      }

      // sign in anonymously THEN run afterSignIn
      const cred = await signInAnonymously(auth);
      currentUser = cred.user;
      afterSignIn();
    } catch (e) {
      console.warn("Auto-join failed:", e);
    }
  })();
}

/* JOIN button: validate username and sign in */
joinBtn.addEventListener("click", async () => {
  nameError.textContent = "";
  const name = (nameInput.value || "").trim();
  if (!name) {
    nameError.textContent = "Please type a name.";
    return;
  }

  try {
    const userRef = doc(db, "cyou_users", name);
    const snap = await getDoc(userRef);

    const saved = localStorage.getItem("cyou_name");
    // if already online and not our saved name -> block
    if (snap.exists()) {
      const data = snap.data();
      if (data.online && saved !== name) {
        nameError.textContent = "Username already taken — choose another.";
        return;
      }
    }

    // accept name: save locally and write user doc
    displayName = name;
    localStorage.setItem("cyou_name", displayName);
    await setDoc(userRef, { online: true, lastSeen: serverTimestamp() }, { merge: true });

    // sign in anonymously (wait for result), then show chat
    const cred = await signInAnonymously(auth);
    currentUser = cred.user;
    afterSignIn();

  } catch (err) {
    console.error("Join error:", err);
    nameError.textContent = "Could not join — check console.";
  }
});

/* After sign-in: show chat and start listeners */
function afterSignIn(){
  // show chat UI only
  loginScreen.classList.add("hidden");
  chatApp.classList.remove("hidden");
  messageInput.disabled = false;
  messageInput.focus();

  // presence, typing, messages
  startPresence();
  subscribePresence();
  subscribeTyping();
  subscribeMessages();
}

/* PRESENCE */
async function startPresence(){
  if (!currentUser || !displayName) return;
  const presenceRef = doc(db, "cyou_presence", currentUser.uid);
  try {
    await setDoc(presenceRef, { uid: currentUser.uid, name: displayName, lastActive: serverTimestamp() });
  } catch (e) { console.warn("presence set error", e); }

  presenceInterval = setInterval(async () => {
    try { await setDoc(presenceRef, { uid: currentUser.uid, name: displayName, lastActive: serverTimestamp() }); }
    catch (e) { console.warn("presence heartbeat error", e); }
  }, HEARTBEAT_MS);

  window.addEventListener("beforeunload", async () => {
    try {
      await setDoc(doc(db, "cyou_users", displayName), { online: false, lastSeen: serverTimestamp() }, { merge: true });
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

/* TYPING */
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
      seenBy: []
    });
    // optimistic update: try set status delivered
    try { await updateDoc(ref, { status: "delivered" }); } catch(e){}
    messageInput.value = "";
    setTyping(false);
  } catch (e) {
    console.error("send error", e);
    alert("Could not send message (see console).");
  }
});

/* SUBSCRIBE MESSAGES (limit 6) + auto-scroll + mark delivered/seen */
function subscribeMessages(){
  const q = query(collection(db, "cyou_messages"), orderBy("createdAt"), limitToLast(6));
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

/* RENDER message (clear colors for other person) */
function renderMessage(id, data){
  const div = document.createElement("div");
  const isMe = data.uid === (currentUser && currentUser.uid);
  div.className = "message " + (isMe ? "me" : "other");

  const content = document.createElement("div");
  content.textContent = data.text || "";
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
  messagesEl.appendChild(div);
}

/* Emoji picker (small) */
const emojiList = ["😀","😁","😄","😂","😊","😍","😜","😎","🤗","🤩","😴","😢","😭","👍","👏","🙏","🔥"];
function buildEmojiPanel(){
  if (!emojiPanel) return;
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
if (emojiBtn) emojiBtn.addEventListener("click", () => { if (emojiPanel) emojiPanel.classList.toggle("hidden"); });

function insertAtCursor(el, text) {
  const start = el.selectionStart || 0;
  const end = el.selectionEnd || 0;
  el.value = el.value.slice(0, start) + text + el.value.slice(end);
  el.selectionStart = el.selectionEnd = start + text.length;
  el.dispatchEvent(new Event('input'));
}

console.log("CYOU fixed join flow script loaded");