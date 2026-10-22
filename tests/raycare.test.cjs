// RayCare pricing and safe enquiry handoff: node --test tests/raycare.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'raycare.js'), 'utf8');

function load(document, search = '') {
    const context = { URLSearchParams, Intl, document, location: { search } };
    context.window = context;
    vm.runInNewContext(source, context);
    return context.r2vRayCare;
}

function element(value = '', attributes = {}) {
    return {
        value, defaultValue: value, textContent: '', hidden: false, disabled: false,
        attributes: { ...attributes }, handlers: {},
        setAttribute(key, value) { this.attributes[key] = value; },
        getAttribute(key) { return this.attributes[key] ?? null; },
        removeAttribute(key) { delete this.attributes[key]; },
        addEventListener(event, handler) { this.handlers[event] = handler; },
        emit(event) { this.handlers[event]?.(); }
    };
}

function estimator(search = '', restoredCapacity) {
    const capacity = element('100');
    if (restoredCapacity !== undefined) capacity.value = restoredCapacity;
    const error = element();
    const label = element();
    const estimateContext = element();
    const totals = ['essential', 'plus', 'pro'].map(plan => element('', { 'data-raycare-total': plan }));
    const links = ['essential', 'plus', 'pro'].map(plan => element('', { 'data-raycare-plan': plan }));
    const document = {
        readyState: 'complete',
        getElementById: id => ({ 'raycare-capacity': capacity, 'raycare-capacity-error': error }[id]),
        querySelector: selector => selector === '[data-raycare-estimator]' ? {} : null,
        querySelectorAll: selector => ({
            '[data-raycare-total]': totals,
            '[data-raycare-capacity-label]': [label],
            '[data-raycare-estimate-context]': [estimateContext],
            '[data-raycare-plan]': links
        }[selector] || [])
    };
    load(document, search);
    return { capacity, error, label, estimateContext, totals, links };
}

function enquiry(search = '', restored = {}) {
    const fields = Object.fromEntries([
        'sr-issue', 'sr-size', 'sr-raycare-plan', 'sr-raycare-fields', 'sr-raycare-note', 'sr-message'
    ].map(id => [id, element(restored[id] || '')]));
    const subject = element('Service Request - Ray2Volt Solar');
    const sourcePage = element('Request a Service Visit');
    const form = {
        querySelector: selector => ({ '[name="subject"]': subject, '[name="Source Page"]': sourcePage }[selector])
    };
    const document = {
        readyState: 'complete',
        getElementById: id => fields[id],
        querySelector: selector => selector === 'form[data-r2v-form="service-request"]' ? form : null,
        querySelectorAll: () => []
    };
    load(document, search);
    return { ...fields, subject, sourcePage };
}

const raycare = load();

test('all three annual prices scale by installed DC capacity, including decimals', () => {
    assert.deepEqual({ ...raycare.annualCosts('100') }, { essential: 40000, plus: 55000, pro: 60000 });
    assert.deepEqual({ ...raycare.annualCosts('37.5') }, { essential: 15000, plus: 20625, pro: 22500 });
    assert.deepEqual({ ...raycare.annualCosts('.125') }, { essential: 50, plus: 68.75, pro: 75 });
    assert.deepEqual({ ...raycare.annualCosts('0.01') }, { essential: 4, plus: 5.5, pro: 6 });
});

test('empty, non-finite, malformed and out-of-range capacities never produce estimates', () => {
    for (const value of ['', ' ', null, undefined, false, [], {}, '0', '-10', '0.001', '100000.01', Infinity,
        NaN, 'Infinity', '1e5', '0x100', '100kWp', '100,000', '<script>alert(1)</script>']) {
        assert.equal(raycare.parseCapacity(value), null, String(value));
        assert.equal(raycare.annualCosts(value), null, String(value));
    }
    assert.equal(raycare.parseCapacity(' 37.50 '), 37.5);
    assert.equal(raycare.parseCapacity('100000'), 100000);
});

