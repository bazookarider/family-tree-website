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
let selectedMsg = null; 

window.onload = function() {
    try {
        firebase.initializeApp(firebaseConfig);
        db = firebase.database();
        auth = firebase.auth();
        initApp();
    } catch(e) { console.error("FB Error", e); }
};

function initApp() {
    const connectedRef = db.ref(".info/connected");
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            const snap = await db.ref(`users/${user.uid}`).get();
            currentUser = { uid: user.uid, email: user.email, ...(snap.val() || {}) };
            
            // Presence
            connectedRef.on("value", (snap) => {
                if (snap.val() === true) {
                    const con = db.ref(`users/${user.uid}/presence`);
                    con.onDisconnect().set({state: 'offline', lastChanged: firebase.database.ServerValue.TIMESTAMP});
                    con.set({state: 'online', lastChanged: firebase.database.ServerValue.TIMESTAMP});
                }
            });

            if(document.getElementById("auth-screen")) document.getElementById("auth-screen").classList.add("hidden");
            if(document.getElementById("app-screen")) document.getElementById("app-screen").classList.remove("hidden");
            switchTab('home');
        } else {
            if(document.getElementById("app-screen")) document.getElementById("app-screen").classList.add("hidden");
            if(document.getElementById("auth-screen")) document.getElementById("auth-screen").classList.remove("hidden");
        }
    });

    // BINDINGS
    bindClick("loginBtn", () => auth.signInWithEmailAndPassword(getVal("loginEmail"), getVal("loginPass")).catch(e=>alert(e.message)));
    bindClick("signupBtn", handleSignup);
    bindClick("logoutBtn", () => auth.signOut());
    bindClick("showSignup", () => { hide("loginForm"); show("signupForm"); });
    bindClick("showLogin", () => { hide("signupForm"); show("loginForm"); });
    
    bindClick("postBtn", handlePost);
    bindClick("refreshFeedBtn", loadFeed);
    
    // Chat Inputs
    const inputForm = document.getElementById("inputForm");
    if(inputForm) inputForm.onsubmit = (e) => {
        e.preventDefault();
        handleChatSend();
    };
    bindClick("backToAppBtn", () => { hide("chat-room"); currentChatId=null; });
    bindClick("cancelReplyBtn", cancelReply);

    // Search
    const searchIn = document.getElementById("userSearchInput");
    if(searchIn) searchIn.oninput = (e) => searchUsers(e.target.value);

    // Modals
    bindClick("closeProfileModal", () => hide("userProfileModal"));
    bindClick("closeCommentModal", () => hide("commentModal"));
    bindClick("closeMsgOptions", () => hide("msgOptionsModal"));
    
    bindClick("openEditProfileBtn", () => {
        show("editProfileModal");
        setVal("editUsername", currentUser.username);
        setVal("editBio", currentUser.bio || "");
        setVal("editCategory", currentUser.category || "");
        setVal("editGender", currentUser.gender || "male");
    });
    
    bindClick("saveProfileBtn", handleProfileSave);
    bindClick("cancelEditBtn", () => hide("editProfileModal"));
    
    bindClick("sendCommentBtn", handleCommentSend);
    
    // Options Actions
    bindClick("optReply", () => {
        replyToMsg = { text: selectedMsg.text, sender: "Replying..." }; 
        show("replyContext");
        document.getElementById("replyingToName").innerText = "Replying";
        document.getElementById("replyingToText").innerText = selectedMsg.text;
        hide("msgOptionsModal");
    });
    bindClick("optEdit", () => {
        const newT = prompt("Edit:", selectedMsg.text);
        if(newT) db.ref(`private_chats/${currentChatId}/${selectedMsg.key}`).update({text:newT});
        hide("msgOptionsModal");
    });
    bindClick("optDelete", () => {
        if(confirm("Delete?")) db.ref(`private_chats/${currentChatId}/${selectedMsg.key}`).update({deleted:true, text:""});
        hide("msgOptionsModal");
    });
}

