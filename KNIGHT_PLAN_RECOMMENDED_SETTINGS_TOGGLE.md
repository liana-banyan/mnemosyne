# KNIGHT PLAN (read-only investigation) -- "Use Recommended Settings" master toggle for the Nexus Authority gauntlet

Status: PLAN ONLY. No code file in this repo was edited, created, or deleted to produce this
plan. Every claim below is anchored to a file:line the author actually read in full (not just
grepped) on branch `clean-shell-v0.9`, repo state as of this writing (package.json version
`0.9.14`, HEAD `0c93aa73` "BP138: 0.9.13 (F3/F4 + Azure Trusted Signing) + 0.9.14 Compass shell
(dark)").

**IMPORTANT PRE-EXISTING-STATE NOTE (not caused by this investigation):** `git status --short`
already showed several tracked files as modified (`package.json`, `release/latest.yml`,
`src/main/plow/nexus_authority_persistent_session.ts`,
`src/renderer/settings/NexusAuthoritySignInPanel.tsx`,
`src/renderer/settings/nexus_authority_settings_store.ts`) and several untracked `.md` files at
the START of this task, before this agent touched anything. This agent did not create, edit, or
revert any of those -- they are someone else's in-flight work (likely a concurrent
Bishop/Knight session) and are reported here only so the final `git status --short` diff makes
sense to the Founder: this report's own new file is the ONLY change this agent is responsible
for. See "Final verification" at the bottom for the exact before/after comparison.

---

## 1. Research Arm / User's Browser Session toggles + the `nexus-authority-settings-changed` event

File: `src/renderer/settings/nexus_authority_settings_store.ts` (143 lines, read in full).

- `saveResearchArmMode(enabled: boolean): void` -- `src/renderer/settings/nexus_authority_settings_store.ts:118-122`. Writes `localStorage[LS_NEXUS_AUTHORITY_MODE]` (key `'mnemo_nexus_research_arm_mode'`, `nexus_authority_settings_store.ts:47`), mirrors both flags to the main process via `pushFlagsToMainProcessMirror(...)`, then **dispatches the event at line 121**: `window.dispatchEvent(new Event('nexus-authority-settings-changed'));`
- `saveResearchArmBrowserAuthority(enabled: boolean): void` -- `nexus_authority_settings_store.ts:124-128`. Same pattern; writes `LS_NEXUS_AUTHORITY_BROWSER` (key `'mnemo_nexus_research_arm_browser_authority'`, line 48), mirrors flags, **dispatches the same event at line 127**.
- Both dispatches use the bare event name `'nexus-authority-settings-changed'` (a plain `Event`, no `detail` payload) -- any new function must fire this exact string via `window.dispatchEvent(new Event('nexus-authority-settings-changed'))` to be indistinguishable from a real user toggle to existing listeners.
- `savePerArmAuthority(perArm: NexusPerArmAuthority): void` -- `nexus_authority_settings_store.ts:130-132`. Writes `localStorage[LS_NEXUS_PER_ARM]` (key `'mnemo_nexus_per_arm_authority'`, line 49) as `JSON.stringify(perArm)`. **Does NOT dispatch the event today** -- confirmed by reading lines 130-132 verbatim; this is a real, pre-existing gap the new function's spec (Section 5 below) must close for its own writes.
- `setArmAuthority(arm, authority)` -- `nexus_authority_settings_store.ts:135-142`. Read-modify-write convenience wrapper around `savePerArmAuthority`; also does not dispatch the event (inherits the gap above).
- Only one file in the whole repo currently listens for `'nexus-authority-settings-changed'`: `src/renderer/settings/NexusAuthoritySignInPanel.tsx:52-53` (`window.addEventListener('nexus-authority-settings-changed', refresh)`, cleaned up at line 53). Confirmed via a repo-wide search of every `.ts`/`.tsx` file for the literal string -- the two dispatch sites above (lines 121, 127) are the only producers, and this one `addEventListener` is the only consumer. `NexusAuthoritySettings.tsx` itself does NOT listen for this event -- it only ever reads state once on mount (`NexusAuthoritySettings.tsx:58-64`), so a `setRecommendedNexusSettings()` call from a button rendered *inside* `NexusAuthoritySettings.tsx` would need to update that panel's own React state directly (see Section 6) rather than rely on the event alone, since the panel that renders the button doesn't re-read on event by design.

