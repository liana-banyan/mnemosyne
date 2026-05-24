// AMPLIFY Computer — Renderer Health Guard (BP040 / Cohort 0)
//
// Boilerplate discipline per BP038 env_loader.ts + port_guard.ts pattern.
// After the Vite-ready handshake, probes the renderer from the main process:
//   1. Waits `graceMs` for React to mount.
//   2. Queries document.getElementById('root').childElementCount via executeJavaScript.
//   3. If empty → logs a structured entry to ~/.lb_substrate/health/renderer_boot.log
//      and returns { ok: false } so the caller can surface a tray warning.
//   4. If populated → logs success + returns { ok: true }.
//
// Canon refs:
//   BP040 Cohort 0 — Frame Reliability
//   project_lb_frame_boilerplate_amplify_port_collision_auto.md (sibling pattern)

import { BrowserWindow } from 'electron';
import { mkdirSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const HEALTH_LOG_DIR = join(homedir(), '.lb_substrate', 'health');
const HEALTH_LOG_PATH = join(HEALTH_LOG_DIR, 'renderer_boot.log');

function writeHealthLog(entry: Record<string, unknown>): void {
  try {
    mkdirSync(HEALTH_LOG_DIR, { recursive: true });
    appendFileSync(
      HEALTH_LOG_PATH,
      JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n',
    );
  } catch {
    // noop — never throw from the health logger
  }
}

export interface RendererProbeResult {
  ok: boolean;
  rootChildCount: number;
  graceMs: number;
  error?: string;
}

/**
 * Probes the renderer after `graceMs` milliseconds.
 * Returns ok=true when React has mounted at least one child into #root.
 *
 * Call this from main process after `did-finish-load` + Vite-ready handshake.
 */
export async function probeRendererHealth(
  win: BrowserWindow,
  rendererUrl: string,
  graceMs = 8000,
): Promise<RendererProbeResult> {
  await new Promise<void>((r) => setTimeout(r, graceMs));

  if (win.isDestroyed()) {
    const result: RendererProbeResult = { ok: false, rootChildCount: 0, graceMs, error: 'window_destroyed' };
    writeHealthLog({ probe: 'renderer_boot', url: rendererUrl, ...result });
    return result;
  }

  try {
    const rootChildCount = (await win.webContents.executeJavaScript(
      '(() => { const r = document.getElementById("root"); return r ? r.childElementCount : -1; })()',
    )) as number;

    const ok = rootChildCount > 0;
    const result: RendererProbeResult = { ok, rootChildCount, graceMs };

    writeHealthLog({ probe: 'renderer_boot', url: rendererUrl, ...result });

    if (!ok) {
      console.error(
        `[renderer_guard] ⚠ root div empty after ${graceMs}ms grace — ` +
        `React never mounted (rootChildCount=${rootChildCount}). ` +
        `Log → ${HEALTH_LOG_PATH}`,
      );
    } else {
      console.log(
        `[renderer_guard] ✓ renderer healthy — root has ${rootChildCount} child(ren) after ${graceMs}ms.`,
      );
    }

    return result;
  } catch (err) {
    const error = String(err);
    const result: RendererProbeResult = { ok: false, rootChildCount: 0, graceMs, error };
    writeHealthLog({ probe: 'renderer_boot', url: rendererUrl, ...result });
    console.error(`[renderer_guard] probe threw: ${error}`);
    return result;
  }
}
