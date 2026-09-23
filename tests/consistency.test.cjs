const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Site pages share the homepage components in theme.css; one-off inline
// styling is what made them drift apart, so keep it out of page markup.
const root = path.join(__dirname, '..');
const pages = ['', 'te'].flatMap(dir => {
    const folder = path.join(root, dir);
    return fs.readdirSync(folder)
        .filter(name => name.endsWith('.html'))
        .map(name => path.join(folder, name));
});

const bodyOf = html => html.match(/<body\b[\s\S]*<\/body>/i)?.[0] ?? '';

for (const page of pages) {
    const name = path.relative(root, page).replace(/\\/g, '/');
    const body = bodyOf(fs.readFileSync(page, 'utf8'));

    test(`${name} has no inline styles apart from hidden honeypot fields`, () => {
        const tags = [...body.matchAll(/<([a-z0-9]+)\b[^>]*\bstyle\s*=\s*"([^"]*)"[^>]*>/gi)];
        const stray = tags.filter(([, tag, style]) =>
            !(tag.toLowerCase() === 'input' && /^\s*display:\s*none;?\s*$/i.test(style)));
        assert.deepEqual(stray.map(match => match[0].slice(0, 120)), []);
    });

    if (!name.startsWith('te/')) test(`${name} opens every section intro with a kicker`, () => {
        const headers = [...body.matchAll(/<div class="section-header\b[^"]*">\s*<([a-z0-9]+)\b([^>]*)>/gi)];
        for (const [, tag, attrs] of headers) {
            assert.equal(tag.toLowerCase(), 'p', 'first child is a paragraph');
            assert.match(attrs, /class="kicker"/);
        }
    });
}
