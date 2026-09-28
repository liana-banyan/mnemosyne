// enroll_founder_only.test.tsx -- D-BP223-X044-020 (0.9.40). The Settings enrollment screen is
// FOUNDER ONLY and labelled so (Founder ruling 2026-09-28, PQ008 item 1). No jsdom in this repo
// (same note as share_cards_ui.test.tsx), so the wording is tested as pure functions and the panel's
// first paint is rendered with react-dom/server.

import { describe, expect, test } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  FOUNDER_ONLY_DETAIL,
  FOUNDER_ONLY_LABEL,
  LOCKED_TEXT,
  OPEN_BUTTON,
  REFUSED_TEXT,
  describeEnrollResult,
  noLongDashes,
} from './enroll_ui_text';
import { EnrollMachinesPanel } from './EnrollMachinesPanel';

const LONG_DASH = /[–—]/;

describe('Founder-only enrollment screen: wording', () => {
  test('the label says Founder only and that member enrollment is coming', () => {
    expect(FOUNDER_ONLY_LABEL).toBe('Founder only: enroll the Founder\'s machines. Member enrollment is coming.');
  });

  test('no screen text carries an em or en dash', () => {
    for (const s of [FOUNDER_ONLY_LABEL, FOUNDER_ONLY_DETAIL, OPEN_BUTTON, LOCKED_TEXT, REFUSED_TEXT]) {
      expect(LONG_DASH.test(s)).toBe(false);
    }
    expect(noLongDashes('a — b – c')).toBe('a, b, c');
  });

  test('the live lockout answer becomes one clean locked sentence', () => {
    // The exact reason founder-code-verify returns when locked, as enroll_by_code.ts wraps it.
    const r = describeEnrollResult({ ok: false, error: 'authenticator code refused: locked: too many recent failed attempts. Try again later.' });
    expect(r.kind).toBe('locked');
    expect(r.text).toBe(LOCKED_TEXT);
    expect(r.text).toContain('Nothing was written.');
    expect(r.text).not.toContain('authenticator code refused:');
  });

  test('a wrong code is refused plainly, naming the Founder\'s code as the only way', () => {
    const r = describeEnrollResult({ ok: false, error: 'authenticator code refused: no window within +/-1 matched' });
    expect(r.kind).toBe('refused');
    expect(r.text).toBe(REFUSED_TEXT);
  });

  test('other failures say nothing was written; success names the machine', () => {
    expect(describeEnrollResult({ ok: false, error: 'could not reach the authenticator check: timeout' }).text)
      .toBe('Not enrolled: could not reach the authenticator check: timeout. Nothing was written.');
    expect(describeEnrollResult(undefined).kind).toBe('error');
    const ok = describeEnrollResult({ ok: true, peerId: 'abcdef0123456789', label: 'M2' });
    expect(ok.kind).toBe('enrolled');
    expect(ok.text).toContain('M2 (abcdef0123456789)');
  });
});

describe('Founder-only enrollment screen: first paint', () => {
  test('shows the label and does nothing else until the Founder opens it (no code, no inputs, no list)', () => {
    const html = renderToStaticMarkup(<EnrollMachinesPanel />);
    expect(html).toContain(FOUNDER_ONLY_LABEL.replace(/'/g, '&#x27;'));
    expect(html).not.toContain('<textarea');
    expect(html).not.toContain('<input');
    expect(LONG_DASH.test(html)).toBe(false);
  });
});
