# Hearth Conjunction Window — Founder Ship-Day Verification Protocol
## B83 / BP035 · The 9-Step Heavy Booster Test PASS
## G15 Gate — Founder Must Execute This Protocol

---

## Prerequisites

Before starting:
1. AMPLIFY Computer is running (check system tray)
2. Ollama is running (`ollama serve` or auto-started by AMPLIFY)
3. `ANTHROPIC_API_KEY` is set in environment (load from SDS.env if needed)
4. `KNIGHT_BISHOP_MESSAGES.md` exists in `LianaBanyanPlatform/` (Knight is paste-available)
5. Internet connection available (for Opus + Embedded Chrome)

---

## The 9-Step Protocol

### Step 1: Launch
**Action:** Open Hearth Conjunction Window from system tray → "🔥 Hearth Conjunction Window"

**Pass criteria:**
- ✓ Window renders within 2 seconds
- ✓ All five panels visible: App Builder Chat, Embedded Chrome, Drekaskip Wave Status, In Conjunction, Active Substrate
- ✓ Window title shows "Hearth Conjunction Window — Heavy Booster Test"
- ✓ "HEAVY BOOSTER TEST" badge visible in header

**Step 1 result:** `[ ] PASS  [ ] FAIL`

---

### Step 2: Conjunction Default
**Action:** Inspect the "In Conjunction" panel (right column, top)

**Pass criteria:**
- ✓ `cpu_only` is selected by default (blue border)
- ✓ Status dot = green (always available)
- ✓ No model spend reported

**Step 2 result:** `[ ] PASS  [ ] FAIL`

---

### Step 3: Single-Backend Ollama
**Action:**
1. In "In Conjunction" panel, click **Ollama (Local)**
2. In App Builder Chat, type: *"build me a daily-log app where I rate my mood 1-10 and write a note"*
3. Press Ctrl+Enter to send

**Pass criteria:**
- ✓ Ollama backend shows green status (daemon running)
- ✓ App Builder Chat processes the request
- ✓ Conjunction output strip shows Ollama response OR build starts via B69 path
- ✓ No Anthropic API spend

**Step 3 result:** `[ ] PASS  [ ] PARTIAL  [ ] FAIL`

**Notes (if partial):** _______________________________________________

---

### Step 4: Single-Backend Opus
**Action:**
1. Click **Opus (Claude)** in Conjunction Panel
2. In App Builder Chat, type: *"explain the Trinity meta-canon"*
3. Press Ctrl+Enter

**Pass criteria:**
- ✓ Opus response arrives in conjunction output strip
- ✓ Response discusses Blood (Oracle Circuit) / Sweat (B80) / Tears (B81)
- ✓ Cost receipt < $0.10 shown in output header

**Step 4 result:** `[ ] PASS  [ ] PARTIAL  [ ] FAIL`

**Approximate cost:** $_______

---

### Step 5: All In Conjunction
**Action:**
1. Click **All In Conjunction** in Conjunction Panel
2. Type: *"what is the next step for the Heavy Booster Test?"*
3. Press Ctrl+Enter
4. Wait up to 90 seconds

