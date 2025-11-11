/* =====================================================
  PART 1: FIREBASE IMPORTS & INITIALIZATION
=====================================================
*/
// UPDATED: Removed email auth, added anonymous auth
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    signInAnonymously, // NEW
    signOut 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
    getDatabase, 
    ref, 
    set, 
    onValue, 
    push, 
    serverTimestamp,
    get,
    remove,
    onDisconnect
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDJFQnwOs-fetKVy0Ow43vktz8xwefZMks",
  authDomain: "cyou-db8f0.firebaseapp.com",
  projectId: "cyou-db8f0",
  storageBucket: "cyou-db8f0.firebasestorage.app",
  messagingSenderId: "873569975141",
  appId: "1:873569975141:web:147eb7b7b4043a38c9bf8c",
  measurementId: "G-T66B50HFJ8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);

// Global state variables
let currentUserProfile = null;
let typingTimeout = null;


/* =================================D====================
  PART 2: DOM ELEMENT SELECTORS
=====================================================
*/
// UPDATED: Replaced login page with name entry page
const nameEntryPage = document.getElementById('name-entry-page');
const nameEntryForm = document.getElementById('name-entry-form');
const nameInput = document.getElementById('name-input');
const appPage = document.getElementById('app-page');

// Auth elements
const signoutButton = document.getElementById('signout-button');
const userNameSpan = document.getElementById('user-name'); // Changed from user-email

// Navigation elements
const navChat = document.getElementById('nav-chat');
const navDashboard = document.getElementById('nav-dashboard');
const chatContent = document.getElementById('chat-content');
const dashboardContent = document.getElementById('dashboard-content');

// Chat elements (All kept for features)
const chatContainer = document.getElementById('chat-container');
const messagesBox = document.getElementById('messages-box');
const sendMessageForm = document.getElementById('send-message-form');
const messageInput = document.getElementById('message-input');
const typingIndicator = document.getElementById('typing-indicator');

// Dashboard/Profile elements
const profileForm = document.getElementById('profile-form');
const displayNameInput = document.getElementById('display-name-input');
const profileSuccess = document.getElementById('profile-success');


/* =====================================================
  PART 3: NAVIGATION
=====================================================
*/
// This is unchanged
function showView(viewId) {
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.add('hidden');
    });
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });

    if (viewId === 'chat') {
        chatContent.classList.remove('hidden');
        navChat.classList.add('active');
    } else if (viewId === 'dashboard') {
        dashboardContent.classList.remove('hidden');
        navDashboard.classList.add('active');
    }
}

navChat.addEventListener('click', (e) => {
    e.preventDefault();
    showView('chat');
});

navDashboard.addEventListener('click', (e) => {
    e.preventDefault();
    showView('dashboard');
});


/* =====================================================
  PART 4: AUTHENTICATION (NEW ANONYMOUS FLOW)
=====================================================
*/

// --- Auth State Listener ---
// This function runs when the page loads
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // User is logged in anonymously
        console.log("User is logged in anonymously:", user.uid);
        
        // 1. Check if they have a profile (i.e., a name)
        await loadProfile(user.uid);
        
        if (currentUserProfile) {
            // 2. If they HAVE a profile, show the app
            userNameSpan.textContent = currentUserProfile.displayName;
            appPage.classList.remove('hidden');
            nameEntryPage.classList.add('hidden');
            
            // 3. Load chat, presence, and typing features
            loadMessages();
            setupPresence(user.uid);
            listenForTyping();
            showView('chat');
        } else {
            // 4. If they DON'T have a profile, show the name entry page
            appPage.classList.add('hidden');
            nameEntryPage.classList.remove('hidden');
        }

    } else {
        // User is signed out, show name entry page
        appPage.classList.add('hidden');
        nameEntryPage.classList.remove('hidden');
        currentUserProfile = null;
        typingIndicator.textContent = "";
        // Automatically sign them in anonymously
        signInAnonymously(auth).catch(error => {
            console.error("Anonymous sign-in failed:", error);
        });
    }
});

// --- Name Entry Form (Replaces Login/Signup) ---
nameEntryForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const displayName = nameInput.value.trim();
    
    if (displayName === "") return;
    
    const user = auth.currentUser;
    if (!user) {
        console.error("No user signed in.");
        return;
    }

    try {
        // Create their profile, this will trigger onAuthStateChanged to show app
        await createUserProfile(user.uid, displayName);
        // We manually trigger the "show app" logic here too
        currentUserProfile = { uid: user.uid, displayName: displayName };
        userNameSpan.textContent = displayName;
        appPage.classList.remove('hidden');
        nameEntryPage.classList.add('hidden');
        
        loadMessages();
        setupPresence(user.uid);
        listenForTyping();
        showView('chat');
    } catch (error) {
        console.error("Error creating profile:", error);
    }
});


