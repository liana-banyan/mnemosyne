#!/usr/bin/env node
// BP048 v0.1.6 — fail build if U+0110 (Latin D with stroke) appears in source tree.
// Composes with K448 build-guard layer · feedback_cai_symbol_doublebar_backwards_c_not_d_with_line_bp047

import { readdirSync, readFileSync, statSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const BLOCKER = '\u0110'; // Đ

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
    if (text.includes(BLOCKER)) hits.push(full);
  }
  return hits;
}

const hits = walk(SRC);
if (hits.length > 0) {
  console.error(`unicode-check FAILED: U+0110 found in ${hits.length} file(s):`);
  for (const f of hits) console.error(`  ${f.replace(ROOT + '\\', '').replace(ROOT + '/', '')}`);
  process.exit(1);
}
console.log('unicode-check OK: zero U+0110 in src/');
