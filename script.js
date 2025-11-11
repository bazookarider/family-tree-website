//
// ----------------  FIREBASE SDK & CONFIG  ----------------
//
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import { 
    getFirestore,
    doc,
    setDoc,
    getDoc,
    collection,
    query,
    orderBy,
    onSnapshot,
    addDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

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
const auth = getAuth(app);
const db = getFirestore(app);

//
// ----------------  GLOBAL VARIABLES & DOM ELEMENTS  ----------------
//
let currentUser = null; // To store the current user's data
let chatUnsubscribe = null; // To stop listening to chat messages when we leave the screen

// --- Pages ---
const loginPage = document.getElementById('login-page');
const signupPage = document.getElementById('signup-page');
const appPage = document.getElementById('app-page');

// --- Screens ---
const dashboardScreen = document.getElementById('dashboard-screen');
const chatScreen = document.getElementById('chat-screen');

// --- Auth Forms ---
const loginForm = document.getElementById('login-form');
const loginEmail = document.getElementById('login-email');
const loginPassword = document.getElementById('login-password');
const loginError = document.getElementById('login-error');

const signupForm = document.getElementById('signup-form');
const signupFullname = document.getElementById('signup-fullname');
const signupUsername = document.getElementById('signup-username');
const signupEmail = document.getElementById('signup-email');
const signupPassword = document.getElementById('signup-password');
const signupError = document.getElementById('signup-error');

// --- Auth Links ---
const gotoSignupLink = document.getElementById('goto-signup');
const gotoLoginLink = document.getElementById('goto-login');

// --- App Header ---
const appUsername = document.getElementById('app-username');
const logoutButton = document.getElementById('logout-button');

// --- Dashboard ---
const navChatRoom = document.getElementById('nav-chat-room');
const usersListContainer = document.getElementById('users-list-container');

// --- Chat Room ---
const backToDashboardButton = document.getElementById('back-to-dashboard-button');
const chatMessagesContainer = document.getElementById('chat-messages-container');
const chatMessageForm = document.getElementById('chat-message-form');
const chatMessageInput = document.getElementById('chat-message-input');


//
// ----------------  PAGE / SCREEN NAVIGATION  ----------------
//

/** Shows a page (login, signup, or app) and hides others */
function showPage(pageId) {
    // Hide all pages
    loginPage.classList.remove('active');
    signupPage.classList.remove('active');
    appPage.classList.remove('active');

    // Show the requested page
    const pageToShow = document.getElementById(pageId);
    if (pageToShow) {
        pageToShow.classList.add('active');
    }
}

/** Shows a screen within the main app (dashboard or chat) */
function showScreen(screenId) {
    // Hide all screens
    dashboardScreen.classList.remove('active');
    chatScreen.classList.remove('active');
    
    // Stop any active listeners
    if (chatUnsubscribe) {
        chatUnsubscribe(); // Stop listening to old chat
        chatUnsubscribe = null;
    }

    // Show the requested screen
    const screenToShow = document.getElementById(screenId);
    if (screenToShow) {
        screenToShow.classList.add('active');
    }
}

// --- Navigation Event Listeners ---
gotoSignupLink.addEventListener('click', (e) => {
    e.preventDefault();
    showPage('signup-page');
});

gotoLoginLink.addEventListener('click', (e) => {
    e.preventDefault();
    showPage('login-page');
});

navChatRoom.addEventListener('click', (e) => {
    e.preventDefault();
    showScreen('chat-screen');
    loadChatMessages(); // Load messages when entering chat
});

backToDashboardButton.addEventListener('click', (e) => {
    e.preventDefault();
    showScreen('dashboard-screen');
    // loadDashboardUsers(); // Re-load users
});


//
// ----------------  AUTHENTICATION  ----------------
//

// --- Listen for Auth State Changes ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // User is signed in
        // Fetch user profile from Firestore
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
            currentUser = userDoc.data();
            appUsername.textContent = `Hi, ${currentUser.username}`;
        } else {
            // This shouldn't happen if signup is correct
            currentUser = { email: user.email };
            appUsername.textContent = `Hi, ${user.email}`;
        }
        
        // Go to the app
        showPage('app-page');
        showScreen('dashboard-screen'); // Start on dashboard
        // loadDashboardUsers(); // Load the user list
    } else {
        // User is signed out
        currentUser = null;
        appUsername.textContent = '';
        showPage('login-page');
    }
});

