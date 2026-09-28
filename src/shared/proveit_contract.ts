// proveit_contract.ts -- D-BP223-BM04-X033S3-009 STEP 0
//
// THE ONE FILE BOTH SIDES IMPORT. Card shape, ticker event shape, meter shape, IPC channel
// names for the "Prove It, a question somebody else asked" feature
// (SPEC_PROVE_IT_SOMEBODY_ELSE_ASKED.md, BISHOP_DROPZONE\D-BP223-BM04-X033S3-003-PROVE-IT-OOMPH).
//
// Nothing here talks to Electron, Supabase, or React -- this is a pure type + constant module so
// both src/main and src/renderer can import it without pulling in the other side's runtime.
//
// ADDRESSING: reuses the app's existing card/eblet addressing scheme
// (soccerballAddress() in src/main/federation/hollerith_library_share.ts -- sha256 of a sorted
// JSON array of "pearl" strings, sliced to 32 hex chars) rather than inventing a second one, per
// the brief's explicit instruction. Display convention: "hex:<address>" (spec Section 1's mock,
// "address hex:7f3a...c2").
//
// DATA-LAYER CROSS-REFERENCE (007, NOT applied to production; this dispatch never writes to
// Supabase): the column names below are chosen to line up with
// BISHOP_DROPZONE\D-BP223-BM04-X033S3-007-PROVE-IT-DATA-LAYER\...substrate_questions.sql's
// `substrate_questions` table so a future migration-apply + sync pass has a straight mapping, not
// a translation. `answered_by` mirrors that table's 'claude'|'chatgpt'|'gemini'|'perplexity'|
// 'google'|'by_hand'|'mnemosynec_seed' union.

// ─── Categories (spec Section 7): the 14 MMLU-Pro categories, the seed + picker list ──────────
export const PROVEIT_CATEGORIES = [
  'biology',
  'business',
  'chemistry',
  'computer-science',
  'economics',
  'engineering',
  'health',
  'history',
  'law',
  'math',
  'philosophy',
  'physics',
  'psychology',
  'other',
] as const;

export type ProveItCategory = (typeof PROVEIT_CATEGORIES)[number];

export const PROVEIT_CATEGORY_LABELS: Record<ProveItCategory, string> = {
  biology: 'Biology',
  business: 'Business',
  chemistry: 'Chemistry',
  'computer-science': 'Computer Science',
  economics: 'Economics',
  engineering: 'Engineering',
  health: 'Health',
  history: 'History',
  law: 'Law',
  math: 'Math',
  philosophy: 'Philosophy',
  physics: 'Physics',
  psychology: 'Psychology',
  other: 'Other',
};

export function isKnownProveItCategory(slug: string): slug is ProveItCategory {
  return (PROVEIT_CATEGORIES as readonly string[]).includes(slug);
}

// ─── Who answered (spec Sections 1, 4, 6, 13) ─────────────────────────────────────────────────
// 'mnemosynec_seed' = a pre-loaded MMLU-Pro seed card (spec Section 6); never chosen by a person.
export type ProveItAnsweredBy =
  | 'claude'
  | 'chatgpt'
  | 'gemini'
  | 'perplexity'
  | 'google'
  | 'by_hand'
  // CARD_CONTRACT_v1.md section 5 (D-BP223-X043-003-A): the person's own local AI through the
  // Conduit (Ollama), never a cloud brain -- a distinct answeredBy value so a card can say so.
  | 'ollama'
  | 'mnemosynec_seed';

export const PROVEIT_ANSWERED_BY_LABELS: Record<ProveItAnsweredBy, string> = {
  claude: 'Claude',
  chatgpt: 'ChatGPT',
  gemini: 'Gemini',
  perplexity: 'Perplexity',
  google: 'Google',
  by_hand: 'by hand, model not stated',
  ollama: 'Your own AI (Ollama)',
  mnemosynec_seed: 'MnemosyneC seed',
};

// Browser Authority plug names ProveItWorksTab.tsx already lists (BP140-K4) -- 'by_hand' is the
// Liana Cycle Two-Step, not a Browser Authority plug, so it is a sibling union member here, never
// folded into BrowserAuthorityName itself (that stays the 5-member type this file does not own).
export type ProveItAnswerMethod =
  | 'user_claude'
  | 'user_chatgpt'
  | 'user_gemini'
  | 'user_perplexity'
  | 'user_google'
  | 'by_hand'
  // CARD_CONTRACT_v1.md section 5 (D-BP223-X043-003-A): answered by the person's own local AI
  // through the Conduit (Ollama), maps to answeredBy 'ollama'.
  | 'user_ollama'
  // Seed cards (spec Section 6) are materialized by the seed loader, never through an ask flow
  // or a Browser Authority plug -- 'seed' is this union's own marker for that case, distinct from
  // 'by_hand' (which always means a real person pasted a real answer this session).
  | 'seed';

