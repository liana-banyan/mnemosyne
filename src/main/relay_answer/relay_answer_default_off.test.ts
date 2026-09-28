// relay_answer_default_off.test.ts -- D-BP223-BM0-X031-024: the relay answer poller does not start unless the user
// turned on answerOtherMembersQuestions. child_process.fork and os.homedir are mocked: no real worker, no real PID file.
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const H = vi.hoisted(() => ({ home: '' }));

vi.mock('child_process', () => ({
  fork: vi.fn(() => {
    const child = new EventEmitter() as EventEmitter & { send: (m: unknown) => void; pid: number; killed: boolean; kill: () => void };
    child.send = () => {};
    child.pid = 999_999_001;
    child.killed = false;
    child.kill = () => { child.killed = true; };
    return child;
  }),
}));

vi.mock('os', async (orig) => {
  const real = await orig<typeof import('os')>();
  return { ...real, homedir: () => H.home };
});

function settingsFile(d: string, body: unknown): string {
  const p = join(d, 'config', 'network_feature_settings.json');
  mkdirSync(join(d, 'config'), { recursive: true });
  writeFileSync(p, JSON.stringify(body));
  return p;
}

const CONFIG = { peerId: 'p'.repeat(16), supabaseUrl: 'https://example.invalid', anonKey: 'not-a-real-key' };

describe('relay answer poller default off (X031-024)', () => {
  beforeEach(() => {
    H.home = mkdtempSync(join(tmpdir(), 'x031024-relay-home-'));
    vi.resetModules();
  });

  test('no settings file: nothing is forked', async () => {
    const cp = await import('child_process');
    (cp.fork as unknown as ReturnType<typeof vi.fn>).mockClear();
    const { startRelayAnswerPoller } = await import('./index');
    const stop = startRelayAnswerPoller(CONFIG, { settingsPath: join(H.home, 'absent', 'network_feature_settings.json') });
    expect(cp.fork).not.toHaveBeenCalled();
    stop();
  });

  test('user turned it off explicitly: nothing is forked', async () => {
    const cp = await import('child_process');
    (cp.fork as unknown as ReturnType<typeof vi.fn>).mockClear();
    const { startRelayAnswerPoller } = await import('./index');
    const stop = startRelayAnswerPoller(CONFIG, { settingsPath: settingsFile(H.home, { answerOtherMembersQuestions: false, sendStatusReport: true }) });
    expect(cp.fork).not.toHaveBeenCalled();
    stop();
  });

  test('user turned it on: the worker is forked', async () => {
    const cp = await import('child_process');
    (cp.fork as unknown as ReturnType<typeof vi.fn>).mockClear();
    const { startRelayAnswerPoller } = await import('./index');
    const stop = startRelayAnswerPoller(CONFIG, { settingsPath: settingsFile(H.home, { answerOtherMembersQuestions: true }) });
    expect(cp.fork).toHaveBeenCalledTimes(1);
    stop();
  });
});
