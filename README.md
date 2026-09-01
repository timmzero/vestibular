# vestibular.nexus

Static marketing site for Vestibular, covering two consulting practices:
**Agile Transformation** and **AI Transformation (Business Analysis)**.

Served by Cloudflare Pages from `main`. No build step at deploy time — the
generated HTML is committed. The contact form posts to an Express backend on
Render (`backend/`).

## Content is generated, not hand-edited

`content/practices.json` is the single source of truth for practice content,
and `content/pages.json` for per-page `<title>` and meta description. Shared
page chrome lives in `content/partials/`.

Anything between `<!-- GENERATED:name START -->` and `<!-- GENERATED:name END -->`
is produced by the generator. **Editing inside those markers will be overwritten
and CI will fail.** Change the source, then regenerate:

```bash
node tools/render_content.mjs           # write the generated regions
node tools/render_content.mjs --check   # verify; exits 1 on drift (runs in CI)
```

Share cards are generated separately, because PNG encoding is not byte-stable
across library versions and would fail CI on an upgrade rather than on a real
problem. Run this by hand after changing a page title:

```bash
python3 tools/build_og_images.py        # 1200x630 cards into assets/og/
```

## Adding a page

1. Create the HTML with the four chrome marker pairs (`page_head`, `topbar`,
   `hero_logo`, `footer`) — copy an existing page.
2. Add a `title` and `description` entry to `content/pages.json`.
3. Add the filename to `CHROME_PAGES` in `tools/render_content.mjs`.
4. Add it to `nav.html`, or to the relevant hub page.
5. Add it to `sitemap.xml`, extensionless — Pages 308-redirects `.html` URLs.
6. Run both generators above.

The generator fails loudly on a page listed in `CHROME_PAGES` with no metadata,
so a forgotten step 2 stops the build instead of shipping an empty `<title>`.

## Brand

| | |
|---|---|
| Primary | `hsla(79, 65%, 48%, 1)` — lime |
| Accent | `hsla(180, 60%, 40%, 1)` — teal |
| Background | black |
| Fonts | IBM Plex Sans (body), Source Sans 3 (headings) |

Content width is `--max-content-width` in `styles/styles.css`. Use the token,
not a literal — a hardcoded `960px` once made one page 60px wider than the rest.
