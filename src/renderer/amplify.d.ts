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

// M21: Automatic update scheduler config
export interface AutoUpdateConfig {
  autoUpdates: boolean;
  installTiming: 'launch' | 'quit' | 'scheduled' | 'approve';
  scheduledTime: string;
  majorVersionRequiresApproval: boolean;
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
  // Phase 3 granular progress fields (SEG-3: fields used in ModelSetupProgress.tsx)
  phase?: string;
  layerIndex?: number;
  layerCount?: number;
  completed?: number;
}

export interface EngineSetupProgress {
  step: string;
  message: string;
  detail?: string;
  percentComplete?: number;
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

// BP078 Scope 6.5 — SKU pull progress
export interface SkuPullProgress {
  downloaded: number;   // bytes downloaded
  total: number;        // total bytes (0 if unknown)
  speed?: string;       // e.g. "12.3 MB/s"
  status?: string;      // raw ollama status line
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
      pullNamedModel: (modelName: string) => Promise<{ success: boolean; alreadyInstalled?: boolean; error?: string }>;
      checkOllamaAndModel: (modelName: string) => Promise<{ reachable: boolean; hasModel: boolean; models: string[] }>;
      setupPrivateAI: () => Promise<{ ok: boolean; error?: string }>;
      markBp067FirstRunComplete: () => Promise<{ ok: boolean }>;
      askFloorModel: (prompt: string) => Promise<{ ok: boolean; text?: string; error?: string }>;
      onEngineSetupProgress: (cb: (progress: EngineSetupProgress) => void) => () => void;
      // Substrate (Phase 3)
      substrateQuery: (query: string, model?: string) => Promise<SubstrateQueryResult>;
      substrateWrite: (text: string, source?: string, keywords?: string[]) => Promise<{ ok: boolean; id?: string }>;
      // Federation (Phase 3)
      getFederationStatus: () => Promise<FederationStatus>;
      setMemberToken: (token: string | null) => Promise<{ ok: boolean }>;
      // Telemetry
      getAMPLIFYSnapshot: () => Promise<AMPLIFYSnapshot>;
      getAMPLIFYSummary: () => Promise<TelemetrySummary>;
      // App Version (MV-VERSION-DISPLAY BP044)
      getAppVersion?: () => Promise<{ version: string; buildHash: string }>;
      // Auto-Update
      getUpdateState: () => Promise<UpdateState>;
      checkForUpdates: () => void;
      installUpdate: () => void;
      downloadUpdate: () => void;  // BP067 Phase 1D — safe tier: user-triggered download
      setAutoInstallOnQuit: (enabled: boolean) => void;  // 1D-FIX: opt-out toggle
      onUpdateStateChanged: (cb: (state: UpdateState) => void) => () => void;
      // M21: Automatic update scheduler (Block 1-6)
      getAutoUpdateConfig: () => Promise<AutoUpdateConfig>;
      setAutoUpdateConfig: (cfg: Partial<AutoUpdateConfig>) => Promise<AutoUpdateConfig>;
      getUpdateHistory: () => Promise<Record<string, unknown>[]>;
      approveAutoUpdateInstall: (readyPath: string) => void;
      onAutoUpdatePatchReady: (cb: (data: { version: string }) => void) => () => void;
      onAutoUpdateMajorAvailable: (cb: (data: { version: string }) => void) => () => void;
      onAutoUpdateApproveRequired: (cb: (data: { version: string; readyPath: string }) => void) => () => void;
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
      // Browser-authority Nexus IPC leg (BP137 Yoke v2b Integration-1, Part 2)
      runBrowserAuthorityQuery?: (
        query: import('../shared/plow/browser_authority_types').BrowserAuthorityQuery,
      ) => Promise<import('../shared/plow/browser_authority_types').BrowserAuthorityRawExtraction | null>;
      // Nexus Authority persistent session (BP137 0.9.12 Stage F1)
      setNexusAuthorityBrowserFlags?: (
        researchArmMode: boolean,
        researchArmBrowserAuthority: boolean,
      ) => Promise<{ ok: boolean; enabled: boolean }>;
      // BP140-K4: widened to the shared BrowserAuthorityName (5 members) instead of a
      // hand-copied 3-member literal union -- see preload.ts's matching comment.
      openNexusAuthoritySignIn?: (
        authority: import('../shared/plow/browser_authority_types').BrowserAuthorityName,
      ) => Promise<{ ok: boolean; reason: string | null }>;
      hideNexusAuthoritySession?: () => Promise<{ ok: boolean }>;
      checkNexusAuthoritySignInStatus?: () => Promise<{
        enabled: boolean;
        statuses: Array<{ authority: import('../shared/plow/browser_authority_types').BrowserAuthorityName; signedIn: boolean; reason: string; checkedAt: string }>;
      }>;
      // BP138 Yoke 0.9.15 FIX 4 -- Ask tab's raw-fact lookup entry point.
      nexusAskLookupFact?: (question: string) => Promise<{
        answerType: 'computable' | 'lookup_fact' | 'reasoning';
        usable: boolean;
        // BP139: additive reason codes ('not_lookup_fact' | 'flag_off' | 'authority_empty') --
        // see preload.ts's nexusAskLookupFact for the full contract. Diagnostic only.
        reason?: 'flag_off' | 'not_lookup_fact' | 'authority_empty';
        fact?: string;
        sourceUrl?: string;
        authority?: 'user_google' | 'user_perplexity';
        confidence?: number;
      }>;
      // BP138 Yoke Phase 1: Answer Coroner IPC
      runAnswerCoroner?: (opts: {
        sessionFilter?: string;
        limit?: number;
      }) => Promise<{
        ok: boolean;
        roundup?: {
          runAt: string;
          totalRecords: number;
          correctableWrongs: number;
          honestAbstains: number;
          wrongTotal: number;
          rightTotal: number;
          abstainTotal: number;
          byClass: Record<string, unknown[]>;
          prioritizedFixList: Array<{ answerClass: string; count: number; exemplars: unknown[] }>;
        };
        error?: string;
      }>;
      onCoronerProgress?: (callback: (msg: string) => void) => (() => void);
      // BP139 Founder Yoke: Answer Coroner over the CURRENT run's own outcomes (no network
      // call). See src/main/plow/answer_coroner.ts's LocalCoronerOutcomeInput.
      runAnswerCoronerOnLocalOutcomes?: (opts: {
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
      }) => Promise<{
        ok: boolean;
        roundup?: {
          runAt: string;
          totalRecords: number;
          correctableWrongs: number;
          honestAbstains: number;
          wrongTotal: number;
          rightTotal: number;
          abstainTotal: number;
          byClass: Record<string, unknown[]>;
          prioritizedFixList: Array<{ answerClass: string; count: number; exemplars: unknown[] }>;
        };
        error?: string;
      }>;
      // On-Deck Master-of-Ceremonies (BP037)
      onDeckList?: () => Promise<{
        sequential: OnDeckItem[];
        anytime: OnDeckItem[];
        conditional: OnDeckItem[];
        fired_recent: OnDeckItem[];
        base_dir: string;
        scanned_at: string;
      }>;
      // SubstratedFolderWatcher™ (SAGA-γ v0.1.10)
      watcher?: {
        addFolder: (folderPath: string) => Promise<any>;
        removeFolder: (folderId: string) => Promise<boolean>;
        listFolders: () => Promise<any[]>;
        getStats: () => Promise<any>;
        openFolderDialog: () => Promise<{ canceled: boolean; filePaths: string[] }>;
        onEbletMinted: (callback: (eblet: any) => void) => void;
        onFolderError: (callback: (payload: { folderId: string; error: string }) => void) => void;
      };
      // BP067 Phase 3B — mnemo://focus/<tab_id> deep-link → per-install focus-tab
      onNavigateFocusTab?: (cb: (tabId: string) => void) => () => void;