export const ANSWER_METHOD_TO_ANSWERED_BY: Record<ProveItAnswerMethod, ProveItAnsweredBy> = {
  user_claude: 'claude',
  user_chatgpt: 'chatgpt',
  user_gemini: 'gemini',
  user_perplexity: 'perplexity',
  user_google: 'google',
  by_hand: 'by_hand',
  user_ollama: 'ollama',
  seed: 'mnemosynec_seed',
};

// ─── Who asked (spec Section 8) ───────────────────────────────────────────────────────────────
export interface ProveItAskedBy {
  kind: 'member' | 'guest' | 'seed';
  /** Display name shown on the card ("asked by J.Jones"); 'MnemosyneC seed' for is_seed cards. */
  display: string;
  /** true = member-sealed at Add time; false = guest attributed-but-unsealed (magic link); null
   *  for seed cards, which are neither sealed nor unsealed -- they carry no asker at all. */
  stamped: boolean | null;
  /** member user id (kind==='member') or guest wallet id (kind==='guest'); null for kind==='seed'. */
  id: string | null;
}

export function seedAskedBy(): ProveItAskedBy {
  return { kind: 'seed', display: 'MnemosyneC seed', stamped: null, id: null };
}

// ─── Sources (spec Sections 1, 2, 4) ──────────────────────────────────────────────────────────
export interface ProveItSource {
  label: string;
  url: string | null; // null = "no source given" (by-hand answer with no links pasted back)
}

// ─── Validity (spec Section 12) ───────────────────────────────────────────────────────────────
// Defaults, editable per card by a future Guild ruling (not built by this dispatch -- Harper
// Guild category rulings are a separate, DB-backed mechanism the 007 migration sketches and this
// dispatch does not implement; see REPORT.md [RULING NEEDED] for validity-window overrides).
export type ProveItValidityClass = 'day' | 'year' | 'forever' | 'ai_dated';

export const PROVEIT_VALIDITY_LABELS: Record<ProveItValidityClass, string> = {
  day: 'valid: 1 day',
  year: 'valid: 1 year',
  forever: 'valid: forever',
  ai_dated: 'valid: as dated by the answering AI',
};

/** Card_freshness.ts's own three-way split (canon/volatile/general) is REUSED, not reinvented, to
 *  decide whether a stored card is still fresh enough to serve without a re-ask -- see
 *  card_writer.ts's use of classifyCard()/reuseDecision(). This map is this feature's own
 *  additive validity-CLASS vocabulary (spec Section 12's day/year/forever/ai_dated), kept
 *  separate because the spec's four values do not line up 1:1 with card_freshness's three. */
export const VALIDITY_CLASS_TO_MS: Record<Exclude<ProveItValidityClass, 'forever' | 'ai_dated'>, number> = {
  day: 24 * 60 * 60 * 1000,
  year: 365 * 24 * 60 * 60 * 1000,
};

