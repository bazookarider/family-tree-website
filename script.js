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

let db, auth, currentUser = null;
let currentChatId = null;
let activePostIdForComments = null;
let allUsersCache = [];

// --- STARTUP ---
window.onload = function() {
    try {
        if(typeof firebase === 'undefined') throw new Error("Blocked");
        firebase.initializeApp(firebaseConfig);
        db = firebase.database();
        auth = firebase.auth();
        document.getElementById('system-status').innerText = "SYSTEM ONLINE";
        document.getElementById('system-status').style.background = "green";
        setTimeout(() => document.getElementById('system-status').style.display = 'none', 2000);
        
        // Initialize Listeners inside onload to ensure HTML exists
        initApp();
    } catch (e) {
        document.getElementById('system-status').innerText = "ERROR: " + e.message;
    }
};

function initApp() {
    // AUTH STATE
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            const snap = await db.ref(`users/${user.uid}`).get();
            currentUser = { uid: user.uid, email: user.email, emailVerified: user.emailVerified, ...(snap.val() || {}) };
            document.getElementById("auth-screen").classList.add("hidden");
            document.getElementById("app-screen").classList.remove("hidden");
            if(!user.emailVerified) document.getElementById("verifyBanner").classList.remove("hidden");
            switchTab('home');
        } else {
            document.getElementById("app-screen").classList.add("hidden");
            document.getElementById("auth-screen").classList.remove("hidden");
        }
    });

    // BUTTON BINDINGS
    document.getElementById("loginBtn").onclick = async function() {
        this.innerText = "...";
        try { await auth.signInWithEmailAndPassword(document.getElementById("loginEmail").value, document.getElementById("loginPass").value); }
        catch (e) { alert(e.message); this.innerText = "Log In"; }
    };

    document.getElementById("signupBtn").onclick = async function() {
        this.innerText = "...";
        const name = document.getElementById("signupName").value.trim().replace(/\s/g, "");
        const email = document.getElementById("signupEmail").value;
        const pass = document.getElementById("signupPass").value;
        try {
            const check = await db.ref(`usernames/${name}`).get();
            if (check.exists()) throw new Error("Username taken");
            const cred = await auth.createUserWithEmailAndPassword(email, pass);
            await cred.user.sendEmailVerification();
            await db.ref(`users/${cred.user.uid}`).set({ username: name, email: email, bio: "Hi!", avatarStyle: "male", category: "Member", joined: Date.now() });
            await db.ref(`usernames/${name}`).set(cred.user.uid);
            alert("Account Created! Verify Email.");
        } catch (e) { alert(e.message); }
        this.innerText = "Sign Up";
    };

    document.getElementById("resetPassBtn").onclick = () => {
        const email = document.getElementById("forgotEmail").value;
        if(email) auth.sendPasswordResetEmail(email).then(()=>alert("Link Sent"));
    };

    // UI SWITCHING
    document.getElementById("showSignup").onclick = () => { document.getElementById("loginForm").classList.add("hidden"); document.getElementById("signupForm").classList.remove("hidden"); };
    document.getElementById("showLogin").onclick = () => { document.getElementById("signupForm").classList.add("hidden"); document.getElementById("loginForm").classList.remove("hidden"); document.getElementById("forgotForm").classList.add("hidden"); };
    document.getElementById("showForgot").onclick = () => { document.getElementById("loginForm").classList.add("hidden"); document.getElementById("forgotForm").classList.remove("hidden"); };
    document.getElementById("cancelForgot").onclick = document.getElementById("showLogin").onclick;
    document.getElementById("logoutBtn").onclick = () => auth.signOut();

    // FEED
    document.getElementById("postBtn").onclick = async () => {
        const txt = document.getElementById("newPostText").value.trim();
        if(!txt) return;
        await db.ref('posts').push({ uid: currentUser.uid, username: currentUser.username, text: txt, time: firebase.database.ServerValue.TIMESTAMP });
        document.getElementById("newPostText").value = "";
        loadFeed();
    };
    document.getElementById("refreshFeedBtn").onclick = loadFeed;

    // SEARCH
    document.getElementById("userSearchInput").oninput = (e) => {
        renderUserList(allUsersCache.filter(u => u.username.toLowerCase().includes(e.target.value.toLowerCase())), "usersList");
    };

    // PROFILE MODALS
    document.getElementById("openEditProfileBtn").onclick = () => {
        document.getElementById("editProfileModal").classList.remove("hidden");
        document.getElementById("editUsername").value = currentUser.username;
        document.getElementById("editBio").value = currentUser.bio || "";
        document.getElementById("editCategory").value = currentUser.category || "";
    };
    document.getElementById("cancelEditBtn").onclick = () => document.getElementById("editProfileModal").classList.add("hidden");
    document.getElementById("saveProfileBtn").onclick = async () => {
        const name = document.getElementById("editUsername").value.trim();
        const bio = document.getElementById("editBio").value;
        const cat = document.getElementById("editCategory").value;
        const style = document.getElementById("editAvatarStyle").value;
        if(name !== currentUser.username) {
             const check = await db.ref(`usernames/${name}`).get();
             if (check.exists()) return alert("Username taken");
             await db.ref(`usernames/${name}`).set(currentUser.uid);
             await db.ref(`usernames/${currentUser.username}`).remove();
        }
        await db.ref(`users/${currentUser.uid}`).update({username:name, bio:bio, category:cat, avatarStyle:style});
        document.getElementById("editProfileModal").classList.add("hidden");
        loadProfile();
    };

    // CHAT & COMMENTS
    document.getElementById("backToAppBtn").onclick = () => { document.getElementById("chat-room").classList.add("hidden"); currentChatId = null; };
    document.getElementById("inputForm").onsubmit = (e) => {
        e.preventDefault(); const t = document.getElementById("messageInput").value.trim();
        if(t && currentChatId) {
            db.ref(`private_chats/${currentChatId}`).push({senderId:currentUser.uid, text:t});
            document.getElementById("messageInput").value="";
        }
    };
    document.getElementById("closeCommentModal").onclick = () => document.getElementById("commentModal").classList.add("hidden");
    document.getElementById("sendCommentBtn").onclick = async () => {
        const t = document.getElementById("commentInput").value.trim();
        if(t && activePostIdForComments) {
            await db.ref(`posts/${activePostIdForComments}/comments`).push({uid:currentUser.uid, username:currentUser.username, text:t});
            document.getElementById("commentInput").value="";
            loadComments(activePostIdForComments);
        }
    };
    document.getElementById("closeProfileModal").onclick = () => document.getElementById("userProfileModal").classList.add("hidden");
    document.getElementById("closeFollowList").onclick = () => document.getElementById("followListModal").classList.add("hidden");
    document.getElementById("myFollowersBox").onclick = () => showFollowList('followers', currentUser.uid);
    document.getElementById("myFollowingBox").onclick = () => showFollowList('following', currentUser.uid);
}

