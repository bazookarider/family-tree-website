import { 
    initializeApp 
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";

import { 
    getDatabase, ref, push, onChildAdded, onChildChanged, update, set 
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-database.js";

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
const db = getDatabase(app);

let username = localStorage.getItem("cyou-username") || null;

const joinScreen = document.getElementById("join-screen");
const chatScreen = document.getElementById("chat-screen");
const messagesDiv = document.getElementById("messages");
const typingIndicator = document.getElementById("typingIndicator");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const receiveSound = document.getElementById("receiveSound");

if (username) enterChat();

document.getElementById("joinBtn").onclick = () => {
    const name = document.getElementById("usernameInput").value.trim();
    if (name.length < 2) return alert("Enter a valid name.");

    username = name;
    localStorage.setItem("cyou-username", username);
    enterChat();
};

function enterChat() {
    joinScreen.classList.add("hidden");
    chatScreen.classList.remove("hidden");
}

const msgRef = ref(db, "messages");
const typingRef = ref(db, "typing");

sendBtn.onclick = sendMessage;

function sendMessage() {
    const text = messageInput.value.trim();
    if (!text) return;

    push(msgRef, {
        sender: username,
        text: text,
        edited: false,
        deleted: false,
        time: Date.now()
    });

    messageInput.value = "";
    update(typingRef, { [username]: false });
}

messageInput.addEventListener("input", () => {
    update(typingRef, { [username]: messageInput.value.length > 0 });
});

onChildAdded(msgRef, snap => {
    const msg = snap.val();
    displayMessage(msg, snap.key, false);
});

onChildChanged(msgRef, snap => {
    const msg = snap.val();
    displayMessage(msg, snap.key, true);
});

function displayMessage(msg, id, changed) {
    let div = document.getElementById(id);

    if (!div) {
        div = document.createElement("div");
        div.id = id;
        div.className = "message " + (msg.sender === username ? "you" : "them");
        messagesDiv.appendChild(div);
    }

    let name = msg.sender === username ? "You" : msg.sender;

    if (msg.deleted) {
        div.innerHTML = `<p class="deleted">This message was deleted</p>`;
        return;
    }

    div.innerHTML = `
        <p class="senderName">${name}</p>
        <p>${msg.text}${msg.edited ? ' <span class="edited">(edited)</span>' : ''}</p>
        ${msg.sender === username ? `
            <div class="msg-buttons">
                <span class="editBtn">✏️</span>
                <span class="delBtn">🗑️</span>
            </div>` : ""}
    `;

    if (!changed && msg.sender !== username) receiveSound.play();

    div.querySelector(".editBtn")?.addEventListener("click", () => editMessage(id, msg.text));
    div.querySelector(".delBtn")?.addEventListener("click", () => deleteMessage(id));
}

function editMessage(id, oldText) {
    const newText = prompt("Edit message:", oldText);
    if (!newText) return;

    update(ref(db, "messages/" + id), {
        text: newText,
        edited: true
    });
}

function deleteMessage(id) {
    update(ref(db, "messages/" + id), {
        text: "",
        deleted: true
    });
}

onChildAdded(typingRef, () => {});
onChildChanged(typingRef, snap => {
    const t = snap.val();
    let typingUsers = Object.keys(t).filter(u => u !== username && t[u]);
    typingIndicator.innerText =
        typingUsers.length ? `${typingUsers[0]} is typing...` : "";
});