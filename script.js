// --- Firebase Configuration and Initialization (Using saved data) ---
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
firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const database = firebase.database();
const generalChatRef = database.ref('general_chat'); // Single general chat room

// --- DOM Elements ---
const loginContainer = document.getElementById('login-container');
const chatContainer = document.getElementById('chat-container');

const anonymousLoginBtn = document.getElementById('anonymous-login-btn'); // New button for anonymous login
const logoutBtn = document.getElementById('logout-btn');

const currentUserStatusDisplay = document.getElementById('current-user-status');
const messagesDiv = document.getElementById('messages');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');

const editModal = document.getElementById('edit-modal');
const editMessageTextarea = document.getElementById('edit-message-text');
const saveEditBtn = document.getElementById('save-edit-btn');
const cancelEditBtn = document.getElementById('cancel-edit-btn');

// --- Global State ---
let currentUserID = null;
let activeMessageListener = null;

// --- Utility Functions ---

/**
 * Custom timestamp formatting: "Today at 10:30 AM", "Yesterday at 9:15 PM", or "DD/MM/YYYY at 12:00 PM"
 * Implements the "Yesterday at 10:30Am" requirement.
 * @param {number} timestamp - The UTC timestamp in milliseconds.
 * @returns {string} The formatted relative date/time string.
 */
function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    
    // Function to format time as "HH:MM AM/PM"
    const formatTime = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Function to check if a date is today
    const isToday = (d) => d.getDate() === now.getDate() &&
                          d.getMonth() === now.getMonth() &&
                          d.getFullYear() === now.getFullYear();

    // Function to check if a date is yesterday
    const isYesterday = (d) => {
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        return d.getDate() === yesterday.getDate() &&
               d.getMonth() === yesterday.getMonth() &&
               d.getFullYear() === yesterday.getFullYear();
    };

    if (isToday(date)) {
        return `Today at ${formatTime(date)}`;
    } else if (isYesterday(date)) {
        return `Yesterday at ${formatTime(date)}`;
    } else {
        const formattedDate = date.toLocaleDateString('en-GB'); // DD/MM/YYYY
        return `${formattedDate} at ${formatTime(date)}`;
    }
}


/**
 * Switches the displayed container based on the application state.
 * @param {string} containerId - The ID of the container to show ('login' or 'chat').
 */
function showContainer(containerId) {
    [loginContainer, chatContainer].forEach(container => {
        container.classList.remove('active');
    });
    
    switch (containerId) {
        case 'login':
            loginContainer.classList.add('active');
            break;
        case 'chat':
            chatContainer.classList.add('active');
            break;
    }
}

// --- Chat Logic ---

/**
 * Loads the chat application and sets up the listener for general messages.
 */
function startGeneralChat(uid) {
    currentUserID = uid;
    currentUserStatusDisplay.textContent = `User ID: ${uid.substring(0, 8)}...`;
    
    // Clear previous messages and set up new listener
    messagesDiv.innerHTML = '';
    
    // Remove previous listener if active
    if (activeMessageListener) {
        generalChatRef.off('child_added', activeMessageListener);
        generalChatRef.off('child_changed', activeMessageListener);
    }

    // Load and display messages
    listenForMessages();
    
    showContainer('chat');
    messageInput.focus();
}

/**
 * Listens for new and edited messages in the general chat room.
 */
function listenForMessages() {
    // Listener function that handles both new (child_added) and edited (child_changed) messages
    activeMessageListener = (snapshot) => {
        const messageKey = snapshot.key;
        const message = snapshot.val();
        
        // Check if the message already exists (i.e., it's an edit)
        let messageElement = document.getElementById(messageKey);

        if (messageElement) {
            // --- Handle Message Edit ---
            messageElement.querySelector('.message-content').textContent = message.text;
            
            let editTag = messageElement.querySelector('.message-edit-tag');
            if (message.edited) {
                if (!editTag) {
                    // Add the (edited) tag if it doesn't exist
                    editTag = document.createElement('span');
                    editTag.className = 'message-edit-tag';
                    messageElement.querySelector('.message-timestamp').appendChild(editTag);
                }
                editTag.textContent = ' (edited)';
            }
            // Update the timestamp for clarity
            messageElement.querySelector('.message-timestamp').firstChild.textContent = formatTimestamp(message.timestamp);

        } else {
            // --- Handle New Message ---
            messageElement = createMessageElement(messageKey, message);
            messagesDiv.appendChild(messageElement);
        }
        
        // Scroll to the bottom on new message or update
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    };

    generalChatRef.on('child_added', activeMessageListener);
    generalChatRef.on('child_changed', activeMessageListener);
}

