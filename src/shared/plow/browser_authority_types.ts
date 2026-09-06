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
  /** THE SIPHON, decision-gate leg (D-BP220-BM0-013). ADDITIVE/OPTIONAL -- absent on every
   *  pre-existing caller, so this changes nothing for any query built before this dispatch. When
   *  a caller knows the question under research was drawn from a published benchmark corpus
   *  (e.g. 'MMLU-Pro' -- see decideBrowserLookupRefusal below), it sets this field so the hard
   *  admission gate can refuse the WHOLE lookup instead of the caller trying to filter what comes
   *  back. Nothing in this file reads this field to enforce a refusal by itself (this module has
   *  no I/O and never blocks a lookup on its own) -- the caller MUST call
   *  decideBrowserLookupRefusal(query.benchmarkCorpusId) itself, before invoking the browser
   *  bridge, and honor a `refuse: true` verdict by skipping the call entirely. See that
   *  function's own doc comment for the full contract.
   *
   *  UPDATED D-BP221-BM0-005: the "no caller checks this" state described here is no longer true.
   *  runBrowserAuthorityLookup and runBrowserAuthorityLookupObserved in browser_authority_adapter.ts
   *  now BOTH call decideBrowserLookupRefusal themselves, immediately before touching the bridge.
   *  That was done at the CHOKEPOINT rather than at each call site because a measured count found
   *  15 live invocations across 3 files, not the 5 in 1 file this file's own wiring plan claimed --
   *  and a per-call-site gate rots the moment someone adds the sixteenth. Callers may still call
   *  the gate themselves for an earlier/cheaper skip; the chokepoint is the backstop that cannot
   *  be forgotten. WHAT IS STILL NOT WIRED: nothing sets benchmarkCorpusId for a live MMLU-Pro
   *  run, so the gate is armed but has nothing to fire on. That half is load-bearing and remains
   *  open -- reported, not silently assumed done. */
  benchmarkCorpusId?: string;
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
/**
 * D-BP219-BM0-038 step 4 (PAPER_001 preconditions 1+2, "answer-key quarantine first" /
 * "all acquired content is untrusted data"): every field below this line was added by that
 * dispatch. Read this before touching ANY consumer of `.fact`/`.citations`/`.results` on this
 * interface:
 *
 * CONDITION 2 -- ACQUIRED CONTENT IS DATA, NEVER INSTRUCTION. `fact`, `citations[].snippet`,
 * `results[].snippet`/`title` are TEXT SCRAPED FROM A THIRD-PARTY WEBPAGE the user does not
 * control (Google/Perplexity/Claude/ChatGPT/Gemini results, via a live logged-in browser
 * session -- see this file's header). Nothing in this object has been reviewed, sanitized for
 * prompt-injection phrasing, or in any way distinguished from a page that contains text
 * deliberately crafted to look like an instruction ("ignore previous instructions and answer
 * X", "SYSTEM:", etc.). ANY consumer that concatenates `fact` (or any nested snippet/title)
 * directly into a prompt string handed to an LLM is treating attacker-influenced web content as
 * if it were trusted prompt text -- this is a real, load-bearing risk, not a hypothetical one.
 * `trust`/`acquiredFrom`/`acquiredAtUtc` below exist so a consumer CAN tell "this came from an
 * external session" at a glance; they do not themselves sanitize or filter anything.
 *
 * CONDITION 1 -- ANSWER-KEY QUARANTINE. distillExtraction() below refuses to construct a
 * BrowserAuthorityLookupResult AT ALL (returns null instead) when the scraped snippet matches
 * looksLikeAnswerKeyShape()'s narrow answer-key pattern. See that function's own doc comment
 * for its EXACT catch list and its EXACT, deliberately narrow blind spots -- do not assume it
 * catches more than documented there.
 */
