#!/usr/bin/env node
/**
 * Renders the GENERATED regions of the site's HTML from content/practices.json.
 *
 *   node tools/render_content.mjs           write the regions
 *   node tools/render_content.mjs --check   verify, exit 1 on drift
 *
 * Why a generator and not client-side rendering: the stage table is the primary
 * indexable content of two pages. Fetching it at runtime would put it behind a
 * JS round-trip for crawlers and remove it entirely for no-JS visitors. The
 * output is committed, so the site stays a plain static deploy with no build
 * step in the Cloudflare Pages pipeline and nothing new that can fail at deploy
 * time. CI runs --check, which is what stops the committed HTML drifting from
 * the source.
 *
 * This exists because the stage table was maintained by hand in two files and
 * 5 of 20 shared fields had already drifted apart — including `focus` on four
 * of the five stages.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = 'content/practices.json';
const PAGES = 'content/pages.json';
const PARTIALS = 'content/partials';

// Absolute, apex host. Open Graph requires absolute URLs, and rel=canonical
// must name ONE host: the site answers on both vestibular.nexus and
// www.vestibular.nexus with a 200, so without this every page looks like two
// pages to a crawler.
const SITE = 'https://vestibular.nexus';

/** Shared chrome lives in content/partials/ as plain files, so the markup is
 *  edited as markup rather than as escaped strings inside this generator. */
const partial = (name) =>
  readFileSync(resolve(ROOT, PARTIALS, name), 'utf8').replace(/\n$/, '');

/** Renders a price block. The GST-INCLUSIVE figure is derived from the ex-GST
 *  number in the source and rendered as the prominent price, with the ex-GST
 *  component beside it and never given greater prominence — ACL s48 component
 *  pricing. The threshold matters here: a business acquiring services under
 *  $100,000 can still be a "consumer" in law, and these engagements sit well
 *  under it, so the B2B ex-GST exemption cannot be relied on.
 *
 *  Only the ex-GST integer is stored. The inclusive figure is never typed, so
 *  the two cannot drift apart. */
function renderPrice(price, pricing) {
  if (!price) return '';
  const money = (n) =>
    '$' + Math.round(n).toLocaleString('en-AU');

  // Duration and proximity are not optional decoration. A fee with no stated
  // time commitment cannot be judged for value, and it is the gap that scope
  // disputes grow in. Elapsed time and billed effort are shown separately
  // because "1 week" reads as five billed days and here it is not.
  // A stated on-site commitment cannot exceed the billed effort. It read
  // "3 consulting days / 2-3 days on-site", leaving no time to write anything
  // up — the kind of incoherence a reader notices before you do.
  const onSite = /(\d+)(?:\s*[-\u2013]\s*(\d+))?\s*days?\s+on-site/i.exec(price.proximity || '');
  if (onSite && price.effort_days) {
    const most = Number(onSite[2] ?? onSite[1]);
    if (most > price.effort_days) {
      throw new Error(
        `price: ${most} days on-site exceeds ${price.effort_days} consulting days`
      );
    }
  }

  const shape = [
    price.duration,
    price.effort_days ? `${price.effort_days} consulting days` : null,
    price.proximity,
  ]
    .filter(Boolean)
    .map(escapeHtml)
    .join(' &middot; ');

  if (price.basis === 'scoped') {
    return [
      '<p class="price">',
      '<span class="price-scoped">Scoped per engagement</span>',
      shape ? `<span class="price-shape">${shape}</span>` : '',
      '</p>',
    ].join('');
  }

  const inc = price.ex_gst * (1 + pricing.gst_rate);
  const prefix = price.basis === 'from' ? 'From ' : '';
  const suffix = price.basis === 'retainer' ? ' per month' : '';

  return [
    '<p class="price">',
    `<span class="price-main">${prefix}${money(inc)}${suffix}</span>`,
    `<span class="price-note">incl. GST &middot; ${money(price.ex_gst)} + GST</span>`,
    shape ? `<span class="price-shape">${shape}</span>` : '',
    '</p>',
  ].join('');
}

const escapeHtml = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * The three pillars, each naming the two domains it owns.
 *
 * Why the domain names are rendered here rather than written into the pillar
 * copy: the mapping lives once, on each domain's `pillar` key. A pillar that
 * listed its areas as prose would be a second copy of that mapping, and the
 * two would drift the first time a domain was renamed — the exact failure that
 * put this generator here in the first place.
 */
