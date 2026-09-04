/**
 * Renders the readiness breakdown — the thing you get on screen after "See our
 * shape" — as an email-safe HTML table.
 *
 * The email already carried a one-line prose summary. It reads as a comma list
 * ("Roles 1/5, AI fit 1/4, …") and it collapses the distinction the instrument
 * is built around: dimension_read.js separates `is-aligned-low` from
 * `is-aligned-high` precisely because 1/1 and 5/5 are the two most opposite
 * readings the scale can produce, and calls aligned-low "the reading with no
 * gap to point at and the one most worth naming". The prose renders both as
 * "1/1" and "5/5" with nothing marking which is the alarm.
 *
 * ⭐ THE TABLE CARRIES WHAT THE RADAR CANNOT. A spike is obvious in the chart;
 * a small tight shape near the centre is not — 1/1 and 2/2 are a few pixels
 * apart at r=100. So the two artefacts are complementary rather than redundant,
 * and the table is deliberately NOT filtered to divergent rows: gap-only would
 * drop every aligned-low row, which is the set most worth reading.
 *
 * ⛔ THE THRESHOLDS ARE IMPORTED, NOT RESTATED. band_for lives in
 * scripts/dimension_read.js and is shared by both practices; a second copy of
 * `>= 4 strong, >= 3 developing` here would drift from the on-page rendering
 * the first time either moved, and the drift would show up in an email nobody
 * proofreads. Same reason radar_image.js imports the geometry instead of
 * recomputing angles.
 *
 * ⛔ EMAIL IS NOT A BROWSER. No external stylesheet, so every rule is inline.
 * No flexbox or grid — Outlook's rendering engine is Word. Table markup with
 * explicit cellpadding is the only layout that survives, which is why this
 * reads like 2004.
 */

let readPromise = null;

/** Load the shared dimension-read module once, tolerating its absence. */
function loadDimensionRead() {
  if (!readPromise) {
    readPromise = import('../scripts/dimension_read.js')
      .then((m) => (m.default && m.default.band_for ? m.default : null))
      .catch((err) => {
        console.warn('readiness_table: shared dimension-read unavailable —', err.message);
        return null;
      });
  }
  return readPromise;
}

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// Duplicated from styles.css by necessity — an email cannot read the site's
// stylesheet. Named here so the drift is visible rather than scattered inline.
const INK = {
  rule: '#e2e6ee',
  label: '#334155',
  muted: '#64748b',
  claimedHigher: '#b45309', // claim runs ahead of what was seen
  livedHigher: '#0f766e',   // seen better than claimed
  alignedLow: '#b91c1c',    // agreed, and agreed low — the alarm
  alignedHigh: '#15803d',   // agreed, and agreed high
  absent: '#94a3b8',
};

const MAX_AXES = 12;
const SCALE_MAX = 5;

/**
 * Classify one row. Mirrors dimension_read.js's gapClass ladder exactly,
 * including the aligned-low / aligned-high split, and defers to the shared
 * band_for for the cut point rather than restating it.
 */
function classify(stated, lived, bandFor) {
  if (stated === undefined || lived === undefined) {
    return { key: 'absent', colour: INK.absent, note: 'not answered' };
  }
  const gap = stated - lived;
  if (gap > 0) return { key: 'claimed-higher', colour: INK.claimedHigher, note: 'claimed above what was seen' };
  if (gap < 0) return { key: 'lived-higher', colour: INK.livedHigher, note: 'seen above what was claimed' };
  return bandFor(lived).className === 'band-weak'
    ? { key: 'aligned-low', colour: INK.alignedLow, note: 'agreed, and agreed low' }
    : { key: 'aligned-high', colour: INK.alignedHigh, note: 'agreed' };
}

/**
 * @returns {Promise<{html: string|null, reason: string}>} ALWAYS an object —
 *          same contract as renderReadinessRadar, and for the same reason: a
 *          missing breakdown must say which fault produced it.
 */
export async function renderReadinessTable(rawShape) {
  const hadInput = !(rawShape === undefined || rawShape === null || rawShape === '');
  if (!hadInput) return { html: null, reason: 'no_shape' };

  let data;
  try {
    data = typeof rawShape === 'string' ? JSON.parse(rawShape) : rawShape;
  } catch {
    return { html: null, reason: 'malformed_shape' };
  }
  if (!data || !Array.isArray(data.axes)) return { html: null, reason: 'malformed_shape' };
  if (!data.axes.length || data.axes.length > MAX_AXES) return { html: null, reason: 'malformed_shape' };

  const shared = await loadDimensionRead();
  if (!shared) return { html: null, reason: 'dimension_read_unavailable' };

  const num = (v) => {
    if (v === undefined || v === null) return undefined;
    const n = Number(v);
    // Out-of-range is treated as ABSENT rather than clamped: the renderer must
    // never print a number the visitor did not give. Same floor as the radar's
    // validator, which rejects the payload outright.
    return Number.isFinite(n) && n >= 1 && n <= SCALE_MAX ? n : undefined;
  };

  const rows = data.axes.map((axis) => {
    const label = typeof axis.label === 'string' ? axis.label.slice(0, 40) : '';
    const stated = num(axis.stated);
    const lived = num(axis.lived);
    const cls = classify(stated, lived, shared.band_for);
    const cell = (v) => (v === undefined
      ? `<span style="color:${INK.absent}">&mdash;</span>`
      : `${v}<span style="color:${INK.muted};font-size:12px">/${SCALE_MAX}</span>`);

    return '<tr>'
      + `<td style="padding:6px 10px;border-bottom:1px solid ${INK.rule};color:${INK.label}">${esc(label)}</td>`
      + `<td style="padding:6px 10px;border-bottom:1px solid ${INK.rule};text-align:right;white-space:nowrap">${cell(stated)}</td>`
      + `<td style="padding:6px 10px;border-bottom:1px solid ${INK.rule};text-align:right;white-space:nowrap">${cell(lived)}</td>`
      + `<td style="padding:6px 10px;border-bottom:1px solid ${INK.rule};color:${cls.colour};font-size:13px">${cls.note}</td>`
      + '</tr>';
  }).join('');

  const head = '<tr>'
    + `<th align="left" style="padding:6px 10px;border-bottom:2px solid ${INK.rule};color:${INK.muted};font-size:12px;font-weight:600">Dimension</th>`
    + `<th align="right" style="padding:6px 10px;border-bottom:2px solid ${INK.rule};color:${INK.muted};font-size:12px;font-weight:600">On paper</th>`
    + `<th align="right" style="padding:6px 10px;border-bottom:2px solid ${INK.rule};color:${INK.muted};font-size:12px;font-weight:600">In practice</th>`
    + `<th align="left" style="padding:6px 10px;border-bottom:2px solid ${INK.rule};color:${INK.muted};font-size:12px;font-weight:600">Read</th>`
    + '</tr>';

  const html = '<table role="presentation" cellpadding="0" cellspacing="0" border="0" '
    + 'style="border-collapse:collapse;width:100%;max-width:520px;'
    + 'font-family:Helvetica,Arial,sans-serif;font-size:14px">'
    + head + rows + '</table>';

  return { html, reason: 'ok' };
}
