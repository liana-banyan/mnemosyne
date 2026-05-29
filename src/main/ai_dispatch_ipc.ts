// ai_dispatch_ipc.ts — BP060 Application 002 Steps 3+4 · UI-8 AI dispatch backend
// IPC handler registrations for Multi-AI Selector backend.
// Routes via court-router (AI-agnostic · runtime-agnostic).
// LOCAL_RUNTIME_URL: persisted in settings · default http://localhost:11434.
// decay_class: BETWEEN

import { ipcMain } from 'electron';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve } from 'path';
import { homedir } from 'os';
import { getCourtRouter, updateCourtRouterLocalUrl } from './ai-providers/court-router';
import { LocalRuntimeClient } from './ai-providers/local-runtime-client';
import type { ChatMessage } from './ai-providers/types';

// ─── Settings persistence ─────────────────────────────────────────────────────

const SETTINGS_DIR = resolve(homedir(), '.amplify');
const AI_SETTINGS_PATH = resolve(SETTINGS_DIR, 'ai_dispatch_settings.json');
const DEFAULT_LOCAL_RUNTIME_URL = 'http://localhost:11434';

interface AiDispatchSettings {
  local_runtime_url: string;
}

function loadSettings(): AiDispatchSettings {
  try {
    if (existsSync(AI_SETTINGS_PATH)) {
      const raw = readFileSync(AI_SETTINGS_PATH, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<AiDispatchSettings>;
      return { local_runtime_url: parsed.local_runtime_url || DEFAULT_LOCAL_RUNTIME_URL };
    }
  } catch { /* fall through */ }
  return { local_runtime_url: DEFAULT_LOCAL_RUNTIME_URL };
}

function saveSettings(settings: AiDispatchSettings): void {
  try {
    mkdirSync(SETTINGS_DIR, { recursive: true });
    writeFileSync(AI_SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf-8');
  } catch (err) {
    console.error('[ai_dispatch_ipc] settings save error:', err);
  }
}

// ─── IPC registration ─────────────────────────────────────────────────────────

export function registerAiDispatchIPC(): void {
  // Initialize router with persisted settings
  const settings = loadSettings();
  const router = getCourtRouter({ local_runtime_url: settings.local_runtime_url });

  // ai-dispatch:query — route a query via court-router to the selected provider
  ipcMain.handle('ai-dispatch:query', async (
    _ev,
    args: { court_member: string; messages: ChatMessage[]; model_override?: string }
  ) => {
    try {
      const { court_member, messages, model_override } = args;
      const result = await router.dispatch(court_member, {
        messages,
        model: model_override,
        max_tokens: 2048,
      });
      return result;
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });

  // ai-dispatch:list-local-models — list models from local runtime
  ipcMain.handle('ai-dispatch:list-local-models', async () => {
    try {
      const currentSettings = loadSettings();
      const client = new LocalRuntimeClient(currentSettings.local_runtime_url);
      return await client.listModels();
    } catch (err) {
      return { ok: false, models: [], error: String(err) };
    }
  });

  // ai-dispatch:test-connection — ping LOCAL_RUNTIME_URL
  ipcMain.handle('ai-dispatch:test-connection', async () => {
    try {
      const currentSettings = loadSettings();
      const client = new LocalRuntimeClient(currentSettings.local_runtime_url);
      const result = await client.listModels();
      return { ok: result.ok, models: result.models, url: currentSettings.local_runtime_url, error: result.error };
    } catch (err) {
      const currentSettings = loadSettings();
      return { ok: false, models: [], url: currentSettings.local_runtime_url, error: String(err) };
    }
  });

  // ai-dispatch:get-settings — return current AI dispatch settings
  ipcMain.handle('ai-dispatch:get-settings', () => {
    return loadSettings();
  });

  // ai-dispatch:save-settings — persist settings
  ipcMain.handle('ai-dispatch:save-settings', (
    _ev,
    newSettings: { local_runtime_url?: string }
  ) => {
    try {
      const current = loadSettings();
      const merged: AiDispatchSettings = {
        local_runtime_url: newSettings.local_runtime_url || current.local_runtime_url,
      };
      saveSettings(merged);

      // Update live router
      updateCourtRouterLocalUrl(merged.local_runtime_url);
      router.updateLocalRuntimeUrl(merged.local_runtime_url);

      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });
}
