// measurement_receipts.ts -- D-BP154-040/BISHOP-SEG/S40/seg-receipts
//
// FD-BP154-15 (RULINGS_BP154.md), Founder verbatim: "I need the 'keeping receipts' to be automatic
// for all measurable items concerning speed, cost, and accuracy. So that we can prove it - and
// those receipts should be eblets, so it fits together well, yes?"
//
// WHAT THIS FIXES, MEASURED. D-BP154-038 searched the entire platform tree for a receipted speed
// measurement backing a cited 15.6x figure (Softballs:1 23879ms vs NamedSet:1 1535ms, read off a
// screenshot of the running Composer) and found ZERO receipted speed measurements anywhere on
// disk. Those step timings render in the Composer UI and die there -- nothing persists them, so
// the figure had to be retracted. "A measurement that is displayed but not recorded is not
// evidence."
//
// EVERY RECEIPT IS AN EBLET, sand stratum (machine-minted, single observation) -- matriculating
// under FD-BP154-09's own ALREADY-RATIFIED criteria (sand -> soil on independent re-observation,
// soil -> sediment on third-party confirmation, and so on) exactly like every other eblet in this
// estate. This file mints the sand-stratum record ONLY; promotion runs through the SAME
// strata_promote pipeline every other eblet already uses -- this file does not build, and must
// never build, a second, parallel promotion mechanism.
//
// FIRST THING FIXED, per the ruling's own stated priority: PER-ATOMIC-QUERY timing, tagged by
// mechanism (OWNED_EVIDENCE / CONVERSATIONAL_ANSWER / DOCUMENT_CORROBORATION -- composer_step_
// evidence.ts's own ClaimMechanism union, reused here by reference, never re-declared), NOT per
// bundled Composer step. D-BP154-038 measured that step-level timing conflates retrieval mechanism
// with query complexity: one substrate-tagged step measured SLOWER (95.8s vs 56.2s) than a live
// one purely because it bundled five sub-queries into one step -- a step-level clock cannot tell
// "slow mechanism" apart from "many queries", and only a per-atomic-query clock can.
//
// SCOPE GUARD, this ticket's own explicit instruction: "instrument the measurement, do not invent
// new metrics, and do not compute rates or multipliers -- record raw figures and their comparison
// conditions." Nothing in this file computes a ratio, a multiplier, or an average -- every receipt
// carries exactly one raw figure (`value`/`units`) and the condition it was measured under
// (`comparedAgainst`/`conditions`). Deriving a citable RATE from a population of these receipts is
// a separate piece of work, gated on this estate's own 44% cross-run noise floor
// (NOISE_FLOOR_BP148: "never cite a single-run receipt... 4-6 repeats per arm minimum") -- not this
// file's job, and not done here.
//
// BUILT vs ACTIVE (FD-BP154-08, "state which of the two it is, every time"). The SPEED instrument
// (timeAtomicQuery(), below) is wired live this same commit into composer_step_evidence.ts's
// tryConversationalAuthority() (CONVERSATIONAL_ANSWER) and corroborateClaim() (DOCUMENT_
// CORROBORATION) -- ACTIVE for those two mechanisms. OWNED_EVIDENCE is NOT wired this commit:
// gatherMortgageCandidates()/gatherThisRunCandidates() do not currently receive a MethodRunContext
// carrying an acquisition/run id at their five existing call sites (softballs_step.ts/
// named_set_step.ts/discriminator_step.ts/magnitude_step.ts/human_nuance_step.ts), and widening
// five call sites' signatures to thread one through is a separate, larger, riskier change than this
// ticket's own time budget allows safely -- named honestly as BUILT (the `MeasurementReceipt.kind`
// type and `mintMeasurementReceipt()` both already support it) but NOT ACTIVE for OWNED_EVIDENCE,
// rather than silently left undone. `kind: 'cost' | 'accuracy'` are likewise BUILT (the shape
// exists and is exercised by this file's own tests) but have no live caller yet -- also named
// honestly, not claimed as more than they are.
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync, } from 'node:fs';
import { join } from 'node:path';
import { resolveEvidenceDir } from '../evidence/evidence_store';
function canonicalStringify(value) {
    const walk = (v) => {
        if (v === null || typeof v !== 'object')
            return v;
        if (Array.isArray(v))
            return v.map(walk);
        const out = {};
        for (const k of Object.keys(v).sort())
            out[k] = walk(v[k]);
        return out;
    };
    return JSON.stringify(walk(value));
}
function contentHash(value) {
    return createHash('sha256').update(canonicalStringify(value)).digest('hex');
}
function fileForToday(dir) {
    const day = new Date().toISOString().slice(0, 10);
    return join(dir, `MEASUREMENTS_${day}.jsonl`);
}
/** THE ONE PLACE a measurement receipt is minted and written. Append-only, Rule 66 -- no update,
 *  no delete, no handle capable of rewriting a line (same discipline evidence_store.ts's own
 *  appendEvidence() and composer_claims_store.ts's own appendComposerClaim() already establish for
 *  their own ledgers). A write failure here must never fail the measurement it describes --
 *  callers (timeAtomicQuery(), below) catch and swallow, same discipline as every other
 *  instrumentation-only write in this estate. */
