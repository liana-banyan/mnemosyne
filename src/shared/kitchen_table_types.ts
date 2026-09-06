// Kitchen Table™ shared types — Mnemosyne™ v0.1.8 · SEG-FT-1 · BP052 NOVACULA

// ─── Photo Reference ──────────────────────────────────────────────────────────

export interface PhotoRef {
  id: string;
  localPath: string;
  caption: string | null;
  takenAt: string | null;
}

// ─── Recipe™ types ────────────────────────────────────────────────────────────

/** D-BP166-M0-024 / BISHOP / seg-shared-types-seam: `id` added to close a prior
 *  estate ruling (referenced in this file's sibling `cook_events_store.ts`
 *  header, "the `Ingredient.id` fix") that array position is NOT a safe key --
 *  `RecipesView.tsx` renders ingredients keyed by array index today, which
 *  silently misaligns on any recipe reorder. `id` is REQUIRED, not optional,
 *  so a caller constructing an Ingredient without one is a compile error, not
 *  a silent runtime gap. Existing seed-data literals in `RecipesView.tsx`
 *  were given stable ids in the same dispatch that added this field -- see
 *  that file for the only other in-repo Ingredient object literals. */
export interface Ingredient {
  id: string;
  name: string;
  amount: string;
  unit: string;
  optional: boolean;
}

export interface RecipeStep {
  stepNumber: number;
  instruction: string;
  photoRef: string | null;
  durationMinutes: number | null;
}

export interface Recipe {
  id: string;
  title: string;
  description: string;
  ingredients: Ingredient[];
  steps: RecipeStep[];
  photos: PhotoRef[];
  aiSuggested: boolean;
  authorId: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
}

// ─── Atlas™ scheduling types ──────────────────────────────────────────────────

export type AtlasParticipantStatus = 'invited' | 'accepted' | 'declined' | 'tentative';

export interface AtlasParticipant {
  id: string;
  displayName: string;
  status: AtlasParticipantStatus;
  color: string;
}

export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  interval: number;
  endDate: string | null;
  daysOfWeek: number[];
}

export type MealSlot = 'breakfast' | 'lunch' | 'dinner';

export interface AtlasEvent {
  id: string;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  participants: AtlasParticipant[];
  location: string | null;
  recurrence: RecurrenceRule | null;
  photos: PhotoRef[];
  aiSuggested: boolean;
  p2pSynced: boolean;
  createdAt: string;
  // Phase 2 extensions
  delegate?: string | null;
  mealSlot?: MealSlot | null;
  ingredients?: string[];
}

// ─── Kitchen Table™ session ───────────────────────────────────────────────────

export type KitchenTableSessionStatus = 'planning' | 'confirmed' | 'completed';

