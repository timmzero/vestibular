# Session kickoff — vestibular.nexus / vtraffic.nexus / VTM

Read this before running anything. It records what was verified against live
systems, not what seemed likely. Written 3 Sep 2026, superseding the 2 Sep
edition.

**Re-derive from live `origin/main` rather than from this file.** Two facts in
the previous edition were wrong by the time they were read, and one of them
would have passed a materially incomplete restore. This file is a map. Maps
stale on contact.

## The repos

| repo | serves | notes |
|---|---|---|
| `timmzero/vestibular` | vestibular.nexus | consulting site, two practices |
| `timmzero/VTRAFFIC` | vtraffic.nexus | product marketing site |
| `timmzero/Vestibular-Traffic-Management` | tm.vestibular.nexus | the VTM platform — **different discipline, uses D-numbers** |

**Neither marketing site uses D-numbers.** Do not allocate one, and do not
touch the VTM counter from that work.

## Corrections to the 2 Sep edition

Both were measured, not inferred.

1. **The RAG corpus holds 2,366 rows across 46 doc_ids, not ≈1,396.** The old
   figure was the stated acceptance criterion for the Zilliz restore, and it
   was low by roughly a thousand rows. **A restore returning 1,396 would have
   passed the written test while being materially incomplete.** The census is
   below and is the baseline the next restore gets checked against — there was
   none for this one.

2. **Godzilla's Docker is a native daemon inside WSL, not Docker Desktop.**
   The build output reads `docker:default`; Desktop's WSL integration reports
   `desktop-linux`. "Docker Desktop isn't running" is not a reason builds fail
   here. Confirm with `docker info --format '{{.OperatingSystem}}'`.

## Start here — today's tail, about twenty minutes

**`~/.vtm-env` on Godzilla was never confirmed updated.** The acceptance script
read credentials straight from Secrets Manager and bypassed that file
entirely, so both keyspaces may still hold the recycled endpoint. Nothing
breaks until the next ingest, which would then write to a cluster that does
not exist. Update **all four variables**: the backend reads `MILVUS_URI` /
`MILVUS_TOKEN`, the ingestion CLI reads `ZILLIZ_URI` / `ZILLIZ_TOKEN`
(handover §15). Same values, two keyspaces — that split is why the file went
stale in the first place.

Then:

- `git fetch origin --prune && ./sync-main.sh --apply` — the Godzilla checkout
  was two merges behind `origin/main` during the D749 deploy.
- Merge the PR for **`feat/d749-tm-social-card`** at `f4edb3a1` (off
  `9fe85de5`). Check `git ls-remote` before assuming; the founder merges as
  they go.
- Once deployed, run **LinkedIn Post Inspector** against
  `https://tm.vestibular.nexus/`. That is the furthest consumption for D749 and
  it force-refreshes LinkedIn's cache in the same pass.

## What happened on 3 Sep — the Zilliz incident

Recorded because the shape recurs, not because the fix is interesting.

VTM-REG-RAG was recycled and restored from backup. **The restore created a new
cluster and nothing downstream was updated.** The `vtm-zilliz-sydney` secret
still read `LastChangedDate: 24 July` and pointed at `in01-eec7d20fe959422`,
whose DNS record no longer existed.

**`/api/rag/status` reported `available: true, reason: connected` throughout.**
Not a lie exactly — `_ensure_initialized` returns early once `_initialized` is
set, so the verdict was minted on 2 Sep against the then-live cluster and never
re-checked. A task that boots healthy and later loses its cluster keeps
reporting health for the rest of its life.

Meanwhile `retrieve()` took the quiet path: `_unavailable` was `False`, so the
D576 `RetrieverUnavailable` raise never fired; the call reached
`_collection.search()`, hit `except Exception`, logged a warning and
**returned `[]`**. Empty passages are indistinguishable from "nothing relevant
found" at every layer above.

Fixed: secret updated 16:57, `./deploy.sh api`, task `api:994` at 17:03,
corpus confirmed at 2,366 / `Loaded` / 1024-dim.

**No documents were issued ungrounded.** The only RAG failure in the window was
a deliberate test query; PDF renders do not consume the retriever.

⭐ **The anti-fabrication floor held.** Asked for per-state working speeds with
a dead corpus, the model refused and named the tables it would have needed
rather than supplying plausible numbers. The failure mode that mattered most
did not fire.

## Priority queue

### 1 — D750: the RAG status surface tells the truth

