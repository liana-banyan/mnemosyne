// comparative_cascade.ts -- D-BP149-041/BISHOP/S41/seg-methodregistry
//
// METHOD 1 of the Liana Cycle method registry: THE COMPARATIVE CASCADE. Shape: options are
// short members of one category and the question turns on ranking them by a named property.
// Taught by qid 98 (population density), Founder hand-worked BP149, proven live via
// scripts/qid98_his_words.mjs (D-BP149-036) -- CORRECT, A, sole survivor, Google only, $0,
// 183s. This file ports that script's mechanism into a registry method callable on any
// comparative question, not just qid 98. Read scripts/_superseded/qid98_his_words.mjs (moved
// there 2026-08-09, D-BP151-043, per Rule 66 -- historical, no caller, broken by D-BP151-041's
// register-gate CLI removal) in full before touching this file -- its stage order, verification
// rules, terminator, and comments are the specification this file stays faithful to.
//
// WHAT IS PORTED, unchanged in substance:
//   - Google is the only source, via the injected askGoogle (AskGoogleFn) -- the SAME
//     in-process bridge (runBrowserAuthorityQueryFromMain) every other main-process caller in
//     this estate uses, not a second CDP dial.
//   - Google's result BLOCKS (title + body) are kept, never flattened to one string -- see
//     googleBlocks() below (a block's body refers to its own title with pronouns; flattening
//     destroys that reference -- measured to break the register gate for a whole BP149
//     session).
//   - Gemma extracts only, never judges (HARDWIRE-22). think:false, num_predict:512 (>=256).
//   - Every extraction is verified against the passage it came from before it is trusted.
//   - A sentence that is a question, or someone else's answer-option list, is not an assertion
//     (isAssertion(), imported from register_gate.mjs -- see that module's own doc comment for
//     the qid 98 case this caught).
//   - Unit normalization (per sq mi -> per km2) happens in code, never asked of the model.
//   - Stage order: register gate, inverse, order-both-ways with all-options QC, Cake Cut Half
//     with re-inclusion (both halves always drawn from the FULL option set, never the narrowed
//     pool -- see buildFounderQuestions() Q6/Q7 below, both list(ALL)), hard number per-option,
//     then the terminator.
//   - Terminator order (D-BP151-024, SUPERSEDES D-BP151-020's FIX 1 -- that FIX 1 read "the same
//     option wins across the framings" (his "consistently across all questions") as VOTE
//     convergence gating a hard number. Founder Ruling 2, BP151, corrects this: the referent was
//     his VALUE agreeing with itself (South America's density figure repeating), not an option
//     winning a vote count -- see evaluateComparativeTerminator()'s own doc comment below for the
//     full citation. "Agree" was originally left as an open fork (no invented tolerance); the
//     Founder ANSWERED it same ticket -- verbatim: "Order of magnitude works as the basis" -- see
//     orderOfMagnitude() and detectValueConvergence() below):
//       1. VALUE CONVERGENCE fires first -- ATTRIBUTED, Founder Ruling 2, BP151, verbatim: "Value
//          convergence is undeniable, so that one". The SAME option's resolved value from more
//          than one framing, sharing an order of magnitude (see detectValueConvergence() below).
//       2. VOTES fire only when value convergence is non-existent -- ATTRIBUTED precedence,
//          Founder Ruling 2, BP151, verbatim: "only if value convergence is non-existent, it
//          trumps vote convergence every time". The vote machinery itself is the pre-existing
//          cross-framing convergence-only fallback (TARE, strict majority required, ties abstain,
//          tare-sweep D-BP151-019 row #10, unattributed, left unchanged by this ticket).
//       3. Otherwise ABSTAIN. SOLE SURVIVOR IS REMOVED -- ATTRIBUTED, Founder Ruling 1 (Q-13a),
//          BP151, verbatim: "yes remove it". A pool narrowed to one option no longer
//          auto-declares it; it must still earn the verdict from branch 1 or 2, or the run
//          abstains (tare-sweep row #11, this rule no longer exists in any form).
//
// D-BP151-027/BISHOP/seg-abstain-clues (Contingency Operator, OFF BY DEFAULT, Founder's own CO,
// FD-BP151-26): on an abstain, isAbstainCluesModeEnabled() + buildAbstainCluesReport() (see their
// own doc comments below, just above run()) turn the same pool/densities/leastVotes/
// densityObservations the three branches above already computed into a labeled, unranked
// "runners-up" report -- sole survivor, non-majority vote count, coverage-incomplete resolved
// values, and lowest-non-converging value are the Founder's own four named clues. Nothing here
// changes verdict/ok/abstain above; this only decorates a null verdict with why it stayed null.
//
// WHAT IS GENERALIZED, AND WHY IT HAS TO BE: qid98_his_words.mjs's own header says "this file
// contains NO TEMPLATE" -- true for that file, whose entire purpose was proving the Founder's
// EXACT thirteen questions work on the EXACT qid 98 option set. This file is a REGISTRY method:
// per the BP149 ruling, it must answer future comparative questions this session has never
// seen, so its ten questions cannot be hand-copied text. deriveCategoryAndProperty() below
// extracts the category noun phrase and the ranking property FROM THE QUESTION ITSELF (never a
// generic cross-domain template like "put these in order of most to least", which the ruling's
// own triggering finding says Google answered with nonsense because it names no category or
// property). On qid 98 this derivation reproduces the Founder's own wording closely enough that
// the live proof reaches the same result his hand-worked run did (see this ticket's return).

import { avgOptionWordCount, registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput, MethodRunContext, ShapeTestResult } from '../method_registry';
import type {
  ComparativeAbstainClue,
  ComparativeAbstainCluesReport,
  LianaTerminalOutcome,
} from '../../../shared/liana_cycle/liana_terminal_types';
import { loadRegisterGate } from '../register_gate_loader';

const OLLAMA_API_BASE = process.env.OLLAMA_API_BASE ?? 'http://127.0.0.1:11434';
const MODEL = process.env.CASCADE_MODEL ?? 'gemma4:12b';

function nowIso(): string {
  return new Date().toISOString();
}

// ─────────────────────────── pure helpers ───────────────────────────

// norm/appearsIn/list/toLetters/googleBlocks/gemmaExtract are exported (D-BP149-043) so
// definitional_cascade.ts can share this exact code for its own stages 0/1/2 and D2-D4 rather
// than reproducing it -- see the "shared stages 0/1/2" block below for the full rationale.
export const norm = (s: unknown): string =>
  String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

export const appearsIn = (passage: string, s: string): boolean => {
  const n = norm(s);
  if (!n || n.length < 3) return false;
  return norm(passage).includes(n);
};

export const list = (letters: string[], OPT: Record<string, string>): string =>
  letters.map((L) => `${L}) ${OPT[L]}`).join(' ');

/** Exact-match mapping of extracted text back to a known option letter. HARDWIRE-22:
 *  "Similarity is not identity" -- normalized string equality only, never fuzzy. */
export function toLetters(items: unknown[] | undefined, OPT: Record<string, string>): string[] {
  const out: string[] = [];
  for (const it of items ?? []) {
    for (const [L, t] of Object.entries(OPT)) {
      if (norm(t) === norm(it)) out.push(L);
    }
  }
  return [...new Set(out)];
}

const SQMI_PER_SQKM = 2.589988;
const CALENDAR_YEAR_MIN = 1000;
const CALENDAR_YEAR_MAX = 2100;

/** Folds the superscript "²" (U+00B2) to ascii "2" before the shared norm() strips every
 *  non-alphanumeric character -- norm() alone drops U+00B2 with nothing left in its place, which
 *  silently turned "per km²" into "per km" and made the unit unrecognizable (a prior session
 *  logged this exact miss; FIX 2, D-BP151-013, ticket instruction: "handle it"). Scoped to this
 *  one check -- norm() itself stays byte-identical for the option-text/sentence matching every
 *  other call site in this file depends on. */
function normUnitText(s: unknown): string {
  return norm(String(s == null ? '' : s).replace(/\u00b2/g, '2'));
}

/** FIX 2 (D-BP151-013, "a quantity must prove it is the right kind of quantity"), TIGHTENED per
 *  the Founder's read of scripts/register_gate.mjs-era transcript
 *  (C:\Users\Administrator\Downloads\LianaCyleActualReasoningQid98.md, lines 269 and 280): the
 *  OLD toPerSqKm() already detected that "to 2022" and "none" are not recognized area-rate units
 *  -- it said so in its own returned string ("not a recognized area rate, assumed unconverted")
 *  -- and then used the bare year anyway. THAT assumed-unconverted passthrough was the fail-open,
 *  not a missing check. This version keeps the exact same unit-recognition test (sq mi / sq km /
 *  km2, now also tolerant of a space or the folded superscript before the trailing digit -- "km
 *  2", "km²" -- and, per FIX 2's second finding this pass, requires a RATE marker ("per", "/",
 *  "each") next to the area unit so a bare AREA figure sharing the same "km2" suffix -- e.g. a
 *  region's total 469,630 km2 -- cannot be mistaken for a density just because the digits after
 *  "km" match) but returns an HONEST NULL instead of a passthrough whenever that test fails.
 *  A bare 4-digit integer with no recognized unit that also falls in a plausible-calendar-year
 *  range (1000-2100) gets a more specific rejection reason naming that -- but this is a NAMED
 *  ILLUSTRATION of the general rule, never a second, looser gate: a genuinely rate-carrying value
 *  in that same numeric range is accepted exactly like any other, magnitude alone is never by
 *  itself a rejection reason. */
