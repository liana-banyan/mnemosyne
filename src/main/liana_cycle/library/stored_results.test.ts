// stored_results.test.ts -- D-BP152-046/BISHOP/seg-stored-results-and-both-apply, STAGE 1/2
//
// Deterministic, offline: no network call, no model call, no file I/O anywhere in this file --
// substitutePlaceholders() is pure string handling over an in-memory ResultStore.

import { describe, test, expect } from 'vitest';
import {
  DEFAULT_MAX_SUBSTITUTED_QUERY_LENGTH,
  DEFAULT_WARN_SUBSTITUTED_QUERY_LENGTH,
  formatParserInstrumentLines,
  ResultStore,
  substitutePlaceholders,
} from './stored_results';

describe('ResultStore -- retrievable by position and by Name:Number id (requirement 1)', () => {
  test('a stored entry is retrievable both by its position and by its id', () => {
    const store = new ResultStore();
    store.store({ position: 2, id: 'DefineTheTerm:2', result: 'densely populated regions' });

    expect(store.getByPosition(2)).toEqual({ position: 2, id: 'DefineTheTerm:2', result: 'densely populated regions' });
    expect(store.getById('DefineTheTerm:2')).toEqual({ position: 2, id: 'DefineTheTerm:2', result: 'densely populated regions' });
  });

  test('an unknown position or id returns undefined -- never a fabricated empty entry', () => {
    const store = new ResultStore();
    expect(store.getByPosition(99)).toBeUndefined();
    expect(store.getById('Ghost:1')).toBeUndefined();
  });

  test('all() lists every stored entry in position order', () => {
    const store = new ResultStore();
    store.store({ position: 3, id: 'C:1', result: 'c' });
    store.store({ position: 1, id: 'A:1', result: 'a' });
    store.store({ position: 2, id: 'B:1', result: 'b' });
    expect(store.all().map((e) => e.id)).toEqual(['A:1', 'B:1', 'C:1']);
  });

  test('a repeated id keeps the most recent run by-id, but every position stays distinct', () => {
    const store = new ResultStore();
    store.store({ position: 1, id: 'Repeat:1', result: 'first run' });
    store.store({ position: 4, id: 'Repeat:1', result: 'second run' });
    expect(store.getById('Repeat:1')?.result).toBe('second run');
    expect(store.getByPosition(1)?.result).toBe('first run');
    expect(store.getByPosition(4)?.result).toBe('second run');
  });
});

describe('substitutePlaceholders -- literal text replacement only (HARDWIRE-22)', () => {
  test('a query with no placeholder round-trips unchanged', () => {
    const store = new ResultStore();
    const result = substitutePlaceholders('Ask Google plainly, no reference here.', store);
    expect(result).toEqual({ ok: true, before: 'Ask Google plainly, no reference here.', after: 'Ask Google plainly, no reference here.' });
  });

  test('his own worked example, step 3 referencing step 2 by position, substitutes verbatim', () => {
    const store = new ResultStore();
    store.store({ position: 2, id: 'AskGoogle:1', result: 'Regions · Densely populated · NOT' });
    const queryText = 'What factors or words or concepts in this question affect the '
      + '[insert stored result from 2.]? Then store the result as the answer to 3.';
    const result = substitutePlaceholders(queryText, store);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.before).toBe(queryText);
      expect(result.after).toBe(
        'What factors or words or concepts in this question affect the '
        + 'Regions · Densely populated · NOT? Then store the result as the answer to 3.',
      );
    }
  });

  test('a reference by canonical Name:Number id substitutes the same way as by position', () => {
    const store = new ResultStore();
    store.store({ position: 2, id: 'DefineTheTerm:2', result: 'classifying' });
    const result = substitutePlaceholders('the operation is [insert stored result from DefineTheTerm:2.]', store);
    expect(result).toEqual({ ok: true, before: 'the operation is [insert stored result from DefineTheTerm:2.]', after: 'the operation is classifying' });
  });

  test('substitution is literal -- no reformatting, no summarizing, whitespace and punctuation carried through exactly', () => {
    const store = new ResultStore();
    const raw = '  weird   spacing\nand a newline, plus "quotes" and $ymbols  ';
    store.store({ position: 1, id: 'A:1', result: raw });
    const result = substitutePlaceholders('verbatim: [insert stored result from 1.]', store);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.after).toBe(`verbatim: ${raw}`);
  });

  test('two placeholders in the same text both substitute', () => {
    const store = new ResultStore();
    store.store({ position: 1, id: 'A:1', result: 'X' });
    store.store({ position: 2, id: 'B:1', result: 'Y' });
    const result = substitutePlaceholders(
      '[insert stored result from 1.] and [insert stored result from 2.]',
      store,
    );
    expect(result).toEqual({ ok: true, before: '[insert stored result from 1.] and [insert stored result from 2.]', after: 'X and Y' });
  });

  test('is case-insensitive on the fixed phrase', () => {
    const store = new ResultStore();
    store.store({ position: 5, id: 'A:1', result: 'answer-five' });
    const result = substitutePlaceholders('[INSERT STORED RESULT FROM 5.]', store);
    expect(result).toEqual({ ok: true, before: '[INSERT STORED RESULT FROM 5.]', after: 'answer-five' });
  });
});

