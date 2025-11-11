// script.js (full updated)
// Keep your Firebase project config — unchanged
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import {
  getAuth, signInAnonymously, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, serverTimestamp,
  onSnapshot, query, orderBy, doc, setDoc, deleteDoc, updateDoc,
  arrayUnion, arrayRemove, getDoc
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

/* ---------------------------
   🔥 CYOU Firebase Config (unchanged)
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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* ---------------------------
   🌐 DOM Elements
---------------------------- */
const joinSection = document.getElementById("joinSection");
const chatSection = document.getElementById("chatSection");
const nameInput = document.getElementById("nameInput");
const enterBtn = document.getElementById("enterBtn");
const messageInput = document.getElementById("messageInput");
const sendForm = document.getElementById("sendForm");
const messagesDiv = document.getElementById("messages");
const typingIndicator = document.getElementById("typingIndicator");
const onlineCount = document.getElementById("onlineCount");
const onlineUsersUL = document.getElementById("onlineUsers");
const joinHint = document.getElementById("joinHint");
const themeToggle = document.getElementById("themeToggle");
const clearChatBtn = document.getElementById("clearChatBtn");

let username = "";
let typingTimeout;
let presenceUnsubscribe = null;
let messagesUnsubscribe = null;
let typingUnsubscribe = null;

/* ---------------------------
   👤 Auth (anonymous)
---------------------------- */
signInAnonymously(auth);
onAuthStateChanged(auth, (user) => {
  if (user) console.log("Signed in anonymously:", user.uid);
});

/* ---------------------------
   ✨ Theme: restore/save
---------------------------- */
function applyTheme(saved) {
  if (saved === "dark") document.body.classList.add("dark");
  else document.body.classList.remove("dark");
}
const savedTheme = localStorage.getItem("cyou_theme") || "light";
applyTheme(savedTheme);
themeToggle.addEventListener("click", () => {
  const current = document.body.classList.contains("dark") ? "dark" : "light";
  const next = current === "dark" ? "light" : "dark";
  localStorage.setItem("cyou_theme", next);
  applyTheme(next);
});

/* ---------------------------
   ✅ Auto-login if username saved
---------------------------- */
const savedName = localStorage.getItem("cyou_username");
if (savedName) {
  nameInput.value = savedName;
  attemptJoin(savedName, true); // auto join (bypass duplicate check if not online)
}

/* ---------------------------
   🚪 Join flow
---------------------------- */
enterBtn.addEventListener("click", () => {
  const name = nameInput.value.trim();
  if (!name) return alert("Please enter your name first!");
  attemptJoin(name, false);
});

async function attemptJoin(name, isAuto) {
  // check presence doc to prevent duplicate online usernames
  try {
    const presRef = doc(db, "cyou_presence", name);
    const presSnap = await getDoc(presRef);
    if (presSnap.exists()) {
      const data = presSnap.data();
      if (data.online && !isAuto) {
        joinHint.textContent = "⚠️ This name already exists (online). Choose another.";
        return;
      }
    }
    // proceed to join
    username = name;
    localStorage.setItem("cyou_username", username);
    joinSection.style.display = "none";
    chatSection.style.display = "flex";
    joinHint.textContent = "";
    addPresence();
    listenForMessages();
    listenForTyping();
  } catch (err) {
    console.error("Join error:", err);
    alert("Error joining chat. Check console.");
  }
}

/* ---------------------------
   👥 Presence / online count / last seen
---------------------------- */
async function addPresence() {
  const userRef = doc(db, "cyou_presence", username);
  // set online true
  await setDoc(userRef, { online: true, lastSeen: serverTimestamp() }, { merge: true });

  // watch presence collection
  presenceUnsubscribe = onSnapshot(collection(db, "cyou_presence"), (snap) => {
    const users = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    // update online count
    const onlineUsers = users.filter(u => u.online).length;
    onlineCount.textContent = onlineUsers;

    // update list UI
    onlineUsersUL.innerHTML = "";
    users.forEach(u => {
      const li = document.createElement("li");
      const left = document.createElement("div");
      left.className = "user-left";
      const dot = document.createElement("span");
      dot.className = "user-dot" + (u.online ? " online" : "");
      left.appendChild(dot);
      const nameSpan = document.createElement("span");
      nameSpan.textContent = u.id;
      left.appendChild(nameSpan);

      const right = document.createElement("div");
      right.className = "user-right";
      if (u.online) right.textContent = "🟢 Online";
      else if (u.lastSeen && u.lastSeen.toDate) {
        const d = u.lastSeen.toDate();
        right.textContent = `Last seen ${d.toLocaleString()}`;
      } else right.textContent = "";
      li.appendChild(left);
      li.appendChild(right);
      onlineUsersUL.appendChild(li);
    });
  });

  // on unload mark offline and lastSeen
  window.addEventListener("beforeunload", async () => {
    try {
      await setDoc(userRef, { online: false, lastSeen: serverTimestamp() }, { merge: true });
    } catch (e) { /* ignore */ }
  });

  // also set offline when user explicitly clears name (logout) - not implemented UI, but safe
}

/* ---------------------------
   ✍️ Typing indicator handling
---------------------------- */
messageInput.addEventListener("input", handleTyping);
async function handleTyping() {
  await setTyping(true);
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => setTyping(false), 1800);
}
async function setTyping(state) {
  try {
    await setDoc(doc(db, "cyou_typing", username), { typing: state }, { merge: true });
  } catch (err) {
    console.error("setTyping err", err);
  }
}
function listenForTyping() {
  typingUnsubscribe = onSnapshot(collection(db, "cyou_typing"), (snap) => {
    const typers = snap.docs
      .filter(d => d.id !== username && d.data().typing)
      .map(d => d.id);
    if (typers.length) {
      typingIndicator.innerHTML = `${typers.join(", ")} typing <span class="dot"></span><span class="dot"></span><span class="dot"></span>`;
    } else typingIndicator.innerHTML = "";
  });
}

