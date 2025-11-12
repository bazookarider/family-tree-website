import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import {
  getAuth, signInAnonymously, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, serverTimestamp, query, orderBy, onSnapshot,
  doc, setDoc, getDoc, where
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

// Your Saved Firebase Config
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

// --- DOM ELEMENTS ---
const joinScreen = document.getElementById("joinScreen");
const chatApp = document.getElementById("chatApp");
const userNameInput = document.getElementById("userNameInput"); 
const joinBtn = document.getElementById("joinBtn"); 
const nameError = document.getElementById("nameError");

const onlineCountEl = document.getElementById("onlineCount");
const messagesEl = document.getElementById("messages");
const typingIndicator = document.getElementById("typingIndicator");
const sendForm = document.getElementById("sendForm");
const messageInput = document.getElementById("messageInput");

// --- CHAT VARIABLES ---
let currentUser = null;
let displayName = null;
const CHAT_ROOM = "public"; 
const USERS_COLLECTION = "cyou_users";
const MESSAGES_COLLECTION = `cyou_${CHAT_ROOM}`;
let isTyping = false; 

// --- 1. INITIALIZATION & AUTO-LOGIN ---
function init() {
    const savedName = localStorage.getItem('cyou_username');
    if (savedName) {
        displayName = savedName;
        signIn(displayName, false); // Auto-join doesn't log a welcome message
    }

    joinBtn.onclick = async () => {
        const name = userNameInput.value.trim();
        nameError.textContent = ""; 
        if (!name) {
            nameError.textContent = "Please enter a username.";
            return;
        }

        try {
            const exists = await getDoc(doc(db, USERS_COLLECTION, name));
            
            if (exists.exists()) {
                nameError.textContent = "Username already taken!";
                return;
            }
            
            displayName = name;
            localStorage.setItem('cyou_username', displayName); 
            
            // Send 'true' to log a welcome message for a fresh join
            await signIn(displayName, true); 

        } catch (error) {
            console.error("Joining failed:", error);
            // General connection error message for the screen
            nameError.textContent = "A connection error occurred. Please try again."; 
        }
    };

    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            joinScreen.classList.add("hidden");
            chatApp.classList.remove("hidden");
            subscribeMessages();
            subscribeOnlineStatus();
            subscribeTypingIndicator();
        } else {
            localStorage.removeItem('cyou_username');
            joinScreen.classList.remove("hidden");
            chatApp.classList.add("hidden");
        }
    });

    window.addEventListener('beforeunload', () => {
        if(displayName) {
             setDoc(doc(db, USERS_COLLECTION, displayName), { online: false, lastSeen: serverTimestamp(), typing: false }, { merge: true });
        }
    });
}

// FIX: Added robust error handling for mobile debugging
async function signIn(name, logWelcome) {
    try {
        await setDoc(doc(db, USERS_COLLECTION, name), { online: true, lastSeen: serverTimestamp(), typing: false });
        await signInAnonymously(auth);
        
        // NEW FEATURE: Log a welcome message only on first join
        if (logWelcome) {
             await addDoc(collection(db, MESSAGES_COLLECTION), {
                name: "System",
                text: `${name} has joined the chat! 👋`,
                createdAt: serverTimestamp(),
                seen: []
            });
        }
        
    } catch (error) {
        // CRITICAL FIX: Display specific error if Auth fails
        console.error("Firebase Sign In failed:", error);
        nameError.textContent = "FATAL ERROR: Failed to connect to Firebase. Check your network or if Anonymous Auth is enabled.";
        localStorage.removeItem('cyou_username');
        displayName = null;
    }
}

// --- 2. SENDING MESSAGES ---
sendForm.onsubmit = async (e) => {
  e.preventDefault();
  const text = messageInput.value.trim();
  if (!text || !currentUser) return;
  
  messageInput.value = ""; 

  if (isTyping) {
      isTyping = false;
      // Mark typing as false immediately
      await setDoc(doc(db, USERS_COLLECTION, displayName), { typing: false }, { merge: true });
  }

  await addDoc(collection(db, MESSAGES_COLLECTION), {
    name: displayName,
    uid: currentUser.uid,
    text,
    createdAt: serverTimestamp(),
    seen: [] 
  });
};