/**
 * Creates the HTML element for a chat message.
 * @param {string} key - Firebase key of the message.
 * @param {object} message - The message object from Firebase.
 * @returns {HTMLElement} The complete message div.
 */
function createMessageElement(key, message) {
    const messageDiv = document.createElement('div');
    messageDiv.id = key;
    // Messages sent by the current user are 'sent', all others are 'received'
    const isSent = message.senderId === currentUserID; 
    messageDiv.className = `message ${isSent ? 'sent' : 'received'}`;

    // Add the sender's UID for 'received' messages
    if (!isSent) {
        const senderLabel = document.createElement('div');
        senderLabel.style.fontWeight = 'bold';
        senderLabel.style.fontSize = '0.8em';
        senderLabel.style.marginBottom = '5px';
        senderLabel.textContent = `User ID: ${message.senderId.substring(0, 8)}...`;
        messageDiv.appendChild(senderLabel);
    }


    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = message.text;
    messageDiv.appendChild(contentDiv);

    const timestampSpan = document.createElement('span');
    timestampSpan.className = 'message-timestamp';
    
    // 1. Add the formatted timestamp (e.g., Yesterday at 10:30 AM)
    const timeText = document.createTextNode(formatTimestamp(message.timestamp));
    timestampSpan.appendChild(timeText);
    
    // 2. Add the (edited) tag if edited
    if (message.edited) {
        const editTag = document.createElement('span');
        editTag.className = 'message-edit-tag';
        editTag.textContent = ' (edited)';
        timestampSpan.appendChild(editTag);
    }

    // 3. Add the Edit Button for sent messages
    if (isSent) {
        const editBtn = document.createElement('button');
        editBtn.className = 'edit-btn';
        editBtn.textContent = 'Edit';
        editBtn.addEventListener('click', () => openEditModal(key, message.text));
        timestampSpan.appendChild(editBtn); 
    }
    
    messageDiv.appendChild(timestampSpan);
    
    return messageDiv;
}


/**
 * Sends a new message to the general chat room.
 */
function sendMessage() {
    const text = messageInput.value.trim();
    if (text === '' || !currentUserID) return;

    const newMessage = {
        senderId: currentUserID,
        text: text,
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        edited: false
    };

    generalChatRef.push(newMessage).then(() => {
        messageInput.value = '';
    }).catch(error => {
        console.error("Error sending message:", error);
        alert("Failed to send message.");
    });
}

// --- Message Editing Logic ---

let messageKeyToEdit = null;

/**
 * Opens the editing modal with the current message content.
 * @param {string} key - The Firebase key of the message to edit.
 * @param {string} currentText - The current text content of the message.
 */
function openEditModal(key, currentText) {
    messageKeyToEdit = key;
    editMessageTextarea.value = currentText;
    editModal.style.display = 'block';
}

/**
 * Saves the edited message back to Firebase.
 */
function saveEditedMessage() {
    if (!messageKeyToEdit) return;

    const newText = editMessageTextarea.value.trim();
    if (newText === '') {
        alert("Message cannot be empty.");
        return;
    }

    generalChatRef.child(messageKeyToEdit).update({
        text: newText,
        edited: true // Set the edited flag to true
    }).then(() => {
        closeEditModal();
        messageKeyToEdit = null;
    }).catch(error => {
        console.error("Error updating message:", error);
        alert("Failed to save edit.");
    });
}

/**
 * Closes the editing modal.
 */
function closeEditModal() {
    editModal.style.display = 'none';
    messageKeyToEdit = null;
    editMessageTextarea.value = '';
}

// --- Authentication Handlers ---

// Anonymous Login
anonymousLoginBtn.addEventListener('click', () => {
    auth.signInAnonymously()
        .catch((error) => {
            alert("Anonymous login failed: " + error.message);
        });
});

logoutBtn.addEventListener('click', () => {
    auth.signOut().then(() => {
        // Auth observer handles the screen change
    });
});

// --- Event Listeners for Chat ---

sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

// Modal Event Listeners
saveEditBtn.addEventListener('click', saveEditedMessage);
cancelEditBtn.addEventListener('click', closeEditModal);


// --- Auth State Observer ---

auth.onAuthStateChanged((user) => {
    if (user) {
        // User is signed in (anonymously)
        // Go straight to the General Chat
        startGeneralChat(user.uid);
    } else {
        // User is signed out
        currentUserID = null;
        
        // Clean up listener
        if (activeMessageListener) {
            generalChatRef.off('child_added', activeMessageListener);
            generalChatRef.off('child_changed', activeMessageListener);
        }
        showContainer('login');
    }
});
