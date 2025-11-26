 // --- FIREBASE SETUP (Compat Mode) ---
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

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();

// --- STATE ---
let currentUser = null;
let currentChatId = null;
let allUsersCache = [];

// --- MAIN LISTENER (Waits for HTML to load) ---
document.addEventListener('DOMContentLoaded', () => {
    
    // AUTH LISTENER
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            const snap = await db.ref(`users/${user.uid}`).get();
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

    // --- BUTTONS: AUTH ---
    document.getElementById("showSignup").onclick = () => { document.getElementById("loginForm").classList.add("hidden"); document.getElementById("signupForm").classList.remove("hidden"); };
    document.getElementById("showLogin").onclick = () => { document.getElementById("signupForm").classList.add("hidden"); document.getElementById("loginForm").classList.remove("hidden"); };
    
    document.getElementById("signupBtn").onclick = async () => {
        const name = document.getElementById("signupName").value.trim().replace(/\s/g, "");
        const email = document.getElementById("signupEmail").value;
        const pass = document.getElementById("signupPass").value;
        if (!name || !email || !pass) return alert("Fill all fields");
        try {
            const nameCheck = await db.ref(`usernames/${name}`).get();
            if (nameCheck.exists()) throw new Error("Username taken.");
            const cred = await auth.createUserWithEmailAndPassword(email, pass);
            await db.ref(`users/${cred.user.uid}`).set({
                username: name, email, bio: "New member", isVerified: false, joined: firebase.database.ServerValue.TIMESTAMP
            });
            await db.ref(`usernames/${name}`).set(cred.user.uid);
        } catch (e) { alert(e.message); }
    };

    document.getElementById("loginBtn").onclick = async () => {
        try { await auth.signInWithEmailAndPassword(document.getElementById("loginEmail").value, document.getElementById("loginPass").value); }
        catch (e) { alert("Login failed: " + e.message); }
    };

    document.getElementById("logoutBtn").onclick = () => auth.signOut();

    // --- BUTTONS: FEED ---
    document.getElementById("refreshFeedBtn").onclick = loadFeed;
    document.getElementById("postBtn").onclick = async () => {
        const text = document.getElementById("newPostText").value.trim();
        if(!text) return;
        await db.ref('posts').push({
            uid: currentUser.uid, username: currentUser.username,
            text, time: firebase.database.ServerValue.TIMESTAMP, isVerified: currentUser.isVerified || false
        });
        document.getElementById("newPostText").value = "";
        loadFeed();
    };

    // --- BUTTONS: SEARCH ---
    document.getElementById("userSearchInput").oninput = (e) => {
        const term = e.target.value.toLowerCase();
        renderUserList(allUsersCache.filter(u => u.username.toLowerCase().includes(term)));
    };

    // --- BUTTONS: PROFILE ---
    const editModal = document.getElementById("editProfileModal");
    document.getElementById("openEditProfileBtn").onclick = () => {
        document.getElementById("editBio").value = document.getElementById("myBio").innerText;
        editModal.classList.remove("hidden");
    };
    document.getElementById("cancelEditBtn").onclick = () => editModal.classList.add("hidden");
    document.getElementById("saveProfileBtn").onclick = async () => {
        await db.ref(`users/${currentUser.uid}`).update({ bio: document.getElementById("editBio").value });
        editModal.classList.add("hidden"); loadMyProfile();
    };

    // --- CHAT UI ---
    document.getElementById("backToAppBtn").onclick = () => { document.getElementById("chat-room").classList.add("hidden"); currentChatId = null; };
    document.getElementById("inputForm").onsubmit = (e) => {
        e.preventDefault(); const txt = document.getElementById("messageInput").value.trim();
        if(txt && currentChatId) db.ref(`private_chats/${currentChatId}`).push({ senderId: currentUser.uid, text: txt, time: firebase.database.ServerValue.TIMESTAMP });
        document.getElementById("messageInput").value = "";
    };
});

