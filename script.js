// Wait for Firebase to load
window.addEventListener('load', () => {
  if (!window.firebase) {
    document.getElementById('status').innerText = 'Firebase loading error – refresh page';
    return;
  }

  const { initializeApp, getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, getFirestore, collection, doc, getDoc, setDoc } = window.firebase;
  const firebaseConfig = {
    apiKey: "AIzaSyDJFQnwOs-fetKVy0Ow43vktz8xwefZMks",
    authDomain: "cyou-db8f0.firebaseapp.com",
    projectId: "cyou-db8f0",
    storageBucket: "cyou-db8f0.firebasestorage.app",
    messagingSenderId: "873569975141",
    appId: "1:873569975141:web:147eb7b7b4043a38c9bf8c"
  };

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const ADMIN_UID = "J1wGDrL0W9hYSZEM910k9oVz3uU2";

  document.getElementById('status').innerText = 'Ready';

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      document.getElementById("auth").style.display = "none";
      document.getElementById("app").style.display = "block";
      document.getElementById("status").innerText = `Welcome, ${user.email}`;
      await loadFreeTips();
      if (user.uid === ADMIN_UID) {
        document.getElementById("adminBtn").innerHTML = `<br><button onclick="adminPanel()" style="background:red">ADMIN PANEL</button>`;
      }
    } else {
      document.getElementById("auth").style.display = "block";
      document.getElementById("app").style.display = "none";
      document.getElementById("status").innerText = 'Please login or register';
    }
  });

  window.register = async () => {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const msg = document.getElementById("msg");
    if (!email || !password) { msg.innerText = 'Enter email & password'; return; }
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      msg.innerText = 'Registered! Logging in...';
    } catch (error) {
      msg.innerText = error.message;
    }
  };

  window.login = async () => {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const msg = document.getElementById("msg");
    if (!email || !password) { msg.innerText = 'Enter email & password'; return; }
    try {
      await signInWithEmailAndPassword(auth, email, password);
      msg.innerText = 'Logged in!';
    } catch (error) {
      msg.innerText = error.message;
    }
  };

  window.logout = () => signOut(auth);

  window.loadFreeTips = async () => {
    const today = new Date().toISOString().slice(0,10);
    try {
      const snap = await getDoc(doc(db, "freeTips", today));
      const div = document.getElementById("free");
      if (snap.exists()) {
        div.innerHTML = snap.data().games.map(g => `<p>• ${g}</p>`).join('');
      } else {
        div.innerHTML = "<p>No free tips today – check back later!</p>";
      }
    } catch (error) {
      document.getElementById("free").innerHTML = "<p>Error loading tips</p>";
    }
  };

  window.checkVip = async () => {
    const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
    if (userDoc.exists() && userDoc.data().isVip) {
      const today = new Date().toISOString().slice(0,10);
      const snap = await getDoc(doc(db, "vipTips", today));
      const div = document.getElementById("vip");
      div.style.display = "block";
      div.innerHTML = snap.exists() 
        ? snap.data().games.map(g => `<p>• ${g}</p>`).join('')
        : "<p>VIP tips loading soon...</p>";
    } else {
      alert(`Pay ₦500/week to:\n\nOpay: 9125297720\nName: Abdulkarim Aliyu\n\nThen send proof to WhatsApp:\n+2349125297720`);
    }
  };

  window.adminPanel = () => {
    const games = prompt("Paste today's games (one per line):\n\nExample:\nMan Utd vs Chelsea - Over 2.5\nBarca win");
    if (!games) return;
    const today = new Date().toISOString().slice(0,10);
    const isVip = confirm("Post as VIP tips?");
    setDoc(doc(db, isVip ? "vipTips" : "freeTips", today), {
      games: games.split("\n").filter(x => x.trim())
    }).then(() => alert("Posted successfully!")).catch(e => alert("Error: " + e.message));
  };
});