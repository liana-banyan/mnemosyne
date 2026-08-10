// survey_stage.ts -- THE SURVEY STAGE (E-SURVEY) -- D-BP151-025/BISHOP/seg-survey-the-lieutenant
//
// SURVEY IS THE LIEUTENANT. Founder, BP151, verbatim, the order that governs this whole file:
// "the Sergeant directs the Privates with the machetes to very efficiently chop a path through
// the jungle. the Lieutenant tells them WHAT JUNGLE and in WHAT DIRECTION, because the best
// highway constructed in the wrong jungle in the wrong jungle is worse than useless." Everything
// already built (comparative_cascade.ts, definitional_cascade.ts) is the Sergeant. This file is
// the Lieutenant: it PROPOSES what the question is about and which way to go. IT NEVER ANSWERS
// THE QUESTION, and it is never itself an elimination stage.
//
// SCOPE, EXACTLY: `BISHOP_DROPZONE\THE_FOUNDERS_PROCESS_ORDERED_BP151.md` names five Founder
// steps with no execution point anywhere in the live code. Step 11 (THE TERMINATOR) is OUT OF
// SCOPE -- ruled on separately this session, owned by D-BP151-024; NOTHING in that file is read,
// imported, or touched here. This file builds ONLY steps 2, 3, 4 and 6, in his order:
//
//   STEP 2 (SURVEY) -- Founder, Excerpt 7, BP141: "If I look up the definition of bias in
//     google, perfunctorily, I get this... That doesn't answer my question, it's just a fact to
//     eblet for component factor foundation for reasoning. So keeping those definitions in mind,
//     but not bound by them."
//   STEP 3 (CATEGORIZE) -- Founder, Excerpt 7, BP141, rule 12: "Well, first, I categorize the
//     possible answers. I note that A, B, sorta C but more to that, D, E same as C... F, H is
//     like C and E, I, and J all have to do with what answer it results in. G does not."
//   STEP 4 (DETERMINE THE REGISTER) -- Founder, Excerpt 7, BP141, rule 13: "So I need to define
//     what CONTEXT the question is being asked in. I would guess from 'sample' being used in
//     A, B, C, D, E, H, I questions... then it has to do with statistics. How do I know that? I
//     don't, I'm guessing. So I'll check:" -- then he ran "what is bias in statistics". THE
//     VERIFICATION IS NOT OPTIONAL: an unverified guess is never acted on, per his own words.
//   STEP 6 (THE JAR METHOD) -- Founder, Excerpt 2, BP141, rule 2: "Note that we got rid of four
//     answers with one google search - I like to call this the Jar Method... First we take out
//     the Softballs, because we KNOW they are not the answer." He removed options a SOURCE NAMED
//     EXPLICITLY -- not options a regex matched.
//
// EVERY OTHER FOUNDER STEP (1, 5, 7-18) IS UNTOUCHED. This file does not build the register gate,
// the inverse, order-both-ways, Cake Cut Half, re-inclusion, the hard number, or the terminator.
// It does not change comparative_cascade.ts, definitional_cascade.ts, or stepped_audible.ts --
// none of those three files is imported, read for editing, or modified by this ticket.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// D-BP151-025 AMENDMENT -- TWO FORKS RULED ON, STEPS 3 AND 6 NOW COMPLETE.
//
// The first pass of this ticket stopped at two forks rather than pick a number or invent a rule.
// The Founder ruled on both directly; this amendment builds exactly what he ordered, no more:
//
//   STEP 3's GROUPING. Founder, BP151, verbatim: "Grouping requires a model call - like ALL
//     judgements, and yes, relaxed for this one purpose." HARDWIRE-22 ("Gemma extracts, never
//     judges") is relaxed ONLY for the single model call inside groupOptionsByPredicate() below --
//     nowhere else in this file, nowhere else in this estate. See that function's own ATTRIBUTED
//     comment at its call site.
//
//   STEP 6's ELIMINATION. Founder, BP151, verbatim: "certainty is derived from my mechanical
//     processes, not from any model's 'certainty'." Confirmed reading: polarity comes from WHICH
//     QUESTION WAS ASKED (the direction is fixed the moment a query goes out), never from
//     classifying a sentence with a word list. See founderStep6JarMethod()'s own ATTRIBUTED
//     comment. NO vocabulary threshold was built for step 3 (he chose the model call over it,
//     explicitly); NO word-list polarity classifier was built for step 6 (HIGH_WORDS/LOW_WORDS
//     remains a named tare, not reproduced here); step 6 still issues no Google query of its own
//     (confirmed correct as built -- "we got rid of four answers with ONE google search", never a
//     second search).
// ─────────────────────────────────────────────────────────────────────────────────────────────
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// D-BP151-031 AMENDMENT -- STEP 2's NO-TERM PATH: ASK THE SOURCE WHICH TERMS ARE AMBIGUOUS.
//
// MEASURED FAILURE THIS CLOSES. Live run LIANA_RUN_qid98_2026-08-09T22-37-19-658Z.json (qid 98,
// "Which of the following world regions is NOT considered one of the world's most densely
// populated regions?"): findAskCatalyst() correctly found no quoted or cued term (transcript line
// 75, verbatim: "SURVEY STEP 2: no term, not run"), so step 2 refused, so DEMAND came back
// UNKNOWN, so no method could run and the whole question abstained with `error: "demand_unknown"`.
// Refusing was correct -- there was nothing to extract a term FROM. But refusing was also the only
// option available, because nothing offered step 2 another way to find a term.
//
// THE FOUNDER'S FIX, run by hand, worked first try: instead of extracting a term from the question,
// ASK THE SOURCE which words or phrases in the question could be understood with a different
// meaning that would change what is being asked. His own qid-98 walkthrough named "regions",
// "densely populated" (the exact ambiguity that produces the wrong South America figure -- total
// population vs. true density) and "NOT" (a negation the Liana Cycle never previously tracked
// anywhere) -- each with a standard meaning, an alternative meaning, and the impact of the
// alternative, IN THE SOURCE'S OWN WORDS.
//
// WHAT WAS BUILT: askAmbiguityViaModel() (below) issues his query, verbatim, templated only with
// the question text (HARDWIRE-23 Law 4, ATTRIBUTED at its own call site). It runs ONLY when
// findAskCatalyst() found nothing -- the existing quoted/cued path is untouched, additive only.
// THE SOURCE NAMES THE TERMS; founderStep2Survey() SURVEYS EVERY ONE OF THEM, in the order the
// source returned them -- no ranking or picking rule was invented (the Founder's own order allowed
// either "all named terms" or "source order"; this ticket chose both at once, since they coincide
// when nothing is dropped). If the ambiguity query itself returns nothing usable, step 2 still
// refuses exactly as before -- refusing beats guessing, unchanged.
//
// THE NEGATION FLAG. Nothing in the Liana Cycle previously registered that an ASK is itself
// negated (Step 6's inverse-query direction is a caller-declared fact about a QUERY, never a fact
// about the original ASK). `AmbiguityTermFinding.isNegation` is asked OF THE MODEL, per named
// term ("does this term function as a negation/exclusion/restriction word whose presence or
// absence would flip which option is correct") -- never checked here against a hardcoded word list
// (a word list here would be exactly the kind of tare HARDWIRE-23 forbids). `negationNamed` on
// FounderStep2Result, and `askNegated` on the top-level SurveyStageResult, are true only when the
// SOURCE flagged a term this way.
//
// WIRED TO DEMAND, D-BP151-032. The above ("NOT WIRED TO DEMAND") was true for D-BP151-031 and is
// NOT true anymore. `ambiguityNested` (this field, below) is now consumed by demand_test.ts's new
// `determineDemandFromAmbiguityNested()` -- an ADAPTER that calls the existing
// `determineDemandFromSurveyedAsk()` once per source-named term and never writes a second demand
// derivation (see that function's own header, demand_test.ts, for exactly what "adapt" means and
// the one case it refuses to resolve on its own). liana_terminal_engine.ts's demand ternary now
// reads: `nested` -> determineDemandFromSurveyedAsk(nested); else `ambiguityNested.length` ->
// determineDemandFromAmbiguityNested(ambiguityNested); else demand unknown. This file itself is
// UNCHANGED by that wiring -- `ambiguityNested`'s shape was already exactly what the adapter
// needed; nothing here was restructured for it.
// ─────────────────────────────────────────────────────────────────────────────────────────────
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// D-BP151-032 AMENDMENT -- GOOGLE IS THE DEFAULT TRANSPORT FOR THE AMBIGUITY QUERY, NOT GEMMA.
//
// ATTRIBUTED: Founder, BP151, verbatim, relayed as an addition to this ticket: "I want to always
// run it on google, which should be the default that can be changed in Mnemosynec at will."
//
// `askAmbiguityViaModel()` (D-BP151-031) is renamed `askAmbiguity()` and now takes a `transport`
// argument ('google' | 'gemma'). GOOGLE IS THE DEFAULT. The local model (the entire D-BP151-031
// implementation, prompt and reasoning UNCHANGED) is the selectable deviation, resolved by
// liana_terminal_engine.ts's `resolveAmbiguityQueryTransport()` -- same param+env-var `isXEnabled`
// shape as `isContingencyOperatorSurveySpliceEnabled()`, polarity NOT flipped this time (Google
// default matches the convention's usual "undefined = the shipped behavior" direction).
//
// WHY THIS DOES NOT RE-OPEN THE HARDWIRE-22 QUESTION D-BP151-031 ALREADY SETTLED. That ticket's
// own header explains why gemmaExtract() could not answer the ambiguity query: there was no
// PASSAGE, only the bare question, and asking a model to reason about a question with nothing to
// extract from is exactly the judgment gemmaExtract()'s "report only what it states" wrapper was
// measured to suppress -- so D-BP151-031 had the local model reason directly, a named, disclosed
// relaxation (this file's HARDWIRE-23 section, item 3, below). Google changes what gets handed to
// Gemma: `askGoogle(query)` returns a REAL passage (the Founder measured this himself, running the
// query on Google by hand -- three named terms with standard meaning, alternative meaning, impact,
// AND A CITATION, narrower on the local model's live run per D-BP151-031's own test 1f). Extracting
// the same `{term, standardMeaning, alternativeMeaning, impact, isNegation}` shape OUT OF a real
// Google passage is ordinary extraction -- `gemmaExtract()` answers it UNRELAXED, the same as every
// other Survey element that reads a Google passage (elements/survey_ask.ts, elements/field_gate.ts,
// methods/comparative_cascade.ts). The `transport === 'gemma'` branch below is untouched from
// D-BP151-031 -- same prompt, same reasoning, still the one named relaxation this file already
// disclosed; selectable, not removed.
//
// IF GOOGLE IS UNREACHABLE, THIS REFUSES -- it does NOT silently fall back to the local model.
// ATTRIBUTED (Founder, relayed BP151 addendum): a silent transport swap would make two runs
// incomparable with no visible signal, "the same defect class as the two eblet_index.jsonl files."
// A fallback, if ever wanted, is a Founder decision this function may not invent.
//
// CITATIONS. `googleBlocks()`'s own `sources` (URLs Google returned alongside its answer) are kept
// on `AmbiguityQueryResult.citations`, unscored -- "do not build BM scoring here; just do not throw
// the source away" (Founder, relayed BP151 addendum). No Treasury-of-Sources/BM wiring is added by
// this ticket.
// ─────────────────────────────────────────────────────────────────────────────────────────────
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// D-BP151-035 AMENDMENT -- SURVEY ASKS A CONSTRAINT QUESTION PER SOURCE-NAMED TERM. IT NEVER
// APPLIES ONE. Founder, BP151, ratified: "Yes agreed. Survey asks those, Cascade is still
// essential."
//
// WHAT PROMPTED THIS. The Founder, from his own logged-in browser, asked Google the smallest set
// of questions that would tell him HOW to determine qid 98's answer -- never the answer itself.
// Google returned exactly two question forms:
//   1. "What specific definition and scale of 'world region' is this question using?" -- because
//      the choices mix vastly different geographic scales.
//   2. "What is the specific population density threshold (people per square kilometer) used to
//      qualify as 'one of the world's most densely populated'?" -- because population density is
//      relative and needs a firm baseline.
// These replace what `register_gate.mjs`'s FEATURE_WORDS/REGION_WORDS word lists and the removed
// 1.5x separation threshold (`FD-BP151-13`) were standing in for -- an ASKED scale/threshold
// instead of a hardcoded or invented one. See `REGISTER_GATE_AUDIT_BP151.md` (12 of 15 rules in
// that gate are unattributed TAREs) and `HARDWIRE-23_THE_TARE_RULE.md`.
//
// THE LINE THIS AMENDMENT DOES NOT CROSS. Google itself offered to "apply these two baseline rules
// to the list of choices now." Survey does not do that here, and never will: `askConstraint()`
// below stores a constraint (term, question, answer, source); it does not judge the answer, does
// not eliminate an option with it, does not rank anything. Applying a constraint is the cascade's
// job, per the Founder's own ratification of this ticket ("Cascade is still essential") --
// `comparative_cascade.ts`, `stepped_audible.ts`, and `register_gate.mjs` are untouched.
//
// WHAT WAS BUILT, AND THE FORK STOPPED ON INSTEAD OF INVENTING PAST IT. `askConstraint()` (below)
// builds ONLY Google's form-1 question, templated with pure term substitution and nothing else:
// "What specific definition and scale of '{term}' is this question using?" -- issued once per term
// the ambiguity query named, inside `founderStep2Survey()`'s existing per-term loop. Form 2 could
// not be templated the same way: "population density" and "(people per square kilometer)" are not
// present in a named term's own text, so producing them for an arbitrary term would require either
// inventing domain-specific phrasing this file has no authorized source for, or inventing a
// selection rule for WHICH named terms even warrant a threshold-style question -- exactly the
// FEATURE_WORDS/REGION_WORDS shape `REGISTER_GATE_AUDIT_BP151.md` already found and named a tare.
// Per this ticket's own instruction ("if templating requires inventing phrasing beyond substituting
// the term, STOP AND REPORT THE FORK... do not invent a question and proceed"), form 2 is reported
// as a stopped fork, not built -- see `askConstraint()`'s own header for the exact reduced wording
// this function would send if the Founder authorizes it, and this ticket's own SEG return for the
// question put to him.
//
// TRANSPORT IS REUSED, NOT RE-RESOLVED. `askConstraint()` takes the SAME already-resolved
// `'google' | 'gemma'` value `askAmbiguity()` was called with (`liana_terminal_engine.ts`'s
// `resolveAmbiguityQueryTransport()`, threaded through unchanged) -- no second transport resolver
// was added. Google unreachable refuses, exactly as `askAmbiguity()` already does; no silent
// fallback to the local model.
// ─────────────────────────────────────────────────────────────────────────────────────────────
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// WIRE IT, DO NOT REWRITE IT. Every phase below composes an EXISTING element. Nothing in this
// file re-implements a classifier, a query template, or an elimination rule another file already
// owns. The tare sweep (`TARE_SWEEP_BP151.md`) found the following already built and simply not
// called from anywhere live; this file is their first live caller for the ones marked (WIRED
// HERE, FIRST LIVE CALLER):
//
//   STEP 2 -> surveyAskNested() (elements/survey_ask.ts) -- ALREADY LIVE (definitional_cascade.ts
//             calls the bare surveyAsk() form). The NESTED form (surveyAskNested), and therefore
//             buildNest()/findFrame() (elements/nest.ts), were dead code before this file --
//             WIRED HERE, FIRST LIVE CALLER for elements/nest.ts.
//   STEP 3 -> surveyAnswers() (elements/survey_answers.ts) -- DEAD CODE before this file, nothing
//             imported it. WIRED HERE, FIRST LIVE CALLER. It already does exactly what step 3
//             needs as RAW MATERIAL (per-option KIND via checkKind(), ASPECT via tagAspect(),
//             and each option's own discriminating CATALYST WORDS via findCatalystWords(), each
//             surveyed in turn) -- which also makes this file the first live caller of
//             elements/kind_check.ts (checkKind/checkKindForAllOptions were dead: only reachable
//             through survey_answers.ts itself and the dead half of substitution_search.ts). The
//             actual GROUPING act (D-BP151-025 amendment) calls the SAME local Ollama instance
//             and model comparative_cascade.ts's gemmaExtract() already talks to, via a NEW
//             minimal function (groupViaModel(), this file) -- not gemmaExtract() itself, because
//             its own prompt wrapper ("report only what it states... never guess") was MEASURED
//             this ticket to suppress the judgment this one call is now ordered to make. See
//             groupViaModel()'s and groupOptionsByPredicate()'s own comments for the measurement
//             and the exact ATTRIBUTED ruling.
//   STEP 4 -> fieldGate() (elements/field_gate.ts) -- ALREADY LIVE (definitional_cascade.ts's
//             D1.5 already calls it). Reused here unmodified, as a general pre-method Survey
//             capability rather than one method's private stage.
//   STEP 6 -> extractAssertedMentions() (methods/comparative_cascade.ts, already exported and
//             already used by comparative_cascade.ts's own STAGE 1/STAGE 2) -- reused for its
//             EXTRACTION-AND-VERIFICATION half (HARDWIRE-22 unmodified: copy the sentence, verify
//             it appears verbatim, verify it is an assertion). The elimination decision (D-BP151-
//             025 amendment) is mechanical, driven by the CALLER-DECLARED direction of the query
//             that produced each source block, never a word list -- HIGH_WORDS/LOW_WORDS remains
//             a named tare, not reproduced here. See founderStep6JarMethod()'s own ATTRIBUTED
//             comment.
//   ALSO WIRED: findAskCatalyst() (elements/catalyst_words.ts) -- DEAD before this file (only
//             substitution_search.ts, itself dead, called it). WIRED HERE, FIRST LIVE CALLER, to
//             derive the term steps 2 and 4 need from the raw question text.
//   STEP 2's NO-TERM PATH (D-BP151-031, transport default changed D-BP151-032) -> askAmbiguity()
//             (this file, below; renamed from askAmbiguityViaModel() -- D-BP151-032, the name went
//             wrong the moment Google became the default transport). GOOGLE (askGoogle, the SAME
//             channel every other Survey element already uses) is the default source;
//             gemmaExtract() (unrelaxed) structures what Google said. The LOCAL model reasoning
//             directly (D-BP151-031's original implementation) is the selectable alternative, same
//             reasoning as groupViaModel() (step 3): there is no passage to extract from on THAT
//             path, so gemmaExtract()'s extraction-only wrapper would suppress the answer the same
//             way it was measured to for step 3's grouping call. See askAmbiguity()'s own
//             ATTRIBUTED comment for both transports and the file header's D-BP151-032 section
//             above for why Google-as-source does not reopen the HARDWIRE-22 question.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// HARDWIRE-23 (THE TARE RULE) -- HOW THIS FILE STAYS CLEAN.
//
// This file introduces exactly SIX decision/relaxation/routing rules of its own (D-BP152-005 adds
// the sixth to the five D-BP151-025/031/032/035 introduced), and all six are ATTRIBUTED at their
// own call site, per Law 4 -- no other decision rule (threshold, cutoff, ratio, tie-break, word
// list) exists anywhere in this file:
//   1. groupOptionsByPredicate()'s model call (step 3) -- HARDWIRE-22 relaxed, Founder-ordered,
//      scoped to this one call only.
//   2. founderStep6JarMethod()'s direction-driven elimination (step 6) -- mechanical, driven by a
//      caller-declared query direction, never a word list or a model judgment.
//   3. askAmbiguity()'s `transport === 'gemma'` branch (step 2's no-term path, D-BP151-031) --
//      HARDWIRE-22 relaxed a second time, Founder-ordered, scoped to this one call only. It PICKS
//      NOTHING: the source names candidate ambiguous terms and, per term, whether it is a
//      negation -- this function reports every one of them, unranked; founderStep2Survey() surveys
//      all of them, inventing no selection rule among them.
//   4. askAmbiguity()'s transport default (D-BP151-032) -- Google unless the caller (ultimately
//      liana_terminal_engine.ts's resolveAmbiguityQueryTransport()) selects 'gemma', ATTRIBUTED:
//      Founder, relayed BP151 addendum, "I want to always run it on google, which should be the
//      default that can be changed in Mnemosynec at will." Unreachable Google refuses; it never
//      silently substitutes the other transport (that would itself be an unattributed tare).
//   5. askConstraint()'s `transport === 'gemma'` branch (D-BP151-035) -- HARDWIRE-22 relaxed a
//      third time, scoped to this one call only, same shape as rule 3. It reuses rule 4's already-
//      resolved transport value rather than adding a second resolver. ATTRIBUTED: Founder, BP151,
//      ratified this ticket, "Yes agreed. Survey asks those, Cascade is still essential." Builds
//      ONLY Google's form-1 question (definition/scale), pure term substitution, nothing invented;
//      form 2 (threshold) is a stopped fork, not a rule -- see this file header's D-BP151-035
//      section and askConstraint()'s own comment for the exact wording not sent.
//   6. askOperation()'s `transport === 'gemma'` branch (step 2's no-term path, Part 2 of the
//      opening query, D-BP152-005) -- HARDWIRE-22 relaxed a fourth time, scoped to this one call
//      only, same shape as rules 3 and 5. It reuses rule 4's already-resolved transport value.
//      ATTRIBUTED: Founder, BP152, verbatim (`FD-BP152-05`): "And then what operation does this
//      question require in order to answer it: does it want things ranked, defined, classified, or
//      inferred from evidence?" This function PICKS NOTHING: it reports the source's raw stated
//      answer, uninterpreted -- mapping it onto a LianaDemand happens in demand_test.ts, not here.
// Every OTHER phase still either (a) delegates entirely to an existing element and reports its
// result unmodified, or (b) reports raw, unranked facts with no decision made here.
//
// SURVEY STILL NEVER ANSWERS THE QUESTION. Step 6 now narrows the OPTION pool (ordered, see
// above) -- that is a POOL NARROWING, not picking a final verdict letter; `neverAnswersTheQuestion`
// on the orchestrator's own result stays true and no function in this file ever sets a
// `verdict`/`answer`/`correct` field. Where an existing wired element (fieldGate) narrows a FIELD,
// that narrowing is its own, already-disclosed behavior (E-FIELD-GATE's STEP 2/4, field_gate.ts).

