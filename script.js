// 1. FIREBASE CONFIGURATION
const firebaseConfig = {
    apiKey: "AIzaSyDJFQnwOs-fetKVy0Ow43vktz8xwefZMks",
    authDomain: "cyou-db8f0.firebaseapp.com",
    databaseURL: "https://cyou-db8f0-default-rtdb.firebaseio.com",
    projectId: "cyou-db8f0",
    storageBucket: "cyou-db8f0.firebasestorage.app",
    messagingSenderId: "873569975141",
    appId: "1:873569975141:web:147eb7b7b4043a38c9bf8c"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

// 2. YOUR ALOC API TOKEN
const ALOC_TOKEN = "QB-9bea5116f01bd14dc704"; // This is your key

// --- AUTHENTICATION LOGIC ---

function registerUser() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const username = document.getElementById('username').value;

    if(!username) { alert("Please enter a username"); return; }

    auth.createUserWithEmailAndPassword(email, password)
        .then((userCredential) => {
            // Save Username to Database
            const user = userCredential.user;
            db.ref('users/' + user.uid).set({
                username: username,
                email: email,
                isPremium: false
            });
            alert("Account Created! You can now Login.");
        })
        .catch((error) => {
            document.getElementById('auth-message').innerText = error.message;
        });
}

function loginUser() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    auth.signInWithEmailAndPassword(email, password)
        .catch((error) => {
            document.getElementById('auth-message').innerText = error.message;
        });
}

function logout() {
    auth.signOut();
    window.location.reload();
}

// Monitor Login State
auth.onAuthStateChanged((user) => {
    if (user) {
        document.getElementById('auth-container').classList.add('hidden');
        document.getElementById('dashboard-container').classList.remove('hidden');
        document.getElementById('welcome-text').innerText = "Welcome back!";
    }
});

// --- API IMPORT LOGIC (THE MAGIC PART) ---

async function importQuestionsFromAPI() {
    const statusText = document.getElementById('import-status');
    statusText.innerText = "Connecting to ALOC API...";

    // We will fetch 10 JAMB English questions
    const subject = "english"; 
    const year = "2021"; // You can change this year later
    const url = `https://questions.aloc.com.ng/api/v2/q/10?subject=${subject}&year=${year}`;

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'AccessToken': ALOC_TOKEN
            }
        });

        const data = await response.json();
        
        if (data.data && data.data.length > 0) {
            statusText.innerText = `Found ${data.data.length} questions. Saving...`;

            // Loop and save each question to YOUR Firebase
            data.data.forEach(q => {
                db.ref('subjects/jamb_english').push({
                    question: q.question,
                    options: [q.option.a, q.option.b, q.option.c, q.option.d],
                    answer: q.answer, 
                    explanation: q.section || "No explanation"
                });
            });

            statusText.innerText = "✅ Success! Questions saved to Database.";
            alert("Questions imported successfully!");
        } else {
            statusText.innerText = "❌ No questions found or API Error.";
        }

    } catch (error) {
        console.error(error);
        statusText.innerText = "❌ Error: " + error.message;
    }
}

// --- QUIZ LOGIC ---

let currentQuestions = [];
let currentIndex = 0;

function startQuiz(subject) {
    // 1. Fetch questions from YOUR Firebase (not the API)
    db.ref('subjects/jamb_' + subject).once('value').then((snapshot) => {
        if (snapshot.exists()) {
            // Convert Firebase object to array
            const data = snapshot.val();
            currentQuestions = Object.values(data);
            currentIndex = 0;
            
            // Show Quiz UI
            document.getElementById('dashboard-container').classList.add('hidden');
            document.getElementById('quiz-container').classList.remove('hidden');
            
            showQuestion();
        } else {
            alert("No questions found! Click the 'Import' button first.");
        }
    });
}

function showQuestion() {
    if (currentIndex >= currentQuestions.length) {
        alert("Quiz Finished!");
        goToDashboard();
        return;
    }

    const q = currentQuestions[currentIndex];
    document.getElementById('question-text').innerHTML = `Q${currentIndex + 1}: ${q.question}`;
    
    const optionsDiv = document.getElementById('options-container');
    optionsDiv.innerHTML = ""; // Clear old options

    q.options.forEach((opt, index) => {
        const btn = document.createElement('button');
        btn.className = "option-btn";
        btn.innerText = opt;
        btn.onclick = () => selectAnswer(btn, index, q.answer);
        optionsDiv.appendChild(btn);
    });
}

function selectAnswer(btn, index, correctAnswer) {
    // Simple check (ALOC sometimes uses 'a','b','c' as answer, we need to map logic later)
    // For now, let's just highlight it blue to show selection
    const allBtns = document.querySelectorAll('.option-btn');
    allBtns.forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
}

function nextQuestion() {
    currentIndex++;
    showQuestion();
}

function goToDashboard() {
    document.getElementById('quiz-container').classList.add('hidden');
    document.getElementById('dashboard-container').classList.remove('hidden');
}
