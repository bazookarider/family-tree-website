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
  databaseURL: "https://cyou-db8f0-default-rtdb.firebaseio.com/" // CRITICAL for Realtime DB
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// --- GLOBAL STATE ---
let currentUser = null;
let currentChatId = null;
let activeTab = 'home';

// --- DOM ELEMENTS ---
const authScreen = document.getElementById("auth-screen");
const appScreen = document.getElementById("app-screen");
const loginForm = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");
const authError = document.getElementById("authError");

// --- AUTHENTICATION ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // Fetch User Details from DB
        const snap = await get(ref(db, `users/${user.uid}`));
        if (snap.exists()) {
            currentUser = { uid: user.uid, email: user.email, ...snap.val() };
            startApp();
        } else {
            // Fallback if DB record missing
            currentUser = { uid: user.uid, email: user.email, username: "Unknown" };
            startApp();
        }
    } else {
        currentUser = null;
        appScreen.classList.add("hidden");
        authScreen.classList.remove("hidden");
    }
});

// Login / Signup Toggles
document.getElementById("showSignup").onclick = () => { loginForm.classList.add("hidden"); signupForm.classList.remove("hidden"); authError.textContent = ""; };
document.getElementById("showLogin").onclick = () => { signupForm.classList.add("hidden"); loginForm.classList.remove("hidden"); authError.textContent = ""; };

// Sign Up Logic
document.getElementById("signupBtn").onclick = async () => {
    const name = document.getElementById("signupName").value.trim().replace(/\s/g, ""); // No spaces in username
    const email = document.getElementById("signupEmail").value;
    const pass = document.getElementById("signupPass").value;

    if (!name || !email || !pass) { authError.textContent = "Fill all fields."; return; }

    try {
        // Check if username taken
        const nameCheck = await get(ref(db, `usernames/${name}`));
        if (nameCheck.exists()) throw new Error("Username already taken.");

        const cred = await createUserWithEmailAndPassword(auth, email, pass);
        const uid = cred.user.uid;

        // Save User Data
        const userData = {
            username: name,
            email: email,
            category: "New Member",
            bio: "I am new here!",
            isVerified: false,
            joined: serverTimestamp()
        };

        await set(ref(db, `users/${uid}`), userData);
        await set(ref(db, `usernames/${name}`), uid);
        
        // Auto Logged In by onAuthStateChanged
    } catch (e) {
        authError.textContent = e.message;
    }
};

// Login Logic
document.getElementById("loginBtn").onclick = async () => {
    const email = document.getElementById("loginEmail").value;
    const pass = document.getElementById("loginPass").value;
    try {
        await signInWithEmailAndPassword(auth, email, pass);
    } catch (e) {
        authError.textContent = "Login failed: " + e.message;
    }
};

document.getElementById("logoutBtn").onclick = () => signOut(auth);

// --- APP NAVIGATION ---
function startApp() {
    authScreen.classList.add("hidden");
    appScreen.classList.remove("hidden");
    switchTab('home'); // Default tab
}

window.switchTab = (tabName) => {
    activeTab = tabName;
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.getElementById(`tab-${tabName}`).classList.remove('hidden');
    
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    // Simple mapping: 0=home, 1=discover, 2=chats, 3=profile
    const map = { 'home':0, 'discover':1, 'chats':2, 'profile':3 };
    document.querySelectorAll('.nav-btn')[map[tabName]].classList.add('active');

    if(tabName === 'home') loadFeed();
    if(tabName === 'discover') loadAllUsers();
    if(tabName === 'chats') loadActiveChats();
    if(tabName === 'profile') loadMyProfile();
}

// --- TAB 1: HOME FEED ---
document.getElementById("refreshFeedBtn").onclick = loadFeed;
document.getElementById("postBtn").onclick = createPost;

