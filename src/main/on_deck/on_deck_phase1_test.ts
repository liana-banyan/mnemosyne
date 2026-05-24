// BP037 — On-Deck Phase 1 Tests
// G1 gate: parses 4 sample items correctly + rejects malformed frontmatter
//
// Run: npx ts-node src/main/on_deck/on_deck_phase1_test.ts
// Exit code 0 = all pass; 1 = any failure

import { strict as assert } from 'assert';
import { resolve } from 'path';
import { homedir } from 'os';
import { parseOnDeckContent } from './on_deck_parser';
import { validateOnDeckDir } from './validate_on_deck';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓  ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ✗  ${name}`);
    console.error(`       ${String(e)}`);
    failed++;
  }
}

// ─── Suite 1: parse valid samples from substrate ──────────────────────────────

console.log('\n[on_deck_phase1_test] Suite 1 — 4 valid sample items\n');

const baseDir = resolve(homedir(), '.lb_substrate', 'on_deck');
const { passed: validItems, failed: invalidItems } = validateOnDeckDir(baseDir);

test('finds at least 4 valid on_deck items in substrate', () => {
  assert.ok(validItems.length >= 4, `Expected >= 4 valid items, got ${validItems.length}`);
});

test('OD-001 parses with correct target_seat=knight category=sequential priority=HIGH', () => {
  const od001 = validItems.find((i) => i.frontmatter.on_deck_id === 'OD-001');
  assert.ok(od001, 'OD-001 not found');
  assert.equal(od001!.frontmatter.target_seat, 'knight');
  assert.equal(od001!.frontmatter.category, 'sequential');
  assert.equal(od001!.frontmatter.priority, 'HIGH');
});

test('OD-003 parses with correct target_seat=pawn category=anytime', () => {
  const od003 = validItems.find((i) => i.frontmatter.on_deck_id === 'OD-003');
  assert.ok(od003, 'OD-003 not found');
  assert.equal(od003!.frontmatter.target_seat, 'pawn');
  assert.equal(od003!.frontmatter.category, 'anytime');
});

test('OD-004 parses with correct category=conditional depends_on=[OD-001]', () => {
  const od004 = validItems.find((i) => i.frontmatter.on_deck_id === 'OD-004');
  assert.ok(od004, 'OD-004 not found');
  assert.equal(od004!.frontmatter.category, 'conditional');
  assert.deepEqual(od004!.frontmatter.depends_on, ['OD-001']);
});

test('no items fail schema validation in the 4 samples', () => {
  assert.equal(invalidItems.length, 0, `${invalidItems.length} items failed: ${invalidItems.map(i => i.error).join(', ')}`);
});

// ─── Suite 2: reject malformed frontmatter ────────────────────────────────────

console.log('\n[on_deck_phase1_test] Suite 2 — reject malformed frontmatter\n');

test('rejects missing on_deck_id', () => {
  const content = `---
target_seat: knight
category: sequential
priority: HIGH
---
Body text.`;
  const r = parseOnDeckContent(content, 'virtual/missing_id.eblet.md');
  assert.ok(!r.ok, 'Expected parse failure for missing on_deck_id');
  assert.ok(r.error.includes('on_deck_id'), `Error should mention on_deck_id: ${r.error}`);
});

test('rejects invalid target_seat', () => {
  const content = `---
on_deck_id: BAD-001
target_seat: overlord
category: sequential
priority: HIGH
---
Body.`;
  const r = parseOnDeckContent(content, 'virtual/bad_seat.eblet.md');
  assert.ok(!r.ok, 'Expected parse failure for invalid target_seat');
});

test('rejects invalid category', () => {
  const content = `---
on_deck_id: BAD-002
target_seat: knight
category: whenever
priority: HIGH
---
Body.`;
  const r = parseOnDeckContent(content, 'virtual/bad_category.eblet.md');
  assert.ok(!r.ok, 'Expected parse failure for invalid category');
});

test('rejects invalid priority', () => {
  const content = `---
on_deck_id: BAD-003
target_seat: rook
category: anytime
priority: CRITICAL
---
Body.`;
  const r = parseOnDeckContent(content, 'virtual/bad_priority.eblet.md');
  assert.ok(!r.ok, 'Expected parse failure for invalid priority');
});

test('rejects content with no YAML frontmatter fence', () => {
  const content = `Just plain text, no YAML frontmatter at all.`;
  const r = parseOnDeckContent(content, 'virtual/no_fence.eblet.md');
  assert.ok(!r.ok, 'Expected parse failure for missing --- fence');
});

// ─── Suite 3: edge cases ──────────────────────────────────────────────────────

console.log('\n[on_deck_phase1_test] Suite 3 — edge cases\n');

test('accepts item with empty depends_on array', () => {
  const content = `---
on_deck_id: EDGE-001
target_seat: manager
category: anytime
priority: LOW
depends_on: []
---
Some task body.`;
  const r = parseOnDeckContent(content, 'virtual/edge_empty_deps.eblet.md');
  assert.ok(r.ok, `Expected success: ${r.ok ? '' : r.error}`);
  if (r.ok) {
    assert.deepEqual(r.item.frontmatter.depends_on, []);
  }
});

test('defaults status to READY when not specified', () => {
  const content = `---
on_deck_id: EDGE-002
target_seat: rook
category: sequential
priority: MEDIUM
---
Task without explicit status.`;
  const r = parseOnDeckContent(content, 'virtual/edge_default_status.eblet.md');
  assert.ok(r.ok, `Expected success: ${r.ok ? '' : r.error}`);
  if (r.ok) {
    assert.equal(r.item.frontmatter.status, 'READY');
  }
});

// ─── Summary ──────────────────────────────────────────────────────────────────

const total = passed + failed;
console.log(`\n[on_deck_phase1_test] ${passed}/${total} tests passed\n`);

if (failed > 0) {
  process.exit(1);
}
