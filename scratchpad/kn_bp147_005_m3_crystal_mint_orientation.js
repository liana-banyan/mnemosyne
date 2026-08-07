// kn_bp147_005_m3_crystal_mint_orientation.js -- KN-BP147-M3 (dispatch D-BP147-005)
//
// ARM C setup script (run ONCE, by the measuring SEG, not by the cold actor under test).
// Mints the cold-start instrument's actual orientation content -- HARDWIRE-07's Section B
// (CelPane schema) + Section C (hex-addressing convention), read LIVE off the real file,
// lines 78-149, at the moment this script runs -- into the durable Crystal via the exact
// PUBLIC TOOL FUNCTIONS M1 wired (soccerball_emit / pearl_emit), not deriveMintAddress or
// any internal helper. This mirrors kn_bp147_005_m1_soccerball_pearl_farend_proof_write.js's
// wiring pattern exactly (same adapter shape, same compiled caithedral-core dist, same
// crystal_store.ts required by its .ts source) -- that file is read-only reference, not
// edited or duplicated in logic, only the wiring boilerplate is repeated because there is
// no shared harness module to import it from.
//
// This is the thing ARM C's cold actor resolves INSTEAD OF reading HARDWIRE-07 Section B/C
// directly with a file Read. Whether that resolution is cheaper, dearer, or a wash than the
// direct file read is exactly the open question Section C of HARDWIRE-07 already answers in
// the abstract ("an address, not a conduit") -- this script and its sibling resolve script
// make that answer concrete and measured for THIS specific content, not asserted.
//
// Isolation: uses its own MNEM_CRYSTAL_DIR under scratchpad, NEVER the real Electron
// userData Crystal that M1/M2 wired into the running app. This ticket's OWNS block is
// scratchpad-only; production Crystal data is read-only to this ticket.
//
// Usage:
//   node kn_bp147_005_m3_crystal_mint_orientation.js
// Prints the minted handle (soccerball_id) and the exact byte/word/line size of what was
// minted, to stdout, as JSON.

const fs = require('fs');
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

// ─── Read the LIVE orientation content off the real file, lines 78-149 ──────
// (HARDWIRE-07's Section B header through Section C's last content line, before the
// next "---" separator and Section D). This range is stable across this ticket's own
// edits: this ticket's OWNS block is Section G, which starts well after line 149, so
// re-running this script later in the same ticket re-derives the identical text and
// therefore the identical handle (determinism proof, not just a claim).
const HARDWIRE07_PATH = path.join(
  __dirname, '..', '..', 'LianaBanyanPlatform', 'HARDWIRE', 'HARDWIRE-07_THE_COLD_START_CHONK.md'
);
if (!fs.existsSync(HARDWIRE07_PATH)) {
  console.error('FATAL: HARDWIRE-07 path does not resolve: ' + HARDWIRE07_PATH);
  process.exit(1);
}
const allLines = fs.readFileSync(HARDWIRE07_PATH, 'utf-8').split('\n');
// Lines are 1-indexed in the file; array is 0-indexed. 78..149 inclusive.
const sectionBC = allLines.slice(77, 149).join('\n');

const wordsCount = sectionBC.split(/\s+/).filter(Boolean).length;
const charsCount = sectionBC.length;
const linesCount = sectionBC.split('\n').length;

// ─── Mint via the PUBLIC TOOL PATH (soccerball_emit / pearl_emit), content inlined ──
// as the binding's ref value -- ARM C's actor resolves the handle and receives this
// text directly, with NO subsequent file read for the CelPane/hex-addressing content.
// This is the concrete, non-strawman version of "fetch orientation content by
// resolving a Crystal binding instead of reading files directly": the content itself
// travels through the Crystal, not just a pointer to where the content still lives.
const PEARL_ID = 'hardwire07_sectionBC_orientation_v1';
const BINDINGS = { content: sectionBC, source: 'HARDWIRE-07:78-149', mode: 'inline_content_not_pointer' };

const soccerball_id = soccerballTools.soccerball_emit([PEARL_ID], BINDINGS);
const pearlResult = pearlTools.pearl_emit([PEARL_ID], BINDINGS);

const decoded = soccerballTools.soccerball_decode(soccerball_id);
const contentRoundTrips = decoded && decoded.bindings && decoded.bindings.content === sectionBC;

console.log(JSON.stringify({
  phase: 'MINT (ARM C setup) -- public tool path: soccerball_emit + pearl_emit, content inlined',
  pid: process.pid,
  pearl_id: PEARL_ID,
  soccerball_id,
  sids_agree: soccerball_id === pearlResult.soccerball_id,
  content_round_trips_immediately: contentRoundTrips,
  orientation_content_size: { words: wordsCount, chars: charsCount, lines: linesCount },
  crystal_dir: crystalStore.CRYSTAL_DIR,
  crystal_log_path: crystalStore.CRYSTAL_LOG_PATH,
  note: 'Handle is deterministic from PEARL_ID alone (deriveMintAddress ignores bindings) -- ' +
        're-running this script re-derives the SAME handle as long as HARDWIRE-07 lines 78-149 are unchanged.',
}, null, 2));
