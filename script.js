 // script.js - Final v3.1
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import {
  getAuth, signInAnonymously, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, serverTimestamp,
  onSnapshot, query, orderBy, doc, setDoc, getDoc, updateDoc, arrayUnion, arrayRemove
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

/* ---------------------------
   Firebase Config (unchanged)
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
   DOM
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
   State
---------------------------- */
let username = "";
let typingTimeout = null;
let presenceUnsub = null;
let messagesUnsub = null;
let typingUnsub = null;

/* ---------------------------
   Auth (anonymous)
---------------------------- */
signInAnonymously(auth);
onAuthStateChanged(auth, (user) => {
  if (user) console.log("Signed in anon uid:", user.uid);
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
   Auto-login if saved name
---------------------------- */
const savedName = localStorage.getItem("cyou_username");
if (savedName) {
  attemptJoin(savedName, true);
}

/* ---------------------------
   Join logic (prevent duplicate online name)
---------------------------- */
enterBtn.addEventListener("click", async () => {
  const name = nameInput.value.trim();
  if (!name) { joinHint.textContent = "Enter a name first."; return; }
  attemptJoin(name, false);
});

async function attemptJoin(name, isAuto) {
  try {
    const presRef = doc(db, "cyou_presence", name);
    const presSnap = await getDoc(presRef);
    if (presSnap.exists() && presSnap.data()?.online) {
      if (!isAuto) {
        joinHint.textContent = "⚠️ This name is already online. Choose another.";
        return;
      } else {
        joinHint.textContent = "Saved name is currently online elsewhere. Enter a different name.";
        return;
      }
    }

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
    joinHint.textContent = "Error joining (see console).";
  }
}

/* ---------------------------
   Presence listener
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
      const dot = document.createElement("span"); dot.style.width = "10px"; dot.style.height = "10px"; dot.style.borderRadius = "50%"; dot.style.background = u.online ? "#00b894" : "#bbb";
      const nameSpan = document.createElement("span"); nameSpan.textContent = u.id;
      left.appendChild(dot); left.appendChild(nameSpan);
      const right = document.createElement("div"); right.style.fontSize = "0.8rem";
      if (u.online) right.textContent = "🟢 Online";
      else if (u.lastSeen && u.lastSeen.toDate) right.textContent = `Last ${u.lastSeen.toDate().toLocaleString()}`;
      li.appendChild(left); li.appendChild(right);
      onlineUsersUL.appendChild(li);
    });
  });

  window.addEventListener("beforeunload", async () => {
    if (!username) return;
    try {
      await setDoc(doc(db, "cyou_presence", username), { online: false, lastSeen: serverTimestamp() }, { merge: true });
      await setDoc(doc(db, "cyou_typing", username), { typing: false }, { merge: true });
    } catch (e) {}
  });
}

/* ---------------------------
   Typing indicator (shows "John's typing..." in header)
---------------------------- */
messageInput.addEventListener("input", onTypeInput);
async function onTypeInput() {
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
    const typers = snap.docs
      .filter(d => d.id !== username && d.data().typing)
      .map(d => d.id);

    // Show only first typer (as requested: "John's typing...")
    if (typers.length) {
      const first = typers[0];
      typingStatus.textContent = `${first}'s typing...`;
    } else {
      typingStatus.textContent = "";
    }
  });
}

/* ---------------------------
   Messages: send, render, delivered ticks, delete (soft)
---------------------------- */
const messagesCol = collection(db, "cyou_messages");

sendForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  await sendMessage();
});
sendBtn?.addEventListener("click", async (e) => { e.preventDefault(); await sendMessage(); });

async function sendMessage() {
  if (!username) { alert("Please join first."); return; }
  const text = (messageInput.value || "").trim();
  if (!text) return;

  try {
    // add message: include sender, createdAt, delivered:false, seenBy array (sender included)
    await addDoc(messagesCol, {
      sender: username,
      text,
      createdAt: serverTimestamp(),
      delivered: false,
      deleted: false,
      seenBy: [username]
    });
    messageInput.value = "";
    await setTyping(false);
  } catch (err) {
    console.error("sendMessage err", err);
  }
}

