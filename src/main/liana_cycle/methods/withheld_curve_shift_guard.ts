// methods/withheld_curve_shift_guard.ts -- D-BP213-XO-41/BISHOP-XO/seg-composer-methods, LEG 1 RE-AIM
//
// FOUNDER ORDER, 2026-09-03T06:33:14Z, verbatim: "re-aim leg 1 as the key-and-options withholding
// method as well." This REPLACES anchored_lookup_guard.ts (left in place, unregistered -- see
// D-BP213-BM0-026_LEG1_IS_AIMED_AT_THE_WRONG_DEFECT.md for why, and DO NOT re-enable its import).
//
// THE DEFECT THIS FIXES. The old file asked the model to CLASSIFY each labeled sub-part ("supply"
// vs "quantity supplied") using "its own general domain knowledge" -- a DECISION, forbidden by
// HARDWIRE-22 ("A local model may only be asked to COPY OUT what is literally present in a text it
// was given ... THE CODE DECIDES. ALWAYS."). Because the model classified, a WRONG classification
// and a RIGHT one were indistinguishable to the old lookup step -- both were just tuples that either
// did or did not appear in the option list. On the founding example (dataset qid 7260, key G) the
// model derived a tuple wrong on one sub-part, and that wrong tuple happened to exactly equal option
// I -- an honest abstention (no match found) became a confident, WRONG answer. See
// D-BP213-BM0-026_LEG1_IS_AIMED_AT_THE_WRONG_DEFECT.md for the full account and
// D-BP213-XO-41_LEG1_REAIMED.md (BISHOP_DROPZONE) for the full design this file implements.
//
// THE REPLACEMENT RULE, applied by CODE, never sent to the model: a change in the good's OWN PRICE
// moves you ALONG its supply/demand curve (a change in QUANTITY supplied/demanded); a change in
// ANYTHING ELSE (an input cost, weather, a different good's price, income, taste, technology --
// literally any determinant other than the good's own price) SHIFTS the curve (a change in
// supply/demand itself). This is a closed textbook rule, not an open-ended judgment -- see the
// design doc section 1 for the worked reproduction of dataset qid 7260's key (G) from exactly this
// rule applied to its three clauses.
//
// WHAT THE MODEL IS ASKED FOR: two purely copy-out extractions, never a classification --
//   (1) ONCE per question: quote, verbatim, the name of the good/market the question analyzes, from
//       the shared preamble text only (before the first labeled sub-part).
//   (2) ONCE PER SUB-PART, serially (never bundled -- "Gemma has to do things serialized... you
//       cannot ask her to do more than one thing at a time"): quote, verbatim, what changed in that
//       one clause, and if a price/cost is named, quote, verbatim, whose price/cost it is.
// CODE then normalizes and compares the two quoted spans (same good vs a different one) and applies
// the fixed rule above -- the model never sees "supply", "demand", or "quantity" in any prompt, and
// never sees the option list or input.correctAnswer at any point. Grep this file for "supply" and
// "demand": every occurrence outside a comment or the axis-detection/tuple-assembly code below is
// nonexistent -- neither word is ever written into a string sent to Ollama.
//
// RUNTIME VERIFICATION, NOT JUST DESIGN-TIME DISCIPLINE. Every quoted span the model returns is
// checked with a literal (normalized) substring test against its source text BEFORE it is used for
// anything. A quote that is not a literal substring (a paraphrase, not a copy-out) is treated exactly
// like a transport failure -- grounds to abstain, never grounds to guess what the model "probably
// meant." This is the one piece of machinery the old file never had: it trusted the model's
// classification outright. This file trusts nothing the model says until it is mechanically shown to
// be a literal quotation of the text it was given.
//
// AXIS DETERMINATION IS CODE-ONLY, BEFORE ANY MODEL CALL, FROM THE OPTION VOCABULARY ALONE. Every
// option row is split into clauses and normalized; if every distinct clause value is drawn from
// {supply, quantity supplied} (or from {demand, quantity demanded}), that is the axis. A mixed or
// unrecognized vocabulary refuses the shape outright in shapeTest() -- this is a DELIBERATE
// narrowing versus the old file's claimed "any compound-tuple domain" generality (which is exactly
// what required delegating classification to the model). See the design doc section 7: the
// TECHNIQUE (mask, extract literally, let code apply a fixed rule, reveal only for the letter
// lookup) generalizes; the RULE TABLE does not, and is not claimed to.
//
// THE WIN CONDITION IS NOT "I FOUND A MATCHING ROW" (the old file's defect). It is a conjunction of
// four independently-checked gates: (1) the target-good quote verified literal; (2) every sub-part's
// price-attribution quote verified literal (or explicitly "no price mentioned"); (3) the tuple
// assembled by CODE applying the fixed rule to those verified extractions is well-formed; (4)
// exactly one option row, once finally revealed, exactly matches that ALREADY-DECIDED tuple. By the
// time gate 4 runs, the classification is already fully and deterministically settled -- the option
// list only ever supplies the LETTER, never the classification.
//
// ABSTENTION IS THE DEFAULT. Every gate above, on failure, abstains rather than guesses -- see run()
// for each site. Never reads input.correctAnswer, anywhere in this file (grep to confirm; the only
// occurrence is in this sentence and the header).
//
// THINKING OFF, per Founder order 2026-09-03T06:34:30Z: "make sure thinking=OFF for gemma to process
// that -- we have proven with receipts that more room just has her give more prose." `think: false`
// passed as a top-level Ollama request field, same precedent as canonical_pipeline.ts:310 and the old
// anchored_lookup_guard.ts -- no silent no-think-field-retry fallback here (that fallback in
// canonical_pipeline.ts is a known, uninstrumented, silent path back to thinking-on; not copied).
//
// Rule 66: new file, no supersede needed. No em-dashes -- "--" used throughout. American spelling.
//
// D-BP213-XO-48 STRUCTURAL EXTRACTION, per Founder order 2026-09-03T17:56:46Z. He observed
// gemma2:2b confidently naming a price ("price of oranges") on sub-part (a) of this method's own
// founding example (dataset question_id 46 / source_id 7260), a clause that names NO price at all
// -- "gemma isn't qualified to make up anything -- NON THINKING MODEL -- so there shouldn't be any
// option of providing a prose response other than what a calculator does ... We need a structural
// way to enforce it. She's doing what her creators invented all ai to have: what we call
// Korsaikoff's Syndrome." VERIFIED before this fix: `think: false` WAS already being sent
// top-level (line 360 pre-fix, see the superseded sibling of this file) with no silent fallback --
// the instruction was practiced. The hole was one layer under that: `think: false` only suppresses
// the thinking BLOCK, it does not constrain the OUTPUT. The old free-text CHANGE/PRICE-OF prompt
// gave gemma 150 tokens of open canvas and merely ASKED it to copy out a literal quote -- asking is
// not enforcing, and a non-thinking, non-reasoning model asked an open question fills the blank
// with whatever token pattern its weights associate with the shape, exactly the confabulation
// mechanism the Founder named.
//
// THE FIX. Every extraction site below is now a NUMBERED MENU, never a free-text quote request:
//   1. CODE (extractCandidateSpans()) enumerates every candidate span from the source text --
//      literal-substring phrase fragments only, mechanically derived (comma/connector splits plus
//      a few fixed "price of X" / "X's price" / "market for X" patterns) -- numbers them 0..N-1,
//      and appends index N meaning NONE / NOT PRESENT.
//   2. The model is shown ONLY that numbered menu (never the raw open question) and asked for ONE
//      INTEGER INDEX, nothing else.
//   3. CODE maps the returned index back to the span it already holds; index N maps to null.
// The answer space is now a finite set of integers pointing at text that provably already exists in
// the source -- "price of oranges" cannot be produced because it is never a candidate when clause
// (a) never names a price. This leaves no blank for Korsakoff-style confabulation to fill.
//
// ENFORCEMENT IS TRIPLE, NOT SINGLE. (a) `format` -- verified against the installed Ollama 0.33.2
// with a raw curl probe before writing this code: `"format": {"type":"integer","enum":[...]}` is
// honored as true grammar-constrained decoding, not a hint -- proved by forcing an enum of
// semantically-impossible values ([5,7] against a 3-choice menu) and observing the model was still
// forced to emit only 5 or 7, never anything else, never prose. Every menu call below sends this
// field, built fresh per call from that call's own candidate count. (b) `num_predict` is cut to 6
// for every menu call (was 150) -- an index is at most two or three digits, 150 tokens was an
// invitation to write an essay, not a requirement for one, and this failure mode was never actually
// about running out of room. (c) `think: false` stays, top-level, no fallback, unchanged from
// before this fix. The pre-existing literal-substring check (isLiteralQuoteOf) is KEPT as a fourth,
// belt-and-braces layer even though every menu candidate is by construction already a literal
// substring of its source -- if it ever fails now, that is a bug in extractCandidateSpans(), not a
// model confabulation, and it still abstains rather than trusting a broken invariant.
//
// TWO DECISIONS PER SUB-PART, NOT ONE BUNDLED CALL. The pre-fix version asked CHANGE and PRICE-OF
// in a single prompt ("CHANGE: <..>\nPRICE-OF: <..>"), a mild violation of the Founder's own
// serialization rule ("Gemma has to do things serialized ... you cannot ask her to do more than one
// thing at a time," canonical_pipeline.ts precedent). This fix splits them into two separate menu
// calls per sub-part -- one decision, one index, one call -- which is stricter, not looser, than
// before.
//
// See D-BP213-XO-48_STRUCTURAL_EXTRACTION.md (BISHOP_DROPZONE) for the N=20 receipts against this
// method's founding example proving the NONE-index selection rate under this design.
//
// Rule 66 on this edit: the pre-fix version of this file is preserved at
// withheld_curve_shift_guard.ts.superseded.20260903T181100Z.ts before any of the above was applied.
//
// D-BP213-XO-51 PER-SUB-PART GOOD, dispatched after XO-48 closed the confabulation gate (20/20 ->
// 0/20 on the PRICE-OF menu). XO-48's own N=20 receipts against this method's founding example
// (question_id 7260 (internal qid 46), answer key G) showed the pipeline abstaining 20/20 at the
// FIRST gate, target-good extraction from the preamble -- not a bug in the menu machinery, a design
// error the structural fix exposed rather than caused. THE DEFECT: this file assumed one shared good
// is always named in the preamble before the first sub-part label. Question_id 7260's preamble reads
// only "Indicate whether the following economic events represent a change in supply or a change in
// quantity supplied" -- no good is nameable there at all. Each sub-part instead introduces its OWN
// good: (a) oranges, (b) gin and tonics, (c) leather shoes. The pre-fix code treated the preamble
// menu's honest NONE selection as a hard failure and abstained the whole question every time, even
// though every sub-part's own text names a perfectly good target good if only it were asked.
//
// THE FIX. Target-good extraction now runs TWICE per question in different roles:
//   (1) ONCE from the preamble, EXACTLY as before -- kept because a different question of this same
//       shape may genuinely name one shared good up front, and that case must not break. The only
//       change: a NONE selection here is no longer treated as a failure. It sets the preamble-level
//       good to null and the run CONTINUES -- NONE is a legitimate, common answer now, not grounds
//       to abstain the whole question.
//   (2) ONCE PER SUB-PART, new in this fix (subpartGoodInstruction()) -- the model is shown that one
//       sub-part's own clause text (never the whole question, never the option list) and asked, via
//       the same numbered-menu-plus-NONE machinery as every other extraction in this file, which
//       candidate names the good or market THAT CLAUSE is about.
// CODE then resolves one target good per sub-part with a fixed precedence: prefer the sub-part's own
// extracted good; if that sub-part's menu selects NONE, fall back to the preamble-level good (if the
// preamble named one); if BOTH are NONE, that one sub-part cannot be classified (no good to compare
// its price-of quote against) and the question abstains -- never a guess. This is exactly the
// "prefer per-sub-part, fall back to preamble" rule, decided by code, never the model.
//
// WHAT DID NOT CHANGE: the menu-plus-NONE shape, `format` grammar-constrained decoding, `num_predict`
// 6, `think: false` top-level with no fallback, one ask per call fully serialized, and the literal-
// substring verification (isLiteralQuoteOf) as a second check on every extraction -- all exactly as
// XO-48 proved them. The CHANGE and PRICE-OF extraction calls and the fixed same-good-price rule
// CODE applies afterward are also unchanged; only WHICH good quote that rule compares PRICE-OF
// against is now resolved per sub-part instead of being the single preamble-level quote.
//
// Rule 66 on this edit: the pre-fix version of this file is preserved at
// withheld_curve_shift_guard.ts.superseded.20260903T182554Z.ts before any of the above was applied.
//
// D-BP213-XO-58 CAUSAL-CONNECTOR CHANGE-GATE FIX, per Founder-scoped dispatch 2026-09-03. XO-54's
// abstention forensics (D-BP213-XO-54_ABSTENTION_FORENSICS.md) measured N=20 on question_id 7260
// (internal qid 46), gemma2:2b: G=9/20, ABSTAIN=11/20, WRONG=0/20 -- all 11 abstains byte-for-byte
// identical, all from the CHANGE gate on sub-part (b) ("The cost of limes increase. As a result, bar
// owners raise the price of gin and tonics."), the one clause naming TWO price-relevant phrases in
// one sentence pair. XO-54 triangulated: the zero-price clause (a) never stalls, the one-price clause
// (c) never stalls, and the downstream PRICE-OF gate facing this SAME two-price clause (b) resolves
// it correctly 9/9 of the time it is reached -- so the pipeline already knows which price is the
// good's own. The gap is one gate earlier: the CHANGE instruction (changeInstruction() below) asks
// the model to judge which of two named events is causally primary, with no structural signal in the
// menu pointing at the antecedent. THAT IS A JUDGMENT, forbidden to a local model under HARDWIRE-22
// ("A local model may only be asked to COPY OUT what is literally present ... THE CODE DECIDES.
// ALWAYS.").
//
// THE FIX. The signal is already sitting in the clause text: this question's three sub-parts each
// carry one causal connector -- (a) "Therefore,", (b) "As a result,", (c) "This induces". A connector
// mechanically splits a clause into an ANTECEDENT (everything before it, the cause) and a CONSEQUENT
// (the connector and everything after, the effect). findCausalSplit() below is a frozen, literal,
// case-insensitive search over a small closed list of seven connectors (the three this question uses
// plus obvious siblings: "as a result", "therefore", "thus", "consequently", "this induces", "so
// that", "which causes") -- no semantics, no model call, no judgment. When exactly one connector
// match is found and it is not inside an opened double-quote, CODE resolves CHANGE to be the
// antecedent segment DIRECTLY -- no model call is made for this decision at all, closing the
// HARDWIRE-22 violation outright rather than merely narrowing what the model is asked to judge. When
// NO connector is present, the pre-existing model-menu CHANGE flow runs completely unchanged (this is
// what keeps sub-parts of a differently-shaped question, and any clause with no causal connector,
// exactly as before -- no regression risk to a shape this fix does not touch). When MORE THAN ONE
// connector match is found (two distinct connectors, or the same connector twice), or a connector
// match falls inside an opened-but-unclosed double-quote span, the split is unresolvable literally
// and the sub-part ABSTAINS immediately rather than guessing which segment is the antecedent, per
// standing order: raising coverage by loosening the abstain threshold is forbidden, and an abstain is
// the honest answer whenever CODE cannot resolve the split mechanically.
//
// WHY THIS DOES NOT REGRESS (a) OR (c) (both already committed 20/20 and 9/9 under the old model-menu
// CHANGE flow, per XO-51/XO-54 receipts): the `change` quote produced by the CHANGE gate is NEVER
// read by the classification rule in the per-sub-part loop below (that rule compares priceOf against
// targetGoodQuote only) -- CHANGE exists purely as a "was a change nameable in this clause at all"
// gate plus a telemetry string. Since (a) and (c) both also carry a causal connector ("Therefore",
// "This induces"), this fix makes their CHANGE gate resolve deterministically in code (guaranteed
// non-abstain, never dependent on the model) rather than changing whether they commit.
//
// Rule 66 on this edit: the pre-fix version of this file is preserved at
// withheld_curve_shift_guard.ts.superseded.20260903T185743Z.ts before any of the above was applied.

