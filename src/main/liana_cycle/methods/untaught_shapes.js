// untaught_shapes.ts -- D-BP153-008/BISHOP/untaught-shapes
//
// REGISTERS THE THREE DEMAND TYPES THAT HAVE NO METHOD, SO THE TERMINAL STOPS SAYING THE WRONG
// THING WHEN IT MEETS ONE.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// THE MEASURED GAP. Six demand types exist (demand_test.ts, LianaDemand): RANK, DEFINE, IDENTIFY,
// CLASSIFY, INFER, LOCATE-IN-FRAMEWORK. Three have runners: comparative-cascade serves RANK,
// definitional-cascade serves DEFINE, classify-cascade serves CLASSIFY. IDENTIFY, INFER and
// LOCATE-IN-FRAMEWORK had NO registry entry at all.
//
// That is not an abstract gap. In the BP153 20-question benchmark, 14 were correct, 0 were wrong,
// and the 6 abstains were EXACTLY ONE PER DEMAND TYPE: qid 46 CLASSIFY, 66 IDENTIFY, 72 INFER,
// 85 DEFINE, 92 LOCATE-IN-FRAMEWORK, 98 RANK. Half of the standing hard set demands an operation
// this estate has never built.
//
// And a live qid 98 run (2026-08-12T03:54Z) ended `no_method_matched` reporting "NO METHOD SERVES
// THIS DEMAND -- nothing on file performs IDENTIFY."
//
// WHY THIS FILE HAS NO RUNNERS, AND WHY THAT IS THE CORRECT FIX RATHER THAN A SMALL ONE.
// This registry's own header (method_registry.ts, lines 30-35) already ruled this exact case:
//
//   "A method may be REGISTERED with no RUNNER (`run: null`) -- that is deliberate, not a bug...
//    The registry must be able to hold a known-but-unimplemented method so the terminal can say
//    'this is a recognized shape, not yet taught' instead of the less honest 'no method matches'
//    -- those are different findings and the transcript must not conflate them."
//
// So the defect being fixed here is a REPORTING defect, and the estate had already designed the
// answer to it. "Nothing on file performs IDENTIFY" reads as a dead end. "IDENTIFY is a known
// shape and no case has taught it yet" is a teaching prompt, which is what canon R-5 requires.
//
// WHAT WAS DELIBERATELY NOT DONE: three cascade runners were NOT invented here. Canon rule 4 of
// this registry is that a method cites the case that taught it, and every runner in this estate
// exists because the Founder walked a case by hand and the walk was then encoded. Writing three
// answering strategies out of Bishop's own head would produce methods with `taughtBy` citations
// that do not exist, which is precisely the tare HARDWIRE-23 forbids and precisely the kind of
// unattributed machinery FD-BP152-09 was cleaning up. These three want three walked cases. The
// benchmark has already nominated the candidates: qid 66 for IDENTIFY, qid 72 for INFER, qid 92
// for LOCATE-IN-FRAMEWORK.
//
// EACH ENTRY'S shapeTest MATCHES ON DEMAND ALONE, and says so. That is honest here and would not
// be honest for a runner: canon R-4 already refuses any method whose declared demand does not
// match, so these entries can only ever be reached by a question whose demand is theirs, and no
// other method serves those demands, so nothing can be hijacked. A stub that pretended to a
// finer shape signature would be claiming knowledge from a case nobody has walked.
// ─────────────────────────────────────────────────────────────────────────────────────────────
import { registerMethod } from '../method_registry';
/** Shared shape test for an untaught shape. Canon R-4 (demand must match) has already been
 *  applied by the registry before a shapeTest is consulted, so matching here is honest: it
 *  reports that the SHAPE is recognized, and the missing `run` is what reports that the METHOD
 *  is not built. Those are the two different findings the registry header insists on keeping
 *  apart. */
const untaughtShapeTest = (demand, nominatedQid) => (_input) => ({
    matches: true,
    reason: `${demand} is a recognized demand type with no taught method. This entry exists so the `
        + `transcript reports "not yet taught" rather than "no method matches" -- different findings `
        + `(method_registry.ts header). The next teaching session for this shape is ${nominatedQid}.`,
});
export const identifyUntaught = {
    id: 'identify-untaught',
    name: 'IDENTIFY (recognized shape, not yet taught)',
    demand: 'IDENTIFY',
    taughtBy: 'NOT YET TAUGHT. No walked case exists. Registered at D-BP153-008 so a question demanding '
        + 'IDENTIFY reports a known-but-unbuilt shape instead of "no method matches" -- the distinction '
        + 'method_registry.ts\'s own header (lines 30-35) requires. Nominated teaching case: qid 66, which '
        + 'abstained in the BP153 benchmark.',
    shapeDescription: 'the answer is a member or instance -- which of these IS the thing named',
    shapeTest: untaughtShapeTest('IDENTIFY', 'qid 66 (BP153 benchmark abstain)'),
    run: null,
};
export const inferUntaught = {
    id: 'infer-untaught',
    name: 'INFER (recognized shape, not yet taught)',
    demand: 'INFER',
    taughtBy: 'NOT YET TAUGHT. No walked case exists. Registered at D-BP153-008 for the same reason as '
        + 'identify-untaught. Nominated teaching case: qid 72, which abstained in the BP153 benchmark.',
    shapeDescription: 'the answer is a conclusion drawn from evidence, not stated by any single source',
    shapeTest: untaughtShapeTest('INFER', 'qid 72 (BP153 benchmark abstain)'),
    run: null,
};
export const locateInFrameworkUntaught = {
    id: 'locate-in-framework-untaught',
    name: 'LOCATE-IN-FRAMEWORK (recognized shape, not yet taught)',
    demand: 'LOCATE-IN-FRAMEWORK',
    taughtBy: 'NOT YET TAUGHT. No walked case exists. Registered at D-BP153-008 for the same reason as '
        + 'identify-untaught. Nominated teaching case: qid 92, which abstained in the BP153 benchmark.',
    shapeDescription: 'the answer is a term\'s role inside a named theory or framework',
    shapeTest: untaughtShapeTest('LOCATE-IN-FRAMEWORK', 'qid 92 (BP153 benchmark abstain)'),
    run: null,
};
registerMethod(identifyUntaught);
registerMethod(inferUntaught);
registerMethod(locateInFrameworkUntaught);
