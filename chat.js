import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, addDoc, serverTimestamp, query, orderBy, limit, startAfter, getDocs, updateDoc, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyA8a65KdnY4FzeX_UAC0tapvlE7pwQWWq0",
    authDomain: "forum-359a6.firebaseapp.com",
    projectId: "forum-359a6",
    storageBucket: "forum-359a6.firebasestorage.app",
    messagingSenderId: "558570896770",
    appId: "1:558570896770:web:7b5a2e6b4fc96a0891639b"
};

// Initialize Firebase
let app;
let auth;
let db;

try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    console.log("Firebase initialized successfully");
} catch (error) {
    console.error("Error initializing Firebase:", error);
}

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

// Check authentication
const userId = localStorage.getItem('loggedInUserId');
if (!userId) {
    window.location.href = 'signup.html';
}

// Load questions when the page loads
document.addEventListener('DOMContentLoaded', async () => {
    try {
        if (!db) {
            throw new Error("Firebase not initialized");
        }
        await loadQuestions();
    } catch (error) {
        console.error("Error loading questions on page load:", error);
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

// Create question element
function createQuestionElement(question) {
    const questionDiv = document.createElement('div');
    questionDiv.className = 'question-item';
    questionDiv.setAttribute('data-question-id', question.id);
    
    try {
        // Sort replies by likes count in descending order
        const sortedReplies = [...(question.replies || [])].sort((a, b) => {
            const aLikes = a.likes?.length || 0;
            const bLikes = b.likes?.length || 0;
            return bLikes - aLikes;
        });

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
                <div class="reply-section" id="reply-section-${question.id}">
                    <form class="reply-form" id="reply-form-${question.id}">
                        <textarea class="reply-textarea" placeholder="Write your reply..." required></textarea>
                        <button type="submit" class="submit-btn">Post Reply</button>
                    </form>
                    <div class="replies-list" id="replies-list-${question.id}">
                        ${sortedReplies.map(reply => `
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
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error creating question element:', error);
        questionDiv.innerHTML = '<p class="error-message">Error displaying question. Please try again.</p>';
    }

    // Add expand/collapse functionality
    const questionHeader = questionDiv.querySelector('.question-header');
    const expandIcon = questionDiv.querySelector('.expand-icon');
    const questionContent = questionDiv.querySelector('.question-content');
    const replySection = questionDiv.querySelector('.reply-section');

    questionHeader.addEventListener('click', () => {
        const isExpanded = questionContent.style.display === 'block';
        
        // Only collapse if clicking the same question
        if (expandedQuestionId === question.id) {
            questionContent.style.display = 'none';
            replySection.style.display = 'none';
            expandIcon.textContent = '+';
            expandedQuestionId = null;
        } else {
            // Collapse previously expanded question if any
            if (expandedQuestionId) {
                const prevQuestion = document.querySelector(`[data-question-id="${expandedQuestionId}"]`);
                if (prevQuestion) {
                    const prevContent = prevQuestion.querySelector('.question-content');
                    const prevReplySection = prevQuestion.querySelector('.reply-section');
                    const prevIcon = prevQuestion.querySelector('.expand-icon');
                    prevContent.style.display = 'none';
                    prevReplySection.style.display = 'none';
                    prevIcon.textContent = '+';
                }
            }
            
            // Expand current question
            questionContent.style.display = 'block';
            replySection.style.display = 'block';
            expandIcon.textContent = '-';
            expandedQuestionId = question.id;
        }
    });

    // Add like/dislike functionality for questions
    const likeBtn = questionDiv.querySelector('.like-btn');
    const dislikeBtn = questionDiv.querySelector('.dislike-btn');

    likeBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await handleReaction(question.id, 'likes');
    });

    dislikeBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await handleReaction(question.id, 'dislikes');
    });

    // Add like/dislike functionality for replies
    questionDiv.querySelectorAll('.reply-item .like-btn, .reply-item .dislike-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const replyId = e.currentTarget.dataset.replyId;
            const reactionType = e.currentTarget.classList.contains('like-btn') ? 'likes' : 'dislikes';
            await handleReplyReaction(question.id, replyId, reactionType);
        });
    });

    // Add reply functionality
    const replyBtn = questionDiv.querySelector('.reply-btn');
    const replyForm = questionDiv.querySelector('.reply-form');

    replyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        replyForm.style.display = replyForm.style.display === 'block' ? 'none' : 'block';
    });

    replyForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const replyText = replyForm.querySelector('textarea').value;
        await handleReply(question.id, replyText);
    });

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
            console.error("Question not found");
            return;
        }

        const questionData = questionDoc.data();
        
        // Initialize arrays if they don't exist
        if (!Array.isArray(questionData.likes)) questionData.likes = [];
        if (!Array.isArray(questionData.dislikes)) questionData.dislikes = [];
        
        // Check if user has already reacted
        const hasReacted = questionData[reactionType].includes(userId);
        const oppositeReaction = reactionType === 'likes' ? 'dislikes' : 'likes';
        const hasOppositeReaction = questionData[oppositeReaction].includes(userId);

        let updateData = {};
        
        if (hasReacted) {
            // Remove reaction
            updateData[reactionType] = arrayRemove(userId);
        } else {
            // Add reaction
            updateData[reactionType] = arrayUnion(userId);
            // Remove opposite reaction if exists
            if (hasOppositeReaction) {
                updateData[oppositeReaction] = arrayRemove(userId);
            }
        }

        await updateDoc(questionRef, updateData);
        
        // Update the UI without collapsing
        const questionElement = document.querySelector(`[data-question-id="${questionId}"]`);
        if (questionElement) {
            const likeBtn = questionElement.querySelector('.like-btn');
            const dislikeBtn = questionElement.querySelector('.dislike-btn');
            const likeCount = questionElement.querySelector('.like-count');
            const dislikeCount = questionElement.querySelector('.dislike-count');

            if (likeBtn && dislikeBtn && likeCount && dislikeCount) {
                // Update counts
                const newLikes = reactionType === 'likes' ? 
                    (hasReacted ? questionData.likes.length - 1 : questionData.likes.length + 1) : 
                    questionData.likes.length;
                const newDislikes = reactionType === 'dislikes' ? 
                    (hasReacted ? questionData.dislikes.length - 1 : questionData.dislikes.length + 1) : 
                    questionData.dislikes.length;

                likeCount.textContent = newLikes;
                dislikeCount.textContent = newDislikes;

                // Update button states
                if (reactionType === 'likes') {
                    likeBtn.classList.toggle('active', !hasReacted);
                    dislikeBtn.classList.remove('active');
                } else {
                    dislikeBtn.classList.toggle('active', !hasReacted);
                    likeBtn.classList.remove('active');
                }
            }
        }
    } catch (error) {
        console.error("Error updating reaction:", error);
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
            console.error("Question not found");
            return;
        }

        const questionData = questionDoc.data();
        
        // Find the reply
        const replyIndex = questionData.replies.findIndex(r => r.id === replyId);
        if (replyIndex === -1) {
            console.error("Reply not found");
            return;
        }

        const reply = questionData.replies[replyIndex];
        
        // Initialize arrays if they don't exist
        if (!Array.isArray(reply.likes)) reply.likes = [];
        if (!Array.isArray(reply.dislikes)) reply.dislikes = [];
        
        const hasReacted = reply[reactionType].includes(userId);
        const oppositeReaction = reactionType === 'likes' ? 'dislikes' : 'likes';
        const hasOppositeReaction = reply[oppositeReaction].includes(userId);

        // Update the reply object
        if (hasReacted) {
            // Remove reaction
            reply[reactionType] = reply[reactionType].filter(id => id !== userId);
        } else {
            // Add reaction
            reply[reactionType] = [...reply[reactionType], userId];
            // Remove opposite reaction if exists
            if (hasOppositeReaction) {
                reply[oppositeReaction] = reply[oppositeReaction].filter(id => id !== userId);
            }
        }

        // Update the specific reply in the array
        const updatedReplies = [...questionData.replies];
        updatedReplies[replyIndex] = reply;
        
        // Update the document
        await updateDoc(questionRef, { replies: updatedReplies });
        
        // Update the UI
        const replyElement = document.querySelector(`[data-reply-id="${replyId}"]`);
        if (replyElement) {
            const likeBtn = replyElement.querySelector('.like-btn');
            const dislikeBtn = replyElement.querySelector('.dislike-btn');
            const likeCount = replyElement.querySelector('.like-count');
            const dislikeCount = replyElement.querySelector('.dislike-count');

            if (likeBtn && dislikeBtn && likeCount && dislikeCount) {
                // Update counts
                const newLikes = reactionType === 'likes' ? 
                    (hasReacted ? reply.likes.length - 1 : reply.likes.length + 1) : 
                    reply.likes.length;
                const newDislikes = reactionType === 'dislikes' ? 
                    (hasReacted ? reply.dislikes.length - 1 : reply.dislikes.length + 1) : 
                    reply.dislikes.length;

                likeCount.textContent = newLikes;
                dislikeCount.textContent = newDislikes;

                // Update button states
                if (reactionType === 'likes') {
                    likeBtn.classList.toggle('active', !hasReacted);
                    dislikeBtn.classList.remove('active');
                } else {
                    dislikeBtn.classList.toggle('active', !hasReacted);
                    likeBtn.classList.remove('active');
                }
            }
        }
    } catch (error) {
        console.error("Error updating reply reaction:", error);
    }
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
        const successMessage = document.getElementById('successMessage');
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

        // Refresh the questions list
        await loadQuestions();
        
        // Re-expand the question to show the new reply
        const updatedQuestion = document.querySelector(`[data-question-id="${questionId}"]`);
        if (updatedQuestion) {
            const updatedContent = updatedQuestion.querySelector('.question-content');
            const updatedIcon = updatedQuestion.querySelector('.expand-icon');
            if (updatedContent && updatedIcon) {
                updatedContent.style.display = 'block';
                updatedIcon.textContent = '-';
                expandedQuestionId = questionId;
            }
        }
    } catch (error) {
        console.error("Error posting reply:", error);
        const successMessage = document.getElementById('successMessage');
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

// Check authentication state and load questions
onAuthStateChanged(auth, (user) => {
    const loggedInUserId = localStorage.getItem('loggedInUserId');
    if (loggedInUserId) {
        const docRef = doc(db, "users", loggedInUserId);
        getDoc(docRef)
            .then((docSnap) => {
                if (docSnap.exists()) {
                    const userData = docSnap.data();
                    document.getElementById('loggedUserEmail').innerText = userData.email;
                    document.getElementById('popupFName').innerText = userData.firstName;
                    document.getElementById('popupLName').innerText = userData.lastName;
                    document.getElementById('popupEmail').innerText = userData.email;
                    loadQuestions();
                } else {
                    console.log("No document found matching id");
                    window.location.href = 'index.html';
                }
            })
            .catch((error) => {
                console.log("Error getting document:", error);
                window.location.href = 'index.html';
            });
    } else {
        console.log("User ID not found in Local storage");
        window.location.href = 'index.html';
    }
});

// Add search functionality
const searchContainer = document.createElement('div');
searchContainer.className = 'search-container';

const searchButton = document.createElement('button');
searchButton.className = 'search-button';
searchButton.innerHTML = '<i class="fas fa-search"></i><span>Search a Question</span>';

const searchInput = document.createElement('input');
searchInput.type = 'text';
searchInput.placeholder = 'Search questions...';
searchInput.className = 'search-input';

searchContainer.appendChild(searchButton);
searchContainer.appendChild(searchInput);
document.body.insertBefore(searchContainer, document.querySelector('.chat-container'));

// Toggle search input on button click
searchButton.addEventListener('click', () => {
    searchContainer.classList.toggle('active');
    if (searchContainer.classList.contains('active')) {
        searchInput.focus();
    }
});

// Add search event listener
searchInput.addEventListener('input', (e) => {
    currentPage = 1; // Reset to first page when searching
    loadQuestions(e.target.value);
});

// Close search when clicking outside
document.addEventListener('click', (e) => {
    if (!searchContainer.contains(e.target)) {
        searchContainer.classList.remove('active');
    }
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
        
        border-radius: 8px;
        margin: 20px 0;
    }
    .error-message {
        color: #a94442;
        background-color: #f8d7da;
        border: 1px solid #f5c6cb;
    }
    .question-title {
        color: rgb(2, 5, 8);
        font-weight: 600;
        margin: 0;
        padding: 10px 0;
        font-size: 1.2em;
    }
    .submit-btn {
        display: block;
        margin: 10px auto;
        padding: 8px 20px;
        background-color: #007bff;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        transition: background-color 0.3s ease;
    }
    .submit-btn:hover {
        background-color: #0056b3;
    }
    .question-content {
        display: none;
        padding: 15px;
        border-top: 1px solid #eee;
    }
    .reply-section {
        display: none;
        margin-top: 15px;
    }
    .reply-form {
        margin-bottom: 15px;
    }
    .reply-textarea {
        width: 100%;
        min-height: 80px;
        padding: 10px;
        margin-bottom: 10px;
        border: 1px solid #ddd;
        border-radius: 4px;
        resize: vertical;
    }
`;
document.head.appendChild(style); 