async function createPost() {
    const text = document.getElementById("newPostText").value.trim();
    if(!text) return;

    const postData = {
        uid: currentUser.uid,
        username: currentUser.username,
        text: text,
        time: serverTimestamp(),
        isVerified: currentUser.isVerified || false
    };

    await push(ref(db, 'posts'), postData);
    document.getElementById("newPostText").value = "";
    loadFeed(); // Refresh
}

function loadFeed() {
    const feedList = document.getElementById("feedList");
    feedList.innerHTML = '<div class="loader">Refreshing...</div>';
    
    // Get last 50 posts
    const q = query(ref(db, 'posts'), limitToLast(50));
    
    get(q).then(async (snap) => {
        if (!snap.exists()) { feedList.innerHTML = "<p>No posts yet.</p>"; return; }
        
        feedList.innerHTML = "";
        const posts = [];
        snap.forEach(c => posts.unshift(c.val())); // Reverse order (newest first)

        // FILTER: Show posts from people I follow OR myself
        // 1. Get my following list
        const followingSnap = await get(ref(db, `following/${currentUser.uid}`));
        const following = followingSnap.exists() ? followingSnap.val() : {};
        
        posts.forEach(p => {
            // Show if it's ME or Someone I Follow
            if (p.uid === currentUser.uid || following[p.uid]) {
                renderPost(p, feedList);
            }
        });
        
        if(feedList.innerHTML === "") feedList.innerHTML = "<p style='text-align:center; padding:20px'>Feed empty. Follow people in Discover!</p>";
    });
}

function renderPost(p, container) {
    const div = document.createElement("div");
    div.className = "post";
    const avatar = `https://api.dicebear.com/7.x/initials/svg?seed=${p.username}&backgroundColor=006677`;
    const verifiedIcon = p.isVerified ? '<i class="fa-solid fa-circle-check verified-badge"></i>' : '';
    
    div.innerHTML = `
        <img src="${avatar}" class="avatar-large" style="width:40px;height:40px;border-width:1px;">
        <div class="post-content">
            <div class="post-header">
                <span class="post-author">${p.username} ${verifiedIcon}</span>
            </div>
            <div class="post-text">${p.text}</div>
            <div class="post-actions">
                <span><i class="fa-regular fa-heart"></i> Like</span>
                <span><i class="fa-regular fa-comment"></i> Comment</span>
            </div>
        </div>
    `;
    container.appendChild(div);
}

// --- TAB 2: DISCOVER (Users) ---
const userSearchInput = document.getElementById("userSearchInput");
let allUsersCache = [];

async function loadAllUsers() {
    const list = document.getElementById("usersList");
    list.innerHTML = "Loading...";
    const snap = await get(ref(db, "users"));
    allUsersCache = [];
    
    snap.forEach(c => {
        if(c.key !== currentUser.uid) {
            allUsersCache.push({uid: c.key, ...c.val()});
        }
    });
    renderUserList(allUsersCache);
}

userSearchInput.oninput = (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = allUsersCache.filter(u => u.username.toLowerCase().includes(term));
    renderUserList(filtered);
};

function renderUserList(users) {
    const list = document.getElementById("usersList");
    list.innerHTML = "";
    users.forEach(u => {
        const div = document.createElement("div");
        div.className = "user-item";
        const avatar = `https://api.dicebear.com/7.x/initials/svg?seed=${u.username}&backgroundColor=006677`;
        const vIcon = u.isVerified ? '<i class="fa-solid fa-circle-check verified-badge"></i>' : '';
        
        div.innerHTML = `
            <img src="${avatar}" style="width:40px;height:40px;border-radius:50%;">
            <div>
                <div style="font-weight:bold;">${u.username} ${vIcon}</div>
                <div style="font-size:0.8rem;color:#888;">${u.category || 'Member'}</div>
            </div>
        `;
        div.onclick = () => openUserProfile(u.uid);
        list.appendChild(div);
    });
}

// --- USER PROFILE POPUP & FOLLOW LOGIC ---
const userProfileModal = document.getElementById("userProfileModal");
const followBtn = document.getElementById("followBtn");
const messageBtn = document.getElementById("messageBtn");
let viewingUserUid = null;

