(() => {
    'use strict';
    const form = document.getElementById('hiring-form');
    if (!form) return;
    const button = document.getElementById('apply-submit');
    const status = document.getElementById('application-status');
    const dob = document.getElementById('dob');
    const now = new Date();
    dob.max = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    let submitting = false;
    let submitted = false;
    button.disabled = false;

    const same = document.getElementById('whatsapp-same');
    const alternate = document.getElementById('alternate');
    same.addEventListener('change', () => {
        const needed = same.value === 'No';
        document.getElementById('alternate-wrap').hidden = !needed;
        alternate.disabled = !needed;
        alternate.required = needed;
        if (!needed) alternate.value = '';
    });

    function validatePhone(input) {
        const digits = input.value.replace(/[\s()+-]/g, '');
        input.setCustomValidity(!input.required && !input.value ? '' : /^(?:91)?[6-9]\d{9}$/.test(digits) ? '' : 'Enter a valid 10-digit Indian mobile number, optionally starting with +91.');
    }
    ['mobile', 'alternate'].forEach(id => {
        const input = document.getElementById(id);
        input.addEventListener('input', () => validatePhone(input));
    });
    const groups = ['languages', 'work-types'];
    groups.forEach(id => {
        document.getElementById(id).addEventListener('change', event => {
            if (id === 'work-types') {
                const boxes = [...document.querySelectorAll('#work-types input')];
                if (event.target.checked && event.target.value === 'None') boxes.forEach(box => { if (box !== event.target) box.checked = false; });
                else if (event.target.checked) boxes.find(box => box.value === 'None').checked = false;
            }
            document.getElementById(`${id}-error`).hidden = !!document.querySelector(`#${id} input:checked`);
        });
    });

    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (submitting || submitted) return;
        validatePhone(document.getElementById('mobile'));
        if (!alternate.disabled) validatePhone(alternate);
        const missingGroup = groups.find(id => {
            const missing = !document.querySelector(`#${id} input:checked`);
            document.getElementById(`${id}-error`).hidden = !missing;
            return missing;
        });
        if (!form.reportValidity()) return;
        if (missingGroup) {
            document.querySelector(`#${missingGroup} input`).focus();
            return;
        }
        if (form.elements.botcheck.checked) return;
        const payload = Object.fromEntries(new FormData(form));
        groups.forEach(id => {
            const boxes = [...document.querySelectorAll(`#${id} input:checked`)];
            payload[boxes[0].name] = boxes.map(box => box.value).join(', ');
        });
        const params = new URLSearchParams(window.location.search);
        ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','gclid','gbraid','wbraid','fbclid'].forEach(key => {
            const value = params.get(key);
            if (value) payload[key] = value.slice(0, 500);
        });
        payload['Page URL'] = window.location.origin + window.location.pathname;
        payload['Consent recorded at'] = new Date().toISOString();
        payload['subject'] = `New Hiring Application - ${document.getElementById('role').value}`;
        submitting = true;
        button.disabled = true;
        button.setAttribute('aria-busy', 'true');
        button.textContent = 'Submitting…';
        status.dataset.state = 'info';
        status.textContent = 'Sending your application. Please keep this page open.';
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);
        try {
            const response = await fetch(form.action, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify(payload),
                signal: controller.signal
            });
            const data = await response.json();
            if (!response.ok || data.success !== true) throw new Error('Submission not confirmed');
            submitted = true;
            form.hidden = true;
            const success = document.getElementById('application-success');
            success.hidden = false;
            success.focus();
            // A recruitment-only event; never reuse the solar customer lead conversion.
            window.dataLayer = window.dataLayer || [];
            window.dataLayer.push({ event: 'job_application_submitted', form_id: 'ray2volt_hiring' });
        } catch (error) {
            status.dataset.state = 'error';
            status.textContent = 'We could not confirm your application. Your answers are still here. Please try again, or email sales@ray2voltsolar.com for help. If you already received a confirmation, do not submit again.';
            status.focus();
        } finally {
            clearTimeout(timeout);
            submitting = false;
            button.disabled = submitted;
            button.setAttribute('aria-busy', 'false');
            button.textContent = 'Submit application';
        }
    });
})();
