// query_text_loader.ts -- D-BP152-008/BISHOP/seg-runtime-query-file
//
// THE FOUNDER'S ASK, verbatim, BP152: "Is there a way we can change what is called without having
// to rebuild the entire house each time? aka, the entire mnemosynec? I just want to fly through
// the iterations, without having to pay for rebuilding every brick every time. How about we have a
// script loading file, and we change the file as we go for fast iterations?"
//
// WHAT THIS FILE IS. The single runtime-loaded source of every literal Google query string the
// Liana Cycle SURVEY path sends (survey_stage.ts's askAmbiguity()/askOperation()/askConstraint(),
// elements/survey_ask.ts's defineQuery()/otherMeaningsQuery()/scopedQuery(), elements/
// field_gate.ts's fieldQueries()) -- moved OUT of compiled TypeScript into
// resources/liana_survey_queries.json so the Founder can edit the query TEXT and re-run a question
// in the same app session: no restart, no `tsc`, no electron-builder repackage. See this ticket's
// own SEG return (BISHOP_DROPZONE\SEG_RETURN_BP152_008_RUNTIME_QUERY_FILE.md) for the full
// enumeration of every query moved here and the byte-identical proof against build 6c914745.
//
// WHAT THIS FILE IS NOT. It moves QUERY STRINGS ONLY. It does not decide which query to send and
// does not compose a query beyond simple ${placeholder} substitution -- it never changes a query's
// wording from what shipped in build 6c914745. Composition logic that combines a templated query
// with OTHER context (e.g. askAmbiguity()'s own `${askText}\n\n${askedText}`) stays in the calling
// file; only the static/templated fragment (`askedText` itself) moves here.
//
// RE-READ ON EVERY CALL, NOT CACHED. `getQueryText()` reads and parses the file fresh on every
// invocation -- no module-level cache, no read-once-at-startup. That IS the entire point (Founder:
// "fly through the iterations").
//
// FAILS LOUDLY, NEVER GUESSES. A missing file, unparseable JSON, an absent id, or a placeholder the
// entry declares with no supplied value all throw a descriptive Error naming the file path and the
// id/placeholder -- never a silent fallback to a hardcoded string. "Refusing beats guessing" (this
// estate's own standing law, restated here for a config file instead of a Google answer).
//
// WHERE THE FILE LIVES, AND WHY IT DOES NOT IMPORT 'electron'.
//   Every other Google-query-building file this loader is imported by (survey_stage.ts,
//   elements/survey_ask.ts, elements/field_gate.ts, and everything they in turn import --
//   methods/comparative_cascade.ts, method_registry.ts) is deliberately Electron-agnostic: their
//   own test files (survey_stage.test.ts, comparative_cascade.test.ts, stepped_audible.test.ts)
//   run with plain `node dist/main/liana_cycle/<file>.test.js`, no Electron process at all, per
//   each test file's own header. Importing electron's `app` here (the way liana_terminal_engine.ts
//   does, which is NEVER reached by that plain-node test path) would break every one of those
//   tests the moment they imported this file transitively. So packaged-vs-dev is resolved from
//   `process.resourcesPath` alone -- a plain property Electron sets on the Node `process` global in
//   any Electron-launched process, dev or packaged, readable with no `require('electron')` -- and a
//   plain `node` process (the test runners above) simply never has it set, so it falls through to
//   the cwd-relative path below, exactly like those tests already expect.
//
//   Resolution order (first match wins), re-evaluated on every call:
//     1. `LB_SURVEY_QUERIES_PATH` env var, if set -- explicit override, same convention
//        env_loader.ts's `LB_WORKING_KEYS_PATH` already establishes for a different runtime file.
//     2. `<process.resourcesPath>/liana_survey_queries.json`, IF that path exists on disk. Set only
//        inside an Electron process. In a PACKAGED build this is where electron-builder's
//        `extraResources` (package.json `build.extraResources`) places the file -- OUTSIDE
//        `app.asar`, which is read-only at runtime, so the installed copy is a plain, editable file
//        on disk. In a DEV `electron .` run, `process.resourcesPath` points at Electron's OWN
//        bundled resources directory (node_modules/electron/dist/resources), which never has this
//        file, so this branch is skipped and step 3 is used instead.
//     3. `<process.cwd()>/resources/liana_survey_queries.json` -- the repo-relative default. This is
//        what DEV (`npm run dev` / `npm run dev:main`, both launch `electron .` with the repo root
//        as cwd) and any plain-`node` test runner (cwd is also the repo root) both resolve to.
//
//   THESE ARE NOT THE SAME ABSOLUTE PATH IN DEV VS. PACKAGED -- Electron's own asar/resourcesPath
//   split makes one shared absolute path impossible (env_loader.ts's own supabase_public.env has
//   the identical dev/packaged split, for the identical reason). What IS identical in both modes:
//   the same relative filename, the same JSON shape, and "re-read fresh every call, no restart
//   needed" -- true for both the dev-mode copy (`resources/liana_survey_queries.json` in the repo)
//   and the packaged copy (`<install dir>/resources/liana_survey_queries.json`, next to the .exe,
//   never inside app.asar).
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
/** Re-resolved on every call -- no caching of WHICH path is in effect, so a file that appears or
 *  disappears between runs (e.g. an override env var set mid-session) is honored immediately. */
