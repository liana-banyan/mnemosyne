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
  op: "mint" | "bind" | "supersede";
  sid: string;
  ts: string; // ISO-8601 UTC
  pearls?: string[]; // present on 'mint' only -- the sorted pearl set that derived `sid`
  key?: string; // present on 'bind' / 'supersede'
  target?: BindingTarget; // present on 'bind' / 'supersede' -- the NEW value
  reason?: MutationReason; // present on 'supersede' only
  note?: string; // present on 'supersede' only -- required, human-auditable
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
}
