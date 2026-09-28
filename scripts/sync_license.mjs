#!/usr/bin/env node
// sync_license.mjs -- D-BP223-M0-h2cbpqug-037 / BISHOP-M0; rewritten D-BP223-BM0-X030-061 (Founder k/57dc48cf)
//
// FOUNDER ORDER, 2026-09-08T02:32Z, verbatim: "I want those as the licenses that are included in
// the Mnemosynec Download and in the two places online that we have licensing ... We need all of
// them accurate. And really, easiest just to have the one in the download."
//
// FOUNDER RULING, 2026-09-16T23:53Z (k/57dc48cf): "YES do all of that, and yes use defaults."
// The license is now the Mnemosyne Cooperative Source License 2.0 plus three companion documents.
// LICENSE_SSPL.md is retired (Rule 66 siblings LICENSE_SSPL.superseded.20260917T000803Z.md).
//
// THE SOURCES OF TRUTH are these four files at the root of this repo:
//   LICENSE.md             Mnemosyne Cooperative Source License 2.0
//   COMMERCIAL_LICENSE.md  Cooperative Endorsement Commercial License, with Exhibits A and B
//   NETWORK_TERMS.md       Substrate Network Terms
//   LICENSE_FAQ.md         plain-language FAQ (not part of any license)
// Every other on-disk copy this script reaches is a DERIVED COPY, never edited by hand.
//
// DERIVED COPIES:
//   caithedral-core\<file>  nested separate git repo, shipped inside the installer via
//                           node_modules/caithedral-core; kept byte-identical by copy.
//   LianaBanyanPlatform\<file>  the second tree of the ONE WORK (k/9658f728): "A copy of this same
//                           license ships at the root of each tree." Written only if that folder exists.
//
// THE ROOT COPIES THEMSELVES NEED NO SYNC STEP: electron-builder's build.extraFiles copies each
// root file to <name>.txt at PACKAGE time, straight from source.
//
// RULE 66: an overwritten copy gets a `.superseded.<UTC-ts>` sibling first. Never a silent overwrite.
// A legacy LICENSE_SSPL.md found beside a copy is REPORTED, not touched.
//
// Exit code: 0 if every derived copy is byte-identical to its source after this run. Non-zero if a
// source is missing or a copy could not be reconciled.
//
// Usage:  node scripts/sync_license.mjs
// Wired into the "build" npm script chain (prebuild position) -- see package.json.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILES = ['LICENSE.md', 'COMMERCIAL_LICENSE.md', 'NETWORK_TERMS.md', 'LICENSE_FAQ.md'];
const COPY_DIRS = [
  path.join(ROOT, 'caithedral-core'),
  'C:\\Users\\Administrator\\Documents\\LianaBanyanPlatform',
];

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function utcStamp() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
}

let failures = 0;

for (const name of FILES) {
  const source = path.join(ROOT, name);
  if (!fs.existsSync(source)) {
    console.error('SYNC LICENSE: source missing at ' + source + ' -- refusing to guess.');
    failures++;
    continue;
  }
  const sourceBuf = fs.readFileSync(source);
  const sourceHash = sha256(sourceBuf);
  console.log('SYNC LICENSE: source ' + name + '  sha256=' + sourceHash + '  (' + sourceBuf.length + ' bytes)');

  for (const dir of COPY_DIRS) {
    if (!fs.existsSync(dir)) {
      console.log('  ' + dir + ': folder absent on this machine, skipped.');
      continue;
    }
    const copyPath = path.join(dir, name);
    if (!fs.existsSync(copyPath)) {
      fs.writeFileSync(copyPath, sourceBuf);
    } else {
      const existingHash = sha256(fs.readFileSync(copyPath));
      if (existingHash === sourceHash) {
        console.log('  ' + copyPath + ': IDENTICAL, no write needed.');
        continue;
      }
      const ext = path.extname(name);
      const backupPath = path.join(dir, path.basename(name, ext) + '.superseded.' + utcStamp() + ext);
      fs.copyFileSync(copyPath, backupPath);
      fs.writeFileSync(copyPath, sourceBuf);
      console.log('  ' + copyPath + ': was STALE, sibling ' + backupPath);
    }
    const reread = sha256(fs.readFileSync(copyPath));
    if (reread === sourceHash) {
      console.log('  ' + copyPath + ': WRITTEN, now IDENTICAL  sha256=' + reread);
    } else {
      console.error('  ' + copyPath + ': write did not verify identical -- failure.');
      failures++;
    }
  }
}

for (const dir of [ROOT, ...COPY_DIRS]) {
  const legacy = path.join(dir, 'LICENSE_SSPL.md');
  if (fs.existsSync(legacy)) {
    console.log('  NOTE: legacy ' + legacy + ' is still present. It is retired; move it to a .superseded sibling.');
  }
}

if (failures > 0) {
  console.error('SYNC LICENSE: ' + failures + ' problem(s). Failing build.');
  process.exit(1);
}
console.log('SYNC LICENSE: all derived copies are byte-identical to source. OK.');
process.exit(0);