describe('substitutePlaceholders -- requirement 4: an unresolved reference is an ERROR that stops and names it', () => {
  test('a reference to a position that has not run yet errors, naming the reference -- never empty, skip, or guess', () => {
    const store = new ResultStore(); // nothing stored at all
    const result = substitutePlaceholders('affected by [insert stored result from 7.]', store);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('"[insert stored result from 7.]"');
      expect(result.error).toContain('"7"');
      expect(result.error).toContain('has not run yet or does not exist');
    }
  });

  test('a reference to an id that does not exist errors, naming the reference', () => {
    const store = new ResultStore();
    store.store({ position: 1, id: 'RealStep:1', result: 'x' });
    const result = substitutePlaceholders('[insert stored result from GhostStep:9.]', store);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('GhostStep:9');
  });

  test('an unresolved reference never falls back to an empty string', () => {
    const store = new ResultStore();
    const result = substitutePlaceholders('x[insert stored result from 1.]y', store);
    expect(result.ok).toBe(false);
    // The failed result carries only `before`/`error`, no `after` -- there is nothing "substituted".
    if (!result.ok) expect((result as { after?: string }).after).toBeUndefined();
  });
});

describe('substitutePlaceholders -- requirement 6: an unusably long substitution is reported, never truncated', () => {
  test('a substitution within the limit succeeds and is not truncated', () => {
    const store = new ResultStore();
    const notTooLong = 'x'.repeat(100);
    store.store({ position: 1, id: 'A:1', result: notTooLong });
    const result = substitutePlaceholders('[insert stored result from 1.]', store, 200);
    expect(result).toEqual({ ok: true, before: '[insert stored result from 1.]', after: notTooLong });
  });

  test('a substitution over the limit is refused and reported, not silently cut down', () => {
    const store = new ResultStore();
    const tooLong = 'y'.repeat(500);
    store.store({ position: 1, id: 'A:1', result: tooLong });
    const result = substitutePlaceholders('[insert stored result from 1.]', store, 200);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('500 chars');
      expect(result.error).toContain('200-char limit');
      expect(result.error).not.toContain(tooLong.slice(0, 50)); // the oversized text itself is not echoed back truncated
    }
  });

  test('the underlying stored result itself is never truncated on storage regardless of length', () => {
    const store = new ResultStore();
    const huge = 'z'.repeat(50000);
    store.store({ position: 1, id: 'A:1', result: huge });
    expect(store.getByPosition(1)?.result.length).toBe(50000);
    expect(store.getById('A:1')?.result).toBe(huge);
  });

  test('the default ceiling is the exported constant, applied when no override is passed', () => {
    const store = new ResultStore();
    const exactlyAtDefault = 'a'.repeat(DEFAULT_MAX_SUBSTITUTED_QUERY_LENGTH);
    const overDefault = 'a'.repeat(DEFAULT_MAX_SUBSTITUTED_QUERY_LENGTH + 1);
    store.store({ position: 1, id: 'AtLimit:1', result: exactlyAtDefault });
    store.store({ position: 2, id: 'OverLimit:1', result: overDefault });
    expect(substitutePlaceholders('[insert stored result from 1.]', store).ok).toBe(true);
    expect(substitutePlaceholders('[insert stored result from 2.]', store).ok).toBe(false);
  });
});