import type { MethodRunContext, EmitFn } from './method_registry';
import { surveyAskNested, type SurveyAskNestedResult } from './elements/survey_ask';
import { surveyAnswers, type SurveyAnswersResult } from './elements/survey_answers';
import { fieldGate, type FieldGateResult } from './elements/field_gate';
import { findAskCatalyst } from './elements/catalyst_words';
import { extractAssertedMentions, gemmaExtract, googleBlocks, type AssertedMention, type GoogleBlock } from './methods/comparative_cascade';
// D-BP152-008. Every literal Google query string this file sends (askAmbiguity()'s askedText,
// askOperation()'s askedText, askConstraint()'s question) now lives in
// resources/liana_survey_queries.json, re-read fresh on every call -- see query_text_loader.ts's
// own header for the full ruling and why it does not import 'electron'.
import { getQueryText } from './query_text_loader';

function nowIso(): string {
  return new Date().toISOString();
}

/** methods/comparative_cascade.ts declares its Ollama endpoint/model as MODULE-PRIVATE constants
 *  (`OLLAMA_API_BASE`, `MODEL` -- not exported, so this file cannot import them). Read here with
 *  the IDENTICAL env-var names and defaults, so the SAME local Ollama instance and the SAME model
 *  answer every call in this file that talks to it directly -- gemmaExtract()'s own calls (via
 *  survey_ask.ts/survey_answers.ts/comparative_cascade.ts, AND, D-BP151-032, askAmbiguity()'s
 *  'google' branch, which structures Google's passage through the SAME gemmaExtract()), step 3's
 *  groupViaModel(), AND step 2's askAmbiguity() 'gemma' branch (D-BP151-031) -- a config
 *  convention, not a second system. See groupViaModel()'s and askAmbiguity()'s own headers for why
 *  each RELAXED CALL ITSELF cannot reuse gemmaExtract(). */
const OLLAMA_API_BASE = process.env.OLLAMA_API_BASE ?? 'http://127.0.0.1:11434';
const GROUPING_MODEL = process.env.CASCADE_MODEL ?? 'gemma4:12b';

// ─────────────────────────────────────────────────────────────────────────────────────────────
// STEP 2 -- SURVEY: enumerate denotations of the ASK's own term, perfunctorily, then keep looking.
// ─────────────────────────────────────────────────────────────────────────────────────────────

/** D-BP151-031. One term the SOURCE named as potentially ambiguous, in answer to the Founder's
 *  own query (askAmbiguity()'s own ATTRIBUTED comment) -- every field copied from the
 *  source's response, never summarized. `isNegation` is likewise ASKED OF THE SOURCE per term,
 *  never checked here against a hardcoded word list (HARDWIRE-23 -- a word list here would be
 *  exactly the tare this file's own rule forbids). */
export interface AmbiguityTermFinding {
  term: string;
  standardMeaning: string;
  alternativeMeaning: string;
  impact: string;
  isNegation: boolean;
}

