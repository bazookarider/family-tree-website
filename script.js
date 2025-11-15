import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import {
  getDatabase, ref, push, onChildAdded, onChildChanged, onChildRemoved, onValue, update, set, serverTimestamp
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

let app;
try {
  app = initializeApp(firebaseConfig);
} catch (e) {
  console.error("Firebase init error:", e);
  document.addEventListener("DOMContentLoaded", () => {
    const joinHint = document.getElementById("joinHint");
    if (joinHint) joinHint.textContent = "Firebase initialization failed — check network or enable modules (Chrome may block file://).";
  });
  throw e;
}

const db = getDatabase(app);

/* ---------------- DOM ---------------- */
// Join
const joinScreen = document.getElementById("join-screen");
const chatScreen = document.getElementById("chat-screen");
const usernameInput = document.getElementById("usernameInput");
const joinBtn = document.getElementById("joinBtn");
const joinHint = document.getElementById("joinHint");
// Chat
const topBar = document.getElementById("topBar");
const onlineStatus = document.getElementById("onlineStatus");
const pinnedMessageBar = document.getElementById("pinned-message-bar");
const messagesDiv = document.getElementById("messages");
const newMessagesButton = document.getElementById("new-messages-button");
const typingIndicator = document.getElementById("typingIndicator");
const replyContextBar = document.getElementById("reply-context-bar");
const inputForm = document.getElementById("inputForm");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const receiveSound = document.getElementById("receiveSound");

/* ---------------- State ---------------- */
let username = null;
let sessionId = null;
let readyForSound = false;
let typingTimeout = null;
// New state for new features
let activeReply = null; // { id, sender, text }
let userIsScrolledUp = false;
let newMessagesCount = 0;
const DELETE_WINDOW_MS = 15 * 60 * 1000; // 15 minutes to delete
const AVAILABLE_REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '😡'];

/* ---------------- Realtime refs ---------------- */
const messagesRef = ref(db, "messages");
const presenceRef = ref(db, "presence");
const typingRef = ref(db, "typing");
const pinnedMessageRef = ref(db, "pinnedMessage"); // New ref for pinned message

/* ---------------- Helpers ---------------- */
function uid() {
  return 's_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
}
// Upgraded to full date + time
function shortTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  // Format: YYYY-MM-DD HH:MM:SS
  const date = d.toLocaleDateString('sv-SE'); // 'sv-SE' gives YYYY-MM-DD
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  return `${date} ${time}`;
}
function escapeHtml(s = "") {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
function truncate(s = "", len = 50) {
    if (s.length <= len) return escapeHtml(s);
    return escapeHtml(s.substring(0, len)) + "...";
}

/* ---------------- Presence helpers ---------------- */
async function setPresence(name, sid) {
  const presenceNode = ref(db, `presence/${sid}`);
  try {
    await set(presenceNode, { name, online: true, lastSeen: serverTimestamp() });
    window.addEventListener("beforeunload", async () => {
      try { await update(presenceNode, { online: false, lastSeen: serverTimestamp() }); } catch (e) { }
      try { await set(ref(db, `typing/${sid}`), false); } catch (e) { }
    });
  } catch (e) { console.error("presence set failed", e); }
}

/* ---------------- Join flow ---------------- */
joinBtn.addEventListener("click", async () => {
  const name = (usernameInput.value || "").trim();
  if (!name || name.length < 1) { joinHint.textContent = "Enter a valid name."; return; }
  username = name;
  sessionId = uid();
  // We use session storage so a new tab is a new session
  sessionStorage.setItem("cyou-username", username);
  sessionStorage.setItem("cyou-session", sessionId);

  joinScreen.classList.add("hidden");
  chatScreen.classList.remove("hidden");
  await setPresence(username, sessionId);
  startListeners();
  setTimeout(() => { readyForSound = true; }, 700);
});

// Check if already joined in this session
function checkSession() {
  const storedName = sessionStorage.getItem("cyou-username");
  const storedSession = sessionStorage.getItem("cyou-session");
  if (storedName && storedSession) {
    username = storedName;
    sessionId = storedSession;
    joinScreen.classList.add("hidden");
    chatScreen.classList.remove("hidden");
    // Ensure presence is set again on reload
    setPresence(username, sessionId).then(() => {
        startListeners();
        setTimeout(() => { readyForSound = true; }, 700);
    });
  }
}
// Run check on load
document.addEventListener('DOMContentLoaded', checkSession);


/* ---------------- Sending ---------------- */
inputForm.addEventListener("submit", async (e) => { e.preventDefault(); await doSend(); });
sendBtn.addEventListener("click", async (e) => { e.preventDefault(); await doSend(); });

async function doSend(forwardedData = null) {
  if (!username || !sessionId) return alert("Please join first.");
  
  const text = (messageInput.value || "").trim();
  if (!text && !forwardedData) return;

  const payload = {
    sender: username,
    senderId: sessionId,
    text: forwardedData ? forwardedData.text : text,
    edited: false,
    deleted: false,
    time: serverTimestamp(), // Use server time
    delivered: {},
    read: {},
    reactions: {}, // New: reactions object
    replyTo: activeReply || null, // New: reply data
    forwarded: forwardedData ? { from: forwardedData.sender } : null, // New: forward data
  };

  try {
    await push(messagesRef, payload);
  } catch (e) {
    console.error("send failed", e);
    joinHint.textContent = "Send failed — check connection.";
  }

  messageInput.value = "";
  cancelReply(); // Clear reply context
  try { await set(ref(db, `typing/${sessionId}`), false); } catch (e) { }
}

/* ---------------- Typing indicator (stores name) ---------------- */
messageInput.addEventListener("input", () => {
  if (!sessionId || !username) return;
  try { set(ref(db, `typing/${sessionId}`), username); } catch (e) { }
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    try { set(ref(db, `typing/${sessionId}`), false); } catch (e) { }
  }, 1400);
});

