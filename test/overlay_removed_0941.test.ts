// 0.9.41 (Founder, 2026-09-28): the full-screen overlay caused mouse stutter and is removed.
// Guards against it coming back: no mouse pass-through, no always-on-top or transparent window,
// and no path that creates or shows the overlay window.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(join(__dirname, '..', 'src', 'main', 'index.ts'), 'utf8');

describe('0.9.41 overlay removed', () => {
  it('never calls setIgnoreMouseEvents', () => {
    expect(src).not.toMatch(/\.setIgnoreMouseEvents\(/);
  });
  it('creates no always-on-top or transparent window', () => {
    expect(src).not.toMatch(/alwaysOnTop:\s*true/);
    expect(src).not.toMatch(/transparent:\s*true/);
  });
  it('has no call site that creates or shows the overlay', () => {
    expect(src).not.toMatch(/createOverlayWindow\(\);/);
    expect(src).not.toMatch(/label:\s*'Show Overlay'/);
  });
});
