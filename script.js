import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import {
  getDatabase, ref, push, onChildAdded, onChildChanged, onChildRemoved, onValue, update, set, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-database.js";

/* ---------------- Firebase config ---------------- */
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
}

const db = getDatabase(app);

/* ---------------- DOM ---------------- */
const joinScreen = document.getElementById("join-screen");
const chatScreen = document.getElementById("chat-screen");
const usernameInput = document.getElementById("usernameInput");
const joinBtn = document.getElementById("joinBtn");
const joinHint = document.getElementById("joinHint");

const onlineStatus = document.getElementById("onlineStatus");
const pinnedMessageBar = document.getElementById("pinned-message-bar");
const messagesDiv = document.getElementById("messages");
const newMessagesButton = document.getElementById("new-messages-button");
const typingIndicator = document.getElementById("typingIndicator");
const replyContextBar = document.getElementById("reply-context-bar");
const inputForm = document.getElementById("inputForm");
const messageInput = document.getElementById("messageInput");
const receiveSound = document.getElementById("receiveSound");
const themeToggle = document.getElementById("themeToggle");

/* ---------------- State ---------------- */
let username = null;
let sessionId = null;
let readyForSound = false;
let typingTimeout = null;
let activeReply = null; 
let userIsScrolledUp = false;
let newMessagesCount = 0;
const DELETE_WINDOW_MS = 15 * 60 * 1000; 
const AVAILABLE_REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '😡'];

/* ---------------- Realtime refs ---------------- */
const messagesRef = ref(db, "messages");
const presenceRef = ref(db, "presence");
const typingRef = ref(db, "typing");
const pinnedMessageRef = ref(db, "pinnedMessage");

/* ---------------- Helpers ---------------- */
function uid() { return 's_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36); }

function shortTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(s = "") {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function truncate(s = "", len = 50) {
    if (s.length <= len) return escapeHtml(s);
    return escapeHtml(s.substring(0, len)) + "...";
}

// NEW: Make links clickable
function linkify(text) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.replace(urlRegex, function(url) {
    return `<a href="${url}" target="_blank">${url}</a>`;
  });
}

/* ---------------- Presence & Theme ---------------- */
async function setPresence(name, sid) {
  const presenceNode = ref(db, `presence/${sid}`);
  await set(presenceNode, { name, online: true, lastSeen: serverTimestamp() });
  window.addEventListener("beforeunload", async () => {
    await update(presenceNode, { online: false, lastSeen: serverTimestamp() });
    await set(ref(db, `typing/${sid}`), false);
  });
}

// Theme Toggle Logic
themeToggle.addEventListener("click", () => {
  const isDark = document.body.getAttribute("data-theme") === "dark";
  if (isDark) {
    document.body.removeAttribute("data-theme");
    themeToggle.innerHTML = '<i class="fa-solid fa-moon"></i>';
  } else {
    document.body.setAttribute("data-theme", "dark");
    themeToggle.innerHTML = '<i class="fa-solid fa-sun"></i>';
  }
});

/* ---------------- Join flow ---------------- */
joinBtn.addEventListener("click", () => attemptJoin());
usernameInput.addEventListener("keypress", (e) => { if(e.key === "Enter") attemptJoin(); });

async function attemptJoin() {
  const name = (usernameInput.value || "").trim();
  if (!name || name.length < 1) { joinHint.textContent = "Please enter a name."; return; }
  
  username = name;
  sessionId = uid();
  sessionStorage.setItem("cyou-username", username);
  sessionStorage.setItem("cyou-session", sessionId);
  
  startApp();
}

function checkSession() {
  const storedName = sessionStorage.getItem("cyou-username");
  const storedSession = sessionStorage.getItem("cyou-session");
  if (storedName && storedSession) {
    username = storedName;
    sessionId = storedSession;
    startApp();
  }
}
document.addEventListener('DOMContentLoaded', checkSession);

function startApp() {
  joinScreen.classList.add("hidden");
  chatScreen.classList.remove("hidden");
  setPresence(username, sessionId).then(() => {
      startListeners();
      setTimeout(() => { readyForSound = true; }, 700);
  });
}

/* ---------------- Sending ---------------- */
inputForm.addEventListener("submit", async (e) => { e.preventDefault(); await doSend(); });

async function doSend(forwardedData = null) {
  const text = (messageInput.value || "").trim();
  if (!text && !forwardedData) return;

  const payload = {
    sender: username,
    senderId: sessionId,
    text: forwardedData ? forwardedData.text : text,
    edited: false,
    deleted: false,
    time: serverTimestamp(),
    reactions: {}, 
    replyTo: activeReply || null,
    forwarded: forwardedData ? { from: forwardedData.sender } : null,
  };

  try { await push(messagesRef, payload); } catch (e) { console.error(e); }

  messageInput.value = "";
  cancelReply();
  try { await set(ref(db, `typing/${sessionId}`), false); } catch (e) { }
}

/* ---------------- Typing & Reply ---------------- */
messageInput.addEventListener("input", () => {
  if (!sessionId) return;
  try { set(ref(db, `typing/${sessionId}`), username); } catch (e) { }
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    try { set(ref(db, `typing/${sessionId}`), false); } catch (e) { }
  }, 1400);
});

