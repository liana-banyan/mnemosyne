// electron_shim.cjs -- D-BP164-M0-088/SEG-HN. NOT part of the mnemosyne repo. A standalone Node
// process shim so the CLI driver (teach_by_hand_cli.ts, compiled to dist/main/liana_cycle/) can
// import liana_terminal_engine.js OUTSIDE Electron. Only the members that file (and its callees,
// e.g. survey_cache.ts's defaultSurveyCacheFilePath()) actually read are provided. Everything else
// on `app` is deliberately absent -- any other Electron API this run touches will throw loudly
// rather than return a silent fake.
//
// D-BP164-M0-126/BISHOP-SEG-WIDEN -- `app.getPath` ADDED. MEASURED, every live run of this driver
// before this change: survey_cache.ts's defaultSurveyCacheFilePath() does `require('electron').app
// .getPath('userData')`, this shim exposed no such member, so the call threw
// `TypeError: app.getPath is not a function`, caught by safeDefaultSurveyCacheStore()'s own
// try/catch (survey_cache.ts) and printed as a raw stack trace on every run
// ("[SurveyCache] No real Electron userData path available ..."). Not fatal -- the catch falls
// back to NullSurveyCacheStore, exactly the documented degrade-gracefully path -- but two things
// were wrong: the CLI could never cache a Survey result across runs, and the operator saw a stack
// trace every time for a condition that has a sane, cheap fix. Returns a real, writable, local
// directory (HARDWIRE\LEDGER\TEACH_BY_HAND_USERDATA, a sibling of teach_by_hand_cli.ts's own
// LIANA_RUNS_DIR under the same HARDWIRE\LEDGER root) so `resolve(app.getPath('userData'),
// 'substrate', 'liana_survey_cache.jsonl')` (survey_cache.ts) resolves to a real path and the
// FileSurveyCacheStore constructs successfully -- mkdirSync'd eagerly here so a caller never has
// to special-case first-run absence. `name` is accepted and ignored beyond `'userData'`: nothing
// this driver touches calls getPath with any other value (measured, this ticket -- see report),
// so returning the same directory for any name is a considered no-op, not an unverified guess
// dressed up as general support.
const path = require('path');
const fs = require('fs');

const REPO_ROOT = 'C:\\Users\\Administrator\\Documents\\mnemosyne';
const USER_DATA_DIR =
  'C:\\Users\\Administrator\\Documents\\LianaBanyanPlatform\\HARDWIRE\\LEDGER\\TEACH_BY_HAND_USERDATA';

try {
  fs.mkdirSync(USER_DATA_DIR, { recursive: true });
} catch {
  // Non-fatal: getPath() below still returns the path even if the eager mkdir failed (e.g. a
  // race with another process creating it first); the real caller (FileSurveyCacheStore) does
  // its own mkdirSync before writing and will surface a real error if the directory is
  // genuinely unwritable.
}

module.exports = {
  app: {
    isPackaged: false,
    getAppPath() {
      return REPO_ROOT;
    },
    getPath(_name) {
      return USER_DATA_DIR;
    },
  },
};
