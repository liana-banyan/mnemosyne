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

// ─── Arms (mirrors answer_type_classifier.ts's AnswerType literal-for-literal) ───────────────
//
// Deliberately NOT imported from src/main/plow/answer_type_classifier.ts (a brand-new,
// currently-untracked file per `git status` at BP137 Stage C investigation time, actively
// owned by a concurrent tab's in-flight work) -- this avoids any accidental coupling to that
// file's evolution during this pass. The three literal values below are chosen to match its
// `AnswerType` union exactly ('computable' | 'lookup_fact' | 'reasoning') so that a future
// wiring pass can map 1:1 between the two without a translation layer.
export type NexusArmName = 'computable' | 'lookup_fact' | 'reasoning';

export const NEXUS_ARM_NAMES: readonly NexusArmName[] = ['computable', 'lookup_fact', 'reasoning'];

// ─── Authorities ──────────────────────────────────────────────────────────────────────────────

/**
 * Every authority the Nexus per-arm picker can offer for an arm. `local_free` is the existing,
 * always-available default (Ollama / the swarm's own specialist adapters -- whatever the arm
 * already does today with no new code). `user_google` / `user_perplexity` are THIS Yoke's new
 * browser-authority adapter, routed through the user's own logged-in session at $0. `paid_api`
 * names the existing metered path (e.g. ai-providers/perplexity-client.ts, or a paid Wolfram
 * tier) -- present in the option set only so the picker can show it as an explicit, clearly-
 * labeled escalation choice; nothing in this Yoke's new files ever defaults an arm to it.
 */
export type NexusAuthorityName = 'local_free' | 'user_google' | 'user_perplexity' | 'paid_api';

export interface NexusAuthorityOption {
  authority: NexusAuthorityName;
  label: string;
  /** true = $0 to the user for this call, false = metered/paid. Never true for 'paid_api'. */
  free: boolean;
  description: string;
}

