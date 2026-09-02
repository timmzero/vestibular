/**
 * Renders the readiness radar as a PNG for the contact email.
 *
 * Why server-side rather than capturing the browser's chart: the on-page SVG
 * carries NO presentation attributes — every fill, stroke and colour comes
 * from external CSS classes in styles/styles.css. Serialising that node gives
 * geometry with no paint, so a client-side capture would have to walk the
 * clone inlining computed styles, rasterise through a canvas, and post ~30KB
 * of base64 through a request body whose limit is 100KB by default. Drawing
 * from the six numbers instead removes all of that.
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
  const values = {};
  for (const axis of data.axes) {
    if (!axis || typeof axis.key !== 'string' || typeof axis.label !== 'string') return null;
    if (!/^[a-z0-9_]{1,40}$/i.test(axis.key)) return null;
    const v = Number(axis.value);
    if (!Number.isFinite(v) || v < 1 || v > SCALE_MAX) return null;
    dimensions.push({ key: axis.key, label: axis.label.slice(0, MAX_LABEL) });
    values[axis.key] = v;
  }
  return { dimensions, values };
}

function buildSvg(geo, dimensions, radius, cx, cy, size, ringRadii, labelGap, fontSize) {
  const rings = ringRadii
    .map((r) => `<circle cx="${cx}" cy="${cy}" r="${r.toFixed(2)}" fill="none" stroke="${INK.ring}" stroke-width="1"/>`)
    .join('');
  const spokes = geo.axes
    .map((a) => `<line x1="${cx}" y1="${cy}" x2="${a.x.toFixed(2)}" y2="${a.y.toFixed(2)}" stroke="${INK.spoke}" stroke-width="1"/>`)
    .join('');
  const shape = geo.polygon
    ? `<polygon points="${geo.polygon}" fill="${INK.shapeFill}" stroke="${INK.shape}" stroke-width="2" stroke-linejoin="round"/>`
    : '';
  const dots = geo.points
    .filter(Boolean)
    .map((p) => `<circle cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="3" fill="${INK.shape}"/>`)
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
    + rings + spokes + shape + dots + labels
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

    const geo = radar.radar_geometry({
      dimensions: parsed.dimensions,
      values: parsed.values,
      max: SCALE_MAX,
      radius,
      cx,
      cy,
    });
    // ring_radii(max, radius) — argument order matters and is easy to invert.
    const ringRadii = radar.ring_radii(SCALE_MAX, radius);

    const svg = buildSvg(geo, parsed.dimensions, radius, cx, cy, size, ringRadii, LABEL_GAP, FONT_SIZE);

    const { Resvg } = await import('@resvg/resvg-js');
    const png = new Resvg(svg, { fitTo: { mode: 'width', value: 420 } }).render().asPng();
    return { base64: Buffer.from(png).toString('base64'), contentType: 'image/png' };
  } catch (err) {
    console.warn('radar_image: render failed, sending text-only —', err.message);
    return null;
  }
}
