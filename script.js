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

window.onload = function() {
    try {
        if(typeof firebase === 'undefined') throw new Error("Blocked");
        firebase.initializeApp(firebaseConfig);
        db = firebase.database();
        auth = firebase.auth();
        initApp();
    } catch(e) { alert("Error: " + e.message); }
};

function initApp() {
    // PRESENCE SYSTEM
    const connectedRef = db.ref(".info/connected");
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            const snap = await db.ref(`users/${user.uid}`).get();
            currentUser = { uid: user.uid, email: user.email, ...(snap.val() || {}) };
            
            // ONLINE STATUS
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

    // BUTTONS
    document.getElementById("loginBtn").onclick = async () => {
        try { await auth.signInWithEmailAndPassword(document.getElementById("loginEmail").value, document.getElementById("loginPass").value); }
        catch(e) { alert(e.message); }
    };
    document.getElementById("signupBtn").onclick = async () => {
        const name = document.getElementById("signupName").value.trim().replace(/\s/g, "");
        const email = document.getElementById("signupEmail").value;
        const pass = document.getElementById("signupPass").value;
        const gender = document.getElementById("signupGender").value;
        try {
            const check = await db.ref(`usernames/${name}`).get();
            if(check.exists()) throw new Error("Username taken");
            const cred = await auth.createUserWithEmailAndPassword(email, pass);
            await db.ref(`users/${cred.user.uid}`).set({ username: name, email, gender, category: "Member", joined: Date.now() });
            await db.ref(`usernames/${name}`).set(cred.user.uid);
        } catch(e) { alert(e.message); }
    };
    document.getElementById("logoutBtn").onclick = () => {
        db.ref(`users/${currentUser.uid}/presence`).set({state: 'offline', lastChanged: firebase.database.ServerValue.TIMESTAMP});
        auth.signOut();
    }

    // POSTING (With Hashtags & Delete)
    document.getElementById("postBtn").onclick = async () => {
        const txt = document.getElementById("newPostText").value.trim();
        if(txt) {
            await db.ref('posts').push({ uid: currentUser.uid, username: currentUser.username, text: txt, time: firebase.database.ServerValue.TIMESTAMP });
            document.getElementById("newPostText").value = "";
            loadFeed();
        }
    };
    document.getElementById("refreshFeedBtn").onclick = loadFeed;

    // PROFILE EDIT
    document.getElementById("openEditProfileBtn").onclick = () => {
        document.getElementById("editProfileModal").classList.remove("hidden");
        document.getElementById("editUsername").value = currentUser.username;
        document.getElementById("editCategory").value = currentUser.category || "";
        document.getElementById("editBio").value = currentUser.bio || "";
        document.getElementById("editGender").value = currentUser.gender || "male";
    };
    document.getElementById("saveProfileBtn").onclick = async () => {
        const name = document.getElementById("editUsername").value.trim();
        const updates = {
            bio: document.getElementById("editBio").value,
            category: document.getElementById("editCategory").value,
            gender: document.getElementById("editGender").value,
            username: name
        };
        if(name !== currentUser.username) {
             const check = await db.ref(`usernames/${name}`).get();
             if(check.exists()) return alert("Username taken");
             await db.ref(`usernames/${name}`).set(currentUser.uid);
             await db.ref(`usernames/${currentUser.username}`).remove();
        }
        await db.ref(`users/${currentUser.uid}`).update(updates);
        document.getElementById("editProfileModal").classList.add("hidden");
        loadProfile();
    };
    document.getElementById("cancelEditBtn").onclick = () => document.getElementById("editProfileModal").classList.add("hidden");

    // CHAT INPUT & REPLY
    document.getElementById("inputForm").onsubmit = (e) => {
        e.preventDefault();
        const txt = document.getElementById("messageInput").value.trim();
        if(txt && currentChatId) {
            const payload = {
                senderId: currentUser.uid, 
                text: txt, 
                time: firebase.database.ServerValue.TIMESTAMP,
                status: 'sent'
            };
            if(replyToMsg) { payload.replyTo = replyToMsg; cancelReply(); }
            db.ref(`private_chats/${currentChatId}`).push(payload);
            document.getElementById("messageInput").value = "";
        }
    };
    document.getElementById("cancelReplyBtn").onclick = cancelReply;
    document.getElementById("backToAppBtn").onclick = () => { 
        document.getElementById("chat-room").classList.add("hidden"); 
        currentChatId = null; 
    };
    
    // NAV
    window.switchTab = (t) => {
        document.querySelectorAll('.tab-content').forEach(e=>e.classList.add('hidden'));
        document.getElementById(`tab-${t}`).classList.remove('hidden');
        if(t=='home') loadFeed();
        if(t=='discover') loadAllUsers();
        if(t=='chats') loadChats();
        if(t=='profile') loadProfile();
    };
}

