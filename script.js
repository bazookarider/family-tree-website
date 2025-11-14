import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import {
  getDatabase, ref, push, onChildAdded, onChildChanged, onValue, update, set, remove
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
let sessionId = null; // unique per browser/tab
let readyForSound = false; // avoid playing sound on initial load
let typingTimeout = null;

/* ---------------- Realtime refs ---------------- */
const messagesRef = ref(db, "messages");
const presenceRef = ref(db, "presence");
const typingRef = ref(db, "typing");

/* ---------------- Helpers ---------------- */
function uid() {
  return 's_' + Math.random().toString(36).slice(2,9) + Date.now().toString(36);
}
function shortTime(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function escapeHtml(s = "") {
  return s.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
}

/* ---------------- Presence helpers ---------------- */
async function setPresence(name, sid) {
  try {
    await set(ref(db, `presence/${sid}`), { name, online: true, lastSeen: Date.now() });
    // schedule offline removal with onDisconnect (RTDB web doesn't support onDisconnect in modular SDK easily here),
    // but we'll update lastSeen on unload:
    window.addEventListener("beforeunload", async () => {
      try { await update(ref(db, `presence/${sid}`), { online: false, lastSeen: Date.now() }); } catch(e){}
    });
  } catch(e){ console.error("presence set failed", e); }
}

/* ---------------- Join flow ---------------- */
joinBtn.addEventListener("click", async () => {
  const name = (usernameInput.value || "").trim();
  if (!name || name.length < 1) { joinHint.textContent = "Enter a valid name."; return; }
  username = name;
  sessionId = uid();
  localStorage.setItem("cyou-username", username);
  localStorage.setItem("cyou-session", sessionId);
  joinScreen.classList.add("hidden");
  chatScreen.classList.remove("hidden");
  await setPresence(username, sessionId);
  startListeners();
  setTimeout(()=>{ readyForSound = true; }, 700);
});

/* ---------------- Sending ---------------- */
inputForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  await doSend();
});
sendBtn.addEventListener("click", async (e)=>{ e.preventDefault(); await doSend(); });

async function doSend() {
  if (!username || !sessionId) return alert("Please join first.");
  const text = (messageInput.value || "").trim();
  if (!text) return;
  const payload = {
    sender: username,
    senderId: sessionId,
    text,
    edited: false,
    deleted: false,
    time: Date.now()
  };
  const pushRef = await push(messagesRef, payload);
  // mark our own message as sent (server has it)
  messageInput.value = "";
  // update typing false
  try { await update(typingRef, { [sessionId]: false }); } catch(e){}
}

/* ---------------- Typing indicator ---------------- */
messageInput.addEventListener("input", () => {
  if (!sessionId) return;
  try { set(typingRef, { [sessionId]: messageInput.value.length > 0 }); } catch(e){}
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    try { set(typingRef, { [sessionId]: false }); } catch(e){}
  }, 1400);
});

/* ---------------- Listeners ---------------- */
function startListeners() {
  // messages listener: when new message arrives
  onChildAdded(messagesRef, (snap) => {
    const id = snap.key;
    const m = snap.val();
    renderMessage(id, m);
    // if message is from others, mark delivered and play sound (after ready)
    if (m.senderId !== sessionId) {
      // mark delivered for this session
      update(ref(db, `messages/${id}/delivered/${sessionId}`), true).catch(()=>{});
      if (readyForSound) { try { receiveSound.currentTime = 0; receiveSound.play(); } catch(e){} }
      // mark read immediately when added (we consider appended messages as seen)
      update(ref(db, `messages/${id}/read/${sessionId}`), true).catch(()=>{});
    }
  });

  // message changed -> update UI
  onChildChanged(messagesRef, (snap) => {
    const id = snap.key;
    const m = snap.val();
    renderMessage(id, m, true);
  });

  // typing indicator (show first other typer)
  onValue(typingRef, (snap) => {
    const obj = snap.val() || {};
    const typers = Object.keys(obj).filter(u => u !== sessionId && obj[u]);
    typingIndicator.textContent = typers.length ? `${obj[typers[0]]===true? typers[0] : ''} is typing...` : "";
  });
}

