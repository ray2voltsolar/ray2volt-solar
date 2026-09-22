// C1 conversion gating: node --test tests/tracking.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

function storage(initial) {
    const data = new Map(Object.entries(initial || {}));
    return {
        getItem: key => (data.has(key) ? data.get(key) : null),
        setItem: (key, value) => data.set(key, String(value)),
        removeItem: key => data.delete(key),
        dump: () => Object.fromEntries(data)
    };
}

// Loads script.js with a stub page and runs only the tracking section's
// DOMContentLoaded handler, as a campaign thank-you page would.
function loadPage({ confirmation = '', session = {}, local = {}, search = '' } = {}) {
    const calls = [];
    const handlers = [];
    const context = {
        URL, URLSearchParams, Date, JSON, Math, Set, console,
        sessionStorage: storage(session),
        localStorage: storage(local),
        location: { href: 'https://ray2voltsolar.com/page.html' + search, search, hostname: 'ray2voltsolar.com', origin: 'https://ray2voltsolar.com' },
        crypto: { randomUUID: (() => { let n = 0; return () => `uuid-${++n}`; })() },
        document: {
            addEventListener: (type, handler) => { if (type === 'DOMContentLoaded') handlers.push(handler); },
            body: { getAttribute: name => (name === 'data-lead-confirmation' ? confirmation : null) },
            querySelectorAll: () => []
        },
        gtag: (...args) => calls.push(args)
    };
    context.window = context;
    vm.runInNewContext(fs.readFileSync('script.js', 'utf8'), context);
    const tracking = handlers.find(handler => handler.toString().includes('data-lead-confirmation'));
    assert.ok(tracking, 'tracking section registers a DOMContentLoaded handler');
    tracking();
    return {
        context,
        calls,
        conversions: () => calls.filter(args => args[0] === 'event' && args[1] === 'conversion'),
        events: name => calls.filter(args => args[0] === 'event' && args[1] === name)
    };
}

const token = (form, ageMs = 1000, id = 'lead-1') => JSON.stringify({ id, form, time: Date.now() - ageMs });

test('a direct visit to a thank-you page counts nothing', () => {
    for (const confirmation of ['thank-you', 'commercial-solar-thank-you']) {
        const page = loadPage({ confirmation });
        assert.equal(page.conversions().length, 0);
        assert.equal(page.events('generate_lead').length, 0);
    }
});

test('a form submitted this session counts exactly once, with its transaction_id', () => {
    const page = loadPage({ confirmation: 'thank-you', session: { r2vLeadToken: token('quote-form') } });
    const conversions = page.conversions();
    assert.equal(conversions.length, 1);
    assert.deepEqual({ ...conversions[0][2] }, { send_to: 'AW-18014889887/9NtXCImroaYcEJ_PlY5D', transaction_id: 'lead-1' });
    const leads = page.events('generate_lead');
    assert.equal(leads.length, 1);
    assert.equal(leads[0][2].form_id, 'quote-form');
    assert.equal(leads[0][2].send_to, 'G-WZJ1CXHSG9');
    assert.equal(page.context.sessionStorage.getItem('r2vLeadToken'), null);
    assert.deepEqual(JSON.parse(page.context.localStorage.getItem('r2vFiredLeadIds')), ['lead-1']);
});

test('a refresh, or the same lead in a new tab, counts nothing', () => {
    const first = loadPage({ confirmation: 'thank-you', session: { r2vLeadToken: token('contact-form') } });
    assert.equal(first.conversions().length, 1);
    const fired = first.context.localStorage.dump();
    // Refresh: the token was consumed.
    const refresh = loadPage({ confirmation: 'thank-you', local: fired });
    assert.equal(refresh.conversions().length, 0);
    // A copied session still holding the token: the ID has already fired.
    const copy = loadPage({ confirmation: 'thank-you', session: { r2vLeadToken: token('contact-form') }, local: fired });
    assert.equal(copy.conversions().length, 0);
});

test('a token older than 30 minutes counts nothing', () => {
    const page = loadPage({ confirmation: 'thank-you', session: { r2vLeadToken: token('quote-form', 31 * 60 * 1000) } });
    assert.equal(page.conversions().length, 0);
});

test('each thank-you page only counts its own forms', () => {
    const ciOnResidential = loadPage({ confirmation: 'thank-you', session: { r2vLeadToken: token('ci-estimate-form') } });
    assert.equal(ciOnResidential.conversions().length, 0);
    const newFormOnCampaignPage = loadPage({ confirmation: 'commercial-solar-thank-you', session: { r2vLeadToken: token('quote-check') } });
    assert.equal(newFormOnCampaignPage.conversions().length, 0);
    const ci = loadPage({ confirmation: 'commercial-solar-thank-you', session: { r2vLeadToken: token('ci-estimate-form', 5000, 'ci-7') } });
    assert.equal(ci.conversions().length, 1);
    assert.equal(ci.conversions()[0][2].transaction_id, 'ci-7');
});

test('pages without a confirmation attribute never send a conversion', () => {
    const page = loadPage({ session: { r2vLeadToken: token('quote-form') } });
    assert.equal(page.conversions().length, 0);
    assert.notEqual(page.context.sessionStorage.getItem('r2vLeadToken'), null);
});

test('newer forms report generate_lead and send no Ads conversion while their label is empty', () => {
    const page = loadPage();
    page.context.ray2voltTracking.reportLead('quote-check');
    assert.equal(page.conversions().length, 0);
    const leads = page.events('generate_lead');
    assert.equal(leads.length, 1);
    assert.equal(leads[0][2].form_id, 'quote-check');
});

test('secondary events go to GA4 only', () => {
    const page = loadPage();
    page.context.ray2voltTracking.sendEvent('click_to_call', { link_url: 'tel:+919666068140' });
    const [event] = page.events('click_to_call');
    assert.equal(event[2].send_to, 'G-WZJ1CXHSG9');
});
