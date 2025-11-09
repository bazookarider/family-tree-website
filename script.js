// script.js — part 1 of 5 (paste in order, do NOT reorder)
// Module mode so Firebase ES modules work
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import { getDatabase, ref, onValue, set, push, remove, update } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-database.js";

// --------- Firebase config (your project) ----------
const firebaseConfig = {
  apiKey: "AIzaSyCt-663f11pjMlRY36quOPaM4bwP0o9pRQ",
  authDomain: "maijamaa-family.firebaseapp.com",
  projectId: "maijamaa-family",
  storageBucket: "maijamaa-family.firebasestorage.app",
  messagingSenderId: "302521722471",
  appId: "1:302521722471:web:c65feb3e523564491996c2",
  measurementId: "G-VRKBB9G00B"
};
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// --------- Constants & keys ----------
const ADMIN_NAME = 'Benalee';
const ADMIN_PASSWORD = 'Ab@58563';
const LOCAL_FAMILY_KEY = 'maijamaa_family_local_v1';
const LOCAL_CHAT_KEY = 'maijamaa_chat_local_v1';
const SETTINGS_KEY = 'maijamaa_settings_v1';

// --------- State ----------
let adminLoggedIn = false;
let family = [];      // will be filled from Firebase
let chat = [];        // will be filled from Firebase
let settings = loadSettings() || { theme: 'light', lastActivity: Date.now() };

// --------- DOM refs ----------
const $ = id => document.getElementById(id);
const loginSection = $('loginSection');
const dashboard = $('dashboard');
const loginBtn = $('loginBtn');
const logoutBtn = $('logoutBtn');
const adminUsername = $('adminUsername');
const adminPassword = $('adminPassword');

const addMemberBtn = $('addMemberBtn');
const memberModal = $('memberModal');
const closeModal = $('closeModal');
const memberName = $('memberName');
const memberParent = $('memberParent');
const saveMemberBtn = $('saveMemberBtn');

const treeContainer = $('tree');
const parentSelect = $('inParent'); // referenced in index; if missing will be handled

// theme toggle
const toggleMode = $('toggleMode') || $('toggleMode'); // fallback

// --------- Helpers ----------
function saveSettings(){ localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }
function loadSettings(){ try{ const s = localStorage.getItem(SETTINGS_KEY); return s? JSON.parse(s) : null; }catch(e){ return null; } }
function applyTheme(){ if(settings.theme === 'dark') document.body.classList.add('dark'); else document.body.classList.remove('dark'); }
function now(){ return Date.now(); }

// init apply theme immediately
applyTheme();// script.js — part 2 of 5
// --------- Firebase realtime sync ----------
import { onChildAdded, onChildChanged, onChildRemoved } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-database.js";

const familyRef = ref(db, "family");
const chatRef = ref(db, "chat");

// Listen for family changes in Firebase
onValue(familyRef, snapshot => {
  const data = snapshot.val();
  family = data ? Object.values(data) : [];
  renderTree();
});

// Listen for chat changes
onValue(chatRef, snapshot => {
  const data = snapshot.val();
  chat = data ? Object.values(data) : [];
  renderChat();
});

// --------- Member Handling ----------
function openMemberModal() {
  if (!adminLoggedIn) return alert("Only admin can add members.");
  memberModal.style.display = "block";
}

function closeMemberModal() {
  memberModal.style.display = "none";
  memberName.value = "";
  memberParent.value = "";
}

addMemberBtn.onclick = openMemberModal;
closeModal.onclick = closeMemberModal;

saveMemberBtn.onclick = () => {
  if (!adminLoggedIn) return alert("Only admin can add members.");
  const name = memberName.value.trim();
  const parent = memberParent.value.trim();
  const nickname = $("memberNickname").value.trim();
  const role = $("memberRole").value.trim();

  if (!name || !role) return alert("Please enter name and role.");

  const id = push(familyRef).key;
  const newMember = { id, name, role, nickname, parent };

  set(ref(db, "family/" + id), newMember)
    .then(() => {
      closeMemberModal();
      alert("Member added!");
    })
    .catch(err => console.error(err));
};

// --------- Render Tree ----------
function renderTree() {
  treeContainer.innerHTML = "";
  const roots = family.filter(m => !m.parent);
  roots.forEach(r => {
    const el = createMemberNode(r);
    treeContainer.appendChild(el);
  });
}

