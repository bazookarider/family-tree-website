import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
  onSnapshot,
  query,
  orderBy,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  where
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

/* 🔥 Firebase Config */
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
await setPersistence(auth, browserLocalPersistence);

/* DOM Elements */
const authSection = document.getElementById("authSection");
const chatSection = document.getElementById("chatSection");
const tabRegister = document.getElementById("tabRegister");
const tabLogin = document.getElementById("tabLogin");
const registerForm = document.getElementById("registerForm");
const loginForm = document.getElementById("loginForm");
const regNickname = document.getElementById("regNickname");
const regEmail = document.getElementById("regEmail");
const regPassword = document.getElementById("regPassword");
const regHint = document.getElementById("regHint");
const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
const loginHint = document.getElementById("loginHint");
const meNicknameEl = document.getElementById("meNickname");
const signOutBtn = document.getElementById("signOutBtn");
const messagesDiv = document.getElementById("messages");
const messageInput = document.getElementById("messageInput");
const sendForm = document.getElementById("sendForm");
const typingIndicator = document.getElementById("typingStatus");
const typingBottom = document.getElementById("typingIndicatorBottom");
const onlineCount = document.getElementById("onlineCount");
const onlineUsersList = document.getElementById("onlineUsers");
const themeToggle = document.getElementById("themeToggle");
const clearChatBtn = document.getElementById("clearChatBtn");

let nickname = localStorage.getItem("cyou_nickname") || "";
let typingTimeout;

/* === THEME TOGGLE === */
themeToggle.onclick = () => {
  document.body.classList.toggle("dark");
  localStorage.setItem("cyou_theme", document.body.classList.contains("dark") ? "dark" : "light");
};
if (localStorage.getItem("cyou_theme") === "dark") document.body.classList.add("dark");

/* === TABS === */
tabRegister.onclick = () => {
  registerForm.style.display = "";
  loginForm.style.display = "none";
  tabRegister.classList.add("active");
  tabLogin.classList.remove("active");
};
tabLogin.onclick = () => {
  loginForm.style.display = "";
  registerForm.style.display = "none";
  tabLogin.classList.add("active");
  tabRegister.classList.remove("active");
};

/* === REGISTER === */
registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  regHint.textContent = "";

  const nick = regNickname.value.trim();
  const email = regEmail.value.trim();
  const pass = regPassword.value.trim();

  if (!nick || !email || pass.length < 6) {
    regHint.textContent = "Please fill all fields correctly.";
    return;
  }

  const taken = await getDocs(query(collection(db, "cyou_users"), where("nickname", "==", nick)));
  if (!taken.empty) {
    regHint.textContent = "Nickname already taken.";
    return;
  }

  try {
    const userCred = await createUserWithEmailAndPassword(auth, email, pass);
    await setDoc(doc(db, "cyou_users", userCred.user.uid), { nickname: nick, email });
    localStorage.setItem("cyou_nickname", nick);
  } catch (err) {
    regHint.textContent = err.message;
  }
});

/* === LOGIN === */
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginHint.textContent = "";
  try {
    await signInWithEmailAndPassword(auth, loginEmail.value.trim(), loginPassword.value.trim());
  } catch (err) {
    loginHint.textContent = err.message;
  }
});

/* === AUTH STATE === */
onAuthStateChanged(auth, async (user) => {
  if (user) {
    const userDoc = await getDoc(doc(db, "cyou_users", user.uid));
    nickname = userDoc.data()?.nickname || "Guest";
    localStorage.setItem("cyou_nickname", nickname);
    meNicknameEl.textContent = nickname;
    authSection.style.display = "none";
    chatSection.style.display = "flex";
    startChat();
  } else {
    authSection.style.display = "flex";
    chatSection.style.display = "none";
  }
});

/* === SIGN OUT === */
signOutBtn.onclick = async () => {
  await signOut(auth);
  localStorage.removeItem("cyou_nickname");
};

/* === CHAT SYSTEM === */
async function startChat() {
  addPresence();
  listenMessages();
  listenTyping();
}

/* SEND MESSAGE */
sendForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = messageInput.value.trim();
  if (!text) return;

  const newMsg = {
    name: nickname,
    text,
    createdAt: serverTimestamp(),
    seen: false,
    deleted: false
  };

  const docRef = await addDoc(collection(db, "cyou_messages"), newMsg);
  await updateDoc(docRef, { id: docRef.id });
  messageInput.value = "";
  setTyping(false);
});

/* LISTEN MESSAGES */
function listenMessages() {
  const q = query(collection(db, "cyou_messages"), orderBy("createdAt"));
  onSnapshot(q, (snap) => {
    messagesDiv.innerHTML = "";
    snap.forEach((docSnap) => {
      const msg = docSnap.data();
      const div = document.createElement("div");
      div.classList.add("message", msg.name === nickname ? "me" : "other");

      if (msg.deleted) {
        div.innerHTML = `<em>Message deleted</em>`;
      } else {
        div.innerHTML = `
          <strong>${msg.name}</strong><br>
          ${msg.text}
          <div class="meta">${new Date(msg.createdAt?.toDate?.() || Date.now())
            .toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </div>`;
      }

      if (msg.name === nickname && !msg.deleted) {
        const del = document.createElement("button");
        del.textContent = "🗑";
        del.classList.add("msg-btn");
        del.onclick = async () => await updateDoc(doc(db, "cyou_messages", msg.id), { deleted: true });
        div.appendChild(del);
      }

      messagesDiv.appendChild(div);
    });
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  });
}

/* === PRESENCE === */
async function addPresence() {
  const ref = doc(db, "cyou_presence", nickname);
  await setDoc(ref, { online: true });

  onSnapshot(collection(db, "cyou_presence"), (snap) => {
    const users = snap.docs.filter((d) => d.data().online);
    onlineCount.textContent = users.length;
    onlineUsersList.innerHTML = "";
    users.forEach((u) => {
      const li = document.createElement("li");
      li.textContent = u.id;
      onlineUsersList.appendChild(li);
    });
  });

  window.addEventListener("beforeunload", async () => {
    await deleteDoc(ref);
  });
}

/* === TYPING === */
messageInput.addEventListener("input", () => {
  setTyping(true);
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => setTyping(false), 1500);
});

async function setTyping(state) {
  await setDoc(doc(db, "cyou_typing", nickname), { typing: state });
}

function listenTyping() {
  onSnapshot(collection(db, "cyou_typing"), (snap) => {
    const typers = [];
    snap.forEach((d) => {
      if (d.data().typing && d.id !== nickname) typers.push(d.id);
    });
    if (typers.length > 0) {
      typingIndicator.textContent = `${typers.join(", ")} typing...`;
      typingBottom.textContent = typingIndicator.textContent;
    } else {
      typingIndicator.textContent = "";
      typingBottom.textContent = "";
    }
  });
}

/* === CLEAR CHAT === */
clearChatBtn.onclick = async () => {
  if (confirm("Clear all chat messages?")) {
    const all = await getDocs(collection(db, "cyou_messages"));
    all.forEach(async (d) => await deleteDoc(d.ref));
  }
};