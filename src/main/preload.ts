// AMPLIFY Computer — Electron Preload
// B37 Phase 1-3 — Exposes safe IPC bridge to renderer via contextBridge
// Phase 3 additions: substrate query/write, federation status, force-mode

import { contextBridge, ipcRenderer } from 'electron';

// Main-process watchdog (Bushel 58) — respond even if renderer React tree is wedged
ipcRenderer.on('watchdog-ping', () => {
  ipcRenderer.send('watchdog-pong');
});

// ─── Types ────────────────────────────────────────────────────────────────────

export type FrameMode = 'ai_burst' | 'normal' | 'fallback';

export interface FrameModePayload {
  mode: FrameMode;
  forced_mode: FrameMode | null;
}

export interface OllamaStatus {
  running: boolean;
  model: string | null;
  version?: string;
}

export interface ModelPullProgress {
  status: 'pulling' | 'verifying' | 'complete' | 'error';
  bytesDownloaded?: number;
  totalBytes?: number;
  percentComplete?: number;
  error?: string;
}

export interface AMPLIFYSnapshot {
  total_queries: number;
  substrate_hits: number;
  local_ollama_served: number;
  cloud_escalations: number;
  peer_synced: number;
  substrate_hit_ratio: number;
  local_ratio: number;
  cloud_ratio: number;
  total_cloud_cost_avoided_usd: number;
  total_tokens_saved_est: number;
  avg_latency_ms: number;
  index_size: number;
  as_of: string;
}

export interface SubstrateQueryResult {
  hit: boolean;
  record?: {
    id: string;
    text: string;
    source: string;
    keywords: string[];
    ts: string;
  };
  score?: number;
  routing: 'substrate_hit' | 'local_ollama' | 'cloud_escalation' | 'peer_sync' | 'miss';
  latency_ms: number;
  cloud_cost_avoided_usd: number;
  peer_sync_exchanged?: number;
}

export interface UpdateState {
  status: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error' | 'not-available';
  version?: string;
  releaseNotes?: string;
  downloadProgress?: number;
  errorMessage?: string;
}

export interface PeriodStats {
  period: string;
  label: string;
  total_queries: number;
  substrate_hits: number;
  local_ollama_served: number;
  cloud_escalations: number;
  peer_synced: number;
  misses: number;
  substrate_hit_ratio: number;
  local_ratio: number;
  cloud_ratio: number;
  cloud_cost_avoided_usd: number;
  tokens_saved_est: number;
  avg_latency_ms: number;
  avg_local_latency_ms: number;
  cloud_baseline_latency_ms: number;
  latency_improvement_pct: number;
  days_active: number;
}

export interface DailyBreakdown {
  date: string;
  total_queries: number;
  substrate_hits: number;
  local_ollama_served: number;
  cloud_escalations: number;
  cloud_cost_avoided_usd: number;
  tokens_saved_est: number;
  avg_latency_ms: number;
}

export interface TelemetrySummary {
  session: PeriodStats;
  today: PeriodStats;
  week: PeriodStats;
  month: PeriodStats;
  daily_breakdown: DailyBreakdown[];
  all_time_cost_avoided_usd: number;
  all_time_tokens_saved: number;
  all_time_queries: number;
}

export interface FederationPeer {
  address: string;
  port: number;
  lastSeen: string;
  recordCount?: number;
}

export interface FederationStatus {
  online: boolean;
  peerCount: number;
  lastSyncTs: string | null;
  lastSyncRecordsExchanged: number;
  pendingWriteCount: number;
  peers: FederationPeer[];
}

// B69 — Hearth App Builder types
export interface HearthBuildResult {
  ok: boolean;
  appUuid?: string;
  appDir?: string;
  spec?: Record<string, unknown>;
  installerPath?: string;
  error?: string;
}

export interface HearthInstallOpts {
  uuid: string;
  appName: string;
  description: string;
  appDir: string;
  installerPath: string;
  spec: Record<string, unknown>;
}

export interface HearthApp {
  uuid: string;
  appName: string;
  description: string;
  appDir: string;
  installerPath?: string;
  installedAt: string;
  os: string;
  spec: Record<string, unknown>;
  buildStatus: 'built' | 'installed';
}

export interface HearthHealthz {
  status: 'ok' | 'degraded' | 'down';
  ollama_available: boolean;
  template_dir_present: boolean;
  recent_builds: number;
  recent_install_successes: number;
}

