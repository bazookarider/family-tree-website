// CYOU Chat (join fix + same features)
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import {
  getAuth, signInAnonymously, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, serverTimestamp,
  onSnapshot, query, orderBy, doc, setDoc, getDoc, updateDoc, arrayUnion
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey:"AIzaSyDJFQnwOs-fetKVy0Ow43vktz8xwefZMks",
  authDomain:"cyou-db8f0.firebaseapp.com",
  databaseURL:"https://cyou-db8f0-default-rtdb.firebaseio.com",
  projectId:"cyou-db8f0",
  storageBucket:"cyou-db8f0.firebasestorage.app",
  messagingSenderId:"873569975141",
  appId:"1:873569975141:web:147eb7b7b4043a38c9bf8c"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

signInAnonymously(auth);
onAuthStateChanged(auth, user => console.log("Anon:", user?.uid));

const joinSection = document.getElementById("joinSection");
const chatSection = document.getElementById("chatSection");
const nameInput = document.getElementById("nameInput");
const enterBtn = document.getElementById("enterBtn");
const joinHint = document.getElementById("joinHint");
const messagesDiv = document.getElementById("messages");
const typingStatus = document.getElementById("typingStatus");
const messageInput = document.getElementById("messageInput");
const sendForm = document.getElementById("sendForm");
const sendBtn = document.getElementById("sendBtn");
const onlineCount = document.getElementById("onlineCount");
const onlineUsersUL = document.getElementById("onlineUsers");
const clearChatBtn = document.getElementById("clearChatBtn");
const themeToggle = document.getElementById("themeToggle");

let username = localStorage.getItem("cyou_username") || "";
let messagesUnsub=null, presenceUnsub=null, typingUnsub=null;
let typingTimeout=null;

const messagesCol = collection(db,"cyou_messages");

// Theme
const savedTheme = localStorage.getItem("cyou_theme")||"light";
if(savedTheme==="dark")document.body.classList.add("dark");
themeToggle.onclick=()=>{document.body.classList.toggle("dark");localStorage.setItem("cyou_theme",document.body.classList.contains("dark")?"dark":"light");};

// Auto-login if nickname saved
if(username){
  joinSection.style.display="none";chatSection.style.display="flex";
  initPresence(username);
  initListeners();
}else{
  joinSection.style.display="flex";chatSection.style.display="none";
}

enterBtn.onclick=()=>joinChat();

async function joinChat(){
  const name=nameInput.value.trim();
  if(!name){joinHint.textContent="Enter nickname.";return;}
  try{
    const pRef=doc(db,"cyou_presence",name);
    const snap=await getDoc(pRef);
    if(snap.exists()&&snap.data().online){joinHint.textContent="Name already in use.";return;}
    username=name;
    localStorage.setItem("cyou_username",username);
    joinSection.style.display="none";chatSection.style.display="flex";
    joinHint.textContent="";
    Promise.allSettled([
      setDoc(pRef,{online:true,lastSeen:serverTimestamp()},{merge:true})
    ]);
    initPresence(username);
    initListeners();
  }catch(e){console.error(e);joinHint.textContent="Join failed.";}
}

function initPresence(name){
  const presRef=doc(db,"cyou_presence",name);
  window.addEventListener("beforeunload",()=>setDoc(presRef,{online:false,lastSeen:serverTimestamp()},{merge:true}));
  if(presenceUnsub)presenceUnsub();
  presenceUnsub=onSnapshot(collection(db,"cyou_presence"),snap=>{
    const list=snap.docs.map(d=>({id:d.id,...d.data()}));
    const online=list.filter(u=>u.online).length;
    onlineCount.textContent=online;
    onlineUsersUL.innerHTML="";
    list.forEach(u=>{
      const li=document.createElement("li");
      li.textContent=u.id+(u.online?" 🟢":" 🔘");
      onlineUsersUL.appendChild(li);
    });
  });
}

// typing indicator
messageInput.addEventListener("input",async()=>{
  if(!username)return;
  await setDoc(doc(db,"cyou_typing",username),{typing:true},{merge:true});
  clearTimeout(typingTimeout);
  typingTimeout=setTimeout(()=>setDoc(doc(db,"cyou_typing",username),{typing:false},{merge:true}),1500);
});
function initTyping(){
  if(typingUnsub)typingUnsub();
  typingUnsub=onSnapshot(collection(db,"cyou_typing"),snap=>{
    const typers=snap.docs.filter(d=>d.id!==username&&d.data().typing).map(d=>d.id);
    typingStatus.textContent=typers.length?`${typers[0]}'s typing...`:"";
  });
}

// messages
sendForm.addEventListener("submit",e=>{e.preventDefault();sendMessage();});
sendBtn.onclick=e=>{e.preventDefault();sendMessage();};

async function sendMessage(){
  const text=messageInput.value.trim();
  if(!text)return;
  await addDoc(messagesCol,{sender:username,text,createdAt:serverTimestamp(),deleted:false,delivered:false,seenBy:[username]});
  messageInput.value="";
  scrollBottom();
}

function initListeners(){
  initTyping();
  if(messagesUnsub)messagesUnsub();
  messagesUnsub=onSnapshot(query(messagesCol,orderBy("createdAt")),snap=>{
    messagesDiv.innerHTML="";
    snap.docs.forEach(async d=>{
      const m=d.data(),id=d.id;
      const div=document.createElement("div");
      const me=m.sender===username;
      div.className="message "+(me?"me":"other");
      if(m.deleted){div.innerHTML=`<div class='deleted'>⚫ This message was deleted</div><div class='meta'>${fmt(m.createdAt)}</div>`;}
      else{
        const body=document.createElement("div");body.className="msg-body";body.textContent=m.text;
        const meta=document.createElement("div");meta.className="meta";
        if(me){
          const time=document.createElement("span");time.textContent=fmt(m.createdAt);
          const tick=document.createElement("span");tick.className="tick"+(m.delivered?" delivered":"");tick.textContent=m.delivered?"✓✓":"✓";
          meta.append(time,tick);
          const del=document.createElement("button");del.className="msg-btn";del.textContent="🗑️";
          del.onclick=()=>updateDoc(doc(db,"cyou_messages",id),{deleted:true,text:""});
          const act=document.createElement("div");act.className="msg-actions";act.append(del);
          div.append(body,meta,act);
        }else{meta.textContent=fmt(m.createdAt);div.append(body,meta);}
      }
      messagesDiv.appendChild(div);
      if(m.sender!==username&&!m.delivered)updateDoc(doc(db,"cyou_messages",id),{delivered:true});
    });
    scrollBottom();
  });
}

function fmt(t){if(!t?.toDate)return"";const d=t.toDate();return d.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"});}
function scrollBottom(){setTimeout(()=>{messagesDiv.scrollTop=messagesDiv.scrollHeight;},100);}
clearChatBtn.onclick=()=>{messagesDiv.innerHTML="";};