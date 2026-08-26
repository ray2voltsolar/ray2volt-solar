# Ray2Volt Solar — Blog Maintenance Guide

This document explains the workflow for adding future blog posts to the Ray2Volt Solar website.

> **Note on Build-Time Assets:**
> Files inside `blog/` that begin with an underscore (`_manifest.json`, `_SPEC.md`, `_boilerplate.html`, `_gen_sitemap.py`, `_README.md`) are build-time and authoring assets. GitHub Pages (via Jekyll) automatically ignores files and folders prefixed with an underscore, so these are not published to the live site.

---

## How to Add a New Blog Post

Follow these 5 steps in order:

### 1. Append an Entry to `blog/_manifest.json`

Add a new JSON object to the `posts` array in `blog/_manifest.json`. The required fields are:

- `slug` *(string)*: Unique URL slug and filename identifier without extension (e.g. `"my-post-slug"`). Used for page (`blog/<slug>.html`) and image (`images/blog/<slug>.jpg`) filenames.
- `title` *(string)*: Full article headline used for `<title>`, `<h1>`, Open Graph metadata, and JSON-LD schema.
- `shortTitle` *(string)*: Concise title used in breadcrumb trails and related post cards.
- `category` *(string)*: Article category matching one of the canonical categories (`"Solar Basics"`, `"Subsidy & Policy"`, `"Technology"`, `"Business & Industry"`, `"Savings & ROI"`, `"Local Guides"`).
- `date` *(string)*: Publication date in `YYYY-MM-DD` ISO format.
- `readTime` *(number)*: Estimated reading duration in minutes (integer).
- `excerpt` *(string)*: 1–2 sentence summary used for standfirst, card snippets, meta description, and schema.
- `keywords` *(string)*: Comma-separated SEO keyword phrase list for `<meta name="keywords">`.
- `imagePrompt` *(string)*: AI image generation prompt used to create the hero illustration.
- `related` *(array of strings)*: Array containing exactly 3 existing post slugs to display in the "Related reading" section.

### 2. Generate or Source the Hero Image

Create a photorealistic editorial photograph matching the site's visual identity:

- **File Path:** Save the image as `images/blog/<slug>.jpg` in **16:9** format at **1600x900 px**, as a JPEG at approximately quality **82**.
- **Prompt construction:** Every post's exact generation prompt is stored in its `imagePrompt` field. The shared wrapper lives in the manifest's `imageStyle` object: build a new prompt as `imageStyle.prefix + your scene sentence + imageStyle.suffix`, then store the scene in `imageScene` and the assembled prompt in `imagePrompt`.
- **Look to hold:** Natural daylight, bright clean exposure, cool blue/cyan with warm sun accents, plenty of clean negative space, ordinary middle-market concrete-and-render architecture in a flat inland warm-climate setting, practical and unglamorous.
- **Avoid:** Flat-vector or illustrated styles, 3D renders, luxury villas, coastlines, mountains behind buildings, North American or European suburban styling with lawns and pitched shingle roofs, and any text, digits, labels, logos or branding in frame.
- **Generation tool:** Images were generated with Codex CLI (`codex exec --model gpt-5.6-luna`) using its built-in image generation tool.

### 3. Create the Post Page (`blog/<slug>.html`)

1. Copy `blog/_boilerplate.html` to `blog/<slug>.html` (where `<slug>` matches your manifest entry).
2. Open `blog/_SPEC.md` and adhere strictly to all authoring, styling, and factual guidelines.
3. Replace all `{{PLACEHOLDER}}` tokens with content from your manifest entry and post copy:
   - Ensure `<body class="blog">` remains intact.
   - Verify all root-relative asset and page links are prefixed with `../` (e.g. `../styles.css`, `../blog.css`, `../images/logo.png`, `../get-quote.html`), while sibling post links are direct (`sibling-slug.html`).
   - Meet the 1,300–1,900 word count standard.
   - Include key takeaways, at least one comparison table (`<div class="table-wrap"><table>`), at least two `.callout` blocks, and 4–6 FAQ items in `<details class="faq-item">`.
   - Ensure every `<h2 id="...">` has a corresponding entry in the sidebar `.toc` list.
   - Fill the `BlogPosting`, `BreadcrumbList`, and `FAQPage` JSON-LD schema blocks in `<head>`.
   - Remove unused commented boilerplate components so zero `{{` tokens remain in the published file.

### 4. Add a Card to `blog.html`

Add a card linking to the new post inside `<div class="blog-grid">` in `blog.html`, positioned newest-first:

```html
<a href="blog/<slug>.html" class="blog-card" data-category="<Category>">
    <div class="blog-card-media">
        <img src="images/blog/<slug>.jpg" alt="<Full Title>" loading="lazy" width="600" height="338">
    </div>
    <div class="blog-card-body">
        <span class="category-pill" data-cat="<Category>"><Category></span>
        <h3><Full Title></h3>
        <p><Excerpt></p>
        <div class="blog-card-meta">
            <time datetime="YYYY-MM-DD"><D Month YYYY></time>
            <span class="dot">&middot;</span>
            <span><N> min read</span>
        </div>
    </div>
</a>
```

> **Important:** The `data-category` attribute must exactly match one of the filter button categories (`Solar Basics`, `Subsidy & Policy`, `Technology`, `Business & Industry`, `Savings & ROI`, `Local Guides`) for category filtering in `blog.js` to work properly.

### 5. Refresh Sitemap and Crawler Directives

From the project root directory, run the sitemap generator script:

```bash
python blog/_gen_sitemap.py
```

This reads `blog/_manifest.json` and updates `sitemap.xml` and `robots.txt` automatically.