function renderPillars(pillars, domains) {
  return pillars
    .map((p) => {
      const owned = domains.filter((d) => d.pillar === p.key);
      if (owned.length === 0) {
        throw new Error(`pillar "${p.key}" owns no domains — check domain.pillar keys`);
      }
      const areas = owned.map((d) => escapeHtml(d.name)).join(' &middot; ');
      return [
        '          <div class="pillar">',
        `            <span class="pillar-word">${escapeHtml(p.word)}</span>`,
        `            <span class="pillar-tagline">${escapeHtml(p.tagline)}</span>`,
        `            <p>${escapeHtml(p.body)}</p>`,
        `            <p class="pillar-areas"><span>We read</span> ${areas}</p>`,
        '          </div>',
      ].join('\n');
    })
    .join('\n');
}

/** Every page carrying shared chrome. Adding a page means adding it here AND
 *  to content/pages.json — the generator throws on a page with no metadata,
 *  so a forgotten entry fails loudly instead of rendering an empty <title>. */
const CHROME_PAGES = [
  'index.html', 'agile.html', 'ai-transformation.html', 'ai-services.html',
  'ai-playbook.html', 'ai-proof.html', 'ai-readiness.html', 'services.html', 'diagnostic.html',
  'playbook.html', 'contact.html',
];

/**
 * Each region names the file(s) it lives in and the function that renders it.
 * Adding a practice means adding entries here — the marker names carry the
 * practice, so two practices can never silently render into one region.
 */
const REGIONS = [
  { name: 'page_head', files: CHROME_PAGES, render: (d, f) => renderHead(d, f) },
  { name: 'topbar',    files: CHROME_PAGES, render: () => partial('topbar.html') },
  { name: 'hero_logo', files: CHROME_PAGES, render: () => partial('hero_logo.html') },
  { name: 'footer',    files: CHROME_PAGES, render: () => partial('footer.html') },
  {
    name: 'agile_stage_cards',
    file: 'diagnostic.html',
    render: (data) => renderStageCards(data.practices.agile.stages, data._pricing),
  },
  {
    name: 'agile_playbook_stages',
    file: 'playbook.html',
    render: (data) => renderPlaybookStages(data.practices.agile.stages),
  },
  {
    name: 'ba_ethos',
    file: 'ai-transformation.html',
    render: (data) => renderEthos(data.practices.ai_transformation.ethos),
  },
  {
    name: 'hero_copy',
    file: 'index.html',
    render: (data) => renderHeroCopy(data.brand.hero),
  },
  {
    name: 'home_pillars',
    file: 'index.html',
    render: (data) => renderPillars(data.brand.pillars, data.practices.ai_transformation.domains),
  },
  {
    name: 'ba_domains',
    file: 'ai-transformation.html',
    render: (data) => renderDomains(
      data.practices.ai_transformation.domains,
      data.brand.pillars,
    ),
  },
  {
    name: 'ba_services',
    file: 'ai-services.html',
    render: (data) => renderServices(
      data.practices.ai_transformation.services,
      data._pricing,
      data.practices.ai_transformation.phases
    ),
  },
  {
    name: 'ba_playbook_phases',
    file: 'ai-playbook.html',
    render: (data) => renderPhases(data.practices.ai_transformation.phases),
  },
  {
    name: 'ba_proof',
    file: 'ai-proof.html',
    render: (data) => renderProof(data.practices.ai_transformation.proof),
  },
  {
    name: 'site_nav',
    file: 'nav.html',
    render: (data) => renderNav(data.nav),
  },
  {
    name: 'ba_readiness_intro',
    file: 'ai-readiness.html',
    render: (data) => renderBaReadinessIntro(
      data.practices.ai_transformation.readiness,
      data.brand.pillars,
      data.practices.ai_transformation.domains,
    ),
  },
  {
    // Reuses renderScorecardFields: it reads only dimensions[].key/.question
    // and has no idea which practice it is serving. One field renderer, two
    // practices, rather than a second copy that can drift.
    name: 'ba_readiness_fields',
    file: 'ai-readiness.html',
    render: (data) => renderScorecardFields(data.practices.ai_transformation.readiness),
  },
  {
    name: 'ba_readiness_data',
    file: 'ai-readiness.html',
    render: (data) => renderBaReadinessData(data.practices.ai_transformation.readiness),
  },
  {
    name: 'scorecard_fields',
    file: 'diagnostic.html',
    render: (data) => renderScorecardFields(data.practices.agile.diagnostic),
  },
  {
    name: 'scorecard_data',
    file: 'diagnostic.html',
    render: (data) => renderScorecardData(data.practices.agile, data._pricing),
  },
  {
    name: 'ba_proof_teaser',
    file: 'ai-transformation.html',
    render: (data) => renderProofTeaser(data.practices.ai_transformation.proof),
  },
];

