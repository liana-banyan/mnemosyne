// user_precedence/probes.ts -- D-BP223-BM0-X029-018-USER-HAS-PRECEDENCE
//
// Prior-work gate answered: the name-token matches (D-BP168-M0-189 return-state probes,
// X011-013 pherostream run_probes*) are unrelated query probes, not machine-activity probes.
//
// The input-gathering half of "You come first". Every probe is:
//   - ASYNC (never spawnSync on the Electron main thread: a blocked main thread is itself a
//     stutter the person would feel),
//   - HIDDEN (windowsHide: true on every child process: no console window ever flashes),
//   - READ-ONLY (nothing here opens, focuses, or talks to any window or browser),
//   - FAIL-SOFT (a probe that cannot answer returns null / 'unknown', never throws).
//
// LAW 4 SOURCES:
//   idle       -> homework/homework_runner.ts Gate 2 (powerMonitor.getSystemIdleTime()).
//   foreground -> NEW: shell32 SHQueryUserNotificationState, the same OS signal Windows itself uses
//                 to hold back notifications during full-screen video, games and presentations.
//   VRAM free  -> ported from HARDWIRE/tools/vram_headroom.mjs getVramFreeLocal (nvidia-smi first,
//                 cross-vendor DXGI "GPU Adapter Memory\Dedicated Usage" counter second), with the
//                 TOTAL from hardware/ram_detector.ts detectVramGbDetailed() instead of the
//                 script's hardcoded per-machine table (the app runs on members' machines, not M0/M2/M4).
//   residency  -> vram_headroom.mjs isModelResident (Ollama /api/ps).
//   model need -> hardware/ram_detector.ts requiredVramGb.

import { execFile } from 'child_process';
import { mapNotificationState, type ForegroundState, type VramReading } from './yield_decision';

function run(cmd: string, args: string[], timeoutMs: number): Promise<{ ok: boolean; stdout: string }> {
  return new Promise((resolve) => {
    try {
      execFile(cmd, args, { timeout: timeoutMs, windowsHide: true, encoding: 'utf8' }, (err, stdout) => {
        resolve({ ok: !err, stdout: typeof stdout === 'string' ? stdout : '' });
      });
    } catch {
      resolve({ ok: false, stdout: '' });
    }
  });
}

export function readIdleSeconds(): number | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { powerMonitor } = require('electron') as typeof import('electron');
    const v = powerMonitor.getSystemIdleTime();
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

export const QUNS_PS =
  "$d='[DllImport(\"shell32.dll\")] public static extern int SHQueryUserNotificationState(out int s);';" +
  "$t=Add-Type -MemberDefinition $d -Name Quns -Namespace MnemUserPrecedence -PassThru;" +
  '$x=0;[void]$t::SHQueryUserNotificationState([ref]$x);$x';

export async function readForegroundState(timeoutMs = 8000): Promise<ForegroundState> {
  if (process.platform !== 'win32') return 'unknown';
  const r = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', QUNS_PS], timeoutMs);
  if (!r.ok) return 'unknown';
  const n = parseInt(r.stdout.trim().split(/\r?\n/).pop() ?? '', 10);
  return mapNotificationState(Number.isFinite(n) ? n : null);
}

export async function readVramFreeMiB(totalGb: number | null, timeoutMs = 8000): Promise<VramReading> {
  const nv = await run('nvidia-smi', ['--query-gpu=memory.free', '--format=csv,noheader,nounits'], timeoutMs);
  if (nv.ok) {
    const free = parseInt(nv.stdout.trim().split(/\r?\n/)[0] ?? '', 10);
    if (Number.isFinite(free)) return { freeMiB: free, source: 'nvidia-smi' };
  }
  if (process.platform !== 'win32' || totalGb === null) return { freeMiB: null, source: null };
  const ps = "(Get-Counter '\\GPU Adapter Memory(*)\\Dedicated Usage' -ErrorAction Stop)."
    + 'CounterSamples | Measure-Object -Property CookedValue -Sum | Select-Object -ExpandProperty Sum';
  const r = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', ps], timeoutMs);
  if (!r.ok) return { freeMiB: null, source: null };
  const usedBytes = parseFloat(r.stdout.trim());
  if (!Number.isFinite(usedBytes)) return { freeMiB: null, source: null };
  const usedMiB = Math.round(usedBytes / (1024 * 1024));
  return { freeMiB: Math.max(0, Math.round(totalGb * 1024) - usedMiB), source: 'perfcounter-dedicated-usage' };
}

export async function isModelResident(model: string, ollamaUrl = 'http://127.0.0.1:11434', timeoutMs = 4000): Promise<boolean> {
  try {
    const res = await fetch(`${ollamaUrl.replace(/\/$/, '')}/api/ps`, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return false;
    const j = (await res.json()) as { models?: Array<{ name?: string; model?: string }> };
    return (j.models ?? []).some((m) => m?.name === model || m?.model === model);
  } catch {
    return false; // unknown -> not resident -> the ordinary headroom check applies
  }
}