test('enquiry URLs carry only allowlisted plan and valid normalized capacity', () => {
    const params = new URL(raycare.enquiryUrl('plus', '037.50'), 'https://ray2voltsolar.com/').searchParams;
    assert.equal(params.get('service'), 'raycare');
    assert.equal(params.get('plan'), 'plus');
    assert.equal(params.get('capacity'), '37.5');
    for (const invalid of ['__proto__', 'constructor', 'pro&capacity=999', '<img src=x>', '', null]) {
        assert.equal(raycare.enquiryUrl(invalid, '-1'), 'service-request.html?service=raycare');
    }
});

test('query context requires RayCare service and rejects arbitrary values', () => {
    assert.equal(raycare.enquiryContext('?plan=pro&capacity=100'), null);
    assert.equal(raycare.enquiryContext('?service=repairs&plan=pro&capacity=100'), null);
    const good = raycare.enquiryContext('?service=raycare&plan=essential&capacity=37.5');
    assert.equal(good.plan, 'essential');
    assert.equal(good.capacity, 37.5);
    for (const plan of ['constructor', '__proto__', '<img src=x onerror=alert(1)>']) {
        const bad = raycare.enquiryContext('?service=raycare&plan=' + encodeURIComponent(plan) + '&capacity=Infinity');
        assert.equal(bad.plan, null);
        assert.equal(bad.capacity, null);
    }
});

test('estimator renders Indian currency, updates every plan and passes enquiry context', () => {
    const page = estimator('?capacity=1250.5');
    assert.equal(page.capacity.value, '1250.5');
    assert.equal(page.label.textContent, '1,250.5 kWp');
    assert.deepEqual(page.totals.map(el => el.textContent), ['₹5,00,200', '₹6,87,775', '₹7,50,300']);
    assert.equal(page.error.hidden, true);
    page.capacity.value = '37.5';
    page.capacity.emit('input');
    assert.deepEqual(page.totals.map(el => el.textContent), ['₹15,000', '₹20,625', '₹22,500']);
    assert.equal(page.links[1].getAttribute('href'), 'service-request.html?service=raycare&plan=plus&capacity=37.5');
});

test('invalid input removes stale estimates and capacities; correcting it restores all results', () => {
    const page = estimator();
    page.capacity.value = '';
    page.capacity.emit('input');
    assert.equal(page.capacity.getAttribute('aria-invalid'), 'true');
    assert.equal(page.error.hidden, false);
    assert.deepEqual(page.totals.map(el => el.textContent), ['—', '—', '—']);
    assert.equal(page.label.textContent, 'your plant');
    for (const link of page.links) assert.ok(!link.getAttribute('href').includes('capacity='));
    page.capacity.value = '0.125';
    page.capacity.emit('input');
    assert.equal(page.capacity.getAttribute('aria-invalid'), null);
    assert.equal(page.error.hidden, true);
    assert.deepEqual(page.totals.map(el => el.textContent), ['₹50', '₹68.75', '₹75']);
});

test('malformed incoming estimator capacity keeps the useful default without displaying an initial error', () => {
    const page = estimator('?capacity=%3Cscript%3Ealert(1)%3C/script%3E');
    assert.equal(page.capacity.value, '100');
    assert.deepEqual(page.totals.map(el => el.textContent), ['₹40,000', '₹55,000', '₹60,000']);
    assert.equal(page.error.hidden, true);
    assert.equal(page.estimateContext.textContent, 'Example annual plan price for');
    for (const link of page.links) assert.ok(!link.getAttribute('href').includes('capacity='));
});

test('untouched 100 kWp example never becomes customer capacity; deliberate edits and valid context do', () => {
    const page = estimator();
    assert.equal(page.estimateContext.textContent, 'Example annual plan price for');
    for (const link of page.links) assert.ok(!link.getAttribute('href').includes('capacity='));
    page.capacity.value = '100';
    page.capacity.emit('change');
    assert.equal(page.estimateContext.textContent, 'Annual plan price for');
    for (const link of page.links) assert.ok(link.getAttribute('href').includes('capacity=100'));
    const explicit = estimator('?capacity=100');
    assert.equal(explicit.estimateContext.textContent, 'Annual plan price for');
    for (const link of explicit.links) assert.ok(link.getAttribute('href').includes('capacity=100'));
    const restored = estimator('', '82.5');
    for (const link of restored.links) assert.ok(link.getAttribute('href').includes('capacity=82.5'));
});

