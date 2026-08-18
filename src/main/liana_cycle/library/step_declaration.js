// step_declaration.ts -- D-BP152-018/BISHOP/seg-register-orphan-steps
//
// THE STEP DECLARATION SHAPE. Spec:
//   LianaBanyanPlatform\BISHOP_DROPZONE\LIANA_CYCLE_BENCH_SPEC.md section 3.3.
//
// Section 3.3, verbatim requirement: "a step needs at minimum: an id (and, per §4.2, a
// version, e.g. `19:1`); its inputs (what state it reads); its outputs (what state it
// writes); its query text, if it issues one, as an editable field...; and its attribution --
// per HARDWIRE-23, every decision rule a step contains must carry either
// `ATTRIBUTED: Founder, BP<NNN>, verbatim: "..."` or `TARE: no Founder order, awaiting
// ruling` at the site of the rule."
//
// This module is the SEED of spec item 2 (section 9: "Build the Library as a data structure"),
// authorized narrowly by D-BP152-018 for item 1 only (register the orphaned elements/ exports
// as declared steps). Bishop, verbatim, on the authorization: "BECAUSE THERE IS NOWHERE TO
// REGISTER INTO YET, you must create the minimal registry structure to hold them... a typed
// declaration shape plus a catalog listing the verified entries. That is the seed of spec
// item 2, deliberately, and it is the smallest thing that makes item 1 possible."
//
// INERT BY DESIGN. This module holds only type definitions -- no runtime logic, no import of
// any elements/ file, nothing that could execute a registered step. Making a declared step
// actually callable is spec item 12 ("the typed/pulled-entry override execution path"),
// explicitly BLOCKED on the Founder's confirmation of what "typed" may lawfully mean under
// HARDWIRE-22, and is out of this ticket's boundary -- see orphan_catalog.ts's header for the
// full boundary statement.
export {};
