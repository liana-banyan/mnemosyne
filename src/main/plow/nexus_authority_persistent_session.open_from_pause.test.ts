// nexus_authority_persistent_session.open_from_pause.test.ts -- D-BP152-027/BISHOP/
// seg-open-nexus-from-pause
//
// THE GAP THIS TICKET CLOSES: Founder, live report, BP152: "I thought we were going to have it
// come up with the 5 tabs that we already use? ... it's doing the same scrape thing it did
// before." The "Capture -> Liana Cycle" button (D-BP152-025) lives inside the Nexus Authority
// window, but nothing at the Liana Cycle pause offered a way to REACH that window -- so he
// pressed Send to Google, the only affordance in front of him. This ticket adds one operator
// action at the pause that opens/brings forward the SAME window, reusing the EXISTING
// 'nexus-authority-open-signin' channel (index.ts) / showNexusAuthoritySessionForSignIn()
// (this file) -- no second open path, no change to capture's read-only rule, no change to the
// paused run.
//
// THIS TICKET'S OWN VERIFY LIST:
//   (a) the action opens the window via the EXISTING channel, no second open path introduced
//   (b) the run remains paused after the window opens
//   (c) an already-open window is brought forward, not duplicated
//   (d) capture still returns no_window when the window was never opened (read-only rule intact)
//   (e) send-to-Google and the existing pause actions behave exactly as at f34eed60 -- covered by
//       the pre-existing, UNMODIFIED liana_terminal_engine.ask_google_this.test.ts and
//       liana_terminal_engine.pause_at_step_zero.test.ts suites, run alongside this file rather
//       than duplicated here.
//
// (c)/(d) exercise this file's own exports against a fake BrowserWindow -- same "mock electron
// minimally" convention liana_terminal_engine.nexus_capture.test.ts (one directory over) already
// uses, widened here to include BrowserWindow since this file (unlike that one) actually
// constructs one.
//
// (a)/(b) are verified as SOURCE-TEXT assertions against LianaCycleTab.tsx's new
// openNexusTabsFromPause callback. This repo has no React component test harness anywhere
// (@testing-library/react is not a dependency; grep finds zero *.test.tsx files under
// src/renderer) -- adding one would be exactly the scope-widening D-BP152-027's own FORBIDDEN
// list rules out ("do not widen a gate"). A bounded source-text read is the honest alternative:
// it fails loudly if the reused call or the pause-ending calls it must NOT make are edited later.

