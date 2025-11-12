// script.js — Removed presence/sidebar; typing below input; name color tweaks
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import {
  getAuth, signInAnonymously, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, serverTimestamp,
  onSnapshot, query, orderBy, doc, setDoc, getDoc, updateDoc, arrayUnion
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

/* firebase config (unchanged) */
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

/* DOM */
const joinSection = document.getElementById("joinSection");
const chatSection = document.getElementById("chatSection");
const nameInput = document.getElementById("nameInput");
const enterBtn = document.getElementById("enterBtn");
const joinHint = document.getElementById("joinHint");

const messagesDiv = document.getElementById("messages");
const typingIndicator = document.getElementById("typingIndicator");

const sendForm = document.getElementById("sendForm");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");

const themeToggle = document.getElementById("themeToggle");
const clearChatBtn = document.getElementById("clearChatBtn");

const popup = document.getElementById("msgPopup");
const editBtn = document.getElementById("editBtn");
const deleteBtn = document.getElementById("deleteBtn");

/* state */
let username = localStorage.getItem("cyou_username") || "";
let messagesUnsub = null, typingUnsub = null;
let typingTimeout = null;
let popupTargetId = null;

/* auth */
signInAnonymously(auth);
onAuthStateChanged(auth, user => console.log("Anon uid:", user?.uid));

/* theme restore */
const savedTheme = localStorage.getItem("cyou_theme") || "light";
if (savedTheme === "dark") document.body.classList.add("dark");
themeToggle?.addEventListener("click", () => {
  const next = document.body.classList.contains("dark") ? "light" : "dark";
  document.body.classList.toggle("dark");
  localStorage.setItem("cyou_theme", next);
});

/* auto-join without presence check (allow same nickname on multiple devices) */
if (username) {
  joinSection.style.display = "none";
  chatSection.style.display = "flex";
  startTypingListener();
  startMessagesListener();
} else {
  joinSection.style.display = "flex";
  chatSection.style.display = "none";
}

/* join flow (no presence collection used) */
enterBtn.addEventListener("click", async () => {
  const name = nameInput.value.trim();
  if (!name) { joinHint.textContent = "Enter a nickname."; return; }
  username = name;
  localStorage.setItem("cyou_username", username);
  joinHint.textContent = "";
  joinSection.style.display = "none";
  chatSection.style.display = "flex";
  startTypingListener();
  startMessagesListener();
});

/* typing indicator (below input) */
messageInput.addEventListener("input", onTypingInput);
async function onTypingInput() {
  if (!username) return;
  try {
    await setDoc(doc(db, "cyou_typing", username), { typing: true }, { merge: true });
  } catch (e) {}
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(async () => {
    try { await setDoc(doc(db, "cyou_typing", username), { typing: false }, { merge: true }); } catch(e) {}
  }, 1400);
}

function startTypingListener() {
  if (typingUnsub) typingUnsub();
  typingUnsub = onSnapshot(collection(db, "cyou_typing"), snap => {
    const typers = snap.docs.filter(d => d.id !== username && d.data().typing).map(d => d.id);
    typingIndicator.textContent = typers.length ? `${typers[0]} is typing...` : "";
  });
}

/* messages */
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
    try { await setDoc(doc(db, "cyou_typing", username), { typing: false }, { merge: true }); } catch(e){}
  } catch (err) { console.error("Send error", err); }
}

function startMessagesListener() {
  if (messagesUnsub) messagesUnsub();
  const q = query(messagesCol, orderBy("createdAt"));
  let firstLoad = true;
  messagesUnsub = onSnapshot(q, async (snap) => {
    messagesDiv.innerHTML = "";
    const docs = snap.docs;

    for (const d of docs) {
      const m = d.data();
      const id = d.id;
      const created = m.createdAt?.toDate ? m.createdAt.toDate() : new Date();
      const isMine = m.sender === username;

      const wrapper = document.createElement("div");
      wrapper.className = "message " + (isMine ? "me" : "other");
      wrapper.dataset.msgid = id;

      // name label with requested colors
      const nameLabel = document.createElement("div");
      nameLabel.className = "name-label " + (isMine ? "me" : "other");
      nameLabel.textContent = isMine ? "You" : m.sender;
      wrapper.appendChild(nameLabel);

      if (m.deleted) {
        const delDiv = document.createElement("div");
        delDiv.className = "deleted";
        delDiv.textContent = "⚫ This message was deleted";
        wrapper.appendChild(delDiv);
        const meta = document.createElement("div"); meta.className = "meta";
        meta.textContent = formatTime(created) + (m.edited ? " (edited)" : "");
        wrapper.appendChild(meta);
      } else {
        const body = document.createElement("div"); body.className = "msg-body"; body.textContent = m.text;
        wrapper.appendChild(body);

        const meta = document.createElement("div"); meta.className = "meta";
        const timeSpan = document.createElement("span"); timeSpan.textContent = formatTime(created);
        meta.appendChild(timeSpan);

        if (isMine) {
          const tick = document.createElement("span"); tick.className = "tick" + (m.delivered ? " delivered" : "");
          tick.textContent = m.delivered ? "✓✓" : "✓";
          meta.appendChild(tick);
          if (m.edited) {
            const editedSpan = document.createElement("span"); editedSpan.textContent = " (edited)"; editedSpan.style.fontStyle="italic"; editedSpan.style.opacity="0.9";
            meta.appendChild(editedSpan);
          }
          // attach long-press handlers for edit/delete (only for own messages)
          attachLongPressHandlers(wrapper, id, m);
        } else {
          if (m.edited) {
            const editedSpan = document.createElement("span"); editedSpan.textContent = " (edited)"; editedSpan.style.fontStyle="italic"; editedSpan.style.opacity="0.9";
            meta.appendChild(editedSpan);
          }
        }

        wrapper.appendChild(meta);
      }

      messagesDiv.appendChild(wrapper);
    }

    // for each other's messages, add seenBy and mark delivered
    for (const d of docs) {
      const m = d.data();
      const id = d.id;
      if (m.sender !== username) {
        if (!m.seenBy || !m.seenBy.includes(username)) {
          try { await updateDoc(doc(db, "cyou_messages", id), { seenBy: arrayUnion(username) }); } catch(e){}
        }
        if (!m.delivered) {
          try { await updateDoc(doc(db, "cyou_messages", id), { delivered: true }); } catch(e){}
        }
      }
    }

    // play sound on new incoming messages (skip the first snapshot)
    if (!firstLoad) {
      const incoming = docs.filter(d => d.data().sender !== username);
      if (incoming.length) playBeep();
    }
    firstLoad = false;

    // smooth scroll
    scrollToBottom();
  });
}

