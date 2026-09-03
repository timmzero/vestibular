# Session kickoff — vestibular.nexus / vtraffic.nexus

Read this before running anything. It records what was verified against live
systems, not what seemed likely. Written 2 Sep 2026.

## The repos

| repo | serves | notes |
|---|---|---|
| `timmzero/vestibular` | vestibular.nexus | consulting site, two practices |
| `timmzero/VTRAFFIC` | vtraffic.nexus | product marketing site |
| `timmzero/Vestibular-Traffic-Management` | tm.vestibular.nexus | the VTM platform — **different discipline, uses D-numbers** |

**Neither marketing site uses D-numbers.** Confirmed by the founder. Do not
allocate one, and do not touch the VTM counter from this work.

## Workflow

- Branch from `origin/main`. **Never push to main.**
- Claude pushes branches; the founder merges via the GitHub PR UI.
- `delete_branch_on_merge` is **true** on `vestibular`, **false** on `VTRAFFIC`
  (a PAT cannot change this — 403, needs Administration write; founder fix via
  Settings → General).
- **A merged branch does not reopen when you push to it.** Commits pushed after
  a merge sit on a closed PR and go unseen. Start a new branch instead. This
  happened once this session and two commits were nearly lost.
- **Set `git config user.name/user.email` in every fresh clone.** A VTRAFFIC
  push silently produced an *empty* branch because the commit had failed on a
  missing identity and the `&&` chain carried on. The push reported success.

## Verified environment facts

- **Cloudflare Pages serves both sites and strips `.html`.**
  `/agile.html` → 308 → `/agile`; `/index.html` → `/`. VTRAFFIC uses 307s.
  **Canonicals, og:url and sitemap entries must be extensionless** or they name
  a URL the crawler is bounced off.
- **Pages builds a preview for every branch**, at
  `https://<hash>.vestibular-5rj.pages.dev` and
  `https://<branch>.vestibular-5rj.pages.dev`. Get the URL from the Cloudflare
  Pages check-run summary via the GitHub API.
- **The contact backend runs on Render, and auto-deploys from `main`.** The
  `server: cloudflare` header is Render's own edge — it is not Cloudflare
  hosted. Free tier spins down; a measured cold start took 22.7s, which is why
  `contact.html` pings `/api/health` on page load.
- **CORS allows the apex, www, and this project's own Pages previews**
  (anchored regex on `vestibular-5rj.pages.dev`). Preview submissions are
  tagged `[PREVIEW]` in the email subject.
- **A PAT cannot read GitHub App installations or change repo settings.** Both
  return "Resource not accessible by personal access token".

## Open threads as of 2 Sep, end of session

- **The readiness instrument was rebuilt on 3 Sep.** Eight axes, sixteen
  questions, two VANTAGES per axis (what the organisation is understood to
  claim, against what the respondent has seen) rather than two indicators
  averaged. The result names a widest distance and a floor, and the
  "weakest axis" claim is retired. See `docs/READINESS_INSTRUMENT.md` — read it
  before touching `readiness.dimensions`, and note its open-issues list:
  **a ticked escape currently deletes the entire lived polygon**, which is
  deferred rather than unknown.
- **⛔ Static assets are cached for 4 hours with no version in the URL.**
  `styles.css` and `scripts/*.js` ship `max-age=14400`; HTML ships
  `max-age=0`. So a returning visitor gets NEW markup against OLD CSS/JS.
  This bit three times in one session: twice the layout looked broken, and
  once it silently disabled a feature (the readiness quiz did not write its
  shape payload, so enquiry emails arrived without the radar). Every time it
  looked like a code bug and was not. **Fix is a content hash in the URL** —
  `renderHead()` already writes every `<link>` and `<script>` tag, so the hash
  can be emitted there and the drift check would cover it.
- **VTRAFFIC:** `fix/og-card-copy-matches-site` is unmerged, and
  `images/og-card.png` is stale on production — it is generated from a capture
  that changed, and its baked-in subtitle still carries NSW-only wording.
  Regenerate on Godzilla with the brand fonts after merging.

## The generator contract

`content/practices.json` and `content/pages.json` are the source of truth;
`content/partials/` holds shared chrome. Anything between
`<!-- GENERATED:name START -->` and `<!-- GENERATED:name END -->` is produced by
`tools/render_content.mjs`. **Editing inside a marker is overwritten and CI
fails.** Change the source, then regenerate. See README for the add-a-page
checklist — it was followed verbatim to add `ai-proof.html` and it held.

Share cards (`tools/build_og_images.py`, and `tools/build_og_card.py` in
VTRAFFIC) are run by hand and deliberately **not** in the drift check: PNG
encoding is not byte-stable across Pillow/libpng versions, so CI would fail on
a library upgrade rather than on a real problem.

Prices store the **ex-GST integer only**; the GST-inclusive figure is derived
and never typed. See `docs/POSITIONING.md` for why inclusive must stay
prominent.

## Standing disciplines that earned their place this session

- **Drive every guard over a known-bad input, with a control either side.** A
  check that has never failed is indistinguishable from one that cannot. The
  on-site-days guard caught real broken content the moment it was added.
- **Read back after any write.** A repo settings PATCH returned 403 and would
  have been reported as done; the read-back is what caught it.
- **A passing check on an empty result is not a pass.** A drift comparison
  reported "0 drifted" because its parser had matched nothing.
- **Whitespace-normalise before judging a diff.** A first classifier reported
  109 unexplained changed lines; all were re-indentation.
- **Check rendered output at the size it will be seen.** An OG card looked fine
  at full size while its subtitle dissolved into the background at LinkedIn's
  actual 552px render width.
- **Measure the site, do not infer it.** Two claims made from reading CSS were
  wrong: an early drift report (Cloudflare had injected a script into the
  fetched HTML) and a "bug" that was deliberate design.

## One caution

**Do not infer design intent from CSS mechanics.** The logo overhanging the
topbar was called a bug this session — reading `--topbar-height: 74px` against
an unconstrained logo width. It is deliberate: `header.hero` has
`overflow: visible` and `.brand` is absolutely positioned at `z-index: 5` so the
mark breaks the topbar edge into the lime hero band. Ask before calling a visual
choice broken.

## Open items

See the "Open work" section of `docs/POSITIONING.md`. The next natural piece is
the **team-health kite chart** for the BA practice — the Agile scorecard now has
keyed dimensions and a per-dimension read, so a radar is a visual swap rather
than a rebuild.