      // SAGA 13 BP046B — 5-Marks first-install bonus
      creditFirstInstallMarks?: () => void;
      // SAGA 07 BP046B — Utility methods
      openExternal?: (url: string) => void;
      hideOverlay?: () => void;
      showOverlay?: () => void;
      getTelemetrySummary?: () => Promise<TelemetrySummary>;
      // BP067 Phase 1A — $5 Membership Checkout
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
      // BP065 — LB Account + Frontier Node (Part A/B)
      lbStartAuth?: (email: string) => Promise<{ ok: boolean; error?: string }>;
      lbGetSession?: () => Promise<{ linked: boolean; user_id?: string; email?: string; peer_id?: string; linked_at?: string; crewman_number?: number }>;
      lbLinkDevice?: (access_token: string, refresh_token: string, email: string) => Promise<{ ok: boolean; error?: string }>;
      lbRevokeDevice?: () => Promise<{ ok: boolean; error?: string }>;
      onLbAuthComplete?: (cb: (session: { user_id: string; email: string; peer_id: string; crewman_number?: number }) => void) => () => void;
      lbRegisterFrontierNode?: () => Promise<{ ok: boolean; frontier_node_id?: string; error?: string }>;
      lbWithdrawFrontierNode?: () => Promise<{ ok: boolean; error?: string }>;
      lbGetFrontierStatus?: () => Promise<{ registered: boolean; frontier_node_id?: string; last_heartbeat?: string; withdrawn?: boolean }>;
      lbGetBorrowStatus?: () => Promise<{ borrow_opt_in: boolean; trust_list: string[] }>;
      lbSetBorrowOptIn?: (enabled: boolean) => Promise<{ ok: boolean }>;
      lbRequestFrontierBorrow?: () => Promise<{ ok: boolean; error?: string; cost_transport_usd?: number; cost_compute_usd_approx?: number; node_count?: number; disclosure?: string }>;

