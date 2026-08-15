// no_consensus_step.ts -- D-BP154-065/BISHOP-SEG/S52/seg-wiregate
//
// 'NoConsensus:1' -- THE COMPOSER-NATIVE NO-CONSENSUS-FROM-SCATTER STEP.
//
// WHERE THIS CAME FROM (D-BP154-064's own Phase B diagnosis, this session): qid 98 was solved;
// the Founder asked for the next hardest of the standing five (46/66/72/85/92). qid 92 ("Within
// Critical Security Studies, what is the referent object of security?", correct answer E: "There
// is no specific referent point.") is answered correctly by plow_mc_answerer.ts's
// resolveDeterministicComputeOverride bypass (that file, lines ~4099-4188) calling
// plow_mc_no_consensus_solver.ts's solveNoConsensusFromScatter (that file, lines 87-146) in 6 of
// 54 measured receipts, and wrongly (via a later 'agree' fast-path, letter B) in the rest -- a
// coin flip TRACED to one specific fact: the pre-swarm bypass decides on whatever authorities have
// already resolved before ONE await point (plow_mc_answerer.ts:3976/:4111, "the swarm has not
// fired yet at this point"); if fewer than 3 have resolved by then, it returns null and falls
// through to a LATER fast-path that never re-consults the dissenting votes that arrived after it
// gave up. Same question, same authorities, same eventual scatter -- different verdict, purely
// from async timing.
//
// BOTH plow_mc_answerer.ts AND plow_mc_no_consensus_solver.ts REMAIN FORBIDDEN AS DEPENDENCIES.
// Both were READ for diagnosis only (D-BP154-064's own report cites file:line for every claim
// above). Nothing is imported from either file. Every regex, label, and gate arithmetic step
// below is independently authored for this file -- not ported, not copy-pasted, not structurally
// mirrored line-for-line. classify_cascade.ts remains FORBIDDEN and was not read to build this.
//
// THE POINT OF BUILDING IT NATIVELY IS TO REMOVE THE RACE, NOT TO REPRODUCE IT. This step queries
// every reachable voice via Promise.all and evaluates the gate arithmetic only once ALL of them
// have settled (answered or failed) -- there is no early-return checkpoint here for a partial
// scatter to sneak through. The claim this exists to prove: for a fixed evidence set (the same
// authorities giving the same answers), the verdict is now a pure function of the votes, never of
// which one happened to answer first. D-BP154-065's own dispatch requires this proven by running
// qid 92 live at least three times and comparing.
//
// FD-BP153-06/HARDWIRE-22 THROUGHOUT: no rule below may select a particular letter by name; every
// check operates on option TEXT (pattern match, extraction-only) or on LETTER COUNTS (arithmetic
// only), never on which letter the answer key says is correct. qid 92's own answer (E) is used
// ONLY to detect a wrong mechanism while building this file (does the step, run on real qid-92
// evidence, land on the same letter the forbidden mechanism did, for the same structural reason) --
// it is never read, matched against, or encoded into any rule.

import { appearsIn } from '../methods/comparative_cascade';
import type { MethodQuestionInput, MethodRunContext } from '../method_registry';
import { registerNameNumbered } from './method_registry';
import type { MethodIdentity } from './method_identity';
import type { StepDeclaration } from './step_declaration';

// ───────────────────── pure parts (unit-testable without a live authority) ─────────────────────

// D-BP154-065, CONSTRAINT 2: "the no-consensus pattern check reads THE OPTION'S OWN TEXT...
// pattern-matching an option's stated words is extraction and is HARDWIRE-22-safe... write your
// own regex set; do not port theirs." Independently authored -- different wording, different
// structure, different order from plow_mc_no_consensus_solver.ts's own NO_CONSENSUS_PATTERNS
// (read for diagnosis only, :62-70) -- covering the same semantic space (an option textually
// denying a single/specific answer or settled consensus exists) because that is the shape of
// language the underlying question TYPE uses, not because any pattern was copied.
const NO_SINGLE_ANSWER_PATTERNS: RegExp[] = [
  /\bno specific\b/i,
  /\bno single\b/i,
  /\bnot a single\b/i,
  /\bno (settled|agreed[- ]upon|clear|universal) (answer|consensus|referent|point)\b/i,
  /\bno consensus\b/i,
  /\bthere is no\b[^.]{0,40}\b(answer|referent|point|consensus)\b/i,
];

