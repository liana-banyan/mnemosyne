// enroll_ui_text.ts -- D-BP223-X044-020 (0.9.40). Every sentence the Founder-only enrollment screen
// shows, as pure functions so the wording rules are tested (no em or en dashes, the locked state is
// clean). Founder ruling 2026-09-28 (PQ008, item 1): the Settings enrollment screen ships FOUNDER ONLY
// and labelled so. It verifies only through founder-code-verify (the Founder's authenticator seed,
// held server side). Anyone else sees the label and nothing happens.

export const ENROLL_TITLE = 'Enroll the Founder\'s machines';

export const FOUNDER_ONLY_LABEL =
  'Founder only: enroll the Founder\'s machines. Member enrollment is coming.';

export const FOUNDER_ONLY_DETAIL =
  'Enrollment is checked only against the Founder\'s authenticator code, on the Liana Banyan server. ' +
  'If you are not the Founder there is nothing to do here, and nothing on this screen changes your machine.';

export const OPEN_BUTTON = 'I am the Founder: open enrollment';

export const LOCKED_TEXT =
  'Enrollment is locked for now: too many wrong authenticator codes were tried. ' +
  'The lock starts at 15 minutes and doubles each time it trips. Wait, then try again. Nothing was written.';

export const REFUSED_TEXT =
  'Not enrolled. That authenticator code was not accepted, and only the Founder\'s code can enroll a machine. Nothing was written.';

/** Replace any long dash that arrives from main with a comma, so no screen text carries one. */
export function noLongDashes(s: string): string {
  return String(s).replace(/\s*[\u2013\u2014]\s*/g, ', ');
}

export type EnrollOutcome = { kind: 'enrolled' | 'locked' | 'refused' | 'error'; text: string };

/** Turns the enroll:submit reply into the one sentence the screen shows. */
export function describeEnrollResult(r: { ok?: boolean; peerId?: string; label?: string; error?: string } | null | undefined): EnrollOutcome {
  if (r?.ok) {
    return {
      kind: 'enrolled',
      text: noLongDashes(`Enrolled ${r.label || 'machine'} (${r.peerId ?? ''}). Now do the same on that machine with this machine's code.`),
    };
  }
  const err = String(r?.error ?? '');
  // founder-code-verify answers a locked caller with one fixed reason ("locked: too many recent
  // failed attempts. Try again later."), which enroll_by_code.ts wraps as "authenticator code refused: ...".
  if (/\blocked\b/i.test(err)) return { kind: 'locked', text: LOCKED_TEXT };
  if (/authenticator code refused/i.test(err)) return { kind: 'refused', text: REFUSED_TEXT };
  if (!err) return { kind: 'error', text: 'No answer from the app. Nothing was written.' };
  return { kind: 'error', text: noLongDashes(`Not enrolled: ${err}. Nothing was written.`) };
}
