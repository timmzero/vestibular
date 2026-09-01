/**
 * Free Agile diagnostic scorecard.
 *
 * Reads its dimensions, thresholds, stage names and PRICES from the
 * #scorecard-data block, which the generator emits from
 * content/practices.json. Nothing about the ladder is hardcoded here: a
 * result that recommends a package at a price the same page contradicts is
 * worse than giving no recommendation at all.
 *
 * This is the bottom rung of a priced ladder, so the result has two jobs —
 * be useful on its own, and make the paid engagement the obvious next step.
 * A single total does the second job but not the first, which is why the
 * per-dimension read exists.
 */

const formEl = document.getElementById('scorecard-form');
const resultEl = document.getElementById('scorecard-result');
const ctaEl = document.getElementById('contact-cta');
const dataEl = document.getElementById('scorecard-data');

/** Fail loudly in the console rather than silently scoring against nothing. */
function loadConfig() {
  if (!dataEl) {
    console.error('scorecard: #scorecard-data not found — has the page been regenerated?');
    return null;
  }
  try {
    const cfg = JSON.parse(dataEl.textContent);
    if (!cfg.dimensions?.length || !cfg.thresholds?.length || !cfg.stages?.length) {
      console.error('scorecard: config is missing dimensions, thresholds or stages');
      return null;
    }
    return cfg;
  } catch (err) {
    console.error('scorecard: could not parse config', err);
    return null;
  }
}

function bandFor(score) {
  if (score >= 4) return { label: 'Strong', className: 'band-strong' };
  if (score === 3) return { label: 'Developing', className: 'band-developing' };
  return { label: 'Needs work', className: 'band-weak' };
}

function render(cfg, answers, total) {
  const stageName =
    cfg.thresholds.find((t) => total >= t.min)?.stage ?? cfg.thresholds.at(-1).stage;
  const stage = cfg.stages.find((s) => s.stage === stageName);

  const max = cfg.dimensions.length * 5;

  const rows = cfg.dimensions
    .map((d) => {
      const v = answers[d.key];
      const band = bandFor(v);
      return `
        <li class="dim">
          <span class="dim-label">${d.label}</span>
          <span class="dim-meter" aria-hidden="true"><i style="width:${(v / 5) * 100}%"></i></span>
          <span class="dim-band ${band.className}">${band.label}</span>
        </li>`;
    })
    .join('');

  // The weakest dimension is the honest place to start, and it is usually not
  // the one a team expects.
  const weakest = cfg.dimensions
    .slice()
    .sort((a, b) => answers[a.key] - answers[b.key])[0];

  const next = stage
    ? `
      <div class="result-next">
        <p class="result-next-head">Where that puts you</p>
        <p><strong>Stage ${cfg.stages.indexOf(stage) + 1} &mdash; ${stage.stage}.</strong> ${stage.focus}</p>
        <p class="result-next-pkg">
          <span class="result-pkg-name">${stage.package} package</span>
          <span class="result-pkg-price">${stage.price}${stage.duration ? ` &middot; ${stage.duration}` : ''}</span>
        </p>
      </div>`
    : '';

  return `
    <p class="result-total">${total} / ${max} &mdash; ${stageName}</p>
    <ul class="dim-list">${rows}</ul>
    <p class="result-weakest">Weakest right now: <strong>${weakest.label}</strong>. That is where we would start.</p>
    ${next}`;
}

if (formEl) {
  const cfg = loadConfig();

  // The radar is a view over the form inputs, so it reuses the dimension list
  // already parsed above rather than reading the config a second time. It is
  // strictly additive: if the module is missing or throws, the scorecard below
  // still scores and submits exactly as before.
  const radarEl = document.getElementById('radar');
  if (cfg && radarEl && window.vestibular_radar) {
    try {
      window.vestibular_radar.create_radar({
        container: radarEl,
        form: formEl,
        dimensions: cfg.dimensions,
        max: 5,
      });
    } catch (err) {
      console.error('scorecard: radar failed to initialise', err);
    }
  }

  formEl.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!cfg) {
      if (resultEl) {
        resultEl.textContent =
          'Sorry — the scorecard could not load. Please email consult@vestibular.nexus and we will run it with you.';
        resultEl.classList.add('error');
      }
      return;
    }

    // Read by key rather than by position. The previous version summed
    // FormData.values() in document order, which happened to total correctly
    // but could not attribute any answer to any dimension.
    const fd = new FormData(e.target);
    const answers = {};
    let total = 0;
    for (const d of cfg.dimensions) {
      const v = Number(fd.get(d.key));
      if (!Number.isFinite(v) || v < 1 || v > 5) {
        resultEl.textContent = 'Please answer every question with a number from 1 to 5.';
        resultEl.classList.add('error');
        resultEl.setAttribute('role', 'alert');
        return;
      }
      answers[d.key] = v;
      total += v;
    }

    resultEl.classList.remove('error');
    resultEl.removeAttribute('role');
    resultEl.innerHTML = render(cfg, answers, total);

    if (ctaEl) ctaEl.style.display = 'block';

    // Plain-text summary for the contact form handoff.
    const stageName =
      cfg.thresholds.find((t) => total >= t.min)?.stage ?? cfg.thresholds.at(-1).stage;
    const detail = cfg.dimensions.map((d) => `${d.label} ${answers[d.key]}/5`).join(', ');
    const resultText = `Total ${total}/${cfg.dimensions.length * 5} → ${stageName} (${detail})`;

    const hiddenField = document.getElementById('scorecard-hidden');
    if (hiddenField) hiddenField.value = resultText;

    // localStorage THROWS, not returns null, when storage is blocked (Safari
    // private browsing, blocked cookies). Unguarded it took down the tail of
    // this handler for those users. The handoff to the contact form goes via
    // the hidden field above, so losing this is a graceful degradation.
    try {
      localStorage.setItem('scorecardResult', resultText);
    } catch (err) {
      console.warn('scorecard: could not persist result locally', err);
    }
  });
}

if (ctaEl) {
  ctaEl.addEventListener('click', () => {
    window.location.href = 'contact.html';
  });
}
