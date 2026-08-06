/**
 * crystal_proof_write.ts -- KN-BP147-M1 far-end proof, PROCESS A.
 *
 * Mints a chonk, binds it, and exits. Run this as its own `node` invocation, let the process
 * end naturally, THEN run crystal_proof_read.ts as a SEPARATE `node` invocation (a genuinely
 * different PID) against the same MNEM_CRYSTAL_DIR. Per HARDWIRE-00 Section 1.5 ("prove the
 * far end, not the action") and the ticket's own text ("an in-memory round-trip proves
 * nothing here -- process death is the entire test"), this is two real OS processes, not a
 * mocked restart within one process.
 *
 * Usage:
 *   $env:MNEM_CRYSTAL_DIR = "C:\...\_crystal_farend_proof"; node crystal_proof_write.ts
 */
// See crystal_store.test.ts's header note: this directory's own package.json declares
// "type": "commonjs", so require() (not import) is used here for zero-build-step execution.
//
// Wrapped in an IIFE (rather than bare top-level consts) so tsc's whole-project type-check
// does not treat this file as a global ambient script and collide its top-level names with
// crystal_proof_read.ts / crystal_store.test.ts's identically-named top-level consts --
// those three files have no ESM import/export marker, which is what tsc uses to decide
// "module scope" vs "global script scope" for a file with none.
(function main(): void {
  const { mintChonk, bindChonk, resolveChonk, CRYSTAL_DIR, CRYSTAL_LOG_PATH } = require("./crystal_store.ts");

  const PEARLS = ["pearl_farend_proof_1", "pearl_farend_proof_2"];

  const sid = mintChonk(PEARLS);

  bindChonk(sid, "repo_root", {
    targetType: "file",
    ref: "C:\\Users\\Administrator\\Documents\\mnemosyne",
  });
  bindChonk(sid, "peer", {
    targetType: "mesh_peer",
    ref: "peer:M0-lianabanyan-primary",
    meta: { discoveredVia: "KN-BP147-M1 far-end proof", pid: process.pid },
  });

  const resolved = resolveChonk(sid);

  console.log(
    JSON.stringify(
      {
        phase: "WRITE (process A)",
        pid: process.pid,
        pearls: PEARLS,
        sid,
        crystal_dir: CRYSTAL_DIR,
        crystal_log_path: CRYSTAL_LOG_PATH,
        resolved,
      },
      null,
      2
    )
  );
})();
