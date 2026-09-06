// Mark-Back Vote™ ledger — D-BP165-M0-017/BISHOP-M0/kitchen-table-mark-back
// PHASE TWO of D-BP165-M0-014 (cook_events_store.ts, LANDED, 9/9 tests green,
// Founder-verified). This file EXTENDS that landing; it does not touch or
// rewrite cook_events_store.ts except for one additive export
// (listCookEventsByCooker) added there in this same dispatch.
//
// Spec: BISHOP_DROPZONE/KITCHEN_TABLE/
// SPEC_RECIPE_PROVENANCE_REFERRAL_AND_GRADUATION_BP161.md, sections 2, 3, 4,
// 4b, 6, 7 (LAW 4: asked first). The vote/mark-back mechanic itself is a
// BP165 Founder ruling made AFTER that spec was drafted; it is not spelled
// out in the BP161 text, so this file is built from the BP165 dispatch order
// directly. A MID-DISPATCH SCOPE ADDITION from the Conductor then RULED four
// items this file's first draft had flagged as open (participation refund,
// vote window ladder, window anchor point, hosting model) -- see the four
// numbered ruling sections below. Everything from the original brief that
// was NOT touched by that addition stands unchanged: the 2-mark vote, the
// 1/1 split, no fractional marks, transfer-never-mint, no platform cut on a
// vote, gifted marks may vote, the 10-recipe unlock gate, the 2/day cap, the
// voter-must-have-cooked-it constraint, the no-reciprocal-vouching window,
// and the repeat-cook decay curve.
//
// ═══ THE RULE (Founder verbatim, BP165) ════════════════════════════════════
//
//   "HOST A COPY, GET COMPENSATED." NEVER "post a picture, get a reward."
//
// The member is paid for HOSTING and SEEDING a provenance-bearing copy of a
// dish photo. THIS DECIDES EVERY EDGE CASE IN THIS FILE: every gate below
// either protects the integrity of "did this member genuinely host/cook this
// dish" or protects the "if they stop hosting, compensation stops" property.
// See RULING 4 below for the corrected hosting model (the copy replicates;
// there is no online-presence dependency).
//
// ═══ THE MONEY, SETTLED (Founder ruling, BP165, verbatim where quoted) ═════
//
// "Make the vote cost two marks." Split ONE mark to the host (whoever cooked
// and is hosting the copy being voted on), ONE mark to the recipe's author.
// MARKS ARE ALWAYS THE SAME VALUE EACH AND ARE ALWAYS WHOLE -- no fractional
// mark anywhere. The 2-mark vote exists PRECISELY to keep the 50/50 split
// whole.
//
// THE AUTHOR'S HALF IS THE ANTI-COLLUSION TAX, and that is its STATED
// PURPOSE, not fairness. A colluding ring (host and voter working together)
// pays 2 marks and recovers only 1 (the host's share) -- the other mark
// leaves the ring to the recipe's author, an outsider to the collusion in
// the general case. The ring bleeds 50% of every self-dealt vote to someone
// outside itself, EVERY CYCLE, BY CONSTRUCTION. Nobody should ever
// "optimize" this share toward the host's share -- doing so deletes the
// entire anti-collusion property, and RULING 1 below depends on this
// property surviving intact.
//
// A VOTE TRANSFERS MARKS. IT NEVER MINTS THEM. See "CONSERVATION PROOF"
// below.
//
// NO PLATFORM CUT ON A VOTE. Founder: "we don't double tax, only when a new
// transaction is happening." Margin (Cost+20%, 83.3% keep) is taken ONCE, at
// credit purchase -- a different boundary, not this file.
//
// GIFTED MARKS MAY BE SPENT ON VOTING. Ruled yes. This file does not
// special-case a mark's origin anywhere.
//
// ═══ SCOPE NOTE (LAW 1: A NEGATIVE MUST NAME ITS SCOPE) ════════════════════
//
// This file maintains its OWN append-only ledger of vote-caused transfers
// and proves CONSERVATION WITHIN THAT LEDGER. It does NOT integrate with the
// estate's existing test-net Marks ledger
// (src/main/diagnosis/bounty_substitution.ts, marks_ledger.json), which (a)
// is not exported in a form this file could safely reuse, and (b) has an
// insufficient-balance "cooperative grace" behavior that would MINT marks on
// a shortfall, directly violating "a vote transfers, never mints" if reused
// as-is. Enforcing "voter has >=2 marks in their global wallet" is therefore
// NOT implemented here -- flagged, real, not decided.
//
// ═══ GATES, SETTLED (Founder ruling, BP165) -- enforced in castMarkBackVote ═
//
//   1. 10 DISTINCT RECIPES COOKED (not authored) before mark-back unlocks.
//      Applied independently to BOTH the host and the author: if either has
//      not cleared the gate, the WHOLE vote is rejected (fail-closed on
//      either, rather than inventing burn/strand semantics for a partial
//      transfer that was never ruled).
//   2. MAXIMUM 2 MARK-BACK EARNINGS PER DAY, per receiving peer, counted
//      across BOTH roles they might collect in one UTC day -- including a
//      single vote where hostPeerId === authorId (a maker hosting their own
//      recipe), checked against the COMBINED +2 that one vote would add.
//   3. A VOTER MUST HAVE COOKED THAT SAME RECIPE. The core anti-ring
//      constraint. Enforced via a real FK (qualifyingCookEventId) into
//      cook_events_store.ts's ledger.
//   4. NO RECIPROCAL VOUCHING INSIDE A WINDOW (A vouched for B, so B cannot
//      vouch for A for N days). N is NOT ruled. NO_RECIPROCAL_VOUCH_WINDOW_DAYS
//      below is a picked default, exported, named, flagged.
//   5. DIMINISHING RETURNS ON REPEAT COOKS OF THE SAME RECIPE. Curve is NOT
//      ruled. See "THE REPEAT-COOK DECAY CURVE" below.
//   6. PHOTO TIMESTAMPS USE SERVER RECEIPT TIME, NEVER EXIF. Applied here to
//      `votedAt` and to `photoPostedAt` (RULING 3 below): both are always
//      server-time, never client-supplied or EXIF-derived, because the
//      daily-cap, reciprocal-window, AND (now) vote-window math all depend
//      on trustworthy timestamps.
//
// SELF-VOTE BLOCK (not a named gate, added as a safety inference, flagged
// for Founder confirmation): voterId === hostPeerId or voterId === authorId
// is rejected, because gate 3 is trivially true of a host voting for their
// own hosted copy, which would let a member pay themselves for free.
//
// ═══ RULING 1. THE PARTICIPATION REFUND (BP165, RULED this dispatch) ══════
//
// Founder, verbatim: "You get your votes back if you participate enough.
// Participation means more than money."
//
// RULED: the refund is a NON-TRANSFERABLE CREDIT that can ONLY reduce the
// price of a recipe purchase. IT NEVER BECOMES A SPENDABLE MARK. IT CAN
// NEVER FUND A VOTE. IT CAN NEVER BE TRANSFERRED. Amount: HALF the cost of
// each vote made -- 1 credit per 2-mark vote, issued to the VOTER on every
// successful vote (see castMarkBackVote()'s final step).
//
// THE ARITHMETIC THAT MAKES THIS SAFE, AND WHY A PLAIN MARK REFUND IS NOT
// (do not "simplify" this away -- a future session will look at a 1-mark
// author credit and a 1-mark voter refund and want to unify them; that
// change would silently destroy the anti-collusion property):
//
//   Work the ring. Carol votes on Bob's cook, Carol pays 2 SPENDABLE marks.
//   Bob receives 1 spendable mark. The recipe's author receives 1 spendable
//   mark and it LEAVES the ring (see the anti-collusion tax comment above).
//
//   IF the refund were a plain 1-mark SPENDABLE refund to Carol: Carol ends
//   at -2 +1(refund) = -1 spendable, Bob +1. Ring net = 0. Farming becomes
//   free and the entire defense evaporates.
//
//   WITH the refund as a non-spendable PURCHASE credit instead: Carol is
//   still -2 spendable (the credit does not touch her spendable balance),
//   Bob is +1 spendable. Ring net = -1 spendable mark, bled to the author,
//   EVERY cycle, exactly as before RULING 1 existed. The honest participant
//   still gets what the Founder promised -- their next recipe purchase gets
//   cheaper -- without reopening the hole RULING 1 would otherwise open.
//
// See issueParticipationRefundCredit()/getRefundCreditBalance()/
// redeemRefundCreditsTowardPurchase() below. No function in this file moves
// a credit from one peerId to another -- that is the whole enforcement of
// "never transferable": there is no code path that could do it, not a check
// that blocks one.
//
// ═══ RULING 2 & 3. THE VOTE WINDOW LADDER, ANCHORED AT THE PHOTO POST ══════
//
// RULED, three tunable constants (Founder: "so the windows can be widened at
// launch without shipping a release" -- exported by name, never inlined):
//
//   1-mark recipe        -> VOTE_WINDOW_DAYS_1_MARK_TIER      = 3 days
//   2-mark recipe        -> VOTE_WINDOW_DAYS_2_MARK_TIER       = 7 days
//   5-mark recipe and up -> VOTE_WINDOW_DAYS_5_PLUS_MARK_TIER = 14 days
//
// RATIONALE (so nobody "corrects" the ladder later): a rarer, pricier recipe
// has a THINNER POOL OF ELIGIBLE VOTERS -- fewer people have cooked a 5-mark
// dish -- so the longer window compensates for scarcity rather than fighting
// it.
//
// GAP NOT RULED, INFERRED, FLAGGED: the Founder gave three anchor points (1,
// 2, 5+) and not a rule for 3- and 4-mark recipes. voteWindowDaysForRecipePrice()
// below buckets price>=2 && price<5 into the 7-day tier (i.e. a 3- or 4-mark
// recipe currently gets the SAME window as a 2-mark recipe). This is this
// dispatch's inference to fill the gap the ladder left, not a quoted ruling
// -- flagged for Founder confirmation.
//
// LAUNCH RISK, noted per Conductor instruction, NOT solved here: most
// cooking will be 1-mark recipes on the 3-day tier, and at launch almost
// nobody has cooked anything twice, so the eligible-voter pool (gate 3:
// people who cooked THIS recipe) is nearly empty. The first cohort may
// experience mark-back as broken. The windows are tunable constants
// specifically so this can be widened without a release.
//
// ANCHOR POINT, RULED (Founder agreed verbatim): the window is anchored at
// the PHOTO POST, not the qualifying cook event. Someone who cooks Sunday
// and posts Wednesday would otherwise burn half a 3-day window before any
// vote was possible; "the clock starts when the photo is posted, because
// that is the moment voting becomes possible." See CastMarkBackVoteInput.
// photoPostedAt below.
//
// THE THING THAT MUST NOT BE GOTTEN WRONG (Conductor's own words, kept
// verbatim as the warning label): THE WINDOW GATES THE MARK-BACK ONLY. IT
// NEVER TOUCHES THE COOK EVENT AND NEVER TOUCHES RP/XP. A cook whose vote
// window expires STILL HAPPENED, still records, and still accrues
// reputation permanently -- only the money expires. This file has NO code
// path that reaches into cook_events_store.ts's ledger to alter, gate, or
// remove anything; see mark_back_store.test.ts, "an expired vote window
// never touches the cook event or RP/XP" for the executable proof.
//
// ═══ RULING 4. HOSTING, CORRECTED (BP165, this dispatch's brief had it
// wrong; the Conductor relayed the Founder's correction) ═══════════════════
//
// THE ORIGINAL BRIEF IMPLIED voters could only see a host's photo while that
// host's machine was ONLINE. THAT WAS WRONG. THIS FILE BUILDS NO UPTIME OR
// AVAILABILITY DEPENDENCY, AND NO WINDOW THAT PAUSES WHILE A HOST IS
// UNREACHABLE. Founder, verbatim: "if I download Mia's recipe I purchased it
// and it, all of it, including the photo, is my machine now -- but all
// transactions recorded, remember?"
//
// THE COPY REPLICATES. A purchaser holds the WHOLE package, photos included.
// "Host a copy, get compensated" is unchanged and still the written rule --
// the member is one of N replicating hosts, and every transaction is
// recorded indelibly, which is what makes any of it provable. The elegant
// property this produces, worth stating plainly: the eligible voters (gate
// 3: people who cooked the recipe) are EXACTLY the people who already hold
// the recipe package, photos included. The people entitled to vote are, by
// construction, the people who already have what they are voting on. There
// is therefore nothing for THIS file to check about host presence at all --
// there never was a gate to build here, which is why no
// checkHostAvailability-style function exists in this version of the file.
//
// REMAINING SUB-QUESTION, FLAGGED, NOT SOLVED: a NEW cook photo is content
// the cook creates AFTER their purchase, so how it propagates to the other
// existing holders of that recipe package is a distribution question this
// file does not answer. Flagged as open.
//
// ═══ RULING 5. PHOTO VISIBILITY SCOPE -- SEARCHED, NOT FOUND, REPORTED ═════
//
// Founder ruling: the member decides visibility, and all scopes are
// possible "because it composes with the PERSONAL PORTFOLIO SYSTEM WHICH
// ALREADY DOES THIS." Instruction: find that existing type and reuse it by
// name; do not invent a visibility enum; if it cannot be found, stop and
// report rather than inventing.
//
// SEARCHED THIS DISPATCH (LAW 1, naming the scope of this negative): the
// Conductor had already searched mnemosyne\src and mnemosyne\src\shared and
// found nothing. This SEG additionally searched, by keyword (visibility,
// scope, audience, public/private/tribe unions) and by name ("Personal
// Portfolio", Portfolio*.tsx, Logbook/*):
//   - C:\Users\Administrator\Documents\LianaBanyanPlatform\platform\src\**
//     (the member-facing web app) -- Portfolio.tsx, PortfolioDisplay.tsx,
//     LogbookContext.tsx, ProprietaryRecipesPage.tsx and 80+ other
//     Portfolio*-named files: no visibility/scope/audience field on any
//     portfolio or logbook entry.
//   - C:\Users\Administrator\Documents\LianaBanyanPlatform\src\** (a
//     sibling Electron app tree, separate package from mnemosyne): found an
//     ADJACENT but DISTINCT concept, `RelationshipClass` in
//     src\renderer\lib\social_marks_constants.ts ('individual' |
//     'friendship' | 'tribe' | 'guild' | 'project' | 'association' |
//     'federation' | 'public') -- but that file's own header notes "no
//     Relationship Circles / Contact Taxonomy implementation found
//     repo-wide at fire-time," it governs Social-Tab Cue Card send caps,
//     not portfolio/photo visibility, and it lives in a different repo
//     package than mnemosyne, so it is not import-reusable here even if it
//     were the right concept.
//   - No file anywhere under LianaBanyanPlatform contains the phrase
//     "Personal Portfolio".
//
// REPORTED, NOT INVENTED: no PortfolioVisibility/PhotoVisibility/ScopeType
// exists to reuse. This file therefore has NO photo-visibility-scope field
// or check anywhere in it. Wiring photo visibility is left entirely to
// whoever locates or builds the Personal Portfolio System the Founder
// referenced -- this search result is recorded here so that search is never
// repeated from zero.
//
// ═══ CONSERVATION PROOF (a vote transfers, never mints) ════════════════════
//
// castMarkBackVote() has exactly ONE place that constructs a
// MarkBackVoteEvent, and marksToCook/marksToAuthor/totalMarksTransferred are
// typed in kitchen_table_types.ts as the LITERAL values 1, 1, 2 -- not
// `number`. The net delta of every event this file ever writes is therefore,
// by construction: voter -2, host +1, author +1, sum 0.
// mark_back_store.test.ts computes this sum explicitly and asserts it is
// always exactly 0.
//
// ═══ THE REPEAT-COOK DECAY CURVE (gate 5, curve not Founder-ruled) ═════════
//
// REPEAT_COOK_DECAY_RATE = 0.5. A voter's Nth cook of the SAME recipe
// contributes decay^(N-1) toward "effective cook credit" for that recipe,
// and a voter may cast a new vote on a recipe only while their PRIOR vote
// count on that recipe is strictly less than their current effective
// credit. A geometric series with ratio r converges to 1/(1-r); at r = 0.5
// that limit is exactly 2, so NO NUMBER of repeat cooks of one recipe can
// ever fund a THIRD vote on it. A 1st vote needs 1 cook, a 2nd needs 2, a
// 3rd is asymptotically unreachable by cooking the same dish alone. FOUNDER
// HAS NOT RULED the rate; 0.5 is this dispatch's picked default.
//
// ═══ WIRED, BUT SHIPPED OFF (per-dispatch order) ═══════════════════════════
//
// Cook event recording (Phase One) is NOT gated by anything in this file --
// proven by re-running cook_events_store.test.ts unchanged. Everything in
// THIS file is gated by default OFF behind KITCHEN_TABLE_MARKBACK_ENABLED_ENV_VAR
// (isMarkBackEnabled() below). Per "when you build it, you wire it":
// registerMarkBackIpc() IS called from src/main/index.ts and the bridge IS
// exposed from src/main/preload.ts in this same dispatch -- the wiring is
// live, the BUSINESS LOGIC inside it refuses to act while the flag is off.