/** The <head> is identical on every page except <title> and the description,
 *  so those two come from content/pages.json and the rest is fixed here. */
/** index.html -> 'index'. Matches the filenames build_og_images.py writes. */
const ogSlug = (file) => file.replace(/\.html$/, '');

/** Cloudflare Pages serves this site extensionless: /agile.html 308-redirects
 *  to /agile, and /index.html to /. A canonical or og:url naming a URL that
 *  redirects is self-defeating — it tells the crawler the real address is one
 *  it will immediately be bounced off. Measured against production, not
 *  assumed. */
const canonicalPath = (file) => (file === 'index.html' ? '' : file.replace(/\.html$/, ''));

function renderHead(data, file) {
  const meta = data.pages[file];
  if (!meta) throw new Error(`no metadata in ${PAGES} for '${file}'`);
  if (!meta.title || !meta.description) throw new Error(`${PAGES}: '${file}' needs both title and description`);

  return [
    '  <meta charset="utf-8" />',
    '  <meta name="viewport" content="width=device-width,initial-scale=1" />',
    `  <meta name="description" content="${escapeHtml(meta.description)}" />`,
    '  <meta name="theme-color" content="#000000" />',
    '',
    '  <!-- Favicons -->',
    '  <link rel="apple-touch-icon" sizes="180x180" href="assets/apple-touch-icon.png">',
    '  <link rel="icon" type="image/png" sizes="32x32" href="assets/favicon-32x32.png">',
    '  <link rel="icon" type="image/png" sizes="16x16" href="assets/favicon-16x16.png">',
    '  <link rel="manifest" href="assets/site.webmanifest">',
    '',
    `  <title>${escapeHtml(meta.title)}</title>`,
    `  <link rel="canonical" href="${SITE}/${canonicalPath(file)}" />`,
    '',
    '  <!-- Open Graph / Twitter. Cards are 1200x630 PNGs generated from this',
    '       same metadata by tools/build_og_images.py, so a share card can never',
    '       advertise a different title from the page it links to. -->',
    '  <meta property="og:type" content="website" />',
    '  <meta property="og:site_name" content="Vestibular" />',
    `  <meta property="og:url" content="${SITE}/${canonicalPath(file)}" />`,
    `  <meta property="og:title" content="${escapeHtml(meta.title)}" />`,
    `  <meta property="og:description" content="${escapeHtml(meta.description)}" />`,
    `  <meta property="og:image" content="${SITE}/assets/og/${ogSlug(file)}.png" />`,
    '  <meta property="og:image:width" content="1200" />',
    '  <meta property="og:image:height" content="630" />',
    `  <meta property="og:image:alt" content="${escapeHtml(meta.title)}" />`,
    '  <meta name="twitter:card" content="summary_large_image" />',
    `  <meta name="twitter:title" content="${escapeHtml(meta.title)}" />`,
    `  <meta name="twitter:description" content="${escapeHtml(meta.description)}" />`,
    `  <meta name="twitter:image" content="${SITE}/assets/og/${ogSlug(file)}.png" />`,
    '',
    '  <link rel="preconnect" href="https://fonts.googleapis.com">',
    '  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
    '  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;600;700&family=Source+Sans+3:wght@400;600;700&display=swap" rel="stylesheet">',
    '  <link rel="stylesheet" href="styles/styles.css" />',
  ].join('\n');
}

/**
 * The index hero: three stacked lines, a stacked intro, then the lede.
 *
 * These words used to be hand-written in index.html and appeared nowhere in
 * content/. That was survivable while only the page said them — but the root
 * share card speaks the same words, and a card is rendered by a different tool
 * in a different language, so quoting them meant a second copy that nothing
 * held together. build_og_images.py now derives the root card from these same
 * values, which is only safe because this is the one place they live.
 *
 * ⚠️ The <br /> placement is load-bearing: the triplet reads as three lines,
 * and the CSS gives no block spacing between the spans. A line rendered without
 * its break collapses the stack into a run-on sentence.
 */
function renderHeroCopy(hero) {
  const stacked = (lines) =>
    lines.map((line) => `      <span>${escapeHtml(line)}</span>`).join('<br />\n');

  if (!hero.headline.length || !hero.intro.length) {
    throw new Error('brand.hero needs a non-empty headline and intro');
  }

  return [
    '    <h1>',
    stacked(hero.headline),
    '    </h1>',
    '',
    '    <p class="highlighted-intro">',
    stacked(hero.intro),
    '    </p>',
    '    <p>',
    `      <span>${escapeHtml(hero.lede)}</span>`,
    '    </p>',
  ].join('\n');
}

