import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import {
  getDatabase, ref, push, onChildAdded, onChildChanged, onValue, update, set
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-database.js";

/* ---------------- Firebase config (your project) ---------------- */
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
const db = getDatabase(app);

/* ---------------- DOM ---------------- */
const joinScreen = document.getElementById("join-screen");
const chatScreen = document.getElementById("chat-screen");
const usernameInput = document.getElementById("usernameInput");
const joinBtn = document.getElementById("joinBtn");
const joinHint = document.getElementById("joinHint");

const messagesDiv = document.getElementById("messages");
const typingIndicator = document.getElementById("typingIndicator");
const inputForm = document.getElementById("inputForm");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const receiveSound = document.getElementById("receiveSound");

/* ---------------- State ---------------- */
let username = null; // always require join first
let seenMessages = new Set();
let readyForSound = false; // avoid playing sound on initial load
let typingTimeout = null;

/* ---------------- Realtime refs ---------------- */
const messagesRef = ref(db, "messages");
const typingRef = ref(db, "typing");

/* ---------------- Join flow ---------------- */
joinBtn.addEventListener("click", () => {
  const name = (usernameInput.value || "").trim();
  if (!name || name.length < 2) { joinHint.textContent = "Enter a valid name."; return; }
  username = name;
  localStorage.setItem("cyou-username", username); // ok to remember but still show join first on next load
  joinScreen.classList.add("hidden");
  chatScreen.classList.remove("hidden");
  startListeners();
  // small delay then enable sounds for truly new incoming messages
  setTimeout(() => { readyForSound = true; }, 700);
});

/* ---------------- Sending ---------------- */
inputForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  await sendMessage();
});

sendBtn.addEventListener("click", async (e) => {
  e.preventDefault();
  await sendMessage();
});

async function sendMessage() {
  if (!username) return alert("Please join first.");
  const text = (messageInput.value || "").trim();
  if (!text) return;
  const payload = {
    sender: username,
    text,
    edited: false,
    deleted: false,
    time: Date.now()
  };
  await push(messagesRef, payload);
  messageInput.value = "";
  // update typing status false
  try { await update(typingRef, { [username]: false }); } catch (e) {}
}

/* send typing status */
messageInput.addEventListener("input", () => {
  if (!username) return;
  try { set(typingRef, { [username]: messageInput.value.length > 0 }); } catch (e) {}
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    try { set(typingRef, { [username]: false }); } catch (e) {}
  }, 1400);
});

/* ---------------- Listeners ---------------- */
function startListeners() {
  // initial existing messages will trigger onChildAdded — we will mark them and suppress sound
  onChildAdded(messagesRef, (snap) => {
    const id = snap.key;
    const data = snap.val();
    // render (new or existing)
    renderMessage(id, data);
    // mark seen
    seenMessages.add(id);
    // play sound only when it's an incoming message AND we've passed initial ready period
    if (readyForSound && data.sender !== username) {
      try { receiveSound.currentTime = 0; receiveSound.play(); } catch(e){}
    }
  });

  onChildChanged(messagesRef, (snap) => {
    const id = snap.key;
    const data = snap.val();
    renderMessage(id, data, true);
  });

  // typing indicator (show first other typer)
  onValue(typingRef, (snap) => {
    const obj = snap.val() || {};
    const typers = Object.keys(obj).filter(u => u !== username && obj[u]);
    typingIndicator.textContent = typers.length ? `${typers[0]} is typing...` : "";
  });
}

/* ---------------- Render a message ---------------- */
function renderMessage(id, m, changed = false) {
  let el = document.getElementById(id);
  const isMine = m.sender === username;

  if (!el) {
    el = document.createElement("div");
    el.id = id;
    el.className = "message " + (isMine ? "you" : "them");
    messagesDiv.appendChild(el);
    // apply show animation slightly after insert
    setTimeout(() => el.classList.add("show"), 12);
  }

  // deleted state
  if (m.deleted) {
    el.classList.add("deleted");
    el.innerHTML = `<div class="senderName">${isMine ? "You" : m.sender}</div>
                    <div class="msg-text">This message was deleted</div>`;
    // remove action buttons if any
    const act = el.querySelector(".msg-actions");
    if (act) act.remove();
    scrollToBottom();
    return;
  }

  // normal message content
  const nameLabel = `<div class="senderName">${isMine ? "You" : m.sender}</div>`;
  const editedLabel = m.edited ? `<span class="edited">(edited)</span>` : "";
  const textHtml = `<div class="msg-text">${escapeHtml(m.text || "")}${m.edited ? ' <span class="edited">(edited)</span>' : ''}</div>`;

  // actions for own messages (always visible)
  const actionsHtml = isMine ? `
    <div class="msg-actions">
      <button class="act edit" title="Edit">✏️</button>
      <button class="act del" title="Delete">🗑️</button>
    </div>` : "";

  el.innerHTML = nameLabel + textHtml + actionsHtml;

  // attach handlers if mine
  if (isMine) {
    const editBtn = el.querySelector(".act.edit");
    const delBtn = el.querySelector(".act.del");
    editBtn?.addEventListener("click", () => handleEdit(id, m));
    delBtn?.addEventListener("click", () => handleDelete(id));
  }

  scrollToBottom();
}

/* ---------------- Edit & Delete ---------------- */
async function handleEdit(id, m) {
  if (m.editCount && m.editCount >= 1) return alert("You can only edit once.");
  const newText = prompt("Edit your message:", m.text || "");
  if (newText === null) return;
  const trimmed = (newText || "").trim();
  if (!trimmed) return alert("Message cannot be empty.");
  try {
    await update(ref(db, "messages/" + id), { text: trimmed, edited: true, editCount: (m.editCount || 0) + 1, editedAt: Date.now() });
  } catch (e) { console.error(e); alert("Edit failed"); }
}

async function handleDelete(id) {
  if (!confirm("Delete this message?")) return;
  try {
    await update(ref(db, "messages/" + id), { text: "", deleted: true, deletedAt: Date.now() });
  } catch (e) { console.error(e); alert("Delete failed"); }
}

/* ---------------- Utilities ---------------- */
function scrollToBottom() {
  setTimeout(() => { messagesDiv.scrollTop = messagesDiv.scrollHeight; }, 80);
}
function escapeHtml(s = "") {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}