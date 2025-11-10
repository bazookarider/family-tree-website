//
// 1. YOUR FIREBASE CONFIGURATION
//
const firebaseConfig = {
    apiKey: "AIzaSyDCjeloG-2RrirnwY9eiYaKez090exCdZc",
    authDomain: "my-family-tree-16886.firebaseapp.com",
    projectId: "my-family-tree-16886",
    storageBucket: "my-family-tree-16886.firebasestorage.app",
    messagingSenderId: "400708543065",
    appId: "1:400708543065:web:b401629e83ca6f9e780748"
};

// 2. Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth(); // Get the Auth service

// 3. Get references to our HTML elements
const loginButton = document.getElementById("login-button");
const loadingMessage = document.getElementById("loading-message");

// 4. Add the click event listener
loginButton.addEventListener("click", () => {
    
    // Show loading message and hide button
    loadingMessage.classList.remove("hidden");
    loginButton.classList.add("hidden");

    // 5. This is the "Phase 1" Authentication code
    // We sign the user in anonymously
    auth.signInAnonymously()
      .then((userCredential) => {
        // It worked! The user is signed in.
        const user = userCredential.user;
        console.log("Anonymous user signed in:", user.uid);
        
        // NOW WE GO TO THE NEXT PAGE
        // This page matches your Firebase rules for creating a user
        window.location.href = "profile.html"; 
      })
      .catch((error) => {
        // It failed. Show an error.
        console.error("Anonymous login failed:", error);
        loadingMessage.innerText = "Login Failed. Please try again.";
        // Show the button again so they can retry
        loginButton.classList.remove("hidden");
      });
});
