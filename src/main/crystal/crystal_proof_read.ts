/**
 * crystal_proof_read.ts -- KN-BP147-M1 far-end proof, PROCESS B.
 *
 * Run AFTER crystal_proof_write.ts's process has fully exited, as a SEPARATE `node`
 * invocation against the SAME MNEM_CRYSTAL_DIR. Does not receive the sid as an argument --
 * it RE-DERIVES the address from the same fixed pearl set (proving determinism, not just
 * lookup), then resolves the durable log fresh from disk (proving persistence across the
 * process boundary) and asserts the bindings written by process A are exactly present.
 *
 * Usage:
 *   $env:MNEM_CRYSTAL_DIR = "C:\...\_crystal_farend_proof"; node crystal_proof_read.ts
 */
// See crystal_store.test.ts's header note: this directory's own package.json declares
// "type": "commonjs", so require() (not import) is used here for zero-build-step execution.
//
// Wrapped in an IIFE for the same reason as crystal_proof_write.ts: a bare top-level const
// in a file with no ESM import/export marker is treated by tsc as global-script scope, and
// would otherwise collide with identically-named top-level consts in the sibling files.
(function main(): void {
  const { deriveMintAddress, resolveChonk, CRYSTAL_DIR, CRYSTAL_LOG_PATH } = require("./crystal_store.ts");

  const PEARLS = ["pearl_farend_proof_1", "pearl_farend_proof_2"];

  // Re-derive independently -- process B never received process A's sid over any channel.
  const sid = deriveMintAddress(PEARLS);
  const resolved = resolveChonk(sid);

  const repoRootOk = resolved?.bindings["repo_root"]?.ref === "C:\\Users\\Administrator\\Documents\\mnemosyne";
  const peerOk = resolved?.bindings["peer"]?.targetType === "mesh_peer";
  const writerPid = (resolved?.bindings["peer"]?.meta as { pid?: number } | undefined)?.pid;

  const pass = resolved !== null && repoRootOk && peerOk;

  console.log(
    JSON.stringify(
      {
        phase: "READ (process B, separate PID, after process A exited)",
        pid: process.pid,
        writer_process_pid_recorded_in_binding: writerPid,
        pid_differs_from_writer: writerPid !== undefined && writerPid !== process.pid,
        pearls: PEARLS,
        re_derived_sid: sid,
        crystal_dir: CRYSTAL_DIR,
        crystal_log_path: CRYSTAL_LOG_PATH,
        resolved,
        checks: { repoRootOk, peerOk },
        result: pass ? "PASS -- identical address, identical bindings, across process death" : "FAIL",
      },
      null,
      2
    )
  );

  if (!pass) process.exit(1);
})();