function renderStageCards(stages, pricing) {
  return stages
    .map((s) => {
      const rows = [
        ['Diagnostic lens', s.diagnostic_lens],
        ['Focus', s.focus],
        ['Outcomes', s.outcomes],
        ['Deliverables', s.deliverables],
        ['Package', `${s.package}.`],
        ['AI augmentation', s.ai_augmentation],
      ]
        .map(([label, value]) => `        <li><strong>${label}:</strong> ${escapeHtml(value)}</li>`)
        .join('\n');

      return [
        `    <article class="stage stage-${s.number}">`,
        `      <h3>Stage ${s.number}: ${escapeHtml(s.name)}</h3>`,
        '      <ul>',
        rows,
        '      </ul>',
        `      ${renderPrice(s.price, pricing)}`,
        '    </article>',
      ].join('\n');
    })
    .join('\n\n');
}

function renderPlaybookStages(stages) {
  return stages
    .map((s) => {
      const rows = [
        ['Focus', s.focus],
        ['Outcomes', s.outcomes],
        ['Deliverables', s.deliverables],
        ['AI Augmentation', s.ai_augmentation],
      ]
        // The playbook renders these as a scannable list, without the trailing
        // full stops the diagnostic cards use.
        .map(([label, value]) => `            <li>${label}: ${escapeHtml(String(value).replace(/\.$/, ''))}</li>`)
        .join('\n');

      return [
        '        <li>',
        `          <h4>Stage ${s.number} — ${escapeHtml(s.name)} (${escapeHtml(s.package)} Package)</h4>`,
        '          <ul>',
        rows,
        '          </ul>',
        '        </li>',
      ].join('\n');
    })
    .join('\n\n');
}

function renderEthos(ethos) {
  const principles = ethos.principles
    .map((p) => `        <li>${escapeHtml(p)}</li>`)
    .join('\n');
  return [
    `      <p class="section-label">Our ethos</p>`,
    `      <h2 class="section-title">${escapeHtml(ethos.name)}.</h2>`,
    `      <p class="section-intro">${escapeHtml(ethos.statement)}</p>`,
    '      <ul>',
    principles,
    '      </ul>',
  ].join('\n');
}

function renderDomains(domains, pillars) {
  return pillars
    .map((p) => {
      const owned = domains.filter((d) => d.pillar === p.key);
      const cards = owned
        .map((d) => {
          const points = d.points
            .map((pt) => `            <li>${escapeHtml(pt)}</li>`)
            .join('\n');
          return [
            '        <article>',
            '          <div>',
            `          <h3>${escapeHtml(d.name)}</h3>`,
            `          <p class="domain-purpose">${escapeHtml(d.purpose)}</p>`,
            '          <ul>',
            points,
            '          </ul>',
            '          </div>',
            '        </article>',
          ].join('\n');
        })
        .join('\n\n');
      return [
        '      <div class="domain-group">',
        `        <p class="domain-group-pillar">${escapeHtml(p.word)}</p>`,
        `        <p class="domain-group-tagline">${escapeHtml(p.tagline)}</p>`,
        cards,
        '      </div>',
      ].join('\n');
    })
    .join('\n\n');
}

/** Services render with the same article/deliverable shape the Agile services
 *  page uses, so the two practices are visually siblings rather than strangers. */
/**
 * Services grouped under the engagement phase they belong to.
 *
 * The order was already Listen -> Design -> Land, but nothing on the page said
 * so, and the prices do not ascend monotonically (8,250 / 19,250 / 49,500 /
 * 33,000 / scoped / 22,000), so it read as arbitrary. The heading is the whole
 * fix: it makes the existing reason visible rather than reordering the work.
 *
 * Fails loudly on a service with no phase, or a phase not defined in phases[],
 * so a service added later cannot silently fall out of every group.
 */