// --- Sign Up Form ---
signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fullname = signupFullname.value;
    const username = signupUsername.value;
    const email = signupEmail.value;
    const password = signupPassword.value;

    try {
        // 1. Create user in Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 2. Create user document in Firestore
        await setDoc(doc(db, 'users', user.uid), {
            uid: user.uid,
            fullname: fullname,
            username: username,
            email: email,
            friends: [] // Start with an empty friends list
        });

        // This will trigger onAuthStateChanged, which will show the app page
        signupForm.reset();
        signupError.textContent = '';

    } catch (error) {
        console.error("Error signing up: ", error);
        signupError.textContent = error.message;
    }
});

// --- Log In Form ---
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = loginEmail.value;
    const password = loginPassword.value;

    try {
        await signInWithEmailAndPassword(auth, email, password);
        // This will trigger onAuthStateChanged, which will show the app page
        loginForm.reset();
        loginError.textContent = '';

    } catch (error) {
        console.error("Error logging in: ", error);
        loginError.textContent = error.message;
    }
});

// --- Log Out Button ---
logoutButton.addEventListener('click', async () => {
    try {
        await signOut(auth);
        // This will trigger onAuthStateChanged, which will show the login page
    } catch (error) {
        console.error("Error logging out: ", error);
    }
});


//
// ----------------  CHAT ROOM FUNCTIONALITY  ----------------
//

// --- Load Chat Messages (Real-time) ---
function loadChatMessages() {
    chatMessagesContainer.innerHTML = 'Loading...';

    const messagesCol = collection(db, 'global-chat');
    const q = query(messagesCol, orderBy('timestamp', 'asc')); // Order by time

    // onSnapshot listens for real-time updates
    chatUnsubscribe = onSnapshot(q, (snapshot) => {
        chatMessagesContainer.innerHTML = ''; // Clear old messages
        
        snapshot.docs.forEach(doc => {
            const message = doc.data();
            renderMessage(message);
        });
        
        // Scroll to the bottom
        chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
    });
}

// --- Render a single message bubble ---
function renderMessage(message) {
    const bubble = document.createElement('div');
    bubble.classList.add('message-bubble');

    // Check if message is from the current user
    if (message.senderId === auth.currentUser.uid) {
        bubble.classList.add('sent');
    } else {
        bubble.classList.add('received');
    }
    
    const sender = document.createElement('span');
    sender.textContent = message.username; // Show username
    
    const text = document.createElement('p');
    text.textContent = message.text;

    bubble.appendChild(sender);
    bubble.appendChild(text);
    chatMessagesContainer.appendChild(bubble);
}

// --- Send Message Form ---
chatMessageForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const messageText = chatMessageInput.value;

    if (messageText.trim() === '' || !currentUser) {
        return; // Don't send empty messages or if not logged in
    }

    try {
        // Add a new message to the 'global-chat' collection
        await addDoc(collection(db, 'global-chat'), {
            text: messageText,
            senderId: auth.currentUser.uid,
            username: currentUser.username, // Use the stored username
            timestamp: serverTimestamp() // Let Firebase set the time
        });

        chatMessageInput.value = ''; // Clear the input field
        
    } catch (error) {
        console.error("Error sending message: ", error);
    }
});

//
// ----------------  INITIAL LOAD  ----------------
//
// Start on the login page by default (auth listener will move user if logged in)
showPage('login-page');
