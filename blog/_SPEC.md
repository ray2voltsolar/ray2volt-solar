# Ray2Volt Solar — Blog Authoring Spec

Read this file completely before writing any blog post. Every rule here is mandatory.

## 1. Files you work with

- `blog/_boilerplate.html` — the page skeleton. **Copy it for every post** and fill in the `{{PLACEHOLDERS}}`.
- `blog/_manifest.json` — the canonical list of all posts (slug, title, category, date, excerpt, keywords, related).
- Output: `blog/<slug>.html`, one file per post, slug taken exactly from the manifest.

## 2. Hard technical rules

1. **Never edit** `styles.css`, `blog.css`, `script.js`, `blog/_boilerplate.html`, `blog/_manifest.json`, or any root-level `*.html`. Only create `blog/<slug>.html` files.
2. Because posts live in `blog/`, **every internal path is prefixed with `../`** — `../styles.css`, `../blog.css`, `../images/logo.png`, `../index.html`, `../get-quote.html`, `../script.js`. Links to *other blog posts* are relative with no prefix: `href="other-slug.html"`.
3. `<body class="blog">` — the `blog` class is what switches the page to the light theme. Never remove it.
4. Do **not** add `<style>` blocks or inline `style=` attributes. Every visual need is already covered by classes in `blog.css`. If something is missing, use the closest existing class rather than inventing CSS.
5. Do **not** change the fonts. They are inherited from `styles.css` (`Google Sans Flex` for headings, `Assistant` for body).
6. Replace **every** `{{PLACEHOLDER}}`. A published page must contain zero `{{` characters.
7. Delete the big commented-out "Use these components as needed" block from the boilerplate once you have copied out the components you actually use.
8. Every `<h2 id="...">` in the article must have a matching entry in the sidebar `.toc` list, in the same order, with matching link text.
9. Every `<img>` needs a real descriptive `alt`, plus `width` and `height`. Non-hero images also need `loading="lazy"`.
10. Valid HTML only. Escape `&` as `&amp;` inside text and attributes.

## 3. Images

- **Hero image (required):** `../images/blog/<slug>.jpg` — this is a photorealistic editorial photograph in the house style defined by the `imageStyle` object in `blog/_manifest.json`. Reference it exactly; do not rename it.
- **Inline stock photos (1–2 per post, required):** use real Unsplash photo URLs in the same style the rest of the site already uses, e.g.
  `https://images.unsplash.com/photo-XXXXXXXXX?w=1200&h=675&fit=crop`
  Only use Unsplash photo IDs you are confident exist. These already appear in `commercial.html` and are safe to reuse where the subject matches:
  - `photo-1504328345606-18bbc8c9d7d1` — manufacturing plant
  - `photo-1566073771259-6a8506099945` — hotel / resort
  - `photo-1441986300917-64674bd600d8` — retail store
  Wrap every inline image in `<figure>` with a `<figcaption>`.
- Never hotlink an image from any site other than `images.unsplash.com`.

## 4. Content rules

**Length:** 1,300–1,900 words of real body copy per post. This is an SEO asset — thin posts are a failure.

