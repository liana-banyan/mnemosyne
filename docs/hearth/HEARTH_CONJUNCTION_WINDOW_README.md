# Hearth Conjunction Window — B83 README
## "The Heavy Booster Test Surface"
**Bushel 83 · BP035 · May 9, 2026**

---

## What It Is

The **Hearth Conjunction Window** is the unified Founder-facing surface that pulls together every Wave 4 LANDED primitive into one Electron window. It is the first user-facing artifact of the cooperative-AI substrate at escape velocity from solo-Founder-orchestration class.

**Founder-coined names (immutable — R-FOUNDER-NAMING-PROVENANCE):**
- **Hearth Conjunction Window** — this window
- **In Conjunction** — the multi-backend selectable mode (NOT "ensemble", NOT "fan-out", NOT "multiplex")
- **HEAVY BOOSTER TEST** — the BP035 test class this window enables

---

## Opening the Window

From the system tray:
> Right-click AMPLIFY Computer tray icon → **🔥 Hearth Conjunction Window**

Or via keyboard / IPC:
```js
window.amplify.openHearthConjunction();
```

Minimum size: 1280×800. Preferred: 1600×1000.

---

## Five Panels

### Left Column
| Panel | Source | Description |
|---|---|---|
| App Builder Chat | B69 (commit `7266229`) | Plain-English → Electron+SQLite app generator |
| Embedded Chrome | B83b | Chromium webview with auto-substrate-injection into Google Search AI |
| Drekaskip Wave Status | B83c / B61A (commit `42ecdcd`) | Live saga + wave instance count |

### Right Column
| Panel | Source | Description |
|---|---|---|
| In Conjunction | B83a | Backend selector: CPU / Ollama / Knight / Opus / All |
| Active Substrate | B83d / Watchdog Knight | 9-subject health grid with drilldown drawer |

---

## In Conjunction — Backend Modes

| Mode | Description | Cost | Notes |
|---|---|---|---|
| `cpu_only` | Rule-based + substrate lookup | $0 | Default — no spend until explicitly changed |
| `ollama` | Local llama3.1:8b-instruct-q4_K_M | $0 | Requires Ollama daemon running |
| `knight_cursor` | Routes to Knight via Yoke file bridge | $0 | Best-effort async — Knight is human-operated |
| `opus_claude` | Anthropic claude-opus-4-7 | ~$15/1M input tokens | Requires `ANTHROPIC_API_KEY` in env |
| `all_in_conjunction` | Parallel fan-out to all 4 | varies | K30-class speculative branch fleet |

**Shift+click** any mode for a one-shot per-request override.

**State persistence:** `%APPDATA%\AMPLIFY Computer\hearth_conjunction\conjunction_state.json`

---

## Embedded Chrome — Auto-Substrate-Injection

When the Founder opens a page in the Embedded Chrome panel and presses Enter to submit to Google Search AI, the substrate-context preamble is automatically prepended to the prompt.

**Preamble format:**
```
[LB Cooperative-AI Substrate context — auto-injected]
Active MCCI thread: <thread_id> | <participants> | <topic>
Recent canon refs: <up to 5 LB-STACK / LB-CODEX IDs>
Active session: BP035 / Heavy Booster Test
Founder voice anchors active: <up to 3 from current session>
[End substrate context. User question follows.]
```

**Injection receipts:** `%APPDATA%\AMPLIFY Computer\hearth_conjunction\embedded_browser_injection.jsonl`

**Multi-browser status:** Chrome/Chromium only at v1. Firefox / Edge / Brave / Safari deferred to `B83-FOLLOWUP-MULTIBROWSER` per Founder direct: *"After we prove it works, yeah? ;)"*

### Failure modes
- **Selector miss** (Google DOM shift): degraded-mode UX + `event: 'selector_miss'` logged
- **CSP block**: notice shown; substrate context copied to clipboard for manual paste

---

## Receipt Logs

| Log | Path | Fed to |
|---|---|---|
| Conjunction receipts (SE-4 envelope) | `...hearth_conjunction/conjunction_receipts.jsonl` | Audit trail |
| Sweat Scribe signals (effort) | `...hearth_conjunction/hearth_conjunction_effort_signals_pending.jsonl` | B80 Sweat Scribe |
| Tears Scribe signals (loss-after-effort) | `...hearth_conjunction/hearth_conjunction_loss_signals_pending.jsonl` | B81 Tears Scribe |
| Injection events | `...hearth_conjunction/embedded_browser_injection.jsonl` | Patent receipt |

---

## Wave 4 Predecessors This Window Unifies

| Predecessor | Commit | Role |
|---|---|---|
| B69 Hearth App Builder | `7266229` | App Builder Chat in left panel |
| B82 MoneyPenny Big Show | `c8e2cfb` | MCCI thread → substrate context preamble |
| B61A Drekaskip Wave Generator | `42ecdcd` | Drekaskip Status panel; `all_in_conjunction` waves |
| B-SE4-1 SE-4 Shadow E-Signal | `2756476` | All receipts wear Lamport + HMAC envelopes |
| Watchdog Knight | BP034 | Active Substrate 9-subject health grid |
| B80 Sweat Scribe | BP034 | Effort signals per adapter dispatch |
| B81 Tears Scribe | BP034 | Loss signals on adapter error |

---

## Multi-Browser Deferral (G14)

v1 ships **Chrome/Chromium only** via Electron's built-in Chromium webview (`<webview>` tag with `webviewTag: true`).

The injection abstraction (`auto_inject_rules.ts`) is designed to accommodate per-browser rules — the `InjectionRule[]` array can be extended with Firefox/Edge/Brave/Safari selectors at follow-up.

**Deferred bushel:** `B83-FOLLOWUP-MULTIBROWSER`

---

## Build

```powershell
# In amplify-computer/
npm run build:main    # Compiles main process (includes B83 hearth/ modules)
npm run build:renderer # Vite build (includes HearthConjunctionWindow renderer)
npm run build         # Both
```

The webview preload at `src/main/hearth/embedded_browser/webview_preload.ts` compiles to `dist/main/hearth/embedded_browser/webview_preload.js` via `tsconfig.main.json`. It uses `/// <reference lib="dom" />` for DOM types in the browser context.

---

## Tests

```powershell
node tests/hearth/conjunction/test_conjunction_router.mjs   # G1/G2/G3
node tests/hearth/embedded_browser/test_substrate_injection.mjs  # G5
node tests/hearth/active_substrate/test_health_grid.mjs     # G7/G11
```

G9 (3-OS smoke) requires building on each target platform. G15 requires Founder manual execution.

---

*B83 · Hearth Conjunction Window · BP035 · Authored by Knight (Cursor) at BP034 direction from Bishop (Opus 4.7)*
*"FOR THE KEEP!"*