/* ---------------- Render message ---------------- */
function renderMessage(id, m, changed = false) {
  let el = document.getElementById(id);
  const isMine = m.senderId === sessionId;

  if (!el) {
    el = document.createElement("div");
    el.id = id;
    el.className = "message " + (isMine ? "you" : "them");
    // for them messages show avatar left
    if (!isMine) {
      const avatar = document.createElement("div");
      avatar.className = "avatar";
      avatar.textContent = (m.sender || "?").trim().charAt(0).toUpperCase();
      el.appendChild(avatar);
    }
    messagesDiv.appendChild(el);
    setTimeout(()=>el.classList.add("show"), 12);
  }

  // deleted message
  if (m.deleted) {
    el.classList.add("deleted");
    el.innerHTML = `${!isMine ? `<div class="avatar">${(m.sender||"?").charAt(0).toUpperCase()}</div>` : "" }
      <div style="display:flex;flex-direction:column;">
        <div class="senderName">${isMine ? "You" : escapeHtml(m.sender)}</div>
        <div class="msg-text">This message was deleted</div>
        <div class="meta">${shortTime(m.time)}</div>
      </div>`;
    // remove actions if any
    const act = el.querySelector(".msg-actions"); if (act) act.remove();
    scrollToBottom();
    return;
  }

  // normal content
  const nameLabel = `<div class="senderName">${isMine ? "You" : escapeHtml(m.sender)}</div>`;
  const textHtml = `<div class="msg-text">${escapeHtml(m.text || "")}${m.edited ? ' <span class="edited">(edited)</span>' : ''}</div>`;
  const timeHtml = `<div class="meta">${shortTime(m.time)}</div>`;

  // compute ticks for sender view
  let ticksHtml = "";
  if (isMine) {
    // if no delivered children => single gray tick (sent)
    const delivered = m.delivered ? Object.keys(m.delivered || {}) : [];
    const read = m.read ? Object.keys(m.read || {}) : [];
    if ((!delivered || delivered.length === 0) && (!read || read.length === 0)) {
      ticksHtml = `<span class="ticks gray">✓</span>`;
    } else if (delivered.length > 0 && read.length === 0) {
      ticksHtml = `<span class="ticks gray">✓✓</span>`;
    } else if (read.length > 0) {
      ticksHtml = `<span class="ticks blue">✓✓</span>`;
    }
  }

  const actionsHtml = isMine ? `
    <div class="msg-actions">
      <button class="act edit" title="Edit">✏️</button>
      <button class="act del" title="Delete">🗑️</button>
    </div>` : "";

  // build inner HTML: if not mine include avatar already appended as first child; we'll recreate nodes to keep simple
  if (!isMine) {
    el.innerHTML = `<div style="display:flex;gap:8px;align-items:flex-start;">
      <div class="avatar">${(m.sender||"?").charAt(0).toUpperCase()}</div>
      <div style="display:flex;flex-direction:column;">
        ${nameLabel}
        ${textHtml}
        <div style="display:flex;align-items:center;gap:8px;">
          ${timeHtml}
        </div>
      </div>
    </div>`;
  } else {
    el.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:flex-end;">
        ${nameLabel}
        ${textHtml}
        <div style="display:flex;align-items:center;gap:8px;">
          ${timeHtml}
          ${ticksHtml}
        </div>
      </div>
      ${actionsHtml}
    `;
  }

  // attach actions
  if (isMine) {
    const editBtn = el.querySelector(".act.edit");
    const delBtn = el.querySelector(".act.del");
    editBtn?.addEventListener("click", async () => {
      if ((m.editCount || 0) >= 1) return alert("You can only edit once.");
      const newText = prompt("Edit your message:", m.text || "");
      if (newText === null) return;
      const trimmed = (newText||"").trim();
      if (!trimmed) return alert("Message cannot be empty.");
      await update(ref(db, `messages/${id}`), { text: trimmed, edited: true, editCount: (m.editCount||0)+1, editedAt: Date.now() });
    });
    delBtn?.addEventListener("click", async () => {
      if (!confirm("Delete this message?")) return;
      await update(ref(db, `messages/${id}`), { text: "", deleted: true, deletedAt: Date.now() });
    });
  }

  // If this client is not the sender, ensure we set delivered/read markers when we render
  if (!isMine) {
    try { await update(ref(db, `messages/${id}/delivered`), { [sessionId]: true }); } catch(e) {}
    try { await update(ref(db, `messages/${id}/read`), { [sessionId]: true }); } catch(e) {}
  }

  scrollToBottom();
}

/* ---------------- Utilities ---------------- */
function scrollToBottom() {
  setTimeout(()=>{ messagesDiv.scrollTop = messagesDiv.scrollHeight; }, 80);
}

/* ---------------- start presence cleanup on unload (best-effort) ---------------- */
window.addEventListener("beforeunload", async () => {
  if (sessionId) {
    try { await update(ref(db, `presence/${sessionId}`), { online: false, lastSeen: Date.now() }); } catch(e){}
    try { await set(typingRef, { [sessionId]: false }); } catch(e){}
  }
});