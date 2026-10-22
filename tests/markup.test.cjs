const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Pages are hand-written HTML, so check what a browser would quietly
// paper over: image files that are not there, and elements left open.
const root = path.join(__dirname, '..');
const pages = ['', 'blog', 'te'].flatMap(dir => {
    const folder = path.join(root, dir);
    return fs.readdirSync(folder)
        .filter(name => name.endsWith('.html') && !name.startsWith('_'))
        .map(name => path.join(folder, name));
});

const BLOCKS = ['section', 'main', 'article', 'aside', 'header', 'footer', 'nav', 'div', 'ul', 'ol', 'figure', 'picture', 'table', 'form'];
const markupOf = html => html.replace(/<!--[\s\S]*?-->/g, '').replace(/<script\b[\s\S]*?<\/script>/gi, '');

const imageUrls = html => [
    ...[...html.matchAll(/<(?:img|source)\b[^>]*?\ssrc="([^"]+)"/gi)].map(m => m[1]),
    ...[...html.matchAll(/\s(?:srcset|imagesrcset)="([^"]+)"/gi)]
        .flatMap(m => m[1].split(',').map(candidate => candidate.trim().split(/\s+/)[0]))
].filter(url => url && !/^(?:[a-z]+:|\/\/)/i.test(url));

for (const page of pages) {
    const name = path.relative(root, page).replace(/\\/g, '/');
    const html = fs.readFileSync(page, 'utf8');

    test(`${name} only points at images that exist`, () => {
        const missing = [...new Set(imageUrls(html))].filter(url =>
            !fs.existsSync(path.join(path.dirname(page), url.split(/[?#]/)[0])));
        assert.deepEqual(missing, []);
    });

    test(`${name} closes every block element it opens`, () => {
        const markup = markupOf(html);
        for (const tag of BLOCKS) {
            const opened = (markup.match(new RegExp(`<${tag}[\\s>]`, 'gi')) || []).length;
            const closed = (markup.match(new RegExp(`</${tag}>`, 'gi')) || []).length;
            assert.equal(closed, opened, `<${tag}> opened ${opened} times, closed ${closed}`);
        }
    });
}
