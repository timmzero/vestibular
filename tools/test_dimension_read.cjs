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
  read_question, vantage_progress, gap_ranking, render_vantage_list, lowest_total, response_style,
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


/* ------------------------------------------------------------------ *
 * Two vantages per axis.
 * ------------------------------------------------------------------ */

const paired = [
  { key: 'morale', label: 'Morale', questions: [
    { key: 'morale_stated', text: 'People here can challenge an idea.', vantage: 'stated' },
    { key: 'morale_lived', text: 'The last time I disagreed, it cost me nothing.', vantage: 'lived' },
  ] },
  { key: 'roles', label: 'Roles', questions: [
    { key: 'roles_stated', text: 'It is clear who decides what.', vantage: 'stated' },
    { key: 'roles_lived', text: 'What I do is what my job description says.', vantage: 'lived' },
  ] },
];

check('vantage_progress keeps the two readings apart', () => {
  const v = vantage_progress(fake_form({
    morale_stated: 5, morale_lived: 1, roles_stated: 3, roles_lived: 3,
  }), paired, 5);
  assert.strictEqual(v.series.stated.values.morale, 5);
  assert.strictEqual(v.series.lived.values.morale, 1);
  assert.strictEqual(v.answered, 4);
  assert.strictEqual(v.questions, 4);
});

check('⛔ the pair is never averaged', () => {
  // 5 and 1 have the same mean as 3 and 3. If either reading came back as 3,
  // the espoused claim and the witnessed one have been blended into a number
  // describing neither — the fault this instrument was reshaped to remove.
  const v = vantage_progress(fake_form({
    morale_stated: 5, morale_lived: 1, roles_stated: 3, roles_lived: 3,
  }), paired, 5);
  assert.notStrictEqual(v.series.stated.values.morale, 3, 'the pair was averaged');
  assert.notStrictEqual(v.series.lived.values.morale, 3, 'the pair was averaged');
});

check('an absent lived item leaves that vantage empty, not zero', () => {
  const v = vantage_progress(fake_form({
    morale_stated: 4, morale_lived_absent: true, roles_stated: 3, roles_lived: 3,
  }), paired, 5);
  assert.strictEqual(v.series.stated.values.morale, 4);
  assert.strictEqual(v.series.lived.values.morale, undefined, 'no reading was given');
  assert.strictEqual(v.answered, 4, 'declining is still responding');
});

check('gap_ranking is signed and sorted by distance', () => {
  const v = vantage_progress(fake_form({
    morale_stated: 5, morale_lived: 1, roles_stated: 2, roles_lived: 3,
  }), paired, 5);
  const ranked = gap_ranking(paired, v.series);
  assert.strictEqual(ranked[0].key, 'morale');
  assert.strictEqual(ranked[0].gap, 4, 'claimed higher than lived is positive');
  assert.strictEqual(ranked[1].gap, -1, 'lived higher than claimed is negative');
});

check('an axis missing a vantage is omitted from the ranking', () => {
  const v = vantage_progress(fake_form({
    morale_stated: 5, morale_lived_absent: true, roles_stated: 2, roles_lived: 3,
  }), paired, 5);
  const ranked = gap_ranking(paired, v.series);
  assert.strictEqual(ranked.length, 1, 'there is no gap between a number and an absence');
  assert.strictEqual(ranked[0].key, 'roles');
});

check('a tie in the ranking is visible to the caller', () => {
  const v = vantage_progress(fake_form({
    morale_stated: 5, morale_lived: 3, roles_stated: 1, roles_lived: 3,
  }), paired, 5);
  const ranked = gap_ranking(paired, v.series);
  assert.strictEqual(Math.abs(ranked[0].gap), Math.abs(ranked[1].gap),
    'both are two apart, in opposite directions');
  assert.strictEqual(ranked[0].key, 'morale', 'ties resolve to SSOT order');
});

