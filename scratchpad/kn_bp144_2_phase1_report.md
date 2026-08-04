# KN-BP144-2 Phase 1 Report — Read-Only Survey of plow_mc_elimination_cascade.ts

**Status: read-only. No code changed in this phase. File read in full**
(`C:\Users\Administrator\Documents\mnemosyne\src\main\plow\plow_mc_elimination_cascade.ts`,
541 lines total, all 541 read).

## Every existing rule/arm, by name and line number, and what it eliminates on

| Arm | Lines | Exported symbols | What it eliminates on |
|---|---|---|---|
| **C1 — Ask the Inverse** | 35-87 | `detectNegationQuestion` (58-62), `buildInverseQueryFraming` (68-87) | Eliminates nothing itself. Detects a NOT/EXCEPT polarity qualifier on the STEM and, if found, produces the mechanically-inverted affirmative framing of the stem for the caller to re-query. Pure text transform; no option is touched here. |
| **C2 — Jar Method** | 89-111 | `orderEliminationBlocksByCertainty` (106-111) | Eliminates nothing itself. Pure sort of caller-supplied `EliminationBlock[]` (each already a group of letters the caller is confident about) into certainty-then-size order. Decides sequencing only, not membership. |
| **C3 — Cake Cut Half, alternating** | 113-152 | `generateCakeCutAlternatingSplits` (133-152) | Eliminates nothing itself. Given the currently-surviving letters, generates a 2-or-3-pass query plan (forward half, reverse half, control re-inclusion). Produces a *plan* for the caller to dispatch, not a decision. |
| **C4 — Bidirectional Consistency** | 154-250 | `checkBidirectionalConsistency` (181-231), `runBidirectionalConsistencyGate` (239-250) | Eliminates/filters **SOURCES**, not options: a source whose most-to-least ranking does not reverse cleanly into its own least-to-most ranking is marked inadmissible and its ranking is excluded from use. Does not touch which option letters survive. |
| **C5 — Terminate on the Number** | 252-361 | `determineRequiredPrecision` (278-287), `evaluateSignificantFigureAccept` (304-361) | Eliminates/accepts on a **numeric option value** basis only: given `OptionValue[]` (letter+number pairs) and a computed value, accepts the nearest option only if its margin clears half the option set's own minimum gap; otherwise abstains. Requires option texts to carry parseable numbers. Not applicable to prose/definitional options like qid 85's. |
| **Format-independent fallback gate** (KN-BP141-10 addition) | 363-478 | `evaluateFormatIndependentFallbackGate` (428-478), `extractNumericOptionValues` (405-412) | Not an eliminator — a **gate** that decides whether C5 (numeric path) or a superlative/negation ranking path is even applicable to a question, based on the STEM's superlative/negation language and the OPTIONS' own extractable numbers. Fires on >=2 distinct numeric option values, or on superlative/negation stem language. On qid 85's stem ("Which of these statements correctly explains bias?") this gate would not fire: no numeric options, no superlative term, no NOT/EXCEPT qualifier. |
| **Ranking-response parser** | 480-506 | `extractLetterRankingSequence` (492-506) | Not an eliminator — a pure parsing helper that extracts an ordered, deduplicated letter sequence from a raw ranking response string. |
| **C7 — Source Capture** | 508-540 | `buildCascadeSourceCapture` (532-540) | Not an eliminator — a pure constructor for a source-citation record (URL/claim/query/source/timestamp). Bookkeeping only. |

**Bottom line for qid 85's actual shape (a 10-option prose/definitional question, no numbers, no
negation, no superlative):** none of the arms in `plow_mc_elimination_cascade.ts` itself eliminate any
OPTION on this file's own authority for a question shaped like qid 85. C1's negation detection does not
fire (qid 85's stem has no NOT/EXCEPT). C5 and the format-independent gate do not fire (no numeric
options, no superlative/negation stem). C4 filters sources, not options. C2/C3 are pure sequencing/
planning helpers that presuppose a decision already made elsewhere. This matches
`RECOVERED_CASCADE_APPLIED_TO_038_FAILURES_BP143.md`'s finding #1 verbatim: this file, as coded and
wired today, was never reachable for any of the six run-038 failures because they all classify as
`answerType: 'reasoning'`, and the only wired call site (`resolveDeterministicComputeOverride` in
`plow_mc_answerer.ts`) gates on `answerType === 'computable'`.

**The option-level categorization/predicate-decomposition that Excerpt 7's step 1 describes ("first, I
categorize the possible answers... A, B, sorta C... all have to do with what answer it results in") is
NOT in this file at all.** It lives in the sibling Stage-1 file, `plow_mc_elimination_chart.ts`
(R1 polarity-mismatch, R2 cause-is-not-the-thing, R3 wrong-property), which is explicitly documented at
that file's own header as sharing the qid-85 anchor case (`math/source_id 8230`) and independently
verified in this session to reduce qid 85's ten options to survivors `{A, E}` (see the "Buildability"
section below for the exact run). `plow_mc_elimination_chart.ts` is not the file this ticket is scoped
to edit, but it is a legitimate read-only import for the new stage, exactly as this file already imports
`extractNumber` from `compute_sidecar.ts`.

## The abstain logic (ticket says "reported near lines 304-361") and exactly what reaches it

Lines 304-361 are `evaluateSignificantFigureAccept`, C5's terminal accept/abstain function — confirmed
by direct read, matches the ticket's line estimate exactly. Its abstain paths, in order:

