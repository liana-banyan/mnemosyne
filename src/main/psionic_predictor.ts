// psionic_predictor.ts -- BP136 Yoke v2a: Psionic (Blade 10) zero-LLM answer predictor.
//
// HONESTY MANDATE (BP136, R-MECHANISM-VERIFY): exhaustive search of this repo (ripgrep across
// src/**, "psionic"/"blade_10"/"blade 10", case-insensitive -- zero hits), the
// LianaBanyanPlatform workspace (Grep + PowerShell Get-ChildItem across the full tree
// including Asteroid-ProofVault filenames, listing-only per secrets policy -- zero hits), the
// Bishop/.claude memory tree (zero hits), and the Librarian Cathedral substrate
// (search_knowledge + detective_investigate for "Psionic Blade 10" -- zero indexed canon
// content, only generic keyword-strength pheromone noise) found NO existing code and NO
// locatable canon file for "Psionic" / "Blade 10" / `canon_psionic_blade_10...bp128`.
//
// VERDICT: PAPERED-ONLY AT BEST (the concept may exist only as a verbal/whiteboard reference,
// or its canon file lives in a store this session could not reach) -- there was no prior
// "Psionic" implementation anywhere to wire. Per the spec's own instruction ("if it turns out
// to be papered-only ... do not fabricate an implementation from scratch beyond what's
// minimally needed to make the fast path real"), this file is a NEW, MINIMAL, HONEST
// implementation built this session -- it is not a wiring of pre-existing "Psionic" code,
// and that fact is reported plainly in the session deliverable, not hidden here.
//
// WHAT THIS ACTUALLY DOES (real, not a stub): a zero-LLM, keyword-overlap graph walk over the
// local verified-eblet substrate (mnem_eblet_store.ts's verified_eblets.jsonl). No Ollama call,
// no network call, no LLM of any kind anywhere in this file -- confirmed zero-LLM by
// construction (grep this file for "fetch(" or "Ollama" -- there are none). Multiple seed
// eblets (those whose tokens overlap the incoming question) are explored "in parallel" in the
// sense that every seed contributes independently to the convergence score -- implemented as a
// synchronous BFS (not Promise-based concurrency) because the whole computation is a handful of
// in-memory string-overlap comparisons, not an I/O-bound operation; there is nothing to await
// in parallel. This is a deliberate scope decision, documented here rather than silently
// simplified.
//
// CONFIDENCE MODEL: a prediction only reaches PSIONIC_FAST_PATH_THRESHOLD confidence when (a)
// at least one seed has strong direct token overlap with the question AND (b) at least
// PSIONIC_MIN_CORROBORATION_FOR_FAST_PATH independent eblets in the walked graph converge on
// the same answer. Single-eblet "lucky keyword match" alone can never trigger the fast path,
// by design -- see predictViaPsionic()'s corroboration gate.

import { loadAllVerifiedEblets, type VerifiedEbletEntry } from './mnem_eblet_store';

// ─── Tuning constants ──────────────────────────────────────────────────────────

/** Minimum question<->eblet token-overlap ratio to treat an eblet as a "seed" (a starting
 *  point for the graph walk). Deliberately looser than v1's SERVE_VERBATIM_THRESHOLD (0.6)
 *  because a seed here is just an entry point for the walk, not a serve decision by itself. */
const SEED_OVERLAP_THRESHOLD = 0.15;

/** Minimum eblet<->eblet token-overlap ratio (Jaccard over question+answer tokens) to treat
 *  two eblets as connected by an edge in the walk graph. */
const EDGE_OVERLAP_THRESHOLD = 0.2;

/** Minimum answer<->answer token-overlap ratio (Jaccard) to treat two eblets' answers as the
 *  "same" answer for corroboration-clustering purposes. */
const ANSWER_CLUSTER_THRESHOLD = 0.5;

