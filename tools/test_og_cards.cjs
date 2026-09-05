/**
 * Checks that every committed share card still matches content/pages.json.
 *
 * This is the one artifact in the pipeline that had no guard, and it drifted.
 * `assets/og/ai-readiness.png` advertised "A twelve-question readiness check
 * across six areas" for the whole life of a SIXTEEN-question, EIGHT-area
 * instrument. It was live, it was shareable, and every other check was green —
 * the title moved in pages.json, the page and its meta tags followed via
 * render_content.mjs, and nobody re-ran build_og_images.py. A card is the one
 * place where text is pixels, so no text comparison anywhere else could see it.
 *
 * ⚠️ THIS DOES NOT RE-RENDER THE CARDS, AND DELIBERATELY SO. PNG encoding is
 * not byte-stable across Pillow and libpng versions, so a byte comparison would
 * go red on a dependency upgrade rather than on a real problem. Re-rendering
 * would also drag Python, Pillow, libcairo and the IBM Plex fonts into a
 * Node-only CI, and the fonts are not in the repo.
 *
 * Instead build_og_images.py writes assets/og/manifest.json recording the
 * pages.json strings each card was rendered FROM, plus the PNG's sha256. This
 * file asserts three things, and the third is what makes the first two mean
 * anything:
 *
 *   1. The values each card was rendered FROM still equal what its declared
 *      source says. Change a title without re-running the generator and this
 *      goes red. Each entry names its own source file and path, so the root
 *      card — derived from practices.json's brand.hero rather than from a
 *      <title> — is checked by the same code path as every other card, and
 *      this file never has to reimplement that derivation.
 *   2. Every page has a card and every card has a page — a new page silently
 *      shipping without a card is the same defect one step earlier.
 *   3. Every PNG's sha256 still equals the manifest's. This is what stops the
 *      manifest being quietly hand-corrected to match pages.json: the only
 *      route to a manifest that satisfies (1) AND (3) is running the generator,
 *      which re-renders the PNG.
 *
 * ⛔ The manifest is a GENERATED artifact. When this check goes red the fix is
 * `python3 tools/build_og_images.py`, never an edit to manifest.json.
 *
 * Run: node tools/test_og_cards.cjs
 */

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

const pages = JSON.parse(read('content/pages.json')).pages;

const MANIFEST_PATH = 'assets/og/manifest.json';
assert.ok(
  fs.existsSync(path.join(root, MANIFEST_PATH)),
  `${MANIFEST_PATH} is missing. Run: python3 tools/build_og_images.py`,
);
const manifest = JSON.parse(read(MANIFEST_PATH)).cards;

/**
 * Collect every failure rather than throwing on the first, matching the other
 * checks in this directory. Card drift arrives per-page, so a runner that dies
 * on the first turns one regeneration into one CI round trip per card.
 */
let passed = 0;
const failures = [];
function check(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ok   ' + name);
  } catch (err) {
    failures.push({ name: name, message: err.message });
    console.log('  FAIL ' + name);
  }
}

const page_files = Object.keys(pages).sort();
const card_files = Object.keys(manifest).sort();

// (2) first: a missing entry would otherwise surface as a confusing undefined
// inside the per-card comparisons below.
check('every page has a card, and every card has a page', () => {
  const missing_card = page_files.filter((f) => !card_files.includes(f));
  const orphan_card = card_files.filter((f) => !page_files.includes(f));
  assert.deepStrictEqual(
    { missing_card: missing_card, orphan_card: orphan_card },
    { missing_card: [], orphan_card: [] },
    'pages.json and the card manifest disagree about which pages exist. ' +
      'Run: python3 tools/build_og_images.py',
  );
});

for (const page_file of page_files) {
  const entry = manifest[page_file];
  if (!entry) continue; // already reported by the census above

  // (1) the card was rendered from source values that have not since moved
  check(`${page_file} — card source is current`, () => {
    const src = entry.source;
    assert.ok(
      src && src.file && src.path && src.values,
      'manifest entry has no source record. Run: python3 tools/build_og_images.py',
    );

    // Follow the declared path rather than assuming pages.json. The root card
    // is derived from practices.json's brand.hero — see card_source() in
    // build_og_images.py for why. Comparing the SOURCE VALUES, not the drawn
    // output, is what lets this file stay ignorant of that transformation
    // instead of carrying a second copy of it in another language.
    // `path` is a list of keys, not a dotted string: page keys are filenames
    // and contain dots, so 'pages.services.html' would split into three.
    assert.ok(Array.isArray(src.path), 'manifest source.path must be a list of keys');
    const where = src.path.join(' -> ');
    const doc = JSON.parse(read(src.file));
    const actual = src.path.reduce((node, key) => {
      assert.ok(
        node && Object.prototype.hasOwnProperty.call(node, key),
        `${src.file} has no ${where} — the source moved or was renamed`,
      );
      return node[key];
    }, doc);

    for (const [key, recorded] of Object.entries(src.values)) {
      assert.deepStrictEqual(
        actual[key],
        recorded,
        `${src.file} ${where}.${key} has moved since the card was rendered.\n` +
          `    card was rendered from: ${JSON.stringify(recorded)}\n` +
          `    source now says:        ${JSON.stringify(actual[key])}\n` +
          '    Run: python3 tools/build_og_images.py',
      );
    }
  });

  // (3) the manifest entry still describes the PNG that is actually committed
  check(`${page_file} — PNG matches its manifest hash`, () => {
    const png = path.join('assets/og', path.basename(page_file, '.html') + '.png');
    assert.ok(fs.existsSync(path.join(root, png)), `${png} is missing`);
    const actual = crypto
      .createHash('sha256')
      .update(fs.readFileSync(path.join(root, png)))
      .digest('hex');
    assert.strictEqual(
      actual,
      entry.sha256,
      `${png} does not match the manifest.\n    manifest: ${entry.sha256}\n` +
        `    actual:   ${actual}\n` +
        '    The card or the manifest was changed without the other. ' +
        'Run: python3 tools/build_og_images.py',
    );
  });
}

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log('');
  for (const f of failures) console.log(`FAIL ${f.name}\n  ${f.message}\n`);
  process.exit(1);
}