export function mintMeasurementReceipt(input) {
    const base = {
        schema: 'liana-measurement-receipt/1',
        stratum: 'sand',
        kind: input.kind,
        metric: input.metric,
        value: input.value,
        units: input.units,
        instrument: input.instrument,
        comparedAgainst: input.comparedAgainst,
        conditions: input.conditions,
        runId: input.runId,
        measuredAt: new Date().toISOString(),
    };
    const receipt = { ...base, id: contentHash(base) };
    const dir = input.dir || resolveEvidenceDir();
    if (!existsSync(dir))
        mkdirSync(dir, { recursive: true });
    appendFileSync(fileForToday(dir), `${JSON.stringify(receipt)}\n`, 'utf8');
    return receipt;
}
/** Reads every measurement receipt written for one calendar day (UTC) -- a malformed line is
 *  skipped and counted, never silently dropped, same discipline composer_claims_store.ts's own
 *  loadComposerClaims() already applies. */
export function loadMeasurementReceipts(day, dir) {
    const d = dir || resolveEvidenceDir();
    const path = join(d, `MEASUREMENTS_${day}.jsonl`);
    if (!existsSync(path))
        return { records: [], malformedLines: 0 };
    const lines = readFileSync(path, 'utf8').split('\n').filter((l) => l.trim().length > 0);
    const records = [];
    let malformedLines = 0;
    for (const line of lines) {
        try {
            records.push(JSON.parse(line));
        }
        catch {
            malformedLines += 1;
        }
    }
    return { records, malformedLines };
}
/** THE FIRST THING THIS RULING FIXES (FD-BP154-15's own stated priority): wraps ONE atomic query --
 *  a single live call to one authority, never a bundled multi-query step -- with wall-clock timing,
 *  tagged by mechanism, and mints a speed receipt automatically on completion, success OR failure
 *  alike (a failed atomic query's own cost is recorded too -- a ledger that only ever records
 *  successes is survivorship-biased and would not be evidence either). Returns the wrapped
 *  function's own result unchanged, or rethrows its own rejection unchanged -- this never changes
 *  what the caller receives or how the caller's own error handling behaves, only what gets recorded
 *  alongside it. Minting failure is caught and swallowed (instrumentation, not a gate) and never
 *  turns a successful query into a failed one, or vice versa. */
export async function timeAtomicQuery(mechanism, label, runId, fn, 
// D-BP154-040, ADDITIVE/OPTIONAL, TEST-ONLY IN PRACTICE: overrides mintMeasurementReceipt()'s own
// directory. Every production call site (composer_step_evidence.ts) omits this, so every live
// call mints through resolveEvidenceDir() exactly as the ruling requires; this file's own tests
// use it to prove minting behavior without ever touching the real evidence store.
dir) {
    const t0 = Date.now();
    // D-BP154-040, ADDITIVE SAFETY: `runId === null` means no real acquisition/run context exists
    // for this call -- EXACTLY the condition script_bridge.ts's own persistStepClaim() already
    // treats as "instrumentation not applicable" ("Silently a no-op when `ctx.acquisitionId` is
    // absent -- every pre-existing call site, and every unit test, that does not thread one
    // through"). The timing measurement itself still happens (cheap, in-memory, never skipped) --
    // only the DISK WRITE is gated, so this file's own wiring into tryConversationalAuthority()/
    // corroborateClaim() cannot write real measurement receipts into the live evidence ledger every
    // time softballs_step.test.ts/named_set_step.test.ts/etc. run with a mocked ctx that carries no
    // acquisitionId -- the exact "tests contaminate live stores" defect class this estate has
    // already been bitten by once (BP148: 49 of 123 test files found writing synthetic records into
    // real stores with no cleanup).
    const record = (outcome, elapsedMs) => {
        if (runId === null)
            return;
        try {
            mintMeasurementReceipt({
                kind: 'speed',
                metric: `atomic query wall-clock time (${mechanism})`,
                value: elapsedMs,
                units: 'ms',
                instrument: 'timeAtomicQuery() -- Date.now() immediately before and after one atomic query call',
                comparedAgainst: `mechanism=${mechanism}`,
                conditions: `label="${label}", outcome=${outcome}`,
                runId,
                dir,
            });
        }
        catch {
            // Instrumentation failure only -- never allowed to fail the query it describes.
        }
    };
    try {
        const result = await fn();
        record('ok', Date.now() - t0);
        return result;
    }
    catch (e) {
        record('failed', Date.now() - t0);
        throw e;
    }
}