import { describe, test, expect, beforeEach } from 'vitest';
import { readFileSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { vi } from 'vitest';

let userDataDir = '';

vi.mock('electron', () => {
  class FakeWebContents {
    executeJavaScriptCalls: string[] = [];
    async executeJavaScript(script: string) {
      this.executeJavaScriptCalls.push(script);
      return null;
    }
  }
  class FakeBrowserWindow {
    static instances: FakeBrowserWindow[] = [];
    destroyedFlag = false;
    shownCount = 0;
    focusedCount = 0;
    webContents = new FakeWebContents();
    constructor(_opts: unknown) {
      FakeBrowserWindow.instances.push(this);
    }
    loadURL(_url: string) { /* no-op -- URL choice is not this test's concern */ }
    on(_evt: string, _cb: (...args: unknown[]) => void) { /* 'closed' never fires in this fake */ }
    isDestroyed() { return this.destroyedFlag; }
    show() { this.shownCount += 1; }
    focus() { this.focusedCount += 1; }
    hide() { /* no-op */ }
  }
  return {
    app: { getPath: () => userDataDir },
    BrowserWindow: FakeBrowserWindow,
  };
});

// Resolves to the mock above -- gives the test direct access to FakeBrowserWindow.instances.
import { BrowserWindow } from 'electron';
type FakeBrowserWindowStatics = { instances: Array<{ shownCount: number; focusedCount: number }> };

describe('D-BP152-027 -- (c)/(d) open/bring-forward against a fake BrowserWindow', () => {
  beforeEach(() => {
    // Fresh temp userData dir + fresh module registry per test: the flags file and the
    // module-level `nexusAuthorityWindow` singleton must not leak between tests, mirroring how a
    // real app restart resets both.
    userDataDir = mkdtempSync(join(tmpdir(), 'nexus-open-pause-test-'));
    (BrowserWindow as unknown as FakeBrowserWindowStatics).instances.length = 0;
    vi.resetModules();
  });

  test('(c) an already-open window is brought forward, not duplicated', async () => {
    const mod = await import('./nexus_authority_persistent_session');
    mod.setNexusAuthorityBrowserFlags(true, true);

    const first = mod.showNexusAuthoritySessionForSignIn('user_google');
    const second = mod.showNexusAuthoritySessionForSignIn('user_google');

    expect(first, 'first open succeeds').toBe(true);
    expect(second, 'second open on an already-open window still succeeds').toBe(true);

    const instances = (BrowserWindow as unknown as FakeBrowserWindowStatics).instances;
    expect(instances.length, 'exactly ONE BrowserWindow was ever constructed -- the second call reused it, never built a second').toBe(1);
    expect(instances[0].shownCount, 'brought forward (shown) on both calls').toBe(2);
    expect(instances[0].focusedCount, 'brought forward (focused) on both calls').toBe(2);
  });

  test('(c continued) getNexusAuthorityWindow() sees the SAME instance across repeated opens -- one window, one path', async () => {
    const mod = await import('./nexus_authority_persistent_session');
    mod.setNexusAuthorityBrowserFlags(true, true);

    mod.showNexusAuthoritySessionForSignIn('user_google');
    const win1 = mod.getNexusAuthorityWindow();
    mod.showNexusAuthoritySessionForSignIn('user_google');
    const win2 = mod.getNexusAuthorityWindow();

    expect(win1).not.toBeNull();
    expect(win2, 'referentially the same window object both times').toBe(win1);
  });

  test('(d) capture returns no_window when the window was never opened -- getNexusAuthorityWindow() stays read-only', async () => {
    const mod = await import('./nexus_authority_persistent_session');
    mod.setNexusAuthorityBrowserFlags(true, true);

    // Flags are ON, but nothing in THIS fresh module instance has ever called
    // ensureNexusAuthoritySession() / showNexusAuthoritySessionForSignIn() -- the new pause
    // action is additive, so a capture attempted before the operator ever presses it must still
    // report honestly, exactly as it did before this ticket.
    expect(mod.getNexusAuthorityWindow()).toBeNull();
    const capture = await mod.captureNexusAuthorityVisibleText();
    expect(capture.ok).toBe(false);
    expect(capture.reason).toBe('no_window');

    const instances = (BrowserWindow as unknown as FakeBrowserWindowStatics).instances;
    expect(instances.length, 'capture never constructs a window -- read-only, per design').toBe(0);
  });

  test('(d continued) capture still refuses honestly when the flags are off, regardless of any prior open attempt', async () => {
    const mod = await import('./nexus_authority_persistent_session');
    // Flags left OFF (default for a fresh temp userData dir/no flags file written).
    const opened = mod.showNexusAuthoritySessionForSignIn('user_google');
    expect(opened, 'opening with the flags off is refused, honestly, not silently allowed').toBe(false);
    expect(mod.getNexusAuthorityWindow()).toBeNull();
    const capture = await mod.captureNexusAuthorityVisibleText();
    expect(capture.ok).toBe(false);
    expect(capture.reason).toBe('no_window');
  });
});

describe('D-BP152-027 -- (a)/(b) the pause action reuses the EXISTING open path and never resolves the pause (source-level)', () => {
  const rendererSrc = readFileSync(
    join(__dirname, '..', '..', 'renderer', 'components', 'compass', 'LianaCycleTab.tsx'),
    'utf-8',
  );
  const indexSrc = readFileSync(join(__dirname, '..', 'index.ts'), 'utf-8');

  function extractUseCallbackBody(src: string, name: string): string {
    const startIdx = src.indexOf(`const ${name} = useCallback(`);
    expect(startIdx, `${name} is defined via useCallback in LianaCycleTab.tsx`).toBeGreaterThan(-1);
    // Bounded slice up to the next top-level "}, [" dependency-array close -- a plain source-text
    // read, not a full TS parser, but sufficient to assert what this one function's body does and
    // does not call.
    const depsIdx = src.indexOf('}, [', startIdx);
    expect(depsIdx, `${name}'s useCallback has a closing dependency array`).toBeGreaterThan(-1);
    return src.slice(startIdx, depsIdx);
  }

  test('(a) openNexusTabsFromPause calls window.amplify.openNexusAuthoritySignIn -- the EXISTING preload bridge, no new one invented', () => {
    const body = extractUseCallbackBody(rendererSrc, 'openNexusTabsFromPause');
    expect(body).toContain('window.amplify.openNexusAuthoritySignIn');
    expect(body, 'no raw ipcRenderer.invoke -- goes through the existing named preload method only').not.toMatch(/ipcRenderer\.invoke\(/);
  });

  test('(a continued) index.ts still registers exactly the pre-existing 5 nexus-authority-* channels -- no new one added by this ticket', () => {
    const matches = indexSrc.match(/safeHandle\(\s*'nexus-authority-[a-z-]+'/g) ?? [];
    const names = Array.from(new Set(matches.map((m) => m.match(/'nexus-authority-[a-z-]+'/)![0]))).sort();
    expect(names).toEqual([
      "'nexus-authority-capture'",
      "'nexus-authority-check-signin-status'",
      "'nexus-authority-hide-signin'",
      "'nexus-authority-open-signin'",
      "'nexus-authority-set-flags'",
    ]);
  });

  test('(b) openNexusTabsFromPause never calls lianaSteppedRespond or clears the active pause -- pressing it cannot advance/resume/end the run', () => {
    const body = extractUseCallbackBody(rendererSrc, 'openNexusTabsFromPause');
    expect(body).not.toContain('lianaSteppedRespond');
    expect(body).not.toContain('setActiveSteppedPause');
  });

  test('(b continued) the new button is rendered without being wired through answerSteppedPause() -- its onClick calls openNexusTabsFromPause directly', () => {
    const btnIdx = rendererSrc.indexOf('Open the 5 tabs we already use');
    expect(btnIdx, 'the operator-facing label is present verbatim').toBeGreaterThan(-1);
    const nearby = rendererSrc.slice(Math.max(0, btnIdx - 600), btnIdx);
    expect(nearby).toContain('onClick={() => void openNexusTabsFromPause()}');
    expect(nearby).not.toContain('answerSteppedPause(');
  });
});
