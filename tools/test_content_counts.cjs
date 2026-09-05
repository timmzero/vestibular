/**
 * Checks that every prose claim about HOW MANY matches what the SSOT holds.
 *
 * `render_content.mjs --check` compares GENERATED regions against
 * content/practices.json. That is a real check and it covers a real class of
 * drift, but it is blind to two others, and both were live on main when this
 * file was written:
 *
 *   1. A count asserted in HAND-WRITTEN prose sitting immediately ABOVE a
 *      generated region. `ai-transformation.html` read "Six things we look at."
 *      directly above a generated block rendering SEVEN domain cards. The
 *      heading is outside the markers, so the drift check could not see it.
 *   2. A count asserted INSIDE the SSOT's own prose. `readiness.intro` says
 *      "Fourteen questions"; the drift check verifies the HTML matches that
 *      sentence, not that the sentence is true of `readiness.dimensions`.
 *      Source and page agree perfectly while both are wrong.
 *
 * The seven-axis commit claimed the count was "asserted in NINE places… All
 * moved together". Nine were — the nine the generator owns. Two live misses
 * survived it, and a third ("All twelve answered", at fourteen questions) sat
 * in a JS string at the exact moment a visitor completed the quiz.
 *
 * ⚠️ THE FIRST FIX FOR A COUNT CLAIM IS TO DELETE IT, NOT TO PIN IT. Where the
 * number is already in hand at the point of use, derive it: ba_readiness.js now
 * reads `geometry.questions` rather than restating it, so that string cannot
 * drift and is deliberately absent from the table below. Pin only the prose
 * that must carry a word a reader will read — a headline, an intro, a meta
 * description.
 *
 * Run: node tools/test_content_counts.cjs
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

const practices = JSON.parse(read('content/practices.json'));
const pages = JSON.parse(read('content/pages.json'));

const ai = practices.practices.ai_transformation;
const dimensions = ai.readiness.dimensions;
const domains = ai.domains;

const axis_count = dimensions.length;
const domain_count = domains.length;
const question_count = dimensions.reduce(
  (n, d) => n + (Array.isArray(d.questions) && d.questions.length ? d.questions.length : 1),
  0,
);

/**
 * Number words, up to a bound no plausible instrument reaches. Deliberately not
 * a library: the failure this guards against is a stale WORD in a sentence, so
 * the mapping has to cover exactly the forms the copy uses and nothing else.
 */
const WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen',
  'nineteen', 'twenty',
];

function word_for(n) {
  assert.ok(n >= 0 && n < WORDS.length, `no word for ${n} — extend WORDS`);
  return WORDS[n];
}

/**
 * Read the one capture group out of a body of text, and FAIL if the pattern
 * matched nothing.
 *
 * ⛔ A claim that has been reworded away must go red, not quietly green. A
 * passing check on an empty result is not a pass — a drift comparison on this
 * repo once reported "0 drifted" because its parser had matched nothing.
 *
 * ⚠️ `text` is the STRING TO SEARCH, and for anything living in a JSON source
 * it must be the parsed VALUE, not the raw file. Both practices keep an
 * `intro` and both begin with a number word, so a pattern loosened by one word
 * silently began matching the Agile diagnostic's "Six questions" while
 * reporting on the readiness instrument's sixteen. It read exactly like real
 * drift. Regex the file only for prose that has no path to read it by.
 */
function read_claim(where, text, pattern) {
  const m = text.match(pattern);
  assert.ok(
    m,
    `${where}: no text matched ${pattern}. The claim was reworded or removed — ` +
      'update this table rather than deleting the check.',
  );
  return m[1];
}

/**
 * Collect every failure rather than throwing on the first.
 *
 * Count drift arrives in clusters — one reshape left THREE stale claims across
 * two files — so a runner that dies on the first turns a single fix into one CI
 * round trip per claim, and the last one found looks like a new regression
 * rather than the tail of the same change.
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

/**
 * Every count claim a reader can see, with the SSOT quantity it must equal.
 *
 * `where` names the region deliberately: HAND-WRITTEN entries are the ones the
 * drift check cannot reach, and SSOT entries are prose inside the source itself.
 * Generated HTML needs no entry — the drift check already pins it to the source,
 * and the source is pinned here.
 */
