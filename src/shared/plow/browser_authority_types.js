"use strict";
// browser_authority_types.ts -- BP137 Yoke v2b Stage C ("Chrome-MCP Nexus Authority")
//
// WHY THIS FILE EXISTS (Bishop audit, BP137 prompt): chrome-mcp-google/perplexity access is
// ABSENT from this repo. `ai-providers/perplexity-client.ts` is a PAID metered API (Bearer key
// against api.perplexity.ai) -- confirmed by direct read -- and is the OPPOSITE of what this
// Yoke needs: a way to answer a lookup-fact question using the USER's OWN already-logged-in
// Google/Perplexity browser session, at the user's own $0 quota, instead of the Founder's or
// Liana Banyan's metered API budget. `renderer/hearth/embedded_browser/EmbeddedChrome.tsx`
// already embeds a live Chromium <webview> pointed at google.com, but (per the audit) only ever
// injects substrate context ONE-WAY (main/renderer -> page) -- there is no existing mechanism
// anywhere in this repo that asks a question in that webview and reads the ANSWER back out.
// This file is the shared vocabulary for the round-trip this Yoke adds: it holds every type and
// every pure (no I/O, no Electron import) helper function needed by BOTH the main-process side
// (src/main/plow/browser_authority_adapter.ts, the future Stage-4 lookup_fact caller) and the
// renderer/webview side (EmbeddedChrome.tsx + webview_preload.ts, the actual browser-connection
// point). Placed under src/shared/plow/ rather than src/main/plow/ (the location the Bishop
// prompt suggested) because this repo's own tsconfig split makes src/shared/** the ONLY
// directory both TypeScript projects agree to compile: tsconfig.main.json's "include" is
// ["src/main/**/*", "src/shared/**/*"] with no DOM lib, while tsconfig.renderer.json's
// "include" is ["src/renderer/**/*", ...] with the DOM lib -- a file under src/main/** is
// simply not visible to the renderer project's compiler, and vice versa. This is not a novel
// pattern invented for this Yoke: src/shared/membership_types.ts already does exactly this,
// imported by both src/main/membership/webhook_handler.ts (main) and src/renderer/App.tsx
// (renderer). This file follows that existing, working convention exactly.
//
// "Components not answers" / ToS-safety (Bishop prompt, repeated 3x): the vendor's full
// rendered page/prose is NEVER stored or forwarded past extraction -- only a short distilled
// FACT string plus its source URL crosses back out of the webview. See distillExtraction()
// below, which is the single choke point that enforces the length cap and never fields the
// raw payload through untouched.
//
// HONESTY FIREWALL (Bishop prompt, repeated 3x: "never fake a result"): every type in this file
// that represents a real answer (BrowserAuthorityLookupResult) can ONLY be constructed by
// distillExtraction() from a genuinely non-null extraction payload. There is deliberately no
// helper anywhere in this Yoke's new files that fabricates a placeholder fact or a placeholder
// sourceUrl -- absence of a real extraction must surface as `null`, never as a fake-success
// object. See src/main/plow/browser_authority_adapter.ts's file header for the exact,
// currently-ABSENT wiring gap (main-process caller <-> live renderer webview) this firewall
// guards against being papered over.
Object.defineProperty(exports, "__esModule", { value: true });
exports.ENSEMBLE_AUTHORITY_KEYS = exports.DEFAULT_NEXUS_PER_ARM_AUTHORITY = exports.NEXUS_AUTHORITY_OPTIONS = exports.NEXUS_ARM_NAMES = void 0;
exports.isInteractiveBrowserAuthority = isInteractiveBrowserAuthority;
exports.isBrowserAuthorityEnabled = isBrowserAuthorityEnabled;
exports.buildMcAwareQueryText = buildMcAwareQueryText;
exports.buildBrowserAuthorityQueryUrl = buildBrowserAuthorityQueryUrl;
exports.distillExtraction = distillExtraction;
exports.createDefaultAuthorityAttemptOutcomes = createDefaultAuthorityAttemptOutcomes;
exports.normalizeAuthorityAttemptOutcomes = normalizeAuthorityAttemptOutcomes;
exports.truncateAuthorityPreview = truncateAuthorityPreview;
exports.decideNexusThreadContinuation = decideNexusThreadContinuation;
exports.createNexusRunThreadContext = createNexusRunThreadContext;
exports.NEXUS_ARM_NAMES = ['computable', 'lookup_fact', 'reasoning'];
/** Full option roster the per-arm picker renders for every arm (BP137 Yoke v2b Stage C item 2). */
exports.NEXUS_AUTHORITY_OPTIONS = [
    {
        authority: 'local_free',
        label: 'Local / Free (default)',
        free: true,
        description: 'The existing on-device path for this arm -- Ollama / the specialist-adapter swarm. No browser, no network quota spent beyond the free public APIs already in specialist_adapters.ts.',
    },
    {
        authority: 'user_google',
        label: "User's Google (browser)",
        free: true,
        description: 'Runs the question in the Google session already logged into the embedded Chrome panel -- your own account, your own quota, $0. Requires researchArmMode + researchArmBrowserAuthority both enabled.',
    },
    {
        authority: 'user_perplexity',
        label: "User's Perplexity (browser)",
        free: true,
        description: "Runs the question in the Perplexity session already logged into the embedded Chrome panel -- your own account, your own quota, $0. Distinct from the paid ai-providers/perplexity-client.ts API path.",
    },
    {
        authority: 'paid_api',
        label: 'Paid API (escalate only)',
        free: false,
        description: 'Metered vendor API call billed to Liana Banyan (e.g. the paid Perplexity chat-completions API). Never the default -- only ever chosen explicitly by the user, or reached by an escalation step this Yoke does not build.',
    },
];
/**
 * Bishop-prompt-mandated default: "default to the user's free resources... no arm should
 * default to a paid authority." local_free is what every arm already does today with zero new
 * code, so it is the safe, behavior-preserving default for all three arms.
 */
