// method_registry_consult.ts -- D-BP223-BM04-Y005-002-REGWRAP/BISHOP-SEG/S3/seg-regwrap
//
// FOUNDER RULING THIS FILE IMPLEMENTS (k/19e1cf67):
//   Item 3, verbatim: "HOLD until the REGISTRY is wired, and then do LOW."
//   Item 2, verbatim: "Yes do all of that."
// This dispatch is the REGISTRY side of that ruling only -- a flag-gated wrapper that lets a
// caller ask the existing Method Registry (method_registry.ts) whether any registered, non-
// quarantined method would answer a given MMLU-Pro-shaped item, and if so, run it, WITHOUT that
// answer touching any real sweep, checkpoint, or ledger unless a human wires the call site.
//
// This file is consulted by nothing unless a sweep is launched with --methods=on; a registrar
// release changes no sweep's behavior until a human adds that flag.
//
// SCOPE DISCIPLINE (Rule 66 / this ticket):
//   - NEW FILE ONLY. Nothing in method_registry.ts, liana_terminal_engine.ts, demand_test.ts, or
//     any plow/ file is modified, imported-and-mutated, or monkey-patched by this file.
//   - selectEligibleMethods() (method_registry.ts, quarantine gate lives there) is CALLED, never
//     reimplemented. Every selection/eligibility DECISION in this file's output comes from that
//     one call; nothing here re-derives "is this method allowed to run".
//   - NO import of anything under plow/. NO disk writes. NO network calls. NO reading of
//     process.env anywhere in this file -- the --methods=on flag named above lives in the CALLER
//     (the sweep/runner that decides whether to invoke consultRegistryForMcItem() at all); this
//     module itself is inert plumbing and cannot see or act on that flag.
//
// THE DEMAND DECISION (read this before assuming a demand gets computed here):
//   liana_terminal_engine.ts's REAL demand determination is a multi-stage pipeline --
//   determineDemandFromOperationAnswer() -> determineDemandFromSurveyedAsk() ->
//   determineDemandFromAmbiguityNested() -> determineDemandFromQuestionStructure() (demand_test.ts)
//   -- where every stage before the last one consumes Survey's own ambiguity/operation query
//   RESULTS, which only exist after Survey has made real askGoogle/askConversationalAuthority
//   calls (I/O). The one stage that is pure and exported,
//   determineDemandFromQuestionStructure(question, options), is documented in demand_test.ts
//   itself as a LAST RESORT: "MUST be called only after determineDemandFromSurveyedAsk(),
//   determineDemandFromOperationAnswer(), and determineDemandFromAmbiguityNested() have all
//   failed to produce a demand -- it is a last resort, never a first opinion." Calling it here,
//   standing alone, with none of the higher-priority I/O-backed stages run first, would not
//   reproduce "how liana_terminal_engine.ts determines a question's LianaDemand" -- it would
//   silently substitute a weaker guess for a determination this file has no way to make honestly.
//   That is exactly the kind of invented demand this ticket forbids ("Never invent a demand").
//   So: this file computes NO demand of its own. `opts.demand` is passed straight through,
//   unchanged, to selectEligibleMethods() exactly as received (undefined skips the demand gate
//   entirely, per that function's own convention; null means "no demand could be determined",
//   which per canon R-4/R-5 correctly gates out every method). Demand gating is the CALLER's job.
//
// THE INERT CONTEXT (why askGoogle/askConversationalAuthority refuse rather than answer):
//   A registry consult run has no browser, no signed-in session, and no budget -- it must never
//   look, to a method or to a later reader of the transcript, like a real query that happened to
//   come back empty. So both functions below return a POPULATED, non-empty, explicitly-marked
//   refusal (never `null`, never an empty-string snippet) and increment `contextRefusals` once per
//   call, in addition to emitting one transcript line each time. See buildInertContext() below for
//   the exact shapes, matched field-for-field against MethodRunContext's own required interface
//   (method_registry.ts, MethodRunContext, and AskGoogleFn / ConversationalAuthorityFn just above
//   it) and against BrowserAuthorityRawExtraction (src/shared/plow/browser_authority_types.ts).
//
// OPTIONS CONVERSION: options[] (positional) -> Record<letter, text>, LETTER(i) =
// String.fromCharCode(65 + i) -- the same formula plow_mc_item_runner.cjs's own `LETTER` closure
// uses (that file is being edited concurrently by other SEGs this dispatch, so its own line
// numbers have moved since this ticket was written; the formula itself, confirmed by reading the
// live file, is unchanged: `const LETTER = (i) => String.fromCharCode(65 + i);`).
//
// D-BP223-BM04-Y005-004-SCOPEALL, Founder ruling k/dd7d3c25, verbatim: "why can't we use the rest
// of the 270? I want to." Terminal ruling, 18:40 Central: SHADOW ONLY -- the chosen answer is
// NEVER changed. Added `opts.scope?: 'live' | 'all'` (default 'live', unchanged behavior). Scope
// 'all' is shadow measurement of quarantined methods; it never releases anything and the ledger is
// untouched. Neither method_registry.ts nor HARDWIRE\LEDGER\METHOD_QUARANTINE\ is read, imported,
// or modified by this addition -- 'all' walks listMethods() directly (never
// selectEligibleMethods()) and calls each eligible method's own shapeTest()/run() exactly as
// registered, including quarantined ones, purely to measure what they would do. Ledger truth
// (which methods are actually quarantined) stays entirely with method_registry.ts and X007's own
// SEG 013 lane; this file only ever reads that state via listMethods(), never writes it.
//
// D-BP223-BM04-Y005-007-FENCEMARK, XO order (seat lane, 20:02 Central 2026-09-08), verbatim:
// "Unfenced run: make the row say refusedQuarantine or scope-all-bypass explicitly, then file."
// Why: arm D (D-BP223-BM04-Y005-006-ARMD_SHADOW_READING.md) showed a quarantined fingerprint
// method (sum-parts-then-multiply-by-rate-v1) running under --methods-scope=all and returning
// "6329" with refused=false -- a run that reads, on the row, exactly the same as a live method's
// clean run. Added a `fence` field, per `runs[]` entry AND mirrored on the top-level result for
// the method that populated `methodSelected` (the first attempt), so a reader never has to
// cross-reference `quarantined`+`refused` by hand to tell the two apart. Four values only:
// 'not-quarantined' (the ordinary case, both scopes), 'refused-by-method' (quarantined, and the
// method's own run() threw or said so -- today's `refused: true`), 'RAN-UNFENCED-UNDER-SCOPE-ALL'
// (quarantined, ran to completion, said nothing about quarantine -- loud on purpose, this is the
// arm D finding's own shape), and 'not-run' (no attempt was made at all -- top-level mirror only,
// never appears inside `runs[]` itself since every `runs[]` entry is, by construction, an attempt
// that was actually made). `refused`/`quarantined` on each `runs[]` entry are unchanged, additive
// only -- `fence` is derived from them, never replaces them. Neither `method_registry.ts` nor the
// quarantine ledger is read, imported, or modified by this addition either.

