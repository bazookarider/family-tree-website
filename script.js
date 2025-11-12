import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import {
  getAuth, signInAnonymously, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, serverTimestamp, query, orderBy, onSnapshot,
  doc, setDoc, getDoc, updateDoc, where, deleteDoc
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
// Renamed from nameInput
const userNameInput = document.getElementById("userNameInput"); 
// Renamed from checkBtn
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
// Removed chatMode and related variables. Always Public Chat.
const CHAT_ROOM = "public"; 
const USERS_COLLECTION = "cyou_users";
const MESSAGES_COLLECTION = `cyou_${CHAT_ROOM}`;
let isTyping = false; // Flag to manage typing status

// --- 1. INITIALIZATION & AUTO-LOGIN (Username saved locally) ---
function init() {
    // Check for saved username
    const savedName = localStorage.getItem('cyou_username');
    if (savedName) {
        displayName = savedName;
        // Auto-join if name is found
        signIn(displayName);
    }

    // Listener for the Join button (manual join/first-time join)
    joinBtn.onclick = async () => {
        const name = userNameInput.value.trim();
        if (!name) return;
        
        const exists = await getDoc(doc(db, USERS_COLLECTION, name));
        if (exists.exists()) {
            nameError.textContent = "Username already taken!";
            return;
        }
        
        nameError.textContent = "";
        displayName = name;
        // Save name locally for auto-login
        localStorage.setItem('cyou_username', displayName); 
        await signIn(displayName);
    };

    // Global listener for auth state changes
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            joinScreen.classList.add("hidden");
            chatApp.classList.remove("hidden");
            // Start all real-time listeners
            subscribeMessages();
            subscribeOnlineStatus();
            subscribeTypingIndicator();
        } else {
            // Log out/clean up if auth state changes (e.g., if user manually signed out)
            localStorage.removeItem('cyou_username');
            joinScreen.classList.remove("hidden");
            chatApp.classList.add("hidden");
        }
    });

    // Handle user leaving/closing the window
    window.addEventListener('beforeunload', () => {
        // Set user offline status on window close (best effort)
        if(displayName) {
             setDoc(doc(db, USERS_COLLECTION, displayName), { online: false, lastSeen: serverTimestamp() }, { merge: true });
        }
    });
}

// Signs in user anonymously and sets their online status
async function signIn(name) {
    try {
        await setDoc(doc(db, USERS_COLLECTION, name), { online: true, lastSeen: serverTimestamp() });
        await signInAnonymously(auth);
    } catch (error) {
        console.error("Sign In failed:", error);
        nameError.textContent = "Could not connect to server. Try again.";
    }
}

// --- 2. SENDING MESSAGES ---
sendForm.onsubmit = async (e) => {
  e.preventDefault();
  const text = messageInput.value.trim();
  if (!text || !currentUser) return;
  
  // Clear input and send message
  messageInput.value = ""; 

  // Stop typing status immediately when message is sent
  if (isTyping) {
      isTyping = false;
      await setDoc(doc(db, USERS_COLLECTION, displayName), { typing: false }, { merge: true });
  }

  await addDoc(collection(db, MESSAGES_COLLECTION), {
    name: displayName,
    uid: currentUser.uid,
    text,
    createdAt: serverTimestamp(),
    // 'seen' array tracks UIDs that have read the message
    seen: [] 
  });
};

