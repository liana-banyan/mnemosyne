// Hearth App Builder — B69a — Codegen Tests
// Tests: spec → directory tree assertion + tsc --noEmit clean check (G2 gate)
//
// Run: node tests/test_codegen.mjs  (from amplify-computer root, after npm run build:main)

import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { execSync } from 'child_process';
import { generateApp } from '../dist/main/hearth_app_builder/codegen.js';

let passed = 0;
let failed = 0;
const generatedDirs = [];

function assert(cond, msg) {
  if (cond) {
    console.log(`  ✓ ${msg}`);
    passed++;
  } else {
    console.error(`  ✗ ${msg}`);
    failed++;
  }
}

function assertFile(appDir, relPath) {
  const fullPath = join(appDir, relPath);
  assert(existsSync(fullPath), `file exists: ${relPath}`);
}

// ─── Sample AppSpecs ──────────────────────────────────────────────────────────

const DAILY_LOG_SPEC = {
  appName: 'Daily Log',
  description: 'A daily mood and note logging app.',
  entities: [
    {
      name: 'MoodEntry',
      fields: [
        { name: 'id', type: 'int', nullable: false },
        { name: 'mood', type: 'int', nullable: false },
        { name: 'notes', type: 'text', nullable: true },
        { name: 'createdAt', type: 'date', nullable: false },
      ],
    },
  ],
  forms: [{ entity: 'MoodEntry', fields: ['mood', 'notes', 'createdAt'], submitLabel: 'Save Entry' }],
  views: [{ name: 'AllMoodEntries', entity: 'MoodEntry', columns: ['mood', 'notes', 'createdAt'], sortBy: 'createdAt' }],
  metadata: { author: 'test', version: '0.1.0', createdAt: new Date().toISOString() },
};

const BUDGET_SPEC = {
  appName: 'Budget Tracker',
  description: 'Track monthly expenses.',
  entities: [
    {
      name: 'Expense',
      fields: [
        { name: 'id', type: 'int', nullable: false },
        { name: 'title', type: 'string', nullable: false },
        { name: 'amount', type: 'real', nullable: false },
        { name: 'category', type: 'string', nullable: true },
        { name: 'date', type: 'date', nullable: false },
      ],
    },
  ],
  forms: [{ entity: 'Expense', fields: ['title', 'amount', 'category', 'date'], submitLabel: 'Add Expense' }],
  views: [{ name: 'AllExpenses', entity: 'Expense', columns: ['title', 'amount', 'category', 'date'], sortBy: 'date' }],
  metadata: { author: 'test', version: '0.1.0', createdAt: new Date().toISOString() },
};

const TASK_SPEC = {
  appName: 'Task List',
  description: 'Simple task management.',
  entities: [
    {
      name: 'Task',
      fields: [
        { name: 'id', type: 'int', nullable: false },
        { name: 'title', type: 'string', nullable: false },
        { name: 'completed', type: 'bool', nullable: false },
        { name: 'notes', type: 'text', nullable: true },
        { name: 'dueDate', type: 'date', nullable: true },
      ],
    },
  ],
  forms: [{ entity: 'Task', fields: ['title', 'completed', 'notes', 'dueDate'], submitLabel: 'Add Task' }],
  views: [{ name: 'AllTasks', entity: 'Task', columns: ['title', 'completed', 'notes', 'dueDate'], sortBy: 'id' }],
  metadata: { author: 'test', version: '0.1.0', createdAt: new Date().toISOString() },
};

// ─── Required file tree ───────────────────────────────────────────────────────

const REQUIRED_FILES = [
  'package.json',
  'tsconfig.json',
  'tsconfig.electron.json',
  'vite.config.ts',
  'electron-builder.yml',
  'db/schema.sql',
  'db/migrations/0001_init.sql',
  'electron/main.ts',
  'electron/preload.ts',
  'electron/migrations.ts',
  'src/App.tsx',
  'src/App.css',
  'src/main.tsx',
  'index.html',
  'README.md',
];

// ─── Run test cases ───────────────────────────────────────────────────────────

async function testSpec(label, spec) {
  console.log(`\n[${label}]`);

  const result = await generateApp(spec);
  assert(result.ok, 'generateApp returned ok');

  if (!result.ok || !result.appDir) {
    console.error('  codegen error:', result.error);
    return;
  }

  const { appDir, tscClean } = result;
  generatedDirs.push(appDir);
  console.log(`  appDir: ${appDir}`);

  // Required files
  for (const relPath of REQUIRED_FILES) {
    assertFile(appDir, relPath);
  }

  // Entity-specific component files
  for (const entity of spec.entities) {
    assertFile(appDir, `src/components/${entity.name}Form.tsx`);
  }
  for (const view of spec.views) {
    assertFile(appDir, `src/components/${view.name}View.tsx`);
  }

  // G2 gate: tsc --noEmit (renderer tsconfig only — electron has better-sqlite3 which needs npm install)
  assert(tscClean, 'tsc --noEmit clean (G2 gate)');
}

await testSpec('TC1: Daily Log', DAILY_LOG_SPEC);
await testSpec('TC2: Budget Tracker', BUDGET_SPEC);
await testSpec('TC3: Task List', TASK_SPEC);

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`Codegen tests: ${passed} passed, ${failed} failed`);
console.log('Generated app dirs:');
for (const d of generatedDirs) console.log(' ', d);

if (failed > 0) {
  console.error('G2 GATE: FAIL');
  process.exit(1);
} else {
  console.log('G2 GATE: PASS (3/3 specs produce tsc-clean directory trees)');
  process.exit(0);
}