// ─── The card (spec Sections 1, 2, 13; the literal field list from the brief's STEP 0) ────────
export interface ProveItCard {
  address: string; // soccerballAddress()-derived, 32 hex chars (displayed "hex:<address>")
  category: ProveItCategory;
  question: string;
  answer: string;
  askedBy: ProveItAskedBy;
  answeredBy: ProveItAnsweredBy;
  /** ISO-8601 UTC. */
  madeAt: string;
  /** ISO-8601 UTC, or null = "forever" (no expiry). */
  validUntil: string | null;
  validityClass: ProveItValidityClass;
  sources: ProveItSource[];
  /** address of the card this one supersedes, or null. */
  supersedes: string | null;
  /** address of the card that superseded this one, or null while still current. */
  supersededBy: string | null;
  // ── seeding + publish state (spec Sections 5, 6, 9) -- additive beyond the brief's literal
  //    field list, needed to implement Add-to-Substrate / region D / votes without a second store.
  isSeed: boolean;
  seedSource: string | null; // e.g. 'MMLU-Pro qid 1234'; null unless isSeed
  /** D-BP223-BM04-X033S3-010 Gap 1, ADDITIVE: the exact "MnemosyneC seed . MMLU-Pro qid N .
   *  answered by <model> . checked against the key . <date>" byline (spec Section 6) for a seed
   *  card, shown alongside askedBy/answeredBy/madeAt rather than crammed into `answer` -- 010
   *  populates `answer` with the card's own real resolved answer text (Gap 1), so the attribution
   *  line needed its own field instead of continuing to double as the answer body (009's design,
   *  when no real answer text existed yet). Null for every non-seed card. */
  seedAttribution: string | null;
  /** Present only on a seed row minted from a manifest row that had a competing duplicate mint
   *  (007 DB_GROUND_TRUTH.md: 60 of 639 rows). Both mints are loaded, neither is picked as
   *  canonical; this field marks the pair visibly rather than silently choosing one. */
  duplicateOfQid: number | null;
  publishedAt: string | null; // null = not yet added to the substrate (local-only / outbox)
  unpublishedAt: string | null; // self-unpublish within 10 minutes (spec Section 5)
  voteCount: number;
  /** true once addToSubstrate() has queued this card to the local outbox because
   *  proveit.substrateLive is off (spec Section 6.c). Never true for a card actually inserted
   *  into substrate_questions (that path is not exercised while the flag is off). */
  queuedForSubstrate: boolean;
  /** X039: substrate_questions.id once the card is live on the shared substrate (take-back needs it).
   *  Absent on cards written before this field existed and on cards only queued. */
  substrateId?: string | null;
  /** How the answer was produced, for the ticker's "which brain" line and for filtering. */
  answerMethod: ProveItAnswerMethod;
  /** True when a by-hand answer carried no links to lift into `sources` (spec Section 4: "the
   *  card says 'no source given' and the vote button shows a small 'unsourced' tag"). */
  unsourced: boolean;
}

// ─── The ticker (spec Section 3) ──────────────────────────────────────────────────────────────
export type ProveItTickerStep =
  | 'question_received'
  | 'category_confirmed'
  | 'substrate_lookup'
  | 'brain_selected'
  | 'answer_received'
  | 'card_written'
  | 'meter_delta'
  | 'published'
  | 'error';

export interface ProveItTickerEvent {
  /** Groups every line belonging to one ask/askThisOne/addToSubstrate run. */
  runId: string;
  step: ProveItTickerStep;
  /** Wall-clock ms since epoch, Date.now() at the moment the step happened -- never batched or
   *  back-dated (spec Section 3: "streamed to the renderer as it happens"). */
  atMs: number;
  /** The one-line, human-readable ticker text (spec Section 1 mock's literal line format). */
  line: string;
  /** Present on step==='error': which step failed and why, plus whether the by-hand path is
   *  offered (always true today -- by-hand never depends on a Browser Authority DOM). */
  error?: { atStep: ProveItTickerStep; reason: string; byHandOffered: true };
}

// ─── The meter (spec Section 1's top-right meter) ─────────────────────────────────────────────
// DELIBERATELY NO NEW COUNTER TYPE HERE. Spec Section 1: "[the meter] is the receipt; 'Copy
// receipt' already exists on this tab (My Savings Receipt) and must read from the same
// counters." The renderer computes the header meter directly from the EXISTING
// window.amplify.savingsReceipt.getSummary() aggregate (total_queries, flagship_calls_avoided,
// cost_avoided_usd) -- the same IPC call My Savings Receipt already makes -- rather than this
// module inventing a third counting scheme alongside the Two Barrels estimate meter and the
// signed Savings Receipt that already exist. See ProveItWorksTab.tsx's header meter block.

// ─── IPC channel names (STEP 0: "one file both sides import") ────────────────────────────────
export const PROVEIT_CHANNELS = {
  ask: 'proveit:ask',
  addToSubstrate: 'proveit:add-to-substrate',
  listSomebodyElse: 'proveit:list-somebody-else',
  askThisOne: 'proveit:ask-this-one',
  vote: 'proveit:vote',
  categories: 'proveit:categories',
  suggestCategory: 'proveit:suggest-category',
  getFlags: 'proveit:get-flags',
  listMyPersonas: 'proveit:list-my-personas', // X039: the signed-in member's personas (rpc list_my_personas)
  takeBack: 'proveit:take-back', // X039: take a card back within 10 minutes (rpc unpublish_own_substrate_question)
  ticker: 'proveit:ticker', // main -> renderer push event, one per ProveItTickerEvent
} as const;

