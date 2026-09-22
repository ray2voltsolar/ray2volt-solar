/* ==========================================================================
   Ray2Volt Solar - JavaScript (Enhanced)
   ========================================================================== */

// Decorative solar field. Independent of navigation, forms, and tracking.
document.addEventListener('DOMContentLoaded', function initEnergyField() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.className = 'energy-field';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.prepend(canvas);

    const toggle = document.createElement('button');
    toggle.className = 'energy-motion-toggle';
    toggle.type = 'button';
    document.body.append(toggle);

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    let width = 0;
    let height = 0;
    let columns = 22;
    let rows = 18;
    let frame = 0;
    let lastTime = 0;
    let elapsed = 0;
    let paused = false;
    const pointer = { x: 0, y: 0, targetX: 0, targetY: 0, strength: 0, active: false };
    const isStill = () => paused || reducedMotion.matches;

    function point(column, depth, time) {
        const spread = 0.12 + depth * 1.5;
        let x = width * 0.5 + (column / columns - 0.5) * width * spread;
        let y = height * (0.07 + depth * depth * 1.12);
        // Low-amplitude waves keep the field quiet behind the content.
        y += Math.sin(column * 0.36 + depth * 6 - time * 0.38) * 6 * depth;
        y += Math.cos(column * 0.18 - depth * 8 + time * 0.24) * 4 * depth;
        x += Math.sin(depth * 5 + time * 0.2) * 4 * depth;
        const dx = x - pointer.x;
        const dy = y - pointer.y;
        const influence = Math.exp(-(dx * dx + dy * dy) / 65000) * pointer.strength;
        y -= influence * 4;
        x += dx * influence * 0.006;
        return { x, y };
    }

    function draw() {
        // Run ambient movement at 12% of the original speed.
        const time = elapsed / 1000 * 0.12;
        ctx.clearRect(0, 0, width, height);

        // A restrained pool of sunlight moves over the cool blue field.
        const sunX = width * (0.76 + Math.sin(time * 0.12) * 0.07);
        const sunY = height * 0.36;
        const sunlight = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, width * 0.48);
        sunlight.addColorStop(0, 'rgba(255,179,0,0.055)');
        sunlight.addColorStop(1, 'rgba(255,179,0,0)');
        ctx.fillStyle = sunlight;
        ctx.fillRect(0, 0, width, height);

        if (pointer.strength > 0.01) {
            const glow = ctx.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, 260);
            glow.addColorStop(0, `rgba(56,189,248,${0.045 * pointer.strength})`);
            glow.addColorStop(1, 'rgba(56,189,248,0)');
            ctx.fillStyle = glow;
            ctx.fillRect(0, 0, width, height);
        }

        ctx.lineWidth = 0.8;
        for (let column = 0; column <= columns; column++) {
            const edgeFade = Math.sin(Math.PI * column / columns);
            ctx.strokeStyle = `rgba(56,189,248,${0.045 + edgeFade * 0.095})`;
            ctx.beginPath();
            for (let row = 0; row <= rows; row++) {
                const p = point(column, row / rows, time);
                if (row === 0) ctx.moveTo(p.x, p.y);
                else ctx.lineTo(p.x, p.y);
            }
            ctx.stroke();
        }

        const drift = (time * 0.035) % (1 / rows);
        for (let row = 0; row <= rows; row++) {
            const depth = row / rows + drift;
            ctx.strokeStyle = `rgba(56,189,248,${0.025 + Math.sin(Math.min(depth, 1) * Math.PI) * 0.12})`;
            ctx.beginPath();
            for (let column = 0; column <= columns; column++) {
                const p = point(column, depth, time);
                if (column === 0) ctx.moveTo(p.x, p.y);
                else ctx.lineTo(p.x, p.y);
            }
            ctx.stroke();
        }

    }

    function animate(now) {
        frame = 0;
        if (document.hidden || isStill()) return;
        if (!lastTime) lastTime = now;
        const delta = now - lastTime;
        if (delta >= 1000 / 30) {
            elapsed += Math.min(delta, 70);
            lastTime = now;
            pointer.x += (pointer.targetX - pointer.x) * 0.05;
            pointer.y += (pointer.targetY - pointer.y) * 0.05;
            pointer.strength += ((pointer.active ? 1 : 0) - pointer.strength) * 0.04;
            draw();
        }
        frame = requestAnimationFrame(animate);
    }

    function syncMotion() {
        cancelAnimationFrame(frame);
        frame = 0;
        lastTime = 0;
        document.body.classList.toggle('energy-field-paused', isStill());
        const label = paused ? 'Resume background animation' : 'Pause background animation';
        toggle.setAttribute('aria-label', label);
        toggle.title = label;
        toggle.innerHTML = paused
            ? '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2l10 6-10 6z"/></svg>'
            : '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2h3v12H4zm5 0h3v12H9z"/></svg>';
        if (isStill()) {
            pointer.strength = 0;
            draw();
        } else if (!document.hidden) {
            frame = requestAnimationFrame(animate);
        }
    }

    function resize() {
        width = window.innerWidth;
        height = window.innerHeight;
        columns = width < 700 ? 12 : 22;
        rows = width < 700 ? 12 : 18;
        const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        draw();
    }

    window.addEventListener('pointermove', event => {
        if (!finePointer.matches || isStill() || event.pointerType === 'touch') return;
        pointer.targetX = event.clientX;
        pointer.targetY = event.clientY;
        pointer.active = true;
    }, { passive: true });
    document.documentElement.addEventListener('pointerleave', () => { pointer.active = false; });
    window.addEventListener('blur', () => { pointer.active = false; });
    window.addEventListener('resize', resize, { passive: true });
    document.addEventListener('visibilitychange', syncMotion);
    reducedMotion.addEventListener('change', syncMotion);
    toggle.addEventListener('click', () => {
        paused = !paused;
        syncMotion();
    });

    resize();
    document.body.classList.add('energy-field-ready');
    syncMotion();
});

