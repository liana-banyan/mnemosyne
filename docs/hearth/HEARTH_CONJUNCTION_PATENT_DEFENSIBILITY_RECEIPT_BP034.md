# Hearth Conjunction Window — Patent-Defensibility Receipt
## B83 / BP034 / May 9, 2026
## G13 Patent-Class Gate — Counsel Pre-Brief Artifact

---

## Scope

This receipt documents three distinct patent-class novelties demonstrated by Bushel 83 (Hearth Conjunction Window). It is written for direct paste into counsel session materials.

Cross-references:
- **Prov-18** (Trinity 4-pillar) — B83 demonstrates Contingency Operator (K30) as user-facing primitive
- **Prov-19** (13th Floor recursive SEG) — B83 substrate-context preamble is a 13th-Floor compression artifact
- **B83 commit hash(es):** See Yoke handoff for per-component SHAs

---

## Novelty Class A — Cooperative-AI-Substrate Auto-Injection into Third-Party AI Surfaces via Embedded-Browser Context Propagation

### Claim Language (Draft — Counsel Review)

> A method for propagating cooperative-AI-substrate context into third-party AI-backed user interfaces comprising:
> (a) maintaining a persistent multi-conversation context interface (MCCI) thread store containing per-relationship, per-topic, and per-session context records;
> (b) providing an embedded browser surface within a host application, the embedded browser including a content-script bridge configured to identify input elements of a third-party AI-backed search or chat interface;
> (c) automatically composing a substrate-context preamble from active MCCI thread records, recently active canon references, and current session voice anchors;
> (d) injecting the substrate-context preamble into the third-party AI-backed interface's input prior to user-initiated submission, such that the third-party AI's response is conditioned on the cooperative-AI-substrate context without requiring user-side copy-paste;
> (e) recording an injection receipt comprising injection timestamp, target URL, injection-strategy identifier, and substrate-context provenance.

### Mechanism Diagram

```
AMPLIFY Computer (Electron host)
│
├── Main process: substrate_context_builder.ts
│     Polls http://127.0.0.1:11480/substrate/query
│     → composes SubstrateContextPreamble
│     → pushes to renderer via IPC: 'conjunction-get-substrate-context'
│
├── Renderer: EmbeddedChrome.tsx
│     Receives preamble via window.amplify.conjunctionGetSubstrateContext()
│     → calls webviewRef.send('substrate-context-update', { context, enabled })
│
└── <webview> process: webview_preload.ts  [runs in Chromium context]
      ipcRenderer.on('substrate-context-update', ...)
      → caches currentContext
      → listens for Enter key on Google Search AI inputs
      → injects preamble BEFORE user-initiated submission
      → sends 'substrate-injection-result' back to renderer
      → appends to embedded_browser_injection.jsonl
```

### Code Citations

- `src/main/hearth/embedded_browser/substrate_context_builder.ts` — preamble composition
- `src/main/hearth/embedded_browser/webview_preload.ts` — content-script injection mechanism
- `src/renderer/hearth/embedded_browser/EmbeddedChrome.tsx` — bridge between renderer and webview
- `src/renderer/hearth/embedded_browser/auto_inject_rules.ts` — URL-pattern → CSS-selector dictionary

### Distinction from Prior Art

| Prior Art | Why B83 is Distinct |
|---|---|
| MCP integration | Server-side, tool-call-class. Operates via LLM's tool use, not the third-party LLM's input surface. B83 is surface-class. |
| Browser autofill | Value-class (fills form fields). Does not compose multi-source structured context or record provenance. |
| Clipboard-based injection | Manual (user copies context). B83 is automatic, content-script-mediated, and provenance-receipted. |
| Browser extensions | User-installed per-browser. B83 is embedded in the cooperative-AI-substrate host application itself, with substrate-native context composition. |

---

## Novelty Class B — Multi-Backend Conjunction Routing as User-Selectable Mode

### Claim Language (Draft — Counsel Review)

> A user interface element for selectable cooperative-AI-substrate dispatch mode comprising:
> (a) a Conjunction Panel presenting at least four mutually-orthogonal backend classes — local rule-based (CPU-only), local model (Ollama or equivalent), IDE-agent-routed (Knight via paste-bridge), and cloud-flagship (Opus or equivalent);
> (b) an additional "all in conjunction" mode dispatching the same prompt to all backends in parallel via a speculative-branch wave dispatcher (cf. K30 Contingency Operator);
> (c) a fan-in synthesizer composing per-backend responses into a composite-with-provenance, best-of-N, or consensus-extract presentation;
> (d) a receipt log capturing per-backend latency, cost, and provenance enabling downstream Sweat-class effort attribution and Tears-class loss-after-effort detection.

### Mechanism Diagram