/* long-press handlers (same popup as before) */
function attachLongPressHandlers(el, msgId, msgData) {
  let pressTimer = null;
  let moved = false;

  const start = (e) => {
    moved = false;
    pressTimer = setTimeout(() => {
      openPopupForMessage(el, msgId, msgData);
    }, 550);
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

/* popup open/close and actions (edit once + soft delete) */
function openPopupForMessage(el, msgId, msgData) {
  popupTargetId = msgId;
  const rect = el.getBoundingClientRect();
  const popupRect = popup.getBoundingClientRect();
  let left = rect.left + (rect.width/2) - (popupRect.width/2);
  if (left < 8) left = 8;
  if (left + popupRect.width > window.innerWidth - 8) left = window.innerWidth - popupRect.width - 8;
  let top = rect.top - popupRect.height - 8;
  if (top < 64) top = rect.bottom + 8;
  popup.style.left = `${left}px`;
  popup.style.top = `${top}px`;
  popup.classList.add("show");
  popup.setAttribute("aria-hidden","false");
}
document.addEventListener("click", (e) => {
  if (!popup.contains(e.target)) { popup.classList.remove("show"); popup.setAttribute("aria-hidden","true"); popupTargetId = null; }
});

/* Edit action */
editBtn.addEventListener("click", async (e) => {
  e.stopPropagation();
  if (!popupTargetId) return;
  const docRef = doc(db, "cyou_messages", popupTargetId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) { popup.classList.remove("show"); return; }
  const data = snap.data();
  if (data.editCount >= 1) { alert("You can only edit a message once."); popup.classList.remove("show"); return; }
  const newText = prompt("Edit your message:", data.text || "");
  if (newText === null) { popup.classList.remove("show"); return; }
  const trimmed = (newText||"").trim();
  if (!trimmed) { alert("Message cannot be empty."); return; }
  try {
    await updateDoc(docRef, { text: trimmed, edited: true, editCount: (data.editCount || 0) + 1, editedAt: serverTimestamp() });
  } catch (err) { console.error("Edit failed", err); alert("Edit failed"); }
  popup.classList.remove("show");
});

/* Delete action */
deleteBtn.addEventListener("click", async (e) => {
  e.stopPropagation();
  if (!popupTargetId) return;
  if (!confirm("Delete this message?")) { popup.classList.remove("show"); return; }
  try {
    await updateDoc(doc(db, "cyou_messages", popupTargetId), { deleted: true, text: "", deletedAt: serverTimestamp() });
  } catch (err) { console.error("Delete failed", err); alert("Delete failed"); }
  popup.classList.remove("show");
});

/* beep sound (incoming) */
function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine"; o.frequency.value = 900; g.gain.value = 0.015;
    o.connect(g); g.connect(ctx.destination); o.start();
    setTimeout(()=>{ o.stop(); ctx.close(); }, 90);
  } catch (e) {}
}

/* helpers */
function formatTime(d) { if (!d) return ""; if (d.toDate) d = d.toDate(); return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
function scrollToBottom() { setTimeout(()=>{ messagesDiv.scrollTop = messagesDiv.scrollHeight; }, 80); }

/* clear local view */
clearChatBtn?.addEventListener("click", () => { if (!confirm("Clear local chat view? This will not delete server messages.")) return; messagesDiv.innerHTML = ""; });

/* make input stay visible */
messageInput?.addEventListener("focus", () => setTimeout(scrollToBottom, 250));
messageInput?.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendBtn.click(); }});