// --- 3. RECEIVING MESSAGES & SEEN STATUS ---
function subscribeMessages(){
  const q = query(collection(db, MESSAGES_COLLECTION), orderBy("createdAt"));
  onSnapshot(q, async (snap) => {
    const shouldAutoScroll = (messagesEl.scrollTop + messagesEl.clientHeight) >= messagesEl.scrollHeight - 20;

    messagesEl.innerHTML = "";
    const messagesToMarkSeen = [];

    snap.forEach(docu => {
      const m = docu.data();
      const div = document.createElement("div");
      
      // Handle the new System Message feature
      const isSystem = m.name === "System";
      const isMe = m.name === displayName && !isSystem;

      div.className = "message " + (isMe ? "me" : "other") + (isSystem ? " system-message" : "");
      
      div.innerHTML = `
        <div class="name-tag">${isMe || isSystem ? "" : m.name}</div>
        <div>${m.text}</div>
        ${!isSystem ? `
        <div class="meta">
          ${formatTime(m.createdAt?.toDate?.() || new Date())}
          ${isMe ? `<span class="ticks">${renderTicks(m)}</span>` : ''}
        </div>` : ''}`;
      messagesEl.appendChild(div);
      
      // Mark as seen only if it's not a system message and it's not my message
      if (!isMe && !isSystem && currentUser && !m.seen.includes(currentUser.uid)) {
          messagesToMarkSeen.push(docu); // Push the whole doc for easier reference
      }
    });
    
    // Batch update seen status
    if (messagesToMarkSeen.length > 0) {
        setTimeout(() => {
            messagesToMarkSeen.forEach(docu => {
                const seenArray = docu.data().seen || [];
                // Only update if UID is not already present
                if (!seenArray.includes(currentUser.uid)) {
                    setDoc(docu.ref, { 
                        seen: [...seenArray, currentUser.uid]
                    }, { merge: true });
                }
            });
        }, 100); 
    }
    
    if (shouldAutoScroll) {
        messagesEl.scrollTop = messagesEl.scrollHeight;
    }
  });
}

function renderTicks(m){
  const seenCount = (m.seen || []).length;
  const tickGray = document.documentElement.style.getPropertyValue('--tick-gray');
  const tickBlue = document.documentElement.style.getPropertyValue('--tick-blue');
  
  if (seenCount === 0) return "✓"; 
  if (seenCount === 1) return `<span style="color:${tickGray || '#888'}">✓✓</span>`; 
  return `<span style="color:${tickBlue || '#34B7F1'}">✓✓</span>`; 
}

function formatTime(d){
  return `${d.getHours().toString().padStart(2,"0")}:${d.getMinutes().toString().padStart(2,"0")}`;
}

// --- 4. TYPING INDICATOR ---
let typingTimeout = null;
const TYPING_TIMEOUT_MS = 3000; 

messageInput.oninput = () => {
    if (!isTyping) {
        isTyping = true;
        setDoc(doc(db, USERS_COLLECTION, displayName), { typing: true }, { merge: true });
    }

    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        isTyping = false;
        setDoc(doc(db, USERS_COLLECTION, displayName), { typing: false }, { merge: true });
    }, TYPING_TIMEOUT_MS);
};

function subscribeTypingIndicator() {
    const q = query(collection(db, USERS_COLLECTION), 
                    where("online", "==", true), 
                    where("typing", "==", true));
    
    onSnapshot(q, (snap) => {
        const typingUsers = [];
        snap.forEach(docu => {
            // Exclude myself
            if (docu.id !== displayName) { 
                typingUsers.push(docu.id);
            }
        });

        if (typingUsers.length > 0) {
            const names = typingUsers.slice(0, 2).join(' and ');
            typingIndicator.textContent = `${names} is typing...`;
        } else {
            typingIndicator.textContent = '';
        }
    });
}


// --- 5. ONLINE STATUS ---
function subscribeOnlineStatus(){
    const q = query(collection(db, USERS_COLLECTION), where("online", "==", true));
    onSnapshot(q, (snap) => {
        onlineCountEl.textContent = snap.size;
    });
}

// --- START THE APPLICATION ---
init();
