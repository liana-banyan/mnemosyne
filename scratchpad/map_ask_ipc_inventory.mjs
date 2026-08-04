// Ask-surface + IPC front-door inventory generator. Companion to map_pipeline_inventory.mjs,
// same philosophy: print the volatile facts mechanically so no ticket has to hand-type them,
// or trust a stale line number written into a doc.
//
// Produces three sections:
//   A. ROUTED COMPONENT INVENTORY  -- import + JSX-render sites for a watchlist of Ask-surface
//      components, plus any nearby route/hash guard text so a human can see (not infer) which
//      render sites are gated behind a hash route vs unconditional.
//   B. IPC CHANNEL INVENTORY       -- every ipcMain.handle/on channel under src/main, and every
//      ipcRenderer.invoke/send/on channel under src/main (this repo's preload lives there too)
//      and src/renderer, with file + line for each.
//   C. HANDLER-TO-CHANNEL MAPPING  -- joins B's two sides by channel string: which file defines
//      the handler, which preload-exposed API method (if any) wraps it, and whether any file in
//      the Ask-surface watchlist references that exposed method by name.
//
// Usage:  node scratchpad/map_ask_ipc_inventory.mjs
// This file does not infer intent. It reports what it can find mechanically; the narrative
// layer in the HardWire doc is the human interpretation of these facts.
import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = process.cwd();
const SRC = path.join(REPO_ROOT, 'src');

const ASK_SURFACE_WATCHLIST = [
  'LeanAskTab',
  'AskHomeTab',
  'AskEngineView',
  'CompassShell',
  'CleanShell',
  'LeanShell',
];

function walk(dir, exts, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, exts, out);
    else if (exts.some((e) => entry.name.endsWith(e))) out.push(full);
  }
  return out;
}

function rel(p) {
  return path.relative(REPO_ROOT, p).replace(/\\/g, '/');
}

const mainFiles = walk(path.join(SRC, 'main'), ['.ts', '.tsx']);
const rendererFiles = walk(path.join(SRC, 'renderer'), ['.ts', '.tsx']);
const allFiles = [...mainFiles, ...rendererFiles];

// ── Section A: routed component inventory ──────────────────────────────────────────────────
function sectionA() {
  const rows = [];
  for (const name of ASK_SURFACE_WATCHLIST) {
    const importSites = [];
    const jsxSites = [];
    for (const file of allFiles) {
      const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
      lines.forEach((line, i) => {
        if (new RegExp(`\\bimport\\s*\\{[^}]*\\b${name}\\b[^}]*\\}\\s*from`).test(line)) {
          importSites.push({ file: rel(file), line: i + 1, text: line.trim() });
        }
        const jsxRe = new RegExp(`<${name}\\b`);
        if (jsxRe.test(line)) {
          // capture a small window of nearby lines so a human can see route/hash guards
          // without this script guessing what they mean.
          const context = lines.slice(Math.max(0, i - 3), i).map((l) => l.trim()).filter(Boolean);
          jsxSites.push({ file: rel(file), line: i + 1, text: line.trim(), contextAbove: context });
        }
      });
    }
    rows.push({ name, importSites, jsxSites });
  }
  return rows;
}