// --- NAVIGATION ---
window.switchTab = (tabName) => {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.getElementById(`tab-${tabName}`).classList.remove('hidden');
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    
    // Manual mapping for active icon
    const btns = document.querySelectorAll('.nav-btn');
    if(tabName=='home') btns[0].classList.add('active');
    if(tabName=='discover') btns[1].classList.add('active');
    if(tabName=='chats') btns[2].classList.add('active');
    if(tabName=='profile') btns[3].classList.add('active');

    if(tabName === 'home') loadFeed();
    if(tabName === 'discover') loadAllUsers();
    if(tabName === 'chats') loadActiveChats();
    if(tabName === 'profile') loadMyProfile();
}

// --- FEED LOGIC (With Likes) ---
function loadFeed() {
    const list = document.getElementById("feedList");
    db.ref('posts').limitToLast(50).get().then(async (snap) => {
        if (!snap.exists()) { list.innerHTML = "<div style='padding:20px;text-align:center;color:#999'>No posts yet.</div>"; return; }
        list.innerHTML = "";
        const posts = []; snap.forEach(c => posts.unshift({key: c.key, ...c.val()}));
        const following = (await db.ref(`following/${currentUser.uid}`).get()).val() || {};
        
        posts.forEach(p => {
            if (p.uid === currentUser.uid || following[p.uid]) renderPost(p, list);
        });
    });
}

function renderPost(p, container) {
    const div = document.createElement("div"); div.className = "post";
    const avatar = `https://api.dicebear.com/7.x/initials/svg?seed=${p.username}&backgroundColor=006677`;
    const timeStr = p.time ? new Date(p.time).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : 'now';
    
    // Check if I liked it
    const isLiked = p.likes && p.likes[currentUser.uid];
    const likeCount = p.likes ? Object.keys(p.likes).length : 0;

    div.innerHTML = `
        <img src="${avatar}" class="avatar-large">
        <div class="post-content">
            <div class="post-header">
                <span class="post-author">${p.username} ${p.isVerified ? '<i class="fa-solid fa-circle-check verified-badge"></i>' : ''}</span>
                <span class="post-time">· ${timeStr}</span>
            </div>
            <div class="post-text">${p.text}</div>
             <div class="post-actions">
                <span class="like-btn ${isLiked ? 'liked' : ''}" data-key="${p.key}">
                    <i class="${isLiked ? 'fa-solid' : 'fa-regular'} fa-heart"></i> ${likeCount || ''}
                </span>
                <span onclick="alert('Comments coming soon!')"><i class="fa-regular fa-comment"></i></span>
            </div>
        </div>`;
    
    // Add Like Handler
    div.querySelector('.like-btn').onclick = async function() {
        const postRef = db.ref(`posts/${p.key}/likes/${currentUser.uid}`);
        if(isLiked) await postRef.remove();
        else await postRef.set(true);
        loadFeed(); // Refresh to show new count
    };

    container.appendChild(div);
}

// --- USER LOGIC ---
async function loadAllUsers() {
    const snap = await db.ref("users").get(); allUsersCache = [];
    snap.forEach(c => { if(c.key !== currentUser.uid) allUsersCache.push({uid: c.key, ...c.val()}); });
    renderUserList(allUsersCache);
}

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

// --- PROFILE MODAL & FOLLOW ---
const userModal = document.getElementById("userProfileModal");
const followBtn = document.getElementById("followBtn");
const msgBtn = document.getElementById("messageBtn");

