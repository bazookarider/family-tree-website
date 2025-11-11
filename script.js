/* =====================================================
  PART 1: FIREBASE IMPORTS & INITIALIZATION
=====================================================
*/
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
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


/* =====================================================
  PART 2: DOM ELEMENT SELECTORS
=====================================================
*/
const loginPage = document.getElementById('login-page');
const appPage = document.getElementById('app-page');

// Auth elements
const authForm = document.getElementById('auth-form');
const emailInput = document.getElementById('email-input');
const passwordInput = document.getElementById('password-input');
const loginButton = document.getElementById('login-button');
const signupButton = document.getElementById('signup-button');
const signoutButton = document.getElementById('signout-button');
const authError = document.getElementById('auth-error');
const userEmailSpan = document.getElementById('user-email');

// Navigation elements
const navChat = document.getElementById('nav-chat');
const navDashboard = document.getElementById('nav-dashboard');
const chatContent = document.getElementById('chat-content');
const dashboardContent = document.getElementById('dashboard-content');

// Chat elements
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
  PART 4: AUTHENTICATION
=====================================================
*/

// --- Auth State Listener ---
// UPDATED: Re-ordered to fix the login bug
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // --- THIS IS THE FIX ---
        // 1. SWITCH THE VIEW IMMEDIATELY.
        // This makes sure you get into the app, even if profile loading fails.
        appPage.classList.remove('hidden');
        loginPage.classList.add('hidden');
        showView('chat'); // Show chat by default
        
        // 2. Now, try to load profile, messages, and presence.
        userEmailSpan.textContent = user.email;

        try {
            await loadProfile(user.uid); 
        } catch (error) {
            console.error("Failed to load profile:", error);
        }
        
        try {
            loadMessages();
        } catch (error) {
            console.error("Failed to load messages:", error);
        }
        
        try {
            setupPresence(user.uid);
            listenForTyping();
        } catch (error) {
            console.error("Failed to set up presence/typing:", error);
        }

    } else {
        // User is signed out
        loginPage.classList.remove('hidden');
        appPage.classList.add('hidden');
        userEmailSpan.textContent = "";
        currentUserProfile = null;
        typingIndicator.textContent = "";
    }
});

// NEW: Helper function to show auth errors
function showAuthError(message, isError = true) {
    authError.textContent = message;
    if (isError) {
        authError.classList.remove('info-message');
        authError.classList.add('error-message');
    } else {
        // This is for your friendly "already in use" message
        authError.classList.remove('error-message');
        authError.classList.add('info-message');
    }
}

// --- Sign Up Button ---
// UPDATED: Shows friendly error message
signupButton.addEventListener('click', async (e) => {
    e.preventDefault();
    showAuthError("", true); // Clear error
    
    const email = emailInput.value;
    const password = passwordInput.value;

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await createUserProfile(userCredential.user.uid, email);
    } catch (error) {
        if (error.code === 'auth/email-already-in-use') {
            // This is your requested feature!
            showAuthError("This email is already in use. Please click 'Login'.", false); // false = not an error
        } else {
            showAuthError(error.message, true);
        }
    }
});

// --- Login Button ---
// UPDATED: Shows friendly error message
loginButton.addEventListener('click', async (e) => {
    e.preventDefault();
    showAuthError("", true); // Clear error

    const email = emailInput.value;
    const password = passwordInput.value;

    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            showAuthError("Wrong password or email. Please try again.", true);
        } else {
            showAuthError(error.message, true);
        }
    }
});

// --- Sign Out Button ---
signoutButton.addEventListener('click', async () => {
    try {
        if (auth.currentUser) {
            const typingRef = ref(db, `typingStatus/${auth.currentUser.uid}`);
            await remove(typingRef);
        }
        await signOut(auth);
    } catch (error) {
        console.error("Sign out error:", error);
    }
});


/* =====================================================
  PART 5: DASHBOARD (PROFILE)
=====================================================
*/

async function createUserProfile(uid, email) {
    const userRef = ref(db, `users/${uid}`);
    const initialDisplayName = email.split('@')[0]; 
    try {
        await set(userRef, {
            uid: uid,
            email: email,
            displayName: initialDisplayName
        });
    } catch (error) {
        console.error("Error creating user profile:", error);
    }
}

async function loadProfile(uid) {
    const userRef = ref(db, `users/${uid}`);
    try {
        const snapshot = await get(userRef);
        if (snapshot.exists()) {
            currentUserProfile = snapshot.val();
            displayNameInput.value = currentUserProfile.displayName;
        } else {
            await createUserProfile(uid, auth.currentUser.email);
            await loadProfile(uid); // Reload after creating
        }
    } catch (error) {
        console.error("Error loading profile:", error);
    }
}

profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newDisplayName = displayNameInput.value.trim();
    if (newDisplayName === "" || !auth.currentUser) return;

    const userRef = ref(db, `users/${auth.currentUser.uid}`);
    try {
        await set(userRef, {
            ...currentUserProfile,
            displayName: newDisplayName
        });
        currentUserProfile.displayName = newDisplayName; 
        
        profileSuccess.textContent = "Profile saved successfully!";
        setTimeout(() => { profileSuccess.textContent = ""; }, 3000);
    } catch (error) {
        console.error("Error saving profile:", error);
    }
});


/* =====================================================
  PART 6: REALTIME DATABASE (CHAT & TYPING)
=====================================================
*/

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
            timestamp: serverTimestamp()
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
  PART 7: NEW "IS TYPING" FEATURE
=====================================================
*/

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
            typingIndicator.textContent = "Several people are typing...";
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