import type { LianaTerminalEvent, LianaTerminalOutcome } from '../../shared/liana_cycle/liana_terminal_types';
import {
  listMethods,
  selectEligibleMethods,
} from './method_registry';
import type {
  AskGoogleFn,
  ConversationalAuthorityFn,
  EmitFn,
  LianaDemand,
  LianaMethod,
  MethodQuestionInput,
  MethodRunContext,
} from './method_registry';

/** D-BP223-BM04-Y005-007-FENCEMARK. See this file's header for the arm D finding this closes.
 *  'not-quarantined': the method was not quarantined at call time (the ordinary case, both
 *  scopes). 'refused-by-method': quarantined, and this attempt's own `refused` is true (the
 *  method's run() threw, or its resolved outcome text itself mentioned "quarantine"). 'RAN-
 *  UNFENCED-UNDER-SCOPE-ALL': quarantined, ran to completion, and said nothing about quarantine --
 *  the exact shape arm D measured on sum-parts-then-multiply-by-rate-v1. 'not-run': no attempt was
 *  made at all -- valid ONLY on the top-level mirrored field (methodSelected === null), never on a
 *  `runs[]` entry, since every entry in `runs[]` is, by construction, an attempt that was made. */
export type RunFence =
  | 'not-quarantined'
  | 'refused-by-method'
  | 'RAN-UNFENCED-UNDER-SCOPE-ALL'
  | 'not-run';