/** D-BP151-031, extended D-BP151-032. The full result of issuing the Founder's ambiguity query
 *  once. `terms` is deliberately UNRANKED -- see askAmbiguity()'s own header for why nothing here
 *  picks one. */
export interface AmbiguityQueryResult {
  /** The Founder's own query text actually sent (verbatim; see askAmbiguity()). */
  askedText: string;
  terms: AmbiguityTermFinding[];
  /** True exactly when the query itself produced nothing (transport unreachable/failed/
   *  unparseable) -- distinguishes "no live source, not run" from "source ran and named nothing".
   *  Name kept from D-BP151-031 (was 'local model'-specific then); now covers either transport,
   *  see `transport` below for which one actually answered. */
  modelUnreachable: boolean;
  /** D-BP151-032. Which transport actually answered THIS call -- 'google' (the Founder-ordered
   *  default) or 'gemma' (the selectable local alternative). Law 5 (HARDWIRE-23): the receipt
   *  must name which transport produced the finding. */
  transport: 'google' | 'gemma';
  /** D-BP151-032. Source URL(s) `googleBlocks()` returned alongside its answer (its own `sources`
   *  field, unmodified), kept so a later ticket can feed the Treasury of Sources / source-BM
   *  scoring -- this ticket does not score them ("do not build BM scoring here; just do not throw
   *  the source away", Founder, relayed BP151 addendum). Always empty on the 'gemma' transport (no
   *  web source exists on that path). */
  citations: string[];
  /** D-BP152-004, INSTRUMENT ONLY: the raw Google passage (`googleBlocks()`'s own `text`,
   *  unmodified) this call was built from -- populated only when transport === 'google' AND
   *  Google answered; empty string on the 'gemma' transport (no Google passage exists on that
   *  path) or when Google itself was unreachable. Persisted so a discard is diagnosable after the
   *  fact instead of only reportable by hand off a live terminal -- D-BP152-003's central finding
   *  was that this text previously existed nowhere once this function returned. Never used to
   *  change which answer is accepted or rejected; diagnostic only. */
  rawGooglePassage: string;
  /** D-BP152-004, INSTRUMENT ONLY: the model's raw pre-JSON-parse text, captured ONLY when
   *  `gemmaExtract()` (comparative_cascade.ts) failed to parse its own output as JSON
   *  (D-BP152-003's Predicate A) -- null whenever extraction succeeded, was never attempted, or
   *  ran on the 'gemma' transport (which does not call `gemmaExtract()`). Never used to change
   *  which answer is accepted or rejected; diagnostic only. */
  rawModelOutput: string | null;
  why: string;
}

export interface FounderStep2Result {
  term: string | null;
  /** Present only when `term` was derived -- surveyAskNested()'s own result (elements/
   *  survey_ask.ts), UNMODIFIED. Consumed directly by determineDemandFromSurveyedAsk()
   *  (demand_test.ts) at liana_terminal_engine.ts's call site (D-BP151-032 wires this). */
  nested: SurveyAskNestedResult | null;
  /** D-BP151-031. Present only on the NO-TERM path -- askAmbiguity()'s raw result, issued
   *  instead of guessing a term. Null on the existing quoted/cued-term path (additive, unchanged
   *  behavior there). */
  ambiguity: AmbiguityQueryResult | null;
  /** D-BP151-031. One nested survey (surveyAskNested(), UNMODIFIED, same as the quoted/cued path)
   *  per term the SOURCE named as ambiguous, in the order the source returned them. Empty when
   *  `ambiguity` is null or named nothing usable. */
  ambiguityNested: Array<{ term: string; nested: SurveyAskNestedResult }>;
  /** D-BP151-031. True only when the SOURCE flagged at least one named term as a negation/
   *  exclusion/restriction word -- never inferred here from a word list. */
  negationNamed: boolean;
  /** D-BP151-035. One constraint per term in `ambiguity.terms` (empty when `ambiguity` is null or
   *  named nothing usable) -- see `SurveyConstraint`'s and `askConstraint()`'s own ATTRIBUTED
   *  comments. SURVEY ASKS; IT NEVER APPLIES -- nothing in this array is judged, ranked, or used
   *  to eliminate an option here. */
  constraints: SurveyConstraint[];
  /** D-BP152-005. PART 2 of the Founder's opening query (`FD-BP152-05`) -- askOperation()'s raw
   *  result, issued IMMEDIATELY AFTER the ambiguity query (Part 1) on the NO-TERM path only, same
   *  call chain. Null on the existing quoted/cued-term path (that path never calls askAmbiguity()
   *  either, so Part 2 has nothing to follow). `operation.rawAnswer` is deliberately
   *  UNINTERPRETED here -- see `determineDemandFromOperationAnswer()` (demand_test.ts) for where
   *  it is mapped onto a `LianaDemand`. */
  operation: OperationQueryResult | null;
  why: string;
}

/** D-BP151-035. ATTRIBUTED: Founder, BP151, ratified: "Yes agreed. Survey asks those, Cascade is
 *  still essential." One constraint question SURVEY asked about ONE source-named ambiguous term
 *  (`AmbiguityTermFinding`, above) -- never a verdict, never a ranking, never an elimination. See
 *  `askConstraint()`'s own header for exactly which of Google's two question forms this builds
 *  (form 1 only) and the fork stopped on for the other (form 2). */
export interface SurveyConstraint {
  term: string;
  /** The templated question actually sent, verbatim (Google's own form-1 question, substituted
   *  only with `term` -- see `askConstraint()`'s own ATTRIBUTED comment). */
  question: string;
  /** The source's stated answer, copied verbatim (gemmaExtract(), extraction only, HARDWIRE-22
   *  unrelaxed, on the 'google' branch) -- null when the constraint could not be obtained. An
   *  honest null is never converted into a guessed scale or threshold. */
  answer: string | null;
  /** Citation URL(s) the source returned alongside its answer (googleBlocks()'s own `sources`,
   *  unmodified), unscored -- same convention as `AmbiguityQueryResult.citations`. Always empty on
   *  the 'gemma' transport (no web source exists on that path) or when `answer` is null. */
  citations: string[];
  /** True exactly when `answer` is non-null -- distinguishes "asked and the source answered" from
   *  "asked, but nothing usable came back" (Law 5, HARDWIRE-23: the receipt must show which). */
  obtained: boolean;
  why: string;
}

/** Shared parser for the ambiguity query's JSON term list, used by BOTH transports below (google's
 *  gemmaExtract() output and gemma's own direct-reasoning output are the SAME declared shape) --
 *  one parsing routine, not two, so a shape change only has to be made once. Not a demand/decision
 *  rule of any kind (HARDWIRE-23's own carve-out: "mechanical implementation choices with no
 *  effect on which answer comes out"): this only reshapes already-decided model/source output into
 *  `AmbiguityTermFinding[]`, dropping only entries with no `term` at all. */
function parseAmbiguityTerms(raw: unknown, emit?: MethodRunContext['emit']): AmbiguityTermFinding[] {
  const rawTerms = Array.isArray(raw) ? (raw as Array<Record<string, unknown>>) : [];
  const terms: AmbiguityTermFinding[] = [];
  for (const rt of rawTerms) {
    const term = typeof rt?.term === 'string' ? rt.term.trim() : '';
    if (!term) {
      // D-BP152-004, INSTRUMENT ONLY: the predicate itself is UNCHANGED -- this entry is still
      // dropped, exactly as before. This only makes an already-made reject decision visible (same
      // 'note' style every other line in this file already uses) instead of silent, per
      // D-BP152-003's Predicate B finding: an entry could carry a fully-populated
      // standardMeaning/alternativeMeaning/impact and still vanish with no trace because the key
      // wasn't literally "term".
      if (emit) {
        emit({
          kind: 'note',
          text: `   ambiguity term entry DROPPED -- no non-empty string at key "term" (entry verbatim: ${JSON.stringify(rt)})`,
          ts: nowIso(),
        });
      }
      continue;
    }
    terms.push({
      term,
      standardMeaning: typeof rt?.standardMeaning === 'string' ? rt.standardMeaning.trim() : '',
      alternativeMeaning: typeof rt?.alternativeMeaning === 'string' ? rt.alternativeMeaning.trim() : '',
      impact: typeof rt?.impact === 'string' ? rt.impact.trim() : '',
      isNegation: rt?.isNegation === true,
    });
  }
  return terms;
}

/**
 * D-BP151-031, transport split D-BP151-032. ATTRIBUTED: Founder, BP151, verbatim: "what words or
 * phrases in this question could be understood with a different meaning that would fundamentally
 * change the meaning of what is being asked?" -- his own fix for SURVEY STEP 2's no-term path, run
 * by hand, worked first try. See this file's own header, "D-BP151-031 AMENDMENT", for the measured
 * failure this closes (qid 98, LIANA_RUN_qid98_2026-08-09T22-37-19-658Z.json, transcript line 75).
 *
 * `transport` SELECTS THE SOURCE. ATTRIBUTED (D-BP151-032): Founder, relayed BP151 addendum, "I
 * want to always run it on google, which should be the default that can be changed in Mnemosynec
 * at will." Resolved upstream by liana_terminal_engine.ts's resolveAmbiguityQueryTransport() and
 * threaded through founderStep2Survey() -> here; this function does not itself default anything
 * beyond its own parameter's declared default (kept only so a DIRECT unit-test call needs no
 * fourth argument -- callers reachable from the terminal always pass an explicit, resolved value).
 *
 * 'google' (the default): issues the SAME injected `askGoogle` channel every other Survey element
 * already uses, via `googleBlocks()` (methods/comparative_cascade.ts, already wired elsewhere in
 * this file's own header table) -- NOT a new transport. Google supplies a REAL passage; that
 * passage is then structured into `AmbiguityTermFinding[]` by `gemmaExtract()` UNRELAXED
 * (HARDWIRE-22 untouched on this branch -- see the file header's D-BP151-032 section for why this
 * is ordinary extraction, not the reasoning-with-no-passage judgment call the 'gemma' branch
 * below still is). Google being unreachable REFUSES; it never silently falls back to 'gemma'.
 *
 * 'gemma' (the selectable alternative, D-BP151-031's ORIGINAL implementation, UNCHANGED): there is
 * no fixed passage to extract this from -- the question text itself is what is being reasoned
 * about, exactly the shape of judgment gemmaExtract()'s own wrapper ("report only what it
 * states... never guess") was MEASURED (D-BP151-025, groupViaModel()'s header) to suppress. This
 * reuses the SAME relaxation groupOptionsByPredicate() already established for step 3 -- same
 * local Ollama instance (OLLAMA_API_BASE), same model (GROUPING_MODEL) -- via its own minimal,
 * unwrapped prompt. HARDWIRE-22 stays relaxed for exactly this named call site and step 3's,
 * nowhere else (see this file's header, HARDWIRE-23 section).
 *
 * THE SOURCE NAMES THE TERMS; THIS FUNCTION PICKS NONE OF THEM, on EITHER transport. Every term
 * the source returns is reported verbatim (standard meaning, alternative meaning, impact);
 * founderStep2Survey() decides how many to survey next (all of them, source order -- see its own
 * comment), never this function. `isNegation` is asked OF THE SOURCE per term, not matched against
 * a word list here.
 */
