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
let incomingRequestData = null;
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
    update(ref(db, `presence/${currentUser.uid}`), { online: false }); 
    signOut(auth);
  }
};

/* ---------------- App Start ---------------- */
async function startApp() {
  authScreen.classList.add("hidden");
  chatScreen.classList.remove("hidden");
  
  const presenceRef = ref(db, `presence/${currentUser.uid}`);
  await set(presenceRef, { name: currentUser.username, online: true, lastSeen: serverTimestamp() });
  onDisconnect(presenceRef).update({ online: false, lastSeen: serverTimestamp() });

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
    if (req.type === "INVITE") {
      incomingRequestData = { id: reqId, ...req };
      requestText.textContent = `${req.senderName} wants to private chat.`;
      requestModal.classList.remove("hidden");
    }
    if (req.type === "ACCEPTED") {
      alert(`${req.senderName} accepted your request!`);
      const chatId = currentUser.uid < req.senderUid ? `${currentUser.uid}_${req.senderUid}` : `${req.senderUid}_${currentUser.uid}`;
      switchChat(`private_messages/${chatId}`, req.senderName);
      remove(ref(db, `requests/${currentUser.uid}/${reqId}`));
    }
  });
}

acceptReqBtn.onclick = async () => {
  if (!incomingRequestData) return;
  const targetUid = incomingRequestData.senderUid;
  const targetName = incomingRequestData.senderName;
  await push(ref(db, `requests/${targetUid}`), { type: "ACCEPTED", senderUid: currentUser.uid, senderName: currentUser.username });
  const chatId = currentUser.uid < targetUid ? `${currentUser.uid}_${targetUid}` : `${targetUid}_${currentUser.uid}`;
  switchChat(`private_messages/${chatId}`, targetName);
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
  await push(ref(db, `requests/${targetUid}`), { type: "INVITE", senderUid: currentUser.uid, senderName: currentUser.username });
  alert("Request sent!");
  usersModal.classList.add("hidden");
}

/* ---------------- Users List with AVATARS ---------------- */
usersBtn.onclick = () => { usersModal.classList.remove("hidden"); loadUsers(); };
closeUsersBtn.onclick = () => usersModal.classList.add("hidden");

async function loadUsers() {
  usersList.innerHTML = '<div style="text-align:center;padding:20px;">Loading...</div>';
  try {
    const usersSnap = await get(ref(db, "users"));
    
    // FIX: Handle empty database
    if (!usersSnap.exists()) {
       usersList.innerHTML = '<div style="text-align:center;padding:20px;">No other users found.</div>';
       return;
    }

    const presenceSnap = await get(ref(db, "presence"));
    const presenceData = presenceSnap.val() || {};
    
    usersList.innerHTML = "";
    const usersArr = [];
    usersSnap.forEach(child => {
      if (child.key !== currentUser.uid) {
         const u = child.val();
         u.uid = child.key;
         u.isOnline = presenceData[child.key] && presenceData[child.key].online;
         usersArr.push(u);
      }
    });

    usersArr.sort((a, b) => (b.isOnline ? 1 : 0) - (a.isOnline ? 1 : 0));

    if (usersArr.length === 0) {
        usersList.innerHTML = '<div style="text-align:center;padding:20px;">No other users yet.</div>';
        return;
    }

    usersArr.forEach(u => {
      // AVATAR GENERATOR (DiceBear)
      const avatarUrl = `https://api.dicebear.com/7.x/initials/svg?seed=${u.username}&backgroundColor=006677`;
      
      const div = document.createElement("div");
      div.className = `user-item ${u.isOnline ? 'online-user' : ''}`;
      div.innerHTML = `
        <img src="${avatarUrl}" class="user-avatar" alt="${u.username}" style="width:40px;height:40px;border-radius:50%;">
        <div class="user-info">
          <div class="user-name">${u.username}</div>
          <div class="user-status">
            <span class="status-dot ${u.isOnline ? 'online' : ''}"></span>
            ${u.isOnline ? 'Online' : 'Offline'}
          </div>
        </div>
      `;
      div.onclick = () => sendRequest(u.uid, u.username);
      usersList.appendChild(div);
    });

  } catch (e) {
    console.error(e);
    // Print REAL error
    usersList.innerHTML = `<div style="color:red;padding:20px;text-align:center;">Error: ${e.message}</div>`;
  }
}

/* ---------------- Messaging Logic (Sending) ---------------- */
inputForm.onsubmit = async (e) => {
  e.preventDefault();
  const text = messageInput.value.trim();
  if(!text && !activeReply) return; 
  await doSend(text);
};

