// AMPLIFY Computer — Electron Preload
// B37 Phase 1-3 — Exposes safe IPC bridge to renderer via contextBridge
// Phase 3 additions: substrate query/write, federation status, force-mode

// SEG-FIX-2 BP078 (v0.1.38): In Electron 31 sandboxed preloads, contextBridge and
// ipcRenderer are NOT injected as globals. They MUST be obtained via require('electron').
// The SEG-FIX-1 change (declare const) was incorrect for Electron 31 -- it caused
// ReferenceError: ipcRenderer is not defined at line 8 (confirmed via CDP runtime probe,
// root cause of 5-version P0 across v0.1.32-v0.1.37). Reverted to correct require pattern.
// SEG-V0150-P0-DIAGNOSE-BRIDGE: tsc with "module": "CommonJS" compiles the import form to
// require('electron') at runtime -- both forms are equivalent. assert-preload-sandbox.mjs
// confirms acquisition is present in compiled output. import form is canonical per BP079.
import { contextBridge, ipcRenderer } from 'electron';

// SEG-V0150-P0-DIAGNOSE-BRIDGE: sentinel exposed early — renderer reads window.__preloadLoaded
// to confirm preload executed before the main amplify bridge is wired up.
try { contextBridge.exposeInMainWorld('__preloadLoaded', true); } catch (_e) { /* noop if duplicate */ }

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
  status: string;
  phase: 'manifest' | 'downloading' | 'verifying' | 'writing' | 'success' | 'error';
  completed?: number;
  total?: number;
  layerIndex?: number;
  layerCount?: number;
  digest?: string;
  percentComplete?: number;
  error?: string;
  // Legacy fields (kept for backward compatibility)
  bytesDownloaded?: number;
  totalBytes?: number;
}

// BP078 Scope 6.5 -- SKU pull progress
export interface SkuPullProgress {
  downloaded: number;   // bytes downloaded
  total: number;        // total bytes (0 if unknown)
  speed?: string;       // e.g. "12.3 MB/s"
  status?: string;      // raw ollama status line
}

export interface EngineSetupProgress {
  step: string;
  message: string;
  detail?: string;
  percentComplete?: number;
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

// ── The Crystal -- durable chonk-handle store (KN-BP147-M2, D-BP147-005) ──────────────────
// Wire shapes mirroring src/main/crystal/crystal_types.ts (KN-BP147-M1, commit ccae7f1c).
// Duplicated here rather than imported at runtime because these are used only as TYPES on the
// renderer-facing side of the bridge -- the Crystal itself is main-process-only and the
// renderer never touches its files or its module directly, only these five IPC channels below.
export interface CrystalBindingTarget {
  targetType: string;
  ref: string;
  meta?: Record<string, unknown>;
}

export type CrystalMutationReason = 'superseded_source' | 'failed_resolution' | 'explicit_ratification';

export interface CrystalBindResult {
  ok: boolean;
  sid: string;
  key: string;
  accepted:
    | 'appended'
    | 'idempotent-noop'
    | 'rejected-additive-only'
    | 'rejected-invalid-reason'
    | 'superseded';
  error?: string;
  supersededSiblingPath?: string;
}

export interface CrystalResolvedChonk {
  sid: string;
  pearls: string[];
  bindings: Record<string, CrystalBindingTarget>;
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

  // KniPr012 — check if Ollama binary is installed (not just daemon running)
  checkOllama: (): Promise<{ installed: boolean; version?: string }> =>
    ipcRenderer.invoke('check-ollama'),

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

  // SEG-U-6: pull a specific named model with streaming progress events
  pullNamedModel: (modelName: string): Promise<{ success: boolean; alreadyInstalled?: boolean; error?: string }> =>
    ipcRenderer.invoke('pull-named-model', { modelName }),

  // SEG-V-1: live 3-branch pre-flight -- reachable? + model present? (reused by SEG-V-4)
  checkOllamaAndModel: (modelName: string): Promise<{ reachable: boolean; hasModel: boolean; models: string[] }> =>
    ipcRenderer.invoke('check-ollama-and-model', { modelName }),

  // BP067 v0.1.24 — transparent install + floor model
  setupPrivateAI: (): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke('setup-private-ai'),

  markBp067FirstRunComplete: (): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('mark-bp067-first-run-complete'),

  askFloorModel: (prompt: string): Promise<{ ok: boolean; text?: string; error?: string }> =>
    ipcRenderer.invoke('ask-floor-model', { prompt }),

  onEngineSetupProgress: (cb: (progress: EngineSetupProgress) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: EngineSetupProgress) => cb(progress);
    ipcRenderer.on('engine-setup-progress', handler);
    return () => ipcRenderer.removeListener('engine-setup-progress', handler);
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

  // ── App Version (MV-VERSION-DISPLAY BP044) ───────────────────────────────
  getAppVersion: (): Promise<{ version: string; buildHash: string }> =>
    ipcRenderer.invoke('get-app-version'),

  // ── Auto-Update ───────────────────────────────────────────────────────────
  getUpdateState: (): Promise<UpdateState> =>
    ipcRenderer.invoke('get-update-state'),

  checkForUpdates: (): void =>
    ipcRenderer.send('check-for-updates'),

  installUpdate: (): void =>
    ipcRenderer.send('install-update'),

  // BP067 Phase 1D — user-triggered download (safe tier: no auto-download on unsigned binary)
  downloadUpdate: (): void =>
    ipcRenderer.send('download-update'),

  // 1D-FIX — opt-out toggle for autoInstallOnAppQuit (persisted in renderer localStorage)
  setAutoInstallOnQuit: (enabled: boolean): void =>
    ipcRenderer.send('set-auto-install-on-quit', enabled),