async function askAmbiguity(askText: string, ctx: MethodRunContext, transport: 'google' | 'gemma' = 'google'): Promise<AmbiguityQueryResult> {
  // D-BP152-008. Query text moved to resources/liana_survey_queries.json (id
  // "survey.ambiguity.askedText") -- no placeholders, so this is the exact static sentence, read
  // fresh on every call. Throws (never guesses) if the file/id is missing.
  const askedText = getQueryText('survey.ambiguity.askedText');

  if (transport === 'gemma') {
    const prompt = `You are analyzing a multiple-choice question for ambiguous words or phrases, using your own judgment. This is NOT extraction from a passage -- there is no source text to copy from; you must reason about the question itself.

QUESTION:
${askText}

TASK: ${askedText}

For each word or phrase you name, give its standard/expected meaning in this question, an alternative meaning that would change what is being asked, and a short statement of the impact of that alternative meaning. Also state whether it functions as a negation, exclusion, or restriction word (such as "not", "except", "least") whose presence or absence would flip which option is correct.

Return ONLY JSON in this shape, no prose, no fence:
{"terms":[{"term":"the exact word or phrase named","standardMeaning":"...","alternativeMeaning":"...","impact":"...","isNegation":true}]}
If nothing in the question could reasonably be understood differently, return {"terms":[]}. Do not guess an answer to the underlying question itself -- name ambiguous terms only.`;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60_000);
      const res = await fetch(`${OLLAMA_API_BASE}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: GROUPING_MODEL, prompt, stream: false, think: false, options: { temperature: 0, num_predict: 768 } }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));
      const j = (await res.json()) as { response?: string };
      const t = (j.response || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
      const parsed = JSON.parse(t) as { terms?: unknown };
      const terms = parseAmbiguityTerms(parsed.terms, ctx.emit);
      const why = terms.length
        ? `${terms.length} term(s) named by the local model (gemma, selected transport) as potentially `
          + 'ambiguous, each reported verbatim (standard meaning, alternative meaning, impact) -- the '
          + 'source names, this function picks none'
        : 'the local model ran and named nothing usable -- an honest empty result, not a fabrication';
      return { askedText, terms, modelUnreachable: false, transport: 'gemma', citations: [], rawGooglePassage: '', rawModelOutput: null, why };
    } catch {
      return {
        askedText,
        terms: [],
        modelUnreachable: true,
        transport: 'gemma',
        citations: [],
        rawGooglePassage: '',
        rawModelOutput: null,
        why: 'the local model call for the ambiguity query returned nothing (unreachable or failed) -- an honest empty result, not a fabrication',
      };
    }
  }

  // transport === 'google' (the Founder-ordered default). Google is the SOURCE; gemmaExtract()
  // (unrelaxed) STRUCTURES what Google actually said; this function decides nothing about which
  // terms matter. Same sentence as the 'gemma' branch, templated only with the question text
  // (FD-BP151-08) -- sent as a single Google query, not a JSON-forcing prompt (Google is a search
  // surface, not a constrained API).
  const query = `${askText}\n\n${askedText}`;
  // D-BP152-007, INSTRUMENT ONLY -- the exact query string about to be handed to googleBlocks(),
  // verbatim, emitted immediately BEFORE the call so it reaches the run receipt through the same
  // emit() mechanism D-BP152-004's passage-received instrument (below) already uses. Untruncated:
  // D-BP152-006 refuted a bad diagnosis (LIANA_RUN_qid98_2026-08-10T04-41-30-227Z.json) that was
  // reachable only because the sent query was invisible -- this closes that visibility gap without
  // changing what is sent or how it is built.
  ctx.emit({
    kind: 'note',
    text: `   PARSER INSTRUMENT [ambiguity] query SENT to Google (untruncated, verbatim)="${query}"`,
    ts: nowIso(),
  });
  const google = await googleBlocks(ctx.askGoogle, query);
  if (!google.ok || !google.text.trim()) {
    return {
      askedText,
      terms: [],
      modelUnreachable: true,
      transport: 'google',
      citations: [],
      rawGooglePassage: '',
      rawModelOutput: null,
      why: `Google was unreachable for the ambiguity query (${google.via}) -- refusing rather than `
        + 'silently falling back to the local model (ATTRIBUTED, Founder, relayed BP151 addendum: a '
        + 'silent transport swap would make two runs incomparable with no visible signal); an honest '
        + 'empty result, not a fabrication',
    };
  }
  // D-BP152-004, INSTRUMENT ONLY -- the raw passage about to be handed to gemmaExtract(), verbatim,
  // emitted BEFORE extraction runs so it survives into the transcript (and so the run receipt,
  // HARDWIRE\LEDGER\LIANA_RUNS\, same mechanism every other note in this file already reaches it
  // through) regardless of what extraction does with it. Same "PARSER INSTRUMENT" label/style
  // field_gate.ts already established for this exact purpose (log the exact input before any
  // parsing touches it). D-BP152-003 found this text was previously read, used, and discarded with
  // no trace anywhere on disk.
  const googlePassageForLog = google.text.length > 4000 ? google.text.slice(0, 4000) : google.text;
  ctx.emit({
    kind: 'note',
    text: `   PARSER INSTRUMENT [ambiguity] Google passage handed to gemmaExtract()`
      + `${google.text.length > 4000 ? ` (TRUNCATED at 4000 chars, full untruncated length was ${google.text.length})` : ' (untruncated, verbatim)'}`
      + `="${googlePassageForLog}"`,
    ts: nowIso(),
  });
  const instruction = 'List every word or phrase the passage names as something that could be understood '
    + 'with a different meaning that would fundamentally change the meaning of what is being asked. For '
    + 'each, report its standard meaning, an alternative meaning, and the impact of that alternative '
    + 'meaning, exactly as the passage states them. Also report, per term, whether the passage states it '
    + 'functions as a negation, exclusion, or restriction word (such as "not", "except", "least") whose '
    + 'presence or absence would flip which option is correct.';
  const shape = '{"terms":[{"term":"the exact word or phrase named","standardMeaning":"...","alternativeMeaning":"...","impact":"...","isNegation":true}]}';
  const rawOut: { text?: string } = {};
  const ex = await gemmaExtract(instruction, google.text, shape, rawOut);
  if (ex === null && rawOut.text !== undefined) {
    // D-BP152-004, INSTRUMENT ONLY -- gemmaExtract() failed to parse its own output as JSON
    // (D-BP152-003's Predicate A); the raw pre-JSON text that failed the parse now survives here
    // instead of being thrown away inside gemmaExtract()'s own catch block.
    const rawModelForLog = rawOut.text.length > 4000 ? rawOut.text.slice(0, 4000) : rawOut.text;
    ctx.emit({
      kind: 'note',
      text: `   PARSER INSTRUMENT [ambiguity] gemmaExtract() RAW OUTPUT (JSON parse FAILED)`
        + `${rawOut.text.length > 4000 ? ` (TRUNCATED at 4000 chars, full untruncated length was ${rawOut.text.length})` : ' (untruncated, verbatim)'}`
        + `="${rawModelForLog}"`,
      ts: nowIso(),
    });
  }
  const terms = parseAmbiguityTerms((ex as { terms?: unknown } | null)?.terms, ctx.emit);
  const why = terms.length
    ? `${terms.length} term(s) named by Google's own answer (${google.via}) as potentially ambiguous, `
      + 'extracted verbatim by gemmaExtract() (extraction only, HARDWIRE-22 unrelaxed) -- the source '
      + 'names, this function picks none'
    : `Google answered (${google.via}) but nothing usable could be extracted from it -- an honest empty `
      + 'result, not a fabrication';
  return {
    askedText,
    terms,
    modelUnreachable: false,
    transport: 'google',
    citations: google.sources,
    rawGooglePassage: google.text,
    rawModelOutput: ex === null ? (rawOut.text ?? null) : null,
    why,
  };
}

/** D-BP152-005. The result of issuing PART 2 of the Founder's opening query (FD-BP152-05) --
 *  see askOperation()'s own ATTRIBUTED comment below for the exact wording. `rawAnswer` is
 *  deliberately UNINTERPRETED: mapping it onto a `LianaDemand` is demand_test.ts's job
 *  (determineDemandFromOperationAnswer()), same separation every other Survey element already
 *  keeps -- Survey reports what the source said, it never decides what that means. */
export interface OperationQueryResult {
  /** The Founder's own Part 2 query text actually sent (verbatim; see askOperation()). */
  askedText: string;
  /** The source's raw stated operation word/phrase, copied verbatim. Null when the query itself
   *  produced nothing usable -- an honest null, never a fabrication. */
  rawAnswer: string | null;
  /** True exactly when the query itself produced nothing (transport unreachable/failed/
   *  unparseable) -- distinguishes "no live source, not run" from "source ran and said nothing". */
  modelUnreachable: boolean;
  /** Which transport actually answered THIS call -- REUSES the already-resolved value
   *  askAmbiguity() (Part 1) was called with; this function adds no second resolver. */
  transport: 'google' | 'gemma';
  /** googleBlocks()'s own `sources`, unmodified, unscored -- same convention as
   *  AmbiguityQueryResult.citations. Empty on the 'gemma' transport or when `rawAnswer` is null. */
  citations: string[];
  /** D-BP152-005, same INSTRUMENT-ONLY convention D-BP152-004 established for askAmbiguity() (see
   *  that ticket's own header, "D-BP152-004 AMENDMENT" -- not present in this file, see
   *  comparative_cascade.ts's `gemmaExtract()` `rawOut` out-param): the raw Google passage this
   *  call was built from, so a discard is diagnosable from the first run instead of only
   *  reportable by hand. Empty on the 'gemma' transport or when Google was unreachable. */
  rawGooglePassage: string;
  /** D-BP152-005, same convention: the model's raw pre-JSON-parse text, captured ONLY when
   *  `gemmaExtract()` failed to parse its own output as JSON -- null whenever extraction
   *  succeeded, was never attempted, or ran on the 'gemma' transport. */
  rawModelOutput: string | null;
  why: string;
}

/**
 * D-BP152-005. ATTRIBUTED: Founder, BP152, verbatim -- PART 2 of the query he opens every question
 * with (`FD-BP152-05`), the second half of the SAME instrument `askAmbiguity()` (Part 1, above)
 * already issues:
 *
 *   "And then what operation does this question require in order to answer it: does it want
 *   things ranked, defined, classified, or inferred from evidence?"
 *
 * ISSUED IMMEDIATELY AFTER PART 1, SAME TRANSPORT, SAME CALL CHAIN. `founderStep2Survey()`'s
 * no-term branch (below) calls this right after `askAmbiguity()` returns, passing the SAME
 * already-resolved `transport` value -- this function adds no second resolver, same convention
 * `askConstraint()` (D-BP151-035) already established. It runs regardless of what Part 1 came
 * back with: it is an INDEPENDENT instrument, not conditioned on Part 1's success, because the
 * measured failure this closes (`LIANA_RUN_qid98_2026-08-10T03-53-08-736Z.json`, `FD-BP152-05`)
 * is a run where Part 1 ALSO returned nothing usable.
 *
 * NEVER CARRIES THE OPTION LIST. `askText` is the raw question text ALONE -- same contamination
 * mitigation as Part 1 (this file's `askAmbiguity()` convention): sending the option list is the
 * demonstrated answer-key leak vector this design avoids on both halves of the opening query.
 *
 * THIS FUNCTION PICKS NOTHING. It reports the source's own stated answer verbatim in `rawAnswer`,
 * the same shape `askConstraint()` already uses for its own single-answer question -- interpreting
 * that answer onto the `LianaDemand` enum is `demand_test.ts`'s
 * `determineDemandFromOperationAnswer()`, never this function ("Survey asks; it never applies" --
 * same standing rule `askConstraint()`'s own header cites, `FD` BP151).
 *
 * 'google' (the default, REUSED from Part 1's already-resolved value): `googleBlocks()` supplies a
 * real passage; `gemmaExtract()` (unrelaxed, HARDWIRE-22 untouched) structures the source's stated
 * operation out of it -- ordinary extraction, same shape as `askAmbiguity()`'s own 'google' branch,
 * including D-BP152-004's raw-passage/raw-model-output instrumentation (built the same way here,
 * for this second call site, not duplicated from there) so a discard is diagnosable from the first
 * run.
 * 'gemma': the local model reasons about the question directly, the SAME named HARDWIRE-22
 * relaxation `askAmbiguity()`'s own 'gemma' branch already uses -- there is no passage to extract
 * this from. Google unreachable -> refuses; never silently falls back to 'gemma' (same rule as
 * Part 1).
 */
async function askOperation(askText: string, ctx: MethodRunContext, transport: 'google' | 'gemma' = 'google'): Promise<OperationQueryResult> {
  // D-BP152-008. Query text moved to resources/liana_survey_queries.json (id
  // "survey.operation.askedText") -- no placeholders, read fresh on every call.
  const askedText = getQueryText('survey.operation.askedText');

  if (transport === 'gemma') {
    const prompt = `You are analyzing a multiple-choice question to name the operation its answer must perform, using your own judgment. This is NOT extraction from a passage -- there is no source text to copy from; you must reason about the question itself.

QUESTION:
${askText}

TASK: ${askedText}

Return ONLY JSON in this shape, no prose, no fence:
{"answer":"the operation word you name, stated plainly (e.g. ranked, defined, classified, or inferred from evidence), or empty string if you cannot state one with confidence"}
Do not guess an answer to the underlying multiple-choice question itself -- name the operation only.`;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60_000);
      const res = await fetch(`${OLLAMA_API_BASE}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: GROUPING_MODEL, prompt, stream: false, think: false, options: { temperature: 0, num_predict: 256 } }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));
      const j = (await res.json()) as { response?: string };
      const t = (j.response || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
      const parsed = JSON.parse(t) as { answer?: unknown };
      const rawAnswer = typeof parsed.answer === 'string' && parsed.answer.trim() ? parsed.answer.trim() : null;
      const why = rawAnswer
        ? `answered by the local model (gemma, selected transport), reasoning directly: "${rawAnswer}" -- the source names, this function picks none`
        : 'the local model ran and named nothing usable -- an honest empty result, not a fabrication';
      return { askedText, rawAnswer, modelUnreachable: false, transport: 'gemma', citations: [], rawGooglePassage: '', rawModelOutput: null, why };
    } catch {
      return {
        askedText,
        rawAnswer: null,
        modelUnreachable: true,
        transport: 'gemma',
        citations: [],
        rawGooglePassage: '',
        rawModelOutput: null,
        why: 'the local model call for the operation query returned nothing (unreachable or failed) -- an honest empty result, not a fabrication',
      };
    }
  }

  // transport === 'google' (the Founder-ordered default, REUSED from Part 1's already-resolved
  // value). Same shape as askAmbiguity()'s own 'google' branch.
  const query = `${askText}\n\n${askedText}`;
  // D-BP152-007, same INSTRUMENT ONLY convention as askAmbiguity()'s own copy above -- built here,
  // not duplicated from there, for this second call site.
  ctx.emit({
    kind: 'note',
    text: `   PARSER INSTRUMENT [operation] query SENT to Google (untruncated, verbatim)="${query}"`,
    ts: nowIso(),
  });
  const google = await googleBlocks(ctx.askGoogle, query);
  if (!google.ok || !google.text.trim()) {
    return {
      askedText,
      rawAnswer: null,
      modelUnreachable: true,
      transport: 'google',
      citations: [],
      rawGooglePassage: '',
      rawModelOutput: null,
      why: `Google was unreachable for the operation query (${google.via}) -- refusing rather than `
        + 'silently falling back to the local model (same rule as askAmbiguity()); an honest empty '
        + 'result, not a fabrication',
    };
  }
  // D-BP152-005, same INSTRUMENT ONLY convention D-BP152-004 established for askAmbiguity() --
  // built here, not duplicated from there, for this second call site.
  const googlePassageForLog = google.text.length > 4000 ? google.text.slice(0, 4000) : google.text;
  ctx.emit({
    kind: 'note',
    text: `   PARSER INSTRUMENT [operation] Google passage handed to gemmaExtract()`
      + `${google.text.length > 4000 ? ` (TRUNCATED at 4000 chars, full untruncated length was ${google.text.length})` : ' (untruncated, verbatim)'}`
      + `="${googlePassageForLog}"`,
    ts: nowIso(),
  });
  const instruction = 'Report, verbatim, what the passage states as the single operation this question\'s '
    + 'answer must perform -- ranked, defined, classified, or inferred from evidence. Copy the stated '
    + 'operation exactly as the passage gives it -- do not summarize, infer, or add anything the passage '
    + 'does not state.';
  const shape = '{"answer":"the operation exactly as the passage states it, or empty string if the passage does not state one"}';
  const rawOut: { text?: string } = {};
  const ex = await gemmaExtract(instruction, google.text, shape, rawOut);
  if (ex === null && rawOut.text !== undefined) {
    const rawModelForLog = rawOut.text.length > 4000 ? rawOut.text.slice(0, 4000) : rawOut.text;
    ctx.emit({
      kind: 'note',
      text: `   PARSER INSTRUMENT [operation] gemmaExtract() RAW OUTPUT (JSON parse FAILED)`
        + `${rawOut.text.length > 4000 ? ` (TRUNCATED at 4000 chars, full untruncated length was ${rawOut.text.length})` : ' (untruncated, verbatim)'}`
        + `="${rawModelForLog}"`,
      ts: nowIso(),
    });
  }
  const rawAnswer = typeof (ex as { answer?: unknown } | null)?.answer === 'string' && (ex as { answer: string }).answer.trim()
    ? (ex as { answer: string }).answer.trim()
    : null;
  const why = rawAnswer
    ? `answered by Google's own passage (${google.via}); gemmaExtract() (extraction only, HARDWIRE-22 unrelaxed) reported the stated operation verbatim: "${rawAnswer}"`
    : `Google answered (${google.via}) but nothing usable could be extracted from it -- an honest empty result, not a fabrication`;
  return {
    askedText,
    rawAnswer,
    modelUnreachable: false,
    transport: 'google',
    citations: rawAnswer ? google.sources : [],
    rawGooglePassage: google.text,
    rawModelOutput: ex === null ? (rawOut.text ?? null) : null,
    why,
  };
}

/**
 * D-BP151-035. ATTRIBUTED: Founder, BP151, ratified this ticket, verbatim: "Yes agreed. Survey
 * asks those, Cascade is still essential." The Founder, from his own logged-in browser, asked
 * Google the smallest set of questions that would tell him HOW to determine qid 98's answer --
 * never the answer itself -- and Google returned exactly two question forms, quoted verbatim:
 *
 *   1. "What specific definition and scale of 'world region' is this question using?" -- because
 *      "the provided choices mix vastly different geographic scales."
 *   2. "What is the specific population density threshold (people per square kilometer) used to
 *      qualify as 'one of the world's most densely populated'?" -- because "Population density is
 *      relative... Without a firm baseline, you cannot accurately separate the 'most densely
 *      populated' clusters from the rest."
 *
 * ONLY FORM 1 IS BUILT HERE, templated with pure term substitution and nothing else: "What
 * specific definition and scale of '{term}' is this question using?" -- issued once per term the
 * ambiguity query named, from founderStep2Survey()'s own per-term loop, below.
 *
 * FORM 2 IS A STOPPED FORK, NOT BUILT -- REPORTED, PER THIS TICKET'S OWN INSTRUCTION ("if
 * templating requires inventing phrasing beyond substituting the term, STOP AND REPORT THE FORK...
 * do not invent a question and proceed"). Form 1 substitutes cleanly into Google's own sentence
 * with nothing added or removed -- any named term slots directly into "definition and scale of
 * '{term}'". Form 2 does not: "population density" and "(people per square kilometer)" are NOT
 * present in a named term's own text (the ambiguity query names a TERM -- e.g. "densely populated"
 * -- never the measurable quantity or unit that quantifies it). Producing them for an arbitrary
 * term would require either (a) inventing domain-specific phrasing this file has no authorized
 * source for, or (b) inventing a selection rule for WHICH named terms even warrant a
 * threshold-style question as opposed to a scale-style one -- exactly the FEATURE_WORDS/
 * REGION_WORDS shape `REGISTER_GATE_AUDIT_BP151.md` already found and named a tare (rules #2/#3,
 * 8 of 10 terms unattributed). The exact reduced wording this function WOULD send, if the Founder
 * authorizes it -- "What is the specific threshold used to qualify as '{term}'?", dropping
 * "population density"/"(people per square kilometer)" as non-substitutable elaboration -- is
 * stated here and in this ticket's own SEG return, as the open question put to him. Nothing below
 * builds it.
 *
 * `transport` IS NOT A SECOND RESOLVER. Per this ticket's own instruction ("Reuse it -- do not add
 * a second transport path"), this takes the SAME already-resolved `'google' | 'gemma'` value
 * askAmbiguity() (above) was called with -- liana_terminal_engine.ts's own
 * resolveAmbiguityQueryTransport(), threaded through founderStep2Survey() -> here, unchanged.
 * 'google' (the default): googleBlocks(ctx.askGoogle, question) -- the SAME channel every other
 * Survey element already uses -- then gemmaExtract() UNRELAXED structures the source's own stated
 * answer (ordinary extraction, HARDWIRE-22 untouched, same reasoning as askAmbiguity()'s own
 * 'google' branch). 'gemma': the local model reasons about the question directly, the SAME named
 * HARDWIRE-22 relaxation askAmbiguity()'s 'gemma' branch already uses (same Ollama instance, same
 * model), scoped to this one additional call site (HARDWIRE-23 section, rule 5). Google
 * unreachable -> refuses; it never silently falls back to 'gemma' (same rule, same ATTRIBUTION, as
 * askAmbiguity()).
 *
 * SURVEY ASKS. IT NEVER APPLIES. This function stores the constraint (term, question, answer,
 * citation) for the receipt; it never judges the answer, never eliminates an option with it, never
 * ranks anything. Applying a constraint is the cascade's job -- Founder, BP151, ratified this
 * ticket: "Cascade is still essential." `comparative_cascade.ts`, `stepped_audible.ts`, and
 * `register_gate.mjs` are not imported, read for editing, or modified by this function or its
 * caller.
 */
async function askConstraint(term: string, ctx: MethodRunContext, transport: 'google' | 'gemma'): Promise<SurveyConstraint> {
  // D-BP152-008. Query text moved to resources/liana_survey_queries.json (id
  // "survey.constraint.definitionScale"), term-substituted the same way as before, read fresh on
  // every call.
  const question = getQueryText('survey.constraint.definitionScale', { term });

  if (transport === 'gemma') {
    const prompt = `You are answering a constraint question about a multiple-choice question, using your own judgment. This is NOT extraction from a passage -- there is no source text to copy from; you must reason about the question itself.

CONSTRAINT QUESTION: ${question}

Return ONLY JSON in this shape, no prose, no fence:
{"answer":"the definition/scale you would use, stated plainly, or empty string if you cannot state one with confidence"}
Do not guess an answer to the underlying multiple-choice question itself -- answer only the constraint question above.`;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60_000);
      const res = await fetch(`${OLLAMA_API_BASE}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: GROUPING_MODEL, prompt, stream: false, think: false, options: { temperature: 0, num_predict: 256 } }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));
      const j = (await res.json()) as { response?: string };
      const t = (j.response || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
      const parsed = JSON.parse(t) as { answer?: unknown };
      const answer = typeof parsed.answer === 'string' ? parsed.answer.trim() : '';
      const obtained = !!answer;
      return {
        term,
        question,
        answer: obtained ? answer : null,
        citations: [],
        obtained,
        why: obtained
          ? 'answered by the local model (gemma, selected transport), reasoning directly -- no web source, so no citation'
          : 'the local model ran and returned nothing usable -- an honest null, not a fabrication',
      };
    } catch {
      return {
        term,
        question,
        answer: null,
        citations: [],
        obtained: false,
        why: 'the local model call for this constraint question returned nothing (unreachable or failed) -- an honest null, not a fabrication',
      };
    }
  }

  // transport === 'google' (the Founder-ordered default, REUSED from askAmbiguity()'s already-
  // resolved value -- not a second transport path).
  const google = await googleBlocks(ctx.askGoogle, question);
  if (!google.ok || !google.text.trim()) {
    return {
      term,
      question,
      answer: null,
      citations: [],
      obtained: false,
      why: `Google was unreachable for this constraint question (${google.via}) -- refusing rather than `
        + 'silently falling back to the local model (same rule as askAmbiguity()); an honest null, not a fabrication',
    };
  }
  const instruction = 'Report, verbatim, what the passage states as the specific definition and scale being '
    + 'used to answer this constraint question. Copy the stated definition/scale exactly as the passage '
    + 'gives it -- do not summarize, infer, or add anything the passage does not state.';
  const shape = '{"answer":"the definition/scale exactly as the passage states it, or empty string if the passage does not state one"}';
  const ex = await gemmaExtract(instruction, google.text, shape);
  const answer = typeof (ex as { answer?: unknown } | null)?.answer === 'string' ? (ex as { answer: string }).answer.trim() : '';
  const obtained = !!answer;
  return {
    term,
    question,
    answer: obtained ? answer : null,
    citations: obtained ? google.sources : [],
    obtained,
    why: obtained
      ? `answered by Google's own passage (${google.via}); gemmaExtract() (extraction only, HARDWIRE-22 unrelaxed) reported the stated definition/scale verbatim`
      : `Google answered (${google.via}) but nothing usable could be extracted from it -- an honest null, not a fabrication`,
  };
}

/**
 * FOUNDER STEP 2. Founder, Excerpt 7, BP141: "If I look up the definition of bias in google,
 * perfunctorily, I get this... That doesn't answer my question, it's just a fact to eblet for
 * component factor foundation for reasoning. So keeping those definitions in mind, but not bound
 * by them."
 *
 * WIRES surveyAskNested() (elements/survey_ask.ts) unmodified -- this is the FIRST live caller of
 * its nested form, which itself wires elements/nest.ts (buildNest/findFrame), also dead before
 * this ticket. `term` is REQUIRED to already be resolved by the caller (runSurveyStage() below
 * derives it via findAskCatalyst()); this function never guesses one itself.
 *
 * D-BP151-031 AMENDMENT, ADDITIVE ONLY: when `term` is null, this function no longer only
 * refuses. `askText` (the raw question, passed by runSurveyStage() below) is handed to
 * askAmbiguity() -- the Founder's own ambiguity query (that function's own ATTRIBUTED
 * comment) -- INSTEAD of guessing a term. THE SOURCE NAMES THE TERMS; every term it names is
 * surveyed here via the SAME surveyAskNested() the quoted/cued path already uses, in the order the
 * source returned them (no ranking or selection rule was invented -- surveying every named term,
 * source order, needs none). If `askText` is empty/omitted, or the ambiguity query itself returns
 * nothing usable, this function still refuses exactly as it did before this ticket -- refusing
 * beats guessing, unchanged.
 *
 * `ambiguityQueryTransport` (D-BP151-032, ADDITIVE): threaded straight to askAmbiguity() -- see
 * its own header for what each value does. Default 'google' exists only so this function is
 * callable with three arguments in a direct unit test; every reachable-from-the-terminal caller
 * (runSurveyStage() below) passes the ALREADY-RESOLVED value from
 * liana_terminal_engine.ts's resolveAmbiguityQueryTransport().
 */
export async function founderStep2Survey(term: string | null, ctx: MethodRunContext, askText?: string, ambiguityQueryTransport: 'google' | 'gemma' = 'google'): Promise<FounderStep2Result> {
  const { emit } = ctx;
  emit({
    kind: 'stage',
    text: '-> SURVEY STEP 2 -- define the term, perfunctorily, then keep looking (Founder, Excerpt 7, BP141)',
    ts: nowIso(),
  });
  if (!term) {
    const whyNoTerm = 'no term to survey -- refusing rather than guessing one from the raw question text (refusing beats guessing)';
    emit({ kind: 'note', text: `   ${whyNoTerm}`, ts: nowIso() });

    if (!askText || !askText.trim()) {
      emit({ kind: 'result', text: 'SURVEY STEP 2: no term, not run', ts: nowIso() });
      return { term: null, nested: null, ambiguity: null, ambiguityNested: [], negationNamed: false, constraints: [], operation: null, why: whyNoTerm };
    }

    // D-BP151-031. ATTRIBUTED: Founder, BP151, verbatim: "what words or phrases in this question
    // could be understood with a different meaning that would fundamentally change the meaning of
    // what is being asked?" -- issued instead of guessing a term. See askAmbiguity()'s own
    // header for the full ruling and why the local model, not gemmaExtract(), answers it.
    emit({
      kind: 'note',
      text: `   no quoted/cued term -- issuing the Founder's ambiguity query instead of guessing one, `
        + `via ${ambiguityQueryTransport.toUpperCase()} (ATTRIBUTED: Founder, BP151, verbatim: "what words or `
        + 'phrases in this question could be understood with a different meaning that would fundamentally '
        + 'change the meaning of what is being asked?"; transport ATTRIBUTED: Founder, relayed BP151 addendum, '
        + '"I want to always run it on google, which should be the default that can be changed in Mnemosynec '
        + 'at will.")',
      ts: nowIso(),
    });
    const ambiguity = await askAmbiguity(askText, ctx, ambiguityQueryTransport);
    emit({ kind: 'note', text: `   [transport: ${ambiguity.transport.toUpperCase()}] ${ambiguity.why}`, ts: nowIso() });
    if (ambiguity.citations.length) {
      emit({ kind: 'note', text: `   citation(s) from Google: ${ambiguity.citations.join(', ')}`, ts: nowIso() });
    }

    // D-BP152-005, PART 2 of the SAME opening query (FD-BP152-05), issued IMMEDIATELY AFTER
    // PART 1, regardless of what Part 1 came back with -- it is an independent instrument, asked
    // about the question text alone, never the option list (same contamination mitigation as
    // Part 1). ATTRIBUTED: Founder, BP152, verbatim: "And then what operation does this question
    // require in order to answer it: does it want things ranked, defined, classified, or inferred
    // from evidence?" See askOperation()'s own header for the full ruling.
    const operation = await askOperation(askText, ctx, ambiguityQueryTransport);
    emit({ kind: 'note', text: `   [transport: ${operation.transport.toUpperCase()}] PART 2 (operation): ${operation.why}`, ts: nowIso() });
    if (operation.citations.length) {
      emit({ kind: 'note', text: `   citation(s) from Google (operation query): ${operation.citations.join(', ')}`, ts: nowIso() });
    }

    if (!ambiguity.terms.length) {
      const why = `${whyNoTerm}; ambiguity query issued but returned nothing usable (${ambiguity.why}) -- `
        + 'refusing rather than guessing (refusing beats guessing)';
      emit({ kind: 'result', text: 'SURVEY STEP 2: no term, ambiguity query returned nothing usable, not run', ts: nowIso() });
      return { term: null, nested: null, ambiguity, ambiguityNested: [], negationNamed: false, constraints: [], operation, why };
    }

    // THE SOURCE NAMES THE TERMS; THIS SURVEYS ALL OF THEM, IN THE ORDER THE SOURCE RETURNED
    // THEM. No ranking or picking rule was invented among source-named terms -- the Founder's own
    // order allowed either "survey all named terms" or "survey them in the order the source gave";
    // this ticket does both at once, since they coincide when nothing is dropped.
    const ambiguityNested: Array<{ term: string; nested: SurveyAskNestedResult }> = [];
    for (const t of ambiguity.terms) {
      // eslint-disable-next-line no-await-in-loop -- one nested survey per named term, sequential
      // by design, same pattern as surveyAskNested()'s own level loop.
      const nested = await surveyAskNested(t.term, ctx);
      ambiguityNested.push({ term: t.term, nested });
    }
    const negationNamed = ambiguity.terms.some((t) => t.isNegation);
    if (negationNamed) {
      const namedList = ambiguity.terms.filter((t) => t.isNegation).map((t) => t.term).join(', ');
      emit({
        kind: 'note',
        text: `   NEGATION NAMED by the source: ${namedList} -- flagged on the ASK (never inferred from a word list here)`,
        ts: nowIso(),
      });
    }

    // D-BP151-035. ATTRIBUTED: Founder, BP151, ratified: "Yes agreed. Survey asks those, Cascade
    // is still essential." One constraint question per source-named term, askConstraint()'s own
    // form-1 (definition/scale) template only -- see that function's own header for the form-2
    // fork stopped on. SURVEY ASKS; IT NEVER APPLIES -- nothing below judges, ranks, or eliminates
    // with a constraint's answer.
    const constraints: SurveyConstraint[] = [];
    for (const t of ambiguity.terms) {
      // eslint-disable-next-line no-await-in-loop -- one constraint question per named term,
      // sequential by design, same pattern as the ambiguityNested loop immediately above.
      const constraint = await askConstraint(t.term, ctx, ambiguityQueryTransport);
      constraints.push(constraint);
      // Law 5, HARDWIRE-23: the receipt (this transcript) shows each constraint, its question, its
      // answer, and its source, without needing to read the returned object.
      emit({
        kind: 'note',
        text: `   CONSTRAINT for "${t.term}": "${constraint.question}" -> `
          + `${constraint.obtained ? `"${constraint.answer}"` : 'null (unobtained -- honest, not fabricated)'}`
          + `${constraint.citations.length ? ` [source: ${constraint.citations.join(', ')}]` : ' [no source]'}`,
        ts: nowIso(),
      });
    }
    const obtainedCount = constraints.filter((c) => c.obtained).length;

    const why = `no quoted/cued term -- issued the Founder's ambiguity query instead, via ${ambiguity.transport.toUpperCase()}; `
      + `${ambiguity.terms.length} term(s) named by the source ("${ambiguity.terms.map((t) => t.term).join('", "')}"), `
      + `all surveyed (source order, no ranking rule invented)${negationNamed ? '; NEGATION NAMED by the source' : ''}; `
      + `${constraints.length} constraint question(s) asked (form-1/definition-scale template only, form-2/threshold `
      + `is a stopped fork -- see this file's own D-BP151-035 header), ${obtainedCount} answered`;
    emit({
      kind: 'result',
      text: `SURVEY STEP 2: no quoted/cued term -- ${ambiguity.terms.length} term(s) named by the ambiguity `
        + `query [transport: ${ambiguity.transport.toUpperCase()}], ${ambiguityNested.length} surveyed, `
        + `${constraints.length} constraint(s) asked (${obtainedCount} answered)`
        + `${negationNamed ? ', negation named' : ''}`,
      ts: nowIso(),
    });
    return { term: null, nested: null, ambiguity, ambiguityNested, negationNamed, constraints, operation, why };
  }
  const nested = await surveyAskNested(term, ctx);
  const why = `surveyed "${term}" via E-SURVEY-ASK's nested form (wired, not rewritten): ${nested.why}`;
  emit({ kind: 'result', text: `SURVEY STEP 2: "${term}" -- ${nested.levels.length} level(s) surveyed`, ts: nowIso() });
  return { term, nested, ambiguity: null, ambiguityNested: [], negationNamed: false, constraints: [], operation: null, why };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// STEP 3 -- CATEGORIZE THE OPTIONS BY SHARED PREDICATE, BEFORE ELIMINATING ANYTHING.
// ─────────────────────────────────────────────────────────────────────────────────────────────

export interface SurveyOptionGroup {
  /** The model's own short description of what this group's options have in common -- a
   *  PROPOSAL, sourced from the one relaxed judgment call this file makes (see
   *  groupOptionsByPredicate()'s own ATTRIBUTED comment), never a verified extraction. */
  label: string;
  letters: string[];
}

export interface FounderStep3GroupingResult {
  /** The model's proposed clusters. May be empty (model unreachable, or it proposed nothing
   *  usable) -- an honest empty result, never a fabrication. */
  groups: SurveyOptionGroup[];
  /** Options the model did not place in any usable group -- reported, never forced into one. */
  ungrouped: string[];
  /** True when the model call itself produced nothing (unreachable/failed) -- distinguishes "no
   *  live model, not run" from "model ran and proposed nothing". */
  modelUnreachable: boolean;
  why: string;
}

export interface FounderStep3Result {
  /** surveyAnswers()'s own result (elements/survey_answers.ts), UNMODIFIED -- per-option KIND,
   *  ASPECT, and discriminating CATALYST WORDS, each already surveyed. This IS the raw material
   *  the Founder read when he said "I categorize the possible answers" -- what each option IS,
   *  not what it merely spells. */
  perOption: SurveyAnswersResult | null;
  /** The model's proposed groupings (D-BP151-025 amendment) -- see groupOptionsByPredicate()'s
   *  own ATTRIBUTED comment. Null exactly when `perOption` is null (no options to group). */
  grouping: FounderStep3GroupingResult | null;
  why: string;
}

/**
 * MEASURED FINDING, this ticket: `gemmaExtract()` (methods/comparative_cascade.ts) cannot be
 * reused for step 3's grouping call. Its own prompt wrapper is HARDWIRE-22's TEXTUAL enforcement
 * -- "Read the passage and report only what it states... Do not reason... Never guess." -- and a
 * judgment task run through that wrapper was measured (this ticket, three separate instruction/
 * shape attempts against the live local Ollama instance, `gemma4:12b`) to come back with every
 * `group`/`letters` field null every time: the wrapper's own words tell the model not to do the
 * one thing this call now needs it to do. Continuing to route through gemmaExtract() would leave
 * the Founder's relaxation unusable in practice while APPEARING wired. So this ONE call uses its
 * own minimal prompt (below), with NO "report only what it states"/"never guess" framing -- BUT
 * the same underlying transport (identical Ollama endpoint, identical model, identical
 * temperature 0 for determinism, identical abort-on-timeout/catch-and-return-null robustness
 * `gemmaExtract()` already has) -- not a second, differently-behaved system, only a different
 * instruction reaching the same one. Re-measured after this fix, live: the model now returns real
 * groups (e.g. two sampling-bias options clustered together, a sample-size option left alone).
 */
async function groupViaModel(instruction: string, listing: string, shape: string): Promise<Record<string, unknown> | null> {
  const prompt = `You are grouping lettered options by shared predicate, using your own judgment. This is NOT extraction -- there is no single stated fact to copy; you must decide which options are alike.

OPTIONS:
${listing}

TASK: ${instruction}

Return ONLY JSON in this shape, no prose, no fence:
${shape}
Every option letter must appear in exactly one group. Do not leave a field null -- assign a real group to every option.`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);
    const res = await fetch(`${OLLAMA_API_BASE}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: GROUPING_MODEL, prompt, stream: false, think: false, options: { temperature: 0, num_predict: 512 } }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));
    const j = (await res.json()) as { response?: string };
    const t = (j.response || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    return JSON.parse(t) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * ATTRIBUTED: Founder, BP151, verbatim: "Grouping requires a model call - like ALL judgements,
 * and yes, relaxed for this one purpose."
 *
 * THE RELAXATION IS SCOPED TO THIS ONE CALL, AND NOTHING ELSE. HARDWIRE-22 ("Gemma extracts,
 * never judges") is relaxed ONLY for grouping options by shared predicate, here, via
 * groupViaModel() above. It does not extend to extraction, elimination, register determination,
 * or any other judgment anywhere else in this file or this estate -- every other model call this
 * file relies on (surveyAsk, surveyAnswers, fieldGate, extractAssertedMentions) still goes through
 * `gemmaExtract()` unmodified and stays extraction-only.
 *
 * THE MODEL GROUPS. IT DOES NOT DECIDE WHICH GROUP IS RIGHT, AND IT NEVER ANSWERS THE QUESTION.
 * The instruction below says so, and the only post-call check this function performs is
 * MECHANICAL, not a second judgment: every returned letter must be a real option letter in this
 * question's own option set; a hallucinated or unknown letter is dropped, never trusted. NO
 * vocabulary threshold was built as an alternative (the Founder chose the model call over one,
 * explicitly, when this fork was put to him).
 */
async function groupOptionsByPredicate(
  options: Record<string, string>,
  ctx: MethodRunContext,
): Promise<FounderStep3GroupingResult> {
  const letters = Object.keys(options);
  const listing = letters.map((L) => `${L}) ${options[L]}`).join('\n');
  const ex = await groupViaModel(
    'Group these lettered options into clusters of options that make a similar kind of claim or '
      + 'share a similar predicate -- the way a person would group answers before eliminating any '
      + 'of them, not by counting shared words. An option unlike every other option may form a '
      + 'group of one. For each group, give a short label describing what its options have in '
      + 'common. Do not decide which option is correct. Do not answer the question these options '
      + 'are for. Do not rank the groups.',
    listing,
    '{"groups":[{"label":"short description of what this group\'s options have in common","letters":["A","B"]}]}',
  );
  if (!ex) {
    return {
      groups: [],
      ungrouped: letters,
      modelUnreachable: true,
      why: 'the model call for grouping returned nothing (unreachable or failed) -- an honest '
        + 'empty result, not a fabrication; every option reported ungrouped',
    };
  }
  const rawGroups = Array.isArray(ex.groups) ? (ex.groups as Array<{ label?: unknown; letters?: unknown }>) : [];
  const validLetters = new Set(letters);
  const seen = new Set<string>();
  const groups: SurveyOptionGroup[] = [];
  for (const g of rawGroups) {
    const label = typeof g?.label === 'string' && g.label.trim() ? g.label.trim() : '(no label given)';
    const rawLetters = Array.isArray(g?.letters) ? g!.letters : [];
    // MECHANICAL check only, not a second judgment: a returned letter must be one of THIS
    // question's own real options. A hallucinated/unknown letter is dropped, never trusted.
    const groupLetters = rawLetters.filter((l): l is string => typeof l === 'string' && validLetters.has(l));
    if (!groupLetters.length) continue;
    groupLetters.forEach((l) => seen.add(l));
    groups.push({ label, letters: groupLetters });
  }
  const ungrouped = letters.filter((L) => !seen.has(L));
  const why = `${groups.length} group(s) proposed by the model, ${ungrouped.length} option(s) left ungrouped -- `
    + 'a PROPOSAL, not a decision: the model groups, it does not decide which group is right, and it never answers the question';
  return { groups, ungrouped, modelUnreachable: false, why };
}

/**
 * FOUNDER STEP 3. Founder, Excerpt 7, BP141, rule 12: "Well, first, I categorize the possible
 * answers. I note that A, B, sorta C but more to that, D, E same as C... F, H is like C and E,
 * I, and J all have to do with what answer it results in. G does not."
 *
 * WIRES surveyAnswers() (elements/survey_answers.ts) unmodified -- DEAD CODE before this file,
 * first live caller. It reports, per option: the option's own verbatim text, its KIND
 * (checkKind(), elements/kind_check.ts -- also its first live caller), its ASPECT (tagAspect()),
 * and its own discriminating catalyst word(s) (findCatalystWords()), each surveyed in turn.
 *
 * THEN GROUPS via groupOptionsByPredicate() -- the Founder's own resolution of the fork this
 * function originally stopped at (see that function's own ATTRIBUTED comment for the exact
 * ruling and its scope). The grouping is a PROPOSAL: it is not verified against the passage the
 * way an extraction is, and it never picks a "right" group or an answer to the question.
 */
export async function founderStep3CategorizeOptions(
  options: Record<string, string> | null,
  ctx: MethodRunContext,
  sharedFrame?: RegExp,
  /** Passthrough to surveyAnswers()'s own `maxCatalystWordsPerOption` (elements/survey_answers.ts)
   *  -- an existing COST bound already defined and owned by that element (default 1, unchanged
   *  here), never a new decision rule: it does not change WHICH catalyst word is surveyed, only
   *  how many of the already-ordered list get an extra Google round-trip. Exposed here so a
   *  caller (including this file's own tests) can bound I/O without touching survey_answers.ts. */
  maxCatalystWordsPerOption?: number,
): Promise<FounderStep3Result> {
  const { emit } = ctx;
  emit({
    kind: 'stage',
    text: '-> SURVEY STEP 3 -- categorize the options by shared predicate, before eliminating anything (Founder, Excerpt 7, BP141, rule 12)',
    ts: nowIso(),
  });
  if (!options || Object.keys(options).length === 0) {
    const why = 'no options supplied -- nothing to categorize';
    emit({ kind: 'note', text: `   ${why}`, ts: nowIso() });
    emit({ kind: 'result', text: 'SURVEY STEP 3: no options, not run', ts: nowIso() });
    return { perOption: null, grouping: null, why };
  }
  const perOption = await surveyAnswers(options, ctx, { sharedFrame, maxCatalystWordsPerOption });
  emit({
    kind: 'note',
    text: '   ATTRIBUTED: Founder, BP151, verbatim: "Grouping requires a model call - like ALL judgements, and yes, '
      + 'relaxed for this one purpose." (HARDWIRE-22 relaxed for THIS grouping call only)',
    ts: nowIso(),
  });
  const grouping = await groupOptionsByPredicate(options, ctx);
  const why = `${perOption.why} -- ${grouping.why}`;
  emit({ kind: 'note', text: `   ${grouping.why}`, ts: nowIso() });
  emit({
    kind: 'result',
    text: `SURVEY STEP 3: ${perOption.letters.length} option(s) surveyed, ${grouping.groups.length} group(s) proposed (model call, PROPOSAL only)`,
    ts: nowIso(),
  });
  return { perOption, grouping, why };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// STEP 4 -- DETERMINE THE REGISTER: guess out loud, then check it. Verification is mandatory.
// ─────────────────────────────────────────────────────────────────────────────────────────────

export interface FounderStep4Result {
  term: string | null;
  /** Present only when `term` was resolved -- fieldGate()'s own result (elements/field_gate.ts),
   *  UNMODIFIED. */
  field: FieldGateResult | null;
  /** True EXACTLY when fieldGate() reached ONE_SURVIVOR -- the only decision this function itself
   *  makes, and it is a direct, definitional readout of fieldGate()'s own GateDecision enum, not
   *  a new threshold. An unverified guess (MULTIPLE_SURVIVORS, ZERO_SURVIVORS, NO_CANDIDATES) is
   *  never reported as verified. */
  verified: boolean;
  why: string;
}

/**
 * FOUNDER STEP 4. Founder, Excerpt 7, BP141, rule 13: "So I need to define what CONTEXT the
 * question is being asked in. I would guess from 'sample' being used in A, B, C, D, E, H, I
 * questions... then it has to do with statistics. How do I know that? I don't, I'm guessing. So
 * I'll check:" -- then he ran "what is bias in statistics" and verified the register-specific
 * definition came back. THE VERIFICATION IS NOT OPTIONAL, per his own words.
 *
 * WIRES fieldGate() (elements/field_gate.ts) unmodified -- ALREADY LIVE (definitional_cascade.ts
 * D1.5 already calls it). fieldGate()'s own STEP 1 (ask) / STEP 2 (eliminate by co-occurring
 * vocabulary) shape already IS guess-then-verify: candidate field names are never trusted merely
 * because Google returned them (the "guess"); a candidate survives only if its own sourced
 * vocabulary is independently corroborated by the ASK/options (the "check"). `verified` below is
 * true only on fieldGate()'s own ONE_SURVIVOR decision -- MULTIPLE_SURVIVORS, ZERO_SURVIVORS and
 * NO_CANDIDATES are all reported honestly as unverified, per this ticket's hard constraint that an
 * unverified register guess may never be acted on.
 */
export async function founderStep4DetermineRegister(
  term: string | null,
  askText: string,
  options: Record<string, string> | null,
  ctx: MethodRunContext,
): Promise<FounderStep4Result> {
  const { emit } = ctx;
  emit({
    kind: 'stage',
    text: '-> SURVEY STEP 4 -- determine the register: guess out loud, then check it (Founder, Excerpt 7, BP141, rule 13)',
    ts: nowIso(),
  });
  if (!term) {
    const why = 'no term to determine a register for -- refusing rather than guessing one from the raw question text';
    emit({ kind: 'note', text: `   ${why}`, ts: nowIso() });
    emit({ kind: 'result', text: 'SURVEY STEP 4: no term, not run', ts: nowIso() });
    return { term: null, field: null, verified: false, why };
  }
  const field = await fieldGate(term, askText, options, ctx);
  const verified = field.decision === 'ONE_SURVIVOR';
  const why = verified
    ? `VERIFIED: ${field.why}`
    : `NOT VERIFIED (${field.decision}) -- register left unconstrained rather than acted on: ${field.why}`;
  emit({ kind: 'note', text: `   ${why}`, ts: nowIso() });
  emit({ kind: 'result', text: `SURVEY STEP 4: ${verified ? 'VERIFIED' : 'unverified'} [${field.decision}]`, ts: nowIso() });
  return { term, field, verified, why };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// STEP 6 -- THE JAR METHOD: report what a source NAMED, never what a word list matched.
// ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The semantic direction of one Jar Method source query, DECLARED by the caller who formed the
 * query -- never inferred by this file from the query text, from the returned passage, or from a
 * word list. See JarSourceGroup's own ATTRIBUTED comment for the ruling this encodes.
 *   'answers-eliminate' -- the query asks for the OPPOSITE of what the original ask wants (his
 *     own qid-98 example: the inverse, "Which regions ARE densely populated?"). Any option a
 *     source NAMES as an answer to that query is confirmed to be the opposite of what is sought,
 *     and is eliminated.
 *   'answers-keep' -- the query asks the SAME direction as the original ask. A named option is
 *     reported (in `named`) but not eliminated by this function.
 */
export type JarQueryDirection = 'answers-eliminate' | 'answers-keep';

export interface JarSourceGroup {
  query: string;
  blocks: GoogleBlock[];
  /**
   * ATTRIBUTED: Founder, BP151, verbatim: "certainty is derived from my mechanical processes, not
   * from any model's 'certainty'." Confirmed reading (put to him directly): the polarity comes
   * from WHICH QUESTION WAS ASKED, not from classifying the sentence. His own qid-98 walkthrough
   * asked the inverse -- "Which of the following world regions IS considered one of the world's
   * most densely populated regions?" -- so any option a source names as an answer to THAT query
   * is removed from the pool for the original (opposite) ask. The direction was fixed the moment
   * the query went out, which means it is knowable only by whoever formed the query -- this file
   * does not and cannot infer it from the query string or the returned text. REQUIRED, not
   * optional or defaulted: a source group with no declared direction cannot be constructed (the
   * type carries no undefined/default case).
   */
  direction: JarQueryDirection;
}

export interface JarNamedMention {
  letter: string;
  /** The verbatim sentence the source asserted about this option, HARDWIRE-22 -- copied and
   *  verified against the passage it came from, never paraphrased. */
  sentence: string;
  sourceQuery: string;
  direction: JarQueryDirection;
}

export interface JarEliminatedOption {
  letter: string;
  sentence: string;
  sourceQuery: string;
  why: string;
}

export interface FounderStep6Result {
  /** Every option a supplied source block explicitly named, with the verbatim sentence and the
   *  direction of the query that produced it -- the full naming record, regardless of outcome. */
  named: JarNamedMention[];
  /** Options ELIMINATED because a source named them as an answer to a query DECLARED
   *  'answers-eliminate'. Mechanical: (a) named verbatim -- extractAssertedMentions() proves it;
   *  (b) the query's direction is known -- the caller declared it; (c) eliminate per that known
   *  direction. No word list, no model judgment, no threshold. */
  eliminated: JarEliminatedOption[];
  /** Unique eliminated letters, for a caller that only needs the pool-narrowing fact. */
  eliminatedLetters: string[];
  why: string;
}

/**
 * FOUNDER STEP 6, THE JAR METHOD. Founder, Excerpt 2, BP141, rule 2: "Note that we got rid of
 * four answers with one google search - I like to call this the Jar Method... First we take out
 * the Softballs, because we KNOW they are not the answer." He removed options a SOURCE NAMED
 * EXPLICITLY, with certainty -- not options a word-list regex happened to match.
 *
 * WIRES extractAssertedMentions() (methods/comparative_cascade.ts, already exported, already used
 * live by that file's own STAGE 1/STAGE 2) for its EXTRACTION-AND-VERIFICATION half, UNMODIFIED:
 * which of the option's own names does this passage mention, and the verbatim sentence, each
 * checked against the passage itself (appearsIn) and checked to be an assertion (register_gate.
 * mjs's isAssertion()) before being trusted.
 *
 * THE CERTAINTY/POLARITY RULING (D-BP151-025 amendment), ATTRIBUTED at JarSourceGroup.direction's
 * own comment above: certainty is MECHANICAL, derived from the caller-declared direction of the
 * query that produced a source block -- never from a model's confidence, never from a word list
 * (HIGH_WORDS/LOW_WORDS remains comparative_cascade.ts's own named tare, not reproduced here).
 * (a) a source names an option verbatim (proven); (b) the query's direction is known (declared);
 * (c) eliminate per that known direction. This function makes no OTHER decision: it does not
 * choose which query to run, does not weigh sources against each other, and never eliminates an
 * option no source named.
 *
 * STILL ISSUES NO GOOGLE QUERY OF ITS OWN -- confirmed correct as originally built. Founder,
 * Excerpt 2, BP141: "we got rid of four answers with ONE google search" -- the Jar Method was
 * never a second search; it reads more out of a response an earlier query already returned. This
 * function takes `sourceGroups` -- blocks and their KNOWN direction, from a caller who already
 * fetched them for another purpose (e.g. Stage 1's inverse query) -- as a required parameter,
 * mirroring D-BP150-018(C)'s "stop throwing away Stage 1's haul" precedent. An empty array is an
 * honest "not run", never a fabricated result.
 */
export async function founderStep6JarMethod(
  sourceGroups: JarSourceGroup[],
  options: Record<string, string> | null,
  ctx: MethodRunContext,
): Promise<FounderStep6Result> {
  const { emit } = ctx;
  const note = (text: string) => emit({ kind: 'note', text, ts: nowIso() });
  emit({
    kind: 'stage',
    text: '-> SURVEY STEP 6 -- THE JAR METHOD: eliminate what a source NAMED, by the query\'s own known direction (Founder, Excerpt 2, BP141, rule 2)',
    ts: nowIso(),
  });

  if (!options || Object.keys(options).length === 0) {
    const why = 'no options supplied -- nothing to check a source against';
    note(`   ${why}`);
    emit({ kind: 'result', text: 'SURVEY STEP 6: no options, not run', ts: nowIso() });
    return { named: [], eliminated: [], eliminatedLetters: [], why };
  }
  if (!sourceGroups.length) {
    const why = 'no source groups supplied -- this function issues no query of its own (Founder: "we got rid of '
      + 'four answers with ONE google search" -- never a second search); not run, not a fabricated elimination';
    note(`   ${why}`);
    emit({ kind: 'result', text: 'SURVEY STEP 6: no source groups, not run', ts: nowIso() });
    return { named: [], eliminated: [], eliminatedLetters: [], why };
  }

  const ALL = Object.keys(options);
  const named: JarNamedMention[] = [];
  const eliminated: JarEliminatedOption[] = [];
  for (const { query, blocks, direction } of sourceGroups) {
    note(`   source group -- query "${query}", direction=${direction}`);
    // eslint-disable-next-line no-await-in-loop -- one Gemma call per block, sequential by design,
    // same pattern as survey_ask.ts's own handleBlock() loop.
    for (const block of blocks) {
      const passage = [block.title, block.body].filter(Boolean).join(' -- ');
      if (!passage.trim()) continue;
      // eslint-disable-next-line no-await-in-loop
      const mentions: AssertedMention[] = await extractAssertedMentions(passage, ALL, options, note);
      for (const m of mentions) {
        named.push({ letter: m.L, sentence: m.sentence, sourceQuery: query, direction });
        if (direction === 'answers-eliminate') {
          eliminated.push({
            letter: m.L,
            sentence: m.sentence,
            sourceQuery: query,
            why: `named as an answer to a query declared "answers-eliminate" -- eliminated by the Jar Method's own `
              + 'mechanical rule (certainty from the query\'s known direction, not a word list; Founder, BP151: '
              + '"certainty is derived from my mechanical processes, not from any model\'s \'certainty\'")',
          });
        }
      }
    }
  }
  const eliminatedLetters = [...new Set(eliminated.map((e) => e.letter))];
  const why = named.length
    ? `${named.length} named mention(s) found across ${sourceGroups.length} source group(s), verified verbatim -- `
      + `${eliminatedLetters.length} option(s) eliminated by known query direction: ${eliminatedLetters.join(', ') || '(none)'}`
    : `0 named mentions found across ${sourceGroups.length} source group(s) -- an honest empty result, not a fabrication`;
  note(`   ${why}`);
  emit({
    kind: 'result',
    text: `SURVEY STEP 6: ${named.length} named mention(s), ${eliminatedLetters.length} option(s) eliminated`,
    ts: nowIso(),
  });
  return { named, eliminated, eliminatedLetters, why };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// THE ORCHESTRATOR -- steps 2, 3, 4, 6, IN HIS ORDER. Survey PROPOSES. It never answers.
