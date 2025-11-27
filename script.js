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

const GEMINI_KEY = "AIzaSyD6XxzJPUP-6wh9yYh1T_NU0nvgjmGwFgA";
let db, auth, currentUser = null;
let currentChatId = null;
let replyToMsg = null; publicReplyToMsg = null;
let selectedMsg = null; 
let aiSelectedImage = null;

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
            initPublicChat(); // Start listening to public chat
        } else {
            document.getElementById("app-screen").classList.add("hidden");
            document.getElementById("auth-screen").classList.remove("hidden");
        }
    });

    // AI LOGIC
    document.getElementById("aiImageBtn").onclick = () => document.getElementById("aiImageInput").click();
    document.getElementById("aiImageInput").onchange = (e) => {
        const file = e.target.files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            aiSelectedImage = e.target.result.split(',')[1]; // Base64 data
            // Show preview
            let preview = document.getElementById("aiImagePreview");
            if(!preview) {
                preview = document.createElement("div"); preview.id = "aiImagePreview"; preview.className = "selected-image-preview";
                preview.innerHTML = `<img src="${e.target.result}"><i class="fa-solid fa-xmark" onclick="clearAiImage()"></i>`;
                document.getElementById("tab-ai").appendChild(preview);
            } else { preview.querySelector("img").src = e.target.result; }
        };
        reader.readAsDataURL(file);
    };

    document.getElementById("sendAiBtn").onclick = async () => {
        const txt = document.getElementById("aiInput").value.trim();
        if(!txt && !aiSelectedImage) return;
        
        let userContent = txt;
        if(aiSelectedImage) userContent = `<img src="data:image/jpeg;base64,${aiSelectedImage}"> ` + txt;

        addMessage("aiChatList", userContent, "you", true);
        document.getElementById("aiInput").value = "";
        clearAiImage();
        
        const loadId = "load"+Date.now();
        addMessage("aiChatList", "Thinking...", "them", false, loadId);
        
        try {
            let url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.0-pro:generateContent?key=${GEMINI_KEY}`;
            let payload = { contents: [{ parts: [{ text: txt }] }] };

            if(aiSelectedImage) {
                url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.0-pro-vision:generateContent?key=${GEMINI_KEY}`;
                payload = { contents: [{ parts: [{ text: txt }, { inline_data: { mime_type: "image/jpeg", data: aiSelectedImage } }] }] };
            }
            
            const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
            const data = await response.json();
            
            document.getElementById(loadId).remove();
            if(data.candidates && data.candidates.length > 0) {
                 addMessage("aiChatList", data.candidates[0].content.parts[0].text, "them", true);
            } else {
                 addMessage("aiChatList", "Sorry, I couldn't understand that.", "them");
            }

        } catch(e) {
            document.getElementById(loadId).remove();
            addMessage("aiChatList", "Error: " + e.message, "them");
        }
    };

    // BINDINGS (Auth, Nav, etc.)
    document.getElementById("loginBtn").onclick = () => auth.signInWithEmailAndPassword(document.getElementById("loginEmail").value, document.getElementById("loginPass").value).catch(e=>alert(e.message));
    document.getElementById("signupBtn").onclick = async () => {
        const name = document.getElementById("signupName").value.trim().replace(/\s/g, "");
        const email = document.getElementById("signupEmail").value; const pass = document.getElementById("signupPass").value; const gender = document.getElementById("signupGender").value;
        try {
            const chk = await db.ref(`usernames/${name}`).get(); if(chk.exists()) throw new Error("Username taken");
            const cred = await auth.createUserWithEmailAndPassword(email, pass);
            await db.ref(`users/${cred.user.uid}`).set({username: name, email, gender, category: "Member", joined: Date.now()});
            await db.ref(`usernames/${name}`).set(cred.user.uid);
        } catch(e) { alert(e.message); }
    };
    document.getElementById("logoutBtn").onclick = () => auth.signOut();
    document.getElementById("showSignup").onclick = () => { document.getElementById("loginForm").classList.add("hidden"); document.getElementById("signupForm").classList.remove("hidden"); };
    document.getElementById("showLogin").onclick = () => { document.getElementById("signupForm").classList.add("hidden"); document.getElementById("loginForm").classList.remove("hidden"); };
    document.getElementById("backToAppBtn").onclick = () => { document.getElementById("chat-room").classList.add("hidden"); currentChatId=null; db.ref(`private_chats/${currentChatId}`).off(); };
    document.getElementById("cancelReplyBtn").onclick = cancelReply;
    document.getElementById("cancelPublicReplyBtn").onclick = cancelPublicReply;

    // PRIVATE CHAT INPUT
    document.getElementById("inputForm").onsubmit = (e) => { e.preventDefault(); handleSend("messageInput", currentChatId, replyToMsg, cancelReply); };
    // PUBLIC CHAT INPUT
    document.getElementById("publicInputForm").onsubmit = (e) => { e.preventDefault(); handleSend("publicMessageInput", "public_chat", publicReplyToMsg, cancelPublicReply); };

    // Modals & Profile
    document.getElementById("userSearchInput").oninput = (e) => searchUsers(e.target.value);
    document.getElementById("closeProfileModal").onclick = () => document.getElementById("userProfileModal").classList.add("hidden");
    document.getElementById("closeMsgOptions").onclick = () => document.getElementById("msgOptionsModal").classList.add("hidden");
    document.getElementById("openEditProfileBtn").onclick = () => {
        document.getElementById("editProfileModal").classList.remove("hidden");
        document.getElementById("editUsername").value = currentUser.username; document.getElementById("editBio").value = currentUser.bio || "";
        document.getElementById("editCategory").value = currentUser.category || ""; document.getElementById("editGender").value = currentUser.gender || "male";
    };
    document.getElementById("saveProfileBtn").onclick = async () => {
        await db.ref(`users/${currentUser.uid}`).update({ username: document.getElementById("editUsername").value.trim(), bio: document.getElementById("editBio").value, category: document.getElementById("editCategory").value, gender: document.getElementById("editGender").value });
        document.getElementById("editProfileModal").classList.add("hidden"); loadProfile();
    };
    document.getElementById("cancelEditBtn").onclick = () => document.getElementById("editProfileModal").classList.add("hidden");

    // OPTIONS ACTIONS (Shared)
    document.getElementById("optReply").onclick = () => {
        const isPublic = selectedMsg.chatId === "public_chat";
        const replyObj = { text: selectedMsg.text, sender: selectedMsg.senderName, id: selectedMsg.key };
        if(isPublic) { publicReplyToMsg = replyObj; document.getElementById("publicReplyContext").classList.remove("hidden"); document.getElementById("publicReplyingToName").innerText = replyObj.sender; document.getElementById("publicReplyingToText").innerText = replyObj.text; document.getElementById("publicMessageInput").focus(); }
        else { replyToMsg = replyObj; document.getElementById("replyContext").classList.remove("hidden"); document.getElementById("replyingToName").innerText = replyObj.sender; document.getElementById("replyingToText").innerText = replyObj.text; document.getElementById("messageInput").focus(); }
        document.getElementById("msgOptionsModal").classList.add("hidden");
    };
    document.getElementById("optEdit").onclick = () => {
        const newT = prompt("Edit:", selectedMsg.text);
        if(newT) db.ref(`${selectedMsg.chatId}/${selectedMsg.key}`).update({text:newT});
        document.getElementById("msgOptionsModal").classList.add("hidden");
    };
    document.getElementById("optDelete").onclick = () => {
        if(confirm("Delete?")) db.ref(`${selectedMsg.chatId}/${selectedMsg.key}`).update({deleted:true, text:""});
        document.getElementById("msgOptionsModal").classList.add("hidden");
    };
}

