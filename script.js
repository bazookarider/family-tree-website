// script.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import {
  getAuth, signInAnonymously, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, serverTimestamp,
  onSnapshot, query, orderBy, doc, setDoc, getDoc, updateDoc, getDocs
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

/* ----- FIREBASE CONFIG (kept as you requested) ----- */
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

/* ----- DOM Elements ----- */
const joinSection = document.getElementById("joinSection");
const chatSection = document.getElementById("chatSection");
const nameInput = document.getElementById("nameInput");
const enterBtn = document.getElementById("enterBtn");
const joinHint = document.getElementById("joinHint");

const messagesDiv = document.getElementById("messages");
const typingIndicator = document.getElementById("typingIndicator");
const onlineCount = document.getElementById("onlineCount");
const onlineUsers = document.getElementById("onlineUsers");

const sendForm = document.getElementById("sendForm") || (() => {
  // if form id differs create a shim for compatibility
  const form = document.createElement("form");
  form.id = "sendForm";
  return form;
})();
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const themeToggle = document.getElementById("themeToggle");
const clearChatBtn = document.getElementById("clearChatBtn");

/* ----- State ----- */
let username = "";
let typingTimeout = null;
let messagesUnsub = null;
let presenceUnsub = null;
let typingUnsub = null;

/* ----- Auth ----- */
signInAnonymously(auth);
onAuthStateChanged(auth, (user) => {
  if (user) console.log("Firebase anonymous UID:", user.uid);
});

/* ----- Theme restore ----- */
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

/* ----- Auto-login if name saved ----- */
const savedName = localStorage.getItem("cyou_username");
if (savedName) {
  // attempt quick join (but check presence doc; if online we won't override)
  attemptJoin(savedName, true);
}

/* ----- Join logic + duplicate name prevention ----- */
enterBtn.addEventListener("click", async () => {
  const name = nameInput.value.trim();
  if (!name) {
    joinHint.textContent = "Enter a name first.";
    return;
  }
  attemptJoin(name, false);
});

async function attemptJoin(name, auto) {
  try {
    const presRef = doc(db, "cyou_presence", name);
    const presSnap = await getDoc(presRef);
    if (presSnap.exists() && presSnap.data()?.online) {
      if (!auto) {
        joinHint.textContent = "⚠️ This name already exists (online). Choose another.";
        return;
      } else {
        // auto-join but presence is online -- treat as cannot auto join
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
    console.error("Join error:", err);
    joinHint.textContent = "Error joining. See console.";
  }
}

/* ----- Presence listener (online users, count) ----- */
function startPresenceListener() {
  if (presenceUnsub) presenceUnsub();
  presenceUnsub = onSnapshot(collection(db, "cyou_presence"), (snap) => {
    const users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    // show count
    const online = users.filter(u => u.online).length;
    onlineCount.textContent = online;

    // list
    onlineUsers.innerHTML = "";
    users.forEach(u => {
      const li = document.createElement("li");
      const left = document.createElement("div");
      left.style.display = "flex";
      left.style.alignItems = "center";
      left.style.gap = "8px";
      const dot = document.createElement("span");
      dot.style.width = "10px";
      dot.style.height = "10px";
      dot.style.borderRadius = "50%";
      dot.style.background = u.online ? "#00b894" : "#bbb";
      left.appendChild(dot);
      const name = document.createElement("span");
      name.textContent = u.id;
      left.appendChild(name);
      const right = document.createElement("div");
      right.style.fontSize = "0.8rem";
      if (u.online) right.textContent = "🟢 Online";
      else if (u.lastSeen && u.lastSeen.toDate) right.textContent = `Last ${u.lastSeen.toDate().toLocaleString()}`;
      li.appendChild(left);
      li.appendChild(right);
      onlineUsers.appendChild(li);
    });
  });

  // mark offline on unload
  window.addEventListener("beforeunload", async () => {
    if (!username) return;
    try {
      await setDoc(doc(db, "cyou_presence", username), { online: false, lastSeen: serverTimestamp() }, { merge: true });
      await setDoc(doc(db, "cyou_typing", username), { typing: false }, { merge: true });
    } catch (e) { /* ignore */ }
  });
}

/* ----- Typing indicator (simple) ----- */
messageInput.addEventListener("input", () => {
  setTyping(true);
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => setTyping(false), 1400);
});

async function setTyping(state) {
  if (!username) return;
  try {
    await setDoc(doc(db, "cyou_typing", username), { typing: state }, { merge: true });
  } catch (err) {
    console.error("setTyping err", err);
  }
}

function startTypingListener() {
  if (typingUnsub) typingUnsub();
  typingUnsub = onSnapshot(collection(db, "cyou_typing"), (snap) => {
    const typers = snap.docs.filter(d => d.id !== username && d.data().typing).map(d => d.id);
    if (typers.length) {
      typingIndicator.innerHTML = `${typers.join(", ")} typing <span class="dot"></span><span class="dot"></span><span class="dot"></span>`;
    } else {
      typingIndicator.innerHTML = "";
    }
  });
}

/* ----- Messages: send, render, mark delivered ----- */
const messagesCol = collection(db, "cyou_messages");

sendForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  await doSendMessage();
});
sendBtn?.addEventListener("click", async (e) => {
  e.preventDefault();
  await doSendMessage();
});

