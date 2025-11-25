import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getDatabase, ref, push, onChildAdded, onChildChanged, onChildRemoved, onValue, update, set, serverTimestamp, get
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

/* ---------------- State ---------------- */
let currentUser = null; 
let readyForSound = false;
let typingTimeout = null;
let activeReply = null; 
let userIsScrolledUp = false;
let newMessagesCount = 0;
const AVAILABLE_REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '😡'];

/* ---------------- Auth Logic ---------------- */

// 1. Monitor Auth State
onAuthStateChanged(auth, async (user) => {
  if (user) {
    // SECURITY CHECK: Is email verified?
    if (!user.emailVerified) {
      authError.innerHTML = `Please verify your email to continue.<br><button id="resendBtn" style="margin-top:5px;padding:4px 8px;">Resend Link</button>`;
      document.getElementById("resendBtn").onclick = () => {
         sendEmailVerification(user).then(() => alert("Verification link resent!"));
      };
      // We do NOT let them in.
      return; 
    }

    // User is verified, load profile
    try {
      const snapshot = await get(ref(db, `users/${user.uid}`));
      if (snapshot.exists()) {
        currentUser = { uid: user.uid, email: user.email, username: snapshot.val().username };
        startApp();
      } else {
        authError.textContent = "Profile error. Please contact admin.";
        signOut(auth);
      }
    } catch (e) {
      console.error(e);
      authError.textContent = "Connection failed.";
    }
  } else {
    // Logged out
    currentUser = null;
    chatScreen.classList.add("hidden");
    authScreen.classList.remove("hidden");
    resetChat();
  }
});

// 2. Switch Views
showSignup.onclick = () => { loginForm.classList.add("hidden"); signupForm.classList.remove("hidden"); resetForm.classList.add("hidden"); authError.textContent = ""; };
showLogin.onclick = () => { signupForm.classList.add("hidden"); loginForm.classList.remove("hidden"); resetForm.classList.add("hidden"); authError.textContent = ""; };
forgotPassBtn.onclick = () => { loginForm.classList.add("hidden"); resetForm.classList.remove("hidden"); authError.textContent = ""; };
cancelReset.onclick = () => { resetForm.classList.add("hidden"); loginForm.classList.remove("hidden"); authError.textContent = ""; };

// 3. Sign Up (With Verification)
signupForm.onsubmit = async (e) => {
  e.preventDefault();
  authError.textContent = "Checking availability...";
  signupBtn.disabled = true;

  const name = document.getElementById("signupName").value.trim();
  const email = document.getElementById("signupEmail").value.trim();
  const pass = document.getElementById("signupPass").value;

  if (name.length < 3) { authError.textContent = "Username must be 3+ chars."; signupBtn.disabled = false; return; }

  try {
    const nameCheck = await get(ref(db, `usernames/${name}`));
    if (nameCheck.exists()) {
      alert(`Username '${name}' is already taken!`);
      authError.textContent = `Username '${name}' is taken.`;
      signupBtn.disabled = false;
      return;
    }

    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    const uid = cred.user.uid;

    // Save Profile
    await set(ref(db, `users/${uid}`), { username: name, email: email, joined: serverTimestamp() });
    await set(ref(db, `usernames/${name}`), uid);

    // SEND VERIFICATION EMAIL
    await sendEmailVerification(cred.user);
    
    alert(`Account created! We sent a verification link to ${email}. Please check your inbox (and spam) to activate your account.`);
    authError.textContent = "Check your email inbox to verify account.";
    
    // Auto sign-out so they can't chat yet
    await signOut(auth);
    
    // Return to login
    signupForm.classList.add("hidden");
    loginForm.classList.remove("hidden");
    signupBtn.disabled = false;

  } catch (err) {
    console.error(err);
    alert("Sign Up Error: " + err.message);
    authError.textContent = "Error: " + err.message;
    signupBtn.disabled = false;
  }
};

// 4. Log In
loginForm.onsubmit = async (e) => {
  e.preventDefault();
  authError.textContent = "Logging in...";
  loginBtn.disabled = true;

  const email = document.getElementById("loginEmail").value;
  const pass = document.getElementById("loginPass").value;

  try {
    await signInWithEmailAndPassword(auth, email, pass);
    // onAuthStateChanged handles the rest (checking verification)
    loginBtn.disabled = false;
  } catch (err) {
    console.error(err);
    authError.textContent = "Invalid email or password.";
    loginBtn.disabled = false;
  }
};

