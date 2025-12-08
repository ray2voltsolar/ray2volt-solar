/* ==========================================================================
   Ray2Volt Solar - JavaScript
   ========================================================================== */

document.addEventListener('DOMContentLoaded', function () {
    // Mobile Menu Toggle
    const menuToggle = document.querySelector('.menu-toggle');
    const navMenu = document.querySelector('.nav-menu');

    if (menuToggle && navMenu) {
        menuToggle.addEventListener('click', function () {
            this.classList.toggle('active');
            navMenu.classList.toggle('active');
        });

        // Close menu when clicking a link
        const navLinks = navMenu.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                menuToggle.classList.remove('active');
                navMenu.classList.remove('active');
            });
        });
    }

    // Header Scroll Effect
    const header = document.querySelector('.header');

    if (header) {
        window.addEventListener('scroll', function () {
            if (window.scrollY > 50) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }
        });
    }

    // Smooth Scroll for Anchor Links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;

            const target = document.querySelector(targetId);
            if (target) {
                e.preventDefault();
                const headerHeight = header ? header.offsetHeight : 0;
                const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - headerHeight;

                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });

    // Active Navigation Link
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const navLinks = document.querySelectorAll('.nav-link');

    navLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href === currentPage || (currentPage === '' && href === 'index.html')) {
            link.classList.add('active');
        }
    });

    // Form Validation
    const contactForm = document.getElementById('contact-form');

    if (contactForm) {
        contactForm.addEventListener('submit', function (e) {
            const name = document.getElementById('name');
            const phone = document.getElementById('phone');
            const message = document.getElementById('message');
            let isValid = true;

            // Simple validation
            if (name && name.value.trim() === '') {
                isValid = false;
                showError(name, 'Please enter your name');
            } else if (name) {
                clearError(name);
            }

            if (phone && phone.value.trim() === '') {
                isValid = false;
                showError(phone, 'Please enter your phone number');
            } else if (phone && !isValidPhone(phone.value)) {
                isValid = false;
                showError(phone, 'Please enter a valid phone number');
            } else if (phone) {
                clearError(phone);
            }

            if (message && message.value.trim() === '') {
                isValid = false;
                showError(message, 'Please enter your message');
            } else if (message) {
                clearError(message);
            }

            if (!isValid) {
                e.preventDefault();
            }
        });
    }

    function showError(input, message) {
        const formGroup = input.closest('.form-group');
        let error = formGroup.querySelector('.error-message');

        if (!error) {
            error = document.createElement('span');
            error.className = 'error-message';
            error.style.color = '#F44336';
            error.style.fontSize = '0.875rem';
            error.style.marginTop = '0.25rem';
            formGroup.appendChild(error);
        }

        error.textContent = message;
        input.style.borderColor = '#F44336';
    }

    function clearError(input) {
        const formGroup = input.closest('.form-group');
        const error = formGroup.querySelector('.error-message');

        if (error) {
            error.remove();
        }

        input.style.borderColor = '';
    }

    function isValidPhone(phone) {
        const phoneRegex = /^[\d\s\-\+\(\)]{10,}$/;
        return phoneRegex.test(phone);
    }

    // Animation on Scroll (Simple IntersectionObserver)
    const animateElements = document.querySelectorAll('.animate-on-scroll');

    if (animateElements.length > 0 && 'IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animate-fadeInUp');
                    observer.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        });

        animateElements.forEach(el => observer.observe(el));
    }
});
