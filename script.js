const firebaseConfig = {
    apiKey: "AIzaSyDCjeloG-2RrirnwY9eiYaKez090exCdZc",
    authDomain: "my-family-tree-16886.firebaseapp.com",
    projectId: "my-family-tree-16886",
    storageBucket: "my-family-tree-16886.firebasestorage.app",
    messagingSenderId: "400708543065",
    appId: "1:400708543065:web:b401629e83ca6f9e780748"
    // Note: The databaseURL is often required but Firebase can sometimes infer it.
    // To be safe, if you have a databaseURL from Firebase, add it here:
    // databaseURL: "https://my-family-tree-16886-default-rtdb.firebaseio.com"
};

// 1. Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
// We use a reference named 'chat_messages' to store all our messages
const messagesRef = database.ref('chat_messages'); 

// 2. Get references to HTML elements
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const usernameInput = document.getElementById('username');
const messagesDiv = document.getElementById('messages');

// 3. Send message to database when button is clicked
sendButton.addEventListener('click', function() {
  const username = usernameInput.value.trim(); // .trim() removes extra spaces
  const message = messageInput.value.trim();

  if (username && message) {
    // Push the message to the Firebase Realtime Database
    messagesRef.push({
      name: username,
      text: message,
      timestamp: Date.now() // Adds a timestamp for potential sorting later
    });
    // Clear the message input box
    messageInput.value = '';
  }
});

// 4. Listen for new messages and display them
// 'child_added' fires once for every existing message and then for every new message
messagesRef.on('child_added', function(snapshot) {
  const msg = snapshot.val();
  
  // Create a new div element for the message
  const msgElement = document.createElement('div');
  msgElement.classList.add('message');
  
  // Display the username in bold and the message text
  msgElement.innerHTML = `<strong>${msg.name}:</strong> ${msg.text}`;
  
  // Add the new message to the chat window
  messagesDiv.appendChild(msgElement);
  
  // Automatically scroll to the bottom of the chat window
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
});
