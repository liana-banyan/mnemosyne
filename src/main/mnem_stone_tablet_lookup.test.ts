// D-BP223-BM0-X030-059 wire 3 offline proof: the MnemosyneC Stone Tablet reader makes the SAME exact-hit decision as the
// Python hook on every case dumped by dump_parity_cases.py (67 rulings x 4 ask forms + Conduit message bodies), and fails
// open with a reason when no lookup file exists. Skips (does not fail) on a machine without the estate files.
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import { stoneTabletMatch, newestLookup, scoreTablets, gateStoneTabletByRank1, stoneTabletAgreesWithRank1, decideRuleB, type StoneTabletMatch, type RuleBOptions } from './mnem_stone_tablet_lookup';
import * as path from 'path';

const CASES = 'C:\\Users\\Administrator\\Documents\\LianaBanyanPlatform\\BISHOP_DROPZONE\\D-BP223-BM0-X030-059-INCEPTION-KEYSTONE-MINERS\\parity_cases.json';
const haveEstate = fs.existsSync(CASES) && !!newestLookup();
const PERRULING = String.raw`C:\Users\Administrator\Documents\LianaBanyanPlatform\HARDWIRE\LEDGER\STONE_TABLETS\stone_tablet_lookup_FULL_perruling_20260917T015018Z.json`;

describe('mnem_stone_tablet_lookup (X030-059)', () => {
  it('fails open with a reason when the lookup root is missing', () => {
    const r = stoneTabletMatch('accuracy against gold kappa graders', 'C:\\nonexistent_x059_root');
    expect(r.matchType).toBe('none');
    expect(r.reason).toMatch(/no stone_tablet_lookup/);
    expect(r.modelCalls).toBe(0);
  });

  it.runIf(haveEstate)('matches the Python hook exact-hit decision on every parity case', () => {
    const d = JSON.parse(fs.readFileSync(CASES, 'utf8')) as { lookup: string; cases: { ask: string; hit: number | null; top: number | null }[] };
    const lookup = JSON.parse(fs.readFileSync(d.lookup, 'utf8'));
    let same = 0; let topSame = 0;
    for (const c of d.cases) {
      const ranked = scoreTablets(lookup, c.ask);
      const [j, s, n] = ranked[0] || [null, 0, 0];
      const second = ranked.length > 1 ? ranked[1][1] : 0;
      const hit = j !== null && n >= 2 && (second <= 0 || s >= 1.5 * second) ? j : null;
      if (hit === c.hit) same++;
      if ((ranked.length ? ranked[0][0] : null) === c.top) topSame++;
    }
    expect(same).toBe(d.cases.length);
    expect(topSame).toBe(d.cases.length);
  });

  it.runIf(haveEstate)('an exact hit hands over the ruling address first', () => {
    const d = JSON.parse(fs.readFileSync(CASES, 'utf8'));
    const r = stoneTabletMatch(d.cases[0].ask);
    expect(r.matchType).toBe('addressed');
    expect(r.address).toMatch(/^k\/[0-9a-f]{8}$/);
    expect(r.path).toMatch(/CONDUIT\\[0-9a-f]{8}\.md$/);
  });
});

