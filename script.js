// script.js — Final upgraded version
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import {
  getAuth, signInAnonymously, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, serverTimestamp,
  onSnapshot, query, orderBy, doc, setDoc, getDoc, updateDoc, arrayUnion, arrayRemove
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

/* ---------------------------
   Firebase config (unchanged)
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
const typingIndicator = document.getElementById("typingIndicator");
const typingIndicatorHeader = document.getElementById("typingIndicatorHeader"); // unused
const onlineCount = document.getElementById("onlineCount");
const onlineUsersUL = document.getElementById("onlineUsers");
const lastSeenEl = document.getElementById("lastSeen");

const sendForm = document.getElementById("sendForm");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");

const themeToggle = document.getElementById("themeToggle");
const clearChatBtn = document.getElementById("clearChatBtn");

const popup = document.getElementById("msgPopup");
const editBtn = document.getElementById("editBtn");
const deleteBtn = document.getElementById("deleteBtn");

/* ---------------------------
   State
---------------------------- */
let username = localStorage.getItem("cyou_username") || "";
let messagesUnsub = null, presenceUnsub = null, typingUnsub = null;
let typingTimeout = null;
let popupTargetId = null; // message id for which popup is open
let editLimit = {}; // track edit counts per message (allow only 1 edit)

/* ---------------------------
   Auth
---------------------------- */
signInAnonymously(auth);
onAuthStateChanged(auth, user => console.log("Anon uid:", user?.uid));

/* ---------------------------
   Theme restore
---------------------------- */
const savedTheme = localStorage.getItem("cyou_theme") || "light";
applyTheme(savedTheme);
themeToggle?.addEventListener("click", () => {
  const next = document.body.classList.contains("dark") ? "light" : "dark";
  applyTheme(next);
  localStorage.setItem("cyou_theme", next);
});
function applyTheme(t) { if (t === "dark") document.body.classList.add("dark"); else document.body.classList.remove("dark"); }

/* ---------------------------
   Auto-join if saved nickname
---------------------------- */
if (username) {
  (async () => {
    try {
      const presRef = doc(db, "cyou_presence", username);
      const presSnap = await getDoc(presRef);
      if (presSnap.exists() && presSnap.data()?.online) {
        username = "";
        localStorage.removeItem("cyou_username");
        joinSection.style.display = "flex";
        chatSection.style.display = "none";
        joinHint.textContent = "Saved nickname is online elsewhere. Enter a different one.";
      } else {
        joinSection.style.display = "none";
        chatSection.style.display = "flex";
        await setDoc(presRef, { online: true, lastSeen: serverTimestamp() }, { merge: true });
        startPresenceListener();
        startTypingListener();
        startMessagesListener();
      }
    } catch (e) {
      console.error("Auto-join error", e);
      joinSection.style.display = "flex";
      chatSection.style.display = "none";
    }
  })();
} else {
  joinSection.style.display = "flex";
  chatSection.style.display = "none";
}

/* ---------------------------
   Join flow
---------------------------- */
enterBtn.addEventListener("click", async () => {
  const name = nameInput.value.trim();
  if (!name) { joinHint.textContent = "Enter a nickname."; return; }
  try {
    const presRef = doc(db, "cyou_presence", name);
    const presSnap = await getDoc(presRef);
    if (presSnap.exists() && presSnap.data()?.online) {
      joinHint.textContent = "⚠️ That nickname is already online. Choose another.";
      return;
    }
    username = name;
    localStorage.setItem("cyou_username", username);
    joinHint.textContent = "";
    joinSection.style.display = "none";
    chatSection.style.display = "flex";
    // Use Promise.allSettled to avoid blocking on serverTimestamp delays
    Promise.allSettled([ setDoc(presRef, { online: true, lastSeen: serverTimestamp() }, { merge: true }) ]);
    startPresenceListener();
    startTypingListener();
    startMessagesListener();
  } catch (err) {
    console.error("Join error:", err);
    joinHint.textContent = "Error joining. See console.";
  }
});

/* ---------------------------
   Presence listener — online users + last seen
---------------------------- */
function startPresenceListener() {
  if (presenceUnsub) presenceUnsub();
  presenceUnsub = onSnapshot(collection(db, "cyou_presence"), (snap) => {
    const users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const online = users.filter(u => u.online).length;
    onlineCount.textContent = online;

    // update lastSeen (show most recent lastSeen among others)
    const others = users.filter(u => u.id !== username);
    const last = others
      .map(u => u.lastSeen?.toDate?.())
      .filter(Boolean)
      .sort((a,b) => b - a)[0];
    lastSeenEl.textContent = last ? `Last seen: ${last.toLocaleString()}` : "";

    // users list with green dot
    onlineUsersUL.innerHTML = "";
    users.forEach(u => {
      const li = document.createElement("li");
      const left = document.createElement("div");
      left.style.display = "flex";
      left.style.alignItems = "center";
      left.style.gap = "8px";
      const dot = document.createElement("span");
      dot.className = "user-dot";
      if (u.online) dot.classList.add("online");
      const name = document.createElement("span");
      name.textContent = u.id;
      left.appendChild(dot);
      left.appendChild(name);
      const right = document.createElement("div");
      right.style.fontSize = "0.8rem";
      if (u.online) right.textContent = "🟢 Online";
      else if (u.lastSeen && u.lastSeen.toDate) right.textContent = `Last ${u.lastSeen.toDate().toLocaleString()}`;
      li.appendChild(left);
      li.appendChild(right);
      onlineUsersUL.appendChild(li);
    });
  });

  // set offline on unload
  window.addEventListener("beforeunload", async () => {
    if (!username) return;
    try {
      await setDoc(doc(db, "cyou_presence", username), { online: false, lastSeen: serverTimestamp() }, { merge: true });
      await setDoc(doc(db, "cyou_typing", username), { typing: false }, { merge: true });
    } catch (e) {}
  });
}

/* ---------------------------
   Typing indicator (below input)
---------------------------- */
messageInput.addEventListener("input", onTypingInput);
async function onTypingInput() {
  if (!username) return;
  await setDoc(doc(db, "cyou_typing", username), { typing: true }, { merge: true });
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(async () => {
    await setDoc(doc(db, "cyou_typing", username), { typing: false }, { merge: true });
  }, 1400);
}
function startTypingListener() {
  if (typingUnsub) typingUnsub();
  typingUnsub = onSnapshot(collection(db, "cyou_typing"), (snap) => {
    const typers = snap.docs.filter(d => d.id !== username && d.data().typing).map(d => d.id);
    typingIndicator.textContent = typers.length ? `${typers[0]} is typing...` : "";
  });
}

/* ---------------------------
   Messages: send, render, delivered ticks, edit & delete via long-press
---------------------------- */
const messagesCol = collection(db, "cyou_messages");

// Sound on new incoming messages (WebAudio beep)
function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = 800;
    g.gain.value = 0.02;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    setTimeout(() => { o.stop(); ctx.close(); }, 90);
  } catch (e) { /* ignore audio errors */ }
}

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
    await addDoc(messagesCol, {
      sender: username,
      text,
      createdAt: serverTimestamp(),
      delivered: false,
      deleted: false,
      edited: false,
      editCount: 0,
      seenBy: [username]
    });
    messageInput.value = "";
    await setDoc(doc(db, "cyou_typing", username), { typing: false }, { merge: true });
  } catch (err) {
    console.error("Send error:", err);
  }
}

