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
const ADMIN_WHATSAPP = "2349125297720"; 

// 3. UI STATE
let currentUser = null;
let currentExamType = "";
let currentQuestions = [];
let currentIndex = 0;
let userAnswers = {}; // Stores user choices { 0: 2, 1: 0 }
let timerInterval;

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

// --- AUTHENTICATION (Same as before) ---
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

    auth.createUserWithEmailAndPassword(email, pass).then((cred) => {
        db.ref('users/' + cred.user.uid).set({
            username: name, email: email, isPremium: false, jambPaid: false, waecPaid: false
        });
        alert("Account created! Logging in...");
    }).catch(e => alert(e.message));
}

function loginUser() {
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;
    auth.signInWithEmailAndPassword(email, pass).catch(e => alert(e.message));
}

function resetPassword() {
    const email = prompt("Enter your email:");
    if(email) auth.sendPasswordResetEmail(email).then(()=>alert("Sent!")).catch(e=>alert(e.message));
}

function logout() { auth.signOut(); window.location.reload(); }

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
            
            const badge = document.getElementById('user-badge');
            const status = document.getElementById('profile-status');
            if(data.isPremium || data.jambPaid) {
                badge.className = "user-badge badge-premium"; badge.innerText = "PREMIUM"; status.innerText = "Premium"; status.style.color = "green";
            } else { badge.innerText = "FREE"; }
        }
    });
}

// --- NAVIGATION ---
function openExamMenu(type) {
    currentExamType = type;
    document.getElementById('selected-exam-title').innerText = type + " Preparation";
    document.getElementById('dashboard-container').classList.add('hidden');
    document.getElementById('exam-menu-container').classList.remove('hidden');
}

function goBack(to) {
    document.getElementById('exam-menu-container').classList.add('hidden');
    document.getElementById('subject-menu-container').classList.add('hidden');
    document.getElementById('quiz-container').classList.add('hidden');
    document.getElementById('result-container').classList.add('hidden');
    
    if(to === 'dashboard') document.getElementById('dashboard-container').classList.remove('hidden');
    if(to === 'exam-menu') document.getElementById('exam-menu-container').classList.remove('hidden');
    
    clearInterval(timerInterval); // Stop timer if they leave
}

function showSubjectSelection(mode) {
    document.getElementById('exam-menu-container').classList.add('hidden');
    document.getElementById('subject-menu-container').classList.remove('hidden');
    const list = document.getElementById('subject-list');
    list.innerHTML = "";
    AVAILABLE_SUBJECTS.forEach(sub => {
        const div = document.createElement('div');
        div.className = 'card';
        div.innerHTML = `<i class="fa-solid ${sub.icon}"></i><h3>${sub.name}</h3>`;
        div.onclick = () => startQuiz(sub.id);
        list.appendChild(div);
    });
}

// --- QUIZ LOGIC (UPDATED WITH TIMER & SCORE) ---

function startQuiz(subjectKey) {
    document.getElementById('subject-menu-container').classList.add('hidden');
    document.getElementById('quiz-container').classList.remove('hidden');
    document.getElementById('subject-label').innerText = "Subject: " + subjectKey.toUpperCase();

    // Reset State
    currentQuestions = [];
    userAnswers = {};
    currentIndex = 0;
    
    // Start Timer (e.g., 10 minutes)
    startTimer(600); 

    // Fetch Questions
    const dbPath = `subjects/${subjectKey}`;
    document.getElementById('question-text').innerText = "Loading questions...";
    
    db.ref(dbPath).once('value').then(snap => {
        if(snap.exists()) {
            currentQuestions = Object.values(snap.val());
            // Limit to 20 questions for practice
            if(currentQuestions.length > 20) currentQuestions = currentQuestions.slice(0,20);
            showQuestion();
        } else {
            alert("No questions found. Use Admin Panel to Import.");
            goBack('dashboard');
        }
    });
}

function startTimer(duration) {
    let timer = duration, minutes, seconds;
    clearInterval(timerInterval); // Clear any old timers
    const display = document.getElementById('timer');
    
    timerInterval = setInterval(function () {
        minutes = parseInt(timer / 60, 10);
        seconds = parseInt(timer % 60, 10);

        minutes = minutes < 10 ? "0" + minutes : minutes;
        seconds = seconds < 10 ? "0" + seconds : seconds;

        display.textContent = minutes + ":" + seconds;

        if (--timer < 0) {
            submitQuiz(); // Auto Submit
        }
    }, 1000);
}

function showQuestion() {
    const q = currentQuestions[currentIndex];
    document.getElementById('question-text').innerText = `Q${currentIndex+1}: ${q.question}`;
    
    // Update Progress Bar
    const progress = ((currentIndex + 1) / currentQuestions.length) * 100;
    document.getElementById('progress-fill').style.width = `${progress}%`;

    const div = document.getElementById('options-container');
    div.innerHTML = "";
    
    q.options.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.className = "option-btn";
        if(userAnswers[currentIndex] === idx) btn.classList.add('selected'); // Keep selection
        
        btn.innerHTML = `<i class="fa-regular fa-circle"></i> ${opt}`;
        btn.onclick = () => selectAnswer(idx, btn);
        div.appendChild(btn);
    });
}

function selectAnswer(idx, btn) {
    userAnswers[currentIndex] = idx;
    // UI Update
    document.querySelectorAll('.option-btn').forEach(b => {
        b.classList.remove('selected');
        b.innerHTML = b.innerHTML.replace('fa-circle-check', 'fa-circle');
    });
    btn.classList.add('selected');
    btn.innerHTML = btn.innerHTML.replace('fa-circle', 'fa-circle-check');
}