export interface HearthSpecSmokeResult {
  passed: boolean;
  latency_ms: number;
  error?: string;
}

export interface BuildProgress {
  status: string;
  message: string;
  percent?: number;
  error?: string;
  appUuid?: string;
  installerPath?: string;
}

// Phase 7 — Auth types
export type AuthStatus =
  | 'unauthenticated'
  | 'trial_active'
  | 'trial_expired'
  | 'member'
  | 'validating';

export interface MemberInfo {
  user_id: string;
  display_name: string;
  email: string;
  is_member: boolean;
  membership_expires?: string;
  badge_tier?: 'stamped' | 'ghost';
  avatar_url?: string;
}

export interface AuthState {
  status: AuthStatus;
  member?: MemberInfo;
  trial_started_ts?: number;
  trial_days_remaining?: number;
  token_expires?: number;
  degraded: boolean;
}

// ─── Bridge ───────────────────────────────────────────────────────────────────

contextBridge.exposeInMainWorld('amplify', {
  // ── Mode ──────────────────────────────────────────────────────────────────
  getFrameMode: (): Promise<FrameModePayload> =>
    ipcRenderer.invoke('get-frame-mode'),

  setFrameMode: (mode: FrameMode): void =>
    ipcRenderer.send('set-frame-mode', { mode }),

  forceFrameMode: (mode: FrameMode | null): Promise<{ ok: boolean; forced_mode: FrameMode | null }> =>
    ipcRenderer.invoke('force-frame-mode', { mode }),

  onFrameModeChanged: (cb: (payload: FrameModePayload) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: FrameModePayload) => cb(payload);
    ipcRenderer.on('frame-mode-changed', handler);
    return () => ipcRenderer.removeListener('frame-mode-changed', handler);
  },

  // ── Overlay ───────────────────────────────────────────────────────────────
  setClickthrough: (enabled: boolean): void =>
    ipcRenderer.send('set-clickthrough', { enabled }),

  // ── Ollama ────────────────────────────────────────────────────────────────
  getOllamaStatus: (): Promise<OllamaStatus> =>
    ipcRenderer.invoke('get-ollama-status'),

  pullDefaultModel: (): Promise<{ success: boolean; alreadyInstalled?: boolean; error?: string }> =>
    ipcRenderer.invoke('pull-default-model'),

  listOllamaModels: (): Promise<string[]> =>
    ipcRenderer.invoke('list-ollama-models'),

  checkDiskSpace: (): Promise<{ ok: boolean; requiredGB: number }> =>
    ipcRenderer.invoke('check-disk-space'),

  onOllamaPullProgress: (cb: (progress: ModelPullProgress) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: ModelPullProgress) => cb(progress);
    ipcRenderer.on('ollama-pull-progress', handler);
    return () => ipcRenderer.removeListener('ollama-pull-progress', handler);
  },

  // ── Substrate (Phase 3) ───────────────────────────────────────────────────

  /** Route a query through the three-mode substrate router (AI Burst / Normal / Fallback) */
  substrateQuery: (
    query: string,
    model?: string,
  ): Promise<SubstrateQueryResult> =>
    ipcRenderer.invoke('substrate-query', { query, model }),

  /** Write a new record to the local substrate index + queue federation sync */
  substrateWrite: (
    text: string,
    source?: string,
    keywords?: string[],
  ): Promise<{ ok: boolean; id?: string }> =>
    ipcRenderer.invoke('substrate-write', { text, source, keywords }),

  // ── Federation (Phase 3) ──────────────────────────────────────────────────

  getFederationStatus: (): Promise<FederationStatus> =>
    ipcRenderer.invoke('get-federation-status'),

  setMemberToken: (token: string | null): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('set-member-token', { token }),

  // ── AMPLIFY Telemetry ─────────────────────────────────────────────────────
  getAMPLIFYSnapshot: (): Promise<AMPLIFYSnapshot> =>
    ipcRenderer.invoke('get-amplify-snapshot'),

  /** Full historical summary — today / week / month / daily breakdown / all-time */
  getAMPLIFYSummary: (): Promise<TelemetrySummary> =>
    ipcRenderer.invoke('get-amplify-summary'),

  // ── Auto-Update ───────────────────────────────────────────────────────────
  getUpdateState: (): Promise<UpdateState> =>
    ipcRenderer.invoke('get-update-state'),

  checkForUpdates: (): void =>
    ipcRenderer.send('check-for-updates'),

  installUpdate: (): void =>
    ipcRenderer.send('install-update'),

  onUpdateStateChanged: (cb: (state: UpdateState) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, state: UpdateState) => cb(state);
    ipcRenderer.on('update-state-changed', handler);
    return () => ipcRenderer.removeListener('update-state-changed', handler);
  },

  // ── MoneyPenny Mobile ─────────────────────────────────────────────────────
  getMoneyPennyUrl: (): Promise<{ url: string; ips: string[]; port: number }> =>
    ipcRenderer.invoke('get-moneypenny-url'),

  // ── Auth (Phase 7) ────────────────────────────────────────────────────────
  getAuthState: (): Promise<AuthState> =>
    ipcRenderer.invoke('get-auth-state'),

  authSignIn: (): void =>
    ipcRenderer.send('auth-sign-in'),

  authSignOut: (): void =>
    ipcRenderer.send('auth-sign-out'),

  authStartTrial: (): void =>
    ipcRenderer.send('auth-start-trial'),

  authOpenJoin: (): void =>
    ipcRenderer.send('auth-open-join'),

  onAuthStateChanged: (cb: (state: AuthState) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, state: AuthState) => cb(state);
    ipcRenderer.on('auth-state-changed', handler);
    return () => ipcRenderer.removeListener('auth-state-changed', handler);
  },

  // ── Dashboard ─────────────────────────────────────────────────────────────
  openDashboard: (): void =>
    ipcRenderer.send('open-dashboard'),

  // ── Hearth App Builder (B69) ──────────────────────────────────────────────

  hearthBuild: (request: string, memberId?: string): Promise<HearthBuildResult> =>
    ipcRenderer.invoke('hearth-build', { request, memberId }),

  hearthInstall: (opts: HearthInstallOpts): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke('hearth-install', opts),

  hearthLibraryQuery: (memberId?: string): Promise<HearthApp[]> =>
    ipcRenderer.invoke('hearth-library-query', { memberId }),

  hearthUninstall: (uuid: string): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke('hearth-uninstall', { uuid }),

  hearthHealthz: (): Promise<HearthHealthz> =>
    ipcRenderer.invoke('hearth-healthz'),

  hearthSpecExtractSmoke: (): Promise<HearthSpecSmokeResult> =>
    ipcRenderer.invoke('hearth-spec-extract-smoke'),

  onHearthBuildProgress: (cb: (progress: BuildProgress) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: BuildProgress) => cb(progress);
    ipcRenderer.on('hearth-app-build-progress', handler);
    return () => ipcRenderer.removeListener('hearth-app-build-progress', handler);
  },

  onHearthBuildComplete: (cb: (result: { appUuid: string; appName: string; installerPath?: string; buildDurationMs: number }) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, result: { appUuid: string; appName: string; installerPath?: string; buildDurationMs: number }) => cb(result);
    ipcRenderer.on('hearth-app-build-complete', handler);
    return () => ipcRenderer.removeListener('hearth-app-build-complete', handler);
  },

  onHearthBuildError: (cb: (err: { appUuid: string; appName: string; error: string; lastStderr: string }) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, err: { appUuid: string; appName: string; error: string; lastStderr: string }) => cb(err);
    ipcRenderer.on('hearth-app-build-error', handler);
    return () => ipcRenderer.removeListener('hearth-app-build-error', handler);
  },

  // ── Hearth Conjunction Window (B83) ──────────────────────────────────────

  openHearthConjunction: (): void =>
    ipcRenderer.send('open-hearth-conjunction'),

  // BP041 SAGA 3 — Watch View toggle
  // hideToWatchView: hides the full window; frame border + OverlayTag remain visible.
  // showHearthConjunction (alias): restores window from Watch View.
  hideToWatchView: (): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('hide-to-watch-view'),

  showHearthConjunction: (): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('show-hearth-conjunction'),

  conjunctionGetState: (): Promise<import('./hearth/conjunction/types').ConjunctionPanelState> =>
    ipcRenderer.invoke('conjunction-get-state'),

  conjunctionGetAvailability: (): Promise<import('./hearth/conjunction/types').BackendAvailability> =>
    ipcRenderer.invoke('conjunction-get-availability'),

  conjunctionSelect: (mode: import('./hearth/conjunction/types').ConjunctionMode): Promise<{ ok: boolean; previous: import('./hearth/conjunction/types').ConjunctionMode }> =>
    ipcRenderer.invoke('conjunction-select', { mode }),

  conjunctionSetOverride: (mode: import('./hearth/conjunction/types').ConjunctionMode): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('conjunction-set-override', { mode }),

  conjunctionDispatch: (prompt: string, mode_override?: import('./hearth/conjunction/types').ConjunctionMode): Promise<import('./hearth/conjunction/types').ConjunctionResult> =>
    ipcRenderer.invoke('conjunction-dispatch', { prompt, mode_override }),

  conjunctionGetSubstrateContext: (): Promise<{ raw_preamble: string; thread_id: string | null; built_at: string }> =>
    ipcRenderer.invoke('conjunction-get-substrate-context'),

  // ── Drekaskip Status (B83c) ───────────────────────────────────────────────

  drekaskipQuery: (): Promise<{ active_saga: string | null; wave_count: number; wave_instances: unknown[] }> =>
    ipcRenderer.invoke('drekaskip-query'),

  // ── Adaptive Concurrency Carrier — Layer 4 hot-tune (BP041) ──────────────

  concurrencyGetCap: (): Promise<{ cap: number; probed_at: string | null; override: number | null; is_stale: boolean }> =>
    ipcRenderer.invoke('concurrency-get-cap'),

  concurrencyProbeNow: (): Promise<{ cap: number; probed_at: string; tier: string }> =>
    ipcRenderer.invoke('concurrency-probe-now'),

  concurrencySetOverride: (n: number | null): Promise<{ ok: boolean; effective_cap: number | null }> =>
    ipcRenderer.invoke('concurrency-set-override', { n }),

  // ── Watchdog Status (B83d) ────────────────────────────────────────────────

  watchdogStatus: (): Promise<{ subjects: unknown[]; watchdog_status: string; polled_at: string }> =>
    ipcRenderer.invoke('watchdog-status'),

  watchdogHistory: (subject: string, window_hours?: number): Promise<Array<{ ts: string; level: string; message: string }>> =>
    ipcRenderer.invoke('watchdog-history', { subject, window_hours }),

  // ── Webview preload path (B83b) ───────────────────────────────────────────

  getWebviewPreloadPath: (): string =>
    ipcRenderer.sendSync('get-webview-preload-path') as string,

  // ── On-Deck Master-of-Ceremonies (BP037) ──────────────────────────────────

  onDeckList: (): Promise<import('./on_deck/on_deck_bridge').OnDeckBridgePayload> =>
    ipcRenderer.invoke('on-deck-list'),

  // ── Pantheon — Pixie Dust Mining (BP041 SAGA 1) ───────────────────────────

  /** Open Electron native folder-picker dialog; returns selected folder path or null */
  pantheonPickFolder: (): Promise<string | null> =>
    ipcRenderer.invoke('pantheon-pick-folder'),

  /** Load per-folder dual-checkbox preferences for a member */
  pantheonGetPrefs: (memberId: string): Promise<import('./pantheon/folder_prefs').AllFolderPrefs> =>
    ipcRenderer.invoke('pantheon-get-prefs', { memberId }),

  /** Save per-folder dual-checkbox preference */
  pantheonSetPref: (
    memberId: string,
    folderPath: string,
    pixelated: boolean,
    federationShared: boolean,
    subfolderOverrides?: import('./pantheon/folder_prefs').SubfolderOverride[],
  ): Promise<import('./pantheon/folder_prefs').FolderPref> =>
    ipcRenderer.invoke('pantheon-set-pref', { memberId, folderPath, pixelated, federationShared, subfolderOverrides }),

  /** Remove a folder from the substrate scope */
  pantheonRemovePref: (memberId: string, folderPath: string): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('pantheon-remove-pref', { memberId, folderPath }),

  /** Dispatch the Pantheon on a specific folder (all 6 personas) */
  pantheonDispatch: (
    memberId: string,
    folderPath: string,
    sharingScope: 'private' | 'federation',
  ): Promise<import('./pantheon/types').PantheonDispatchReceipt> =>
    ipcRenderer.invoke('pantheon-dispatch', { memberId, folderPath, sharingScope }),

  /** Subscribe to Pantheon progress events */
  onPantheonProgress: (cb: (evt: import('./pantheon/types').PantheonIpcProgress) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, evt: import('./pantheon/types').PantheonIpcProgress) => cb(evt);
    ipcRenderer.on('pantheon-progress', handler);
    return () => ipcRenderer.removeListener('pantheon-progress', handler);
  },

  /** List all tablets for a member */
  pantheonListTablets: (
    memberId: string,
    grade?: 'iron' | 'stone',
    persona?: string,
  ): Promise<import('./pantheon/tablet_store').TabletSummary[]> =>
    ipcRenderer.invoke('pantheon-list-tablets', { memberId, grade, persona }),

  /** Count tablets for a member */
  pantheonCountTablets: (memberId: string): Promise<{ iron: number; stone: number; total: number }> =>
    ipcRenderer.invoke('pantheon-count-tablets', { memberId }),

  /** Wipe all tablets for a member (sovereignty right) */
  pantheonWipe: (memberId: string): Promise<{ wiped: number }> =>
    ipcRenderer.invoke('pantheon-wipe', { memberId }),

  /** Get active Pantheon sessions */
  pantheonActiveSessions: (): Promise<Array<{ session_id: string; started_at: string; folder_path: string; total_tablets_so_far: number }>> =>
    ipcRenderer.invoke('pantheon-active-sessions'),

  // ── Scribe Monitor — BP041 SAGA 2 ────────────────────────────────────────

  /** Toggle per-scribe metric monitoring ON/OFF */
  scribeToggleMonitor: (
    scribeId: string,
    on: boolean,
  ): Promise<{ ok: boolean; enabled: boolean; monitored_since: string | null }> =>
    ipcRenderer.invoke('scribe-toggle-monitor', { scribeId, on }),

  /**
   * Get aggregated metric summaries for given scribe IDs.
   * Pass an empty array to get initial enabled-state hydration for all known scribes.
   */
  scribeGetMetrics: (scribeIds: string[]): Promise<import('./hearth/active_substrate/scribe_monitor').ScribeMetricSummary[]> =>
    ipcRenderer.invoke('scribe-get-metrics', { scribeIds }),
});