async function doSend(text, forwardedData = null) {
  const payload = { 
    sender: currentUser.username, 
    senderId: currentUser.uid, 
    text: forwardedData ? forwardedData.text : text, 
    time: serverTimestamp(), 
    replyTo: activeReply || null,
    forwarded: forwardedData ? { from: forwardedData.sender } : null,
    edited: false,
    deleted: false,
    reactions: {}
  };

  try { await push(ref(db, currentChatPath), payload); } catch(e) {}
  messageInput.value = "";
  cancelReply();
  set(ref(db, `typing/${currentUser.uid}`), false);
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
    if (snap.val().senderId !== currentUser.uid && readyForSound) receiveSound.play().catch(()=>{});
  });

  onChildChanged(chatRef, (snap) => renderMessage(snap.key, snap.val(), true));
  onChildRemoved(chatRef, (snap) => document.getElementById(snap.key)?.remove());

  // Online Count (Global Only)
  if (path === "messages") {
    onValue(ref(db, "presence"), (snap) => {
       const count = Object.values(snap.val() || {}).filter(u => u.online).length;
       onlineStatus.textContent = count > 0 ? `${count} Online` : "Offline";
    });
  }

  // Pinned Message (Global Only)
  if (path === "messages") {
    onValue(ref(db, "pinnedMessage"), (snap) => {
       const pinned = snap.val();
       if(pinned && pinned.msgId) {
          pinnedMessageBar.innerHTML = `<span><i class="fa-solid fa-thumbtack"></i> ${pinned.text.substring(0,30)}...</span> <button id="unpinBtn" class="unpin-btn"><i class="fa-solid fa-xmark"></i></button>`;
          pinnedMessageBar.classList.remove("hidden");
          document.getElementById("unpinBtn").onclick = () => set(ref(db, "pinnedMessage"), null);
       } else {
          pinnedMessageBar.classList.add("hidden");
       }
    });
  }
}

/* ---------------- RENDER (RESTORED ALL FEATURES) ---------------- */
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
    el.innerHTML = `<div class="msg-text"><i class="fa-solid fa-ban"></i> Message Deleted</div>`;
    return;
  }

  // Action Buttons
  const actionsHtml = `
    <div class="msg-actions">
      <button class="act" data-a="reply" title="Reply"><i class="fa-solid fa-reply"></i></button>
      <button class="act" data-a="react" title="React"><i class="fa-regular fa-face-smile"></i></button>
      <button class="act" data-a="forward" title="Forward"><i class="fa-solid fa-share"></i></button>
      <button class="act" data-a="pin" title="Pin"><i class="fa-solid fa-thumbtack"></i></button>
      ${isMine ? `
        <button class="act" data-a="edit" title="Edit"><i class="fa-solid fa-pen"></i></button>
        <button class="act" data-a="delete" title="Delete"><i class="fa-solid fa-trash"></i></button>
      ` : ''}
    </div>`;

  // Reactions
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

  // Helper: Linkify
  const safeText = (m.text||"").replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>');
  const time = m.time ? new Date(m.time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : "";
  
  // Avatar URL
  const avatarUrl = `https://api.dicebear.com/7.x/initials/svg?seed=${m.sender}&backgroundColor=006677`;

  el.innerHTML = `
    ${!isMine ? `<img src="${avatarUrl}" class="avatar" style="border-radius:50%;background:#ccc;">` : ''}
    <div style="display:flex;flex-direction:column;width:100%;">
      ${actionsHtml}
      <div class="reactions-picker hidden" id="pick-${id}">${AVAILABLE_REACTIONS.map(e=>`<span class="react-emoji" data-e="${e}">${e}</span>`).join('')}</div>
      
      <div class="senderName">${isMine?"You":m.sender}</div>
      ${m.replyTo ? `<div class="reply-context"><b>${m.replyTo.sender}</b>: ${m.replyTo.text.substring(0,25)}...</div>`:''}
      ${m.forwarded ? `<div style="font-size:0.75rem;opacity:0.7;font-style:italic"><i class="fa-solid fa-share"></i> Fwd from ${m.forwarded.from}</div>` : ''}
      
      <div class="msg-text">${safeText}</div>
      
      <div class="meta">
         ${m.edited ? '<i class="fa-solid fa-pen" style="font-size:8px"></i>' : ''}
         ${time} 
         ${isMine ? '<span class="ticks blue">✓✓</span>' : ''}
      </div>
      ${reactHtml}
    </div>
  `;

  // Attach Events
  el.querySelectorAll('.act').forEach(btn => {
     btn.onclick = () => {
        const action = btn.dataset.a;
        if(action==='reply') { activeReply={id, sender:m.sender, text:m.text}; replyContextBar.innerHTML=`Reply to <b>${m.sender}</b> <button id="noRep">x</button>`; replyContextBar.classList.remove("hidden"); document.getElementById("noRep").onclick=cancelReply; messageInput.focus(); }
        if(action==='react') document.getElementById(`pick-${id}`).classList.toggle("hidden");
        if(action==='forward') { if(confirm("Forward?")) doSend(m.text, {sender:m.sender}); }
        if(action==='pin') set(ref(db, "pinnedMessage"), {msgId:id, text:m.text});
        if(action==='edit') { const t=prompt("Edit:", m.text); if(t) update(ref(db, `${currentChatPath}/${id}`), {text:t, edited:true}); }
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