exports.DEFAULT_NEXUS_PER_ARM_AUTHORITY = {
    computable: 'local_free',
    lookup_fact: 'local_free',
    reasoning: 'local_free',
};
/** True for authorities that cannot be reached via a plain navigable query URL and instead need
 *  the composer-type + submit + wait-for-stream-completion + scrape sequence. Every caller that
 *  branches on "URL-query vs interactive" (index.ts's runBrowserAuthorityQueryFromMain,
 *  buildBrowserAuthorityQueryUrl below) must use this single function rather than re-deriving the
 *  distinction inline, so adding a future interactive vendor (chatgpt.com, gemini.google.com) is
 *  a one-line change here instead of a hunt across call sites.
 *  BP140-K4: chatgpt.com/gemini.google.com added -- both are interactive-only exactly like
 *  claude.ai/new (no query-URL form either vendor supports for a fresh, unauthenticated-friendly
 *  navigation). */
function isInteractiveBrowserAuthority(name) {
    return name === 'user_claude' || name === 'user_chatgpt' || name === 'user_gemini';
}
/**
 * Byte-for-byte the same "is this feature reachable at all" check every caller of this module
 * must run FIRST. When this returns false, no other function in this file (or in
 * src/main/plow/browser_authority_adapter.ts) may execute any network/webview/IPC side effect
 * -- that is the flag-OFF byte-unchanged guarantee this Yoke's acceptance criteria require.
 */
function isBrowserAuthorityEnabled(config) {
    return !!(config.researchArmMode && config.researchArmBrowserAuthority);
}
// ─── Pure helpers (no I/O, safe under both tsc projects) ─────────────────────────────────────
const GOOGLE_SEARCH_BASE = 'https://www.google.com/search?q=';
const PERPLEXITY_SEARCH_BASE = 'https://www.perplexity.ai/search?q=';
/** claude.ai has no query-URL form -- the question travels via the interactive composer-type
 *  payload (built by the caller from query.question/query.mcOptions via buildMcAwareQueryText
 *  below when options are present), never via the navigation URL itself. This is always the
 *  literal navigation target for a 'user_claude' query, regardless of question/mcOptions. */
