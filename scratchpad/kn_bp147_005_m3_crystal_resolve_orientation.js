// kn_bp147_005_m3_crystal_resolve_orientation.js -- KN-BP147-M3 (dispatch D-BP147-005)
//
// ARM C's actual instrument. This is the script the COLD ACTOR UNDER TEST runs, in place
// of a file Read on HARDWIRE-07's Section B/C. It resolves the same 32-char Crystal handle
// that kn_bp147_005_m3_crystal_mint_orientation.js minted (re-derived here from the same
// fixed PEARL_ID via the public soccerball_emit function -- idempotent, so this call mints
// nothing new, it only re-derives the address and then decodes it), via the durable Crystal,
// exactly the "crystal:mint/crystal:resolve IPC path, or the underlying soccerball_emit/
// soccerball_decode/pearl_emit/pearl_decode public tool functions that M1 wired to the
// Crystal" the ticket names as the two acceptable resolution paths. This script uses the
// second (public tool function) path, in a freshly-spawned `node` process each time it is
// run -- a genuinely separate OS process from whatever minted the handle, same discipline
// as M1's own kill-and-restart proof.
//
// Usage (no arguments -- this is deliberately as close to zero-friction as a file Read):
//   node kn_bp147_005_m3_crystal_resolve_orientation.js
// Prints the resolved orientation content (CelPane schema + hex-addressing convention,
// verbatim, the same text HARDWIRE-07 Section B/C carries) to stdout.

const path = require('path');

const CRYSTAL_SCRATCH_DIR = path.join(__dirname, '_kn_bp147_005_m3_crystal');
process.env.MNEM_CRYSTAL_DIR = CRYSTAL_SCRATCH_DIR;

const CRYSTAL_STORE_PATH = path.join(__dirname, '..', 'src', 'main', 'crystal', 'crystal_store.ts');
const crystalStore = require(CRYSTAL_STORE_PATH);

const SOCCERBALL_TOOLS_PATH = path.join(__dirname, '..', 'caithedral-core', 'dist', 'main', 'tools', 'soccerball_tools.js');
const soccerballTools = require(SOCCERBALL_TOOLS_PATH);
const PEARL_TOOLS_PATH = path.join(__dirname, '..', 'caithedral-core', 'dist', 'main', 'tools', 'pearl_tools.js');
const pearlTools = require(PEARL_TOOLS_PATH);

function getMintTimestamp(sid) {
  const { existsSync, readFileSync } = require('fs');
  if (!existsSync(crystalStore.CRYSTAL_LOG_PATH)) return null;
  const raw = readFileSync(crystalStore.CRYSTAL_LOG_PATH, 'utf-8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const rec = JSON.parse(trimmed);
    if (rec.op === 'mint' && rec.sid === sid) return rec.ts;
  }
  return null;
}

const crystalAdapter = {
  mintChonk: crystalStore.mintChonk,
  resolveChonk: crystalStore.resolveChonk,
  bindChonk: crystalStore.bindChonk,
  getMintTimestamp,
};

soccerballTools.setDurableCrystalAdapter(crystalAdapter);
pearlTools.setPearlDurableCrystalAdapter(crystalAdapter);

const PEARL_ID = 'hardwire07_sectionBC_orientation_v1';

// Re-derive the handle from the fixed pearl id (idempotent -- proves determinism, same as
// M1's own read-side proof script) rather than requiring the caller to already hold it.
const handle = soccerballTools.soccerball_emit([PEARL_ID], {});
const decoded = soccerballTools.soccerball_decode(handle);
const pearlDecoded = pearlTools.pearl_decode(handle);

if (!decoded || !decoded.bindings || typeof decoded.bindings.content !== 'string') {
  console.error(JSON.stringify({
    ok: false,
    error: 'handle did not resolve to orientation content -- run kn_bp147_005_m3_crystal_mint_orientation.js first',
    pid: process.pid,
    handle,
    crystal_dir: crystalStore.CRYSTAL_DIR,
  }, null, 2));
  process.exit(1);
}

console.log('--- RESOLVED VIA DURABLE CRYSTAL (soccerball_decode / pearl_decode), NOT a file Read ---');
console.log('handle: ' + handle);
console.log('source (per binding metadata): ' + decoded.bindings.source);
console.log('mode (per binding metadata): ' + decoded.bindings.mode);
console.log('pearl_decode.found: ' + pearlDecoded.found);
console.log('--- BEGIN ORIENTATION CONTENT ---');
console.log(decoded.bindings.content);
console.log('--- END ORIENTATION CONTENT ---');
