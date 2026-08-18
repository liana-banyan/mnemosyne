// origin_frame_step.ts -- D-BP154-042/BISHOP-SEG/S42/seg-originframe
//
// 'OriginFrame:1' -- THE KOBAYASHI MARU MOVE MADE MECHANICAL. Founder's own dispatch: the augmented
// (MMLU-Pro, nine-option) qid 98 has SIX defensible answers -- BP154 measured this
// (BISHOP_DROPZONE\BP154_QID98_RESOLVED_THE_AUGMENTATION_DEFECT.md) and D-BP154-041 PART 2's own
// sufficiency gate reaches INSUFFICIENT EVIDENCE on it, honestly, from the option count alone. **A
// cannot be derived from the nine-option question. Any change that makes A fall out of the
// augmented option set is encoding, and is a failure.** The origin item (`cais/mmlu`
// `high_school_geography` test, offset 100) is a DIFFERENT, citable artifact -- four options, one
// answer -- and it is what the Founder's own hand-worked frame was reproducing all along.
//
// THE LINE THAT MUST NOT MOVE: read the origin's OPTION SET, NEVER its answer key. Lookup vs
// derivation is the entire integrity of this result.
//   - loadOriginProvenance() (origin_provenance_store.ts, D-BP154-030, UNMODIFIED) already
//     structurally cannot leak an answer key: its own header states it reads an EXPLICIT ALLOWLIST
//     of fields from the backfilled eblet, never a passthrough spread of the parsed JSON, and the
//     eblet itself is written by scripts/backfill_mmlu_pro_origin_src.mjs, which discards
//     `answer`/`answer_index` on receipt (verified absent from every eblet on disk, that script's
//     own header). This file reuses that reader UNMODIFIED -- it does not re-parse the eblet JSON
//     itself, so it inherits that guarantee rather than re-implementing it.
//   - The mini-derivation below (runOriginFrameDerivation()) builds its OWN MethodQuestionInput
//     from the origin's option set and explicitly OMITS `correctAnswer` -- even though
//     runSoftballsStep()/runNamedSetStep() never read that field at all (D-BP153-003, every
//     Composer step stays structurally blind), this is stated, structural, and tested
//     (origin_frame_step.test.ts's own key-blindness proof), not merely assumed.
//
// PREFER THE BACKFILLED LOCAL CORPUS. loadOriginProvenance() reads
// resources/mmlu_pro_bundled/origin_provenance/origin_eblet_qidNN.json -- ALREADY on disk for the
// standing-20 campaign qids (backfilled offline, zero network at Composer run time, D-BP154-030's
// own "coverage" architecture). fetchOriginOptionSetLive() below is the live fallback, used only
// when no local eblet exists AND a caller-supplied `liveOffset` narrows the dataset-server lookup
// (this file invents no offset-guessing heuristic of its own -- an unresolvable live fetch reports
// UNAVAILABLE, never a guess, per origin_provenance_store.ts's own established "a missing or
// unreadable eblet is 'not available', never a guess" discipline). `fetchedVia` on the result names
// which path actually produced the frame, honestly, every time.
//
// THE AUGMENTATION DELTA IS EXPLICIT, ALONGSIDE THE AUGMENTED SET -- never silently substituted.
// `originOptions`/`augmentedOptions`/`augmentationDelta` are all reported together so a reader can
// see exactly what MMLU-Pro added.
//
// BOTH OUTCOMES ARE REPORTED, NEVER ONE ERASING THE OTHER. `augmentedQuestionStatus` on the result
// is READ (never re-derived) from Terminator:1's own already-computed result in `priorResults` --
// this step runs LAST in a stack, after the full Purpose:1/Softballs:1/NamedSet:1/Discriminator:1/
// Magnitude:1/HumanNuance:1/Terminator:1 pipeline (D-BP154-041) has already reported the augmented
// question's own honest status (today: INSUFFICIENT EVIDENCE). `originFrameVerdict` is this file's
// OWN, separate derivation over the origin's four-option frame. Neither is allowed to overwrite or
// hide the other on the result object.
//
// REUSE, NOT REINVENTION (HARDWIRE-22, and this codebase's own repeated discipline).
// runOriginFrameDerivation() below calls softballs_step.ts's runSoftballsStep() and
// named_set_step.ts's runNamedSetStep() UNCHANGED, then reduces their results with
// terminator_step.ts's own EXPORTED, already-audited deriveTerminatorEliminations() -- the SAME
// pure reducer every other UNIQUE-OR-ABSTAIN verdict in this estate uses, not a second, hand-rolled
// copy of its logic. classify_cascade.ts is FORBIDDEN and was not read to build this file.
// comparative_cascade.ts is untouched -- this file imports nothing from it directly; the two reused
// step functions already carry whatever discipline they need from it.
//
// NO RULE HERE MAY SELECT A LETTER (FD-BP153-06). Every option in the origin frame is treated
// identically by deriveTerminatorEliminations(); this file adds no letter-specific branch anywhere.
import { createHash } from 'node:crypto';
import { registerNameNumbered } from './method_registry';
import { loadOriginProvenance } from './origin_provenance_store';
import { runSoftballsStep } from './softballs_step';
import { runNamedSetStep } from './named_set_step';
import { deriveTerminatorEliminations } from './terminator_step';
// ───────────────────────────── pure parts ─────────────────────────────
const letter = (i) => String.fromCharCode(65 + i);
/** Reads `src` (e.g. "ori_mmlu-high_school_geography") into the origin dataset + config it names.
 *  Pure text-structure parsing (HARDWIRE-22: extraction, not judgment) -- only the `ori_mmlu-*`
 *  family is resolved (the only family this campaign's backfill covers, origin_provenance_store.ts's
 *  own header); any other prefix, or no prefix at all, returns null rather than guessing a dataset. */
