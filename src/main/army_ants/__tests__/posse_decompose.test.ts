/**
 * posse_decompose.test.ts — Unit tests for Posse Decomposition
 * BP092 · Caithedral™
 */
import { describe, test, expect, vi } from 'vitest';
import { decomposeQuestion, healthCheck } from '../posse_decompose';

// Mock fetch for relay insert + poll
vi.stubGlobal('fetch', vi.fn());

const MOCK_URL = 'https://mock.supabase.co';
const MOCK_KEY = 'test-key';
const MOCK_PEER = 'cb4ef450-0000-0000-0000-000000000000';

describe('decomposeQuestion', () => {
  test('returns 3 sub-claims from valid LLM JSON response', async () => {
    const mockSubClaims = [
      { sub_claim_text: 'What is the oxidation state of sulfur in H2SO4?', difficulty_class: 'MEDIUM', domain_hint: 'chemistry' },
      { sub_claim_text: 'Which option matches oxidation state +6?', difficulty_class: 'SHORT', domain_hint: 'chemistry' },
      { sub_claim_text: 'Is the answer consistent with acid-base behavior?', difficulty_class: 'HARD', domain_hint: 'chemistry' },
    ];

    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true, text: async () => JSON.stringify([{ id: 'route-1' }]),
      })  // POST relay_routes
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify([{
          route_id: 'route-1',
          answer_json: { response: JSON.stringify(mockSubClaims) },
          hex_reply: null,
        }]),
      })  // GET relay_route_replies
      .mockResolvedValue({ ok: true, text: async () => JSON.stringify([]) }); // posse_sub_claims INSERTs

    vi.stubGlobal('fetch', mockFetch);

    const result = await decomposeQuestion(
      'q-test-001',
      'What is the oxidation state of sulfur in H2SO4?',
      ['A) +2', 'B) +4', 'C) +6', 'D) +8'],
      'chemistry',
      MOCK_URL,
      MOCK_KEY,
      MOCK_PEER,
      5000,
    );

    expect(result.sub_claims).toHaveLength(3);
    expect(result.sub_claims[0].difficulty_class).toBe('MEDIUM');
    expect(result.sub_claims[2].difficulty_class).toBe('HARD');
    expect(result.parent_question_id).toBe('q-test-001');
    expect(result.decomposition_model).toContain('llama3.3:70b');
  });

  test('falls back to single sub-claim on malformed LLM response', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, text: async () => JSON.stringify([{ id: 'route-2' }]) })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify([{
          route_id: 'route-2',
          answer_json: { response: 'Sorry, I cannot decompose this.' },
          hex_reply: null,
        }]),
      })
      .mockResolvedValue({ ok: true, text: async () => JSON.stringify([]) })
    );

    const result = await decomposeQuestion(
      'q-test-002', 'Hard question', ['A', 'B', 'C', 'D'], 'math',
      MOCK_URL, MOCK_KEY, MOCK_PEER, 5000,
    );

    expect(result.sub_claims).toHaveLength(1);
    expect(result.sub_claims[0].difficulty_class).toBe('HARD');
    expect(result.sub_claims[0].sub_claim_text).toContain('Sorry');
  });

  test('handles timeout gracefully (no replies)', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, text: async () => JSON.stringify([{ id: 'route-3' }]) })
      .mockResolvedValue({ ok: true, text: async () => JSON.stringify([]) }) // empty polls
    );

    const result = await decomposeQuestion(
      'q-test-003', 'Timeout question', ['A', 'B'], 'physics',
      MOCK_URL, MOCK_KEY, MOCK_PEER, 100, // 100ms timeout — guaranteed timeout
    );

    // Should fall back to single sub-claim with DECOMPOSITION_FAILED
    expect(result.sub_claims).toHaveLength(1);
    expect(result.sub_claims[0].sub_claim_text).toBe('DECOMPOSITION_FAILED');
  });

  test('healthCheck returns ok=true', () => {
    expect(healthCheck().ok).toBe(true);
    expect(healthCheck().module).toBe('army_ants/posse_decompose');
  });
});