/** One MMLU-Pro-shaped item, as the caller has it -- options POSITIONAL, not yet lettered. */
export interface RegistryConsultItem {
  qid?: number;
  question: string;
  options: string[];
  correctAnswer?: string;
  category?: string;
}

export interface RegistryConsultOpts {
  /** The letter the sweep's own (non-registry) plurality vote already picked for this item, if
   *  any -- used ONLY to report agreement, never to influence selection or running. */
  pluralityLetter?: string | null;
  /** See this file's header, "THE DEMAND DECISION" -- passed through to selectEligibleMethods()
   *  unchanged. undefined = demand gate skipped entirely (every non-quarantined method's shapeTest
   *  runs); null = no demand determined, so canon R-4/R-5 correctly gates out every method; a real
   *  LianaDemand = only methods declaring that demand are walked. This file never computes one. */
  demand?: LianaDemand | null;
  /** How many eligible, non-null-run methods to actually execute, in eligible order (registration
   *  order). Default 1: run only the first eligible method with a non-null run(). Only the FIRST
   *  attempted method's result populates methodSelected/methodLetter/methodOutcomeSummary/
   *  methodAgreedWithPlurality below -- a maxRun > 1 exercises additional eligible methods (their
   *  emit() lines still land in `transcript`, and a later attempt's own thrown error is recorded
   *  in `error` only if the first attempt did not already throw), but the return shape has room
   *  for exactly one "selected" result, so that is always the first attempt, never the last. */
  maxRun?: number;
  /** Optional live sink -- called once per emit() line, in real time, in ADDITION to (never
   *  instead of) the returned, capped `transcript` array. Never allowed to crash this consult: any
   *  throw from emitSink itself is swallowed. */
  emitSink?: (line: string) => void;
  /** D-BP223-BM04-Y005-004-SCOPEALL. 'live' (default, omitting this field is identical) = today's
   *  behavior, byte-identical: the ONE eligibility decision comes from selectEligibleMethods(),
   *  which never returns a quarantined method, and shapeTest() never runs on a quarantined method
   *  either. 'all' = SHADOW measurement only (Founder ruling k/dd7d3c25; terminal ruling 18:40
   *  Central: the chosen answer is never changed by this scope). Under 'all' this file walks
   *  listMethods() directly -- never selectEligibleMethods(), never touching method_registry.ts --
   *  applying the SAME demand rule documented above (opts.demand undefined skips the gate) but
   *  running shapeTest() on EVERY registered method INCLUDING quarantined ones, and, up to
   *  opts.maxRun, actually calling run() on eligible methods even when quarantined -- specifically
   *  to measure whether that method's own run() "ALSO refuses loudly if called directly" the way
   *  LianaMethod.quarantined's own doc comment (method_registry.ts) says it should, rather than
   *  assuming it does. See eligibleQuarantined/eligibleLive/runs/methodRunRefusedQuarantine below. */
  scope?: 'live' | 'all';
}