## 2. Per-question authority controls, `savePerArmAuthority`, `LS_NEXUS_PER_ARM`, valid values

Files: `src/renderer/settings/NexusAuthoritySettings.tsx` (293 lines, read in full) and
`src/shared/plow/browser_authority_types.ts` (246 lines, read in full).

- The three arms and their persisted key are `NexusArmName = 'computable' | 'lookup_fact' | 'reasoning'` -- `src/shared/plow/browser_authority_types.ts:49`, with the ordered list `NEXUS_ARM_NAMES: readonly NexusArmName[] = ['computable', 'lookup_fact', 'reasoning']` at line 51.
- UI labels for those three arms (what the Founder sees, not the raw literal) -- `NexusAuthoritySettings.tsx:36-40`:
  - `computable` -> **"Compute"**
  - `lookup_fact` -> **"Lookup (fact-finding)"**
  - `reasoning` -> **"Reasoning"**
- The valid authority values -- `NexusAuthorityName = 'local_free' | 'user_google' | 'user_perplexity' | 'paid_api'` -- `browser_authority_types.ts:64`. Full option roster with exact UI labels -- `browser_authority_types.ts:75-100`:
  - `'local_free'` -> label **"Local / Free (default)"** (free: true) -- line 77-81
  - `'user_google'` -> label **"User's Google (browser)"** (free: true) -- line 82-87
  - `'user_perplexity'` -> label **"User's Perplexity (browser)"** (free: true) -- line 88-93
  - `'paid_api'` -> label **"Paid API (escalate only)"** (free: false) -- line 94-99
- Persisted shape: `NexusPerArmAuthority = Record<NexusArmName, NexusAuthorityName>` -- `browser_authority_types.ts:103`. Safe default -- `DEFAULT_NEXUS_PER_ARM_AUTHORITY` at `browser_authority_types.ts:110-114`, all three arms default to `'local_free'`.
- **Substitution flag vs. the prompt's assumed literals:** the prompt's draft mapping used the strings "Local/Free" and "User's Google (browser)" as if they were the stored values. The ACTUAL stored/type-checked literals are `'local_free'` and `'user_google'` (snake_case, no spaces) -- the human-readable labels quoted in the prompt match the UI `label` field almost verbatim (`browser_authority_types.ts:78`, `:84`) but are NOT what gets written to `localStorage`. **The plan below (Section 5) uses the real literals (`'local_free'`, `'user_google'`) for the actual function body, and the real UI label strings only for display text.** This is the one substitution the investigation required; flagged here per your instruction.
- Gating on the UI side (not enforced by the store functions themselves): `NexusAuthoritySettings.tsx:161-162` disables the `'user_google'` / `'user_perplexity'` option buttons unless `researchArmMode && researchArmBrowserAuthority` are both true. **This gate lives only in the button's `disabled` prop, not inside `setArmAuthority`/`savePerArmAuthority`** -- confirmed by reading `nexus_authority_settings_store.ts:130-142` in full, neither function checks the two flags before writing. This means a new `setRecommendedNexusSettings()` function CAN legally write `user_google` into `lookup_fact`/`reasoning` even before the two master flags are persisted, but for logical/human-readable consistency the plan sequences flag-writes first (Section 5, step order 1-2 before 3).

## 3. Mesh Synergy toggle (`researchArmMeshSynergy`)

File: `src/renderer/components/OneClickMeshTestPanel.tsx` (1211 lines, read in full).

