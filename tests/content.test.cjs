// Owner-approved facts stay consistent sitewide: node --test tests/content.test.cjs
// The facts come from the owner's answers of 23 Sep 2026 (scale, warranty, branches, products).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SKIP_DIRS = new Set(['.git', 'node_modules', 'tests', 'scratchpads']);

function htmlFiles(dir = ROOT) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return SKIP_DIRS.has(entry.name) ? [] : htmlFiles(full);
        return entry.name.endsWith('.html') ? [full] : [];
    });
}

// Visible text and attribute values, without scripts other than JSON-LD and without CSS.
function text(file) {
    return fs.readFileSync(file, 'utf8')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<script(?![^>]*ld\+json)[\s\S]*?<\/script>/gi, ' ')
        .replace(/<!--[\s\S]*?-->/g, ' ');
}

const pages = htmlFiles().map(file => ({ file: path.relative(ROOT, file).replace(/\\/g, '/'), body: text(file) }));

function offenders(pattern, filter = () => true) {
    return pages.filter(p => filter(p.file) && pattern.test(p.body)).map(p => p.file);
}

// The eight blog worked examples keep their own sizes and calculations.
const notCaseStudy = file => !/-case-study\.html$/.test(file);

test('capacity is 10 MW+ everywhere', () => {
    assert.deepEqual(offenders(/\b5\s?MW\+/), []);
});

test('installations are written "1,000+"', () => {
    assert.deepEqual(offenders(/\b1000\+/), []);
});

test('no unsupported 100% satisfaction or independence claims', () => {
    assert.deepEqual(offenders(/100%\s*(<\/h3>\s*<p>)?\s*(customer\s+)?(satisfaction|energy\s+independence)/i), []);
});

test('Pichatur is not listed as a branch or operating point', () => {
    assert.deepEqual(offenders(/(branches|operating points?|service hubs?)[^.<]{0,80}Pichatur(?!\s+Road)/i), []);
});

test('no superseded inverter warranty (7 years)', () => {
    assert.deepEqual(offenders(/7[- ]year inverter|7 years on-grid/i, notCaseStudy), []);
});

test('no products Ray2Volt does not supply are offered', () => {
    assert.deepEqual(offenders(/(we|ray2volt)[^.<]{0,60}(supply|install|offer|sell)[^.<]{0,40}(solar water heaters?|solar street ?lights?|solar fencing|PM-KUSUM pumps?)/i), []);
});

test('the Tirupati page no longer claims to be the "best" company', () => {
    const page = pages.find(p => p.file === 'solar-in-tirupati.html');
    assert.ok(page, 'solar-in-tirupati.html exists');
    assert.doesNotMatch(page.body, /Best Solar Company/i);
});

test('payback follows the owner ranges outside the worked examples', () => {
    const notExample = file => notCaseStudy(file) && file !== 'investor.html';
    assert.deepEqual(offenders(/3\.2 (to|[–-]) 4\.2 years|3\.5 to 4\.5 years|in under 4 years|payback[^.<]{0,40}3 to 4 years/i, notExample), []);
});