import { app, ipcMain, nativeImage } from 'electron';
import { join } from 'path';
import { existsSync, readFileSync, appendFileSync, mkdirSync } from 'fs';
import { randomUUID } from 'crypto';
import { inflateSync, deflateSync } from 'zlib';
import type { MarkBackVoteEvent, MarkBackRefundCreditEntry } from '../../shared/kitchen_table_types';
import { listCookEventsForRecipe, listCookEventsByCooker } from './cook_events_store';

// ─── Money constants (whole marks only, see file header) ──────────────────────

export const MARK_BACK_VOTE_COST_MARKS = 2;
export const MARK_BACK_HOST_SHARE_MARKS = 1;
export const MARK_BACK_AUTHOR_SHARE_MARKS = 1;
/** RULING 1: 1 refund credit per vote = HALF the vote cost. Named, not
 *  inlined, so the "half" relationship to MARK_BACK_VOTE_COST_MARKS stays
 *  visible at the constant's use sites. */
export const PARTICIPATION_REFUND_CREDITS_PER_VOTE = 1;

// Runtime self-check backing the "assert it" instruction, in addition to the
// compile-time literal-type proof in kitchen_table_types.ts. Runs once at
// module load; throws immediately (loud, not silent) if this file's own
// constants ever drift out of whole-mark conservation.
if (
  !Number.isInteger(MARK_BACK_VOTE_COST_MARKS) ||
  !Number.isInteger(MARK_BACK_HOST_SHARE_MARKS) ||
  !Number.isInteger(MARK_BACK_AUTHOR_SHARE_MARKS) ||
  !Number.isInteger(PARTICIPATION_REFUND_CREDITS_PER_VOTE) ||
  MARK_BACK_HOST_SHARE_MARKS + MARK_BACK_AUTHOR_SHARE_MARKS !== MARK_BACK_VOTE_COST_MARKS
) {
  throw new Error(
    '[mark_back_store] FATAL: whole-mark conservation invariant violated at load time -- ' +
      'MARK_BACK_HOST_SHARE_MARKS + MARK_BACK_AUTHOR_SHARE_MARKS must equal MARK_BACK_VOTE_COST_MARKS, ' +
      'and all money constants must be integers. This must never happen; if it does, the file was ' +
      'edited against its own documented invariant.'
  );
}

