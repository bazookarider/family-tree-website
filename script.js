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
let replyToMsg = null;
let selectedMsg = null; // For edit/delete context

window.onload = function() {
    try {
        firebase.initializeApp(firebaseConfig);
        db = firebase.database();
        auth = firebase.auth();
        initApp();
    } catch(e) { alert("Error: " + e.message); }
};

function initApp() {
    // PRESENCE
    const connectedRef = db.ref(".info/connected");
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            const snap = await db.ref(`users/${user.uid}`).get();
            currentUser = { uid: user.uid, email: user.email, ...(snap.val() || {}) };
            connectedRef.on("value", (snap) => {
                if (snap.val() === true) {
                    const con = db.ref(`users/${user.uid}/presence`);
                    con.onDisconnect().set({state: 'offline', lastChanged: firebase.database.ServerValue.TIMESTAMP});
                    con.set({state: 'online', lastChanged: firebase.database.ServerValue.TIMESTAMP});
                }
            });
            document.getElementById("auth-screen").classList.add("hidden");
            document.getElementById("app-screen").classList.remove("hidden");
            switchTab('home');
        } else {
            document.getElementById("app-screen").classList.add("hidden");
            document.getElementById("auth-screen").classList.remove("hidden");
        }
    });

    // AUTH
    document.getElementById("loginBtn").onclick = () => auth.signInWithEmailAndPassword(document.getElementById("loginEmail").value, document.getElementById("loginPass").value).catch(e=>alert(e.message));
    document.getElementById("signupBtn").onclick = async () => {
        const name = document.getElementById("signupName").value.trim().replace(/\s/g, "");
        const email = document.getElementById("signupEmail").value;
        const pass = document.getElementById("signupPass").value;
        const gender = document.getElementById("signupGender").value;
        try {
            const chk = await db.ref(`usernames/${name}`).get();
            if(chk.exists()) throw new Error("Username taken");
            const cred = await auth.createUserWithEmailAndPassword(email, pass);
            await db.ref(`users/${cred.user.uid}`).set({username: name, email, gender, category: "Member", joined: Date.now()});
            await db.ref(`usernames/${name}`).set(cred.user.uid);
        } catch(e) { alert(e.message); }
    };
    document.getElementById("logoutBtn").onclick = () => auth.signOut();
    document.getElementById("showSignup").onclick = () => { document.getElementById("loginForm").classList.add("hidden"); document.getElementById("signupForm").classList.remove("hidden"); };
    document.getElementById("showLogin").onclick = () => { document.getElementById("signupForm").classList.add("hidden"); document.getElementById("loginForm").classList.remove("hidden"); };

    // POSTS
    document.getElementById("postBtn").onclick = async () => {
        const txt = document.getElementById("newPostText").value.trim();
        if(!txt) return;
        await db.ref('posts').push({ uid: currentUser.uid, username: currentUser.username, text: txt, time: firebase.database.ServerValue.TIMESTAMP });
        document.getElementById("newPostText").value = "";
        loadFeed();
    };
    document.getElementById("refreshFeedBtn").onclick = loadFeed;

    // CHAT INPUT
    document.getElementById("inputForm").onsubmit = (e) => {
        e.preventDefault();
        const txt = document.getElementById("messageInput").value.trim();
        if(txt && currentChatId) {
            const payload = { senderId: currentUser.uid, text: txt, time: firebase.database.ServerValue.TIMESTAMP, status: 'sent' };
            if(replyToMsg) { payload.replyTo = replyToMsg; cancelReply(); }
            db.ref(`private_chats/${currentChatId}`).push(payload);
            document.getElementById("messageInput").value = "";
        }
    };
    document.getElementById("backToAppBtn").onclick = () => { document.getElementById("chat-room").classList.add("hidden"); currentChatId=null; };
    document.getElementById("cancelReplyBtn").onclick = cancelReply;

    // MODALS & NAV
    document.getElementById("userSearchInput").oninput = (e) => searchUsers(e.target.value);
    document.getElementById("closeProfileModal").onclick = () => document.getElementById("userProfileModal").classList.add("hidden");
    document.getElementById("closeCommentModal").onclick = () => document.getElementById("commentModal").classList.add("hidden");
    document.getElementById("closeMsgOptions").onclick = () => document.getElementById("msgOptionsModal").classList.add("hidden");
    document.getElementById("openEditProfileBtn").onclick = () => {
        document.getElementById("editProfileModal").classList.remove("hidden");
        document.getElementById("editUsername").value = currentUser.username;
        document.getElementById("editBio").value = currentUser.bio || "";
        document.getElementById("editCategory").value = currentUser.category || "";
        document.getElementById("editGender").value = currentUser.gender || "male";
    };
    document.getElementById("saveProfileBtn").onclick = async () => {
        const name = document.getElementById("editUsername").value.trim();
        await db.ref(`users/${currentUser.uid}`).update({
            username: name, bio: document.getElementById("editBio").value,
            category: document.getElementById("editCategory").value, gender: document.getElementById("editGender").value
        });
        document.getElementById("editProfileModal").classList.add("hidden");
        loadProfile();
    };
    document.getElementById("cancelEditBtn").onclick = () => document.getElementById("editProfileModal").classList.add("hidden");

    // COMMENT SEND
    document.getElementById("sendCommentBtn").onclick = async () => {
        const t = document.getElementById("commentInput").value.trim();
        if(t && activePostIdForComments) {
            await db.ref(`posts/${activePostIdForComments}/comments`).push({uid:currentUser.uid, username:currentUser.username, text:t});
            document.getElementById("commentInput").value="";
            loadComments(activePostIdForComments);
        }
    };

    // MSG OPTIONS
    document.getElementById("optReply").onclick = () => {
        replyToMsg = { text: selectedMsg.text, sender: "Reply" }; 
        document.getElementById("replyContext").classList.remove("hidden");
        document.getElementById("replyingToName").innerText = "Replying...";
        document.getElementById("replyingToText").innerText = selectedMsg.text;
        document.getElementById("msgOptionsModal").classList.add("hidden");
    };
    document.getElementById("optCopy").onclick = () => {
        navigator.clipboard.writeText(selectedMsg.text);
        document.getElementById("msgOptionsModal").classList.add("hidden");
    };
    document.getElementById("optEdit").onclick = () => {
        const newT = prompt("Edit:", selectedMsg.text);
        if(newT) db.ref(`private_chats/${currentChatId}/${selectedMsg.key}`).update({text:newT});
        document.getElementById("msgOptionsModal").classList.add("hidden");
    };
    document.getElementById("optDelete").onclick = () => {
        if(confirm("Delete for everyone?")) db.ref(`private_chats/${currentChatId}/${selectedMsg.key}`).update({deleted:true, text:""});
        document.getElementById("msgOptionsModal").classList.add("hidden");
    };
}