// ── Section B: IPC channel inventory ────────────────────────────────────────────────────────
// NOTE: ipcMain.handle(/ipcRenderer.invoke( calls in this codebase are frequently written with
// the channel string on the line AFTER the opening paren, e.g.:
//   ipcMain.handle(
//     'ai-dispatch:query',
//     async (event, args) => { ... },
//   );
// A same-line-only regex silently drops every one of these -- which is exactly the kind of
// mechanical miss a generator exists to prevent. So the call-site regex below only detects the
// call itself; the channel string is resolved by lookNextLinesForString(), which scans forward
// a few lines for the first quoted literal. This was caught by cross-checking this script's own
// output against a manual grep during KN-BP144-8 Phase 0 -- see HARDWIRE-02 staleness notes.
const IPC_MAIN_CALL_RE = /ipcMain\.(handle|on)\(/;
const IPC_RENDERER_CALL_RE = /ipcRenderer\.(invoke|send|on)\(/;
const STRING_LITERAL_RE = /['"]([^'"]+)['"]/;
const EXPOSE_RE = /contextBridge\.exposeInMainWorld\(\s*['"]([^'"]+)['"]/;

function lookNextLinesForString(lines, idx, sameLine) {
  const sameLineMatch = sameLine.match(STRING_LITERAL_RE);
  if (sameLineMatch) return sameLineMatch[1];
  for (let i = idx + 1; i <= Math.min(lines.length - 1, idx + 3); i++) {
    const m = lines[i].match(STRING_LITERAL_RE);
    if (m) return m[1];
  }
  return null;
}
// heuristic: nearest preceding "methodName(" or "methodName: (" line above an ipcRenderer call,
// used to name which exposed API method wraps that channel. Best-effort, not a real AST walk.
const METHOD_KEY_RE = /^\s*([A-Za-z0-9_$]+)\s*[:(]/;

function findEnclosingFn(lines, idx) {
  for (let i = idx; i >= 0; i--) {
    const m = lines[i].match(/(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_$]+)/);
    if (m) return m[1];
    const m2 = lines[i].match(/(?:export\s+)?const\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?\(/);
    if (m2) return m2[1];
  }
  return '(module scope)';
}

function findEnclosingExposeNamespace(lines, idx) {
  for (let i = idx; i >= 0; i--) {
    const m = lines[i].match(EXPOSE_RE);
    if (m) return m[1];
  }
  return null;
}

function findNearestMethodKey(lines, idx) {
  for (let i = idx - 1; i >= Math.max(0, idx - 6); i--) {
    const m = lines[i].match(METHOD_KEY_RE);
    if (m) return m[1];
  }
  return '(unresolved)';
}

function sectionB() {
  const mainHandlers = [];
  const rendererCalls = [];

  for (const file of mainFiles) {
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    lines.forEach((line, i) => {
      const m = line.match(IPC_MAIN_CALL_RE);
      if (m) {
        const channel = lookNextLinesForString(lines, i, line);
        if (!channel) return; // dynamic channel name (variable, not literal) -- cannot map mechanically
        mainHandlers.push({
          channel,
          kind: m[1],
          file: rel(file),
          line: i + 1,
          enclosingFn: findEnclosingFn(lines, i),
        });
      }
    });
  }

  for (const file of allFiles) {
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    lines.forEach((line, i) => {
      const m = line.match(IPC_RENDERER_CALL_RE);
      if (m) {
        const channel = lookNextLinesForString(lines, i, line);
        if (!channel) return;
        rendererCalls.push({
          channel,
          kind: m[1],
          file: rel(file),
          line: i + 1,
          exposeNamespace: findEnclosingExposeNamespace(lines, i),
          exposedMethod: findNearestMethodKey(lines, i),
        });
      }
    });
  }

  return { mainHandlers, rendererCalls };
}

// ── Section C: handler-to-channel mapping ───────────────────────────────────────────────────
function sectionC(mainHandlers, rendererCalls) {
  const channels = new Set([...mainHandlers.map((h) => h.channel), ...rendererCalls.map((c) => c.channel)]);
  const rows = [];
  for (const channel of channels) {
    const handlers = mainHandlers.filter((h) => h.channel === channel);
    const preloadWrap = rendererCalls.filter(
      (c) => c.channel === channel && c.file.startsWith('src/main/preload.ts'),
    );
    const directRendererCalls = rendererCalls.filter(
      (c) => c.channel === channel && c.file.startsWith('src/renderer/'),
    );
    // Does any Ask-surface watchlist file reference the exposed method name by string?
    const referencedByAskSurface = [];
    if (preloadWrap.length) {
      for (const wrap of preloadWrap) {
        for (const file of rendererFiles) {
          const base = path.basename(file);
          if (!ASK_SURFACE_WATCHLIST.some((n) => base.startsWith(n))) continue;
          const text = fs.readFileSync(file, 'utf8');
          if (wrap.exposedMethod !== '(unresolved)' && text.includes(`.${wrap.exposedMethod}(`)) {
            referencedByAskSurface.push({ file: rel(file), viaMethod: wrap.exposedMethod });
          }
        }
      }
    }
    rows.push({ channel, handlers, preloadWrap, directRendererCalls, referencedByAskSurface });
  }
  return rows.sort((a, b) => a.channel.localeCompare(b.channel));
}

// ── Print ────────────────────────────────────────────────────────────────────────────────────
console.log('='.repeat(100));
console.log('SECTION A: ROUTED COMPONENT INVENTORY (Ask-surface watchlist)');
console.log('='.repeat(100));
for (const row of sectionA()) {
  console.log(`\n-- ${row.name} --`);
  console.log(`  imported at ${row.importSites.length} site(s):`);
  for (const s of row.importSites) console.log(`    ${s.file}:${s.line}  ${s.text}`);
  console.log(`  rendered as JSX at ${row.jsxSites.length} site(s):`);
  for (const s of row.jsxSites) {
    console.log(`    ${s.file}:${s.line}  ${s.text}`);
    if (s.contextAbove.length) {
      console.log(`      context above:`);
      s.contextAbove.forEach((c) => console.log(`        ${c}`));
    }
  }
}

const { mainHandlers, rendererCalls } = sectionB();
console.log('\n' + '='.repeat(100));
console.log(`SECTION B: IPC CHANNEL INVENTORY  (${mainHandlers.length} main-side handlers, ${rendererCalls.length} renderer-side calls)`);
console.log('='.repeat(100));
console.log('\n-- ipcMain.handle / ipcMain.on --');
for (const h of mainHandlers) {
  console.log(`  [${h.kind}] '${h.channel}'  registered in ${h.enclosingFn}()  @ ${h.file}:${h.line}`);
}
console.log('\n-- ipcRenderer.invoke / ipcRenderer.send / ipcRenderer.on --');
for (const c of rendererCalls) {
  const ns = c.exposeNamespace ? `window.${c.exposeNamespace}.${c.exposedMethod}` : `(no exposeInMainWorld wrapper found above)`;
  console.log(`  [${c.kind}] '${c.channel}'  exposed as ${ns}  @ ${c.file}:${c.line}`);
}

console.log('\n' + '='.repeat(100));
console.log('SECTION C: HANDLER-TO-CHANNEL MAPPING');
console.log('='.repeat(100));
for (const row of sectionC(mainHandlers, rendererCalls)) {
  console.log(`\n-- '${row.channel}' --`);
  console.log(`  main handler(s): ${row.handlers.length ? row.handlers.map((h) => `${h.enclosingFn}() @ ${h.file}:${h.line}`).join('; ') : '(none found -- renderer calls a channel with no ipcMain side in src/main)'}`);
  console.log(`  preload wrapper(s): ${row.preloadWrap.length ? row.preloadWrap.map((w) => `window.${w.exposeNamespace}.${w.exposedMethod} @ ${w.file}:${w.line}`).join('; ') : '(none -- not exposed via preload.ts, or called directly)'}`);
  if (row.directRendererCalls.length) {
    console.log(`  direct renderer call(s) (bypassing preload naming): ${row.directRendererCalls.map((c) => `${c.file}:${c.line}`).join('; ')}`);
  }
  console.log(`  referenced by Ask-surface watchlist file(s): ${row.referencedByAskSurface.length ? row.referencedByAskSurface.map((r) => `${r.file} (via .${r.viaMethod}())`).join('; ') : '(none found)'}`);
}

console.log('\n' + '='.repeat(100));
console.log(`DONE. Scanned ${mainFiles.length} files under src/main, ${rendererFiles.length} files under src/renderer.`);
console.log('Regenerate this before trusting any channel name or line number written in a ticket.');
