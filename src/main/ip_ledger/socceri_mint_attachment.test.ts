/**
 * socceri_mint_attachment.test.ts -- D-BP210-BM0-h2cbpqoc-018.
 *
 * Tests the REWORKED append-a-child-row mint-attachment mechanism against a LOCAL, SYNTHETIC
 * fixture only. No network call, no Supabase client, no live table touched -- the fixture
 * rows below are fabricated for this test, shaped to match the 28-column live schema
 * confirmed by a read-only REST GET this dispatch ran against production (see
 * socceri_mint_attachment.ts's header for the exact measurement), but their VALUES are not
 * real production data. Reworks the 11 tests from dispatch 014's UPDATE-model test file
 * (see the Rule 66 sibling `socceri_mint_attachment.test.superseded.20260901T225532Z.ts`) for
 * the append-a-child-row model the Founder ruled for.
 *
 * Run: npx tsx src/main/ip_ledger/socceri_mint_attachment.test.ts
 */

import * as assert from "assert";
import {
  mintChildRow,
  verifyParentLink,
  parentContentHash,
  normalizeContentHash,
  sha256HexOfBytes,
  MINT_CHILD_CONTRIBUTION_TYPE,
  type LedgerRowFixture,
  type MintChildReceipt,
} from "./socceri_mint_attachment";

