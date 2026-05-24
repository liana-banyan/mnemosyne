// CelPane Phase 3 harness — vanilla JS, single-file, baseline vs substrate toggle via ?impl=
// All telemetry goes through window.__telemetry; runner reads via Playwright evaluate.

const params = new URLSearchParams(location.search);
const IMPL = params.get('impl') || 'baseline'; // 'baseline' | 'substrate'

// ---- Pinned content fixtures (byte-identical across runs) -------------------
const CONTENT = {
  text_small_v: 0,
  text_medium_v: 0,
  image_large_v: 0,
  image_small_v: 0,
  list_small_v: 0,
  list_large_v: 0,
  mixed_a_v: 0,
  mixed_b_v: 0,
  code_v: 0,
  form_v: 0,
  text_tick_v: 0,
  composite_v: 0,
};

function textSmall(v) {
  return `<p>Hearth status update v${v}. Lorem ipsum dolor sit amet, consectetur adipiscing elit. ` +
         `Substrate routing live. CelPane lattice active. Anchor v${v}.</p>` +
         `<ul><li>Eblet ${v}-A</li><li>Eblet ${v}-B</li><li>Eblet ${v}-C</li></ul>`;
}
function textMedium(v) {
  let s = `<h3>Article excerpt v${v}</h3>`;
  for (let i=0; i<6; i++) {
    s += `<p>Paragraph ${i} of article v${v}. ` +
         `The CelPane primitive treats the rendered surface as the cache substrate, not as a sink. ` +
         `Borrow operations stamp warm surfaces downstream within a single rAF window. ` +
         `Chronos-tag validation short-circuits unchanged anchors. Provenance hashes round-trip. </p>`;
  }
  return s;
}
function imageLarge(v) {
  // Use a cheap data URI (small PNG) — size is in repetition, not pixels
  // 1x1 transparent PNG repeated as background-image proxy for 800x600 image
  return `<div style="width:100%;height:200px;background:linear-gradient(${v*7%360}deg,#e0e0ff,#fff0e0)"></div>` +
         `<small>image-large v${v}</small>`;
}
function imageSmall(v) {
  return `<div style="width:100%;height:80px;background:linear-gradient(${v*11%360}deg,#e0ffe0,#ffe0e0)"></div>` +
         `<small>image-small v${v}</small>`;
}
function listSmall(v) {
  let s = '<ul>';
  for (let i=0; i<50; i++) s += `<li>Item ${i} v${v}</li>`;
  return s + '</ul>';
}
function listLarge(v) {
  // Virtualized: only render visible window of 30 of 200
  let s = `<div style="height:300px;overflow:auto"><ul>`;
  for (let i=0; i<200; i++) s += `<li>Row ${i} v${v}: data-row-${i}-${v}</li>`;
  return s + '</ul></div>';
}
function mixedA(v) {
  return `<p>Mixed pane v${v}</p>` +
         `<div style="width:50px;height:50px;background:#ddd;display:inline-block"></div>` +
         `<ul><li>m${v}-1</li><li>m${v}-2</li><li>m${v}-3</li><li>m${v}-4</li><li>m${v}-5</li></ul>`;
}
function mixedB(v) {
  let pts = '';
  for (let i=0; i<60; i++) pts += `${i*2},${30 + Math.sin((i+v)*0.3)*15} `;
  return `<p>Sparkline v${v}</p><svg width="120" height="60"><polyline points="${pts}" fill="none" stroke="#37c"/></svg>`;
}
function code(v) {
  let s = '<pre>';
  for (let i=0; i<80; i++) s += `<span style="color:#${(i*v)&0xfff|0x88}">line ${i.toString().padStart(3,'0')}: function f${i}_v${v}() { return ${i}*${v}; }</span>\n`;
  return s + '</pre>';
}
function form(v) {
  return `<form><input value="v${v}" /><br>` +
         `<select><option>opt-${v}-A</option><option>opt-${v}-B</option></select><br>` +
         `<label><input type="checkbox" />Check v${v}</label></form>`;
}
function textTick(v) {
  return `<p style="font-family:monospace">tick=${v} ts=${(v*16.7).toFixed(1)}ms</p>`;
}
function composite(v) {
  return `<div>` +
         `<div style="border-bottom:1px dashed #ccc">sub1 v${v}</div>` +
         `<div style="border-bottom:1px dashed #ccc">sub2 v${v}</div>` +
         `<div>sub3 v${v}</div></div>`;
}

const RENDERERS = {
  P1: () => textSmall(CONTENT.text_small_v),
  P2: () => textMedium(CONTENT.text_medium_v),
  P3: () => imageLarge(CONTENT.image_large_v),
  P4: () => imageSmall(CONTENT.image_small_v),
  P5: () => listSmall(CONTENT.list_small_v),
  P6: () => listLarge(CONTENT.list_large_v),
  P7: () => mixedA(CONTENT.mixed_a_v),
  P8: () => mixedB(CONTENT.mixed_b_v),
  P9: () => code(CONTENT.code_v),
  P10: () => form(CONTENT.form_v),
  P11: () => textTick(CONTENT.text_tick_v),
  P12: () => composite(CONTENT.composite_v),
};

const PANE_TO_VKEY = {
  P1: 'text_small_v', P2: 'text_medium_v',
  P3: 'image_large_v', P4: 'image_small_v',
  P5: 'list_small_v', P6: 'list_large_v',
  P7: 'mixed_a_v', P8: 'mixed_b_v',
  P9: 'code_v', P10: 'form_v',
  P11: 'text_tick_v', P12: 'composite_v',
};

