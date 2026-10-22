// The energy-flow scenes and the before-and-after bill: node --test tests/visuals.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const pages = fs.readdirSync(root).filter(name => name.endsWith('.html'));

// Pull an object literal or a block of code out of a script, as the widgets
// keep their data private inside an IIFE
function literal(source, start) {
    const from = source.indexOf('{', source.indexOf(start));
    let depth = 0;
    let quote = null;
    for (let i = from; i < source.length; i++) {
        const ch = source[i];
        if (quote) {
            if (ch === '\\') i++;
            else if (ch === quote) quote = null;
        } else if (ch === '\'' || ch === '"' || ch === '`') {
            quote = ch;
        } else if (ch === '{') {
            depth++;
        } else if (ch === '}' && --depth === 0) {
            return source.slice(from, i + 1);
        }
    }
    throw new Error('no literal after ' + start);
}

const flowSource = read('energy-flow.js');
const billSource = read('bill-story.js');
const SCENARIOS = new Function('return (' + literal(flowSource, 'const SCENARIOS = ') + ');')();

function billMaths() {
    const block = billSource.slice(billSource.indexOf('    const MONTHS = '), billSource.indexOf('    const COPY = '));
    const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
    const money = n => (n < -0.5 ? '−₹' : '₹') + inr.format(Math.abs(Math.round(n)));
    const count = n => inr.format(Math.round(n));
    const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
    return new Function('money', 'count', 'clamp', block + 'return { home, business, yearTotals, HOME, BUSINESS, MONTHS };')(money, count, clamp);
}

for (const page of pages) test(`${page} loads what its solar visuals need`, () => {
    const html = read(page);
    const hasFlow = /\bdata-energy-flow\b/.test(html);
    const hasBill = /\bdata-bill-story\b/.test(html);
    const css = html.indexOf('href="solar-visuals.css"');
    const flowJs = html.indexOf('<script src="energy-flow.js" defer></script>');
    const billJs = html.indexOf('<script src="bill-story.js" defer></script>');

    assert.equal(css !== -1, hasFlow || hasBill, 'solar-visuals.css only where a visual is used');
    assert.equal(flowJs !== -1, hasFlow, 'energy-flow.js only where a scene is used');
    assert.equal(billJs !== -1, hasBill, 'bill-story.js only where a bill is used');
    if (css !== -1) {
        // The visuals restyle tokens from theme.css and home.css, so they load last
        assert.ok(css > html.indexOf('href="theme.css"'), 'after theme.css');
        if (html.includes('href="home.css"')) assert.ok(css > html.indexOf('href="home.css"'), 'after home.css');
    }
    const site = html.indexOf('<script src="script.js" defer></script>');
    if (flowJs !== -1) assert.ok(flowJs > site, 'energy-flow.js follows script.js');
    if (billJs !== -1) assert.ok(billJs > site, 'bill-story.js follows script.js');
});

// Where a page has both, the bill comes straight after the hero, then the scene
for (const page of pages.filter(name => /\bdata-bill-story\b/.test(read(name)) && /\bdata-energy-flow\b/.test(read(name)))) {
    test(`${page} opens with the hero, then the bill, then the energy-flow scene`, () => {
        const html = read(page);
        const opens = [...html.matchAll(/<section\b[^>]*>/g)];
        const at = id => opens.findIndex(match => match[0].includes(`id="${id}"`));
        const bill = at('bill-savings');
        const lead = opens.slice(0, bill).map((match, i) => html.slice(match.index, opens[i + 1].index));
        assert.match(lead[0] ?? '', /^<section class="(home-hero|hero|page-header)"/, 'the hero comes first');
        assert.ok(lead.slice(1).every(chunk => chunk.includes('class="hero-stats')), 'only the hero stats sit between the hero and the bill');
        assert.equal(at('how-solar-works'), bill + 1, 'the energy-flow scene follows the bill');
    });
}

test('each visual has text for readers without JavaScript and valid settings', () => {
    let seen = 0;
    for (const page of pages) {
        const html = read(page);
        for (const match of html.matchAll(/<div\b([^>]*\bdata-(energy-flow|bill-story)\b[^>]*)>\s*<p>([^<]{40,})<\/p>\s*<\/div>/g)) {
            seen++;
            const attrs = match[1];
            const get = name => (attrs.match(new RegExp(`\\b${name}="([^"]*)"`)) || [])[1];
            assert.match(get('data-segment') || '', /^(home|business)$/, `${page}: data-segment`);
            assert.match(get('data-choices') || '', /^((segment|system)( (segment|system))?)?$/, `${page}: data-choices`);
            if (match[2] === 'energy-flow') {
                assert.match(get('data-system') || '', /^(ongrid|hybrid)$/, `${page}: data-system`);
                const scenario = get('data-scenario');
                if (scenario) {
                    const ids = SCENARIOS[get('data-segment')][get('data-system')].map(sc => sc.id);
                    assert.ok(ids.includes(scenario), `${page}: data-scenario "${scenario}" exists`);
                }
            }
        }
        const roots = (html.match(/\bdata-(energy-flow|bill-story)\b/g) || []).length;
        const fallbacks = [...html.matchAll(/<div\b[^>]*\bdata-(energy-flow|bill-story)\b[^>]*>\s*<p>[^<]{40,}<\/p>\s*<\/div>/g)].length;
        assert.equal(fallbacks, roots, `${page}: every visual holds one fallback paragraph`);
    }
    assert.ok(seen >= 6, 'the visuals are on the home, residential and commercial pages');
});

