import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getDatabase, ref, push, set, onValue, get, update, remove, serverTimestamp, query, limitToLast, orderByChild } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-database.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

// --- CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyDJFQnwOs-fetKVy0Ow43vktz8xwefZMks",
  authDomain: "cyou-db8f0.firebaseapp.com",
  projectId: "cyou-db8f0",
  storageBucket: "cyou-db8f0.firebasestorage.app",
  messagingSenderId: "873569975141",
  appId: "1:873569975141:web:147eb7b7b4043a38c9bf8c",
  measurementId: "G-T66B50HFJ8",
  databaseURL: "https://cyou-db8f0-default-rtdb.firebaseio.com/"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// --- STATE ---
let currentUser = null;
let currentChatId = null;
let allUsersCache = [];

// --- AUTH & INIT ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const snap = await get(ref(db, `users/${user.uid}`));
        currentUser = { uid: user.uid, email: user.email, ...(snap.val() || {}) };
        document.getElementById("auth-screen").classList.add("hidden");
        document.getElementById("app-screen").classList.remove("hidden");
        switchTab('home');
    } else {
        currentUser = null;
        document.getElementById("app-screen").classList.add("hidden");
        document.getElementById("auth-screen").classList.remove("hidden");
    }
});

// Auth UI Handlers
document.getElementById("showSignup").onclick = () => { document.getElementById("loginForm").classList.add("hidden"); document.getElementById("signupForm").classList.remove("hidden"); };
document.getElementById("showLogin").onclick = () => { document.getElementById("signupForm").classList.add("hidden"); document.getElementById("loginForm").classList.remove("hidden"); };
document.getElementById("logoutBtn").onclick = () => signOut(auth);

document.getElementById("signupBtn").onclick = async () => {
    const name = document.getElementById("signupName").value.trim().replace(/\s/g, "");
    const email = document.getElementById("signupEmail").value;
    const pass = document.getElementById("signupPass").value;
    if (!name || !email || !pass) return alert("Fill all fields");
    try {
        const nameCheck = await get(ref(db, `usernames/${name}`));
        if (nameCheck.exists()) throw new Error("Username taken.");
        const cred = await createUserWithEmailAndPassword(auth, email, pass);
        await set(ref(db, `users/${cred.user.uid}`), {
            username: name, email, bio: "New member", isVerified: false, joined: serverTimestamp()
        });
        await set(ref(db, `usernames/${name}`), cred.user.uid);
    } catch (e) { alert(e.message); }
};

document.getElementById("loginBtn").onclick = async () => {
    try { await signInWithEmailAndPassword(auth, document.getElementById("loginEmail").value, document.getElementById("loginPass").value); }
    catch (e) { alert("Login failed: " + e.message); }
};

// --- NAVIGATION ---
window.switchTab = (tabName) => {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.getElementById(`tab-${tabName}`).classList.remove('hidden');
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    const map = { 'home':0, 'discover':1, 'chats':2, 'profile':3 };
    document.querySelectorAll('.nav-btn')[map[tabName]].classList.add('active');
    // Icons change to solid when active (optional polish)
    document.querySelectorAll('.nav-btn i').forEach(i => i.classList.replace('fa-solid', 'fa-regular'));
    document.querySelector(`.nav-btn.active i`).classList.replace('fa-regular', 'fa-solid');


    if(tabName === 'home') loadFeed();
    if(tabName === 'discover') loadAllUsers();
    if(tabName === 'chats') loadActiveChats();
    if(tabName === 'profile') loadMyProfile();
}

// --- HOME FEED ---
document.getElementById("refreshFeedBtn").onclick = loadFeed;
document.getElementById("postBtn").onclick = async () => {
    const text = document.getElementById("newPostText").value.trim();
    if(!text) return;
    await push(ref(db, 'posts'), {
        uid: currentUser.uid, username: currentUser.username,
        text, time: serverTimestamp(), isVerified: currentUser.isVerified || false
    });
    document.getElementById("newPostText").value = "";
    loadFeed();
};

function loadFeed() {
    const list = document.getElementById("feedList");
    get(query(ref(db, 'posts'), limitToLast(50))).then(async (snap) => {
        if (!snap.exists()) { list.innerHTML = "<div style='padding:20px;text-align:center;color:#999'>No posts yet.</div>"; return; }
        list.innerHTML = "";
        const posts = []; snap.forEach(c => posts.unshift(c.val()));
        const following = (await get(ref(db, `following/${currentUser.uid}`))).val() || {};
        posts.forEach(p => {
            if (p.uid === currentUser.uid || following[p.uid]) renderPost(p, list);
        });
    });
}

