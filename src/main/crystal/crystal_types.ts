// crystal_types.ts -- KN-BP147-M1 "THE CRYSTAL. THE MAPPING THAT STAYS TRUE."
//
// Wire types for the durable chonk-handle + binding-map store. See crystal_store.ts for
// the change-gate implementation and crystal_store.test.ts for the determinism-drift proof
// these shapes exist to make testable.

/**
 * A binding target is deliberately NOT restricted to filesystem paths. `targetType` is an
 * open string (not a closed union) so a future capability -- the estate calls it "the
 * Grapple Gun": pointing a Chonk at a folder, an installed runtime, a signed-in session, a
 * mesh peer, or something not yet invented -- can add new kinds without a schema migration.
 * This ticket does not design or build the Grapple Gun; it only must not foreclose it.
 *
 * Known kinds in use by this module's own tests/proofs (non-exhaustive, not enforced):
 *   "file" | "url" | "session_uuid" | "mesh_peer" | "opaque"
 */
export interface BindingTarget {
  targetType: string;
  ref: string;
  meta?: Record<string, unknown>;
}

export type CrystalBindings = Record<string, BindingTarget>;

/** The only three reasons a binding may be mutated instead of additively appended. */
export type MutationReason = "superseded_source" | "failed_resolution" | "explicit_ratification";

// ─── BP162 D-BP162-M0-031 additions (Keystone Connector Typing, per D-BP162-M0-025 design
// + Founder's post-design whiteSubShade ruling) ─────────────────────────────────────────
//
// All six types/fields below are STRICTLY ADDITIVE metadata that rides on `op: "mint"`
// records only. None of them may EVER enter `deriveMintAddress()`'s hash input (see that
// function's own doc comment in crystal_store.ts) -- they describe a Crystal / its Keystone
// Connector, they are never inputs to the mint's identity.

/**
 * Open string union for a Crystal's function, mirroring `BindingTarget.targetType`'s own
 * open-string rationale above (line 8-16): a future Crystal function must not require a
 * schema migration. Known kinds (non-exhaustive, not enforced), 1:1 with `crystalColor`:
 * "Connector" (Goldenrod) | "Data" (Silver) | "Navigation" (MidnightBlue) | "Language"
 * (Violet) | "PrimeRadiant" (White) | "Possibility" (Black).
 */
export type CrystalTypeName = string;

/**
 * Open string union for the material/grade of the ONE designated Keystone Connector that
 * identifies a Crystal. Same open-string rationale as `CrystalTypeName` above. Known kinds
 * (non-exhaustive, not enforced): "Lead" (default -- unproven, mutable pointer) | "Gold"
 * (earned, ratified, immutable) | "Diamond" | "Ruby" | "Emerald" | "Platinum" (all four
 * reserved by name only, BP162 -- no purpose, ordering, or promotion path assigned to any
 * of them). Distinct from, and never collapsed into, `crystalColor`/`crystalType` -- a
 * Crystal's color/type answers "what KIND of Crystal is this," `keystoneMaterial` answers
 * "what GRADE does this Crystal's identifying connector hold." Two independent axes.
 */
export type KeystoneMaterial = string;

/**
 * A Crystal is installed-but-dormant when "OFF": per Founder ruling, its connectors do not
 * resolve while the Crystal and all its files remain on disk untouched. Defaults to "ON"
 * when absent, so every pre-BP162 record is implicitly ON and needs no backfill.
 */
export type CrystalPowerState = "ON" | "OFF";

/**
 * Optional mint-time metadata bundle accepted by `mintChonk()`'s second parameter. Every
 * field is optional; supplying none of them (or omitting the parameter entirely) produces
 * byte-identical mint records to pre-BP162 code.
 */
export interface CrystalMintMeta {
  crystalType?: CrystalTypeName;
  crystalColor?: string;
  graySubShade?: number; // 1-12, only meaningful when crystalColor === "Black". 1 = empty
                          // container. 4 = Contingency Operators Celpanes Stack. All other
                          // values RESERVED, unassigned (BP162 design doc section 4c).
  whiteSubShade?: number; // 1-12, only meaningful when crystalColor === "White". NEW,
                          // Founder-ruled after D-BP162-M0-025 was written. No shade is
                          // assigned yet and the ordering is UNRULED (most vs. least
                          // resolved) -- implement the field, assign NO meanings.
  keystoneMaterial?: KeystoneMaterial; // defaults to "Lead" when absent
  powerState?: CrystalPowerState; // defaults to "ON" when absent
}