// ──────────────────────────────────────────────────────────
// 0. Campaign Parameter Capture & Forwarding
//    Paid C&I traffic lands on commercial.html, but the qualification
//    form lives on commercial-solar-estimate.html. Hold the ad parameters
//    for the session and re-attach them to every link into that form so
//    lead source survives the hop. Runs before DOMContentLoaded so pages
//    reading window.ray2voltCampaign inline always see it.
// ──────────────────────────────────────────────────────────
(function () {
    const CAMPAIGN_KEYS = [
        'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
        'gclid', 'gbraid', 'wbraid'
    ];
    const PARAMS_KEY = 'r2vCampaignParams';
    const LANDING_KEY = 'r2vLandingPage';
    const FORM_PATH = 'commercial-solar-estimate.html';

    const readStore = function (key) {
        try {
            return sessionStorage.getItem(key);
        } catch (error) {
            return null; // Private browsing or storage disabled.
        }
    };

    const writeStore = function (key, value) {
        try {
            sessionStorage.setItem(key, value);
        } catch (error) {
            // Tracking is best-effort; the pages stay fully usable without it.
        }
    };

    const urlParams = new URLSearchParams(window.location.search);
    const arriving = {};
    CAMPAIGN_KEYS.forEach(key => {
        const value = urlParams.get(key);
        if (value) arriving[key] = value;
    });

    // A fresh ad click always wins; otherwise reuse what this session arrived with.
    const held = readStore(PARAMS_KEY);
    let campaign = {};
    if (Object.keys(arriving).length > 0) {
        campaign = arriving;
        const incoming = JSON.stringify(campaign);
        // An identical set means this is our own rewrite carrying the parameters
        // across the commercial.html -> form hop, not a new click, so the landing
        // page on record must stay the page the ad click actually hit.
        if (incoming !== held) {
            writeStore(PARAMS_KEY, incoming);
            writeStore(LANDING_KEY, window.location.href);
        }
    } else {
        try {
            campaign = JSON.parse(held || '{}');
        } catch (error) {
            campaign = {};
        }
    }
    if (!readStore(LANDING_KEY)) writeStore(LANDING_KEY, window.location.href);

    window.ray2voltCampaign = {
        params: campaign,
        landingPage: readStore(LANDING_KEY) || window.location.href
    };

    if (Object.keys(campaign).length === 0) return;

    document.addEventListener('DOMContentLoaded', function () {
        document.querySelectorAll(`a[href*="${FORM_PATH}"]`).forEach(link => {
            const target = new URL(link.getAttribute('href'), window.location.href);
            if (target.origin !== window.location.origin) return;
            Object.entries(campaign).forEach(([key, value]) => {
                if (!target.searchParams.has(key)) target.searchParams.set(key, value);
            });
            link.href = target.href;
        });
    });
})();

