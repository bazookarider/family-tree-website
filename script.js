const firebaseConfig = {apiKey:"AIzaSyDJFQnwOs-fetKVy0Ow43vktz8xwefZMks",authDomain:"cyou-db8f0.firebaseapp.com",projectId:"cyou-db8f0",appId:"1:873569975141:web:147eb7b7b4043a38c9bf8c"};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

auth.onAuthStateChanged(user => {
  if (user) {
    db.collection("vipUsers").doc(user.uid).get().then(doc => {
      if (doc.exists && doc.data().isApproved) {
        document.getElementById("vipLocked").classList.add("hidden");
        document.getElementById("vipSection").classList.remove("hidden");
      }
    });
  }
});

function payViaWhatsApp() {
  const email = prompt("Enter your email for VIP access:");
  if (!email) return;
  const text = encodeURIComponent(`Hello NaijaSureOdds! I paid ₦1,000 for VIP. My email: ${email}`);
  window.open(`https://wa.me/2347056353236?text=${text}`, "_blank");
  alert("Payment request sent! Wait for approval (1–5 mins)");
}