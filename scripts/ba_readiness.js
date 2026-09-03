/**
 * AI transformation readiness radar.
 *
 * Reads its dimensions from the #ba-readiness-data block, which the generator
 * emits from content/practices.json.
 *
 * There is deliberately NO total, NO threshold and NO stage. On the Agile side
 * a cumulative score maps to a maturity stage and a priced package; here team
 * health is a measured input to an operating-model redesign, and collapsing the
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
    // Fail at LOAD, where it is diagnosable, rather than at submit. A config
    // whose questions carry no vantage renders a chart that silently draws
    // nothing and a result that silently reads as unanswered.
    const vantages = cfg.dimensions
      .flatMap(function (d) { return d.questions || []; })
      .filter(function (q) { return q.vantage; });
    if (!vantages.length) {
      console.error('ba_readiness: no question carries a vantage — the page needs regenerating ' +
        '(node tools/render_content.mjs)');
      return null;
    }
    return cfg;
  } catch (err) {
    console.error('ba_readiness: could not parse config', err);
    return null;
  }
}

/**
 * The result sentence.
 *
 * ⛔ THIS REPLACES "Weakest right now: X. That is where we would start." That
 * line was the only claim on the page that went beyond describing the answers
 * back, and it was the least defensible thing on it: the axes are not equated,
 * so the "weakest" could be naming the axis phrased most severely rather than
 * anything about the respondent. Two of the eight axes made it worse still — a
 * dent on Load or AI fit is opportunity, not weakness, so ranking them against
 * Roles compares different quantities.
 *
 * ⭐ THE GAP IS COMPARABLE WHERE THE LEVELS ARE NOT. Both readings come from
 * one person, one scale, one sitting, so severity and scale-use habits push
 * both the same way and cancel in the difference. So this names a distance and
 * quotes the two sentences that produced it, and asserts nothing about which
 * axis is worst.
 */
function question_text(dimension, vantage) {
  const q = (dimension.questions || []).find(function (item) { return item.vantage === vantage; });
  return q ? q.text : '';
}

function describe_widest(dimensions, ranked) {
  if (!ranked.length) {
    return '<p class="result-widest">Not enough of the paired questions were answered to read a ' +
      'distance between what is claimed here and what you have seen.</p>';
  }

  const top = ranked[0];
  if (top.gap === 0) {
    return '<p class="result-widest">On every area, what you understand the organisation to ' +
      'claim and what you have seen line up. That is worth saying — and it is also the point ' +
      'at which the levels themselves become the conversation rather than the distance ' +
      'between them.</p>';
  }

  // Ties are exact here: one item per vantage means gaps are whole numbers. The
  // weakest-axis line used to flip on a single click and name one of two axes
  // that were level; naming both is the honest form.
  const tied = ranked.filter(function (r) { return Math.abs(r.gap) === Math.abs(top.gap); });
  const dimension = dimensions.find(function (d) { return d.key === top.key; });
  const alsoText = tied.length > 1
    ? ` <span class="result-tied">${tied.slice(1).map(function (r) { return r.label; }).join(' and ')} ` +
      `${tied.length > 2 ? 'sit' : 'sits'} at the same distance.</span>`
    : '';

  const claimedHigher = top.gap > 0;
  const lead = claimedHigher
    ? `The widest distance is <strong>${top.label}</strong> — what you understand this ` +
      'organisation to claim is not what you have seen.'
    : `The widest distance is <strong>${top.label}</strong> — something is working better than ` +
      'the organisation appears to claim.';

  return `
    <p class="result-widest">${lead}${alsoText}</p>
    <blockquote class="result-quote">
      <p><span class="quote-vantage">On paper</span> &ldquo;${question_text(dimension, 'stated')}&rdquo; &mdash; you said ${top.stated_raw !== undefined ? top.stated_raw : top.stated}/5.</p>
      <p><span class="quote-vantage">In practice</span> &ldquo;${question_text(dimension, 'lived')}&rdquo; &mdash; you said ${top.lived_raw !== undefined ? top.lived_raw : top.lived}/5.</p>
    </blockquote>
    <p class="result-widest-note">That distance is the conversation we would start with.</p>`;
}

