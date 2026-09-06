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

// D-BP157-033: mesh auto-spawn tool-execution consent (mirrors src/main/federation/
// mesh_auto_spawn_consent.ts's own interface -- kept as a separate renderer-side declaration,
// not an import, matching how AutoUpdateConfig above is declared rather than imported).
export interface MeshAutoSpawnConsentSettings {
  consentGranted: boolean;
}

// D-BP202-M0-01-h2cbp8us-001: THE THIRD CONSENT -- remote administration of the whole machine
// (mirrors src/main/federation/mesh_remote_admin_consent.ts's own interface -- kept as a separate
// renderer-side declaration, not an import, matching AutoUpdateConfig/MeshAutoSpawnConsentSettings
// above). Deliberately a DISTINCT type from MeshAutoSpawnConsentSettings despite the identical
// shape: they are three different decisions and a shared type would invite one call site to be
// passed the wrong one.
export interface MeshRemoteAdminConsentSettings {
  consentGranted: boolean;
}

// D-BP202-BM02-014: HardWire Map spine -- mirrors src/main/installer/hardwire_manifest.ts and
// hardwire_preselection.ts's own interfaces, kept as separate renderer-side declarations rather
// than imports (matching every mirrored type above in this file). No UI consumes these yet -- a
// sibling dispatch owns the preinstall screen these exist to serve.
export type HardwarePackageCategory = 'runtime' | 'language' | 'model';
export type HardwarePackageSourceKind = 'ollama-registry' | 'publisher-site' | 'lb-repository';

export interface HardwirePackageSource {
  kind: HardwarePackageSourceKind;
  pinned: boolean;
  pinnedReason?: string;
  registryModel?: string;
  homepageUrl: string;
  versionResolutionUrl?: string;
}

export interface HardwirePackageSizeFigure {
  valueGb: number;
  verified: boolean;
  sourceNote: string;
}

export interface HardwirePackageRequirements {
  minVramGb?: number | null;
  minRamGb?: number;
  minDiskGb?: number;
  dependsOn?: string[];
}

export interface HardwirePackageRationale {
  recommended: string;
  notRecommended: string;
}

export interface HardwirePackageLicense {
  name: string;
  url: string;
  mustAcceptBeforeDownload: boolean;
}

export interface HardwirePackageFaqEntry {
  question: string;
  answer: string;
}

export interface HardwirePackageManifestEntry {
  id: string;
  displayName: string;
  category: HardwarePackageCategory;
  version: string;
  source: HardwirePackageSource;
  downloadSize: HardwirePackageSizeFigure;
  installedSize: HardwirePackageSizeFigure;
  requirements: HardwirePackageRequirements;
  rationale: HardwirePackageRationale;
  license: HardwirePackageLicense;
  faq?: HardwirePackageFaqEntry[];
}

export type HardwireDetectedPlatform = 'win32' | 'darwin' | 'linux' | 'unknown';

export interface HardwireMachineProfile {
  ramGb: number;
  vramGb: number | null;
  os: HardwireDetectedPlatform;
  gpuName?: string | null;
  diskFreeGb?: number | null;
  alreadyInstalled?: string[];
}

export type HardwirePreselectionDecisionKind = 'recommended' | 'not-recommended' | 'required' | 'incompatible';

export interface HardwirePackagePreselectionDecision {
  packageId: string;
  decision: HardwirePreselectionDecisionKind;
  checked: boolean;
  reason: string;
  alternativePackageId?: string | null;
}

// D-BP164-M0-002/BISHOP/SEG-DA: open-at-login toggle (Founder BP163: "And can we build that
// start on startup into Mnemosynec so it always does that"). Mirrors
// src/main/startup/open_at_login_settings.ts's own interfaces -- kept as a separate
// renderer-side declaration, not an import, matching AutoUpdateConfig/MeshAutoSpawnConsentSettings
// above.
export interface OpenAtLoginSettings {
  openAtLogin: boolean;
}

export interface OpenAtLoginOSState {
  openAtLogin: boolean;
  executableWillLaunchAtLogin: boolean;
}

export interface LegacyAutostartTaskStatus {
  present: boolean;
  taskName: string;
  state?: string;
  queryError?: string;
}

export interface OpenAtLoginGetStateResult {
  ok: boolean;
  preference: OpenAtLoginSettings;
  osState: OpenAtLoginOSState;
  legacyTask: LegacyAutostartTaskStatus;
  legacyTaskRemovalCommand: string;
  error?: string;
}

