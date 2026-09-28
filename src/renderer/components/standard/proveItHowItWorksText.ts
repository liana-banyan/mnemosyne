// proveItHowItWorksText.ts -- D-BP223-BM04-X033S3-009 STEP 2
//
// Spec Section 2 text, VERBATIM, in one constant so a future Founder cut is a one-line swap (his
// cut is pending -- spec Section 15, "STILL HIS: R6 the Section 2 proof text"). Source:
// BISHOP_DROPZONE\D-BP223-BM04-X033S3-003-PROVE-IT-OOMPH\SPEC_PROVE_IT_SOMEBODY_ELSE_ASKED.md,
// Section 2, copied character-for-character including its own parenthetical closing note. NEVER
// edit this string inline in the component -- edit it here, in one place, per the brief's rule.

export const PROVEIT_HOW_IT_WORKS_TITLE = 'How this works, in one example';

export const PROVEIT_HOW_IT_WORKS_TEXT = `First ask. Jonathan types "How many moons does Jupiter have, and what are their names?", picks Astronomy, picks Claude. Claude opens in the window he is already signed in to, answers, and the answer comes back with the two pages it cited. One model call, on his own account. MnemosyneC writes a card: the question, the answer, the sources, who asked (his member stamp), which AI answered, and the date. He presses Add to the Substrate.

Second ask, by somebody else. You open Prove It on your machine. Under "Use a question somebody else asked" you see his Jupiter question. You press Ask this one. The ticker shows the lookup by address, the card read, and the meter: model calls 0, cost $0.00. You get the same answer, the same sources, in a few milliseconds, and you can click the provenance chain all the way down: who asked, which AI, which pages, when.

Why the date is on the card. Jupiter's moon count is not a constant. It was 79, then 92, then 95, then 97 as new ones were confirmed. A card that says "97, as of 2026-09-20, source: [page]" is true forever; a bare "97" stops being true the day the next moon is confirmed. Every card carries the date it was made and a validity window (a year for this kind of fact; a day for a stock price; forever for "what year did the Berlin Wall fall"). When a card is past its window, the screen says so and offers to re-ask, and the new card supersedes the old one in the chain, it never erases it.

Why the card is attributed. The person who asked did the work: they chose a good question, they paid for the model call in their own account, they put it where everyone can reach it. The stamp is how the substrate remembers that, how votes reach them, and how a wrong answer can be traced and challenged by appending a better source rather than by deleting anything. Members stamp with their member key. Non-members attribute by email magic link: attributed, not sealed.

Why this is the proof. You did not ask Jupiter; he did. You did not call a model; nobody did, the second time. You paid nothing. The card came from the address, not from a search, which is why it cost the same as it would in a store five thousand times bigger than the largest AI can hold at once (67 of 67, 50 tokens each, the receipt is public). Asked once, by anyone. One of us = all of us.`;

// (Numbers in the moon paragraph are illustrative for the copy; the builder puts the count the
// answering AI actually returned on the day the example card is minted, with its source, and
// nothing else. No invented facts on the proof page.) -- spec Section 2's own closing note, kept
// here as a comment (not rendered) so the instruction travels with the text it governs.