function renderServices(services, pricing, phases) {
  const order = phases.map((p) => p.name);
  const blurbs = new Map(phases.map((p) => [p.name, p.blurb]));

  for (const s of services) {
    if (!s.phase) throw new Error(`service '${s.name}' has no phase`);
    if (!order.includes(s.phase)) {
      throw new Error(
        `service '${s.name}' names phase '${s.phase}', which is not one of: ${order.join(', ')}`
      );
    }
  }

  const card = (s) => {
    const bullets = s.bullets.map((b) => `          <li>${escapeHtml(b)}</li>`).join('\n');
    return [
      '      <article>',
      '        <div>',
      `        <h3>${escapeHtml(s.name)}</h3>`,
      `        ${renderPrice(s.price, pricing)}`,
      '        <ul>',
      bullets,
      `          <li><strong>Deliverable:</strong> ${escapeHtml(s.deliverable)}</li>`,
      '        </ul>',
      '        </div>',
      '      </article>',
    ].join('\n');
  };

  // Within a phase, cheapest first, so the smaller price is always the
  // left-hand card of a row. Sorted at render time rather than by hand-ordering
  // the source, so a service added later cannot land out of order.
  //
  // 'scoped' sorts LAST because it is the top of the range, not merely because
  // it has no figure to sort on. A scoped engagement is open-ended, so it is
  // always the potentially higher-value item in its phase — it belongs at the
  // expensive end of the row whatever the priced cards beside it cost. Infinity
  // is the mechanism; this is the reason.
  //
  // Sequence is still carried by the phase grouping; only the order WITHIN a
  // phase is by price.
  const amount = (s) =>
    s.price && typeof s.price.ex_gst === 'number' ? s.price.ex_gst : Infinity;

  return order
    .map((phase) => {
      const inPhase = services
        .filter((s) => s.phase === phase)
        .sort((a, b) => amount(a) - amount(b));
      if (!inPhase.length) return null;
      return [
        '      <div class="phase-heading">',
        `        <h3>${escapeHtml(phase)}</h3>`,
        `        <p>${escapeHtml(blurbs.get(phase) || '')}</p>`,
        '      </div>',
        '',
        inPhase.map(card).join('\n\n'),
      ].join('\n');
    })
    .filter(Boolean)
    .join('\n\n');
}

function renderPhases(phases) {
  return phases
    .map((ph) => {
      const steps = ph.steps
        .map((st) =>
          [
            '          <li>',
            `            <h4>${st.number}. ${escapeHtml(st.name)}</h4>`,
            `            <p>${escapeHtml(st.detail)}</p>`,
            '          </li>',
          ].join('\n')
        )
        .join('\n');
      return [
        '      <section class="ba-phase">',
        `        <h3>${escapeHtml(ph.name)}</h3>`,
        `        <p class="phase-blurb">${escapeHtml(ph.blurb)}</p>`,
        '        <ol>',
        steps,
        '        </ol>',
        '      </section>',
      ].join('\n');
    })
    .join('\n\n');
}

/** The case study. Rendered from the SSOT like everything else, so the claims
 *  made about the platform live in one place and cannot drift between the
 *  teaser on the hub and the full page. */
function renderProof(proof) {
  const para = (t) => `      <p class="proof-para">${escapeHtml(t)}</p>`;
  const card = (item, i) => [
    '      <article>',
    '        <div>',
    `        <h3><span class="proof-num">${String(i + 1).padStart(2, '0')}</span> ${escapeHtml(item.name)}</h3>`,
    `        <p>${escapeHtml(item.detail)}</p>`,
    '        </div>',
    '      </article>',
  ].join('\n');

  return [
    '      <p class="section-label">Proof</p>',
    `      <h2 class="section-title">${escapeHtml(proof.headline)}</h2>`,
    `      <p class="section-intro">${escapeHtml(proof.summary)}</p>`,
    '',
    ...proof.context.map(para),
    '',
    '      <h3 class="proof-heading">What we held to</h3>',
    proof.principles.map(card).join('\n\n'),
    '',
    '      <h3 class="proof-heading">What it taught us</h3>',
    proof.lessons.map(card).join('\n\n'),
    '',
    `      <p class="proof-bridge">${escapeHtml(proof.bridge)}</p>`,
  ].join('\n');
}

/** Short version for the hub. Same source, so it cannot contradict the page. */
function renderProofTeaser(proof) {
  return [
    '      <p class="section-label">Proof</p>',
    `      <h2 class="section-title">${escapeHtml(proof.headline)}</h2>`,
    `      <p class="section-intro">${escapeHtml(proof.summary)}</p>`,
    '      <ul>',
    proof.principles
      .slice(0, 3)
      .map((p) => `        <li><strong>${escapeHtml(p.name)}</strong></li>`)
      .join('\n'),
    '      </ul>',
    '      <p class="proof-bridge"><a href="ai-proof.html">Read the full case study &rarr;</a></p>',
  ].join('\n');
}

/** The form fields. Generated so a question cannot exist without a unique key
 *  — two questions previously shared name="alignment", which silently collapsed
 *  the sixth dimension and made any keyed read of the answers wrong. */
