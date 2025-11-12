// --- Firebase Configuration and Initialization (Using saved data) ---
const firebaseConfig = {
    apiKey: "AIzaSyDJFQnwOs-fetKVy0Ow43vktz8xwefZMks",
    authDomain: "cyou-db8f0.firebaseapp.com",
    projectId: "cyou-db8f0",
    storageBucket: "cyou-db8f0.firebasestorage.app", // Included but not used due to constraint
    messagingSenderId: "873569975141",
    appId: "1:873569975141:web:147eb7b7b4043a38c9bf8c",
    measurementId: "G-T66B50HFJ8" // Included but not used
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const database = firebase.database();

// --- DOM Elements ---
const loginContainer = document.getElementById('login-container');
const dashboardContainer = document.getElementById('dashboard-container');
const chatContainer = document.getElementById('chat-container');

const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const signupBtn = document.getElementById('signup-btn');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');

const currentUserEmailDisplay = document.getElementById('current-user-email');
const userList = document.getElementById('user-list');

const backToDashboardBtn = document.getElementById('back-to-dashboard-btn');
const chatPartnerEmailDisplay = document.getElementById('chat-partner-email');
const messagesDiv = document.getElementById('messages');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');

const editModal = document.getElementById('edit-modal');
const editMessageTextarea = document.getElementById('edit-message-text');
const saveEditBtn = document.getElementById('save-edit-btn');
const cancelEditBtn = document.getElementById('cancel-edit-btn');

// --- Global State ---
let currentUserID = null;
let currentChatPartnerID = null;
let currentChatPartnerEmail = null;
let currentChatRef = null;
let activeMessageListener = null;

// --- Utility Functions ---

/**
 * Custom timestamp formatting: "Today at 10:30 AM", "Yesterday at 9:15 PM", or "DD/MM/YYYY at 12:00 PM"
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
 * Determines the private chat room path by sorting the two UIDs.
 * @param {string} uid1 - User ID 1.
 * @param {string} uid2 - User ID 2.
 * @returns {string} The sorted chat room key.
 */
function getChatRoomKey(uid1, uid2) {
    return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;
}

/**
 * Switches the displayed container based on the application state.
 * @param {string} containerId - The ID of the container to show ('login', 'dashboard', 'chat').
 */
function showContainer(containerId) {
    [loginContainer, dashboardContainer, chatContainer].forEach(container => {
        container.classList.remove('active');
    });
    
    switch (containerId) {
        case 'login':
            loginContainer.classList.add('active');
            break;
        case 'dashboard':
            dashboardContainer.classList.add('active');
            break;
        case 'chat':
            chatContainer.classList.add('active');
            break;
    }
}

// --- User Management and Dashboard ---

/**
 * Loads all registered users from the 'users' node and displays them on the dashboard.
 */
function loadUserList() {
    userList.innerHTML = ''; // Clear previous list
    const usersRef = database.ref('users');
    
    usersRef.once('value', (snapshot) => {
        const users = snapshot.val();
        if (users) {
            Object.keys(users).forEach(uid => {
                // Skip the currently logged-in user
                if (uid !== currentUserID) {
                    const email = users[uid].email;
                    const listItem = document.createElement('li');
                    listItem.textContent = email;
                    listItem.dataset.uid = uid;
                    listItem.dataset.email = email;
                    
                    // Attach click handler to start chat
                    listItem.addEventListener('click', () => startPrivateChat(uid, email));
                    
                    userList.appendChild(listItem);
                }
            });
        } else {
            userList.innerHTML = '<p>No other users registered.</p>';
        }
    });
}

/**
 * Stores user data (UID and email) in the 'users' node upon successful login/signup.
 * @param {object} user - The Firebase User object.
 */
function saveUserData(user) {
    database.ref('users/' + user.uid).set({
        email: user.email,
        lastOnline: firebase.database.ServerValue.TIMESTAMP
    });
}

// --- Chat Logic ---

/**
 * Starts a private chat session with a selected user.
 * @param {string} partnerUID - The UID of the user to chat with.
 * @param {string} partnerEmail - The email of the user to chat with.
 */
function startPrivateChat(partnerUID, partnerEmail) {
    currentChatPartnerID = partnerUID;
    currentChatPartnerEmail = partnerEmail;
    chatPartnerEmailDisplay.textContent = `Chatting with: ${partnerEmail}`;
    
    // Get the sorted chat room key
    const chatRoomKey = getChatRoomKey(currentUserID, currentChatPartnerID);
    currentChatRef = database.ref(`private_chats/${chatRoomKey}`);
    
    // Clear previous messages and set up new listener
    messagesDiv.innerHTML = '';
    
    // Remove previous listener if active
    if (activeMessageListener) {
        currentChatRef.off('child_added', activeMessageListener);
        currentChatRef.off('child_changed', activeMessageListener);
    }

    // Load and display messages
    listenForMessages();
    
    showContainer('chat');
    messageInput.focus();
}

/**
 * Listens for new and edited messages in the current private chat room.
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
            // Update the timestamp for clarity if needed, though usually editing doesn't change original sent time
            messageElement.querySelector('.message-timestamp').firstChild.textContent = formatTimestamp(message.timestamp);

        } else {
            // --- Handle New Message ---
            messageElement = createMessageElement(messageKey, message);
            messagesDiv.appendChild(messageElement);
        }
        
        // Scroll to the bottom on new message or update
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    };

    currentChatRef.on('child_added', activeMessageListener);
    currentChatRef.on('child_changed', activeMessageListener);
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
    messageDiv.className = `message ${message.senderId === currentUserID ? 'sent' : 'received'}`;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = message.text;
    messageDiv.appendChild(contentDiv);

    const timestampSpan = document.createElement('span');
    timestampSpan.className = 'message-timestamp';
    
    // 1. Add the formatted timestamp
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
    if (message.senderId === currentUserID) {
        const editBtn = document.createElement('button');
        editBtn.className = 'edit-btn';
        editBtn.textContent = 'Edit';
        editBtn.addEventListener('click', () => openEditModal(key, message.text));
        timestampSpan.appendChild(editBtn); // Append edit button next to timestamp
    }
    
    messageDiv.appendChild(timestampSpan);
    
    return messageDiv;
}


/**
 * Sends a new message to the current chat room.
 */
function sendMessage() {
    const text = messageInput.value.trim();
    if (text === '' || !currentChatRef) return;

    const newMessage = {
        senderId: currentUserID,
        text: text,
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        edited: false
    };

    currentChatRef.push(newMessage).then(() => {
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

    currentChatRef.child(messageKeyToEdit).update({
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

signupBtn.addEventListener('click', () => {
    auth.createUserWithEmailAndPassword(emailInput.value, passwordInput.value)
        .then((userCredential) => {
            saveUserData(userCredential.user);
        })
        .catch((error) => {
            alert("Signup failed: " + error.message);
        });
});

loginBtn.addEventListener('click', () => {
    auth.signInWithEmailAndPassword(emailInput.value, passwordInput.value)
        .catch((error) => {
            alert("Login failed: " + error.message);
        });
});

logoutBtn.addEventListener('click', () => {
    auth.signOut().then(() => {
        console.log("User signed out.");
    });
});

// --- Event Listeners for Chat/Dashboard ---

sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

backToDashboardBtn.addEventListener('click', () => {
    // Clean up current chat listener before going back
    if (currentChatRef && activeMessageListener) {
        currentChatRef.off('child_added', activeMessageListener);
        currentChatRef.off('child_changed', activeMessageListener);
    }
    currentChatRef = null;
    currentChatPartnerID = null;
    currentChatPartnerEmail = null;
    
    // Reload user list just in case
    loadUserList(); 
    showContainer('dashboard');
});

// Modal Event Listeners
saveEditBtn.addEventListener('click', saveEditedMessage);
cancelEditBtn.addEventListener('click', closeEditModal);


// --- Auth State Observer ---

auth.onAuthStateChanged((user) => {
    if (user) {
        // User is signed in
        currentUserID = user.uid;
        currentUserEmailDisplay.textContent = `Logged in as: ${user.email}`;
        
        // Ensure user data is up-to-date and load the dashboard
        saveUserData(user); 
        loadUserList();
        showContainer('dashboard');
    } else {
        // User is signed out
        currentUserID = null;
        currentChatPartnerID = null;
        currentChatPartnerEmail = null;
        if (currentChatRef && activeMessageListener) {
            currentChatRef.off('child_added', activeMessageListener);
            currentChatRef.off('child_changed', activeMessageListener);
        }
        showContainer('login');
    }
});
