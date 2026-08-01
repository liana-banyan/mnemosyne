// plow_mc_no_consensus_solver.ts -- BP141-2 Task B: "Disagreement as Evidence."
//
// Model discipline follows plow_mc_pseudocode_trace_solver.ts (see that file's own header for the
// full convention this file mirrors): pure, synchronous, no I/O, no model call, and it fails
// closed (returns null, never guesses) the moment any required piece is not confidently present.
//
// WHY THIS EXISTS: some MC questions ship an option that literally ASSERTS "there is no single/
// specific answer to this" (e.g. run 030 receipt, question_id 92, Critical Security Studies
// "referent object" question, option E: "There is no specific referent point."). When the
// question's genuinely independent sources scatter across 3+ distinct letters with no majority,
// their own disagreement IS the evidence the no-consensus option is correct -- the scatter itself
// proves the field has no settled answer, which is exactly what that option is claiming. This
// module never GUESSES that a no-consensus reading applies to a question that doesn't explicitly
// offer one; it only ever recognizes an option the question ITSELF already states.
//
// THE INDEPENDENCE UNIT (BP141-2 Founder Correction, A9/A10 REVISED -- same definition
// plow_mc_answerer.ts's Cake Method tiers use, see resolveCakeDerivationPath there): a DERIVATION
// PATH, never a model and never a machine. Three boxes running the identical model on the
// identical prompt are ONE voice sampled three times, not three independent voices --
// "VARIANCE IS NOT INDEPENDENCE." The caller is responsible for tagging each vote with its real
// derivation path (see IndependentSourceVote below) using the harness's own bookkeeping, never by
// asking a model what produced it. When two votes share the same derivation path, only the FIRST
// is counted -- this applies uniformly to both the independence gate (B2) and the letter-scatter/
// majority arithmetic (B3/B4), so repeated sampling of the same route can never inflate either the
// independence count or the appearance of disagreement.
//
// GATE (ALL must hold, else return null -- never widen any of these to force a pass):
//   B1: EXACTLY ONE option asserts non-existence/absence of a single answer or consensus (regex
//       set below). Zero matches (no such option) or 2+ matches (ambiguous which one is "the"
//       no-consensus option) is an honest null -- this module NEVER infers a no-consensus reading
//       for a question that does not explicitly offer one.
//   B2: at least 3 DISTINCT DERIVATION PATHS among independentSources (after the same-path
//       dedup above). Below that, ABSTAIN regardless of letter scatter -- "VARIANCE IS NOT
//       INDEPENDENCE," homogeneous-mesh/repeated-sample scatter measures temperature, not
//       disagreement, and reading it as evidence would be borrowed authority in a mesh costume.
//   B3: those independent votes produced >= 3 DISTINCT LETTERS, and no single letter holds a
//       strict majority (> 50% of the independent vote count).
//   B4: the no-consensus option's own letter is NOT itself among the plurality leader(s) -- if the
//       sources' own scatter happens to converge (even without a majority) on the SAME letter the
//       no-consensus option occupies, that is corroboration for that letter, not evidence of
//       "no consensus."
//
// ACCEPT: the no-consensus option's letter, provenance 'deterministic_compute:no_consensus_from_scatter',
// full scatter recorded in `trace` for the receipt.
//
// Rule 66: version, never overwrite -- this is a new file, no supersede needed.

import type { McOption } from './compute_sidecar';

/** One INDEPENDENT vote feeding this solver's gate. `derivationPath` MUST be harness-assigned
 *  (e.g. plow_mc_answerer.ts's resolveCakeDerivationPath output, or an equivalent tag for a
 *  non-Cake caller) -- never derived from asking the model itself what produced its own answer. */
export interface IndependentSourceVote {
  letter: string;
  derivationPath: string;
}

export interface NoConsensusSolverResult {
  letter: string;
  provenance: string;
  trace: string;
}

// --- B1: no-consensus assertion patterns -- deliberately narrow (an explicit denial of a single/
// specific answer or of consensus), never a loose "I don't know" or "insufficient information"
// phrasing that a normal wrong-but-plausible distractor option could also use. --------------------