// ─── Gate constants ─────────────────────────────────────────────────────────

export const MIN_DISTINCT_RECIPES_COOKED_TO_UNLOCK_MARKBACK = 10;
export const MAX_MARKBACK_EARNINGS_PER_DAY_MARKS = 2;

/** FOUNDER OPEN (gate 4, see file header). Picked default, not ruled. */
export const NO_RECIPROCAL_VOUCH_WINDOW_DAYS = 30;

/** FOUNDER OPEN (gate 5, see file header "THE REPEAT-COOK DECAY CURVE").
 *  Picked default, not ruled. */
export const REPEAT_COOK_DECAY_RATE = 0.5;

/** Pure function: how much "vote eligibility credit" a voter's Nth cook of
 *  the SAME recipe contributes, cumulatively. See file header for the
 *  convergence proof (limit = 1/(1 - REPEAT_COOK_DECAY_RATE) = 2). */
export function effectiveCookCredit(cookOccurrences: number): number {
  if (cookOccurrences <= 0) return 0;
  const r = REPEAT_COOK_DECAY_RATE;
  let sum = 0;
  for (let k = 0; k < cookOccurrences; k++) sum += Math.pow(r, k);
  return sum;
}

// ─── RULING 2: the vote window ladder (tunable constants, never inlined) ──

export const VOTE_WINDOW_DAYS_1_MARK_TIER = 3;
export const VOTE_WINDOW_DAYS_2_MARK_TIER = 7;
export const VOTE_WINDOW_DAYS_5_PLUS_MARK_TIER = 14;

/** Selects the vote-window tier for a recipe's price. See file header,
 *  RULING 2, for the ladder's rationale and the named gap (3-4 mark
 *  recipes are inferred into the 7-day tier -- not a quoted ruling). */
export function voteWindowDaysForRecipePrice(recipePriceMarks: number): number {
  if (recipePriceMarks >= 5) return VOTE_WINDOW_DAYS_5_PLUS_MARK_TIER;
  if (recipePriceMarks >= 2) return VOTE_WINDOW_DAYS_2_MARK_TIER;
  return VOTE_WINDOW_DAYS_1_MARK_TIER;
}

// ─── Feature flag (default OFF, see file header "WIRED, BUT SHIPPED OFF") ──

export const KITCHEN_TABLE_MARKBACK_ENABLED_ENV_VAR = 'KITCHEN_TABLE_MARKBACK_ENABLED';

export function isMarkBackEnabled(): boolean {
  const v = process.env[KITCHEN_TABLE_MARKBACK_ENABLED_ENV_VAR];
  return v === 'true' || v === '1';
}

// ─── Storage (JSONL, append-only, same doctrine as cook_events_store.ts) ───

function getVoteLedgerPath(): string {
  return join(app.getPath('userData'), 'kitchen_table_mark_back_votes.jsonl');
}

function getRefundCreditLedgerPath(): string {
  return join(app.getPath('userData'), 'kitchen_table_mark_back_refund_credits.jsonl');
}

function ensureDirFor(filePath: string): void {
  const dir = join(filePath, '..');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function loadAllMarkBackVotes(): MarkBackVoteEvent[] {
  const path = getVoteLedgerPath();
  if (!existsSync(path)) return [];
  const raw = readFileSync(path, 'utf-8');
  const events: MarkBackVoteEvent[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      events.push(JSON.parse(trimmed) as MarkBackVoteEvent);
    } catch {
      console.warn('[mark_back_store] malformed vote ledger line skipped');
    }
  }
  return events;
}

/** Append one entry. No update, no delete function exists in this file, on
 *  purpose -- a vote transfer is a fact, recorded once. */
function appendMarkBackVote(event: MarkBackVoteEvent): void {
  ensureDirFor(getVoteLedgerPath());
  appendFileSync(getVoteLedgerPath(), JSON.stringify(event) + '\n', 'utf-8');
}

function loadAllRefundCredits(): MarkBackRefundCreditEntry[] {
  const path = getRefundCreditLedgerPath();
  if (!existsSync(path)) return [];
  const raw = readFileSync(path, 'utf-8');
  const entries: MarkBackRefundCreditEntry[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      entries.push(JSON.parse(trimmed) as MarkBackRefundCreditEntry);
    } catch {
      console.warn('[mark_back_store] malformed refund credit ledger line skipped');
    }
  }
  return entries;
}

function appendRefundCreditEntry(entry: MarkBackRefundCreditEntry): void {
  ensureDirFor(getRefundCreditLedgerPath());
  appendFileSync(getRefundCreditLedgerPath(), JSON.stringify(entry) + '\n', 'utf-8');
}

// ─── Query helpers (votes) ──────────────────────────────────────────────────

export function listMarkBackVotes(): MarkBackVoteEvent[] {
  return loadAllMarkBackVotes();
}

