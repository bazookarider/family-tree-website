 import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, deleteDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDJFQnwOs-fetKVy0Ow43vktz8xwefZMks",
    authDomain: "cyou-db8f0.firebaseapp.com",
    projectId: "cyou-db8f0",
    storageBucket: "cyou-db8f0.firebasestorage.app",
    messagingSenderId: "873569975141",
    appId: "1:873569975141:web:147eb7b7b4043a38c9bf8c",
    measurementId: "G-T66B50HFJ8"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// CHANGE THIS TO YOUR OWN PASSWORD
const ADMIN_PASSWORD = "myroots2025";

let isAdmin = false;
let editingId = null;

// Load members (everyone sees)
onSnapshot(collection(db, "family"), (snapshot) => {
  const container = document.getElementById("members");
  const empty = document.getElementById("empty");
  container.innerHTML = "";

  if (snapshot.empty) {
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  snapshot.forEach((docSnap) => {
    const m = docSnap.data();
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="bg-gradient-to-b from-teal-700 to-teal-900 text-white p-8 text-center">
        <i class="fas fa-user-circle text-6xl mb-4"></i>
        <h3 class="text-2xl font-bold">${m.name || "Unknown"}</h3>
        <p class="text-lg opacity-90">${m.relation || ""}</p>
      </div>
      <div class="p-8">
        <p class="text-lg"><i class="fas fa-map-marker-alt text-teal-700 mr-2"></i> ${m.tribe || "Not specified"}</p>
        <p class="text-md text-gray-600 mt-2"><i class="fas fa-calendar-alt mr-2"></i> ${m.birth ? new Date(m.birth).toLocaleDateString() : "Unknown"}</p>
        \( {m.death ? `<p class="text-md text-red-600"><i class="fas fa-cross mr-2"></i> \){new Date(m.death).toLocaleDateString()}</p>` : ""}
        \( {m.story ? `<p class="mt-6 italic text-gray-700 leading-relaxed">" \){m.story}"</p>` : ""}
        ${isAdmin ? `
          <div class="flex gap-3 mt-6">
            <button onclick="editMember('${docSnap.id}')" class="flex-1 bg-slate-700 text-white py-3 rounded-lg">Edit</button>
            <button onclick="deleteMember('${docSnap.id}')" class="flex-1 bg-red-600 text-white py-3 rounded-lg">Delete</button>
          </div>
        ` : ""}
      </div>
    `;
    container.appendChild(card);
  });
});

// Admin Button Click (Fixed — Triggers Prompt)
document.getElementById("adminBtn").addEventListener("click", function() {
  const pass = prompt("Enter Admin Password:");
  if (pass === ADMIN_PASSWORD) {
    isAdmin = true;
    alert("Admin access granted! Click + to add members.");
    this.innerHTML = "<i class='fas fa-plus'></i>";
    this.onclick = function() {
      document.getElementById("addModal").classList.remove("hidden");
    };
  } else if (pass !== null) {
    alert("Wrong password!");
  }
});

// Save Member
window.saveMember = async () => {
  if (!isAdmin) return alert("Admin only");

  const data = {
    name: document.getElementById("name").value.trim(),
    relation: document.getElementById("relation").value.trim(),
    tribe: document.getElementById("tribe").value.trim(),
    birth: document.getElementById("birth").value,
    death: document.getElementById("death").value,
    story: document.getElementById("story").value.trim()
  };

  if (!data.name || !data.relation) return alert("Name and Relation required");

  if (editingId) {
    await updateDoc(doc(db, "family", editingId), data);
    editingId = null;
    document.getElementById("modalTitle").innerText = "Add Family Member";
  } else {
    await addDoc(collection(db, "family"), data);
  }
  closeModal();
  alert("Saved!");
};

// Edit
window.editMember = (id) => {
  if (!isAdmin) return;
  editingId = id;
  document.getElementById("modalTitle").innerText = "Edit Family Member";
  document.getElementById("addModal").classList.remove("hidden");
};

// Delete
window.deleteMember = async (id) => {
  if (isAdmin && confirm("Delete permanently?")) {
    await deleteDoc(doc(db, "family", id));
  }
};

// Close Modal
window.closeModal = () => {
  document.getElementById("addModal").classList.add("hidden");
  editingId = null;
  document.getElementById("modalTitle").innerText = "Add Family Member";
  document.querySelectorAll("#addModal input, #addModal textarea").forEach(el => el.value = "");
};