/* Render messages, group by date, mark delivered when read by other clients */
function startMessagesListener() {
  if (messagesUnsub) messagesUnsub();
  const q = query(messagesCol, orderBy("createdAt"));
  messagesUnsub = onSnapshot(q, async (snap) => {
    messagesDiv.innerHTML = "";
    const docs = snap.docs;

    // Build and render grouped by date
    let lastDate = null;
    for (const docSnap of docs) {
      const m = docSnap.data();
      const id = docSnap.id;
      const created = m.createdAt?.toDate ? m.createdAt.toDate() : new Date();
      const dateKey = created.toDateString();
      if (dateKey !== lastDate) {
        const sep = document.createElement("div");
        sep.className = "date-sep";
        const today = new Date();
        const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
        if (created.toDateString() === today.toDateString()) sep.textContent = "Today";
        else if (created.toDateString() === yesterday.toDateString()) sep.textContent = "Yesterday";
        else sep.textContent = created.toLocaleDateString();
        messagesDiv.appendChild(sep);
        lastDate = dateKey;
      }

      // render bubble WITHOUT showing sender name in bubble (per final request)
      const isMine = m.sender === username;
      const wrapper = document.createElement("div");
      wrapper.className = "message " + (isMine ? "me" : "other");

      if (m.deleted) {
        wrapper.innerHTML = `<div class="deleted">⚫ This message was deleted</div>
                             <div class="meta">${formatTime(created)}</div>`;
      } else {
        const body = document.createElement("div");
        body.className = "msg-body";
        body.textContent = m.text;
        const meta = document.createElement("div");
        meta.className = "meta";
        // if mine: show tick (single ✓ for sent, ✓✓ for delivered)
        if (isMine) {
          const timeSpan = document.createElement("span"); timeSpan.textContent = formatTime(created);
          const tick = document.createElement("span"); tick.className = "tick" + (m.delivered ? " delivered" : "");
          tick.textContent = m.delivered ? "✓✓" : "✓";
          meta.appendChild(timeSpan); meta.appendChild(tick);
        } else {
          meta.textContent = formatTime(created);
        }
        wrapper.appendChild(body);
        wrapper.appendChild(meta);

        // add delete button for sender only
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

    // Mark unread messages as seen and mark delivered for others' messages
    for (const docSnap of docs) {
      const m = docSnap.data();
      const id = docSnap.id;
      // If message isn't from me and my username not in seenBy -> add me to seenBy
      if (m.sender !== username && (!m.seenBy || !m.seenBy.includes(username))) {
        try {
          await updateDoc(doc(db, "cyou_messages", id), { seenBy: arrayUnion(username) });
        } catch (e) {}
      }
      // If message not from me and not delivered -> mark delivered true so sender sees ✓✓
      if (m.sender !== username && !m.delivered) {
        try {
          await updateDoc(doc(db, "cyou_messages", id), { delivered: true });
        } catch (e) {}
      }
    }

    // scroll
    scrollToBottom();
  });
}

/* delete (soft) */
async function confirmDelete(messageId) {
  if (!confirm("Delete this message?")) return;
  try {
    await updateDoc(doc(db, "cyou_messages", messageId), {
      deleted: true,
      text: "",
      deletedAt: serverTimestamp()
    });
  } catch (err) {
    console.error("delete error", err);
  }
}

/* ---------------------------
   Utilities & helpers
---------------------------- */
function formatTime(d) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function scrollToBottom() {
  const last = messagesDiv.lastElementChild;
  if (last) last.scrollIntoView({ behavior: "smooth", block: "end" });
}

/* Clear local chat view only */
clearChatBtn?.addEventListener("click", () => {
  if (!confirm("Clear local chat view? This won't delete server messages.")) return;
  messagesDiv.innerHTML = "";
});

/* start typing listener after join */
function startTypingListener() {
  // already defined earlier; ensure it's called
  startTypingListener = startTypingListener; // no-op to satisfy linter style
}

/* ensure startTypingListener function reference used above */
startTypingListener = startTypingListener || (() => {});

/* Start typing listener function properly (we already defined above startTypingListener via function declaration) */

/* Focus input behavior for mobile keyboard */
messageInput?.addEventListener("focus", () => setTimeout(scrollToBottom, 250));
messageInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendBtn.click(); }
});