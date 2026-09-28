// D-BP223-BM0-X029-018-USER-HAS-PRECEDENCE -- yield decisions under simulated inputs.
import { describe, it, expect } from 'vitest';
import {
  decideYield,
  isDesktopInUse,
  labelTiming,
  mapNotificationState,
  type YieldInputs,
} from './yield_decision';
import { createPrecedenceMonitor, type PrecedenceProbes } from './index';

const idleNoModel: YieldInputs = {
  idleSeconds: 600, foreground: 'normal', model: null, modelNeedMiB: null, modelResident: false, vram: null,
};

describe('decideYield: default ON', () => {
  it('undefined setting is ON (the default)', () => {
    expect(decideYield({ ...idleNoModel, idleSeconds: 5 }).youComeFirst).toBe(true);
    expect(decideYield({ ...idleNoModel, idleSeconds: 5 }, {}).yield).toBe(true);
  });

  it('idle computer, normal foreground, no model: runs', () => {
    const d = decideYield(idleNoModel);
    expect(d.yield).toBe(false);
    expect(d.desktopInUse).toBe(false);
  });

  it('recent keyboard/mouse input: yields and labels desktop in use', () => {
    const d = decideYield({ ...idleNoModel, idleSeconds: 3 });
    expect(d.yield).toBe(true);
    expect(d.reasons).toEqual(['user_active']);
    expect(d.desktopInUse).toBe(true);
  });

  it('input exactly at the threshold counts as idle (strictly less than = active)', () => {
    expect(decideYield({ ...idleNoModel, idleSeconds: 120 }).yield).toBe(false);
    expect(decideYield({ ...idleNoModel, idleSeconds: 119 }).yield).toBe(true);
  });

  it('custom active window is honored', () => {
    expect(decideYield({ ...idleNoModel, idleSeconds: 200 }, { activeWithinSeconds: 300 }).yield).toBe(true);
  });

  it('idle time unreadable: fails safe (yields)', () => {
    const d = decideYield({ ...idleNoModel, idleSeconds: null });
    expect(d.yield).toBe(true);
    expect(d.reasons).toContain('idle_unreadable');
  });

  it.each(['fullscreen', 'd3d_fullscreen', 'presentation', 'immersive_app'] as const)(
    'full-screen foreground %s with no input for 10 minutes: yields, desktop in use',
    (fg) => {
      const d = decideYield({ ...idleNoModel, foreground: fg });
      expect(d.yield).toBe(true);
      expect(d.reasons).toEqual(['fullscreen_foreground']);
      expect(d.desktopInUse).toBe(true);
    },
  );

  it('locked / screensaver (away): runs even if the idle counter is small', () => {
    const d = decideYield({ ...idleNoModel, idleSeconds: 1, foreground: 'away' });
    expect(d.yield).toBe(false);
    expect(d.desktopInUse).toBe(false);
  });

  it('VRAM short for a non-resident model: yields with the numbers in the explanation', () => {
    const d = decideYield({
      ...idleNoModel, model: 'gemma2:2b', modelNeedMiB: 1843, modelResident: false,
      vram: { freeMiB: 1301, source: 'nvidia-smi' },
    });
    expect(d.yield).toBe(true);
    expect(d.reasons).toEqual(['vram_insufficient']);
    expect(d.explanation).toContain('1301');
    expect(d.explanation).toContain('2028'); // ceil(1843 * 1.1)
    expect(d.desktopInUse).toBe(false);
  });

  it('VRAM exactly at need x 1.1: runs', () => {
    const d = decideYield({
      ...idleNoModel, model: 'gemma2:2b', modelNeedMiB: 1843, modelResident: false,
      vram: { freeMiB: 2028, source: 'nvidia-smi' },
    });
    expect(d.yield).toBe(false);
  });

  it('model already resident needs zero new VRAM: runs even with low free VRAM (D-BP221-BM0-017)', () => {
    const d = decideYield({
      ...idleNoModel, model: 'gemma4:12b', modelNeedMiB: 7209, modelResident: true,
      vram: { freeMiB: 648, source: 'perfcounter-dedicated-usage' },
    });
    expect(d.yield).toBe(false);
  });

  // Founder ruling k/4b696911 (21:46Z): "1. pause". VRAM unreadable is fail-closed when ON.
  it('VRAM unreadable (probe answered null) pauses new model loads', () => {
    const d = decideYield({
      ...idleNoModel, model: 'gemma2:2b', modelNeedMiB: 1843, vram: { freeMiB: null, source: null },
    });
    expect(d.yield).toBe(true);
    expect(d.reasons).toEqual(['vram_unreadable']);
    expect(d.explanation).toContain('could not be read');
    expect(d.desktopInUse).toBe(false);
  });

  it('VRAM reading missing entirely also pauses', () => {
    const d = decideYield({ ...idleNoModel, model: 'gemma2:2b', modelNeedMiB: 1843, vram: null });
    expect(d.reasons).toEqual(['vram_unreadable']);
  });

  it('VRAM unreadable does not pause a model that is already loaded', () => {
    const d = decideYield({
      ...idleNoModel, model: 'gemma2:2b', modelNeedMiB: 1843, modelResident: true, vram: { freeMiB: null, source: null },
    });
    expect(d.yield).toBe(false);
  });

  it('VRAM unreadable does not pause model-free work (light serving)', () => {
    expect(decideYield({ ...idleNoModel, vram: { freeMiB: null, source: null } }).yield).toBe(false);
  });

  it('VRAM unreadable with the setting OFF: runs', () => {
    const d = decideYield({
      ...idleNoModel, model: 'gemma2:2b', modelNeedMiB: 1843, vram: { freeMiB: null, source: null },
    }, { youComeFirst: false });
    expect(d.yield).toBe(false);
  });

  it('every applicable reason is listed together', () => {
    const d = decideYield({
      idleSeconds: 2, foreground: 'd3d_fullscreen', model: 'gemma2:9b', modelNeedMiB: 7270,
      modelResident: false, vram: { freeMiB: 500, source: 'nvidia-smi' },
    });
    expect(d.reasons).toEqual(['user_active', 'fullscreen_foreground', 'vram_insufficient']);
  });
});

