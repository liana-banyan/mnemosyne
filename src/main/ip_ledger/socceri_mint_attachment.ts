/**
 * socceri_mint_attachment.ts -- Socceri-to-Medallion-Mint ATTACHMENT MECHANISM ONLY.
 * D-BP210-BM0-h2cbpqoc-018, reworking D-BP210-BM0-h2cbpwps-014's UPDATE-shaped design per the
 * Founder's direct ruling, verbatim, 2026-09-01T22:45Z, answering the XO's own recommendation
 * ("YES do that."):
 *
 *   "THE ANSWER IS PROBABLY NOT TO UPDATE THE ROW AT ALL. Append a NEW row that names the
 *   original BY HASH as its parent. That is literally what the parents array shipped tonight
 *   to do. THE MINT BECOMES A CHILD OF THE CLAIM RATHER THAN AN EDIT TO IT, the body cam
 *   stays unedited, and the DAG carries the relationship."
 *
 * THE CONFLICT THIS RESOLVES: `ip_ledger_entries` carries four mint columns
 * (`medallion_mint_id`, `minted_tx_hash`, `minted_block_number`, `minted_at`) that can only
 * ever be populated by an UPDATE strictly after the row's original insert. But
 * `stamp_certify.ts` (same directory) documents, in its own header, "Federal Body Cam
 * doctrine: rows are NEVER updated or deleted." Dispatch 014 built the UPDATE-shaped design
 * (A) and flagged the tension rather than resolving it. THE FOUNDER RULED FOR THE BODY CAM.
 * This file now implements ONLY the append-a-child-row model. The prior UPDATE-shaped
 * `attachSoccerballToLedgerRow` / `recordMintConfirmation` functions are RETIRED, not kept
 * alongside -- see the Rule 66 sibling `socceri_mint_attachment.superseded.20260901T225532Z.ts`
 * for the exact prior form.
 *
 * ABSOLUTE PROHIBITION, RESTATED HERE SO IT CANNOT BE MISSED: this module MINTS NOTHING,
 * SIGNS NO BLOCKCHAIN TRANSACTION, SENDS NO TRANSACTION, CALLS NO MINT EDGE FUNCTION, and
 * SPENDS NO GAS. It does not import, require, or call anything from `mint-medallions`. It
 * does not touch the live `ip_ledger_entries` table -- every function below operates on an
 * INJECTED array of row objects (`rows: LedgerRowFixture[]`), proven here only against a
 * local, synthetic fixture (see socceri_mint_attachment.test.ts). The Founder signs any
 * mint. A seat never does. FIXTURE-WIRED, PRODUCTION-UNWIRED -- there is no Supabase client
 * and no network call anywhere in this file, deliberately; a live `.insert(...)` wrapper is
 * NOT built here, because building it would mean writing code capable of appending to the
 * 919-row production table, which the order forbids without the Founder's own act.
 *
 * GADGETED LIVE, RE-CONFIRMED BEFORE THIS REWORK (read-only REST GETs, no write, no schema
 * query, no key printed, `supabase projects api-keys` never run), 2026-09-01T22:5*Z:
 *   - 919 rows, 0 with minted_tx_hash -- unchanged from dispatch 014's own measurement.
 *   - The live table now has 28 columns (was 27 in dispatch 014): `socceri_hash` was added
 *     at 2026-09-01T22:5xZ on the Founder's direct order and confirmed present, NULL on all
 *     919 rows, both by this dispatch's own read and by the order text.
 *   - `SELECT DISTINCT contribution_type` across all 919 rows returns exactly THREE live
 *     values: `rls_integration_test_y11_bp118`, `plow_mc_answer_solved`,
 *     `member_connection`. NONE of these collides with the new distinguishing value chosen
 *     below (`MINT_CHILD_CONTRIBUTION_TYPE`).
 *   - Sampled real rows' `payload_hash` values ARE full 64-hex-character sha256 digests
 *     (Postgres bytea, printed with a literal `\x` prefix over the wire -- the prefix is a
 *     Postgres bytea encoding artifact, not part of the hash itself, and is stripped by
 *     `normalizeContentHash` below). One sampled row (`rls_integration_test_y11_bp118`,
 *     synthetic RLS test data, not a real claim) carries a 72-hex-char value that is the
 *     hex encoding of its own `entry_id` UUID text, NOT a sha256 digest -- flagged here as
 *     pre-existing test junk this module's `parentContentHash()` will correctly REFUSE to
 *     mint a child against (see its length/shape check), not silently accept.
 *
 * NAMING THE PARENT BY HASH, MATCHED TO THE ESTATE'S ONE HASH CONVENTION, NOT A THIRD ONE:
 * `POST /api/founder/sign-document` (`conduit_server.js`, ~line 4307) and `hashOrderFile()`
 * (`caithedral-core/src/tools/crystal_store.ts`, dispatch 014) both use
 * `sha256(rawBytes).digest('hex')` -- the full 64-hex digest, never truncated, never over a
 * re-encoded form of the bytes. `parentContentHash()` below reads that same convention off
 * the parent row's existing `payload_hash` column (already a sha256 hex digest on every real
 * production row sampled) rather than re-deriving it from anything else. No third hash
 * convention is invented here.
 */