test('RayCare handoff prefills actual form controls and maintains the existing backend subject fields', () => {
    const page = enquiry('?service=raycare&plan=pro&capacity=37.5');
    assert.equal(page['sr-issue'].value, 'RayCare maintenance enquiry');
    assert.equal(page['sr-raycare-plan'].value, 'Pro');
    assert.equal(page['sr-size'].value, '37.5 kWp');
    assert.equal(page['sr-raycare-fields'].hidden, false);
    assert.equal(page['sr-raycare-plan'].disabled, false);
    assert.equal(page['sr-raycare-note'].hidden, false);
    assert.equal(page.subject.value, 'RayCare Maintenance Enquiry - Ray2Volt Solar');
    assert.equal(page.sourcePage.value, 'RayCare service enquiry');
});

test('switching request types keeps customer edits and removes RayCare plan from unrelated submissions', () => {
    const page = enquiry('?service=raycare&plan=pro&capacity=100');
    page['sr-size'].value = '95 kWp';
    page['sr-issue'].value = 'Warranty question';
    page['sr-issue'].emit('change');
    assert.equal(page['sr-raycare-fields'].hidden, true);
    assert.equal(page['sr-raycare-plan'].disabled, true);
    assert.equal(page['sr-raycare-note'].hidden, true);
    assert.equal(page.subject.value, 'Service Request - Ray2Volt Solar');
    assert.equal(page.sourcePage.value, 'Request a Service Visit');
    assert.equal(page['sr-size'].value, '95 kWp');
    page['sr-issue'].value = 'RayCare maintenance enquiry';
    page['sr-issue'].emit('change');
    assert.equal(page['sr-raycare-plan'].value, 'Pro');
    assert.equal(page['sr-raycare-plan'].disabled, false);
    assert.equal(page['sr-size'].value, '95 kWp');
});

test('restored visitor entries take precedence over URL details', () => {
    const page = enquiry('?service=raycare&plan=pro&capacity=100', {
        'sr-issue': 'RayCare maintenance enquiry', 'sr-raycare-plan': 'Plus',
        'sr-size': '82.5 kWp', 'sr-message': 'Please call after 4 pm.'
    });
    assert.equal(page['sr-raycare-plan'].value, 'Plus');
    assert.equal(page['sr-size'].value, '82.5 kWp');
    assert.equal(page['sr-message'].value, 'Please call after 4 pm.');
    const ordinary = enquiry('?service=raycare&plan=pro&capacity=100', { 'sr-issue': 'Warranty question' });
    assert.equal(ordinary['sr-issue'].value, 'Warranty question');
    assert.equal(ordinary['sr-size'].value, '');
    assert.equal(ordinary['sr-raycare-plan'].value, '');
    assert.equal(ordinary['sr-raycare-plan'].disabled, true);
});

test('ordinary service request remains neutral; malformed RayCare inputs cannot populate customer fields', () => {
    const ordinary = enquiry('?plan=pro&capacity=100');
    assert.equal(ordinary['sr-issue'].value, '');
    assert.equal(ordinary['sr-size'].value, '');
    assert.equal(ordinary['sr-raycare-plan'].value, '');
    assert.equal(ordinary['sr-raycare-fields'].hidden, true);
    const bad = enquiry('?service=raycare&plan=__proto__&capacity=%3Cimg%20src=x%3E');
    assert.equal(bad['sr-issue'].value, 'RayCare maintenance enquiry');
    assert.equal(bad['sr-raycare-plan'].value, '');
    assert.equal(bad['sr-size'].value, '');
});

