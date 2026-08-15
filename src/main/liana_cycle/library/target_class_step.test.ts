// target_class_step.test.ts -- D-BP154-058/BISHOP-SEG/S52/seg-wiregate PART 5
//
// FAIL-BEFORE / PASS-AFTER for 'TargetClass:1'. Same boundary as boundary_step.test.ts's own
// header: the pure parts (query text, span verification, frame-context builder) are exercised
// directly; runTargetClassStep() itself calls a live conversational authority and a live Ollama
// extraction, neither available under vitest -- proven by an in-app run instead.
//
// FAIL-BEFORE: every test below FAILS on main before this ticket, because target_class_step.ts did
// not exist -- the import at the top of this file alone throws "Cannot find module
// './target_class_step'".

import { describe, test, expect } from 'vitest';
import {
  buildTargetClassQuery, registerTargetClassStep, runTargetClassStep, targetClassFrameContext,
  verifyTargetClassMembers,
} from './target_class_step';
import type { TargetClassResult } from './target_class_step';
import { listComposerRegistry } from './script_bridge';
import type { MethodQuestionInput, MethodRunContext } from '../method_registry';

describe('buildTargetClassQuery -- names the curriculum construct directly, asks for an enumerated, named answer', () => {
  test('asks for the major world human population concentrations, by name, in order, none omitted', () => {
    const q = buildTargetClassQuery();
    expect(q).toMatch(/major world human population concentrations/);
    expect(q).toMatch(/curriculum/);
    expect(q).toMatch(/List them by name/);
    expect(q).toMatch(/do not omit any/);
  });
});

describe('verifyTargetClassMembers -- extraction only, verified span or discarded (HARDWIRE-22)', () => {
  const passage = 'Standard AP Human Geography instructional materials identify East Asia, South '
    + 'Asia, Southeast Asia, and Europe as major world population clusters. A northeastern North '
    + 'American concentration is also conventionally recognized.';

  test('a member with a verbatim span is kept', () => {
    const raw = [{ name: 'East Asia', span: 'Standard AP Human Geography instructional materials identify East Asia, South Asia, Southeast Asia, and Europe as major world population clusters.' }];
    const { members, discarded } = verifyTargetClassMembers(raw, passage);
    expect(members).toEqual([{ name: 'East Asia', span: raw[0].span }]);
    expect(discarded).toBe(0);
  });

  test('multiple members verified in one pass, in the order the extraction returned them', () => {
    const raw = [
      { name: 'East Asia', span: 'Standard AP Human Geography instructional materials identify East Asia, South Asia, Southeast Asia, and Europe as major world population clusters.' },
      { name: 'Europe', span: 'Standard AP Human Geography instructional materials identify East Asia, South Asia, Southeast Asia, and Europe as major world population clusters.' },
    ];
    const { members } = verifyTargetClassMembers(raw, passage);
    expect(members.map((m) => m.name)).toEqual(['East Asia', 'Europe']);
  });

  test('discards a member whose span is not verbatim in the passage', () => {
    const raw = [{ name: 'East Asia', span: 'this sentence does not appear anywhere in the passage' }];
    const { members, discarded } = verifyTargetClassMembers(raw, passage);
    expect(members).toEqual([]);
    expect(discarded).toBe(1);
  });

  test('discards a member whose span does not actually contain its own name', () => {
    const raw = [{ name: 'East Asia', span: 'A northeastern North American concentration is also conventionally recognized.' }];
    const { members, discarded } = verifyTargetClassMembers(raw, passage);
    expect(members).toEqual([]);
    expect(discarded).toBe(1);
  });

  test('a missing span is discarded and counted -- no span, no member', () => {
    const raw = [{ name: 'East Asia', span: '' }];
    const { members, discarded } = verifyTargetClassMembers(raw, passage);
    expect(members).toEqual([]);
    expect(discarded).toBe(1);
  });

  test('a repeat name is kept once, not double-counted', () => {
    const raw = [
      { name: 'East Asia', span: 'Standard AP Human Geography instructional materials identify East Asia, South Asia, Southeast Asia, and Europe as major world population clusters.' },
      { name: 'East Asia', span: 'Standard AP Human Geography instructional materials identify East Asia, South Asia, Southeast Asia, and Europe as major world population clusters.' },
    ];
    const { members } = verifyTargetClassMembers(raw, passage);
    expect(members).toHaveLength(1);
  });

  test('never invents a member the passage never named -- an empty extraction produces an empty result, no discard', () => {
    const { members, discarded } = verifyTargetClassMembers([], passage);
    expect(members).toEqual([]);
    expect(discarded).toBe(0);
  });
});

describe('targetClassFrameContext -- builds an optional frame clause ONLY from already-verified members, never a fabricated frame', () => {
  test('returns empty string when the result is null', () => {
    expect(targetClassFrameContext(null)).toBe('');
  });

  test('returns empty string when the result did not establish (ok:false)', () => {
    const r: TargetClassResult = {
      ok: false, query: 'q', targetClass: 'major world human population concentrations',
      established: false, members: [], discarded: 0, citations: [], via: 'n/a', error: 'x',
    };
    expect(targetClassFrameContext(r)).toBe('');
  });

  test('returns empty string when established is true but members is empty (defensive -- should not happen, but never fabricates a frame anyway)', () => {
    const r: TargetClassResult = {
      ok: true, query: 'q', targetClass: 'major world human population concentrations',
      established: true, members: [], discarded: 0, citations: [], via: 'test',
    };
    expect(targetClassFrameContext(r)).toBe('');
  });

  test('WIRING PROOF: builds a non-empty frame clause naming the established target class and its verified members, verbatim', () => {
    const r: TargetClassResult = {
      ok: true, query: 'q', targetClass: 'major world human population concentrations',
      established: true,
      members: [
        { name: 'East Asia', span: 'x' },
        { name: 'South Asia', span: 'y' },
      ],
      discarded: 0, citations: ['https://example.org/source'], via: 'test',
    };
    const ctxText = targetClassFrameContext(r);
    expect(ctxText).toMatch(/major world human population concentrations/);
    expect(ctxText).toMatch(/East Asia/);
    expect(ctxText).toMatch(/South Asia/);
  });
});

describe('runTargetClassStep -- named failures, honest and pure enough to test without a live authority', () => {
  test('fails honestly when neither Perplexity nor the default conversational authority is wired', async () => {
    const input: MethodQuestionInput = { question: 'q?', options: null };
    const ctx: MethodRunContext = { askGoogle: async () => null, emit: () => {} };
    const { result } = await runTargetClassStep(input, ctx);
    expect(result.ok).toBe(false);
    expect(result.established).toBe(false);
    expect(result.error).toMatch(/UNAVAILABLE/);
  });
});

describe('registerTargetClassStep / listComposerRegistry -- TargetClass:1 is registered and executable', () => {
  test('TargetClass:1 appears in the composer registry and is marked executable', () => {
    registerTargetClassStep();
    const entries = listComposerRegistry();
    const entry = entries.find((e) => e.id === 'TargetClass:1');
    expect(entry).toBeDefined();
    expect(entry?.executable).toBe(true);
  });
});
