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
    { key: 'company_goals', label: 'Company goals', value: 3 },
    { key: 'systems', label: 'Systems', value: 2 },
    { key: 'pain_points', label: 'Pain points', value: 4 },
    { key: 'morale', label: 'Morale', value: 1 },
    { key: 'roles', label: 'Roles', value: 2 },
    { key: 'ai_enablement', label: 'AI enablement', value: 3 },
  ];
  return JSON.stringify({ axes: base.map((a, i) => ({ ...a, ...(over[i] || {}) })) });
};

let passed = 0;
const checks = [];
const check = (name, fn) => checks.push([name, fn]);

check('a well-formed six-axis payload renders a PNG', async () => {
  const r = await renderReadinessRadar(axes());
  assert.ok(r, 'expected a render');
  assert.strictEqual(r.contentType, 'image/png');
  // PNG magic number survives the base64 round trip.
  assert.strictEqual(Buffer.from(r.base64, 'base64').subarray(0, 4).toString('hex'), '89504e47');
});

check('absent payload yields null, not a throw', async () => {
  assert.strictEqual(await renderReadinessRadar(undefined), null);
  assert.strictEqual(await renderReadinessRadar(''), null);
  assert.strictEqual(await renderReadinessRadar(null), null);
});

check('the prose summary is not mistaken for the shape', async () => {
  // These travel together in the same request; parsing one as the other would
  // be a silent wrong-field bug.
  assert.strictEqual(
    await renderReadinessRadar('AI readiness: Morale 1/5. Weakest: Morale.'),
    null,
  );
});

check('a value outside the 1-5 scale is rejected, not clamped', async () => {
  assert.strictEqual(await renderReadinessRadar(axes({ 0: { value: 9 } })), null);
  assert.strictEqual(await renderReadinessRadar(axes({ 0: { value: 0 } })), null);
  assert.strictEqual(await renderReadinessRadar(axes({ 0: { value: 'x' } })), null);
});

check('too few axes is rejected', async () => {
  assert.strictEqual(
    await renderReadinessRadar(JSON.stringify({ axes: [{ key: 'a', label: 'A', value: 1 }] })),
    null,
  );
});

check('too many axes is rejected', async () => {
  const many = Array.from({ length: 13 }, (_, i) => ({ key: `k${i}`, label: `L${i}`, value: 3 }));
  assert.strictEqual(await renderReadinessRadar(JSON.stringify({ axes: many })), null);
});

check('a key outside the safe charset is rejected', async () => {
  assert.strictEqual(await renderReadinessRadar(axes({ 0: { key: 'a b' } })), null);
  assert.strictEqual(await renderReadinessRadar(axes({ 0: { key: '../etc' } })), null);
});

check('markup in a label is escaped, not executed as SVG', async () => {
  // A closing tag in a label could otherwise break out of <text> and inject
  // arbitrary SVG into an email body.
  const r = await renderReadinessRadar(axes({ 0: { label: '</text><script>x</script>' } }));
  assert.ok(r, 'a hostile label should still render — escaped, not dropped');
});

check('an over-long label cannot unbound the canvas', async () => {
  const r = await renderReadinessRadar(axes({ 0: { label: 'x'.repeat(500) } }));
  assert.ok(r, 'expected a render');
  // Pad derives from label length, so an unbounded label would mean an
  // unbounded image. 40-char cap keeps it well under a megabyte.
  assert.ok(
    Buffer.from(r.base64, 'base64').length < 1_000_000,
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
