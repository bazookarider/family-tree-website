function payWhatsApp() {
  const details = prompt("Enter your email/phone:");
  if (details) {
    const msg = encodeURIComponent(`Paid ₦1,000 for VIP. Details: ${details}`);
    window.open(`https://wa.me/2347056353236?text=${msg}`);
  }
}

// For VIP (add user ID to localStorage after approval)
if (localStorage.getItem('vipApproved')) {
  document.getElementById('vip-locked').classList.add('hidden');
  document.getElementById('vip-content').classList.remove('hidden');
}