// ─── ask() / askThisOne() request + response shapes ───────────────────────────────────────────
export interface ProveItAskRequest {
  question: string;
  category: ProveItCategory;
  method: ProveItAnswerMethod;
  /** Required when method !== 'by_hand': the answer text already read back from the Browser
   *  Authority plug (this dispatch does not itself drive the browser DOM -- ProveItWorksTab.tsx
   *  already owns that read-back via window.amplify.nexusAskLookupFact / the authority plugs;
   *  the IPC handler here is the card-writing tail end of that flow, per the brief's "extend what
   *  exists" instruction). For method === 'by_hand', pastedAnswer below is used instead. */
  answerText?: string;
  /** by_hand only: the pasted answer text; pasting into the card's answer box IS the completion
   *  (spec Section 4), no second Ask. */
  pastedAnswer?: string;
  sources?: ProveItSource[];
  asker: { memberDisplay?: string; memberId?: string; guestDisplay?: string; guestWalletId?: string };
}

export interface ProveItAskResponse {
  ok: boolean;
  runId: string;
  card?: ProveItCard;
  error?: string;
}

export interface ProveItAskThisOneRequest {
  address: string;
}

export interface ProveItAskThisOneResponse {
  ok: boolean;
  runId: string;
  card?: ProveItCard;
  /** true when the found card's own validUntil has passed -- spec Section 2: "the screen says so
   *  and offers to re-ask". The card is still returned (never withheld) so the "0 model calls"
   *  demonstration still happens; the renderer surfaces the re-ask offer alongside it. */
  stale?: boolean;
  staleLabel?: string;
  error?: string;
}

export interface ProveItListRequest {
  category?: ProveItCategory | 'all';
  /** default 'votes' per spec region D ("sorted by votes"); 'date' is the tie-break and also
   *  independently selectable for the region D header's own sort control. */
  sortBy?: 'votes' | 'date';
}

export interface ProveItListResponse {
  ok: boolean;
  cards: ProveItCard[];
  /** True once the asking member/guest has published (Add to the Substrate) at least one card of
   *  their own THIS INSTALL -- spec Section 5: region D is grayed until then. */
  unlocked: boolean;
  error?: string;
}

export interface ProveItVoteRequest {
  address: string;
  isGhost: boolean; // spec Section 9: "the voter picks; default ghost"
  voter: { memberId?: string; guestWalletId?: string };
}

export interface ProveItVoteResponse {
  ok: boolean;
  voteCount?: number;
  credited: boolean;
  creditNote: string;
  error?: string;
}

export interface ProveItAddToSubstrateRequest {
  address: string;
  asker: { memberDisplay?: string; memberId?: string; guestDisplay?: string; guestWalletId?: string };
  /** X039: substrate_personas.id to publish under. Omitted = the member's only persona, if exactly one. */
  personaId?: string;
}

export interface ProveItAddToSubstrateResponse {
  ok: boolean;
  card?: ProveItCard;
  /** true when proveit.substrateLive is off and the card was written to the local outbox instead
   *  of substrate_questions (spec Section 6.c: "queued for the substrate"). */
  queued: boolean;
  error?: string;
}

// ─── X039: personas and take-back (D-BP223-PQ004-006) ─────────────────────────────────────────
/** A persona is the public name a card is published under; the account behind it is never shown. */
export interface ProveItPersona {
  id: string;
  displayName: string;
  slug: string;
}

export interface ProveItListPersonasResponse {
  ok: boolean;
  /** false when this app holds no Liana Banyan session; personas is then empty. */
  signedIn: boolean;
  personas: ProveItPersona[];
  error?: string;
}

/** Where a member makes a persona today (the app has no persona editor). */
export const PROVEIT_MAKE_PERSONA_URL = 'https://mnemosynec.org/asked/publish/';

export interface ProveItTakeBackRequest {
  address: string;
}

export interface ProveItTakeBackResponse {
  ok: boolean;
  card?: ProveItCard;
  error?: string;
}

export interface ProveItCategoriesResponse {
  ok: boolean;
  categories: Array<{ slug: ProveItCategory; label: string }>;
  /** Local suggestion queue (spec Section 7's Harper Guild Bounty Poster intake) -- rulings
   *  themselves are NOT implemented by this dispatch (no Guild membership/ruling backend exists
   *  in mnemosyne\src today; see REPORT.md [RULING NEEDED]). Suggestions are recorded so nothing
   *  submitted is lost, status is always 'pending' until a future dispatch wires the ruling path. */
  suggestions: Array<{ text: string; suggestedAt: string; status: 'pending' }>;
}
