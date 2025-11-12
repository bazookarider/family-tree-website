import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import {
  getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, serverTimestamp, onSnapshot, query, orderBy, doc, setDoc, updateDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

/* Firebase Config */
const firebaseConfig = {
  apiKey: "AIzaSyDJFQnwOs-fetKVy0Ow43vktz8xwefZMks",
  authDomain: "cyou-db8f0.firebaseapp.com",
  projectId: "cyou-db8f0",
  storageBucket: "cyou-db8f0.firebasestorage.app",
  messagingSenderId: "873569975141",
  appId: "1:873569975141:web:147eb7b7b4043a38c9bf8c"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

/* DOM */
const authSection = document.getElementById("authSection");
const chatSection = document.getElementById("chatSection");
const googleSignInBtn = document.getElementById("googleSignInBtn");
const authHint = document.getElementById("authHint");

const messageInput = document.getElementById("messageInput");
const sendForm = document.getElementById("sendForm");
const messagesDiv = document.getElementById("messages");
const typingIndicator = document.getElementById("typingIndicatorBottom");
const onlineCount = document.getElementById("onlineCount");
const onlineUsersList = document.getElementById("onlineUsers");
const themeToggle = document.getElementById("themeToggle");
const clearChatBtn = document.getElementById("clearChatBtn");

let username = localStorage.getItem("cyou_username") || "";
let typingTimeout;

/* THEME TOGGLE */
themeToggle.addEventListener("click",()=>{
  document.body.classList.toggle("dark");
  localStorage.setItem("cyou_theme", document.body.classList.contains("dark") ? "dark" : "");
});
if(localStorage.getItem("cyou_theme")==="dark") document.body.classList.add("dark");

/* GOOGLE SIGN-IN */
googleSignInBtn.addEventListener("click", async () => {
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    username = user.email;
    localStorage.setItem("cyou_username", username);
    joinChat();
  } catch (err) {
    authHint.textContent = err.message;
  }
});

/* AUTO LOGIN */
onAuthStateChanged(auth, user => {
  if (user && user.email) {
    username = user.email;
    localStorage.setItem("cyou_username", username);
    joinChat();
  }
});

/* JOIN CHAT */
function joinChat() {
  authSection.style.display = "none";
  chatSection.style.display = "flex";
  addPresence(); listenForMessages(); listenForTyping();
}

/* SEND MESSAGE */
sendForm.addEventListener("submit", async e=>{
  e.preventDefault();
  const text = messageInput.value.trim();
  if(!text) return;
  const msg={name:username,text,createdAt:serverTimestamp(),deleted:false};
  const docRef=await addDoc(collection(db,"cyou_messages"),msg);
  await updateDoc(doc(db,"cyou_messages",docRef.id),{id:docRef.id});
  messageInput.value=""; setTyping(false);
});

/* LISTEN MESSAGES */
function listenForMessages(){
  const q=query(collection(db,"cyou_messages"),orderBy("createdAt"));
  onSnapshot(q,snap=>{
    messagesDiv.innerHTML="";
    snap.docs.forEach(docSnap=>{
      const msg=docSnap.data();
      const isYou=msg.name===username;
      const div=document.createElement("div");
      div.classList.add("message",isYou?"me":"other");
      if(msg.deleted) div.innerHTML=`<em>Message deleted</em>`;
      else div.innerHTML=`<strong>${msg.name}</strong><br>${msg.text}<span class="meta">${new Date(msg.createdAt?.toDate?.()||Date.now()).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</span>`;
      if(isYou && !msg.deleted){
        const delBtn=document.createElement("button");
        delBtn.textContent="🗑";
        delBtn.classList.add("msg-btn");
        delBtn.onclick=async()=>{ await updateDoc(doc(db,"cyou_messages",docSnap.id),{deleted:true}); };
        div.appendChild(delBtn);
      }
      messagesDiv.appendChild(div);
    });
    messagesDiv.scrollTop=messagesDiv.scrollHeight;
  });
}

/* PRESENCE */
async function addPresence(){
  const userRef=doc(db,"cyou_presence",username);
  await setDoc(userRef,{online:true});
  onSnapshot(collection(db,"cyou_presence"),snap=>{
    const users=snap.docs.filter(d=>d.data().online);
    onlineCount.textContent=users.length; onlineUsersList.innerHTML="";
    users.forEach(d=>{ const li=document.createElement("li"); li.textContent=d.id; onlineUsersList.appendChild(li); });
  });
  window.addEventListener("beforeunload",()=>deleteDoc(userRef));
}

/* TYPING INDICATOR */
messageInput.addEventListener("input",handleTyping);
async function handleTyping(){ setTyping(true); clearTimeout(typingTimeout); typingTimeout=setTimeout(()=>setTyping(false),2000); }
async function setTyping(state){ await setDoc(doc(db,"cyou_typing",username),{typing:state}); }
function listenForTyping(){
  onSnapshot(collection(db,"cyou_typing"),snap=>{
    const typers=snap.docs.map(d=>({name:d.id,...d.data()})).filter(d=>d.typing && d.name!==username);
    typingIndicator.textContent=typers.length ? `${typers.map(t=>t.name+" is typing...").join(", ")}` : "";
  });
}

/* CLEAR CHAT */
clearChatBtn.addEventListener("click", async ()=>{
  const snap = await (await import("https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js")).getDocs(collection(db,"cyou_messages"));
  snap.forEach(d=>deleteDoc(doc(db,"cyou_messages",d.id)));
});