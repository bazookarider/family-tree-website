// --- IMPORTS ---
// Import the functions you need from the SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    getDoc,
    setDoc,
    writeBatch,
    collection, 
    addDoc, 
    query, 
    orderBy, 
    onSnapshot,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// --- FIREBASE CONFIG ---
// Your Web App's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDCjeloG-2RrirnwY9eiYaKez090exCdZc",
    authDomain: "my-family-tree-16886.firebaseapp.com",
    projectId: "my-family-tree-16886",
    storageBucket: "my-family-tree-16886.firebasestorage.app",
    messagingSenderId: "400708543065",
    appId: "1:400708543065:web:b401629e83ca6f9e780748"
};

// --- INITIALIZE FIREBASE & SERVICES ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- DOM ELEMENTS ---
// Loaders
const loadingOverlay = document.getElementById('loading-overlay');

// Auth Containers
const authContainer = document.getElementById('auth-container');
const loginCard = document.getElementById('login-card');
const signupCard = document.getElementById('signup-card');

// Auth Forms
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');

// Auth Buttons
const showSignupBtn = document.getElementById('show-signup-btn');
const showLoginBtn = document.getElementById('show-login-btn');

// Auth Error Messages
const loginError = document.getElementById('login-error');
const signupError = document.getElementById('signup-error');

// Chat Container
const chatContainer = document.getElementById('chat-container');
const userDisplayName = document.getElementById('user-display-name');
const logoutBtn = document.getElementById('logout-btn');
const chatMessages = document.getElementById('chat-messages');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');


// --- GLOBAL STATE ---
let currentUserProfile = null; // Will hold Firestore user data (displayName, username)
let messagesListener = null;   // Will hold the onSnapshot unsubscribe function

// --- UI MANAGEMENT ---

// Show the loading overlay
function showLoading() {
    loadingOverlay.classList.remove('hidden');
    authContainer.classList.add('hidden');
    chatContainer.classList.add('hidden');
}

// Show the login/signup forms
function showAuthUI() {
    loadingOverlay.classList.add('hidden');
    authContainer.classList.remove('hidden');
    chatContainer.classList.add('hidden');
    // Default to login card
    loginCard.classList.remove('hidden');
    signupCard.classList.add('hidden');
}

// Show the main chat application
function showChatUI() {
    loadingOverlay.classList.add('hidden');
    authContainer.classList.add('hidden');
    chatContainer.classList.remove('hidden');
}

// Toggle between Login and Sign Up cards
showSignupBtn.addEventListener('click', () => {
    loginCard.classList.add('hidden');
    signupCard.classList.remove('hidden');
});

showLoginBtn.addEventListener('click', () => {
    loginCard.classList.remove('hidden');
    signupCard.classList.add('hidden');
});

// --- AUTHENTICATION HUB (The Core) ---
// Listen for changes in authentication state
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // --- User is LOGGED IN ---
        console.log("Auth state changed: User is logged in", user.uid);
        
        // 1. Get user's profile from Firestore
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
            // 2. Store profile and update UI
            currentUserProfile = userDoc.data();
            userDisplayName.textContent = `Welcome, ${currentUserProfile.displayName}`;
            
            // 3. Start listening for chat messages
            listenForMessages();

            // 4. Show the chat application
            showChatUI();
        } else {
            // This is an error state: user exists in Auth, but not Firestore
            console.error("Error: No user profile found in Firestore!");
            // Log them out to be safe
            await signOut(auth);
        }

    } else {
        // --- User is LOGGED OUT ---
        console.log("Auth state changed: User is logged out");
        currentUserProfile = null;

        // 1. Stop listening for messages (if we were)
        if (messagesListener) {
            messagesListener(); // This unsubscribes from the snapshot
            messagesListener = null;
        }

        // 2. Clear chat messages
        chatMessages.innerHTML = '';
        
        // 3. Show the login/signup page
        showAuthUI();
    }
});