const CLAUDE_NEW_CHAT_URL = 'https://claude.ai/new';
/** BP140-K4: same "no query-URL form, question travels via the composer" contract as
 *  CLAUDE_NEW_CHAT_URL above, for chatgpt.com's fresh-conversation landing page. */
const CHATGPT_NEW_CHAT_URL = 'https://chatgpt.com/';
/** BP140-K4: same contract as CLAUDE_NEW_CHAT_URL above, for gemini.google.com's app landing
 *  page (the '/app' path is Gemini's own logged-in chat surface, mirroring bard.google.com's
 *  legacy-domain redirect target). */
const GEMINI_NEW_CHAT_URL = 'https://gemini.google.com/app';
/** WIRE-THE-LOOP fix: builds the enriched prompt text sent to an authority that can genuinely
 *  reason over a multiple-choice option list (Perplexity's search box accepts a full natural-
 *  language prompt, not just keywords -- unlike Google, which degrades to a keyword search for
 *  anything this long). Pure string function, no I/O. Deliberately asks for the letter FIRST
 *  ("Answer: <letter>") so extractChosenLetterFromAuthorityText() in plow_mc_answerer.ts can
 *  find it with a simple anchored regex instead of guessing from prose.
 *  BP139 Authority Ensemble: previously never used for user_google ("Google is the LOOKUP
 *  authority... a bare fact search, not a reasoning prompt"). The ensemble's explicit ask is
 *  "query Google WITH the MC options too" (Founder mandate) -- see BrowserAuthorityQuery.
 *  embedOptionsForGoogle below, this function's OWN behavior is unchanged either way (still a
 *  pure question+options formatter; the caller decides which authorities it's used for). */
function buildMcAwareQueryText(question, mcOptions) {
    const optionLines = mcOptions.join('\n');
    return (`${question.trim()}\n\nOptions:\n${optionLines}\n\n` +
        `Which option is correct? Reply starting with "Answer: <letter>" then a one-sentence reason.`);
}
/** Builds the literal navigation URL for a browser-authority query. Pure string function --
 *  the actual `webviewRef.current.loadURL(...)` call happens in EmbeddedChrome.tsx, never here.
 *  WIRE-THE-LOOP fix: when query.mcOptions is present AND the authority is user_perplexity, the
 *  navigated query is the options-aware prompt (buildMcAwareQueryText above) instead of the bare
 *  question -- this is the "send the question WITH ITS OPTIONS to the authority" fix.
 *  BP139 Authority Ensemble: the SAME options-aware prompt now also fires for user_google, but
 *  ONLY when the caller explicitly sets query.embedOptionsForGoogle -- every pre-ensemble caller
 *  (Stage F2 legacy path, Stage F3 mesh-synergy) never sets that field, so this stays
 *  byte-identical bare-question behavior for them. */
function buildBrowserAuthorityQueryUrl(query) {
    // (this build pass) user_claude is interactive (see isInteractiveBrowserAuthority above): there
    // is no query-URL form for claude.ai/new, so this always returns the same fixed landing URL
    // regardless of query.question/mcOptions -- the caller (index.ts's
    // runBrowserAuthorityQueryFromMain) detects isInteractiveBrowserAuthority(query.authority) and
    // drives the composer interactively instead of relying on this URL to encode the question.
    if (query.authority === 'user_claude')
        return CLAUDE_NEW_CHAT_URL;
    // BP140-K4: chatgpt.com/gemini.google.com are interactive-only exactly like claude.ai/new --
    // same fixed-landing-URL contract, question travels via the composer, never the navigation URL.
    if (query.authority === 'user_chatgpt')
        return CHATGPT_NEW_CHAT_URL;
    if (query.authority === 'user_gemini')
        return GEMINI_NEW_CHAT_URL;
    const hasOptions = !!(query.mcOptions && query.mcOptions.length > 0);
    const wantsOptionsAwareQuery = hasOptions && (query.authority === 'user_perplexity' || (query.authority === 'user_google' && query.embedOptionsForGoogle === true));
    if (wantsOptionsAwareQuery) {
        const encoded = encodeURIComponent(buildMcAwareQueryText(query.question, query.mcOptions));
        return query.authority === 'user_perplexity'
            ? `${PERPLEXITY_SEARCH_BASE}${encoded}`
            : `${GOOGLE_SEARCH_BASE}${encoded}`;
    }
    const encoded = encodeURIComponent(query.question.trim());
    return query.authority === 'user_perplexity'
        ? `${PERPLEXITY_SEARCH_BASE}${encoded}`
        : `${GOOGLE_SEARCH_BASE}${encoded}`;
}
/** Hard cap on the distilled fact length -- "components not answers": this is a FACT, not a
 *  copy of the vendor's article. Chosen to match specialist_adapters.ts's CandidateEblet
 *  content conventions (those adapters slice to 600-800 chars; a distilled single-fact answer
 *  should be materially shorter than a multi-sentence encyclopedia extract). */
