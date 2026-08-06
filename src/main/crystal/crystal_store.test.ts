/**
 * Crystal Store Test Harness -- KN-BP147-M1
 *
 * Mirrors the estate's own prior-art test-harness convention for this exact domain
 * (librarian-mcp/src/codec/hex_warehouse.test.ts: manual assert() + console output +
 * process.exit(1) on failure -- no test framework dependency, runs with plain `node`).
 *
 * REQUIRES the caller to set MNEM_CRYSTAL_DIR to a scratch directory before invoking this
 * file, because crystal_store.ts resolves its storage location once at module-load time and
 * this harness needs a clean, disposable directory to make its additive/reject assertions
 * deterministic run over run. Example:
 *   $env:MNEM_CRYSTAL_DIR = "C:\...\_crystal_test_scratch"; node crystal_store.test.ts
 *
 * Tests:
 *   1. Determinism against an INDEPENDENTLY computed literal hash (fails on real drift --
 *      see the comment on EXPECTED_FIXED_SID below; this is not a test that can't fail).
 *   2. Determinism + order-independence via the module's own repeated calls.
 *   3. mintChonk is idempotent (no duplicate 'mint' record on re-mint).
 *   4. resolveChonk returns null for a never-minted sid.
 *   5. bindChonk: new key appended.
 *   6. bindChonk: identical re-assertion is an idempotent no-op.
 *   7. bindChonk: DIFFERENT value on an existing key is REJECTED (additive-by-default gate).
 *   8. mutateChonkBinding: rejects an invalid reason.
 *   9. mutateChonkBinding: rejects an empty note.
 *  10. mutateChonkBinding: with a valid reason + note, writes a `.superseded.<ts>` sibling
 *      file containing the PRE-mutation value, and the log now resolves to the NEW value.
 *  11. Heterogeneous binding targets: a non-filesystem targetType round-trips untouched.
 */

// NOTE ON require() vs import: this directory carries its own package.json with
// "type": "commonjs" (see crystal_store.ts's header for why) so this harness can be run
// directly via a plain `node` invocation with zero build step, which is what the far-end
// (kill-and-restart) proof requires. TypeScript's `import` syntax is ESM-shaped even when
// compiling to a CommonJS target, so this file uses plain `require()` instead -- it is
// valid TypeScript, compiles unchanged under `tsc -p tsconfig.main.json`, and runs
// unmodified under Node's native type-stripping in CommonJS mode.
const { existsSync, readFileSync, readdirSync } = require("fs");
const {
  mintChonk,
  resolveChonk,
  bindChonk,
  mutateChonkBinding,
  deriveMintAddress,
  crystalStats,
  SUPERSEDED_DIR,
} = require("./crystal_store.ts");