function resolveQueryFilePath() {
    const override = process.env.LB_SURVEY_QUERIES_PATH;
    if (override)
        return override;
    const resourcesPath = process.resourcesPath;
    if (resourcesPath) {
        const packagedPath = resolve(resourcesPath, 'liana_survey_queries.json');
        if (existsSync(packagedPath))
            return packagedPath;
    }
    return resolve(process.cwd(), 'resources', 'liana_survey_queries.json');
}
function loadQueryFile(path) {
    if (!existsSync(path)) {
        throw new Error(`[query_text_loader] survey query file NOT FOUND at "${path}" -- refusing to run with a `
            + 'guessed or hardcoded query (D-BP152-008: refusing beats guessing). Set '
            + 'LB_SURVEY_QUERIES_PATH to point at a valid copy, or restore '
            + 'resources/liana_survey_queries.json.');
    }
    let raw;
    try {
        raw = readFileSync(path, 'utf8');
    }
    catch (err) {
        throw new Error(`[query_text_loader] survey query file at "${path}" could not be read: ${err.message}`);
    }
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch (err) {
        throw new Error(`[query_text_loader] survey query file at "${path}" is not valid JSON: ${err.message}`);
    }
    const queries = parsed?.queries;
    if (!Array.isArray(queries)) {
        throw new Error(`[query_text_loader] survey query file at "${path}" has no top-level "queries" array -- malformed.`);
    }
    for (const q of queries) {
        const entry = q;
        if (typeof entry?.id !== 'string' || typeof entry?.template !== 'string') {
            throw new Error(`[query_text_loader] survey query file at "${path}" has a malformed entry (missing string `
                + `"id" or "template"): ${JSON.stringify(q)}`);
        }
    }
    return { queries: queries };
}
/**
 * Read the query file FRESH (no cache) and return entry `id`'s template, substituted with
 * `values`. Throws -- never silently falls back -- when: the file is missing/unreadable/
 * unparseable, the id is absent, or a placeholder the entry declares has no supplied value. The
 * throw always names the file path and the id/placeholder, per this ticket's "fail loudly and
 * safely" requirement.
 */
export function getQueryText(id, values = {}) {
    const path = resolveQueryFilePath();
    const file = loadQueryFile(path);
    const entry = file.queries.find((q) => q.id === id);
    if (!entry) {
        throw new Error(`[query_text_loader] survey query id "${id}" not found in "${path}" -- refusing to run with `
            + 'a guessed or hardcoded query (D-BP152-008: refusing beats guessing). Known ids: '
            + `${file.queries.map((q) => q.id).join(', ') || '(file has no entries)'}`);
    }
    for (const ph of entry.placeholders) {
        if (!(ph in values)) {
            throw new Error(`[query_text_loader] survey query id "${id}" (in "${path}") requires placeholder "${ph}", `
                + 'none supplied by the caller.');
        }
    }
    let out = entry.template;
    for (const [k, v] of Object.entries(values)) {
        out = out.split(`\${${k}}`).join(v);
    }
    return out;
}