**Structure of every post:**
1. `.key-takeaways` box — 4 short bullets, each a concrete fact, not a teaser.
2. Intro — 2–3 paragraphs. Open with the reader's actual problem, not "In today's world…".
3. 5–8 `<h2 id="...">` sections, with `<h3>` sub-sections where useful.
4. At least one `<div class="table-wrap"><table>` comparison table with real, useful rows.
5. At least two `.callout` blocks (mix the `callout`, `callout--warning`, `callout--success` variants).
6. 3–5 internal links in the body text to other site pages (`../residential.html`, `../commercial.html`, `../industry-*.html`, `../investor.html`, `../get-quote.html`, `../contact.html`) and to sibling blog posts. Link naturally, on descriptive anchor text — never "click here".
7. `<h2 id="faq">Frequently asked questions</h2>` with 4–6 `<details class="faq-item">` entries.
8. Matching `FAQPage` JSON-LD in `<head>` (replace the `{{FAQ_SCHEMA_HERE}}` comment) containing exactly the same questions and answers as the visible FAQ.
9. Author box, post CTA, sidebar TOC + CTA, and 3 related-post cards (slugs from the manifest's `related` array).

**Voice:** direct, practical, second person ("your roof", "your bill"). Indian English. No hype, no exclamation marks, no "revolutionary"/"game-changing". Written for a homeowner or business owner who is deciding, not for a search engine.

## 5. Factual accuracy — do not invent

Use only these figures. If you need a number that is not here, express it as a range and say it should be confirmed with a site audit.

**Company:** Ray2Volt Solar Private Limited, incorporated 26 March 2025. Registered office: 1-278, J.K.Nagar, Revenue Ward No-1, Pichatur Road, Srikalahasti, Tirupati District, 517644, Andhra Pradesh. Operating points: Tirupati, Puttur, Pichatur. Phone +91 9666068140, email sales@ray2voltsolar.com. Services: on-grid, off-grid and hybrid systems; residential and C&I; free power audits; DISCOM coordination and net-metering support; loan and subsidy facilitation; local after-sales support.

**PM Surya Ghar: Muft Bijli Yojana** — central financial assistance for residential rooftop solar. ₹30,000 for 1 kW, ₹60,000 for 2 kW, and ₹78,000 for 3 kW and above (the ₹78,000 is the cap). Requires DCR (domestic content) modules and a registered vendor. Scheme implementation period runs to **31 March 2027**. Official portal: https://www.pmsuryaghar.gov.in. Commercial and industrial customers are **not** eligible for this residential subsidy.

**ALMM / DCR:** MNRE's ALMM List-I covers modules, List-II covers cells. From the June 2026 List-II compliance shift, Ray2Volt prepares all new commercial and industrial quotations on DCR panels unless a project has a verified exemption. Assume a DCR premium of roughly **₹9–12 per Wp** (about ₹9,000–12,000 per kWp) versus non-DCR, brand dependent. MNRE rooftop programme: https://mnre.gov.in/en/grid-connected-solar-rooftop-programme/

**Warranties as quoted on this site:** 30-year panel performance warranty, 7–10 year inverter warranty depending on brand, 10-year lithium battery warranty. Keep to these; do not inflate them.

**Generation rule of thumb:** roughly 4–4.5 units per kW per day annual average in this part of Andhra Pradesh, so about 1,400–1,600 units per kW per year. Roughly 80–100 sq ft of shade-free roof per kW. State these as approximations.

**Accelerated depreciation:** available to businesses on solar assets under the Income Tax Act. Describe the mechanism and its effect on payback, but tell readers to confirm the current rate and their own eligibility with their chartered accountant. Do not present it as tax advice.

**Do not:** invent prices per kW, invent customer names, quote fake testimonials, cite statistics without a named source, promise specific savings, or state guaranteed payback periods. Frame all savings as estimates that depend on a site audit.

## 6. Compliance line

Any post that discusses subsidy, tax, or financing must include a short caveat — either in a `.callout--warning` or the closing paragraph — saying figures are indicative, schemes change, and the reader should confirm eligibility for their own case. Ray2Volt does not give tax or investment advice.

## 7. Definition of done for one post

- `blog/<slug>.html` exists, contains no `{{`, and opens with `<!DOCTYPE html>`.
- `<body class="blog">` present; `../styles.css` and `../blog.css` both linked, in that order.
- Title, meta description, canonical, OG tags, BlogPosting JSON-LD, BreadcrumbList JSON-LD and FAQPage JSON-LD all filled from the manifest entry.
- 1,300+ words, at least one table, at least two callouts, 4–6 FAQs, TOC matching the h2 ids, 3 related cards.
- All internal links resolve to files that exist (check with `ls`).