function createMemberNode(member) {
  const div = document.createElement("div");
  div.className = "member";
  div.innerHTML = `
    <div class="member-card">
      <strong class="nickname">${member.nickname || "No Nick"}</strong>
      <p>${member.name}</p>
      <p class="role">${member.role}</p>
      ${adminLoggedIn ? `<button onclick="deleteMember('${member.id}')">🗑️</button>` : ""}
    </div>
  `;
  const children = family.filter(m => m.parent === member.name);
  if (children.length) {
    const ul = document.createElement("div");
    ul.className = "children";
    children.forEach(c => ul.appendChild(createMemberNode(c)));
    div.appendChild(ul);
  }
  return div;
}// script.js — part 3 of 5
// --------- Delete / Edit Member ----------
window.deleteMember = function (id) {
  if (!adminLoggedIn) return alert("Only admin can delete members.");
  if (confirm("Are you sure you want to delete this member?")) {
    remove(ref(db, "family/" + id))
      .then(() => alert("Member deleted!"))
      .catch(err => console.error(err));
  }
};

window.editMember = function (id) {
  if (!adminLoggedIn) return alert("Only admin can edit members.");
  const m = family.find(f => f.id === id);
  if (!m) return alert("Member not found!");

  const newName = prompt("Edit name:", m.name);
  const newNick = prompt("Edit nickname:", m.nickname);
  const newRole = prompt("Edit role:", m.role);
  const newParent = prompt("Edit parent:", m.parent);

  if (!newName || !newRole) return alert("Name and role required.");
  update(ref(db, "family/" + id), {
    name: newName,
    nickname: newNick,
    role: newRole,
    parent: newParent
  }).then(() => alert("Member updated."));
};

// --------- Admin Login ----------
loginBtn.onclick = () => {
  const name = adminUsername.value.trim();
  const pass = adminPassword.value.trim();
  if (name === ADMIN_NAME && pass === ADMIN_PASSWORD) {
    adminLoggedIn = true;
    settings.lastActivity = now();
    saveSettings();
    loginSection.style.display = "none";
    dashboard.style.display = "block";
    alert("Welcome Admin!");
  } else {
    alert("Invalid credentials!");
  }
};

// --------- Logout ----------
logoutBtn.onclick = () => {
  adminLoggedIn = false;
  dashboard.style.display = "none";
  loginSection.style.display = "block";
  alert("Logged out successfully.");
};

// --------- Auto Logout after 15 min ----------
function checkInactivity() {
  if (!adminLoggedIn) return;
  const diff = now() - settings.lastActivity;
  if (diff > 15 * 60 * 1000) {
    adminLoggedIn = false;
    dashboard.style.display = "none";
    loginSection.style.display = "block";
    alert("Session expired, logged out for security.");
  }
}

setInterval(checkInactivity, 60000);
window.addEventListener("mousemove", () => settings.lastActivity = now());
window.addEventListener("keydown", () => settings.lastActivity = now());// script.js — part 4 of 5
// --------- Family Chat ----------
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const chatBox = document.getElementById("chatBox");

chatForm.addEventListener("submit", e => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (text === "") return;
  const message = {
    text,
    user: adminLoggedIn ? ADMIN_NAME : "Guest",
    time: Date.now()
  };
  push(ref(db, "chats"), message)
    .then(() => chatInput.value = "")
    .catch(err => console.error(err));
});

// --------- Display Chat ----------
onValue(ref(db, "chats"), snapshot => {
  chatBox.innerHTML = "";
  snapshot.forEach(child => {
    const msg = child.val();
    const div = document.createElement("div");
    div.className = msg.user === ADMIN_NAME ? "chat admin" : "chat guest";
    div.innerHTML = `
      <b>${msg.user}:</b> ${msg.text}
      <small>${new Date(msg.time).toLocaleTimeString()}</small>
      <div class="reactions">
        <button onclick="react('${child.key}', '❤️')">❤️</button>
        <button onclick="react('${child.key}', '👍🏽')">👍🏽</button>
        <button onclick="react('${child.key}', '😂')">😂</button>
      </div>
      <div class="reactionList" id="react-${child.key}"></div>
    `;
    chatBox.appendChild(div);
  });
  chatBox.scrollTop = chatBox.scrollHeight;
});

