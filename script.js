// ====================================================================
// !!! 1. YOUR FIREBASE CONFIG (UNCHANGED) !!!
// ====================================================================
const firebaseConfig = {
    apiKey: "AIzaSyDCjeloG-2RrirnwY9eiYaKez090exCdZc",
    authDomain: "my-family-tree-16886.firebaseapp.com",
    projectId: "my-family-tree-16886",
    storageBucket: "my-family-tree-16886.firebasestorage.app",
    messagingSenderId: "400708543065",
    appId: "1:400708543065:web:b401629e83ca6f9e780748"
};
// ====================================================================

// Initialize Firebase and references
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const auth = firebase.auth(); // NEW: Initialize Authentication

const messagesRef = database.ref('chat_messages');
const typingRef = database.ref('typing_status'); 

// NEW: Global variables for the current user
let currentUsername = "Guest"; // Default username
let currentUser = null; // Will hold the auth user object

// === NEW: Login Screen Elements ===
const loginOverlay = document.getElementById('login-overlay');
const loginNameInput = document.getElementById('login-name-input');
const joinChatButton = document.getElementById('join-chat-button');
const appContainer = document.getElementById('app-container');

// === Chat App Elements ===
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
// const usernameInput = document.getElementById('username'); // OLD: This is GONE
const messagesDiv = document.getElementById('messages');
const typingIndicatorDiv = document.getElementById('typing-indicator');

let typingTimer;
let isTyping = false;
const typingTimeout = 1500;

// === NEW: Phase 1 - Authentication & Login Logic ===

// Function to save the user's name in the browser
function saveNameLocally(name) {
    localStorage.setItem('cyou-username', name);
}

// Function to load the user's name from the browser
function getLocalName() {
    return localStorage.getItem('cyou-username');
}

// Function to show the chat app and hide the login
function showChatApp(name) {
    currentUsername = name; // Set the global username
    loginOverlay.classList.add('hidden'); // Hide login
    appContainer.style.visibility = 'visible'; // Show app
    loadMessages(); // Load messages AFTER user is logged in
}

// 1. Listen for the "Join Chat" button click
joinChatButton.addEventListener('click', function() {
    const name = loginNameInput.value.trim();
    if (name.length < 2) {
        alert('Please enter a valid name (at least 2 characters).');
        return;
    }
    
    // This is where we will create the profile in Phase 2
    // For now, just save the name and show the app
    saveNameLocally(name);
    showChatApp(name);
});

// 2. Main Authentication Check when the page loads
auth.onAuthStateChanged(function(user) {
    if (user) {
        // User is already signed in (anonymously)
        currentUser = user;
        const savedName = getLocalName();
        if (savedName) {
            // User is signed in AND has a name saved
            // Go straight to the chat
            showChatApp(savedName);
        } else {
            // User is signed in but hasn't set a name
            // Show the login screen
            loginOverlay.classList.remove('hidden');
        }
    } else {
        // User is not signed in
        // Sign them in anonymously
        auth.signInAnonymously().catch(function(error) {
            console.error("Error signing in anonymously:", error);
            alert("Could not connect to chat. Please refresh.");
        });
        // The page will reload the auth state and run this function again
    }
});

// === END OF LOGIN LOGIC ===


// === Chat App Logic (Modified) ===

// Helper function to get a unique, sanitized user key
function getCurrentUserKey() {
    // Uses the global username now
    return currentUsername ? currentUsername.replace(/[^a-zA-Z0-9]/g, '_') : null;
}

// Function to stop typing status in Firebase
function stopTyping() {
    isTyping = false;
    const userKey = getCurrentUserKey();
    if (userKey) {
        typingRef.child(userKey).set(false);
    }
}

// Helper function to format timestamp
function formatTime(timestamp) {
    const date = new Date(timestamp);
    const options = { hour: 'numeric', minute: '2-digit', hour12: true };
    return date.toLocaleTimeString('en-US', options);
}

// 1. Send message logic
sendButton.addEventListener('click', function() {
    const message = messageInput.value.trim();

    // Uses the global 'currentUsername'
    if (currentUsername && message) {
        messagesRef.push({
            name: currentUsername,
            text: message,
            timestamp: Date.now(),
            userId: currentUser.uid // NEW: Attach the secret unique ID
        });
        messageInput.value = '';
        stopTyping();
    }
});

// 2. Typing status logic
messageInput.addEventListener('keyup', function() {
    const userKey = getCurrentUserKey();
    if (!userKey) return;
    if (!isTyping) {
        isTyping = true;
        typingRef.child(userKey).set(true);
    }
    clearTimeout(typingTimer);
    typingTimer = setTimeout(stopTyping, typingTimeout);
});

// 3. Listener for other users typing
typingRef.on('value', function(snapshot) {
    const typingUsers = snapshot.val() || {};
    const currentKey = getCurrentUserKey();
    let typers = [];
    for (let key in typingUsers) {
        if (typingUsers[key] === true && key !== currentKey) {
            typers.push(key.replace(/_/g, ' ')); 
        }
    }
    if (typers.length > 0) {
        let text = typers.join(', ');
        if (typers.length === 1) text += ' is typing...';
        else {
            const lastCommaIndex = text.lastIndexOf(',');
            if (lastCommaIndex !== -1) text = text.substring(0, lastCommaIndex) + ' and' + text.substring(lastCommaIndex + 1);
            text += ' are typing...';
        }
        typingIndicatorDiv.textContent = text;
        typingIndicatorDiv.style.display = 'block';
    } else {
        typingIndicatorDiv.style.display = 'none';
    }
});

// 4. Listener for new messages - MUST be in a function now
// We call this AFTER the user logs in
function loadMessages() {
    messagesRef.orderByChild('timestamp').on('child_added', function(snapshot) {
        const msg = snapshot.val();
        
        const msgRow = document.createElement('div');
        msgRow.classList.add('message-row');

        // Check if the message is from the current user
        // We use the secret UID for a perfect check
        const isMine = msg.userId === currentUser.uid;

        if (isMine) {
            msgRow.classList.add('my-message-row');
        }

        const avatar = document.createElement('div');
        avatar.classList.add('avatar');
        avatar.textContent = msg.name.trim().charAt(0).toUpperCase(); 

        const msgElement = document.createElement('div');
        msgElement.classList.add('message');
        
        msgElement.innerHTML = 
            `<span class="message-time">${formatTime(msg.timestamp)}</span>` +
            `<strong class="message-name">${msg.name}:</strong> ${msg.text}`;
        
        if (!isMine) {
            msgRow.appendChild(avatar);
        }

        msgRow.appendChild(msgElement);
        messagesDiv.appendChild(msgRow);
        
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    });
}
