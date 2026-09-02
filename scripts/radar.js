/**
 * Team-health radar (kite) chart.
 *
 * Deliberately knows NOTHING about stages, thresholds, packages or prices.
 * Those belong to the Agile maturity model; the BA practice is a sequence and
 * must be able to reuse this module without dragging a maturity ladder along.
 * The only inputs are a keyed dimension list and a values object.
 *
 * The <input> elements remain the single source of truth for the values. This
 * module reads them and draws; it never holds its own copy of a score. That is
 * what keeps the existing FormData-by-key submit path working untouched, and
 * what keeps the keyboard/screen-reader path the real one rather than a
 * fallback bolted on beside a canvas.
 *
 * ADDING DRAG LATER: add pointer handlers that convert a position back to a
 * value, write it to the matching input, and dispatch an 'input' event. The
 * render path below is already driven by that event, so nothing here changes.
 * The seam is the input element, not a shared state object.
 */

(function (root) {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';

  /** Geometry only — no DOM, so it can be tested without a browser. */
  function radar_geometry(options) {
    const dimensions = options.dimensions || [];
    const values = options.values || {};
    // Which axes are still a running mean rather than a settled reading.
    const provisional = options.provisional || {};
    const max = options.max || 5;
    const radius = options.radius || 100;
    const cx = options.cx || 0;
    const cy = options.cy || 0;

    if (!dimensions.length) throw new Error('radar_geometry: dimensions is empty');
    if (!(max > 0)) throw new Error('radar_geometry: max must be positive');
    if (!(radius > 0)) throw new Error('radar_geometry: radius must be positive');

    const step = (Math.PI * 2) / dimensions.length;

    const axes = dimensions.map(function (d, i) {
      // Start at 12 o'clock and go clockwise, so the first dimension in the
      // SSOT is the first one a reader's eye lands on.
      const angle = -Math.PI / 2 + i * step;
      return {
        key: d.key,
        label: d.label,
        angle: angle,
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
      };
    });

    const points = axes.map(function (axis) {
      const raw = values[axis.key];
      const v = Number(raw);
      // An unanswered axis is ABSENT, not zero. Plotting a missing answer at
      // the centre would draw a value the person never gave.
      if (raw === undefined || raw === null || raw === '' || !Number.isFinite(v)) return null;
      if (v < 1 || v > max) return null;
      const r = radius * (v / max);
      return {
        key: axis.key,
        value: v,
        provisional: !!provisional[axis.key],
        x: cx + r * Math.cos(axis.angle),
        y: cy + r * Math.sin(axis.angle),
      };
    });

    // The shape closes as soon as every axis has SOMETHING to say, so it forms
    // while the form is being filled rather than appearing all at once at the
    // end. It is drawn as a sketch until every axis is settled: an axis still
    // averaging half its questions is a running value, not a reading.
    const plottable = points.every(function (p) { return p !== null; });
    const settled = plottable && points.every(function (p) { return !p.provisional; });
    const polygon = plottable
      ? points.map(function (p) { return p.x.toFixed(2) + ',' + p.y.toFixed(2); }).join(' ')
      : null;

    const plotted = points.filter(function (p) { return p !== null; }).length;
    return {
      axes: axes, points: points, polygon: polygon,
      complete: settled, settled: settled, plottable: plottable,
      plotted: plotted, total: dimensions.length,
    };
  }

  /** Ring radii for the background grid, outermost first. */
  function ring_radii(max, radius) {
    const out = [];
    for (let i = max; i >= 1; i--) out.push((radius * i) / max);
    return out;
  }

  function el(name, attrs) {
    const node = document.createElementNS(SVG_NS, name);
    for (const k in attrs) {
      if (Object.prototype.hasOwnProperty.call(attrs, k)) node.setAttribute(k, attrs[k]);
    }
    return node;
  }

  function render_radar(svg, geometry, config) {
    const max = config.max;
    const radius = config.radius;
    const cx = config.cx;
    const cy = config.cy;

    while (svg.firstChild) svg.removeChild(svg.firstChild);

    const grid = el('g', { class: 'radar-grid' });
    ring_radii(max, radius).forEach(function (r) {
      grid.appendChild(el('circle', { cx: cx, cy: cy, r: r.toFixed(2), class: 'radar-ring' }));
    });
    geometry.axes.forEach(function (axis, i) {
      // An axis with no plotted point is drawn dimmer. Without this, a form
      // where two questions feed one axis appears completely dead until the
      // second is answered, which reads as a broken chart.
      const state = geometry.points[i] ? '' : ' is-incomplete';
      grid.appendChild(el('line', {
        x1: cx, y1: cy, x2: axis.x.toFixed(2), y2: axis.y.toFixed(2),
        class: 'radar-spoke' + state,
      }));
    });
    svg.appendChild(grid);

    if (geometry.polygon) {
      svg.appendChild(el('polygon', {
        points: geometry.polygon,
        class: 'radar-shape' + (geometry.settled ? '' : ' is-provisional'),
      }));
    }

    geometry.points.forEach(function (p) {
      if (!p) return;
      svg.appendChild(el('circle', {
        cx: p.x.toFixed(2), cy: p.y.toFixed(2), r: 4,
        class: 'radar-point' + (p.provisional ? ' is-provisional' : ''),
      }));
    });

    const labels = el('g', { class: 'radar-labels' });
    geometry.axes.forEach(function (axis, i) {
      const lx = cx + (radius + config.label_gap) * Math.cos(axis.angle);
      const ly = cy + (radius + config.label_gap) * Math.sin(axis.angle);
      // Anchor by side so the two near-horizontal labels on an even-spoked chart
      // sit clear of the shape instead of overlapping it.
      const cos = Math.cos(axis.angle);
      const anchor = Math.abs(cos) < 0.1 ? 'middle' : cos > 0 ? 'start' : 'end';
      const text = el('text', {
        x: lx.toFixed(2), y: ly.toFixed(2),
        class: 'radar-label' + (geometry.points[i] ? '' : ' is-incomplete'),
        'text-anchor': anchor, 'dominant-baseline': 'middle',
      });
      text.textContent = axis.label;
      labels.appendChild(text);
    });
    svg.appendChild(labels);
  }

  /**
   * Wire a radar to a form. Values are read from the form's inputs by name,
   * matching the dimension keys — the same by-key read the scoring path uses.
   */
  function create_radar(options) {
    const container = options.container;
    const form = options.form;
    const dimensions = options.dimensions;
    const max = options.max || 5;

    if (!container) throw new Error('create_radar: container is required');
    if (!dimensions || !dimensions.length) throw new Error('create_radar: dimensions is required');

    const radius = 100;
    const label_gap = 18;
    const pad = 62; // room for the longest label at the widest anchor
    const size = (radius + pad) * 2;
    const cx = size / 2;
    const cy = size / 2;
    const config = { max: max, radius: radius, cx: cx, cy: cy, label_gap: label_gap };

    const svg = el('svg', {
      viewBox: '0 0 ' + size + ' ' + size,
      class: 'radar-svg',
      // The inputs carry the accessible representation of these values, so the
      // chart itself is decorative to assistive tech rather than a second,
      // worse copy of the same information.
      'aria-hidden': 'true',
      focusable: 'false',
    });
    container.appendChild(svg);

    // An axis may be fed by one input or several. The caller supplies the
    // reader so this module never duplicates the averaging rule; the default
    // is the simple one-input-per-axis case.
    // A source returns { values, provisional, ... }; the default is the simple
    // one-input-per-axis case, where nothing can be provisional.
    const read_state = options.values_source
      ? function () { return options.values_source(form, dimensions, max); }
      : function () {
          const values = {};
          dimensions.forEach(function (d) {
            const input = form ? form.elements[d.key] : null;
            values[d.key] = input ? input.value : undefined;
          });
          return { values: values, provisional: {} };
        };

    function update() {
      const state = read_state();
      const geometry = radar_geometry({
        dimensions: dimensions,
        values: state.values,
        provisional: state.provisional,
        max: max, radius: radius, cx: cx, cy: cy,
      });
      geometry.answered = state.answered;
      geometry.questions = state.questions;
      render_radar(svg, geometry, config);
      container.classList.toggle('is-complete', geometry.complete);
      if (typeof options.on_render === 'function') options.on_render(geometry);
      return geometry;
    }

    if (form) form.addEventListener('input', update);
    update();

    return { update: update, svg: svg, read_state: read_state };
  }

  const api = {
    radar_geometry: radar_geometry,
    ring_radii: ring_radii,
    render_radar: render_radar,
    create_radar: create_radar,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.vestibular_radar = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