/** Extraction, not judgment: does this ONE option's own stated text assert that no single/
 *  specific answer or consensus exists? Checked identically for every option, never short-
 *  circuited on the first hit -- see runNoConsensusStep()'s own uniform scan below. Exported for
 *  direct unit testing, same convention every sibling step's own pure parts already follow. */
export function isNoSingleAnswerText(text: string): boolean {
  return NO_SINGLE_ANSWER_PATTERNS.some((re) => re.test(text));
}

// D-BP154-065, CONSTRAINT 1: "independence is per derivation path, not per call... label paths
// from scratch -- do not copy resolveCakeDerivationPath." The Composer only ever reaches these
// five named voices (method_registry.ts's own askConversationalAuthorityAs union) -- no swarm
// concept exists here, so (unlike the forbidden file) there is no risk of a many-model swarm being
// miscounted as one path or many; each voice below already IS exactly one path. pathLabelFor()
// still exists as its own function (not inlined) so a reader can audit the count at the one place
// it is assigned, and so two calls into the SAME voice (this step never issues more than one per
// voice today, but a future retry-on-failure caller might) collapse to one label rather than
// silently doubling a vote.
const VOICES: ReadonlyArray<'user_gemini' | 'user_perplexity' | 'user_claude' | 'user_google' | 'user_chatgpt'> = [
  'user_gemini', 'user_perplexity', 'user_claude', 'user_google', 'user_chatgpt',
];

function pathLabelFor(voice: string): string {
  return `voice:${voice}`;
}

// LIVE-MEASURED FIX (D-BP154-065's own qid-92 run 1): mcOptions-aware queries in this codebase are
// formatted by the shared, generic browser_authority_types.ts's own buildMcAwareQueryText()
// (already used by every sibling step, not this file's own invention), which appends "Which
// option is correct? Reply starting with 'Answer: <letter>' then a one-sentence reason." to every
// query this step issues. A browser capture routinely echoes the QUESTION+OPTIONS text back
// alongside the real reply (a known capture-layer artifact every mcOptions-aware caller in this
// codebase contends with) -- when that happens, EVERY option's own text technically "appears" in
// the raw response, so a bare appearsIn() uniqueness check (this function's first version) always
// found 10-way ambiguity and discarded every vote, even a genuine, clearly-stated answer. Fixed by
// checking the "Answer: <letter>" STRUCTURAL MARKER first -- a literal, anchored token the query
// itself requested, mechanical extraction (HARDWIRE-22-safe, the same "ask for the letter FIRST so
// it can be found by a simple anchored regex" discipline browser_authority_types.ts's own doc
// comment states, independently re-derived here, NOT plow_mc_answerer.ts's own
// extractChosenLetterFromAuthorityText -- read for diagnosis only, different pattern, different
// order, never imported). Falls back to the appearsIn() uniqueness check only when no "Answer:"
// marker is present, for a voice that ignores the instruction but still names its pick plainly.
const ANSWER_MARKER_PATTERN = /\bAnswer:\s*([A-J])\)/i;

/** Extraction-only vote reading (HARDWIRE-22): never a similarity judgment between two different
 *  texts. Tries the anchored "Answer: <letter>" marker first (see this function's own header for
 *  why); falls back to appearsIn() uniqueness (comparative_cascade.ts, shared, not forbidden) --
 *  option L's own text, verbatim, uniquely present. Ambiguous or absent either way is an honest
 *  discard, counted in the vote's own discardReason, never guessed. Exported for direct unit
 *  testing. */