// D-BP223-BM0-X030-103 XO addendum: a tablet hit that disagrees with the ranked search rank 1 is NOT served as the answer.
describe('stone tablet rank-1 gate (X030-103)', () => {
  const hit: StoneTabletMatch = { matchType: 'addressed', address: 'k/0f1df1be', keystoneId: 'KS-0f1df1be', phrase: 'accuracy against gold is not kappa', connector: 'k/0f1df1be', path: 'C:\\estate\\CONDUIT\\0f1df1be.md', celpane: '', related: [], tabletId: 'T1', score: 9, second: 2, terms: 3, dispatch: 'D-BP223-BM0-X030-059', modelCalls: 0 };
  const sibling = '[Two-machine-grader kappa on the X010-026 fifty] [category: ruling]\nk/9309cf4a ... 0.636 [0.467, 0.794]';
  const same = '[Accuracy against gold is not kappa] [category: ruling]\nk/0f1df1be a real kappa needs two independent graders';

  it('a tablet hit that DISAGREES with rank 1 is not served: no stoneTablet, only a hint with servedAsAnswer false', () => {
    const g = gateStoneTabletByRank1(hit, sibling);
    expect(g.stoneTablet).toBeUndefined();
    expect(g.stoneTabletHint?.servedAsAnswer).toBe(false);
    expect(g.stoneTabletHint?.rank1Agreement).toBe('disagrees');
  });
  it('a tablet hit with NO rank-1 record is a hint, not an answer', () => {
    const g = gateStoneTabletByRank1(hit, undefined);
    expect(g.stoneTablet).toBeUndefined();
    expect(g.stoneTabletHint?.rank1Agreement).toBe('no_rank1');
  });
  it('a tablet hit that AGREES with rank 1 (same k/ id) is served with servedAsAnswer true', () => {
    const g = gateStoneTabletByRank1(hit, same);
    expect(g.stoneTabletHint).toBeUndefined();
    expect(g.stoneTablet?.servedAsAnswer).toBe(true);
    expect(g.stoneTablet?.rank1Agreement).toBe('agrees');
  });
  it('agreement by record file name counts; a longer hex run containing the id does not', () => {
    expect(stoneTabletAgreesWithRank1(hit, 'see CONDUIT/0f1df1be.md')).toBe(true);
    expect(stoneTabletAgreesWithRank1({ ...hit, keystoneId: undefined, path: null }, 'sha aa0f1df1be99 unrelated')).toBe(false);
  });
  it('a non-exact lookup serves nothing', () => {
    expect(gateStoneTabletByRank1({ matchType: 'none', dispatch: 'x', modelCalls: 0 }, same)).toEqual({});
  });
  it('the mcp_server call site serves the tablet only through the rank-1 gate', () => {
    const src = fs.readFileSync(path.join(__dirname, 'mcp_server.ts'), 'utf8');
    expect(src).toMatch(/gateStoneTabletByRank1\(stone, eblets\[0\]\)/);
    expect(src).not.toMatch(/\{ stoneTablet: stone \}/);
    const call = src.indexOf('gateStoneTabletByRank1(stone');
    const search = src.indexOf('eblets = await queryEbletStore(args.question)');
    expect(search).toBeGreaterThan(-1);
    expect(call).toBeGreaterThan(search);
  });
});

