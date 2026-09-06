// slot_registry.ts -- D-BP165-M0-036/BISHOP/M0/seg-swappable-brains-slot-registry
//
// FOUNDER'S ORDER, VERBATIM (D-BP165-M0-036): "I want the live socket. Because that is how we
// make the swappable brains for MnmosyneC as well. each AI that I have, or want to have, can
// have a slot, and I can assign whichever to whatever I as user want, in MnemosyneC."
//
// PHASE-ONE INVENTORY FINDING (this dispatch, LAW 4 "ask the vault first" honored): the single-
// active-brain swap mechanism this order describes ALREADY EXISTS, BUILT AND WIRED, end to end:
//   - ./brain_registry.ts -- BrainEntry catalog + persisted active_brain_id (BP087/BP134/BP135)
//   - ai_dispatch_ipc.ts:2222-2280 -- brain-registry:list / :get-active / :set-active / :smoke-test
//   - preload.ts:1525 -- window.mnemo.brainRegistry.* bridge
//   - renderer/components/BrainSwapSelector.tsx -- mounted in LeanAskTab.tsx
//   - openai_compat_server.ts (THE NEXUS) -- resolveBrain() ALREADY accepts a per-request `model`
//     field naming any brain_id/model_id in the registry, so "assign whichever brain to whatever
//     call" already works at the API layer, not just as one global default.
//   - shared/plow/browser_authority_types.ts -- BrowserAuthorityName ('user_google' |
//     'user_perplexity' | 'user_claude' | 'user_chatgpt' | 'user_gemini'), already wired end to
//     end (index.ts's 'nexus-browser-authority-run-query' handler -> webview_preload.ts's
//     'browser-authority-run-query' listener) -- five more brains already answerable on demand.
//
// WHAT THIS FILE ADDS, AND ONLY THIS: brain_registry.ts persists exactly ONE "active_brain_id" --
// a single global slot. The Founder's order describes MULTIPLE slots ("each AI... can have a
// slot"): the user should be able to name more than one slot (e.g. one per role, one per node,
// one per demand type) and assign a DIFFERENT brain to each, independently, all persisted at
// once. That multi-slot layer does not exist anywhere in this repo (searched: grep for
// slotRegistry|slot_registry|brainSlot|brain_slot|modelSlot|model_slot|slotAssignment across
// mnemosyne/src and LianaBanyanPlatform, zero hits before this file).
//
// REUSE, NOT REBUILD: every brain a slot can point at is resolved through mechanisms that already
// exist and are already wired -- brain_registry.ts's catalog (routed through THE NEXUS, itself
// already live on 127.0.0.1:11535) for local Ollama / Anthropic-flagship brains, and
// browser_authority_types.ts's BrowserAuthorityName for the five browser-authority brains. This
// file does not open a socket, does not start a server, does not add a second dispatcher -- it is
// a persisted NAME -> BRAIN-REFERENCE map, nothing else.
//
// Persistence pattern: identical convention to brain_registry.ts and ollama_model/model_picker.ts
// (Node fs + app.getPath('userData'), a plain JSON file). Not invented for this file.
//
// No em-dashes. Full absolute paths in comments (BP076). American spelling. Additive only.

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';
import { getBrainRegistry, type BrainEntry } from './brain_registry';
import type { BrowserAuthorityName } from '../../shared/plow/browser_authority_types';
import { ENSEMBLE_AUTHORITY_KEYS } from '../../shared/plow/browser_authority_types';

// ─── Types ──────────────────────────────────────────────────────────────────────────────────

/**
 * A slot points at exactly one of the two brain-resolution mechanisms this repo already has:
 *   - 'nexus': a brain_id/model_id resolvable by brain_registry.ts's own catalog, reachable
 *     through THE NEXUS's existing resolveBrain(requestedModel) -- covers every local Ollama
 *     model and every Anthropic-flagship model already registered there.
 *   - 'browser-authority': one of the five already-wired BrowserAuthorityName values, reachable
 *     through index.ts's existing 'nexus-browser-authority-run-query' IPC handler.
 * This union is exhaustive over every brain this repo can currently answer through -- adding a
 * third mechanism later (a genuinely new dispatch path) is a one-line addition here, not a
 * redesign, mirroring browser_authority_types.ts's own "isInteractiveBrowserAuthority... a
 * one-line change" precedent.
 */
export type SlotBrainRef =
  | { mechanism: 'nexus'; brain_id: string }
  | { mechanism: 'browser-authority'; authority: BrowserAuthorityName };

export interface SlotDefinition {
  slot_name: string;
  brain: SlotBrainRef | null;
  /** Free-text label the user gives the slot at assignment time, e.g. "coding", "research arm
   *  M0", "research arm M3". Never inferred or defaulted -- absent until the user sets one. */
  label?: string;
  updated_at: string; // ISO8601, set on every assignSlot() call
}

