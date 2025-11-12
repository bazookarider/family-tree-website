import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, setDoc, doc, getDoc, updateDoc,
  deleteDoc, query, orderBy, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

/* ---------------- FIREBASE CONFIG ---------------- */
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

/* ---------------- DOM ELEMENTS ---------------- */
const authSection = document.getElementById("authSection");
const chatSection = document.getElementById("chatSection");
const nicknameInput = document.getElementById("nicknameInput");
const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");
const registerBtn = document.getElementById("registerBtn");
const loginBtn = document.getElementById("loginBtn");
const switchLink = document.getElementById("switchLink");
const authHint = document.getElementById("authHint");

const meNickname = document.getElementById("meNickname");
const typingStatus = document.getElementById("typingStatus");
const onlineCount = document.getElementById("onlineCount");
const onlineUsers = document.getElementById("onlineUsers");
const messagesDiv = document.getElementById("messages");
const messageInput = document.getElementById("messageInput");
const sendForm = document.getElementById("sendForm");

const themeToggle = document.getElementById("themeToggle");
const clearChatBtn = document.getElementById("clearChatBtn");

let currentUser = null;
let nickname = null;
let typingTimeout;

/* ---------------- SWITCH REGISTER/LOGIN ---------------- */
switchLink.onclick = () => {
  if (registerBtn.style.display !== "none") {
    registerBtn.style.display = "none";
    loginBtn.style.display = "block";
    document.getElementById("authTitle").textContent = "Login";
    switchLink.textContent = "Register";
  } else {
    registerBtn.style.display = "block";
    loginBtn.style.display = "none";
    document.getElementById("authTitle").textContent = "Register";
    switchLink.textContent = "Login";
  }
  authHint.textContent = "";
};

/* ---------------- REGISTER ---------------- */
registerBtn.onclick = async () => {
  authHint.textContent = "";
  const nick = nicknameInput.value.trim();
  const email = emailInput.value.trim();
  const pass = passwordInput.value.trim();
  if (!nick || !email || !pass) {
    authHint.textContent = "Fill in all fields!";
    return;
  }

  // Check duplicate nickname
  const nickQuery = await getDoc(doc(db, "cyou_users", nick));
  if (nickQuery.exists()) {
    authHint.textContent = "Nickname already exists!";
    return;
  }

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    await setDoc(doc(db, "cyou_users", cred.user.uid), { nickname: nick, email });
  } catch (err) {
    authHint.textContent = err.message;
  }
};

/* ---------------- LOGIN ---------------- */
loginBtn.onclick = async () => {
  authHint.textContent = "";
  const email = emailInput.value.trim();
  const pass = passwordInput.value.trim();
  if (!email || !pass) {
    authHint.textContent = "Fill in all fields!";
    return;
  }
  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch (err) {
    authHint.textContent = "Login failed: " + err.message;
  }
};

/* ---------------- AUTH STATE ---------------- */
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    const userDoc = await getDoc(doc(db, "cyou_users", user.uid));
    nickname = userDoc.exists() ? userDoc.data().nickname : "Unknown";
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

/* ---------------- PRESENCE ---------------- */
async function addPresence() {
  const userRef = doc(db, "cyou_presence", nickname);
  await setDoc(userRef, { online: true });
  onSnapshot(collection(db, "cyou_presence"), (snap) => {
    const users = snap.docs.filter(d => d.data().online);
    onlineCount.textContent = users.length;
    onlineUsers.innerHTML = "";
    users.forEach(d => {
      const li = document.createElement("li");
      li.textContent = d.id;
      onlineUsers.appendChild(li);
    });
  });
  window.addEventListener("beforeunload", () => deleteDoc(userRef));
}

/* ---------------- MESSAGES ---------------- */
sendForm.onsubmit = async e => {
  e.preventDefault();
  const text = messageInput.value.trim();
  if (!text) return;
  await addDoc(collection(db, "cyou_messages"), {
    name: nickname,
    text,
    createdAt: serverTimestamp(),
    seen: false,
    deleted: false
  });
  messageInput.value = "";
  setTyping(false);
};

function listenMessages() {
  const q = query(collection(db, "cyou_messages"), orderBy("createdAt"));
  onSnapshot(q, (snap) => {
    messagesDiv.innerHTML = "";
    snap.forEach(async docSnap => {
      const msg = docSnap.data();
      const isYou = msg.name === nickname;
      const div = document.createElement("div");
      div.className = `message ${isYou ? "me" : "other"}`;

      if (msg.deleted) {
        div.innerHTML = "<em>Message deleted</em>";
      } else {
        div.innerHTML = `<strong>${msg.name}</strong><br>${msg.text}
          <div class="meta">
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
      if (!isYou && !msg.seen) await updateDoc(doc(db, "cyou_messages", docSnap.id), { seen: true });

      messagesDiv.appendChild(div);
    });
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  });
}

/* ---------------- TYPING ---------------- */
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
  onSnapshot(collection(db, "cyou_typing"), snap => {
    const typers = snap.docs
      .map(d => ({ name: d.id, ...d.data() }))
      .filter(d => d.typing && d.name !== nickname);
    typingStatus.textContent = typers.length ? `${typers.map(t=>t.name).join(", ")} typing...` : "";
  });
}

/* ---------------- THEME ---------------- */
let themes = ["light","dark","dim"];
let themeIndex = Number(localStorage.getItem("themeIndex")) || 0;
applyTheme();
themeToggle.onclick = () => {
  themeIndex = (themeIndex +1) % themes.length;
  localStorage.setItem("themeIndex", themeIndex);
  applyTheme();
};
function applyTheme() {
  document.body.className = "";
  if (themes[themeIndex]!=="light") document.body.classList.add(themes[themeIndex]);
}

/* ---------------- CLEAR CHAT ---------------- */
clearChatBtn.onclick = async () => {
  if (!confirm("Are you sure? This will delete all chat messages for everyone.")) return;
  const snap = await getDoc(collection(db, "cyou_messages"));
  const q = query(collection(db, "cyou_messages"));
  onSnapshot(q, (snapshot) => {
    snapshot.docs.forEach(docSnap => deleteDoc(doc(db, "cyou_messages", docSnap.id)));
  });
};

/* ---------------- SIGN OUT ---------------- */