async function openUserProfile(targetUid) {
    viewingUserUid = targetUid;
    userProfileModal.classList.remove("hidden");
    
    // Fetch data
    const snap = await get(ref(db, `users/${targetUid}`));
    const user = snap.val();

    document.getElementById("viewName").innerHTML = `${user.username} ${user.isVerified ? '<i class="fa-solid fa-circle-check verified-badge"></i>' : ''}`;
    document.getElementById("viewCategory").textContent = user.category || "Member";
    document.getElementById("viewBio").textContent = user.bio || "No bio.";
    document.getElementById("viewAvatar").src = `https://api.dicebear.com/7.x/initials/svg?seed=${user.username}&backgroundColor=006677`;

    // Contact Logic
    const contactBox = document.getElementById("viewContactBox");
    contactBox.classList.add("hidden");
    document.getElementById("viewContactBtn").onclick = () => {
        contactBox.textContent = user.contactInfo || "No contact info provided.";
        contactBox.classList.remove("hidden");
    };

    // Stats
    const followersSnap = await get(ref(db, `followers/${targetUid}`));
    const followingSnap = await get(ref(db, `following/${targetUid}`));
    document.getElementById("viewFollowers").textContent = followersSnap.size;
    document.getElementById("viewFollowing").textContent = followingSnap.size;

    // CHECK MUTUAL STATUS
    checkFollowStatus(targetUid);
}

document.getElementById("closeProfileModal").onclick = () => userProfileModal.classList.add("hidden");

async function checkFollowStatus(targetUid) {
    const amIFollowing = (await get(ref(db, `followers/${targetUid}/${currentUser.uid}`))).exists();
    const isHeFollowing = (await get(ref(db, `followers/${currentUser.uid}/${targetUid}`))).exists();

    // 1. Follow Button State
    if(amIFollowing) {
        followBtn.textContent = "Unfollow";
        followBtn.style.backgroundColor = "slategray";
    } else {
        followBtn.textContent = "Follow";
        followBtn.style.backgroundColor = "#006677";
    }
    
    followBtn.onclick = async () => {
        if(amIFollowing) {
            await remove(ref(db, `followers/${targetUid}/${currentUser.uid}`));
            await remove(ref(db, `following/${currentUser.uid}/${targetUid}`));
        } else {
            await set(ref(db, `followers/${targetUid}/${currentUser.uid}`), true);
            await set(ref(db, `following/${currentUser.uid}/${targetUid}`), true);
        }
        checkFollowStatus(targetUid); // Refresh UI
    };

    // 2. Message Button State (MUTUAL ONLY)
    const mutualWarning = document.getElementById("mutualWarning");
    if (amIFollowing && isHeFollowing) {
        messageBtn.disabled = false;
        messageBtn.textContent = "Message 💬";
        messageBtn.onclick = () => startChat(targetUid, document.getElementById("viewName").innerText);
        mutualWarning.style.display = "none";
    } else {
        messageBtn.disabled = true;
        messageBtn.textContent = "Message 🔒";
        mutualWarning.style.display = "block";
    }
}

// --- TAB 3: ACTIVE CHATS & MESSAGING ---
function loadActiveChats() {
    // In a real app, we'd query "chats where member = me". 
    // Simplified: List friends (Mutual follows)
    const list = document.getElementById("activeChatsList");
    list.innerHTML = "Loading contacts...";
    
    get(ref(db, `following/${currentUser.uid}`)).then(async (snap) => {
        if(!snap.exists()) { list.innerHTML = "<p>You aren't following anyone.</p>"; return; }
        
        list.innerHTML = "";
        const followingIds = Object.keys(snap.val());
        
        for(const uid of followingIds) {
            // Check if they follow back
            const backSnap = await get(ref(db, `followers/${currentUser.uid}/${uid}`));
            if(backSnap.exists()) {
                // Mutual! Fetch name
                const uSnap = await get(ref(db, `users/${uid}`));
                const u = uSnap.val();
                
                const div = document.createElement("div");
                div.className = "chat-item";
                div.innerHTML = `<h4>${u.username}</h4><p>Click to chat</p>`;
                div.onclick = () => startChat(uid, u.username);
                list.appendChild(div);
            }
        }
        if(list.innerHTML === "") list.innerHTML = "<p>No mutual followers yet.</p>";
    });
}

