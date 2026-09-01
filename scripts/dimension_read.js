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

  function band_for(value) {
    if (value >= 4) return { label: 'Strong', className: 'band-strong' };
    if (value === 3) return { label: 'Developing', className: 'band-developing' };
    return { label: 'Needs work', className: 'band-weak' };
  }

  /**
   * Read every dimension from the form BY KEY. Reading by position once totalled
   * correctly while being unable to attribute any answer to any dimension, so
   * the key is the contract.
   */
  function read_answers(form, dimensions, max) {
    const limit = max || 5;
    const fd = new FormData(form);
    const answers = {};
    let total = 0;
    for (let i = 0; i < dimensions.length; i++) {
      const d = dimensions[i];
      const v = Number(fd.get(d.key));
      if (!Number.isFinite(v) || v < 1 || v > limit) {
        return {
          ok: false,
          message: 'Please answer every question with a number from 1 to ' + limit + '.',
        };
      }
      answers[d.key] = v;
      total += v;
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

  function render_dimension_list(dimensions, answers, max) {
    const limit = max || 5;
    const rows = dimensions
      .map(function (d) {
        const v = answers[d.key];
        const band = band_for(v);
        return `
        <li class="dim">
          <span class="dim-label">${d.label}</span>
          <span class="dim-meter" aria-hidden="true"><i style="width:${(v / limit) * 100}%"></i></span>
          <span class="dim-band ${band.className}">${band.label}</span>
        </li>`;
      })
      .join('');
    return `<ul class="dim-list">${rows}</ul>`;
  }

  const api = {
    band_for: band_for,
    read_answers: read_answers,
    weakest_dimension: weakest_dimension,
    render_dimension_list: render_dimension_list,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.vestibular_dimension_read = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
