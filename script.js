import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getDatabase, ref, push, onChildAdded, onChildChanged, onChildRemoved, onValue, update, set, serverTimestamp, get, off
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-database.js";
import { 
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, sendEmailVerification, sendPasswordResetEmail 
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

/* ---------------- Config ---------------- */
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
const auth = getAuth(app);

/* ---------------- DOM Elements ---------------- */
// Auth
const authScreen = document.getElementById("auth-screen");
const loginForm = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");
const resetForm = document.getElementById("resetForm");
const authError = document.getElementById("authError");
const showSignup = document.getElementById("showSignup");
const showLogin = document.getElementById("showLogin");
const forgotPassBtn = document.getElementById("forgotPassBtn");
const cancelReset = document.getElementById("cancelReset");
const loginBtn = document.getElementById("loginBtn");
const signupBtn = document.getElementById("signupBtn");
const resetBtn = document.getElementById("resetBtn");

// Chat
const chatScreen = document.getElementById("chat-screen");
const messagesDiv = document.getElementById("messages");
const inputForm = document.getElementById("inputForm");
const messageInput = document.getElementById("messageInput");
const receiveSound = document.getElementById("receiveSound");
const onlineStatus = document.getElementById("onlineStatus");
const typingIndicator = document.getElementById("typingIndicator");
const themeToggle = document.getElementById("themeToggle");
const logoutBtn = document.getElementById("logoutBtn");
const newMessagesButton = document.getElementById("new-messages-button");
const replyContextBar = document.getElementById("reply-context-bar");
const pinnedMessageBar = document.getElementById("pinned-message-bar");
const chatTitle = document.getElementById("chatTitle");
const usersBtn = document.getElementById("usersBtn");
const backToGlobalBtn = document.getElementById("backToGlobalBtn");
const usersModal = document.getElementById("usersModal");
const usersList = document.getElementById("usersList");
const closeUsersBtn = document.getElementById("closeUsersBtn");

/* ---------------- State ---------------- */
let currentUser = null; 
let currentChatPath = "messages"; // Defaults to Global
let currentChatName = "Global";
let readyForSound = false;
let typingTimeout = null;
let activeReply = null; 
let userIsScrolledUp = false;
let newMessagesCount = 0;
const AVAILABLE_REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '😡'];

/* ---------------- Auth Logic ---------------- */
onAuthStateChanged(auth, async (user) => {
  if (user) {
    if (!user.emailVerified) {
      authError.innerHTML = `Verify your email to continue.<br><button id="resendBtn">Resend Link</button>`;
      document.getElementById("resendBtn").onclick = () => sendEmailVerification(user).then(() => alert("Resent!"));
      return; 
    }
    try {
      const snapshot = await get(ref(db, `users/${user.uid}`));
      if (snapshot.exists()) {
        currentUser = { uid: user.uid, email: user.email, username: snapshot.val().username };
        startApp();
      } else {
        authError.textContent = "Profile missing.";
        signOut(auth);
      }
    } catch (e) {
      console.error(e);
      authError.textContent = "Connection error.";
    }
  } else {
    currentUser = null;
    chatScreen.classList.add("hidden");
    authScreen.classList.remove("hidden");
    messagesDiv.innerHTML = "";
  }
});

// View Switching
showSignup.onclick = () => { loginForm.classList.add("hidden"); signupForm.classList.remove("hidden"); resetForm.classList.add("hidden"); authError.textContent=""; };
showLogin.onclick = () => { signupForm.classList.add("hidden"); loginForm.classList.remove("hidden"); resetForm.classList.add("hidden"); authError.textContent=""; };
forgotPassBtn.onclick = () => { loginForm.classList.add("hidden"); resetForm.classList.remove("hidden"); authError.textContent=""; };
cancelReset.onclick = () => { resetForm.classList.add("hidden"); loginForm.classList.remove("hidden"); authError.textContent=""; };

// Sign Up
signupForm.onsubmit = async (e) => {
  e.preventDefault();
  authError.textContent = "Checking...";
  signupBtn.disabled = true;
  const name = document.getElementById("signupName").value.trim();
  const email = document.getElementById("signupEmail").value.trim();
  const pass = document.getElementById("signupPass").value;

  try {
    const nameCheck = await get(ref(db, `usernames/${name}`));
    if (nameCheck.exists()) throw new Error("Username taken.");
    
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    await set(ref(db, `users/${cred.user.uid}`), { username: name, email: email, joined: serverTimestamp() });
    await set(ref(db, `usernames/${name}`), cred.user.uid);
    await sendEmailVerification(cred.user);
    alert(`Verification link sent to ${email}`);
    await signOut(auth);
    showLogin.click();
  } catch (err) {
    alert(err.message);
    authError.textContent = err.message;
  }
  signupBtn.disabled = false;
};

// Log In
loginForm.onsubmit = async (e) => {
  e.preventDefault();
  loginBtn.disabled = true;
  try {
    await signInWithEmailAndPassword(auth, document.getElementById("loginEmail").value, document.getElementById("loginPass").value);
  } catch (err) {
    authError.textContent = "Invalid credentials.";
  }
  loginBtn.disabled = false;
};