export function listMarkBackVotesForRecipe(recipeId: string): MarkBackVoteEvent[] {
  return loadAllMarkBackVotes().filter((e) => e.recipeId === recipeId);
}

export function listMarkBackVotesByVoter(voterId: string): MarkBackVoteEvent[] {
  return loadAllMarkBackVotes().filter((e) => e.voterId === voterId);
}

/** All votes that credited peerId anything, as host or as author or both. */
export function listMarkBackVotesCreditingPeer(peerId: string): MarkBackVoteEvent[] {
  return loadAllMarkBackVotes().filter((e) => e.hostPeerId === peerId || e.authorId === peerId);
}

/** All-time sum of marks peerId has collected via mark-back, as host share
 *  plus author share, across every vote (no cap applied -- this is a raw
 *  tally, not an earnings-cap-respecting balance). */
export function tallyMarkBackEarningsForPeer(peerId: string): number {
  return loadAllMarkBackVotes().reduce((sum, e) => {
    let n = sum;
    if (e.hostPeerId === peerId) n += e.marksToCook;
    if (e.authorId === peerId) n += e.marksToAuthor;
    return n;
  }, 0);
}

function utcDateOnly(iso: string): string {
  return iso.slice(0, 10);
}

/** Sum of marks peerId collected via mark-back on the UTC calendar day that
 *  atIso falls on -- used to enforce MAX_MARKBACK_EARNINGS_PER_DAY_MARKS. */
function dailyMarkBackEarnings(peerId: string, atIso: string): number {
  const day = utcDateOnly(atIso);
  return loadAllMarkBackVotes().reduce((sum, e) => {
    if (utcDateOnly(e.votedAt) !== day) return sum;
    let n = sum;
    if (e.hostPeerId === peerId) n += e.marksToCook;
    if (e.authorId === peerId) n += e.marksToAuthor;
    return n;
  }, 0);
}

// ─── Gate checks ────────────────────────────────────────────────────────────

/** Gate 3: the voter must have cooked THIS recipe. Returns the most recent
 *  qualifying CookEvent (its id becomes qualifyingCookEventId), or undefined. */
function mostRecentQualifyingCook(recipeId: string, voterId: string) {
  const cooks = listCookEventsForRecipe(recipeId).filter((e) => e.cookedBy === voterId);
  if (cooks.length === 0) return undefined;
  return cooks.sort((a, b) => Date.parse(b.cookedAt) - Date.parse(a.cookedAt))[0];
}

/** Gate 1: peerId has cooked >= MIN_DISTINCT_RECIPES_COOKED_TO_UNLOCK_MARKBACK
 *  DISTINCT recipes (not cook events -- twenty cooks of one recipe count as
 *  one recipe here; "recipes cooked", per the Founder's own wording). */
function meetsUnlockGate(peerId: string): boolean {
  const distinctRecipeIds = new Set(listCookEventsByCooker(peerId).map((e) => e.recipeId));
  return distinctRecipeIds.size >= MIN_DISTINCT_RECIPES_COOKED_TO_UNLOCK_MARKBACK;
}

/** Gate 5: has this voter exhausted their repeat-cook credit for this
 *  recipe? See "THE REPEAT-COOK DECAY CURVE" in the file header. */
function repeatCookCreditExhausted(voterId: string, recipeId: string): boolean {
  const priorVotesOnThisRecipe = loadAllMarkBackVotes().filter(
    (e) => e.voterId === voterId && e.recipeId === recipeId
  ).length;
  const cookOccurrences = listCookEventsForRecipe(recipeId).filter((e) => e.cookedBy === voterId).length;
  return !(priorVotesOnThisRecipe < effectiveCookCredit(cookOccurrences));
}

/** Gate 4: no reciprocal vouching inside NO_RECIPROCAL_VOUCH_WINDOW_DAYS. If
 *  any of `recipients` (the peers this NEW vote would credit) previously
 *  cast a vote that credited `voterId`, within the window, this vote is
 *  blocked -- "A vouched for B, so B cannot vouch for A for N days." */
function violatesReciprocalWindow(voterId: string, recipients: string[], atIso: string): boolean {
  const windowMs = NO_RECIPROCAL_VOUCH_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const atMs = Date.parse(atIso);
  return loadAllMarkBackVotes().some((prior) => {
    if (!recipients.includes(prior.voterId)) return false; // prior voter isn't one of this vote's recipients
    const priorCreditedThisVoter = prior.hostPeerId === voterId || prior.authorId === voterId;
    if (!priorCreditedThisVoter) return false;
    const deltaMs = Math.abs(atMs - Date.parse(prior.votedAt));
    return deltaMs < windowMs;
  });
}

/** RULING 2/3: the vote window, anchored at the photo's post time, not the
 *  qualifying cook. Gates the MONEY ONLY -- see file header warning label. */
function isVoteWindowExpired(photoPostedAt: string, atIso: string, recipePriceMarks: number): boolean {
  const windowDays = voteWindowDaysForRecipePrice(recipePriceMarks);
  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  return Date.parse(atIso) - Date.parse(photoPostedAt) > windowMs;
}

// ─── Public API ─────────────────────────────────────────────────────────────

export interface CastMarkBackVoteInput {
  recipeId: string;
  authorId: string;
  /** The member hosting the provenance-bearing copy being voted on. Receives
   *  MARK_BACK_HOST_SHARE_MARKS. See file header: "host a copy, get
   *  compensated." */
  hostPeerId: string;
  voterId: string;
  /** Defaults to now() if omitted -- pass explicitly only for backfill/
   *  replay, mirroring cook_events_store.ts's cookedAt convention. NEVER
   *  populate this from a client-reported or EXIF-derived time. */
  votedAt?: string;
  /** The recipe's price in marks -- selects the vote-window tier via
   *  voteWindowDaysForRecipePrice() (RULING 2). Required: the window is a
   *  real money-eligibility gate and must never silently default. */
  recipePriceMarks: number;
  /** SERVER RECEIPT TIME the HOST's photo/copy was posted -- the window
   *  anchor (RULING 3). Required for the same reason as recipePriceMarks.
   *  NEVER EXIF, never client-supplied. */
  photoPostedAt: string;
}

export type MarkBackRejectReason =
  | 'markback-disabled'
  | 'voter-cannot-vote-for-self'
  | 'voter-has-not-cooked-recipe'
  | 'vote-window-expired'
  | 'host-has-not-cleared-unlock-gate'
  | 'author-has-not-cleared-unlock-gate'
  | 'repeat-cook-credit-exhausted'
  | 'reciprocal-vouch-window-violation'
  | 'host-daily-cap-reached'
  | 'author-daily-cap-reached';

export type CastMarkBackVoteResult =
  | { ok: true; event: MarkBackVoteEvent }
  | { ok: false; reason: MarkBackRejectReason };

/** The single write path for this ledger. Every gate named in the file
 *  header is checked here, in order, fail-closed: the first gate that fails
 *  rejects the WHOLE vote and nothing is written. On success, exactly one
 *  MarkBackVoteEvent is appended with marksToCook=1, marksToAuthor=1,
 *  totalMarksTransferred=2 (see "CONSERVATION PROOF"), and exactly one
 *  non-spendable participation refund credit (RULING 1) is issued to the
 *  voter. Neither this function nor anything else in this file ever writes
 *  to, gates, or reads cook_events_store.ts's ledger for write purposes --
 *  it is read-only input here (see the RULING 2/3 warning label). */