// --- 3. RECEIVING MESSAGES & SEEN STATUS (Auto-scroll & Read Tick) ---
function subscribeMessages(){
  const q = query(collection(db, MESSAGES_COLLECTION), orderBy("createdAt"));
  onSnapshot(q, async (snap) => {
    // Keep track of scroll position before update
    const shouldAutoScroll = (messagesEl.scrollTop + messagesEl.clientHeight) >= messagesEl.scrollHeight - 20;

    messagesEl.innerHTML = "";
    
    // Track messages sent by others to update 'seen' status
    const messagesToMarkSeen = [];

    snap.forEach(docu => {
      const m = docu.data();
      const div = document.createElement("div");
      const isMe = m.name === displayName;
      
      div.className = "message " + (isMe ? "me" : "other");
      div.innerHTML = `
        <div class="name-tag">${isMe ? "" : m.name}</div>
        <div>${m.text}</div>
        <div class="meta">
          ${formatTime(m.createdAt?.toDate?.() || new Date())}
          ${isMe ? `<span class="ticks">${renderTicks(m)}</span>` : ''}
        </div>`;
      messagesEl.appendChild(div);
      
      // If it's not my message AND I haven't seen it yet, mark it for update
      if (!isMe && currentUser && !m.seen.includes(currentUser.uid)) {
          messagesToMarkSeen.push(docu.ref);
      }
    });
    
    // After rendering, mark all new, unseen messages as read by me
    // This is done in a batch for efficiency
    if (messagesToMarkSeen.length > 0) {
        // Run updates outside the main loop to prevent performance lag
        setTimeout(() => {
            messagesToMarkSeen.forEach(ref => {
                updateDoc(ref, {
                    seen: [...ref.seen || [], currentUser.uid]
                });
            });
        }, 100); // Small delay to prioritize rendering
    }
    
    // Auto-scroll to bottom if user was near the bottom before the update
    if (shouldAutoScroll) {
        messagesEl.scrollTop = messagesEl.scrollHeight;
    }
  });
}

function renderTicks(m){
  const seenCount = (m.seen || []).length;
  // In a public chat, 'seen' only includes others, not the sender.
  // One person (me) has sent it. The others are readers.
  
  // 0 users read (Only me has seen it): Sent (✓)
  if (seenCount === 0) return "✓"; 
  // 1 user read (One other person): Delivered/Seen by one (Gray ✓✓)
  if (seenCount === 1) return `<span style="color:${var(--tick-gray)}">✓✓</span>`; 
  // 2+ users read: Read by many (Blue ✓✓)
  return `<span style="color:${var(--tick-blue)}">✓✓</span>`; 
}

function formatTime(d){
  // PadStart ensures "09:05" instead of "9:5"
  return `${d.getHours().toString().padStart(2,"0")}:${d.getMinutes().toString().padStart(2,"0")}`;
}

// --- 4. TYPING INDICATOR (Reliably works) ---
let typingTimeout = null;
const TYPING_TIMEOUT_MS = 3000; // 3 seconds

messageInput.oninput = () => {
    // 1. Set typing status in Firestore if not already typing
    if (!isTyping) {
        isTyping = true;
        setDoc(doc(db, USERS_COLLECTION, displayName), { typing: true }, { merge: true });
    }

    // 2. Clear old timeout and set a new one
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        // 3. Stop typing status after timeout
        isTyping = false;
        setDoc(doc(db, USERS_COLLECTION, displayName), { typing: false }, { merge: true });
    }, TYPING_TIMEOUT_MS);
};

// Listen for other users' typing status
function subscribeTypingIndicator() {
    // Query for all users who are 'online: true' and 'typing: true'
    const q = query(collection(db, USERS_COLLECTION), 
                    where("online", "==", true), 
                    where("typing", "==", true));
    
    onSnapshot(q, (snap) => {
        const typingUsers = [];
        snap.forEach(docu => {
            const user = docu.data();
            // Exclude myself from the typing list
            if (user.name !== displayName && docu.id !== displayName) {
                typingUsers.push(user.name);
            }
        });

        if (typingUsers.length > 0) {
            // Format the names nicely for display
            const names = typingUsers.slice(0, 2).join(' and ');
            typingIndicator.textContent = `${names} is typing...`;
        } else {
            typingIndicator.textContent = '';
        }
    });
}


// --- 5. ONLINE STATUS (Fast updates) ---
function subscribeOnlineStatus(){
    // Listen for all users who are currently marked as online
    const q = query(collection(db, USERS_COLLECTION), where("online", "==", true));
    onSnapshot(q, (snap) => {
        onlineCountEl.textContent = snap.size;
    });
}

// --- START THE APPLICATION ---
init();