export interface OpenAtLoginApplyResult {
  ok: boolean;
  reason?: 'legacy-task-present' | 'legacy-task-query-inconclusive';
  preference: OpenAtLoginSettings;
  osState: OpenAtLoginOSState;
  legacyTask: LegacyAutostartTaskStatus;
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
// D-BP155-025: 'unknown' added — an LB account is linked but membership couldn't be
// determined yet (no cached result, live lookup hasn't succeeded). Mirrors
// src/main/auth_manager.ts's AuthStatus exactly; see that file's header.
export type AuthStatus =
  | 'unauthenticated'
  | 'trial_active'
  | 'trial_expired'
  | 'member'
  | 'validating'
  | 'unknown';

export interface MemberInfo {
  user_id: string;
  display_name: string;
  email: string;
  is_member: boolean;
  membership_expires?: string;
  badge_tier?: 'stamped' | 'ghost';
  avatar_url?: string;
  member_number?: number;
  tags?: string[];
}

export interface AuthState {
  status: AuthStatus;
  member?: MemberInfo;
  trial_started_ts?: number;
  trial_days_remaining?: number;
  token_expires?: number;
  degraded: boolean;
  membershipSource?: 'live' | 'cached' | 'unreachable' | 'unchecked';
  membershipCheckedAt?: number;
}

// ── The Crystal -- durable chonk-handle store (KN-BP147-M2, D-BP147-005) ──────────────────
// Mirrors src/main/preload.ts's matching CrystalBindingTarget/CrystalMutationReason/
// CrystalBindResult/CrystalResolvedChonk types exactly (which themselves mirror
// src/main/crystal/crystal_types.ts, KN-BP147-M1, commit ccae7f1c).
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
      // D-BP164-M0-002/BISHOP/SEG-DA: open-at-login toggle -- see OpenAtLoginSettings etc. above
      getOpenAtLoginState: () => Promise<OpenAtLoginGetStateResult>;
      setOpenAtLoginState: (desired: boolean) => Promise<OpenAtLoginApplyResult>;
      approveAutoUpdateInstall: (readyPath: string) => void;
      onAutoUpdatePatchReady: (cb: (data: { version: string }) => void) => () => void;
      onAutoUpdateMajorAvailable: (cb: (data: { version: string }) => void) => () => void;
      onAutoUpdateApproveRequired: (cb: (data: { version: string; readyPath: string }) => void) => () => void;
      // D-BP157-030: the missing major-version review/approve action (closes the gap flagged in
      // SEG_RETURN_BP157_027_MESH_UPDATE_CONSENT.md Part 1 -- onAutoUpdateMajorAvailable above
      // had no renderer consumer and no main-process action for its own event).
      approveMajorUpdate?: (version: string) => Promise<{ ok: boolean; error?: string }>;
      declineMajorUpdate?: (version: string) => Promise<{ ok: boolean }>;
      // Mesh Trust / Peer Verification (D-BP148-038 Authorizations panel)
      getMeshTrustSettings?: () => Promise<{ allowUnauthenticatedLanDiscovery: boolean }>;
      setMeshTrustAllowUnauthenticatedLanDiscovery?: (allow: boolean) => Promise<{ allowUnauthenticatedLanDiscovery: boolean }>;
      // D-BP157-033: mesh auto-spawn tool-execution consent -- a SEPARATE toggle from Mesh Trust
      // above and from AutoUpdateConfig.autoUpdates; see mesh_auto_spawn_consent.ts's own header.
      getMeshAutoSpawnConsentSettings?: () => Promise<MeshAutoSpawnConsentSettings>;
      setMeshAutoSpawnConsentGranted?: (granted: boolean) => Promise<MeshAutoSpawnConsentSettings>;
      // D-BP202-M0-01-h2cbp8us-001: THE THIRD CONSENT -- remote administration of this machine
      // (the `lbmesh` account plus WinRM), separate from both toggles above.
      getMeshRemoteAdminConsentSettings?: () => Promise<MeshRemoteAdminConsentSettings>;
      setRemoteAdministrationConsentGranted?: (granted: boolean) => Promise<MeshRemoteAdminConsentSettings>;
      // D-BP202-BM02-014: HardWire Map spine -- read-only manifest + preselection surface. No UI
      // consumes these yet; a sibling dispatch owns the preinstall screen.
      getHardwireManifest?: () => Promise<HardwirePackageManifestEntry[]>;
      getHardwireMachineProfile?: () => Promise<HardwireMachineProfile>;
      getHardwirePreselection?: () => Promise<{
        schemaVersion: string;
        profile: HardwireMachineProfile;
        decisions: HardwirePackagePreselectionDecision[];
      }>;
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
      // Grand Central board panel (KN-BP144-10)
      boardGetState: () => Promise<import('../main/board/board_state_reader').BoardSnapshot | null>;
      boardMarkDispatched: (
        id: string,
      ) => Promise<{ ok: boolean; dispatchedAt?: string; snapshot?: import('../main/board/board_state_reader').BoardSnapshot | null; error?: string }>;
      // Grand Central "Verify" button (BP148 D-BP148-028), read-only
      boardVerifyOrphan?: (
        id: string,
      ) => Promise<import('../main/board/board_verify').VerifyOrphanResult>;
      // Grand Central alarm actions (BP148 D-BP148-031): dismiss/acknowledge (persisted,
      // recoverable, any alarm kind) + the three real UNOWNED actions (commit/park/discard).
      boardAlarmDismiss?: (
        key: string,
        kind: import('../shared/board/alarm_key').AlarmKind,
        message: string,
        note?: string | null,
      ) => Promise<import('../shared/board/alarm_key').AlarmDismissal | { error: string }>;
      boardAlarmRestore?: (
        key: string,
      ) => Promise<import('../shared/board/alarm_key').AlarmDismissal | { error: string }>;
      boardAlarmListDismissals?: () => Promise<import('../shared/board/alarm_key').AlarmDismissal[]>;
      boardUnownedCommit?: (
        files: string[],
        message: string,
      ) => Promise<import('../main/board/board_alarm_actions').CommitUnownedResult>;
      boardUnownedPark?: (
        files: string[],
        branchName: string,
        message?: string,
      ) => Promise<import('../main/board/board_alarm_actions').ParkUnownedResult>;
      boardUnownedDiscard?: (
        files: string[],
        confirm: boolean,
      ) => Promise<import('../main/board/board_alarm_actions').DiscardUnownedResult>;
      // Webview preload path (B83b)
      getWebviewPreloadPath?: () => string;
      // Browser-authority Nexus IPC leg (BP137 Yoke v2b Integration-1, Part 2)
      runBrowserAuthorityQuery?: (
        query: import('../shared/plow/browser_authority_types').BrowserAuthorityQuery,
      ) => Promise<import('../shared/plow/browser_authority_types').BrowserAuthorityRawExtraction | null>;
      // D-BP149-034/BISHOP/S34/seg-lianaterminal -- the Liana Cycle terminal.
      lianaTerminalRun?: (
        input: string,
        /** D-BP150-001 (Call an Audible), ADDITIVE/OPTIONAL. Omitted or false = the run this
         *  function has always produced, byte for byte. */
        audible?: boolean,
        /** D-BP151-023 (Stepped Audible), ADDITIVE/OPTIONAL, independent of `audible`. Omitted or
         *  false = no per-step pausing. */
        steppedAudible?: boolean,
        /** D-BP152-039 REMOVAL, ATTRIBUTED (FD-BP152-20/FD-BP152-09). ACCEPTED-AND-IGNORED -- the
         *  gate this used to feed no longer exists; Survey now runs unconditionally on every
         *  call. Kept in the declared shape only to stay in lockstep with preload.ts/index.ts. */
        contingencyOperatorSurvey?: boolean,
        /** D-BP151-032 (Ambiguity Query Transport), THREADED BY D-BP152-011. Only consulted when
         *  contingencyOperatorSurvey is on. Omitted = the resolver's own default (env var or
         *  'google') -- never pass an explicit 'google' to represent "untouched", it would
         *  short-circuit the env override. */
        ambiguityQueryTransport?: 'google' | 'gemma',
      ) => Promise<import('../shared/liana_cycle/liana_terminal_types').LianaTerminalOutcome>;
      // D-BP152-039 REMOVAL -- `lianaTerminalGateEnvState` used to be declared here (effective
      // env-var state for a Survey Splice toggle that D-BP152-012 already removed, and whose
      // underlying gate FD-BP152-20 now removes too). Zero renderer callers confirmed by grep.
      onLianaTerminalEvent?: (
        cb: (evt: import('../shared/liana_cycle/liana_terminal_types').LianaTerminalEvent) => void,
      ) => () => void;
      // D-BP152-043/BISHOP/seg-scratch-composer -- THE SCRATCH COMPOSER. Founder, BP152, verbatim
      // (FD-BP152-20): "I want to use it to stack methods in whatever order I want... mix and
      // match as I please." lianaScriptListRegistry lists whatever library/method_registry.ts
      // holds right now; lianaScriptRun's `steps` undefined/empty is THE DEFAULT (byte-identical
      // to lianaTerminalRun -- see script_bridge.ts's own header).
      lianaScriptListRegistry?: () => Promise<import('../main/liana_cycle/library/script_bridge').ComposerRegistryEntry[]>;
      lianaScriptRun?: (
        input: string,
        steps?: string[],
      ) => Promise<import('../main/liana_cycle/library/script_bridge').ScriptRunResponse>;
      // D-BP154-010/BISHOP/S10/seg-thepail -- THE PAIL, lock condition 4: the evidence store
      // already on disk must be VISIBLE. Strictly read-only, see evidence_store.ts's own header.
      lianaEvidenceStoreSummary?: () => Promise<import('../main/liana_cycle/evidence/evidence_store').EvidenceStoreSummary>;
      // D-BP154-025/BISHOP-SEG/S25/seg-handproof -- TWO READ-ONLY REFERENCE PANELS. Founder,
      // verbatim: "Give me my hand-written proof, in the composer, as well as the THREE QUESTIONS
      // that we know get the right answer." Strictly read-only, see
      // composer_reference_panels.ts's own header for the "verbatim from disk" discipline.
      lianaComposerFounderProof?: () => Promise<{
        bp153: import('../main/liana_cycle/library/composer_reference_panels').FounderProofSlice;
        founderCascade: import('../main/liana_cycle/library/composer_reference_panels').FounderProofSlice;
      }>;
      lianaComposerFounderCascadeWhole?: () => Promise<import('../main/liana_cycle/library/composer_reference_panels').FounderProofSlice>;
      lianaComposerKnownGoodQueries?: () => Promise<import('../main/liana_cycle/library/composer_reference_panels').KnownGoodQuery[]>;
      // D-BP150-001/BISHOP/S01/seg-audible -- CALL AN AUDIBLE. The engine stops before every
      // Google query and again on what comes back, and waits -- with no timer -- until the
      // operator answers. onLianaAudiblePause is the push; lianaAudibleRespond is the only way a
      // pause ends from the renderer side. Distinct from the Teach box and from Audit the Run:
      // those record what already happened, this changes what happens next.
      onLianaAudiblePause?: (
        cb: (pause: import('../shared/liana_cycle/liana_terminal_types').LianaAudiblePause) => void,
      ) => () => void;
      lianaAudibleRespond?: (
        response: import('../shared/liana_cycle/liana_terminal_types').LianaAudibleResponse,
      ) => Promise<{ ok: boolean; reason?: string }>;
      // D-BP151-023/BISHOP/seg-stepped-audible -- STEPPED AUDIBLE. One pause per Founder-mapped
      // step (see stepped_audible.ts) rather than one pause per Google call -- a separate control
      // from Call an Audible above, not a replacement for it.
      onLianaSteppedPause?: (
        cb: (pause: import('../shared/liana_cycle/liana_terminal_types').LianaSteppedPause) => void,
      ) => () => void;
      lianaSteppedRespond?: (
        response: import('../shared/liana_cycle/liana_terminal_types').LianaSteppedResponse,
      ) => Promise<{ ok: boolean; reason?: string }>;
      // D-BP150-002 -- his earlier teaching notes, read back into a live pause. Read-only.
      lianaNotesList?: (
        label?: string,
      ) => Promise<{
        ok: boolean;
        files: import('../shared/liana_cycle/liana_terminal_types').LianaTeachingFile[];
        error?: string;
      }>;
      // D-BP149-043/BISHOP/S43/seg-method2build -- THE TEACH BOX. Writes the operator's own
      // words, VERBATIM, to a teaching file (BISHOP_DROPZONE) for a human to read and implement
      // from -- never auto-generates a method.
      lianaTeachSubmit?: (args: {
        teachingText: string;
        question: string;
        options: Record<string, string> | null;
        qid?: number;
        shapeTestSummary: string;
        // D-BP149-044/BISHOP/S44/seg-steppedmode -- ADDITIVE. Present only for a stepped-walk
        // submission (LianaCycleTab.tsx's stepped-walk panel); see index.ts's
        // 'liana-teach-submit' handler for the full contract. A response never changes how the
        // run executed -- it is recorded verbatim for a human to read later (HARDWIRE-22).
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
      }) => Promise<{ ok: boolean; filePath?: string; bytes?: number; error?: string }>;
      // D-BP152-022/BISHOP/seg-laboratory-and-keep -- THE LABORATORY (FD-BP152-10 tier 1) AND
      // KEEP (FD-BP152-07). A channel separate from lianaSteppedRespond -- saving is never a
      // stepped-pause action.
      lianaLaboratorySave?: (args: {
        name: string;
        queryTextVerbatim: string;
        provenance: { runInput: string };
      }) => Promise<{ ok: boolean; path?: string; version?: string; supersededPath?: string | null; error?: string }>;
      lianaLaboratoryList?: () => Promise<{
        ok: boolean;
        steps: import('../shared/liana_cycle/liana_terminal_types').LianaLaboratoryStepSummary[];
        error?: string;
      }>;
      // D-BP167-M0-049/BISHOP/seg-composer-persistence -- THE COMPOSER, PERSISTED. A channel
      // separate from lianaScriptRun -- saving/listing a stack never runs it and never promotes
      // it into method_registry.ts.
      lianaComposerSaveStack?: (args: {
        name: string;
        steps: string[];
        provenance: { runInput: string };
      }) => Promise<{ ok: boolean; path?: string; version?: string; supersededPath?: string | null; error?: string }>;
      lianaComposerListStacks?: () => Promise<{
        ok: boolean;
        stacks: import('../shared/liana_cycle/liana_terminal_types').LianaComposerStackSummary[];
        error?: string;
      }>;
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
      // D-BP154-074/BISHOP-SEG/S74/seg-ambient — mirrors preload.ts's own declaration.
      onAmbientCapturePulse?: (cb: (payload: { surface: string; url: string; query: string; ts: string }) => void) => () => void;
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
        // KN-BP144-8 Phase 1: the free-text question path that calls canonical_pipeline.ts's
        // engine (substrate-first ROOTED check, then specialist swarm + Three Fates
        // arbitration) -- a SEPARATE channel from `query` above, which remains the plain-
        // Ollama-chat path untouched.
        queryEngine: (args: { question: string }) => Promise<{ ok: boolean; streaming?: boolean; error?: string }>;
        // KN-BP144-8 Phase 1: one push event per CanonicalPlowProgressEvent the engine emits.
        onAskEngineProgress: (handler: (data: {
          type: string;
          specialistName?: string;
          specialistCandidates?: number;
          minerPassed?: number;
          furnacePassed?: number;
          substrateTier?: string | null;
          substrateProvenance?: string;
          andonRetry?: number;
        }) => void) => () => void;
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
          // KN-BP144-8 Phase 1, ADDITIVE: only present on a query-engine completion.
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