function renderPost(p, container) {
    const div = document.createElement("div"); div.className = "post";
    const avatar = `https://api.dicebear.com/7.x/initials/svg?seed=${p.username}&backgroundColor=006677`;
    const timeStr = p.time ? new Date(p.time).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : 'just now';
    div.innerHTML = `
        <img src="${avatar}" class="avatar-large">
        <div class="post-content">
            <div class="post-header">
                <span class="post-author">${p.username} ${p.isVerified ? '<i class="fa-solid fa-circle-check verified-badge"></i>' : ''}</span>
                <span class="post-time">· ${timeStr}</span>
            </div>
            <div class="post-text">${p.text}</div>
             <div class="post-actions">
                <span><i class="fa-regular fa-heart"></i></span>
                <span><i class="fa-regular fa-comment"></i></span>
                <span><i class="fa-solid fa-share-nodes"></i></span>
            </div>
        </div>`;
    container.appendChild(div);
}

// --- DISCOVER USERS ---
async function loadAllUsers() {
    const snap = await get(ref(db, "users")); allUsersCache = [];
    snap.forEach(c => { if(c.key !== currentUser.uid) allUsersCache.push({uid: c.key, ...c.val()}); });
    renderUserList(allUsersCache);
}

document.getElementById("userSearchInput").oninput = (e) => {
    const term = e.target.value.toLowerCase();
    renderUserList(allUsersCache.filter(u => u.username.toLowerCase().includes(term)));
};

function renderUserList(users) {
    const list = document.getElementById("usersList"); list.innerHTML = "";
    users.forEach(u => {
        const div = document.createElement("div"); div.className = "user-item";
        div.innerHTML = `
            <img src="https://api.dicebear.com/7.x/initials/svg?seed=${u.username}&backgroundColor=006677" class="avatar-large">
            <div class="user-info">
                <div class="user-name-list">${u.username} ${u.isVerified ? '<i class="fa-solid fa-circle-check verified-badge"></i>' : ''}</div>
                <div class="user-bio-list">${u.bio || 'Member'}</div>
            </div>
            <button class="outline-btn small-btn">View</button>
        `;
        div.onclick = () => openUserProfile(u.uid);
        list.appendChild(div);
    });
}

// --- USER PROFILE MODAL ---
const userModal = document.getElementById("userProfileModal");
const followBtn = document.getElementById("followBtn");
const msgBtn = document.getElementById("messageBtn");
let viewingUid = null;

async function openUserProfile(targetUid) {
    viewingUid = targetUid; userModal.classList.remove("hidden");
    const snap = await get(ref(db, `users/${targetUid}`)); const u = snap.val();
    document.getElementById("viewName").innerHTML = `${u.username} ${u.isVerified ? '<i class="fa-solid fa-circle-check verified-badge"></i>' : ''}`;
    document.getElementById("viewBio").textContent = u.bio || "No bio.";
    document.getElementById("viewAvatar").src = `https://api.dicebear.com/7.x/initials/svg?seed=${u.username}&backgroundColor=006677`;
    const f1 = await get(ref(db, `followers/${targetUid}`)); document.getElementById("viewFollowers").textContent = f1.size;
    const f2 = await get(ref(db, `following/${targetUid}`)); document.getElementById("viewFollowing").textContent = f2.size;
    checkFollowStatus(targetUid);
}

document.getElementById("closeProfileModal").onclick = () => userModal.classList.add("hidden");

async function checkFollowStatus(targetUid) {
    const amIFollowing = (await get(ref(db, `followers/${targetUid}/${currentUser.uid}`))).exists();
    const isHeFollowing = (await get(ref(db, `followers/${currentUser.uid}/${targetUid}`))).exists();
    
    followBtn.textContent = amIFollowing ? "Following" : "Follow";
    followBtn.classList.toggle("primary-btn", !amIFollowing);
    followBtn.classList.toggle("outline-btn", amIFollowing);

    followBtn.onclick = async () => {
        if(amIFollowing) { await remove(ref(db, `followers/${targetUid}/${currentUser.uid}`)); await remove(ref(db, `following/${currentUser.uid}/${targetUid}`)); }
        else { await set(ref(db, `followers/${targetUid}/${currentUser.uid}`), true); await set(ref(db, `following/${currentUser.uid}/${targetUid}`), true); }
        openUserProfile(targetUid); // Refresh
    };

    msgBtn.disabled = !(amIFollowing && isHeFollowing);
    document.getElementById("mutualWarning").style.display = (amIFollowing && isHeFollowing) ? "none" : "block";
    if(!msgBtn.disabled) msgBtn.onclick = () => startChat(targetUid, document.getElementById("viewName").innerText);
}