/* ---------------- Reply Logic ---------------- */
function showReplyContext(id, sender, text) {
  activeReply = { id, sender, text };
  replyContextBar.innerHTML = `
    <div class="reply-context-bar-text">
      Replying to <span class="reply-context-sender">${escapeHtml(sender)}</span>:
      <span>${truncate(text, 40)}</span>
    </div>
    <button class="cancel-reply-btn" id="cancelReplyBtn" title="Cancel reply">✖</button>
  `;
  replyContextBar.classList.remove("hidden");
  document.getElementById("cancelReplyBtn").addEventListener("click", cancelReply);
  messageInput.focus();
}

function cancelReply() {
  activeReply = null;
  replyContextBar.classList.add("hidden");
  replyContextBar.innerHTML = "";
}

/* ---------------- Smart Scroll Logic ---------------- */
messagesDiv.addEventListener("scroll", () => {
  const atBottom = messagesDiv.scrollHeight - messagesDiv.scrollTop - messagesDiv.clientHeight < 100;
  if (atBottom) {
    userIsScrolledUp = false;
    newMessagesCount = 0;
    newMessagesButton.classList.add("hidden");
  } else {
    userIsScrolledUp = true;
  }
});

newMessagesButton.addEventListener("click", () => {
  scrollToBottom(true); // Force scroll
  newMessagesButton.classList.add("hidden");
  newMessagesCount = 0;
});

function updateNewMessagesButton() {
  if (newMessagesCount > 0) {
    newMessagesButton.textContent = `${newMessagesCount} New Message${newMessagesCount > 1 ? 's' : ''} ↓`;
    newMessagesButton.classList.remove("hidden");
  } else {
    newMessagesButton.classList.add("hidden");
  }
}

/* ---------------- Listeners ---------------- */
function startListeners() {
  // messages listener
  onChildAdded(messagesRef, async (snap) => {
    const id = snap.key;
    const m = snap.val();
    renderMessage(id, m);

    if (m.senderId !== sessionId) {
      // Mark delivered (read is handled by render)
      try { await update(ref(db, `messages/${id}/delivered`), { [sessionId]: true }); } catch (e) { }
      
      if (userIsScrolledUp) {
        newMessagesCount++;
        updateNewMessagesButton();
      }
      
      if (readyForSound) {
        try { receiveSound.currentTime = 0; receiveSound.play(); } catch (e) { }
      }
    }
  });

  onChildChanged(messagesRef, (snap) => {
    const id = snap.key;
    const m = snap.val();
    renderMessage(id, m, true); // Re-render on change (for edits, reactions, deletes)
  });

  onChildRemoved(messagesRef, (snap) => {
    const el = document.getElementById(snap.key);
    if (el) el.remove();
  });

  // typing indicator
  onValue(typingRef, (snap) => {
    const obj = snap.val() || {};
    const typers = Object.entries(obj).filter(([sid, val]) => sid !== sessionId && Boolean(val)).map(([sid, val]) => val);
    typingIndicator.textContent = typers.length ? `${typers[0]} is typing...` : "";
  });

  // New: presence listener
  onValue(presenceRef, (snap) => {
    const users = snap.val() || {};
    const onlineUsers = Object.values(users).filter(u => u.online);
    if (onlineUsers.length > 0) {
      onlineStatus.textContent = `${onlineUsers.length} user${onlineUsers.length > 1 ? 's' : ''} online`;
    } else {
      onlineStatus.textContent = "Offline";
    }
  });

  // New: pinned message listener
  onValue(pinnedMessageRef, (snap) => {
    const pinned = snap.val();
    if (pinned && pinned.msgId) {
      pinnedMessageBar.innerHTML = `
        <span><b>Pinned:</b> ${truncate(pinned.text, 60)}</span>
        <button class="unpin-btn" id="unpinBtn" title="Unpin">✖</button>
      `;
      pinnedMessageBar.classList.remove("hidden");
      document.getElementById("unpinBtn").addEventListener("click", async () => {
        await set(pinnedMessageRef, null); // Clear the pin
      });
    } else {
      pinnedMessageBar.classList.add("hidden");
      pinnedMessageBar.innerHTML = "";
    }
  });
}