// ──────────────────────────────────────────────────────────
// 0b. Tracking config and events (C1)
//     Every ID and label that the site's own scripts send is in CONFIG.
//     The gtag snippet in each page's <head> loads the same Ads and GA4 tags.
//
//     - The Google Ads lead conversion fires only on the two campaign
//       thank-you pages, and only for a form submitted in this session
//       within the last 30 minutes, once per lead (transaction_id = lead ID).
//       Direct visits and refreshes count nothing.
//     - Secondary GA4 events: click_to_call, whatsapp_click, form_start
//       (first interaction with each form) and generate_lead (with form_id).
//     - Newer forms never redirect to the campaign thank-you pages. They send
//       an Ads conversion only once their label below is filled in.
// ──────────────────────────────────────────────────────────
(function () {
    const CONFIG = {
        adsId: 'AW-18014889887',
        // Existing "Website Lead" conversion. Keep exactly as it is.
        leadConversion: 'AW-18014889887/9NtXCImroaYcEJ_PlY5D',
        // The WhatsApp pop-up has always reported to the same label.
        whatsappLeadConversion: 'AW-18014889887/9NtXCImroaYcEJ_PlY5D',
        // GA4 property installed on every page (T1). '' switches the GA4 events off.
        ga4Id: 'G-WZJ1CXHSG9',
        // Google Ads labels for the newer forms. Empty on purpose: nothing goes to
        // Google Ads for a form until its label is filled in, in the form
        // 'AW-18014889887/AbCdEfGhIjKlMnOp'.
        formConversions: {
            'business-proposal': '',
            'bill-upload': '',
            'power-audit': '',
            'tender-rfq': '',
            'quote-check': '',
            'service-request': '',
            // A partner sign-up, not a customer lead: keep it out of Google Ads.
            'channel-partner': ''
        },
        // Forms whose success page is a campaign thank-you page.
        confirmationForms: {
            'thank-you': ['quote-form', 'contact-form'],
            'commercial-solar-thank-you': ['ci-estimate-form']
        },
        leadTokenMaxAgeMs: 30 * 60 * 1000
    };

    const TOKEN_KEY = 'r2vLeadToken';
    const FIRED_KEY = 'r2vFiredLeadIds';

    function hasGtag() {
        return typeof window.gtag === 'function';
    }

    function newId(prefix) {
        if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
        return `${prefix || 'lead'}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    }

    // Test hook: with sessionStorage r2vDryRun = '1', tracking calls are
    // recorded in window.r2vDryRunLog instead of being sent to Google.
    function dryRunLogged(kind, detail) {
        let dryRun = false;
        try {
            dryRun = sessionStorage.getItem('r2vDryRun') === '1';
        } catch (error) {
            dryRun = false;
        }
        if (!dryRun) return false;
        (window.r2vDryRunLog = window.r2vDryRunLog || []).push([kind, detail]);
        console.info('[r2v dry run] ' + kind, detail);
        return true;
    }

    // GA4 only: secondary events must never reach Google Ads as conversions.
    function sendEvent(name, params) {
        if (!CONFIG.ga4Id) return;
        if (dryRunLogged('event', Object.assign({ name: name }, params || {}))) return;
        if (!hasGtag()) return;
        try {
            window.gtag('event', name, Object.assign({ send_to: CONFIG.ga4Id }, params || {}));
        } catch (error) {
            // Tracking must never break the page.
        }
    }

    function sendConversion(sendTo, transactionId) {
        if (!sendTo) return;
        if (dryRunLogged('conversion', { send_to: sendTo, transaction_id: transactionId })) return;
        if (!hasGtag()) return;
        try {
            window.gtag('event', 'conversion', { send_to: sendTo, transaction_id: transactionId });
        } catch (error) {
            // Tracking must never break the page.
        }
    }

    function formIdOf(form) {
        return form.getAttribute('data-form-id') || form.id || form.getAttribute('name') || 'form';
    }

    // Called just before a form hands over to a campaign thank-you page.
    function markLeadSubmitted(formId, leadId) {
        const token = { id: leadId || newId(formId), form: formId, time: Date.now() };
        try {
            sessionStorage.setItem(TOKEN_KEY, JSON.stringify(token));
        } catch (error) {
            // Without storage the thank-you page simply counts nothing.
        }
        return token.id;
    }

    function readFired() {
        try {
            const list = JSON.parse(localStorage.getItem(FIRED_KEY) || '[]');
            return Array.isArray(list) ? list : [];
        } catch (error) {
            return [];
        }
    }

    // Returns the token once if it is recent, unused and from an allowed form.
    function consumeLeadToken(allowedForms) {
        let token = null;
        try {
            token = JSON.parse(sessionStorage.getItem(TOKEN_KEY) || 'null');
        } catch (error) {
            return null;
        }
        if (!token || !token.id || !token.form || typeof token.time !== 'number') return null;
        const age = Date.now() - token.time;
        if (age < 0 || age > CONFIG.leadTokenMaxAgeMs) return null;
        if (allowedForms.indexOf(token.form) === -1) return null;
        const fired = readFired();
        if (fired.indexOf(token.id) !== -1) return null;
        try {
            fired.push(token.id);
            localStorage.setItem(FIRED_KEY, JSON.stringify(fired.slice(-50)));
            sessionStorage.removeItem(TOKEN_KEY);
        } catch (error) {
            // If the fired list cannot be saved, do not risk counting twice.
            return null;
        }
        return token;
    }

    function fireLeadConversion(allowedForms) {
        const token = consumeLeadToken(allowedForms);
        if (!token) return false;
        sendConversion(CONFIG.leadConversion, token.id);
        sendEvent('generate_lead', { form_id: token.form, transaction_id: token.id });
        return true;
    }

    // A newer form succeeded on its own page (no redirect).
    function reportLead(formId) {
        const leadId = newId(formId);
        sendEvent('generate_lead', { form_id: formId, transaction_id: leadId });
        sendConversion(CONFIG.formConversions[formId] || '', leadId);
        return leadId;
    }

    window.ray2voltTracking = {
        config: CONFIG,
        sendEvent: sendEvent,
        sendConversion: sendConversion,
        markLeadSubmitted: markLeadSubmitted,
        fireLeadConversion: fireLeadConversion,
        reportLead: reportLead,
        formIdOf: formIdOf,
        newId: newId
    };

    document.addEventListener('DOMContentLoaded', function () {
        // Campaign thank-you pages declare themselves on <body>.
        const confirmation = document.body.getAttribute('data-lead-confirmation');
        if (confirmation && CONFIG.confirmationForms[confirmation]) {
            fireLeadConversion(CONFIG.confirmationForms[confirmation]);
        }

        // click_to_call and whatsapp_click. Links that open the WhatsApp pop-up
        // are counted when the pop-up hands over to WhatsApp, not on this click.
        document.addEventListener('click', function (e) {
            const link = e.target.closest && e.target.closest('a[href]');
            if (!link) return;
            const href = link.getAttribute('href') || '';
            if (/^tel:/i.test(href)) {
                sendEvent('click_to_call', { link_url: href, link_text: (link.textContent || '').trim().slice(0, 100) });
            } else if (/wa\.me\/|api\.whatsapp\.com/i.test(href) && link.hasAttribute('data-wa-direct')) {
                sendEvent('whatsapp_click', { method: 'direct_link', link_id: link.getAttribute('data-wa-direct') || '' });
            }
        }, true);

        // form_start: the first interaction with each form on this page view.
        const started = new Set();
        const onFirstInteraction = function (e) {
            const field = e.target;
            if (!field || !field.form || field.name === 'botcheck') return;
            const formId = formIdOf(field.form);
            if (started.has(field.form)) return;
            started.add(field.form);
            sendEvent('form_start', { form_id: formId });
        };
        ['focusin', 'input', 'change'].forEach(type => document.addEventListener(type, onFirstInteraction, true));
    });
})();

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
        const setMenuState = function (isOpen) {
            menuToggle.classList.toggle('active', isOpen);
            navMenu.classList.toggle('active', isOpen);
            menuToggle.setAttribute('aria-expanded', String(isOpen));
        };

        setMenuState(false);
        menuToggle.addEventListener('click', function () {
            setMenuState(!navMenu.classList.contains('active'));
        });

        // Close menu when clicking a link (except dropdown toggle)
        const navLinks = navMenu.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                if (link.parentElement.classList.contains('dropdown') && window.innerWidth <= 768) {
                    return; // Handled by dropdown logic
                }
                setMenuState(false);
            });
        });

        // Dropdown toggle on mobile
        const dropdowns = document.querySelectorAll('.dropdown');
        dropdowns.forEach(dropdown => {
            const toggle = dropdown.querySelector('a');
            toggle.addEventListener('click', (e) => {
                if (window.innerWidth <= 768) {
                    e.preventDefault();
                    const isOpen = dropdown.classList.toggle('active');
                    toggle.setAttribute('aria-expanded', String(isOpen));
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

    // Guards shared by every Web3Forms form: the botcheck honeypot, a minimum
    // time on the page before submitting, and one submission in flight at a time.
    const FORM_MIN_MS = 4000;
    const pageStartedAt = Date.now();

    function passesSubmitGuards(form) {
        const honeypot = form.querySelector('input[name="botcheck"]');
        if (honeypot && honeypot.checked) {
            setFormStatus(form, 'We could not submit this form. Please call or WhatsApp us on +91 9666068140.', 'error');
            return false;
        }
        if (Date.now() - pageStartedAt < FORM_MIN_MS) {
            setFormStatus(form, 'Please review your details, then submit again.', 'error');
            return false;
        }
        if (form.dataset.r2vSubmitting === 'true') return false;
        return true;
    }

    // Campaign fields captured on arrival (section 0), added to the lead
    // payload unless the form already carries them as hidden inputs.
    function addCampaignFields(payload) {
        const campaign = window.ray2voltCampaign || { params: {}, landingPage: window.location.href };
        ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'gbraid', 'wbraid'].forEach(key => {
            if (!payload[key] && campaign.params && campaign.params[key]) payload[key] = campaign.params[key];
        });
        if (!payload['Landing Page URL']) payload['Landing Page URL'] = campaign.landingPage || window.location.href;
        payload['Page URL'] = window.location.href;
        return payload;
    }

    // Test hook: sessionStorage.setItem('r2vDryRun', '1') logs the payload
    // and reports success without sending anything to Web3Forms.
    function postToWeb3Forms(payload) {
        let dryRun = false;
        try {
            dryRun = sessionStorage.getItem('r2vDryRun') === '1';
        } catch (error) {
            dryRun = false;
        }
        if (dryRun) {
            console.info('[r2v dry run] Web3Forms payload', payload);
            return Promise.resolve({ success: true, dryRun: true });
        }
        return fetch('https://api.web3forms.com/submit', {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        })
            .then(response => response.json()
                .catch(() => ({ success: response.ok, message: response.statusText })));
    }

    function submitLeadForm(e, form) {
        if (!form || !form.action.includes('web3forms.com')) return;

        e.preventDefault();
        if (!passesSubmitGuards(form)) return;
        form.dataset.r2vSubmitting = 'true';

        const submitButton = form.querySelector('[type="submit"]');
        const originalButtonHtml = submitButton ? submitButton.innerHTML : '';

        setFormStatus(form, 'Submitting your details...', 'info');
        setSubmitting(submitButton, true, 'Submitting...');

        const formData = new FormData(form);
        const payload = addCampaignFields(Object.fromEntries(formData.entries()));

        postToWeb3Forms(payload)
            .then(data => {
                if (!data.success) {
                    throw new Error(data.message || 'Form submission was not accepted.');
                }

                // C1: the thank-you page counts this lead once, and only now.
                if (window.ray2voltTracking) {
                    window.ray2voltTracking.markLeadSubmitted(window.ray2voltTracking.formIdOf(form));
                }
                const redirectInput = form.querySelector('input[name="redirect"]');
                window.location.href = localRedirect(redirectInput ? redirectInput.value : getThankYouUrl());
            })
            .catch(() => {
                form.dataset.r2vSubmitting = 'false';
                setSubmitting(submitButton, false, originalButtonHtml);
                setFormStatus(
                    form,
                    'We could not submit this form right now. Please WhatsApp us at +91 9666068140, or email sales@ray2voltsolar.com directly.',
                    'error'
                );
            });
    }

    // The live redirect URLs are absolute. On a local preview, stay on the
    // preview's origin so the session's lead token is still readable.
    function localRedirect(url) {
        try {
            const target = new URL(url, window.location.href);
            if (target.hostname === 'ray2voltsolar.com' && window.location.hostname !== 'ray2voltsolar.com') {
                return window.location.origin + target.pathname + target.search + target.hash;
            }
            return target.href;
        } catch (error) {
            return url;
        }
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
    // 5b. Newer lead forms (homepage proposal, bill upload, power audit,
    //     tender/RFQ, quote check, service request)
    //     <form data-r2v-form="<form id>"> posts to Web3Forms with the same
    //     access key and guards, adds the campaign fields and form_id, shows
    //     its success panel on the page (never a campaign thank-you page)
    //     and reports generate_lead.
    // ──────────────────────────────────────────────────────────
    function fieldIsValid(field) {
        const value = (field.value || '').trim();
        if (field.type === 'checkbox') return !field.required || field.checked;
        if (field.type === 'radio') {
            return !field.required || !!(field.form && Array.from(field.form.elements)
                .some(other => other.type === 'radio' && other.name === field.name && other.checked));
        }
        if (field.required && !value) return false;
        if (!value) return true;
        if (field.type === 'tel') return isValidPhone(value);
        if (field.type === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
        if (field.type === 'date' && field.min && value < field.min) return false;
        return true;
    }

    function setFieldError(field, message) {
        const group = field.closest('.form-group');
        if (!group) return;
        let error = group.querySelector('.error-message');
        if (message) {
            if (!error) {
                error = document.createElement('span');
                error.className = 'error-message';
                error.id = `${field.id || field.name.replace(/\W+/g, '-')}-error`;
                group.appendChild(error);
            }
            error.textContent = message;
            field.setAttribute('aria-invalid', 'true');
            field.setAttribute('aria-describedby', [field.getAttribute('data-hint-id'), error.id].filter(Boolean).join(' '));
        } else {
            if (error) error.remove();
            field.removeAttribute('aria-invalid');
            if (field.getAttribute('data-hint-id')) field.setAttribute('aria-describedby', field.getAttribute('data-hint-id'));
            else field.removeAttribute('aria-describedby');
        }
    }

    document.querySelectorAll('form[data-r2v-form]').forEach(function (form) {
        const formId = form.getAttribute('data-r2v-form');
        const fields = Array.from(form.querySelectorAll('input, select, textarea'))
            .filter(field => field.type !== 'hidden' && field.name !== 'botcheck');

        // A date field that asks for a preferred day cannot be set in the past.
        form.querySelectorAll('input[type="date"][data-min-today]').forEach(field => {
            const today = new Date();
            today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
            field.min = today.toISOString().slice(0, 10);
        });

        fields.forEach(field => {
            const hint = field.getAttribute('aria-describedby');
            if (hint) field.setAttribute('data-hint-id', hint);
            field.addEventListener(field.tagName === 'SELECT' || field.type === 'checkbox' || field.type === 'date' ? 'change' : 'input', function () {
                if (field.getAttribute('aria-invalid') === 'true' && fieldIsValid(field)) setFieldError(field, '');
            });
        });

        form.addEventListener('submit', function (e) {
            e.preventDefault();

            let firstInvalid = null;
            fields.forEach(field => {
                if (fieldIsValid(field)) {
                    setFieldError(field, '');
                } else {
                    setFieldError(field, field.getAttribute('data-error') || 'Please check this field.');
                    if (!firstInvalid) firstInvalid = field;
                }
            });
            if (firstInvalid) {
                firstInvalid.focus();
                return;
            }
            if (!passesSubmitGuards(form)) return;
            form.dataset.r2vSubmitting = 'true';

            const submitButton = form.querySelector('[type="submit"]');
            const originalButtonHtml = submitButton ? submitButton.innerHTML : '';
            setSubmitting(submitButton, true, 'Sending...');
            setFormStatus(form, 'Sending your details...', 'info');

            const payload = addCampaignFields(Object.fromEntries(new FormData(form).entries()));
            payload.form_id = formId;

            postToWeb3Forms(payload)
                .then(data => {
                    if (!data.success) throw new Error(data.message || 'Form submission was not accepted.');
                    if (window.ray2voltTracking) window.ray2voltTracking.reportLead(formId);
                    const success = document.querySelector(`[data-success-for="${formId}"]`);
                    if (success) {
                        form.hidden = true;
                        success.hidden = false;
                        success.focus();
                    } else {
                        setSubmitting(submitButton, true, 'Sent');
                        setFormStatus(form, 'Thank you. We have your details and will call you on the number you gave.', 'success');
                    }
                })
                .catch(() => {
                    form.dataset.r2vSubmitting = 'false';
                    setSubmitting(submitButton, false, originalButtonHtml);
                    setFormStatus(
                        form,
                        'We could not send this form right now. Please WhatsApp us at +91 9666068140, or email sales@ray2voltsolar.com.',
                        'error'
                    );
                });
        });
    });

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
    // The counter always ends on the exact published text, so approved wording
    // such as "1,000+" keeps its comma (D3). Intermediate frames use the same
    // Indian digit grouping when the original number was grouped.
    function animateCounter(el, target, suffix = '', grouped = false, finalText = '') {
        const duration = 2000;
        const startTime = performance.now();

        function update(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Ease out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = Math.round(eased * target);

            el.textContent = (grouped ? current.toLocaleString('en-IN') : String(current)) + suffix;

            if (progress < 1) {
                requestAnimationFrame(update);
            } else if (finalText) {
                el.textContent = finalText;
            }
        }

        requestAnimationFrame(update);
    }

    const heroStats = document.querySelectorAll('.hero-stat h3');
    const reduceCounterMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (heroStats.length > 0 && 'IntersectionObserver' in window && !reduceCounterMotion) {
        const statsObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const el = entry.target;
                    const text = el.textContent.trim();

                    // Parse the number and suffix from text like "1,000+", "5 MW+", "100%".
                    // The separator between them is kept, so "5 MW+" stays "5 MW+".
                    const match = text.match(/^([\d,]+)(\s*)(.*)$/);
                    if (match) {
                        const num = parseInt(match[1].replace(/,/g, ''), 10);
                        const suffix = match[2] + (match[3] || '');
                        animateCounter(el, num, suffix, match[1].indexOf(',') !== -1, text);
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
    // 7b. Scheme end-date line (B19): days-left counter, removed
    //     once the date has passed (end of that day, IST)
    // ──────────────────────────────────────────────────────────
    document.querySelectorAll('[data-deadline]').forEach(line => {
        const end = new Date(line.getAttribute('data-deadline') + 'T23:59:59+05:30');
        if (isNaN(end)) return;
        const daysLeft = Math.ceil((end - Date.now()) / 86400000);
        if (daysLeft <= 0) {
            line.remove();
            return;
        }
        const counter = line.querySelector('[data-days-left]');
        if (counter) {
            counter.innerHTML = `<strong>${daysLeft}</strong> ${daysLeft === 1 ? 'day' : 'days'} left`;
            counter.hidden = false;
        }
    });

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
            // Cards that hold a form stay perfectly still - a shell that lifts and
            // tilts under the pointer makes the fields inside it hard to aim at.
            if (card.querySelector('form') || card.closest('form')) return;

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

            const resetTilt = function () {
                card.style.transform = '';
            };

            card.addEventListener('mouseleave', resetTilt);
            // A right-click opens the context menu without firing mouseleave,
            // which would otherwise leave the card frozen mid-tilt.
            card.addEventListener('contextmenu', resetTilt);
        });
    }

    // ──────────────────────────────────────────────────────────
    // 11. WhatsApp Lead-Capture Modal
    // ──────────────────────────────────────────────────────────
    (function initWhatsAppModal() {
        const WA_PHONE = '919666068140';
        // Google Ads conversion for WhatsApp enquiries, from the tracking config
        // (section 0b). Swap it for a dedicated 'WhatsApp Lead' label when one is
        // created in Google Ads, so it can be valued separately from form leads.
        const tracking = window.ray2voltTracking;
        const WA_CONVERSION_SEND_TO = tracking ? tracking.config.whatsappLeadConversion : '';

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
            /* The options are <label>s too, so the .wa-modal-field label rule
               above hands them a bottom margin that reads as dead space.
               Needs the parent class to outweigh that rule's specificity. */
            .wa-modal-field .wa-type-option {
                margin-bottom: 0;
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
                box-shadow: 0 8px 30px rgba(37, 211, 102, 0.45);
            }
            .wa-modal-submit svg {
                width: 20px;
                height: 20px;
                fill: #fff;
            }

            /* Step machinery */
            .wa-step {
                display: flex;
                flex-direction: column;
                gap: 1rem;
            }
            .wa-step[hidden] {
                display: none;
            }
            .wa-progress {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 0.5rem;
                margin-bottom: 1.25rem;
                padding-bottom: 1.1rem;
                border-bottom: 1px solid rgba(255, 255, 255, 0.08);
                counter-reset: wa-step;
                list-style: none;
                padding-left: 0;
            }
            .wa-progress li {
                position: relative;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 0.4rem;
                counter-increment: wa-step;
                font-size: 0.7rem;
                font-weight: 600;
                letter-spacing: 0.02em;
                text-align: center;
                color: rgba(255, 255, 255, 0.45);
                transition: color 0.25s ease;
            }
            .wa-progress li::before {
                content: counter(wa-step);
                position: relative;
                z-index: 1;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 1.75rem;
                height: 1.75rem;
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 50%;
                background: #0f172a;
                font-size: 0.78rem;
                font-weight: 700;
                transition: all 0.25s ease;
            }
            .wa-progress li::after {
                content: '';
                position: absolute;
                top: 0.8125rem;
                right: 50%;
                width: 100%;
                height: 2px;
                background: rgba(255, 255, 255, 0.12);
            }
            .wa-progress li:first-child::after {
                display: none;
            }
            .wa-progress li.is-active,
            .wa-progress li.is-complete {
                color: #fff;
            }
            .wa-progress li.is-active::before,
            .wa-progress li.is-complete::before {
                color: #06301c;
                background: #25D366;
                border-color: #25D366;
                box-shadow: 0 0 0 4px rgba(37, 211, 102, 0.16);
            }
            .wa-progress li.is-complete::before {
                content: "✓";
            }
            .wa-progress li.is-complete::after {
                background: #25D366;
            }

            /* Step navigation */
            .wa-modal-nav {
                display: flex;
                gap: 0.6rem;
                margin-top: 0.25rem;
            }
            .wa-modal-back {
                flex: 0 0 auto;
                padding: 0.9rem 1.1rem;
                font-family: 'Google Sans Flex', sans-serif;
                font-size: 0.95rem;
                font-weight: 600;
                color: rgba(255, 255, 255, 0.7);
                background: rgba(255, 255, 255, 0.06);
                border: 1px solid rgba(255, 255, 255, 0.12);
                border-radius: 12px;
                cursor: pointer;
                transition: all 0.25s ease;
            }
            .wa-modal-back:hover {
                color: #fff;
                background: rgba(255, 255, 255, 0.1);
            }
            .wa-modal-nav .wa-modal-submit {
                margin-top: 0;
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

                <ol class="wa-progress" id="wa-progress">
                    <li class="is-active">Your property</li>
                    <li>Your details</li>
                </ol>

                <form class="wa-modal-form" id="wa-modal-form" novalidate>
                    <!-- ── Step 1: property ── -->
                    <div class="wa-step" id="wa-step-1">
                        <div class="wa-modal-field" id="wa-field-type">
                            <label>Building Type *</label>
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
                            <label for="wa-bill">Approx. Monthly Electricity Bill *</label>
                            <select id="wa-bill">
                                <option value="" disabled selected>Select bill range</option>
                                <option value="Less than ₹500">Less than ₹500</option>
                                <option value="₹500 - ₹1,000">₹500 - ₹1,000</option>
                                <option value="₹1,000 - ₹2,000">₹1,000 - ₹2,000</option>
                                <option value="₹2,000 - ₹4,000">₹2,000 - ₹4,000</option>
                                <option value="₹4,000+">₹4,000+</option>
                            </select>
                            <div class="wa-error-msg">Please select your bill range</div>
                        </div>

                        <div class="wa-modal-field" id="wa-field-roof">
                            <label for="wa-roof">Available Roof Area (sq ft) *</label>
                            <input type="text" id="wa-roof" placeholder="e.g. 800" inputmode="numeric" />
                            <div class="wa-error-msg">Please enter your approximate roof area</div>
                        </div>

                        <button type="button" class="wa-modal-submit" id="wa-next">
                            Continue
                            <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                        </button>
                    </div>

                    <!-- ── Step 2: contact ── -->
                    <div class="wa-step" id="wa-step-2" hidden>
                        <div class="wa-modal-field" id="wa-field-name">
                            <label for="wa-name">Full Name *</label>
                            <input type="text" id="wa-name" placeholder="Enter your full name" autocomplete="name" />
                            <div class="wa-error-msg">Please enter your name</div>
                        </div>

                        <div class="wa-modal-field" id="wa-field-phone">
                            <label for="wa-phone">Phone Number *</label>
                            <input type="tel" id="wa-phone" placeholder="+91 90000 00000" autocomplete="tel" inputmode="tel" />
                            <div class="wa-error-msg">Please enter a valid phone number</div>
                        </div>

                        <div class="wa-modal-field" id="wa-field-location">
                            <label for="wa-location">Location / City *</label>
                            <input type="text" id="wa-location" placeholder="e.g. Tirupati" autocomplete="address-level2" />
                            <div class="wa-error-msg">Please enter your location</div>
                        </div>

                        <div class="wa-modal-field" id="wa-field-email">
                            <label for="wa-email">Email ID *</label>
                            <input type="email" id="wa-email" placeholder="you@example.com" autocomplete="email" inputmode="email" />
                            <div class="wa-error-msg">Please enter a valid email address</div>
                        </div>

                        <div class="wa-modal-nav">
                            <button type="button" class="wa-modal-back" id="wa-back">Back</button>
                            <button type="submit" class="wa-modal-submit">
                                <svg viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                                Send via WhatsApp
                            </button>
                        </div>
                    </div>
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
            // Focus the first field of the visible step after animation
            setTimeout(() => {
                const panel = modalOverlay.querySelector('.wa-step:not([hidden])');
                const field = panel && panel.querySelector('input:not([type="radio"]), select');
                if (field) field.focus();
            }, 350);
        }

        function closeModal() {
            modalOverlay.classList.remove('active');
            document.body.style.overflow = '';
        }

        function resetForm() {
            modalForm.reset();
            modalForm.querySelectorAll('.wa-modal-field').forEach(f => f.classList.remove('wa-error'));
            showStep(0);
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

        // ── Intercept wa.me links ──
        // Links marked data-wa-direct open WhatsApp with their own pre-filled
        // text (bill, quote and tender uploads), so the pop-up leaves them alone.
        document.addEventListener('click', function (e) {
            const link = e.target.closest('a[href*="wa.me"]');
            if (!link || link.hasAttribute('data-wa-direct')) return;
            e.preventDefault();
            resetForm();
            openModal();
        });

        // ── Step navigation ──
        const stepPanels  = [document.getElementById('wa-step-1'), document.getElementById('wa-step-2')];
        const progressLis = Array.from(document.getElementById('wa-progress').children);
        let currentStep = 0;

        function showStep(index) {
            currentStep = Math.max(0, Math.min(index, stepPanels.length - 1));
            stepPanels.forEach((panel, i) => { panel.hidden = i !== currentStep; });
            progressLis.forEach((li, i) => {
                li.classList.toggle('is-active', i === currentStep);
                li.classList.toggle('is-complete', i < currentStep);
            });
            const firstField = stepPanels[currentStep].querySelector('input:not([type="radio"]), select');
            if (firstField) setTimeout(() => firstField.focus(), 120);
        }

        function markError(fieldId, hasError) {
            document.getElementById(fieldId).classList.toggle('wa-error', hasError);
            return !hasError;
        }

        function validateStep1() {
            const bill = document.getElementById('wa-bill').value;
            const roof = document.getElementById('wa-roof').value.trim();
            let ok = markError('wa-field-bill', !bill);
            ok = markError('wa-field-roof', !roof) && ok;
            return ok;
        }

        function validateStep2() {
            const name     = document.getElementById('wa-name').value.trim();
            const phone    = document.getElementById('wa-phone').value.trim();
            const location = document.getElementById('wa-location').value.trim();
            const email    = document.getElementById('wa-email').value.trim();
            let ok = markError('wa-field-name', !name);
            ok = markError('wa-field-phone', !/^[\d\s\-\+\(\)]{10,}$/.test(phone)) && ok;
            ok = markError('wa-field-location', !location) && ok;
            ok = markError('wa-field-email', !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) && ok;
            return ok;
        }

        document.getElementById('wa-next').addEventListener('click', function () {
            if (validateStep1()) showStep(1);
        });

        document.getElementById('wa-back').addEventListener('click', function () {
            showStep(0);
        });

        // ── Form submit → report conversion, then build WhatsApp message ──
        modalForm.addEventListener('submit', function (e) {
            e.preventDefault();

            if (!validateStep1()) { showStep(0); return; }
            if (!validateStep2()) return;

            const typeEl   = document.querySelector('input[name="wa-property"]:checked');
            const type     = typeEl ? typeEl.value : 'Residential';
            const bill     = document.getElementById('wa-bill').value;
            const roof     = document.getElementById('wa-roof').value.trim();
            const name     = document.getElementById('wa-name').value.trim();
            const phone    = document.getElementById('wa-phone').value.trim();
            const location = document.getElementById('wa-location').value.trim();
            const email    = document.getElementById('wa-email').value.trim();

            // Google Ads conversion — one per enquiry, deduped by transaction_id —
            // plus the GA4 whatsapp_click event for the hand-over to WhatsApp.
            try {
                if (tracking) {
                    const transactionId = tracking.newId('wa');
                    tracking.sendConversion(WA_CONVERSION_SEND_TO, transactionId);
                    tracking.sendEvent('whatsapp_click', { method: 'lead_popup' });
                }
            } catch (error) {
                // Never let a tracking failure block the WhatsApp handoff.
            }

            const message = `Hi Ray2Volt,

I'd like to know more about going solar. Here are my details:

*MY PROPERTY*
🏠 *Building Type:* ${type}
💡 *Approx. Monthly Bill:* ${bill}
📐 *Available Roof Area:* ${roof} sq ft

*MY CONTACT DETAILS*
👤 *Name:* ${name}
📞 *Phone:* ${phone}
📍 *Location:* ${location}
✉️ *Email:* ${email}

Please share a system recommendation, the subsidy I qualify for, and an approximate cost and payback for my property.

Thank you!`;

            const waUrl = `https://wa.me/${WA_PHONE}?text=${encodeURIComponent(message)}`;

            closeModal();
            resetForm();

            // Open WhatsApp
            window.open(waUrl, '_blank');
        });

        // Live clear errors on input
        [
            ['wa-bill',     'wa-field-bill',     'change'],
            ['wa-roof',     'wa-field-roof',     'input'],
            ['wa-name',     'wa-field-name',     'input'],
            ['wa-phone',    'wa-field-phone',    'input'],
            ['wa-location', 'wa-field-location', 'input'],
            ['wa-email',    'wa-field-email',    'input']
        ].forEach(([inputId, fieldId, evt]) => {
            document.getElementById(inputId).addEventListener(evt, function () {
                if (this.value.trim()) document.getElementById(fieldId).classList.remove('wa-error');
            });
        });

        showStep(0);
    })();

});