// ─── Global type extension ────────────────────────────────────────────────────

declare global {
  interface Window {
    amplify: {
      // Mode
      getFrameMode: () => Promise<FrameModePayload>;
      setFrameMode: (mode: FrameMode) => void;
      forceFrameMode: (mode: FrameMode | null) => Promise<{ ok: boolean; forced_mode: FrameMode | null }>;
      onFrameModeChanged: (cb: (payload: FrameModePayload) => void) => () => void;
      // Overlay
      setClickthrough: (enabled: boolean) => void;
      // Ollama
      getOllamaStatus: () => Promise<OllamaStatus>;
      pullDefaultModel: () => Promise<{ success: boolean; alreadyInstalled?: boolean; error?: string }>;
      listOllamaModels: () => Promise<string[]>;
      checkDiskSpace: () => Promise<{ ok: boolean; requiredGB: number }>;
      onOllamaPullProgress: (cb: (progress: ModelPullProgress) => void) => () => void;
      // Substrate
      substrateQuery: (query: string, model?: string) => Promise<SubstrateQueryResult>;
      substrateWrite: (text: string, source?: string, keywords?: string[]) => Promise<{ ok: boolean; id?: string }>;
      // Federation
      getFederationStatus: () => Promise<FederationStatus>;
      setMemberToken: (token: string | null) => Promise<{ ok: boolean }>;
      // Telemetry
      getAMPLIFYSnapshot: () => Promise<AMPLIFYSnapshot>;
      getAMPLIFYSummary: () => Promise<TelemetrySummary>;
      // Auto-Update
      getUpdateState: () => Promise<UpdateState>;
      checkForUpdates: () => void;
      installUpdate: () => void;
      onUpdateStateChanged: (cb: (state: UpdateState) => void) => () => void;
      // MoneyPenny
      getMoneyPennyUrl: () => Promise<{ url: string; ips: string[]; port: number }>;
      // Auth (Phase 7)
      getAuthState: () => Promise<AuthState>;
      authSignIn: () => void;
      authSignOut: () => void;
      authStartTrial: () => void;
      authOpenJoin: () => void;
      onAuthStateChanged: (cb: (state: AuthState) => void) => () => void;
      // Dashboard
      openDashboard: () => void;
      // Hearth App Builder (B69)
      hearthBuild: (request: string, memberId?: string) => Promise<HearthBuildResult>;
      hearthInstall: (opts: HearthInstallOpts) => Promise<{ ok: boolean; error?: string }>;
      hearthLibraryQuery: (memberId?: string) => Promise<HearthApp[]>;
      hearthUninstall: (uuid: string) => Promise<{ ok: boolean; error?: string }>;
      hearthHealthz: () => Promise<HearthHealthz>;
      hearthSpecExtractSmoke: () => Promise<HearthSpecSmokeResult>;
      onHearthBuildProgress: (cb: (progress: BuildProgress) => void) => () => void;
      onHearthBuildComplete: (cb: (result: { appUuid: string; appName: string; installerPath?: string; buildDurationMs: number }) => void) => () => void;
      onHearthBuildError: (cb: (err: { appUuid: string; appName: string; error: string; lastStderr: string }) => void) => () => void;
      // Hearth Conjunction Window (B83)
      openHearthConjunction: () => void;
      // BP041 SAGA 3 — Watch View toggle
      hideToWatchView?: () => Promise<{ ok: boolean }>;
      showHearthConjunction?: () => Promise<{ ok: boolean }>;
      conjunctionGetState: () => Promise<unknown>;
      conjunctionGetAvailability: () => Promise<unknown>;
      conjunctionSelect: (mode: string) => Promise<{ ok: boolean; previous: string }>;
      conjunctionSetOverride: (mode: string) => Promise<{ ok: boolean }>;
      conjunctionDispatch: (prompt: string, mode_override?: string) => Promise<unknown>;
      conjunctionGetSubstrateContext: () => Promise<{ raw_preamble: string; thread_id: string | null; built_at: string }>;
      // Drekaskip (B83c)
      drekaskipQuery: () => Promise<{ active_saga: string | null; wave_count: number; wave_instances: unknown[] }>;
      // Adaptive Concurrency Carrier — Layer 4 (BP041)
      concurrencyGetCap: () => Promise<{ cap: number; probed_at: string | null; override: number | null; is_stale: boolean }>;
      concurrencyProbeNow: () => Promise<{ cap: number; probed_at: string; tier: string }>;
      concurrencySetOverride: (n: number | null) => Promise<{ ok: boolean; effective_cap: number | null }>;
      // Watchdog (B83d)
      watchdogStatus: () => Promise<{ subjects: unknown[]; watchdog_status: string; polled_at: string }>;
      watchdogHistory: (subject: string, window_hours?: number) => Promise<Array<{ ts: string; level: string; message: string }>>;
      // Webview preload path (B83b)
      getWebviewPreloadPath?: () => string;
      // On-Deck Master-of-Ceremonies (BP037)
      onDeckList?: () => Promise<import('./on_deck/on_deck_bridge').OnDeckBridgePayload>;
      // Pantheon — Pixie Dust Mining (BP041 SAGA 1)
      pantheonPickFolder: () => Promise<string | null>;
      pantheonGetPrefs: (memberId: string) => Promise<unknown>;
      pantheonSetPref: (memberId: string, folderPath: string, pixelated: boolean, federationShared: boolean, subfolderOverrides?: unknown[]) => Promise<unknown>;
      pantheonRemovePref: (memberId: string, folderPath: string) => Promise<{ ok: boolean }>;
      pantheonDispatch: (memberId: string, folderPath: string, sharingScope: 'private' | 'federation') => Promise<unknown>;
      onPantheonProgress: (cb: (evt: unknown) => void) => () => void;
      pantheonListTablets: (memberId: string, grade?: string, persona?: string) => Promise<unknown[]>;
      pantheonCountTablets: (memberId: string) => Promise<{ iron: number; stone: number; total: number }>;
      pantheonWipe: (memberId: string) => Promise<{ wiped: number }>;
      pantheonActiveSessions: () => Promise<unknown[]>;
      // Scribe Monitor — BP041 SAGA 2
      scribeToggleMonitor?: (scribeId: string, on: boolean) => Promise<{ ok: boolean; enabled: boolean; monitored_since: string | null }>;
      scribeGetMetrics?: (scribeIds: string[]) => Promise<Array<{
        scribe_id: string;
        monitor_enabled: boolean;
        monitored_since: string | null;
        event_count: number;
        total_speed_delta_ms: number;
        total_accuracy_delta: number;
        total_cost_delta_tokens: number;
        avg_speed_delta_ms: number;
        avg_accuracy_delta: number;
        avg_cost_delta_tokens: number;
        last_updated: string | null;
      }>>;
    };
  }
}