**Pass criteria:**
- ✓ All four backends dispatched (receipts show CPU + Ollama + Knight + Opus sections in output)
- ✓ CPU, Ollama, and Opus respond (OR error cleanly with message)
- ✓ Knight section shows either response OR timeout message (best-effort async)
- ✓ Fan-in composite output rendered with provenance headers (### CPU Only / ### Ollama / etc.)
- ✓ Total elapsed ≤ 90s (Knight may still be pending)
- ✓ Drekaskip Wave Status shows wave count increment

**Step 5 result:** `[ ] PASS  [ ] PARTIAL  [ ] FAIL`

**Backends responded:** CPU `[ ]`  Ollama `[ ]`  Knight `[ ]`  Opus `[ ]`

---

### Step 6: Embedded Chrome Auto-Injection
**Action:**
1. In the Embedded Chrome panel, navigate to: `https://gemini.google.com` or `https://www.google.com`
2. Wait for page to load
3. Click in the AI input field
4. Type a question (e.g., *"what is cooperative AI substrate"*)
5. Press Enter

**Pass criteria:**
- ✓ Auto-inject badge shows "🧬 context ready" or "✓ injected"
- ✓ Injection receipt logged in `%APPDATA%\AMPLIFY Computer\hearth_conjunction\embedded_browser_injection.jsonl`
- ✓ Injection toast appears (green = success, orange = miss)

**Verification (if injection badge shows miss):**
```powershell
# Check injection log
Get-Content "$env:APPDATA\AMPLIFY Computer\hearth_conjunction\embedded_browser_injection.jsonl" | Select-Object -Last 5
```

**Step 6 result:** `[ ] PASS  [ ] PARTIAL (miss — logged)  [ ] FAIL (CSP blocked)`

---

### Step 7: Drekaskip Live Status
**Action:** While Step 5 dispatch is running (or run another "All In Conjunction" dispatch), watch the Drekaskip Wave Status panel

**Pass criteria:**
- ✓ Active saga shows: `hearth_conjunction`
- ✓ Wave instances appear and update within 3 seconds of dispatch
- ✓ Status dots: yellow (in-flight) → green (complete)

**Step 7 result:** `[ ] PASS  [ ] FAIL`

**Wave count at start:** _____ **After dispatch:** _____

---

### Step 8: Active Substrate Kill-and-Restart Drill
**Action:**
1. Confirm Active Substrate panel shows at least Sweat and Tears cells (green or yellow)
2. Note current Sweat cell status
3. On Windows: open Task Manager → find `sweat_scribe` process (if running as daemon) → end task
   - If no daemon process: mark as SKIP (Sweat Scribe not yet running as OS daemon — G8 pending)
4. Wait up to 5 seconds — Sweat cell should go red
5. Restart Sweat Scribe daemon
6. Wait up to 30 seconds — cell should return green

**Pass criteria (if daemon running):**
- ✓ Kill: cell goes red within 5s
- ✓ Restart: cell returns green within 30s

**Step 8 result:** `[ ] PASS  [ ] SKIP (daemon not running as OS service)  [ ] FAIL`

---

### Step 9: Heavy Booster Test Verdict

**Scoring:**
- PASS: Steps 1-8 all PASS (Step 8 SKIP is acceptable — Watchdog wired but daemon not yet OS-service)
- PARTIAL: Steps 1-7 PASS, Step 8 SKIP or PARTIAL
- FAIL: Any of Steps 1-7 FAIL with unrecoverable error

| Verdict | Meaning |
|---|---|
| **PASS** | Hearth Conjunction Window is the **first user-facing artifact of the cooperative-AI substrate at escape velocity from solo-Founder-orchestration class**. The Heavy Booster Test first stage burn is verified. |
| **PARTIAL** | Core conjunction surface operational. Ship with noted partial items as follow-up. |
| **FAIL** | Root cause documented below. Follow-up bushel required before ship gate. |

**Heavy Booster Test Verdict:** `[ ] PASS  [ ] PARTIAL  [ ] FAIL`

**Founder notes:**
```
_______________________________________________________________
_______________________________________________________________
_______________________________________________________________
```

**Executed by:** Jonathan Jones (Founder)
**Date:** ________________
**Machine:** ________________
**OS:** ________________

---

## Yoke Handoff Trigger

After completing this protocol, Founder sends to Knight (or directly appends to Yoke):
```
[CAI] [B83-G15-VERDICT] Founder → Knight
Heavy Booster Test: <PASS/PARTIAL/FAIL>
Steps completed: <count>/9
Notes: <Founder notes>
```

---

*G15 Founder Ship-Day Gate — this document executes the Heavy Booster Test.*
*"Roads? Where we're going, WE don't NEED Roads." — HEAVY BOOSTER TEST.*
