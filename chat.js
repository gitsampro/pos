import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, addDoc, serverTimestamp, query, orderBy, limit, startAfter, getDocs, updateDoc, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyA8a65KdnY4FzeX_UAC0tapvlE7pwQWWq0",
    authDomain: "forum-359a6.firebaseapp.com",
    projectId: "forum-359a6",
    storageBucket: "forum-359a6.firebasestorage.app",
    messagingSenderId: "558570896770",
    appId: "1:558570896770:web:4e51c8ea00b551ca91639b"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Constants
const QUESTIONS_PER_PAGE = 1000;
let currentPage = 1;
let expandedQuestionId = null;

// Get DOM elements
const userEmail = document.getElementById('userEmail');
const userPopup = document.getElementById('userPopup');
const logoutBtn = document.getElementById('logoutBtn');
const questionForm = document.getElementById('questionForm');
const successMessage = document.getElementById('successMessage');
const questionsList = document.getElementById('questionsList');
const prevPageBtn = document.getElementById('prevPage');
const nextPageBtn = document.getElementById('nextPage');
const askQuestionBtn = document.getElementById('askQuestionBtn');
const navLinks = document.getElementById('nav-links');
const navToggle = document.getElementById('nav-toggle');
const searchInput = document.getElementById('searchInput');

// Check authentication
onAuthStateChanged(auth, (user) => {
    if (!user) {
        // Store the current page before redirecting
        sessionStorage.setItem('originalPage', window.location.href);
        window.location.href = 'signup.html';
    } else {
        // User is signed in, load their data
        const userId = user.uid;
        localStorage.setItem('loggedInUserId', userId);
        
        // Update UI for logged in state
        const signInUpBtn = document.getElementById('signInUpBtn');
        const userMenu = document.querySelector('.user-menu');
        
        if (signInUpBtn) signInUpBtn.style.display = 'none';
        if (userMenu) userMenu.style.display = 'block';
        
        // Get user data from Firestore
        const userDoc = doc(db, "users", userId);
        getDoc(userDoc)
            .then((docSnap) => {
                if (docSnap.exists()) {
                    const userData = docSnap.data();
                    // Update UI with user data
                    if (document.getElementById('userEmail')) {
                        document.getElementById('userEmail').textContent = userData.email;
                    }
                    if (document.getElementById('popupFName')) {
                        document.getElementById('popupFName').textContent = userData.firstName;
                    }
                    if (document.getElementById('popupLName')) {
                        document.getElementById('popupLName').textContent = userData.lastName;
                    }
                    if (document.getElementById('popupEmail')) {
                        document.getElementById('popupEmail').textContent = userData.email;
                    }
                }
            })
            .catch((error) => {
                console.error("Error getting user data:", error);
            });
    }
});

// Load questions when the page loads
document.addEventListener('DOMContentLoaded', async () => {
    try {
        if (!db) {
            throw new Error("Firebase not initialized");
        }
        await loadQuestions();
    } catch (error) {
        console.error("Error loading questions:", error);
        if (questionsList) {
            questionsList.innerHTML = '<p class="error-message">Error loading questions. Please refresh the page.</p>';
        }
    }
});

// Show popup when email is clicked
userEmail.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (userPopup.style.display === 'block') {
        userPopup.style.display = 'none';
    } else {
        userPopup.style.display = 'block';
    }
});

// Close popup when clicking outside
document.addEventListener('click', (e) => {
    if (!userEmail.contains(e.target) && !userPopup.contains(e.target)) {
        userPopup.style.display = 'none';
    }
});

// Handle logout
logoutBtn.addEventListener('click', () => {
    signOut(auth)
        .then(() => {
            localStorage.removeItem('loggedInUserId');
            window.location.href = 'index.html';
        })
        .catch((error) => {
            console.error('Error signing out:', error);
        });
});

// Mobile menu toggle
navToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    navLinks.classList.toggle('active');
});

// Close mobile menu when clicking outside
document.addEventListener('click', (e) => {
    if (!navLinks.contains(e.target) && !navToggle.contains(e.target)) {
        navLinks.classList.remove('active');
    }
});

