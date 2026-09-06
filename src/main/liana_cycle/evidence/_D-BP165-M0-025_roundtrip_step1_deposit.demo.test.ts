// _D-BP165-M0-025_roundtrip_step1_deposit.demo.test.ts -- D-BP165-M0-025/BISHOP-SEG/seg-flagship-harvest
//
// STEP 1 of a genuinely TWO-PROCESS round-trip proof (see step2, a separate `npx vitest run`
// invocation with no memory of this one). Deposits ONE methodology eblet, exercising the new
// D-BP165-M0-025 named-constants channel on real content, into a PERSISTENT (not temp-dir) silo
// directory under this dispatch's own dropzone folder so step 2 can read it back in a fresh process.
//
// CONTENT PROVENANCE, STATED HONESTLY: this dispatch's live flagship harvest (Google Gemini,
// AI-Studio free tier, Gemini_API_Key from 22May2026.env) FAILED at authentication (HTTP 401,
// ACCESS_TOKEN_TYPE_UNSUPPORTED) on every one of 5 real network attempts -- see
// harvest_raw_results.json in this dispatch's dropzone folder for the verbatim error. Zero tokens
// were consumed and zero cost was incurred (rejected before inference on every attempt). Because a
// real flagship call could not be completed, the content deposited here is a SUBSTITUTE, hand-
// authored demonstration of what a harvested method deposit looks like -- NOT flagship output --
// clearly labeled as such in every field below (taughtBy, filedBy) so it is never mistaken for a
// real harvest in the persisted silo. It proves the DEPOSIT + GUARD + ROUND-TRIP mechanism this
// dispatch built; it does not substitute for the still-pending real harvest, which needs a working
// credential (see this dispatch's own return for the ask).
//
// The underlying method (loan remaining-balance amortization, qid 638 from
// mmlu_pro_subset_report_D-BP165-M0-023_NUMPREDICT256.json) and its constant (12 months/year, a
// real, checkable, non-item-specific fact) are genuine and correct -- only the SOURCE is
// substitute (hand-authored here, not flagship-sourced) because the live call could not complete.

import { describe, expect, it } from 'vitest';
import { mkdirSync } from 'node:fs';
import { depositMethodologyEblet, auditSiloForAnswerLeakage } from './method_silo';

const DIR = 'C:\\Users\\Administrator\\Documents\\LianaBanyanPlatform\\BISHOP_DROPZONE\\D-BP165-M0-025_FLAGSHIP_HARVEST\\demo_silo_dir';

describe('D-BP165-M0-025 round-trip proof, STEP 1 (deposit) -- persistent dir, read back by a separate process in step 2', () => {
  it('deposits the loan-amortization method with a real named constant (12 months/year) through the new channel, and audits clean', () => {
    mkdirSync(DIR, { recursive: true });
    const outcome = depositMethodologyEblet({
      demandKind: 'COMPUTE',
      methodId: 'methods.arithmetic_cascade.loanRemainingBalanceMethod',
      whatItDoes: 'Answers questions asking for the remaining balance owed on a fixed-rate '
        + 'amortizing loan partway through its term. Converts the annual interest rate to a '
        + 'periodic (monthly) rate, then applies the standard remaining-balance formula: the '
        + 'present value of the remaining scheduled payments, discounted at the periodic rate over '
        + 'the number of periods remaining. Never computes a numeric result for a specific loan in '
        + 'this eblet -- describes the general method only.',
      taughtBy: 'SUBSTITUTE DEMONSTRATION, NOT FLAGSHIP-SOURCED (D-BP165-M0-025): the live Google '
        + 'Gemini free-tier harvest for this qid failed authentication '
        + '(ACCESS_TOKEN_TYPE_UNSUPPORTED, an unauthorized-credential rejection) on '
        + 'every attempt -- see harvest_raw_results.json. This method text was hand-authored as a '
        + 'stand-in to prove the deposit/guard/round-trip mechanism while the real harvest is '
        + 'blocked on a credential fix.',
      qid: 638,
      runId: 'D-BP165-M0-025-roundtrip-demo',
      dispatchId: 'D-BP165-M0-025',
      hexConnector: 'PROOF',
      hexConnectorJustification: 'PROOF holds cascade/method measurement discipline -- a '
        + 'demand-kind-to-method mapping produced by the harvest loop is exactly that, not a '
        + 'standing RULE, campaign STATE, or HARDWIRE protocol.',
      sessionLabel: 'BP165',
      model: 'SUBSTITUTE (flagship call failed auth, see taughtBy)',
      filedBy: 'D-BP165-M0-025/BISHOP-SEG, substitute content (flagship auth failed)',
      constants: [
        {
          symbol: 'periods_per_year',
          value: 12,
          unit: 'months',
          source: 'standard monthly-compounding convention for a fixed-rate amortizing loan',
        },
      ],
      dir: DIR,
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error(`deposit refused: ${outcome.reason} leaks=${JSON.stringify(outcome.leaks)}`);
    expect(outcome.bytes).toBeGreaterThan(0);

    const audit = auditSiloForAnswerLeakage({ dir: DIR });
    expect(audit.flagged).toEqual([]);

    // eslint-disable-next-line no-console -- deliberate, this IS the observable proof artifact
    console.log(`[D-BP165-M0-025 STEP 1] deposited: ${outcome.path} (${outcome.bytes} bytes). Audit scanned=${audit.scanned} flagged=${audit.flagged.length}.`);
  });
});
