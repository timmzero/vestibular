# Positioning, pricing and competitive notes

Written 2 Sep 2026. Everything here was measured or sourced, not assumed.
It exists because these decisions were made in conversation and would
otherwise have to be rediscovered — probably arriving somewhere different.

## The two practices

| | Agile Transformation | AI Transformation (BA) |
|---|---|---|
| shape | maturity model — "where are you now" | engagement sequence — "what happens when we work together" |
| vocabulary | Declutter / Reboot / Enable / Scale / Optimize | Listen / Design / Land |
| team health | the **outcome** — a healthier team is the goal | a measured **input** to the operating-model redesign |

The different shapes are deliberate. Reusing the maturity vocabulary on the BA
side would make the practices indistinguishable at a glance.

Both practices offer Team Health Reports. The site says explicitly on each side
which job it does there, because without that the overlap reads as padding.

## Competitive picture

**Zen Ex Machina** (zenexmachina.com) is the closest structural competitor.
Australian, founded 2011. They publish "Maturity Stages 1-5" and their
assessment is **Agile IQ®** — trademarked, 32 metrics, behavioural and
non-linear, designed by Scrum.org PSTs, benchmarked against companies of a
similar age, backed by longitudinal multiple-linear regression over 500+ teams.

**A five-stage maturity model plus a scorecard is table stakes in this market,
not a differentiator.** An Australian firm got there first and productised it.

**How the market prices** — ZXM publishes tiered pricing for the *product*
(free forever / $150 per month / $1,200 per month / contact us) while human
coaching stays "rates/hour tbc upon request". Elabor8 and the larger firms
quote on request. Nobody publishes a consulting day rate.

Others worth watching: **Elabor8** (large AU agile consultancy, case-study led),
**Pelsi** (NSW boutique, nearest in scale), **Blue-Sky Thinking Ventures**
(closest AI positioning, pairs it with OKR consulting).

## Where Vestibular differentiates

Two independent 2026 sources converge on the same buyer vetting question:
*"show me production AI features you shipped in the last six months"*, with the
stated red flag being firms that lead with roadmaps and frameworks instead of
shipped work.

Vestibular can answer it. VTRAFFIC is a production AI system in a regulated
domain. Almost no competitor can say the same, and the AI Transformation
practice was pure methodology until `ai-proof.html` was added — precisely the
profile those sources warn buyers about.

**The differentiator is restraint, not capability.** An executive buying AI
transformation is not afraid the model will underperform. They are afraid it
will be confidently wrong in front of a regulator. Leading with what was
refused speaks to that; a capability list does not.

## Pricing logic

Priced off a consistent internal day rate, not plucked from published bands:

- **Agile $2,000/day · AI Transformation $2,500/day**
- AI prices higher because AI consulting rates held while generalist management
  consulting softened ~12% year on year
- Both sit just under the AU "specialised independent consultant" band
  ($300-700/hr, ≈$2,400-5,600/day) — conservative, appropriate for a practice
  with no published case studies yet

**Do not publish the day rate.** Nobody in this market does, and it converts an
outcome seller into a contractor rate-compared against ~$1,200/day SEEK ads.
Publishing "18 consulting days" for a fixed fee is fine; publishing "$2,500/day"
invites nothing else. The day rate is the logic that makes each number
defensible when challenged, and it belongs in this file, not on the site.

The ladder is deliberately mixed — firm price at entry, "from" in the middle,
**scoped** at the top — so publishing does not anchor the ceiling.

A fee with no stated time is unbuyable and is the gap scope disputes grow in.
Attaching effort is what revealed the first pricing pass implied day rates
*below* the contractor rate.

### GST

**Vestibular is registered for GST** — confirmed by the founder, no longer an
assumption.

Prices render **GST-inclusive and prominent**, with the ex-GST figure as a
smaller note beneath. Only the ex-GST integer is stored; the inclusive figure is
derived, never typed.