// D-BP223-BM0-X030-124 RULE B: every branch, including abstain ("I don't know" plus hints).
describe('rule B decision (X030-124)', () => {
  const CON = 'C:\\estate\\CONDUIT\\';
  const A = CON + 'aaaaaaaa.md'; const B = CON + 'bbbbbbbb.md';
  const tab = (id: string): StoneTabletMatch => ({ matchType: 'addressed', address: 'k/' + id, keystoneId: 'ks_0123456789abcdef', phrase: 'a ruling', connector: null, path: CON + id + '.md', celpane: '', related: [], tabletId: 'T', score: 9, second: 2, terms: 3, dispatch: 'D-BP223-BM0-X030-059', modelCalls: 0 });
  const none: StoneTabletMatch = { matchType: 'none', dispatch: 'x', modelCalls: 0 };

  it('both rankings agree -> answer keyword_card_agree (path compare ignores case and slash style)', () => {
    const d = decideRuleB('x', { keywordRank1: A, cardRank1: A.toUpperCase().replace(/\\/g, '/'), tablet: tab('bbbbbbbb') });
    expect(d.decision).toBe('answer'); expect(d.via).toBe('keyword_card_agree'); expect(d.rankings).toBe('both');
  });
  it('both rankings disagree, tablet == keyword rank 1 -> answer by tablet, served', () => {
    const d = decideRuleB('x', { keywordRank1: A, cardRank1: B, tablet: tab('aaaaaaaa') });
    expect(d.decision).toBe('answer'); expect(d.via).toBe('tablet_equals_keyword_rank1');
    expect(d.answer?.id).toBe('k/aaaaaaaa'); expect(d.stoneTablet?.servedAsAnswer).toBe(true);
  });
  it('both rankings disagree, tablet == CARD rank 1 only -> abstain with "I don\'t know" and hints', () => {
    const d = decideRuleB('x', { keywordRank1: A, cardRank1: B, tablet: tab('bbbbbbbb') });
    expect(d.decision).toBe('abstain'); expect(d.via).toBe('tablet_not_keyword_rank1'); expect(d.say).toBe("I don't know"); expect(d.answer).toBeNull();
    expect(d.hints.some((h) => h.from === 'keyword' && h.path === A)).toBe(true);
    expect(d.hints.some((h) => h.from === 'card' && h.path === B)).toBe(true);
    expect(d.hints.some((h) => h.from === 'stone_tablet' && h.servedAsAnswer === false)).toBe(true);
    expect(d.stoneTablet).toBeUndefined(); expect(d.stoneTabletHint?.servedAsAnswer).toBe(false);
  });
  it('both rankings disagree, no tablet -> abstain rankings_disagree_no_tablet, hints deduplicated', () => {
    const d = decideRuleB('x', { keywordRank1: A, cardRank1: B, tablet: none, keywordTop: [A, B], cardTop: [B, A] });
    expect(d.decision).toBe('abstain'); expect(d.via).toBe('rankings_disagree_no_tablet'); expect(d.hints.length).toBe(2);
  });
  it('one ranking (an eblet snippet naming the k/ id) -> answer tablet_equals_rank1', () => {
    const d = decideRuleB('x', { rank1: '[Accuracy against gold] [category: ruling]\nk/aaaaaaaa two graders', tablet: tab('aaaaaaaa') });
    expect(d.decision).toBe('answer'); expect(d.via).toBe('tablet_equals_rank1'); expect(d.rankings).toBe('single_ranking');
  });
  it('one ranking naming another ruling -> abstain tablet_not_rank1, tablet is a hint', () => {
    const d = decideRuleB('x', { rank1: '[Sibling] [category: ruling]\nk/cccccccc', tablet: tab('aaaaaaaa') });
    expect(d.decision).toBe('abstain'); expect(d.via).toBe('tablet_not_rank1'); expect(d.stoneTabletHint?.rank1Agreement).toBe('disagrees');
  });
  it('one ranking, no tablet -> abstain one_ranking_no_tablet (rank 1 alone is never a rule B answer)', () => {
    const d = decideRuleB('x', { rank1: 'anything', tablet: none, rankedTop: ['anything', 'second'] });
    expect(d.decision).toBe('abstain'); expect(d.via).toBe('one_ranking_no_tablet'); expect(d.hints.length).toBe(2);
  });
  it('keyword rank 1 only, same path as the tablet -> answer; card only elsewhere -> abstain', () => {
    expect(decideRuleB('x', { keywordRank1: A, tablet: tab('aaaaaaaa') }).rankings).toBe('keyword_only');
    expect(decideRuleB('x', { keywordRank1: A, tablet: tab('aaaaaaaa') }).decision).toBe('answer');
    const d = decideRuleB('x', { cardRank1: B, tablet: tab('aaaaaaaa') });
    expect(d.decision).toBe('abstain'); expect(d.rankings).toBe('card_only');
  });
  it('no ranking -> abstain no_ranking; an exact tablet is a hint with rank1Agreement no_rank1', () => {
    const d = decideRuleB('x', { tablet: tab('aaaaaaaa') });
    expect(d.decision).toBe('abstain'); expect(d.via).toBe('no_ranking'); expect(d.stoneTabletHint?.rank1Agreement).toBe('no_rank1');
  });
  it('a missing lookup root fails open to abstain, never throws', () => {
    const d = decideRuleB('accuracy against gold kappa graders', { root: 'C:\\nonexistent_x124_root', keywordRank1: A, cardRank1: B });
    expect(d.decision).toBe('abstain'); expect(d.say).toBe("I don't know");
  });
  it('agrees with the Conduit twin on the same branch inputs (same via for every case)', () => {
    const cases: [RuleBOptions, string][] = [
      [{ keywordRank1: A, cardRank1: A, tablet: none }, 'keyword_card_agree'],
      [{ keywordRank1: A, cardRank1: B, tablet: tab('aaaaaaaa') }, 'tablet_equals_keyword_rank1'],
      [{ keywordRank1: A, cardRank1: B, tablet: tab('bbbbbbbb') }, 'tablet_not_keyword_rank1'],
      [{ rank1: 'x k/aaaaaaaa1 y', tablet: tab('aaaaaaaa') }, 'tablet_not_rank1'],
    ];
    for (const [o, via] of cases) expect(decideRuleB('x', o).via).toBe(via);
  });
  it.runIf(fs.existsSync(PERRULING))('reads an explicit per-ruling lookup file', () => {
    const r = stoneTabletMatch('zzqx', undefined, PERRULING);
    expect(r.lookupFile).toBe(PERRULING);
  });
  it('the mcp_server call site returns ruleB built from the tablet and eblets[0], after queryEbletStore', () => {
    const src = fs.readFileSync(path.join(__dirname, 'mcp_server.ts'), 'utf8');
    expect(src).toMatch(/decideRuleB\(args\.question, \{ tablet: stone, rank1: eblets\[0\] \?\? null, rankedTop: eblets\.slice\(0, 3\) \}\)/);
    expect(src.indexOf('decideRuleB(args.question')).toBeGreaterThan(src.indexOf('eblets = await queryEbletStore(args.question)'));
  });
});