export interface RegistryConsultResult {
  /** Count of REGISTRY entries whose shapeTest() actually ran under this call's own quarantine +
   *  demand gating -- a read-only tally over the same public `quarantined`/`demand` fields
   *  selectEligibleMethods() itself gates on (via listMethods()), computed here only to report a
   *  denominator; it decides nothing and re-derives no eligibility. The actual eligible set below
   *  comes entirely from calling selectEligibleMethods(). */
  methodsConsulted: number;
  /** Every eligible match, in registration order -- under 'live', selectEligibleMethods()'s own
   *  return, mapped to {id, reason, quarantined} (quarantined always false here, since
   *  selectEligibleMethods() never returns a quarantined method); under 'all', every registered
   *  method (any quarantine state) whose shapeTest() matched, same demand rule, walked directly via
   *  listMethods() (SCOPEALL). Never the full LianaMethod object, which is not JSON-safe. */
  eligible: Array<{ id: string; reason: string; quarantined: boolean }>;
  /** D-BP223-BM04-Y005-004-SCOPEALL. Echoes opts.scope, defaulted to 'live'. Always present, both
   *  scopes. */
  scope: 'live' | 'all';
  /** D-BP223-BM04-Y005-004-SCOPEALL. Of `eligible`, how many have `quarantined === true`. Always 0
   *  under 'live' (selectEligibleMethods() never returns a quarantined method) -- under 'all' this
   *  is the SHADOW measurement's own headline denominator. */
  eligibleQuarantined: number;
  /** D-BP223-BM04-Y005-004-SCOPEALL. Of `eligible`, how many are NOT quarantined --
   *  eligible.length - eligibleQuarantined, always, both scopes. */
  eligibleLive: number;
  /** id of the first eligible method with a non-null run() that this call actually invoked (set
   *  the moment run() is called, whether it goes on to answer, abstain, or throw). null when no
   *  method was eligible, every eligible method's run is null (registered-but-not-yet-taught
   *  stubs only), or maxRun resolved to 0. */
  methodSelected: string | null;
  /** 'live': the letter the FIRST attempted method's LianaTerminalOutcome resolved to. null on
   *  abstain, on no method selected, on a stub (run === null for every eligible entry), or on a
   *  thrown error from that first attempt -- UNCHANGED by SCOPEALL, byte-identical.
   *  'all' (D-BP223-BM04-Y005-004-SCOPEALL): the FIRST NON-NULL letter across `runs` (up to
   *  opts.maxRun attempts), or null if every attempt abstained, threw, or was a stub -- see `runs`
   *  below for every individual attempt's own letter, not just this summary. */
  methodLetter: string | null;
  /** methodLetter === opts.pluralityLetter when both are non-null; null whenever either side is
   *  absent (nothing to compare) -- never coerced to false. */
  methodAgreedWithPlurality: boolean | null;
  /** One line describing the first attempted method's outcome (its abstain reason, or its answer
   *  plus basis) -- never the outcome object itself and never the transcript. null exactly when
   *  methodLetter's own null-causing conditions apply AND the attempt did not throw (a thrown
   *  first attempt reports its message in `error` instead, and leaves this null too). */
  methodOutcomeSummary: string | null;
  /** How many times the inert MethodRunContext refused an askGoogle / askConversationalAuthority
   *  call this consult made (across every method actually run, not just the first). */
  contextRefusals: number;
  /** Every emit() line every method actually run wrote this consult, verbatim, in call order,
   *  INCLUDING this file's own refusal-notice lines -- capped at 200 entries; when more than 200
   *  lines were emitted, entries 200.. are replaced by a single final count line rather than
   *  silently dropped. */
  transcript: string[];
  /** Any thrown error (from the first attempted method's run(), from a later attempt only if the
   *  first did not already throw, or from this function's own setup) stringified as
   *  "Name: message" (or String(err) for a non-Error throw). Never rethrown -- this function
   *  always resolves, never rejects. */
  error: string | null;
  /** D-BP223-BM04-Y005-004-SCOPEALL. Every attempted run (up to opts.maxRun eligible, non-null-run
   *  methods), in attempt order -- both scopes share this shape (under 'live', has exactly the
   *  same attempts methodSelected/methodLetter/error already described, default 1). `refused` is
   *  true when that attempt's run() threw (caught here, never rethrown) OR resolved with outcome
   *  text (basis/error) that itself mentions "quarantine" (case-insensitive) -- i.e. "the throw or
   *  the refusal outcome" the ticket asks this call to measure, never invented or assumed when
   *  neither happened. `outcomeSummary`/`error` per entry mirror summarizeOutcome()/the thrown
   *  message for THAT attempt alone (not just the first, unlike the top-level fields above). */
  runs: Array<{
    id: string;
    quarantined: boolean;
    letter: string | null;
    refused: boolean;
    outcomeSummary: string | null;
    error: string | null;
    /** D-BP223-BM04-Y005-007-FENCEMARK. Derived from this entry's own quarantined/refused/scope --
     *  see RunFence's own doc comment. Never 'not-run' here (an entry only exists once an attempt
     *  was actually made). */
    fence: RunFence;
  }>;
  /** D-BP223-BM04-Y005-004-SCOPEALL. Whether the run() that populated `methodSelected` (the FIRST
   *  attempt) was itself a quarantined method's run(), and whether it refused loudly the way
   *  LianaMethod.quarantined's own doc comment (method_registry.ts) says it should ("should ALSO
   *  refuse loudly if called directly") -- true/false only when the first attempt was in fact a
   *  quarantined method (i.e. runs[0].quarantined === true); null when there was no first attempt,
   *  or the first attempt was not quarantined (not applicable -- nothing quarantined was run, so
   *  there is nothing to report a refusal or non-refusal of). Always null under 'live' (a
   *  quarantined method's run() is never reachable there). When true or false and the first
   *  attempt's own text mentions the refusal, that text is what `methodOutcomeSummary` above
   *  carries (see consultRegistryForMcItem's own 'all'-branch comment for exactly when). */
  methodRunRefusedQuarantine: boolean | null;
  /** D-BP223-BM04-Y005-007-FENCEMARK. Mirrors runs[0].quarantined (the attempt that populated
   *  methodSelected) -- null when methodSelected is null (no attempt was made). */
  quarantined: boolean | null;
  /** D-BP223-BM04-Y005-007-FENCEMARK. Mirrors runs[0].fence when an attempt was made; 'not-run'
   *  when methodSelected is null. Always present -- this is the field the arm D finding asked for:
   *  a reader can act on this one field alone without cross-referencing quarantined+refused. */
  fence: RunFence;
  /** D-BP223-BM04-Y005-007-FENCEMARK. Count of `runs[]` entries with fence === 'refused-by-method'. */
  runsQuarantinedRefused: number;
  /** D-BP223-BM04-Y005-007-FENCEMARK. Count of `runs[]` entries with
   *  fence === 'RAN-UNFENCED-UNDER-SCOPE-ALL' -- the loud, on-purpose counter arm D's finding
   *  exists to make visible. Non-zero here means at least one quarantined method ran to completion
   *  under scope 'all' without refusing, on this item, this call. */
  runsQuarantinedUnfenced: number;
}