**Leading with ex-GST was built, briefly merged, and reverted.** It is worth
recording properly, because it was a reasonable option and a later session will
think of it again.

ACL s 48 requires the single (inclusive) price to be *at least as prominent* as
any component price — it does not require it to come first. So ex-GST can lead,
provided the inclusive figure sits beside it at equal size, weight and colour.
That version was built and measured (equal computed font-size, weight and colour
on all nine priced cards) and it complied. It was rejected on design grounds:
two figures at equal prominence means two things competing to be the price, and
one prominent number reads better than two. Founder's call, 2 Sep 2026. It went
in as PR #24 by accident and was reverted the same day.

The constraint that follows: **the ex-GST figure must stay less prominent than
the inclusive one.** There is no arrangement where ex-GST is the bigger number,
because that is precisely what s 48 forbids without the exemption below.

**Why the business-to-business exemption does not apply here.** The ACCC's
guidance is that where a representation is made *exclusively to a business* you
need not include a single price. The operative test is the CHANNEL being
business-only, not who the intended reader is — and a public marketing site is
not such a channel. (The $100,000 consumer threshold points the same way but is
not the test.) If prices ever moved behind a login or into a trade-only channel,
ex-GST alone would become defensible; on vestibular.nexus it is not.

**Not legal or accounting advice — worth a review.**

## Open work

- **Team-health kite chart** for the BA practice (founder's idea). The Agile
  scorecard now has keyed dimensions and a per-dimension read, so a radar is a
  visual swap rather than a rebuild — copy that pattern.
- ~~**BA has no diagnostic**, by choice.~~ **Reversed, then reframed.**
  `ai-readiness.html` publishes a twelve-question readiness check. It first
  shipped as a *team-health* radar; the founder's call is that this is an AI
  transformation initiative, not a team-health one, so the axes are now the six
  discovery domains and the page was renamed. `/ai-health` 301s to
  `/ai-readiness` via `_redirects`, because the old URL was live and in the
  sitemap.
- **Six axes = the six domains**, in the same order as `domains` in
  practices.json: company goals, systems, pain points, morale, roles, AI
  enablement. The chart is a map of the engagement rather than a slice of one
  domain. Two questions per axis, averaged; a single item carries whatever
  idiosyncratic reading one person has of one sentence.
- **Still no stages and no thresholds.** The Agile practice owns the maturity
  shape. Collapsing six axes into one number would discard the reading and make
  the two practices look like the same offering twice.
- **The self-assessment limit is real and unaddressed.** One respondent can
  answer morale and roles honestly. "Are our systems used to their potential"
  and "which systems should integrate" are things most individuals cannot
  answer, so four of six axes are partly guesses on the free page. Fine for a
  facilitated session where the room has the right people; a known weakness of
  the public one. The page carries a caveat line but does not say this.
- **Team-health capture is self-serve only.** The facilitated mode works today
  by a consultant filling the same page in a workshop. The *stored-per-email*
  mode discussed is NOT built: it would collect personal information about
  wellbeing and psychological safety at a named workplace, and the backend has
  no datastore of any kind (express/cors/helmet/postmark, send-only).
- **There is no privacy policy.** `/privacy` returns HTTP 200 but it is a
  soft-404 — an arbitrary URL returns the same homepage. Pre-existing, and
  not blocking while nothing is stored, but blocking before any stored mode.
- **Declutter at $6,600 / 3 days** is the anchor everything else is judged
  against. If the tool audit plus written playbook is really 4 days it is
  $8,800 and the whole ladder shifts.
- **Case-study copy is unreviewed by the founder.** It makes claims about how
  VTRAFFIC behaves; if any principle is stated more strongly than the code
  holds, that is the worst possible place to overstate.
- **`delete_branch_on_merge` is false on timmzero/VTRAFFIC.** The PAT cannot
  change repo settings (403, needs Administration write). Founder fix via
  Settings → General.
