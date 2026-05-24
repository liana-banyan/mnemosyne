// Bushel 60 Phase C — Shadow E-Spider end-to-end test (BP030)
//
// Spawns a Spider for the Cooperative Code Infrastructure canon Eblet
// (LB-STACK-0159 family) and verifies:
//   - frame size >= 5 (anchors with pheromone-tagged links)
//   - pheromone links present on disk
//   - average similarity is non-trivial
//   - all related canons in the same domain are surfaced
//
// Requires the embedding sidecar at http://127.0.0.1:8765 to be running
// AND the canon eblets to already be indexed (see  index_canon_eblets.py).

import { homedir } from 'os';
import { resolve, basename } from 'path';
import { readdirSync, readFileSync, existsSync } from 'fs';
import {
  dispatchSpider,
  listPheromoneLinks,
  SPIDER_RECEIPT_DIR,
} from '../dist/main/spider_registry.js';

const CANON_DIR = resolve(homedir(), '.claude', 'state', 'eblets', 'CANON');

const ANCHOR_FILE =
  'cooperative_code_infrastructure_centralized_platform_failure_answer_bp030.eblet.md';
const ANCHOR_PATH = resolve(CANON_DIR, ANCHOR_FILE);

if (!existsSync(ANCHOR_PATH)) {
  console.error(`anchor not found: ${ANCHOR_PATH}`);
  process.exit(2);
}

console.log('Bushel 60 Phase C — Shadow E-Spider end-to-end test');
console.log('  anchor:', ANCHOR_PATH);
console.log();

const t0 = Date.now();
const receipt = await dispatchSpider({
  anchor_path: ANCHOR_PATH,
  session: 'BP030',
  drift_budget: 8,
  attach_threshold: 0.65, // canonical threshold per LOCAL_CPU_COMPUTE_ARCHITECTURE §4
  per_round_topk: 8,
  frame_target: 5,
});
const elapsedMs = Date.now() - t0;

console.log('Receipt:');
console.log(JSON.stringify(receipt, null, 2));
console.log();
console.log(`Elapsed: ${elapsedMs} ms`);

// ─── Assertions ──────────────────────────────────────────────────────────

let pass = 0;
let fail = 0;
function check(name, ok, detail = '') {
  if (ok) {
    console.log(`  PASS  ${name} ${detail}`);
    pass++;
  } else {
    console.log(`  FAIL  ${name} ${detail}`);
    fail++;
  }
}

check(
  'frame_size >= 5',
  receipt.frame_size >= 5,
  `(got ${receipt.frame_size})`,
);
check(
  'anchors_attached >= 4',
  receipt.anchors_attached >= 4,
  `(got ${receipt.anchors_attached})`,
);
check(
  'pheromone_links_written > 0',
  receipt.pheromone_links_written > 0,
  `(got ${receipt.pheromone_links_written})`,
);
check(
  'avg_similarity > 0.4',
  receipt.average_link_similarity > 0.4,
  `(got ${receipt.average_link_similarity})`,
);
check(
  'errors empty',
  receipt.errors.length === 0,
  `(${receipt.errors.length} errors)`,
);

// Receipt persisted to disk?
const receiptOnDisk = readdirSync(SPIDER_RECEIPT_DIR).filter((f) =>
  f.includes('cooperative_code_infrastructure'),
);
check(
  'receipt persisted',
  receiptOnDisk.length >= 1,
  `(${receiptOnDisk.length} files)`,
);

// Pheromone links on disk
const allLinks = listPheromoneLinks();
const ourLinks = allLinks.filter(
  (l) =>
    l.source_anchor_id ===
      'cooperative_code_infrastructure_centralized_platform_failure_answer_bp030' ||
    l.dest_anchor_id ===
      'cooperative_code_infrastructure_centralized_platform_failure_answer_bp030',
);
check(
  'pheromone links involve the source anchor',
  ourLinks.length >= 4,
  `(${ourLinks.length} links touch source)`,
);

console.log();
console.log(`Attached anchors:`);
for (const id of receipt.attached_anchor_ids) {
  console.log(`   - ${id}`);
}
console.log();
console.log(`Result: ${pass} pass / ${fail} fail`);
console.log();
console.log(`Pheromone link summary:`);
console.log(`  total written so far: ${allLinks.length}`);
const simBuckets = { lt40: 0, '40-50': 0, '50-60': 0, '60-70': 0, gte70: 0 };
for (const l of allLinks) {
  if (l.similarity < 0.4) simBuckets.lt40++;
  else if (l.similarity < 0.5) simBuckets['40-50']++;
  else if (l.similarity < 0.6) simBuckets['50-60']++;
  else if (l.similarity < 0.7) simBuckets['60-70']++;
  else simBuckets.gte70++;
}
console.log(`  similarity buckets:`, simBuckets);

process.exit(fail === 0 ? 0 : 1);
