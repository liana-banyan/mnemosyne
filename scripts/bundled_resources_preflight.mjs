// bundled_resources_preflight.mjs -- D-BP168-M0-079 / BISHOP-M0 (XO)
//
// Founder order, 2026-08-26: "make the build FAIL LOUDLY when the file is absent, or fetch it by
// SHA at build time."
//
// THE DEFECT THIS EXISTS TO CATCH, stated concretely because a guard without its incident is a
// guard nobody maintains. src/main/ollama_manager.ts tells a user whose Ollama fails to start:
// "Reinstall MnemosyneC to repair (the installer includes vc_redist.x64.exe)", and points them at
// %LOCALAPPDATA%\Programs\MnemosyneC\resources\vcredist\vc_redist.x64.exe.
//
// THE INSTALLER DOES NOT INCLUDE IT. There is no vcredist entry in this package.json's
// extraResources, assets/installer.nsh never mentions it, and resources/vcredist/ does not exist
// in this tree at all. A user following that instruction reaches a path that was never populated,
// while already in the failure state the message was written for. It is the worst possible moment
// to be handed a phantom.
//
// (The binary AND the extraResources entry both exist in the retired BP166 Electron twin under
// LianaBanyanPlatform. That is exactly why this went unnoticed twice: an audit that looks there
// finds everything present and correct. THIS tree -- Mnemosyne, package name "amplify-computer",
// the one whose package.json actually builds MnemosyneC -- is the one that ships.)
//
// THE GENERAL RULE, which is the part worth keeping: IF THE CODE PROMISES THE USER A FILE, THE
// BUILD MUST PROVE THAT FILE SHIPS. This does not hard-code a vc_redist check. It reads the
// promise out of the source, and only then demands the file. Delete the promise and the check
// retires itself -- that is the "or stop claiming it" half of the Founder's instruction, enforced
// rather than remembered.
//
// It also verifies the boring half: every extraResources `from` path actually exists and is not an
// empty directory. A build that silently ships an empty folder is the same defect found a
// different way.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OVERRIDE = 'LB_SKIP_BUNDLE_PREFLIGHT';

const problems = [];
const notes = [];

function rel(p) {
  return path.relative(ROOT, p).replace(/\\/g, '/');
}

// -- 1. every declared extraResources source must exist -----------------------------------------
let pkg;
try {
  pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
} catch (e) {
  console.error('BUNDLE PREFLIGHT: cannot read package.json -- ' + e.message);
  process.exit(1);
}

const extra = (pkg.build && pkg.build.extraResources) || [];
for (const entry of extra) {
  const from = typeof entry === 'string' ? entry : entry.from;
  if (!from) continue;
  const abs = path.join(ROOT, from);
  if (!fs.existsSync(abs)) {
    problems.push('extraResources declares "' + from + '" but nothing exists at ' + rel(abs));
    continue;
  }
  const st = fs.statSync(abs);
  if (st.isDirectory() && fs.readdirSync(abs).length === 0) {
    problems.push(
      'extraResources declares "' + from + '" and that directory is EMPTY -- ' +
      'an empty bundle ships as silently as a full one'
    );
  }
}
notes.push(extra.length + ' extraResources entr' + (extra.length === 1 ? 'y' : 'ies') + ' checked');

// -- 2. promises made to the user in source must be backed by a real bundled file ----------------
// Each rule: if `promise` appears in `inFile`, then `mustExist` has to exist, be declared in
// extraResources, and (when a .sha256 sibling is present) match it.
const PROMISES = [
  {
    label: 'VC++ redistributable',
    inFile: 'src/main/ollama_manager.ts',
    promise: 'the installer includes vc_redist.x64.exe',
    mustExist: 'resources/vcredist/vc_redist.x64.exe',
    mustBeDeclaredFrom: 'resources/vcredist',
    remedy: [
      'EITHER bundle it: copy vc_redist.x64.exe and its .sha256 into resources/vcredist/, then add',
      '  { "from": "resources/vcredist", "to": "vcredist", "filter": ["**/*"] } to build.extraResources.',
      '  A known-good copy with a matching checksum sits in the retired BP166 twin at',
      '  C:/Users/Administrator/Documents/LianaBanyanPlatform/resources/vcredist/ .',
      'OR stop claiming it: change the message in src/main/ollama_manager.ts to link the Microsoft',
      '  download page instead of an install-directory path, and this rule retires itself.',
    ],
  },
];

