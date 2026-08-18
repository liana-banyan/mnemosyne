// origin_provenance_store.ts -- D-BP154-030/BISHOP-SEG/S30/seg-humannuance
//
// READS THE ORIGIN-PROVENANCE EBLET (scripts/backfill_mmlu_pro_origin_src.mjs's own output,
// resources/mmlu_pro_bundled/origin_provenance/origin_eblet_qid<campaignQuestionId>.json) for ONE
// campaign question_id, at Composer RUN TIME, with ZERO network -- offline, read-only. This is the
// whole point of the "coverage" architecture the Founder ordered (FD-BP153-05, the zero-query
// derivation): once a question has been backfilled, every future run against it answers the
// artifact-class question from disk, not from a live fetch.
//
// THE INDEX IS NOT THE THING IT INDEXES (Founder, D-BP154-030 amendment 2, Law 9). `origin_src` on
// the bundled corpus row (MethodQuestionInput.originSrc, method_registry.ts) is the fast pointer;
// THIS module reads the fuller record (the origin's own option set, the augmentation delta, the
// two per-item judgment fields) it points to.
//
// NEVER THE ANSWER KEY. The eblet itself never carries an `answer`/`answer_index` field (the
// backfill script discards them on receipt, verified absent from every eblet on disk this ticket).
// This reader reads an EXPLICIT ALLOWLIST of fields, never a passthrough spread of the parsed JSON
// -- so even a future, foreign eblet writer that mistakenly included one could not leak it through
// this module to a caller.
//
// A MISSING OR UNREADABLE EBLET IS "NOT AVAILABLE", NEVER A GUESS. human_nuance_step.ts's own cow
// guard (FD-BP154-07) treats a null return here as "the option-set-as-authored-evidence reading
// cannot run for this item" -- it does not fall back to inventing a frame from this file's own
// knowledge.
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { app } from 'electron';
function resolveProvenanceDir() {
    const packaged = typeof process !== 'undefined' && process.resourcesPath
        ? join(process.resourcesPath, 'mmlu_pro_bundled', 'origin_provenance')
        : null;
    if (app.isPackaged && packaged)
        return packaged;
    return resolve(app.getAppPath(), 'resources', 'mmlu_pro_bundled', 'origin_provenance');
}
/** Exported so a test can point this reader at a fixture directory without touching the real
 *  resources/ tree -- same discipline resolveBundledDatasetPath()'s own callers rely on
 *  (liana_terminal_engine.ts), just made overridable here since this module has no existing test
 *  seam of its own to reuse. */
export function loadOriginProvenanceFrom(dir, campaignQuestionId) {
    const path = join(dir, `origin_eblet_qid${campaignQuestionId}.json`);
    if (!existsSync(path))
        return null;
    try {
        const raw = JSON.parse(readFileSync(path, 'utf8'));
        const fetchRaw = raw.mmluProFetch;
        const originRaw = raw.origin;
        const deltaRaw = raw.augmentationDelta;
        return {
            campaignQuestionId,
            mmluProQuestionId: typeof raw.mmluProQuestionId === 'number' ? raw.mmluProQuestionId : -1,
            category: typeof raw.category === 'string' ? raw.category : '',
            categoryTags: Array.isArray(raw.categoryTags) ? raw.categoryTags.filter((t) => typeof t === 'string') : [],
            src: typeof raw.src === 'string' ? raw.src : null,
            stratum: typeof raw.stratum === 'string' ? raw.stratum : 'unknown',
            augmentedOptions: Array.isArray(fetchRaw?.augmentedOptions)
                ? fetchRaw.augmentedOptions.filter((o) => typeof o === 'string')
                : [],
            origin: originRaw && Array.isArray(originRaw.options)
                ? {
                    options: originRaw.options.filter((o) => typeof o === 'string'),
                    question: typeof originRaw.question === 'string' ? originRaw.question : '',
                }
                : null,
            augmentationDelta: deltaRaw && Array.isArray(deltaRaw.added)
                ? {
                    added: deltaRaw.added.filter((o) => typeof o === 'string'),
                    removedFromOrigin: Array.isArray(deltaRaw.removedFromOrigin)
                        ? deltaRaw.removedFromOrigin.filter((o) => typeof o === 'string')
                        : [],
                    originCount: typeof deltaRaw.originCount === 'number' ? deltaRaw.originCount : 0,
                    augmentedCount: typeof deltaRaw.augmentedCount === 'number' ? deltaRaw.augmentedCount : 0,
                    countChange: typeof deltaRaw.countChange === 'number' ? deltaRaw.countChange : 0,
                }
                : null,
            singleAnswerPropertySurvived: typeof raw.singleAnswerPropertySurvived === 'boolean' ? raw.singleAnswerPropertySurvived : null,
            answerDerivableFromQuestionTermsAlone: typeof raw.answerDerivableFromQuestionTermsAlone === 'boolean' ? raw.answerDerivableFromQuestionTermsAlone : null,
        };
    }
    catch {
        return null; // corrupt/unreadable eblet -- "not available", never thrown into the caller.
    }
}
/** The real, resources/-resolving entry point every non-test caller uses. */
export function loadOriginProvenance(campaignQuestionId) {
    return loadOriginProvenanceFrom(resolveProvenanceDir(), campaignQuestionId);
}