// D-BP213-XO-65 CONNECTOR HARDENING, per Founder-scoped dispatch 2026-09-03. XO-63's zero-model
// detection sweep (BISHOP_DROPZONE\connector_coverage_sweep.mjs /
// D-BP213-XO-63_connector_sweep_results.json, full 12,032-row MMLU-Pro corpus, whole-`question`-
// field granularity) found "so that" as the single largest connector bucket (106 of 12,032 rows,
// 40% of every single-connector hit) and flagged two clean false positives at question_id 179 and
// question_id 121 (both business), where "so that" is the MATHEMATICAL "such that" sense ("P = ar +
// bW, so that : ..."; "income is 600, so that the desired change is 100"), not causation -- a
// causal antecedent/consequent split there is nonsense.
//
// THIS DISPATCH RE-PULLED ALL 103 "so that" single-connector rows (not just the 12 XO-63 sampled)
// and tested three literal structural guard candidates against them: (a) an equation/symbol
// immediately following the connector -- catches question_id 179 ("so that : P =ar+bW") but not
// question_id 121 ("so that the desired change is 100", no adjacent symbol) or question_id 860 /
// 840 (arithmetic and definitional "so that" clauses with no adjacent "=" either); (b) a preceding
// comma -- present before 102 of 103 hits, including both genuine causal purpose clauses ("gave
// adequate warning, so that nobody would be injured", question_id 1304/1586) and non-causal
// "such that" clauses (121, 179) alike, so it discriminates nothing; (c) category (business/math/
// physics/chemistry/engineering skew heavily "such that", law/history skew heavily genuine
// purpose) -- real skew, but question_id 688 and 7699 are counter-examples inside the "such that"-
// heavy categories, and this is a semantic correlation, not a literal rule, which the standing
// order forbids matching on. NO LITERAL STRUCTURAL RULE SEPARATES THE TWO SENSES OF "so that" IN
// THIS CORPUS. Per standing order ("a structural rule or nothing" / "a smaller list that is right
// beats a bigger one that is sometimes nonsense"), "so that" is REMOVED from CAUSAL_CONNECTORS
// below rather than guarded. This drops the sweep's single-connector "code-resolvable" bucket from
// 266 to 160 (-106) at whole-question granularity; see D-BP213-XO-65_CONNECTOR_HARDENING.md
// (BISHOP_DROPZONE) for the full before/after distribution and the leg-1 N=20 regression re-run.
//
// "this induces" (the founding example's own sub-part (c) connector, question_id 7260 / internal
// qid 46) was also examined: it appears exactly once in the full 12,032-row corpus, which raised
// the possibility it is a fixture carved from the one question this method was built on rather than
// a genuine general connector. RULING: KEPT, unlike "so that" -- "induce" is not polysemous the way
// "so" is ("so that" collapses two distinct logical relations, purpose/result vs. mathematical
// "such that"; "induce" means only "cause, bring about" in every ordinary and technical English
// usage this dispatch could find, including its common physics sense "the changing field induces a
// current," which is still causal). A single occurrence is weak evidence of GENERALITY (this
// dispatch cannot claim "this induces" is common), but it is not weak evidence of CORRECTNESS: every
// match it makes is unambiguously causal by construction of the phrase itself, so it carries none of
// "so that"'s false-positive risk. Recorded plainly for the record: it entered this list because it
// is this method's own founding example's connector, not because a broader corpus survey found it
// independently -- kept on the strength of its own unambiguous meaning, not on frequency.
//
// Rule 66 on this edit: the pre-fix version of this file is preserved at
// withheld_curve_shift_guard.ts.superseded.20260903T192613Z.ts before any of the above was applied.

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput, MethodRunContext, ShapeTestResult } from '../method_registry';
import type { LianaTerminalOutcome } from '../../../shared/liana_cycle/liana_terminal_types';
import { recordLlmCall } from '../cost_instrument';
import { resolveGemmaModelDigest, GEMMA_NUM_CTX_RUN_CAP } from './comparative_cascade';
import os from 'node:os';

