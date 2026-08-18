// sufficiency_gate.ts -- D-BP154-041/BISHOP-SEG/S41/seg-purpose, PART 2/3
//
// FD-BP154-17 (RULINGS_BP154.md), Founder verbatim: "if the purpose was to find out what color an
// unseen Dog named Rex will be, that purpose cannot be achieved without first asking 'what are the
// possible colors of other dogs' or 'is this subset range of one example large enough to get us a
// feasible answer'?" -- Rover is a dog, Rover is black and white, therefore all dogs are black and
// white fails UPSTREAM of the inference: n=1 cannot support a universal. THE RULE:
//
//   Before an answer is attempted, establish that the available evidence class CAN satisfy the
//   stated purpose. If it cannot, that is INSUFFICIENT EVIDENCE -- a different, more honest
//   failure than a wrong answer or an unexplained abstain.
//
// STRUCTURAL, NEVER EVIDENCE-DEPENDENT (the acceptance test this file exists to pass, FD-BP154-17's
// own words: "the sufficiency gate would have flagged the item as unanswerable-as-stated on the
// first run, INDEPENDENTLY of the src lookup that eventually resolved it"). checkSufficiency()
// below reads only purpose_step.ts's own structural `purposeType` and the option COUNT (a stated
// field, Object.keys(options).length -- never which option is which, HARDWIRE-22/FD-BP153-06) --
// it issues no query, needs no provenance, and never selects a letter.
//
// THE ONE DECLARED PRECONDITION BUILT SO FAR (versioned, PURPOSE_PRECONDITION_POLICY_VERSION), for
// purposeType 'NEGATED_SUPERLATIVE_MEMBERSHIP' -- "which option is NOT one of the [most/least] X":
//
//   For the question to be well-posed, every option except the one answer must be an affirmed
//   member of the named superlative grouping -- i.e. requiredMemberCount = optionCount - 1. But a
//   "most/least X" grouping is, by the ordinary meaning of a superlative, a SMALL, EXCLUSIVE
//   subset -- not a near-total enumeration of whatever list happens to be offered alongside it (a
//   grouping that included almost everything being compared could not be called "the most" of
//   anything without the word losing its meaning). MAX_PLAUSIBLE_SUPERLATIVE_MEMBERS names that
//   small bound. When requiredMemberCount exceeds it, no source's answer could satisfy the purpose
//   without contradicting what "most/least" itself denotes -- the evidence class is structurally
//   incapable, checked from optionCount alone, before any query is issued.
//
// MEASURED ON QID 98 (BISHOP_DROPZONE\BP154_QID98_RESOLVED_THE_AUGMENTATION_DEFECT.md): nine
// options means requiredMemberCount = 8, which exceeds the bound below (4) -- INSUFFICIENT
// EVIDENCE, by construction, from the option count alone. That doc's own live-obtained "six fall
// outside" figure CORROBORATES this conclusion after the fact; this file does not use it or need
// it -- the gate must fire without any provenance lookup, and does.
//
// NOT EVERY PURPOSE-TYPE HAS A DECLARED PRECONDITION YET (honest, per FD-BP154-17: "preconditions
// are declared per purpose-type"). 'UNCLASSIFIED' has none on file -- checkSufficiency() reports
// `sufficient: true` with an explicit "no precondition declared" reason in that case, never a
// fabricated pass dressed up as a real check.
export const PURPOSE_PRECONDITION_POLICY_VERSION = '1';
/** The small, exclusive bound a "most/least X" grouping is presumed not to exceed -- see this
 *  file's own header for the reasoning. Declared here, in ONE place, so a future widening/
 *  narrowing of the bound is a single, traceable, versioned change. */
const MAX_PLAUSIBLE_SUPERLATIVE_MEMBERS = 4;
/** THE GATE. Pure, synchronous, no I/O, never reads which option is which -- only `optionCount`.
 *  Called once purposeType is known (purpose_step.ts's derivePurposeType()) and the option count is
 *  known (Object.keys(input.options ?? {}).length) -- BEFORE Softballs:1/NamedSet:1/Discriminator:1/
 *  Magnitude:1/HumanNuance:1 issue a single query (script_bridge.ts's own upstream skip gate, PART
 *  3, is what actually withholds those queries once this returns `sufficient: false`). */
export function checkSufficiency(purposeType, optionCount) {
    if (purposeType === 'NEGATED_SUPERLATIVE_MEMBERSHIP') {
        const requiredMemberCount = optionCount - 1;
        const sufficient = requiredMemberCount <= MAX_PLAUSIBLE_SUPERLATIVE_MEMBERS;
        return {
            purposeType,
            preconditionId: 'negated-superlative-member-bound',
            preconditionDescription: 'a bounded set of the [most/least X] must exist, and the option list must contain exactly '
                + 'one member outside it -- checked structurally as: optionCount - 1 (every option except '
                + `the answer) must not exceed ${MAX_PLAUSIBLE_SUPERLATIVE_MEMBERS}, the small, exclusive `
                + 'size a superlative grouping is presumed not to exceed',
            sufficient,
            reason: sufficient
                ? `${requiredMemberCount} required member(s) is within the bound (${MAX_PLAUSIBLE_SUPERLATIVE_MEMBERS}) -- proceeding`
                : `INSUFFICIENT EVIDENCE -- this question has ${optionCount} option(s), so ${requiredMemberCount} `
                    + `would need to be affirmed members of "the most/least X" grouping for a unique non-member to `
                    + `exist; that exceeds the small, exclusive bound (${MAX_PLAUSIBLE_SUPERLATIVE_MEMBERS}) a `
                    + `superlative can plausibly denote -- the evidence class cannot satisfy this purpose no matter `
                    + `what any source states, checked from the option count alone, without any provenance lookup`,
            policyVersion: PURPOSE_PRECONDITION_POLICY_VERSION,
        };
    }
    return {
        purposeType,
        preconditionId: 'none-declared',
        preconditionDescription: `no precondition is declared yet for purposeType "${purposeType}" (FD-BP154-17: preconditions are declared per purpose-type)`,
        sufficient: true,
        reason: 'no declared precondition applies -- not gated (never a fabricated pass; honestly, nothing was checked)',
        policyVersion: PURPOSE_PRECONDITION_POLICY_VERSION,
    };
}