// This directory carries its own package.json with "type": "commonjs" (see crystal_store.ts's
// header note) so this file's two RUNTIME exports below use module.exports, not `export`,
// even though the interfaces/types above use `export` freely -- type-only syntax is fully
// erased by Node's native TypeScript support regardless of module system, so it needs no
// CJS/ESM reconciliation at all.
const MUTATION_REASONS: readonly MutationReason[] = [
  "superseded_source",
  "failed_resolution",
  "explicit_ratification",
];

function isMutationReason(x: unknown): x is MutationReason {
  return typeof x === "string" && (MUTATION_REASONS as readonly string[]).includes(x);
}

module.exports = { MUTATION_REASONS, isMutationReason };

/**
 * One line of the append-only crystal_log.jsonl. A record, once written, is never edited --
 * only ever superseded by a later record plus a `.superseded.<UTC-ts>` sibling file
 * (HARDWIRE-00 Section 1.9) capturing what it replaced.
 */
export interface CrystalLogRecord {
  v: 1;
  // "power" is a BP162 D-BP162-M0-031 addition: an additive-only, append-only record of a
  // powerState toggle (see CrystalPowerState above), governed the same way 'supersede' is
  // (reason + non-empty note). It never edits or replaces the 'mint' record -- resolving
  // the CURRENT power state means folding the latest 'power' record over the mint record's
  // own (optional) initial powerState, same "last one wins, additive log" shape as bindings.
  op: "mint" | "bind" | "supersede" | "power";
  sid: string;
  ts: string; // ISO-8601 UTC
  pearls?: string[]; // present on 'mint' only -- the sorted pearl set that derived `sid`
  key?: string; // present on 'bind' / 'supersede'
  target?: BindingTarget; // present on 'bind' / 'supersede' -- the NEW value
  reason?: MutationReason; // present on 'supersede' and 'power' only
  note?: string; // present on 'supersede' and 'power' only -- required, human-auditable

  // NEW -- BP162 D-BP162-M0-031, all six optional, all present on 'mint' only. See the
  // CrystalMintMeta block above for what each one means. STRICTLY ADDITIVE: never read by
  // deriveMintAddress(), never required, never touching 'bind'/'supersede' records.
  crystalType?: CrystalTypeName;
  crystalColor?: string;
  graySubShade?: number;
  whiteSubShade?: number;
  keystoneMaterial?: KeystoneMaterial;
  // powerState here is the mint-time INITIAL value only (rare -- most Crystals mint ON by
  // omission). The CURRENT power state is whatever the latest 'power' record says, falling
  // back to this field, falling back to "ON". Present on 'mint' (initial) AND 'power'
  // (the toggle's new value) records.
  powerState?: CrystalPowerState;
}

export interface BindResult {
  ok: boolean;
  sid: string;
  key: string;
  accepted:
    | "minted"
    | "appended"
    | "idempotent-noop"
    | "rejected-additive-only"
    | "rejected-invalid-reason"
    | "superseded";
  error?: string;
  supersededSiblingPath?: string;
}

export interface ResolvedChonk {
  sid: string;
  pearls: string[];
  bindings: CrystalBindings;
  // NEW -- BP162 D-BP162-M0-031, additive: populated ONLY when present on the mint record,
  // so a pre-BP162 sid resolves to the exact same {sid, pearls, bindings} shape as before
  // (no keys added when absent -- see resolveChonk() in crystal_store.ts).
  crystalType?: CrystalTypeName;
  crystalColor?: string;
  graySubShade?: number;
  whiteSubShade?: number;
  keystoneMaterial?: KeystoneMaterial;
}

/**
 * Result of a power-state-aware resolution -- BP162 D-BP162-M0-031. Distinguishes "never
 * existed" (found: false) from "exists but is powered OFF" (found: true, poweredOff: true,
 * chonk: null) from "exists and resolves normally" (found: true, poweredOff: false, chonk:
 * the ResolvedChonk). This is a NEW function's return shape (resolveChonkGuarded), added
 * alongside the unchanged resolveChonk() rather than folded into it, so every existing
 * caller of resolveChonk() keeps its exact pre-BP162 null/non-null contract.
 */
export interface GuardedResolveResult {
  sid: string;
  found: boolean;
  poweredOff: boolean;
  powerState: CrystalPowerState;
  chonk: ResolvedChonk | null;
}

/** Result of setCrystalPowerState() -- mirrors BindResult's shape/spirit for the power toggle. */
export interface PowerStateResult {
  ok: boolean;
  sid: string;
  powerState: CrystalPowerState | null;
  accepted: "powered" | "idempotent-noop" | "rejected-not-minted" | "rejected-invalid-reason";
  error?: string;
}
