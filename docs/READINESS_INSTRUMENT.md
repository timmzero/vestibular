# The AI readiness instrument — what it measures, and what it cost

Written 2 Sep 2026, at the end of a long session that changed this instrument
three times. It exists because all of the reasoning below happened in
conversation, and a decision that lives only in a chat log did not happen —
the next person to touch these questions would otherwise re-derive it, badly,
and probably arrive somewhere different.

Read this before changing `practices.ai_transformation.readiness` in
`content/practices.json`.

## What the instrument is for

A conversation opener that gives a visitor a structured picture of their own
organisation in about three minutes, and gives Vestibular a qualified enquiry.

**It deliberately emits no score and no stage.** Every competitor hands back a
maturity level, which is a sales instrument: score the prospect low, sell the
remedy. Refusing that is the strongest thing this page does and the single
constraint that should survive any redesign.

## What state it is in as of 2 Sep

Seven axes, two items each, fourteen questions. Each axis measures one
construct with two indicators, so the axis mean is a legitimate subscale
average rather than two different things blended into a number that describes
neither. `readiness.dimensions` and `domains` run parallel and **must stay
parallel** — the pillar area-map on the readiness page renders from `domains`,
so splitting a quiz axis without splitting its domain prints "seven areas"
beside an eight-spoke chart.

Pillars own areas 2/3/2 (gravity / acceleration / balance) since AI Enablement
split. Uneven, and only in the diagram.

## ⚠️ The unresolved objection — read this before "improving" anything

Making the axes homogeneous **cost the instrument its grain**, and the founder
called it at the end of the session:

> "I feel like we are losing touch with some grainy gritty reality somehow."

The original items asked about lived experience — *people are not running on
reserves*, *someone can say "this will not work" to the person sponsoring it,
without it costing them*, *the right people are in the right places*. The
replacements ask about organisational mechanics — *when two priorities
conflict, it is clear which one wins*, *decisions are made at the level where
the work happens*. Both defensible. Only one has a person in it.

⭐ **THE DRIFT WAS STRUCTURAL, NOT ACCIDENTAL.** Homogeneous pairs are easier
to build from abstract items; concrete lived questions resist pairing because
they describe specific human situations. So optimising for a defensible axis
mean systematically selects against grain. Anyone repeating that optimisation
will get the same drift.

⛔ **AND IT SOLVED A PROBLEM THE INSTRUMENT HAD ALREADY DECIDED NOT TO HAVE.**
Axis homogeneity only matters if you report an axis mean. "No score, no stage"
was the founding choice. Graph the items individually and heterogeneity stops
being a flaw and becomes coverage.

## Three items were dropped from scoring and are worth restoring

They are in git history at `89e6e00:content/practices.json`.

| item | construct | why it matters |
|---|---|---|
| `morale_2` | psychological safety | Best-evidenced single question in the set. Whether someone can tell a sponsor "this will not work" without it costing them predicts whether an implementation survives contact with the organisation better than almost anything else answerable in one sentence. **The loss most worth reversing.** |
| `company_goals_1` | goal alignment leadership↔floor | Distinct from goal quality; a goal can be well-specified and unshared. |
| `roles_2` | person-role fit | Distinct from decision rights. |

## Known weaknesses, in the order they undermine the page

1. **⛔ Cross-axis comparison is unsupported, and the page makes a claim on
   it.** The axes are not equated. Some items set a far higher bar than others,
   so an axis can sit low because of how it was worded rather than anything
   about the respondent. "That is where we would start" may therefore be
   naming *the axis phrased most severely*. This is the only claim on the page
   that goes beyond describing the answers back, and it is the least
   defensible thing on it. Either stop making it, or build norms — the contact
   pipeline now carries structured results, so a distribution could eventually
   make "weakest" mean *low relative to everyone else*, which would be real.
2. **The weakest axis can flip on one click.** Two items per axis gives a
   resolution of 0.5, and the two lowest axes are routinely within that. A
   measured run had 1.0 against 1.5. If the claim stays, name both when they
   are within one increment.
3. **Single informant on organisational facts.** One person answers "we"
   questions about a whole company. No item-tuning fixes this; only changing
   who answers does.
4. **All items positively keyed.** No reverse-scored item, so straight-lining
   is undetectable. If reverse items are ever added, the inversion must happen
   in `read_answers` (`scripts/dimension_read.js`) **before** banding, the
   radar and the weakest calculation — and raw answers must be retained
   separately, because straight-line detection needs the raw pattern, not the
   scored one. That module is shared with the agile scorecard on
   `diagnostic.html`, so a `reverse` flag must default absent and leave the
   agile path byte-identical, with a `test_dimension_read.cjs` case pinning it.
5. **Two anchors are still double-barrelled.** `pain_points_1` joins knowing-
   where with putting-numbers-on-it; `data_readiness_1` joins accessible with
   good-enough.

## The open design decision

Three routes, not yet chosen:

- **Restore the dropped items and stop reporting an axis mean.** Graph items
  individually, grouped by area for legibility rather than for scoring. The
  "weakest" becomes a question — *"nobody can tell the sponsor this will not
  work"* — which is more actionable than *"Morale"*. Cost: 14+ spokes needs
  short labels that do not exist, so the radar likely becomes a grouped bar
  chart. This is the cheapest route and it dissolves problems 1, 2 and much of
  the grain loss at once.
- **Reframe to first person.** *I feel stressed. I am not sure my duties match
  my job description. I do not trust leadership.* Fixes problem 3 outright —
  the respondent stops claiming to describe the company and describes their
  seat in it. Restores grain by construction. Matches the practice's own ethos
  ("the people doing the work hold the truth").
- **Multi-respondent.** Send it to several people in one organisation; **the
  spread between their answers is the finding.** One person reporting a
  mismatch is noise; a leadership team at 5 and the floor at 2 on the same
  item is a diagnosis. This is the version that would satisfy a research
  psychologist, and it is a product change rather than a copy change.

## Things that are already right — do not undo them

- No score, no stage.
- `band_for` bands by RANGE, not exact match. A comment records why: an axis
  averaging 3.5 previously matched no branch and fell through to "Needs work",
  telling a team above the midpoint they were the problem, on a page that
  looked entirely plausible.
- A missing answer plots as ABSENT, not at the centre. Plotting it at zero
  would draw a value the person never gave.
- The results caveat: "a prompt for a conversation, not a measurement of your
  team." That sentence is what makes the rest of this defensible.
