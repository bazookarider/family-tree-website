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
let typingTimeout = null;
let selectedMsgId = null;
let selectedMsgText = null;

window.onload = function() {
    try {
        firebase.initializeApp(firebaseConfig);
        db = firebase.database();
        auth = firebase.auth();
        initApp();
    } catch(e) { alert("Error: " + e.message); }
};

function initApp() {
    // PRESENCE & AUTH
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

    // AUTH BUTTONS
    document.getElementById("loginBtn").onclick = () => auth.signInWithEmailAndPassword(document.getElementById("loginEmail").value, document.getElementById("loginPass").value).catch(e=>alert(e.message));
    document.getElementById("signupBtn").onclick = async () => {
        const name = document.getElementById("signupName").value.trim().replace(/\s/g, "");
        const email = document.getElementById("signupEmail").value; const pass = document.getElementById("signupPass").value;
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

    // CHAT INPUT & TYPING
    const msgInput = document.getElementById("messageInput");
    msgInput.oninput = () => {
        if(currentChatId) {
            db.ref(`typing/${currentChatId}/${currentUser.uid}`).set(true);
            clearTimeout(typingTimeout);
            typingTimeout = setTimeout(() => db.ref(`typing/${currentChatId}/${currentUser.uid}`).remove(), 2000);
        }
    };
    document.getElementById("inputForm").onsubmit = (e) => {
        e.preventDefault();
        const txt = msgInput.value.trim();
        if(txt && currentChatId) {
            const payload = { senderId: currentUser.uid, text: txt, time: firebase.database.ServerValue.TIMESTAMP, status: 'sent' };
            if(replyToMsg) { payload.replyTo = replyToMsg; cancelReply(); }
            db.ref(`private_chats/${currentChatId}`).push(payload);
            msgInput.value = "";
            db.ref(`typing/${currentChatId}/${currentUser.uid}`).remove();
        }
    };
    document.getElementById("backToAppBtn").onclick = () => { document.getElementById("chat-room").classList.add("hidden"); currentChatId=null; };
    document.getElementById("cancelReplyBtn").onclick = cancelReply;

    // MESSAGE MENU ACTIONS
    document.getElementById("closeMsgOptions").onclick = () => document.getElementById("msgOptionsModal").classList.add("hidden");
    
    document.getElementById("optReply").onclick = () => {
        replyToMsg = { text: selectedMsgText, sender: "Replying..." }; 
        document.getElementById("replyContext").classList.remove("hidden");
        document.getElementById("replyingToName").innerText = "Replying to message";
        document.getElementById("replyingToText").innerText = selectedMsgText;
        document.getElementById("msgOptionsModal").classList.add("hidden");
        document.getElementById("messageInput").focus();
    };
    
    document.getElementById("optForward").onclick = () => {
        navigator.clipboard.writeText(selectedMsgText);
        alert("Message copied! Paste to forward.");
        document.getElementById("msgOptionsModal").classList.add("hidden");
    };
    
    document.getElementById("optEdit").onclick = () => {
        const newText = prompt("Edit message:", selectedMsgText);
        if(newText) db.ref(`private_chats/${currentChatId}/${selectedMsgId}`).update({text: newText});
        document.getElementById("msgOptionsModal").classList.add("hidden");
    };
    
    document.getElementById("optDelete").onclick = () => {
        if(confirm("Delete for everyone?")) db.ref(`private_chats/${currentChatId}/${selectedMsgId}`).update({deleted:true, text:""});
        document.getElementById("msgOptionsModal").classList.add("hidden");
    };

    // MODALS
    document.getElementById("closeProfileModal").onclick = () => document.getElementById("userProfileModal").classList.add("hidden");
    document.getElementById("userSearchInput").oninput = (e) => searchUsers(e.target.value);
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

// POSTS
function loadFeed() {
    const list = document.getElementById("feedList"); list.innerHTML = "";
    db.ref('posts').limitToLast(50).get().then(async snap => {
        if(!snap.exists()) { list.innerHTML = "<div style='text-align:center; padding:20px; color:#999'>No posts</div>"; return; }
        const posts = []; snap.forEach(c => posts.unshift({key:c.key, ...c.val()}));
        posts.forEach(p => {
            const d = document.createElement("div"); d.className = "post";
            const delBtn = (p.uid === currentUser.uid) ? `<i class="fa-solid fa-pen action-btn" onclick="editPost('${p.key}', '${p.text}')"></i> <i class="fa-solid fa-trash action-btn" onclick="deletePost('${p.key}')"></i>` : '';
            d.innerHTML = `
                <img src="${getAvatar(p.username)}" class="avatar-xl">
                <div class="post-content">
                    <div class="post-header"><span>${p.username}</span> <div style="display:flex; gap:10px;">${delBtn}</div></div>
                    <div class="post-text">${parseText(p.text)}</div>
                    <div class="post-actions"><span class="post-time">${timeAgo(p.time)}</span></div>
                </div>`;
            list.appendChild(d);
        });
    });
}
window.deletePost = (pid) => { if(confirm("Delete post?")) db.ref(`posts/${pid}`).remove().then(loadFeed); };
window.editPost = (pid, oldTxt) => { 
    const newTxt = prompt("Edit post:", oldTxt); 
    if(newTxt) db.ref(`posts/${pid}`).update({text:newTxt}).then(loadFeed); 
};

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
    
    // Status & Typing Listener
    db.ref(`users/${uid}/presence`).on('value', s => document.getElementById("chatStatus").innerText = (s.val() && s.val().state === 'online') ? "Online" : "Offline");
    currentChatId = [currentUser.uid, uid].sort().join("_");
    
    db.ref(`typing/${currentChatId}/${uid}`).on('value', s => {
        if(s.val()) document.getElementById("chatStatus").innerText = "Typing...";
        else db.ref(`users/${uid}/presence`).once('value', ps => document.getElementById("chatStatus").innerText = (ps.val() && ps.val().state === 'online') ? "Online" : "Offline");
    });

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
                        selectedMsgId = c.key; selectedMsgText = m.text;
                        const modal = document.getElementById("msgOptionsModal");
                        modal.classList.remove("hidden");
                        // Show/Hide Delete/Edit based on ownership
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
}
function loadActiveChats() {
    const list = document.getElementById("activeChatsList"); list.innerHTML="";
    db.ref(`following/${currentUser.uid}`).get().then(async snap => {
        if(!snap.exists()) return;
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
