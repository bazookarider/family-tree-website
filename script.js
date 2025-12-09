async function checkVip() {
  const userDoc = await db.collection("users").doc(auth.currentUser.uid).get();
  
  if (userDoc.exists && userDoc.data().isVip) {
    // Already VIP → show tips
    const today = new Date().toISOString().slice(0,10);
    const snap = await db.collection("vipTips").doc(today).get();
    const div = document.getElementById("vip");
    div.style.display = "block";
    div.innerHTML = snap.exists 
      ? snap.data().games.map(g=>`<p>• ${g}</p>`).join("")
      : "<p>VIP tips loading soon...</p>";
    return;
  }

  // NOT VIP → show premium payment card
  const paymentHTML = `
    <div style="background:linear-gradient(45deg,#8B00FF,#FFD700); padding:20px; border-radius:15px; margin:20px 0; color:black;">
      <h2>VIP Membership Unlocked</h2>
      <h3>₦500/week • 10–25 odds daily • 95% win rate</h3>
      <p><strong>Offer ends in 24 hours!</strong></p>
      
      <div style="background:white; padding:15px; border-radius:10px; margin:15px 0;">
        <p><strong>Pay to:</strong></p>
        <h3>Opay: 9125297720</h3>
        <p>Abdulkarim Aliyu</p>
        <button onclick="copyNumber()" style="background:#000; color:gold; padding:10px; border-radius:8px;">Copy Number</button>
      </div>

      <button onclick="openWhatsApp()" style="background:#25D366; color:white; padding:18px; font-size:18px; border-radius:50px; width:100%; margin:10px 0;">
        Chat on WhatsApp & Send Proof
      </button>
      <small>You’ll be activated in < 2 minutes after payment</small>
    </div>
  `;

  document.getElementById("vip").style.display = "block";
  document.getElementById("vip").innerHTML = paymentHTML;
}

function copyNumber() {
  navigator.clipboard.writeText("9125297720");
  alert("Opay number copied!");
}

function openWhatsApp() {
  const userEmail = auth.currentUser.email;
  const message = `Hello Boss!\n\nI just paid ₦500 for VIP weekly access\n\nEmail: ${userEmail}\nAmount: ₦500\nOpay: 9125297720 → Abdulkarim Aliyu\n\nPlease activate me now`;
  
  const whatsappURL = `https://wa.me/2349125297720?text=${encodeURIComponent(message)}`;
  window.open(whatsappURL, "_blank");
}