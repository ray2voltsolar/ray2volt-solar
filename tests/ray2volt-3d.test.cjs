const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Ray2Volt 3D (3D plant viewers for solar EPCs) is a page of this site, not a
// separate website: it uses the shared header and footer, the site's form key,
// sales@ as its address, and every English page links to it.
const root = path.join(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const page = read('ray2volt-3d.html');
const pageJs = read('ray2volt-3d.js');
const URL = 'https://ray2voltsolar.com/ray2volt-3d.html';

const englishPages = [
    ...fs.readdirSync(root).filter(n => n.endsWith('.html')),
    ...fs.readdirSync(path.join(root, 'blog')).filter(n => n.endsWith('.html')).map(n => `blog/${n}`)
];

const headerOf = html => html.match(/<header class="header"[\s\S]*?<\/header>/i)?.[0] ?? '';
const footerColumn = html => html.match(/<h4>For Businesses<\/h4>\s*<ul[^>]*>[\s\S]*?<\/ul>/i)?.[0] ?? '';

test('the page is canonical on the main site and indexable', () => {
    assert.ok(page.includes(`<link rel="canonical" href="${URL}">`));
    assert.ok(!/noindex/i.test(page));
    assert.ok(page.includes(`<meta property="og:url" content="${URL}">`));
});

test('the page loads the shared site script and stylesheets, then its own', () => {
    assert.ok(page.includes('<script src="script.js"></script>'));
    assert.ok(page.indexOf('<script src="script.js">') < page.indexOf('<script src="ray2volt-3d.js">'));
    for (const css of ['styles.css', 'pages.css', 'theme.css', 'ray2volt-3d.css']) {
        assert.ok(page.includes(`<link rel="stylesheet" href="${css}">`), css);
    }
});

test('the page uses the exact shared header and footer of the homepage', () => {
    const index = read('index.html');
    const strip = html => html.replace(/ aria-current="page"/g, '');
    assert.equal(strip(headerOf(page)), headerOf(index));
    const footer = html => html.match(/<footer class="footer">[\s\S]*?<\/footer>/i)?.[0] ?? '';
    assert.equal(strip(footer(page)), footer(index));
});

for (const name of englishPages) {
    const html = read(name);
    const href = (name.startsWith('blog/') ? '../' : '') + 'ray2volt-3d.html';
    const header = headerOf(html);
    if (header) test(`${name} links to Ray2Volt 3D in the header`, () => {
        assert.ok(header.includes(`href="${href}"`));
    });
    const column = footerColumn(html);
    if (column) test(`${name} links to Ray2Volt 3D in the footer For Businesses column`, () => {
        assert.ok(column.includes(`href="${href}"`));
    });
}

test('pages without the shared header are only the redirect stub', () => {
    const missing = englishPages.filter(name => !headerOf(read(name)));
    assert.deepEqual(missing, ['warranty.html']);
});

test('only the page itself marks its links as the current page', () => {
    for (const name of englishPages) {
        const marked = /href="(\.\.\/)?ray2volt-3d\.html" aria-current="page"/.test(read(name));
        assert.equal(marked, name === 'ray2volt-3d.html', name);
    }
});

test('the sitemap and llms.txt list the page', () => {
    assert.ok(read('sitemap.xml').includes(`<loc>${URL}</loc>`));
    assert.ok(read('llms.txt').includes(`(${URL})`));
});

test('the enquiry form posts with the site Web3Forms key and a 3D subject', () => {
    const keys = new Set(englishPages.flatMap(name =>
        [...read(name).matchAll(/name="access_key" value="([^"]+)"/g)].map(m => m[1])));
    assert.equal(keys.size, 1);
    const key = [...keys][0];
    assert.ok(page.includes(`name="access_key" value="${key}"`));
    assert.ok(!/YOUR_|ACCESS_KEY_HERE/.test(page + pageJs));
    assert.match(page, /name="subject" value="Ray2Volt 3D Enquiry[^"]*"/);
    assert.ok(page.includes('data-form-id="ray2volt-3d"'));
    assert.ok(!page.includes('data-r2v-form'), 'the page script handles this form, not the shared one');
    assert.match(read('script.js'), /'ray2volt-3d': ''/);
});

test('one contact address and WhatsApp only through the form', () => {
    assert.ok(!/3d@ray2volt/i.test(page + pageJs));
    const emails = new Set([...(page + pageJs).matchAll(/[a-z0-9._-]+@ray2voltsolar\.com/gi)].map(m => m[0].toLowerCase()));
    assert.deepEqual([...emails], ['sales@ray2voltsolar.com']);
    assert.ok(!/wa\.me\//.test(page.replace(/<header[\s\S]*?<\/header>|<footer[\s\S]*?<\/footer>/g, '')),
        'no wa.me links in the page body');
    assert.ok(!/whatsapp-float|float-wa/i.test(page));
});

test('pricing wording stays fixed and affordable', () => {
    const text = page + pageJs;
    assert.ok(/fixed and affordable/i.test(page));
    assert.ok(page.includes('₹4,999'));
    assert.ok(!/no[\s-]+(negotiation|bargain|haggl)|non[\s-]?negotiable|not negotiable/i.test(text));
});

test('demos are labelled by site type and place only', () => {
    assert.ok(page.includes('https://ray2voltsolar.github.io/arena-water-park-solar-3d/'));
    assert.ok(page.includes('https://ray2voltsolar.github.io/ar-poultry-solar-3d/'));
    assert.ok(page.includes('Water park, Visakhapatnam'));
    assert.ok(page.includes('Poultry farm, Kadapa'));
    assert.ok(!/Arena|AR Poultry/.test(page.replace(/https:\/\/ray2voltsolar\.github\.io\/[^"]+/g, '')));
});

test('every local image and video the page uses exists', () => {
    const refs = [...page.matchAll(/(?:src|srcset|poster|data-src|href)="(images\/3d\/[^"\s]+)/g)].map(m => m[1]);
    assert.ok(refs.length > 0);
    for (const ref of new Set(refs)) assert.ok(fs.existsSync(path.join(root, ref)), ref);
});

test('the three process steps stack on phones as on the homepage', () => {
    // A three-column .r3d .home-process rule outside a min-width media query would beat
    // home.css's one-column phone layout and squeeze each step to a word per line.
    const css = read('ray2volt-3d.css').replace(/\/\*[\s\S]*?\*\//g, '');
    const outside = css.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');
    assert.ok(!/\.r3d \.home-process\s*\{[^}]*grid-template-columns/.test(outside));
    assert.ok(/@media \(min-width: 641px\)\s*\{\s*\.r3d \.home-process\s*\{\s*grid-template-columns: repeat\(3/.test(css));
});
