/**
 * Checks for backend/readiness_table.js, and for the one coupling that makes
 * the radar's all-or-nothing rule safe.
 *
 * Run: node tools/test_readiness_email.mjs
 *
 * ⛔ THE TABLE'S WHOLE JOB IS A DISTINCTION THE PROSE COLLAPSES. The one-line
 * summary renders 1/1 and 5/5 identically in structure, and dimension_read.js
 * splits `is-aligned-low` from `is-aligned-high` precisely because those are
 * the two most opposite readings the scale can produce. A table that rendered
 * them alike would look completely correct and carry nothing.
 */

import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { renderReadinessTable } from '../backend/readiness_table.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const shape = (axes) => JSON.stringify({ axes });
const full = (over = {}) => shape([
  { key: 'company_goals', label: 'Company goals', stated: 1, lived: 1, ...(over.a || {}) },
  { key: 'roles', label: 'Roles', stated: 1, lived: 5, ...(over.b || {}) },
  { key: 'ai_fit', label: 'AI fit', stated: 4, lived: 2, ...(over.c || {}) },
]);

let passed = 0;
const checks = [];
const check = (name, fn) => checks.push([name, fn]);

/* ------------------------------------------------------------------ *
 * The table
 * ------------------------------------------------------------------ */

check('a well-formed payload renders one row per axis', async () => {
  const r = await renderReadinessTable(full());
  assert.ok(r.html, 'expected a table');
  assert.strictEqual(r.reason, 'ok');
  assert.strictEqual((r.html.match(/<tr>/g) || []).length, 4, 'header + three rows');
  for (const label of ['Company goals', 'Roles', 'AI fit']) {
    assert.ok(r.html.includes(label), `${label} missing from the breakdown`);
  }
});

check('ALIGNED-LOW AND ALIGNED-HIGH ARE NOT THE SAME ROW', async () => {
  // ⛔⛔ THE PIN THIS FILE EXISTS FOR. 1/1 and 5/5 both have zero gap. Reading
  // them alike is the defect dimension_read.js:442-451 was written to fix, and
  // a table that reproduced it would look entirely plausible.
  const low = await renderReadinessTable(shape([{ key: 'a', label: 'A', stated: 1, lived: 1 }]));
  const high = await renderReadinessTable(shape([{ key: 'a', label: 'A', stated: 5, lived: 5 }]));
  assert.ok(low.html && high.html, 'both should render');
  assert.notStrictEqual(low.html, high.html,
    'agreed-low and agreed-high rendered identically — the pair is being read as one');
  assert.ok(low.html.includes('agreed, and agreed low'), 'the alarm row must be named');
});

check('the two directions of divergence are distinguished', async () => {
  // Claiming above what was seen and seeing above what was claimed are
  // different findings; |gap| alone would render them alike.
  const claimed = await renderReadinessTable(shape([{ key: 'a', label: 'A', stated: 5, lived: 2 }]));
  const lived = await renderReadinessTable(shape([{ key: 'a', label: 'A', stated: 2, lived: 5 }]));
  assert.notStrictEqual(claimed.html, lived.html, 'gap direction is being discarded');
});

check('the band cut point is the SHARED one, not a second copy', async () => {
  // dimension_read.js: band_for returns band-weak below 3. So 2/2 is
  // aligned-LOW and 3/3 is aligned-HIGH. Restating the threshold in
  // readiness_table.js would drift from the on-page rendering the first time
  // either moved, and the drift would surface only in an email.
  const below = await renderReadinessTable(shape([{ key: 'a', label: 'A', stated: 2, lived: 2 }]));
  const at = await renderReadinessTable(shape([{ key: 'a', label: 'A', stated: 3, lived: 3 }]));
  assert.ok(below.html.includes('agreed, and agreed low'), '2/2 should read as agreed-low');
  assert.ok(!at.html.includes('agreed, and agreed low'), '3/3 should not');
});

check('an absent reading is a dash, never a zero', async () => {
  // A 0 would be a value the visitor never gave, on a scale that starts at 1.
  const r = await renderReadinessTable(full({ b: { lived: undefined } }));
  assert.ok(r.html.includes('&mdash;'), 'absent must render as a dash');
  assert.ok(!/>0</.test(r.html), 'absent must never render as 0');
  assert.ok(r.html.includes('not answered'), 'absence must be named, not just blank');
});

check('an out-of-range value is treated as absent, not clamped', async () => {
  // Clamping would print a reading the visitor never gave, and it would look
  // authoritative sitting in a table.
  const r = await renderReadinessTable(full({ b: { lived: 9 } }));
  assert.ok(r.html.includes('&mdash;'), '9 should fall through to absent');
  assert.ok(!r.html.includes('>9<'), 'an out-of-scale number must not be printed');
});

check('markup in a label is escaped, not injected into the email body', async () => {
  const r = await renderReadinessTable(shape([
    { key: 'a', label: '<script>alert(1)</script>', stated: 3, lived: 3 },
  ]));
  assert.ok(r.html, 'a hostile label should still render');
  assert.ok(!r.html.includes('<script>'), 'raw script tag reached the email body');
  assert.ok(r.html.includes('&lt;script&gt;'), 'expected the escaped form');
});