// Exported (was module-private) so this ticket's unit tests (comparative_cascade.test.ts) can
// call it directly against the exact literal strings from the qid 98 receipt, same convention as
// this file's other exported pure helpers (norm, appearsIn, toLetters) -- zero behavior change.
export function toPerSqKm(
  value: number,
  unit: string | undefined,
  context: string,
): { ok: true; value: number; unit: string } | { ok: false; reason: string } {
  const hay = `${normUnitText(unit)} ${normUnitText(context)}`;
  const RATE_MARKER_RE = /\b(per|each)\b/;
  const hasRateMarker = RATE_MARKER_RE.test(hay) || /\//.test(`${unit ?? ''} ${context ?? ''}`);
  if (hasRateMarker && (/(sq|square)\s*(mi|mile|miles)/.test(hay) || /mi\s*2/.test(hay))) {
    return { ok: true, value: value / SQMI_PER_SQKM, unit: 'per km2 (converted from per sq mi)' };
  }
  if (hasRateMarker && (/(sq|square)\s*(km|kilometer|kilometre|kilometers|kilometres)/.test(hay) || /km\s*2/.test(hay))) {
    return { ok: true, value, unit: 'per km2' };
  }
  if (Number.isInteger(value) && value >= CALENDAR_YEAR_MIN && value <= CALENDAR_YEAR_MAX) {
    return {
      ok: false,
      reason: `no recognized area-RATE unit anywhere in the unit field or surrounding text, and the bare integer ${value} falls in the plausible-calendar-year range (${CALENDAR_YEAR_MIN}-${CALENDAR_YEAR_MAX}) -- rejected rather than guessed as a density`,
    };
  }
  return {
    ok: false,
    reason: `no recognized area-RATE unit ("${unit || 'none stated'}") anywhere in the unit field or surrounding text -- rejected rather than assumed`,
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─────────────────────────── shared stages 0/1/2 (D-BP149-043, METHOD 2 reuse) ───────────────────────────
// definitional_cascade.ts (METHOD 2) reuses these three exports verbatim for its own "stages 0,
// 1 and 2 of Method 1, unchanged" per the Founder's BP149 teaching (method_registry.ts header:
// "Use stages 0, 1 and 2 from Method 1, then add ... rules 12, 13 and 11"). Extracted out of
// run() below with NO behavior change -- run() now calls runStage0RegisterGate() and
// extractAssertedMentions() in exactly the places its old inline code used to sit, same inputs,
// same outputs, same printed transcript text. qid 98 was re-verified live after this extraction
// (see this ticket's return) to confirm the answer is still A.

/** FIX 1 (D-BP151-013): thrown when stage 0 (the register gate) cannot execute after bounded
 *  retries -- see runStage0RegisterGate() below. This estate forbids a gate that cannot run from
 *  failing open; every caller of runStage0RegisterGate() must catch this and ABSTAIN rather than
 *  produce a verdict from an unvetted pool. Its own class (same idiom as audible.ts's
 *  AudibleAbandoned) so a caller can tell "stage 0 never ran" apart from any other exception
 *  without parsing a message string. */
export class RegisterGateUnavailableError extends Error {}

// Same bounded-retry idiom as googleBlocks() below (tries=3, i*4000ms settling delay between
// attempts) -- FIX 1 applies it to the register gate call itself. The qid 98 receipt (BP149, pre-
// D-BP151-041) showed this call failing with a bare "fetch failed" -- at that time,
// register_gate.mjs's own pickTarget() dialed the CDP port via a plain fetch, and that dial could
// hit a transient main-process timing issue, not a permanent one. AMENDED 2026-08-09
// (D-BP151-043): register_gate.mjs no longer dials CDP at all (`D-BP151-041`/`56afd84f` rewired
// it onto ctx.askGoogle -- see gateAskGoogle below), so that specific CDP failure mode is gone,
// but the same bounded retry still guards against ordinary transient failures in the in-process
// askGoogle call (e.g. the live Nexus-Authority window not yet ready), so it stays. A bounded
// retry with a settling delay is still the honest thing to try before concluding the gate truly
// cannot run.
const REGISTER_GATE_RETRY_TRIES = 3;

/** STAGE 0, register gate. Shared, not reproduced -- see this file's own header ("Google is the
 *  only source ... Gemma extracts only ... Unit normalization happens in code") and
 *  register_gate_loader.ts's doc comment for the two runtime shims that make importing
 *  scripts/register_gate.mjs work inside Electron's main process. `pool` in, filtered pool out;
 *  every line this prints on a SUCCESSFUL run is identical to what this stage always printed
 *  inline. FIX 1 (D-BP151-013): a transient failure is now retried up to
 *  REGISTER_GATE_RETRY_TRIES times with a settling delay before it is treated as real; if it
 *  still cannot run, this THROWS RegisterGateUnavailableError instead of returning the pool
 *  unfiltered -- the old catch-and-continue-with-the-full-pool behavior was the gate-fails-open
 *  defect that let three category errors (Arctic Circle, Amazon Rainforest, Sahara Desert -- the
 *  BP149 register gate's own removals) survive into the qid 98 terminator. Callers MUST catch
 *  RegisterGateUnavailableError and abstain; it must never propagate into a verdict. */
export async function runStage0RegisterGate(
  OPT: Record<string, string>,
  pool: string[],
  ctx: MethodRunContext,
): Promise<string[]> {
  const { emit, askGoogle } = ctx;
  const step = (text: string) => emit({ kind: 'stage', text: `-> ${text}`, ts: nowIso() });
  const note = (text: string) => emit({ kind: 'note', text, ts: nowIso() });
  const fact = (text: string) => emit({ kind: 'fact', text: `+ ${text}`, ts: nowIso() });

  step('STAGE 0  register gate -- is each option a member of the category at all?');
  // D-BP151-041/BISHOP/seg-register-gate-inprocess: register_gate.mjs no longer dials CDP for
  // itself. ctx.askGoogle is the SAME in-process bridge (runBrowserAuthorityQueryFromMain) this
  // file already injects into googleBlocks() for every other stage (see this file's header) --
  // wrapped here only to reshape GoogleAnswer's {ok, blocks} down to register_gate.mjs's expected
  // RegisterGateAskGoogle shape (register_gate_loader.ts). No second CDP dial, no new bridge.
  const gateAskGoogle = (question: string) => googleBlocks(askGoogle, question);
  let lastErrMsg = '';
  for (let attempt = 1; attempt <= REGISTER_GATE_RETRY_TRIES; attempt++) {
    try {
      const regMod = await loadRegisterGate();
      const { notRegions, report } = await regMod.runRegisterGate(OPT, { verbose: false, askGoogle: gateAskGoogle });
      for (const [L, r] of Object.entries(report)) {
        const ev = r.evidence ? `about=${r.evidence.about} feature=${r.evidence.featureHits.length} region=${r.evidence.regionHits.length}` : '(no evidence)';
        note(`   ${L}) ${OPT[L]}: ${r.verdict}  [${ev}]${r.scope ? `  scope: ${r.scope.why}` : ''}`);
      }
      let next = [...pool];
      if (notRegions.length) {
        const before = next.length;
        next = next.filter((L) => !notRegions.includes(L));
        fact(`register gate removed ${notRegions.join(', ')}   pool ${before} -> ${next.length}`);
      } else {
        note('   register gate removed nothing');
      }
      return next;
    } catch (e) {
      lastErrMsg = e instanceof Error ? e.message : String(e);
      if (attempt < REGISTER_GATE_RETRY_TRIES) {
        note(`   register gate attempt ${attempt}/${REGISTER_GATE_RETRY_TRIES} failed (${lastErrMsg}) -- retrying after a settling delay, not yet treated as a permanent failure`);
        await sleep(attempt * 4000);
      }
    }
  }
  // FIX 1: the gate cannot run after every retry. It must NOT fail open -- see the class doc
  // above. This is the fix for the qid 98 receipt's line 111: "register gate unavailable (fetch
  // failed) -- continuing with the full pool" is exactly the sentence this throw replaces.
  note(`   register gate unavailable after ${REGISTER_GATE_RETRY_TRIES} attempts (${lastErrMsg}) -- ABSTAINING rather than continuing with an unvetted pool`);
  throw new RegisterGateUnavailableError(
    `stage 0 register gate could not execute after ${REGISTER_GATE_RETRY_TRIES} attempts (${lastErrMsg})`,
  );
}

export interface AssertedMention { L: string; sentence: string; }

/** Shared extraction step underlying STAGE 1 (ask the inverse) and STAGE 2 (Jar Method): ask
 *  Gemma (HARDWIRE-22 extraction only -- never judgment) which of the ALL option names this
 *  passage mentions, and the verbatim sentence each appears in, then verify every claim against
 *  the passage itself before trusting it: the option text must literally appear, the quoted
 *  sentence must literally appear, and the sentence must be an assertion (register_gate.mjs's
 *  isAssertion() -- not a question, not someone else's answer-option list). Callers decide what
 *  the verified mentions MEAN (comparative_cascade.ts votes them high/low by density vocabulary;
 *  definitional_cascade.ts's Jar Method uses the same votes to eliminate). */
export async function extractAssertedMentions(
  passageText: string,
  ALL: string[],
  OPT: Record<string, string>,
  note: (text: string) => void,
): Promise<AssertedMention[]> {
  const ex = await gemmaExtract(
    `Copy out every name from this list that appears anywhere in the passage, and for each one copy the complete sentence it appears in, word for word from the passage. Do not summarize. List: ${ALL.map((L) => OPT[L]).join('; ')}`,
    passageText,
    `{"mentions":[{"name":"exact name from the list","sentence":"the verbatim sentence"}]}`,
  );
  const regMod = await loadRegisterGate().catch(() => null);
  const isAssertion = regMod?.isAssertion ?? (() => true);
  const out: AssertedMention[] = [];
  for (const m of (ex?.mentions as Array<{ name: string; sentence: string }> | undefined) ?? []) {
    const L = toLetters([m?.name], OPT)[0];
    if (!L) continue;
    const s = String(m?.sentence || '');
    if (!appearsIn(passageText, OPT[L])) { note(`      rejected ${L}: "${OPT[L]}" not in the passage`); continue; }
    if (!appearsIn(passageText, s)) { note(`      rejected ${L}: quoted sentence not found in the passage`); continue; }
    if (!isAssertion(s)) { note(`      rejected ${L}: sentence is a question or an answer-option list`); continue; }
    out.push({ L, sentence: s });
  }
  return out;
}

/** Extracts the category noun phrase and the ranking property FROM THE QUESTION ITSELF -- see
 *  this file's header ("WHAT IS GENERALIZED") for why this replaces hand-copied wording. Falls
 *  back to generic-but-honest phrasing when the question does not fit the "following X is/are
 *  ... SUPERLATIVE Y" shape the register gate + shapeTest already require to reach this point. */
function deriveCategoryAndProperty(question: string): { category: string; property: string } {
  const catMatch = question.match(/following\s+([a-z][a-z\s]*?)\s+(?:is|are)\b/i);
  const category = catMatch ? catMatch[1].trim() : 'options';

  const supMatch = question.match(
    /\b(most|least|highest|lowest|greatest|smallest|densest|largest|fewest|maximum|minimum|earliest|latest|oldest|newest|farthest|nearest|closest)\b/i,
  );
  let property = '';
  if (supMatch && supMatch.index != null) {
    const after = question.slice(supMatch.index + supMatch[0].length).trim();
    const propMatch = after.match(/^([a-z][a-z\s-]*?)(?:\s+(?:regions?|options?|choices?|items?|of\b)|[.?]|$)/i);
    property = (propMatch ? propMatch[1] : after.split(/\s+/).slice(0, 3).join(' ')).trim();
  }
  if (!property) property = 'the property in question';
  return { category, property };
}

// ─────────────────────────── Google, blocks kept ───────────────────────────

export interface GoogleBlock { title: string; body: string; url: string; kind: string; }
export interface GoogleAnswer { ok: boolean; text: string; blocks: GoogleBlock[]; sources: string[]; via: string; }

// sleep() is now declared once, earlier in this file (near toPerSqKm/runStage0RegisterGate,
// D-BP151-013 FIX 1), so both the register gate retry and this file's own googleBlocks() below
// share the exact same helper instead of two separate copies.

/** Ported from qid98_his_words.mjs's google(): keeps result BLOCKS (title + body), never
 *  flattens to one string -- see this file's header. Reached via the injected in-process
 *  askGoogle (AskGoogleFn), not a second CDP dial.
 *
 *  D-BP152-050/BISHOP/seg-honest-failure-reasons -- RETRY/MESSAGE LINES ONLY, everything else in
 *  this function byte-identical to before this ticket. Founder, BP152, live: hit a Google
 *  verification/rate-limit page ("we have detected unusual activity...",
 *  https://www.google.com/sorry/index) while his own window was elsewhere; the old code called
 *  it "UNREACHABLE (no answer after 3 attempts)" -- the SAME wrong reason this function reported
 *  for every failure mode (window unavailable, a network timeout, a genuinely empty page, or
 *  this). `lastFailureReason` (new, loop-scoped) tracks index.ts's buildLianaAskGoogle() own
 *  `raw.dispatchOutcome` across attempts so the FINAL message (once retries are exhausted) can
 *  name the real cause instead of a blanket "no answer" -- "no answer" is now reserved for the
 *  one case it is actually true (no_result/dispatched: asked, a page loaded, nothing usable).
 *  On `raw.challengeDetected` (structural, URL-only -- see webview_preload.ts's
 *  isGoogleChallengeUrl()), this returns IMMEDIATELY -- ZERO further retries -- because retrying
 *  into a detected rate-limit/verification page is more automated traffic aimed at the exact
 *  thing already refusing us. Every ordinary transient failure (window unavailable, timeout, a
 *  genuinely empty page, or askGoogle throwing) keeps the SAME 3-try / sleep(i*4000) retry
 *  behavior as before this ticket -- unchanged. No word list, no new hardcoded numbers beyond the
 *  pre-existing retry counts, no bypass/evasion/solving of the challenge -- only stop, and report
 *  honestly. */
export async function googleBlocks(
  askGoogle: MethodRunContext['askGoogle'],
  query: string,
  tries = 3,
): Promise<GoogleAnswer> {
  let lastFailureReason: import('../../../shared/plow/browser_authority_types').BrowserAuthorityDispatchOutcome | 'unknown' = 'unknown';
  for (let i = 1; i <= tries; i++) {
    try {
      const raw = await askGoogle(query);
      if (raw) {
        const parts: string[] = [];
        const blocks: GoogleBlock[] = [];
        if (raw.snippet && raw.snippet.trim()) {
          parts.push(raw.snippet.trim());
          blocks.push({ title: '', body: raw.snippet.trim(), url: '', kind: 'answer_box' });
        }
        const rs = Array.isArray(raw.results) ? raw.results : [];
        for (const r of rs.slice(0, 6)) {
          const title = String(r.title || '').trim();
          const body = String(r.snippet || '').trim();
          blocks.push({ title, body, url: String(r.url || ''), kind: 'organic' });
          parts.push([title, body].filter(Boolean).join(' -- '));
        }
        if (parts.length) {
          const sources = (raw.citations || []).map((c) => c.url).concat(rs.map((r) => r.url).filter(Boolean));
          return { ok: true, text: parts.join('\n'), blocks, sources, via: `${raw.snippet ? 'box' : 'nobox'}+organic(${rs.length})` };
        }
        // Structural verification/rate-limit challenge -- HALT, zero further retries (attempt
        // #${i} of ${tries} was the last one that will ever run for this query).
        if (raw.challengeDetected) {
          return {
            ok: false, text: '', blocks: [], sources: [],
            via: `Google verification/rate-limit challenge detected (structural: google.com/sorry/) on attempt ${i} of ${tries} -- halted, 0 further retries`,
          };
        }
        lastFailureReason = raw.dispatchOutcome ?? 'no_result';
      }
    } catch {
      // fall through to retry -- an ordinary transient exception, not a classified reason.
    }
    if (i < tries) await sleep(i * 4000);
  }
  const reasonText = lastFailureReason === 'disabled'
    ? "the operator's browser window/session was unavailable"
    : lastFailureReason === 'not_signed_in'
      ? 'the session was not signed in'
      : lastFailureReason === 'timeout'
        ? 'a network/navigation timeout'
        : lastFailureReason === 'no_result' || lastFailureReason === 'dispatched'
          ? 'the page loaded and genuinely contained no usable answer'
          : 'unknown -- the real cause could not be classified from what askGoogle returned';
  return { ok: false, text: '', blocks: [], sources: [], via: `${reasonText} (${tries} of ${tries} attempts)` };
}

// ─────────────────────────── Gemma, extraction only (HARDWIRE-22) ───────────────────────────

export async function gemmaExtract(
  instruction: string,
  passage: string,
  shape: string,
  // D-BP152-004, INSTRUMENT ONLY: optional out-param. When present, mutated with the model's raw
  // pre-JSON-parse text (same string the parse below is attempted on) BEFORE the parse is
  // attempted, so a caller whose parse fails is not left with nothing -- see D-BP152-003's
  // Predicate A finding (SEG_RETURN_BP152_003_AMBIGUITY_EXTRACTION.md): today that text exists
  // only inside this function's local scope for the duration of one try block, then is gone.
  // Optional and additive: every existing call site that does not pass a fourth argument compiles
  // unchanged, and this function's return type and null-on-failure semantics are untouched -- no
  // caller's accept/reject behavior changes.
  rawOut?: { text?: string },
): Promise<Record<string, unknown> | null> {
  const prompt = `Read the passage and report only what it states. Do not reason about which answer is correct. Do not choose between options.

PASSAGE:
${passage}

TASK: ${instruction}

Return ONLY JSON in this shape, no prose, no fence:
${shape}
Use null where the passage does not state it. Never guess.`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);
    const res = await fetch(`${OLLAMA_API_BASE}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, prompt, stream: false, think: false, options: { temperature: 0, num_predict: 512 } }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));
    const j = (await res.json()) as { response?: string };
    const t = (j.response || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    if (rawOut) rawOut.text = t;
    return JSON.parse(t) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// ─────────────────────────── the Founder's ten questions, generalized ───────────────────────────

interface FounderQuestion { n: number; stage: 1 | 3 | 4 | 5; why: string; text: string; }

/** Cake Cut Half re-inclusion: Q6 and Q7 BOTH ask over list(ALL), never the narrowed pool --
 *  each alternating-direction pass starts from the full option set again as a control, per
 *  canon_cake_cut_half_alternating_bp141 ("re-including just-eliminated options as a
 *  control"). qid98_his_words.mjs already does this (both its Q6 and Q7 use list(ALL)); this
 *  port preserves it exactly.
 *
 *  FIX 2 (D-BP151-020/BISHOP/seg-98-three-fixes): every question text below is restored to the
 *  Founder's OWN wording, taken verbatim from
 *  C:\Users\Administrator\Documents\LianaBanyanPlatform\BISHOP_DROPZONE\
 *  FOUNDER_CASCADE_WORKED_BY_HAND_VERBATIM_RECOVERED_BP144.md (identical text also at
 *  C:\Users\Administrator\Downloads\FounderCascadeWorkedByHand.txt), Excerpt 2, with only the
 *  category/property/option-list slots his own sentences already have templated -- sentence
 *  structure and word choice otherwise unchanged. Per-question sourcing is in each entry's
 *  attribution comment below. Q1 was never rewritten (it sends the actual question text, already
 *  his own words) and needed no change. */
function buildFounderQuestions(
  category: string,
  property: string,
  inverseQuestion: string,
  ALL: string[],
  pool: string[],
  OPT: Record<string, string>,
): FounderQuestion[] {
  return [
    // ATTRIBUTED: this already sends the actual question (or its inverse with "NOT" stripped) --
    // for qid 98 that is word-for-word his own line 43 ("Which of the following world regions is
    // considered one of the world's most densely populated regions?"). No template, no rewrite.
    { n: 1, stage: 1, why: 'the inverse', text: `${inverseQuestion} ${list(ALL, OPT)}` },
    // ATTRIBUTED: RECOVERED_BP144.md line 67, verbatim structure: "Please put these regions in
    // order of most densely to least densely populated." -- category/property substituted at his
    // own "regions"/"densely" slots. Already matched this structure before this ticket; unchanged.
    { n: 2, stage: 3, why: `most ${property} to least ${property}, survivors`, text: `Please put these ${category} in order of most ${property} to least ${property}. ${list(pool, OPT)}` },
    // ATTRIBUTED: RECOVERED_BP144.md line 80, verbatim structure: "Please put these regions in
    // order of least densely to most densely populated." Unchanged (already matched).
    { n: 3, stage: 3, why: `least ${property} to most ${property}, survivors (opposite framing)`, text: `Please put these ${category} in order of least ${property} to most ${property}. ${list(pool, OPT)}` },
    // ATTRIBUTED: RECOVERED_BP144.md line 93 -- the SAME sentence as Q2, re-asked over the full
    // 9-option list as quality control (his own "as a quality control", line 64). Unchanged.
    { n: 4, stage: 3, why: `most ${property} to least ${property}, ALL options as quality control`, text: `Please put these ${category} in order of most ${property} to least ${property}. ${list(ALL, OPT)}` },
    // ATTRIBUTED: RECOVERED_BP144.md line 115 -- the SAME sentence as Q3, re-asked over the full
    // option list, same quality-control rationale. Unchanged.
    { n: 5, stage: 3, why: `least ${property} to most ${property}, ALL options as quality control`, text: `Please put these ${category} in order of least ${property} to most ${property}. ${list(ALL, OPT)}` },
    // ATTRIBUTED, RESTORED: RECOVERED_BP144.md line 137, verbatim: "From the following world
    // regions listed, please remove the half that are least populated:". His Cake Cut Half asks
    // about total POPULATION (a fixed word, "populated") as the coarse elimination heuristic --
    // NOT the ranking property (density) the other stages use; his own worked numbers here are
    // millions-of-people counts (line 144-153), never a density figure. The prior code had
    // substituted "${property}" ("densely populated") in place of his fixed word "populated",
    // which is the exact kind of rewrite this ticket exists to reverse. Restored to his literal
    // word; only ${category} is substituted, at his own "world regions" slot.
    { n: 6, stage: 4, why: 'Cake Cut Half, remove the half that is least populated (his word, total population -- not the ranking property)', text: `From the following ${category} listed, please remove the half that are least populated: ${list(ALL, OPT)}` },
    // ATTRIBUTED, RESTORED: RECOVERED_BP144.md line 172, verbatim: "From the following world
    // regions listed, please remove the half that are MOST populated:" -- same restoration as Q6,
    // same fixed word "populated" (his own capitalization of MOST preserved).
    { n: 7, stage: 4, why: 'Cake Cut Half, remove the half that is MOST populated (his word; re-including all options, opposite direction)', text: `From the following ${category} listed, please remove the half that are MOST populated: ${list(ALL, OPT)}` },
    // ATTRIBUTED, RESTORED: RECOVERED_BP144.md line 206, verbatim: "What are the population
    // densities of each of the following world regions?:". The prior code sent "What are the
    // numeric values or rates associated with ... for each of the following ..." -- a full
    // rewrite, and the one this ticket's own text names as the cause of the 52.9-vs-25 defect.
    // Restored to his sentence shape; ${property}/${category} substituted at his own "population
    // densities"/"world regions" slots.
    { n: 8, stage: 5, why: `the hard number, all options`, text: `What are the ${property} of each of the following ${category}?: ${list(ALL, OPT)}` },
    // ATTRIBUTED, RESTORED: RECOVERED_BP144.md line 224, verbatim: "Please sort the following
    // world regions by exact population order or provide density numbers for each, in order of
    // most to least:". The prior code said "by exact order or provide numeric values for each, in
    // order of most ${property} to least ${property}" -- both a rewrite of the middle clause AND
    // an addition (repeating ${property} in the trailing "most/least" clause) that is not in his
    // sentence at all; he says plainly "in order of most to least". Restored on both counts.
    { n: 9, stage: 5, why: `sort by ${property}, most to least`, text: `Please sort the following ${category} by exact ${property} order or provide ${property} numbers for each, in order of most to least: ${list(ALL, OPT)}` },
    // ATTRIBUTED, RESTORED: RECOVERED_BP144.md line 238, verbatim (his own "And for posterity:"
    // bonus question, not one of the seven core numbered-stage framings but present in his file
    // word for word): "Please sort the following world regions by exact population order or
    // provide density numbers for each, in order of least to most:". Same restoration as Q9.
    { n: 10, stage: 5, why: `sort by ${property}, least to most`, text: `Please sort the following ${category} by exact ${property} order or provide ${property} numbers for each, in order of least to most: ${list(ALL, OPT)}` },
  ];
}

// ─────────────────────────── word sets (generalized superset of qid98_his_words.mjs's) ───────────────────────────

export const HIGH_WORDS = /\b(high|highest|most|dense|densely|densest|cluster|clusters|concentration|crowded|populous|greatest|largest|maximum|newest|latest)\b/i;
export const LOW_WORDS = /\b(low|lowest|least|sparse|sparsely|thinly|uninhabited|empty|smallest|fewest|minimum|oldest|earliest)\b/i;

// ─────────────────────────── shapeTest ───────────────────────────

const SUPERLATIVE_RE = /\b(most|least|highest|lowest|greatest|smallest|densest|largest|fewest|maximum|minimum|earliest|latest|oldest|newest|farthest|nearest|closest)\b/i;
const MAX_AVG_OPTION_WORDS_FOR_RANKING = 6;

function shapeTest(input: MethodQuestionInput): ShapeTestResult {
  if (!input.options || Object.keys(input.options).length < 2) {
    return { matches: false, reason: 'no option pool to rank -- this method eliminates among options, it needs at least two' };
  }
  const avgWords = avgOptionWordCount(input.options);
  if (avgWords > MAX_AVG_OPTION_WORDS_FOR_RANKING) {
    return {
      matches: false,
      reason: `options read as full statements (avg ${avgWords.toFixed(1)} words each, > ${MAX_AVG_OPTION_WORDS_FOR_RANKING}) -- not short members of one category, so nothing to rank by a property`,
    };
  }
  const supMatch = input.question.match(SUPERLATIVE_RE);
  if (!supMatch) {
    return { matches: false, reason: 'question names no superlative/ranking property (most/least/highest/lowest/...) -- nothing to order by' };
  }
  return {
    matches: true,
    reason: `options are short (avg ${avgWords.toFixed(1)} words) and the question asks to rank by "${supMatch[0]}"`,
  };
}

// ─────────────────────────── terminator (D-BP151-024, supersedes D-BP151-020's FIX 1) ───────────

export interface ComparativeTerminatorResult { verdict: string | null; basis: string; notes: string[]; }

export interface ValueConvergenceResult {
  winner: string | null;
  agreeing: Record<string, number>;
  notes: string[];
}

/** D-BP151-024/BISHOP/seg-value-convergence. Computes the order of magnitude of a resolved
 *  density value: floor(log10(|value|)) -- 22 and 33 are both 10^1 ("tens"), 175 and 999 are both
 *  10^2 ("hundreds"), 99 and 101 are DIFFERENT (10^1 vs 10^2, a strict boundary -- see
 *  detectValueConvergence()'s own doc comment for why that boundary is left strict, not smoothed).
 *  Returns null for 0 or non-finite input (no magnitude is defined); toPerSqKm() never produces
 *  either, this is a defensive guard only. */
export function orderOfMagnitude(value: number): number | null {
  if (!Number.isFinite(value) || value === 0) return null;
  // FLOATING-POINT GUARD, not a second tolerance on the agreement rule: Math.log10 at an exact
  // power of ten (e.g. 100) can return a value fractionally below the integer
  // (1.9999999999999998) due to IEEE-754 rounding, which would floor to the WRONG magnitude
  // (10^1 instead of 10^2). The 1e-9 epsilon corrects only that representational artifact; it
  // does not widen or narrow which values agree beyond fixing it.
  return Math.floor(Math.log10(Math.abs(value)) + 1e-9);
}

/** D-BP151-024/BISHOP/seg-value-convergence, AMENDED same ticket after the Founder answered the
 *  fork this function originally left open (see git history for the exact-equality-only version
 *  this superseded, same commit lineage).
 *
 *  // ATTRIBUTED: Founder, BP151, verbatim: "Value convergence is undeniable, so that one. Votes
 *  // are not unimportant, but only if value convergence is non-existent, it trumps vote
 *  // convergence every time (especially since the voters are suspect actors anyway)"
 *
 *  His own qid-98 evidence for what "value convergence" means
 *  (BISHOP_DROPZONE\FOUNDER_CASCADE_WORKED_BY_HAND_VERBATIM_RECOVERED_BP144.md, Excerpt 2):
 *  South America's VALUE came back ~26-33, ~24, ~22, 25, 25 across five differently-shaped
 *  questions -- HIS words, "the same figure, five times" -- while the VOTE for "least" moved
 *  around (A; then E and A; then F and A; then F and G; then F alone). "Consistently across all
 *  questions" (his qid-98 conclusion, line 264) names the VALUE agreeing with itself, not an
 *  option winning a vote count.
 *
 *  THE FORK, AND HOW IT WAS ANSWERED. His five figures are NOT numerically identical (22 to 33 is
 *  a real spread) and he still called them "the same figure" -- so exact equality was too strict.
 *  Rather than invent a tolerance, this ticket stopped and asked. The Founder answered, BP151,
 *  verbatim: "Since every source calculates differently, this becomes a SigFig (Significant
 *  Figures) issue. Like how my 12" ruler is good enough measurement to fit my foot into a shoe...
 *  So. 'pretty close' is a good indicator, since we literally apply it in EVERY discipline that
 *  uses measurements at all, in real life. Order of magnitude works as the basis." This composes
 *  with his standing significant-figures rule (BP141, THE_FOUNDERS_PROCESS_ORDERED_BP151.md step
 *  15): "My 12\" ruler is not actually 12 inches... my inaccurate 12\" + X ruler is close enough
 *  to figure out if my foot is bigger than the shoe I want to fit it in."
 *
 *  VERIFIED against his own qid-98 data before implementing, not taken on faith (re-read of
 *  RECOVERED_BP144.md Excerpt 2, all nine options, every cited figure): South America (his answer)
 *  reads 22 / 24 / 24 / 25 / 25 / 26-33 across six framings -- every one 10^1 ("tens"). Western
 *  Europe 160-199 / 175 / 181 / 184 / 184, South Asia 303 / 329 / 329, East Asia 143 / 143 / 143,
 *  Southeast Asia 155 / 155 / 145-160 / 162 / 162, Northeast US 120-359 / 150-200 / 135-350 -- all
 *  10^2 ("hundreds"). Java 1,100-1,192 -- all 10^3 ("thousands"). South America never shares a
 *  magnitude with any other option, and none of A-F ever crosses its own boundary -- the rule
 *  reproduces his qid-98 answer.
 *
 *  TWO PARTIAL EXCEPTIONS, reported rather than smoothed away: Nile Valley's very first reading
 *  (line 72) gives "~1,000 to over 40,000 people per km2 in urban centers like Cairo" -- that
 *  SINGLE framing's own stated range spans 10^3 to 10^4 (a hyper-local Cairo-core figure folded
 *  into a region range -- arguably a different quantity, not a second comparable reading, and this
 *  file's own numeric extraction only ever captures ONE number+unit per candidate, never a stated
 *  range, so this specific text would not itself become a densityObservations entry under the real
 *  pipeline). Ganges Valley's readings move from 390-520 (10^2, lines 221/248) to "500-1,000+ ...
 *  exceed 1,200" (10^3, line 232) across SEPARATE framings -- a genuine cross-boundary case by this
 *  rule's own strict test. Neither Nile Valley nor Ganges Valley is ever a value-convergence
 *  candidate for the winning answer (both are eliminated in stage 1 as asserted-high-density
 *  before the terminator runs), so this does not change qid 98's outcome, but the Founder's
 *  premise that NO option crosses a boundary is not fully borne out by his own transcript for
 *  those two -- filed as a finding per his own instruction to report a contradiction, not silently
 *  agree with it.
 *
 *  BOUNDARY BEHAVIOR, STRICT, NOT SMOOTHED: 99 and 101 straddle the 10^2 power-of-ten boundary and
 *  do NOT agree under this rule, even though they are numerically closer to each other (~2%
 *  apart) than 22 and 33 are (~50% apart, and DO agree, both 10^1). This is the literal reading of
 *  "order of magnitude" and is intentionally not corrected with a second rule layered on top (a
 *  percent band, a log-midpoint rounding, a "within N of a boundary" carve-out) -- the Founder's
 *  own instruction: "Order of magnitude works as the basis," and this ticket's own constraint:
 *  "Do not add a second tolerance on top." A future question that turns on this exact boundary is
 *  a fork of its own, to be raised the same way this one was -- not pre-empted here. */
export function detectValueConvergence(
  pool: string[],
  observations: Record<string, number[]>,
  property: string,
): ValueConvergenceResult {
  const notes: string[] = [];
  const agreeing: Record<string, number> = {};
  for (const L of pool) {
    const vals = observations[L] ?? [];
    if (vals.length === 0) continue;
    if (vals.length === 1) {
      notes.push(`   value convergence: ${L} has only 1 resolved observation (${vals[0]}) -- self-agreement needs more than one framing, not evaluated`);
      continue;
    }
    const orders = vals.map(orderOfMagnitude);
    const sameOrder = orders[0] !== null && orders.every((o) => o === orders[0]);
    if (sameOrder) {
      agreeing[L] = Math.min(...vals);
      notes.push(`   value convergence: ${L} has ${vals.length} observations (${vals.join(', ')}), ALL order of magnitude 10^${orders[0]} -- self-agreeing (ATTRIBUTED, Founder, BP151: "Order of magnitude works as the basis")`);
    } else {
      notes.push(`   value convergence: ${L} has ${vals.length} observations (${vals.join(', ')}) spanning DIFFERENT orders of magnitude (${orders.map((o) => (o === null ? 'undefined' : `10^${o}`)).join(', ')}) -- NOT self-agreeing (ATTRIBUTED test, Founder, BP151: "Order of magnitude works as the basis")`);
    }
  }
  const agreeingOptions = Object.keys(agreeing);
  let winner: string | null = null;
  if (agreeingOptions.length === 1) {
    winner = agreeingOptions[0];
  } else if (agreeingOptions.length > 1) {
    // More than one option self-agrees -- this ticket's own instruction: "the option whose
    // self-agreeing value is lowest ... is the answer". Direction (lowest) is NOT a new choice --
    // it carries forward the same ascending-sort convention this file's pre-existing hard-number
    // logic already used (unchanged scope; direction-awareness for a "most X" question is a
    // separate, pre-existing gap this ticket was not asked to fix -- see the SEG return).
    const sorted = [...agreeingOptions].sort((a, b) => agreeing[a] - agreeing[b]);
    winner = sorted[0];
    notes.push(`   value convergence: more than one option self-agreed (${agreeingOptions.join(', ')}) -- lowest self-agreeing value selected: ${winner}`);
  }
  if (winner) {
    notes.push(`   value convergence winner: ${winner}  (self-agreed, lowest reading ${agreeing[winner]} ${property} -- ATTRIBUTED, Founder Ruling 2, BP151)`);
  }
  return { winner, agreeing, notes };
}

/** D-BP151-024/BISHOP/seg-value-convergence. Extracted (D-BP151-020's FIX 1) pure function, still
 *  no askGoogle, no emit, no network, no register gate -- unit-testable the same way toPerSqKm()
 *  already is (this file's own header note under "DO NOT RUN THE PIPELINE").
 *
 *  TWO BRANCHES, IN ORDER, PLUS ABSTAIN -- REPLACES D-BP151-020's three-branch design per two
 *  Founder rulings, BP151 (both filed BISHOP_DROPZONE\FOUNDER_DECISIONS_BP151.md):
 *
 *  1. VALUE CONVERGENCE (see detectValueConvergence() above for the full citation and the order-
 *     of-magnitude agreement test the Founder ordered to resolve what "agree" means).
 *     // ATTRIBUTED: Founder, BP151, verbatim: "Value convergence is undeniable, so that one."
 *  2. VOTES, ONLY IF VALUE CONVERGENCE IS NON-EXISTENT -- reuses the pre-existing cross-framing
 *     convergenceWinner computation (tare-sweep D-BP151-019 row #10), UNCHANGED semantics. Its
 *     "strict majority required, a tie yields no winner" rule is ITSELF an UNATTRIBUTED TARE, left
 *     exactly as found -- what changed is ONLY that it now fires solely as a fallback, never a
 *     gate on a hard number.
 *     // ATTRIBUTED (the precedence, not the vote rule itself): Founder, BP151, verbatim: "only
 *     // if value convergence is non-existent, it trumps vote convergence every time (especially
 *     // since the voters are suspect actors anyway)"
 *  3. Otherwise ABSTAIN.
 *
 *  SOLE SURVIVOR IS REMOVED, NOT A THIRD BRANCH. Elimination leaving one option in the pool no
 *  longer auto-declares it; that option must still earn the verdict from branch 1 or 2 above.
 *  // ATTRIBUTED: Founder, BP151, verbatim, in answer to Bishop's Q-13a ("The sole-survivor rule
 *  // at comparative_cascade.ts:662-665 declares an answer when elimination leaves one option.
 *  // Your qid-98 walkthrough never reduced to one survivor before the hard number. Yours or a
 *  // tare?"): "Q-13a yes remove it"
 *
 *  The coverage precondition (votedWithoutValue) is ATTRIBUTED per tare-sweep row #12 (D-BP151-013
 *  FIX 3) and stays, unchanged, now gating branch 1 (its logical successor -- both are value-based
 *  branches; the vote-only branch 2 never looked at densities and is unaffected either way). */
export function evaluateComparativeTerminator(
  pool: string[],
  densities: Record<string, number>,
  leastVotes: Record<string, number>,
  property: string,
  densityObservations: Record<string, number[]> = {},
): ComparativeTerminatorResult {
  const notes: string[] = [];
  let verdict: string | null = null;
  let basis = '';

  // ATTRIBUTED per tare-sweep row #12 (D-BP151-013 FIX 3), kept exactly as it was -- now gates
  // branch 1 (value convergence) instead of the removed hard-number branch it used to gate.
  const votedLeast = Object.keys(leastVotes).filter((L) => pool.includes(L) && leastVotes[L] >= 1);
  const votedWithValue = votedLeast.filter((L) => densities[L] !== undefined);
  const votedWithoutValue = votedLeast.filter((L) => densities[L] === undefined);
  if (votedLeast.length) {
    notes.push(`   coverage check for the value-convergence branch: voted least-${property} = ${votedLeast.join(', ')}   have a value: ${votedWithValue.join(', ') || '(none)'}   no value (honest null or unresolved): ${votedWithoutValue.join(', ') || '(none)'}`);
  }

  // BRANCH 1: VALUE CONVERGENCE -- ATTRIBUTED, Founder Ruling 2, BP151. See
  // detectValueConvergence()'s own doc comment for the full citation and the order-of-magnitude
  // agreement test the Founder ordered (BP151, verbatim: "Order of magnitude works as the basis").
  if (votedWithoutValue.length) {
    notes.push(`   value-convergence branch: WITHHELD -- ${votedWithoutValue.join(', ')} ${votedWithoutValue.length === 1 ? 'was' : 'were'} voted least-${property} by stages 3/4 but ${votedWithoutValue.length === 1 ? 'has' : 'have'} no resolved value; ranking only the subset the parser succeeded on is not ranking the pool`);
  } else {
    const vc = detectValueConvergence(pool, densityObservations, property);
    notes.push(...vc.notes);
    if (vc.winner) {
      verdict = vc.winner;
      const winnerVals = densityObservations[vc.winner] ?? [];
      basis = `value convergence: ${property} readings (${winnerVals.join(', ')}) across ${winnerVals.length} framings share order of magnitude 10^${orderOfMagnitude(vc.agreeing[vc.winner])} -- ATTRIBUTED, Founder Ruling 2, BP151, verbatim: "Value convergence is undeniable, so that one" (agreement test itself ATTRIBUTED, Founder, BP151: "Order of magnitude works as the basis")`;
      notes.push(`   BRANCH FIRED: value convergence (${vc.winner}) -- ATTRIBUTED, Founder Ruling 2, BP151`);
    }
  }

  // BRANCH 2: VOTES, ONLY IF VALUE CONVERGENCE IS NON-EXISTENT.
  // // ATTRIBUTED (precedence only): Founder, BP151, verbatim: "only if value convergence is
  // // non-existent, it trumps vote convergence every time"
  if (!verdict) {
    const convergenceRanked = Object.keys(leastVotes).filter((L) => pool.includes(L)).sort((a, b) => leastVotes[b] - leastVotes[a]);
    const convergenceWinner = convergenceRanked.length && (convergenceRanked.length === 1 || leastVotes[convergenceRanked[0]] > leastVotes[convergenceRanked[1]])
      ? convergenceRanked[0]
      : null;
    if (convergenceWinner) {
      notes.push(`   cross-framing convergence winner: ${convergenceWinner}  (${leastVotes[convergenceWinner]} vote(s) under the pre-existing strict-majority rule, TARE, unchanged by this ticket)`);
      verdict = convergenceWinner;
      basis = `converged across framings as least ${property} (${leastVotes[convergenceWinner]} votes) -- TARE: strict-majority rule, unattributed, pre-existing (tare-sweep row #10), fired here only as the FALLBACK because branch 1 (value convergence) found nothing -- ATTRIBUTED precedence, Founder Ruling 2, BP151, not ordered or changed by this ticket otherwise`;
      notes.push(`   BRANCH FIRED: vote fallback (${convergenceWinner}) -- vote rule itself is TARE, unattributed; the PRECEDENCE that lets it fire only here is ATTRIBUTED, Founder Ruling 2, BP151`);
    } else {
      notes.push('   cross-framing convergence: no winner under the pre-existing strict-majority rule (tie or no votes)');
    }
  }

  // SOLE SURVIVOR REMOVED -- ATTRIBUTED, Founder Ruling 1 (Q-13a), BP151, verbatim: "yes remove
  // it". No third branch here: a pool of one option that reached neither branch 1 nor branch 2
  // above ABSTAINS, it is not auto-declared. (tare-sweep row #11, this rule no longer exists.)
  if (!verdict) {
    notes.push('   BRANCH: none fired -- ABSTAIN. Sole-survivor auto-declare is REMOVED (ATTRIBUTED, Founder Ruling 1/Q-13a, BP151: "yes remove it") -- a narrowed pool no longer auto-answers itself.');
  }
  return { verdict, basis, notes };
}

// ─────────────────────────── D-BP151-027: abstain clues (Contingency Operator) ───────────────

/** D-BP151-027/BISHOP/seg-abstain-clues: resolves the ABSTAIN CLUES Contingency Operator gate.
 *  Same isXModeEnabled() resolver shape the Founder named as the pattern to match --
 *  isAdjudicationAlwaysModeEnabled() (plow_mc_answerer.ts:6205) -- a boolean param plus an
 *  env-var escape hatch, ONE RESOLVER PER GATE.
 *
 *  THE POLARITY IS FLIPPED, ON PURPOSE, same deviation D-BP151-026's
 *  isContingencyOperatorSurveySpliceEnabled() (liana_terminal_engine.ts:97) already made and
 *  documented for the identical reason: isAdjudicationAlwaysModeEnabled() and its own cited
 *  siblings (isAnswerCacheModeEnabled/isSemanticSoccerballModeEnabled/
 *  isEscalationLadderModeEnabled, ai_dispatch_ipc.ts) all default ON (undefined/true = on,
 *  explicit false = the opt-out). This gate defaults OFF.
 *  // ATTRIBUTED: Founder, BP151 (FD-BP151-23/FD-BP151-26), verbatim: "This is a case for
 *  // Contingency Operators. Do it, and see if it works before I ratify" -- and: "A Contingency
 *  // Operator... is not ratified by existing." Defaulting this ON would make it the shipped
 *  // behavior the moment it lands, which is exactly what he ordered NOT to happen; the env var
 *  // (COMPARATIVE_ABSTAIN_CLUES=1) exists for the same quick-local-testing purpose the cited
 *  // resolvers' own env vars serve. */
export function isAbstainCluesModeEnabled(abstainCluesCO: boolean | undefined): boolean {
  if (abstainCluesCO === true) return true;
  return process.env.COMPARATIVE_ABSTAIN_CLUES === '1';
}

/** D-BP151-027/BISHOP/seg-abstain-clues. Pure function -- no askGoogle, no emit, no network, same
 *  unit-testable convention as toPerSqKm()/detectValueConvergence() above (this file's own header
 *  under "DO NOT RUN THE PIPELINE"). Takes ONLY values the terminator already computed and was
 *  about to discard on an abstain -- pool (survivor pool), OPT (option text), densities (the
 *  first-bound resolved value per option), leastVotes (the vote tally), densityObservations
 *  (every resolved value per option across every framing that resolved one) -- see run()'s own
 *  call site below for the exact path:line each is harvested from, and this ticket's SEG return
 *  for the full inventory. NEVER touches `verdict` -- this is only ever called from run() AFTER
 *  evaluateComparativeTerminator() has already returned verdict:null; nothing here can promote a
 *  guess to an answer because nothing here is consulted by the branches that decide the verdict.
 *
 *  FOUR SIGNALS, AND ONLY FOUR -- the Founder's own worked examples (FD-BP151-26, verbatim: "Like
 *  the sole-survivor - not definitive on it's own, but there are other rules and principles we
 *  can apply that, combined with it, ARE definitive"), no fifth invented:
 *   1. sole-survivor        -- pool narrowed to exactly one option. ATTRIBUTED, Founder Ruling
 *      1/Q-13a, BP151: "yes remove it" removed this as a terminator branch; FD-BP151-26
 *      reintroduces it here, and ONLY here, as a labeled clue -- his own worked example.
 *   2. vote-count            -- carried >=1 "least" vote across framings. Guaranteed NOT a strict
 *      majority here (a majority would already have produced a non-null verdict via branch 2 and
 *      this function would never run) -- the vote rule itself is TARE, unattributed, pre-existing
 *      (tare-sweep row #10); reporting a non-winning vote count as a clue is REPORTING only, not
 *      a new decision rule.
 *   3. coverage-incomplete   -- has a resolved value, but branch 1 (value convergence) was
 *      WITHHELD entirely because the coverage precondition failed for the voted-least set
 *      (ATTRIBUTED per tare-sweep row #12, D-BP151-013 FIX 3) -- every resolved value in the pool
 *      is affected when this withholds, not only the voted-least ones (the withheld note's own
 *      words: "ranking only the subset the parser succeeded on is not ranking the pool").
 *   4. value-no-convergence  -- branch 1 ran (coverage was complete) but no option self-agreed
 *      (detectValueConvergence() returned no winner); among resolved values, the LOWEST is named
 *      per the Founder's own example wording ("its value was lowest but did not converge across
 *      framings"). Calls detectValueConvergence() a SECOND time here, over the SAME
 *      densityObservations branch 1 already collected -- the SAME already-exported pure function
 *      and the SAME order-of-magnitude rule, not a new one; "lowest" is the SAME ascending
 *      comparison detectValueConvergence()'s own tie-break already uses (line ~611 above), not an
 *      invented weight.
 *
 *  NO RANKING ACROSS SIGNALS OR OPTIONS BEYOND WHAT ALREADY EXISTED. Per this ticket's own hard
 *  constraint ("DO NOT INVENT A RANKING NUMBER... reporting them unranked, each with its named
 *  signal, is an acceptable and honest outcome"), `runnersUp` is NOT sorted into one combined
 *  cross-signal order: the vote-count group keeps the SAME descending-by-vote-count sort branch 2
 *  already uses (evaluateComparativeTerminator's own convergenceRanked); every other group is
 *  emitted in pool order. No clue object carries a score, weight, or rank field -- see
 *  ComparativeAbstainClue's own five named fields, shared/liana_cycle/liana_terminal_types.ts. */
export function buildAbstainCluesReport(
  pool: string[],
  OPT: Record<string, string>,
  densities: Record<string, number>,
  leastVotes: Record<string, number>,
  property: string,
  densityObservations: Record<string, number[]>,
  terminatorNotes: string[],
): ComparativeAbstainCluesReport {
  const runnersUp: ComparativeAbstainClue[] = [];

  // SIGNAL 1: sole survivor -- ATTRIBUTED, Founder Ruling 1/Q-13a, BP151 (removal) + FD-BP151-26
  // (reintroduction as a clue, his own worked example).
  if (pool.length === 1) {
    const L = pool[0];
    runnersUp.push({
      letter: L,
      optionText: OPT[L],
      signal: 'sole-survivor',
      guess: `GUESS: ${OPT[L]} -- guessing from being the sole survivor of elimination.`,
      basis: 'sole survivor of elimination, NOT definitive alone -- ATTRIBUTED, Founder Ruling 1/Q-13a, BP151: "yes remove it" (removed as a terminator branch); reintroduced ONLY as a labeled clue per FD-BP151-26, Founder, BP151, verbatim: "Like the sole-survivor - not definitive on its own, but there are other rules and principles we can apply that, combined with it, ARE definitive."',
    });
  }

  // SIGNAL 2: vote count, not a strict majority (guaranteed true here -- see this function's own
  // doc comment). SAME descending-by-count sort branch 2 already uses -- harvested, not invented.
  const votedLeast = Object.keys(leastVotes).filter((L) => pool.includes(L) && leastVotes[L] >= 1);
  const voteRanked = [...votedLeast].sort((a, b) => leastVotes[b] - leastVotes[a]);
  for (const L of voteRanked) {
    runnersUp.push({
      letter: L,
      optionText: OPT[L],
      signal: 'vote-count',
      guess: `GUESS: ${OPT[L]} -- guessing from carrying ${leastVotes[L]} "least ${property}" vote(s) across framings, not a strict majority.`,
      basis: `cross-framing vote count = ${leastVotes[L]}, NOT a strict majority -- the vote rule itself is TARE, unattributed, pre-existing (tare-sweep row #10); its precedence as a fallback-only signal is ATTRIBUTED, Founder Ruling 2, BP151: "only if value convergence is non-existent, it trumps vote convergence every time"`,
    });
  }

  // Coverage gate -- IDENTICAL filter to evaluateComparativeTerminator's own (this file, votedLeast/
  // votedWithoutValue just above BRANCH 1), reused rather than re-derived differently.
  const votedWithoutValue = votedLeast.filter((L) => densities[L] === undefined);

  if (votedWithoutValue.length) {
    // SIGNAL 3: coverage incomplete -- branch 1 was withheld entirely, so every resolved value in
    // the pool (not only the voted-least ones) never got evaluated for value convergence.
    for (const L of pool) {
      if (densities[L] !== undefined) {
        runnersUp.push({
          letter: L,
          optionText: OPT[L],
          signal: 'coverage-incomplete',
          guess: `GUESS: ${OPT[L]} -- guessing from a resolved ${property} value (${densities[L]}) that branch 1 never evaluated, because coverage of the voted-least set was incomplete.`,
          basis: `resolved value present (${densities[L]}), but the value-convergence branch WITHHELD -- ${votedWithoutValue.map((x) => OPT[x]).join(', ')} ${votedWithoutValue.length === 1 ? 'was' : 'were'} voted least-${property} with no resolved value -- ATTRIBUTED per tare-sweep row #12, D-BP151-013 FIX 3: "ranking only the subset the parser succeeded on is not ranking the pool"`,
        });
      }
    }
  } else {
    // SIGNAL 4: branch 1 ran (coverage complete) but nobody self-agreed. Reuses
    // detectValueConvergence() -- the SAME pure function branch 1 already calls, over the SAME
    // densityObservations -- guaranteed winner === null here (a winner would have produced a
    // non-null verdict, and this function is only ever called on a genuine abstain).
    const vc = detectValueConvergence(pool, densityObservations, property);
    if (!vc.winner) {
      const resolved = pool.filter((L) => densities[L] !== undefined);
      if (resolved.length) {
        const lowestVal = Math.min(...resolved.map((L) => densities[L]));
        const lowestLetters = resolved.filter((L) => densities[L] === lowestVal);
        for (const L of lowestLetters) {
          runnersUp.push({
            letter: L,
            optionText: OPT[L],
            signal: 'value-no-convergence',
            guess: `GUESS: ${OPT[L]} -- guessing from having the lowest resolved ${property} value (${densities[L]}) among the pool, though it did not self-agree (order of magnitude) across framings.`,
            basis: `lowest resolved value in the pool (${densities[L]}), but NOT self-agreeing across framings -- ATTRIBUTED test, Founder, BP151: "Order of magnitude works as the basis" (the same order-of-magnitude rule branch 1 uses; here it found no winner, so this is reported as a clue, not a verdict)`,
          });
        }
      }
    }
  }

  // "Why the run abstained" -- HARVESTED VERBATIM from the terminator's own notes, never
  // re-derived or paraphrased (per HARDWIRE-23 Law 5: the receipt names which rule fired, and its
  // attribution status -- evaluateComparativeTerminator's notes already carry both).
  const whyAbstained = terminatorNotes.filter((n) => /BRANCH|WITHHELD|value.convergence|coverage check|cross-framing convergence/i.test(n));

  return { runnersUp, whyAbstained };
}

// ─────────────────────────── run ───────────────────────────

// D-BP151-027/BISHOP/seg-abstain-clues: `abstainCluesCO` is a THIRD, OPTIONAL parameter -- the
// LianaMethod.run field type (method_registry.ts) is `(input, ctx) => Promise<LianaTerminalOutcome>`
// and is NOT changed by this ticket (that file is not in this ticket's scope). A function with an
// additional OPTIONAL parameter is assignable to that narrower type (TS function-type
// compatibility: every existing caller going through the registry -- comparativeCascadeMethod.run
// at the bottom of this file, called with exactly 2 args -- still type-checks and still always
// passes `undefined` here, same as isContingencyOperatorSurveySpliceEnabled()'s own boolean param
// in liana_terminal_engine.ts is threaded in from OUTSIDE the method registry today). This is
// PROOF, not assertion, of "off by default": no caller reachable through the registry can ever
// pass anything but `undefined` for this parameter today, so isAbstainCluesModeEnabled() falls
// through to the env-var check every single time unless a caller (e.g. this ticket's own test)
// invokes run() directly with a third argument.
async function run(input: MethodQuestionInput, ctx: MethodRunContext, abstainCluesCO?: boolean): Promise<LianaTerminalOutcome> {
  const { askGoogle, emit } = ctx;
  const OPT = input.options as Record<string, string>;
  const ALL = Object.keys(OPT);
  const KEY = input.correctAnswer;
  const t0 = Date.now();

  const say = (text: string) => emit({ kind: 'header', text, ts: nowIso() });
  const step = (text: string) => emit({ kind: 'stage', text: `-> ${text}`, ts: nowIso() });
  const fact = (text: string) => emit({ kind: 'fact', text: `+ ${text}`, ts: nowIso() });
  const note = (text: string) => emit({ kind: 'note', text, ts: nowIso() });

  say(`METHOD comparative-cascade -- ${input.qid != null ? `qid ${input.qid}` : 'free-text'}`);
  note(`   ${input.question}`);
  note(`   ${list(ALL, OPT)}`);

  const { category, property } = deriveCategoryAndProperty(input.question);
  note(`   derived category: "${category}"   derived property: "${property}"`);

  let pool = [...ALL];
  const leastVotes: Record<string, number> = {};
  const denseVotes: Record<string, number> = {};
  const densities: Record<string, number> = {};
  // D-BP151-024: every resolved (toPerSqKm-ok) value bound to an option, from EVERY framing that
  // resolves one -- not just the single representative value `densities` keeps. This is new
  // storage, not a new query/framing/stage (HARDWIRE-23's own carve-out: "It does not apply to
  // mechanical implementation choices with no effect on which answer comes out" does not quite
  // cover this, since it DOES feed a new decision rule -- see evaluateComparativeTerminator()'s
  // doc comment for the ATTRIBUTED rule this collection exists to serve). `densities` itself, and
  // every note describing it, is unchanged by this addition.
  const densityObservations: Record<string, number[]> = {};

  // STAGE 0: register gate -- extracted to runStage0RegisterGate() above (D-BP149-043) so
  // definitional_cascade.ts can share this exact code; behavior and printed output unchanged on
  // a successful run. FIX 1 (D-BP151-013): this can now THROW RegisterGateUnavailableError when
  // stage 0 could not execute after its retries -- caught here and turned into an honest abstain,
  // never allowed to reach the terminator with an unvetted pool (the qid 98 defect).
  try {
    pool = await runStage0RegisterGate(OPT, pool, ctx);
  } catch (e) {
    if (!(e instanceof RegisterGateUnavailableError)) throw e;
    const elapsedS = ((Date.now() - t0) / 1000).toFixed(1);
    emit({ kind: 'result', text: `ABSTAIN   stage 0 register gate unavailable${KEY != null ? `  key=${KEY}` : ''}`, ts: nowIso() });
    note(`   ${e.message}`);
    note('   this estate does not allow a gate to fail open (FIX 1, D-BP151-013): rather than continue with an unvetted option pool -- the qid 98 defect -- this run abstains instead of producing a verdict.');
    note(`   ${elapsedS}s   $0`);
    return {
      qid: input.qid,
      question: input.question,
      verdict: null,
      correct: KEY,
      abstain: true,
      freeText: input.qid == null,
      basis: 'stage 0 register gate unavailable after retries -- abstained rather than continue with an unvetted pool',
      error: 'register_gate_unavailable',
    };
  }

  const inverseQuestion = /\bNOT\b/i.test(input.question)
    ? input.question.replace(/\bNOT\s+/i, ' ').replace(/\s+/g, ' ').trim()
    : input.question;

  const questions = buildFounderQuestions(category, property, inverseQuestion, ALL, pool, OPT);

  for (const q of questions) {
    step(`Q${q.n}  stage ${q.stage} -- ${q.why}`);
    note(`   ${q.text}`);
    const res = await googleBlocks(askGoogle, q.text);
    if (!res.ok) {
      note(`   no answer (${res.via})`);
      continue;
    }
    fact(`Google [${res.via}]: ${res.text}`);

    let effect = '';
    if (q.stage === 1) {
      const mentions = await extractAssertedMentions(res.text, ALL, OPT, note);
      for (const { L, sentence: s } of mentions) {
        if (HIGH_WORDS.test(s) && !LOW_WORDS.test(s)) denseVotes[L] = (denseVotes[L] || 0) + 1;
        else if (LOW_WORDS.test(s) && !HIGH_WORDS.test(s)) leastVotes[L] = (leastVotes[L] || 0) + 1;
      }
      effect = `high-${property} votes: ${JSON.stringify(denseVotes)}   low-${property} votes: ${JSON.stringify(leastVotes)}`;
    } else if (q.stage === 3) {
      const ex = await gemmaExtract(
        `If this passage states an explicit ranking or ordered list of any of these names, copy that list out in exactly the order the passage gives it. If the passage does not state an order, return an empty list. Do not put them in order yourself. Names: ${ALL.map((L) => OPT[L]).join('; ')}`,
        res.text,
        `{"order":["exact name, in the passage's stated order"],"order_stated_in_passage":true}`,
      );
      let ord = toLetters(ex?.order as unknown[] | undefined, OPT);
      ord = ord.filter((L) => appearsIn(res.text, OPT[L]));
      if (ord.length >= 2) {
        const leastEnd = q.why.includes('most') && q.why.indexOf('most') < q.why.indexOf('least') ? ord[ord.length - 1] : ord[0];
        leastVotes[leastEnd] = (leastVotes[leastEnd] || 0) + 1;
        effect = `order: ${ord.join(' > ')}   least-${property} end: ${leastEnd}`;
      } else {
        effect = 'no usable ordering mapped';
      }
    } else if (q.stage === 4) {
      const mentions = await extractAssertedMentions(res.text, ALL, OPT, note);
      const low: string[] = [], high: string[] = [];
      for (const { L, sentence: s } of mentions) {
        if (LOW_WORDS.test(s) && !HIGH_WORDS.test(s)) low.push(L);
        else if (HIGH_WORDS.test(s) && !LOW_WORDS.test(s)) high.push(L);
        else note(`      ambiguous sentence for ${L}, counted for neither: ${s.slice(0, 110)}`);
      }
      for (const L of low) leastVotes[L] = (leastVotes[L] || 0) + 1;
      for (const L of high) denseVotes[L] = (denseVotes[L] || 0) + 1;
      effect = (low.length || high.length)
        ? `asserted LOW ${property}: ${low.join(', ') || '(none)'}   asserted HIGH ${property}: ${high.join(', ') || '(none)'}`
        : 'nothing mapped exactly';
    } else if (q.stage === 5) {
      const ex = await gemmaExtract(
        `Copy out every number in this passage that appears together with a unit or rate (for example "per square kilometer", "%", "/km2", "per sq mi"). For each one, copy the surrounding words exactly as they appear.`,
        res.text,
        `{"figures":[{"value":number,"unit":"the unit as written","context":"the verbatim surrounding text"}]}`,
      );
      let n = 0;
      // FIX 3 (D-BP151-020/BISHOP/seg-98-three-fixes): ADD LOGGING ONLY at this attribution
      // boundary -- no filtering, binding, or rejection behavior below is changed by this fix.
      // Measured defect (this ticket): real, unit-bearing densities present in the returned
      // passages (South Asia "329 per Km2", Northeast US "120 people/km 2", Sahara Desert "10
      // people per square kilometer") were logged as honest nulls with NO trace of the candidate
      // that was seen and discarded -- specifically, the case where a candidate's context matched
      // NO option at all (every `L` in the loop below fails `ctx2.includes(norm(OPT[L]))`) was
      // previously silent; nothing in this file recorded that the candidate existed. Every
      // candidate is now logged verbatim before the existing bind/reject logic runs, and an
      // unresolved-attribution case is logged explicitly instead of vanishing.
      for (const f of (ex?.figures as Array<{ value: number; unit?: string; context: string }> | undefined) ?? []) {
        if (typeof f.value !== 'number') continue;
        if (!appearsIn(res.text, f.context)) { note(`      rejected figure ${f.value}: quoted context not found in the passage`); continue; }
        const ctx2 = norm(String(f.context || ''));
        note(`      [attribution] candidate seen: value=${f.value}  unit=${f.unit ?? '(no unit field)'}  context="${f.context}"`);
        let boundToAnyOption = false;
        for (const L of ALL) {
          const contextNamesThisOption = ctx2.includes(norm(OPT[L]));
          if (contextNamesThisOption) {
            boundToAnyOption = true;
            if (densities[L] === undefined) {
              // FIX 2 (D-BP151-013): the value must prove it carries a real area-RATE unit before
              // it is trusted -- see toPerSqKm()'s own doc comment. A rejection is logged with the
              // raw text, the reason, and the option it belonged to, never silently dropped.
              const c = toPerSqKm(f.value, f.unit, f.context);
              if (c.ok) {
                densities[L] = c.value;
                n++;
                (densityObservations[L] ??= []).push(c.value);
                note(`      [attribution] option=${OPT[L]}  candidate value=${f.value} unit=${f.unit ?? '(no unit field)'}  -> BOUND: ${c.value.toFixed(2)} ${c.unit}`);
              } else {
                note(`      [attribution] option=${OPT[L]}  candidate value=${f.value} unit=${f.unit ?? '(no unit field)'}  -> REJECTED: ${c.reason}`);
              }
            } else {
              note(`      [attribution] option=${OPT[L]}  candidate value=${f.value} unit=${f.unit ?? '(no unit field)'}  -> not evaluated, ${OPT[L]} already has a bound value`);
              // D-BP151-024: `densities[L]` keeps only the first-bound value (unchanged above),
              // but a SECOND framing resolving the SAME option is exactly what the value
              // convergence rule (Founder Ruling 2) needs to check self-agreement -- so this
              // candidate is ALSO proven and, if it is a real rate, recorded as an additional
              // observation. This does not bind, overwrite, or otherwise touch `densities[L]`.
              const c2 = toPerSqKm(f.value, f.unit, f.context);
              if (c2.ok) {
                (densityObservations[L] ??= []).push(c2.value);
                note(`      [value-convergence] additional observation for ${OPT[L]}: ${c2.value.toFixed(2)} ${c2.unit}  (as written: ${f.value} ${f.unit ?? 'no unit'}; does not replace the bound value)`);
              }
            }
          }
        }
        if (!boundToAnyOption) {
          note(`      [attribution] candidate value=${f.value} unit=${f.unit ?? '(no unit field)'} context="${f.context}"  -> REJECTED: context does not name any listed option -- unresolved, not bound to any option`);
        }
      }
      for (const L of ALL) {
        note(`      [attribution] final for ${OPT[L]}: ${densities[L] !== undefined ? `${densities[L]}` : 'honest null (no bound value)'}`);
      }
      effect = n ? `values attributed by context match: ${Object.entries(densities).map(([L, d]) => `${L}=${d}`).join('  ')}` : "no figure's context named a listed option";
    }
    note(`   >> ${effect}`);
  }

  // STAGE 5b: one option per question -- ported rationale from qid98_his_words.mjs (bulk
  // multi-option queries can return context about the WRONG scale and attribute a number to the
  // wrong option; one option per question makes attribution unambiguous).
  // TARE (D-BP151-020, FIX 2 disclosure, per HARDWIRE-23 Law 2/4): this question's wording ("What
  // is the numeric value or rate associated with X? Report the number and its unit.") has NO
  // literal counterpart anywhere in RECOVERED_BP144.md or FounderCascadeWorkedByHand.txt -- his
  // hand-worked walkthrough never asks a single-option follow-up in this shape. Per this ticket's
  // own instruction ("If a framing the code sends has no counterpart in his file, report it and
  // leave it alone"), this wording is UNCHANGED and left exactly as found, surfaced here for the
  // Founder's ruling rather than silently rewritten or silently left undisclosed.
  const survivors = ALL.filter((L) => pool.includes(L));
  step(`STAGE 5b  one option per question -- ${survivors.length} surviving option(s)`);
  for (const L of survivors) {
    const q5b = `What is the numeric value or rate associated with "${property}" for ${OPT[L]}? Report the number and its unit.`;
    note(`   ${q5b}`);
    const res = await googleBlocks(askGoogle, q5b);
    if (!res.ok) { note(`   no answer (${res.via})`); continue; }
    fact(`Google [${res.via}]: ${res.text}`);
    const ex = await gemmaExtract(
      `Copy out every number in this passage that appears together with a unit or rate (for example "per square kilometer", "%", "/km2", "per sq mi", "years"). For each one, copy the surrounding words exactly as they appear, at least the full phrase or sentence containing it.`,
      res.text,
      `{"figures":[{"value":number,"unit":"the unit as written","context":"the verbatim surrounding text"}]}`,
    );
    const wanted = norm(OPT[L]);
    let picked: { value: number; unit?: string; context: string } | null = null;
    // FIX 3 (D-BP151-020/BISHOP/seg-98-three-fixes): ADD LOGGING ONLY -- every candidate is now
    // logged before the pre-existing first-match selection runs. `picked` still resolves to
    // EXACTLY the same candidate as before this fix (the first whose context names this option);
    // the loop no longer stops there via `break` so later candidates can still be logged, but no
    // later candidate is ever assigned to `picked`. CHANGE NO BEHAVIOR, LOOSEN NOTHING.
    for (const f of (ex?.figures as Array<{ value: number; unit?: string; context: string }> | undefined) ?? []) {
      if (typeof f.value !== 'number') continue;
      if (!appearsIn(res.text, f.context)) { note(`      rejected ${f.value}: quoted context not in the passage`); continue; }
      note(`      [attribution] option=${OPT[L]}  candidate seen: value=${f.value}  unit=${f.unit ?? '(no unit field)'}  context="${f.context}"`);
      const contextNamesThisOption = norm(String(f.context || '')).includes(wanted);
      if (contextNamesThisOption && !picked) {
        picked = f;
        note(`      [attribution] option=${OPT[L]}  candidate value=${f.value}  -> BOUND (first context match; pre-existing selection rule, unchanged by this fix)`);
      } else if (contextNamesThisOption) {
        note(`      [attribution] option=${OPT[L]}  candidate value=${f.value}  -> context matches ${OPT[L]}, but a candidate was already bound (first-match rule, pre-existing, unchanged) -- not selected`);
      } else {
        note(`      [attribution] option=${OPT[L]}  candidate value=${f.value}  -> REJECTED: context does not name ${OPT[L]}`);
      }
    }
    if (picked) {
      // FIX 2 (D-BP151-013): same unit-RATE proof as the stage-5 bulk pass above. This also
      // closes the overwrite this ticket's amendment found (stage 5b unconditionally overwrote a
      // good stage-5 value, e.g. Europe's real "72 per km2" from Q10, with a unit-less candidate,
      // e.g. "2012"): a rejected candidate is never assigned, so an earlier real value in
      // `densities[L]` (if any) survives untouched.
      const conv = toPerSqKm(picked.value, picked.unit, picked.context);
      if (conv.ok) {
        densities[L] = conv.value;
        // D-BP151-024: stage 5b is a DISTINCT framing (its own one-option-per-question query,
        // never asked in the stage-5 bulk loop above) -- its resolved value is recorded as an
        // additional observation for the value-convergence check, same as the bulk loop's second
        // fix above. Does not change which value `densities[L]` ends up holding.
        (densityObservations[L] ??= []).push(conv.value);
        note(`   >> ${OPT[L]} = ${conv.value.toFixed(2)} ${conv.unit}  (as written: ${picked.value} ${picked.unit || 'no unit'})`);
      } else {
        note(`   rejected candidate for ${OPT[L]}: ${picked.value} ${picked.unit ? `(unit field: "${picked.unit}")` : '(no unit field)'} -- ${conv.reason}   raw: "${picked.context}"`);
        note(`   no figure for ${OPT[L]} in this passage (honest null, not a guess)`);
      }
    } else {
      note(`   no figure for ${OPT[L]} in this passage (honest null, not a guess)`);
    }
    note(`      [attribution] final for ${OPT[L]} (stage 5b): ${densities[L] !== undefined ? `${densities[L]}` : 'honest null (no bound value)'}`);
  }

  // TERMINATOR. Arithmetic only, no model below this line.
  say('TERMINATOR');
  const denseElim = Object.keys(denseVotes).filter((L) => pool.includes(L) && denseVotes[L] >= 1);
  if (denseElim.length) {
    const before = pool.length;
    pool = pool.filter((L) => !denseElim.includes(L));
    note(`   eliminated as asserted-high-${property}: ${denseElim.join(', ')}   pool ${before} -> ${pool.length}`);
  }
  note(`   surviving pool after the inverse: ${pool.join(', ')}`);
  note(`   least-${property} votes across stages 3 and 4: ${Object.entries(leastVotes).map(([L, n]) => `${L}x${n}`).join('  ') || '(none)'}`);
  note(`   hard values: ${Object.entries(densities).map(([L, d]) => `${L}=${d}`).join('  ') || '(none)'}`);

  // D-BP151-024/BISHOP/seg-value-convergence: the verdict computation below is the pure, exported
  // evaluateComparativeTerminator() (see its own doc comment above run() for the two-branch
  // design this ticket replaced D-BP151-020's three-branch design with). Extracted out of this
  // function so it can be unit-tested directly (no live askGoogle, no register gate, no network),
  // the same way toPerSqKm() already is. Every note it emits is returned in .notes and emitted
  // here in the same order.
  const termResult = evaluateComparativeTerminator(pool, densities, leastVotes, property, densityObservations);
  for (const n of termResult.notes) note(n);
  const verdict = termResult.verdict;
  const basis = termResult.basis;

  const elapsedS = ((Date.now() - t0) / 1000).toFixed(1);
  if (verdict) {
    const ok = KEY != null ? verdict === KEY : undefined;
    emit({ kind: 'result', text: `${KEY != null ? (ok ? 'CORRECT' : 'WRONG') : 'ANSWER'}  ${verdict} (${OPT[verdict]})${KEY != null ? `  key=${KEY}` : ''}`, ts: nowIso() });
    note(`   ${basis}`);
    note(`   ${elapsedS}s   $0`);
    return { qid: input.qid, question: input.question, verdict, correct: KEY, ok, basis, abstain: false, freeText: input.qid == null };
  }
  emit({ kind: 'result', text: `ABSTAIN   pool=${pool.join(',')}${KEY != null ? `  key=${KEY}` : ''}`, ts: nowIso() });

  // D-BP151-027/BISHOP/seg-abstain-clues: OFF BY DEFAULT (isAbstainCluesModeEnabled(), see its own
  // doc comment above for the flipped-polarity idiom and why). When OFF, this block calls nothing,
  // builds nothing, emits nothing, and the return statement below spreads in ZERO extra keys -- the
  // outcome object is byte-identical in shape to every pre-BP151-027 abstain return. When ON, it
  // builds the report from ONLY the values already computed above (pool, densities, leastVotes,
  // densityObservations, termResult.notes) -- no new Google call, no new model call, no new
  // decision rule -- and attaches it beside the untouched verdict:null/abstain:true/basis above.
  const abstainCluesOn = isAbstainCluesModeEnabled(abstainCluesCO);
  let abstainClues: ComparativeAbstainCluesReport | undefined;
  if (abstainCluesOn) {
    abstainClues = buildAbstainCluesReport(pool, OPT, densities, leastVotes, property, densityObservations, termResult.notes);
    note('   CONTINGENCY OPERATOR (D-BP151-027, abstain-clues) ON -- runners-up follow. None of these are promoted to an answer; the verdict stays ABSTAIN.');
    if (abstainClues.runnersUp.length) {
      for (const c of abstainClues.runnersUp) {
        note(`   ${c.guess}`);
        note(`      basis: ${c.basis}`);
      }
    } else {
      note('   no runners-up -- none of the four known signals (sole-survivor, vote-count, coverage-incomplete, value-no-convergence) fired for this pool');
    }
  }

  note(`   ${elapsedS}s   $0`);
  return {
    qid: input.qid,
    question: input.question,
    verdict: null,
    correct: KEY,
    abstain: true,
    freeText: input.qid == null,
    basis: 'no terminator condition met',
    ...(abstainCluesOn ? { variant: 'contingency-operator-abstain-clues' as const, abstainClues } : {}),
  };
}

export const comparativeCascadeMethod: LianaMethod = {
  id: 'comparative-cascade',
  name: 'The Comparative Cascade',
  // D-BP150-003: this method orders options by a property. Its answer is a position in an
  // ordering, so its demand is RANK. It must not run on a question that demands anything else.
  demand: 'RANK',
  taughtBy: 'qid 98 (population density), Founder hand-worked BP149, proven live BP149 (scripts/_superseded/qid98_his_words.mjs, D-BP149-036: A, sole survivor, Google only, $0, 183s)',
  shapeDescription: 'options are members of one category and the question turns on ranking them by a property',
  shapeTest,
  run,
};

registerMethod(comparativeCascadeMethod);
