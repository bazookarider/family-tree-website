// --- Your Firebase Config (already included) ---
const firebaseConfig = {
    apiKey: "AIzaSyDCjeloG-2RrirnwY9eiYaKez090exCdZc",
    authDomain: "my-family-tree-16886.firebaseapp.com",
    projectId: "my-family-tree-16886",
    storageBucket: "my-family-tree-16886.firebasestorage.app",
    messagingSenderId: "400708543065",
    appId: "1:400708543065:web:b401629e83ca6f9e780748"
};
// -----------------------------------------------

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
// THIS IS THE FIX: Use Realtime Database, not Firestore
const db = firebase.database(); 

// Get references to HTML elements
const loginView = document.getElementById('login-view');
const chatView = document.getElementById('chat-view');
const joinBtn = document.getElementById('join-btn');
const nameInput = document.getElementById('name-input');
const welcomeMessage = document.getElementById('welcome-message');

const logoutBtn = document.getElementById('logout-btn');
const sendBtn = document.getElementById('send-btn');
const messageInput = document.getElementById('message-input');
const chatContainer = document.getElementById('chat-container');

let currentUserName = "Guest";
let messageListener = null; // To store our database listener
// Reference to your 'chat_messages' folder in Realtime Database
let messagesRef = db.ref('chat_messages');


// --- 1. AUTHENTICATION ---

// Listen for authentication state changes (login/logout)
auth.onAuthStateChanged(user => {
    if (user) {
        // User is logged in
        currentUserName = localStorage.getItem('chatUserName') || 'Anonymous';
        
        chatView.classList.remove('hidden');
        loginView.classList.add('hidden');
        welcomeMessage.textContent = `Welcome, ${currentUserName}`;
        
        // Start listening for new messages
        loadMessages();

    } else {
        // User is logged out
        chatView.classList.add('hidden');
        loginView.classList.remove('hidden');
        welcomeMessage.textContent = '';
        
        // Stop listening to the database
        if (messageListener) {
            messagesRef.off('value', messageListener); // Detach the listener
        }
    }
});

// "Join Chat" button click
joinBtn.addEventListener('click', () => {
    const name = nameInput.value.trim();
    if (name.length < 2) {
        alert('Please enter a valid name.');
        return;
    }

    localStorage.setItem('chatUserName', name);
    
    // Sign the user in anonymously
    auth.signInAnonymously().catch(error => {
        console.error("Error signing in:", error);
        alert("Could not log in.");
    });
});

// "Logout" button click
logoutBtn.addEventListener('click', () => {
    auth.signOut();
});

// --- 2. REALTIME DATABASE (MESSAGES) ---

// Function to send a message
function sendMessage() {
    const text = messageInput.value.trim();
    if (text === "") return;

    const user = auth.currentUser;
    if (!user) {
        alert("You are not logged in!");
        return;
    }

    // This creates the message object
    const message = {
        name: currentUserName,
        text: text,
        uid: user.uid,
        // THIS IS THE FIX: Use Realtime Database timestamp
        timestamp: firebase.database.ServerValue.TIMESTAMP 
    };

    // THIS IS THE FIX: Push the message to the 'chat_messages' ref
    messagesRef.push(message)
        .then(() => {
            // Message sent! Clear the input box.
            messageInput.value = "";
        })
        .catch(error => {
            console.error("Error sending message: ", error);
            alert("Message failed to send. Check your Database Rules.");
        });
}

// "Send" button click
sendBtn.addEventListener('click', sendMessage);

// Also send when user presses "Enter"
messageInput.addEventListener('keyup', (event) => {
    if (event.key === "Enter") {
        sendMessage();
    }
});

// Function to load and display messages
function loadMessages() {
    // THIS IS THE FIX: Listen to the 'chat_messages' ref, ordered by time
    messagesRef = db.ref('chat_messages').orderByChild("timestamp");
    
    messageListener = messagesRef.on('value', snapshot => {
        chatContainer.innerHTML = ""; // Clear old messages
        
        snapshot.forEach(childSnapshot => {
            const message = childSnapshot.val();
            displayMessage(message);
A        });
        
        // Scroll to the newest message
        chatContainer.scrollTop = chatContainer.scrollHeight;
    });
}

// Function to create and show a single message bubble
// (This function is the same as before)
function displayMessage(message) {
    const user = auth.currentUser;
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message');

    if (user && message.uid === user.uid) {
        msgDiv.classList.add('sent');
    } else {
        msgDiv.classList.add('received');
        
        const senderName = document.createElement('div');
        senderName.classList.add('message-sender');
        senderName.textContent = message.name;
        msgDiv.appendChild(senderName);
    }

    const msgText = document.createElement('span');
    msgText.textContent = message.text;
    msgDiv.appendChild(msgText);

    chatContainer.appendChild(msgDiv);
}
