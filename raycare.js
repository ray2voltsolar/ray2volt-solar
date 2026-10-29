/* RayCare estimates and enquiry context. The shared script.js owns form validation,
   spam guards and Web3Forms submission; this file never submits a request. */
(function () {
    'use strict';

    // Rates are per installed DC kWp per year; every site pays at least the minimum. All + GST.
    const PLANS = Object.freeze({
        essential: Object.freeze({ name: 'Essential', rate: 400, minimum: 4000 }),
        plus: Object.freeze({ name: 'Plus', rate: 550, minimum: 10000 }),
        pro: Object.freeze({ name: 'Pro', rate: 600, minimum: 10000 })
    });
    // Large-plant discount steps like tax slabs: each kWp is priced by the band it falls in.
    const BANDS = Object.freeze([
        Object.freeze({ upTo: 250, discount: 0 }),
        Object.freeze({ upTo: 500, discount: 10 }),
        Object.freeze({ upTo: Infinity, discount: 20 })
    ]);
    // Above 1 MW the price follows a site visit, so the estimator shows no number.
    const CUSTOM_QUOTE_ABOVE = 1000;
    const RAYCARE_ISSUE = 'RayCare maintenance enquiry';
    const HEALTH_CHECK_ISSUE = 'Solar Health Check';
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

    function steppedPrice(capacity, rate) {
        let price = 0;
        let from = 0;
        for (const band of BANDS) {
            const kwp = Math.min(capacity, band.upTo) - from;
            if (kwp <= 0) break;
            price += kwp * rate * (100 - band.discount) / 100;
            from = band.upTo;
        }
        return Math.round((price + Number.EPSILON) * 100) / 100;
    }

    // Returns null for an invalid capacity and { customQuote: true } above 1 MW.
    function annualCosts(value) {
        const capacity = parseCapacity(value);
        if (capacity === null) return null;
        if (capacity > CUSTOM_QUOTE_ABOVE) return Object.freeze({ customQuote: true });
        return Object.fromEntries(Object.entries(PLANS).map(([key, plan]) =>
            [key, Math.max(plan.minimum, steppedPrice(capacity, plan.rate))]));
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
        const service = params.get('service');
        if (service !== 'raycare' && service !== 'health-check') return null;
        const plan = params.get('plan');
        return {
            issue: service === 'health-check' ? HEALTH_CHECK_ISSUE : RAYCARE_ISSUE,
            plan: service === 'raycare' && planFor(plan) ? plan : null,
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
            const customQuote = Boolean(costs && costs.customQuote);
            document.querySelectorAll('[data-raycare-total]').forEach(output => {
                const plan = output.getAttribute('data-raycare-total');
                if (!planFor(plan)) return;
                output.textContent = !costs ? '—' : customQuote ? 'Custom quote' : money.format(costs[plan]);
            });
            document.querySelectorAll('[data-raycare-custom-note]').forEach(note => { note.hidden = !customQuote; });
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
        const healthNote = document.getElementById('sr-health-check-note');
        const subject = form.querySelector('[name="subject"]');
        const source = form.querySelector('[name="Source Page"]');
        if (!issue || !plan || !fields) return;
        const defaultSubject = subject ? subject.defaultValue : '';
        const defaultSource = source ? source.defaultValue : '';
        const context = enquiryContext(window.location.search);

        // Never replace restored or already entered customer details with URL values.
        if (context && !issue.value) issue.value = context.issue;
        if (context && issue.value === context.issue) {
            if (context.plan && !plan.value) plan.value = PLANS[context.plan].name;
            if (context.capacity !== null && size && !size.value) size.value = String(context.capacity) + ' kWp';
        }

        function update() {
            const isRayCare = issue.value === RAYCARE_ISSUE;
            const isHealthCheck = issue.value === HEALTH_CHECK_ISSUE;
            fields.hidden = !isRayCare;
            plan.disabled = !isRayCare;
            if (note) note.hidden = !isRayCare;
            if (healthNote) healthNote.hidden = !isHealthCheck;
            if (subject) {
                subject.value = isRayCare ? 'RayCare Maintenance Enquiry - Ray2Volt Solar'
                    : isHealthCheck ? 'Solar Health Check Request - Ray2Volt Solar' : defaultSubject;
            }
            if (source) {
                source.value = isRayCare ? 'RayCare service enquiry'
                    : isHealthCheck ? 'RayCare Solar Health Check' : defaultSource;
            }
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
