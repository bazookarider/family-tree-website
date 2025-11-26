 // --- FIREBASE CONFIG ---
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

// --- STARTUP LOGIC ---
window.onload = function() {
    if (typeof firebase === 'undefined') {
        document.getElementById('system-status').style.display = 'block';
        document.getElementById('system-status').innerText = "ERROR: Browser blocking Firebase. Disable Ads/Crypto blocker.";
        return;
    }
    
    try {
        firebase.initializeApp(firebaseConfig);
    } catch(e) {
        alert("Firebase Init Error: " + e.message);
    }

    const db = firebase.database();
    const auth = firebase.auth();
    let currentUser = null;
    let currentChatId = null;
    let activePostIdForComments = null;
    let allUsersCache = [];

    // --- AUTH LISTENER ---
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            const snap = await db.ref(`users/${user.uid}`).get();
            currentUser = { uid: user.uid, email: user.email, emailVerified: user.emailVerified, ...(snap.val() || {}) };
            if(!user.emailVerified) document.getElementById("verifyBanner").classList.remove("hidden");
            else document.getElementById("verifyBanner").classList.add("hidden");
            document.getElementById("auth-screen").classList.add("hidden");
            document.getElementById("app-screen").classList.remove("hidden");
            switchTab('home');
        } else {
            currentUser = null;
            document.getElementById("app-screen").classList.add("hidden");
            document.getElementById("auth-screen").classList.remove("hidden");
        }
    });

    // --- BUTTON BINDINGS ---
    document.getElementById("loginBtn").onclick = async function() {
        this.innerText = "Processing...";
        try { await auth.signInWithEmailAndPassword(document.getElementById("loginEmail").value, document.getElementById("loginPass").value); }
        catch (e) { alert("Login failed: " + e.message); this.innerText = "Log In"; }
    };
    
    document.getElementById("signupBtn").onclick = async function() {
        this.innerText = "Processing...";
        const name = document.getElementById("signupName").value.trim().replace(/\s/g, "");
        const email = document.getElementById("signupEmail").value;
        const pass = document.getElementById("signupPass").value;
        if (!name || !email || !pass) { this.innerText="Sign Up"; return alert("Fill all fields"); }
        
        try {
            const check = await db.ref(`usernames/${name}`).get();
            if (check.exists()) throw new Error("Username taken.");
            const cred = await auth.createUserWithEmailAndPassword(email, pass);
            await cred.user.sendEmailVerification();
            await db.ref(`users/${cred.user.uid}`).set({
                username: name, email, bio: "Hi there!", category: "Member", isVerified: false, joined: firebase.database.ServerValue.TIMESTAMP, avatarStyle: "male"
            });
            await db.ref(`usernames/${name}`).set(cred.user.uid);
            alert("Success! Verification email sent.");
        } catch(e) { alert(e.message); }
        this.innerText = "Sign Up";
    };

    document.getElementById("resetPassBtn").onclick = async () => {
        const email = document.getElementById("forgotEmail").value;
        if(!email) return alert("Enter email");
        try { await auth.sendPasswordResetEmail(email); alert("Check your email!"); } catch(e) { alert(e.message); }
    };

    // --- SCREEN SWITCHING ---
    document.getElementById("showSignup").onclick = () => { document.getElementById("loginForm").classList.add("hidden"); document.getElementById("signupForm").classList.remove("hidden"); };
    document.getElementById("showLogin").onclick = () => { document.getElementById("signupForm").classList.add("hidden"); document.getElementById("loginForm").classList.remove("hidden"); document.getElementById("forgotForm").classList.add("hidden"); };
    document.getElementById("showForgot").onclick = () => { document.getElementById("loginForm").classList.add("hidden"); document.getElementById("forgotForm").classList.remove("hidden"); };
    document.getElementById("cancelForgot").onclick = document.getElementById("showLogin").onclick;
    document.getElementById("logoutBtn").onclick = () => auth.signOut();

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
    };

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
        if(s<86400) return Math.floor(s/3600)+'h ago';
        return Math.floor(s/86400)+'d ago';
    }

    // --- FEED ---
    document.getElementById("postBtn").onclick = async () => {
        const txt = document.getElementById("newPostText").value.trim();
        if(!txt) return;
        await db.ref('posts').push({
            uid: currentUser.uid, username: currentUser.username, text: txt, time: firebase.database.ServerValue.TIMESTAMP, isVerified: currentUser.isVerified||false
        });
        document.getElementById("newPostText").value = "";
        loadFeed();
    };
    document.getElementById("refreshFeedBtn").onclick = loadFeed;

    function loadFeed() {
        const list = document.getElementById("feedList");
        db.ref('posts').limitToLast(50).get().then(async (snap) => {
            list.innerHTML = "";
            if(!snap.exists()) { list.innerHTML="<div style='text-align:center;padding:20px;color:#999'>No posts.</div>"; return; }
            const posts=[]; snap.forEach(c=>posts.unshift({key:c.key, ...c.val()}));
            const following = (await db.ref(`following/${currentUser.uid}`).get()).val() || {};
            posts.forEach(p => {
                if(p.uid === currentUser.uid || following[p.uid]) {
                    const d = document.createElement("div"); d.className = "post";
                    const ava = getAvatar(p.username, "male");
                    const isLiked = p.likes && p.likes[currentUser.uid];
                    const likes = p.likes ? Object.keys(p.likes).length : 0;
                    const comms = p.comments ? Object.keys(p.comments).length : 0;
                    d.innerHTML = `
                        <img src="${ava}" class="avatar-large">
                        <div class="post-content">
                            <div class="post-header"><span class="post-author">${p.username} ${p.isVerified?'<i class="fa-solid fa-circle-check verified-badge"></i>':''}</span> <span class="post-time">· ${timeAgo(p.time)}</span></div>
                            <div class="post-text">${p.text}</div>
                            <div class="post-actions">
                                <span class="like-btn ${isLiked?'liked':''}"><i class="${isLiked?'fa-solid':'fa-regular'} fa-heart"></i> ${likes||''}</span>
                                <span class="comment-btn"><i class="fa-regular fa-comment"></i> ${comms||''}</span>
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
    function loadComments(pid) {
        const list = document.getElementById("commentsList"); list.innerHTML = "Loading...";
        db.ref(`posts/${pid}`).get().then(snap => {
            const post = snap.val();
            const coms = post.comments || {};
            list.innerHTML = "";
            Object.entries(coms).forEach(([k, c]) => {
                const d = document.createElement("div"); d.className = "comment-item " + (c.pinned?"comment-pinned":"");
                const pin = (post.uid === currentUser.uid) ? `<button class="small-btn" onclick="togglePin('${pid}','${k}',${c.pinned})">${c.pinned?'Unpin':'Pin'}</button>` : '';
                d.innerHTML = `<div><b>${c.username}:</b> ${c.text}</div> ${pin}`;
                list.appendChild(d);
            });
            if(list.innerHTML === "") list.innerHTML = "No comments.";
        });
    }
    window.togglePin = async (pid, cid, st) => { await db.ref(`posts/${pid}/comments/${cid}`).update({pinned: !st}); loadComments(pid); };

    // --- USERS ---
    document.getElementById("userSearchInput").oninput = (e) => {
        const term = e.target.value.toLowerCase();
        renderUserList(allUsersCache.filter(u => u.username.toLowerCase().includes(term)), "usersList");
    };
    async function loadAllUsers() {
        const snap = await db.ref("users").get(); allUsersCache=[];
        snap.forEach(c => { if(c.key !== currentUser.uid) allUsersCache.push({uid: c.key, ...c.val()}); });
        renderUserList(allUsersCache, "usersList");
    }
    function renderUserList(arr, elId) {
        const list = document.getElementById(elId); list.innerHTML = "";
        arr.forEach(u => {
            const d = document.createElement("div"); d.className = "user-item";
            d.innerHTML = `
                <img src="${getAvatar(u.username, u.avatarStyle)}" class="avatar-large">
                <div class="user-info"><div class="user-name-list">${u.username}</div><div class="user-bio-list">${u.category||'Member'}</div></div>
                <button class="outline-btn small-btn">View</button>`;
            d.onclick = () => openUserProfile(u.uid);
            list.appendChild(d);
        });
    }
    async function openUserProfile(uid) {
        document.getElementById("userProfileModal").classList.remove("hidden");
        const snap = await db.ref(`users/${uid}`).get(); const u = snap.val();
        document.getElementById("viewName").innerHTML = `${u.username} ${u.isVerified?'<i class="fa-solid fa-circle-check verified-badge"></i>':''}`;
        document.getElementById("viewCategory").innerText = u.category || "Member";
        document.getElementById("viewBio").innerText = u.bio || "";
        document.getElementById("viewAvatar").src = getAvatar(u.username, u.avatarStyle);
        const f1 = await db.ref(`followers/${uid}`).get(); document.getElementById("viewFollowers").innerText = f1.exists()?f1.numChildren():0;
        const f2 = await db.ref(`following/${uid}`).get(); document.getElementById("viewFollowing").innerText = f2.exists()?f2.numChildren():0;
        checkFollow(uid);
        document.getElementById("closeProfileModal").onclick = () => document.getElementById("userProfileModal").classList.add("hidden");
    }
    async function checkFollow(uid) {
        const fBtn = document.getElementById("followBtn");
        const mBtn = document.getElementById("messageBtn");
        const amI = (await db.ref(`followers/${uid}/${currentUser.uid}`).get()).exists();
        const isHe = (await db.ref(`followers/${currentUser.uid}/${uid}`).get()).exists();
        fBtn.innerText = amI ? "Following" : "Follow";
        fBtn.className = amI ? "outline-btn flex-btn" : "primary-btn flex-btn";
        fBtn.onclick = async () => {
            if(amI) { await db.ref(`followers/${uid}/${currentUser.uid}`).remove(); await db.ref(`following/${currentUser.uid}/${uid}`).remove(); }
            else { await db.ref(`followers/${uid}/${currentUser.uid}`).set(true); await db.ref(`following/${currentUser.uid}/${uid}`).set(true); }
            openUserProfile(uid);
        };
        if(amI && isHe) {
            mBtn.disabled = false; mBtn.innerText = "Chat Now"; mBtn.onclick = () => startChat(uid, document.getElementById("viewName").innerText);
            document.getElementById("mutualWarning").style.display = "none";
        } else {
            mBtn.disabled = true; mBtn.innerText = "Locked 🔒";
            document.getElementById("mutualWarning").style.display = "block";
        }
    }

    // --- CHAT ---
    function loadActiveChats() {
        const list = document.getElementById("activeChatsList"); list.innerHTML="Loading...";
        db.ref(`following/${currentUser.uid}`).get().then(async snap => {
            if(!snap.exists()) { list.innerHTML="<div style='padding:20px;text-align:center'>No chats.</div>"; return; }
            list.innerHTML="";
            const uids = Object.keys(snap.val());
            for(const uid of uids) {
                if((await db.ref(`followers/${currentUser.uid}/${uid}`).get()).exists()) {
                    const u = (await db.ref(`users/${uid}`).get()).val();
                    const d = document.createElement("div"); d.className="chat-item";
                    d.innerHTML=`<img src="${getAvatar(u.username, u.avatarStyle)}" class="avatar-large"><div class="user-info"><div class="user-name-list">${u.username}</div><div>Tap to chat</div></div>`;
                    d.onclick = () => startChat(uid, u.username);
                    list.appendChild(d);
                }
            }
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
    document.getElementById("backToAppBtn").onclick = () => { document.getElementById("chat-room").classList.add("hidden"); currentChatId = null; };
    document.getElementById("inputForm").onsubmit = (e) => {
        e.preventDefault(); const t = document.getElementById("messageInput").value.trim();
        if(t && currentChatId) db.ref(`private_chats/${currentChatId}`).push({senderId:currentUser.uid, text:t, time:firebase.database.ServerValue.TIMESTAMP});
        document.getElementById("messageInput").value="";
    };

    // --- MY PROFILE ---
    async function loadMyProfile() {
        const u = (await db.ref(`users/${currentUser.uid}`).get()).val();
        document.getElementById("myName").innerHTML = `${u.username} ${u.isVerified?'<i class="fa-solid fa-circle-check verified-badge"></i>':''}`;
        document.getElementById("myCategoryDisplay").innerText = u.category || "Member";
        document.getElementById("myBio").innerText = u.bio || "No bio.";
        document.getElementById("myAvatar").src = getAvatar(u.username, u.avatarStyle);
        const f1 = await db.ref(`followers/${currentUser.uid}`).get(); document.getElementById("myFollowersCount").innerText = f1.exists()?f1.numChildren():0;
        const f2 = await db.ref(`following/${currentUser.uid}`).get(); document.getElementById("myFollowingCount").innerText = f2.exists()?f2.numChildren():0;
        
        const list = document.getElementById("myPostsList");
        db.ref('posts').orderByChild('uid').equalTo(currentUser.uid).limitToLast(20).get().then(snap => {
            list.innerHTML="";
            if(!snap.exists()) { list.innerHTML="<div style='padding:20px'>No posts.</div>"; return; }
            const posts=[]; snap.forEach(c=>posts.unshift({key:c.key, ...c.val()}));
            posts.forEach(p => renderPost(p, list));
        });
    }

    // --- EDIT PROFILE ---
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
        const bio = document.getElementById("editBio").value;
        const cat = document.getElementById("editCategory").value;
        const style = document.getElementById("editAvatarStyle").value;
        const newName = document.getElementById("editUsername").value.trim();
        if(newName !== currentUser.username) {
            const chk = await db.ref(`usernames/${newName}`).get();
            if(chk.exists()) return alert("Username taken");
            await db.ref(`usernames/${newName}`).set(currentUser.uid);
            await db.ref(`usernames/${currentUser.username}`).remove();
        }
        await db.ref(`users/${currentUser.uid}`).update({bio, category:cat, avatarStyle:style, username:newName});
        editModal.classList.add("hidden"); loadMyProfile();
    };

    // --- FOLLOW LISTS ---
    async function showFollowList(type, uid) {
        document.getElementById("followListModal").classList.remove("hidden");
        document.getElementById("followListTitle").innerText = type;
        const list