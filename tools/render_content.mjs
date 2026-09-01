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

const escapeHtml = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Each region names the file it lives in and the function that renders it.
 * Adding a practice means adding entries here — the marker names carry the
 * practice, so two practices can never silently render into one region.
 */
const REGIONS = [
  {
    name: 'agile_stage_cards',
    file: 'diagnostic.html',
    render: (data) => renderStageCards(data.practices.agile.stages),
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
    name: 'ba_domains',
    file: 'ai-transformation.html',
    render: (data) => renderDomains(data.practices.ai_transformation.domains),
  },
  {
    name: 'ba_services',
    file: 'ai-services.html',
    render: (data) => renderServices(data.practices.ai_transformation.services),
  },
  {
    name: 'ba_playbook_phases',
    file: 'ai-playbook.html',
    render: (data) => renderPhases(data.practices.ai_transformation.phases),
  },
];

function renderStageCards(stages) {
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

function renderDomains(domains) {
  return domains
    .map((d) => {
      const points = d.points
        .map((p) => `          <li>${escapeHtml(p)}</li>`)
        .join('\n');
      return [
        '      <article>',
        '        <div>',
        `        <h3>${escapeHtml(d.name)}</h3>`,
        `        <p class="domain-purpose">${escapeHtml(d.purpose)}</p>`,
        '        <ul>',
        points,
        '        </ul>',
        '        </div>',
        '      </article>',
      ].join('\n');
    })
    .join('\n\n');
}

/** Services render with the same article/deliverable shape the Agile services
 *  page uses, so the two practices are visually siblings rather than strangers. */
function renderServices(services) {
  return services
    .map((s) => {
      const bullets = s.bullets
        .map((b) => `          <li>${escapeHtml(b)}</li>`)
        .join('\n');
      return [
        '      <article>',
        '        <div>',
        `        <h3>${escapeHtml(s.name)}</h3>`,
        '        <ul>',
        bullets,
        `          <li><strong>Deliverable:</strong> ${escapeHtml(s.deliverable)}</li>`,
        '        </ul>',
        '        </div>',
        '      </article>',
      ].join('\n');
    })
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

  // Group by file so a file with two regions is read and written once.
  const byFile = new Map();
  for (const region of REGIONS) {
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
      after = spliceRegion(after, region.name, region.render(data));
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
    `\n${check ? 'checked' : 'rendered'} ${REGIONS.length} region(s) across ${byFile.size} file(s)` +
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
  // A missing or reordered marker is a structural problem in the HTML, not a
  // crash. Say what to do about it rather than printing a stack trace.
  console.error(`\nFAIL: ${err.message}`);
  console.error(
    'A GENERATED region marker is missing, renamed, or out of order.\n' +
      'Restore the START/END comment pair around the generated block, then re-run.'
  );
  process.exit(1);
}