1. **Line ~309-317**: `requiredPrecision === null || options.length === 0` -> abstain. Reached when
   fewer than 2 distinct numeric option values exist (nothing to discriminate).
2. **Line ~325-336**: nearest option's distance from the computed value exceeds the option set's own
   required precision -> abstain ("the computed value does not land decisively on any option").
3. **Line ~338-350**: the nearest and second-nearest options are within the required precision of each
   other -> abstain ("ambiguous, not forced").
4. Only if none of the above fire does it return `accept: true` with a single letter (line ~352-360).

**What reaches this abstain logic**: only callers that already have (a) a computed numeric value and
(b) an `OptionValue[]` array (letter + parsed number). Nothing in the qid-85 shape (prose options, no
numbers) reaches this function at all — it is architecturally inapplicable to definitional/reasoning
questions, by design (see the file's own C5 section header: "the required precision is set by THE
QUESTION... via the OPTION SET's own spacing"). This is a second, independent confirmation of BP143's
finding: this file has no abstain/accept logic today that a register-resolution stage for prose options
would share, extend, or conflict with. The new stage needs its own, separate abstain logic.

## Where a new stage should insert

Insert as a new, independent, exported top-level function/section — analogous in shape to C1-C7, added
**after** C7 (Source Capture) at the end of the file — rather than modifying any existing arm. Rationale:

- No existing arm in this file operates on prose option elimination at all (see table above), so there is
  no existing arm to literally run "after" in a single execution pipeline *within this file* — the file
  has no wired pipeline function that calls C1 through C7 in sequence; each is an independently-exported
  pure function the caller sequences itself (this is the file's own documented contract, see header
  comment lines 8-14: "the actual asking is the CALLER's job... this module only ever consumes
  caller-supplied rankings/votes").
- The new stage's OWN 2-or-more-survivors gate is therefore enforced by the new function itself, on a
  caller-supplied `survivors: string[]` parameter (matching how C4 takes caller-supplied rankings and C5
  takes caller-supplied `OptionValue[]`) — exactly mirroring the existing "prior arms already ran
  elsewhere (Stage 1's `plow_mc_elimination_chart.ts`, or C1-C5 in this file for other question shapes);
  this stage receives their output as an ordinary parameter" pattern.
- This keeps the new stage a pure, testable, drop-in addition with zero edits to any existing function,
  and zero edits to `plow_mc_answerer.ts` (see Buildability below).

## Buildability: can this file reach a lookup/authority call today?

**No.** Confirmed by direct read of the file's own header comment (lines 1-31) and by the shape of every
function in it: "EVERY function in this file is pure and synchronous — it never queries a model, a
browser, or any external source itself... this module only ever consumes caller-supplied
rankings/votes." No `import` in the file reaches any network/IPC/model-call module; the only import is
`extractNumber` from `./compute_sidecar` (a pure numeric parser). C4's bidirectional-consistency check
and C5's significant-figure accept both take pre-fetched rankings/values as plain parameters. There is no
mechanism in this file, today, by which it could itself dispatch "what is bias in statistics" to a
browser-authority bridge or any other live source.

**This determines the buildability of the new stage exactly as the ticket anticipates, and the answer is
buildable without touching `plow_mc_answerer.ts`:** the mandatory verification lookup required by step 4
is, by the file's own existing and unbroken architectural convention, the CALLER's job, not this file's.
The new stage is designed (Phase 2, below) to accept the verification result as a plain, caller-supplied
parameter (`RegisterVerificationLookup | null`) — exactly like C4 accepts caller-supplied rankings and C5
accepts caller-supplied computed values — and to ABSTAIN whenever that parameter is `null`. This is not a
workaround; it is the same contract every other arm in this file already uses. Wiring an actual live
dispatch of "what is bias in statistics" into the production answer pipeline (i.e., making
`plow_mc_answerer.ts` actually construct and pass a `RegisterVerificationLookup` at the right point) is,
correctly, out of scope for this ticket and is not attempted — this ticket's own gates are satisfied by
supplying that verification result from the *test harness* (this session performed one real, live web
lookup for "what is bias in statistics" as the Phase 2 gate's caller-supplied input; see Phase 2/gate
report), not from the live app.

## Confirmation: R1/R2/R3 real run against qid 85 (referenced above, executed this session)

`plow_mc_elimination_chart.ts`'s `runEliminationChart` was executed (via a compiled/dist-based harness,
not by hand-paraphrase) against the real qid 85 stem and the real ten options recovered in Phase 0. Full
run, trace, and survivor set are reported in the Phase 2 gate report (same session) rather than duplicated
here, since Phase 1 is read-only and this confirmation required running compiled code, which belongs to
Phase 2's gate work.

## Flags — speculative vs. verified in this Phase 1 report

- **Verified**: every line-range/function-name/behavior claim above comes from a direct, full read of
  `plow_mc_elimination_cascade.ts` (541 lines) performed this session, not from the file's own header
  comments alone (though the header comments' own architectural claims — "every function is pure and
  synchronous" — were independently checked against every function body and hold).
- **Verified**: the "abstain logic near lines 304-361" claim matches the ticket's own estimate exactly on
  direct inspection.
- **Speculative**: the claim that C1's negation detection "would not fire" on qid 85's stem is a direct
  regex evaluation claim (`NOT_QUALIFIER_RE`/`EXCEPT_QUALIFIER_RE` against the literal stem text) and is
  not speculative; it is reported as a fact checked against the regex source, not run through compiled
  code in this phase specifically (it is re-confirmed via the compiled harness in Phase 2).