import { createHash } from "crypto";

/** A single ip_ledger_entries row, as measured live (28 columns as of this dispatch, up from
 * 27 -- `socceri_hash` was added between dispatch 014 and this one). Only the columns this
 * module reads or writes are typed explicitly; the rest pass through untouched via the index
 * signature -- this module never drops or rewrites a column it doesn't know about. */
export interface LedgerRowFixture {
  id: number;
  entry_id: string;
  contribution_type: string;
  /** This row's own content hash, sha256 hex (see header). Present on real claim rows,
   * absent (null) on a freshly-appended mint-child, which has no payload of its own to hash. */
  payload_hash: string | null;
  /** EXISTS on the live table as of this dispatch (added 2026-09-01T22:5xZ on the Founder's
   * direct order). On a mint-child row, names the Soccerball this mint event is addressable
   * by inside the Crystal/Soccerball DAG. Null on an ordinary claim row. */
  socceri_hash: string | null;
  /** DOES NOT EXIST on the live table today -- see the unapplied DDL at the bottom of this
   * file. Names the PARENT claim row THIS row descends from, by the parent's own
   * `payload_hash` content hash -- never by `id` or `entry_id`, which are mutable/reusable
   * handles, not content-addressed identity. Null on an ordinary (root) claim row; set,
   * exactly once, at creation time, on a mint-child row. Modeled here so the fixture can
   * prove the append-a-child-row path end-to-end before the column is real. */
  parent_hash: string | null;
  medallion_mint_id: string | null;
  minted_tx_hash: string | null;
  minted_block_number: number | null;
  minted_at: string | null;
  [otherLiveColumn: string]: unknown;
}

const SHA256_HEX_RE = /^[0-9a-f]{64}$/;

/**
 * normalizeContentHash -- strips a Postgres bytea `\x` prefix or an EVM `0x` prefix if
 * present and lowercases the rest. The underlying identity is the bare hex digest; the
 * prefix is a transport/encoding artifact of whichever system printed it, never part of the
 * hash itself. Does NOT validate shape -- callers that need a real sha256 identity check
 * `SHA256_HEX_RE` themselves (see `parentContentHash` and `mintChildRow` below), so a
 * malformed value is refused at the point it matters rather than silently coerced here.
 */
export function normalizeContentHash(raw: string): string {
  return raw.replace(/^\\x/, "").replace(/^0x/i, "").toLowerCase();
}

/** MINT_CHILD_CONTRIBUTION_TYPE -- the value that DISTINGUISHES a mint-child row from an
 * ordinary claim row on `contribution_type`. Checked live against the three actual distinct
 * values this dispatch measured on the production table (`rls_integration_test_y11_bp118`,
 * `plow_mc_answer_solved`, `member_connection`) -- this string collides with none of them. */
export const MINT_CHILD_CONTRIBUTION_TYPE = "medallion_mint_confirmation";

export interface HashCheckResult {
  ok: boolean;
  reason: string | null;
  hash: string | null;
}

/**
 * parentContentHash -- reads the PARENT row's own identity hash off its `payload_hash`
 * column, in the estate's one sha256-hex convention (see this file's header). Refuses
 * (rather than silently accepting) a row with no `payload_hash` at all, or one whose
 * `payload_hash` is not a full 64-hex sha256 digest once the transport prefix is stripped --
 * this is exactly the check that would catch the one sampled `rls_integration_test_y11_bp118`
 * row this dispatch found carrying a hex-encoded UUID instead of a real hash: it is 72 hex
 * characters, not 64, and this function refuses to mint a child against it.
 */
export function parentContentHash(parentRow: LedgerRowFixture): HashCheckResult {
  if (!parentRow.payload_hash) {
    return { ok: false, reason: `parent row ${parentRow.entry_id} carries no payload_hash -- cannot name it by hash`, hash: null };
  }
  const normalized = normalizeContentHash(parentRow.payload_hash);
  if (!SHA256_HEX_RE.test(normalized)) {
    return {
      ok: false,
      reason: `parent row ${parentRow.entry_id} payload_hash is not a full 64-hex sha256 digest (got ${normalized.length} hex chars) -- refusing to mint a child naming a malformed parent hash`,
      hash: null,
    };
  }
  return { ok: true, reason: null, hash: normalized };
}