const MAX_FACT_CHARS = 320;
/**
 * The single choke point through which a raw webview-scraped snippet becomes the FACT this
 * module is allowed to return. Returns null (never a fabricated/partial result) whenever the
 * raw extraction lacks either a non-empty snippet or a real source URL -- this is what makes
 * the "never fake a result" firewall enforceable by inspection: nothing downstream of this
 * function ever sees a BrowserAuthorityLookupResult that didn't pass through here.
 */
function distillExtraction(raw, queryText) {
    const trimmedSnippet = raw.snippet.trim().replace(/\s+/g, ' ');
    if (!trimmedSnippet || !raw.sourceUrl)
        return null;
    return {
        fact: trimmedSnippet.length > MAX_FACT_CHARS
            ? trimmedSnippet.slice(0, MAX_FACT_CHARS).trim() + '...'
            : trimmedSnippet,
        sourceUrl: raw.sourceUrl,
        authority: raw.authority,
        verified: trimmedSnippet.length >= 20, // weak "genuinely scraped something substantive" signal
        queryText,
        extractedAt: new Date().toISOString(),
        // BP149 D-BP149-016 (R4 repair): previously raw.citations/raw.results were never read here at
        // all -- this is the exact "type-boundary drop" the ticket exists to close. `raw.citations`
        // spread conditionally so a pre-fix raw object (the field genuinely absent, not empty) yields
        // an absent field here too, never a fabricated empty array standing in for "never collected".
        ...(raw.citations !== undefined ? { citations: raw.citations } : {}),
        ...(raw.results !== undefined ? { results: raw.results } : {}),
    };
}
exports.ENSEMBLE_AUTHORITY_KEYS = [
    'user_google', 'user_perplexity', 'user_claude', 'user_chatgpt', 'user_gemini', 'specialist_swarm',
];
/** T3's "an absent key is exactly the ambiguity this ticket removes, so absence is not
 *  permitted" -- the single place all six keys get seeded to 'not_attempted' before anything is
 *  actually tried. Every question's record starts as this object; individual keys are then
 *  overwritten (never deleted) as the ensemble genuinely reaches each authority. */
function createDefaultAuthorityAttemptOutcomes() {
    const out = {};
    for (const key of exports.ENSEMBLE_AUTHORITY_KEYS)
        out[key] = { outcome: 'not_attempted' };
    return out;
}
/** The single normalization choke point for T3's "no key omitted anywhere" gate: fills in
 *  'not_attempted' for any of the six keys missing from a partial (or entirely absent) record,
 *  never removes or overwrites a key that IS already present. Pure, no I/O -- safe to call from
 *  the receipt-shaping layer (one_click_mmlu_pro.ts) on every question, including the ones whose
 *  answer came from a deterministic bypass that never touched this record at all. */
function normalizeAuthorityAttemptOutcomes(partial) {
    const base = createDefaultAuthorityAttemptOutcomes();
    if (!partial)
        return base;
    for (const key of exports.ENSEMBLE_AUTHORITY_KEYS) {
        const rec = partial[key];
        if (rec && typeof rec.outcome === 'string')
            base[key] = rec;
    }
    return base;
}
/** T3's "first 200 characters of what was actually returned" -- one pure helper so every
 *  parse_failed call site truncates identically instead of re-deriving the same slice(0,200). */