const TRANSCRIPT_CAP = 200;

/** LETTER(i) = String.fromCharCode(65 + i) -- see this file's header for the exact match to
 *  plow_mc_item_runner.cjs's own closure of the same name. */
function letterFor(i: number): string {
  return String.fromCharCode(65 + i);
}

/** Builds the MethodRunContext a registry-consult run hands to a method's run(). Every field not
 *  set here (ownedPassages, acquisitionId, askConversationalAuthorityAs, ownedConnectors,
 *  ownedSilo) is left undefined, exactly like the pre-existing `{ askGoogle, emit }` construction
 *  sites this file's own ticket points to (method_registry.ts's MethodRunContext interface, every
 *  field past askGoogle/emit/askConversationalAuthority is ADDITIVE/OPTIONAL by that interface's
 *  own doc comments) -- a registry consult run acquires nothing, owns no passage, and belongs to
 *  no acquisition, so leaving those undefined is the honest shape, not an omission. */
function buildInertContext(
  rawTranscript: string[],
  refusalCounter: { count: number },
  emitSink?: (line: string) => void,
): MethodRunContext {
  const emit: EmitFn = (event: LianaTerminalEvent) => {
    rawTranscript.push(event.text);
    if (emitSink) {
      try {
        emitSink(event.text);
      } catch {
        // A caller-supplied sink must never be able to crash a registry consult.
      }
    }
  };

  const askGoogle: AskGoogleFn = async (question: string) => {
    refusalCounter.count += 1;
    emit({
      kind: 'note',
      text: `[registry-consult] askGoogle refused: registry consult runs without external authority (question="${question}")`,
      ts: new Date().toISOString(),
    });
    // BrowserAuthorityRawExtraction shape, deliberately non-empty and explicitly marked -- never
    // `null` (which a real caller could read as "extraction failed, try again") and never an
    // empty-string snippet (which could be misread as a real, if unhelpful, successful scrape).
    return {
      snippet: 'refused: registry consult runs without external authority',
      sourceUrl: null,
      authority: 'user_google' as const,
      selectorUsed: null,
    };
  };

  const askConversationalAuthority: ConversationalAuthorityFn = async (
    question: string,
    _mcOptions?: string[],
  ) => {
    refusalCounter.count += 1;
    emit({
      kind: 'note',
      text: `[registry-consult] askConversationalAuthority refused: registry consult runs without external authority (question="${question}")`,
      ts: new Date().toISOString(),
    });
    // ConversationalAuthorityResult shape. `ok: false` is what every real caller of this field
    // already treats as "no answer, fall back" (survey_stage.ts's own convention, per this
    // interface's own doc comment in method_registry.ts) -- so a refusal reads exactly like the
    // one honest "no answer" signal this interface already has, never like a successful `ok:
    // true` with hollow text.
    return {
      ok: false,
      text: 'refused: registry consult runs without external authority',
      citations: [] as string[],
      via: 'registry-consult-inert',
      authority: 'none',
    };
  };

  return { askGoogle, emit, askConversationalAuthority };
}