// --- GLOBAL FUNCTIONS ---
function switchTab(tab) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.getElementById(`tab-${tab}`).classList.remove('hidden');
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
    const map = {'home':0, 'discover':1, 'chats':2, 'profile':3};
    document.querySelectorAll('.nav-btn')[map[tab]].classList.add('active');
    if(tab=='home') loadFeed();
    if(tab=='discover') loadAllUsers();
    if(tab=='chats') loadChats();
    if(tab=='profile') loadProfile();
}

function getAvatar(u, style) {
    if(style === 'male') return `https://api.dicebear.com/7.x/avataaars/svg?seed=${u}&gender=male`;
    if(style === 'female') return `https://api.dicebear.com/7.x/avataaars/svg?seed=${u}&gender=female`;
    return `https://api.dicebear.com/7.x/identicon/svg?seed=${u}`;
}

function timeAgo(ts) {
    if(!ts) return 'now';
    const s = Math.floor((new Date()-ts)/1000);
    if(s<60) return 'just now';
    if(s<3600) return Math.floor(s/60)+'m ago';
    return Math.floor(s/86400)+'d ago';
}

// --- DATA LOADERS ---
function loadFeed() {
    const list = document.getElementById("feedList");
    db.ref('posts').limitToLast(50).get().then(async snap => {
        list.innerHTML = "";
        if(!snap.exists()) return;
        const posts = []; snap.forEach(c => posts.unshift({key:c.key, ...c.val()}));
        const following = (await db.ref(`following/${currentUser.uid}`).get()).val() || {};
        posts.forEach(p => {
            if(p.uid === currentUser.uid || following[p.uid]) {
                const d = document.createElement("div"); d.className = "post";
                const isLiked = p.likes && p.likes[currentUser.uid];
                const likes = p.likes ? Object.keys(p.likes).length : 0;
                d.innerHTML = `<img src="${getAvatar(p.username, 'male')}" class="avatar-large"><div style="flex:1">
                    <div class="post-header">${p.username} <span style="font-weight:normal;color:#888">· ${timeAgo(p.time)}</span></div>
                    <div>${p.text}</div>
                    <div class="post-actions">
                        <span class="like-btn ${isLiked?'liked':''}"><i class="fa-heart ${isLiked?'fa-solid':'fa-regular'}"></i> ${likes||''}</span>
                        <span class="comment-btn"><i class="fa-regular fa-comment"></i></span>
                    </div>
                </div>`;
                d.querySelector('.like-btn').onclick = async () => {
                    const r = db.ref(`posts/${p.key}/likes/${currentUser.uid}`);
                    if(isLiked) await r.remove(); else await r.set(true);
                    loadFeed();
                };
                d.querySelector('.comment-btn').onclick = () => {
                    activePostIdForComments = p.key;
                    document.getElementById("commentModal").classList.remove("hidden");
                    loadComments(p.key);
                };
                list.appendChild(d);
            }
        });
    });
}