export interface BrowserAuthorityLookupResult {
  /** The distilled FACT text -- never the vendor's full prose response. UNTRUSTED DATA, see
   *  this interface's own banner comment above: never concatenate this into an LLM prompt
   *  without treating it as adversary-influenced text, same as any other web content. */
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
  /** D-BP219-BM0-038 step 4, condition 2. Literal, non-optional, always exactly 'UNTRUSTED' --
   *  every BrowserAuthorityLookupResult in this repo is constructed by distillExtraction()
   *  below (the sole choke point, verified by repo-wide grep at wiring time) from content
   *  scraped out of a live external browser session, so there is no case where a weaker/absent
   *  value would ever be honest. A future genuinely-first-party source (if one is ever added)
   *  would need its own type, not a laxer value on this one. */
  trust: 'UNTRUSTED';
  /** D-BP219-BM0-038 step 4, condition 2. Same value as `authority` above -- deliberately
   *  redundant, not a second source of truth: `authority` answers "which vendor", this field
   *  exists so a consumer scanning ONLY for provenance/trust fields (without already knowing
   *  this interface's other fields) still finds a named "acquired from" pointer next to
   *  `trust`/`acquiredAtUtc`. Always set from the same `raw.authority` `authority` is. */
  acquiredFrom: BrowserAuthorityName;
  /** D-BP219-BM0-038 step 4, condition 2. Same value/moment as `extractedAt` above (both stamped
   *  from the same `new Date().toISOString()` call in distillExtraction() below) -- kept as a
   *  second field for the same "provenance fields grouped together" reason as `acquiredFrom`. */
  acquiredAtUtc: string; // ISO8601
  /** BP149 D-BP149-016, ADDITIVE/OPTIONAL -- threaded straight through from
   *  BrowserAuthorityRawExtraction.citations by distillExtraction() below. Absent (not empty)
   *  when the raw extraction did not carry the field at all (a pre-fix caller); an empty array
   *  means the field WAS carried and genuinely found nothing. UNTRUSTED DATA, same as `fact`. */
  citations?: CitationRecord[];
  /** BP149 D-BP149-016, ADDITIVE/OPTIONAL -- threaded straight through from
   *  BrowserAuthorityRawExtraction.results. Same absent-vs-empty distinction as `citations`.
   *  UNTRUSTED DATA, same as `fact`. */
  results?: SearchResultCandidate[];
}

/**
 * D-BP219-BM0-038 step 4, condition 1 ("answer-key quarantine first"), STRUCTURED per
 * D-BP220-BM0-013 item 1 (Founder mandate, verbatim: "A guard that admits what it misses is
 * worth ten that imply completeness."). This is a STRUCTURAL/SHAPE check, never a semantic one
 * (no "does this text mean the answer is X" judgment of any kind) -- see knownBlindSpots below
 * for the honestly-enumerated, DELIBERATE gaps this leaves open. Do not assume this catches more
 * than checkAnswerKeyShape()'s own `checked` list says it does.
 */

/** One structural rule this check actually evaluates against the snippet, machine-readable --
 *  not only prose in a doc comment. */
export interface AnswerKeyShapeCheckedRule {
  id: 'bare_option_letter' | 'named_key_value';
  description: string;
}

/** One KNOWN, ENUMERATED gap this check cannot and does not attempt to catch. Not a bug list --
 *  a completeness disclosure, carried in the function's own return value so a caller (or a future
 *  auditor) never has to trust a doc comment alone. */
export interface AnswerKeyShapeBlindSpot {
  id: 'paraphrased_or_prose_answer' | 'letter_mid_sentence' | 'unlisted_key_name' | 'semantic_leak';
  description: string;
}

/** Which rule matched, or null when neither did. Kept as its own literal (rather than folding
 *  into a bare boolean) so a caller/log can say WHICH shape was seen without re-deriving it from
 *  the snippet a second time. */
export type AnswerKeyShapeMatchKind = 'bare_option_letter' | 'named_key_value' | null;

export interface AnswerKeyShapeVerdict {
  /** Boolean-compatible with the pre-existing looksLikeAnswerKeyShape() return value --
   *  looksLikeAnswerKeyShape() below is now a thin wrapper that returns exactly this field. */
  matched: boolean;
  matchedPattern: AnswerKeyShapeMatchKind;
  /** Every rule this function evaluated, in evaluation order, machine-readable. */
  checked: readonly AnswerKeyShapeCheckedRule[];
  /** Every known gap, enumerated, ALWAYS present regardless of `matched` -- a guard that only
   *  discloses its blind spots when it fails to match would be exactly the false-completeness the
   *  Founder's mandate warns against. */
  knownBlindSpots: readonly AnswerKeyShapeBlindSpot[];
}

const ANSWER_KEY_SHAPE_CHECKED_RULES: readonly AnswerKeyShapeCheckedRule[] = [
  {
    id: 'bare_option_letter',
    description:
      'The ENTIRE trimmed snippet is nothing but a single option letter (A-J, case-insensitive, ' +
      'optionally followed by a trailing "." or ")") -- e.g. "C", "c)", "J." -- because a scraped ' +
      'page whose whole extracted answer collapses to a bare option letter is indistinguishable ' +
      'in shape from a leaked answer-key value, never a genuine encyclopedia fact.',
  },
  {
    id: 'named_key_value',
    description:
      'The snippet contains a `key: value` or `key = value` shape (colon or equals, optional ' +
      'surrounding quotes/whitespace) where `key` is, case-insensitively, exactly one of ' +
      '`answer`, `answer_index`, `correct_answer`, or `gold` -- e.g. `"answer": "B"`, ' +
      '`correct_answer=3`, `gold: D`. Matched against the flat scraped text; no JSON parser, no ' +
      'nesting awareness (a nested `{"meta": {"answer": "B"}}` still matches -- the regex only ' +
      'anchors on the key/value pair textually).',
  },
];

