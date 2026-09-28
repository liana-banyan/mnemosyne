// near_match_suggestion.ts -- D-BP223-X043-002-A (MnemosyneC 0.9.40)
//
// FOUNDER RULING: a near match becomes a SUGGESTION, never the served answer. An EXACT match
// (same normalized question, same card) still serves from the record as it always has.
//
// Why: the chat path used to auto-serve a stored answer whenever the embedding (SimHash)
// similarity between the new question and a stored question cleared SEMANTIC_SERVE_THRESHOLD
// (0.85). Similar is not the same. "What is Ayn Rand's birthday?" was served a stored Mark Twain
// answer; any same-template, different-subject pair can land on the wrong side of a fixed bar.
// So similarity alone may no longer short-circuit the model call. The question goes to the normal
// answer path and the response carries a separate `nearMatchSuggestion` the renderer shows as
// "A similar question was answered before: open it?".
//
// This module is deliberately pure (no electron, no filesystem) so the decision can be proven
// by a vitest suite without standing up the ai-dispatch:query IPC handler.

import type { VerifiedEbletEntry } from './mnem_eblet_store';

/** What the renderer receives when a stored question was similar but not identical. */
export interface NearMatchSuggestion {
  /** The stored question that was similar (not the user's question). */
  question: string;
  /** The stored answer to THAT question, shown only when the user chooses to open it. */
  answer: string;
  /** Similarity score in [0, 1] that cleared the suggestion bar. */
  similarity: number;
  /** Card address of the stored record: its content hash (VerifiedEbletEntry.sha256). Absent
   *  only when the source (the CSIA Psionic graph walk) does not carry the record's hash. */
  ebletId?: string;
  provenance: string;
  verified: boolean;
}

export type NearMatchDecision =
  | { action: 'serve'; entry: VerifiedEbletEntry; similarity: number }
  | { action: 'suggest'; suggestion: NearMatchSuggestion }
  | { action: 'none' };

/** The one normalization the exact-match serve gate has always used: trim + lowercase. */
export function normalizeQuestionForExactMatch(q: string): string {
  return (q ?? '').trim().toLowerCase();
}

export function isExactQuestionMatch(a: string, b: string): boolean {
  const na = normalizeQuestionForExactMatch(a);
  return na.length > 0 && na === normalizeQuestionForExactMatch(b);
}

export function toNearMatchSuggestion(entry: VerifiedEbletEntry, similarity: number): NearMatchSuggestion {
  return {
    question: entry.question,
    answer: entry.answer,
    similarity,
    ebletId: entry.sha256,
    provenance: entry.provenance,
    verified: entry.verified,
  };
}

/**
 * Decide what a semantic nearest-neighbour hit is allowed to do.
 *  - EXACT normalized question match: 'serve' (unchanged exact-match behavior).
 *  - Not exact, similarity >= threshold: 'suggest' only. The caller MUST NOT serve it and
 *    MUST continue to the normal answer path.
 *  - Otherwise: 'none'.
 * `threshold` is SEMANTIC_SERVE_THRESHOLD at the call site (its meaning is now "suggestion bar").
 */
export function decideSemanticNearMatch(
  currentTurnQuestion: string,
  nearest: { entry: VerifiedEbletEntry; similarity: number } | null | undefined,
  threshold: number,
): NearMatchDecision {
  if (!nearest) return { action: 'none' };
  if (isExactQuestionMatch(currentTurnQuestion, nearest.entry.question)) {
    return { action: 'serve', entry: nearest.entry, similarity: nearest.similarity };
  }
  if (nearest.similarity >= threshold) {
    return { action: 'suggest', suggestion: toNearMatchSuggestion(nearest.entry, nearest.similarity) };
  }
  return { action: 'none' };
}
