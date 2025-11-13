import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getDatabase, ref, push, onChildAdded, onChildChanged, onChildRemoved, set, update, remove } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_FIREBASE_AUTH_DOMAIN",
  databaseURL: "YOUR_FIREBASE_DATABASE_URL",
  projectId: "YOUR_FIREBASE_PROJECT_ID",
  storageBucket: "YOUR_FIREBASE_STORAGE_BUCKET",
  messagingSenderId: "YOUR_FIREBASE_SENDER_ID",
  appId: "YOUR_FIREBASE_APP_ID"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

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

joinBtn.onclick = () => {
  if (nicknameInput.value.trim() === "") return;
  nickname = nicknameInput.value.trim();
  loginContainer.style.display = "none";
  chatBox.style.display = "flex";
  listenMessages();
};

sendBtn.onclick = sendMessage;

messageInput.addEventListener("keypress", e => {
  if (e.key === "Enter") sendMessage();
  sendTypingStatus();
});

function sendTypingStatus() {
  const typingRef = ref(db, "typing/" + nickname);
  set(typingRef, true);
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => set(typingRef, false), 1500);
}

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

  const typingRef = ref(db, "typing");
  onChildAdded(typingRef, () => {});
  onChildChanged(typingRef, snap => {
    if (snap.val() && snap.key !== nickname) {
      typingIndicator.textContent = `${snap.key} is typing...`;
    } else if (!snap.val()) {
      typingIndicator.textContent = "";
    }
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
  div.appendChild(name);

  const text = document.createElement("div");
  text.classList.add("msg-text");
  text.textContent = data.text;
  div.appendChild(text);

  const del = document.createElement("span");
  del.classList.add("delete-btn");
  del.textContent = "🗑️";
  div.appendChild(del);

  del.addEventListener("click", () => {
    if (data.sender === nickname) {
      remove(ref(db, "messages/" + id));
    }
  });

  div.addEventListener("dblclick", () => {
    if (data.sender === nickname) {
      const newText = prompt("Edit your message:", data.text);
      if (newText && newText.trim() !== data.text) {
        update(ref(db, "messages/" + id), { text: newText.trim(), edited: true });
      }
    }
  });

  messagesDiv.appendChild(div);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}