// Close mobile menu when clicking on a link
const navItems = navLinks.querySelectorAll('a');
navItems.forEach(item => {
    item.addEventListener('click', () => {
        navLinks.classList.remove('active');
    });
});

// Format timestamp
function formatTimestamp(timestamp) {
    try {
        if (!timestamp) return '';
        
        let date;
        if (typeof timestamp === 'object' && timestamp.toDate) {
            // Firebase Timestamp
            date = timestamp.toDate();
        } else if (typeof timestamp === 'string') {
            // ISO string
            date = new Date(timestamp);
        } else if (typeof timestamp === 'number') {
            // Unix timestamp
            date = new Date(timestamp);
        } else {
            console.error('Invalid timestamp format:', timestamp);
            return '';
        }

        if (isNaN(date.getTime())) {
            console.error('Invalid date:', date);
            return '';
        }

        return date.toLocaleString();
    } catch (error) {
        console.error('Error formatting timestamp:', error);
        return '';
    }
}

// Handle reactions (likes/dislikes) for replies
async function handleReplyReaction(questionId, replyId, reactionType) {
    try {
        const userId = localStorage.getItem('loggedInUserId');
        if (!userId) {
            window.location.href = 'signup.html';
            return;
        }

        const questionRef = doc(db, "questions", questionId);
        const questionDoc = await getDoc(questionRef);
        
        if (!questionDoc.exists()) {
            throw new Error("Question not found");
        }

        const questionData = questionDoc.data();
        const replies = Array.isArray(questionData.replies) ? questionData.replies : [];
        
        // Find the reply
        const replyIndex = replies.findIndex(r => r.id === replyId);
        if (replyIndex === -1) {
            throw new Error("Reply not found");
        }

        const reply = replies[replyIndex];
        const currentLikes = Array.isArray(reply.likes) ? reply.likes : [];
        const currentDislikes = Array.isArray(reply.dislikes) ? reply.dislikes : [];

        let updateData = {};
        
        if (reactionType === 'likes') {
            if (currentLikes.includes(userId)) {
                // Remove like
                reply.likes = currentLikes.filter(id => id !== userId);
            } else {
                // Add like and remove dislike if exists
                reply.likes = [...currentLikes, userId];
                if (currentDislikes.includes(userId)) {
                    reply.dislikes = currentDislikes.filter(id => id !== userId);
                }
            }
        } else if (reactionType === 'dislikes') {
            if (currentDislikes.includes(userId)) {
                // Remove dislike
                reply.dislikes = currentDislikes.filter(id => id !== userId);
            } else {
                // Add dislike and remove like if exists
                reply.dislikes = [...currentDislikes, userId];
                if (currentLikes.includes(userId)) {
                    reply.likes = currentLikes.filter(id => id !== userId);
                }
            }
        }

        // Update the specific reply in the array
        const updatedReplies = [...replies];
        updatedReplies[replyIndex] = reply;
        
        await updateDoc(questionRef, { replies: updatedReplies });

        // Update UI without collapsing
        const replyElement = document.querySelector(`[data-reply-id="${replyId}"]`);
        if (replyElement) {
            const likeBtn = replyElement.querySelector('.like-btn');
            const dislikeBtn = replyElement.querySelector('.dislike-btn');
            const likeCount = replyElement.querySelector('.like-count');
            const dislikeCount = replyElement.querySelector('.dislike-count');

            // Update counts
            const newLikes = reactionType === 'likes' ? 
                (currentLikes.includes(userId) ? currentLikes.length - 1 : currentLikes.length + 1) : 
                (currentLikes.includes(userId) ? currentLikes.length - 1 : currentLikes.length);
            
            const newDislikes = reactionType === 'dislikes' ? 
                (currentDislikes.includes(userId) ? currentDislikes.length - 1 : currentDislikes.length + 1) : 
                (currentDislikes.includes(userId) ? currentDislikes.length - 1 : currentDislikes.length);

            likeCount.textContent = newLikes;
            dislikeCount.textContent = newDislikes;

            // Update button states
            if (reactionType === 'likes') {
                likeBtn.classList.toggle('active', !currentLikes.includes(userId));
                dislikeBtn.classList.remove('active');
            } else {
                dislikeBtn.classList.toggle('active', !currentDislikes.includes(userId));
                likeBtn.classList.remove('active');
            }
        }
    } catch (error) {
        console.error("Error updating reply reaction:", error);
    }
}