// 5. Reset Password
resetForm.onsubmit = async (e) => {
  e.preventDefault();
  resetBtn.disabled = true;
  const email = document.getElementById("resetEmail").value;
  try {
    await sendPasswordResetEmail(auth, email);
    alert("Password reset link sent to " + email);
    resetForm.classList.add("hidden");
    loginForm.classList.remove("hidden");
  } catch (err) {
    alert("Error: " + err.message);
  }
  resetBtn.disabled = false;
};

// 6. Log Out
logoutBtn.onclick = () => { if(confirm("Log out?")) signOut(auth); };

/* ---------------- App Start ---------------- */
async function startApp() {
  authScreen.classList.add("hidden");
  chatScreen.classList.remove("hidden");
  authError.textContent = "";
  
  const presenceNode = ref(db, `presence/${currentUser.uid}`);
  await set(presenceNode, { name: currentUser.username, online: true, lastSeen: serverTimestamp() });
  
  window.addEventListener("beforeunload", async () => {
    await update(presenceNode, { online: false, lastSeen: serverTimestamp() });
  });

  startListeners();
  setTimeout(() => { readyForSound = true; }, 1000);
}

function resetChat() {
  messagesDiv.innerHTML = "";
  onlineStatus.textContent = "Connecting...";
  readyForSound = false;
}

/* ---------------- Messaging Logic ---------------- */
inputForm.onsubmit = async (e) => {
  e.preventDefault();
  const text = messageInput.value.trim();
  if(!text) return;
  await doSend(text);
};

async function doSend(text, forwardedData = null) {
  if (!currentUser) return;
  const payload = {
    sender: currentUser.username,
    senderId: currentUser.uid,
    text: text,
    time: serverTimestamp(),
    edited: false,
    deleted: false,
    reactions: {},
    replyTo: activeReply || null,
    forwarded: forwardedData ? { from: forwardedData.sender } : null
  };
  try { await push(ref(db, "messages"), payload); } catch(e) { console.error(e); }
  messageInput.value = "";
  cancelReply();
  set(ref(db, `typing/${currentUser.uid}`), false);
}

/* ---------------- Realtime Listeners ---------------- */
function startListeners() {
  const messagesRef = ref(db, "messages");

  onChildAdded(messagesRef, (snap) => {
    renderMessage(snap.key, snap.val());
    if (snap.val().senderId !== currentUser.uid && userIsScrolledUp) {
      newMessagesCount++;
      newMessagesButton.classList.remove("hidden");
      newMessagesButton.innerHTML = `${newMessagesCount} New <i class="fa-solid fa-arrow-down"></i>`;
    }
    if (snap.val().senderId !== currentUser.uid && readyForSound) {
      receiveSound.play().catch(()=>{});
    }
  });

  onChildChanged(messagesRef, (snap) => renderMessage(snap.key, snap.val(), true));
  onChildRemoved(messagesRef, (snap) => document.getElementById(snap.key)?.remove());

  messageInput.oninput = () => {
    set(ref(db, `typing/${currentUser.uid}`), currentUser.username);
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => set(ref(db, `typing/${currentUser.uid}`), false), 1500);
  };

  onValue(ref(db, "typing"), (snap) => {
    const data = snap.val() || {};
    const typers = Object.entries(data).filter(([uid, name]) => uid !== currentUser.uid && name).map(([_, name]) => name);
    typingIndicator.textContent = typers.length ? `${typers[0]} is typing...` : "";
  });

  onValue(ref(db, "presence"), (snap) => {
    const count = Object.values(snap.val() || {}).filter(u => u.online).length;
    onlineStatus.textContent = count > 0 ? `${count} Online` : "Offline";
  });
  
  onValue(ref(db, "pinnedMessage"), (snap) => {
     const pinned = snap.val();
     if(pinned && pinned.msgId) {
        pinnedMessageBar.innerHTML = `<span><i class="fa-solid fa-thumbtack"></i> ${truncate(pinned.text, 40)}</span> <button id="unpinBtn" class="unpin-btn"><i class="fa-solid fa-xmark"></i></button>`;
        pinnedMessageBar.classList.remove("hidden");
        document.getElementById("unpinBtn").onclick = () => set(ref(db, "pinnedMessage"), null);
     } else {
        pinnedMessageBar.classList.add("hidden");
     }
  });

  messagesDiv.onscroll = () => {
    userIsScrolledUp = (messagesDiv.scrollHeight - messagesDiv.scrollTop - messagesDiv.clientHeight > 100);
    if(!userIsScrolledUp) { newMessagesCount=0; newMessagesButton.classList.add("hidden"); }
  }
  newMessagesButton.onclick = () => messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