// BP137 ADDENDUM FIX 1 (root-cause of the Twain/Rand false-serve): every CSIA-research-written
// answer carries the SAME shared boilerplate wrapper ("Banyan Metric Value (BMV): 9.8/10" +
// a "(Source: General historical record...)" parenthetical). Confirmed verbatim in the live
// store (verified_eblets.jsonl lines 499-503, BP137 addendum session): two DIFFERENT-subject
// answers ("Ayn Rand was born on February 2, 1905." vs "Mark Twain was born on November 24,
// 1835.") both get wrapped in near-identical boilerplate, so jaccard(rawAnswerA, rawAnswerB)
// measures mostly the SHARED WRAPPER, not the substantive difference -- any two CSIA answers
// cluster as "the same answer" by construction regardless of subject. Stripping this wrapper
// before clustering restores the comparison to the substantive fact text, where two different
// people's birthdates share zero tokens.
const BOILERPLATE_PATTERNS: RegExp[] = [
  /banyan metric value\s*\(bmv\)\s*:?\s*[\d.]*\s*\/?\s*10?/gi,
  /\bbmv\b/gi,
  /general historical record/gi,
  /confirmed via standard biographical records?/gi,
  // Source-note parentheticals: "(Source: ...)" or "*(Source: ...)*", possibly spanning the
  // rest of the line -- these are provenance commentary, not substantive answer content.
  /\*?\(source:[^)]*\)\*?/gi,
];

/** Strips the shared CSIA/BMV boilerplate wrapper from an answer string before it is tokenized
 *  for answer<->answer clustering (ANSWER_CLUSTER_THRESHOLD). Does NOT mutate the answer that
 *  is ever actually served to the user -- this is used ONLY as the basis for the clustering
 *  comparison inside predictViaPsionic(), never for the returned `answer` field itself. */
function stripCsiaBoilerplate(answer: string): string {
  let stripped = answer;
  for (const pattern of BOILERPLATE_PATTERNS) {
    stripped = stripped.replace(pattern, ' ');
  }
  return stripped;
}

/** Max BFS hop depth from any seed. 2 hops keeps the walk cheap (bounded fan-out) while still
 *  reaching beyond a single direct match -- the whole point of a "graph walk" vs. a flat
 *  top-1 lookup (which is what v1's answer-cache already does). */
const MAX_HOPS = 2;

/** Hard cap on seeds explored, to keep the walk O(seeds * corpusSize) bounded on a large
 *  substrate. Sorted by overlap score descending before slicing, so the strongest signals are
 *  always kept. */
const MAX_SEEDS = 5;

/** Confidence required for the CONVERGED FAST PATH (skip the model call entirely). Set well
 *  above a bare majority because this is a genuinely novel serve decision (v1's own
 *  SERVE_VERBATIM_THRESHOLD of 0.6 is a single-hit question-similarity gate with an exact-match
 *  fast path available as a fallback; Psionic has no such fallback -- it must earn its own
 *  confidence from real multi-source corroboration). */
export const PSIONIC_FAST_PATH_THRESHOLD = 0.7;

/** A single high-overlap eblet can never trigger the fast path alone -- at least this many
 *  independent corroborating eblets (in the same answer-cluster) must be present in the walked
 *  graph. This is the primary defense against a lucky-keyword-match false positive. */
export const PSIONIC_MIN_CORROBORATION_FOR_FAST_PATH = 2;

/** Threshold for the (non-serving) post-hoc "convergence-on-match" log/write, comparing
 *  Psionic's prediction against the real model's final answer. Deliberately LOWER than the
 *  fast-path threshold -- this is a corroboration signal for TIC growth, not a serve decision,
 *  so it is allowed to fire more often. */
export const CSIA_CONVERGENCE_MATCH_THRESHOLD = 0.35;

// ─── Tokenizer (self-contained -- does not import mnem_eblet_store's private tokenizer, to
//     keep this module's graph-edge semantics independent/auditable on their own) ──────────

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'what', 'how', 'why', 'when',
  'where', 'who', 'of', 'in', 'on', 'at', 'to', 'for', 'with', 'and', 'or',
  'not', 'be', 'been', 'being', 'that', 'this', 'these', 'those', 'it', 'its',
  'as', 'by', 'from', 'about', 'into', 'than', 'then', 'there', 'their',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .filter((w) => !STOP_WORDS.has(w));
}