export function resolveOriginDataset(src) {
    const m = src.match(/^ori_mmlu-(.+)$/i);
    if (!m)
        return null;
    return { dataset: 'cais/mmlu', config: m[1] };
}
/** THE ONE LIVE FALLBACK. A direct read of the public HuggingFace datasets-server `/rows` endpoint
 *  -- NOT classify_cascade.ts, NOT comparative_cascade.ts's googleBlocks()/gemmaExtract() (neither
 *  is imported by this file), NOT a Google/conversational-authority query at all. A plain,
 *  structural read of one stated field (`options`) from one dataset row -- the same shape of
 *  operation as reading `src` itself. Requires a caller-supplied `offset` (this file invents no
 *  offset-guessing heuristic -- BISHOP_DROPZONE\BP154_QID98_RESOLVED_...md's own "offset ~=
 *  question_id - 155" was measured for ONE region of ONE config and is not assumed to generalize).
 *  Returns null (never a guess) on any failure -- network error, non-200, missing `options`/
 *  `question` fields, or a mismatched config. */
export async function fetchOriginOptionSetLive(dataset, config, split, offset) {
    try {
        const url = `https://datasets-server.huggingface.co/rows?dataset=${encodeURIComponent(dataset)}`
            + `&config=${encodeURIComponent(config)}&split=${encodeURIComponent(split)}&offset=${offset}&length=1`;
        const res = await fetch(url);
        if (!res.ok)
            return null;
        const body = await res.json();
        const row = body.rows?.[0]?.row;
        if (!row)
            return null;
        const question = typeof row.question === 'string' ? row.question : null;
        const rawChoices = row.choices ?? row.options;
        const options = Array.isArray(rawChoices) ? rawChoices.filter((o) => typeof o === 'string') : null;
        if (!question || !options || options.length === 0)
            return null;
        return { question, options };
    }
    catch {
        return null; // network/parse failure -- NOT AVAILABLE, never fabricated.
    }
}
function contentHash(question, options) {
    return createHash('sha256').update(JSON.stringify({ question, options })).digest('hex');
}
function emptyOriginFrameResult(overrides) {
    return {
        ok: false, src: null, originDataset: null, originConfig: null, fetchedVia: 'n/a', provenance: null,
        originOptions: [], originQuestion: null, augmentedOptions: [], augmentationDelta: null,
        answerKeyDiscarded: false, originFrameVerdict: null, augmentedQuestionStatus: null, via: 'n/a',
        ...overrides,
    };
}
function summaryLine(r) {
    if (!r.ok)
        return `ORIGINFRAME: FAILED -- ${r.error}`;
    const originText = r.originOptions.map((o) => `${o.letter}) ${o.name}`).join(', ');
    const verdictText = r.originFrameVerdict
        ? r.originFrameVerdict.abstain
            ? `ABSTAIN: ${r.originFrameVerdict.abstainReason}`
            : `VERDICT ${r.originFrameVerdict.verdict}) ${r.originFrameVerdict.verdictName}`
        : '(not derived)';
    const augmentedText = r.augmentedQuestionStatus
        ? r.augmentedQuestionStatus.insufficientEvidence
            ? `INSUFFICIENT EVIDENCE (${r.augmentedQuestionStatus.insufficientEvidence.preconditionId})`
            : r.augmentedQuestionStatus.abstain
                ? `ABSTAIN: ${r.augmentedQuestionStatus.abstainReason}`
                : `VERDICT ${r.augmentedQuestionStatus.verdict}`
        : '(Terminator:1 did not run earlier in this stack)';
    return `ORIGINFRAME -- fetched via: ${r.fetchedVia}  ||  ORIGIN FRAME (${r.originDataset}/${r.originConfig}): `
        + `${originText}  ||  ORIGIN-FRAME OUTCOME: ${verdictText}  ||  AUGMENTED-QUESTION STATUS (nine-option, `
        + `as MMLU-Pro states it): ${augmentedText}  ||  answer key discarded: ${r.answerKeyDiscarded}`;
}
/** THE MINI-DERIVATION. Runs Softballs:1's/NamedSet:1's own real step functions, UNCHANGED, over a
 *  MethodQuestionInput built from the origin frame -- `correctAnswer` is explicitly OMITTED (never
 *  copied from the caller's own input), even though neither reused function reads it at all
 *  (D-BP153-003). Reduces with deriveTerminatorEliminations() (terminator_step.ts, reused, not
 *  duplicated) and applies the SAME UNIQUE-OR-ABSTAIN rule (FD-BP152-19) every other verdict in
 *  this estate uses. Issues real, live queries (two, at most) -- cannot be exercised end to end
 *  under vitest, same boundary every other live Composer step's own header states; the pure
 *  reduction is proven by origin_frame_step.test.ts, the live wiring by an in-app run. */