let passed = 0;
let failed = 0;
const failures: string[] = [];

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}: ${(err as Error).message}`);
    failures.push(name);
    failed++;
  }
}

const REAL_LOOKING_SHA256_A = sha256HexOfBytes("fixture-claim-payload-0001");
const REAL_LOOKING_SHA256_B = sha256HexOfBytes("fixture-claim-payload-0002");
const SOCCERI_HASH_1 = sha256HexOfBytes("fixture-soccerball-alpha");
const SOCCERI_HASH_2 = sha256HexOfBytes("fixture-soccerball-beta");

function freshFixture(): LedgerRowFixture[] {
  // Synthetic rows only, shaped like the 28-column live schema this dispatch measured
  // read-only (id, entry_id, ring_bearer_peer_id, contribution_type, payload_hash,
  // payload_url, stamped_at, signature_ed25519, mesh_replicated, inventor_name,
  // royalty_share_pct, cooperative_share_pct, patent_application_number, filing_status,
  // assignment_signed_at, cla_signed_at, marks_awarded, csia_phase, submission_fee_paid,
  // submission_fee_path, medallion_mint_id, minted_tx_hash, minted_block_number,
  // minted_at, replicated_at, attribution_mode, subject_peer_id, socceri_hash) -- only the
  // columns this module touches are populated explicitly, the rest collapse into the index
  // signature.
  return [
    {
      id: 1,
      entry_id: "fixture-entry-0001",
      contribution_type: "plow_mc_answer_solved",
      payload_hash: REAL_LOOKING_SHA256_A,
      socceri_hash: null,
      parent_hash: null,
      medallion_mint_id: null,
      minted_tx_hash: null,
      minted_block_number: null,
      minted_at: null,
      mesh_replicated: false,
    },
    {
      id: 2,
      entry_id: "fixture-entry-0002",
      contribution_type: "member_connection",
      payload_hash: REAL_LOOKING_SHA256_B,
      socceri_hash: null,
      parent_hash: null,
      medallion_mint_id: null,
      minted_tx_hash: null,
      minted_block_number: null,
      minted_at: null,
      mesh_replicated: false,
    },
  ];
}

function receipt(overrides: Partial<MintChildReceipt> = {}): MintChildReceipt {
  return {
    medallion_mint_id: "fixture-medallion-0001",
    minted_tx_hash: "f".repeat(64),
    minted_block_number: 123456,
    minted_at: "2026-09-01T22:30:00.000Z",
    socceri_hash: SOCCERI_HASH_1,
    ...overrides,
  };
}

console.log("\n=== BP210 Socceri-to-Medallion-Mint APPEND-A-CHILD-ROW Tests (fixture only) ===\n");

// --- parentContentHash / normalizeContentHash -------------------------------------------

test("parentContentHash reads a valid 64-hex sha256 straight off payload_hash", () => {
  const rows = freshFixture();
  const result = parentContentHash(rows[0]);
  assert.strictEqual(result.ok, true, result.reason ?? "");
  assert.strictEqual(result.hash, REAL_LOOKING_SHA256_A);
});

test("normalizeContentHash strips a Postgres bytea \\x prefix", () => {
  assert.strictEqual(normalizeContentHash("\\x" + REAL_LOOKING_SHA256_A), REAL_LOOKING_SHA256_A);
});

test("parentContentHash REFUSES a row whose payload_hash is not 64 hex chars (the rls_integration_test junk shape)", () => {
  const rows = freshFixture();
  rows[0].payload_hash = "66326561633734622d656630652d343335362d383639392d633335666466636663"; // 70 hex chars, hex-encoded UUID text, not a sha256
  const result = parentContentHash(rows[0]);
  assert.strictEqual(result.ok, false);
  assert.ok(/not a full 64-hex sha256/.test(result.reason ?? ""));
});

// --- mintChildRow: core append behavior --------------------------------------------------

test("mintChildRow APPENDS a new row, it does not update the parent in place", () => {
  const rows = freshFixture();
  const before = rows.length;
  const result = mintChildRow(rows, "fixture-entry-0001", receipt());
  assert.strictEqual(result.ok, true, result.reason ?? "");
  assert.strictEqual(rows.length, before + 1, "exactly one new row must be appended");
  assert.notStrictEqual(result.childRow, rows[0], "the child must be a distinct row object from the parent");
});

test("THE PARENT ROW IS BYTE-IDENTICAL BEFORE AND AFTER a child is appended (the body-cam guarantee)", () => {
  const rows = freshFixture();
  const parentBefore = JSON.stringify(rows.find((r) => r.entry_id === "fixture-entry-0001"));
  mintChildRow(rows, "fixture-entry-0001", receipt());
  const parentAfter = JSON.stringify(rows.find((r) => r.entry_id === "fixture-entry-0001"));
  assert.strictEqual(parentAfter, parentBefore, "the parent row must serialize identically before and after a child is minted -- not one field may change");
});

test("the mint-child names its parent BY HASH, not by id or entry_id", () => {
  const rows = freshFixture();
  const result = mintChildRow(rows, "fixture-entry-0001", receipt());
  assert.strictEqual(result.ok, true, result.reason ?? "");
  assert.strictEqual(result.childRow!.parent_hash, REAL_LOOKING_SHA256_A);
  // The child's own entry_id/id are new and distinct from the parent's -- the link is the hash field alone.
  assert.notStrictEqual(result.childRow!.entry_id, "fixture-entry-0001");
  assert.notStrictEqual(result.childRow!.id, rows.find((r) => r.entry_id === "fixture-entry-0001")!.id);
});

test("the mint-child is DISTINGUISHABLE from a claim row via contribution_type", () => {
  const rows = freshFixture();
  const result = mintChildRow(rows, "fixture-entry-0001", receipt());
  assert.strictEqual(result.ok, true, result.reason ?? "");
  assert.strictEqual(result.childRow!.contribution_type, MINT_CHILD_CONTRIBUTION_TYPE);
  // Confirmed live: MINT_CHILD_CONTRIBUTION_TYPE collides with none of the three real distinct values.
  const liveDistinctValues = ["rls_integration_test_y11_bp118", "plow_mc_answer_solved", "member_connection"];
  assert.ok(!liveDistinctValues.includes(MINT_CHILD_CONTRIBUTION_TYPE));
});

test("the mint-child carries socceri_hash so it is addressable in the DAG", () => {
  const rows = freshFixture();
  const result = mintChildRow(rows, "fixture-entry-0001", receipt({ socceri_hash: SOCCERI_HASH_2 }));
  assert.strictEqual(result.ok, true, result.reason ?? "");
  assert.strictEqual(result.childRow!.socceri_hash, SOCCERI_HASH_2);
});

test("the mint-child carries all four mint facts, written for the first time on the child, not the parent", () => {
  const rows = freshFixture();
  const r = receipt();
  const result = mintChildRow(rows, "fixture-entry-0001", r);
  assert.strictEqual(result.ok, true, result.reason ?? "");
  assert.strictEqual(result.childRow!.medallion_mint_id, r.medallion_mint_id);
  assert.strictEqual(result.childRow!.minted_tx_hash, r.minted_tx_hash);
  assert.strictEqual(result.childRow!.minted_block_number, r.minted_block_number);
  assert.strictEqual(result.childRow!.minted_at, r.minted_at);
  const parent = rows.find((row) => row.entry_id === "fixture-entry-0001")!;
  assert.strictEqual(parent.medallion_mint_id, null, "the parent must never carry the mint facts");
  assert.strictEqual(parent.minted_tx_hash, null);
});

// --- mintChildRow: refusals ----------------------------------------------------------------

test("mintChildRow rejects an entry_id that does not exist in the fixture", () => {
  const rows = freshFixture();
  const result = mintChildRow(rows, "no-such-entry", receipt());
  assert.strictEqual(result.ok, false);
  assert.ok(/no ledger row/.test(result.reason ?? ""));
  assert.strictEqual(rows.length, 2, "a rejected mint must append nothing");
});

test("mintChildRow REFUSES an incomplete/speculative receipt (missing tx hash)", () => {
  const rows = freshFixture();
  const result = mintChildRow(rows, "fixture-entry-0001", receipt({ minted_tx_hash: "" }));
  assert.strictEqual(result.ok, false);
  assert.ok(/incomplete|speculative/.test(result.reason ?? ""));
  assert.strictEqual(rows.length, 2, "an incomplete receipt must never partially land as a row");
});

test("mintChildRow REFUSES an incomplete receipt (non-numeric block number)", () => {
  const rows = freshFixture();
  const result = mintChildRow(rows, "fixture-entry-0001", receipt({ minted_block_number: NaN }));
  assert.strictEqual(result.ok, false);
  assert.strictEqual(rows.length, 2);
});

test("mintChildRow REFUSES a malformed socceri_hash", () => {
  const rows = freshFixture();
  const result = mintChildRow(rows, "fixture-entry-0001", receipt({ socceri_hash: "not-a-real-hash" }));
  assert.strictEqual(result.ok, false);
  assert.ok(/socceri_hash must be a full 64-hex/.test(result.reason ?? ""));
  assert.strictEqual(rows.length, 2);
});

test("mintChildRow REFUSES minting a child of another mint-child (mints attach to claims, not to mints)", () => {
  const rows = freshFixture();
  const first = mintChildRow(rows, "fixture-entry-0001", receipt());
  assert.strictEqual(first.ok, true, first.reason ?? "");
  const childEntryId = first.childRow!.entry_id;
  const second = mintChildRow(rows, childEntryId, receipt({ minted_tx_hash: "e".repeat(64) }));
  assert.strictEqual(second.ok, false);
  assert.ok(/is itself a mint-child/.test(second.reason ?? ""));
});

test("mintChildRow is idempotent: resubmitting the identical (parent, tx hash) pair returns the existing child, not a duplicate", () => {
  const rows = freshFixture();
  const first = mintChildRow(rows, "fixture-entry-0001", receipt());
  const lengthAfterFirst = rows.length;
  const second = mintChildRow(rows, "fixture-entry-0001", receipt());
  assert.strictEqual(first.ok, true);
  assert.strictEqual(second.ok, true);
  assert.strictEqual(rows.length, lengthAfterFirst, "a repeated identical mint must not append a second row");
  assert.strictEqual(second.childRow!.entry_id, first.childRow!.entry_id);
});

// --- verifyParentLink: the parent-by-hash reference and its invalidation ------------------

test("verifyParentLink confirms a child correctly names a parent whose content hash it was given", () => {
  const rows = freshFixture();
  const result = mintChildRow(rows, "fixture-entry-0001", receipt());
  assert.strictEqual(result.ok, true, result.reason ?? "");
  const check = verifyParentLink(rows, result.childRow!);
  assert.strictEqual(check.ok, true, check.reason ?? "");
});

test("verifyParentLink is INVALIDATED once the named parent's content hash changes", () => {
  const rows = freshFixture();
  const result = mintChildRow(rows, "fixture-entry-0001", receipt());
  assert.strictEqual(result.ok, true, result.reason ?? "");
  // Body-cam doctrine forbids this on the real table; simulated here ONLY to prove the
  // detection mechanism actually works, not to endorse ever doing it live.
  const parent = rows.find((r) => r.entry_id === "fixture-entry-0001")!;
  parent.payload_hash = sha256HexOfBytes("a-different-payload-entirely");
  const check = verifyParentLink(rows, result.childRow!);
  assert.strictEqual(check.ok, false);
  assert.ok(/invalidated/.test(check.reason ?? ""));
});

test("verifyParentLink refuses a row with no parent_hash (not a mint-child)", () => {
  const rows = freshFixture();
  const check = verifyParentLink(rows, rows[0]);
  assert.strictEqual(check.ok, false);
  assert.ok(/not a mint-child/.test(check.reason ?? ""));
});

// --- composition: two independent mint-children off two different parents, no cross-talk --

test("two mint-children off two different parents compose independently, siblings untouched", () => {
  const rows = freshFixture();
  const child1 = mintChildRow(rows, "fixture-entry-0001", receipt({ socceri_hash: SOCCERI_HASH_1 }));
  const child2 = mintChildRow(rows, "fixture-entry-0002", receipt({ minted_tx_hash: "1".repeat(64), socceri_hash: SOCCERI_HASH_2 }));
  assert.strictEqual(child1.ok, true, child1.reason ?? "");
  assert.strictEqual(child2.ok, true, child2.reason ?? "");
  assert.strictEqual(rows.length, 4);
  assert.strictEqual(child1.childRow!.parent_hash, REAL_LOOKING_SHA256_A);
  assert.strictEqual(child2.childRow!.parent_hash, REAL_LOOKING_SHA256_B);
  assert.notStrictEqual(child1.childRow!.parent_hash, child2.childRow!.parent_hash);
  // Both original parents remain untouched and mint-fact-free.
  const parent1 = rows.find((r) => r.entry_id === "fixture-entry-0001")!;
  const parent2 = rows.find((r) => r.entry_id === "fixture-entry-0002")!;
  assert.strictEqual(parent1.minted_tx_hash, null);
  assert.strictEqual(parent2.minted_tx_hash, null);
});

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
if (failures.length > 0) {
  console.error("Failed tests:", failures.join(", "));
}
if (failed > 0) {
  process.exit(1);
}
