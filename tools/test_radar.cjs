/**
 * Geometry checks for scripts/radar.js.
 *
 * The maths is separated from the DOM precisely so it can be checked here,
 * with no browser. These assertions exist because a radar that is merely
 * *plausible* is indistinguishable from one that is correct: a wrong angle or
 * a missing-value plotted at the centre both produce a chart that renders
 * happily and lies.
 *
 * Run: node tools/test_radar.cjs
 */

const assert = require('assert');
const { radar_geometry, ring_radii } = require('../scripts/radar.js');

const dimensions = [
  { key: 'wellbeing', label: 'Wellbeing' },
  { key: 'psychological_safety', label: 'Psychological safety' },
  { key: 'clarity', label: 'Clarity' },
  { key: 'cohesion', label: 'Cohesion' },
  { key: 'role_fit', label: 'Role fit' },
  { key: 'change_readiness', label: 'Change readiness' },
];

const all = (v) => Object.fromEntries(dimensions.map((d) => [d.key, v]));
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

let passed = 0;
function check(name, fn) {
  fn();
  passed++;
  console.log('  ok   ' + name);
}

// --- axes -------------------------------------------------------------------

check('one axis per dimension', () => {
  const g = radar_geometry({ dimensions, values: {}, max: 5, radius: 100, cx: 0, cy: 0 });
  assert.strictEqual(g.axes.length, 6);
});

check('first axis is at 12 o_clock', () => {
  const g = radar_geometry({ dimensions, values: {}, max: 5, radius: 100, cx: 0, cy: 0 });
  assert.ok(near(g.axes[0].x, 0, 1e-12), 'x should be 0, got ' + g.axes[0].x);
  assert.ok(near(g.axes[0].y, -100), 'y should be -100, got ' + g.axes[0].y);
});

check('axes are evenly spaced and run clockwise', () => {
  const g = radar_geometry({ dimensions, values: {}, max: 5, radius: 100, cx: 0, cy: 0 });
  const step = (Math.PI * 2) / 6;
  for (let i = 1; i < 6; i++) {
    assert.ok(near(g.axes[i].angle - g.axes[i - 1].angle, step, 1e-12));
  }
  // clockwise in SVG coords: second axis is to the RIGHT of the first
  assert.ok(g.axes[1].x > g.axes[0].x);
});

// --- value to radius --------------------------------------------------------

check('max value sits on the outer ring', () => {
  const g = radar_geometry({ dimensions, values: all(5), max: 5, radius: 100, cx: 0, cy: 0 });
  g.points.forEach((p) => assert.ok(near(Math.hypot(p.x, p.y), 100, 1e-9)));
});

check('minimum value sits at one fifth of the radius', () => {
  const g = radar_geometry({ dimensions, values: all(1), max: 5, radius: 100, cx: 0, cy: 0 });
  g.points.forEach((p) => assert.ok(near(Math.hypot(p.x, p.y), 20, 1e-9)));
});

check('centre offset is respected', () => {
  const g = radar_geometry({ dimensions, values: all(5), max: 5, radius: 100, cx: 150, cy: 150 });
  assert.ok(near(g.axes[0].x, 150, 1e-12) && near(g.axes[0].y, 50));
});

// --- absent values ----------------------------------------------------------
// The anti-fabrication rule: a blank answer must not be drawn as a zero.

check('a blank answer is ABSENT, not zero', () => {
  const values = all(5);
  values.clarity = '';
  const g = radar_geometry({ dimensions, values, max: 5, radius: 100, cx: 0, cy: 0 });
  const i = dimensions.findIndex((d) => d.key === 'clarity');
  assert.strictEqual(g.points[i], null);
  assert.strictEqual(g.complete, false);
  assert.strictEqual(g.polygon, null, 'no polygon may be drawn over a partial set');
});

check('a missing key is ABSENT', () => {
  const values = all(3);
  delete values.role_fit;
  const g = radar_geometry({ dimensions, values, max: 5, radius: 100, cx: 0, cy: 0 });
  assert.strictEqual(g.points[dimensions.findIndex((d) => d.key === 'role_fit')], null);
  assert.strictEqual(g.polygon, null);
});

check('out-of-range values are rejected, not clamped', () => {
  for (const bad of [0, 6, -3, 99]) {
    const values = all(3);
    values.cohesion = bad;
    const g = radar_geometry({ dimensions, values, max: 5, radius: 100, cx: 0, cy: 0 });
    assert.strictEqual(
      g.points[dimensions.findIndex((d) => d.key === 'cohesion')], null,
      'value ' + bad + ' should be rejected'
    );
  }
});

check('non-numeric values are rejected', () => {
  const values = all(3);
  values.wellbeing = 'four';
  const g = radar_geometry({ dimensions, values, max: 5, radius: 100, cx: 0, cy: 0 });
  assert.strictEqual(g.points[0], null);
});

check('a full set produces a six-vertex polygon', () => {
  const g = radar_geometry({ dimensions, values: all(4), max: 5, radius: 100, cx: 0, cy: 0 });
  assert.strictEqual(g.complete, true);
  assert.strictEqual(g.polygon.split(' ').length, 6);
});

// --- rings ------------------------------------------------------------------

check('ring_radii returns one ring per scale point, outermost first', () => {
  const r = ring_radii(5, 100);
  assert.deepStrictEqual(r, [100, 80, 60, 40, 20]);
});

// --- guards -----------------------------------------------------------------

check('empty dimensions throws rather than drawing nothing quietly', () => {
  assert.throws(() => radar_geometry({ dimensions: [], values: {}, max: 5, radius: 100 }));
});

check('works for axis counts other than six', () => {
  for (const n of [3, 4, 8, 11]) {
    const dims = Array.from({ length: n }, (_, i) => ({ key: 'k' + i, label: 'L' + i }));
    const values = Object.fromEntries(dims.map((d) => [d.key, 5]));
    const g = radar_geometry({ dimensions: dims, values, max: 5, radius: 100, cx: 0, cy: 0 });
    assert.strictEqual(g.axes.length, n);
    assert.strictEqual(g.polygon.split(' ').length, n);
  }
});

console.log('\n' + passed + ' geometry checks passed');