check('the result list shows both readings and never a band', () => {
  const v = vantage_progress(fake_form({
    morale_stated: 5, morale_lived: 1, roles_stated: 3, roles_lived: 3,
  }), paired, 5);
  const html = render_vantage_list(paired, v.series, 5);
  assert.ok(/on paper 5/.test(html) && /in practice 1/.test(html));
  assert.ok(!/Strong|Developing|Needs work/.test(html),
    'banding a pair would describe neither reading, and invites cross-axis comparison');
  assert.ok(/is-claimed-higher/.test(html) && /is-aligned/.test(html));
});

check('an absent reading renders as absent, not as a number', () => {
  const v = vantage_progress(fake_form({
    morale_stated: 5, morale_lived_absent: true, roles_stated: 3, roles_lived: 3,
  }), paired, 5);
  const html = render_vantage_list(paired, v.series, 5);
  assert.ok(/vantage-absent/.test(html));
  assert.ok(!/in practice 0/.test(html), 'absent must never be drawn as a zero');
});

check('vantage_progress ignores questions with no vantage', () => {
  // The Agile scorecard's items carry none. Reading them here would invent a
  // series for a practice that has no vantages.
  const v = vantage_progress(fake_form({ systems_1: 4, systems_2: 4 }), multi, 5);
  assert.deepStrictEqual(Object.keys(v.series), []);
  assert.strictEqual(v.questions, 0);
});


/* ------------------------------------------------------------------ *
 * ⛔ THE CONTRACT TEST. What the CLIENT actually receives, driven through the
 * reader the client actually uses.
 *
 * Every check above this point drives HAND-WRITTEN fixtures. Those fixtures
 * carried `vantage` because I wrote them that way — while the generator emitted
 * key-only questions to the page. All five gates were green over a build where
 * the instrument read as entirely unanswered and the chart drew nothing.
 *
 * A fixture proves the module works on the shape you imagined. Only the emitted
 * artefact proves it works on the shape you ship.
 * ------------------------------------------------------------------ */

const fs = require('fs');
const path = require('path');

function emitted_config() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'ai-readiness.html'), 'utf8');
  const m = html.match(/<script id="ba-readiness-data" type="application\/json">\n([\s\S]*?)\n<\/script>/);
  assert.ok(m, 'the readiness config block is not in the page at all');
  return JSON.parse(m[1]);
}

check('the emitted config is READABLE by vantage_progress', () => {
  const cfg = emitted_config();
  const answers = {};
  cfg.dimensions.forEach((d) => d.questions.forEach((q) => { answers[q.key] = 3; }));

  const v = vantage_progress(fake_form(answers), cfg.dimensions, 5);
  assert.ok(v.series.stated, 'no stated series — the page would read as unanswered');
  assert.ok(v.series.lived, 'no lived series — the chart would draw one polygon or none');
  assert.strictEqual(
    Object.keys(v.series.stated.values).length, cfg.dimensions.length,
    'every axis must produce a stated reading from the emitted keys',
  );
  assert.strictEqual(Object.keys(v.series.lived.values).length, cfg.dimensions.length);
  assert.strictEqual(v.answered, v.questions, 'a fully answered form must read as fully answered');
});

check('the emitted config carries the text the result quotes back', () => {
  const cfg = emitted_config();
  cfg.dimensions.forEach((d) => {
    d.questions.forEach((q) => {
      assert.ok(q.vantage, `${q.key} reaches the client with no vantage`);
      assert.ok(q.text && q.text.length > 10,
        `${q.key} reaches the client with no text — the result would quote empty quotation marks`);
    });
  });
});

check('the emitted keys match the form inputs on the same page', () => {
  // Two generated regions, one source. If they ever disagree, the client reads
  // inputs that do not exist and every axis silently reads as absent.
  const html = fs.readFileSync(path.join(__dirname, '..', 'ai-readiness.html'), 'utf8');
  const inputs = [...html.matchAll(/<input type="number" name="([a-z0-9_]+)"/g)].map((m) => m[1]);
  const configured = emitted_config().dimensions.flatMap((d) => d.questions.map((q) => q.key));
  assert.deepStrictEqual(inputs.slice().sort(), configured.slice().sort(),
    'the form fields and the config block name different questions');
});

