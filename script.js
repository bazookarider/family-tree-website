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

let GEMINI_KEY = "AIzaSyD6XxzJPUP-6wh9yYh1T_NU0nvgjmGwFgA";
let db, auth, currentUser = null;
let currentChatId = null;
let aiSelectedImage = null;
let selectedMsg = null;

window.onload = function() {
    try {
        firebase.initializeApp(firebaseConfig);
        db = firebase.database();
        auth = firebase.auth();
        initApp();
    } catch(e) { alert("Error: " + e.message); }
};

function initApp() {
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            const snap = await db.ref(`users/${user.uid}`).get();
            currentUser = { uid: user.uid, email: user.email, ...(snap.val() || {}) };
            
            // Presence
            db.ref(".info/connected").on("value", (snap) => {
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

    // AI
    document.getElementById("aiSettingsBtn").onclick = () => {
        const k = prompt("API Key:", GEMINI_KEY);
        if(k) GEMINI_KEY = k;
    };
    document.getElementById("aiImageBtn").onclick = () => document.getElementById("aiImageInput").click();
    document.getElementById("aiImageInput").onchange = (e) => {
        const file = e.target.files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            aiSelectedImage = e.target.result.split(',')[1];
            let p = document.getElementById("aiImagePreview");
            if(!p) {
                p = document.createElement("div"); p.id="aiImagePreview"; p.className="selected-image-preview";
                p.innerHTML=`<img src="${e.target.result}"><i class="fa-solid fa-xmark" onclick="clearAi()"></i>`;
                document.getElementById("tab-ai").appendChild(p);
            } else p.querySelector("img").src = e.target.result;
        };
        reader.readAsDataURL(file);
    };
    document.getElementById("sendAiBtn").onclick = async () => {
        const txt = document.getElementById("aiInput").value.trim();
        if(!txt && !aiSelectedImage) return;
        
        let content = txt;
        if(aiSelectedImage) content = `<img src="data:image/jpeg;base64,${aiSelectedImage}"><br>` + txt;
        addMessage("aiChatList", content, "you", true);
        
        document.getElementById("aiInput").value = "";
        clearAi();
        
        const loadId = "load"+Date.now();
        addMessage("aiChatList", "Thinking...", "them", false, loadId);
        
        try {
            let url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`;
            let payload = { contents: [{ parts: [{ text: txt }] }] };
            if(aiSelectedImage) {
                payload.contents[0].parts.push({ inline_data: { mime_type: "image/jpeg", data: aiSelectedImage } });
            }
            const res = await fetch(url, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(payload)});
            const data = await res.json();
            document.getElementById(loadId).remove();
            
            if(data.candidates) addMessage("aiChatList", data.candidates[0].content.parts[0].text, "them", true);
            else addMessage("aiChatList", "Error: No response.", "them");
        } catch(e) { 
            document.getElementById(loadId).remove();
            addMessage("aiChatList", "Error: " + e.message, "them"); 
        }
    };

    // BINDINGS
    document.getElementById("loginBtn").onclick = () => auth.signInWithEmailAndPassword(document.getElementById("loginEmail").value, document.getElementById("loginPass").value).catch(e=>alert(e.message));
    document.getElementById("signupBtn").onclick = async () => {
        const name = document.getElementById("signupName").value.trim().replace(/\s/g, "");
        const email = document.getElementById("signupEmail").value;
        const pass = document.getElementById("signupPass").value;
        try {
            const chk = await db.ref(`usernames/${name}`).get();
            if(chk.exists()) throw new Error("Username taken");
            const cred = await auth.createUserWithEmailAndPassword(email, pass);
            await db.ref(`users/${cred.user.uid}`).set({username: name, email: email, category: "Member", joined: Date.now()});
            await db.ref(`usernames/${name}`).set(cred.user.uid);
        } catch(e) { alert(e.message); }
    };
    document.getElementById("logoutBtn").onclick = () => auth.signOut();
    document.getElementById("showSignup").onclick = () => { document.getElementById("loginForm").classList.add("hidden"); document.getElementById("signupForm").classList.remove("hidden"); };
    document.getElementById("showLogin").onclick = () => { document.getElementById("signupForm").classList.add("hidden"); document.getElementById("loginForm").classList.remove("hidden"); };

    document.getElementById("postBtn").onclick = async () => {
        const txt = document.getElementById("newPostText").value.trim();
        if(!txt) return;
        await db.ref('posts').push({ uid: currentUser.uid, username: currentUser.username, text: txt, time: firebase.database.ServerValue.TIMESTAMP });
        document.getElementById("newPostText").value = "";
        loadFeed();
    };
    document.getElementById("refreshFeedBtn").onclick = loadFeed;

    document.getElementById("inputForm").onsubmit = (e) => {
        e.preventDefault();
        const txt = document.getElementById("messageInput").value.trim();
        if(txt && currentChatId) {
            db.ref(`private_chats/${currentChatId}`).push({
                senderId: currentUser.uid, text: txt, time: firebase.database.ServerValue.TIMESTAMP, status: 'sent'
            });
            document.getElementById("messageInput").value = "";
        }
    };
    document.getElementById("backToAppBtn").onclick = () => { document.getElementById("chat-room").classList.add("hidden"); currentChatId=null; };

    document.getElementById("userSearchInput").oninput = (e) => searchUsers(e.target.value);
    document.getElementById("closeProfileModal").onclick = () => document.getElementById("userProfileModal").classList.add("hidden");
    document.getElementById("closeCommentModal").onclick = () => document.getElementById("commentModal").classList.add("hidden");
    document.getElementById("closeMsgOptions").onclick = () => document.getElementById("msgOptionsModal").classList.add("hidden");
    document.getElementById("sendCommentBtn").onclick = async () => {
        const t = document.getElementById("commentInput").value.trim();
        if(t && selectedMsg) {
            await db.ref(`posts/${selectedMsg}/comments`).push({uid:currentUser.uid, username:currentUser.username, text:t});
            document.getElementById("commentInput").value="";
            loadComments(selectedMsg);
        }
    };
}

function clearAi() { aiSelectedImage = null; const p = document.getElementById("aiImagePreview"); if(p) p.remove(); }
function getAvatar(u) { return `https://ui-avatars.com/api/?name=${u}&background=006677&color=fff&bold=true`; }
function timeAgo(ts) { if(!ts) return ''; return new Date(ts).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}); }
function parseText(t) { return t.replace(/#(\w+)/g, '<span class="hashtag">#$1</span>'); }

function addMessage(listId, text, type, isHtml=false, id=null) {
    const list = document.getElementById(listId);
    const div = document.createElement("div");
    div.className = `message ${type}`;
    if(id) div.id = id;
    if(isHtml) div.innerHTML = marked.parse(text); else div.innerText = text;
    list.appendChild(div);
    list.scrollTop = list.scrollHeight;
    if(isHtml) Prism.highlightAllUnder(div);
}

window.switchTab = (t) => {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.getElementById(`tab-${t}`).classList.remove('hidden');
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
    const map={'home':0, 'ai':1, 'discover':2, 'chats':3, 'profile':4};
    document.querySelectorAll('.nav-btn')[map[t]].classList.add('active');
    if(t=='home') loadFeed();
    if(t=='discover') { loadRecommended(); searchUsers(""); }
    if(t=='chats') loadActiveChats();
    if(t=='profile') loadProfile();
};

function loadFeed() {
    const list = document.getElementById("feedList"); list.innerHTML = "";
    db.ref('posts').limitToLast(50).get().then(async snap => {
        if(!snap.exists()) { list.innerHTML = "<div style='text-align:center; padding:20px; color:#999'>No posts</div>"; return; }
        const posts = []; snap.forEach(c => posts.unshift({key:c.key, ...c.val()}));
        posts.forEach(p => {
            const d = document.createElement("div"); d.className = "post";
            d.innerHTML = `<img src="${getAvatar(p.username)}" class="avatar-xl"><div style="flex:1"><div class="post-header"><span>${p.username}</span></div><div class="post-text">${parseText(p.text)}</div><div class="post-actions"><div class="action-btn" onclick="openComments('${p.key}')"><i class="fa-regular fa-comment"></i></div><span style="font-size:0.8rem; margin-left:auto;">${timeAgo(p.time)}</span></div></div>`;
            list.appendChild(d);
        });
    });
}
window.openComments = (pid) => { selectedMsg = pid; document.getElementById("commentModal").classList.remove("hidden"); loadComments(pid); };
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

function loadRecommended() {
    const list = document.getElementById("recommendedList"); list.innerHTML = "Loading...";
    db.ref('users').limitToLast(5).get().then(snap => {
        list.innerHTML = "";
        snap.forEach(c => { if(c.key !== currentUser.uid) renderUserItem(c.key, c.val(), list); });
    });
}
function searchUsers(term) {
    const list = document.getElementById("usersList"); list.innerHTML = "";
    if(!term) return;
    db.ref('users').get().then(snap => {
        snap.forEach(c => {
            const u = c.val();
            if(u.username.toLowerCase().includes(term.toLowerCase()) && c.key !== currentUser.uid) renderUserItem(c.key, u, list);
        });
    });
}
function renderUserItem(uid, u, container) {
    const d = document.createElement("div"); d.className = "user-item";
    d.innerHTML = `<img src="${getAvatar(u.username)}" class="avatar-xl"><div style="flex:1"><b>${u.username}</b><br>${u.category}</div><button class="outline-btn small-btn">View</button>`;
    d.onclick = () => openUser(uid, u);
    container.appendChild(d);
}

async function openUser(uid, u) {
    document.getElementById("userProfileModal").classList.remove("hidden");
    document.getElementById("viewName").innerText = u.username;
    document.getElementById("viewCategory").innerText = u.category;
    document.getElementById("viewBio").innerText = u.bio;
    document.getElementById("viewAvatar").src = getAvatar(u.username);
    
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

function startChat(uid, name) {
    document.getElementById("userProfileModal").classList.add("hidden");
    document.getElementById("chat-room").classList.remove("hidden");
    document.getElementById("chatTitle").innerText = name;
    
    db.ref(`users/${uid}/presence`).on('value', snap => {
        const s = snap.val();
        document.getElementById("chatStatus").innerText = (s && s.state === 'online') ? "Online" : "Offline";
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
                
                let ticks = "";
                if(isMine) {
                    if(m.status === 'read') ticks = '<i class="fa-solid fa-check-double ticks read"></i>';
                    else ticks = '<i class="fa-solid fa-check ticks"></i>';
                } else {
                    if(m.status !== 'read') db.ref(`private_chats/${currentChatId}/${c.key}`).update({status:'read'});
                }
                
                d.innerHTML = `${parseText(m.text)} <div class="msg-meta">${timeAgo(m.time)} ${isMine?ticks:''}</div>`;
                div.appendChild(d);
            });
        }
        div.scrollTop = div.scrollHeight;
    });
}

async function loadProfile() {
    const u = (await db.ref(`users/${currentUser.uid}`).get()).val();
    document.getElementById("myName").innerText = u.username;
    document.getElementById("myCategoryDisplay").innerText = u.category;
    document.getElementById("myBio").innerText = u.bio;
    document.getElementById("myAvatar").src = getAvatar(u.username);
    
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
    const list = document.getElementById("activeChatsList"); list.innerHTML="";
    db.ref(`following/${currentUser.uid}`).get().then(async snap => {
        if(!snap.exists()) { list.innerHTML="<div style='padding:20px;text-align:center'>No friends</div>"; return; }
        Object.keys(snap.val()).forEach(async uid => {
            if((await db.ref(`followers/${currentUser.uid}/${uid}`).get()).exists()) {
                const u = (await db.ref(`users/${uid}`).get()).val();
                const d = document.createElement("div"); d.className="chat-item";
                d.innerHTML = `<img src="${getAvatar(u.username)}" class="avatar-xl"><div><b>${u.username}</b><br>Tap to chat</div>`;
                d.onclick = () => startChat(uid, u.username);
                list.appendChild(d);
            }
        });
    });
}