export function castMarkBackVote(input: CastMarkBackVoteInput): CastMarkBackVoteResult {
  if (!isMarkBackEnabled()) {
    return { ok: false, reason: 'markback-disabled' };
  }

  const votedAt = input.votedAt ?? new Date().toISOString();

  if (input.voterId === input.hostPeerId || input.voterId === input.authorId) {
    return { ok: false, reason: 'voter-cannot-vote-for-self' };
  }

  const qualifyingCook = mostRecentQualifyingCook(input.recipeId, input.voterId);
  if (!qualifyingCook) {
    return { ok: false, reason: 'voter-has-not-cooked-recipe' };
  }

  if (isVoteWindowExpired(input.photoPostedAt, votedAt, input.recipePriceMarks)) {
    return { ok: false, reason: 'vote-window-expired' };
  }

  if (!meetsUnlockGate(input.hostPeerId)) {
    return { ok: false, reason: 'host-has-not-cleared-unlock-gate' };
  }
  if (!meetsUnlockGate(input.authorId)) {
    return { ok: false, reason: 'author-has-not-cleared-unlock-gate' };
  }

  if (repeatCookCreditExhausted(input.voterId, input.recipeId)) {
    return { ok: false, reason: 'repeat-cook-credit-exhausted' };
  }

  if (violatesReciprocalWindow(input.voterId, [input.hostPeerId, input.authorId], votedAt)) {
    return { ok: false, reason: 'reciprocal-vouch-window-violation' };
  }

  // Daily cap: compute per-peer contribution this vote would add, so a
  // hostPeerId === authorId self-authored-recipe vote is checked against
  // the COMBINED +2 it would add to that one person, not two independent +1
  // checks that would each individually look fine.
  const contributionByPeer = new Map<string, number>();
  contributionByPeer.set(input.hostPeerId, (contributionByPeer.get(input.hostPeerId) ?? 0) + MARK_BACK_HOST_SHARE_MARKS);
  contributionByPeer.set(input.authorId, (contributionByPeer.get(input.authorId) ?? 0) + MARK_BACK_AUTHOR_SHARE_MARKS);

  const hostExisting = dailyMarkBackEarnings(input.hostPeerId, votedAt);
  if (hostExisting + (contributionByPeer.get(input.hostPeerId) ?? 0) > MAX_MARKBACK_EARNINGS_PER_DAY_MARKS) {
    return { ok: false, reason: 'host-daily-cap-reached' };
  }
  const authorExisting = dailyMarkBackEarnings(input.authorId, votedAt);
  if (authorExisting + (contributionByPeer.get(input.authorId) ?? 0) > MAX_MARKBACK_EARNINGS_PER_DAY_MARKS) {
    return { ok: false, reason: 'author-daily-cap-reached' };
  }

  const event: MarkBackVoteEvent = {
    id: randomUUID(),
    recipeId: input.recipeId,
    authorId: input.authorId,
    hostPeerId: input.hostPeerId,
    qualifyingCookEventId: qualifyingCook.id,
    voterId: input.voterId,
    votedAt,
    marksToCook: MARK_BACK_HOST_SHARE_MARKS as 1,
    marksToAuthor: MARK_BACK_AUTHOR_SHARE_MARKS as 1,
    totalMarksTransferred: MARK_BACK_VOTE_COST_MARKS as 2,
    recipePriceMarksAtVote: input.recipePriceMarks,
    photoPostedAt: input.photoPostedAt,
    voteWindowDaysApplied: voteWindowDaysForRecipePrice(input.recipePriceMarks),
  };
  appendMarkBackVote(event);

  // RULING 1: issue the non-spendable participation refund credit. See file
  // header for the ring arithmetic this depends on -- do not change this to
  // credit spendable marks.
  issueParticipationRefundCredit(input.voterId, event.id, votedAt);

  return { ok: true, event };
}

// ─── RULING 1: participation refund credit (non-spendable, non-transferable) ─

/** Balance = count(issued) - count(redeemed) for peerId. This is the ONLY
 *  way a balance is ever computed -- there is no separate stored balance
 *  field to drift from the ledger. */
export function getRefundCreditBalance(peerId: string): number {
  return loadAllRefundCredits().reduce((sum, e) => {
    if (e.peerId !== peerId) return sum;
    return e.kind === 'issued' ? sum + e.amount : sum - e.amount;
  }, 0);
}

/** Called ONLY from castMarkBackVote() on a successful vote. Not exported as
 *  a general "grant credits" API on purpose -- the sole source of a credit
 *  is casting a vote. */
function issueParticipationRefundCredit(voterId: string, sourceVoteEventId: string, atIso: string): void {
  for (let i = 0; i < PARTICIPATION_REFUND_CREDITS_PER_VOTE; i++) {
    appendRefundCreditEntry({
      id: randomUUID(),
      peerId: voterId,
      kind: 'issued',
      amount: 1,
      sourceVoteEventId,
      redeemedForRecipeId: null,
      at: atIso,
    });
  }
}

export type RedeemRefundCreditsResult =
  | { ok: true; redeemedCredits: number; remainingBalance: number }
  | { ok: false; reason: 'insufficient-refund-credit-balance' };

/** The ONLY spend path for a refund credit: reducing a specific recipe
 *  purchase's price. There is no parameter anywhere in this file's public
 *  API for "which peer receives these credits" other than the peer
 *  redeeming their own -- credits cannot be sent, gifted, or sold. This is
 *  what "never transferable" means structurally: the capability to move a
 *  credit to someone else does not exist in this file, not "exists but is
 *  blocked." */
export function redeemRefundCreditsTowardPurchase(
  peerId: string,
  recipeId: string,
  creditsToRedeem: number,
  atIso: string = new Date().toISOString()
): RedeemRefundCreditsResult {
  const balance = getRefundCreditBalance(peerId);
  if (creditsToRedeem <= 0 || balance < creditsToRedeem) {
    return { ok: false, reason: 'insufficient-refund-credit-balance' };
  }
  for (let i = 0; i < creditsToRedeem; i++) {
    appendRefundCreditEntry({
      id: randomUUID(),
      peerId,
      kind: 'redeemed',
      amount: 1,
      sourceVoteEventId: null,
      redeemedForRecipeId: recipeId,
      at: atIso,
    });
  }
  return { ok: true, redeemedCredits: creditsToRedeem, remainingBalance: balance - creditsToRedeem };
}

export function listRefundCreditLedger(peerId: string): MarkBackRefundCreditEntry[] {
  return loadAllRefundCredits().filter((e) => e.peerId === peerId);
}

