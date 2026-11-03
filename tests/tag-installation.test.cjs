const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
function htmlFiles(folder) {
    return fs.readdirSync(folder, { withFileTypes: true }).flatMap(entry => {
        if (entry.name.startsWith('.') || entry.name === 'scratchpads' || entry.name === 'node_modules') return [];
        const file = path.join(folder, entry.name);
        return entry.isDirectory() ? htmlFiles(file) : entry.name.endsWith('.html') ? [file] : [];
    });
}
const pages = htmlFiles(root).map(file => ({ name: path.relative(root, file), html: fs.readFileSync(file, 'utf8') }));

test('every HTML page and template loads the requested GTM container exactly once in its head', () => {
    assert.ok(pages.length > 0);
    for (const { name, html } of pages) {
        const loaders = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]*googletagmanager\.com\/[^\"]+)"[^>]*>/gi)];
        assert.equal(loaders.length, 1, name);
        assert.equal(loaders[0][1], 'https://www.googletagmanager.com/gtm.js?id=GTM-5BX8QZ4R', name);
        assert.match(loaders[0][0], /\basync\b/, name);
        const headStart = html.search(/<head\b/i);
        const headEnd = html.search(/<\/head>/i);
        assert.ok(headStart < loaders[0].index && loaders[0].index < headEnd, name);
        assert.doesNotMatch(html, /gtag\(\s*['"]config['"]/, name);
    }
});

test('GTM startup precedes the async loader and preserves the existing event queue', () => {
    for (const { name, html } of pages) {
        const initializer = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
            .find(match => match[1].includes("'gtm.start'"));
        assert.ok(initializer, name);
        assert.ok(initializer.index < html.indexOf('<script async src="https://www.googletagmanager.com/gtm.js'), name);
        const held = { event: 'already_queued' };
        const queue = [held];
        const context = { dataLayer: queue };
        context.window = context;
        vm.runInNewContext(initializer[1], context);
        assert.equal(context.dataLayer, queue, name);
        assert.equal(queue[0], held, name);
        assert.equal(queue[1].event, 'gtm.js', name);
        assert.equal(typeof queue[1]['gtm.start'], 'number', name);
        assert.equal(queue[2][0], 'js', name);
        context.gtag('event', 'generate_lead', { form_id: 'quote-form' });
        assert.equal(queue[3][1], 'generate_lead', name);
    }
});

test('every HTML page places the matching noscript fallback immediately inside its body', () => {
    for (const { name, html } of pages) {
        assert.equal((html.match(/googletagmanager\.com\/ns\.html\?id=/g) || []).length, 1, name);
        assert.match(html, /<body\b[^>]*>\s*<!-- Google Tag Manager \(noscript\) -->\s*<noscript><iframe src="https:\/\/www\.googletagmanager\.com\/ns\.html\?id=GTM-5BX8QZ4R"\s+height="0" width="0" style="display:none;visibility:hidden"><\/iframe><\/noscript>/i, name);
    }
});
