/**
 * Per-dimension read, shared by both practices.
 *
 * The Agile diagnostic and the BA team-health radar both need to read answers
 * by key, validate them, band them, find the weakest axis, and render the same
 * dimension list. Only what happens AFTER that differs: Agile collapses the
 * total to a maturity stage and a priced package; the BA side deliberately
 * does not. Extracted so that shared half lives in one place rather than being
 * copied onto the BA page and drifting.
 *
 * Nothing here knows about stages, thresholds, packages or prices.
 */

(function (root) {
  'use strict';

  /**
   * What one question's input holds. THE ONLY PLACE THAT DECIDES WHAT COUNTS AS
   * AN ANSWER — the live chart and the submitted reading differ in strictness
   * (see axis_progress) but must never differ in this rule, or a value plotted
   * on the chart could fail validation on submit, or worse, the reverse.
   *
   * Three outcomes, not two:
   *
   *   answered  a valid 1..max
   *   absent    the respondent ticked the escape: the event this item asks
   *             about never happened, so there is NO READING to give
   *   missing   nothing usable yet
   *
   * ⛔ ABSENT IS NOT A LOW SCORE AND NOT A HIGH ONE. Never having disagreed
   * with someone senior is not evidence of safety; never having been near your
   * limit says nothing about whether the organisation responds when you are.
   * Both would be a value the person did not give, which is the same fault the
   * radar's absent-not-centre rule already refuses.
   */
  function read_question(form, question, limit) {
    // Accepts a key or a question object. The Agile scorecard passes keys and
    // carries no reverse flags, so its path is unchanged by everything below.
    const key = typeof question === 'string' ? question : question.key;
    const reverse = typeof question === 'object' && !!question.reverse;

    if (!form) return { state: 'missing' };

    const escape_el = form.elements[key + '_absent'];
    if (escape_el && escape_el.checked) return { state: 'absent' };

    const el = form.elements[key];
    const raw = el ? el.value : undefined;
    const v = Number(raw);
    if (raw === undefined || raw === null || raw === '' ||
        !Number.isFinite(v) || v < 1 || v > limit) {
      return { state: 'missing' };
    }

    // ⛔ INVERT HERE AND NOWHERE ELSE. A reverse-worded item is answered on the
    // same 1..max scale, but agreement means the BAD direction, so the scored
    // value must be flipped before it reaches banding, the gap, the floor or
    // either polygon. Inverting at any later point means some consumers see the
    // raw number and some see the scored one, and the two disagree silently.
    //
    // ⭐ RAW IS RETAINED, NOT DISCARDED. Two things need the number the person
    // actually typed: the quote-back, which prints the REVERSE-WORDED sentence
    // beside the answer — showing a flipped value there would tell someone who
    // marked 1 that they said 5 — and acquiescence detection, which needs the
    // raw pattern rather than the scored one.
    return {
      state: 'answered',
      value: reverse ? (limit + 1) - v : v,
      raw: v,
      reversed: reverse,
    };
  }

  /**
   * Per-VANTAGE reading, for an instrument whose axes carry a stated item and a
   * lived one.
   *
   * ⛔ DO NOT USE axis_progress FOR THIS. It means over an axis's questions,
   * which here would average an espoused claim with a witnessed one — two
   * things that are NOT expected to agree, blended into a number describing
   * neither. That is the exact fault the axis mean was reshaped to avoid, and
   * it would arrive back silently in the chart rather than loudly in the copy.
   *
   * Returns one series per vantage, each shaped like axis_progress's output so
   * the radar can consume either without knowing which it has.
   */
  function vantage_progress(form, dimensions, max) {
    const limit = max || 5;
    const series = {};
    let answered = 0;
    let questions = 0;

    dimensions.forEach(function (d) {
      const items = Array.isArray(d.questions) && d.questions.length ? d.questions : [];
      items.forEach(function (q) {
        const vantage = q.vantage;
        if (!vantage) return;
        if (!series[vantage]) series[vantage] = { values: {}, provisional: {}, raw: {} };
        questions += 1;

        // The QUESTION, not its key: read_question needs the reverse flag.
        const read = read_question(form, q, limit);
        if (read.state === 'absent') {
          answered += 1;
          // Absent leaves no value. The axis is drawn with this vantage
          // missing rather than with a number the person did not give.
          return;
        }
        if (read.state !== 'answered') return;
        answered += 1;
        series[vantage].values[d.key] = read.value;
        series[vantage].raw[d.key] = read.raw;
      });
    });

    return { series: series, answered: answered, questions: questions };
  }

  /**
   * Axes ranked by the DISTANCE between what is claimed and what is lived.
   *
   * Signed, because the direction is the finding: a positive gap is a claim the
   * respondent has not seen borne out; a negative one is something working that
   * the organisation cannot articulate. An axis missing either vantage is
   * omitted — there is no gap between a number and an absence.
   *
   * ⚠️ Both vantages come from ONE person, on one scale, in one sitting, so
   * wording severity and scale-use habits push both the same way and cancel in
   * the difference. That is what makes this comparable across axes when the
   * levels are not.
   */
  function gap_ranking(dimensions, series) {
    const stated = (series.stated && series.stated.values) || {};
    const lived = (series.lived && series.lived.values) || {};
    // ⚠️ Raw travels alongside scored, for the quote-back only. The RANKING is
    // over scored values — a reverse item's gap is meaningless on raw numbers.
    const stated_raw = (series.stated && series.stated.raw) || {};
    const lived_raw = (series.lived && series.lived.raw) || {};
    return dimensions
      .filter(function (d) {
        return stated[d.key] !== undefined && lived[d.key] !== undefined;
      })
      .map(function (d) {
        return {
          key: d.key,
          label: d.label,
          stated: stated[d.key],
          lived: lived[d.key],
          stated_raw: stated_raw[d.key],
          lived_raw: lived_raw[d.key],
          gap: stated[d.key] - lived[d.key],
        };
      })
      .sort(function (a, b) {
        const byGap = Math.abs(b.gap) - Math.abs(a.gap);
        // Ties resolve to SSOT order, not at random — the same rule
        // weakest_dimension already follows.
        return byGap !== 0 ? byGap : 0;
      });
  }

  /**
   * Response-style flags, read from the RAW pattern.
   *
   * ⭐ THIS IS WHAT THE REVERSE ITEMS ARE FOR, and it is NOT straight-lining.
   * Straight-lining was always detectable for free — identical raw values
   * across every item is a one-line check needing no reverse wording.
   *
   * ACQUIESCENCE is the bias reverse items actually catch: someone who agrees
   * with whatever is put in front of them. With every item positively worded a
   * yea-sayer renders as a healthy organisation, which is the failure mode that
   * most convincingly fakes a good result on a page whose whole output is
   * shape. A reverse item makes it visible — agreeing with both a claim and its
   * negation is not a position.
   */
  function response_style(dimensions, series, max) {
    const limit = max || 5;
    const raw = [];
    const reverse_raw = [];
    const plain_raw = [];
    dimensions.forEach(function (d) {
      (d.questions || []).forEach(function (q) {
        const bag = series[q.vantage];
        const v = bag && bag.raw ? bag.raw[d.key] : undefined;
        if (v === undefined) return;
        raw.push(v);
        (q.reverse ? reverse_raw : plain_raw).push(v);
      });
    });
    const high = limit - 1;
    const all_high = function (xs) {
      return xs.length > 0 && xs.every(function (v) { return v >= high; });
    };
    return {
      // Straight-lining needs no reverse item and never did: identical raw
      // values is a one-line check. ⚠️ It must read RAW — scored, a respondent
      // who typed 5 sixteen times reads as varied, because the reverse items
      // were inverted.
      straight_lined: raw.length > 1 && raw.every(function (v) { return v === raw[0]; }),
      // ⛔ BOTH DIRECTIONS, NOT JUST THE REVERSE ONES. Checking only the reverse
      // items flags a CONSISTENT PESSIMIST — someone who agrees the systems are
      // half-used and disagrees that recognition is fair holds a coherent, and
      // probably accurate, position. Acquiescence is agreeing with a claim AND
      // its negation, so it requires both groups to sit high.
      acquiescent: all_high(reverse_raw) && all_high(plain_raw),
      answered: raw.length,
    };
  }

  /**
   * Axes ranked by their TOTAL — stated + lived, lowest first. The floor.
   *
   * ⭐ TOTAL AND GAP TOGETHER LOSE NOTHING. With T = stated + lived and
   * G = stated - lived, the originals are recoverable: stated = (T+G)/2,
   * lived = (T-G)/2. It is the same pair in rotated coordinates, not a summary
   * of it. Reporting the total INSTEAD of the gap would be the blend this
   * instrument was reshaped to remove; reporting it ALONGSIDE discards nothing,
   * and the page prints enough for the reader to reconstruct both readings.
   *
   * ⭐ AND IT POINTS SOMEWHERE THE GAP CANNOT. An axis at 5/1 beside one at 2/2:
   * the widest gap names the first, and so does the lowest LIVED reading, since
   * 1 < 2 — so the second reading merely repeats the first and the uniformly low
   * area is never mentioned. By total, 2/2 is 4 against 6, and it surfaces. A
   * second reading that agrees with the first is not a second reading.
   *
   * ⭐ IT ALSO REMOVES A THRESHOLD. The both-low case was previously caught by
   * `stated <= 2 && lived <= 2`, an unexamined constant that would quietly have
   * become the scoring rule this page refuses to have. The lowest total IS the
   * both-low axis when one exists.
   *
   * ⚠️ An item flagged `polarity: 'opportunity'` excludes its whole axis.
   * `ai_fit_lived` asks whether the week is the same thing over and over: a low
   * reading means varied work, which is healthy and simply offers AI less to
   * take, so it can drag a total down for a benign reason. Every other lived
   * item's low pole is a problem. The flag lives in the SSOT so the next item to
   * invert is declared rather than discovered.
   *
   * An axis missing either vantage has no total, exactly as it has no gap, and
   * drops out of both rankings rather than being ranked on half its evidence.
   */
  function lowest_total(dimensions, series) {
    const stated = (series.stated && series.stated.values) || {};
    const lived = (series.lived && series.lived.values) || {};
    const stated_raw = (series.stated && series.stated.raw) || {};
    const lived_raw = (series.lived && series.lived.raw) || {};
    return dimensions
      .filter(function (d) {
        if (stated[d.key] === undefined || lived[d.key] === undefined) return false;
        const item = (d.questions || []).find(function (q) { return q.vantage === 'lived'; });
        return !(item && item.polarity === 'opportunity');
      })
      .map(function (d) {
        const item = (d.questions || []).find(function (q) { return q.vantage === 'lived'; });
        return {
          key: d.key,
          label: d.label,
          stated: stated[d.key],
          lived: lived[d.key],
          stated_raw: stated_raw[d.key],
          lived_raw: lived_raw[d.key],
          total: stated[d.key] + lived[d.key],
          gap: stated[d.key] - lived[d.key],
          text: item ? item.text : '',
        };
      })
      .sort(function (a, b) { return a.total - b.total; });
  }

  /**
   * Banding is by RANGE, not exact match. `value === 3` worked while every
   * answer was an integer, but an axis averaged over two questions produces
   * 3.5, which matched neither branch and fell through to 'Needs work' — a
   * team above the midpoint told it was their problem area, on a page that
   * looked entirely plausible. Integer behaviour is unchanged: 4 and 5 Strong,
   * 3 Developing, 1 and 2 Needs work.
   */
  function band_for(value) {
    if (value >= 4) return { label: 'Strong', className: 'band-strong' };
    if (value >= 3) return { label: 'Developing', className: 'band-developing' };
    return { label: 'Needs work', className: 'band-weak' };
  }

  /**
   * An axis may be asked as one question or several. Returns the input keys
   * that feed it, so the single-question and multi-question shapes are read by
   * the same code rather than forking the caller.
   */
  function question_keys(dimension) {
    if (Array.isArray(dimension.questions) && dimension.questions.length) {
      return dimension.questions.map(function (q) { return q.key; });
    }
    return [dimension.key];
  }

  /**
   * Read every dimension from the form BY KEY. Reading by position once totalled
   * correctly while being unable to attribute any answer to any dimension, so
   * the key is the contract.
   */
  /**
   * Validated read of every axis, for scoring. Delegates to axis_values so the
   * chart and the result can never disagree about what an answer is: this used
   * to read through FormData while axis_values read form.elements, which is two
   * readers for one job and two places for a validation rule to drift.
   */
  function read_answers(form, dimensions, max) {
    const limit = max || 5;
    const values = axis_values(form, dimensions, limit);
    const answers = {};
    let total = 0;
    for (let i = 0; i < dimensions.length; i++) {
      const key = dimensions[i].key;
      if (values[key] === undefined) {
        return {
          ok: false,
          // Accurate about the escape: some items can be answered by saying the
          // thing never happened, and a message demanding a number for every
          // question would send a respondent looking for one they cannot give.
          message: 'Please answer every question with a number from 1 to ' + limit +
            ', or tick the option where the question does not apply to you.',
        };
      }
      answers[key] = values[key];
      total += values[key];
    }
    return { ok: true, answers: answers, total: total };
  }

  /** The weakest axis is the honest place to start, and is usually not the one
   *  a team expects. Ties resolve to the first in SSOT order, not at random. */
  function weakest_dimension(dimensions, answers) {
    return dimensions
      .slice()
      .sort(function (a, b) { return answers[a.key] - answers[b.key]; })[0];
  }

  /**
   * Per-axis reading of the form, including partially answered axes.
   *
   * `value` is the running mean of the questions answered SO FAR, and an axis
   * is `provisional` until every one of its questions holds a valid answer.
   * The distinction matters because the two consumers need different things:
   *
   *   - The live chart wants provisional values. A sketch that refuses to move
   *     until it is certain is not honest, it is unresponsive, and the person
   *     filling the form learns nothing from their own answers as they go.
   *   - The submitted result wants settled values only. That is the reading
   *     someone acts on or sends to us, and averaging half the evidence there
   *     would be stating a number nobody gave.
   *
   * One reader, two strictnesses, so the rule about what counts as an answer
   * lives in exactly one place.
   */
  function axis_progress(form, dimensions, max) {
    const limit = max || 5;
    const values = {};
    const provisional = {};
    let answered = 0;
    let questions = 0;

    dimensions.forEach(function (d) {
      const keys = question_keys(d);
      questions += keys.length;
      let sum = 0;
      let count = 0;
      let absent = 0;
      for (let i = 0; i < keys.length; i++) {
        const read = read_question(form, keys[i], limit);
        // ⛔ A DECLARED-ABSENT ITEM LEAVES THE DENOMINATOR, it does not score
        // zero and it does not hold the axis provisional forever. Counting it
        // in `answered` is deliberate: the person HAS responded, so the
        // progress caption reaches its total and the reading can settle. An
        // axis whose every item is absent stays undefined and plots ABSENT.
        if (read.state === 'absent') { absent += 1; continue; }
        if (read.state !== 'answered') continue;
        sum += read.value;
        count += 1;
      }
      answered += count + absent;
      values[d.key] = count ? sum / count : undefined;
      provisional[d.key] = count > 0 && count < (keys.length - absent);
    });

    return {
      values: values, provisional: provisional,
      answered: answered, questions: questions,
    };
  }

  /**
   * Settled values only: an axis is undefined unless EVERY one of its questions
   * holds a valid answer. Used for scoring, never for the live chart.
   */
  function axis_values(form, dimensions, max) {
    const progress = axis_progress(form, dimensions, max);
    const values = {};
    Object.keys(progress.values).forEach(function (key) {
      values[key] = progress.provisional[key] ? undefined : progress.values[key];
    });
    return values;
  }

  function render_dimension_list(dimensions, answers, max) {
    const limit = max || 5;
    const rows = dimensions
      .map(function (d) {
        const v = answers[d.key];
        const band = band_for(v);
        return `
        <li class="dim">
          <span class="dim-label">${d.label}</span>
          <span class="dim-meter" aria-hidden="true"><i style="width:${Math.round((v / limit) * 1000) / 10}%"></i></span>
          <span class="dim-band ${band.className}">${band.label}</span>
        </li>`;
      })
      .join('');
    return `<ul class="dim-list">${rows}</ul>`;
  }

  /**
   * The readiness result: each axis showing BOTH readings and the distance
   * between them. Deliberately not render_dimension_list — that bands a single
   * value, and there is no single value here to band.
   *
   * ⛔ NO MEAN, AND NO BAND OVER THE PAIR. "Strong" over the average of a
   * claim and an experience would describe neither, and banding invites the
   * cross-axis comparison the axes are not equated to support.
   */
  function render_vantage_list(dimensions, series, max) {
    const limit = max || 5;
    const stated = (series.stated && series.stated.values) || {};
    const lived = (series.lived && series.lived.values) || {};
    const cell = function (v) {
      return v === undefined
        ? '<span class="vantage-absent" title="not answered">&mdash;</span>'
        : String(v) + '<span class="vantage-of">/' + limit + '</span>';
    };
    const rows = dimensions.map(function (d) {
      const s = stated[d.key];
      const l = lived[d.key];
      const gap = (s !== undefined && l !== undefined) ? s - l : undefined;
      // ⛔ ALIGNED-LOW AND ALIGNED-HIGH ARE NOT THE SAME ROW. This read
      // `gap < 0 ? 'is-lived-higher' : 'is-aligned'`, so 1/1 and 5/5 — the two
      // most opposite readings the instrument can produce — came out with one
      // class. Agreement is only good news at the top of the scale; at the
      // bottom it means nothing is claimed and nothing is seen, which is the
      // reading with no gap to point at and the one most worth naming.
      //
      // The cut points are band_for's, reused rather than reinvented so a
      // second set of thresholds cannot drift from the first. The class is a
      // styling hook, not a printed band: the pair is still never labelled.
      const gapClass = gap === undefined ? 'is-absent'
        : gap > 0 ? 'is-claimed-higher'
        : gap < 0 ? 'is-lived-higher'
        : band_for(l).className === 'band-weak' ? 'is-aligned-low'
        : 'is-aligned-high';
      return `
        <li class="vantage-row ${gapClass}">
          <span class="vantage-label">${d.label}</span>
          <span class="vantage-stated">on paper ${cell(s)}</span>
          <span class="vantage-lived">in practice ${cell(l)}</span>
        </li>`;
    }).join('');
    return `<ul class="vantage-list">${rows}</ul>`;
  }

  const api = {
    band_for: band_for,
    read_question: read_question,
    vantage_progress: vantage_progress,
    gap_ranking: gap_ranking,
    lowest_total: lowest_total,
    response_style: response_style,
    render_vantage_list: render_vantage_list,
    question_keys: question_keys,
    axis_values: axis_values,
    axis_progress: axis_progress,
    read_answers: read_answers,
    weakest_dimension: weakest_dimension,
    render_dimension_list: render_dimension_list,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.vestibular_dimension_read = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
