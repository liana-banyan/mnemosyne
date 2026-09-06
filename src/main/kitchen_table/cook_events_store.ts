// Cook Event™ ledger — D-BP165-M0-014/BISHOP-M0/build-the-cook-event-recording
//
// WHY THIS FILE EXISTS (spec: BISHOP_DROPZONE/KITCHEN_TABLE/
// SPEC_RECIPE_PROVENANCE_REFERRAL_AND_GRADUATION_BP161.md, sections 3, 4, 4a, 4b, 6).
//
// Founder ruling, section 4b, verbatim: "reputation and XP keep accruing for a
// recipe every time it is used, permanently, long after payments have stopped."
// The spec's own flagged consequence: "the app must record a COOK event, not just
// an unlock. Unlock is a purchase; cooking is use. ... If cook events are not
// recorded from the start, perpetual reputation has nothing to accrue from and
// this ruling silently becomes unimplementable."
//
// UNLOCK IS A PURCHASE. COOK IS A USE. THEY ARE DIFFERENT EVENTS WITH DIFFERENT
// LIFETIMES. Payment attaches to the unlock and stops at the cap. Attribution
// attaches to the cook and NEVER stops. This file contains NO payment code, NO
// concept of priceMarks, and NO branch that can refuse to write an event because
// a cap was reached -- see "THE TWO CODE PATHS" below for the structural proof.
//
// ─── WHERE THIS LIVES, AND WHY (LAW 1: A NEGATIVE MUST NAME ITS SCOPE) ─────────
//
// The Founder's order for this dispatch warned that BISHOP-M3's live Kitchen
// Table build lives on a branch named `bp126-mnemosynec-surface-rewire`, pushed
// from BISHOP-M3's own machine (TERENO), and told this SEG to verify where that
// branch actually is before writing code. VERIFIED, this session:
//   - `git branch -a` in this machine's mnemosyne clone
//     (C:\Users\Administrator\Documents\mnemosyne): no branch or ref named
//     `bp126` or `kitchen` anywhere, local or remote (`origin` =
//     github.com/liana-banyan/mnemosyne, `backup` = D:/VaultMirror/mnemosyne.git).
//   - `gh api repos/Upekrithen/mnemosyne/branches`: only `main`. No `bp126`
//     branch on the fork the M3 canoe named as the PR route.
//   - `gh api repos/liana-banyan/mnemosyne/branches` and `gh pr list`: no
//     `bp126` branch, no open or closed PRs at all.
//   So `bp126-mnemosynec-surface-rewire` -- the tree carrying BISHOP-M3's
//   widened `onScheduleMeal` seam, the `Ingredient.id` fix, and the
//   `KitchenTableSession` wiring -- is UNREACHABLE from this machine and
//   unreachable via GitHub. That is the scope of the negative: this SEG could
//   not find that branch, on this machine or on GitHub, as of this dispatch.
//
// SEPARATELY, and this corrects a near-error the Founder's order itself warned
// about: this machine's clone is NOT empty of Kitchen Table code. On branch
// `clean-shell-v0.9` (git-tracked, not a stray build artifact), the PRE-BP161
// baseline Kitchen Table surface is present and real: `TheKitchenTab.tsx`,
// `KitchenTableView.tsx`, `RecipesView.tsx`, `AtlasView.tsx`, and this file's
// sibling `kitchen_table_store.ts` with a working main-process JSON store,
// IPC registration (`registerKitchenTableIpc`, called from `src/main/index.ts`),
// and a `preload.ts` bridge exposing `window.kitchenTable.*` to the renderer.
// `Ingredient` on this branch still lacks `id`, and `onScheduleMeal` still
// carries only a title string -- exactly the PRE-BUILD state the spec's
// prerequisite section describes, confirming this is the base BISHOP-M3's
// bp126 branch was built FROM, not a dead or unrelated tree.
//
// DECISION: this module is written as a standalone, importable, exported unit
// (no dependency on Ingredient.id, on a widened onScheduleMeal, or on
// KitchenTableSession being wired) so it drops into EITHER this base tree or
// the eventual bp126 merge with the same integration point. It is ALSO wired
// into this repo's real, live IPC/preload surface below, because "when you
// build it, you wire it" and this tree's store is genuinely live -- not a
// second Kitchen Table implementation, a sibling ledger next to the existing
// one, following its exact file-persistence pattern. The UI CALL SITE (the
// button/action that invokes `window.kitchenTable.recordCookEvent(...)`) is
// deliberately NOT added here -- see "THE INTEGRATION POINT FOR M3" at the
// bottom of this file for exactly what M3 wires and why that part is M3's.
//
// ─── LEDGER FORMAT: JSONL, APPEND-ONLY, MATCHES EXISTING ESTATE DOCTRINE ──────
//
// `src/main/kitchen_table/kitchen_table_store.ts` stores mutable CRUD entities
// (sessions/recipes/atlas events) as a JSON array rewritten whole on every
// write -- correct for that data, wrong for a ledger. `src/main/ip_ledger/
// ip_ledger_store.ts` already establishes the estate's append-only pattern for
// exactly this shape of problem ("Federal Body Cam doctrine: entries are ALWAYS
// recorded, NEVER updated, NEVER deleted"). This file follows that doctrine,
// not the CRUD file's, and stores to its OWN file
// (`kitchen_table_cook_events.jsonl`) rather than folding into
// `kitchen_table_data.json`, so this write can never race or schema-collide
// with the CRUD store or with whatever bp126 lands on `kitchen_table_data.json`
// when it merges.
//
// ─── THE TWO CODE PATHS (constraint 3 of this dispatch) ───────────────────────
//
// recordCookEvent() below has no import, no reference, and no awareness of any
// payment/earnings-cap/marks concept. It cannot gate a write on cap state
// because it has no code path that reads cap state to decide whether to write.
// The `graduated` and `guildMultiplierAtCook` fields are RECORDED, never
// CONSULTED by this module -- they are payload, not control flow. Proof this
// holds even for a recipe already at its cap is in
// cook_events_store.test.ts ("attribution survives graduation independently of
// payment").
//
// ─── DEFINITION OF "ONE COOK" (constraint 4, Founder decision NOT assumed) ────
//
// This module does not decide what counts as "cooking" a recipe. It records
// whatever event the caller tells it to record, when the caller calls
// recordCookEvent(). RECOMMENDED (not enforced) trigger for the eventual UI:
// an explicit "Mark as Cooked" / cook-completion action, distinct from opening
// a recipe (not cooking it) and distinct from re-opening mid-cook (not a second
// cook). That choice belongs to whoever wires the UI (M3, on the canonical
// tree) and should be confirmed with the Founder before shipping, because it
// inflates or deflates every maker's reputation forever once shipped.
//
// The one piece of policy THIS module does enforce, stated plainly so it is
// never mistaken for the "what counts as a cook" decision above:
//
//   COOK_DEDUPE_WINDOW_MS (below) rejects a second recordCookEvent() for the
//   same (recipeId, cookedBy) pair inside a short window. This exists ONLY as
//   an anti-double-submit guard -- protecting against a UI double-click or a
//   component re-render firing the handler twice -- because this ledger is
//   append-only and feeds a PERMANENT reputation number (section 4b): a
//   duplicate-submit bug here has no undo.
//
//   OVER-COUNTS: nothing. The dedupe window can only suppress a write, never
//   duplicate one.
//   UNDER-COUNTS: a legitimate second cook of the SAME recipe by the SAME
//   cook within the window (e.g. two batches prepped back-to-back) is
//   silently dropped. It does NOT under-count across days, weeks, or distinct
//   cooks -- cooking the same recipe once a day for a week records 7 events.
//   The default (5 minutes) is a guess sized to catch double-taps, not a
//   considered per-day/per-week cook-counting policy -- THE FOUNDER SHOULD
//   RULE ON THE WINDOW, or on removing it in favor of a UI-level debounce
//   instead, before this ships to real makers.

