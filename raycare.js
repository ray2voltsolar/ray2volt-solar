/* RayCare estimates and enquiry context. The shared script.js owns form validation,
   spam guards and Web3Forms submission; this file never submits a request. */
(function () {
    'use strict';

    const PLANS = Object.freeze({
        essential: Object.freeze({ name: 'Essential', rate: 400 }),
        plus: Object.freeze({ name: 'Plus', rate: 550 }),
        pro: Object.freeze({ name: 'Pro', rate: 600 })
    });
    const RAYCARE_ISSUE = 'RayCare maintenance enquiry';
    const money = new Intl.NumberFormat('en-IN', {
        style: 'currency', currency: 'INR', maximumFractionDigits: 2, minimumFractionDigits: 0
    });
    const capacityNumber = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 20 });

    function parseCapacity(value) {
        if (typeof value !== 'string' && typeof value !== 'number') return null;
        const text = String(value).trim();
        // Accept plain decimal kWp only: reject units, exponent notation and partial numbers.
        if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) return null;
        const capacity = Number(text);
        return Number.isFinite(capacity) && capacity >= 0.01 && capacity <= 100000 ? capacity : null;
    }

    function planFor(value) {
        return Object.prototype.hasOwnProperty.call(PLANS, value) ? PLANS[value] : null;
    }

    function annualCosts(value) {
        const capacity = parseCapacity(value);
        if (capacity === null) return null;
        return Object.fromEntries(Object.entries(PLANS).map(([key, plan]) =>
            [key, Math.round((capacity * plan.rate + Number.EPSILON) * 100) / 100]));
    }

    function enquiryUrl(plan, value) {
        const params = new URLSearchParams({ service: 'raycare' });
        if (planFor(plan)) params.set('plan', plan);
        const capacity = parseCapacity(value);
        if (capacity !== null) params.set('capacity', String(capacity));
        return 'service-request.html?' + params.toString();
    }

    function enquiryContext(search) {
        const params = new URLSearchParams(search);
        if (params.get('service') !== 'raycare') return null;
        const plan = params.get('plan');
        return {
            plan: planFor(plan) ? plan : null,
            capacity: parseCapacity(params.get('capacity'))
        };
    }

    function initEstimator() {
        const estimator = document.querySelector('[data-raycare-estimator]');
        if (!estimator) return;
        const input = document.getElementById('raycare-capacity');
        const error = document.getElementById('raycare-capacity-error');
        if (!input) return;

        const initialCapacity = parseCapacity(new URLSearchParams(window.location.search).get('capacity'));
        // The default is a worked example, so never send it as the customer's plant size.
        let capacityConfirmed = initialCapacity !== null || input.value !== input.defaultValue;
        // The browser may have restored a visitor's edit on Back; keep it.
        if (initialCapacity !== null && input.value === input.defaultValue) input.value = String(initialCapacity);

        function update(showError) {
            const capacity = parseCapacity(input.value);
            const costs = annualCosts(capacity);
            const invalid = capacity === null;
            if (invalid && showError) input.setAttribute('aria-invalid', 'true');
            else input.removeAttribute('aria-invalid');
            if (error) {
                error.hidden = !invalid || !showError;
                error.textContent = 'Enter a capacity from 0.01 to 1,00,000 kWp.';
            }
            document.querySelectorAll('[data-raycare-total]').forEach(output => {
                const plan = output.getAttribute('data-raycare-total');
                if (planFor(plan)) output.textContent = costs ? money.format(costs[plan]) : '—';
            });
            document.querySelectorAll('[data-raycare-capacity-label]').forEach(label => {
                label.textContent = invalid ? 'your plant' : capacityNumber.format(capacity) + ' kWp';
            });
            document.querySelectorAll('[data-raycare-estimate-context]').forEach(label => {
                label.textContent = capacityConfirmed ? 'Annual plan price for' : 'Example annual plan price for';
            });
            document.querySelectorAll('[data-raycare-plan]').forEach(link => {
                link.setAttribute('href', enquiryUrl(link.getAttribute('data-raycare-plan'), capacityConfirmed ? capacity : null));
            });
        }

        function onEdit() {
            capacityConfirmed = true;
            update(true);
        }
        input.addEventListener('input', onEdit);
        input.addEventListener('change', onEdit);
        update(false);
    }

    function initEnquiry() {
        const form = document.querySelector('form[data-r2v-form="service-request"]');
        if (!form) return;
        const issue = document.getElementById('sr-issue');
        const size = document.getElementById('sr-size');
        const plan = document.getElementById('sr-raycare-plan');
        const fields = document.getElementById('sr-raycare-fields');
        const note = document.getElementById('sr-raycare-note');
        const subject = form.querySelector('[name="subject"]');
        const source = form.querySelector('[name="Source Page"]');
        if (!issue || !plan || !fields) return;
        const defaultSubject = subject ? subject.defaultValue : '';
        const defaultSource = source ? source.defaultValue : '';
        const context = enquiryContext(window.location.search);

        // Never replace restored or already entered customer details with URL values.
        if (context && !issue.value) issue.value = RAYCARE_ISSUE;
        if (context && issue.value === RAYCARE_ISSUE) {
            if (context.plan && !plan.value) plan.value = PLANS[context.plan].name;
            if (context.capacity !== null && size && !size.value) size.value = String(context.capacity) + ' kWp';
        }

        function update() {
            const isRayCare = issue.value === RAYCARE_ISSUE;
            fields.hidden = !isRayCare;
            plan.disabled = !isRayCare;
            if (note) note.hidden = !isRayCare;
            if (subject) subject.value = isRayCare ? 'RayCare Maintenance Enquiry - Ray2Volt Solar' : defaultSubject;
            if (source) source.value = isRayCare ? 'RayCare service enquiry' : defaultSource;
        }

        issue.addEventListener('change', update);
        update();
    }

    // Pure functions are exposed for focused tests, like the site's other calculators.
    window.r2vRayCare = Object.freeze({ parseCapacity, annualCosts, enquiryUrl, enquiryContext });
    if (typeof document === 'undefined') return;
    const init = () => { initEstimator(); initEnquiry(); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
