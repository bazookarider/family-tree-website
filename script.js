// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import { 
  getDatabase, ref, push, onChildAdded, onChildChanged, onChildRemoved, 
  set, update, remove, onValue 
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-database.js";

// ✅ Your Firebase configuration
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
const db = getDatabase(app);

// DOM elements
const nicknameInput = document.getElementById("nicknameInput");
const joinBtn = document.getElementById("joinBtn");
const loginContainer = document.getElementById("loginContainer");
const chatBox = document.getElementById("chatBox");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const messagesDiv = document.getElementById("messages");
const typingIndicator = document.getElementById("typingIndicator");
const msgSound = document.getElementById("msgSound");

let nickname = "";
let typingTimeout = null;

// ✅ Join chat
joinBtn.addEventListener("click", () => {
  const name = nicknameInput.value.trim();
  if (name === "") {
    alert("Please enter your nickname!");
    return;
  }
  nickname = name;
  loginContainer.style.display = "none";
  chatBox.style.display = "flex";
  startChat();
});

function startChat() {
  listenMessages();
  listenTyping();
}

// ✅ Send message
sendBtn.addEventListener("click", sendMessage);
messageInput.addEventListener("keypress", e => {
  if (e.key === "Enter") sendMessage();
  sendTypingStatus();
});

function sendMessage() {
  const text = messageInput.value.trim();
  if (!text) return;
  const msgRef = ref(db, "messages");
  push(msgRef, {
    sender: nickname,
    text,
    edited: false,
    timestamp: Date.now()
  });
  messageInput.value = "";
}

function listenMessages() {
  const msgRef = ref(db, "messages");

  onChildAdded(msgRef, (snapshot) => {
    const data = snapshot.val();
    displayMessage(snapshot.key, data);
    if (data.sender !== nickname) msgSound.play();
  });

  onChildChanged(msgRef, (snapshot) => {
    const msgEl = document.getElementById(snapshot.key);
    if (msgEl) {
      msgEl.querySelector(".msg-text").textContent = snapshot.val().text;
      if (snapshot.val().edited && !msgEl.querySelector(".edit-label")) {
        const edit = document.createElement("span");
        edit.classList.add("edit-label");
        edit.textContent = "edited";
        msgEl.appendChild(edit);
      }
    }
  });

  onChildRemoved(msgRef, (snapshot) => {
    const msgEl = document.getElementById(snapshot.key);
    if (msgEl) msgEl.remove();
  });
}

function sendTypingStatus() {
  const typingRef = ref(db, "typing/" + nickname);
  set(typingRef, true);
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => set(typingRef, false), 1500);
}

function listenTyping() {
  const typingRef = ref(db, "typing");
  onValue(typingRef, (snapshot) => {
    let someoneTyping = false;
    snapshot.forEach(user => {
      if (user.val() && user.key !== nickname) {
        typingIndicator.textContent = `${user.key} is typing...`;
        someoneTyping = true;
      }
    });
    if (!someoneTyping) typingIndicator.textContent = "";
  });
}

function displayMessage(id, data) {
  const div = document.createElement("div");
  div.classList.add("message");
  div.classList.add(data.sender === nickname ? "you" : "other");
  div.id = id;

  const name = document.createElement("div");
  name.classList.add("name");
  name.textContent = data.sender === nickname ? "You" : data.sender;
  name.style.color = data.sender === nickname ? "gray" : "#006677";
  div.appendChild(name);

  const text = document.createElement("div");
  text.classList.add("msg-text");
  text.textContent = data.text;
  div.appendChild(text);

  if (data.sender === nickname) {
    const editBtn = document.createElement("span");
    editBtn.classList.add("edit-btn");
    editBtn.textContent = "📝";
    div.appendChild(editBtn);

    const delBtn = document.createElement("span");
    delBtn.classList.add("delete-btn");
    delBtn.textContent = "🗑️";
    div.appendChild(delBtn);

    editBtn.addEventListener("click", () => {
      const newText = prompt("Edit your message:", data.text);
      if (newText && newText.trim() !== data.text) {
        update(ref(db, "messages/" + id), { text: newText.trim(), edited: true });
      }
    });

    delBtn.addEventListener("click", () => {
      remove(ref(db, "messages/" + id));
    });
  }

  messagesDiv.appendChild(div);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}