check('the table carries no external styling dependency', async () => {
  // An email cannot read styles.css. A class attribute here renders as
  // unstyled text in every client.
  const r = await renderReadinessTable(full());
  assert.ok(!/\sclass=/.test(r.html), 'class attribute cannot resolve in an email');
  assert.ok(r.html.includes('style="'), 'expected inline styles');
});

check('a missing breakdown says WHICH fault produced it', async () => {
  assert.strictEqual((await renderReadinessTable(undefined)).reason, 'no_shape');
  assert.strictEqual((await renderReadinessTable('')).reason, 'no_shape');
  assert.strictEqual((await renderReadinessTable('not json')).reason, 'malformed_shape');
  assert.strictEqual((await renderReadinessTable('{"axes":"nope"}')).reason, 'malformed_shape');
  // Anti-vacuity: a function answering 'malformed_shape' for everything would
  // satisfy every assertion above.
  assert.strictEqual((await renderReadinessTable(full())).reason, 'ok');
});

/* ------------------------------------------------------------------ *
 * The coupling. This is the part that is not about the table.
 * ------------------------------------------------------------------ */

check('NO ESCAPE EXISTS WHILE THE GEOMETRY IS ALL-OR-NOTHING', async () => {
  // ⛔⛔ radar.js:77 computes `plottable = points.every(p => p !== null)` and
  // returns `polygon: null` when ANY axis is absent — so one declined vantage
  // drops the ENTIRE shape and leaves floating dots.
  //
  // That is the RIGHT rule today: it makes the on-page chart form progressively
  // as the form is filled, and no live payload can carry an absent vantage
  // because 0726ac8 and e38c2ba removed the last escapes in favour of
  // answering neutral. The rule is correct BY PRECONDITION, not by design.
  //
  // Reintroduce an escape and the shape silently vanishes for exactly the
  // respondents who used it — which already happened once in prose: a comment
  // in radar_image.js described gap-plotting the geometry never had, and
  // nothing measured the claim. This pins the two facts to each other.
  //
  // ⭐ MEASURED, NOT GREPPED. The all-or-nothing behaviour is established by
  // CALLING the geometry with a missing value, so a refactor that keeps the
  // behaviour and moves the line still passes, and one that changes the
  // behaviour is seen whatever the source looks like.
  const mod = await import('../scripts/radar.js');
  const radar = mod.default;
  assert.ok(radar && radar.radar_geometry, 'shared geometry must be importable');

  // ⚠️ FIVE AXES, NOT THREE, AND THE SIZE IS LOAD-BEARING. The first draft of
  // this probe used the minimum three; dropping one leaves TWO points, which
  // cannot form a polygon under EITHER rule, so all-or-nothing and gap-plotting
  // were indistinguishable and a mutation that switched the geometry to
  // gap-plotting SURVIVED this guard. Correct by fixture choice is not correct.
  // Five minus one leaves four, comfortably above any polygon threshold.
  const dimensions = ['a', 'b', 'c', 'd', 'e'].map((k) => ({ key: k, label: k.toUpperCase() }));
  const opts = { dimensions, max: 5, radius: 100, cx: 100, cy: 100 };
  const complete = radar.radar_geometry({ ...opts, values: { a: 3, b: 3, c: 3, d: 3, e: 3 } });
  const partial = radar.radar_geometry({ ...opts, values: { a: 3, b: 3, c: 3, d: 3 } });

  // Anti-vacuity: if the probe cannot even draw a complete shape, the verdict
  // below would be meaningless.
  assert.ok(complete.polygon, 'probe is broken — a complete payload drew no polygon');

  const allOrNothing = partial.polygon === null;

  const practices = readFileSync(join(ROOT, 'content', 'practices.json'), 'utf8');
  const escapes = (practices.match(/"escape"/g) || []).length;

  assert.ok(
    !(escapes > 0 && allOrNothing),
    `content/practices.json declares ${escapes} escape(s) while radar_geometry drops the whole `
    + 'polygon on an absent axis. A respondent who declines would get floating dots and no shape. '
    + 'Either draw a broken polyline that skips the absent axis, or remove the escape.',
  );

  // The other direction, so this cannot pass by the probe silently breaking:
  // exactly one of the two states must hold, and today it is the second.
  assert.ok(escapes === 0 || !allOrNothing, 'unreachable — kept for the reader');
  assert.strictEqual(allOrNothing, true,
    'the geometry stopped being all-or-nothing — good, but this guard and the '
    + 'comment in backend/radar_image.js both describe the old behaviour and must be rewritten');
});

for (const [name, fn] of checks) {
  try {
    await fn();
    passed += 1;
  } catch (err) {
    console.error(`FAIL  ${name}\n      ${err.message}`);
    process.exit(1);
  }
}
console.log(`readiness_email: ${passed}/${checks.length} checks passed`);