// ─── PHOTOS ARE NOT HOSTED BY LIANA BANYAN (architecture, not policy) ──────
//
// The copy replicates -- see RULING 4 above for the corrected model. Photos
// are part of a purchased recipe package that lives on every holder's own
// machine; every transaction (purchase, cook, vote) is recorded indelibly,
// which is what makes any of it provable, and there is no online-presence
// gate to build.
//
// ═══ RULING 6. DERIVE A CLEAN COPY, NOT A PER-FORMAT STRIPPER (BP165, this
// dispatch's follow-on; Founder-ruled after this file's own honestly-flagged
// JPEG-only limitation below was reported) ═════════════════════════════════
//
// Founder, verbatim, offered two options: "fix the EXIF scrub for HEIC and
// PNG too, or maybe make a copy that doesn't keep that info and leave the
// original on the user's computer." THE SECOND OPTION IS WHAT IS BUILT HERE.
//
// WHY (put here so nobody quietly reverts to per-format stripping):
// STRIPPING METADATA IS A BLACKLIST -- to strip safely you must know every
// metadata container in every format (EXIF, XMP, IPTC, ICC profiles, PNG's
// eXIf/tEXt/iTXt/zTXt chunks, HEIC/HEIF item properties, and the full-size
// JPEG preview embedded inside many HEIC files, WHICH CARRIES ITS OWN EXIF
// INCLUDING GPS). Miss one container in one format and it leaks silently,
// forever. DERIVING A CLEAN COPY IS A WHITELIST: decode to raw pixels and
// re-encode. Nothing survives that was not deliberately copied. One code
// path, every format, and a new format is safe-by-default (refused) instead
// of dangerous-by-default (passed through).
//
// THE RULE:
//   1. The member's ORIGINAL is never touched, moved, or modified -- it
//      stays on their own machine at full quality with its own metadata
//      intact. deriveCleanPhotoCopy() below takes a Buffer and returns a
//      NEW Buffer; it has no file-path parameter and performs no filesystem
//      write, by construction, same as stripExifForServe() before it.
//   2. ONLY the derived copy is ever served or replicated. Produced by
//      decoding to pixels (DecodedPixels: width, height, raw RGBA) and
//      re-encoding to ONE chosen output format (default PNG; JPEG
//      available). EXIF orientation, if any, is applied to the PIXELS
//      during decode (the underlying codec's job, see below) and the tag
//      itself is never carried forward -- there is no code path in this
//      file's encoders that writes an orientation tag, an ICC profile, or a
//      timestamp into the output.
//   3. The derived copy's own SOCCERI hash is what a propagation log would
//      track (not built in this file -- there is no propagation log here
//      yet -- but stated as the intended property: the private original is
//      never addressed, logged, or shared by anything in this file).
//   4. ACCEPTED INPUTS: JPEG, PNG, WebP (WebP decode only; there is no WebP
//      ENCODER wired here because nothing in this dispatch's ruling asked
//      for WebP output, only WebP input support). HEIC/HEIF and anything
//      else undecodable is REFUSED OUTRIGHT via PhotoFormatRefusedError,
//      never passed through -- see isHeicOrHeif() and the final `if (!pixels)`
//      check in deriveCleanPhotoCopy().
//
// ═══ THE HONEST DEPENDENCY PROBLEM (LAW 4: asked the vault first) ══════════
//
// INVESTIGATED BEFORE WRITING ANY CODE: this repo's package.json (deps and
// devDeps) has NO `sharp`, `jimp`, `heic-convert`, `canvas`, or any image
// codec package, and none of those exist under node_modules either. The
// ONLY existing image-handling code anywhere in src/ is `nativeImage`
// (Electron's own built-in module), used exactly twice, in src/main/index.ts
// (lines ~203, ~1418-1419), purely to set the app/window ICON from a path --
// never for decoding, re-encoding, or any Kitchen Table photo. REUSED HERE:
// `nativeImage` decodes/encodes JPEG, PNG, and WebP using Chromium's own
// codecs (libjpeg-turbo / libpng / libwebp) with ZERO new dependency, which
// is what productionNativeImageCodec below is built on.
//
// HEIC/HEIF GENUINELY HAS NO DECODER AVAILABLE without adding something new:
// Electron's Chromium does not compile in HEIC support (no license for it in
// open-source Chromium), so `nativeImage` cannot decode it, verified by this
// dispatch, not assumed. TWO REAL OPTIONS, NEITHER INSTALLED, BOTH LEFT FOR
// THE FOUNDER TO RULE ON:
//   (a) `sharp` built with libheif -- native, well-tested, but a native
//       compiled dependency (platform-specific binaries, larger install).
//   (b) `libheif-js` -- a WASM build of libheif, no native compilation step,
//       but still a NEW dependency and an unvetted one (this dispatch did
//       not audit it).
// PER THE FOUNDER'S OWN INSTRUCTION THIS FOLLOW-ON CARRIED: investigate and
// report, do not install. Neither is added. HEIC/HEIF input is explicitly
// REFUSED with a clear, named error (isHeicOrHeif() + the thrown message in
// deriveCleanPhotoCopy()) rather than silently mishandled. iPhones shoot
// HEIC by default, so this is a REAL, KNOWN, FLAGGED product gap, not a
// theoretical one -- the Founder needs to rule on it knowingly.
//
// ═══ WHY nativeImage CANNOT BE UNIT-TESTED HERE, AND THE TEST SEAM THIS
// CAUSES (LAW 5: prove the far end, honestly) ═══════════════════════════════
//
// VERIFIED THIS DISPATCH: `require('electron')` under plain Node (i.e.
// under `vitest run`, outside a real running Electron process) resolves to
// a STRING -- the path to electron.exe -- not a working module. This is why
// this repo's existing test convention (cook_events_store.test.ts, and this
// file's own test file) mocks 'electron' entirely, and it means
// `nativeImage` genuinely cannot be exercised inside this repo's `vitest
// run` unit-test harness; no Electron-process E2E test runner (Playwright's
// `_electron`, electron-mocha, etc.) exists anywhere in this repo to fall
// back on either -- checked, not assumed.
//
// RATHER THAN CLAIM A TEST PROVES SOMETHING IT DOES NOT, THE CODEC USED FOR
// JPEG/WEBP DECODE AND JPEG ENCODE IS INJECTABLE (`__setJpegWebpCodecForTesting`
// / `__resetJpegWebpCodecForTesting`, below), defaulting to the real
// `nativeImage`-backed codec in production. THE PNG PATH NEEDS NO SUCH SEAM:
// decodePng()/encodePng() below are a REAL, independently-written,
// dependency-free PNG codec built only on Node's built-in `zlib`
// (PNG's compression IS standard DEFLATE, so no new dependency is needed for
// PNG at all), and mark_back_store.test.ts proves the whole property --
// real GPS-bearing chunks in, a real re-encoded buffer out, GPS bytes
// genuinely absent -- with NO mock, NO fake, and NO Electron process
// involved. The JPEG/WebP tests use the injection seam to prove the
// ORCHESTRATION is correct (format routing, refuse-on-null-decode, the
// output buffer is built ENTIRELY by an encoder call and never by copying
// input bytes) without claiming to test nativeImage's own decode
// correctness, which is Chromium's guarantee to keep, not this file's.
//
// STRIP EXIF ON SERVE remains true as the underlying intent, but per the
// Founder's instruction, THE SERVE PATH MUST NOW GO THROUGH
// deriveCleanPhotoCopy(), not through a format-conditional stripper.
// stripExifForServe() below is KEPT as an internal helper (it may still be
// useful for a byte-preserving fast path some future caller wants), but it
// is no longer the recommended primary API and nothing in this file calls
// it internally.
//
// NAMED LIMITATION, NARROWED FROM THE ORIGINAL (LAW 1): stripExifForServe()
// below still only recognizes JPEG's APP1/Exif segment -- that limitation
// is now moot for the actual serve path, which is deriveCleanPhotoCopy(),
// covering JPEG, PNG, and WebP input completely (by construction, not by
// container enumeration) and refusing HEIC/HEIF and anything else outright.

/** Returns a NEW Buffer with the JPEG's APP1/Exif segment (if any) removed.
 *  Never mutates `input`. Non-JPEG input (checked by SOI marker 0xFFD8) is
 *  returned as an unscrubbed copy. KEPT as an internal helper -- see
 *  RULING 6 above for why deriveCleanPhotoCopy(), not this function, is now
 *  the required serve path. */
export function stripExifForServe(input: Buffer): Buffer {
  if (input.length < 4 || input[0] !== 0xff || input[1] !== 0xd8) {
    return Buffer.from(input);
  }

  const pieces: Buffer[] = [input.subarray(0, 2)]; // SOI
  let i = 2;

  while (i < input.length) {
    if (input[i] !== 0xff) {
      pieces.push(input.subarray(i));
      i = input.length;
      break;
    }

    const marker = input[i + 1];

    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      pieces.push(input.subarray(i, i + 2));
      i += 2;
      continue;
    }

    if (marker === 0xd9) {
      pieces.push(input.subarray(i, i + 2));
      i += 2;
      break;
    }

    if (i + 3 >= input.length) {
      pieces.push(input.subarray(i));
      i = input.length;
      break;
    }

    const len = (input[i + 2] << 8) | input[i + 3];

    if (marker === 0xda) {
      pieces.push(input.subarray(i, i + 2 + len));
      pieces.push(input.subarray(i + 2 + len));
      i = input.length;
      break;
    }

    const segEnd = i + 2 + len;
    const isApp1Exif =
      marker === 0xe1 &&
      len >= 8 &&
      input[i + 4] === 0x45 && // 'E'
      input[i + 5] === 0x78 && // 'x'
      input[i + 6] === 0x69 && // 'i'
      input[i + 7] === 0x66; // 'f'

    if (!isApp1Exif) {
      pieces.push(input.subarray(i, segEnd));
    }

    i = segEnd;
  }

  return Buffer.concat(pieces);
}

// ─── RULING 6: derive a clean copy (decode to pixels, re-encode) ──────────

/** Thrown by deriveCleanPhotoCopy() for any input it will not process:
 *  HEIC/HEIF (no decoder available, see RULING 6), or any format it cannot
 *  decode. Refusing loudly, never passing the original through unscrubbed,
 *  is the whole point -- see the file header. */
export class PhotoFormatRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PhotoFormatRefusedError';
  }
}

/** The ONLY thing that survives decode -- raw pixels, nothing else. No
 *  metadata field exists on this type; there is nowhere for a tag to hide. */
