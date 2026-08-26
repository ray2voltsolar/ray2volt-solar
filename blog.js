/* ==========================================================================
   Ray2Volt Solar — Blog behaviour
   Loaded on blog.html and on every blog/<slug>.html page.
   Every block is guarded so it silently no-ops when its markup is absent.
   ========================================================================== */

(function () {
    'use strict';

    // ──────────────────────────────────────────────────────────
    // 1. Category filtering (blog.html index)
    // ──────────────────────────────────────────────────────────
    function initFilters() {
        const filters = document.querySelectorAll('.blog-filter');
        const cards = document.querySelectorAll('.blog-card[data-category]');
        if (!filters.length || !cards.length) return;

        const empty = document.querySelector('.blog-empty');

        filters.forEach(function (button) {
            button.addEventListener('click', function () {
                const want = this.dataset.filter || 'all';

                filters.forEach(function (b) { b.classList.remove('active'); });
                this.classList.add('active');

                let shown = 0;
                cards.forEach(function (card) {
                    const match = want === 'all' || card.dataset.category === want;
                    card.classList.toggle('is-hidden', !match);
                    if (match) shown++;
                });

                if (empty) empty.hidden = shown !== 0;
            });
        });
    }

    // ──────────────────────────────────────────────────────────
    // 2. Table-of-contents scroll spy (post pages)
    // ──────────────────────────────────────────────────────────
    function initTocSpy() {
        const links = document.querySelectorAll('.toc a[href^="#"]');
        if (!links.length) return;

        const sections = [];
        links.forEach(function (link) {
            const target = document.getElementById(link.getAttribute('href').slice(1));
            if (target) sections.push({ link: link, target: target });
        });
        if (!sections.length) return;

        // Highlight the last heading scrolled past, so a link stays active for the
        // whole section rather than only while its heading is on screen.
        let current = null;

        function sync() {
            const line = window.scrollY + 140;
            let found = sections[0];
            for (const section of sections) {
                if (section.target.getBoundingClientRect().top + window.scrollY <= line) {
                    found = section;
                } else {
                    break;
                }
            }
            if (found === current) return;
            current = found;
            links.forEach(function (l) { l.classList.remove('active'); });
            found.link.classList.add('active');
        }

        // Throttled on a timestamp rather than requestAnimationFrame, so it still
        // updates in a backgrounded tab where frame callbacks never fire.
        let last = 0;
        let pending = 0;
        function onScroll() {
            const now = Date.now();
            if (now - last >= 100) {
                last = now;
                sync();
                return;
            }
            if (pending) return;
            pending = window.setTimeout(function () {
                pending = 0;
                last = Date.now();
                sync();
            }, 100);
        }

        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll, { passive: true });
        sync();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            initFilters();
            initTocSpy();
        });
    } else {
        initFilters();
        initTocSpy();
    }
})();