// HELPERS
function getAvatar(u, gender) {
    return `https://api.dicebear.com/7.x/avataaars/svg?seed=${u}&gender=${gender||'male'}`;
}
function formatTime(ts) {
    if(!ts) return "";
    const d = new Date(ts);
    return d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
}
function parseText(txt) {
    // Convert hashtags to clickable spans (logic for clicking handled by bubbling or simple alerts for now)
    return txt.replace(/#(\w+)/g, '<span class="hashtag">#$1</span>');
}

// CHAT LOGIC
function startChat(uid, name) {
    document.getElementById("userProfileModal").classList.add("hidden");
    document.getElementById("chat-room").classList.remove("hidden");
    document.getElementById("chatTitle").innerText = name;
    
    // PRESENCE LISTENER
    db.ref(`users/${uid}/presence`).on('value', snap => {
        const p = snap.val();
        const statusDiv = document.getElementById("chatStatus");
        if(p && p.state === 'online') statusDiv.innerText = "Online";
        else if(p && p.lastChanged) statusDiv.innerText = "Last seen " + new Date(p.lastChanged).toLocaleTimeString();
        else statusDiv.innerText = "Offline";
    });

    currentChatId = [currentUser.uid, uid].sort().join("_");
    
    // LOAD MESSAGES
    db.ref(`private_chats/${currentChatId}`).on('value', snap => {
        const div = document.getElementById("messages"); div.innerHTML="";
        if(snap.exists()) {
            snap.forEach(c => {
                const m = c.val();
                const isMine = m.senderId === currentUser.uid;
                const msgDiv = document.createElement("div");
                msgDiv.className = "message " + (isMine ? "you" : "them");
                
                // READ RECEIPT LOGIC
                let ticks = "";
                if(isMine) {
                    if(m.status === 'read') ticks = '<i class="fa-solid fa-check-double ticks read"></i>';
                    else if(m.status === 'delivered') ticks = '<i class="fa-solid fa-check-double ticks"></i>';
                    else ticks = '<i class="fa-solid fa-check ticks"></i>';
                } else {
                    // If I am viewing it, mark as read
                    if(m.status !== 'read') db.ref(`private_chats/${currentChatId}/${c.key}`).update({status: 'read'});
                }

                if(m.deleted) {
                    msgDiv.innerHTML = `<div class="msg-deleted"><i class="fa-solid fa-ban"></i> This message was deleted</div>`;
                } else {
                    const replyHtml = m.replyTo ? `<div class="reply-quote"><b>${m.replyTo.sender}</b>: ${m.replyTo.text}</div>` : '';
                    msgDiv.innerHTML = `${replyHtml} ${parseText(m.text)} 
                        <div class="msg-meta">${formatTime(m.time)} ${ticks}</div>`;
                    
                    // EVENTS (Delete/Reply)
                    msgDiv.onclick = () => {
                        if(confirm("Options: OK to Reply, Cancel to Delete (if yours)")) {
                            replyToMsg = { id: c.key, text: m.text, sender: isMine ? "You" : name };
                            document.getElementById("replyContext").classList.remove("hidden");
                            document.getElementById("replyingToName").innerText = replyToMsg.sender;
                            document.getElementById("replyingToText").innerText = replyToMsg.text;
                        } else if(isMine) {
                            if(confirm("Delete for everyone?")) db.ref(`private_chats/${currentChatId}/${c.key}`).update({deleted:true});
                        }
                    };
                }
                div.appendChild(msgDiv);
            });
        }
        div.scrollTop = div.scrollHeight;
    });
}

function cancelReply() {
    replyToMsg = null;
    document.getElementById("replyContext").classList.add("hidden");
}

// FEED LOGIC
function loadFeed() {
    const list = document.getElementById("feedList");
    db.ref('posts').limitToLast(50).get().then(async snap => {
        list.innerHTML = "";
        if(!snap.exists()) return;
        const posts=[]; snap.forEach(c=>posts.unshift({key:c.key, ...c.val()}));
        posts.forEach(p => {
            const d = document.createElement("div"); d.className = "post";
            const delBtn = (p.uid === currentUser.uid) ? `<span style="color:red; cursor:pointer; margin-left:auto;" onclick="deletePost('${p.key}')"><i class="fa-solid fa-trash"></i></span>` : '';
            d.innerHTML = `<img src="${getAvatar(p.username, 'male')}" class="avatar-xl"><div style="flex:1">
                <div class="post-header">${p.username} ${delBtn}</div>
                <div>${parseText(p.text)}</div>
            </div>`;
            list.appendChild(d);
        });
    });
}
window.deletePost = (pid) => { if(confirm("Delete post?")) db.ref(`posts/${pid}`).remove().then(loadFeed); };

// USERS & PROFILE
async function loadAllUsers() {
    const snap = await db.ref("users").get(); 
    const list = document.getElementById("usersList"); list.innerHTML="";
    snap.forEach(c => { 
        if(c.key !== currentUser.uid) {
            const u = c.val();
            const d = document.createElement("div"); d.className = "user-item";
            d.innerHTML = `<img src="${getAvatar(u.username, u.gender)}" class="avatar-xl"><div><b>${u.username}</b><br>${u.category}</div><button class="outline-btn small-btn" style="margin-left:auto;">View</button>`;
            d.onclick = () => openUser(c.key, u);
            list.appendChild(d);
        }
    });
}

async function openUser(uid, u) {
    document.getElementById("userProfileModal").classList.remove("hidden");
    document.getElementById("viewName").innerText = u.username;
    document.getElementById("viewCategory").innerText = u.category;
    document.getElementById("viewBio").innerText = u.bio || "";
    document.getElementById("viewAvatar").src = getAvatar(u.username, u.gender);
    
    const amI = (await db.ref(`followers/${uid}/${currentUser.uid}`).get()).exists();
    const isHe = (await db.ref(`followers/${currentUser.uid}/${uid}`).get()).exists();
    const fBtn = document.getElementById("followBtn");
    const mBtn = document.getElementById("messageBtn");
    
    fBtn.innerText = amI ? "Unfollow" : "Follow";
    fBtn.onclick = async () => {
        if(amI) { await db.ref(`followers/${uid}/${currentUser.uid}`).remove(); await db.ref(`following/${currentUser.uid}/${uid}`).remove(); }
        else { await db.ref(`followers/${uid}/${currentUser.uid}`).set(true); await db.ref(`following/${currentUser.uid}/${uid}`).set(true); }
        document.getElementById("userProfileModal").classList.add("hidden");
    };
    
    if(amI && isHe) { mBtn.disabled=false; mBtn.innerText="Chat"; mBtn.onclick=()=>startChat(uid, u.username); document.getElementById("mutualWarning").style.display="none";}
    else { mBtn.disabled=true; mBtn.innerText="Locked"; document.getElementById("mutualWarning").style.display="block";}
    
    document.getElementById("closeProfileModal").onclick = () => document.getElementById("userProfileModal").classList.add("hidden");
}

async function loadProfile() {
    const u = (await db.ref(`users/${currentUser.uid}`).get()).val();
    document.getElementById("myName").innerText = u.username;
    document.getElementById("myCategoryDisplay").innerText = u.category;
    document.getElementById("myBio").innerText = u.bio || "";
    document.getElementById("myAvatar").src = getAvatar(u.username, u.gender);
    const f1 = await db.ref(`followers/${currentUser.uid}`).get(); document.getElementById("myFollowersCount").innerText = f1.exists()?f1.numChildren():0;
    const f2 = await db.ref(`following/${currentUser.uid}`).get(); document.getElementById("myFollowingCount").innerText = f2.exists()?f2.numChildren():0;
}

function loadChats() {
    const list = document.getElementById("activeChatsList"); list.innerHTML="";
    db.ref(`following/${currentUser.uid}`).get().then(async snap => {
        if(!snap.exists()) return;
        Object.keys(snap.val()).forEach(async uid => {
            if((await db.ref(`followers/${currentUser.uid}/${uid}`).get()).exists()) {
                const u = (await db.ref(`users/${uid}`).get()).val();
                const d = document.createElement("div"); d.className="chat-item";
                d.innerHTML=`<img src="${getAvatar(u.username, u.gender)}" class="avatar-xl"><div><b>${u.username}</b></div>`;
                d.onclick = () => startChat(uid, u.username);
                list.appendChild(d);
            }
        });
    });
}