/**
 * The second reading: the FLOOR — the axis lowest on both vantages together.
 *
 * ⭐ TOTAL AND GAP ARE THE SAME PAIR IN ROTATED COORDINATES. stated = (T+G)/2,
 * lived = (T-G)/2, so printing both discards nothing. The objection to a total
 * applies to reporting it INSTEAD of the gap, never alongside it.
 *
 * ⭐ AND IT POINTS SOMEWHERE ELSE. 5/1 beside 2/2: the widest gap names the
 * first, and so would the lowest lived reading, so the uniformly low area is
 * never mentioned at all. By total it surfaces. A second reading that agrees
 * with the first is not a second reading.
 *
 * ⚠️ Still not a ranking claim. It names what was answered and quotes it back,
 * because the axes are not equated and the lowest total may belong to the pair
 * phrased most severely rather than to the worst thing about the organisation.
 */
function describe_floor(dimensions, ranked_low, widest_key, max) {
  if (!ranked_low.length) return '';

  const low = ranked_low[0];
  const tied = ranked_low.filter(function (r) { return r.total === low.total; });
  const alsoText = tied.length > 1
    ? ` <span class="result-tied">${tied.slice(1).map(function (r) { return r.label; }).join(' and ')} ` +
      `${tied.length > 2 ? 'sit' : 'sits'} equally low.</span>`
    : '';

  if (low.key === widest_key) {
    return `<p class="result-lowest">It is also the lowest area overall, at ` +
      `${low.total} of ${max * 2}.${alsoText}</p>`;
  }

  const dimension = dimensions.find(function (d) { return d.key === low.key; });
  // gap === 0 is the reading with nothing to point at: no distance between the
  // claim and the experience, both simply low. Worth saying out loud rather
  // than leaving a reader to notice an absence.
  const flatLine = low.gap === 0
    ? ' There is no distance here to point at — the claim and the experience agree, and ' +
      'the level itself is the finding.'
    : '';

  return `
    <p class="result-lowest">The lowest area overall is <strong>${low.label}</strong>, at ` +
    `${low.total} of ${max * 2}.${alsoText}</p>
    <blockquote class="result-quote">
      <p><span class="quote-vantage">On paper</span> &ldquo;${question_text(dimension, 'stated')}&rdquo; &mdash; you said ${low.stated_raw !== undefined ? low.stated_raw : low.stated}/${max}.</p>
      <p><span class="quote-vantage">In practice</span> &ldquo;${question_text(dimension, 'lived')}&rdquo; &mdash; you said ${low.lived_raw !== undefined ? low.lived_raw : low.lived}/${max}.</p>
    </blockquote>
    <p class="result-lowest-note">That is the other place we would start.${flatLine}</p>`;
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
        // ⛔ NOT axis_progress. That means over an axis's questions, which here
        // would average an espoused claim with a witnessed one.
        values_source: window.vestibular_dimension_read.vantage_progress,
        on_render: function (geometry) {
          const caption = radarEl.querySelector('.radar-caption');
          if (!caption) return;
          if (geometry.settled) {
            // The count comes from the geometry, never from a literal. This
            // string read "All twelve answered" for a day after the instrument
            // went to fourteen questions — at the exact moment a visitor
            // finished, in a file cached for four hours with no version in its
            // URL. The number is already in hand here; restating it is what
            // made it capable of being wrong.
            caption.textContent = 'All ' + geometry.questions +
              ' answered \u2014 this is your shape.';
          } else if (geometry.answered === 0) {
            caption.textContent = 'The shape builds as you answer.';
          } else {
            caption.textContent = geometry.answered + ' of ' + geometry.questions +
              ' answered \u2014 the shape firms up as you go.';
          }
        },
      });
    } catch (err) {
      console.error('ba_readiness: radar failed to initialise', err);
    }
  }

  // An escape and a number are mutually exclusive. read_question already gives
  // the escape precedence, so the READING is unambiguous either way — this is
  // about the screen not showing a person a 4 they can no longer be scored on.
  // A checkbox fires 'input', which is the event the radar already listens to,
  // so the chart follows without radar.js knowing escapes exist.
  formEl.addEventListener('change', function (e) {
    const box = e.target;
    if (!box || box.type !== 'checkbox' || !/_absent$/.test(box.name || '')) return;
    const numeric = formEl.elements[box.name.replace(/_absent$/, '')];
    if (!numeric) return;
    if (box.checked) numeric.value = '';
    numeric.disabled = box.checked;
  });

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

    const state = shared.vantage_progress(e.target, cfg.dimensions, 5);

    // ⛔ AN EMPTY READ IS NOT A COMPLETE ONE. This check previously read
    //   state.series.stated && state.series.stated.values[d.key] === undefined
    // which short-circuits to FALSY when the whole series is missing — so a
    // config carrying no vantages produced zero "unanswered" axes, passed
    // validation, and rendered a result of dashes over answers the person had
    // actually given. Establish that the series EXIST before asking what is in
    // them.
    const missing_series = ['stated', 'lived'].filter(function (v) { return !state.series[v]; });
    if (missing_series.length) {
      console.error('ba_readiness: config carries no ' + missing_series.join('/') +
        ' questions — has the page been regenerated since the vantages were added?');
      resultEl.textContent =
        'Sorry — this could not load. Please email consult@vestibular.nexus and we will run it with you.';
      resultEl.classList.add('error');
      resultEl.setAttribute('role', 'alert');
      return;
    }

    const unanswered = cfg.dimensions.filter(function (d) {
      return state.series.stated.values[d.key] === undefined;
    });
    if (unanswered.length) {
      resultEl.textContent =
        'Please answer every question with a number from 1 to 5, or tick the option where ' +
        'the question does not apply to you.';
      resultEl.classList.add('error');
      resultEl.setAttribute('role', 'alert');
      return;
    }

    const ranked = shared.gap_ranking(cfg.dimensions, state.series);
    const ranked_low = shared.lowest_total(cfg.dimensions, state.series);

    resultEl.classList.remove('error');
    resultEl.removeAttribute('role');
    resultEl.innerHTML = `
      ${shared.render_vantage_list(cfg.dimensions, state.series, 5)}
      ${describe_widest(cfg.dimensions, ranked)}
      ${describe_floor(cfg.dimensions, ranked_low, ranked.length ? ranked[0].key : null, 5)}
      <p class="result-caveat">This is a self-assessment from one point of view. It is a prompt for a conversation, not a measurement of your team.</p>`;

    if (ctaEl) ctaEl.style.display = 'block';

    // Plain-text summary for the contact form handoff. No total, by design.
    const detail = cfg.dimensions.map(function (d) {
      const s = state.series.stated.values[d.key];
      const l = state.series.lived.values[d.key];
      return `${d.label} ${s === undefined ? '-' : s}/${l === undefined ? '-' : l}`;
    }).join(', ');
    const widest = ranked[0];
    // No "AI readiness:" prefix here — the contact email and the on-page
    // status line both label this value themselves, so carrying the label in
    // the value renders it twice. scorecard.js is the pattern: its summary is
    // bare and the email supplies "Scorecard:".
    const lowest = ranked_low[0];
    const resultText = `${detail} (on paper/in practice). ` +
      (widest ? `Widest gap: ${widest.label} ${widest.stated} vs ${widest.lived}. ` : 'No gap could be read. ') +
      (lowest ? `Lowest overall: ${lowest.label} ${lowest.stated}+${lowest.lived}=${lowest.total}/10.` : '');

    const hiddenField = document.getElementById('ba-readiness-hidden');
    if (hiddenField) hiddenField.value = resultText;

    // Structured companion to the prose summary. The server draws the radar
    // from these numbers rather than parsing the sentence above — prose is for
    // the reader, data is for the renderer, and a parser over the sentence
    // would break the first time its wording changed.
    const shapeText = JSON.stringify({
      axes: cfg.dimensions.map((d) => ({
        key: d.key,
        label: d.label,
        stated: state.series.stated.values[d.key],
        lived: state.series.lived.values[d.key],
      })),
    });

    // localStorage THROWS rather than returning null when storage is blocked
    // (Safari private browsing, blocked cookies).
    try {
      localStorage.setItem('baReadinessResult', resultText);
      localStorage.setItem('baReadinessShape', shapeText);
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
