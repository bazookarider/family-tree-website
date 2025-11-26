// --- FIREBASE SETUP ---
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
let activePostIdForComments = null;
let allUsersCache = [];

// --- HELPER: TIME AGO ---
function timeAgo(timestamp) {
    if(!timestamp) return 'just now';
    const seconds = Math.floor((new Date() - timestamp) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + "y ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + "mo ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + "d ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + "h ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + "m ago";
    return "just now";
}

// --- MAIN LISTENER ---
document.addEventListener('DOMContentLoaded', () => {
    
    // AUTH LISTENER
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            const snap = await db.ref(`users/${user.uid}`).get();
            currentUser = { uid: user.uid, email: user.email, emailVerified: user.emailVerified, ...(snap.val() || {}) };
            if(!user.emailVerified) {
                document.getElementById("verifyBanner").classList.remove("hidden");
                document.getElementById("resendVerify").onclick = () => user.sendEmailVerification().then(() => alert("Link Sent!"));
            } else {
                document.getElementById("verifyBanner").classList.add("hidden");
            }
            document.getElementById("auth-screen").classList.add("hidden");
            document.getElementById("app-screen").classList.remove("hidden");
            switchTab('home');
        } else {
            currentUser = null;
            document.getElementById("app-screen").classList.add("hidden");
            document.getElementById("auth-screen").classList.remove("hidden");
        }
    });

    // --- AUTH UI ---
    document.getElementById("showSignup").onclick = () => { document.getElementById("loginForm").classList.add("hidden"); document.getElementById("signupForm").classList.remove("hidden"); };
    document.getElementById("showLogin").onclick = () => { document.getElementById("signupForm").classList.add("hidden"); document.getElementById("loginForm").classList.remove("hidden"); document.getElementById("forgotForm").classList.add("hidden");};
    document.getElementById("showForgot").onclick = () => { document.getElementById("loginForm").classList.add("hidden"); document.getElementById("forgotForm").classList.remove("hidden"); };
    document.getElementById("cancelForgot").onclick = document.getElementById("showLogin").onclick;

    document.getElementById("signupBtn").onclick = async () => {
        const name = document.getElementById("signupName").value.trim().replace(/\s/g, "");
        const email = document.getElementById("signupEmail").value;
        const pass = document.getElementById("signupPass").value;
        if (!name || !email || !pass) return alert("Fill all fields");
        try {
            const nameCheck = await db.ref(`usernames/${name}`).get();
            if (nameCheck.exists()) throw new Error("Username taken.");
            const cred = await auth.createUserWithEmailAndPassword(email, pass);
            await cred.user.sendEmailVerification(); 
            await db.ref(`users/${cred.user.uid}`).set({
                username: name, email, bio: "New member", category: "Member", isVerified: false, joined: firebase.database.ServerValue.TIMESTAMP, avatarStyle: "male"
            });
            await db.ref(`usernames/${name}`).set(cred.user.uid);
            alert("Account created! Check email.");
        } catch (e) { alert(e.message); }
    };

    document.getElementById("loginBtn").onclick = async () => {
        try { await auth.signInWithEmailAndPassword(document.getElementById("loginEmail").value, document.getElementById("loginPass").value); }
        catch (e) { alert(e.message); }
    };
    document.getElementById("resetPassBtn").onclick = async () => {
        const email = document.getElementById("forgotEmail").value;
        if(!email) return alert("Enter email");
        try { await auth.sendPasswordResetEmail(email); alert("Link sent!"); } catch(e) { alert(e.message); }
    };
    document.getElementById("logoutBtn").onclick = () => auth.signOut();

    // --- APP BUTTONS ---
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
    document.getElementById("userSearchInput").oninput = (e) => {
        const term = e.target.value.toLowerCase();
        renderUserList(allUsersCache.filter(u => u.username.toLowerCase().includes(term)), "usersList");
    };

    // --- PROFILE EDIT ---
    const editModal = document.getElementById("editProfileModal");
    document.getElementById("openEditProfileBtn").onclick = () => {
        document.getElementById("editBio").value = document.getElementById("myBio").innerText;
        document.getElementById("editCategory").value = document.getElementById("myCategoryDisplay").innerText;
        document.getElementById("editUsername").value = currentUser.username;
        document.getElementById("editAvatarStyle").value = currentUser.avatarStyle || "male";
        editModal.classList.remove("hidden");
    };
    document.getElementById("cancelEditBtn").onclick = () => editModal.classList.add("hidden");
    document.getElementById("saveProfileBtn").onclick = async () => {
        const newBio = document.getElementById("editBio").value;
        const newCat = document.getElementById("editCategory").value;
        const newStyle = document.getElementById("editAvatarStyle").value;
        const newName = document.getElementById("editUsername").value.trim().replace(/\s/g, "");
        const oldName = currentUser.username;
        const updates = { bio: newBio, category: newCat, avatarStyle: newStyle };
        if (newName !== oldName) {
            const check = await db.ref(`usernames/${newName}`).get();
            if(check.exists()) return alert("Username taken!");
            updates.username = newName;
            await db.ref(`usernames/${newName}`).set(currentUser.uid);
            await db.ref(`usernames/${oldName}`).remove();
        }
        await db.ref(`users/${currentUser.uid}`).update(updates);
        editModal.classList.add("hidden"); 
        loadMyProfile();
    };

    // --- COMMENTS ---
    document.getElementById("closeCommentModal").onclick = () => document.getElementById("commentModal").classList.add("hidden");
    document.getElementById("sendCommentBtn").onclick = async () => {
        const txt = document.getElementById("commentInput").value.trim();
        if(!txt || !activePostIdForComments) return;
        await db.ref(`posts/${activePostIdForComments}/comments`).push({
            uid: currentUser.uid, username: currentUser.username, text: txt, time: firebase.database.ServerValue.TIMESTAMP
        });
        document.getElementById("commentInput").value = "";
        loadComments(activePostIdForComments);
    };

    // --- CHAT ---
    document.getElementById("backToAppBtn").onclick = () => { document.getElementById("chat-room").classList.add("hidden"); currentChatId = null; };
    document.getElementById("inputForm").onsubmit = (e) => {
        e.preventDefault(); const txt = document.getElementById("messageInput").value.trim();
        if(txt && currentChatId) db.ref(`private_chats/${currentChatId}`).push({ senderId: currentUser.uid, text: txt, time: firebase.database.ServerValue.TIMESTAMP });
        document.getElementById("messageInput").value = "";
    };
    
    // --- FOLLOW LISTS ---
    document.getElementById("closeFollowList").onclick = () => document.getElementById("followListModal").classList.add("hidden");
    document.getElementById("myFollowersBox").onclick = () => showFollowList('followers', currentUser.uid);
    document.getElementById("myFollowingBox").onclick = () => showFollowList('following', currentUser.uid);
});

