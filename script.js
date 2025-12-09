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
// Updated Token from your screenshot
const ALOC_TOKEN = "QB-9bea5116f01bd14dc704"; 
const ADMIN_WHATSAPP = "2349125297720"; // International format for WA link

// State
let currentUser = null;
let currentExamType = ""; // JAMB, WAEC, NECO
let currentQuestions = [];
let currentIndex = 0;

// List of subjects for the UI
const AVAILABLE_SUBJECTS = [
    { id: 'english', name: 'English Language', icon: 'fa-language' },
    { id: 'mathematics', name: 'Mathematics', icon: 'fa-calculator' },
    { id: 'physics', name: 'Physics', icon: 'fa-atom' },
    { id: 'chemistry', name: 'Chemistry', icon: 'fa-flask' },
    { id: 'biology', name: 'Biology', icon: 'fa-dna' },
    { id: 'commerce', name: 'Commerce', icon: 'fa-briefcase' },
    { id: 'economics', name: 'Economics', icon: 'fa-chart-line' },
    { id: 'government', name: 'Government', icon: 'fa-landmark' }
];

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
            db.ref('users/' + cred.user.uid).set({
                username: name,
                email: email,
                isPremium: false,
                jambPaid: false, 
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
    if(email && email.includes('@')) {
        auth.sendPasswordResetEmail(email)
            .then(() => alert("Reset link sent! Check your email."))
            .catch(e => alert(e.message));
    } else {
        alert("Please enter a valid email.");
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

// --- NAVIGATION & MENUS ---

function openExamMenu(type) {
    currentExamType = type;
    document.getElementById('selected-exam-title').innerText = type + " Preparation";
    document.getElementById('dashboard-container').classList.add('hidden');
    document.getElementById('exam-menu-container').classList.remove('hidden');
}

function goBack(to) {
    // Hide all
    document.getElementById('exam-menu-container').classList.add('hidden');
    document.getElementById('subject-menu-container').classList.add('hidden');
    document.getElementById('quiz-container').classList.add('hidden');
    
    if(to === 'dashboard') {
        document.getElementById('dashboard-container').classList.remove('hidden');
    } else if (to === 'exam-menu') {
        document.getElementById('exam-menu-container').classList.remove('hidden');
    }
}

function showSubjectSelection(mode) {
    document.getElementById('exam-menu-container').classList.add('hidden');
    document.getElementById('subject-menu-container').classList.remove('hidden');
    
    const list = document.getElementById('subject-list');
    list.innerHTML = ""; // Clear old

    AVAILABLE_SUBJECTS.forEach(sub => {
        const div = document.createElement('div');
        div.className = 'card';
        div.innerHTML = `
            <i class="fa-solid ${sub.icon}"></i>
            <h3>${sub.name}</h3>
        `;
        div.onclick = () => startQuiz(sub.id);
        list.appendChild(div);
    });
}

// --- MONEY & MOCK EXAMS ---

function checkPremiumAndStartMock() {
    db.ref('users/' + currentUser.uid).once('value').then(snap => {
        const data = snap.val();
        let hasAccess = false;
        let price = "0";

        if(currentExamType === 'JAMB') {
            hasAccess = data.jambPaid || data.isPremium;
            price = "1,000";
        } else if (currentExamType === 'WAEC' || currentExamType === 'NECO') {
            hasAccess = data.waecPaid || data.isPremium;
            price = "2,000";
        }

        if(hasAccess) {
            // Paid users get to start English mock for now (or randomize)
            startQuiz('english'); 
        } else {
            showPaymentModal(price);
        }
    });
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

// --- QUIZ LOGIC ---

function startQuiz(subjectKey) {
    document.getElementById('subject-menu-container').classList.add('hidden');
    document.getElementById('quiz-container').classList.remove('hidden');
    document.getElementById('subject-label').innerText = "Subject: " + subjectKey.toUpperCase();

    // Construct DB path: e.g., "subjects/english"
    // Note: The Admin function below saves them as just "subjects/english" (no 'jamb_' prefix to keep it simple for now)
    const dbPath = `subjects/${subjectKey}`; 
    
    document.getElementById('question-text').innerText = "Loading questions...";
    
    db.ref(dbPath).once('value').then(snap => {
        if(snap.exists()) {
            currentQuestions = Object.values(snap.val());
            currentIndex = 0;
            showQuestion();
        } else {
            alert(`No questions found for ${subjectKey}. Use the Admin Import tool to add them first!`);
            quitQuiz();
        }
    });
}

function showQuestion() {
    if(currentIndex >= currentQuestions.length) {
        alert("Session Finished!");
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

// --- ADMIN IMPORT LOGIC (THE FIX) ---
async function importQuestionsFromAPI() {
    // 1. Get Selected Subject from Dropdown
    const subjectSelect = document.getElementById('admin-subject-select');
    const selectedSubject = subjectSelect.value;
    
    const statusText = document.getElementById('import-status');
    statusText.innerText = `Connecting to ALOC API for ${selectedSubject}...`;

    // 2. Fetch from API (Using your Token)
    const url = `https://questions.aloc.com.ng/api/v2/q/20?subject=${selectedSubject}&year=2023`;
    
    try {
        const res = await fetch(url, { 
            headers: { 
                'AccessToken': ALOC_TOKEN,
                'Content-Type': 'application/json'
            }
        });
        const data = await res.json();
        
        console.log(data); // Debugging

        if(data.data && data.data.length > 0) {
            statusText.innerText = `Found ${data.data.length} questions. Saving to Database...`;

            // 3. Save to Firebase under subjects/[subjectName]
            // We use Promise.all to ensure all saves finish
            const updates = {};
            data.data.forEach(q => {
                const newKey = db.ref(`subjects/${selectedSubject}`).push().key;
                updates[`subjects/${selectedSubject}/${newKey}`] = {
                    question: q.question,
                    options: [q.option.a, q.option.b, q.option.c, q.option.d],
                    answer: q.answer,
                    explanation: q.section || "None"
                };
            });
            
            await db.ref().update(updates);

            alert(`Success! Imported ${data.data.length} ${selectedSubject} questions.`);
            statusText.innerText = "Done.";
        } else {
            statusText.innerText = "❌ API returned no questions. Try another subject.";
        }
    } catch(e) {
        console.error(e);
        statusText.innerText = "❌ Error: " + e.message;
    }
}

// Modal Profiles
function showProfile() { document.getElementById('profile-modal').classList.remove('hidden'); }
function closeProfile() { document.getElementById('profile-modal').classList.add('hidden'); }
