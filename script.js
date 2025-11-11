 /* =====================================================
  PART 1: FIREBASE IMPORTS & INITIALIZATION
=====================================================
*/
// Import the functions you need from the Firebase SDKs
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
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// Your web app's Firebase configuration (from your saved info)
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

// Initialize and export Firebase services
export const auth = getAuth(app);
export const db = getDatabase(app);

/* =====================================================
  PART 2: DOM ELEMENT SELECTORS
=====================================================
*/
const loginPage = document.getElementById('login-page');
const dashboardPage = document.getElementById('dashboard-page');

// Auth elements
const authForm = document.getElementById('auth-form');
const emailInput = document.getElementById('email-input');
const passwordInput = document.getElementById('password-input');
const loginButton = document.getElementById('login-button');
const signupButton = document.getElementById('signup-button');
const signoutButton = document.getElementById('signout-button');
const authError = document.getElementById('auth-error');
const userEmailSpan = document.getElementById('user-email');

// Chat elements
const chatContainer = document.getElementById('chat-container');
const messagesBox = document.getElementById('messages-box');
const sendMessageForm = document.getElementById('send-message-form');
const messageInput = document.getElementById('message-input');


/* =====================================================
  PART 3: AUTHENTICATION
=====================================================
*/

// --- Auth State Listener ---
// This is the main function that checks if a user is logged in
// and switches the view between the login page and the dashboard.
onAuthStateChanged(auth, (user) => {
    if (user) {
        // User is signed in
        console.log("User is logged in:", user);
        userEmailSpan.textContent = user.email; // Display user's email
        
        // Show dashboard, hide login page
        dashboardPage.classList.remove('hidden');
        loginPage.classList.add('hidden');
        
        // Load chat messages
        loadMessages();

    } else {
        // User is signed out
        console.log("User is signed out");
        
        // Show login page, hide dashboard
        loginPage.classList.remove('hidden');
        dashboardPage.classList.add('hidden');
        userEmailSpan.textContent = ""; // Clear user email
    }
});

// --- Sign Up Button ---
signupButton.addEventListener('click', async (e) => {
    e.preventDefault(); // Prevent form from submitting normally
    authError.textContent = ""; // Clear previous errors
    
    const email = emailInput.value;
    const password = passwordInput.value;

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        console.log("Sign up successful:", userCredential.user);
        // No need to hide/show pages here, onAuthStateChanged will handle it
    } catch (error) {
        console.error("Sign up error:", error.message);
        authError.textContent = error.message; // Show error to the user
    }
});

// --- Login Button ---
loginButton.addEventListener('click', async (e) => {
    e.preventDefault(); // Prevent form from submitting normally
    authError.textContent = ""; // Clear previous errors

    const email = emailInput.value;
    const password = passwordInput.value;

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        console.log("Login successful:", userCredential.user);
        // No need to hide/show pages here, onAuthStateChanged will handle it
    } catch (error) {
        console.error("Login error:", error.message);
        authError.textContent = error.message; // Show error to the user
    }
});

// --- Sign Out Button ---
signoutButton.addEventListener('click', async () => {
    try {
        await signOut(auth);
        console.log("Sign out successful");
        // onAuthStateChanged will handle hiding the dashboard
    } catch (error) {
        console.error("Sign out error:", error);
    }
});


/* =====================================================
  PART 4: REALTIME DATABASE (CHAT)
=====================================================
*/

// --- Send Message ---
sendMessageForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const messageText = messageInput.value;
    
    if (messageText.trim() === "") return; // Don't send empty messages

    const user = auth.currentUser;
    if (!user) {
        console.error("No user logged in to send message");
        return;
    }

    try {
        // Get a reference to the 'messages' path in the database
        const messagesRef = ref(db, 'messages');
        // Create a new unique key for the message
        const newMessageRef = push(messagesRef);
        
        // Set the data for the new message
        await set(newMessageRef, {
            email: user.email,
            uid: user.uid,
            text: messageText,
            timestamp: serverTimestamp() // Firebase provides the current server time
        });

        console.log("Message sent!");
        messageInput.value = ""; // Clear the input field
    } catch (error) {
        console.error("Error sending message:", error);
    }
});

// --- Load Messages ---
function loadMessages() {
    const messagesRef = ref(db, 'messages');
    
    // Listen for new data at 'messages'
    // This function will run every time data is added/changed
    onValue(messagesRef, (snapshot) => {
        messagesBox.innerHTML = ""; // Clear the chat box
        const data = snapshot.val();
        
        if (data) {
            // Loop through all messages and display them
            Object.values(data).forEach((message) => {
                displayMessage(message.email, message.text);
            });
        }
        
        // Scroll to the bottom
        messagesBox.scrollTop = messagesBox.scrollHeight;
    });
}

// --- Helper function to display a single message ---
function displayMessage(email, text) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');
    
    const emailElement = document.createElement('strong');
    emailElement.textContent = email;
    
    const textElement = document.createElement('span');
    textElement.textContent = text;
    
    messageElement.appendChild(emailElement);
    messageElement.appendChild(textElement);
    
    messagesBox.appendChild(messageElement);
}
