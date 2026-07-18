/* ==========================================================================
   Ray2Volt Solar - JavaScript (Enhanced)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', function () {
    // Dynamically set the _next form redirect URL to the thank-you page
    // (Removed as per request to stop redirecting to thank-you.html)
    // const nextUrlInputs = document.querySelectorAll('.next-url-input');
    // if (nextUrlInputs.length > 0) {
    //     const basePath = window.location.href.substring(0, window.location.href.lastIndexOf('/'));
    //     const thankYouUrl = basePath + '/thank-you.html';
    //     nextUrlInputs.forEach(input => {
    //         input.value = thankYouUrl;
    //     });
    // }

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

        // Close menu when clicking a link (except dropdown toggle)
        const navLinks = navMenu.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                if (link.parentElement.classList.contains('dropdown') && window.innerWidth <= 768) {
                    return; // Handled by dropdown logic
                }
                menuToggle.classList.remove('active');
                navMenu.classList.remove('active');
            });
        });

        // Dropdown toggle on mobile
        const dropdowns = document.querySelectorAll('.dropdown');
        dropdowns.forEach(dropdown => {
            const toggle = dropdown.querySelector('a');
            toggle.addEventListener('click', (e) => {
                if (window.innerWidth <= 768) {
                    e.preventDefault();
                    dropdown.classList.toggle('active');
                }
            });
        });
    }

    // ──────────────────────────────────────────────────────────
    // 2. Header reference (fixed bar, no scroll effects)
    // ──────────────────────────────────────────────────────────
    const header = document.querySelector('.header');

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

        return isValid;
    }

    if (contactForm) {
        contactForm.addEventListener('submit', function (e) {
            const isValid = validateForm([
                { element: document.getElementById('name'), validate: val => val.trim() !== '', errorMessage: 'Please enter your name' },
                { element: document.getElementById('phone'), validate: val => isValidPhone(val), errorMessage: 'Please enter a valid phone number' },
                { element: document.getElementById('message'), validate: val => val.trim() !== '', errorMessage: 'Please enter your message' }
            ], e);

            if (isValid) {
                submitLeadForm(e, contactForm);
            }
        });
    }

    if (quoteForm) {
        quoteForm.addEventListener('submit', function (e) {
            const isValid = validateForm([
                { element: document.getElementById('name'), validate: val => val.trim() !== '', errorMessage: 'Please enter your name' },
                { element: document.getElementById('phone'), validate: val => isValidPhone(val), errorMessage: 'Please enter a valid phone number' }
            ], e);

            if (isValid) {
                submitLeadForm(e, quoteForm);
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

    function submitLeadForm(e, form) {
        if (!form || !form.action.includes('web3forms.com')) return;

        e.preventDefault();

        const submitButton = form.querySelector('[type="submit"]');
        const originalButtonHtml = submitButton ? submitButton.innerHTML : '';

        setFormStatus(form, 'Submitting your details...', 'info');
        setSubmitting(submitButton, true, 'Submitting...');

        const formData = new FormData(form);
        formData.set('Page URL', window.location.href);
        const payload = Object.fromEntries(formData.entries());

        fetch('https://api.web3forms.com/submit', {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        })
            .then(response => response.json()
                .catch(() => ({ success: response.ok, message: response.statusText })))
            .then(data => {
                if (!data.success) {
                    throw new Error(data.message || 'Form submission was not accepted.');
                }

                const redirectInput = form.querySelector('input[name="redirect"]');
                window.location.href = redirectInput ? redirectInput.value : getThankYouUrl();
            })
            .catch(() => {
                setSubmitting(submitButton, false, originalButtonHtml);
                setFormStatus(
                    form,
                    'We could not submit this form right now. Please WhatsApp us at +91 9666068140, or email sales@ray2voltsolar.com directly.',
                    'error'
                );
            });
    }

    function getThankYouUrl() {
        const basePath = window.location.href.substring(0, window.location.href.lastIndexOf('/'));
        return basePath + '/thank-you.html';
    }

    function setSubmitting(button, isSubmitting, label) {
        if (!button) return;
        button.disabled = isSubmitting;
        button.setAttribute('aria-busy', isSubmitting ? 'true' : 'false');
        button.innerHTML = label;
    }

    function setFormStatus(form, message, type) {
        let status = form.querySelector('.form-submit-status');

        if (!status) {
            status = document.createElement('p');
            status.className = 'form-submit-status';
            status.setAttribute('role', 'status');
            status.style.marginTop = '1rem';
            status.style.fontSize = '0.9rem';
            status.style.textAlign = 'center';
            form.appendChild(status);
        }

        status.textContent = message;
        status.style.color = type === 'error' ? '#F44336' : '#10B981';
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
            const current = Math.round(eased * target);

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

    // ──────────────────────────────────────────────────────────
    // 11. WhatsApp Lead-Capture Modal
    // ──────────────────────────────────────────────────────────
    (function initWhatsAppModal() {
        const WA_PHONE = '919666068140';

        // ── Inject CSS ──
        const style = document.createElement('style');
        style.textContent = `
            /* Overlay */
            .wa-modal-overlay {
                position: fixed;
                inset: 0;
                background: rgba(0, 0, 0, 0.6);
                backdrop-filter: blur(6px);
                -webkit-backdrop-filter: blur(6px);
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 1rem;
                opacity: 0;
                visibility: hidden;
                transition: opacity 0.3s ease, visibility 0.3s ease;
            }
            .wa-modal-overlay.active {
                opacity: 1;
                visibility: visible;
            }

            /* Card */
            .wa-modal {
                background: rgba(15, 23, 42, 0.92);
                border: 1px solid rgba(56, 189, 248, 0.2);
                border-radius: 24px;
                padding: 2.5rem 2rem 2rem;
                width: 100%;
                max-width: 440px;
                position: relative;
                box-shadow: 0 25px 60px rgba(0, 0, 0, 0.5),
                            inset 0 1px 0 rgba(255, 255, 255, 0.08);
                backdrop-filter: blur(24px);
                -webkit-backdrop-filter: blur(24px);
                transform: translateY(30px) scale(0.95);
                transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
            }
            .wa-modal-overlay.active .wa-modal {
                transform: translateY(0) scale(1);
            }

            /* Close button */
            .wa-modal-close {
                position: absolute;
                top: 1rem;
                right: 1rem;
                width: 36px;
                height: 36px;
                border-radius: 50%;
                background: rgba(255, 255, 255, 0.06);
                border: 1px solid rgba(255, 255, 255, 0.1);
                color: rgba(255, 255, 255, 0.6);
                font-size: 1.25rem;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                transition: all 0.2s ease;
                line-height: 1;
            }
            .wa-modal-close:hover {
                background: rgba(255, 255, 255, 0.12);
                color: #fff;
            }

            /* Header */
            .wa-modal-header {
                text-align: center;
                margin-bottom: 1.75rem;
            }
            .wa-modal-header .wa-icon {
                width: 56px;
                height: 56px;
                border-radius: 16px;
                background: linear-gradient(135deg, #25D366 0%, #128C7E 100%);
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0 auto 1rem;
                box-shadow: 0 8px 24px rgba(37, 211, 102, 0.3);
            }
            .wa-modal-header .wa-icon svg {
                width: 28px;
                height: 28px;
                fill: #fff;
            }
            .wa-modal-header h3 {
                font-family: 'Google Sans Flex', sans-serif;
                font-size: 1.35rem;
                font-weight: 700;
                color: #fff;
                margin-bottom: 0.35rem;
                text-shadow: none;
            }
            .wa-modal-header p {
                font-size: 0.875rem;
                color: rgba(255, 255, 255, 0.55);
                margin: 0;
            }

            /* Form fields */
            .wa-modal-form {
                display: flex;
                flex-direction: column;
                gap: 1rem;
            }
            .wa-modal-field label {
                display: block;
                font-size: 0.8rem;
                font-weight: 600;
                color: rgba(255, 255, 255, 0.7);
                margin-bottom: 0.4rem;
                letter-spacing: 0.02em;
            }
            .wa-modal-field input,
            .wa-modal-field select {
                width: 100%;
                padding: 0.8rem 1rem;
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.12);
                border-radius: 12px;
                color: #fff;
                font-family: 'Assistant', sans-serif;
                font-size: 0.95rem;
                transition: all 0.25s ease;
                outline: none;
            }
            .wa-modal-field input::placeholder {
                color: rgba(255, 255, 255, 0.3);
            }
            .wa-modal-field input:focus,
            .wa-modal-field select:focus {
                border-color: #25D366;
                background: rgba(255, 255, 255, 0.08);
                box-shadow: 0 0 0 3px rgba(37, 211, 102, 0.15);
            }
            .wa-modal-field select option {
                background: #0f172a;
                color: #fff;
            }
            .wa-modal-field.wa-error input,
            .wa-modal-field.wa-error select {
                border-color: #F44336;
                box-shadow: 0 0 0 3px rgba(244, 67, 54, 0.12);
            }
            .wa-modal-field .wa-error-msg {
                font-size: 0.75rem;
                color: #F44336;
                margin-top: 0.3rem;
                display: none;
            }
            .wa-modal-field.wa-error .wa-error-msg {
                display: block;
            }

            /* Property type selector */
            .wa-type-row {
                display: flex;
                gap: 0.5rem;
            }
            .wa-type-option {
                flex: 1;
                position: relative;
                cursor: pointer;
            }
            .wa-type-option input {
                position: absolute;
                opacity: 0;
                height: 0;
                width: 0;
            }
            .wa-type-label {
                display: flex;
                justify-content: center;
                align-items: center;
                padding: 0.7rem 0.5rem;
                font-weight: 600;
                font-size: 0.875rem;
                color: rgba(255, 255, 255, 0.55);
                background: rgba(255, 255, 255, 0.04);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 10px;
                transition: all 0.25s ease;
                user-select: none;
                gap: 0.4rem;
            }
            .wa-type-option input:checked + .wa-type-label {
                background: linear-gradient(135deg, #25D366 0%, #128C7E 100%);
                color: #fff;
                border-color: transparent;
                box-shadow: 0 4px 12px rgba(37, 211, 102, 0.3);
            }

            /* Submit */
            .wa-modal-submit {
                width: 100%;
                padding: 0.9rem;
                font-family: 'Google Sans Flex', sans-serif;
                font-size: 1rem;
                font-weight: 700;
                color: #fff;
                background: linear-gradient(135deg, #25D366 0%, #128C7E 100%);
                border: none;
                border-radius: 12px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 0.6rem;
                transition: all 0.25s ease;
                box-shadow: 0 4px 20px rgba(37, 211, 102, 0.3);
                margin-top: 0.25rem;
            }
            .wa-modal-submit:hover {
                transform: translateY(-2px);
                box-shadow: 0 8px 30px rgba(37, 211, 102, 0.45);
            }
            .wa-modal-submit svg {
                width: 20px;
                height: 20px;
                fill: #fff;
            }

            /* Responsive */
            @media (max-width: 480px) {
                .wa-modal {
                    padding: 2rem 1.25rem 1.5rem;
                    border-radius: 20px;
                }
                .wa-modal-header h3 { font-size: 1.15rem; }
            }
        `;
        document.head.appendChild(style);

        // ── Inject Modal HTML ──
        const overlay = document.createElement('div');
        overlay.className = 'wa-modal-overlay';
        overlay.id = 'wa-modal-overlay';
        overlay.innerHTML = `
            <div class="wa-modal">
                <button class="wa-modal-close" id="wa-modal-close" aria-label="Close">&times;</button>

                <div class="wa-modal-header">
                    <div class="wa-icon">
                        <svg viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    </div>
                    <h3>Chat with us on WhatsApp</h3>
                    <p>Fill in your details so we can help you better</p>
                </div>

                <form class="wa-modal-form" id="wa-modal-form" novalidate>
                    <div class="wa-modal-field" id="wa-field-name">
                        <label for="wa-name">Full Name *</label>
                        <input type="text" id="wa-name" placeholder="Enter your full name" autocomplete="name" />
                        <div class="wa-error-msg">Please enter your name</div>
                    </div>

                    <div class="wa-modal-field" id="wa-field-type">
                        <label>Property Type *</label>
                        <div class="wa-type-row">
                            <label class="wa-type-option">
                                <input type="radio" name="wa-property" value="Residential" checked />
                                <span class="wa-type-label">🏠 Residential</span>
                            </label>
                            <label class="wa-type-option">
                                <input type="radio" name="wa-property" value="Commercial" />
                                <span class="wa-type-label">🏢 Commercial</span>
                            </label>
                        </div>
                    </div>

                    <div class="wa-modal-field" id="wa-field-bill">
                        <label for="wa-bill">Monthly Electricity Bill *</label>
                        <select id="wa-bill">
                            <option value="" disabled selected>Select bill range</option>
                            <option value="Below ₹1,000">Below ₹1,000</option>
                            <option value="₹1,000 - ₹2,000">₹1,000 - ₹2,000</option>
                            <option value="₹2,000 - ₹4,000">₹2,000 - ₹4,000</option>
                            <option value="₹4,000 - ₹6,000">₹4,000 - ₹6,000</option>
                            <option value="₹6,000 - ₹10,000">₹6,000 - ₹10,000</option>
                            <option value="₹10,000 - ₹20,000">₹10,000 - ₹20,000</option>
                            <option value="Above ₹20,000">Above ₹20,000</option>
                        </select>
                        <div class="wa-error-msg">Please select your bill range</div>
                    </div>

                    <div class="wa-modal-field" id="wa-field-location">
                        <label for="wa-location">Location / City *</label>
                        <input type="text" id="wa-location" placeholder="e.g. Tirupati" autocomplete="address-level2" />
                        <div class="wa-error-msg">Please enter your location</div>
                    </div>

                    <button type="submit" class="wa-modal-submit">
                        <svg viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                        Send via WhatsApp
                    </button>
                </form>
            </div>
        `;
        document.body.appendChild(overlay);

        // ── Helpers ──
        const modalOverlay = document.getElementById('wa-modal-overlay');
        const modalClose   = document.getElementById('wa-modal-close');
        const modalForm    = document.getElementById('wa-modal-form');

        function openModal() {
            modalOverlay.classList.add('active');
            document.body.style.overflow = 'hidden';
            // Focus the first input after animation
            setTimeout(() => { document.getElementById('wa-name').focus(); }, 350);
        }

        function closeModal() {
            modalOverlay.classList.remove('active');
            document.body.style.overflow = '';
        }

        function resetForm() {
            modalForm.reset();
            modalForm.querySelectorAll('.wa-modal-field').forEach(f => f.classList.remove('wa-error'));
        }

        // ── Close triggers ──
        modalClose.addEventListener('click', () => { closeModal(); resetForm(); });
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) { closeModal(); resetForm(); }
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modalOverlay.classList.contains('active')) {
                closeModal(); resetForm();
            }
        });

        // ── Intercept ALL wa.me links ──
        document.addEventListener('click', function (e) {
            const link = e.target.closest('a[href*="wa.me"]');
            if (!link) return;
            e.preventDefault();
            resetForm();
            openModal();
        });

        // ── Form submit → build WhatsApp message ──
        modalForm.addEventListener('submit', function (e) {
            e.preventDefault();

            const nameEl     = document.getElementById('wa-name');
            const billEl     = document.getElementById('wa-bill');
            const locationEl = document.getElementById('wa-location');
            const typeEl     = document.querySelector('input[name="wa-property"]:checked');

            let valid = true;

            // Validate name
            if (!nameEl.value.trim()) {
                document.getElementById('wa-field-name').classList.add('wa-error');
                valid = false;
            } else {
                document.getElementById('wa-field-name').classList.remove('wa-error');
            }

            // Validate bill
            if (!billEl.value) {
                document.getElementById('wa-field-bill').classList.add('wa-error');
                valid = false;
            } else {
                document.getElementById('wa-field-bill').classList.remove('wa-error');
            }

            // Validate location
            if (!locationEl.value.trim()) {
                document.getElementById('wa-field-location').classList.add('wa-error');
                valid = false;
            } else {
                document.getElementById('wa-field-location').classList.remove('wa-error');
            }

            if (!valid) return;

            // Build message
            const name     = nameEl.value.trim();
            const type     = typeEl ? typeEl.value : 'Residential';
            const bill     = billEl.value;
            const location = locationEl.value.trim();

            const message = `Hi Ray2Volt,

I'm interested in solar installation. Here are my details:

👤 *Name:* ${name}
🏠 *Property Type:* ${type}
💡 *Monthly Bill:* ${bill}
📍 *Location:* ${location}

Please share more information. Thank you!`;

            const waUrl = `https://wa.me/${WA_PHONE}?text=${encodeURIComponent(message)}`;

            closeModal();
            resetForm();

            // Open WhatsApp
            window.open(waUrl, '_blank');
        });

        // Live clear errors on input
        document.getElementById('wa-name').addEventListener('input', function () {
            if (this.value.trim()) document.getElementById('wa-field-name').classList.remove('wa-error');
        });
        document.getElementById('wa-bill').addEventListener('change', function () {
            if (this.value) document.getElementById('wa-field-bill').classList.remove('wa-error');
        });
        document.getElementById('wa-location').addEventListener('input', function () {
            if (this.value.trim()) document.getElementById('wa-field-location').classList.remove('wa-error');
        });
    })();

});