test('every scenario balances: solar + diesel = load + battery + grid', () => {
    for (const [segment, systems] of Object.entries(SCENARIOS)) {
        for (const [system, list] of Object.entries(systems)) {
            assert.equal(new Set(list.map(sc => sc.id)).size, list.length, `${segment} ${system}: unique ids`);
            for (const sc of list) {
                const label = `${segment} ${system} ${sc.id}`;
                const supply = sc.solar + (sc.diesel || 0);
                const use = sc.load + (sc.battery || 0) + sc.grid;
                assert.ok(Math.abs(supply - use) < 0.051, `${label}: ${supply} kW in, ${use} kW out`);
                assert.ok(sc.title && sc.text && sc.chip && sc.clock, `${label}: has copy`);
                if (sc.gridDown) assert.equal(sc.grid, 0, `${label}: nothing flows to a dead grid`);
                if (system === 'ongrid') assert.equal(sc.battery || 0, 0, `${label}: no battery on-grid`);
                // An on-grid inverter disconnects in a power cut, so the panels stop
                if (system === 'ongrid' && sc.gridDown) assert.equal(sc.solar, 0, `${label}: on-grid solar stops in a power cut`);
            }
        }
    }
});

test('the bill falls with solar and never below the fixed charges', () => {
    const { home, business, yearTotals, HOME, BUSINESS, MONTHS } = billMaths();
    assert.equal(MONTHS.length, 12);
    for (const [model, cfg] of [[home, HOME], [business, BUSINESS]]) {
        for (let bill = cfg.min; bill <= cfg.max; bill += cfg.step) {
            const r = model(bill);
            assert.ok(Math.abs(r.before.total - bill) < 0.5, `${bill}: the old bill is the slider value`);
            assert.ok(r.after.total < r.before.total, `${bill}: solar lowers the bill`);
            if (cfg === HOME) {
                assert.ok(r.after.total >= HOME.fixed - 0.5, `${bill}: fixed charges stay`);
                // The site promises a cut of up to 90% in energy charges, no more
                assert.ok(r.after.energy >= r.before.energy * 0.1 - 0.5, `${bill}: energy charges fall by at most 90%`);
                // Banked units carry between months, so check the year as well
                const sums = yearTotals(r);
                const fixed = 12 * HOME.fixed;
                assert.ok(sums.after - fixed >= (sums.before - fixed) * 0.1 - 0.5, `${bill}: year-one energy charges fall by at most 90%`);
            } else {
                assert.equal(r.after.demand, r.before.demand, `${bill}: demand charges stay`);
                assert.ok(Math.abs(r.after.total - (r.after.demand + r.after.energy - r.after.credit)) < 0.5, `${bill}: the bill lines add up`);
                assert.ok(r.after.total >= r.after.demand - 0.5, `${bill}: export credit never cancels the demand charges`);
                assert.ok(r.year.every(m => m.after >= r.before.demand - 0.5), `${bill}: every month keeps the demand charges`);
            }
            assert.equal(r.year.length, 12);
            assert.ok(r.year.every(m => m.after <= m.before + 0.5), `${bill}: every month is lower with solar`);
        }
    }
    // The default home: a ₹3,000 bill is about 380 units, a 2.5 kW system and about ₹750 to pay
    const typical = home(HOME.start);
    assert.equal(typical.kw, 2.5);
    assert.ok(Math.abs(typical.after.total - 750) < 10, `typical home pays ${typical.after.total}`);
});

test('the widgets find their own buttons, not the root that holds the settings', () => {
    // The root carries data-scenario, data-segment and data-system, so a click
    // handler that matched on those would treat every click as a button press
    for (const [file, source] of [['energy-flow.js', flowSource], ['bill-story.js', billSource]]) {
        assert.doesNotMatch(source, /closest\(\s*'\[data-(scenario|segment|system|choices)\]'\s*\)/, file);
    }
});

test('the copy inside the widgets follows the owner-approved claims', () => {
    for (const [file, source] of [['energy-flow.js', flowSource], ['bill-story.js', billSource]]) {
        assert.doesNotMatch(source, /\b5\s?MW\+|\b1000\+/, `${file}: scale`);
        assert.doesNotMatch(source, /100%\s*(customer\s+)?(satisfaction|energy\s+independence)/i, `${file}: 100% claims`);
        assert.doesNotMatch(source, /7[- ]year inverter|7 years on-grid/i, `${file}: inverter warranty`);
        assert.doesNotMatch(source, /3\.2 (to|[–-]) 4\.2 years|3\.5 to 4\.5 years|in under 4 years|payback[^.<]{0,40}3 to 4 years/i, `${file}: payback`);
    }
    assert.match(billSource, /4 to 5 years after subsidy, subject to a site audit/, 'home payback');
    assert.match(billSource, /3 to 5 years, subject to a site audit/, 'business payback');
});