for (const rule of PROMISES) {
  const srcPath = path.join(ROOT, rule.inFile);
  if (!fs.existsSync(srcPath)) {
    notes.push('promise source ' + rule.inFile + ' not found -- rule "' + rule.label + '" skipped');
    continue;
  }
  const src = fs.readFileSync(srcPath, 'utf8');
  if (!src.includes(rule.promise)) {
    notes.push(
      '"' + rule.label + '" promise no longer present in ' + rule.inFile +
      ' -- rule retired, nothing to enforce'
    );
    continue;
  }
  const target = path.join(ROOT, rule.mustExist);
  if (!fs.existsSync(target)) {
    problems.push(
      rule.inFile + ' TELLS THE USER "' + rule.promise + '" but ' + rule.mustExist +
      ' does not exist in this tree.\n' +
      rule.remedy.map((l) => '      ' + l).join('\n')
    );
    continue;
  }
  const declared = extra.some((e) => {
    const from = typeof e === 'string' ? e : e.from;
    return from && (from === rule.mustBeDeclaredFrom || rule.mustExist.startsWith(from + '/'));
  });
  if (!declared) {
    problems.push(
      rule.mustExist + ' exists but is NOT declared in build.extraResources, so it will not be ' +
      'packaged.\n      Add { "from": "' + rule.mustBeDeclaredFrom + '", "to": "' +
      path.basename(rule.mustBeDeclaredFrom) + '", "filter": ["**/*"] }.'
    );
    continue;
  }
  const shaFile = target + '.sha256';
  if (fs.existsSync(shaFile)) {
    const expected = fs.readFileSync(shaFile, 'utf8').trim().split(/\s+/)[0].toLowerCase();
    const actual = crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex');
    if (expected && expected !== actual) {
      problems.push(
        rule.mustExist + ' does NOT match its own .sha256 sibling.\n' +
        '      expected ' + expected + '\n      actual   ' + actual + '\n' +
        '      Either the file is corrupt or the checksum is stale. Do not ship until they agree.'
      );
      continue;
    }
    notes.push('"' + rule.label + '" present, declared, and sha256-verified');
  } else {
    notes.push('"' + rule.label + '" present and declared (no .sha256 sibling to verify against)');
  }
}

// -- 3. report ----------------------------------------------------------------------------------
if (problems.length === 0) {
  console.log('BUNDLE PREFLIGHT OK -- ' + notes.join('; '));
  process.exit(0);
}

console.error('');
console.error('==================== BUNDLE PREFLIGHT FAILED ====================');
console.error(
  problems.length + ' problem' + (problems.length === 1 ? '' : 's') +
  ' found. This build would ship a promise it cannot keep.'
);
console.error('');
problems.forEach((p, i) => {
  console.error('  ' + (i + 1) + '. ' + p);
  console.error('');
});
notes.forEach((n) => console.error('  note: ' + n));
console.error('');
if (process.env[OVERRIDE] === '1') {
  console.error('  ' + OVERRIDE + '=1 IS SET -- PROCEEDING ANYWAY.');
  console.error('  This build ships the defect above. That is now a recorded choice, not an accident.');
  console.error('================================================================');
  console.error('');
  process.exit(0);
}
console.error('  To build anyway and own the consequence: set ' + OVERRIDE + '=1');
console.error('================================================================');
console.error('');
process.exit(1);
