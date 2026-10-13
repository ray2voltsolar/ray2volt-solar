const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Ray2Volt 3D (3D plant viewers for solar EPCs) has its own site at
// 3d.ray2voltsolar.com. This site links to it from every English page and
// forwards the old ray2volt-3d.html address there.
const root = path.join(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const SITE = 'https://3d.ray2voltsolar.com/';

const englishPages = [
    ...fs.readdirSync(root).filter(n => n.endsWith('.html')),
    ...fs.readdirSync(path.join(root, 'blog')).filter(n => n.endsWith('.html')).map(n => `blog/${n}`)
];
const stubs = ['ray2volt-3d.html', 'warranty.html'];

const headerOf = html => html.match(/<header class="header"[\s\S]*?<\/header>/i)?.[0] ?? '';
const footerColumn = html => html.match(/<h4>For Businesses<\/h4>\s*<ul[^>]*>[\s\S]*?<\/ul>/i)?.[0] ?? '';

for (const name of englishPages.filter(n => !stubs.includes(n))) {
    const html = read(name);
    test(`${name} links to the Ray2Volt 3D site in the header`, () => {
        assert.ok(headerOf(html).includes(`<a href="${SITE}">Ray2Volt 3D: 3D plant viewers</a>`));
    });
    const column = footerColumn(html);
    if (column) test(`${name} links to the Ray2Volt 3D site in the footer For Businesses column`, () => {
        assert.ok(column.includes(`<a href="${SITE}">Ray2Volt 3D for solar EPCs</a>`));
    });
}

test('pages without the shared header are only the redirect stubs', () => {
    const missing = englishPages.filter(name => !headerOf(read(name)));
    assert.deepEqual(missing.sort(), [...stubs].sort());
});

test('the old ray2volt-3d.html address forwards to the Ray2Volt 3D site', () => {
    const page = read('ray2volt-3d.html');
    assert.ok(page.includes(`location.replace('${SITE}' + location.hash)`));
    assert.ok(page.includes(`<meta http-equiv="refresh" content="0; url=${SITE}">`));
    assert.ok(page.includes(`<link rel="canonical" href="${SITE}">`));
});

test('nothing on the site still points at the old page or its files', () => {
    for (const name of englishPages) {
        assert.ok(!/href="(\.\.\/)?ray2volt-3d\.html"/.test(read(name)), name);
    }
    assert.ok(!fs.existsSync(path.join(root, 'images', '3d')));
    assert.ok(!read('sitemap.xml').includes('ray2volt-3d'));
    assert.ok(read('llms.txt').includes(`(${SITE})`));
});