- Declared at `OneClickMeshTestPanel.tsx:508`: `const [researchArmMeshSynergy, setResearchArmMeshSynergy] = useState(false);` -- **plain local React component state, initialized to `false` on every mount, with no `useEffect` reading from `localStorage` or `loadNexusAuthoritySettings()` anywhere in this file.** Confirmed by reading the full file: the only `localStorage` keys this file ever touches are `LS_LAST_RESULT` (`:18`), `LS_LAST_LIFT_RESULT` (`:24`), and `LS_FIRST_RUN_MARKS_CREDITED` (`:30`) -- none of which is Mesh Synergy.
- The checkbox that mutates it lives at `OneClickMeshTestPanel.tsx:845-870`, gated visually (rendered only) when `plowEnabled && researchArmMode` are both true, and additionally disabled (`meshSynergyGated`, line 846) when `mode !== 'wan_mesh'`.
- **No `nexus-authority-settings-changed` listener exists anywhere in this file** -- confirmed by the same full-file read; this component is entirely unaware of the settings-store event today.
- **Conclusion for the plan:** Mesh Synergy has ZERO persistence today (session-only, resets to OFF every time this panel remounts) and this component does not listen for the settings-changed event. Setting it ON from an external "Recommended Settings" action therefore needs **new wiring**, not just a call to an existing setter -- there is nothing to call into from outside this component as the code stands. Two real options, both flagged as OPEN QUESTIONS in Section 8 rather than silently picked for you:
  - **(a) Minimal-diff option:** add a `researchArmMeshSynergy: boolean` field to the same `nexus_authority_settings_store.ts` (a 4th persisted flag, its own `LS_NEXUS_MESH_SYNERGY` key, its own `saveResearchArmMeshSynergy()` setter that also dispatches `'nexus-authority-settings-changed'`), then add a `useEffect` to `OneClickMeshTestPanel.tsx` that reads it on mount and listens for the event to update `researchArmMeshSynergy` live -- mirrors the exact pattern `NexusAuthoritySignInPanel.tsx:45-54` already uses for `flagsEnabled`.
  - **(b) Broader-scope option:** leave Mesh Synergy panel-local entirely, and have `setRecommendedNexusSettings()` only cover the 2 master flags + 3 per-arm authorities (this file's own doc comment already says Mesh Synergy is a "Layer" on top, not a base gauntlet setting) -- i.e. exclude it from "Recommended Settings" scope altogether and let the Founder flip it manually in the mesh-test panel per run. This avoids inventing a 4th store field for a setting that (per its own in-file doc comment, `:502-508`) is really a per-run WAN-mesh dispatch choice, not a standing preference like the other three.

## 4. The two button mount sites

### 4a. `src/renderer/settings/NexusAuthoritySettings.tsx` (293 lines, read in full)

- Confirmed exact path -- no search needed, `Glob` for `NexusAuthoritySettings*.tsx` returned exactly one file at this path.
- This component is mounted in exactly 2 places in the whole repo (confirmed via grep across `src/`):
  - `src/renderer/components/SettingsTab.tsx:1645` -- `<NexusAuthoritySettings />` (the classic Settings tab, not one of this prompt's two target mount sites, listed here only for completeness).
  - `src/renderer/components/compass/AskHomeTab.tsx:108` -- `<NexusAuthoritySettings />` (this IS one of the two target sites -- see 4b).
- Existing button styling conventions inside this file: there is no free-standing CTA/action button in this file today -- only two kinds of controls: (i) the pill-style ON/OFF toggle `s.pill` (style block `NexusAuthoritySettings.tsx:235-244`, used at `:109-120` and `:135-147`), and (ii) the per-arm option buttons `s.optionBtn` / `s.optionBtnSelected` (style block `:265-281`, used at `:164-183`). Neither is a good visual match for a one-shot action button (they're toggle/selection widgets, not "do a thing now" buttons).
- **Best real-world mirror for an action button style is the sibling file** `src/renderer/settings/NexusAuthoritySignInPanel.tsx`'s `s.actionBtn` (style block `NexusAuthoritySignInPanel.tsx:249-259`: `background: 'rgba(15,23,42,0.6)'`, `border: '1px solid rgba(100,116,139,0.3)'`, `borderRadius: 6`, `padding: '5px 10px'`, `fontSize: 10`, `color: '#94a3b8'`, `fontWeight: 600`, `cursor: 'pointer'`), used verbatim at `NexusAuthoritySignInPanel.tsx:156-167` ("Sign in to Google/Perplexity") and `:174-181` ("Check status"). Both files already share the same dark card palette (`s.card`, `s.introText`, `s.sectionHeader` are byte-identical style objects between the two files -- confirmed by diffing the two `styles` blocks visually), so importing this exact object literal into `NexusAuthoritySettings.tsx` (as a new local `actionBtn` style constant, since the two files do not currently share a style module) is a same-family, same-palette match, not an improvised new look.
- **Best insertion point:** immediately after the intro paragraph and before the "Master switch" row -- i.e. between `NexusAuthoritySettings.tsx:98` (closing `</div>` of `s.introText`) and `:100` (`{/* Master switch */}` comment, row starts `:101`). Rendering the button first, above every toggle it's about to flip, matches the "here's a shortcut for everything below" reading order.

### 4b. `src/renderer/components/compass/AskHomeTab.tsx` (146 lines, read in full)

- Confirmed exact path -- the file exists verbatim at this path (`Glob` for `src/renderer/components/compass/**` returned it alongside `MoreTab.tsx`, `PowerDiagnosticsPanel.tsx`, `SocialCompassTab.tsx`, `LibraryTab.tsx`, `ProofTab.tsx`, `CoopTouch.tsx`, `types.ts`). No substitution needed -- this is exactly the file the prompt named.
- This file is part of the just-landed 0.9.14 Compass shell (per its own header comment, `AskHomeTab.tsx:1`: "BP138 Yoke 0.9.14: Compass nav tab 1 (Ask)"), confirming the prompt's framing.
- Existing button styling convention: the local helper `pillBtn(active: boolean, color: string): React.CSSProperties` -- `AskHomeTab.tsx:130-143`. Used 4 times in this file for the horizontal quick-action row (`:77` "See proof", `:80` "Kitchen Table", `:83` "Atlas", `:87-89` "🔗 Nexus -- attach your apps", `:91-93` "Share your savings"). This is the file's one consistent action-button convention -- every clickable pill in this component's header strip uses it.
- **Best insertion point:** inside the already-existing `nexusOpen` collapsible panel (the block guarded by `{nexusOpen && ( ... )}`, `AskHomeTab.tsx:97-111`), directly above the `<NexusAuthoritySettings />` mount at line 108 -- i.e. between the intro paragraph closing `</div>` (`:106`) and `:108`. This keeps the new button co-located with the exact controls it's a shortcut for, inside the panel the Founder already opens to reach Nexus settings from the Ask tab, rather than cluttering the always-visible top-level pill row (`:76-95`) with a 6th button whose payoff (the Nexus panel) isn't even visible unless `nexusOpen` is already true.
- Alternate/lower-preference insertion point (flagged, not chosen): the always-visible pill row itself (`:76-95`), styled with the same `pillBtn(...)` helper, e.g. right after the existing "🔗 Nexus" toggle button (`:87-89`). Rejected as the PRIMARY recommendation because clicking it would need to also force `setNexusOpen(true)` so the Founder can literally see the toggles it just flipped -- more secondary state to wire for a same-tab-already-available action. Left available as an option for whoever builds this, in Section 8's open questions.

## 5. `setRecommendedNexusSettings()` -- new function spec for `nexus_authority_settings_store.ts`

Everything below is ADDITIVE (a brand-new exported function; nothing existing in this file is modified, reordered, or renamed).

```ts
// FOUNDER-CONFIRMABLE DEFAULT MAPPING -- see KNIGHT_PLAN_RECOMMENDED_SETTINGS_TOGGLE.md
// Section 8 for the open question on whether this is the right default split.
//   - lookup_fact -> 'user_google'   (fact lookups run through the Founder's own logged-in
//                                      Google session -- $0, and generally more current/
//                                      accurate than the local swarm's free path for a single
//                                      fact.)
//   - reasoning   -> 'user_google'   (open-ended reasoning also routed through the browser
//                                      authority -- same $0 rationale; NOT 'user_perplexity',
//                                      matching the prompt's own draft mapping. FOUNDER: if you
//                                      would rather split lookup->Google / reasoning->Perplexity,
//                                      or leave reasoning on local_free, this is the one line to
//                                      change below.)
//   - computable  -> 'local_free'    (deterministic/numeric work has no benefit from a browser
//                                      round-trip and stays on the existing free local path --
//                                      matches DEFAULT_NEXUS_PER_ARM_AUTHORITY's own existing
//                                      choice for this arm, so this mapping changes NOTHING for
//                                      Compute relative to today's shipped default.)
export const RECOMMENDED_NEXUS_PER_ARM_AUTHORITY: NexusPerArmAuthority = {
  computable: 'local_free',
  lookup_fact: 'user_google',
  reasoning: 'user_google',
};

/**
 * One-click "Use Recommended Settings" master toggle. Sets Research Arm ON, User's Browser
 * Session ON, and the per-arm authority mapping to RECOMMENDED_NEXUS_PER_ARM_AUTHORITY above
 * (FOUNDER-CONFIRMABLE -- see this function's own doc comment on that constant). Does NOT touch
 * Mesh Synergy -- see this repo's KNIGHT_PLAN_RECOMMENDED_SETTINGS_TOGGLE.md Section 3/8 for why
 * that flag has no persisted store field to write to yet; if a future pass adds one (Section 3
 * option (a)), this function should gain a 4th line writing it, and this doc comment must be
 * updated to say so.
 *
 * Fires the SAME 'nexus-authority-settings-changed' event this store's two existing save*
 * functions already fire (saveResearchArmMode/saveResearchArmBrowserAuthority,
 * nexus_authority_settings_store.ts:121,127) -- reuses those two functions directly rather than
 * writing localStorage a third time, so every existing listener (today: only
 * NexusAuthoritySignInPanel.tsx:52-53) sees exactly one settings-changed notification per flag,
 * identical to what a manual double-click would have produced.
 *
 * Additionally fires the event ONE MORE TIME after the per-arm write, since savePerArmAuthority
 * (line 130-132) does not fire it today (a pre-existing gap, not something this function is
 * scoped to "fix" globally -- fixing it globally would change savePerArmAuthority's behavior for
 * the EXISTING manual per-arm picker too, which is explicitly out of scope: "no existing logic
 * paths are modified"). This function calls window.dispatchEvent itself for its own per-arm
 * write instead, so the net effect (every listener re-reads fresh state) is the same without
 * touching savePerArmAuthority's existing behavior.
 */
export function setRecommendedNexusSettings(): void {
  saveResearchArmMode(true);
  saveResearchArmBrowserAuthority(true);
  savePerArmAuthority({ ...RECOMMENDED_NEXUS_PER_ARM_AUTHORITY });
  window.dispatchEvent(new Event('nexus-authority-settings-changed'));
}
```

Placement: appended at the end of `nexus_authority_settings_store.ts`, after the existing
`setArmAuthority` function (which currently ends the file at line 142) -- i.e. new content starts
at line 143 (the file's current final line 142 is `}`, followed by a new blank line then this
addition). No existing line in the file is touched.

Import note: `NexusPerArmAuthority` is already imported at the top of this file
(`nexus_authority_settings_store.ts:39-45`) -- the new `RECOMMENDED_NEXUS_PER_ARM_AUTHORITY`
constant needs no new import.

## 6. Button wiring at both mount sites

### 6a. `NexusAuthoritySettings.tsx`

- New import line (added to the existing import block at `:29-34`): add `setRecommendedNexusSettings` to the destructured import from `./nexus_authority_settings_store`.
- New local style constant (mirrors `NexusAuthoritySignInPanel.tsx:249-259`'s `actionBtn` verbatim, since this file has no equivalent of its own -- see Section 4a):

```ts
const actionBtn: React.CSSProperties = {
  background: 'rgba(15,23,42,0.6)',
  border: '1px solid rgba(100,116,139,0.3)',
  borderRadius: 6,
  padding: '5px 10px',
  fontSize: 10,
  color: '#94a3b8',
  fontWeight: 600,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};
```

- Because clicking this button changes state that THIS component itself owns
  (`researchArmMode`, `researchArmBrowserAuthority`, `perArm` -- all local `useState`, see
  `NexusAuthoritySettings.tsx:49-56`) and this component does not listen for
  `'nexus-authority-settings-changed'` on itself (Section 1's finding), the onClick handler must
  update this component's own state directly in addition to calling the store function, or the
  three pills/rows will visually not update until the next remount. New handler, added alongside
  the existing `handleModeToggle`/`handleBrowserAuthorityToggle`/`handleArmAuthorityChange`
  callbacks (`:66-85`):

```tsx
const handleUseRecommended = useCallback(() => {
  setRecommendedNexusSettings();
  const snapshot = loadNexusAuthoritySettings();
  setResearchArmMode(snapshot.researchArmMode);
  setResearchArmBrowserAuthority(snapshot.researchArmBrowserAuthority);
  setPerArm(snapshot.perArmAuthority);
}, []);
```

  (`loadNexusAuthoritySettings` is already imported at `:30` -- no new import needed for this
  part.)

- New button JSX, inserted at the insertion point identified in Section 4a (between line 98 and
  line 100):

```tsx
<button
  style={actionBtn}
  onClick={handleUseRecommended}
  title="Sets Research Arm ON, User's Browser Session ON, and Lookup/Reasoning to your own browser session (Compute stays local/free) -- see KNIGHT_PLAN_RECOMMENDED_SETTINGS_TOGGLE.md for the exact mapping"
>
  ⚡ Use Recommended Settings
</button>
```

### 6b. `AskHomeTab.tsx`

- New import line (added alongside the existing imports at `:24-30`): `import { setRecommendedNexusSettings } from '../../settings/nexus_authority_settings_store';`
- This component has no local state that mirrors the Nexus settings store (it renders
  `<NexusAuthoritySettings />` and `<NexusAuthoritySignInPanel />` as black boxes, `:108-109`),
  and BOTH of those child components already read fresh state themselves on their own triggers
  (`NexusAuthoritySettings` on its own mount effect, `:58-64`; `NexusAuthoritySignInPanel` on its
  own mount effect AND on the `'nexus-authority-settings-changed'` listener, `:45-54`). Because
  `NexusAuthoritySettings` does NOT listen for the event (Section 1), simply calling
  `setRecommendedNexusSettings()` from `AskHomeTab.tsx` would update the store correctly but the
  already-mounted `<NexusAuthoritySettings />` instance below it would show stale toggle state
  until the Founder collapses/reopens the panel. **This is the same underlying gap as 6a's
  problem, viewed from the other mount site** -- see Section 8's open question on whether
  `NexusAuthoritySettings.tsx` should itself add a `'nexus-authority-settings-changed'` listener
  (which would ALSO make this AskHomeTab-side button "just work" for free, and is arguably the
  more correct general fix vs. duplicating the direct-state-sync trick from 6a in a second
  place).
- Onclick wiring (matching this file's existing inline-arrow-function convention, e.g. `:77`
  `onClick={() => onNavigate('proof')}`):

```tsx
<button onClick={() => setRecommendedNexusSettings()} style={pillBtn(false, '#facc15')}>
  ⚡ Use Recommended Settings
</button>
```

- Insertion point: inside the `nexusOpen` block, between the intro `<div>` closing tag (`:106`)
  and the `<NexusAuthoritySettings />` mount (`:108`) -- see Section 4b.

## 7. Diff-style plan summary (file:line -> what changes)

| File | Anchor | Change | Additive? |
|---|---|---|---|
| `src/renderer/settings/nexus_authority_settings_store.ts` | after line 142 (EOF) | Add `RECOMMENDED_NEXUS_PER_ARM_AUTHORITY` const + `setRecommendedNexusSettings()` function | Yes -- pure addition, appended after existing code |
| `src/renderer/settings/NexusAuthoritySettings.tsx` | import block `:29-34` | Add `setRecommendedNexusSettings` to the existing named import from `./nexus_authority_settings_store` | Yes -- extends an existing import statement, no existing imported name removed |
| `src/renderer/settings/NexusAuthoritySettings.tsx` | new, near `:48` styles or inline | Add `actionBtn` style const (mirrors `NexusAuthoritySignInPanel.tsx:249-259`) | Yes -- new const |
| `src/renderer/settings/NexusAuthoritySettings.tsx` | inside `NexusAuthoritySettings()`, alongside `:66-85` | Add `handleUseRecommended` callback | Yes -- new callback |
| `src/renderer/settings/NexusAuthoritySettings.tsx` | between `:98` and `:100` | Insert new `<button>` (Section 6a JSX) | Yes -- new JSX node, no existing JSX removed/reordered |
| `src/renderer/components/compass/AskHomeTab.tsx` | import block `:24-30` | Add `import { setRecommendedNexusSettings } from '../../settings/nexus_authority_settings_store';` | Yes -- new import line |
| `src/renderer/components/compass/AskHomeTab.tsx` | between `:106` and `:108` | Insert new `<button>` (Section 6b JSX) | Yes -- new JSX node |

**Byte-unchanged-defaults confirmation:** every row above is a pure addition (new function, new
const, new import, new JSX element) -- no existing function body, existing exported signature, or
existing default value is modified anywhere in this plan. This means, unlike the 0.9.14 Compass
shell work (which the prompt notes required flag/route gating to keep old and new UI both
reachable), **this feature needs NO flag or route gate to ship byte-unchanged for a user who
never clicks the new button**: nobody's Research Arm/browser-authority/per-arm settings change
unless the Founder (or a future user) explicitly clicks "Use Recommended Settings" -- the function
is never called on app start, never called from any existing code path, and every default this
repo ships today (`researchArmMode: false`, `researchArmBrowserAuthority: false`, all three arms
`'local_free'` -- `nexus_authority_settings_store.ts:88-93`, `browser_authority_types.ts:110-114`)
is completely untouched by adding an unclicked function + an unclicked button. This confirms the
prompt's own assumption in Section 7's ask.

## 8. GUI acceptance checklist (for the future build task, NOT run in this pass)

Run against a real launched Electron app (`npm run dev` or the packaged build) once the plan
above is actually implemented:

1. Fresh profile (or manually clear the four `mnemo_nexus_*` localStorage keys via DevTools):
   confirm Research Arm shows OFF, User's Browser Session row is hidden (only shows when Research
   Arm is ON, per `NexusAuthoritySettings.tsx:126`), and all three per-arm pickers show "Local /
   Free (default)" selected.
2. Click "Use Recommended Settings" in `NexusAuthoritySettings.tsx` (Settings tab or Ask tab
   mount, whichever is being tested):
   - Research Arm pill visibly flips to ON.
   - User's Browser Session row appears and its pill visibly shows ON.
   - Lookup (fact-finding) and Reasoning per-arm pickers visibly highlight "User's Google
     (browser)" as selected; Compute stays on "Local / Free (default)".
   - Reload the Settings tab / re-collapse-and-reopen the Ask tab's Nexus panel and confirm the
     same state survives (i.e. it actually persisted to localStorage, not just component state).
3. Open DevTools console, run
   `window.addEventListener('nexus-authority-settings-changed', () => console.log('EVENT FIRED'))`
   BEFORE clicking the button, then click it -- confirm `EVENT FIRED` logs (should log once per
   `window.dispatchEvent` call in the final implementation; verify the exact count matches
   however many dispatches the shipped function ends up making, and that this is intentional, not
   an accidental multiplication).
4. With `NexusAuthoritySignInPanel.tsx` visible on screen at the same time (it always is,
   directly below `NexusAuthoritySettings` in both mount sites): confirm its "Enable Research Arm
   + User's Browser Session above to activate Google/Perplexity sign-in" notice
   (`NexusAuthoritySignInPanel.tsx:128-133`) disappears immediately after the click (it listens
   for the event already, Section 1) -- this is a real regression check: if this notice does NOT
   disappear, the event wiring is broken.
5. If a Mesh Synergy store field was added per Section 3 option (a): confirm the mesh-test panel
   (`OneClickMeshTestPanel.tsx`, reachable from wherever it's mounted -- check
   `PowerDiagnosticsPanel.tsx` / `ProofTab.tsx` in `compass/`) shows Mesh Synergy ON after the
   click, once its `plowEnabled && researchArmMode` gate is separately satisfied (Mesh Synergy's
   own checkbox only renders when both are true, `OneClickMeshTestPanel.tsx:845`) -- this
   specifically requires the Founder to also have Plow enabled in that panel; "Use Recommended
   Settings" does not touch `plowEnabled` (that's a mesh-test-panel-local, per-run flag, never a
   Nexus Authority store field) so this check may legitimately show Mesh Synergy's checkbox not
   even visible yet, which is CORRECT behavior, not a bug.
6. Auth gate check for User's Browser Session: with Research Arm + User's Browser Session freshly
   turned ON by the new button (not yet manually visited before), open
   `NexusAuthoritySignInPanel.tsx`'s now-enabled "Sign in to Google" / "Sign in to Perplexity"
   buttons (`:156-167`) and confirm they are clickable (not disabled) and that clicking one opens
   the real sign-in window via `window.amplify?.openNexusAuthoritySignIn?.(authority)` (`:59`) --
   i.e. confirm the recommended-settings action did NOT silently bypass or fake a signed-in state;
   the Founder must still complete a real sign-in for the browser-authority arms to actually work
   end to end, and the plan explicitly does not attempt to short-circuit that with a fabricated
   status.
7. Regression check: with the button never clicked at all (fresh profile, skip step 2), confirm
   every existing manual toggle/per-arm-picker interaction in `NexusAuthoritySettings.tsx` still
   behaves exactly as it does on the current `clean-shell-v0.9` build -- this is the "byte-
   unchanged for non-clickers" claim from Section 7, verified empirically.

## 9. OPEN QUESTIONS FOR FOUNDER/BISHOP

1. **Is Lookup/Reasoning -> `user_google`, Compute -> `local_free` really the right default, or
   should the build task present 2-3 named presets (e.g. "Maximum Free/Local", "Balanced
   (recommended)", "Maximum Browser-Authority") instead of one single hardcoded mapping?** The
   prompt's own draft mapping is what Section 5 implements verbatim (translated into the real
   string literals), but this plan did not independently re-derive that mapping from first
   principles -- it is exactly what was asked for, substituted onto the real type system. Worth
   the Founder's explicit sign-off before this ships, especially the choice to route BOTH
   fact-lookup and open-ended reasoning through the browser authority (Reasoning going to
   `user_google` in particular is a bigger behavior change than Lookup going there, since
   "reasoning" questions are the ones this repo's own `researchArmMode` doc comments most
   associate with the local specialist-adapter swarm's actual reasoning work, not a single
   fact-lookup search-engine round-trip -- see `browser_authority_types.ts:42-48`'s note that the
   three arms mirror `answer_type_classifier.ts`'s `'computable' | 'lookup_fact' | 'reasoning'`
   split one-for-one, i.e. `reasoning` is NOT the same category as `lookup_fact` even though this
   recommended mapping treats them identically).
2. **Mesh Synergy has no persisted store field today (Section 3) -- should "Use Recommended
   Settings" even claim to cover it, given the prompt explicitly asked for it to be set ON?** This
   plan flags two options (Section 3a/3b) rather than silently picking one, since adding a 4th
   persisted flag is a nontrivial scope increase (new localStorage key, new setter, new listener
   wiring in a file -- `OneClickMeshTestPanel.tsx` -- that currently has zero settings-store
   awareness) compared to the other three items which reuse 100% existing plumbing.
3. **The exact valid authority string literals DO differ from the prompt's draft phrasing**
   (`'local_free'`/`'user_google'` vs. the human-readable "Local/Free"/"User's Google (browser)"
   quoted in the prompt) -- flagged in Section 2, and the real literals are what Section 5's code
   spec uses. Please confirm this substitution reads correctly; it is a labeling difference, not a
   semantic one -- the prompt's INTENT (Lookup/Reasoning -> browser, Compute -> local) is preserved
   exactly, only the wire-format string names were corrected to match the real TypeScript union.
4. **`AskHomeTab.tsx` exists at exactly the path the prompt guessed** -- no substitution was
   needed here, unlike the other three flagged items. Reported for completeness since the prompt
   asked to flag it either way.
5. **Where exactly should the AskHomeTab.tsx button live -- inside the collapsed `nexusOpen`
   panel (this plan's primary recommendation, Section 4b) or in the always-visible top pill row
   next to the existing "🔗 Nexus" button (this plan's rejected alternate)?** The primary
   recommendation keeps the new button next to the settings it controls but means a
   first-time-opening Founder has to click "🔗 Nexus -- attach your apps" once before ever seeing
   the shortcut; the alternate surfaces it one click sooner but requires also forcing
   `setNexusOpen(true)` in its handler so the flipped toggles are actually visible afterward.
   Founder/Bishop preference requested.
6. **Should `NexusAuthoritySettings.tsx` add a `'nexus-authority-settings-changed'` listener of
   its own** (mirroring `NexusAuthoritySignInPanel.tsx:52-53`'s existing pattern) as the general
   fix, rather than this plan's Section 6a workaround of manually re-syncing three `useState`
   calls right after the store write? Adding the listener would be a slightly larger diff (a new
   `useEffect` with a named `refresh` closure, matching the sibling file's shape) but would also
   mean the AskHomeTab-side button (6b) "just works" without ANY special-casing, and would make
   the whole settings surface correctly reactive to ANY future caller of the store (not just this
   one new button) -- arguably the more correct fix, flagged here rather than silently chosen
   because it touches `NexusAuthoritySettings.tsx`'s existing `useEffect` (currently `:58-64`,
   mount-only) in a way Section 7's "no existing logic paths are modified" claim would need to be
   revised to acknowledge (adding a second `useEffect` is still additive, but changes the
   component's reactivity model, which is a real behavior change worth flagging explicitly rather
   than bundling silently into "purely additive").

---

## Final verification

`git status --short` was re-run after writing this file; see the chat response for the exact
pasted output and explicit confirmation that no code file was touched.