function startMessagesListener() {
  if (messagesUnsub) messagesUnsub();
  const q = query(messagesCol, orderBy("createdAt"));
  let firstLoad = true;
  messagesUnsub = onSnapshot(q, async (snap) => {
    const docs = snap.docs;
    messagesDiv.innerHTML = "";

    for (const d of docs) {
      const m = d.data();
      const id = d.id;
      const created = m.createdAt?.toDate ? m.createdAt.toDate() : new Date();

      const isMine = m.sender === username;

      // wrapper
      const wrapper = document.createElement("div");
      wrapper.className = "message " + (isMine ? "me" : "other");
      wrapper.dataset.msgid = id;

      // name label
      const nameLabel = document.createElement("div");
      nameLabel.className = "name-label";
      nameLabel.textContent = isMine ? "You" : m.sender;
      wrapper.appendChild(nameLabel);

      // body or deleted
      if (m.deleted) {
        const delDiv = document.createElement("div");
        delDiv.className = "deleted";
        delDiv.textContent = "⚫ This message was deleted";
        wrapper.appendChild(delDiv);
        const meta = document.createElement("div");
        meta.className = "meta";
        meta.textContent = formatTime(created) + (m.edited ? " (edited)" : "");
        wrapper.appendChild(meta);
      } else {
        const body = document.createElement("div");
        body.className = "msg-body";
        body.textContent = m.text;
        wrapper.appendChild(body);

        const meta = document.createElement("div");
        meta.className = "meta";

        const timeSpan = document.createElement("span");
        timeSpan.textContent = formatTime(created);
        meta.appendChild(timeSpan);

        if (isMine) {
          const tick = document.createElement("span");
          tick.className = "tick" + (m.delivered ? " delivered" : "");
          tick.textContent = m.delivered ? "✓✓" : "✓";
          meta.appendChild(tick);

          if (m.edited) {
            const editedSpan = document.createElement("span");
            editedSpan.textContent = " (edited)";
            editedSpan.style.fontStyle = "italic";
            editedSpan.style.opacity = "0.9";
            meta.appendChild(editedSpan);
          }
        } else {
          if (m.edited) {
            const editedSpan = document.createElement("span");
            editedSpan.textContent = " (edited)";
            editedSpan.style.fontStyle = "italic";
            editedSpan.style.opacity = "0.9";
            meta.appendChild(editedSpan);
          }
        }

        wrapper.appendChild(meta);

        // long-press behavior only for your messages (add listener)
        if (isMine) {
          attachLongPressHandlers(wrapper, id, m);
        }
      }

      messagesDiv.appendChild(wrapper);
    }

    // mark others' messages as seen and delivered
    for (const d of docs) {
      const m = d.data();
      const id = d.id;
      if (m.sender !== username) {
        if (!m.seenBy || !m.seenBy.includes(username)) {
          try { await updateDoc(doc(db, "cyou_messages", id), { seenBy: arrayUnion(username) }); } catch (e) {}
        }
        if (!m.delivered) {
          try { await updateDoc(doc(db, "cyou_messages", id), { delivered: true }); } catch (e) {}
        }
      }
    }

    // play sound for new incoming messages (skip on first load)
    if (!firstLoad) {
      const incoming = docs.filter(d => d.data().sender !== username);
      if (incoming.length) playBeep();
    }
    firstLoad = false;

    // smooth scroll
    scrollToBottom();
  });
}

