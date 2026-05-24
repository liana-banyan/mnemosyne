#!/usr/bin/env node
// BP048 v0.1.7 — fail build if banned CAI / membership glyphs appear in src/.
// U+0110 Đ · U+2283 ⊃ · U+1FA99 🪙 per feedback_cai_symbol_unicode_truth_bp048

import { readdirSync, readFileSync, statSync } from 'fs';
import { join, extname } from 'path';
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
