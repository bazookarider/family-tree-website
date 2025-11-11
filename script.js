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
    get // Added get
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

// We'll store the user's current profile data here
let currentUserProfile = null;


/* =====================================================
  PART 2: DOM ELEMENT SELECTORS
=====================================================
*/
const loginPage = document.getElementById('login-page');
const appPage = document.getElementById('app-page'); // Renamed

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

// Dashboard/Profile elements
const profileForm = document.getElementById('profile-form');
const displayNameInput = document.getElementById('display-name-input');
const profileSuccess = document.getElementById('profile-success');


/* =====================================================
  PART 3: NAVIGATION
=====================================================
*/
function showView(viewId) {
    // Hide all content sections
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.add('hidden');
    });
    // Deactivate all nav links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });

    // Show the selected view
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
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // User is signed in
        console.log("User is logged in:", user);
        userEmailSpan.textContent = user.email;
        
        // Load user's profile
        await loadProfile(user.uid); 
        
        // Show app, hide login page
        appPage.classList.remove('hidden');
        loginPage.classList.add('hidden');
        
        // Load chat messages
        loadMessages();
        // Show the chat view by default
        showView('chat');

    } else {
        // User is signed out
        console.log("User is signed out");
        
        // Show login page, hide app
        loginPage.classList.remove('hidden');
        appPage.classList.add('hidden');
        userEmailSpan.textContent = "";
        currentUserProfile = null; // Clear profile
    }
});

// --- Sign Up Button ---
signupButton.addEventListener('click', async (e) => {
    e.preventDefault();
    authError.textContent = "";
    
    const email = emailInput.value;
    const password = passwordInput.value;

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        console.log("Sign up successful:", userCredential.user);
        
        // **NEW: Create a default profile for the new user**
        await createUserProfile(userCredential.user.uid, email);
        
        // onAuthStateChanged will handle the rest
    } catch (error) {
        console.error("Sign up error:", error.message);
        authError.textContent = error.message;
    }
});

// --- Login Button ---
loginButton.addEventListener('click', async (e) => {
    e.preventDefault();
    authError.textContent = "";

    const email = emailInput.value;
    const password = passwordInput.value;

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        console.log("Login successful:", userCredential.user);
        // onAuthStateChanged will handle loading profile and showing app
    } catch (error) {
        console.error("Login error:", error.message);
        authError.textContent = error.message;
    }
});

// --- Sign Out Button ---
signoutButton.addEventListener('click', async () => {
    try {
        await signOut(auth);
        console.log("Sign out successful");
    } catch (error) {
        console.error("Sign out error:", error);
    }
});


/* =====================================================
  PART 5: DASHBOARD (PROFILE)
=====================================================
*/

// --- Create a new user's profile in the database ---
// This runs only once when they sign up
async function createUserProfile(uid, email) {
    const userRef = ref(db, `users/${uid}`);
    // Use email as the initial display name
    const initialDisplayName = email.split('@')[0]; 
    try {
        await set(userRef, {
            uid: uid,
            email: email,
            displayName: initialDisplayName
        });
        console.log("Default profile created");
    } catch (error) {
        console.error("Error creating user profile:", error);
    }
}

// --- Load the user's profile data from the database ---
async function loadProfile(uid) {
    const userRef = ref(db, `users/${uid}`);
    try {
        const snapshot = await get(userRef);
        if (snapshot.exists()) {
            currentUserProfile = snapshot.val();
            console.log("Profile loaded:", currentUserProfile);
            // Set the value in the profile form
            displayNameInput.value = currentUserProfile.displayName;
        } else {
            console.warn("No profile found for user, creating one.");
            // This is a fallback in case sign-up failed to create one
            await createUserProfile(uid, auth.currentUser.email);
            await loadProfile(uid); // Reload after creating
        }
    } catch (error) {
        console.error("Error loading profile:", error);
    }
}

// --- Save profile changes from the form ---
profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newDisplayName = displayNameInput.value.trim();
    
    if (newDisplayName === "") return;
    
    const user = auth.currentUser;
    if (!user) return;

    const userRef = ref(db, `users/${user.uid}`);
    
    try {
        // We update only the displayName, keeping email and uid
        await set(userRef, {
            ...currentUserProfile, // Spread existing data
            displayName: newDisplayName // Overwrite display name
        });
        
        // Update local cache
        currentUserProfile.displayName = newDisplayName; 
        
        profileSuccess.textContent = "Profile saved successfully!";
        setTimeout(() => { profileSuccess.textContent = ""; }, 3000);
        
    } catch (error) {
        console.error("Error saving profile:", error);
    }
});


/* =====================================================
  PART 6: REALTIME DATABASE (CHAT)
=====================================================
*/

// --- Send Message ---
sendMessageForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const messageText = messageInput.value;
    
    if (messageText.trim() === "" || !currentUserProfile) {
        if (!currentUserProfile) console.error("Profile not loaded yet!");
        return;
    }

    const user = auth.currentUser;

    try {
        const messagesRef = ref(db, 'messages');
        const newMessageRef = push(messagesRef);
        
        await set(newMessageRef, {
            // **UPDATED: Use profile displayName**
            displayName: currentUserProfile.displayName, 
            uid: user.uid,
            text: messageText,
            timestamp: serverTimestamp()
        });

        messageInput.value = ""; // Clear input
    } catch (error) {
        console.error("Error sending message:", error);
    }
});

// --- Load Messages ---
function loadMessages() {
    const messagesRef = ref(db, 'messages');
    
    onValue(messagesRef, (snapshot) => {
        messagesBox.innerHTML = "";
        const data = snapshot.val();
        
        if (data) {
            Object.values(data).forEach((message) => {
                // **UPDATED: Use displayName**
                displayMessage(message.displayName, message.text); 
            });
        }
        
        messagesBox.scrollTop = messagesBox.scrollHeight;
    });
}

// --- Helper function to display a single message ---
function displayMessage(displayName, text) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');
    
    const nameElement = document.createElement('strong');
    // **UPDATED: Use displayName**
    nameElement.textContent = displayName || "User"; // Fallback
    
    const textElement = document.createElement('span');
    textElement.textContent = text;
    
    messageElement.appendChild(nameElement);
    messageElement.appendChild(textElement);
    
    messagesBox.appendChild(messageElement);
}
