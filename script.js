 import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, fetchSignInMethodsForEmail
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

/* DOM */
const authSection = document.getElementById("authSection");
const chatSection = document.getElementById("chatSection");
const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");
const registerBtn = document.getElementById("registerBtn");
const loginBtn = document.getElementById("loginBtn");
const switchLink = document.getElementById("switchLink");
const authTitle = document.getElementById("authTitle");
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
let currentTheme = localStorage.getItem("cyou_theme") || "";

/* THEME */
function applyTheme(theme) {
  document.body.classList.remove("dark","dim");
  if(theme) document.body.classList.add(theme);
  currentTheme = theme;
  localStorage.setItem("cyou_theme", theme);
}
if(currentTheme) applyTheme(currentTheme);
themeToggle.addEventListener("click",()=>{
  if(document.body.classList.contains("dark")) applyTheme("");
  else if(document.body.classList.contains("dim")) applyTheme("dark");
  else applyTheme("dim");
});

/* SWITCH AUTH */
function switchToLogin(){ authTitle.textContent="Login"; registerBtn.style.display="none"; loginBtn.style.display="block"; switchLink.textContent="Register"; }
function switchToRegister(){ authTitle.textContent="Register"; registerBtn.style.display="block"; loginBtn.style.display="none"; switchLink.textContent="Login"; }
switchLink.addEventListener("click",(e)=>{ e.preventDefault(); authTitle.textContent==="Register"?switchToLogin():switchToRegister(); });

/* REGISTER */
registerBtn.addEventListener("click", async ()=>{
  const email=emailInput.value.trim(), password=passwordInput.value.trim();
  if(!email || !password) return authHint.textContent="Fill all fields";

  try{
    const methods = await fetchSignInMethodsForEmail(auth,email);
    if(methods.length>0){ authHint.textContent="Email already registered. Login instead."; switchToLogin(); return; }
    const userCred = await createUserWithEmailAndPassword(auth,email,password);
    username = email; localStorage.setItem("cyou_username",username);
    joinChat();
  }catch(err){ authHint.textContent=err.message; }
});

/* LOGIN */
loginBtn.addEventListener("click", async ()=>{
  const email=emailInput.value.trim(), password=passwordInput.value.trim();
  if(!email || !password) return authHint.textContent="Fill all fields";

  try{
    const userCred = await signInWithEmailAndPassword(auth,email,password);
    username = email; localStorage.setItem("cyou_username",username);
    joinChat();
  }catch(err){
    if(err.code==="auth/user-not-found") authHint.textContent="User not found. Register first.";
    else if(err.code==="auth/wrong-password") authHint.textContent="Wrong password.";
    else authHint.textContent=err.message;
  }
});

/* AUTO LOGIN */
onAuthStateChanged(auth, user=>{ if(user && username) joinChat(); });

/* JOIN CHAT */
function joinChat(){
  authSection.style.display="none";
  chatSection.style.display="flex";
  addPresence(); listenForMessages(); listenForTyping();
}

/* SEND MESSAGE */
sendForm.addEventListener("submit", async e=>{
  e.preventDefault(); const text=messageInput.value.trim();
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
    snap.forEach(docSnap=>{
      const msg=docSnap.data(); const isYou=msg.name===username;
      const div=document.createElement("div"); div.classList.add("message",isYou?"me":"other");
      if(msg.deleted) div.innerHTML=`<em>Message deleted</em>`;
      else div.innerHTML=`<strong>${msg.name}</strong><br>${msg.text}<span class="meta">${new Date(msg.createdAt?.toDate?.()||Date.now()).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</span>`;
      if(isYou && !msg.deleted){ const delBtn=document.createElement("button"); delBtn.textContent="🗑"; delBtn.classList.add("msg-btn"); delBtn.onclick=async()=>{ await updateDoc(doc(db,"cyou_messages",docSnap.id),{deleted:true}); }; div.appendChild(delBtn); }
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

/* TYPING */
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
  const q=query(collection(db,"cyou_messages"));
  onSnapshot(q,snap=>{ snap.docs.forEach(d=>deleteDoc(doc(db,"cyou_messages",d.id))); });
});