// HELPERS
function getAvatar(u, gender) { return `https://api.dicebear.com/7.x/avataaars/svg?seed=${u}&gender=${gender||'male'}`; }
function timeAgo(ts) { if(!ts) return ''; return new Date(ts).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}); }
function parseText(t) { return t.replace(/#(\w+)/g, '<span class="hashtag">#$1</span>'); }

// NAV
window.switchTab = (t) => {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.getElementById(`tab-${t}`).classList.remove('hidden');
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
    const map={'home':0, 'discover':1, 'chats':2, 'profile':3};
    document.querySelectorAll('.nav-btn')[map[t]].classList.add('active');
    if(t=='home') loadFeed();
    if(t=='chats') loadActiveChats();
    if(t=='profile') loadProfile();
};

// FEED
function loadFeed() {
    const list = document.getElementById("feedList"); list.innerHTML = "";
    db.ref('posts').limitToLast(50).get().then(async snap => {
        if(!snap.exists()) { list.innerHTML = "<div style='text-align:center; padding:20px; color:#999'>No posts</div>"; return; }
        const posts = []; snap.forEach(c => posts.unshift({key:c.key, ...c.val()}));
        posts.forEach(p => {
            const d = document.createElement("div"); d.className = "post";
            const isLiked = p.likes && p.likes[currentUser.uid];
            const likes = p.likes ? Object.keys(p.likes).length : 0;
            const comms = p.comments ? Object.keys(p.comments).length : 0;
            const delBtn = (p.uid === currentUser.uid) ? `<i class="fa-solid fa-trash" onclick="deletePost('${p.key}')"></i>` : '';
            
            d.innerHTML = `
                <img src="${getAvatar(p.username, 'male')}" class="avatar-xl">
                <div class="post-content">
                    <div class="post-header"><span>${p.username}</span> ${delBtn}</div>
                    <div class="post-text">${parseText(p.text)}</div>
                    <div class="post-actions">
                        <div class="action-btn ${isLiked?'liked':''}" onclick="toggleLike('${p.key}', ${isLiked})">
                            <i class="${isLiked?'fa-solid':'fa-regular'} fa-heart"></i> ${likes||''}
                        </div>
                        <div class="action-btn" onclick="openComments('${p.key}')">
                            <i class="fa-regular fa-comment"></i> ${comms||''}
                        </div>
                        <span class="post-time">${timeAgo(p.time)}</span>
                    </div>
                </div>`;
            list.appendChild(d);
        });
    });
}
window.deletePost = (pid) => { if(confirm("Delete?")) db.ref(`posts/${pid}`).remove().then(loadFeed); };
window.toggleLike = async (pid, isLiked) => {
    if(isLiked) await db.ref(`posts/${pid}/likes/${currentUser.uid}`).remove();
    else await db.ref(`posts/${pid}/likes/${currentUser.uid}`).set(true);
    loadFeed();
};
window.openComments = (pid) => {
    activePostIdForComments = pid;
    document.getElementById("commentModal").classList.remove("hidden");
    loadComments(pid);
};
function loadComments(pid) {
    const list = document.getElementById("commentsList"); list.innerHTML="Loading...";
    db.ref(`posts/${pid}/comments`).get().then(snap => {
        list.innerHTML="";
        if(!snap.exists()) { list.innerHTML="No comments."; return; }
        snap.forEach(c => {
            const d = document.createElement("div"); d.className="comment-item";
            d.innerHTML = `<b>${c.val().username}:</b> ${c.val().text}`;
            list.appendChild(d);
        });
    });
}

// SEARCH
function searchUsers(term) {
    const list = document.getElementById("usersList"); list.innerHTML = "";
    if(!term) return;
    db.ref('users').get().then(snap => {
        snap.forEach(c => {
            const u = c.val();
            if(u.username.toLowerCase().includes(term.toLowerCase()) && c.key !== currentUser.uid) {
                const d = document.createElement("div"); d.className = "user-item";
                d.innerHTML = `<img src="${getAvatar(u.username, u.gender)}" class="avatar-xl"><div style="flex:1"><b>${u.username}</b><br>${u.category}</div><button class="outline-btn small-btn">View</button>`;
                d.onclick = () => openUser(c.key, u);
                list.appendChild(d);
            }
        });
    });
}

async function openUser(uid, u) {
    document.getElementById("userProfileModal").classList.remove("hidden");
    document.getElementById("viewName").innerText = u.username;
    document.getElementById("viewCategory").innerText = u.category;
    document.getElementById("viewBio").innerText = u.bio;
    document.getElementById("viewAvatar").src = getAvatar(u.username, u.gender);
    const amI = (await db.ref(`followers/${uid}/${currentUser.uid}`).get()).exists();
    const isHe = (await db.ref(`followers/${currentUser.uid}/${uid}`).get()).exists();
    const fBtn = document.getElementById("followBtn");
    fBtn.innerText = amI ? "Unfollow" : "Follow";
    fBtn.onclick = async () => {
        if(amI) { await db.ref(`followers/${uid}/${currentUser.uid}`).remove(); await db.ref(`following/${currentUser.uid}/${uid}`).remove(); }
        else { await db.ref(`followers/${uid}/${currentUser.uid}`).set(true); await db.ref(`following/${currentUser.uid}/${uid}`).set(true); }
        document.getElementById("userProfileModal").classList.add("hidden");
    };
    const mBtn = document.getElementById("messageBtn");
    if(amI && isHe) { mBtn.disabled = false; mBtn.innerText = "Message"; mBtn.onclick = () => startChat(uid, u.username); }
    else { mBtn.disabled = true; mBtn.innerText = "Locked 🔒"; }
}

// CHAT
function startChat(uid, name) {
    document.getElementById("userProfileModal").classList.add("hidden");
    document.getElementById("chat-room").classList.remove("hidden");
    document.getElementById("chatTitle").innerText = name;
    
    // Last Seen Logic
    db.ref(`users/${uid}/presence`).on('value', snap => {
        const s = snap.val();
        if(s && s.state === 'online') document.getElementById("chatStatus").innerText = "Online";
        else if(s && s.lastChanged) document.getElementById("chatStatus").innerText = "Last seen " + timeAgo(s.lastChanged);
        else document.getElementById("chatStatus").innerText = "Offline";
    });

    currentChatId = [currentUser.uid, uid].sort().join("_");
    db.ref(`private_chats/${currentChatId}`).on('value', snap => {
        const div = document.getElementById("messages"); div.innerHTML = "";
        if(snap.exists()) {
            snap.forEach(c => {
                const m = c.val();
                const isMine = m.senderId === currentUser.uid;
                const d = document.createElement("div");
                d.className = "message " + (isMine ? "you" : "them");
                
                let ticks = '<i class="fa-solid fa-check"></i>';
                if(isMine) {
                    if(m.status === 'read') ticks = '<i class="fa-solid fa-check-double ticks read"></i>';
                    else ticks = '<i class="fa-solid fa-check ticks"></i>';
                } else { if(m.status !== 'read') db.ref(`private_chats/${currentChatId}/${c.key}`).update({status:'read'}); }
                
                if(m.deleted) d.innerHTML = `<i class="fa-solid fa-ban"></i> Deleted`;
                else {
                    const replyHtml = m.replyTo ? `<div class="reply-quote"><b>${m.replyTo.sender}</b><br>${m.replyTo.text}</div>` : '';
                    d.innerHTML = `${replyHtml} ${parseText(m.text)} <div class="msg-meta">${timeAgo(m.time)} ${isMine?ticks:''}</div>`;
                    d.onclick = () => {
                        selectedMsg = {key: c.key, text: m.text};
                        const modal = document.getElementById("msgOptionsModal");
                        modal.classList.remove("hidden");
                        document.getElementById("optDelete").style.display = isMine ? "block" : "none";
                        document.getElementById("optEdit").style.display = isMine ? "block" : "none";
                    };
                }
                div.appendChild(d);
            });
        }
        div.scrollTop = div.scrollHeight;
    });
}
function cancelReply() { replyToMsg=null; document.getElementById("replyContext").classList.add("hidden"); }

async function loadProfile() {
    const u = (await db.ref(`users/${currentUser.uid}`).get()).val();
    document.getElementById("myName").innerText = u.username;
    document.getElementById("myCategoryDisplay").innerText = u.category;
    document.getElementById("myBio").innerText = u.bio;
    document.getElementById("myAvatar").src = getAvatar(u.username, u.gender);
    const list = document.getElementById("myPostsList"); list.innerHTML="";
    db.ref('posts').orderByChild('uid').equalTo(currentUser.uid).limitToLast(20).get().then(snap => {
        const posts=[]; snap.forEach(c=>posts.unshift({key:c.key, ...c.val()}));
        posts.forEach(p => {
            const d = document.createElement("div"); d.className = "post";
            d.innerHTML = `<div>${p.text}</div> <i class="fa-solid fa-trash action-btn" onclick="deletePost('${p.key}')"></i>`;
            list.appendChild(d);
        });
    });
    const f1 = await db.ref(`followers/${currentUser.uid}`).get(); document.getElementById("myFollowersCount").innerText = f1.exists()?f1.numChildren():0;
    const f2 = await db.ref(`following/${currentUser.uid}`).get(); document.getElementById("myFollowingCount").innerText = f2.exists()?f2.numChildren():0;
}

function loadActiveChats() {
    const list = document.getElementById("activeChatsList"); list.innerHTML="";
    db.ref(`following/${currentUser.uid}`).get().then(async snap => {
        if(!snap.exists()) { list.innerHTML="<div style='padding:20px;text-align:center'>No friends</div>"; return; }
        Object.keys(snap.val()).forEach(async uid => {
            if((await db.ref(`followers/${currentUser.uid}/${uid}`).get()).exists()) {
                const u = (await db.ref(`users/${uid}`).get()).val();
                const d = document.createElement("div"); d.className="chat-item";
                d.innerHTML = `<img src="${getAvatar(u.username, u.gender)}" class="avatar-xl"><div><b>${u.username}</b><br>Tap to chat</div>`;
                d.onclick = () => startChat(uid, u.username);
                list.appendChild(d);
            }
        });
    });
}
