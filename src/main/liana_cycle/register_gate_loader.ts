// register_gate_loader.ts -- D-BP149-041/BISHOP/S41/seg-methodregistry
//
// Loads scripts/register_gate.mjs -- a real, standalone ESM module -- into the Electron main
// process. Ticket instruction: "Import it, do not reproduce it." This file makes that import
// actually work at runtime; register_gate.mjs's own source is never read into another file or
// edited.
//
// TWO PROBLEMS SOLVED HERE, NEITHER BY TOUCHING register_gate.mjs:
//
// 1. tsc, under this repo's own tsconfig.json ("module": "CommonJS"), compiles a plain
//    `await import(specifier)` down to `Promise.resolve().then(() => require(specifier))`
//    (measured directly against this repo's tsconfig before writing this file). require()
//    cannot load a real ESM file -- it throws ERR_REQUIRE_ESM. Fix: hide the import() call
//    inside `new Function(...)` so tsc never sees it as a statically-analyzable import and
//    cannot downlevel it. At runtime this evaluates to Node's own NATIVE dynamic import, which
//    loads ESM regardless of the calling module's type. This is the standard CJS-to-ESM
//    interop technique, not novel to this file.
//
// 2. register_gate.mjs calls `new WebSocket(...)` as a bare global -- correct when it was run
//    tonight as a standalone `node scripts\register_gate.mjs` script under the SYSTEM Node
//    (measured here: v24.11.0, which has WebSocket built in). Electron 31.7.7's bundled
//    main-process Node is v20.18.0 -- measured directly (ELECTRON_RUN_AS_NODE=1, `typeof
//    WebSocket` -> 'undefined') before writing this file. Fix: install the `ws` package
//    (already a repo dependency, used elsewhere for federation/relay) as globalThis.WebSocket
//    before the dynamic import resolves. This is a runtime environment shim, not a file edit.
//
// SCOPE: dev-path only. scripts/ is not in electron-builder's `files` allowlist
// (package.json's `build.files`), so a packaged build has no register_gate.mjs on disk.
// loadRegisterGate() throws a clear, honest error in that case rather than silently no-opping
// the register gate -- out of scope for this ticket, which proves the terminal live in dev over
// CDP 9333, same as liana_terminal_engine.ts's existing resolveBundledDatasetPath() dev-only
// convention for resources/mmlu_pro_bundled/questions.jsonl.

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { app } from 'electron';
import WS from 'ws';

if (typeof (globalThis as unknown as { WebSocket?: unknown }).WebSocket === 'undefined') {
  (globalThis as unknown as { WebSocket: unknown }).WebSocket = WS;
}

// See problem 1 above -- this MUST stay a runtime-constructed Function, not a literal
// `import(...)` expression, or tsc will downlevel it to `require()` again.
const dynamicImport = new Function('specifier', 'return import(specifier)') as (
  specifier: string,
) => Promise<unknown>;

export interface RegisterGateEvidence {
  about: number;
  featureHits: Array<{ title: string; claims: string }>;
  regionHits: Array<{ title: string; claims: string }>;
}

export interface RegisterGateReportEntry {
  verdict: 'world_region' | 'not_a_world_region' | 'undetermined' | 'no_answer' | string;
  evidence?: RegisterGateEvidence;
  scope?: { verdict: string; why: string };
  blocks?: number;
}

export interface RegisterGateModule {
  runRegisterGate: (
    options: Record<string, string>,
    opts?: { verbose?: boolean },
  ) => Promise<{ notRegions: string[]; report: Record<string, RegisterGateReportEntry> }>;
  isAssertion: (sentence: string) => boolean;
  mentions: (text: string, optionText: string, allOptionTexts: string[]) => boolean;
  headTokenFor: (optionText: string, allOptionTexts: string[]) => string;
}

let cached: RegisterGateModule | null = null;

function resolveRegisterGatePath(): string {
  return resolve(app.getAppPath(), 'scripts', 'register_gate.mjs');
}

/** Loads (and caches) register_gate.mjs's real exports. Throws a plain, honest Error --
 *  never a silent fallback -- when the script is not on disk (packaged build) or fails to
 *  import; callers (comparative_cascade.ts) must surface that to the transcript rather than
 *  swallowing it, per this estate's honest-abstain-over-fabrication rule. */
export async function loadRegisterGate(): Promise<RegisterGateModule> {
  if (cached) return cached;
  const scriptPath = resolveRegisterGatePath();
  if (!existsSync(scriptPath)) {
    throw new Error(
      `register_gate.mjs not found at ${scriptPath} (dev-only module, not shipped in a packaged build)`,
    );
  }
  const mod = (await dynamicImport(pathToFileURL(scriptPath).href)) as RegisterGateModule;
  cached = mod;
  return mod;
}
