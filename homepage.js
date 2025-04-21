import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js";
import { getFirestore, getDoc, doc } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyA8a65KdnY4FzeX_UAC0tapvlE7pwQWWq0",
    authDomain: "forum-359a6.firebaseapp.com",
    projectId: "forum-359a6",
    storageBucket: "forum-359a6.firebasestorage.app",
    messagingSenderId: "558570896770",
    appId: "1:558570896770:web:7b5a2e6b4fc96a0891639b"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth();
const db = getFirestore();

// Get DOM elements
const userEmail = document.getElementById('userEmail');
const signInUpBtn = document.getElementById('signInUpBtn');
const userPopup = document.getElementById('userPopup');
const logoutBtn = document.getElementById('logoutBtn');
const navLinks = document.getElementById('nav-links');

// Handle auth state changes
onAuthStateChanged(auth, (user) => {
    if (user) {
        // User is signed in
        const userId = user.uid;
        localStorage.setItem('loggedInUserId', userId);
        
        const docRef = doc(db, "users", userId);
        getDoc(docRef)
            .then((docSnap) => {
                if (docSnap.exists()) {
                    const userData = docSnap.data();
                    // Update UI for logged in state
                    userEmail.textContent = userData.email;
                    document.querySelector('.user-menu').style.display = 'block';
                    signInUpBtn.style.display = 'none';
                    
                    // Update popup details
                    document.getElementById('popupFName').textContent = userData.firstName;
                    document.getElementById('popupLName').textContent = userData.lastName;
                    document.getElementById('popupEmail').textContent = userData.email;
                }
            })
            .catch((error) => {
                console.log("Error getting document:", error);
            });
    } else {
        // User is signed out
        document.querySelector('.user-menu').style.display = 'none';
        signInUpBtn.style.display = 'block';
        userPopup.classList.remove('active');
        localStorage.removeItem('loggedInUserId');
    }
});

// Show popup when email is clicked
userEmail.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    userPopup.classList.toggle('active');
});

// Hide popup when clicking outside
document.addEventListener('click', (e) => {
    if (!userPopup.contains(e.target) && !userEmail.contains(e.target)) {
        userPopup.classList.remove('active');
    }
});

// Handle logout
logoutBtn.addEventListener('click', async () => {
    try {
        await signOut(auth);
        localStorage.removeItem('loggedInUserId');
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Error signing out:', error);
    }
});