// --- Sign Out Button ---
// Kept this, it will sign out the anonymous user
signoutButton.addEventListener('click', async () => {
    try {
        if (auth.currentUser) {
            const typingRef = ref(db, `typingStatus/${auth.currentUser.uid}`);
            await remove(typingRef);
        }
        await signOut(auth);
        // onAuthStateChanged will handle showing the name entry page
    } catch (error) {
        console.error("Sign out error:", error);
    }
});


/* =====================================================
  PART 5: DASHBOARD (PROFILE)
=====================================================
*/

// UPDATED: This function is now simpler
async function createUserProfile(uid, displayName) {
    const userRef = ref(db, `users/${uid}`);
    try {
        await set(userRef, {
            uid: uid,
            displayName: displayName
        });
        console.log("Profile created");
    } catch (error) {
        console.error("Error creating user profile:", error);
    }
}

// This function is still needed
async function loadProfile(uid) {
    const userRef = ref(db, `users/${uid}`);
    try {
        const snapshot = await get(userRef);
        if (snapshot.exists()) {
            currentUserProfile = snapshot.val();
            // Also update the dashboard form input
            displayNameInput.value = currentUserProfile.displayName;
        } else {
            // No profile found
            currentUserProfile = null;
        }
    } catch (error) {
        console.error("Error loading profile:", error);
    }
}

// Profile save form is unchanged
profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newDisplayName = displayNameInput.value.trim();
    if (newDisplayName === "" || !auth.currentUser) return;

    const userRef = ref(db, `users/${auth.currentUser.uid}`);
    try {
        // Update the display name
        await set(userRef, {
            ...currentUserProfile,
            displayName: newDisplayName
        });
        
        // Update local state
        currentUserProfile.displayName = newDisplayName; 
        userNameSpan.textContent = newDisplayName; // Update header
        
        profileSuccess.textContent = "Profile saved successfully!";
        setTimeout(() => { profileSuccess.textContent = ""; }, 3000);
    } catch (error) {
        console.error("Error saving profile:", error);
    }
});


/* =====================================================
  PART 6: REALTIME DATABASE (CHAT - UNCHANGED)
=====================================================
*/
// All this code is exactly the same as before

sendMessageForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const messageText = messageInput.value;
    if (messageText.trim() === "" || !currentUserProfile) return;
    const user = auth.currentUser;

    try {
        const messagesRef = ref(db, 'messages');
        const newMessageRef = push(messagesRef);
        
        await set(newMessageRef, {
            displayName: currentUserProfile.displayName, 
            uid: user.uid,
            text: messageText,
            timestamp: serverTimestamp() // Kept timestamp feature
        });

        messageInput.value = "";
        handleTyping(false);
    } catch (error) {
        console.error("Error sending message:", error);
    }
});

function loadMessages() {
    const messagesRef = ref(db, 'messages');
    onValue(messagesRef, (snapshot) => {
        messagesBox.innerHTML = "";
        const data = snapshot.val();
        
        if (data) {
            Object.values(data).forEach((message) => {
                // Kept timestamp feature
                displayMessage(message.displayName, message.text, message.timestamp); 
            });
        }
        messagesBox.scrollTop = messagesBox.scrollHeight;
    });
}

function displayMessage(displayName, text, timestamp) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');
    
    const nameElement = document.createElement('strong');
    nameElement.textContent = displayName || "User";
    
    const textElement = document.createElement('span');
    textElement.textContent = text;
    
    messageElement.appendChild(nameElement);
    messageElement.appendChild(textElement);
    
    // Kept timestamp feature
    if (timestamp) {
        const timeElement = document.createElement('span');
        timeElement.classList.add('message-time');
        const date = new Date(timestamp);
        timeElement.textContent = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        messageElement.appendChild(timeElement);
    }
    
    messagesBox.appendChild(messageElement);
}


/* =====================================================
  PART 7: "IS TYPING" FEATURE (UNCHANGED)
=====================================================
*/
// All this code is exactly the same as before

function setupPresence(uid) {
    const typingRef = ref(db, `typingStatus/${uid}`);
    onDisconnect(typingRef).remove();
}

function listenForTyping() {
    const typingRef = ref(db, 'typingStatus');
    onValue(typingRef, (snapshot) => {
        const typingUsers = snapshot.val() || {};
        
        const typingNames = Object.values(typingUsers).filter(name => 
            currentUserProfile && name !== currentUserProfile.displayName
        );

        if (typingNames.length === 0) {
            typingIndicator.textContent = "";
        } else if (typingNames.length === 1) {
            typingIndicator.textContent = `${typingNames[0]} is typing...`;
        } else {
            typingIndicator.textContent = "Several people are typing... (beta)";
        }
    });
}

function handleTyping(isTyping) {
    if (!currentUserProfile) return;

    const typingRef = ref(db, `typingStatus/${currentUserProfile.uid}`);
    
    if (isTyping) {
        set(typingRef, currentUserProfile.displayName);
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
            handleTyping(false);
        }, 3000);
    } else {
        clearTimeout(typingTimeout);
        remove(typingRef);
    }
}

messageInput.addEventListener('input', () => handleTyping(true));
messageInput.addEventListener('blur', () => handleTyping(false));