export function extractVoteLetter(text: string, OPT: Record<string, string>): string | null {
  const marker = text.match(ANSWER_MARKER_PATTERN);
  const markerLetter = marker?.[1]?.toUpperCase();
  if (markerLetter && OPT[markerLetter]) return markerLetter;
  const matches = Object.keys(OPT).filter((L) => appearsIn(text, OPT[L]));
  return matches.length === 1 ? matches[0] : null;
}

export interface NoConsensusVote {
  voice: string;
  pathLabel: string;
  ok: boolean;
  raw: string;
  letter: string | null;
  discardReason?: string;
}

export interface NoConsensusResult {
  ok: boolean;
  query: string | null;
  /** Every option letter whose own text matched a no-single-answer pattern -- ALWAYS the result of
   *  scanning every option (never short-circuited on the first hit), so a reader can see exactly
   *  how many candidates the pattern found, not just the one this run happened to act on. */
  patternMatches: string[];
  /** True only when patternMatches.length === 1. D-BP154-065 CONSTRAINT 4: "if the pattern check
   *  would match more than one option, it is non-discriminating and the step abstains rather than
   *  picking." This mirrors checkUniformPredicate()'s own procedural-fairness PRINCIPLE
   *  (comparability_gate.ts -- a rule that does not uniquely discriminate may not be used to
   *  eliminate or select) -- it is NOT a literal call to that function, because
   *  checkUniformPredicate() tests whether a rule was APPLIED to every same-type peer, a different
   *  question from whether its OUTCOME is unique; forcing this step's plain text-pattern check
   *  through that function's Candidate/pool/entityType data model (designed for elimination-rule
   *  peer comparison) would be exactly the category-error class this campaign has spent this
   *  session repairing. This field applies the SAME discipline honestly, natively. */
  discriminating: boolean;
  noConsensusOptionLetter: string | null;
  votes: NoConsensusVote[];
  distinctPathCount: number;
  distinctLetterCount: number;
  maxCount: number;
  pluralityLeaders: string[];
  hasMajority: boolean;
  verdictLetter: string | null;
  abstain: boolean;
  abstainReason: string | null;
  inapplicable?: boolean;
  error?: string;
}

function emptyResult(overrides: Partial<NoConsensusResult> & { error: string }): NoConsensusResult {
  return {
    ok: false, query: null, patternMatches: [], discriminating: false, noConsensusOptionLetter: null,
    votes: [], distinctPathCount: 0, distinctLetterCount: 0, maxCount: 0, pluralityLeaders: [],
    hasMajority: false, verdictLetter: null, abstain: true, abstainReason: null,
    ...overrides,
  };
}

function summaryLine(r: NoConsensusResult): string {
  if (!r.ok) return `NO CONSENSUS: FAILED -- ${r.error}`;
  if (!r.discriminating) {
    return `NO CONSENSUS -- pattern matched ${r.patternMatches.length} option(s) [${r.patternMatches.join(', ')}] -- NON-DISCRIMINATING, ABSTAIN -- ${r.abstainReason}`;
  }
  const votesText = r.votes.length
    ? r.votes.map((v) => `${v.pathLabel}:${v.ok ? (v.letter ?? 'unparseable') : 'FAILED'}${v.discardReason ? ` (${v.discardReason})` : ''}`).join('  |  ')
    : '(no votes gathered)';
  const gateText = `distinctPaths=${r.distinctPathCount} distinctLetters=${r.distinctLetterCount} `
    + `maxCount=${r.maxCount} pluralityLeaders=[${r.pluralityLeaders.join(',')}] hasMajority=${r.hasMajority}`;
  if (r.abstain) {
    return `NO CONSENSUS -- no-consensus option: ${r.noConsensusOptionLetter}  ||  VOTES: ${votesText}  ||  `
      + `GATE: ${gateText}  ||  ABSTAIN -- ${r.abstainReason}`;
  }
  return `NO CONSENSUS -- VERDICT: ${r.verdictLetter}  ||  no-consensus option: ${r.noConsensusOptionLetter}  ||  `
    + `VOTES: ${votesText}  ||  GATE: ${gateText}`;
}

