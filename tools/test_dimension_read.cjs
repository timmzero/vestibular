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
  band_for, weakest_dimension, render_dimension_list, question_keys, axis_values, axis_progress, read_answers,
  read_question,
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
  Object.keys(values).forEach((k) => {
    // A ticked escape is modelled the way the DOM presents it: a checkbox named
    // `<key>_absent`. Passing `true` for a key ticks its escape.
    if (values[k] === true) elements[k] = { checked: true, type: 'checkbox' };
    else elements[k] = { value: String(values[k]) };
  });
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

// --- axis_progress (the live sketch) ----------------------------------------
// The chart wants a running value so every answer visibly does something; the
// submitted result must still refuse a half-answered axis. Same reader, two
// strictnesses, so both are pinned here.

check('a half-answered axis has a running value and is flagged provisional', () => {
  const p = axis_progress(fake_form({ systems_1: 4, morale_1: 2, morale_2: 4 }), multi, 5);
  assert.strictEqual(p.values.systems, 4, 'running mean of the answers so far');
  assert.strictEqual(p.provisional.systems, true);
  assert.strictEqual(p.values.morale, 3);
  assert.strictEqual(p.provisional.morale, false, 'a full axis is not provisional');
});

check('the running value updates as the second answer arrives', () => {
  const a = axis_progress(fake_form({ systems_1: 5 }), multi, 5);
  const b = axis_progress(fake_form({ systems_1: 5, systems_2: 1 }), multi, 5);
  assert.strictEqual(a.values.systems, 5);
  assert.strictEqual(b.values.systems, 3);
});

check('an untouched axis has no value and is not provisional', () => {
  const p = axis_progress(fake_form({ systems_1: 4, systems_2: 4 }), multi, 5);
  assert.strictEqual(p.values.morale, undefined);
  assert.strictEqual(p.provisional.morale, false, 'nothing answered is absent, not in progress');
});

check('progress counts answered questions, not axes', () => {
  const p = axis_progress(fake_form({ systems_1: 4, morale_1: 3 }), multi, 5);
  assert.strictEqual(p.answered, 2);
  assert.strictEqual(p.questions, 4);
});

check('an invalid answer does not count toward progress', () => {
  const p = axis_progress(fake_form({ systems_1: 9, systems_2: 4 }), multi, 5);
  assert.strictEqual(p.answered, 1);
  assert.strictEqual(p.values.systems, 4, 'the valid answer alone');
  assert.strictEqual(p.provisional.systems, true);
});

check('axis_values stays strict where axis_progress is permissive', () => {
  const form = fake_form({ systems_1: 4, morale_1: 3, morale_2: 3 });
  assert.strictEqual(axis_progress(form, multi, 5).values.systems, 4);
  assert.strictEqual(axis_values(form, multi, 5).systems, undefined,
    'the submitted reading must not average half an axis');
  assert.strictEqual(read_answers(form, multi, 5).ok, false);
});


/* ------------------------------------------------------------------ *
 * The ABSENT escape.
 *
 * Three lived items on the readiness instrument presuppose an event that may
 * never have occurred. The escape lets a respondent say so instead of stating a
 * value for something that never happened. Every assertion below was driven
 * over a mutation of read_question before being trusted — scoring an escape at
 * 0, at max, or ignoring it entirely all render happily and lie.
 * ------------------------------------------------------------------ */

check('read_question reports three states, not two', () => {
  assert.strictEqual(read_question(fake_form({ a: 3 }), 'a', 5).state, 'answered');
  assert.strictEqual(read_question(fake_form({ a: '' }), 'a', 5).state, 'missing');
  assert.strictEqual(read_question(fake_form({ a_absent: true }), 'a', 5).state, 'absent');
  assert.strictEqual(read_question(null, 'a', 5).state, 'missing');
});

check('an out-of-range answer is missing, not clamped', () => {
  assert.strictEqual(read_question(fake_form({ a: 9 }), 'a', 5).state, 'missing');
  assert.strictEqual(read_question(fake_form({ a: 0 }), 'a', 5).state, 'missing');
});

check('a ticked escape beats a stale number left in the input', () => {
  const r = read_question(fake_form({ a: 4, a_absent: true }), 'a', 5);
  assert.strictEqual(r.state, 'absent', 'the escape is the answer, not the leftover 4');
  assert.strictEqual(r.value, undefined);
});

check('an absent item leaves the denominator rather than scoring', () => {
  const p = axis_progress(fake_form({ systems_1: 4, systems_2_absent: true }), multi, 5);
  assert.strictEqual(p.values.systems, 4, 'the mean is over the item that HAS a reading');
  assert.strictEqual(p.provisional.systems, false, 'nothing further is coming for this axis');
});

check('an absent item is not scored at zero and not at max', () => {
  const p = axis_progress(fake_form({ systems_1: 2, systems_2_absent: true }), multi, 5);
  assert.strictEqual(p.values.systems, 2);
  assert.notStrictEqual(p.values.systems, 1, 'absent must not drag the axis down');
  assert.notStrictEqual(p.values.systems, 3.5, 'absent must not be averaged as max');
});

check('an axis with every item absent is ABSENT, not centred', () => {
  const p = axis_progress(fake_form({ systems_1_absent: true, systems_2_absent: true }), multi, 5);
  assert.strictEqual(p.values.systems, undefined, 'no reading was given, so none is plotted');
  assert.strictEqual(p.provisional.systems, false);
});

check('an absent item counts as answered for progress', () => {
  const p = axis_progress(fake_form({ systems_1: 4, systems_2_absent: true }), multi, 5);
  assert.strictEqual(p.answered, 2, 'the person responded to both, one by declining');
  assert.strictEqual(p.questions, 4, 'the total is unchanged by an escape');
});

check('an escaped axis still settles for submission', () => {
  const form = fake_form({ systems_1: 4, systems_2_absent: true, morale_1: 3, morale_2: 3 });
  assert.strictEqual(axis_values(form, multi, 5).systems, 4,
    'a settled axis must not be withheld because one item was declined');
  assert.strictEqual(read_answers(form, multi, 5).ok, true);
});

check('the escape does not rescue a half-answered axis', () => {
  const form = fake_form({ systems_1: 4, morale_1: 3, morale_2: 3 });
  assert.strictEqual(axis_values(form, multi, 5).systems, undefined,
    'unanswered is still unanswered — an escape must be TICKED, not merely available');
  assert.strictEqual(read_answers(form, multi, 5).ok, false);
});

check('the validation message mentions the escape', () => {
  const read = read_answers(fake_form({ systems_1: 4 }), multi, 5);
  assert.strictEqual(read.ok, false);
  assert.ok(/does not apply/.test(read.message),
    'a message demanding a number for every item sends people looking for one they cannot give');
});

console.log('\n' + passed + ' dimension_read checks passed');
