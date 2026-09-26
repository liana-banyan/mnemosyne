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

// D-BP223-BM0-X033-002/BISHOP/seg-autoupdate-feed-fix: DO NOT set lean.publish = null here.
// That line (D-BP155-054) intended "never actually publish/upload from this generated config",
// but electron-builder does not distinguish those two things the way the comment assumed:
// app-builder-lib's PublishManager.getPublishConfigs() treats an explicit `publish: null` as
// "do not even write update-info files" (app-builder-lib/out/publish/PublishManager.js:328-330),
// which short-circuits artifactCreatedWithoutExplicitPublishConfig() before it ever schedules
// createUpdateInfoTasks() (same file, lines 143-148 and 158-163) -- so latest.yml/app-update.yml
// are never written at all, for every LEAN press since the LEAN variant was introduced.
// Actual publication safety does NOT depend on nulling this field: the base config's own
// publish block (package.json build.publish, cloned into `lean` above) uses
// {"provider":"generic", "url":"https://mnemosynec.ai/download/"} -- and electron-builder's
// generic provider has no upload capability at all (PublishManager.js scheduleUpload(),
// lines 113-115: `if (publishConfig.provider === "generic") { return; }`). The press script's
// own `--publish never` flag (PRESS_SIGNED_BUILD_0932.ps1) is a second, independent guarantee
// against any upload attempt. So simply NOT nulling `lean.publish` here is safe: it lets the
// LEAN config inherit the exact same generic/mnemosynec.ai publish block the COMPLETE build
// already ships with (this is also how 0.9.28 got a correct latest.yml -- via `npm run
// publish:win`, which runs electron-builder against package.json's build block directly,
// never through this generated LEAN config, so it was never affected by this bug), while
// still never uploading anything anywhere.

lean.extraMetadata = { ...(lean.extraMetadata || {}), mnemoBuildVariant: 'lean' };

// D-BP223-PQ005-012-X041 (Founder 2026-09-26: "a pipeline to send new updates asap so people know new capabilities"):
// ONE notes file per version, RELEASE_NOTES/<version>.md, feeds every surface. Here it feeds the in-app updater:
// electron-builder writes releaseInfo.releaseNotes into latest.yml, electron-updater hands it to auto_updater.ts as
// info.releaseNotes, and the renderer's UpdateState.releaseNotes already shows it beside "vX is ready". When the file is
// absent the config is unchanged (no notes, same as every press before this one). Never invented: read from the file.
import { existsSync } from 'node:fs';
const notesFile = join(REPO_ROOT, 'RELEASE_NOTES', `${pkg.version}.md`);
if (existsSync(notesFile)) {
  const notes = readFileSync(notesFile, 'utf-8').trim();
  lean.releaseInfo = { ...(lean.releaseInfo || {}), releaseNotes: notes };
  console.log(`[gen_lean_builder_config] releaseInfo.releaseNotes: ${notes.length} chars from RELEASE_NOTES/${pkg.version}.md`);
} else {
  console.log(`[gen_lean_builder_config] no RELEASE_NOTES/${pkg.version}.md; latest.yml will carry no release notes`);
}

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(lean, null, 2) + '\n', 'utf-8');
console.log(`[gen_lean_builder_config] wrote ${outPath}`);
console.log(`[gen_lean_builder_config] extraResources: ${lean.extraResources.map((r) => r.to).join(', ')}`);
console.log(`[gen_lean_builder_config] asarUnpack: ${JSON.stringify(lean.asarUnpack)}`);
console.log(`[gen_lean_builder_config] publish: ${JSON.stringify(lean.publish)}`);
