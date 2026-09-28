// share_cards_ui_logic.ts -- D-BP223-X043-002-D (SEG X043-002-D, MnemosyneC 0.9.40)
//
// Founder ruling: "the two machines sharing a card" is one of the realest proofs, so a normal person
// must be able to share a card and accept or refuse an offered card from the app, not only through
// MCP or IPC. This file is the PURE half of ShareCardsPanel.tsx: every sentence a person reads about a
// share result, a peer, or an offered card is decided here, so it can be tested without a DOM (this
// repo has no jsdom or testing-library; see proveit_ui_logic.ts for the same split).
//
// Nothing here decides consent. The four consents live in main (share_receive_consent.ts and
// hollerith_library_share.ts); this file only turns their answers into plain words.
// House rule: no em dashes and no en dashes in any text a person reads (see noLongDashes).

export interface PeerLike {
  id: string;
  name?: string;
  address?: string;
  online?: boolean;
  public_key_hex?: string;
  thorax_announce_status?: string;
}

export interface PushResultLike {
  action: string;
  reason?: string;
  error?: string;
  receiverPeerId: string | null;
  receiverKeyTrust?: string;
  sharePolicy?: string | null;
  connector: string | null;
  file: string | null;
  sha256: string | null;
  receiptVerified: boolean;
  httpStatus: number | null;
  receiptPath?: string | null;
}

export interface HeldOfferLike {
  senderPeerId: string;
  file: string;
  connector: string;
  sha256: string;
  trust: string;
  policy: string;
  receivedUtc: string;
  sourceStatus: string;
  title: string;
}

export type Tone = 'good' | 'waiting' | 'refused' | 'error';

export interface PlainResult {
  tone: Tone;
  headline: string;
  detail: string;
  receiptLine: string;
}

/** Turns anything unknown from main into a peer we can show, or null when it has no id. */
export function toPeer(raw: unknown): PeerLike | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string' || !r.id.trim()) return null;
  return {
    id: r.id,
    name: typeof r.name === 'string' ? r.name : undefined,
    address: typeof r.address === 'string' ? r.address : undefined,
    online: typeof r.online === 'boolean' ? r.online : undefined,
    public_key_hex: typeof r.public_key_hex === 'string' ? r.public_key_hex : undefined,
    thorax_announce_status: typeof r.thorax_announce_status === 'string' ? r.thorax_announce_status : undefined,
  };
}

export function peerLabel(p: PeerLike): string {
  const name = (p.name ?? '').trim();
  return name && name !== p.id ? `${name} (${p.id})` : p.id;
}

export function peerStatusWords(p: PeerLike): string {
  const parts: string[] = [];
  parts.push(p.online === true ? 'online' : p.online === false ? 'last seen offline' : 'status unknown');
  if (p.thorax_announce_status === 'verified') parts.push('signed in to the mesh');
  if (p.address) parts.push(p.address);
  return parts.join(', ');
}

/** First 12 and last 4 characters of a hash, so a person can match it by eye; the full hash is shown on hover and in the report. */
export function shortHash(h: string | null | undefined): string {
  if (!h) return 'none';
  return h.length <= 20 ? h : `${h.slice(0, 12)}...${h.slice(-4)}`;
}

/** The result of "Share with a peer", in plain words. Mirrors OfferAction in hollerith_library_share.ts, plus 'error'. */
export function describePushResult(r: PushResultLike, peerName: string): PlainResult {
  const receiptLine = r.receiptVerified
    ? `${peerName} signed a receipt for this, and this computer checked the signature.`
    : 'The receipt could not be checked, so treat this result as not confirmed.';
  switch (r.action) {
    case 'written':
      return { tone: 'good', headline: `Shared. The card is now on ${peerName}.`, detail: 'It landed right away because that machine accepts cards from you without asking.', receiptLine };
    case 'replaced_with_superseded_sibling':
      return { tone: 'good', headline: `Shared. The card on ${peerName} was updated.`, detail: 'Their older copy was kept beside it, not deleted.', receiptLine };
    case 'already_present':
      return { tone: 'good', headline: `${peerName} already has this exact card.`, detail: 'Nothing changed on their machine.', receiptLine };
    case 'held_for_consent':
      return { tone: 'waiting', headline: `Waiting for ${peerName} to accept.`, detail: 'The card is in their "Cards offered to me" list. Nothing lands until a person on that machine presses Accept.', receiptLine };
    case 'refused':
      return { tone: 'refused', headline: `${peerName} refused the card.`, detail: `Nothing was kept on their machine.${r.reason ? ' Reason given: ' + cleanReason(r.reason) : ''}`, receiptLine };
    default:
      return {
        tone: 'error',
        headline: 'The share did not finish.',
        detail: cleanReason(r.error ?? r.reason ?? 'No answer came back from the other machine.'),
        receiptLine: r.receiptVerified ? receiptLine : 'No signed receipt came back.',
      };
  }
}

/** Main-side reasons are written for engineers; keep them, but strip any long dash so the house rule holds. */
export function cleanReason(s: string): string {
  return s.replace(/\s*[\u2013\u2014]\s*/g, ', ').trim();
}

export function describeAcceptResult(r: { ok: boolean; action?: string; reason?: string }): string {
  if (!r.ok) return `Could not accept: ${cleanReason(r.reason ?? 'unknown reason')}`;
  if (r.action === 'already_present') return 'Accepted. You already had this exact card, so nothing changed.';
  if (r.action === 'replaced_with_superseded_sibling') return 'Accepted. Your older copy was kept beside the new one.';
  return 'Accepted. The card is now in your library.';
}

export function describeRefuseResult(r: { ok: boolean; reason?: string }): string {
  return r.ok ? 'Refused. The offered card was removed and nothing was kept.' : `Could not refuse: ${cleanReason(r.reason ?? 'unknown reason')}`;
}

export function trustWords(trust: string): string {
  if (trust === 'enrolled') return 'a machine you enrolled';
  if (trust === 'known') return 'a machine seen on your network';
  return 'an unknown machine';
}

export function sourceWords(status: string): string {
  if (status === 'sourced') return 'has a checkable source';
  if (status === 'source_pending') return 'source pending';
  return 'no source listed';
}

export type AcceptFrom = 'same_owner' | 'enrolled';

export const ACCEPT_FROM_CHOICES: ReadonlyArray<{ value: AcceptFrom; label: string; help: string }> = [
  { value: 'same_owner', label: 'Only my own machines', help: 'Cards from your own machines land by themselves. Cards from anyone else wait here until you press Accept.' },
  { value: 'enrolled', label: 'Any machine I have enrolled', help: 'Cards from every machine you enrolled land by themselves. Unknown machines are still refused.' },
];

/** The refusal of strangers is fixed in main and cannot be changed here; this line says so, every time. */
export const STRANGERS_LINE = 'Cards from unknown machines are always refused, and nothing from them is kept.';

/** House rule check used by the tests: no em dash, no en dash. */
export function noLongDashes(text: string): boolean {
  return !/[\u2013\u2014]/.test(text);
}