import { app, ipcMain } from 'electron';
import { join } from 'path';
import { existsSync, readFileSync, appendFileSync, mkdirSync } from 'fs';
import { randomUUID } from 'crypto';
import type { CookEvent, CookEventAcquisitionPath } from '../../shared/kitchen_table_types';

// ─── Storage ──────────────────────────────────────────────────────────────────

function getLedgerPath(): string {
  return join(app.getPath('userData'), 'kitchen_table_cook_events.jsonl');
}

function ensureLedgerDir(): void {
  const dir = join(getLedgerPath(), '..');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

/** Read every entry, oldest first. Malformed lines are skipped, not thrown on --
 *  a torn write (crash mid-append) must never take down the whole ledger read,
 *  matching ip_ledger_store.ts's tamper/corruption handling. */
function loadAllCookEvents(): CookEvent[] {
  const path = getLedgerPath();
  if (!existsSync(path)) return [];
  const raw = readFileSync(path, 'utf-8');
  const events: CookEvent[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      events.push(JSON.parse(trimmed) as CookEvent);
    } catch {
      console.warn('[cook_events_store] malformed ledger line skipped');
    }
  }
  return events;
}

/** Append one entry. No update, no delete function exists in this file, on
 *  purpose -- see the file header. */
function appendCookEvent(event: CookEvent): void {
  ensureLedgerDir();
  appendFileSync(getLedgerPath(), JSON.stringify(event) + '\n', 'utf-8');
}