// Chat Room Logic
const chatRoom = document.getElementById("chat-room");
const msgDiv = document.getElementById("messages");

function startChat(targetUid, targetName) {
    userProfileModal.classList.add("hidden");
    chatRoom.classList.remove("hidden");
    document.getElementById("chatTitle").textContent = targetName;
    
    // Generate Chat ID (Alphabetical sort so it's same for both)
    currentChatId = [currentUser.uid, targetUid].sort().join("_");
    
    // Load Messages
    msgDiv.innerHTML = "";
    const chatRef = ref(db, `private_chats/${currentChatId}`);
    onValue(chatRef, (snap) => {
        msgDiv.innerHTML = "";
        if(snap.exists()) {
            snap.forEach(c => {
                const m = c.val();
                const d = document.createElement("div");
                d.className = "message " + (m.senderId === currentUser.uid ? "you" : "them");
                d.textContent = m.text;
                msgDiv.appendChild(d);
            });
            msgDiv.scrollTop = msgDiv.scrollHeight;
        }
    });
}

document.getElementById("backToAppBtn").onclick = () => {
    chatRoom.classList.add("hidden");
    currentChatId = null;
};

document.getElementById("inputForm").onsubmit = (e) => {
    e.preventDefault();
    const txt = document.getElementById("messageInput").value.trim();
    if(!txt || !currentChatId) return;
    
    push(ref(db, `private_chats/${currentChatId}`), {
        senderId: currentUser.uid,
        text: txt,
        time: serverTimestamp()
    });
    document.getElementById("messageInput").value = "";
};

// --- TAB 4: MY PROFILE (Editing) ---
const editModal = document.getElementById("editProfileModal");

async function loadMyProfile() {
    const snap = await get(ref(db, `users/${currentUser.uid}`));
    const u = snap.val();
    
    document.getElementById("myName").innerHTML = `${u.username} ${u.isVerified ? '<i class="fa-solid fa-circle-check verified-badge"></i>' : ''}`;
    document.getElementById("myCategory").textContent = u.category || "Member";
    document.getElementById("myBio").textContent = u.bio || "No bio yet.";
    document.getElementById("myContactText").textContent = u.contactInfo || "Not set.";
    document.getElementById("myAvatar").src = `https://api.dicebear.com/7.x/initials/svg?seed=${u.username}&backgroundColor=006677`;

    // Counts
    const f1 = await get(ref(db, `followers/${currentUser.uid}`));
    const f2 = await get(ref(db, `following/${currentUser.uid}`));
    document.getElementById("myFollowersCount").textContent = f1.size;
    document.getElementById("myFollowingCount").textContent = f2.size;

    // Edit logic
    document.getElementById("editProfileBtn").onclick = () => {
        document.getElementById("editCategory").value = u.category || "";
        document.getElementById("editBio").value = u.bio || "";
        document.getElementById("editContact").value = u.contactInfo || "";
        editModal.classList.remove("hidden");
    };
}

document.getElementById("cancelEditBtn").onclick = () => editModal.classList.add("hidden");

document.getElementById("saveProfileBtn").onclick = async () => {
    const updates = {
        category: document.getElementById("editCategory").value,
        bio: document.getElementById("editBio").value,
        contactInfo: document.getElementById("editContact").value
    };
    await update(ref(db, `users/${currentUser.uid}`), updates);
    editModal.classList.add("hidden");
    loadMyProfile(); // Refresh UI
};
