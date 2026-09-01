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
  band_for, weakest_dimension, render_dimension_list, question_keys, axis_values, read_answers,
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

// --- multi-question axes ----------------------------------------------------

check('question_keys falls back to the axis key when asked once', () => {
  assert.deepStrictEqual(question_keys({ key: 'clarity' }), ['clarity']);
});

check('question_keys returns each question key when asked several times', () => {
  assert.deepStrictEqual(
    question_keys({ key: 'systems', questions: [{ key: 'systems_1' }, { key: 'systems_2' }] }),
    ['systems_1', 'systems_2']
  );
});

check('an averaged 3.5 bands as Developing, not Needs work', () => {
  // The regression this pins: `value === 3` matched no branch for 3.5 and fell
  // through to Needs work, telling a team above the midpoint it was their
  // problem area.
  assert.strictEqual(band_for(3.5).label, 'Developing');
  assert.strictEqual(band_for(3.9).label, 'Developing');
  assert.strictEqual(band_for(2.9).label, 'Needs work');
  assert.strictEqual(band_for(4.0).label, 'Strong');
});

/** Minimal stand-in for a form: elements[name].value, as the DOM exposes it. */
function fake_form(values) {
  const elements = {};
  Object.keys(values).forEach((k) => { elements[k] = { value: String(values[k]) }; });
  return { elements };
}

const multi = [
  { key: 'systems', label: 'Systems', questions: [{ key: 'systems_1' }, { key: 'systems_2' }] },
  { key: 'morale', label: 'Morale', questions: [{ key: 'morale_1' }, { key: 'morale_2' }] },
];

check('an axis is the mean of its questions', () => {
  const v = axis_values(fake_form({ systems_1: 2, systems_2: 3, morale_1: 4, morale_2: 5 }), multi, 5);
  assert.strictEqual(v.systems, 2.5);
  assert.strictEqual(v.morale, 4.5);
});

check('a half-answered axis is undefined, not a partial mean', () => {
  const v = axis_values(fake_form({ systems_1: 4, morale_1: 4, morale_2: 4 }), multi, 5);
  assert.strictEqual(v.systems, undefined, 'half an axis must not plot');
  assert.strictEqual(v.morale, 4);
});

check('an out-of-range answer voids its whole axis', () => {
  const v = axis_values(fake_form({ systems_1: 9, systems_2: 3, morale_1: 3, morale_2: 3 }), multi, 5);
  assert.strictEqual(v.systems, undefined);
});

check('single-question axes still read through axis_values', () => {
  const single = [{ key: 'clarity', label: 'Clarity' }];
  assert.strictEqual(axis_values(fake_form({ clarity: 4 }), single, 5).clarity, 4);
  assert.strictEqual(axis_values(fake_form({}), single, 5).clarity, undefined);
});

check('meter width of an averaged value is not a long decimal', () => {
  const html = render_dimension_list([{ key: 'a', label: 'A' }], { a: 10 / 3 }, 5);
  const width = html.match(/width:([\d.]+)%/)[1];
  assert.ok(width.length <= 4, 'width was ' + width);
});

// --- read_answers -----------------------------------------------------------
// Previously untested: a mutation removing its range check survived the matrix.

check('read_answers accepts a complete set and totals the axis means', () => {
  const r = read_answers(fake_form({ systems_1: 2, systems_2: 4, morale_1: 3, morale_2: 3 }), multi, 5);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.answers.systems, 3);
  assert.strictEqual(r.answers.morale, 3);
  assert.strictEqual(r.total, 6);
});

check('read_answers rejects an out-of-range answer', () => {
  for (const bad of [0, 6, -1, 99]) {
    const r = read_answers(fake_form({ systems_1: bad, systems_2: 4, morale_1: 3, morale_2: 3 }), multi, 5);
    assert.strictEqual(r.ok, false, 'value ' + bad + ' should be rejected');
    assert.ok(/1 to 5/.test(r.message));
  }
});

check('read_answers rejects a non-numeric answer', () => {
  assert.strictEqual(read_answers(fake_form({ systems_1: 'four', systems_2: 4, morale_1: 3, morale_2: 3 }), multi, 5).ok, false);
});

check('read_answers rejects a half-answered axis', () => {
  assert.strictEqual(read_answers(fake_form({ systems_1: 4, morale_1: 3, morale_2: 3 }), multi, 5).ok, false);
});

console.log('\n' + passed + ' dimension_read checks passed');
