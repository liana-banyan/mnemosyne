// elements/kind_check.ts -- E-KIND-CHECK -- D-BP150-011/BISHOP/seg-kindcheck
//
// THE KIND-CHECK, run FIRST. Ratified canon:
//   Asteroid-ProofVault/state/eblets/CANON/canon_kind_check_first_and_the_types_are_finite_bp150.eblet.md
//
// Founder, BP150: "We need a test to see if a result from applying a method to a question results
// in something nonsensical or not. ... yes a kind-check. FIRST, which is the same principle of the
// Survey steps." And: "what IS true is that there is a finite result of types."
//
// THE SIX PROPOSED TYPES (canon's starting enumeration, PROPOSED not ratified -- R-4: adding,
// removing, or merging a type is a Founder act):
//   THING                a bare noun phrase naming an entity                  "Technological systems"
//   PROPOSITION          a full clause asserting something                    "There is no specific referent point."
//   ABSENCE-CLAIM         a PROPOSITION whose content is that something does   qid 92's E -- a SUBTYPE
//                          not exist -- the shape that defeats substitution    of PROPOSITION, reported
//                                                                              as its own type per canon
//   DEFINITION-STATEMENT  a clause stating what a term means                  qid 85's "It describes a process that..."
//   PROPERTY               an attribute rather than an entity                  "a lack of randomization"
//   QUANTITY               a number or rate                                    a numeral or unit
//
// R-3 (governing canon): a type the kind-check cannot assign is reported as UNRECOGNIZED (type: null)
// and the step stops. It is NEVER coerced to the nearest known type. Returning null is CORRECT and
// REQUIRED when nothing fits -- an unrecognized type is a gap in the enumeration, not a failure of
// this function, and it is exactly the signal the Founder asked for so new types can be named.
//
// GRAMMATICAL SIGNALS ONLY. NO DOMAIN VOCABULARY. This file classifies FORM, never topic. Every
// list below is a CLOSED CLASS of English function/structure words (copulas, auxiliaries, modals,
// a small set of generic abstract-attribute head nouns, unit abbreviations) -- the same discipline
// aspect_tag.ts's STATIVE/BECOMING/ACTIVITY_HEADS lists already keep, and catalyst_words.ts's
// FUNCTION_WORDS list states explicitly: "grammatical, not topical... cannot be tuned toward a
// particular answer without that being visible in the diff." An earlier cue table in this codebase
// was caught containing "organs" and "drains" -- domain vocabulary pulled from one benchmark
// question's anatomy content -- and that contamination is exactly what this file must not repeat.
// Nothing below names a field, a subject, or a fact; every list is drawn from English grammar's own
// closed classes (the auxiliary/modal system, existential "there is/are", unit abbreviations).
//
// NO MODEL IS CONSULTED. Every type is a declared rule applied to text, and every result carries the
// reason it was assigned (`why`), because a classification the operator cannot audit is not a proof
// -- the same standard aspect_tag.ts's AspectTag.why and nest.ts's NestLevel.why already hold.
//
// THIS FILE IS PURE. NO I/O. NO MODEL.
//
// KNOWN, DECLARED LIMITATIONS (reported here so they are visible in the diff, not discovered later):
//   - Finite-verb detection uses ONLY the closed-class copula/auxiliary/modal list below. A clause
//     built on a bare regular or irregular main verb with NO auxiliary ("They bred a specific
//     species of deer.") carries no marker from that list and will NOT be detected as a finite
//     clause -- it falls through to the bare-phrase branch and is typed THING, PROPERTY, or QUANTITY
//     by whatever the bare-phrase rules see, which is very likely wrong for that text. This is a
//     real gap in PROPOSITION coverage, not a tuned-away one: closing it properly needs a verb
//     lexicon or POS tagger, which is model machinery this element deliberately does not use. This
//     ticket's test script measures how often the gap fires across the bundled corpus and reports it
//     as a failure, per this ticket's own measurement-discipline instruction.
//   - QUANTITY detection looks for a digit or a small closed set of unit abbreviations. Numbers
//     spelled out in words ("twelve", "a dozen") are not detected and fall through to THING/PROPERTY.
//   - The compound multi-part detector (two or more "a) ... b) ... c) ..." lettered sub-clauses)
//     catches ONE recognizable non-fitting shape and reports it as unrecognized/null, per R-3. It
//     does not claim to catch every shape that does not fit the six proposed types -- see this
//     ticket's return for the corpus-wide unrecognized rate and what it suggests.
// ── ABSENCE-CLAIM: existential-negation constructions. Checked FIRST because it is the most
//    specific shape (a SUBTYPE of PROPOSITION) and, per the governing canon, "the shape that defeats
//    substitution and the reason this element exists" -- it must never be swallowed by the more
//    general PROPOSITION check below.
const ABSENCE_PATTERNS = [
    { re: /\bthere\s+(?:is|are|was|were)\s+not?\s+no\b/i, label: 'double-negative existential (unusual but structurally absence)' },
    { re: /\bthere\s+(?:is|are|was|were)\s+no\b/i, label: 'existential construction "there is/are/was/were no ..."' },
    { re: /\bthere\s+(?:is|are)\s+not\b/i, label: 'existential negation "there is/are not ..."' },
    { re: /\bdoes\s+not\s+exist\b/i, label: '"does not exist"' },
    { re: /\bdo\s+not\s+exist\b/i, label: '"do not exist"' },
    { re: /\bno\s+[a-z][a-z\s'-]{0,40}?\bexists?\b/i, label: '"no <span> exist(s)"' },
];
// ── DEFINITION-STATEMENT: a clause opening with a small closed set of definitional reporting verbs.
//    Checked before the general finite-verb/PROPOSITION check, mirroring aspect_tag.ts's discipline
//    of stripping/recognizing a shared leading frame before classifying further.
const DEFINITION_LEAD_RE = /^It\s+(?:describes|refers\s+to|denotes|means|represents|indicates|explains)\b/i;
// ── finite-verb closed class: the English copula and auxiliary/modal system. Purely grammatical,
//    purely closed-class -- see file header. Matched as whole words only.
const COPULAS = ['is', 'are', 'was', 'were', 'am', 'be', 'been', 'being'];
const AUXILIARIES_MODALS = [
    'has', 'have', 'had', 'does', 'do', 'did',
    'will', 'would', 'can', 'could', 'shall', 'should', 'may', 'might', 'must',
];
const FINITE_VERB_MARKERS = [...COPULAS, ...AUXILIARIES_MODALS];
function wordBoundaryAny(text, words) {
    for (const w of words) {
        const re = new RegExp(`\\b${w}\\b`, 'i');
        if (re.test(text))
            return w;
    }
    return null;
}
// ── PROPERTY: a small closed set of abstract-attribute head nouns -- "an attribute rather than an
//    entity" (canon). Generic English measure/attribute nouns, the same style as aspect_tag.ts's
//    ACTIVITY_HEADS (process/method/procedure/action/technique/practice): a curated closed list
//    naming a GRAMMATICAL/SEMANTIC CATEGORY of noun, not a subject-matter term.
const PROPERTY_HEADS = [
    'lack', 'presence', 'absence', 'degree', 'level', 'rate', 'amount', 'extent',
    'tendency', 'likelihood', 'probability', 'ability', 'capacity', 'quality',
    'characteristic', 'property', 'feature', 'influence', 'effect', 'proportion',
    'frequency', 'magnitude',
];
// ── QUANTITY: a numeral, or a small closed set of unit abbreviations. Structural, not topical --
//    units of measurement are a closed grammatical/notational class, universal across subjects.
const HAS_DIGIT_RE = /\d/;
const UNIT_RE = /\b(?:kg|g|mg|km|m|cm|mm|ml|l|kb|mb|gb|hz|khz|mhz|ghz|mph|kmh|%|°c|°f|percent|percentage)\b/i;
// ── compound multi-part answer: two or more lettered sub-clauses ("a) ... b) ... c) ..."). This is
//    a real recognizable shape that does not fit any of the six proposed types -- it is a LIST of
//    answers bundled into one option string, not a single kind. Reported as unrecognized per R-3,
//    and named in this ticket's return as a candidate for a new type.
const LETTERED_SUBCLAUSE_RE = /(?:^|[,;.\s])([a-j])\)\s/gi;
function countLetteredSubclauses(text) {
    const matches = text.match(LETTERED_SUBCLAUSE_RE);
    return matches ? matches.length : 0;
}
/**
 * E-KIND-CHECK. Classifies `text` into the canon's finite, PROPOSED type set, or returns
 * `type: null` ("unrecognized") when no structural rule fits. Pure, mechanical, grammatical-signal
 * only -- see file header for the full discipline and declared limitations.
 *
 * Order of checks (most specific / most load-bearing first, mirroring aspect_tag.ts's tagAspect()
 * ordered-rule discipline):
 *   1. empty/whitespace-only text -> unrecognized
 *   2. compound multi-part lettered-list shape -> unrecognized (candidate new type)
 *   3. existential-negation construction -> ABSENCE-CLAIM (a PROPOSITION subtype, reported as its
 *      own type per canon)
 *   4. leading definitional reporting verb ("It describes/refers to/...") -> DEFINITION-STATEMENT
 *   5. any closed-class finite-verb marker present -> PROPOSITION
 *   6. no finite-verb marker -- bare-phrase branch:
 *      6a. numeral or unit present -> QUANTITY
 *      6b. head noun in the PROPERTY_HEADS closed list -> PROPERTY
 *      6c. otherwise -> THING (bare noun phrase, no predicate found)
 */
export function checkKind(text) {
    const t = String(text ?? '').trim();
    if (t.length === 0) {
        return { type: null, why: 'unrecognized: empty or whitespace-only text -- nothing to classify' };
    }
    const subclauseCount = countLetteredSubclauses(t);
    if (subclauseCount >= 2) {
        return {
            type: null,
            why: `unrecognized: ${subclauseCount} lettered sub-clauses found (e.g. "a) ... b) ...") -- this `
                + 'is a compound multi-part answer, a LIST of sub-answers bundled into one option string, not '
                + 'a single kind. Not one of the six proposed types; per canon R-3 this is reported as '
                + 'unrecognized rather than coerced, and is a candidate for a new named type.',
        };
    }
    for (const { re, label } of ABSENCE_PATTERNS) {
        const m = re.exec(t);
        if (m) {
            return {
                type: 'ABSENCE-CLAIM',
                why: `matched ${label} ("${m[0].trim()}") -- a PROPOSITION whose content is that something `
                    + 'does not exist; reported as its own subtype per canon because it is the shape that '
                    + 'defeats one-for-one substitution',
            };
        }
    }
    if (DEFINITION_LEAD_RE.test(t)) {
        const m = DEFINITION_LEAD_RE.exec(t);
        return {
            type: 'DEFINITION-STATEMENT',
            why: `leading definitional reporting verb "${m ? m[0].trim() : 'It describes/refers to'}" -- a `
                + 'clause stating what a term means',
        };
    }
    const verbMarker = wordBoundaryAny(t, FINITE_VERB_MARKERS);
    if (verbMarker) {
        return {
            type: 'PROPOSITION',
            why: `finite-verb marker "${verbMarker}" found (closed-class copula/auxiliary/modal) -- a full `
                + 'clause asserting something',
        };
    }
    // Bare-phrase branch: no finite-verb marker found.
    if (HAS_DIGIT_RE.test(t) || UNIT_RE.test(t)) {
        const unitMatch = UNIT_RE.exec(t);
        return {
            type: 'QUANTITY',
            why: HAS_DIGIT_RE.test(t)
                ? 'contains a numeral, no finite-verb marker found -- a number or rate'
                : `contains unit token "${unitMatch ? unitMatch[0] : '?'}", no finite-verb marker found -- a number or rate`,
        };
    }
    const headMatch = /^(?:(?:a|an|the)\s+)?([a-z]+)/i.exec(t);
    const head = headMatch ? headMatch[1].toLowerCase() : null;
    if (head && PROPERTY_HEADS.includes(head)) {
        return {
            type: 'PROPERTY',
            why: `head noun "${head}" is a closed-class abstract-attribute noun, no finite-verb marker `
                + 'found -- an attribute rather than an entity',
        };
    }
    return {
        type: 'THING',
        why: `no finite-verb marker, no numeral/unit, no property head noun -- a bare noun phrase naming `
            + `an entity, head "${head ?? '?'}"`,
    };
}
/** Convenience: kind-checks every option in a set, in letter order. Still pure -- loops checkKind()
 *  once per option. */
export function checkKindForAllOptions(options) {
    const out = {};
    for (const [letter, text] of Object.entries(options)) {
        out[letter] = checkKind(text);
    }
    return out;
}
