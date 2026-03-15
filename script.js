import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Replace this config with your own Firebase config
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

// UI Elements
const showLogin = document.getElementById("showLogin");
const showRegister = document.getElementById("showRegister");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");

const loginBtn = document.getElementById("loginBtn");
const registerBtn = document.getElementById("registerBtn");
const logoutBtn = document.getElementById("logoutBtn");

const dashboard = document.getElementById("dashboard");
const welcomeText = document.getElementById("welcomeText");

const loginMessage = document.getElementById("loginMessage");
const registerMessage = document.getElementById("registerMessage");
const uploadMessage = document.getElementById("uploadMessage");

const uploadBtn = document.getElementById("uploadBtn");
const handoutFile = document.getElementById("handoutFile");

const toolButtons = document.querySelectorAll(".tool-btn");
const aiPrompt = document.getElementById("aiPrompt");
const askAiBtn = document.getElementById("askAiBtn");
const aiOutput = document.getElementById("aiOutput");

// Switch forms
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

// Register
registerBtn.addEventListener("click", async () => {
  const name = document.getElementById("registerName").value.trim();
  const email = document.getElementById("registerEmail").value.trim();
  const password = document.getElementById("registerPassword").value.trim();

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
  } catch (error) {
    registerMessage.textContent = error.message;
  }
});

// Login
loginBtn.addEventListener("click", async () => {
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value.trim();

  loginMessage.textContent = "";

  if (!email || !password) {
    loginMessage.textContent = "Please enter your email and password.";
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, password);
    loginMessage.textContent = "Login successful.";
  } catch (error) {
    loginMessage.textContent = error.message;
  }
});

// Logout
logoutBtn.addEventListener("click", async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Logout error:", error);
  }
});

// Auth state observer
onAuthStateChanged(auth, (user) => {
  if (user) {
    dashboard.classList.remove("hidden");
    welcomeText.textContent = `Welcome, ${user.displayName || user.email}`;
  } else {
    dashboard.classList.add("hidden");
    welcomeText.textContent = "Welcome, Student";
  }
});

// Temporary upload message
uploadBtn.addEventListener("click", () => {
  if (!handoutFile.files.length) {
    uploadMessage.textContent = "Please select a handout file first.";
    return;
  }

  const fileName = handoutFile.files[0].name;
  uploadMessage.textContent = `Handout "${fileName}" selected successfully.`;
});

// Temporary tool buttons
toolButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const action = button.dataset.action;

    const responses = {
      summary: "Summary will appear here after Gemini integration.",
      questions: "Likely exam questions will appear here after Gemini integration.",
      quiz: "Quiz questions will appear here after Gemini integration.",
      explain: "Simple explanations will appear here after Gemini integration.",
      revision: "Short revision notes will appear here after Gemini integration.",
      topics: "Extracted key topics will appear here after Gemini integration."
    };

    aiOutput.textContent = responses[action];
  });
});

// Temporary AI prompt
askAiBtn.addEventListener("click", () => {
  const prompt = aiPrompt.value.trim();

  if (!prompt) {
    aiOutput.textContent = "Please type a question or topic first.";
    return;
  }

  aiOutput.textContent = `AI response for: "${prompt}" will appear here after Gemini integration.`;
});
