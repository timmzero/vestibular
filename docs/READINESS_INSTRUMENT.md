# The AI readiness instrument — what it measures, and what it cost

Rewritten 3 Sep 2026. The 2 Sep edition described seven axes of two indicators
each, an axis mean, and a "weakest axis" claim. None of that survives. This doc
exists for the same reason the first one did: the reasoning below happened in
conversation, and a decision that lives only in a chat log did not happen.

Read this before changing `practices.ai_transformation.readiness` in
`content/practices.json`.

## What the instrument is for

A conversation opener that gives a visitor a structured picture of their own
organisation in about four minutes, and gives Vestibular a qualified enquiry.

**It deliberately emits no score and no stage.** Every competitor hands back a
maturity level, which is a sales instrument: score the prospect low, sell the
remedy. Refusing that is the strongest thing this page does and the single
constraint that should survive any redesign.

## The shape: two vantages, not two indicators

Eight axes, sixteen questions. Each axis is **one construct seen twice**:

| vantage | what it asks |
|---|---|
| `stated` | what the respondent understands the organisation to CLAIM |
| `lived`  | what they have SEEN from their own seat |

⭐ **THE PAIR IS NOT EXPECTED TO CORRELATE. Its divergence is the reading.**
That dissolves the objection that sank the previous edition — homogeneous pairs
were selecting against grain, because concrete lived items resist pairing, and
they only had to pair at all to support an axis mean the instrument had already
decided not to report.

⭐ **AND IT IS EMPIRICAL AT n=1.** Both halves come from one person, on one
scale, about one object, in one sitting. Wording severity, scale-use habits and
mood push both the same way and CANCEL in the difference. That is the
within-person form of the between-person property a multi-respondent version
would buy, available now without retention, consent or a minimum N.