/* ---------------------------
   💬 Send message + seen handling + delete
---------------------------- */
sendForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = messageInput.value.trim();
  if (!text) return;
  try {
    // add message with seenBy array (sender included so we can show a single tick immediately)
    const docRef = await addDoc(collection(db, "cyou_messages"), {
      name: username,
      text,
      createdAt: serverTimestamp(),
      deleted: false,
      seenBy: [username]
    });
    messageInput.value = "";
    setTyping(false);
    // scroll handled by snapshot listener
  } catch (err) {
    console.error("Send message error", err);
  }
});

function listenForMessages() {
  const q = query(collection(db, "cyou_messages"), orderBy("createdAt"));
  // unsubscribe previous if any
  if (messagesUnsubscribe) messagesUnsubscribe();
  messagesUnsubscribe = onSnapshot(q, async (snapshot) => {
    // Build an array of docs sorted; we'll render grouped by date
    const docs = snapshot.docs.map(docSnap => ({ id: docSnap.id, ref: docSnap.ref, data: docSnap.data() }));
    // Mark messages as seen by this user (for messages not by them and not containing this user in seenBy)
    const toMarkSeen = docs.filter(d => d.data.name !== username && (!d.data.seenBy || !d.data.seenBy.includes(username)));
    for (const d of toMarkSeen) {
      try {
        await updateDoc(d.ref, { seenBy: arrayUnion(username) });
      } catch (e) {
        // ignore per-doc update errors
      }
    }

    // Render grouped by date
    messagesDiv.innerHTML = "";
    let lastDateKey = null;
    for (const d of docs) {
      const msg = d.data;
      const created = msg.createdAt?.toDate ? msg.createdAt.toDate() : new Date();
      const dateKey = created.toDateString();
      if (dateKey !== lastDateKey) {
        // insert date separator
        const sep = document.createElement("div");
        sep.className = "date-sep";
        const today = new Date();
        const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
        if (created.toDateString() === today.toDateString()) sep.textContent = "Today";
        else if (created.toDateString() === yesterday.toDateString()) sep.textContent = "Yesterday";
        else sep.textContent = created.toLocaleDateString();
        messagesDiv.appendChild(sep);
        lastDateKey = dateKey;
      }

      const isYou = msg.name === username;
      const wrapper = document.createElement("div");
      wrapper.classList.add("message", isYou ? "me" : "other");

      // if deleted show deleted placeholder
      if (msg.deleted) {
        wrapper.innerHTML = `<div class="deleted">⚫ This message was deleted</div>
          <div class="meta-row"><div>${formatTime(created)}</div></div>`;
      } else {
        // normal message
        wrapper.innerHTML = `
          <div class="msg-top">${msg.name}</div>
          <div class="msg-body">${escapeHtml(msg.text)}</div>
          <div class="meta-row">
            <div>${formatTime(created)}</div>
          </div>
        `;
        // ticks
        const metaRow = wrapper.querySelector(".meta-row");
        if (isYou) {
          // if someone else has seen (seenBy length>1) show double tick
          const seenCount = msg.seenBy ? msg.seenBy.filter(n => n !== username).length : 0;
          const tick = document.createElement("span");
          tick.className = "tick " + (seenCount > 0 ? "seen" : "");
          tick.textContent = seenCount > 0 ? "✓✓" : "✓";
          metaRow.appendChild(tick);
        }
      }

      // add delete button for sender if not deleted
      if (isYou && !msg.deleted) {
        const btn = document.createElement("button");
        btn.className = "msg-btn";
        btn.title = "Delete message";
        btn.innerHTML = "🗑️";
        btn.addEventListener("click", () => confirmAndDelete(d.id));
        // place a small container
        const actions = document.createElement("div");
        actions.className = "msg-actions";
        actions.appendChild(btn);
        wrapper.appendChild(actions);
      }

      messagesDiv.appendChild(wrapper);
    }

    // autoscroll to bottom
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  });
}

/* helper: confirm and delete (sender only) */
async function confirmAndDelete(messageId) {
  if (!confirm("Delete this message? This cannot be undone.")) return;
  const msgRef = doc(db, "cyou_messages", messageId);
  try {
    // Soft-delete: set deleted true and clear text
    await updateDoc(msgRef, { deleted: true, text: "", deletedBy: username, deletedAt: serverTimestamp() });
  } catch (err) {
    console.error("Delete msg error", err);
    alert("Couldn't delete message. Check console.");
  }
}

/* ---------------------------
   🧹 Clear local chat (UI only)
---------------------------- */
clearChatBtn.addEventListener("click", () => {
  if (!confirm("Clear local chat view? This will not delete messages from server.")) return;
  messagesDiv.innerHTML = "";
});

/* ---------------------------
   🧾 Utilities
---------------------------- */
function formatTime(d) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function escapeHtml(text) {
  if (!text) return "";
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

/* Clean up: when user leaves, set presence offline and remove typing doc */
window.addEventListener("beforeunload", async () => {
  if (!username) return;
  try {
    await setDoc(doc(db, "cyou_presence", username), { online: false, lastSeen: serverTimestamp() }, { merge: true });
    await setDoc(doc(db, "cyou_typing", username), { typing: false }, { merge: true });
  } catch (e) { /* ignore */ }
});