**Strongest claim of anything open, because it has a live incident behind it.**
Prod reported `connected` for two days against a host with no DNS record, and
`entity_count` — the one number that would have exposed it — is computed at
`retriever.py:312` on every boot and discarded on every boot.

Three members. **The third is a founder ruling, not a judgement call:**

- Report the count. Absent must be **absent, never `0`** — `0` is a positive
  claim that the corpus is empty, which is the exact confusion being fixed.
- Make the status reflect current reachability rather than a latched boot
  verdict.
- Decide whether a runtime search failure should **re-arm `_unavailable`** or
  keep returning `[]`. Re-arming risks one transient blip disabling RAG for the
  task's life, since nothing un-sets it. Re-arm-and-retry is probably right,
  but it changes the product's degradation behaviour.

D576's *"deliberately NOT changed while routing it"* concerns that routing
commit and licenses this as a separate deliberate change. Quote it in the scope
doc so nobody reads it as a violation.

### 2 — the retrieval-quality finding (floor-hardening, not D750)

**The sleeper, and a measured fact rather than a theory.** The corpus holds
`AGTTM-Part3` Figure 5.4 — *"clearance of more than 3 m up to 6 m"*, the exact
band boundary — and the query did not surface it. Three plausible causes, none
yet measured: the chunks describe clearance and contain no speed, so cosine
distance drops them from top-k; jurisdiction filtering may narrow the pool
before ranking; the relevant content spans five doc_ids and one top-k pass may
not reach them all.

**This is the expensive failure mode.** The floor fires correctly, the refusal
reads as principled, and the content was there the whole time.

⚠️ Separately: there appears to be **no per-jurisdiction speed table keyed on
3 m**. Clearance selects the control *method* (AGTTM Part 3: <3 m, 3–6 m, >6 m)
and exposure limits (Part 5: 1.2 m, 1.2–3.0 m); TCAWS 1.0 §11.5.2 sets a 1.5 m
minimum lateral clearance. Confirm with the founder before treating the
retrieval miss as the whole story.

### 3 — marketing repo: decisions before work

- **Load pair (8 of 8)** — analysis complete, parked on a founder ruling. Three
  findings, ranked: the presupposition is coupled to the escape/polygon
  decision rather than independent of it; the item measures *voice*, which
  Morale already owns; and the stated half is a description rather than a maxim
  (rule 4). Two candidate rewrites and a do-nothing option exist in the chat
  record — **not yet written to `READINESS_INSTRUMENT.md`.**
- **The escape polygon** — straight founder call: an honest broken polyline
  that skips the absent axis, or a closed shape with a chord across the gap
  that draws an edge nobody gave.
- **Cache-busting** — the one item needing no ruling. Four hours, no version in
  the URL, has bitten four times; `renderHead()` writes every link and script
  tag, so a content hash has one obvious home.
- `systems_stated`, the two outgrown axis labels, and both reverse items
  sitting on one axis are unchanged from the 2 Sep edition.

### 4 — social cards, remaining

`vestibular.nexus` is **complete** — 11 pages, each with its own image, all 11
resolving `200`. `vtraffic.nexus` has a full og+twitter set on all 5 pages but
**every page shares `images/og-card.png`**. Whether those want per-page imagery
is a founder call, not a defect.

## Verified environment facts

- **GitHub PAT expires 2026-09-21 22:43 UTC.** Rotate around 14 Sep. Read the
  real expiry from GitHub's own header at session start rather than trusting
  that date, and read the status line **together with `x-ratelimit-limit`** — a
  403 with `limit: 60` means the request went out anonymous, not that the token
  is dead. The founder hands the PAT over; do not search for it.
- ECS: cluster `tm-cluster`, service `tm-api-service`, region `ap-southeast-2`,
  account `982081066722`. API at `https://tm-api.vestibular.nexus`.
- Secret `vtm-zilliz-sydney` (ARN suffix `-KuRLy5`) holds `MILVUS_URI` and
  `MILVUS_TOKEN`; the task definition maps them **by key name**, so the names
  cannot change.
- **`valueFrom` resolves at task start.** Updating a secret does nothing to a
  running task. `deploy.sh api` registers a new task def and force-deploys,
  which is what replaces it.
- `assert_au_residency` matches the literal substring `ap-southeast-2` in the
  URI. A legitimately-Sydney endpoint formatted differently is refused *before*
  the first network call, and that refusal lands in `except Exception` —
  looking like a connection failure rather than a guard.