const OLLAMA_API_BASE = process.env.OLLAMA_API_BASE ?? 'http://127.0.0.1:11434';
// Same env-overridable model tag convention every sibling gemma-calling method uses.
const MODEL = process.env.CASCADE_MODEL ?? 'gemma4:12b';

function nowIso(): string {
  return new Date().toISOString();
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// SHAPE DETECTION HELPERS -- pure, no I/O, shared by shapeTest() and run() so the two never
// disagree. Re-implemented here (not imported from anchored_lookup_guard.ts) so the disabled old
// file is never touched by this dispatch -- the masking/tuple machinery is the same discipline,
// independently written so this file has no dependency on a file that is deliberately unregistered.
// ─────────────────────────────────────────────────────────────────────────────────────────────

// D-BP213-XO-47 FIX 1 (root cause 1, D-BP213-XO-46_LEG1_DETERMINISM.md / D-BP213-XO-36_LEG1_BLIND_TEST.md):
// the original alternative only matched a PARENTHESIZED label ("(a)"). This dataset's actual
// "stemez" corpus phrasing (question_id 46 / source_id 7260, this method's own founding example)
// writes sub-part labels bare, "a) ... b) ... c) ...", with no opening paren at all -- zero labels
// were ever found on that question. The second alternative below accepts the bare form too, but
// ONLY letters (matching the char class already used for the parenthesized letter case -- roman
// numerals and bare digits are NOT added, since they are not evidenced anywhere in this corpus and
// widening past what the founding example requires would just be a new, undemonstrated risk of
// matching a stray "x)" in ordinary prose). The bare form is anchored to a real sentence/line
// boundary (start of string, or immediately after ". " or a newline) so it cannot fire on a close
// paren buried mid-sentence (e.g. "...see part a) of the note..." would still miss unless that
// literally follows a period). group 1 = parenthesized label; group 2 = the boundary text consumed
// before a bare label (empty for start-of-string, else the 2 boundary characters); group 3 = the
// bare label letter.
const SUBPART_LABEL_RE = /\(([a-hA-H]|[ivx]{1,4}|[1-9])\)|(^|[.\n]\s)([a-hA-H])\)/g;

interface SubpartLabelMatch {
  label: string;
  index: number;
}