// HELPER: Send Message (Public & Private)
function handleSend(inputId, destId, replyData, cancelFn) {
    const txt = document.getElementById(inputId).value.trim();
    if(txt && destId) {
        const payload = { senderId: currentUser.uid, senderName: currentUser.username, text: txt, time: firebase.database.ServerValue.TIMESTAMP, status: 'sent' };
        if(replyData) { payload.replyTo = replyData; cancelFn(); }
        db.ref(destId).push(payload);
        document.getElementById(inputId).value = "";
    }
}

// HELPER: Add Message to UI (Unified for AI, Private, Public)
function addMessage(listId, text, type, isHtml=false, id=null, meta=null, replyTo=null, msgKey=null, chatId=null) {
    const list = document.getElementById(listId);
    const div = document.createElement("div");
    div.className = `message ${type}`;
    if(id) div.id = id;

    let content = isHtml ? text : marked.parse(text);
    if(replyTo) content = `<div class="reply-quote"><b>${replyTo.sender}</b><br>${replyTo.text}</div>` + content;
    
    div.innerHTML = content;
    if(meta) {
        const metaDiv = document.createElement("div"); metaDiv.className = "msg-meta";
        metaDiv.innerHTML = meta;
        div.appendChild(metaDiv);
    }
    
    if(msgKey && chatId) {
        div.onclick = () => {
            selectedMsg = {key: msgKey, text: text, senderName: meta.includes("You")?currentUser.username:replyTo?.sender, chatId: chatId};
            document.getElementById("msgOptionsModal").classList.remove("hidden");
             const isMine = type === 'you';
            document.getElementById("optDelete").style.display = isMine ? "block" : "none";
            document.getElementById("optEdit").style.display = isMine ? "block" : "none";
        };
    }

    list.appendChild(div);
    scrollToBottom(listId);
    if(isHtml) Prism.highlightAllUnder(div);
}

