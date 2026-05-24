// Sprite scripted-v1 test harness — Bushel 60 Phase B (BP030)
//
// Tests the Shadow E-Sprite courier registry end-to-end against a temp
// substrate root. Three scenarios:
//   1. Single Sprite cross-cluster delivery (Bishop -> Knight dropzone)
//   2. Redundant 3-Sprite race: exactly one delivery + two recalls
//   3. Throughput: 20 sequential dispatches, measure packages/min
//
// Run with: npx ts-node tests/sprite-scripted-v1/test_sprite_scripted_v1.ts
// (or compiled: node dist/main/.../test_sprite_scripted_v1.js — but ts-node is
// the canonical local-CPU run path here.)

import { mkdirSync, writeFileSync, existsSync, rmSync, readdirSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { tmpdir } from 'os';

// Override substrate root BEFORE importing sprite_registry
const TEST_ROOT = resolve(tmpdir(), `lb_substrate_test_${Date.now()}`);
process.env.LB_SUBSTRATE_ROOT = TEST_ROOT;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const {
  SpriteRegistry,
  computeLockSignature,
  ensureSubstrateLayout,
  SPRITE_RECEIPT_DIR,
  SPRITE_ACTIVE_DIR,
  // eslint-disable-next-line @typescript-eslint/no-var-requires
} = require('../../src/main/sprite_registry') as typeof import('../../src/main/sprite_registry');

interface TestResult {
  name: string;
  passed: boolean;
  details: Record<string, unknown>;
  errors: string[];
}

const results: TestResult[] = [];

function setupClusters(): { bishopOut: string; knightDropzone: string; pawnDropzone: string } {
  const bishopOut = resolve(TEST_ROOT, 'clusters', 'bishop', 'outbox');
  const knightDropzone = resolve(TEST_ROOT, 'clusters', 'knight', 'dropzone');
  const pawnDropzone = resolve(TEST_ROOT, 'clusters', 'pawn', 'dropzone');
  for (const d of [bishopOut, knightDropzone, pawnDropzone]) mkdirSync(d, { recursive: true });
  return { bishopOut, knightDropzone, pawnDropzone };
}

function authorPackage(bishopOut: string, name: string, body: string): string {
  const p = resolve(bishopOut, name);
  writeFileSync(p, body);
  return p;
}

async function test1_singleDelivery(registry: InstanceType<typeof SpriteRegistry>): Promise<void> {
  const errors: string[] = [];
  const { bishopOut, knightDropzone, pawnDropzone } = setupClusters();
  const pkgPath = authorPackage(bishopOut, 'canon_eblet_001.md',
    '# Canon Eblet 001\nTest payload for Sprite delivery.\n');

  const t0 = Date.now();
  const receipt = await registry.dispatchSprites({
    dispatch_id: 'test-1-' + Date.now().toString(36),
    session: 'BP030-TEST',
    package_path: pkgPath,
    source_cluster: 'bishop',
    destination_cluster: 'knight',
    lock_signature: computeLockSignature('knight', pkgPath),
    destination_path_pattern: 'dropzone',
    redundancy_count: 1,
    spawn_timestamp: new Date().toISOString(),
    candidate_dropzones: [pawnDropzone, knightDropzone],
  });
  const elapsed = Date.now() - t0;

  const expected = resolve(knightDropzone, 'canon_eblet_001.md');
  const arrived = existsSync(expected);
  if (!arrived) errors.push(`package did not arrive at ${expected}`);
  if (!receipt.delivery_success) errors.push('delivery_success=false');
  if (receipt.delivered_to !== expected) errors.push(`delivered_to mismatch: ${receipt.delivered_to}`);

  results.push({
    name: 'T1: Single-Sprite cross-cluster delivery (Bishop -> Knight)',
    passed: errors.length === 0,
    details: {
      elapsed_ms: elapsed,
      delivered_to: receipt.delivered_to,
      first_delivery_latency_ms: receipt.first_delivery_latency_ms,
      sprite_id: receipt.delivered_by_sprite_id,
    },
    errors,
  });
}

async function test2_redundantRace(registry: InstanceType<typeof SpriteRegistry>): Promise<void> {
  const errors: string[] = [];
  const { bishopOut, knightDropzone } = setupClusters();
  const pkgPath = authorPackage(bishopOut, 'canon_eblet_002.md',
    '# Canon Eblet 002\nRedundancy race payload.\n');

  // Multiple candidate paths, all containing 'knight' + 'dropzone' so each
  // Sprite finds its own match in different walk orders.
  const dropA = resolve(TEST_ROOT, 'clusters', 'knight', 'dropzone-a');
  const dropB = resolve(TEST_ROOT, 'clusters', 'knight', 'dropzone-b');
  const dropC = resolve(TEST_ROOT, 'clusters', 'knight', 'dropzone-c');
  for (const d of [dropA, dropB, dropC]) mkdirSync(d, { recursive: true });

  const receipt = await registry.dispatchSprites({
    dispatch_id: 'test-2-' + Date.now().toString(36),
    session: 'BP030-TEST',
    package_path: pkgPath,
    source_cluster: 'bishop',
    destination_cluster: 'knight',
    lock_signature: computeLockSignature('knight', pkgPath),
    destination_path_pattern: 'dropzone',
    redundancy_count: 3,
    spawn_timestamp: new Date().toISOString(),
    candidate_dropzones: [dropA, dropB, dropC, knightDropzone],
  });

  // Count how many copies of the package exist across candidate paths.
  // Acceptance: exactly 1 (atomic-flag-resolution) OR transient extras that got
  // rolled back (we expect 1 net).
  let copyCount = 0;
  for (const d of [dropA, dropB, dropC, knightDropzone]) {
    if (existsSync(resolve(d, 'canon_eblet_002.md'))) copyCount++;
  }

  if (!receipt.delivery_success) errors.push('delivery_success=false');
  if (copyCount !== 1) errors.push(`expected exactly 1 surviving copy, found ${copyCount}`);
  if (receipt.redundant_recall_count !== 2) {
    errors.push(`expected 2 recalls, got ${receipt.redundant_recall_count}`);
  }

  results.push({
    name: 'T2: 3-Sprite redundancy race — first wins, 2 recalled',
    passed: errors.length === 0,
    details: {
      delivery_success: receipt.delivery_success,
      delivered_by: receipt.delivered_by_sprite_id,
      surviving_copy_count: copyCount,
      recall_count: receipt.redundant_recall_count,
      recall_latencies_ms: receipt.recall_latency_ms_per_sprite,
      first_delivery_latency_ms: receipt.first_delivery_latency_ms,
    },
    errors,
  });
}

async function test3_throughput(registry: InstanceType<typeof SpriteRegistry>): Promise<void> {
  const errors: string[] = [];
  const { bishopOut, knightDropzone } = setupClusters();

  const N = 20;
  const t0 = Date.now();
  for (let i = 0; i < N; i++) {
    const pkg = authorPackage(bishopOut, `throughput_${i}.md`, `# pkg ${i}\n`);
    const r = await registry.dispatchSprites({
      dispatch_id: `tp-${i}-${Date.now().toString(36)}`,
      session: 'BP030-TEST',
      package_path: pkg,
      source_cluster: 'bishop',
      destination_cluster: 'knight',
      lock_signature: computeLockSignature('knight', pkg),
      destination_path_pattern: 'dropzone',
      redundancy_count: 1,
      spawn_timestamp: new Date().toISOString(),
      candidate_dropzones: [knightDropzone],
    });
    if (!r.delivery_success) errors.push(`dispatch ${i} failed`);
  }
  const elapsedMs = Date.now() - t0;
  const perMin = (N / elapsedMs) * 60_000;

  results.push({
    name: `T3: Throughput — ${N} sequential dispatches`,
    passed: errors.length === 0 && perMin > 30,
    details: {
      total_elapsed_ms: elapsedMs,
      packages_per_min: Math.round(perMin * 10) / 10,
      avg_latency_ms_per_dispatch: Math.round(elapsedMs / N),
    },
    errors,
  });
}

async function test4_intraClusterRejected(registry: InstanceType<typeof SpriteRegistry>): Promise<void> {
  const errors: string[] = [];
  const { bishopOut } = setupClusters();
  const bishopDropzone = resolve(TEST_ROOT, 'clusters', 'bishop', 'dropzone');
  mkdirSync(bishopDropzone, { recursive: true });
  const pkg = authorPackage(bishopOut, 'intra.md', '# intra\n');

  const receipt = await registry.dispatchSprites({
    dispatch_id: 'test-4-' + Date.now().toString(36),
    session: 'BP030-TEST',
    package_path: pkg,
    source_cluster: 'bishop',
    destination_cluster: 'bishop',
    lock_signature: computeLockSignature('bishop', pkg),
    destination_path_pattern: 'dropzone',
    redundancy_count: 1,
    spawn_timestamp: new Date().toISOString(),
    candidate_dropzones: [bishopDropzone],
  });

  if (receipt.delivery_success) errors.push('intra-cluster delivery should be rejected');
  if (!receipt.errors.some((e) => e.includes('intra-cluster'))) {
    errors.push('expected intra-cluster rejection error');
  }

  results.push({
    name: 'T4: Intra-cluster delivery rejected (Sprite scope rule)',
    passed: errors.length === 0,
    details: { errors_received: receipt.errors },
    errors,
  });
}

async function main(): Promise<number> {
  // Cleanup prior runs
  if (existsSync(TEST_ROOT)) {
    try { rmSync(TEST_ROOT, { recursive: true, force: true }); } catch { /* ignore */ }
  }
  ensureSubstrateLayout();

  const registry = new SpriteRegistry({ tickMs: 5, logger: () => {} });

  console.log(`[test] substrate root: ${TEST_ROOT}`);
  console.log('[test] running scripted-v1 Sprite test suite...\n');

  await test1_singleDelivery(registry);
  await test2_redundantRace(registry);
  await test3_throughput(registry);
  await test4_intraClusterRejected(registry);

  // Print results
  let passCount = 0;
  for (const r of results) {
    const tag = r.passed ? 'PASS' : 'FAIL';
    console.log(`[${tag}] ${r.name}`);
    console.log('       ' + JSON.stringify(r.details));
    if (r.errors.length > 0) {
      for (const e of r.errors) console.log('       ! ' + e);
    }
    if (r.passed) passCount++;
  }
  console.log(`\n[test] ${passCount}/${results.length} passed`);

  // Persist results JSON next to test source
  const resultsPath = resolve(__dirname, 'test_results.json');
  writeFileSync(resultsPath, JSON.stringify({
    suite: 'sprite-scripted-v1',
    session: 'BP030',
    bushel: 60,
    phase: 'B',
    pass_count: passCount,
    total: results.length,
    results,
    substrate_root: TEST_ROOT,
    ts: new Date().toISOString(),
  }, null, 2));
  console.log(`[test] results written to ${resultsPath}`);

  // List receipts for inspection
  if (existsSync(SPRITE_RECEIPT_DIR)) {
    const receipts = readdirSync(SPRITE_RECEIPT_DIR);
    console.log(`[test] ${receipts.length} sprite receipts in ${SPRITE_RECEIPT_DIR}`);
  }

  return passCount === results.length ? 0 : 1;
}

main().then((code) => process.exit(code)).catch((err) => {
  console.error(err);
  process.exit(2);
});