export interface KitchenTableSession {
  id: string;
  title: string;
  participants: string[];
  scheduledDate: string | null;
  status: KitchenTableSessionStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Cook Event™ (BP161/BP165, D-BP165-M0-014) ────────────────────────────────
//
// UNLOCK IS A PURCHASE. COOK IS A USE. They are different signals with different
// lifetimes (spec section 4b): payment attaches to the unlock and stops at the
// recipe's earnings cap; attribution (RP/XP) attaches to the cook and NEVER stops.
//
// A CookEvent is an APPEND-ONLY LEDGER ENTRY, never a counter, and it is written
// unconditionally regardless of the recipe's cap/graduation state -- see
// `src/main/kitchen_table/cook_events_store.ts` for the store and the proof that
// the payment path and the attribution path are structurally separate code paths.
//
// DEFINITION OF "ONE COOK", Founder decision NOT silently assumed -- see that
// file's header comment for the full over/under-count honesty statement. In
// short: this module records whatever the caller tells it to record. It is the
// UI's job (M3's, on whatever tree becomes canonical for the Kitchen Table build)
// to decide WHEN to call recordCookEvent -- recommended trigger is an explicit
// "Mark as Cooked" completion action, never opening/viewing a recipe and never a
// mid-cook re-open. The store applies only a narrow anti-double-submit debounce,
// documented in cook_events_store.ts, which the Founder should review.

/** Mirrors section 3's `acquisitionPath` on the unlock record, so a cook's copy
 *  can be traced back to how it was acquired. `graduated-commons` is added here
 *  (not present on the unlock record) because a recipe cooked AFTER it graduated
 *  (section 4) was never unlocked by this cook at all -- it was free from the
 *  commons, and the flow-through must say so rather than lying with a stale path. */
export type CookEventAcquisitionPath =
  | 'direct-menu'
  | 'subscription-package'
  | 'share'
  | 'graduated-commons';

export interface CookEvent {
  /** Ledger entry id. Never reused, never looked up as a foreign key by anything
   *  that would let a later write silently replace this one. */
  id: string;
  /** What was cooked. */
  recipeId: string;
  /** Payee/maker of record AT COOK TIME, denormalized onto the event for the same
   *  reason section 3 denormalizes `authorId` onto the unlock record and
   *  `authorTierAtSale` onto the sale: so a later change (recipe edited,
   *  reassigned, even deleted) can never rewrite what a past cook attributed. */
  authorId: string;
  /** Peer id of whoever cooked it. NEVER a real name, NEVER any demographic
   *  field (Structural Privacy Bylaw) -- a cook event records a recipe, a peer,
   *  a time, and a provenance link, nothing about a person. */
  cookedBy: string;
  /** ISO timestamp. Set once at write time, never rewritten. */
  cookedAt: string;
  /** How THIS cook's copy was acquired. Null only for a cook whose acquisition
   *  is genuinely unknown (e.g. back-filled from data written before this
   *  module existed) -- never null by omission for a new write. */
  acquisitionPath: CookEventAcquisitionPath | null;
  /** Set when and only when acquisitionPath is 'share' -- mirrors section 3's
   *  rule exactly, so the referral flow-through survives into the use record. */
  referrerPeerId: string | null;
  /** FK to the unlock-record id (section 3) this cook's copy traces to, when
   *  known. This is the flow-through-to-sources link the Founder named as the
   *  reason forgeries are structurally impossible: a cook event that cannot
   *  name its source breaks the chain. Null for a cooked-from-commons copy that
   *  was never unlocked (see acquisitionPath = 'graduated-commons'). */
  sourceUnlockId: string | null;
  /** Was the recipe already graduated (earnings cap reached) at cook time?
   *  Recorded as a fact for audit context ONLY. This field is NEVER read by
   *  recordCookEvent() to decide whether to write the event -- see
   *  cook_events_store.ts for the structural proof that the attribution path
   *  cannot be gated by cap state. */
  graduated: boolean;
  /** Guild multiplier in effect for the author AT COOK TIME (1 or 2, section
   *  4a/10). Recorded on the event, never looked up later, same reasoning as
   *  `guildId`/`guildMultiplier` on the sale record: a maker's guild membership
   *  changing later must never rewrite what a past cook earned in standing. */
  guildMultiplierAtCook: 1 | 2;
}

// ─── Mark-Back Vote™ (BP165, D-BP165-M0-017, Phase Two of D-BP165-M0-014) ─────
//
// THE RULE IS "HOST A COPY, GET COMPENSATED", NEVER "POST A PICTURE, GET A
// REWARD." Founder ruling, BP165, verbatim framing carried into every comment
// that touches this mechanic. The member is compensated for HOSTING and
// SEEDING a provenance-bearing copy of a dish photo on their own machine --
// not for the photo existing. IT DECIDES EVERY EDGE CASE: if they stop
// hosting, the compensation stops. See src/main/kitchen_table/mark_back_store.ts
// for the store, the gate enforcement, and the transfer-never-mint proof.
//
// A VOTE COSTS EXACTLY TWO WHOLE MARKS, SPLIT ONE TO THE HOST (the member
// whose copy was cooked and voted on) AND ONE TO THE RECIPE'S AUTHOR. Never
// fractional -- marksToCook and marksToAuthor below are typed as the literal
// `1`, not `number`, so a fractional value is a TypeScript compile error, not
// just a runtime bug. See mark_back_store.ts for the full structural proof.

/** A ledger entry recording ONE vote and the marks transfer it caused.
 *  Append-only -- same Federal Body Cam doctrine as CookEvent and the
 *  estate's IP ledger (src/main/ip_ledger/ip_ledger_store.ts): a vote is
 *  recorded, never updated, never deleted. */
export interface MarkBackVoteEvent {
  /** Ledger entry id. Never reused. */
  id: string;
  /** The recipe being voted on. */
  recipeId: string;
  /** The recipe's author -- receives one whole mark. Denormalized onto the
   *  event for the same reason CookEvent.authorId is: a later reassignment
   *  of the recipe must never rewrite what a past vote paid. */
  authorId: string;
  /** The member HOSTING the provenance-bearing copy that was cooked and is
   *  being voted on -- receives one whole mark for hosting it. NEVER a real
   *  name (Structural Privacy Bylaw). This is the "host a copy" side of the
   *  rule; it is deliberately not named `cookedBy` to avoid confusion with
   *  CookEvent.cookedBy, which records the VOTER's own qualifying cook, a
   *  different peer in the general case. */
  hostPeerId: string;
  /** FK to the CookEvent proving the VOTER (not the host) actually cooked
   *  recipeId. A vote with no qualifying cook event cannot be recorded --
   *  see mark_back_store.ts castMarkBackVote(). This is the core anti-ring
   *  constraint named in the BP165 ruling. */
  qualifyingCookEventId: string;
  /** Peer id of whoever cast the vote and paid the 2 marks. NEVER a real
   *  name (Structural Privacy Bylaw). */
  voterId: string;
  /** SERVER RECEIPT TIME, never EXIF, never client-supplied wall-clock.
   *  Founder ruling: EXIF is trivially editable (worthless as proof) and
   *  carries GPS (a liability as data) -- the same reasoning this module
   *  applies to its own vote timestamp, so daily-cap and reciprocal-window
   *  math can never be gamed by a spoofed client clock. Set once, never
   *  rewritten. */
  votedAt: string;
  /** Always 1. A named field, not an inlined literal, so an audit query
   *  never has to re-derive the split from MARK_BACK_VOTE_COST_MARKS.
   *  Typed as the literal `1`: assigning a fractional value here is a
   *  compile error. */
  marksToCook: 1;
  /** Always 1. This is the ANTI-COLLUSION TAX and that is its stated
   *  purpose (see mark_back_store.ts) -- never "optimize" it toward
   *  marksToCook. Typed as the literal `1` for the same compile-time
   *  reason as marksToCook. */
  marksToAuthor: 1;
  /** Always 2 = marksToCook + marksToAuthor, typed as the literal `2`.
   *  Computed, never independently set, so this field can never drift from
   *  the split that actually ran. A vote TRANSFERS marks; it never mints
   *  them -- see mark_back_store.ts for the conservation proof. */
  totalMarksTransferred: 2;
  /** Recipe price in marks AT THE TIME OF THIS VOTE, used only to select
   *  which vote-window tier applied (see mark_back_store.ts's
   *  voteWindowDaysForRecipePrice()). Recorded on the event, never looked
   *  up later -- same reasoning as guildMultiplierAtCook (BP161 4a): a
   *  price change after the fact must never rewrite which window governed
   *  a past vote. */
  recipePriceMarksAtVote: number;
  /** SERVER RECEIPT TIME of when the HOST's photo/copy was posted. The vote
   *  window (voteWindowDaysApplied) is anchored HERE, not at the qualifying
   *  cook event -- Founder ruling, BP165, verbatim: "the clock starts when
   *  the photo is posted, because that is the moment voting becomes
   *  possible." NEVER EXIF, always server receipt time, same reasoning as
   *  votedAt above. */
  photoPostedAt: string;
  /** The vote-window length actually applied to this vote, in days.
   *  Recorded, never re-derived later -- the ladder
   *  (voteWindowDaysForRecipePrice() in mark_back_store.ts) is Founder-
   *  tunable and may change after this vote was cast; this field freezes
   *  what governed THIS vote, same doctrine as authorTierAtSale (BP161 §3)
   *  and guildMultiplierAtCook. */
  voteWindowDaysApplied: number;
}

// ─── Mark-Back Participation Refund Credit (BP165, ruled) ─────────────────
//
// Founder ruling, BP165, verbatim: "You get your votes back if you
// participate enough. Participation means more than money." RULED as a
// NON-TRANSFERABLE, NON-SPENDABLE-ON-VOTES purchase credit, never a
// spendable mark. See mark_back_store.ts for the anti-collusion arithmetic
// this exists to protect: a plain 50% MARK refund would exactly cancel the
// 50% anti-collusion tax (see MarkBackVoteEvent.marksToAuthor above) and
// make ring-farming free; a non-spendable PURCHASE-PRICE credit does not,
// because the ring still bleeds a real spendable mark to the author every
// cycle even though the voter's next recipe purchase gets cheaper.

export interface MarkBackRefundCreditEntry {
  /** Ledger entry id. */
  id: string;
  /** Whose credit this is. Credits are PER PEER and NEVER move between
   *  peers -- no function in mark_back_store.ts accepts a destination peer
   *  for a credit; that is what makes it non-transferable, structurally,
   *  by absence rather than by a check that could be bypassed. */
  peerId: string;
  kind: 'issued' | 'redeemed';
  /** Always 1 -- one credit per vote cast, matching HALF the 2-mark vote
   *  cost. Typed as the literal `1` for the same compile-time reason as
   *  MarkBackVoteEvent.marksToCook/marksToAuthor: a fractional value here
   *  is a TypeScript compile error, not a runtime bug. */
  amount: 1;
  /** Set, to the vote that earned it, when kind === 'issued'. Null when
   *  kind === 'redeemed'. */
  sourceVoteEventId: string | null;
  /** Set, to the recipe purchase it discounted, when kind === 'redeemed'.
   *  Null when kind === 'issued'. A credit can ONLY reduce a recipe
   *  purchase price -- it can never fund a vote and is never converted
   *  into a spendable mark; see mark_back_store.ts, no such conversion
   *  function exists anywhere in this file. */
  redeemedForRecipeId: string | null;
  /** Server receipt time. */
  at: string;
}

// ─── P2P Discovery types ──────────────────────────────────────────────────────

export type P2PTrustLevel = 'unknown' | 'verified' | 'trusted';

export interface P2PDiscoveryPeer {
  peerId: string;
  displayName: string;
  lastSeen: string;
  capabilities: string[];
  trustLevel: P2PTrustLevel;
}

// ─── Store interface ──────────────────────────────────────────────────────────

export interface KitchenTableStore {
  // Kitchen Table™ sessions
  listSessions(): Promise<KitchenTableSession[]>;
  getSession(id: string): Promise<KitchenTableSession | null>;
  createSession(data: Omit<KitchenTableSession, 'id' | 'createdAt' | 'updatedAt'>): Promise<KitchenTableSession>;
  updateSession(id: string, data: Partial<KitchenTableSession>): Promise<KitchenTableSession | null>;
  deleteSession(id: string): Promise<boolean>;