function clearAiImage() { aiSelectedImage = null; const p = document.getElementById("aiImagePreview"); if(p) p.remove(); document.getElementById("aiImageInput").value = ""; }
function scrollToBottom(id) { const list = document.getElementById(id); list.scrollTop = list.scrollHeight; }

// PUBLIC CHAT
function initPublicChat() {
    const list = document.getElementById("publicChatList"); list.innerHTML = "";
    db.ref("public_chat").limitToLast(100).on("child_added", snap => {
        const m = snap.val(); const isMine = m.senderId === currentUser.uid;
        const meta = `${timeAgo(m.time)} · <b>${isMine ? 'You' : m.senderName}</b>`;
        if(m.deleted) addMessage("publicChatList", "🚫 Message deleted", isMine?"you":"them", false, null, meta, null, snap.key, "public_chat");
        else addMessage("publicChatList", m.text, isMine?"you":"them", false, null, meta, m.replyTo, snap.key, "public_chat");
    });
}

// PRIVATE CHAT
function startChat(uid, name) {
    document.getElementById("userProfileModal").classList.add("hidden");
    document.getElementById("chat-room").classList.remove("hidden");
    document.getElementById("chatTitle").innerText = name;
    db.ref(`users/${uid}/presence`).on('value', snap => {
        const s = snap.val();
        document.getElementById("chatStatus").innerText = (s && s.state === 'online') ? "Online" : "Last seen " + timeAgo(s?.lastChanged);
    });
    currentChatId = [currentUser.uid, uid].sort().join("_");
    const list = document.getElementById("messages"); list.innerHTML = "";
    db.ref(`private_chats/${currentChatId}`).off(); // Detach old listeners
    db.ref(`private_chats/${currentChatId}`).limitToLast(100).on('child_added', snap => {
        const m = snap.val(); const isMine = m.senderId === currentUser.uid;
        if(!isMine && m.status !== 'read') db.ref(`private_chats/${currentChatId}/${snap.key}`).update({status:'read'});
        let ticks = isMine ? (m.status === 'read' ? '<i class="fa-solid fa-check-double ticks read"></i>' : '<i class="fa-solid fa-check ticks"></i>') : '';
        const meta = `${timeAgo(m.time)} ${ticks}`;
         if(m.deleted) addMessage("messages", "🚫 Message deleted", isMine?"you":"them", false, null, meta, null, snap.key, currentChatId);
        else addMessage("messages", m.text, isMine?"you":"them", false, null, meta, m.replyTo, snap.key, currentChatId);
    });
}

function cancelReply() { replyToMsg=null; document.getElementById("replyContext").classList.add("hidden"); }
function cancelPublicReply() { publicReplyToMsg=null; document.getElementById("publicReplyContext").classList.add("hidden"); }