async function doSendMessage() {
  if (!username) {
    alert("Please join first.");
    return;
  }
  const text = (messageInput.value || "").trim();
  if (!text) return;
  try {
    // create message: sender includes username, sent=true (document exists), delivered=false for now
    await addDoc(messagesCol, {
      sender: username,
      text,
      createdAt: serverTimestamp(),
      sent: true,
      delivered: false,
      deleted: false
    });
    messageInput.value = "";
    setTyping(false);
    // auto-scroll after small delay to allow snapshot render
    setTimeout(() => scrollToBottom(), 150);
  } catch (err) {
    console.error("Send error", err);
    alert("Error sending message");
  }
}

/* Render messages and mark delivered when other clients read them */
function startMessagesListener() {
  if (messagesUnsub) messagesUnsub();
  const q = query(messagesCol, orderBy("createdAt"));
  messagesUnsub = onSnapshot(q, async (snap) => {
    // Render messages in order
    messagesDiv.innerHTML = "";
    const docs = snap.docs; // ordered
    for (const docSnap of docs) {
      const m = docSnap.data();
      const id = docSnap.id;
      const created = m.createdAt?.toDate ? m.createdAt.toDate() : new Date();
      const isMine = m.sender === username;

      // message wrapper
      const el = document.createElement("div");
      el.className = "message " + (isMine ? "me" : "other");

      // if deleted show placeholder
      if (m.deleted) {
        el.innerHTML = `<div class="msg-top">${escapeHtml(m.sender)}</div>
                        <div class="deleted">⚫ This message was deleted</div>
                        <div class="meta"><span>${formatTime(created)}</span></div>`;
      } else {
        const textHtml = `<div class="msg-top">${escapeHtml(m.sender)}</div>
                          <div class="msg-body">${escapeHtml(m.text)}</div>`;
        const metaDiv = document.createElement("div");
        metaDiv.className = "meta";
        // tick logic: if mine show ✓ (sent) or ✓✓ (delivered)
        if (isMine) {
          const tick = document.createElement("span");
          tick.className = "tick " + (m.delivered ? "delivered" : "");
          tick.textContent = m.delivered ? "✓✓" : "✓";
          const timeSpan = document.createElement("span");
          timeSpan.textContent = formatTime(created);
          metaDiv.appendChild(timeSpan);
          metaDiv.appendChild(tick);
        } else {
          // others just show time
          metaDiv.textContent = formatTime(created);
        }

        el.innerHTML = textHtml;
        el.appendChild(metaDiv);

        // if mine and not deleted add delete button (sender only)
        if (isMine && !m.deleted) {
          const actions = document.createElement("div");
          actions.className = "msg-actions";
          const delBtn = document.createElement("button");
          delBtn.className = "msg-btn";
          delBtn.title = "Delete message";
          delBtn.innerText = "🗑️";
          delBtn.addEventListener("click", () => deleteMessage(id));
          actions.appendChild(delBtn);
          el.appendChild(actions);
        }
      }

      messagesDiv.appendChild(el);
    }

    // After rendering, mark messages as delivered if:
    // - the message is NOT from this client (m.sender != username)
    // - and delivered === false
    // The idea: when a client loads a message that is not theirs, they set delivered:true so sender sees ✓✓.
    for (const docSnap of docs) {
      const m = docSnap.data();
      const id = docSnap.id;
      if (m.sender !== username && !m.delivered && m.sent) {
        try {
          await updateDoc(doc(db, "cyou_messages", id), { delivered: true });
        } catch (e) {
          // ignore per-message update errors (concurrency possible)
        }
      }
    }

    scrollToBottom();
  });
}

/* delete message - soft-delete */
async function deleteMessage(messageId) {
  if (!confirm("Delete this message?")) return;
  try {
    await updateDoc(doc(db, "cyou_messages", messageId), {
      deleted: true,
      text: "",
      deletedAt: serverTimestamp()
    });
  } catch (err) {
    console.error("Delete error", err);
    alert("Failed to delete message");
  }
}

/* Clear local chat (UI only) */
clearChatBtn?.addEventListener("click", () => {
  if (!confirm("Clear local chat view? This will not delete messages on the server.")) return;
  messagesDiv.innerHTML = "";
});

/* Utils */
function formatTime(d) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function escapeHtml(s) {
  if (!s) return "";
  return s.toString().replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
}
function scrollToBottom() {
  // scroll messagesDiv so last message visible
  const last = messagesDiv.lastElementChild;
  if (last) last.scrollIntoView({ behavior: "smooth", block: "end" });
}

/* Make sure input is visible when keyboard appears on mobile */
messageInput?.addEventListener("focus", () => {
  setTimeout(scrollToBottom, 300);
});
messageInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    doSendMessage();
  }
});

// compatibility: make sendForm work if not present
if (!document.getElementById("sendForm")) {
  // attach submit to sendBtn
  sendBtn?.addEventListener("click", async (e) => {
    e.preventDefault();
    await doSendMessage();
  });
}

/* helper used in send key handler */
async function doSendMessage() {
  // reuse doSendMessage logic above:
  // To avoid duplication, call click on send button
  sendBtn?.click();
}