function showReplyContext(id, sender, text) {
  activeReply = { id, sender, text };
  replyContextBar.innerHTML = `
    <div class="reply-context-bar-text">
      Replying to <span style="font-weight:bold; color:var(--accent)">${escapeHtml(sender)}</span>
    </div>
    <button class="cancel-reply-btn" id="cancelReplyBtn"><i class="fa-solid fa-xmark"></i></button>
  `;
  replyContextBar.classList.remove("hidden");
  document.getElementById("cancelReplyBtn").addEventListener("click", cancelReply);
  messageInput.focus();
}

function cancelReply() {
  activeReply = null;
  replyContextBar.classList.add("hidden");
}

/* ---------------- Render Logic ---------------- */
function startListeners() {
  onChildAdded(messagesRef, async (snap) => {
    renderMessage(snap.key, snap.val());
    if (snap.val().senderId !== sessionId && userIsScrolledUp) {
      newMessagesCount++;
      newMessagesButton.classList.remove("hidden");
      newMessagesButton.innerHTML = `${newMessagesCount} New <i class="fa-solid fa-arrow-down"></i>`;
    }
    if (snap.val().senderId !== sessionId && readyForSound) {
      try { receiveSound.currentTime = 0; receiveSound.play(); } catch(e){}
    }
  });

  onChildChanged(messagesRef, (snap) => renderMessage(snap.key, snap.val(), true));
  onChildRemoved(messagesRef, (snap) => document.getElementById(snap.key)?.remove());

  onValue(typingRef, (snap) => {
    const typers = Object.values(snap.val() || {}).filter(v => v !== false && v !== username);
    typingIndicator.textContent = typers.length ? `${typers[0]} is typing...` : "";
  });

  onValue(presenceRef, (snap) => {
    const count = Object.values(snap.val() || {}).filter(u => u.online).length;
    onlineStatus.textContent = count > 0 ? `${count} Online` : "Offline";
  });

  onValue(pinnedMessageRef, (snap) => {
    const pinned = snap.val();
    if (pinned && pinned.msgId) {
      pinnedMessageBar.innerHTML = `<span><i class="fa-solid fa-thumbtack"></i> ${truncate(pinned.text, 40)}</span> <button class="unpin-btn" id="unpinBtn"><i class="fa-solid fa-xmark"></i></button>`;
      pinnedMessageBar.classList.remove("hidden");
      document.getElementById("unpinBtn").onclick = () => set(pinnedMessageRef, null);
    } else {
      pinnedMessageBar.classList.add("hidden");
    }
  });
  
  // Scroll Logic
  messagesDiv.addEventListener("scroll", () => {
    userIsScrolledUp = (messagesDiv.scrollHeight - messagesDiv.scrollTop - messagesDiv.clientHeight > 100);
    if(!userIsScrolledUp) { newMessagesCount = 0; newMessagesButton.classList.add("hidden"); }
  });
  
  newMessagesButton.onclick = () => { messagesDiv.scrollTop = messagesDiv.scrollHeight; };
}