/** Full option roster the per-arm picker renders for every arm (BP137 Yoke v2b Stage C item 2). */
export const NEXUS_AUTHORITY_OPTIONS: readonly NexusAuthorityOption[] = [
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

/** Per-arm authority selection, as persisted by nexus_authority_settings_store.ts. */
export type NexusPerArmAuthority = Record<NexusArmName, NexusAuthorityName>;

/**
 * Bishop-prompt-mandated default: "default to the user's free resources... no arm should
 * default to a paid authority." local_free is what every arm already does today with zero new
 * code, so it is the safe, behavior-preserving default for all three arms.
 */
export const DEFAULT_NEXUS_PER_ARM_AUTHORITY: NexusPerArmAuthority = {
  computable: 'local_free',
  lookup_fact: 'local_free',
  reasoning: 'local_free',
};

// ─── Browser-authority adapter types (item 1) ────────────────────────────────────────────────

// (this build pass) 'user_claude' added: wires plow_mc_answerer.ts's premium
// BrowserLlmAuthorityName 'user_claude' stub to a REAL driver -- unlike user_google/
// user_perplexity (a static query-URL DOM scrape), claude.ai/new has no query-URL form; it
// requires INTERACTIVE driving (navigate -> type into the composer -> submit -> wait for the
// streamed reply to finish -> scrape the final assistant message). See
// isInteractiveBrowserAuthority() below for the single switch every caller checks to know which
// of the two mechanisms applies, and webview_preload.ts's 'browser-authority-run-interactive-
// query' handler for the actual type+submit+wait+scrape implementation.
//
// BP140-K4: 'user_chatgpt' | 'user_gemini' added -- the exact one-line change this file's own
// prior comment predicted ("adding a future interactive vendor... is a one-line change here").
// Both are wired against chatgpt.com and gemini.google.com's FREE, logged-in web UIs via
// MnemosyneC's own embedded nexus webview, mirroring claude.ai's interactive driver shape
// exactly (webview_preload.ts's per-vendor selector configs + generic interactive-query runner).
// NEVER a metered API, NEVER an API key, NEVER the paid Chrome extension path -- same "own
// logged-in session, own quota, $0" contract as every other browser authority in this file.
export type BrowserAuthorityName = 'user_google' | 'user_perplexity' | 'user_claude' | 'user_chatgpt' | 'user_gemini';

/** True for authorities that cannot be reached via a plain navigable query URL and instead need
 *  the composer-type + submit + wait-for-stream-completion + scrape sequence. Every caller that
 *  branches on "URL-query vs interactive" (index.ts's runBrowserAuthorityQueryFromMain,
 *  buildBrowserAuthorityQueryUrl below) must use this single function rather than re-deriving the
 *  distinction inline, so adding a future interactive vendor (chatgpt.com, gemini.google.com) is
 *  a one-line change here instead of a hunt across call sites.
 *  BP140-K4: chatgpt.com/gemini.google.com added -- both are interactive-only exactly like
 *  claude.ai/new (no query-URL form either vendor supports for a fresh, unauthenticated-friendly
 *  navigation). */
export function isInteractiveBrowserAuthority(name: BrowserAuthorityName): boolean {
  return name === 'user_claude' || name === 'user_chatgpt' || name === 'user_gemini';
}

/** What the caller wants answered, and which of the user's own logged-in sessions to use. */
export interface BrowserAuthorityQuery {
  question: string;
  authority: BrowserAuthorityName;
  /** WIRE-THE-LOOP fix (BP139-follow, honesty gate): when present, the MC option texts
   *  ("A) ...", "B) ...", ...) for THIS question. buildBrowserAuthorityQueryUrl() below embeds
   *  these into the navigation query for authorities that can actually reason over them
   *  (user_perplexity) so the vendor page itself picks a letter and states its reasoning +
   *  source, instead of the caller having to token-match a bare lookup snippet against option
   *  text that the snippet was never asked about. Absent/empty = byte-identical bare-question
   *  behavior (every pre-existing caller). */
  mcOptions?: string[];
  /** BP139 Authority Ensemble (plow_mc_answerer.ts researchArmAuthorityEnsemble), OPT-IN/
   *  ADDITIVE: when true AND authority is 'user_google' AND mcOptions is present, embeds the MC
   *  options into the Google query too (same buildMcAwareQueryText mechanism user_perplexity
   *  already used) instead of Google's pre-ensemble bare-question-only search. Absent/false on
   *  every pre-ensemble caller (Stage F2's legacy path, Stage F3 mesh-synergy) -- byte-identical
   *  Google-bare-search behavior for all of them. See buildBrowserAuthorityQueryUrl below. */
  embedOptionsForGoogle?: boolean;
  /** D-BP152-030R, ADDITIVE/OPTIONAL. Identifies ONE question's worth of related queries for a
   *  CONVERSATIONAL authority (isInteractiveBrowserAuthority() only -- see
   *  decideNexusThreadContinuation below; 'user_google'/'user_perplexity' have no thread in this
   *  codebase's driver and never consult this field). Absent on every pre-existing caller --
   *  byte-identical one-shot behavior for all of them. */
  threadId?: string;
  /** D-BP152-030R, ADDITIVE/OPTIONAL. Explicit ask to continue `threadId`'s existing live
   *  conversation rather than starting a fresh one. Absent/false ALWAYS starts fresh (the
   *  pre-existing behavior), regardless of threadId. This is deliberately opt-IN, never inferred
   *  from threadId's mere presence -- a caller that only wants to LABEL its calls with a
   *  threadId (for receipts) without ever continuing must not accidentally trigger reuse. */
  continueThread?: boolean;
}

/**
 * The RAW payload the webview-side extraction reports back, before distillation. This shape is
 * intentionally allowed to carry a short-but-not-tiny snippet of vendor text (never the whole
 * page) so distillExtraction() has something to trim -- callers of this module must never
 * forward `snippet` past distillExtraction(); only the distilled `fact` field is meant to leave
 * this module's boundary (see the file-header "components not answers" note).
 */
/** BP149 D-BP149-016 (provwire), mirrors webview_preload.ts's own (non-exported, structurally
 *  identical) CitationRecord -- this is the SHARED-file canonical shape a main-process consumer
 *  can import. `extractCitationsFromElement()` in webview_preload.ts has been producing this
 *  shape on every extraction path since KN-BP145-B; it was simply never carried past the 4-field
 *  BrowserAuthorityRawExtraction boundary below (R4, "the type-boundary drop is the real
 *  defect"). Never fabricated -- an empty array means no discoverable citation link, never an
 *  absent/omitted field. */
export interface CitationRecord {
  url: string;
  label: string;
  /** Hostname proxy (e.g. "wikipedia.org"), not a semantic topic category -- see
   *  webview_preload.ts's own CitationRecord doc comment for why. */
  category: string;
}

/** BP149 D-BP149-016 (provwire), mirrors webview_preload.ts's own (non-exported, structurally
 *  identical) SearchResultCandidate (KN-BP147-M2's multi-result capture). One ranked candidate
 *  independently listed by the underlying page (one Google organic-result row, one Perplexity
 *  Sources-panel card). `rank` is 1-based DOM order, never re-sorted here. */
export interface SearchResultCandidate {
  rank: number;
  url: string;
  title: string;
  snippet: string;
}

export interface BrowserAuthorityRawExtraction {
  /** Best-effort scraped answer text, already stripped of markup by the webview-side scraper. */
  snippet: string;
  /** The literal URL of the page the snippet was scraped from (window.location.href at scrape
   *  time) -- never fabricated or defaulted; absence of a real URL means extraction failed. */
  sourceUrl: string | null;
  authority: BrowserAuthorityName;
  /** Which DOM heuristic matched (for audit/debugging only, never shown to end users). */
  selectorUsed: string | null;
  /** BP149 D-BP149-016, ADDITIVE/OPTIONAL -- the scraper (webview_preload.ts's
   *  extractCitationsFromElement/BrowserAuthorityExtractionResultMessage.citations) has always
   *  collected this; it is now carried past this boundary instead of being silently discarded.
   *  Absent on every pre-fix caller that has not been updated to populate it -- every existing
   *  consumer that destructures only {snippet, sourceUrl, authority, selectorUsed} keeps
   *  compiling and behaving identically (R4/HARDWIRE convention: additive only). */
  citations?: CitationRecord[];
  /** BP149 D-BP149-016, ADDITIVE/OPTIONAL -- webview_preload.ts's KN-BP147-M2 multi-result
   *  capture (BrowserAuthorityExtractionResultMessage.results, Google organic results /
   *  Perplexity Sources-panel cards). Same absent-on-pre-fix-callers guarantee as `citations`
   *  above. Never populated for the interactive authorities (user_claude/user_chatgpt/
   *  user_gemini) -- their single-message thread has no independent multi-candidate structure to
   *  capture, per webview_preload.ts's own extractMultiResultCandidates() dispatch. */
  results?: SearchResultCandidate[];
  /** D-BP152-030R, ADDITIVE/OPTIONAL -- 'new' when this call started (or was forced to start,
   *  per decideNexusThreadContinuation's reset guarantee) a fresh conversation; 'continued' when
   *  it reused an already-live one. Absent for authorities that never thread ('user_google',
   *  'user_perplexity') and for any pre-fix caller. See decideNexusThreadContinuation below. */
  threadStatus?: 'new' | 'continued';
  /** D-BP152-030R, ADDITIVE/OPTIONAL -- 1-based count of queries sent in this thread so far,
   *  INCLUDING this one. Absent whenever threadStatus is absent (no threadId was supplied, so no
   *  position is tracked). Counts attempts sent, not successful replies. */
  threadPosition?: number;
  /** D-BP152-050/BISHOP/seg-honest-failure-reasons, ADDITIVE/OPTIONAL -- true only when the
   *  static (Google/Perplexity) dispatch STRUCTURALLY identified the landed page as a
   *  verification/rate-limit challenge (webview_preload.ts's isGoogleChallengeUrl(), a URL-only
   *  check against window.location.href -- never a word-list match against page prose). Absent
   *  (not false) on every pre-fix caller and on any extraction this check does not run for
   *  (the interactive authorities, or a genuine successful extraction). Deliberately kept OUT of
   *  the closed BrowserAuthorityAttemptOutcome/BrowserAuthorityDispatchOutcome vocabularies below
   *  (KN-BP144-7's "exactly these nine values, no free text" contract, and T2's "strict subset
   *  of the nine" contract) -- this ticket does not touch that ensemble-receipt instrumentation;
   *  this is a separate, narrower signal read only by the Liana Cycle's own askGoogle wrapper
   *  (index.ts) and comparative_cascade.ts's googleBlocks(). */
  challengeDetected?: boolean;
  /** D-BP152-050, ADDITIVE/OPTIONAL -- the Liana Cycle's own askGoogle wrapper (index.ts,
   *  buildLianaAskGoogle()) re-exposes runBrowserAuthorityQueryFromMainObserved()'s ALREADY-
   *  COMPUTED BrowserAuthorityDispatchOutcome here (same type, no new literals added to it) so
   *  googleBlocks() can tell "window/session unavailable" (disabled) from "a network/navigation
   *  timeout" (timeout) from "asked, returned, nothing usable" (no_result/dispatched), instead of
   *  every non-answer collapsing into the same generic null. Absent on every OTHER caller of
   *  runBrowserAuthorityQueryFromMain (Stage F3 mesh-synergy, decompose, the eliminator, the
   *  Ask-tab lookup, the direct IPC handler, plow_mc_answerer.ts) -- none of them are touched by
   *  this ticket and none of them populate this field. */
  dispatchOutcome?: BrowserAuthorityDispatchOutcome;
}

/** BP137 Yoke v2b Stage C item 1's ProvenanceReceipt-compatible output shape. Field names/
 *  semantics are deliberately chosen to be an easy 1:1 mapping onto plow_mc_answerer.ts's
 *  `ProvenanceReceipt` interface ({ source, contentHash, verified, provenanceUrl }) for the
 *  deferred Stage-4 wiring -- this module does not import from or construct a ProvenanceReceipt
 *  itself (plow_mc_answerer.ts is untouched this pass), it only makes the mapping obvious:
 *  fact -> (content to be hashed), sourceUrl -> provenanceUrl, authority -> source,
 *  verified -> verified. */
export interface BrowserAuthorityLookupResult {
  /** The distilled FACT text -- never the vendor's full prose response. */
  fact: string;
  /** Genuinely extracted source URL. Never a placeholder; a failed extraction returns `null`
   *  from runBrowserAuthorityLookup() instead of a result object with a fake URL. */
  sourceUrl: string;
  authority: BrowserAuthorityName;
  /** True only when the extraction produced a non-empty snippet AND a real source URL. This is
   *  a much weaker signal than plow_mc_answerer.ts's Saladin-adversarial-fence `verified` (this
   *  module has no adversarial fence of its own) -- it means "genuinely scraped", not
   *  "adversarially confirmed". The deferred Stage-4 wiring decides how to fold this into a
   *  real ProvenanceReceipt.verified bit. */
  verified: boolean;
  queryText: string;
  extractedAt: string; // ISO8601
  /** BP149 D-BP149-016, ADDITIVE/OPTIONAL -- threaded straight through from
   *  BrowserAuthorityRawExtraction.citations by distillExtraction() below. Absent (not empty)
   *  when the raw extraction did not carry the field at all (a pre-fix caller); an empty array
   *  means the field WAS carried and genuinely found nothing. */
  citations?: CitationRecord[];
  /** BP149 D-BP149-016, ADDITIVE/OPTIONAL -- threaded straight through from
   *  BrowserAuthorityRawExtraction.results. Same absent-vs-empty distinction as `citations`. */
  results?: SearchResultCandidate[];
}

/**
 * BP137 Yoke v2b Stage C flag gate. Follows the EXACT convention already used by
 * `CanonicalPlowMcConfig` in plow_mc_answerer.ts (read for style only, not imported): a plain
 * optional boolean, AND-gated with the master `researchArmMode` switch, default false/absent
 * everywhere. Defined here (a new file) rather than added to CanonicalPlowMcConfig itself
 * because plow_mc_answerer.ts is explicitly forbidden from any edit this pass -- a future
 * Stage-4 wiring pass is expected to add a `researchArmBrowserAuthority?: boolean` field to
 * that interface that means exactly the same thing as this one.
 */
export interface BrowserAuthorityAdapterConfig {
  /** Master switch -- same name/semantics as plow_mc_answerer.ts's CanonicalPlowMcConfig
   *  field of the same name. Both this AND researchArmBrowserAuthority must be true. */
  researchArmMode?: boolean;
  /** Sub-flag for this Yoke specifically. AND-gated with researchArmMode per the convention
   *  above -- a bare accidental flip of this alone (with researchArmMode false/absent) can
   *  never activate any of this module's new code paths. */
  researchArmBrowserAuthority?: boolean;
  /** Which of the user's logged-in sessions to prefer when both are plausible candidates for a
   *  given question. Defaults to 'user_google' when absent (see isBrowserAuthorityEnabled /
   *  runBrowserAuthorityLookup below). */
  preferredAuthority?: BrowserAuthorityName;
  /** WIRE-THE-LOOP fix: threaded through to BrowserAuthorityQuery.mcOptions (see that field's
   *  doc comment). Absent/empty = byte-identical bare-question behavior for every pre-existing
   *  caller (nothing in this repo set this field before this fix). */
  mcOptions?: string[];
  /** BP139 Authority Ensemble: threaded through to BrowserAuthorityQuery.embedOptionsForGoogle
   *  (see that field's doc comment). Absent/false = byte-identical Google-bare-search behavior
   *  for every pre-ensemble caller. */
  embedOptionsForGoogle?: boolean;
}

/**
 * Byte-for-byte the same "is this feature reachable at all" check every caller of this module
 * must run FIRST. When this returns false, no other function in this file (or in
 * src/main/plow/browser_authority_adapter.ts) may execute any network/webview/IPC side effect
 * -- that is the flag-OFF byte-unchanged guarantee this Yoke's acceptance criteria require.
 */
export function isBrowserAuthorityEnabled(config: BrowserAuthorityAdapterConfig): boolean {
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
export function buildMcAwareQueryText(question: string, mcOptions: string[]): string {
  const optionLines = mcOptions.join('\n');
  return (
    `${question.trim()}\n\nOptions:\n${optionLines}\n\n` +
    `Which option is correct? Reply starting with "Answer: <letter>" then a one-sentence reason.`
  );
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
export function buildBrowserAuthorityQueryUrl(query: BrowserAuthorityQuery): string {
  // (this build pass) user_claude is interactive (see isInteractiveBrowserAuthority above): there
  // is no query-URL form for claude.ai/new, so this always returns the same fixed landing URL
  // regardless of query.question/mcOptions -- the caller (index.ts's
  // runBrowserAuthorityQueryFromMain) detects isInteractiveBrowserAuthority(query.authority) and
  // drives the composer interactively instead of relying on this URL to encode the question.
  if (query.authority === 'user_claude') return CLAUDE_NEW_CHAT_URL;
  // BP140-K4: chatgpt.com/gemini.google.com are interactive-only exactly like claude.ai/new --
  // same fixed-landing-URL contract, question travels via the composer, never the navigation URL.
  if (query.authority === 'user_chatgpt') return CHATGPT_NEW_CHAT_URL;
  if (query.authority === 'user_gemini') return GEMINI_NEW_CHAT_URL;

  const hasOptions = !!(query.mcOptions && query.mcOptions.length > 0);
  const wantsOptionsAwareQuery =
    hasOptions && (query.authority === 'user_perplexity' || (query.authority === 'user_google' && query.embedOptionsForGoogle === true));
  if (wantsOptionsAwareQuery) {
    const encoded = encodeURIComponent(buildMcAwareQueryText(query.question, query.mcOptions!));
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
export function distillExtraction(
  raw: BrowserAuthorityRawExtraction,
  queryText: string,
): BrowserAuthorityLookupResult | null {
  const trimmedSnippet = raw.snippet.trim().replace(/\s+/g, ' ');
  if (!trimmedSnippet || !raw.sourceUrl) return null;

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

// ─── KN-BP144-7 ("Make The Silent Authorities Loud"): closed-vocabulary attempt-outcome ───────
// instrumentation. PURELY ADDITIVE -- nothing below this banner is read by, or changes, any
// answering/scoring/elimination decision anywhere in this repo. It exists solely so a receipt
// can say, per question and per authority, WHICH of these nine (and only these nine) states
// actually happened, instead of every non-answer looking like the same absent key. See
// KN-BP144-7_MAKE_THE_SILENT_AUTHORITIES_LOUD.md for the full rationale (the qid 92 run
// 039-vs-040 delta this closes).
//
// D-BP159-011 (2026-08-19): grew from seven values to nine. The measurement driver could not
// distinguish a source that actively refused us (rate limit / verification challenge) from a
// plain transport failure (could not reach the source at all) -- the vocabulary had no word for
// either, so both silently collapsed into 'no_result', a value that already means something
// else ("asked, returned successfully, produced nothing usable"). Recording a throttle as
// no_result is exactly the "every non-answer looks like the same absent key" failure KN-BP144-7
// exists to close, one layer deeper. 'throttled' and 'transport_error' below name those two
// states honestly instead. See D-BP159-010 for the scoping SEG that proved the T1/T2 subset
// relation is a real type-enforced invariant, and the Founder's ruling to extend the vocabulary
// rather than map dishonestly into the existing seven.
//
// T1's closed vocabulary, EXACTLY these nine values, no free text:
export type BrowserAuthorityAttemptOutcome =
  | 'not_attempted'     // the pipeline never asked
  | 'disabled'          // asked, authority is switched off
  | 'not_signed_in'     // asked, no valid session
  | 'timeout'           // asked, exceeded its window, nothing returned
  | 'no_result'         // asked, returned successfully, produced nothing usable
  | 'parse_failed'      // asked, returned text, the letter could not be extracted
  | 'answered'          // asked, returned, parsed into a candidate
  | 'throttled'         // asked, the source refused further queries (rate limit or verification challenge)
  | 'transport_error';  // asked, could not reach the source at all

// T2 dispatch-level vocabulary (the bridge/main-process leg, index.ts's
// runBrowserAuthorityQueryFromMainObserved): a strict SUBSET of the nine above, plus
// 'dispatched' -- a non-final, internal-only signal meaning "a real, non-empty extraction came
// back; hand it to parse level (the ensemble) to decide no_result/parse_failed/answered." T2
// deliberately narrows dispatch level to distinguish ONLY disabled/not_signed_in/timeout/
// no_result/throttled/transport_error (never parse_failed/answered/not_attempted -- those are
// not observable at the transport layer; not_attempted in particular can only be known by
// whoever decides NOT to call this leg at all, which is the ensemble's own per-authority gate,
// not this leg).
export type BrowserAuthorityDispatchOutcome =
  | 'disabled' | 'not_signed_in' | 'timeout' | 'no_result' | 'throttled' | 'transport_error' | 'dispatched';

/** The five browser authorities plus the swarm -- T3's "all five browser authorities plus the
 *  swarm, every time, including the ones that were never attempted." specialist_swarm is not a
 *  BrowserAuthorityName (it never touches a webview), but T3 requires it in the same per-
 *  question, closed-vocabulary record, so this widens the key type by exactly one literal. */
export type EnsembleAuthorityKey = BrowserAuthorityName | 'specialist_swarm';

export const ENSEMBLE_AUTHORITY_KEYS: readonly EnsembleAuthorityKey[] = [
  'user_google', 'user_perplexity', 'user_claude', 'user_chatgpt', 'user_gemini', 'specialist_swarm',
];

export interface BrowserAuthorityAttemptRecord {
  outcome: BrowserAuthorityAttemptOutcome;
  /** T3: "For parse_failed, include the first 200 characters of what was actually returned."
   *  Present ONLY when outcome === 'parse_failed' -- every other outcome omits this field rather
   *  than carrying a null/empty placeholder. */
  rawPreview?: string;
}

export type BrowserAuthorityAttemptOutcomes = Record<EnsembleAuthorityKey, BrowserAuthorityAttemptRecord>;

/** T3's "an absent key is exactly the ambiguity this ticket removes, so absence is not
 *  permitted" -- the single place all six keys get seeded to 'not_attempted' before anything is
 *  actually tried. Every question's record starts as this object; individual keys are then
 *  overwritten (never deleted) as the ensemble genuinely reaches each authority. */
export function createDefaultAuthorityAttemptOutcomes(): BrowserAuthorityAttemptOutcomes {
  const out = {} as BrowserAuthorityAttemptOutcomes;
  for (const key of ENSEMBLE_AUTHORITY_KEYS) out[key] = { outcome: 'not_attempted' };
  return out;
}

/** The single normalization choke point for T3's "no key omitted anywhere" gate: fills in
 *  'not_attempted' for any of the six keys missing from a partial (or entirely absent) record,
 *  never removes or overwrites a key that IS already present. Pure, no I/O -- safe to call from
 *  the receipt-shaping layer (one_click_mmlu_pro.ts) on every question, including the ones whose
 *  answer came from a deterministic bypass that never touched this record at all. */
export function normalizeAuthorityAttemptOutcomes(
  partial: Partial<BrowserAuthorityAttemptOutcomes> | null | undefined,
): BrowserAuthorityAttemptOutcomes {
  const base = createDefaultAuthorityAttemptOutcomes();
  if (!partial) return base;
  for (const key of ENSEMBLE_AUTHORITY_KEYS) {
    const rec = partial[key];
    if (rec && typeof rec.outcome === 'string') base[key] = rec;
  }
  return base;
}

/** T3's "first 200 characters of what was actually returned" -- one pure helper so every
 *  parse_failed call site truncates identically instead of re-deriving the same slice(0,200). */
export function truncateAuthorityPreview(text: string, maxChars = 200): string {
  return text.length > maxChars ? text.slice(0, maxChars) : text;
}

// ─── D-BP152-030R ("make askGoogle keep the thread instead of one-shot") ──────────────────────
//
// ATTRIBUTED: Founder, BP152, verbatim: "make askGoogle keep the thread instead of one-shot."
//
// What the shared nexus <webview> currently has live, tracked by the ONE main-process module
// (index.ts) that owns that webview. `position` is 1-based: how many queries have been SENT in
// this thread so far, including whichever one is currently in flight.
export interface NexusLiveThreadState {
  authority: BrowserAuthorityName;
  threadId: string;
  position: number;
}

export interface NexusThreadDecision {
  /** true = reuse the already-loaded page (skip navigation entirely) and type a follow-up into
   *  the existing composer. false = perform a full page navigation to the authority's landing
   *  URL first -- the only thing that can guarantee no DOM/JS state survives from a prior call. */
  continuing: boolean;
  /** State to store as `nexusLiveThread` AFTER this dispatch runs (regardless of whether the
   *  scrape itself succeeds -- the navigation/reuse decision already determined what the shared
   *  page now IS). null when nothing should be tracked (non-conversational authority, or no
   *  threadId supplied at all). */
  nextState: NexusLiveThreadState | null;
  threadStatus: 'new' | 'continued';
  /** null when no threadId was supplied (untracked, legacy-shaped call). */
  threadPosition: number | null;
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
export function decideNexusThreadContinuation(
  query: Pick<BrowserAuthorityQuery, 'authority' | 'threadId' | 'continueThread'>,
  current: NexusLiveThreadState | null,
): NexusThreadDecision {
  if (!isInteractiveBrowserAuthority(query.authority)) {
    return { continuing: false, nextState: null, threadStatus: 'new', threadPosition: null };
  }

  const wantsContinue = !!(query.continueThread && query.threadId);
  const matchesLiveThread =
    wantsContinue &&
    current !== null &&
    current.authority === query.authority &&
    current.threadId === query.threadId;

  if (matchesLiveThread) {
    const nextState: NexusLiveThreadState = {
      authority: query.authority,
      threadId: query.threadId as string,
      position: (current as NexusLiveThreadState).position + 1,
    };
    return { continuing: true, nextState, threadStatus: 'continued', threadPosition: nextState.position };
  }

  // No match -- either this genuinely is a new question, or the caller asked to continue
  // something that is NOT what the shared webview actually has live right now. Both are treated
  // identically: never trust a mismatch, always force a fresh navigation.
  if (query.threadId) {
    const nextState: NexusLiveThreadState = { authority: query.authority, threadId: query.threadId, position: 1 };
    return { continuing: false, nextState, threadStatus: 'new', threadPosition: 1 };
  }
  return { continuing: false, nextState: null, threadStatus: 'new', threadPosition: null };
}

// ─── D-BP152-031 ("I want it threaded") ────────────────────────────────────────────────────────
//
// ATTRIBUTED: Founder, BP152, verbatim: "I want it threaded" -- in answer to Bishop's own
// disclosure that decideNexusThreadContinuation above (D-BP152-030R) is built but "no caller
// passes threadId yet."
//
// THE PROBLEM THIS SOLVES: decideNexusThreadContinuation is a pure decision point -- it answers
// "given a threadId and a continueThread flag, do I continue?" but does not itself say WHERE a
// threadId comes from or WHEN continueThread should be true. Leaving that to each call site is
// exactly the per-call-site discipline this ticket's own dispatch says not to rely on ("Do NOT
// edit each call site to pass an id by hand... it makes the cross-question guarantee
// structural"). This section is the one place that derives both, scoped to ONE RUN.
//
// A "run" here is one invocation of the object this factory returns -- concretely, ONE call to
// createNexusRunThreadContext() per Liana Cycle question (see index.ts's 'liana-terminal-run'
// handler, which creates exactly one per IPC call, before building the askGoogle closure it
// injects into runLianaCycleQuestion). Every query issued through the SAME returned object, for
// the SAME conversational authority, shares one threadId and continueThread flips
// false-on-first-call -> true-thereafter. A DIFFERENT createNexusRunThreadContext() call (a new
// run) mints its own id space -- see `seed` below -- so nothing from a prior run's thread state
// can ever be reached through a fresh context, structurally, not by caller discipline.
//
// GOOGLE/PERPLEXITY: short-circuited here too, via the SAME isInteractiveBrowserAuthority() this
// file already uses as its single source of truth (not a second, divergent test) -- belt and
// suspenders with decideNexusThreadContinuation's own identical check, not a second source of
// truth: this factory's correctness does not depend on a caller also getting the downstream gate
// right. A non-conversational authority always gets `{ threadId: undefined, continueThread:
// false }`, which is what pre-D-BP152-030R code already implicitly passed (the two fields did
// not exist yet) -- so a Google/Perplexity query built through this factory is shaped identically
// to one built without it.
export interface NexusRunThreadQueryFields {
  threadId: string | undefined;
  continueThread: boolean;
}

export interface NexusRunThreadContext {
  /** Call once per outgoing query, with the authority that query is about to be sent to. Returns
   *  the `threadId`/`continueThread` pair to spread directly onto that query's
   *  BrowserAuthorityQuery object. Stateful (tracks one threadId per authority, scoped to this
   *  context instance/run) -- this is the ONLY stateful piece of this ticket's build; everything
   *  else (decideNexusThreadContinuation, isInteractiveBrowserAuthority) stays pure, unchanged. */
  forQuery(authority: BrowserAuthorityName): NexusRunThreadQueryFields;
}

/** Mints one run's thread-identity space. `seed` defaults to a fresh, effectively-unique string
 *  (timestamp + random suffix) generated at CALL time -- i.e. once per run, not once per query --
 *  so two runs created even in the same millisecond still get different seeds (Math.random's
 *  contribution). Accepting an explicit `seed` is for tests ONLY (deterministic thread ids to
 *  assert against); no production call site passes one. No I/O, no Electron import -- consistent
 *  with this file's own header contract. */
export function createNexusRunThreadContext(seed?: string): NexusRunThreadContext {
  const runSeed = seed ?? `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const threadIdsByAuthority = new Map<BrowserAuthorityName, string>();
  return {
    forQuery(authority: BrowserAuthorityName): NexusRunThreadQueryFields {
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
