const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

function setup(response, rejection = false) {
    const elements = new Map();
    function element(id) {
        if (!elements.has(id)) elements.set(id, { value: '', dataset: {}, hidden: false, required: true, disabled: false, checked: false, name: id, handlers: {}, addEventListener(event, handler) { this.handlers[event] = handler; }, setAttribute() {}, setCustomValidity(value) { this.validation = value; }, focus() {} });
        return elements.get(id);
    }
    const form = element('hiring-form');
    form.action = 'https://api.web3forms.com/submit';
    form.elements = { botcheck: { checked: false } };
    form.reportValidity = () => true;
    element('mobile').value = '9666068140';
    element('alternate').disabled = true;
    element('role').value = 'Sales Executive';
    const choices = { languages: [{ name: 'Languages', value: 'Telugu' }, { name: 'Languages', value: 'English' }], 'work-types': [{ name: 'Work experience', value: 'Sales' }] };
    let calls = 0;
    let payload;
    const window = { location: { origin: 'https://ray2voltsolar.com', pathname: '/careers.html', search: '?utm_source=meta&gclid=test-click' } };
    const document = {
        getElementById: element,
        querySelector(selector) { return choices[selector.split(' ')[0].slice(1)]?.[0]; },
        querySelectorAll(selector) { return choices[selector.split(' ')[0].slice(1)] || []; }
    };
    const context = { document, window, Date, URL, URLSearchParams, AbortController, setTimeout, clearTimeout, FormData: class { *[Symbol.iterator]() { yield ['access_key', 'test']; yield ['Full name', 'TEST']; } }, fetch: async (_url, options) => { calls++; payload = JSON.parse(options.body); if (rejection) throw Error('offline'); return response; } };
    vm.runInNewContext(fs.readFileSync('careers.js', 'utf8'), context);
    return { submit: () => form.handlers.submit({ preventDefault() {} }), element, window, form, get calls() { return calls; }, get payload() { return payload; } };
}

test('confirmed submission emits exactly one recruitment event and preserves multi-select attribution', async () => {
    const app = setup({ ok: true, json: async () => ({ success: true }) });
    await app.submit();
    await app.submit();
    assert.equal(app.calls, 1);
    assert.equal(app.payload.Languages, 'Telugu, English');
    assert.equal(app.payload.utm_source, 'meta');
    assert.equal(app.payload.gclid, 'test-click');
    assert.equal(app.window.dataLayer.length, 1);
    assert.equal(app.window.dataLayer[0].event, 'job_application_submitted');
    assert.equal(JSON.stringify(app.window.dataLayer).includes('TEST'), false);
    assert.equal(app.form.hidden, true);
    assert.equal(app.element('application-success').hidden, false);
});

for (const [name, response, rejection] of [
    ['provider failure', { ok: false, json: async () => ({ success: false }) }, false],
    ['invalid JSON', { ok: true, json: async () => { throw Error('bad JSON'); } }, false],
    ['network failure', null, true],
    ['non-boolean success', { ok: true, json: async () => ({ success: 'true' }) }, false]
]) test(name + ' preserves answers and never reports conversion', async () => {
    const app = setup(response, rejection);
    await app.submit();
    assert.equal(app.form.hidden, false);
    assert.equal(app.element('apply-submit').disabled, false);
    assert.equal(app.element('application-status').dataset.state, 'error');
    assert.equal(app.window.dataLayer, undefined);
});

test('honeypot stops submission', async () => {
    const app = setup(null);
    app.form.elements.botcheck.checked = true;
    await app.submit();
    assert.equal(app.calls, 0);
});

test('resume rejects active schemes and embedded credentials', () => {
    const app = setup(null);
    const resume = app.element('resume');
    for (const value of ['javascript:alert(1)', 'https://user:pass@example.com/cv', 'not-a-url']) {
        resume.value = value;
        resume.handlers.input();
        assert.notEqual(resume.validation, '');
    }
    for (const value of ['', 'https://example.com/resume.pdf']) {
        resume.value = value;
        resume.handlers.input();
        assert.equal(resume.validation, '');
    }
});