## Corpus baseline — 2,366 rows, 46 doc_ids, 3 Sep

Reconcile against this after any restore. A total can match while composition
is wrong, so compare **per doc_id**, not just the sum.

```
  23  ACT-MITS-01-Traffic-Management-1-0        383  TCAWS-1.0
  37  AGTTM-Part1                                12  TCAWS-1.0-AppA
  64  AGTTM-Part10                              217  TCAWS-V6.1
  80  AGTTM-Part2                                 8  TCAWS-V6.1-AppA
 139  AGTTM-Part3                                38  TCAWS-V6.1-AppB
  50  AGTTM-Part4                                 1  TCAWS-V6.1-AppC
  63  AGTTM-Part5                                 3  TCAWS-V6.1-AppD
  57  AGTTM-Part6                                 8  TCAWS-V6.1-AppE
  46  AGTTM-Part7                                28  TCAWS-V6.1-TD00003
 131  AGTTM-Part8                                 1  TCAWS-V6.1-TD00031
  19  AGTTM-Part9                                26  VIC-GG2023S280
   4  NT-Temporary traffic management             5  VIC-TEM_Vol_2_Part_23_AS17423
  88  NZ-New-Zealand-guide-to-TTM                 5  WA-part-1-introduction
  21  NZ-New-Zealand-guide-to-TTM-part-3         50  WA-events-code-of-practice
  51  QLD-MUTCD-Part-3                          157  WA-works-on-roads-code
  41  QLD-QGTTM-Amendment-Register
   6  QLD-QGTTM-Part-1     7  Part-10    14  Part-2    103  Part-3
   9  QLD-QGTTM-Part-4    33  Part-5     10  Part-6     16  Part-7
  22  QLD-QGTTM-Part-8     5  Part-9
 120  SA-Field_Guide_27_Feb_26                   89  SA-Manual_of_Legal_Responsibilities
  16  SA-Supplement_for_AS1742_3                 53  SA-Temporary_Traffic_Management
   7  TAS-Tasmanian_Guide_to_Traffic_Control
```

## Standing disciplines

Carried from 2 Sep, all still earning their place, plus what 3 Sep added.

- **After any merge, branch fresh — check `git ls-remote` BEFORE pushing.**
  A merged branch is auto-deleted; pushing to that name recreates it against a
  closed PR where nobody looks.
- **A fixture proves the module works on the shape you imagined. Only the
  emitted artefact proves it works on the shape you ship.** ⚠️ **D749's guard
  parses source, not the rendered `<head>` — it carries this exact weakness and
  says so.**
- **A matrix on a red baseline kills nothing.** Confirm green before believing
  any verdict.
- **A mutation that changes the file without changing behaviour is neither a
  survival nor a kill.** Assert the behaviour moved.
- **Read which assertion killed each arm**, and re-drive in isolation.
- **A passing check on an empty result is not a pass.**
- **Pin the relationship, not a count** — at any count including zero.
- **Measure the browser, don't reason about the CSS.**

### Added 3 Sep

- ⛔ **A cached verdict cannot go false.** `available: true` was true when it
  was computed and meaningless when it was read. Any status derived from
  initialisation state must say *when* it was measured, or be re-measured.
- ⛔ **Two stories can fit the same evidence and want opposite responses.** A
  dead endpoint plus a healthy-looking status fitted both "secret not updated"
  and "task not replaced". The discriminator cost two commands. Guessing would
  have cost the afternoon.
- ⛔ **A control validates the instrument it used, not a different one.** An
  empty `RAG` term-match proved nothing when the positive control had tested a
  quoted-substring pattern. Different syntax, different mechanism.
- ⛔ **Length is not identity.** The new Zilliz token was also 104 characters.
  Comparing lengths would have read as "the paste failed". Compare values.
- ⛔ **Read the value back from the system, not from the file you wrote.**
- ⛔ **`git checkout <file>` during a mutation run reverts uncommitted work
  along with the mutation.** This happened in D749 and turned the restored
  baseline red. Restore from copies.
- ⚠️ **Verify the acceptance criterion itself, not just the result against it.**
  ≈1,396 was wrong and would have waved through a partial restore.

## One caution

The kickoff you are reading was itself wrong twice on 3 Sep. Both errors were
numbers that looked authoritative and had gone stale. Treat every figure here
as a claim to re-measure, especially the ones that would be expensive to get
wrong.
