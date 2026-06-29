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
//
// BP099-K16 augmentation: adds EnvLoaderStatus + getEnvLoaderStatus() for
// diagnostic_mode and startup_diagnostic consumers.

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';

// ─── Diagnostic state (consumed by diagnostic_mode + startup_diagnostic) ──────
// §4 BLOOD: anonKeyHash is sha256 of anon key value -- key value never stored here.

export interface EnvLoaderStatus {
  supabaseUrl: string;
  supabaseUrlSource: 'env' | 'fallback' | 'vault' | 'absent';
  anonKeySource: 'env' | 'fallback' | 'vault' | 'absent';
  anonKeyHash: string;
  pathsChecked: Array<{ path: string; exists: boolean }>;
  activeVaultPath: string | null;
}

let _status: EnvLoaderStatus = {
  supabaseUrl: '',
  supabaseUrlSource: 'absent',
  anonKeySource: 'absent',
  anonKeyHash: '',
  pathsChecked: [],
  activeVaultPath: null,
};

export function getEnvLoaderStatus(): EnvLoaderStatus {
  return { ..._status };
}

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

  const pathsChecked: Array<{ path: string; exists: boolean }> = [];

  for (const candidate of candidates) {
    const exists = existsSync(candidate);
    pathsChecked.push({ path: candidate, exists });
    if (!exists) continue;

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

      // Standard dotenv parsing:
      //   Quoted values  --> strip surrounding quotes; # inside quotes is NOT a comment
      //   Unquoted values --> strip inline # comment (e.g., "eyJ...ngk  # gitleaks:allow")
      if (val.length >= 2) {
        const first = val[0];
        const last  = val[val.length - 1];
        if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
          val = val.slice(1, -1); // quoted -- preserve content verbatim
        } else {
          const hashIdx = val.indexOf('#');
          if (hashIdx > -1) val = val.slice(0, hashIdx).trim();
        }
      } else {
        const hashIdx = val.indexOf('#');
        if (hashIdx > -1) val = val.slice(0, hashIdx).trim();
      }

      // Respect explicit overrides -- don't clobber a key already set in the environment
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

    // Capture diagnostic state after successful vault load
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const anonKeyHash = anonKey
      ? createHash('sha256').update(anonKey).digest('hex')
      : '';

    // Determine source: LockBox = 'vault', cwd .env = 'fallback'
    const isVault =
      candidate.includes('LockBox') ||
      candidate.includes('.lb_substrate');
    const isFallback = candidate.includes('.env') && !isVault;

    _status = {
      supabaseUrl,
      supabaseUrlSource: supabaseUrl ? (isVault ? 'vault' : isFallback ? 'fallback' : 'env') : 'absent',
      anonKeySource: anonKey ? (isVault ? 'vault' : isFallback ? 'fallback' : 'env') : 'absent',
      anonKeyHash,
      pathsChecked,
      activeVaultPath: candidate,
    };

    return; // First found vault wins
  }

  // No vault found -- populate status from existing process.env
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  _status = {
    supabaseUrl,
    supabaseUrlSource: supabaseUrl ? 'env' : 'absent',
    anonKeySource: anonKey ? 'env' : 'absent',
    anonKeyHash: anonKey ? createHash('sha256').update(anonKey).digest('hex') : '',
    pathsChecked,
    activeVaultPath: null,
  };

  console.warn(
    `[LB Frame env-load] no env vault found. Searched: ${candidates.join(' | ')}. ` +
    `Set LB_WORKING_KEYS_PATH or place WORKING_KEYS.env in the canonical LockBox path. ` +
    `SEG executors will error if ANTHROPIC_API_KEY is missing.`
  );
}

// Side-effect on module import — this is intentional.
// Importing this module MUST happen before any consumer reads process.env.
loadWorkingKeysEnv();
