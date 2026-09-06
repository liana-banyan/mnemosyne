import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// LianaCycleTab.tsx -- D-BP149-034/BISHOP/S34/seg-lianaterminal
//
// THE LIANA CYCLE TERMINAL. Ratified canon:
//   Asteroid-ProofVault/state/eblets/CANON/canon_liana_cycle_terminal_window_we_fight_as_we_train_bp148.eblet.md
// Founder, BP148: "the liana cycle is exactly that process, and we need it anyway, so why not
// make the terminal window view, and use it, so we can save what we can token wise, while
// actually using the real deal as practice? We fight as we train."
// Founder, BP149: "Seriously, build it, and use gemma to do it with our MIC method, if possible."
//
// Two panes. LEFT: a live, scrolling, monospace transcript of the cascade executing -- the same
// stage-by-stage output scripts/founder_cascade_v2.mjs prints to console, streamed here via
// window.amplify.onLianaTerminalEvent instead of pasted back from a separate terminal window
// (BP138 standing rule: the Founder must SEE the run live, question by question). RIGHT: the
// prompt -- a question or a bundled MMLU-Pro question id, Enter to run.
//
// Placement: a sibling Compass tab (see compass/types.ts's CompassTab union + CompassShell.tsx's
// TABS array), not folded into LeanAskTab.tsx. LeanAskTab is a chat-bubble surface built around
// ai-dispatch:query's chat/escalation ladder; this is a two-pane terminal built around a
// completely different engine (the ported cascade). Read LeanAskTab.tsx before this decision was
// made -- its Hex Terminal (D-BP148-001) is a real, separate, already-shipped feature (handle/
// celpane minting over a chat reply) with no natural extension point for a live multi-stage
// transcript; forcing this feature into that file's chat-bubble model would have been the
// dishonest fit.
import { useCallback, useEffect, useRef, useState } from 'react';
// D-BP154-017/BISHOP-SEG/S17/seg-classify -- the shared, renderer-safe classification module (no
// Node imports, pure functions only). See that file's own header for the ratified mapping and why
// PROVEN never fires for these three steps today.
import { classifyComposerStepResult, COMPOSER_STEP_CLASS_STYLE } from '../../../shared/composer_step_classification';
// D-BP152-045/BISHOP/seg-composer-ui-fixes -- PARENTAGE LABEL. Founder, live report: "can you
// indicate with the NameNumbers if they are part of a script or method or whatever? ... so that
// users know what each are a part of?" `entry.parentId` is real registry data (StepDeclaration's
// new optional field, script_bridge.ts's ComposerRegistryEntry -- see both files' headers), never
// a map maintained in this file; a step with no parent renders exactly as before.
function formatStepLabel(entry) {
    return entry.parentId ? `${entry.parentId} > ${entry.id}` : entry.id;
}
const LS_LAST_RUNS_KEY = 'liana_terminal_recent_inputs';
const MAX_RECENT = 12;
// D-BP154-059/BISHOP-SEG/S59/seg-twenty -- THE STANDING 20. Founder's own set,
// HARDWIRE-01_ANSWERING_PIPELINE.md line 242, verbatim: "1 7 14 20 27 33 40 46 53 59 66 72 79 85
// 92 98 105 111 118 124" -- CAMPAIGN question_ids (resources/mmlu_pro_bundled/questions.jsonl's
// own `question_id`), not MMLU-Pro's `source_id`. Byte-identical to the array already used once
// to backfill origin provenance (scripts/backfill_mmlu_pro_origin_src.mjs's own STANDING_20) --
// kept as a second literal here (not imported) because that script is Node-only (fs/network) and
// has no renderer-safe export; this is the one place in the renderer that needs the list.
const STANDING_20_CAMPAIGN_QIDS = [
    1, 7, 14, 20, 27, 33, 40, 46, 53, 59, 66, 72, 79, 85, 92, 98, 105, 111, 118, 124,
];
// THE ONE STACK PROVEN LIVE-SAFE THIS TICKET (D-BP154-059). Measured this session: adding
// 'TargetClass:1' (just landed, commit aa5f4e6f, concurrent SEG a03cef29) to a run queued behind
// this file's own IPC handler and took several MINUTES per question once more than one call was
// in flight against the same interactive-browser-authority resource -- real completions, not a
// hang (receipts landed in HARDWIRE/LEDGER/LIANA_RUNS/ for every one), but far too slow for a
// question-by-question live watch. This is the reduced stack that returned in under a second per
// question for 19/20 items (all but qid 98, which legitimately queries): the same seven the
// coffee note (BP154 close) calls ACTIVE, plus the mandatory first step. Used only as the SEED
// when the Founder has not authored his own stack (composerStack.length === 0) -- an authored
// stack is never overridden.
const STANDING_20_DEFAULT_STACK = [
    'StateTheQuestion:1', 'Softballs:1', 'NamedSet:1', 'Discriminator:1', 'HumanNuance:1',
    'BoundaryStability:1', 'Magnitude:1', 'Terminator:1',
];
function loadRecent() {
    try {
        const raw = localStorage.getItem(LS_LAST_RUNS_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    }
    catch {
        return [];
    }
}
function saveRecent(list) {
    try {
        localStorage.setItem(LS_LAST_RUNS_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
    }
    catch { /* non-fatal */ }
}
function eventColor(kind) {
    switch (kind) {
        case 'header': return '#f0fdf4';
        case 'stage': return '#22d3ee';
        case 'fact': return '#4ade80';
        case 'result': return '#fbbf24';
        case 'error': return '#f87171';
        case 'note':
        default: return '#64748b';
    }
}
function TranscriptLine({ evt }) {
    const hhmmss = (() => {
        try {
            return evt.ts.slice(11, 19);
        }
        catch {
            return '';
        }
    })();
    return (_jsxs("div", { style: { display: 'flex', gap: 8, padding: '1px 0', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }, children: [_jsx("span", { style: { color: '#334155', flexShrink: 0, userSelect: 'none' }, children: hhmmss }), _jsx("span", { style: { color: eventColor(evt.kind), fontWeight: evt.kind === 'header' || evt.kind === 'result' ? 700 : 400 }, children: evt.text })] }));
}
// D-BP149-043/BISHOP/S43/seg-method2build -- THE TEACH BOX. method_registry.ts's own header
// named the gap this closes: "The terminal can ask and cannot listen. It reports 'recognized
// shape, not yet taught' [or 'no method matches'] and gives the operator nowhere to teach it."
// A run ends in exactly one of those two states via `outcome.error` -- 'method_not_yet_taught'
// (a registered method's shapeTest matched but its `run` is null, e.g. a future stub) or
// 'no_method_matched' (nothing on file fits at all). Both are teaching opportunities, not
// failures, so both trigger this box.
function isTeachableOutcome(outcome) {
    return outcome?.error === 'no_method_matched' || outcome?.error === 'method_not_yet_taught';
}
function shapeTestSummaryFor(outcome) {
    if (outcome.error === 'no_method_matched') {
        return 'NO METHOD MATCHES -- this question does not fit any recorded method.';
    }
    if (outcome.error === 'method_not_yet_taught') {
        return `NOT YET TAUGHT -- method "${outcome.method ?? '(unknown)'}" matched this question's shape but has no runner yet.`;
    }
    return '(unknown shape-test outcome)';
}
// D-BP149-044/BISHOP/S44/seg-steppedmode -- THE STEPPED WALK. Founder, BP149, verbatim: "when I
// ask a question, like '85', if it doesn't deterministically resolve, then I want to see a
// stepped version of what actually happens: 1. I want the actual question asked with the answer
// options as the first response then pause and wait for my response, then when I hit go, show
// the next step, and I will give my response on that."
//
// THIS IS A PACING/CAPTURE LAYER OVER AN ALREADY-COMPLETED RUN, NOT A LIVE PAUSE OF THE CASCADE.
// "After a normal run" (the ticket's own point 1) means the run has already happened by the time
// the walk is offered -- the same queries, in the same order, already went out and came back
// (constraints: "Do not change what the methods DO... This is a pacing and capture layer").
// Re-running with a real mid-flight pause would mean either (a) forcing the operator to sit
// through live network calls between every keystroke, or (b) restructuring every method's run()
// into a pausable generator, which the ticket explicitly forbids touching. Walking the CAPTURED
// transcript instead gets the Founder everything he asked for -- see the question and options
// first, one real action per pause, his own words recorded against that exact step -- without
// either cost, and without touching comparative_cascade.ts / definitional_cascade.ts /
// liana_terminal_engine.ts at all.
//
// TRIGGER: an outcome that did not deterministically resolve. abstain:true covers all three
// named cases (ABSTAIN from a method's own run, no_method_matched, method_not_yet_taught) in one
// check -- a clean correct (or even a clean wrong-but-answered) run stays a single fast run, per
// the ticket's own instruction not to force this on a resolved outcome.
// D-BP150-015 -- THE AUDIT GATE WAS ASYMMETRIC AND THAT WAS BACKWARD.
//
// Founder, BP150: "Then write it so that all of that is saved, especially when it works. Fix the
// audit gate."
//
// This returned `outcome.abstain === true`, so Audit the Run appeared ONLY after a run that failed
// to resolve. A run that WORKED could not be walked and could not be written to disk -- the estate
// kept its failures and discarded its successes.
//
// It bit immediately. qid 98 answered A with basis "lowest densely populated among survivors, 38.0x
// clear of the runner-up" -- the hard-number branch, which is the first evidence since BP146 that
// stages 3, 4 and 5 return data at all. That run could not be audited. The proof of the most
// important result of the session was unsaveable BECAUSE it succeeded.
//
// A successful run is MORE worth walking, not less: it is where the method that worked can be read
// step by step and taught from. Now any completed run offers the walk.
function offersSteppedWalk(outcome) {
    return outcome != null;
}
/** A general-outcome shape-test summary for the walk's teaching file -- shapeTestSummaryFor()
 *  above only covers the two `outcome.error`-tagged cases (no_method_matched /
 *  method_not_yet_taught); a method that RAN and abstained on its own (e.g. the definitional
 *  cascade's honest D5 abstain) sets no `error` at all, so it needs its own honest description
 *  here rather than falling into shapeTestSummaryFor()'s "(unknown shape-test outcome)" catch-all. */
function walkOutcomeSummary(outcome) {
    // D-BP150-015: a RESOLVED run now reaches this too, and its summary must say what it decided and
    // on what basis -- the basis string is the load-bearing part. qid 98's "lowest densely populated
    // among survivors, 38.0x clear of the runner-up" is what proves which terminator fired.
    if (!outcome.abstain && outcome.verdict) {
        const scored = outcome.correct != null ? `  key=${outcome.correct}  ${outcome.ok ? 'CORRECT' : 'WRONG'}` : '';
        const via = outcome.method ? ` via method "${outcome.method}"` : '';
        return `RESOLVED ${outcome.verdict}${scored}${via}.${outcome.basis ? `  basis: ${outcome.basis}` : ''}`;
    }
    if (outcome.error === 'no_method_matched' || outcome.error === 'method_not_yet_taught') {
        return shapeTestSummaryFor(outcome);
    }
    const who = outcome.method ? `method "${outcome.method}" ran and reached an honest abstain` : 'the run reached an honest abstain';
    const basis = outcome.basis ? `  basis: ${outcome.basis}` : '';
    return `ABSTAIN -- ${who}.${basis}`;
}
// Boundary event kinds: each one STARTS a new step (unless it is the very first event, which
// always opens step 1). 'stage' and 'header' are the cascade's own named-phase markers (e.g.
// "STAGE 0 register gate", "D1 CATEGORIZE..."); 'result' marks a verdict/abstain being reached;
// 'fact' marks a sourced answer landing (a Google response, an extracted core sense) -- splitting
// on 'fact' is what separates "the literal query about to go out" (the stage/header + its query
// note, shown BEFORE Google answers) from "what came back and what we did with it" (the fact +
// its trailing extraction/elimination notes), which is exactly the before/after pause point the
// Founder's own examples describe. 'note' never starts a step on its own -- it is always detail
// belonging to the boundary event that opened its step, never truncated, never summarized.
const STEP_BOUNDARY_KINDS = new Set(['stage', 'header', 'result', 'fact']);
/** Pure, no I/O, no method-specific knowledge -- works on any registered method's transcript
 *  because it only looks at event `kind`, which every method already emits via the same
 *  say/step/fact/note helpers (comparative_cascade.ts, definitional_cascade.ts). */
function groupEventsIntoSteps(events) {
    const steps = [];
    let current = [];
    for (const evt of events) {
        if (STEP_BOUNDARY_KINDS.has(evt.kind) && current.length > 0) {
            steps.push(current);
            current = [];
        }
        current.push(evt);
    }
    if (current.length)
        steps.push(current);
    return steps;
}
export function LianaCycleTab() {
    const [transcript, setTranscript] = useState([]);
    const [input, setInput] = useState('');
    const [running, setRunning] = useState(false);
    const [lastOutcome, setLastOutcome] = useState(null);
    const [recent, setRecent] = useState(loadRecent);
    const [bridgeMissing, setBridgeMissing] = useState(false);
    const [teachText, setTeachText] = useState('');
    const [teachSubmitting, setTeachSubmitting] = useState(false);
    const [teachResult, setTeachResult] = useState(null);
    const bottomRef = useRef(null);
    const inputRef = useRef(null);
    // D-BP149-044/BISHOP/S44/seg-steppedmode -- THE STEPPED WALK. runEventsRef collects ONLY the
    // most recently completed run's own emitted events (reset at the start of every handleRun, so
    // it never mixes events across runs); lastRunEvents is the same list frozen into state once
    // that run resolves, which is what a "Walk it step by step" click groups into steps. See the
    // groupEventsIntoSteps()/offersSteppedWalk() header comment above for why this walks an
    // ALREADY-COMPLETED run's captured transcript rather than live-pausing the cascade.
    const runEventsRef = useRef([]);
    const [lastRunEvents, setLastRunEvents] = useState([]);
    const [walkActive, setWalkActive] = useState(false);
    const [walkSteps, setWalkSteps] = useState([]);
    const [walkIndex, setWalkIndex] = useState(0);
    const [walkResponses, setWalkResponses] = useState({});
    const [walkInput, setWalkInput] = useState('');
    const [walkSubmitting, setWalkSubmitting] = useState(false);
    const [walkResult, setWalkResult] = useState(null);
    const walkInputRef = useRef(null);
    // D-BP150-009 -- WARN BEFORE DISCARDING A WALK IN PROGRESS. Founder, BP150: "Warn before
    // restarting."
    //
    // The Audit button itself is already guarded (`!walkActive`), so restarting from THERE cannot
    // lose anything -- the previous walk had already submitted. The real discard path is handleRun:
    // starting a NEW run while a walk is open calls setWalkActive(false) and the collected responses
    // are simply dropped, with no write and no acknowledgement. Same defect class the Founder
    // reported at BP149 ("a walk that throws away your annotations because you quit early is worse
    // than no walk"), reached by a different door.
    //
    // The warning OFFERS TO SAVE rather than only warning -- a dialog that can only say "you are
    // about to lose this" is barely better than losing it.
    const [pendingDiscard, setPendingDiscard] = useState(null);
    /** True when the walk holds anything the operator typed that has not reached disk. */
    const walkHasUnsavedWork = walkActive && (Object.values(walkResponses).some((r) => r.trim()) || walkInput.trim().length > 0);
    // D-BP152-012/BISHOP/seg-one-audible-button -- ONE BUTTON: CALL AN AUDIBLE. Supersedes the
    // three separate controls that used to live here (D-BP150-001 Call an Audible, D-BP151-023
    // Stepped Audible, D-BP152-011 Survey Splice + a transport dropdown).
    //
    // Founder ruling, BP152, first pass: "I don't need all four 'call an audible' 'Stepped
    // audible' - because they are the same thing... and survey slice ON is automatic when I click
    // stepped audible." Founder ruling, BP152, SECOND pass (this is the one this build follows):
    // "we don't need the survey splice button, because having it repeats an action we already
    // have - with Call an Audible, or NOT. If NOT, then an accepted script runs... simply clicking
    // Call an Audible reframes that same... script into a stepped script that I can change." I.e.
    // the survey splice is NOT a control the operator sets and NOT something this button turns on
    // -- it is (or will become, under a separate ticket) part of the accepted script either way.
    // This button's only job is stepped-vs-straight-through.
    //
    // ON sends steppedAudible:true to the same unchanged IPC call (lianaTerminalRun) -- per-stage
    // pausing. OFF sends false, byte-for-byte the request this tab has always made when nothing
    // was touched. `contingencyOperatorSurvey` is NOT read, NOT set, and NOT surfaced by this
    // button in either state -- D-BP152-013 (a separate dispatch) owns making Survey part of the
    // default script and removing that gate from liana_terminal_engine.ts; this ticket does not
    // touch that file, its gate, survey_stage.ts, or any default.
    //
    // THE OLD PER-GOOGLE-CALL PAUSE (`audible`, audible.ts) IS NOT WIRED TO THIS BUTTON either.
    // Per the first-pass ticket: "If per-call pausing cannot be reached from this button, that is
    // fine and expected." audible.ts and stepped_audible.ts stay separate, untouched modules with
    // separate params (their own header comments explain why) -- this ticket collapses the UI
    // surface only, never the engine. `false` is sent for `audible` below; the live per-call pause
    // panel further down this file (activePause and everything under it) is therefore unreachable
    // from this tab now, left in place rather than deleted since removing working,
    // independently-headed plumbing is not this ticket's scope.
    //
    // THE TRANSPORT SELECTOR AND THE SPLICE CONTROL ARE BOTH REMOVED FROM THIS SURFACE, not
    // folded into this button. Their defaults ('google' / off), resolveAmbiguityQueryTransport(),
    // isContingencyOperatorSurveySpliceEnabled(), and the AMBIGUITY_QUERY_TRANSPORT /
    // CONTINGENCY_OPERATOR_SURVEY_SPLICE env vars are all unchanged and untouched by this file --
    // `undefined` is sent for both IPC params below, always, which is exactly what an operator who
    // never touched either removed control already sent.
    const [oneAudibleMode, setOneAudibleMode] = useState(() => localStorage.getItem('liana.callAnAudible') === '1');
    useEffect(() => { localStorage.setItem('liana.callAnAudible', oneAudibleMode ? '1' : '0'); }, [oneAudibleMode]);
    const [activePause, setActivePause] = useState(null);
    // The query the operator is editing. Seeded from the pause's own literal query, so leaving it
    // untouched and pressing Go sends EXACTLY what the method generated.
    const [pauseQuery, setPauseQuery] = useState('');
    const [pauseNote, setPauseNote] = useState('');
    const [pauseAnswering, setPauseAnswering] = useState(false);
    const pauseQueryRef = useRef(null);
    const pauseNoteRef = useRef(null);
    const [activeSteppedPause, setActiveSteppedPause] = useState(null);
    const [steppedResponseText, setSteppedResponseText] = useState('');
    const [steppedAnswering, setSteppedAnswering] = useState(false);
    const steppedResponseRef = useRef(null);
    // D-BP152-043/BISHOP/seg-scratch-composer -- THE COMPOSER ("the Scratch version"). Founder,
    // BP152, verbatim (FD-BP152-20): "I want to use it to stack methods in whatever order I want -
    // I don't need the lego shapes, I just want them NameNumbered... so that I can mix and match as
    // I please." `composerStack` is the ordered list of ids he has picked, in the order he wants
    // them to run -- reordering THIS array is the entire feature. Never persisted (no localStorage,
    // unlike `recent`/`oneAudibleMode` above) -- this ticket's own FORBIDDEN list says no
    // persistence for this UI.
    const [composerOpen, setComposerOpen] = useState(false);
    const [composerRegistry, setComposerRegistry] = useState([]);
    const [composerRegistryState, setComposerRegistryState] = useState('idle');
    const [composerStack, setComposerStack] = useState([]);
    const [composerRunning, setComposerRunning] = useState(false);
    const [composerResult, setComposerResult] = useState(null);
    // D-BP154-017/BISHOP-SEG/S17/seg-classify -- which step row's provenance chain is expanded
    // (Founder, BP154: "click a result, see the chain of where it came from"). Index into
    // composerResult.result.steps/results; null = nothing expanded. Reset whenever a new stack run
    // starts (runComposerStack), same discipline composerResult itself already follows.
    const [expandedStepIndex, setExpandedStepIndex] = useState(null);
    // D-BP154-059/BISHOP-SEG/S59/seg-twenty -- THE TEST-IT-YOURSELF BUTTON, standing 20. Reuses
    // composerResult/expandedStepIndex above for the LIVE per-question display (the same rich,
    // badge-and-clickable-provenance view a single run already gets) -- `standingRunRows` is only
    // the running SCOREBOARD across questions, never a second copy of a single run's own detail.
    const [standingRunActive, setStandingRunActive] = useState(false);
    const [standingRunRows, setStandingRunRows] = useState([]);
    // D-BP154-010/BISHOP/S10/seg-thepail -- THE PAIL. "The Founder can SEE what is in it"
    // (THE_PAIL_BP154.md). `evidenceStoreSummary` is the READ-ONLY, whole-store view (the 440
    // records / ~291 KB / 23 files already on disk, plus whatever this session adds) -- loaded the
    // same lazy, refreshable way `composerRegistry` already is. `composerResult.evidence` (this
    // run's own pail contents: acquisition id, records written, write failures, and the records
    // themselves) rides on `composerResult` already and needs no separate state.
    const [evidenceStoreSummary, setEvidenceStoreSummary] = useState(null);
    const [evidenceStoreSummaryState, setEvidenceStoreSummaryState] = useState('idle');
    // D-BP154-025/BISHOP-SEG/S25/seg-handproof -- TWO READ-ONLY REFERENCE PANELS. Founder, verbatim:
    // "Give me my hand-written proof, in the composer, as well as the THREE QUESTIONS that we know
    // get the right answer." Same lazy-load-on-open, refreshable-on-demand shape as
    // evidenceStoreSummary above -- both are pure disk reads on the main-process side
    // (composer_reference_panels.ts), never derivation logic, and calling either any number of times
    // cannot change anything on disk or any verdict.
    const [founderProof, setFounderProof] = useState(null);
    const [founderProofState, setFounderProofState] = useState('idle');
    const [knownGoodQueries, setKnownGoodQueries] = useState(null);
    const [knownGoodQueriesState, setKnownGoodQueriesState] = useState('idle');
    const [showWholeFounderCascade, setShowWholeFounderCascade] = useState(false);
    // D-BP152-022/BISHOP/seg-laboratory-and-keep -- THE LABORATORY. FD-BP152-07: ephemeral by
    // default, persisted only when the operator explicitly says "keep". Every one of these is
    // wholly separate from the stepped-pause action union (approve/correct/redirect/ask_google) --
    // keeping a step never flows through answerSteppedPause()/lianaSteppedRespond, so the four
    // existing actions are untouched by this feature (see stepped_audible.ts's own header).
    //
    // lastAskGoogleQuery: exactly what was last sent via "Send to Google" in the CURRENT run's Step
    // 0 pause chain -- captured in answerSteppedPause() below, at the moment it is sent, never
    // re-derived from the transcript. null until a send happens; reset to null at the start of
    // every new run (handleRun) so a stale run's query can never be Kept under a new one.
    const [lastAskGoogleQuery, setLastAskGoogleQuery] = useState(null);
    // D-BP152-027/BISHOP/seg-open-nexus-from-pause -- THE MISSING WAY IN. Founder, live report:
    // "I thought we were going to have it come up with the 5 tabs that we already use? ... it's
    // doing the same scrape thing it did before" -- he pressed Send to Google because nothing at
    // this pause offered a way to reach the Nexus Authority window (the 5 Google/Perplexity/Claude/
    // ChatGPT/Gemini tabs). Status text for the "open the 5 tabs" action below, reset per pause the
    // same way steppedResponseText is (onLianaSteppedPause effect below).
    const [nexusOpenStatus, setNexusOpenStatus] = useState(null);
    // The raw text he typed to start the CURRENT run (e.g. "98"), captured once in handleRun --
    // this ticket's "provenance (which qid/run it was authored during)".
    const runInputRef = useRef('');
    const [laboratoryName, setLaboratoryName] = useState('');
    const [laboratorySaving, setLaboratorySaving] = useState(false);
    const [laboratoryResult, setLaboratoryResult] = useState(null);
    const [laboratorySteps, setLaboratorySteps] = useState([]);
    const [laboratoryListState, setLaboratoryListState] = useState('idle');
    const [laboratoryOpen, setLaboratoryOpen] = useState(false);
    // D-BP150-002/BISHOP/S02/seg-notesrecall -- HIS EARLIER NOTES, AVAILABLE MID-PAUSE.
    // Founder, BP150: "post whichever of my notes I want into the textbox I'm typing in, so I don't
    // have to go read it, or do it from memory." His qid 85 walk notes ARE the spec for the method
    // that does not exist yet; retyping them from memory at the moment they apply is where a plan
    // gets lost.
    //
    // NOT FILTERED TO THE CURRENT QUESTION, deliberately. The notes are about the METHOD, not the
    // question that provoked them -- "this register gate must go AFTER the initial Survey step" is
    // wanted while walking anything, not only qid 85.
    const [notesFiles, setNotesFiles] = useState([]);
    const [notesOpen, setNotesOpen] = useState(false);
    const [notesState, setNotesState] = useState('idle');
    const [expandedNote, setExpandedNote] = useState(null);
    // Which box he was last typing in, so "Insert" lands where he expects rather than always in one
    // of them. Defaults to the note box, which is the one that exists at both phases.
    const lastBox = useRef('note');
    const loadNotes = useCallback(async () => {
        if (!window.amplify?.lianaNotesList) {
            setNotesState('unavailable');
            return;
        }
        setNotesState('loading');
        try {
            const res = await window.amplify.lianaNotesList();
            setNotesFiles(res.files ?? []);
            setNotesState('loaded');
        }
        catch {
            setNotesState('unavailable');
        }
    }, []);
    // Loaded once a pause exists, not on mount: reading the dropzone costs a disk walk and there is
    // nothing to insert into until the run has actually stopped.
    useEffect(() => {
        if (activePause && notesState === 'idle')
            void loadNotes();
    }, [activePause, notesState, loadNotes]);
    /** Inserts a note VERBATIM at the cursor of whichever box he was last in. Never reformats it,
     *  never replaces what is already typed -- it splices, so a note can be dropped into the middle
     *  of a sentence he is part way through. */
    const insertNote = useCallback((text) => {
        const which = lastBox.current;
        const el = which === 'query' ? pauseQueryRef.current : pauseNoteRef.current;
        const current = which === 'query' ? pauseQuery : pauseNote;
        const setter = which === 'query' ? setPauseQuery : setPauseNote;
        if (!el) {
            setter(current ? `${current}\n\n${text}` : text);
            return;
        }
        const start = el.selectionStart ?? current.length;
        const end = el.selectionEnd ?? start;
        setter(current.slice(0, start) + text + current.slice(end));
        // Put the caret after what was just inserted so he can keep typing from there.
        requestAnimationFrame(() => {
            el.focus();
            const caret = start + text.length;
            try {
                el.setSelectionRange(caret, caret);
            }
            catch { /* box may have re-rendered */ }
        });
    }, [pauseQuery, pauseNote]);
    // DRAGGABLE SPLIT. Founder, BP149: "I need the input box to be either movable or just half of the
    // screen ... like the right half." The right pane was a fixed 280px column, which left the Teach
    // textarea about eight lines of very narrow text -- unusable for typing out a method, which is
    // the one thing this pane exists for. Width is remembered across sessions.
    const splitRef = useRef(null);
    // DEFAULT IS HALF THE SCREEN. Founder, BP149: "yes default to half". A saved width always wins,
    // so once he drags it somewhere it stays there; half is only the starting point.
    const [rightW, setRightW] = useState(() => {
        const saved = Number(localStorage.getItem('liana.rightWidth'));
        return Number.isFinite(saved) && saved >= 240 ? saved : 0; // 0 = not measured yet
    });
    const [dragging, setDragging] = useState(false);
    useEffect(() => {
        if (rightW > 0)
            return; // saved value, or already measured
        const box = splitRef.current?.getBoundingClientRect();
        if (box && box.width > 0)
            setRightW(Math.round(box.width / 2));
    }, [rightW]);
    useEffect(() => { if (rightW > 0)
        localStorage.setItem('liana.rightWidth', String(rightW)); }, [rightW]);
    useEffect(() => {
        if (!dragging)
            return;
        const onMove = (e) => {
            const box = splitRef.current?.getBoundingClientRect();
            if (!box)
                return;
            // Clamp so neither pane can be dragged away entirely.
            const next = Math.min(Math.max(box.right - e.clientX, 240), Math.max(box.width - 320, 240));
            setRightW(next);
        };
        const onUp = () => setDragging(false);
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        // Stop the transcript text selecting while the divider is being dragged.
        const prev = document.body.style.userSelect;
        document.body.style.userSelect = 'none';
        return () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            document.body.style.userSelect = prev;
        };
    }, [dragging]);
    const halveScreen = useCallback(() => {
        const box = splitRef.current?.getBoundingClientRect();
        if (box)
            setRightW(Math.round(box.width / 2));
    }, []);
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [transcript]);
    useEffect(() => {
        if (!window.amplify?.onLianaTerminalEvent) {
            setBridgeMissing(true);
            return;
        }
        const unsub = window.amplify.onLianaTerminalEvent((evt) => {
            setTranscript((prev) => [...prev, evt]);
            // D-BP149-044: mirrored into the current-run-only buffer the stepped walk reads from.
            runEventsRef.current.push(evt);
        });
        return () => { unsub?.(); };
    }, []);
    useEffect(() => { inputRef.current?.focus(); }, []);
    // D-BP150-001 -- the engine has stopped and is waiting. Pushed, not polled: a pause has no
    // duration to poll for, it lasts exactly as long as the Founder takes.
    useEffect(() => {
        if (!window.amplify?.onLianaAudiblePause)
            return;
        const unsub = window.amplify.onLianaAudiblePause((pause) => {
            setActivePause(pause);
            setPauseQuery(pause.query); // seeded verbatim; untouched + Go sends the method's own query
            setPauseNote('');
        });
        return () => { unsub?.(); };
    }, []);
    // D-BP151-023 -- same push convention, one level up (per-step, not per-call).
    useEffect(() => {
        if (!window.amplify?.onLianaSteppedPause)
            return;
        const unsub = window.amplify.onLianaSteppedPause((pause) => {
            setActiveSteppedPause(pause);
            setSteppedResponseText('');
            setNexusOpenStatus(null);
        });
        return () => { unsub?.(); };
    }, []);
    useEffect(() => {
        if (activeSteppedPause)
            steppedResponseRef.current?.focus();
    }, [activeSteppedPause]);
    // THE ONLY WAY A STEP PAUSE ENDS FROM THIS SIDE. Per HARDWIRE-23 ("this build adds no decision
    // rule"), `approve`/`correct`/`redirect` are recorded and change nothing about how the run
    // proceeds -- see stepped_audible.ts's header. Only `abandon` has a real effect.
    const answerSteppedPause = useCallback(async (action) => {
        const pause = activeSteppedPause;
        if (!pause || steppedAnswering)
            return;
        if (!window.amplify?.lianaSteppedRespond) {
            setTranscript((prev) => [...prev, {
                    kind: 'error',
                    text: 'Preload bridge missing (lianaSteppedRespond) -- rebuild main and restart the app.',
                    ts: new Date().toISOString(),
                }]);
            return;
        }
        // D-BP152-022: capture EXACTLY what is about to be sent, so "Keep" (a wholly separate,
        // additive control below) can later save the SAME string ask_google itself sends -- never
        // re-derived from the transcript. Captured here, before the next pause's own
        // onLianaSteppedPause handler clears steppedResponseText.
        if (action === 'ask_google' && pause.step.key === 'step0') {
            setLastAskGoogleQuery(steppedResponseText);
        }
        setSteppedAnswering(true);
        try {
            await window.amplify.lianaSteppedRespond({
                pauseId: pause.pauseId,
                action,
                text: steppedResponseText || undefined, // VERBATIM -- never trimmed, reformatted, or summarized
            });
            const bits = [`stepped audible: step ${pause.stepIndex}/${pause.stepTotal} (${pause.step.codeLabel}): ${action}`];
            if (steppedResponseText.trim())
                bits.push(`response saved (${steppedResponseText.trim().length} chars)`);
            setTranscript((prev) => [...prev, {
                    kind: 'fact', text: `  ${bits.join(' · ')}`, ts: new Date().toISOString(),
                }]);
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            setTranscript((prev) => [...prev, { kind: 'error', text: `stepped audible respond threw: ${msg}`, ts: new Date().toISOString() }]);
        }
        finally {
            setSteppedAnswering(false);
            setActiveSteppedPause(null);
            setSteppedResponseText('');
        }
    }, [activeSteppedPause, steppedAnswering, steppedResponseText]);
    // D-BP152-027/BISHOP/seg-open-nexus-from-pause -- OPEN THE 5 TABS, from the pause itself.
    // Deliberately NOT routed through answerSteppedPause()/lianaSteppedRespond -- this never
    // resolves the pause, so the run cannot advance, resume, or end as a side effect of pressing
    // it. Reuses the EXACT existing open path the Founder already uses day to day (per his own
    // report: "the only way I know how to get to that five tab is by clicking the 'sign in' button
    // on the Nexus subtab of the Ask tab") -- window.amplify.openNexusAuthoritySignIn(), the same
    // preload call NexusAuthoritySignInPanel.tsx's per-authority buttons make
    // (src/renderer/settings/NexusAuthoritySignInPanel.tsx:182, handleOpenSignIn), which forwards to
    // index.ts's 'nexus-authority-open-signin' handler (src/main/index.ts:4216) ->
    // showNexusAuthoritySessionForSignIn() (nexus_authority_persistent_session.ts:284). No second
    // open path is introduced here. That function's own ensureNexusAuthoritySession() singleton
    // (nexus_authority_persistent_session.ts:240) already brings an existing window forward
    // (win.show()/win.focus()) rather than ever constructing a second BrowserWindow -- unchanged by
    // this ticket. getNexusAuthorityWindow() (read-only, used by capture) is untouched.
    const openNexusTabsFromPause = useCallback(async () => {
        if (!window.amplify?.openNexusAuthoritySignIn) {
            setNexusOpenStatus('Not available -- rebuild main and restart the app.');
            return;
        }
        setNexusOpenStatus(null);
        try {
            const res = await window.amplify.openNexusAuthoritySignIn('user_google');
            if (!res?.ok) {
                setNexusOpenStatus('Turn on Authorities (Nexus) in the Ask tab first, then try again.');
            }
        }
        catch {
            setNexusOpenStatus('Could not open the window -- rebuild main and restart the app.');
        }
    }, []);
    // Enter makes a newline. Only a button acts -- same rule as the audible boxes.
    const handleSteppedResponseKeyDown = (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            void answerSteppedPause('approve');
        }
    };
    // D-BP152-022/BISHOP/seg-laboratory-and-keep -- LIST. Read-only; loaded on demand (opening the
    // "Show saved steps" panel), not on mount -- same lazy-load reasoning loadNotes() above uses.
    const loadLaboratorySteps = useCallback(async () => {
        if (!window.amplify?.lianaLaboratoryList) {
            setLaboratoryListState('unavailable');
            return;
        }
        setLaboratoryListState('loading');
        try {
            const res = await window.amplify.lianaLaboratoryList();
            setLaboratorySteps(res.steps ?? []);
            setLaboratoryListState('loaded');
        }
        catch {
            setLaboratoryListState('unavailable');
        }
    }, []);
    // KEEP. Only meaningful once lastAskGoogleQuery is set (a "Send to Google" round already
    // happened this pause chain). Saving does NOT promote -- this writes a Tier 1 Laboratory
    // record only; no Method, no Playbook entry, no success test runs against it (FD-BP152-10).
    const handleKeepLaboratoryStep = useCallback(async () => {
        if (!lastAskGoogleQuery || !laboratoryName.trim() || laboratorySaving)
            return;
        if (!window.amplify?.lianaLaboratorySave) {
            setLaboratoryResult({ ok: false, error: 'Preload bridge missing (lianaLaboratorySave) -- rebuild main and restart the app.' });
            return;
        }
        setLaboratorySaving(true);
        try {
            const res = await window.amplify.lianaLaboratorySave({
                name: laboratoryName.trim(),
                queryTextVerbatim: lastAskGoogleQuery,
                provenance: { runInput: runInputRef.current },
            });
            setLaboratoryResult(res);
            if (res.ok) {
                setLaboratoryName('');
                if (laboratoryOpen)
                    void loadLaboratorySteps();
            }
        }
        catch (err) {
            setLaboratoryResult({ ok: false, error: err instanceof Error ? err.message : String(err) });
        }
        finally {
            setLaboratorySaving(false);
        }
    }, [lastAskGoogleQuery, laboratoryName, laboratorySaving, laboratoryOpen, loadLaboratorySteps]);
    // LOAD. Requirement 3: "Loading fills the box; it does NOT auto-execute -- he still presses
    // send." This handler does exactly one thing -- setSteppedResponseText() -- and never calls
    // answerSteppedPause()/window.amplify.lianaSteppedRespond, so nothing here can execute a query.
    const handleLoadLaboratoryStep = useCallback((step) => {
        setSteppedResponseText(step.queryTextVerbatim);
    }, []);
    // Focus whichever box the operator will actually type in at this phase: the query on the way
    // out (the one he can change), the note on the way back (the query is history by then).
    useEffect(() => {
        if (!activePause)
            return;
        if (activePause.phase === 'before_query')
            pauseQueryRef.current?.focus();
        else
            pauseNoteRef.current?.focus();
    }, [activePause]);
    // THE ONLY WAY A PAUSE ENDS FROM THIS SIDE. `action` is chosen by which button was pressed --
    // never inferred from what was typed. Auto-parsing the operator's free text and changing the
    // run because of it is precisely the failure the method registry exists to prevent: we could no
    // longer tell whether a method worked or whether the system had quietly rewritten itself.
    const answerPause = useCallback(async (action) => {
        const pause = activePause;
        if (!pause || pauseAnswering)
            return;
        if (!window.amplify?.lianaAudibleRespond) {
            setTranscript((prev) => [...prev, {
                    kind: 'error',
                    text: 'Preload bridge missing (lianaAudibleRespond) -- rebuild main and restart the app.',
                    ts: new Date().toISOString(),
                }]);
            return;
        }
        // A rewrite is only a rewrite if the text actually differs. Pressing Go after incidentally
        // touching the box must not be recorded as the operator having redirected the cascade.
        const changed = pause.phase === 'before_query' && pauseQuery !== pause.query && pauseQuery.trim().length > 0;
        const effectiveAction = action === 'go' && changed ? 'rewrite' : action;
        setPauseAnswering(true);
        try {
            await window.amplify.lianaAudibleRespond({
                pauseId: pause.pauseId,
                action: effectiveAction,
                replacementQuery: effectiveAction === 'rewrite' ? pauseQuery : undefined,
                note: pauseNote || undefined, // VERBATIM -- never trimmed, reformatted, or summarized
            });
            // Acknowledge in the transcript. Founder, BP149, on the notes box: a note that vanishes
            // into state with no acknowledgement is indistinguishable from one that was lost.
            const bits = [`audible call ${pause.callIndex} ${pause.phase === 'before_query' ? 'out' : 'back'}: ${effectiveAction}`];
            if (pauseNote.trim())
                bits.push(`note saved (${pauseNote.trim().length} chars)`);
            setTranscript((prev) => [...prev, {
                    kind: 'fact', text: `  ${bits.join(' · ')}`, ts: new Date().toISOString(),
                }]);
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            setTranscript((prev) => [...prev, { kind: 'error', text: `audible respond threw: ${msg}`, ts: new Date().toISOString() }]);
        }
        finally {
            setPauseAnswering(false);
            setActivePause(null);
            setPauseNote('');
        }
    }, [activePause, pauseAnswering, pauseQuery, pauseNote]);
    // Enter makes a newline in BOTH audible boxes. Only a button acts. This is the same rule the
    // Founder had to ask for twice on the Audit notes box -- a single-line input whose Enter key
    // advanced the step is what made typing a paragraph look like abandoning.
    const handlePauseKeyDown = (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            void answerPause('go');
        }
    };
    const handleRun = useCallback(async () => {
        const text = input.trim();
        if (!text || running)
            return;
        if (!window.amplify?.lianaTerminalRun) {
            setBridgeMissing(true);
            return;
        }
        // D-BP150-009: an open walk holding untyped-to-disk notes must not be silently wiped by
        // starting a new run. Stop, hold the question, and let him choose. Bypassed by the banner's
        // own buttons, which call runNow() directly.
        if (walkHasUnsavedWork && !pendingDiscard) {
            setPendingDiscard({ kind: 'run', text });
            return;
        }
        setPendingDiscard(null);
        setRunning(true);
        setLastOutcome(null);
        setTeachText('');
        setTeachResult(null);
        // D-BP149-044: a fresh run starts a fresh capture -- the previous run's steps must never
        // leak into this one's walk.
        runEventsRef.current = [];
        setLastRunEvents([]);
        setWalkActive(false);
        setWalkResult(null);
        // D-BP150-001: a stale pause panel from a previous run must never be answerable against this
        // one. Its pauseId is already dead in main's table, but leaving it on screen would invite a
        // click that silently does nothing.
        setActivePause(null);
        // D-BP151-023: same reasoning, for a stepped pause left over from a previous run.
        setActiveSteppedPause(null);
        // D-BP152-022: a Laboratory "Keep" from the PREVIOUS run must never attach to this one --
        // reset before the new run's own provenance (runInputRef) is captured just below.
        setLastAskGoogleQuery(null);
        setLaboratoryResult(null);
        runInputRef.current = text;
        setTranscript((prev) => [
            ...prev,
            {
                kind: 'header',
                // D-BP152-012: the header line still records the effective state of the one gate this
                // button drives (source is always 'ui' -- no env override reaches steppedAudible), the
                // same receipt discipline 46a87505 applied to its own toggles.
                text: `═══ RUN  "${text}"${oneAudibleMode ? '   [CALL AN AUDIBLE ON]' : ''}`,
                ts: new Date().toISOString(),
            },
        ]);
        const nextRecent = [text, ...recent.filter((r) => r !== text)].slice(0, MAX_RECENT);
        setRecent(nextRecent);
        saveRecent(nextRecent);
        setInput('');
        try {
            // D-BP152-012, SECOND-PASS SCOPE: `oneAudibleMode` drives ONLY `steppedAudible`.
            // `contingencyOperatorSurvey` and `ambiguityQueryTransport` are `undefined` here, always --
            // this button does not read, set, or surface either. `false` for the old per-call `audible`
            // param (not wired to this button either, see the state comment above).
            const outcome = await window.amplify.lianaTerminalRun(text, false, oneAudibleMode, undefined, undefined);
            setLastOutcome(outcome);
            setLastRunEvents(runEventsRef.current.slice());
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            setTranscript((prev) => [...prev, { kind: 'error', text: `IPC threw: ${msg}`, ts: new Date().toISOString() }]);
        }
        finally {
            setRunning(false);
            // A run that ended (resolved, threw, or was abandoned from inside a pause) leaves no pause
            // to answer. Main has already released it; this clears the panel to match.
            setActivePause(null);
            setActiveSteppedPause(null);
            inputRef.current?.focus();
        }
    }, [input, running, recent, oneAudibleMode, walkHasUnsavedWork, pendingDiscard]);
    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            void handleRun();
        }
    };
    const handleClear = useCallback(() => {
        setTranscript([]);
        setLastOutcome(null);
        setTeachText('');
        setTeachResult(null);
    }, []);
    // D-BP152-043/BISHOP/seg-scratch-composer -- loads the list of steps on file, lazily (on first
    // opening the panel) rather than on every mount, since most runs never open it. Called again
    // any time the panel is (re)opened, so a step a concurrent dispatch registers after this window
    // was first opened still shows up without a restart.
    const loadComposerRegistry = useCallback(async () => {
        if (!window.amplify?.lianaScriptListRegistry) {
            setComposerRegistryState('unavailable');
            return;
        }
        setComposerRegistryState('loading');
        try {
            const entries = await window.amplify.lianaScriptListRegistry();
            setComposerRegistry(entries);
            setComposerRegistryState('loaded');
        }
        catch {
            setComposerRegistryState('unavailable');
        }
    }, []);
    // D-BP154-010/BISHOP/S10/seg-thepail -- THE PAIL, lock condition 4: "the evidence we already own
    // is VISIBLE... not orphaned." Same lazy-load-on-open, refreshable-on-demand shape as
    // loadComposerRegistry above. Read-only on the main-process side (summarizeEvidenceStore()) --
    // calling this any number of times cannot change what is on disk.
    const loadEvidenceStoreSummary = useCallback(async () => {
        if (!window.amplify?.lianaEvidenceStoreSummary) {
            setEvidenceStoreSummaryState('unavailable');
            return;
        }
        setEvidenceStoreSummaryState('loading');
        try {
            const summary = await window.amplify.lianaEvidenceStoreSummary();
            setEvidenceStoreSummary(summary);
            setEvidenceStoreSummaryState('loaded');
        }
        catch {
            setEvidenceStoreSummaryState('unavailable');
        }
    }, []);
    // D-BP154-025/BISHOP-SEG/S25/seg-handproof -- same lazy-load-on-open, refreshable-on-demand
    // shape as loadEvidenceStoreSummary above. Both main-process reads are strictly read-only
    // (composer_reference_panels.ts) -- calling either any number of times cannot change what is on
    // disk or any verdict.
    const loadFounderProof = useCallback(async () => {
        if (!window.amplify?.lianaComposerFounderProof) {
            setFounderProofState('unavailable');
            return;
        }
        setFounderProofState('loading');
        try {
            const proof = await window.amplify.lianaComposerFounderProof();
            setFounderProof(proof);
            setFounderProofState('loaded');
        }
        catch {
            setFounderProofState('unavailable');
        }
    }, []);
    const loadWholeFounderCascade = useCallback(async () => {
        if (!window.amplify?.lianaComposerFounderCascadeWhole || !founderProof)
            return;
        try {
            const whole = await window.amplify.lianaComposerFounderCascadeWhole();
            setFounderProof((prev) => (prev ? { ...prev, founderCascade: whole } : prev));
            setShowWholeFounderCascade(true);
        }
        catch {
            // Leave the excerpt showing -- an on-demand "see whole file" failure is not a reason to lose
            // what is already displayed.
        }
    }, [founderProof]);
    const loadKnownGoodQueries = useCallback(async () => {
        if (!window.amplify?.lianaComposerKnownGoodQueries) {
            setKnownGoodQueriesState('unavailable');
            return;
        }
        setKnownGoodQueriesState('loading');
        try {
            const queries = await window.amplify.lianaComposerKnownGoodQueries();
            setKnownGoodQueries(queries);
            setKnownGoodQueriesState('loaded');
        }
        catch {
            setKnownGoodQueriesState('unavailable');
        }
    }, []);
    const toggleComposerOpen = useCallback(() => {
        setComposerOpen((wasOpen) => {
            const willOpen = !wasOpen;
            if (willOpen) {
                void loadComposerRegistry();
                void loadEvidenceStoreSummary();
                void loadFounderProof();
                void loadKnownGoodQueries();
            }
            return willOpen;
        });
    }, [loadComposerRegistry, loadEvidenceStoreSummary, loadFounderProof, loadKnownGoodQueries]);
    // Add / remove / move-up / move-down -- "That is the whole interaction" (this ticket's own
    // words). Duplicates are allowed on purpose: the Founder's own ask is "iterations galore", and
    // nothing here was ordered to forbid running the same step twice.
    const addComposerStep = useCallback((id) => {
        setComposerStack((prev) => [...prev, id]);
    }, []);
    const removeComposerStep = useCallback((index) => {
        setComposerStack((prev) => prev.filter((_, i) => i !== index));
    }, []);
    const moveComposerStepUp = useCallback((index) => {
        setComposerStack((prev) => {
            if (index <= 0 || index >= prev.length)
                return prev;
            const next = prev.slice();
            [next[index - 1], next[index]] = [next[index], next[index - 1]];
            return next;
        });
    }, []);
    const moveComposerStepDown = useCallback((index) => {
        setComposerStack((prev) => {
            if (index < 0 || index >= prev.length - 1)
                return prev;
            const next = prev.slice();
            [next[index], next[index + 1]] = [next[index + 1], next[index]];
            return next;
        });
    }, []);
    // Runs the authored stack (or, if empty, the default -- see script_bridge.ts's own header for
    // why that branch is byte-identical to the plain Run button above) against whatever is
    // currently typed in the SAME question box the plain Run button reads -- one question, either
    // run plainly or run through the stack, never a second question field.
    const runComposerStack = useCallback(async () => {
        const text = input.trim();
        if (!text || composerRunning)
            return;
        if (!window.amplify?.lianaScriptRun) {
            setComposerResult(null);
            return;
        }
        setComposerRunning(true);
        setComposerResult(null);
        setExpandedStepIndex(null);
        try {
            const response = await window.amplify.lianaScriptRun(text, composerStack);
            setComposerResult(response);
            if (response.mode === 'default') {
                setLastOutcome(response.outcome);
            }
        }
        finally {
            setComposerRunning(false);
        }
    }, [input, composerStack, composerRunning]);
    // D-BP154-059/BISHOP-SEG/S59/seg-twenty -- RUN THE STANDING 20, LIVE, ONE AT A TIME.
    // "Wire the in-app run so the Founder can trigger the 20 himself and watch it live -- question
    // by question, step by step, with the badges and clickable provenance already built."
    //
    // SEQUENTIAL BY DESIGN, NOT A CONVENIENCE. Measured live this ticket: firing composer runs
    // concurrently against window.amplify.lianaScriptRun backs up behind the SAME interactive
    // browser-authority resource every query hop shares (runBrowserAuthorityQueryFromMain /
    // runMachineDrivenNexusQueryFromMain, src/main/index.ts) -- five/six runs in flight at once each
    // took minutes instead of seconds. `for...of` with `await` inside, never `Promise.all`.
    //
    // REUSE, NOT A FORK. Calls the exact same window.amplify.lianaScriptRun(...) the single-question
    // path above calls, with the SAME composerStack the Founder authored (an authored stack is never
    // overridden -- only seeded with STANDING_20_DEFAULT_STACK when he has picked nothing at all).
    // Every question's response is written into `composerResult` -- the SAME state the rich
    // step-by-step badge/provenance view below already renders -- so the Founder watches each
    // question's own steps live, in place, exactly as a single run already shows them. This function
    // adds ONLY the running scoreboard across questions (`standingRunRows`); it renders nothing of a
    // single run's own detail a second time.
    const runStandingTwenty = useCallback(async () => {
        if (composerRunning || standingRunActive)
            return;
        if (!window.amplify?.lianaScriptRun) {
            setStandingRunRows([{ qid: 0, status: 'error', error: 'Preload bridge missing (lianaScriptRun) -- rebuild main and restart the app.' }]);
            return;
        }
        const stack = composerStack.length > 0 ? composerStack : [...STANDING_20_DEFAULT_STACK];
        setStandingRunActive(true);
        setStandingRunRows(STANDING_20_CAMPAIGN_QIDS.map((qid) => ({ qid, status: 'pending' })));
        setExpandedStepIndex(null);
        try {
            for (let i = 0; i < STANDING_20_CAMPAIGN_QIDS.length; i += 1) {
                const qid = STANDING_20_CAMPAIGN_QIDS[i];
                setStandingRunRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, status: 'running' } : r)));
                setComposerResult(null);
                try {
                    // eslint-disable-next-line no-await-in-loop -- sequential ON PURPOSE, see header above.
                    const response = await window.amplify.lianaScriptRun(String(qid), stack);
                    setComposerResult(response);
                    const term = response.mode === 'stack' ? response.result?.results?.find((r) => r.id === 'Terminator:1') : null;
                    const raw = term?.raw;
                    setStandingRunRows((prev) => prev.map((r, idx) => (idx === i ? {
                        ...r,
                        status: 'done',
                        verdict: raw?.verdict ?? null,
                        abstain: raw?.abstain ?? null,
                        incomplete: raw?.incomplete ?? null,
                        keyedCls: response.mode === 'stack' ? response.result?.keyedTerminatorLabel?.cls ?? null : null,
                    } : r)));
                }
                catch (err) {
                    setStandingRunRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, status: 'error', error: err instanceof Error ? err.message : String(err) } : r)));
                }
            }
        }
        finally {
            setStandingRunActive(false);
        }
    }, [composerStack, composerRunning, standingRunActive]);
    // THE TEACH BOX submit. Writes the operator's `teachText` to disk EXACTLY as typed -- this
    // function never touches, trims (beyond the browser's own textarea value), reformats, or
    // summarizes it. window.amplify.lianaTeachSubmit (preload.ts) forwards it verbatim to
    // index.ts's 'liana-teach-submit' handler, which is the only place the file actually gets
    // written. Never auto-generates a method from this text -- a human reads the file later.
    const handleTeachSubmit = useCallback(async () => {
        const text = teachText; // VERBATIM -- no .trim(), no reformatting of the operator's words
        if (!text.trim() || !lastOutcome || teachSubmitting)
            return;
        if (!window.amplify?.lianaTeachSubmit) {
            setTeachResult({ ok: false, error: 'Preload bridge missing (lianaTeachSubmit) -- rebuild main and restart the app.' });
            return;
        }
        setTeachSubmitting(true);
        try {
            const result = await window.amplify.lianaTeachSubmit({
                teachingText: text,
                question: lastOutcome.question,
                options: lastOutcome.options ?? null,
                qid: lastOutcome.qid,
                shapeTestSummary: shapeTestSummaryFor(lastOutcome),
            });
            setTeachResult(result);
            if (result.ok && result.filePath) {
                setTranscript((prev) => [
                    ...prev,
                    {
                        kind: 'result',
                        text: `TEACHING WRITTEN -- ${result.filePath}  (${result.bytes ?? '?'} bytes)`,
                        ts: new Date().toISOString(),
                    },
                ]);
            }
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            setTeachResult({ ok: false, error: msg });
        }
        finally {
            setTeachSubmitting(false);
        }
    }, [teachText, lastOutcome, teachSubmitting]);
    // D-BP149-044/BISHOP/S44/seg-steppedmode -- START THE WALK. Groups the just-completed run's
    // captured transcript into steps (groupEventsIntoSteps() above) and opens the walk panel at
    // step 1, which -- because the engine always emits header(qid/free-text) -> note(question) ->
    // note(options) -> stage(METHOD SELECTION) before anything else, and 'stage' is a step
    // boundary -- is always exactly the question and its full option list, nothing more. Founder,
    // BP149: "I want the actual question asked with the answer options as the first response then
    // pause."
    const handleStartWalk = useCallback(() => {
        const steps = groupEventsIntoSteps(lastRunEvents);
        setWalkSteps(steps);
        setWalkIndex(0);
        setWalkResponses({});
        setWalkInput('');
        setWalkResult(null);
        setWalkActive(true);
    }, [lastRunEvents]);
    useEffect(() => {
        if (walkActive)
            walkInputRef.current?.focus();
    }, [walkActive, walkIndex]);
    // Writes the walk to disk over the SAME 'liana-teach-submit' IPC channel the plain Teach box
    // uses (extended, not duplicated -- see index.ts's handler). `responses` is passed in rather
    // than read from state because setWalkResponses() is async and the caller (handleWalkGo /
    // handleAbandonWalk) needs the box's own not-yet-committed text folded in before the request
    // goes out, or a fast final keystroke would be lost.
    const submitWalk = useCallback(async (responses, abandoned, lastTouchedIndex) => {
        if (!lastOutcome)
            return;
        if (!window.amplify?.lianaTeachSubmit) {
            setWalkResult({ ok: false, error: 'Preload bridge missing (lianaTeachSubmit) -- rebuild main and restart the app.' });
            return;
        }
        setWalkSubmitting(true);
        try {
            const total = walkSteps.length;
            const stepsPayload = walkSteps.map((events, i) => ({
                index: i,
                total,
                lines: events.map((e) => ({ kind: e.kind, text: e.text, ts: e.ts })),
                response: responses[i] ?? '',
            }));
            const result = await window.amplify.lianaTeachSubmit({
                teachingText: '',
                question: lastOutcome.question,
                options: lastOutcome.options ?? null,
                qid: lastOutcome.qid,
                shapeTestSummary: walkOutcomeSummary(lastOutcome),
                steppedWalk: { steps: stepsPayload, abandoned, abandonedAtStep: abandoned ? lastTouchedIndex : undefined },
            });
            setWalkResult(result);
            if (result.ok) {
                setWalkActive(false);
                setTranscript((prev) => [
                    ...prev,
                    {
                        kind: 'result',
                        text: `AUDIT WRITTEN${abandoned ? ' (abandoned)' : ''} -- ${result.filePath}  (${result.bytes ?? '?'} bytes)`,
                        ts: new Date().toISOString(),
                    },
                ]);
            }
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            setWalkResult({ ok: false, error: msg });
        }
        finally {
            setWalkSubmitting(false);
        }
    }, [lastOutcome, walkSteps]);
    // AT EACH PAUSE HE TYPES A RESPONSE, THEN PRESSES GO -- empty is fine, it just advances.
    // Nothing here parses walkInput or changes what step comes next based on its content; it is
    // recorded against this exact step index and nothing more (HARDWIRE-22, and the ticket's own
    // "do NOT try to parse it, act on it automatically, or change the run because of it").
    // Pressing Go on the LAST step finalizes and writes the teaching file -- same action, same
    // key, uniform all the way through per the Founder's own description of the loop.
    const handleWalkGo = useCallback(() => {
        if (!walkActive || walkSubmitting)
            return;
        const idx = walkIndex;
        const responses = { ...walkResponses, [idx]: walkInput };
        setWalkResponses(responses);
        if (idx + 1 < walkSteps.length) {
            // Confirm the note landed. Founder, BP149: "let me take notes that are saved as steps
            // (step 1 note saved, step 2 note saved - when I click Go for the next step)". A note that
            // vanishes into state with no acknowledgement is indistinguishable from one that was lost.
            if (walkInput.trim()) {
                const chars = walkInput.trim().length;
                setTranscript((prev) => [...prev, {
                        ts: new Date().toISOString(),
                        kind: 'fact',
                        text: `  step ${idx + 1} note saved (${chars} chars)`,
                    }]);
            }
            setWalkInput('');
            setWalkIndex(idx + 1);
        }
        else {
            void submitWalk(responses, false, idx);
        }
    }, [walkActive, walkSubmitting, walkIndex, walkResponses, walkInput, walkSteps.length, submitWalk]);
    // Enter inserts a newline. ONLY Ctrl+Enter (or the Go button) advances the walk.
    // The old handler advanced on a bare Enter, which is why typing a paragraph looked like
    // abandoning the walk.
    const handleWalkInputKeyDown = (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            handleWalkGo();
        }
    };
    // HE MUST BE ABLE TO STOP. Writes whatever was collected (including whatever is sitting
    // un-submitted in the response box right now) rather than discarding it -- a walk that throws
    // away the operator's annotations because he quit early is worse than no walk at all.
    const handleAbandonWalk = useCallback(() => {
        if (!walkActive || walkSubmitting)
            return;
        const idx = walkIndex;
        const responses = { ...walkResponses, [idx]: walkInput };
        setWalkResponses(responses);
        void submitWalk(responses, true, idx);
    }, [walkActive, walkSubmitting, walkIndex, walkResponses, walkInput, submitWalk]);
    return (_jsxs("div", { style: { height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }, children: [_jsxs("div", { style: { padding: '14px 16px 8px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10 }, children: [_jsx("h2", { style: { margin: 0, fontSize: 16, fontWeight: 700, color: '#f0fdf4', flex: 1 }, children: "Liana Cycle" }), _jsx("span", { style: { fontSize: 11, color: '#64748b', fontFamily: 'monospace' }, children: "Google is the only source \u00B7 Gemma extracts \u00B7 the code decides \u00B7 $0" }), _jsxs("button", { type: "button", onClick: () => setOneAudibleMode((v) => !v), disabled: running, title: 'Off: the run is exactly the run it has always been.\nOn: stops once per step -- after it completes, before the next begins -- until you respond.', style: {
                            background: oneAudibleMode ? 'linear-gradient(135deg, #7c3aed, #a78bfa)' : 'none',
                            border: `1px solid ${oneAudibleMode ? '#a78bfa' : '#334155'}`, borderRadius: 5,
                            color: running ? '#334155' : oneAudibleMode ? '#0d1117' : '#94a3b8',
                            fontSize: 11, fontWeight: 700, padding: '3px 9px',
                            cursor: running ? 'default' : 'pointer', fontFamily: 'system-ui, sans-serif', outline: 'none',
                        }, children: ["Call an Audible", oneAudibleMode ? ' · ARMED' : ''] }), _jsx("button", { type: "button", onClick: handleClear, disabled: transcript.length === 0, style: {
                            background: 'none', border: '1px solid #334155', borderRadius: 5,
                            color: transcript.length === 0 ? '#334155' : '#94a3b8', fontSize: 11, padding: '3px 9px',
                            cursor: transcript.length === 0 ? 'default' : 'pointer', fontFamily: 'system-ui, sans-serif', outline: 'none',
                        }, children: "Clear" })] }), oneAudibleMode && !activePause && !activeSteppedPause && (_jsxs("div", { style: {
                    margin: '0 16px 8px', padding: '7px 12px', background: '#2a1b47',
                    border: '1px solid #7c3aed', borderRadius: 6, color: '#c4b5fd', fontSize: 12,
                    fontFamily: 'system-ui, sans-serif',
                }, children: [_jsx("strong", { children: "Call an Audible is ON, nothing is paused yet." }), " Your next run will stop once per step so you can respond, then continue when you say go."] })), pendingDiscard && (_jsxs("div", { style: {
                    margin: '0 16px 8px', padding: '9px 12px', background: '#3b0d0d',
                    border: '1px solid #b91c1c', borderRadius: 6, color: '#fca5a5', fontSize: 12,
                    fontFamily: 'system-ui, sans-serif',
                }, children: [_jsx("strong", { children: "You have notes in the open audit that are not on disk yet." }), " Starting \u201C", pendingDiscard.text, "\u201D would discard them.", _jsxs("div", { style: { marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }, children: [_jsx("button", { type: "button", onClick: () => { const idx = walkIndex; void submitWalk({ ...walkResponses, [idx]: walkInput }, true, idx); setPendingDiscard(null); }, style: {
                                    background: 'linear-gradient(135deg, #059669, #10b981)', color: '#fff', border: 'none',
                                    borderRadius: 5, padding: '5px 11px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                                    fontFamily: 'system-ui, sans-serif', outline: 'none',
                                }, children: "Save them first, then run" }), _jsx("button", { type: "button", onClick: () => { setWalkActive(false); setWalkResponses({}); setWalkInput(''); setPendingDiscard(null); void handleRun(); }, style: {
                                    background: 'none', border: '1px solid #7f1d1d', borderRadius: 5, color: '#fca5a5',
                                    padding: '5px 11px', fontSize: 12, cursor: 'pointer', fontFamily: 'system-ui, sans-serif', outline: 'none',
                                }, children: "Discard and run anyway" }), _jsx("button", { type: "button", onClick: () => setPendingDiscard(null), style: {
                                    background: 'none', border: '1px solid #334155', borderRadius: 5, color: '#94a3b8',
                                    padding: '5px 11px', fontSize: 12, cursor: 'pointer', fontFamily: 'system-ui, sans-serif', outline: 'none',
                                }, children: "Cancel, stay in the audit" })] })] })), bridgeMissing && (_jsx("div", { style: { margin: '0 16px 8px', padding: '8px 12px', background: '#7f1d1d', border: '1px solid #991b1b', borderRadius: 6, color: '#fca5a5', fontSize: 12 }, children: "Preload bridge missing (liana-terminal-run / liana-terminal-event) -- rebuild main and restart the app." })), _jsx("div", { ref: splitRef, style: { flex: 1, display: 'flex', minHeight: 0, gap: 0, background: '#1e2a38' }, children: activePause ? (_jsxs(_Fragment, { children: [_jsx("div", { style: {
                                flex: 1.6, minWidth: 0, background: '#05080d', overflowY: 'auto', padding: '10px 14px',
                                fontFamily: 'Consolas, "Courier New", monospace', fontSize: 12, lineHeight: 1.5,
                            }, children: activePause.phase === 'after_return' ? (_jsxs(_Fragment, { children: [_jsxs("div", { style: { color: '#fbbf24', fontWeight: 700, marginBottom: 8, fontFamily: 'system-ui, sans-serif', fontSize: 13 }, children: ["CALL ", activePause.callIndex, " CAME BACK -- raw, before Gemma, before any parse decision"] }), _jsxs("div", { style: { color: '#64748b', marginBottom: 10, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }, children: ["query sent: ", activePause.query, '\n', "source: ", activePause.sourceUrl ?? '(none)'] }), _jsx("div", { style: { color: activePause.rawSnippet ? '#4ade80' : '#64748b', marginBottom: 4, fontWeight: 700 }, children: "ANSWER BOX" }), _jsx("div", { style: { color: '#e2e8f0', whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginBottom: 14 }, children: activePause.rawSnippet
                                            ? activePause.rawSnippet
                                            : '(none -- Google rendered no answer box. That is normal for this cascade\'s ordering, cake-cut and density stages, and it is NOT the same as "nothing came back". The facts, if any, are in the organic results below.)' }), _jsxs("div", { style: { color: '#22d3ee', marginBottom: 4, fontWeight: 700 }, children: ["ORGANIC RESULTS (", activePause.blocks?.length ?? 0, ") -- untruncated"] }), (activePause.blocks ?? []).length === 0 && (_jsx("div", { style: { color: '#f87171' }, children: "(none -- this call genuinely returned nothing)" })), (activePause.blocks ?? []).map((b, i) => (_jsxs("div", { style: { marginBottom: 12, paddingLeft: 8, borderLeft: '2px solid #1e2a38' }, children: [_jsxs("div", { style: { color: '#f0fdf4', fontWeight: 700, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }, children: [i + 1, ". ", b.title] }), _jsx("div", { style: { color: '#cbd5e1', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }, children: b.body }), _jsx("div", { style: { color: '#475569', wordBreak: 'break-all' }, children: b.url })] }, i)))] })) : (_jsxs(_Fragment, { children: [transcript.map((evt, i) => _jsx(TranscriptLine, { evt: evt }, i)), _jsx("div", { ref: bottomRef })] })) }), _jsx("div", { style: { width: 6, flexShrink: 0, background: '#1e2a38' } }), _jsxs("div", { style: { width: rightW || 280, flexShrink: 0, background: '#0d1117', padding: 14, display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }, children: [_jsxs("div", { style: { color: '#fbbf24', fontWeight: 700, fontFamily: 'system-ui, sans-serif', fontSize: 13 }, children: ["AUDIBLE -- call ", activePause.callIndex, ", ", activePause.phase === 'before_query' ? 'before it goes out' : 'after it came back'] }), _jsx("div", { style: { fontSize: 11, color: '#64748b', fontFamily: 'system-ui, sans-serif' }, children: "The run is stopped inside the engine right now. It waits until you press a button -- there is no timer." }), activePause.phase === 'before_query' ? (_jsxs(_Fragment, { children: [_jsx("label", { style: { fontSize: 11, color: '#94a3b8', fontFamily: 'system-ui, sans-serif' }, children: "The query about to be sent. Edit it and press Go to send yours instead; leave it alone and Go sends exactly what the method wrote." }), _jsx("textarea", { ref: pauseQueryRef, value: pauseQuery, onChange: (e) => setPauseQuery(e.target.value), onFocus: () => { lastBox.current = 'query'; }, onKeyDown: handlePauseKeyDown, disabled: pauseAnswering, rows: 6, wrap: "soft", style: {
                                                background: '#05080d', border: `1px solid ${pauseQuery !== activePause.query ? '#f59e0b' : '#334155'}`,
                                                borderRadius: 6, color: '#e2e8f0', padding: '8px 10px', fontSize: 13,
                                                fontFamily: 'Consolas, monospace', outline: 'none', width: '100%', boxSizing: 'border-box',
                                                minHeight: 130, resize: 'vertical', whiteSpace: 'pre-wrap', overflowWrap: 'break-word', lineHeight: 1.5,
                                            } }), pauseQuery !== activePause.query && (_jsx("div", { style: { fontSize: 11, color: '#f59e0b', fontFamily: 'system-ui, sans-serif' }, children: "Changed. Go will send your wording, verbatim, and record it as a rewrite." }))] })) : (_jsx("div", { style: { fontSize: 11, color: '#64748b', fontFamily: 'system-ui, sans-serif' }, children: "The query is already spent, so there is nothing to rewrite here. To change what a call fetches, rewrite the QUERY on the way out. Hand-writing a fact at this point would put unsourced text into the evidence chain, which is the one thing this estate does not do." })), _jsx("label", { style: { fontSize: 11, color: '#94a3b8', fontFamily: 'system-ui, sans-serif' }, children: "Your note on this call (recorded verbatim; blank is fine)" }), _jsx("textarea", { ref: pauseNoteRef, value: pauseNote, onChange: (e) => setPauseNote(e.target.value), onFocus: () => { lastBox.current = 'note'; }, onKeyDown: handlePauseKeyDown, disabled: pauseAnswering, rows: 8, wrap: "soft", placeholder: 'Type as much as you want. Enter makes a new line.\nNothing advances until you press a button (or Ctrl+Enter for Go).', style: {
                                        background: '#05080d', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0',
                                        padding: '8px 10px', fontSize: 13, fontFamily: 'Consolas, monospace', outline: 'none',
                                        width: '100%', boxSizing: 'border-box', minHeight: 180, resize: 'vertical',
                                        whiteSpace: 'pre-wrap', overflowWrap: 'break-word', lineHeight: 1.5,
                                    } }), _jsxs("div", { style: { borderTop: '1px solid #1e2a38', paddingTop: 8 }, children: [_jsxs("button", { type: "button", onClick: () => setNotesOpen((v) => !v), style: {
                                                background: 'none', border: 'none', color: '#22d3ee', fontSize: 12, fontWeight: 700,
                                                padding: 0, cursor: 'pointer', fontFamily: 'system-ui, sans-serif', outline: 'none',
                                            }, children: [notesOpen ? '▾' : '▸', " Your earlier notes", notesState === 'loaded' && ` (${notesFiles.reduce((n, f) => n + f.notes.length, 0)})`, notesState === 'loading' && ' (reading…)'] }), notesOpen && (_jsxs("div", { style: { marginTop: 8, maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }, children: [notesState === 'unavailable' && (_jsx("div", { style: { fontSize: 11, color: '#fca5a5', fontFamily: 'system-ui, sans-serif' }, children: "Preload bridge missing (lianaNotesList) -- rebuild main and restart the app." })), notesState === 'loaded' && notesFiles.length === 0 && (_jsx("div", { style: { fontSize: 11, color: '#64748b', fontFamily: 'system-ui, sans-serif' }, children: "No teaching files found in the dropzone. That is \"none found\", not proof none exist -- if you expected some, say so and I will check the path rather than assume." })), notesFiles.map((f) => (_jsxs("div", { children: [_jsxs("div", { style: { fontSize: 10, color: '#475569', fontFamily: 'system-ui, sans-serif', marginBottom: 4 }, children: [f.label, " \u00B7 ", f.writtenAt.slice(0, 16).replace('T', ' '), "Z", f.abandoned ? ' · ended early' : '', " \u00B7 ", f.notes.length, " note", f.notes.length === 1 ? '' : 's'] }), f.notes.map((n, i) => {
                                                            const key = `${f.filePath}#${i}`;
                                                            const open = expandedNote === key;
                                                            return (_jsxs("div", { style: { marginBottom: 6, paddingLeft: 6, borderLeft: '2px solid #1e2a38' }, children: [_jsxs("div", { style: { display: 'flex', gap: 6, alignItems: 'baseline' }, children: [_jsxs("button", { type: "button", onClick: () => setExpandedNote(open ? null : key), title: n.heading, style: {
                                                                                    background: 'none', border: 'none', color: '#94a3b8', fontSize: 11,
                                                                                    padding: 0, cursor: 'pointer', textAlign: 'left', flex: 1,
                                                                                    fontFamily: 'system-ui, sans-serif', outline: 'none',
                                                                                }, children: [n.stepIndex != null ? `step ${n.stepIndex}` : 'teach box', " \u00B7 ", n.text.length, " chars", ' — ', _jsx("span", { style: { color: '#64748b' }, children: open ? '(hide)' : `${n.text.slice(0, 44).replace(/\s+/g, ' ')}…` })] }), _jsx("button", { type: "button", onClick: () => insertNote(n.text), style: {
                                                                                    background: 'none', border: '1px solid #334155', borderRadius: 4,
                                                                                    color: '#22d3ee', fontSize: 10, fontWeight: 700, padding: '2px 7px',
                                                                                    cursor: 'pointer', fontFamily: 'system-ui, sans-serif', outline: 'none', flexShrink: 0,
                                                                                }, children: "Insert" })] }), open && (_jsx("div", { style: {
                                                                            marginTop: 4, fontSize: 11, color: '#cbd5e1', whiteSpace: 'pre-wrap',
                                                                            wordBreak: 'break-word', fontFamily: 'Consolas, monospace', lineHeight: 1.45,
                                                                        }, children: n.text }))] }, key));
                                                        })] }, f.filePath)))] }))] }), _jsx("button", { type: "button", onClick: () => void answerPause('go'), disabled: pauseAnswering, style: {
                                        background: pauseAnswering ? '#1e2a38' : 'linear-gradient(135deg, #059669, #10b981)',
                                        color: pauseAnswering ? '#64748b' : '#fff', border: 'none', borderRadius: 6,
                                        padding: '8px 10px', fontSize: 13, fontWeight: 700, cursor: pauseAnswering ? 'default' : 'pointer',
                                        fontFamily: 'system-ui, sans-serif', outline: 'none',
                                    }, children: pauseAnswering
                                        ? 'Sending…'
                                        : activePause.phase === 'before_query'
                                            ? (pauseQuery !== activePause.query ? 'Go -- send my wording ▸' : 'Go -- send it ▸')
                                            : 'Go -- use this result ▸' }), _jsx("button", { type: "button", onClick: () => void answerPause('skip'), disabled: pauseAnswering, style: {
                                        background: 'none', border: '1px solid #334155', borderRadius: 6,
                                        color: pauseAnswering ? '#334155' : '#94a3b8', padding: '7px 10px', fontSize: 12,
                                        cursor: pauseAnswering ? 'default' : 'pointer', fontFamily: 'system-ui, sans-serif', outline: 'none',
                                    }, children: activePause.phase === 'before_query' ? 'Skip this call' : 'Discard this result' }), _jsx("button", { type: "button", onClick: () => void answerPause('abandon'), disabled: pauseAnswering, style: {
                                        background: 'none', border: '1px solid #7f1d1d', borderRadius: 6,
                                        color: pauseAnswering ? '#334155' : '#fca5a5', padding: '7px 10px', fontSize: 12, fontWeight: 700,
                                        cursor: pauseAnswering ? 'default' : 'pointer', fontFamily: 'system-ui, sans-serif', outline: 'none',
                                    }, children: "End the run" }), _jsx("div", { style: { fontSize: 10, color: '#475569', fontFamily: 'system-ui, sans-serif' }, children: "Ending keeps every note you have typed so far. Skipping is not an error -- the methods already handle a call that returns nothing." })] })] })) : activeSteppedPause ? (_jsxs(_Fragment, { children: [_jsxs("div", { style: {
                                flex: 1.6, minWidth: 0, background: '#05080d', overflowY: 'auto', padding: '10px 14px',
                                fontFamily: 'Consolas, "Courier New", monospace', fontSize: 12, lineHeight: 1.5,
                            }, children: [_jsxs("div", { style: { color: '#c4b5fd', fontWeight: 700, marginBottom: 8, fontFamily: 'system-ui, sans-serif', fontSize: 13 }, children: ["STEPPED AUDIBLE -- step ", activeSteppedPause.stepIndex, " of ", activeSteppedPause.stepTotal, " just completed: ", activeSteppedPause.step.codeLabel] }), activeSteppedPause.events.map((evt, i) => _jsx(TranscriptLine, { evt: evt }, i))] }), _jsx("div", { style: { width: 6, flexShrink: 0, background: '#1e2a38' } }), _jsxs("div", { style: { width: rightW || 280, flexShrink: 0, background: '#0d1117', padding: 14, display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }, children: [_jsxs("div", { style: { color: '#c4b5fd', fontWeight: 700, fontFamily: 'system-ui, sans-serif', fontSize: 13 }, children: ["STEP ", activeSteppedPause.stepIndex, "/", activeSteppedPause.stepTotal, " -- ", activeSteppedPause.step.attribution === 'ATTRIBUTED' ? `Founder step ${activeSteppedPause.step.founderStepNumber}` : 'UNATTRIBUTED — TARE'] }), _jsx("div", { style: { fontSize: 11, color: '#64748b', fontFamily: 'system-ui, sans-serif' }, children: "The run is stopped inside the engine right now. It waits until you press a button -- there is no timer." }), activeSteppedPause.step.attribution === 'ATTRIBUTED' ? (_jsxs("div", { style: {
                                        background: '#111827', border: '1px solid #334155', borderRadius: 6, padding: '8px 10px',
                                        fontSize: 12, color: '#e2e8f0', fontFamily: 'Consolas, monospace', lineHeight: 1.5, whiteSpace: 'pre-wrap',
                                    }, children: ["\u201C", activeSteppedPause.step.founderWords, "\u201D", _jsxs("div", { style: { marginTop: 6, fontSize: 10, color: '#64748b', fontFamily: 'system-ui, sans-serif' }, children: ["\u2014 ", activeSteppedPause.step.founderSource] })] })) : (_jsx("div", { style: {
                                        background: '#2a1414', border: '1px solid #7f1d1d', borderRadius: 6, padding: '8px 10px',
                                        fontSize: 12, color: '#fca5a5', fontFamily: 'system-ui, sans-serif', lineHeight: 1.5,
                                    }, children: "This step has NO Founder order behind it. It is not one of his numbered steps -- surfaced here rather than silently mapped to one it does not fit (HARDWIRE-23)." })), activeSteppedPause.suggestions.length > 0 && (_jsxs("div", { children: [_jsx("div", { style: { fontSize: 11, color: '#94a3b8', fontFamily: 'system-ui, sans-serif', fontWeight: 700, marginBottom: 4 }, children: "Bishop suggestions \u2014 NO authority, may be struck without consequence:" }), _jsx("ul", { style: { margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }, children: activeSteppedPause.suggestions.map((s, i) => (_jsx("li", { style: { fontSize: 11, color: '#a1a1aa', fontFamily: 'system-ui, sans-serif', lineHeight: 1.4 }, children: s }, i))) })] })), _jsx("label", { style: { fontSize: 11, color: '#94a3b8', fontFamily: 'system-ui, sans-serif' }, children: activeSteppedPause.step.key === 'step0'
                                        ? 'Your response or correction, OR a query for "Send to Google" below (recorded/sent verbatim; blank is fine)'
                                        : 'Your response or correction (recorded verbatim as the authority record; blank is fine)' }), _jsx("textarea", { ref: steppedResponseRef, value: steppedResponseText, onChange: (e) => setSteppedResponseText(e.target.value), onKeyDown: handleSteppedResponseKeyDown, disabled: steppedAnswering, rows: 8, wrap: "soft", placeholder: 'Type as much as you want. Enter makes a new line.\nNothing advances until you press a button (or Ctrl+Enter for Approve).', style: {
                                        background: '#05080d', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0',
                                        padding: '8px 10px', fontSize: 13, fontFamily: 'Consolas, monospace', outline: 'none',
                                        width: '100%', boxSizing: 'border-box', minHeight: 160, resize: 'vertical',
                                        whiteSpace: 'pre-wrap', overflowWrap: 'break-word', lineHeight: 1.5,
                                    } }), activeSteppedPause.step.key === 'step0' && (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 4 }, children: [_jsx("button", { type: "button", onClick: () => void openNexusTabsFromPause(), style: {
                                                background: 'none', border: '1px solid #a78bfa', borderRadius: 6,
                                                color: '#c4b5fd', padding: '8px 10px', fontSize: 13, fontWeight: 700,
                                                cursor: 'pointer', fontFamily: 'system-ui, sans-serif', outline: 'none',
                                            }, title: "Opens the 5 tabs we already use (Google, Perplexity, Claude, ChatGPT, Gemini) -- type your query there yourself, then press Capture in that window.", children: "Open the 5 tabs we already use" }), nexusOpenStatus && (_jsx("div", { style: { fontSize: 10, color: '#fca5a5', fontFamily: 'system-ui, sans-serif' }, children: nexusOpenStatus }))] })), activeSteppedPause.step.key === 'step0' && (_jsx("button", { type: "button", onClick: () => void answerSteppedPause('ask_google'), disabled: steppedAnswering, style: {
                                        background: 'none', border: '1px solid #38bdf8', borderRadius: 6,
                                        color: steppedAnswering ? '#334155' : '#7dd3fc', padding: '8px 10px', fontSize: 13, fontWeight: 700,
                                        cursor: steppedAnswering ? 'default' : 'pointer', fontFamily: 'system-ui, sans-serif', outline: 'none',
                                    }, children: "Send to Google \u2014 sends the box above verbatim, pauses again with the raw response" })), activeSteppedPause.step.key === 'step0' && (_jsxs("div", { style: {
                                        background: '#0d1524', border: '1px solid #1e3a5f', borderRadius: 6, padding: 10,
                                        display: 'flex', flexDirection: 'column', gap: 8,
                                    }, children: [_jsx("div", { style: { fontSize: 11, color: '#7dd3fc', fontWeight: 700, fontFamily: 'system-ui, sans-serif' }, children: "LABORATORY \u2014 ephemeral unless you Keep it" }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 6 }, children: [_jsx("label", { style: { fontSize: 10, color: '#94a3b8', fontFamily: 'system-ui, sans-serif' }, children: lastAskGoogleQuery
                                                        ? 'Name for the query you just sent — Keep saves it as a Laboratory step'
                                                        : 'Send a query to Google above first — then you can name and Keep it' }), _jsxs("div", { style: { display: 'flex', gap: 6 }, children: [_jsx("input", { value: laboratoryName, onChange: (e) => setLaboratoryName(e.target.value), disabled: !lastAskGoogleQuery || laboratorySaving, placeholder: "e.g. smallest question set", style: {
                                                                flex: 1, background: '#05080d', border: '1px solid #334155', borderRadius: 6,
                                                                color: '#e2e8f0', padding: '6px 8px', fontSize: 12, fontFamily: 'Consolas, monospace', outline: 'none',
                                                            } }), _jsx("button", { type: "button", onClick: () => void handleKeepLaboratoryStep(), disabled: !lastAskGoogleQuery || !laboratoryName.trim() || laboratorySaving, style: {
                                                                background: 'none', border: '1px solid #38bdf8', borderRadius: 6,
                                                                color: (!lastAskGoogleQuery || !laboratoryName.trim() || laboratorySaving) ? '#334155' : '#7dd3fc',
                                                                padding: '6px 10px', fontSize: 12, fontWeight: 700,
                                                                cursor: (!lastAskGoogleQuery || !laboratoryName.trim() || laboratorySaving) ? 'default' : 'pointer',
                                                                fontFamily: 'system-ui, sans-serif', outline: 'none', whiteSpace: 'nowrap',
                                                            }, children: laboratorySaving ? 'Keeping…' : 'Keep' })] }), laboratoryResult && (_jsx("div", { style: { fontSize: 10, fontFamily: 'monospace', color: laboratoryResult.ok ? '#86efac' : '#fca5a5', wordBreak: 'break-word' }, children: laboratoryResult.ok
                                                        ? `saved: ${laboratoryResult.path} (version ${laboratoryResult.version})`
                                                        : `NOT saved: ${laboratoryResult.error}` }))] }), _jsx("button", { type: "button", onClick: () => {
                                                const next = !laboratoryOpen;
                                                setLaboratoryOpen(next);
                                                if (next && laboratoryListState === 'idle')
                                                    void loadLaboratorySteps();
                                            }, style: {
                                                background: 'none', border: '1px solid #334155', borderRadius: 6, color: '#94a3b8',
                                                padding: '5px 8px', fontSize: 11, cursor: 'pointer', fontFamily: 'system-ui, sans-serif',
                                                outline: 'none', alignSelf: 'flex-start',
                                            }, children: laboratoryOpen ? 'Hide saved steps ▾' : 'Show saved steps ▸' }), laboratoryOpen && (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 180, overflowY: 'auto' }, children: [laboratoryListState === 'loading' && (_jsx("div", { style: { fontSize: 11, color: '#64748b', fontFamily: 'system-ui, sans-serif' }, children: "loading\u2026" })), laboratoryListState === 'unavailable' && (_jsx("div", { style: { fontSize: 11, color: '#fca5a5', fontFamily: 'system-ui, sans-serif' }, children: "Laboratory list unavailable \u2014 rebuild main and restart the app." })), laboratoryListState === 'loaded' && laboratorySteps.length === 0 && (_jsx("div", { style: { fontSize: 11, color: '#475569', fontFamily: 'system-ui, sans-serif' }, children: "none saved yet" })), laboratorySteps.map((step) => (_jsxs("div", { style: {
                                                        display: 'flex', alignItems: 'center', gap: 6, background: '#111827',
                                                        border: '1px solid #1e293b', borderRadius: 6, padding: '5px 8px',
                                                    }, children: [_jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [_jsxs("div", { style: {
                                                                        fontSize: 11, color: '#e2e8f0', fontFamily: 'system-ui, sans-serif', fontWeight: 700,
                                                                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                                    }, children: [step.name, " ", _jsxs("span", { style: { color: '#64748b', fontWeight: 400 }, children: ["v", step.version] })] }), _jsxs("div", { style: { fontSize: 10, color: '#64748b', fontFamily: 'system-ui, sans-serif' }, children: [step.savedAt, " \u00B7 from ", step.provenance.runInput || '(free text)'] })] }), _jsx("button", { type: "button", onClick: () => handleLoadLaboratoryStep(step), style: {
                                                                background: 'none', border: '1px solid #475569', borderRadius: 6, color: '#a1a1aa',
                                                                padding: '4px 8px', fontSize: 11, cursor: 'pointer', fontFamily: 'system-ui, sans-serif', outline: 'none',
                                                            }, children: "Load" })] }, `${step.name}::${step.version}`)))] })), _jsx("div", { style: { fontSize: 10, color: '#475569', fontFamily: 'system-ui, sans-serif', lineHeight: 1.4 }, children: "Keeping saves this query only \u2014 nothing here becomes a Method or a Playbook entry, and no success test runs against it. Loading fills the box above; it never sends anything by itself." })] })), _jsx("button", { type: "button", onClick: () => void answerSteppedPause('approve'), disabled: steppedAnswering, style: {
                                        background: steppedAnswering ? '#1e2a38' : 'linear-gradient(135deg, #059669, #10b981)',
                                        color: steppedAnswering ? '#64748b' : '#fff', border: 'none', borderRadius: 6,
                                        padding: '8px 10px', fontSize: 13, fontWeight: 700, cursor: steppedAnswering ? 'default' : 'pointer',
                                        fontFamily: 'system-ui, sans-serif', outline: 'none',
                                    }, children: steppedAnswering ? 'Sending…' : 'Approve — next step ▸' }), _jsx("button", { type: "button", onClick: () => void answerSteppedPause('correct'), disabled: steppedAnswering, style: {
                                        background: 'none', border: '1px solid #a78bfa', borderRadius: 6,
                                        color: steppedAnswering ? '#334155' : '#c4b5fd', padding: '7px 10px', fontSize: 12, fontWeight: 700,
                                        cursor: steppedAnswering ? 'default' : 'pointer', fontFamily: 'system-ui, sans-serif', outline: 'none',
                                    }, children: "Correct \u2014 record this as a correction, next step \u25B8" }), _jsx("button", { type: "button", onClick: () => void answerSteppedPause('redirect'), disabled: steppedAnswering, style: {
                                        background: 'none', border: '1px solid #334155', borderRadius: 6,
                                        color: steppedAnswering ? '#334155' : '#94a3b8', padding: '7px 10px', fontSize: 12,
                                        cursor: steppedAnswering ? 'default' : 'pointer', fontFamily: 'system-ui, sans-serif', outline: 'none',
                                    }, children: "Redirect \u2014 record for a future build, next step \u25B8" }), _jsx("button", { type: "button", onClick: () => void answerSteppedPause('abandon'), disabled: steppedAnswering, style: {
                                        background: 'none', border: '1px solid #7f1d1d', borderRadius: 6,
                                        color: steppedAnswering ? '#334155' : '#fca5a5', padding: '7px 10px', fontSize: 12, fontWeight: 700,
                                        cursor: steppedAnswering ? 'default' : 'pointer', fontFamily: 'system-ui, sans-serif', outline: 'none',
                                    }, children: "End the run" }), _jsx("div", { style: { fontSize: 10, color: '#475569', fontFamily: 'system-ui, sans-serif' }, children: activeSteppedPause.step.key === 'step0'
                                        ? 'Approve / Correct / Redirect / End the run change nothing about what the method '
                                            + 'already did or does next — this panel only observes and records (HARDWIRE-23). '
                                            + 'Send to Google is the one exception (D-BP152-021, FD-BP152-15): it sends the box '
                                            + 'above to Google, verbatim, and pauses again with the raw response. Ending keeps '
                                            + 'every response typed so far, including every Send to Google exchange.'
                                        : 'None of these four buttons change what the method already did or does next — this '
                                            + 'panel only observes and records (HARDWIRE-23). Ending keeps every response typed so '
                                            + 'far.' })] })] })) : walkActive ? (_jsxs(_Fragment, { children: [_jsxs("div", { style: {
                                flex: 1.6, minWidth: 0, background: '#05080d', overflowY: 'auto', padding: '10px 14px',
                                fontFamily: 'Consolas, "Courier New", monospace', fontSize: 12, lineHeight: 1.5,
                            }, children: [_jsxs("div", { style: { color: '#60a5fa', fontWeight: 700, marginBottom: 8, fontFamily: 'system-ui, sans-serif', fontSize: 13 }, children: ["AUDIT THE RUN -- STEP ", walkIndex + 1, " of ", walkSteps.length, walkIndex === 0 ? '  (the question, as the engine has it, and every option)' : ''] }), (walkSteps[walkIndex] ?? []).map((evt, i) => _jsx(TranscriptLine, { evt: evt }, i))] }), _jsx("div", { style: { width: 6, flexShrink: 0, background: '#1e2a38' } }), _jsxs("div", { style: { width: rightW || 280, flexShrink: 0, background: '#0d1117', padding: 14, display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }, children: [_jsx("div", { style: { fontSize: 11, color: '#64748b', fontFamily: 'system-ui, sans-serif' }, children: "Same queries, same order, same terminator as the run that already happened -- this walk is a pacing layer over that captured transcript, not a second run." }), _jsx("label", { style: { fontSize: 11, color: '#94a3b8', fontFamily: 'system-ui, sans-serif' }, children: "Your note on this step (saved when you press Go; blank is fine)" }), _jsx("textarea", { ref: walkInputRef, value: walkInput, onChange: (e) => setWalkInput(e.target.value), onKeyDown: handleWalkInputKeyDown, disabled: walkSubmitting, rows: 12, wrap: "soft", placeholder: 'Type as much as you want. Enter makes a new line.\nThe walk only advances when you press Go (or Ctrl+Enter).', style: {
                                        background: '#05080d', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0',
                                        padding: '8px 10px', fontSize: 13, fontFamily: 'Consolas, monospace', outline: 'none',
                                        width: '100%', boxSizing: 'border-box', minHeight: 260, resize: 'vertical',
                                        whiteSpace: 'pre-wrap', overflowWrap: 'break-word', lineHeight: 1.5,
                                    } }), _jsx("button", { type: "button", onClick: handleWalkGo, disabled: walkSubmitting, style: {
                                        background: walkSubmitting ? '#1e2a38' : 'linear-gradient(135deg, #059669, #10b981)',
                                        color: walkSubmitting ? '#64748b' : '#fff', border: 'none', borderRadius: 6,
                                        padding: '8px 10px', fontSize: 13, fontWeight: 700, cursor: walkSubmitting ? 'default' : 'pointer',
                                        fontFamily: 'system-ui, sans-serif', outline: 'none',
                                    }, children: walkSubmitting ? 'Writing…' : (walkIndex + 1 < walkSteps.length ? 'Go ▸' : 'Go -- finish walk ▸') }), _jsx("button", { type: "button", onClick: handleAbandonWalk, disabled: walkSubmitting, style: {
                                        background: 'none', border: '1px solid #7f1d1d', borderRadius: 6,
                                        color: walkSubmitting ? '#334155' : '#fca5a5', padding: '7px 10px', fontSize: 12, fontWeight: 700,
                                        cursor: walkSubmitting ? 'default' : 'pointer', fontFamily: 'system-ui, sans-serif', outline: 'none',
                                    }, children: "End the audit" }), walkResult && !walkResult.ok && (_jsxs("div", { style: { fontSize: 10, fontFamily: 'monospace', color: '#fca5a5', wordBreak: 'break-word' }, children: ["failed: ", walkResult.error] })), _jsx("div", { style: { marginTop: 'auto', fontSize: 10, color: '#334155', fontFamily: 'system-ui, sans-serif', lineHeight: 1.5 }, children: "Your response is recorded verbatim against this exact step and shown in the transcript on the left -- it never changes what already ran. A human reads the teaching file afterward and implements any correction by hand." })] })] })) : (_jsxs(_Fragment, { children: [_jsxs("div", { style: {
                                flex: 1.6, minWidth: 0, background: '#05080d', overflowY: 'auto', padding: '10px 14px',
                                fontFamily: 'Consolas, "Courier New", monospace', fontSize: 12, lineHeight: 1.5,
                            }, children: [transcript.length === 0 && (_jsxs("div", { style: { color: '#334155' }, children: ["Type a bundled MMLU-Pro question id (e.g. 98) or a plain question in the panel on the right, then press Enter.", '\n', "The cascade runs here, live, stage by stage -- nothing is pasted in from outside."] })), transcript.map((evt, i) => _jsx(TranscriptLine, { evt: evt }, i)), running && (_jsx("div", { style: { color: '#22d3ee', marginTop: 4 }, children: _jsx("span", { style: { opacity: 0.6 }, children: "\u258C running\u2026" }) })), _jsx("div", { ref: bottomRef })] }), _jsx("div", { onMouseDown: () => setDragging(true), onDoubleClick: halveScreen, title: "Drag to resize. Double-click for an even split.", style: {
                                width: 6, flexShrink: 0, cursor: 'col-resize',
                                background: dragging ? '#22d3ee' : '#1e2a38',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }, children: _jsx("div", { style: { width: 2, height: 34, borderRadius: 1, background: dragging ? '#0d1117' : '#334155' } }) }), _jsxs("div", { style: { width: rightW || 280, flexShrink: 0, background: '#0d1117', padding: 14, display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }, children: [_jsx("label", { style: { fontSize: 11, color: '#94a3b8', fontFamily: 'system-ui, sans-serif' }, children: "Question or qid" }), _jsx("input", { ref: inputRef, value: input, onChange: (e) => setInput(e.target.value), onKeyDown: handleKeyDown, disabled: running, placeholder: "98  or  What is...", style: {
                                        background: '#05080d', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0',
                                        padding: '8px 10px', fontSize: 13, fontFamily: 'Consolas, monospace', outline: 'none',
                                    } }), _jsx("button", { type: "button", onClick: () => void handleRun(), disabled: running || standingRunActive || !input.trim(), style: {
                                        background: running || standingRunActive || !input.trim() ? '#1e2a38' : 'linear-gradient(135deg, #059669, #10b981)',
                                        color: running || standingRunActive || !input.trim() ? '#64748b' : '#fff', border: 'none', borderRadius: 6,
                                        padding: '8px 10px', fontSize: 13, fontWeight: 700, cursor: running || standingRunActive || !input.trim() ? 'default' : 'pointer',
                                        fontFamily: 'system-ui, sans-serif', outline: 'none',
                                    }, children: running ? 'Running…' : 'Run ▸' }), _jsxs("div", { style: { border: '1px solid #334155', borderRadius: 6, overflow: 'hidden' }, children: [_jsxs("button", { type: "button", onClick: toggleComposerOpen, style: {
                                                width: '100%', textAlign: 'left', background: composerOpen ? '#1e2a38' : '#0d1117',
                                                color: '#e2e8f0', border: 'none', padding: '8px 10px', fontSize: 12, fontWeight: 700,
                                                cursor: 'pointer', fontFamily: 'system-ui, sans-serif', display: 'flex',
                                                justifyContent: 'space-between', alignItems: 'center',
                                            }, children: [_jsxs("span", { children: ["Composer", composerStack.length > 0 ? `  ·  ${composerStack.length} step${composerStack.length === 1 ? '' : 's'} in the stack` : ''] }), _jsx("span", { style: { color: '#64748b' }, children: composerOpen ? '▾' : '▸' })] }), composerOpen && (_jsxs("div", { style: { padding: 10, display: 'flex', flexDirection: 'column', gap: 10, background: '#05080d' }, children: [_jsx("div", { style: { fontSize: 11, color: '#64748b', fontFamily: 'system-ui, sans-serif' }, children: "Pick steps from the list below, in whatever order you want. An empty stack just runs the normal way." }), _jsxs("div", { children: [_jsx("div", { style: { fontSize: 11, color: '#94a3b8', fontFamily: 'system-ui, sans-serif', marginBottom: 4 }, children: "Your stack (runs top to bottom):" }), composerStack.length === 0 && (_jsx("div", { style: { fontSize: 11, color: '#475569', fontFamily: 'system-ui, sans-serif', fontStyle: 'italic' }, children: "Nothing added yet -- Run this stack below will just run the normal way." })), composerStack.length > 0 && (_jsx("div", { style: {
                                                                maxHeight: 180, minHeight: 44, overflowY: 'auto', resize: 'vertical',
                                                                border: '1px solid #1e2a38', borderRadius: 4, padding: 2,
                                                            }, children: composerStack.map((id, i) => (_jsxs("div", { style: {
                                                                    display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px', marginBottom: 3,
                                                                    background: '#0d1117', border: '1px solid #1e2a38', borderRadius: 4,
                                                                }, children: [_jsxs("span", { style: { color: '#475569', fontSize: 11, fontFamily: 'monospace', width: 18 }, children: [i + 1, "."] }), _jsx("span", { style: { color: '#e2e8f0', fontSize: 12, fontFamily: 'monospace', flex: 1 }, children: id }), _jsx("button", { type: "button", onClick: () => moveComposerStepUp(i), disabled: i === 0, title: "Move up", style: { background: 'none', border: '1px solid #334155', borderRadius: 4, color: i === 0 ? '#334155' : '#94a3b8', cursor: i === 0 ? 'default' : 'pointer', padding: '2px 6px', fontSize: 11 }, children: "\u25B2" }), _jsx("button", { type: "button", onClick: () => moveComposerStepDown(i), disabled: i === composerStack.length - 1, title: "Move down", style: { background: 'none', border: '1px solid #334155', borderRadius: 4, color: i === composerStack.length - 1 ? '#334155' : '#94a3b8', cursor: i === composerStack.length - 1 ? 'default' : 'pointer', padding: '2px 6px', fontSize: 11 }, children: "\u25BC" }), _jsx("button", { type: "button", onClick: () => removeComposerStep(i), title: "Remove", style: { background: 'none', border: '1px solid #7f1d1d', borderRadius: 4, color: '#fca5a5', cursor: 'pointer', padding: '2px 6px', fontSize: 11 }, children: "Remove" })] }, `${id}-${i}`))) }))] }), _jsx("button", { type: "button", onClick: () => void runComposerStack(), disabled: composerRunning || standingRunActive || running || !input.trim(), style: {
                                                        background: composerRunning || standingRunActive || running || !input.trim() ? '#1e2a38' : 'linear-gradient(135deg, #7c3aed, #a78bfa)',
                                                        color: composerRunning || standingRunActive || running || !input.trim() ? '#64748b' : '#fff', border: 'none', borderRadius: 6,
                                                        padding: '8px 10px', fontSize: 12, fontWeight: 700,
                                                        cursor: composerRunning || standingRunActive || running || !input.trim() ? 'default' : 'pointer',
                                                        fontFamily: 'system-ui, sans-serif', outline: 'none',
                                                    }, children: composerRunning ? 'Running…' : 'Run this stack ▸' }), _jsx("button", { type: "button", onClick: () => void runStandingTwenty(), disabled: composerRunning || standingRunActive || running, title: "Runs campaign qids 1,7,14,20,27,33,40,46,53,59,66,72,79,85,92,98,105,111,118,124 through this stack, one at a time, live.", style: {
                                                        background: composerRunning || standingRunActive || running ? '#1e2a38' : 'linear-gradient(135deg, #0f766e, #14b8a6)',
                                                        color: composerRunning || standingRunActive || running ? '#64748b' : '#fff', border: 'none', borderRadius: 6,
                                                        padding: '8px 10px', fontSize: 12, fontWeight: 700,
                                                        cursor: composerRunning || standingRunActive || running ? 'default' : 'pointer',
                                                        fontFamily: 'system-ui, sans-serif', outline: 'none', marginTop: 6,
                                                    }, children: standingRunActive
                                                        ? `Running the standing 20… (${standingRunRows.filter((r) => r.status === 'done' || r.status === 'error').length}/${STANDING_20_CAMPAIGN_QIDS.length})`
                                                        : 'Test it yourself: run the standing 20 ▸' }), standingRunRows.length > 0 && (_jsxs("div", { style: {
                                                        fontSize: 11, fontFamily: 'monospace', color: '#e2e8f0', marginTop: 6,
                                                        maxHeight: 220, overflowY: 'auto', resize: 'vertical',
                                                        border: '1px solid #1e2a38', borderRadius: 4, padding: 6,
                                                    }, children: [_jsx("div", { style: { color: '#94a3b8', fontFamily: 'system-ui, sans-serif', marginBottom: 4 }, children: "Standing 20 -- live, one observation per question (never a rate; see NOISE_FLOOR_BP148):" }), standingRunRows.map((row) => {
                                                            const label = row.status === 'pending' ? 'pending'
                                                                : row.status === 'running' ? 'RUNNING…'
                                                                    : row.status === 'error' ? `ERROR: ${row.error}`
                                                                        : `${row.verdict ? `VERDICT ${row.verdict}` : 'ABSTAIN'}${row.incomplete ? ' (incomplete)' : ''} -- keyed label: ${row.keyedCls ?? 'n/a'}`;
                                                            const dot = row.status === 'pending' ? '#334155'
                                                                : row.status === 'running' ? '#eab308'
                                                                    : row.status === 'error' ? '#ef4444'
                                                                        : row.verdict ? '#22c55e' : '#94a3b8';
                                                            return (_jsxs("div", { style: { display: 'flex', alignItems: 'baseline', gap: 6, padding: '2px 0' }, children: [_jsx("span", { style: { color: dot, fontSize: 14, lineHeight: 1 }, children: "\u25CF" }), _jsx("span", { style: { color: '#64748b', width: 32 }, children: `qid ${row.qid}` }), _jsx("span", { style: { color: '#cbd5e1' }, children: label })] }, row.qid));
                                                        })] })), composerResult && composerResult.mode === 'stack' && (_jsxs("div", { style: { fontSize: 11, fontFamily: 'monospace', color: '#e2e8f0' }, children: [_jsx("div", { style: { color: '#94a3b8', fontFamily: 'system-ui, sans-serif', marginBottom: 4 }, children: "What happened, step by step:" }), composerResult.result.error && composerResult.result.steps.length === 0 && (_jsxs("div", { style: { color: '#fca5a5' }, children: ["Could not run: ", composerResult.result.error] })), composerResult.result.steps.map((s, i) => {
                                                            // D-BP154-017/BISHOP-SEG/S17/seg-classify -- PROVEN/CORROBORATED/ANSWERED/
                                                            // ABSTAIN, shown after every step (Founder, BP154: "so that we can see what
                                                            // is happening and how well or not what we put in worked"), clickable to the
                                                            // provenance chain. classifyComposerStepResult() only reads structural fields
                                                            // already on the step's own result -- never the answer key.
                                                            const raw = composerResult.result.results[i]?.raw;
                                                            // D-BP154-036/BISHOP-SEG/S36/seg-wireit, ADDITIVE: for Terminator:1 ONLY, prefer
                                                            // the main process's own keyedTerminatorLabel (FD-BP154-11's ANSWERED-row
                                                            // amendment, computed AFTER the run already finished -- see script_bridge.ts's
                                                            // ComposedRunResult.keyedTerminatorLabel for the D-BP153-003 boundary this
                                                            // observes) over the blind re-classification below. Every other step keeps
                                                            // reading its own blind classification exactly as before this ticket.
                                                            const cls = s.status === 'ok' && raw !== undefined
                                                                ? (s.id === 'Terminator:1' && composerResult.result.keyedTerminatorLabel
                                                                    ? composerResult.result.keyedTerminatorLabel
                                                                    : classifyComposerStepResult(raw))
                                                                : null;
                                                            const style = cls ? COMPOSER_STEP_CLASS_STYLE[cls.cls] : null;
                                                            const expanded = expandedStepIndex === i;
                                                            const evidenceRecord = (() => {
                                                                const q = raw?.query;
                                                                if (typeof q !== 'string' || !q || !composerResult.evidence)
                                                                    return null;
                                                                return composerResult.evidence.records.find((r) => r.query === q) ?? null;
                                                            })();
                                                            return (_jsxs("div", { style: {
                                                                    padding: '4px 6px', marginBottom: 3, borderRadius: 4,
                                                                    background: s.status === 'ok' ? '#052e1e' : '#3f0a0a',
                                                                    border: `1px solid ${s.status === 'ok' ? '#059669' : '#991b1b'}`,
                                                                    cursor: cls ? 'pointer' : 'default',
                                                                }, onClick: () => { if (cls)
                                                                    setExpandedStepIndex(expanded ? null : i); }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }, children: [_jsxs("span", { children: [i + 1, ". ", s.id, "  (", s.durationMs, "ms)  ", s.status === 'ok' ? 'done' : 'did not finish'] }), style && (_jsxs("span", { title: style.description, style: {
                                                                                    display: 'inline-flex', alignItems: 'center', gap: 4,
                                                                                    background: style.colorBg, color: style.colorFg,
                                                                                    border: `1px solid ${style.colorFg}`, borderRadius: 10,
                                                                                    padding: '1px 8px', fontSize: 10, fontWeight: 700,
                                                                                    fontFamily: 'system-ui, sans-serif',
                                                                                }, children: [_jsx("span", { "aria-hidden": "true", children: style.icon }), style.label] })), cls && (_jsx("span", { style: { color: '#64748b', fontSize: 10, fontFamily: 'system-ui, sans-serif' }, children: expanded ? '▾ hide chain' : '▸ click for provenance chain' }))] }), _jsx("div", { style: { opacity: 0.85, marginTop: 2 }, children: composerResult.result.results[i]?.summary ?? s.error ?? s.whatChanged }), expanded && cls && (_jsxs("div", { style: {
                                                                            marginTop: 6, padding: '6px 8px', background: '#0d1117',
                                                                            border: '1px solid #1e2a38', borderRadius: 4, fontFamily: 'system-ui, sans-serif',
                                                                        }, children: [_jsxs("div", { style: { color: style?.colorFg, fontWeight: 700, marginBottom: 4 }, children: [style?.label, " -- ", cls.detail] }), cls.keyed && (_jsxs("div", { children: ["KEY: ", cls.keyed.answer, " (", cls.keyed.matchesVerdict === null ? 'no verdict to compare' : cls.keyed.matchesVerdict ? 'matches this run’s verdict' : 'DISAGREES with this run’s verdict', ")"] })), _jsxs("div", { children: ["MECHANISM: ", raw?.answerProvenance?.mechanism ?? 'NOT_OBTAINED'] }), _jsxs("div", { children: ["SOURCE: ", raw?.answerProvenance?.detail ?? '(missing -- shown as missing, not blank)'] }), _jsxs("div", { children: ["QUERY (verbatim): ", raw?.query ?? '(missing)'] }), _jsxs("div", { children: ["ACQUISITION: ", evidenceRecord ? `${evidenceRecord.acquisitionId} @ ${evidenceRecord.ts}` : (composerResult.evidence ? `${composerResult.evidence.acquisitionId} (this run)` : '(missing)')] }), (() => {
                                                                                const c = raw?.corroboration;
                                                                                if (!c)
                                                                                    return _jsx("div", { children: "CORROBORATION: not attempted for this step" });
                                                                                if (c.corroborated) {
                                                                                    return (_jsxs("div", { children: ["CORROBORATION: confirmed by \"", c.sourceTitle || c.sourceUrl, "\" (", c.sourceUrl, ")", _jsxs("div", { style: { opacity: 0.85 }, children: ["\"", c.span, "\""] })] }));
                                                                                }
                                                                                return _jsxs("div", { children: ["CORROBORATION: attempted, not obtained -- ", c.error ?? '(no reason given)'] });
                                                                            })()] }))] }, i));
                                                        })] })), composerResult && composerResult.mode === 'default' && (_jsx("div", { style: { fontSize: 11, fontFamily: 'system-ui, sans-serif', color: '#64748b' }, children: "Ran the normal way (the stack was empty) -- see the answer above." })), composerResult?.evidence && (_jsxs("div", { style: { border: '1px solid #334155', borderRadius: 6, overflow: 'hidden' }, children: [_jsx("div", { style: {
                                                                padding: '6px 10px', fontSize: 11, fontWeight: 700, color: '#e2e8f0',
                                                                background: '#0d1117', fontFamily: 'system-ui, sans-serif',
                                                            }, children: "THE PAIL -- this run's own evidence" }), _jsxs("div", { style: { padding: 10, background: '#05080d', fontSize: 11, fontFamily: 'monospace', color: '#e2e8f0' }, children: [_jsxs("div", { children: ["acquisition: ", composerResult.evidence.acquisitionId] }), _jsxs("div", { children: ["records written to the evidence store: ", composerResult.evidence.recordsWritten] }), composerResult.evidence.writeFailures.length > 0 && (_jsxs("div", { style: { color: '#fca5a5', marginTop: 4 }, children: [composerResult.evidence.writeFailures.length, " WRITE FAILURE(S) -- this acquisition is INCOMPLETE:", composerResult.evidence.writeFailures.map((f, i) => (_jsxs("div", { style: { marginLeft: 10 }, children: ["- [", f.authority, "] \"", f.query, "\": ", f.error] }, i)))] })), composerResult.evidence.records.length === 0 && (_jsx("div", { style: { color: '#475569', fontStyle: 'italic', marginTop: 4 }, children: "No authority query was issued on this run (nothing to keep)." })), composerResult.evidence.records.length > 0 && (_jsx("div", { style: {
                                                                        marginTop: 6, maxHeight: 220, minHeight: 60, overflowY: 'auto', resize: 'vertical',
                                                                        border: '1px solid #1e2a38', borderRadius: 4, padding: 4,
                                                                    }, children: composerResult.evidence.records.map((r, i) => {
                                                                        const resp = r.response;
                                                                        const answerPreview = (resp?.snippet || resp?.text || '(no answer text captured)').slice(0, 220);
                                                                        return (_jsxs("div", { style: { padding: '4px 6px', marginBottom: 4, background: '#0d1117', border: '1px solid #1e2a38', borderRadius: 4 }, children: [_jsxs("div", { style: { color: '#94a3b8' }, children: ["#", r.seq, " [", r.authority, "] ", r.ts] }), _jsxs("div", { style: { marginTop: 2 }, children: [_jsx("span", { style: { color: '#64748b' }, children: "query (verbatim): " }), r.query] }), _jsxs("div", { style: { marginTop: 2 }, children: [_jsx("span", { style: { color: '#64748b' }, children: "answer: " }), r.response === null ? '(recorded null -- asked, got nothing back)' : answerPreview] })] }, i));
                                                                    }) }))] })] })), _jsxs("div", { style: { border: '1px solid #334155', borderRadius: 6, overflow: 'hidden' }, children: [_jsxs("div", { style: {
                                                                padding: '6px 10px', fontSize: 11, fontWeight: 700, color: '#e2e8f0',
                                                                background: '#0d1117', fontFamily: 'system-ui, sans-serif',
                                                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                            }, children: [_jsx("span", { children: "THE FOUNDER'S HAND-WRITTEN PROOF (verbatim from disk)" }), _jsx("button", { type: "button", onClick: () => void loadFounderProof(), style: { background: 'none', border: 'none', color: '#22d3ee', cursor: 'pointer', fontSize: 11 }, children: "refresh" })] }), _jsxs("div", { style: { padding: 10, background: '#05080d', fontSize: 11, fontFamily: 'monospace', color: '#e2e8f0' }, children: [founderProofState === 'loading' && _jsx("div", { style: { color: '#475569' }, children: "Loading\u2026" }), founderProofState === 'unavailable' && _jsx("div", { style: { color: '#fca5a5' }, children: "Not available in this build." }), founderProofState === 'loaded' && founderProof && (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 10 }, children: [([
                                                                            { key: 'bp153', title: 'BP153_QID98_DERIVATION_FROM_EVIDENCE.md -- qid 98, derived from owned evidence' },
                                                                            { key: 'founderCascade', title: 'FOUNDER_CASCADE_WORKED_BY_HAND_VERBATIM_RECOVERED_BP144.md -- his hand-solved walkthrough' },
                                                                        ]).map(({ key, title }) => {
                                                                            const slice = founderProof[key];
                                                                            return (_jsxs("div", { children: [_jsx("div", { style: { color: '#94a3b8', fontFamily: 'system-ui, sans-serif', marginBottom: 2 }, children: title }), !slice.ok && (_jsx("div", { style: { color: '#fca5a5' }, children: slice.error })), slice.ok && (_jsxs(_Fragment, { children: [_jsxs("div", { style: { color: '#64748b', fontFamily: 'system-ui, sans-serif', fontSize: 10, marginBottom: 4 }, children: [slice.path, slice.lineRange && ` -- lines ${slice.lineRange[0]}-${slice.lineRange[1]}`, slice.byteOffsetRange && ` (bytes ${slice.byteOffsetRange[0]}-${slice.byteOffsetRange[1]} of ${slice.totalBytes})`, slice.error && _jsxs("span", { style: { color: '#facc15' }, children: [" -- ", slice.error] }), key === 'founderCascade' && !showWholeFounderCascade && (_jsxs(_Fragment, { children: ['  ', _jsxs("button", { type: "button", onClick: () => void loadWholeFounderCascade(), style: { background: 'none', border: 'none', color: '#22d3ee', cursor: 'pointer', fontSize: 10 }, children: ["see whole file (", slice.totalBytes, " bytes)"] })] }))] }), _jsx("pre", { style: {
                                                                                                    margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                                                                                                    maxHeight: 260, minHeight: 60, overflowY: 'auto', resize: 'vertical',
                                                                                                    border: '1px solid #1e2a38', borderRadius: 4, padding: 6, background: '#0d1117',
                                                                                                }, children: slice.text })] }))] }, key));
                                                                        }), founderProof.founderCascade.ok
                                                                            && founderProof.founderCascade.text
                                                                            && founderProof.founderCascade.text.includes('Western Europe')
                                                                            && (_jsx("div", { style: { color: '#facc15', fontFamily: 'system-ui, sans-serif', fontSize: 10 }, children: "DIVERGENCE, disclosed plainly: his hand-worked excerpt above solves the SAME question stem on a DIFFERENT random option draw (South America / Western Europe / South Asia / East Asia / Southeast Asia / Northeastern United States / Nile Valley / Java / Ganges Valley) than this run's own qid 98 draw. Same method, not the same nine options -- do not read his lettered answer as this run's letter." }))] }))] })] }), _jsxs("div", { style: { border: '1px solid #334155', borderRadius: 6, overflow: 'hidden' }, children: [_jsxs("div", { style: {
                                                                padding: '6px 10px', fontSize: 11, fontWeight: 700, color: '#e2e8f0',
                                                                background: '#0d1117', fontFamily: 'system-ui, sans-serif',
                                                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                            }, children: [_jsx("span", { children: "THE THREE QUESTIONS KNOWN TO WORK (verbatim from receipts on disk)" }), _jsx("button", { type: "button", onClick: () => void loadKnownGoodQueries(), style: { background: 'none', border: 'none', color: '#22d3ee', cursor: 'pointer', fontSize: 11 }, children: "refresh" })] }), _jsxs("div", { style: { padding: 10, background: '#05080d', fontSize: 11, fontFamily: 'monospace', color: '#e2e8f0' }, children: [knownGoodQueriesState === 'loading' && _jsx("div", { style: { color: '#475569' }, children: "Loading\u2026" }), knownGoodQueriesState === 'unavailable' && _jsx("div", { style: { color: '#fca5a5' }, children: "Not available in this build." }), knownGoodQueriesState === 'loaded' && knownGoodQueries && (_jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 10 }, children: knownGoodQueries.map((kg, i) => {
                                                                        // Divergence against the CURRENT run's own Discriminator:1 step, when one
                                                                        // ran -- exact substring containment only (the same structural discipline
                                                                        // appearsIn() already applies elsewhere in this codebase), never a
                                                                        // similarity score, never a model judging "close enough".
                                                                        const currentQuery = (() => {
                                                                            if (!composerResult || composerResult.mode !== 'stack')
                                                                                return undefined;
                                                                            const idx = composerResult.result.steps.findIndex((s) => s.id.startsWith('Discriminator'));
                                                                            if (idx < 0)
                                                                                return undefined;
                                                                            const raw = composerResult.result.results[idx]?.raw;
                                                                            return typeof raw?.query === 'string' ? raw.query : undefined;
                                                                        })();
                                                                        const appliesToThisRow = kg.label.startsWith('FRAME') || kg.label.startsWith('DISCRIMINATOR');
                                                                        const divergent = appliesToThisRow && kg.ok && kg.queryText && currentQuery
                                                                            ? !currentQuery.includes(kg.queryText.replace(/^\s*FRAME: query SENT to conversational authority \(untruncated, verbatim\)="/, '').replace(/"$/, ''))
                                                                            : null;
                                                                        return (_jsxs("div", { style: { borderTop: i > 0 ? '1px solid #1e2a38' : undefined, paddingTop: i > 0 ? 8 : 0 }, children: [_jsx("div", { style: { color: '#94a3b8', fontFamily: 'system-ui, sans-serif', marginBottom: 2 }, children: kg.label }), !kg.ok && _jsx("div", { style: { color: '#fca5a5' }, children: kg.error }), kg.ok && (_jsxs(_Fragment, { children: [_jsxs("div", { style: { color: '#64748b', fontFamily: 'system-ui, sans-serif', fontSize: 10, marginBottom: 4 }, children: ["receipt: ", kg.receiptPath, kg.ts ? ` @ ${kg.ts}` : ''] }), _jsxs("div", { style: { marginBottom: 4 }, children: [_jsx("span", { style: { color: '#64748b' }, children: "query (verbatim): " }), kg.queryText] }), _jsxs("div", { children: [_jsx("span", { style: { color: '#64748b' }, children: "result (verbatim): " }), kg.resultText] }), appliesToThisRow && (_jsxs("div", { style: { marginTop: 4, fontFamily: 'system-ui, sans-serif', fontSize: 10 }, children: [currentQuery === undefined && (_jsx("span", { style: { color: '#64748b' }, children: "No Discriminator:1 step in the current run to compare against." })), currentQuery !== undefined && divergent === false && (_jsx("span", { style: { color: '#34d399' }, children: "MATCHES the current run's own Discriminator:1 query (contains this known-good text)." })), currentQuery !== undefined && divergent === true && (_jsx("span", { style: { color: '#facc15' }, children: "DIVERGES from the current run's own Discriminator:1 query -- the known-good text above is not contained in it." }))] }))] }))] }, i));
                                                                    }) }))] })] }), _jsxs("div", { style: { border: '1px solid #334155', borderRadius: 6, overflow: 'hidden' }, children: [_jsxs("div", { style: {
                                                                padding: '6px 10px', fontSize: 11, fontWeight: 700, color: '#e2e8f0',
                                                                background: '#0d1117', fontFamily: 'system-ui, sans-serif',
                                                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                            }, children: [_jsx("span", { children: "Evidence store on disk (read-only, every question)" }), _jsx("button", { type: "button", onClick: () => void loadEvidenceStoreSummary(), style: { background: 'none', border: 'none', color: '#22d3ee', cursor: 'pointer', fontSize: 11 }, children: "refresh" })] }), _jsxs("div", { style: { padding: 10, background: '#05080d', fontSize: 11, fontFamily: 'monospace', color: '#e2e8f0' }, children: [evidenceStoreSummaryState === 'loading' && _jsx("div", { style: { color: '#475569' }, children: "Loading\u2026" }), evidenceStoreSummaryState === 'unavailable' && _jsx("div", { style: { color: '#fca5a5' }, children: "Not available in this build." }), evidenceStoreSummaryState === 'loaded' && evidenceStoreSummary && (_jsxs("div", { children: [evidenceStoreSummary.files, " acquisition file(s), ", evidenceStoreSummary.totalRecords, " record(s),", ' ', (evidenceStoreSummary.totalBytes / 1024).toFixed(1), " KB", evidenceStoreSummary.malformedLines > 0 && (_jsxs("span", { style: { color: '#facc15' }, children: [" (", evidenceStoreSummary.malformedLines, " malformed line(s))"] }))] }))] })] }), _jsxs("div", { children: [_jsxs("div", { style: { fontSize: 11, color: '#94a3b8', fontFamily: 'system-ui, sans-serif', marginBottom: 4, display: 'flex', justifyContent: 'space-between' }, children: [_jsx("span", { children: "Steps on file:" }), _jsx("button", { type: "button", onClick: () => void loadComposerRegistry(), style: { background: 'none', border: 'none', color: '#22d3ee', cursor: 'pointer', fontSize: 11 }, children: "refresh" })] }), composerRegistryState === 'loading' && _jsx("div", { style: { fontSize: 11, color: '#475569' }, children: "Loading\u2026" }), composerRegistryState === 'unavailable' && _jsx("div", { style: { fontSize: 11, color: '#fca5a5' }, children: "Not available in this build." }), composerRegistryState === 'loaded' && (_jsx("div", { style: {
                                                                maxHeight: 260, minHeight: 90, overflowY: 'auto', resize: 'vertical',
                                                                border: '1px solid #1e2a38', borderRadius: 4, padding: 2,
                                                            }, children: composerRegistry.map((entry) => (_jsxs("div", { style: {
                                                                    display: 'flex', alignItems: 'flex-start', gap: 6, padding: '4px 6px', marginBottom: 3,
                                                                    background: '#0d1117', border: '1px solid #1e2a38', borderRadius: 4,
                                                                }, children: [_jsxs("div", { style: { flex: 1 }, children: [_jsxs("div", { style: { color: '#e2e8f0', fontSize: 12, fontFamily: 'monospace' }, children: [formatStepLabel(entry), !entry.executable && _jsx("span", { style: { color: '#a16207', marginLeft: 6, fontSize: 10 }, children: "(not runnable yet)" })] }), _jsx("div", { style: { color: '#64748b', fontSize: 10.5, marginTop: 2 }, children: entry.whatItDoes })] }), _jsx("button", { type: "button", onClick: () => addComposerStep(entry.id), style: { background: 'none', border: '1px solid #334155', borderRadius: 4, color: '#94a3b8', cursor: 'pointer', padding: '2px 8px', fontSize: 11, flexShrink: 0 }, children: "Add" })] }, entry.id))) }))] })] }))] }), lastOutcome && (_jsxs("div", { style: {
                                        marginTop: 4, padding: '8px 10px', borderRadius: 6, fontSize: 11, fontFamily: 'monospace',
                                        background: lastOutcome.abstain ? '#3f2d0a' : lastOutcome.ok ? '#052e1e' : '#3f0a0a',
                                        border: `1px solid ${lastOutcome.abstain ? '#a16207' : lastOutcome.ok ? '#059669' : '#991b1b'}`,
                                        color: lastOutcome.abstain ? '#facc15' : lastOutcome.ok ? '#6ee7b7' : '#fca5a5',
                                    }, children: [lastOutcome.freeText
                                            ? (lastOutcome.abstain ? 'ABSTAIN (no extractable answer)' : `ANSWER: ${lastOutcome.verdict}`)
                                            : (lastOutcome.abstain ? `ABSTAIN  key=${lastOutcome.correct ?? '?'}` : `${lastOutcome.ok ? 'CORRECT' : 'WRONG'}  ${lastOutcome.verdict}  key=${lastOutcome.correct ?? '?'}`), lastOutcome.basis && _jsx("div", { style: { marginTop: 3, opacity: 0.8 }, children: lastOutcome.basis })] })), offersSteppedWalk(lastOutcome) && lastRunEvents.length > 0 && !walkActive && (_jsx("button", { type: "button", onClick: handleStartWalk, style: {
                                        marginTop: 4, width: '100%',
                                        background: 'linear-gradient(135deg, #1d4ed8, #3b82f6)',
                                        color: '#fff', border: 'none', borderRadius: 6,
                                        padding: '8px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                                        fontFamily: 'system-ui, sans-serif', outline: 'none',
                                    }, children: "Audit the Run \u25B8" })), !walkActive && walkResult && (_jsx("div", { style: {
                                        marginTop: 2, fontSize: 10, fontFamily: 'monospace', wordBreak: 'break-word',
                                        color: walkResult.ok ? '#6ee7b7' : '#fca5a5',
                                    }, children: walkResult.ok
                                        ? `walk written: ${walkResult.filePath} (${walkResult.bytes} bytes)`
                                        : `walk failed: ${walkResult.error}` })), isTeachableOutcome(lastOutcome) && lastOutcome && (_jsxs("div", { style: { marginTop: 4, padding: '8px 10px', borderRadius: 6, background: '#1e2a38', border: '1px solid #334155' }, children: [_jsx("div", { style: { fontSize: 11, color: '#facc15', fontFamily: 'system-ui, sans-serif', fontWeight: 700, marginBottom: 4 }, children: "Teach the terminal" }), _jsxs("div", { style: { fontSize: 10, color: '#94a3b8', fontFamily: 'system-ui, sans-serif', marginBottom: 6, lineHeight: 1.4 }, children: [shapeTestSummaryFor(lastOutcome), " Type how you would work this one, in your own words. Written to disk verbatim -- nothing here is summarized, and no method is auto-generated from it."] }), _jsx("textarea", { value: teachText, onChange: (e) => setTeachText(e.target.value), disabled: teachSubmitting, placeholder: "First I would...", rows: 14, style: {
                                                width: '100%', boxSizing: 'border-box', background: '#05080d', border: '1px solid #334155',
                                                borderRadius: 6, color: '#e2e8f0', padding: '8px 10px', fontSize: 12,
                                                fontFamily: 'Consolas, monospace', outline: 'none', resize: 'vertical',
                                                // Grows with the pane. Teaching a method is several paragraphs, and the old
                                                // six-row box in a 280px column showed about eight words per line.
                                                minHeight: 220,
                                            } }), _jsx("button", { type: "button", onClick: () => void handleTeachSubmit(), disabled: teachSubmitting || !teachText.trim(), style: {
                                                marginTop: 6, width: '100%',
                                                background: teachSubmitting || !teachText.trim() ? '#1e2a38' : 'linear-gradient(135deg, #b45309, #f59e0b)',
                                                color: teachSubmitting || !teachText.trim() ? '#64748b' : '#fff', border: 'none', borderRadius: 6,
                                                padding: '7px 10px', fontSize: 12, fontWeight: 700,
                                                cursor: teachSubmitting || !teachText.trim() ? 'default' : 'pointer',
                                                fontFamily: 'system-ui, sans-serif', outline: 'none',
                                            }, children: teachSubmitting ? 'Writing…' : 'Teach ▸' }), teachResult && (_jsx("div", { style: {
                                                marginTop: 6, fontSize: 10, fontFamily: 'monospace', wordBreak: 'break-word',
                                                color: teachResult.ok ? '#6ee7b7' : '#fca5a5',
                                            }, children: teachResult.ok
                                                ? `written: ${teachResult.filePath} (${teachResult.bytes} bytes)`
                                                : `failed: ${teachResult.error}` }))] })), recent.length > 0 && (_jsxs("div", { style: { marginTop: 8 }, children: [_jsx("div", { style: { fontSize: 11, color: '#64748b', marginBottom: 4, fontFamily: 'system-ui, sans-serif' }, children: "Recent" }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 4 }, children: recent.map((r) => (_jsx("button", { type: "button", onClick: () => setInput(r), disabled: running, style: {
                                                    background: 'none', border: '1px solid #1e2a38', borderRadius: 5, color: '#94a3b8',
                                                    fontSize: 11, padding: '4px 8px', textAlign: 'left', cursor: running ? 'default' : 'pointer',
                                                    fontFamily: 'Consolas, monospace', outline: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                }, children: r }, r))) })] })), _jsx("div", { style: { marginTop: 'auto', fontSize: 10, color: '#334155', fontFamily: 'system-ui, sans-serif', lineHeight: 1.5 }, children: "Every completed question writes one heartbeat line to the yoke ledger (HARDWIRE\\LEDGER\\YOKE\\HEARTBEAT\\LIANA-TERMINAL.beat) -- visible to Bishop without copying anything back." })] })] })) })] }));
}
export default LianaCycleTab;
