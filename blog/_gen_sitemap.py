"""Regenerate sitemap.xml and robots.txt for ray2voltsolar.com.

Run from the project root. Root pages get a hand-tuned priority; blog posts are
read from blog/_manifest.json so future posts only need a manifest entry.
"""
import json
import os
from datetime import date

BASE = "https://ray2voltsolar.com"

# Marketing/ad landing pages are deliberately excluded from the sitemap.
EXCLUDE = {
    "thank-you.html",
    "claim-discount.html",
    "claim-subsidy.html",
    "save-on-solar.html",
}

PRIORITY = {
    "index.html": ("1.0", "weekly"),
    "residential.html": ("0.9", "monthly"),
    "commercial.html": ("0.9", "monthly"),
    "blog.html": ("0.9", "weekly"),
    "investor.html": ("0.8", "monthly"),
    "about.html": ("0.7", "yearly"),
    "contact.html": ("0.7", "yearly"),
    "solar-in-tirupati.html": ("0.8", "monthly"),
    "get-quote.html": ("0.6", "yearly"),
    "privacy-policy.html": ("0.3", "yearly"),
}
DEFAULT = ("0.7", "monthly")

today = date.today().isoformat()
urls = []


def add(loc, lastmod, changefreq, priority):
    urls.append((loc, lastmod, changefreq, priority))


for name in sorted(os.listdir(".")):
    if not name.endswith(".html") or name in EXCLUDE:
        continue
    prio, freq = PRIORITY.get(name, DEFAULT)
    loc = BASE + "/" if name == "index.html" else f"{BASE}/{name}"
    lastmod = date.fromtimestamp(os.path.getmtime(name)).isoformat()
    add(loc, lastmod, freq, prio)

with open("blog/_manifest.json", encoding="utf-8") as fh:
    manifest = json.load(fh)

for post in sorted(manifest["posts"], key=lambda p: p["date"], reverse=True):
    slug = post["slug"]
    if not os.path.exists(f"blog/{slug}.html"):
        print(f"  skipped (missing file): blog/{slug}.html")
        continue
    add(f"{BASE}/blog/{slug}.html", post["date"], "yearly", "0.7")

lines = ['<?xml version="1.0" encoding="UTF-8"?>',
         '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
for loc, lastmod, freq, prio in urls:
    lines += [
        "    <url>",
        f"        <loc>{loc}</loc>",
        f"        <lastmod>{lastmod}</lastmod>",
        f"        <changefreq>{freq}</changefreq>",
        f"        <priority>{prio}</priority>",
        "    </url>",
    ]
lines.append("</urlset>")

with open("sitemap.xml", "w", encoding="utf-8", newline="\n") as fh:
    fh.write("\n".join(lines) + "\n")

with open("robots.txt", "w", encoding="utf-8", newline="\n") as fh:
    fh.write(
        "User-agent: *\n"
        "Allow: /\n\n"
        "# Ad landing pages — kept out of organic search\n"
        "Disallow: /claim-discount.html\n"
        "Disallow: /claim-subsidy.html\n"
        "Disallow: /save-on-solar.html\n"
        "Disallow: /thank-you.html\n\n"
        f"Sitemap: {BASE}/sitemap.xml\n"
    )

print(f"sitemap.xml: {len(urls)} urls ({today})")
print("robots.txt written")