check('every escape checkbox belongs to a question the config knows', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'ai-readiness.html'), 'utf8');
  const escapes = [...html.matchAll(/<input type="checkbox" name="([a-z0-9_]+)_absent"/g)].map((m) => m[1]);
  const configured = emitted_config().dimensions.flatMap((d) => d.questions.map((q) => q.key));
  assert.ok(escapes.length, 'no escape rendered — three lived items need one');
  escapes.forEach((k) => assert.ok(configured.includes(k), `${k}_absent has no question`));
});

check('an escaped input is not also marked required', () => {
  // The browser would block submission for exactly the people the escape exists
  // to serve, and the form would look broken rather than strict.
  const html = fs.readFileSync(path.join(__dirname, '..', 'ai-readiness.html'), 'utf8');
  const escaped = [...html.matchAll(/<input type="checkbox" name="([a-z0-9_]+)_absent"/g)].map((m) => m[1]);
  escaped.forEach((key) => {
    const row = html.match(new RegExp(`<input type="number" name="${key}"[^>]*>`));
    assert.ok(row, `${key} has an escape but no number input`);
    assert.ok(!/required/.test(row[0]), `${key} is escapable but still required`);
  });
});


/* ------------------------------------------------------------------ *
 * The FLOOR — stated + lived, lowest first.
 * ------------------------------------------------------------------ */

const polar = [
  { key: 'morale', label: 'Morale', questions: [
    { key: 'morale_stated', text: 'People can challenge an idea.', vantage: 'stated' },
    { key: 'morale_lived', text: 'It cost me nothing.', vantage: 'lived' },
  ] },
  { key: 'ai_fit', label: 'AI fit', questions: [
    { key: 'ai_fit_stated', text: 'We can name where AI helps.', vantage: 'stated' },
    { key: 'ai_fit_lived', text: 'The same thing over and over.', vantage: 'lived', polarity: 'opportunity' },
  ] },
  { key: 'roles', label: 'Roles', questions: [
    { key: 'roles_stated', text: 'Clear who decides.', vantage: 'stated' },
    { key: 'roles_lived', text: 'My week matches my job description.', vantage: 'lived' },
  ] },
];

check('⭐ the floor points where the gap cannot', () => {
  // Morale 5/1 and Roles 2/2. The widest GAP is Morale, and so is the lowest
  // LIVED reading, since 1 < 2 — so a second reading built on either would
  // just repeat the first and Roles would never be named. By total: 6 vs 4.
  const v = vantage_progress(fake_form({
    morale_stated: 5, morale_lived: 1, roles_stated: 2, roles_lived: 2,
    ai_fit_stated: 3, ai_fit_lived: 3,
  }), polar, 5);
  assert.strictEqual(gap_ranking(polar, v.series)[0].key, 'morale', 'the gap names Morale');
  const low = lowest_total(polar, v.series);
  assert.strictEqual(low[0].key, 'roles', 'the floor must name the uniformly low area instead');
  assert.strictEqual(low[0].total, 4);
});

check('total and gap together reconstruct both readings', () => {
  // stated = (T+G)/2, lived = (T-G)/2. The page prints enough to recover the
  // pair, which is why reporting a total alongside the gap discards nothing.
  const v = vantage_progress(fake_form({
    morale_stated: 5, morale_lived: 1, roles_stated: 2, roles_lived: 3,
    ai_fit_stated: 3, ai_fit_lived: 3,
  }), polar, 5);
  lowest_total(polar, v.series).forEach((r) => {
    assert.strictEqual((r.total + r.gap) / 2, r.stated);
    assert.strictEqual((r.total - r.gap) / 2, r.lived);
  });
});

check('⚠️ an opportunity-keyed axis is excluded from the floor', () => {
  // ai_fit totals 2 here — the lowest on the page — but a low reading there
  // means varied work, which is healthy and simply offers AI less to take.
  const v = vantage_progress(fake_form({
    morale_stated: 4, morale_lived: 3, ai_fit_stated: 1, ai_fit_lived: 1,
    roles_stated: 3, roles_lived: 4,
  }), polar, 5);
  const low = lowest_total(polar, v.series);
  assert.ok(!low.some((r) => r.key === 'ai_fit'), 'ai_fit must not appear at all');
  assert.strictEqual(low[0].key, 'morale');
});

