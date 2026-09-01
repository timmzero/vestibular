/**
 * Checks for scripts/dimension_read.js — the logic both practices share.
 *
 * This module was extracted from scorecard.js so the BA page would reuse it
 * rather than carry a second copy that could drift. That makes a silent
 * behaviour change here a change to BOTH practices at once, which is why the
 * banding boundaries and the weakest-axis tie-break are pinned rather than
 * assumed.
 *
 * Run: node tools/test_dimension_read.cjs
 */

const assert = require('assert');
const {
  band_for, weakest_dimension, render_dimension_list,
} = require('../scripts/dimension_read.js');

const dimensions = [
  { key: 'wellbeing', label: 'Wellbeing' },
  { key: 'psychological_safety', label: 'Psychological safety' },
  { key: 'clarity', label: 'Clarity' },
];

let passed = 0;
function check(name, fn) { fn(); passed++; console.log('  ok   ' + name); }

check('band boundaries are exact', () => {
  assert.strictEqual(band_for(5).label, 'Strong');
  assert.strictEqual(band_for(4).label, 'Strong');
  assert.strictEqual(band_for(3).label, 'Developing');
  assert.strictEqual(band_for(2).label, 'Needs work');
  assert.strictEqual(band_for(1).label, 'Needs work');
});

check('band class names match the stylesheet', () => {
  assert.strictEqual(band_for(5).className, 'band-strong');
  assert.strictEqual(band_for(3).className, 'band-developing');
  assert.strictEqual(band_for(1).className, 'band-weak');
});

check('weakest dimension is the lowest score', () => {
  const answers = { wellbeing: 4, psychological_safety: 2, clarity: 5 };
  assert.strictEqual(weakest_dimension(dimensions, answers).key, 'psychological_safety');
});

check('a tie resolves to SSOT order, not at random', () => {
  const answers = { wellbeing: 2, psychological_safety: 2, clarity: 5 };
  assert.strictEqual(weakest_dimension(dimensions, answers).key, 'wellbeing');
});

check('weakest does not mutate the caller array', () => {
  const answers = { wellbeing: 4, psychological_safety: 2, clarity: 5 };
  const before = dimensions.map((d) => d.key).join(',');
  weakest_dimension(dimensions, answers);
  assert.strictEqual(dimensions.map((d) => d.key).join(','), before);
});

check('dimension list renders one row per dimension with its label', () => {
  const answers = { wellbeing: 4, psychological_safety: 2, clarity: 5 };
  const html = render_dimension_list(dimensions, answers, 5);
  assert.strictEqual((html.match(/<li class="dim">/g) || []).length, 3);
  dimensions.forEach((d) => assert.ok(html.includes(d.label), 'missing ' + d.label));
});

check('meter width is a percentage of max, not of the raw value', () => {
  const html = render_dimension_list(dimensions, { wellbeing: 4, psychological_safety: 2, clarity: 5 }, 5);
  assert.ok(html.includes('width:80%'), 'expected 4/5 -> 80%');
  assert.ok(html.includes('width:100%'), 'expected 5/5 -> 100%');
  assert.ok(html.includes('width:40%'), 'expected 2/5 -> 40%');
});

console.log('\n' + passed + ' dimension_read checks passed');