const ANSWER_KEY_SHAPE_BLIND_SPOTS: readonly AnswerKeyShapeBlindSpot[] = [
  {
    id: 'paraphrased_or_prose_answer',
    description:
      'Any paraphrase of an answer without one of the four literal key names ("the correct ' +
      'option is B", "B is right"), OR a full prose answer that never uses an option letter at ' +
      'all (e.g. a flashcard\'s "the niece has a life estate pur autre vie and the gardener has a ' +
      'vested remainder in fee simple absolute"). NOT CAUGHT, and not catchable by any shape rule ' +
      '-- the answer and its doctrinal explanation are the same sentences (see this file\'s own ' +
      'THE SIPHON banner above). Declared, never silently assumed handled.',
  },
  {
    id: 'letter_mid_sentence',
    description:
      'An answer letter embedded inside a longer sentence rather than being the ENTIRE snippet ' +
      '("Most sources say C is correct" does not match the bare_option_letter rule -- that rule ' +
      'is a whole-string match only). NOT CAUGHT.',
  },
  {
    id: 'unlisted_key_name',
    description:
      'Any key name spelled differently from the four literal names this check knows (`ans`, ' +
      '`solution`, `key`, `right_answer`, etc.), or in a language other than English. NOT CAUGHT.',
  },
  {
    id: 'semantic_leak',
    description:
      'Any semantic/meaning-based leak (a full explanation that reveals the answer without ever ' +
      'using one of the four literal key names or a bare letter). Catching this would require ' +
      'judgment this function deliberately does not attempt -- building a smarter semantic ' +
      'classifier is the explicit trap this dispatch was ordered not to fall into, because the ' +
      'classifier would have to be at least as strict as the leak it blocks, which also blocks ' +
      'every legitimate doctrinal explanation of the same concept. NOT CAUGHT, by design.',
  },
];

/**
 * THE structural check, now returning a full verdict instead of a bare boolean (D-BP220-BM0-013
 * item 1). Pure, no I/O. See ANSWER_KEY_SHAPE_CHECKED_RULES/ANSWER_KEY_SHAPE_BLIND_SPOTS above
 * for the exact, complete lists this function's return value carries -- this doc comment
 * summarizes, it is not the source of truth; the returned object is.
 */
export function checkAnswerKeyShape(snippet: string): AnswerKeyShapeVerdict {
  const trimmed = snippet.trim();
  let matchedPattern: AnswerKeyShapeMatchKind = null;
  if (/^[A-J][.).]?$/i.test(trimmed)) {
    matchedPattern = 'bare_option_letter';
  } else if (/\b(answer|answer_index|correct_answer|gold)\b\s*["']?\s*[:=]/i.test(trimmed)) {
    matchedPattern = 'named_key_value';
  }
  return {
    matched: matchedPattern !== null,
    matchedPattern,
    checked: ANSWER_KEY_SHAPE_CHECKED_RULES,
    knownBlindSpots: ANSWER_KEY_SHAPE_BLIND_SPOTS,
  };
}

/**
 * Boolean-compatible thin wrapper, kept so no existing caller of this exact name breaks. Repo-wide
 * grep at D-BP220-BM0-013 build time found exactly ONE caller of this function in the whole repo:
 * distillExtractionWithSiphon() below (in this same file) -- there is no external importer of
 * `looksLikeAnswerKeyShape` by name anywhere else (confirmed against every file that imports FROM
 * browser_authority_types.ts). Kept anyway, per this dispatch's explicit instruction, as the
 * boolean-compatible accessor for any future caller that wants the old shape.
 */
