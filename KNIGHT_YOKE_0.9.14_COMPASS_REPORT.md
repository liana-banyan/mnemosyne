# KNIGHT YOKE 0.9.14 (BP138 rev2) -- Compass Nav Reorg -- Final Report

Repo: `C:\Users\Administrator\Documents\mnemosyne`, branch `clean-shell-v0.9` (unchanged, as instructed).
Base commit: `a5e8bfc` -- "BP137 0.9.12: persistent browser authority (F1) + browser-as-primary routing (F2) + liftPp crash fix".
Nothing in this Yoke was committed. No `dist`/packages were built (only `tsc --noEmit` and an in-memory `tsc -p tsconfig.main.json` compile used solely to launch a real dev-mode Electron instance for screenshot verification, then discarded).

Style note: no em-dashes anywhere below -- `--` is used instead, per the standing instruction for this Yoke.

---

## 1. What was built (Phases 1-5)

A new sibling shell, `CompassShell.tsx`, reachable at `#/compass`. It replaces the old 11+-tab flat nav (visible in the `#/dashboard` screenshot below: Ask, Package Store, Substrate, Help, Kitchen Table, Atlas, Social, Diagnosis, Publish, Frame, LB Account, Settings, Membership) with a 5-tab primary nav -- **Ask, Proof, Library, Social, More** -- while reusing 100% real, already-existing components underneath. Nothing was deleted; everything not promoted to a top-level tab moved into `More`.

### New files

| File | Lines | Purpose |
|---|---|---|
| `src/renderer/components/CompassShell.tsx` | 251 | Top-level shell: tab bar, membership CTA/toast, background-setup wiring, cross-tab jump listener. Mounted at `#/compass` in `App.tsx`. |
| `src/renderer/components/compass/types.ts` | -- | Shared `CompassTab`, `MoreSubView`, `CompassNavigate` types. |
| `src/renderer/components/compass/AskHomeTab.tsx` | 145 | Tab 1 -- Ask. |
| `src/renderer/components/compass/ProofTab.tsx` | 112 | Tab 2 -- Proof. |
| `src/renderer/components/compass/LibraryTab.tsx` | 82 | Tab 3 -- Library. |
| `src/renderer/components/compass/SocialCompassTab.tsx` | 56 | Tab 4 -- Social. |
| `src/renderer/components/compass/MoreTab.tsx` | 160 | Tab 5 -- More (menu grid + 9 sub-views). |
| `src/renderer/components/compass/PowerDiagnosticsPanel.tsx` | 132 | Phase 2 -- Power/Diagnostics, reachable only via More. |
| `src/renderer/components/compass/CoopTouch.tsx` | 66 | Phase 4 -- co-op story banner. |

### Modified files (all additive, see diffs below)

