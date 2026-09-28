/**
 * mnem_stone_tablet_lookup.ts -- D-BP223-BM0-X030-059 INCEPTION, wire 3 of 3 (MnemosyneC relay).
 *
 * Founder k/dd7cc937: "Inception = the Keystone-to-Miner design (never built) ... needed, especially for a 5 billion context."
 * Founder k/97994e07 (via XO X030): "And yes BUILD AND WIRE THAT".
 *
 * Registering a Keystone queues a Miner; the Miner (X030-050 Shiver/Frenzy card, zero model calls) writes a Stone Tablet
 * holding the ruling's ADDRESS and its related addresses. stone_tablet_export.py (X030-059 folder) writes a portable lookup
 * file. mnem_query_substrate calls stoneTabletMatch() FIRST and returns an exact hit's addresses beside the eblet results.
 *
 * Same rule and numbers as the Conduit reader (conduit_stone_tablet_lookup.js, a CommonJS twin outside this build, which is
 * why this is a port and not an import) and the UserPromptSubmit hook (bishop_stone_tablet_userprompt_inject.py): BM25 over
 * tablet keys; exact only when top >= bypass_ratio (1.5) x second and >= 2 distinct non-stop terms. Anything else is
 * { matchType: 'none' } and nothing is served. Never throws. Read-only.
 * Root: env LB_STONE_TABLET_ROOT, else the estate path below; on a machine without it, 'none' with a reason.
 */
import * as fs from 'fs';
import * as path from 'path';

export const STONE_TABLET_DISPATCH = 'D-BP223-BM0-X030-059';
const DEFAULT_ROOT = 'C:\\Users\\Administrator\\Documents\\LianaBanyanPlatform\\HARDWIRE\\LEDGER\\STONE_TABLETS';
export const MIN_TERMS = 2;
const DEFAULT_RATIO = 1.5;
const WORD = /[\p{L}\p{M}\p{Nd}\p{Pc}]{2,}/gu;

interface LookupEntry {
  keystone_id: string; class: string; phrase: string; k: string[]; connectors: string[]; paths: string[];
  celpane: string; related: { connector: string; path: string }[]; tablet_id: string; inception_event_utc: string;
}
interface LookupFile {
  schema: string; stop: string[]; scoring?: { bypass_ratio?: number };
  sections: Record<string, { n: number; entries: LookupEntry[]; postings: Record<string, [number, number][]> }>;
  _file?: string;
}
export interface StoneTabletMatch {
  matchType: 'addressed' | 'none';
  reason?: string;
  /** D-BP223-BM0-X030-103: set by gateStoneTabletByRank1. true only when the tablet agrees with the ranked search's rank 1. */
  servedAsAnswer?: boolean;
  rank1Agreement?: 'agrees' | 'disagrees' | 'no_rank1';
  address?: string; keystoneId?: string; phrase?: string; connector?: string | null; path?: string | null; celpane?: string;
  related?: { connector: string; path: string }[]; tabletId?: string; score?: number; second?: number; terms?: number;
  lookupFile?: string; dispatch: string; modelCalls: 0;
}

let cache: { file: string | null; mtimeMs: number; data: LookupFile | null } = { file: null, mtimeMs: 0, data: null };

export function newestLookup(root?: string, sectionTag = 'keystone'): string | null {
  const dir = root || process.env.LB_STONE_TABLET_ROOT || DEFAULT_ROOT;
  let names: string[] = [];
  try { names = fs.readdirSync(dir); } catch { return null; }
  const re = new RegExp('^stone_tablet_lookup_FULL_' + sectionTag.replace(/-/g, '\\-') + '_2\\d{7}T\\d{6}Z\\.json$');
  const hits = names.filter((n) => re.test(n)).sort();
  return hits.length ? path.join(dir, hits[hits.length - 1]) : null;
}

function load(root?: string, file?: string): LookupFile | null {
  // D-BP223-BM0-X030-124: an explicit lookup file (tests and the rescore) wins over the newest-by-name rule.
  const f = file || newestLookup(root);
  if (!f) return null;
  const st = fs.statSync(f);
  if (cache.file === f && cache.mtimeMs === st.mtimeMs && cache.data) return cache.data;
  const data = JSON.parse(fs.readFileSync(f, 'utf8')) as LookupFile;
  data._file = f;
  cache = { file: f, mtimeMs: st.mtimeMs, data };
  return data;
}