```
ConjunctionPanel (renderer) → selectMode() / dispatch()
  ↓ IPC: 'conjunction-dispatch'
ConjunctionRouter (main process)
  ├── cpu_only_adapter.ts   → rule-based + substrate HTTP
  ├── ollama_adapter.ts     → POST localhost:11434/api/generate
  ├── knight_cursor_adapter.ts → append to KNIGHT_BISHOP_MESSAGES.md; poll pixel_inbox.jsonl
  └── opus_claude_adapter.ts   → POST api.anthropic.com/v1/messages
        ↓ [all_in_conjunction: all 4 in parallel via Promise.all]
fan_in_synthesizer.ts
  → composite_with_provenance | best_of_n | consensus_extract
conjunction_receipts.ts
  → conjunction_receipts.jsonl (SE-4 Lamport+HMAC envelope)
  → hearth_conjunction_effort_signals_pending.jsonl  (→ B80 Sweat Scribe)
  → hearth_conjunction_loss_signals_pending.jsonl    (→ B81 Tears Scribe)
```

### Code Citations

- `src/main/hearth/conjunction/conjunction_router.ts` — routing engine + dispatch
- `src/main/hearth/conjunction/backend_adapters/*.ts` — 4 adapter implementations
- `src/main/hearth/conjunction/fan_in_synthesizer.ts` — synthesis modes
- `src/main/hearth/conjunction/conjunction_receipts.ts` — SE-4 receipt writer
- `src/renderer/hearth/conjunction/ConjunctionPanel.tsx` — Founder-facing UI

### Distinction from Prior Art

| Prior Art | Why B83 is Distinct |
|---|---|
| LLM router products | Route to ONE backend per request based on heuristic. B83 exposes routing-class as user-selectable and supports parallel dispatch. |
| Ensemble methods | Training-time. B83 is dispatch-time and includes a human-operated IDE-agent class (Knight). |
| API aggregators | Aggregate cost/latency data. B83 integrates with the cooperative-AI substrate's Sweat/Tears scribe system for effort attribution. |

### Cross-Reference: Prov-18 Trinity 4-pillar

The "all_in_conjunction" mode demonstrates the **K30 Contingency Operator** (Blood pillar) as a user-facing primitive — not just an internal substrate primitive. This is empirical reduction-to-practice for Prov-18 claim 1 (K30 Contingency Operator as cooperative-AI primitive).

---

## Novelty Class C — Substrate-Aware Browser Tab as Patent-Class Distinct from MCP Integration

### Claim Language (Draft — Counsel Review)

> A substrate-aware browser surface comprising:
> (a) an embedded browser instance within a cooperative-AI-substrate host application;
> (b) a substrate-bridge layer that supplies the embedded browser, on a per-page-navigation basis, with substrate-context records derived from a continuous multi-conversation context interface;
> (c) a content-script injection layer that propagates the substrate-context records into the page DOM context such that page-resident scripts (including third-party AI interfaces) may consume the records via a documented bridge protocol;
> (d) a receipt-and-attestation layer that records every injection event with provenance, enabling later audit of which substrate context was visible to which third-party page at which time.

### Mechanism

The substrate-aware browser tab operates at the **page-DOM layer**, distinct from MCP integration which operates at the **agent-tool-call layer**. The two are complementary but mechanistically distinct:

| Dimension | MCP Integration | Substrate-Aware Browser Tab |
|---|---|---|
| Layer | Agent-tool-call (server-side) | Page-DOM (content-script) |
| Requires | LLM tool-use capability | Browser + preload script |
| Context delivery | JSON via tool response | Text prepended to input element |
| Works with | MCP-compatible AI agents | ANY third-party LLM page |
| Threat model | Trusts the agent | Can constrain per-page context |
| Receipt class | Tool call logs | Injection events JSONL |

### Cross-References

- **Prov-18**: This novelty demonstrates Trinity Blood pillar (K30) + Sweat pillar (B80 effort receipt) + Tears pillar (B81 error receipt) via a single user-facing dispatch
- **Prov-19**: The substrate-context preamble is a 13th-Floor compression artifact — a substrate-SEG delivered to a third-party AI surface

---

## G13 Attestation

**Mechanism verification:** All 10 R-MECHANISM-VERIFY surfaces checked per spec §10.

**Patent-defensibility receipt date:** 2026-05-09

**Author:** Knight (Cursor Sonnet 4.6) implementing Bishop (Opus 4.7) B83 spec at BP035.

**Counsel paste target:**
- `BISHOP_DROPZONE/14_CanonicalReferences/COUNSEL_PRE_BRIEF_W4_BP032.md`
- Prov-18 / Prov-19 supplementary disclosure packet (pending)

---

*G13 PATENT-CLASS GATE — All three novelty classes documented. Screenshot evidence generated at Founder ship-day verification (G15). Code line citations above are final.*

*"FOR THE KEEP!"*