/**
 * The top-level nav, rendered from pages.json.
 *
 * Every page with chrome must be reachable from here — see the coverage check
 * in main(). Adding a page to the site while forgetting the nav was a manual
 * checklist step, and it had already been missed twice.
 */
function renderNav(nav) {
  const link = (item, cls) =>
    `<a href="${escapeHtml(item.href)}"${cls ? ` class="${cls}"` : ''}>${escapeHtml(item.label)}</a>`;

  const items = nav.map((item) => {
    if (!item.children || !item.children.length) {
      return `    <li>${link(item)}</li>`;
    }
    const children = item.children
      .map((c) => `        <li>${link(c)}</li>`)
      .join('\n');
    // No JS: the submenu opens on hover and on :focus-within, so it is
    // keyboard reachable, and on the mobile slide-in panel it is always shown.
    return [
      '    <li class="has-submenu">',
      `      ${link(item)}`,
      `      <ul class="submenu" aria-label="${escapeHtml(item.label)}">`,
      children,
      '      </ul>',
      '    </li>',
    ].join('\n');
  }).join('\n');

  return [
    '<nav class="main-nav" role="navigation">',
    '  <ul>',
    items,
    '    <li><a href="contact.html" class="btn cta">Book a Consult</a></li>',
    '  </ul>',
    '</nav>',
  ].join('\n');
}

function renderBaReadinessIntro(readiness, pillars, domains) {
  // The intro promised "you can read it yourself" while never naming the six
  // areas — they existed only in the page's meta description, visible to
  // crawlers and not to readers. Naming them here, grouped by the pillar that
  // owns them, makes the promise self-evidencing and ties the readiness page
  // back to the pillars on the home page.
  const groups = pillars
    .map((p) => {
      const areas = domains
        .filter((d) => d.pillar === p.key)
        .map((d) => escapeHtml(d.name))
        .join(' &middot; ');
      return [
        '      <li>',
        `        <span class="ba-area-pillar">${escapeHtml(p.word)}</span>`,
        `        <span class="ba-area-names">${areas}</span>`,
        '      </li>',
      ].join('\n');
    })
    .join('\n');
  return [
    `  <p class="ba-readiness-intro">${escapeHtml(readiness.intro)}</p>`,
    '  <ul class="ba-area-map">',
    groups,
    '  </ul>',
  ].join('\n');
}

/** No stages, no thresholds — see content/practices.json for why. */
function renderBaReadinessData(readiness) {
  // The question keys MUST travel with each dimension: they are the input
  // names the client reads and averages. Emitting key+label only left the
  // client looking for an input named after the axis, which does not exist
  // once an axis is asked as two questions.
  //
  // ⛔ AND SO MUST `vantage` AND `text`. Emitting keys alone shipped a page
  // where vantage_progress found no vantages, returned an EMPTY series, and
  // the whole instrument read as unanswered while the form still accepted a
  // submission. Every gate was green: the tests drove hand-written fixtures
  // that carried vantages, so nothing compared what the CLIENT actually
  // receives against what it needs. `text` is here because the result quotes
  // the two sentences back, and a quote with no source renders as empty
  // quotation marks.
  const payload = {
    dimensions: readiness.dimensions.map((d) => ({
      key: d.key,
      label: d.label,
      questions: (d.questions || [{ key: d.key }]).map((q) => {
        const out = { key: q.key };
        if (q.vantage) out.vantage = q.vantage;
        if (q.text) out.text = q.text;
        // The client excludes an opportunity-keyed item from the lowest-seen
        // reading. Without this the flag exists in the SSOT and never reaches
        // the code that consults it — the same silent shape as the vantages.
        if (q.polarity) out.polarity = q.polarity;
        // ⛔ Without this the client scores a reverse-worded item as written and
        // draws that axis BACKWARDS — silently, and plausibly.
        if (q.reverse) out.reverse = true;
        return out;
      }),
    })),
  };
  return [
    '<script id="ba-readiness-data" type="application/json">',
    JSON.stringify(payload, null, 2),
    '</' + 'script>',
  ].join('\n');
}

/**
 * One <label> per QUESTION, not per dimension. An axis may be asked once
 * (`question`) or several times (`questions[]`); both shapes render here so the
 * Agile diagnostic and the AI readiness radar share one field renderer rather
 * than a second copy that can drift.
 */
/**
 * Headings for the two vantages, and the reason the fields are grouped by them
 * rather than by axis.
 *
 * ⛔ THE STATED AND LIVED ITEMS OF ONE AXIS MUST NOT SIT ADJACENT. The whole
 * reading is the divergence between them, and people do not like visibly
 * contradicting themselves two lines apart. Grouped by axis, this instrument
 * would measure how consistent respondents like to appear. Separated, each
 * block is answered in its own frame.
 */