// Add event listeners for reply like/dislike buttons
function addReplyReactionListeners(replyElement, questionId) {
    const likeBtn = replyElement.querySelector('.like-btn');
    const dislikeBtn = replyElement.querySelector('.dislike-btn');

    likeBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const replyId = e.currentTarget.dataset.replyId;
        await handleReplyReaction(questionId, replyId, 'likes');
    });

    dislikeBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const replyId = e.currentTarget.dataset.replyId;
        await handleReplyReaction(questionId, replyId, 'dislikes');
    });
}

// Update createQuestionElement to add reply reaction listeners
function createQuestionElement(question) {
    const questionDiv = document.createElement('div');
    questionDiv.className = 'question-item';
    questionDiv.setAttribute('data-question-id', question.id);
    
    try {
        questionDiv.innerHTML = `
            <div class="question-header">
                <h3 class="question-title">${question.title}</h3>
                <span class="expand-icon">+</span>
            </div>
            <div class="question-meta">
                <span>${question.userName} • ${formatTimestamp(question.createdAt)}</span>
            </div>
            <div class="question-content">
                <p>${question.description}</p>
                <div class="question-actions">
                    <button class="action-btn like-btn ${question.likes?.includes(localStorage.getItem('loggedInUserId')) ? 'active' : ''}" data-question-id="${question.id}">
                        <i class="fas fa-thumbs-up"></i> <span class="like-count">${question.likes?.length || 0}</span>
                    </button>
                    <button class="action-btn dislike-btn ${question.dislikes?.includes(localStorage.getItem('loggedInUserId')) ? 'active' : ''}" data-question-id="${question.id}">
                        <i class="fas fa-thumbs-down"></i> <span class="dislike-count">${question.dislikes?.length || 0}</span>
                    </button>
                    <button class="action-btn reply-btn" data-question-id="${question.id}">
                        <i class="fas fa-reply"></i> Reply
                    </button>
                </div>
                <div class="replies-list" id="replies-list-${question.id}">
                    ${(question.replies || []).map(reply => `
                        <div class="reply-item">
                            <p>${reply.text}</p>
                            <div class="reply-meta">
                                <span>${reply.userName} • ${formatTimestamp(reply.createdAt)}</span>
                                <div class="reply-actions">
                                    <button class="action-btn like-btn ${reply.likes?.includes(localStorage.getItem('loggedInUserId')) ? 'active' : ''}" data-reply-id="${reply.id}">
                                        <i class="fas fa-thumbs-up"></i> <span class="like-count">${reply.likes?.length || 0}</span>
                                    </button>
                                    <button class="action-btn dislike-btn ${reply.dislikes?.includes(localStorage.getItem('loggedInUserId')) ? 'active' : ''}" data-reply-id="${reply.id}">
                                        <i class="fas fa-thumbs-down"></i> <span class="dislike-count">${reply.dislikes?.length || 0}</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div class="reply-section" id="reply-section-${question.id}">
                    <form class="reply-form" id="reply-form-${question.id}">
                        <textarea class="reply-textarea" placeholder="Write your reply..." required></textarea>
                        <button type="submit" class="submit-btn">Post Reply</button>
                    </form>
                </div>
            </div>
        `;

        // Add reaction listeners for the question
        addReactionListeners(questionDiv);

        // Add reaction listeners for each reply
        const repliesList = questionDiv.querySelector('.replies-list');
        if (repliesList) {
            const replyItems = repliesList.querySelectorAll('.reply-item');
            replyItems.forEach(replyItem => {
                addReplyReactionListeners(replyItem, question.id);
            });
        }

        // Add expand/collapse functionality
        const questionHeader = questionDiv.querySelector('.question-header');
        const expandIcon = questionDiv.querySelector('.expand-icon');
        const questionContent = questionDiv.querySelector('.question-content');

        questionHeader.addEventListener('click', () => {
            const isExpanded = questionContent.style.display === 'block';
            
            // Only collapse if clicking the same question
            if (expandedQuestionId === question.id) {
                questionContent.style.display = 'none';
                expandIcon.textContent = '+';
                expandedQuestionId = null;
            } else {
                // Collapse previously expanded question if any
                if (expandedQuestionId) {
                    const prevQuestion = document.querySelector(`[data-question-id="${expandedQuestionId}"]`);
                    if (prevQuestion) {
                        const prevContent = prevQuestion.querySelector('.question-content');
                        const prevIcon = prevQuestion.querySelector('.expand-icon');
                        prevContent.style.display = 'none';
                        prevIcon.textContent = '+';
                    }
                }
                
                // Expand current question
                questionContent.style.display = 'block';
                expandIcon.textContent = '-';
                expandedQuestionId = question.id;
            }
        });

        // Add reply button functionality
        const replyBtn = questionDiv.querySelector('.reply-btn');
        const replySection = questionDiv.querySelector('.reply-section');

        replyBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            replySection.style.display = 'block';
        });

        // Add reply form submission
        const replyForm = questionDiv.querySelector('.reply-form');
        replyForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const replyText = replyForm.querySelector('textarea').value;
            await handleReply(question.id, replyText);
        });

    } catch (error) {
        console.error('Error creating question element:', error);
        questionDiv.innerHTML = '<p class="error-message">Error displaying question. Please try again.</p>';
    }

    return questionDiv;
}

// Handle reactions (likes/dislikes) for questions
async function handleReaction(questionId, reactionType) {
    try {
        const userId = localStorage.getItem('loggedInUserId');
        if (!userId) {
            window.location.href = 'signup.html';
            return;
        }

        const questionRef = doc(db, "questions", questionId);
        const questionDoc = await getDoc(questionRef);
        
        if (!questionDoc.exists()) {
            throw new Error("Question not found");
        }

        const questionData = questionDoc.data();
        const currentLikes = Array.isArray(questionData.likes) ? questionData.likes : [];
        const currentDislikes = Array.isArray(questionData.dislikes) ? questionData.dislikes : [];

        let updateData = {};
        
        if (reactionType === 'likes') {
            if (currentLikes.includes(userId)) {
                // Remove like
                updateData.likes = arrayRemove(userId);
            } else {
                // Add like and remove dislike if exists
                updateData.likes = arrayUnion(userId);
                if (currentDislikes.includes(userId)) {
                    updateData.dislikes = arrayRemove(userId);
                }
            }
        } else if (reactionType === 'dislikes') {
            if (currentDislikes.includes(userId)) {
                // Remove dislike
                updateData.dislikes = arrayRemove(userId);
            } else {
                // Add dislike and remove like if exists
                updateData.dislikes = arrayUnion(userId);
                if (currentLikes.includes(userId)) {
                    updateData.likes = arrayRemove(userId);
                }
            }
        }

        await updateDoc(questionRef, updateData);

        // Update UI without collapsing
        const questionElement = document.querySelector(`[data-question-id="${questionId}"]`);
        if (questionElement) {
            const likeBtn = questionElement.querySelector('.like-btn');
            const dislikeBtn = questionElement.querySelector('.dislike-btn');
            const likeCount = questionElement.querySelector('.like-count');
            const dislikeCount = questionElement.querySelector('.dislike-count');

            // Update counts
            const newLikes = reactionType === 'likes' ? 
                (currentLikes.includes(userId) ? currentLikes.length - 1 : currentLikes.length + 1) : 
                (currentLikes.includes(userId) ? currentLikes.length - 1 : currentLikes.length);
            
            const newDislikes = reactionType === 'dislikes' ? 
                (currentDislikes.includes(userId) ? currentDislikes.length - 1 : currentDislikes.length + 1) : 
                (currentDislikes.includes(userId) ? currentDislikes.length - 1 : currentDislikes.length);

            likeCount.textContent = newLikes;
            dislikeCount.textContent = newDislikes;

            // Update button states
            if (reactionType === 'likes') {
                likeBtn.classList.toggle('active', !currentLikes.includes(userId));
                dislikeBtn.classList.remove('active');
            } else {
                dislikeBtn.classList.toggle('active', !currentDislikes.includes(userId));
                likeBtn.classList.remove('active');
            }
        }
    } catch (error) {
        console.error("Error updating reaction:", error);
    }
}

// Add event listeners for like/dislike buttons
function addReactionListeners(questionElement) {
    const likeBtn = questionElement.querySelector('.like-btn');
    const dislikeBtn = questionElement.querySelector('.dislike-btn');

    likeBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const questionId = e.currentTarget.dataset.questionId;
        await handleReaction(questionId, 'likes');
    });

    dislikeBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const questionId = e.currentTarget.dataset.questionId;
        await handleReaction(questionId, 'dislikes');
    });
}

// Handle reply submission
async function handleReply(questionId, replyText) {
    try {
        const userId = localStorage.getItem('loggedInUserId');
        if (!userId) {
            window.location.href = 'signup.html';
            return;
        }

        // Get user data
        const userDoc = await getDoc(doc(db, "users", userId));
        if (!userDoc.exists()) {
            throw new Error("User not found");
        }
        const userData = userDoc.data();

        // Create reply object with regular timestamp
        const reply = {
            id: Date.now().toString(),
            text: replyText,
            userId: userId,
            userName: `${userData.firstName} ${userData.lastName}`,
            createdAt: new Date().toISOString(),
            likes: [],
            dislikes: []
        };

        // Get the question document
        const questionRef = doc(db, "questions", questionId);
        const questionDoc = await getDoc(questionRef);
        
        if (!questionDoc.exists()) {
            throw new Error("Question not found");
        }

        const questionData = questionDoc.data();
        
        // Initialize replies array if it doesn't exist
        const existingReplies = Array.isArray(questionData.replies) ? questionData.replies : [];
        
        // Add new reply to the array
        const updatedReplies = [...existingReplies, reply];
        
        // Update the document with new replies array
        await updateDoc(questionRef, {
            replies: updatedReplies
        });

        // Show success message
        successMessage.textContent = 'Reply posted successfully!';
        successMessage.style.display = 'block';
        successMessage.style.color = '#3c763d';
        successMessage.style.backgroundColor = '#dff0d8';
        setTimeout(() => {
            successMessage.style.display = 'none';
        }, 3000);

        // Clear the reply textarea
        const replyForm = document.getElementById(`reply-form-${questionId}`);
        if (replyForm) {
            replyForm.querySelector('textarea').value = '';
        }

        // Store the expanded question ID before refreshing
        const currentExpandedId = expandedQuestionId;
        
        // Refresh the questions list
        await loadQuestions();
        
        // Re-expand the question to show the new reply
        if (currentExpandedId) {
            const updatedQuestion = document.querySelector(`[data-question-id="${currentExpandedId}"]`);
            if (updatedQuestion) {
                const updatedContent = updatedQuestion.querySelector('.question-content');
                const updatedIcon = updatedQuestion.querySelector('.expand-icon');
                if (updatedContent && updatedIcon) {
                    updatedContent.style.display = 'block';
                    updatedIcon.textContent = '-';
                    expandedQuestionId = currentExpandedId;
                }
            }
        }
    } catch (error) {
        console.error("Error posting reply:", error);
        successMessage.textContent = `Error posting reply: ${error.message}. Please try again.`;
        successMessage.style.display = 'block';
        successMessage.style.color = '#a94442';
        successMessage.style.backgroundColor = '#f2dede';
        setTimeout(() => {
            successMessage.style.display = 'none';
        }, 3000);
    }
}

// Load questions with pagination
async function loadQuestions(searchTerm = '') {
    try {
        if (!questionsList) {
            console.error("Questions list element not found");
            return;
        }

        if (!db) {
            throw new Error("Firebase not initialized");
        }

        // Clear existing questions
        questionsList.innerHTML = '';

        // Get all questions
        const questionsRef = collection(db, "questions");
        const q = query(questionsRef, orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            questionsList.innerHTML = '<p class="no-questions">No questions found. Be the first to ask a question!</p>';
            return;
        }

        // Filter questions based on search term
        let questions = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            // Ensure all required fields exist
            const question = {
                id: doc.id,
                title: data.title || '',
                description: data.description || '',
                userId: data.userId || '',
                userName: data.userName || '',
                userEmail: data.userEmail || '',
                createdAt: data.createdAt || new Date(),
                status: data.status || 'open',
                likes: Array.isArray(data.likes) ? data.likes : [],
                dislikes: Array.isArray(data.dislikes) ? data.dislikes : [],
                replies: Array.isArray(data.replies) ? data.replies : []
            };

            if (searchTerm) {
                const searchLower = searchTerm.toLowerCase();
                if (question.title.toLowerCase().includes(searchLower) || 
                    question.description.toLowerCase().includes(searchLower)) {
                    questions.push(question);
                }
            } else {
                questions.push(question);
            }
        });

        if (questions.length === 0) {
            questionsList.innerHTML = '<p class="no-questions">No matching questions found.</p>';
            return;
        }

        // Sort questions by creation date (newest first)
        questions.sort((a, b) => b.createdAt - a.createdAt);

        // Display all questions
        questions.forEach(question => {
            const questionElement = createQuestionElement(question);
            questionsList.appendChild(questionElement);

            // If this was the expanded question, expand it again
            if (question.id === expandedQuestionId) {
                const content = questionElement.querySelector('.question-content');
                const icon = questionElement.querySelector('.expand-icon');
                if (content && icon) {
                    content.style.display = 'block';
                    icon.textContent = '-';
                }
            }
        });

        // Disable pagination buttons
        if (prevPageBtn && nextPageBtn) {
            prevPageBtn.disabled = true;
            nextPageBtn.disabled = true;
        }
    } catch (error) {
        console.error("Error loading questions:", error);
        if (questionsList) {
            questionsList.innerHTML = '<p class="error-message">Error loading questions. Please refresh the page.</p>';
        }
    }
}

// Handle question submission
questionForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const title = document.getElementById('questionTitle').value;
    const description = document.getElementById('questionDescription').value;
    const userId = localStorage.getItem('loggedInUserId');

    if (!userId) {
        window.location.href = 'index.html';
        return;
    }

    try {
        // Get user data
        const userDoc = await getDoc(doc(db, "users", userId));
        if (!userDoc.exists()) {
            throw new Error("User not found");
        }

        const userData = userDoc.data();

        // Create question with all required fields
        const questionData = {
            title,
            description,
            userId,
            userName: `${userData.firstName} ${userData.lastName}`,
            userEmail: userData.email,
            createdAt: serverTimestamp(),
            status: 'open',
            likes: [],
            dislikes: [],
            replies: []
        };

        // Add question to Firestore
        await addDoc(collection(db, "questions"), questionData);

        // Show success message
        successMessage.textContent = 'Question posted successfully!';
        successMessage.style.display = 'block';
        successMessage.style.color = '#3c763d';
        successMessage.style.backgroundColor = '#dff0d8';
        setTimeout(() => {
            successMessage.style.display = 'none';
        }, 3000);

        // Reset form
        questionForm.reset();

        // Reload questions
        await loadQuestions();
    } catch (error) {
        console.error("Error posting question:", error);
        successMessage.textContent = 'Error posting question. Please try again.';
        successMessage.style.display = 'block';
        successMessage.style.color = '#a94442';
        successMessage.style.backgroundColor = '#f2dede';
        setTimeout(() => {
            successMessage.style.display = 'none';
        }, 3000);
    }
});

// Toggle question form
askQuestionBtn.addEventListener('click', () => {
    const isExpanded = questionForm.style.display === 'flex';
    questionForm.style.display = isExpanded ? 'none' : 'flex';
    askQuestionBtn.innerHTML = isExpanded ? 
        '<i class="fa-solid fa-plus"></i> Ask a Question' : 
        '<i class="fa-solid fa-minus"></i> Cancel';
});

// Add search functionality
searchInput.addEventListener('input', (e) => {
    currentPage = 1; // Reset to first page when searching
    loadQuestions(e.target.value);
});

// Add this after the pagination buttons event listeners
const showAllBtn = document.createElement('button');
showAllBtn.textContent = 'Show All Questions';
showAllBtn.className = 'secondary-button';
showAllBtn.style.marginLeft = '10px';
showAllBtn.style.padding = '8px 16px';
showAllBtn.style.cursor = 'pointer';

// Insert the button after the pagination buttons
const paginationContainer = document.querySelector('.pagination');
if (paginationContainer) {
    paginationContainer.appendChild(showAllBtn);
}

// Add event listener for the show all button
showAllBtn.addEventListener('click', async () => {
    try {
        await loadQuestions();
        
        // Show success message
        const successMessage = document.getElementById('successMessage');
        successMessage.textContent = 'Showing all questions';
        successMessage.style.display = 'block';
        successMessage.style.color = '#3c763d';
        successMessage.style.backgroundColor = '#dff0d8';
        setTimeout(() => {
            successMessage.style.display = 'none';
        }, 3000);
    } catch (error) {
        console.error("Error showing all questions:", error);
        const successMessage = document.getElementById('successMessage');
        successMessage.textContent = 'Error showing all questions. Please try again.';
        successMessage.style.display = 'block';
        successMessage.style.color = '#a94442';
        successMessage.style.backgroundColor = '#f2dede';
        setTimeout(() => {
            successMessage.style.display = 'none';
        }, 3000);
    }
});

// Add this CSS to your style.css file
const style = document.createElement('style');
style.textContent = `
    .no-questions, .error-message {
        text-align: center;
        padding: 20px;
        color: #666;
        font-size: 1.1em;
    }
    .error-message {
        color: #a94442;
    }
`;
document.head.appendChild(style);

// Initialize dark mode
document.addEventListener('DOMContentLoaded', () => {
    const darkModeToggle = document.getElementById('darkModeToggle');
    const image = document.getElementById('mainlogo');
    const bigimage = document.getElementById('biglogo');
    const root = document.documentElement;
    const icon = document.getElementById('darkModeIcon');

    // Check localStorage for dark mode state
    let isDarkMode = localStorage.getItem('darkMode') === 'true';

    // Apply initial state
    if (isDarkMode) {
        applyDarkMode();
    }

    function applyDarkMode() {
        root.style.setProperty('--primary-text-color', '#d3e0ea');
        root.style.setProperty('--secondary-text-color', '#b0b8c1');
        root.style.setProperty('--accent-color', '#66ffcc');
        root.style.setProperty('--accent-color-dark', '#33bbee');
        root.style.setProperty('--nav-bg-color', 'rgba(17, 17, 27, 0.95)');
        root.style.setProperty('--nav-text-color', '#d9bfff');
        root.style.setProperty('--nav-hover-color', '#e0c2ff');
        root.style.setProperty('--all-white', '#000000');
        root.style.setProperty('--all-black', '#ffffff');
        root.style.setProperty('--popup-bg-color', '#1c86efd5');
        root.style.setProperty('--body-bg-image', "url('./assets/darkbackground1.png')");
        if (image) image.src = './assets/asset 11.png';
        if (bigimage) bigimage.src = './assets/asset 11.png';
        if (icon) {
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
        }
    }

    function applyLightMode() {
        root.style.setProperty('--primary-text-color', '#183b56');
        root.style.setProperty('--secondary-text-color', '#2f3030');
        root.style.setProperty('--accent-color', '#10A37F');
        root.style.setProperty('--accent-color-dark', '#0673b7');
        root.style.setProperty('--nav-bg-color', 'rgba(24, 24, 37, 0.8)');
        root.style.setProperty('--nav-text-color', 'rgb(55, 0, 122)');
        root.style.setProperty('--nav-hover-color', '#a78bfa');
        root.style.setProperty('--all-white', '#ffffff');
        root.style.setProperty('--all-black', '#000000');
        root.style.setProperty('--popup-bg-color', '#ffffff');
        root.style.setProperty('--body-bg-image', "url('./assets/background.png')");
        if (image) image.src = './assets/asset 1.png';
        if (bigimage) bigimage.src = './assets/asset 1.png';
        if (icon) {
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
        }
    }

    if (darkModeToggle) {
        darkModeToggle.addEventListener('click', () => {
            isDarkMode = !isDarkMode;
            localStorage.setItem('darkMode', isDarkMode);
            
            if (isDarkMode) {
                applyDarkMode();
            } else {
                applyLightMode();
            }
        });
    }
}); 