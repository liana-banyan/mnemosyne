/**
 * card_freshness.ts -- D-BP223-BM0-X030-073-STALE-STATE-AND-PRIVACY-FIXES
 *
 * STALE CUTOFF = C, PER CLASS, ON THE EXISTING DECAY SCORE. Founder k/0a8d1c96 (2026-09-17T00:16Z): "You pick, and tell
 * me what you picked, brick wall, again." XO X030 picked, encoded here exactly:
 *
 *   canon / Founder rulings   never decay (pheromone class 'anchor')
 *   volatile facts            prices, versions, counts, dates, "current/latest": "Prior record, re-verify" after 30 days
 *   everything else           after 180 days
 *   unknown class             = everything else (180 days)
 *
 * THE DECAY SCORE IS THE ONE ALREADY BUILT, NOT A NEW ONE. librarian-mcp\src\scribes\pheromone.ts decayScore() (lines
 * 669-699) is `matchStrength * exp(-ageDays / decay_constant_days)` with DEFAULT_DECAY_CONSTANT_DAYS = 30 (line 553) and
 * 'anchor' = no decay. Its comment calls 30 days a half-life; the formula makes 30 days the e-folding time, so the real
 * half-life is 30 * ln 2 = about 20.8 days. librarian-mcp is a different package and cannot be imported from the app, so
 * the formula is repeated here byte-for-byte in meaning, and the cutoff is expressed AS A SCORE: a card is aged when its
 * decay score falls below exp(-cutoffDays / 30). That is the same test as "older than cutoffDays", stated on his score.
 *
 * CORRECTIONS COME FIRST (Addendum never Deletion, k/26a0216c; appended correction, k/0d54d5fe). Before age is looked at,
 * the reuse check asks whether an APPENDED correction names this card: a supersede / correction record, or a correction
 * addendum. A corrected card is never served as the old answer. A correction only ever WITHHOLDS; it can never grant a
 * serve, so an unsigned correction row is honored (fail-safe direction) and its signed/unsigned status is reported.
 * A signed SOURCE addendum (card_source_contract.cjs addendum_type 'source') is not a correction: it re-sources the card,
 * so its retrieved_utc restarts the freshness clock.
 *
 * The Conduit twin is BISHOP_DROPZONE\MIC_CHANNEL\conduit\conduit_card_freshness.js; the drift test in
 * card_freshness.test.ts runs the same fixture table through both files.
 */

export const DECAY_CONSTANT_DAYS = 30; // pheromone.ts DEFAULT_DECAY_CONSTANT_DAYS
export const REAL_HALF_LIFE_DAYS = DECAY_CONSTANT_DAYS * Math.LN2; // ~20.79

export type FreshnessClass = 'canon' | 'volatile' | 'general';
export const CUTOFF_DAYS: Record<FreshnessClass, number> = { canon: Infinity, volatile: 30, general: 180 };

export type ReuseState = 'verified_reusable_answer' | 'prior_record_reverify' | 'corrected';
export const REUSE_LABELS: Record<ReuseState, string> = {
  verified_reusable_answer: 'Verified reusable answer',
  prior_record_reverify: 'Prior record, re-verify',
  corrected: 'Corrected: the old answer is not served',
};

export interface FreshnessCardMeta {
  question?: string;
  provenance?: string;
  freshness_class?: string;
  pheromone_class?: string;
  tags?: string[];
  /** ms epoch or ISO string: when the card was written or last confirmed */
  timestamp?: number | string;
  utc?: string;
  reverified_utc?: string;
  superseded_by?: string;
  sha256?: string;
  question_sha256?: string;
  method_sha256?: string;
  block?: string;
  qid?: number;
}

export interface CorrectionRecord {
  kind?: string;
  addendum_type?: string;
  corrects?: unknown;
  supersedes?: unknown;
  target?: unknown;
  superseded_by?: string;
  utc?: string;
  reason?: string;
  signature?: string;
  signed?: boolean;
  adds?: { source?: { retrieved_utc?: string } };
}

const VOLATILE_RE = /\b(price|prices|priced|cost|costs|fee|fees|fares?|rates?|exchange rate|salary|salaries|wages?|version|versions|release|released|latest|current|currently|today|tonight|now|this (?:year|month|week)|how many|count|counts|number of|population|dates?|deadline|schedule|stock|ranking|rankings)\b/i;
const CANON_PROVENANCE_RE = /^(canon|founder|founder_ruling|blood_rule|statute|hard_canon)[:/]/i;

/** Deterministic class from card metadata. Explicit freshness_class wins; then canon markers; then volatile markers. */
export function classifyCard(meta: FreshnessCardMeta): FreshnessClass {
  const explicit = String(meta.freshness_class ?? '').trim().toLowerCase();
  if (explicit === 'canon' || explicit === 'volatile' || explicit === 'general') return explicit;
  const tags = (Array.isArray(meta.tags) ? meta.tags : []).map((t) => String(t).toLowerCase());
  if (meta.pheromone_class === 'anchor' || tags.includes('canon') || tags.includes('founder-ruling') || CANON_PROVENANCE_RE.test(String(meta.provenance ?? ''))) return 'canon';
  if (tags.includes('volatile') || VOLATILE_RE.test(String(meta.question ?? ''))) return 'volatile';
  return 'general';
}

/** pheromone.ts transient decay, matchStrength 1. */
export function decayScore(ageDays: number, decayConstantDays = DECAY_CONSTANT_DAYS): number {
  return Math.exp(-Math.max(0, ageDays) / decayConstantDays);
}

