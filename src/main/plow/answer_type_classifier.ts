// answer_type_classifier.ts -- BP137 Yoke v2b Stage A: lightweight, deterministic answer-type
// classifier (computable / lookup_fact / reasoning), ahead of the specialist swarm.
//
// WHY THIS FILE EXISTS (R-MECHANISM-VERIFY): the Appendix wiring map (verified by direct read
// this Yoke) found NO existing answer-type classifier on the benchmark path. The two look-alikes
// that DO exist are NOT it:
//   - ask/local_answer_classifier.ts:52-61's classifyForUpgrade() scores an ALREADY-ANSWERED
//     question's bmv/diagnostic-shape to decide whether to show a "try a bigger model" UI
//     footer suggestion. It never runs before an answer exists and never produces
//     computable/lookup_fact/reasoning.
//   - dr_m_orchestrator/plow/domain_classifier.ts tags free-text research subjects, but
//     dr_m_orchestrator/ is imported NOWHERE in src/ (confirmed: zero string matches for
//     "dr_m_orchestrator" outside that folder itself) -- fully stranded, not reachable from any
//     running path.
// This file is new and additive. It has exactly one wired caller as of this Yoke:
// plow_mc_answerer.ts's runCanonicalPlowMcAnswer, gated behind
// config.researchArmMode && config.researchArmComputeSidecar (both default false/absent) --
// see that file's Stage A block for the call site.
//
// Deliberately cheap: pure regex/keyword heuristics, zero model calls, zero network calls, same
// "cheap and deterministic where possible" requirement the Yoke prompt states verbatim.

export type AnswerType = 'computable' | 'lookup_fact' | 'reasoning';

// Order matters only in that COMPUTABLE is checked first: a question that looks both numeric
// AND lookup-shaped (rare) is treated as computable because the compute_sidecar.ts caller always
// falls through to the untouched swarm+voter path on failure (see computeAnswer's contract) --
// misclassifying computable-but-unsolvable as computable costs nothing but a cheap regex+one
// failed local-eval attempt; the reverse (misclassifying a genuinely computable question as
// lookup_fact) would silently skip the one mechanism that could have answered it correctly.
const COMPUTABLE_PATTERNS: RegExp[] = [
  /\bcalculate\b/i,
  /\bcompute\b/i,
  /\bhow (much|many)\b/i,
  /\bwhat (?:is|are|was|were) the (value|result|sum|product|difference|quotient|total|proceeds|balance|rate|ph|ka|kb|entropy|enthalpy|dipole|charge|energy|force|velocity|pressure|volume|molarity|concentration|probability|percentage|average|mean|median)\b/i,
  /\bfind the\b/i,
  /\bsolve for\b/i,
  /\bestimate\b/i,
  /\bwhat percentage\b/i,
  /\d+\s*[+\-*/^]\s*\d+/, // a literal arithmetic expression fragment
  /\b(discount|proceeds|reserves?|deposits?|interest rate|present value|future value|dipole moment|partial charge|change in entropy)\b.*\d/i,
];

const LOOKUP_PATTERNS: RegExp[] = [
  /\bwho (is|was|are|were)\b/i,
  /\bwhat is the capital\b/i,
  /\bwhen (was|did|is|were)\b/i,
  /\bwhere is\b/i,
  /\bwhich (year|country|city|president|author|element|state)\b/i,
  /\bdefine\b/i,
  /\bwhat does .* (mean|stand for)\b/i,
  /\bwhat year\b/i,
  /\bwhat is the name of\b/i,
];

/** Deterministic, cheap (no model/network call) answer-type classification. Never throws;
 *  worst case (no pattern matches) is 'reasoning', the same category the pre-Stage-A path
 *  effectively always used for every question (no classifier existed at all). */
export function classifyAnswerType(question: string): AnswerType {
  if (typeof question !== 'string' || question.length === 0) return 'reasoning';
  const hasDigits = /\d/.test(question);
  if (hasDigits && COMPUTABLE_PATTERNS.some((re) => re.test(question))) {
    return 'computable';
  }
  if (LOOKUP_PATTERNS.some((re) => re.test(question))) {
    return 'lookup_fact';
  }
  return 'reasoning';
}
