/* Ray2Volt Solar calculators: business ROI (A16), loan EMI (B15) and diesel cost (A19).
   Every figure is an estimate from the visitor's own inputs; nothing here is a quote.
   The maths is exposed on window.r2vCalc for tests. */
(function () {
    'use strict';

    const YEARS = 25;

    // EMI = P·r·(1+r)^n / ((1+r)^n − 1), r = annual rate / 12 / 100
    function emi(principal, annualRate, months) {
        if (!(principal > 0) || !(months > 0)) return 0;
        const r = annualRate / 12 / 100;
        if (r === 0) return principal / months;
        const f = Math.pow(1 + r, months);
        return principal * r * f / (f - 1);
    }

    function loanSchedule(principal, annualRate, months) {
        const payment = emi(principal, annualRate, months);
        const r = annualRate / 12 / 100;
        const years = [];
        let balance = principal;
        for (let m = 1; m <= months; m++) {
            const interest = balance * r;
            const principalPart = Math.min(balance, payment - interest);
            balance = Math.max(0, balance - principalPart);
            const y = Math.ceil(m / 12);
            if (!years[y - 1]) years[y - 1] = { year: y, paid: 0, interest: 0, principal: 0, balance: 0 };
            years[y - 1].paid += payment;
            years[y - 1].interest += interest;
            years[y - 1].principal += principalPart;
            years[y - 1].balance = balance;
        }
        return { payment, totalPaid: payment * months, totalInterest: payment * months - principal, years };
    }

    function npv(rate, flows) {
        return flows.reduce((sum, cf, t) => sum + cf / Math.pow(1 + rate, t), 0);
    }

    // IRR by bisection; null when the cash flows never change sign.
    function irr(flows) {
        let lo = -0.99;
        let hi = 1;
        let fLo = npv(lo, flows);
        let fHi = npv(hi, flows);
        while (fLo * fHi > 0 && hi < 100) {
            hi *= 2;
            fHi = npv(hi, flows);
        }
        if (fLo * fHi > 0) return null;
        for (let i = 0; i < 200; i++) {
            const mid = (lo + hi) / 2;
            const fMid = npv(mid, flows);
            if (Math.abs(fMid) < 1e-7) return mid;
            if (fLo * fMid < 0) {
                hi = mid;
            } else {
                lo = mid;
                fLo = fMid;
            }
        }
        return (lo + hi) / 2;
    }

    /* inputs: kwp, cost, yield, degradation (%), tariff, tariffIncrease (%), selfUse (%), exportRate,
       omCost (₹ per year), omIncrease (%), taxRate (%), claimDepreciation, halfYear, loanAmount, loanRate,
       loanYears, discountRate (%) */
    function roi(i) {
        const loan = Math.min(Math.max(i.loanAmount || 0, 0), i.cost);
        const schedule = loan > 0 ? loanSchedule(loan, i.loanRate || 0, Math.round((i.loanYears || 0) * 12)) : null;
        const rows = [];
        const flows = [-(i.cost - loan)];
        let wdv = i.cost;
        let cumulative = flows[0];
        let paybackYear = null;
        for (let y = 1; y <= YEARS; y++) {
            const generation = i.kwp * i.yield * Math.pow(1 - i.degradation / 100, y - 1);
            const onSite = generation * i.selfUse / 100;
            const exported = generation - onSite;
            const savings = onSite * i.tariff * Math.pow(1 + i.tariffIncrease / 100, y - 1) + exported * (i.exportRate || 0);
            let depreciation = 0;
            if (i.claimDepreciation) {
                depreciation = wdv * 0.40 * (y === 1 && i.halfYear ? 0.5 : 1);
                wdv -= depreciation;
            }
            const tax = depreciation * i.taxRate / 100;
            const om = (i.omCost || 0) * Math.pow(1 + (i.omIncrease || 0) / 100, y - 1);
            const repayment = schedule && schedule.years[y - 1] ? schedule.years[y - 1].paid : 0;
            const net = savings + tax - om - repayment;
            const previous = cumulative;
            cumulative += net;
            if (paybackYear === null && previous < 0 && cumulative >= 0) {
                paybackYear = y - 1 + (net > 0 ? -previous / net : 1);
            }
            flows.push(net);
            rows.push({ year: y, generation, savings, tax, om, repayment, net, cumulative });
        }
        if (flows[0] >= 0 && paybackYear === null) paybackYear = 0;
        return {
            rows,
            flows,
            paybackYear,
            irr: irr(flows),
            npv: npv((i.discountRate || 0) / 100, flows),
            totalSavings: rows.reduce((s, r) => s + r.savings, 0),
            totalNet: rows.reduce((s, r) => s + r.net, 0) + flows[0],
            loan: schedule
        };
    }

    // Diesel cost per unit = price per litre ÷ units (kWh) per litre
    function diesel(pricePerLitre, kwhPerLitre, hoursPerMonth, loadKw) {
        const perUnit = kwhPerLitre > 0 ? pricePerLitre / kwhPerLitre : 0;
        const unitsPerMonth = (hoursPerMonth || 0) * (loadKw || 0);
        return {
            perUnit,
            unitsPerMonth,
            litresPerMonth: kwhPerLitre > 0 ? unitsPerMonth / kwhPerLitre : 0,
            costPerMonth: unitsPerMonth * perUnit
        };
    }

    window.r2vCalc = { emi, loanSchedule, npv, irr, roi, diesel };

    if (typeof document === 'undefined' || !document.addEventListener) return;

    const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
    const money = v => (v < 0 ? '−₹' : '₹') + inr.format(Math.abs(Math.round(v)));
    const num = v => inr.format(Math.round(v));
    const pct = v => (v === null || !isFinite(v) ? 'Not reached' : (v * 100).toFixed(1) + '%');

    function read(form, name) {
        const field = form.elements[name];
        if (!field) return 0;
        if (field.type === 'checkbox') return field.checked;
        const value = parseFloat(String(field.value).replace(/,/g, ''));
        return isFinite(value) ? value : NaN;
    }

    function setText(root, key, text) {
        root.querySelectorAll('[data-out="' + key + '"]').forEach(el => { el.textContent = text; });
    }

    function checkRequired(form) {
        let firstInvalid = null;
        form.querySelectorAll('[required]').forEach(field => {
            const value = parseFloat(field.value);
            const min = field.min !== '' ? parseFloat(field.min) : -Infinity;
            const ok = field.value.trim() !== '' && isFinite(value) && value >= min;
            field.setAttribute('aria-invalid', ok ? 'false' : 'true');
            if (!ok && !firstInvalid) firstInvalid = field;
        });
        return firstInvalid;
    }

    function bindCalculator(form, compute) {
        const status = form.querySelector('[data-calc-status]');
        const results = document.getElementById(form.getAttribute('data-results'));
        const run = function (e) {
            if (e) e.preventDefault();
            const invalid = checkRequired(form);
            if (invalid) {
                if (results) results.hidden = true;
                if (status) status.textContent = 'Fill in the fields marked * to see the estimate.';
                if (e && e.type === 'submit') invalid.focus();
                return;
            }
            if (status) status.textContent = '';
            compute(form, results);
            if (results) results.hidden = false;
        };
        form.addEventListener('submit', run);
        form.addEventListener('input', () => { if (!results || !results.hidden) run(); });
        form.addEventListener('change', () => { if (!results || !results.hidden) run(); });
    }

    document.addEventListener('DOMContentLoaded', function () {
        const roiForm = document.querySelector('form[data-calc="roi"]');
        if (roiForm) {
            bindCalculator(roiForm, function (form, out) {
                const input = {
                    kwp: read(form, 'kwp'), cost: read(form, 'cost'), yield: read(form, 'yield'),
                    degradation: read(form, 'degradation'), tariff: read(form, 'tariff'),
                    tariffIncrease: read(form, 'tariffIncrease'), selfUse: read(form, 'selfUse'),
                    exportRate: read(form, 'exportRate') || 0, omCost: read(form, 'omCost') || 0,
                    omIncrease: read(form, 'omIncrease') || 0, taxRate: read(form, 'taxRate') || 0,
                    claimDepreciation: read(form, 'claimDepreciation'), halfYear: read(form, 'halfYear'),
                    loanAmount: read(form, 'loanAmount') || 0, loanRate: read(form, 'loanRate') || 0,
                    loanYears: read(form, 'loanYears') || 0, discountRate: read(form, 'discountRate') || 0
                };
                const r = roi(input);
                const pb = r.paybackYear;
                setText(out, 'payback', pb === null ? 'Not within 25 years' : pb.toFixed(1) + ' years');
                setText(out, 'irr', pct(r.irr));
                setText(out, 'npv', money(r.npv));
                setText(out, 'savings', money(r.totalSavings));
                setText(out, 'net', money(r.totalNet));
                setText(out, 'year1', money(r.rows[0].savings));
                setText(out, 'upfront', money(-r.flows[0]));
                setText(out, 'discount', (input.discountRate || 0) + '%');
                setText(out, 'emi', r.loan ? money(r.loan.payment) + ' a month' : 'No loan entered');

                const tbody = out.querySelector('tbody');
                tbody.innerHTML = '';
                const zero = document.createElement('tr');
                zero.innerHTML = '<th scope="row">0</th><td class="num">–</td><td class="num">–</td><td class="num">–</td><td class="num">–</td><td class="num">–</td>'
                    + '<td class="num">' + money(r.flows[0]) + '</td><td class="num">' + money(r.flows[0]) + '</td>';
                tbody.appendChild(zero);
                r.rows.forEach(row => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = '<th scope="row">' + row.year + '</th>'
                        + '<td class="num">' + num(row.generation) + '</td>'
                        + '<td class="num">' + money(row.savings) + '</td>'
                        + '<td class="num">' + money(row.tax) + '</td>'
                        + '<td class="num">' + money(-row.om) + '</td>'
                        + '<td class="num">' + money(-row.repayment) + '</td>'
                        + '<td class="num">' + money(row.net) + '</td>'
                        + '<td class="num">' + money(row.cumulative) + '</td>';
                    tbody.appendChild(tr);
                });

                const chart = out.querySelector('.chart-bars');
                if (chart) {
                    const values = [r.flows[0]].concat(r.rows.map(row => row.cumulative));
                    const max = Math.max.apply(null, values.map(Math.abs)) || 1;
                    chart.innerHTML = '';
                    values.forEach(v => {
                        const bar = document.createElement('span');
                        bar.className = 'bar' + (v < 0 ? ' neg' : '');
                        bar.style.height = Math.max(2, Math.abs(v) / max * 100) + '%';
                        chart.appendChild(bar);
                    });
                }
            });
        }

        const emiForm = document.querySelector('form[data-calc="emi"]');
        if (emiForm) {
            bindCalculator(emiForm, function (form, out) {
                const principal = read(form, 'principal');
                const rate = read(form, 'rate');
                const months = Math.round(read(form, 'years') * 12);
                const s = loanSchedule(principal, rate, months);
                setText(out, 'emi', money(s.payment));
                setText(out, 'interest', money(s.totalInterest));
                setText(out, 'total', money(s.totalPaid));
                setText(out, 'months', num(months));
                const tbody = out.querySelector('tbody');
                tbody.innerHTML = '';
                s.years.forEach(y => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = '<th scope="row">' + y.year + '</th><td class="num">' + money(y.paid) + '</td><td class="num">'
                        + money(y.principal) + '</td><td class="num">' + money(y.interest) + '</td><td class="num">' + money(y.balance) + '</td>';
                    tbody.appendChild(tr);
                });
            });
        }

        const dieselForm = document.querySelector('form[data-calc="diesel"]');
        if (dieselForm) {
            bindCalculator(dieselForm, function (form, out) {
                const d = diesel(read(form, 'price'), read(form, 'kwhPerLitre'), read(form, 'hours') || 0, read(form, 'load') || 0);
                setText(out, 'perUnit', '₹' + d.perUnit.toFixed(2) + ' per unit');
                const tariff = read(form, 'tariff');
                setText(out, 'compare', isFinite(tariff) && tariff > 0
                    ? 'That is ' + (d.perUnit / tariff).toFixed(1) + ' times the grid rate you entered (₹' + tariff.toFixed(2) + ' per unit).'
                    : 'Enter your grid rate per unit to compare.');
                setText(out, 'monthly', d.unitsPerMonth > 0 ? money(d.costPerMonth) + ' a month' : 'Enter hours and load');
                setText(out, 'litres', d.unitsPerMonth > 0 ? num(d.litresPerMonth) + ' litres a month' : '–');
            });
        }

        document.querySelectorAll('[data-print]').forEach(btn => btn.addEventListener('click', () => window.print()));
    });
})();
