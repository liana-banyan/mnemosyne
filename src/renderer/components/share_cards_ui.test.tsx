// share_cards_ui.test.tsx -- D-BP223-X043-002-D
//
// This repo has no jsdom or testing-library (see standard/proveit_ui_logic.test.ts), so: (1) the pure
// wording rules in share_cards_ui_logic.ts are tested directly, and (2) the presentational pieces of
// ShareCardsPanel.tsx are rendered to static HTML with react-dom/server (already a dependency) and the
// markup is checked for the buttons, the sender, title, source and hash, and the no-long-dash rule.
// The main-side listing helper (share:list-my-cards) is tested with an injected index builder.

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import {
  ACCEPT_FROM_CHOICES, STRANGERS_LINE, cleanReason, describeAcceptResult, describePushResult, describeRefuseResult,
  noLongDashes, peerLabel, shortHash, toPeer, type PushResultLike,
} from './share_cards_ui_logic';
import { AcceptFromChooser, MyCardRow, OfferedCardRow, PeerPicker, PushResultView } from './ShareCardsPanel';
import { listMyShareableCards } from '../../main/federation/share_receive_consent';

const HASH = '68b2d7a61ce9203c' + '0'.repeat(44) + 'abcd';
const base: PushResultLike = { action: 'written', receiverPeerId: 'M2', connector: '0f818d9289bb3930682e4de769441d49', file: 'q.eblet.md', sha256: HASH, receiptVerified: true, httpStatus: 200 };
const noop = () => undefined;
const stripTags = (html: string) => html.replace(/<[^>]+>/g, ' ');

describe('describePushResult: every receiver outcome in plain words', () => {
  it('landed', () => {
    const r = describePushResult(base, 'M2');
    expect(r.tone).toBe('good');
    expect(r.headline).toBe('Shared. The card is now on M2.');
    expect(r.receiptLine).toContain('checked the signature');
  });
  it('already there', () => expect(describePushResult({ ...base, action: 'already_present' }, 'M2').headline).toContain('already has this exact card'));
  it('replaced keeps the older copy', () => expect(describePushResult({ ...base, action: 'replaced_with_superseded_sibling' }, 'M2').detail).toContain('kept beside it'));
  it('held in their inbox', () => {
    const r = describePushResult({ ...base, action: 'held_for_consent', httpStatus: 202 }, 'M2');
    expect(r.tone).toBe('waiting');
    expect(r.detail).toContain('Nothing lands until a person on that machine presses Accept');
  });
  it('refused, with the reason and nothing kept', () => {
    const r = describePushResult({ ...base, action: 'refused', httpStatus: 403, reason: 'self-declared key' }, 'M2');
    expect(r.tone).toBe('refused');
    expect(r.detail).toContain('Nothing was kept');
    expect(r.detail).toContain('self-declared key');
  });
  it('an unverified receipt is called not confirmed', () => {
    expect(describePushResult({ ...base, receiptVerified: false }, 'M2').receiptLine).toContain('not confirmed');
  });
  it('error', () => {
    const r = describePushResult({ ...base, action: 'error', error: 'peer "x" is not among this node\u2019s saved peers \u2014 pass peerBaseUrl', receiptVerified: false }, 'M2');
    expect(r.tone).toBe('error');
    expect(noLongDashes(r.detail)).toBe(true);
    expect(r.receiptLine).toBe('No signed receipt came back.');
  });
});

describe('small helpers', () => {
  it('cleanReason strips em and en dashes', () => expect(cleanReason('a \u2014 b \u2013 c')).toBe('a, b, c'));
  it('shortHash', () => { expect(shortHash(HASH)).toBe('68b2d7a61ce9...abcd'); expect(shortHash(null)).toBe('none'); });
  it('toPeer drops junk and keeps id, name, address', () => {
    expect(toPeer(null)).toBeNull();
    expect(toPeer({ name: 'no id' })).toBeNull();
    const p = toPeer({ id: 'm2-id', name: 'M2', address: '192.168.86.45:7474', online: true });
    expect(p && peerLabel(p)).toBe('M2 (m2-id)');
  });
  it('accept and refuse messages', () => {
    expect(describeAcceptResult({ ok: true, action: 'written' })).toBe('Accepted. The card is now in your library.');
    expect(describeAcceptResult({ ok: false, reason: 'no such held offer' })).toContain('Could not accept');
    expect(describeRefuseResult({ ok: true })).toContain('nothing was kept');
  });
  it('the setting offers exactly the two values main accepts, never strangers', () => {
    expect(ACCEPT_FROM_CHOICES.map((c) => c.value)).toEqual(['same_owner', 'enrolled']);
    expect(STRANGERS_LINE).toContain('always refused');
  });
});