// --------- Reactions ----------
window.react = function (msgId, emoji) {
  const reactRef = ref(db, `reactions/${msgId}/${emoji}`);
  get(reactRef).then(snap => {
    let count = snap.exists() ? snap.val() + 1 : 1;
    set(reactRef, count);
  });
};

// --------- Show Reactions ----------
onValue(ref(db, "reactions"), snap => {
  snap.forEach(msg => {
    const msgId = msg.key;
    const data = msg.val();
    const div = document.getElementById(`react-${msgId}`);
    if (div) {
      div.innerHTML = Object.entries(data)
        .map(([emoji, count]) => `${emoji} ${count}`)
        .join(" ");
    }
  });
});

// --------- Backup Reminder ----------
function backupReminder() {
  const last = localStorage.getItem("backupTime");
  const nowTime = Date.now();
  if (!last || nowTime - last > 86400000) {
    alert("🗂️ Reminder: Backup your family data today!");
    localStorage.setItem("backupTime", nowTime);
  }
}
setInterval(backupReminder, 3600000);// script.js — part 5 of 5 (final)

// --------- Normalize chat paths (support both 'chat' and 'chats' in DB) ----------
const chatsPath1 = ref(db, "chat");
const chatsPath2 = ref(db, "chats");

// Helper to render chat array -> DOM
function renderChat() {
  const container = document.getElementById("chatMessages");
  if (!container) return;
  container.innerHTML = "";
  // chat variable is kept in sync by earlier onValue listeners
  (chat || []).forEach(msg => {
    const wrap = document.createElement("div");
    wrap.className = "chat-message";
    const who = msg.user || (msg.authorId ? msg.authorId : "Guest");
    const time = msg.time ? new Date(msg.time).toLocaleString() : "";
    // show reply if exists
    const replyHtml = msg.replyTo ? `<div class="reply-to">↪ @${escapeHtml(msg.replyTo)}</div>` : "";
    // reactions display (simple)
    const reactions = msg.reactions ? Object.entries(msg.reactions).map(([k,v]) => `${k} ${v}`).join(" ") : "";
    wrap.innerHTML = `<div><strong>${escapeHtml(who)}</strong> <small>${escapeHtml(time)}</small></div>
                      ${replyHtml}
                      <div>${escapeHtml(msg.text)}</div>
                      <div class="reactions">${escapeHtml(reactions)}</div>`;
    container.appendChild(wrap);
  });
  container.scrollTop = container.scrollHeight;
}

// Ensure both DB chat paths update local chat variable (keeps compatibility)
onValue(chatsPath1, snap => {
  const data = snap.val();
  chat = data ? Object.values(data) : [];
  renderChat();
});
onValue(chatsPath2, snap => {
  const data = snap.val();
  // If primary chat is empty but 'chats' has data, use it (backwards compat)
  const c2 = data ? Object.values(data) : [];
  if ((chat == null || chat.length === 0) && c2.length) {
    chat = c2;
    renderChat();
  }
});

// Wire Send button to primary chat path (ref: "chat")
const sendBtn = document.getElementById("sendMessageBtn");
const chatInputEl = document.getElementById("chatInput");
if (sendBtn) {
  sendBtn.addEventListener("click", () => {
    const text = chatInputEl.value.trim();
    if (!text) return;
    const message = {
      text,
      user: adminLoggedIn ? ADMIN_NAME : "Guest",
      time: Date.now()
    };
    // push to primary chat path
    push(ref(db, "chat"), message)
      .then(() => { chatInputEl.value = ""; })
      .catch(err => console.error("Send message failed:", err));
  });
  // also allow Enter key
  chatInputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); sendBtn.click(); }
  });
}

// Simple escape utility (to use in render)
function escapeHtml(s){ if(!s) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// Final initialization: UI state, theme, renderers
function finalizeInit() {
  applyTheme();
  // Show login or dashboard depending on admin state
  if (adminLoggedIn) {
    loginSection.style.display = "none";
    dashboard.style.display = "block";
  } else {
    loginSection.style.display = "block";
    dashboard.style.display = "none";
  }
  // initial render
  renderTree();
  renderChat();
  renderTimeline && renderTimeline(); // if timeline exists
  // save settings periodically
  setInterval(() => saveSettings(), 30000);
}

// call finalize
finalizeInit();

// expose simple helpers in console for debugging
window._family = () => family;
window._chat = () => chat;
window.forceRender = () => { renderTree(); renderChat(); }; 