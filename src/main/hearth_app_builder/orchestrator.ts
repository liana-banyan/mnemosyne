// AMPLIFY Computer — Hearth App Builder — Orchestrator
// B69 — End-to-end Hearth pipeline: spec extraction → codegen → build → install
// "Roads? Where we're going, WE don't NEED Roads." — Cold Start Pathway #7

import { randomUUID } from 'crypto';
import { BrowserWindow } from 'electron';
import { AppSpec, BuildProgress, HearthHealthz, HearthSpecSmokeResult } from './types';
import { extractSpec, specExtractSmoke } from './spec_extractor';
import { generateApp, HEARTH_APPS_DIR } from './codegen';
import { BuildRunner, IPC_BUILD_PROGRESS } from './build_runner';
import { registerBuiltApp, runInstaller, loadRegistry, queryLibrary, uninstallApp } from './install_runner';
import {
  emitSweatSpecExtraction,
  emitSweatBuildRunner,
  emitSweatInstallRunner,
  emitTearsBuildCompleteNoInstall,
  emitTearsInstallFailed,
  emitForagerNotImplementable,
  writeIronTablet,
  appendMCCIThread,
} from './signals';
import { existsSync } from 'fs';
import { join } from 'path';

// ─── Orchestrator ─────────────────────────────────────────────────────────────

export interface HearthBuildRequest {
  request: string;
  memberId: string;
  windows: Array<BrowserWindow | null>;
}

export interface HearthBuildResult {
  ok: boolean;
  appUuid?: string;
  appDir?: string;
  spec?: AppSpec;
  installerPath?: string;
  error?: string;
}

export async function runHearthBuild(opts: HearthBuildRequest): Promise<HearthBuildResult> {
  const { request, memberId, windows } = opts;
  const appUuid = randomUUID();
  const threadId = `hearth-${appUuid.slice(0, 8)}`;

  function broadcast(event: string, payload: unknown): void {
    for (const win of windows) {
      if (win && !win.isDestroyed()) win.webContents.send(event, payload);
    }
  }

  function progress(p: BuildProgress): void {
    broadcast(IPC_BUILD_PROGRESS, p);
  }

  // Log to MCCI thread
  appendMCCIThread({
    thread_id: threadId,
    app_uuid: appUuid,
    app_name: '',
    message: request,
    role: 'member',
    build_status: 'started',
    ts: new Date().toISOString(),
  });

  // ── Step 1: Spec Extraction ───────────────────────────────────────────────
  progress({ status: 'extracting_spec', message: 'Understanding your app description…', percent: 5, appUuid });

  const specResult = await extractSpec(request, memberId);

  emitSweatSpecExtraction({
    method: specResult.method,
    latency_ms: specResult.latency_ms,
    appUuid,
    appName: specResult.spec?.appName ?? 'unknown',
  });

  if (!specResult.ok || !specResult.spec) {
    writeIronTablet({ uuid: appUuid, ts: new Date().toISOString(), appName: 'unknown', member_id: memberId, build_status: 'failure', error: specResult.error });
    return { ok: false, error: specResult.error ?? 'Spec extraction failed' };
  }

  const spec = specResult.spec;

  progress({ status: 'spec_ready', message: `Got it! Building "${spec.appName}"…`, percent: 15, appUuid });

  appendMCCIThread({
    thread_id: threadId, app_uuid: appUuid, app_name: spec.appName,
    message: `Spec extracted: ${spec.appName} — ${spec.entities.length} entities`,
    role: 'hearth', build_status: 'spec_ready', ts: new Date().toISOString(),
  });

  // Check for cross-domain bridges or unimplementable features
  _checkForagerFlags(request, appUuid, spec.appName);

  // ── Step 2: Code Generation ───────────────────────────────────────────────
  progress({ status: 'generating_code', message: 'Generating your app code…', percent: 20, appUuid });

  const codegenResult = await generateApp(spec, appUuid);

  if (!codegenResult.ok || !codegenResult.appDir) {
    writeIronTablet({ uuid: appUuid, ts: new Date().toISOString(), appName: spec.appName, member_id: memberId, build_status: 'failure', spec, error: codegenResult.error });
    return { ok: false, error: codegenResult.error ?? 'Code generation failed', spec };
  }

  const appDir = codegenResult.appDir;
  const builtAt = new Date().toISOString();

  registerBuiltApp({
    uuid: appUuid,
    appName: spec.appName,
    description: spec.description,
    appDir,
    spec,
  });

  // ── Step 3: Build ─────────────────────────────────────────────────────────
  const runner = new BuildRunner({ appDir, appUuid, appName: spec.appName, windows });
  const buildResult = await runner.run();

  emitSweatBuildRunner({
    appUuid,
    appName: spec.appName,
    duration_ms: buildResult.buildDurationMs,
    success: buildResult.ok,
    os: process.platform,
  });

  if (!buildResult.ok) {
    writeIronTablet({ uuid: appUuid, ts: new Date().toISOString(), appName: spec.appName, member_id: memberId, build_status: 'failure', spec, error: buildResult.error });

    emitTearsInstallFailed({ appUuid, appName: spec.appName, build_succeeded: false, coroner_found_breakage: true });

    appendMCCIThread({
      thread_id: threadId, app_uuid: appUuid, app_name: spec.appName,
      message: `Build failed: ${buildResult.error?.slice(0, 200)}`,
      role: 'hearth', build_status: 'error', ts: new Date().toISOString(),
    });

    return { ok: false, error: buildResult.error, spec, appDir, appUuid };
  }

  // Schedule Tears signal if member never clicks Install (30-minute window)
  if (buildResult.installerPath) {
    setTimeout(() => {
      const registry = loadRegistry();
      const app = registry.apps.find((a) => a.uuid === appUuid);
      if (app && app.buildStatus === 'built') {
        emitTearsBuildCompleteNoInstall({ appUuid, appName: spec.appName, built_at: builtAt, timeout_ms: 30 * 60 * 1000 });
      }
    }, 30 * 60 * 1000);
  }

  writeIronTablet({ uuid: appUuid, ts: new Date().toISOString(), appName: spec.appName, member_id: memberId, build_status: 'success', spec, installer_path: buildResult.installerPath });

  appendMCCIThread({
    thread_id: threadId, app_uuid: appUuid, app_name: spec.appName,
    message: `Build complete. Installer: ${buildResult.installerPath ?? 'no installer'}`,
    role: 'hearth', build_status: 'complete', ts: new Date().toISOString(),
  });

  return {
    ok: true,
    appUuid,
    appDir,
    spec,
    installerPath: buildResult.installerPath,
  };
}

