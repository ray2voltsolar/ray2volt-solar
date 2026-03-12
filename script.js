/* ==========================================================================
   Ray2Volt Solar - JavaScript (Enhanced)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', function () {

    // ──────────────────────────────────────────────────────────
    // 1. Mobile Menu Toggle
    // ──────────────────────────────────────────────────────────
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

    // ──────────────────────────────────────────────────────────
    // 2. Header Scroll Effect (with shrink)
    // ──────────────────────────────────────────────────────────
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

    // ──────────────────────────────────────────────────────────
    // 3. Smooth Scroll for Anchor Links
    // ──────────────────────────────────────────────────────────
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

    // ──────────────────────────────────────────────────────────
    // 4. Active Navigation Link
    // ──────────────────────────────────────────────────────────
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const allNavLinks = document.querySelectorAll('.nav-link');

    allNavLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href === currentPage || (currentPage === '' && href === 'index.html')) {
            link.classList.add('active');
        }
    });

    // ──────────────────────────────────────────────────────────
    // 5. Form Validation
    // ──────────────────────────────────────────────────────────
    const contactForm = document.getElementById('contact-form');
    const quoteForm = document.getElementById('quote-form');

    function validateForm(formElements, e) {
        let isValid = true;

        formElements.forEach(({ element, validate, errorMessage }) => {
            if (element) {
                if (!validate(element.value)) {
                    isValid = false;
                    showError(element, errorMessage);
                } else {
                    clearError(element);
                }
            }
        });

        if (!isValid && e) {
            e.preventDefault();
        }
    }

    if (contactForm) {
        contactForm.addEventListener('submit', function (e) {
            validateForm([
                { element: document.getElementById('name'), validate: val => val.trim() !== '', errorMessage: 'Please enter your name' },
                { element: document.getElementById('phone'), validate: val => isValidPhone(val), errorMessage: 'Please enter a valid phone number' },
                { element: document.getElementById('message'), validate: val => val.trim() !== '', errorMessage: 'Please enter your message' }
            ], e);
        });
    }

    if (quoteForm) {
        quoteForm.addEventListener('submit', function (e) {
            validateForm([
                { element: document.getElementById('name'), validate: val => val.trim() !== '', errorMessage: 'Please enter your name' },
                { element: document.getElementById('phone'), validate: val => isValidPhone(val), errorMessage: 'Please enter a valid phone number' }
            ], e);
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

    // ──────────────────────────────────────────────────────────
    // 6. Scroll Reveal Animations
    // ──────────────────────────────────────────────────────────
    const revealElements = document.querySelectorAll('.reveal');

    if (revealElements.length > 0 && 'IntersectionObserver' in window) {
        const revealObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('revealed');
                    revealObserver.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.1,
            rootMargin: '0px 0px -60px 0px'
        });

        revealElements.forEach(el => revealObserver.observe(el));
    }

    // ──────────────────────────────────────────────────────────
    // 7. Animated Counter for Hero Stats
    // ──────────────────────────────────────────────────────────
    function animateCounter(el, target, suffix = '') {
        const duration = 2000;
        const start = 0;
        const startTime = performance.now();

        function update(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Ease out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = Math.round(start + (target - eased * (start - target)));

            el.textContent = current + suffix;

            if (progress < 1) {
                requestAnimationFrame(update);
            }
        }

        requestAnimationFrame(update);
    }

    const heroStats = document.querySelectorAll('.hero-stat h3');
    if (heroStats.length > 0 && 'IntersectionObserver' in window) {
        const statsObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const el = entry.target;
                    const text = el.textContent.trim();

                    // Parse the number and suffix from text like "500+", "5 MW+", "100%"
                    const match = text.match(/^([\d,]+)\s*(.*)/);
                    if (match) {
                        const num = parseInt(match[1].replace(/,/g, ''));
                        const suffix = match[2] || '';
                        animateCounter(el, num, suffix);
                    }

                    statsObserver.unobserve(el);
                }
            });
        }, {
            threshold: 0.5
        });

        heroStats.forEach(stat => statsObserver.observe(stat));
    }

    // ──────────────────────────────────────────────────────────
    // 8. Scroll to Top Button
    // ──────────────────────────────────────────────────────────
    const scrollToTopBtn = document.querySelector('.scroll-to-top');

    if (scrollToTopBtn) {
        window.addEventListener('scroll', function () {
            if (window.scrollY > 400) {
                scrollToTopBtn.classList.add('visible');
            } else {
                scrollToTopBtn.classList.remove('visible');
            }
        });

        scrollToTopBtn.addEventListener('click', function () {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }

    // ──────────────────────────────────────────────────────────
    // 9. Subtle Parallax on Hero Decorations
    // ──────────────────────────────────────────────────────────
    const hero = document.querySelector('.hero');
    if (hero) {
        window.addEventListener('scroll', function () {
            const scrolled = window.scrollY;
            if (scrolled < window.innerHeight) {
                const heroImage = hero.querySelector('.hero-image');
                if (heroImage) {
                    heroImage.style.transform = `translateY(${scrolled * 0.06}px)`;
                }
            }
        }, { passive: true });
    }

    // ──────────────────────────────────────────────────────────
    // 10. Card Tilt Micro-interaction (Desktop only)
    // ──────────────────────────────────────────────────────────
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
        const cards = document.querySelectorAll('.card');
        cards.forEach(card => {
            card.addEventListener('mousemove', function (e) {
                const rect = card.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const centerX = rect.width / 2;
                const centerY = rect.height / 2;
                const rotateX = ((y - centerY) / centerY) * -3;
                const rotateY = ((x - centerX) / centerX) * 3;

                card.style.transform = `translateY(-6px) perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
            });

            card.addEventListener('mouseleave', function () {
                card.style.transform = '';
            });
        });
    }

});