async function renderMessage(id, m, changed = false) {
  let el = document.getElementById(id);
  const isMine = m.senderId === sessionId;

  if (!el) {
    el = document.createElement("div");
    el.id = id;
    messagesDiv.appendChild(el);
    setTimeout(() => el.classList.add("show"), 12);
  }
  el.className = "message " + (isMine ? "you" : "them") + " show";

  if (m.deleted) {
    el.classList.add("deleted");
    el.innerHTML = `<div class="msg-text"><i class="fa-solid fa-ban"></i> Message deleted</div>`;
    return;
  }

  // UPDATED ACTIONS WITH ICONS
  let actionsHtml = `
    <div class="msg-actions">
      <button class="act" data-action="reply" title="Reply"><i class="fa-solid fa-reply"></i></button>
      <button class="act" data-action="react" title="React"><i class="fa-regular fa-face-smile"></i></button>
      <button class="act" data-action="forward" title="Forward"><i class="fa-solid fa-share"></i></button>
      <button class="act" data-action="pin" title="Pin"><i class="fa-solid fa-thumbtack"></i></button>
      ${isMine ? `
        <button class="act" data-action="edit" title="Edit"><i class="fa-solid fa-pen"></i></button>
        <button class="act" data-action="delete" title="Delete"><i class="fa-solid fa-trash"></i></button>
      ` : ''}
    </div>
  `;

  // Reactions
  let reactionsHtml = '';
  if (m.reactions) {
    const counts = {};
    Object.values(m.reactions).forEach(r => counts[r] = (counts[r]||0)+1);
    reactionsHtml = '<div class="reactions-bar">';
    for(let [emoji, count] of Object.entries(counts)) {
      const reacted = m.reactions[sessionId] === emoji ? 'reacted' : '';
      reactionsHtml += `<div class="reaction-pill ${reacted}" data-emoji="${emoji}">${emoji} ${count}</div>`;
    }
    reactionsHtml += '</div>';
  }

  // Picker
  let pickerHtml = `<div class="reactions-picker hidden" id="picker-${id}">`;
  AVAILABLE_REACTIONS.forEach(e => pickerHtml += `<span class="react-emoji" data-emoji="${e}">${e}</span>`);
  pickerHtml += `</div>`;

  const safeText = linkify(escapeHtml(m.text || ""));
  
  const content = `
    ${!isMine ? `<div class="avatar">${m.sender[0].toUpperCase()}</div>` : ''}
    <div style="display:flex;flex-direction:column; width:100%;">
      ${actionsHtml}
      ${pickerHtml}
      <div class="senderName">${isMine ? "You" : escapeHtml(m.sender)}</div>
      ${m.replyTo ? `<div class="reply-context"><div style="font-weight:bold">${escapeHtml(m.replyTo.sender)}</div>${truncate(m.replyTo.text)}</div>` : ''}
      <div class="msg-text">${safeText}</div>
      <div class="meta">
        ${m.edited ? '<i class="fa-solid fa-pen" style="font-size:8px"></i>' : ''}
        ${shortTime(m.time)}
        ${isMine ? '<span class="ticks blue">✓✓</span>' : ''}
      </div>
      ${reactionsHtml}
    </div>
  `;

  el.innerHTML = content;

  // Events
  el.querySelectorAll('.act').forEach((btn, index) => {
    // Mapping index to action for simplicity or use specific classes. 
    // Here we need to grab the buttons carefully.
    btn.onclick = async () => {
      const action = btn.title.toLowerCase(); 
      if(action === 'reply') showReplyContext(id, m.sender, m.text);
      if(action === 'react') document.getElementById(`picker-${id}`).classList.toggle('hidden');
      if(action === 'forward') { if(confirm("Forward?")) doSend({ sender: m.sender, text: m.text }); }
      if(action === 'pin') set(pinnedMessageRef, { msgId: id, text: m.text });
      if(action === 'edit') {
         const newT = prompt("Edit:", m.text);
         if(newT) update(ref(db, `messages/${id}`), { text: newT, edited: true });
      }
      if(action === 'delete') {
         if(confirm("Delete?")) update(ref(db, `messages/${id}`), { deleted: true });
      }
    };
  });

  // Reaction clicks
  el.querySelectorAll('.react-emoji').forEach(btn => {
    btn.onclick = () => {
      const emoji = btn.dataset.emoji;
      const current = m.reactions?.[sessionId];
      set(ref(db, `messages/${id}/reactions/${sessionId}`), current === emoji ? null : emoji);
      document.getElementById(`picker-${id}`).classList.add('hidden');
    }
  });

  if (!changed && !userIsScrolledUp) messagesDiv.scrollTop = messagesDiv.scrollHeight;
}