function nextQuestion() {
    if(currentIndex < currentQuestions.length - 1) {
        currentIndex++;
        showQuestion();
    } else {
        // Last question
        if(confirm("Submit Quiz?")) submitQuiz();
    }
}

// --- SUBMIT & SCORING ---

function submitQuiz() {
    clearInterval(timerInterval); // Stop Timer
    document.getElementById('quiz-container').classList.add('hidden');
    document.getElementById('result-container').classList.remove('hidden');
    document.getElementById('corrections-list').classList.add('hidden');
    document.querySelector('.result-box').classList.remove('hidden');

    let score = 0;
    const total = currentQuestions.length;

    // Calculate Score
    currentQuestions.forEach((q, idx) => {
        // Handle API letter answers ('a'=0, 'b'=1...)
        let correctIndex = q.answer;
        if(typeof correctIndex === 'string') {
            const map = {'a':0, 'b':1, 'c':2, 'd':3};
            correctIndex = map[correctIndex.toLowerCase()] || 0;
        } else {
            correctIndex = parseInt(correctIndex);
        }

        if(userAnswers[idx] === correctIndex) {
            score++;
        }
    });

    const percentage = Math.round((score / total) * 100);
    
    // Show Results
    document.getElementById('score-text').innerText = `${score}/${total}`;
    document.getElementById('score-percentage').innerText = `${percentage}%`;
    
    const msg = document.getElementById('score-message');
    const circle = document.querySelector('.score-circle');
    
    if(percentage >= 50) {
        msg.innerText = "PASSED! Great Job.";
        msg.className = "pass";
        circle.style.borderColor = "#1e8e3e";
        circle.style.color = "#1e8e3e";
        circle.style.background = "#e6f4ea";
    } else {
        msg.innerText = "FAILED. Try Again.";
        msg.className = "fail";
        circle.style.borderColor = "#d93025";
        circle.style.color = "#d93025";
        circle.style.background = "#fce8e6";
    }
}

function showCorrections() {
    document.querySelector('.result-box').classList.add('hidden');
    const list = document.getElementById('corrections-list');
    list.classList.remove('hidden');
    
    const content = document.getElementById('corrections-content');
    content.innerHTML = "";

    currentQuestions.forEach((q, idx) => {
        let correctIndex = q.answer;
        if(typeof correctIndex === 'string') {
            const map = {'a':0, 'b':1, 'c':2, 'd':3};
            correctIndex = map[correctIndex.toLowerCase()] || 0;
        } else {
            correctIndex = parseInt(correctIndex);
        }

        const userIdx = userAnswers[idx];
        const isCorrect = (userIdx === correctIndex);
        
        const card = document.createElement('div');
        card.className = `correction-card ${isCorrect ? 'correct' : 'wrong'}`;
        
        card.innerHTML = `
            <p><strong>Q${idx+1}:</strong> ${q.question}</p>
            <span class="answer-label txt-green"><i class="fa-solid fa-check"></i> Correct: ${q.options[correctIndex]}</span>
            ${!isCorrect ? `<span class="answer-label txt-red"><i class="fa-solid fa-xmark"></i> You chose: ${q.options[userIdx] || 'Skipped'}</span>` : ''}
            <p style="font-size:11px; color:#666; margin-top:5px;"><em>${q.explanation || 'No explanation'}</em></p>
        `;
        content.appendChild(card);
    });
}

// --- ADMIN IMPORT ---
async function importQuestionsFromAPI() {
    const subjectSelect = document.getElementById('admin-subject-select');
    const selectedSubject = subjectSelect.value;
    const statusText = document.getElementById('import-status');
    statusText.innerText = `Connecting...`;

    const url = `https://questions.aloc.com.ng/api/v2/q/20?subject=${selectedSubject}&year=2023`;
    
    try {
        const res = await fetch(url, { headers: { 'AccessToken': ALOC_TOKEN }});
        const data = await res.json();
        
        if(data.data && data.data.length > 0) {
            statusText.innerText = `Saving...`;
            const updates = {};
            data.data.forEach(q => {
                const newKey = db.ref(`subjects/${selectedSubject}`).push().key;
                updates[`subjects/${selectedSubject}/${newKey}`] = {
                    question: q.question,
                    options: [q.option.a, q.option.b, q.option.c, q.option.d],
                    answer: q.answer, // Saves 'a', 'b' etc.
                    explanation: q.section
                };
            });
            await db.ref().update(updates);
            alert(`Imported ${data.data.length} questions for ${selectedSubject}`);
            statusText.innerText = "Done.";
        } else {
            statusText.innerText = "No data found.";
        }
    } catch(e) {
        statusText.innerText = "Error: " + e.message;
    }
}

// Payment/Modal functions (unchanged)
function checkPremiumAndStartMock() { showPaymentModal("1,000"); }
function showPaymentModal(p) { document.getElementById('payment-modal').classList.remove('hidden'); }
function closePayment() { document.getElementById('payment-modal').classList.add('hidden'); }
function sendProofWhatsApp() { window.open(`https://wa.me/${ADMIN_WHATSAPP}`, '_blank'); }
function contactSupport() { window.open(`https://wa.me/${ADMIN_WHATSAPP}`, '_blank'); }
function showProfile() { document.getElementById('profile-modal').classList.remove('hidden'); }
function closeProfile() { document.getElementById('profile-modal').classList.add('hidden'); }