// --- AUTH: SIGN UP ---
signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoading(); // Show loader during sign-up
    signupError.textContent = ""; // Clear old errors

    // Get form data
    const fullName = document.getElementById('signup-name').value;
    const username = document.getElementById('signup-username').value.trim().toLowerCase();
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;

    // --- Start of our 3-Step Sign-Up Process ---
    try {
        // STEP 1: Check if the Username is Taken
        const usernameDocRef = doc(db, "usernames", username);
        const usernameDoc = await getDoc(usernameDocRef);
        if (usernameDoc.exists()) {
            throw new Error("auth/username-taken");
        }

        // STEP 2: Create the User (The "Key") in Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        console.log("Step 2 Success: Auth user created", user.uid);

        // STEP 3: Save the Profile (The "Identity") to Firestore
        // We use a "batch" to make this an all-or-nothing operation
        const batch = writeBatch(db);

        // 3a. Reserve the username
        const newUsernameRef = doc(db, "usernames", username);
        batch.set(newUsernameRef, { uid: user.uid });

        // 3b. Create their profile
        const newUserRef = doc(db, "users", user.uid);
        batch.set(newUserRef, {
            uid: user.uid,
            username: "@" + username,
            displayName: fullName,
            email: email,
            createdAt: serverTimestamp()
        });

        // Commit both writes at the same time
        await batch.commit();
        console.log("Step 3 Success: User profile created in Firestore");

        // Success! onAuthStateChanged will now take over and log the user in.
        
    } catch (error) {
        console.error("Sign-up failed:", error.code, error.message);
        signupError.textContent = getAuthErrorMessage(error);
        showAuthUI(); // Show forms again on error
    }
});

// --- AUTH: LOG IN ---
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoading();
    loginError.textContent = "";

    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        await signInWithEmailAndPassword(auth, email, password);
        // Success! onAuthStateChanged will take over.
    } catch (error) {
        console.error("Login failed:", error.code);
        loginError.textContent = getAuthErrorMessage(error);
        showAuthUI(); // Show forms again on error
    }
});

// --- AUTH: LOG OUT ---
logoutBtn.addEventListener('click', async () => {
    showLoading();
    await signOut(auth);
    // Success! onAuthStateChanged will take over.
});


// --- FIRESTORE: SEND MESSAGE ---
messageForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const messageText = messageInput.value.trim();

    // Check if we have a user and the message isn't empty
    if (messageText.length > 0 && currentUserProfile) {
        try {
            // Add a new document to the "messages" collection
            await addDoc(collection(db, "messages"), {
                text: messageText,
                uid: currentUserProfile.uid,
                displayName: currentUserProfile.displayName, // Store the name for history
                createdAt: serverTimestamp() // Use server time for consistency
            });

            console.log("Message sent!");
            messageInput.value = ''; // Clear the input field
            
            // Note: We don't need to scroll here, 
            // the onSnapshot listener will see our new message and handle it
            
        } catch (error) {
            console.error("Error sending message: ", error);
        }
    }
});

// --- FIRESTORE: GET MESSAGES ---
function listenForMessages() {
    // Create a query to get all messages, ordered by when they were created
    const messagesQuery = query(collection(db, "messages"), orderBy("createdAt", "asc"));

    // onSnapshot creates a real-time listener
    messagesListener = onSnapshot(messagesQuery, (snapshot) => {
        chatMessages.innerHTML = ''; // Clear the existing messages

        snapshot.forEach((doc) => {
            // For each message document, create a new message element
            const messageData = doc.data();
            displayMessage(messageData);
        });

        // Auto-scroll to the newest message
        chatMessages.scrollTop = chatMessages.scrollHeight;
    });
}

// --- HELPER: DISPLAY A SINGLE MESSAGE ---
function displayMessage(messageData) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');

    // Check if the message was sent by the current user
    if (messageData.uid === currentUserProfile.uid) {
        messageElement.classList.add('sent');
    } else {
        messageElement.classList.add('received');
    }

    // Use the displayName *saved with the message*
    const sender = (messageData.uid === currentUserProfile.uid) ? 'You' : messageData.displayName;

    messageElement.innerHTML = `
        <div class="meta">${sender}</div>
        <div class="text">${messageData.text}</div>
    `;
    
    chatMessages.appendChild(messageElement);
}

// --- HELPER: ERROR MESSAGES ---
function getAuthErrorMessage(error) {
    switch (error.code) {
        case "auth/username-taken":
            return "That username is already taken. Please try another.";
        case "auth/email-already-in-use":
            return "That email address is already in use.";
        case "auth/weak-password":
            return "Password must be at least 6 characters long.";
        case "auth/invalid-email":
            return "Please enter a valid email address.";
        case "auth/user-not-found":
        case "auth/wrong-password":
        case "auth/invalid-credential":
            return "Invalid email or password. Please try again.";
        default:
            return "An unexpected error occurred. Please try again.";
    }
}
