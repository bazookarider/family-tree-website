// script.js - CYOU Chat upgraded (global room, ticks simple mode, reactions, pin, forward, reply swipe, timestamps, presence, smart autoscroll)
// Uses Firebase Realtime Database modular SDK v12.5.0

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import {
  getDatabase, ref, push, onChildAdded, onChildChanged, onValue, update, set, get, remove
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-database.js";

/* ----------------- Firebase config (your project) ----------------- */
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

let app;
try {
  app = initializeApp(firebaseConfig);
} catch (e) {
  console.error("Firebase init error:", e);
  document.addEventListener("DOMContentLoaded", () => {
    const joinHint = document.getElementById("joinHint");
    if (joinHint) joinHint.textContent = "Firebase initialization failed — check network or use a server (Chrome file:// blocks modules).";
  });
  throw e;
}

const db = getDatabase(app);

/* ----------------- DOM ----------------- */
const joinScreen = document.getElementById("join-screen");
const chatScreen = document.getElementById("chat-screen");
const usernameInput = document.getElementById("usernameInput");
const joinBtn = document.getElementById("joinBtn");
const joinHint = document.getElementById("joinHint");

const messagesDiv = document.getElementById("messages");
const pinnedArea = document.getElementById("pinnedArea");
const scrollDownBtn = document.getElementById("scrollDownBtn");
const typingIndicator = document.getElementById("typingIndicator");
const inputForm = document.getElementById("inputForm");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const receiveSound = document.getElementById("receiveSound");
const presenceSummary = document.getElementById("presenceSummary");
const replyPreview = document.getElementById("replyPreview");

/* ----------------- State ----------------- */
let username = null;
let sessionId = null;
let readyForSound = false;
let typingTimeout = null;
let currentReply = null; // { id, sender, text }
let isAtBottom = true;
let initialLoad = true;

/* ----------------- Refs ----------------- */
const messagesRef = ref(db, "messages");
const presenceRef = ref(db, "presence");
const typingRef = ref(db, "typing");

/* ----------------- Helpers ----------------- */
function uid() {
  return 's_' + Math.random().toString(36).slice(2,9) + Date.now().toString(36);
}
function escapeHtml(s = "") {
  return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
}
function fullTimestamp(ts) {
  const d = new Date(ts);
  const date = d.toLocaleDateString();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return `${date} ${time}`;
}

/* ----------------- Presence ----------------- */
async function setPresence(name, sid) {
  try {
    await set(ref(db, `presence/${sid}`), { name, online: true, lastSeen: Date.now() });
    // best-effort mark offline on unload
    window.addEventListener("beforeunload", async () => {
      try { await update(ref(db, `presence/${sid}`), { online: false, lastSeen: Date.now() }); } catch(e){}
      try { await set(typingRef, { [sid]: false }); } catch(e){}
    });
  } catch (e) { console.error("presence error", e); }
}

/* ----------------- Join flow ----------------- */
joinBtn.addEventListener("click", async () => {
  const name = (usernameInput.value || "").trim();
  if (!name) { joinHint.textContent = "Enter a valid name."; return; }
  username = name;
  sessionId = uid();
  localStorage.setItem("cyou-username", username);
  localStorage.setItem("cyou-session", sessionId);
  joinScreen.classList.add("hidden");
  chatScreen.classList.remove("hidden");
  await setPresence(username, sessionId);
  startListeners();
  // allow sound after initial load
  setTimeout(()=> readyForSound = true, 700);
});

/* ----------------- Send message (supports reply, forwarded) ----------------- */
inputForm.addEventListener("submit", async (e) => { e.preventDefault(); await doSend(); });
sendBtn.addEventListener("click", async (e) => { e.preventDefault(); await doSend(); });

async function doSend() {
  if (!username || !sessionId) return alert("Please join first.");
  const text = (messageInput.value || "").trim();
  if (!text) return;

  // build payload
  const payload = {
    sender: username,
    senderId: sessionId,
    text,
    edited: false,
    deleted: false,
    time: Date.now(),
    delivered: {},        // maps sessionId => true
    read: {},             // maps sessionId => true
    reactions: {},        // maps user => emoji
    pinnedBy: null,
    forwardedFrom: null,
    replyTo: currentReply ? { id: currentReply.id, sender: currentReply.sender, text: currentReply.text } : null,
    deletableUntil: Date.now() + (60 * 1000) // 60 seconds for delete-for-everyone
  };

  try {
    await push(messagesRef, payload);
    messageInput.value = "";
    currentReply = null;
    hideReplyPreview();
    try { await update(typingRef, { [sessionId]: false }); } catch(e){}
  } catch (err) {
    console.error("send failed", err);
    joinHint.textContent = "Send failed — check network.";
  }
}

/* ----------------- Typing (store username string) ----------------- */
messageInput.addEventListener("input", () => {
  if (!sessionId || !username) return;
  try { set(typingRef, { [sessionId]: username }); } catch(e){}
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    try { set(typingRef, { [sessionId]: false }); } catch(e){}
  }, 1400);
});