check('an axis missing a vantage has no total and drops out', () => {
  const v = vantage_progress(fake_form({
    morale_stated: 4, morale_lived_absent: true, ai_fit_stated: 3, ai_fit_lived: 3,
    roles_stated: 3, roles_lived: 4,
  }), polar, 5);
  const low = lowest_total(polar, v.series);
  assert.ok(!low.some((r) => r.key === 'morale'), 'half the evidence is not a total');
});

check('the floor catches both-low without a threshold constant', () => {
  const v = vantage_progress(fake_form({
    morale_stated: 1, morale_lived: 1, roles_stated: 4, roles_lived: 4,
    ai_fit_stated: 3, ai_fit_lived: 3,
  }), polar, 5);
  assert.ok(gap_ranking(polar, v.series).every((r) => r.gap === 0), 'no divergence anywhere');
  const low = lowest_total(polar, v.series);
  assert.strictEqual(low[0].key, 'morale');
  assert.strictEqual(low[0].gap, 0, 'nothing to point at but the level');
});

check('⛔ aligned-low and aligned-high are different rows', () => {
  // 1/1 and 5/5 are the two most opposite readings available and shared one
  // class until this split.
  const v = vantage_progress(fake_form({
    morale_stated: 1, morale_lived: 1, roles_stated: 5, roles_lived: 5,
    ai_fit_stated: 3, ai_fit_lived: 3,
  }), polar, 5);
  const html = render_vantage_list(polar, v.series, 5);
  assert.ok(/is-aligned-low/.test(html), '1/1 must not read as agreement worth having');
  assert.ok(/is-aligned-high/.test(html));
  assert.ok(!/is-aligned"/.test(html), 'the collapsed class must be gone');
});

check('the emitted config carries the polarity flag to the client', () => {
  const cfg = emitted_config();
  const flagged = cfg.dimensions
    .flatMap((d) => d.questions)
    .filter((q) => q.polarity === 'opportunity')
    .map((q) => q.key);
  assert.deepStrictEqual(flagged, ['ai_fit_lived'],
    'the flag exists in the SSOT but must also REACH the code that consults it');
});


/* ------------------------------------------------------------------ *
 * Reverse-worded items.
 * ------------------------------------------------------------------ */

const rev = [
  { key: 'systems', label: 'Systems', questions: [
    { key: 'systems_stated', text: 'Not used to their potential.', vantage: 'stated', reverse: true },
    { key: 'systems_lived', text: 'People fill gaps the systems should.', vantage: 'lived', reverse: true },
  ] },
  { key: 'roles', label: 'Roles', questions: [
    { key: 'roles_stated', text: 'Clear who decides.', vantage: 'stated' },
    { key: 'roles_lived', text: 'My week matches my job description.', vantage: 'lived' },
  ] },
];

check('a reverse item is inverted, and the raw answer is kept', () => {
  const r = read_question(fake_form({ a: 5 }), { key: 'a', reverse: true }, 5);
  assert.strictEqual(r.value, 1, 'agreement with a reverse item is the BAD direction');
  assert.strictEqual(r.raw, 5, 'the number the person typed must survive');
  assert.strictEqual(r.reversed, true);
});

check('inversion is symmetric across the scale', () => {
  [[1, 5], [2, 4], [3, 3], [4, 2], [5, 1]].forEach(([raw, scored]) => {
    assert.strictEqual(read_question(fake_form({ a: raw }), { key: 'a', reverse: true }, 5).value, scored);
  });
});

check('a plain item and a bare key are untouched', () => {
  assert.strictEqual(read_question(fake_form({ a: 4 }), { key: 'a' }, 5).value, 4);
  assert.strictEqual(read_question(fake_form({ a: 4 }), 'a', 5).value, 4,
    'the agile scorecard passes bare keys and must be unaffected');
});

check('the scored series carries inverted values, the raw series does not', () => {
  const v = vantage_progress(fake_form({
    systems_stated: 5, systems_lived: 5, roles_stated: 4, roles_lived: 4,
  }), rev, 5);
  assert.strictEqual(v.series.stated.values.systems, 1, 'scored');
  assert.strictEqual(v.series.stated.raw.systems, 5, 'raw');
  assert.strictEqual(v.series.stated.values.roles, 4, 'a plain item is unchanged either way');
  assert.strictEqual(v.series.stated.raw.roles, 4);
});

check('⛔ the quote-back number must come from RAW', () => {
  // The result prints the REVERSE-WORDED sentence beside the answer. Printing
  // the scored value there would tell someone who marked 5 that they said 1,
  // against a sentence they agreed with.
  const v = vantage_progress(fake_form({
    systems_stated: 5, systems_lived: 1, roles_stated: 4, roles_lived: 4,
  }), rev, 5);
  const top = gap_ranking(rev, v.series).find((r) => r.key === 'systems');
  assert.strictEqual(top.stated, 1, 'scored, for the ranking');
  assert.strictEqual(top.stated_raw, 5, 'raw, for the quote');
  assert.strictEqual(top.lived_raw, 1);
  assert.strictEqual(top.lived, 5);
});

check('the gap is computed on scored values, not raw', () => {
  // Raw 5 and 1 would read as a gap of 4. Scored, the axis is 1 and 5 — a gap
  // of -4, the opposite finding.
  const v = vantage_progress(fake_form({
    systems_stated: 5, systems_lived: 1, roles_stated: 4, roles_lived: 4,
  }), rev, 5);
  const systems = gap_ranking(rev, v.series).find((r) => r.key === 'systems');
  assert.strictEqual(systems.gap, -4, 'a reverse axis must not draw backwards');
});

check('acquiescence is visible where straight-lining is not', () => {
  // Agrees with everything, including two items whose agreement is the bad
  // direction. Not straight-lining: the values differ.
  const v = vantage_progress(fake_form({
    systems_stated: 5, systems_lived: 4, roles_stated: 5, roles_lived: 4,
  }), rev, 5);
  const style = response_style(rev, v.series, 5);
  assert.strictEqual(style.acquiescent, true, 'agreeing with a claim and its negation is not a position');
  assert.strictEqual(style.straight_lined, false, 'the values are not identical, so the free check misses it');
});

check('⛔ a consistent pessimist is not acquiescence', () => {
  // Agrees the systems are half-used, disagrees that roles are clear. That is a
  // coherent and probably accurate position, not a yea-sayer. Checking only the
  // reverse items would flag it.
  const v = vantage_progress(fake_form({
    systems_stated: 5, systems_lived: 5, roles_stated: 1, roles_lived: 2,
  }), rev, 5);
  assert.strictEqual(response_style(rev, v.series, 5).acquiescent, false);
});

check('a considered respondent is not flagged', () => {
  const v = vantage_progress(fake_form({
    systems_stated: 2, systems_lived: 1, roles_stated: 5, roles_lived: 4,
  }), rev, 5);
  const style = response_style(rev, v.series, 5);
  assert.strictEqual(style.acquiescent, false);
  assert.strictEqual(style.straight_lined, false);
});

check('straight-lining is read from RAW, not from scored values', () => {
  // ⚠️ Scored, this respondent reads 1,1,5,5 — not uniform at all. Only the raw
  // pattern shows the person entered the same number sixteen times.
  const v = vantage_progress(fake_form({
    systems_stated: 5, systems_lived: 5, roles_stated: 5, roles_lived: 5,
  }), rev, 5);
  assert.strictEqual(response_style(rev, v.series, 5).straight_lined, true);
  assert.notStrictEqual(v.series.stated.values.systems, v.series.stated.values.roles,
    'the scored values differ, which is exactly why raw must be retained');
});

check('the emitted config carries the reverse flag to the client', () => {
  const cfg = emitted_config();
  const flagged = cfg.dimensions.flatMap((d) => d.questions).filter((q) => q.reverse).map((q) => q.key);
  assert.deepStrictEqual(flagged, ['systems_stated', 'systems_lived'],
    'without this the client scores a reverse item as written and draws the axis backwards');
});

console.log('\n' + passed + ' dimension_read checks passed');