// Reset Password
resetForm.onsubmit = async (e) => {
  e.preventDefault();
  resetBtn.disabled = true;
  try {
    await sendPasswordResetEmail(auth, document.getElementById("resetEmail").value);
    alert("Reset link sent!");
    cancelReset.click();
  } catch (err) { alert(err.message); }
  resetBtn.disabled = false;
};

logoutBtn.onclick = () => { if(confirm("Log out?")) signOut(auth); };

/* ---------------- App Start ---------------- */
async function startApp() {
  authScreen.classList.add("hidden");
  chatScreen.classList.remove("hidden");
  
  // Presence
  const presenceNode = ref(db, `presence/${currentUser.uid}`);
  await set(presenceNode, { name: currentUser.username, online: true, lastSeen: serverTimestamp() });
  window.addEventListener("beforeunload", () => update(presenceNode, { online: false, lastSeen: serverTimestamp() }));

  // Load Global Chat by default
  switchChat("messages", "CYOU Global");
  setTimeout(() => { readyForSound = true; }, 1000);
}

/* ---------------- Chat Switching Logic ---------------- */
async function switchChat(path, name) {
  // 1. Clean up old listeners
  if (currentChatPath) off(ref(db, currentChatPath));
  off(ref(db, "typing")); // Global typing
  
  // 2. Clear UI
  messagesDiv.innerHTML = "";
  currentChatPath = path;
  currentChatName = name;
  chatTitle.textContent = name;
  usersModal.classList.add("hidden");

  // 3. UI Toggles
  if (path === "messages") {
    // Global
    backToGlobalBtn.classList.add("hidden");
    usersBtn.classList.remove("hidden");
    onlineStatus.classList.remove("hidden");
  } else {
    // Private
    backToGlobalBtn.classList.remove("hidden");
    usersBtn.classList.add("hidden");
    onlineStatus.classList.add("hidden");
  }

  // 4. Start Listeners for NEW path
  startChatListeners(path);
}

// Back Button
backToGlobalBtn.onclick = () => switchChat("messages", "CYOU Global");

/* ---------------- Users List Logic ---------------- */
usersBtn.onclick = () => {
  usersModal.classList.remove("hidden");
  loadUsers();
};
closeUsersBtn.onclick = () => usersModal.classList.add("hidden");

async function loadUsers() {
  usersList.innerHTML = "Loading...";
  try {
    // Fetch all registered users
    const usersSnap = await get(ref(db, "users"));
    // Fetch online status
    const presenceSnap = await get(ref(db, "presence"));
    
    usersList.innerHTML = "";
    const presenceData = presenceSnap.val() || {};
    
    usersSnap.forEach(child => {
      const u = child.val();
      const uid = child.key;
      if (uid === currentUser.uid) return; // Don't show myself

      const isOnline = presenceData[uid] && presenceData[uid].online;
      
      const div = document.createElement("div");
      div.className = "user-item";
      div.innerHTML = `
        <div class="user-avatar">${u.username[0].toUpperCase()}</div>
        <div class="user-info">
          <div class="user-name">${u.username}</div>
          <div class="user-status">
            <span class="status-dot ${isOnline ? 'online' : ''}"></span>
            ${isOnline ? 'Online' : 'Offline'}
          </div>
        </div>
      `;
      
      div.onclick = () => startPrivateChat(uid, u.username);
      usersList.appendChild(div);
    });
  } catch (e) {
    usersList.innerHTML = "Error loading users.";
  }
}

function startPrivateChat(targetUid, targetName) {
  // Generate Chat ID: Alphabetical order ensures both users get same ID
  const chatId = currentUser.uid < targetUid 
    ? `${currentUser.uid}_${targetUid}` 
    : `${targetUid}_${currentUser.uid}`;
  
  switchChat(`private_messages/${chatId}`, targetName);
}

/* ---------------- Messaging Logic ---------------- */
inputForm.onsubmit = async (e) => {
  e.preventDefault();
  const text = messageInput.value.trim();
  if(!text) return;
  
  const payload = {
    sender: currentUser.username,
    senderId: currentUser.uid,
    text: text,
    time: serverTimestamp(),
    edited: false,
    deleted: false,
    reactions: {},
    replyTo: activeReply || null,
  };

  try { await push(ref(db, currentChatPath), payload); } catch(e) { console.error(e); }
  messageInput.value = "";
  cancelReply();
}