// OTHER FUNCTIONS (Profile, Search, etc.)
function getAvatar(u, gender) { return `https://api.dicebear.com/7.x/avataaars/svg?seed=${u}&gender=${gender||'male'}`; }
function timeAgo(ts) { if(!ts) return ''; return new Date(ts).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}); }
window.switchTab = (t) => {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.getElementById(`tab-${t}`).classList.remove('hidden');
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
    const map={'home':0, 'ai':1, 'discover':2, 'chats':3, 'profile':4};
    document.querySelectorAll('.nav-btn')[map[t]].classList.add('active');
    scrollToBottom(t === 'home' ? 'publicChatList' : 'aiChatList');
    if(t=='discover') { loadRecommended(); searchUsers(""); }
    if(t=='chats') loadActiveChats();
    if(t=='profile') loadProfile();
};
function loadRecommended() {
    const list = document.getElementById("recommendedList"); list.innerHTML = "Loading...";
    db.ref('users').limitToLast(5).get().then(snap => { list.innerHTML = ""; snap.forEach(c => { if(c.key !== currentUser.uid) renderUserItem(c.key, c.val(), list); }); });
}
function searchUsers(term) {
    const list = document.getElementById("usersList"); list.innerHTML = ""; if(!term) return;
    db.ref('users').get().then(snap => { snap.forEach(c => { const u = c.val(); if(u.username.toLowerCase().includes(term.toLowerCase()) && c.key !== currentUser.uid) renderUserItem(c.key, u, list); }); });
}
function renderUserItem(uid, u, container) {
    const d = document.createElement("div"); d.className = "user-item";
    d.innerHTML = `<img src="${getAvatar(u.username, u.gender)}" class="avatar-xl"><div style="flex:1"><b>${u.username}</b><br>${u.category}</div><button class="outline-btn small-btn">View</button>`;
    d.onclick = () => openUser(uid, u); container.appendChild(d);
}
async function openUser(uid, u) {
    document.getElementById("userProfileModal").classList.remove("hidden");
    document.getElementById("viewName").innerText = u.username; document.getElementById("viewCategory").innerText = u.category;
    document.getElementById("viewBio").innerText = u.bio; document.getElementById("viewAvatar").src = getAvatar(u.username, u.gender);
    const amI = (await db.ref(`followers/${uid}/${currentUser.uid}`).get()).exists(); const isHe = (await db.ref(`followers/${currentUser.uid}/${uid}`).get()).exists();
    const fBtn = document.getElementById("followBtn"); fBtn.innerText = amI ? "Unfollow" : "Follow";
    fBtn.onclick = async () => { if(amI) { await db.ref(`followers/${uid}/${currentUser.uid}`).remove(); await db.ref(`following/${currentUser.uid}/${uid}`).remove(); } else { await db.ref(`followers/${uid}/${currentUser.uid}`).set(true); await db.ref(`following/${currentUser.uid}/${uid}`).set(true); } document.getElementById("userProfileModal").classList.add("hidden"); };
    const mBtn = document.getElementById("messageBtn"); if(amI && isHe) { mBtn.disabled = false; mBtn.innerText = "Message"; mBtn.onclick = () => startChat(uid, u.username); } else { mBtn.disabled = true; mBtn.innerText = "Locked 🔒"; }
}
function loadProfile() { /* Profile loading logic remains, but posts part is obsolete for now */ }
function loadActiveChats() {
    const list = document.getElementById("activeChatsList"); list.innerHTML="";
    db.ref(`following/${currentUser.uid}`).get().then(async snap => {
        if(!snap.exists()) { list.innerHTML="<div style='padding:20px;text-align:center'>No friends</div>"; return; }
        Object.keys(snap.val()).forEach(async uid => {
            if((await db.ref(`followers/${currentUser.uid}/${uid}`).get()).exists()) {
                const u = (await db.ref(`users/${uid}`).get()).val();
                const d = document.createElement("div"); d.className="chat-item";
                d.innerHTML = `<img src="${getAvatar(u.username, u.gender)}" class="avatar-xl"><div><b>${u.username}</b><br>Tap to chat</div>`;
                d.onclick = () => startChat(uid, u.username); list.appendChild(d);
            }
        });
    });
}