// ─── Anti-double-submit dedupe (see file header; NOT a "one cook per day" rule) ─

/** 5 minutes. Sized to catch a double-click / re-render double-fire, not to
 *  express any considered policy about how often a person may legitimately
 *  cook the same dish. FOUNDER DECISION OPEN: keep this value, change it, or
 *  remove server-side dedupe entirely in favor of a UI-level guard. */
export const COOK_DEDUPE_WINDOW_MS = 5 * 60 * 1000;

function isWithinDedupeWindow(existing: CookEvent[], recipeId: string, cookedBy: string, atIso: string): boolean {
  const atMs = Date.parse(atIso);
  return existing.some((e) => {
    if (e.recipeId !== recipeId || e.cookedBy !== cookedBy) return false;
    const deltaMs = Math.abs(atMs - Date.parse(e.cookedAt));
    return deltaMs < COOK_DEDUPE_WINDOW_MS;
  });
}

// ─── Public API ─────────────────────────────────────────────────────────────

export interface RecordCookEventInput {
  recipeId: string;
  authorId: string;
  cookedBy: string;
  /** Defaults to now() if omitted -- pass explicitly only for backfill/replay. */
  cookedAt?: string;
  acquisitionPath: CookEventAcquisitionPath | null;
  referrerPeerId: string | null;
  sourceUnlockId: string | null;
  graduated: boolean;
  guildMultiplierAtCook: 1 | 2;
}

/** The single write path for this ledger. Unconditional: there is no argument
 *  to this function and no branch inside it that can refuse to write because a
 *  recipe's earnings cap was reached. `graduated` is stored, never read here. */
export function recordCookEvent(input: RecordCookEventInput): CookEvent {
  const cookedAt = input.cookedAt ?? new Date().toISOString();
  const existing = loadAllCookEvents();

  if (isWithinDedupeWindow(existing, input.recipeId, input.cookedBy, cookedAt)) {
    // Anti-double-submit guard only (see file header). Returns the prior event
    // rather than throwing, so a UI double-fire is inert instead of an error
    // the caller must handle.
    const prior = existing
      .filter((e) => e.recipeId === input.recipeId && e.cookedBy === input.cookedBy)
      .sort((a, b) => Date.parse(b.cookedAt) - Date.parse(a.cookedAt))[0];
    return prior;
  }

  const event: CookEvent = {
    id: randomUUID(),
    recipeId: input.recipeId,
    authorId: input.authorId,
    cookedBy: input.cookedBy,
    cookedAt,
    acquisitionPath: input.acquisitionPath,
    referrerPeerId: input.referrerPeerId,
    sourceUnlockId: input.sourceUnlockId,
    graduated: input.graduated,
    guildMultiplierAtCook: input.guildMultiplierAtCook,
  };
  appendCookEvent(event);
  return event;
}

export function listCookEvents(): CookEvent[] {
  return loadAllCookEvents();
}

export function listCookEventsForRecipe(recipeId: string): CookEvent[] {
  return loadAllCookEvents().filter((e) => e.recipeId === recipeId);
}

export function listCookEventsForAuthor(authorId: string): CookEvent[] {
  return loadAllCookEvents().filter((e) => e.authorId === authorId);
}

