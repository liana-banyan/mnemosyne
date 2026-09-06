// method_tree_switch.ts -- THE METHOD TREE'S OWN SWITCH, AND IT FAILS **OPEN**.
//
// D-BP211-BM0-h2cbpq8k-017 / BISHOP-M0 (XO), session 1c164c48, signature BM0-20260902T1732Z.
//
// KORSAIKOFF GATE, ANSWERED. Two candidates named, both opened, both prose:
//   ORDER_BP211_WO_HAS_THE_METHOD_TREE_EVER_RUN.md   the order. Asks the question.
//   BP211_WO_HAS_THE_METHOD_TREE_EVER_RUN.md          the answer, read in full this session. Its
//     finding is the PREMISE of this file, not a duplicate of it: "The method tree has no settings
//     file, no env flag and no kill switch at all: its IPC handler is registered unconditionally.
//     It is ON BY DEFAULT AND ALWAYS HAS BEEN."
// The only CODE sibling is `src/main/plow/liana_cycle_scheduler.ts`'s
// readLianaCycleEnabledFromSettings(). I READ IT IN FULL. It is the PLOW-SIDE engine's switch, it
// reads `liana_cycle_settings.json`, and it FAILS CLOSED. This file is the OTHER engine's switch,
// reads a DIFFERENT file, and FAILS OPEN. Same shape on purpose; opposite default on purpose.
// Not a duplicate, and see below for why sharing one switch between the two would be the real bug.
//
// FOUNDER ORDER, 2026-09-02T19:03:06Z, verbatim:
//   "Yes agreed, make the switch, and yes the two engines don't get the same switch, and yes have
//    opposite defaults.  Do that, please."
//
// ── WHY THERE ARE TWO ENGINES AT ALL, SO NOBODY "FIXES" THIS BACK INTO ONE ────────────────────
// BP211 established that "Liana Cycle" names two halves of one machine, both ratified by canon:
//   THE TAUGHT HALF   src/main/liana_cycle/          the method registry. A human teaches a
//                     method once, in the terminal, and it banks.
//   THE FLOWN HALF    src/main/plow/liana_cycle_*    the autonomous runner. It spends what the
//                     taught half banked, ten thousand times, without the Founder.
// They are not rivals and they are not duplicates. THE METHOD BANK IS WHAT THE TAUGHT HALF FILLS
// AND WHAT THE FLOWN HALF SPENDS.
//
// ── WHY THE DEFAULTS ARE OPPOSITE. THIS IS THE WHOLE POINT OF THE FILE. ───────────────────────
// A default is not a style choice. It is the answer to "what happens when the settings file is
// absent," and the ABSENT case is the one that actually occurs.
//
//   THE FLOWN HALF FAILS CLOSED (absent file -> OFF), AND THAT IS CORRECT.
//   It is a continuous autonomous runner that does real work on a real machine. It has never run
//   in production -- measured at BP211, four ways -- precisely BECAUSE its settings file has never
//   existed. Starting a scheduler by accident is the risk there, so silence must mean stop.
//
//   THE TAUGHT HALF FAILS **OPEN** (absent file -> ON), AND THE REASON IS NOT SYMMETRY.
//   This engine HAS run in production, many times, leaving 944 dated artifacts across five write
//   paths. Its IPC handler has always been registered unconditionally: it is on today, and it has
//   never had a switch of any kind. IF THIS SWITCH FAILED CLOSED, ADDING IT WOULD SILENTLY TURN
//   OFF THE HALF THAT IS ALREADY WORKING -- a fresh machine, a cleared userData, a corrupt JSON,
//   and the Founder's terminal quietly answers nothing with no error to read. THAT IS THE EXACT
//   FAILURE CLASS THIS ESTATE CALLS SILENT PARTIAL DELIVERY, and shipping a new one inside a
//   safety feature would be worse than shipping no switch at all.
//
// ── WHAT THIS SWITCH IS ACTUALLY FOR, AND IT IS NOT SAFETY ────────────────────────────────────
// IT IS FOR MEASUREMENT. You cannot run a control arm against something you cannot turn off.
// The Founder's BP168 order -- "substrate versus no-substrate, tokens per CORRECT answer," card
// `t-f5e9e960` -- has been open partly because there was no way to run the with-method-tree and
// without-method-tree arms on the same machine. This is that way. It is a scalpel for an
// experiment, not a guard against a runaway.
//
// ── THE FILENAME IS DELIBERATELY NOT `liana_cycle_settings.json` ──────────────────────────────
// That name belongs to the flown half. Two engines reading one settings key under one name IS the
// collision BP211 spent a dispatch untangling, and re-using it here would rebuild the confusion in
// code after we just took it apart in prose. One engine, one file, one meaning.

import { app } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const METHOD_TREE_SETTINGS_FILE = 'method_tree_settings.json';

interface MethodTreeSettings {
  enabled?: boolean;
}

/** Resolves the settings directory. `LB_METHOD_TREE_SETTINGS_DIR` overrides it so a test can
 *  exercise the real read/write logic against a temp directory without an Electron app object --
 *  the plow-side switch has no such seam and is therefore only testable inside Electron, which is
 *  one reason its behavior went unverified for so long. */
function settingsDir(): string {
  const override = process.env.LB_METHOD_TREE_SETTINGS_DIR;
  if (override && override.trim()) return override.trim();
  return app.getPath('userData');
}

/**
 * FAIL-OPEN default: ON. A missing file, unreadable file, malformed JSON, or absent `enabled`
 * key all mean ENABLED, because none of those is the Founder saying "stop."
 *
 * ONLY AN EXPLICIT `"enabled": false` TURNS THIS ENGINE OFF. That is the single sentence to
 * remember about this function, and it is the inverse of the flown half's rule.
 */
export function readMethodTreeEnabledFromSettings(): boolean {
  try {
    const p = join(settingsDir(), METHOD_TREE_SETTINGS_FILE);
    if (!existsSync(p)) return true;
    const parsed = JSON.parse(readFileSync(p, 'utf-8')) as MethodTreeSettings;
    // Explicit false is the ONLY off. `undefined`, `null`, `0`, `"false"` and every other shape a
    // hand-edited JSON file can carry are NOT an instruction to stop, and must not be read as one.
    return parsed?.enabled !== false;
  } catch (err) {
    console.warn('[method_tree_switch] read failed (FAIL-OPEN, staying ON):', err);
    return true;
  }
}

/** Writes the flag. Preserves any other keys already in the file rather than replacing it, so a
 *  future setting added beside `enabled` is not silently destroyed by a toggle. */
export function writeMethodTreeEnabledToSettings(enabled: boolean): void {
  try {
    const dir = settingsDir();
    mkdirSync(dir, { recursive: true });
    const p = join(dir, METHOD_TREE_SETTINGS_FILE);
    const current: MethodTreeSettings = existsSync(p)
      ? (JSON.parse(readFileSync(p, 'utf-8')) as MethodTreeSettings)
      : {};
    current.enabled = enabled;
    writeFileSync(p, JSON.stringify(current, null, 2), 'utf-8');
  } catch (err) {
    console.error('[method_tree_switch] write failed:', err);
  }
}

/** The path, exported so a status route or a report can name it instead of re-deriving it. */
export function methodTreeSettingsPath(): string {
  return join(settingsDir(), METHOD_TREE_SETTINGS_FILE);
}