      // KN-BP147-M4: UNBARREL THE BARRELS -- mirrors the runtime method src/main/preload.ts now
      // exposes (wraps the new 'usage-barrel-get-vendor-usage' ipcMain.handle() registered in
      // index.ts's IPC-HANDLER append zone, which calls the real
      // computeUsageBarrelOperationalSnapshot()/scrapeVendorUsagePanel() in
      // src/main/hearth/usage_barrel_scraper.ts). Shape matches
      // TwoBarrelMeter.tsx's own VendorUsageBarrelData exactly.
      getVendorUsageBarrelSnapshot?: () => Promise<{
        status: 'unknown' | 'ok' | 'error';
        fiveHour: { label: string; percentConsumed: number; resetText: string } | null;
        weeklyAllModels: { label: string; percentConsumed: number; resetText: string } | null;
        weeklyModelSpecific: { label: string; percentConsumed: number; resetText: string } | null;
        usageCredits: { usedUsd: number; limitUsd: number } | null;
        operationalAnswer: string | null;
        lastCheckedAt: string | null;
        failureReason: string | null;
      }>;

      // ── The Crystal -- durable chonk-handle store (KN-BP147-M2, D-BP147-005) ─────────────
      // Wraps index.ts's crystal:* IPC channels (registerIPCHandlers()'s IPC-HANDLER append
      // zone). FAIL OPEN: every method can legitimately resolve { ok:false, error } when the
      // Crystal failed to load at startup -- not a bug, the ticket-mandated contract. Callers
      // must handle ok:false gracefully.
      crystal: {
        mint: (pearls: string[]) => Promise<{ ok: boolean; sid?: string; error?: string }>;
        bind: (sid: string, key: string, target: CrystalBindingTarget) => Promise<CrystalBindResult>;
        mutate: (
          sid: string,
          key: string,
          target: CrystalBindingTarget,
          reason: CrystalMutationReason,
          note: string,
        ) => Promise<CrystalBindResult>;
        resolve: (sid: string) => Promise<{ ok: boolean; resolved: CrystalResolvedChonk | null; error?: string }>;
        stats: () => Promise<{
          ok: boolean;
          stats?: { mintedCount: number; logPath: string; logExists: boolean };
          error?: string;
        }>;
      };
    // --- D-BP168-M0-120 sync: properties present in src/main/preload.ts's
    // authoritative Window.amplify declaration but missing here, added verbatim
    // from preload.ts (single-cluster typecheck fix, see BISHOP_DROPZONE return).
      checkOllama: () => Promise<{ installed: boolean; version?: string }>;
      onUpdateStateChanged: (cb: (state: UpdateState) => void) => () => void;
      getRelayTier: () => Promise<{ tier: string }>;
      federationRejectInvite?: (data: { invite_token: string; source: string }) => Promise<{ ok: boolean; error?: string }>;
      federationFetchSid?: (dag_id: string, peerId: string) => Promise<{ ok: boolean; node?: unknown; hash_verified: boolean; error?: string }>;
      federationConnectPeer?: (peerId: string, relayUrl?: string) => Promise<{ success: boolean; error?: string }>;
      sendSilentEmail?: (args?: unknown) => Promise<{ success: boolean; reason: string }>;
      substrateAwakensRegister?: (email: string, displayName: string, ramTier: string) => Promise<{ success: boolean; message?: string; error?: string }>;
      substrateAwakensHandshake?: (token: string, email: string, displayName: string) => Promise<{ success: boolean; peerId?: string; displayName?: string; error?: string }>;
      substrateAwakensGetState?: () => Promise<{ joined: boolean; peerId?: string; displayName?: string; joinedAt?: string } | null>;
      showHearthConjunction?: () => Promise<{ ok: boolean }>;
      runBrowserAuthorityQueryObserved?: (
        query: import('../shared/plow/browser_authority_types').BrowserAuthorityQuery,
      ) => Promise<{
        raw: import('../shared/plow/browser_authority_types').BrowserAuthorityRawExtraction | null;
        dispatchOutcome?: string;
        challengeDetected?: boolean;
      }>;
      nexusAuthorityCapture?: () => Promise<{ ok: boolean; reason?: string }>;
      nexusAuthorityBookmarksList?: () => Promise<{
        ok: boolean;
        bookmarks: Array<{ id: string; url: string; title: string; addedAt: string }>;
        error?: string;
      }>;
      nexusAuthorityBookmarksAdd?: (url: string, title: string) => Promise<{
        ok: boolean;
        bookmarks: Array<{ id: string; url: string; title: string; addedAt: string }>;
        error?: string;
      }>;
      nexusAuthorityBookmarksRemove?: (id: string) => Promise<{
        ok: boolean;
        bookmarks: Array<{ id: string; url: string; title: string; addedAt: string }>;
        error?: string;
      }>;
      pantheonListTablets: (memberId: string, grade?: string, persona?: string) => Promise<unknown[]>;
      pantheonActiveSessions: () => Promise<unknown[]>;
      agentProbe: (agentId: string, opts?: { force?: boolean; modelId?: string }) => Promise<{ agentId: string; status: string; reason?: string; probed_at?: string }>;
      agentSetApiKey: (agentId: string, keyValue: string) => Promise<{ ok: boolean; error?: string }>;
      agentGetApiKeyStatus: () => Promise<Record<string, boolean>>;
      agentGetTierChoices: () => Promise<Record<string, string>>;
      agentSetTierChoice: (agentId: string, tierId: string) => Promise<{ ok: boolean }>;
      agentGetPlugins: () => Promise<Array<{ id: string; displayName: string; subtitle: string; icon: string; tiers?: Array<{ id: string; label: string; tierClass: string; modelId: string }>; requiresKey?: string; source: string }>>;
      agentGetPluginRegistry: () => Promise<Array<{ id: string; filename: string; displayName: string; ipLedgerRef?: string; authorHandle?: string; loadedAt: string }>>;
      trailEblet?: {
        list: () => Promise<{ files: string[]; dir: string }>;
        read: (args: { filePath: string }) => Promise<{ ok: boolean; content?: string; error?: string }>;
        listScreenshots: (args: { ebletPath: string }) => Promise<{ files: string[]; dir: string }>;
        readScreenshot: (args: { filePath: string }) => Promise<{ ok: boolean; dataUrl?: string; error?: string }>;
      };
      onFederationDeepLinkAccept?: (cb: (data: { token: string; slug: string }) => void) => () => void;
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
      writeChronosConsent?: (consentPayload: object) => Promise<{ ok: boolean; ebletPath?: string }>;
      revokeChronosConsent?: (payload?: object) => Promise<{ ok: boolean; ebletPath?: string }>;
      decodePearl?: (pearlId: string) => Promise<{ ok: boolean; pearl?: Record<string, string>; content?: string; error?: string }>;
      bridge?: {
        checkMessages: (count?: number) => Promise<{
          ok: boolean; messages: Array<{id: string; type: string; from: string; to: string; content: string; ts: number; pinned?: boolean}>;
          pinned: Array<{id: string; type: string; from: string; to: string; content: string; ts: number; pinned?: boolean}>;
          total_in_file: number; yoke_path: string; read_at: string; error?: string;
        }>;
        sendMessage: (args: { to: string; type: string; content: string; from?: string }) => Promise<{ ok: boolean; message_id?: string; error?: string }>;
      };
      applyOnboardingPrefs?: (prefs: { displayName?: string; addDesktopShortcut?: boolean; addStartupItem?: boolean; apiKey?: string }) => Promise<{ ok: boolean; results?: Record<string, boolean> }>;
      lbOptInGetState?: () => Promise<{ strikes: number; lastShown: number | null; decision: string }>;
      lbOptInRecordStrike?: () => Promise<{ ok: boolean }>;
      lbOptInSetDecision?: (decision: 'never' | 'pending' | 'linked') => Promise<{ ok: boolean }>;
      ipLedgerGetGenesis?: () => Promise<unknown>;
      ipLedgerFounderVcardQr?: () => Promise<{ dataUrl: string; vcard: string } | { error: string } | null>;
      ipLedgerExecuteGenesisMint?: () => Promise<unknown>;
      ipLedgerGenesisMintFull?: () => Promise<unknown>;
      mcpGetStatus?: () => Promise<{
        running: boolean;
        port: number | null;
        connectedClients: number;
        recentCalls: Array<{ tool: string; ts: number; clientId: string }>;
      }>;
      mcpGetAuthToken?: () => Promise<string | null>;
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
      runFieldSowing?: (fsConfig: {
        domain: string;
        maxPasses?: number;
        timeBudgetMs?: number;
        resume?: boolean;
      }) => Promise<{ ok: boolean; result?: unknown; error?: string }>;
      cancelFieldSowing?: () => Promise<{ ok: boolean }>;
      onFieldSowingProgress?: (callback: (event: unknown) => void) => () => void;
      refreshChocolatePack?: () => Promise<{ ok: boolean; manifest?: unknown; error?: string }>;
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
      plowResetAndReseedContext?: () => Promise<{ ok: boolean; written: number; total: number; backupPath: string }>;
      onPlowResetReseedProgress?: (
        callback: (data: { written: number; total: number; pct: number; done?: boolean }) => void,
      ) => () => void;
      getGoogleBaselines?: () => Promise<unknown>;
      runBenchmark?: (config: { nPerDomain: number; randomSeed: number; model: string; ollamaBaseUrl: string }) => Promise<{ ok: boolean; result?: unknown; error?: string }>;
      cancelBenchmark?: () => Promise<{ ok: boolean }>;
      writeBenchmarkReceipt?: (args: { receiptMarkdown: string; timestamp: number }) => Promise<{ ok: boolean; path?: string }>;
      onBenchmarkProgress?: (callback: (event: Record<string, unknown>) => void) => () => void;
      runCanonicalPlow?: (config: {
        domains: string[];
        questionsPerDomain: number;
        model?: string;
        ollamaBaseUrl?: string;
        specialistKeys?: { wolframApiKey?: string; stackExchangeKey?: string; pubmedApiKey?: string };
      }) => Promise<{ ok: boolean; result?: unknown; error?: string }>;
      cancelCanonicalPlow?: () => Promise<{ ok: boolean }>;
      onCanonicalPlowProgress?: (callback: (event: Record<string, unknown>) => void) => () => void;
      readClipboard?: () => Promise<string>;
      onClipboardCaptureQA?: (callback: () => void) => () => void;
      onAppVersionCheck?: (callback: (data: { version: string }) => void) => () => void;
      onOnboardingAutoFlipCheck?: (callback: (data: { ollamaHealthy: boolean; gemmaPresent: boolean }) => void) => () => void;
      dispatchListContentFiles?: () => Promise<unknown[]>;
      dispatchDefaultPlatforms?: (cls: string) => Promise<string[]>;
      dispatchGetFileBody?: (filePath: string) => Promise<{ v1Body?: string; v2Body?: string; error?: string }>;
      dispatchFire?: (req: { filePath: string; platforms: string[]; ratifiedPlatforms: string[] }) => Promise<unknown>;
      dispatchHistory?: () => Promise<unknown[]>;
      dispatchCredentialStatus?: () => Promise<{ substack: boolean; medium: boolean; gmail: boolean; cephas: boolean; lianabanyan: boolean; hackernews: boolean }>;
      onDispatchProgress?: (callback: (msg: string) => void) => () => void;
      mnemoGetMemoryMd?: () => Promise<{ ok: boolean; content?: string; error?: string }>;
      mnemoReloadMemoryMd?: () => Promise<{ ok: boolean; content?: string; error?: string }>;
      mnemoResetMemoryMd?: () => Promise<{ ok: boolean; content?: string; error?: string }>;
      mnemoOpenMemoryEditor?: () => Promise<{ ok: boolean; error?: string }>;
      runDiamond?: (config: { mode: 'bare' | 'cooperative'; count: number }) => Promise<{ ok: boolean; summary?: unknown; error?: string }>;
      cancelDiamond?: () => Promise<{ ok: boolean }>;
      onDiamondProgress?: (callback: (event: Record<string, unknown>) => void) => () => void;
      micStartDistributedPlow?: (config: { domains: string[]; questionsPerDomain: number; model?: string; ollamaBaseUrl?: string }) => Promise<{ ok: boolean; result?: unknown; error?: string }>;
      micCancel?: () => Promise<{ ok: boolean }>;
      micGetPeers?: () => Promise<unknown[]>;
      micAddPeer?: (peer: unknown) => Promise<{ ok: boolean }>;
      micDiscoverPeers?: () => Promise<unknown[]>;
      micEstimateWallclock?: (config: { domains: string[]; questionsPerDomain: number }) => Promise<{ estimatedMs: number; onlinePeers: number }>;
      onMicStatusEvent?: (callback: (event: Record<string, unknown>) => void) => () => void;
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
      onShowRestartPrompt?: (callback: (data: { version: string; message: string }) => void) => () => void;
      requestAppQuit?: () => Promise<void>;
      getPlowWorkerState?: () => Promise<unknown>;
      onPlowWorkerState?: (callback: (state: Record<string, unknown>) => void) => () => void;
      plowCheckCheckpoint?: () => Promise<unknown>;
      plowResumeFromCheckpoint?: () => Promise<{ ok: boolean; error?: string }>;
      plowDiscardCheckpoint?: () => Promise<{ ok: boolean }>;
      onPlowResumePrompt?: (callback: (data: Record<string, unknown>) => void) => () => void;
      hardwareGetTier?: () => Promise<{ tier: unknown; allTiers: unknown[]; activeModel: string }>;
      hardwareSetModel?: (model: string, tier: string) => Promise<{ ok: boolean }>;
      hardwareResetModel?: () => Promise<{ ok: boolean; model: string }>;
      lifecycleGetProfilePath?: () => Promise<{ appData: string; mnemosyneCPath: string }>;
      helpGetPeerId?: () => Promise<{ peerId: string }>;
      helpSendMessage?: (args: { text: string; imageUrl: string | null; fromPeer: string; toPeer: string | null }) => Promise<{ success: true; id: string } | { success: false; error: string }>;
      helpLoadMessages?: (args: { limit: number }) => Promise<Array<{ id: string; from_peer: string; to_peer: string | null; content_text: string; content_image_url: string | null; created_at: string }> | { error: string }>;
      helpUploadScreenshot?: (args: { base64Data: string; mimeType: string }) => Promise<{ url: string } | { error: string }>;
      helpStartRealtimeSub?: () => Promise<{ ok: true } | { error: string }>;
      onHelpMessageReceived?: (callback: (msg: { id: string; from_peer: string; to_peer: string | null; content_text: string; content_image_url: string | null; created_at: string }) => void) => () => void;
      thunderclap: {
        fireTrial02: (options: { flagshipTier: 'claude' | 'gemma' }) => Promise<{ status: string; accuracy?: string; receiptPath?: string }>;
        checkGates: () => Promise<{ allGreen: boolean; output: string }>;
        onLog: (callback: (line: string) => void) => void;
        onComplete: (callback: (result: { accuracy: string; receiptPath: string; exitCode: number }) => void) => void;
        onGatesFailed: (callback: (output: string) => void) => void;
        removeAllListeners: () => void;
      };
      gemma: {
        multiSegDispatch: (options: { question: string; workerCount?: number; model?: string }) => Promise<{ synthesized: string; variance: number; workerResponses: string[]; model: string; workerCount: number }>;
      };
    };
    // SEG-V0150-P0-DIAGNOSE-BRIDGE: sentinel -- set by preload before main bridge wires up
    __preloadLoaded?: boolean;
    // Query Capture Archive (D-BP151-037/BISHOP/seg-query-capture-archive)
    queryCapture?: {
      getEnabled: () => Promise<{ ok: boolean; enabled?: boolean; error?: string }>;
      setEnabled: (enabled: boolean) => Promise<{ ok: boolean; enabled?: boolean; error?: string }>;
      list: (status?: 'active' | 'cleared' | 'archived') => Promise<{ ok: boolean; entries?: QueryCaptureEntry[]; error?: string }>;
      find: (searchText: string) => Promise<{ ok: boolean; entries?: QueryCaptureEntry[]; error?: string }>;
      setStatus: (id: string, status: 'active' | 'cleared' | 'archived') => Promise<{ ok: boolean; error?: string }>;
      remove: (id: string) => Promise<{ ok: boolean; error?: string }>;
    };
    // BP087 Brain Swap -- brain registry hot-swap
    brainRegistry?: {
      list: () => Promise<{ ok: boolean; brains?: unknown[]; active_brain_id?: string; error?: string }>;
      getActive: () => Promise<{ ok: boolean; brain_id?: string; error?: string }>;
      setActive: (brain_id: string) => Promise<{ ok: boolean; error?: string }>;
      smokeTest: (brain_id: string) => Promise<{ ok: boolean; content?: string; brain_id?: string; kind?: string; latency_ms?: number; error?: string }>;
    };
  }
}

// Query Capture Archive entry type (mirrored from main process; no import) --
// D-BP151-037/BISHOP/seg-query-capture-archive
export interface QueryCaptureEntry {
  id: string;
  question: string;
  source: 'ask_tab' | 'ask_google';
  authority?: string;
  status: 'active' | 'cleared' | 'archived';
  capturedAt: string;
  filePath: string;
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