// ───────────────────── the live step (awaits every voice to completion, no early exit) ─────────────────────

/**
 * Runs 'NoConsensus:1'. Unlike every sibling step that spends a live Ollama extraction call
 * (gemmaExtract), this one's ONLY external dependency is ctx.askConversationalAuthorityAs itself --
 * so, unusually for this file family, it CAN be exercised fully under vitest with a fake
 * implementation of that one function (see the .test.ts sibling: fakes returning canned text,
 * including artificially reordered/delayed resolution, to directly prove the determinism claim --
 * same votes, same verdict, regardless of which voice's Promise settles first). The LIVE claim this
 * still needs (real authorities, real network, real timing) is verified by repeated live in-app
 * runs against qid 92 (D-BP154-065's own verification requirement -- at least three, reported in
 * full) -- the unit tests prove the ARITHMETIC is order-independent; the live runs prove the REAL
 * SYSTEM behaves the same way.
 */
export async function runNoConsensusStep(
  input: MethodQuestionInput,
  ctx: MethodRunContext,
): Promise<{ result: NoConsensusResult; summary: string }> {
  const OPT = input.options;
  if (!OPT || Object.keys(OPT).length === 0) {
    const result = emptyResult({
      error: 'this question has no lettered options -- NO CONSENSUS tests scatter among options and cannot run without them',
    });
    return { result, summary: summaryLine(result) };
  }
  const all = Object.keys(OPT);

  // GATE 0 (own words, not the forbidden file's B1): scan EVERY option's own text, uniformly,
  // for the no-single-answer pattern. Never stops at the first hit.
  const patternMatches = all.filter((L) => isNoSingleAnswerText(OPT[L]));
  if (patternMatches.length === 0) {
    const result = emptyResult({
      inapplicable: true,
      error: 'INAPPLICABLE -- no option in this question asserts that no single/specific answer or '
        + 'consensus exists; this method does not apply to this question shape, which is not a defect in it',
    });
    return { result, summary: summaryLine(result) };
  }
  if (patternMatches.length > 1) {
    const result: NoConsensusResult = {
      ok: true, query: null, patternMatches, discriminating: false, noConsensusOptionLetter: null,
      votes: [], distinctPathCount: 0, distinctLetterCount: 0, maxCount: 0, pluralityLeaders: [],
      hasMajority: false, verdictLetter: null, abstain: true,
      abstainReason: `NON-DISCRIMINATING -- ${patternMatches.length} options (${patternMatches.join(', ')}) `
        + 'all assert no-single-answer/no-consensus language; the pattern cannot uniquely identify '
        + 'which one the question means, so this step abstains rather than picking one (D-BP154-065 '
        + 'CONSTRAINT 4)',
    };
    return { result, summary: summaryLine(result) };
  }
  const noConsensusOptionLetter = patternMatches[0] as string;

  if (!ctx.askConversationalAuthorityAs) {
    const result = emptyResult({
      patternMatches, discriminating: true, noConsensusOptionLetter,
      error: 'no per-authority conversational channel wired for this run '
        + '(ctx.askConversationalAuthorityAs is absent) -- NO CONSENSUS needs at least 3 '
        + 'independently-labeled voices and cannot run without them',
    });
    return { result, summary: summaryLine(result) };
  }
  const authorityAs = ctx.askConversationalAuthorityAs;

  // THE FOUNDER'S OWN QUESTION TEXT VERBATIM IN (HARDWIRE-22) -- the raw MC question, exactly as
  // every voice would be asked directly; no rate/judge/decide framing layered on top.
  const query = input.question;
  const mcOptions = all.map((L) => `${L}) ${OPT[L]}`);

  // AWAIT EVERY VOICE TO COMPLETION. Promise.all, never an early return mid-sequence -- THIS is
  // the fix. No gate below is evaluated until every voice has answered or failed.
  const settled = await Promise.all(VOICES.map(async (voice): Promise<NoConsensusVote> => {
    try {
      const r = await authorityAs(voice, query, mcOptions);
      if (!r.ok || !r.text.trim()) {
        return {
          voice, pathLabel: pathLabelFor(voice), ok: false, raw: '', letter: null,
          discardReason: `no usable answer (${r.via || r.authority || 'n/a'})`,
        };
      }
      const letter = extractVoteLetter(r.text, OPT);
      return {
        voice, pathLabel: pathLabelFor(voice), ok: true, raw: r.text, letter,
        discardReason: letter
          ? undefined
          : 'response named zero or 2+ options\' own text -- ambiguous or unattributable, discarded rather than guessed',
      };
    } catch (err) {
      return {
        voice, pathLabel: pathLabelFor(voice), ok: false, raw: '', letter: null,
        discardReason: `threw: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }));

  // Dedup by pathLabel -- two votes sharing a path collapse to the first (never happens today,
  // one call per voice; kept explicit and future-proof per CONSTRAINT 1).
  const votesByPath = new Map<string, string>();
  for (const v of settled) {
    if (v.letter && !votesByPath.has(v.pathLabel)) votesByPath.set(v.pathLabel, v.letter);
  }

  const distinctPathCount = votesByPath.size;
  const letterCounts = new Map<string, number>();
  for (const letter of votesByPath.values()) letterCounts.set(letter, (letterCounts.get(letter) ?? 0) + 1);
  const distinctLetterCount = letterCounts.size;
  let maxCount = 0;
  for (const c of letterCounts.values()) maxCount = Math.max(maxCount, c);
  const hasMajority = distinctPathCount > 0 && maxCount * 2 > distinctPathCount; // strict majority: > 50%
  const pluralityLeaders = [...letterCounts.entries()].filter(([, c]) => c === maxCount).map(([L]) => L);
  const votesDescription = () => `[${[...votesByPath.entries()].map(([p, l]) => `${p}:${l}`).join(', ')}]`;

  const gateBase = {
    ok: true as const, query, patternMatches, discriminating: true, noConsensusOptionLetter,
    votes: settled, distinctPathCount, distinctLetterCount, maxCount, pluralityLeaders, hasMajority,
  };

  // GATE B2 (own words): at least 3 distinct derivation paths produced a usable vote.
  if (distinctPathCount < 3) {
    const result: NoConsensusResult = {
      ...gateBase, verdictLetter: null, abstain: true,
      abstainReason: `INSUFFICIENT INDEPENDENCE -- only ${distinctPathCount} distinct derivation `
        + `path(s) produced a usable vote (need >=3); votes: ${votesDescription()}`,
    };
    return { result, summary: summaryLine(result) };
  }
  // GATE B3a (own words): those independent votes span at least 3 distinct letters.
  if (distinctLetterCount < 3) {
    const result: NoConsensusResult = {
      ...gateBase, verdictLetter: null, abstain: true,
      abstainReason: `INSUFFICIENT SCATTER -- only ${distinctLetterCount} distinct letter(s) among `
        + `${distinctPathCount} independent votes (need >=3); votes: ${votesDescription()}`,
    };
    return { result, summary: summaryLine(result) };
  }
  // GATE B3b (own words): no letter holds a strict majority of the independent votes.
  if (hasMajority) {
    const leader = pluralityLeaders[0];
    const result: NoConsensusResult = {
      ...gateBase, verdictLetter: null, abstain: true,
      abstainReason: `A STRICT MAJORITY EXISTS -- letter ${leader} holds ${maxCount}/${distinctPathCount} `
        + 'independent votes (>50%); the scatter is not genuine disagreement, so no-consensus does not '
        + `apply this run; votes: ${votesDescription()}`,
    };
    return { result, summary: summaryLine(result) };
  }
  // GATE B4 (own words): the no-consensus option's own letter is not itself a plurality leader.
  if (pluralityLeaders.includes(noConsensusOptionLetter)) {
    const result: NoConsensusResult = {
      ...gateBase, verdictLetter: null, abstain: true,
      abstainReason: `THE NO-CONSENSUS OPTION IS ITSELF A PLURALITY LEADER -- letter `
        + `${noConsensusOptionLetter} holds ${maxCount} vote(s), tied with [${pluralityLeaders.join(', ')}]; `
        + 'the sources\' own scatter converges on it directly, which is corroboration for that letter, '
        + `not evidence of "no consensus"; votes: ${votesDescription()}`,
    };
    return { result, summary: summaryLine(result) };
  }

  const result: NoConsensusResult = {
    ...gateBase, verdictLetter: noConsensusOptionLetter, abstain: false, abstainReason: null,
  };
  return { result, summary: summaryLine(result) };
}

// ───────────────────────── registration (inert until stacked and run) ─────────────────────────

const NO_CONSENSUS_DECLARATION: StepDeclaration = {
  id: 'liana_cycle.no_consensus_step.runNoConsensusStep',
  version: '1',
  sourceFile: 'src/main/liana_cycle/library/no_consensus_step.ts',
  sourceLine: 1,
  exportName: 'runNoConsensusStep',
  exportKind: 'function',
  whatItDoes:
    'THE NO-CONSENSUS-FROM-SCATTER STEP, built Composer-native (D-BP154-065) after diagnosing the '
    + 'same-shaped mechanism inside the FORBIDDEN plow_mc_answerer.ts/plow_mc_no_consensus_solver.ts '
    + '(read for diagnosis only, D-BP154-064). Recognizes an option that textually asserts no single/ '
    + 'specific answer or consensus exists (own regex, extraction-only), then queries every reachable '
    + 'voice (Gemini/Perplexity/Claude/Google/ChatGPT) with the SAME question and AWAITS ALL OF THEM '
    + 'TO COMPLETION before evaluating the gate -- removing the partial-scatter race the forbidden '
    + 'mechanism has. Accepts the no-consensus option only when >=3 independent derivation-path votes '
    + 'span >=3 distinct letters with no strict majority and the no-consensus letter is not itself a '
    + 'plurality leader; abstains with a complete record otherwise.',
  inputs: 'MethodQuestionInput plus MethodRunContext to runNoConsensusStep() (askConversationalAuthorityAs for all five named voices).',
  outputs: 'Promise<{ result: NoConsensusResult, summary: string }> -- pattern-match set, every vote with its path label and raw text, full gate arithmetic, verdict or abstain with a specific reason.',
  decidesOrReports: 'DECIDES_AND_REFUSES',
  queryText: {
    issuesQuery: true,
    description: 'The question verbatim, put to up to 5 independent voices in parallel -- no per-voice framing beyond the original text and the standard "L) option text" list.',
    loadedFromQueryResource: false,
  },
  attribution: {
    kind: 'ATTRIBUTED',
    founderRuling: 'BP154',
    quote: 'Build the Composer-native no-consensus step... `NoConsensus:1` awaits every authority to '
      + 'completion before any decision. That is not a detail; it is the entire reason this is worth '
      + 'building rather than porting. Determinism over the same evidence set is the deliverable.',
    citedAt: 'D-BP154-064 (diagnosis)/D-BP154-065 (build), this dispatch',
  },
  orphanEvidence:
    'N/A -- not an orphan. Live: registered via registerNoConsensusStep() (this file), executed by '
    + 'script_bridge.ts\'s runOneStep() for id "NoConsensus:1".',
};

/** Registers 'NoConsensus:1'. Called from script_bridge.ts's ensureRegistryPopulated(),
 *  idempotently -- same try/catch shape as every other Composer step registration there. */
export function registerNoConsensusStep(): MethodIdentity {
  return registerNameNumbered('NoConsensus', 1, NO_CONSENSUS_DECLARATION);
}
