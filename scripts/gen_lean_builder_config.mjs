#!/usr/bin/env node
// gen_lean_builder_config.mjs -- D-BP155-054/BISHOP/seg-split-installer-seed-corpus
//
// Derives a standalone electron-builder config for the LEAN installer variant from
// package.json's own "build" block, which stays the single source of truth for the
// COMPLETE build (npm run dist:win -- UNCHANGED, current behavior, current sovereignty
// claim intact). Rather than hand-maintain a second static config file that can drift
// from package.json over time, this script clones the real build block and edits ONLY
// what the Founder's order actually asked to differ:
//
//   - extraResources: drops the "resources/ollama" -> "ollama" entry (no Ollama binary,
//     no qwen2.5:0.5b weights -- this IS the entire size difference, ~433.6 MB per the
//     BP155 installer-contents inventory).
//   - asarUnpack: drops the matching "resources/ollama/**" unpack rule (nothing left to
//     unpack there); "dist/main/relay_answer/**" is untouched (unrelated to Ollama).
//   - nsis.artifactName / portable.artifactName: renamed so the two installers are
//     distinguishable at a glance in a Downloads folder (see the Founder-facing naming
//     note in the SEG return for the reasoning).
//   - extraMetadata.mnemoBuildVariant: 'lean', a harmless diagnostic marker, not read by
//     any app-behavior branch; the app's actual behavior difference (no bundled Ollama
//     fallback available) falls out naturally from resources/ollama simply not being on
//     disk in this build -- see ollama_manager.ts's _findBundledBinary(), unchanged.
//
// appId / productName / shortcutName are DELIBERATELY left identical to the COMPLETE
// build: this is still MnemosyneC, same product identity, same userData location, same
// upgrade path if a user later installs Ollama by hand or reinstalls COMPLETE. Only the
// installer artifact name changes, per the order's own instruction ("distinct output
// filenames"), not the installed product identity.
//
// Usage: node scripts/gen_lean_builder_config.mjs [outPath]
//   Reads package.json's build block, writes a complete (non-merged, standalone)
//   electron-builder JSON config to outPath (default: release/electron-builder.lean.json).

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const outPath = process.argv[2]
  ? join(REPO_ROOT, process.argv[2])
  : join(REPO_ROOT, 'release', 'electron-builder.lean.json');

const pkg = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf-8'));
const base = pkg.build;
if (!base) throw new Error('gen_lean_builder_config: package.json has no "build" block.');

const lean = JSON.parse(JSON.stringify(base)); // deep clone -- never mutate the COMPLETE config in memory

// Drop the Ollama extraResources entry.
const beforeCount = lean.extraResources.length;
lean.extraResources = lean.extraResources.filter((r) => r.to !== 'ollama');
if (lean.extraResources.length !== beforeCount - 1) {
  throw new Error(
    `gen_lean_builder_config: expected to remove exactly 1 extraResources entry (to:"ollama"), ` +
    `removed ${beforeCount - lean.extraResources.length}. package.json build.extraResources may have ` +
    `changed shape -- update this script rather than silently shipping a wrong LEAN build.`
  );
}

// Drop the matching asarUnpack rule.
lean.asarUnpack = (lean.asarUnpack || []).filter((p) => !p.includes('resources/ollama'));

// Distinct, at-a-glance artifact names (proposed -- see SEG return for naming rationale).
lean.nsis = { ...lean.nsis, artifactName: 'MnemosyneC-Lean-Setup-${version}.${ext}' };
lean.portable = { ...lean.portable, artifactName: 'MnemosyneC-Lean-Portable-${version}.${ext}' };

// Never publish from this generated config -- publication is Bishop's job, not this build.
lean.publish = null;

lean.extraMetadata = { ...(lean.extraMetadata || {}), mnemoBuildVariant: 'lean' };

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(lean, null, 2) + '\n', 'utf-8');
console.log(`[gen_lean_builder_config] wrote ${outPath}`);
console.log(`[gen_lean_builder_config] extraResources: ${lean.extraResources.map((r) => r.to).join(', ')}`);
console.log(`[gen_lean_builder_config] asarUnpack: ${JSON.stringify(lean.asarUnpack)}`);