/* ----------------- Smart autoscroll & "New messages" button ----------------- */
messagesDiv.addEventListener("scroll", () => {
  const threshold = 160;
  const atBottom = (messagesDiv.scrollHeight - messagesDiv.scrollTop - messagesDiv.clientHeight) < threshold;
  isAtBottom = atBottom;
  if (atBottom) scrollDownBtn.classList.add("hidden"); 
});
scrollDownBtn.addEventListener("click", () => {
  scrollToBottom();
  scrollDownBtn.classList.add("hidden");
});

/* ----------------- Listeners: messages, typing, presence ----------------- */
function startListeners() {
  // presence summary
  onValue(presenceRef, (snap) => {
    const obj = snap.val() || {};
    const online = Object.values(obj).filter(v => v && v.online).length;
    const lastSeenArr = Object.entries(obj).filter(([sid,v]) => v && v.lastSeen).map(([sid,v]) => ({name: v.name, lastSeen: v.lastSeen}));
    presenceSummary.textContent = `${online} online`;
    // optional: show last seen on hover or extend UI
  });

  // typing indicator shows first other user typing (their name)
  onValue(typingRef, (snap) => {
    const obj = snap.val() || {};
    const typers = Object.entries(obj).filter(([sid,val]) => sid !== sessionId && val).map(([sid,val]) => val);
    typingIndicator.textContent = typers.length ? `${typers[0]} is typing...` : "";
  });

  // messages added
  onChildAdded(messagesRef, async (snap) => {
    const id = snap.key;
    const m = snap.val();
    renderMessage(id, m);
    // if message from others: mark delivered and read and play sound (after initial)
    if (m.senderId !== sessionId) {
      try { await update(ref(db, `messages/${id}/delivered`), { [sessionId]: true }); } catch(e){}
      try { await update(ref(db, `messages/${id}/read`), { [sessionId]: true }); } catch(e){}
      if (readyForSound && !initialLoad) { try { receiveSound.currentTime = 0; receiveSound.play(); } catch(e){} }
    }
    initialLoad = false;
  });

  // messages changed
  onChildChanged(messagesRef, (snap) => {
    const id = snap.key;
    const m = snap.val();
    renderMessage(id, m, true);
  });

  // initial presence and messages will populate UI
}