/* ---------------- Realtime Listeners ---------------- */
function startChatListeners(path) {
  const chatRef = ref(db, path);

  onChildAdded(chatRef, (snap) => {
    renderMessage(snap.key, snap.val());
    if (snap.val().senderId !== currentUser.uid && userIsScrolledUp) {
      newMessagesCount++;
      newMessagesButton.classList.remove("hidden");
    }
    if (snap.val().senderId !== currentUser.uid && readyForSound) {
      receiveSound.play().catch(()=>{});
    }
  });

  onChildChanged(chatRef, (snap) => renderMessage(snap.key, snap.val(), true));
  onChildRemoved(chatRef, (snap) => document.getElementById(snap.key)?.remove());

  // Typing logic depends on chat
  // Note: Simple typing only supported in global for now to keep code simple
  if (path === "messages") {
    onValue(ref(db, "presence"), (snap) => {
       const count = Object.values(snap.val() || {}).filter(u => u.online).length;
       onlineStatus.textContent = count > 0 ? `${count} Online` : "Offline";
    });
  }
  
  // Scroll
  messagesDiv.onscroll = () => {
    userIsScrolledUp = (messagesDiv.scrollHeight - messagesDiv.scrollTop - messagesDiv.clientHeight > 100);
    if(!userIsScrolledUp) { newMessagesCount=0; newMessagesButton.classList.add("hidden"); }
  }
  newMessagesButton.onclick = () => messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

/* ---------------- Render Helpers ---------------- */
function renderMessage(id, m, changed=false) {
  let el = document.getElementById(id);
  const isMine = m.senderId === currentUser.uid;

  if(!el) {
    el = document.createElement("div");
    el.id = id;
    messagesDiv.appendChild(el);
    setTimeout(()=>el.classList.add("show"), 10);
  }
  el.className = "message " + (isMine ? "you" : "them") + " show";

  if(m.deleted) {
    el.classList.add("deleted");
    el.innerHTML = `<div class="msg-text"><i class="fa-solid fa-ban"></i> Deleted</div>`;
    return;
  }

  const actionsHtml = `
    <div class="msg-actions">
      <button class="act" data-a="reply"><i class="fa-solid fa-reply"></i></button>
      <button class="act" data-a="react"><i class="fa-regular fa-face-smile"></i></button>
      ${isMine ? `<button class="act" data-a="delete"><i class="fa-solid fa-trash"></i></button>` : ''}
    </div>`;

  let reactHtml = '';
  if(m.reactions) {
    const counts = {};
    Object.values(m.reactions).forEach(r => counts[r]=(counts[r]||0)+1);
    reactHtml = '<div class="reactions-bar">';
    for(let [e, c] of Object.entries(counts)) {
       reactHtml += `<div class="reaction-pill ${m.reactions[currentUser.uid]===e?'reacted':''}" data-e="${e}">${e} ${c}</div>`;
    }
    reactHtml += '</div>';
  }

  // Linkify & Time
  const safeText = m.text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>');
  const time = m.time ? new Date(m.time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : "";

  el.innerHTML = `
    ${!isMine ? `<div class="avatar">${m.sender[0].toUpperCase()}</div>` : ''}
    <div style="display:flex;flex-direction:column;width:100%;">
      ${actionsHtml}
      <div class="reactions-picker hidden" id="pick-${id}">${AVAILABLE_REACTIONS.map(e=>`<span class="react-emoji" data-e="${e}">${e}</span>`).join('')}</div>
      <div class="senderName">${isMine?"You":m.sender}</div>
      ${m.replyTo ? `<div class="reply-context"><b>${m.replyTo.sender}</b>: ${m.replyTo.text.substring(0,20)}...</div>`:''}
      <div class="msg-text">${safeText}</div>
      <div class="meta">${time} ${isMine ? '<span class="ticks blue">✓✓</span>' : ''}</div>
      ${reactHtml}
    </div>
  `;

  // Events
  el.querySelectorAll('.act').forEach(btn => {
     btn.onclick = () => {
        const action = btn.dataset.a;
        if(action==='reply') { activeReply={id, sender:m.sender, text:m.text}; replyContextBar.innerHTML=`Reply to <b>${m.sender}</b> <button id="noRep">x</button>`; replyContextBar.classList.remove("hidden"); document.getElementById("noRep").onclick=cancelReply; messageInput.focus(); }
        if(action==='react') document.getElementById(`pick-${id}`).classList.toggle("hidden");
        if(action==='delete') { if(confirm("Delete?")) update(ref(db, `${currentChatPath}/${id}`), {deleted:true}); }
     };
  });
  el.querySelectorAll('.react-emoji').forEach(btn => {
     btn.onclick = () => {
        const e = btn.dataset.e;
        set(ref(db, `${currentChatPath}/${id}/reactions/${currentUser.uid}`), m.reactions?.[currentUser.uid]===e ? null : e);
        document.getElementById(`pick-${id}`).classList.add("hidden");
     }
  });

  if(!changed && !userIsScrolledUp) messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function cancelReply() { activeReply=null; replyContextBar.classList.add("hidden"); }

themeToggle.onclick = () => {
   const dark = document.body.getAttribute("data-theme")==="dark";
   document.body.setAttribute("data-theme", dark ? "" : "dark");
   themeToggle.innerHTML = dark ? '<i class="fa-solid fa-moon"></i>' : '<i class="fa-solid fa-sun"></i>';
}
