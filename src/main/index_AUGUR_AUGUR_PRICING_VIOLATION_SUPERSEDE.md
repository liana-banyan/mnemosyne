---
supersede_type: augur_post_audit_violation
augur_id: augur_pricing
augur_name: Augur-Pricing
violating_file: C:\Users\Administrator\Documents\mnemosyne\src\main\index.ts
detected_at: 2026-07-26T03:32:59Z
status: reconciled
kn043: true
---

# Augur Post-Audit Violation Supersede

**Augur:** Augur-Pricing  
**Violating file:** `C:\Users\Administrator\Documents\mnemosyne\src\main\index.ts`  
**Detected:** 2026-07-26T03:32:59Z

## Violation Signal

WARN [Augur-Pricing] (PostToolUse audit — not blocking): Membership pricing ≠ $5/year detected.
LB membership is $5/year, identical for every member from day one through year fifty.
No tiers, no early-adopter pricing, no entry fees. Lifetime guarantee at signup price.
Note: API spend, compute cost, Pawn run budgets, 'Member count', and 'threshold' (canonical Amplifier naming) do NOT trigger this Augur (K514.5/K527 tuned).
Context exemptions: '$5/year membership unchanged', 'membership-orthogonal', 'pricing identical for all', '(industry term)' suppress false positives when present in the diff.
Path exemptions: Amplifier AA Formals (#2318-2320), project_amplifier_program_*, voucher_tiers/, BRIDLE_RULES/, sentinel_severity_tiers/.
See: project_membership_pricing_identical_for_all.md

## Action Required

This file was written with content that triggered the **Augur-Pricing** Augur.
The write was **NOT blocked** (PostToolUse audit mode — KN043 BP005).
Bishop must reconcile: either correct the violating file or ratify an exemption.

## Stone Tablet Pattern

This supersede stub follows the BP005 Skipping Stones extension:
- D.2 KN043: NO destructive operations. Write succeeded; this stub points
  to the canonical correction needed.
- Per Hugo clarification examples: supersede stubs carry `status: pending_reconciliation`.
  Once Bishop reconciles, update status to `reconciled` and note the resolution.

## Reconciliation (Bishop, BP138)

**Verdict: FALSE POSITIVE. No code change needed.** The only membership price asserted in `index.ts` is `annualFeeUsd: 5` (line 4419), consistent with the $5/year immutable. Every `tier` hit is a hardware/model SKU tier (nano/lite/core/full, gemma4:12b), unrelated to membership pricing. The Augur most likely matched `filing_fee: '$65'` (line ~4770, a USPTO micro-entity patent-docket filing fee) plus generic `fee`/`tier` keyword density -- neither is membership pricing. No non-$5 membership price exists anywhere in this file. Verified by Sonnet-5 SEG.
