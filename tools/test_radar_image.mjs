/**
 * Checks for backend/radar_image.js.
 *
 * The shape payload arrives from a public contact form, so parseShape is an
 * input boundary, not a convenience. These assertions exist for the same
 * reason as the ones in test_radar.cjs: a renderer that merely *produces an
 * image* is indistinguishable from one that produces the wrong image, and the
 * output lands in an email nobody proofreads.
 *
 * The two failure directions are both tested deliberately:
 *   - a REJECT that should have been accepted silently drops the chart, which
 *     looks like the feature simply not working;
 *   - an ACCEPT that should have been rejected renders an authoritative-looking
 *     chart from values the visitor never gave.
 *
 * Run: node tools/test_radar_image.mjs
 */

import assert from 'node:assert';
import { renderReadinessRadar } from '../backend/radar_image.js';

const axes = (over = {}) => {
  const base = [
    { key: 'company_goals', label: 'Company goals', stated: 4, lived: 2 },
    { key: 'systems', label: 'Systems', stated: 3, lived: 3 },
    { key: 'pain_points', label: 'Pain points', stated: 4, lived: 4 },
    { key: 'morale', label: 'Morale', stated: 5, lived: 1 },
    { key: 'roles', label: 'Roles', stated: 2, lived: 3 },
    { key: 'ai_fit', label: 'AI fit', stated: 3, lived: 5 },
  ];
  return JSON.stringify({ axes: base.map((a, i) => ({ ...a, ...(over[i] || {}) })) });
};

let passed = 0;
const checks = [];
const check = (name, fn) => checks.push([name, fn]);

check('a well-formed six-axis payload renders a PNG', async () => {
  const r = await renderReadinessRadar(axes());
  assert.ok(r.image, 'expected a render');
  assert.strictEqual(r.reason, 'ok');
  assert.strictEqual(r.image.contentType, 'image/png');
  // PNG magic number survives the base64 round trip.
  assert.strictEqual(Buffer.from(r.image.base64, 'base64').subarray(0, 4).toString('hex'), '89504e47');
});

check('absent payload yields null, not a throw', async () => {
  assert.strictEqual((await renderReadinessRadar(undefined)).image, null);
  assert.strictEqual((await renderReadinessRadar('')).image, null);
  assert.strictEqual((await renderReadinessRadar(null)).image, null);
});

check('the prose summary is not mistaken for the shape', async () => {
  // These travel together in the same request; parsing one as the other would
  // be a silent wrong-field bug.
  assert.strictEqual((await renderReadinessRadar('Morale 5/1 (on paper/in practice). Widest gap: Morale 5 vs 1.')).image, null);
});

check('a value outside the 1-5 scale is rejected, not clamped', async () => {
  assert.strictEqual((await renderReadinessRadar(axes({ 0: { stated: 9 } }))).image, null);
  assert.strictEqual((await renderReadinessRadar(axes({ 0: { stated: 0 } }))).image, null);
  assert.strictEqual((await renderReadinessRadar(axes({ 0: { stated: 'x' } }))).image, null);
  assert.strictEqual((await renderReadinessRadar(axes({ 0: { lived: 9 } }))).image, null,
    'the lived vantage is validated too, not only the first one read');
});

/* ------------------------------------------------------------------ *
 * Two vantages. An axis carries a stated reading and a lived one, and the
 * distance between them is the whole point of the chart.
 * ------------------------------------------------------------------ */

check('an ABSENT vantage is tolerated by the VALIDATOR, not treated as malformed', async () => {
  // ⛔⛔ THIS PIN USED TO CLAIM MORE THAN IT MEASURED. It read
  //   assert.ok(r, 'a declined lived item must still render the rest of the shape')
  // and passed — because `r` was truthy for ANY image. The rendered PNG has NO
  // lived polygon at all: radar.js:77 computes
  // `plottable = points.every(p => p !== null)` and returns `polygon: null`
  // when a single axis is missing, so one absent vantage drops the whole shape
  // and leaves floating dots.
  //
  // The assertion was satisfied by bytes coming back. Nothing checked the
  // claim, which is how backend/radar_image.js came to carry a paragraph
  // describing gap-plotting behaviour the geometry never had.
  //
  // Corrected to assert what is TRUE rather than relaxed to make green: the
  // VALIDATOR tolerates absence, and that is the property worth keeping —
  // rejecting the payload would drop the chart entirely rather than partially.
  const r = await renderReadinessRadar(axes({ 3: { lived: undefined } }));
  assert.ok(r.image, 'the validator must accept a missing vantage, not reject the payload');
  assert.strictEqual(r.reason, 'ok');
});

check('a null vantage is tolerated the same way undefined is', async () => {
  const r = await renderReadinessRadar(axes({ 3: { lived: null } }));
  assert.ok(r.image, 'null and undefined must reach the same branch');
});

check('an absent vantage COSTS THE SHAPE, and that is recorded rather than assumed', async () => {
  // ⭐ THE MEASUREMENT BEHIND THE CORRECTION ABOVE, PINNED SO IT CANNOT DRIFT
  // BACK INTO FOLKLORE. A complete payload and one missing a single lived
  // vantage must NOT render alike — if they ever do, either the geometry
  // started gap-plotting (good, and this pin should be rewritten to say so) or
  // the absent value is being coerced to a number (bad, and it draws a reading
  // nobody gave).
  const complete = await renderReadinessRadar(axes());
  const missing = await renderReadinessRadar(axes({ 3: { lived: undefined } }));
  assert.ok(complete.image && missing.image, 'both should render');
  assert.notStrictEqual(complete.image.base64, missing.image.base64,
    'an absent vantage must change the image; identical bytes mean it was coerced');
});

