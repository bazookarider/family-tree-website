import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getDatabase, ref, push, onChildAdded, onChildChanged, onChildRemoved, onValue, update, set, serverTimestamp, get, off, onDisconnect, remove
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

// Request Modal
const requestModal = document.getElementById("requestModal");
const requestText = document.getElementById("requestText");
const acceptReqBtn = document.getElementById("acceptReqBtn");
const declineReqBtn = document.getElementById("declineReqBtn");

/* ---------------- State ---------------- */
let currentUser = null; 
let currentChatPath = "messages"; 
let currentChatName = "CYOU Global";
let readyForSound = false;
let typingTimeout = null;
let activeReply = null; 
let userIsScrolledUp = false;
let newMessagesCount = 0;
let incomingRequestData = null; // Stores info about pending request
const AVAILABLE_REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '😡'];

/* ---------------- Auth Logic ---------------- */
onAuthStateChanged(auth, async (user) => {
  if (user) {
    if (!user.emailVerified) {
      authError.innerHTML = `Verify email first.<br><button id="resendBtn">Resend Link</button>`;
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
    off(ref(db, "requests/" + (currentUser ? currentUser.uid : ""))); // Stop listening
  }
});

showSignup.onclick = () => { loginForm.classList.add("hidden"); signupForm.classList.remove("hidden"); resetForm.classList.add("hidden"); authError.textContent=""; };
showLogin.onclick = () => { signupForm.classList.add("hidden"); loginForm.classList.remove("hidden"); resetForm.classList.add("hidden"); authError.textContent=""; };
forgotPassBtn.onclick = () => { loginForm.classList.add("hidden"); resetForm.classList.remove("hidden"); authError.textContent=""; };
cancelReset.onclick = () => { resetForm.classList.add("hidden"); loginForm.classList.remove("hidden"); authError.textContent=""; };

signupForm.onsubmit = async (e) => {
  e.preventDefault();
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
  } catch (err) { alert(err.message); }
  signupBtn.disabled = false;
};

loginForm.onsubmit = async (e) => {
  e.preventDefault();
  loginBtn.disabled = true;
  try { await signInWithEmailAndPassword(auth, document.getElementById("loginEmail").value, document.getElementById("loginPass").value); } 
  catch (err) { authError.textContent = "Invalid credentials."; }
  loginBtn.disabled = false;
};

resetForm.onsubmit = async (e) => {
  e.preventDefault();
  resetBtn.disabled = true;
  try { await sendPasswordResetEmail(auth, document.getElementById("resetEmail").value); alert("Reset link sent!"); cancelReset.click(); } 
  catch (err) { alert(err.message); }
  resetBtn.disabled = false;
};

logoutBtn.onclick = () => { 
  if(confirm("Log out?")) {
    update(ref(db, `presence/${currentUser.uid}`), { online: false }); // Force offline
    signOut(auth);
  }
};

/* ---------------- App Start ---------------- */
async function startApp() {
  authScreen.classList.add("hidden");
  chatScreen.classList.remove("hidden");
  
  // FIX: Accurate Presence Logic
  const presenceRef = ref(db, `presence/${currentUser.uid}`);
  await set(presenceRef, { name: currentUser.username, online: true, lastSeen: serverTimestamp() });
  onDisconnect(presenceRef).update({ online: false, lastSeen: serverTimestamp() }); // Auto offline on close

  startRequestListeners();
  switchChat("messages", "CYOU Global");
  setTimeout(() => { readyForSound = true; }, 1000);
}

/* ---------------- Chat Switching ---------------- */
async function switchChat(path, name) {
  if (currentChatPath) off(ref(db, currentChatPath));
  off(ref(db, "typing"));
  
  messagesDiv.innerHTML = "";
  currentChatPath = path;
  currentChatName = name;
  chatTitle.textContent = name;
  usersModal.classList.add("hidden");

  if (path === "messages") {
    backToGlobalBtn.classList.add("hidden");
    usersBtn.classList.remove("hidden");
    onlineStatus.classList.remove("hidden");
  } else {
    backToGlobalBtn.classList.remove("hidden");
    usersBtn.classList.add("hidden");
    onlineStatus.classList.add("hidden");
  }
  startChatListeners(path);
}