describe('rendered pieces', () => {
  const card = { connector: base.connector!, file: 'q.eblet.md', title: 'Why the sky is blue', sha256: HASH, qid: 1029, sourceStatus: 'sourced', sourceLabel: null };
  const offer = { senderPeerId: 'M0-peer', file: 'q.eblet.md', connector: base.connector!, sha256: HASH, trust: 'enrolled', policy: 'other_owner', receivedUtc: '2026-09-27T23:00:00.000Z', sourceStatus: 'sourced', title: 'Why the sky is blue' };

  it('a card row has the Share with a peer button, and the picker lists peers', () => {
    const html = renderToStaticMarkup(
      <MyCardRow card={card} open busy={false} peers={[{ id: 'm2-id', name: 'M2', online: true }]} result={null} onOpen={noop} onPick={noop} onCancel={noop} onRefresh={noop} />,
    );
    expect(html).toContain('Share with a peer');
    expect(html).toContain('Why the sky is blue');
    expect(html).toContain('M2 (m2-id)');
    expect(html).toContain('Look again');
  });
  it('an empty picker says what to do', () => {
    expect(renderToStaticMarkup(<PeerPicker peers={[]} busy={false} onPick={noop} onCancel={noop} />)).toContain('No other machines have been found yet');
  });
  it('the receipt view shows the plain result and the full hash', () => {
    const html = renderToStaticMarkup(<PushResultView result={{ peerName: 'M2', plain: describePushResult({ ...base, action: 'held_for_consent' }, 'M2'), sha256: HASH, receiptPath: 'C:\\x\\sent.jsonl' }} />);
    expect(html).toContain('Waiting for M2 to accept.');
    expect(html).toContain(HASH);
  });
  it('an offered card shows sender, title, source, hash, and Accept and Refuse', () => {
    const html = renderToStaticMarkup(<OfferedCardRow offer={offer} busy={false} message={null} onAccept={noop} onRefuse={noop} />);
    for (const t of ['Accept', 'Refuse', 'M0-peer', 'Why the sky is blue', 'has a checkable source', HASH, 'a machine you enrolled']) expect(html).toContain(t);
  });
  it('the accept-from chooser marks the current choice and states the stranger rule', () => {
    const html = renderToStaticMarkup(<AcceptFromChooser value="same_owner" allowPeers={[]} busy={false} onChange={noop} />);
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('Only my own machines');
    expect(html).toContain(STRANGERS_LINE);
  });
  it('no em or en dash in any rendered text', () => {
    const all = [
      renderToStaticMarkup(<MyCardRow card={{ ...card, sourceStatus: 'source_pending' }} open busy peers={[]} result={{ peerName: 'M2', plain: describePushResult({ ...base, action: 'refused', reason: 'x' }, 'M2'), sha256: HASH, receiptPath: null }} onOpen={noop} onPick={noop} onCancel={noop} onRefresh={noop} />),
      renderToStaticMarkup(<OfferedCardRow offer={offer} busy message="Accepted. The card is now in your library." onAccept={noop} onRefuse={noop} />),
      renderToStaticMarkup(<AcceptFromChooser value="enrolled" allowPeers={['p1']} busy={false} onChange={noop} />),
    ];
    for (const h of all) expect(noLongDashes(stripTags(h))).toBe(true);
    for (const c of ACCEPT_FROM_CHOICES) expect(noLongDashes(c.label + c.help)).toBe(true);
  });
});

describe('listMyShareableCards (main side of share:list-my-cards)', () => {
  it('lists sourced and source-pending cards, leaves out support files, counts the rest', () => {
    const mk = (connector: string, sourceStatus: string) => ({ connector, file: connector + '.eblet.md', title: 't' + connector, sha256: 'h', qid: null, sourceStatus, sourceLabel: null });
    const out = listMyShareableCards('X', (dir) => {
      expect(dir).toBe('X');
      return { connectors: [mk('a', 'sourced'), mk('b', 'source_pending'), mk('c', 'not_a_card')], skipped: [{}, {}] };
    });
    expect(out.cards.map((c) => c.connector)).toEqual(['a', 'b']);
    expect(out.notShareableCount).toBe(2);
    expect(Object.keys(out.cards[0]).sort()).toEqual(['connector', 'file', 'qid', 'sha256', 'sourceLabel', 'sourceStatus', 'title']);
  });
});
