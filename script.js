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
                    db.ref(`users/${user.uid}/presence`).onDisconnect().set('offline');
                    db.ref(`users/${user.uid}/presence`).set('online');
                }
            });
            document.getElementById("auth-screen").classList.add("hidden");
            document.getElementById("app-screen").classList.remove("hidden");
            switchTab('home');
            initPublicChat();
        } else {
            document.getElementById("app-screen").classList.add("hidden");
            document.getElementById("auth-screen").classList.remove("hidden");
        }
    });

    // AI
    document.getElementById("aiImageBtn").onclick = () => document.getElementById("aiImageInput").click();
    document.getElementById("aiImageInput").onchange = (e) => {
        const file = e.target.files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            aiSelectedImage = e.target.result.split(',')[1];
            let p = document.getElementById("aiImagePreview");
            p.classList.remove("hidden");
            p.innerHTML=`<img src="${e.target.result}" width="50" height="50">`;
        };
        reader.readAsDataURL(file);
    };

    document.getElementById("sendAiBtn").onclick = async () => {
        const txt = document.getElementById("aiInput").value.trim();
        if(!txt && !aiSelectedImage) return;
        
        let content = txt;
        if(aiSelectedImage) content = "[Image Uploaded] " + txt;
        addMessage("aiChatList", content, "you");
        document.getElementById("aiInput").value = "";
        document.getElementById("aiImagePreview").classList.add("hidden");
        
        const loadId = "load"+Date.now();
        addMessage("aiChatList", "Thinking...", "them", loadId);
        
        try {
            let url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`;
            let payload = { contents: [{ parts: [{ text: txt }] }] };
            if(aiSelectedImage) {
                payload.contents[0].parts.push({ inline_data: { mime_type: "image/jpeg", data: aiSelectedImage } });
            }
            
            const res = await fetch(url, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(payload)});
            const data = await res.json();
            document.getElementById(loadId).remove();
            
            if(data.candidates) addMessage("aiChatList", data.candidates[0].content.parts[0].text, "them");
            else addMessage("aiChatList", "AI Error: No content.", "them");
            aiSelectedImage = null;
        } catch(e) { 
            document.getElementById(loadId).remove();
            addMessage("aiChatList", "Conn Error: " + e.message, "them"); 
        }
    };

    // CHAT INPUTS
    document.getElementById("publicInputForm").onsubmit = (e) => {
        e.preventDefault();
        const txt = document.getElementById("publicMessageInput").value.trim();
        if(txt) {
            db.ref("public_chat").push({ senderId: currentUser.uid, senderName: currentUser.username, text: txt, time: firebase.database.ServerValue.TIMESTAMP });
            document.getElementById("publicMessageInput").value = "";
        }
    };

    document.getElementById("inputForm").onsubmit = (e) => {
        e.preventDefault();
        const txt = document.getElementById("messageInput").value.trim();
        if(txt && currentChatId) {
            db.ref(`private_chats/${currentChatId}`).push({ senderId: currentUser.uid, text: txt, time: firebase.database.ServerValue.TIMESTAMP, status: 'sent' });
            document.getElementById("messageInput").value = "";
        }
    };
    
    // AUTH & NAV
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
    document.getElementById("showSignup").onclick = () => { document.getElementById("loginForm").classList.add("hidden"); document.getElementById("signupForm").classList.remove("hidden"); };
    document.getElementById("backToAppBtn").onclick = () => { document.getElementById("chat-room").classList.add("hidden"); currentChatId=null; };
    document.getElementById("userSearchInput").oninput = (e) => searchUsers(e.target.value);
    document.getElementById("closeProfileModal").onclick = () => document.getElementById("userProfileModal").classList.add("hidden");
    
    document.getElementById("openEditProfileBtn").onclick = () => {
        document.getElementById("editProfileModal").classList.remove("hidden");
        document.getElementById("editUsername").value = currentUser.username;
        document.getElementById("editBio").value = currentUser.bio || "";
        document.getElementById("editCategory").value = currentUser.category || "";
        document.getElementById("editGender").value = currentUser.gender || "male";
    };
    document.getElementById("saveProfileBtn").onclick = async () => {
        await db.ref(`users/${currentUser.uid}`).update({
            username: document.getElementById("editUsername").value.trim(),
            bio: document.getElementById("editBio").value,
            category: document.getElementById("editCategory").value,
            gender: document.getElementById("editGender").value
        });
        document.getElementById("editProfileModal").classList.add("hidden");
        loadProfile();
    };
    document.getElementById("cancelEditBtn").onclick = () => document.getElementById("editProfileModal").classList.add("hidden");
}

function getAvatar(u, gender) { return `https://api.dicebear.com/7.x/avataaars/svg?seed=${u}&gender=${gender||'male'}`; }

function addMessage(listId, text, type, id=null) {
    const list = document.getElementById(listId);
    const div = document.createElement("div");
    div.className = `message ${type}`;
    if(id) div.id = id;
    div.innerHTML = marked.parse(text);
    list.appendChild(div);
    list.scrollTop = list.scrollHeight;
}

function initPublicChat() {
    const list = document.getElementById("publicChatList"); list.innerHTML = "";
    db.ref("public_chat").limitToLast(100).on("child_added", snap => {
        const m = snap.val(); const isMine = m.senderId === currentUser.uid;
        addMessage("publicChatList", `<b>${m.senderName}</b>: ` + m.text, isMine?"you":"them");
    });
}

window.switchTab = (t) => {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.getElementById(`tab-${t}`).classList.remove('hidden');
    if(t=='discover') searchUsers("");
    if(t=='chats') loadActiveChats();
    if(t=='profile') loadProfile();
};

function searchUsers(term) {
    const list = document.getElementById("usersList"); list.innerHTML = ""; if(!term) return;
    db.ref('users').get().then(snap => { snap.forEach(c => { const u = c.val(); if(u.username.toLowerCase().includes(term.toLowerCase()) && c.key !== currentUser.uid) renderUserItem(c.key, u, list); }); });
}
function renderUserItem(uid, u, container) {
    const d = document.createElement("div"); d.className = "user-item";
    d.innerHTML = `<img src="${getAvatar(u.username, u.gender)}" class="avatar-xl"><div><b>${u.username}</b><br>${u.category}</div><button class="outline-btn small-btn" style="margin-left:auto;">View</button>`;
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

function startChat(uid, name) {
    document.getElementById("userProfileModal").classList.add("hidden");
    document.getElementById("chat-room").classList.remove("hidden");
    document.getElementById("chatTitle").innerText = name;
    currentChatId = [currentUser.uid, uid].sort().join("_");
    const list = document.getElementById("messages"); list.innerHTML = "";
    db.ref(`private_chats/${currentChatId}`).limitToLast(50).on('child_added', snap => {
        const m = snap.val(); const isMine = m.senderId === currentUser.uid;
        addMessage("messages", m.text, isMine?"you":"them");
    });
}

async function loadProfile() {
    const u = (await db.ref(`users/${currentUser.uid}`).get()).val();
    document.getElementById("myName").innerText = u.username;
    document.getElementById("myCategoryDisplay").innerText = u.category;
    document.getElementById("myBio").innerText = u.bio;
    document.getElementById("myAvatar").src = getAvatar(u.username, u.gender);
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