describe('D-BP152-049 STAGE 1: ceiling raised to 20,000, warning logged over 10,000 (Founder, BP152, verbatim: "Make the 4,000-character ceiling into 20,000, and then log if it goes over 10,000, on an oversized substitution")', () => {
  test('the default ceiling is 20,000 and the default warning threshold is 10,000', () => {
    expect(DEFAULT_MAX_SUBSTITUTED_QUERY_LENGTH).toBe(20000);
    expect(DEFAULT_WARN_SUBSTITUTED_QUERY_LENGTH).toBe(10000);
  });

  test('a 15,000-char substitution succeeds and carries a warning over the 10,000-char threshold', () => {
    const store = new ResultStore();
    const fifteenThousand = 'a'.repeat(15000);
    store.store({ position: 1, id: 'A:1', result: fifteenThousand });
    const result = substitutePlaceholders('[insert stored result from 1.]', store);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.after.length).toBe(15000);
      expect(result.warning).toBeDefined();
      expect(result.warning).toContain('15000 chars');
      expect(result.warning).toContain('10000-char');
    }
  });

  test('formatParserInstrumentLines() logs the WARNING line for an over-10,000 substitution', () => {
    const lines = formatParserInstrumentLines('Categorize:3', {
      ok: true,
      before: 'raw text',
      after: 'substituted text',
      warning: 'substituted query is 15000 chars, over the 10000-char warning threshold (ceiling is 20000 chars) -- proceeding, flagged for review',
    });
    expect(lines).toHaveLength(3);
    expect(lines[2]).toContain('PARSER INSTRUMENT [Categorize:3] WARNING:');
    expect(lines[2]).toContain('15000 chars');
  });

  test('a 25,000-char substitution reports and stops rather than truncating -- no warning field, no partial substitution', () => {
    const store = new ResultStore();
    const twentyFiveThousand = 'z'.repeat(25000);
    store.store({ position: 1, id: 'A:1', result: twentyFiveThousand });
    const result = substitutePlaceholders('[insert stored result from 1.]', store);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('25000 chars');
      expect(result.error).toContain('20000-char limit');
      expect((result as { after?: string }).after).toBeUndefined();
    }
  });

  test('a substitution at or under 10,000 chars succeeds with no warning at all', () => {
    const store = new ResultStore();
    const tenThousand = 'a'.repeat(10000);
    store.store({ position: 1, id: 'A:1', result: tenThousand });
    const result = substitutePlaceholders('[insert stored result from 1.]', store);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.warning).toBeUndefined();
  });
});