export async function runOriginFrameDerivation(originOptions, originQuestion, ctx, qid) {
    const OPT = {};
    for (const o of originOptions)
        OPT[o.letter] = o.name;
    const frame = Object.keys(OPT);
    // Key-blindness (this file's own header): built fresh, `correctAnswer` never present.
    const originInput = { qid, question: originQuestion, options: OPT };
    const [{ result: softballs }, { result: namedSet }] = await Promise.all([
        runSoftballsStep(originInput, ctx),
        runNamedSetStep(originInput, ctx),
    ]);
    const { eliminated, contradiction } = deriveTerminatorEliminations(OPT, softballs.ok ? softballs : null, namedSet.ok ? namedSet : null, null);
    if (contradiction) {
        return {
            frameUsed: 'origin', frame, softballs, namedSet, eliminated, contradiction, survivors: [],
            verdict: null, verdictName: null, abstain: true,
            abstainReason: `CONTRADICTION: ${contradiction.reason}`,
        };
    }
    const eliminatedLetters = new Set(eliminated.map((e) => e.letter));
    const survivors = frame.filter((L) => !eliminatedLetters.has(L));
    if (survivors.length === 1) {
        const v = survivors[0];
        return {
            frameUsed: 'origin', frame, softballs, namedSet, eliminated, contradiction: null, survivors,
            verdict: v, verdictName: OPT[v], abstain: false, abstainReason: null,
        };
    }
    return {
        frameUsed: 'origin', frame, softballs, namedSet, eliminated, contradiction: null, survivors,
        verdict: null, verdictName: null, abstain: true,
        abstainReason: survivors.length === 0
            ? 'every option in the origin frame was eliminated -- at least one contributing step\'s basis must be wrong; not published'
            : `more than one survivor left in the origin frame (${survivors.join(', ')}) -- no stated distinction separated them further`,
    };
}
function buildAugmentationDelta(delta) {
    if (!delta)
        return null;
    return {
        added: delta.added, removedFromOrigin: delta.removedFromOrigin,
        originCount: delta.originCount, augmentedCount: delta.augmentedCount, countChange: delta.countChange,
    };
}
function readAugmentedQuestionStatus(priorResults) {
    const term = priorResults.find((r) => r.id === 'Terminator:1')?.raw;
    if (!term)
        return null;
    return {
        frameUsed: 'augmented',
        verdict: term.verdict,
        abstain: term.abstain,
        abstainReason: term.abstainReason,
        insufficientEvidence: term.insufficientEvidence,
        incomplete: term.incomplete,
    };
}
/**
 * Runs 'OriginFrame:1'. Reads `input.originSrc` (never `input.options`, the AUGMENTED set, for its
 * OWN frame -- that set is only reported alongside, for comparison). Prefers the local backfilled
 * eblet (origin_provenance_store.ts, zero network); falls back to a live HuggingFace
 * datasets-server read only when `liveOffset` is supplied. Runs its own mini-derivation over the
 * origin frame, and reads (never re-derives) Terminator:1's own already-computed augmented-question
 * status from `priorResults`.
 */
