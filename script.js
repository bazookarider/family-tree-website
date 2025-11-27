// Firebase config and initial setup
const firebaseConfig = { apiKey:"AIzaSyDJFQnwOs-fetKVy0Ow43vktz8xwefZMks", authDomain:"cyou-db8f0.firebaseapp.com", projectId:"cyou-db8f0", storageBucket:"cyou-db8f0.appspot.com", messagingSenderId:"873569975141", appId:"1:873569975141:web:147eb7b7b4043a38c9bf8c", measurementId:"G-T66B50HFJ8", databaseURL:"https://cyou-db8f0-default-rtdb.firebaseio.com/" };
const GEMINI_KEY="AIzaSyD6XxzJPUP-6wh9yYh1T_NU0nvgjmGwFgA";

let db, auth, currentUser=null;
let currentChatId=null, replyToMsg=null, publicReplyToMsg=null, selectedMsg=null, aiSelectedImage=null;
let typingTimeout=null;

// SAFE BIND
function safeBind(id,event,fn){const el=document.getElementById(id);if(el)el[event]=fn;}

// INIT
window.onload=function(){try{firebase.initializeApp(firebaseConfig);db=firebase.database();auth=firebase.auth();initApp();}catch(e){alert("Error: "+e.message);}};

// APP INIT
function initApp(){
auth.onAuthStateChanged(async user=>{
if(user){
const snap=await db.ref("users/${user.uid}").get();
currentUser={uid:user.uid,email:user.email,...(snap.val()||{})};
db.ref(".info/connected").on("value",snap=>{
if(snap.val()===true){
const con=db.ref("users/${user.uid}/presence");
con.onDisconnect().set({state:'offline',lastChanged:firebase.database.ServerValue.TIMESTAMP});
con.set({state:'online',lastChanged:firebase.database.ServerValue.TIMESTAMP});}});
if(document.getElementById("auth-screen")) document.getElementById("auth-screen").classList.add("hidden");
if(document.getElementById("app-screen")) document.getElementById("app-screen").classList.remove("hidden");
switchTab('home');initPublicChat();
}else{
if(document.getElementById("app-screen")) document.getElementById("app-screen").classList.add("hidden");
if(document.getElementById("auth-screen")) document.getElementById("auth-screen").classList.remove("hidden");}});

// AI LOGIC
safeBind("aiImageBtn","onclick",()=>document.getElementById("aiImageInput").click());
safeBind("aiImageInput","onchange",e=>{const file=e.target.files[0];if(!file)return;const reader=new FileReader();reader.onload=e=>{aiSelectedImage=e.target.result.split(',')[1];let p=document.getElementById("aiImagePreview");if(p){p.classList.remove("hidden");p.innerHTML="<img src="${e.target.result}"><i class="fa-solid fa-xmark" onclick="clearAi()"></i>";}};reader.readAsDataURL(file);});
safeBind("sendAiBtn","onclick",async ()=>{
const txt=document.getElementById("aiInput").value.trim();if(!txt&&!aiSelectedImage)return;
let content=txt;if(aiSelectedImage)content="<img src="data:image/jpeg;base64,${aiSelectedImage}"><br>"+txt;addMessage("aiChatList",content,"you",true);
document.getElementById("aiInput").value="";clearAi();
const loadId="load"+Date.now();addMessage("aiChatList","Thinking...","them",false,loadId);
try{
let url="https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}";
let payload={contents:[{parts:[{text:txt}]}]};if(aiSelectedImage)payload.contents[0].parts.push({inline_data:{mime_type:"image/jpeg",data:aiSelectedImage}});
const res=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
const data=await res.json();
const loadEl=document.getElementById(loadId);if(loadEl)loadEl.remove();
if(data.candidates&&data.candidates[0].content)addMessage("aiChatList",data.candidates[0].content.parts[0].text,"them",true);else addMessage("aiChatList","AI Error: No content.","them");
}catch(e){const loadEl=document.getElementById(loadId);if(loadEl)loadEl.remove();addMessage("aiChatList","Conn Error: "+e.message,"them");}});

// CHAT INPUTS
safeBind("publicInputForm","onsubmit",e=>{e.preventDefault();const txt=document.getElementById("publicMessageInput").value.trim();if(txt){const payload={senderId:currentUser.uid,senderName:currentUser.username,text:txt,time:firebase.database.ServerValue.TIMESTAMP};if(publicReplyToMsg){payload.replyTo=publicReplyToMsg;cancelPublicReply();}db.ref("public_chat").push(payload);document.getElementById("publicMessageInput").value="";}});
safeBind("inputForm","onsubmit",e=>{e.preventDefault();const txt=document.getElementById("messageInput").value.trim();if(txt&&currentChatId){const payload={senderId:currentUser.uid,text:txt,time:firebase.database.ServerValue.TIMESTAMP,status:'sent'};if(replyToMsg){payload.replyTo=replyToMsg;cancelReply();}db.ref("private_chats/${currentChatId}").push(payload);document.getElementById("messageInput").value="";}});

// AUTH & NAV
safeBind("loginBtn","onclick",()=>auth.signInWithEmailAndPassword(document.getElementById("loginEmail").value,document.getElementById("loginPass").value).catch(e=>alert(e.message)));
safeBind("signupBtn","onclick",async()=>{
const name=document.getElementById("signupName").value.trim().replace(/\s/g,"");const email=document.getElementById("signupEmail").value;const pass=document.getElementById("signupPass").value;const gender=document.getElementById("signupGender").value;
try{const chk=await db.ref("usernames/${name}").get();if(chk.exists())throw new Error("Username taken");const cred=await auth.createUserWithEmailAndPassword(email,pass);await db.ref("users/${cred.user.uid}").set({username:name,email,gender,category:"Member",joined:Date.now()});await db.ref("usernames/${name}").set(cred.user.uid);}catch(e){alert(e.message);}});
safeBind("logoutBtn","onclick",()=>auth.signOut());
safeBind("showSignup","onclick",()=>{document.getElementById("loginForm").classList.add("hidden");document.getElementById("signupForm").classList.remove("hidden");});
safeBind("showLogin","onclick",()=>{document.getElementById("signupForm").classList.add("hidden");document.getElementById("loginForm").classList.remove("hidden");});

// CHAT NAV
safeBind("backToAppBtn","onclick",()=>{document.getElementById("chat-room").classList.add("hidden");currentChatId=null;});
safeBind("cancelReplyBtn","onclick",cancelReply);
safeBind("closeProfileModal","onclick",()=>document.getElementById("userProfileModal").classList.add("hidden"));
safeBind("closeMsgOptions","onclick",()=>document.getElementById("msgOptionsModal").classList.add("hidden"));

// EDIT PROFILE
safeBind("openEditProfileBtn","onclick",()=>{document.getElementById("editProfileModal").classList.remove("hidden");document.getElementById("editUsername").value=currentUser.username;document.getElementById("editBio").value=currentUser.bio||"";document.getElementById("editCategory").value=currentUser.category||"";document.getElementById("editGender").value=currentUser.gender||"male";});
safeBind("saveProfileBtn","onclick",async()=>{await db.ref("users/${currentUser.uid}").update({username:document.getElementById("editUsername").value.trim(),bio:document.getElementById("editBio").value,category:document.getElementById("editCategory").value,gender:document.getElementById("editGender").value});document.getElementById("editProfileModal").classList.add("hidden");loadProfile();});
safeBind("cancelEditBtn","onclick",()=>document.getElementById("editProfileModal").classList.add("hidden"));

// MESSAGE OPTIONS
safeBind("optReply","onclick",()=>{
const replyObj={text:selectedMsg.text,sender:selectedMsg.senderName,id:selectedMsg.key};
if(selectedMsg.chatId==="public_chat"){publicReplyToMsg=replyObj;document.getElementById("publicReplyContext").classList.remove("hidden");document.getElementById("publicReplyingToName").innerText=replyObj.sender;document.getElementById("publicReplyingToText").innerText=replyObj.text;document.getElementById("publicMessageInput").focus();}else{replyToMsg=replyObj;document.getElementById("replyContext").classList.remove("hidden");document.getElementById("replyingToName").innerText=replyObj.sender;document.getElementById("replyingToText").innerText=replyObj.text;document.getElementById("messageInput").focus();}document.getElementById("msgOptionsModal").classList.add("hidden");});
safeBind("optCopy","onclick",()=>{navigator.clipboard.writeText(selectedMsg.text);document.getElementById("msgOptionsModal").classList.add("hidden");});
safeBind("optEdit","onclick",()=>{const newT=prompt("Edit:",selectedMsg.text);if(newT)db.ref("${selectedMsg.chatId}/${selectedMsg.key}").update({text:newT});document.getElementById("msgOptionsModal").classList.add("hidden");});
safeBind("optDelete","onclick",()=>{if(confirm("Delete?"))db.ref("${selectedMsg.chatId}/${selectedMsg.key}").update({deleted:true,text:""});document.getElementById("msgOptionsModal").classList.add("hidden");});

// UTIL FUNCTIONS
function clearAi(){aiSelectedImage=null;document.getElementById("aiImagePreview").classList.add("hidden");document.getElementById("aiImageInput").value="";}
function getAvatar(u,gender){return "https://api.dicebear.com/7.x/avataaars/svg?seed=${u}&gender=${gender||'male'}";}
function timeAgo(ts){if(!ts)return'';return new Date(ts).toLocaleString();}
function addMessage(listId,text,type,isHtml=false,id=null,meta=null,replyTo=null,msgKey=null,chatId=null){
const list=document.getElementById(listId);const div=document.createElement("div");div.className="message ${type}";if(id)div.id=id;
let content=isHtml?text:marked.parse(text);if(replyTo)content="<div class="reply-quote"><b>${replyTo.sender}</b><br>${replyTo.text}</div>"+content;
div.innerHTML=content;if(meta){const metaDiv=document.createElement("div");metaDiv.className="msg-meta";metaDiv.innerHTML=meta;div.appendChild(metaDiv);}
if(msgKey&&chatId){div.onclick=()=>{selectedMsg={key:msgKey,text:text,senderName:meta.includes("You")?currentUser.username:replyTo?.sender,chatId:chatId};document.getElementById("msgOptionsModal").classList.remove("hidden");const isMine=type==='you';document.getElementById("optDelete").style.display=isMine?"block":"none";document.getElementById("optEdit").style.display=isMine?"block":"none";};}
list.appendChild(div);list.scrollTop=list.scrollHeight;if(isHtml&&window.Prism)Prism.highlightAllUnder(div);
}
// CANCEL REPLIES
function cancelReply(){replyToMsg=null;document.getElementById("replyContext").classList.add("hidden");}
function cancelPublicReply(){publicReplyToMsg=null;document.getElementById("publicReplyContext").classList.add("hidden");}

// SWITCH TABS
function switchTab(tab){
document.querySelectorAll(".tab-content").forEach(t=>t.classList.add("hidden"));
document.querySelectorAll(".nav-btn").forEach(b=>b.classList.remove("active"));
document.getElementById(tab).classList.remove("hidden");
document.getElementById(tab+"Btn").classList.add("active");
if(tab==="chat") loadUserChats();
if(tab==="public") initPublicChat();
if(tab==="profile") loadProfile();
if(tab==="ai") loadAIHistory();
}

// LOAD PROFILE
async function loadProfile(){
if(!currentUser)return;
document.getElementById("profileUsername").innerText=currentUser.username;
document.getElementById("profileEmail").innerText=currentUser.email;
document.getElementById("profileBio").innerText=currentUser.bio||"No bio yet";
document.getElementById("profileCategory").innerText=currentUser.category||"Member";
document.getElementById("profileAvatar").src=getAvatar(currentUser.uid,currentUser.gender);
}

// LOAD USERS FOR CHAT
async function loadUserChats(){
const usersSnap=await db.ref("users").get();
const container=document.getElementById("chatUsersList");
container.innerHTML="";
usersSnap.forEach(snap=>{
if(snap.key!==currentUser.uid){
const u=snap.val();
const div=document.createElement("div");
div.className="user-item";
div.innerHTML="<img src="${getAvatar(snap.key,u.gender)}"><span>${u.username}</span><span class="status-dot ${u.presence?.state==='online'?'online':'offline'}"></span>";
div.onclick=()=>openChatWith(snap.key,u.username);
container.appendChild(div);
}
});
}

// OPEN CHAT
function openChatWith(uid,username){
currentChatId=uid;
document.getElementById("chat-room").classList.remove("hidden");
document.getElementById("chat-room-header").innerText=username;
loadChatMessages(uid);
}

// LOAD CHAT MESSAGES
function loadChatMessages(uid){
const chatList=document.getElementById("chatMessagesList");
chatList.innerHTML="";
db.ref("private_chats/${uid}").on("child_added",snap=>{
const m=snap.val();
addMessage("chatMessagesList",m.text,m.senderId===currentUser.uid?"you":"them",false,null,timeAgo(m.time),m.replyTo,snap.key,currentChatId);
});
}

// PUBLIC CHAT INIT
function initPublicChat(){
const publicList=document.getElementById("publicChatList");
publicList.innerHTML="";
db.ref("public_chat").on("child_added",snap=>{
const m=snap.val();
addMessage("publicChatList",m.text,m.senderId===currentUser.uid?"you":"them",false,null,timeAgo(m.time),m.replyTo,snap.key,"public_chat");
});
db.ref("public_chat_typing").on("value",snap=>{
const tEl=document.getElementById("publicTyping");
if(snap.exists()){
const typers=Object.values(snap.val()).filter(v=>v!==currentUser.uid);
tEl.innerText=typers.length>0?"${typers.join(", ")} typing...":"";
}else tEl.innerText="";
});
safeBind("publicMessageInput","oninput",()=>{db.ref("public_chat_typing/${currentUser.uid}").set(true);clearTimeout(typingTimeout);typingTimeout=setTimeout(()=>db.ref("public_chat_typing/${currentUser.uid}").remove(),1500);});
}

// AI HISTORY
async function loadAIHistory(){
const list=document.getElementById("aiChatList");
list.innerHTML="";
const histSnap=await db.ref("ai_history/${currentUser.uid}").get();
histSnap.forEach(snap=>{
const m=snap.val();
addMessage("aiChatList",m.text,m.type,false,null,timeAgo(m.time));
});
}

// MESSAGE META
function formatMeta(msg){let s="";if(msg.status)s+=msg.status; if(msg.time)s+=" | "+timeAgo(msg.time); return s;}

// UPDATE PRESENCE
function updatePresence(){if(!currentUser)return;const con=db.ref("users/${currentUser.uid}/presence");con.set({state:'online',lastChanged:firebase.database.ServerValue.TIMESTAMP});}

// MESSAGE INTERACTIONS
function showMsgOptions(msgEl,msgKey,chatId,text,sender){
selectedMsg={key:msgKey,text:text,senderName:sender,chatId:chatId};
document.getElementById("msgOptionsModal").classList.remove("hidden");
document.getElementById("optEdit").style.display=msgEl.classList.contains("you")?"block":"none";
document.getElementById("optDelete").style.display=msgEl.classList.contains("you")?"block":"none";
}

// UTILS
function scrollToBottom(el){el.scrollTop=el.scrollHeight;}
function createElem(tag,cls,html){const d=document.createElement(tag);if(cls)d.className=cls;if(html)d.innerHTML=html;return d;}
function parseHTML(str){const d=document.createElement('div');d.innerHTML=str;return d.firstChild;}

// FORWARD MESSAGE
function forwardMessage(msgKey,chatId){const msgRef=db.ref("${chatId}/${msgKey}");msgRef.get().then(snap=>{const m=snap.val();if(m)document.getElementById("messageInput").value=m.text;});}

// CLEANUP
window.onbeforeunload=function(){if(currentUser)db.ref("users/${currentUser.uid}/presence").set({state:'offline',lastChanged:firebase.database.ServerValue.TIMESTAMP});};
// SEND MESSAGE
safeBind("sendMessageBtn","onclick",()=>{
const txt=document.getElementById("messageInput").value.trim();
if(!txt||!currentChatId)return;
const payload={senderId:currentUser.uid,text:txt,time:firebase.database.ServerValue.TIMESTAMP,status:'sent'};
if(replyToMsg){payload.replyTo=replyToMsg;cancelReply();}
db.ref("private_chats/${currentChatId}").push(payload);
document.getElementById("messageInput").value="";
});

// SEND PUBLIC MESSAGE
safeBind("sendPublicBtn","onclick",()=>{
const txt=document.getElementById("publicMessageInput").value.trim();
if(!txt)return;
const payload={senderId:currentUser.uid,senderName:currentUser.username,text:txt,time:firebase.database.ServerValue.TIMESTAMP};
if(publicReplyToMsg){payload.replyTo=publicReplyToMsg;cancelPublicReply();}
db.ref("public_chat").push(payload);
document.getElementById("publicMessageInput").value="";
});

// MESSAGE OPTIONS
safeBind("optCopy","onclick",()=>{navigator.clipboard.writeText(selectedMsg.text);document.getElementById("msgOptionsModal").classList.add("hidden");});
safeBind("optDelete","onclick",()=>{if(confirm("Delete?"))db.ref("${selectedMsg.chatId}/${selectedMsg.key}").update({deleted:true,text:""});document.getElementById("msgOptionsModal").classList.add("hidden");});
safeBind("optEdit","onclick",()=>{const t=prompt("Edit:",selectedMsg.text);if(t)db.ref("${selectedMsg.chatId}/${selectedMsg.key}").update({text:t});document.getElementById("msgOptionsModal").classList.add("hidden");});
safeBind("optReply","onclick",()=>{
if(selectedMsg.chatId==="public_chat"){publicReplyToMsg={text:selectedMsg.text,sender:selectedMsg.sender,id:selectedMsg.key};document.getElementById("publicReplyContext").classList.remove("hidden");document.getElementById("publicReplyingToName").innerText=selectedMsg.sender;document.getElementById("publicReplyingToText").innerText=selectedMsg.text;document.getElementById("publicMessageInput").focus();}
else{replyToMsg={text:selectedMsg.text,sender:selectedMsg.sender,id:selectedMsg.key};document.getElementById("replyContext").classList.remove("hidden");document.getElementById("replyingToName").innerText=selectedMsg.sender;document.getElementById("replyingToText").innerText=selectedMsg.text;document.getElementById("messageInput").focus();}
document.getElementById("msgOptionsModal").classList.add("hidden");
});

// AI IMAGE HANDLER
safeBind("aiImageBtn","onclick",()=>document.getElementById("aiImageInput").click());
safeBind("aiImageInput","onchange",(e)=>{
const file=e.target.files[0];if(!file)return;
const reader=new FileReader();
reader.onload=(ev)=>{
aiSelectedImage=ev.target.result.split(',')[1];
const p=document.getElementById("aiImagePreview");if(p){p.classList.remove("hidden");p.innerHTML="<img src="${ev.target.result}"><i class="fa-solid fa-xmark" onclick="clearAi()"></i>";}
};
reader.readAsDataURL(file);
});
safeBind("sendAiBtn","onclick",async()=>{
const txt=document.getElementById("aiInput").value.trim();
if(!txt&&!aiSelectedImage)return;
let content=txt;if(aiSelectedImage)content="<img src="data:image/jpeg;base64,${aiSelectedImage}"><br>"+txt;
addMessage("aiChatList",content,"you",true);
document.getElementById("aiInput").value="";clearAi();
const loadId="load"+Date.now();addMessage("aiChatList","Thinking...","them",false,loadId);
try{
let url="https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}";
let payload={contents:[{parts:[{text:txt}]}]};
if(aiSelectedImage)payload.contents[0].parts.push({inline_data:{mime_type:"image/jpeg",data:aiSelectedImage}});
const res=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
const data=await res.json();
const loadEl=document.getElementById(loadId);if(loadEl)loadEl.remove();
if(data.candidates&&data.candidates[0].content)addMessage("aiChatList",data.candidates[0].content.parts[0].text,"them",true);
else addMessage("aiChatList","AI Error: No content.","them");
}catch(e){const loadEl=document.getElementById(loadId);if(loadEl)loadEl.remove();addMessage("aiChatList","Conn Error: "+e.message,"them");}
});

// CLEAR AI IMAGE
function clearAi(){aiSelectedImage=null;document.getElementById("aiImagePreview").classList.add("hidden");document.getElementById("aiImageInput").value="";}

// UTILS
function getAvatar(u,g){return"https://api.dicebear.com/7.x/avataaars/svg?seed=${u}&gender=${g||'male'}";}
function timeAgo(ts){if(!ts)return"";const d=new Date(ts);return"${d.toLocaleDateString()} ${d.toLocaleTimeString()}";}
function parseText(t){return t.replace(/#(\w+)/g,'<span class="hashtag">#$1</span>');}
function addMessage(listId,text,type,isHtml=false,id=null,meta=null,replyTo=null,msgKey=null,chatId=null){
const list=document.getElementById(listId);const div=document.createElement("div");div.className="message ${type}";if(id)div.id=id;
let content=isHtml?text:marked.parse(text);
if(replyTo)content="<div class="reply-quote"><b>${replyTo.sender}</b><br>${replyTo.text}</div>"+content;
div.innerHTML=content;if(meta){const md=document.createElement("div");md.className="msg-meta";md.innerHTML=meta;div.appendChild(md);}
if(msgKey&&chatId){div.onclick=()=>{selectedMsg={key:msgKey,text:text,senderName:meta.includes("You")?currentUser.username:replyTo?.sender,chatId:chatId};
document.getElementById("msgOptionsModal").classList.remove("hidden");
const isMine=type==="you";document.getElementById("optDelete").style.display=isMine?"block":"none";document.getElementById("optEdit").style.display=isMine?"block":"none";};}
list.appendChild(div);list.scrollTop=list.scrollHeight;if(isHtml&&window.Prism)Prism.highlightAllUnder(div);}