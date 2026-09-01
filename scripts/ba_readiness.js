/**
 * AI transformation readiness radar.
 *
 * Reads its dimensions from the #ba-readiness-data block, which the generator
 * emits from content/practices.json.
 *
 * There is deliberately NO total, NO threshold and NO stage. On the Agile side
 * a cumulative score maps to a maturity stage and a priced package; here team
 * health is a measured input to an operating-model redesign, and collapsing six
 * axes into one number would both discard the reading and make the two
 * practices look like the same offering twice.
 *
 * What the reader gets instead is the shape and the weakest axis — the place we
 * would start listening.
 */

const formEl = document.getElementById('ba-readiness-form');
const resultEl = document.getElementById('ba-readiness-result');
const ctaEl = document.getElementById('ba-readiness-cta');
const dataEl = document.getElementById('ba-readiness-data');
const radarEl = document.getElementById('ba-readiness-radar');

/** Fail loudly in the console rather than silently rendering against nothing. */
function load_config() {
  if (!dataEl) {
    console.error('ba_readiness: #ba-readiness-data not found — has the page been regenerated?');
    return null;
  }
  try {
    const cfg = JSON.parse(dataEl.textContent);
    if (!cfg.dimensions?.length) {
      console.error('ba_readiness: config is missing dimensions');
      return null;
    }
    return cfg;
  } catch (err) {
    console.error('ba_readiness: could not parse config', err);
    return null;
  }
}

if (formEl) {
  const cfg = load_config();
  const shared = window.vestibular_dimension_read;

  // Additive: if the radar module is missing or throws, the read below still
  // works. The inputs remain the source of truth for the values either way.
  if (cfg && radarEl && window.vestibular_radar) {
    try {
      window.vestibular_radar.create_radar({
        container: radarEl,
        form: formEl,
        dimensions: cfg.dimensions,
        max: 5,
        values_source: window.vestibular_dimension_read.axis_values,
      });
    } catch (err) {
      console.error('ba_readiness: radar failed to initialise', err);
    }
  }

  formEl.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!cfg || !shared) {
      if (resultEl) {
        resultEl.textContent =
          'Sorry — this could not load. Please email consult@vestibular.nexus and we will run it with you.';
        resultEl.classList.add('error');
      }
      return;
    }

    const read = shared.read_answers(e.target, cfg.dimensions, 5);
    if (!read.ok) {
      resultEl.textContent = read.message;
      resultEl.classList.add('error');
      resultEl.setAttribute('role', 'alert');
      return;
    }

    const answers = read.answers;
    const weakest = shared.weakest_dimension(cfg.dimensions, answers);

    resultEl.classList.remove('error');
    resultEl.removeAttribute('role');
    resultEl.innerHTML = `
      ${shared.render_dimension_list(cfg.dimensions, answers, 5)}
      <p class="result-weakest">Weakest right now: <strong>${weakest.label}</strong>. That is where we would start.</p>
      <p class="result-caveat">This is a self-assessment from one point of view. It is a prompt for a conversation, not a measurement of your team.</p>`;

    if (ctaEl) ctaEl.style.display = 'block';

    // Plain-text summary for the contact form handoff. No total, by design.
    const detail = cfg.dimensions.map((d) => `${d.label} ${answers[d.key]}/5`).join(', ');
    const resultText = `AI readiness: ${detail}. Weakest: ${weakest.label}.`;

    const hiddenField = document.getElementById('ba-readiness-hidden');
    if (hiddenField) hiddenField.value = resultText;

    // localStorage THROWS rather than returning null when storage is blocked
    // (Safari private browsing, blocked cookies).
    try {
      localStorage.setItem('baReadinessResult', resultText);
    } catch (err) {
      console.warn('ba_readiness: could not persist result locally', err);
    }
  });
}

if (ctaEl) {
  ctaEl.addEventListener('click', () => {
    window.location.href = 'contact.html';
  });
}