      // BP078 Scope 6.5 — SKU upgrade IPC
      sku: {
        checkModel: (modelName: string) => Promise<{ exists: boolean; modelName: string }>;
        upgradeTo: (tier: 'core' | 'lite' | 'full') => Promise<{ ok: boolean; error?: string }>;
        cancelUpgrade: () => Promise<{ ok: boolean }>;
        currentTier: () => Promise<{ tier: 'nano' | 'core' | 'lite' | 'full' }>;
        onboardingCheck: () => Promise<{ skuExists: boolean }>;
        onPullProgress: (cb: (data: SkuPullProgress) => void) => () => void;
        onPullComplete: (cb: () => void) => () => void;
        onPullError: (cb: (err: string) => void) => () => void;
      };
      // BP078 — Black Crow Feather earn IPC
      earnBlackCrowFeather?: (payload: { userId: string; reason: string; metadata?: Record<string, unknown> }) => Promise<{ ok: boolean; featherId?: string; alreadyIssued?: boolean; error?: string }>;
      // SEG-Q-3 BP078 — DevTools toggle (For Techies fallback path)
      toggleDevTools?: () => void;
      // SEG-Q-13 BP078 — Run Diagnostic
      runDiagnostic?: () => Promise<{ ok: boolean; logPath: string; content: string }>;
      // SEG-R-13 — Open folder containing a diagnostic log file
      openDiagFolder?: (folderPath: string) => Promise<void>;
      // SEG-U-7 BP078 — mesh-test-complete push event
      onMeshTestComplete?: (cb: (metrics: {
        hot_accuracy_pct: number;
        cold_accuracy_pct: number;
        delta_pp: number;
        fast_cheap_good: string;
        svgPath?: string;
      }) => void) => () => void;
      // SEG-V0149-P0-INSTALL-FLOW — Lean install IPC
      leanInstallStart?: () => Promise<{ ok: boolean; waitingForInstall?: boolean; error?: string }>;
      onLeanInstallStatus?: (cb: (data: { step: string; message: string }) => void) => () => void;
      onLeanInstallProgress?: (cb: (data: {
        bytesDownloaded: number; totalBytes: number; percentComplete: number;
        speedLabel: string; eta_s: number;
      }) => void) => () => void;
      onLeanInstallError?: (cb: (data: { message: string; retryable: boolean }) => void) => () => void;
      // SEG-V0150-P0-FIX-BRIDGE-OR-FALLBACK: skip-path
      writeSkuTierSkip?: () => Promise<{ ok: boolean; error?: string }>;
      // SEG-V0151-P0-AUTOMATIC-BACKGROUND: lean background status events
      onLeanBgStatus?: (cb: (payload: { type: string; msg: string; pct?: number }) => void) => () => void;
      // MV-CN Peer Mesh (SAGA 3 BP045 W1) — mesh state
      getMeshState?: () => Promise<{ peers: Array<{ peerId: string; displayName?: string }>; relayConnected: boolean; ownPeerId: string }>;
      getOwnPeerId?: () => Promise<string>;
      getMachineLabel?: () => Promise<string>;
      setMachineLabel?: (label: string) => Promise<string>;
      getBootZombieCount?: () => Promise<{ count: number }>;
      callTestMyBox?: (peerId?: string) => Promise<{
        ok: boolean;
        answer?: string;
        correct_answer?: string;
        wall_clock_s?: number;
        processing_ms?: number;
        error?: string;
      }>;
      onBootZombieFlush?: (cb: (data: { count: number }) => void) => () => void;
      onMeshStateChanged?: (cb: (state: unknown) => void) => () => void;
      onRelayStateChanged?: (cb: (state: { relayConnected: boolean }) => void) => () => void;
      onWanStatusUpdate?: (cb: (payload: { status: string; ts: string }) => void) => () => void;
      // MESH-6: Federation invite/accept/leave
      federationGenerateInvite?: () => Promise<{ token: string; expiresAt: string }>;
      federationAcceptInvite?: (token: string) => Promise<{ success: boolean; peerName?: string; error?: string }>;
      federationLeavePeer?: (peerId: string) => Promise<{ ok: boolean }>;
      // BP139 Yoke 0.9.15 -- MIC (Machine In Charge) saved-peer removal, confirmed against
      // src/main/preload.ts (~L1825, mic:remove-peer IPC). Used by LeanGauntletTab.tsx's
      // "x Forget" control on the Connect to Other Machines peer list.
      micRemovePeer?: (peerId: string) => Promise<{ ok: boolean }>;
      // BP134 Yoke #30 Task B — zero-config WAN auto-connect from peer_presence
      federationAutoConnectPresence?: () => Promise<{ attempted: number; connected: string[]; error?: string }>;
      // SEG-3 v0.1.55 — COMMUNITY-CONNECT first-launch seed peer handshake
      communityConnectHandshake?: () => Promise<{ success: boolean; peerName?: string; error?: string }>;
      // SEG-2 v0.1.56 — first-launch progressive auto-pull (gemma4:12b)
      firstLaunchModelPull: {
        check: (modelName: string) => Promise<{ exists: boolean; modelName: string }>;
        start: (modelName: string) => Promise<{ ok: boolean; alreadyInstalled?: boolean; cancelled?: boolean; error?: string }>;
        cancel: () => Promise<{ ok: boolean }>;
        onProgress: (cb: (data: { percent: number; downloaded: number; total: number; status: string }) => void) => () => void;
        onComplete: (cb: () => void) => () => void;
        onError: (cb: (err: string) => void) => () => void;
      };
      // SEG-1 v0.1.57 / v0.1.57.1 (BP081): AI Dispatch IPC — substrate HOT retrieve + Ollama streaming
      aiDispatch?: {
        query: (args: {
          court_member: string;
          messages: Array<{ role: string; content: string }>;
          model_override?: string;
        }) => Promise<{ ok: boolean; text?: string; error?: string; model_used?: string; streaming?: boolean }>;
        // v0.1.57.1: token streaming push events
        onAskTokenProgress: (handler: (data: { delta: string; assembled: string; coldStart?: boolean }) => void) => () => void;
        // BP136 Yoke (answer-cache v1): servedFromSubstrate/cost_usd/latency_ms/provenance/
        // verified are additive/optional -- only present on a served-from-substrate hit.
        onAskTokenComplete: (handler: (data: {
          content: string;
          error?: string;
          hotHits?: number;
          servedFromSubstrate?: boolean;
          cost_usd?: number;
          latency_ms?: number;
          provenance?: string;
          verified?: boolean;
        }) => void) => () => void;
        // BP132 Yoke #21 C7: user-facing Anthropic API key (never exposes the raw key back out)
        getAnthropicKeyStatus?: () => Promise<{ ok: boolean; hasKey: boolean }>;
        setAnthropicKey?: (rawKey: string) => Promise<{ ok: boolean; error?: string }>;
        clearAnthropicKey?: () => Promise<{ ok: boolean }>;
        // BP136 Yoke: answer-cache mode flag persistence (DEFAULT OFF -- undefined === off)
        getSettings?: () => Promise<{ ok: boolean; settings?: { answer_cache_mode?: boolean; [k: string]: unknown }; error?: string }>;
        saveSettings?: (settings: { answer_cache_mode?: boolean; [k: string]: unknown }) => Promise<{ ok: boolean; error?: string }>;
        // BP136 Yoke: real, restart-surviving meter for the Prove It panel
        getAnswerCacheMeterSummary?: () => Promise<{
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
        }>;
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
      // Phoebe™ — Idea Storage IPC (BP054/BP055)
      saveIdea?: (idea: { title: string; content: string; timestamp: string }) => Promise<{ ok: boolean; id: string }>;
      getIdeas?: () => Promise<{ ok: boolean; ideas: Array<{ id: string; title: string; content: string; timestamp: string }> }>;

      // UI zoom control
      setZoomFactor?: (factor: number) => void;

      // Auto-Prepare FULL upgrade (SettingsTab)
      getAutoPrepare?: () => Promise<{ enabled: boolean; modelReady: boolean; pulling: boolean }>;
      onAutoPrepareReady?: (cb: () => void) => () => void;
      setAutoPrepare?: (enabled: boolean) => void;

      // Active Substrate — Scribe monitoring IPC (ActiveSubstratePanel)
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
      scribeToggleMonitor?: (scribeId: string, on: boolean) => Promise<void>;

      // Pantheon substrate mining IPC (MakeYourselfComfortableWizard)
      pantheonGetPrefs: (memberId: string) => Promise<{
        member_id: string;
        updated_at: string;
        folders: Array<{
          folder_path: string;
          pixelated: boolean;
          federation_shared: boolean;
          subfolder_overrides: Array<{ folder_path: string; pixelated: boolean; federation_shared: boolean }>;
          added_at: string;
          last_mined_at?: string;
          tablet_counts?: { iron: number; stone: number };
        }>;
      }>;
      pantheonCountTablets: (memberId: string) => Promise<{ iron: number; stone: number; total: number }>;
      onPantheonProgress: (cb: (evt: {
        session_id: string;
        persona: string;
        persona_label: string;
        persona_icon: string;
        phase: 'scanning' | 'generating' | 'done' | 'error';
        message: string;
        tablets_written?: number;
        total_so_far?: number;
      }) => void) => () => void;
      pantheonPickFolder: () => Promise<string | null>;
      pantheonSetPref: (memberId: string, folderPath: string, pixelated: boolean, federationShared: boolean) => Promise<void>;
      pantheonRemovePref: (memberId: string, folderPath: string) => Promise<void>;
      pantheonDispatch: (memberId: string, folderPath: string, scope: string) => Promise<unknown>;
      pantheonWipe: (memberId: string) => Promise<{ wiped: number }>;

      // Kitchen Table — Recipes IPC (RecipesView)
      kitchenTable?: {
        listRecipes: () => Promise<unknown>;
        createRecipe: (recipe: unknown) => Promise<unknown>;
        deleteRecipe: (id: string) => Promise<void>;
        openPhotoDialog: () => Promise<string | null>;
      };

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

      // BP085 — open-checkout direct URL + activation listener
      openMembershipCheckout?: () => Promise<{ ok: boolean; error?: string }>;
      checkLocalMembershipStatus?: () => Promise<{ ok: boolean; is_member: boolean; member_id: string | null }>;
      onMembershipActivated?: (cb: (result: { ok: boolean; member_id?: string; error?: string }) => void) => () => void;

      // BP082 v0.3.1 — 3-Condition Mesh Comparison
      runMeshComparison?: (config: { nPerDomain: number; randomSeed: number; model: string; ollamaBaseUrl: string }) => Promise<{ ok: boolean; result?: unknown; error?: string }>;
      cancelMeshComparison?: () => Promise<{ ok: boolean }>;
      onMeshComparisonProgress?: (callback: (event: Record<string, unknown>) => void) => () => void;

      // BP060 Application 002 Step 1 — Caithedral Tools
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

      // BP094 v0.8.0 -- CSIA-Hybrid Inference Pipeline
      csia?: {
        query: (question: string) => Promise<{
          verdict: 'ANSWER' | 'REFUSAL';
          answer?: string;
          refusal_reason?: string;
          provenance: Array<{
            evidence_id: string;
            category_slug: string;
            content_preview: string;
            contributor_member_id: string;
            soccerball_hash?: string;
          }>;
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
    };
    // SEG-V0150-P0-DIAGNOSE-BRIDGE: sentinel -- set by preload before main bridge wires up
    __preloadLoaded?: boolean;
    // BP087 Brain Swap -- brain registry hot-swap
    brainRegistry?: {
      list: () => Promise<{ ok: boolean; brains?: unknown[]; active_brain_id?: string; error?: string }>;
      getActive: () => Promise<{ ok: boolean; brain_id?: string; error?: string }>;
      setActive: (brain_id: string) => Promise<{ ok: boolean; error?: string }>;
      smokeTest: (brain_id: string) => Promise<{ ok: boolean; content?: string; brain_id?: string; kind?: string; latency_ms?: number; error?: string }>;
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
