 const firebaseConfig = {
  apiKey: "AIzaSyDJFQnwOs-fetKVy0Ow43vktz8xwefZMks",
  authDomain: "cyou-db8f0.firebaseapp.com",
  projectId: "cyou-db8f0",
  storageBucket: "cyou-db8f0.firebasestorage.app",
  messagingSenderId: "873569975141",
  appId: "1:873569975141:web:147eb7b7b4043a38c9bf8c"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// AUTO ANONYMOUS LOGIN FOR EVERYONE
auth.signInAnonymously().then(() => {
  document.getElementById("status").innerText = "Welcome!";
  loadFreeTips();

  // ONLY Abdulkareem5856 sees the admin button
  if (auth.currentUser && auth.currentUser.uid === "J1wGDrL0W9hYSZEM910k9oVz3uU2") {
    document.getElementById("adminOnly").innerHTML = `
      <button onclick="adminPost()" style="width:100%;padding:20px;background:#ff0066;color:white;font-size:22px;border:none;border-radius:20px;margin-top:20px;">
        ADMIN – POST TODAY'S TIPS
      </button>`;
  }
});

function loadFreeTips() {
  const today = new Date().toISOString().slice(0,10);
  db.collection("freeTips").doc(today).onSnapshot(doc => {
    const box = document.getElementById("freeTips");
    if (doc.exists) {
      box.innerHTML = doc.data().games.map(g => `<p>${g}</p>`).join('');
    } else {
      box.innerHTML = "<p>No free tips today – check back later!</p>";
    }
  });
}

function showVip() {
  document.getElementById("vipSection").style.display = "block";
  document.getElementById("vipSection").innerHTML = `
    <h2>VIP Membership</h2>
    <p>10–25 odds daily • 95% win rate</p>
    <h3>₦500/week only</h3>
    <p>Pay to Opay: <b>9125297720</b><br>Abdulkarim Aliyu</p>
    <button onclick="openWA()" style="background:#25D366;color:white;padding:18px;font-size:20px;border-radius:50px;width:100%;margin:15px 0;">
      Send Proof on WhatsApp
    </button>
  `;
}

function openWA() {
  const msg = `Hello Admin!\nI paid ₦500 for VIP\nOpay: 9125297720 – Abdulkarim Aliyu\nPlease activate me!`;
  window.open(`https://wa.me/2349125297720?text=${encodeURIComponent(msg)}`);
}

function adminPost() {
  const games = prompt("Paste today's games (one per line):");
  if (!games) return;
  const today = new Date().toISOString().slice(0,10);
  const vip = confirm("Post as VIP tips?");
  db.collection(vip ? "vipTips" : "freeTips").doc(today).set({
    games: games.split("\n").map(l=>l.trim()).filter(l=>l)
  }).then(()=>alert("Posted!")).catch(e=>alert(e.message));
}