interface DecodedPixels {
  width: number;
  height: number;
  /** Row-major, top-to-bottom, 4 bytes per pixel (R,G,B,A), no padding. */
  rgba: Buffer;
}

export type DerivedCopyOutputFormat = 'png' | 'jpeg';

export interface DeriveCleanPhotoCopyOptions {
  /** Default 'png' -- lossless, and (per RULING 6's test-seam section) the
   *  path that needs no Electron runtime at all, since it is backed by this
   *  file's own dependency-free PNG codec regardless of the INPUT format. */
  outputFormat?: DerivedCopyOutputFormat;
  /** Only used when outputFormat === 'jpeg'. Default 92. */
  jpegQuality?: number;
}

// ─── Format sniffing (whitelist of what this file will attempt to decode) ──

function isJpegSignature(buf: Buffer): boolean {
  return buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xd8;
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function isPngSignature(buf: Buffer): boolean {
  return buf.length >= 8 && buf.subarray(0, 8).equals(PNG_SIGNATURE);
}

function isWebpSignature(buf: Buffer): boolean {
  return buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP';
}

/** ISO base media file format ("ftyp" box) brand sniff. Covers the common
 *  HEIC/HEIF/HEIF-sequence brands. See RULING 6: refused outright, not
 *  passed through, because no decoder for this exists in this build. */
function isHeicOrHeif(buf: Buffer): boolean {
  if (buf.length < 12) return false;
  if (buf.toString('ascii', 4, 8) !== 'ftyp') return false;
  const brand = buf.toString('ascii', 8, 12);
  return ['heic', 'heix', 'heim', 'heis', 'hevc', 'hevx', 'hevm', 'hevs', 'mif1', 'msf1'].includes(brand);
}

// ─── PNG codec: real, dependency-free (Node's built-in zlib only) ─────────
//
// PNG's compressed image data is standard DEFLATE (RFC 1951, the same
// algorithm Node's zlib already implements) -- so a correct PNG decoder and
// encoder needs no image-processing dependency at all, only chunk parsing,
// scanline (un)filtering, and CRC32, all implemented below. Deliberately
// SUPPORTS ONLY 8-bit, non-interlaced RGB or RGBA PNGs (colorType 2 or 6,
// bitDepth 8), which covers the overwhelming majority of real photos and
// screenshots; palette, 16-bit, grayscale, and interlaced PNGs are REFUSED
// with a named reason rather than silently mishandled -- same "refuse
// rather than mishandle" discipline as the HEIC refusal above.

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function writePngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function paethPredictor(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

/** Reverses PNG's per-scanline filtering (None/Sub/Up/Average/Paeth, filter
 *  types 0-4). `raw` is the inflated byte stream: one filter-type byte
 *  followed by `width * bpp` filtered bytes, repeated `height` times. */
function unfilterPngScanlines(raw: Buffer, width: number, height: number, bpp: number): Buffer {
  const stride = width * bpp;
  const out = Buffer.alloc(height * stride);
  let rawOffset = 0;
  let prevRowStart = -1;
  for (let y = 0; y < height; y++) {
    const filterType = raw[rawOffset];
    rawOffset += 1;
    const rowStart = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[rowStart + x - bpp] : 0; // left
      const b = prevRowStart >= 0 ? out[prevRowStart + x] : 0; // up
      const c = prevRowStart >= 0 && x >= bpp ? out[prevRowStart + x - bpp] : 0; // upper-left
      const filtered = raw[rawOffset + x];
      let value: number;
      switch (filterType) {
        case 0: value = filtered; break; // None
        case 1: value = (filtered + a) & 0xff; break; // Sub
        case 2: value = (filtered + b) & 0xff; break; // Up
        case 3: value = (filtered + Math.floor((a + b) / 2)) & 0xff; break; // Average
        case 4: value = (filtered + paethPredictor(a, b, c)) & 0xff; break; // Paeth
        default:
          throw new PhotoFormatRefusedError(`unsupported PNG filter type ${filterType}, refusing rather than mishandling`);
      }
      out[rowStart + x] = value;
    }
    rawOffset += stride;
    prevRowStart = rowStart;
  }
  return out;
}

/** `input` must already be signature-checked (isPngSignature) by the
 *  caller. Throws PhotoFormatRefusedError for any PNG variant outside the
 *  supported 8-bit RGB/RGBA, non-interlaced subset -- never guesses. */
function decodePng(input: Buffer): DecodedPixels {
  let offset = 8; // past PNG_SIGNATURE
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  let sawIHDR = false;
  let sawIEND = false;
  const idatChunks: Buffer[] = [];

  while (offset + 8 <= input.length) {
    const len = input.readUInt32BE(offset);
    const type = input.toString('ascii', offset + 4, offset + 8);
    const dataStart = offset + 8;
    if (dataStart + len + 4 > input.length) {
      throw new PhotoFormatRefusedError('malformed PNG: chunk runs past end of buffer, refusing');
    }
    const data = input.subarray(dataStart, dataStart + len);
    offset = dataStart + len + 4; // skip the 4-byte CRC trailer

    if (type === 'IHDR') {
      sawIHDR = true;
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      const compressionMethod = data[10];
      const filterMethod = data[11];
      interlace = data[12];
      if (compressionMethod !== 0 || filterMethod !== 0) {
        throw new PhotoFormatRefusedError('unsupported PNG compression/filter method, refusing rather than mishandling');
      }
    } else if (type === 'IDAT') {
      idatChunks.push(data);
    } else if (type === 'IEND') {
      sawIEND = true;
      break;
    }
    // Every other chunk type (tEXt, iTXt, zTXt, eXIf, iCCP, tIME, ...) is
    // silently skipped here -- not read, not copied, not carried anywhere.
    // This IS the whitelist: only IHDR's geometry and IDAT's pixel data are
    // ever extracted from the input.
  }

  if (!sawIHDR || !sawIEND || idatChunks.length === 0) {
    throw new PhotoFormatRefusedError('malformed PNG: missing IHDR, IDAT, or IEND, refusing');
  }
  if (bitDepth !== 8) {
    throw new PhotoFormatRefusedError(`unsupported PNG bit depth ${bitDepth} -- only 8-bit is supported, refusing rather than mishandling`);
  }
  if (colorType !== 2 && colorType !== 6) {
    throw new PhotoFormatRefusedError(`unsupported PNG color type ${colorType} -- only RGB(2) and RGBA(6) are supported, refusing rather than mishandling`);
  }
  if (interlace !== 0) {
    throw new PhotoFormatRefusedError('interlaced PNG is not supported, refusing rather than mishandling');
  }

  const bpp = colorType === 6 ? 4 : 3;
  const inflated = inflateSync(Buffer.concat(idatChunks));
  const unfiltered = unfilterPngScanlines(inflated, width, height, bpp);

  let rgba: Buffer;
  if (bpp === 4) {
    rgba = unfiltered;
  } else {
    rgba = Buffer.alloc(width * height * 4);
    for (let p = 0; p < width * height; p++) {
      rgba[p * 4] = unfiltered[p * 3];
      rgba[p * 4 + 1] = unfiltered[p * 3 + 1];
      rgba[p * 4 + 2] = unfiltered[p * 3 + 2];
      rgba[p * 4 + 3] = 255;
    }
  }
  return { width, height, rgba };
}

/** Encodes `pixels` as a fresh PNG: signature + IHDR + one IDAT (filter
 *  type None on every scanline, simplest and always correct) + IEND.
 *  NOTHING ELSE IS EVER WRITTEN -- no tEXt, no eXIf, no tIME, no iCCP. This
 *  is the whitelist property enforced structurally: there is no code path
 *  in this function that could emit an ancillary chunk, because none is
 *  ever constructed. */
function encodePng(pixels: DecodedPixels): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(pixels.width, 0);
  ihdr.writeUInt32BE(pixels.height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression method
  ihdr[11] = 0; // filter method
  ihdr[12] = 0; // interlace: none

  const bpp = 4;
  const stride = pixels.width * bpp;
  const filtered = Buffer.alloc(pixels.height * (1 + stride));
  for (let y = 0; y < pixels.height; y++) {
    const rowOut = y * (1 + stride);
    filtered[rowOut] = 0; // filter type: None
    pixels.rgba.copy(filtered, rowOut + 1, y * stride, y * stride + stride);
  }
  const compressed = deflateSync(filtered);

  return Buffer.concat([
    PNG_SIGNATURE,
    writePngChunk('IHDR', ihdr),
    writePngChunk('IDAT', compressed),
    writePngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ─── JPEG/WebP codec: nativeImage-backed (production), injectable (tests) ──
//
// See "WHY nativeImage CANNOT BE UNIT-TESTED HERE" in the file header for
// why this seam exists. Production behavior (inside the real running
// Electron app) needs no override: jpegWebpCodec defaults to
// productionNativeImageCodec below.

interface JpegWebpCodec {
  /** Returns null if the input cannot be decoded (wrong format, corrupt, or
   *  -- in a non-Electron test runtime -- nativeImage genuinely
   *  unavailable). Never throws for "just can't decode this"; that is what
   *  null means, and the caller (deriveCleanPhotoCopy) turns it into a
   *  refusal. */
  decode(input: Buffer): DecodedPixels | null;
  encodeJpeg(pixels: DecodedPixels, quality: number): Buffer;
}

function bgraSwap(buf: Buffer): Buffer {
  // BGRA <-> RGBA is the same byte-swap in both directions (swap bytes 0
  // and 2 of every 4-byte pixel), so one function serves decode and encode.
  const out = Buffer.alloc(buf.length);
  for (let i = 0; i + 3 < buf.length; i += 4) {
    out[i] = buf[i + 2];
    out[i + 1] = buf[i + 1];
    out[i + 2] = buf[i];
    out[i + 3] = buf[i + 3];
  }
  return out;
}

const productionNativeImageCodec: JpegWebpCodec = {
  decode(input) {
    // `nativeImage` is only a working module inside a real running
    // Electron process (see file header) -- this guard makes the
    // non-Electron test runtime fail SAFE (refused) instead of throwing an
    // unrelated "cannot read property of undefined" crash.
    if (!nativeImage) return null;
    const img = nativeImage.createFromBuffer(input);
    if (img.isEmpty()) return null;
    const size = img.getSize();
    if (size.width === 0 || size.height === 0) return null;
    // Electron's NativeImage.toBitmap() is documented as raw BGRA pixel
    // data (Skia's native format). EXIF orientation is applied by Chromium
    // during decode, before this buffer exists -- the tag itself never
    // reaches this function, and this function has no field to carry it in
    // even if it did.
    const bitmap = img.toBitmap();
    return { width: size.width, height: size.height, rgba: bgraSwap(bitmap) };
  },
  encodeJpeg(pixels, quality) {
    if (!nativeImage) {
      throw new PhotoFormatRefusedError(
        'JPEG output requested but no image codec is available in this runtime (nativeImage only ' +
          'functions inside a real running Electron process). This should never happen in the shipped ' +
          'app; if it does, it is a wiring bug, not a format-support gap.'
      );
    }
    const bgra = bgraSwap(pixels.rgba);
    const img = nativeImage.createFromBitmap(bgra, { width: pixels.width, height: pixels.height });
    return img.toJPEG(quality);
  },
};

let jpegWebpCodec: JpegWebpCodec = productionNativeImageCodec;

/** TEST SEAM, NOT A PRODUCTION CONFIGURATION POINT. Exists only because
 *  `nativeImage` cannot run under this repo's `vitest run` unit-test
 *  harness (verified, see file header) -- production code never calls
 *  this. Lets mark_back_store.test.ts prove deriveCleanPhotoCopy()'s
 *  ORCHESTRATION (routing, refuse-on-null, zero-byte-copy-from-input) with
 *  an honest injected double, without pretending to test nativeImage's own
 *  decode correctness. */
export function __setJpegWebpCodecForTesting(codec: JpegWebpCodec): void {
  jpegWebpCodec = codec;
}

export function __resetJpegWebpCodecForTesting(): void {
  jpegWebpCodec = productionNativeImageCodec;
}

// ─── The public entry point ─────────────────────────────────────────────────

/** THE required serve path (RULING 6): decode `input` to raw pixels using
 *  whichever codec recognizes its format, then re-encode those pixels
 *  (alone, nothing else) into a brand-new buffer. Never mutates `input`.
 *  Never touches a file path. Refuses (PhotoFormatRefusedError) rather than
 *  passing through anything it cannot decode, including HEIC/HEIF (no
 *  decoder available, see file header) and anything unrecognized. */
export function deriveCleanPhotoCopy(input: Buffer, options: DeriveCleanPhotoCopyOptions = {}): Buffer {
  if (!Buffer.isBuffer(input) || input.length === 0) {
    throw new PhotoFormatRefusedError('empty or non-buffer input refused');
  }

  if (isHeicOrHeif(input)) {
    throw new PhotoFormatRefusedError(
      'HEIC/HEIF input refused: no HEIC/HEIF decoder is available in this build (see mark_back_store.ts ' +
        'file header, RULING 6, for the two dependency options -- sharp+libheif native, or libheif-js WASM -- ' +
        'awaiting a Founder decision). Refusing outright rather than passing the original through unscrubbed.'
    );
  }

  let pixels: DecodedPixels | null = null;
  if (isPngSignature(input)) {
    pixels = decodePng(input);
  } else if (isJpegSignature(input) || isWebpSignature(input)) {
    pixels = jpegWebpCodec.decode(input);
  }

  if (!pixels) {
    throw new PhotoFormatRefusedError(
      'unrecognized or undecodable image input refused. Accepted inputs: JPEG, PNG, WebP (HEIC/HEIF ' +
        'explicitly refused, see above). A pass-through is exactly the silent leak this replaces.'
    );
  }

  const outputFormat = options.outputFormat ?? 'png';
  if (outputFormat === 'jpeg') {
    return jpegWebpCodec.encodeJpeg(pixels, options.jpegQuality ?? 92);
  }
  return encodePng(pixels);
}

// ─── IPC Registration ─────────────────────────────────────────────────────────

export function registerMarkBackIpc(ipc: typeof ipcMain): void {
  ipc.handle('kitchen-table:cast-mark-back-vote', (_e, data: CastMarkBackVoteInput) => castMarkBackVote(data));
  ipc.handle('kitchen-table:list-mark-back-votes', () => listMarkBackVotes());
  ipc.handle('kitchen-table:list-mark-back-votes-for-recipe', (_e, { recipeId }: { recipeId: string }) =>
    listMarkBackVotesForRecipe(recipeId)
  );
  ipc.handle('kitchen-table:list-mark-back-votes-by-voter', (_e, { voterId }: { voterId: string }) =>
    listMarkBackVotesByVoter(voterId)
  );
  ipc.handle('kitchen-table:tally-mark-back-earnings', (_e, { peerId }: { peerId: string }) =>
    tallyMarkBackEarningsForPeer(peerId)
  );
  ipc.handle('kitchen-table:get-refund-credit-balance', (_e, { peerId }: { peerId: string }) =>
    getRefundCreditBalance(peerId)
  );
  ipc.handle(
    'kitchen-table:redeem-refund-credits',
    (_e, { peerId, recipeId, creditsToRedeem }: { peerId: string; recipeId: string; creditsToRedeem: number }) =>
      redeemRefundCreditsTowardPurchase(peerId, recipeId, creditsToRedeem)
  );
}

// ─── THE INTEGRATION POINT FOR M3 ──────────────────────────────────────────────
//
// Same pattern as cook_events_store.ts: this module is wired as far as this
// SEG can reach on this machine's tree (registerMarkBackIpc(ipcMain) called
// from src/main/index.ts, window.kitchenTable.castMarkBackVote() etc exposed
// from src/main/preload.ts), but no renderer component calls it -- the UI
// call site (a vote button, gated on KITCHEN_TABLE_MARKBACK_ENABLED_ENV_VAR
// being on) is M3's, on whichever tree becomes canonical for the Kitchen
// Table build. Wiring the call site here, on the pre-build baseline, risks
// silently forking a second Kitchen Table implementation, which this
// dispatch's order forbids.