export async function runOriginFrameStep(input, ctx, priorResults, 
// ADDITIVE/OPTIONAL: only meaningful when the local eblet is absent -- see
// fetchOriginOptionSetLive()'s own header for why no offset is guessed automatically.
liveOffset) {
    if (!input.originSrc || !input.originSrc.trim()) {
        const result = emptyOriginFrameResult({
            error: 'no originSrc on this input -- OriginFrame:1 needs a stated `src` field to resolve an origin dataset',
        });
        return { result, summary: summaryLine(result) };
    }
    const src = input.originSrc.trim();
    const resolved = resolveOriginDataset(src);
    if (!resolved) {
        const result = emptyOriginFrameResult({
            src, error: `src "${src}" does not resolve to a known origin family (only ori_mmlu-* is backfilled)`,
        });
        return { result, summary: summaryLine(result) };
    }
    const augmentedQuestionStatus = readAugmentedQuestionStatus(priorResults);
    // STAGE 1: PREFER LOCAL (zero network, D-BP154-030's own "coverage" architecture).
    const local = input.qid != null ? loadOriginProvenance(input.qid) : null;
    if (local?.origin && local.origin.options.length > 0) {
        const originOptions = local.origin.options.map((name, i) => ({ letter: letter(i), name }));
        const originFrameVerdict = await runOriginFrameDerivation(originOptions, local.origin.question, ctx, input.qid);
        const result = {
            ok: true, src, originDataset: resolved.dataset, originConfig: resolved.config,
            fetchedVia: 'local-backfilled-eblet',
            provenance: {
                dataset: resolved.dataset, config: resolved.config, split: 'test', offset: null,
                contentHash: contentHash(local.origin.question, local.origin.options),
            },
            originOptions, originQuestion: local.origin.question,
            augmentedOptions: local.augmentedOptions,
            augmentationDelta: buildAugmentationDelta(local.augmentationDelta),
            answerKeyDiscarded: true,
            originFrameVerdict, augmentedQuestionStatus,
            via: `local: resources/mmlu_pro_bundled/origin_provenance/origin_eblet_qid${input.qid}.json`,
        };
        return { result, summary: summaryLine(result) };
    }
    // STAGE 2: LIVE FALLBACK -- only when a caller supplies an offset (never guessed).
    if (liveOffset != null) {
        const live = await fetchOriginOptionSetLive(resolved.dataset, resolved.config, 'test', liveOffset);
        if (live) {
            const originOptions = live.options.map((name, i) => ({ letter: letter(i), name }));
            const originFrameVerdict = await runOriginFrameDerivation(originOptions, live.question, ctx, input.qid);
            const result = {
                ok: true, src, originDataset: resolved.dataset, originConfig: resolved.config, fetchedVia: 'live-fetch',
                provenance: {
                    dataset: resolved.dataset, config: resolved.config, split: 'test', offset: liveOffset,
                    contentHash: contentHash(live.question, live.options),
                },
                originOptions, originQuestion: live.question,
                augmentedOptions: [], augmentationDelta: null, answerKeyDiscarded: true,
                originFrameVerdict, augmentedQuestionStatus,
                via: `live: datasets-server.huggingface.co/rows (${resolved.dataset}/${resolved.config}, offset ${liveOffset})`,
            };
            return { result, summary: summaryLine(result) };
        }
    }
    const result = emptyOriginFrameResult({
        src, originDataset: resolved.dataset, originConfig: resolved.config, augmentedQuestionStatus,
        error: 'origin frame UNAVAILABLE -- no local backfilled eblet on disk, and no liveOffset supplied '
            + '(or the live fetch failed) -- never guessed',
    });
    return { result, summary: summaryLine(result) };
}
// ───────────────────────────── registration (inert until stacked and run) ─────────────────────────
const ORIGIN_FRAME_DECLARATION = {
    id: 'liana_cycle.origin_frame_step.runOriginFrameStep',
    version: '1',
    sourceFile: 'src/main/liana_cycle/library/origin_frame_step.ts',
    sourceLine: 1,
    exportName: 'runOriginFrameStep',
    exportKind: 'function',
    whatItDoes: 'Resolves the origin dataset from `src` (ori_mmlu-* only), reads the origin\'s OPTION SET '
        + '(never its answer key) -- preferring the local backfilled eblet, falling back to a live '
        + 'HuggingFace datasets-server read only when given an explicit offset -- with dataset/config/'
        + 'split/offset/content-hash provenance, and reports the augmentation delta against MMLU-Pro\'s '
        + 'own augmented set. Runs its own mini-derivation (Softballs:1 + NamedSet:1, reduced by '
        + 'terminator_step.ts\'s reused deriveTerminatorEliminations()) over ONLY the origin frame, and '
        + 'reports it alongside -- never in place of -- Terminator:1\'s own already-computed status of '
        + 'the augmented (nine-option) question, read from priorResults.',
    inputs: 'MethodQuestionInput (originSrc, qid) plus MethodRunContext plus priorResults (reads Terminator:1\'s result) plus an optional liveOffset.',
    outputs: 'Promise<{ result: OriginFrameResult, summary: string }> -- the origin frame with provenance, '
        + 'the augmentation delta, its own origin-frame verdict/abstain, and the augmented question\'s '
        + 'own status, side by side.',
    decidesOrReports: 'DECIDES_AND_REFUSES',
    queryText: {
        issuesQuery: true,
        description: 'Up to two live queries (Softballs:1 + NamedSet:1, run over the origin frame only) plus, on the local path, zero network for the frame itself.',
        loadedFromQueryResource: false,
    },
    attribution: {
        kind: 'ATTRIBUTED',
        founderRuling: 'BP154',
        quote: 'A cannot be derived from the nine-option question... But the origin item is a different '
            + 'artifact, and it is citable... Run the existing chain against THAT frame... That is the '
            + 'Kobayashi Maru move made mechanical.',
        citedAt: 'D-BP154-042 dispatch (this ticket)',
    },
    orphanEvidence: 'N/A -- not an orphan. Live: registered via registerOriginFrameStep() (this file), executed by '
        + 'script_bridge.ts\'s runOneStep() for id "OriginFrame:1".',
};
/** Registers 'OriginFrame:1'. Called from script_bridge.ts's ensureRegistryPopulated(),
 *  idempotently -- same try/catch shape as every other Composer step registration there. */
export function registerOriginFrameStep() {
    return registerNameNumbered('OriginFrame', 1, ORIGIN_FRAME_DECLARATION);
}
