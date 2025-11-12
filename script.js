import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import {
  getDatabase,
  ref,
  push,
  onChildAdded,
  onChildRemoved,
  remove,
  set,
  onDisconnect,
  onValue,
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js";

// ✅ Your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyB-dVGb9vklYyiJkA7-AqIFxFAwcDypOEY",
  authDomain: "cyou-chat.firebaseapp.com",
  databaseURL: "https://cyou-chat-default-rtdb.firebaseio.com/",
  projectId: "cyou-chat",
  storageBucket: "cyou-chat.appspot.com",
  messagingSenderId: "1072139573415",
  appId: "1:1072139573415:web:1dd5b5a08ac05612fc9b9b"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const nameInput = document.getElementById("nameInput");
const enterBtn = document.getElementById("enterBtn");
const joinSection = document.getElementById("joinSection");
const chatSection = document.getElementById("chatSection");
const messageInput = document.getElementById("messageInput");
const sendForm = document.getElementById("sendForm");
const messagesDiv = document.getElementById("messages");
const typingStatus = document.getElementById("typingStatus");
const onlineUsersList = document.getElementById("onlineUsers");
const onlineCount = document.getElementById("onlineCount");

let username = null;
let userId = null;
let typingRef = null;
let onlineRef = null;

// ✅ Join chat
enterBtn.addEventListener("click", () => {
  const name = nameInput.value.trim();
  if (!name) {
    document.getElementById("joinHint").textContent = "Please enter your name.";
    return;
  }
  username = name;
  userId = "user_" + Date.now();

  // Mark user online
  onlineRef = ref(db, "online/" + userId);
  set(onlineRef, { name: username, id: userId });
  onDisconnect(onlineRef).remove();

  // Typing reference
  typingRef = ref(db, "typing/" + userId);
  onDisconnect(typingRef).remove();

  joinSection.style.display = "none";
  chatSection.style.display = "flex";
});

// ✅ Send message
sendForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = messageInput.value.trim();
  if (text === "") return;

  const msgRef = ref(db, "messages");
  push(msgRef, {
    name: username,
    text,
    id: userId,
    time: Date.now(),
  });

  messageInput.value = "";
  set(typingRef, false);
});

// ✅ Display messages
const msgRef = ref(db, "messages");
onChildAdded(msgRef, (snapshot) => {
  const msg = snapshot.val();
  showMessage(snapshot.key, msg);
});

// ✅ Remove messages
onChildRemoved(msgRef, (snapshot) => {
  const msgEl = document.getElementById(snapshot.key);
  if (msgEl) msgEl.remove();
});

// ✅ Typing status
messageInput.addEventListener("input", () => {
  set(typingRef, messageInput.value.length > 0);
});

const typingRefAll = ref(db, "typing");
onValue(typingRefAll, (snapshot) => {
  const typingUsers = [];
  snapshot.forEach((snap) => {
    const isTyping = snap.val();
    const uid = snap.key;
    if (isTyping && uid !== userId) {
      const userObj = onlineUsers.find(u => u.id === uid);
      if (userObj) typingUsers.push(userObj.name);
    }
  });

  typingStatus.textContent = typingUsers.length
    ? `${typingUsers.join(", ")} is typing...`
    : "";
});

// ✅ Track online users
let onlineUsers = [];
const onlineRefAll = ref(db, "online");
onValue(onlineRefAll, (snapshot) => {
  onlineUsers = [];
  onlineUsersList.innerHTML = "";
  snapshot.forEach((snap) => {
    const user = snap.val();
    onlineUsers.push(user);
    const li = document.createElement("li");
    li.innerHTML = `<span class="user-dot online"></span>${user.name}`;
    onlineUsersList.appendChild(li);
  });
  onlineCount.textContent = onlineUsers.length;
});

// ✅ Show message function
function showMessage(key, msg) {
  const div = document.createElement("div");
  div.classList.add("message");
  div.id = key;

  const isMe = msg.id === userId;
  div.classList.add(isMe ? "me" : "other");

  const nameSpan = document.createElement("strong");
  nameSpan.textContent = isMe ? "You" : msg.name;

  const textP = document.createElement("p");
  textP.textContent = msg.text;

  const meta = document.createElement("div");
  meta.classList.add("meta");
  const time = new Date(msg.time).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  meta.textContent = time;

  div.appendChild(nameSpan);
  div.appendChild(textP);
  div.appendChild(meta);

  // 🗑 Delete button (visible & tappable)
  if (isMe) {
    const del = document.createElement("button");
    del.textContent = "🗑";
    del.classList.add("msg-btn");
    del.addEventListener("click", () => {
      remove(ref(db, "messages/" + key));
    });
    div.appendChild(del);
  }

  messagesDiv.appendChild(div);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}