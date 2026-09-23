const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const pages = ['', 'blog', 'te'].flatMap(dir => {
    const folder = path.join(root, dir);
    return fs.readdirSync(folder)
        .filter(name => name.endsWith('.html'))
        .map(name => path.join(folder, name));
});

for (const page of pages) test(`${path.relative(root, page)} loads the theme before paint`, () => {
    const html = fs.readFileSync(page, 'utf8');
    const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1];
    assert.ok(head, 'page has a head');

    const scripts = [...head.matchAll(/<script\b[^>]*>[\s\S]*?<\/script>/gi)]
        .filter(match => match[0].includes("localStorage.getItem('r2v-theme')"));
    assert.equal(scripts.length, 1, 'one pre-paint script');
    assert.equal(html.split("localStorage.getItem('r2v-theme')").length - 1, 1, 'script appears once in the page');
    assert.match(scripts[0][0], /document\.documentElement\.setAttribute\('data-theme', theme\)/);

    const stylesheetLinks = [...head.matchAll(/<link\b[^>]*>/gi)]
        .filter(match => /\brel=["']stylesheet["']/i.test(match[0]));
    assert.ok(stylesheetLinks.length > 0, 'page has stylesheets');
    assert.ok(scripts[0].index < stylesheetLinks[0].index, 'theme script precedes stylesheets');

    const expectedHref = path.dirname(page) === root ? 'theme.css' : '../theme.css';
    const themeLinks = stylesheetLinks.filter(match => /\btheme\.css["']/i.test(match[0]));
    assert.equal(themeLinks.length, 1, 'one theme stylesheet with the correct path');
    assert.equal(themeLinks[0][0].match(/\bhref=["']([^"']+)["']/i)?.[1], expectedHref);

    const siteLinks = stylesheetLinks.filter(match => /\b(?:styles|pages|blog|careers)\.css(?:\?[^"']*)?["']/i.test(match[0]));
    assert.ok(siteLinks.length > 0, 'page has a site stylesheet');
    assert.ok(siteLinks.every(match => match.index < themeLinks[0].index), 'theme follows site stylesheets');
    if (page === path.join(root, 'index.html')) {
        const home = stylesheetLinks.find(match => /\bhome\.css["']/i.test(match[0]));
        assert.ok(home, 'homepage stylesheet exists');
        assert.ok(themeLinks[0].index < home.index, 'theme precedes homepage stylesheet');
    }

    assert.doesNotMatch(html, /\bdata-theme-toggle\s*=/i);
});