export function scoreTablets(lookup: LookupFile, text: string, section = 'keystone'): [number, number, number][] {
  const sec = lookup.sections[section];
  if (!sec) return [];
  const stop = new Set(lookup.stop || []);
  const terms = new Set<string>();
  for (const w of String(text || '').toLowerCase().match(WORD) || []) if (!stop.has(w)) terms.add(w);
  const acc = new Map<number, [number, number]>();
  for (const t of terms) {
    if (!Object.prototype.hasOwnProperty.call(sec.postings, t)) continue;
    for (const [j, w] of sec.postings[t]) {
      const a = acc.get(j) || [0, 0];
      a[0] += w; a[1] += 1; acc.set(j, a);
    }
  }
  return [...acc.entries()].map(([j, [s, n]]) => [j, s, n] as [number, number, number]).sort((x, y) => (y[1] - x[1]) || (x[0] - y[0]));
}

/**
 * D-BP223-BM0-X030-103 (XO X030 addendum; measurement D-BP223-BM0-X030-100): an exact tablet hit is NOT an answer by itself.
 * FRESH60: fired 12, wrong 8. HELD50: fired 21, wrong 18. It names a sibling ruling with full confidence, and in every measured
 * case a wrong tablet address was NOT keyword rank 1. So the tablet is served as the answer (stoneTablet) only when the app's own
 * ranked search at the same call site returned a rank-1 record naming the SAME ruling: its k/ id (8 hex), keystone id, or the
 * tablet's record file name. Otherwise it is demoted to a hint (stoneTabletHint, servedAsAnswer false) and the ranked search
 * results stay the answer. Pure, never throws.
 */
export function stoneTabletAgreesWithRank1(stone: StoneTabletMatch, rank1: string | null | undefined): boolean {
  if (!stone || stone.matchType !== 'addressed' || !rank1) return false;
  const hay = String(rank1).toLowerCase();
  const keys: string[] = [];
  const kid = /^k\/([0-9a-f]{8})$/i.exec(String(stone.address || ''));
  if (kid) keys.push(kid[1].toLowerCase());
  if (stone.keystoneId && String(stone.keystoneId).length >= 8) keys.push(String(stone.keystoneId).toLowerCase());
  if (stone.path) { const base = String(stone.path).split(/[\\/]/).pop() || ''; if (base.length >= 8) keys.push(base.toLowerCase()); }
  return keys.some((k) => {
    if (/^[0-9a-f]{8}$/.test(k)) return new RegExp('(^|[^0-9a-f])' + k + '([^0-9a-f]|$)').test(hay);
    return hay.includes(k);
  });
}

export function gateStoneTabletByRank1(stone: StoneTabletMatch, rank1: string | null | undefined): { stoneTablet?: StoneTabletMatch; stoneTabletHint?: StoneTabletMatch } {
  if (!stone || stone.matchType !== 'addressed') return {};
  if (!rank1) return { stoneTabletHint: { ...stone, servedAsAnswer: false, rank1Agreement: 'no_rank1', reason: 'hint only: the ranked search returned no rank-1 record to confirm this tablet' } };
  if (stoneTabletAgreesWithRank1(stone, rank1)) return { stoneTablet: { ...stone, servedAsAnswer: true, rank1Agreement: 'agrees' } };
  return { stoneTabletHint: { ...stone, servedAsAnswer: false, rank1Agreement: 'disagrees', reason: 'hint only: the tablet address is not the ranked search rank 1 (X030-100: a lone tablet hit was wrong 8 of 12 on fresh rulings)' } };
}

export function stoneTabletMatch(text: string, root?: string, lookupFile?: string): StoneTabletMatch {
  const base = { dispatch: STONE_TABLET_DISPATCH, modelCalls: 0 as const };
  try {
    const lookup = load(root, lookupFile);
    if (!lookup) return { matchType: 'none', reason: 'no stone_tablet_lookup_FULL_keystone_*.json on this machine', ...base };
    const ranked = scoreTablets(lookup, String(text || '').slice(0, 4000));
    if (!ranked.length) return { matchType: 'none', reason: 'no tablet term matched', lookupFile: lookup._file, ...base };
    const [j, s, n] = ranked[0];
    const second = ranked.length > 1 ? ranked[1][1] : 0;
    const ratio = (lookup.scoring && lookup.scoring.bypass_ratio) || DEFAULT_RATIO;
    if (!(n >= MIN_TERMS && (second <= 0 || s >= ratio * second))) {
      return { matchType: 'none', reason: 'no exact tablet (top not >= ratio x second, or fewer than ' + MIN_TERMS + ' terms)', lookupFile: lookup._file, ...base };
    }
    const e = lookup.sections.keystone.entries[j];
    return {
      matchType: 'addressed', address: e.k && e.k.length ? 'k/' + e.k[0] : e.keystone_id, keystoneId: e.keystone_id, phrase: e.phrase,
      connector: (e.connectors || [])[0] || null, path: (e.paths || [])[0] || null, celpane: e.celpane || '',
      related: (e.related || []).slice(0, 3), tabletId: e.tablet_id, score: Math.round(s * 100) / 100, second: Math.round(second * 100) / 100, terms: n,
      lookupFile: lookup._file, ...base,
    };
  } catch (err) {
    return { matchType: 'none', reason: 'stone tablet lookup failed open: ' + String((err as Error)?.message || err), ...base };
  }
}