const NO_CONSENSUS_PATTERNS: RegExp[] = [
  /\bthere is no specific\b/i,
  /\bthere is no single\b/i,
  /\bno single (correct )?(answer|consensus)\b/i,
  /\bno specific (correct )?(answer|consensus)\b/i,
  /\bthere is no consensus\b/i,
  /\bno consensus (exists|has been reached)\b/i,
  /\bno (universally |generally )?agreed[- ]upon\b/i,
];

function isNoConsensusOptionText(text: string): boolean {
  return NO_CONSENSUS_PATTERNS.some((re) => re.test(text));
}

/** Top-level entry point. Pure, synchronous, no I/O. Derives the no-consensus OPTION strictly
 *  from `questionText`'s own options (never infers one), and the ACCEPT/ABSTAIN decision strictly
 *  from `independentSources`' own recorded letters/derivation paths (never from re-reading any
 *  authority's reasoning text). Returns null (never guesses) the moment any gate above is not
 *  confidently satisfied. */
export function solveNoConsensusFromScatter(
  questionText: string,
  options: McOption[],
  independentSources: IndependentSourceVote[],
): NoConsensusSolverResult | null {
  if (options.length === 0) return null;

  // ── B1 ──────────────────────────────────────────────────────────────────────────────────────
  const noConsensusOptions = options.filter((o) => isNoConsensusOptionText(o.text));
  if (noConsensusOptions.length !== 1) return null;
  const noConsensusOption = noConsensusOptions[0] as McOption;

  // ── Dedup by derivation path -- same-path repeats count once, for BOTH B2 and B3/B4 below.
  // "VARIANCE IS NOT INDEPENDENCE": a second sample of an already-seen route is sampling noise,
  // never a second voice, so it must never inflate either the independence count or the letter
  // scatter/majority arithmetic that follows. ────────────────────────────────────────────────────
  const votesByPath = new Map<string, string>();
  for (const source of independentSources) {
    if (!source.derivationPath || !source.letter) continue;
    if (!votesByPath.has(source.derivationPath)) votesByPath.set(source.derivationPath, source.letter);
  }

  // ── B2 ──────────────────────────────────────────────────────────────────────────────────────
  const distinctDerivationCount = votesByPath.size;
  if (distinctDerivationCount < 3) return null;

  // ── B3 ──────────────────────────────────────────────────────────────────────────────────────
  const letterCounts = new Map<string, number>();
  for (const letter of votesByPath.values()) {
    letterCounts.set(letter, (letterCounts.get(letter) ?? 0) + 1);
  }
  const distinctLetterCount = letterCounts.size;
  if (distinctLetterCount < 3) return null;

  let maxCount = 0;
  for (const c of letterCounts.values()) maxCount = Math.max(maxCount, c);
  const hasMajority = maxCount * 2 > distinctDerivationCount; // strict majority: > 50%
  if (hasMajority) return null;

  // ── B4 ──────────────────────────────────────────────────────────────────────────────────────
  const pluralityLeaders = [...letterCounts.entries()]
    .filter(([, c]) => c === maxCount)
    .map(([letter]) => letter);
  if (pluralityLeaders.includes(noConsensusOption.letter)) return null;

  const scatterDescription = [...votesByPath.entries()]
    .map(([path, letter]) => `${path}:${letter}`)
    .join(', ');
  const trace =
    `no_consensus_from_scatter: no_consensus_option=${noConsensusOption.letter} ` +
    `("${noConsensusOption.text.slice(0, 80)}${noConsensusOption.text.length > 80 ? '...' : ''}") ` +
    `distinctDerivationCount=${distinctDerivationCount} distinctLetterCount=${distinctLetterCount} ` +
    `maxCount=${maxCount} pluralityLeaders=[${pluralityLeaders.join(',')}] votes=[${scatterDescription}]`;

  return {
    letter: noConsensusOption.letter,
    provenance: 'deterministic_compute:no_consensus_from_scatter',
    trace,
  };
}