/** D-BP223-BM04-Y005-007-FENCEMARK. Derives one attempt's `fence` from its own quarantined/refused
 *  state (see RunFence's own doc comment for what each value means). `scope` is accepted and used
 *  only for the doc-comment-documented case (quarantined && !refused implies scope === 'all',
 *  since 'live' never selects a quarantined method to run in the first place) -- if that
 *  "shouldn't happen" combination is ever seen anyway (quarantined && !refused && scope==='live'),
 *  this still returns the loud value rather than silently calling it 'not-quarantined', because an
 *  unfenced quarantined run is the one thing this dispatch exists to never let read as clean. */
function computeFence(quarantined: boolean, refused: boolean, scope: 'live' | 'all'): RunFence {
  if (!quarantined) return 'not-quarantined';
  if (refused) return 'refused-by-method';
  void scope; // documented above: this branch is scope 'all' by construction; kept loud either way
  return 'RAN-UNFENCED-UNDER-SCOPE-ALL';
}

/** One line summarizing a method's outcome -- abstain reason or answer, never the transcript. */
function summarizeOutcome(outcome: LianaTerminalOutcome): string | null {
  if (outcome.abstain) {
    return `abstain: ${outcome.basis ?? outcome.error ?? 'no reason recorded on the outcome'}`;
  }
  const verdictPart = outcome.verdict ?? 'null';
  return outcome.basis ? `answer: ${verdictPart} (${outcome.basis})` : `answer: ${verdictPart}`;
}

/** THE ENTRY POINT. See this file's header for the full ruling, scope discipline, and demand
 *  decision this implements. Always resolves (never rejects) a plain JSON-safe record -- any
 *  thrown error anywhere in this function's own body is caught and reported in `error`, never
 *  rethrown. Performs no disk I/O, no network I/O, and reads no environment variable; the only
 *  I/O-shaped calls a run() might attempt (askGoogle / askConversationalAuthority) are refused
 *  in-process by the inert context built here -- see buildInertContext(). */