function loadComments(pid) {
    const list = document.getElementById("commentsList"); list.innerHTML="Loading...";
    db.ref(`posts/${pid}/comments`).get().then(snap => {
        list.innerHTML = "";
        if(!snap.exists()) { list.innerHTML="No comments."; return; }
        snap.forEach(c => {
            const d = document.createElement("div"); d.className="comment-item";
            d.innerHTML=`<b>${c.val().username}:</b> ${c.val().text}`;
            list.appendChild(d);
        });
    });
}

async function loadAllUsers() {
    const snap = await db.ref("users").get(); allUsersCache=[];
    snap.forEach(c => { if(c.key !== currentUser.uid) allUsersCache.push({uid: c.key, ...c.val()}); });
    const list = document.getElementById("usersList"); list.innerHTML="";
    allUsersCache.forEach(u => {
        const d = document.createElement("div"); d.className = "user-item";
        d.innerHTML = `<img src="${getAvatar(u.username, u.avatarStyle)}" class="avatar-large"><div><b>${u.username}</b><br>${u.bio||''}</div><button class="outline-btn" style="margin-left:auto; width:auto;">View</button>`;
        d.onclick = () => openUser(u.uid);
        list.appendChild(d);
    });
}

async function openUser(uid) {
    document.getElementById("userProfileModal").classList.remove("hidden");
    const snap = await db.ref(`users/${uid}`).get(); const u = snap.val();
    document.getElementById("viewName").innerText = u.username;
    document.getElementById("viewBio").innerText = u.bio || "";
    document.getElementById("viewAvatar").src = getAvatar(u.username, u.avatarStyle);
    
    const fBtn = document.getElementById("followBtn");
    const mBtn = document.getElementById("messageBtn");
    
    // Stats
    const f1 = await db.ref(`followers/${uid}`).get(); document.getElementById("viewFollowers").innerText=f1.exists()?f1.numChildren():0;
    const f2 = await db.ref(`following/${uid}`).get(); document.getElementById("viewFollowing").innerText=f2.exists()?f2.numChildren():0;

    const amI = (await db.ref(`followers/${uid}/${currentUser.uid}`).get()).exists();
    const isHe = (await db.ref(`followers/${currentUser.uid}/${uid}`).get()).exists();
    
    fBtn.innerText = amI ? "Unfollow" : "Follow";
    fBtn.onclick = async () => {
        if(amI) { await db.ref(`followers/${uid}/${currentUser.uid}`).remove(); await db.ref(`following/${currentUser.uid}/${uid}`).remove(); }
        else { await db.ref(`followers/${uid}/${currentUser.uid}`).set(true); await db.ref(`following/${currentUser.uid}/${uid}`).set(true); }
        openUser(uid);
    };
    
    if(amI && isHe) { mBtn.disabled=false; mBtn.innerText="Chat"; mBtn.onclick=()=>startChat(uid, u.username); }
    else { mBtn.disabled=true; mBtn.innerText="Locked"; }
}