test('service enquiry keeps the shared guarded lead form, required contact fields and original success route', () => {
    const html = fs.readFileSync(path.join(root, 'service-request.html'), 'utf8');
    assert.equal((html.match(/data-r2v-form="service-request"/g) || []).length, 1);
    assert.match(html, /name="botcheck"/);
    assert.match(html, /id="sr-phone"[^>]*required/);
    assert.match(html, /id="sr-name"[^>]*required/);
    assert.match(html, /id="sr-town"[^>]*required/);
    assert.match(html, /data-success-for="service-request"/);
    assert.match(html, /<script src="script.js"><\/script>\s*<script src="raycare.js"><\/script>/);
    assert.doesNotMatch(source, /\bfetch\s*\(|\.innerHTML\s*=/);
});

test('RayCare is reachable from every English production navigation and footer, including nested blog pages', () => {
    const pages = ['', 'blog'].flatMap(directory => fs.readdirSync(path.join(root, directory))
        .filter(name => name.endsWith('.html') && !name.startsWith('_'))
        .map(name => path.join(directory, name)));
    for (const page of pages) {
        const html = fs.readFileSync(path.join(root, page), 'utf8');
        // Redirect stubs, such as ray2volt-3d.html, forward at once and have no menus
        if (/<meta http-equiv="refresh"/i.test(html)) continue;
        const header = html.match(/<header\b[\s\S]*?<\/header>/i)?.[0] || '';
        const footer = html.match(/<footer\b[\s\S]*?<\/footer>/i)?.[0] || '';
        const expectedPrefix = path.dirname(page) === '.' ? '' : '../';
        for (const [area, fragment, targets] of [
            ['navigation', header, ['raycare.html']],
            ['footer', footer, ['raycare.html', 'raycare-plans.html']]
        ]) {
            // Campaign pages retain their dedicated footer or omit it entirely.
            if (area === 'footer' && !/\bfooter-grid--5\b/.test(footer)) continue;
            const hrefs = [...fragment.matchAll(/<a\b[^>]*href="([^"]+)"/gi)].map(match => match[1]);
            for (const target of targets) {
                const expected = expectedPrefix + target;
                assert.ok(hrefs.includes(expected), `${page} ${area} links to ${expected}`);
                const resolved = new URL(expected, 'https://ray2voltsolar.com/' + page.replace(/\\/g, '/'));
                assert.equal(resolved.pathname, '/' + target, `${page} ${area} resolves to the root RayCare page`);
            }
        }
    }
});

test('homepage has a RayCare content entry and both RayCare pages are discoverable in the sitemap', () => {
    const home = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const content = home.replace(/<header\b[\s\S]*?<\/header>/gi, '').replace(/<footer\b[\s\S]*?<\/footer>/gi, '');
    assert.match(content, /<a\b[^>]*href="raycare.html"/);
    const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
    for (const name of ['raycare.html', 'raycare-plans.html']) {
        assert.ok(sitemap.includes('<loc>https://ray2voltsolar.com/' + name + '</loc>'), name + ' in sitemap');
    }
});

test('published pricing markup matches the calculator contract and stays useful without JavaScript', () => {
    const html = fs.readFileSync(path.join(root, 'raycare-plans.html'), 'utf8');
    const attr = (tag, name) => tag.match(new RegExp('\\b' + name + '="([^"]*)"'))?.[1];
    const input = html.match(/<input\b[^>]*id="raycare-capacity"[^>]*>/)?.[0] || '';
    assert.equal(attr(input, 'type'), 'number');
    assert.equal(attr(input, 'min'), '0.01');
    assert.equal(attr(input, 'max'), '100000');
    assert.equal(attr(input, 'step'), 'any');
    assert.equal(attr(input, 'value'), '100');
    assert.ok(attr(input, 'aria-describedby').split(/\s+/).includes('raycare-capacity-error'));
    assert.match(html, /<[^>]*id="raycare-capacity-error"[^>]*\bhidden\b/);
    assert.match(html, /aria-live="polite"/);
    assert.match(html, /data-raycare-estimate-context>Example annual plan price for</);
    assert.match(html, /<noscript>[\s\S]*100 kWp[\s\S]*<\/noscript>/);

    for (const [plan, rate, visits, annual] of [
        ['essential', 400, 4, '₹40,000'], ['plus', 550, 12, '₹55,000'], ['pro', 600, 12, '₹60,000']
    ]) {
        const card = html.match(new RegExp('<article\\b[^>]*id="' + plan + '"[\\s\\S]*?<\\/article>'))?.[0] || '';
        assert.ok(card.includes('₹' + rate), plan + ' static annual rate');
        assert.ok(card.includes(visits + ' scheduled visits'), plan + ' static visit count');
        const output = html.match(new RegExp('data-raycare-total="' + plan + '"[^>]*>([^<]+)<'))?.[1];
        assert.equal(output, annual, plan + ' static 100 kWp estimate');
        const link = card.match(new RegExp('<a\\b[^>]*data-raycare-plan="' + plan + '"[^>]*>'))?.[0] || '';
        const href = attr(link, 'href')?.replace(/&amp;/g, '&');
        const params = new URL(href, 'https://ray2voltsolar.com/').searchParams;
        assert.equal(params.get('service'), 'raycare');
        assert.equal(params.get('plan'), plan, plan + ' no-JavaScript enquiry preserves the plan');
    }
    for (const file of ['raycare.html', 'raycare-plans.html']) {
        const page = fs.readFileSync(path.join(root, file), 'utf8');
        assert.match(page, /<script src="script.js"><\/script>\s*<script src="raycare.js"><\/script>/);
        assert.match(page, /<link rel="stylesheet" href="raycare.css">/);
    }
});

function submissionFixture({ response = true, reject = false } = {}) {
    const byId = {};
    function control(id, name, value, type = 'text', required = false) {
        const field = Object.assign(element(value), {
            id, name, type, required, checked: false, tagName: type === 'select' ? 'SELECT' : 'INPUT',
            style: {}, dataset: {}, focus() { this.focused = true; }
        });
        const group = { querySelector: () => null, appendChild() {} };
        field.closest = () => group;
        if (id) byId[id] = field;
        return field;
    }
    const fields = [
        control('', 'access_key', 'mock-access-key', 'hidden'),
        control('', 'subject', 'Service Request - Ray2Volt Solar', 'hidden'),
        control('', 'Source Page', 'Request a Service Visit', 'hidden'),
        control('', 'botcheck', '', 'checkbox'),
        control('sr-name', 'Name', 'RayCare Test', 'text', true),
        control('sr-phone', 'Phone Number', '9999999999', 'tel', true),
        control('sr-town', 'Town', 'Tirupati', 'select', true),
        control('sr-size', 'System Size', ''),
        control('sr-issue', 'Issue Type', '', 'select', true),
        control('sr-raycare-plan', 'RayCare Plan', '', 'select'),
        control('sr-message', 'Message', 'Synthetic test; never sent to a real endpoint.')
    ];
    byId['sr-raycare-fields'] = element();
    byId['sr-raycare-note'] = element();
    const submitButton = Object.assign(element(), { innerHTML: 'Send service request' });
    const success = Object.assign(element(), { hidden: true, focus() { this.focused = true; } });
    const form = Object.assign(element('', { 'data-r2v-form': 'service-request' }), {
        dataset: {}, elements: fields, children: [],
        appendChild(child) { this.children.push(child); },
        querySelectorAll(selector) { return selector === 'input, select, textarea' ? fields : []; },
        querySelector(selector) {
            if (selector === '[type="submit"]') return submitButton;
            if (selector === '.form-submit-status') return this.children.find(el => el.className === 'form-submit-status');
            const name = selector.match(/\[name="([^"]+)"\]/)?.[1];
            return name ? fields.find(field => field.name === name) : null;
        }
    });
    fields.forEach(field => { field.form = form; });
    const document = {
        readyState: 'complete',
        getElementById: id => byId[id] || null,
        createElement: () => Object.assign(element(), { style: {} }),
        querySelector(selector) {
            if (selector === 'form[data-r2v-form="service-request"]') return form;
            if (selector === '[data-success-for="service-request"]') return success;
            return null;
        },
        querySelectorAll: selector => selector === 'form[data-r2v-form]' ? [form] : []
    };
    let now = 1000;
    const requests = [];
    const leads = [];
    const search = '?service=raycare&plan=plus&capacity=37.5';
    const context = {
        URL, URLSearchParams, Intl, document, Date: { now: () => now },
        location: { search, href: 'https://ray2voltsolar.com/service-request.html' + search },
        sessionStorage: { getItem: () => null },
        ray2voltCampaign: { params: { utm_source: 'raycare-test' }, landingPage: 'https://ray2voltsolar.com/raycare-plans.html' },
        ray2voltTracking: { reportLead: id => leads.push(id) },
        FormData: class {
            constructor(target) { this.target = target; }
            *entries() {
                for (const field of this.target.elements) {
                    if (!field.name || field.disabled || (field.type === 'checkbox' && !field.checked)) continue;
                    yield [field.name, field.value];
                }
            }
        },
        fetch: async (url, options) => {
            requests.push({ url, payload: JSON.parse(options.body) });
            if (reject) throw new Error('Mock network failure');
            return { ok: response, json: async () => ({ success: response }) };
        }
    };
    context.window = context;
    // Execute the actual shared form subsystem, excluding unrelated navigation and WhatsApp UI.
    // Its validation, spam guards, FormData serialization and promise handling are unmodified.
    const shared = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
    const start = shared.indexOf('    const contactForm =');
    const end = shared.indexOf('    const revealElements =');
    assert.ok(start >= 0 && end > start, 'shared form subsystem can be loaded');
    vm.runInNewContext('(function () {\n' + shared.slice(start, end) + '\n})();', context);
    vm.runInNewContext(source, context);
    return {
        form, fields: byId, success, submitButton, requests, leads,
        async submit() {
            now += 5000;
            form.handlers.submit({ preventDefault() {} });
            await new Promise(resolve => setImmediate(resolve));
        }
    };
}

test('shared Web3Forms handler receives RayCare details and hides the form only on confirmed success (mock network)', async () => {
    const page = submissionFixture();
    await page.submit();
    assert.equal(page.requests.length, 1);
    assert.equal(page.requests[0].url, 'https://api.web3forms.com/submit');
    const payload = page.requests[0].payload;
    assert.equal(payload['Issue Type'], 'RayCare maintenance enquiry');
    assert.equal(payload['RayCare Plan'], 'Plus');
    assert.equal(payload['System Size'], '37.5 kWp');
    assert.equal(payload.subject, 'RayCare Maintenance Enquiry - Ray2Volt Solar');
    assert.equal(payload['Source Page'], 'RayCare service enquiry');
    assert.equal(payload.form_id, 'service-request');
    assert.equal(payload.utm_source, 'raycare-test');
    assert.equal(payload['Landing Page URL'], 'https://ray2voltsolar.com/raycare-plans.html');
    assert.equal(page.form.hidden, true);
    assert.equal(page.success.hidden, false);
    assert.equal(page.success.focused, true);
    assert.deepEqual(page.leads, ['service-request']);
    await page.submit();
    assert.equal(page.requests.length, 1, 'duplicate submission guard still applies');
});

for (const failure of [{ response: false }, { reject: true }]) {
    test('shared provider failure preserves RayCare answers and allows retry: ' + JSON.stringify(failure), async () => {
        const page = submissionFixture(failure);
        await page.submit();
        assert.equal(page.requests.length, 1);
        assert.equal(page.form.hidden, false);
        assert.equal(page.success.hidden, true);
        assert.equal(page.fields['sr-raycare-plan'].value, 'Plus');
        assert.equal(page.fields['sr-size'].value, '37.5 kWp');
        assert.equal(page.submitButton.disabled, false);
        assert.equal(page.form.dataset.r2vSubmitting, 'false');
        assert.deepEqual(page.leads, []);
        assert.match(page.form.children[0].textContent, /could not send/);
    });
}

test('shared required-field validation prevents incomplete RayCare enquiries from being posted', async () => {
    const page = submissionFixture();
    page.fields['sr-name'].value = '';
    await page.submit();
    assert.equal(page.requests.length, 0);
    assert.equal(page.fields['sr-name'].getAttribute('aria-invalid'), 'true');
    assert.equal(page.form.hidden, false);
    assert.equal(page.success.hidden, true);
});