/* ---------------- Render Message (Majorly Upgraded) ---------------- */
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

  // deleted
  if (m.deleted) {
    el.classList.add("deleted");
    el.innerHTML = `
      ${!isMine ? `<div class="avatar">${(m.sender || "?").charAt(0).toUpperCase()}</div>` : ""}
      <div style="display:flex;flex-direction:column;">
        <div class="senderName">${isMine ? "You" : escapeHtml(m.sender)}</div>
        <div class="msg-text">This message was deleted</div>
        <div class="meta"><span class="timestamp">${shortTime(m.time)}</span></div>
      </div>`;
    scrollToBottom();
    return;
  }

  // --- Build HTML components ---
  
  const nameLabel = `<div class="senderName">${isMine ? "You" : escapeHtml(m.sender)}</div>`;
  
  // New: Forwarded label
  const forwardLabel = m.forwarded ? `<div class="forwarded">(Forwarded from ${escapeHtml(m.forwarded.from || '?')})</div>` : '';

  // New: Reply context
  let replyHtml = '';
  if (m.replyTo) {
    replyHtml = `
      <div class="reply-context">
        <div class="reply-context-sender">${escapeHtml(m.replyTo.sender)}</div>
        <div class="reply-context-text">${truncate(m.replyTo.text, 60)}</div>
      </div>
    `;
  }
  
  const textHtml = `<div class="msg-text">${escapeHtml(m.text || "")}</div>`;
  const editedLabel = m.edited ? ` <span class="edited">(edited)</span>` : '';
  
  // Ticks
  let ticksHtml = "";
  if (isMine) {
    const read = m.read ? Object.keys(m.read || {}).length : 0;
    const delivered = m.delivered ? Object.keys(m.delivered || {}).length : 0;
    if (read > 0) ticksHtml = `<span class="ticks blue">✓✓</span>`;
    else if (delivered > 0) ticksHtml = `<span class="ticks gray">✓✓</span>`;
    else ticksHtml = `<span class="ticks gray">✓</span>`;
  }
  
  const metaHtml = `<div class="meta"><span class="timestamp">${shortTime(m.time)}</span>${editedLabel}${ticksHtml}</div>`;

  // New: Reactions
  let reactionsHtml = '';
  let reactionsPickerHtml = '';
  if (m.reactions) {
    // Group reactions by emoji
    const counts = Object.values(m.reactions).reduce((acc, emoji) => {
      acc[emoji] = (acc[emoji] || 0) + 1;
      return acc;
    }, {});
    
    if (Object.keys(counts).length > 0) {
      reactionsHtml = '<div class="reactions-bar">';
      for (const [emoji, count] of Object.entries(counts)) {
        // Check if I reacted with this emoji
        const iReacted = m.reactions[sessionId] === emoji;
        reactionsHtml += `<div class="reaction-pill ${iReacted ? 'reacted' : ''}" data-msg-id="${id}" data-emoji="${emoji}">${emoji} ${count}</div>`;
      }
      reactionsHtml += '</div>';
    }
  }

  // New: Reaction Picker (hidden by default)
  reactionsPickerHtml = `<div class="reactions-picker hidden" id="picker-${id}">`;
  for (const emoji of AVAILABLE_REACTIONS) {
    reactionsPickerHtml += `<span class="react-emoji" data-msg-id="${id}" data-emoji="${emoji}">${emoji}</span>`;
  }
  reactionsPickerHtml += `</div>`;


  // New: Actions (now available on all messages)
  let actionsHtml = `
    <div class="msg-actions">
      <button class="act" title="Reply" data-action="reply" data-id="${id}">↩️</button>
      <button class="act" title="React" data-action="react" data-id="${id}">😊</button>
      <button class="act" title="Forward" data-action="forward" data-id="${id}">↪️</button>
      <button class="act" title="Pin" data-action="pin" data-id="${id}">📌</button>
      ${isMine ? `
        <button class="act" title="Edit" data-action="edit" data-id="${id}">✏️</button>
        <button class="act" title="Delete" data-action="delete" data-id="${id}">🗑️</button>
      ` : ''}
    </div>
  `;
  
  // --- Assemble the final HTML ---
  if (!isMine) {
    el.innerHTML = `
      <div class="avatar">${(m.sender || "?").charAt(0).toUpperCase()}</div>
      <div style="display:flex;flex-direction:column;width:100%;">
        ${actionsHtml}
        ${reactionsPickerHtml}
        ${nameLabel}
        ${forwardLabel}
        ${replyHtml}
        ${textHtml}
        ${metaHtml}
        ${reactionsHtml}
      </div>`;
  } else {
    el.innerHTML = `
      <div style="display:flex;flex-direction:column;width:100%;align-items:flex-end;">
        ${actionsHtml}
        ${reactionsPickerHtml}
        ${nameLabel}
        ${forwardLabel}
        ${replyHtml}
        ${textHtml}
        ${metaHtml}
        ${reactionsHtml}
      </div>`;
  }

  // --- Attach all event listeners ---
  el.querySelectorAll('.act').forEach(btn => {
    btn.addEventListener('click', async () => {
      const action = btn.dataset.action;
      switch(action) {
        case 'reply':
          showReplyContext(id, m.sender, m.text);
          break;
        case 'react':
          document.getElementById(`picker-${id}`).classList.toggle('hidden');
          break;
        case 'forward':
          if (confirm(`Forward this message from ${m.sender}?`)) {
            await doSend({ sender: m.sender, text: m.text });
          }
          break;
        case 'pin':
          if (confirm(`Pin this message?`)) {
            await set(pinnedMessageRef, { msgId: id, text: m.text, sender: m.sender, time: m.time });
          }
          break;
        case 'edit':
          if ((m.editCount || 0) >= 1) return alert("You can only edit once.");
          const newText = prompt("Edit your message:", m.text || "");
          if (newText === null) return;
          const trimmed = (newText || "").trim();
          if (!trimmed) return alert("Message cannot be empty.");
          await update(ref(db, `messages/${id}`), { text: trimmed, edited: true, editCount: (m.editCount || 0) + 1, editedAt: serverTimestamp() });
          break;
        case 'delete':
          // Timed delete check
          const timeSinceSent = Date.now() - m.time;
          if (timeSinceSent > DELETE_WINDOW_MS) {
            return alert(`You can only delete messages for everyone within 15 minutes. (This message is ${Math.round(timeSinceSent/60000)} mins old)`);
          }
          if (!confirm("Delete this message for everyone?")) return;
          await update(ref(db, `messages/${id}`), { text: "", deleted: true, deletedAt: serverTimestamp() });
          break;
      }
    });
  });

  // Reaction picker emoji click
  el.querySelectorAll('.react-emoji').forEach(emojiBtn => {
    emojiBtn.addEventListener('click', async () => {
      const emoji = emojiBtn.dataset.emoji;
      const msgId = emojiBtn.dataset.msgId;
      const currentReaction = m.reactions ? m.reactions[sessionId] : null;
      
      if (currentReaction === emoji) {
        // Un-react
        await set(ref(db, `messages/${msgId}/reactions/${sessionId}`), null);
      } else {
        // React
        await set(ref(db, `messages/${msgId}/reactions/${sessionId}`), emoji);
      }
      document.getElementById(`picker-${msgId}`).classList.add('hidden');
    });
  });

  // Reaction pill click (for un-reacting)
  el.querySelectorAll('.reaction-pill.reacted').forEach(pill => {
    pill.addEventListener('click', async () => {
        const emoji = pill.dataset.emoji;
        const msgId = pill.dataset.msgId;
        // Only un-react if you clicked your own reacted pill
        if (m.reactions[sessionId] === emoji) {
             await set(ref(db, `messages/${msgId}/reactions/${sessionId}`), null);
        }
    });
  });

  // If this client is not the sender, mark as read
  if (!isMine) {
    try { await update(ref(db, `messages/${id}/read`), { [sessionId]: true }); } catch (e) { }
  }

  // Only auto-scroll if it's a new message (not a change) and user is at bottom
  if (!changed && !userIsScrolledUp) {
    scrollToBottom();
  }
}

/* ---------------- Utilities ---------------- */
function scrollToBottom(force = false) {
  if (userIsScrolledUp && !force) return;
  setTimeout(() => { messagesDiv.scrollTop = messagesDiv.scrollHeight; }, 80);
}

/* on unload - mark presence offline & clear typing */
window.addEventListener("beforeunload", async () => {
  if (sessionId) {
    try { await update(ref(db, `presence/${sessionId}`), { online: false, lastSeen: serverTimestamp() }); } catch (e) { }
    try { await set(ref(db, `typing/${sessionId}`), false); } catch (e) { }
  }
});
