// script.js (final anonymous + unique nickname, auto-login, typing in header)
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import {
  getAuth, signInAnonymously, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, serverTimestamp,
  onSnapshot, query, orderBy, doc, setDoc, getDoc, updateDoc, arrayUnion
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

/* ---------------------------
   Firebase config (kept)
---------------------------- */
const firebaseConfig = {
  apiKey: "AIzaSyDJFQnwOs-fetKVy0Ow43vktz8xwefZMks",
  authDomain: "cyou-db8f0.firebaseapp.com",
  databaseURL: "https://cyou-db8f0-default-rtdb.firebaseio.com",
  projectId: "cyou-db8f0",
  storageBucket: "cyou-db8f0.firebasestorage.app",
  messagingSenderId: "873569975141",
  appId: "1:873569975141:web:147eb7b7b4043a38c9bf8c",
  measurementId: "G-T66B50HFJ8"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* ---------------------------
   DOM elements
---------------------------- */
const joinSection = document.getElementById("joinSection");
const chatSection = document.getElementById("chatSection");
const nameInput = document.getElementById("nameInput");
const enterBtn = document.getElementById("enterBtn");
const joinHint = document.getElementById("joinHint");

const messagesDiv = document.getElementById("messages");
const typingStatus = document.getElementById("typingStatus");
const onlineCount = document.getElementById("onlineCount");
const onlineUsersUL = document.getElementById("onlineUsers");

const sendForm = document.getElementById("sendForm");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const themeToggle = document.getElementById("themeToggle");
const clearChatBtn = document.getElementById("clearChatBtn");

/* ---------------------------
   state
---------------------------- */
let username = localStorage.getItem("cyou_username") || "";
let typingTimeout = null;
let messagesUnsub = null;
let presenceUnsub = null;
let typingUnsub = null;

/* ---------------------------
   Auth (anonymous)
---------------------------- */
signInAnonymously(auth);
onAuthStateChanged(auth, (user) => {
  if (user) console.log("Signed in anonymously:", user.uid);
});

/* ---------------------------
   Theme restore
---------------------------- */
const savedTheme = localStorage.getItem("cyou_theme") || "light";
applyTheme(savedTheme);
themeToggle?.addEventListener("click", () => {
  const current = document.body.classList.contains("dark") ? "dark" : "light";
  const next = current === "dark" ? "light" : "dark";
  applyTheme(next);
  localStorage.setItem("cyou_theme", next);
});
function applyTheme(t) {
  if (t === "dark") document.body.classList.add("dark");
  else document.body.classList.remove("dark");
}

/* ---------------------------
   Auto-join if saved nickname
---------------------------- */
if (username) {
  // try to auto-join; but check presence doc to prevent duplicate online nickname
  (async () => {
    try {
      const presRef = doc(db, "cyou_presence", username);
      const presSnap = await getDoc(presRef);
      if (presSnap.exists() && presSnap.data()?.online) {
        // presence already online elsewhere -> require fresh join
        username = "";
        localStorage.removeItem("cyou_username");
        joinSection.style.display = "flex";
        chatSection.style.display = "none";
        joinHint.textContent = "Saved nickname is currently online elsewhere. Enter a different one.";
      } else {
        // proceed auto-join
        joinSection.style.display = "none";
        chatSection.style.display = "flex";
        await setDoc(presRef, { online: true, lastSeen: serverTimestamp() }, { merge: true });
        startPresenceListener();
        startTypingListener();
        startMessagesListener();
      }
    } catch (e) {
      console.error("Auto-join error", e);
      // fallback to join screen
      joinSection.style.display = "flex";
      chatSection.style.display = "none";
    }
  })();
} else {
  joinSection.style.display = "flex";
  chatSection.style.display = "none";
}

/* ---------------------------
   Join flow (unique nickname check)
---------------------------- */
enterBtn.addEventListener("click", async () => {
  const name = nameInput.value.trim();
  if (!name) { joinHint.textContent = "Enter a nickname first."; return; }
  try {
    const presRef = doc(db, "cyou_presence", name);
    const presSnap = await getDoc(presRef);
    if (presSnap.exists() && presSnap.data()?.online) {
      joinHint.textContent = "⚠️ That nickname is already online. Choose another.";
      return;
    }
    // success: set username and persist locally
    username = name;
    localStorage.setItem("cyou_username", username);
    joinHint.textContent = "";
    joinSection.style.display = "none";
    chatSection.style.display = "flex";

    await setDoc(presRef, { online: true, lastSeen: serverTimestamp() }, { merge: true });
    startPresenceListener();
    startTypingListener();
    startMessagesListener();
  } catch (err) {
    console.error("Join error", err);
    joinHint.textContent = "Error joining. Check console.";
  }
});

/* ---------------------------
   Presence: update UI list and count
---------------------------- */
function startPresenceListener() {
  if (presenceUnsub) presenceUnsub();
  presenceUnsub = onSnapshot(collection(db, "cyou_presence"), (snap) => {
    const users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const online = users.filter(u => u.online).length;
    onlineCount.textContent = online;

    onlineUsersUL.innerHTML = "";
    users.forEach(u => {
      const li = document.createElement("li");
      const left = document.createElement("div"); left.style.display = "flex"; left.style.gap = "8px"; left.style.alignItems = "center";
      const dot = document.createElement("span"); dot.style.width = "10px"; dot.style.height = "10px"; dot.style.borderRadius = "50%";
      dot.style.background = u.online ? "#00b894" : "#bbb";
      const nameSpan = document.createElement("span"); nameSpan.textContent = u.id;
      left.appendChild(dot); left.appendChild(nameSpan);
      const right = document.createElement("div"); right.style.fontSize = "0.8rem";
      if (u.online) right.textContent = "🟢 Online";
      else if (u.lastSeen && u.lastSeen.toDate) right.textContent = `Last ${u.lastSeen.toDate().toLocaleString()}`;
      li.appendChild(left); li.appendChild(right);
      onlineUsersUL.appendChild(li);
    });
  });

  // mark offline when unloading
  window.addEventListener("beforeunload", async () => {
    if (!username) return;
    try {
      await setDoc(doc(db, "cyou_presence", username), { online: false, lastSeen: serverTimestamp() }, { merge: true });
      await setDoc(doc(db, "cyou_typing", username), { typing: false }, { merge: true });
    } catch (e) {}
  });
}

/* ---------------------------
   Typing indicator (header) - show "John's typing..."
---------------------------- */
messageInput.addEventListener("input", onTypingInput);
async function onTypingInput() {
  await setTyping(true);
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => setTyping(false), 1400);
}
async function setTyping(state) {
  if (!username) return;
  try {
    await setDoc(doc(db, "cyou_typing", username), { typing: state }, { merge: true });
  } catch (err) { console.error("setTyping err", err); }
}

function startTypingListener() {
  if (typingUnsub) typingUnsub();
  typingUnsub = onSnapshot(collection(db, "cyou_typing"), (snap) => {
    const typers = snap.docs.filter(d => d.id !== username && d.data().typing).map(d => d.id);
    if (typers.length) {
      const first = typers[0];
      typingStatus.textContent = `${first}'s typing...`;
    } else {
      typingStatus.textContent = "";
    }
  });
}

/* ---------------------------
   Messages: send, render, soft-delete, ticks
---------------------------- */
const messagesCol = collection(db, "cyou_messages");

sendForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  await doSend();
});
sendBtn?.addEventListener("click", async (e) => { e.preventDefault(); await doSend(); });