/* ----------------- Render message & actions ----------------- */
async function renderMessage(id, m, changed = false) {
  let el = document.getElementById(id);
  const isMine = m.senderId === sessionId;

  // check if pinned area needed
  if (m.pinnedBy) {
    // display pinned messages at top (simple: one per pinned message)
    renderPinnedMessage(id, m);
  } else {
    removePinnedDisplay(id);
  }

  if (!el) {
    el = document.createElement("div");
    el.id = id;
    el.className = "message " + (isMine ? "you" : "them");
    // add touch handlers for swipe-to-reply (left→right)
    addSwipeToReplyHandlers(el, id, m);
    messagesDiv.appendChild(el);
    setTimeout(()=> el.classList.add("show"), 12);
  }

  // deleted
  if (m.deleted) {
    el.classList.add("deleted");
    el.innerHTML = `${!isMine ? `<div class="avatar">${(m.sender||"?").charAt(0).toUpperCase()}</div>` : "" }
      <div style="display:flex;flex-direction:column;">
        <div class="senderName">${isMine ? "You" : escapeHtml(m.sender)}</div>
        <div class="msg-text">This message was deleted</div>
        <div class="meta"><span class="timestamp">${fullTimestamp(m.time)}</span></div>
      </div>`;
    const act = el.querySelector(".msg-actions"); if (act) act.remove();
    maybeShowScrollDown();
    return;
  }

  // normal message content
  const nameLabel = `<div class="senderName">${isMine ? "You" : escapeHtml(m.sender)}</div>`;
  const replyHtml = m.replyTo ? `<div class="reply-snippet"><small>↪ ${escapeHtml(m.replyTo.sender)}: ${escapeHtml(String(m.replyTo.text).slice(0,80))}</small></div>` : "";
  const forwardedHtml = m.forwardedFrom ? `<div class="reply-snippet"><small>Forwarded from ${escapeHtml(m.forwardedFrom)}</small></div>` : "";
  const textHtml = `<div class="msg-text">${escapeHtml(m.text || "")}${m.edited ? ' <span class="edited">(edited)</span>' : ''}</div>`;
  const timeHtml = `<span class="timestamp">${fullTimestamp(m.time)}</span>`;

  // ticks logic (simple mode - global room)
  let ticksHtml = "";
  if (isMine) {
    const delivered = m.delivered ? Object.keys(m.delivered || {}) : [];
    const read = m.read ? Object.keys(m.read || {}) : [];
    if ((delivered.length === 0) && (read.length === 0)) {
      ticksHtml = `<span class="ticks gray">✓</span>`;
    } else if ((delivered.length > 0) && (read.length === 0)) {
      ticksHtml = `<span class="ticks gray">✓✓</span>`;
    } else if (read.length > 0) {
      ticksHtml = `<span class="ticks blue">✓✓</span>`;
    }
  }

  // reactions summary
  let reactionsHtml = "";
  if (m.reactions) {
    // count each emoji
    const counts = {};
    Object.values(m.reactions).forEach(e => { counts[e] = (counts[e]||0) + 1; });
    reactionsHtml = `<div class="reaction-bar">` + Object.entries(counts).map(([emoji,c]) => `<div class="reaction-btn">${emoji} ${c}</div>`).join("") + `</div>`;
  }

  // actions for own messages
  const actionsHtml = isMine ? `
    <div class="msg-actions">
      <button class="act edit" title="Edit">✏️</button>
      <button class="act del" title="Delete">🗑️</button>
      <button class="act pin" title="Pin">📌</button>
      <button class="act fwd" title="Forward">🔁</button>
      <button class="act react" title="React">😊</button>
    </div>` : `
    <div class="msg-actions">
      <button class="act react" title="React">😊</button>
      <button class="act fwd" title="Forward">🔁</button>
    </div>`;

  // build HTML
  if (!isMine) {
    el.innerHTML = `<div style="display:flex;gap:8px;align-items:flex-start;">
      // ===============================
// CHAT APP – FULL JAVASCRIPT FILE
// ===============================

// ---- GLOBAL VARIABLES ----
let messages = [];
let selectedMessageId = null;   // For reply, forward, delete
let onlineStatus = true;        // Simulated online/offline
let typingTimeout;

// ---- DOM ELEMENTS ----
const chatArea = document.getElementById("chatArea");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const typingIndicator = document.getElementById("typingIndicator");
const lastSeenText = document.getElementById("lastSeen");

// ---- UTILITIES ----
function formatTimestamp() {
    const now = new Date();
    return now.toLocaleDateString() + " " + now.toLocaleTimeString();
}

function renderMessages() {
    chatArea.innerHTML = "";

    messages.forEach((msg) => {
        const div = document.createElement("div");
        div.className = msg.isMine ? "my-message message" : "other-message message";

        let replyBlock = "";
        if (msg.replyTo) {
            replyBlock = `
                <div class="reply-block">
                    <div class="reply-author">${msg.replyTo.isMine ? "You" : "Friend"}</div>
                    <div class="reply-text">${msg.replyTo.text}</div>
                </div>
            `;
        }

        div.innerHTML = `
            ${replyBlock}
            <div class="message-text">${msg.text}</div>

            <div class="message-footer">
                <span class="timestamp">${msg.timestamp}</span>

                <span class="status">
                    ${msg.status === 1 ? "✔" : ""}
                    ${msg.status === 2 ? "✔✔" : ""}
                    ${msg.status === 3 ? "<span class='blue'>✔✔</span>" : ""}
                </span>
            </div>

            <div class="actions">
                <button onclick="startReply(${msg.id})">Reply</button>
                <button onclick="forwardMessage(${msg.id})">Forward</button>
                <button onclick="pingMessage(${msg.id})">Ping</button>
                <button onclick="deleteForEveryone(${msg.id})">Delete</button>
                <button onclick="reactToMessage(${msg.id})">React</button>
            </div>
        `;

        div.addEventListener("swipeleft", () => startReply(msg.id));

        chatArea.appendChild(div);
    });

    chatArea.scrollTop = chatArea.scrollHeight;
}

// ---- SEND MESSAGE ----
function sendMessage() {
    const text = messageInput.value.trim();
    if (!text) return;

    const message = {
        id: Date.now(),
        text,
        isMine: true,
        timestamp: formatTimestamp(),
        status: 1,
        replyTo: selectedMessageId ? messages.find(m => m.id === selectedMessageId) : null
    };

    messages.push(message);
    selectedMessageId = null;
    messageInput.value = "";

    renderMessages();

    // Simulate "Delivered" + "Read"
    setTimeout(() => {
        message.status = 2;
        renderMessages();
    }, 500);

    setTimeout(() => {
        message.status = 3;
        renderMessages();
    }, 1000);
}

sendBtn.onclick = sendMessage;

// ---- TYPING INDICATOR ----
messageInput.addEventListener("input", () => {
    typingIndicator.style.display = "block";
    clearTimeout(typingTimeout);

    typingTimeout = setTimeout(() => {
        typingIndicator.style.display = "none";
    }, 700);
});

// ---- ONLINE/OFFLINE SYSTEM ----
function updateOnlineStatus(isOnline) {
    onlineStatus = isOnline;
    lastSeenText.textContent = isOnline
        ? "Online"
        : "Last seen today at " + new Date().toLocaleTimeString();
}

// ---- REPLY SYSTEM ----
function startReply(id) {
    selectedMessageId = id;
    const msg = messages.find(m => m.id === id);
    messageInput.placeholder = "Replying to: " + msg.text;
}

// ---- FORWARD SYSTEM ----
function forwardMessage(id) {
    const original = messages.find(m => m.id === id);

    const newMsg = {
        id: Date.now(),
        text: "Forwarded: " + original.text,
        isMine: true,
        timestamp: formatTimestamp(),
        status: 1,
        replyTo: null
    };

    messages.push(newMsg);
    renderMessages();
}

// ---- PING MESSAGE ----
function pingMessage(id) {
    alert("Ping sent for message ID: " + id);
}

// ---- DELETE FOR EVERYONE ----
function deleteForEveryone(id) {
    if (!confirm("Delete this message for everyone?")) return;

    const msg = messages.find(m => m.id === id);

    msg.text = "Message deleted";
    msg.status = "";
    msg.replyTo = null;

    renderMessages();
}

// ---- MESSAGE REACTIONS ----
function reactToMessage(id) {
    const emojis = ["👍", "❤️", "😂", "😮", "🔥"];
    const choice = prompt("Choose reaction: \n1 👍\n2 ❤️\n3 😂\n4 😮\n5 🔥");

    if (!choice || choice < 1 || choice > 5) return;

    const msg = messages.find(m => m.id === id);
    msg.text += " " + emojis[choice - 1];

    renderMessages();
}

// ---- SWIPE TO REPLY ----
let touchStartX = 0;

document.addEventListener("touchstart", (e) => {
    touchStartX = e.changedTouches[0].screenX;
});

document.addEventListener("touchend", (e) => {
    const endX = e.changedTouches[0].screenX;

    if (touchStartX - endX > 60) {
        const msgDiv = e.target.closest(".message");
        if (!msgDiv) return;

        const index = Array.from(chatArea.children).indexOf(msgDiv);
        startReply(messages[index].id);
    }
});

// ---- INITIALIZATION ----
updateOnlineStatus(true);
renderMessages();