/** Jaccard overlap: |A intersect B| / |A union B|. Symmetric, bounded [0,1]. Used for
 *  eblet<->eblet edges and answer<->answer clustering (both need a symmetric notion of
 *  "same-ish"), distinct from the asymmetric question<->corpus overlap used for seeding. */
function jaccard(tokensA: string[], tokensB: string[]): number {
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const t of setA) if (setB.has(t)) intersection++;
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** Asymmetric overlap: what fraction of queryTokens appear in corpusTokens. Used for seeding
 *  (how much of the QUESTION is covered by this eblet), distinct from jaccard's symmetric use
 *  for edges/clustering above. */
function overlapRatio(queryTokens: string[], corpusTokens: string[]): number {
  if (queryTokens.length === 0) return 0;
  const corpusSet = new Set(corpusTokens);
  const hits = queryTokens.filter((t) => corpusSet.has(t)).length;
  return hits / queryTokens.length;
}

// ─── Public types ──────────────────────────────────────────────────────────────

export interface PsionicPrediction {
  answer: string;
  /** 0-1. See the module header's "CONFIDENCE MODEL" note for how this is derived. */
  confidence: number;
  /** Count of independent eblets in the walked graph whose answers cluster with the predicted
   *  answer (ANSWER_CLUSTER_THRESHOLD). A count of 1 means no corroboration was found --
   *  the fast path can never fire in that case (see PSIONIC_MIN_CORROBORATION_FOR_FAST_PATH). */
  corroboratingCount: number;
  seedsExplored: number;
  /** Max BFS hop distance actually reached by any corroborating eblet (0 = the answer came
   *  from a seed itself, no walk beyond the seed was needed). */
  hops: number;
  /** The STORED QUESTIONS of every eblet in the corroborating cluster -- this is exactly the
   *  TIC `dependencies_upstream` provenance chain for whatever gets written on convergence. */
  sourceQuestions: string[];
  /** BP137 ADDENDUM FIX 2: the STORED QUESTION field of the specific eblet whose `answer` is
   *  being served as `answer` above (bestMember, not just any cluster member) -- exposed so
   *  the caller (ai_dispatch_ipc.ts) can run a discriminating-subject floor check between the
   *  live incoming question and the actual stored question this served answer came from,
   *  before allowing the fast path to fire. Never used to alter what gets served. */
  bestMemberQuestion: string;
  /** BP137 ADDENDUM FIX 2: bestMember's own persisted semanticCode (see semanticCode on
   *  VerifiedEbletEntry in mnem_eblet_store.ts), if it has one -- lets the caller reuse the
   *  already-computed embedding code for the discriminating-floor check instead of paying for
   *  a fresh embed call on the stored side. Undefined when bestMember was written before the
   *  semantic Yoke, or written while semantic_soccerball_mode/embeddings were unavailable. */
  bestMemberSemanticCode: string | undefined;
  /** Human-readable one-line trace, for console logs and (future v2e) the Prove It receipt. */
  traceSummary: string;
}

// ─── Core algorithm ──────────────────────────────────────────────────────────

interface ScoredEblet {
  entry: VerifiedEbletEntry;
  index: number;
  tokens: string[]; // tokenize(question + ' ' + answer), precomputed once
}

/**
 * Zero-LLM prediction: walks the local verified-eblet substrate as a keyword-overlap graph,
 * starting from every eblet with meaningful direct overlap with `question` (a "seed"), then
 * BFS-expanding up to MAX_HOPS via eblet<->eblet edges (EDGE_OVERLAP_THRESHOLD), then
 * clustering the reached eblets by answer similarity to find the most-corroborated candidate
 * answer. Returns null when the substrate has no meaningful signal for this question (fresh
 * install, or a genuinely novel question with zero related eblets) -- this is an honest "no
 * prediction", not a low-confidence guess.
 */