backToGlobalBtn.onclick = () => switchChat("messages", "CYOU Global");

/* ---------------- Request System ---------------- */
function startRequestListeners() {
  const myReqRef = ref(db, `requests/${currentUser.uid}`);
  onChildAdded(myReqRef, (snap) => {
    const req = snap.val();
    const reqId = snap.key;
    
    // Type 1: I received a request
    if (req.type === "INVITE") {
      incomingRequestData = { id: reqId, ...req };
      requestText.textContent = `${req.senderName} wants to private chat.`;
      requestModal.classList.remove("hidden");
    }
    
    // Type 2: My request was ACCEPTED
    if (req.type === "ACCEPTED") {
      alert(`${req.senderName} accepted your request!`);
      // Start chat
      const chatId = currentUser.uid < req.senderUid ? `${currentUser.uid}_${req.senderUid}` : `${req.senderUid}_${currentUser.uid}`;
      switchChat(`private_messages/${chatId}`, req.senderName);
      // Delete the notification
      remove(ref(db, `requests/${currentUser.uid}/${reqId}`));
    }
  });
}

// User Actions for Requests
acceptReqBtn.onclick = async () => {
  if (!incomingRequestData) return;
  const targetUid = incomingRequestData.senderUid;
  const targetName = incomingRequestData.senderName;
  
  // Notify sender "ACCEPTED"
  await push(ref(db, `requests/${targetUid}`), {
    type: "ACCEPTED",
    senderUid: currentUser.uid,
    senderName: currentUser.username
  });
  
  // Enter Chat
  const chatId = currentUser.uid < targetUid ? `${currentUser.uid}_${targetUid}` : `${targetUid}_${currentUser.uid}`;
  switchChat(`private_messages/${chatId}`, targetName);
  
  // Clean up
  remove(ref(db, `requests/${currentUser.uid}/${incomingRequestData.id}`));
  requestModal.classList.add("hidden");
};

declineReqBtn.onclick = () => {
  if (incomingRequestData) remove(ref(db, `requests/${currentUser.uid}/${incomingRequestData.id}`));
  requestModal.classList.add("hidden");
};

async function sendRequest(targetUid, targetName) {
  if(targetUid === currentUser.uid) return;
  if(!confirm(`Send chat request to ${targetName}?`)) return;
  
  await push(ref(db, `requests/${targetUid}`), {
    type: "INVITE",
    senderUid: currentUser.uid,
    senderName: currentUser.username
  });
  
  alert("Request sent! Wait for them to accept.");
  usersModal.classList.add("hidden");
}

/* ---------------- Users List ---------------- */
usersBtn.onclick = () => { usersModal.classList.remove("hidden"); loadUsers(); };
closeUsersBtn.onclick = () => usersModal.classList.add("hidden");

async function loadUsers() {
  usersList.innerHTML = '<div style="text-align:center;padding:20px;">Loading...</div>';
  try {
    // Attempt to load users (Will fail if Rules aren't updated)
    const usersSnap = await get(ref(db, "users"));
    const presenceSnap = await get(ref(db, "presence"));
    
    usersList.innerHTML = "";
    const presenceData = presenceSnap.val() || {};
    
    const usersArr = [];
    usersSnap.forEach(child => {
      if (child.key !== currentUser.uid) {
         const u = child.val();
         u.uid = child.key;
         u.isOnline = presenceData[child.key] && presenceData[child.key].online;
         usersArr.push(u);
      }
    });

    // Sort: Online first
    usersArr.sort((a, b) => (b.isOnline ? 1 : 0) - (a.isOnline ? 1 : 0));

    usersArr.forEach(u => {
      const div = document.createElement("div");
      div.className = `user-item ${u.isOnline ? 'online-user' : ''}`;
      div.innerHTML = `
        <div class="user-avatar">${u.username[0].toUpperCase()}</div>
        <div class="user-info">
          <div class="user-name">${u.username}</div>
          <div class="user-status">
            <span class="status-dot ${u.isOnline ? 'online' : ''}"></span>
            ${u.isOnline ? 'Online' : 'Offline'}
          </div>
        </div>
      `;
      // Click triggers REQUEST, not instant chat
      div.onclick = () => sendRequest(u.uid, u.username);
      usersList.appendChild(div);
    });

    if(usersArr.length === 0) usersList.innerHTML = '<div style="text-align:center;padding:20px;">No other users yet.</div>';

  } catch (e) {
    console.error(e);
    // Explicit Error for Rules
    usersList.innerHTML = '<div style="color:red;padding:20px;text-align:center;">Error: Permission Denied.<br>Please update Firebase Rules in Console.</div>';
  }
}

