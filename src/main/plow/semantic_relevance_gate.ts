// semantic_relevance_gate.ts -- BP137 Yoke v2b Stage A.0.1: upgrades plow_mc_answerer.ts's
// Stage A.0 relevance gate from a token-overlap TEST (isQaRelevant, mnem_eblet_store.ts:648,
// an ~8%-threshold token-overlap heuristic -- see QA_RELEVANCE_THRESHOLD there) to embedding
// cosine similarity. This does NOT touch the gating FLAG (config.researchArmMode &&
// config.researchArmRelevanceGate) or the abstain logic downstream of it -- only the per-
// candidate relevance TEST changes.
//
// Root cause this fixes (live regression, this session): token overlap has low precision --
// a completely off-topic OpenAlex biography of the musician "Will Marion Cook" passed the
// ~8% token-overlap gate for a business/sight-draft MC question purely on incidental shared
// tokens, got fed into the MC voters' factsContext AND the Stage A.3 compute-sidecar's
// componentFacts (plow_mc_answerer.ts:424-426, same sliced array feeds both), and nudged the
// compute model onto a wrong discount-formula answer. Embedding cosine similarity scores
// SEMANTIC closeness rather than incidental lexical overlap, so an off-topic biography scores
// far below on-topic candidates for a numeric/business question.
//
// Machinery reused (not duplicated, not a new dependency):
//   - ollamaManager.embed(text, model?) -- ollama_manager.ts:343. Fail-soft: returns null
//     (never throws) if the embedding is unavailable (Ollama down, model missing, malformed
//     response). Modeled on the existing call site at semantic_soccerball.ts:153
//     (`const vec = await ollamaManager.embed(text);`).
//   - cosineSimilarity(a, b) -- semantic_centroid.ts:35 (exported from that file for this
//     reuse, see its own comment). Plain dot-product / (||a||*||b||) formula, returns 0 if
//     either vector's norm is 0. Reused verbatim via import, not copied, so there is no risk
//     of silent divergence between the two call sites.
//
// NOTE on ollamaBaseUrl (verified this session, not assumed): ollamaManager.embed()'s actual
// signature is `embed(text: string, model: string = EMBED_MODEL)` -- it does NOT accept a base
// URL parameter. Internally it always calls the module-level hardcoded constant
// `OLLAMA_API_BASE = 'http://127.0.0.1:11434'` (ollama_manager.ts:16), unlike callOllama() in
// canonical_pipeline.ts (used by the MC voters), which DOES take an explicit ollamaBaseUrl
// argument. The `ollamaBaseUrl` parameters below are therefore accepted for interface symmetry
// with this file's config-threading convention and reserved for a future
// `ollamaManager.embed(text, model, baseUrl)` overload, but are CURRENTLY UNUSED/INERT --
// flagged explicitly here (and in the Yoke report) rather than silently dropped or faked.
//
// Fail-soft contract (mandatory, matches ollamaManager.embed()'s own contract): every exported
// function here returns null when an embedding is unavailable for either input text -- NEVER
// throws. Callers (plow_mc_answerer.ts's Stage A.0 filter) MUST fall back to the existing
// token-overlap isQaRelevant() check on a null result, per the Yoke's fallback-discipline
// requirement.

import { ollamaManager } from '../ollama_manager';
import { cosineSimilarity } from '../semantic_centroid';

/** Tunable in the 0.55-0.60 range per the Yoke spec; 0.58 is the starting value. Named/exported
 *  here (rather than inlined) so it is easy to find and retune later without touching the
 *  filter logic in plow_mc_answerer.ts. */
export const SEMANTIC_RELEVANCE_THRESHOLD = 0.58;

/**
 * Cosine similarity between a QUESTION and a single FACT, via nomic-embed-text embeddings
 * (ollamaManager.embed) + the reused cosineSimilarity formula. Fail-soft: returns null (never
 * throws) if EITHER embed call fails.
 *
 * Embeds the question fresh on every call -- when scoring multiple candidate facts against the
 * SAME question (the plow_mc_answerer.ts Stage A.0 filter, 3-6 candidates per question), prefer
 * embedding the question once via ollamaManager.embed() directly and calling
 * semanticRelevanceFromVector() below per candidate, to avoid redundant embed calls.
 */
export async function semanticRelevance(
  question: string,
  factContent: string,
  ollamaBaseUrl?: string,
): Promise<number | null> {
  const questionVec = await ollamaManager.embed(question);
  if (!questionVec) return null;
  return semanticRelevanceFromVector(questionVec, factContent, ollamaBaseUrl);
}

/**
 * Same scoring as semanticRelevance() above, but takes a PRECOMPUTED question-embedding vector
 * so a caller scoring N candidate facts against one question embeds the question exactly ONCE
 * and reuses that vector across all N fact-embed calls. Fail-soft: returns null (never throws)
 * if the fact-embed call fails.
 */
export async function semanticRelevanceFromVector(
  questionVec: number[],
  factContent: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- see file header: reserved,
  // currently inert because ollamaManager.embed() takes no base-URL argument.
  ollamaBaseUrl?: string,
): Promise<number | null> {
  const factVec = await ollamaManager.embed(factContent);
  if (!factVec) return null;
  return cosineSimilarity(questionVec, factVec);
}
