// Hearth App Builder — B69a — Spec Extractor Tests
// Tests buildFallbackSpec (deterministic, no Ollama required) for G1 gate validation.
// For Ollama path, the smoke test in spec_extractor.ts covers the live path.
//
// Run: node tests/test_spec_extractor.mjs  (from amplify-computer root, after npm run build:main)

import { buildFallbackSpec } from '../dist/main/hearth_app_builder/spec_extractor.js';

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    console.log(`  ✓ ${msg}`);
    passed++;
  } else {
    console.error(`  ✗ ${msg}`);
    failed++;
  }
}

function testCase(label, request, checks) {
  console.log(`\n[${label}]`);
  const spec = buildFallbackSpec(request, 'test-member');

  assert(spec.appName.length > 0, 'appName non-empty');
  assert(spec.entities.length >= 1, 'at least 1 entity');
  assert(spec.forms.length >= 1, 'at least 1 form');
  assert(spec.views.length >= 1, 'at least 1 view');
  assert(spec.metadata.author === 'test-member', 'author set correctly');
  assert(spec.metadata.version === '0.1.0', 'version is 0.1.0');
  assert(typeof spec.metadata.createdAt === 'string', 'createdAt is string');

  // Every entity has an id field
  for (const entity of spec.entities) {
    const idField = entity.fields.find((f) => f.name === 'id');
    assert(idField !== undefined, `entity ${entity.name} has id field`);
    assert(idField?.type === 'int', `entity ${entity.name} id is int type`);
  }

  // Forms reference existing entities
  for (const form of spec.forms) {
    const entityExists = spec.entities.some((e) => e.name === form.entity);
    assert(entityExists, `form entity '${form.entity}' exists`);
    assert(form.fields.length >= 1, `form has at least 1 field`);
  }

  // Views reference existing entities
  for (const view of spec.views) {
    const entityExists = spec.entities.some((e) => e.name === view.entity);
    assert(entityExists, `view entity '${view.entity}' exists`);
    assert(view.columns.length >= 1, 'view has at least 1 column');
  }

  // Custom checks from test case
  if (checks) checks(spec);
}

// ─── Test Cases (G1: 5/5 free-form prompts produce valid AppSpec) ────────────

testCase(
  'TC1: Daily mood log',
  'build me a daily-log app where I rate my mood 1-10 and write a note',
  (spec) => {
    const allFields = spec.entities.flatMap((e) => e.fields.map((f) => f.name));
    assert(allFields.includes('rating') || allFields.includes('mood'), 'has rating or mood field');
    assert(allFields.includes('notes') || allFields.some((f) => f === 'note'), 'has notes field');
  },
);

testCase(
  'TC2: Budget tracker',
  'I want to track my monthly expenses with amount, category, and date',
  (spec) => {
    const allFields = spec.entities.flatMap((e) => e.fields.map((f) => f.name));
    assert(allFields.includes('amount'), 'has amount field');
    assert(allFields.includes('date'), 'has date field');
  },
);

testCase(
  'TC3: Simple task list',
  'create a task list app where I can mark tasks as done or not done',
  (spec) => {
    const allFields = spec.entities.flatMap((e) => e.fields.map((f) => f.name));
    assert(allFields.includes('completed'), 'has completed field');
  },
);

testCase(
  'TC4: Recipe organizer',
  'recipe organizer to save recipes with title and notes',
  (spec) => {
    assert(spec.appName.length > 0, 'appName derived from request');
    const allFields = spec.entities.flatMap((e) => e.fields.map((f) => f.name));
    assert(allFields.includes('notes'), 'has notes field');
  },
);

testCase(
  'TC5: Contact book',
  'contact book for storing names and email addresses',
  (spec) => {
    assert(spec.entities.length >= 1, 'has entity');
    assert(spec.forms[0].fields.length >= 2, 'form has multiple fields');
  },
);

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`Spec Extractor tests: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  console.error('G1 GATE: FAIL');
  process.exit(1);
} else {
  console.log('G1 GATE: PASS (5/5 cases valid AppSpec)');
  process.exit(0);
}