const VANTAGE_BLOCKS = [
  {
    vantage: 'stated',
    heading: 'What you understand the organisation to claim about itself',
  },
  {
    vantage: 'lived',
    heading: 'What you have seen from where you sit',
  },
];

/**
 * One question row.
 *
 * ⛔ AN ITEM CARRYING AN ESCAPE MUST NOT BE `required`. Three lived items
 * presuppose an event that may never have occurred — a priority collision, a
 * disagreement with someone senior, being near your limit. Requiring a 1–5 on
 * those forces a person to state a value for something that never happened,
 * which is fabrication, and the browser would block submission for exactly the
 * respondents whose absence is itself informative.
 *
 * ⛔ AND THE ESCAPE PLOTS ABSENT, NOT HIGH. Never having disagreed with someone
 * senior is not evidence of psychological safety; it is as likely to be
 * evidence against it. The same holds for load: that item measures whether
 * saying so CHANGED anything, so a person never near their limit has not
 * tested it and has no reading to give. Scoring an escape at the top would
 * import one construct's information into another's item.
 */
function renderScorecardLabel(q) {
  const required = q.escape ? '' : ' required';
  const row = [
    '  <label>',
    `    <input type="number" name="${escapeHtml(q.key)}" min="1" max="5"${required}>`,
    `    <span class="label-text">${escapeHtml(q.text)} (1&ndash;5)</span>`,
    '  </label>',
  ];
  if (!q.escape) return row.join('\n');

  return row.concat([
    '  <label class="escape">',
    `    <input type="checkbox" name="${escapeHtml(q.key)}_absent">`,
    `    <span class="escape-text">${escapeHtml(q.escape)}</span>`,
    '  </label>',
  ]).join('\n');
}

function renderScorecardFields(diag) {
  const questions = diag.dimensions.flatMap((d) =>
    Array.isArray(d.questions) && d.questions.length
      ? d.questions
      : [{ key: d.key, text: d.question }]
  );

  // Additive by design: `vantage` defaults absent, so the Agile scorecard —
  // which shares this renderer — takes the ungrouped path and its output stays
  // byte-identical. A check pins that.
  if (!questions.some((q) => q.vantage)) {
    return questions.map(renderScorecardLabel).join('\n');
  }

  const missing = questions.filter((q) => !q.vantage);
  if (missing.length) {
    throw new Error(
      `some questions carry a vantage and some do not (${missing.map((q) => q.key).join(', ')}) — ` +
        'a half-grouped form would put an axis\'s two vantages back beside each other'
    );
  }

  return VANTAGE_BLOCKS.map((block) => {
    const inBlock = questions.filter((q) => q.vantage === block.vantage);
    if (!inBlock.length) throw new Error(`no questions carry vantage '${block.vantage}'`);
    return [
      `  <p class="vantage-heading">${escapeHtml(block.heading)}</p>`,
      ...inBlock.map(renderScorecardLabel),
    ].join('\n');
  }).join('\n');
}

/** Scoring data for scripts/scorecard.js. Emitted rather than duplicated in the
 *  script so the labels, thresholds, stage names AND PRICES the result quotes
 *  are the same ones rendered on the cards above it. A result that recommends a
 *  package at a price the page contradicts is worse than no recommendation. */
function renderScorecardData(agile, pricing) {
  const money = (n) => '$' + Math.round(n).toLocaleString('en-AU');
  const stages = agile.stages.map((s) => {
    const p = s.price || {};
    const priced = p.basis && p.basis !== 'scoped' && p.ex_gst;
    return {
      stage: s.name,
      package: s.package,
      focus: s.focus,
      price: priced
        ? `${p.basis === 'from' ? 'From ' : ''}${money(p.ex_gst * (1 + pricing.gst_rate))}${p.basis === 'retainer' ? ' per month' : ''}`
        : 'Scoped per engagement',
      duration: p.duration || null,
    };
  });

  const payload = {
    dimensions: agile.diagnostic.dimensions.map((d) => ({ key: d.key, label: d.label })),
    thresholds: agile.diagnostic.thresholds,
    stages,
  };

  return [
    '<script id="scorecard-data" type="application/json">',
    JSON.stringify(payload, null, 2),
    '</' + 'script>',
  ].join('\n');
}

