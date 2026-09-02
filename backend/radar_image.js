/**
 * Renders the readiness radar as a PNG for the contact email.
 *
 * Why server-side rather than capturing the browser's chart: the on-page SVG
 * carries NO presentation attributes — every fill, stroke and colour comes
 * from external CSS classes in styles/styles.css. Serialising that node gives
 * geometry with no paint, so a client-side capture would have to walk the
 * clone inlining computed styles, rasterise through a canvas, and post ~30KB
 * of base64 through a request body whose limit is 100KB by default. Drawing
 * from the numbers instead removes all of that.
 *
 * ⭐ THE GEOMETRY IS IMPORTED, NOT REIMPLEMENTED. scripts/radar.js separates
 * its maths from the DOM precisely so it can run without a browser — that is
 * why tools/test_radar.cjs can already exercise it. Copying those angle
 * calculations into this file would recreate the drift that render_content.mjs
 * exists to prevent, and would put a second, untested copy of the maths behind
 * an email nobody proofreads. Shared module means tools/test_radar.cjs guards
 * this renderer too.
 *
 * ⛔ THE CHART IS AN ENHANCEMENT AND MUST NEVER COST AN ENQUIRY. Every failure
 * path here returns null so the caller sends the email without an image. A
 * missing module (if the deploy root excludes ../scripts), a malformed shape
 * payload or a rasteriser fault must all degrade to the text summary, which
 * already carries every value.
 *
 * Colours are duplicated from styles.css by necessity — an email cannot read
 * the site's stylesheet. They are named here so the drift is visible rather
 * than scattered through the markup.
 */

const INK = {
  bg: '#090d14',
  ring: 'rgba(255,255,255,0.10)',
  spoke: 'rgba(255,255,255,0.14)',
  shape: '#a3e635',
  shapeFill: 'rgba(163,230,53,0.22)',
  // The stated shape is an outline over a hatch, so the band between the two
  // reads as the SPACE between readings rather than as a third value. Same
  // draw order as the on-page chart: stated first, lived over it.
  stated: 'rgba(163,230,53,0.55)',
  hatch: 'rgba(163,230,53,0.30)',
  label: '#8899bb',
};

// Caps. The payload is attacker-shaped input from a public form, so every
// dimension of it is bounded before it reaches a renderer.
const MAX_AXES = 12;
const MAX_LABEL = 40;
const SCALE_MAX = 5;

let geometryPromise = null;

/** Load the shared geometry once, tolerating its absence. */
function loadGeometry() {
  if (!geometryPromise) {
    geometryPromise = import('../scripts/radar.js')
      .then((m) => (m.default && m.default.radar_geometry ? m.default : null))
      .catch((err) => {
        console.warn('radar_image: shared geometry unavailable, emails will be text-only —', err.message);
        return null;
      });
  }
  return geometryPromise;
}

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * Validate the shape payload. Returns a clean {dimensions, values} or null.
 * Rejects rather than repairs: a partially-trusted chart is worse than none,
 * because it looks authoritative.
 */