describe('decideYield: setting OFF', () => {
  it('never yields, even while typing in a full-screen game with no VRAM', () => {
    const d = decideYield({
      idleSeconds: 1, foreground: 'd3d_fullscreen', model: 'gemma2:9b', modelNeedMiB: 7270,
      modelResident: false, vram: { freeMiB: 10, source: 'nvidia-smi' },
    }, { youComeFirst: false });
    expect(d.yield).toBe(false);
    expect(d.youComeFirst).toBe(false);
    expect(d.reasons).toEqual([]);
  });

  it('still labels results desktop in use when the person is active', () => {
    expect(decideYield({ ...idleNoModel, idleSeconds: 1 }, { youComeFirst: false }).desktopInUse).toBe(true);
    expect(decideYield(idleNoModel, { youComeFirst: false }).desktopInUse).toBe(false);
  });
});

describe('helpers', () => {
  it('labelTiming appends the label only when in use', () => {
    expect(labelTiming('1,703 ms', true)).toBe('1,703 ms (desktop in use)');
    expect(labelTiming('1,703 ms', false)).toBe('1,703 ms');
  });

  it('maps SHQueryUserNotificationState values', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 0, 99, null].map((n) => mapNotificationState(n))).toEqual([
      'away', 'fullscreen', 'd3d_fullscreen', 'presentation', 'normal', 'normal', 'immersive_app', 'unknown', 'unknown', 'unknown',
    ]);
  });

  it('isDesktopInUse: unknown foreground with old input = not in use', () => {
    expect(isDesktopInUse({ idleSeconds: 900, foreground: 'unknown' })).toBe(false);
  });
});

// ─── The monitor: probe discipline under simulated inputs ─────────────────────