export async function predictViaPsionic(question: string): Promise<PsionicPrediction | null> {
  const qTokens = tokenize(question);
  if (qTokens.length === 0) return null;

  let entries: VerifiedEbletEntry[];
  try {
    entries = await loadAllVerifiedEblets();
  } catch (err) {
    console.warn('[Psionic] loadAllVerifiedEblets failed (non-fatal, no prediction):', err);
    return null;
  }
  if (entries.length < 2) return null; // nothing to walk -- a single eblet has no graph

  // BP137 ADDENDUM FIX 1 (extended scope, found empirically while acceptance-testing against
  // the live store): boilerplate-stripping the answer ALSO here, not just at the final
  // answer-clustering step below, matters -- these `tokens` (question+answer combined) are
  // used for BOTH seeding (overlapRatio) AND BFS edge-forming (jaccard). Leaving the raw,
  // boilerplate-heavy answer in THESE tokens let two different-subject eblets (e.g. Ayn Rand's
  // and Mark Twain's birthday entries, which share almost the entire "Banyan Metric Value
  // (BMV)... General historical record..." wrapper) form a graph EDGE purely on shared wrapper
  // tokens, pulling an unrelated-subject cluster into the walk from a correctly-seeded entry --
  // then that unrelated cluster could win cluster-selection on sheer member COUNT (more stored
  // phrasing variants) even though the correctly-seeded entry had far higher direct relevance.
  // Verified empirically against the live store (BP137 addendum session): stripping boilerplate
  // ONLY at the final clustering step (the original, narrower Fix 1) still let "When was Ayn
  // Rand born?" walk into and get out-voted by the (larger, differently-seeded) Mark Twain
  // cluster, dropping confidence to 0.60 and suppressing a legitimate serve (an honest
  // under-serve, not a false-serve, thanks to Fix 2's floor -- but still worth closing properly
  // here rather than leaving it to Fix 2 alone). Stripping boilerplate at THIS step too removes
  // the false edge entirely, restoring Ayn Rand's own entry as an isolated, correctly-served
  // seed for its own question. The un-stripped `entry.answer` is still returned verbatim as the
  // actual served/predicted answer everywhere else in this function -- only this internal
  // graph-comparison basis changes.
  const scored: ScoredEblet[] = entries.map((entry, index) => ({
    entry,
    index,
    tokens: tokenize(entry.question + ' ' + stripCsiaBoilerplate(entry.answer)),
  }));

  // ── Seed selection: eblets whose tokens cover a meaningful fraction of the question ──
  const seeds = scored
    .map((s) => ({ s, overlap: overlapRatio(qTokens, s.tokens) }))
    .filter((r) => r.overlap >= SEED_OVERLAP_THRESHOLD)
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, MAX_SEEDS);

  if (seeds.length === 0) return null; // honest: no substrate signal for this question

  // ── BFS walk from every seed, up to MAX_HOPS, via eblet<->eblet edges ──
  const visited = new Map<number, { hop: number; seedOverlap: number }>();
  for (const { s, overlap } of seeds) {
    const existing = visited.get(s.index);
    if (!existing || overlap > existing.seedOverlap) {
      visited.set(s.index, { hop: 0, seedOverlap: overlap });
    }
  }

  let frontier = seeds.map((r) => r.s.index);
  for (let hop = 1; hop <= MAX_HOPS && frontier.length > 0; hop++) {
    const nextFrontier: number[] = [];
    for (const fromIndex of frontier) {
      const fromNode = scored[fromIndex]!;
      for (const candidate of scored) {
        if (visited.has(candidate.index)) continue;
        if (jaccard(fromNode.tokens, candidate.tokens) >= EDGE_OVERLAP_THRESHOLD) {
          visited.set(candidate.index, { hop, seedOverlap: 0 });
          nextFrontier.push(candidate.index);
        }
      }
    }
    frontier = nextFrontier;
  }

  const visitedNodes = Array.from(visited.entries()).map(([index, meta]) => ({
    scored: scored[index]!,
    hop: meta.hop,
    seedOverlap: meta.seedOverlap,
  }));

  // ── Cluster visited eblets by answer similarity, find the largest/most-corroborated cluster ──
  // BP137 ADDENDUM FIX 1: cluster on the BOILERPLATE-STRIPPED answer text (see
  // stripCsiaBoilerplate() above), not the raw answer -- the raw answer's shared CSIA/BMV
  // wrapper text otherwise dominates the Jaccard score and clusters different-subject answers
  // together purely on shared wrapper tokens (the Twain/Rand root cause). The un-stripped
  // `node.scored.entry.answer` is still what actually gets returned/served below -- only the
  // CLUSTERING comparison basis changes here.
  const clusters: Array<{ members: typeof visitedNodes; answerTokens: string[] }> = [];
  for (const node of visitedNodes) {
    const answerTokens = tokenize(stripCsiaBoilerplate(node.scored.entry.answer));
    let placed = false;
    for (const cluster of clusters) {
      if (jaccard(answerTokens, cluster.answerTokens) >= ANSWER_CLUSTER_THRESHOLD) {
        cluster.members.push(node);
        placed = true;
        break;
      }
    }
    if (!placed) clusters.push({ members: [node], answerTokens });
  }

  if (clusters.length === 0) return null;

  // Best cluster = largest corroboration; ties broken by the best direct-seed overlap present
  // in the cluster (a cluster containing a strong direct hit outranks one that only arrived
  // via multi-hop weak edges).
  clusters.sort((a, b) => {
    if (b.members.length !== a.members.length) return b.members.length - a.members.length;
    const bestA = Math.max(...a.members.map((m) => m.seedOverlap));
    const bestB = Math.max(...b.members.map((m) => m.seedOverlap));
    return bestB - bestA;
  });
  const bestCluster = clusters[0]!;

  const bestMember = bestCluster.members.reduce((best, m) =>
    m.seedOverlap > best.seedOverlap ? m : best,
  );
  const bestSeedOverlap = Math.max(...bestCluster.members.map((m) => m.seedOverlap));
  const maxHopInCluster = Math.max(...bestCluster.members.map((m) => m.hop));
  const corroboratingCount = bestCluster.members.length;

  // Confidence: 60% weight on how strongly the best direct hit matched the question, 40%
  // weight on corroboration (capped so a single strong hit alone cannot reach the fast-path
  // threshold -- see PSIONIC_MIN_CORROBORATION_FOR_FAST_PATH as the hard secondary gate).
  const corroborationBonus = Math.min(0.4, (corroboratingCount - 1) * 0.15);
  const confidence = Math.min(1, bestSeedOverlap * 0.6 + corroborationBonus);

  const sourceQuestions = Array.from(new Set(bestCluster.members.map((m) => m.scored.entry.question)));

  return {
    answer: bestMember.scored.entry.answer,
    confidence,
    corroboratingCount,
    seedsExplored: seeds.length,
    hops: maxHopInCluster,
    sourceQuestions,
    bestMemberQuestion: bestMember.scored.entry.question,
    bestMemberSemanticCode: bestMember.scored.entry.semanticCode,
    traceSummary:
      `seeds=${seeds.length} visited=${visitedNodes.length} bestClusterSize=${corroboratingCount} ` +
      `bestSeedOverlap=${bestSeedOverlap.toFixed(2)} maxHop=${maxHopInCluster} confidence=${confidence.toFixed(2)}`,
  };
}

/** Post-hoc convergence check: how much does Psionic's prediction overlap (Jaccard, on
 *  answer text tokens) with a real model's final answer? Used ONLY for logging/TIC-write
 *  purposes when the fast path did NOT fire (Psionic's own confidence was below
 *  PSIONIC_FAST_PATH_THRESHOLD) -- never used to override or replace the model's answer
 *  that is actually served to the user. */
export function computeAnswerConvergence(psionicAnswer: string, modelAnswer: string): number {
  return jaccard(tokenize(psionicAnswer), tokenize(modelAnswer));
}