// --- HANDLERS ---
async function handleSignup() {
    const name = getVal("signupName").replace(/\s/g, "");
    const email = getVal("signupEmail");
    const pass = getVal("signupPass");
    const gender = getVal("signupGender");
    try {
        const chk = await db.ref(`usernames/${name}`).get();
        if(chk.exists()) throw new Error("Username taken");
        const cred = await auth.createUserWithEmailAndPassword(email, pass);
        await db.ref(`users/${cred.user.uid}`).set({username: name, email, gender, category: "Member", joined: Date.now()});
        await db.ref(`usernames/${name}`).set(cred.user.uid);
    } catch(e) { alert(e.message); }
}

async function handlePost() {
    const txt = getVal("newPostText");
    if(!txt) return;
    await db.ref('posts').push({ uid: currentUser.uid, username: currentUser.username, text: txt, time: firebase.database.ServerValue.TIMESTAMP });
    setVal("newPostText", "");
    loadFeed();
}

async function handleProfileSave() {
    const name = getVal("editUsername");
    await db.ref(`users/${currentUser.uid}`).update({
        username: name, bio: getVal("editBio"), category: getVal("editCategory"), gender: getVal("editGender")
    });
    hide("editProfileModal");
    loadProfile();
}

async function handleChatSend() {
    const txt = getVal("messageInput");
    if(txt && currentChatId) {
        const payload = { senderId: currentUser.uid, text: txt, time: firebase.database.ServerValue.TIMESTAMP, status: 'sent' };
        if(replyToMsg) { payload.replyTo = replyToMsg; cancelReply(); }
        db.ref(`private_chats/${currentChatId}`).push(payload);
        setVal("messageInput", "");
    }
}

async function handleCommentSend() {
    const t = getVal("commentInput");
    if(t && selectedMsg) { // Reuse selectedMsg var for post ID in comments
        await db.ref(`posts/${selectedMsg}/comments`).push({uid:currentUser.uid, username:currentUser.username, text:t});
        setVal("commentInput", "");
        loadComments(selectedMsg);
    }
}

// --- UTILS ---
function getVal(id) { const el = document.getElementById(id); return el ? el.value.trim() : ""; }
function setVal(id, v) { const el = document.getElementById(id); if(el) el.value = v; }
function show(id) { const el = document.getElementById(id); if(el) el.classList.remove("hidden"); }
function hide(id) { const el = document.getElementById(id); if(el) el.classList.add("hidden"); }
function bindClick(id, fn) { const el = document.getElementById(id); if(el) el.onclick = fn; }

