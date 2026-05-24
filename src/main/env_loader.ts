// AMPLIFY Computer — Frame-Boilerplate Env Auto-Loader (BP038)
//
// Implements Blood Rule R16 (R-NO-API-KEY-EXPOSURE):
//   - Loads WORKING_KEYS.env from canonical vault location at process boot
//   - Sets process.env[KEY] = VALUE before any other module reads process.env
//   - Logs NAMES ONLY — values NEVER touch stdout, stderr, or any artifact
//   - Respects pre-existing env vars (does not clobber explicit overrides)
//
// Canon refs:
//   trinity_rule_r_no_api_key_exposure_blood_rule_bp038.eblet.md
//   bishop_coffee_blood_rules_section_mandate_canon_bp038.eblet.md
//   project_lb_frame_boilerplate_amplify_port_collision_auto.md
//
// This module MUST be imported FIRST in src/main/index.ts so its side-effects
// populate process.env before any consumer (wave_generator, opus_claude_adapter,
// substrate_api, etc.) reads from process.env at module-load time.

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';

function loadWorkingKeysEnv(): void {
  const candidates: string[] = [
    // 1. Explicit operator override
    process.env.LB_WORKING_KEYS_PATH,
    // 2. Canonical LockBox vault (BP038 Founder-ratified path)
    resolve(homedir(), 'Documents', 'LianaBanyanPlatform', 'Asteroid-ProofVault', 'LockBox', 'WORKING_KEYS.env'),
    // 3. Project-local fallback (amplify-computer/.env)
    resolve(process.cwd(), '.env'),
    // 4. User home fallback (~/.lb_substrate/WORKING_KEYS.env)
    resolve(homedir(), '.lb_substrate', 'WORKING_KEYS.env'),
  ].filter((p): p is string => Boolean(p));

  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue;

    let content: string;
    try {
      content = readFileSync(candidate, 'utf8');
    } catch (err) {
      console.error(`[LB Frame env-load] read failed for ${candidate}: ${(err as Error).message}`);
      continue;
    }

    const loadedNames: string[] = [];
    const skippedNames: string[] = [];

    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;

      const eq = line.indexOf('=');
      if (eq <= 0) continue;

      const key = line.slice(0, eq).trim();
      let val = line.slice(eq + 1).trim();

      // Strip surrounding quotes if present
      if (val.length >= 2) {
        const first = val[0];
        const last = val[val.length - 1];
        if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
          val = val.slice(1, -1);
        }
      }

      // Respect explicit overrides — don't clobber a key already set in the environment
      if (process.env[key] !== undefined && process.env[key] !== '') {
        skippedNames.push(key);
        continue;
      }

      process.env[key] = val;
      loadedNames.push(key);
    }

    // BLOOD RULE R16: log NAMES ONLY, never values
    console.log(
      `[LB Frame env-load] loaded ${loadedNames.length} keys from ${candidate}` +
      (loadedNames.length > 0 ? ` (names: ${loadedNames.join(', ')})` : '') +
      (skippedNames.length > 0 ? ` | skipped ${skippedNames.length} (already set: ${skippedNames.join(', ')})` : '')
    );
    return; // First found vault wins
  }

  console.warn(
    `[LB Frame env-load] no env vault found. Searched: ${candidates.join(' | ')}. ` +
    `Set LB_WORKING_KEYS_PATH or place WORKING_KEYS.env in the canonical LockBox path. ` +
    `SEG executors will error if ANTHROPIC_API_KEY is missing.`
  );
}

// Side-effect on module import — this is intentional.
// Importing this module MUST happen before any consumer reads process.env.
loadWorkingKeysEnv();