/* ---------------- Render Helpers ---------------- */
function linkify(text) { return text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>'); }
function truncate(s, l) { return s.length > l ? s.substring(0, l) + "..." : s; }
function escapeHtml(s) { return s ? s.replace(/&/g, "&amp;").replace(/</g, "&lt;") : ""; }
function shortTime(ts) { return ts ? new Date(ts).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : ""; }

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
      <button class="act" data-a="reply" title="Reply"><i class="fa-solid fa-reply"></i></button>
      <button class="act" data-a="react" title="React"><i class="fa-regular fa-face-smile"></i></button>
      <button class="act" data-a="forward" title="Forward"><i class="fa-solid fa-share"></i></button>
      <button class="act" data-a="pin" title="Pin"><i class="fa-solid fa-thumbtack"></i></button>
      ${isMine ? `
        <button class="act" data-a="edit" title="Edit"><i class="fa-solid fa-pen"></i></button>
        <button class="act" data-a="delete" title="Delete"><i class="fa-solid fa-trash"></i></button>
      ` : ''}
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

  const safeText = linkify(escapeHtml(m.text));

  el.innerHTML = `
    ${!isMine ? `<div class="avatar">${m.sender[0].toUpperCase()}</div>` : ''}
    <div style="display:flex;flex-direction:column;width:100%;">
      ${actionsHtml}
      <div class="reactions-picker hidden" id="pick-${id}">${AVAILABLE_REACTIONS.map(e=>`<span class="react-emoji" data-e="${e}">${e}</span>`).join('')}</div>
      <div class="senderName">${isMine?"You":escapeHtml(m.sender)}</div>
      ${m.replyTo ? `<div class="reply-context"><b>${escapeHtml(m.replyTo.sender)}</b>: ${truncate(m.replyTo.text, 30)}</div>`:''}
      ${m.forwarded ? `<div style="font-size:0.75rem;opacity:0.7;font-style:italic"><i class="fa-solid fa-share"></i> Fwd from ${m.forwarded.from}</div>` : ''}
      <div class="msg-text">${safeText}</div>
      <div class="meta">
         ${m.edited ? '<i class="fa-solid fa-pen" style="font-size:8px"></i>' : ''}
         ${shortTime(m.time)}
         ${isMine ? '<span class="ticks blue">✓✓</span>' : ''}
      </div>
      ${reactHtml}
    </div>
  `;

  el.querySelectorAll('.act').forEach(btn => {
     btn.onclick = () => {
        const action = btn.dataset.a;
        if(action==='reply') { activeReply={id, sender:m.sender, text:m.text}; replyContextBar.innerHTML=`Replying to <b>${m.sender}</b> <button id="noRep">x</button>`; replyContextBar.classList.remove("hidden"); document.getElementById("noRep").onclick=cancelReply; messageInput.focus(); }
        if(action==='react') document.getElementById(`pick-${id}`).classList.toggle("hidden");
        if(action==='forward') { if(confirm("Forward?")) doSend(m.text, {sender:m.sender}); }
        if(action==='pin') set(ref(db, "pinnedMessage"), {msgId:id, text:m.text});
        if(action==='edit') { const t=prompt("Edit:", m.text); if(t) update(ref(db, `messages/${id}`), {text:t, edited:true}); }
        if(action==='delete') { if(confirm("Delete?")) update(ref(db, `messages/${id}`), {deleted:true}); }
     };
  });
  
  el.querySelectorAll('.react-emoji').forEach(btn => {
     btn.onclick = () => {
        const e = btn.dataset.e;
        const p = `messages/${id}/reactions/${currentUser.uid}`;
        set(ref(db, p), m.reactions?.[currentUser.uid]===e ? null : e);
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