function getAvatar(u, gender) { return `https://api.dicebear.com/7.x/avataaars/svg?seed=${u}&gender=${gender||'male'}`; }
function timeAgo(ts) { if(!ts) return ''; return new Date(ts).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}); }
function parseText(t) { return t.replace(/#(\w+)/g, '<span class="hashtag">#$1</span>'); }

// --- NAVIGATION ---
window.switchTab = (t) => {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    show(`tab-${t}`);
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
    // Manual active mapping
    const navs = document.querySelectorAll('.nav-btn');
    if(t=='home' && navs[0]) navs[0].classList.add('active');
    if(t=='discover' && navs[1]) navs[1].classList.add('active');
    if(t=='chats' && navs[2]) navs[2].classList.add('active');
    if(t=='profile' && navs[3]) navs[3].classList.add('active');
    
    if(t=='home') loadFeed();
    if(t=='discover') { loadRecommended(); searchUsers(""); }
    if(t=='chats') loadActiveChats();
    if(t=='profile') loadProfile();
};

// --- FEED ---
function loadFeed() {
    const list = document.getElementById("feedList");
    if(!list) return;
    list.innerHTML = "";
    db.ref('posts').limitToLast(50).get().then(async snap => {
        if(!snap.exists()) { list.innerHTML = "<div style='padding:20px;text-align:center'>No posts</div>"; return; }
        const posts = []; snap.forEach(c => posts.unshift({key:c.key, ...c.val()}));
        posts.forEach(p => {
            const d = document.createElement("div"); d.className = "post";
            const isLiked = p.likes && p.likes[currentUser.uid];
            const likes = p.likes ? Object.keys(p.likes).length : 0;
            const comms = p.comments ? Object.keys(p.comments).length : 0;
            const delBtn = (p.uid === currentUser.uid) ? `<i class="fa-solid fa-trash" onclick="deletePost('${p.key}')" style="margin-left:auto;color:#ccc"></i>` : '';
            
            d.innerHTML = `
                <img src="${getAvatar(p.username)}" class="avatar-xl">
                <div style="flex:1">
                    <div class="post-header"><span>${p.username}</span> ${delBtn}</div>
                    <div class="post-text">${parseText(p.text)}</div>
                    <div class="post-actions">
                        <div class="action-btn ${isLiked?'liked':''}" onclick="toggleLike('${p.key}', ${isLiked})">
                            <i class="${isLiked?'fa-solid':'fa-regular'} fa-heart"></i> ${likes||''}
                        </div>
                        <div class="action-btn" onclick="openComments('${p.key}')">
                            <i class="fa-regular fa-comment"></i> ${comms||''}
                        </div>
                        <span style="font-size:0.8rem; margin-left:auto;">${timeAgo(p.time)}</span>
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
    selectedMsg = pid; // Using selectedMsg global to store Post ID for comments
    show("commentModal");
    loadComments(pid);
};
function loadComments(pid) {
    const list = document.getElementById("commentsList");
    if(!list) return;
    list.innerHTML="Loading...";
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

// --- DISCOVER ---
function loadRecommended() {
    const list = document.getElementById("recommendedList");
    if(!list) return;
    list.innerHTML = "Loading...";
    db.ref('users').limitToLast(5).get().then(snap => {
        list.innerHTML = "";
        snap.forEach(c => {
            if(c.key !== currentUser.uid) renderUserItem(c.key, c.val(), list);
        });
    });
}
function searchUsers(term) {
    const list = document.getElementById("usersList");
    if(!list) return;
    list.innerHTML = "";
    db.ref('users').get().then(snap => {
        snap.forEach(c => {
            const u = c.val();
            if((!term || u.username.toLowerCase().includes(term.toLowerCase())) && c.key !== currentUser.uid) {
                renderUserItem(c.key, u, list);
            }
        });
    });
}
function renderUserItem(uid, u, container) {
    const d = document.createElement("div"); d.className = "user-item";
    d.innerHTML = `<img src="${getAvatar(u.username, u.gender)}" class="avatar-xl"><div style="flex:1"><b>${u.username}</b><br>${u.category}</div><button class="outline-btn small-btn">View</button>`;
    d.onclick = () => openUser(uid, u);
    container.appendChild(d);
}

async function openUser(uid, u) {
    show("userProfileModal");
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
        hide("userProfileModal");
    };
    const mBtn = document.getElementById("messageBtn");
    if(amI && isHe) { mBtn.disabled=false; mBtn.innerText="Message"; mBtn.onclick=()=>startChat(uid, u.username); }
    else { mBtn.disabled=true; mBtn.innerText="Locked 🔒"; }
}

// --- CHAT ---
function startChat(uid, name) {
    hide("userProfileModal");
    show("chat-room");
    document.getElementById("chatTitle").innerText = name;
    
    db.ref(`users/${uid}/presence`).on('value', snap => {
        const s = snap.val();
        if(s && s.state === 'online') document.getElementById("chatStatus").innerText = "Online";
        else if(s && s.lastChanged) document.getElementById("chatStatus").innerText = "Last seen " + timeAgo(s.lastChanged);
        else document.getElementById("chatStatus").innerText = "Offline";
    });

    currentChatId = [currentUser.uid, uid].sort().join("_");
    db.ref(`private_chats/${currentChatId}`).on('value', snap => {
        const div = document.getElementById("messages"); 
        if(!div) return;
        div.innerHTML = "";
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
                        show("msgOptionsModal");
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
function cancelReply() { replyToMsg=null; hide("replyContext"); }

// --- PROFILE ---
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
            d.innerHTML = `<div>${p.text}</div> <i class="fa-solid fa-trash" onclick="deletePost('${p.key}')" style="margin-left:auto;color:#ccc"></i>`;
            list.appendChild(d);
        });
    });
    const f1 = await db.ref(`followers/${currentUser.uid}`).get(); document.getElementById("myFollowersCount").innerText = f1.exists()?f1.numChildren():0;
    const f2 = await db.ref(`following/${currentUser.uid}`).get(); document.getElementById("myFollowingCount").innerText = f2.exists()?f2.numChildren():0;
}

function loadActiveChats() {
    const list = document.getElementById("activeChatsList"); 
    if(!list) return;
    list.innerHTML="";
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