function parseShape(raw) {
  if (!raw) return null;
  let data;
  try {
    data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
  if (!data || !Array.isArray(data.axes)) return null;
  if (data.axes.length < 3 || data.axes.length > MAX_AXES) return null;

  const dimensions = [];
  const stated = {};
  const lived = {};
  let readings = 0;

  for (const axis of data.axes) {
    if (!axis || typeof axis.key !== 'string' || typeof axis.label !== 'string') return null;
    if (!/^[a-z0-9_]{1,40}$/i.test(axis.key)) return null;
    dimensions.push({ key: axis.key, label: axis.label.slice(0, MAX_LABEL) });

    // ⛔ A VANTAGE MAY BE LEGITIMATELY ABSENT and that is not a malformed
    // payload. Three lived items ask about an event that may never have
    // happened, and the respondent can say so. Absent is left OUT of the
    // values object, which radar_geometry already plots as a gap in the shape
    // rather than at the centre. Rejecting the payload for it would silently
    // strip the chart from the email of exactly the people who answered most
    // carefully.
    for (const [vantage, into] of [['stated', stated], ['lived', lived]]) {
      const raw = axis[vantage];
      if (raw === undefined || raw === null) continue;
      const v = Number(raw);
      if (!Number.isFinite(v) || v < 1 || v > SCALE_MAX) return null;
      into[axis.key] = v;
      readings += 1;
    }
  }

  // Nothing to draw is not a chart, it is an empty frame. The caller degrades
  // to the text summary, which carries every value anyway.
  if (!readings) return null;

  return { dimensions, stated, lived };
}

function buildSvg(geos, dimensions, radius, cx, cy, size, ringRadii, labelGap, fontSize) {
  // geos is ordered back to front: stated, then lived over it. The first is
  // used for the grid and labels only because every geometry shares one set of
  // axes — the angles come from `dimensions`, which is the same list for both.
  const geo = geos[0];

  const rings = ringRadii
    .map((r) => `<circle cx="${cx}" cy="${cy}" r="${r.toFixed(2)}" fill="none" stroke="${INK.ring}" stroke-width="1"/>`)
    .join('');
  const spokes = geo.axes
    .map((a) => `<line x1="${cx}" y1="${cy}" x2="${a.x.toFixed(2)}" y2="${a.y.toFixed(2)}" stroke="${INK.spoke}" stroke-width="1"/>`)
    .join('');

  const defs = '<defs>'
    + '<pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">'
    + `<line x1="0" y1="0" x2="0" y2="6" stroke="${INK.hatch}" stroke-width="1.5"/>`
    + '</pattern></defs>';

  const shape = geos
    .map((g, i) => {
      if (!g.polygon) return '';
      const isLived = i === geos.length - 1;
      return isLived
        ? `<polygon points="${g.polygon}" fill="${INK.shapeFill}" stroke="${INK.shape}" stroke-width="2" stroke-linejoin="round"/>`
        : `<polygon points="${g.polygon}" fill="url(#hatch)" stroke="${INK.stated}" stroke-width="1.5" `
          + 'stroke-dasharray="4 3" stroke-linejoin="round"/>';
    })
    .join('');

  const dots = geos
    .map((g, i) => g.points
      .filter(Boolean)
      .map((p) => `<circle cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="3" `
        + `fill="${i === geos.length - 1 ? INK.shape : INK.stated}"/>`)
      .join(''))
    .join('');
  // Labels use a generic family: a rasteriser has no access to the site's
  // webfont, and naming one it cannot resolve just yields a silent fallback.
  const labels = geo.axes
    .map((a, i) => {
      const lx = cx + (radius + labelGap) * Math.cos(a.angle);
      const ly = cy + (radius + labelGap) * Math.sin(a.angle);
      const dx = Math.cos(a.angle);
      const anchor = Math.abs(dx) < 0.3 ? 'middle' : dx > 0 ? 'start' : 'end';
      return `<text x="${lx.toFixed(1)}" y="${(ly + 4).toFixed(1)}" text-anchor="${anchor}" `
        + `font-family="Helvetica,Arial,sans-serif" font-size="${fontSize}" fill="${INK.label}">`
        + `${esc(dimensions[i].label)}</text>`;
    })
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`
    + `<rect width="${size}" height="${size}" fill="${INK.bg}"/>`
    + defs + rings + spokes + shape + dots + labels
    + '</svg>';
}

/**
 * @returns {Promise<{base64: string, contentType: string} | null>}
 *          null whenever anything at all goes wrong.
 */
export async function renderReadinessRadar(rawShape) {
  const parsed = parseShape(rawShape);
  if (!parsed) return null;

  const radar = await loadGeometry();
  if (!radar) return null;

  try {
    const radius = 100;
    const LABEL_GAP = 20;
    const FONT_SIZE = 12;
    // Pad is DERIVED, not chosen. A fixed 68 clipped "AI enablement" off the
    // left edge — the longest label at the widest anchor is exactly the case a
    // guessed constant gets wrong, and it fails silently in an email nobody
    // re-reads. 0.62em per char is a deliberate over-estimate for Helvetica;
    // over-padding costs whitespace, under-padding costs a truncated word.
    const longest = parsed.dimensions.reduce((n, d) => Math.max(n, d.label.length), 0);
    const pad = Math.ceil(LABEL_GAP + longest * FONT_SIZE * 0.62) + 8;
    const size = (radius + pad) * 2;
    const cx = size / 2;
    const cy = size / 2;

    // Back to front: stated, then lived. Same order as the on-page chart, and
    // the same reason — a dent in the LIVED shape must carry the visual weight
    // whether or not it diverges from the claim.
    const geos = [parsed.stated, parsed.lived].map((values) => radar.radar_geometry({
      dimensions: parsed.dimensions,
      values,
      max: SCALE_MAX,
      radius,
      cx,
      cy,
    }));
    // ring_radii(max, radius) — argument order matters and is easy to invert.
    const ringRadii = radar.ring_radii(SCALE_MAX, radius);

    const svg = buildSvg(geos, parsed.dimensions, radius, cx, cy, size, ringRadii, LABEL_GAP, FONT_SIZE);

    const { Resvg } = await import('@resvg/resvg-js');
    const png = new Resvg(svg, { fitTo: { mode: 'width', value: 420 } }).render().asPng();
    return { base64: Buffer.from(png).toString('base64'), contentType: 'image/png' };
  } catch (err) {
    console.warn('radar_image: render failed, sending text-only —', err.message);
    return null;
  }
}