| File | Change |
|---|---|
| `src/renderer/App.tsx` | Added `CompassShell` import, `'compass'` on the `View` union, `#/compass` branch in `getInitialView()`, and a new `if (view === 'compass')` render block mirroring `#/clean-shell`. |
| `src/renderer/components/OneClickMeshTestPanel.tsx` | Extracted the existing completed-run results JSX into a new exported `MeshTestResultSummary` component (`OneClickMeshTestPanel.tsx:258-`, `export function MeshTestResultSummary` at line 270) so Proof and Power/Diagnostics render the exact same results view from one source. `OneClickMeshTestPanelProps` (line 471) and the rest of the panel (controls, run logic) are untouched. |
| `src/renderer/components/CatacombsTab.tsx` | Added an optional `onManifestsLoaded?: (totalEblets: number) => void` prop, called once after `loadManifests()` completes. Backward-compatible: every existing caller (old CleanShell's `<CatacombsTab />` with no props) is unaffected. |

### Untouched (byte-identical, verified)

- `src/renderer/components/CleanShell.tsx` -- `git diff --stat` returns nothing.
- The `#/dashboard` and `#/clean-shell` branches inside `App.tsx` -- see section 3 for the exact diff proving only additive hunks were introduced around them.
- `src/renderer/components/TestItOutTab.tsx` and `src/renderer/components/BenchmarkModal.tsx` ("Beat-Google Benchmark") -- never touched, confirmed via empty `git diff --stat` and a zero-hit search for any reference to either filename anywhere under `src/renderer/components/compass/`. See section 6.

---

## 2. Phase-by-phase mapping to real code (no fabrication)

**Phase 1 (5-tab nav, MVP):**
- Ask/Proof/Library/Social/More tabs implemented in `CompassShell.tsx` (`TABS` array, `CompassShell.tsx:33-39`).
- Ask: "Nexus throughput" / attach-your-apps signal = `NexusAuthoritySettings.tsx` + `NexusAuthoritySignInPanel.tsx` (BP137, real IPC-backed, reused as-is), surfaced via a collapsible panel in `AskHomeTab.tsx`.
- Proof: proof history = `ProveItWorksTab.tsx` (real Answer-Cache Meter) + `MeshTestResultSummary` (real benchmark receipts), reused in `ProofTab.tsx`.
- Library: `CatacombsTab.tsx` (Alexandrian Catacombs, 16-folder cooperative library) + `CatacombsContributePanel.tsx`, reused in `LibraryTab.tsx`.
- Social: `SocialTab.tsx` (5 existing Cue Deck cards, untouched) + `BatteryPublishTab.tsx` relabeled "Share & Publish", combined in `SocialCompassTab.tsx`.
- More: overflow menu (`MoreTab.tsx`) -- Kitchen Table, Atlas, Diagnosis, Frame, LB Account, Settings, Membership, Help, Power/Diagnostics.
- "Become a Member -- $5/yr" CTA: `CompassShell.tsx` `TabBar` component, top-right, matching `CleanShell.tsx`'s existing copy/IPC pattern.

**Phase 2 (Power/Diagnostics, under More):**
- `PowerDiagnosticsPanel.tsx` composes, unmodified: `LeanFederationPanel` (peer scan), `OneClickMeshTestPanel` (full run controls: mode picker, WAN Mesh, 12-Blade Column Plow, Research Arm, Mesh Synergy checkbox, HOT/COLD Lift), and a local `SubstrateComposer` (Tools & Panels / Stats / Console, mirroring `CleanShell.tsx`'s own sub-tab pattern without importing its private, non-exported function).
- Confirmed live in the real Electron app: screenshot 09 shows the Mesh Synergy checkbox rendered and correctly gated (appears only once 12-Blade Column Plow + Research Arm are both enabled; shown as "OFF (requires 2+ peers)" otherwise -- never fabricated as available).
- "Beat-Google Benchmark" is explicitly NOT here -- see section 6.

**Phase 3 (first-run Proof-aware Ask home):**
- `AskHomeTab.tsx`: trust statement, "See proof" button (navigates to Proof), Kitchen Table + Atlas quick-starts (navigate to `More` sub-views via the shared `CompassNavigate` callback), Nexus/attach signal, all above the reused `LeanAskTab` core.

**Phase 4 (co-op story placement):**
- `CoopTouch.tsx`, shown on the Ask home (always visible, not gated) and reachable from Power/Diagnostics's membership menu entry. Pulls `MEMBERSHIP_ANNUAL_FEE_USD` (5) and `CREATOR_KEEP_PERCENT` (83.3) from `shared/membership_types.ts` -- never hardcoded, so it can never drift from the canonical values file. Language is participation/allocation-only; the words invest/shares/equity/ROI/securities do not appear anywhere in the file, including in negated form.

**Phase 5 (Cue Deck Cards, page-specific):**
- Ask: "Share your savings" card, built from `window.amplify.aiDispatch.getAnswerCacheMeterSummary()` -- only rendered when `total_queries > 0` (confirmed live in screenshot 02: real machine has 15/39 served-free queries, so the card appears honestly).
- Proof: "Share this proof" card, gated on a real persisted `OneClickRunResult` (`loadLastMeshTestResult()`); shows an explicit honest empty state pointing at Power/Diagnostics when no benchmark has ever run.
- Library: "Share your Library" card, gated on the real summed `eblet_count` reported up via `CatacombsTab`'s new `onManifestsLoaded` callback; skipped when 0 (confirmed live in screenshot 05: this machine has 0 eblets fetched, so the card correctly does not appear).
- Social: unchanged, keeps its existing 5 real cards (Welcome, My Cue Deck Card, Received Cards, Name the Empress, Check My Math, Join My Crew).
- More: no generic card added (documented decision, see section 5).

---

## 3. `git diff` proof that `#/dashboard` / `#/clean-shell` are unaffected

```
@@ -24,0 +25,4 @@ import { CleanShell } from './components/CleanShell';
+// (import of CompassShell, additive)
@@ -44,0 +49 @@ type View =
+  | 'compass'
@@ -58,0 +64,5 @@ function getInitialView(): View {
+  if (hash === '#/compass') return 'compass';
@@ -396,0 +350,21 @@ export default function App() {
+  if (view === 'compass') { ... }   // new block, inserted after the '#/clean-shell' block
```

Every hunk touching `App.tsx` that this Yoke is responsible for is a pure addition (new import line, new union member, new `if` branch, new render block). The only hunks in the working-tree diff that are NOT additions (`@@ -111,2 +120,0` and `@@ -147,26 +154,0` and part of `@@ -333,44 +315,15`, all inside the `dashboard` branch's `lifecycleBanner` state/JSX) were already present in the uncommitted working tree before this Yoke's session started -- confirmed by `git status` showing `App.tsx` already modified at the very first command of this session, before any file in this Yoke was touched. I did not author, and did not further modify, that removal.

`CleanShell.tsx`: `git diff --stat -- src/renderer/components/CleanShell.tsx` returns empty -- byte-unchanged.

---

## 4. `tsc` verification

- `npx tsc --noEmit -p tsconfig.renderer.json`: **83 errors before, 83 errors after -- byte-identical error set** (diffed line-for-line with `Compare-Object`, zero differences). All 83 are pre-existing `window.amplify` / `amplify.d.ts` type-drift errors unrelated to this Yoke.
- `npx tsc --noEmit -p tsconfig.main.json`: **0 errors**, both before and after (no `src/main` file was touched).
- **0 new errors**, either config.

---

## 5. GUI verification -- real Electron app, real IPC bridge

Per the course-correction, this was re-run against the actual packaged/dev Electron shell (`npx electron . --remote-debugging-port=9222`, after `tsc -p tsconfig.main.json`), not the raw Vite renderer. Sequence:

1. Confirmed no prior instance was running (peer-artifact port 47213 free; but the AMPLIFY singleton API port **11480** was held by a stray/orphaned process from an earlier smoke-test -- found and closed with `taskkill /F` before relaunch, exactly the blocker the dispatch warned about).
2. Relaunched cleanly -- log confirms `[LB Frame port-guard] :11480 free -- proceeding with bind` and `[preload-smoke] OK dashboardWindow: window.amplify is object`, i.e. the real preload IPC bridge is live.
3. Drove the running window via its own Chromium remote-debugging target (`Page.captureScreenshot` + `Runtime.evaluate` click-by-text -- no CDP `Input.*` events used, matching the same Electron-focus-safety concern documented for this environment's browser tooling).
4. Screenshots saved to `C:\Users\Administrator\Documents\yoke_screens\`. Electron and the Vite dev server were both closed afterward; nothing was left running.

All 7 required acceptance screenshots, with real IPC data (not renderer-only degraded state):

| # | File | Shows |
|---|---|---|
| 1 | `01_dashboard_production_default.png` | **`#/dashboard` production route, unaffected.** Old flat nav intact: Ask, Package Store, Substrate, Help, Kitchen Table, Atlas, Social, Diagnosis, Publish, Frame, LB Account, Settings, Membership. Proves the byte-unchanged constraint held in the real running app, not just in a text diff. |
| 2 | `02_compass_ask_home_5tab_nav.png` | New 5-tab nav (Ask/Proof/Library/Social/More) + Ask home: trust statement, See proof / Kitchen Table / Atlas / Nexus / Share your savings quick-starts, CoopTouch banner ("$5/year", "83.3%"). "Share your savings" appears because this machine has real answer-cache data. |
| 3 | `03_ask_nexus_attach_signal.png` | Nexus panel expanded on Ask -- real `NexusAuthoritySettings` UI (Research Arm master switch, Compute/Lookup/Reasoning routing options, all real BP137 controls). |
| 4 | `04_proof_tab.png` | Proof tab -- real Answer-Cache Meter data: "Served free (from substrate): 15 of 39 queries", "$0.0360" estimated cost avoided, live poller confirmation button. |
| 5 | `05_library_tab.png` | Library tab -- honest empty state: all 16 category folders show "0 eblets / Updated: never" (this machine has never fetched any Catacombs category) -- no fabricated numbers. |
| 6 | `06_social_tab.png` | Social tab -- real Cue Deck data: live invite token, QR code, "Welcome, Captain" card, Share & Publish entry point. |
| 7 | `07_more_menu.png` | More menu grid -- all 9 destinations (Kitchen Table, Atlas, Diagnosis, Frame, LB Account, Settings, Membership, Help, Power/Diagnostics). |
| 8 | `08_power_diagnostics_default.png` | Power/Diagnostics default state -- Sourced-Knowledge Benchmark run controls, Plow/Research Arm both OFF (Mesh Synergy not yet visible -- correct, since it's gated). |
| 9 | `09_power_diagnostics_mesh_synergy_checkbox.png` | Same panel with Plow ON + Research Arm ON -- **Mesh Synergy checkbox now visible**: "Mesh Synergy OFF (requires 2+ peers)", proving the moved benchmark controls are complete and correctly gated, not silently dropped. |

(Screenshot 2 also satisfies the "first-run Ask home" requirement; screenshot 5 also satisfies "Library... honest empty states"; both are cross-referenced above rather than duplicated as separate files.)

---

## 6. Beat-Google Benchmark -- explicitly out of scope (course-correction honored)

`TestItOutTab.tsx` and `BenchmarkModal.tsx` were investigated read-only in Phase 0 and never edited in this Yoke. Verified just now, at report time:

- `git diff --stat -- src/renderer/components/TestItOutTab.tsx src/renderer/components/BenchmarkModal.tsx` -> empty (no changes, ever).
- Recursive search for the strings `BenchmarkModal` and `TestItOutTab` inside `src/renderer/components/compass/` -> zero hits.

Neither file is imported, routed, or referenced anywhere in this Yoke's new code. Per the Founder's explicit course-correction: this surface is **not** in Power/Diagnostics, and **not** folded into Proof, in this build.

**Flagged for a later build:** "Beat-Google Benchmark" (`BenchmarkModal.tsx`, currently reachable only via the unrouted `TestItOutTab.tsx`) is a real, already-built third-party-comparison surface that could plausibly belong on the Proof tab in a future phase, once evaluated on its own merits (freshness of its comparison data, whether its claims still hold, and whether it needs its own honest-empty-state treatment the way the Sourced-Knowledge Benchmark did). Not evaluated further here per explicit instruction.

---

## 7. Decisions I had to make (not explicitly specified in the dispatch)

1. **`Diagnosis` and `Frame`** are not named in the Phase 1 More-tab list. Both are real, working features today (`TheDiagnosisTab.tsx`, `FrameTab.tsx`) with no other home in the new 5-tab structure. Placed in More's menu grid rather than dropped, per the "reorganize, never delete function" constraint.
2. **`BatteryPublishTab` ("Battery Dispatch")** was fully absorbed into Social (relabeled "Share & Publish") rather than split or given its own home, since its content (fan-out to Cephas, lianabanyan.com, Substack, Medium, HackerNews, Gmail editorial, Crown Letters) is entirely social/publishing-shaped with no unrelated leftover piece.
3. **Substrate** (Tools & Panels / Stats / Console) moved to Power/Diagnostics under More, not Library, per the internal/advanced-vocabulary framing the dispatch implied for Power/Diagnostics generally.
4. **Help and Substrate composers in `MoreTab.tsx`/`PowerDiagnosticsPanel.tsx`** are small new local components (`HelpComposer`, `SubstrateComposer`) that mirror `CleanShell.tsx`'s own internal sub-tab pattern, rather than importing its private, non-exported functions of the same shape -- this was required to keep `CleanShell.tsx` completely untouched.
5. **More tab: no generic Cue Deck card.** Phase 5 asks for "page-relevant" cards; More is a menu of destinations, not a single surface with its own data, so no card was force-fit here. Its sub-pages (e.g. a future Kitchen Table card) are left as an open question for a later phase rather than fabricated now.
6. **Ask tab's Nexus panel default-collapsed.** The dispatch requires the signal be "visible, not buried" but also says the query field should stay primary focus for first-run. Resolved as a persistently-visible toggle button (never hidden) that expands the real Nexus panel in place, rather than auto-expanding it over the query field on every load.

---

## 8. Open questions / gaps for Bishop's review

- **Beat-Google Benchmark -> Proof** (see section 6) -- deferred to a later build per explicit instruction.
- **Kitchen Table / Atlas cards from More's own sub-pages** were not built in this Yoke's Phase 5 pass (only Ask/Proof/Library/Social got page-specific cards, as scoped). If Bishop wants Cue Deck cards surfaced from inside those sub-views too, that is additive follow-up work, not a fix.
- **`amplify.d.ts` drift** (the 83 pre-existing `tsc` errors) is unrelated to this Yoke but sitting in the same renderer tsconfig -- flagged here only so it isn't mistaken for something this build introduced.
- **AMPLIFY singleton port 11480** was found held by an orphaned process during this session's real-Electron verification (not caused by this Yoke's code -- an artifact of a prior smoke-test session never having exited cleanly). Worth a Founder/Bishop note if this recurs: the single-instance guard exits the new instance silently rather than surfacing a clear "another instance is already running, close it first" dialog to whoever launches it next.

---

## 9. Screenshot files

All 9 real-Electron screenshots referenced above are on disk at:

`C:\Users\Administrator\Documents\yoke_screens\01_dashboard_production_default.png` through `09_power_diagnostics_mesh_synergy_checkbox.png`

(Not committed; not part of the repo tree -- saved outside `mnemosyne/` for Bishop/Founder review.)