// ─────────────────────────────────────────────────────────────────────────────────────────────

export interface SurveyStageResult {
  askText: string;
  term: string | null;
  termWhy: string;
  step2: FounderStep2Result;
  step3: FounderStep3Result;
  step4: FounderStep4Result;
  step6: FounderStep6Result;
  /** D-BP151-031. Mirrors step2.negationNamed at the top level -- true only when SURVEY STEP 2's
   *  ambiguity query (no-term path) had the SOURCE itself name a negation/exclusion/restriction
   *  term. Nothing else in the Liana Cycle currently tracks negation on the ASK; see this file's
   *  header, "D-BP151-031 AMENDMENT". Always false on the quoted/cued-term path. */
  askNegated: boolean;
  /** ALWAYS true -- structural guard so a caller cannot mistake this result for a verdict. Survey
   *  never sets a `verdict`/`answer` field anywhere in this file. */
  neverAnswersTheQuestion: true;
  why: string;
}

export interface SurveyStageOpts {
  /** Caller-supplied override for the term steps 2/4 survey -- skips findAskCatalyst() derivation.
   *  Mirrors substitution_search.ts's own `explicitTerm` convention. */
  explicitTerm?: string;
  /** Already-fetched Google blocks for step 6 to report on, each with its KNOWN, caller-declared
   *  query direction (see JarSourceGroup's own ATTRIBUTED comment). Omitted/empty = step 6
   *  reports "not run", never a fabricated result -- it issues no query of its own. */
  jarSourceGroups?: JarSourceGroup[];
  sharedFrame?: RegExp;
  /** Passthrough to founderStep3CategorizeOptions()'s own cost bound -- see that parameter's own
   *  comment. Not a decision rule; unset leaves survey_answers.ts's own default (1) unchanged. */
  maxCatalystWordsPerOption?: number;
  /** D-BP151-032. Passthrough to founderStep2Survey()'s ambiguity-query transport, ALREADY
   *  RESOLVED by the caller (liana_terminal_engine.ts's resolveAmbiguityQueryTransport()) --
   *  ATTRIBUTED, Founder, relayed BP151 addendum: "I want to always run it on google, which should
   *  be the default that can be changed in Mnemosynec at will." Omitted = founderStep2Survey()'s
   *  own default ('google') applies, matching that Founder-ordered polarity. */
  ambiguityQueryTransport?: 'google' | 'gemma';
}