// ─── Install trigger ──────────────────────────────────────────────────────────

export async function runHearthInstall(opts: {
  uuid: string;
  appName: string;
  description: string;
  appDir: string;
  installerPath: string;
  spec: AppSpec;
}): Promise<{ ok: boolean; error?: string }> {
  const result = await runInstaller(opts);

  emitSweatInstallRunner({
    appUuid: opts.uuid,
    appName: opts.appName,
    success: result.ok,
    os: process.platform,
  });

  if (!result.ok) {
    emitTearsInstallFailed({
      appUuid: opts.uuid,
      appName: opts.appName,
      build_succeeded: true,
      coroner_found_breakage: false,
    });
  }

  return result;
}

// ─── Library + health queries ─────────────────────────────────────────────────

export function getHearthLibrary(memberId?: string) {
  return queryLibrary(memberId);
}

export async function getHearthHealthz(): Promise<HearthHealthz> {
  const ollamaAvailable = await checkOllama();
  const templateDirPresent = true; // templates are embedded — always present

  const registry = loadRegistry();
  const now = Date.now();
  const ONE_HOUR = 3600_000;
  const recentBuilds = registry.apps.filter((a) => {
    const age = now - new Date(a.installedAt).getTime();
    return age < ONE_HOUR;
  }).length;
  const recentInstallSuccesses = registry.apps.filter((a) => {
    const age = now - new Date(a.installedAt).getTime();
    return age < ONE_HOUR && a.buildStatus === 'installed';
  }).length;

  return {
    status: 'ok',
    ollama_available: ollamaAvailable,
    template_dir_present: templateDirPresent,
    recent_builds: recentBuilds,
    recent_install_successes: recentInstallSuccesses,
  };
}

export async function runSpecExtractSmoke(): Promise<HearthSpecSmokeResult> {
  return specExtractSmoke();
}

async function checkOllama(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const res = await fetch('http://localhost:11434/api/tags', { signal: controller.signal }).finally(() => clearTimeout(timer));
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Forager flag detection ────────────────────────────────────────────────────

const COMPLEX_FEATURE_KEYWORDS = [
  'many-to-many', 'file upload', 'image upload', 'video upload',
  'external api', 'webhook', 'stripe', 'payment', 'email send',
  'real-time', 'websocket', 'chart', 'graph', 'map', 'geolocation',
  'camera', 'microphone', 'bluetooth', 'iot', 'machine learning',
  'ai', 'speech', 'voice recognition',
];

const HIPAA_KEYWORDS = ['hipaa', 'health record', 'medical', 'patient', 'diagnosis', 'prescription'];
const POLITICAL_KEYWORDS = ['vote', 'election', 'ballot', 'campaign', 'donor'];

function _checkForagerFlags(request: string, appUuid: string, appName: string): void {
  const lower = request.toLowerCase();

  for (const kw of COMPLEX_FEATURE_KEYWORDS) {
    if (lower.includes(kw)) {
      emitForagerNotImplementable({
        appUuid,
        appName,
        description: `Member requested feature not yet implementable in Hearth v1: "${kw}" (from: "${request.slice(0, 100)}")`,
      });
      break;
    }
  }

  if (HIPAA_KEYWORDS.some((kw) => lower.includes(kw))) {
    emitForagerNotImplementable({
      appUuid,
      appName: appName,
      description: `HIPAA-adjacent feature detected → Galveston pilot canon / LB-CCL healthcare addendum bridge needed. Request: "${request.slice(0, 100)}"`,
    });
  }

  if (POLITICAL_KEYWORDS.some((kw) => lower.includes(kw))) {
    emitForagerNotImplementable({
      appUuid,
      appName,
      description: `Political-domain bridge detected → Power to the People initiative. Request: "${request.slice(0, 100)}"`,
    });
  }
}
