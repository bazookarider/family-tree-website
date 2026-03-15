import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Replace this with your real Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyAG6jDGHVoZ-yHSqvgxbU2RHewvCURcTZI",
  authDomain: "study-hub-ai-a6591.firebaseapp.com",
  projectId: "study-hub-ai-a6591",
  storageBucket: "study-hub-ai-a6591.firebasestorage.app",
  messagingSenderId: "535236262155",
  appId: "1:535236262155:web:9aa462da354c0dbd9e8a0e",
  measurementId: "G-5K2GNV8QVB"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// AUTH ELEMENTS
const authScreen = document.getElementById("authScreen");
const appShell = document.getElementById("appShell");

const showLogin = document.getElementById("showLogin");
const showRegister = document.getElementById("showRegister");

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");

const loginBtn = document.getElementById("loginBtn");
const registerBtn = document.getElementById("registerBtn");
const logoutBtn = document.getElementById("logoutBtn");

// INPUTS
const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");

const registerName = document.getElementById("registerName");
const registerEmail = document.getElementById("registerEmail");
const registerPassword = document.getElementById("registerPassword");

// MESSAGES
const loginMessage = document.getElementById("loginMessage");
const registerMessage = document.getElementById("registerMessage");
const uploadMessage = document.getElementById("uploadMessage");

// DASHBOARD
const welcomeText = document.getElementById("welcomeText");
const handoutFile = document.getElementById("handoutFile");
const uploadBtn = document.getElementById("uploadBtn");

const toolButtons = document.querySelectorAll(".tool-btn");
const aiPrompt = document.getElementById("aiPrompt");
const askAiBtn = document.getElementById("askAiBtn");
const aiOutput = document.getElementById("aiOutput");

// SWITCH TABS
showLogin.addEventListener("click", () => {
  showLogin.classList.add("active");
  showRegister.classList.remove("active");
  loginForm.classList.remove("hidden");
  registerForm.classList.add("hidden");
  loginMessage.textContent = "";
  registerMessage.textContent = "";
});

showRegister.addEventListener("click", () => {
  showRegister.classList.add("active");
  showLogin.classList.remove("active");
  registerForm.classList.remove("hidden");
  loginForm.classList.add("hidden");
  loginMessage.textContent = "";
  registerMessage.textContent = "";
});

// REGISTER
registerBtn.addEventListener("click", async () => {
  const name = registerName.value.trim();
  const email = registerEmail.value.trim();
  const password = registerPassword.value.trim();

  registerMessage.textContent = "";

  if (!name || !email || !password) {
    registerMessage.textContent = "Please fill in all registration fields.";
    return;
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);

    await updateProfile(userCredential.user, {
      displayName: name
    });

    registerMessage.textContent = "Registration successful.";
    registerName.value = "";
    registerEmail.value = "";
    registerPassword.value = "";
  } catch (error) {
    registerMessage.textContent = formatFirebaseError(error.code);
  }
});

// LOGIN
loginBtn.addEventListener("click", async () => {
  const email = loginEmail.value.trim();
  const password = loginPassword.value.trim();

  loginMessage.textContent = "";

  if (!email || !password) {
    loginMessage.textContent = "Please enter your email and password.";
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, password);
    loginMessage.textContent = "Login successful.";
    loginEmail.value = "";
    loginPassword.value = "";
  } catch (error) {
    loginMessage.textContent = formatFirebaseError(error.code);
  }
});

// LOGOUT
logoutBtn.addEventListener("click", async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Logout error:", error);
  }
});

// AUTH STATE
onAuthStateChanged(auth, (user) => {
  if (user) {
    authScreen.classList.add("hidden");
    appShell.classList.remove("hidden");

    const displayName = user.displayName || user.email || "Student";
    welcomeText.textContent = `Hello, ${displayName}. Your study dashboard is ready.`;

    loginMessage.textContent = "";
    registerMessage.textContent = "";
  } else {
    authScreen.classList.remove("hidden");
    appShell.classList.add("hidden");

    welcomeText.textContent = "Your study dashboard is ready.";
    loginMessage.textContent = "";
    registerMessage.textContent = "";
  }
});

// UPLOAD PLACEHOLDER
uploadBtn.addEventListener("click", () => {
  if (!handoutFile.files.length) {
    uploadMessage.textContent = "Please select a handout file first.";
    return;
  }

  const fileName = handoutFile.files[0].name;
  uploadMessage.textContent = `Handout "${fileName}" selected successfully.`;
});

// TOOL BUTTON PLACEHOLDERS
toolButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const action = button.dataset.action;

    const responses = {
      summary:
        "Summary will appear here after Gemini integration.",
      questions:
        "Likely exam questions will appear here after Gemini integration.",
      quiz:
        "Quiz questions will appear here after Gemini integration.",
      explain:
        "Simple explanations will appear here after Gemini integration.",
      revision:
        "Short revision notes will appear here after Gemini integration.",
      topics:
        "Extracted key topics will appear here after Gemini integration."
    };

    aiOutput.textContent = responses[action];
  });
});

// ASK AI PLACEHOLDER
askAiBtn.addEventListener("click", () => {
  const prompt = aiPrompt.value.trim();

  if (!prompt) {
    aiOutput.textContent = "Please type a question or topic first.";
    return;
  }

  aiOutput.textContent = `AI response for: "${prompt}" will appear here after Gemini integration.`;
});

// HELPER
function formatFirebaseError(code) {
  const errors = {
    "auth/email-already-in-use": "This email is already in use.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/weak-password": "Password should be at least 6 characters.",
    "auth/user-not-found": "No user found with this email.",
    "auth/wrong-password": "Incorrect password.",
    "auth/invalid-credential": "Invalid login details.",
    "auth/network-request-failed": "Network error. Check your internet connection."
  };

  return errors[code] || "Something went wrong. Please try again.";
}