function truncateAuthorityPreview(text, maxChars = 200) {
    return text.length > maxChars ? text.slice(0, maxChars) : text;
}
/**
 * The ONE decision point for whether a query continues an existing live conversation or must
 * start a fresh one. Pure, no I/O, no Electron import -- exhaustively unit-testable without a
 * live window (see browser_authority_types.thread.test.ts).
 *
 * ATTRIBUTED (the reset guarantee): Dispatch D-BP152-030R, verbatim: "thread continuity is
 * scoped to ONE question/run. A new question ALWAYS starts a new thread." Enforced here by
 * requiring an EXACT match on both `authority` AND `threadId` against whatever is currently
 * live -- any mismatch (a different question's threadId, a different authority, a caller that
 * didn't ask to continue, or no threadId at all) always returns `continuing: false`, which the
 * caller MUST use to force a full page navigation. A full navigation is the only mechanism that
 * can guarantee zero DOM/JS state (text, prior answer, prior option list) survives into the next
 * question -- there is deliberately no "partial reset" path.
 *
 * ATTRIBUTED (which surfaces thread at all): this dispatch's own instruction, verbatim: "A
 * thread only exists where the surface has one." isInteractiveBrowserAuthority() above is this
 * codebase's existing, single source of truth for which authorities actually have a live
 * composer-driven page to continue -- 'user_google' (and, per this codebase's current driver,
 * 'user_perplexity' -- see this ticket's SEG return for why the vendor having a thread does not
 * mean this app's driver does) are never eligible, full stop, regardless of what the caller asks.
 */
function decideNexusThreadContinuation(query, current) {
    if (!isInteractiveBrowserAuthority(query.authority)) {
        return { continuing: false, nextState: null, threadStatus: 'new', threadPosition: null };
    }
    const wantsContinue = !!(query.continueThread && query.threadId);
    const matchesLiveThread = wantsContinue &&
        current !== null &&
        current.authority === query.authority &&
        current.threadId === query.threadId;
    if (matchesLiveThread) {
        const nextState = {
            authority: query.authority,
            threadId: query.threadId,
            position: current.position + 1,
        };
        return { continuing: true, nextState, threadStatus: 'continued', threadPosition: nextState.position };
    }
    // No match -- either this genuinely is a new question, or the caller asked to continue
    // something that is NOT what the shared webview actually has live right now. Both are treated
    // identically: never trust a mismatch, always force a fresh navigation.
    if (query.threadId) {
        const nextState = { authority: query.authority, threadId: query.threadId, position: 1 };
        return { continuing: false, nextState, threadStatus: 'new', threadPosition: 1 };
    }
    return { continuing: false, nextState: null, threadStatus: 'new', threadPosition: null };
}
/** Mints one run's thread-identity space. `seed` defaults to a fresh, effectively-unique string
 *  (timestamp + random suffix) generated at CALL time -- i.e. once per run, not once per query --
 *  so two runs created even in the same millisecond still get different seeds (Math.random's
 *  contribution). Accepting an explicit `seed` is for tests ONLY (deterministic thread ids to
 *  assert against); no production call site passes one. No I/O, no Electron import -- consistent
 *  with this file's own header contract. */
function createNexusRunThreadContext(seed) {
    const runSeed = seed ?? `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    const threadIdsByAuthority = new Map();
    return {
        forQuery(authority) {
            // Same test this file's own decideNexusThreadContinuation runs first (isInteractiveBrowserAuthority) --
            // never mints or tracks an id for a static (Google/Perplexity) authority. This is
            // defense-in-depth, not the enforcement point (decideNexusThreadContinuation still gates
            // continuation independently), so Google/Perplexity staying one-shot does not rely on this
            // factory alone getting it right.
            if (!isInteractiveBrowserAuthority(authority)) {
                return { threadId: undefined, continueThread: false };
            }
            const existing = threadIdsByAuthority.get(authority);
            if (existing !== undefined) {
                return { threadId: existing, continueThread: true };
            }
            const minted = `${runSeed}:${authority}`;
            threadIdsByAuthority.set(authority, minted);
            return { threadId: minted, continueThread: false };
        },
    };
}
//# sourceMappingURL=browser_authority_types.js.map