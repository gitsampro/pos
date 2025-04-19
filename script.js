const signUpButton=document.getElementById('signUpButton');
const signInButton=document.getElementById('signInButton');
const signInForm=document.getElementById('signIn');
const signUpForm=document.getElementById('signup');

signUpButton.addEventListener('click',function(){
    signInForm.style.display="none";
    signUpForm.style.display="block";
})
signInButton.addEventListener('click', function(){
    signInForm.style.display="block";
    signUpForm.style.display="none";
})

// Get DOM elements
const nav = document.querySelector('nav');
const topBanner = document.querySelector('.top-banner');
const toggleButton = document.getElementById('nav-toggle');
const navLinks = document.getElementById('nav-links');

// Handle banner visibility
if (topBanner) {
    nav.classList.add('nav-with-banner');
    
    setTimeout(() => {
        topBanner.style.transform = 'translateY(-100%)';
        nav.classList.remove('nav-with-banner');
        
        setTimeout(() => {
            topBanner.style.display = 'none';
        }, 500);
    }, 5000);
}

// Mobile menu toggle
toggleButton.addEventListener('click', (e) => {
    e.stopPropagation();
    navLinks.classList.toggle('active');
});

// Close mobile menu when clicking outside
document.addEventListener('click', (e) => {
    if (!navLinks.contains(e.target) && !toggleButton.contains(e.target)) {
        navLinks.classList.remove('active');
    }
});

// Add scroll effect to navigation
let lastScroll = 0;
window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;
    
    if (currentScroll <= 0) {
        nav.style.transform = 'translateY(0)';
        return;
    }
    
    if (currentScroll > lastScroll && !navLinks.classList.contains('active')) {
        // Scrolling down & menu is closed
        nav.style.transform = 'translateY(-100%)';
    } else {
        // Scrolling up
        nav.style.transform = 'translateY(0)';
    }
    
    lastScroll = currentScroll;
});