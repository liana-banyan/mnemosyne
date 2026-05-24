// AMPLIFY Computer — Hearth App Builder — Code Generator
// B69a — validated AppSpec → Electron+SQLite directory tree
// Output: ~/.lb_hearth_apps/<appName>-<uuid>/
// All generated code must pass `tsc --noEmit`. G2 gate.

import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { randomUUID } from 'crypto';
import { execSync } from 'child_process';
import { AppSpec, Entity, EntityField, FieldType, CodegenResult } from './types';
import {
  render,
  PACKAGE_JSON,
  TSCONFIG_JSON,
  TSCONFIG_ELECTRON_JSON,
  VITE_CONFIG,
  ELECTRON_BUILDER_YML,
  DB_SCHEMA_HEADER,
  MIGRATION_INIT_HEADER,
  ELECTRON_MAIN,
  ELECTRON_PRELOAD,
  ELECTRON_MIGRATIONS,
  RENDERER_APP_TSX,
  RENDERER_APP_CSS,
  INDEX_HTML,
  MAIN_TSX,
  README_MD,
} from './templates/base_electron_sqlite';

const HEARTH_APPS_DIR = join(homedir(), '.lb_hearth_apps');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function toLabel(camel: string): string {
  return camel
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

function fieldTypeToSQLite(type: FieldType): string {
  switch (type) {
    case 'int': return 'INTEGER';
    case 'real': return 'REAL';
    case 'bool': return 'INTEGER'; // SQLite bool as 0/1
    case 'date': return 'TEXT';    // ISO8601 string
    case 'text': return 'TEXT';
    case 'string': return 'TEXT';
  }
}

function fieldTypeToTSType(type: FieldType): string {
  switch (type) {
    case 'int': return 'number';
    case 'real': return 'number';
    case 'bool': return 'boolean';
    case 'date': return 'string';
    case 'text': return 'string';
    case 'string': return 'string';
  }
}

function fieldTypeToInputType(type: FieldType): string {
  switch (type) {
    case 'int': return 'number';
    case 'real': return 'number';
    case 'bool': return 'checkbox';
    case 'date': return 'date';
    case 'text': return 'textarea';
    case 'string': return 'text';
  }
}

// ─── SQL generation ───────────────────────────────────────────────────────────

function generateCreateTable(entity: Entity): string {
  const cols = entity.fields.map((f) => {
    const sqlType = fieldTypeToSQLite(f.type);
    const pk = f.name === 'id' ? ' PRIMARY KEY AUTOINCREMENT' : '';
    const nullable = f.name === 'id' ? ' NOT NULL' : (f.nullable === false ? ' NOT NULL' : '');
    return `  ${f.name} ${sqlType}${pk}${nullable}`;
  });
  return `CREATE TABLE IF NOT EXISTS ${entity.name.toLowerCase()} (\n${cols.join(',\n')}\n);`;
}

function generateSchema(spec: AppSpec): string {
  const tables = spec.entities.map(generateCreateTable).join('\n\n');
  return render(DB_SCHEMA_HEADER, { APP_NAME: spec.appName, CREATED_AT: new Date().toISOString() }) + tables + '\n';
}

function generateMigration(spec: AppSpec): string {
  const header = render(MIGRATION_INIT_HEADER, { APP_NAME: spec.appName });
  const tables = spec.entities.map(generateCreateTable).join('\n\n');
  return header + tables + '\n';
}

// ─── IPC handlers (electron/main.ts injection) ────────────────────────────────

function generateIPCHandlers(spec: AppSpec): string {
  const blocks: string[] = [];

  for (const entity of spec.entities) {
    const tableName = entity.name.toLowerCase();
    const insertFields = entity.fields.filter((f) => f.name !== 'id');
    const insertCols = insertFields.map((f) => f.name).join(', ');
    const insertPlaceholders = insertFields.map((f) => `@${f.name}`).join(', ');
    const insertType = insertFields.map((f) => `${f.name}: ${fieldTypeToTSType(f.type)}`).join('; ');

    blocks.push(`
// ${entity.name} CRUD
function register${entity.name}IPC(): void {
  ipcMain.handle('${tableName}-insert', (_event, row: { ${insertType} }) => {
    const stmt = db!.prepare(
      'INSERT INTO ${tableName} (${insertCols}) VALUES (${insertPlaceholders})'
    );
    const result = stmt.run(row);
    return { ok: true, id: result.lastInsertRowid };
  });

  ipcMain.handle('${tableName}-list', () => {
    return db!.prepare('SELECT * FROM ${tableName} ORDER BY id DESC').all();
  });

  ipcMain.handle('${tableName}-delete', (_event, id: number) => {
    db!.prepare('DELETE FROM ${tableName} WHERE id = ?').run(id);
    return { ok: true };
  });
}
`);
  }

  const registerCalls = spec.entities.map((e) => `  register${e.name}IPC();`).join('\n');

  return blocks.join('\n') + `\nfunction registerIPC(): void {\n${registerCalls}\n}`;
}

// ─── Preload bridge generation ────────────────────────────────────────────────

function generatePreloadBridge(spec: AppSpec): string {
  const lines: string[] = [];
  for (const entity of spec.entities) {
    const tableName = entity.name.toLowerCase();
    lines.push(`  ${tableName}Insert: (row: Record<string, unknown>) => ipcRenderer.invoke('${tableName}-insert', row),`);
    lines.push(`  ${tableName}List: () => ipcRenderer.invoke('${tableName}-list'),`);
    lines.push(`  ${tableName}Delete: (id: number) => ipcRenderer.invoke('${tableName}-delete', id),`);
  }
  return lines.join('\n');
}

// ─── React components ─────────────────────────────────────────────────────────

function generateFormComponent(spec: AppSpec, entityName: string): string {
  const form = spec.forms.find((f) => f.entity === entityName);
  const entity = spec.entities.find((e) => e.name === entityName);
  if (!form || !entity) return '';

  const tableName = entityName.toLowerCase();
  const componentName = `${entityName}Form`;
  const formFields = form.fields;
  const fieldDefs = entity.fields.filter((f) => formFields.includes(f.name));

  const stateLines = fieldDefs.map((f) => {
    if (f.type === 'bool') return `  const [${f.name}, set${capitalise(f.name)}] = useState<boolean>(false);`;
    if (f.type === 'int' || f.type === 'real') return `  const [${f.name}, set${capitalise(f.name)}] = useState<string>('');`;
    return `  const [${f.name}, set${capitalise(f.name)}] = useState<string>('');`;
  });

  const fieldRenders = fieldDefs.map((f) => {
    const inputType = fieldTypeToInputType(f.type);
    const label = toLabel(f.name);

    if (inputType === 'textarea') {
      return `        <div className="field-group">
          <label>{/* ${label} */}${label}</label>
          <textarea value={${f.name}} onChange={(e) => set${capitalise(f.name)}(e.target.value)} />
        </div>`;
    }
    if (inputType === 'checkbox') {
      return `        <div className="field-group">
          <label>
            <input type="checkbox" checked={${f.name}} onChange={(e) => set${capitalise(f.name)}(e.target.checked)} />
            {' ${label}'}
          </label>
        </div>`;
    }
    return `        <div className="field-group">
          <label>${label}</label>
          <input type="${inputType}" value={${f.name}} onChange={(e) => set${capitalise(f.name)}(e.target.value)} />
        </div>`;
  });

  const rowObj = fieldDefs.map((f) => {
    if (f.type === 'int') return `${f.name}: parseInt(${f.name}, 10) || 0`;
    if (f.type === 'real') return `${f.name}: parseFloat(${f.name}) || 0`;
    if (f.type === 'bool') return `${f.name}: ${f.name} ? 1 : 0`;
    if (f.type === 'date') return `${f.name}: ${f.name} || new Date().toISOString().slice(0, 10)`;
    return `${f.name}`;
  }).join(', ');

  const resets = fieldDefs.map((f) => {
    if (f.type === 'bool') return `set${capitalise(f.name)}(false);`;
    return `set${capitalise(f.name)}('');`;
  });

  return `// ${componentName} — Generated by Hearth App Builder (B69)
import { useState } from 'react';

declare global { interface Window { db: Record<string, (...args: unknown[]) => Promise<unknown>>; } }

export function ${componentName}({ onSaved }: { onSaved?: () => void }) {
${stateLines.join('\n')}
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await window.db.${tableName}Insert({ ${rowObj} });
    ${resets.join(' ')}
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    onSaved?.();
  }

  return (
    <div className="form-card">
      <h2>New ${entityName}</h2>
      <form onSubmit={handleSubmit}>
${fieldRenders.join('\n')}
        <button type="submit" className="submit-btn">${form.submitLabel ?? 'Save'}</button>
        {saved && <span className="submit-ok">Saved!</span>}
      </form>
    </div>
  );
}
`;
}

function generateViewComponent(spec: AppSpec, view: { name: string; entity: string; columns: string[]; sortBy?: string }): string {
  const tableName = view.entity.toLowerCase();
  const componentName = `${view.name}View`;

  const headers = view.columns.map((c) => `<th>${toLabel(c)}</th>`).join('');
  const cells = view.columns.map((c) => `<td>{String(row.${c} ?? '')}</td>`).join('');

  return `// ${componentName} — Generated by Hearth App Builder (B69)
import { useState, useEffect } from 'react';

declare global { interface Window { db: Record<string, (...args: unknown[]) => Promise<unknown>>; } }

type Row = Record<string, unknown>;

export function ${componentName}({ refresh }: { refresh?: number }) {
  const [rows, setRows] = useState<Row[]>([]);

  async function load() {
    const data = await window.db.${tableName}List() as Row[];
    setRows(data);
  }

  useEffect(() => { load(); }, [refresh]);

  async function handleDelete(id: number) {
    if (!confirm('Delete this entry?')) return;
    await window.db.${tableName}Delete(id);
    load();
  }

  return (
    <div className="view-card">
      <h2>${view.name.replace(/([A-Z])/g, ' $1').trim()}</h2>
      {rows.length === 0 ? (
        <p className="empty-state">No entries yet. Add one above!</p>
      ) : (
        <table>
          <thead><tr>${headers}<th>Actions</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={String(row.id)}>
                ${cells}
                <td>
                  <button onClick={() => handleDelete(Number(row.id))} style={{color: 'red', background: 'none', border: 'none', cursor: 'pointer'}}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
`;
}

function generateAppTsx(spec: AppSpec): string {
  const formImports = spec.entities
    .map((e) => `import { ${e.name}Form } from './components/${e.name}Form';`)
    .join('\n');
  const viewImports = spec.views
    .map((v) => `import { ${v.name}View } from './components/${v.name}View';`)
    .join('\n');
  const formRenders = spec.entities
    .map((e) => `            <${e.name}Form onSaved={() => setRefresh(r => r + 1)} />`)
    .join('\n');
  const viewRenders = spec.views
    .map((v) => `            <${v.name}View refresh={refresh} />`)
    .join('\n');

  return render(RENDERER_APP_TSX, {
    APP_NAME: spec.appName,
    FORM_IMPORTS: formImports,
    VIEW_IMPORTS: viewImports,
    FORM_RENDERS: formRenders,
    VIEW_RENDERS: viewRenders,
  }).replace(
    'const [tab, setTab] = useState<Tab>(\'forms\');',
    'const [tab, setTab] = useState<Tab>(\'forms\');\n  const [refresh, setRefresh] = useState(0);',
  );
}

// ─── Write helpers ────────────────────────────────────────────────────────────

function writeFile(filePath: string, content: string): void {
  mkdirSync(join(filePath, '..'), { recursive: true });
  writeFileSync(filePath, content, 'utf8');
}

// ─── Main codegen entry point ─────────────────────────────────────────────────

export async function generateApp(spec: AppSpec, uuid?: string): Promise<CodegenResult> {
  const appUuid = uuid ?? randomUUID();
  const appSlug = slugify(spec.appName);
  const appDir = join(HEARTH_APPS_DIR, `${appSlug}-${appUuid.slice(0, 8)}`);

  try {
    mkdirSync(appDir, { recursive: true });

    const vars: Record<string, string> = {
      APP_NAME: spec.appName,
      APP_SLUG: appSlug,
      APP_DESCRIPTION: spec.description.replace(/"/g, '\\"'),
      APP_UUID: appUuid,
      CREATED_AT: spec.metadata.createdAt,
    };

    // package.json
    writeFile(join(appDir, 'package.json'), render(PACKAGE_JSON, vars));

    // tsconfigs
    writeFile(join(appDir, 'tsconfig.json'), TSCONFIG_JSON);
    writeFile(join(appDir, 'tsconfig.electron.json'), TSCONFIG_ELECTRON_JSON);

    // vite.config.ts
    writeFile(join(appDir, 'vite.config.ts'), VITE_CONFIG);

    // electron-builder.yml
    writeFile(join(appDir, 'electron-builder.yml'), render(ELECTRON_BUILDER_YML, vars));

    // DB
    writeFile(join(appDir, 'db', 'schema.sql'), generateSchema(spec));
    writeFile(join(appDir, 'db', 'migrations', '0001_init.sql'), generateMigration(spec));

    // Electron main process
    const ipcHandlers = generateIPCHandlers(spec);
    writeFile(
      join(appDir, 'electron', 'main.ts'),
      render(ELECTRON_MAIN, { ...vars, IPC_HANDLERS: ipcHandlers }),
    );

    // Electron preload
    const preloadBridge = generatePreloadBridge(spec);
    writeFile(
      join(appDir, 'electron', 'preload.ts'),
      render(ELECTRON_PRELOAD, { ...vars, PRELOAD_BRIDGE: preloadBridge }),
    );

    // Electron migrations
    writeFile(
      join(appDir, 'electron', 'migrations.ts'),
      render(ELECTRON_MIGRATIONS, vars),
    );

    // Renderer App
    writeFile(join(appDir, 'src', 'App.tsx'), generateAppTsx(spec));
    writeFile(join(appDir, 'src', 'App.css'), render(RENDERER_APP_CSS, vars));
    writeFile(join(appDir, 'index.html'), render(INDEX_HTML, vars));
    writeFile(join(appDir, 'src', 'main.tsx'), MAIN_TSX);

    // Per-entity form components
    for (const entity of spec.entities) {
      writeFile(
        join(appDir, 'src', 'components', `${entity.name}Form.tsx`),
        generateFormComponent(spec, entity.name),
      );
    }

    // Per-view view components
    for (const view of spec.views) {
      writeFile(
        join(appDir, 'src', 'components', `${view.name}View.tsx`),
        generateViewComponent(spec, view),
      );
    }

    // README
    writeFile(join(appDir, 'README.md'), render(README_MD, vars));

    // assets placeholder
    writeFile(
      join(appDir, 'assets', '.gitkeep'),
      '# Place app icon files here: icon.ico (Windows), icon.icns (macOS), icon.png (Linux)\n',
    );

    // ── G2 gate: tsc --noEmit check ───────────────────────────────────────────
    // Uses --ignore-scripts to skip native module compilation (better-sqlite3)
    // during the tsc check phase — native builds happen during the full build runner step.
    // Renderer tsconfig covers src/** (React components) — no native deps needed.
    let tscClean = false;
    try {
      // Step 1: install JS+TS deps only (skip node-gyp native builds)
      execSync(
        'npm install --ignore-scripts --prefer-offline --no-audit --no-fund --loglevel=error',
        { cwd: appDir, stdio: 'pipe', timeout: 120_000 },
      );
      // Step 2: tsc --noEmit against renderer tsconfig (src/ only — no better-sqlite3 import)
      // Use node directly to invoke tsc so the command works cross-platform (avoids .bin/tsc on Windows)
      execSync('node node_modules/typescript/bin/tsc --noEmit', { cwd: appDir, stdio: 'pipe', timeout: 30_000 });
      tscClean = true;
    } catch (tscErr) {
      const stderr = (tscErr as NodeJS.ErrnoException & { stderr?: Buffer }).stderr;
      console.warn('[Codegen] tsc --noEmit errors:\n', stderr?.toString() ?? String(tscErr));
    }

    return { ok: true, appDir, tscClean };
  } catch (err) {
    return { ok: false, error: String(err), tscClean: false };
  }
}

export { HEARTH_APPS_DIR };
