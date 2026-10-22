/* ==========================================================================
   Ray2Volt Solar - Before and after solar, on the electricity bill
   Shows one month's bill without and with solar, then the first year month
   by month. The numbers roll from the old bill to the new one when the
   widget comes into view.

   <div class="bill-story" data-bill-story data-segment="home"
        data-choices="segment"></div>

   data-segment  home | business   the bill shown first
   data-choices  "segment" shows the Home / Business switch
   Styles are in solar-visuals.css. Every figure is illustrative.
   ========================================================================== */
(function () {
    'use strict';

    const roots = document.querySelectorAll('[data-bill-story]');
    if (!roots.length) return;

    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
    const money = n => (n < -0.5 ? '−₹' : '₹') + inr.format(Math.abs(Math.round(n)));
    const count = n => inr.format(Math.round(n));
    const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
    let uid = 0;

    // ──────────────────────────────────────────────────────────
    // 1. The bill maths. Rates and shares are illustrative.
    //    Months run in the net-metering banking year, April to March.
    // ──────────────────────────────────────────────────────────
    const MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
    // Use peaks with summer cooling; output dips in the monsoon and the
    // north-east rains of October and November
    const USE = [1.2, 1.3, 1.15, 1.0, 0.95, 0.95, 0.92, 0.85, 0.83, 0.85, 0.9, 1.05];
    const SUN = [1.12, 1.08, 0.95, 0.9, 0.92, 0.95, 0.9, 0.85, 0.92, 1.05, 1.12, 1.15];
    const UNITS_PER_KW = 120;

    // The slider starts where the smallest 1 kW system still leaves some units
    // to buy, so the cut stays within the site's "up to 90%"
    const HOME = {
        min: 1200, max: 10000, step: 100, start: 3000,
        rate: 7.5, fixed: 150, shareOnSite: 0.4, leftoverRate: 2.75
    };

    const BUSINESS = {
        min: 30000, max: 500000, step: 5000, start: 150000,
        rate: 9, demandShare: 0.12, cover: 0.75, shareOnSite: 0.85, exportRate: 3
    };

    // A home on net metering: exports are set off against imports unit for unit,
    // and spare units are banked for later months
    function homeMonth(used, gen, bank) {
        const onSite = Math.min(used, gen * HOME.shareOnSite);
        const imported = used - onSite;
        const exported = gen - onSite;
        const available = bank + exported;
        const billed = Math.max(0, imported - available);
        return {
            used: used,
            imported: imported,
            exported: exported,
            billed: billed,
            bank: Math.max(0, available - imported),
            energy: billed * HOME.rate,
            fixed: HOME.fixed,
            total: HOME.fixed + billed * HOME.rate,
            solarShare: used ? (used - billed) / used : 0
        };
    }

    function home(bill) {
        const used = Math.max(0, (bill - HOME.fixed) / HOME.rate);
        // Size for about 90% of the units used, rounded down to half a kW
        const kw = clamp(Math.floor(used * 0.9 / UNITS_PER_KW * 2) / 2, 1, 10);
        const gen = kw * UNITS_PER_KW;
        const before = {
            used: used, imported: used, exported: 0, billed: used,
            energy: used * HOME.rate, fixed: HOME.fixed, total: bill, solarShare: 0
        };
        const after = homeMonth(used, gen, 0);
        let bank = 0;
        const year = MONTHS.map((m, i) => {
            const u = used * USE[i];
            const month = homeMonth(u, gen * SUN[i], bank);
            bank = month.bank;
            return { before: HOME.fixed + u * HOME.rate, after: month.total };
        });
        return {
            kw: kw, used: used, before: before, after: after, year: year,
            leftover: bank * HOME.leftoverRate,
            size: kw + ' kW'
        };
    }

    // A business uses most of its solar as it is made; the little it exports
    // is credited at a lower rate. Demand charges do not change.
    function businessMonth(used, gen, demand) {
        const onSite = Math.min(used, gen * BUSINESS.shareOnSite);
        const imported = used - onSite;
        const exported = gen - onSite;
        const credit = exported * BUSINESS.exportRate;
        return {
            used: used,
            imported: imported,
            exported: exported,
            energy: imported * BUSINESS.rate,
            credit: credit,
            demand: demand,
            total: demand + imported * BUSINESS.rate - credit,
            solarShare: used ? onSite / used : 0
        };
    }

    function business(bill) {
        const demand = Math.round(bill * BUSINESS.demandShare / 100) * 100;
        const used = (bill - demand) / BUSINESS.rate;
        const kw = clamp(Math.round(used * BUSINESS.cover / UNITS_PER_KW / 5) * 5, 10, 1000);
        const gen = kw * UNITS_PER_KW;
        const before = {
            used: used, imported: used, exported: 0, energy: used * BUSINESS.rate,
            credit: 0, demand: demand, total: bill, solarShare: 0
        };
        const after = businessMonth(used, gen, demand);
        const year = MONTHS.map((m, i) => {
            const u = used * USE[i];
            return { before: demand + u * BUSINESS.rate, after: businessMonth(u, gen * SUN[i], demand).total };
        });
        return { kw: kw, used: used, before: before, after: after, year: year, leftover: 0, size: kw + ' kW' };
    }

    // The year's bills added up. Units still banked in March are paid out.
    function yearTotals(r) {
        return {
            before: r.year.reduce((a, m) => a + m.before, 0),
            after: r.year.reduce((a, m) => a + m.after, 0) - r.leftover
        };
    }

    // The lines printed on each bill, in order
    const ROWS = {
        home: [
            { key: 'imported', label: 'Units from the grid', fmt: count },
            { key: 'exported', label: 'Units exported', fmt: n => (n > 0.5 ? '−' : '') + count(n) },
            { key: 'billed', label: 'Net units billed', fmt: count, sub: (m) => m.exported ? 'Grid units minus exported units' : '' },
            { key: 'energy', label: 'Energy charges', fmt: money, sub: (m) => count(m.billed) + ' units × ₹7.50' },
            { key: 'fixed', label: 'Fixed and customer charges', fmt: money, sub: (m, after) => after ? 'Unchanged' : '' }
        ],
        business: [
            { key: 'imported', label: 'Units from the grid', fmt: count },
            { key: 'exported', label: 'Units exported', fmt: n => (n > 0.5 ? '−' : '') + count(n) },
            { key: 'energy', label: 'Energy charges', fmt: money, sub: (m) => count(m.imported) + ' units × ₹9.00' },
            { key: 'credit', label: 'Export credit', fmt: n => money(-n), sub: (m) => m.exported ? count(m.exported) + ' units × ₹3.00' : '' },
            { key: 'demand', label: 'Demand charges', fmt: money, sub: (m, after) => after ? 'Unchanged' : 'For your contract demand' }
        ]
    };

    const COPY = {
        home: {
            label: 'Your monthly bill',
            hint: r => `About ${count(r.used)} units a month, suited to a ${r.size} system`,
            payback: 'Most homes recover the cost in 4 to 5 years after subsidy, subject to a site audit.',
            fine: 'Illustrative: ₹7.50 a unit, ₹150 a month in fixed charges, 120 units per kW a month on average and net metering, with spare units banked from April to March. Your tariff, roof and usage set the real figures.'
        },
        business: {
            label: 'Your monthly bill',
            hint: r => `About ${count(r.used)} units a month, suited to a ${r.size} plant`,
            payback: 'Businesses typically recover the cost in 3 to 5 years, subject to a site audit.',
            fine: 'Illustrative: ₹9.00 a unit, demand charges at 12% of today’s bill, 120 units per kW a month, 85% of solar used on site and exports credited at ₹3.00. Units bought in the evening peak can cost more. Your tariff and load pattern set the real figures.'
        }
    };

    // ──────────────────────────────────────────────────────────
    // 2. Rolling numbers
    // ──────────────────────────────────────────────────────────
    const ease = t => 1 - Math.pow(1 - t, 3);

    function roll(el, to, fmt, duration, delay) {
        if (el.rollFrame) cancelAnimationFrame(el.rollFrame);
        clearTimeout(el.rollWait);
        const from = el.rollValue === undefined ? to : el.rollValue;
        if (reduceMotion || !duration || from === to) {
            el.rollValue = to;
            el.textContent = fmt(to);
            return;
        }
        el.rollWait = setTimeout(() => {
            const start = performance.now();
            const step = now => {
                const t = Math.min(1, (now - start) / duration);
                el.rollValue = from + (to - from) * ease(t);
                el.textContent = fmt(el.rollValue);
                if (t < 1) el.rollFrame = requestAnimationFrame(step);
            };
            el.rollFrame = requestAnimationFrame(step);
        }, delay || 0);
    }

    // ──────────────────────────────────────────────────────────
    // 3. One widget per [data-bill-story] element
    // ──────────────────────────────────────────────────────────
    function billMarkup(kind, title, tag) {
        return `
            <article class="bs-bill bs-bill--${kind}">
                <header class="bs-bill__head">
                    <span class="bs-bill__tag">${tag}</span>
                    <span class="bs-bill__title">${title}</span>
                </header>
                <dl class="bs-rows"></dl>
                <div class="bs-meter" aria-hidden="true"><span class="bs-meter__fill"></span></div>
                <p class="bs-meter__label"></p>
                <div class="bs-total">
                    <span>Amount payable</span>
                    <strong class="bs-total__value"></strong>
                </div>
                ${kind === 'after' ? '<p class="bs-stamp"><span>You save</span><strong class="bs-stamp__value"></strong><span class="bs-stamp__note"></span></p>' : ''}
            </article>`;
    }

    function BillStory(root) {
        this.root = root;
        this.segment = root.getAttribute('data-segment') === 'business' ? 'business' : 'home';
        this.withSwitch = (root.getAttribute('data-choices') || '').indexOf('segment') !== -1;
        this.bills = { home: HOME.start, business: BUSINESS.start };
        // The bills and the year each roll to the new figures when they come
        // into view, as on a phone they sit a long way apart
        this.seen = { bills: false, year: false };
        this.visible = { bills: false, year: false };
        this.timers = {};
        this.build();
        this.layout();
        this.update(0);
        this.observe();
    }

    BillStory.prototype.build = function () {
        const id = 'bs-' + (++uid);
        this.root.textContent = '';
        this.root.classList.add('is-ready');
        this.root.innerHTML = `
            <div class="bs-bar">
                ${this.withSwitch ? `<div class="ef-switch bs-switch" role="group" aria-label="Bill for">
                    <button type="button" data-bill-segment="home">Home</button>
                    <button type="button" data-bill-segment="business">Business</button>
                </div>` : ''}
                <div class="bs-input">
                    <label class="bs-input__label" for="${id}-range"><span class="bs-input__name"></span><span class="bs-input__value" aria-hidden="true"></span></label>
                    <input class="bs-range" id="${id}-range" type="range">
                    <p class="bs-input__hint"></p>
                </div>
            </div>
            <div class="bs-body">
                <div class="bs-bills">
                    ${billMarkup('before', 'Monthly electricity bill', 'Before solar')}
                    <div class="bs-arrow" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M5 12h14M13 6l6 6-6 6"/></svg></div>
                    ${billMarkup('after', 'The same month, with solar', 'With solar')}
                </div>
                <div class="bs-year">
                    <h3 class="bs-year__title">Your first year, month by month</h3>
                    <div class="bs-chart" role="img">
                        <span class="bs-chart__scale"></span>
                        <div class="bs-chart__bars">
                            ${MONTHS.map(m => `<div class="bs-month"><span class="bs-month__before"></span><span class="bs-month__after"></span><span class="bs-month__label">${m}</span></div>`).join('')}
                        </div>
                    </div>
                    <ul class="bs-legend" aria-hidden="true">
                        <li class="bs-legend__before">Before solar</li>
                        <li class="bs-legend__after">With solar</li>
                    </ul>
                    <dl class="bs-sum">
                        <div><dt>Before solar</dt><dd class="bs-sum__before"></dd></div>
                        <div><dt>With solar</dt><dd class="bs-sum__after"></dd></div>
                        <div class="bs-sum__saved"><dt>Saved in year one</dt><dd class="bs-sum__save"></dd></div>
                    </dl>
                    <p class="bs-status" role="status"></p>
                    <p class="bs-payback"></p>
                    <p class="bs-fine"></p>
                </div>
            </div>`;
        this.range = this.root.querySelector('.bs-range');
        this.status = this.root.querySelector('.bs-status');
        this.parts ={ bills: this.root.querySelector('.bs-bills'), year: this.root.querySelector('.bs-year') };
        this.months = Array.prototype.slice.call(this.root.querySelectorAll('.bs-month'));
        this.months.forEach((el, i) => el.style.setProperty('--i', i));

        this.range.addEventListener('input', () => {
            this.bills[this.segment] = Number(this.range.value);
            // Dragging should feel direct, so drop the slow reveal timings
            this.settle('bills');
            this.settle('year');
            this.update(320);
            this.announce();
        });
        this.root.addEventListener('click', event => {
            const btn = event.target.closest('[data-bill-segment]');
            if (!btn || btn.getAttribute('data-bill-segment') === this.segment) return;
            // Show the old bill again, then roll down to the new one
            this.segment = btn.getAttribute('data-bill-segment');
            this.seen = { bills: false, year: false };
            this.layout();
            this.update(0);
            Object.keys(this.parts).forEach(part => {
                if (this.visible[part]) this.play(part);
            });
            this.announce();
        });
    };

    // Screen readers hear the result once the slider comes to rest, not
    // every figure as it rolls
    BillStory.prototype.announce = function () {
        clearTimeout(this.timers.status);
        this.timers.status = setTimeout(() => {
            const r = this.result;
            const sums = yearTotals(r);
            this.status.textContent = `A ${money(r.before.total)} monthly bill falls to about ${money(r.after.total)} with solar, `
                + `saving about ${money(sums.before - sums.after)} in the first year.`;
        }, 400);
    };

    // Set up the controls and bill lines for home or business
    BillStory.prototype.layout = function () {
        const seg = this.segment;
        const cfg = seg === 'home' ? HOME : BUSINESS;
        this.root.setAttribute('data-segment', seg);
        this.root.querySelectorAll('[data-bill-segment]').forEach(b => b.setAttribute('aria-pressed', String(b.getAttribute('data-bill-segment') === seg)));
        this.range.min = cfg.min;
        this.range.max = cfg.max;
        this.range.step = cfg.step;
        this.range.value = this.bills[seg];
        this.root.querySelector('.bs-input__name').textContent = COPY[seg].label;
        this.root.querySelector('.bs-payback').textContent = COPY[seg].payback;
        this.root.querySelector('.bs-fine').textContent = COPY[seg].fine;
        this.root.querySelectorAll('.bs-rows').forEach(dl => {
            dl.innerHTML = ROWS[seg].map(row => `<div class="bs-row" data-row="${row.key}"><dt>${row.label}<span class="bs-row__sub"></span></dt><dd></dd></div>`).join('');
        });
        Object.keys(this.parts).forEach(part => {
            clearTimeout(this.timers[part]);
            clearTimeout(this.timers[part + 'Stamp']);
            this.parts[part].classList.remove('is-played', 'is-settled', 'is-stamped');
        });
        this.root.querySelectorAll('.bs-total__value, .bs-stamp__value, .bs-sum dd').forEach(el => { el.rollValue = undefined; });
    };

    // Work out the bills for the slider's value and show them
    BillStory.prototype.update = function (duration) {
        const seg = this.segment;
        const bill = this.bills[seg];
        const cfg = seg === 'home' ? HOME : BUSINESS;
        const r = seg === 'home' ? home(bill) : business(bill);
        this.result = r;

        // The slider speaks its own value, so the figure beside the label is
        // hidden from screen readers and is not read twice
        this.root.querySelector('.bs-input__value').textContent = money(bill);
        this.root.querySelector('.bs-input__hint').textContent = COPY[seg].hint(r);
        this.range.style.setProperty('--fill', ((bill - cfg.min) / (cfg.max - cfg.min) * 100).toFixed(1) + '%');
        this.range.setAttribute('aria-valuetext', money(bill) + ' a month');
        this.paintBills(duration, 0);
        this.paintYear(duration, 0);
    };

    // The two bills. Until they have been seen, the "with solar" bill still
    // shows the old figures, ready to roll down.
    BillStory.prototype.paintBills = function (duration, delay) {
        const seg = this.segment;
        const r = this.result;
        const shown = this.seen.bills || reduceMotion;
        const root = this.root;

        const paint = (card, month, isAfter, wait) => {
            const el = root.querySelector('.bs-bill--' + card);
            ROWS[seg].forEach(row => {
                const line = el.querySelector(`[data-row="${row.key}"]`);
                roll(line.querySelector('dd'), month[row.key] || 0, row.fmt, duration, wait);
                line.querySelector('.bs-row__sub').textContent = row.sub ? row.sub(month, isAfter) : '';
                line.classList.toggle('is-zero', Math.round(month[row.key] || 0) === 0);
            });
            roll(el.querySelector('.bs-total__value'), month.total, money, duration, wait);
            const share = Math.round(month.solarShare * 100);
            el.querySelector('.bs-meter__fill').style.transform = `scaleX(${month.solarShare.toFixed(3)})`;
            el.querySelector('.bs-meter__label').textContent = share > 0
                ? `Solar covers ${share}% of the units you use`
                : `All ${count(month.used)} units come from the grid`;
        };
        paint('before', r.before, false, 0);
        paint('after', shown ? r.after : r.before, true, delay);

        const saved = r.before.total - r.after.total;
        roll(root.querySelector('.bs-stamp__value'), shown ? saved : 0, money, duration, delay);
        root.querySelector('.bs-stamp__note').textContent = 'a month, ' + Math.round(saved / r.before.total * 100) + '% less';
    };

    // The first year. Bars scale against the biggest month before solar.
    BillStory.prototype.paintYear = function (duration, delay) {
        const r = this.result;
        const shown = this.seen.year || reduceMotion;
        const root = this.root;
        const befores = r.year.map(m => m.before);
        const afters = r.year.map(m => m.after);
        const top = Math.max.apply(null, befores);
        const sums = yearTotals(r);
        const sumBefore = sums.before;
        const sumAfter = sums.after;

        this.months.forEach((el, i) => {
            const m = r.year[i];
            el.style.setProperty('--before', (m.before / top).toFixed(3));
            el.style.setProperty('--after', ((shown ? m.after : m.before) / top).toFixed(3));
        });
        root.querySelector('.bs-chart__scale').textContent = money(top);
        root.querySelector('.bs-chart').setAttribute('aria-label',
            `Monthly bills over the first year. Without solar they total about ${money(sumBefore)}, `
            + `highest in ${MONTHS[befores.indexOf(top)]} at ${money(top)}. `
            + `With solar they total about ${money(sumAfter)}, between ${money(Math.min.apply(null, afters))} `
            + `and ${money(Math.max.apply(null, afters))} a month.`);
        roll(root.querySelector('.bs-sum__before'), sumBefore, money, duration);
        roll(root.querySelector('.bs-sum__after'), shown ? sumAfter : sumBefore, money, duration, delay);
        roll(root.querySelector('.bs-sum__save'), shown ? sumBefore - sumAfter : 0, money, duration, delay);
    };

    // The reveal for one part: the old figures roll down to the new ones
    BillStory.prototype.play = function (part) {
        const el = this.parts[part];
        this.seen[part] = true;
        clearTimeout(this.timers[part]);
        clearTimeout(this.timers[part + 'Stamp']);
        el.classList.remove('is-settled', 'is-stamped');
        el.classList.add('is-played');
        if (part === 'bills') {
            this.paintBills(1600, 500);
            this.timers.billsStamp = setTimeout(() => el.classList.add('is-stamped'), reduceMotion ? 0 : 2000);
        } else {
            this.paintYear(1600, 600);
        }
        this.timers[part] = setTimeout(() => this.settle(part), reduceMotion ? 0 : 2600);
    };

    // After the reveal, bars and meters follow the slider quickly
    BillStory.prototype.settle = function (part) {
        if (!this.seen[part]) return;
        clearTimeout(this.timers[part]);
        this.parts[part].classList.add('is-settled');
        if (part === 'bills') {
            clearTimeout(this.timers.billsStamp);
            this.parts.bills.classList.add('is-stamped');
        }
    };

    // Each part plays once nearly half of it (45%) is on screen
    BillStory.prototype.observe = function () {
        const targets = { bills: this.root.querySelector('.bs-bill--after'), year: this.root.querySelector('.bs-chart') };
        if (reduceMotion || !('IntersectionObserver' in window)) {
            this.visible = { bills: true, year: true };
            this.play('bills');
            this.play('year');
            return;
        }
        const io = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                const part = entry.target === targets.bills ? 'bills' : 'year';
                this.visible[part] = entry.isIntersecting && entry.intersectionRatio >= 0.45;
                if (this.visible[part] && !this.seen[part]) this.play(part);
            });
        }, { threshold: [0, 0.45] });
        io.observe(targets.bills);
        io.observe(targets.year);
    };

    roots.forEach(root => new BillStory(root));
})();