  // M21: Automatic update scheduler config (Block 1-6)
  getAutoUpdateConfig: (): Promise<import('../main/auto_update_scheduler').AutoUpdateConfig> =>
    ipcRenderer.invoke('get-auto-update-config'),
  setAutoUpdateConfig: (cfg: Partial<import('../main/auto_update_scheduler').AutoUpdateConfig>): Promise<import('../main/auto_update_scheduler').AutoUpdateConfig> =>
    ipcRenderer.invoke('set-auto-update-config', cfg),
  getUpdateHistory: (): Promise<Record<string, unknown>[]> =>
    ipcRenderer.invoke('get-update-history'),
  approveAutoUpdateInstall: (readyPath: string): void =>
    ipcRenderer.send('auto-update-approve-install', readyPath),
  onAutoUpdatePatchReady: (cb: (data: { version: string }) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { version: string }) => cb(data);
    ipcRenderer.on('auto-update-patch-ready', handler);
    return () => ipcRenderer.removeListener('auto-update-patch-ready', handler);
  },
  onAutoUpdateMajorAvailable: (cb: (data: { version: string }) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { version: string }) => cb(data);
    ipcRenderer.on('auto-update-major-available', handler);
    return () => ipcRenderer.removeListener('auto-update-major-available', handler);
  },
  onAutoUpdateApproveRequired: (cb: (data: { version: string; readyPath: string }) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { version: string; readyPath: string }) => cb(data);
    ipcRenderer.on('auto-update-approve-required', handler);
    return () => ipcRenderer.removeListener('auto-update-approve-required', handler);
  },

  onUpdateStateChanged: (cb: (state: UpdateState) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, state: UpdateState) => cb(state);
    ipcRenderer.on('update-state-changed', handler);
    return () => ipcRenderer.removeListener('update-state-changed', handler);
  },

  // ── Mesh Trust / Peer Verification (D-BP148-038 Authorizations panel) ───
  // Bridges the two IPC handlers mesh_trust_settings.ts's registerMeshTrustSettingsIpc()
  // already registers at app boot (src/main/index.ts) -- that setting has genuinely
  // enforced since KN-BP144-16 (peer_server.ts /api/plow-domain, constellation_discovery.ts
  // both fail closed on an unsigned peer unless this flag is true), but until this ticket no
  // preload channel existed to read or flip it from any renderer. See
  // src/main/federation/mesh_trust_settings.ts's own header for the exact one-thing this
  // setting governs (tolerating an ABSENT signature only -- a present-but-failing signature
  // is refused unconditionally regardless of this flag).
  getMeshTrustSettings: (): Promise<{ allowUnauthenticatedLanDiscovery: boolean }> =>
    ipcRenderer.invoke('mesh-trust:get-settings'),
  setMeshTrustAllowUnauthenticatedLanDiscovery: (allow: boolean): Promise<{ allowUnauthenticatedLanDiscovery: boolean }> =>
    ipcRenderer.invoke('mesh-trust:set-allow-unauthenticated-lan-discovery', allow),

  // ── MV-CN Peer Mesh (SAGA 3 BP045 W1) ───────────────────────────────────
  getMeshState: (): Promise<{ peers: unknown[]; relayConnected: boolean; ownPeerId: string }> =>
    ipcRenderer.invoke('get-mesh-state'),

  getOwnPeerId: (): Promise<string> =>
    ipcRenderer.invoke('get-own-peer-id'),

  getMachineLabel: (): Promise<string> =>
    ipcRenderer.invoke('get-machine-label'),

  setMachineLabel: (label: string): Promise<string> =>
    ipcRenderer.invoke('set-machine-label', label),

  getBootZombieCount: (): Promise<{ count: number }> =>
    ipcRenderer.invoke('get-boot-zombie-count'),

  callTestMyBox: (peerId?: string): Promise<{
    ok: boolean;
    answer?: string;
    correct_answer?: string;
    wall_clock_s?: number;
    processing_ms?: number;
    error?: string;
  }> => ipcRenderer.invoke('call-test-my-box', peerId),

  onBootZombieFlush: (cb: (data: { count: number }) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { count: number }) => cb(data);
    ipcRenderer.on('boot-zombie-flush', handler);
    return () => ipcRenderer.removeListener('boot-zombie-flush', handler);
  },

  // BP086 F4b: relay tier from wan-relay-publish
  getRelayTier: (): Promise<{ tier: string }> =>
    ipcRenderer.invoke('get-relay-tier'),

  // ── MESH-6: Federation invite/accept/leave + SID fetch ───────────────────
  federationGenerateInvite: (): Promise<{ token: string; expiresAt: string }> =>
    ipcRenderer.invoke('federation:generate-invite'),

  federationAcceptInvite: (token: string): Promise<{ success: boolean; peerName?: string; error?: string }> =>
    ipcRenderer.invoke('federation:accept-invite', token),

  federationRejectInvite: (data: { invite_token: string; source: string }): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke('federation:reject-invite', data),

  federationLeavePeer: (peerId: string): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('federation:leave-peer', peerId),

  federationFetchSid: (dag_id: string, peerId: string): Promise<{ ok: boolean; node?: unknown; hash_verified: boolean; error?: string }> =>
    ipcRenderer.invoke('federation:fetch-sid', dag_id, peerId),

  // SEG-5 v0.1.56 — connect to a known peer by ID (optionally via relayUrl)
  federationConnectPeer: (peerId: string, relayUrl?: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('federation:connect-peer', { peerId, relayUrl }),

  // BP134 Yoke #30 Task B — zero-config WAN auto-connect from peer_presence
  federationAutoConnectPresence: (): Promise<{ attempted: number; connected: string[]; error?: string }> =>
    ipcRenderer.invoke('federation:auto-connect-presence'),

  // SEG-3 v0.1.55 — COMMUNITY-CONNECT first-launch seed peer handshake
  communityConnectHandshake: (): Promise<{ success: boolean; peerName?: string; error?: string }> =>
    ipcRenderer.invoke('community-connect-handshake'),

  // BP084 SEG-3 — Substrate Awakens join flow
  substrateAwakensRegister: (email: string, displayName: string, ramTier: string): Promise<{ success: boolean; message?: string; error?: string }> =>
    ipcRenderer.invoke('substrate-awakens:register', { email, displayName, ramTier }),

  substrateAwakensHandshake: (token: string, email: string, displayName: string): Promise<{ success: boolean; peerId?: string; displayName?: string; error?: string }> =>
    ipcRenderer.invoke('substrate-awakens:handshake', { token, email, displayName }),

  substrateAwakensGetState: (): Promise<{ joined: boolean; peerId?: string; displayName?: string; joinedAt?: string } | null> =>
    ipcRenderer.invoke('substrate-awakens:get-state'),

  // SEG-5 v0.1.56 — silent email stub (infrastructure-only; no credentials wired)
  sendSilentEmail: (args?: unknown): Promise<{ success: boolean; reason: string }> =>
    ipcRenderer.invoke('send-silent-email', args),

  onRelayStateChanged: (cb: (state: { relayConnected: boolean }) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, state: { relayConnected: boolean }) => cb(state);
    ipcRenderer.on('relay-state-changed', handler);
    return () => ipcRenderer.removeListener('relay-state-changed', handler);
  },

  onWanStatusUpdate: (cb: (payload: { status: string; ts: string }) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: { status: string; ts: string }) => cb(payload);
    ipcRenderer.on('wan-status-update', handler);
    return () => ipcRenderer.removeListener('wan-status-update', handler);
  },

  onMeshStateChanged: (cb: (state: unknown) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, state: unknown) => cb(state);
    ipcRenderer.on('mesh-state-changed', handler);
    return () => ipcRenderer.removeListener('mesh-state-changed', handler);
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

  // ── Grand Central board panel (KN-BP144-10) ───────────────────────────────
  // Read-only observer, ported from HARDWIRE/tools/board.mjs. Renderer never touches the
  // filesystem or spawns git itself -- both calls just read/nudge the main-side cache.

  boardGetState: (): Promise<import('./board/board_state_reader').BoardSnapshot | null> =>
    ipcRenderer.invoke('board-get-state'),

  boardMarkDispatched: (
    id: string,
  ): Promise<{ ok: boolean; dispatchedAt?: string; snapshot?: import('./board/board_state_reader').BoardSnapshot | null; error?: string }> =>
    ipcRenderer.invoke('board-mark-dispatched', { id }),

  // BP148 D-BP148-028: the Verify button. Read-only -- searches both repos' real git history
  // (and working-tree status) for the ticket's own claimed files; never modifies anything.
  boardVerifyOrphan: (
    id: string,
  ): Promise<import('./board/board_verify').VerifyOrphanResult> =>
    ipcRenderer.invoke('board-verify-orphan', { id }),

  // BP148 D-BP148-031: alarm dismiss/acknowledge, persisted + recoverable (see
  // board_alarm_actions.ts). Works for any alarm kind.
  boardAlarmDismiss: (
    key: string,
    kind: import('../shared/board/alarm_key').AlarmKind,
    message: string,
    note?: string | null,
  ): Promise<import('../shared/board/alarm_key').AlarmDismissal | { error: string }> =>
    ipcRenderer.invoke('board-alarm-dismiss', { key, kind, message, note: note ?? null }),

  boardAlarmRestore: (
    key: string,
  ): Promise<import('../shared/board/alarm_key').AlarmDismissal | { error: string }> =>
    ipcRenderer.invoke('board-alarm-restore', { key }),

  boardAlarmListDismissals: (): Promise<import('../shared/board/alarm_key').AlarmDismissal[]> =>
    ipcRenderer.invoke('board-alarm-list-dismissals'),

  // BP148 D-BP148-031: the three real UNOWNED actions -- commit / park to a branch / discard.
  // All explicit-path-only (never -A/./glob); see board_alarm_actions.ts for the full safety
  // discipline. Discard is destructive and requires confirm:true.
  boardUnownedCommit: (
    files: string[],
    message: string,
  ): Promise<import('./board/board_alarm_actions').CommitUnownedResult> =>
    ipcRenderer.invoke('board-unowned-commit', { files, message }),

  boardUnownedPark: (
    files: string[],
    branchName: string,
    message?: string,
  ): Promise<import('./board/board_alarm_actions').ParkUnownedResult> =>
    ipcRenderer.invoke('board-unowned-park', { files, branchName, message }),

  boardUnownedDiscard: (
    files: string[],
    confirm: boolean,
  ): Promise<import('./board/board_alarm_actions').DiscardUnownedResult> =>
    ipcRenderer.invoke('board-unowned-discard', { files, confirm }),

  // ── Webview preload path (B83b) ───────────────────────────────────────────

  getWebviewPreloadPath: (): string =>
    ipcRenderer.sendSync('get-webview-preload-path') as string,

  // ── Browser-authority Nexus IPC leg (BP137 Yoke v2b Integration-1, Part 2) ──
  // Wraps ipcRenderer.invoke against the 'nexus-browser-authority-run-query' channel index.ts's
  // registerIPCHandlers() registers (see runBrowserAuthorityQueryFromMain() there for the actual
  // forward-to-hearth-window mechanism). Resolves null -- never a fabricated extraction -- when
  // no hearth window is open or the browser tab isn't active; see that function's header for the
  // full honest-null-path enumeration. plow_mc_answerer.ts's lookup_fact branch is the primary
  // caller (via a direct in-process function call, not this bridge -- both processes are main),
  // but this contextBridge method exists so a renderer-side caller could reach the exact same
  // code path in the future, following the same convention every other sibling method here does.
  runBrowserAuthorityQuery: (
    query: import('../shared/plow/browser_authority_types').BrowserAuthorityQuery,
  ): Promise<import('../shared/plow/browser_authority_types').BrowserAuthorityRawExtraction | null> =>
    ipcRenderer.invoke('nexus-browser-authority-run-query', query),

  // D-BP149-034/BISHOP/S34/seg-lianaterminal -- the Liana Cycle terminal. lianaTerminalRun drives
  // the ported founder_cascade_v2.mjs cascade in the main process (liana_terminal_engine.ts) and
  // resolves once the run completes; onLianaTerminalEvent subscribes to the live stage-by-stage
  // transcript pushed via 'liana-terminal-event' (event.sender.send in index.ts's handler) as the
  // run happens, so the left pane renders it in real time rather than waiting for the final
  // resolve. Mirrors the onAskEngineProgress push convention already used by the Ask tab.
  lianaTerminalRun: (
    input: string,
    /** D-BP150-001 (Call an Audible), ADDITIVE/OPTIONAL. Omitted or false = the run this function
     *  has always produced. True = the run stops before every Google query and again on what
     *  comes back, until the operator says go. */
    audible?: boolean,
    /** D-BP151-023 (Stepped Audible), ADDITIVE/OPTIONAL, independent of `audible` above. Omitted
     *  or false = no per-step pausing. True = the run stops once per Founder-mapped step
     *  (comparative-cascade only -- see stepped_audible.ts's header), after it completes and
     *  before the next begins, until the operator responds. */
    steppedAudible?: boolean,
  ): Promise<import('../shared/liana_cycle/liana_terminal_types').LianaTerminalOutcome> =>
    ipcRenderer.invoke('liana-terminal-run', { input, audible, steppedAudible }),

  onLianaTerminalEvent: (
    cb: (evt: import('../shared/liana_cycle/liana_terminal_types').LianaTerminalEvent) => void,
  ): (() => void) => {
    const h = (_event: Electron.IpcRendererEvent, evt: import('../shared/liana_cycle/liana_terminal_types').LianaTerminalEvent) => cb(evt);
    ipcRenderer.on('liana-terminal-event', h);
    return () => ipcRenderer.removeListener('liana-terminal-event', h);
  },

  // D-BP150-001/BISHOP/S01/seg-audible -- CALL AN AUDIBLE.
  //
  // onLianaAudiblePause fires when the engine has stopped and is waiting on the operator. It
  // pushes the pause over 'liana-audible-pause' (event.sender.send, same convention as
  // 'liana-terminal-event' above) rather than being polled, because a pause has no duration to
  // poll for -- it lasts exactly as long as the Founder takes.
  //
  // lianaAudibleRespond is the ONLY way a pause is answered. It echoes the pauseId back so a
  // late reply from a panel that has already moved on cannot resolve the wrong pause; index.ts
  // returns {ok:false, reason:'no_such_pause'} for that case rather than throwing.
  onLianaAudiblePause: (
    cb: (pause: import('../shared/liana_cycle/liana_terminal_types').LianaAudiblePause) => void,
  ): (() => void) => {
    const h = (_event: Electron.IpcRendererEvent, pause: import('../shared/liana_cycle/liana_terminal_types').LianaAudiblePause) => cb(pause);
    ipcRenderer.on('liana-audible-pause', h);
    return () => ipcRenderer.removeListener('liana-audible-pause', h);
  },

  lianaAudibleRespond: (
    response: import('../shared/liana_cycle/liana_terminal_types').LianaAudibleResponse,
  ): Promise<{ ok: boolean; reason?: string }> =>
    ipcRenderer.invoke('liana-audible-respond', response),

  // D-BP151-023/BISHOP/seg-stepped-audible -- STEPPED AUDIBLE, one pause per Founder-mapped step
  // rather than one pause per Google call. Same push/respond convention as onLianaAudiblePause /
  // lianaAudibleRespond above, one level up.
  onLianaSteppedPause: (
    cb: (pause: import('../shared/liana_cycle/liana_terminal_types').LianaSteppedPause) => void,
  ): (() => void) => {
    const h = (_event: Electron.IpcRendererEvent, pause: import('../shared/liana_cycle/liana_terminal_types').LianaSteppedPause) => cb(pause);
    ipcRenderer.on('liana-stepped-pause', h);
    return () => ipcRenderer.removeListener('liana-stepped-pause', h);
  },

  lianaSteppedRespond: (
    response: import('../shared/liana_cycle/liana_terminal_types').LianaSteppedResponse,
  ): Promise<{ ok: boolean; reason?: string }> =>
    ipcRenderer.invoke('liana-stepped-respond', response),

  // D-BP150-002/BISHOP/S02/seg-notesrecall -- the operator's already-written teaching notes,
  // readable from inside a live pause so he can insert one instead of retyping it from memory.
  // READ-ONLY: nothing on this channel writes, edits, or deletes a teaching file.
  lianaNotesList: (
    label?: string,
  ): Promise<{
    ok: boolean;
    files: import('../shared/liana_cycle/liana_terminal_types').LianaTeachingFile[];
    error?: string;
  }> => ipcRenderer.invoke('liana-notes-list', { label }),

  // D-BP149-043/BISHOP/S43/seg-method2build -- THE TEACH BOX. Wraps 'liana-teach-submit'
  // (index.ts, registered next to 'liana-terminal-run' above). Writes the operator's own words,
  // VERBATIM, to a teaching file in BISHOP_DROPZONE for a human to read and implement from --
  // never auto-generates a method, never paraphrases what was typed.
  lianaTeachSubmit: (args: {
    teachingText: string;
    question: string;
    options: Record<string, string> | null;
    qid?: number;
    shapeTestSummary: string;
    // D-BP149-044/BISHOP/S44/seg-steppedmode -- ADDITIVE. See index.ts's 'liana-teach-submit'
    // handler for the full contract; present only for a stepped-walk submission.
    steppedWalk?: {
      steps: Array<{
        index: number;
        total: number;
        lines: Array<{ kind: string; text: string; ts: string }>;
        response: string;
      }>;
      abandoned: boolean;
      abandonedAtStep?: number;
    };
  }): Promise<{ ok: boolean; filePath?: string; bytes?: number; error?: string }> =>
    ipcRenderer.invoke('liana-teach-submit', args),

  // ── Nexus Authority persistent session (BP137 0.9.12 Stage F1) ─────────────
  // Thin wraps around the four IPC channels index.ts's registerIPCHandlers() registers next to
  // 'nexus-browser-authority-run-query' above -- see nexus_authority_persistent_session.ts's
  // header for the real mechanism. Used by the Settings "Authorities" panel
  // (NexusAuthoritySignInPanel.tsx) and by the persistent session's own inline embedder-page
  // script (its "Done -- hide" button calls hideNexusAuthoritySession() directly).
  setNexusAuthorityBrowserFlags: (
    researchArmMode: boolean,
    researchArmBrowserAuthority: boolean,
  ): Promise<{ ok: boolean; enabled: boolean }> =>
    ipcRenderer.invoke('nexus-authority-set-flags', { researchArmMode, researchArmBrowserAuthority }),

  // BP140-K4: widened to import['...'].BrowserAuthorityName (now 5 members: user_google/
  // user_perplexity/user_claude/user_chatgpt/user_gemini) instead of a hand-copied 3-member
  // literal union, so this signature can never silently drift from the shared source of truth.
  openNexusAuthoritySignIn: (
    authority: import('../shared/plow/browser_authority_types').BrowserAuthorityName,
  ): Promise<{ ok: boolean; reason: string | null }> =>
    ipcRenderer.invoke('nexus-authority-open-signin', { authority }),

  hideNexusAuthoritySession: (): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('nexus-authority-hide-signin'),

  checkNexusAuthoritySignInStatus: (): Promise<{
    enabled: boolean;
    statuses: Array<{ authority: import('../shared/plow/browser_authority_types').BrowserAuthorityName; signedIn: boolean; reason: string; checkedAt: string }>;
  }> => ipcRenderer.invoke('nexus-authority-check-signin-status'),

  // BP138 Yoke 0.9.15 FIX 4 -- Ask tab's raw-fact lookup entry point. Wraps
  // 'nexus-ask-lookup-fact' (index.ts's registerIPCHandlers(), registered alongside the other
  // nexus-authority-* channels above). See that handler's own comment for the full mechanism;
  // LeanAskTab.tsx is the caller (flag-gated by nexus_authority_settings_store.ts's own
  // researchArmMode/researchArmBrowserAuthority check BEFORE ever invoking this).
  nexusAskLookupFact: (question: string): Promise<{
    answerType: 'computable' | 'lookup_fact' | 'reasoning';
    usable: boolean;
    // BP139: additive reason codes so a not-usable result can be told apart -- 'not_lookup_fact'
    // (classifier said no), 'flag_off' (research-arm flags disabled), or 'authority_empty' (both
    // authorities were tried and neither returned a usable fact). Diagnostic only; LeanAskTab.tsx's
    // honest fallthrough-to-local behavior does not change based on which one it is.
    reason?: 'flag_off' | 'not_lookup_fact' | 'authority_empty';
    fact?: string;
    sourceUrl?: string;
    authority?: 'user_google' | 'user_perplexity';
    confidence?: number;
    // BP148 D-BP148-029 (per-arm routing) -- ADDITIVE fields, always present once the flag-off/
    // not-lookup-fact early returns are past. perArmAssignedAuthority is whatever the per-arm
    // picker (NexusAuthoritySettings.tsx) has stored for the 'lookup_fact' arm, or null if it
    // could not be read (treated as unassigned). perArmRestrictedTo is non-null only when that
    // assignment restricted the attempt to a single authority. perArmFellBack is true when a
    // restricted attempt came back empty and the handler tried the other authority too, in which
    // case perArmFallbackReason explains why -- see index.ts's handler header for the full
    // mechanism. None of these change usable/fact/reason's existing meaning or presence.
    perArmAssignedAuthority?: 'local_free' | 'user_google' | 'user_perplexity' | 'paid_api' | null;
    perArmRestrictedTo?: 'user_google' | 'user_perplexity' | null;
    perArmFellBack?: boolean;
    perArmFallbackReason?: 'assigned_authority_unavailable';
  }> => ipcRenderer.invoke('nexus-ask-lookup-fact', { question }),

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

  // ── In Conjunction Agent Panel — SAGA 4 BP041 ────────────────────────────

  /**
   * Run static + live probe for an agent.
   * Returns AgentProbeResult — status only, never key values (R16 compliant).
   */
  agentProbe: (
    agentId: string,
    opts?: { force?: boolean; modelId?: string },
  ): Promise<{ agentId: string; status: string; reason?: string; probed_at?: string }> =>
    ipcRenderer.invoke('agent-probe', { agentId, ...opts }),

  /**
   * Set API key for an agent.
   * Key value flows INTO main process; is never returned back (R16 / NO-API-KEY-EXPOSURE).
   * Returns { ok, error? } only — key value is never echoed.
   */
  agentSetApiKey: (
    agentId: string,
    keyValue: string,
  ): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke('agent-set-api-key', { agentId, keyValue }),

  /**
   * Get API key presence status for all agents.
   * Returns Record<agentId, isSet> — values are boolean only (R16 compliant).
   */
  agentGetApiKeyStatus: (): Promise<Record<string, boolean>> =>
    ipcRenderer.invoke('agent-get-api-key-status'),

  /**
   * Get tier choices persisted at ~/.lb_substrate/in_conjunction_tiers.json.
   */
  agentGetTierChoices: (): Promise<Record<string, string>> =>
    ipcRenderer.invoke('agent-get-tier-choices'),

  /**
   * Persist tier choice for an agent.
   */
  agentSetTierChoice: (agentId: string, tierId: string): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('agent-set-tier-choice', { agentId, tierId }),

  /**
   * Get loaded plugin agents (from ~/.lb_substrate/plugins/agents/*.json).
   */
  agentGetPlugins: (): Promise<Array<{
    id: string;
    displayName: string;
    subtitle: string;
    icon: string;
    tiers?: Array<{ id: string; label: string; tierClass: string; modelId: string }>;
    requiresKey?: string;
    source: string;
  }>> =>
    ipcRenderer.invoke('agent-get-plugins'),

  /**
   * Get plugin registry metadata (id, filename, ipLedgerRef, authorHandle, loadedAt).
   */
  agentGetPluginRegistry: (): Promise<Array<{
    id: string;
    filename: string;
    displayName: string;
    ipLedgerRef?: string;
    authorHandle?: string;
    loadedAt: string;
  }>> =>
    ipcRenderer.invoke('agent-get-plugin-registry'),

  // ── Kitchen Table™ + Recipes™ + Atlas™ (BP052 v0.1.8) ────────────────────
  kitchenTable: {
    listSessions: () => ipcRenderer.invoke('kitchen-table:list-sessions'),
    getSession: (id: string) => ipcRenderer.invoke('kitchen-table:get-session', { id }),
    createSession: (data: unknown) => ipcRenderer.invoke('kitchen-table:create-session', data),
    updateSession: (id: string, data: unknown) => ipcRenderer.invoke('kitchen-table:update-session', { id, data }),
    deleteSession: (id: string) => ipcRenderer.invoke('kitchen-table:delete-session', { id }),
    listRecipes: () => ipcRenderer.invoke('kitchen-table:list-recipes'),
    getRecipe: (id: string) => ipcRenderer.invoke('kitchen-table:get-recipe', { id }),
    createRecipe: (data: unknown) => ipcRenderer.invoke('kitchen-table:create-recipe', data),
    updateRecipe: (id: string, data: unknown) => ipcRenderer.invoke('kitchen-table:update-recipe', { id, data }),
    deleteRecipe: (id: string) => ipcRenderer.invoke('kitchen-table:delete-recipe', { id }),
    listAtlasEvents: () => ipcRenderer.invoke('kitchen-table:list-atlas-events'),
    getAtlasEvent: (id: string) => ipcRenderer.invoke('kitchen-table:get-atlas-event', { id }),
    createAtlasEvent: (data: unknown) => ipcRenderer.invoke('kitchen-table:create-atlas-event', data),
    updateAtlasEvent: (id: string, data: unknown) => ipcRenderer.invoke('kitchen-table:update-atlas-event', { id, data }),
    deleteAtlasEvent: (id: string) => ipcRenderer.invoke('kitchen-table:delete-atlas-event', { id }),
    openPhotoDialog: () => ipcRenderer.invoke('kitchen-table:open-photo-dialog'),
    p2pStart: (peerId: string, displayName: string) => ipcRenderer.invoke('kitchen-table:p2p-start', { peerId, displayName }),
    p2pStop: () => ipcRenderer.invoke('kitchen-table:p2p-stop'),
    p2pPeers: () => ipcRenderer.invoke('kitchen-table:p2p-peers'),
  },

  // ── SubstratedFolderWatcher™ (SAGA-γ v0.1.10) ────────────────────────────
  watcher: {
    addFolder: (folderPath: string): Promise<unknown> =>
      ipcRenderer.invoke('watcher:add-folder', folderPath),

    removeFolder: (folderId: string): Promise<boolean> =>
      ipcRenderer.invoke('watcher:remove-folder', folderId),

    listFolders: (): Promise<unknown[]> =>
      ipcRenderer.invoke('watcher:list-folders'),

    getStats: (): Promise<unknown> =>
      ipcRenderer.invoke('watcher:get-stats'),

    openFolderDialog: (): Promise<{ canceled: boolean; filePaths: string[] }> =>
      ipcRenderer.invoke('watcher:open-folder-dialog'),

    onEbletMinted: (callback: (eblet: unknown) => void): void => {
      ipcRenderer.on('watcher:eblet-minted', (_event, eblet) => callback(eblet));
    },

    onFolderError: (callback: (payload: { folderId: string; error: string }) => void): void => {
      ipcRenderer.on('watcher:folder-error', (_event, payload) => callback(payload));
    },
  },

  // ── BP067 Phase 3B — mnemo://focus/<tab_id> deep-link focus-tab event ──────
  onNavigateFocusTab: (cb: (tabId: string) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: { tabId: string }) => cb(payload.tabId);
    ipcRenderer.on('navigate:focus-tab', handler);
    return () => ipcRenderer.removeListener('navigate:focus-tab', handler);
  },

  // ── SEG-V0153A — mnemo://accept?token=<token> deep-link accept-invite push ─
  onFederationDeepLinkAccept: (cb: (data: { token: string; slug: string }) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { token: string; slug: string }) => cb(data);
    ipcRenderer.on('federation:deep-link-accept', handler);
    return () => ipcRenderer.removeListener('federation:deep-link-accept', handler);
  },

  // ── SAGA 13 BP046B — 5-Marks first-install bonus ─────────────────────────
  /** Credit 5 marks on first install + first Stage 1 Gauntlet completion. One-per-account. */
  creditFirstInstallMarks: (): void =>
    ipcRenderer.send('credit-first-install-marks'),

  // ── v0.2.0 BP082 — OAuth (Discord + Reddit) + Marks accrual ──────────────
  oauth: {
    /**
     * Start an OAuth flow for the given platform ('discord' | 'reddit').
     * Main process opens the authorization URL in the default browser,
     * catches the mnemo://oauth/<platform>/callback redirect,
     * exchanges the code for a token, and stores it via safeStorage.
     * Returns { success, username?, scopes?, error?, needsRegistration? }.
     */
    startFlow: (platform: 'discord' | 'reddit'): Promise<{
      success: boolean;
      username?: string;
      scopes?: string[];
      error?: string;
      needsRegistration?: boolean;
    }> => ipcRenderer.invoke('oauth:start-flow', { platform }),

    /** Revoke and delete stored token for the given platform. */
    revokeToken: (platform: 'discord' | 'reddit'): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('oauth:revoke-token', { platform }),

    /** Credit Marks for a connect action (one-time per platform). */
    accrueConnectMarks: (platform: 'discord' | 'reddit', amount: number): Promise<{ ok: boolean; total?: number }> =>
      ipcRenderer.invoke('oauth:accrue-connect-marks', { platform, amount }),

    /** Retrieve stored OAuth username for a platform (does not expose token). */
    getConnectionInfo: (platform: 'discord' | 'reddit'): Promise<{
      connected: boolean;
      username?: string;
    }> => ipcRenderer.invoke('oauth:get-connection-info', { platform }),
  },

  // ── Trail Eblet Reader (KniPr035) ────────────────────────────────────────
  trailEblet: {
    list: (): Promise<{ files: string[]; dir: string }> =>
      ipcRenderer.invoke('trail-eblet:list'),
    read: (args: { filePath: string }): Promise<{ ok: boolean; content?: string; error?: string }> =>
      ipcRenderer.invoke('trail-eblet:read', args),
    listScreenshots: (args: { ebletPath: string }): Promise<{ files: string[]; dir: string }> =>
      ipcRenderer.invoke('trail-eblet:list-screenshots', args),
    readScreenshot: (args: { filePath: string }): Promise<{ ok: boolean; dataUrl?: string; error?: string }> =>
      ipcRenderer.invoke('trail-eblet:read-screenshot', args),
  },

  // ── Utility (SAGA 07 BP046B) ─────────────────────────────────────────────
  /** Open a URL in the system default browser */
  openExternal: (url: string): void =>
    ipcRenderer.send('open-external', { url }),

  /** Hide the transparent overlay window */
  hideOverlay: (): void =>
    ipcRenderer.send('hide-overlay'),

  /** Show the transparent overlay window */
  showOverlay: (): void =>
    ipcRenderer.send('show-overlay'),

  // ── Chronos Research Consent (KniPr038) ──────────────────────────────────

  /** Write a sha256-signed consent Eblet to ~/.amplify/consent/ */
  writeChronosConsent: (consentPayload: object): Promise<{ ok: boolean; ebletPath?: string }> =>
    ipcRenderer.invoke('write-chronos-consent', consentPayload),

  /** Write a sha256-signed revocation Eblet to ~/.amplify/consent/ */
  revokeChronosConsent: (payload?: object): Promise<{ ok: boolean; ebletPath?: string }> =>
    ipcRenderer.invoke('revoke-chronos-consent', payload),

  // ── Phoebe™ Idea Storage (C.17 · BP055) ─────────────────────────────────
  /** Save an idea to the in-memory Phoebe store */
  saveIdea: (idea: { title: string; content: string; timestamp: string }): Promise<{ ok: boolean; id: string }> =>
    ipcRenderer.invoke('save-idea', idea),

  /** Retrieve all saved ideas (most recent first) */
  getIdeas: (): Promise<{ ok: boolean; ideas: Array<{ id: string; title: string; content: string; timestamp: string }> }> =>
    ipcRenderer.invoke('get-ideas'),

  // ── Pearl-decode IPC (Tier G · v0.1.16 · BP057 W5c) ─────────────────────
  /** Decode a Pearl by pearl_id or canonical_ref — returns eblet content from CANON substrate */
  decodePearl: (pearlId: string): Promise<{ ok: boolean; pearl?: Record<string, string>; content?: string; error?: string }> =>
    ipcRenderer.invoke('decode-pearl', pearlId),

  // ── Bridge (BP060 Application 002 Steps 3+4 · UI-7 live Yoke wire) ──────
  bridge: {
    checkMessages: (count?: number) =>
      ipcRenderer.invoke('bridge:check-messages', count),
    sendMessage: (args: { to: string; type: string; content: string; from?: string }) =>
      ipcRenderer.invoke('bridge:send-message', args),
  },

  // ── AI Dispatch (BP060 Application 002 Steps 3+4 · UI-8 backend) ─────────
  aiDispatch: {
    query: (args: { court_member: string; messages: Array<{role: string; content: string}>; model_override?: string }) =>
      ipcRenderer.invoke('ai-dispatch:query', args),
    // KN-BP144-8 Phase 1: the free-text question path that actually calls the canonical_pipeline.ts
    // engine (substrate-first ROOTED check, then specialist swarm + Three Fates arbitration) --
    // a SEPARATE channel from `query` above, which remains the plain-Ollama-chat path untouched.
    queryEngine: (args: { question: string }): Promise<{ ok: boolean; streaming?: boolean; error?: string }> =>
      ipcRenderer.invoke('ai-dispatch:query-engine', args),
    // KN-BP144-8 Phase 1: one push event per CanonicalPlowProgressEvent the engine emits
    // (substrate-check-start/substrate-hit-rooted/substrate-miss/specialist-fire/specialist-done/
    // saladin-done/furnace-done/three-fates-done/scribe-done/question-done, etc.) -- additive,
    // only ever fired by the new query-engine path above, never by plain `query`.
    onAskEngineProgress: (handler: (data: {
      type: string;
      specialistName?: string;
      specialistCandidates?: number;
      minerPassed?: number;
      furnacePassed?: number;
      substrateTier?: string | null;
      substrateProvenance?: string;
      andonRetry?: number;
    }) => void): (() => void) => {
      const h = (_evt: Electron.IpcRendererEvent, data: Parameters<typeof handler>[0]) => handler(data);
      ipcRenderer.on('ask-engine-progress', h);
      return () => ipcRenderer.removeListener('ask-engine-progress', h);
    },
    listLocalModels: () =>
      ipcRenderer.invoke('ai-dispatch:list-local-models'),
    testConnection: () =>
      ipcRenderer.invoke('ai-dispatch:test-connection'),
    getSettings: (): Promise<{ ok: boolean; settings?: { answer_cache_mode?: boolean; [k: string]: unknown }; error?: string }> =>
      ipcRenderer.invoke('ai-dispatch:get-settings'),
    saveSettings: (settings: { local_runtime_url?: string; answer_cache_mode?: boolean; [k: string]: unknown }) =>
      ipcRenderer.invoke('ai-dispatch:save-settings', settings),
    // v0.1.57.1: token streaming events (BP081)
    onAskTokenProgress: (handler: (data: { delta: string; assembled: string; coldStart?: boolean }) => void): (() => void) => {
      const h = (_evt: Electron.IpcRendererEvent, data: { delta: string; assembled: string; coldStart?: boolean }) => handler(data);
      ipcRenderer.on('ask-token-progress', h);
      return () => ipcRenderer.removeListener('ask-token-progress', h);
    },
    // BP136 Yoke: answer-cache fields added (all optional/additive) -- servedFromSubstrate,
    // cost_usd, latency_ms, provenance, verified are only present on a served-verbatim hit.
    onAskTokenComplete: (handler: (data: {
      content: string;
      error?: string;
      hotHits?: number;
      servedFromSubstrate?: boolean;
      cost_usd?: number;
      latency_ms?: number;
      provenance?: string;
      verified?: boolean;
      // KN-BP144-8 Phase 1, ADDITIVE: only present when this completion came from
      // ai-dispatch:query-engine, never from plain ai-dispatch:query.
      engine?: {
        abstained: boolean;
        abstainReason?: string;
        servedFromSubstrate: boolean;
        substrateTier?: string | null;
        concordance?: string;
        bmvScore?: number;
        gateOutcomes?: Array<{ gate: string; passed: boolean; detail: string }>;
        specialistOutcomes?: Array<{ name: string; fired: boolean; candidateCount: number }>;
        andonTriggered?: boolean;
        andonRetries?: number;
        ebletsWritten?: number;
      };
    }) => void): (() => void) => {
      const h = (_evt: Electron.IpcRendererEvent, data: Parameters<typeof handler>[0]) => handler(data);
      ipcRenderer.on('ask-token-complete', h);
      return () => ipcRenderer.removeListener('ask-token-complete', h);
    },
    // BP132 Yoke #21 C7: user-facing Anthropic API key (never exposes the raw key back out).
    getAnthropicKeyStatus: (): Promise<{ ok: boolean; hasKey: boolean }> =>
      ipcRenderer.invoke('ai-dispatch:anthropic-key-status'),
    setAnthropicKey: (rawKey: string): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke('ai-dispatch:set-anthropic-key', rawKey),
    clearAnthropicKey: (): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('ai-dispatch:clear-anthropic-key'),
    // BP136 Yoke: real, restart-surviving meter for the Prove It panel.
    getAnswerCacheMeterSummary: (): Promise<{
      ok: boolean;
      summary?: {
        total_queries: number;
        served_verbatim_count: number;
        rag_count: number;
        local_generate_count: number;
        flagship_count: number;
        cloud_cost_avoided_usd: number;
        avg_latency_ms: number;
        avg_served_verbatim_latency_ms: number;
      };
      error?: string;
    }> => ipcRenderer.invoke('ai-dispatch:answer-cache-meter-summary'),
  },

  // ── Query Capture Archive (D-BP151-037/BISHOP/seg-query-capture-archive) ──
  // Local-only, same-machine, same-user IPC. Never reaches federation/relay code -- see
  // query_capture_ipc.ts's own header for why that boundary is deliberate.
  queryCapture: {
    getEnabled: (): Promise<{ ok: boolean; enabled?: boolean; error?: string }> =>
      ipcRenderer.invoke('query-capture:get-enabled'),
    setEnabled: (enabled: boolean): Promise<{ ok: boolean; enabled?: boolean; error?: string }> =>
      ipcRenderer.invoke('query-capture:set-enabled', enabled),
    list: (status?: 'active' | 'cleared' | 'archived'): Promise<{ ok: boolean; entries?: unknown[]; error?: string }> =>
      ipcRenderer.invoke('query-capture:list', status),
    find: (searchText: string): Promise<{ ok: boolean; entries?: unknown[]; error?: string }> =>
      ipcRenderer.invoke('query-capture:find', searchText),
    setStatus: (id: string, status: 'active' | 'cleared' | 'archived'): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke('query-capture:set-status', id, status),
    remove: (id: string): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke('query-capture:delete', id),
  },

  // ── BP087 Brain Registry (Brain Swap) ────────────────────────────────────
  brainRegistry: {
    list: (): Promise<{ ok: boolean; brains?: unknown[]; active_brain_id?: string; error?: string }> =>
      ipcRenderer.invoke('brain-registry:list'),
    getActive: (): Promise<{ ok: boolean; brain_id?: string; error?: string }> =>
      ipcRenderer.invoke('brain-registry:get-active'),
    setActive: (brain_id: string): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke('brain-registry:set-active', brain_id),
    smokeTest: (brain_id: string): Promise<{ ok: boolean; content?: string; brain_id?: string; kind?: string; latency_ms?: number; error?: string }> =>
      ipcRenderer.invoke('brain-registry:smoke-test', brain_id),
  },

  // ── LB Account (BP065 Part A · SEG-C2a) ─────────────────────────────────

  lbStartAuth: (email: string): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke('lb:start-auth', { email }),

  lbGetSession: (): Promise<{
    linked: boolean;
    user_id?: string;
    email?: string;
    peer_id?: string;
    linked_at?: string;
    crewman_number?: number;
  }> =>
    ipcRenderer.invoke('lb:get-session'),

  lbLinkDevice: (access_token: string, refresh_token: string, email: string): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke('lb:link-device', { access_token, refresh_token, email }),

  lbRevokeDevice: (): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke('lb:revoke-device'),

  onLbAuthComplete: (cb: (session: { user_id: string; email: string; peer_id: string; crewman_number?: number }) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, session: { user_id: string; email: string; peer_id: string; crewman_number?: number }) => cb(session);
    ipcRenderer.on('lb:auth-complete', handler);
    return () => ipcRenderer.removeListener('lb:auth-complete', handler);
  },

  // ── Frontier Node (BP065 Part B · SEG-B2b) ───────────────────────────────

  lbRegisterFrontierNode: (): Promise<{ ok: boolean; frontier_node_id?: string; error?: string }> =>
    ipcRenderer.invoke('lb:register-frontier-node'),

  lbWithdrawFrontierNode: (): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke('lb:withdraw-frontier-node'),

  lbGetFrontierStatus: (): Promise<{
    registered: boolean;
    frontier_node_id?: string;
    last_heartbeat?: string;
    withdrawn?: boolean;
  }> =>
    ipcRenderer.invoke('lb:get-frontier-status'),

  // ── Frontier Borrow (WAVE-24) ─────────────────────────────────────────────

  lbGetBorrowStatus: (): Promise<{ borrow_opt_in: boolean; trust_list: string[] }> =>
    ipcRenderer.invoke('lb:get-borrow-status'),

  lbSetBorrowOptIn: (enabled: boolean): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('lb:set-borrow-opt-in', { enabled }),

  lbRequestFrontierBorrow: (): Promise<{
    ok: boolean;
    error?: string;
    cost_transport_usd?: number;
    cost_compute_usd_approx?: number;
    node_count?: number;
    disclosure?: string;
  }> =>
    ipcRenderer.invoke('lb:request-frontier-borrow'),

  // ── Opt-In Strike Tracker IPC (BP065 3-strikes · SEG-C from renderer) ────

  lbOptInGetState: (): Promise<{ strikes: number; lastShown: number | null; decision: string }> =>
    ipcRenderer.invoke('lb:opt-in-get-state'),

  lbOptInRecordStrike: (): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('lb:opt-in-record-strike'),

  lbOptInSetDecision: (decision: 'never' | 'pending' | 'linked'): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('lb:opt-in-set-decision', { decision }),

  // ── Onboarding Prefs (BP065 v0.1.23) ─────────────────────────────────────
  /** Apply first-run setup preferences: desktop shortcut, startup item, optional API key. */
  applyOnboardingPrefs: (prefs: {
    displayName?: string;
    addDesktopShortcut?: boolean;
    addStartupItem?: boolean;
    apiKey?: string;
  }): Promise<{ ok: boolean; results?: Record<string, boolean> }> =>
    ipcRenderer.invoke('onboarding:apply-prefs', prefs),

  // ── BP067 Phase 1A — $5 Membership Checkout ───────────────────────────────
  membership: {
    createCheckout: (autoRenew: boolean): Promise<{ ok: boolean; url?: string; error?: string; fallbackUrl?: string }> =>
      ipcRenderer.invoke('membership:create-checkout', autoRenew),
    verifyStatus: (): Promise<{ ok: boolean; membership_active: boolean; error?: string }> =>
      ipcRenderer.invoke('membership-verify-status'),
  },

  // ── BP085 — open-checkout direct URL + activation listener ────────────────
  openMembershipCheckout: (): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke('membership:open-checkout'),

  checkLocalMembershipStatus: (): Promise<{ ok: boolean; is_member: boolean; member_id: string | null }> =>
    ipcRenderer.invoke('membership:check-local-status'),

  onMembershipActivated: (
    cb: (result: { ok: boolean; member_id?: string; error?: string }) => void,
  ): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, result: { ok: boolean; member_id?: string; error?: string }) => cb(result);
    ipcRenderer.on('membership:activation-result', handler);
    return () => ipcRenderer.removeListener('membership:activation-result', handler);
  },

  // ── runMeshTest (BP078 Scope 1) ──────────────────────────────────────────────
  runMeshTest: (payload?: { testId?: string; timeoutMs?: number }): Promise<{
    success: boolean;
    grading?: { accuracy: number; hash_verified: number; p50_latency_ms: number; p95_latency_ms?: number; total_questions: number };
    error?: 'MISSING_API_KEY' | 'TIMEOUT' | 'PYTHON_ERROR' | 'MISSING_PYTHON_RUNTIME' | 'NO_PEER';
    static_fallback?: boolean;
  }> =>
    ipcRenderer.invoke('run-mesh-test', payload),

  // ── Caithedral Tools (BP060 Application 002 Step 1) ─────────────────────
  caithedralTools: {
    soccerball_emit: (pearls: string[], bindings?: Record<string, string>) =>
      ipcRenderer.invoke('caithedral:soccerball_emit', pearls, bindings),
    soccerball_decode: (sid: string) =>
      ipcRenderer.invoke('caithedral:soccerball_decode', sid),
    soccerball_lookup: (sid: string) =>
      ipcRenderer.invoke('caithedral:soccerball_lookup', sid),
    speckle_nibble: (sid: string, position: number) =>
      ipcRenderer.invoke('caithedral:speckle_nibble', sid, position),
    eblit_emit: (pearl_id: string, source_cathedral: string, ts?: number) =>
      ipcRenderer.invoke('caithedral:eblit_emit', pearl_id, source_cathedral, ts),
    substrace_weave: (eblit_null_lines: string[], weaver: string, weave_ts?: number) =>
      ipcRenderer.invoke('caithedral:substrace_weave', eblit_null_lines, weaver, weave_ts),
    quilt_compose: (substrace_ids: string[], narrative_tag: string, weaver: string, ts?: number) =>
      ipcRenderer.invoke('caithedral:quilt_compose', substrace_ids, narrative_tag, weaver, ts),
    substrate_address_emit: (seed: string, ts?: number) =>
      ipcRenderer.invoke('caithedral:substrate_address_emit', seed, ts),
    substrate_address_validate: (address: string) =>
      ipcRenderer.invoke('caithedral:substrate_address_validate', address),
    ten_pearl_roundtrip: () =>
      ipcRenderer.invoke('caithedral:ten_pearl_roundtrip'),
    areopagus_query: (query: string) =>
      ipcRenderer.invoke('caithedral:areopagus_query', query),
  },

  // ─── SKU (BP078 Scope 6.5) ───────────────────────────────────────────────────
  sku: {
    checkModel: (modelName: string) => ipcRenderer.invoke('sku-check-model', modelName),
    upgradeTo: (tier: 'core' | 'lite' | 'full') => ipcRenderer.invoke('sku-upgrade-to', tier),
    cancelUpgrade: () => ipcRenderer.invoke('sku-cancel-upgrade'),
    currentTier: () => ipcRenderer.invoke('sku-current-tier'),
    onboardingCheck: () => ipcRenderer.invoke('onboarding-check'),
    onPullProgress: (cb: (data: SkuPullProgress) => void) => {
      ipcRenderer.on('sku-pull-progress', (_event, data: SkuPullProgress) => cb(data));
      return () => ipcRenderer.removeAllListeners('sku-pull-progress');
    },
    onPullComplete: (cb: () => void) => {
      ipcRenderer.on('sku-pull-complete', () => cb());
      return () => ipcRenderer.removeAllListeners('sku-pull-complete');
    },
    onPullError: (cb: (err: string) => void) => {
      ipcRenderer.on('sku-pull-error', (_event, err: string) => cb(err));
      return () => ipcRenderer.removeAllListeners('sku-pull-error');
    },
  },

  // ── Black Crow Feather earn (BP078) ───────────────────────────────────────
  earnBlackCrowFeather: (payload: { userId: string; reason: string; metadata?: Record<string, unknown> }) =>
    ipcRenderer.invoke('feather:earn-black', payload),

  // ── SEG-Q-3 BP078: DevTools toggle (fallback path for Ctrl+Shift+D conflicts) ──
  toggleDevTools: (): void =>
    ipcRenderer.send('devtools:toggle'),

  // ── SEG-V0144-UI-1: Interface zoom — applies to all active BrowserWindows ──
  setZoomFactor: (factor: number): void =>
    ipcRenderer.send('set-zoom-factor', factor),

  // ── SEG-Q-4 BP078: Auto-prepare FULL upgrade ──────────────────────────────
  getAutoPrepare: (): Promise<{ enabled: boolean; modelReady: boolean; pulling: boolean }> =>
    ipcRenderer.invoke('auto-prepare:get'),

  setAutoPrepare: (enabled: boolean): void =>
    ipcRenderer.send('auto-prepare:set', enabled),

  onAutoPrepareReady: (cb: () => void): (() => void) => {
    const handler = () => cb();
    ipcRenderer.on('auto-prepare:model-ready', handler);
    return () => ipcRenderer.removeListener('auto-prepare:model-ready', handler);
  },

  // SEG-Q-13 BP078: Run Diagnostic
  runDiagnostic: (): Promise<{ ok: boolean; logPath: string; content: string }> =>
    ipcRenderer.invoke('diagnostic:run'),

  // SEG-R-13: Open the folder containing a diagnostic log file
  openDiagFolder: (folderPath: string): Promise<void> =>
    ipcRenderer.invoke('diagnostic:open-folder', folderPath),

  // ── SEG-V0149-P0: lean-install-start + progress events ───────────────────────

  leanInstallStart: (): Promise<{ ok: boolean; waitingForInstall?: boolean; error?: string }> =>
    ipcRenderer.invoke('lean-install-start'),

  onLeanInstallStatus: (cb: (data: { step: string; message: string }) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { step: string; message: string }) => cb(data);
    ipcRenderer.on('lean-install-status', handler);
    return () => ipcRenderer.removeListener('lean-install-status', handler);
  },

  onLeanInstallProgress: (cb: (data: { bytesDownloaded: number; totalBytes: number; percentComplete: number; speedLabel: string; eta_s: number }) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { bytesDownloaded: number; totalBytes: number; percentComplete: number; speedLabel: string; eta_s: number }) => cb(data);
    ipcRenderer.on('lean-install-progress', handler);
    return () => ipcRenderer.removeListener('lean-install-progress', handler);
  },

  onLeanInstallError: (cb: (data: { message: string; retryable: boolean }) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { message: string; retryable: boolean }) => cb(data);
    ipcRenderer.on('lean-install-error', handler);
    return () => ipcRenderer.removeListener('lean-install-error', handler);
  },

  // SEG-V0150-P0-FIX-BRIDGE-OR-FALLBACK: skip-path — writes sku_tier.json directly,
  // bypasses the full lean-install flow (for users who already have Ollama + model).
  writeSkuTierSkip: (): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke('write-sku-tier-skip'),

  // SEG-V0151-P0-AUTOMATIC-BACKGROUND: lean background setup status events
  onLeanBgStatus: (cb: (payload: { type: string; msg: string; pct?: number }) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: { type: string; msg: string; pct?: number }) => cb(payload);
    ipcRenderer.on('lean-bg-status', handler);
    return () => ipcRenderer.removeListener('lean-bg-status', handler);
  },

  // ── BP080 Genesis Mint — IP Ledger IPC ───────────────────────────────────
  ipLedgerGetGenesis: () => ipcRenderer.invoke('ip-ledger:get-genesis'),
  ipLedgerFounderVcardQr: () => ipcRenderer.invoke('ip-ledger:founder-vcard-qr'),
  ipLedgerExecuteGenesisMint: () => ipcRenderer.invoke('ip-ledger:execute-genesis-mint'),
  ipLedgerGenesisMintFull: () => ipcRenderer.invoke('ip-ledger:genesis-mint-full'),

  // ── BP089 I-C: §16 ip_ledger entries + peer keypair ──────────────────────
  ipLedgerGetEntries: (ringBearerId: string): Promise<{ ok: boolean; entries: unknown[]; error?: string }> =>
    ipcRenderer.invoke('ip-ledger:get-entries', ringBearerId),
  peerKeyRead: (): Promise<{ ok: boolean; publicKeyHex?: string; generated?: boolean; peerId?: string; error?: string }> =>
    ipcRenderer.invoke('peer-key:read'),
  peerKeyRegenerate: (): Promise<{ ok: boolean; publicKeyHex?: string; generated?: boolean; peerId?: string; error?: string }> =>
    ipcRenderer.invoke('peer-key:regenerate'),

  // ── BP092 I12: Ring Bearer identity + Postgres ip_ledger_entries ──────────
  ipLedgerGetIdentity: (): Promise<{ ok: boolean; peer_id?: string; public_key_hex?: string; error?: string }> =>
    ipcRenderer.invoke('ip-ledger:get-identity'),
  ipLedgerGetPgEntries: (): Promise<{ ok: boolean; entries: unknown[]; error?: string }> =>
    ipcRenderer.invoke('ip-ledger:get-pg-entries'),
  ipLedgerGetEntryProof: (entryId: string): Promise<{ ok: boolean; proof?: unknown; error?: string }> =>
    ipcRenderer.invoke('ip-ledger:get-entry-proof', entryId),

  // BP132 Yoke #22 Addendum A — QR-ledger-per-connection
  ipLedgerStampConnection: (req: { peer_id: string; peer_display_name?: string; connection_method: string }): Promise<{
    entry_id: string; ring_bearer_peer_id: string; payload_hash_hex: string; stamped_at: string; ok: boolean; error?: string;
  }> => ipcRenderer.invoke('ip-ledger:stamp-connection', req),

  // BP132 Yoke #22 Addendum A — data-driven Cue Deck card templates
  cueCardsGetTemplate: (req: { id?: string; initiativeSlug?: string }): Promise<{ ok: boolean; template?: unknown; error?: string }> =>
    ipcRenderer.invoke('cue-cards:get-template', req),

  // BP132 Yoke #22 — Diagnostic Mode UI (Help tab)
  diagnosticModeGetStatus: (): Promise<{ pollerStarted: boolean; lastPollAt: string | null; lastError: string | null; permissionActive: boolean }> =>
    ipcRenderer.invoke('diagnostic-mode:get-status'),
  diagnosticModeActivatePermission: (ttlMinutes: number): Promise<{ ok: boolean; ttlMinutes: number }> =>
    ipcRenderer.invoke('diagnostic-mode:activate-permission', ttlMinutes),
  diagnosticModeRevokePermission: (): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('diagnostic-mode:revoke-permission'),

  // BP132 Yoke #21 D9 / Yoke #22 one-click staged MMLU-Pro test / Yoke #23 WAN dispatch
  meshTestRunOneClick: (config: {
    ollamaBaseUrl?: string;
    model?: string;
    questionsPerDomain?: number;
    mode?: 'auto' | 'local_ollama' | 'wan_mesh';
    wanMaxQuestions?: number;
    wanPerQuestionTimeoutMs?: number;
    // BP133 Yoke #24 Task 1: single authoritative substrate toggle for this run.
    substrateEnabled?: boolean;
    // BP133 Yoke #24 Task 4: caps total question count for this run (e.g. 3 for a smoke test).
    maxTotalQuestions?: number;
    // BP133 Yoke #24 Task 2: explicit opt-in to the 12-Blade Column Plow (wan_mesh only).
    plowEnabled?: boolean;
    plowAndonEnabled?: boolean;
    // BP137 Yoke v2b (Research Arm): explicit opt-in, ignored unless plowEnabled is also true.
    researchArmMode?: boolean;
    // BP138 Yoke 0.9.13 F3: explicit opt-in to mesh-synergy dispatch, ignored unless
    // plowEnabled + researchArmMode are also true (see one_click_mmlu_pro.ts's
    // researchArmMeshSynergy doc comment for the exact AND-gate).
    researchArmMeshSynergy?: boolean;
    // BP138 Yoke Phase 2: explicit opt-in to the Decompose-and-Eliminate engine, ignored unless
    // plowEnabled + researchArmMode are also true (AND-gate in one_click_mmlu_pro.ts).
    researchArmDecompose?: boolean;
    // BP134 Yoke #32 Phase F item 2: the "Full 14x5 MMLU-Pro" preset.
    exactPerCategory?: number;
    // BP135 Yoke #34 Phase 5: explicit opt-in to pooled cross-peer substrate (wan_mesh +
    // substrateEnabled only). Defaults false -- existing per-peer-local-only substrate
    // behavior is unchanged unless a caller explicitly opts in.
    federatedSubstrateEnabled?: boolean;
    // BP140-K6: explicit subset scoping -- when provided (non-empty), the run is restricted to
    // exactly these question_id values (exact string match). Powers OneClickMeshTestPanel.tsx's
    // "Re-run misses (N)" and manual "Run subset" actions. Absent/empty -> zero effect, byte-
    // identical to every pre-existing caller (MeshTestTerminalTab.tsx's `run` command included).
    questionIds?: string[];
  }): Promise<{ ok: boolean; result?: unknown; error?: string }> =>
    ipcRenderer.invoke('mesh-test:run-one-click', config),
  meshTestIsActive: (): Promise<{ active: boolean }> =>
    ipcRenderer.invoke('mesh-test:is-active'),
  // BP133 Yoke #24 Task 3: Diagnostic terminal `stop` and `peers` typed commands.
  meshTestStop: (): Promise<{ ok: boolean; wasRunning: boolean }> =>
    ipcRenderer.invoke('mesh-test:stop'),
  meshTestListPeers: (): Promise<{ ok: boolean; peers: Array<{ peerId: string; machineLabel: string }> }> =>
    ipcRenderer.invoke('mesh-test:list-peers'),
  onMeshTestProgress: (cb: (payload: unknown) => void): (() => void) => {
    const handler = (_event: unknown, payload: unknown) => cb(payload);
    ipcRenderer.on('mesh-test:progress', handler);
    return () => ipcRenderer.removeListener('mesh-test:progress', handler);
  },

  // KN-BP142-5: Liana Cycle Engine caller -- same three-shape pattern (run-now / get-status /
  // progress listener) as meshTestRunOneClick/meshTestIsActive/onMeshTestProgress above. See
  // src/main/plow/liana_cycle_scheduler.ts for the trigger policy, kill switch, and receipt.
  lianaCycleRunNow: (): Promise<
    { ok: true; summary: unknown; receiptPath: string | null } | { ok: false; error: string }
  > => ipcRenderer.invoke('liana-cycle:run-now'),
  lianaCycleGetStatus: (): Promise<unknown> => ipcRenderer.invoke('liana-cycle:get-status'),
  lianaCycleSetEnabled: (enabled: boolean): Promise<{ ok: boolean; enabled: boolean }> =>
    ipcRenderer.invoke('liana-cycle:set-enabled', enabled),
  onLianaCycleProgress: (cb: (payload: unknown) => void): (() => void) => {
    const handler = (_event: unknown, payload: unknown) => cb(payload);
    ipcRenderer.on('liana-cycle:progress', handler);
    return () => ipcRenderer.removeListener('liana-cycle:progress', handler);
  },

  // BP138 Yoke: one-click HOT/COLD substrate lift -- see runHotColdLiftTest() in
  // src/main/mesh_test/one_click_mmlu_pro.ts. Config shape mirrors meshTestRunOneClick
  // above (it IS that same config, representing the HOT arm); the main-process handler
  // runs the COLD arm internally with substrate/plow forced off.
  meshTestRunHotColdLift: (config: {
    ollamaBaseUrl?: string;
    model?: string;
    questionsPerDomain?: number;
    mode?: 'auto' | 'local_ollama' | 'wan_mesh';
    wanMaxQuestions?: number;
    wanPerQuestionTimeoutMs?: number;
    substrateEnabled?: boolean;
    maxTotalQuestions?: number;
    plowEnabled?: boolean;
    plowAndonEnabled?: boolean;
    researchArmMode?: boolean;
    // BP138 Yoke 0.9.13 F3: see meshTestRunOneClick's researchArmMeshSynergy doc above --
    // identical config shape, HOT-arm value.
    researchArmMeshSynergy?: boolean;
    exactPerCategory?: number;
    federatedSubstrateEnabled?: boolean;
  }): Promise<{ ok: boolean; result?: unknown; error?: string }> =>
    ipcRenderer.invoke('mesh-test:run-hotcold-lift', config),
  onMeshTestHotColdProgress: (cb: (payload: unknown) => void): (() => void) => {
    const handler = (_event: unknown, payload: unknown) => cb(payload);
    ipcRenderer.on('mesh-test:hotcold-progress', handler);
    return () => ipcRenderer.removeListener('mesh-test:hotcold-progress', handler);
  },

  // SEG-2 v0.1.56 — first-launch progressive auto-pull (gemma4:12b)
  firstLaunchModelPull: {
    check: (modelName: string): Promise<{ exists: boolean; modelName: string }> =>
      ipcRenderer.invoke('first-launch-model-check', { modelName }),

    start: (modelName: string): Promise<{ ok: boolean; alreadyInstalled?: boolean; cancelled?: boolean; error?: string }> =>
      ipcRenderer.invoke('first-launch-model-start', { modelName }),

    cancel: (): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('first-launch-model-cancel'),

    onProgress: (cb: (data: { percent: number; downloaded: number; total: number; status: string }) => void): (() => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        data: { percent: number; downloaded: number; total: number; status: string },
      ) => cb(data);
      ipcRenderer.on('first-launch-model-progress', handler);
      return () => ipcRenderer.removeListener('first-launch-model-progress', handler);
    },

    onComplete: (cb: () => void): (() => void) => {
      const handler = () => cb();
      ipcRenderer.on('first-launch-model-complete', handler);
      return () => ipcRenderer.removeListener('first-launch-model-complete', handler);
    },

    onError: (cb: (err: string) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, err: string) => cb(err);
      ipcRenderer.on('first-launch-model-error', handler);
      return () => ipcRenderer.removeListener('first-launch-model-error', handler);
    },
  },

  // SEG-U-7 BP078: mesh-test-complete -- fired when a results file is detected on disk
  onMeshTestComplete: (cb: (metrics: {
    hot_accuracy_pct: number;
    cold_accuracy_pct: number;
    delta_pp: number;
    fast_cheap_good: string;
    svgPath?: string;
  }) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, metrics: {
      hot_accuracy_pct: number;
      cold_accuracy_pct: number;
      delta_pp: number;
      fast_cheap_good: string;
      svgPath?: string;
    }) => cb(metrics);
    ipcRenderer.on('mesh-test-complete', handler);
    return () => ipcRenderer.removeListener('mesh-test-complete', handler);
  },

  // SEG-2 v0.1.57: Test It Out — substrate-warming 5-question workout
  runTestItOut: (): Promise<{ success: boolean; score?: number; total?: number; error?: string }> =>
    ipcRenderer.invoke('run-test-it-out'),

  getTestItOutHistory: (): Promise<{ runs: Array<{ ts: number; score: number; total: number; model: string }> }> =>
    ipcRenderer.invoke('get-test-it-out-history'),

  onTestItOutProgress: (cb: (data: {
    questionIndex: number;
    total: number;
    question: string;
    modelAnswer: string;
    correctAnswer: string;
    isCorrect: boolean;
  }) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: {
      questionIndex: number;
      total: number;
      question: string;
      modelAnswer: string;
      correctAnswer: string;
      isCorrect: boolean;
    }) => cb(data);
    ipcRenderer.on('test-it-out-progress', handler);
    return () => ipcRenderer.removeListener('test-it-out-progress', handler);
  },

  onTestItOutComplete: (cb: (data: {
    score: number;
    total: number;
    results: Array<{
      questionIndex: number;
      question: string;
      modelAnswer: string;
      correctAnswer: string;
      isCorrect: boolean;
    }>;
  }) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: {
      score: number;
      total: number;
      results: Array<{
        questionIndex: number;
        question: string;
        modelAnswer: string;
        correctAnswer: string;
        isCorrect: boolean;
      }>;
    }) => cb(data);
    ipcRenderer.on('test-it-out-complete', handler);
    return () => ipcRenderer.removeListener('test-it-out-complete', handler);
  },

  // ── SEG-A2 BP081: Substrate stats dashboard ───────────────────────────────
  getSubstrateStats: (): Promise<import('./mnem_eblet_store').SubstrateStats> =>
    ipcRenderer.invoke('get-substrate-stats'),

  // ── BP081 K-1: Membership backend (stub tier) ─────────────────────────────
  membershipStartCheckout: (): Promise<{ success: boolean; sessionId?: string; checkoutUrl?: string; error?: string; isStub: boolean }> =>
    ipcRenderer.invoke('membership:start-checkout'),

  membershipGetStatus: (): Promise<{ tier: string; status: string; annualFeeUsd: number }> =>
    ipcRenderer.invoke('membership:get-status'),

  membershipCancel: (): Promise<{ success: boolean; reason?: string }> =>
    ipcRenderer.invoke('membership:cancel'),

  // ── BP081 K-2: MCP Substrate Bridge status ────────────────────────────────
  mcpGetStatus: (): Promise<{
    running: boolean;
    port: number | null;
    connectedClients: number;
    recentCalls: Array<{ tool: string; ts: number; clientId: string }>;
  }> => ipcRenderer.invoke('mcp:get-status'),

  mcpGetAuthToken: (): Promise<string | null> =>
    ipcRenderer.invoke('mcp:get-auth-token'),

  // ── SEG-4 v0.1.59 — Plow the Field IPC ───────────────────────────────────

  runAndonReplowLoop: (question: string, domain: string): Promise<{
    ok: boolean;
    verdict: 'verified' | 'rejected' | 'quarantined';
    ebletWritten: boolean;
    question?: string;
    answer?: string;
    modelAnswer?: string;
    error?: string;
  }> =>
    ipcRenderer.invoke('plow:run-andon-replow', { question, domain }),

  loadDomainBank: (domain: string): Promise<Array<{
    question: string;
    options: string[];
    correct_answer: string;
    source_id: string;
    source_category: string;
  }>> =>
    ipcRenderer.invoke('plow:load-domain-bank', domain),

  // ── BP134 Yoke #32 Phase D — Field-Sowing Runner ─────────────────────────

  runFieldSowing: (fsConfig: {
    domain: string;
    maxPasses?: number;
    timeBudgetMs?: number;
    resume?: boolean;
  }): Promise<{ ok: boolean; result?: unknown; error?: string }> =>
    ipcRenderer.invoke('plow:run-field-sowing', fsConfig),

  cancelFieldSowing: (): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('plow:cancel-field-sowing'),

  onFieldSowingProgress: (callback: (event: unknown) => void): (() => void) => {
    const listener = (_e: unknown, data: unknown) => callback(data);
    ipcRenderer.on('plow:field-sowing-progress', listener);
    return () => ipcRenderer.removeListener('plow:field-sowing-progress', listener);
  },

  // ── BP134 Yoke #32 Phase G — "improves-over-time" manual refresh ────────────
  refreshChocolatePack: (): Promise<{ ok: boolean; manifest?: unknown; error?: string }> =>
    ipcRenderer.invoke('plow:refresh-chocolate-pack'),

  // ── BP082 v0.2.2 — Founder substrate seed ────────────────────────────────

  plowSeedFromBank: (): Promise<{
    ok: boolean;
    written: number;
    skipped: number;
    total: number;
    errors: string[];
  }> =>
    ipcRenderer.invoke('plow:seed-from-bank'),

  onPlowSeedProgress: (
    callback: (data: { written: number; skipped: number; total: number; pct: number; done?: boolean }) => void,
  ): (() => void) => {
    const handler = (_: unknown, data: { written: number; skipped: number; total: number; pct: number; done?: boolean }) =>
      callback(data);
    ipcRenderer.on('plow:seed-progress', handler);
    return () => ipcRenderer.removeListener('plow:seed-progress', handler);
  },

  // ── BP083 SEG-5 — Reset + Reseed Context-Class eblets ────────────────────

  plowResetAndReseedContext: (): Promise<{
    ok: boolean;
    written: number;
    total: number;
    backupPath: string;
  }> =>
    ipcRenderer.invoke('plow:reset-and-reseed-context'),

  onPlowResetReseedProgress: (
    callback: (data: { written: number; total: number; pct: number; done?: boolean }) => void,
  ): (() => void) => {
    const handler = (_: unknown, data: { written: number; total: number; pct: number; done?: boolean }) =>
      callback(data);
    ipcRenderer.on('plow:reset-reseed-progress', handler);
    return () => ipcRenderer.removeListener('plow:reset-reseed-progress', handler);
  },

  // ── BP082 v0.2.3 — Beat-Google Benchmark ─────────────────────────────────

  getGoogleBaselines: (): Promise<unknown> =>
    ipcRenderer.invoke('plow:get-google-baselines'),

  runBenchmark: (config: {
    nPerDomain: number;
    randomSeed: number;
    model: string;
    ollamaBaseUrl: string;
  }): Promise<{ ok: boolean; result?: unknown; error?: string }> =>
    ipcRenderer.invoke('plow:run-benchmark', config),

  cancelBenchmark: (): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('plow:cancel-benchmark'),

  writeBenchmarkReceipt: (args: {
    receiptMarkdown: string;
    timestamp: number;
  }): Promise<{ ok: boolean; path?: string }> =>
    ipcRenderer.invoke('plow:write-receipt', args),

  onBenchmarkProgress: (
    callback: (event: Record<string, unknown>) => void,
  ): (() => void) => {
    const handler = (_: unknown, data: Record<string, unknown>) => callback(data);
    ipcRenderer.on('plow:benchmark-progress', handler);
    return () => ipcRenderer.removeListener('plow:benchmark-progress', handler);
  },

  // BP138 Yoke Phase 1: Answer Coroner IPC
  runAnswerCoroner: (opts: {
    sessionFilter?: string;
    limit?: number;
  }): Promise<{
    ok: boolean;
    roundup?: unknown;
    error?: string;
  }> => ipcRenderer.invoke('plow:run-answer-coroner', opts),

  // Coroner progress events (streamed from the coroner run)
  onCoronerProgress: (callback: (msg: string) => void): (() => void) => {
    const handler = (_: unknown, data: { msg: string }) => callback(data.msg);
    ipcRenderer.on('plow:coroner-progress', handler);
    return () => ipcRenderer.removeListener('plow:coroner-progress', handler);
  },

  // BP139 Founder Yoke: Answer Coroner over the CURRENT run's own outcomes (no network call --
  // classifies the QuestionOutcome[] already held by the renderer). See
  // src/main/plow/answer_coroner.ts's runAnswerCoronerOnLocalOutcomes.
  runAnswerCoronerOnLocalOutcomes: (opts: {
    outcomes: Array<{
      question_id: number;
      question: string;
      category: string;
      correctLetter: string;
      parsedLetter: string | null;
      isCorrect: boolean;
      isAbstain?: boolean;
      answeredBy?: string | null;
      peerId?: string | null;
      machineLabel?: string | null;
      latencyMs?: number | null;
      plowTrace?: Record<string, unknown> | null;
    }>;
  }): Promise<{
    ok: boolean;
    roundup?: unknown;
    error?: string;
  }> => ipcRenderer.invoke('plow:run-answer-coroner-local', opts),

  // ── BP082 v0.3.1 — 3-condition Mesh Comparison ───────────────────────────

  runMeshComparison: (config: {
    nPerDomain: number;
    randomSeed: number;
    model: string;
    ollamaBaseUrl: string;
  }): Promise<{ ok: boolean; result?: unknown; error?: string }> =>
    ipcRenderer.invoke('plow:run-mesh-comparison', config),

  cancelMeshComparison: (): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('plow:cancel-mesh-comparison'),

  onMeshComparisonProgress: (
    callback: (event: Record<string, unknown>) => void,
  ): (() => void) => {
    const handler = (_: unknown, data: Record<string, unknown>) => callback(data);
    ipcRenderer.on('plow:mesh-comparison-progress', handler);
    return () => ipcRenderer.removeListener('plow:mesh-comparison-progress', handler);
  },

  // ── BP083 v0.3.4 — Canonical Plow Pipeline IPC ───────────────────────────

  runCanonicalPlow: (config: {
    domains: string[];
    questionsPerDomain: number;
    model?: string;
    ollamaBaseUrl?: string;
    specialistKeys?: {
      wolframApiKey?: string;
      stackExchangeKey?: string;
      pubmedApiKey?: string;
    };
  }): Promise<{ ok: boolean; result?: unknown; error?: string }> =>
    ipcRenderer.invoke('plow:run-canonical-plow', config),

  cancelCanonicalPlow: (): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('plow:cancel-canonical-plow'),

  onCanonicalPlowProgress: (
    callback: (event: Record<string, unknown>) => void,
  ): (() => void) => {
    const handler = (_: unknown, data: Record<string, unknown>) => callback(data);
    ipcRenderer.on('plow:canonical-plow-progress', handler);
    return () => ipcRenderer.removeListener('plow:canonical-plow-progress', handler);
  },

  // ── BP083 v0.3.8 — GPQA Diamond Benchmark IPC ────────────────────────────

  runDiamond: (config: {
    mode: 'bare' | 'cooperative';
    count: number;
  }): Promise<{ ok: boolean; summary?: unknown; error?: string }> =>
    ipcRenderer.invoke('diamond:run', config),

  cancelDiamond: (): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('diamond:cancel'),

  onDiamondProgress: (
    callback: (event: Record<string, unknown>) => void,
  ): (() => void) => {
    const handler = (_: unknown, data: Record<string, unknown>) => callback(data);
    ipcRenderer.on('diamond:progress', handler);
    return () => ipcRenderer.removeListener('diamond:progress', handler);
  },

  // ── SEG-5 v0.1.59 — Clipboard capture IPC ────────────────────────────────

  readClipboard: (): Promise<string> =>
    ipcRenderer.invoke('clipboard:read'),

  onClipboardCaptureQA: (callback: () => void): (() => void) => {
    const handler = () => callback();
    ipcRenderer.on('clipboard:capture-qa', handler);
    return () => ipcRenderer.removeListener('clipboard:capture-qa', handler);
  },

  // ── A-3 BP081 v0.1.59.1 — App version check (stale-message pruning on upgrade) ──

  onAppVersionCheck: (callback: (data: { version: string }) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { version: string }) => callback(data);
    ipcRenderer.on('app:version-check', handler);
    return () => ipcRenderer.removeListener('app:version-check', handler);
  },

  // ── A-4 BP081 v0.1.59.1 — Onboarding auto-flip check ─────────────────────

  onOnboardingAutoFlipCheck: (callback: (data: { ollamaHealthy: boolean; gemmaPresent: boolean }) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { ollamaHealthy: boolean; gemmaPresent: boolean }) => callback(data);
    ipcRenderer.on('onboarding:auto-flip-check', handler);
    return () => ipcRenderer.removeListener('onboarding:auto-flip-check', handler);
  },

  // ── Battery Dispatch v0.3.0 — BP082 · Sonnet 4.6 ──────────────────────────
  dispatchListContentFiles: (): Promise<unknown[]> =>
    ipcRenderer.invoke('dispatch:list-content-files'),

  dispatchDefaultPlatforms: (cls: string): Promise<string[]> =>
    ipcRenderer.invoke('dispatch:default-platforms', cls),

  dispatchGetFileBody: (filePath: string): Promise<{ v1Body?: string; v2Body?: string; error?: string }> =>
    ipcRenderer.invoke('dispatch:get-file-body', filePath),

  dispatchFire: (req: { filePath: string; platforms: string[]; ratifiedPlatforms: string[] }): Promise<unknown> =>
    ipcRenderer.invoke('dispatch:fire', req),

  dispatchHistory: (): Promise<unknown[]> =>
    ipcRenderer.invoke('dispatch:history'),

  dispatchCredentialStatus: (): Promise<{ substack: boolean; medium: boolean; gmail: boolean; cephas: boolean; lianabanyan: boolean; hackernews: boolean }> =>
    ipcRenderer.invoke('dispatch:credential-status'),

  onDispatchProgress: (callback: (msg: string) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { msg: string }) => callback(data.msg);
    ipcRenderer.on('dispatch:progress', handler);
    return () => ipcRenderer.removeListener('dispatch:progress', handler);
  },

  // BP083 SEG-5: MEMORY.md self-context panel (My Self-Context in Test It Out)
  mnemoGetMemoryMd: (): Promise<{ ok: boolean; content?: string; error?: string }> =>
    ipcRenderer.invoke('mnemosynec:get-memory-md'),

  mnemoReloadMemoryMd: (): Promise<{ ok: boolean; content?: string; error?: string }> =>
    ipcRenderer.invoke('mnemosynec:reload-memory-md'),

  mnemoResetMemoryMd: (): Promise<{ ok: boolean; content?: string; error?: string }> =>
    ipcRenderer.invoke('mnemosynec:reset-memory-md'),

  mnemoOpenMemoryEditor: (): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke('mnemosynec:open-memory-editor'),

  // ── MIC (Machine In Charge) v0.4.0 BP083 ─────────────────────────────────

  micStartDistributedPlow: (config: {
    domains: string[];
    questionsPerDomain: number;
    model?: string;
    ollamaBaseUrl?: string;
  }): Promise<{ ok: boolean; result?: unknown; error?: string }> =>
    ipcRenderer.invoke('mic:start-distributed-plow', config),

  micCancel: (): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('mic:cancel'),

  micGetPeers: (): Promise<unknown[]> =>
    ipcRenderer.invoke('mic:get-peers'),

  micAddPeer: (peer: unknown): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('mic:add-peer', peer),

  micRemovePeer: (peerId: string): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('mic:remove-peer', peerId),

  micDiscoverPeers: (): Promise<unknown[]> =>
    ipcRenderer.invoke('mic:discover-peers'),

  micEstimateWallclock: (config: { domains: string[]; questionsPerDomain: number }): Promise<{ estimatedMs: number; onlinePeers: number }> =>
    ipcRenderer.invoke('mic:estimate-wallclock', config),

  onMicStatusEvent: (callback: (event: Record<string, unknown>) => void): (() => void) => {
    const handler = (_: unknown, data: Record<string, unknown>) => callback(data);
    ipcRenderer.on('mic:status-event', handler);
    return () => ipcRenderer.removeListener('mic:status-event', handler);
  },

  // ── The Diagnosis v0.4.0 BP083 ────────────────────────────────────────────

  diagnosisPost: (input: {
    question: string;
    domain: string;
    context: string;
    priorAttempts: string;
    bounty: { rail: string; amount: number; barterDescription?: string };
    visibility: string;
    source?: string;
  }): Promise<{ ok: boolean; id?: string; error?: string }> =>
    ipcRenderer.invoke('diagnosis:post', input),

  diagnosisList: (filter?: { status?: string; domain?: string }): Promise<{ ok: boolean; posts?: unknown[]; error?: string }> =>
    ipcRenderer.invoke('diagnosis:list', filter),

  diagnosisGet: (id: string): Promise<{ ok: boolean; post?: unknown; error?: string }> =>
    ipcRenderer.invoke('diagnosis:get', id),

  diagnosisAnswer: (args: { diagnosisId: string; answerText: string; sources: string[]; credentials?: string }): Promise<{ ok: boolean; answerId?: string; error?: string }> =>
    ipcRenderer.invoke('diagnosis:answer', args),

  diagnosisUpvote: (args: { diagnosisId: string; answerId: string }): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke('diagnosis:upvote', args),

  diagnosisAccept: (args: { diagnosisId: string; answerId: string }): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke('diagnosis:accept', args),

  diagnosisMarksBalance: (): Promise<{ ok: boolean; balance: number; error?: string }> =>
    ipcRenderer.invoke('diagnosis:marks-balance'),

  onDiagnosisIncoming: (callback: (data: unknown) => void): (() => void) => {
    const handler = (_: unknown, data: unknown) => callback(data);
    ipcRenderer.on('diagnosis:incoming', handler);
    return () => ipcRenderer.removeListener('diagnosis:incoming', handler);
  },

  onDiagnosisAnswerReceived: (callback: (data: { diagnosisId: string; answerId: string }) => void): (() => void) => {
    const handler = (_: unknown, data: { diagnosisId: string; answerId: string }) => callback(data);
    ipcRenderer.on('diagnosis:answer-received', handler);
    return () => ipcRenderer.removeListener('diagnosis:answer-received', handler);
  },

  onDiagnosisResolved: (callback: (data: { diagnosisId: string; answerId: string }) => void): (() => void) => {
    const handler = (_: unknown, data: { diagnosisId: string; answerId: string }) => callback(data);
    ipcRenderer.on('diagnosis:resolved', handler);
    return () => ipcRenderer.removeListener('diagnosis:resolved', handler);
  },

  // ── Post-install restart prompt v0.4.0 BP083 ─────────────────────────────

  onShowRestartPrompt: (callback: (data: { version: string; message: string }) => void): (() => void) => {
    const handler = (_: unknown, data: { version: string; message: string }) => callback(data);
    ipcRenderer.on('show-restart-prompt', handler);
    return () => ipcRenderer.removeListener('show-restart-prompt', handler);
  },

  requestAppQuit: (): Promise<void> =>
    ipcRenderer.invoke('app:request-quit'),

  // ── v0.4.2 BP083 SEG-1: Plow Worker Service ──────────────────────────────

  // Renderer subscribes to worker state (reconnect after unmount/remount)
  getPlowWorkerState: (): Promise<unknown> =>
    ipcRenderer.invoke('plow:get-worker-state'),

  onPlowWorkerState: (callback: (state: Record<string, unknown>) => void): (() => void) => {
    const handler = (_: unknown, data: Record<string, unknown>) => callback(data);
    ipcRenderer.on('plow:worker-state', handler);
    return () => ipcRenderer.removeListener('plow:worker-state', handler);
  },

  // v0.4.2 SEG-5: Plow Resume from Checkpoint
  plowCheckCheckpoint: (): Promise<unknown> =>
    ipcRenderer.invoke('plow:check-checkpoint'),

  plowResumeFromCheckpoint: (): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke('plow:resume-from-checkpoint'),

  plowDiscardCheckpoint: (): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('plow:discard-checkpoint'),

  onPlowResumePrompt: (callback: (data: Record<string, unknown>) => void): (() => void) => {
    const handler = (_: unknown, data: Record<string, unknown>) => callback(data);
    ipcRenderer.on('plow:resume-prompt', handler);
    return () => ipcRenderer.removeListener('plow:resume-prompt', handler);
  },

  // ── v0.4.2 BP083 SEG-3: Hardware Tier Detection ───────────────────────────

  hardwareGetTier: (): Promise<{ tier: unknown; allTiers: unknown[]; activeModel: string }> =>
    ipcRenderer.invoke('hardware:get-tier'),

  hardwareSetModel: (model: string, tier: string): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('hardware:set-model', { model, tier }),

  hardwareResetModel: (): Promise<{ ok: boolean; model: string }> =>
    ipcRenderer.invoke('hardware:reset-model'),

  // ── v0.4.2 BP083 SEG-3.5: Lifecycle profile path ─────────────────────────

  lifecycleGetProfilePath: (): Promise<{ appData: string; mnemosyneCPath: string }> =>
    ipcRenderer.invoke('lifecycle:get-profile-path'),

  // ── v0.5.1 BP085 — Help Tab peer pipeline ────────────────────────────────

  /** Returns the stable peer ID for this machine */
  helpGetPeerId: (): Promise<{ peerId: string }> =>
    ipcRenderer.invoke('help:get-peer-id'),

  /** Send a help message (text + optional image URL) to Supabase help_messages */
  helpSendMessage: (args: {
    text: string;
    imageUrl: string | null;
    fromPeer: string;
    toPeer: string | null;
  }): Promise<{ success: true; id: string } | { success: false; error: string }> =>
    ipcRenderer.invoke('help:send-message', args),

  /** Load recent help messages from Supabase */
  helpLoadMessages: (args: {
    limit: number;
  }): Promise<Array<{
    id: string;
    from_peer: string;
    to_peer: string | null;
    content_text: string;
    content_image_url: string | null;
    created_at: string;
  }> | { error: string }> =>
    ipcRenderer.invoke('help:load-messages', args),

  /** Upload a screenshot blob (base64) to Supabase help_screenshots bucket */
  helpUploadScreenshot: (args: {
    base64Data: string;
    mimeType: string;
  }): Promise<{ url: string } | { error: string }> =>
    ipcRenderer.invoke('help:upload-screenshot', args),

  /** Start realtime subscription for help_messages in main process */
  helpStartRealtimeSub: (): Promise<{ ok: true } | { error: string }> =>
    ipcRenderer.invoke('help:start-realtime-sub'),

  /** Register a callback for new help messages pushed from the main process */
  onHelpMessageReceived: (callback: (msg: {
    id: string;
    from_peer: string;
    to_peer: string | null;
    content_text: string;
    content_image_url: string | null;
    created_at: string;
  }) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, msg: unknown) => callback(msg as Parameters<typeof callback>[0]);
    ipcRenderer.on('help:new-message', handler);
    return () => ipcRenderer.removeListener('help:new-message', handler);
  },
  // BP087 Wave 3 - Thunderclap trial fire IPC bridge
  thunderclap: {
    fireTrial02: (options: { flagshipTier: 'claude' | 'gemma' }): Promise<{ status: string; accuracy?: string; receiptPath?: string }> =>
      ipcRenderer.invoke('thunderclap:fire-trial-02', options),
    checkGates: (): Promise<{ allGreen: boolean; output: string }> =>
      ipcRenderer.invoke('thunderclap:check-gates'),
    onLog: (callback: (line: string) => void): void => {
      ipcRenderer.on('thunderclap:log', (_event, line: string) => callback(line));
    },
    onComplete: (callback: (result: { accuracy: string; receiptPath: string; exitCode: number }) => void): void => {
      ipcRenderer.on('thunderclap:complete', (_event, result: { accuracy: string; receiptPath: string; exitCode: number }) => callback(result));
    },
    onGatesFailed: (callback: (output: string) => void): void => {
      ipcRenderer.on('thunderclap:gates-failed', (_event, output: string) => callback(output));
    },
    removeAllListeners: (): void => {
      ipcRenderer.removeAllListeners('thunderclap:log');
      ipcRenderer.removeAllListeners('thunderclap:complete');
      ipcRenderer.removeAllListeners('thunderclap:gates-failed');
    },
  },
  // BP087 Wave 3 - Gemma multi-seg dispatch IPC bridge
  gemma: {
    multiSegDispatch: (options: { question: string; workerCount?: number; model?: string }): Promise<{ synthesized: string; variance: number; workerResponses: string[]; model: string; workerCount: number }> =>
      ipcRenderer.invoke('gemma:multi-seg-dispatch', options),
  },
  // BP094 v0.8.0 — CSIA-Hybrid Inference Pipeline
  csia: {
    query: (question: string): Promise<import('../main/csia_hybrid/inference_pipeline').CSIAHybridResult> =>
      ipcRenderer.invoke('csia:query', question),
  },
  // KN-BP147-M4: UNBARREL THE BARRELS -- wraps 'usage-barrel-get-vendor-usage', the new
  // ipcMain.handle() registration in index.ts's registerIPCHandlers() IPC-HANDLER append zone.
  // That handler calls the real, already-built computeUsageBarrelOperationalSnapshot()/
  // scrapeVendorUsagePanel() in src/main/hearth/usage_barrel_scraper.ts (untouched by this
  // ticket) and shapes the result to exactly match TwoBarrelMeter.tsx's own
  // VendorUsageBarrelData renderer-local mirror type -- the return type below is an inline
  // structural mirror of that same shape (never a direct main-process import from a renderer
  // consumer, same convention MeterSummaryForBarrels already follows for
  // getAnswerCacheMeterSummary above).
  getVendorUsageBarrelSnapshot: (): Promise<{
    status: 'unknown' | 'ok' | 'error';
    fiveHour: { label: string; percentConsumed: number; resetText: string } | null;
    weeklyAllModels: { label: string; percentConsumed: number; resetText: string } | null;
    weeklyModelSpecific: { label: string; percentConsumed: number; resetText: string } | null;
    usageCredits: { usedUsd: number; limitUsd: number } | null;
    operationalAnswer: string | null;
    lastCheckedAt: string | null;
    failureReason: string | null;
  }> => ipcRenderer.invoke('usage-barrel-get-vendor-usage'),

  // ── The Crystal -- durable chonk-handle store (KN-BP147-M2, D-BP147-005) ─────────────────
  // Bridges index.ts's crystal:* IPC channels (registered in registerIPCHandlers()'s
  // IPC-HANDLER append zone, next to getCrystalStore()'s own header comment) to the renderer.
  // The Crystal itself (src/main/crystal/crystal_store.ts, KN-BP147-M1, commit ccae7f1c) is
  // main-process-only; the renderer never touches its files directly, only these five channels.
  // FAIL OPEN: every method here can legitimately resolve { ok:false, error } when the Crystal
  // failed to load at startup -- that is the ticket-mandated contract, not a bug. A renderer
  // caller must handle ok:false gracefully rather than assume success.
  crystal: {
    mint: (pearls: string[]): Promise<{ ok: boolean; sid?: string; error?: string }> =>
      ipcRenderer.invoke('crystal:mint', pearls),
    bind: (sid: string, key: string, target: CrystalBindingTarget): Promise<CrystalBindResult> =>
      ipcRenderer.invoke('crystal:bind', sid, key, target),
    mutate: (
      sid: string,
      key: string,
      target: CrystalBindingTarget,
      reason: CrystalMutationReason,
      note: string,
    ): Promise<CrystalBindResult> => ipcRenderer.invoke('crystal:mutate', sid, key, target, reason, note),
    resolve: (sid: string): Promise<{ ok: boolean; resolved: CrystalResolvedChonk | null; error?: string }> =>
      ipcRenderer.invoke('crystal:resolve', sid),
    stats: (): Promise<{
      ok: boolean;
      stats?: { mintedCount: number; logPath: string; logExists: boolean };
      error?: string;
    }> => ipcRenderer.invoke('crystal:stats'),
  },
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
      checkOllama: () => Promise<{ installed: boolean; version?: string }>;
      pullDefaultModel: () => Promise<{ success: boolean; alreadyInstalled?: boolean; error?: string }>;
      listOllamaModels: () => Promise<string[]>;
      checkDiskSpace: () => Promise<{ ok: boolean; requiredGB: number }>;
      onOllamaPullProgress: (cb: (progress: ModelPullProgress) => void) => () => void;
      pullNamedModel: (modelName: string) => Promise<{ success: boolean; alreadyInstalled?: boolean; error?: string }>;
      checkOllamaAndModel: (modelName: string) => Promise<{ reachable: boolean; hasModel: boolean; models: string[] }>;
      setupPrivateAI: () => Promise<{ ok: boolean; error?: string }>;
      markBp067FirstRunComplete: () => Promise<{ ok: boolean }>;
      askFloorModel: (prompt: string) => Promise<{ ok: boolean; text?: string; error?: string }>;
      onEngineSetupProgress: (cb: (progress: EngineSetupProgress) => void) => () => void;
      // Substrate
      substrateQuery: (query: string, model?: string) => Promise<SubstrateQueryResult>;
      substrateWrite: (text: string, source?: string, keywords?: string[]) => Promise<{ ok: boolean; id?: string }>;
      // Federation
      getFederationStatus: () => Promise<FederationStatus>;
      setMemberToken: (token: string | null) => Promise<{ ok: boolean }>;
      // Telemetry
      getAMPLIFYSnapshot: () => Promise<AMPLIFYSnapshot>;
      getAMPLIFYSummary: () => Promise<TelemetrySummary>;
      // App Version (MV-VERSION-DISPLAY BP044)
      getAppVersion: () => Promise<{ version: string; buildHash: string }>;
      // Auto-Update
      getUpdateState: () => Promise<UpdateState>;
      checkForUpdates: () => void;
      installUpdate: () => void;
      onUpdateStateChanged: (cb: (state: UpdateState) => void) => () => void;
      // MV-CN Peer Mesh (SAGA 3 BP045 W1)
      getMeshState: () => Promise<{ peers: unknown[]; relayConnected: boolean; ownPeerId: string }>;
      getRelayTier: () => Promise<{ tier: string }>;
      onRelayStateChanged: (cb: (state: { relayConnected: boolean }) => void) => () => void;
      onMeshStateChanged: (cb: (state: unknown) => void) => () => void;
      // MESH-6: Federation invite/accept/leave + SID fetch
      federationGenerateInvite?: () => Promise<{ token: string; expiresAt: string }>;
      federationAcceptInvite?: (token: string) => Promise<{ success: boolean; peerName?: string; error?: string }>;
      federationRejectInvite?: (data: { invite_token: string; source: string }) => Promise<{ ok: boolean; error?: string }>;
      federationLeavePeer?: (peerId: string) => Promise<{ ok: boolean }>;
      federationFetchSid?: (dag_id: string, peerId: string) => Promise<{ ok: boolean; node?: unknown; hash_verified: boolean; error?: string }>;
      // SEG-5 v0.1.56 — connect-peer
      federationConnectPeer?: (peerId: string, relayUrl?: string) => Promise<{ success: boolean; error?: string }>;
      // BP134 Yoke #30 Task B — zero-config WAN auto-connect from peer_presence
      federationAutoConnectPresence?: () => Promise<{ attempted: number; connected: string[]; error?: string }>;
      // SEG-5 v0.1.56 — silent email stub
      sendSilentEmail?: (args?: unknown) => Promise<{ success: boolean; reason: string }>;
      // SEG-3 v0.1.55 — COMMUNITY-CONNECT first-launch seed peer handshake
      communityConnectHandshake?: () => Promise<{ success: boolean; peerName?: string; error?: string }>;
      // BP084 SEG-3 — Substrate Awakens join flow
      substrateAwakensRegister?: (email: string, displayName: string, ramTier: string) => Promise<{ success: boolean; message?: string; error?: string }>;
      substrateAwakensHandshake?: (token: string, email: string, displayName: string) => Promise<{ success: boolean; peerId?: string; displayName?: string; error?: string }>;
      substrateAwakensGetState?: () => Promise<{ joined: boolean; peerId?: string; displayName?: string; joinedAt?: string } | null>;
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
      // Browser-authority Nexus IPC leg (BP137 Yoke v2b Integration-1, Part 2)
      runBrowserAuthorityQuery?: (
        query: import('../shared/plow/browser_authority_types').BrowserAuthorityQuery,
      ) => Promise<import('../shared/plow/browser_authority_types').BrowserAuthorityRawExtraction | null>;
      // D-BP149-034/BISHOP/S34/seg-lianaterminal
      lianaTerminalRun?: (
        input: string,
      ) => Promise<import('../shared/liana_cycle/liana_terminal_types').LianaTerminalOutcome>;
      onLianaTerminalEvent?: (
        cb: (evt: import('../shared/liana_cycle/liana_terminal_types').LianaTerminalEvent) => void,
      ) => () => void;
      // Nexus Authority persistent session (BP137 0.9.12 Stage F1)
      setNexusAuthorityBrowserFlags?: (
        researchArmMode: boolean,
        researchArmBrowserAuthority: boolean,
      ) => Promise<{ ok: boolean; enabled: boolean }>;
      openNexusAuthoritySignIn?: (
        authority: 'user_google' | 'user_perplexity' | 'user_claude',
      ) => Promise<{ ok: boolean; reason: string | null }>;
      hideNexusAuthoritySession?: () => Promise<{ ok: boolean }>;
      checkNexusAuthoritySignInStatus?: () => Promise<{
        enabled: boolean;
        statuses: Array<{ authority: 'user_google' | 'user_perplexity' | 'user_claude'; signedIn: boolean; reason: string; checkedAt: string }>;
      }>;
      // BP138 Yoke 0.9.15 FIX 4 -- Ask tab's raw-fact lookup entry point.
      // BP148 D-BP148-029: perArmAssignedAuthority/perArmRestrictedTo/perArmFellBack/
      // perArmFallbackReason are ADDITIVE -- see the matching declaration above (the real
      // ipcRenderer.invoke-typed one this ambient block mirrors) for the full field-by-field
      // explanation.
      nexusAskLookupFact?: (question: string) => Promise<{
        answerType: 'computable' | 'lookup_fact' | 'reasoning';
        usable: boolean;
        reason?: 'flag_off' | 'not_lookup_fact' | 'authority_empty';
        fact?: string;
        sourceUrl?: string;
        authority?: 'user_google' | 'user_perplexity';
        confidence?: number;
        perArmAssignedAuthority?: 'local_free' | 'user_google' | 'user_perplexity' | 'paid_api' | null;
        perArmRestrictedTo?: 'user_google' | 'user_perplexity' | null;
        perArmFellBack?: boolean;
        perArmFallbackReason?: 'assigned_authority_unavailable';
      }>;
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
      // In Conjunction Agent Panel — SAGA 4 BP041
      agentProbe: (agentId: string, opts?: { force?: boolean; modelId?: string }) => Promise<{ agentId: string; status: string; reason?: string; probed_at?: string }>;
      agentSetApiKey: (agentId: string, keyValue: string) => Promise<{ ok: boolean; error?: string }>;
      agentGetApiKeyStatus: () => Promise<Record<string, boolean>>;
      agentGetTierChoices: () => Promise<Record<string, string>>;
      agentSetTierChoice: (agentId: string, tierId: string) => Promise<{ ok: boolean }>;
      agentGetPlugins: () => Promise<Array<{ id: string; displayName: string; subtitle: string; icon: string; tiers?: Array<{ id: string; label: string; tierClass: string; modelId: string }>; requiresKey?: string; source: string }>>;
      agentGetPluginRegistry: () => Promise<Array<{ id: string; filename: string; displayName: string; ipLedgerRef?: string; authorHandle?: string; loadedAt: string }>>;
      // SubstratedFolderWatcher™ (SAGA-γ v0.1.10)
      watcher?: {
        addFolder: (folderPath: string) => Promise<unknown>;
        removeFolder: (folderId: string) => Promise<boolean>;
        listFolders: () => Promise<unknown[]>;
        getStats: () => Promise<unknown>;
        openFolderDialog: () => Promise<{ canceled: boolean; filePaths: string[] }>;
        onEbletMinted: (callback: (eblet: unknown) => void) => void;
        onFolderError: (callback: (payload: { folderId: string; error: string }) => void) => void;
      };
      // Trail Eblet Reader (KniPr035)
      trailEblet?: {
        list: () => Promise<{ files: string[]; dir: string }>;
        read: (args: { filePath: string }) => Promise<{ ok: boolean; content?: string; error?: string }>;
        listScreenshots: (args: { ebletPath: string }) => Promise<{ files: string[]; dir: string }>;
        readScreenshot: (args: { filePath: string }) => Promise<{ ok: boolean; dataUrl?: string; error?: string }>;
      };
      // BP067 Phase 3B — focus-tab deep-link event
      onNavigateFocusTab?: (cb: (tabId: string) => void) => () => void;
      // SEG-V0153A — mnemo://accept?token=<token> deep-link accept-invite push
      onFederationDeepLinkAccept?: (cb: (data: { token: string; slug: string }) => void) => () => void;
      // SAGA 13 BP046B
      creditFirstInstallMarks: () => void;
      // v0.2.0 BP082 — OAuth + Marks
      oauth?: {
        startFlow: (platform: 'discord' | 'reddit') => Promise<{
          success: boolean;
          username?: string;
          scopes?: string[];
          error?: string;
          needsRegistration?: boolean;
        }>;
        revokeToken: (platform: 'discord' | 'reddit') => Promise<{ ok: boolean }>;
        accrueConnectMarks: (platform: 'discord' | 'reddit', amount: number) => Promise<{ ok: boolean; total?: number }>;
        getConnectionInfo: (platform: 'discord' | 'reddit') => Promise<{ connected: boolean; username?: string }>;
      };
      // SAGA 07 BP046B utilities
      openExternal?: (url: string) => void;
      hideOverlay?: () => void;
      showOverlay?: () => void;
      getTelemetrySummary?: () => Promise<unknown>;
      // Chronos Research Consent (KniPr038)
      writeChronosConsent?: (consentPayload: object) => Promise<{ ok: boolean; ebletPath?: string }>;
      revokeChronosConsent?: (payload?: object) => Promise<{ ok: boolean; ebletPath?: string }>;
      // Phoebe™ Idea Storage (C.17 · BP055)
      saveIdea?: (idea: { title: string; content: string; timestamp: string }) => Promise<{ ok: boolean; id: string }>;
      getIdeas?: () => Promise<{ ok: boolean; ideas: Array<{ id: string; title: string; content: string; timestamp: string }> }>;
      // Pearl-decode IPC (Tier G · v0.1.16 · BP057 W5c)
      decodePearl?: (pearlId: string) => Promise<{ ok: boolean; pearl?: Record<string, string>; content?: string; error?: string }>;
      // Bridge IPC (BP060 Application 002 Steps 3+4 · UI-7)
      bridge?: {
        checkMessages: (count?: number) => Promise<{
          ok: boolean; messages: Array<{id: string; type: string; from: string; to: string; content: string; ts: number; pinned?: boolean}>;
          pinned: Array<{id: string; type: string; from: string; to: string; content: string; ts: number; pinned?: boolean}>;
          total_in_file: number; yoke_path: string; read_at: string; error?: string;
        }>;
        sendMessage: (args: { to: string; type: string; content: string; from?: string }) => Promise<{ ok: boolean; message_id?: string; error?: string }>;
      };
      // AI Dispatch IPC (BP060 Application 002 Steps 3+4 · UI-8)
      aiDispatch?: {
        query: (args: { court_member: string; messages: Array<{role: string; content: string}>; model_override?: string }) => Promise<{ ok: boolean; text?: string; model?: string; provider?: string; error?: string; streaming?: boolean }>;
        // KN-BP144-8 Phase 1: free-text question path that calls canonical_pipeline.ts's engine.
        queryEngine: (args: { question: string }) => Promise<{ ok: boolean; streaming?: boolean; error?: string }>;
        onAskEngineProgress: (handler: (data: {
          type: string; specialistName?: string; specialistCandidates?: number;
          minerPassed?: number; furnacePassed?: number;
          substrateTier?: string | null; substrateProvenance?: string; andonRetry?: number;
        }) => void) => () => void;
        listLocalModels: () => Promise<{ ok: boolean; models: string[]; error?: string }>;
        testConnection: () => Promise<{ ok: boolean; models: string[]; url: string; error?: string }>;
        getSettings: () => Promise<{ ok: boolean; settings?: { answer_cache_mode?: boolean; [k: string]: unknown }; error?: string }>;
        saveSettings: (settings: { local_runtime_url?: string; answer_cache_mode?: boolean; [k: string]: unknown }) => Promise<{ ok: boolean }>;
        // v0.1.57.1: token streaming events (BP081)
        onAskTokenProgress: (handler: (data: { delta: string; assembled: string; coldStart?: boolean }) => void) => () => void;
        // BP136 Yoke: answer-cache fields added (all optional/additive)
        onAskTokenComplete: (handler: (data: {
          content: string; error?: string; hotHits?: number;
          servedFromSubstrate?: boolean; cost_usd?: number; latency_ms?: number;
          provenance?: string; verified?: boolean;
          // KN-BP144-8 Phase 1, ADDITIVE: only present on a query-engine completion.
          engine?: {
            abstained: boolean; abstainReason?: string; servedFromSubstrate: boolean;
            substrateTier?: string | null; concordance?: string; bmvScore?: number;
            gateOutcomes?: Array<{ gate: string; passed: boolean; detail: string }>;
            specialistOutcomes?: Array<{ name: string; fired: boolean; candidateCount: number }>;
            andonTriggered?: boolean; andonRetries?: number; ebletsWritten?: number;
          };
        }) => void) => () => void;
        // BP136 Yoke: real, restart-surviving meter for the Prove It panel
        getAnswerCacheMeterSummary?: () => Promise<{
          ok: boolean;
          summary?: {
            total_queries: number; served_verbatim_count: number; rag_count: number;
            local_generate_count: number; flagship_count: number;
            cloud_cost_avoided_usd: number; avg_latency_ms: number; avg_served_verbatim_latency_ms: number;
          };
          error?: string;
        }>;
      };
      // Onboarding Prefs (BP065 v0.1.23)
      applyOnboardingPrefs?: (prefs: { displayName?: string; addDesktopShortcut?: boolean; addStartupItem?: boolean; apiKey?: string }) => Promise<{ ok: boolean; results?: Record<string, boolean> }>;
      // LB Account (BP065 Part A)
      lbStartAuth?: (email: string) => Promise<{ ok: boolean; error?: string }>;
      lbGetSession?: () => Promise<{ linked: boolean; user_id?: string; email?: string; peer_id?: string; linked_at?: string; crewman_number?: number }>;
      lbLinkDevice?: (access_token: string, refresh_token: string, email: string) => Promise<{ ok: boolean; error?: string }>;
      lbRevokeDevice?: () => Promise<{ ok: boolean; error?: string }>;
      onLbAuthComplete?: (cb: (session: { user_id: string; email: string; peer_id: string; crewman_number?: number }) => void) => () => void;
      // Frontier Node (BP065 Part B)
      lbRegisterFrontierNode?: () => Promise<{ ok: boolean; frontier_node_id?: string; error?: string }>;
      lbWithdrawFrontierNode?: () => Promise<{ ok: boolean; error?: string }>;
      lbGetFrontierStatus?: () => Promise<{ registered: boolean; frontier_node_id?: string; last_heartbeat?: string; withdrawn?: boolean }>;
      // Opt-In Strike Tracker (BP065 3-strikes)
      lbOptInGetState?: () => Promise<{ strikes: number; lastShown: number | null; decision: string }>;
      lbOptInRecordStrike?: () => Promise<{ ok: boolean }>;
      lbOptInSetDecision?: (decision: 'never' | 'pending' | 'linked') => Promise<{ ok: boolean }>;
      // BP067 Phase 1A — $5 membership checkout
      membership?: {
        createCheckout: (autoRenew: boolean) => Promise<{ ok: boolean; url?: string; error?: string; fallbackUrl?: string }>;
        verifyStatus: () => Promise<{ ok: boolean; membership_active: boolean; error?: string }>;
      };
      // runMeshTest (BP078 Scope 1)
      runMeshTest?: (payload?: { testId?: string; timeoutMs?: number }) => Promise<{
        success: boolean;
        grading?: { accuracy: number; hash_verified: number; p50_latency_ms: number; p95_latency_ms?: number; total_questions: number };
        error?: 'MISSING_API_KEY' | 'TIMEOUT' | 'PYTHON_ERROR' | 'MISSING_PYTHON_RUNTIME' | 'NO_PEER';
        static_fallback?: boolean;
      }>;
      // Caithedral Tools IPC (BP060 Application 002 Step 1)
      caithedralTools?: {
        soccerball_emit: (pearls: string[], bindings?: Record<string, string>) => Promise<{ ok: boolean; sid?: string; error?: string }>;
        soccerball_decode: (sid: string) => Promise<{ ok: boolean; result?: { pearls: string[]; bindings: Record<string, string> } | null; error?: string }>;
        soccerball_lookup: (sid: string) => Promise<{ ok: boolean; result?: unknown; error?: string }>;
        speckle_nibble: (sid: string, position: number) => Promise<{ ok: boolean; nibble?: string; error?: string }>;
        eblit_emit: (pearl_id: string, source_cathedral: string, ts?: number) => Promise<{ ok: boolean; eblit?: unknown; error?: string }>;
        substrace_weave: (eblit_null_lines: string[], weaver: string, weave_ts?: number) => Promise<{ ok: boolean; substrace?: unknown; error?: string }>;
        quilt_compose: (substrace_ids: string[], narrative_tag: string, weaver: string, ts?: number) => Promise<{ ok: boolean; quilt?: unknown; error?: string }>;
        substrate_address_emit: (seed: string, ts?: number) => Promise<{ ok: boolean; address?: unknown; error?: string }>;
        substrate_address_validate: (address: string) => Promise<{ ok: boolean; result?: unknown; error?: string }>;
        ten_pearl_roundtrip: () => Promise<{ ok: boolean; result?: unknown; error?: string }>;
        areopagus_query: (query: string) => Promise<{ ok: boolean; matches?: Array<{ sid: string; pearls: string[]; score: number }>; query?: string; searched_at?: number; error?: string }>;
      };
      // Kitchen Table™ + Recipes™ + Atlas™ (BP052 v0.1.8)
      kitchenTable: {
        listSessions: () => Promise<unknown[]>;
        getSession: (id: string) => Promise<unknown>;
        createSession: (data: unknown) => Promise<unknown>;
        updateSession: (id: string, data: unknown) => Promise<unknown>;
        deleteSession: (id: string) => Promise<boolean>;
        listRecipes: () => Promise<unknown[]>;
        getRecipe: (id: string) => Promise<unknown>;
        createRecipe: (data: unknown) => Promise<unknown>;
        updateRecipe: (id: string, data: unknown) => Promise<unknown>;
        deleteRecipe: (id: string) => Promise<boolean>;
        listAtlasEvents: () => Promise<unknown[]>;
        getAtlasEvent: (id: string) => Promise<unknown>;
        createAtlasEvent: (data: unknown) => Promise<unknown>;
        updateAtlasEvent: (id: string, data: unknown) => Promise<unknown>;
        deleteAtlasEvent: (id: string) => Promise<boolean>;
        openPhotoDialog: () => Promise<string | null>;
        p2pStart: (peerId: string, displayName: string) => Promise<{ ok: boolean; active: boolean }>;
        p2pStop: () => Promise<{ ok: boolean }>;
        p2pPeers: () => Promise<{ peers: unknown[]; active: boolean }>;
      };
      // SKU (BP078 Scope 6.5)
      sku: {
        checkModel: (modelName: string) => Promise<{ exists: boolean; modelName: string }>;
        upgradeTo: (tier: 'core' | 'lite' | 'full') => Promise<{ ok: boolean; error?: string }>;
        cancelUpgrade: () => Promise<{ ok: boolean }>;
        currentTier: () => Promise<{ tier: 'nano' | 'core' | 'lite' | 'full' }>;
        onPullProgress: (cb: (data: SkuPullProgress) => void) => () => void;
        onPullComplete: (cb: () => void) => () => void;
        onPullError: (cb: (err: string) => void) => () => void;
      };
      // Black Crow Feather earn (BP078)
      earnBlackCrowFeather?: (payload: { userId: string; reason: string; metadata?: Record<string, unknown> }) => Promise<{ ok: boolean; featherId?: string; alreadyIssued?: boolean; error?: string }>;
      // SEG-Q-3 BP078: DevTools toggle
      toggleDevTools: () => void;
      // SEG-V0144-UI-1: Interface zoom
      setZoomFactor: (factor: number) => void;
      // SEG-Q-4 BP078: Auto-prepare FULL upgrade
      getAutoPrepare: () => Promise<{ enabled: boolean; modelReady: boolean; pulling: boolean }>;
      setAutoPrepare: (enabled: boolean) => void;
      onAutoPrepareReady: (cb: () => void) => () => void;
      // SEG-U-7 BP078: mesh-test-complete push event
      onMeshTestComplete?: (cb: (metrics: {
        hot_accuracy_pct: number;
        cold_accuracy_pct: number;
        delta_pp: number;
        fast_cheap_good: string;
        svgPath?: string;
      }) => void) => () => void;
      // SEG-V0149-P0: lean-install-start + streaming events
      leanInstallStart?: () => Promise<{ ok: boolean; waitingForInstall?: boolean; error?: string }>;
      onLeanInstallStatus?: (cb: (data: { step: string; message: string }) => void) => () => void;
      onLeanInstallProgress?: (cb: (data: { bytesDownloaded: number; totalBytes: number; percentComplete: number; speedLabel: string; eta_s: number }) => void) => () => void;
      onLeanInstallError?: (cb: (data: { message: string; retryable: boolean }) => void) => () => void;
      // SEG-V0150-P0-FIX-BRIDGE-OR-FALLBACK: skip-path
      writeSkuTierSkip?: () => Promise<{ ok: boolean; error?: string }>;
      // SEG-V0151-P0-AUTOMATIC-BACKGROUND: lean-bg-status events from main
      onLeanBgStatus?: (cb: (payload: { type: string; msg: string; pct?: number }) => void) => () => void;
      // BP080 Genesis Mint — IP Ledger IPC
      ipLedgerGetGenesis?: () => Promise<unknown>;
      ipLedgerFounderVcardQr?: () => Promise<{ dataUrl: string; vcard: string } | { error: string } | null>;
      ipLedgerExecuteGenesisMint?: () => Promise<unknown>;
      ipLedgerGenesisMintFull?: () => Promise<unknown>;
      // SEG-2 v0.1.56 — first-launch progressive auto-pull (gemma4:12b)
      firstLaunchModelPull: {
        check: (modelName: string) => Promise<{ exists: boolean; modelName: string }>;
        start: (modelName: string) => Promise<{ ok: boolean; alreadyInstalled?: boolean; cancelled?: boolean; error?: string }>;
        cancel: () => Promise<{ ok: boolean }>;
        onProgress: (cb: (data: { percent: number; downloaded: number; total: number; status: string }) => void) => () => void;
        onComplete: (cb: () => void) => () => void;
        onError: (cb: (err: string) => void) => () => void;
      };
      // SEG-2 v0.1.57: Test It Out — substrate-warming 5-question workout
      runTestItOut?: () => Promise<{ success: boolean; score?: number; total?: number; error?: string }>;
      getTestItOutHistory?: () => Promise<{ runs: Array<{ ts: number; score: number; total: number; model: string }> }>;
      onTestItOutProgress?: (cb: (data: {
        questionIndex: number;
        total: number;
        question: string;
        modelAnswer: string;
        correctAnswer: string;
        isCorrect: boolean;
      }) => void) => () => void;
      onTestItOutComplete?: (cb: (data: {
        score: number;
        total: number;
        results: Array<{
          questionIndex: number;
          question: string;
          modelAnswer: string;
          correctAnswer: string;
          isCorrect: boolean;
        }>;
      }) => void) => () => void;
      // SEG-A2 BP081: Substrate stats dashboard
      getSubstrateStats?: () => Promise<{
        totalEblets: number;
        verifiedCount: number;
        lastWriteTimestamp: number | null;
        topDomains: Array<{ domain: string; count: number; lastWrite: number }>;
        recentWrites: Array<{ questionExcerpt: string; provenanceSource: string; timestamp: number }>;
        growthTrend: Array<{ date: string; count: number }>;
        quarantinedCount: number;
        error?: string;
      }>;
      // BP081 K-1: Membership backend (stub tier)
      membershipStartCheckout?: () => Promise<{ success: boolean; sessionId?: string; checkoutUrl?: string; error?: string; isStub: boolean }>;
      membershipGetStatus?: () => Promise<{ tier: string; status: string; annualFeeUsd: number }>;
      membershipCancel?: () => Promise<{ success: boolean; reason?: string }>;
      // BP081 K-2: MCP Substrate Bridge
      mcpGetStatus?: () => Promise<{
        running: boolean;
        port: number | null;
        connectedClients: number;
        recentCalls: Array<{ tool: string; ts: number; clientId: string }>;
      }>;
      mcpGetAuthToken?: () => Promise<string | null>;
      // SEG-4 v0.1.59 — Plow the Field
      runAndonReplowLoop?: (question: string, domain: string) => Promise<{
        ok: boolean;
        verdict: 'verified' | 'rejected' | 'quarantined';
        ebletWritten: boolean;
        question?: string;
        answer?: string;
        modelAnswer?: string;
        error?: string;
      }>;
      loadDomainBank?: (domain: string) => Promise<Array<{
        question: string;
        options: string[];
        correct_answer: string;
        source_id: string;
        source_category: string;
      }>>;
      // BP134 Yoke #32 Phase D — Field-Sowing Runner
      runFieldSowing?: (fsConfig: {
        domain: string;
        maxPasses?: number;
        timeBudgetMs?: number;
        resume?: boolean;
      }) => Promise<{ ok: boolean; result?: unknown; error?: string }>;
      cancelFieldSowing?: () => Promise<{ ok: boolean }>;
      onFieldSowingProgress?: (callback: (event: unknown) => void) => () => void;
      // BP134 Yoke #32 Phase G — "improves-over-time" manual refresh
      refreshChocolatePack?: () => Promise<{ ok: boolean; manifest?: unknown; error?: string }>;
      // BP082 v0.2.2 — Founder substrate seed
      plowSeedFromBank?: () => Promise<{
        ok: boolean;
        written: number;
        skipped: number;
        total: number;
        errors: string[];
      }>;
      onPlowSeedProgress?: (
        callback: (data: { written: number; skipped: number; total: number; pct: number; done?: boolean }) => void,
      ) => () => void;
      // BP083 SEG-5 — Reset + Reseed Context-Class
      plowResetAndReseedContext?: () => Promise<{ ok: boolean; written: number; total: number; backupPath: string }>;
      onPlowResetReseedProgress?: (
        callback: (data: { written: number; total: number; pct: number; done?: boolean }) => void,
      ) => () => void;
      // BP082 v0.2.3 — Beat-Google Benchmark (apples-to-apples handicapped comparison)
      getGoogleBaselines?: () => Promise<unknown>;
      runBenchmark?: (config: { nPerDomain: number; randomSeed: number; model: string; ollamaBaseUrl: string }) => Promise<{ ok: boolean; result?: unknown; error?: string }>;
      cancelBenchmark?: () => Promise<{ ok: boolean }>;
      writeBenchmarkReceipt?: (args: { receiptMarkdown: string; timestamp: number }) => Promise<{ ok: boolean; path?: string }>;
      onBenchmarkProgress?: (callback: (event: Record<string, unknown>) => void) => () => void;
      // BP082 v0.3.1 — 3-Condition Mesh Comparison
      runMeshComparison?: (config: { nPerDomain: number; randomSeed: number; model: string; ollamaBaseUrl: string }) => Promise<{ ok: boolean; result?: unknown; error?: string }>;
      cancelMeshComparison?: () => Promise<{ ok: boolean }>;
      onMeshComparisonProgress?: (callback: (event: Record<string, unknown>) => void) => () => void;
      // BP083 v0.3.4 — Canonical Plow Pipeline
      runCanonicalPlow?: (config: {
        domains: string[];
        questionsPerDomain: number;
        model?: string;
        ollamaBaseUrl?: string;
        specialistKeys?: { wolframApiKey?: string; stackExchangeKey?: string; pubmedApiKey?: string };
      }) => Promise<{ ok: boolean; result?: unknown; error?: string }>;
      cancelCanonicalPlow?: () => Promise<{ ok: boolean }>;
      onCanonicalPlowProgress?: (callback: (event: Record<string, unknown>) => void) => () => void;
      // SEG-5 v0.1.59 — Clipboard capture
      readClipboard?: () => Promise<string>;
      onClipboardCaptureQA?: (callback: () => void) => () => void;
      // A-3 BP081 v0.1.59.1 — App version check
      onAppVersionCheck?: (callback: (data: { version: string }) => void) => () => void;
      // A-4 BP081 v0.1.59.1 — Onboarding auto-flip check
      onOnboardingAutoFlipCheck?: (callback: (data: { ollamaHealthy: boolean; gemmaPresent: boolean }) => void) => () => void;
      // Battery Dispatch v0.3.0 — BP082
      dispatchListContentFiles?: () => Promise<unknown[]>;
      dispatchDefaultPlatforms?: (cls: string) => Promise<string[]>;
      dispatchGetFileBody?: (filePath: string) => Promise<{ v1Body?: string; v2Body?: string; error?: string }>;
      dispatchFire?: (req: { filePath: string; platforms: string[]; ratifiedPlatforms: string[] }) => Promise<unknown>;
      dispatchHistory?: () => Promise<unknown[]>;
      dispatchCredentialStatus?: () => Promise<{ substack: boolean; medium: boolean; gmail: boolean; cephas: boolean; lianabanyan: boolean; hackernews: boolean }>;
      onDispatchProgress?: (callback: (msg: string) => void) => () => void;
      // BP083 SEG-5: MEMORY.md self-context panel
      mnemoGetMemoryMd?: () => Promise<{ ok: boolean; content?: string; error?: string }>;
      mnemoReloadMemoryMd?: () => Promise<{ ok: boolean; content?: string; error?: string }>;
      mnemoResetMemoryMd?: () => Promise<{ ok: boolean; content?: string; error?: string }>;
      mnemoOpenMemoryEditor?: () => Promise<{ ok: boolean; error?: string }>;
      // BP083 v0.3.8 — GPQA Diamond Benchmark
      runDiamond?: (config: { mode: 'bare' | 'cooperative'; count: number }) => Promise<{ ok: boolean; summary?: unknown; error?: string }>;
      cancelDiamond?: () => Promise<{ ok: boolean }>;
      onDiamondProgress?: (callback: (event: Record<string, unknown>) => void) => () => void;
      // v0.4.0 BP083 — MIC (Machine In Charge) Constellation dispatcher
      micStartDistributedPlow?: (config: { domains: string[]; questionsPerDomain: number; model?: string; ollamaBaseUrl?: string }) => Promise<{ ok: boolean; result?: unknown; error?: string }>;
      micCancel?: () => Promise<{ ok: boolean }>;
      micGetPeers?: () => Promise<unknown[]>;
      micAddPeer?: (peer: unknown) => Promise<{ ok: boolean }>;
      micRemovePeer?: (peerId: string) => Promise<{ ok: boolean }>;
      micDiscoverPeers?: () => Promise<unknown[]>;
      micEstimateWallclock?: (config: { domains: string[]; questionsPerDomain: number }) => Promise<{ estimatedMs: number; onlinePeers: number }>;
      onMicStatusEvent?: (callback: (event: Record<string, unknown>) => void) => () => void;
      // v0.4.0 BP083 — The Diagnosis
      diagnosisPost?: (input: { question: string; domain: string; context: string; priorAttempts: string; bounty: { rail: string; amount: number; barterDescription?: string }; visibility: string; source?: string }) => Promise<{ ok: boolean; id?: string; error?: string }>;
      diagnosisList?: (filter?: { status?: string; domain?: string }) => Promise<{ ok: boolean; posts?: unknown[]; error?: string }>;
      diagnosisGet?: (id: string) => Promise<{ ok: boolean; post?: unknown; error?: string }>;
      diagnosisAnswer?: (args: { diagnosisId: string; answerText: string; sources: string[]; credentials?: string }) => Promise<{ ok: boolean; answerId?: string; error?: string }>;
      diagnosisUpvote?: (args: { diagnosisId: string; answerId: string }) => Promise<{ ok: boolean; error?: string }>;
      diagnosisAccept?: (args: { diagnosisId: string; answerId: string }) => Promise<{ ok: boolean; error?: string }>;
      diagnosisMarksBalance?: () => Promise<{ ok: boolean; balance: number; error?: string }>;
      onDiagnosisIncoming?: (callback: (data: unknown) => void) => () => void;
      onDiagnosisAnswerReceived?: (callback: (data: { diagnosisId: string; answerId: string }) => void) => () => void;
      onDiagnosisResolved?: (callback: (data: { diagnosisId: string; answerId: string }) => void) => () => void;
      // v0.4.0 BP083 — Post-install restart prompt
      onShowRestartPrompt?: (callback: (data: { version: string; message: string }) => void) => () => void;
      requestAppQuit?: () => Promise<void>;
      // v0.4.2 BP083 SEG-1: Plow Worker Service
      getPlowWorkerState?: () => Promise<unknown>;
      onPlowWorkerState?: (callback: (state: Record<string, unknown>) => void) => () => void;
      // v0.4.2 BP083 SEG-5: Plow Resume from Checkpoint
      plowCheckCheckpoint?: () => Promise<unknown>;
      plowResumeFromCheckpoint?: () => Promise<{ ok: boolean; error?: string }>;
      plowDiscardCheckpoint?: () => Promise<{ ok: boolean }>;
      onPlowResumePrompt?: (callback: (data: Record<string, unknown>) => void) => () => void;
      // v0.4.2 BP083 SEG-3: Hardware Tier Detection
      hardwareGetTier?: () => Promise<{ tier: unknown; allTiers: unknown[]; activeModel: string }>;
      hardwareSetModel?: (model: string, tier: string) => Promise<{ ok: boolean }>;
      hardwareResetModel?: () => Promise<{ ok: boolean; model: string }>;
      // v0.4.2 BP083 SEG-3.5: Lifecycle profile path
      lifecycleGetProfilePath?: () => Promise<{ appData: string; mnemosyneCPath: string }>;
      // v0.5.1 BP085 — Help Tab peer pipeline
      helpGetPeerId?: () => Promise<{ peerId: string }>;
      helpSendMessage?: (args: { text: string; imageUrl: string | null; fromPeer: string; toPeer: string | null }) => Promise<{ success: true; id: string } | { success: false; error: string }>;
      helpLoadMessages?: (args: { limit: number }) => Promise<Array<{ id: string; from_peer: string; to_peer: string | null; content_text: string; content_image_url: string | null; created_at: string }> | { error: string }>;
      helpUploadScreenshot?: (args: { base64Data: string; mimeType: string }) => Promise<{ url: string } | { error: string }>;
      helpStartRealtimeSub?: () => Promise<{ ok: true } | { error: string }>;
      onHelpMessageReceived?: (callback: (msg: { id: string; from_peer: string; to_peer: string | null; content_text: string; content_image_url: string | null; created_at: string }) => void) => () => void;
      // BP087 Wave 3 - Thunderclap
      thunderclap: {
        fireTrial02: (options: { flagshipTier: 'claude' | 'gemma' }) => Promise<{ status: string; accuracy?: string; receiptPath?: string }>;
        checkGates: () => Promise<{ allGreen: boolean; output: string }>;
        onLog: (callback: (line: string) => void) => void;
        onComplete: (callback: (result: { accuracy: string; receiptPath: string; exitCode: number }) => void) => void;
        onGatesFailed: (callback: (output: string) => void) => void;
        removeAllListeners: () => void;
      };
      // BP087 Wave 3 - Gemma
      gemma: {
        multiSegDispatch: (options: { question: string; workerCount?: number; model?: string }) => Promise<{ synthesized: string; variance: number; workerResponses: string[]; model: string; workerCount: number }>;
      };
      // BP094 v0.8.0 — CSIA-Hybrid
      csia: {
        query: (question: string) => Promise<{
          verdict: 'ANSWER' | 'REFUSAL';
          answer?: string;
          refusal_reason?: string;
          provenance: Array<{ evidence_id: string; category_slug: string; content_preview: string; contributor_member_id: string; soccerball_hash?: string }>;
          system_prompt_used: string;
          model_used: string;
          star_chamber: 'GREEN' | 'RED' | 'SKIP';
          scrambler: 'GREEN' | 'RED' | 'SKIP';
          keys_engines: 'GREEN' | 'RED' | 'SKIP';
          green_count: number;
          run_id: string;
          elapsed_ms: number;
          evidence_count: number;
        }>;
      };
      // KN-BP147-M4: UNBARREL THE BARRELS
      getVendorUsageBarrelSnapshot: () => Promise<{
        status: 'unknown' | 'ok' | 'error';
        fiveHour: { label: string; percentConsumed: number; resetText: string } | null;
        weeklyAllModels: { label: string; percentConsumed: number; resetText: string } | null;
        weeklyModelSpecific: { label: string; percentConsumed: number; resetText: string } | null;
        usageCredits: { usedUsd: number; limitUsd: number } | null;
        operationalAnswer: string | null;
        lastCheckedAt: string | null;
        failureReason: string | null;
      }>;
    };
    // SEG-V0150-P0-DIAGNOSE-BRIDGE: sentinel — set by preload before main bridge wires up
    __preloadLoaded?: boolean;
  }
}
