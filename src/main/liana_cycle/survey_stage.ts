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
// WHY THE 'GOOGLE' BRANCH DOES NOT TOUCH THE HARDWIRE-22 QUESTION. `askGoogle(query)` returns a
// REAL passage (the Founder measured this himself, running the query on Google by hand -- three
// named terms with standard meaning, alternative meaning, impact, AND A CITATION). Extracting the
// same `{term, standardMeaning, alternativeMeaning, impact, isNegation}` shape OUT OF a real Google
// passage is ordinary extraction -- `gemmaExtract()` answers it UNRELAXED, the same as every other
// Survey element that reads a Google passage (elements/survey_ask.ts, elements/field_gate.ts,
// methods/comparative_cascade.ts).
//
// D-BP152-013 SUPERSEDES THIS SECTION'S ORIGINAL 'GEMMA' BRANCH DESCRIPTION. D-BP151-031 had the
// local model reason directly about the bare question when no term was found, calling it "a named,
// disclosed relaxation" -- but no Founder ruling ever granted that relaxation; it was self-declared.
// ATTRIBUTED: Founder, BP152, verbatim: "strip out the authorization. Gemma will never be good
// enough to make decisions, sadly." (FD-BP152). The `transport === 'gemma'` branch below now
// REFUSES instead of calling the local model -- see askAmbiguity()'s own comment at its call site.
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
//   STEP 2's NO-TERM PATH (D-BP151-031, transport default changed D-BP151-032, gemma branch
//             removed D-BP152-013) -> askAmbiguity() (this file, below; renamed from
//             askAmbiguityViaModel() -- D-BP151-032, the name went wrong the moment Google became
//             the default transport). GOOGLE (askGoogle, the SAME channel every other Survey
//             element already uses) is the ONLY source now: gemmaExtract() (unrelaxed) structures
//             what Google said. The local model reasoning directly (D-BP151-031's original
//             implementation) was removed by Founder ruling FD-BP152 (BP152, verbatim: "strip out
//             the authorization. Gemma will never be good enough to make decisions, sadly.") -- the
//             `transport === 'gemma'` branch now refuses rather than calling the model. See
//             askAmbiguity()'s own comment for both branches.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// HARDWIRE-23 (THE TARE RULE) -- HOW THIS FILE STAYS CLEAN.
//
// This file carries THREE live decision/relaxation/routing rules of its own, each ATTRIBUTED at
// its own call site, per Law 4 -- no other decision rule (threshold, cutoff, ratio, tie-break,
// word list) exists anywhere in this file:
//   1. groupOptionsByPredicate()'s model call (step 3) -- HARDWIRE-22 relaxed, Founder-ordered,
//      scoped to this one call only. ATTRIBUTED: Founder, BP151, verbatim: "Grouping requires a
//      model call - like ALL judgements, and yes, relaxed for this one purpose."
//   2. founderStep6JarMethod()'s direction-driven elimination (step 6) -- mechanical, driven by a
//      caller-declared query direction, never a word list or a model judgment.
//   3. askAmbiguity()'s (and askOperation()'s, and askConstraint()'s) transport default -- Google
//      unless the caller (ultimately liana_terminal_engine.ts's resolveAmbiguityQueryTransport())
//      selects 'gemma', ATTRIBUTED: Founder, relayed BP151 addendum, "I want to always run it on
//      google, which should be the default that can be changed in Mnemosynec at will." Unreachable
//      Google refuses; it never silently substitutes the other transport (that would itself be an
//      unattributed tare).
//
// D-BP152-013 REMOVAL -- THREE FORMER "RELAXATIONS" WERE NEVER FOUNDER-GRANTED, AND ARE GONE.
// Earlier passes of this file (D-BP151-031, D-BP151-035, D-BP152-005) each added a `transport ===
// 'gemma'` branch to askAmbiguity(), askConstraint(), and askOperation() respectively, calling
// each one a "named HARDWIRE-22 relaxation." No Founder ruling ever granted any of the three --
// each one's own comment either self-declared the relaxation (askAmbiguity()) or borrowed it from
// another branch by resemblance (askConstraint(), askOperation()), and askOperation()'s citation
// (`FD-BP152-05`) authorized the QUESTION TEXT being asked, not gemma reasoning freely in place of
// extraction. ATTRIBUTED: Founder, BP152, verbatim: "strip out the authorization. Gemma will never
// be good enough to make decisions, sadly." (FD-BP152). All three `transport === 'gemma'` branches
// now REFUSE, naming HARDWIRE-22, and issue no model call -- see each function's own comment at its
// call site. The `'google'` branch of all three is UNCHANGED: `googleBlocks()` supplies a real
// passage and `gemmaExtract()` (unrelaxed) structures it, ordinary extraction, same as every other
// Survey element that reads a Google passage. The `transport` parameter and
// `resolveAmbiguityQueryTransport()`/`AMBIGUITY_QUERY_TRANSPORT` selector are UNCHANGED -- selecting
// 'gemma' now yields an honest refusal instead of a violation.
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
// D-BP152-032, STAGE 1. Pure generator, no I/O -- derives the Founder's two method-question shapes
// (FD-BP152-03) from Part 1's own named terms plus the question text. This file's own
// askThreshold(), below, is the only caller that ISSUES what it generates; the generator itself
// decides no wording beyond what elements/method_question_generator.ts's own header documents.
import { generateMethodQuestions, type GeneratedMethodQuestion } from './elements/method_question_generator';
// D-BP152-009. IMPORTED, NOT REWRITTEN -- reused ONLY to gate SURVEY STEP 3 (see
// runSurveyStage()'s own comment at its call site, below). demand_test.ts is not modified by this
// ticket; this is the SAME function liana_terminal_engine.ts already calls on
// `surveyResult.step2.operation.rawAnswer` to compute its own `DEMAND PATH: operation` line, so
// the gate here and that transcript line can never disagree about what "resolved" means.
import { determineDemandFromOperationAnswer } from './demand_test';

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
  /** D-BP152-044, ADDITIVE/OPTIONAL (kept optional, not required, specifically so a literal object
   *  built before this field existed -- e.g. library/survey_script.test.ts's own fixtures, a file
   *  this ticket's own FORBIDDEN list bars touching -- keeps type-checking with no edit there).
   *  Which surface actually produced the passage this call structured -- 'google', or the
   *  conversational authority's own BrowserAuthorityName (e.g. 'user_gemini') when
   *  `ctx.askConversationalAuthority` answered instead. Undefined/null when nothing answered
   *  (modelUnreachable) or on the 'gemma' transport (which asks no source at all). Law 5,
   *  HARDWIRE-23: `transport` (above) is the outer 'google'|'gemma' SELECTOR, unchanged semantics;
   *  this is the actual surface behind it -- see obtainMetaQuestionPassage()'s own header. Every
   *  return statement THIS FILE's own askAmbiguity()/askOperation() produce still sets it
   *  explicitly (never left implicitly undefined) -- optionality is for OTHER files' older
   *  fixtures, not a license to omit it here. */
  answeredByAuthority?: string | null;
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
  /** D-BP152-032, STAGE 1. One THRESHOLD question (FD-BP152-03's Q2 shape) per Part-1-named term
   *  whose text verified as a literal span of the question -- machine-GENERATED by
   *  elements/method_question_generator.ts's generateThresholdQuestion() and issued by this
   *  file's askThreshold(), immediately below `constraints` (Q1/SCALE_DEFINITION) in the same
   *  per-term loop. Same SurveyConstraint shape as `constraints` -- SURVEY ASKS, IT NEVER APPLIES,
   *  same rule, same convention. Empty when `ambiguity` is null, named nothing usable, or no named
   *  term verified as a literal span (refused, not guessed -- see the generator's own refusals,
   *  emitted as their own transcript lines, not surfaced on this result). */
  thresholdQuestions: SurveyConstraint[];
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
 * D-BP152-044/BISHOP/seg-last-mile-gemini. ATTRIBUTED: Founder, BP152, verbatim ruling: "fix the
 * last mile - let the liana cycle ask gemini". THE MEASURED WALL THIS CLOSES: qid 98's ambiguity
 * query went to Google and came back an off-topic passage ("Desertification in Sub-Saharan
 * Africa... The Sahel", HARDWIRE\LEDGER\LIANA_RUNS\LIANA_RUN_qid98_2026-08-11T18-09-09-616Z.json)
 * because a search index cannot answer a question ABOUT a question -- Google is a document
 * lookup, not a source that can reason over the Founder's own two META-questions (askAmbiguity()'s
 * "what words or phrases..." and askOperation()'s "what operation does this question require...").
 * The Founder proved by hand that Gemini answers it correctly (D-BP152-025's own capture).
 *
 * SHARED BY askAmbiguity() AND askOperation() ONLY -- no other Survey element calls this (askConstraint()
 * and askThreshold(), immediately below in this file, keep going straight to `googleBlocks(ctx.askGoogle, ...)`
 * unchanged -- they are document lookups, not META-questions ABOUT the question, and this ticket's own
 * dispatch is explicit: "ONLY those two"). Both callers send the FOUNDER'S OWN QUESTION TEXT VERBATIM
 * to whichever surface answers -- HARDWIRE-22 still binds: this is a source being asked his question,
 * exactly as his browser was; no rating, no judging, no deciding is ever asked of either surface here.
 *
 * TRIES `ctx.askConversationalAuthority` FIRST -- the machine-driven Nexus path (D-BP152-033's
 * `runMachineDrivenNexusQueryFromMain`, index.ts), injected exactly as `ctx.askGoogle` already is,
 * so this file never imports nexus_authority_persistent_session.ts or index.ts directly (the
 * "never a second automation route" rule is structural, not caller discipline). `ctx.
 * askConversationalAuthority` is undefined for every caller that does not wire it (every
 * pre-existing MethodRunContext construction site, e.g. library/script_bridge.ts's Composer path)
 * -- on that path this function goes straight to Google, BYTE-IDENTICAL to what askAmbiguity()/
 * askOperation() did before this ticket.
 *
 * ANY non-ok conversational result -- window not open, operator visibly using it, ceiling reached
 * with no text, any other refusal/failure (runMachineDrivenNexusQuery()'s own full vocabulary,
 * never re-interpreted here) -- falls back to the EXISTING `googleBlocks(ctx.askGoogle, query)`
 * call, UNCHANGED: never hangs the run, never hijacks a window the operator is looking at (the
 * engagement guard lives inside the injected function itself, D-BP152-033, reused unmodified).
 * THREADS NEVER CROSS AUTHORITIES: the injected `ctx.askConversationalAuthority` closure (built in
 * index.ts) derives its own thread fields from the SAME per-run `NexusRunThreadContext`
 * (D-BP152-031) `askGoogle`'s own 'user_google' calls already use -- keyed by authority inside
 * that factory's own Map, so Gemini's thread and Google's calls can never share an identity even
 * though they answer the same run.
 *
 * Law 5 (HARDWIRE-23): every attempt and its outcome is its own PARSER INSTRUMENT line -- the SAME
 * labeled-note convention this file's own D-BP152-004/007 instruments already established for the
 * Google-only path, extended here (not replaced) so a reader can always see which surface actually
 * answered a given meta-question. */
async function obtainMetaQuestionPassage(
  ctx: MethodRunContext,
  label: 'ambiguity' | 'operation',
  query: string,
): Promise<{ ok: boolean; text: string; via: string; sources: string[]; answeredBy: string }> {
  if (ctx.askConversationalAuthority) {
    ctx.emit({
      kind: 'note',
      text: `   PARSER INSTRUMENT [${label}] query SENT to conversational authority (D-BP152-044, `
        + `machine-driven Nexus, D-BP152-033) (untruncated, verbatim)="${query}"`,
      ts: nowIso(),
    });
    const convo = await ctx.askConversationalAuthority(query);
    if (convo.ok && convo.text.trim()) {
      ctx.emit({
        kind: 'note',
        text: `   PARSER INSTRUMENT [${label}] ANSWERED BY: ${convo.authority} (${convo.via}) -- a `
          + 'conversational authority, not Google web search',
        ts: nowIso(),
      });
      return { ok: true, text: convo.text, via: convo.via, sources: convo.citations, answeredBy: convo.authority };
    }
    ctx.emit({
      kind: 'note',
      text: `   PARSER INSTRUMENT [${label}] conversational authority UNAVAILABLE (${convo.via}) -- `
        + 'falling back to Google (this ticket\'s own fallback rule: never hijack the operator\'s '
        + 'window, never hang the run)',
      ts: nowIso(),
    });
  }
  ctx.emit({
    kind: 'note',
    text: `   PARSER INSTRUMENT [${label}] query SENT to Google (untruncated, verbatim)="${query}"`,
    ts: nowIso(),
  });
  const google = await googleBlocks(ctx.askGoogle, query);
  return {
    ok: google.ok && !!google.text.trim(),
    text: google.text,
    via: google.via,
    sources: google.sources,
    answeredBy: 'google',
  };
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
 * 'gemma' -- D-BP152-013 REMOVAL: D-BP151-031's original implementation had the local model reason
 * directly about the bare question text (no passage existed to extract from), calling it "a named,
 * disclosed relaxation." No Founder ruling ever granted it. ATTRIBUTED: Founder, BP152, verbatim:
 * "strip out the authorization. Gemma will never be good enough to make decisions, sadly."
 * (FD-BP152). Selecting this transport now REFUSES -- no model call is made, and the refusal names
 * HARDWIRE-22 in the transcript. It does not fall back to 'google'.
 *
 * THE SOURCE NAMES THE TERMS; THIS FUNCTION PICKS NONE OF THEM. Every term Google's passage states
 * is reported verbatim (standard meaning, alternative meaning, impact); founderStep2Survey() decides
 * how many to survey next (all of them, source order -- see its own comment), never this function.
 * `isNegation` is asked OF THE SOURCE per term, not matched against a word list here.
 */
// D-BP152-042. EXPORTED (was module-private) so this primitive can be given its own NameNumbered
// identity (library/survey_steps.ts, `AmbiguityQuery:1`) and be individually referenceable --
// Founder, BP152, verbatim (FD-BP152-20): "I want to use it to stack methods in whatever order I
// want... just want them NameNumbered... so that I can mix and match as I please." This export
// keyword is the ONLY change made here: no line inside this function's body is touched, no
// behavior changes -- see this file's own D-BP152-042 SEG return for the byte-identical proof.
export async function askAmbiguity(askText: string, ctx: MethodRunContext, transport: 'google' | 'gemma' = 'google'): Promise<AmbiguityQueryResult> {
  // D-BP152-008. Query text moved to resources/liana_survey_queries.json (id
  // "survey.ambiguity.askedText") -- no placeholders, so this is the exact static sentence, read
  // fresh on every call. Throws (never guesses) if the file/id is missing.
  const askedText = getQueryText('survey.ambiguity.askedText');

  if (transport === 'gemma') {
    // D-BP152-013 REMOVAL. This branch used to ask gemma to reason directly about the bare
    // question text (no passage existed to extract from) -- exactly the judgment HARDWIRE-22
    // forbids. No Founder ruling ever authorized that; it was a self-declared "named HARDWIRE-22
    // relaxation" this file's own header claimed without a matching order. ATTRIBUTED: Founder,
    // BP152, verbatim: "strip out the authorization. Gemma will never be good enough to make
    // decisions, sadly." (FD-BP152). This now REFUSES instead of calling the model -- no fetch to
    // OLLAMA_API_BASE happens on this branch anymore -- and does NOT fall back to Google (a silent
    // transport swap is its own unattributed tare, same rule askAmbiguity()'s 'google' branch
    // already follows for an unreachable Google).
    const why = 'REFUSED: HARDWIRE-22 ("a local model may only be asked to COPY OUT what is literally '
      + 'present in a text it was given") forbids this call -- there is no passage here, only a bare '
      + 'question to reason about, which is judgment, not extraction. Founder ruling FD-BP152 (BP152, '
      + 'verbatim: "strip out the authorization. Gemma will never be good enough to make decisions, '
      + 'sadly.") removed the relaxation this branch previously relied on; no Founder ruling ever '
      + 'granted it. No model call was made, and this does not fall back to Google.';
    ctx.emit({ kind: 'note', text: `   [transport: GEMMA] ${why}`, ts: nowIso() });
    return { askedText, terms: [], modelUnreachable: false, transport: 'gemma', citations: [], rawGooglePassage: '', rawModelOutput: null, answeredByAuthority: null, why };
  }

  // transport === 'google' (the Founder-ordered default). D-BP152-044: for THIS query only (one of
  // the Founder's own two META-questions), obtainMetaQuestionPassage() tries the conversational
  // authority first (Gemini, via the machine-driven Nexus path, D-BP152-033) and falls back to
  // Google -- see that function's own header for the full ruling and the fallback rule. Once a
  // passage is in hand (from whichever surface answered), the rest of this branch is UNCHANGED:
  // gemmaExtract() (unrelaxed) STRUCTURES what the surface actually said; this function decides
  // nothing about which terms matter.
  const query = `${askText}\n\n${askedText}`;
  const passage = await obtainMetaQuestionPassage(ctx, 'ambiguity', query);
  if (!passage.ok) {
    return {
      askedText,
      terms: [],
      modelUnreachable: true,
      transport: 'google',
      citations: [],
      rawGooglePassage: '',
      rawModelOutput: null,
      answeredByAuthority: null,
      why: `No source was reachable for the ambiguity query (${passage.via}) -- refusing rather than `
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
  // no trace anywhere on disk. D-BP152-044: labeled with WHICH surface (`passage.answeredBy`,
  // 'google' or a conversational authority's BrowserAuthorityName) produced it, not hardcoded to
  // "Google" anymore.
  const googlePassageForLog = passage.text.length > 4000 ? passage.text.slice(0, 4000) : passage.text;
  ctx.emit({
    kind: 'note',
    text: `   PARSER INSTRUMENT [ambiguity] ${passage.answeredBy} passage handed to gemmaExtract()`
      + `${passage.text.length > 4000 ? ` (TRUNCATED at 4000 chars, full untruncated length was ${passage.text.length})` : ' (untruncated, verbatim)'}`
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
  const ex = await gemmaExtract(instruction, passage.text, shape, rawOut);
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
    ? `${terms.length} term(s) named by ${passage.answeredBy}'s own answer (${passage.via}) as potentially `
      + 'ambiguous, extracted verbatim by gemmaExtract() (extraction only, HARDWIRE-22 unrelaxed) -- the '
      + 'source names, this function picks none'
    : `${passage.answeredBy} answered (${passage.via}) but nothing usable could be extracted from it -- an `
      + 'honest empty result, not a fabrication';
  return {
    askedText,
    terms,
    modelUnreachable: false,
    transport: 'google',
    citations: passage.sources,
    rawGooglePassage: passage.text,
    rawModelOutput: ex === null ? (rawOut.text ?? null) : null,
    answeredByAuthority: passage.answeredBy,
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
  /** D-BP152-044, ADDITIVE/OPTIONAL, same convention (and same reason it is optional, not
   *  required) as AmbiguityQueryResult.answeredByAuthority above -- 'google', or the
   *  conversational authority's own BrowserAuthorityName (e.g. 'user_gemini') when
   *  `ctx.askConversationalAuthority` answered instead. Undefined/null when nothing answered or on
   *  the 'gemma' transport. */
  answeredByAuthority?: string | null;
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
 * 'gemma' -- D-BP152-013 REMOVAL: this branch used to have the local model reason about the
 * question directly, calling it "the SAME named HARDWIRE-22 relaxation `askAmbiguity()`'s own
 * 'gemma' branch already uses." That borrowed relaxation was itself never Founder-granted --
 * `FD-BP152-05` (quoted above) authorizes the QUESTION TEXT this function sends, not gemma
 * reasoning freely in place of extraction. ATTRIBUTED: Founder, BP152, verbatim: "strip out the
 * authorization. Gemma will never be good enough to make decisions, sadly." (FD-BP152). Selecting
 * this transport now REFUSES -- no model call is made. Google unreachable -> refuses; never
 * silently falls back to 'gemma' (same rule as Part 1); 'gemma' never silently falls back to
 * 'google' either.
 */
// D-BP152-042. EXPORTED (was module-private) so this primitive can be given its own NameNumbered
// identity (library/survey_steps.ts, `OperationQuery:1`) and be individually referenceable -- same
// rationale and same ONE-LINE-ONLY change as askAmbiguity()'s own export, immediately above.
export async function askOperation(askText: string, ctx: MethodRunContext, transport: 'google' | 'gemma' = 'google'): Promise<OperationQueryResult> {
  // D-BP152-008. Query text moved to resources/liana_survey_queries.json (id
  // "survey.operation.askedText") -- no placeholders, read fresh on every call.
  const askedText = getQueryText('survey.operation.askedText');

  if (transport === 'gemma') {
    // D-BP152-013 REMOVAL. Same shape as askAmbiguity()'s own removal, above -- this branch used
    // to ask gemma to reason directly about the bare question text, a "named HARDWIRE-22
    // relaxation" no Founder ruling ever granted (the ATTRIBUTED quote this file cited for it,
    // FD-BP152-05, authorizes the QUESTION being asked, not gemma reasoning freely in place of
    // extraction). ATTRIBUTED: Founder, BP152, verbatim: "strip out the authorization. Gemma will
    // never be good enough to make decisions, sadly." (FD-BP152). No fetch to OLLAMA_API_BASE
    // happens on this branch anymore, and it does NOT fall back to Google.
    const why = 'REFUSED: HARDWIRE-22 ("a local model may only be asked to COPY OUT what is literally '
      + 'present in a text it was given") forbids this call -- there is no passage here, only a bare '
      + 'question to reason about, which is judgment, not extraction. Founder ruling FD-BP152 (BP152, '
      + 'verbatim: "strip out the authorization. Gemma will never be good enough to make decisions, '
      + 'sadly.") removed the relaxation this branch previously relied on; no Founder ruling ever '
      + 'granted it. No model call was made, and this does not fall back to Google.';
    ctx.emit({ kind: 'note', text: `   [transport: GEMMA] ${why}`, ts: nowIso() });
    return { askedText, rawAnswer: null, modelUnreachable: false, transport: 'gemma', citations: [], rawGooglePassage: '', rawModelOutput: null, answeredByAuthority: null, why };
  }

  // transport === 'google' (the Founder-ordered default, REUSED from Part 1's already-resolved
  // value). D-BP152-044: same obtainMetaQuestionPassage() helper askAmbiguity() now uses -- tries
  // the conversational authority first (Gemini), falls back to Google. Same shape as askAmbiguity()'s
  // own 'google' branch otherwise.
  const query = `${askText}\n\n${askedText}`;
  const passage = await obtainMetaQuestionPassage(ctx, 'operation', query);
  if (!passage.ok) {
    return {
      askedText,
      rawAnswer: null,
      modelUnreachable: true,
      transport: 'google',
      citations: [],
      rawGooglePassage: '',
      rawModelOutput: null,
      answeredByAuthority: null,
      why: `No source was reachable for the operation query (${passage.via}) -- refusing rather than `
        + 'silently falling back to the local model (same rule as askAmbiguity()); an honest empty '
        + 'result, not a fabrication',
    };
  }
  // D-BP152-005, same INSTRUMENT ONLY convention D-BP152-004 established for askAmbiguity() --
  // built here, not duplicated from there, for this second call site. D-BP152-044: labeled with
  // WHICH surface produced it, same as askAmbiguity()'s own copy.
  const googlePassageForLog = passage.text.length > 4000 ? passage.text.slice(0, 4000) : passage.text;
  ctx.emit({
    kind: 'note',
    text: `   PARSER INSTRUMENT [operation] ${passage.answeredBy} passage handed to gemmaExtract()`
      + `${passage.text.length > 4000 ? ` (TRUNCATED at 4000 chars, full untruncated length was ${passage.text.length})` : ' (untruncated, verbatim)'}`
      + `="${googlePassageForLog}"`,
    ts: nowIso(),
  });
  const instruction = 'Report, verbatim, what the passage states as the single operation this question\'s '
    + 'answer must perform -- ranked, defined, classified, or inferred from evidence. Copy the stated '
    + 'operation exactly as the passage gives it -- do not summarize, infer, or add anything the passage '
    + 'does not state.';
  const shape = '{"answer":"the operation exactly as the passage states it, or empty string if the passage does not state one"}';
  const rawOut: { text?: string } = {};
  const ex = await gemmaExtract(instruction, passage.text, shape, rawOut);
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
    ? `answered by ${passage.answeredBy}'s own passage (${passage.via}); gemmaExtract() (extraction only, HARDWIRE-22 unrelaxed) reported the stated operation verbatim: "${rawAnswer}"`
    : `${passage.answeredBy} answered (${passage.via}) but nothing usable could be extracted from it -- an honest empty result, not a fabrication`;
  return {
    askedText,
    rawAnswer,
    modelUnreachable: false,
    transport: 'google',
    citations: rawAnswer ? passage.sources : [],
    rawGooglePassage: passage.text,
    rawModelOutput: ex === null ? (rawOut.text ?? null) : null,
    answeredByAuthority: passage.answeredBy,
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
 * 'google' branch).
 *
 * 'gemma' -- D-BP152-013 REMOVAL: this branch used to have the local model reason about the
 * question directly, calling it "the SAME named HARDWIRE-22 relaxation askAmbiguity()'s 'gemma'
 * branch already uses" -- a relaxation borrowed by resemblance, never itself Founder-granted.
 * ATTRIBUTED: Founder, BP152, verbatim: "strip out the authorization. Gemma will never be good
 * enough to make decisions, sadly." (FD-BP152). Selecting this transport now REFUSES -- no model
 * call is made. Google unreachable -> refuses; it never silently falls back to 'gemma' (same rule,
 * same ATTRIBUTION, as askAmbiguity()); 'gemma' never silently falls back to 'google' either.
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
    // D-BP152-013 REMOVAL. Same shape as askAmbiguity()'s and askOperation()'s own removals --
    // this branch's own header called it "the SAME named HARDWIRE-22 relaxation askAmbiguity()'s
    // 'gemma' branch already uses," which makes explicit that it borrowed a relaxation no Founder
    // ruling ever granted, rather than carrying one of its own. ATTRIBUTED: Founder, BP152,
    // verbatim: "strip out the authorization. Gemma will never be good enough to make decisions,
    // sadly." (FD-BP152). No fetch to OLLAMA_API_BASE happens on this branch anymore, and it does
    // NOT fall back to Google.
    const why = 'REFUSED: HARDWIRE-22 ("a local model may only be asked to COPY OUT what is literally '
      + 'present in a text it was given") forbids this call -- there is no passage here, only a bare '
      + 'question to reason about, which is judgment, not extraction. Founder ruling FD-BP152 (BP152, '
      + 'verbatim: "strip out the authorization. Gemma will never be good enough to make decisions, '
      + 'sadly.") removed the relaxation this branch previously relied on; no Founder ruling ever '
      + 'granted it. No model call was made, and this does not fall back to Google.';
    ctx.emit({ kind: 'note', text: `   [transport: GEMMA] ${why}`, ts: nowIso() });
    return { term, question, answer: null, citations: [], obtained: false, why };
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
      // D-BP152-050: "unreachable" removed -- google.via (comparative_cascade.ts's googleBlocks(),
      // same ticket) now names the real reason (a structural verification/rate-limit challenge,
      // window/session unavailable, a network timeout, or a genuinely empty page), which is not
      // always "unreachable" -- a challenge means Google answered and refused.
      why: `Google query failed for this constraint question (${google.via}) -- refusing rather than `
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
 * D-BP152-032, STAGE 1. Issues a MACHINE-GENERATED THRESHOLD question (FD-BP152-03's Q2 shape,
 * elements/method_question_generator.ts's generateThresholdQuestion()) through the SAME transport
 * askConstraint() (immediately above) already uses -- googleBlocks() then gemmaExtract()
 * (extraction only, HARDWIRE-22 unrelaxed). Mirrors askConstraint()'s own shape exactly, this
 * file's own established convention (see askOperation()'s and askConstraint()'s own headers: each
 * new "ask" function is a full sibling, not a shared abstraction, so any one of them can be read
 * and audited alone).
 *
 * TAKES AN ALREADY-GENERATED QUESTION, UNLIKE askConstraint(). generateThresholdQuestion() (pure,
 * no I/O, called from founderStep2Survey() below) already verified the subject is a literal span
 * of the question text and already built the exact question text via getQueryText() -- this
 * function only ISSUES it and reports what came back. Nothing here re-derives the subject or
 * re-decides the wording.
 *
 * MACHINE-GENERATED, LABELED AS SUCH IN THE TRANSCRIPT. Every emitted line and the returned `why`
 * carry the tag below, so a transcript reader can tell this question was generated by the machine
 * from Part 1/Part 2's own answers, never typed by the operator -- this ticket's own requirement.
 *
 * 'gemma' REFUSES, same rule and same ATTRIBUTION as askConstraint()'s own 'gemma' branch (FD-BP152,
 * verbatim: "strip out the authorization. Gemma will never be good enough to make decisions,
 * sadly."). Google unreachable -> refuses; never silently falls back to the other transport.
 */
async function askThreshold(
  generated: GeneratedMethodQuestion,
  ctx: MethodRunContext,
  transport: 'google' | 'gemma',
): Promise<SurveyConstraint> {
  const question = generated.questionText;
  const tag = '[MACHINE-GENERATED, THRESHOLD shape, FD-BP152-03]';

  if (transport === 'gemma') {
    const why = `${tag} REFUSED: HARDWIRE-22 ("a local model may only be asked to COPY OUT what is `
      + 'literally present in a text it was given") forbids this call -- there is no passage here, '
      + 'only a bare question to reason about, which is judgment, not extraction. Same rule as '
      + 'askConstraint()\'s own \'gemma\' branch (FD-BP152, verbatim: "strip out the authorization. '
      + 'Gemma will never be good enough to make decisions, sadly."). No model call was made, and '
      + 'this does not fall back to Google.';
    ctx.emit({ kind: 'note', text: `   [transport: GEMMA] ${why}`, ts: nowIso() });
    return { term: generated.term, question, answer: null, citations: [], obtained: false, why };
  }

  // transport === 'google' (the Founder-ordered default, REUSED from the already-resolved value --
  // not a second transport path). Same shape as askConstraint()'s own 'google' branch.
  ctx.emit({
    kind: 'note',
    text: `   PARSER INSTRUMENT [threshold] ${tag} query SENT to Google (untruncated, verbatim)="${question}"`,
    ts: nowIso(),
  });
  const google = await googleBlocks(ctx.askGoogle, question);
  if (!google.ok || !google.text.trim()) {
    return {
      term: generated.term,
      question,
      answer: null,
      citations: [],
      obtained: false,
      // D-BP152-050: "unreachable" removed -- same reasoning as askConstraint()'s own why-string,
      // above; google.via now names the real reason instead of a blanket claim of unreachability.
      why: `${tag} Google query failed for this threshold question (${google.via}) -- refusing `
        + 'rather than silently falling back to the local model (same rule as askConstraint()); an '
        + 'honest null, not a fabrication',
    };
  }
  const instruction = 'Report, verbatim, what the passage states as the specific threshold being used '
    + 'to answer this constraint question. Copy the stated threshold exactly as the passage gives it -- '
    + 'do not summarize, infer, or add anything the passage does not state.';
  const shape = '{"answer":"the threshold exactly as the passage states it, or empty string if the passage does not state one"}';
  const ex = await gemmaExtract(instruction, google.text, shape);
  const answer = typeof (ex as { answer?: unknown } | null)?.answer === 'string' ? (ex as { answer: string }).answer.trim() : '';
  const obtained = !!answer;
  return {
    term: generated.term,
    question,
    answer: obtained ? answer : null,
    citations: obtained ? google.sources : [],
    obtained,
    why: obtained
      ? `${tag} answered by Google's own passage (${google.via}); gemmaExtract() (extraction only, `
        + 'HARDWIRE-22 unrelaxed) reported the stated threshold verbatim'
      : `${tag} Google answered (${google.via}) but nothing usable could be extracted from it -- an `
        + 'honest null, not a fabrication',
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
      return { term: null, nested: null, ambiguity: null, ambiguityNested: [], negationNamed: false, constraints: [], operation: null, thresholdQuestions: [], why: whyNoTerm };
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
      return { term: null, nested: null, ambiguity, ambiguityNested: [], negationNamed: false, constraints: [], operation, thresholdQuestions: [], why };
    }

    // D-BP152-039/BISHOP/seg-gate-removal-and-sigfigs, STAGE 2 -- SIG FIGS ON THE AMBIGUITY STEP.
    // ATTRIBUTED: Founder, BP152, verbatim (FD-BP152-20): "We need to apply the sigfigs principal
    // to the ambiguity and survey steps. It isn't necessary to define every term, just terms whose
    // different meaning might change the nature or purpose of the question or answer."
    //
    // THE FILTER IS EXTRACTION, NOT JUDGMENT (HARDWIRE-22, FD-BP152-20's own words: "The SOURCE
    // states the impact; the code reads it. NO MODEL DECIDES WHAT MATTERS."). askAmbiguity()'s own
    // prompt already asks the source for standardMeaning, alternativeMeaning, AND impact per term;
    // parseAmbiguityTerms() (above) already parses `impact` onto every AmbiguityTermFinding. A term
    // whose returned `impact` is non-empty SURVIVES into the three per-term Google calls below (the
    // nested survey, the SCALE_DEFINITION constraint, the THRESHOLD question); a term with an
    // absent or empty `impact` is DROPPED before any of those three calls is issued for it -- an
    // absent/empty impact IS "no stated impact", never inferred or guessed at. No model is asked to
    // rate relevance or importance and no word list is consulted anywhere in this filter.
    //
    // MEASURED WASTE THIS ANSWERS: qid 98's Step 3 (the per-option denotation sweep, gated
    // separately below, UNCHANGED by this filter -- see D-BP152-009's own comment at that gate)
    // spent 18 Google queries (9 options x 2) producing groups that contributed nothing to the
    // verdict, while the term that mattered went unresolved (FD-BP152-01/FD-BP152-20). Applying the
    // same discipline HERE keeps a source-named term's per-query cost (up to 3 further Google calls
    // below) from being paid when the source itself never said that term's alternative reading
    // changes the question's or answer's nature or purpose.
    //
    // LAW 5 (HARDWIRE-23): kept-vs-dropped is logged every run, and every drop carries its reason.
    const sigFigsKeptTerms: AmbiguityTermFinding[] = [];
    const sigFigsDroppedTerms: AmbiguityTermFinding[] = [];
    for (const t of ambiguity.terms) {
      if (t.impact && t.impact.trim().length > 0) {
        sigFigsKeptTerms.push(t);
      } else {
        sigFigsDroppedTerms.push(t);
      }
    }
    for (const t of sigFigsDroppedTerms) {
      emit({
        kind: 'note',
        text: `   SIG FIGS [ambiguity, FD-BP152-20] DROPPED "${t.term}" -- no stated impact `
          + `(standardMeaning=${JSON.stringify(t.standardMeaning)}, alternativeMeaning=`
          + `${JSON.stringify(t.alternativeMeaning)}, impact=${JSON.stringify(t.impact)}); the source `
          + 'never stated that this term\'s alternative reading changes the nature or purpose of the '
          + 'question or answer, so it is not surveyed further',
        ts: nowIso(),
      });
    }
    emit({
      kind: 'note',
      text: `   SIG FIGS [ambiguity, FD-BP152-20] kept ${sigFigsKeptTerms.length} of ${ambiguity.terms.length} `
        + `term(s) with a stated impact, dropped ${sigFigsDroppedTerms.length} with no stated impact -- `
        + 'only kept terms proceed to the nested survey / constraint / threshold questions below',
      ts: nowIso(),
    });

    // THE SOURCE NAMES THE TERMS; THIS SURVEYS EVERY KEPT ONE, IN THE ORDER THE SOURCE RETURNED
    // THEM. No ranking or picking rule was invented among source-named terms -- the Founder's own
    // order allowed either "survey all named terms" or "survey them in the order the source gave";
    // this ticket does both at once, since they coincide when nothing is dropped BY ORDER (sig figs
    // above drops by stated impact, a separate, ATTRIBUTED filter -- not a ranking or pick).
    const ambiguityNested: Array<{ term: string; nested: SurveyAskNestedResult }> = [];
    for (const t of sigFigsKeptTerms) {
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
    // is still essential." One constraint question per KEPT source-named term (sig figs, above),
    // askConstraint()'s own form-1 (definition/scale) template only -- see that function's own
    // header for the form-2 fork stopped on. SURVEY ASKS; IT NEVER APPLIES -- nothing below judges,
    // ranks, or eliminates with a constraint's answer.
    const constraints: SurveyConstraint[] = [];
    for (const t of sigFigsKeptTerms) {
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

    // D-BP152-032, STAGE 1. "Take those [Part 1/Part 2] answers and generate the SPECIFIC method
    // questions, then ask them" (this ticket's own mandate). Q1/SCALE_DEFINITION is what the
    // constraints loop immediately above already does (askConstraint(), D-BP151-035) -- it is not
    // re-generated or re-asked here. Q2/THRESHOLD is what was named "a stopped fork, not built" in
    // this same file's D-BP151-035 header; this closes it. generateMethodQuestions() (pure, no I/O)
    // verifies every subject is a literal span of the question text and refuses, per-term, rather
    // than guessing one that is not -- every refusal is emitted below, never silently dropped. Fed
    // KEPT terms only (sig figs, above) -- a dropped term gets no threshold question either.
    const methodQuestionGen = generateMethodQuestions(sigFigsKeptTerms, askText, operation.rawAnswer);
    for (const r of methodQuestionGen.refusals) {
      emit({
        kind: 'note',
        text: `   METHOD QUESTION NOT GENERATED [MACHINE-GENERATED attempt, ${r.shape}] for "${r.term}" -- ${r.why}`,
        ts: nowIso(),
      });
    }
    const thresholdQuestions: SurveyConstraint[] = [];
    for (const gen of methodQuestionGen.questions) {
      // Q1/SCALE_DEFINITION is askConstraint()'s job, above -- skip here so it is asked exactly
      // once, not twice, per named term.
      if (gen.shape !== 'THRESHOLD') continue;
      // eslint-disable-next-line no-await-in-loop -- one threshold question per named term,
      // sequential by design, same pattern as the constraints loop immediately above.
      const thresholdResult = await askThreshold(gen, ctx, ambiguityQueryTransport);
      thresholdQuestions.push(thresholdResult);
      // Law 5, HARDWIRE-23: the receipt (this transcript) shows each generated threshold
      // question, its subject, its answer, and its source, tagged MACHINE-GENERATED so a reader
      // never confuses it for an operator-typed question (this ticket's own requirement).
      emit({
        kind: 'note',
        text: `   THRESHOLD QUESTION [MACHINE-GENERATED, subject "${gen.subject}", FD-BP152-03] for `
          + `"${gen.term}": "${thresholdResult.question}" -> `
          + `${thresholdResult.obtained ? `"${thresholdResult.answer}"` : 'null (unobtained -- honest, not fabricated)'}`
          + `${thresholdResult.citations.length ? ` [source: ${thresholdResult.citations.join(', ')}]` : ' [no source]'}`,
        ts: nowIso(),
      });
    }
    const thresholdObtainedCount = thresholdQuestions.filter((c) => c.obtained).length;

    const why = `no quoted/cued term -- issued the Founder's ambiguity query instead, via ${ambiguity.transport.toUpperCase()}; `
      + `${ambiguity.terms.length} term(s) named by the source ("${ambiguity.terms.map((t) => t.term).join('", "')}"), `
      + `${sigFigsKeptTerms.length} surveyed further (FD-BP152-20 sig figs: stated impact, source order, no ranking rule `
      + `invented among kept terms), ${sigFigsDroppedTerms.length} dropped (no stated impact)`
      + `${negationNamed ? '; NEGATION NAMED by the source' : ''}; `
      + `${constraints.length} constraint question(s) [MACHINE-GENERATED, SCALE_DEFINITION shape, FD-BP152-03] `
      + `asked (form-1/definition-scale template), ${obtainedCount} answered; `
      + `${thresholdQuestions.length} threshold question(s) [MACHINE-GENERATED, THRESHOLD shape, FD-BP152-03] `
      + `asked (Stage 1, D-BP152-032, closes the form-2 stopped fork this file's D-BP151-035 header left open), `
      + `${thresholdObtainedCount} answered; ${methodQuestionGen.refusals.length} method question(s) refused `
      + '(refusing beats guessing)';
    emit({
      kind: 'result',
      text: `SURVEY STEP 2: no quoted/cued term -- ${ambiguity.terms.length} term(s) named by the ambiguity `
        + `query [transport: ${ambiguity.transport.toUpperCase()}], ${sigFigsKeptTerms.length} kept `
        + `(stated impact, FD-BP152-20 sig figs) / ${sigFigsDroppedTerms.length} dropped (no stated impact), `
        + `${ambiguityNested.length} surveyed, `
        + `${constraints.length} constraint(s) asked (${obtainedCount} answered), `
        + `${thresholdQuestions.length} threshold question(s) asked (${thresholdObtainedCount} answered)`
        + `${negationNamed ? ', negation named' : ''}`,
      ts: nowIso(),
    });
    return { term: null, nested: null, ambiguity, ambiguityNested, negationNamed, constraints, operation, thresholdQuestions, why };
  }
  const nested = await surveyAskNested(term, ctx);
  const why = `surveyed "${term}" via E-SURVEY-ASK's nested form (wired, not rewritten): ${nested.why}`;
  emit({ kind: 'result', text: `SURVEY STEP 2: "${term}" -- ${nested.levels.length} level(s) surveyed`, ts: nowIso() });
  return { term, nested, ambiguity: null, ambiguityNested: [], negationNamed: false, constraints: [], operation: null, thresholdQuestions: [], why };
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

  // ───────────────────────────────────────────────────────────────────────────────────────────
  // D-BP152-009. ATTRIBUTED: Founder, BP152, verbatim (`FD-BP152-01`): "I think survey goes too
  // far, more than needed, for the value of the denotations of every phrase and word. We REALLY
  // need to have it ask the two part google question I did last time. That saves a BUNCH of time.
  // THen maybe if it doesn't come up with the answer, we THEN do a phrase denotation for more."
  //
  // MEASURED COST THIS CLOSES: receipt LIANA_RUN_qid98_2026-08-10T16-13-26-122Z.json -- SURVEY
  // STEP 2's operation query (Part 2, FD-BP152-05) already reached `DEMAND PATH: operation`,
  // `DEMAND: CLASSIFY`, and SURVEY STEP 3 (the per-option denotation sweep, 9 options x 2 Google
  // queries = 18 queries) ran anyway and contributed nothing to the verdict.
  //
  // THE PREDICATE, stated once, exactly: SURVEY STEP 3 runs only when SURVEY STEP 2's operation
  // query (Part 2) did NOT resolve a non-null demand; it is SKIPPED when Part 2 already resolved
  // one (the same `DEMAND PATH: operation` case liana_terminal_engine.ts's own demandPath
  // computation names at its call site). `determineDemandFromOperationAnswer()` (demand_test.ts,
  // imported, not rewritten) is the SAME function that produces that engine-level demandPath, so
  // this gate and that transcript line can never disagree about what "resolved" means.
  //
  // WHAT THIS DOES NOT CHANGE: askAmbiguity()/askOperation() (Part 1/Part 2 themselves), the
  // demand mapping in demand_test.ts, and founderStep3CategorizeOptions() itself are all
  // byte-identical to before this ticket -- ONLY WHEN step 3 is called changes, never what it
  // does when it runs.
  const operationDemandForGate = step2.operation
    ? determineDemandFromOperationAnswer(step2.operation.rawAnswer)
    : null;
  const step3ShouldRun = !operationDemandForGate?.demand;
  if (step3ShouldRun) {
    emit({
      kind: 'note',
      text: '   SURVEY STEP 3 GATE: RUNNING as the fallback -- SURVEY STEP 2\'s operation query did not '
        + `resolve a demand (${operationDemandForGate ? operationDemandForGate.why : 'no operation query was issued -- a quoted/cued term was found, so Part 2 never ran'}), `
        + 'so the per-option denotation sweep proceeds (ATTRIBUTED, FD-BP152-01: "...maybe if it doesn\'t '
        + 'come up with the answer, we THEN do a phrase denotation for more.")',
      ts: nowIso(),
    });
  } else {
    emit({
      kind: 'note',
      text: `   SURVEY STEP 3 GATE: SKIPPED -- SURVEY STEP 2's operation query already resolved DEMAND: `
        + `${operationDemandForGate!.demand} (DEMAND PATH: operation), so the per-option denotation sweep `
        + 'is not needed (ATTRIBUTED, FD-BP152-01: "We REALLY need to have it ask the two part google '
        + 'question I did last time. That saves a BUNCH of time.")',
      ts: nowIso(),
    });
  }
  const step3: FounderStep3Result = step3ShouldRun
    ? await founderStep3CategorizeOptions(options, ctx, opts.sharedFrame, opts.maxCatalystWordsPerOption)
    : {
        perOption: null,
        grouping: null,
        why: `SKIPPED (FD-BP152-01) -- SURVEY STEP 2's operation query already resolved DEMAND: `
          + `${operationDemandForGate!.demand} (DEMAND PATH: operation); the per-option denotation sweep `
          + 'is a fallback, run only when Step 2 does not resolve a demand',
      };
  // ───────────────────────────────────────────────────────────────────────────────────────────
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