/* ---------------- Messaging Logic ---------------- */
inputForm.onsubmit = async (e) => {
  e.preventDefault();
  const text = messageInput.value.trim();
  if(!text) return;
  const payload = { sender: currentUser.username, senderId: currentUser.uid, text: text, time: serverTimestamp(), replyTo: activeReply||null };
  try { await push(ref(db, currentChatPath), payload); } catch(e) {}
  messageInput.value = "";
  cancelReply();
}

function startChatListeners(path) {
  const chatRef = ref(db, path);
  onChildAdded(chatRef, (snap) => {
    renderMessage(snap.key, snap.val());
    if (snap.val().senderId !== currentUser.uid && userIsScrolledUp) {
      newMessagesCount++;
      newMessagesButton.classList.remove("hidden");
    }
    if (snap.val().senderId !== currentUser.uid && readyForSound) receiveSound.play().catch(()=>{});
  });
  
  // Online Count only for Global
  if (path === "messages") {
    onValue(ref(db, "presence"), (snap) => {
       const count = Object.values(snap.val() || {}).filter(u => u.online).length;
       onlineStatus.textContent = count > 0 ? `${count} Online` : "Offline";
    });
  }
}

/* ---------------- Render ---------------- */
function renderMessage(id, m, changed=false) {
  let el = document.getElementById(id);
  const isMine = m.senderId === currentUser.uid;
  if(!el) { el = document.createElement("div"); el.id = id; messagesDiv.appendChild(el); setTimeout(()=>el.classList.add("show"),10); }
  el.className = "message " + (isMine ? "you" : "them") + " show";

  if(m.deleted) { el.classList.add("deleted"); el.innerHTML = "Deleted"; return; }

  const actions = `<div class="msg-actions"><button class="act" data-a="reply"><i class="fa-solid fa-reply"></i></button>${isMine?`<button class="act" data-a="delete"><i class="fa-solid fa-trash"></i></button>`:''}</div>`;
  const safeText = m.text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>');
  const time = m.time ? new Date(m.time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : "";

  el.innerHTML = `${!isMine?`<div class="avatar">${m.sender[0]}</div>`:''}<div>${actions}<div class="senderName">${isMine?"You":m.sender}</div>${m.replyTo?`<div class="reply-context"><b>${m.replyTo.sender}</b>: ${m.replyTo.text.substring(0,10)}...</div>`:''}<div class="msg-text">${safeText}</div><div class="meta">${time}</div></div>`;

  el.querySelectorAll('.act').forEach(btn => btn.onclick = () => {
     if(btn.dataset.a==='reply'){ activeReply={id, sender:m.sender, text:m.text}; replyContextBar.innerHTML=`Replying to <b>${m.sender}</b> <button id="noRep">x</button>`; replyContextBar.classList.remove("hidden"); document.getElementById("noRep").onclick=cancelReply; }
     if(btn.dataset.a==='delete' && confirm("Delete?")) update(ref(db, `${currentChatPath}/${id}`), {deleted:true});
  });
  if(!changed && !userIsScrolledUp) messagesDiv.scrollTop = messagesDiv.scrollHeight;
}
function cancelReply() { activeReply=null; replyContextBar.classList.add("hidden"); }
themeToggle.onclick = () => { const d=document.body.getAttribute("data-theme")==="dark"; document.body.setAttribute("data-theme", d?"":"dark"); themeToggle.innerHTML=d?'<i class="fa-solid fa-moon"></i>':'<i class="fa-solid fa-sun"></i>'; }