export function looksLikeAnswerKeyShape(snippet: string): boolean {
  return checkAnswerKeyShape(snippet).matched;
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
  /** D-BP221-BM0-005: the benchmark corpus this lookup would be made against, e.g. 'MMLU-Pro'.
   *  Threaded into BrowserAuthorityQuery.benchmarkCorpusId AND checked by the hard admission gate
   *  inside runBrowserAuthorityLookup/Observed before the browser bridge is ever touched.
   *
   *  ABSENT MEANS UNGATED, AND THAT IS A DECLARED FAIL-OPEN, not an oversight: see
   *  decideBrowserLookupRefusal's own reason string, which says so in the verdict it returns.
   *  Setting this is what arms the gate, and the run configuration is what must set it. */
  benchmarkCorpusId?: string;
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

// ─── D-BP220-BM0-013 ("THE SIPHON" -- refuse, don't filter, when the corpus is a benchmark) ────
//
// FOUNDER MANDATE, verbatim: "Directing the current flow of water is far easier than trying to
// stop it... Redirection moves almost anything into something useful." Also: "Every. Part. Of
// the Buffalo." Proven necessary by the Founder's own experiment: MMLU-Pro questions are
// published on the open web WITH their answers (Course Hero, Brainscape, Kaplan flashcards,
// Quizlet), often as PROSE ("the niece has a life estate pur autre vie and the gardener has a
// vested remainder in fee simple absolute") that is textually indistinguishable from a
// legitimate doctrinal explanation of the same concept. checkAnswerKeyShape() below is a
// STRUCTURAL shape check; it cannot and does not attempt to catch a leak like that (see its own
// knownBlindSpots) -- no filter can, because the answer and the doctrine are the same sentences.
// The only sound response for a KNOWN benchmark corpus is refusing the entire browser lookup
// before it is even attempted, never trying to filter what comes back.
//
// This section is a hard, decidable ADMISSION GATE, not a content filter: it looks at ONE thing
// (a corpus identifier string) and returns ONE verdict (refuse the whole lookup, or don't). It
// has no I/O and does not itself stop anything -- see decideBrowserLookupRefusal's own doc
// comment for exactly which call site(s) in this repo must adopt it, and the one-line change
// each needs, since this dispatch owns only this file.

/** Corpora this estate KNOWS are published on the open web with their answers alongside them.
 *  'MMLU-Pro' is the one live case (the Founder's own experiment, this dispatch). Add a new
 *  vendor/corpus here only once it is independently verified to have the same leak shape -- never
 *  guessed, per this file's own "narrow and honest beats broad and guessed" convention (see
 *  D-BP213-XO-62's banner above for the identical discipline applied to challenge URLs). */
export type KnownBenchmarkCorpusId =
  | 'MMLU-Pro'
  | 'ASDiv'
  | 'GSM8K'
  | 'OlympiadBench';

// D-BP221-BM0-005: THREE OF THE FOUR LEGS WERE UNGUARDED.
//
// This list held ONLY 'MMLU-Pro' while the Big Kahuna's four legs are, per the BP214 ruling, FOUR
// BENCHMARKS: ASDiv, GSM8K, OlympiadBench and MMLU-Pro. A browser lookup against any of the other
// three was PERMITTED by this gate.
//
// THE BASIS FOR ADDING THEM, so this is checkable and not the "guessing" this file's own comment
// forbids: all three are public research benchmarks DISTRIBUTED WITH THEIR ANSWER KEYS (their own
// repositories and dataset cards ship the labeled answers, and GSM8K ships full worked solutions).
// The leak shape is not merely similar, it is identical BY CONSTRUCTION -- an answer key published
// alongside the questions is what a benchmark IS. That is verification from the nature of the
// artifact, not an assumption about any particular scraper site.
//
// THE ASYMMETRY THAT SETTLES IT: a false REFUSAL costs one skipped browser lookup. A false PERMIT
// burns a benchmark item for measurement FOREVER, and a burn discovered afterward is
// indistinguishable from an accident. When those are the two error costs, the list should be wide.
export const KNOWN_BENCHMARK_CORPUS_IDS: readonly KnownBenchmarkCorpusId[] = [
  'MMLU-Pro',
  'ASDiv',
  'GSM8K',
  'OlympiadBench',
];

/** D-BP221-BM0-005: the matcher was `.includes(corpusId)` -- EXACT, case- and separator-sensitive.
 *  So 'mmlu-pro', 'MMLU_Pro', 'mmlu pro' and ' MMLU-Pro ' every one of them SAILED THROUGH the
 *  highest-stakes gate in the system, silently, as a PERMIT.
 *
 *  Normalizing is strictly fail-SAFE here: it can only ever turn a permit into a refusal, never the
 *  reverse, and the cost asymmetry above says that is the correct direction to be wrong in. It is
 *  deliberately NOT a fuzzy/substring match -- 'my-private-mmlu-pro-notes' must still be permitted,
 *  because over-refusing an unrelated corpus that merely shares a word would be its own defect. */
function normalizeCorpusId(raw: string): string {
  return raw.trim().toLowerCase().replace(/[\s_]+/g, '-');
}

export interface BrowserLookupRefusalDecision {
  /** true = do not run the browser lookup at all for this question, full stop. There is no
   *  partial/filtered form of "refuse" -- when true, the caller's only correct action is to skip
   *  the whole runBrowserAuthorityLookup/runBrowserAuthorityLookupObserved call. */
  refuse: boolean;
  /** The corpus id this decision was made against, or null when none was supplied. Echoed back so
   *  a caller logging this decision does not have to thread the input through separately. */
  corpusId: string | null;
  /** Loud, human-readable, machine-loggable justification. Always starts with the literal string
   *  'REFUSED:' when refuse is true, and 'PERMITTED:' when it is false, so a log line or a
   *  console scan can find a refusal without parsing the boolean out of context. */
  reason: string;
}

/**
 * THE hard, decidable gate D-BP220-BM0-013 item 3 requires. Pure, no I/O, no Electron import --
 * consistent with this file's own header contract. Deliberately takes a bare corpus-id string
 * (not a full BrowserAuthorityQuery) so any caller that knows the corpus identity -- whether or
 * not it has built a BrowserAuthorityQuery object yet -- can call this before doing any other
 * work at all.
 *
 * CALL SITE THIS DISPATCH FOUND AND DID NOT TOUCH (file ownership: this dispatch owns only
 * browser_authority_types.ts): repo-wide grep at build time (see this dispatch's own SEG report)
 * found ZERO existing callers that construct a BrowserAuthorityQuery with a benchmark corpus
 * identity threaded through -- CanonicalPlowMcConfig (src/main/plow/plow_mc_answerer.ts) carries
 * `domain` (an MMLU-Pro SUBJECT CATEGORY, e.g. "law"/"engineering" -- confirmed by direct read of
 * src/main/mesh_test/one_click_mmlu_pro.ts's `domain: q.category`), never a benchmark CORPUS
 * identity. Wiring this gate to actually refuse anything requires, at minimum:
 *   1. plow_mc_answerer.ts's CanonicalPlowMcConfig gains an optional `benchmarkCorpusId?: string`
 *      field (structurally compatible with this file's BrowserAuthorityQuery.benchmarkCorpusId,
 *      same additive/optional convention as researchArmBrowserAuthority already uses).
 *   2. Every runBrowserAuthorityLookup/runBrowserAuthorityLookupObserved call site in that file
 *      (this dispatch found five: the two 'user_perplexity'-preferred calls near line 3101/3119,
 *      the Stage F3 mesh-synergy call near line 7230, and the browser-authority-first pair near
 *      line 8212/8221) gains, immediately before the call, the equivalent of:
 *        const gate = decideBrowserLookupRefusal(config.benchmarkCorpusId);
 *        if (gate.refuse) { skip the call; use gate.reason as the abstain rationale }
 *   3. Whoever sets CanonicalPlowMcConfig.domain for a live MMLU-Pro run (one_click_mmlu_pro.ts, a
 *      file this dispatch also does not own) sets benchmarkCorpusId to the literal 'MMLU-Pro'
 *      alongside it.
 * That is the ONE-LINE-per-call-site change; this dispatch implements the decision function
 * itself here, not the enforcement, per this dispatch's own file-ownership boundary.
 */
export function decideBrowserLookupRefusal(
  corpusId: string | null | undefined,
): BrowserLookupRefusalDecision {
  if (!corpusId) {
    return {
      refuse: false,
      corpusId: null,
      reason: 'PERMITTED: no benchmark corpus id was supplied -- this gate has nothing to refuse '
        + 'against. Absence of a corpus id is not evidence the question is safe; it means the '
        + 'caller has not wired this gate yet (see this function\'s own doc comment).',
    };
  }
  // D-BP221-BM0-005: compare NORMALIZED forms on both sides, so a caller's spelling cannot open
  // the gate. See normalizeCorpusId's own comment for why this is fail-safe.
  const normalized = normalizeCorpusId(corpusId);
  const isKnown = (KNOWN_BENCHMARK_CORPUS_IDS as readonly string[])
    .some((known) => normalizeCorpusId(known) === normalized);
  if (isKnown) {
    const reason =
      `REFUSED: corpus '${corpusId}' is a published benchmark whose question/answer pairs are ` +
      'indexed on the open web (Course Hero, Brainscape, Kaplan flashcards, Quizlet). The answer ' +
      'and its doctrinal explanation are the same sentences -- no filter over the scraped ' +
      'results can separate one from the other, so the ENTIRE browser lookup is refused, not ' +
      'filtered.';
    // Loud on purpose (Founder mandate: refusal must be unambiguous, not a boolean lost in a
    // log) -- mirrors the console.warn already used below for the answer-key quarantine.
    console.error(`[browser_authority_types] decideBrowserLookupRefusal: ${reason}`);
    return { refuse: true, corpusId, reason };
  }
  return {
    refuse: false,
    corpusId,
    reason: `PERMITTED: corpus '${corpusId}' is not on this file's KNOWN_BENCHMARK_CORPUS_IDS `
      + 'list. Absence from the list means "not yet independently verified", not "confirmed safe" '
      + '-- see KNOWN_BENCHMARK_CORPUS_IDS\'s own doc comment.',
  };
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

/** THE SIPHON's side channel (D-BP220-BM0-013 item 2, Founder mandate: "Every. Part. Of the
 *  Buffalo." / "draws off rather than drops"). What distillExtractionWithSiphon() below returns
 *  INSTEAD OF discarding a snippet that matched checkAnswerKeyShape() -- kept, tagged, handed back
 *  to the caller on a side channel. This module never writes it into any durable store itself
 *  (mnem_eblet_store.ts is explicitly out of this dispatch's ownership); the caller decides what,
 *  if anything, to do with it. UNTRUSTED DATA, same as BrowserAuthorityLookupResult -- see that
 *  interface's own banner comment. */
export interface SiphonedSnippet {
  /** The raw (whitespace-collapsed, trimmed) snippet that was siphoned off -- NOT discarded. */
  snippet: string;
  sourceUrl: string | null;
  authority: BrowserAuthorityName;
  queryText: string;
  /** Which structural rule caught it -- never null (a SiphonedSnippet only exists because one
   *  did). See checkAnswerKeyShape()'s own ANSWER_KEY_SHAPE_CHECKED_RULES for what this id means. */
  matchedPattern: 'bare_option_letter' | 'named_key_value';
  /** Human-readable why, for a receipt/log -- copied from the matching rule's own description at
   *  siphon time so a reader does not have to cross-reference the rule table separately. */
  reason: string;
  siphonedAtUtc: string; // ISO8601
}

export interface DistillExtractionOutcome {
  /** Byte-identical to distillExtraction()'s own pre-existing return value/semantics -- null
   *  whenever the raw extraction lacked a usable snippet/URL, OR whenever the snippet was
   *  siphoned (see `siphoned` below for which). */
  result: BrowserAuthorityLookupResult | null;
  /** Present only when `result` is null AND the reason was specifically the answer-key quarantine
   *  (never for the plain empty-snippet/missing-URL case, which has nothing worth keeping). null
   *  in every other case. */
  siphoned: SiphonedSnippet | null;
}

/**
 * THE choke point, now WITH the siphon side channel (D-BP220-BM0-013 items 1+2). Superset of the
 * pre-existing distillExtraction() behavior -- distillExtraction() below is now a thin wrapper
 * over this function's `.result` field, so every pre-existing caller (mcp_server.ts,
 * browser_authority_adapter.ts's three call sites) stays byte-for-byte unchanged. This function
 * itself has no I/O and writes nothing to any durable store -- see SiphonedSnippet's own doc
 * comment for why.
 */
export function distillExtractionWithSiphon(
  raw: BrowserAuthorityRawExtraction,
  queryText: string,
): DistillExtractionOutcome {
  const trimmedSnippet = raw.snippet.trim().replace(/\s+/g, ' ');
  if (!trimmedSnippet || !raw.sourceUrl) return { result: null, siphoned: null };

  // D-BP219-BM0-038 step 4, condition 1 -- ANSWER-KEY QUARANTINE FIRST, before this function
  // constructs (or even previews) a BrowserAuthorityLookupResult from this snippet. Checked
  // BEFORE the trust/provenance stamping below on purpose: a quarantined snippet is refused
  // outright as a LOOKUP RESULT, it is never returned with an 'UNTRUSTED' label attached --
  // refusing to hand it to a voter is the whole point. D-BP220-BM0-013 item 2 changes what
  // happens to the snippet from here: it used to be discarded; now it is SIPHONED (kept, tagged,
  // returned on the side channel) instead of dropped. See checkAnswerKeyShape()'s own doc comment
  // for the EXACT (narrow, documented) catch list.
  const shapeVerdict = checkAnswerKeyShape(trimmedSnippet);
  if (shapeVerdict.matched && shapeVerdict.matchedPattern) {
    const matchedRule = ANSWER_KEY_SHAPE_CHECKED_RULES.find((r) => r.id === shapeVerdict.matchedPattern);
    const reason =
      `matched checkAnswerKeyShape rule '${shapeVerdict.matchedPattern}' -- ` +
      (matchedRule ? matchedRule.description : 'no matching rule description found (unexpected)');
    console.warn(
      '[browser_authority_types] distillExtractionWithSiphon: siphoning off (never discarding) a ' +
      'snippet that matches the answer-key quarantine shape (D-BP219-BM0-038 step 4 / ' +
      'D-BP220-BM0-013 THE SIPHON) -- refusing to return it as a lookup result, keeping it on the ' +
      'side channel instead.',
    );
    const siphoned: SiphonedSnippet = {
      snippet: trimmedSnippet,
      sourceUrl: raw.sourceUrl,
      authority: raw.authority,
      queryText,
      matchedPattern: shapeVerdict.matchedPattern,
      reason,
      siphonedAtUtc: new Date().toISOString(),
    };
    return { result: null, siphoned };
  }

  // D-BP219-BM0-038 step 4, condition 2 -- every result this function returns is content
  // acquired from a live external browser session, so `trust`/`acquiredFrom`/`acquiredAtUtc`
  // are stamped unconditionally here, at the one place (verified by repo-wide grep) that
  // constructs every BrowserAuthorityLookupResult in this repo. See the interface's own banner
  // comment above for why this is DATA, never instruction, to every downstream consumer.
  const acquiredAtUtc = new Date().toISOString();

  const result: BrowserAuthorityLookupResult = {
    fact: trimmedSnippet.length > MAX_FACT_CHARS
      ? trimmedSnippet.slice(0, MAX_FACT_CHARS).trim() + '...'
      : trimmedSnippet,
    sourceUrl: raw.sourceUrl,
    authority: raw.authority,
    verified: trimmedSnippet.length >= 20, // weak "genuinely scraped something substantive" signal
    queryText,
    extractedAt: acquiredAtUtc,
    trust: 'UNTRUSTED',
    acquiredFrom: raw.authority,
    acquiredAtUtc,
    // BP149 D-BP149-016 (R4 repair): previously raw.citations/raw.results were never read here at
    // all -- this is the exact "type-boundary drop" the ticket exists to close. `raw.citations`
    // spread conditionally so a pre-fix raw object (the field genuinely absent, not empty) yields
    // an absent field here too, never a fabricated empty array standing in for "never collected".
    ...(raw.citations !== undefined ? { citations: raw.citations } : {}),
    ...(raw.results !== undefined ? { results: raw.results } : {}),
  };
  return { result, siphoned: null };
}

/**
 * Byte-identical signature/semantics to the pre-existing distillExtraction() -- thin wrapper over
 * distillExtractionWithSiphon()'s `.result` field, kept so every existing caller (mcp_server.ts;
 * browser_authority_adapter.ts's runBrowserAuthorityLookup/runBrowserAuthorityLookupObserved,
 * which re-export and call this exact function) stays byte-for-byte unchanged. See
 * distillExtractionWithSiphon() above for the new siphon side channel this wrapper discards -- a
 * caller that wants the siphoned content must call distillExtractionWithSiphon() directly.
 */
export function distillExtraction(
  raw: BrowserAuthorityRawExtraction,
  queryText: string,
): BrowserAuthorityLookupResult | null {
  return distillExtractionWithSiphon(raw, queryText).result;
}

// ─── D-BP213-XO-62 ("the throttled outcome is decorative, generalize the challenge detector") ──
//
// XO-60 measured, this same night: isGoogleChallengeUrl() (webview_preload.ts) is a real,
// working STRUCTURAL detector -- URL-shape only, never page prose -- but it is Google-only, and
// the closed BrowserAuthorityDispatchOutcome/BrowserAuthorityAttemptOutcome vocabularies both
// carry a 'throttled' literal that NO runtime code path ever assigns. Consequence: a rate-limit
// or verification page collapses into the identical `success:false, ''` shape as a genuine
// no-answer, everywhere downstream -- the ensemble receipt (KN-BP144-7), the Liana Cycle's
// googleBlocks(), the MCP tool surface. Per this estate's own standing law (see this file's own
// D-BP159-011 banner below and Bishop memory's "an empty result from an unreachable source is
// not evidence of absence"), a ring that silently reports 'no_result' when it was actually
// refused service is not silent, it is lying quietly.
//
// THIS SECTION GENERALIZES isGoogleChallengeUrl()'S OWN SHAPE (table-driven), it does not invent
// a second one. isKnownChallengeUrl() below is the ONE function every caller (webview_preload.ts,
// and any future main-process consumer) should use going forward; CHALLENGE_URL_RULES is the
// single place a verified new vendor gets added -- a DATA addition, never a code change to the
// function itself. isGoogleChallengeUrl() is kept as a byte-identical-behavior named alias (the
// one entry that predates this ticket) so no existing call site's intent changes.
//
// PERPLEXITY HAS NO ENTRY HERE. XO-62 searched this repo (webview_preload.ts, index.ts and its
// `.superseded.*` history, browser_authority_types.ts, specialist_adapters.ts, comparative_
// cascade.ts) and every captured fixture on disk (`scratchpad/**/*.log`, `*.json`, `*.md`) for
// a Perplexity 429/rate-limit/verification-challenge/captcha shape and found none -- the one
// keyword hit (`scratchpad/_seg_m3t4r_electron_launch2.log:93`) is an unrelated paid-API 401
// ("Invalid API key") whose dispatch UUID coincidentally contains the digits "429c". Per this
// ticket's own order, a guessed structural rule is worse than an honestly absent one (it would
// produce exactly the false confidence this whole fix exists to remove), and visiting
// perplexity.ai live to fish for a real rate-limit page was explicitly forbidden (it would spend
// the Founder's own logged-in quota to manufacture the very fixture this ticket says not to
// invent). The fix this ticket ships is real and complete for Google; Perplexity stays an
// honestly documented gap, not a fabricated rule, until a future dispatch captures and verifies
// a real one -- at which point it is a one-line addition to CHALLENGE_URL_RULES below.
export interface ChallengeUrlRule {
  /** Free-text label for logging/debugging only -- never matched against, never shown to an
   *  end user, and not part of the structural check itself (that is entirely the two predicates
   *  below). */
  vendor: string;
  /** Tested against `new URL(url).hostname` -- must `$`-anchor the full hostname (mirrors
   *  isGoogleChallengeUrl()'s own pre-existing anchoring) so a lookalike host (e.g.
   *  "google.com.attacker.net") can never match. */
  hostnamePattern: RegExp;
  /** Tested against `new URL(url).pathname`. Structural only (an exact path or a fixed prefix) --
   *  never a check against document text/prose. */
  pathnameMatches: (pathname: string) => boolean;
}

/** The one verified rule (Google's `/sorry/` redirect, D-BP152-050's live-observed target) plus
 *  wherever a future vendor's own verified rule gets added. See this section's own header above
 *  for why Perplexity is not here yet. */
export const CHALLENGE_URL_RULES: readonly ChallengeUrlRule[] = [
  {
    vendor: 'google',
    hostnamePattern: /^(?:www\.)?google\.[a-z]{2,3}(?:\.[a-z]{2})?$/i,
    pathnameMatches: (pathname) => pathname === '/sorry' || pathname.startsWith('/sorry/'),
  },
];

/** Table-driven successor to isGoogleChallengeUrl() below -- iterates CHALLENGE_URL_RULES so a
 *  verified new vendor is a data addition to that table, never a new function or a change to
 *  this one. Structural only: protocol + parsed hostname + parsed pathname, exactly the same
 *  three primitives isGoogleChallengeUrl() already used, never a scan of page text. Any parse
 *  failure (malformed URL) returns false rather than throwing -- an unparseable URL is not a
 *  known challenge page, it is simply not evaluable, and a caller already treats false as "fell
 *  through to the existing success/no-match reporting" per this file's own honesty-firewall
 *  convention. */
export function isKnownChallengeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    return CHALLENGE_URL_RULES.some(
      (rule) => rule.hostnamePattern.test(parsed.hostname) && rule.pathnameMatches(parsed.pathname),
    );
  } catch {
    return false;
  }
}

/** Byte-identical semantics to the pre-existing (pre-D-BP213-XO-62) standalone function of this
 *  name -- kept as a thin, Google-specific alias over the same CHALLENGE_URL_RULES entry so any
 *  call site that specifically wants "is this the Google challenge" (rather than "is this ANY
 *  known challenge") still can, without re-deriving the Google rule inline a second time. */
export function isGoogleChallengeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    const rule = CHALLENGE_URL_RULES.find((r) => r.vendor === 'google');
    return !!rule && rule.hostnamePattern.test(parsed.hostname) && rule.pathnameMatches(parsed.pathname);
  } catch {
    return false;
  }
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
