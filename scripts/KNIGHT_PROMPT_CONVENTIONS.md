# Knight Prompt Conventions — YAML Frontmatter Schema
## Established B117 / K443, April 23 2026

All Knight prompt files in `BISHOP_DROPZONE/01_KnightPrompts/` should begin with
a YAML frontmatter block (added by Bishop from B118 onward; absent frontmatter
is handled gracefully by `knight-dispatch.ps1` with a warning and defaults).

---

## Frontmatter block format

```yaml
---
knight_session: K443
bishop_session: B117
complexity_tier: MODERATE          # SIMPLE | MODERATE | COMPLEX
estimated_duration_hours: 1.5
recommended_model: sonnet-4.6      # haiku-4.5 | sonnet-4.6 | opus-4.6 | opus-4.7
escalation_trigger: "If more than 3 files need simultaneous edits, escalate to opus-4.7"
---
```

The block must be:
- The very first content in the file (before the `# Knight K…` heading)
- Delimited by `---` on its own line, both opening and closing

---

## Field reference

| Field | Required | Type | Description |
|---|---|---|---|
| `knight_session` | Yes | string | Knight session ID, e.g. `K443` |
| `bishop_session` | Yes | string | Bishop session that authored the prompt, e.g. `B117` |
| `complexity_tier` | Yes | enum | `SIMPLE`, `MODERATE`, or `COMPLEX` (see rubric below) |
| `estimated_duration_hours` | Yes | float | Expected Knight session length in hours |
| `recommended_model` | Yes | enum | See model table below |
| `escalation_trigger` | No | string (quoted) | Condition under which operator should switch to a more powerful model mid-session |

---

## Complexity tier rubric

| Tier | Criteria | Recommended model | Typical cost |
|---|---|---|---|
| **SIMPLE** | One file. Trivial logic. Docs / config / hygiene. No tests required. | `haiku-4.5` or `sonnet-4.6` | $1–5 |
| **MODERATE** | 3–10 files. Tests required. Standard library usage. No novel design choices. | `sonnet-4.6` | $5–20 |
| **COMPLEX** | 10+ files OR novel architecture OR multi-hour session OR multi-module integration OR cross-module refactor | `opus-4.7` | $30–120 |

---

## Supported model values

| Value | Display name | When to use |
|---|---|---|
| `haiku-4.5` | Claude Haiku 4.5 | SIMPLE one-file edits, docs, config |
| `sonnet-4.6` | Claude Sonnet 4.6 | MODERATE sessions; default when absent |
| `opus-4.6` | Claude Opus 4.6 | COMPLEX if Opus 4.7 budget is exhausted |
| `opus-4.7` | Claude Opus 4.7 | COMPLEX architecture / multi-module sessions |

**Default (absent or unknown value):** `sonnet-4.6`

---

## Cursor CLI model-preselection status

As of **Cursor 3.1.17** (documented April 23 2026), the Cursor CLI has **no
`--model` flag**.  Available CLI surface:

```
cursor [options][paths...]

Notable flags: --diff, --merge, --goto, --new-window, --reuse-window,
               --chat, --add-mcp, --profile, --wait
Subcommands:  tunnel, serve-web, agent

No --model, --ai-model, or equivalent flag exists.
```

`knight-dispatch.ps1` therefore uses the "informed manual picker" approach:
1. Parses the frontmatter model recommendation
2. Opens the prompt file in Cursor
3. Copies prompt content to clipboard
4. Displays a prominent terminal banner with the recommended model
5. Fires a Windows toast notification as a secondary reminder
6. Logs the dispatch event to `knight_dispatch.log.jsonl`

The operator still selects the model inside Cursor's UI, but the decision is
pre-computed by Bishop rather than guessed at dispatch time.

---

## Dispatch wrapper usage

```powershell
# Dispatch by filename (resolved against BISHOP_DROPZONE/01_KnightPrompts/)
.\scripts\knight-dispatch.ps1 -PromptFile PROMPT_KNIGHT_K443_B117_MODEL_ROUTER_DISPATCH_WRAPPER.md

# Dispatch by K-number shorthand
.\scripts\knight-dispatch.ps1 K443

# Force new Cursor window
.\scripts\knight-dispatch.ps1 K443 -NewWindow

# Finalize a session with actual cost (Half E)
.\scripts\knight-dispatch.ps1 -Finalize K443 -ActualCost 18.50
```

---

## Dispatch log format (`scripts/knight_dispatch.log.jsonl`)

One JSON object per line, appended atomically on each dispatch:

```json
{
  "ts": "2026-04-23T14:30:22Z",
  "prompt_file": "PROMPT_KNIGHT_K443_B117_MODEL_ROUTER_DISPATCH_WRAPPER.md",
  "knight_session": "K443",
  "bishop_session": "B117",
  "complexity_tier": "MODERATE",
  "recommended_model": "sonnet-4.6",
  "launched_via": "cursor-cli-fallback",
  "estimated_duration_hours": 1.5,
  "escalation_trigger": "If more than 3 files need simultaneous edits, escalate to opus-4.7",
  "model_was_default": false
}
```

After session close (optional Half E):

```json
{
  "ts": "...",
  ...same fields...,
  "actual_cost_usd": 18.50,
  "finalized_at": "2026-04-23T17:15:44Z"
}
```

---

## Backfill policy

**Existing K-prompts (K001–K442) are NOT backfilled.**  Bishop adds frontmatter
to every new prompt from B118 onward.  The wrapper handles absent frontmatter
with a warning and falls back to `sonnet-4.6`.

K441 and K442 received frontmatter as part of K443 test setup only (to exercise
the COMPLEX and MODERATE dispatch paths during acceptance testing).

---

*K443 / B117.  Knight (Claude Sonnet 4.6, Cursor).  April 23 2026.*