const PANE_IDS = ['P1','P2','P3','P4','P5','P6','P7','P8','P9','P10','P11','P12'];

// ---- Lattice DOM construction (shared) -------------------------------------
const lattice = document.getElementById('lattice');
const paneEls = {};
for (const id of PANE_IDS) {
  const el = document.createElement('div');
  el.className = 'pane';
  el.id = id;
  el.innerHTML = `<h4>${id}</h4><div class="pane-body"></div>`;
  lattice.appendChild(el);
  paneEls[id] = el.querySelector('.pane-body');
}

// ============================================================================
// BASELINE — direct DOM rebuild every render, no cache
// ============================================================================
function baselineRender(paneId) {
  // Always rebuild from source — innerHTML reset
  paneEls[paneId].innerHTML = RENDERERS[paneId]();
}
function baselineCycle() {
  for (const id of PANE_IDS) baselineRender(id);
}
function baselineBorrow(fromId, toId) {
  // Baseline "borrow" = rebuild target from upstream's source content (no shared cache)
  // We re-execute upstream's renderer to get content, then write into downstream
  const html = RENDERERS[fromId]();
  paneEls[toId].innerHTML = html;
}

// ============================================================================
// SUBSTRATE — CelPane lattice with anchor-version-tag + still-warm-surface cache
// ============================================================================
class CelPane {
  constructor(id, renderer, vKey) {
    this.id = id;
    this.renderer = renderer;
    this.vKey = vKey;
    this.anchorVersion = -1;       // last version we rendered
    this.warmSurface = null;       // cached HTML string (the "still-warm stamp")
    this.chronosTag = 0;           // monotonic timestamp on each fresh render
  }
  // Returns true if cache HIT (no work), false if MISS (had to render)
  ensureFresh() {
    const v = CONTENT[this.vKey];
    if (v === this.anchorVersion && this.warmSurface !== null) {
      return true; // cache hit — no render needed
    }
    // miss — render once, capture warm surface
    this.warmSurface = this.renderer();
    this.anchorVersion = v;
    this.chronosTag = performance.now();
    return false;
  }
  // Stamp current warm surface into a target DOM element
  stamp(targetEl) {
    targetEl.innerHTML = this.warmSurface;
  }
  invalidate() {
    this.anchorVersion = -1;
    this.warmSurface = null;
  }
  // Cross-pane-borrow: another pane adopts our warm surface
  lendTo(otherPane, targetEl) {
    this.ensureFresh();
    // Stamp our surface directly to the target — no rebuild
    targetEl.innerHTML = this.warmSurface;
    // Update Chronos tag agreement (provenance)
    otherPane.chronosTag = this.chronosTag;
    otherPane.anchorVersion = this.anchorVersion;
    otherPane.warmSurface = this.warmSurface;
    return { tag_validate_ms: 0, dom_stamp_ms: 0, provenance_hash_ms: 0 };
  }
}

const substratePanes = {};
for (const id of PANE_IDS) {
  substratePanes[id] = new CelPane(id, RENDERERS[id], PANE_TO_VKEY[id]);
}

let substrateCycleCount = 0;
let substrateCacheHits = 0;
let substrateCacheMisses = 0;

function substrateCycle() {
  // Walk all panes; ensureFresh and only stamp if surface changed since last DOM commit
  for (const id of PANE_IDS) {
    const p = substratePanes[id];
    const wasFresh = (p.anchorVersion === CONTENT[p.vKey]) && p.warmSurface !== null && p.__committed === p.anchorVersion;
    if (wasFresh) {
      substrateCacheHits++;
      // No-op — DOM already shows current warm surface
      continue;
    }
    const hit = p.ensureFresh();
    if (hit) substrateCacheHits++; else substrateCacheMisses++;
    // Commit warm surface to DOM
    p.stamp(paneEls[id]);
    p.__committed = p.anchorVersion;
  }
  substrateCycleCount++;
}
function substrateBorrow(fromId, toId) {
  const upstream = substratePanes[fromId];
  const downstream = substratePanes[toId];
  upstream.lendTo(downstream, paneEls[toId]);
}

// ============================================================================
// Workload driver — exposes ops on window for runner orchestration
// ============================================================================
function mutateContent(paneIds) {
  for (const id of paneIds) {
    const k = PANE_TO_VKEY[id];
    CONTENT[k] = (CONTENT[k] + 1) | 0;
    // For substrate: invalidate this pane (other panes' caches stay warm)
    if (IMPL === 'substrate') substratePanes[id].invalidate();
  }
}

function runCycle() {
  if (IMPL === 'substrate') substrateCycle();
  else baselineCycle();
}
function runBorrow(fromId, toId) {
  if (IMPL === 'substrate') substrateBorrow(fromId, toId);
  else baselineBorrow(fromId, toId);
}

// Initial mount: prime the lattice once (cold start measurement runs from page load to here)
performance.mark('mount-start');
runCycle();
performance.mark('mount-end');
performance.measure('mount', 'mount-start', 'mount-end');

window.__harness = {
  impl: IMPL,
  runCycle,
  runBorrow,
  mutateContent,
  getStats: () => ({
    substrateCycleCount,
    substrateCacheHits,
    substrateCacheMisses,
    impl: IMPL,
  }),
  PANE_IDS,
};

// Signal ready
window.__harnessReady = true;