function toMs(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v) { const t = Date.parse(v); return Number.isFinite(t) ? t : null; }
  return null;
}

function cardKeys(meta: FreshnessCardMeta): Set<string> {
  const k = new Set<string>();
  for (const v of [meta.sha256, meta.question_sha256, meta.method_sha256, meta.block]) if (typeof v === 'string' && v) k.add(v.toLowerCase());
  if (typeof meta.qid === 'number') k.add('qid:' + meta.qid);
  return k;
}

function targetsOf(r: CorrectionRecord): string[] {
  const out: string[] = [];
  const push = (v: unknown) => {
    if (v == null) return;
    if (Array.isArray(v)) { v.forEach(push); return; }
    if (typeof v === 'object') { for (const x of Object.values(v as Record<string, unknown>)) push(x); return; }
    if (typeof v === 'number') { out.push('qid:' + v); return; }
    out.push(String(v).toLowerCase());
  };
  push(r.corrects); push(r.supersedes); push(r.target);
  return out;
}

const CORRECTION_KINDS = new Set(['correction', 'supersede', 'superseded']);

/** The first appended correction naming this card, or null. The card's own superseded_by also counts. */
export function findCorrection(meta: FreshnessCardMeta, records: CorrectionRecord[]): { record: CorrectionRecord | null; via: string; signed: boolean } | null {
  if (typeof meta.superseded_by === 'string' && meta.superseded_by) return { record: null, via: 'card.superseded_by', signed: false };
  const keys = cardKeys(meta);
  if (keys.size === 0) return null;
  for (const r of records || []) {
    if (!r || typeof r !== 'object') continue;
    const isCorrection = CORRECTION_KINDS.has(String(r.kind ?? '').toLowerCase()) || CORRECTION_KINDS.has(String(r.addendum_type ?? '').toLowerCase());
    if (!isCorrection) continue;
    if (targetsOf(r).some((t) => keys.has(t))) return { record: r, via: r.addendum_type ? 'correction_addendum' : 'correction_record', signed: !!(r.signature || r.signed) };
  }
  return null;
}

/** Latest retrieved_utc among SOURCE addenda naming this card (re-sourcing restarts the clock). */
function latestResourceMs(meta: FreshnessCardMeta, records: CorrectionRecord[]): number | null {
  const keys = cardKeys(meta);
  let best: number | null = null;
  for (const r of records || []) {
    if (!r || String(r.addendum_type ?? '').toLowerCase() !== 'source') continue;
    if (!targetsOf(r).some((t) => keys.has(t))) continue;
    const ms = toMs(r.adds?.source?.retrieved_utc) ?? toMs(r.utc);
    if (ms != null && (best == null || ms > best)) best = ms;
  }
  return best;
}

export interface ReuseDecision {
  state: ReuseState;
  label: string;
  freshness_class: FreshnessClass;
  cutoff_days: number | null;
  age_days: number | null;
  decay_score: number | null;
  threshold: number | null;
  correction: { via: string; signed: boolean; utc: string | null; reason: string | null; superseded_by: string | null } | null;
  rule: string;
}

export const RULE = 'X030-073 stale cutoff C: canon never; volatile 30 d; general 180 d; unknown = general; correction first';

/** The reuse check: correction first, then age on the decay score. Never throws. */
export function reuseDecision(meta: FreshnessCardMeta, nowMs: number, records: CorrectionRecord[] = []): ReuseDecision {
  const cls = classifyCard(meta);
  const cutoff = CUTOFF_DAYS[cls];
  const corr = findCorrection(meta, records);
  const base = { freshness_class: cls, cutoff_days: Number.isFinite(cutoff) ? cutoff : null, rule: RULE };
  if (corr) {
    return { ...base, state: 'corrected', label: REUSE_LABELS.corrected, age_days: null, decay_score: null, threshold: null,
      correction: { via: corr.via, signed: corr.signed, utc: corr.record?.utc ?? null, reason: corr.record?.reason ?? null, superseded_by: corr.record?.superseded_by ?? meta.superseded_by ?? null } };
  }
  const written = [toMs(meta.timestamp), toMs(meta.utc), toMs(meta.reverified_utc), latestResourceMs(meta, records)].filter((x): x is number => x != null);
  const refMs = written.length ? Math.max(...written) : null;
  if (cls === 'canon') {
    return { ...base, state: 'verified_reusable_answer', label: REUSE_LABELS.verified_reusable_answer, age_days: refMs == null ? null : (nowMs - refMs) / 86_400_000, decay_score: 1, threshold: 0, correction: null };
  }
  const threshold = Math.exp(-cutoff / DECAY_CONSTANT_DAYS);
  if (refMs == null) {
    // No time on the card: its age cannot be shown, so it is not served as verified.
    return { ...base, state: 'prior_record_reverify', label: REUSE_LABELS.prior_record_reverify, age_days: null, decay_score: null, threshold, correction: null };
  }
  const ageDays = (nowMs - refMs) / 86_400_000;
  const score = decayScore(ageDays);
  const aged = score < threshold;
  return { ...base, state: aged ? 'prior_record_reverify' : 'verified_reusable_answer', label: aged ? REUSE_LABELS.prior_record_reverify : REUSE_LABELS.verified_reusable_answer, age_days: ageDays, decay_score: score, threshold, correction: null };
}
