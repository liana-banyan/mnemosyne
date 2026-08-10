// register_gate_loader.ts -- D-BP149-041/BISHOP/S41/seg-methodregistry, revised D-BP151-041
//
// Loads scripts/register_gate.mjs -- a real, standalone ESM module -- into the Electron main
// process. Ticket instruction: "Import it, do not reproduce it." This file makes that import
// actually work at runtime; register_gate.mjs's own source is never read into another file or
// edited.
//
// ONE PROBLEM SOLVED HERE, NOT BY TOUCHING register_gate.mjs:
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
// D-BP151-041/BISHOP/seg-register-gate-inprocess: problem 2 that used to be solved here --
// polyfilling a global `WebSocket` (via the `ws` package) because register_gate.mjs called
// `new WebSocket(...)` to dial CDP directly -- no longer applies. register_gate.mjs now reaches
// Google through an injected `askGoogle` function (comparative_cascade.ts's own ctx.askGoogle,
// the SAME in-process bridge, runBrowserAuthorityQueryFromMain, every other caller in this
// estate uses) instead of a CDP round trip, so it never constructs a WebSocket at all. The
// polyfill and its `ws` import are deleted, not left dormant -- see
// REGISTER_GATE_WEBCONTENTS_FEASIBILITY_BP151.md (D-BP151-040) for the finding this implements.
//
// SCOPE: dev-path only. scripts/ is not in electron-builder's `files` allowlist
// (package.json's `build.files`), so a packaged build has no register_gate.mjs on disk.
// loadRegisterGate() throws a clear, honest error in that case rather than silently no-opping
// the register gate.

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { app } from 'electron';

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

/** D-BP151-041: the shape runRegisterGate() now requires an injected asker to match -- see
 *  register_gate.mjs's own "Google, via the injected in-process bridge" doc comment. Deliberately
 *  a subset of comparative_cascade.ts's GoogleAnswer (ok + blocks only, no text/sources/via), so
 *  comparative_cascade.ts's own googleBlocks(ctx.askGoogle, question) return value satisfies this
 *  type with no adapter needed beyond dropping the extra fields TypeScript already allows. */
export type RegisterGateAskGoogle = (
  question: string,
) => Promise<{ ok: boolean; blocks: Array<{ title: string; body: string; url: string; kind: string }> }>;

export interface RegisterGateModule {
  runRegisterGate: (
    options: Record<string, string>,
    opts: { verbose?: boolean; askGoogle: RegisterGateAskGoogle },
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
