// Global variables
let currentUser = null;
let familyMembers = [];

// Page navigation
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.add('hidden');
    });
    document.getElementById(pageId).classList.remove('hidden');
}

function showLogin() {
    showPage('loginPage');
}

function showPublicView() {
    showPage('publicView');
    loadFamilyTree();
}

function logout() {
    currentUser = null;
    showPage('loginPage');
}

// Login function
function login() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    if (username === 'Benalee' && password === 'Ab@58563') {
        currentUser = { username: 'Benalee' };
        showPage('adminPanel');
        loadFamilyMembers();
    } else {
        alert('Invalid login credentials!');
    }
}

// Firebase functions
async function loadFamilyMembers() {
    try {
        const querySnapshot = await getDocs(collection(db, "familyMembers"));
        familyMembers = [];
        querySnapshot.forEach((doc) => {
            familyMembers.push({ id: doc.id, ...doc.data() });
        });
        displayMembers();
        loadFamilyTree();
    } catch (error) {
        console.error("Error loading members:", error);
    }
}

async function addMember() {
    const name = document.getElementById('memberName').value;
    const nickname = document.getElementById('memberNickname').value;
    const role = document.getElementById('memberRole').value;
    
    if (!name || !nickname) {
        alert('Please fill in all fields');
        return;
    }
    
    try {
        await addDoc(collection(db, "familyMembers"), {
            name: name,
            nickname: nickname,
            role: role,
            createdAt: new Date()
        });
        
        // Clear form
        document.getElementById('memberName').value = '';
        document.getElementById('memberNickname').value = '';
        
        // Reload members
        loadFamilyMembers();
        
        alert('Family member added successfully!');
    } catch (error) {
        console.error("Error adding member:", error);
        alert('Error adding family member');
    }
}

async function deleteMember(memberId) {
    if (confirm('Are you sure you want to delete this family member?')) {
        try {
            await deleteDoc(doc(db, "familyMembers", memberId));
            loadFamilyMembers();
        } catch (error) {
            console.error("Error deleting member:", error);
        }
    }
}

function displayMembers() {
    const container = document.getElementById('membersContainer');
    container.innerHTML = '';
    
    familyMembers.forEach(member => {
        const memberCard = document.createElement('div');
        memberCard.className = 'member-card';
        memberCard.innerHTML = `
            <div class="member-info">
                <h4>${member.name}</h4>
                <p><strong>Role:</strong> ${member.role} | <strong>Nickname:</strong> ${member.nickname}</p>
            </div>
            <div class="member-actions">
                <button class="edit-btn" onclick="editMember('${member.id}')">Edit</button>
                <button onclick="deleteMember('${member.id}')">Delete</button>
            </div>
        `;
        container.appendChild(memberCard);
    });
}

function loadFamilyTree() {
    const treeContainer = document.getElementById('treeVisualization');
    treeContainer.innerHTML = '';
    
    if (familyMembers.length === 0) {
        treeContainer.innerHTML = '<p style="text-align: center; color: #666;">No family members added yet.</p>';
        return;
    }
    
    const treeDiv = document.createElement('div');
    treeDiv.className = 'tree-horizontal';
    
    // Find ancestor (or use first member as default)
    const ancestor = familyMembers.find(m => m.role === 'ancestor') || familyMembers[0];
    
    // Create ancestor box
    const ancestorBox = document.createElement('div');
    ancestorBox.className = 'ancestor-box';
    ancestorBox.innerHTML = `
        <h3>${ancestor.name}</h3>
        <div class="role">${ancestor.role}</div>
        <div class="nickname">${ancestor.nickname}</div>
    `;
    treeDiv.appendChild(ancestorBox);
    
    // Create boxes for other members
    familyMembers.forEach(member => {
        if (member.id !== ancestor.id) {
            const memberBox = document.createElement('div');
            memberBox.className = 'member-box';
            memberBox.innerHTML = `
                <h4>${member.name}</h4>
                <div class="role">${member.role}</div>
                <div class="nickname">${member.nickname}</div>
            `;
            treeDiv.appendChild(memberBox);
        }
    });
    
    treeContainer.appendChild(treeDiv);
}

function editMember(memberId) {
    const member = familyMembers.find(m => m.id === memberId);
    if (member) {
        const newName = prompt('Enter new name:', member.name);
        const newNickname = prompt('Enter new nickname:', member.nickname);
        const newRole = prompt('Enter new role:', member.role);
        
        if (newName && newNickname && newRole) {
            // For now, we'll delete and recreate (Firestore requires updateDoc for proper editing)
            deleteMember(memberId);
            // In a real app, you'd use updateDoc here
            setTimeout(() => {
                alert('Edit functionality requires updateDoc. For now, please delete and readd the member.');
            }, 100);
        }
    }
}

function exportData() {
    const dataStr = JSON.stringify(familyMembers, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'family-tree-data.json';
    link.click();
    URL.revokeObjectURL(url);
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            alert(`Found ${importedData.length} members in import file. Manual import required.`);
            // Note: Full import would require batch write to Firestore
        } catch (error) {
            alert('Error reading import file');
        }
    };
    reader.readAsText(file);
}

// Real-time listener for family members
function setupRealTimeListener() {
    onSnapshot(collection(db, "familyMembers"), (snapshot) => {
        familyMembers = [];
        snapshot.forEach((doc) => {
            familyMembers.push({ id: doc.id, ...doc.data() });
        });
        
        if (currentUser) {
            displayMembers();
        }
        loadFamilyTree();
    });
}

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    showPage('loginPage');
    setupRealTimeListener();
    
    // Set up import file change listener
    document.getElementById('importFile').addEventListener('change', importData);
});