async function openUserProfile(targetUid) {
    userModal.classList.remove("hidden");
    const snap = await db.ref(`users/${targetUid}`).get(); const u = snap.val();
    document.getElementById("viewName").innerHTML = `${u.username} ${u.isVerified ? '<i class="fa-solid fa-circle-check verified-badge"></i>' : ''}`;
    document.getElementById("viewBio").textContent = u.bio || "No bio.";
    document.getElementById("viewAvatar").src = `https://api.dicebear.com/7.x/initials/svg?seed=${u.username}&backgroundColor=006677`;
    
    // Stats
    const f1 = await db.ref(`followers/${targetUid}`).get(); document.getElementById("viewFollowers").textContent = f1.exists() ? f1.numChildren() : 0;
    const f2 = await db.ref(`following/${targetUid}`).get(); document.getElementById("viewFollowing").textContent = f2.exists() ? f2.numChildren() : 0;
    
    checkFollowStatus(targetUid);
    document.getElementById("closeProfileModal").onclick = () => userModal.classList.add("hidden");
}

async function checkFollowStatus(targetUid) {
    const amIFollowing = (await db.ref(`followers/${targetUid}/${currentUser.uid}`).get()).exists();
    const isHeFollowing = (await db.ref(`followers/${currentUser.uid}/${targetUid}`).get()).exists();
    
    followBtn.textContent = amIFollowing ? "Following" : "Follow";
    followBtn.classList.toggle("primary-btn", !amIFollowing);
    followBtn.classList.toggle("outline-btn", amIFollowing);

    followBtn.onclick = async () => {
        if(amIFollowing) { 
            await db.ref(`followers/${targetUid}/${currentUser.uid}`).remove(); 
            await db.ref(`following/${currentUser.uid}/${targetUid}`).remove(); 
        } else { 
            await db.ref(`followers/${targetUid}/${currentUser.uid}`).set(true); 
            await db.ref(`following/${currentUser.uid}/${targetUid}`).set(true); 
        }
        openUserProfile(targetUid); // Refresh UI
    };

    msgBtn.disabled = !(amIFollowing && isHeFollowing);
    document.getElementById("mutualWarning").style.display = (amIFollowing && isHeFollowing) ? "none" : "block";
    msgBtn.onclick = () => startChat(targetUid, document.getElementById("viewName").innerText);
}

// --- ACTIVE CHATS ---
function loadActiveChats() {
    const list = document.getElementById("activeChatsList"); list.innerHTML = "<div class='loader'>Loading...</div>";
    db.ref(`following/${currentUser.uid}`).get().then(async (snap) => {
        if(!snap.exists()) { list.innerHTML = "<div style='padding:20px;text-align:center;color:#999'>Follow people to start chatting.</div>"; return; }
        list.innerHTML = "";
        const uids = Object.keys(snap.val());
        for(const uid of uids) {
            if((await db.ref(`followers/${currentUser.uid}/${uid}`).get()).exists()) {
                const u = (await db.ref(`users/${uid}`).get()).val();
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
    db.ref(`private_chats/${currentChatId}`).on('value', (snap) => {
        msgDiv.innerHTML = "";
        if(snap.exists()) snap.forEach(c => {
            const m = c.val(); const d = document.createElement("div");
            d.className = "message " + (m.senderId === currentUser.uid ? "you" : "them");
            d.textContent = m.text; msgDiv.appendChild(d);
        });
        msgDiv.scrollTop = msgDiv.scrollHeight;
    });
}

// --- MY PROFILE LOAD ---
async function loadMyProfile() {
    const u = (await db.ref(`users/${currentUser.uid}`).get()).val();
    document.getElementById("myName").innerHTML = `${u.username} ${u.isVerified ? '<i class="fa-solid fa-circle-check verified-badge"></i>' : ''}`;
    document.getElementById("myBio").innerText = u.bio || "No bio yet.";
    document.getElementById("myAvatar").src = `https://api.dicebear.com/7.x/initials/svg?seed=${u.username}&backgroundColor=006677`;
    
    const f1 = await db.ref(`followers/${currentUser.uid}`).get(); document.getElementById("myFollowersCount").textContent = f1.exists() ? f1.numChildren() : 0;
    const f2 = await db.ref(`following/${currentUser.uid}`).get(); document.getElementById("myFollowingCount").textContent = f2.exists() ? f2.numChildren() : 0;
}