/* ------------------------------------------------------------------ *
 * The reason is the diagnosis. A text-only email was the output of four
 * distinct faults and the only trace was a server-log warn.
 * ------------------------------------------------------------------ */

check('nothing sent and something-wrong-sent are DIFFERENT reasons', async () => {
  // ⛔ THE COLLAPSE THIS RETURN TYPE EXISTS TO REMOVE. "the browser held no
  // shape" is a front-end problem — usually a stale cached script. "a payload
  // arrived and failed validation" is a schema or hostile-input problem. They
  // want opposite investigations and both used to produce a bare null.
  assert.strictEqual((await renderReadinessRadar(undefined)).reason, 'no_shape');
  assert.strictEqual((await renderReadinessRadar('')).reason, 'no_shape');
  assert.strictEqual((await renderReadinessRadar('not json at all')).reason, 'malformed_shape');
  assert.strictEqual((await renderReadinessRadar(axes({ 0: { stated: 9 } }))).reason, 'malformed_shape');
});

check('a successful render says so explicitly', async () => {
  // Anti-vacuity for the reasons above: a function returning 'malformed_shape'
  // for everything would satisfy every assertion in the previous check.
  assert.strictEqual((await renderReadinessRadar(axes())).reason, 'ok');
});

check('a payload with no readings at all is null, not an empty frame', async () => {
  const empty = Array.from({ length: 6 }, (_, i) => ({ key: `k${i}`, label: `L${i}` }));
  assert.strictEqual((await renderReadinessRadar(JSON.stringify({ axes: empty }))).image, null);
});

check('the two vantages are drawn as two shapes, not merged', async () => {
  // Same axes, same labels, differing only in how far the readings diverge. A
  // renderer that averaged or dropped one would produce identical bytes.
  const wide = await renderReadinessRadar(JSON.stringify({ axes: [
    { key: 'a', label: 'A', stated: 5, lived: 1 },
    { key: 'b', label: 'B', stated: 5, lived: 1 },
    { key: 'c', label: 'C', stated: 5, lived: 1 },
  ] }));
  const narrow = await renderReadinessRadar(JSON.stringify({ axes: [
    { key: 'a', label: 'A', stated: 3, lived: 3 },
    { key: 'b', label: 'B', stated: 3, lived: 3 },
    { key: 'c', label: 'C', stated: 3, lived: 3 },
  ] }));
  assert.ok(wide.image && narrow.image, 'both should render');
  assert.notStrictEqual(wide.image.base64, narrow.image.base64,
    'a divergent reading and an aligned one must not produce the same image');
});

check('the same mean from different vantages is a different image', async () => {
  // ⛔ THE FAULT THIS WHOLE CHANGE EXISTS TO REMOVE. stated 5 / lived 1 and
  // stated 3 / lived 3 have the same mean. If these render alike, the pair is
  // being averaged somewhere.
  const diverged = await renderReadinessRadar(JSON.stringify({ axes: [
    { key: 'a', label: 'A', stated: 5, lived: 1 },
    { key: 'b', label: 'B', stated: 4, lived: 2 },
    { key: 'c', label: 'C', stated: 5, lived: 1 },
  ] }));
  const aligned = await renderReadinessRadar(JSON.stringify({ axes: [
    { key: 'a', label: 'A', stated: 3, lived: 3 },
    { key: 'b', label: 'B', stated: 3, lived: 3 },
    { key: 'c', label: 'C', stated: 3, lived: 3 },
  ] }));
  assert.ok(diverged.image && aligned.image, 'both should render');
  assert.notStrictEqual(diverged.image.base64, aligned.image.base64, 'the pair is being averaged');
});

check('too few axes is rejected', async () => {
  assert.strictEqual((await renderReadinessRadar(JSON.stringify({ axes: [{ key: 'a', label: 'A', stated: 1, lived: 1 }] }))).image, null);
});

check('too many axes is rejected', async () => {
  const many = Array.from({ length: 13 }, (_, i) => ({ key: `k${i}`, label: `L${i}`, stated: 3, lived: 3 }));
  assert.strictEqual((await renderReadinessRadar(JSON.stringify({ axes: many }))).image, null);
});

check('a key outside the safe charset is rejected', async () => {
  assert.strictEqual((await renderReadinessRadar(axes({ 0: { key: 'a b' } }))).image, null);
  assert.strictEqual((await renderReadinessRadar(axes({ 0: { key: '../etc' } }))).image, null);
});

check('markup in a label is escaped, not executed as SVG', async () => {
  // A closing tag in a label could otherwise break out of <text> and inject
  // arbitrary SVG into an email body.
  const r = await renderReadinessRadar(axes({ 0: { label: '</text><script>x</script>' } }));
  assert.ok(r.image, 'a hostile label should still render — escaped, not dropped');
});

check('an over-long label cannot unbound the canvas', async () => {
  const r = await renderReadinessRadar(axes({ 0: { label: 'x'.repeat(500) } }));
  assert.ok(r.image, 'expected a render');
  // Pad derives from label length, so an unbounded label would mean an
  // unbounded image. 40-char cap keeps it well under a megabyte.
  assert.ok(
    Buffer.from(r.image.base64, 'base64').length < 1_000_000,
    'label cap should bound the rendered size',
  );
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
console.log(`radar_image: ${passed}/${checks.length} checks passed`);
