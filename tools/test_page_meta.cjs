/**
 * Checks the per-page <head> metadata in content/pages.json for the two faults
 * that are invisible everywhere else: descriptions that repeat, and
 * descriptions the share card cannot fit.
 *
 * Both were live when this file was written.
 *
 * ONE SENTENCE WAS DOING THE WORK OF FOUR. index.html, playbook.html and
 * services.html carried byte-identical descriptions, and diagnostic.html
 * carried the same sentence with two clauses swapped — "rebuild morale,
 * declutter Agile tooling" against "declutter Agile tooling, rebuild morale".
 * An exact-match census finds three of those four and reports the fourth as
 * unique, which is why this file compares SORTED WORD MULTISETS as well: a
 * reordered clause changes every byte and changes no word.
 *
 * ⚠️ THE MULTISET CHECK IS DELIBERATELY NOT A SIMILARITY THRESHOLD. A ratio
 * needs a cutoff, a cutoff needs tuning, and a tuned cutoff goes stale the
 * first time someone writes a legitimately similar pair. Same words in a
 * different order is a fact, not a judgement, and it is the shape the real
 * defect took.
 *
 * THREE DESCRIPTIONS WERE LONGER THAN THE CARD COULD DRAW. build_og_images.py
 * trims at 155 characters, so ai-proof (157), ai-services (163) and
 * ai-transformation (157) each shipped a card ending in an ellipsis nobody
 * chose. 155 is the card's boundary, not a search-engine one — it is asserted
 * here because that is where the text is silently altered.
 *
 * ⛔ WHAT THIS FILE CANNOT SEE. The card also caps the description at three
 * RENDERED lines, and a string under 155 characters can still overflow that in
 * wide glyphs — measured, an 89-character string wraps to four lines. Line
 * count depends on the font, so it cannot be computed here. That case is
 * guarded at generation time instead: build_og_images.py now exits rather than
 * dropping the overflow, so the failure is loud where the pixels are.
 *
 * Run: node tools/test_page_meta.cjs
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const pages = JSON.parse(fs.readFileSync(path.join(root, 'content/pages.json'), 'utf8')).pages;

/** The character count at which build_og_images.py trims a card description. */
const CARD_TRIM = 155;

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

const files = Object.keys(pages).sort();

check('every page has a title and a description', () => {
  const empty = files.filter(
    (f) => !String(pages[f].title || '').trim() || !String(pages[f].description || '').trim(),
  );
  assert.deepStrictEqual(empty, [], 'pages with missing or blank metadata');
});

check('no two pages share a description', () => {
  const seen = new Map();
  const clashes = [];
  for (const f of files) {
    const desc = pages[f].description;
    if (seen.has(desc)) clashes.push(`${seen.get(desc)} and ${f}`);
    else seen.set(desc, f);
  }
  assert.deepStrictEqual(
    clashes,
    [],
    'identical descriptions give search engines one summary for several URLs, ' +
      'and render identical text onto several share cards',
  );
});

check('no two descriptions are the same words reordered', () => {
  const seen = new Map();
  const clashes = [];
  for (const f of files) {
    // Same words, any order or punctuation — the shape diagnostic.html took.
    const key = pages[f].description
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, '')
      .split(/\s+/)
      .filter(Boolean)
      .sort()
      .join(' ');
    if (seen.has(key)) clashes.push(`${seen.get(key)} and ${f}`);
    else seen.set(key, f);
  }
  assert.deepStrictEqual(clashes, [], 'descriptions differing only in word order');
});

for (const f of files) {
  check(`${f} — description fits the card without being trimmed`, () => {
    const n = pages[f].description.length;
    assert.ok(
      n <= CARD_TRIM,
      `${n} characters, over the ${CARD_TRIM} the card draws. It would ship with a ` +
        'trailing ellipsis nobody chose. Shorten it, or accept the trim deliberately ' +
        'by raising CARD_TRIM here and in build_og_images.py together.',
    );
  });
}

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log('');
  for (const f of failures) console.log(`FAIL ${f.name}\n  ${f.message}\n`);
  process.exit(1);
}