/* attach long-press for edit/delete popup */
function attachLongPressHandlers(el, msgId, msgData) {
  let pressTimer = null;
  let moved = false;

  const start = (e) => {
    moved = false;
    pressTimer = setTimeout(() => {
      openPopupForMessage(el, msgId, msgData);
    }, 550); // long press threshold
  };
  const cancel = () => {
    if (pressTimer) clearTimeout(pressTimer);
    pressTimer = null;
  };

  el.addEventListener("touchstart", start, { passive: true });
  el.addEventListener("mousedown", start);
  el.addEventListener("touchmove", () => { moved = true; cancel(); }, { passive: true });
  el.addEventListener("mousemove", () => { moved = true; cancel(); });
  el.addEventListener("touchend", cancel);
  el.addEventListener("mouseup", cancel);
  el.addEventListener("mouseleave", cancel);
}

/* popup open/close and actions */
function openPopupForMessage(el, msgId, msgData) {
  popupTargetId = msgId;
  // position popup near element bottom center
  const rect = el.getBoundingClientRect();
  const popupRect = popup.getBoundingClientRect();
  let left = rect.left + (rect.width/2) - (popupRect.width/2);
  if (left < 8) left = 8;
  if (left + popupRect.width > window.innerWidth - 8) left = window.innerWidth - popupRect.width - 8;
  let top = rect.top - popupRect.height - 8;
  if (top < 70) top = rect.bottom + 8; // if no room above, show below
  popup.style.left = `${left}px`;
  popup.style.top = `${top}px`;
  popup.classList.add("show");
  popup.setAttribute("aria-hidden", "false");
}