// --- CHATS ---
function loadActiveChats() {
    const list = document.getElementById("activeChatsList"); list.innerHTML = "<div class='loader'>Loading...</div>";
    get(ref(db, `following/${currentUser.uid}`)).then(async (snap) => {
        if(!snap.exists()) { list.innerHTML = "<div style='padding:20px;text-align:center;color:#999'>Follow people to start chatting.</div>"; return; }
        list.innerHTML = "";
        for(const uid of Object.keys(snap.val())) {
            if((await get(ref(db, `followers/${currentUser.uid}/${uid}`))).exists()) {
                const u = (await get(ref(db, `users/${uid}`))).val();
                const div = document.createElement("div"); div.className = "chat-item";
                div.innerHTML = `
                 <img src="https://api.dicebear.com/7.x/initials/svg?seed=${u.username}&backgroundColor=006677" class="avatar-large">
                 <div class="user-info"><div class="user-name-list">${u.username}</div><div class="user-bio-list">Tap to chat</div></div>`;
                div.onclick = () => startChat(uid, u.username);
                list.appendChild(div);
            }
        }
    });
}

const chatRoom = document.getElementById("chat-room");
const msgDiv = document.getElementById("messages");
function startChat(uid, name) {
    userModal.classList.add("hidden"); chatRoom.classList.remove("hidden");
    document.getElementById("chatTitle").textContent = name;
    currentChatId = [currentUser.uid, uid].sort().join("_");
    onValue(ref(db, `private_chats/${currentChatId}`), (snap) => {
        msgDiv.innerHTML = "";
        if(snap.exists()) snap.forEach(c => {
            const m = c.val(); const d = document.createElement("div");
            d.className = "message " + (m.senderId === currentUser.uid ? "you" : "them");
            d.textContent = m.text; msgDiv.appendChild(d);
        });
        msgDiv.scrollTop = msgDiv.scrollHeight;
    });
}
document.getElementById("backToAppBtn").onclick = () => { chatRoom.classList.add("hidden"); currentChatId = null; };
document.getElementById("inputForm").onsubmit = (e) => {
    e.preventDefault(); const txt = document.getElementById("messageInput").value.trim();
    if(txt && currentChatId) push(ref(db, `private_chats/${currentChatId}`), { senderId: currentUser.uid, text: txt, time: serverTimestamp() });
    document.getElementById("messageInput").value = "";
};

// --- MY PROFILE ---
const editModal = document.getElementById("editProfileModal");
async function loadMyProfile() {
    const u = (await get(ref(db, `users/${currentUser.uid}`))).val();
    document.getElementById("myName").innerHTML = `${u.username} ${u.isVerified ? '<i class="fa-solid fa-circle-check verified-badge"></i>' : ''}`;
    document.getElementById("myBio").textContent = u.bio || "No bio yet.";
    document.getElementById("myAvatar").src = `https://api.dicebear.com/7.x/initials/svg?seed=${u.username}&backgroundColor=006677`;
    document.getElementById("myFollowersCount").textContent = (await get(ref(db, `followers/${currentUser.uid}`))).size;
    document.getElementById("myFollowingCount").textContent = (await get(ref(db, `following/${currentUser.uid}`))).size;
}
document.getElementById("editProfileBtn").onclick = () => {
    document.getElementById("editBio").value = document.getElementById("myBio").textContent;
    editModal.classList.remove("hidden");
}
document.getElementById("cancelEditBtn").onclick = () => editModal.classList.add("hidden");
document.getElementById("saveProfileBtn").onclick = async () => {
    await update(ref(db, `users/${currentUser.uid}`), { bio: document.getElementById("editBio").value });
    editModal.classList.add("hidden"); loadMyProfile();
};
