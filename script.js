import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, setDoc, doc, getDoc, updateDoc,
  deleteDoc, query, orderBy, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

/* Firebase Config */
const firebaseConfig = {
  apiKey: "AIzaSyDJFQnwOs-fetKVy0Ow43vktz8xwefZMks",
  authDomain: "cyou-db8f0.firebaseapp.com",
  projectId: "cyou-db8f0",
  storageBucket: "cyou-db8f0.firebasestorage.app",
  messagingSenderId: "873569975141",
  appId: "1:873569975141:web:147eb7b7b4043a38c9bf8c"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* DOM */
const authSection = document.getElementById("authSection");
const chatSection = document.getElementById("chatSection");
const meNickname = document.getElementById("meNickname");
const typingStatus = document.getElementById("typingStatus");
const onlineCount = document.getElementById("onlineCount");
const onlineUsers = document.getElementById("onlineUsers");
const messagesDiv = document.getElementById("messages");
const messageInput = document.getElementById("messageInput");

/* Tabs */
const tabRegister = document.getElementById("tabRegister");
const tabLogin = document.getElementById("tabLogin");
const registerForm = document.getElementById("registerForm");
const loginForm = document.getElementById("loginForm");
const regHint = document.getElementById("regHint");
const loginHint = document.getElementById("loginHint");

/* Controls */
const themeToggle = document.getElementById("themeToggle");
const clearChatBtn = document.getElementById("clearChatBtn");
const signOutBtn = document.getElementById("signOutBtn");

let currentUser = null;
let nickname = null;
let typingTimeout;

/* ---------------- Tabs ---------------- */
tabRegister.onclick = () => {
  tabRegister.classList.add("active");
  tabLogin.classList.remove("active");
  registerForm.style.display = "block";
  loginForm.style.display = "none";
};
tabLogin.onclick = () => {
  tabLogin.classList.add("active");
  tabRegister.classList.remove("active");
  registerForm.style.display = "none";
  loginForm.style.display = "block";
};

/* ---------------- Register ---------------- */
registerForm.onsubmit = async (e) => {
  e.preventDefault();
  regHint.textContent = "";
  const nick = regNickname.value.trim();
  const email = regEmail.value.trim();
  const pass = regPassword.value.trim();
  if (!nick || !email || !pass) return;

  const nickRef = doc(db, "cyou_users", nick);
  const snap = await getDoc(nickRef);
  if (snap.exists()) {
    regHint.textContent = "Nickname already exists!";
    return;
  }

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    await setDoc(doc(db, "cyou_users", cred.user.uid), { nickname: nick, email });
  } catch (err) {
    regHint.textContent = err.message;
  }
};

/* ---------------- Login ---------------- */
loginForm.onsubmit = async (e) => {
  e.preventDefault();
  loginHint.textContent = "";
  try {
    await signInWithEmailAndPassword(auth, loginEmail.value.trim(), loginPassword.value.trim());
  } catch (err) {
    loginHint.textContent = "Login failed: " + err.message;
  }
};

/* ---------------- Auth State ---------------- */
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    const uDoc = await getDoc(doc(db, "cyou_users", user.uid));
    nickname = uDoc.exists() ? uDoc.data().nickname : "Unknown";
    meNickname.textContent = nickname;

    authSection.style.display = "none";
    chatSection.style.display = "flex";

    addPresence();
    listenMessages();
    listenTyping();
  } else {
    chatSection.style.display = "none";
    authSection.style.display = "flex";
  }
});

/* ---------------- Presence ---------------- */
async function addPresence() {
  const userRef = doc(db, "cyou_presence", nickname);
  await setDoc(userRef, { online: true });
  onSnapshot(collection(db, "cyou_presence"), (snap) => {
    const users = snap.docs.filter((d) => d.data().online);
    onlineCount.textContent = users.length;
    onlineUsers.innerHTML = "";
    users.forEach((d) => {
      onlineUsers.innerHTML += `<li>${d.id}</li>`;
    });
  });
  window.addEventListener("beforeunload", () => deleteDoc(userRef));
}

/* ---------------- Messaging ---------------- */
const sendForm = document.getElementById("sendForm");
sendForm.onsubmit = async (e) => {
  e.preventDefault();
  const text = messageInput.value.trim();
  if (!text) return;

  const msg = {
    name: nickname,
    text,
    createdAt: serverTimestamp(),
    seen: false,
    deleted: false
  };
  await addDoc(collection(db, "cyou_messages"), msg);
  messageInput.value = "";
  setTyping(false);
};

function listenMessages() {
  const q = query(collection(db, "cyou_messages"), orderBy("createdAt"));
  onSnapshot(q, (snap) => {
    messagesDiv.innerHTML = "";
    snap.forEach(async (docSnap) => {
      const msg = docSnap.data();
      const isYou = msg.name === nickname;
      const div = document.createElement("div");
      div.className = `message ${isYou ? "me" : "other"}`;

      if (msg.deleted) {
        div.innerHTML = "<em>Message deleted</em>";
      } else {
        div.innerHTML = `<strong>${msg.name}</strong><br>${msg.text}
          <div style="font-size:0.8em;text-align:right;">
            ${new Date(msg.createdAt?.toDate?.() || Date.now()).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}
            ${isYou ? (msg.seen ? "✓✓" : "✓") : ""}
          </div>`;
      }

      if (isYou && !msg.deleted) {
        const delBtn = document.createElement("button");
        delBtn.textContent = "🗑";
        delBtn.className = "msg-btn";
        delBtn.onclick = async () => updateDoc(doc(db, "cyou_messages", docSnap.id), { deleted: true });
        div.appendChild(delBtn);
      }

      // mark as seen
      if (!isYou && !msg.seen)
        await updateDoc(doc(db, "cyou_messages", docSnap.id), { seen: true });

      messagesDiv.appendChild(div);
    });
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  });
}

/* ---------------- Typing ---------------- */
messageInput.addEventListener("input", () => {
  setTyping(true);
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => setTyping(false), 2000);
});
async function setTyping(state) {
  if (!nickname) return;
  await setDoc(doc(db, "cyou_typing", nickname), { typing: state });
}
function listenTyping() {
  onSnapshot(collection(db, "cyou_typing"), (snap) => {
    const typers = snap.docs
      .map((d) => ({ name: d.id, ...d.data() }))
      .filter((d) => d.typing && d.name !== nickname);
    typingStatus.textContent = typers.length
      ? `${typers.map((t) => t.name).join(", ")} typing...`
      : "";
    document.getElementById("typingIndicatorBottom").textContent = typingStatus.textContent;
  });
}

/* ---------------- Theme Toggle ---------------- */
let themes = ["light", "dark", "dim"];
let themeIndex = Number(localStorage.getItem("themeIndex")) || 0;
applyTheme();
themeToggle.onclick = () => {
  themeIndex = (themeIndex + 1) % themes.length;
  localStorage.setItem("themeIndex", themeIndex);
  applyTheme();
};
function applyTheme() {
  document.body.className = "";
  if (themes[themeIndex] !== "light") document.body.classList.add(themes[themeIndex]);
}

/* ---------------- Clear Chat ---------------- */
clearChatBtn.onclick = async () => {
  if (confirm("Clear all messages?")) {
    const q = query(collection(db, "cyou_messages"));
    const snap = await onSnapshot(q, () => {});
    snap.docs?.forEach((d) => deleteDoc(doc(db, "cyou_messages", d.id)));
  }
};

/* ---------------- Sign Out ---------------- */
signOutBtn.onclick = () => signOut(auth);