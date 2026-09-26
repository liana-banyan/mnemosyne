// card_writer.ts -- D-BP223-BM04-X033S3-009 STEP 1a
//
// Builds a ProveItCard from an answer + sources + attribution, assigns its address the way the
// existing card/eblet store does (card_store.ts's computeCardAddress(), soccerballAddress()
// reused -- see that file's header), writes it to the local store, and emits ticker events at
// every step with ms timestamps (spec Section 3).
//
// VALIDITY DEFAULTS (spec Section 12, "RULED R4"): lookup facts with a known change rate 1 year;
// prices/stock-style facts 1 day; historical/forever facts no expiry; anything the answering AI
// dated itself, that date. This module's classifyValidity() reuses card_freshness.ts's own
// VOLATILE_RE-driven classifyCard() (canon/volatile/general) for the "does this look like a
// volatile fact" judgment -- NOT reinvented -- and maps its 3-way result onto this feature's own
// 4-way ProveItValidityClass vocabulary (day/year/forever/ai_dated), because the two vocabularies
// do not line up 1:1 (see proveit_contract.ts's own comment on VALIDITY_CLASS_TO_MS).
//
// SUPERSEDE CHAIN (spec Section 5, "provenance law"): supersedeCard() below never edits or
// removes the old row -- it writes a NEW card via buildAndWriteCard(), then patches ONLY the old
// row's supersededBy field via card_store.updateCard(). The old row's question/answer/address/
// askedBy/answeredBy/madeAt are never touched.

import { computeCardAddress, appendCard, updateCard, findCardByAddress } from './card_store';
import { emitTicker, emitTickerError, newRunId } from './ticker';
import { classifyCard, type FreshnessCardMeta } from '../card_freshness/card_freshness';
import {
  VALIDITY_CLASS_TO_MS,
  type ProveItAskedBy,
  type ProveItAnswerMethod,
  type ProveItAnsweredBy,
  type ProveItCard,
  type ProveItCategory,
  type ProveItSource,
  type ProveItValidityClass,
  ANSWER_METHOD_TO_ANSWERED_BY,
  PROVEIT_ANSWERED_BY_LABELS,
} from '../../shared/proveit_contract';

/** Lifts bare URLs out of a pasted by-hand answer into a sources list (spec Section 4: "links
 *  are lifted into the sources list; if there are none the card says 'no source given'"). Simple
 *  and conservative -- http(s) URLs only, de-duplicated, first 8 kept so a wall of links can
 *  never blow up the card. */
export function liftSourcesFromText(text: string): ProveItSource[] {
  const matches = text.match(/https?:\/\/[^\s)"'<>]+/g) ?? [];
  const seen = new Set<string>();
  const out: ProveItSource[] = [];
  for (const url of matches) {
    const clean = url.replace(/[.,)]+$/, '');
    if (seen.has(clean)) continue;
    seen.add(clean);
    out.push({ label: clean, url: clean });
    if (out.length >= 8) break;
  }
  return out;
}

/** Spec Section 12's validity-window defaults, reusing card_freshness.ts's classifyCard() volatile/
 *  canon/general judgment rather than re-deriving a second regex. 'ai_dated' is chosen only when
 *  the caller explicitly supplies an AI-stated date via aiStatedValidUntil (never guessed). */
export function classifyValidity(question: string, aiStatedValidUntil?: string | null): ProveItValidityClass {
  if (aiStatedValidUntil) return 'ai_dated';
  const meta: FreshnessCardMeta = { question };
  const cls = classifyCard(meta);
  if (cls === 'volatile') {
    // Spec Section 12 splits "volatile" further: prices/stock-style = 1 day, most lookup facts
    // (counts, populations) = 1 year. card_freshness's VOLATILE_RE cannot tell these apart from
    // the question text alone without guessing, so the day-scale subset is matched narrowly here
    // (price/rate/stock/exchange-rate wording) and everything else volatile defaults to 1 year --
    // the more common case in spec Section 12's own worked examples (moon counts, populations).
    if (/\b(price|prices|priced|stock|exchange rate|fare|fares)\b/i.test(question)) return 'day';
    return 'year';
  }
  // cls is 'canon' or 'general': neither matched a known-change-rate lookup pattern, so per spec
  // Section 12's "historical facts forever" default, these get no expiry -- e.g. "what year did
  // the Berlin Wall fall" (cls 'general': no VOLATILE_RE match) and any explicit canon/Founder-
  // ruling card (cls 'canon') are both stable facts, never a re-ask candidate on a clock alone.
  return 'forever';
}

export function validUntilFor(validityClass: ProveItValidityClass, madeAtMs: number, aiStatedValidUntil?: string | null): string | null {
  if (validityClass === 'forever') return null;
  if (validityClass === 'ai_dated') return aiStatedValidUntil ?? null;
  return new Date(madeAtMs + VALIDITY_CLASS_TO_MS[validityClass]).toISOString();
}