function markers(name) {
  return {
    start: `<!-- GENERATED:${name} START · source ${SOURCE} · regen: node tools/render_content.mjs · DO NOT EDIT BELOW -->`,
    end: `<!-- GENERATED:${name} END -->`,
  };
}

/** Replace the body between a region's markers. Throws if the markers are absent
 *  or out of order, so a renamed or half-deleted marker fails loudly rather than
 *  silently rendering nothing. */
function spliceRegion(source, name, body) {
  const { start, end } = markers(name);
  const startAt = source.indexOf(start);
  const endAt = source.indexOf(end);

  if (startAt === -1) throw new Error(`region '${name}': START marker not found`);
  if (endAt === -1) throw new Error(`region '${name}': END marker not found`);
  if (endAt < startAt) throw new Error(`region '${name}': END marker precedes START`);

  return source.slice(0, startAt + start.length) + '\n' + body + '\n' + source.slice(endAt);
}

function main() {
  const check = process.argv.includes('--check');
  const data = JSON.parse(readFileSync(resolve(ROOT, SOURCE), 'utf8'));
  const pagesFile = JSON.parse(readFileSync(resolve(ROOT, PAGES), 'utf8'));
  data.pages = pagesFile.pages;
  data.nav = pagesFile.nav;

  // Coverage guard: a page can be created, registered and shipped while never
  // being linked from the nav. That happened to ai-proof and ai-readiness.
  const reachable = new Set();
  for (const item of data.nav || []) {
    reachable.add(item.href);
    for (const child of item.children || []) reachable.add(child.href);
  }
  const unreachable = CHROME_PAGES.filter((p) => !reachable.has(p) && p !== 'contact.html');
  if (unreachable.length) {
    throw new Error(
      `page(s) not reachable from the nav: ${unreachable.join(', ')}. ` +
      'Add them to "nav" in content/pages.json.'
    );
  }

  // A region may target one file or many; flatten to one entry per file.
  const flat = REGIONS.flatMap((r) =>
    (r.files ?? [r.file]).map((file) => ({ name: r.name, file, render: r.render }))
  );

  // Group by file so a file with two regions is read and written once.
  const byFile = new Map();
  for (const region of flat) {
    if (!byFile.has(region.file)) byFile.set(region.file, []);
    byFile.get(region.file).push(region);
  }

  const drifted = [];
  let written = 0;

  for (const [file, regions] of byFile) {
    const path = resolve(ROOT, file);
    const before = readFileSync(path, 'utf8');
    let after = before;

    for (const region of regions) {
      after = spliceRegion(after, region.name, region.render(data, file));
    }

    if (after === before) {
      console.log(`  in sync         ${file}  (${regions.map((r) => r.name).join(', ')})`);
      continue;
    }
    if (check) {
      drifted.push(file);
      console.error(`  DRIFTED         ${file}  (${regions.map((r) => r.name).join(', ')})`);
      continue;
    }
    writeFileSync(path, after);
    written++;
    console.log(`  wrote           ${file}  (${regions.map((r) => r.name).join(', ')})`);
  }

  // Name what matched, not only what failed — otherwise a run that never
  // executed is indistinguishable from a clean one.
  console.log(
    `\n${check ? 'checked' : 'rendered'} ${flat.length} region instance(s) across ${byFile.size} file(s)` +
      (check ? '' : `, ${written} file(s) changed`)
  );

  if (check && drifted.length) {
    console.error(
      `\nFAIL: ${drifted.length} file(s) do not match ${SOURCE}.\n` +
        'A GENERATED region was hand-edited, or the source changed without regenerating.\n' +
        'Fix with: node tools/render_content.mjs'
    );
    process.exit(1);
  }
}

try {
  main();
} catch (err) {
  // Structural problems, not crashes. Route the advice to the ACTUAL fault —
  // a blanket message sends you to the wrong file, and this handler has now
  // been wrong twice by defaulting instead of matching.
  const ADVICE = [
    [/marker/i,
     'A GENERATED region marker is missing, renamed, or out of order.\n' +
     'Restore the START/END comment pair around the generated block, then re-run.'],
    [/^price:/i,
     `Fix the price entry in ${SOURCE}: on-site days cannot exceed the billed\n` +
     'consulting days for the same engagement.'],
    [/metadata|title and description/i,
     `Check ${PAGES} has an entry with a title and description for every page in CHROME_PAGES.`],
  ];
  console.error(`\nFAIL: ${err.message}`);
  const hit = ADVICE.find(([re]) => re.test(err.message));
  console.error(hit ? hit[1] : 'Unrecognised failure — read the message above and fix at the source.');
  process.exit(1);
}
