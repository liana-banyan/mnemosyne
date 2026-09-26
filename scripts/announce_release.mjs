#!/usr/bin/env node
// announce_release.mjs -- D-BP223-PQ005-012-X041 (Founder 2026-09-26, verbatim: "I want to make a pipeline to send new
// updates asap so people know new capabilities, please.")
//
// ONE FILE, EVERY SURFACE. The Founder writes (or cuts) RELEASE_NOTES/<version>.md once. This script carries it to:
//   1. the in-app updater: nothing to do here, gen_lean_builder_config.mjs already folds the same file into latest.yml
//      as releaseInfo.releaseNotes at press time, and auto_updater.ts shows it beside "vX is ready";
//   2. Battery Dispatch (http://127.0.0.1:11488): stages ONE package with the notes as the text and the download link,
//      every plug previewed with its own limit, DRY RUN by default. `--press discord` (or any plug ids, comma-separated)
//      sends for real. Nothing is sent without that flag: the press is the Founder's ratify (BP078 BLOOD canon), and
//      the flag is how he gives it from a terminal instead of the page;
//   3. the GitHub release body: prints the exact `gh release create` line with --notes-file (run at publish time);
//   4. the site's trust entry: prints the one-line `notes` value for data/version_trust.json (the entry is signed by the
//      trust root at publish time, never by this script).
// A receipt of what was staged or sent is written to RELEASE_NOTES/<version>.announce.<UTC>.json.
//
// Usage:
//   node scripts/announce_release.mjs 0.9.39                      stage only (dry run on every connected plug)
//   node scripts/announce_release.mjs 0.9.39 --press discord      stage, dry-run, then REALLY send to discord
//   node scripts/announce_release.mjs 0.9.39 --withhold substack  do not offer the package to a plug at all
//   node scripts/announce_release.mjs 0.9.39 --dispatch http://127.0.0.1:11488
// Rules kept: no em or en dash in what is sent (refused, not fixed); text over Discord's 2,000 characters is cut at a
// paragraph boundary and the cut is reported, never silent.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const argv = process.argv.slice(2);
const version = argv[0];
const arg = (name, dflt) => { const i = argv.indexOf('--' + name); return i === -1 ? dflt : argv[i + 1]; };
const has = (name) => argv.includes('--' + name);
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) { console.error('usage: node scripts/announce_release.mjs <version> [--press plug,plug] [--withhold plug,plug] [--dispatch URL]'); process.exit(2); }

const DISPATCH = arg('dispatch', 'http://127.0.0.1:11488');
const DISCORD_LIMIT = 2000;
const notesPath = join(REPO_ROOT, 'RELEASE_NOTES', `${version}.md`);
if (!existsSync(notesPath)) { console.error(`no notes file: ${notesPath} (write it first; the Founder cuts it)`); process.exit(2); }
const notes = readFileSync(notesPath, 'utf-8').replace(/\r\n/g, '\n').trim();
if (/[—–]/.test(notes)) { console.error('REFUSED: the notes carry an em or en dash; replace with a comma, colon, period or parentheses'); process.exit(3); }

const downloadUrl = `https://mnemosynec.org/download/MnemosyneC-Lean-Setup-${version}.exe`;
const trailer = `\n\nDownload (signed, Windows): ${downloadUrl}\nWhat is new, in full: https://github.com/liana-banyan/mnemosynec-releases/releases/tag/v${version}`;

/** Cut at a paragraph boundary so the Discord copy never ends mid-sentence. Reports what it cut. */
function fitDiscord(text) {
  const full = text + trailer;
  if (full.length <= DISCORD_LIMIT) return { text: full, cut: 0 };
  const paras = text.split(/\n\n+/);
  let kept = [];
  for (const p of paras) {
    const candidate = [...kept, p].join('\n\n') + trailer;
    if (candidate.length > DISCORD_LIMIT) break;
    kept.push(p);
  }
  const out = kept.join('\n\n') + trailer;
  return { text: out, cut: paras.length - kept.length };
}