  // Recipes™
  listRecipes(): Promise<Recipe[]>;
  getRecipe(id: string): Promise<Recipe | null>;
  createRecipe(data: Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'>): Promise<Recipe>;
  updateRecipe(id: string, data: Partial<Recipe>): Promise<Recipe | null>;
  deleteRecipe(id: string): Promise<boolean>;

  // Atlas™ events
  listAtlasEvents(): Promise<AtlasEvent[]>;
  getAtlasEvent(id: string): Promise<AtlasEvent | null>;
  createAtlasEvent(data: Omit<AtlasEvent, 'id' | 'createdAt'>): Promise<AtlasEvent>;
  updateAtlasEvent(id: string, data: Partial<AtlasEvent>): Promise<AtlasEvent | null>;
  deleteAtlasEvent(id: string): Promise<boolean>;

  // Cook Events™ (BP161/BP165) -- append-only, no update/delete method exists
  // on purpose: a ledger entry is written once and never mutated or removed.
  recordCookEvent(data: Omit<CookEvent, 'id' | 'cookedAt'> & { cookedAt?: string }): Promise<CookEvent>;
  listCookEvents(): Promise<CookEvent[]>;
  listCookEventsForRecipe(recipeId: string): Promise<CookEvent[]>;
  listCookEventsForAuthor(authorId: string): Promise<CookEvent[]>;
}
