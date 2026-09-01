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
          message: 'Please answer every question with a number from 1 to ' + limit + '.',
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
      for (let i = 0; i < keys.length; i++) {
        const el = form ? form.elements[keys[i]] : null;
        const raw = el ? el.value : undefined;
        const v = Number(raw);
        if (raw === undefined || raw === null || raw === '' ||
            !Number.isFinite(v) || v < 1 || v > limit) {
          continue;
        }
        sum += v;
        count += 1;
      }
      answered += count;
      values[d.key] = count ? sum / count : undefined;
      provisional[d.key] = count > 0 && count < keys.length;
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

  const api = {
    band_for: band_for,
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