export interface BuildCardInput {
  question: string;
  category: ProveItCategory;
  method: ProveItAnswerMethod;
  answer: string;
  sources?: ProveItSource[];
  askedBy: ProveItAskedBy;
  madeAt?: string; // ISO-8601 UTC; defaults to now -- overridable only for seeding/tests
  aiStatedValidUntil?: string | null;
  isSeed?: boolean;
  seedSource?: string | null;
  duplicateOfQid?: number | null;
}

/** (a) card writer, spec brief STEP 1a. Builds the card, computes its address, writes it to the
 *  local store, and emits the full ticker sequence for one ask (question_received through
 *  card_written + meter_delta). Returns the card and the runId the ticker events are grouped
 *  under. Never throws for a normal ask -- a missing/empty answer is reported via the ticker's
 *  'error' step and a null card, so the caller (ipc.ts) can offer the by-hand path per spec
 *  Section 3's "Defrag rule". */
export function buildAndWriteCard(input: BuildCardInput): { runId: string; card: ProveItCard | null } {
  const runId = newRunId();
  emitTicker(runId, 'question_received', `question received . category ${input.category}`);
  emitTicker(runId, 'category_confirmed', `category confirmed: ${input.category}`);

  const trimmedAnswer = (input.answer ?? '').trim();
  if (!trimmedAnswer) {
    emitTickerError(runId, 'answer_received', 'no answer text (empty response or nothing pasted)');
    return { runId, card: null };
  }

  const answeredBy: ProveItAnsweredBy = input.isSeed ? 'mnemosynec_seed' : ANSWER_METHOD_TO_ANSWERED_BY[input.method];
  emitTicker(
    runId,
    'brain_selected',
    input.method === 'by_hand' ? 'opening the by-hand path (Liana Cycle Two-Step) ...' : `opening ${PROVEIT_ANSWERED_BY_LABELS[answeredBy]} in your own signed-in window ...`,
  );

  const madeAt = input.madeAt ?? new Date().toISOString();
  const madeAtMs = Date.parse(madeAt);
  const sources = input.sources && input.sources.length ? input.sources : (input.method === 'by_hand' ? liftSourcesFromText(trimmedAnswer) : []);
  const unsourced = sources.length === 0;
  const wordCount = trimmedAnswer.split(/\s+/).filter(Boolean).length;
  emitTicker(runId, 'answer_received', `answer received . ${wordCount} words . ${sources.length} source${sources.length === 1 ? '' : 's'} cited${unsourced ? ' (unsourced)' : ''}`);

  const address = computeCardAddress({ question: input.question, answer: trimmedAnswer, category: input.category, answeredBy, madeAt });
  const validityClass = classifyValidity(input.question, input.aiStatedValidUntil);
  const validUntil = validUntilFor(validityClass, madeAtMs, input.aiStatedValidUntil);

  const card: ProveItCard = {
    address,
    category: input.category,
    question: input.question,
    answer: trimmedAnswer,
    askedBy: input.askedBy,
    answeredBy,
    madeAt,
    validUntil,
    validityClass,
    sources,
    supersedes: null,
    supersededBy: null,
    isSeed: input.isSeed ?? false,
    seedSource: input.seedSource ?? null,
    seedAttribution: null, // real asks are never seed cards -- see proveit_contract.ts's field comment
    duplicateOfQid: input.duplicateOfQid ?? null,
    publishedAt: null,
    unpublishedAt: null,
    voteCount: 0,
    queuedForSubstrate: false,
    answerMethod: input.method,
    unsourced,
  };

  const existing = findCardByAddress(address);
  if (!existing) appendCard(card);
  const stampState = card.askedBy.stamped === true ? 'stamped' : card.askedBy.stamped === false ? 'unsealed' : 'seed';
  emitTicker(runId, 'card_written', `card written . address hex:${address} . dated ${madeAt.slice(0, 10)} . ${stampState}: ${card.askedBy.display}`);
  emitTicker(runId, 'meter_delta', 'THIS ask: 1 model call (yours, in your own account) . our cost $0.00');

  return { runId, card: existing ?? card };
}

/** Spec Section 5 provenance law: a supersede writes a NEW card (via buildAndWriteCard with the
 *  same asker/category) and patches ONLY the old card's supersededBy -- the old row is never
 *  edited otherwise and never removed. */
export function supersedeCard(oldAddress: string, input: BuildCardInput): { runId: string; card: ProveItCard | null } {
  const old = findCardByAddress(oldAddress);
  const result = buildAndWriteCard(input);
  if (result.card && old) {
    updateCard(oldAddress, { supersededBy: result.card.address });
    result.card.supersedes = oldAddress;
    updateCard(result.card.address, { supersedes: oldAddress });
  }
  return result;
}