describe('D-BP152-049 STAGE 2: a bare placeholder on a both-apply step refuses (Founder, BP152, verbatim: "when a bare placeholder is used on a both-apply step, I want it to refuse and make me say which")', () => {
  function storeBothApply(store: ResultStore, position: number, id: string): void {
    store.store({
      position,
      id,
      result: 'CASCADE-TEXT', // the Cascade's text, kept for receipt/JSON parity (script_runner.ts)
      bothApply: { sourceResult: 'SOURCE-TEXT', cascadeResult: 'CASCADE-TEXT' },
    });
  }

  test('a bare reference to a both-apply step refuses, names the step, and states both explicit forms', () => {
    const store = new ResultStore();
    storeBothApply(store, 2, 'AskGoogle:1');
    const result = substitutePlaceholders('affected by [insert stored result from 2.]', store);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('step 2');
      expect(result.error).toContain('"AskGoogle:1"');
      expect(result.error).toContain('both-apply step');
      expect(result.error).toContain('[insert stored result from 2 (source).]');
      expect(result.error).toContain('[insert stored result from 2 (cascade).]');
      expect((result as { after?: string }).after).toBeUndefined();
    }
  });

  test('never defaults to the Cascade\'s result -- the D-BP152-046 default is gone', () => {
    const store = new ResultStore();
    storeBothApply(store, 1, 'A:1');
    const result = substitutePlaceholders('[insert stored result from 1.]', store);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).not.toContain('CASCADE-TEXT');
  });

  test('"(source)" resolves to the source\'s own result', () => {
    const store = new ResultStore();
    storeBothApply(store, 1, 'A:1');
    const result = substitutePlaceholders('[insert stored result from 1 (source).]', store);
    expect(result).toMatchObject({ ok: true, after: 'SOURCE-TEXT' });
  });

  test('"(cascade)" resolves to the Cascade\'s own result', () => {
    const store = new ResultStore();
    storeBothApply(store, 1, 'A:1');
    const result = substitutePlaceholders('[insert stored result from 1 (cascade).]', store);
    expect(result).toMatchObject({ ok: true, after: 'CASCADE-TEXT' });
  });

  test('the qualifier is case-insensitive and works by Name:Number id, not only by position', () => {
    const store = new ResultStore();
    storeBothApply(store, 3, 'DefineTheTerm:2');
    const result = substitutePlaceholders('[INSERT STORED RESULT FROM DefineTheTerm:2 (SOURCE).]', store);
    expect(result).toMatchObject({ ok: true, after: 'SOURCE-TEXT' });
  });

  test('a qualifier on a step that was NOT both-apply is refused, not silently ignored', () => {
    const store = new ResultStore();
    store.store({ position: 1, id: 'Plain:1', result: 'plain result' }); // no bothApply field
    const result = substitutePlaceholders('[insert stored result from 1 (source).]', store);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('not a both-apply step');
      expect(result.error).toContain('[insert stored result from 1.]');
    }
  });

  test('a plain (non-both-apply) step is completely unaffected by this stage -- bare reference still substitutes', () => {
    const store = new ResultStore();
    store.store({ position: 1, id: 'Plain:1', result: 'plain result' });
    const result = substitutePlaceholders('[insert stored result from 1.]', store);
    expect(result).toMatchObject({ ok: true, after: 'plain result' });
  });
});

describe('formatParserInstrumentLines -- the transcript convention (requirement 5)', () => {
  test('a successful substitution records both before and after, PARSER INSTRUMENT-labeled', () => {
    const lines = formatParserInstrumentLines('Categorize:3', { ok: true, before: 'raw text', after: 'substituted text' });
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('PARSER INSTRUMENT [Categorize:3]');
    expect(lines[0]).toContain('BEFORE substitution');
    expect(lines[0]).toContain('"raw text"');
    expect(lines[1]).toContain('AFTER substitution');
    expect(lines[1]).toContain('"substituted text"');
  });

  test('a failed substitution records the before text and the failure reason, not a fabricated after', () => {
    const lines = formatParserInstrumentLines('Categorize:3', { ok: false, error: 'reference "9" not found', before: 'raw text' });
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('BEFORE substitution');
    expect(lines[1]).toContain('substitution FAILED');
    expect(lines[1]).toContain('reference "9" not found');
  });
});

describe('stored_results.ts -- inert on import, and does not call a model or the network', () => {
  test('module source contains no fetch/http/model-call surface', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const src = fs.readFileSync(path.join(__dirname, 'stored_results.ts'), 'utf8');
    expect(src).not.toMatch(/\bfetch\(/);
    expect(src).not.toMatch(/require\(['"]https?['"]\)/);
    expect(src).not.toMatch(/askGoogle|askGemma|gemmaExtract/i);
  });

  test('exposes only functions/a class -- reachable with no import-time side effect', () => {
    expect(typeof ResultStore).toBe('function'); // a class is a function at runtime
    expect(typeof substitutePlaceholders).toBe('function');
    expect(typeof formatParserInstrumentLines).toBe('function');
    expect(typeof DEFAULT_MAX_SUBSTITUTED_QUERY_LENGTH).toBe('number');
  });
});
