/**
 * Checks that nothing interactive is made unclickable by an ancestor.
 *
 * ⛔ THE BUG THIS EXISTS FOR RAN ON PRODUCTION, ON EVERY PAGE, AT EVERY MOBILE
 * WIDTH, AND EVERY GATE WAS GREEN. `f316ef9` made the overhanging logo
 * transparent to pointer events so it stopped swallowing clicks on the page
 * beneath — a real fix for a measured problem — and re-enabled hit-testing on
 * `.brand-hit` alone:
 *
 *     .brand, .brand a, .brand-logo { pointer-events: none; }
 *     .brand-hit { pointer-events: auto; }
 *
 * The mobile menu button is a SIBLING of that link INSIDE `.brand`.
 * `pointer-events` inherits, so the burger became dead to touch while staying
 * visible, focusable and keyboard-operable — which is why it looked fine in
 * every check and in casual desktop use. Measured 3 Sep with a real browser at
 * 390x844: `elementFromPoint` at the button's centre returned `.hero-content`,
 * because hit-testing skips `pointer-events: none` elements entirely, so the
 * symptom pointed at an innocent element two layers away.
 *
 * ⚠️ WHAT THIS CHECK IS AND IS NOT. It is a static structural check over the
 * generated markup and the stylesheet: it finds interactive elements nested
 * inside a container the CSS disables, and requires each to re-enable itself.
 * It cannot see stacking order, overlap, or an element covered by something
 * else — the ONLY instrument that sees those is a real browser at a real
 * viewport. A headless click-through in CI is the honest guard for that class
 * and is deliberately not added here, because it is a cost decision rather than
 * a mechanical one. This check covers exactly one failure mode: inheritance.
 *
 * Run: node tools/test_hit_targets.cjs
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
/**
 * ⛔ COMMENTS ARE STRIPPED BEFORE ANY PARSING, AND BOTH REASONS BIT.
 *
 * A selector is read as the text back to the previous `}`, so a comment sitting
 * above a rule is captured as part of its selector list and `.brand` never
 * matches `.brand`. The first version of this file therefore failed on a
 * correct tree — and every mutation driven against it "died" by that same
 * already-red assertion, which is a matrix on a red baseline killing nothing.
 *
 * The second reason is the inverse: this file's own explanatory comment inside
 * `.nav-toggle` contains the literal text `pointer-events: none`, which would
 * register the toggle as DISABLED by a rule that enables it.
 */
const css = read('styles/styles.css').replace(/\/\*[\s\S]*?\*\//g, '');

let passed = 0;
const failures = [];
function check(name, fn) {
  try { fn(); passed++; console.log('  ok   ' + name); }
  catch (err) { failures.push({ name, message: err.message }); console.log('  FAIL ' + name); }
}

/** Selectors the stylesheet makes transparent to pointer events. */
function disabled_selectors() {
  const out = [];
  // Rule bodies containing `pointer-events: none`, with their selector list.
  const re = /([^{}]+)\{([^{}]*pointer-events\s*:\s*none[^{}]*)\}/g;
  let m;
  while ((m = re.exec(css)) !== null) {
    m[1].split(',').map((s) => s.trim()).filter(Boolean).forEach((sel) => out.push(sel));
  }
  return out;
}

/** Selectors the stylesheet re-enables. */
function enabled_selectors() {
  const out = [];
  const re = /([^{}]+)\{([^{}]*pointer-events\s*:\s*auto[^{}]*)\}/g;
  let m;
  while ((m = re.exec(css)) !== null) {
    m[1].split(',').map((s) => s.trim()).filter(Boolean).forEach((sel) => out.push(sel));
  }
  return out;
}

check('the stylesheet disables pointer events somewhere, so this check has work to do', () => {
  // ⛔ A check that finds nothing is indistinguishable from a check that cannot
  // find anything. If the brand fix is ever removed, this goes red rather than
  // silently passing over an empty set.
  assert.ok(disabled_selectors().length > 0,
    'no pointer-events: none rule found — either the brand fix was removed, or the parser broke');
});

/**
 * The concrete case, pinned by identity rather than by inference: the topbar
 * markup nests the menu button inside the disabled container.
 */
check('the menu button is still inside .brand, as the markup has it', () => {
  const html = read('index.html');
  const brand = html.match(/<div class="brand">([\s\S]*?)<\/div>/);
  assert.ok(brand, '.brand block not found in the generated topbar');
  assert.ok(/class="nav-toggle"/.test(brand[1]),
    'the toggle has moved out of .brand — good, and this check plus the ' +
    'pointer-events: auto on .nav-toggle are now both redundant. Remove them together.');
});

check('.brand is pointer-events: none, so its children inherit it', () => {
  assert.ok(disabled_selectors().includes('.brand'),
    '.brand no longer disables pointer events — re-read the brand fix before trusting this file');
});

check('⛔ the menu button re-enables its own pointer events', () => {
  assert.ok(enabled_selectors().includes('.nav-toggle'),
    'the mobile menu button inherits pointer-events: none from .brand and is dead to touch ' +
    'on every page, while remaining visible and keyboard-operable');
});

check('.brand-hit still re-enables the logo link', () => {
  assert.ok(enabled_selectors().includes('.brand-hit'),
    'the logo would stop being clickable');
});

/**
 * ⭐ THE GENERAL FORM, so the next element nested there is caught without
 * anyone remembering this file exists.
 */
check('every interactive element inside .brand re-enables itself', () => {
  const html = read('index.html');
  const brand = html.match(/<div class="brand">([\s\S]*?)<\/div>\s*<\/div>/) ||
                html.match(/<div class="brand">([\s\S]*?)<\/div>/);
  assert.ok(brand, '.brand block not found');
  const enabled = enabled_selectors();

  const interactive = [...brand[1].matchAll(/<(button|a|input|select|textarea)\b([^>]*)>/g)];
  assert.ok(interactive.length > 0, 'no interactive elements found in .brand — parser check');

  interactive.forEach(([, tag, attrs]) => {
    const classes = (attrs.match(/class="([^"]*)"/) || [, ''])[1].split(/\s+/).filter(Boolean);
    // An <a> is covered by the .brand a rule and re-enabled via .brand-hit,
    // which is the documented arrangement. Everything else must name itself.
    if (tag === 'a' && classes.length === 0) return;
    const covered = classes.some((c) => enabled.includes('.' + c));
    assert.ok(covered,
      `<${tag}${classes.length ? ' class="' + classes.join(' ') + '"' : ''}> sits inside .brand ` +
      'and no rule re-enables its pointer events — it will be visible and dead to touch');
  });
});

if (failures.length) {
  console.error(`\n${failures.length} hit-target check(s) FAILED:\n`);
  failures.forEach((f) => console.error(`  ${f.name}\n    ${f.message}\n`));
  process.exit(1);
}
console.log('\n' + passed + ' hit-target checks passed');
