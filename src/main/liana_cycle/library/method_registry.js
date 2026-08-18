// method_registry.ts -- D-BP152-049/BISHOP/seg-unify-registry-and-fixes, STAGE 4/4
//
// RE-EXPORT SHIM. Founder, BP152, verbatim: "I want the three cascades' run() functions
// resolved, don't I? But they need to be in one place, right? Advise and if that is correct,
// then do." Bishop advised yes; ruled to do it.
//
// The NameNumbered declaration registry that used to live in THIS file (RegisteredMethod,
// registerNameNumbered, lookupById, listAllEntries, listIterationsOfName, latestNumberOfName,
// registerKnownMethods, and the four cascade/Survey StepDeclaration consts -- D-BP152-040) now
// lives in ../method_registry.ts, alongside the PRE-EXISTING executable registry (LianaMethod,
// registerMethod, selectMethod, listMethods, explainSelection -- D-BP149-041) it was always
// meant to sit next to. ONE file now holds BOTH the NameNumbered declaration and the executable
// run() resolution -- see that file's own "D-BP152-049 STAGE 4/4" section for the full account
// of what moved, and why nothing about EITHER registry's behavior changed in the move.
//
// THIS FILE REMAINS ONLY AS A PURE RE-EXPORT, because roughly a dozen call sites
// (script_bridge.ts, survey_steps.ts, state_the_question_step.ts, and their test files) import
// by the specifier './method_registry' relative to THIS directory (library/). Editing every one
// of them to point at '../method_registry' instead would touch files this ticket has no
// functional reason to touch, for zero behavioral gain -- the re-export below makes both
// specifiers ('./method_registry' from here, '../method_registry' from liana_cycle/) resolve to
// the EXACT SAME live Map/functions. No logic, no second copy of any function: exactly one
// implementation to reason about, reachable by either path. Every existing caller was found
// (search repo-wide for both `from '../method_registry'` and `from './method_registry'` relative
// to library/, corroborated by a second search for `registerNameNumbered|listAllEntries|
// lookupById|registerKnownMethods|listIterationsOfName|latestNumberOfName` -- see this ticket's
// own SEG return for the full list) and every one of them still resolves, unedited, through this
// shim.
export * from '../method_registry';