function fakeProbes(over: Partial<PrecedenceProbes> & { idle?: number | null; t?: { v: number } } = {}): PrecedenceProbes & { calls: string[] } {
  const calls: string[] = [];
  const t = over.t ?? { v: 1_000_000 };
  return {
    calls,
    readSettings: over.readSettings ?? (() => ({})),
    readIdleSeconds: over.readIdleSeconds ?? (() => (over.idle === undefined ? 600 : over.idle)),
    readForegroundState: over.readForegroundState ?? (async () => { calls.push('foreground'); return 'normal'; }),
    modelNeedMiB: over.modelNeedMiB ?? (() => 1843),
    isModelResident: over.isModelResident ?? (async () => { calls.push('resident'); return false; }),
    readVramFreeMiB: over.readVramFreeMiB ?? (async () => { calls.push('vram'); return { freeMiB: 6000, source: 'nvidia-smi' }; }),
    now: () => t.v,
  };
}

describe('createPrecedenceMonitor', () => {
  it('active desktop: yields WITHOUT spawning any foreground or VRAM probe', async () => {
    const p = fakeProbes({ idle: 4 });
    const m = createPrecedenceMonitor(p);
    const d = await m.check({ model: 'gemma2:2b' });
    expect(d.yield).toBe(true);
    expect(p.calls).toEqual([]);
    expect(m.probeCount()).toBe(0);
  });

  it('idle desktop: checks foreground, residency, then VRAM, and runs', async () => {
    const p = fakeProbes();
    const m = createPrecedenceMonitor(p);
    const d = await m.check({ model: 'gemma2:2b' });
    expect(d.yield).toBe(false);
    expect(p.calls).toEqual(['foreground', 'resident', 'vram']);
  });

  it('idle desktop with full-screen video: yields and skips the VRAM probe', async () => {
    const p = fakeProbes({ readForegroundState: async () => 'd3d_fullscreen' });
    const m = createPrecedenceMonitor(p);
    const d = await m.check({ model: 'gemma2:2b' });
    expect(d.yield).toBe(true);
    expect(p.calls).toEqual([]);
  });

  it('idle desktop, VRAM probe cannot answer: pauses (fail-closed, Founder k/4b696911)', async () => {
    const p = fakeProbes({ readVramFreeMiB: async () => { p.calls.push('vram'); return { freeMiB: null, source: null }; } });
    const m = createPrecedenceMonitor(p);
    const d = await m.check({ model: 'gemma2:2b' });
    expect(d.yield).toBe(true);
    expect(d.reasons).toEqual(['vram_unreadable']);
    expect(p.calls).toEqual(['foreground', 'resident', 'vram']);
  });

  it('resident model skips the VRAM probe', async () => {
    const p = fakeProbes({ isModelResident: async () => true });
    const m = createPrecedenceMonitor(p);
    expect((await m.check({ model: 'gemma2:2b' })).yield).toBe(false);
    expect(p.calls).toEqual(['foreground']);
  });

  it('a yield is cached for 15 s; a go is never cached; resumes automatically when idle', async () => {
    let idle = 3;
    const t = { v: 0 };
    const logs: string[] = [];
    const p = fakeProbes({ readIdleSeconds: () => idle, t });
    const m = createPrecedenceMonitor(p, (s) => logs.push(s));
    expect((await m.check()).yield).toBe(true);
    idle = 900;
    t.v = 10_000;
    expect((await m.check()).yield).toBe(true); // cached yield inside 15 s
    t.v = 16_000;
    expect((await m.check()).yield).toBe(false); // resumed on its own
    idle = 1;
    expect((await m.check()).yield).toBe(true); // a go was not cached, so the return of the user is seen at once
    expect(logs.filter((l) => l.includes('PAUSED')).length).toBe(2);
    expect(logs.filter((l) => l.includes('RESUMED')).length).toBe(1);
  });

  it('OFF: never yields and never probes VRAM, but still labels an active desktop', async () => {
    const p = fakeProbes({ idle: 2, readSettings: () => ({ youComeFirst: false }) });
    const m = createPrecedenceMonitor(p);
    const d = await m.check({ model: 'gemma2:9b' });
    expect(d.yield).toBe(false);
    expect(d.desktopInUse).toBe(true);
    expect(p.calls).toEqual([]);
  });

  it('model-free work (light serving) never probes VRAM', async () => {
    const p = fakeProbes();
    const m = createPrecedenceMonitor(p);
    await m.check({});
    expect(p.calls).toEqual(['foreground']);
  });
});