// ---- D-BP223-BM0-X030-124 RULE B (XO X030 decision, Founder delegated k/f106bbd0 "do as you said", k/df2b7913 "try it") ----
// Port of decideRuleB in conduit_stone_tablet_lookup.js (same branches, same agreement rule). Measured on X030-113 FRESH51B at
// full store: B 23 right / 4 wrong / 24 abstain vs the card alone 25 / 26 / 0; on 1,595 unregistered Founder messages the gate
// let through 0 of 103 per-ruling tablet misfires.
//   BOTH rankings: keyword rank 1 == card rank 1 -> answer; else an exact tablet whose address == keyword rank 1 -> answer;
//                  else abstain ("I don't know" plus the top candidates as hints).
//   ONE ranking:   an exact tablet whose address == that rank 1 -> answer; else abstain with hints.
//   NO ranking:    abstain; an exact tablet is a hint only.
// A record is a string (path, k/ id or text, e.g. a queryEbletStore snippet) or { id, path, text }. Pure; never throws.
export type RuleBRecord = string | { id?: string | null; address?: string | null; path?: string | null; text?: string | null } | null | undefined;
export interface RuleBHint { from: string; id: string | null; path: string | null; text: string | null; servedAsAnswer?: false }
export interface RuleBDecision {
  rule: 'B'; dispatch: 'D-BP223-BM0-X030-124'; modelCalls: 0;
  rankings: 'both' | 'keyword_only' | 'card_only' | 'single_ranking' | 'none';
  decision: 'answer' | 'abstain';
  via: 'keyword_card_agree' | 'tablet_equals_keyword_rank1' | 'tablet_equals_rank1' | 'tablet_not_keyword_rank1' | 'rankings_disagree_no_tablet'
    | 'tablet_not_rank1' | 'one_ranking_no_tablet' | 'no_ranking' | 'failed_open';
  answer: RuleBHint | null; say?: string; hints: RuleBHint[];
  stoneTablet?: StoneTabletMatch; stoneTabletHint?: StoneTabletMatch; error?: string;
}
export const RULE_B_IDK = "I don't know";
interface Rec { id: string | null; path: string | null; text: string | null }
function recOf(r: RuleBRecord): Rec | null {
  if (r == null || r === '') return null;
  if (typeof r === 'string') {
    const s = r.trim();
    if (!s) return null;
    if (/^k\/[0-9a-f]{8}$/i.test(s)) return { id: s.toLowerCase(), path: null, text: s };
    if (/^([A-Za-z]:)?[\\/]/.test(s) || (!/\s/.test(s) && /\.(md|json|jsonl|txt)$/i.test(s))) return { id: null, path: s, text: s };
    return { id: null, path: null, text: s };
  }
  if (typeof r !== 'object') return null;
  const o: Rec = { id: r.id != null ? String(r.id) : (r.address != null ? String(r.address) : null), path: r.path != null ? String(r.path) : null, text: r.text != null ? String(r.text) : null };
  return (o.id || o.path || o.text) ? o : null;
}
const normPath = (p: string | null | undefined) => String(p || '').replace(/\//g, '\\').toLowerCase();
export function ruleBSameRecord(a: RuleBRecord, b: RuleBRecord): boolean {
  const x = recOf(a); const y = recOf(b);
  if (!x || !y) return false;
  if (x.path && y.path) return normPath(x.path) === normPath(y.path);
  if (x.id && y.id) return x.id.toLowerCase() === y.id.toLowerCase();
  if (x.text != null && y.text != null && !x.path && !y.path && !x.id && !y.id) return x.text === y.text;
  return false;
}
/** The tablet agrees with a rank-1 record: equal paths when both have one; else the record names its k/ id (whole 8-hex token), keystone id or record file name. */
export function ruleBTabletAgrees(tablet: StoneTabletMatch | null | undefined, rank1: RuleBRecord): boolean {
  if (!tablet || tablet.matchType !== 'addressed') return false;
  const r = recOf(rank1);
  if (!r) return false;
  if (r.path && tablet.path) return normPath(r.path) === normPath(tablet.path);
  return stoneTabletAgreesWithRank1(tablet, [r.id, r.path, r.text].filter(Boolean).join(' '));
}
function hintOf(r: RuleBRecord, from: string): RuleBHint | null {
  const x = recOf(r);
  return x ? { from, id: x.id, path: x.path, text: x.text != null ? x.text.slice(0, 300) : null } : null;
}
export interface RuleBOptions {
  keywordRank1?: RuleBRecord; cardRank1?: RuleBRecord; rank1?: RuleBRecord;
  keywordTop?: RuleBRecord[]; cardTop?: RuleBRecord[]; rankedTop?: RuleBRecord[];
  /** a precomputed stoneTabletMatch result; when absent the lookup is read (root / lookupFile). */
  tablet?: StoneTabletMatch | null; root?: string; lookupFile?: string;
}
export function decideRuleB(text: string, opts: RuleBOptions = {}): RuleBDecision {
  const base = { rule: 'B' as const, dispatch: 'D-BP223-BM0-X030-124' as const, modelCalls: 0 as const };
  try {
    const kw1 = recOf(opts.keywordRank1); const c1 = recOf(opts.cardRank1); const r1 = recOf(opts.rank1);
    const tablet = opts.tablet !== undefined ? opts.tablet : stoneTabletMatch(text, opts.root, opts.lookupFile);
    const hasTablet = !!(tablet && tablet.matchType === 'addressed');
    const hints: RuleBHint[] = [];
    const push = (h: RuleBHint | null) => {
      if (h && !hints.some((x) => (h.path && x.path && normPath(h.path) === normPath(x.path)) || (h.id && x.id === h.id && !h.path && !x.path) || (!h.id && !h.path && !x.id && !x.path && h.text === x.text))) hints.push(h);
    };
    for (const c of (opts.keywordTop || []).slice(0, 3)) push(hintOf(c, 'keyword'));
    for (const c of (opts.cardTop || []).slice(0, 3)) push(hintOf(c, 'card'));
    for (const c of (opts.rankedTop || []).slice(0, 3)) push(hintOf(c, 'ranking'));
    push(hintOf(opts.keywordRank1, 'keyword')); push(hintOf(opts.cardRank1, 'card')); push(hintOf(opts.rank1, 'ranking'));
    const tabletAnswer = (): RuleBHint => ({ from: 'stone_tablet', id: tablet!.address || null, path: tablet!.path || null, text: tablet!.phrase || null });
    const abstain = (via: RuleBDecision['via'], rankings: RuleBDecision['rankings']): RuleBDecision => ({
      ...base, rankings, decision: 'abstain', via, answer: null, say: RULE_B_IDK,
      hints: hasTablet ? hints.concat([{ ...tabletAnswer(), servedAsAnswer: false }]) : hints,
      ...(hasTablet ? { stoneTabletHint: { ...tablet!, servedAsAnswer: false, rank1Agreement: via === 'no_ranking' ? 'no_rank1' as const : 'disagrees' as const } } : {}),
    });
    if (kw1 && c1) {
      if (ruleBSameRecord(kw1, c1)) return { ...base, rankings: 'both', decision: 'answer', via: 'keyword_card_agree', answer: { from: 'keyword_and_card', id: kw1.id, path: kw1.path || c1.path, text: kw1.text }, hints: [] };
      if (hasTablet && ruleBTabletAgrees(tablet, kw1)) return { ...base, rankings: 'both', decision: 'answer', via: 'tablet_equals_keyword_rank1', answer: tabletAnswer(), hints: [], stoneTablet: { ...tablet!, servedAsAnswer: true, rank1Agreement: 'agrees' } };
      return abstain(hasTablet ? 'tablet_not_keyword_rank1' : 'rankings_disagree_no_tablet', 'both');
    }
    const one = kw1 || c1 || r1;
    if (one) {
      const rankings = kw1 ? 'keyword_only' : (c1 ? 'card_only' : 'single_ranking');
      if (hasTablet && ruleBTabletAgrees(tablet, one)) return { ...base, rankings, decision: 'answer', via: 'tablet_equals_rank1', answer: tabletAnswer(), hints: [], stoneTablet: { ...tablet!, servedAsAnswer: true, rank1Agreement: 'agrees' } };
      return abstain(hasTablet ? 'tablet_not_rank1' : 'one_ranking_no_tablet', rankings);
    }
    return abstain('no_ranking', 'none');
  } catch (err) {
    return { ...base, rankings: 'none', decision: 'abstain', via: 'failed_open', answer: null, say: RULE_B_IDK, hints: [], error: String((err as Error)?.message || err) };
  }
}
