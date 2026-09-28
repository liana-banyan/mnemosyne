#!/usr/bin/env node
// BP048 v0.1.7 — fail build if banned CAI / membership glyphs appear in src/.
// U+0110 Đ · U+2283 ⊃ · U+1FA99 🪙 per feedback_cai_symbol_unicode_truth_bp048
//
// D-BP223-BM04-X033S3-013 (2026-09-20): reaffirms this ban list. Founder
// ruling that day on the CAI/NotCents glyph's actual shape ("a backwards C
// with $ (without the S)... Yes that's the shape") is a reversed C (bowl
// opens LEFT) with TWO VERTICAL bars — never this ban list's U+2283 (⊃),
// which stays banned as a CAI/NotCents stand-in. Every ⊃ this checker still
// finds legitimately (MMLU-Pro exam JSON, the seed/ exemption above) is
// material-conditional notation, not the currency glyph — unrelated to and
// unaffected by this ruling.

// D-BP223-BM0-X034-014 (2026-09-20): added ONE narrow path exclusion below --
// src/main/proveit/seed/*.json. That directory holds verbatim third-party
// MMLU-Pro exam text (Prove It's seed card set), not Bishop/Knight-authored
// prose or branding; real formal-logic exam questions legitimately use the
// banned superset codepoint as the standard material-conditional operator
// (e.g. a qid card's own question text chains several such operators). The
// BP048 ban's own rationale (feedback_cai_symbol_unicode_truth_bp048) targets
// that glyph being MISUSED AS the CAI/NotCents symbol in authored output --
// it never addressed quoted third-party exam data, and that memory's own
// "Mined Eblet lines ... DO NOT TOUCH -- historical verbatim" clause is the
// closest existing precedent for this same shape of exception. The ban stays
// in FULL FORCE everywhere else in src/, including every other file under
// src/main/proveit/ (ipc.ts, card_writer.ts, ticker.ts, etc. -- all
// Bishop/Knight-authored and still scanned). Seed JSON content itself was not
// touched by this change.

import { readdirSync, readFileSync, statSync } from 'fs';
import { join, extname, relative } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const SRC = join(ROOT, 'src');

const BANNED = [
  { char: '\u0110', label: 'U+0110 (Đ)' },
  { char: '\u2283', label: 'U+2283 (⊃)' },
  { char: '\u{1FA99}', label: 'U+1FA99 (🪙)' },
];

const SKIP_DIRS = new Set(['node_modules', 'dist', '.git']);
const TEXT_EXT = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.css', '.html', '.json', '.md', '.mjs', '.cjs',
]);

// Verbatim third-party exam-data JSON, exempt from the CAI-glyph ban only --
// see the file-header note above (D-BP223-BM0-X034-014).
const EXEMPT_DIR = join(SRC, 'main', 'proveit', 'seed');
function isExempt(fullPath) {
  const rel = relative(EXEMPT_DIR, fullPath);
  return !rel.startsWith('..') && extname(fullPath).toLowerCase() === '.json';
}

function walk(dir, hits = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (SKIP_DIRS.has(name)) continue;
      walk(full, hits);
      continue;
    }
    const ext = extname(name).toLowerCase();
    if (!TEXT_EXT.has(ext)) continue;
    if (isExempt(full)) continue;
    const text = readFileSync(full, 'utf8');
    for (const { char, label } of BANNED) {
      if (text.includes(char)) hits.push({ file: full, label });
    }
  }
  return hits;
}

const hits = walk(SRC);
if (hits.length > 0) {
  console.error(`unicode-check FAILED: ${hits.length} banned codepoint hit(s):`);
  for (const h of hits) {
    const rel = h.file.replace(ROOT + '\\', '').replace(ROOT + '/', '');
    console.error(`  ${rel}: ${h.label}`);
  }
  process.exit(1);
}
console.log('unicode-check OK: zero Đ / ⊃ / 🪙 in src/');