// Wrapped in an IIFE (see crystal_proof_write.ts's comment on why): a bare top-level const
// in a file with no ESM import/export marker is treated by tsc as global-script scope, and
// would otherwise collide with identically-named top-level consts in the sibling proof files.
(function main(): void {

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, detail?: string): void {
  if (condition) {
    console.log(`  \u2713 ${label}`);
    passed++;
  } else {
    console.error(`  \u2717 ${label}${detail ? ` -- ${detail}` : ""}`);
    failed++;
  }
}

if (!process.env.MNEM_CRYSTAL_DIR) {
  console.error(
    "FATAL: MNEM_CRYSTAL_DIR is not set. This harness requires a scratch directory " +
      "(see file header). Refusing to run against an unspecified/shared location."
  );
  process.exit(1);
}

console.log("\n=== Crystal Store Test Harness (KN-BP147-M1) ===");
console.log(`    storage dir: ${process.env.MNEM_CRYSTAL_DIR}\n`);

// ── Test 1: Determinism against an INDEPENDENTLY computed literal ──────────
console.log("Test 1: Determinism against an independently-computed literal (drift-sensitive)");
{
  // This literal was computed OUTSIDE this codebase, by a bare `node -e` one-liner using
  // raw crypto.createHash directly -- NOT by calling deriveMintAddress or any function in
  // this module. If a future edit to deriveMintAddress's canonicalization (sort order, JSON
  // shape, hash truncation length) changes the derived address for this fixed input, this
  // assertion FAILS, because the expected value does not move when the implementation does.
  // Independent computation (2026-08-06):
  //   node -e "const {createHash}=require('crypto');
  //            const sorted=['pearl_alpha','pearl_beta','pearl_gamma'].sort();
  //            console.log(createHash('sha256').update(JSON.stringify(sorted))
  //              .digest('hex').slice(0,32));"
  //   -> c485407e2ef0b162a352c23b655496fd
  const FIXED_PEARLS = ["pearl_alpha", "pearl_beta", "pearl_gamma"];
  const EXPECTED_FIXED_SID = "c485407e2ef0b162a352c23b655496fd";
  const actual = deriveMintAddress(FIXED_PEARLS);
  assert(
    actual === EXPECTED_FIXED_SID,
    "deriveMintAddress matches independently-computed literal",
    `expected ${EXPECTED_FIXED_SID}, got ${actual}`
  );
}

// ── Test 2: Determinism + order-independence via repeated calls ────────────
console.log("\nTest 2: Determinism + order-independence (repeated calls)");
{
  const pearls = ["pearl_x1", "pearl_x2", "pearl_x3"];
  const sid1 = deriveMintAddress(pearls);
  const sid2 = deriveMintAddress([...pearls].reverse());
  const sid3 = deriveMintAddress([...pearls, ...pearls]); // duplicated -- sort doesn't dedup
  assert(sid1 === sid2, "order-independent (pearls sorted internally)");
  // Duplication changes the literal input array, so it is EXPECTED to change the address --
  // this module does not silently dedup pearls; documenting the behavior, not a bug.
  assert(sid1 !== sid3, "duplicated pearls yield a different address (no silent dedup)");
}

// ── Test 3: mintChonk is idempotent ─────────────────────────────────────────
console.log("\nTest 3: mintChonk idempotence");
let SID_A: string;
{
  const before = crystalStats().mintedCount;
  SID_A = mintChonk(["pearl_A1", "pearl_A2"]);
  const afterFirst = crystalStats().mintedCount;
  const sidAgain = mintChonk(["pearl_A2", "pearl_A1"]); // same set, different call order
  const afterSecond = crystalStats().mintedCount;
  assert(SID_A === sidAgain, "re-minting the same pearl set returns the same sid");
  assert(afterFirst === before + 1, "first mint increases minted count by exactly 1");
  assert(afterSecond === afterFirst, "re-mint does not write a duplicate mint record");
}

// ── Test 4: resolveChonk on a never-minted sid ──────────────────────────────
console.log("\nTest 4: resolveChonk returns null for a never-minted sid");
{
  const bogus = deriveMintAddress(["pearl_never_minted_xyz"]);
  assert(resolveChonk(bogus) === null, "unminted sid resolves to null");
}

// ── Test 5: bindChonk -- new key appended ───────────────────────────────────
console.log("\nTest 5: bindChonk appends a new key");
{
  const res = bindChonk(SID_A, "workspace_root", {
    targetType: "file",
    ref: "C:\\Users\\Administrator\\Documents\\mnemosyne",
  });
  assert(res.ok === true, "bind accepted", res.error);
  assert(res.accepted === "appended", "accepted=appended", res.accepted);
  const resolved = resolveChonk(SID_A);
  assert(resolved?.bindings["workspace_root"]?.ref === "C:\\Users\\Administrator\\Documents\\mnemosyne", "binding resolves back");
}

// ── Test 6: bindChonk -- identical re-assertion is a no-op ─────────────────
console.log("\nTest 6: bindChonk idempotent re-assertion");
{
  const res = bindChonk(SID_A, "workspace_root", {
    targetType: "file",
    ref: "C:\\Users\\Administrator\\Documents\\mnemosyne",
  });
  assert(res.ok === true, "re-asserting the identical value is accepted");
  assert(res.accepted === "idempotent-noop", "accepted=idempotent-noop", res.accepted);
}

// ── Test 7: bindChonk -- DIFFERENT value on existing key is REJECTED ───────
console.log("\nTest 7: bindChonk rejects a silent change (the additive-by-default gate)");
{
  const res = bindChonk(SID_A, "workspace_root", {
    targetType: "file",
    ref: "C:\\some\\other\\path",
  });
  assert(res.ok === false, "silent change is rejected");
  assert(res.accepted === "rejected-additive-only", "accepted=rejected-additive-only", res.accepted);
  const resolved = resolveChonk(SID_A);
  assert(
    resolved?.bindings["workspace_root"]?.ref === "C:\\Users\\Administrator\\Documents\\mnemosyne",
    "rejected write did not mutate the existing binding"
  );
}

// ── Test 8: mutateChonkBinding rejects an invalid reason ───────────────────
console.log("\nTest 8: mutateChonkBinding rejects an invalid reason");
{
  // Deliberately an out-of-union string, to prove the RUNTIME guard (isMutationReason)
  // rejects it -- not merely a compile-time type constraint that could be bypassed by any
  // caller that isn't itself type-checked (e.g. a future IPC boundary from the renderer).
  const res = mutateChonkBinding(
    SID_A,
    "workspace_root",
    { targetType: "file", ref: "C:\\some\\other\\path" },
    "because_i_felt_like_it",
    "test attempt"
  );
  assert(res.ok === false, "invalid reason rejected");
  assert(res.accepted === "rejected-invalid-reason", "accepted=rejected-invalid-reason", res.accepted);
}

// ── Test 9: mutateChonkBinding rejects an empty note ────────────────────────
console.log("\nTest 9: mutateChonkBinding rejects an empty note");
{
  const res = mutateChonkBinding(
    SID_A,
    "workspace_root",
    { targetType: "file", ref: "C:\\some\\other\\path" },
    "explicit_ratification",
    "   "
  );
  assert(res.ok === false, "empty note rejected");
  assert(res.accepted === "rejected-invalid-reason", "accepted=rejected-invalid-reason", res.accepted);
}

// ── Test 10: mutateChonkBinding -- gated mutation, versioned sibling file ──
console.log("\nTest 10: mutateChonkBinding writes a .superseded.<ts> sibling, never overwrites in place");
{
  const before = resolveChonk(SID_A)!.bindings["workspace_root"];
  const res = mutateChonkBinding(
    SID_A,
    "workspace_root",
    { targetType: "file", ref: "C:\\some\\other\\path" },
    "explicit_ratification",
    "test: Founder ratified a workspace-root move"
  );
  assert(res.ok === true, "gated mutation accepted", res.error);
  assert(res.accepted === "superseded", "accepted=superseded", res.accepted);
  assert(!!res.supersededSiblingPath, "supersededSiblingPath returned");
  assert(
    !!res.supersededSiblingPath && existsSync(res.supersededSiblingPath),
    "the .superseded.<ts> sibling file actually exists on disk"
  );
  assert(
    !!res.supersededSiblingPath && /\.superseded\.[\d\-TZ.]+\.json$/.test(res.supersededSiblingPath),
    ".superseded.<UTC-ts> naming convention honored (HARDWIRE-00 Section 1.9)"
  );
  if (res.supersededSiblingPath) {
    const siblingContent = JSON.parse(readFileSync(res.supersededSiblingPath, "utf-8"));
    assert(
      JSON.stringify(siblingContent.previous_target) === JSON.stringify(before),
      "sibling file preserves the exact PRE-mutation value"
    );
    assert(siblingContent.reason === "explicit_ratification", "sibling records the reason");
  }
  const after = resolveChonk(SID_A)!.bindings["workspace_root"];
  assert(after.ref === "C:\\some\\other\\path", "log now resolves to the NEW value");
  const supersededFiles = existsSync(SUPERSEDED_DIR) ? readdirSync(SUPERSEDED_DIR) : [];
  assert(supersededFiles.length >= 1, "superseded/ directory holds at least one sibling file");
}

// ── Test 11: heterogeneous binding target (not-a-filesystem-path) ──────────
console.log("\nTest 11: heterogeneous binding targets (not foreclosing the Grapple Gun)");
{
  const sid = mintChonk(["pearl_mesh_test"]);
  const res = bindChonk(sid, "peer", {
    targetType: "mesh_peer",
    ref: "peer:9f3a-lianabanyan-wife-machine",
    meta: { discoveredVia: "MIC-broadcast", protocolVersion: 1 },
  });
  assert(res.ok === true, "non-filesystem targetType accepted", res.error);
  const resolved = resolveChonk(sid);
  assert(resolved?.bindings["peer"]?.targetType === "mesh_peer", "targetType round-trips");
  assert(
    (resolved?.bindings["peer"]?.meta as { discoveredVia?: string } | undefined)?.discoveredVia ===
      "MIC-broadcast",
    "arbitrary meta round-trips"
  );
}

// ─── Summary ──────────────────────────────────────────────────────────────
console.log(`\n${"=".repeat(55)}`);
console.log(`Results: ${passed} passed \u00b7 ${failed} failed`);
if (failed === 0) {
  console.log("\u2713 ALL TESTS PASSED -- Crystal store LANDED");
} else {
  console.error(`\u2717 ${failed} TESTS FAILED`);
  process.exit(1);
}

})();