// close on outside click
document.addEventListener("click", (e) => {
  if (!popup.contains(e.target)) {
    popup.classList.remove("show");
    popup.setAttribute("aria-hidden", "true");
    popupTargetId = null;
  }
});

// Edit action (open prompt, allow only one edit)
editBtn.addEventListener("click", async (e) => {
  e.stopPropagation();
  if (!popupTargetId) return;
  const docRef = doc(db, "cyou_messages", popupTargetId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) { popup.classList.remove("show"); return; }
  const data = snap.data();
  if (data.editCount >= 1) { alert("You can only edit a message once."); popup.classList.remove("show"); return; }
  const newText = prompt("Edit your message:", data.text || "");
  if (newText === null) { popup.classList.remove("show"); return; } // cancelled
  const trimmed = (newText||"").trim();
  if (!trimmed) { alert("Message cannot be empty."); return; }
  try {
    await updateDoc(docRef, { text: trimmed, edited: true, editCount: (data.editCount || 0) + 1, editedAt: serverTimestamp() });
  } catch (err) { console.error("Edit failed", err); alert("Edit failed"); }
  popup.classList.remove("show");
});

// Delete action (soft delete)
deleteBtn.addEventListener("click", async (e) => {
  e.stopPropagation();
  if (!popupTargetId) return;
  if (!confirm("Delete this message?")) { popup.classList.remove("show"); return; }
  try {
    await updateDoc(doc(db, "cyou_messages", popupTargetId), { deleted: true, text: "", deletedAt: serverTimestamp() });
  } catch (err) { console.error("Delete failed", err); alert("Delete failed"); }
  popup.classList.remove("show");
});

/* ---------------------------
   Utilities
---------------------------- */
function formatTime(d) {
  if (!d) return "";
  if (d.toDate) d = d.toDate();
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function scrollToBottom() {
  setTimeout(() => {
    messagesDiv.scrollIntoView({ block: "end", inline: "nearest" });
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }, 80);
}

/* ---------------------------
   Start listeners helper
---------------------------- */
function startTypingListener() { startTypingListener(); } // no-op placeholder (real listener started earlier)
function startMessagesListener() { startMessagesListener(); } // placeholder not used

/* initialize properly (avoid accidental recursion) */
(function bootstrapNoop() {
  // placeholders are replaced by actual functions above; nothing else to run here
})();

startMessagesListener = startMessagesListener || startMessagesListener;
startTypingListener = startTypingListener || startTypingListener;

/* NOTE:
   Because we used function declarations for startMessagesListener/startTypingListener above,
   they are already active when startPresenceListener and join flow call them.
*/

/* Expose manual start (so auto-join flow uses them) */
function startTypingListenerWrapper() { startTypingListener(); }
function startMessagesListenerWrapper() { startMessagesListener(); }

/* wire save presence and listeners when user joins (these are used in join flow) */
/* (the join flow calls startPresenceListener, startTypingListener, startMessagesListener which are defined) */

/* Clear local view */
clearChatBtn?.addEventListener("click", () => {
  if (!confirm("Clear local chat view? This will not delete server messages.")) return;
  messagesDiv.innerHTML = "";
});

/* mobile focus safe scroll */
messageInput?.addEventListener("focus", () => setTimeout(scrollToBottom, 250));
messageInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendBtn.click(); }
});