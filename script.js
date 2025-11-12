import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, onSnapshot, serverTimestamp,
  query, orderBy, limit, updateDoc, doc
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";
import {
  getAuth, signInAnonymously, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDJFQnwOs-fetKVy0Ow43vktz8xwefZMks",
  authDomain: "cyou-db8f0.firebaseapp.com",
  projectId: "cyou-db8f0",
  storageBucket: "cyou-db8f0.firebasestorage.app",
  messagingSenderId: "873569975141",
  appId: "1:873569975141:web:147eb7b7b4043a38c9bf8c"
};

// init Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// elements
const messagesEl = document.getElementById("messages");
const input = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");

let currentUser = null;

// auto scroll
function scrollToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// render message
function renderMessage(id, data) {
  const li = document.createElement("li");
  li.classList.add("message");
  if (data.uid === currentUser?.uid) li.classList.add("mine");
  else li.classList.add("theirs");
  li.textContent = data.text;

  // simple tick simulation
  const ticks = document.createElement("span");
  ticks.style.fontSize = "0.8rem";
  ticks.style.marginLeft = "6px";
  if (data.seen) ticks.textContent = "✅✅";
  else ticks.textContent = "✅";
  li.appendChild(ticks);

  messagesEl.appendChild(li);
  scrollToBottom();
}

// load messages
async function loadMessages() {
  const q = query(collection(db, "messages"), orderBy("createdAt"), limit(100));
  onSnapshot(q, (snap) => {
    messagesEl.innerHTML = "";
    snap.forEach((doc) => renderMessage(doc.id, doc.data()));
  });
}

signInAnonymously(auth);
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    loadMessages();
  }
});

// send message
sendBtn.onclick = async () => {
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  const data = {
    text,
    uid: currentUser.uid,
    createdAt: serverTimestamp(),
    seen: false
  };
  await addDoc(collection(db, "messages"), data);
};

// mark messages seen (demo)
window.addEventListener("focus", async () => {
  // in real app: update docs seenBy array
});