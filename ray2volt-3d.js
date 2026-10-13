/* Ray2Volt 3D page only (ray2volt-3d.html). Loaded after script.js, which
   already runs the menu, the theme switch, scroll-to-top, the scroll reveal
   and the lead tracking (window.ray2voltTracking). This file adds:
   1. In-page links that stop below the fixed header, and the "WhatsApp"
      links that lead to the form with Send on WhatsApp preselected
   2. The hero loop (poster first; no download on phones until the frame is
      on screen, none with reduced motion or Save-Data) and its pause button
   3. The enquiry form: one form, two send actions with the same checks.
      "Send enquiry" posts the lead to Web3Forms and shows the thank-you card.
      "Send on WhatsApp" posts the same lead, then opens WhatsApp with every
      field in the message. Each lead reports generate_lead once
      (form_id ray2volt-3d) and reaches the inbox once. */
(function () {
    'use strict';

    var WA_NUMBER = '919666068140';
    var EMAIL = 'sales@ray2voltsolar.com';
    var ENDPOINT = 'https://api.web3forms.com/submit';
    var FORM_ID = 'ray2volt-3d';

    var root = document.documentElement;
    var header = document.querySelector('.header');
    var motionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    var reduceMotion = function () { return !!(motionQuery && motionQuery.matches); };
    var isMobile = /Android|iPhone|iPad|iPod|Mobile|Opera Mini|IEMobile/i.test(navigator.userAgent || '') ||
        (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent || ''));
    var tracking = function () { return window.ray2voltTracking || null; };

    function waUrl(text) {
        return 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(text);
    }

    // In the same tab on phones (the app takes over), in a new tab on computers;
    // if a popup blocker stops the new tab, the same tab is used instead.
    function openWhatsApp(text) {
        var url = waUrl(text);
        if (isMobile) {
            window.location.assign(url);
            return;
        }
        var w = null;
        try { w = window.open(url, '_blank'); } catch (e) { w = null; }
        if (w) {
            try { w.opener = null; } catch (e) { /* already cross-origin */ }
        } else {
            window.location.assign(url);
        }
    }

    /* ---------- 1. In-page links ---------- */
    var formActions = document.getElementById('form-actions');
    var waHint = document.getElementById('wa-hint');
    var waLead = document.getElementById('wa-lead');
    var proposal = document.getElementById('proposal');

    // fromLink: the visitor used a WhatsApp link or #whatsapp and lands at the top of the form,
    // far above the send buttons, so a note under the form title says what to do
    function preferWhatsApp(fromLink) {
        if (formActions) formActions.classList.add('prefers-wa');
        if (waHint) waHint.hidden = false;
        if (fromLink && waLead) {
            waLead.hidden = false;
            if (proposal) proposal.classList.add('is-wa-lead');
        }
    }

    function headerOffset() {
        return (header ? header.getBoundingClientRect().bottom : 0) + 12;
    }

    function scrollToTarget(target, focusEl, behavior) {
        var top = target.getBoundingClientRect().top + window.pageYOffset - headerOffset();
        window.scrollTo({ top: Math.max(0, top), behavior: behavior || (reduceMotion() ? 'instant' : 'smooth') });
        var el = focusEl || target;
        if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
        try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
    }

    function formFocusTarget() {
        return document.getElementById('form-title') || document.getElementById('enquire');
    }

    // Capture phase, so this runs instead of script.js's generic smooth scroll for the links in <main>
    // (that one stops at the header's height and leaves the section title under the floating bar)
    document.addEventListener('click', function (e) {
        var link = e.target.closest ? e.target.closest('main a[href^="#"]') : null;
        if (!link) return;
        var id = link.getAttribute('href');
        if (id === '#' || id === '#main') return;
        var target = null;
        try { target = document.querySelector(id); } catch (err) { target = null; }
        if (!target) return;
        e.preventDefault();
        e.stopPropagation();
        if (link.hasAttribute('data-wa-pref')) preferWhatsApp(true);
        scrollToTarget(target, id === '#enquire' ? formFocusTarget() : null);
    }, true);

    // Direct links: #enquire, #whatsapp (the form with WhatsApp preselected) and any section id. The page is
    // placed again after the web fonts and the load event, never once the visitor has started scrolling.
    var visitorMoved = false;
    ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach(function (type) {
        window.addEventListener(type, function () { visitorMoved = true; }, { capture: true, passive: true });
    });
    function landOnHash(initial) {
        var hash = (window.location.hash || '').toLowerCase();
        if (!hash || hash === '#' || hash === '#main') return;
        var wa = hash === '#whatsapp' || hash === '#enquire-whatsapp';
        var id = wa ? '#enquire' : hash;
        var target = null;
        try { target = document.querySelector(id); } catch (e) { target = null; }
        if (!target) return;
        if (wa) preferWhatsApp(true);
        var focusEl = id === '#enquire' ? formFocusTarget() : null;
        if (!initial) {
            scrollToTarget(target, focusEl);
            return;
        }
        var place = function () { if (!visitorMoved) scrollToTarget(target, focusEl, 'instant'); };
        place();
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { setTimeout(place, 0); });
        if (document.readyState === 'complete') setTimeout(place, 50);
        else window.addEventListener('load', function () { setTimeout(place, 50); });
    }
    landOnHash(true);
    window.addEventListener('hashchange', function () { landOnHash(false); });

    /* ---------- 2. Hero loop and the motion pause ---------- */
    var heroVideo = document.querySelector('.home-hero__video[data-src]');
    var motionButton = document.querySelector('.hero-motion');
    var motionPaused = false;
    var tryPlay = function () {};

    if (heroVideo) {
        var conn = navigator.connection;
        var lowData = !!(conn && (conn.saveData || /(^|-)[23]g$/.test(conn.effectiveType || '')));
        var heroRatio = 'IntersectionObserver' in window ? 0 : 1;
        var heroOnScreen = !('IntersectionObserver' in window);

        tryPlay = function () {
            if (!heroVideo.src || !heroOnScreen || motionPaused || reduceMotion()) return;
            var p = heroVideo.play();
            if (p && p.catch) p.catch(function () { /* autoplay refused: the poster stays */ });
        };
        var stop = function () {
            heroVideo.pause();
            heroVideo.classList.remove('is-playing');
        };
        // The loop's first frame must never become a new, later Largest Contentful Paint: it starts only when
        // its visible area is smaller than the largest paint so far, or after the first real input.
        var lcpSize = 0, lcpOn = false, interacted = false;
        try {
            if (PerformanceObserver.supportedEntryTypes.indexOf('largest-contentful-paint') >= 0) {
                new PerformanceObserver(function (list) {
                    list.getEntries().forEach(function (entry) { if (entry.size > lcpSize) lcpSize = entry.size; });
                }).observe({ type: 'largest-contentful-paint', buffered: true });
                lcpOn = true;
            }
        } catch (e) { lcpOn = false; }
        var visibleArea = function () {
            var r = heroVideo.getBoundingClientRect();
            var w = Math.min(r.right, window.innerWidth) - Math.max(r.left, 0);
            var h = Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0);
            return w > 0 && h > 0 ? w * h : 0;
        };
        var start = function () {
            if (heroVideo.src || lowData || reduceMotion()) return;
            if (document.readyState !== 'complete' || heroRatio < 0.3) return; // after load, and only once in view
            if (lcpOn && !interacted && visibleArea() >= lcpSize) return;
            heroVideo.muted = true;
            heroVideo.src = heroVideo.getAttribute('data-src');
            tryPlay();
        };
        var onInput = function () {
            if (interacted) return;
            interacted = true;
            start();
        };
        ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(function (type) {
            window.addEventListener(type, onInput, { capture: true, passive: true });
        });
        var afterLoad = function () { setTimeout(start, 400); };

        heroVideo.addEventListener('playing', function () { heroVideo.classList.add('is-playing'); });
        if ('IntersectionObserver' in window) {
            new IntersectionObserver(function (entries) {
                var entry = entries[entries.length - 1];
                heroRatio = entry.intersectionRatio;
                heroOnScreen = entry.isIntersecting;
                if (heroRatio >= 0.3) start();
                if (heroOnScreen) tryPlay(); else if (heroVideo.src) heroVideo.pause();
            }, { threshold: [0, 0.3, 0.6, 1] }).observe(heroVideo);
        }
        if (motionQuery) {
            var onMotion = function () { if (motionQuery.matches) stop(); else if (heroVideo.src) tryPlay(); else start(); };
            if (motionQuery.addEventListener) motionQuery.addEventListener('change', onMotion);
            else if (motionQuery.addListener) motionQuery.addListener(onMotion);
        }
        if (document.readyState === 'complete') afterLoad();
        else window.addEventListener('load', afterLoad);
    }

    if (motionButton) {
        var syncMotionButton = function () { motionButton.hidden = reduceMotion(); };
        motionButton.addEventListener('click', function () {
            motionPaused = !motionPaused;
            root.classList.toggle('motion-paused', motionPaused);
            motionButton.setAttribute('aria-pressed', String(motionPaused));
            motionButton.setAttribute('aria-label', motionPaused ? 'Play animation' : 'Pause animation');
            motionButton.setAttribute('title', motionPaused ? 'Play animation' : 'Pause animation');
            if (heroVideo) { if (motionPaused) heroVideo.pause(); else tryPlay(); }
        });
        syncMotionButton();
        if (motionQuery) {
            if (motionQuery.addEventListener) motionQuery.addEventListener('change', syncMotionButton);
            else if (motionQuery.addListener) motionQuery.addListener(syncMotionButton);
        }
    }

    /* ---------- 3. Enquiry form ---------- */
    var form = document.getElementById('enquiry-form');
    var statusBox = document.getElementById('form-status');
    var successBox = document.getElementById('form-success');
    if (!form || !statusBox || !formActions) return;

    var MIN_FILL_MS = 2500; // from the first touch of the form, not from page load
    var emailButton = form.querySelector('[data-action="email"]');
    var waButton = form.querySelector('[data-action="whatsapp"]');
    var layoutSelect = form.elements.layout;
    var layoutHint = document.getElementById('h-layout');

    function field(name) { return form.elements[name]; }
    function value(name) { var f = field(name); return f && typeof f.value === 'string' ? f.value.trim() : ''; }
    function checkedValue(name) {
        var checked = form.querySelector('input[name="' + name + '"]:checked');
        return checked ? checked.value : '';
    }

    // Pasted text: full-width digits become plain ones (NFKC), and the invisible direction and zero-width
    // marks that phone contacts and WhatsApp profiles add around numbers are dropped
    function plain(v) {
        var s = String(v || '');
        if (s.normalize) s = s.normalize('NFKC');
        return s.replace(/[​-‏‪-‮⁠-⁤﻿]/g, '');
    }

    // Indian mobile numbers: 10 digits starting 6-9, with or without +91, 91 or a leading 0.
    // Returns "+91 98765 43210".
    function normalisePhone(v) {
        var s = plain(v).replace(/[\s\-‐-―().]/g, '');
        if (/^\+/.test(s)) {
            if (!/^\+91/.test(s)) return '';
            s = s.slice(3);
            if (/^0\d{10}$/.test(s)) s = s.slice(1);
        } else if (/^0091/.test(s)) {
            s = s.slice(4);
        } else if (/^91\d{10}$/.test(s)) {
            s = s.slice(2);
        } else if (/^0\d{10}$/.test(s)) {
            s = s.slice(1);
        }
        if (!/^[6-9]\d{9}$/.test(s)) return '';
        return '+91 ' + s.slice(0, 5) + ' ' + s.slice(5);
    }

    // kWp as a number. Commas only as thousands separators (1,500 or the Indian 1,50,000)
    function parseKwp(v) {
        var s = plain(v).replace(/\s*kwp?\s*$/i, '').trim();
        if (/,/.test(s)) {
            if (!/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s) && !/^\d{1,2}(,\d{2})*,\d{3}(\.\d+)?$/.test(s)) return 0;
            s = s.replace(/,/g, '');
        }
        if (!/^\d+(\.\d+)?$/.test(s)) return 0;
        var n = parseFloat(s);
        return n > 0 && n <= 1000000 ? n : 0;
    }

    var rules = {
        name: function (v) { return v.length >= 2 ? '' : 'Please enter your name.'; },
        whatsapp: function (v) {
            if (!v) return 'Please enter your WhatsApp number.';
            return normalisePhone(v) ? '' : 'Please enter a 10-digit Indian mobile number, with or without +91.';
        },
        company: function (v) { return v.length >= 2 ? '' : 'Please enter your company or EPC name.'; },
        project_city: function (v) { return v.length >= 2 ? '' : 'Please enter the city of the project site.'; },
        project_size_kwp: function (v) {
            if (!v) return 'Please enter the project size in kWp.';
            return parseKwp(v) ? '' : 'Please enter the size in kWp as a number, for example 150.';
        }
    };
    var ORDER = ['name', 'whatsapp', 'company', 'project_city', 'project_size_kwp'];

    function setError(name, msg) {
        var f = field(name);
        if (!f) return;
        var err = document.getElementById(f.getAttribute('aria-describedby'));
        if (msg) f.setAttribute('aria-invalid', 'true'); else f.removeAttribute('aria-invalid');
        if (err) {
            err.textContent = msg;
            err.hidden = !msg;
        }
    }

    function validate() {
        var first = null;
        ORDER.forEach(function (name) {
            var msg = rules[name](value(name));
            setError(name, msg);
            if (msg && !first) first = field(name);
        });
        return first;
    }

    // The first field with an error gets the focus, with its label in view below the fixed header
    function focusField(f) {
        var group = (f.closest && f.closest('.form-group, fieldset')) || f;
        var g = group.getBoundingClientRect();
        var r = f.getBoundingClientRect();
        var top = headerOffset();
        if (g.top < top || r.bottom > window.innerHeight - 96) {
            window.scrollTo({ top: Math.max(0, g.top + window.pageYOffset - top), behavior: reduceMotion() ? 'instant' : 'smooth' });
        }
        try { f.focus({ preventScroll: true }); } catch (e) { f.focus(); }
    }

    ORDER.forEach(function (name) {
        var f = field(name);
        if (!f) return;
        f.addEventListener('blur', function () { if (f.value.trim()) setError(name, rules[name](value(name))); });
        f.addEventListener('input', function () {
            if (f.getAttribute('aria-invalid') === 'true' && !rules[name](value(name))) setError(name, '');
        });
    });

    if (layoutSelect && layoutHint) {
        layoutSelect.addEventListener('change', function () {
            layoutHint.hidden = layoutSelect.value !== 'No layout yet';
        });
    }

    // The lead, in the order a person reads it (also the field names in the email)
    function lead() {
        var kwp = parseKwp(value('project_size_kwp'));
        return [
            ['Name', value('name')],
            ['WhatsApp', normalisePhone(value('whatsapp')) || value('whatsapp')],
            ['Company', value('company')],
            ['Project city', value('project_city')],
            ['Project size', kwp ? kwp + ' kWp' : value('project_size_kwp')],
            ['Project type', checkedValue('project_type')],
            ['Layout I have', value('layout')],
            ['Message', value('message')]
        ];
    }

    function detailsText() {
        var lines = [];
        lead().forEach(function (row) { if (row[1]) lines.push(row[0] + ': ' + row[1]); });
        return lines.join('\n');
    }
    function whatsappText() {
        return 'Hi Ray2Volt 3D, I would like a quote for a 3D plant viewer.\n\n' + detailsText() +
            '\n\n(Sent from the Ray2Volt 3D enquiry form)';
    }
    function emailBody() {
        return 'Hi Ray2Volt 3D,\n\nI would like a quote for a 3D plant viewer.\n\n' + detailsText() + '\n';
    }
    function followUpText() {
        var kwp = parseKwp(value('project_size_kwp'));
        var who = [value('company'), kwp ? kwp + ' kWp' : ''].filter(Boolean).join(', ');
        return 'Hi Ray2Volt 3D, I just sent an enquiry on your website' + (who ? ' (' + who + ')' : '') +
            '. Here are my layout and site photos.';
    }

    // The same hidden fields as the site's other Web3Forms forms, the visitor's details, form_id,
    // and the campaign fields that script.js captured on arrival
    function payload(via) {
        var data = new URLSearchParams();
        var subject = value('subject') || 'Ray2Volt 3D Enquiry - Ray2Volt Solar';
        var company = value('company');
        data.append('access_key', value('access_key'));
        data.append('subject', subject.replace(/ - Ray2Volt Solar$/, '') +
            (via === 'whatsapp' ? ' (WhatsApp)' : '') + ': ' + company + ' - Ray2Volt Solar');
        data.append('from_name', value('from_name'));
        data.append('Source Page', value('Source Page'));
        data.append('form_id', FORM_ID);
        data.append('Sent Via', via === 'whatsapp' ? 'WhatsApp (the visitor was sent to WhatsApp with these details)' : 'Website form');
        lead().forEach(function (row) { data.append(row[0], row[1]); });
        var campaign = window.ray2voltCampaign || { params: {}, landingPage: window.location.href };
        ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'gbraid', 'wbraid'].forEach(function (key) {
            if (campaign.params && campaign.params[key]) data.append(key, campaign.params[key]);
        });
        data.append('Landing Page URL', campaign.landingPage || window.location.href);
        data.append('Page URL', window.location.href);
        return data;
    }

    // Spam guards: a ticked honeypot never sends. A send faster than MIN_FILL_MS after the first touch of the
    // form is held once with a neutral "check your details" note; the next press goes through.
    var firstTouch = 0;
    var markTouch = function () { if (!firstTouch) firstTouch = Date.now(); };
    form.addEventListener('focusin', markTouch);
    form.addEventListener('input', markTouch);
    form.addEventListener('change', markTouch);
    var heldOnce = false;
    function honeypotTicked() {
        var bot = field('botcheck');
        return !!(bot && bot.checked);
    }
    function tooFast() {
        return !firstTouch || Date.now() - firstTouch < MIN_FILL_MS;
    }

    /* Status messages (role=status, aria-live=polite: read out without moving focus) */
    function el(tag, attrs, children) {
        var node = document.createElement(tag);
        Object.keys(attrs || {}).forEach(function (k) { node.setAttribute(k, attrs[k]); });
        (children || []).forEach(function (c) { node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
        return node;
    }
    function mailLink() {
        var href = 'mailto:' + EMAIL + '?subject=' + encodeURIComponent('Ray2Volt 3D enquiry: ' + value('company')) +
            '&body=' + encodeURIComponent(emailBody());
        return el('a', { href: href }, [EMAIL]);
    }
    function hintWanted() {
        return formActions.classList.contains('prefers-wa');
    }
    function clearStatus() {
        statusBox.className = 'form-status';
        statusBox.textContent = '';
        if (waHint) waHint.hidden = !hintWanted();
    }
    function showStatus(kind, nodes) {
        statusBox.className = 'form-status form-status--' + kind;
        statusBox.textContent = '';
        nodes.forEach(function (n) { statusBox.appendChild(n); });
        if (statusBox.scrollIntoView) statusBox.scrollIntoView({ block: 'nearest', behavior: reduceMotion() ? 'instant' : 'smooth' });
    }

    function showCheckAgain() {
        showStatus('note', [
            el('strong', {}, ['Please check your details']),
            document.createTextNode('Then press Send enquiry again.')
        ]);
    }

    function showWhatsAppOpened() {
        if (waHint) waHint.hidden = true;
        showStatus('ok', [
            el('strong', {}, ['WhatsApp is opening with your details']),
            document.createTextNode('Press send in WhatsApp to reach us, then add your layout and photos in the same chat. ' +
                'You don\'t need to press Send enquiry as well. If WhatsApp did not open, tap Send on WhatsApp again.')
        ]);
    }

    // kind 'network': no answer (offline, timeout). kind 'refused': Web3Forms answered but did not take it.
    function showError(kind) {
        preferWhatsApp();
        if (waHint) waHint.hidden = true;
        var refused = kind === 'refused';
        showStatus('error', [
            el('strong', {}, [refused ? 'Sorry, we could not send this right now' : 'Sorry, your enquiry did not go through']),
            document.createTextNode((refused ? 'Tap Send on WhatsApp: your details are already in the message. ' :
                'Please check your connection and try again, or tap Send on WhatsApp: your details are already in the message. ') +
                'You can also email '),
            mailLink(),
            document.createTextNode('.')
        ]);
    }

    function showSuccess() {
        clearStatus();
        form.hidden = true;
        if (proposal) proposal.classList.add('is-sent');
        if (!successBox) return;
        successBox.hidden = false;
        try { successBox.focus({ preventScroll: true }); } catch (e) { successBox.focus(); }
        var card = document.getElementById('form-card') || successBox;
        if (card.scrollIntoView) card.scrollIntoView({ block: 'nearest', behavior: reduceMotion() ? 'instant' : 'smooth' });
    }

    if (successBox) {
        var followUp = successBox.querySelector('[data-wa-followup]');
        if (followUp) followUp.addEventListener('click', function () { openWhatsApp(followUpText()); });
    }

    /* Each lead is counted once and reaches the inbox once. A lead is the visitor's details as sent; the same
       details sent again (a second press, WhatsApp then Send enquiry) are the same lead. */
    var counted = {};   // details -> generate_lead already reported
    var delivered = {}; // details -> Web3Forms confirmed it has the lead
    var posting = {};   // details -> a post is on its way (time it started)
    var inflight = {};  // details -> that post's promise, so a later Send enquiry waits for it
    function countLead(key) {
        if (counted[key]) return;
        counted[key] = true;
        var t = tracking();
        if (t && t.reportLead) t.reportLead(FORM_ID);
    }

    // Test hook shared with script.js: sessionStorage r2vDryRun = '1' logs the payload and reports success
    function dryRun() {
        try { return sessionStorage.getItem('r2vDryRun') === '1'; } catch (e) { return false; }
    }

    // Resolves true when Web3Forms took the lead, false when it answered but refused it; rejects with no answer.
    // A urlencoded body keeps it a simple request, so the keepalive post survives the hand-over to WhatsApp.
    function postLead(key, via, keepalive) {
        var body = payload(via);
        posting[key] = Date.now();
        var done = function (ok) {
            delete posting[key];
            delete inflight[key];
            if (ok) delivered[key] = true;
            return ok;
        };
        if (dryRun()) {
            if (window.console && console.info) console.info('[r2v dry run] Web3Forms payload', Object.fromEntries(body.entries()));
            return Promise.resolve(done(true));
        }
        var controller = !keepalive && 'AbortController' in window ? new AbortController() : null;
        var timer = controller ? setTimeout(function () { controller.abort(); }, 15000) : 0;
        var init = { method: 'POST', headers: { Accept: 'application/json' }, body: body };
        if (controller) init.signal = controller.signal;
        if (keepalive) init.keepalive = true;
        return (inflight[key] = fetch(ENDPOINT, init)
            .then(function (res) {
                return res.json().catch(function () { return {}; }).then(function (data) {
                    var ok = !!(res.ok && data && data.success);
                    if (!ok && window.console && console.warn) {
                        console.warn('Ray2Volt 3D form: Web3Forms refused the enquiry (HTTP ' + res.status + '): ' +
                            ((data && data.message) || 'no message'));
                    }
                    return ok;
                });
            })
            .then(function (ok) { clearTimeout(timer); return done(ok); },
                function (err) { clearTimeout(timer); done(false); throw err; }));
    }

    // "Send enquiry": when the WhatsApp post of the same details is still on its way, wait for its answer and
    // post again only if it did not reach the inbox, so one lead never arrives twice.
    function deliverByEmail(key) {
        var earlier = inflight[key] && posting[key] && Date.now() - posting[key] < 15000 ? inflight[key] : null;
        if (!earlier) return postLead(key, 'email', false);
        return earlier.then(function (ok) { return ok; }, function () { return false; })
            .then(function (ok) { return ok || postLead(key, 'email', false); });
    }

    var sending = false;
    var emailInner = emailButton ? emailButton.innerHTML : '';
    function setSending(on) {
        sending = on;
        form.setAttribute('aria-busy', on ? 'true' : 'false');
        [emailButton, waButton].forEach(function (b) { if (b) b.disabled = on; });
        if (emailButton) {
            if (on) emailButton.textContent = 'Sending…';
            else emailButton.innerHTML = emailInner;
        }
    }

    // Which button sent the form. A press (pointer, or Enter/Space on the button) is remembered for a moment;
    // an implicit submission (Enter in a field) follows the preselected action.
    var pressed = { action: '', at: 0 };
    [emailButton, waButton].forEach(function (b) {
        if (!b) return;
        var mark = function () { pressed = { action: b.getAttribute('data-action'), at: Date.now() }; };
        b.addEventListener('pointerdown', mark);
        b.addEventListener('mousedown', mark);
        b.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') mark(); });
    });
    function preferredAction() {
        return formActions.classList.contains('prefers-wa') ? 'whatsapp' : 'email';
    }
    function chooseAction(ev) {
        var submitter = ev.submitter && ev.submitter.getAttribute ? ev.submitter : null;
        var recent = Date.now() - pressed.at < 2000 ? pressed.action : '';
        if (!submitter) return recent || preferredAction();
        var action = submitter.getAttribute('data-action') || 'email';
        var isDefault = submitter === form.querySelector('button[type="submit"]');
        var explicit = recent === action || document.activeElement === submitter;
        return isDefault && !explicit ? preferredAction() : action;
    }

    var lastWaOpen = 0;
    function demoteEmail() {
        if (!emailButton) return;
        emailButton.classList.remove('btn-primary');
        emailButton.classList.add('home-btn-ghost');
        preferWhatsApp();
        if (waHint) waHint.hidden = true;
    }

    form.addEventListener('submit', function (ev) {
        ev.preventDefault();
        if (sending) return;
        var action = chooseAction(ev);

        var firstBad = validate();
        if (firstBad) {
            clearStatus();
            focusField(firstBad);
            return;
        }
        var key = detailsText();

        if (action === 'whatsapp') {
            var now = Date.now();
            if (now - lastWaOpen < 2000) return; // a double press opens WhatsApp once
            lastWaOpen = now;
            if (!honeypotTicked()) {
                if (!delivered[key] && !(posting[key] && now - posting[key] < 15000)) {
                    try { postLead(key, 'whatsapp', true).catch(function () { /* WhatsApp still carries the lead */ }); } catch (e) { /* ditto */ }
                }
                countLead(key);
                var t = tracking();
                if (t && t.sendEvent) t.sendEvent('whatsapp_click', { method: 'enquiry_form', link_id: FORM_ID });
            }
            demoteEmail();
            showWhatsAppOpened();
            openWhatsApp(whatsappText());
            return;
        }

        // "Send enquiry"
        if (honeypotTicked()) {
            showCheckAgain();
            return;
        }
        if (delivered[key]) { // already in the inbox (sent on WhatsApp a moment ago): nothing to send twice
            countLead(key);
            showSuccess();
            return;
        }
        if (tooFast() && !heldOnce) {
            heldOnce = true;
            showCheckAgain();
            return;
        }
        clearStatus();
        setSending(true);
        deliverByEmail(key)
            .then(function (ok) {
                setSending(false);
                if (ok) {
                    countLead(key);
                    showSuccess();
                } else {
                    showError('refused');
                }
            }, function () {
                setSending(false);
                showError('network');
            });
    });

    // Back from WhatsApp through the back button: the page may be restored as it was, so the buttons work again
    window.addEventListener('pageshow', function (e) {
        if (e.persisted && sending) setSending(false);
    });
})();
