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
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { homedir } from 'node:os';
import { app } from 'electron';

// BP132 Yoke #21 A1 (fix-forward): getEnvLoaderStatus() consumers (startup_diagnostic.ts,
// diagnostic_mode/index.ts env_loader_status command) referenced this export before it
// existed here, which broke `tsc -p tsconfig.main.json`. Track loader state as module
// locals and expose it read-only. BLOOD RULE R16 still applies: only key NAMES and a
// sha256 hash of the anon key are exposed, never raw values.
let _loadedFromPath: string | null = null;
let _loadedNames: string[] = [];
let _skippedNames: string[] = [];
let _pathsChecked: string[] = [];

export interface EnvLoaderStatus {
  supabaseUrl: string;
  supabaseUrlSource: 'vault' | 'pre-existing-env' | 'unresolved';
  anonKeySource: 'vault' | 'pre-existing-env' | 'unresolved';
  anonKeyHash: string | null;
  loadedFromPath: string | null;
  loadedKeyNames: string[];
  skippedKeyNames: string[];
  pathsChecked: string[];
}

function resolveKeySource(names: string[]): 'vault' | 'pre-existing-env' | 'unresolved' {
  if (names.some((n) => _loadedNames.includes(n))) return 'vault';
  if (names.some((n) => process.env[n])) return 'pre-existing-env';
  return 'unresolved';
}

/** Read-only snapshot of what the env loader resolved. Values never included — names/hashes only. */
export function getEnvLoaderStatus(): EnvLoaderStatus {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  return {
    supabaseUrl,
    supabaseUrlSource: resolveKeySource(['SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL']),
    anonKeySource: resolveKeySource(['SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']),
    anonKeyHash: anonKey ? createHash('sha256').update(anonKey).digest('hex').slice(0, 16) : null,
    loadedFromPath: _loadedFromPath,
    loadedKeyNames: _loadedNames,
    skippedKeyNames: _skippedNames,
    pathsChecked: _pathsChecked,
  };
}

function loadWorkingKeysEnv(): void {
  const candidates: string[] = [
    // 1. Explicit operator override
    process.env.LB_WORKING_KEYS_PATH,
    // 2. Packaged Electron app: supabase_public.env beside app.asar (BP086 I4b)
    //    Only checked on packaged builds — dev builds skip this and use LockBox
    app.isPackaged ? resolve(process.resourcesPath, 'supabase_public.env') : undefined,
    // 3. Canonical LockBox vault (BP038 Founder-ratified path)
    resolve(homedir(), 'Documents', 'LianaBanyanPlatform', 'Asteroid-ProofVault', 'LockBox', 'WORKING_KEYS.env'),
    // 4. Project-local fallback (amplify-computer/.env)
    resolve(process.cwd(), '.env'),
    // 5. User home fallback (~/.lb_substrate/WORKING_KEYS.env)
    resolve(homedir(), '.lb_substrate', 'WORKING_KEYS.env'),
  ].filter((p): p is string => Boolean(p));
  _pathsChecked = candidates;

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

      // Standard dotenv parsing (BP087 I11):
      //   Quoted values  → strip surrounding quotes; # inside quotes is NOT a comment
      //   Unquoted values → strip inline # comment (e.g., "eyJ…ngk  # gitleaks:allow")
      if (val.length >= 2) {
        const first = val[0];
        const last  = val[val.length - 1];
        if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
          val = val.slice(1, -1); // quoted — preserve content verbatim
        } else {
          const hashIdx = val.indexOf('#');
          if (hashIdx > -1) val = val.slice(0, hashIdx).trim();
        }
      } else {
        const hashIdx = val.indexOf('#');
        if (hashIdx > -1) val = val.slice(0, hashIdx).trim();
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
    _loadedFromPath = candidate;
    _loadedNames = loadedNames;
    _skippedNames = skippedNames;
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