async function api(method, path, body) {
  const res = await fetch(DISPATCH + path, { method, headers: body === undefined ? {} : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${method} ${path} -> HTTP ${res.status} ${(json && json.error) || ''}`);
  return json;
}

const receipt = { version, notesPath, notesChars: notes.length, startedUtc: new Date().toISOString(), dispatch: DISPATCH, staged: null, dryRun: [], sent: [], github: null, trustNote: null };
const { text: discordText, cut } = fitDiscord(notes);
if (cut) console.log(`[announce] Discord copy cut ${cut} paragraph(s) to fit ${DISCORD_LIMIT} characters (${discordText.length} kept)`);

// 2. Battery Dispatch: stage, dry-run every connected plug, send only what --press names.
const withhold = (arg('withhold', '') || '').split(',').map((s) => s.trim()).filter(Boolean);
const staged = await api('POST', '/api/dispatch/packages', { source: 'manual', text: discordText, link: { url: downloadUrl }, withhold_plugs: withhold });
receipt.staged = { package_id: staged.package.package_id, sha256: staged.package.source && staged.package.source.sha256, chars: discordText.length };
console.log(`[announce] staged ${staged.package.package_id} (${discordText.length} chars)`);
const plugs = await api('GET', '/api/dispatch/plugs');
const connected = (plugs.plugs || plugs).filter((p) => (p.status && p.status.connected) || p.connected).map((p) => (p.manifest && p.manifest.id) || p.id).filter((id) => id && !withhold.includes(id));
if (connected.length) {
  const dry = await api('POST', `/api/dispatch/packages/${encodeURIComponent(staged.package.package_id)}/send`, { plugs: connected.map((plug_id) => ({ plug_id, confirm: true })), dry_run: true });
  receipt.dryRun = (dry.results || []).map((r) => ({ plug_id: r.plug_id, status: r.status, bytes: r.bytes, error: r.error }));
  console.log(`[announce] dry run: ${receipt.dryRun.map((r) => `${r.plug_id}=${r.status}${r.error ? ' (' + r.error + ')' : ''}`).join(', ')}`);
} else {
  console.log('[announce] no connected plug found; package staged for a manual press');
}
const press = (arg('press', '') || '').split(',').map((s) => s.trim()).filter(Boolean);
if (press.length) {
  const real = await api('POST', `/api/dispatch/packages/${encodeURIComponent(staged.package.package_id)}/send`, { plugs: press.map((plug_id) => ({ plug_id, confirm: true })), dry_run: false });
  receipt.sent = (real.results || []).map((r) => ({ plug_id: r.plug_id, status: r.status, post_url: r.post_url, error: r.error, utc: r.utc }));
  for (const r of receipt.sent) console.log(`[announce] SENT ${r.plug_id}: ${r.status} ${r.post_url || ''} ${r.error || ''}`);
} else {
  console.log('[announce] nothing sent (no --press). Press on the page, or re-run with --press discord.');
}

// 3. GitHub release body and 4. the trust-entry note: printed, never run here.
receipt.github = `gh release create v${version} --repo liana-banyan/mnemosynec-releases --title "MnemosyneC ${version} (Lean)" --notes-file "${notesPath}" release/MnemosyneC-Lean-Setup-${version}.exe release/MnemosyneC-Lean-Setup-${version}.exe.blockmap release/MnemosyneC-Lean-Portable-${version}.exe release/latest.yml release/SHA256SUMS-${version}.txt`;
receipt.trustNote = `v${version}: ` + notes.split(/\n\n+/)[1].replace(/\s+/g, ' ').slice(0, 400);
console.log('\n[announce] at publish time, the GitHub release body is the same file:\n  ' + receipt.github);
console.log('\n[announce] data/version_trust.json notes for the new entry (the trust root signs the entry, not this script):\n  ' + JSON.stringify(receipt.trustNote));

receipt.finishedUtc = new Date().toISOString();
const receiptPath = join(REPO_ROOT, 'RELEASE_NOTES', `${version}.announce.${receipt.startedUtc.replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')}.json`);
writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n', 'utf-8');
console.log(`[announce] receipt: ${receiptPath}`);
