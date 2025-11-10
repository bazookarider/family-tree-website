// ====================================================================
// !!! 1. YOUR FIREBASE CONFIG ATTACHED HERE !!!
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
const messagesRef = database.ref('chat_messages');
const typingRef = database.ref('typing_status'); 

// Get references to HTML elements
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const usernameInput = document.getElementById('username');
const messagesDiv = document.getElementById('messages');
const typingIndicatorDiv = document.getElementById('typing-indicator');

let typingTimer;
let isTyping = false;
const typingTimeout = 1500; // 1.5 seconds

// Helper function to get a unique, sanitized user key
function getCurrentUserKey() {
    const username = usernameInput.value.trim();
    return username ? username.replace(/[^a-zA-Z0-9]/g, '_') : null;
}

// Function to stop typing status in Firebase
function stopTyping() {
    isTyping = false;
    const userKey = getCurrentUserKey();
    if (userKey) {
        typingRef.child(userKey).set(false);
    }
}

// 1. Send message logic
sendButton.addEventListener('click', function() {
    const username = usernameInput.value.trim();
    const message = messageInput.value.trim();

    if (username && message) {
        messagesRef.push({
            name: username,
            text: message,
            timestamp: Date.now() 
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
    
    // Update the indicator text
    if (typers.length > 0) {
        let text = typers.join(', ');
        if (typers.length === 1) {
            text += ' is typing...';
        } else {
            // Format for "User 1, User 2, and User 3 are typing..."
            const lastCommaIndex = text.lastIndexOf(',');
            if (lastCommaIndex !== -1) {
                 text = text.substring(0, lastCommaIndex) + ' and' + text.substring(lastCommaIndex + 1);
            }
            text += ' are typing...';
        }
        typingIndicatorDiv.textContent = text;
        typingIndicatorDiv.style.display = 'block';
    } else {
        typingIndicatorDiv.style.display = 'none';
    }
});

// 4. Listener for new messages and display
messagesRef.on('child_added', function(snapshot) {
    const msg = snapshot.val();
    
    // 1. Create the message row container
    const msgRow = document.createElement('div');
    msgRow.classList.add('message-row');

    // 2. Create the avatar placeholder
    const avatar = document.createElement('div');
    avatar.classList.add('avatar');
    avatar.textContent = msg.name.trim().charAt(0).toUpperCase(); 

    // 3. Create the message bubble
    const msgElement = document.createElement('div');
    msgElement.classList.add('message');
    
    msgElement.innerHTML = `<strong>${msg.name}:</strong> ${msg.text}`;
    
    msgRow.appendChild(avatar);
    msgRow.appendChild(msgElement);
    
    messagesDiv.appendChild(msgRow);
    
    // Scroll to the bottom
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
});