const CLAIMS = [
  {
    file: 'ai-readiness.html',
    where: 'hand-written — hero headline',
    pattern: /<span>([A-Za-z]+) areas\.<\/span>/,
    expected: () => axis_count,
  },
  {
    file: 'ai-readiness.html',
    where: 'hand-written — hero intro',
    pattern: /we look at ([a-z]+) areas\./,
    expected: () => axis_count,
  },
  {
    file: 'ai-transformation.html',
    where: 'hand-written — section title above the generated domain cards',
    pattern: /<h2 class="section-title">([A-Za-z]+) things we look at\.<\/h2>/,
    expected: () => domain_count,
  },
  {
    file: 'ai-transformation.html',
    where: 'hand-written — section intro above the generated domain cards',
    pattern: /until all ([a-z]+) are understood/,
    expected: () => domain_count,
  },
  {
    file: 'ai-transformation.html',
    where: 'hand-written — cross-page link to the readiness check',
    pattern: /the ([a-z]+) areas we read before redesigning/,
    expected: () => axis_count,
  },
  {
    file: 'content/practices.json',
    text: () => ai.readiness.intro,
    where: 'SSOT — readiness.intro, question count',
    // Deliberately not anchored on the duration that follows. The duration is
    // a separate claim and is not derivable from the SSOT, so binding the two
    // makes an honest edit to one look like drift in the other — which it did,
    // the first time the intro was reworded after this check was written.
    pattern: /^([A-Za-z]+) questions, about/,
    expected: () => question_count,
  },
  {
    file: 'content/practices.json',
    text: () => ai.readiness.intro,
    where: 'SSOT — readiness.intro, area count',
    pattern: /each of the ([a-z]+) areas we look at/,
    expected: () => axis_count,
  },
  {
    file: 'content/pages.json',
    text: () => pages.pages['ai-readiness.html'].description,
    where: 'SSOT — ai-readiness meta description, question count',
    pattern: /A ([a-z]+)-question AI readiness assessment/,
    expected: () => question_count,
  },
  {
    file: 'content/pages.json',
    text: () => pages.pages['ai-readiness.html'].description,
    where: 'SSOT — ai-readiness meta description, area count',
    pattern: /readiness assessment across ([a-z]+) areas/,
    expected: () => axis_count,
  },
];

CLAIMS.forEach((claim) => {
  check(`${claim.file} — ${claim.where}`, () => {
    const body = claim.text ? claim.text() : read(claim.file);
    const found = read_claim(claim.file, body, claim.pattern);
    const want = word_for(claim.expected());
    assert.strictEqual(
      found.toLowerCase(),
      want,
      `${claim.file} says "${found}" where the SSOT holds ${claim.expected()} (${want}).`,
    );
  });
});

/**
 * The meta description does not only count the areas, it NAMES them. A stale
 * list is exactly as wrong as a stale number and nothing else would catch it —
 * splitting an axis leaves the sentence one name short while its count is
 * corrected, which reads as a typo rather than as drift.
 */