async function doSend() {
  if (!username) { alert("Please join first."); return; }
  const text = (messageInput.value || "").trim();
  if (!text) return;
  try {
    const docRef = await addDoc(messagesCol, {
      sender: username,
      text,
      createdAt: serverTimestamp(),
      delivered: false,
      deleted: false,
      seenBy: [username]
    });
    messageInput.value = "";
    await setTyping(false);
    // scroll shortly after send
    setTimeout(scrollToBottom, 120);
  } catch (err) {
    console.error("Send error", err);
  }
}

function startMessagesListener() {
  if (messagesUnsub) messagesUnsub();
  const q = query(messagesCol, orderBy("createdAt"));
  messagesUnsub = onSnapshot(q, async (snap) => {
    messagesDiv.innerHTML = "";
    const docs = snap.docs;

    // render messages grouped by date (small helper)
    let lastDate = null;
    for (const docSnap of docs) {
      const m = docSnap.data();
      const id = docSnap.id;
      const created = m.createdAt?.toDate ? m.createdAt.toDate() : new Date();
      const dateKey = created.toDateString();
      if (dateKey !== lastDate) {
        const sep = document.createElement("div"); sep.className = "date-sep"; const today = new Date(); const yesterday = new Date(); yesterday.setDate(today.getDate()-1);
        if (created.toDateString() === today.toDateString()) sep.textContent = "Today";
        else if (created.toDateString() === yesterday.toDateString()) sep.textContent = "Yesterday";
        else sep.textContent = created.toLocaleDateString();
        messagesDiv.appendChild(sep);
        lastDate = dateKey;
      }

      const isMine = m.sender === username;
      const wrapper = document.createElement("div");
      wrapper.className = "message " + (isMine ? "me" : "other");

      if (m.deleted) {
        wrapper.innerHTML = `<div class="deleted">⚫ This message was deleted</div><div class="meta">${formatTime(created)}</div>`;
      } else {
        const body = document.createElement("div"); body.className = "msg-body"; body.textContent = m.text;
        const meta = document.createElement("div"); meta.className = "meta";
        if (isMine) {
          const ts = document.createElement("span"); ts.textContent = formatTime(created);
          const tick = document.createElement("span"); tick.className = "tick" + (m.delivered ? " delivered" : "");
          tick.textContent = m.delivered ? "✓✓" : "✓";
          meta.appendChild(ts); meta.appendChild(tick);
        } else {
          meta.textContent = formatTime(created);
        }
        wrapper.appendChild(body);
        wrapper.appendChild(meta);

        // delete button for sender only
        if (isMine && !m.deleted) {
          const actions = document.createElement("div"); actions.className = "msg-actions";
          const delBtn = document.createElement("button"); delBtn.className = "msg-btn"; delBtn.title = "Delete message"; delBtn.innerText = "🗑️";
          delBtn.addEventListener("click", () => confirmDelete(id));
          actions.appendChild(delBtn);
          wrapper.appendChild(actions);
        }
      }

      messagesDiv.appendChild(wrapper);
    }

    // mark seenBy and delivered by this client for others' messages
    for (const docSnap of docs) {
      const m = docSnap.data();
      const id = docSnap.id;
      if (m.sender !== username) {
        if (!m.seenBy || !m.seenBy.includes(username)) {
          try { await updateDoc(doc(db, "cyou_messages", id), { seenBy: arrayUnion(username) }); } catch (e) {}
        }
        if (!m.delivered) {
          try { await updateDoc(doc(db, "cyou_messages", id), { delivered: true }); } catch (e) {}
        }
      }
    }

    scrollToBottom();
  });
}

/* soft-delete */
async function confirmDelete(msgId) {
  if (!confirm("Delete this message?")) return;
  try {
    await updateDoc(doc(db, "cyou_messages", msgId), { deleted: true, text: "", deletedAt: serverTimestamp() });
  } catch (err) { console.error("Delete error", err); }
}

/* helpers */
function formatTime(d) { return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
function scrollToBottom() { const last = messagesDiv.lastElementChild; if (last) last.scrollIntoView({ behavior: "smooth", block: "end" }); }

/* clear local chat */
clearChatBtn?.addEventListener("click", () => {
  if (!confirm("Clear local chat view? This will not delete server messages.")) return;
  messagesDiv.innerHTML = "";
});

/* ensure input visible on mobile keyboard */
messageInput?.addEventListener("focus", () => setTimeout(scrollToBottom, 300));
messageInput?.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendBtn?.click(); }});