/** sha256HexOfBytes -- exposed for tests and any future live caller that needs to compute a
 * fresh content hash from raw bytes in the exact estate convention (sha256, hex, 64 chars,
 * never truncated) -- the same form as `hashOrderFile()` and `POST /api/founder/sign-document`.
 * Not used internally by `mintChildRow`, which reads an ALREADY-COMPUTED hash off the parent
 * row's `payload_hash` rather than re-deriving one, so a stored hash and a freshly-computed
 * one can never silently disagree inside this module. */
export function sha256HexOfBytes(bytes: Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export interface MintChildReceipt {
  /** Identifier of the medallion-mint reservation/record this confirms -- caller-supplied,
   * obtained from wherever `mint-medallions` (NOT this module, NOT called by this module)
   * already tracks its own reservations. */
  medallion_mint_id: string;
  /** The on-chain transaction hash of an ALREADY-CONFIRMED mint. This module never produces
   * one, never calls anything that could produce one, and never accepts a placeholder. */
  minted_tx_hash: string;
  minted_block_number: number;
  /** ISO-8601 UTC, the confirmed transaction's own timestamp -- caller-supplied, never
   * generated here (this module does not call Date.now() for this field, deliberately, so
   * it can never be tempted to stamp a confirmation that has not actually happened). */
  minted_at: string;
  /** The Soccerball this mint event is addressable by in the Crystal/Soccerball DAG. Full
   * 64-hex sha256, same convention as the parent hash -- never a 32-hex Crystal `sid`-style
   * handle (that was dispatch 014's since-retired `soccerball_id` design; `socceri_hash` is
   * the column the Founder actually added, and it is a content hash, not a mint address). */
  socceri_hash: string;
}

export interface MintChildResult {
  ok: boolean;
  reason: string | null;
  childRow: LedgerRowFixture | null;
}

/**
 * mintChildRow -- THE ONLY function in this module that creates a mint-bearing row, and it
 * does so by APPENDING a new row to `rows`, never by writing to the parent. Implements the
 * Founder's ruling exactly: "the mint becomes a child of the claim rather than an edit to
 * it, the body cam stays unedited, and the DAG carries the relationship."
 *
 * - Looks up the parent by `entryId` ONLY to locate it in the injected fixture (a live
 *   caller would do the same lookup against Supabase with a plain SELECT, never a write).
 *   The relationship the CHILD actually records is `parent_hash`, the parent's *content*
 *   hash -- never the parent's `id` or `entry_id`, which are mutable/reusable handles.
 * - Refuses to mint a child of another mint-child (a mint attaches to the original claim,
 *   not to another mint) -- checked via `contribution_type`.
 * - Refuses an incomplete/speculative receipt outright (never a partial write, checked
 *   field-by-field) and refuses a malformed `socceri_hash`.
 * - Idempotent: re-submitting the identical (parentHash, minted_tx_hash) pair returns the
 *   EXISTING child rather than appending a duplicate -- matches the estate's own
 *   never-partial, never-duplicate mint convention (`crystal_store.ts`'s `mintChonk`).
 * - NEVER assigns to any property of the parent row object. The parent argument found in
 *   `rows` is read from, never written to -- proven by the "parent row is byte-identical
 *   before and after" test, not merely asserted here.
 * - Reverse lookup ("does this claim have a mint?") is a QUERY over children
 *   (`rows.filter(r => r.parent_hash === parentContentHash(parent).hash)`), never a field on
 *   the parent -- there is deliberately no such field added to `LedgerRowFixture`.
 */
export function mintChildRow(
  rows: LedgerRowFixture[],
  parentEntryId: string,
  receipt: MintChildReceipt
): MintChildResult {
  const parent = rows.find((r) => r.entry_id === parentEntryId);
  if (!parent) {
    return { ok: false, reason: `no ledger row with entry_id ${parentEntryId}`, childRow: null };
  }
  if (parent.contribution_type === MINT_CHILD_CONTRIBUTION_TYPE) {
    return {
      ok: false,
      reason: `entry ${parentEntryId} is itself a mint-child (contribution_type=${MINT_CHILD_CONTRIBUTION_TYPE}) -- a mint attaches to the original claim, not to another mint`,
      childRow: null,
    };
  }

  const parentHashCheck = parentContentHash(parent);
  if (!parentHashCheck.ok || !parentHashCheck.hash) {
    return { ok: false, reason: parentHashCheck.reason, childRow: null };
  }
  const parentHash = parentHashCheck.hash;

  if (
    !receipt.medallion_mint_id ||
    !receipt.minted_tx_hash ||
    typeof receipt.minted_block_number !== "number" ||
    !Number.isFinite(receipt.minted_block_number) ||
    !receipt.minted_at
  ) {
    return { ok: false, reason: "receipt is incomplete -- refusing a speculative or partial mint confirmation", childRow: null };
  }

  const socceriHash = receipt.socceri_hash ? normalizeContentHash(receipt.socceri_hash) : "";
  if (!SHA256_HEX_RE.test(socceriHash)) {
    return { ok: false, reason: `socceri_hash must be a full 64-hex sha256 digest, got "${receipt.socceri_hash}"`, childRow: null };
  }

  const existing = rows.find(
    (r) =>
      r.contribution_type === MINT_CHILD_CONTRIBUTION_TYPE &&
      r.parent_hash === parentHash &&
      r.minted_tx_hash === receipt.minted_tx_hash
  );
  if (existing) {
    return { ok: true, reason: null, childRow: existing };
  }

  const nextId = rows.reduce((max, r) => Math.max(max, r.id), 0) + 1;
  const childRow: LedgerRowFixture = {
    id: nextId,
    entry_id: `${parent.entry_id}::mint::${receipt.minted_tx_hash}`,
    contribution_type: MINT_CHILD_CONTRIBUTION_TYPE,
    payload_hash: null,
    socceri_hash: socceriHash,
    parent_hash: parentHash,
    medallion_mint_id: receipt.medallion_mint_id,
    minted_tx_hash: receipt.minted_tx_hash,
    minted_block_number: receipt.minted_block_number,
    minted_at: receipt.minted_at,
  };
  rows.push(childRow); // APPEND ONLY. `parent` above is read, never assigned to.
  return { ok: true, reason: null, childRow };
}

/**
 * verifyParentLink -- reverse-checks a mint-child's recorded `parent_hash` against the
 * CURRENT content hash of whatever row in `rows` it should still match. This is the query
 * form of "does this child's parent reference still hold" -- there is no field on the parent
 * for this, by design (see `mintChildRow`'s doc comment); a reader runs this instead. If no
 * row's current `payload_hash` matches, the reference is INVALIDATED -- either the named
 * parent is gone from this fixture, or (the case the body-cam doctrine is meant to make
 * impossible on the real table) its content changed after the child was minted.
 */
export function verifyParentLink(
  rows: LedgerRowFixture[],
  childRow: LedgerRowFixture
): { ok: boolean; reason: string | null } {
  if (childRow.parent_hash === null) {
    return { ok: false, reason: `row ${childRow.entry_id} carries no parent_hash -- not a mint-child` };
  }
  const match = rows.find(
    (r) => r.payload_hash !== null && normalizeContentHash(r.payload_hash) === childRow.parent_hash
  );
  if (!match) {
    return {
      ok: false,
      reason: `no row's current payload_hash matches this child's recorded parent_hash ${childRow.parent_hash} -- the parent's content has changed since the child was minted, or the parent is gone; the reference is invalidated`,
    };
  }
  return { ok: true, reason: null };
}

/**
 * UNAPPLIED DDL -- written out for the Founder to authorize, NOT run by this dispatch. This
 * dispatch's own append-a-child-row model needs exactly ONE new column beyond what the
 * Founder already added tonight (`socceri_hash`, which this dispatch USES, not adds): a
 * parent-hash pointer. Nullable and additive -- every existing row (all 919) is unaffected,
 * decodes, and reads exactly as before; the column is simply NULL on every one of them
 * (they are all root claims, none is yet a mint-child).
 *
 *   ALTER TABLE ip_ledger_entries
 *     ADD COLUMN parent_hash text NULL;
 *
 *   -- optional, enforces the 64-hex sha256 shape at the database layer if desired:
 *   ALTER TABLE ip_ledger_entries
 *     ADD CONSTRAINT ip_ledger_entries_parent_hash_sha256_chk
 *     CHECK (parent_hash IS NULL OR parent_hash ~ '^[0-9a-f]{64}$');
 *
 * SUPERSEDED PROPOSAL, from dispatch 014, NOT to be applied: that dispatch's own unapplied
 * DDL proposed a `soccerball_id text` column (32-hex Crystal-`sid`-style handle) for a
 * different purpose (naming which Soccerball a row's payload was minted FROM, via an UPDATE
 * to the existing row). The Founder has since added `socceri_hash` directly (a 64-hex
 * content hash, populated only on a freshly-APPENDED mint-child, never via an UPDATE), which
 * supersedes that proposal outright. Do not additionally apply the old `soccerball_id` DDL.
 *
 * NEITHER statement above has been run against any database, live or otherwise, by this
 * dispatch.
 */