check('the meta description names as many areas as there are axes', () => {
  const listed = read_claim(
    'content/pages.json',
    pages.pages['ai-readiness.html'].description,
    /readiness assessment across [a-z]+ areas: ([^."]+)\./,
  );
  const names = listed.split(/,| and /).map((s) => s.trim()).filter(Boolean);
  assert.strictEqual(
    names.length,
    axis_count,
    `the description names ${names.length} areas (${names.join(' | ')}) against ${axis_count} axes.`,
  );
});

/**
 * The parallel invariant. `readiness.dimensions` and `domains` run side by side
 * and the pillar area-map on the readiness page renders from DOMAINS, so
 * splitting a quiz axis without splitting its domain prints one count beside a
 * chart with a different number of spokes. Documented in
 * docs/READINESS_INSTRUMENT.md and, until now, enforced by nothing.
 */
check('readiness axes and discovery domains stay parallel', () => {
  assert.strictEqual(
    axis_count,
    domain_count,
    `${axis_count} quiz axes against ${domain_count} domains — the area map and the radar will disagree.`,
  );
});

/**
 * The radar the server draws for the enquiry email is bounded, and rejecting an
 * over-long payload returns null, which server.js renders as NO CHART AT ALL.
 * That is silent: the email arrives looking ordinary, minus the thing it was
 * sent to carry. Growing the instrument past the cap must go red here rather
 * than in an inbox.
 */
check('the axis count fits the server-side radar cap', () => {
  const src = read('backend/radar_image.js');
  const cap = Number(read_claim('backend/radar_image.js', src, /const MAX_AXES = (\d+);/));
  assert.ok(Number.isFinite(cap), 'MAX_AXES is not a number');
  assert.ok(
    axis_count <= cap,
    `${axis_count} axes against MAX_AXES ${cap} — parseShape would return null and the ` +
      'enquiry email would silently arrive with no radar.',
  );
  assert.ok(
    /if \(data\.axes\.length < 3 \|\| data\.axes\.length > MAX_AXES\) return null;/.test(src),
    'the cap is no longer applied the way this check assumes — re-read parseShape',
  );
});

/**
 * ⛔ KEYS ARE CONSTRUCT + VANTAGE, NEVER POSITIONAL. `morale_2` named
 * psychological safety in one shape and a workload item in the next, and
 * `systems_1` meant three different things inside one day. Keys are sent to the
 * server in the enquiry payload, so a key that changes meaning silently makes
 * two responses incomparable — which is fatal to the multi-respondent and norms
 * routes that are the whole reason for ever retaining a response.
 */
check('every question key is its axis key plus its vantage', () => {
  dimensions.forEach((d) => {
    d.questions.forEach((q) => {
      assert.strictEqual(
        q.key,
        `${d.key}_${q.vantage}`,
        `${q.key} does not name its construct and vantage`,
      );
    });
  });
  const keys = dimensions.flatMap((d) => d.questions.map((q) => q.key));
  assert.strictEqual(new Set(keys).size, keys.length, 'a question key is reused');
});

/**
 * Each axis is one construct seen twice, not two indicators averaged. An axis
 * missing a vantage would make the form renderer throw rather than emit a
 * half-grouped block — which would put a pair back beside each other, where
 * consistency bias closes the very gap the instrument exists to measure.
 */
check('every axis carries exactly one stated and one lived item', () => {
  dimensions.forEach((d) => {
    const vantages = d.questions.map((q) => q.vantage);
    assert.deepStrictEqual(
      vantages, ['stated', 'lived'],
      `${d.key} carries [${vantages}]`,
    );
  });
});

/**
 * ⚠️ renderScorecardFields is SHARED with the Agile scorecard on
 * diagnostic.html. Vantage grouping is additive and defaults absent, so the
 * Agile path must stay ungrouped and its rendered fields byte-identical. Pinned
 * as a property rather than trusted to a one-off diff, because the next person
 * to touch that renderer will not think to run one.
 */
check('the agile diagnostic carries no vantage, so it takes the ungrouped path', () => {
  const agile = practices.practices.agile.diagnostic.dimensions;
  const tagged = agile
    .flatMap((d) => (Array.isArray(d.questions) ? d.questions : []))
    .filter((q) => q.vantage);
  assert.strictEqual(
    tagged.length, 0,
    'the agile scorecard now carries vantages — its rendered fields will regroup',
  );
});

/**
 * ⭐ DRIVE THE COMPARATOR OVER A KNOWN-BAD, WITH A CONTROL EITHER SIDE. A check
 * that has never failed is indistinguishable from one that cannot, and the two
 * defects this file was written to catch had both been live for a day under a
 * CI run that was green throughout.
 */
check('the comparator rejects a wrong word, and a missing claim', () => {
  assert.throws(
    () => assert.strictEqual('six', word_for(7), 'known-bad'),
    'a stale word must fail',
  );
  assert.doesNotThrow(
    () => assert.strictEqual('seven', word_for(7)),
    'the control must pass',
  );
  assert.throws(
    () => read_claim('ai-readiness.html', read('ai-readiness.html'), /this sentence is not in the file/),
    /no text matched/,
    'a claim that was reworded away must fail loudly, not pass on an empty match',
  );
});

console.log(
  `\n(${axis_count} axes, ${question_count} questions, ${domain_count} domains)`,
);

if (failures.length) {
  console.error(`\n${failures.length} content-count check(s) FAILED:\n`);
  failures.forEach((f) => console.error(`  ${f.name}\n    ${f.message}\n`));
  process.exit(1);
}

console.log(passed + ' content-count checks passed');
