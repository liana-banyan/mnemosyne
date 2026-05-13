// AMPLIFY Computer — Renderer-side type declarations for window.amplify
// B37 Phase 3 — mirrors contextBridge API in src/main/preload.ts

export type FrameMode = 'ai_burst' | 'normal' | 'fallback';

export interface UpdateState {
  status: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error' | 'not-available';
  version?: string;
  releaseNotes?: string;
  downloadProgress?: number;
  errorMessage?: string;
}

export interface FrameModePayload {
  mode: FrameMode;
  forced_mode: FrameMode | null;
}

export interface OllamaStatus {
  running: boolean;
  model: string | null;
  version?: string;
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

export interface ModelPullProgress {
  status: 'pulling' | 'verifying' | 'complete' | 'error';
  bytesDownloaded?: number;
  totalBytes?: number;
  percentComplete?: number;
  error?: string;
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
      // Substrate (Phase 3)
      substrateQuery: (query: string, model?: string) => Promise<SubstrateQueryResult>;
      substrateWrite: (text: string, source?: string, keywords?: string[]) => Promise<{ ok: boolean; id?: string }>;
      // Federation (Phase 3)
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
      hearthBuild: (request: string, memberId?: string) => Promise<{ ok: boolean; appUuid?: string; appDir?: string; spec?: import('../main/hearth_app_builder/types').AppSpec; installerPath?: string; error?: string }>;
      hearthInstall: (opts: { uuid: string; appName: string; description: string; appDir: string; installerPath: string; spec: import('../main/hearth_app_builder/types').AppSpec }) => Promise<{ ok: boolean; error?: string }>;
      hearthLibraryQuery: (memberId?: string) => Promise<import('../main/hearth_app_builder/types').HearthApp[]>;
      hearthUninstall: (uuid: string) => Promise<{ ok: boolean; error?: string }>;
      hearthHealthz: () => Promise<import('../main/hearth_app_builder/types').HearthHealthz>;
      hearthSpecExtractSmoke: () => Promise<import('../main/hearth_app_builder/types').HearthSpecSmokeResult>;
      onHearthBuildProgress: (cb: (progress: import('../main/hearth_app_builder/types').BuildProgress) => void) => () => void;
      onHearthBuildComplete: (cb: (result: { appUuid: string; appName: string; installerPath?: string; buildDurationMs: number }) => void) => () => void;
      onHearthBuildError: (cb: (err: { appUuid: string; appName: string; error: string; lastStderr: string }) => void) => () => void;
      // Hearth Conjunction Window (B83)
      openHearthConjunction: () => void;
      hideToWatchView?: () => Promise<{ ok: boolean }>;
      conjunctionGetState: () => Promise<import('./hearth/conjunction/types').ConjunctionPanelState>;
      conjunctionGetAvailability: () => Promise<import('./hearth/conjunction/types').BackendAvailability>;
      conjunctionSelect: (mode: import('./hearth/conjunction/types').ConjunctionMode) => Promise<{ ok: boolean; previous: import('./hearth/conjunction/types').ConjunctionMode }>;
      conjunctionSetOverride: (mode: import('./hearth/conjunction/types').ConjunctionMode) => Promise<{ ok: boolean }>;
      conjunctionDispatch: (prompt: string, mode_override?: import('./hearth/conjunction/types').ConjunctionMode) => Promise<import('./hearth/conjunction/types').ConjunctionResult>;
      conjunctionGetSubstrateContext: () => Promise<{ raw_preamble: string; thread_id: string | null; built_at: string }>;
      // Drekaskip (B83c)
      drekaskipQuery: () => Promise<import('./hearth/drekaskip_status/saga_subscription').SagaState>;
      // Adaptive Concurrency Carrier — Layer 4 hot-tune (BP041)
      concurrencyGetCap?: () => Promise<{ cap: number; probed_at: string | null; override: number | null; is_stale: boolean }>;
      concurrencyProbeNow?: () => Promise<{ cap: number; probed_at: string; tier: string }>;
      concurrencySetOverride?: (n: number | null) => Promise<{ ok: boolean; effective_cap: number | null }>;
      // Watchdog (B83d)
      watchdogStatus: () => Promise<import('./hearth/active_substrate/ActiveSubstratePanel').WatchdogStatusPayload>;
      watchdogHistory: (subject: string, window_hours?: number) => Promise<Array<{ ts: string; level: string; message: string }>>;
      // Webview preload path (B83b)
      getWebviewPreloadPath?: () => string;
      // On-Deck Master-of-Ceremonies (BP037)
      onDeckList?: () => Promise<{
        sequential: OnDeckItem[];
        anytime: OnDeckItem[];
        conditional: OnDeckItem[];
        fired_recent: OnDeckItem[];
        base_dir: string;
        scanned_at: string;
      }>;
    };
  }
}

// On-Deck item type (mirrored from main process; no import)
export interface OnDeckFrontmatter {
  on_deck_id: string;
  target_seat: 'manager' | 'knight' | 'pawn' | 'rook';
  category: 'sequential' | 'anytime' | 'conditional';
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  depends_on: string[];
  conditions: string[];
  estimated_cost?: number;
  estimated_time?: number;
  status: 'DRAFTING' | 'READY' | 'FIRED' | 'RETURNED' | 'COMPLETE' | 'FAILED';
  title?: string;
  created_at?: string;
}

export interface OnDeckItem {
  frontmatter: OnDeckFrontmatter;
  body: string;
  file_path: string;
}
