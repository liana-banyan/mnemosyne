// option_membership.ts -- D-BP154-010/BISHOP/S10/seg-thepail -- THE HOLE IN THE PAIL, CLOSED AT
// THE CAPTURE HOP.
//
// BP154_LOSSY_HOP_AUDIT.md, SILENT #1: webview_preload.ts's looksLikeUiChrome() is a 5-regex
// DENYLIST built reactively, one observed chrome string at a time -- it only ever closes gaps
// AFTER they have already cost a session. This exact string passed it and was recorded as a real
// answer to an MC question:
//
//   "Thinking Your lianabanyan.com chats aren't used to improve our models. Gemini is AI and can
//    make mistakes. Your privacy & Gemini Opens in a new window"
//
// THE_PAIL_BP154.md's own instruction: "The estate already ratified the predicate that kills it
// (D-BP153-016 FIX 3): a passage naming none of the question's options cannot source a claim
// about them. Apply that at the CAPTURE hop, where the loss happens -- not three hops downstream
// where D-BP154-001 currently catches it."
//
// A POSITIVE test, not a negative one: instead of growing the denylist for the sixth, seventh,
// Nth chrome string nobody has observed yet, a captured passage must POSITIVELY mention at least
// one of the question's own options before it is trusted as an answer -- when the question HAS
// options at all (mcOptions undefined/empty means a free-text query, where this gate does not
// apply and never rejects anything, exactly as before this ticket).
//
// WHY THIS IS ITS OWN FILE, NOT A FEW LINES INSIDE webview_preload.ts. webview_preload.ts imports
// `electron` (`ipcRenderer`) at module top level and runs `ipcRenderer.on(...)` at module scope --
// it cannot be imported under vitest at all (the real 'electron' npm package resolves to a path
// STRING outside a running Electron process, not the API; `ipcRenderer` would be `undefined` and
// the top-level `.on()` call would throw before a single test file finished importing it). Pulling
// this one pure predicate out into its own DOM-free, Electron-free module is what makes it
// unit-testable -- see option_membership.test.ts's own header for the measured proof (fail before
// this file existed, pass after).
//
// WHY REIMPLEMENTED, NOT IMPORTED FROM comparative_cascade.ts. That file's own norm()/appearsIn()
// (methods/comparative_cascade.ts:92-99) do exactly this normalization+substring check already,
// but comparative_cascade.ts is FORBIDDEN to modify by this ticket's own hard boundaries, and it
// is a different module graph entirely (Node `fetch`, Ollama calls, a long chain of liana_cycle
// imports) that a webview preload bundle has no business pulling in for four lines of pure string
// logic. The two are DELIBERATELY byte-identical in behavior (same normalize-then-substring
// recipe, same length-3 minimum-needle guard) so the same "presence is not assertion, but presence
// of nothing is certainly not assertion either" rule holds on both sides of the capture boundary --
// drift between them would be a real risk, so this file states the recipe here rather than
// silently assuming it stays in sync.

/** Lowercase, strip everything but alphanumerics and spaces, collapse whitespace, trim. The exact
 *  recipe comparative_cascade.ts's own `norm()` uses (see this file's header) -- deliberately
 *  reimplemented, not imported. */
function normalizeForOptionMatch(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

/** Strips a leading "A) " / "1) " style letter-or-number prefix, when present -- `mcOptions`
 *  entries arrive pre-formatted as "L) option text" (comparative_cascade.ts's own `list()`,
 *  browser_authority_types.ts's `buildMcAwareQueryText`), and the LABEL PREFIX itself is never
 *  what a real answer restates; only the option's own text is. Leaving the prefix in would make
 *  every needle fail to match a genuine answer that (correctly) never writes "a) " literally. */
function stripOptionLabelPrefix(option: string): string {
  return option.replace(/^\s*[A-Za-z0-9]+\)\s*/, '');
}

/**
 * True when `text` mentions at least one of the question's own options (substring match over
 * normalized text, mirroring comparative_cascade.ts's `appearsIn()` exactly -- see this file's
 * header). An option whose normalized text is under 3 characters is never used as a needle (same
 * guard `appearsIn()` itself uses, to avoid a single letter or digit matching almost anything).
 *
 * `mcOptions` undefined or empty means "this query had no lettered options" (a free-text
 * question) -- the gate does not apply and this always returns true, so a caller can unconditionally
 * gate a capture on this function's result without breaking every non-MC query.
 *
 * Empty or whitespace-only `text` is never a match, regardless of options -- there is nothing to
 * mention anything in.
 */
export function mentionsAnyOption(text: string, mcOptions: string[] | undefined): boolean {
  if (!mcOptions || mcOptions.length === 0) return true;
  const t = text.trim();
  if (!t) return false;
  const hay = normalizeForOptionMatch(t);
  if (!hay) return false;
  return mcOptions.some((opt) => {
    const needle = normalizeForOptionMatch(stripOptionLabelPrefix(opt));
    return needle.length >= 3 && hay.includes(needle);
  });
}
