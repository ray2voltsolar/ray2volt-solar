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
    const customNote = Object.assign(element(), { hidden: true });
    const document = {
        readyState: 'complete',
        getElementById: id => ({ 'raycare-capacity': capacity, 'raycare-capacity-error': error }[id]),
        querySelector: selector => selector === '[data-raycare-estimator]' ? {} : null,
        querySelectorAll: selector => ({
            '[data-raycare-total]': totals,
            '[data-raycare-capacity-label]': [label],
            '[data-raycare-estimate-context]': [estimateContext],
            '[data-raycare-plan]': links,
            '[data-raycare-custom-note]': [customNote]
        }[selector] || [])
    };
    load(document, search);
    return { capacity, error, label, estimateContext, totals, links, customNote };
}

function enquiry(search = '', restored = {}) {
    const fields = Object.fromEntries([
        'sr-issue', 'sr-size', 'sr-raycare-plan', 'sr-raycare-fields', 'sr-raycare-note', 'sr-health-check-note', 'sr-message'
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

test('annual prices match the owner-approved quote sheet (29 Oct 2026), all + GST', () => {
    for (const [kwp, essential, plus, pro] of [
        ['3', 4000, 10000, 10000], ['5', 4000, 10000, 10000], ['10', 4000, 10000, 10000],
        ['20', 8000, 11000, 12000], ['50', 20000, 27500, 30000], ['100', 40000, 55000, 60000],
        ['250', 100000, 137500, 150000], ['500', 190000, 261250, 285000], ['750', 270000, 371250, 405000],
        ['1000', 350000, 481250, 525000]
    ]) {
        assert.deepEqual({ ...raycare.annualCosts(kwp) }, { essential, plus, pro }, kwp + ' kWp');
    }
    assert.deepEqual({ ...raycare.annualCosts('37.5') }, { essential: 15000, plus: 20625, pro: 22500 });
});

test('every site pays at least the plan minimum: Essential 4,000, Plus and Pro 10,000', () => {
    assert.deepEqual({ ...raycare.annualCosts('.125') }, { essential: 4000, plus: 10000, pro: 10000 });
    assert.deepEqual({ ...raycare.annualCosts('0.01') }, { essential: 4000, plus: 10000, pro: 10000 });
    // The per-kWp price takes over once it passes the minimum.
    assert.deepEqual({ ...raycare.annualCosts('10.5') }, { essential: 4200, plus: 10000, pro: 10000 });
    assert.deepEqual({ ...raycare.annualCosts('18.5') }, { essential: 7400, plus: 10175, pro: 11100 });
});

test('large-plant discount steps like tax slabs, so a bigger plant never pays less in total', () => {
    assert.deepEqual({ ...raycare.annualCosts('251') }, { essential: 100360, plus: 137995, pro: 150540 });
    assert.deepEqual({ ...raycare.annualCosts('501') }, { essential: 190320, plus: 261690, pro: 285480 });
    let previous = raycare.annualCosts('1');
    for (let kwp = 2; kwp <= 1000; kwp++) {
        const costs = raycare.annualCosts(String(kwp));
        for (const plan of ['essential', 'plus', 'pro']) assert.ok(costs[plan] >= previous[plan], plan + ' at ' + kwp);
        previous = costs;
    }
});

test('plants above 1 MW get a custom quote instead of a number', () => {
    for (const kwp of ['1000.01', '1200', '100000']) {
        const costs = raycare.annualCosts(kwp);
        assert.equal(costs.customQuote, true, kwp);
        assert.equal(costs.essential, undefined, kwp);
    }
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
    const page = estimator('?capacity=500');
    assert.equal(page.capacity.value, '500');
    assert.equal(page.label.textContent, '500 kWp');
    assert.deepEqual(page.totals.map(el => el.textContent), ['₹1,90,000', '₹2,61,250', '₹2,85,000']);
    assert.equal(page.error.hidden, true);
    assert.equal(page.customNote.hidden, true);
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
    assert.deepEqual(page.totals.map(el => el.textContent), ['₹4,000', '₹10,000', '₹10,000']);
});

test('above 1 MW the estimator says custom quote, shows the note and still passes plant size', () => {
    const page = estimator('?capacity=1200');
    assert.deepEqual(page.totals.map(el => el.textContent), ['Custom quote', 'Custom quote', 'Custom quote']);
    assert.equal(page.customNote.hidden, false);
    assert.equal(page.label.textContent, '1,200 kWp');
    assert.equal(page.links[2].getAttribute('href'), 'service-request.html?service=raycare&plan=pro&capacity=1200');
    page.capacity.value = '1000';
    page.capacity.emit('input');
    assert.deepEqual(page.totals.map(el => el.textContent), ['₹3,50,000', '₹4,81,250', '₹5,25,000']);
    assert.equal(page.customNote.hidden, true);
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

test('Health Check handoff selects its own request type and backend subject, without a plan', () => {
    const page = enquiry('?service=health-check&plan=pro&capacity=8');
    assert.equal(page['sr-issue'].value, 'Solar Health Check');
    assert.equal(page['sr-size'].value, '8 kWp');
    assert.equal(page['sr-raycare-plan'].value, '');
    assert.equal(page['sr-raycare-fields'].hidden, true);
    assert.equal(page['sr-raycare-plan'].disabled, true);
    assert.equal(page['sr-health-check-note'].hidden, false);
    assert.equal(page['sr-raycare-note'].hidden, true);
    assert.equal(page.subject.value, 'Solar Health Check Request - Ray2Volt Solar');
    assert.equal(page.sourcePage.value, 'RayCare Solar Health Check');
    page['sr-issue'].value = 'Warranty question';
    page['sr-issue'].emit('change');
    assert.equal(page['sr-health-check-note'].hidden, true);
    assert.equal(page.subject.value, 'Service Request - Ray2Volt Solar');
    const restored = enquiry('?service=health-check', { 'sr-issue': 'Warranty question' });
    assert.equal(restored['sr-issue'].value, 'Warranty question');
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
        const minimum = plan === 'essential' ? '₹4,000' : '₹10,000';
        assert.ok(card.includes('Minimum ' + minimum + ' a year per site + GST'), plan + ' static minimum fee');
        assert.ok(card.includes(visits + ' scheduled visits'), plan + ' static visit count');
        const output = html.match(new RegExp('data-raycare-total="' + plan + '"[^>]*>([^<]+)<'))?.[1];
        assert.equal(output, annual, plan + ' static 100 kWp estimate');
        const link = card.match(new RegExp('<a\\b[^>]*data-raycare-plan="' + plan + '"[^>]*>'))?.[0] || '';
        const href = attr(link, 'href')?.replace(/&amp;/g, '&');
        const params = new URL(href, 'https://ray2voltsolar.com/').searchParams;
        assert.equal(params.get('service'), 'raycare');
        assert.equal(params.get('plan'), plan, plan + ' no-JavaScript enquiry preserves the plan');
    }
    assert.match(html, /data-raycare-custom-note hidden/);
    for (const file of ['raycare.html', 'raycare-plans.html']) {
        const page = fs.readFileSync(path.join(root, file), 'utf8');
        // Ads quote these lines, so the landing pages must show them.
        assert.ok(page.includes('Plans from ₹400 per kWp a year + GST'), file + ' plan price line');
        assert.ok(page.includes('Solar Health Check from ₹999 + GST'), file + ' Health Check price line');
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

test('Health Check block shows every price + GST, the credit rule and the shared service-request route', () => {
    const html = fs.readFileSync(path.join(root, 'raycare.html'), 'utf8');
    const block = html.match(/<section\b[^>]*id="health-check"[\s\S]*?<\/section>/)?.[0] || '';
    for (const [size, price] of [['Up to 10 kWp', '₹999'], ['10–100 kWp', '₹2,999'], ['100–500 kWp', '₹4,999']]) {
        assert.match(block, new RegExp(size + '</span><strong>' + price + ' <small>\\+ GST</small>'), size);
    }
    assert.match(block, /Above 500 kWp and ground-mounted plants<\/span><strong>Quoted/);
    assert.match(block, /Existing Ray2Volt customers<\/span><strong>Free/);
    assert.match(block, /within 30 days/);
    assert.match(block, /not a guarantee/);
    assert.match(block, /href="service-request.html\?service=health-check"/);
    const form = fs.readFileSync(path.join(root, 'service-request.html'), 'utf8');
    assert.match(form, /<option>Solar Health Check<\/option>/);
    assert.match(form, /id="sr-health-check-note" hidden/);
});
