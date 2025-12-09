// 1. FIREBASE CONFIG
const firebaseConfig = {
    apiKey: "AIzaSyDJFQnwOs-fetKVy0Ow43vktz8xwefZMks",
    authDomain: "cyou-db8f0.firebaseapp.com",
    databaseURL: "https://cyou-db8f0-default-rtdb.firebaseio.com",
    projectId: "cyou-db8f0",
    storageBucket: "cyou-db8f0.firebasestorage.app",
    messagingSenderId: "873569975141",
    appId: "1:873569975141:web:147eb7b7b4043a38c9bf8c"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

// 2. CONSTANTS
const ALOC_TOKEN = "QB-9bea5116f01bd14dc704"; 
const ADMIN_WHATSAPP = "2349125297720"; // Your Number

// State
let currentUser = null;
let currentExamType = ""; // JAMB, WAEC, NECO
let currentQuestions = [];
let currentIndex = 0;

// --- AUTHENTICATION ---

function toggleAuth(view) {
    if(view === 'register') {
        document.getElementById('login-form').classList.add('hidden');
        document.getElementById('register-form').classList.remove('hidden');
    } else {
        document.getElementById('register-form').classList.add('hidden');
        document.getElementById('login-form').classList.remove('hidden');
    }
}

function registerUser() {
    const name = document.getElementById('reg-username').value;
    const email = document.getElementById('reg-email').value;
    const pass = document.getElementById('reg-password').value;

    if(!name) return alert("Please enter your name");

    auth.createUserWithEmailAndPassword(email, pass)
        .then((cred) => {
            // Create User Profile in DB
            db.ref('users/' + cred.user.uid).set({
                username: name,
                email: email,
                isPremium: false,
                jambPaid: false, // Track specific exams
                waecPaid: false,
                necoPaid: false
            });
            alert("Account created! Logging in...");
        })
        .catch(e => alert(e.message));
}

function loginUser() {
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;
    auth.signInWithEmailAndPassword(email, pass).catch(e => alert(e.message));
}

function resetPassword() {
    const email = prompt("Enter your email to reset password:");
    if(email) {
        auth.sendPasswordResetEmail(email)
            .then(() => alert("Reset link sent to your email."))
            .catch(e => alert(e.message));
    }
}

function logout() { auth.signOut(); window.location.reload(); }

// Auth Listener
auth.onAuthStateChanged((user) => {
    if (user) {
        currentUser = user;
        document.getElementById('auth-container').classList.add('hidden');
        document.getElementById('dashboard-container').classList.remove('hidden');
        loadUserProfile();
    }
});

function loadUserProfile() {
    db.ref('users/' + currentUser.uid).on('value', (snap) => {
        const data = snap.val();
        if(data) {
            document.getElementById('display-username').innerText = data.username;
            document.getElementById('profile-name').innerText = data.username;
            document.getElementById('profile-email').innerText = data.email;
            document.getElementById('profile-uid').innerText = currentUser.uid;
            
            // Badge Logic
            const badge = document.getElementById('user-badge');
            const status = document.getElementById('profile-status');
            
            if(data.isPremium || data.jambPaid) {
                badge.className = "user-badge badge-premium";
                badge.innerText = "PREMIUM";
                status.innerText = "Premium / Paid";
                status.style.color = "green";
            } else {
                badge.innerText = "FREE";
            }
        }
    });
}

// --- NAVIGATION & MOCK EXAMS ---

function openExamMenu(type) {
    currentExamType = type;
    document.getElementById('selected-exam-title').innerText = type + " Preparation";
    
    document.getElementById('dashboard-container').classList.add('hidden');
    document.getElementById('exam-menu-container').classList.remove('hidden');
}

function goBack(to) {
    document.getElementById('exam-menu-container').classList.add('hidden');
    document.getElementById('dashboard-container').classList.remove('hidden');
}

// THE MONEY LOGIC 💰
function checkPremiumAndStart(mode) {
    if(mode === 'mock') {
        db.ref('users/' + currentUser.uid).once('value').then(snap => {
            const data = snap.val();
            let hasAccess = false;
            let price = "0";

            // Check specific exam payment
            if(currentExamType === 'JAMB') {
                hasAccess = data.jambPaid || data.isPremium;
                price = "1,000";
            } else if (currentExamType === 'WAEC' || currentExamType === 'NECO') {
                hasAccess = data.waecPaid || data.isPremium; // Assuming combined or specific
                price = "2,000";
            }

            if(hasAccess) {
                // User has paid -> Start Quiz
                startQuiz(currentExamType.toLowerCase());
            } else {
                // User NOT paid -> Show Payment Modal
                showPaymentModal(price);
            }
        });
    }
}

function showPaymentModal(price) {
    document.getElementById('pay-exam-name').innerText = currentExamType;
    document.getElementById('pay-amount').innerText = "₦" + price;
    document.getElementById('payment-modal').classList.remove('hidden');
}

function closePayment() {
    document.getElementById('payment-modal').classList.add('hidden');
}

function sendProofWhatsApp() {
    const text = `Hello Speaker of Naija, I just paid for the ${currentExamType} Mock Exam. My email is ${currentUser.email}. Please approve me.`;
    const url = `https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
}

function contactSupport() {
    const text = "Hello, I need help with the Cyou App.";
    window.open(`https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(text)}`, '_blank');
}

// --- QUIZ LOGIC (Simplified for Demo) ---

function startPracticeMode() {
    // Free mode - limited questions or subjects
    startQuiz(currentExamType.toLowerCase());
}

function startQuiz(subjectKey) {
    // Hide menus
    document.getElementById('exam-menu-container').classList.add('hidden');
    document.getElementById('quiz-container').classList.remove('hidden');

    // 1. Fetch from Firebase
    // Note: For now we fetch 'jamb_english' as a test. In real app, you select subject.
    const dbPath = `subjects/${subjectKey}_english`; 
    
    db.ref(dbPath).once('value').then(snap => {
        if(snap.exists()) {
            currentQuestions = Object.values(snap.val());
            currentIndex = 0;
            showQuestion();
        } else {
            alert("No questions found for this subject yet. Admin needs to import them.");
            quitQuiz();
        }
    });
}

function showQuestion() {
    if(currentIndex >= currentQuestions.length) {
        alert("Exam Finished!");
        quitQuiz();
        return;
    }
    const q = currentQuestions[currentIndex];
    document.getElementById('question-text').innerText = q.question;
    
    const div = document.getElementById('options-container');
    div.innerHTML = "";
    
    q.options.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.className = "option-btn";
        btn.innerHTML = `<i class="fa-regular fa-circle"></i> ${opt}`;
        btn.onclick = () => {
             // Visual selection only for now
             document.querySelectorAll('.option-btn').forEach(b => {
                 b.classList.remove('selected');
                 b.innerHTML = b.innerHTML.replace('fa-circle-check', 'fa-circle');
             });
             btn.classList.add('selected');
             btn.innerHTML = btn.innerHTML.replace('fa-circle', 'fa-circle-check');
        };
        div.appendChild(btn);
    });
}

function nextQuestion() {
    currentIndex++;
    showQuestion();
}

function quitQuiz() {
    document.getElementById('quiz-container').classList.add('hidden');
    document.getElementById('dashboard-container').classList.remove('hidden');
}

// --- ADMIN IMPORT (Imports JAMB English 2021) ---
async function importQuestionsFromAPI() {
    document.getElementById('import-status').innerText = "Loading...";
    const url = `https://questions.aloc.com.ng/api/v2/q/10?subject=english&year=2021`;
    
    try {
        const res = await fetch(url, { headers: { 'AccessToken': ALOC_TOKEN }});
        const data = await res.json();
        
        if(data.data) {
            data.data.forEach(q => {
                db.ref('subjects/jamb_english').push({
                    question: q.question,
                    options: [q.option.a, q.option.b, q.option.c, q.option.d],
                    answer: q.answer
                });
            });
            alert("Imported JAMB English questions successfully!");
            document.getElementById('import-status').innerText = "Done.";
        }
    } catch(e) {
        alert("Error: " + e.message);
    }
}

// Modal Profiles
function showProfile() { document.getElementById('profile-modal').classList.remove('hidden'); }
function closeProfile() { document.getElementById('profile-modal').classList.add('hidden'); }
