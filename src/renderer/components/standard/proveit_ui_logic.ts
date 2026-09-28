// proveit_ui_logic.ts -- D-BP223-BM04-X033S3-009 STEP 2/3
//
// Pure, framework-free UI logic pulled OUT of ProveItWorksTab.tsx so it is directly unit-testable
// under vitest without a DOM (this repo has no @testing-library/react or jsdom/happy-dom in
// package.json, and the brief forbids any package.json change -- see REPORT.md). Two rules live
// here: region D's gray/un-gray gate (spec Section 5) and the by-hand "pasting completes the
// card" rule (spec Section 4, "no second Ask").

/** Region D ("Use a question somebody else asked") is grayed until the asking install has
 *  published at least one card of its own (spec Section 5). Trivial today, but named and tested
 *  on its own so the rule is documented and cannot silently drift as the component grows. */
export function isRegionDUnlocked(hasPublishedOwnCard: boolean): boolean {
  return hasPublishedOwnCard === true;
}

/** Spec Section 4: "pasting INTO the card's answer box IS the completion ... No second Ask."
 *  Fires once non-whitespace text is present and it differs from whatever was already there
 *  (so a paste of the exact same text twice, e.g. a re-render, does not re-fire). */
export function shouldCompleteFromPaste(previousText: string, nextText: string): boolean {
  const trimmedNext = nextText.trim();
  if (trimmedNext.length === 0) return false;
  return trimmedNext !== previousText.trim();
}

/** Region D's client-side category filter (the IPC call already filters server-side; this is the
 *  same rule, exported so the "All categories" control's behavior is independently testable). */
export function filterByCategory<T extends { category: string }>(cards: T[], category: string | 'all'): T[] {
  if (category === 'all') return cards;
  return cards.filter((c) => c.category === category);
}

/** The one-time highlight rule (spec Section 5: "region D un-grays with a one-time highlight"):
 *  fires exactly on the false -> true transition of `unlocked`, never on mount already-unlocked
 *  (a returning member should not see the highlight fire every time they open the tab) and never
 *  again after it has fired once for this component lifetime. */
export function shouldShowUnlockHighlight(wasUnlocked: boolean, isUnlocked: boolean, alreadyShown: boolean): boolean {
  return !alreadyShown && !wasUnlocked && isUnlocked;
}
