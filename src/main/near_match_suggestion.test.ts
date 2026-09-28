// near_match_suggestion.test.ts -- D-BP223-X043-002-A (MnemosyneC 0.9.40)
//
// Regression for the Founder ruling "a near match becomes a SUGGESTION, never the served answer."
// Known failure it guards: "What is Ayn Rand's birthday?" was served a stored Mark Twain answer
// because a merely SIMILAR stored question cleared SEMANTIC_SERVE_THRESHOLD (0.85).
//
// Proves, against the REAL SEMANTIC_SERVE_THRESHOLD exported by mnem_eblet_store.ts:
//   1. a 0.86-similar, non-identical question is NOT served and yields a suggestion;
//   2. an identical question (same normalized text) IS served;
//   3. below the bar there is neither a serve nor a suggestion;
// plus a source-level check that ai_dispatch_ipc.ts no longer serves on similarity alone
// (ai_dispatch_ipc.ts imports electron at module scope, so it is inspected as text here, the
// same constraint ai_dispatch_ipc_vram_gate.test.ts documents).

import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { SEMANTIC_SERVE_THRESHOLD, type VerifiedEbletEntry } from './mnem_eblet_store';
import { decideSemanticNearMatch, isExactQuestionMatch, normalizeQuestionForExactMatch } from './near_match_suggestion';

function entry(question: string, answer: string): VerifiedEbletEntry {
  return {
    question,
    answer,
    provenance: 'spider:test:session',
    verified: true,
    sha256: 'a'.repeat(64),
    timestamp: 0,
  } as VerifiedEbletEntry;
}

const TWAIN = entry("What was Mark Twain's birthday?", 'Mark Twain was born on November 30, 1835.');

describe('near match is a suggestion, never the served answer (Founder ruling, 0.9.40)', () => {
  test('threshold is still the exported 0.85 (kept, new meaning: suggestion bar)', () => {
    expect(SEMANTIC_SERVE_THRESHOLD).toBe(0.85);
  });

  test('a 0.86-similar non-identical question is NOT served and yields a suggestion', () => {
    const d = decideSemanticNearMatch("What is Ayn Rand's birthday?", { entry: TWAIN, similarity: 0.86 }, SEMANTIC_SERVE_THRESHOLD);
    expect(d.action).toBe('suggest');
    expect(d.action).not.toBe('serve');
    if (d.action !== 'suggest') throw new Error('expected suggest');
    expect(d.suggestion.question).toBe(TWAIN.question);
    expect(d.suggestion.answer).toBe(TWAIN.answer);
    expect(d.suggestion.similarity).toBe(0.86);
    expect(d.suggestion.ebletId).toBe(TWAIN.sha256);
    expect(d.suggestion.provenance).toBe(TWAIN.provenance);
  });

  test('even a near-perfect 0.99 similarity is not served unless the question is identical', () => {
    const d = decideSemanticNearMatch("When was Mark Twain born?", { entry: TWAIN, similarity: 0.99 }, SEMANTIC_SERVE_THRESHOLD);
    expect(d.action).toBe('suggest');
  });

  test('an identical question IS served (exact match unchanged)', () => {
    const d = decideSemanticNearMatch("What was Mark Twain's birthday?", { entry: TWAIN, similarity: 1 }, SEMANTIC_SERVE_THRESHOLD);
    expect(d.action).toBe('serve');
    if (d.action !== 'serve') throw new Error('expected serve');
    expect(d.entry).toBe(TWAIN);
  });

  test('identical after the existing normalization (trim + lowercase) IS served', () => {
    const d = decideSemanticNearMatch("  what was MARK TWAIN's birthday?  ", { entry: TWAIN, similarity: 0.97 }, SEMANTIC_SERVE_THRESHOLD);
    expect(d.action).toBe('serve');
    expect(normalizeQuestionForExactMatch('  A B  ')).toBe('a b');
    expect(isExactQuestionMatch('', '')).toBe(false);
  });

  test('below the bar: neither served nor suggested; no nearest: nothing', () => {
    expect(decideSemanticNearMatch("What is Ayn Rand's birthday?", { entry: TWAIN, similarity: 0.84 }, SEMANTIC_SERVE_THRESHOLD).action).toBe('none');
    expect(decideSemanticNearMatch("What is Ayn Rand's birthday?", null, SEMANTIC_SERVE_THRESHOLD).action).toBe('none');
  });
});

describe('ai_dispatch_ipc.ts wiring (source-level)', () => {
  const src = readFileSync(resolve(__dirname, 'ai_dispatch_ipc.ts'), 'utf-8');

  test('the semantic serve gate goes through decideSemanticNearMatch, not a bare similarity check', () => {
    expect(src).toMatch(/decideSemanticNearMatch\(currentTurnQuestion, nearest, SEMANTIC_SERVE_THRESHOLD\)/);
    expect(src).toMatch(/nearDecision\.action === 'serve'/);
    expect(src).not.toMatch(/nearest\.similarity\s*>=\s*SEMANTIC_SERVE_THRESHOLD\s*\n?\s*\)\s*\{/);
  });

  test('the Psionic zero-model fast path also requires an exact question match', () => {
    expect(src).toMatch(/psionicDiscriminatingFloorPassed &&\s*\r?\n\s*psionicExactQuestionMatch\s*\r?\n\s*\)\s*\{/);
  });

  test('the normal answer path returns nearMatchSuggestion to the renderer', () => {
    expect(src).toMatch(/return \{ ok: true, streaming: true, \.\.\.\(nearMatchSuggestion \? \{ nearMatchSuggestion \} : \{\}\) \};/);
  });
});