interface SlotRegistryStore {
  storeVersion: 1;
  slots: SlotDefinition[];
}

const STORE_FILENAME = 'slot_registry.json';

function getStorePath(): string {
  return join(app.getPath('userData'), STORE_FILENAME);
}

function readStore(): SlotRegistryStore {
  const filePath = getStorePath();
  if (existsSync(filePath)) {
    try {
      const raw = readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<SlotRegistryStore>;
      if (Array.isArray(parsed.slots)) {
        return { storeVersion: 1, slots: parsed.slots };
      }
    } catch {
      // Fall through to an empty store if the file is corrupt -- never fabricate slot content.
    }
  }
  // Deliberately empty on first run. Per the Founder's own "make the free version the default"
  // precedent for brain_registry.ts (BP134 Task D), this file does not invent a taxonomy of
  // default slot names the user never asked for -- the user names their own slots.
  return { storeVersion: 1, slots: [] };
}

function writeStore(store: SlotRegistryStore): void {
  const userDataDir = app.getPath('userData');
  mkdirSync(userDataDir, { recursive: true });
  writeFileSync(getStorePath(), JSON.stringify(store, null, 2), 'utf8');
}

// ─── Available-brain catalog (read-only merge of two already-existing sources) ────────────────

export interface AvailableBrainsCatalog {
  /** Every brain reachable through THE NEXUS's resolveBrain(), i.e. brain_registry.ts's own
   *  getBrainRegistry() output, unmodified. Never copied or re-derived -- the SAME array. */
  nexusBrains: BrainEntry[];
  /** Every browser authority already wired end to end, minus 'specialist_swarm' (not a brain --
   *  see browser_authority_types.ts's own EnsembleAuthorityKey comment: "specialist_swarm is not
   *  a BrowserAuthorityName, it never touches a webview"). */
  browserAuthorities: BrowserAuthorityName[];
}

export function listAvailableBrains(): AvailableBrainsCatalog {
  return {
    nexusBrains: getBrainRegistry(),
    browserAuthorities: ENSEMBLE_AUTHORITY_KEYS.filter(
      (k): k is BrowserAuthorityName => k !== 'specialist_swarm',
    ),
  };
}

// ─── Slot CRUD ──────────────────────────────────────────────────────────────────────────────

export function listSlots(): SlotDefinition[] {
  return readStore().slots;
}

export function getSlot(slot_name: string): SlotDefinition | undefined {
  return readStore().slots.find((s) => s.slot_name === slot_name);
}

/**
 * Validates the brain reference against the SAME two catalogs listAvailableBrains() reads --
 * never persists a slot pointed at a brain_id or authority that does not actually exist, per this
 * estate's "never fake a result" discipline (browser_authority_types.ts's own HONESTY FIREWALL
 * comment, applied here to slot assignment).
 */
function validateBrainRef(ref: SlotBrainRef): { ok: true } | { ok: false; reason: string } {
  const catalog = listAvailableBrains();
  if (ref.mechanism === 'nexus') {
    const known = catalog.nexusBrains.some((b) => b.brain_id === ref.brain_id || b.model_id === ref.brain_id);
    if (!known) {
      return { ok: false, reason: `unknown nexus brain_id/model_id "${ref.brain_id}" -- not present in brain_registry.ts's catalog` };
    }
    return { ok: true };
  }
  const known = catalog.browserAuthorities.includes(ref.authority);
  if (!known) {
    return { ok: false, reason: `unknown browser authority "${ref.authority}"` };
  }
  return { ok: true };
}

export function assignSlot(
  slot_name: string,
  brain: SlotBrainRef,
  label?: string,
): { ok: true; slot: SlotDefinition } | { ok: false; reason: string } {
  const trimmedName = slot_name.trim();
  if (!trimmedName) return { ok: false, reason: 'slot_name must be non-empty' };

  const validity = validateBrainRef(brain);
  if (!validity.ok) return validity;

  const store = readStore();
  const slot: SlotDefinition = {
    slot_name: trimmedName,
    brain,
    label,
    updated_at: new Date().toISOString(),
  };
  const idx = store.slots.findIndex((s) => s.slot_name === trimmedName);
  if (idx >= 0) {
    store.slots[idx] = slot;
  } else {
    store.slots.push(slot);
  }
  writeStore(store);
  return { ok: true, slot };
}

export function unassignSlot(slot_name: string): boolean {
  const store = readStore();
  const before = store.slots.length;
  store.slots = store.slots.filter((s) => s.slot_name !== slot_name);
  if (store.slots.length === before) return false;
  writeStore(store);
  return true;
}