⛔ **DO NOT AVERAGE A PAIR.** The mean of an espoused claim and a witnessed one
describes neither. `vantage_progress` reads the two apart; `axis_progress`
(which means over an axis's questions) belongs to the Agile scorecard.

**Keys are construct + vantage, never positional.** `morale_2` named
psychological safety in one shape and a workload item in the next; `systems_1`
meant three different things inside one day. Keys travel to the server in the
enquiry payload, so a key that quietly changes meaning makes two responses
incomparable. Pinned by a check.

**Stated and lived items are SEPARATED on the page**, into two blocks. A pair
must not sit adjacent: people dislike visibly contradicting themselves two
lines apart, so grouped by axis this would measure how consistent respondents
like to appear.

## What the result says

Two readings, and neither subsumes the other.

**The widest distance** — the largest `stated - lived`, quoted back as the two
sentences that produced it. Signed: a positive gap is a claim not borne out, a
negative one is something working better than the organisation appears to
claim, which no competitor's tool ever tells anyone.

**The floor** — the lowest `stated + lived`.

⭐ **TOTAL AND GAP TOGETHER LOSE NOTHING.** With T = stated + lived and
G = stated - lived, the originals are recoverable: stated = (T+G)/2,
lived = (T-G)/2. It is the same pair in rotated coordinates. A total INSTEAD of
the gap would be the blend this design removes; alongside it, nothing is lost.

⭐ **AND THE FLOOR POINTS WHERE THE GAP CANNOT.** An axis at 5/1 beside one at
2/2: the widest gap names the first, and so would the lowest LIVED reading,
since 1 < 2 — so the second reading would merely repeat the first and the
uniformly low area would never be named. By total, 2/2 is 4 against 6.

⛔ **"Weakest right now: X. That is where we would start." IS GONE.** It was
the only claim on the page going beyond describing the answers back, and the
axes are not equated, so it may have been naming the axis phrased most
severely. Two axes made it worse still: a dent on Load or AI fit is
OPPORTUNITY, not weakness.

## Flags, and what each is for

| flag | on | meaning |
|---|---|---|
| `escape` | `morale_lived`, `load_lived` | the event may never have happened |
| `reverse` | both `systems` items | agreement is the BAD direction |
| `polarity: opportunity` | `ai_fit_lived` | a LOW reading is benign |

⛔ **AN ESCAPE PLOTS ABSENT. NOT HIGH, NOT LOW.** Never having told someone
senior something unwelcome is not evidence of safety — it is as likely to be
evidence against it. `load_lived` measures whether saying so CHANGED anything,
so someone never near their limit has not tested it. Scoring an escape at the
top would import one construct's information into another's item.

⛔ **A REVERSE ITEM IS INVERTED ONCE, IN `read_question`, AND RAW IS KEPT.**
Two consumers need the number the person typed: the QUOTE-BACK, which prints
the reverse-worded sentence beside the answer (printing the scored value there
tells someone who marked 5 that they said 1), and STRAIGHT-LINE DETECTION,
because scored, a respondent who typed 5 sixteen times reads as varied.

⭐ **REVERSE ITEMS ARE FOR ACQUIESCENCE, NOT STRAIGHT-LINING.** Straight-lining
was always free to detect — identical raw values is a one-line check. With every
item positively worded a yea-sayer renders as a healthy organisation, which is
the failure mode that most convincingly fakes a good result on a page whose
whole output is shape. ⛔ Acquiescence requires BOTH directions high: checking
only the reverse items flags a consistent pessimist, who holds a coherent and
probably accurate view.

⚠️ `polarity: opportunity` excludes an axis from the FLOOR. `ai_fit_lived` asks
whether the week is repetitive: a low reading means varied work, which is
healthy and simply offers AI less to take. Every other lived item's low pole is
a problem.

## What makes a good item here

The standard the 3 Sep pairs were written to, learned by writing six pairs and
discarding about thirty items.

1. **THE LOW ANSWER MUST BLAME THE ORGANISATION, NOT THE RESPONDENT.** Every
   early draft of the goals item asked someone to confess ignorance — "I knew
   which one it wanted", "I could tell", "I could explain". That is a
   social-desirability trap: the honest answer costs the respondent something,
   so the item inflates and the axis reads high for people who are quite lost.
2. **AN OUTCOME, NOT A COGNITION.** Self-assessed understanding is among the
   least reliable things you can ask for; "I could explain it" is precisely the
   belief that survives until tested. Worse are items asking what OTHER people
   know, or whether someone else's decision was correct.
3. **AN INCIDENT, NOT A STATE.** A remembered event has a verifiable outcome; a
   state has only an impression.
4. **ABSTRACT CLAIM, CONCRETE OCCASION.** The stated half may be gnomic —
   negating a maxim is a stronger act than negating a description, so the low
   answer reads as dissent. That only works if its partner has a date and an
   outcome. Two abstractions produce a gap measuring self-consistency.
5. **NO ABSOLUTE QUANTIFIERS.** "Every system in use" was unanswerable in the
   direction that mattered. ⚠️ Reversing an absolute MIRRORS it rather than
   removing it — see open issue 2.
6. **AN UNAMBIGUOUS GOOD POLE.** "Do all departments use the same systems"
   failed because specialisation is correct, not fragmentation.
7. **GRIEVANCE IS SIGNAL, NOT CONTAMINATION.** Perceived procedural fairness
   predicts whether people accept decisions they disagree with, which IS the
   AI-uptake question. It was argued against here on taxonomy grounds and the
   founder was right to override that. ⚠️ But keep it DOMAIN-SCOPED: fairness in
   how goals are measured is a goals fact; fairness in the abstract is a second
   copy of the Morale axis, and eight of those would break single-construct
   axes all over again.
8. **DON'T NAME AN IDENTIFIABLE PERSON.** "My manager is fair" inhibits exactly
   the respondents whose answer matters most, on a form they know is emailed to
   a consultancy.
9. **AI FRAMING BELONGS IN THE READING, NOT THE ITEM.** An item mentioning AI
   collects the respondent's opinion of AI, which is a prepared position rather
   than an incident. Load is the model: the axis is AI-motivated, the items are
   plain questions about strain, and the copy does the interpretive work.

## Open issues, in the order they will bite

1. **⛔ AN ESCAPE DELETES THE ENTIRE LIVED POLYGON.** `radar_geometry` emits a
   polygon only when EVERY axis has a point — right while absence meant "not
   answered yet", wrong now that absence is a legitimate final state. One
   declined item and the lived shape cannot be drawn, so the escape punishes
   the most careful respondents. The caption also reads "16 of 16 answered —
   the shape firms up as you go", because `settled` depends on the same flag.
   ⛔ **NOT a property of which questions carry an escape.** Any escape does it,
   so changing the escaped items hides it rather than fixing it. The fix is a
   decision: a broken polyline skipping the absent axis (honest, looks
   unfinished) or a closed shape with a chord across the gap (looks clean,
   draws an edge nobody gave).
2. **⚠️ `systems_stated` still contains an absolute.** "Not being used to their
   full potential" — nothing is ever at full potential, so nearly everyone can
   honestly agree. Reversing mirrored the `systems_1` fault rather than
   removing it. PREDICTION: after inversion Systems sits near the floor for
   most respondents and drags the floor reading. One-word fix available:
   "sitting half-used".
3. **⚠️ Both reverse items sit on ONE axis.** Reverse items measurably increase
   confusion; a respondent who trips loses that axis entirely, both vantages
   and the gap. Spreading them across two axes costs nothing.
4. **Two axis labels have been outgrown.** "Company goals" measures
   recognition; "Roles" measures role fidelity, not decision rights. Renaming
   is not a shape change — the count holds, the parallel invariant holds — but
   each axis's DOMAIN moves with it, including its purpose text.
5. **Cross-axis comparison is still unsupported.** The axes are not equated.
   Both result lines describe and quote rather than rank, which is what keeps
   this defensible. Do not reintroduce a ranking claim.
6. **Single informant.** One person answers "we" questions about a whole
   company. No item-tuning fixes this; only changing who answers does.
7. **`roles` pairs two assessments rather than a claim and an incident**, so
   its gap reads less cleanly than pairs 1, 3 and 4. Accepted knowingly.
8. **Static assets are cached four hours with no version in the URL**, so a JS
   fix reaches returning visitors late. Not this instrument's bug, but it is
   why every defect here is expensive.

## Constructs that had to be dropped

Recorded so they are not rediscovered as omissions.

| construct | why it went |
|---|---|
| **Decision rights** — "It is clear who decides what" | Displaced when Roles became role fidelity. The cleanest sentence in the set, and who may decide what a system does is a question every implementation hits. The sharpest loss. |
| **Change survival** — "The last significant change to how I work is still how I work" | Strong item, needs its own axis. Displaced by Load on a better argument: change history says whether things stick, Load says where the cost is concentrated. |
| **Quantification** — "The last time I said something was broken, it was written down somewhere" | A bar so low that failing it is damning. Traded for allocation, which is what a client is buying. |
| **Goal alignment and sequencing** | Company goals moved to recognition. Nothing now measures whether goals cascade. |

## Things that are already right — do not undo them

- No score, no stage.
- `band_for` bands by RANGE, not exact match. An axis averaging 3.5 previously
  matched no branch and fell through to "Needs work", telling a team above the
  midpoint they were the problem, on a page that looked entirely plausible.
- A missing answer plots as ABSENT, not at the centre.
- `is-aligned-low` and `is-aligned-high` are different rows. They shared one
  class, so 1/1 and 5/5 — the two most opposite readings available — rendered
  alike.
- The results caveat: "a prompt for a conversation, not a measurement of your
  team." That sentence is what makes the rest of this defensible.
- ⚠️ `dimension_read.js` and `radar.js` are SHARED with the Agile scorecard.
  Vantages, escapes, reverse flags and the two-polygon render are all additive
  and default absent; `diagnostic.html` is byte-identical, pinned by checks.
- ⚠️ The contract tests parse the config OUT OF THE EMITTED PAGE. Every gate
  was once green over a build where the instrument read as entirely unanswered,
  because the fixtures carried vantages and the generator did not. A fixture
  proves the module works on the shape you imagined; only the artefact proves
  it works on the shape you ship.