export async function consultRegistryForMcItem(
  item: RegistryConsultItem,
  opts: RegistryConsultOpts = {},
): Promise<RegistryConsultResult> {
  // D-BP223-BM04-Y005-004-SCOPEALL. Default 'live' -- omitting opts.scope entirely is identical to
  // passing 'live' explicitly, both byte-identical to the pre-SCOPEALL behavior below.
  const scope: 'live' | 'all' = opts.scope ?? 'live';
  const rawTranscript: string[] = [];
  const refusalCounter = { count: 0 };
  let methodsConsulted = 0;
  let eligibleOut: Array<{ id: string; reason: string; quarantined: boolean }> = [];
  let methodSelected: string | null = null;
  let methodLetter: string | null = null;
  let methodOutcomeSummary: string | null = null;
  let error: string | null = null;
  const runsOut: RegistryConsultResult['runs'] = [];
  let methodRunRefusedQuarantine: boolean | null = null;

  try {
    const optionsRecord: Record<string, string> = {};
    item.options.forEach((text, i) => {
      optionsRecord[letterFor(i)] = text;
    });

    const input: MethodQuestionInput = {
      qid: item.qid,
      question: item.question,
      options: optionsRecord,
      correctAnswer: item.correctAnswer,
      category: item.category,
    };

    // THE DEMAND DECISION -- see this file's header. Passed through unchanged; this file never
    // computes, guesses, or invents one. Same convention, both scopes.
    const demand = opts.demand;
    const demandGated = demand !== undefined;

    let eligiblePairs: Array<{ method: LianaMethod; reason: string; quarantined: boolean }>;

    if (scope === 'live') {
      // THE ONE AND ONLY ELIGIBILITY DECISION for 'live' -- delegated entirely to
      // method_registry.ts, UNCHANGED by SCOPEALL. Telemetry-only denominator -- see
      // RegistryConsultResult.methodsConsulted's own doc comment above for why this is a tally,
      // not a re-decision.
      methodsConsulted = listMethods().filter((m) => {
        if (m.quarantined) return false;
        if (demandGated && m.demand !== demand) return false;
        return true;
      }).length;
      const eligible = selectEligibleMethods(input, demand);
      eligiblePairs = eligible.map((e) => ({
        method: e.method,
        reason: e.shape.reason,
        quarantined: false, // selectEligibleMethods() never returns a quarantined method
      }));
    } else {
      // 'all' -- D-BP223-BM04-Y005-004-SCOPEALL, SHADOW measurement only. Walks listMethods()
      // directly; selectEligibleMethods() and method_registry.ts's own quarantine gate are never
      // called or touched on this path. Same demand rule as 'live' (demandGated above), but
      // shapeTest() runs on EVERY registered method INCLUDING quarantined ones -- quarantine state
      // is recorded per entry for reporting only, never used to skip shapeTest() or to exclude a
      // match from `eligible`.
      const all = listMethods();
      methodsConsulted = all.filter((m) => (demandGated ? m.demand === demand : true)).length;
      eligiblePairs = [];
      for (const method of all) {
        if (demandGated && method.demand !== demand) continue;
        const shape = method.shapeTest(input);
        if (shape.matches) {
          eligiblePairs.push({ method, reason: shape.reason, quarantined: !!method.quarantined });
        }
      }
    }

    eligibleOut = eligiblePairs.map((e) => ({
      id: e.method.id,
      reason: e.reason,
      quarantined: e.quarantined,
    }));

    const maxRun = opts.maxRun ?? 1;
    const ctx = buildInertContext(rawTranscript, refusalCounter, opts.emitSink);

    let attempts = 0;
    for (const { method, quarantined } of eligiblePairs) {
      if (attempts >= maxRun) break;
      if (method.run === null) continue;
      attempts += 1;
      const isFirstAttempt = methodSelected === null;
      if (isFirstAttempt) methodSelected = method.id;

      let attemptLetter: string | null = null;
      let attemptSummary: string | null = null;
      let attemptError: string | null = null;
      let attemptRefused = false;

      try {
        const outcome = await method.run(input, ctx);
        attemptLetter = outcome.verdict ?? null;
        attemptSummary = summarizeOutcome(outcome);
        // "the throw or the refusal outcome" (ticket, quoting LianaMethod.quarantined's own doc
        // comment: a quarantined method's run() "should ALSO refuse loudly if called directly").
        // Measured, never assumed: a resolved (non-throwing) outcome counts as a refusal only when
        // its own text says so -- see this dispatch's report for how many of the 17 currently-
        // quarantined method files actually implement that documented defense-in-depth.
        if (quarantined) {
          const haystack = `${outcome.basis ?? ''} ${outcome.error ?? ''}`.toLowerCase();
          attemptRefused = haystack.includes('quarantine');
        }
      } catch (runErr) {
        const msg = runErr instanceof Error ? `${runErr.name}: ${runErr.message}` : String(runErr);
        attemptError = msg;
        if (quarantined) attemptRefused = true; // a thrown refusal IS "the throw" this measures
        if (isFirstAttempt) {
          error = msg;
        } else if (error === null) {
          error = msg;
        }
      }

      runsOut.push({
        id: method.id,
        quarantined,
        letter: attemptLetter,
        refused: attemptRefused,
        outcomeSummary: attemptSummary,
        error: attemptError,
        fence: computeFence(quarantined, attemptRefused, scope),
      });
    }

    if (scope === 'live') {
      // UNCHANGED by SCOPEALL: top-level methodLetter/methodOutcomeSummary describe the FIRST
      // attempt only, exactly as before (byte-identical) -- runsOut[0] carries precisely what the
      // old inline first-attempt tracking used to.
      if (runsOut.length > 0) {
        methodLetter = runsOut[0].letter;
        methodOutcomeSummary = runsOut[0].outcomeSummary;
      }
    } else {
      // 'all' (SCOPEALL): methodLetter = the first NON-NULL letter across `runs` (up to maxRun
      // attempts), or null if every attempt abstained, threw, or was a stub. methodSelected/error
      // still describe the FIRST attempt (unchanged convention) -- `runs` carries every attempt's
      // own letter/outcome/error individually regardless of which one this summary field surfaces.
      const firstNonNullLetter = runsOut.find((r) => r.letter !== null);
      methodLetter = firstNonNullLetter ? firstNonNullLetter.letter : null;
      if (runsOut.length > 0) {
        methodOutcomeSummary = runsOut[0].outcomeSummary;
      }
      // methodRunRefusedQuarantine + the refusal text in methodOutcomeSummary -- ONLY when the
      // FIRST attempt (the one methodSelected names) was itself quarantined; not applicable (null)
      // otherwise, including when a LATER attempt happened to be quarantined (that attempt's own
      // `refused`/`error`/`outcomeSummary` are still fully recorded in `runs`, just not promoted to
      // this top-level field, matching methodSelected's own "first attempt" convention).
      if (runsOut.length > 0 && runsOut[0].quarantined) {
        methodRunRefusedQuarantine = runsOut[0].refused;
        if (runsOut[0].refused) {
          methodOutcomeSummary = runsOut[0].error !== null
            ? `refused (threw): ${runsOut[0].error}`
            : `refused: ${runsOut[0].outcomeSummary}`;
        }
      }
    }
  } catch (outerErr) {
    error = outerErr instanceof Error ? `${outerErr.name}: ${outerErr.message}` : String(outerErr);
  }

  const pluralityLetter = opts.pluralityLetter ?? null;
  const methodAgreedWithPlurality =
    methodLetter !== null && pluralityLetter !== null ? methodLetter === pluralityLetter : null;

  let transcript: string[];
  if (rawTranscript.length > TRANSCRIPT_CAP) {
    transcript = rawTranscript.slice(0, TRANSCRIPT_CAP - 1);
    transcript.push(
      `... capped at ${TRANSCRIPT_CAP} lines -- ${rawTranscript.length} total emitted this consult`,
    );
  } else {
    transcript = rawTranscript.slice();
  }

  const eligibleQuarantined = eligibleOut.filter((e) => e.quarantined).length;
  const eligibleLive = eligibleOut.length - eligibleQuarantined;

  // D-BP223-BM04-Y005-007-FENCEMARK. Top-level mirror: runsOut[0] is the attempt that populated
  // methodSelected (the FIRST attempt), same convention methodLetter/methodOutcomeSummary already
  // use above -- 'not-run' + null only when no attempt was made at all (runsOut is empty).
  const quarantinedOut: boolean | null = runsOut.length > 0 ? runsOut[0].quarantined : null;
  const fenceOut: RunFence = runsOut.length > 0 ? runsOut[0].fence : 'not-run';
  const runsQuarantinedRefused = runsOut.filter((r) => r.fence === 'refused-by-method').length;
  const runsQuarantinedUnfenced = runsOut.filter(
    (r) => r.fence === 'RAN-UNFENCED-UNDER-SCOPE-ALL',
  ).length;

  return {
    scope,
    methodsConsulted,
    eligible: eligibleOut,
    eligibleQuarantined,
    eligibleLive,
    methodSelected,
    methodLetter,
    methodAgreedWithPlurality,
    methodOutcomeSummary,
    contextRefusals: refusalCounter.count,
    transcript,
    error,
    runs: runsOut,
    methodRunRefusedQuarantine,
    quarantined: quarantinedOut,
    fence: fenceOut,
    runsQuarantinedRefused,
    runsQuarantinedUnfenced,
  };
}