function findSubpartLabels(question: string): SubpartLabelMatch[] {
  const out: SubpartLabelMatch[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  SUBPART_LABEL_RE.lastIndex = 0;
  while ((m = SUBPART_LABEL_RE.exec(question)) !== null) {
    let label: string;
    let index: number;
    if (m[1] !== undefined) {
      // parenthesized form, e.g. "(a)" -- label starts at the opening paren, same as before this fix.
      label = m[1].toLowerCase();
      index = m.index;
    } else {
      // bare form, e.g. "a)" anchored to a sentence/line boundary -- the boundary text (m[2]) was
      // consumed by the match too, so the label itself starts after it, not at m.index.
      label = m[3].toLowerCase();
      index = m.index + (m[2] ? m[2].length : 0);
    }
    if (!seen.has(label)) {
      seen.add(label);
      out.push({ label, index });
    }
  }
  return out;
}

/** The shared preamble is everything BEFORE the first sub-part label -- this is the only text the
 *  target-good extraction call ever sees. */
function extractPreamble(question: string, labels: SubpartLabelMatch[]): string {
  if (labels.length === 0) return question;
  const first = [...labels].sort((a, b) => a.index - b.index)[0];
  return question.slice(0, first.index).trim();
}

function extractSubpartTexts(question: string, labels: SubpartLabelMatch[]): { label: string; text: string }[] {
  const sorted = [...labels].sort((a, b) => a.index - b.index);
  return sorted.map((lbl, i) => {
    const start = lbl.index;
    const end = i + 1 < sorted.length ? sorted[i + 1].index : question.length;
    return { label: lbl.label, text: question.slice(start, end).trim() };
  });
}

function splitOptionIntoTuple(optionText: string): string[] {
  return optionText
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// D-BP213-XO-47 FIX 2 (root cause 2, D-BP213-XO-46_LEG1_DETERMINISM.md): every option row in the
// founding example is formatted "a) Change in supply, b) Change in supply, c) Change in quantity
// supplied" -- the original normalizeClause() never stripped the leading "a) " sub-part label, so
// the clause value stayed "a) change in supply" forever, which can never equal a bare vocabulary
// word. Fixing only the label strip is not sufficient by itself: this corpus also always wraps the
// axis word in the literal boilerplate "Change in ", so "b) Change in supply" strips down to
// "change in supply", still not a member of SUPPLY_FAMILY/DEMAND_FAMILY (which hold the bare words
// 'supply'/'quantity supplied'/'demand'/'quantity demanded'). Both strips are fixed, literal
// prefixes actually present in the dataset text (confirmed by reading question_id 46 / source_id
// 7260 off questions.jsonl directly, not inferred) -- neither is a fuzzy/semantic match, so this
// does not cross into the "model classifies" territory this file exists to avoid.
function normalizeClause(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^\(?[a-h]\)\s*/, '')
    .replace(/^change in\s+/, '')
    .replace(/[."'‘’“”]+$/g, '')
    .replace(/^[."'‘’“”]+/g, '');
}

function tuplesExactlyEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (normalizeClause(a[i]) !== normalizeClause(b[i])) return false;
  }
  return true;
}

/** Normalizes free text for a LITERAL (not fuzzy) substring/entity comparison: lowercase, collapse
 *  whitespace, strip a leading article. Still requires the normalized needle to appear as a
 *  substring of the normalized haystack (or vice versa) -- never a semantic/synonym match. */
function normalizeForEntityMatch(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^(the|a|an)\s+/, '')
    .replace(/[."'‘’“”]+$/g, '')
    .replace(/^[."'‘’“”]+/g, '');
}

/** MECHANICAL, literal (normalized) substring check -- the runtime enforcement of "the model may
 *  only copy out what is literally present." quote must appear, whitespace/case-normalized, inside
 *  sourceText. This is NOT a semantic check; a paraphrase fails it by design. */
function isLiteralQuoteOf(quote: string, sourceText: string): boolean {
  const q = quote.toLowerCase().replace(/\s+/g, ' ').trim().replace(/^["'‘’“”]+|["'‘’“”]+$/g, '');
  const src = sourceText.toLowerCase().replace(/\s+/g, ' ');
  if (q.length === 0) return false;
  return src.includes(q);
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// STRUCTURAL EXTRACTION (D-BP213-XO-48) -- pure, no I/O. Turns every "quote a span" decision into
// "pick an index from a menu CODE already built from literal substrings of the source." No
// function here ever sends free text to the model asking it to produce a quote; see the header
// comment above for why (Founder order 2026-09-03T17:56:46Z, "structural way to enforce" no-prose).
// ─────────────────────────────────────────────────────────────────────────────────────────────

/** Mechanically enumerates candidate literal spans from `text`: a handful of fixed, literal
 *  patterns this corpus actually uses ("price of X", "X's price/cost", "market for X"), plus a
 *  sentence-boundary split, plus a comma/semicolon clause split, plus a preposition-boundary split
 *  (to surface shorter noun-phrase-shaped fragments, e.g. "the orange crop"), plus a conjunction
 *  split (only if the above yielded few candidates), plus the whole text as a last-resort
 *  fallback. Every entry is, by construction, already a literal substring of `text` -- this
 *  function never invents or paraphrases anything, it only slices. Capped at 10 entries so the
 *  `format` enum handed to Ollama stays small. This is NOT a claim of general noun-phrase parsing;
 *  it is the same "narrow, disclosed, corpus-fitted rule" discipline as normalizeClause()'s
 *  label/prefix strips above -- widening it beyond what a real example demonstrates would just be
 *  a new, undemonstrated risk.
 *
 *  D-BP213-XO-48 FIX (found while proving this file, not part of the original dispatch scope): the
 *  first version of this function capped every candidate at 80 characters with NO sentence split,
 *  so a two-sentence, no-comma clause (this method's own founding example, sub-part (a): "Cold
 *  weather in Florida destroys a great deal of the orange crop. Therefore there are fewer oranges
 *  in the country's supermarkets.") produced ZERO candidates -- the menu's only entry was NONE,
 *  making a 20/20 NONE result meaningless (the model had no real alternative to reject). Fixed by
 *  adding the sentence and preposition splits below and raising the per-candidate cap to 200; see
 *  D-BP213-XO-48_STRUCTURAL_EXTRACTION.md for the before/after receipts. This is a correctness fix
 *  to make the menu non-degenerate, not a tune toward a better-looking number -- the fixed version
 *  is run against the SAME N=20 proof, reported honestly either way. */
function extractCandidateSpans(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (raw: string): void => {
    const t = raw.trim().replace(/^[."'‘’“”(]+|[.,;:"'‘’“”)]+$/g, '').trim();
    if (t.length === 0 || t.length > 200) return;
    const key = t.toLowerCase().replace(/\s+/g, ' ');
    if (seen.has(key)) return;
    seen.add(key);
    out.push(t);
  };

  const STOP = '(?:[,.;:]|$| and | or | which | that | while | when | if | because | so | as | to )';
  const ofRe = new RegExp(`\\b(?:price|cost)\\s+of\\s+([a-zA-Z][a-zA-Z0-9 '\\-]{0,60}?)(?=${STOP})`, 'gi');
  const possRe = /\b([A-Za-z][a-zA-Z0-9 '\-]{0,60}?)'s\s+(?:price|cost)\b/gi;
  const marketRe = new RegExp(`\\bmarket\\s+for\\s+([a-zA-Z][a-zA-Z0-9 '\\-]{0,60}?)(?=${STOP})`, 'gi');

  let m: RegExpExecArray | null;
  ofRe.lastIndex = 0;
  while ((m = ofRe.exec(text)) !== null) add(m[1]);
  possRe.lastIndex = 0;
  while ((m = possRe.exec(text)) !== null) add(m[1]);
  marketRe.lastIndex = 0;
  while ((m = marketRe.exec(text)) !== null) add(m[1]);

  // Sentence-boundary split -- catches multi-sentence clauses with no commas at all (the founding
  // example's sub-part (a), see fix note above).
  for (const part of text.split(/(?<=[.!?])\s+/)) add(part);
  // Comma/semicolon clause split.
  for (const part of text.split(/[,;]/)) add(part);
  // Preposition-boundary split, per sentence -- surfaces shorter noun-phrase-shaped fragments
  // (e.g. "the orange crop", "the country's supermarkets") from the same fixed, literal slice
  // discipline, never a semantic parse.
  for (const sentence of text.split(/(?<=[.!?])\s+/)) {
    for (const part of sentence.split(/\b(?:in|of|to|from|with|for)\b/i)) add(part);
  }
  if (out.length < 6) {
    for (const part of text.split(/\band\b|\bor\b/i)) add(part);
  }
  add(text);

  return out.slice(0, 10);
}

// D-BP213-XO-58: frozen, literal, closed list of causal connectors -- the three this method's own
// founding example uses ("as a result", "therefore", "this induces") plus obvious siblings ("thus",
// "consequently", "which causes"). Deliberately small and literal, per standing order -- no bare
// "so" (too broad, matches far too much ordinary prose to be a reliable antecedent/consequent
// signal) and no reach for anything semantic. Lowercase; matched case-insensitively below.
//
// D-BP213-XO-65: "so that" REMOVED (was here from XO-58 through the previous supersede sibling of
// this file). It is genuinely polysemous in this corpus -- purpose/result ("gave warning so that
// nobody would be injured") versus mathematical "such that" ("P = ar + bW, so that : ...", "so that
// the desired change is 100") -- and no literal structural rule (adjacent equation, preceding
// comma, category) reliably separates the two senses; see the file-header block near the top of
// this file (search "D-BP213-XO-65 CONNECTOR HARDENING") for the full test-and-reject record against
// question_id 179, 121, 860, 840, and the other 99 "so that" rows this dispatch pulled. A wrong
// split here would have fed a wrong "change" quote into the CHANGE gate silently -- removed rather
// than guarded, per "a smaller list that is right beats a bigger one that is sometimes nonsense."
const CAUSAL_CONNECTORS: readonly string[] = [
  'as a result',
  'therefore',
  'thus',
  'consequently',
  'this induces',
  'which causes',
];

interface CausalSplit {
  connector: string;
  antecedent: string;
  consequent: string;
}

/** Trims the same leading/trailing punctuation extractCandidateSpans()'s add() strips, so a
 *  code-resolved antecedent/consequent span looks like every other span this file ever produces. */
function trimSpanPunctuation(raw: string): string {
  return raw.trim().replace(/^[."'‘’“”(]+|[.,;:"'‘’“”)]+$/g, '').trim();
}

/** Mechanically resolves antecedent (cause) versus consequent (effect) for one clause, from the
 *  frozen CAUSAL_CONNECTORS list alone -- a literal, case-insensitive substring search, never a
 *  model call, never a semantic judgment (HARDWIRE-22: "THE CODE DECIDES. ALWAYS.").
 *
 *  Returns:
 *    - `null` when the clause names NO connector from the list -- the caller must fall back to the
 *      pre-existing model-menu CHANGE flow, completely unchanged, exactly as before this fix.
 *    - `'ambiguous'` when the clause carries MORE THAN ONE connector match (two distinct connectors,
 *      or the same connector appearing twice), or when the one match found falls inside an
 *      opened-but-not-yet-closed double-quote span -- either case is not literally resolvable, and
 *      per standing order the caller must ABSTAIN rather than guess which segment is the antecedent.
 *      (Single straight-quote apostrophes, e.g. "country's", "bar owners'", are deliberately NOT
 *      treated as quote-open/close markers here -- they are far too common in ordinary possessive/
 *      contraction English and would false-trigger 'ambiguous' on clauses that carry no real
 *      quotation at all, e.g. this method's own founding example sub-part (a) which contains
 *      "country's supermarkets" and must not be made to abstain by this guard.)
 *    - `{ connector, antecedent, consequent }` when exactly one unambiguous match is found: a
 *      word-boundary-checked, case-insensitive match of one connector, not inside an open double
 *      quote. `antecedent` is the clause text strictly before the connector (trimmed); `consequent`
 *      is the connector itself plus everything after it (trimmed). Both are, by construction, already
 *      literal substrings of the input clause. */
function findCausalSplit(text: string): CausalSplit | 'ambiguous' | null {
  const lower = text.toLowerCase();
  const hits: { connector: string; start: number; end: number }[] = [];
  for (const conn of CAUSAL_CONNECTORS) {
    let searchFrom = 0;
    for (;;) {
      const idx = lower.indexOf(conn, searchFrom);
      if (idx === -1) break;
      // Word-boundary check on both ends so e.g. "thus" never matches inside a longer word (there is
      // no such word in this corpus's connector set, but the check costs nothing and closes the risk).
      const beforeCh = idx > 0 ? text[idx - 1] : '';
      const afterCh = idx + conn.length < text.length ? text[idx + conn.length] : '';
      const beforeOk = beforeCh === '' || !/[a-zA-Z0-9]/.test(beforeCh);
      const afterOk = afterCh === '' || !/[a-zA-Z0-9]/.test(afterCh);
      if (beforeOk && afterOk) {
        hits.push({ connector: conn, start: idx, end: idx + conn.length });
      }
      searchFrom = idx + conn.length;
    }
  }
  if (hits.length === 0) return null;
  if (hits.length > 1) return 'ambiguous';

  const hit = hits[0];
  // Quotation guard -- double quotes only (straight or curly), never a bare apostrophe; see the
  // function-level comment above for why apostrophes are excluded. An odd count of double-quote
  // characters strictly before the connector means it sits inside an opened-but-unclosed quotation.
  const DOUBLE_QUOTE_RE = /["“”]/g;
  const before = text.slice(0, hit.start);
  const quoteCount = (before.match(DOUBLE_QUOTE_RE) ?? []).length;
  if (quoteCount % 2 !== 0) return 'ambiguous';

  const antecedent = trimSpanPunctuation(text.slice(0, hit.start));
  const consequent = trimSpanPunctuation(text.slice(hit.start));
  if (antecedent.length === 0 || consequent.length === 0) return 'ambiguous';
  return { connector: hit.connector, antecedent, consequent };
}

/** Builds the menu prompt: the instruction plus every candidate numbered 0..N-1, plus a final
 *  mandatory `noneLabel` entry at index N. The model is asked for exactly one integer, nothing
 *  else -- no quote, no explanation, no punctuation. */
function buildMenuPrompt(instruction: string, candidates: string[], noneLabel: string): string {
  const lines = candidates.map((c, i) => `${i}: ${c}`);
  const noneIndex = candidates.length;
  lines.push(`${noneIndex}: ${noneLabel}`);
  return `${instruction}\n\nOptions:\n${lines.join('\n')}\n\n` +
    'Respond with ONLY the number of the option you choose. No words, no punctuation, no ' +
    'explanation -- a single integer and nothing else.';
}

/** The `format` field sent to Ollama for a menu call: a JSON-schema integer enum spanning exactly
 *  the valid indices (0..candidateCount inclusive, candidateCount itself being the NONE index).
 *  Verified against the installed Ollama 0.33.2 by raw curl probe before this file was written:
 *  this is genuine grammar-constrained decoding, not an ignored hint (see header comment). */
function menuFormatSchema(candidateCount: number): { type: 'integer'; enum: number[] } {
  const values: number[] = [];
  for (let i = 0; i <= candidateCount; i += 1) values.push(i);
  return { type: 'integer', enum: values };
}

/** Parses a menu response defensively -- `format` already constrains the model, but this file
 *  trusts nothing from Ollama without also checking it in code (same discipline as
 *  isLiteralQuoteOf). Returns null on anything that is not a single in-range integer. */
function parseMenuIndex(text: string, maxIndex: number): number | null {
  const trimmed = text.trim();
  if (!/^-?\d+$/.test(trimmed)) return null;
  const n = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(n) || n < 0 || n > maxIndex) return null;
  return n;
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// AXIS DETECTION -- pure, no I/O. Determines whether this question's option vocabulary is a clean
// single-axis subset of {supply, quantity supplied} or {demand, quantity demanded}. Runs entirely
// from option text; no model call, no candidate tuple exists yet to anchor on.
// ─────────────────────────────────────────────────────────────────────────────────────────────

type Axis = { shiftWord: string; quantityWord: string } | null;

const SUPPLY_FAMILY = new Set(['supply', 'quantity supplied']);
const DEMAND_FAMILY = new Set(['demand', 'quantity demanded']);
// D-BP213-XO-47 FIX 2 (continued): the founding example's own option rows use "None of the above"
// as a per-sub-part distractor value in 4 of its 10 rows (e.g. "a) None of the above, b) Change in
// supply, c) Change in quantity supplied"). That phrase carries zero axis information -- it is a
// universal MCQ distractor, not a third axis -- so it is excluded from the vocabulary this method
// reads its axis from, rather than being (wrongly) treated as "an unrecognized clause" that forces
// a refusal on a row that is otherwise clean single-axis vocabulary. This is the SAME literal-string
// discipline as SUPPLY_FAMILY/DEMAND_FAMILY: an exact match against normalized text actually present
// in the dataset, never a semantic guess.
const NEUTRAL_CLAUSES = new Set(['none of the above']);

function detectAxis(optionValues: string[], requiredArity: number): { axis: Axis; reason: string } {
  const clauseSet = new Set<string>();
  for (const v of optionValues) {
    const tuple = splitOptionIntoTuple(v);
    if (tuple.length !== requiredArity) continue;
    for (const clause of tuple) {
      const norm = normalizeClause(clause);
      if (NEUTRAL_CLAUSES.has(norm)) continue;
      clauseSet.add(norm);
    }
  }
  if (clauseSet.size === 0) {
    return { axis: null, reason: 'no tuple-shaped option rows at the required arity to read a vocabulary from' };
  }
  const isSupplyOnly = [...clauseSet].every((c) => SUPPLY_FAMILY.has(c));
  const isDemandOnly = [...clauseSet].every((c) => DEMAND_FAMILY.has(c));
  if (isSupplyOnly) {
    return { axis: { shiftWord: 'supply', quantityWord: 'quantity supplied' }, reason: 'option vocabulary is a clean subset of {supply, quantity supplied}' };
  }
  if (isDemandOnly) {
    return { axis: { shiftWord: 'demand', quantityWord: 'quantity demanded' }, reason: 'option vocabulary is a clean subset of {demand, quantity demanded}' };
  }
  const mixed = [...clauseSet].some((c) => SUPPLY_FAMILY.has(c)) && [...clauseSet].some((c) => DEMAND_FAMILY.has(c));
  return {
    axis: null,
    reason: mixed
      ? `option clause vocabulary mixes supply-family and demand-family terms (${[...clauseSet].join(', ')}) -- ` +
        'this method targets a single fixed axis per question and refuses rather than guessing which ' +
        'axis a mixed vocabulary intends'
      : `option clause vocabulary (${[...clauseSet].join(', ')}) is outside the closed set this method ` +
        'targets ({supply, quantity supplied} or {demand, quantity demanded}) -- refuses rather than ' +
        'force-fitting an unrelated domain',
  };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// shapeTest -- THE TRIGGER. Pure, no I/O, never reads input.correctAnswer.
// ─────────────────────────────────────────────────────────────────────────────────────────────

function shapeTest(input: MethodQuestionInput): ShapeTestResult {
  if (!input.options || Object.keys(input.options).length < 2) {
    return {
      matches: false,
      reason: 'no lettered option list with >=2 rows -- this method is a mechanical row-by-row ' +
        'lookup for the LETTER only, after classification is already fully decided by code; it ' +
        'needs option rows to look the decided tuple up against.',
    };
  }

  const question = input.question || '';
  const labels = findSubpartLabels(question);
  if (labels.length < 2) {
    return {
      matches: false,
      reason: `only ${labels.length} distinct sub-part label(s) found in the stem -- this method ` +
        'targets a COMPOUND stem requiring two or more independently classified sub-parts; a ' +
        'single-part question is out of scope, refused rather than force-fit.',
    };
  }

  const optionValues = Object.values(input.options);
  const tupleShapedCount = optionValues.filter((v) => splitOptionIntoTuple(v).length === labels.length).length;
  const tupleShapedFraction = tupleShapedCount / optionValues.length;
  if (tupleShapedFraction < 0.5) {
    return {
      matches: false,
      reason: `stem has ${labels.length} sub-part labels, but only ${tupleShapedCount} of ` +
        `${optionValues.length} option rows split into exactly ${labels.length} clauses -- option ` +
        'rows are not consistently tuple-shaped, refuses rather than guessing a false structural match.',
    };
  }

  const { axis, reason: axisReason } = detectAxis(optionValues, labels.length);
  if (!axis) {
    return {
      matches: false,
      reason: `axis detection failed: ${axisReason} -- this is this method's OWN narrowed scope ` +
        '(supply/demand shift-vs-quantity questions only, per D-BP213-XO-41_LEG1_REAIMED.md section 7), ' +
        'not a general compound-tuple classifier; refuses honestly rather than claiming a breadth it ' +
        'cannot back with a verified, code-owned rule.',
    };
  }

  return {
    matches: true,
    reason: `${labels.length} distinct sub-part labels found and ${tupleShapedCount}/${optionValues.length} ` +
      `option rows are tuple-shaped at matching arity; axis detected as {${axis.shiftWord}, ` +
      `${axis.quantityWord}} (${axisReason}) -- eligible for the withheld same-good-price rule, ` +
      'classification decided entirely by code from verified literal extractions, options revealed ' +
      'only for the final letter lookup.',
  };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// The masked extraction calls -- pure copy-out, never a classification, never shown the option
// list. One call for the target good, one call PER sub-part, all serial (never bundled).
// ─────────────────────────────────────────────────────────────────────────────────────────────

interface ModelCallResult {
  ok: boolean;
  text: string | null;
  detail?: string;
}

async function callModelExtraction(
  prompt: string,
  callOpts?: { format?: { type: 'integer'; enum: number[] }; numPredict?: number },
): Promise<ModelCallResult> {
  const tsStart = nowIso();
  const t0 = Date.now();
  const modelDigest = await resolveGemmaModelDigest(MODEL);
  let res: Response;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);
    res = await fetch(`${OLLAMA_API_BASE}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        prompt,
        stream: false,
        think: false,
        // D-BP213-XO-48: `format` is the grammar-constrained-decoding enforcement layer, present
        // on every menu-index call (see menuFormatSchema()); `num_predict` is cut from the old
        // free-prose 150 down to whatever the call needs for an integer (menu calls pass 6).
        // Neither is a silent default -- a call that omits `format` (there are none left in this
        // file as of this fix) would fall through to no schema, never a guessed one.
        ...(callOpts?.format ? { format: callOpts.format } : {}),
        options: {
          temperature: 0.2,
          num_predict: callOpts?.numPredict ?? 150,
          num_ctx: GEMMA_NUM_CTX_RUN_CAP,
        },
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));
  } catch (err) {
    const detail = `transport failure, no HTTP response received: ${err instanceof Error ? err.message : String(err)}`;
    recordLlmCall({
      model: MODEL,
      modelDigest,
      machineId: os.hostname(),
      ts_start: tsStart,
      ts_end: nowIso(),
      latency_ms: Date.now() - t0,
      tokens: { measured: false, reason: detail },
    });
    return { ok: false, text: null, detail };
  }
  if (res.ok === false) {
    const detail = `HTTP ${res.status} error response from Ollama`;
    recordLlmCall({
      model: MODEL,
      modelDigest,
      machineId: os.hostname(),
      ts_start: tsStart,
      ts_end: nowIso(),
      latency_ms: Date.now() - t0,
      tokens: { measured: false, reason: detail },
    });
    return { ok: false, text: null, detail };
  }
  try {
    const j = (await res.json()) as { response?: string; prompt_eval_count?: number; eval_count?: number };
    const hasCounts = typeof j.prompt_eval_count === 'number' && typeof j.eval_count === 'number';
    recordLlmCall({
      model: MODEL,
      modelDigest,
      machineId: os.hostname(),
      ts_start: tsStart,
      ts_end: nowIso(),
      latency_ms: Date.now() - t0,
      tokens: hasCounts
        ? { measured: true, input_tokens: j.prompt_eval_count as number, output_tokens: j.eval_count as number }
        : { measured: false, reason: 'Ollama response body did not include prompt_eval_count/eval_count fields' },
    });
    const text = (j.response ?? '').trim();
    if (text.length === 0) {
      return { ok: false, text: null, detail: 'Ollama returned an empty response field' };
    }
    return { ok: true, text };
  } catch (err) {
    const detail = `res.json() itself threw, body was not JSON: ${err instanceof Error ? err.message : String(err)}`;
    recordLlmCall({
      model: MODEL,
      modelDigest,
      machineId: os.hostname(),
      ts_start: tsStart,
      ts_end: nowIso(),
      latency_ms: Date.now() - t0,
      tokens: { measured: false, reason: detail },
    });
    return { ok: false, text: null, detail };
  }
}

// D-BP213-XO-48: these three build MENU prompts (see extractCandidateSpans/buildMenuPrompt above),
// never a free-text quote request. Each returns the exact instruction text; the candidate list and
// NONE label are supplied by the caller in run() so the same buildMenuPrompt() shape is used
// uniformly for all three decisions.

function targetGoodInstruction(preamble: string): string {
  return 'Below is the shared setup of a multi-part economics question. Which numbered option is ' +
    'the name of the single good or market this question analyzes (for example: "oranges", "gin ' +
    'and tonics", "leather shoes")? Pick the single best match; do not combine options.\n\n' +
    `Text:\n${preamble}`;
}

// D-BP213-XO-51: per-sub-part good extraction, same menu-plus-NONE shape as targetGoodInstruction()
// above but scoped to ONE sub-part's own clause text, never the preamble, never the option list.
// NONE is an expected, legitimate answer here (a sub-part need not restate a good already named
// elsewhere) -- CODE, not this instruction, decides what to do about a NONE result.
function subpartGoodInstruction(clauseText: string): string {
  return 'Below is one clause (one labeled sub-part) of a multi-part economics question. Which ' +
    'numbered option is the name of the single good or market THIS CLAUSE is about (for example: ' +
    '"oranges", "gin and tonics", "leather shoes")? If this clause does not name any good or ' +
    'market of its own, choose the NONE option. Pick the single best match; do not combine options.\n\n' +
    `Clause:\n${clauseText}`;
}

function changeInstruction(clauseText: string): string {
  return 'Below is one clause of an economics question. Which numbered option is the shortest ' +
    'phrase naming WHAT CHANGED (the cause) in this clause? Pick the single best match; do not ' +
    'combine options.\n\n' +
    `Clause:\n${clauseText}`;
}

function priceOfInstruction(clauseText: string): string {
  return 'Below is the same clause again. If the clause states that a PRICE or a COST changed, ' +
    'which numbered option is the exact noun phrase naming WHOSE price or cost it is? If no price ' +
    'or cost is mentioned anywhere in this clause, choose the NONE option.\n\n' +
    `Clause:\n${clauseText}`;
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// run -- CODE decides everything past extraction. NEVER reads input.correctAnswer.
// ─────────────────────────────────────────────────────────────────────────────────────────────

async function run(input: MethodQuestionInput, ctx: MethodRunContext): Promise<LianaTerminalOutcome> {
  const question = input.question || '';
  const options = input.options || {};

  try {
    const labels = findSubpartLabels(question);
    const subparts = extractSubpartTexts(question, labels);
    const requiredLabels = subparts.map((s) => s.label);
    const preamble = extractPreamble(question, labels);

    const { axis } = detectAxis(Object.values(options), requiredLabels.length);
    if (!axis) {
      // shapeTest should have refused before run() was ever called; defensive re-check.
      return {
        question,
        verdict: null,
        abstain: true,
        freeText: false,
        method: 'withheld-curve-shift-guard',
        basis: 'axis re-check inside run() failed even though shapeTest passed -- refuses rather ' +
          'than assuming the earlier gate; should not happen, flagged for investigation if seen.',
      };
    }

    ctx.emit({
      kind: 'stage',
      text: `   withheld-curve-shift-guard: axis = {${axis.shiftWord}, ${axis.quantityWord}} ` +
        '(from option vocabulary only, options still masked from any classification step)',
      ts: nowIso(),
    });

    // Step 1: target-good extraction, ONCE, from the preamble only -- MENU, never free text.
    // D-BP213-XO-48: CODE builds the candidate list; the model returns one index; CODE maps it
    // back. "NONE / NOT PRESENT" is always the last entry so a genuinely un-nameable good is a
    // real, structurally-available answer, not an implicit forced guess.
    ctx.emit({
      kind: 'stage',
      text: '   withheld-curve-shift-guard: extracting target good/market name from preamble via ' +
        'numbered menu (options masked, free-text quoting disabled per D-BP213-XO-48)',
      ts: nowIso(),
    });
    const goodCandidates = extractCandidateSpans(preamble);
    const goodResp = await callModelExtraction(
      buildMenuPrompt(targetGoodInstruction(preamble), goodCandidates, 'NONE / NOT PRESENT (no good or market is nameable from the options above)'),
      { format: menuFormatSchema(goodCandidates.length), numPredict: 6 },
    );
    if (!goodResp.ok || !goodResp.text) {
      return {
        question,
        verdict: null,
        abstain: true,
        freeText: false,
        method: 'withheld-curve-shift-guard',
        basis: `target-good menu call failed before any classification could run: ${goodResp.detail ?? 'unknown failure'}`,
      };
    }
    const goodIdx = parseMenuIndex(goodResp.text, goodCandidates.length);
    if (goodIdx === null) {
      return {
        question,
        verdict: null,
        abstain: true,
        freeText: false,
        method: 'withheld-curve-shift-guard',
        basis: `target-good menu response "${goodResp.text}" was not a single in-range integer ` +
          `(0..${goodCandidates.length}) despite format-constrained decoding -- refused rather than guessing.`,
      };
    }
    // D-BP213-XO-51: a NONE selection here is NO LONGER an abstain-the-whole-question failure -- see
    // header comment. It means the preamble does not name a shared good (true, by construction, of
    // this method's own founding example, question_id 7260 / internal qid 46), and each sub-part
    // will be asked for its OWN good below. `preambleGoodQuote` is the fallback a sub-part falls
    // back to only if that sub-part's own extraction also comes back NONE.
    let preambleGoodQuote: string | null = null;
    if (goodIdx === goodCandidates.length) {
      ctx.emit({
        kind: 'fact',
        text: `   withheld-curve-shift-guard target good (menu index ${goodIdx}/${goodCandidates.length}): ` +
          'NONE -- preamble names no shared good; each sub-part will be asked for its own good below, ' +
          'falling back to this NONE only if a sub-part also comes back NONE.',
        ts: nowIso(),
      });
    } else {
      preambleGoodQuote = goodCandidates[goodIdx];
      // Belt-and-braces (see header comment): by construction this is already a literal substring of
      // preamble. A failure here means extractCandidateSpans() has a bug, not a model confabulation.
      if (!isLiteralQuoteOf(preambleGoodQuote, preamble)) {
        return {
          question,
          verdict: null,
          abstain: true,
          freeText: false,
          method: 'withheld-curve-shift-guard',
          basis: `INTERNAL INVARIANT FAILURE: menu candidate "${preambleGoodQuote}" (index ${goodIdx}) ` +
            `is not a literal substring of its own source preamble -- extractCandidateSpans() bug, ` +
            `not a model error. Preamble: "${preamble}"`,
        };
      }
      ctx.emit({
        kind: 'fact',
        text: `   withheld-curve-shift-guard target good (menu index ${goodIdx}/${goodCandidates.length}, ` +
          `verified literal): "${preambleGoodQuote}" -- shared-good candidate, used as fallback for any ` +
          'sub-part whose own good extraction comes back NONE.',
        ts: nowIso(),
      });
    }

    // Step 2: per-sub-part extraction, serially, TWO separate menu calls per sub-part (CHANGE,
    // then PRICE-OF) -- one decision per call, per the Founder's serialization rule, stricter than
    // the pre-fix single bundled call.
    const tuple: string[] = [];
    // D-BP213-XO-51: tracks the resolved good per sub-part (and its source) purely for the final
    // success basis text below -- `targetGoodQuote` itself is scoped to one loop iteration since it
    // can now differ per sub-part, so nothing outside the loop can read it directly any more.
    const resolvedGoods: { label: string; quote: string; source: string }[] = [];
    for (const sp of subparts) {
      // D-BP213-XO-51: per-sub-part good extraction, FIRST, before CHANGE/PRICE-OF -- resolves the
      // one good this sub-part's own PRICE-OF quote will be compared against. Same menu-plus-NONE
      // machinery, same literal-substring belt-and-braces check, as every other extraction here.
      ctx.emit({
        kind: 'stage',
        text: `   withheld-curve-shift-guard: extracting the good/market for sub-part (${sp.label}) ` +
          'via numbered menu (options masked, own clause text only)',
        ts: nowIso(),
      });
      const subpartGoodCandidates = extractCandidateSpans(sp.text);
      const subpartGoodResp = await callModelExtraction(
        buildMenuPrompt(
          subpartGoodInstruction(sp.text),
          subpartGoodCandidates,
          'NONE / NOT PRESENT (this clause does not name its own good or market)',
        ),
        { format: menuFormatSchema(subpartGoodCandidates.length), numPredict: 6 },
      );
      if (!subpartGoodResp.ok || !subpartGoodResp.text) {
        return {
          question,
          verdict: null,
          abstain: true,
          freeText: false,
          method: 'withheld-curve-shift-guard',
          basis: `sub-part (${sp.label}) good-extraction menu call failed: ${subpartGoodResp.detail ?? 'unknown failure'}`,
        };
      }
      const subpartGoodIdx = parseMenuIndex(subpartGoodResp.text, subpartGoodCandidates.length);
      if (subpartGoodIdx === null) {
        return {
          question,
          verdict: null,
          abstain: true,
          freeText: false,
          method: 'withheld-curve-shift-guard',
          basis: `sub-part (${sp.label}) good-extraction menu response "${subpartGoodResp.text}" was ` +
            `not a single in-range integer (0..${subpartGoodCandidates.length}) despite format-constrained ` +
            'decoding -- refused rather than guessing.',
        };
      }
      let subpartGoodQuote: string | null = null;
      let goodSource: 'sub-part' | 'preamble-fallback' | 'none' = 'none';
      if (subpartGoodIdx === subpartGoodCandidates.length) {
        // This sub-part names no good of its own -- fall back to the preamble-level good, per the
        // fixed "prefer per-sub-part, fall back to preamble" precedence (header comment). If the
        // preamble was ALSO NONE, this sub-part has no good to compare a price-of quote against at
        // all, and cannot be classified -- abstains rather than guessing.
        if (preambleGoodQuote !== null) {
          subpartGoodQuote = preambleGoodQuote;
          goodSource = 'preamble-fallback';
        } else {
          return {
            question,
            verdict: null,
            abstain: true,
            freeText: false,
            method: 'withheld-curve-shift-guard',
            basis: `sub-part (${sp.label}): no good was identifiable from this sub-part's own text ` +
              `(candidates: ${JSON.stringify(subpartGoodCandidates)}) AND the preamble named no shared ` +
              'good either -- no good exists to compare this sub-part\'s price-of quote against, so ' +
              'this sub-part cannot be classified. Refused rather than guessing.',
          };
        }
      } else {
        subpartGoodQuote = subpartGoodCandidates[subpartGoodIdx];
        goodSource = 'sub-part';
        // Belt-and-braces: by construction this is already a literal substring of sp.text. A failure
        // here means extractCandidateSpans() has a bug, not a model confabulation.
        if (!isLiteralQuoteOf(subpartGoodQuote, sp.text)) {
          return {
            question,
            verdict: null,
            abstain: true,
            freeText: false,
            method: 'withheld-curve-shift-guard',
            basis: `INTERNAL INVARIANT FAILURE: sub-part (${sp.label}) good candidate "${subpartGoodQuote}" ` +
              `(index ${subpartGoodIdx}) is not a literal substring of its own source clause -- ` +
              `extractCandidateSpans() bug, not a model error. Clause: "${sp.text}"`,
          };
        }
      }
      const targetGoodQuote = subpartGoodQuote;
      resolvedGoods.push({ label: sp.label, quote: targetGoodQuote, source: goodSource });
      ctx.emit({
        kind: 'fact',
        text: `   sub-part (${sp.label}) resolved good (menu index ${subpartGoodIdx}/${subpartGoodCandidates.length}, ` +
          `source: ${goodSource}, verified literal): "${targetGoodQuote}"`,
        ts: nowIso(),
      });

      // D-BP213-XO-58: CODE resolves antecedent-vs-consequent FIRST, mechanically, from the frozen
      // causal-connector list, before any menu is built for this decision. See the header comment
      // block for the full diagnosis and rationale.
      const causalSplit = findCausalSplit(sp.text);
      let change: string;
      let changeIdx: number | null = null;
      let changeCandidates: string[] | null = null;
      if (causalSplit === 'ambiguous') {
        return {
          question,
          verdict: null,
          abstain: true,
          freeText: false,
          method: 'withheld-curve-shift-guard',
          basis: `sub-part (${sp.label}) CHANGE: clause carries an unresolvable causal-connector ` +
            'ambiguity (more than one connector match, or a connector match falls inside an opened ' +
            'double-quote span) -- CODE cannot mechanically decide which segment is the antecedent, ' +
            `so this refuses rather than guessing. Clause: "${sp.text}"`,
        };
      } else if (causalSplit !== null) {
        // Exactly one unambiguous causal connector found -- CODE decides CHANGE = the antecedent
        // segment directly. NO MODEL CALL is made for this decision at all (HARDWIRE-22: this was a
        // judgment call when asked of the model; it is a literal string split when done by code).
        change = causalSplit.antecedent;
        ctx.emit({
          kind: 'fact',
          text: `   withheld-curve-shift-guard: sub-part (${sp.label}) CHANGE resolved by CODE via ` +
            `causal connector "${causalSplit.connector}" (antecedent/consequent split, no model call ` +
            `made for this decision): antecedent (= CHANGE) = "${change}"; consequent = ` +
            `"${causalSplit.consequent}"`,
          ts: nowIso(),
        });
        // Belt-and-braces (same discipline as every other extraction in this file): by construction
        // this is already a literal substring of sp.text. A failure here means findCausalSplit() has
        // a bug, not a model confabulation -- there was no model call in this branch at all.
        if (!isLiteralQuoteOf(change, sp.text)) {
          return {
            question,
            verdict: null,
            abstain: true,
            freeText: false,
            method: 'withheld-curve-shift-guard',
            basis: `INTERNAL INVARIANT FAILURE: sub-part (${sp.label}) code-resolved CHANGE ` +
              `antecedent "${change}" is not a literal substring of its own source clause -- ` +
              `findCausalSplit() bug, not a model error. Clause: "${sp.text}"`,
          };
        }
      } else {
        // No causal connector present in this clause -- fall back to the pre-existing model-menu
        // CHANGE flow, completely unchanged from before this fix.
        ctx.emit({
          kind: 'stage',
          text: `   withheld-curve-shift-guard: extracting CHANGE for sub-part (${sp.label}) via numbered menu (options masked)`,
          ts: nowIso(),
        });
        changeCandidates = extractCandidateSpans(sp.text);
        const changeResp = await callModelExtraction(
          buildMenuPrompt(changeInstruction(sp.text), changeCandidates, 'NONE / NO CLEAR CHANGE NAMEABLE FROM THE OPTIONS ABOVE'),
          { format: menuFormatSchema(changeCandidates.length), numPredict: 6 },
        );
        if (!changeResp.ok || !changeResp.text) {
          return {
            question,
            verdict: null,
            abstain: true,
            freeText: false,
            method: 'withheld-curve-shift-guard',
            basis: `sub-part (${sp.label}) CHANGE menu call failed: ${changeResp.detail ?? 'unknown failure'}`,
          };
        }
        changeIdx = parseMenuIndex(changeResp.text, changeCandidates.length);
        if (changeIdx === null) {
          return {
            question,
            verdict: null,
            abstain: true,
            freeText: false,
            method: 'withheld-curve-shift-guard',
            basis: `sub-part (${sp.label}) CHANGE menu response "${changeResp.text}" was not a single ` +
              `in-range integer (0..${changeCandidates.length}) despite format-constrained decoding, refused.`,
          };
        }
        if (changeIdx === changeCandidates.length) {
          // Every sub-part clause names some change by construction (that is what a sub-part is);
          // NONE here means the extraction genuinely failed to identify one, not that none exists --
          // abstains rather than guessing.
          return {
            question,
            verdict: null,
            abstain: true,
            freeText: false,
            method: 'withheld-curve-shift-guard',
            basis: `sub-part (${sp.label}) CHANGE menu: model chose NONE / NO CLEAR CHANGE among ` +
              `code-extracted candidates (${JSON.stringify(changeCandidates)}) -- a clause always names ` +
              'a change, so this is treated as an extraction failure, not a real absence, and refused.',
          };
        }
        change = changeCandidates[changeIdx];
        if (!isLiteralQuoteOf(change, sp.text)) {
          return {
            question,
            verdict: null,
            abstain: true,
            freeText: false,
            method: 'withheld-curve-shift-guard',
            basis: `INTERNAL INVARIANT FAILURE: sub-part (${sp.label}) CHANGE candidate "${change}" ` +
              `(index ${changeIdx}) is not a literal substring of its own source clause -- ` +
              `extractCandidateSpans() bug, not a model error. Clause: "${sp.text}"`,
          };
        }
      }

      ctx.emit({
        kind: 'stage',
        text: `   withheld-curve-shift-guard: extracting PRICE-OF for sub-part (${sp.label}) via numbered menu (options masked)`,
        ts: nowIso(),
      });
      const priceCandidates = extractCandidateSpans(sp.text);
      const priceResp = await callModelExtraction(
        buildMenuPrompt(priceOfInstruction(sp.text), priceCandidates, 'NONE / NOT PRESENT (no price or cost is mentioned in this clause)'),
        { format: menuFormatSchema(priceCandidates.length), numPredict: 6 },
      );
      if (!priceResp.ok || !priceResp.text) {
        return {
          question,
          verdict: null,
          abstain: true,
          freeText: false,
          method: 'withheld-curve-shift-guard',
          basis: `sub-part (${sp.label}) PRICE-OF menu call failed: ${priceResp.detail ?? 'unknown failure'}`,
        };
      }
      const priceIdx = parseMenuIndex(priceResp.text, priceCandidates.length);
      if (priceIdx === null) {
        return {
          question,
          verdict: null,
          abstain: true,
          freeText: false,
          method: 'withheld-curve-shift-guard',
          basis: `sub-part (${sp.label}) PRICE-OF menu response "${priceResp.text}" was not a ` +
            `single in-range integer (0..${priceCandidates.length}) despite format-constrained decoding, refused.`,
        };
      }
      let priceOf: string | null;
      if (priceIdx === priceCandidates.length) {
        priceOf = null; // NONE / NOT PRESENT -- a genuine, structurally-available answer, not a guess.
      } else {
        priceOf = priceCandidates[priceIdx];
        if (!isLiteralQuoteOf(priceOf, sp.text)) {
          return {
            question,
            verdict: null,
            abstain: true,
            freeText: false,
            method: 'withheld-curve-shift-guard',
            basis: `INTERNAL INVARIANT FAILURE: sub-part (${sp.label}) PRICE-OF candidate "${priceOf}" ` +
              `(index ${priceIdx}) is not a literal substring of its own source clause -- ` +
              `extractCandidateSpans() bug, not a model error. Clause: "${sp.text}"`,
          };
        }
      }

      // CODE decides here, never the model. The only comparison is a normalized entity match
      // between the PRICE-OF quote and the target-good quote -- never a domain/economics judgment.
      let word: string;
      if (priceOf === null) {
        word = axis.shiftWord;
      } else {
        const a = normalizeForEntityMatch(priceOf);
        const b = normalizeForEntityMatch(targetGoodQuote);
        const sameGood = a.length > 0 && b.length > 0 && (a === b || a.includes(b) || b.includes(a));
        word = sameGood ? axis.quantityWord : axis.shiftWord;
      }
      tuple.push(word);

      const changeIdxLabel = changeIdx === null ? 'code-resolved via causal connector, no menu call' : `menu idx ${changeIdx}`;
      ctx.emit({
        kind: 'fact',
        text: `   sub-part (${sp.label}): CHANGE="${change}" (${changeIdxLabel}) PRICE-OF=${priceOf ? `"${priceOf}" (menu idx ${priceIdx})` : `NONE (menu idx ${priceIdx})`} ` +
          `-> code-decided classification: "${word}" (rule: price-of-same-good = quantity change, anything else = curve shift)`,
        ts: nowIso(),
      });
    }

    ctx.emit({
      kind: 'fact',
      text: `   withheld-curve-shift-guard candidate tuple, fully decided by code before any option ` +
        `is revealed: (${tuple.join(', ')})`,
      ts: nowIso(),
    });

    // Step 3: reveal options now -- purely a letter lookup, no judgment left to perform.
    ctx.emit({
      kind: 'stage',
      text: '   withheld-curve-shift-guard: revealing option list now for the letter lookup only ' +
        '(classification already fully decided above)',
      ts: nowIso(),
    });

    const matchedLetters: string[] = [];
    for (const [letter, optionText] of Object.entries(options)) {
      const rowTuple = splitOptionIntoTuple(optionText);
      if (rowTuple.length !== requiredLabels.length) {
        ctx.emit({
          kind: 'note',
          text: `   option ${letter}: "${optionText}" -- ${rowTuple.length} clause(s), does not ` +
            `match arity ${requiredLabels.length}, skipped from the lookup table`,
          ts: nowIso(),
        });
        continue;
      }
      const isMatch = tuplesExactlyEqual(tuple, rowTuple);
      if (isMatch) matchedLetters.push(letter);
      ctx.emit({
        kind: 'note',
        text: `   option ${letter} vs decided tuple: (${rowTuple.join(', ')}) -- ${isMatch ? 'MATCH' : 'no match'}`,
        ts: nowIso(),
      });
    }

    if (matchedLetters.length === 0) {
      return {
        question,
        verdict: null,
        abstain: true,
        freeText: false,
        method: 'withheld-curve-shift-guard',
        basis: 'NONE MATCH: every option row was compared exactly against the tuple decided by code ' +
          `from verified literal extractions ((${tuple.join(', ')})) and zero rows matched. Stops ` +
          'here rather than falling back to any letter or inferring authorial intent.',
      };
    }
    if (matchedLetters.length > 1) {
      return {
        question,
        verdict: null,
        abstain: true,
        freeText: false,
        method: 'withheld-curve-shift-guard',
        basis: `genuine fork: letters ${matchedLetters.join(', ')} each exactly matched the tuple ` +
          `decided by code ((${tuple.join(', ')})). Reporting both rather than forcing a single pick.`,
      };
    }

    const winner = matchedLetters[0];
    const resolvedGoodsSummary = resolvedGoods
      .map((g) => `(${g.label}) "${g.quote}" [${g.source}]`)
      .join('; ');
    return {
      question,
      verdict: winner,
      abstain: false,
      freeText: false,
      method: 'withheld-curve-shift-guard',
      basis: `per-sub-part resolved goods (${resolvedGoodsSummary}) and each sub-part's verified ` +
        `literal change/price-of quotes were extracted with options masked; CODE (never the model) ` +
        `applied the fixed same-good-price rule, comparing each sub-part's PRICE-OF quote against ` +
        `THAT sub-part's own resolved good, to derive tuple (${tuple.join(', ')}); option ${winner} ` +
        'was the single exact row-by-row match once the option list was revealed for the letter lookup only.',
    };
  } catch (e) {
    return {
      question,
      verdict: null,
      abstain: true,
      freeText: false,
      method: 'withheld-curve-shift-guard',
      basis: `withheld-curve-shift-guard threw: ${String((e as Error)?.message ?? e)}`,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// THE LianaMethod OBJECT
// ─────────────────────────────────────────────────────────────────────────────────────────────

export const withheldCurveShiftGuardMethod: LianaMethod = {
  id: 'withheld-curve-shift-guard',
  demand: 'CLASSIFY',
  name: 'Withheld Curve-Shift Guard (extracts the target good and, per sub-part, what changed and ' +
    'whose price/cost it is -- pure copy-out, never a classification -- then CODE applies the fixed ' +
    'same-good-price rule to decide supply/demand shift vs quantity supplied/demanded BEFORE the ' +
    'option list is ever revealed; options are consulted only for the final letter lookup)',
  taughtBy: 'D-BP213-XO-41_LEG1_REAIMED.md, re-aiming D-BP213-XO-32_FOUR_METHOD_SPECS.md METHOD 1 ' +
    '(Didasko Round 1, qid 46, dataset id 7260) per Founder order 2026-09-03T06:33:14Z ("re-aim leg ' +
    '1 as the key-and-options withholding method as well"). Replaces anchored_lookup_guard.ts, ' +
    'unregistered same-night per D-BP213-BM0-026_LEG1_IS_AIMED_AT_THE_WRONG_DEFECT.md: that method ' +
    'asked the model to CLASSIFY each sub-part (a HARDWIRE-22 violation) and its win condition ' +
    '("found a matching option row") let a wrong model-derived classification stand in for a correct ' +
    'one whenever it happened to match a row -- on the founding example it converted an honest ' +
    'abstention into a confident WRONG answer. This method removes the model\'s classifying role ' +
    'entirely: the model only ever copies out literal text (target-good name; per-sub-part change ' +
    'and price-of quotes, each runtime-verified as a literal substring of its source), and CODE ' +
    'applies one fixed, disclosed textbook rule (own-price change = movement along the curve = ' +
    'quantity change; any other named determinant = curve shift) to derive the classification before ' +
    'the option list is ever revealed.',
  shapeDescription: 'a lettered MCQ question whose stem carries two or more labeled sub-parts ' +
    '((a)/(b)/(c), (i)/(ii), or (1)/(2) style) and whose option rows are tuples (comma/semicolon ' +
    'separated) of matching arity drawn from a CLEAN single-axis vocabulary of {supply, quantity ' +
    'supplied} or {demand, quantity demanded} only -- refuses honestly on a single-part stem, ' +
    'non-tuple-shaped options, a mixed or unrecognized option vocabulary, an unverifiable (non-' +
    'literal) model extraction at any step, or a lookup that resolves to zero or more than one ' +
    'matching option row. Deliberately narrower than anchored_lookup_guard.ts\'s claimed "any ' +
    'compound-tuple domain" scope -- see D-BP213-XO-41_LEG1_REAIMED.md section 7 for why that ' +
    'narrowing is the honest boundary, not an oversight.',
  shapeTest,
  run,
};

// Registers at import time, same convention as every other method module. The registerMethod()
// call alone is NOT sufficient to make this method reachable -- liana_terminal_engine.ts's own
// side-effect import block must ALSO import this file (done in the same dispatch as a separate
// one-line edit to that file, added after the anchored_lookup_guard unregister comment block; that
// file's import stays commented out, NOT re-enabled).
registerMethod(withheldCurveShiftGuardMethod);

// D-BP213-XO-48 TEST HOOKS, ADDITIVE ONLY, NO BEHAVIOR CHANGE. Exposes the internal structural-
// extraction primitives so a standalone proof harness can exercise the REAL production menu/
// format/index-parsing code path in isolation (e.g. just the PRICE-OF decision for one sub-part)
// without needing a full run() that also depends on the separate, pre-existing target-good-from-
// preamble gate (see D-BP213-XO-48_STRUCTURAL_EXTRACTION.md for why that gate is a DIFFERENT,
// out-of-scope defect this dispatch found but did not fix). Nothing in run() or shapeTest() reads
// this export; it exists only so an external harness reuses real code instead of reimplementing it
// (reimplementing would risk silently drifting from what production actually does).
export const __xo48TestHooks = {
  extractCandidateSpans,
  buildMenuPrompt,
  menuFormatSchema,
  parseMenuIndex,
  targetGoodInstruction,
  subpartGoodInstruction,
  changeInstruction,
  priceOfInstruction,
  callModelExtraction,
  findSubpartLabels,
  extractSubpartTexts,
  extractPreamble,
  // D-BP213-XO-58 addition, additive only, same rationale as the rest of this export block: exposes
  // the real production causal-connector split (and the frozen connector list it is built from) so a
  // standalone test/harness exercises the actual code path rather than reimplementing it.
  findCausalSplit,
  CAUSAL_CONNECTORS,
};