// D-BP165-M0-017 / Phase Two addition (extends this file, does not rewrite
// it -- see that dispatch's header). Needed by mark_back_store.ts to check
// two BP165 gates that read across a PEER's own cook history rather than one
// recipe's or one author's: "10 recipes cooked before mark-back unlocks" and
// "a voter must have cooked that same recipe." Pure addition: no existing
// export's signature or behavior changes, so cook_events_store.test.ts's 9
// tests are unaffected by construction.
export function listCookEventsByCooker(cookedBy: string): CookEvent[] {
  return loadAllCookEvents().filter((e) => e.cookedBy === cookedBy);
}

/** Pure aggregator proving the attribution path is independent of cap state:
 *  it sums every event's guildMultiplierAtCook as its RP/XP contribution and
 *  does NOT read, branch on, or exclude by `graduated` anywhere in this
 *  function. A recipe's cap has no representation in this computation at all. */
export function tallyRpXpForAuthor(authorId: string): number {
  return listCookEventsForAuthor(authorId).reduce((sum, e) => sum + e.guildMultiplierAtCook, 0);
}

// ─── IPC Registration ─────────────────────────────────────────────────────────

export function registerCookEventIpc(ipc: typeof ipcMain): void {
  ipc.handle('kitchen-table:record-cook-event', (_e, data: RecordCookEventInput) => recordCookEvent(data));
  ipc.handle('kitchen-table:list-cook-events', () => listCookEvents());
  ipc.handle('kitchen-table:list-cook-events-for-recipe', (_e, { recipeId }: { recipeId: string }) =>
    listCookEventsForRecipe(recipeId)
  );
  ipc.handle('kitchen-table:list-cook-events-for-author', (_e, { authorId }: { authorId: string }) =>
    listCookEventsForAuthor(authorId)
  );
  // D-BP165-M0-017 / Phase Two addition -- see listCookEventsByCooker() above.
  ipc.handle('kitchen-table:list-cook-events-by-cooker', (_e, { cookedBy }: { cookedBy: string }) =>
    listCookEventsByCooker(cookedBy)
  );
}

// ─── THE INTEGRATION POINT FOR M3 ──────────────────────────────────────────────
//
// This module is wired as far as this SEG can reach on this machine's tree:
//   1. `registerCookEventIpc(ipcMain)` is called from `src/main/index.ts`,
//      alongside the existing `registerKitchenTableIpc(ipcMain)` call.
//   2. `window.kitchenTable.recordCookEvent(...)` /
//      `listCookEvents()` / `listCookEventsForRecipe()` /
//      `listCookEventsForAuthor()` are exposed from `src/main/preload.ts`,
//      alongside the existing `window.kitchenTable.*` bridge.
//
// WHAT IS NOT WIRED, AND WHY IT IS M3'S: no renderer component calls
// `window.kitchenTable.recordCookEvent(...)`. That call site is a UI decision
// (which action means "cooked", per the open definition question above) AND it
// belongs on whichever tree becomes the canonical Kitchen Table build --
// currently `bp126-mnemosynec-surface-rewire`, unreachable from this machine
// (see the file header). Wiring the call site here, on the pre-build baseline,
// risks silently forking a second Kitchen Table implementation, which this
// dispatch's order explicitly forbids.
//
// EXACT CALL FOR M3 TO ADD, wherever the UI marks a recipe cooked:
//
//   const event = await window.kitchenTable.recordCookEvent({
//     recipeId: recipe.id,
//     authorId: recipe.authorId,
//     cookedBy: myPeerId,                       // never a real name
//     acquisitionPath: howThisCopyWasAcquired,   // carry forward from the unlock
//                                                 // record (section 3) that
//                                                 // unlocked this recipe, or
//                                                 // 'graduated-commons' if it
//                                                 // was never unlocked
//     referrerPeerId: theReferrerIfAny,          // mirror the unlock record's
//                                                 // referrerPeerId verbatim
//     sourceUnlockId: theUnlockRecordId,         // null if cooked from commons
//     graduated: recipe.isGraduated,             // whatever the cap/graduation
//                                                 // module currently reports
//     guildMultiplierAtCook: currentGuildMultiplier(recipe.authorId), // 1 or 2
//   });
//
// The `acquisitionPath`/`referrerPeerId`/`sourceUnlockId` triad should be read
// off the UNLOCK RECORD for this (recipeId, cookedBy) pair, not re-derived --
// that is the flow-through-to-sources the Founder named as what makes
// forgeries structurally impossible. If no unlock record exists because the
// recipe graduated before this cook, use `'graduated-commons'` / `null` /
// `null` rather than guessing.