// --- FUNCTIONS ---

window.switchTab = (tabName) => {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.getElementById(`tab-${tabName}`).classList.remove('hidden');
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
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

function getAvatar(username, style) {
    // Style can be 'male', 'female', 'identicon'
    if(style === 'male') return `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}&gender=male`;
    if(style === 'female') return `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}&gender=female`;
    return `https://api.dicebear.com/7.x/identicon/svg?seed=${username}`;
}

// FEED
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

// MY POSTS (On Profile)
function loadUserPosts(uid) {
    const list = document.getElementById("myPostsList");
    db.ref('posts').orderByChild('uid').equalTo(uid).limitToLast(20).get().then((snap) => {
        list.innerHTML = "";
        if (!snap.exists()) { list.innerHTML = "<div style='padding:15px;text-align:center;'>No posts.</div>"; return; }
        const posts = []; snap.forEach(c => posts.unshift({key: c.key, ...c.val()}));
        posts.forEach(p => renderPost(p, list));
    });
}

function renderPost(p, container) {
    const div = document.createElement("div"); div.className = "post";
    // For feed, we might not have avatarStyle stored in post, so default to abstract or fetch user. 
    // To save reads, we'll use identicon or just seed.
    const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.username}`; 
    const isLiked = p.likes && p.likes[currentUser.uid];
    const likeCount = p.likes ? Object.keys(p.likes).length : 0;
    const commentCount = p.comments ? Object.keys(p.comments).length : 0;

    div.innerHTML = `
        <img src="${avatar}" class="avatar-large">
        <div class="post-content">
            <div class="post-header">
                <span class="post-author">${p.username} ${p.isVerified ? '<i class="fa-solid fa-circle-check verified-badge"></i>' : ''}</span>
                <span class="post-time">· ${timeAgo(p.time)}</span>
            </div>
            <div class="post-text">${p.text}</div>
             <div class="post-actions">
                <span class="like-btn ${isLiked ? 'liked' : ''}" data-key="${p.key}"><i class="${isLiked ? 'fa-solid' : 'fa-regular'} fa-heart"></i> ${likeCount || ''}</span>
                <span class="comment-btn" data-key="${p.key}"><i class="fa-regular fa-comment"></i> ${commentCount || ''}</span>
            </div>
        </div>`;
    div.querySelector('.like-btn').onclick = async () => {
        const postRef = db.ref(`posts/${p.key}/likes/${currentUser.uid}`);
        if(isLiked) await postRef.remove(); else await postRef.set(true);
        loadFeed(); 
    };
    div.querySelector('.comment-btn').onclick = () => {
        activePostIdForComments = p.key;
        document.getElementById("commentModal").classList.remove("hidden");
        loadComments(p.key);
    };
    container.appendChild(div);
}

// COMMENTS (With Pinning)
function loadComments(postId) {
    const list = document.getElementById("commentsList"); list.innerHTML = "Loading...";
    db.ref(`posts/${postId}`).get().then((postSnap) => {
        const post = postSnap.val();
        const comments = post.comments || {};
        list.innerHTML = "";
        Object.entries(comments).forEach(([key, com]) => {
            const d = document.createElement("div"); 
            d.className = "comment-item " + (com.pinned ? "comment-pinned" : "");
            // Pin Button (Only if I own the post)
            const pinBtn = (post.uid === currentUser.uid) ? `<button class="small-btn" onclick="togglePin('${postId}','${key}', ${com.pinned})">${com.pinned?'Unpin':'Pin'}</button>` : '';
            // Like Button
            const isLiked = com.likes && com.likes[currentUser.uid];
            const likes = com.likes ? Object.keys(com.likes).length : 0;
            const likeBtn = `<span onclick="likeComment('${postId}','${key}', ${isLiked})" style="cursor:pointer; margin-left:10px; color:${isLiked?'red':'gray'}"><i class="fa-heart ${isLiked?'fa-solid':'fa-regular'}"></i> ${likes||''}</span>`;
            
            d.innerHTML = `<div><b>${com.username}</b>: ${com.text} ${likeBtn}</div> ${pinBtn}`;
            list.appendChild(d);
        });
        if(list.innerHTML === "") list.innerHTML = "No comments yet.";
    });
}
window.togglePin = async (pid, cid, status) => { await db.ref(`posts/${pid}/comments/${cid}`).update({pinned: !status}); loadComments(pid); };
window.likeComment = async (pid, cid, status) => { 
    if(status) await db.ref(`posts/${pid}/comments/${cid}/likes/${currentUser.uid}`).remove();
    else await db.ref(`posts/${pid}/comments/${cid}/likes/${currentUser.uid}`).set(true);
    loadComments(pid);
};

// USERS
async function loadAllUsers() {
    const snap = await db.ref("users").get(); allUsersCache = [];
    snap.forEach(c => { if(c.key !== currentUser.uid) allUsersCache.push({uid: c.key, ...c.val()}); });
    renderUserList(allUsersCache, "usersList");
}
function renderUserList(users, targetId) {
    const list = document.getElementById(targetId); list.innerHTML = "";
    users.forEach(u => {
        const div = document.createElement("div"); div.className = "user-item";
        div.innerHTML = `
            <img src="${getAvatar(u.username, u.avatarStyle)}" class="avatar-large">
            <div class="user-info">
                <div class="user-name-list">${u.username} ${u.isVerified ? '<i class="fa-solid fa-circle-check verified-badge"></i>' : ''}</div>
                <div class="user-bio-list">${u.category || 'Member'}</div>
            </div>
            <button class="outline-btn small-btn">View</button>`;
        div.onclick = () => openUserProfile(u.uid);
        list.appendChild(div);
    });
}

// PROFILE & FOLLOW
const userModal = document.getElementById("userProfileModal");
const followBtn = document.getElementById("followBtn");
const msgBtn = document.getElementById("messageBtn");

async function openUserProfile(targetUid) {
    userModal.classList.remove("hidden");
    const snap = await db.ref(`users/${targetUid}`).get(); const u = snap.val();
    document.getElementById("viewName").innerHTML = `${u.username} ${u.isVerified ? '<i class="fa-solid fa-circle-check verified-badge"></i>' : ''}`;
    document.getElementById("viewCategory").textContent = u.category || "Member";
    document.getElementById("viewBio").textContent = u.bio || "No bio.";
    document.getElementById("viewAvatar").src = getAvatar(u.username, u.avatarStyle);
    
    const f1 = await db.ref(`followers/${targetUid}`).get(); document.getElementById("viewFollowers").textContent = f1.exists() ? f1.numChildren() : 0;
    const f2 = await db.ref(`following/${targetUid}`).get(); document.getElementById("viewFollowing").textContent = f2.exists() ? f2.numChildren() : 0;
    
    // Clickable Follow Lists for others? Optional.
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
        if(amIFollowing) { await db.ref(`followers/${targetUid}/${currentUser.uid}`).remove(); await db.ref(`following/${currentUser.uid}/${targetUid}`).remove(); } 
        else { await db.ref(`followers/${targetUid}/${currentUser.uid}`).set(true); await db.ref(`following/${currentUser.uid}/${targetUid}`).set(true); }
        openUserProfile(targetUid);
    };

    // STRICT CHAT
    if (amIFollowing && isHeFollowing) {
        msgBtn.disabled = false;
        msgBtn.textContent = "Chat Now";
        msgBtn.onclick = () => startChat(targetUid, document.getElementById("viewName").innerText);
        document.getElementById("mutualWarning").style.display = "none";
    } else {
        msgBtn.disabled = true;
        msgBtn.textContent = "Locked 🔒";
        document.getElementById("mutualWarning").style.display = "block";
    }
}

async function showFollowList(type, uid) {
    document.getElementById("followListModal").classList.remove("hidden");
    document.getElementById("followListTitle").textContent = type === 'followers' ? "Followers" : "Following";
    const listDiv = document.getElementById("followListContent"); listDiv.innerHTML = "Loading...";
    
    const snap = await db.ref(`${type}/${uid}`).get();
    if(!snap.exists()) { listDiv.innerHTML = "Empty list."; return; }
    
    const uids = Object.keys(snap.val());
    const users = [];
    for(const id of uids) {
        const u = (await db.ref(`users/${id}`).get()).val();
        if(u) users.push({uid: id, ...u});
    }
    renderUserList(users, "followListContent");
}

// MY PROFILE
async function loadMyProfile() {
    const u = (await db.ref(`users/${currentUser.uid}`).get()).val();
    document.getElementById("myName").innerHTML = `${u.username} ${u.isVerified ? '<i class="fa-solid fa-circle-check verified-badge"></i>' : ''}`;
    document.getElementById("myCategoryDisplay").textContent = u.category || "Member";
    document.getElementById("myBio").innerText = u.bio || "No bio yet.";
    document.getElementById("myAvatar").src = getAvatar(u.username, u.avatarStyle);
    
    const f1 = await db.ref(`followers/${currentUser.uid}`).get(); document.getElementById("myFollowersCount").textContent = f1.exists() ? f1.numChildren() : 0;
    const f2 = await db.ref(`following/${currentUser.uid}`).get();