function loadChats() {
    const list = document.getElementById("activeChatsList"); list.innerHTML="Loading...";
    db.ref(`following/${currentUser.uid}`).get().then(async snap => {
        list.innerHTML="";
        if(!snap.exists()) { list.innerHTML="No friends."; return; }
        Object.keys(snap.val()).forEach(async uid => {
            if((await db.ref(`followers/${currentUser.uid}/${uid}`).get()).exists()) {
                const u = (await db.ref(`users/${uid}`).get()).val();
                const d = document.createElement("div"); d.className="chat-item";
                d.innerHTML=`<img src="${getAvatar(u.username, u.avatarStyle)}" class="avatar-large"><div><b>${u.username}</b><br>Tap to chat</div>`;
                d.onclick = () => startChat(uid, u.username);
                list.appendChild(d);
            }
        });
    });
}

function startChat(uid, name) {
    if(!currentUser.emailVerified) return alert("Verify email first!");
    document.getElementById("userProfileModal").classList.add("hidden");
    document.getElementById("chat-room").classList.remove("hidden");
    document.getElementById("chatTitle").innerText = name;
    currentChatId = [currentUser.uid, uid].sort().join("_");
    db.ref(`private_chats/${currentChatId}`).on('value', snap => {
        const div = document.getElementById("messages"); div.innerHTML="";
        if(snap.exists()) snap.forEach(c => {
            const m = c.val(); const d = document.createElement("div");
            d.className = "message " + (m.senderId === currentUser.uid ? "you" : "them");
            d.innerText = m.text; div.appendChild(d);
        });
        div.scrollTop = div.scrollHeight;
    });
}

async function loadProfile() {
    const u = (await db.ref(`users/${currentUser.uid}`).get()).val();
    document.getElementById("myName").innerText = u.username;
    document.getElementById("myBio").innerText = u.bio || "";
    document.getElementById("myAvatar").src = getAvatar(u.username, u.avatarStyle);
    const f1 = await db.ref(`followers/${currentUser.uid}`).get(); document.getElementById("myFollowersCount").innerText = f1.exists()?f1.numChildren():0;
    const f2 = await db.ref(`following/${currentUser.uid}`).get(); document.getElementById("myFollowingCount").innerText = f2.exists()?f2.numChildren():0;
    
    const list = document.getElementById("myPostsList"); list.innerHTML="";
    db.ref('posts').orderByChild('uid').equalTo(currentUser.uid).limitToLast(20).get().then(snap => {
        if(!snap.exists()) { list.innerHTML="No posts."; return; }
        const posts=[]; snap.forEach(c=>posts.unshift({key:c.key, ...c.val()}));
        posts.forEach(p => {
            const d = document.createElement("div"); d.className="post";
            d.innerHTML=`<div style="padding:10px">${p.text}</div>`;
            list.appendChild(d);
        });
    });
}

async function showFollowList(type, uid) {
    document.getElementById("followListModal").classList.remove("hidden");
    document.getElementById("followListTitle").innerText = type;
    const list = document.getElementById("followListContent"); list.innerHTML="Loading...";
    const snap = await db.ref(`${type}/${uid}`).get();
    if(!snap.exists()) { list.innerHTML="Empty."; return; }
    const uids = Object.keys(snap.val());
    const users = [];
    for(const id of uids) {
        const u = (await db.ref(`users/${id}`).get()).val();
        if(u) users.push({uid:id, ...u});
    }
    const tempDiv = document.createElement('div');
    renderUserList(users, null); // This part needs custom render logic or just reuse
    // Simple render for this list:
    list.innerHTML = "";
    users.forEach(u => {
        const d = document.createElement("div"); d.className="user-item";
        d.innerHTML=`<b>${u.username}</b>`;
        list.appendChild(d);
    });
}