/**
 * THE SURVEY STAGE. Runs Founder steps 2, 3, 4 and 6, IN HIS ORDER, before any elimination stage
 * touches anything. Composes existing elements (see this file's header for the full wiring
 * table) plus the two Founder-ordered decision rules this file itself owns (step 3's grouping
 * model call, step 6's direction-driven elimination), both ATTRIBUTED at their own call site.
 *
 * NOT WIRED INTO liana_terminal_engine.ts's DISPATCH BY THIS TICKET. See this ticket's return,
 * "THINGS I NOTICED AND DID NOT DO", for why splicing this into the shared dispatcher ahead of
 * method selection is its own fork (which term for a free-text question with no quoted/cued term,
 * whether a failed Survey should abstain the whole run or proceed unscoped, and how Survey's own
 * `kind:'stage'` events would interact with stepped_audible.ts's hard `methodId !==
 * 'comparative-cascade'` gate -- a file this ticket may not touch) that this ticket did not
 * receive an order to resolve. This function is complete, tested, and ready to be called by
 * whichever future ticket resolves that wiring decision.
 */
export async function runSurveyStage(
  askText: string,
  options: Record<string, string> | null,
  ctx: MethodRunContext,
  opts: SurveyStageOpts = {},
): Promise<SurveyStageResult> {
  const { emit } = ctx;
  emit({ kind: 'header', text: 'SURVEY -- the Lieutenant: what is this question about, and which way does it point? (steps 2, 3, 4, 6 only; step 11/TERMINATOR is out of scope, owned by D-BP151-024)', ts: nowIso() });

  let term: string | null = null;
  let termWhy: string;
  if (opts.explicitTerm && opts.explicitTerm.trim()) {
    term = opts.explicitTerm.trim();
    termWhy = `caller-supplied explicit term override: "${term}"`;
  } else {
    // WIRED HERE, FIRST LIVE CALLER of elements/catalyst_words.ts's findAskCatalyst() -- dead
    // before this file (only substitution_search.ts, itself dead, called it).
    const catalyst = findAskCatalyst(askText);
    if (catalyst) {
      term = catalyst.term;
      termWhy = `derived via findAskCatalyst() (elements/catalyst_words.ts, wired here for the first time): ${catalyst.why}`;
    } else {
      termWhy = 'findAskCatalyst() found no quoted term and no explains/describes/defines-style cue in the '
        + 'question -- refusing rather than guessing one from the raw question text (refusing beats guessing)';
    }
  }
  emit({ kind: 'note', text: `   term: ${term ? `"${term}"` : '(none -- ' + termWhy + ')'}`, ts: nowIso() });

  // D-BP151-031: askText is now passed through so step 2's no-term path can issue the Founder's
  // ambiguity query instead of only refusing. See founderStep2Survey()'s own comment.
  const step2 = await founderStep2Survey(term, ctx, askText, opts.ambiguityQueryTransport);
  const step3 = await founderStep3CategorizeOptions(options, ctx, opts.sharedFrame, opts.maxCatalystWordsPerOption);
  const step4 = await founderStep4DetermineRegister(term, askText, options, ctx);
  const step6 = await founderStep6JarMethod(opts.jarSourceGroups ?? [], options, ctx);

  const step2Summary = step2.nested
    ? `${step2.nested.levels.length} level(s) surveyed`
    : step2.ambiguityNested.length
      ? `no quoted/cued term -- ambiguity query named ${step2.ambiguity?.terms.length ?? 0} term(s), ${step2.ambiguityNested.length} surveyed, `
        + `${step2.constraints.length} constraint(s) asked (${step2.constraints.filter((c) => c.obtained).length} answered)`
      : 'not run';
  const why = `SURVEY complete -- term ${term ? `"${term}" (${termWhy})` : `unresolved (${termWhy})`}; `
    + `step2: ${step2Summary}; `
    + `step3: ${step3.perOption ? `${step3.perOption.letters.length} option(s) surveyed, ${step3.grouping?.groups.length ?? 0} group(s) proposed` : 'not run'}; `
    + `step4: ${step4.verified ? 'VERIFIED register' : 'unverified/unresolved'}; `
    + `step6: ${step6.named.length} named mention(s), ${step6.eliminatedLetters.length} option(s) eliminated by known query direction`
    + `${step2.negationNamed ? '; ASK NEGATED (source-named, step 2 ambiguity query)' : ''}. `
    + 'SURVEY NEVER ANSWERS THE QUESTION -- step 6\'s elimination narrows the option POOL (Founder-ordered, mechanical), '
    + 'no final verdict letter was ever picked by this stage.';
  emit({ kind: 'result', text: `SURVEY: ${why}`, ts: nowIso() });

  return { askText, term, termWhy, step2, step3, step4, step6, askNegated: step2.negationNamed, neverAnswersTheQuestion: true, why };
}
