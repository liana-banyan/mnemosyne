// AMPLIFY Computer ? Electron Main Process
// B37 Phase 1-3 ? BP025 / Bushel 37
// Phase 3 additions: connectivity polling, auto-mode transitions, substrate/federation IPC
// BP038 addition: env_loader MUST be the first import so its side-effects populate
// process.env (ANTHROPIC_API_KEY, etc.) before any consumer module reads them at load.
// Implements Blood Rule R16 (R-NO-API-KEY-EXPOSURE) ? values never logged.

// ============================================================================
// KN-BP145-E -- APPEND-ONLY REGISTRATION SURFACE (2026-08-04, branch clean-shell-v0.9)
// ============================================================================
// RULE: this file is a REGISTRATION SURFACE, not a place to write new logic.
// A "registration" here is exactly one of three shapes:
//   1. a top-level import of another module's registration/init function
//   2. a no-arg init()-style call inside app.whenReady() that starts a poll
//      loop or registers that module's own IPC handlers
//   3. a safeHandle(...)/ipcMain.handle(...) call inside registerIPCHandlers()
// GOING FORWARD: new registrations are ADDITIONS ONLY, one line (or one small
// block) per registration, placed at the matching "APPEND ZONE" for that
// category (search this file for "APPEND ZONE" -- three exist, one per
// category above, each with an "END APPEND ZONE" close). EXISTING lines are
// never edited to add a new registration -- only new lines are inserted at a
// zone. Two workers appending distinct lines at the same zone do not
// conflict with each other in git (their diffs touch disjoint lines), so
// the contention this rule exists to remove disappears without a lock.
// THIS RULE DOES NOT RETROACTIVELY REFACTOR the pre-existing inline handler
// bodies already living in registerIPCHandlers() below -- extracting those
// out of this file is a separately-scoped, much larger ticket. "No logic,
// additions only" is the bar for what gets ADDED from this point forward,
// not a claim that every pre-existing line already meets it.
// KN-BP144-18 PHASE 2 STATUS (checked this session, HEAD ffdf3d24): its
// main-side helper file does not exist yet in this repo -- no commit under
// any BP144-18 message, and no untracked/tracked file matching the names
// its own Phase 0 report (KN-BP144-18_REPORT.md, section 0.6) considered.
// That report's "two lines" figure (one import, one init() call) is a
// footprint ESTIMATE it copied from this file's own board_ipc.ts precedent
// (see the initBoardWatcher import and call below), not two lines that
// already exist and were merely waiting to be appended. When that helper
// file is actually built, its import belongs at IMPORT APPEND ZONE below and
// its init() call belongs at INIT-CALL APPEND ZONE below (or, if it turns
// out to register its IPC channel directly rather than via its own init(),
// its safeHandle/ipcMain.handle call belongs at the IPC-HANDLER APPEND ZONE
// inside registerIPCHandlers() instead) -- all three zones are open now and
// none requires editing any line outside itself.
// ============================================================================

import './env_loader';
import log from 'electron-log/main';
log.initialize({ preload: true });
log.transports.file.level = 'info';
log.transports.file.maxSize = 10 * 1024 * 1024; // 10 MB rotation

// ----------------------------------------------------------------------------
// KN-BP145-N6 (2026-08-05) -- deliberate, narrow exception to the KN-BP145-E
// append-only rule above. These lines EDIT the pre-existing electron-log
// wiring immediately below (they do not add a new registration); the defect
// this fixes is IN this existing transport setup, not a missing registration,
// and there is no APPEND ZONE for "wrap an existing transport's write fn".
// See KN-BP145-N6_REPORT.md for the full Phase 0 mechanism trace.
//
// Root cause, confirmed by reading node_modules/electron-log 5.4.4 source:
// electron-log's own Logger.processMessage() already wraps each transport
// call in try/catch, so a first EPIPE/EBADF throw from a broken
// stdout/stderr pipe (the terminal that owned this process's stdout is gone,
// but the process is still alive) IS already caught there. Its catch handler
// (processInternalErrorFn, overridden in electron-log's own
// createDefaultLogger.js) then calls transports.console.writeFn(...) a
// SECOND time, unguarded by any try/catch, to log "Unhandled electron-log
// error" -- and since the pipe is still broken, that second write throws
// again with nothing upstream to catch it, becoming an uncaught exception in
// the main process. Every later console.log/error call anywhere in the app
// (all aliased to electron-log via Object.assign(console, log.functions)
// below) repeats this exact two-step failure.
//
// Fix: wrap log.transports.console.writeFn itself -- the innermost point
// that actually touches process.stdout/process.stderr -- so EPIPE/EBADF
// never escapes as a throw in the first place, which prevents electron-log's
// own fragile unguarded retry path from ever being reached. Once a broken
// pipe is observed, the console transport is latched to a permanent no-op
// for the rest of the process lifetime (a broken pipe does not un-break), so
// later log calls do not keep attempting a write that can never succeed.
// log.transports.file is untouched by any of this and keeps writing
// independently -- it targets a rotating file on disk, not this process's
// inherited stdout/stderr handles, so a broken console pipe cannot affect it.
//
// Defense in depth: depending on platform and buffering state, a broken pipe
// can also surface as an async 'error' event on the stream object rather
// than a synchronous throw inside the write call, so the same narrow
// EPIPE/EBADF check is applied to process.stdout/process.stderr 'error'
// listeners too. Scope is deliberately narrow to these two "the write target
// is gone" error codes -- any other error class is re-thrown unchanged, so
// this does not widen a gate or change behavior for any other failure.
function isBrokenPipeWriteError(err: unknown): err is NodeJS.ErrnoException {
  return (
    !!err &&
    typeof err === 'object' &&
    'code' in err &&
    ((err as NodeJS.ErrnoException).code === 'EPIPE' ||
      (err as NodeJS.ErrnoException).code === 'EBADF')
  );
}

let consoleTransportBrokenPipeLatched = false;

for (const stdStream of [process.stdout, process.stderr]) {
  stdStream?.on?.('error', (err: unknown) => {
    if (isBrokenPipeWriteError(err)) {
      consoleTransportBrokenPipeLatched = true;
      return;
    }
    throw err;
  });
}

const rawConsoleWriteFn = log.transports.console.writeFn.bind(log.transports.console);
log.transports.console.writeFn = (options: { message: Parameters<typeof rawConsoleWriteFn>[0]['message'] }) => {
  if (consoleTransportBrokenPipeLatched) {
    return;
  }
  try {
    rawConsoleWriteFn(options);
  } catch (err) {
    if (isBrokenPipeWriteError(err)) {
      consoleTransportBrokenPipeLatched = true;
      return;
    }
    throw err;
  }
};
// ----------------------------------------------------------------------------

// Pipe ALL main-process console.* through electron-log
Object.assign(console, log.functions);
import ws from 'ws';
import { probeSubstrateApiPort } from './port_guard';
import { probeRendererHealth } from './renderer_guard';

import {
  app,
  BrowserWindow,
  Tray,
  Menu,
  nativeImage,
  ipcMain,
  screen,
  shell,
  globalShortcut,
  dialog,
  Notification,
  clipboard,
} from 'electron';
import { join, resolve } from 'path';
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, watch as fsWatch, readdirSync, cpSync } from 'fs';
import { spawn } from 'child_process';
import { tmpdir, homedir } from 'os';
import { ollamaManager } from './ollama_manager';
// BP135 Yoke #35: same source ai-dispatch:query (the real ASK handler) already honors as the
// "exact installed Ollama tag the user picked in ASK's model selector" -- see brain_registry.ts's
// getActiveBrain(). WAN plow answer paths below were hardcoding 'gemma4:12b' instead of reading
// this, so a box sized/selected for a smaller model still tried to run 12b and blew its timeout.
import { getActiveBrain, hasPersistedBrainChoice } from './brain_registry/brain_registry';
import { SubstrateAPIServer, API_PORT } from './substrate_api';
// BP133 Yoke #24 Task 1: single authoritative substrate toggle for the WAN responder path.
import { applySubstrateToggle, isDebugPromptLoggingEnabled, buildOutboundPromptLogLine } from './mesh_test/substrate_toggle';
import { FederationClient } from './federation_client';
import { getMoneyPennyURL, getLocalIPs } from './mobile_pwa';
import { AutoUpdateManager, type UpdateState } from './auto_updater';
import { getAnonKey, getSupabaseUrl } from './shared/anon_key';
// M21: Automatic update scheduler (Block 2-6)
import {
  registerAutoUpdateIPC,
  startAutoUpdateLoop,
  checkAndTriggerPendingInstall,
  migrateAutoInstallConfig,
  registerWindowForAutoUpdate,
  getAutoUpdateConfig,
} from './auto_update_scheduler';
import { PeerDiscovery, getStablePeerId, initializeLocalPeerKeypair } from './federation/peer-discovery';
import { RelayClient } from './federation/relay-client';
import { performCommunityConnectHandshake } from './federation/community-connect';
import { registerSubstrateAwakensIPC } from './federation/substrate_awakens_ipc';
import { AuthManager, registerCustomScheme } from './auth_manager';
import {
  runHearthBuild,
  runHearthInstall,
  getHearthLibrary,
  getHearthHealthz,
  runSpecExtractSmoke,
} from './hearth_app_builder/orchestrator';
import { uninstallApp } from './hearth_app_builder/install_runner';
// B83 ? Hearth Conjunction Window
import { conjunctionRouter } from './hearth/conjunction/conjunction_router';
import { buildSubstrateContext } from './hearth/embedded_browser/substrate_context_builder';
// BP137 Yoke v2b Integration-1 Part 2: browser-authority IPC leg. buildBrowserAuthorityQueryUrl
// is a real (pure, no I/O) import for the navigation-URL builder; the two types are the shared
// vocabulary both this file and browser_authority_adapter.ts/plow_mc_answerer.ts speak -- see
// runBrowserAuthorityQueryFromMain() below (near openHearthConjunctionWindow()) for the actual
// main<->renderer forwarding this Yoke wires.
// (this build pass) isInteractiveBrowserAuthority/buildMcAwareQueryText added: the claude.ai/new
// interactive driver (see runInteractiveBrowserAuthorityQuery below, near
// runBrowserAuthorityQueryFromMain) needs to (a) know which authorities require the type->submit
// ->wait->scrape sequence instead of a plain query-URL navigation, and (b) build the same
// options-aware prompt text user_perplexity already sends via its URL, but for claude.ai send it
// as the COMPOSER payload instead (claude.ai has no query-URL form at all -- see
// buildBrowserAuthorityQueryUrl's own user_claude branch, which always returns the fixed
// https://claude.ai/new landing URL regardless of question/options).
// D-BP152-030R: decideNexusThreadContinuation/NexusLiveThreadState added -- the pure decision
// point for whether an interactive (conversational) browser-authority call reuses the shared
// nexus <webview>'s already-live page or must force a fresh navigation. See
// runInteractiveBrowserAuthorityQueryObserved below and nexusLiveThread (module-level state) for
// the wiring; browser_authority_types.thread.test.ts unit-tests the decision function itself.
// D-BP152-031: createNexusRunThreadContext added -- mints ONE thread-identity space per Liana
// Cycle run (one 'liana-terminal-run' IPC call = one question), so the askGoogle closure built
// below (near openHearthConjunctionWindow()) can pass threadId/continueThread derived from the
// RUN rather than hand-edited per call site. See that closure's own comment and
// browser_authority_types.ts's own D-BP152-031 section header for the full mechanism; unit-tested
// in browser_authority_types.run_thread_context.test.ts.
import {
  buildBrowserAuthorityQueryUrl,
  buildMcAwareQueryText,
  createNexusRunThreadContext,
  decideNexusThreadContinuation,
  isInteractiveBrowserAuthority,
  type BrowserAuthorityDispatchOutcome,
  type BrowserAuthorityName,
  type BrowserAuthorityQuery,
  type BrowserAuthorityRawExtraction,
  type NexusLiveThreadState,
  type NexusThreadDecision,
  // D-BP152-033/BISHOP/seg-machine-drives-nexus -- type-only, for the runMachineDrivenNexusQueryFromMain glue.
  type NexusRunThreadContext,
} from '../shared/plow/browser_authority_types';
// BP138 Yoke 0.9.15 FIX 4: Ask-tab wiring. classifyAnswerType is the SAME existing classifier
// plow_mc_answerer.ts's Stage F2 already uses (answer_type_classifier.ts, pure/dependency-free
// -- no import cycle risk). getRawBrowserAuthorityFact/BrowserAuthorityBridge are FIX 3's new
// additive primitive (browser_authority_adapter.ts, which itself has zero imports of this file,
// so this is a safe static import, not a dynamic one -- unlike plow_mc_answerer.ts's own
// dynamic `await import('../index')`, which exists only because THIS file dynamically imports
// plow_mc_answerer.ts elsewhere, a cycle that does not exist for browser_authority_adapter.ts).
import { classifyAnswerType } from './plow/answer_type_classifier';
// KN-BP142-5: the Liana Cycle Engine's caller/scheduler/kill-switch (see that file's own header
// for the trigger-policy write-up). Lightweight at import time -- runCanonicalPlowMcAnswer and
// the mesh-test module are only dynamically imported inside runOneLianaCycleTurn(), same lazy-
// import convention every other heavy plow_mc_answerer.ts caller in this file already uses.
import { initLianaCycleScheduler } from './plow/liana_cycle_scheduler';
// KN-BP144-10 T1-T4: Grand Central board panel (Electron port of HARDWIRE/tools/board.mjs).
// Read-only observer of dropzone/git/receipts state -- see src/main/board/ for the full port.
import { initBoardWatcher } from './board/board_ipc';
import { getRawBrowserAuthorityFact, type BrowserAuthorityBridge } from './plow/browser_authority_adapter';
// BP148 D-BP148-029 (SEG per-arm-routing): pure per-arm routing-decision helper, split out so it
// can be unit-tested without tripping this file's own module-scope app.whenReady() call (see
// nexus_lookup_authority_routing.ts's header for why that rules out requiring dist/main/index.js
// directly in a plain-Node test harness). Zero Electron import in that file; the actual
// Electron-dependent read (overlayWindow.webContents.executeJavaScript) stays in THIS file, next
// to the 'nexus-ask-lookup-fact' handler that is its only caller.
import {
  otherNexusBrowserAuthority,
  planNexusLookupAuthorityRouting,
  type NexusLookupAssignedAuthority,
} from './nexus_lookup_authority_routing';
// BP137 Yoke 0.9.12 Stage F1 ("persistent, always-on, logged-in browser authority") --
// ADDITIVE. See nexus_authority_persistent_session.ts's own header for the full mechanism.
// runBrowserAuthorityQueryFromMain() below is repointed to target ensureNexusAuthoritySession()'s
// hidden, always-alive window instead of hearthConjunctionWindow (Stage F1 build item 2); the
// four new nexus-authority-* IPC handlers in registerIPCHandlers() below are the Settings
// "Authorities" panel's wire (build item 3).
import {
  ensureNexusAuthoritySession,
  hideNexusAuthoritySession,
  isNexusAuthorityFlagEnabled,
  probeAllNexusAuthorityStatuses,
  probeNexusAuthoritySignInStatus,
  setNexusAuthorityBrowserFlags,
  showNexusAuthoritySessionForSignIn,
  // D-BP152-025/BISHOP/seg-nexus-returns-answer -- additive; see that file's own "Operator
  // capture" section header for the full mechanism.
  captureNexusAuthorityVisibleText,
  // D-BP152-033/BISHOP/seg-machine-drives-nexus -- additive; see that file's own "MACHINE-DRIVEN
  // queries" section header for the full mechanism. This ticket's only use of it is the thin glue
  // wrapper (runMachineDrivenNexusQueryFromMain) defined just below runBrowserAuthorityQueryFromMain.
  runMachineDrivenNexusQuery,
  // D-BP152-048/BISHOP/seg-webview-collision -- additive; see that file's own "the machine-query
  // window" section header for the full mechanism. Used ONLY by the static (Google/Perplexity)
  // branch of runBrowserAuthorityQueryFromMainObserved below, so askGoogle-shaped queries never
  // navigate the operator's own shared Nexus window.
  ensureNexusMachineQuerySession,
} from './plow/nexus_authority_persistent_session';
// D-BP152-028/BISHOP/seg-nexus-browser-bar -- ADDITIVE. Bookmarks persistence for the Nexus
// Authority window's new address bar; see nexus_authority_bookmarks_store.ts's own header for
// the chosen on-disk path and why.
import {
  listNexusAuthorityBookmarks,
  addNexusAuthorityBookmark,
  removeNexusAuthorityBookmark,
} from './plow/nexus_authority_bookmarks_store';
import { querySagaState, recordWaveDispatch, recordWaveComplete } from './hearth/drekaskip_status/drekaskip_bridge';
import { pollWatchdogStatus, getSubjectHistory } from './hearth/active_substrate/watchdog_bridge';
import { toggleMonitor, getMetrics, getAllMonitorStates } from './hearth/active_substrate/scribe_monitor';
// D-BP149-034/BISHOP/S34/seg-lianaterminal -- the Liana Cycle terminal (BP148 ratified canon:
// canon_liana_cycle_terminal_window_we_fight_as_we_train_bp148.eblet.md). runLianaCycleQuestion
// is the ported cascade (scripts/founder_cascade_v2.mjs); _paths.HEARTBEAT_DIR is the EXISTING
// yoke ledger directory yoke_watcher.ts already watches -- reused here rather than inventing a
// second Mic mechanism, per this ticket's explicit instruction.
import { runLianaCycleQuestion } from './liana_cycle/liana_terminal_engine';
// D-BP152-043/BISHOP/seg-scratch-composer -- THE SCRATCH COMPOSER. Founder, BP152, verbatim
// (FD-BP152-20): "I want the updated Mnemosynec Liana Cycle - the Scratch version... I want to
// use it to stack methods in whatever order I want... NameNumbered... mix and match as I please."
// listComposerRegistry/runScratchComposer are the ONLY two new functions this ticket calls into;
// see script_bridge.ts's own header for why the default (empty-stack) path is byte-identical to
// the pre-existing 'liana-terminal-run' handler below (same runLianaCycleQuestion call, by
// reference, untouched).
import { listComposerRegistry, runScratchComposer } from './liana_cycle/library/script_bridge';
// D-BP150-001 (Call an Audible) -- the operator-facing side of the pause. AudibleChannel is
// implemented over IPC in the 'liana-terminal-run' handler below; audible.ts itself has no
// Electron dependency, which is why the interface lives there and the wiring lives here.
import type { AudibleChannel } from './liana_cycle/audible';
// D-BP151-023 (Stepped Audible) -- the operator-facing side of the PER-FOUNDER-STEP pause. Same
// convention as AudibleChannel above: SteppedAudibleChannel is implemented over IPC in the
// 'liana-terminal-run' handler below; stepped_audible.ts itself has no Electron dependency.
import type { SteppedAudibleChannel } from './liana_cycle/stepped_audible';
// D-BP152-044/BISHOP/seg-last-mile-gemini -- type-only. ConversationalAuthorityFn is the shape of
// the closure built below (near the 'liana-terminal-run' handler) that routes SURVEY's two
// META-questions (the ambiguity query, the operation query) to Gemini via runMachineDrivenNexusQuery
// (D-BP152-033, already imported above) before falling back to Google. method_registry.ts's own
// header explains why this is NOT the same shape as AskGoogleFn.
// D-BP152-050/BISHOP/seg-honest-failure-reasons -- type-only. AskGoogleFn is buildLianaAskGoogle()'s
// (below) own return shape -- the SAME type MethodRunContext.askGoogle already declares, imported
// here only so that closure can be typed explicitly rather than left to structural inference.
import type { ConversationalAuthorityFn, AskGoogleFn } from './liana_cycle/method_registry';
// D-BP150-002 -- reading the operator's already-written teaching notes back into a live pause.
import { listTeachingFiles } from './liana_cycle/teaching_notes';
import type { LianaAudibleResponse, LianaSteppedResponse, LianaTerminalEvent } from '../shared/liana_cycle/liana_terminal_types';
import { _paths as YOKE_PATHS } from './resident/yoke_watcher';
// BP037 ? On-Deck Master-of-Ceremonies
import { listOnDeck } from './on_deck/on_deck_bridge';
// Adaptive Concurrency Carrier (Layer 2+4)
import { getCapInfo, probeConcurrencyCap, setCapOverride } from './concurrency_probe';
// SAGA 4 BP041 ? In Conjunction Agent Panel
import {
  probeAgent,
  setApiKey,
  getApiKeyStatus,
  loadPersistedApiKeys,
} from './agent_probe';
import {
  loadPlugins,
  getLoadedPlugins,
  getPluginRegistry,
  watchPluginDir,
  ensurePluginDir,
} from './agent_plugins';

// Register custom OAuth scheme before app ready (Electron requirement)
registerCustomScheme();

// BP052 v0.1.8 ? Kitchen Table? IPC store
import { registerKitchenTableIpc } from './kitchen_table/kitchen_table_store';

// BP060 Application 002 Step 1 ? Caithedral Tools IPC
import { registerCaithedralToolsIPC, setMeshPointerAdvanceHook, dag_soccerball_emit_reexport } from './caithedral_tools_ipc';
import { setDagEmitMeshHook, setFetchSidFromPeerHook } from './substrate_api';

// MESH-6 ? shared protocol payload types
import {
  FedMsg,
  SidFetchRequestPayload,
  SidFetchResponsePayload,
  PointerAdvancePayload,
} from '../shared/federation-protocol';

// MESH-6 ? dag soccerball lookup (canonical exports-map path; tsconfig paths resolves types)
import {
  dag_soccerball_lookup as _dagLookup,
  type DagNode,
} from 'caithedral-core/tools/dag_soccerball';

// BP060 Application 002 Steps 3+4 ? Bridge IPC (UI-7 live Yoke wire)
import { registerBridgeIPC } from './bridge_ipc';
// Battery Dispatch v0.3.0 — BP082 publish fan-out engine
import { registerDispatchIPC } from './dispatch/dispatch_ipc';

// BP060 Application 002 Steps 3+4 ? AI Dispatch IPC (UI-8 backend)
import { registerAiDispatchIPC } from './ai_dispatch_ipc';

// D-BP151-037/BISHOP/seg-query-capture-archive -- Query Capture Archive (three acts: clear,
// archive, delete). captureQuery is called directly (not just via IPC) at the ONE chokepoint
// every askGoogle-shaped call funnels through (runBrowserAuthorityQueryFromMainObserved below,
// see D-BP144-7 T1's own comment for why that is the one real chokepoint).
import { registerQueryCaptureIPC } from './query_capture/query_capture_ipc';
import { captureQuery } from './query_capture/query_capture_store';

// BP087 Wave 3 SEG-C1 + SEG-E1 - Thunderclap trial fire + Gemma multi-seg dispatch
import { registerThunderclapFireIPC } from './thunderclap_fire_ipc';
import { registerGemmaMultiSegIPC } from './gemma_multi_seg_ipc';

// BP083 SEG-1/2/4/5 — 6-folder substrate scaffold + MEMORY.md amnesia cure + TestData seeds
import { ensureMnemosyneCFolders, generateMemoryMd, populateTestDataSeeds, registerMemoryScaffoldIPC, installStarterChocolate } from './memory_scaffold';

// BP081 K-2 — MnemosyneC local MCP server
import { startMcpServer, stopMcpServer, getMcpServerStatus } from './mcp_server';

// SAGA-? v0.1.10 ? SubstratedFolderWatcher?
import { SubstratedFolderWatcher, registerWatcherIpc } from './services/SubstratedFolderWatcher';

// BP067 Correction 2 ? Folder?DAG bridge
import { setDagBridgeMeshHook, getDagEmitCount } from './dag_bridge';

// v0.4.0 BP083 — MIC Dispatcher + The Diagnosis + Peer Server
import { registerMicIpc } from './federation/mic_ipc';
import { registerDiagnosisIpc } from './diagnosis/diagnosis_ipc';
import { runCatacombMigrationCheck } from './diagnosis/catacomb_migrator';
import { startPeerServer, stopPeerServer, getCurrentTier, registerPresenceConfig } from './federation/peer_server';
// KN-BP144-16 Phase 1: LAN discovery opt-out setting (defaults to refuse-unauthenticated).
import { registerMeshTrustSettingsIpc } from './federation/mesh_trust_settings';
// BP134 Yoke #29 Part 2: this node must run peer_artifact_server so OTHER nodes' mesh-pull
// (auto_update_scheduler.ts's findNewerPeers/pullAndVerifyFromPeers) has something to reach --
// the client-side pull code already existed (BP087 Wave 4) but this server was never started.
import { startPeerArtifactServer } from './keys_engines/peer_artifact_server';

// BP132 Yoke #21 A1 — mesh revival: relay-answer poller + startup self-diagnostic.
// Both were fully built but never wired into boot (confirmed: zero call sites in src/).
import { startRelayAnswerPoller } from './relay_answer';
import { submitStartupDiagnostic } from './relay_answer/startup_diagnostic';

// SAGA 10 BP045 W1 ? mnemosyne:// + mnemo:// deep-link handler
import { registerDeepLinkProtocol, handleStartupDeepLink } from './deep-link-handler';
import type { DeepLinkPayload } from './deep-link-handler';

// BP087 MAMBA-Row3: Substrace theorem mesh routing re-weave dispatch
import { handleSubstraceWakeReceive, setRelayEmitHook } from './substrace/wake_router';

// BP072 ? Paired-Frame Mutual-Aid Layer
import { PairedFrameManager } from './federation/paired-frame-manager';

// SEG-WAN-2: WAN soccerball relay wiring
import {
  setWanSoccerballHook,
  setWanStatusEmitter,
  createWanSoccerballResolver,
} from './federation/wan_escalation';

// BP065 Part A ? LB Account authentication + device linking
import {
  startLBAuthFlow,
  completeLBAuth,
  getLBSession,
  revokeDevice as lbRevokeDevice,
} from './lb_auth';

// BP080 Genesis Mint — IP Ledger read/write (main-process only; Federal Body Cam doctrine)
import { loadAllEntries, registerClaim } from './ip_ledger/ip_ledger_store';

// --- APPEND ZONE: IMPORT -- new registration-module imports go below this line, per KN-BP145-E
// One import line per new registration module. Never insert a new import between existing
// imports above this zone; always append here instead.
// (currently empty -- the next new registration import lands here)
import { initOpenAiCompatServer } from './openai_compat_server'; // KN-BP145-M3: THE NEXUS
import { computeUsageBarrelOperationalSnapshot } from './hearth/usage_barrel_scraper'; // KN-BP147-M4: UNBARREL THE BARRELS
import { startResidentWatcher } from './resident'; // KN-BP147-M2: THE RESIDENT CONSUMER, OD-04, THE RED QUEEN
// KN-BP147-M2 (D-BP147-005): THE CRYSTAL, WIRED. Type-only import -- fully erased at compile
// time, zero runtime require, so it carries none of the risk described below. See
// getCrystalStore() (defined just above registerIPCHandlers()) for why the RUNTIME require of
// crystal_store.ts is deliberately NOT a static import here: crystal_store.ts's own compiled
// output contains a hardcoded require("./crystal_types.ts") (its line 45) which MODULE_NOT_FOUNDs
// under the real Electron-bundled Node runtime (confirmed this session: Electron 31.7.7 ships
// Node 20.18.0, which predates Node's native TS type-stripping entirely -- direct repro via
// `ELECTRON_RUN_AS_NODE=1 node_modules\.bin\electron.cmd -e
// "require('./dist/main/crystal/crystal_store.js')"` throws exactly that MODULE_NOT_FOUND).
// That is a pre-existing defect in KN-BP147-M1's committed code (commit ccae7f1c) -- crystal/ is
// this ticket's READ-ONLY zone, so rather than leave the Crystal permanently unreachable in the
// real app, getCrystalStore() below installs a narrow, additive-only .ts->.js module-resolution
// fallback (ensureCrystalTsToJsFallback(), touching zero bytes under crystal/) before requiring
// the store, then requires it lazily via a plain runtime require() -- never a static top-level
// `import` of the runtime module, which would throw during index.js's own module evaluation,
// before app.whenReady() runs, crashing the whole app before any window opens: exactly what
// this ticket's FAIL OPEN rule forbids, and exactly what the fallback exists to avoid needing.
import type { BindingTarget, MutationReason, BindResult, ResolvedChonk } from './crystal/crystal_types';
import { initCdpGuard } from './cdp_guard'; // D-BP151-038/BISHOP/seg-cdp-guard -- Founder BP151 "Build the guard." on D-BP151-034's named CDP-9333 gap
import { initBatteryDispatchPluginEndpoint } from './battery_dispatch_plugin_endpoint'; // D-BP151-042/BISHOP/seg-battery-dispatch-endpoint -- Founder BP151 "Battery Dispatch is local plugins, so build the endpoint"; off by default, loopback-only, Bearer-authenticated
import { saveLaboratoryStep, listLaboratorySteps } from './liana_cycle/library/laboratory_store'; // D-BP152-022/BISHOP/seg-laboratory-and-keep -- FD-BP152-10 tier 1 (the Laboratory); FD-BP152-07 ephemeral-unless-"keep"
// --- END APPEND ZONE: IMPORT -------------------------------------------------

// --- Constants --------------------------------------------------------------

// D-BP151-038/BISHOP/seg-cdp-guard -- Founder BP151 "Build the guard." on D-BP151-034's named
// gap (CHROME_IN_MNEMOSYNEC_PHASE_0_BP151.md, table B6: CDP port 9333's Runtime.evaluate
// bypasses contextBridge, no preventing mechanism existed). Called here, as the very first
// statement after the import block and before app.whenReady() (line ~8756+), so a PACKAGED
// build launched with --remote-debugging-port refuses and exits before any BrowserWindow,
// webview, or IPC handler is created. In dev (npm run dev:main:cdp) this is a no-op refusal
// path -- see src/main/cdp_guard.ts's own header for the full guard shape and why.
initCdpGuard();

// MNEMOSYNE_PROD_LAUNCH=1 forces loadFile of built renderer even from source tree
// (used for smoke-launch + two-instance tests without full packaging)
const IS_DEV = process.env.MNEMOSYNE_PROD_LAUNCH !== '1' &&
  (process.env.NODE_ENV === 'development' || !app.isPackaged);
// Use explicit 127.0.0.1 (IPv4) ? avoids Windows ::1 vs 127.0.0.1 split-brain
// where Vite binds to ::1 but Chromium connects to 127.0.0.1.
const VITE_DEV_URL = 'http://127.0.0.1:5173';
const RENDERER_URL = IS_DEV
  ? VITE_DEV_URL
  : `file://${join(__dirname, '../renderer/index.html')}`;

// --- CSP ---------------------------------------------------------------------
// Strict prod / minimal dev relaxation (HMR style + module loading only).
// NO unsafe-eval in either environment.
const _SUBSTRATE_PORT = Number(process.env.SUBSTRATE_PORT ?? 11480);
const _ANNOUNCE_PORT = Number(process.env.PEER_ANNOUNCE_PORT ?? 11481);
const CSP_DEV =
  "default-src 'self' http://127.0.0.1:5173; " +
  "script-src 'self' 'unsafe-inline' http://127.0.0.1:5173; " +
  "style-src 'self' 'unsafe-inline'; " +
  `connect-src 'self' http://127.0.0.1:5173 ws://127.0.0.1:5173 ` +
  `http://127.0.0.1:${_SUBSTRATE_PORT} http://127.0.0.1:${_ANNOUNCE_PORT}; ` +
  "img-src 'self' data: blob:; " +
  "font-src 'self' data:";

const CSP_PROD =
  "default-src 'self'; " +
  "script-src 'self'; " +
  "style-src 'self' 'unsafe-inline'; " +
  `connect-src 'self' http://127.0.0.1:${_SUBSTRATE_PORT} http://127.0.0.1:${_ANNOUNCE_PORT}; ` +
  "img-src 'self' data: blob:; " +
  "font-src 'self' data:";

const ACTIVE_CSP = IS_DEV ? CSP_DEV : CSP_PROD;

// Connectivity polling interval (30s)
const CONNECTIVITY_POLL_MS = 30_000;

// --- SEG-V0148: diagnostic capture vars (set after ollamaManager.init()) -----

let _capturedOllamaBranch: string = 'UNKNOWN';
let _capturedOllamaPath: string | null = null;
let _capturedActiveModel: string = 'unknown';
let _capturedTargetModel: string = 'unknown';

/**
 * SEG-V0148-P1-RENAME-USERDATA: first-launch migration when package name changed
 * from "amplify-computer" → "mnemosynec". Copies (does not move) the old userData
 * directory to the new path so existing user settings/model state are preserved.
 */
function migrateUserDataIfNeeded(): void {
  if (process.platform !== 'win32') return;
  const appData = process.env.APPDATA;
  if (!appData) return;
  const oldPath = join(appData, 'amplify-computer');
  const newPath = app.getPath('userData');
  if (!existsSync(oldPath) || existsSync(newPath)) return;

  const migrationStart = Date.now();
  console.log(`[userData migration] Starting: ${oldPath} → ${newPath}`);
  try {
    cpSync(oldPath, newPath, { recursive: true });
    const elapsed = Date.now() - migrationStart;
    let fileCount = 0;
    try {
      const countFiles = (dir: string): number => {
        let n = 0;
        for (const e of readdirSync(dir, { withFileTypes: true })) {
          n += e.isDirectory() ? countFiles(join(dir, e.name)) : 1;
        }
        return n;
      };
      fileCount = countFiles(newPath);
    } catch { /* non-fatal */ }
    console.log(
      `[userData migration] userData migration: copied ${oldPath} → ${newPath} (${fileCount} files, ${elapsed}ms)`,
    );
  } catch (e) {
    console.error('[userData migration] Migration failed:', String(e));
  }
}

// --- SAGA 4: Tier persistence + agent IPC handlers ---------------------------

const SUBSTRATE_ROOT_MAIN = process.env.LB_SUBSTRATE_ROOT ?? join(homedir(), '.lb_substrate');
const TIERS_FILE = join(SUBSTRATE_ROOT_MAIN, 'in_conjunction_tiers.json');

// BP048 v0.1.7 ? wife-install first-run + LOCAL-HANDSHAKE prefs (~/.mnemosyne/)
const MNEMOSYNE_HOME = join(homedir(), '.mnemosyne');
const FIRST_RUN_FLAG = join(MNEMOSYNE_HOME, 'first_run.flag');
const LAN_HANDSHAKE_PREFS = join(MNEMOSYNE_HOME, 'lan_handshake.json');

interface LanHandshakePrefs {
  neverAsk?: boolean;
  connectedPeers?: string[];
}

function isFirstRun(): boolean {
  return !existsSync(FIRST_RUN_FLAG);
}

function markFirstRunComplete(): void {
  const fs = require('fs') as typeof import('fs');
  fs.mkdirSync(MNEMOSYNE_HOME, { recursive: true });
  fs.writeFileSync(FIRST_RUN_FLAG, new Date().toISOString(), 'utf-8');
}

function loadLanHandshakePrefs(): LanHandshakePrefs {
  if (!existsSync(LAN_HANDSHAKE_PREFS)) return {};
  try {
    return JSON.parse(require('fs').readFileSync(LAN_HANDSHAKE_PREFS, 'utf-8')) as LanHandshakePrefs;
  } catch {
    return {};
  }
}

function saveLanHandshakePrefs(prefs: LanHandshakePrefs): void {
  const fs = require('fs') as typeof import('fs');
  fs.mkdirSync(MNEMOSYNE_HOME, { recursive: true });
  fs.writeFileSync(LAN_HANDSHAKE_PREFS, JSON.stringify(prefs, null, 2), 'utf-8');
}

let lanHandshakeEligible = false;
let lanHandshakePromptInFlight = false;

function loadTierChoices(): Record<string, string> {
  if (!existsSync(TIERS_FILE)) return {};
  try {
    return JSON.parse(require('fs').readFileSync(TIERS_FILE, 'utf-8')) as Record<string, string>;
  } catch {
    return {};
  }
}

function saveTierChoices(choices: Record<string, string>): void {
  require('fs').mkdirSync(SUBSTRATE_ROOT_MAIN, { recursive: true });
  require('fs').writeFileSync(TIERS_FILE, JSON.stringify(choices, null, 2), 'utf-8');
}

async function agentProbeHandler(
  agentId: string,
  opts: { force?: boolean; modelId?: string } = {},
): Promise<{ agentId: string; status: string; reason?: string; probed_at?: string }> {
  return probeAgent(agentId, opts);
}

function agentSetApiKeyHandler(agentId: string, keyValue: string): { ok: boolean; error?: string } {
  // R16: keyValue is processed immediately and never stored in a variable that could be logged
  return setApiKey(agentId, keyValue);
}

function agentGetApiKeyStatusHandler(): Record<string, boolean> {
  return getApiKeyStatus();
}

function agentGetTierChoicesHandler(): Record<string, string> {
  return loadTierChoices();
}

function agentSetTierChoiceHandler(agentId: string, tierId: string): { ok: boolean } {
  try {
    const choices = loadTierChoices();
    choices[agentId] = tierId;
    saveTierChoices(choices);
    return { ok: true };
  } catch (err) {
    return { ok: false };
  }
}

function agentGetPluginsHandler() {
  return getLoadedPlugins();
}

function agentGetPluginRegistryHandler() {
  return getPluginRegistry();
}

// --- State ------------------------------------------------------------------

let overlayWindow: BrowserWindow | null = null;
let dashboardWindow: BrowserWindow | null = null;
let folderWatcher: SubstratedFolderWatcher | null = null;
let hearthConjunctionWindow: BrowserWindow | null = null;
let moneyPennyWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let substrateServer: SubstrateAPIServer | null = null;
let federationClient: FederationClient | null = null;
let autoUpdater: AutoUpdateManager | null = null;
let authManager: AuthManager | null = null;
let peerDiscovery: PeerDiscovery | null = null;
let relayClient: RelayClient | null = null;
/** BP104 D4 — last boot zombie flush count for renderer toast */
let _bootZombieCount = 0;
let _zombieFlushInterval: ReturnType<typeof setInterval> | null = null;
let connectivityTimer: ReturnType<typeof setInterval> | null = null;
let pairedFrameManager: PairedFrameManager | null = null;

// --- MESH-6: in-flight relay fetch listeners ----------------------------------
const meshFetchListeners = new Map<string, (payload: SidFetchResponsePayload) => void>();
let watchdogOverlayInterval: NodeJS.Timeout | null = null;
let rendererResponsive = true;
let displayMetricsListenerAttached = false;

// --- MESH-6 helpers -----------------------------------------------------------

function _recomputeDagId(
  node: { pearls: string[]; bindings: Record<string, string>; faces: Record<string, string> },
): string {
  const { createHash } = require('crypto') as typeof import('crypto');
  function sortedJson(obj: Record<string, string>): string {
    const sorted: Record<string, string> = {};
    for (const k of Object.keys(obj).sort()) sorted[k] = obj[k];
    return JSON.stringify(sorted);
  }
  const payload = JSON.stringify([
    [...node.pearls].sort(),
    sortedJson(node.bindings),
    sortedJson(node.faces),
  ]);
  return createHash('sha256').update(payload).digest('hex').slice(0, 32);
}

function _broadcastMeshStateChanged(): void {
  // Push mesh-state-changed to all renderer windows
  const allWindows = (require('electron') as typeof import('electron')).BrowserWindow.getAllWindows();
  for (const win of allWindows) {
    if (!win.isDestroyed()) {
      win.webContents.send('mesh-state-changed', {
        peers: peerDiscovery?.getAllPeers() ?? [],
        relayConnected: relayClient?.isConnected() ?? false,
      });
    }
  }
}

async function _fetchSidViaTCP(
  peer: import('../shared/federation-protocol').MnemosynePeer,
  dag_id: string,
  reqMsg: FedMsg,
): Promise<{ ok: boolean; node?: DagNode; hash_verified: boolean; error?: string }> {
  return new Promise((resolve) => {
    const { createConnection } = require('net') as typeof import('net');
    const timeout = 5000;
    let buffer = '';
    const socket = createConnection({ host: peer.address, port: peer.port, timeout }, () => {
      socket.write(JSON.stringify(reqMsg) + '\n');
    });
    socket.on('data', (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        try {
          const resp = JSON.parse(line) as FedMsg;
          if (resp.type === 'sid_fetch_response') {
            const payload = resp.payload as SidFetchResponsePayload;
            if (!payload.found || !payload.node) {
              socket.destroy();
              resolve({ ok: true, hash_verified: false, error: 'not found on peer' });
              return;
            }
            const recomputed = _recomputeDagId(payload.node);
            const hash_verified = recomputed === dag_id;
            if (!hash_verified) {
              console.error(`[MESH-6] SID hash mismatch: expected=${dag_id} got=${recomputed}`);
              socket.destroy();
              resolve({ ok: false, hash_verified: false, error: 'SID hash mismatch ? rejected' });
              return;
            }
            socket.destroy();
            resolve({ ok: true, node: payload.node as DagNode, hash_verified: true });
          }
        } catch { /* malformed ? continue */ }
      }
    });
    socket.on('error', (err: Error) => resolve({ ok: false, hash_verified: false, error: err.message }));
    socket.on('close', () => resolve({ ok: false, hash_verified: false, error: 'connection closed' }));
    setTimeout(() => { socket.destroy(); resolve({ ok: false, hash_verified: false, error: 'timeout' }); }, timeout);
  });
}

async function _fetchSidViaRelay(
  toPeerId: string,
  dag_id: string,
  reqMsg: FedMsg,
): Promise<{ ok: boolean; node?: DagNode; hash_verified: boolean; error?: string }> {
  return new Promise((resolve) => {
    if (!relayClient) {
      resolve({ ok: false, hash_verified: false, error: 'relay not connected' });
      return;
    }
    const timer = setTimeout(() => {
      meshFetchListeners.delete(dag_id);
      resolve({ ok: false, hash_verified: false, error: 'relay fetch timeout' });
    }, 8000);

    meshFetchListeners.set(dag_id, (payload: SidFetchResponsePayload) => {
      clearTimeout(timer);
      meshFetchListeners.delete(dag_id);
      if (!payload.found || !payload.node) {
        resolve({ ok: true, hash_verified: false, error: 'not found on peer' });
        return;
      }
      const recomputed = _recomputeDagId(payload.node);
      const hash_verified = recomputed === dag_id;
      if (!hash_verified) {
        console.error(`[MESH-6] relay SID hash mismatch: expected=${dag_id} got=${recomputed}`);
        resolve({ ok: false, hash_verified: false, error: 'SID hash mismatch ? rejected' });
        return;
      }
      resolve({ ok: true, node: payload.node as DagNode, hash_verified: true });
    });

    relayClient.sendToPeer(toPeerId, reqMsg);
  });
}

function _handleInboundMeshMsg(msg: FedMsg): void {
  if (msg.type === 'sid_fetch_request') {
    const payload = msg.payload as SidFetchRequestPayload;
    const node = _dagLookup(payload.dag_id);
    const response: FedMsg = {
      type: 'sid_fetch_response',
      peerId: getStablePeerId(),
      payload: {
        dag_id: payload.dag_id,
        found: !!node,
        node: node ?? undefined,
        holder_peer_id: getStablePeerId(),
      } satisfies SidFetchResponsePayload,
      ts: new Date().toISOString(),
    };
    if (relayClient?.isConnected()) {
      relayClient.sendToPeer(msg.peerId, response);
    }
  }

  if (msg.type === 'sid_fetch_response') {
    const payload = msg.payload as SidFetchResponsePayload;
    const listener = meshFetchListeners.get(payload.dag_id);
    if (listener) listener(payload);
  }

  if (msg.type === 'pointer_advance') {
    const payload = msg.payload as PointerAdvancePayload;
    if (payload.new_dag_id) {
      console.log(`[MESH-6] pointer_advance received: ${payload.old_dag_id} ? ${payload.new_dag_id} from ${payload.emitter_peer_id}`);
      _autoFetchOnPointerAdvance(payload).catch((e) =>
        console.warn('[MESH-6] auto-fetch on pointer_advance failed:', e),
      );
    }
  }

  // BP072: forward pair_* and assist_* to PairedFrameManager
  if (msg.type.startsWith('pair_') || msg.type.startsWith('assist_')) {
    pairedFrameManager?.handleInbound(msg);
  }

  // BP087 MAMBA-Row3: substrace wake receive + complete handler
  if (msg.type === 'substrace_wake') {
    const payload = msg.payload as {
      wake_id?: string;
      origin_peer_id?: string;
      manifest?: Array<{ type: 'pearl_id' | 'eblet_slug' | 'substrate_address'; ref: string }>;
    };
    if (Array.isArray(payload.manifest)) {
      handleSubstraceWakeReceive(payload.manifest, payload.wake_id, payload.origin_peer_id)
        .then(({ resolved_items }) => {
          console.log(
            `[MAMBA-Row3] substrace_wake handled wake_id=${payload.wake_id ?? 'unknown'} items=${resolved_items.length}`,
          );
        })
        .catch((err) => console.warn('[MAMBA-Row3] handleSubstraceWakeReceive error:', err));
    }
  }

  if (msg.type === 'substrace_wake_complete') {
    const payload = msg.payload as {
      wake_id?: string;
      resolved_items?: unknown[];
    };
    // MAMBA-Row3: substrace_wake_complete received wake_id={wake_id} items={N}
    console.log(
      `[MAMBA-Row3] substrace_wake_complete received wake_id=${payload.wake_id ?? 'unknown'} items=${Array.isArray(payload.resolved_items) ? payload.resolved_items.length : 0}`,
    );
  }
}

async function _autoFetchOnPointerAdvance(payload: PointerAdvancePayload): Promise<void> {
  const peer = peerDiscovery?.getAllPeers().find((p) => p.peerId === payload.emitter_peer_id);
  if (!peer) return;
  const reqMsg: FedMsg = {
    type: 'sid_fetch_request',
    peerId: getStablePeerId(),
    payload: {
      dag_id: payload.new_dag_id,
      requester_peer_id: getStablePeerId(),
    } satisfies SidFetchRequestPayload,
    ts: new Date().toISOString(),
  };
  const result = peer.transport === 'lan'
    ? await _fetchSidViaTCP(peer, payload.new_dag_id, reqMsg)
    : await _fetchSidViaRelay(payload.emitter_peer_id, payload.new_dag_id, reqMsg);

  if (result.ok && result.hash_verified && result.node) {
    const n = result.node;
    dag_soccerball_emit_reexport(n.pearls, n.bindings, n.faces);
    console.log(`[MESH-6] pointer_advance auto-replicated dag_id=${payload.new_dag_id} hash_verified=true`);
    _broadcastMeshStateChanged();
  } else {
    console.warn(`[MESH-6] pointer_advance auto-fetch failed: ok=${result.ok} hash_verified=${result.hash_verified} error=${result.error}`);
  }
}

function _emitPointerAdvanceToPeers(newDagId: string): void {
  if (!peerDiscovery) return;
  const peers = peerDiscovery.getAllPeers();
  if (peers.length === 0) return;

  const msg: FedMsg = {
    type: 'pointer_advance',
    peerId: getStablePeerId(),
    payload: {
      old_dag_id: null,
      new_dag_id: newDagId,
      pointer_label: 'local-dag-root',
      emitter_peer_id: getStablePeerId(),
      advanced_at: new Date().toISOString(),
    } satisfies PointerAdvancePayload,
    ts: new Date().toISOString(),
  };

  if (relayClient?.isConnected()) {
    for (const peer of peers.filter((p) => p.transport === 'wan-relay')) {
      relayClient.sendToPeer(peer.peerId, msg);
    }
  }
  for (const peer of peers.filter((p) => p.transport === 'lan')) {
    const { createConnection } = require('net') as typeof import('net');
    const socket = createConnection({ host: peer.address, port: peer.port, timeout: 2000 }, () => {
      socket.write(JSON.stringify(msg) + '\n');
      socket.end();
    });
    socket.on('error', () => {});
  }
}

// --- Monitor-safe bounds (multi-display; prevents off-screen window trap) -----

function getSafeBounds(bounds: Electron.Rectangle): Electron.Rectangle {
  const displays = screen.getAllDisplays();
  const onScreen = displays.some((d) => {
    const b = d.bounds;
    return (
      bounds.x < b.x + b.width &&
      bounds.x + bounds.width > b.x &&
      bounds.y < b.y + b.height &&
      bounds.y + bounds.height > b.y
    );
  });
  if (onScreen) return bounds;
  const primary = screen.getPrimaryDisplay();
  const w = primary.bounds;
  return {
    x: w.x + Math.floor((w.width - bounds.width) / 2),
    y: w.y + Math.floor((w.height - bounds.height) / 2),
    width: bounds.width,
    height: bounds.height,
  };
}

const MONEY_PENNY_BOUNDS_FILE = join(SUBSTRATE_ROOT_MAIN, 'moneypenny_window_bounds.json');
const MONEY_PENNY_MIN_WIDTH = 320;
const MONEY_PENNY_MIN_HEIGHT = 480;

// SEG-V0146-CRIT-3: Dashboard + Hearth Conjunction window bounds persistence
const DASHBOARD_BOUNDS_FILE = join(SUBSTRATE_ROOT_MAIN, 'dashboard_window_bounds.json');
const DASHBOARD_MIN_WIDTH = 560;
const DASHBOARD_MIN_HEIGHT = 600;
const HEARTH_BOUNDS_FILE = join(SUBSTRATE_ROOT_MAIN, 'hearth_window_bounds.json');
const HEARTH_MIN_WIDTH = 1280;
const HEARTH_MIN_HEIGHT = 800;

function clampMoneyPennyBounds(bounds?: Partial<Electron.Rectangle>): Electron.Rectangle {
  const workArea = screen.getDisplayMatching({
    x: bounds?.x ?? screen.getPrimaryDisplay().workArea.x,
    y: bounds?.y ?? screen.getPrimaryDisplay().workArea.y,
    width: bounds?.width ?? 1,
    height: bounds?.height ?? 1,
  }).workArea;
  // SEG-V0147-FIX-3: use 90% max width/height, 75% defaults to match computeScreenSafeBounds()
  const maxWidth = Math.floor(workArea.width * 0.9);
  const maxHeight = Math.floor(workArea.height * 0.9);
  const defaultWidth = Math.max(MONEY_PENNY_MIN_WIDTH, Math.min(maxWidth, Math.floor(workArea.width * 0.3)));
  const defaultHeight = Math.max(MONEY_PENNY_MIN_HEIGHT, Math.min(maxHeight, Math.floor(workArea.height * 0.75)));
  const width = Math.max(MONEY_PENNY_MIN_WIDTH, Math.min(maxWidth, Math.floor(bounds?.width ?? defaultWidth)));
  const height = Math.max(MONEY_PENNY_MIN_HEIGHT, Math.min(maxHeight, Math.floor(bounds?.height ?? defaultHeight)));
  const x = Math.max(workArea.x, Math.min(workArea.x + workArea.width - width, Math.floor(bounds?.x ?? workArea.x + (workArea.width - width) / 2)));
  // SEG-V0147-FIX-3: y must be >= 12.5% from top — never allow title bar into dead zone
  const minY = workArea.y + Math.floor(workArea.height * 0.125);
  const y = Math.max(minY, Math.min(workArea.y + workArea.height - height, Math.floor(bounds?.y ?? minY)));
  return getSafeBounds({ x, y, width, height });
}

function loadMoneyPennyBounds(): Electron.Rectangle {
  if (!existsSync(MONEY_PENNY_BOUNDS_FILE)) return clampMoneyPennyBounds();
  try {
    const parsed = JSON.parse(require('fs').readFileSync(MONEY_PENNY_BOUNDS_FILE, 'utf-8')) as Partial<Electron.Rectangle>;
    // SEG-V0147-FIX-3: stale-bounds guard — discard if y is in dead zone
    if (isStaleBounds(parsed)) return clampMoneyPennyBounds();
    return clampMoneyPennyBounds(parsed);
  } catch {
    return clampMoneyPennyBounds();
  }
}

function saveMoneyPennyBounds(bounds: Electron.Rectangle): void {
  try {
    require('fs').mkdirSync(SUBSTRATE_ROOT_MAIN, { recursive: true });
    require('fs').writeFileSync(MONEY_PENNY_BOUNDS_FILE, JSON.stringify(clampMoneyPennyBounds(bounds), null, 2), 'utf-8');
  } catch {
    // Non-fatal: window sizing should never block MoneyPenny.
  }
}

/**
 * SEG-V0147-FIX-3: Canonical screen-safe bounds for all BrowserWindows.
 * 75% height / 90% width / 12.5% top offset — ensures title bar is always visible
 * including on monitors with hardware dead zones at the top edge.
 */
function computeScreenSafeBounds(): Electron.Rectangle {
  const { workArea } = screen.getPrimaryDisplay();
  return {
    height: Math.floor(workArea.height * 0.75),
    width:  Math.floor(workArea.width  * 0.90),
    y:      workArea.y + Math.floor(workArea.height * 0.125),
    x:      workArea.x + Math.floor(workArea.width  * 0.05),
  };
}

/** SEG-V0147-FIX-3: Stale-bounds guard threshold — 10% from top of workArea. */
function isStaleBounds(bounds: Partial<Electron.Rectangle>): boolean {
  if (bounds.y === undefined) return false;
  const { workArea } = screen.getPrimaryDisplay();
  return bounds.y < workArea.y + Math.floor(workArea.height * 0.10);
}

// SEG-V0147-FIX-3: Dashboard bounds helpers (screen-aware sizing + persistence)
function computeDashboardDefaults(): Electron.Rectangle {
  const safe = computeScreenSafeBounds();
  return {
    width:  Math.max(DASHBOARD_MIN_WIDTH, safe.width),
    height: Math.max(DASHBOARD_MIN_HEIGHT, safe.height),
    x:      safe.x,
    y:      safe.y,
  };
}

function clampDashboardBounds(saved: Partial<Electron.Rectangle>): Electron.Rectangle {
  const { workArea } = screen.getPrimaryDisplay();
  const safe = computeScreenSafeBounds();
  const defaults = computeDashboardDefaults();
  const w = Math.max(DASHBOARD_MIN_WIDTH, Math.min(workArea.width - 40, saved.width ?? defaults.width));
  const h = Math.max(DASHBOARD_MIN_HEIGHT, Math.min(workArea.height - 40, saved.height ?? defaults.height));
  const x = Math.max(workArea.x, Math.min(workArea.x + workArea.width - w, saved.x ?? defaults.x));
  // SEG-V0147-FIX-3: y must be >= 12.5% from top — never allow title bar into dead zone
  const minY = workArea.y + Math.floor(workArea.height * 0.125);
  const y = Math.max(minY, Math.min(workArea.y + workArea.height - h, saved.y ?? safe.y));
  return getSafeBounds({ x, y, width: w, height: h });
}

function loadDashboardBounds(): Electron.Rectangle {
  if (!existsSync(DASHBOARD_BOUNDS_FILE)) return computeDashboardDefaults();
  try {
    const parsed = JSON.parse(readFileSync(DASHBOARD_BOUNDS_FILE, 'utf-8')) as Partial<Electron.Rectangle>;
    // SEG-V0147-FIX-3: stale-bounds guard — discard saved position if y is in dead zone
    if (isStaleBounds(parsed)) return computeDashboardDefaults();
    return clampDashboardBounds(parsed);
  } catch {
    return computeDashboardDefaults();
  }
}

function saveDashboardBounds(bounds: Electron.Rectangle): void {
  try {
    mkdirSync(SUBSTRATE_ROOT_MAIN, { recursive: true });
    writeFileSync(DASHBOARD_BOUNDS_FILE, JSON.stringify(bounds, null, 2), 'utf-8');
  } catch {}
}

// SEG-V0147-FIX-3: Hearth Conjunction bounds helpers
function computeHearthDefaults(): Electron.Rectangle {
  const safe = computeScreenSafeBounds();
  const { workArea } = screen.getPrimaryDisplay();
  const defaultW = Math.min(Math.max(HEARTH_MIN_WIDTH, safe.width), workArea.width - 40);
  const defaultH = Math.min(Math.max(HEARTH_MIN_HEIGHT, safe.height), workArea.height - 40);
  return {
    width:  defaultW,
    height: defaultH,
    x:      safe.x,
    y:      safe.y,
  };
}

function clampHearthBounds(saved: Partial<Electron.Rectangle>): Electron.Rectangle {
  const { workArea } = screen.getPrimaryDisplay();
  const safe = computeScreenSafeBounds();
  const defaults = computeHearthDefaults();
  const w = Math.max(HEARTH_MIN_WIDTH, Math.min(workArea.width - 40, saved.width ?? defaults.width));
  const h = Math.max(HEARTH_MIN_HEIGHT, Math.min(workArea.height - 40, saved.height ?? defaults.height));
  const x = Math.max(workArea.x, Math.min(workArea.x + workArea.width - w, saved.x ?? defaults.x));
  // SEG-V0147-FIX-3: y must be >= 12.5% from top — never allow title bar into dead zone
  const minY = workArea.y + Math.floor(workArea.height * 0.125);
  const y = Math.max(minY, Math.min(workArea.y + workArea.height - h, saved.y ?? safe.y));
  return getSafeBounds({ x, y, width: w, height: h });
}

function loadHearthBounds(): Electron.Rectangle {
  if (!existsSync(HEARTH_BOUNDS_FILE)) return computeHearthDefaults();
  try {
    const parsed = JSON.parse(readFileSync(HEARTH_BOUNDS_FILE, 'utf-8')) as Partial<Electron.Rectangle>;
    // SEG-V0147-FIX-3: stale-bounds guard — discard if y is in dead zone
    if (isStaleBounds(parsed)) return computeHearthDefaults();
    return clampHearthBounds(parsed);
  } catch {
    return computeHearthDefaults();
  }
}

function saveHearthBounds(bounds: Electron.Rectangle): void {
  try {
    mkdirSync(SUBSTRATE_ROOT_MAIN, { recursive: true });
    writeFileSync(HEARTH_BOUNDS_FILE, JSON.stringify(bounds, null, 2), 'utf-8');
  } catch {}
}

function stopOverlayWatchdog(): void {
  if (watchdogOverlayInterval) {
    clearInterval(watchdogOverlayInterval);
    watchdogOverlayInterval = null;
  }
}

function startOverlayWatchdog(win: BrowserWindow): void {
  stopOverlayWatchdog();
  rendererResponsive = true;
  watchdogOverlayInterval = setInterval(() => {
    if (!win || win.isDestroyed()) return;
    rendererResponsive = false;
    win.webContents.send('watchdog-ping');
    setTimeout(() => {
      if (!rendererResponsive && !win.isDestroyed()) {
        console.warn('[watchdog] renderer unresponsive ? force reload');
        win.webContents.reload();
      }
    }, 5000);
  }, 8000);
}

// --- LB overlay pointer policy (Electron) ------------------------------------
// Preload exposes setClickthrough(true) ? ignore mouse ? transparent hits forward to OS.

function applyLBFrameClickthrough(enabled: boolean): void {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  if (enabled) {
    overlayWindow.setIgnoreMouseEvents(true, { forward: true });
  } else {
    overlayWindow.setIgnoreMouseEvents(false);
  }
  if (IS_DEV) {
    console.log(`[LB Frame] passthrough-ignore-mouse=${enabled}`);
  }
}

// --- Frame Mode --------------------------------------------------------------

type FrameMode = 'ai_burst' | 'normal' | 'fallback';
let currentMode: FrameMode = 'normal';

function setMode(mode: FrameMode, broadcast = true): void {
  currentMode = mode;
  substrateServer?.setMode(mode);
  rebuildTrayMenu(mode);
  if (broadcast) {
    overlayWindow?.webContents.send('frame-mode-changed', { mode });
    dashboardWindow?.webContents.send('frame-mode-changed', { mode });
  }
}

function detectMode(context: {
  aiAvailable: boolean;
  substrateIndexAvailable: boolean;
  peerNodesAvailable: number;
  userBudgetRemaining?: number;
  forcedMode?: FrameMode | null;
}): FrameMode {
  // Forced mode always wins unless cleared
  if (context.forcedMode != null) return context.forcedMode;

  if (!context.aiAvailable || context.userBudgetRemaining === 0) {
    if (context.substrateIndexAvailable || context.peerNodesAvailable > 0) {
      return context.peerNodesAvailable > 0 ? 'fallback' : 'normal';
    }
    return 'fallback';
  }
  return 'ai_burst';
}

// --- Connectivity Polling -----------------------------------------------------

async function runConnectivityPoll(): Promise<void> {
  const aiAvailable = await ollamaManager.isReachable();
  const online = (await federationClient?.checkAndUpdateConnectivity()) ?? false;
  const peerCount = federationClient?.getStatus().peerCount ?? 0;

  const forcedMode = substrateServer?.getForcedMode() ?? null;

  // Only auto-transition if no forced mode is set
  if (forcedMode === null) {
    const detected = detectMode({
      aiAvailable,
      substrateIndexAvailable: true,
      peerNodesAvailable: peerCount,
      forcedMode: null,
    });

    if (detected !== currentMode) {
      console.log(`[Mode] Auto-transition: ${currentMode} ? ${detected} (ai=${aiAvailable} online=${online} peers=${peerCount})`);
      setMode(detected);
    }
  }
}

// --- Overlay Window ----------------------------------------------------------

function createOverlayWindow(): void {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const overlayBounds = getSafeBounds({ x: 0, y: 0, width, height });

  overlayWindow = new BrowserWindow({
    width: overlayBounds.width,
    height: overlayBounds.height,
    x: overlayBounds.x,
    y: overlayBounds.y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    focusable: false,
    show: false,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: true,
      zoomFactor: 1.15,
    },
  });

  // Inject CSP on every response ? strips unsafe-eval, eliminates Electron security warning.
  overlayWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [ACTIVE_CSP],
      },
    });
  });

  // Guarantee passthrough AFTER the compositor attaches (BP029 / LB-STACK-0157).
  overlayWindow.once('ready-to-show', () => {
    applyLBFrameClickthrough(true);
    overlayWindow?.showInactive();
  });
  overlayWindow.webContents.once('did-finish-load', () => {
    applyLBFrameClickthrough(true);
    // SEG-FIX-3 BP078: Runtime preload smoke test. Catches future sandbox-preload
    // regressions immediately at window creation, not when Founder clicks a button.
    overlayWindow?.webContents.executeJavaScript('typeof window.amplify').then((t) => {
      if (t === 'undefined') {
        console.error('[preload-smoke] FAIL overlayWindow: window.amplify is undefined ? preload bridge did not load');
      } else {
        console.log('[preload-smoke] OK overlayWindow: window.amplify is', t);
      }
    }).catch((e) => {
      console.error('[preload-smoke] overlayWindow probe threw:', e?.message ?? e);
    });
    // renderer_guard: probe after 8s grace ? log empty-root failures to health log.
    const win = overlayWindow;
    if (win) {
      probeRendererHealth(win, RENDERER_URL, 8000).then((result) => {
        if (!result.ok) {
          tray?.setToolTip(`MnemosyneC ? ? renderer boot failed (root empty)`);
        }
      }).catch(() => { /* probe errors never crash the app */ });
    }
  });
  overlayWindow.loadURL(RENDERER_URL);

  // BP041 ? DevTools auto-open opt-out per Founder direct (non-technical members
  // running `npm run dev` should not see DevTools by default). Set MNEMOSYNE_DEVTOOLS=1
  // in env to re-enable, OR press Ctrl+Shift+I at any time to open manually,
  // OR press Ctrl+Shift+D for the developer menu (commit 1b0fdc7 ?6).
  if (IS_DEV && process.env.MNEMOSYNE_DEVTOOLS === '1') {
    overlayWindow.webContents.openDevTools({ mode: 'detach' });
  }

  if (!displayMetricsListenerAttached) {
    displayMetricsListenerAttached = true;
    screen.on('display-metrics-changed', () => {
      if (!overlayWindow) return;
      const { width: w, height: h } = screen.getPrimaryDisplay().workAreaSize;
      const next = getSafeBounds({ x: 0, y: 0, width: w, height: h });
      overlayWindow.setBounds(next);
    });
  }

  overlayWindow.on('closed', () => {
    stopOverlayWatchdog();
    overlayWindow = null;
  });

  // Register with auto-updater and auth manager so events can be broadcast
  if (autoUpdater) autoUpdater.registerWindow(overlayWindow);
  if (authManager) authManager.registerWindow(overlayWindow);
  registerWindowForAutoUpdate(overlayWindow); // M21: scheduler notifications

  startOverlayWatchdog(overlayWindow);
}

// --- System Tray -------------------------------------------------------------

function createTray(): void {
  const iconPath = join(__dirname, '../../assets/tray-icon.png');
  let icon = existsSync(iconPath)
    ? nativeImage.createFromPath(iconPath)
    : nativeImage.createEmpty();
  if (!icon.isEmpty()) {
    icon = icon.resize({ width: 16, height: 16 });
  }

  tray = new Tray(icon);
  // KniPr026: versioned initial tooltip; updated by updateTrayTooltip() on update events.
  tray.setToolTip(`MnemosyneC v${app.getVersion()}`);
  // Single left-click opens Dashboard (right-click still shows context menu)
  tray.on('click', () => openDashboard());
  rebuildTrayMenu();
}

// KniPr026: refresh tray tooltip to reflect the current auto-update state.
// SEG-V0148-P0-GLANCE: also appends mesh progress suffix when a run is active.
function updateTrayTooltip(updateStatus?: UpdateState['status']): void {
  if (!tray || tray.isDestroyed()) return;
  const version = app.getVersion();
  const meshSuffix = substrateServer?.getMeshProgressSuffix() ?? null;
  const mesh = meshSuffix ? ` · ${meshSuffix}` : '';
  if (updateStatus === 'downloaded') {
    tray.setToolTip(`MnemosyneC v${version} · Update ready to install${mesh}`);
  } else if (updateStatus === 'available' || updateStatus === 'downloading') {
    tray.setToolTip(`MnemosyneC v${version} · Update available${mesh}`);
  } else {
    tray.setToolTip(`MnemosyneC v${version}${mesh}`);
  }
}

function rebuildTrayMenu(mode: FrameMode = currentMode): void {
  if (!tray) return;

  const modeLabel: Record<FrameMode, string> = {
    ai_burst: '?? AI Burst',
    normal: '?? Normal',
    fallback: '?? Fallback',
  };

  const forcedMode = substrateServer?.getForcedMode();
  const forcedLabel = forcedMode ? ` (forced)` : '';

  const contextMenu = Menu.buildFromTemplate([
    {
      label: `MnemosyneC ? ${modeLabel[mode]}${forcedLabel}`,
      enabled: false,
    },
    { type: 'separator' },
    {
      label: '?? AI Burst Mode',
      type: 'radio',
      checked: mode === 'ai_burst',
      click: () => {
        // SAGA-1 BP055: Burst Mode is the opt-in path that also surfaces the overlay.
        setMode('ai_burst');
        if (!overlayWindow) createOverlayWindow();
        overlayWindow?.showInactive();
      },
    },
    {
      label: '?? Normal Mode',
      type: 'radio',
      checked: mode === 'normal',
      click: () => setMode('normal'),
    },
    {
      label: '?? Fallback Mode',
      type: 'radio',
      checked: mode === 'fallback',
      click: () => setMode('fallback'),
    },
    { type: 'separator' },
    {
      label: forcedMode ? 'Clear Mode Override' : 'Auto-Detect Mode',
      click: () => {
        substrateServer?.setForcedMode(null);
        runConnectivityPoll();
      },
    },
    { type: 'separator' },
    {
      label: 'MnemosyneC Dashboard',
      click: () => openDashboard(),
    },
    {
      label: '? Open the Bridge',
      click: () => openHearthConjunctionWindow(),
    },
    {
      label: 'Settings',
      click: () => openDashboard(),
    },
    { type: 'separator' },
    {
      label: 'Check for Updates?',
      click: () => autoUpdater?.checkNow(),
    },
    {
      label: `MoneyPenny Mobile: ${getMoneyPennyURL(API_PORT)}`,
      click: () => openMoneyPennyWindow(),
    },
    {
      label: 'Open lianabanyan.com',
      click: () => shell.openExternal('https://lianabanyan.com'),
    },
    { type: 'separator' },
    {
      label: 'Hide Overlay',
      click: () => overlayWindow?.hide(),
    },
    {
      label: 'Show Overlay',
      click: () => {
        if (!overlayWindow) createOverlayWindow();
        overlayWindow?.showInactive();
      },
    },
    { type: 'separator' },
    {
      label: 'Send last copied as Q+A → MnemosyneC',
      click: () => {
        if (dashboardWindow && !dashboardWindow.isDestroyed()) {
          dashboardWindow.webContents.send('clipboard:capture-qa');
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit MnemosyneC',
      click: () => app.quit(),
    },
  ]);

  tray.setContextMenu(contextMenu);
}

// --- Dashboard Window ---------------------------------------------------------

function openMoneyPennyWindow(): void {
  if (moneyPennyWindow && !moneyPennyWindow.isDestroyed()) {
    moneyPennyWindow.focus();
    return;
  }

  const bounds = loadMoneyPennyBounds();
  const workArea = screen.getDisplayMatching(bounds).workArea;

  moneyPennyWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    minWidth: MONEY_PENNY_MIN_WIDTH,
    minHeight: MONEY_PENNY_MIN_HEIGHT,
    maxWidth: Math.floor(workArea.width * 0.9),
    maxHeight: Math.floor(workArea.height * 0.9),
    title: 'MoneyPenny ? MnemosyneC CAI Amplifier',
    icon: join(__dirname, '../../assets/app-icon.ico'),
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: true,
      zoomFactor: 1.15,
    },
  });

  moneyPennyWindow.once('ready-to-show', () => {
    moneyPennyWindow?.show();
  });

  moneyPennyWindow.on('resize', () => {
    if (moneyPennyWindow && !moneyPennyWindow.isDestroyed()) {
      saveMoneyPennyBounds(moneyPennyWindow.getBounds());
    }
  });
  moneyPennyWindow.on('move', () => {
    if (moneyPennyWindow && !moneyPennyWindow.isDestroyed()) {
      saveMoneyPennyBounds(moneyPennyWindow.getBounds());
    }
  });
  moneyPennyWindow.on('closed', () => {
    moneyPennyWindow = null;
  });

  moneyPennyWindow.loadURL(getMoneyPennyURL(API_PORT));
}

// A-4 BP081 v0.1.59.1: Onboarding gate auto-flip (Ollama healthy + Gemma present)
async function checkAndAutoFlipOnboarding(win: BrowserWindow): Promise<void> {
  try {
    const ollamaResponse = await fetch('http://127.0.0.1:11434/api/tags', {
      signal: AbortSignal.timeout(3000),
    }).catch(() => null);
    if (!ollamaResponse?.ok) return;

    const tagsData = (await ollamaResponse.json().catch(() => null)) as { models?: Array<{ name?: string }> } | null;
    const models: string[] = (tagsData?.models ?? []).map((m) => m.name ?? '');
    const hasGemma = models.some((name) => name.toLowerCase().includes('gemma'));
    if (!hasGemma) return;

    if (!win.isDestroyed()) {
      win.webContents.send('onboarding:auto-flip-check', { ollamaHealthy: true, gemmaPresent: true });
    }
  } catch {
    // Non-fatal — ignore
  }
}

function openDashboard(opts?: { focus?: boolean }): void {
  if (dashboardWindow && !dashboardWindow.isDestroyed()) {
    dashboardWindow.show();
    if (opts?.focus !== false) dashboardWindow.focus();
    return;
  }

  // SAGA 07 BP046B ? expanded for 6-tab MnemosyneTabView
  // SEG-V0146-CRIT-3: screen-aware sizing + persistence (fixes title bar off-screen on small monitors)
  const dashBounds = loadDashboardBounds();
  dashboardWindow = new BrowserWindow({
    width: dashBounds.width,
    height: dashBounds.height,
    x: dashBounds.x,
    y: dashBounds.y,
    minWidth: DASHBOARD_MIN_WIDTH,
    minHeight: DASHBOARD_MIN_HEIGHT,
    title: `MnemosyneC v${app.getVersion()}`,
    icon: join(__dirname, '../../assets/app-icon.ico'),
    show: false,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: true,
      zoomFactor: 1.15,
    },
  });

  dashboardWindow.once('ready-to-show', () => {
    dashboardWindow?.show();
    if (opts?.focus !== false) dashboardWindow?.focus();
  });

  dashboardWindow.on('resize', () => {
    if (dashboardWindow && !dashboardWindow.isDestroyed()) {
      saveDashboardBounds(dashboardWindow.getBounds());
    }
  });
  dashboardWindow.on('move', () => {
    if (dashboardWindow && !dashboardWindow.isDestroyed()) {
      saveDashboardBounds(dashboardWindow.getBounds());
    }
  });

  // Bug #2 v0.1.10: keep versioned title after any reload/navigation
  dashboardWindow.webContents.on('did-finish-load', () => {
    dashboardWindow?.setTitle(`MnemosyneC v${app.getVersion()}`);
    // SEG-FIX-3 BP078: Runtime preload smoke test.
    dashboardWindow?.webContents.executeJavaScript('typeof window.amplify').then((t) => {
      if (t === 'undefined') {
        console.error('[preload-smoke] FAIL dashboardWindow: window.amplify is undefined ? preload bridge did not load');
      } else {
        console.log('[preload-smoke] OK dashboardWindow: window.amplify is', t);
      }
    }).catch((e) => {
      console.error('[preload-smoke] dashboardWindow probe threw:', e?.message ?? e);
    });

    // A-3 BP081 v0.1.59.1: Send app version to renderer for stale-message pruning on upgrade
    dashboardWindow?.webContents.send('app:version-check', { version: app.getVersion() });

    // A-4 BP081 v0.1.59.1: Check Ollama health + Gemma presence for onboarding auto-flip
    void checkAndAutoFlipOnboarding(dashboardWindow!);
  });

  dashboardWindow.loadURL(
    IS_DEV
      ? 'http://127.0.0.1:5173/#/dashboard'
      : `file://${join(__dirname, '../renderer/index.html')}#/dashboard`,
  );

  dashboardWindow.on('closed', () => {
    dashboardWindow = null;
  });

  // SEG-Q-3 BP078: right-click on Windows title bar shows "Toggle Developer Tools"
  dashboardWindow.on('system-context-menu', (event, _point) => {
    event.preventDefault();
    const menu = Menu.buildFromTemplate([
      { label: 'Toggle Developer Tools', click: () => dashboardWindow?.webContents.toggleDevTools() },
      { type: 'separator' },
      { label: 'Reload', click: () => dashboardWindow?.webContents.reload() },
      { type: 'separator' },
      { label: 'Minimize', click: () => dashboardWindow?.minimize() },
      { label: 'Maximize / Restore', click: () => dashboardWindow?.isMaximized() ? dashboardWindow?.unmaximize() : dashboardWindow?.maximize() },
      { label: 'Close', click: () => dashboardWindow?.close() },
    ]);
    menu.popup({ window: dashboardWindow ?? undefined });
  });

  if (autoUpdater) autoUpdater.registerWindow(dashboardWindow);
  if (authManager) authManager.registerWindow(dashboardWindow);
  registerWindowForAutoUpdate(dashboardWindow); // M21
  if (folderWatcher && dashboardWindow) folderWatcher.setMainWindow(dashboardWindow);
}

function setupLanHandshakeDiscovery(): void {
  if (!peerDiscovery) return;
  const ownId = getStablePeerId();

  peerDiscovery.on('peer-discovered', (peer) => {
    if (peer.transport !== 'lan' || peer.peerId === ownId) return;
    if (!lanHandshakeEligible || lanHandshakePromptInFlight) return;

    const prefs = loadLanHandshakePrefs();
    if (prefs.neverAsk) return;
    if (prefs.connectedPeers?.includes(peer.peerId)) return;

    lanHandshakePromptInFlight = true;
    const hostname = peer.displayName || peer.address || peer.peerId.slice(0, 12);

    void dialog.showMessageBox({
      type: 'question',
      title: 'MnemosyneC on your network',
      message: `Found another MnemosyneC on your network: ${hostname}`,
      detail: 'Would you like to connect to it? (LOCAL-HANDSHAKE ? same house LAN)',
      buttons: ['Yes, connect', 'Not Now', 'Never Ask Again'],
      defaultId: 0,
      cancelId: 1,
    }).then((result) => {
      if (result.response === 0) {
        openDashboard({ focus: true });
        dashboardWindow?.webContents.send('federation:lan-peer-offer', peer);
        saveLanHandshakePrefs({
          ...prefs,
          connectedPeers: [...(prefs.connectedPeers ?? []), peer.peerId],
        });
      } else if (result.response === 2) {
        saveLanHandshakePrefs({ ...prefs, neverAsk: true });
      }
    }).finally(() => {
      lanHandshakePromptInFlight = false;
    });
  });
}

// --- Hearth Conjunction Window (B83) -----------------------------------------

function openHearthConjunctionWindow(): void {
  if (hearthConjunctionWindow && !hearthConjunctionWindow.isDestroyed()) {
    hearthConjunctionWindow.focus();
    return;
  }

  // SEG-V0146-CRIT-3: screen-aware sizing + persistence for Hearth Conjunction window
  const bounds = loadHearthBounds();

  // Webview preload path ? compiled from src/main/hearth/embedded_browser/webview_preload.ts
  const webviewPreloadPath = join(__dirname, 'hearth', 'embedded_browser', 'webview_preload.js');

  hearthConjunctionWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    title: 'MnemosyneC ? Memory, powered by CAI',
    icon: join(__dirname, '../../assets/app-icon.ico'),
    minWidth: HEARTH_MIN_WIDTH,
    minHeight: HEARTH_MIN_HEIGHT,
    show: false,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true, // B83b: enable <webview> for EmbeddedChrome
      devTools: true,
      zoomFactor: 1.15,
    },
  });

  hearthConjunctionWindow.once('ready-to-show', () => {
    hearthConjunctionWindow?.show();
  });

  hearthConjunctionWindow.on('resize', () => {
    if (hearthConjunctionWindow && !hearthConjunctionWindow.isDestroyed()) {
      saveHearthBounds(hearthConjunctionWindow.getBounds());
    }
  });
  hearthConjunctionWindow.on('move', () => {
    if (hearthConjunctionWindow && !hearthConjunctionWindow.isDestroyed()) {
      saveHearthBounds(hearthConjunctionWindow.getBounds());
    }
  });

  // SEG-FIX-3 BP078: Runtime preload smoke test for hearthConjunctionWindow.
  hearthConjunctionWindow.webContents.once('did-finish-load', () => {
    hearthConjunctionWindow?.webContents.executeJavaScript('typeof window.amplify').then((t) => {
      if (t === 'undefined') {
        console.error('[preload-smoke] FAIL hearthConjunctionWindow: window.amplify is undefined ? preload bridge did not load');
      } else {
        console.log('[preload-smoke] OK hearthConjunctionWindow: window.amplify is', t);
      }
    }).catch((e) => {
      console.error('[preload-smoke] hearthConjunctionWindow probe threw:', e?.message ?? e);
    });
  });

  hearthConjunctionWindow.loadURL(
    IS_DEV
      ? 'http://localhost:5173/#/hearth-conjunction'
      : `file://${join(__dirname, '../renderer/index.html')}#/hearth-conjunction`,
  );

  hearthConjunctionWindow.on('closed', () => {
    hearthConjunctionWindow = null;
  });

  // SEG-Q-3 BP078: right-click on Windows title bar shows "Toggle Developer Tools"
  hearthConjunctionWindow.on('system-context-menu', (event, _point) => {
    event.preventDefault();
    const menu = Menu.buildFromTemplate([
      { label: 'Toggle Developer Tools', click: () => hearthConjunctionWindow?.webContents.toggleDevTools() },
      { type: 'separator' },
      { label: 'Reload', click: () => hearthConjunctionWindow?.webContents.reload() },
      { type: 'separator' },
      { label: 'Minimize', click: () => hearthConjunctionWindow?.minimize() },
      { label: 'Close', click: () => hearthConjunctionWindow?.close() },
    ]);
    menu.popup({ window: hearthConjunctionWindow ?? undefined });
  });

  // Store webview preload path for IPC response
  ;(hearthConjunctionWindow as unknown as { _webviewPreloadPath: string })._webviewPreloadPath = webviewPreloadPath;

  if (autoUpdater) autoUpdater.registerWindow(hearthConjunctionWindow);
  if (authManager) authManager.registerWindow(hearthConjunctionWindow);
  registerWindowForAutoUpdate(hearthConjunctionWindow); // M21
}

// BP137 Yoke v2b Integration-1 Part 2: the real main<->renderer IPC leg
// browser_authority_adapter.ts's file header names as genuinely ABSENT ("a MAIN-PROCESS caller
// ... has no IPC path to invoke this renderer-side method yet"). This function is that leg's
// live implementation.
//
// R-MECHANISM-VERIFY / honest scope note: HearthConjunctionWindow.tsx and EmbeddedChrome.tsx are
// NOT in this Yoke's file-ownership list (only index.ts + preload.ts + plow_mc_answerer.ts's
// lookup_fact branch are) and are therefore untouched this pass -- HearthConjunctionWindow.tsx
// still never passes EmbeddedChrome.tsx's onBrowserAuthorityBridgeReady prop, so
// EmbeddedChrome's OWN runBrowserAuthorityQuery()/pendingBrowserAuthorityRef bridge stays dormant
// (never announced, never invoked) exactly as it is today. Rather than wait on that separate
// wiring, this function reaches the SAME live <webview> DOM element a code-path-independent way:
// hearthConjunctionWindow.webContents.executeJavaScript() -- the exact mechanism this file's own
// SEG-FIX-3 BP078 preload-smoke-test above already uses to probe window.amplify -- runs a small
// script directly in that window's page context. The script finds the one <webview> element
// EmbeddedChrome.tsx renders (document.querySelector('webview'); confirmed by direct read there
// is exactly one) and drives it through the same navigate -> wait-for-load -> wv.send('browser-
// authority-run-query', ...) -> wait-for-'browser-authority-extraction-result' sequence
// EmbeddedChrome.tsx's own dormant runBrowserAuthorityQuery() implements against
// webview_preload.ts's existing (already-wired) 'browser-authority-run-query' listener -- this
// function never duplicates THAT DOM-scraping logic, only the plumbing to reach it. Both this
// function's injected 'ipc-message' listener and EmbeddedChrome's own dormant one can coexist on
// the same <webview> node without conflict (DOM elements support multiple independent listeners
// per event; EmbeddedChrome's fires a no-op today because pendingBrowserAuthorityRef.current is
// always null while its bridge is never announced).
//
// HONEST NULL PATHS (never fabricate a result -- this Yoke's honesty-firewall requirement):
//   1. researchArmBrowserAuthority flag off (or its AND-gated researchArmMode partner) ->
//      ensureNexusAuthoritySession() returns null immediately, no BrowserWindow/session-
//      partition ever touched, no executeJavaScript call -- see build item 1's flag-gate.
//   2. Persistent session window exists but its <webview> hasn't loaded yet / genuinely errors
//      -> the injected script's own querySelector/timeout paths resolve null exactly as before.
//   3. <webview> present but extraction genuinely fails or times out (selector miss on Google's/
//      Perplexity's rendered page, or no reply within BROWSER_AUTHORITY_MAIN_TIMEOUT_MS) -> null.
//   4. A browser-authority call is already in flight against the one shared webview -> this call
//      resolves null immediately rather than queuing or clobbering the in-flight call's listeners
//      (same "out of scope this pass" choice EmbeddedChrome.tsx's own dormant bridge documents).
//   5. BP137 0.9.12 Stage F1 build item 4 (honesty firewall): the requested authority is not
//      signed in (per probeNexusAuthoritySignInStatus()'s cheap DOM marker probe) -> null,
//      WITHOUT ever attempting the scrape against a logged-out/lower-quality session.
// Every one of these is indistinguishable, to the caller, from "browser authority unavailable" --
// exactly the createNotWiredBridge() contract browser_authority_adapter.ts already documents.
// NOTE (side effect, stated honestly): a successful call DOES navigate the persistent session's
// live webview to a Google/Perplexity search-results page for the question -- this is the
// designed behavior (the whole point is driving the user's own logged-in session), not an
// accidental side effect. As of Stage F1 this surface is a HIDDEN window by default (build item
// 1), so this navigation is normally invisible; it is only visible if the human has the
// Settings "Authorities" sign-in window open at the same moment a lookup fires.
//
// BP137 0.9.12 Stage F1 REPOINT (build item 2): this function used to target
// hearthConjunctionWindow (the visible Hearth Conjunction window's embedded <webview>), which
// only existed while a human had that window open with the Browser tab active -- the exact gap
// 0.9.11's live mesh receipt measured (0 of 20 browser-authority attempts fired headlessly).
// It now targets ensureNexusAuthoritySession()'s always-alive hidden window instead, so this
// works with ZERO visible Browser tab / Hearth Conjunction window open. hearthConjunctionWindow
// itself, and everything else in openHearthConjunctionWindow() above, is completely untouched.
const BROWSER_AUTHORITY_MAIN_TIMEOUT_MS = 20_000;
// BP138 Yoke 0.9.15 FIX 2: raised from 1200ms -- live CDP verification (prior session) showed
// Google's/Perplexity's answer DOM can still be populating client-side JS at 1200ms post-load
// on a real network, producing a spurious selector-miss. 2500ms is cheap insurance relative to
// the 20s overall timeout above, and is paired with ONE retry-scrape (BROWSER_AUTHORITY_RETRY_
// DELAY_MS below) rather than a single-shot extraction attempt.
const BROWSER_AUTHORITY_MAIN_SETTLE_DELAY_MS = 2_500;
// BP138 Yoke 0.9.15 FIX 2: additive retry-scrape wait. When the first extraction attempt
// reports success:false (selector miss / page not fully settled), the script below re-sends
// 'browser-authority-run-query' to the SAME already-loaded page once, after this extra wait,
// before giving up -- still well inside BROWSER_AUTHORITY_MAIN_TIMEOUT_MS's 20s budget.
const BROWSER_AUTHORITY_RETRY_DELAY_MS = 1_500;
// (this build pass) claude.ai/new streams its reply -- a real answer can easily take longer than
// the 20s BROWSER_AUTHORITY_MAIN_TIMEOUT_MS budget above (which was sized for a near-instant
// static DOM scrape of an already-rendered Google/Perplexity results page). This is a SEPARATE,
// longer budget used ONLY for isInteractiveBrowserAuthority() authorities -- it does not change
// BROWSER_AUTHORITY_MAIN_TIMEOUT_MS's value or meaning for user_google/user_perplexity at all.
//
// (this fix pass) FAST-FAIL ROOT CAUSE FIX: a live run showed ONE question taking 123s because
// this budget was 90_000ms and webview_preload.ts's inner reply-poll budget was 75_000ms -- a page
// where the composer catch-all selector matched something other than the real composer (e.g. a
// login wall) would type/submit into the wrong element and then poll for a reply that could never
// arrive, burning nearly the full 90s before honestly reporting null. Cut 90_000 -> 25_000, paired
// with webview_preload.ts's new composer-find fast-fail (~3s) and shortened reply-poll budget
// (75_000 -> 18_000ms): worst-case total is now ~2s (load-settle below) + 3s (composer find) +
// 0.4s (submit settle) + 18s (reply poll) = ~23.4s of INNER budget, so this 25s OUTER cap is a
// safety net around that, not the expected duration -- a composer-not-found or not-signed-in page
// now reports back in ~2-5s, and a genuinely completed answer returns as soon as it stabilizes,
// not after the budget is exhausted.
const BROWSER_AUTHORITY_INTERACTIVE_TIMEOUT_MS = 25_000;
// Extra settle delay after did-finish-load before the composer is even looked up -- claude.ai's
// own client-side app shell needs a moment to mount past the raw HTML load event, same rationale
// as BROWSER_AUTHORITY_MAIN_SETTLE_DELAY_MS above but tuned separately since this is a different
// (heavier, client-rendered) page than a search-results page.
const BROWSER_AUTHORITY_INTERACTIVE_LOAD_SETTLE_DELAY_MS = 2_000;
// BP139: module-level chain used to SERIALIZE concurrent runBrowserAuthorityQueryFromMain() calls
// against the one shared webview, instead of the prior single-flight-drop behavior (a second call
// arriving while the first was still running used to resolve null immediately -- see this
// function's header comment below for the full root-cause). Every link chained onto this promise
// is itself bounded by BROWSER_AUTHORITY_MAIN_TIMEOUT_MS (20s, enforced inside runOnce() below),
// so no single hung call can deadlock the queue forever: each link always settles within that
// bound and the chain always advances to the next queued caller.
let browserAuthorityInFlightChain: Promise<unknown> = Promise.resolve();

// D-BP152-030R: what the shared nexus <webview> currently has live, per decideNexusThreadContinuation
// (browser_authority_types.ts). null means "nothing tracked" -- either no interactive query has
// run yet, or the last thing that ran was a static (Google/Perplexity) query, or the caller never
// supplied a threadId. Read/written ONLY inside runOnceObserved below, which is itself always
// serialized onto browserAuthorityInFlightChain (one call to the shared webview at a time), so no
// lock is needed here beyond that existing serialization.
let nexusLiveThread: NexusLiveThreadState | null = null;

// BP139 root-cause (prior SEG diagnosis, verdict c): the old `browserAuthorityMainCallInFlight`
// boolean guard made a second/third concurrent call resolve null IMMEDIATELY instead of waiting
// its turn, silently dropping legitimate lookups (observed live: 3 rapid-fire Ask-tab questions,
// the 3rd got no source while the first two -- which didn't overlap another in-flight call -- did).
// Fix: queue instead of drop. See browserAuthorityInFlightChain above.
// (this build pass) claude.ai/new interactive driver -- the type->submit->wait-for-stream->
// scrape leg GOAL/STEP 3 of this pass adds. Reaches the SAME shared <webview> element the static
// script above drives (document.querySelector('webview') inside the persistent nexus-authority
// window's page context), but instead of the single quick 'browser-authority-run-query' round
// trip, it navigates to the fixed https://claude.ai/new landing page and sends
// 'browser-authority-run-interactive-query' -- webview_preload.ts's new handler for that channel
// does the actual composer-typing/submit/stream-completion-detection/scrape entirely inside the
// guest page (see that file's own header for the full mechanism and its selector list).
//
// HONEST NULL PATHS (same firewall as the static path above -- never fabricate a result):
//   1. No <webview> element found in the persistent window's page -> null.
//   2. Navigation to claude.ai/new never fires 'did-finish-load' within
//      BROWSER_AUTHORITY_INTERACTIVE_TIMEOUT_MS -> null (composer never even looked up).
//   3. Composer not found, typing failed, or submit failed (webview_preload.ts's own honesty
//      checks) -> the 'browser-authority-interactive-result' message itself carries
//      success:false/no snippet, which this function passes through as null.
//   4. Assistant reply never stabilizes / times out with zero text observed -> success:false from
//      the same source, -> null here.
// A genuinely scraped, non-empty reply is the ONLY path that reaches a real
// BrowserAuthorityRawExtraction return below.
// KN-BP144-7 T1/T2: the dispatch-level observation this leg reports back to
// runBrowserAuthorityQueryFromMainObserved -- ADDITIVE, never consulted by any resolve() above
// (those are unchanged, byte-for-byte). `raw` is exactly what this function always returned;
// `dispatchOutcome` is a new, honest classification of WHY `raw` is null, derived solely from
// the SAME `r.reason`/`r.success` values this function already computed above -- never a guess,
// never inferred from anything downstream.
interface BrowserAuthorityDispatchObservation {
  raw: BrowserAuthorityRawExtraction | null;
  dispatchOutcome: BrowserAuthorityDispatchOutcome;
  /** D-BP152-050/BISHOP/seg-honest-failure-reasons, ADDITIVE/OPTIONAL -- true only when the
   *  static (Google/Perplexity) branch's own structural URL check (webview_preload.ts's
   *  isGoogleChallengeUrl(), via the `r.challenge` field on its extraction-result message)
   *  identified the landed page as a verification/rate-limit challenge. Deliberately NOT folded
   *  into `dispatchOutcome`'s closed vocabulary above -- see that field's own header. Absent
   *  (never false) everywhere this check does not run (the interactive branch, or a genuine
   *  extraction). Read only by buildLianaAskGoogle() below and, through it,
   *  comparative_cascade.ts's googleBlocks(). */
  challengeDetected?: boolean;
}

/** T2's own literal example vocabulary for the interactive path's `reason` field
 *  (not_signed_in / composer_not_found_timeout / outer_script_timeout / stream_timeout_or_empty
 *  / empty_ipc_payload / webview_send_failed / no_webview_element / outer_script_exception) --
 *  mapped onto the closed 5-value dispatch vocabulary. 'not_signed_in' is the one reason string
 *  that IS itself a vocabulary word (webview_preload.ts's own login-wall detector). The three
 *  reasons that are genuinely about exceeding a time budget (outer_script_timeout,
 *  stream_timeout_or_empty, composer_not_found_timeout -- the last is a fast-fail composer-find
 *  window, still a window exceeded with nothing returned) map to 'timeout'. Every other
 *  technical dispatch failure (no webview element, empty IPC payload, send failed, an exception
 *  in the outer script, or no reason reported at all) maps to 'no_result' -- "asked, returned
 *  successfully [no hard timeout], produced nothing usable" is the honest, literal description
 *  of each of those, never a fabricated finer distinction this leg cannot actually observe. */
function classifyInteractiveDispatchReason(reason: string | undefined): BrowserAuthorityDispatchOutcome {
  if (reason === 'not_signed_in') return 'not_signed_in';
  if (reason === 'outer_script_timeout' || reason === 'stream_timeout_or_empty' || reason === 'composer_not_found_timeout') return 'timeout';
  return 'no_result';
}

// D-BP152-030R: same "additional settle before doing anything" rationale as
// BROWSER_AUTHORITY_INTERACTIVE_LOAD_SETTLE_DELAY_MS above, reused (not a new invented
// magnitude) for the CONTINUING branch below -- there is no did-finish-load event to hang the
// send off of when no navigation happens, so the send is deferred one macrotask via setTimeout
// with the same constant rather than firing perfectly synchronously.
async function runInteractiveBrowserAuthorityQueryObserved(
  nexusWindow: BrowserWindow,
  query: BrowserAuthorityQuery,
  threadDecision: NexusThreadDecision,
): Promise<BrowserAuthorityDispatchObservation> {
  const navigateUrl = buildBrowserAuthorityQueryUrl(query); // fixed landing URL for interactive authorities
  // The question (with its MC options, if any) travels as the COMPOSER payload, not the URL --
  // buildMcAwareQueryText is the SAME pure formatter user_perplexity's query-URL path already
  // uses (browser_authority_types.ts), just applied to the interactive payload instead of a URL
  // component here.
  const promptText =
    query.mcOptions && query.mcOptions.length > 0
      ? buildMcAwareQueryText(query.question, query.mcOptions)
      : query.question;

  // BP140-K4: this main-process log prefix must track whichever interactive authority is
  // actually running, not a hardcoded 'claude_interactive' -- ChatGPT/Gemini now share this same
  // outer script, and their own console evidence must read 'chatgpt_interactive:'/
  // 'gemini_interactive:' per this build's spec, not a misleading 'claude_interactive:' label.
  const logPrefix =
    query.authority === 'user_chatgpt' ? 'chatgpt_interactive'
      : query.authority === 'user_gemini' ? 'gemini_interactive'
        : 'claude_interactive';

  // (this fix pass) STEP 3 diagnostics: every resolve() below now carries a `reason` string
  // instead of a bare `null`, so the catch below can print WHY the outer script gave up (no
  // webview found / navigation never loaded / send failed / outer timeout) with the SAME
  // `${logPrefix}:` prefix webview_preload.ts's own stage logs use, in the console stream this
  // main process actually writes to (not the guest webview's own devtools console, which this
  // outer script does NOT run in -- it runs in nexusWindow's page context).
  // D-BP152-030R: CONTINUING branch -- deliberately NO wv.loadURL / no did-finish-load wait.
  // The shared webview already has THIS SAME authority's live conversation loaded (guaranteed by
  // decideNexusThreadContinuation's exact authority+threadId match, computed by the caller
  // BEFORE this function runs); navigating again would start a fresh chat, which is exactly the
  // one-shot behavior this branch exists to avoid. Sends directly into the already-mounted
  // composer after one deferred tick. Every reason string, the timeout budget, and the
  // ipc-message handling are byte-identical to the FRESH branch below -- only the
  // navigate-and-wait-for-load prelude is removed.
  const continuingScript = `
    (function() {
      return new Promise(function(resolve) {
        try {
          var wv = document.querySelector('webview');
          if (!wv) { resolve({ success: false, reason: 'no_webview_element' }); return; }
          var settled = false;
          var timeoutId = setTimeout(function() {
            if (settled) return;
            settled = true;
            wv.removeEventListener('ipc-message', onMsg);
            resolve({ success: false, reason: 'outer_script_timeout' });
          }, ${BROWSER_AUTHORITY_INTERACTIVE_TIMEOUT_MS});
          function onMsg(e) {
            if (!e || e.channel !== 'browser-authority-interactive-result') return;
            if (settled) return;
            settled = true;
            clearTimeout(timeoutId);
            wv.removeEventListener('ipc-message', onMsg);
            var payload = e.args && e.args[0] ? e.args[0] : null;
            resolve(payload || { success: false, reason: 'empty_ipc_payload' }); // honest pass-through
          }
          wv.addEventListener('ipc-message', onMsg);
          setTimeout(function() {
            try {
              wv.send('browser-authority-run-interactive-query', { query: ${JSON.stringify(promptText)}, authority: ${JSON.stringify(query.authority)} });
            } catch (sendErr) {
              if (!settled) { settled = true; clearTimeout(timeoutId); resolve({ success: false, reason: 'webview_send_failed' }); }
            }
          }, ${BROWSER_AUTHORITY_INTERACTIVE_LOAD_SETTLE_DELAY_MS});
        } catch (err) {
          resolve({ success: false, reason: 'outer_script_exception' });
        }
      });
    })()
  `;

  // FRESH branch -- byte-identical to this function's pre-existing (pre-threading) behavior:
  // always navigates to the authority's landing URL first. Used both for a genuinely new
  // question AND for any mismatched continuation request (decideNexusThreadContinuation's
  // "never trust a mismatch" rule) -- a full navigation is what guarantees no DOM/JS state from
  // a prior question survives.
  const freshScript = `
    (function() {
      return new Promise(function(resolve) {
        try {
          var wv = document.querySelector('webview');
          if (!wv) { resolve({ success: false, reason: 'no_webview_element' }); return; }
          var settled = false;
          var timeoutId = setTimeout(function() {
            if (settled) return;
            settled = true;
            wv.removeEventListener('ipc-message', onMsg);
            wv.removeEventListener('did-finish-load', onLoad);
            resolve({ success: false, reason: 'outer_script_timeout' });
          }, ${BROWSER_AUTHORITY_INTERACTIVE_TIMEOUT_MS});
          function onMsg(e) {
            if (!e || e.channel !== 'browser-authority-interactive-result') return;
            if (settled) return;
            settled = true;
            clearTimeout(timeoutId);
            wv.removeEventListener('ipc-message', onMsg);
            wv.removeEventListener('did-finish-load', onLoad);
            var payload = e.args && e.args[0] ? e.args[0] : null;
            resolve(payload || { success: false, reason: 'empty_ipc_payload' }); // honest pass-through
          }
          function onLoad() {
            wv.removeEventListener('did-finish-load', onLoad);
            setTimeout(function() {
              try {
                wv.send('browser-authority-run-interactive-query', { query: ${JSON.stringify(promptText)}, authority: ${JSON.stringify(query.authority)} });
              } catch (sendErr) {
                if (!settled) { settled = true; clearTimeout(timeoutId); resolve({ success: false, reason: 'webview_send_failed' }); }
              }
            }, ${BROWSER_AUTHORITY_INTERACTIVE_LOAD_SETTLE_DELAY_MS});
          }
          wv.addEventListener('ipc-message', onMsg);
          wv.addEventListener('did-finish-load', onLoad);
          wv.loadURL(${JSON.stringify(navigateUrl)});
        } catch (err) {
          resolve({ success: false, reason: 'outer_script_exception' });
        }
      });
    })()
  `;

  const script = threadDecision.continuing ? continuingScript : freshScript;

  // D-BP152-030R: the navigation decision (or its absence) has already happened, or is about to
  // happen, inside the script this call is about to execute -- the shared webview's real page
  // state is determined by THAT, not by whether the scrape below succeeds. Apply the state
  // transition now (unconditionally, before we know success/failure) so a caller that retries
  // after a timeout/no_result on the SAME threadId still correctly sees "continuing" next time
  // rather than the machine believing a page reload happened when it did not.
  nexusLiveThread = threadDecision.nextState;
  console.log(
    `${logPrefix}: PARSER INSTRUMENT [nexus-thread] threadId=${query.threadId ?? '(none)'} ` +
    `status=${threadDecision.threadStatus} position=${threadDecision.threadPosition ?? 'n/a'} ` +
    `continuing=${threadDecision.continuing}`,
  );

  try {
    const result = await nexusWindow.webContents.executeJavaScript(script);
    if (!result || typeof result !== 'object') {
      console.log(`${logPrefix}: main-null-result (executeJavaScript returned no object)`);
      return { raw: null, dispatchOutcome: 'no_result' };
    }
    const r = result as {
      success?: boolean; snippet?: string; sourceUrl?: string | null; selectorUsed?: string | null; reason?: string;
      // BP149 D-BP149-016 (R4 repair): BrowserAuthorityInteractiveResultMessage
      // (webview_preload.ts) has carried `citations` since KN-BP145-B -- same previously-unnamed,
      // dropped-on-the-floor field as the static path above. No `results` here: the interactive
      // authorities' single-message thread has no independent multi-candidate structure (per
      // webview_preload.ts's extractMultiResultCandidates() dispatch, which returns [] for all
      // three of them).
      citations?: import('../shared/plow/browser_authority_types').CitationRecord[];
    };
    if (!r.success || !r.snippet || !r.sourceUrl) {
      // honest -- never a partial/fabricated extraction; log WHY so the next run's console tells
      // us exactly which stage failed (composer_not_found_timeout / not_signed_in / outer_script_
      // timeout / stream_timeout_or_empty / etc.)
      console.log(`${logPrefix}: main-fail reason=${r.reason ?? 'no_reason_reported'}`);
      return { raw: null, dispatchOutcome: classifyInteractiveDispatchReason(r.reason) };
    }
    console.log(`${logPrefix}: main-success scraped-len=${r.snippet.length}`);
    return {
      raw: {
        snippet: r.snippet,
        sourceUrl: r.sourceUrl,
        authority: query.authority,
        selectorUsed: r.selectorUsed ?? null,
        // BP149 D-BP149-016: carried through now instead of discarded.
        citations: r.citations ?? [],
        // D-BP152-030R: additive, both present or both absent together -- absent whenever no
        // threadId was supplied (an untracked, legacy-shaped call has no position to report).
        ...(threadDecision.threadPosition !== null
          ? { threadStatus: threadDecision.threadStatus, threadPosition: threadDecision.threadPosition }
          : {}),
      },
      dispatchOutcome: 'dispatched',
    };
  } catch (err) {
    console.warn(`${logPrefix}: main-exception (non-fatal, resolving null):`, (err as Error)?.message ?? err);
    return { raw: null, dispatchOutcome: 'no_result' };
  }
}

// KN-BP144-7 T1: "one shared wrapper... or the states will diverge the way the four authority
// surfaces diverged." This is that wrapper -- the ONE place that observes every
// runBrowserAuthorityQueryFromMain attempt (interactive AND static, all five browser
// authorities alike, since every one of them funnels through here) and classifies it into the
// closed dispatch vocabulary. runBrowserAuthorityQueryFromMain (below) is now a thin,
// byte-identical-behavior wrapper around this function that discards the observation and
// returns exactly what it always returned -- every pre-existing caller (Stage F3 mesh-synergy,
// decompose, the eliminator, the Ask-tab lookup, etc.) is untouched.
export async function runBrowserAuthorityQueryFromMainObserved(
  query: BrowserAuthorityQuery,
): Promise<BrowserAuthorityDispatchObservation> {
  // D-BP151-037/BISHOP/seg-query-capture-archive: this is the ONE chokepoint every
  // askGoogle-shaped call funnels through (see this function's own header comment above,
  // "one shared wrapper... every runBrowserAuthorityQueryFromMain attempt"), so capturing here
  // covers every caller (Liana Cycle, the Ask-tab lookup, mesh-synergy, decompose, the
  // eliminator, the direct IPC handler) with one instrumentation point rather than one per
  // call site. Fire-and-forget: captureQuery() internally checks the Substrate Processing
  // switch FIRST (query_capture_settings.ts's isQueryCaptureEnabled()) and writes nothing at
  // all when it is off (the default) -- this line never blocks, never throws into the real
  // dispatch below, and never logs the question text (captureQuery's own contract). No
  // console output is added here -- see query_capture_settings.ts's header for why even a
  // diagnostic log line is out of bounds for anything touching this switch.
  try { captureQuery({ question: query.question, source: 'ask_google', authority: query.authority }); } catch { /* never blocks the real dispatch */ }
  const runOnceObserved = async (): Promise<BrowserAuthorityDispatchObservation> => {
    const nexusWindow = ensureNexusAuthoritySession();
    if (!nexusWindow) {
      console.warn('[browser-authority-main] persistent nexus-authority session unavailable (flag off, or window could not be created) -- resolving null (honest, never fabricated).');
      return { raw: null, dispatchOutcome: 'disabled' };
    }

    // D-BP152-030R: computed BEFORE the sign-in probe below, because the probe itself navigates
    // the shared webview (see the next comment block) -- if this call is a verified CONTINUATION
    // of an already-live conversation, running the probe would silently destroy the very thread
    // this function exists to preserve, before the interactive branch even runs.
    const threadDecision = decideNexusThreadContinuation(query, nexusLiveThread);

    // BP139 FIX: the marker-based sign-in probe produces FALSE NEGATIVES, confirmed live -- the
    // Proof panel showed "Not signed in: Perplexity (no-marker-found)" while the SAME authority
    // returned a real, sourced answer ("The Berlin Wall fell in 1989", perplexity.ai/search/...)
    // seconds later. The probe navigates the target webview and checks fragile, timing-sensitive
    // DOM markers, so gating the query on it silently DROPPED real signed-in queries (this was the
    // 2-of-5 benchmark inconsistency). The query's own extraction is the honest arbiter: a real
    // logged-in result page yields a real extracted answer (used); a logged-out/empty page yields
    // no extraction and returns null at the end of this function anyway. So the probe is now
    // ADVISORY (logged for diagnosis, never blocking) -- no fabrication risk, since only a genuine
    // extracted answer is ever returned.
    // D-BP152-030R: SKIPPED when continuing a live thread -- probeNexusAuthoritySignInStatus()
    // (nexus_authority_persistent_session.ts) unconditionally navigates its target <webview> to
    // the authority's landing page before its DOM check runs (MEASURED this pass, that file's
    // own `wv.loadURL(url)` call). Running it here would erase the live conversation this exact
    // call is trying to continue. Safe to skip: a thread only reaches `continuing: true` after at
    // least one prior dispatch on this same authority already ran (a signed-out session could
    // never have produced a live composer to continue from in the first place), so the probe has
    // nothing new to tell us on a continuation.
    //
    // D-BP152-048/BISHOP/seg-webview-collision: only interactive authorities (Claude/ChatGPT/
    // Gemini) still probe the OPERATOR's shared window -- that branch below still runs against it
    // (untouched by this ticket). Static authorities (Google/Perplexity, the two askGoogle-shaped
    // callers use) now probe the dedicated machine-query window instead
    // (ensureNexusMachineQuerySession(), same partition/cookies, separate instance -- see that
    // function's own header for the measured collision this closes), so this probe can no longer
    // navigate whatever surface the operator has the shared window open on.
    const isInteractive = isInteractiveBrowserAuthority(query.authority);
    if (!threadDecision.continuing) {
      const signInStatus = await probeNexusAuthoritySignInStatus(
        query.authority,
        isInteractive ? ensureNexusAuthoritySession : ensureNexusMachineQuerySession,
      );
      if (!signInStatus.signedIn) {
        console.warn(`[browser-authority-main] ${query.authority} sign-in probe returned not-signed-in (${signInStatus.reason}) -- proceeding anyway; the query's own extraction is the real arbiter (BP139: probe is advisory, false-negatives confirmed live).`);
      }
    }

    // (this build pass) claude.ai/new has no query-URL form -- route interactive authorities to
    // their own navigate->type->submit->wait->scrape script instead of the static single-shot
    // DOM-query script below. Every HONEST NULL PATH documented above this function (flag off,
    // window unavailable, in-flight serialization) already ran before this point and applies
    // identically to both branches; only the on-page mechanism differs from here down.
    if (isInteractive) {
      return await runInteractiveBrowserAuthorityQueryObserved(nexusWindow, query, threadDecision);
    }

    // D-BP152-030R: the static (Google/Perplexity) branch always fully navigates its target
    // webview to a plain search URL -- that unconditionally invalidates whatever interactive
    // thread (if any) was previously tracked, since the page it was live on is gone.
    nexusLiveThread = null;

    // D-BP152-048/BISHOP/seg-webview-collision: THE FIX. Static queries (askGoogle's own
    // authority, plus Perplexity, since both share this exact branch) now run against a
    // dedicated, always-hidden machine-query window instead of `nexusWindow` (the operator's
    // shared, sometimes-visible Nexus window) -- see ensureNexusMachineQuerySession()'s own header
    // (nexus_authority_persistent_session.ts) for the measured live collision this replaces.
    // Honest, DISTINCT failure reason when this session specifically is unavailable (flag flipped
    // off mid-run, or window construction failed) -- 'disabled', never conflated with the
    // downstream 'no_result'/'timeout' outcomes a genuinely-empty or slow Google response
    // produces. This is the reporting fix this ticket's dispatch also asked for: the two facts
    // ("this machine session could not run at all" vs "it ran and Google had nothing") now stay
    // distinguishable at the source, even though they still surface the same-shaped null to
    // googleBlocks() (comparative_cascade.ts, out of this ticket's FORBIDDEN scope) three attempts
    // later -- the PARSER INSTRUMENT line above and this console line are where the real, distinct
    // reason lives.
    const machineWindow = ensureNexusMachineQuerySession();
    if (!machineWindow) {
      console.warn('[browser-authority-main] machine-query session unavailable (flag off, or window could not be created) -- resolving null (honest, never fabricated, distinct from a genuine empty Google/Perplexity result).');
      return { raw: null, dispatchOutcome: 'disabled' };
    }

    const navigateUrl = buildBrowserAuthorityQueryUrl(query);
    // Executed directly in the machine-query window's page context (same mechanism as the
    // preload-smoke-test above, just against a different window instance than the operator's).
    // query.question/query.authority are interpolated via JSON.stringify below, which produces a
    // safe, quote-escaped JS string literal -- never raw string concatenation of user-controlled
    // text into the script source.
    const script = `
    (function() {
      return new Promise(function(resolve) {
        try {
          var wv = document.querySelector('webview');
          // KN-BP144-7 T2: these resolve() calls now carry a diagnostics-only \`reason\` string
          // (mirroring the interactive script's own existing convention above) instead of a bare
          // null -- this is NEVER load-bearing for success/failure below (still decided purely by
          // r.success/r.snippet/r.sourceUrl, exactly as before), it only lets the Node-side
          // observation classify WHY the eventual null happened, honestly, from what actually ran.
          if (!wv) { resolve({ success: false, reason: 'no_webview_element' }); return; }
          var settled = false;
          var retried = false;
          var timeoutId = setTimeout(function() {
            if (settled) return;
            settled = true;
            wv.removeEventListener('ipc-message', onMsg);
            wv.removeEventListener('did-finish-load', onLoad);
            resolve({ success: false, reason: 'outer_script_timeout' });
          }, ${BROWSER_AUTHORITY_MAIN_TIMEOUT_MS});
          function onMsg(e) {
            if (!e || e.channel !== 'browser-authority-extraction-result') return;
            if (settled) return;
            var payload = e.args && e.args[0] ? e.args[0] : null;
            // BP138 Yoke 0.9.15 FIX 2: on a genuine hit, resolve immediately. On a miss, retry
            // ONCE after BROWSER_AUTHORITY_RETRY_DELAY_MS (the page is already loaded -- this
            // just re-runs the DOM query, no navigation) before giving up honestly.
            if (payload && payload.success) {
              settled = true;
              clearTimeout(timeoutId);
              wv.removeEventListener('ipc-message', onMsg);
              wv.removeEventListener('did-finish-load', onLoad);
              resolve(payload);
              return;
            }
            if (!retried) {
              retried = true;
              setTimeout(function() {
                if (settled) return;
                try {
                  wv.send('browser-authority-run-query', { query: ${JSON.stringify(query.question)}, authority: ${JSON.stringify(query.authority)} });
                } catch (retryErr) {
                  /* non-fatal -- the outer timeoutId still fires and resolves null if this throws */
                }
              }, ${BROWSER_AUTHORITY_RETRY_DELAY_MS});
              return; // wait for the retry's own onMsg (or the outer timeout), don't resolve yet
            }
            // Second attempt also missed -- resolve honestly with whatever the retry reported
            // (success:false, no fabricated snippet/URL), never a silently-swallowed result.
            settled = true;
            clearTimeout(timeoutId);
            wv.removeEventListener('ipc-message', onMsg);
            wv.removeEventListener('did-finish-load', onLoad);
            resolve(payload);
          }
          function onLoad() {
            wv.removeEventListener('did-finish-load', onLoad);
            setTimeout(function() {
              try {
                wv.send('browser-authority-run-query', { query: ${JSON.stringify(query.question)}, authority: ${JSON.stringify(query.authority)} });
              } catch (sendErr) {
                if (!settled) { settled = true; clearTimeout(timeoutId); resolve({ success: false, reason: 'webview_send_failed' }); }
              }
            }, ${BROWSER_AUTHORITY_MAIN_SETTLE_DELAY_MS});
          }
          wv.addEventListener('ipc-message', onMsg);
          wv.addEventListener('did-finish-load', onLoad);
          wv.loadURL(${JSON.stringify(navigateUrl)});
        } catch (err) {
          resolve({ success: false, reason: 'outer_script_exception' });
        }
      });
    })()
  `;

    try {
      const result = await machineWindow.webContents.executeJavaScript(script);
      if (!result || typeof result !== 'object') return { raw: null, dispatchOutcome: 'no_result' };
      const r = result as {
        success?: boolean; snippet?: string; sourceUrl?: string | null; selectorUsed?: string | null; reason?: string;
        // BP149 D-BP149-016 (R4 repair): the webview-side message
        // (BrowserAuthorityExtractionResultMessage, webview_preload.ts) has ALWAYS carried these
        // two fields over this exact IPC round trip -- this cast simply never named them before,
        // so `result.citations`/`result.results` existed at runtime but were invisible to
        // TypeScript and dropped on the floor by the `raw: {...}` object literal below.
        citations?: import('../shared/plow/browser_authority_types').CitationRecord[];
        results?: import('../shared/plow/browser_authority_types').SearchResultCandidate[];
        // D-BP152-050: webview_preload.ts's own structural (URL-only) verification/rate-limit
        // challenge verdict -- see extractBrowserAuthorityAnswer()'s and
        // BrowserAuthorityExtractionResultMessage.challenge's headers there.
        challenge?: boolean;
      };
      // D-BP152-050/BISHOP/seg-honest-failure-reasons -- CHECKED FIRST, ahead of the hasResults
      // gate below. Founder, BP152, live report: "Our systems have detected unusual traffic from
      // your computer network... IP address:... URL: https://www.google.com/sorry/index" --
      // hit while this app had issued repeated automated Google queries. The OLD code called
      // every failure mode "UNREACHABLE... no answer after 3 attempts", including this one.
      // `dispatchOutcome` intentionally stays 'no_result' here (still honest: asked, got a
      // response, nothing usable) so every OTHER, pre-existing caller of this function
      // (unchanged by this ticket) keeps seeing exactly the outcome it always did;
      // `challengeDetected` is the new, separate signal (see this file's own
      // BrowserAuthorityDispatchObservation.challengeDetected header) that lets
      // buildLianaAskGoogle() -> comparative_cascade.ts's googleBlocks() halt retries instead of
      // sending more automated traffic at a page that just told us to stop.
      if (r.challenge) {
        console.warn('[browser-authority-main] structural verification/rate-limit challenge detected (google.com/sorry/) -- resolving null, reporting challengeDetected:true, not retrying from this leg.');
        return { raw: null, dispatchOutcome: 'no_result', challengeDetected: true };
      }
      // BP149 D-BP149-037: RESULTS-ONLY EXTRACTIONS ARE REAL EXTRACTIONS.
      //
      // This gate used to require a `snippet` -- Google's ANSWER BOX -- and returned null the
      // moment one was absent, throwing away the organic results the scraper had ALREADY captured
      // and put in `r.results`. Measured live at BP149: a signed-in, enabled Google authority ran
      // for 6.5s, scraped 5 real organic results, and returned null, because the query produced no
      // answer box.
      //
      // That is not a rare edge. It is most of the Founder's own cascade. His stage 3, 4 and 5
      // framings ("Please put these regions in order of most densely to least densely populated",
      // "please remove the half that are least populated", "What are the population densities of
      // each of the following world regions?") are conversational requests Google answers with
      // ORGANIC RESULTS, not with a box. Only his stage-1 inverse reliably gets a box. So every
      // stage after the first returned null and his method could never run to completion.
      //
      // Returning the results is not a partial or fabricated extraction: the organic list is real
      // captured page content with real URLs, and it is exactly what he reads off the page himself
      // when there is no box. Fabrication would be inventing a snippet. This invents nothing, and
      // an empty `snippet` tells the caller plainly that no box existed.
      // `r.success` is set by extractBrowserAuthorityAnswer (webview_preload.ts:334-352), which
      // returns success:false whenever no ANSWER BOX selector matches -- and which cannot see the
      // organic results at all, since they are attached further down the chain
      // (its return type is literally Omit<BrowserAuthorityExtractionResultMessage, 'results'>).
      // So `success` means "an answer box was found", not "the scrape produced nothing". Gating on
      // it discarded real captured page content. Results present is sufficient on its own.
      const hasResults = Array.isArray(r.results) && r.results.length > 0;
      if (!hasResults && (!r.success || !r.snippet || !r.sourceUrl)) {
        // honest -- never a partial/fabricated extraction. KN-BP144-7 T2: this static (Google/
        // Perplexity) path has no login-wall detector of its own (unlike the interactive script
        // above), so 'not_signed_in' can never be observed here -- only genuinely reported reasons
        // are ever classified, per this ticket's own "never infer/deduce" refusal.
        const dispatchOutcome: BrowserAuthorityDispatchOutcome = r.reason === 'outer_script_timeout' ? 'timeout' : 'no_result';
        return { raw: null, dispatchOutcome };
      }
      return {
        raw: {
          // Empty string when Google gave no answer box. Honest and load-bearing: a caller that
          // sees `snippet === '' && results.length > 0` knows the facts are in the organic list,
          // which is precisely the case the old gate deleted.
          snippet: r.snippet ?? '',
          sourceUrl: r.sourceUrl ?? null,
          authority: query.authority,
          selectorUsed: r.selectorUsed ?? null,
          // BP149 D-BP149-016: carried through now instead of discarded. Defaulted to [] (never
          // omitted) when the webview message genuinely lacked the key, matching this file's own
          // "empty is honest, absent is not" convention for citations/results elsewhere.
          citations: r.citations ?? [],
          results: r.results ?? [],
        },
        dispatchOutcome: 'dispatched',
      };
    } catch (err) {
      console.warn('[browser-authority-main] executeJavaScript round trip failed (non-fatal, resolving null):', (err as Error)?.message ?? err);
      return { raw: null, dispatchOutcome: 'no_result' };
    }
  };

  // BP139 serialize fix: chain this call onto whatever is currently in flight instead of
  // dropping it. `.then(runOnceObserved, runOnceObserved)` runs runOnceObserved() once the
  // previous link SETTLES (whether it resolved OR rejected), so one failing/timed-out call can
  // never poison or stall the queue for later callers. `thisCall` is what THIS caller awaits (its
  // real value/rejection); `browserAuthorityInFlightChain` is updated to a version that swallows
  // this call's outcome via `.then(() => undefined, () => undefined)` purely so the NEXT queued
  // call still fires even if this one throws. Single-query behavior is unchanged: with nothing
  // else in flight, browserAuthorityInFlightChain is already-resolved, so runOnceObserved() runs
  // on the very next microtask, same as a direct call. No deadlock risk: runOnceObserved()'s own
  // body is bounded by BROWSER_AUTHORITY_MAIN_TIMEOUT_MS (20s) inside the script's own
  // setTimeout/resolve(...), so every link settles within that bound and the chain always
  // advances.
  const thisCall = browserAuthorityInFlightChain.then(runOnceObserved, runOnceObserved);
  browserAuthorityInFlightChain = thisCall.then(() => undefined, () => undefined);
  return thisCall;
}

// Thin, byte-identical-behavior wrapper: every pre-existing caller of this exact exported name
// (Stage F3 mesh-synergy, decompose, the eliminator, the mesh-synergy fan-out verifier, the
// Ask-tab lookup, the direct IPC handler) gets exactly what it always got -- KN-BP144-7 added a
// richer OBSERVED variant above for callers that want the new instrumentation (currently only
// the Authority Ensemble's own Stage F2 bridge, plow_mc_answerer.ts), and changed nothing about
// what this function itself returns.
export async function runBrowserAuthorityQueryFromMain(
  query: BrowserAuthorityQuery,
): Promise<BrowserAuthorityRawExtraction | null> {
  const observed = await runBrowserAuthorityQueryFromMainObserved(query);
  return observed.raw;
}

// D-BP152-050/BISHOP/seg-honest-failure-reasons -- THE LIANA CYCLE'S OWN askGoogle, distinct from
// the byte-identical-unchanged runBrowserAuthorityQueryFromMain() immediately above.
//
// WHY THIS EXISTS: runBrowserAuthorityQueryFromMain() collapses every non-dispatched outcome
// (verification/rate-limit challenge, window/session unavailable, a network/navigation timeout,
// or a genuinely empty page) into the exact same bare `null` -- comparative_cascade.ts's
// googleBlocks() (the Liana Cycle's retry loop) could not tell "Google refused us" from "Google
// answered and had nothing" from that null alone. That is the defect the Founder hit live
// (BP152): a Google rate-limit/verification page ("we have detected unusual activity...",
// https://www.google.com/sorry/index) reported as "UNREACHABLE (no answer after 3 attempts)",
// then retried 3 more times -- more automated traffic aimed at the thing already rate-limiting
// this app's IP.
//
// SCOPE: used ONLY at this ticket's two Liana Cycle askGoogle construction sites below
// ('liana-terminal-run', 'liana-script-run'). Every OTHER caller of
// runBrowserAuthorityQueryFromMain/runBrowserAuthorityQueryFromMainObserved (Stage F3
// mesh-synergy, decompose, the eliminator, the Ask-tab lookup, the direct IPC handler,
// plow_mc_answerer.ts) is untouched -- this function does not change what either of those two
// shared functions returns to anyone else.
//
// HONESTY FIREWALL UNCHANGED: on a genuine extraction (`observed.raw` truthy) this returns it
// unchanged, byte-identical to what the old inline closures returned. Only on failure does this
// now resolve a non-null but still-honestly-EMPTY BrowserAuthorityRawExtraction (snippet: '',
// sourceUrl: null -- never a fabricated fact, exactly the same "absence must surface as empty,
// never as a fake-success object" contract this file's HONESTY FIREWALL comment already
// documents) carrying the real dispatchOutcome/challengeDetected so googleBlocks() can classify
// WHY instead of guessing. No new answer text, source, or citation is ever invented here.
function buildLianaAskGoogle(runThreadContext: NexusRunThreadContext): AskGoogleFn {
  return async (question: string): Promise<BrowserAuthorityRawExtraction | null> => {
    const observed = await runBrowserAuthorityQueryFromMainObserved({
      question,
      authority: 'user_google',
      ...runThreadContext.forQuery('user_google'),
    });
    if (observed.raw) return observed.raw;
    return {
      snippet: '',
      sourceUrl: null,
      authority: 'user_google',
      selectorUsed: null,
      citations: [],
      results: [],
      dispatchOutcome: observed.dispatchOutcome,
      challengeDetected: observed.challengeDetected,
    };
  };
}

// D-BP152-033/BISHOP/seg-machine-drives-nexus: the one piece of glue this ticket adds to
// index.ts. nexus_authority_persistent_session.ts's runMachineDrivenNexusQuery() needs a way to
// reach the interactive (composer-driven) authorities without importing this file (index.ts
// already imports THAT file -- a reverse import would be circular). This supplies
// runBrowserAuthorityQueryFromMainObserved (immediately above, UNCHANGED by this ticket -- it is
// still every pre-existing caller's exact same function) as the injected driver.
// NOT WIRED TO ANY CALLER. Same "capability built, not wired" discipline D-BP152-030R/032 already
// established: this ticket's own FORBIDDEN list bars touching Step 0/the pause plumbing/any
// method's verdict logic/demand_test.ts, so nothing in the Liana Cycle calls this yet. A future
// ticket decides which caller, if any, should be first to use it.
export async function runMachineDrivenNexusQueryFromMain(
  authority: BrowserAuthorityName,
  question: string,
  optionsRecord: Record<string, string> | null,
  runThreadContext: NexusRunThreadContext,
  mcOptions?: string[],
) {
  return runMachineDrivenNexusQuery(authority, question, optionsRecord, {
    mcOptions,
    threadFields: runThreadContext.forQuery(authority),
    runInteractiveQuery: runBrowserAuthorityQueryFromMainObserved,
  });
}

// --- IPC Handlers ------------------------------------------------------------

let skuPullRunning = false;

// --- SEG-Q-4 BP078: Auto-prepare FULL upgrade in background ------------------

let autoPrepareRunning = false;
let autoPrepareIdleTimer: NodeJS.Timeout | null = null;
const AUTO_PREPARE_MODEL = 'gemma4:12b';
const AUTO_PREPARE_IDLE_MS = 30 * 60 * 1000; // 30 min

function getAutoPrepareEnabled(): boolean {
  try {
    const cfgPath = join(app.getPath('userData'), 'auto_prepare_full.json');
    if (!existsSync(cfgPath)) return false;
    const data = JSON.parse(readFileSync(cfgPath, 'utf-8'));
    return data.enabled === true;
  } catch { return false; }
}

function setAutoPrepareEnabled(enabled: boolean): void {
  try {
    const cfgPath = join(app.getPath('userData'), 'auto_prepare_full.json');
    writeFileSync(cfgPath, JSON.stringify({ enabled }), 'utf-8');
  } catch { /* non-fatal */ }
}

function isGemma4Ready(): boolean {
  try {
    const manifestPath = join(homedir(), '.ollama', 'models', 'manifests',
      'registry.ollama.ai', 'library', 'gemma4', '12b');
    const fallbackPath = join(homedir(), '.ollama', 'models', 'manifests',
      'registry.ollama.ai', 'gemma4', '12b');
    return existsSync(manifestPath) || existsSync(fallbackPath);
  } catch { return false; }
}

function runAutoPrepareIfNeeded(): void {
  if (!getAutoPrepareEnabled()) return;
  if (autoPrepareRunning) return;
  if (isGemma4Ready()) return;

  autoPrepareRunning = true;

  ollamaManager.pullModel(AUTO_PREPARE_MODEL).then(() => {
    autoPrepareRunning = false;
    const notif = new Notification({
      title: 'MnemosyneC ? Gemma 4 12B is ready',
      body: 'Full AI model downloaded. Click to activate.',
      silent: false,
    });
    notif.on('click', () => {
      try {
        writeFileSync(
          join(app.getPath('userData'), 'sku_tier.json'),
          JSON.stringify({ tier: 'full', model: AUTO_PREPARE_MODEL }),
          'utf-8',
        );
      } catch { /* non-fatal */ }
      openDashboard({ focus: true });
      dashboardWindow?.webContents.send('auto-prepare:model-activated');
    });
    notif.show();
    BrowserWindow.getAllWindows().forEach((w) => {
      if (!w.isDestroyed()) w.webContents.send('auto-prepare:model-ready');
    });
  }).catch(() => {
    autoPrepareRunning = false;
  });
}

function scheduleAutoPrepareIdle(): void {
  if (autoPrepareIdleTimer) clearTimeout(autoPrepareIdleTimer);
  autoPrepareIdleTimer = setTimeout(() => {
    runAutoPrepareIfNeeded();
    scheduleAutoPrepareIdle();
  }, AUTO_PREPARE_IDLE_MS);
}

// BP085 — handleMembershipReturn (called from mnemosynec:// deep-link).
// NEVER logs token value (BP085 BLOOD).
async function handleMembershipReturn(memberId: string, token: string): Promise<void> {
  const supabaseUrl = getSupabaseUrl();
  const supabaseKey = getAnonKey();

  const notifyRenderer = (payload: { ok: boolean; member_id?: string; error?: string }) => {
    const wins = [dashboardWindow, hearthConjunctionWindow, overlayWindow];
    for (const win of wins) {
      if (win && !win.isDestroyed()) {
        win.webContents.send('membership:activation-result', payload);
      }
    }
  };

  if (!supabaseUrl || !supabaseKey) {
    console.warn('[membership-return] Supabase not configured — cannot validate token');
    notifyRenderer({ ok: false, error: 'Supabase not configured — verify at lianabanyan.com' });
    return;
  }

  try {
    const resp = await globalThis.fetch(
      `${supabaseUrl}/functions/v1/membership-callback-mnemosynec`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey,
        },
        body: JSON.stringify({ member_id: memberId, token }),
      },
    );

    const json = await resp.json() as { valid?: boolean; error?: string };

    if (resp.ok && json.valid === true) {
      const { writeFileSync } = await import('fs');
      const { join: pathJoin } = await import('path');
      const statusFile = pathJoin(app.getPath('userData'), 'member_status.json');
      writeFileSync(
        statusFile,
        JSON.stringify({ is_member: true, member_id: memberId, activated_at: new Date().toISOString() }),
        'utf8',
      );
      console.log('[membership-return] Membership activated for member_id:', memberId);
      notifyRenderer({ ok: true, member_id: memberId });
    } else {
      console.warn('[membership-return] Token validation failed:', json.error ?? 'unknown');
      notifyRenderer({ ok: false, error: json.error ?? 'Token validation failed' });
    }
  } catch (err) {
    console.error('[membership-return] Exception:', err);
    notifyRenderer({ ok: false, error: String(err) });
  }
}

// ============================================================================
// KN-BP147-M2 (D-BP147-005): THE CRYSTAL, WIRED -- reachability layer for the durable
// chonk-handle store built by KN-BP147-M1 (src/main/crystal/crystal_store.ts, commit
// ccae7f1c). Placed here, immediately before registerIPCHandlers(), as a single self-contained
// module-level unit (module-level CrystalStoreApi type + crystalLoadWarned flag +
// getCrystalStore() function) so both the INIT-CALL append zone (inside app.whenReady()) and
// the IPC-HANDLER append zone (inside registerIPCHandlers(), below) can share one loader
// without either zone needing to define its own copy.
//
// FAIL OPEN (ticket-mandated, non-negotiable, HARDWIRE-00 Section 1.8): getCrystalStore() NEVER
// throws. A failure to require() the compiled store -- including the real MODULE_NOT_FOUND
// described in the IMPORT APPEND ZONE comment above -- is caught, logged loudly exactly once per
// process lifetime (crystalLoadWarned), and reported back as `null`. Every caller (the startup
// probe in the INIT-CALL zone, and each crystal:* IPC handler below) treats `null` as "Crystal
// unavailable this session" and returns a clean { ok:false, error } to its own caller instead of
// throwing further. A wedged boot is strictly worse than a store that stays dark.
// ============================================================================
let crystalLoadWarned = false;
interface CrystalStoreApi {
  CRYSTAL_DIR: string;
  mintChonk: (pearls: string[]) => string;
  resolveChonk: (sid: string) => ResolvedChonk | null;
  bindChonk: (sid: string, key: string, target: BindingTarget) => BindResult;
  mutateChonkBinding: (
    sid: string,
    key: string,
    target: BindingTarget,
    reason: MutationReason,
    note: string,
  ) => BindResult;
  crystalStats: () => { mintedCount: number; logPath: string; logExists: boolean };
}

// KN-BP147-M2 (D-BP147-005): CONFIRMED (not assumed) this session by direct repro against the
// ACTUAL bundled runtime this app ships with -- `ELECTRON_RUN_AS_NODE=1
// node_modules\.bin\electron.cmd -e "console.log(process.versions.node)"` reports Electron
// 31.7.7 bundles Node 20.18.0. Node's native TypeScript type-stripping (the mechanism that
// would let a bare `require("./crystal_types.ts")` resolve at runtime with zero build step,
// per crystal_store.ts's own header comment) only landed in Node 22.6 (experimental) / is
// default-on from Node 23.6 -- Node 20.18.0 predates it entirely. Direct repro of the failure
// under that exact bundled runtime: `ELECTRON_RUN_AS_NODE=1 node_modules\.bin\electron.cmd -e
// "require('./dist/main/crystal/crystal_store.js')"` -> throws
// `MODULE_NOT_FOUND: Cannot find module './crystal_types.ts'`. This is a pre-existing defect in
// KN-BP147-M1's committed code (crystal_store.ts line 45, commit ccae7f1c) -- crystal/ is this
// ticket's READ-ONLY zone (do not modify it), so the fix lives HERE instead, entirely inside
// this ticket's own OWNS file, touching zero bytes under crystal/: a one-time, additive-only
// Module._resolveFilename patch that retries a failed `<path>.ts` resolution once against the
// sibling `<path>.js` before giving up. This can only ever HELP -- it activates only on a
// resolution that would otherwise throw outright -- so it cannot change behavior for any other
// module in this app that wasn't already broken. If crystal_types.ts is ever compiled to
// crystal_types.js AND crystal_store.ts's own require string is later fixed upstream (outside
// this ticket's scope), this patch simply becomes a permanent no-op for this path, not a
// liability. Idempotent-guarded so repeated getCrystalStore() calls patch Module exactly once.
let crystalTsToJsFallbackPatched = false;
function ensureCrystalTsToJsFallback(): void {
  if (crystalTsToJsFallbackPatched) return;
  crystalTsToJsFallbackPatched = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const NodeModule = require('module');
    const originalResolveFilename = NodeModule._resolveFilename;
    NodeModule._resolveFilename = function patchedResolveFilename(
      this: unknown,
      request: string,
      ...rest: unknown[]
    ): string {
      try {
        return originalResolveFilename.call(NodeModule, request, ...rest);
      } catch (resolveErr) {
        if (typeof request === 'string' && request.endsWith('.ts')) {
          try {
            return originalResolveFilename.call(NodeModule, request.slice(0, -3) + '.js', ...rest);
          } catch {
            // Sibling .js doesn't exist either -- fall through and surface the ORIGINAL .ts
            // resolution error below, not this secondary attempt's, so getCrystalStore()'s own
            // catch logs the true root cause rather than a confusing double-hop message.
          }
        }
        throw resolveErr;
      }
    };
  } catch (patchErr) {
    console.error(
      '[crystal] KN-BP147-M2 (D-BP147-005): failed to install the .ts->.js module-resolution ' +
        'fallback -- Crystal load will MODULE_NOT_FOUND on crystal_types.ts under the ' +
        'Electron-bundled Node runtime (no native TS support pre-Node-22.6). Continuing -- ' +
        'FAIL OPEN per this ticket and HARDWIRE-00 Section 1.8.',
      patchErr,
    );
  }
}

function getCrystalStore(): CrystalStoreApi | null {
  try {
    ensureCrystalTsToJsFallback();
    // Deliberate require(), not the top-level `import type` above -- see that import's comment
    // for the full reasoning. require() is cached by Node after a successful load, so repeat
    // calls from separate IPC handlers are cheap; after a FAILED load Node does not cache the
    // failure, so this safely re-attempts (and re-fails identically) on every call rather than
    // wedging into a permanently-broken state that could never recover if the underlying file
    // were fixed later in the same running process.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('./crystal/crystal_store') as CrystalStoreApi;
    return mod;
  } catch (err) {
    if (!crystalLoadWarned) {
      crystalLoadWarned = true;
      console.error(
        '[crystal] KN-BP147-M2 (D-BP147-005): FAILED to load the Crystal store ' +
          '(src/main/crystal/crystal_store.js) -- Crystal-backed IPC channels (crystal:*) will ' +
          'report { ok:false, error } to every caller this session. App continues normally -- ' +
          'FAIL OPEN per this ticket and HARDWIRE-00 Section 1.8.',
        err,
      );
    }
    return null;
  }
}

function registerIPCHandlers(): void {
  // Guard against duplicate handle registrations -- ipcMain.handle throws on dups.
  // safeHandle wraps every call so accidental future duplicates fail loudly (console.error)
  // rather than crashing the app silently.
  const safeHandle = (channel: string, handler: Parameters<typeof ipcMain.handle>[1]): void => {
    try {
      ipcMain.handle(channel, handler);
    } catch (e) {
      console.error(`[IPC] Duplicate registration attempt for ${channel}:`, e);
    }
  };

  // SAGA 07+13 BP046B utility + first-install bonus

  ipcMain.on('open-external', (_event: Electron.IpcMainEvent, { url }: { url: string }) => {
    if (typeof url === 'string' && (url.startsWith('https://') || url.startsWith('http://'))) {
      shell.openExternal(url);
    }
  });

  ipcMain.on('hide-overlay', () => { overlayWindow?.hide(); });

  ipcMain.on('show-overlay', () => {
    if (!overlayWindow) createOverlayWindow();
    overlayWindow?.setOpacity(1.0);
    overlayWindow?.showInactive();
  });

  // SEG-Q-3 BP078: DevTools toggle via renderer button (fallback when Ctrl+Shift+D conflicts)
  ipcMain.on('devtools:toggle', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win && !win.isDestroyed()) {
      if (win.webContents.isDevToolsOpened()) {
        win.webContents.closeDevTools();
      } else {
        win.webContents.openDevTools({ mode: 'detach' });
      }
    }
  });

  // SEG-V0144-UI-1: Apply zoom factor to all active BrowserWindows
  ipcMain.on('set-zoom-factor', (_event, factor: number) => {
    if (typeof factor !== 'number' || factor < 0.5 || factor > 3.0) return;
    BrowserWindow.getAllWindows().forEach((w) => {
      if (!w.isDestroyed()) w.webContents.setZoomFactor(factor);
    });
  });

  // SEG-Q-4 BP078: Auto-prepare FULL upgrade IPC
  safeHandle('auto-prepare:get', () => ({
    enabled: getAutoPrepareEnabled(),
    modelReady: isGemma4Ready(),
    pulling: autoPrepareRunning,
  }));

  // v0.4.0 BP083 SEG-5: request-app-quit IPC (renderer restart prompt)
  ipcMain.on('request-app-quit', () => {
    app.quit();
  });

  // BP081 K-2 — MCP server status + auth token IPC
  safeHandle('mcp:get-status', async () => getMcpServerStatus());
  safeHandle('mcp:get-auth-token', async () => {
    const tokenPath = join(app.getPath('userData'), 'mcp_auth_token.txt');
    return existsSync(tokenPath) ? readFileSync(tokenPath, 'utf8').trim() : null;
  });

  ipcMain.on('auto-prepare:set', (_event, enabled: boolean) => {
    setAutoPrepareEnabled(enabled);
    if (enabled) {
      runAutoPrepareIfNeeded();
      scheduleAutoPrepareIdle();
    } else {
      if (autoPrepareIdleTimer) { clearTimeout(autoPrepareIdleTimer); autoPrepareIdleTimer = null; }
      autoPrepareRunning = false;
    }
  });

  // SEG-Q-13 BP078: Run Diagnostic -- writes probe results to userData log file
  safeHandle('diagnostic:run', async () => {
    const results: string[] = [];
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const logPath = join(app.getPath('userData'), `diagnostic-${ts}.log`);

    results.push(`=== MnemosyneC Diagnostic ===`);
    results.push(`Timestamp: ${new Date().toISOString()}`);
    results.push(`App version: ${app.getVersion()}`);
    results.push(`Platform: ${process.platform} ${process.arch}`);
    results.push(`Electron: ${process.versions.electron}`);
    results.push(`Node: ${process.versions.node}`);
    results.push(`userData: ${app.getPath('userData')}`);
    results.push(``);

    // Ollama status + SEG-V0148-P2 enrichment
    try {
      const ollamaStatus = ollamaManager ? ollamaManager.getStatus() : { running: false, model: null };
      results.push(`Ollama running: ${ollamaStatus.running}`);
      results.push(`Ollama model: ${ollamaStatus.model ?? 'none'}`);
      results.push(`ollamaPath=${_capturedOllamaPath ?? 'null'}`);
      results.push(`branch=${_capturedOllamaBranch}`);
    } catch (e) {
      results.push(`Ollama status error: ${(e as Error).message}`);
    }
    results.push(``);

    // SEG-V0148-P0-SKU-MODEL: active vs target model
    results.push(`activeModel=${_capturedActiveModel} targetModel=${_capturedTargetModel}`);
    if (_capturedActiveModel !== _capturedTargetModel) {
      results.push(`  *** MISMATCH — full-tier model not served — mesh test NOT comparable to published benchmarks ***`);
    }
    results.push(``);

    // SKU tier
    try {
      const skuPath = join(app.getPath('userData'), 'sku_tier.json');
      if (existsSync(skuPath)) {
        const sku = JSON.parse(readFileSync(skuPath, 'utf-8'));
        results.push(`SKU tier: ${JSON.stringify(sku)}`);
      } else {
        results.push(`SKU tier: not yet set (fresh install)`);
      }
    } catch (e) {
      results.push(`SKU tier error: ${(e as Error).message}`);
    }

    // Gemma4:12b manifest check
    try {
      const manifestPath = join(homedir(), '.ollama', 'models', 'manifests', 'registry.ollama.ai', 'library', 'gemma4', '12b');
      results.push(`gemma4:12b manifest exists: ${existsSync(manifestPath)}`);
    } catch (e) {
      results.push(`gemma4:12b check error: ${(e as Error).message}`);
    }
    results.push(``);

    // Windows: available disk space
    try {
      const diskOk = await ollamaManager.checkDiskSpace(6);
      results.push(`Disk space ok (need 6GB): ${diskOk}`);
    } catch (e) {
      results.push(`Disk space check error: ${(e as Error).message}`);
    }

    // SEG-V0148-P1-SUBSTRATE-PATHS: fix probes to use process.resourcesPath on packaged installs
    try {
      const subPath = app.isPackaged
        ? join(process.resourcesPath, 'r10v3_substrate.txt')
        : join(app.getPath('userData'), '..', '..', 'resources', 'r10v3_substrate.txt');
      const subPath2 = app.isPackaged
        ? join(process.resourcesPath, 'r10v3_substrate.txt')
        : join(__dirname, '..', '..', 'resources', 'r10v3_substrate.txt');
      results.push(`substrate (resources): ${existsSync(subPath)}`);
      results.push(`substrate (dist-relative): ${existsSync(subPath2)}`);
    } catch (e) {
      results.push(`substrate check error: ${(e as Error).message}`);
    }
    results.push(``);

    // Auto-prepare state
    try {
      const apPath = join(app.getPath('userData'), 'auto_prepare_full.json');
      if (existsSync(apPath)) {
        const ap = JSON.parse(readFileSync(apPath, 'utf-8'));
        results.push(`Auto-prepare enabled: ${ap.enabled}`);
      } else {
        results.push(`Auto-prepare: not configured (OFF)`);
      }
    } catch (e) {
      results.push(`Auto-prepare check error: ${(e as Error).message}`);
    }

    // Open windows
    results.push(``);
    results.push(`Open windows: ${BrowserWindow.getAllWindows().length}`);
    BrowserWindow.getAllWindows().forEach((w, i) => {
      results.push(`  [${i}] title="${w.getTitle()}" destroyed=${w.isDestroyed()}`);
    });

    results.push(``);
    results.push(`=== END DIAGNOSTIC ===`);

    const content = results.join('\n');
    writeFileSync(logPath, content, 'utf-8');

    console.log(`[diagnostic] log written to ${logPath}`);
    return { ok: true, logPath, content };
  });

  // SEG-R-13: Open the folder that contains a diagnostic log file
  safeHandle('diagnostic:open-folder', async (_event, folderPath: string) => {
    try {
      await shell.showItemInFolder(folderPath);
    } catch (e) {
      console.error('[diagnostic] open-folder failed:', e);
    }
  });

  // -- BP065 Onboarding Prefs (v0.1.23) -------------------------------------
  // Applies setup screen preferences: desktop shortcut, startup item, optional API key.
  // All fields are best-effort; failures are non-fatal (onboarding is optional).
  safeHandle('onboarding:apply-prefs', async (_event, prefs: {
    displayName?: string;
    addDesktopShortcut?: boolean;
    addStartupItem?: boolean;
    apiKey?: string;
  }) => {
    const results: Record<string, boolean> = {};

    // Desktop shortcut (Windows only)
    if (prefs.addDesktopShortcut && process.platform === 'win32') {
      try {
        const { shell: electronShell } = require('electron');
        const path = require('path');
        const desktopPath = app.getPath('desktop');
        const exePath = process.execPath;
        electronShell.writeShortcutLink(
          path.join(desktopPath, 'MnemosyneC.lnk'),
          'create',
          { target: exePath, name: 'MnemosyneC', description: 'MnemosyneC ? private AI memory' },
        );
        results.desktopShortcut = true;
      } catch (err) {
        console.warn('[onboarding] desktop shortcut creation failed (non-fatal):', err);
        results.desktopShortcut = false;
      }
    }

    // Startup item (cross-platform)
    try {
      app.setLoginItemSettings({ openAtLogin: prefs.addStartupItem ?? false });
      results.startupItem = true;
    } catch (err) {
      console.warn('[onboarding] setLoginItemSettings failed (non-fatal):', err);
      results.startupItem = false;
    }

    // API key (store via existing agent key infrastructure, non-fatal if unavailable)
    if (prefs.apiKey && prefs.apiKey.trim()) {
      try {
        const envLoader = require('./env_loader');
        if (typeof envLoader?.setRuntimeKey === 'function') {
          envLoader.setRuntimeKey('ANTHROPIC_API_KEY', prefs.apiKey.trim());
        }
        results.apiKey = true;
      } catch {
        results.apiKey = false;
      }
    }

    console.log('[onboarding] prefs applied:', JSON.stringify({ ...results, displayName: !!prefs.displayName }));
    return { ok: true, results };
  });

  // SAGA 13 BP046B: 5-Marks first-install bonus (one-per-machine flag)
  ipcMain.on('credit-first-install-marks', () => {
    const { join } = require('path');
    const { existsSync, writeFileSync } = require('fs');
    const flagPath = join(app.getPath('userData'), 'first_install_marks_credited.flag');
    if (!existsSync(flagPath)) {
      writeFileSync(flagPath, new Date().toISOString(), 'utf-8');
      console.log('[SAGA13] First-install 5 marks credited');
    }
  });

  // -- v0.2.0 BP082 OAuth (Discord + Reddit) ----------------------------------
  //
  // Secrets discipline: client IDs from env (DISCORD_OAUTH_CLIENT_ID /
  // REDDIT_OAUTH_CLIENT_ID). Client secrets ONLY in 22May2026.env — never
  // in source, never in renderer context, never in logs.
  // OAuth tokens stored via safeStorage.encryptString() → userData/oauth_tokens.json.enc
  // Protocol redirect: mnemo://oauth/<platform>/callback (registered in package.json).

  const OAUTH_CONFIGS: Record<string, { authUrl: string; tokenUrl: string; scope: string }> = {
    discord: {
      authUrl: 'https://discord.com/api/oauth2/authorize',
      tokenUrl: 'https://discord.com/api/oauth2/token',
      scope: 'identify email guilds guilds.members.read messages.read',
    },
    reddit: {
      authUrl: 'https://www.reddit.com/api/v1/authorize',
      tokenUrl: 'https://www.reddit.com/api/v1/access_token',
      scope: 'identity read submit vote subscribe mysubreddits',
    },
  };

  safeHandle('oauth:start-flow', async (_event, { platform }: { platform: 'discord' | 'reddit' }) => {
    const { shell, safeStorage } = require('electron');
    const { join } = require('path');
    const { readFileSync, writeFileSync, existsSync } = require('fs');
    const crypto = require('crypto');

    const clientIdKey = platform === 'discord' ? 'DISCORD_OAUTH_CLIENT_ID' : 'REDDIT_OAUTH_CLIENT_ID';
    const clientId = process.env[clientIdKey];
    if (!clientId) {
      console.log(`[OAuth] ${platform} client ID not set — needs app registration`);
      return { success: false, needsRegistration: true };
    }

    const cfg = OAUTH_CONFIGS[platform];
    const state = crypto.randomBytes(16).toString('hex');
    const redirectUri = `mnemo://oauth/${platform}/callback`;

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      scope: cfg.scope,
      state,
      ...(platform === 'discord' ? {} : { duration: 'permanent' }),
    });

    const authUrl = `${cfg.authUrl}?${params.toString()}`;

    return new Promise<{ success: boolean; username?: string; scopes?: string[]; error?: string; needsRegistration?: boolean }>((resolve) => {
      // Timeout after 5 minutes
      const timeout = setTimeout(() => {
        app.removeListener('open-url', handler);
        resolve({ success: false, error: 'OAuth timeout — user did not complete authorization.' });
      }, 5 * 60 * 1000);

      const handler = (_e: Electron.Event, url: string) => {
        if (!url.startsWith(`mnemo://oauth/${platform}/callback`)) return;
        clearTimeout(timeout);
        app.removeListener('open-url', handler);

        const u = new URL(url);
        const code = u.searchParams.get('code');
        const returnedState = u.searchParams.get('state');
        const error = u.searchParams.get('error');

        if (error || !code) {
          resolve({ success: false, error: error ?? 'No code returned from OAuth provider.' });
          return;
        }
        if (returnedState !== state) {
          resolve({ success: false, error: 'OAuth state mismatch — possible CSRF. Please try again.' });
          return;
        }

        // Exchange code for token in main process
        const clientSecretKey = platform === 'discord' ? 'DISCORD_OAUTH_CLIENT_SECRET' : 'REDDIT_OAUTH_CLIENT_SECRET';
        const clientSecret = process.env[clientSecretKey];
        if (!clientSecret) {
          resolve({ success: false, error: `${platform} client secret not set. Add ${clientSecretKey} to env.` });
          return;
        }

        const tokenBody = new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
          client_id: clientId!,
          client_secret: clientSecret,
        });

        fetch(cfg.tokenUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            ...(platform === 'reddit' ? {
              Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
            } : {}),
          },
          body: tokenBody.toString(),
        })
          .then((r) => r.json())
          .then(async (tokenData: Record<string, unknown>) => {
            if (tokenData.error) {
              resolve({ success: false, error: String(tokenData.error_description ?? tokenData.error) });
              return;
            }

            // Store token encrypted via safeStorage
            const tokenPath = join(app.getPath('userData'), `oauth_${platform}.enc`);
            if (safeStorage.isEncryptionAvailable()) {
              const encrypted = safeStorage.encryptString(JSON.stringify(tokenData));
              writeFileSync(tokenPath, encrypted);
            } else {
              // Fallback: write with mild obfuscation + warn (safeStorage unavailable on headless)
              console.warn(`[OAuth] safeStorage unavailable — ${platform} token stored with reduced security`);
              writeFileSync(tokenPath, Buffer.from(JSON.stringify(tokenData)).toString('base64'));
            }

            // Fetch username from platform API
            let username = 'user';
            try {
              const accessToken = String(tokenData.access_token);
              if (platform === 'discord') {
                const meRes = await fetch('https://discord.com/api/users/@me', {
                  headers: { Authorization: `Bearer ${accessToken}` },
                });
                const me = await meRes.json() as { username?: string };
                username = me.username ?? 'user';
              } else {
                const meRes = await fetch('https://oauth.reddit.com/api/v1/me', {
                  headers: { Authorization: `Bearer ${accessToken}`, 'User-Agent': 'MnemosyneC/0.2.0' },
                });
                const me = await meRes.json() as { name?: string };
                username = me.name ?? 'user';
              }
            } catch { /* non-fatal — username fallback */ }

            // Store metadata (non-secret) in plain JSON for quick reads
            const metaPath = join(app.getPath('userData'), `oauth_${platform}_meta.json`);
            writeFileSync(metaPath, JSON.stringify({ connected: true, username, scopes: cfg.scope.split(' '), connectedAt: new Date().toISOString() }));

            resolve({ success: true, username, scopes: cfg.scope.split(' ') });
          })
          .catch((err: Error) => {
            resolve({ success: false, error: `Token exchange failed: ${err.message}` });
          });
      };

      app.on('open-url', handler);
      shell.openExternal(authUrl).catch(() => {
        clearTimeout(timeout);
        app.removeListener('open-url', handler);
        resolve({ success: false, error: 'Could not open browser for OAuth.' });
      });
    });
  });

  safeHandle('oauth:revoke-token', (_event, { platform }: { platform: string }) => {
    const { join } = require('path');
    const { existsSync, unlinkSync } = require('fs');
    const tokenPath = join(app.getPath('userData'), `oauth_${platform}.enc`);
    const metaPath = join(app.getPath('userData'), `oauth_${platform}_meta.json`);
    try {
      if (existsSync(tokenPath)) unlinkSync(tokenPath);
      if (existsSync(metaPath)) unlinkSync(metaPath);
      console.log(`[OAuth] ${platform} token revoked`);
    } catch { /* non-fatal */ }
    return { ok: true };
  });

  safeHandle('oauth:get-connection-info', (_event, { platform }: { platform: string }) => {
    const { join } = require('path');
    const { existsSync, readFileSync } = require('fs');
    const metaPath = join(app.getPath('userData'), `oauth_${platform}_meta.json`);
    if (!existsSync(metaPath)) return { connected: false };
    try {
      const meta = JSON.parse(readFileSync(metaPath, 'utf-8')) as { connected: boolean; username?: string };
      return { connected: meta.connected, username: meta.username };
    } catch {
      return { connected: false };
    }
  });

  safeHandle('oauth:accrue-connect-marks', (_event, { platform, amount }: { platform: string; amount: number }) => {
    const { join } = require('path');
    const { existsSync, readFileSync, writeFileSync } = require('fs');
    const flagPath = join(app.getPath('userData'), `oauth_${platform}_marks_credited.flag`);
    if (existsSync(flagPath)) {
      // Already credited — idempotent
      const ledger = join(app.getPath('userData'), 'marks_ledger.json');
      try {
        const existing = JSON.parse(readFileSync(ledger, 'utf-8')) as { total: number };
        return { ok: true, total: existing.total };
      } catch {
        return { ok: true };
      }
    }
    writeFileSync(flagPath, new Date().toISOString(), 'utf-8');
    const ledgerPath = join(app.getPath('userData'), 'marks_ledger.json');
    let total = amount;
    try {
      const existing = JSON.parse(readFileSync(ledgerPath, 'utf-8')) as { total: number };
      total = (existing.total || 0) + amount;
    } catch { /* first entry */ }
    writeFileSync(ledgerPath, JSON.stringify({ total, updated: new Date().toISOString() }), 'utf-8');
    console.log(`[Marks] +${amount} for ${platform} connect. Total: ${total}`);
    return { ok: true, total };
  });

  // -- Mode ------------------------------------------------------------------
  safeHandle('get-frame-mode', () => ({
    mode: currentMode,
    forced_mode: substrateServer?.getForcedMode() ?? null,
  }));

  ipcMain.on('set-frame-mode', (_event, { mode }: { mode: FrameMode }) => {
    setMode(mode);
  });

  // Force or clear mode override (persists through auto-detect cycles)
  safeHandle('force-frame-mode', (_event, { mode }: { mode: FrameMode | null }) => {
    substrateServer?.setForcedMode(mode);
    if (mode !== null) setMode(mode);
    else runConnectivityPoll();
    rebuildTrayMenu();
    return { ok: true, forced_mode: substrateServer?.getForcedMode() ?? null };
  });

  // -- Overlay ---------------------------------------------------------------
  ipcMain.on('set-clickthrough', (_event, { enabled }: { enabled: boolean }) => {
    applyLBFrameClickthrough(enabled);
  });

  // -- Ollama ----------------------------------------------------------------
  safeHandle('get-ollama-status', async () => {
    return ollamaManager.getStatus();
  });

  safeHandle('pull-default-model', async () => {
    const reachable = await ollamaManager.isReachable();
    if (!reachable) return { success: false, error: 'Ollama not running' };
    const hasModel = await ollamaManager.hasFloorModel();
    if (hasModel) return { success: true, alreadyInstalled: true };
    try {
      await ollamaManager.pullModel(undefined, (progress) => {
        overlayWindow?.webContents.send('ollama-pull-progress', progress);
        dashboardWindow?.webContents.send('ollama-pull-progress', progress);
      });
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  // SEG-U-6: pull a user-named model with streaming progress
  safeHandle('pull-named-model', async (_event, { modelName }: { modelName: string }) => {
    const reachable = await ollamaManager.isReachable();
    if (!reachable) return { success: false, error: 'Ollama not running' };
    const hasModel = await ollamaManager.hasModel(modelName);
    if (hasModel) return { success: true, alreadyInstalled: true };
    try {
      await ollamaManager.pullModel(modelName, (progress) => {
        overlayWindow?.webContents.send('ollama-pull-progress', progress);
        dashboardWindow?.webContents.send('ollama-pull-progress', progress);
      });
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  // SEG-2 v0.1.56 — first-launch auto-pull with streaming progress + cancellation
  // AbortController is module-level closure so cancel can reach the in-flight request.
  let _floorPullAbort: AbortController | null = null;

  safeHandle('first-launch-model-check', async (_event, { modelName }: { modelName: string }) => {
    try {
      const model = modelName || 'gemma4:12b';
      const models = await ollamaManager.listModels();
      const exists = models.some(
        (m) => m === model || m.startsWith(model.split(':')[0]),
      );
      return { exists, modelName: model };
    } catch {
      return { exists: false, modelName: modelName || 'gemma4:12b' };
    }
  });

  safeHandle('first-launch-model-start', async (event, { modelName }: { modelName: string }) => {
    const model = modelName || 'gemma4:12b';

    // Abort any in-flight pull before starting a fresh one.
    _floorPullAbort?.abort();
    _floorPullAbort = new AbortController();
    const { signal } = _floorPullAbort;

    try {
      const reachable = await ollamaManager.isReachable();
      if (!reachable) {
        event.sender.send('first-launch-model-error', 'Local AI engine not running. Open the Home tab first.');
        return { ok: false, error: 'not reachable' };
      }

      const models = await ollamaManager.listModels();
      const exists = models.some(
        (m) => m === model || m.startsWith(model.split(':')[0]),
      );
      if (exists) {
        event.sender.send('first-launch-model-complete');
        return { ok: true, alreadyInstalled: true };
      }

      const res = await fetch('http://127.0.0.1:11434/api/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: model, stream: true }),
        signal,
      });

      if (!res.ok || !res.body) {
        const msg = `Pull request failed: ${res.statusText}`;
        event.sender.send('first-launch-model-error', msg);
        return { ok: false, error: msg };
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        if (signal.aborted) {
          reader.cancel().catch(() => {});
          event.sender.send('first-launch-model-error', 'Download cancelled.');
          return { ok: false, cancelled: true };
        }
        const { done, value } = await reader.read();
        if (done) break;

        const lines = decoder.decode(value).split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            const ev = JSON.parse(line) as {
              status: string;
              completed?: number;
              total?: number;
            };
            if (ev.status === 'success') {
              event.sender.send('first-launch-model-complete');
              return { ok: true };
            }
            const percent =
              ev.total && ev.completed != null
                ? Math.round((ev.completed / ev.total) * 100)
                : 0;
            event.sender.send('first-launch-model-progress', {
              percent,
              downloaded: ev.completed ?? 0,
              total: ev.total ?? 0,
              status: ev.status,
            });
          } catch { /* skip malformed lines */ }
        }
      }

      event.sender.send('first-launch-model-complete');
      return { ok: true };
    } catch (err) {
      if (signal.aborted) {
        event.sender.send('first-launch-model-error', 'Download cancelled.');
        return { ok: false, cancelled: true };
      }
      const msg = err instanceof Error ? err.message : String(err);
      event.sender.send('first-launch-model-error', msg);
      return { ok: false, error: msg };
    }
  });

  safeHandle('first-launch-model-cancel', () => {
    _floorPullAbort?.abort();
    _floorPullAbort = null;
    return { ok: true };
  });

  // SEG-V-1: live pre-flight check -- routes through OllamaManager as single source of truth.
  // Shared utility reused by ModelSetupProgress (SEG-V-1) and Layer2ProveIt model selector (SEG-V-4).
  safeHandle('check-ollama-and-model', async (_event, { modelName }: { modelName: string }) => {
    try {
      const status = ollamaManager.getStatus();
      const reachable = status.running || (await ollamaManager.isReachable());
      if (!reachable) {
        return {
          reachable: false,
          hasModel: false,
          models: [] as string[],
          error: 'Local AI engine not running. Open the Home tab to set up MnemosyneC.',
        };
      }
      const models = await ollamaManager.listModels();
      const hasModel = models.some(
        (m) => m === modelName || m.startsWith(modelName.split(':')[0])
      );
      return { reachable: true, hasModel, models };
    } catch (err) {
      return {
        reachable: false,
        hasModel: false,
        models: [] as string[],
        error: String(err),
      };
    }
  });

  // BP067 v0.1.24 ? transparent install + bundled Gemma floor
  safeHandle('setup-private-ai', async () => {
    const sendProgress = (p: import('./ollama_manager').EngineSetupProgress) => {
      overlayWindow?.webContents.send('engine-setup-progress', p);
      dashboardWindow?.webContents.send('engine-setup-progress', p);
    };
    return ollamaManager.ensureFloorModel(
      sendProgress,
      (pull) => {
        overlayWindow?.webContents.send('ollama-pull-progress', pull);
        dashboardWindow?.webContents.send('ollama-pull-progress', pull);
      },
    );
  });

  safeHandle('mark-bp067-first-run-complete', () => {
    markFirstRunComplete();
    return { ok: true };
  });

  // SEG-V0149-P0: lean-install-start — guided full-tier AI installation
  // Uses ollamaManager exclusively — zero new spawn() calls.
  safeHandle('lean-install-start', async (event) => {
    const emitStatus = (step: string, message: string) => {
      event.sender.send('lean-install-status', { step, message });
    };
    const emitProgress = (bytesDownloaded: number, totalBytes: number, speedLabel: string, eta_s: number) => {
      const percentComplete = totalBytes > 0 ? Math.round((bytesDownloaded / totalBytes) * 100) : 0;
      event.sender.send('lean-install-progress', { bytesDownloaded, totalBytes, percentComplete, speedLabel, eta_s });
    };
    const emitError = (message: string, retryable: boolean) => {
      event.sender.send('lean-install-error', { message, retryable });
    };

    try {
      // Step 1: Check if Ollama daemon is already running
      const status = ollamaManager.getStatus();
      if (status.running) {
        emitStatus('ollama_ready', 'Found your local AI engine. Setting up...');
      } else {
        // Step 2: Attempt to start Ollama (handles pre-installed → bundled → NONE internally)
        emitStatus('starting_engine', 'Starting your AI engine...');
        await ollamaManager.init();
        const statusAfterInit = ollamaManager.getStatus();
        if (!statusAfterInit.running) {
          // Neither pre-installed nor bundled found — send user to download page
          shell.openExternal('https://ollama.com/download/windows');
          emitStatus('waiting_ollama', 'Install Ollama, then click Resume.');
          return { ok: false, waitingForInstall: true };
        }
        emitStatus('ollama_ready', 'Found your local AI engine. Setting up...');
      }

      // Step 3: Check if full-tier model is already available
      const MODEL = 'gemma4:12b';
      const hasModel = await ollamaManager.hasModel(MODEL);
      if (hasModel) {
        emitStatus('model_ready', 'Full AI model already on your machine.');
      } else {
        emitStatus('pulling_model', `Downloading full AI model (${MODEL})...`);

        let lastBytes = 0;
        let lastTs = Date.now();

        await ollamaManager.pullModel(MODEL, (progress) => {
          const bytesDownloaded = progress.bytesDownloaded ?? progress.completed ?? 0;
          const totalBytes = progress.totalBytes ?? progress.total ?? 0;
          const now = Date.now();
          const elapsedSec = (now - lastTs) / 1000;
          const bytesDelta = bytesDownloaded - lastBytes;

          if (elapsedSec >= 1 && bytesDelta > 0) {
            const bytesPerSec = bytesDelta / elapsedSec;
            const remaining = totalBytes > bytesDownloaded ? totalBytes - bytesDownloaded : 0;
            const eta_s = bytesPerSec > 0 ? Math.round(remaining / bytesPerSec) : 0;
            const speedLabel = bytesPerSec >= 1_000_000
              ? `${(bytesPerSec / 1_000_000).toFixed(1)} MB/s`
              : `${(bytesPerSec / 1_000).toFixed(0)} KB/s`;
            lastBytes = bytesDownloaded;
            lastTs = now;
            emitProgress(bytesDownloaded, totalBytes, speedLabel, eta_s);
          }
        });
      }

      // Step 4: Write SKU tier file and signal completion
      writeFileSync(
        join(app.getPath('userData'), 'sku_tier.json'),
        JSON.stringify({ tier: 'full', model: 'gemma4:12b' }),
      );
      emitStatus('done', 'Your AI is ready.');
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      emitError(message, true);
      return { ok: false, error: message };
    }
  });

  safeHandle('ask-floor-model', async (_event, { prompt }: { prompt: string }) => {
    return ollamaManager.askFloorModel(prompt);
  });

  safeHandle('list-ollama-models', async () => {
    return ollamaManager.listModels();
  });

  // KniPr012 ? check if Ollama binary is installed (distinct from daemon running)
  safeHandle('check-ollama', async () => {
    const { execSync } = require('child_process');
    try {
      const out = execSync('ollama --version', { timeout: 3000 }).toString();
      return { installed: true, version: out.trim() };
    } catch {
      return { installed: false };
    }
  });

  safeHandle('check-disk-space', async () => {
    const ok = await ollamaManager.checkDiskSpace(6);
    return { ok, requiredGB: 6 };
  });

  // -- Substrate -------------------------------------------------------------

  // Route a query through the three-mode substrate router
  // Degraded mode (trial expired): allow substrate read, but block Ollama/cloud escalation
  safeHandle(
    'substrate-query',
    async (_event, { query, model }: { query: string; model?: string }) => {
      if (!substrateServer) return { hit: false, routing: 'miss', latency_ms: 0 };
      const degraded = authManager?.isDegraded() ?? false;
      try {
        const res = await fetch(`http://127.0.0.1:${_SUBSTRATE_PORT}/substrate/query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // In degraded mode, skip Ollama by omitting model and forcing Normal mode
          body: JSON.stringify({ query, model: degraded ? undefined : model, degraded }),
        });
        return await res.json();
      } catch {
        return { hit: false, routing: 'miss', latency_ms: 0 };
      }
    },
  );

  // Write a record to the local substrate index + queue federation sync
  // Blocked entirely in degraded mode
  safeHandle(
    'substrate-write',
    async (_event, { text, source, keywords }: { text: string; source?: string; keywords?: string[] }) => {
      if (authManager?.isDegraded()) {
        return { ok: false, reason: 'degraded_mode' };
      }
      try {
        const res = await fetch(`http://127.0.0.1:${_SUBSTRATE_PORT}/substrate/write`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, source, keywords }),
        });
        return await res.json();
      } catch {
        return { ok: false };
      }
    },
  );

  // -- Federation ------------------------------------------------------------
  safeHandle('get-federation-status', () => {
    return federationClient?.getStatus() ?? {
      online: false,
      peerCount: 0,
      lastSyncTs: null,
      lastSyncRecordsExchanged: 0,
      pendingWriteCount: 0,
      peers: [],
    };
  });

  safeHandle('set-member-token', (_event, { token }: { token: string | null }) => {
    federationClient?.setMemberToken(token);
    return { ok: true };
  });

  // -- AMPLIFY Telemetry -----------------------------------------------------
  safeHandle('get-amplify-snapshot', async () => {
    return substrateServer?.getAMPLIFYSnapshot() ?? {
      total_queries: 0,
      substrate_hits: 0,
      local_ollama_served: 0,
      cloud_escalations: 0,
      total_cloud_cost_avoided_usd: 0,
    };
  });

  // Full historical summary (today / week / month / daily breakdown / all-time)
  safeHandle('get-amplify-summary', () => {
    return substrateServer?.getTelemetryStore().getSummary() ?? null;
  });

  // -- Auto-Update -----------------------------------------------------------
  safeHandle('get-update-state', () => autoUpdater?.getState() ?? { status: 'idle' });
  ipcMain.on('check-for-updates', () => autoUpdater?.checkNow());
  ipcMain.on('install-update', () => autoUpdater?.installNow());

  // M21: Automatic update scheduler IPC (Block 2-6)
  registerAutoUpdateIPC();

  ipcMain.on('watchdog-pong', () => {
    rendererResponsive = true;
  });

  // -- App Version (MV-VERSION-DISPLAY BP044) --------------------------------
  safeHandle('get-app-version', () => {
    const version = app.getVersion();
    let buildHash = process.env.BUILD_HASH ?? '';
    if (!buildHash) {
      try {
        const { execSync } = require('child_process');
        buildHash = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
      } catch {
        buildHash = 'dev';
      }
    }
    return { version, buildHash };
  });

  // -- MoneyPenny Mobile -----------------------------------------------------
  safeHandle('get-moneypenny-url', () => ({
    url: getMoneyPennyURL(API_PORT),
    ips: getLocalIPs(),
    port: API_PORT,
  }));

  // -- Dashboard -------------------------------------------------------------
  ipcMain.on('open-dashboard', () => openDashboard());

  // -- Hearth App Builder (B69) ----------------------------------------------

  // Route hearth_app_build_request from Substrate-DM (intent class: hearth_app_build_request)
  safeHandle(
    'hearth-build',
    async (_event, { request, memberId }: { request: string; memberId?: string }) => {
      const wins = [overlayWindow, dashboardWindow];
      return runHearthBuild({ request, memberId: memberId ?? 'member', windows: wins });
    },
  );

  safeHandle(
    'hearth-install',
    async (
      _event,
      opts: {
        uuid: string;
        appName: string;
        description: string;
        appDir: string;
        installerPath: string;
        spec: unknown;
      },
    ) => {
      return runHearthInstall(opts as Parameters<typeof runHearthInstall>[0]);
    },
  );

  safeHandle('hearth-library-query', (_event, { memberId }: { memberId?: string } = {}) => {
    return getHearthLibrary(memberId);
  });

  safeHandle('hearth-uninstall', async (_event, { uuid }: { uuid: string }) => {
    return uninstallApp(uuid);
  });

  safeHandle('hearth-healthz', async () => {
    return getHearthHealthz();
  });

  safeHandle('hearth-spec-extract-smoke', async () => {
    return runSpecExtractSmoke();
  });

  // -- Hearth Conjunction Window (B83) -----------------------------------------

  ipcMain.on('open-hearth-conjunction', () => openHearthConjunctionWindow());

  // BP137 Yoke v2b Integration-1 Part 2: registered here (this file's one-time IPC-setup block,
  // guarded by safeHandle against a duplicate-registration throw) rather than literally inside
  // openHearthConjunctionWindow() -- that function re-runs its full body every time the window is
  // closed and reopened (see its own early-return-if-already-open guard above), and ipcMain.handle
  // throws on a second registration for the same channel with no built-in de-dup; safeHandle's
  // try/catch exists for exactly that reason (see this same function's `const safeHandle = ...`
  // above). Forwards to runBrowserAuthorityQueryFromMain() (defined next to
  // openHearthConjunctionWindow() above) for the actual window-forwarding logic; see that
  // function's header for the full mechanism + honest null-path enumeration. This channel is also
  // the one preload.ts's new runBrowserAuthorityQuery() contextBridge method invokes, so any
  // future renderer-side caller (not just plow_mc_answerer.ts's in-process bridge below) reaches
  // the exact same code path.
  safeHandle('nexus-browser-authority-run-query', (_event, query: BrowserAuthorityQuery) =>
    runBrowserAuthorityQueryFromMain(query),
  );

  // D-BP150-001/BISHOP/S01/seg-audible -- CALL AN AUDIBLE, the pending-pause table.
  //
  // A pause lives here between the moment the engine asks for it and the moment the operator
  // answers. Keyed by pauseId (unique per run, minted in audible.ts) rather than by run or by
  // window, because that is what makes a stale answer harmless: a response naming a pause that
  // has already been settled finds nothing in this map and is dropped, instead of resolving
  // whichever pause happens to be current.
  //
  // NOTHING IN HERE EXPIRES ON A TIMER, BY DESIGN. Founder, BP149, on the box that preceded
  // this: "it stops and lets me start typing, but then it assumes I abandoned, so I need it to
  // stop UNTIL I SAY GO." Entries are removed by exactly three events: the operator answers, the
  // operator's window is destroyed, or the run ends. See the run handler's releasePending().
  const PENDING_AUDIBLE_PAUSES = new Map<
    string,
    { resolve: (r: LianaAudibleResponse) => void; reject: (e: Error) => void }
  >();

  // D-BP151-023/BISHOP/seg-stepped-audible -- STEPPED AUDIBLE, the pending-pause table. Same
  // convention as PENDING_AUDIBLE_PAUSES above (keyed by pauseId, no timer -- see this ticket's
  // "no timeout, ever" rule in stepped_audible.ts's header): entries are removed only by the
  // operator answering, the operator's window being destroyed, or the run ending.
  // `runInputRaw` (D-BP152-025/BISHOP/seg-nexus-returns-answer) is ADDITIVE: the raw `input`
  // string ('liana-terminal-run''s own argument) this pause's run was started with, stashed
  // alongside resolve/reject so the 'nexus-authority-capture' handler below can label a capture
  // with "the run/qid it was captured during" without re-deriving or guessing it -- reused, not
  // re-parsed. Never read by the pre-existing 'liana-stepped-respond' handler, which is untouched.
  const PENDING_STEPPED_PAUSES = new Map<
    string,
    { resolve: (r: LianaSteppedResponse) => void; reject: (e: Error) => void; runInputRaw: string }
  >();

  // D-BP152-039 REMOVAL -- the 'liana-terminal-gate-env-state' handler used to live here,
  // wrapping getLianaTerminalGateEnvState() (liana_terminal_engine.ts) so the renderer's Survey
  // Splice toggle could show the effective env-var state before a run. That toggle was already
  // removed by D-BP152-012, and grep confirmed no renderer file ever called
  // window.electronAPI.lianaTerminalGateEnvState() -- zero callers. Per FD-BP152-20 the underlying
  // gate is removed (Survey now runs unconditionally, liana_terminal_engine.ts), so this
  // introspection handler has nothing left to introspect; removed together with it rather than
  // left wired to a function that no longer exists.

  // D-BP149-034/BISHOP/S34/seg-lianaterminal -- the Liana Cycle terminal. `askGoogle` is a
  // one-line closure around the SAME runBrowserAuthorityQueryFromMain() the line above uses (and
  // plow_mc_answerer.ts's Stage F2/F3 use) -- this is dependency injection so
  // liana_terminal_engine.ts never has to import this giant entry file, not a second Google path.
  // Streams every stage/fact/note/result line to the caller's own window as it happens
  // (event.sender.send, same push convention as 'ask-engine-progress') so the Founder watches the
  // cascade live instead of pasting console output back into a chat window.
  safeHandle('liana-terminal-run', async (event, { input, audible, steppedAudible, contingencyOperatorSurvey, ambiguityQueryTransport, mode }: { input: string; audible?: boolean; steppedAudible?: boolean; contingencyOperatorSurvey?: boolean; ambiguityQueryTransport?: 'google' | 'gemma'; mode?: 'automated' | 'assisted' }) => {
    // D-BP152-051/BISHOP/seg-assisted-mode. `mode` is OPTIONAL and defaults to 'automated' --
    // an older renderer, or the Founder simply not toggling it, produces exactly the run this
    // handler produced before this parameter existed. See this ticket's own comment below (next
    // to `assistedChannel`'s construction) for why it reuses the SAME pause map/IPC round trip as
    // `steppedChannel` immediately below rather than opening a second one, but is gated
    // INDEPENDENTLY of the `steppedAudible` boolean.
    // D-BP150-001 (Call an Audible). `audible` is OPTIONAL and defaults to off: an older
    // renderer, or the Founder simply not toggling it, produces exactly the run this handler
    // produced before this parameter existed (wrapAskGoogleWithAudible returns the unwrapped
    // function by reference when the channel is null -- see audible.ts).
    // D-BP151-023 (Stepped Audible). `steppedAudible` is likewise OPTIONAL/OFF-by-default and
    // independent of `audible` -- see stepped_audible.ts's header for what happens when both are
    // armed on the same run.
    // D-BP152-039 REMOVAL, ATTRIBUTED (FD-BP152-20: "fix the gate properly so survey doesn't need
    // the env var"; FD-BP152-09: "no modes and no flags"). `contingencyOperatorSurvey` is now
    // ACCEPTED-AND-IGNORED -- liana_terminal_engine.ts's runLianaCycleQuestion() no longer reads
    // it at all; Survey (Founder steps 2/3/4/6) runs unconditionally on every call. The parameter
    // is still threaded through here (rather than deleted from this handler's destructure) because
    // this is one of several lockstep callers (preload.ts, amplify.d.ts, LianaCycleTab.tsx, this
    // file's own contingency-operator test) and this ticket kept the parameter accepted rather
    // than half-removing it piecemeal -- see liana_terminal_engine.ts's own D-BP152-039 comment.
    // The formerly-cited isContingencyOperatorSurveySpliceEnabled()/CONTINGENCY_OPERATOR_SURVEY_
    // SPLICE gate no longer exists.
    // D-BP151-032 (Ambiguity Query Transport). `ambiguityQueryTransport` is likewise OPTIONAL --
    // UNCHANGED by this ticket (a separate, still-live gate) -- see
    // liana_terminal_engine.ts's resolveAmbiguityQueryTransport() for the gate (undefined ->
    // 'google', the Founder-ordered default; 'gemma' or AMBIGUITY_QUERY_TRANSPORT=gemma selects the
    // local model). D-BP152-011 added the renderer control (LianaCycleTab.tsx's transport
    // selector) that sets this parameter -- its untouched state sends `undefined`, so the env
    // override and the 'google' default both still work exactly as before.
    const sender = event.sender;
    const runPauseIds = new Set<string>();
    const runSteppedPauseIds = new Set<string>();

    // D-BP152-031/BISHOP/seg-wire-threading-to-callers -- ATTRIBUTED, Founder, BP152, verbatim:
    // "I want it threaded." Created ONCE here, per IPC call (i.e. per question) -- this IS the
    // "run" createNexusRunThreadContext()'s own header describes. A new Founder question is a new
    // 'liana-terminal-run' invocation, which creates a brand-new context with its own random
    // seed, so a later question can never continue an earlier one's thread even if askGoogle is
    // one day pointed at a conversational authority -- see that factory's own doc comment
    // (browser_authority_types.ts) for why this is structural, not caller discipline.
    const runThreadContext = createNexusRunThreadContext();

    // D-BP152-044/BISHOP/seg-last-mile-gemini -- ATTRIBUTED, Founder, BP152, verbatim: "fix the
    // last mile - let the liana cycle ask gemini". THE MEASURED WALL: SURVEY's two META-questions
    // (the ambiguity query, the operation query -- survey_stage.ts's askAmbiguity()/askOperation())
    // went to Google, a document lookup that cannot answer a question ABOUT a question (qid 98,
    // HARDWIRE\LEDGER\LIANA_RUNS\LIANA_RUN_qid98_2026-08-11T18-09-09-616Z.json, an off-topic
    // passage came back). This closure is the ONLY new piece of glue: it calls the EXISTING
    // runMachineDrivenNexusQueryFromMain() (D-BP152-033, defined above, itself unchanged by this
    // ticket) against 'user_gemini', reusing the SAME `runThreadContext` this handler already
    // creates (D-BP152-031, immediately above) so Gemini's own thread is keyed independently of
    // 'user_google' inside that factory's own Map -- NEVER SHARE A THREAD ACROSS AUTHORITIES.
    // `runMachineDrivenNexusQuery()` itself (nexus_authority_persistent_session.ts) already
    // contains the operator-engagement guard (a visible window refuses immediately) and the
    // text-stability completion detector with a firm ceiling -- REUSED UNCHANGED, not
    // reimplemented here. Any non-ok outcome (refused, ceiling with no text, failed) maps to
    // `ok: false`; survey_stage.ts's obtainMetaQuestionPassage() treats every `ok: false`
    // identically: fall back to the existing Google path. No judgment/rating/evaluation prompt is
    // ever built here -- `question` is passed through verbatim, exactly as
    // runMachineDrivenNexusQuery() forwards it to the composer (HARDWIRE-22 unaffected).
    const askConversationalAuthority: ConversationalAuthorityFn = async (question: string) => {
      const result = await runMachineDrivenNexusQueryFromMain('user_gemini', question, null, runThreadContext);
      if (!result.ok || !result.text.trim()) {
        return {
          ok: false,
          text: '',
          citations: [],
          via: `user_gemini:${result.outcome}${result.reason ? `(${result.reason})` : ''}`,
          authority: 'user_gemini',
        };
      }
      return {
        ok: true,
        text: result.text,
        citations: result.citations.map((c) => c.href),
        via: `user_gemini:${result.outcome}`,
        authority: 'user_gemini',
      };
    };

    // A pause that outlives its window would hang the run forever with nothing to answer it.
    // This is the ONLY non-operator way a pause ends -- there is deliberately no timer, per the
    // Founder's BP149 report that the previous box "assumes I abandoned" while he was still
    // typing.
    const releasePending = (why: string) => {
      for (const id of runPauseIds) {
        const p = PENDING_AUDIBLE_PAUSES.get(id);
        if (p) { PENDING_AUDIBLE_PAUSES.delete(id); p.reject(new Error(why)); }
      }
      runPauseIds.clear();
      for (const id of runSteppedPauseIds) {
        const p = PENDING_STEPPED_PAUSES.get(id);
        if (p) { PENDING_STEPPED_PAUSES.delete(id); p.reject(new Error(why)); }
      }
      runSteppedPauseIds.clear();
    };
    const onSenderGone = () => releasePending('window_closed');
    sender.once('destroyed', onSenderGone);

    const channel: AudibleChannel | null = audible
      ? {
          requestPause: (pause) =>
            new Promise<LianaAudibleResponse>((resolve, reject) => {
              if (sender.isDestroyed()) { reject(new Error('window_closed')); return; }
              runPauseIds.add(pause.pauseId);
              PENDING_AUDIBLE_PAUSES.set(pause.pauseId, { resolve, reject });
              try {
                sender.send('liana-audible-pause', pause);
              } catch {
                PENDING_AUDIBLE_PAUSES.delete(pause.pauseId);
                runPauseIds.delete(pause.pauseId);
                reject(new Error('window_closed'));
              }
            }),
        }
      : null;

    // D-BP151-023/BISHOP/seg-stepped-audible -- same shape as `channel` above, one level up
    // (per-step, not per-call).
    const steppedChannel: SteppedAudibleChannel | null = steppedAudible
      ? {
          requestStepPause: (pause) =>
            new Promise<LianaSteppedResponse>((resolve, reject) => {
              if (sender.isDestroyed()) { reject(new Error('window_closed')); return; }
              runSteppedPauseIds.add(pause.pauseId);
              PENDING_STEPPED_PAUSES.set(pause.pauseId, { resolve, reject, runInputRaw: input });
              try {
                sender.send('liana-stepped-pause', pause);
              } catch {
                PENDING_STEPPED_PAUSES.delete(pause.pauseId);
                runSteppedPauseIds.delete(pause.pauseId);
                reject(new Error('window_closed'));
              }
            }),
        }
      : null;

    // D-BP152-051/BISHOP/seg-assisted-mode -- SAME SHAPE, SAME MAP, SAME IPC EVENTS as
    // `steppedChannel` immediately above -- deliberately NOT a new pause map or a new IPC channel
    // (this ticket's own "do not build a second intake" requirement). Assisted mode's own pauses
    // carry a distinct pauseId prefix (`am-google<N>`, assisted_mode.ts) so they never collide
    // with Stepped Audible's `sp<N>` / Step 0's `sp0`/`sp0-google<N>` pauses even though all three
    // share this one map. GATED INDEPENDENTLY of `steppedAudible`: assisted mode must not silently
    // depend on the Stepped Audible bench toggle also being on, or turning assisted mode on with
    // steppedAudible off would silently degrade to automated (exactly what the Founder's ruling
    // forbids -- see runLianaCycleQuestion()'s own safety check, liana_terminal_engine.ts).
    const assistedChannel: SteppedAudibleChannel | null = mode === 'assisted'
      ? {
          requestStepPause: (pause) =>
            new Promise<LianaSteppedResponse>((resolve, reject) => {
              if (sender.isDestroyed()) { reject(new Error('window_closed')); return; }
              runSteppedPauseIds.add(pause.pauseId);
              PENDING_STEPPED_PAUSES.set(pause.pauseId, { resolve, reject, runInputRaw: input });
              try {
                sender.send('liana-stepped-pause', pause);
              } catch {
                PENDING_STEPPED_PAUSES.delete(pause.pauseId);
                runSteppedPauseIds.delete(pause.pauseId);
                reject(new Error('window_closed'));
              }
            }),
        }
      : null;

    // D-BP150-015 -- EVERY RUN IS PERSISTED, ESPECIALLY THE ONES THAT WORK.
    //
    // Founder, BP150: "Then write it so that all of that is saved, especially when it works."
    //
    // Until this, a run left exactly one line in a beat file: the verdict. The stage-by-stage
    // transcript -- every query sent, every fact returned, every elimination and its reason --
    // existed ONLY in the renderer's memory. Close the window and the evidence was gone.
    //
    // That bit at BP150. qid 98 answered A with basis "lowest densely populated among survivors,
    // 38.0x clear of the runner-up" -- the hard-number branch, which proves stages 3/4/5 returned
    // data for the first time since BP146. The proof of that was one sentence in a chat window.
    //
    // Worse, it was ASYMMETRIC: Audit the Run only offered itself on an abstain, so a FAILED run
    // could be walked and written to disk while a SUCCESSFUL one could not. The estate kept its
    // failures and discarded its successes.
    const events: LianaTerminalEvent[] = [];

    let outcome;
    try {
      outcome = await runLianaCycleQuestion(
        input,
        // D-BP152-031: threadId/continueThread now derived from runThreadContext (this run's own
        // thread-identity space) instead of being absent entirely. 'user_google' is NOT a
        // conversational authority (isInteractiveBrowserAuthority), so
        // runThreadContext.forQuery('user_google') always returns
        // { threadId: undefined, continueThread: false } -- byte-identical, spread-in, to what
        // this call site sent before this ticket (the two fields simply did not exist on the
        // query object). No query text, authority, ordering, or verdict logic changed.
        // D-BP152-050: buildLianaAskGoogle(runThreadContext) replaces the old inline
        // runBrowserAuthorityQueryFromMain(...) closure -- same question/authority/thread
        // wiring, byte-identical on a genuine extraction; only the failure path now carries a
        // real reason instead of a bare null (see that function's own header, above).
        buildLianaAskGoogle(runThreadContext),
        (evt) => {
          events.push(evt);
          try { sender.send('liana-terminal-event', evt); } catch { /* window may have closed mid-run */ }
        },
        channel,
        steppedChannel,
        contingencyOperatorSurvey,
        ambiguityQueryTransport,
        // D-BP152-044: SURVEY's two META-questions try this before falling back to `askGoogle`
        // above -- see this handler's own D-BP152-044 comment (immediately below the
        // `runThreadContext` it reuses) for the full ruling.
        askConversationalAuthority,
        // D-BP152-051: `mode`/`assistedChannel` -- undefined/null on every pre-existing caller,
        // so this call site's behavior for every caller that does not pass `mode` is
        // byte-identical to before this ticket (liana_terminal_engine.ts's own wrapper stamps
        // 'automated' onto the outcome either way -- see that file's header for why).
        mode,
        assistedChannel,
      );
    } finally {
      sender.removeListener('destroyed', onSenderGone);
      // Any pause still registered here belongs to a run that is over. Leaving one in the map
      // would leak an unresolvable promise and let a later, unrelated response resolve it.
      releasePending('run_ended');
    }
    // THE MIC: one heartbeat line per completed question, written to the EXISTING yoke ledger
    // heartbeat directory yoke_watcher.ts already polls -- makes a run visible to Bishop without
    // the Founder copying anything, which is the entire point (Founder, BP148/BP149).
    try {
      mkdirSync(YOKE_PATHS.HEARTBEAT_DIR, { recursive: true });
      const ts = new Date().toISOString();
      const label = outcome.qid != null ? `qid=${outcome.qid}` : 'qid=free-text';
      const verdictDesc = outcome.abstain ? 'ABSTAIN' : `verdict=${outcome.verdict}`;
      const line = `${ts}  LIANA-TERMINAL  ${label}  ${verdictDesc}${outcome.correct ? `  key=${outcome.correct}  ok=${outcome.ok}` : ''}\n`;
      appendFileSync(join(YOKE_PATHS.HEARTBEAT_DIR, 'LIANA-TERMINAL.beat'), line, 'utf8');
    } catch (e) {
      console.warn('[liana-terminal] heartbeat write failed (non-fatal):', e);
    }

    // D-BP150-015: the full receipt. Written for EVERY run, resolved or abstained, so a result
    // never again exists only in a window. Non-fatal by construction -- the answer was already
    // produced and the beat already written; a failed receipt must not turn a good run into an
    // error. Carries the verbatim event transcript, which is the only place the per-stage queries,
    // returned facts and elimination reasons are recorded.
    try {
      // Sibling of RETURNS at the LEDGER root, NOT inside YOKE. A run receipt is an estate record
      // like a dispatch return, not a yoke dispatch artifact. Derived from RETURNS_DIR (which is
      // join(LEDGER_ROOT,'RETURNS')) so '..' lands on LEDGER; the first version derived it from
      // HEARTBEAT_DIR, whose '..' is YOKE, and put receipts a level too deep.
      const runsDir = join(YOKE_PATHS.RETURNS_DIR, '..', 'LIANA_RUNS');
      mkdirSync(runsDir, { recursive: true });
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const slug = outcome.qid != null ? `qid${outcome.qid}` : 'free-text';
      const receipt = {
        schema: 'liana-run-receipt/1',
        writtenAt: new Date().toISOString(),
        input,
        qid: outcome.qid ?? null,
        question: outcome.question,
        options: outcome.options ?? null,
        method: outcome.method ?? null,
        verdict: outcome.verdict,
        correct: outcome.correct ?? null,
        ok: outcome.ok ?? null,
        abstain: outcome.abstain,
        basis: outcome.basis ?? null,
        error: outcome.error ?? null,
        audibleMode: Boolean(audible),
        audibleLog: outcome.audibleLog ?? null,
        steppedAudibleMode: Boolean(steppedAudible),
        steppedLog: outcome.steppedLog ?? null,
        // D-BP151-026: named so a receipt on disk states which variant produced the run without
        // needing to cross-reference the request that triggered it. outcome.variant is the
        // engine's own report (absent when off, per liana_terminal_types.ts); requestedMode is
        // what THIS call asked for, kept alongside it so a request that asked for the variant but
        // threw before reaching it (outcome.variant absent) is still visible in the receipt.
        contingencyOperatorSurveyRequested: Boolean(contingencyOperatorSurvey),
        // D-BP151-032: named so a receipt on disk states which transport was REQUESTED for the
        // ambiguity query without cross-referencing the request, same convention as
        // contingencyOperatorSurveyRequested immediately above. null when not requested (the
        // Google default still applies inside the engine; this field only records an explicit ask).
        ambiguityQueryTransportRequested: ambiguityQueryTransport ?? null,
        variant: outcome.variant ?? null,
        // D-BP152-016: SC-01 (pivot terms named and defined) already landed in `transcript` above
        // via the engine's own emit()/note() calls (same mechanism every other transcript line
        // uses) -- these two fields additionally carry the STRUCTURED result (or the scoring
        // error, mutually exclusive) so a reader does not have to re-parse transcript text to get
        // the numbers. null/absent whenever Survey Splice was off this run (SC-01 has nothing to
        // score) -- same "field's absence identifies the default path" convention `variant` above
        // already uses. Scoring cannot fail this write: outcome.sc01/.sc01ScoringError are already
        // resolved values by the time this handler runs; nothing here calls the scorer again.
        sc01: outcome.sc01 ?? null,
        sc01ScoringError: outcome.sc01ScoringError ?? null,
        eventCount: events.length,
        transcript: events,
      };
      const rp = join(runsDir, `LIANA_RUN_${slug}_${stamp}.json`);
      writeFileSync(rp, JSON.stringify(receipt, null, 2), 'utf8');
      console.log(`[liana-terminal] receipt written: ${rp} (${events.length} events)`);

      // D-BP152-016: the standalone SC-01 file, next to the run receipt it belongs to. Written
      // ONLY when a real (non-errored) SC-01 result exists for this run -- Survey Splice off, or a
      // thrown scorer, both produce nothing to write, not a fabricated empty file. Fully wrapped
      // in the SAME non-fatal try/catch as the receipt above: a failure here must not turn a good
      // run into an error, and must not affect the JSON receipt already written immediately above.
      if (outcome.sc01) {
        const sc01 = outcome.sc01;
        const lines: string[] = [];
        lines.push(`# SC-01 -- pivot terms named and defined -- qid ${sc01.qid} -- ${new Date().toISOString()}`);
        lines.push('');
        lines.push('No pass/fail, no promotion, no verdict -- numbers and the full, uncollapsed enumeration only (FD-BP152-10, FD-BP152-12).');
        lines.push('');
        lines.push(`Question: ${sc01.questionText}`);
        lines.push('');
        lines.push(`Strict count: ${sc01.strictCount}`);
        lines.push(`Diagnostics: named=${sc01.diagnostics.namedCount}  carried-triple=${sc01.diagnostics.tripleCount}  defined=${sc01.diagnostics.definedCount}`);
        lines.push(`Ambiguity query unusable: ${sc01.ambiguityQueryUnusable}`);
        lines.push('');
        lines.push(sc01.why);
        lines.push('');
        if (!sc01.terms.length) {
          lines.push('No terms named this run.');
        }
        for (const t of sc01.terms) {
          lines.push(`## "${t.term}"`);
          lines.push('');
          lines.push(`- verbatimInQuestion: ${t.verbatimInQuestion}`);
          lines.push(`- carriesTriple: ${t.carriesTriple}`);
          lines.push(`- hasNamedSourceDefinition: ${t.hasNamedSourceDefinition}`);
          lines.push(`- countsTowardStrictCount: ${t.countsTowardStrictCount}`);
          lines.push('');
          lines.push(`Enumerated meanings (${t.enumeratedMeanings.length}, full and uncollapsed):`);
          lines.push('');
          if (!t.enumeratedMeanings.length) {
            lines.push('(none found)');
          }
          t.enumeratedMeanings.forEach((m, i) => {
            lines.push(`${i + 1}. [from ${m.fromLevel}, register: ${m.register ?? 'unstated'}, source: ${m.sourceTitle || m.sourceUrl || '(no named source)'}]`);
            lines.push(`   "${m.sentence}"`);
          });
          lines.push('');
        }
        const sp = join(runsDir, `SC01_${slug}_${stamp}.md`);
        writeFileSync(sp, lines.join('\n'), 'utf8');
        console.log(`[liana-terminal] SC-01 file written: ${sp}`);
      }
    } catch (e) {
      console.warn('[liana-terminal] receipt write failed (non-fatal, the answer and beat stand):', e);
    }

    return outcome;
  });

  // D-BP152-043/BISHOP/seg-scratch-composer -- THE SCRATCH COMPOSER.
  //
  // 'liana-script-list-registry' is read-only: lists whatever library/method_registry.ts holds
  // AT THE MOMENT OF THE CALL (no caching here), so the composer panel shows an id a concurrent
  // dispatch registers after this ticket lands without this handler changing.
  safeHandle('liana-script-list-registry', async () => listComposerRegistry());

  // 'liana-script-run' is the ONE new run path. `steps` undefined/empty = THE DEFAULT, byte-
  // identical to 'liana-terminal-run' above (see script_bridge.ts's runScratchComposer() header
  // for exactly why: the same runLianaCycleQuestion() call, by reference, no wrapping). A
  // non-empty `steps` array runs that authored stack instead, through script_runner.ts
  // (D-BP152-041, unmodified). This handler does not write a run receipt or a heartbeat line --
  // that persistence (D-BP150-015) belongs to the pre-existing default path above; adding it here
  // too was not asked for by this ticket (HARDWIRE-23, "nothing more").
  safeHandle('liana-script-run', async (event, { input, steps }: { input: string; steps?: string[] }) => {
    const sender = event.sender;
    // D-BP152-031 convention (see 'liana-terminal-run' above): ONE thread-identity space per run
    // (per IPC call), not re-minted per query.
    const runThreadContext = createNexusRunThreadContext();
    // D-BP152-050: buildLianaAskGoogle(runThreadContext) replaces the old inline
    // runBrowserAuthorityQueryFromMain(...) closure -- see that function's own header, above.
    const askGoogle = buildLianaAskGoogle(runThreadContext);
    const emit = (evt: LianaTerminalEvent) => {
      try { sender.send('liana-terminal-event', evt); } catch { /* window may have closed mid-run */ }
    };
    return runScratchComposer(input, steps, askGoogle, emit);
  });

  // D-BP150-001/BISHOP/S01/seg-audible -- the operator answering one pause. Returns a plain
  // ok/reason rather than throwing on an unknown pauseId: a response for a pause that has
  // already been settled (double-click, a late click after the run ended, a reply from a stale
  // panel) is an ordinary condition, not an error, and must not surface to the operator as one.
  safeHandle('liana-audible-respond', async (_event, response: LianaAudibleResponse) => {
    const pending = PENDING_AUDIBLE_PAUSES.get(response.pauseId);
    if (!pending) return { ok: false, reason: 'no_such_pause' as const };
    PENDING_AUDIBLE_PAUSES.delete(response.pauseId);
    pending.resolve(response);
    return { ok: true as const };
  });

  // D-BP151-023/BISHOP/seg-stepped-audible -- the operator answering one STEP pause. Same
  // no-throw-on-unknown-pauseId convention as 'liana-audible-respond' above, same reason: a
  // response for a pause already settled is an ordinary condition, not an error.
  safeHandle('liana-stepped-respond', async (_event, response: LianaSteppedResponse) => {
    const pending = PENDING_STEPPED_PAUSES.get(response.pauseId);
    if (!pending) return { ok: false, reason: 'no_such_pause' as const };
    PENDING_STEPPED_PAUSES.delete(response.pauseId);
    pending.resolve(response);
    return { ok: true as const };
  });

  // D-BP150-002/BISHOP/S02/seg-notesrecall -- HIS EARLIER NOTES, INSIDE A LIVE PAUSE.
  // Founder, BP150: "post whichever of my notes I want into the textbox I'm typing in, so I don't
  // have to go read it, or do it from memory." Read-only: this handler never writes, never
  // deletes, and never edits a teaching file. An unreadable directory returns an empty list with
  // ok:true and a stated reason -- the caller shows "none found", which is not the same claim as
  // "none exist" (a tool's empty result is not evidence of absence).
  safeHandle('liana-notes-list', async (_event, args?: { label?: string }) => {
    try {
      return { ok: true as const, files: listTeachingFiles(args?.label) };
    } catch (e) {
      return { ok: false as const, files: [], error: e instanceof Error ? e.message : String(e) };
    }
  });

  // D-BP149-043/BISHOP/S43/seg-method2build -- THE TEACH BOX. method_registry.ts's own header
  // named the gap: "The terminal can ask and cannot listen. It reports 'recognized shape, not
  // yet taught' [or 'no method matches'] and gives the operator nowhere to teach it." This
  // channel is that missing input path. It writes the operator's own words, VERBATIM, to a
  // teaching file on disk for a human to read and implement from later -- it NEVER auto-generates
  // a method from the text, and it never paraphrases, summarizes, or reformats what was typed.
  // Founder, BP149: "I DESPISE SUMMARIES." Mirrors METHOD_2_TEACHING_BP149.md's own shape (the
  // hand-authored teaching file this ticket's Method 2 was built from) so a human reading either
  // file finds the same structure.
  safeHandle('liana-teach-submit', async (_event, args: {
    teachingText: string;
    question: string;
    options: Record<string, string> | null;
    qid?: number;
    shapeTestSummary: string;
    // D-BP149-044/BISHOP/S44/seg-steppedmode -- STEPPED WALK, ADDITIVE. When present, this
    // submission came from the stepped-walk panel (Founder BP149: "I want to see a stepped
    // version of what actually happens ... I guide, I train ... and you record"), not the plain
    // Teach box. Same channel, same write-to-disk mechanism, different content shape -- per the
    // ticket's own instruction to extend the existing teach-submit IPC path rather than add a
    // second one. Every field the operator typed is written VERBATIM, one response per step,
    // never parsed or acted on (HARDWIRE-22: the operator's words are a record for a human to
    // read later, not an instruction this pipeline executes).
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
  }) => {
    try {
      const dropzoneDir = 'C:\\Users\\Administrator\\Documents\\LianaBanyanPlatform\\BISHOP_DROPZONE';
      mkdirSync(dropzoneDir, { recursive: true });
      const slugSource = args.qid != null ? `qid${args.qid}` : args.question;
      const slug = (slugSource || 'untitled')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 60) || 'untitled';
      const utc = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
      const fileName = `METHOD_TEACHING_${slug}_${utc}.md`;
      const filePath = join(dropzoneDir, fileName);

      const optionsBlock = args.options && Object.keys(args.options).length
        ? Object.entries(args.options).map(([L, t]) => `${L}) ${t}`).join('\n')
        : '(no lettered option list -- typed as a bare question)';

      let content: string;
      if (args.steppedWalk) {
        const { steps, abandoned, abandonedAtStep } = args.steppedWalk;
        const total = steps.length ? steps[0].total : 0;
        const stepBlocks = steps.map((s) => {
          const lines = s.lines.map((l) => `[${l.kind}] ${l.text}`).join('\n');
          const resp = s.response && s.response.trim() ? s.response : '(no response -- advanced without annotation)';
          return `### STEP ${s.index + 1} of ${s.total}\n\n${lines}\n\n**Operator's response at this step, verbatim:**\n\n${resp}\n`;
        }).join('\n---\n\n');
        const status = abandoned
          ? `ABANDONED at step ${(abandonedAtStep ?? steps.length - 1) + 1} of ${total} -- everything collected up to that point is recorded below.`
          : `WALK COMPLETED -- all ${total} step(s) reached.`;
        content = `# STEPPED WALK TEACHING -- ${args.qid != null ? `qid ${args.qid}` : 'free-text question'}, submitted via the Liana Cycle terminal's stepped walk

Written by the LianaCycleTab.tsx stepped-walk panel (D-BP149-044). Founder, BP149: "I want to see
a stepped version of what actually happens: 1. I want the actual question asked with the answer
options as the first response then pause and wait for my response, then when I hit go, show the
next step, and I will give my response on that." The operator walked this ALREADY-COMPLETED run
step by step and typed an optional annotation at each pause. Responses below are reproduced
VERBATIM -- never paraphrased, summarized, or reformatted, and NONE of them changed how this run
executed (HARDWIRE-22: extraction only, never judgment -- stepping changes the pacing, not the
division of labor). A human reads this file and implements any correction by hand.

## THE QUESTION THAT TRIGGERED THIS

${args.question}

${optionsBlock}

## THE SHAPE TEST / OUTCOME AT WALK TIME

${args.shapeTestSummary}

## STATUS

${status}

## THE STEPS, IN ORDER

${stepBlocks}

---

*Written ${new Date().toISOString()} by the Liana Cycle terminal's stepped walk.*
`;
      } else {
        content = `# METHOD TEACHING -- ${args.qid != null ? `qid ${args.qid}` : 'free-text question'}, submitted via the Liana Cycle terminal's Teach box

Written by the LianaCycleTab.tsx Teach box (D-BP149-043). The operator's own words below are
reproduced VERBATIM -- never paraphrased, summarized, or reformatted. A human reads this file
and implements the method by hand; nothing in this pipeline auto-generates code from it.

## THE QUESTION THAT TRIGGERED THIS

${args.question}

${optionsBlock}

## THE SHAPE TEST RESULT AT SUBMIT TIME

${args.shapeTestSummary}

## THE OPERATOR'S TEACHING, VERBATIM

${args.teachingText}

---

*Written ${new Date().toISOString()} by the Liana Cycle terminal Teach box.*
`;
      }
      writeFileSync(filePath, content, 'utf-8');
      const bytes = Buffer.byteLength(content, 'utf-8');

      // D-BP150-008 -- THE TEACHING IS THE WAKE.
      //
      // Founder, BP150: "how do I ask the question I am asking you right now, from mnemosynec:
      // 'Please take what I wrote and apply it'". Until this line, the answer was that he could
      // not: a teaching file landed on disk and NOTHING told Bishop it had arrived. He wrote a
      // full method spec for qid 92 at 23:58Z and Bishop only found it because he mentioned it
      // in chat -- which is the exact thing this channel exists to make unnecessary.
      //
      // The mechanism is already here and was simply never pointed at this event. 'liana-terminal
      // -run' above writes a beat into the SAME yoke HEARTBEAT directory Bishop's Mic polls
      // (yoke_watch_v4.sh). A submitted teaching is at least as much a beat as a completed run.
      // Estate doctrine, proven BP147: THE FILE IS THE WAKE -- writing it IS notifying the other
      // actor, and Bishop must never ask the Founder to relay.
      //
      // Non-fatal by construction: a teaching that was written to disk must never be reported as
      // failed because a notification could not be appended. The file is the deliverable; the
      // beat is the courtesy.
      try {
        mkdirSync(YOKE_PATHS.HEARTBEAT_DIR, { recursive: true });
        appendFileSync(
          join(YOKE_PATHS.HEARTBEAT_DIR, 'D-BP150-TEACH.beat'),
          `${new Date().toISOString()}  LIANA-TEACHING  ${args.qid != null ? `qid=${args.qid}` : 'qid=free-text'}  ${bytes}B  ${filePath}\n`,
          'utf8',
        );
      } catch (e) {
        console.warn('[liana-teach] beat write failed (non-fatal, the teaching file is already on disk):', e);
      }

      return { ok: true, filePath, bytes };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  });

  // BP138 Yoke 0.9.15 FIX 1 -- main-process side of webview_preload.ts's IPC-relay logging.
  // That file's guest context is sandboxed (Electron 31 default) and can no longer touch
  // fs/path directly -- see its own header for the full CDP-verified root-cause writeup. This
  // handler does the actual mkdirSync/appendFileSync, writing to the SAME path the old
  // in-webview fs code targeted (%APPDATA%\AMPLIFY Computer\hearth_conjunction\
  // embedded_browser_injection.jsonl). ipcMain.on (not safeHandle/ipcMain.handle) because the
  // preload uses fire-and-forget ipcRenderer.send, not ipcRenderer.invoke -- there is no reply
  // to send back. Deliberately fail-soft: a logging failure here must never crash main or
  // surface back to the sandboxed webview in any way that could be mistaken for a real feature
  // failure (same contract webview_preload.ts's own try/catch already documents).
  ipcMain.on('embedded-browser-injection-log', (_event, payload: Record<string, unknown>) => {
    try {
      const logDir = resolve(
        process.env.APPDATA || process.env.HOME || '.',
        'AMPLIFY Computer',
        'hearth_conjunction',
      );
      mkdirSync(logDir, { recursive: true });
      appendFileSync(
        resolve(logDir, 'embedded_browser_injection.jsonl'),
        JSON.stringify(payload) + '\n',
        'utf8',
      );
    } catch {
      /* non-fatal -- see webview_preload.ts's logInjectionEvent for the matching fail-soft contract */
    }
    // (this fix pass) STEP 3 diagnostics: the claude_interactive_* events webview_preload.ts's
    // runClaudeInteractiveQuery now emits at every stage (composer-found/not-found/typed/
    // submitted/streaming-detected/stream-complete/scraped/empty-scrape/timeout) are relayed here
    // over the SAME fire-and-forget channel every other logInjectionEvent call already uses --
    // this is the only place they can reach this (unsandboxed) main process. Print them to the
    // console with the SAME `claude_interactive:` prefix the main-side logs above use, so the
    // Founder's terminal shows one continuous, ordered stage-by-stage trace instead of only the
    // jsonl file. Never let a malformed/oversized payload break the fail-soft contract above.
    try {
      const event = payload?.event;
      if (typeof event === 'string' && event.startsWith('claude_interactive')) {
        const { event: _e, ts: _ts, ...details } = payload;
        const stage = event.replace(/^claude_interactive_?/, '') || '(unnamed)';
        console.log(`claude_interactive: ${stage}`, details);
      }
    } catch {
      /* diagnostics must never break the real feature -- same fail-soft contract as above */
    }
  });

  // BP148 D-BP148-029 (SEG per-arm-routing): reads the Nexus per-arm authority assignment for
  // the 'lookup_fact' arm LIVE off the main app window's (overlayWindow) own localStorage via
  // executeJavaScript. There is deliberately no cross-process mirror for this specific setting
  // to read instead: nexus_authority_flags.json (nexus_authority_persistent_session.ts) only
  // ever mirrors the two master-switch booleans, never the per-arm object -- confirmed by direct
  // read of that file's own header, which documents this exact gap as still open. Reading it
  // live this way, rather than adding a new push-on-save leg to
  // nexus_authority_settings_store.ts's savePerArmAuthority(), avoids any change to
  // src/renderer/** (owned by concurrent SEGs this pass; see this ticket's OWNS/DO-NOT-EDIT
  // split) -- overlayWindow already exists, already has the Settings UI's page loaded, and this
  // file already probes its window.amplify state the same way elsewhere (see the preload-smoke
  // checks near createOverlayWindow()). Returns null (never throws) for every failure mode: no
  // window, executeJavaScript rejected, unparseable JSON, or the 'lookup_fact' key absent/not one
  // of the four known values -- planNexusLookupAuthorityRouting() treats null exactly like an
  // explicit 'local_free', which is today's unrestricted behavior, unchanged.
  async function readNexusLookupArmAuthorityAssignment(): Promise<NexusLookupAssignedAuthority | null> {
    if (!overlayWindow || overlayWindow.isDestroyed()) return null;
    try {
      // Key literal must stay byte-identical to nexus_authority_settings_store.ts's private
      // LS_NEXUS_PER_ARM constant (not exported -- that file is renderer-owned, out of scope
      // this pass); 'lookup_fact' must stay byte-identical to that file's NexusArmName literal
      // for this arm (browser_authority_types.ts's NexusArmName union).
      const raw = await overlayWindow.webContents.executeJavaScript(
        `(function () { try { return window.localStorage.getItem('mnemo_nexus_per_arm_authority'); } catch (e) { return null; } })()`,
      );
      if (typeof raw !== 'string') return null;
      const parsed = JSON.parse(raw) as { lookup_fact?: unknown } | null;
      const value = parsed?.lookup_fact;
      if (value === 'local_free' || value === 'user_google' || value === 'user_perplexity' || value === 'paid_api') {
        return value;
      }
      return null;
    } catch (err) {
      console.warn('[nexus-ask-lookup-fact] per-arm assignment read failed (non-fatal, treated as unassigned):', err);
      return null;
    }
  }

  // BP138 Yoke 0.9.15 FIX 4 -- Ask tab's raw-fact lookup entry point. Renderer-side
  // (LeanAskTab.tsx) already checked nexus_authority_settings_store.ts's own
  // researchArmMode/researchArmBrowserAuthority flags before ever calling this; this handler
  // independently re-checks isNexusAuthorityFlagEnabled() (the main-process mirror) as its own
  // gate -- same defense-in-depth convention Stage F3's mesh-synergy block already documents
  // ("does NOT bypass the real safety gate"). Classification reuses classifyAnswerType()
  // directly (the SAME function Stage F2 calls, not a duplicate) -- only 'lookup_fact' ever
  // attempts a browser-authority call; 'computable'/'reasoning' return usable:false immediately,
  // no webview/network side effect at all. Returns the FIRST usable hit -- never both, never
  // fabricated, never a partial result. Every non-hit path (flag off, not a lookup_fact, no
  // authority returned anything) resolves { usable: false }, which LeanAskTab.tsx's caller
  // treats as "fall through to the existing local-Ollama path", never a thrown error.
  //
  // BP148 D-BP148-029: WHICH authorities get tried is now governed by the per-arm assignment
  // (see readNexusLookupArmAuthorityAssignment/planNexusLookupAuthorityRouting above/imported)
  // instead of unconditionally trying both. An unassigned/'local_free'/'paid_api' arm still
  // tries both, google-first, byte-identical to pre-ticket behavior. An arm explicitly assigned
  // to ONE browser authority tries ONLY that one first; if it comes back with nothing usable,
  // the handler falls back to the other authority too (never silently fails the arm) and marks
  // that fallback visibly via perArmFellBack/perArmFallbackReason on whatever result it returns,
  // alongside perArmAssignedAuthority/perArmRestrictedTo so a caller can always tell what
  // actually happened, not just what was configured.
  safeHandle('nexus-ask-lookup-fact', async (_event, { question }: { question: string }) => {
    const trimmed = typeof question === 'string' ? question.trim() : '';
    const answerType = classifyAnswerType(trimmed);
    if (answerType !== 'lookup_fact') {
      // BP139: distinct reason code so future diagnosis never has to guess again whether a
      // no-source answer was "not lookup_fact" vs "authority returned nothing" (previously both
      // looked identical to the caller -- see this handler's own header comment). Additive only;
      // LeanAskTab.tsx's honest fallthrough behavior is unchanged either way.
      return { answerType, usable: false as const, reason: 'not_lookup_fact' as const };
    }
    if (!isNexusAuthorityFlagEnabled()) {
      return { answerType, usable: false as const, reason: 'flag_off' as const };
    }
    const bridge: BrowserAuthorityBridge = {
      async runQueryInUserBrowser(query) {
        return runBrowserAuthorityQueryFromMain(query);
      },
    };

    const perArmAssignedAuthority = await readNexusLookupArmAuthorityAssignment();
    const routingPlan = planNexusLookupAuthorityRouting(perArmAssignedAuthority);
    console.log(
      `[nexus-ask-lookup-fact] per-arm routing: assigned=${perArmAssignedAuthority ?? '(unreadable/none)'} restrictedTo=${routingPlan.restrictedTo ?? '(none, trying both)'} order=[${routingPlan.authoritiesToTry.join(', ')}]`,
    );

    for (const authority of routingPlan.authoritiesToTry) {
      try {
        const fact = await getRawBrowserAuthorityFact(
          trimmed,
          { researchArmMode: true, researchArmBrowserAuthority: true, preferredAuthority: authority },
          bridge,
        );
        if (fact) {
          return {
            answerType, usable: true as const, ...fact,
            perArmAssignedAuthority, perArmRestrictedTo: routingPlan.restrictedTo, perArmFellBack: false,
          };
        }
      } catch (err) {
        console.warn(`[nexus-ask-lookup-fact] ${authority} lookup threw (non-fatal, honest null):`, err);
      }
    }

    // BP148 D-BP148-029: restricted-single-authority fallback -- the assigned authority produced
    // nothing usable (not signed in, session expired, genuinely no result). Fall back to trying
    // the OTHER authority too, same as today's un-per-arm-routed behavior, rather than silently
    // failing the arm or silently substituting an authority the user didn't ask for -- both the
    // fact that a fallback happened and why are carried on whichever result this returns.
    if (routingPlan.restrictedTo) {
      const fallbackAuthority = otherNexusBrowserAuthority(routingPlan.restrictedTo);
      console.log(`[nexus-ask-lookup-fact] assigned authority ${routingPlan.restrictedTo} returned nothing usable -- falling back to ${fallbackAuthority}`);
      try {
        const fact = await getRawBrowserAuthorityFact(
          trimmed,
          { researchArmMode: true, researchArmBrowserAuthority: true, preferredAuthority: fallbackAuthority },
          bridge,
        );
        if (fact) {
          return {
            answerType, usable: true as const, ...fact,
            perArmAssignedAuthority, perArmRestrictedTo: routingPlan.restrictedTo,
            perArmFellBack: true, perArmFallbackReason: 'assigned_authority_unavailable' as const,
          };
        }
      } catch (err) {
        console.warn(`[nexus-ask-lookup-fact] ${fallbackAuthority} fallback lookup threw (non-fatal, honest null):`, err);
      }
    }

    // BP139: both authorities were tried and neither returned a usable fact -- distinct from the
    // 'not_lookup_fact' and 'flag_off' reasons above so a future diagnosis can tell "genuinely
    // asked the authority and got nothing" apart from "never asked at all".
    return {
      answerType, usable: false as const, reason: 'authority_empty' as const,
      perArmAssignedAuthority, perArmRestrictedTo: routingPlan.restrictedTo,
      perArmFellBack: !!routingPlan.restrictedTo,
      ...(routingPlan.restrictedTo ? { perArmFallbackReason: 'assigned_authority_unavailable' as const } : {}),
    };
  });

  // BP138 Yoke Phase 1: Answer Coroner IPC handler -- queries Supabase for benchmark answer
  // history and returns a classified roundup. Additive-only; never touches the operational
  // Coroner Scribe. Safe to call from the benchmark modal or the terminal runner.
  safeHandle('plow:run-answer-coroner', async (_event, opts: {
    sessionFilter?: string;
    limit?: number;
  }) => {
    try {
      const { runAnswerCoroner } = await import('./plow/answer_coroner');
      const roundup = await runAnswerCoroner({
        sessionFilter: opts.sessionFilter,
        limit: opts.limit ?? 500,
        onProgress: (msg) => {
          for (const w of BrowserWindow.getAllWindows()) {
            if (!w.isDestroyed()) w.webContents.send('plow:coroner-progress', { msg });
          }
        },
      });
      return { ok: true, roundup };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[plow:run-answer-coroner] failed:', msg);
      return { ok: false, error: msg };
    }
  });

  // BP139 Founder Yoke: Answer Coroner over the CURRENT run's own outcomes -- classifies the
  // QuestionOutcome[] the renderer already has in memory/localStorage from the benchmark run
  // the Founder just did, instead of the 500-row Supabase relay_route_replies dump above. No
  // network call; synchronous classification via the same classifyCore(...) the WAN path uses
  // (see answer_coroner.ts's classifyLocalOutcome/runAnswerCoronerOnLocalOutcomes).
  safeHandle('plow:run-answer-coroner-local', async (_event, opts: {
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
  }) => {
    try {
      const { runAnswerCoronerOnLocalOutcomes } = await import('./plow/answer_coroner');
      // BP140 Yoke: runAnswerCoronerOnLocalOutcomes is now genuinely async (it persists a
      // factVerdict-tagged eblet per ensemble candidate as it classifies) -- must be awaited so
      // `roundup` below is the real CoronerRoundup, not an unresolved Promise sent over IPC.
      const roundup = await runAnswerCoronerOnLocalOutcomes(opts.outcomes ?? [], {
        onProgress: (msg) => {
          for (const w of BrowserWindow.getAllWindows()) {
            if (!w.isDestroyed()) w.webContents.send('plow:coroner-progress', { msg });
          }
        },
      });
      return { ok: true, roundup };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[plow:run-answer-coroner-local] failed:', msg);
      return { ok: false, error: msg };
    }
  });

  // BP137 0.9.12 Stage F1 (build item 3, Settings "Authorities" panel wire): four new,
  // additive-only IPC channels. See nexus_authority_persistent_session.ts's header for the full
  // mechanism -- every one of these is a thin forward to that module's own flag-gated,
  // honesty-firewalled functions, no new logic lives in this file's handlers themselves.
  safeHandle(
    'nexus-authority-set-flags',
    (_event, { researchArmMode, researchArmBrowserAuthority }: { researchArmMode: boolean; researchArmBrowserAuthority: boolean }) => {
      setNexusAuthorityBrowserFlags(!!researchArmMode, !!researchArmBrowserAuthority);
      // Idempotent: creates the persistent session immediately if the flags just turned on
      // (no app restart required); no-ops (returns null internally) if they're off.
      ensureNexusAuthoritySession();
      return { ok: true, enabled: isNexusAuthorityFlagEnabled() };
    },
  );

  safeHandle('nexus-authority-open-signin', (_event, { authority }: { authority: BrowserAuthorityName }) => {
    const opened = showNexusAuthoritySessionForSignIn(authority);
    return { ok: opened, reason: opened ? null : 'flag_off_or_unavailable' };
  });

  safeHandle('nexus-authority-hide-signin', () => {
    hideNexusAuthoritySession();
    return { ok: true };
  });

  safeHandle('nexus-authority-check-signin-status', async () => {
    const statuses = await probeAllNexusAuthorityStatuses();
    return { enabled: isNexusAuthorityFlagEnabled(), statuses };
  });

  // D-BP152-025/BISHOP/seg-nexus-returns-answer -- THE OPERATOR PRESSED CAPTURE.
  //
  // Founder, BP152, ruled "do the second one, make the nexus surface return what I type." This is
  // the one new side-effecting channel that ticket adds: fires ONLY when the Nexus window's own
  // "Capture -> Liana Cycle" button is clicked (nexus_authority_persistent_session.ts's embedder
  // script) -- never on a timer, never on navigation, never speculatively.
  //
  // Resolves the CURRENTLY-PENDING Step 0 pause (the same ask-google-this loop,
  // requestStepZeroPause(), stepped_audible.ts -- pauseIds 'sp0'/'sp0-google<N>') with a
  // 'nexus_capture' response, exactly the way 'liana-stepped-respond' resolves one from the
  // renderer's own Step 0 text box for 'ask_google'. Deliberately conservative about WHICH pause
  // to resolve: if none is waiting, or if more than one is (two concurrent runs both mid-loop --
  // pauseId collision risk this ticket does not own or fix, see PROCESS SAFETY note in its own
  // deliverable), this refuses rather than guessing which run to feed captured data into --
  // feeding the wrong run would be worse than feeding none.
  safeHandle('nexus-authority-capture', async () => {
    const capture = await captureNexusAuthorityVisibleText();
    if (!capture.ok) {
      return { ok: false, reason: capture.reason ?? 'capture_failed' };
    }
    // D-BP152-051 WIDENED THIS FILTER, ATTRIBUTED (this ticket's own requirement 4: "receive the
    // answer through the EXISTING capture path -- do not build a second intake"). Was
    // `sp0`/`sp0-google*` only (Step 0's own loop); now also matches `am-google*`
    // (assisted_mode.ts's per-call pauses) so the SAME "Capture -> Liana Cycle" button resolves
    // whichever of the two is currently pending. Still refuses on more than one match rather than
    // guessing which run to feed -- unchanged discipline, just a wider candidate set.
    const capturablePauseIds = Array.from(PENDING_STEPPED_PAUSES.keys()).filter(
      (k) => k === 'sp0' || k.startsWith('sp0-google') || k.startsWith('am-google'),
    );
    if (capturablePauseIds.length === 0) {
      return { ok: false, reason: 'no_paused_run' };
    }
    if (capturablePauseIds.length > 1) {
      return { ok: false, reason: 'ambiguous_multiple_paused_runs' };
    }
    const pauseId = capturablePauseIds[0];
    const pending = PENDING_STEPPED_PAUSES.get(pauseId);
    if (!pending) {
      return { ok: false, reason: 'no_such_pause' };
    }
    PENDING_STEPPED_PAUSES.delete(pauseId);
    pending.resolve({
      pauseId,
      action: 'nexus_capture',
      nexusCapturedText: capture.text,
      nexusSurface: capture.authority,
      nexusUrl: capture.url,
      nexusContainerUsed: capture.containerUsed,
      nexusCitations: capture.citations,
      nexusRunContext: pending.runInputRaw,
    });
    return { ok: true };
  });

  // D-BP152-028/BISHOP/seg-nexus-browser-bar -- ADDRESS BAR, HISTORY, BOOKMARKS. Founder,
  // BP152, verbatim: "it would be most useful ... if we put in the browser Bar and bookmarks ...
  // just run the Google Chrome Browser." The address bar and back/forward/reload/stop controls
  // need NO new IPC channel at all -- they call the <webview> tag's own loadURL/goBack/
  // goForward/reload/stop/canGoBack/canGoForward directly from the embedder page's own script
  // (nexus_authority_persistent_session.ts's buildEmbedderHtml()). Bookmarks persist to disk
  // (see nexus_authority_bookmarks_store.ts's own header for the chosen path and why), so they
  // are the only piece that needs a main-process round trip: the embedder page's script has no
  // fs access (nodeIntegration stays false on this window, unchanged by this ticket).
  safeHandle('nexus-authority-bookmarks-list', async () => ({
    ok: true,
    bookmarks: listNexusAuthorityBookmarks(),
  }));

  safeHandle('nexus-authority-bookmarks-add', async (_event, { url, title }: { url: string; title: string }) => (
    addNexusAuthorityBookmark(url, title)
  ));

  safeHandle('nexus-authority-bookmarks-remove', async (_event, { id }: { id: string }) => (
    removeNexusAuthorityBookmark(id)
  ));

  // BP041 SAGA 3 ? Watch View toggle
  // hideToWatchView: hides the conjunction window while keeping the overlay + substrate alive.
  // The FrameModeIndicator overlay remains visible (it's a separate transparent window).
  // Member restores by clicking the OverlayTag or pressing Ctrl+Shift+M (global shortcut below).
  safeHandle('hide-to-watch-view', () => {
    if (hearthConjunctionWindow && !hearthConjunctionWindow.isDestroyed()) {
      hearthConjunctionWindow.hide();
    }
    return { ok: true };
  });

  safeHandle('show-hearth-conjunction', () => {
    if (hearthConjunctionWindow && !hearthConjunctionWindow.isDestroyed()) {
      hearthConjunctionWindow.show();
      hearthConjunctionWindow.focus();
    } else {
      openHearthConjunctionWindow();
    }
    return { ok: true };
  });

  safeHandle('conjunction-get-state', () => conjunctionRouter.getState());

  safeHandle('conjunction-get-availability', () => conjunctionRouter.getAvailability());

  safeHandle(
    'conjunction-select',
    (_event, { mode }: { mode: import('./hearth/conjunction/types').ConjunctionMode }) =>
      conjunctionRouter.selectMode(mode),
  );

  safeHandle(
    'conjunction-set-override',
    (_event, { mode }: { mode: import('./hearth/conjunction/types').ConjunctionMode }) => {
      const state = conjunctionRouter.getState();
      void state; // state is available; update override via internal path
      conjunctionRouter.selectMode(mode); // temporary ? proper override wired below
      return { ok: true };
    },
  );

  safeHandle(
    'conjunction-dispatch',
    async (
      _event,
      { prompt, mode_override }: {
        prompt: string;
        mode_override?: import('./hearth/conjunction/types').ConjunctionMode;
      },
    ) => {
      const dispatchId = (await import('crypto')).randomUUID();
      recordWaveDispatch(dispatchId, 'hearth_conjunction');
      try {
        const result = await conjunctionRouter.dispatch(prompt, mode_override);
        recordWaveComplete(dispatchId);
        // Broadcast Drekaskip state update to conjunction window
        hearthConjunctionWindow?.webContents.send('drekaskip-state-updated');
        return result;
      } catch (err) {
        recordWaveComplete(dispatchId, String(err));
        throw err;
      }
    },
  );

  safeHandle('conjunction-get-substrate-context', async () => {
    return buildSubstrateContext();
  });

  // -- Drekaskip bridge (B83c) -----------------------------------------------

  safeHandle('drekaskip-query', async () => {
    return querySagaState();
  });

  // -- Watchdog bridge (B83d) ------------------------------------------------

  safeHandle('watchdog-status', async () => {
    return pollWatchdogStatus();
  });

  safeHandle(
    'watchdog-history',
    async (_event, { subject, window_hours }: { subject: string; window_hours?: number }) => {
      return getSubjectHistory(subject, window_hours);
    },
  );

  // -- Scribe Monitor ? BP041 SAGA 2 ----------------------------------------

  safeHandle(
    'scribe-toggle-monitor',
    (_event, { scribeId, on }: { scribeId: string; on: boolean }) => {
      return toggleMonitor(scribeId, on);
    },
  );

  safeHandle(
    'scribe-get-metrics',
    (_event, { scribeIds }: { scribeIds: string[] }) => {
      if (!scribeIds || scribeIds.length === 0) {
        // Return current enabled states as minimal summaries for initial hydration
        const states = getAllMonitorStates();
        return Object.entries(states).map(([scribe_id, monitor_enabled]) => ({
          scribe_id,
          monitor_enabled,
          monitored_since: null,
          event_count: 0,
          total_speed_delta_ms: 0,
          total_accuracy_delta: 0,
          total_cost_delta_tokens: 0,
          avg_speed_delta_ms: 0,
          avg_accuracy_delta: 0,
          avg_cost_delta_tokens: 0,
          last_updated: null,
        }));
      }
      return getMetrics(scribeIds);
    },
  );

  // -- In Conjunction Agent Panel ? SAGA 4 BP041 ----------------------------

  safeHandle(
    'agent-probe',
    async (_event, { agentId, force, modelId }: { agentId: string; force?: boolean; modelId?: string }) => {
      return agentProbeHandler(agentId, { force, modelId });
    },
  );

  safeHandle(
    'agent-set-api-key',
    (_event, { agentId, keyValue }: { agentId: string; keyValue: string }) => {
      // R16: key value must never be logged ? handler passes directly to setApiKey
      return agentSetApiKeyHandler(agentId, keyValue);
    },
  );

  safeHandle('agent-get-api-key-status', () => {
    return agentGetApiKeyStatusHandler();
  });

  safeHandle('agent-get-tier-choices', () => {
    return agentGetTierChoicesHandler();
  });

  safeHandle(
    'agent-set-tier-choice',
    (_event, { agentId, tierId }: { agentId: string; tierId: string }) => {
      return agentSetTierChoiceHandler(agentId, tierId);
    },
  );

  safeHandle('agent-get-plugins', () => {
    return agentGetPluginsHandler();
  });

  safeHandle('agent-get-plugin-registry', () => {
    return agentGetPluginRegistryHandler();
  });

  // Webview preload path ? renderer needs this to wire the <webview> preload attribute
  ipcMain.on('get-webview-preload-path', (event) => {
    event.returnValue = join(__dirname, 'hearth', 'embedded_browser', 'webview_preload.js');
  });

  // -- Adaptive Concurrency Carrier ? Layer 4 (hot-tune panel) -------------

  safeHandle('concurrency-get-cap', () => {
    return getCapInfo();
  });

  safeHandle('concurrency-probe-now', async () => {
    const entry = await probeConcurrencyCap();
    return { cap: entry.cap, probed_at: entry.probed_at, tier: entry.account_tier_hint };
  });

  safeHandle('concurrency-set-override', (_event, { n }: { n: number | null }) => {
    setCapOverride(n);
    return { ok: true, effective_cap: n };
  });

  // -- On-Deck Master-of-Ceremonies (BP037) ----------------------------------

  safeHandle('on-deck-list', () => {
    return listOnDeck();
  });

  // -- Pantheon ? Pixie Dust Mining (BP041 SAGA 1) ---------------------------

  safeHandle('pantheon-pick-folder', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Choose a folder for Pixie Dust Mining',
      properties: ['openDirectory'],
      buttonLabel: 'Begin Mining',
    });
    return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0];
  });

  safeHandle('pantheon-get-prefs', (_event, { memberId }: { memberId: string }) => {
    const { getFolderPrefs } = require('./pantheon/folder_prefs') as typeof import('./pantheon/folder_prefs');
    return getFolderPrefs(memberId);
  });

  safeHandle('pantheon-set-pref', (_event, args: {
    memberId: string;
    folderPath: string;
    pixelated: boolean;
    federationShared: boolean;
    subfolderOverrides?: import('./pantheon/folder_prefs').SubfolderOverride[];
  }) => {
    const { setFolderPref } = require('./pantheon/folder_prefs') as typeof import('./pantheon/folder_prefs');
    return setFolderPref(args.memberId, args.folderPath, args.pixelated, args.federationShared, args.subfolderOverrides);
  });

  safeHandle('pantheon-remove-pref', (_event, { memberId, folderPath }: { memberId: string; folderPath: string }) => {
    const { removeFolderPref } = require('./pantheon/folder_prefs') as typeof import('./pantheon/folder_prefs');
    removeFolderPref(memberId, folderPath);
    return { ok: true };
  });

  safeHandle('pantheon-dispatch', async (_event, {
    memberId,
    folderPath,
    sharingScope,
  }: {
    memberId: string;
    folderPath: string;
    sharingScope: 'private' | 'federation';
  }) => {
    const { dispatchPantheon } = require('./pantheon/orchestrator') as typeof import('./pantheon/orchestrator');
    return dispatchPantheon(
      { member_id: memberId, folder_path: folderPath, sharing_scope: sharingScope, personas: ['shadow_sprite', 'forager', 'miner', 'pixies', 'shadow_spider', 'fates'], session: 'BP041' },
      (evt) => {
        hearthConjunctionWindow?.webContents.send('pantheon-progress', evt);
      },
    );
  });

  safeHandle('pantheon-list-tablets', (_event, { memberId, grade, persona }: {
    memberId: string;
    grade?: 'iron' | 'stone';
    persona?: string;
  }) => {
    const { listTablets } = require('./pantheon/tablet_store') as typeof import('./pantheon/tablet_store');
    return listTablets(memberId, { grade, persona: persona as import('./pantheon/types').PersonaId | undefined });
  });

  safeHandle('pantheon-count-tablets', (_event, { memberId }: { memberId: string }) => {
    const { countTablets } = require('./pantheon/tablet_store') as typeof import('./pantheon/tablet_store');
    return countTablets(memberId);
  });

  safeHandle('pantheon-wipe', (_event, { memberId }: { memberId: string }) => {
    const { wipeTablets } = require('./pantheon/tablet_store') as typeof import('./pantheon/tablet_store');
    return wipeTablets(memberId);
  });

  safeHandle('pantheon-active-sessions', () => {
    const { getActiveSessions } = require('./pantheon/orchestrator') as typeof import('./pantheon/orchestrator');
    return getActiveSessions();
  });

  // -- Phoebe? Idea Storage IPC (C.17 ? BP055) -----------------------------
  const _phoebeIdeas: Array<{ id: string; title: string; content: string; timestamp: string }> = [];
  safeHandle('save-idea', async (_event, idea: { title: string; content: string; timestamp: string }) => {
    const id = `idea_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    _phoebeIdeas.push({ id, ...idea });
    return { ok: true, id };
  });
  safeHandle('get-ideas', async () => {
    return { ok: true, ideas: [..._phoebeIdeas].reverse() };
  });

  // -- Pearl-decode IPC (Tier G ? v0.1.16 ? BP057 W5c) ---------------------
  safeHandle('decode-pearl', async (_event, pearlId: string) => {
    try {
      const fs = await import('fs');
      const path = await import('path');
      const registryPath = path.join(
        'C:\\Users\\Administrator\\Documents\\LianaBanyanPlatform\\Asteroid-ProofVault\\pearl_registry',
        'PEARL_REGISTRY_INDEX.json'
      );
      if (!fs.existsSync(registryPath)) {
        return { ok: false, error: 'Pearl registry not found on substrate' };
      }
      const registry = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
      const pearl = (registry.pearls as Array<Record<string, string>>).find(
        (p) => p.pearl_id === pearlId || p.canonical_ref === pearlId
      );
      if (!pearl) {
        return { ok: false, error: `Pearl not found: ${pearlId}` };
      }
      const canonDir = 'C:\\Users\\Administrator\\.claude\\state\\eblets\\CANON';
      const candidates = [
        path.join(canonDir, `${pearl.canonical_ref}.eblet.md`),
        path.join(canonDir, `canon_${pearl.canonical_ref}.eblet.md`),
      ];
      for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
          const content = fs.readFileSync(candidate, 'utf-8');
          return { ok: true, pearl, content };
        }
      }
      return {
        ok: true,
        pearl,
        content: `# ${pearl.canonical_ref}\n\n**Pearl ID:** ${pearl.pearl_id}\n**Class:** ${pearl.class}\n**Caithedral:** ${pearl.cathedral}\n**Wave:** ${pearl.wave}\n\n*Eblet source not found on local substrate ? canonical_ref: ${pearl.canonical_ref}*`,
      };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  });

  // -- Caithedral Tools IPC (BP060 Application 002 Step 1) -----------------
  registerCaithedralToolsIPC();

  // -- BP084 SEG-3: Substrate Awakens join-live-mesh flow -------------------
  registerSubstrateAwakensIPC();

  // -- Bridge IPC (BP060 Application 002 Steps 3+4 ? UI-7 live Yoke wire) --
  registerBridgeIPC();

  // -- Battery Dispatch v0.3.0 publish fan-out (BP082) ----------------------
  registerDispatchIPC();

  // -- AI Dispatch IPC (BP060 Application 002 Steps 3+4 ? UI-8 backend) ----
  registerAiDispatchIPC();

  // -- Query Capture Archive IPC (D-BP151-037/BISHOP/seg-query-capture-archive) --
  registerQueryCaptureIPC();

  // -- BP087 Wave 5: Alexandrian Catacombs IPC ----------------------------------
  void (async () => {
    const {
      bootstrapCatacombs,
      getManifest,
      listEblets,
    } = await import('./catacombs/folder_bootstrap');
    const { fetchCategoryPackage, prefetchAll } = await import('./catacombs/eblet_package_fetcher');
    const { contributeToCategory } = await import('./catacombs/contribute_to_category');
    const { checkAccess } = await import('./catacombs/license_gate');

    // Bootstrap on registration (idempotent -- sentinel prevents re-run)
    bootstrapCatacombs().catch((err) => console.warn('[Catacombs] Bootstrap non-fatal:', err));

    safeHandle('catacombs:bootstrap', async () => bootstrapCatacombs());
    safeHandle('catacombs:fetch-package', async (_e: unknown, slug: string) => fetchCategoryPackage(slug));
    safeHandle('catacombs:prefetch-all', async () => prefetchAll());
    safeHandle('catacombs:get-manifest', async (_e: unknown, slug: string) => getManifest(slug));
    safeHandle('catacombs:list-eblets', async (_e: unknown, slug: string) => listEblets(slug));
    safeHandle('catacombs:contribute', async (_e: unknown, slug: string, content: string, memberId: string) =>
      contributeToCategory(slug, content, memberId)
    );
    safeHandle('catacombs:check-access', async (_e: unknown, memberId: string, operation: string) =>
      checkAccess(memberId, operation as 'read' | 'contribute')
    );
    safeHandle('catacombs:search', async (_e: unknown, params: { slug: string; query: string }) =>
      listEblets(params.slug)
    );
  })();

  // -- BP094 v0.8.0: CSIA-Hybrid Inference Pipeline IPC --------------------
  void (async () => {
    const { runCSIAHybridPipeline } = await import('./csia_hybrid/inference_pipeline');
    safeHandle('csia:query', async (_e: unknown, question: string) => {
      try {
        return await runCSIAHybridPipeline(question);
      } catch (err) {
        console.error('[CSIA] IPC handler error:', err);
        return { verdict: 'REFUSAL', refusal_reason: String(err), provenance: [], system_prompt_used: '', model_used: 'unknown', star_chamber: 'SKIP', scrambler: 'SKIP', keys_engines: 'SKIP', green_count: 0, run_id: 'error', elapsed_ms: 0, evidence_count: 0 };
      }
    });
  })();

  // -- BP087 Wave 3 SEG-C1: Thunderclap trial fire IPC ----------------------
  registerThunderclapFireIPC();

  // -- BP087 Wave 3 SEG-E1: Gemma multi-seg dispatch IPC --------------------
  registerGemmaMultiSegIPC();

  // -- BP083 SEG-5: MEMORY.md IPC handlers (My Self-Context panel) ----------
  registerMemoryScaffoldIPC();

  // -- v0.4.0 BP083: MIC Dispatcher + The Diagnosis IPC handlers ------------
  registerMicIpc();
  registerDiagnosisIpc();
  // -- KN-BP144-16 Phase 1: LAN discovery opt-out (default: refuse unauthenticated) -----------
  registerMeshTrustSettingsIpc();

  // -- app:request-quit (renderer-invokable graceful quit) --------------------
  ipcMain.handle('app:request-quit', () => { app.quit(); });

  // -- Kitchen Table? + Atlas? + P2P (BP052 v0.1.8) ------------------------
  registerKitchenTableIpc(ipcMain);

  // -- LB Account + Frontier Node IPC (BP065 Part A/B ? SEG-C2a/B2b) ---------

  safeHandle('lb:start-auth', async (_event, { email }: { email: string }) => {
    return startLBAuthFlow(email);
  });

  safeHandle('lb:get-session', async () => {
    const session = getLBSession();
    if (!session) return { linked: false };
    return {
      linked: true,
      user_id: session.user_id,
      email: session.email,
      peer_id: session.peer_id,
      linked_at: session.linked_at,
      crewman_number: session.crewman_number,
    };
  });

  safeHandle('lb:link-device', async (_event, { access_token, refresh_token, email }: { access_token: string; refresh_token: string; email: string }) => {
    const result = await completeLBAuth(access_token, refresh_token, email);
    if (result.ok && result.session) {
      // Broadcast lb:auth-complete to all windows
      const wins = [dashboardWindow, hearthConjunctionWindow, overlayWindow];
      for (const win of wins) {
        if (win && !win.isDestroyed()) {
          win.webContents.send('lb:auth-complete', {
            user_id: result.session.user_id,
            email: result.session.email,
            peer_id: result.session.peer_id,
            crewman_number: result.session.crewman_number,
          });
        }
      }
    }
    return { ok: result.ok, error: result.error };
  });

  safeHandle('lb:revoke-device', async () => {
    return lbRevokeDevice();
  });

  // Frontier node: heartbeat timer state
  let frontierHeartbeatTimer: ReturnType<typeof setInterval> | null = null;
  const FRONTIER_HEARTBEAT_MS = 5 * 60 * 1000; // 5 minutes

  function startFrontierHeartbeat(accessToken: string, peerId: string): void {
    stopFrontierHeartbeat();
    const supabaseUrl = getSupabaseUrl();
    const anonKey = getAnonKey();
    if (!supabaseUrl || !anonKey) return;
    const hbUrl = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/frontier-node-heartbeat`;
    frontierHeartbeatTimer = setInterval(async () => {
      try {
        await fetch(hbUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}`, apikey: anonKey },
          body: JSON.stringify({ peer_id: peerId }),
        });
      } catch {
        // Heartbeat errors are non-fatal ? logged silently
      }
    }, FRONTIER_HEARTBEAT_MS);
  }

  function stopFrontierHeartbeat(): void {
    if (frontierHeartbeatTimer !== null) {
      clearInterval(frontierHeartbeatTimer);
      frontierHeartbeatTimer = null;
    }
  }

  // Frontier node status stored in-memory (supplement with safeStorage if needed in future)
  let _frontierNodeId: string | null = null;

  safeHandle('lb:register-frontier-node', async () => {
    const session = getLBSession();
    if (!session) return { ok: false, error: 'LB Account not linked. Link first.' };
    const supabaseUrl = getSupabaseUrl();
    const anonKey = getAnonKey();
    if (!supabaseUrl || !anonKey) return { ok: false, error: 'Platform config not available.' };
    try {
      const { getStablePeerId } = await import('./federation/peer-discovery');
      const peerId = await getStablePeerId();
      const regUrl = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/frontier-node-register`;
      const resp = await fetch(regUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}`, apikey: anonKey },
        body: JSON.stringify({ peer_id: peerId, app_version: app.getVersion(), node_label: `MnemosyneC ${app.getVersion()}` }),
      });
      const data = await resp.json() as { registered?: boolean; frontier_node_id?: string; error?: string };
      if (!resp.ok) return { ok: false, error: data.error ?? `Register failed (${resp.status})` };
      _frontierNodeId = data.frontier_node_id ?? null;
      startFrontierHeartbeat(session.access_token, peerId);
      return { ok: true, frontier_node_id: data.frontier_node_id };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  safeHandle('lb:withdraw-frontier-node', async () => {
    stopFrontierHeartbeat();
    const session = getLBSession();
    if (!session) { _frontierNodeId = null; return { ok: true }; }
    const supabaseUrl = getSupabaseUrl();
    const anonKey = getAnonKey();
    if (!supabaseUrl || !anonKey) { _frontierNodeId = null; return { ok: true }; }
    try {
      const { getStablePeerId } = await import('./federation/peer-discovery');
      const peerId = await getStablePeerId();
      const withdrawUrl = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/frontier-node-register`;
      await fetch(withdrawUrl, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}`, apikey: anonKey },
        body: JSON.stringify({ peer_id: peerId }),
      });
    } catch {
      // Non-fatal
    }
    _frontierNodeId = null;
    return { ok: true };
  });

  safeHandle('lb:get-frontier-status', async () => {
    return {
      registered: _frontierNodeId !== null,
      frontier_node_id: _frontierNodeId ?? undefined,
    };
  });

  // -- Frontier Borrow (WAVE-24) ----------------------------------------------
  // "Your computer is busy -- borrow a trusted node."
  // Opt-in only. Returns a borrow ticket with cost disclosure.
  const _borrowOptIn = { enabled: false, trustList: [] as string[] };

  safeHandle('lb:get-borrow-status', () => ({
    borrow_opt_in: _borrowOptIn.enabled,
    trust_list: _borrowOptIn.trustList,
  }));

  safeHandle('lb:set-borrow-opt-in', (_event, { enabled }: { enabled: boolean }) => {
    _borrowOptIn.enabled = enabled;
    return { ok: true };
  });

  safeHandle('lb:request-frontier-borrow', async () => {
    if (!_borrowOptIn.enabled) {
      return { ok: false, error: 'Borrow opt-in not enabled. Toggle it on first.' };
    }
    // Session check -- must be linked
    const session = getLBSession();
    if (!session) {
      return { ok: false, error: 'Link your LB account first to access Frontier nodes.' };
    }
    // Cost disclosure: always $0 transport, ~$0.01 compute
    return {
      ok: true,
      cost_transport_usd: 0,
      cost_compute_usd_approx: 0.01,
      node_count: _borrowOptIn.trustList.length,
      disclosure: 'Borrow is opt-in only. Cost: $0 transport, ~$0.01 compute per inference on a trusted Frontier node.',
    };
  });

  // Opt-In Strike Tracker IPC stubs (renderer primarily uses localStorage; IPC for cross-window sync)
  const _optInStore = { strikes: 0, lastShown: null as number | null, decision: 'pending' as string };

  safeHandle('lb:opt-in-get-state', () => ({ ..._optInStore }));

  safeHandle('lb:opt-in-record-strike', () => {
    _optInStore.strikes = Math.min(_optInStore.strikes + 1, 3);
    _optInStore.lastShown = Date.now();
    return { ok: true };
  });

  safeHandle('lb:opt-in-set-decision', (_event, { decision }: { decision: string }) => {
    _optInStore.decision = decision;
    return { ok: true };
  });

  // -- SubstratedFolderWatcher? (SAGA-? v0.1.10) ----------------------------
  if (folderWatcher) registerWatcherIpc(folderWatcher);

  safeHandle('watcher:open-folder-dialog', async () => {
    return dialog.showOpenDialog({ properties: ['openDirectory'] });
  });

  // -- DAG Bridge status (BP067 Correction 2) --------------------------------
  safeHandle('dag:emit-status', () => {
    return { emitted: getDagEmitCount() };
  });

  // -- Trail Eblet Reader (KniPr035) -----------------------------------------
  safeHandle('trail-eblet:list', async () => {
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');
    const os = require('os') as typeof import('os');
    const trailsDir = path.join(os.homedir(), '.claude', 'state', 'eblets', 'TRAILS');
    if (!fs.existsSync(trailsDir)) return { files: [], dir: trailsDir };
    const files = fs.readdirSync(trailsDir)
      .filter((f: string) => f.endsWith('.eblet.md'))
      .sort((a: string, b: string) => a.localeCompare(b));
    return { files, dir: trailsDir };
  });

  safeHandle('trail-eblet:read', async (_event, { filePath }: { filePath: string }) => {
    const fs = require('fs') as typeof import('fs');
    if (!fs.existsSync(filePath)) return { ok: false, error: 'File not found' };
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return { ok: true, content };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  });

  safeHandle('trail-eblet:list-screenshots', async (_event, { ebletPath }: { ebletPath: string }) => {
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');
    const screenshotsDir = path.join(path.dirname(ebletPath), 'screenshots');
    if (!fs.existsSync(screenshotsDir)) return { files: [], dir: screenshotsDir };
    const files = fs.readdirSync(screenshotsDir)
      .filter((f: string) => /\.(png|jpg|jpeg|webp|gif)$/i.test(f));
    return { files, dir: screenshotsDir };
  });

  safeHandle('trail-eblet:read-screenshot', async (_event, { filePath }: { filePath: string }) => {
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');
    if (!fs.existsSync(filePath)) return { ok: false };
    try {
      const buf = fs.readFileSync(filePath);
      const ext = path.extname(filePath).toLowerCase().slice(1);
      const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
        : ext === 'png' ? 'image/png'
        : ext === 'webp' ? 'image/webp'
        : 'image/gif';
      return { ok: true, dataUrl: `data:${mime};base64,${buf.toString('base64')}` };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  });

  // -- MV-CN Peer Mesh (SAGA 3 BP045 W1) -------------------------------------
  safeHandle('get-mesh-state', () => ({
    peers: peerDiscovery?.getAllPeers() ?? [],
    relayConnected: relayClient?.isConnected() ?? false,
    ownPeerId: peerDiscovery ? (() => { const { getStablePeerId: gsp } = require('./federation/peer-discovery'); return gsp(); })() : '',
  }));

  // BP134 Yoke #30 Task B: zero-config WAN auto-connect -- surfaces + connects peers
  // already present in the shared peer_presence table (bundled publishable key, no
  // invite-token exchange required to be visible) instead of forcing a manual token
  // swap for every peer. Fired only from the renderer's existing user-click "Connect to
  // other machines" / "Refresh Scan" gesture (LeanGauntletTab.tsx handleConnect) -- never
  // on a timer -- to preserve the "discovery fires only on user click" rule already
  // documented on that panel (BP081 A1.3). The invite-token flow (CueDeckShareTab.tsx)
  // remains available as a fallback for peers not yet in presence.
  safeHandle('federation:auto-connect-presence', async (): Promise<{
    attempted: number; connected: string[]; error?: string;
  }> => {
    if (!peerDiscovery) {
      return { attempted: 0, connected: [], error: 'peer discovery not initialized' };
    }
    const { discoverAndConnectPresencePeers } = await import('./federation/presence_autoconnect');
    const { collectLanAddresses } = await import('./identity/peerIdentityCollector');
    const selfPeerId = getStablePeerId();
    const knownPeerIds = new Set(peerDiscovery.getAllPeers().map((p) => p.peerId));
    return discoverAndConnectPresencePeers({
      selfPeerId,
      hostLanAddresses: collectLanAddresses(),
      knownPeerIds,
      registerWANPeer: (peer) => peerDiscovery?.registerWANPeer(peer),
      sendIdentify: (toPeerId) => {
        if (relayClient?.isConnected()) {
          relayClient.sendToPeer(toPeerId, {
            type: 'identify',
            peerId: selfPeerId,
            payload: {
              peerId: selfPeerId,
              version: app.getVersion(),
              pubkeyFingerprint: selfPeerId,
            },
            ts: new Date().toISOString(),
          });
        }
      },
      relayConnected: relayClient?.isConnected() ?? false,
    });
  });

  safeHandle('get-own-peer-id', () => getStablePeerId());

  safeHandle('get-boot-zombie-count', () => ({ count: _bootZombieCount }));

  safeHandle('call-test-my-box', async (_ev, peerIdArg?: string) => {
    const peerId = peerIdArg || getStablePeerId();
    const supabaseUrl = (
      process.env.SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      'https://ruuxzilgmuwddcofqecc.supabase.co'
    ).replace(/\/$/, '');
    const anonKey =
      getAnonKey();
    if (!anonKey) {
      return { ok: false, error: 'Supabase key not configured' };
    }
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/test-my-box`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': anonKey,
          'Authorization': `Bearer ${anonKey}`,
        },
        body: JSON.stringify({ peer_id: peerId }),
      });
      const data = await res.json();
      return data;
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  });

  // BP086 F4b: relay tier returned by wan-relay-publish
  safeHandle('get-relay-tier', () => ({ tier: getCurrentTier() }));

  // BP104 D5a: machine label read/write (%APPDATA%\\MnemosyneC\\config\\peer_label.txt)
  safeHandle('get-machine-label', async () => {
    const { getMachineLabel } = await import('./identity/peerIdentityCollector');
    return getMachineLabel(getStablePeerId());
  });
  safeHandle('set-machine-label', async (_event, label: string) => {
    const { setMachineLabel } = await import('./identity/peerIdentityCollector');
    return setMachineLabel(label);
  });

  // -- BP072 ? Paired-Frame Mutual-Aid IPC ----------------------------------

  safeHandle('paired-frame:get-status', () => {
    return pairedFrameManager?.getStatus() ?? {
      paired: false,
      pairedPeerId: null,
      pairedAt: null,
      assistModeActive: false,
      assistModeEnabled: false,
      missedHeartbeats: 0,
      lastPartnerContactAt: null,
    };
  });

  safeHandle('paired-frame:request-pairing', (_ev, { peerId, displayName }: { peerId: string; displayName?: string }) => {
    if (!pairedFrameManager) return { ok: false, error: 'PairedFrameManager not initialized' };
    pairedFrameManager.requestPairing(peerId, displayName);
    return { ok: true };
  });

  safeHandle('paired-frame:accept-pairing', (_ev, { peerId, displayName }: { peerId: string; displayName?: string }) => {
    if (!pairedFrameManager) return { ok: false, error: 'PairedFrameManager not initialized' };
    pairedFrameManager.acceptPairing(peerId, displayName);
    return { ok: true };
  });

  safeHandle('paired-frame:reject-pairing', (_ev, { peerId, reason }: { peerId: string; reason?: string }) => {
    if (!pairedFrameManager) return { ok: false, error: 'PairedFrameManager not initialized' };
    pairedFrameManager.rejectPairing(peerId, reason);
    return { ok: true };
  });

  safeHandle('paired-frame:unpair', (_ev, { reason }: { reason?: string } = {}) => {
    if (!pairedFrameManager) return { ok: false, error: 'PairedFrameManager not initialized' };
    pairedFrameManager.unpair(reason);
    return { ok: true };
  });

  // -- MESH-6: SID-targeted peer fetch ----------------------------------------
  safeHandle(
    'federation:fetch-sid',
    async (
      _ev,
      dag_id: string,
      peerId: string,
    ): Promise<{ ok: boolean; node?: DagNode; hash_verified: boolean; error?: string }> => {
      const peer = peerDiscovery?.getAllPeers().find((p) => p.peerId === peerId);
      if (!peer) {
        return { ok: false, hash_verified: false, error: `peer ${peerId} not in mesh` };
      }
      const reqMsg: FedMsg = {
        type: 'sid_fetch_request',
        peerId: getStablePeerId(),
        payload: {
          dag_id,
          requester_peer_id: getStablePeerId(),
        } satisfies SidFetchRequestPayload,
        ts: new Date().toISOString(),
      };
      if (peer.transport === 'lan') {
        return await _fetchSidViaTCP(peer, dag_id, reqMsg);
      } else {
        return await _fetchSidViaRelay(peerId, dag_id, reqMsg);
      }
    },
  );

  // -- MESH-6: Federation invite/accept/leave ----------------------------------
  // §2 Truth-Always (SEG-V0153A): SUPABASE_URL + SUPABASE_ANON_KEY are available
  // in the main process via process.env (pattern confirmed at lines ~2411–2413).
  // No dedicated Supabase client — all Supabase calls use fetch() directly.
  // sender_peer_id is getStablePeerId() (local machine ID), NOT a Supabase user_id.
  safeHandle(
    'federation:generate-invite',
    async (): Promise<
      | { ok: true; token: string; expiresAt: string }
      | { ok: false; error: 'cooldown'; wait_seconds: number }
    > => {
      const peerId = getStablePeerId();
      const supabaseUrl =
        getSupabaseUrl();
      const anonKey =
        getAnonKey();

      // Cooldown gate — skip silently if Supabase not configured
      if (supabaseUrl && anonKey) {
        try {
          const cooldownResp = await globalThis.fetch(
            `${supabaseUrl.replace(/\/$/, '')}/rest/v1/member_rejection_summary` +
              `?sender_peer_id=eq.${encodeURIComponent(peerId)}&select=total_rejections,last_rejection_at`,
            {
              headers: {
                'Authorization': `Bearer ${anonKey}`,
                'apikey': anonKey,
                'Accept': 'application/json',
              },
            },
          );
          if (cooldownResp.ok) {
            const rows: Array<{
              total_rejections: number | null;
              last_rejection_at: string | null;
            }> = await cooldownResp.json();
            const row = rows[0];
            if (row?.last_rejection_at) {
              const totalRejections = row.total_rejections ?? 0;
              const lastRejectionMs = new Date(row.last_rejection_at).getTime();
              // Option 2 (Founder-ratified): -1 effective strike per 30 clean days
              const daysSinceLast = (Date.now() - lastRejectionMs) / 86_400_000;
              const effectiveRejections = Math.max(
                0,
                totalRejections - Math.floor(daysSinceLast / 30),
              );
              if (effectiveRejections > 0) {
                const cooldownUntilMs =
                  lastRejectionMs + effectiveRejections * 5 * 60 * 1000;
                const waitMs = cooldownUntilMs - Date.now();
                if (waitMs > 0) {
                  return {
                    ok: false,
                    error: 'cooldown',
                    wait_seconds: Math.ceil(waitMs / 1000),
                  };
                }
              }
            }
          }
        } catch {
          // Network error — fail open (proceed with token mint)
        }
      }

      const { randomBytes } = require('crypto') as typeof import('crypto');
      const nonce = randomBytes(16).toString('hex');
      const expiresAt = new Date(Date.now() + 86_400_000).toISOString();
      const raw = `${peerId}:${nonce}:${expiresAt}`;
      const token = `mnemo-invite-${Buffer.from(raw).toString('base64url')}`;
      return { ok: true, token, expiresAt };
    },
  );

  safeHandle(
    'federation:reject-invite',
    async (
      _ev,
      { invite_token, source }: { invite_token: string; source: string },
    ): Promise<{ ok: boolean; error?: string }> => {
      const supabaseUrl =
        getSupabaseUrl();
      const anonKey =
        getAnonKey();
      if (!supabaseUrl || !anonKey) {
        return { ok: false, error: 'no_supabase_config' };
      }
      try {
        const resp = await globalThis.fetch(
          `${supabaseUrl.replace(/\/$/, '')}/functions/v1/wan-relay-reject`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${anonKey}`,
            },
            body: JSON.stringify({ invite_token, source }),
          },
        );
        return { ok: resp.ok };
      } catch {
        return { ok: false, error: 'network_error' };
      }
    },
  );

  safeHandle(
    'federation:accept-invite',
    async (_ev, token: string): Promise<{ success: boolean; peerName?: string; error?: string }> => {
      try {
        if (!token || !token.startsWith('mnemo-invite-')) {
          return { success: false, error: 'invalid token format' };
        }
        const raw = Buffer.from(token.replace('mnemo-invite-', ''), 'base64url').toString();
        const [peerId, , expiresAtStr] = raw.split(':');
        if (!peerId || !expiresAtStr) {
          return { success: false, error: 'malformed token' };
        }
        if (Date.now() > new Date(expiresAtStr).getTime()) {
          return { success: false, error: 'token expired' };
        }
        if (peerDiscovery) {
          peerDiscovery.registerWANPeer({
            peerId,
            address: 'relay',
            port: 0,
            transport: 'wan-relay',
            phase: 'identified',
            lastSeen: new Date().toISOString(),
          });
        }
        if (relayClient?.isConnected()) {
          relayClient.sendToPeer(peerId, {
            type: 'identify',
            peerId: getStablePeerId(),
            payload: {
              peerId: getStablePeerId(),
              version: app.getVersion(),
              pubkeyFingerprint: getStablePeerId(),
            },
            ts: new Date().toISOString(),
          });
        }
        return { success: true };
      } catch (e) {
        return { success: false, error: String(e) };
      }
    },
  );

  safeHandle('federation:leave-peer', (_ev, peerId: string): { ok: boolean } => {
    if (peerDiscovery) {
      peerDiscovery.removeWANPeer(peerId);
      peerDiscovery.removeLANPeer(peerId);
    }
    return { ok: true };
  });

  // SEG-5 v0.1.56 — federation:connect-peer
  // Accepts { peerId, relayUrl? } and attempts peer connection via the existing relay-client.
  // Falls back gracefully when relay is not yet connected.
  safeHandle(
    'federation:connect-peer',
    async (
      _ev,
      { peerId, relayUrl }: { peerId: string; relayUrl?: string },
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        if (!peerId) return { success: false, error: 'peerId is required' };
        if (peerDiscovery) {
          peerDiscovery.registerWANPeer({
            peerId,
            address: relayUrl ?? 'relay',
            port: 0,
            transport: 'wan-relay',
            phase: 'identified',
            lastSeen: new Date().toISOString(),
          });
        }
        if (relayClient?.isConnected()) {
          relayClient.sendToPeer(peerId, {
            type: 'identify',
            peerId: getStablePeerId(),
            payload: {
              peerId: getStablePeerId(),
              version: app.getVersion(),
              pubkeyFingerprint: getStablePeerId(),
            },
            ts: new Date().toISOString(),
          });
          return { success: true };
        }
        return { success: false, error: 'relay_not_connected' };
      } catch (e) {
        return { success: false, error: String(e) };
      }
    },
  );

  // SEG-5 v0.1.56 — send-silent-email stub
  // Infrastructure-only. Real email credentials are not wired here.
  // Prevents UI crashes while the feature is pending activation.
  safeHandle(
    'send-silent-email',
    (_ev, _args: unknown): { success: boolean; reason: string } => {
      console.log('[silent-email] not yet configured — call received, no-op');
      return { success: false, reason: 'not_configured' };
    },
  );

  // SEG-3 v0.1.55 — COMMUNITY-CONNECT first-launch seed peer handshake
  safeHandle(
    'community-connect-handshake',
    async (): Promise<{ success: boolean; peerName?: string; error?: string }> => {
      try {
        return await performCommunityConnectHandshake({
          ownPeerId: getStablePeerId(),
          appVersion: app.getVersion(),
          registerWANPeer: (peer) => {
            peerDiscovery?.registerWANPeer(peer);
          },
          sendIdentify: (toPeerId) => {
            if (relayClient?.isConnected()) {
              relayClient.sendToPeer(toPeerId, {
                type: 'identify',
                peerId: getStablePeerId(),
                payload: {
                  peerId: getStablePeerId(),
                  version: app.getVersion(),
                  pubkeyFingerprint: getStablePeerId(),
                },
                ts: new Date().toISOString(),
              });
            }
          },
        });
      } catch (e) {
        return { success: false, error: String(e) };
      }
    },
  );

  // -- Chronos Research Consent (KniPr038) ----------------------------------

  safeHandle('write-chronos-consent', async (_event, consentPayload: object) => {
    const fsp = require('path') as typeof import('path');
    const fs = require('fs') as typeof import('fs');
    const crypto = require('crypto') as typeof import('crypto');
    const consentDir = fsp.join(app.getPath('home'), '.amplify', 'consent');
    fs.mkdirSync(consentDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `chronos_consent_${timestamp}.eblet.json`;
    const filePath = fsp.join(consentDir, filename);
    const body = JSON.stringify({
      type: 'chronos_consent_eblet',
      version: '1.0.0',
      action: 'grant',
      timestamp: new Date().toISOString(),
      consent: consentPayload,
      kAnonymityMin: 10,
      revocationAvailable: true,
      researchConsentVersion: '1.0.0',
      canonRef: 'canon_chronos_research_aggregation_opt_in_member_mark_dividend_bp054',
    });
    const signed_hash = crypto.createHash('sha256').update(body).digest('hex');
    fs.writeFileSync(filePath, JSON.stringify({ ...JSON.parse(body), signed_hash }, null, 2));
    return { ok: true, ebletPath: filePath };
  });

  safeHandle('revoke-chronos-consent', async (_event, _payload?: object) => {
    const fsp = require('path') as typeof import('path');
    const fs = require('fs') as typeof import('fs');
    const crypto = require('crypto') as typeof import('crypto');
    const consentDir = fsp.join(app.getPath('home'), '.amplify', 'consent');
    fs.mkdirSync(consentDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `chronos_revocation_${timestamp}.eblet.json`;
    const filePath = fsp.join(consentDir, filename);
    const body = JSON.stringify({
      type: 'chronos_consent_eblet',
      version: '1.0.0',
      action: 'revoke',
      timestamp: new Date().toISOString(),
      canonRef: 'canon_chronos_research_aggregation_opt_in_member_mark_dividend_bp054',
    });
    const signed_hash = crypto.createHash('sha256').update(body).digest('hex');
    fs.writeFileSync(filePath, JSON.stringify({ ...JSON.parse(body), signed_hash }, null, 2));
    return { ok: true, ebletPath: filePath };
  });

  // BP067 Phase 1A ? $5 membership checkout IPC
  // Calls Supabase edge function create-membership-checkout ? returns Stripe Checkout URL
  // Renderer then calls shell.openExternal with the returned URL (never exposed here)
  safeHandle('membership:create-checkout', async (_event, autoRenew: boolean) => {
    const supabaseUrl = getSupabaseUrl();
    const supabaseKey = getAnonKey();

    if (!supabaseUrl || !supabaseKey) {
      console.warn('[membership] Supabase URL/key not configured ? falling back to web join page');
      return { ok: false, error: 'not_configured', fallbackUrl: 'https://lianabanyan.com/join' };
    }

    try {
      const resp = await globalThis.fetch(`${supabaseUrl}/functions/v1/create-membership-checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey,
        },
        body: JSON.stringify({ autoRenew }),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        console.error('[membership] create-checkout failed:', resp.status, errText.slice(0, 200));
        return { ok: false, error: `checkout_error_${resp.status}` };
      }

      const json = await resp.json() as { url?: string; error?: string };
      if (!json.url) {
        return { ok: false, error: json.error ?? 'no_url_returned' };
      }

      shell.openExternal(json.url).catch(() => {});
      return { ok: true };
    } catch (err) {
      console.error('[membership] create-checkout exception:', err);
      return { ok: false, error: String(err) };
    }
  });

  // -- membership.verifyStatus (BP078 Scope 2) ----------------------------------
  safeHandle('membership-verify-status', async () => {
    const supabaseUrl = getSupabaseUrl();
    const supabaseKey = getAnonKey();

    if (!supabaseUrl || !supabaseKey) {
      return { ok: false, membership_active: false, error: 'not_configured' };
    }

    try {
      const resp = await globalThis.fetch(`${supabaseUrl}/functions/v1/verify-membership-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey,
        },
        body: JSON.stringify({}),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        console.error('[membership] verify-status failed:', resp.status, errText.slice(0, 200));
        return { ok: false, membership_active: false, error: `verify_error_${resp.status}` };
      }

      const json = await resp.json() as { is_member?: boolean; error?: string };
      return { ok: true, membership_active: json.is_member === true };
    } catch (err) {
      console.error('[membership] verify-status exception:', err);
      return { ok: false, membership_active: false, error: String(err) };
    }
  });

  // -- runMeshTest (BP078 Scope 1; extended SEG-T-4 for COLD-vs-HOT multi-node) -------
  safeHandle('run-mesh-test', async (_event, payload?: {
    testId?: string;
    timeoutMs?: number;
    dataset?: 'standard' | 'diamond';
    nodes?: string[];
  }) => {
    // SEG-T-4 branch: if nodes param present, run COLD-vs-HOT MMLU-Pro mesh test
    if (payload && Array.isArray((payload as { nodes?: string[] }).nodes)) {
      const { dataset = 'standard', nodes } = payload as { dataset?: 'standard' | 'diamond'; nodes: string[] };

      // Determine local node identifier (M1 = localhost/127.0.0.1)
      const localNode = 'M1';
      const shardDir = join(homedir(), '.mnemosynec', 'test-data', 'mmlu-pro', 'shards');
      const shardPath = join(shardDir, `shard_${localNode}.json`);
      const resultsDir = join(homedir(), '.mnemosynec', 'test-data', 'mmlu-pro', 'results');

      if (!existsSync(shardPath)) {
        return {
          success: false,
          error: 'SHARD_NOT_FOUND',
          detail: `Run scripts/mesh_shard.py first. Expected: ${shardPath}`,
        };
      }

      let shard: { node: string; ip: string; questions: Array<Record<string, unknown>> };
      try {
        shard = JSON.parse(readFileSync(shardPath, 'utf8')) as typeof shard;
      } catch (e) {
        return { success: false, error: 'SHARD_PARSE_ERROR', detail: String(e) };
      }

      const questions = shard.questions ?? [];
      const total = questions.length;
      const results: Array<{
        question_id: string;
        gold_answer: string;
        cold_response: string;
        hot_response: string;
        cold_correct: boolean;
        hot_correct: boolean;
        latency_cold_ms: number;
        latency_hot_ms: number;
      }> = [];

      const ollamaBase = 'http://localhost:11434';
      const model = dataset === 'diamond' ? 'gemma4:12b' : 'gemma4:12b';

      /** Build prompt string from a question record. */
      function buildPrompt(q: Record<string, unknown>): string {
        const text = String(q.question ?? '');
        const options = Array.isArray(q.options) ? (q.options as string[]) : [];
        if (options.length === 0) return text;
        const lines = options.map((opt, i) => `  ${String.fromCharCode(65 + i)}. ${opt}`).join('\n');
        return `${text}\n\nOptions:\n${lines}\n\nAnswer with the letter only.`;
      }

      /** Check if response matches gold answer letter. */
      function isCorrect(response: string, gold: string): boolean {
        if (!gold || !response) return false;
        const g = gold.trim().toUpperCase();
        const r = response.trim().toUpperCase();
        if (r.startsWith(g)) return true;
        if (r.includes(`ANSWER: ${g}`) || r.includes(`(${g})`)) return true;
        return false;
      }

      /** POST to Ollama /api/generate. Returns [responseText, latencyMs]. */
      async function ollamaGenerate(prompt: string): Promise<[string, number]> {
        const t0 = Date.now();
        try {
          const resp = await fetch(`${ollamaBase}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, prompt, stream: false }),
          });
          const data = await resp.json() as { response?: string };
          return [data.response ?? '', Date.now() - t0];
        } catch (e) {
          return [`ERROR:${String(e)}`, Date.now() - t0];
        }
      }

      /** Query local substrate for HOT context. Returns context string or empty. */
      async function substrateQuery(query: string): Promise<string> {
        try {
          const resp = await fetch(`http://127.0.0.1:${_SUBSTRATE_PORT}/substrate/query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query }),
          });
          const data = await resp.json() as { hit?: boolean; answer?: string; text?: string };
          if (data.hit) return data.answer ?? data.text ?? '';
          return '';
        } catch {
          // TODO: substrate unreachable -- HOT context falls back to empty string
          return '';
        }
      }

      /** Emit progress heartbeat via /dag/emit. Non-fatal. */
      async function emitProgress(done: number): Promise<void> {
        try {
          await fetch(`http://127.0.0.1:${_SUBSTRATE_PORT}/dag/emit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              pearls: [`mesh_test:${localNode}:progress:${done}/${total}`],
              bindings: { event_type: 'mesh_test_progress', node: localNode, dataset },
            }),
          });
        } catch { /* non-fatal */ }
      }

      let lastEmitTime = Date.now();

      for (let idx = 0; idx < questions.length; idx++) {
        const q = questions[idx];
        const questionId = String(q.question_id ?? idx);
        const gold = String(q.answer ?? '').trim().toUpperCase();
        const promptBase = buildPrompt(q);

        // COLD: no substrate context
        const [coldResp, latencyCold] = await ollamaGenerate(promptBase);
        const coldCorrect = isCorrect(coldResp, gold);

        // HOT: prepend substrate context if available
        const ctx = await substrateQuery(promptBase);
        const hotPrompt = ctx ? `Context from substrate:\n${ctx}\n\n${promptBase}` : promptBase;
        const [hotResp, latencyHot] = await ollamaGenerate(hotPrompt);
        const hotCorrect = isCorrect(hotResp, gold);

        results.push({
          question_id: questionId,
          gold_answer: gold,
          cold_response: coldResp,
          hot_response: hotResp,
          cold_correct: coldCorrect,
          hot_correct: hotCorrect,
          latency_cold_ms: latencyCold,
          latency_hot_ms: latencyHot,
        });

        const done = idx + 1;
        const now = Date.now();
        if (done % 100 === 0 || (now - lastEmitTime) >= 60_000) {
          await emitProgress(done);
          lastEmitTime = now;
        }
      }

      // Write results JSON
      try { mkdirSync(resultsDir, { recursive: true }); } catch { /* ignore */ }
      const resultsPath = join(resultsDir, `shard_${localNode}_results.json`);
      const coldCount = results.filter((r) => r.cold_correct).length;
      const hotCount = results.filter((r) => r.hot_correct).length;
      const summary = {
        node: localNode,
        dataset,
        nodes,
        total_questions: total,
        cold_correct: coldCount,
        hot_correct: hotCount,
        cold_accuracy: total > 0 ? coldCount / total : 0,
        hot_accuracy: total > 0 ? hotCount / total : 0,
        delta_accuracy: total > 0 ? (hotCount - coldCount) / total : 0,
      };
      writeFileSync(resultsPath, JSON.stringify({ summary, results }, null, 2), 'utf8');

      // Final progress emit
      await emitProgress(total);

      return { success: true, summary, results_path: resultsPath };
    }

    // -- Legacy single-machine path (BP078 Scope 1 original) ------------------
    const timeoutMs = payload?.timeoutMs ?? 45000;

    // MISSING_API_KEY guard -- read from env (env_loader populates on startup)
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return { success: false, error: 'MISSING_API_KEY', static_fallback: true };
    }

    // Resolve script path relative to project root (sandbox mode: dev/internal only)
    const scriptPath = join(__dirname, '..', '..', 'librarian-mcp', 'r10_cross_vendor', 'run_mesh_test.py');
    if (!existsSync(scriptPath)) {
      console.warn('[run-mesh-test] script not found at', scriptPath);
      return { success: false, error: 'PYTHON_ERROR', static_fallback: true };
    }

    // Unique temp output dir per invocation
    const outDir = join(tmpdir(), `mnemo_mesh_test_${Date.now()}`);
    try { mkdirSync(outDir, { recursive: true }); } catch { /* ignore */ }

    return new Promise((resolve) => {
      let settled = false;
      let timedOut = false;
      const stdout: string[] = [];
      const stderr: string[] = [];

      const proc = spawn('python', [scriptPath, '--condition', 'alone', '--bank', 'A', '--step', '1', '--out', outDir], {
        env: { ...process.env, ANTHROPIC_API_KEY: apiKey },
        cwd: join(__dirname, '..', '..', 'librarian-mcp', 'r10_cross_vendor'),
      });

      const timer = setTimeout(() => {
        if (!settled) {
          timedOut = true;
          settled = true;
          try { proc.kill('SIGKILL'); } catch { /* ignore */ }
          resolve({ success: false, error: 'TIMEOUT', static_fallback: true });
        }
      }, timeoutMs);

      proc.stdout.on('data', (d: Buffer) => stdout.push(d.toString()));
      proc.stderr.on('data', (d: Buffer) => stderr.push(d.toString()));

      proc.on('error', (err: NodeJS.ErrnoException) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          if (err.code === 'ENOENT') {
            resolve({ success: false, error: 'MISSING_PYTHON_RUNTIME', static_fallback: true });
          } else {
            console.error('[run-mesh-test] spawn error:', err);
            resolve({ success: false, error: 'PYTHON_ERROR', static_fallback: true });
          }
        }
      });

      proc.on('close', (code: number | null) => {
        if (settled || timedOut) return;
        settled = true;
        clearTimeout(timer);

        const combinedOut = stdout.join('');
        if (combinedOut.includes('no peer found') || combinedOut.includes('NO_PEER')) {
          resolve({ success: false, error: 'NO_PEER', static_fallback: true });
          return;
        }

        if (code !== 0) {
          console.error('[run-mesh-test] python exited with code', code, stderr.join('').slice(0, 400));
          resolve({ success: false, error: 'PYTHON_ERROR', static_fallback: true });
          return;
        }

        // Parse summary.json written by the script
        const summaryPath = join(outDir, 'summary.json');
        try {
          const raw = readFileSync(summaryPath, 'utf8');
          const summary = JSON.parse(raw) as {
            accuracy_pct?: number;
            fetch_latency_p50_ms?: number;
            fetch_latency_p95_ms?: number;
            total_questions?: number;
            mesh_fetch_count?: number;
            hash_verify_pass_rate?: number;
          };
          const hashVerifiedCount = Math.round(
            (summary.hash_verify_pass_rate ?? 0) * (summary.mesh_fetch_count ?? 0),
          );
          resolve({
            success: true,
            grading: {
              accuracy: (summary.accuracy_pct ?? 0) / 100,
              hash_verified: hashVerifiedCount,
              p50_latency_ms: summary.fetch_latency_p50_ms ?? 0,
              p95_latency_ms: summary.fetch_latency_p95_ms ?? undefined,
              total_questions: summary.total_questions ?? 0,
            },
          });
        } catch (parseErr) {
          console.error('[run-mesh-test] failed to parse summary.json:', parseErr);
          resolve({ success: false, error: 'PYTHON_ERROR', static_fallback: true });
        }
      });
    });
  });

  // --- SEG-2 v0.1.57: Test It Out IPC handlers ---------------------------------

  /**
   * run-test-it-out — runs 5 random R11 questions through the local Ollama model.
   * Emits 'test-it-out-progress' per question; emits 'test-it-out-complete' when done.
   * BP137 Honest-MMLU-Provenance Yoke: this handler previously wrote the benchmark's OWN
   * graded answer key (q.canonical_answer) into the verified eblet store whenever the model
   * happened to answer correctly ("Andon canon: correct answers grow substrate"). That write
   * has been REMOVED -- see the doc comment at the former write site below for why: a
   * benchmark that writes its own answer key into the store it can later be topically
   * queried against is a memory test wearing a lab coat, not an independent knowledge check.
   * This handler now only scores and reports; it never writes to substrate.
   */
  safeHandle('run-test-it-out', async (event) => {
    const TOTAL = 5;

    // BP083 SEG-4: same bundled extraResources MMLU-Pro path as substrate seed + mesh
    const { loadDomainBank, getDomainList } = await import('./plow/per_domain_q_banks');

    type BankQuestion = {
      id: string;
      question: string;
      canonical_answer: string;
      hot_required_elements: string[];
    };

    let allQuestions: BankQuestion[] = [];
    for (const domain of getDomainList()) {
      try {
        const bank = loadDomainBank(domain);
        for (const q of bank) {
          allQuestions.push({
            id: `${domain}:${q.source_id}`,
            question: q.question,
            canonical_answer: q.correct_answer,
            hot_required_elements: [q.correct_answer],
          });
        }
      } catch {
        /* domain bank missing — skip */
      }
    }

    if (allQuestions.length === 0) {
      return { success: false, error: 'NO_QUESTION_BANK' };
    }

    // Pick 5 random unique questions (Fisher-Yates partial shuffle)
    const pool = [...allQuestions];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const selected = pool.slice(0, TOTAL);

    // Determine model: prefer getSelectedModel(), fall back to floor model
    const model = ollamaManager.getSelectedModel() ?? 'gemma4:12b';

    const isCorrect = (response: string, elements: string[]): boolean => {
      if (!response || elements.length === 0) return false;
      const r = response.toLowerCase();
      return elements.every((el) => r.includes(el.toLowerCase()));
    };

    const results: Array<{
      questionIndex: number;
      question: string;
      modelAnswer: string;
      correctAnswer: string;
      isCorrect: boolean;
    }> = [];

    let score = 0;

    for (let idx = 0; idx < selected.length; idx++) {
      const q = selected[idx];
      const prompt = `Answer the following question concisely and accurately:\n\n${q.question}`;

      let modelAnswer = '';
      try {
        const resp = await fetch('http://127.0.0.1:11434/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, prompt, stream: false, options: { num_predict: 256, temperature: 0.1 } }),
          signal: AbortSignal.timeout(60_000),
        });
        if (resp.ok) {
          const data = await resp.json() as { response?: string };
          modelAnswer = data.response?.trim() ?? '';
        } else {
          modelAnswer = `ERROR:${resp.status}`;
        }
      } catch (err) {
        modelAnswer = `ERROR:${String(err).slice(0, 80)}`;
      }

      const correct = isCorrect(modelAnswer, q.hot_required_elements);
      if (correct) score++;

      const result = {
        questionIndex: idx,
        question: q.question,
        modelAnswer,
        correctAnswer: q.canonical_answer,
        isCorrect: correct,
      };
      results.push(result);

      // Emit per-question progress to the requesting window
      if (!event.sender.isDestroyed()) {
        event.sender.send('test-it-out-progress', { ...result, total: TOTAL });
      }

      // BP137 Honest-MMLU-Provenance Yoke -- REMOVED (was: write q.canonical_answer, the
      // benchmark's own graded answer key, into verified_eblets.jsonl whenever `correct` was
      // true). That is exactly the FATAL contamination pattern the Founder flagged: the test
      // writing the answer it is being graded against into the store it can later be served
      // back from. This is a benchmark run -- it must never contaminate the substrate with
      // its own answer key, full stop, so the write is deleted rather than merely gated
      // (Step 1 hard constraint: "you cannot flag-guard 'don't contaminate' behind a flag
      // that defaults to the contaminated behavior"). Scoring/reporting below is unchanged;
      // only the substrate side-effect is gone.
    }

    // Append run to history file
    const historyDir = join(app.getPath('userData'), 'substrate');
    const historyPath = join(historyDir, 'test_it_out_history.jsonl');
    try {
      if (!existsSync(historyDir)) mkdirSync(historyDir, { recursive: true });
      const historyLine = JSON.stringify({
        ts: Date.now(),
        score,
        total: TOTAL,
        model,
        results: results.map((r) => ({ q: r.question.slice(0, 80), correct: r.isCorrect })),
      });
      appendFileSync(historyPath, historyLine + '\n', 'utf-8');
    } catch (e) {
      console.warn('[test-it-out] history write failed (non-fatal):', e);
    }

    if (!event.sender.isDestroyed()) {
      event.sender.send('test-it-out-complete', { score, total: TOTAL, results });
    }

    return { success: true, score, total: TOTAL };
  });

  /** get-test-it-out-history — returns last 20 run records from history JSONL. */
  safeHandle('get-test-it-out-history', async () => {
    const historyPath = join(app.getPath('userData'), 'substrate', 'test_it_out_history.jsonl');
    if (!existsSync(historyPath)) return { runs: [] };
    try {
      const lines = readFileSync(historyPath, 'utf-8')
        .split('\n')
        .filter(Boolean)
        .slice(-20);
      const runs = lines.map((l) => {
        try { return JSON.parse(l); } catch { return null; }
      }).filter(Boolean);
      return { runs };
    } catch {
      return { runs: [] };
    }
  });

  // --- SEG-A2 BP081: Substrate stats dashboard IPC ------------------------------

  safeHandle('get-substrate-stats', async () => {
    const { queryStats } = await import('./mnem_eblet_store');
    return queryStats();
  });

  // --- BP081 K-1: Membership IPC handlers (stub tier) --------------------------

  safeHandle('membership:start-checkout', async (_event: unknown, args: { userJwt?: string } = {}) => {
    const { createMembershipCheckoutSession } = await import('./membership/checkout_session');
    const supabaseUrl = getSupabaseUrl();
    const result = await createMembershipCheckoutSession(supabaseUrl, args.userJwt ?? '');
    if (result.checkoutUrl) {
      shell.openExternal(result.checkoutUrl).catch(() => {});
    }
    return result;
  });

  safeHandle('membership:get-status', async () => {
    // Stub — reads from persisted session in v0.1.61
    return { tier: 'standard', status: 'never_joined', annualFeeUsd: 5 };
  });

  safeHandle('membership:cancel', async () => {
    // Stub
    return { success: false, reason: 'not_implemented_until_v0.1.61' };
  });

  // --- BP085 — membership:open-checkout (direct join URL with peer_id) ----------
  safeHandle('membership:open-checkout', async () => {
    try {
      const peerId = getStablePeerId();
      if (!peerId) throw new Error('peer_id not found in local store');
      const url = new URL('https://lianabanyan.com/join');
      url.searchParams.set('source', 'mnemosynec-app');
      url.searchParams.set('user_id', peerId);
      await shell.openExternal(url.toString());
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  // --- BP085 — membership:check-local-status (reads userData/member_status.json) --
  safeHandle('membership:check-local-status', async () => {
    try {
      const { readFileSync } = await import('fs');
      const { join: pathJoin } = await import('path');
      const statusFile = pathJoin(app.getPath('userData'), 'member_status.json');
      const raw = readFileSync(statusFile, 'utf8');
      const data = JSON.parse(raw) as { is_member?: boolean; member_id?: string; activated_at?: string };
      return { ok: true, is_member: data.is_member === true, member_id: data.member_id };
    } catch {
      return { ok: true, is_member: false, member_id: null };
    }
  });

  // --- SKU IPC handlers (BP078 Scope 6.5) --------------------------------------

  safeHandle('sku-check-model', async (_event, modelName: string) => {
    try {
      const modelsDir = join(homedir(), '.ollama', 'models', 'manifests',
        'registry.ollama.ai', 'library');
      const [name, tag = 'latest'] = modelName.split(':');
      const manifestPath = join(modelsDir, name, tag);
      const fallbackPath = join(homedir(), '.ollama', 'models', 'manifests',
        'registry.ollama.ai', name, tag);
      const exists = existsSync(manifestPath) || existsSync(fallbackPath);
      return { exists, modelName };
    } catch {
      return { exists: false, modelName };
    }
  });

  safeHandle('sku-upgrade-to', async (event, tier: string) => {
    // BP135 Yoke #35: every tier previously hardcoded 'gemma4:12b' here regardless of which
    // tier the user actually chose -- picking 'lite' or 'core' silently pulled the full 12b
    // model anyway. Derive from ram_detector.ts's TIER_DEFS (single source of truth for
    // tier -> recommended-model, already used by hardware:get-tier / SettingsTab) instead of
    // a second hand-maintained map that can drift out of sync with it.
    const { getAllTiers } = await import('./hardware/ram_detector');
    const modelName = getAllTiers().find((t) => t.tier === tier)?.recommendedModel;
    if (!modelName) return { ok: false, error: 'Unknown tier' };

    skuPullRunning = false;

    skuPullRunning = true;

    ollamaManager.pullModel(modelName, (progress) => {
      event.sender.send('sku-pull-progress', {
        downloaded: progress.bytesDownloaded ?? progress.completed ?? 0,
        total: progress.totalBytes ?? progress.total ?? 0,
        status: progress.status,
      });
    }).then(() => {
      skuPullRunning = false;
      try {
        const cfgPath = join(app.getPath('userData'), 'sku_tier.json');
          writeFileSync(cfgPath, JSON.stringify({ tier, model: modelName }), 'utf-8');
        } catch (err) {
          console.warn('[SKU] Failed to write sku_tier.json:', err);
        }
      event.sender.send('sku-pull-complete');
    }).catch((err: Error) => {
      skuPullRunning = false;
      event.sender.send('sku-pull-error', err.message);
    });

    return { ok: true };
  });

  safeHandle('sku-cancel-upgrade', async () => {
    skuPullRunning = false;
    return { ok: true };
  });

  safeHandle('sku-current-tier', async () => {
    try {
      const cfgPath = join(app.getPath('userData'), 'sku_tier.json');
      if (existsSync(cfgPath)) {
        const raw = readFileSync(cfgPath, 'utf-8');
        const parsed = JSON.parse(raw) as { tier?: string };
        if (parsed.tier) return { tier: parsed.tier };
      }
    } catch { /* fallback to nano */ }
    return { tier: 'nano' };
  });

  // SEG-V0149-P1: first-install gate — check sku_tier.json presence without leaking tier value
  safeHandle('onboarding-check', async () => {
    const skuPath = join(app.getPath('userData'), 'sku_tier.json');
    return { skuExists: existsSync(skuPath) };
  });

  // SEG-V0150-P0-FIX-BRIDGE-OR-FALLBACK: skip-path — user already has Ollama + model,
  // or IPC fallback timed out. Writes sku_tier.json to unblock first-install gate.
  safeHandle('write-sku-tier-skip', async () => {
    try {
      writeFileSync(
        join(app.getPath('userData'), 'sku_tier.json'),
        JSON.stringify({ tier: 'full', model: 'gemma4:12b', source: 'user_skip' }),
      );
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn('[write-sku-tier-skip] Failed:', message);
      return { ok: false, error: message };
    }
  });

  // SEG-V0151-P0-AUTOMATIC-BACKGROUND: lean-bg-start — silent background setup
  // Fires from LeanShell on first lean-mode launch. Reuses lean-install-start logic
  // but emits 'lean-bg-status' events for LeanShell thin status bar.
  safeHandle('lean-bg-start', async (event) => {
    const emit = (type: string, msg: string, pct?: number) => {
      event.sender.send('lean-bg-status', { type, msg, ...(pct != null ? { pct } : {}) });
    };

    try {
      // Step 1: Check Ollama reachability
      const reachable = await ollamaManager.isReachable();
      if (!reachable) {
        emit('setup-status', 'Starting your AI engine…');
        await ollamaManager.init();
        if (!(await ollamaManager.isReachable())) {
          shell.openExternal('https://ollama.com/download/windows');
          emit('setup-status', 'Visit ollama.com to install Ollama, then relaunch MnemosyneC.');
          return { ok: false };
        }
      }

      // Step 2: Check and pull gemma4:12b
      const MODEL = 'gemma4:12b';
      const hasModel = await ollamaManager.hasModel(MODEL);
      if (hasModel) {
        emit('setup-status', 'ready');
        return { ok: true };
      }

      emit('setup-status', 'Downloading your AI model…');
      let lastBytes = 0, lastTs = Date.now();
      await ollamaManager.pullModel(MODEL, (progress) => {
        const bytes = progress.bytesDownloaded ?? progress.completed ?? 0;
        const total = progress.totalBytes ?? progress.total ?? 0;
        const now = Date.now();
        const elapsedSec = (now - lastTs) / 1000;
        if (elapsedSec >= 1 && bytes > lastBytes) {
          const pct = total > 0 ? Math.round((bytes / total) * 100) : 0;
          emit('setup-progress', `Downloading your AI model… ${pct}%`, pct);
          lastBytes = bytes; lastTs = now;
        }
      });
      emit('setup-status', 'ready');
      return { ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[lean-bg-start] Error:', msg);
      emit('setup-status', '');
      return { ok: false, error: msg };
    }
  });

  // -- Black Crow Feather earn (BP078) ---------------------------------------
  // Durably records a black_crow feather in the Supabase crow_feathers table.
  // Uses service role key to bypass RLS. Idempotent: one black_crow feather
  // per user with badge_class = 'full_sku_upgrade'.
  safeHandle('feather:earn-black', async (
    _event,
    payload: { userId: string; reason: string; metadata?: Record<string, unknown> },
  ) => {
    const supabaseUrl = getSupabaseUrl();
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    if (!supabaseUrl || !serviceRoleKey) {
      console.warn('[feather:earn-black] Supabase credentials not present, skipping durable feather record.');
      return { ok: false, error: 'no-credentials' };
    }
    const { userId, reason, metadata = {} } = payload;
    const restBase = `${supabaseUrl}/rest/v1/crow_feathers`;
    const authHeaders: Record<string, string> = {
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    };
    try {
      // Idempotency check: look for an existing black_crow feather for this user.
      const checkUrl = `${restBase}?user_id=eq.${encodeURIComponent(userId)}&category=eq.black_crow&metadata->>badge_class=eq.full_sku_upgrade&select=id&limit=1`;
      const checkResp = await fetch(checkUrl, { method: 'GET', headers: authHeaders });
      if (checkResp.ok) {
        const existing = await checkResp.json() as Array<{ id: string }>;
        if (existing.length > 0) {
          return { ok: true, alreadyIssued: true, featherId: existing[0].id };
        }
      }
      // Insert new record.
      const insertResp = await fetch(restBase, {
        method: 'POST',
        headers: { ...authHeaders, 'Prefer': 'return=representation' },
        body: JSON.stringify({
          user_id: userId,
          category: 'black_crow',
          record_value: 1,
          metadata: {
            honor_badge: true,
            badge_class: 'full_sku_upgrade',
            reason,
            ...metadata,
          },
        }),
      });
      if (!insertResp.ok) {
        const errText = await insertResp.text();
        console.error('[feather:earn-black] Insert failed:', insertResp.status, errText);
        return { ok: false, error: `insert-failed-${insertResp.status}` };
      }
      const inserted = await insertResp.json() as Array<{ id: string }>;
      const featherId = inserted[0]?.id ?? '';
      return { ok: true, featherId };
    } catch (err) {
      console.error('[feather:earn-black] Unexpected error:', err);
      return { ok: false, error: (err as Error).message };
    }
  });

  // ── BP080 Genesis Mint — IP Ledger IPC handlers ───────────────────────────

  safeHandle('ip-ledger:get-genesis', () => {
    try {
      const entries = loadAllEntries();
      return entries.find(e => e.claim === 'genesis:user:000001') ?? null;
    } catch {
      return null;
    }
  });

  safeHandle('ip-ledger:founder-vcard-qr', async () => {
    try {
      const entries = loadAllEntries();
      const genesis = entries.find(e => e.claim === 'genesis:user:000001');
      if (!genesis) return null;
      const parsed = JSON.parse(genesis.claim_body ?? '{}') as Record<string, unknown>;
      const displayName = typeof parsed.display_name === 'string' ? parsed.display_name : 'FounderDenken';
      const provisionalFilings = typeof parsed.provisional_filings === 'number' ? parsed.provisional_filings : 21;
      const vcard = [
        'BEGIN:VCARD',
        'VERSION:3.0',
        `FN:${displayName}`,
        'ORG:MnemosyneC Cooperative',
        'URL:https://mnemosynec.ai/member/000001',
        `NOTE:User 000001 · Ledger entry: genesis:user:000001 · ${provisionalFilings} provisional filings · MnemosyneC cooperative founder`,
        'END:VCARD',
      ].join('\n');
      const QRCode = await import('qrcode').catch(() => null);
      if (!QRCode) return { error: 'qrcode_package_missing' };
      const dataUrl = await (QRCode.default as typeof import('qrcode')).toDataURL(vcard, { width: 300, margin: 2 });
      return { dataUrl, vcard };
    } catch (e) {
      return { error: String(e) };
    }
  });

  safeHandle('ip-ledger:execute-genesis-mint', async () => {
    await mintGenesisIfAbsent();
    const entries = loadAllEntries();
    return entries.find(x => x.claim === 'genesis:user:000001') ?? null;
  });

  // ── BP080 Full 22-Entry Genesis Mint (Founder-ratified 2026-06-11) ────────
  safeHandle('ip-ledger:genesis-mint-full', async () => {
    // IDEMPOTENCY CHECK — Federal Body Cam — never double-write
    const existing = loadAllEntries().find(e => e.claim === 'genesis:user:000001');
    if (existing) {
      return {
        success: false,
        error: 'Genesis entry already exists — no duplicate write. ledger_id: ' + existing.ledger_id,
        genesis_ledger_id: existing.ledger_id,
        filing_ledger_ids: [],
        all_22_entries: [existing],
      };
    }

    const stablePeerId = getStablePeerId();
    const supabaseUserId = 'member_000001';

    // STEP 1: Mint genesis user entry FIRST
    const genesisEntry = registerClaim({
      registered_by: 'member_000001',
      claim: 'genesis:user:000001',
      claim_body: JSON.stringify({
        display_name: 'FounderDenken',
        email: 'Founder@LianaBanyan.com',
        role: 'founder',
        cooperative: 'MnemosyneC',
        founding_date: '2026-06-11',
        supabase_user_id: supabaseUserId,
        stable_peer_id: stablePeerId,
        provisional_filings_count: 21,
        filing_dockets: ['LB-PROV-001','LB-PROV-002','LB-PROV-003','LB-PROV-004','LB-PROV-005','LB-PROV-006','LB-PROV-007','LB-PROV-008','LB-PROV-009','LB-PROV-010','LB-PROV-011','LB-PROV-012','LB-PROV-013','LB-PROV-014','LB-PROV-015','LB-PROV-016','LB-PROV-017','LB-PROV-018','LB-PROV-019','LB-PROV-020','LB-PROV-021'],
        ratify_quote: 'MINT IT — display_name: FounderDenken — 2026-06-11',
        ratify_session: 'BP080',
        member_id_note: 'supabase_user_id is the immutable anchor; display_name and email are mutable proxies — supersede-chain tracks changes per Federal Body Cam doctrine',
      }),
      evidence: [
        'Asteroid-ProofVault/03_PATENT_BAGS/PROV_21_FILING_CHECKLIST_BP067.md',
        'MEMORY.md — BP070 CLOSE-STAMP canonical filing count 21',
        'Founder explicit ratify 2026-06-11 BP080 — MINT IT display_name FounderDenken',
      ],
      category: 'provisional',
    });

    // STEP 2: Mint 21 per-filing entries with actual USPTO app numbers
    const PROV_FILINGS: Array<{ docket: string; app_number: string; filing_date: string; title: string; conf?: string; filing_fee?: string; entity_status?: string }> = [
      { docket: 'LB-PROV-001', app_number: '63/925,672', filing_date: '2025-11-26', title: 'see-patent-receipt' },
      { docket: 'LB-PROV-002', app_number: '63/927,674', filing_date: '2025-11-30', title: 'see-patent-receipt' },
      { docket: 'LB-PROV-003', app_number: '63/938,216', filing_date: '2025-12-10', title: 'see-patent-receipt' },
      { docket: 'LB-PROV-004', app_number: '63/967,200', filing_date: '2026-01-23', title: 'see-patent-receipt' },
      { docket: 'LB-PROV-005', app_number: '63/969,601', filing_date: '2026-01-28', title: 'see-patent-receipt' },
      { docket: 'LB-PROV-006', app_number: '63/989,913', filing_date: '2026-02-24', title: 'see-patent-receipt' },
      { docket: 'LB-PROV-007', app_number: '64/006,010', filing_date: '2026-03-15', title: 'see-patent-receipt' },
      { docket: 'LB-PROV-008', app_number: '64/009,803', filing_date: '2026-03-18', title: 'see-patent-receipt' },
      { docket: 'LB-PROV-009', app_number: '64/017,140', filing_date: '2026-03-25', title: 'see-patent-receipt' },
      { docket: 'LB-PROV-010', app_number: '64/017,457', filing_date: 'see-patent-receipt', title: 'see-patent-receipt' },
      { docket: 'LB-PROV-011', app_number: '64/025,635', filing_date: 'see-patent-receipt', title: 'see-patent-receipt' },
      { docket: 'LB-PROV-012', app_number: '64/031,531', filing_date: 'see-patent-receipt', title: '93 innovations #2131–#2224 — Context/Beacon/Distribution/Temporal/Trust/UX clusters (B077–B087)' },
      { docket: 'LB-PROV-013', app_number: '64/036,646', filing_date: '2026-04-12', title: 'Romulator / ROM+Emulator+HAL9000 genesis strain of Mnemosyne' },
      { docket: 'LB-PROV-014', app_number: '64/052,602', filing_date: '2026-04-29', title: 'Cooperative-Platform AI Memory Infrastructure with Discipline-Enforcement Federation' },
      { docket: 'LB-PROV-015', app_number: '64/052,618', filing_date: '2026-04-29', title: 'Cooperative-Platform AI Memory Infrastructure — Agent-Spawn Boundary Pre-Injection, Lossless Vendor-Layer Tablet Capture, Corpus-Alias Registry-Keyword-Extension, Substrate Discipline Primitives' },
      { docket: 'LB-PROV-016', app_number: '64/060,080', filing_date: '2026-05-07', title: 'Method and System for Cooperative-AI-Substrate Platform with Multi-Organism Federation and Substrate-Routed Memory Expansion' },
      { docket: 'LB-PROV-017', app_number: '64/060,093', filing_date: '2026-05-07', title: 'Save-the-World 12-Paper Series + HexIsle Wave 4 + Cooperative Manufacturing Sovereignty + Substrate-IS-the-Primitive' },
      { docket: 'LB-PROV-018', app_number: '64/062,332', filing_date: '2026-05-11', title: 'BP036 substrate canon — PGP/Edition/Aviator + SEG-Cascade + Aircraft Carrier + Excalibur + TCP/IP 4-Tuple substrate-layer' },
      { docket: 'LB-PROV-019', app_number: '64/062,334', filing_date: '2026-05-11', title: 'HexIsle 2D Isometric World Operational Interface + Substrate kernel extensions + Sonnet S7/S8/S1 clusters' },
      { docket: 'LB-PROV-020', app_number: '64/073,890', filing_date: '2026-05-25', title: 'Substrace Theorem + Pheromone Trail + Wrasse-Quartermaster + MENUS + Hard Candy Stitchpunk + Pearl Registry + Cephas + SEG-Cascade + Employ-the-World backbone' },
      { docket: 'LB-PROV-021', app_number: '64/079,336', filing_date: '2026-06-01', title: 'Cooperative AI Substrate Systems: Roll Architecture Peer-Mesh Ratification, Pearl-Class Transmission, Wrasse-Quartermaster Context Pre-Injection, Anti-Hype Empirical Honesty Framework, Caithedral Cathedral Architecture, MENUS-Helm Cooperative Inventory Layer, Hard Candy Stitchpunk Configuration Sharing, Mnemosyne P2P Cold-Storage Capsule Protocol, Employ the World Cooperative-Economy Backbone, Computation-Knowledge Separation via Speckle/Hex-Soccerball/Peanut-Roll/Mass-Crystal Substrate Primitives, AI Tuner Role-Class, and Human-Substrate Anecdote-Corpus Method for Multi-Agent Cooperative Platform Orchestration', conf: '6635', filing_fee: '$65', entity_status: 'micro_entity' },
    ];

    const filingEntries: ReturnType<typeof registerClaim>[] = [];
    for (const f of PROV_FILINGS) {
      const body: Record<string, string> = {
        docket: f.docket,
        app_number: f.app_number,
        filing_date: f.filing_date,
        title: f.title,
        filed_by: 'Jonathan Ray Jones',
        address: '9627 Krier Ct, Converse TX 78109',
        cooperative: 'MnemosyneC',
        genesis_ledger_id_ref: genesisEntry.ledger_id,
      };
      if (f.conf) body['conf'] = f.conf;
      if (f.filing_fee) body['filing_fee'] = f.filing_fee;
      if (f.entity_status) body['entity_status'] = f.entity_status;
      const entry = registerClaim({
        registered_by: 'member_000001',
        claim: `patent:provisional:${f.docket}`,
        claim_body: JSON.stringify(body),
        evidence: [
          'Asteroid-ProofVault/03_PATENT_BAGS/ — folder-verified app number',
          'Founder explicit ratify 2026-06-11 BP080',
        ],
        category: 'provisional',
      });
      filingEntries.push(entry);
    }

    // STEP 3: Generate vCard QR PNG
    let vcardQrPath: string | null = null;
    let vcardQrError: string | null = null;
    try {
      vcardQrPath = await generateFounderVcardQr(genesisEntry.ledger_id);
    } catch (e) {
      vcardQrError = String(e);
    }

    return {
      success: true,
      genesis_ledger_id: genesisEntry.ledger_id,
      filing_ledger_ids: filingEntries.map(e => e.ledger_id),
      all_22_entries: [genesisEntry, ...filingEntries],
      vcard_qr_path: vcardQrPath,
      vcard_qr_error: vcardQrError,
    };
  });

  // ── BP089 I-C: ip-ledger:get-entries + peer-key handlers ──────────────────
  // Adds §16 Supabase ip_ledger read + peer keypair IPC surface.
  // Bishop applies I12 migration before these handlers have live data.

  safeHandle('ip-ledger:get-entries', async (_event, ringBearerId: string) => {
    const supabaseUrl = getSupabaseUrl();
    const anonKey = getAnonKey();
    if (!supabaseUrl || !anonKey) return { ok: false, error: 'Supabase config not available', entries: [] };
    try {
      const qs = ringBearerId ? `ring_bearer_id=eq.${encodeURIComponent(ringBearerId)}&` : '';
      const res = await fetch(
        `${supabaseUrl}/rest/v1/ip_ledger?${qs}order=stamp_seq.asc&limit=200`,
        { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } },
      );
      if (!res.ok) return { ok: false, error: `HTTP ${res.status}`, entries: [] };
      const entries = await res.json();
      return { ok: true, entries };
    } catch (err) {
      return { ok: false, error: (err as Error).message, entries: [] };
    }
  });

  safeHandle('peer-key:read', async () => {
    const supabaseUrl = getSupabaseUrl();
    const anonKey = getAnonKey();
    const peerId = getStablePeerId();
    if (!supabaseUrl || !anonKey) return { ok: false, error: 'Supabase config not available' };
    try {
      const { ensurePeerKeypair } = await import('../substrate/peerKeyGen');
      const result = await ensurePeerKeypair(peerId, { supabaseUrl, anonKey });
      return { ok: true, publicKeyHex: result.publicKeyHex, generated: result.generated, peerId };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  safeHandle('peer-key:regenerate', async () => {
    const supabaseUrl = getSupabaseUrl();
    const anonKey = getAnonKey();
    const peerId = getStablePeerId();
    if (!supabaseUrl || !anonKey) return { ok: false, error: 'Supabase config not available' };
    try {
      // Clear existing key so ensurePeerKeypair re-generates
      await fetch(
        `${supabaseUrl}/rest/v1/peer_presence?peer_id=eq.${encodeURIComponent(peerId)}`,
        {
          method: 'PATCH',
          headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          body: JSON.stringify({ public_key_hex: null, private_key_hex_encrypted: null }),
        },
      );
      const { ensurePeerKeypair } = await import('../substrate/peerKeyGen');
      const result = await ensurePeerKeypair(peerId, { supabaseUrl, anonKey });
      return { ok: true, publicKeyHex: result.publicKeyHex, generated: true, peerId };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  // ── BP092 I12 — Marketplace plugin registration with IP Ledger stamp ─────────

  safeHandle('marketplace:register-plugin', async (_event, req: import('./marketplace/marketplace_registry').PluginRegistrationRequest) => {
    try {
      const { registerPlugin } = await import('./marketplace/marketplace_registry');
      const { stampCertify } = await import('./ip_ledger/stamp_certify');
      const { getRingBearerIdentity } = await import('./ip_ledger/ring_bearer_keygen');
      const identity = getRingBearerIdentity();
      const manifest = registerPlugin(req, 'pending_stamp');
      // Stamp-Certify hook: member_business_listing_created (fire-and-forget)
      stampCertify({
        contribution_type: 'member_business_listing_created',
        payload: JSON.stringify({ event: 'member_business_listing_created', entity_id: manifest.plugin_id, member_id: identity.peer_id, timestamp: Date.now() }),
      }).catch((e: Error) => console.error('[ip_ledger hook] member_business_listing_created:', e));
      return { ok: true, manifest };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  // ── BP092 I12: Ring Bearer identity + Postgres ip_ledger_entries IPC ────────

  safeHandle('ip-ledger:get-identity', async () => {
    try {
      const { getRingBearerIdentity } = await import('./ip_ledger/ring_bearer_keygen');
      const identity = getRingBearerIdentity();
      return { ok: true, peer_id: identity.peer_id, public_key_hex: identity.public_key_hex };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  safeHandle('ip-ledger:get-pg-entries', async () => {
    try {
      const { getRingBearerIdentity } = await import('./ip_ledger/ring_bearer_keygen');
      const identity = getRingBearerIdentity();
      const supabaseUrl = getSupabaseUrl();
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || getAnonKey();
      if (!supabaseUrl || !supabaseKey) return { ok: false, error: 'Supabase config not available', entries: [] };
      const { createClient } = require('@supabase/supabase-js') as typeof import('@supabase/supabase-js');
      const sb = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false }, realtime: { transport: ws as unknown as typeof WebSocket } });
      const { data, error } = await sb
        .from('ip_ledger_entries')
        .select('entry_id, contribution_type, stamped_at, mesh_replicated, payload_url')
        .eq('ring_bearer_peer_id', identity.peer_id)
        .order('stamped_at', { ascending: false })
        .limit(50);
      if (error) return { ok: false, error: error.message, entries: [] };
      return { ok: true, entries: data ?? [] };
    } catch (err) {
      return { ok: false, error: (err as Error).message, entries: [] };
    }
  });

  // BP132 Yoke #22 — Diagnostic Mode UI (Help tab). Local-permission-gated status +
  // TTL grant/revoke for the BP099-K16 remote-hand poller (6-command READ_ONLY allowlist).
  safeHandle('diagnostic-mode:get-status', async () => {
    const mod = await import('./diagnostic_mode');
    return {
      pollerStarted: mod.pollerStarted,
      lastPollAt: mod.pollerLastPollAt,
      lastError: mod.pollerLastError,
      permissionActive: mod.isPermissionActive(),
    };
  });
  safeHandle('diagnostic-mode:activate-permission', async (_event, ttlMinutes: number) => {
    const mod = await import('./diagnostic_mode');
    const ttl = Math.max(1, Math.min(60, Math.floor(ttlMinutes || 10)));
    mod.activateLocalPermission(ttl);
    return { ok: true, ttlMinutes: ttl };
  });
  safeHandle('diagnostic-mode:revoke-permission', async () => {
    const mod = await import('./diagnostic_mode');
    mod.revokeLocalPermission();
    return { ok: true };
  });

  // BP132 Yoke #21 D9 / Yoke #22 one-click staged test / Yoke #23 WAN dispatch — see
  // src/main/mesh_test/one_click_mmlu_pro.ts for the full Truth-Always scope note.
  // mode: 'auto' (default, WAN if live peers exist else local) | 'wan_mesh' (require
  // live peers, honest failure if none) | 'local_ollama' (always local).
  safeHandle('mesh-test:run-one-click', async (_event, config: {
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
    // BP133 Yoke #24 Task 2: explicit opt-in to the 12-Blade Column Plow. WIRE-THE-LOOP fix
    // (single-box local plow): no longer wan_mesh-only -- see one_click_mmlu_pro.ts's
    // plowEnabled config doc for the local_ollama path.
    plowEnabled?: boolean;
    plowAndonEnabled?: boolean;
    // BP137 Yoke v2b (Research Arm): explicit opt-in, ignored unless plowEnabled is also true.
    // Threaded straight through to runOneClickMmluProTest -- see that function's config JSDoc.
    researchArmMode?: boolean;
    // BP138 Yoke 0.9.13 F3: explicit opt-in to mesh-synergy dispatch, ignored unless
    // plowEnabled + researchArmMode are also true. Threaded straight through to
    // runOneClickMmluProTest -- see that function's researchArmMeshSynergy JSDoc.
    researchArmMeshSynergy?: boolean;
    // BP138 Yoke Phase 2: explicit opt-in to the Decompose-and-Eliminate engine, ignored unless
    // plowEnabled + researchArmMode are also true (AND-gate applied in one_click_mmlu_pro.ts).
    // Threaded straight through to runOneClickMmluProTest -- see researchArmDecompose JSDoc.
    researchArmDecompose?: boolean;
    // BP134 Yoke #32 Phase F item 2: the "Full 14x5 MMLU-Pro" preset.
    exactPerCategory?: number;
    // BP135 Yoke #34 Phase 5: explicit opt-in to pooled cross-peer substrate (wan_mesh +
    // substrateEnabled only). Defaults false -- threaded straight through to
    // runOneClickMmluProTest, same pattern as substrateEnabled/plowEnabled above.
    federatedSubstrateEnabled?: boolean;
    // BP140-K6: explicit subset scoping ("Re-run misses" / manual "Run subset" in
    // OneClickMeshTestPanel.tsx). Threaded straight through to runOneClickMmluProTest --
    // see that function's questionIds JSDoc for the full priority-over-sampling rationale.
    // Absent/empty has ZERO effect on any pre-existing caller.
    questionIds?: string[];
  }) => {
    try {
      const { runOneClickMmluProTest } = await import('./mesh_test/one_click_mmlu_pro');
      const result = await runOneClickMmluProTest(config ?? {});
      return { ok: true, result };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  safeHandle('mesh-test:is-active', async () => {
    const { isOneClickRunActive } = await import('./mesh_test/one_click_mmlu_pro');
    return { active: isOneClickRunActive() };
  });

  // BP138 Yoke: one-click HOT/COLD substrate lift -- runs the SAME question set/config
  // TWICE (substrate+plow forced off, then the caller's requested config unmodified) and
  // reports both accuracies + the delta, reusing runOneClickMmluProTest's existing honest
  // sealed-key scoring path for both arms. See runHotColdLiftTest() in
  // one_click_mmlu_pro.ts for the full Truth-Always design note. Config shape is identical
  // to mesh-test:run-one-click above -- it represents the HOT arm exactly as configured
  // in the panel; the COLD arm's substrate/plow toggles are overridden internally.
  safeHandle('mesh-test:run-hotcold-lift', async (_event, config: {
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
    // BP138 Yoke 0.9.13 F3: see mesh-test:run-one-click's researchArmMeshSynergy doc above --
    // identical config shape, HOT-arm value.
    researchArmMeshSynergy?: boolean;
    exactPerCategory?: number;
    federatedSubstrateEnabled?: boolean;
  }) => {
    try {
      const { runHotColdLiftTest } = await import('./mesh_test/one_click_mmlu_pro');
      const result = await runHotColdLiftTest(config ?? {});
      return { ok: true, result };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  // BP133 Yoke #24 Task 3: Diagnostic terminal `stop` and `peers` commands. Read-only
  // (peers) or cooperative-cancel-only (stop) -- neither executes arbitrary input, both are
  // thin wrappers around functions already used by the one-click test itself.
  safeHandle('mesh-test:stop', async () => {
    const { requestOneClickCancel } = await import('./mesh_test/one_click_mmlu_pro');
    return requestOneClickCancel();
  });

  safeHandle('mesh-test:list-peers', async () => {
    const { discoverLiveWanPeers } = await import('./mesh_test/wan_dispatch');
    const peers = await discoverLiveWanPeers();
    return { ok: true, peers };
  });

  // BP132 Yoke #22 Addendum A — cue_card_templates read (data-driven CueDeckCardRenderer).
  // Schema confirmed live via anon-key REST probe (2026-07-23): id, project_id,
  // initiative_slug, template_type, title, subtitle, body_text, hashtags, background_type,
  // background_value, accent_color, card_style, qr_position, qr_size, twitter_text,
  // linkedin_text, facebook_text, is_active, sort_order, created_at, updated_at,
  // linked_deck_card_id, clicks_per_frame_unlock, total_clicks_for_unlock,
  // social_unlock_type, user_id. Read-only, anon-key-permitted (RLS allows select).
  safeHandle('cue-cards:get-template', async (_event, req: { id?: string; initiativeSlug?: string }) => {
    const supabaseUrl = getSupabaseUrl();
    const anonKey = getAnonKey();
    if (!supabaseUrl || !anonKey) return { ok: false, error: 'Supabase config not available' };
    if (!req.id && !req.initiativeSlug) return { ok: false, error: 'id or initiativeSlug is required' };
    try {
      const qs = req.id
        ? `id=eq.${encodeURIComponent(req.id)}`
        : `initiative_slug=eq.${encodeURIComponent(req.initiativeSlug!)}`;
      const res = await fetch(
        `${supabaseUrl}/rest/v1/cue_card_templates?${qs}&limit=1`,
        { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } },
      );
      if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
      const rows = await res.json();
      if (!Array.isArray(rows) || rows.length === 0) return { ok: false, error: 'not_found' };
      return { ok: true, template: rows[0] };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  // BP132 Yoke #22 Addendum A — Mints an ip_ledger_entries
  // row (via stampCertifyConnection, which mirrors this file's existing stampCertify
  // call pattern above) for a new member/peer connection, so the renderer can build
  // a fresh per-connection QR from the returned entry_id.
  safeHandle('ip-ledger:stamp-connection', async (_event, req: { peer_id: string; peer_display_name?: string; connection_method: string }) => {
    try {
      const { stampCertifyConnection } = await import('./ip_ledger/stamp_certify');
      const result = await stampCertifyConnection({
        peer_id: req.peer_id,
        peer_display_name: req.peer_display_name,
        connection_method: (req.connection_method as any) ?? 'federation_connect_peer',
      });
      return result;
    } catch (err) {
      return { ok: false, error: (err as Error).message, entry_id: '', ring_bearer_peer_id: '', payload_hash_hex: '', stamped_at: new Date().toISOString() };
    }
  });

  safeHandle('ip-ledger:get-entry-proof', async (_event, entryId: string) => {
    try {
      const { getRingBearerIdentity } = await import('./ip_ledger/ring_bearer_keygen');
      const identity = getRingBearerIdentity();
      const supabaseUrl = getSupabaseUrl();
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || getAnonKey();
      if (!supabaseUrl || !supabaseKey) return { ok: false, error: 'Supabase config not available' };
      const { createClient } = require('@supabase/supabase-js') as typeof import('@supabase/supabase-js');
      const sb = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false }, realtime: { transport: ws as unknown as typeof WebSocket } });
      const { data, error } = await sb
        .from('ip_ledger_entries')
        .select('*')
        .eq('entry_id', entryId)
        .single();
      if (error) return { ok: false, error: error.message };
      const row = data as Record<string, unknown> | null;
      const payloadHashHex = typeof row?.payload_hash === 'string'
        ? row.payload_hash.replace(/^\\x/, '')
        : '';
      const signatureHex = typeof row?.signature_ed25519 === 'string'
        ? row.signature_ed25519.replace(/^\\x/, '')
        : '';
      const proof = {
        entry_id: row?.entry_id,
        ring_bearer_peer_id: row?.ring_bearer_peer_id,
        ring_bearer_public_key_hex: identity.public_key_hex,
        contribution_type: row?.contribution_type,
        payload_hash_hex: payloadHashHex,
        signature_ed25519_hex: signatureHex,
        stamped_at: row?.stamped_at,
        verify_with: `node -e "const c=require('node:crypto');const h=Buffer.from('${payloadHashHex}','hex');const k=c.createPublicKey({key:Buffer.from('${identity.public_key_hex}','hex'),format:'der',type:'spki'});const s=Buffer.from('${signatureHex}','hex');console.log(c.verify(null,h,k,s))"`,
      };
      return { ok: true, proof };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  // ── SEG-4 v0.1.59 — Plow the Field IPC handlers ───────────────────────────

  safeHandle('plow:load-domain-bank', async (_, domain: string) => {
    const { loadDomainBank } = await import('./plow/per_domain_q_banks');
    return loadDomainBank(domain as import('./plow/per_domain_q_banks').Domain);
  });

  safeHandle('plow:run-andon-replow', async (_, { question, domain }: { question: string; domain: string }) => {
    const { runAndonReplowLoop } = await import('./plow/andon_replow');
    return runAndonReplowLoop(question, domain);
  });

  // ── BP134 Yoke #32 Phase D — Field-Sowing Runner IPC ──────────────────────
  let _fieldSowingCancelToken = { cancelled: false };

  safeHandle('plow:run-field-sowing', async (
    _event,
    fsConfig: { domain: string; maxPasses?: number; timeBudgetMs?: number; resume?: boolean },
  ) => {
    _fieldSowingCancelToken = { cancelled: false };
    const { runFieldSowing } = await import('./plow/field_sowing_runner');
    const broadcastProgress = (data: object) => {
      for (const w of BrowserWindow.getAllWindows()) {
        if (!w.isDestroyed()) w.webContents.send('plow:field-sowing-progress', data);
      }
    };
    try {
      const result = await runFieldSowing(
        fsConfig as import('./plow/field_sowing_runner').FieldSowingConfig,
        (event) => broadcastProgress(event),
        _fieldSowingCancelToken,
      );
      return { ok: true, result };
    } catch (err) {
      console.error('[FieldSowing] Fatal error:', err);
      broadcastProgress({ type: 'error', message: (err as Error).message });
      return { ok: false, error: (err as Error).message };
    }
  });

    safeHandle('plow:cancel-field-sowing', () => {
      _fieldSowingCancelToken.cancelled = true;
      console.log('[FieldSowing] Cancel requested via IPC');
      return { ok: true };
    });

    // ── BP134 Yoke #32 Phase G — "improves-over-time" manual refresh ──────────
    safeHandle('plow:refresh-chocolate-pack', async () => {
      try {
        const { consolidateChocolatePackages } = await import('./plow/chocolate_consolidator');
        const manifest = await consolidateChocolatePackages();
        return { ok: true, manifest };
      } catch (err) {
        console.error('[ChocolateConsolidator] manual refresh failed:', err);
        return { ok: false, error: (err as Error).message };
      }
    });

  // ── BP082 v0.2.2 — Founder Substrate Seed (Hypothesis D) ──────────────────
  // Reads all MMLU-Pro questions from bundled resources and writes Founder-attested
  // seed eblets to verified_eblets.jsonl. Bypasses concordance per Founder-attestation
  // doctrine (BP080 Tower-of-Peace canon). Emits progress events on the main window.
  //
  // BP137 Honest-MMLU-Provenance Yoke, Step 1: this handler writes q.correct_answer -- the
  // MMLU-Pro benchmark's OWN graded answer key -- into verified_eblets.jsonl for every bundled
  // question. That is precisely the contamination pattern this Yoke exists to kill (a benchmark
  // writing the answer it will later be graded against into the store it can be served back
  // from), so the write-back is hard-gated below regardless of the prior BP080 doctrine. This
  // handler is currently UNREACHABLE from the live app (its only caller, SubstrateSeedPanel.tsx,
  // is mounted only inside TestItOutTab.tsx, which is itself unrouted from CleanShell/App.tsx --
  // confirmed via grep of every renderer entry point). It is hard-gated anyway, defensively, so
  // this contamination cannot be silently reintroduced if the panel is ever rewired live.
  // Preserved as a stub (rather than deleted) so the IPC channel name stays valid for any
  // in-flight renderer caller; it now reports why it declined instead of writing the answer key.
  safeHandle('plow:seed-from-bank', async (_event) => {
    return {
      ok: false,
      error: 'plow:seed-from-bank disabled by BP137 Honest-MMLU-Provenance Yoke: this handler '
        + 'wrote the MMLU-Pro benchmark answer key directly into verified_eblets.jsonl, which is '
        + 'exactly the contamination pattern the Founder ordered removed. Use the CSIA Spider '
        + 'swarm (plow) path for substrate-sourced answers instead; the removed write-back is '
        + 'preserved in git history (pre-BP137) for reference.',
    };
  });
  // BP137 Honest-MMLU-Provenance Yoke, Step 1: the original write-back body (loaded the
  // bundled MMLU-Pro question banks and wrote each q.correct_answer into verified_eblets.jsonl
  // as a "founder_seed:mmlu_pro:<domain>:bp082" entry) has been deleted outright, not merely
  // commented out -- it lives in git history prior to this Yoke for anyone who needs to see the
  // exact prior contamination. It is not reproduced here because inert dead code that still
  // contains a full answer-key write-back is itself a re-contamination risk if ever copy-pasted
  // back into a live path; the disabled stub above is the complete replacement.

  // ── BP083 SEG-5 — Reset + Reseed Context-Class eblets ────────────────────
  //
  // Clears the existing verified_eblets.jsonl (which contains Q+A pairs that
  // poison the mesh test with direct answer-key lookup) and re-seeds with
  // CONTEXT-CLASS eblets: one eblet per question containing the question text as
  // the knowledge-surface key and the domain+category as the routing label.
  // The answer text is NOT written — the substrate holds topical context for RAG,
  // not answer keys.
  //
  // After this reset, Founder should re-run Plow the Field to grow the substrate
  // organically (Andon-discipline verified answers write context, not Q+A).

  safeHandle('plow:reset-and-reseed-context', async (event) => {
    const { loadDomainBank, getDomainList } = await import('./plow/per_domain_q_banks');
    const { mkdirSync: mkDir, writeFileSync: writeF, existsSync: existF } = await import('fs');
    const { resolve: resolveP } = await import('path');
    const { createHash: ch } = await import('crypto');
    const { app: appRef } = await import('electron');

    const ebletDir = resolveP(appRef.getPath('userData'), 'substrate');
    const ebletFile = resolveP(ebletDir, 'verified_eblets.jsonl');
    const backupFile = resolveP(ebletDir, `verified_eblets.backup_${Date.now()}.jsonl`);

    const broadcastProgress = (data: object) => {
      for (const w of BrowserWindow.getAllWindows()) {
        if (!w.isDestroyed()) w.webContents.send('plow:reset-reseed-progress', data);
      }
    };

    // Step 1: backup existing file
    if (existF(ebletFile)) {
      try {
        const { copyFileSync } = await import('fs');
        copyFileSync(ebletFile, backupFile);
        console.log(`[ResetReseed] Backed up to ${backupFile}`);
      } catch (e) {
        console.warn('[ResetReseed] Backup failed (non-fatal):', e);
      }
    }

    // Step 2: clear the file (start fresh)
    if (!existF(ebletDir)) mkDir(ebletDir, { recursive: true });
    writeF(ebletFile, '', 'utf-8');
    console.log('[ResetReseed] Cleared verified_eblets.jsonl');

    // Step 3: re-seed with context-class eblets
    // Format: { question: "<domain> | <question excerpt>", answer: "<domain category>",
    //           provenance: "context_seed:mmlu_pro:<domain>:bp083", verified: true, ... }
    // The question field is a TOPICAL LABEL (not the full Q+A pair).
    // This gives the substrate domain-knowledge routing without answer-key cheating.
    const { appendFileSync } = await import('fs');
    const domains = getDomainList();
    let total = 0;
    let written = 0;

    const allBanks: Array<{ domain: string; questions: import('./plow/per_domain_q_banks').Question[] }> = [];
    for (const domain of domains) {
      try {
        const q = loadDomainBank(domain);
        allBanks.push({ domain, questions: q });
        total += q.length;
      } catch { /* skip missing bank */ }
    }

    broadcastProgress({ written: 0, total, pct: 0 });

    for (const { domain, questions } of allBanks) {
      for (const q of questions) {
        // Store: domain-keyed topical label (first 100 chars of question), NOT the answer
        const excerpt = q.question.slice(0, 100);
        const topicalKey = `${domain.replace(/_/g, ' ')} | ${excerpt}`;
        const domainCategory = domain.replace(/_/g, ' ');
        const sha256 = ch('sha256').update(topicalKey + domainCategory).digest('hex');
        const entry = JSON.stringify({
          question: topicalKey,
          answer: domainCategory,
          provenance: `context_seed:mmlu_pro:${domain}:bp083`,
          verified: true,
          sha256,
          timestamp: Date.now(),
        });
        appendFileSync(ebletFile, entry + '\n', 'utf-8');
        written++;

        if (written % 100 === 0) {
          broadcastProgress({
            written, total,
            pct: Math.round((written / total) * 100),
          });
        }
      }
    }

    broadcastProgress({ written, total, pct: 100, done: true });
    console.log(`[ResetReseed] Complete — written=${written} context-class eblets (answer-key-free)`);
    return { ok: true, written, total, backupPath: backupFile };
  });

  // ── BP082 v0.2.3 — Beat-Google Benchmark IPC ──────────────────────────────

  safeHandle('plow:get-google-baselines', async () => {
    const { readFileSync, existsSync } = await import('fs');
    const { join } = await import('path');
    const basePath = app.isPackaged
      ? join(process.resourcesPath, 'google_baselines.json')
      : join(__dirname, '../../../resources/google_baselines.json');
    if (existsSync(basePath)) {
      try {
        return JSON.parse(readFileSync(basePath, 'utf-8')) as unknown;
      } catch {
        // fallthrough to inline fallback
      }
    }
    return { model: 'gemma4-12b-unified', aggregate: 0.772, per_domain_available_12b: false };
  });

  // Cancel token for the active benchmark run
  let _benchmarkCancelRequested = false;

  safeHandle('plow:cancel-benchmark', () => {
    _benchmarkCancelRequested = true;
    console.log('[BenchmarkRunner] Cancel requested via IPC');
    return { ok: true };
  });

  safeHandle('plow:run-benchmark', async (
    _event,
    config: { nPerDomain: number; randomSeed: number; model: string; ollamaBaseUrl: string },
  ) => {
    _benchmarkCancelRequested = false;
    const { runBeatGoogleBenchmark, generateReceiptMarkdown } = await import('./plow/benchmark_runner');
    const { writeFileSync, mkdirSync, existsSync } = await import('fs');
    const { join } = await import('path');

    const broadcastProgress = (data: object) => {
      for (const w of BrowserWindow.getAllWindows()) {
        if (!w.isDestroyed()) w.webContents.send('plow:benchmark-progress', data);
      }
    };

    const writeReceipt = (receiptMarkdown: string, timestamp: number): string | null => {
      try {
        const receiptsDir = join(app.getPath('userData'), 'benchmark_receipts');
        if (!existsSync(receiptsDir)) mkdirSync(receiptsDir, { recursive: true });
        const dateStr = new Date(timestamp).toISOString().slice(0, 10).replace(/-/g, '');
        const filename = `BP082_BEAT_GOOGLE_BENCHMARK_${dateStr}_${timestamp}.md`;
        const fullPath = join(receiptsDir, filename);
        writeFileSync(fullPath, receiptMarkdown, 'utf-8');
        console.log('[BenchmarkRunner] Receipt written:', fullPath);
        // Auto-copy to Asteroid-ProofVault (workspace vault)
        const vaultDir = join(app.getAppPath(), '../../../Asteroid-ProofVault');
        if (existsSync(vaultDir)) {
          try {
            writeFileSync(join(vaultDir, `BP082_BEAT_GOOGLE_BENCHMARK_RECEIPT_${dateStr}.md`), receiptMarkdown, 'utf-8');
            console.log('[BenchmarkRunner] Vault copy written');
          } catch (vErr) {
            console.warn('[BenchmarkRunner] Vault copy failed:', vErr);
          }
        }
        return fullPath;
      } catch (rErr) {
        console.error('[BenchmarkRunner] Receipt write failed:', rErr);
        return null;
      }
    };

    try {
      const result = await runBeatGoogleBenchmark(config, (progressEvent) => {
        broadcastProgress(progressEvent);
      });
      // Auto-generate and write receipt
      const receiptMarkdown = generateReceiptMarkdown(result);
      const receiptPath = writeReceipt(receiptMarkdown, result.startedAt);
      // Broadcast final complete event with receipt path
      broadcastProgress({ type: 'complete', result, receiptPath });
      return { ok: true, result, receiptPath };
    } catch (err) {
      console.error('[BenchmarkRunner] Fatal error:', err);
      broadcastProgress({ type: 'error', message: (err as Error).message });
      return { ok: false, error: (err as Error).message };
    }
  });

  // ── plow:write-receipt (BP082 v0.2.3 benchmark receipt writer) ───────────
  safeHandle('plow:write-receipt', async (
    _event,
    args: { receiptMarkdown: string; timestamp: number },
  ) => {
    try {
      const { writeFileSync, mkdirSync, existsSync } = await import('fs');
      const { join } = await import('path');
      const receiptsDir = join(app.getPath('userData'), 'benchmark_receipts');
      if (!existsSync(receiptsDir)) mkdirSync(receiptsDir, { recursive: true });
      const dateStr = new Date(args.timestamp).toISOString().slice(0, 10).replace(/-/g, '');
      const filename = `BP082_BENCHMARK_RECEIPT_${dateStr}_${args.timestamp}.md`;
      const fullPath = join(receiptsDir, filename);
      writeFileSync(fullPath, args.receiptMarkdown, 'utf-8');
      return { ok: true, path: fullPath };
    } catch (e) {
      return { ok: false, path: undefined };
    }
  });

  // ── plow:mesh-comparison — BP082 v0.3.1 3-condition runner ──────────────
  let _meshCancelToken = { cancelled: false };

  safeHandle('plow:mesh-grader-smoke-test', async (
    _event,
    config: { model: string; ollamaBaseUrl: string },
  ) => {
    const { runMeshGraderSmokeTest } = await import('./plow/mesh_comparison_runner');
    return runMeshGraderSmokeTest(config);
  });

  safeHandle('plow:cancel-mesh-comparison', () => {
    _meshCancelToken.cancelled = true;
    console.log('[MeshComparison] Cancel requested via IPC');
    return { ok: true };
  });

  safeHandle('plow:run-mesh-comparison', async (
    _event,
    config: { nPerDomain: number; randomSeed: number; model: string; ollamaBaseUrl: string },
  ) => {
    _meshCancelToken = { cancelled: false };
    const { runMeshComparison, generateMeshComparisonReceipt, runMeshGraderSmokeTest } = await import('./plow/mesh_comparison_runner');
    const { writeFileSync, mkdirSync, existsSync } = await import('fs');
    const { join } = await import('path');

    const broadcastProgress = (data: object) => {
      for (const w of BrowserWindow.getAllWindows()) {
        if (!w.isDestroyed()) w.webContents.send('plow:mesh-comparison-progress', data);
      }
    };

    const writeMeshReceipt = (receiptMarkdown: string, timestamp: number): string | null => {
      try {
        const receiptsDir = join(app.getPath('userData'), 'benchmark_receipts');
        if (!existsSync(receiptsDir)) mkdirSync(receiptsDir, { recursive: true });
        const dateStr = new Date(timestamp).toISOString().slice(0, 10).replace(/-/g, '');
        const filename = `BP082_MESH_COMPARISON_RECEIPT_${dateStr}_${timestamp}.md`;
        const fullPath = join(receiptsDir, filename);
        writeFileSync(fullPath, receiptMarkdown, 'utf-8');
        console.log('[MeshComparison] Receipt written:', fullPath);
        const vaultDir = join(app.getAppPath(), '../../../Asteroid-ProofVault');
        if (existsSync(vaultDir)) {
          try {
            writeFileSync(join(vaultDir, `BP082_MESH_COMPARISON_RECEIPT_${dateStr}.md`), receiptMarkdown, 'utf-8');
            console.log('[MeshComparison] Vault copy written');
          } catch (vErr) {
            console.warn('[MeshComparison] Vault copy failed:', vErr);
          }
        }
        return fullPath;
      } catch (rErr) {
        console.error('[MeshComparison] Receipt write failed:', rErr);
        return null;
      }
    };

    try {
      const smoke = await runMeshGraderSmokeTest({
        model: config.model,
        ollamaBaseUrl: config.ollamaBaseUrl,
      });
      broadcastProgress({ type: 'smoke-test', ...smoke });
      if (!smoke.ok) {
        broadcastProgress({ type: 'error', message: smoke.message });
        return { ok: false, error: smoke.message, smoke };
      }

      const result = await runMeshComparison(config, (progressEvent) => {
        broadcastProgress(progressEvent);
      }, _meshCancelToken);
      const receiptMarkdown = generateMeshComparisonReceipt(result);
      const receiptPath = writeMeshReceipt(receiptMarkdown, result.startedAt);
      broadcastProgress({ type: 'complete', result, receiptPath });
      return { ok: true, result, receiptPath };
    } catch (err) {
      console.error('[MeshComparison] Fatal error:', err);
      broadcastProgress({ type: 'error', message: (err as Error).message });
      return { ok: false, error: (err as Error).message };
    }
  });

  // ── BP083 v0.4.2 — Canonical Plow Pipeline IPC (Worker Service) ──────────
  // v0.4.2 SEG-1: Plow worker is now a true main-process singleton decoupled
  // from renderer state. NEVER dies on UI changes (Lean Mode toggle, tab switch,
  // window minimize). Only dies on explicit Cancel OR app exit.
  // SEG-5: Checkpoint written every N questions; Resume modal on next launch.

  safeHandle('plow:cancel-canonical-plow', () => {
    const { cancelPlowWorker } = require('./plow/plow_worker_service') as typeof import('./plow/plow_worker_service');
    cancelPlowWorker();
    console.log('[CanonicalPlow] Cancel requested via IPC');
    return { ok: true };
  });

  // Fire-and-forget start — returns immediately, progress broadcast to all windows
  safeHandle('plow:run-canonical-plow', async (
    _event,
    config: {
      domains: string[];
      questionsPerDomain: number;
      model?: string;
      ollamaBaseUrl?: string;
      specialistKeys?: {
        wolframApiKey?: string;
        stackExchangeKey?: string;
        pubmedApiKey?: string;
      };
    },
  ) => {
    const { startPlowWorker, getPlowWorkerState } = await import('./plow/plow_worker_service');
    const { getActiveModel } = await import('./ollama_model/model_picker');

    const state = getPlowWorkerState();
    if (state.status === 'running') {
      return { ok: false, error: 'Plow already running — cancel first' };
    }

    const model = config.model ?? getActiveModel();
    console.log(`[CanonicalPlow] Starting via worker service model=${model}`);

    startPlowWorker({
      domains: config.domains,
      questionsPerDomain: config.questionsPerDomain,
      ollamaBaseUrl: config.ollamaBaseUrl ?? 'http://127.0.0.1:11434',
      model,
      specialistKeys: config.specialistKeys ?? {},
    });

    // Return immediately — progress comes via plow:canonical-plow-progress broadcasts
    return { ok: true, async: true };
  });

  // Renderer can reconnect after unmount/remount — get current worker state
  safeHandle('plow:get-worker-state', async () => {
    const { getPlowWorkerState } = await import('./plow/plow_worker_service');
    return getPlowWorkerState();
  });

  // Check for interrupted plow checkpoint (for Resume modal)
  safeHandle('plow:check-checkpoint', async () => {
    const { readCheckpoint } = await import('./plow/plow_checkpoint');
    const cp = readCheckpoint();
    if (!cp || cp.status !== 'interrupted') return { hasCheckpoint: false };
    return {
      hasCheckpoint: true,
      sessionId: cp.sessionId,
      startedAt: cp.startedAt,
      lastUpdatedAt: cp.lastUpdatedAt,
      totalQuestionsCompleted: cp.totalQuestionsCompleted,
      totalQuestionsTarget: cp.totalQuestionsTarget,
      config: cp.config,
      completedQuestions: cp.completedQuestions,
    };
  });

  // Resume plow from checkpoint
  safeHandle('plow:resume-from-checkpoint', async () => {
    const { readCheckpoint, clearCheckpoint } = await import('./plow/plow_checkpoint');
    const { startPlowWorker, getPlowWorkerState } = await import('./plow/plow_worker_service');

    const state = getPlowWorkerState();
    if (state.status === 'running') return { ok: false, error: 'Plow already running' };

    const cp = readCheckpoint();
    if (!cp || cp.status !== 'interrupted') return { ok: false, error: 'No interrupted checkpoint found' };

    // Clear interrupted status so we can resume
    clearCheckpoint();

    startPlowWorker(
      {
        domains: cp.config.domains,
        questionsPerDomain: cp.config.questionsPerDomain,
        ollamaBaseUrl: 'http://127.0.0.1:11434',
        model: cp.config.model,
      },
      { completedQuestions: cp.completedQuestions, sessionId: cp.sessionId },
    );

    return { ok: true };
  });

  // Discard checkpoint (user chose not to resume)
  safeHandle('plow:discard-checkpoint', async () => {
    const { clearCheckpoint } = await import('./plow/plow_checkpoint');
    clearCheckpoint();
    return { ok: true };
  });

  // Hardware tier detection — for Settings UI + onboarding
  safeHandle('hardware:get-tier', async () => {
    const { detectHardwareTier, getAllTiers, resolveEffectiveModel, getCachedEffectiveModel } = await import('./hardware/ram_detector');
    const { getActiveModel } = await import('./ollama_model/model_picker');
    const tier = detectHardwareTier();
    const allTiers = getAllTiers();
    const activeModel = getActiveModel();
    // M18b: Return cached effective model result (honors right-size.json override)
    const effectiveModelResult = getCachedEffectiveModel() ?? await resolveEffectiveModel();
    return { tier, allTiers, activeModel, effectiveModelResult };
  });

  safeHandle('hardware:set-model', async (_event, { model, tier }: { model: string; tier: string }) => {
    const { setActiveModel } = await import('./ollama_model/model_picker');
    setActiveModel(model, tier as import('./hardware/ram_detector').HardwareTier);
    return { ok: true };
  });

  safeHandle('hardware:reset-model', async () => {
    const { resetToDetectedModel } = await import('./ollama_model/model_picker');
    const model = resetToDetectedModel();
    return { ok: true, model };
  });

  // ── v0.4.2 BP083 SEG-3.5 — Lifecycle / Onboarding IPC ───────────────────
  // Handles server-side lifecycle operations; client-side localStorage is managed by renderer.

  // Reset onboarding (clears lifecycle flags from persisted config — full profile is in AppData)
  safeHandle('lifecycle:get-profile-path', async () => {
    return {
      appData: app.getPath('appData'),
      mnemosyneCPath: join(app.getPath('appData'), 'MnemosyneC'),
    };
  });

  // ── v0.5.1 BP085 — Help Tab peer pipeline IPC ────────────────────────────

  // Lazily-created Supabase admin client for help IPC handlers.
  // Using service-role key from main process — bypasses RLS, Electron main is trust boundary.
  let _helpSupabase: import('@supabase/supabase-js').SupabaseClient | null = null;
  let _helpPollingStarted = false;

  function getHelpSupabase(): import('@supabase/supabase-js').SupabaseClient | null {
    if (_helpSupabase) return _helpSupabase;
    const url = getSupabaseUrl();
    // Prefer service-role key (bypasses RLS for storage ops); fall back to anon key
    // so Realtime subscriptions work in the packaged Electron app where service-role
    // key is intentionally absent.
    const key =
      process.env.SUPABASE_SERVICE_ROLE_KEY || getAnonKey();
    if (!url || !key) {
      console.warn('[help] SUPABASE_URL or Supabase key not set · help pipeline unavailable');
      return null;
    }
    try {
      const { createClient } = require('@supabase/supabase-js') as typeof import('@supabase/supabase-js');
      _helpSupabase = createClient(url, key, { auth: { persistSession: false }, realtime: { transport: ws as unknown as typeof WebSocket } });
      return _helpSupabase;
    } catch (err) {
      console.error('[help] Failed to create Supabase client:', (err as Error).message);
      return null;
    }
  }

  async function ensureHelpScreenshotsBucket(): Promise<void> {
    const sb = getHelpSupabase();
    if (!sb) return;
    try {
      const { error } = await sb.storage.createBucket('help_screenshots', {
        public: false,
        fileSizeLimit: 10 * 1024 * 1024,
        allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
      });
      if (error && !error.message?.toLowerCase().includes('already exists')) {
        console.error('[help] Failed to create help_screenshots bucket:', error.message);
      }
    } catch (err) {
      console.error('[help] ensureHelpScreenshotsBucket error:', (err as Error).message);
    }
  }

  // Ensure bucket exists at startup (non-blocking, non-fatal)
  ensureHelpScreenshotsBucket().catch(() => {});

  safeHandle('help:get-peer-id', async () => {
    try {
      const peerId = await getStablePeerId();
      return { peerId };
    } catch (err) {
      console.error('[help] get-peer-id error:', (err as Error).message);
      return { peerId: 'unknown' };
    }
  });

  safeHandle('help:send-message', async (_event, args: {
    text: string;
    imageUrl: string | null;
    fromPeer: string;
    toPeer: string | null;
  }) => {
    try {
      const sb = getHelpSupabase();
      if (!sb) return { success: false, error: 'Platform database not configured' };

      const { data, error } = await sb
        .from('help_messages')
        .insert({
          from_peer: args.fromPeer,
          to_peer: args.toPeer ?? null,
          content_text: args.text ?? '',
          content_image_url: args.imageUrl ?? null,
        })
        .select('id')
        .single();

      if (error) return { success: false, error: error.message };
      return { success: true, id: (data as { id: string }).id };
    } catch (err) {
      console.error('[help] send-message error:', (err as Error).message);
      return { success: false, error: (err as Error).message };
    }
  });

  safeHandle('help:load-messages', async (_event, args: { limit: number }) => {
    try {
      const sb = getHelpSupabase();
      if (!sb) return { error: 'Platform database not configured' };

      const limit = Math.min(args?.limit ?? 50, 200);
      const { data, error } = await sb
        .from('help_messages')
        .select('id, from_peer, to_peer, content_text, content_image_url, created_at')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) return { error: error.message };
      return data ?? [];
    } catch (err) {
      console.error('[help] load-messages error:', (err as Error).message);
      return { error: (err as Error).message };
    }
  });

  safeHandle('help:upload-screenshot', async (_event, args: { base64Data: string; mimeType: string }) => {
    try {
      const sb = getHelpSupabase();
      if (!sb) return { error: 'Platform database not configured' };

      await ensureHelpScreenshotsBucket();

      const peerId = await getStablePeerId();
      const ext = args.mimeType.split('/')[1] ?? 'png';
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const path = `${peerId}/${filename}`;

      // Decode base64 to Buffer for upload
      const buffer = Buffer.from(args.base64Data, 'base64');

      const { error: uploadError } = await sb.storage
        .from('help_screenshots')
        .upload(path, buffer, { contentType: args.mimeType, upsert: false });

      if (uploadError) return { error: uploadError.message };

      // Generate signed URL (bucket is private)
      const { data: signedData, error: signedError } = await sb.storage
        .from('help_screenshots')
        .createSignedUrl(path, 60 * 60 * 24 * 7); // 7 days

      if (signedError || !signedData?.signedUrl) {
        return { error: signedError?.message ?? 'Failed to generate signed URL' };
      }

      return { url: signedData.signedUrl };
    } catch (err) {
      console.error('[help] upload-screenshot error:', (err as Error).message);
      return { error: (err as Error).message };
    }
  });

  safeHandle('help:start-realtime-sub', async (_event) => {
    // BP086 I9: replaced Supabase Realtime WebSocket subscription with REST polling.
    // Realtime silently fails in Electron main process (Node.js has no global WebSocket).
    // Polling every 5s is the proven pattern (same as relay_routes + fleet_broadcast).
    if (_helpPollingStarted) return { ok: true };
    _helpPollingStarted = true;

    const supabaseUrl = getSupabaseUrl();
    const supabaseKey =
      getAnonKey();

    if (!supabaseUrl || !supabaseKey) {
      console.warn('[help-poll] SUPABASE_URL or key not set — help message polling disabled');
      return { ok: true };
    }

    const headers = {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
    };

    let lastChecked = new Date().toISOString();

    async function pollHelpMessages(): Promise<void> {
      try {
        const url =
          `${supabaseUrl}/rest/v1/help_messages` +
          `?created_at=gt.${encodeURIComponent(lastChecked)}` +
          `&select=id,from_peer,to_peer,content_text,content_image_url,created_at` +
          `&order=created_at.asc`;

        const res = await fetch(url, { headers });
        if (!res.ok) return;

        const msgs: Array<{
          id: string;
          from_peer: string;
          to_peer: string | null;
          content_text: string;
          content_image_url: string | null;
          created_at: string;
        }> = await res.json();

        if (msgs.length > 0) {
          lastChecked = msgs[msgs.length - 1].created_at;
          for (const msg of msgs) {
            for (const w of BrowserWindow.getAllWindows()) {
              if (!w.isDestroyed()) {
                w.webContents.send('help:new-message', msg);
              }
            }
          }
        }
      } catch {
        // Silent — don't crash main process on poll error
      }
    }

    setInterval(pollHelpMessages, 5000);
    console.log('[help-poll] polling started for help_messages (5s interval)');
    return { ok: true };
  });

  // ── BP083 v0.3.8 — GPQA Diamond Benchmark IPC ────────────────────────────

  let _diamondCancelToken = { cancelled: false };

  safeHandle('diamond:cancel', () => {
    _diamondCancelToken.cancelled = true;
    return { ok: true };
  });

  safeHandle('diamond:run', async (
    _event,
    config: { mode: 'bare' | 'cooperative'; count: number },
  ) => {
    _diamondCancelToken = { cancelled: false };

    const { runBareDiamond, runCooperativeDiamond } = await import('./plow/diamond_runner');

    const broadcastProgress = (data: object) => {
      for (const w of BrowserWindow.getAllWindows()) {
        w.webContents.send('diamond:progress', data);
      }
    };

    try {
      const runner = config.mode === 'bare' ? runBareDiamond : runCooperativeDiamond;
      const summary = await runner(
        config.count ?? 50,
        (event) => broadcastProgress(event),
        _diamondCancelToken,
      );

      broadcastProgress({ type: 'complete', summary });
      return { ok: true, summary };
    } catch (err) {
      console.error('[Diamond] Fatal error:', err);
      broadcastProgress({ type: 'error', message: (err as Error).message });
      return { ok: false, error: (err as Error).message };
    }
  });

  // ── SEG-5 v0.1.59 — Clipboard read IPC ────────────────────────────────────

  safeHandle('clipboard:read', async () => {
    return clipboard.readText();
  });

  // M22 §5 — Mesh dispatcher IPC handlers
  safeHandle('mesh:dispatch-task', async (_event: Electron.IpcMainInvokeEvent, task: import('./mesh-dispatcher').CooperativeTask) => {
    try {
      const { routeTask, dispatchToAssignedPeers, accrueMarks } = require('./mesh-dispatcher') as typeof import('./mesh-dispatcher');
      const assignments = await routeTask(task);
      if (assignments.length === 0) {
        return { status: 'no_eligible_peers', task_id: task.task_id, assignments: [] };
      }
      const results = await dispatchToAssignedPeers(assignments, task);
      for (const r of results) {
        await accrueMarks(r, task.source);
      }
      // BP092 I12 — Stamp-Certify hook: battery_dispatch_submission (fire-and-forget)
      void Promise.all([
        import('./ip_ledger/stamp_certify'),
        import('./ip_ledger/ring_bearer_keygen'),
      ]).then(([{ stampCertify }, { getRingBearerIdentity }]) => {
        const identity = getRingBearerIdentity();
        return stampCertify({
          contribution_type: 'battery_dispatch_submission',
          payload: JSON.stringify({ event: 'battery_dispatch_submission', dispatch_id: task.task_id, member_id: identity.peer_id, timestamp: Date.now() }),
        });
      }).catch((e: Error) => console.error('[ip_ledger hook] battery_dispatch_submission:', e));
      return { status: 'ok', task_id: task.task_id, results };
    } catch (err) {
      console.error('[mesh:dispatch-task] error:', (err as Error).message);
      return { status: 'error', error: (err as Error).message };
    }
  });

  safeHandle('mesh:get-activity-summary', async () => {
    try {
      const supabaseUrl = getSupabaseUrl();
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || getAnonKey();
      if (!supabaseUrl || !supabaseKey) return { status: 'error', error: 'Supabase not configured' };

      const { createClient } = require('@supabase/supabase-js') as typeof import('@supabase/supabase-js');
      const sb = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

      // Get active peers. BP133 Yoke #26: peer_presence's column is `state`, not `status`.
      const { data: peers } = await sb.from('peer_presence').select('peer_id, wan_soccerball_id, machine_label, capabilities, last_seen_at, role').eq('state', 'active');

      // Get per-peer marks totals
      const { data: marksData } = await sb.from('peer_marks_log').select('peer_id, marks_earned, completed_at').order('completed_at', { ascending: false }).limit(1000);

      // Aggregate marks per peer
      const marksByPeer: Record<string, number> = {};
      const lastTaskByPeer: Record<string, string> = {};
      for (const row of (marksData ?? [])) {
        marksByPeer[row.peer_id] = (marksByPeer[row.peer_id] ?? 0) + row.marks_earned;
        if (!lastTaskByPeer[row.peer_id]) lastTaskByPeer[row.peer_id] = row.completed_at;
      }

      const peerSummary = (peers ?? []).map((p: Record<string, unknown>) => ({
        peer_id: p.peer_id,
        wan_soccerball_id: p.wan_soccerball_id,
        machine_label: p.machine_label ?? p.wan_soccerball_id,
        ram_tier: (p.capabilities as Record<string, unknown>)?.ramTier ?? 'unknown',
        model: (p.capabilities as Record<string, unknown>)?.ollamaModel ?? 'unknown',
        last_seen_at: p.last_seen_at,
        role: p.role ?? 'worker',
        marks_total: marksByPeer[p.peer_id as string] ?? 0,
        last_task_at: lastTaskByPeer[p.peer_id as string] ?? null,
      }));

      const totalMarks = Object.values(marksByPeer).reduce((a, b) => a + b, 0);

      return { status: 'ok', peers: peerSummary, total_marks: totalMarks };
    } catch (err) {
      return { status: 'error', error: (err as Error).message };
    }
  });

  // --- APPEND ZONE: IPC-HANDLER -- new safeHandle()/ipcMain.handle() registrations go below this line, per KN-BP145-E
  // One handler registration per new IPC channel. Never insert a new handler between existing
  // handlers above; always append here instead, before this function's closing brace.
  // KN-BP147-M4: UNBARREL THE BARRELS -- wires TwoBarrelMeter.tsx's VendorUsageBarrel to the
  // real, already-built usage_barrel_scraper.ts (READ-ONLY to this ticket, not edited). Calls
  // computeUsageBarrelOperationalSnapshot() (which itself calls scrapeVendorUsagePanel() -- see
  // that file's header), then shapes the result into the exact VendorUsageBarrelData contract
  // TwoBarrelMeter.tsx already defines, so the renderer needs zero additional mapping. Never
  // fabricates a percent: a scrape failure maps to status:'error' with the scraper's own
  // failureReason, verbatim.
  safeHandle('usage-barrel-get-vendor-usage', async () => {
    try {
      const snapshot = await computeUsageBarrelOperationalSnapshot();
      const { scrape } = snapshot;
      const toView = (
        r: { label: string; percentConsumed: number; resetText: string } | null,
      ): { label: string; percentConsumed: number; resetText: string } | null =>
        (r ? { label: r.label, percentConsumed: r.percentConsumed, resetText: r.resetText } : null);
      return {
        status: scrape.success ? 'ok' : 'error',
        fiveHour: toView(scrape.fiveHour),
        weeklyAllModels: toView(scrape.weeklyAllModels),
        weeklyModelSpecific: toView(scrape.weeklyModelSpecific),
        usageCredits: scrape.usageCredits,
        operationalAnswer: snapshot.operationalAnswer,
        lastCheckedAt: scrape.scrapedAt,
        failureReason: scrape.failureReason,
      };
    } catch (err) {
      return {
        status: 'error' as const,
        fiveHour: null,
        weeklyAllModels: null,
        weeklyModelSpecific: null,
        usageCredits: null,
        operationalAnswer: null,
        lastCheckedAt: new Date().toISOString(),
        failureReason: `ipc-handler-exception:${err instanceof Error ? err.message : String(err)}`,
      };
    }
  });
  // KN-BP147-M2 (D-BP147-005): THE CRYSTAL, WIRED -- five thin wrappers around
  // src/main/crystal/crystal_store.ts's (KN-BP147-M1) exported functions, via the shared
  // getCrystalStore() loader defined just above this function. Every handler treats
  // getCrystalStore() === null as the FAIL-OPEN case (see that function's own header) and
  // returns { ok:false, error } rather than throwing -- an unreachable Crystal must never crash
  // a renderer call or wedge the app. mintChonk/deriveMintAddress can throw synchronously on
  // bad input (empty pearls array); the inner try/catch in each handler below catches that too,
  // for the same reason.
  safeHandle('crystal:mint', (_event, pearls: string[]) => {
    const store = getCrystalStore();
    if (!store) return { ok: false, error: 'crystal store unavailable (failed to load at startup)' };
    try {
      const sid = store.mintChonk(pearls);
      return { ok: true, sid };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  safeHandle('crystal:bind', (_event, sid: string, key: string, target: BindingTarget) => {
    const store = getCrystalStore();
    if (!store) {
      return {
        ok: false,
        sid,
        key,
        accepted: 'rejected-additive-only' as const,
        error: 'crystal store unavailable (failed to load at startup)',
      };
    }
    try {
      return store.bindChonk(sid, key, target);
    } catch (err) {
      return {
        ok: false,
        sid,
        key,
        accepted: 'rejected-additive-only' as const,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });

  safeHandle(
    'crystal:mutate',
    (_event, sid: string, key: string, target: BindingTarget, reason: MutationReason, note: string) => {
      const store = getCrystalStore();
      if (!store) {
        return {
          ok: false,
          sid,
          key,
          accepted: 'rejected-invalid-reason' as const,
          error: 'crystal store unavailable (failed to load at startup)',
        };
      }
      try {
        return store.mutateChonkBinding(sid, key, target, reason, note);
      } catch (err) {
        return {
          ok: false,
          sid,
          key,
          accepted: 'rejected-invalid-reason' as const,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  );

  safeHandle('crystal:resolve', (_event, sid: string) => {
    const store = getCrystalStore();
    if (!store) return { ok: false, resolved: null, error: 'crystal store unavailable (failed to load at startup)' };
    try {
      return { ok: true, resolved: store.resolveChonk(sid) };
    } catch (err) {
      return { ok: false, resolved: null, error: err instanceof Error ? err.message : String(err) };
    }
  });

  safeHandle('crystal:stats', () => {
    const store = getCrystalStore();
    if (!store) return { ok: false, error: 'crystal store unavailable (failed to load at startup)' };
    try {
      return { ok: true, stats: store.crystalStats() };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  // D-BP152-022/BISHOP/seg-laboratory-and-keep -- THE LABORATORY (FD-BP152-10 tier 1) AND KEEP
  // (FD-BP152-07: ephemeral unless he says "keep"). A channel wholly separate from
  // 'liana-stepped-respond' above -- saving a query never flows through the stepped-pause action
  // union (approve/correct/redirect/ask_google), so those four are untouched by this addition.
  // See laboratory_store.ts's own header for the chosen on-disk path and why.
  safeHandle('liana-laboratory-save', async (_event, args: {
    name: string;
    queryTextVerbatim: string;
    provenance: { runInput: string };
  }) => {
    try {
      return saveLaboratoryStep({
        name: args?.name ?? '',
        queryTextVerbatim: args?.queryTextVerbatim ?? '',
        provenance: args?.provenance ?? { runInput: '' },
      });
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : String(e) };
    }
  });

  // READ-ONLY: nothing on this channel writes, edits, or deletes a Laboratory file. Returns the
  // renderer-facing summary shape (LianaLaboratoryStepSummary) -- the full on-disk record (the
  // reused StepDeclaration) stays on disk for a human to read directly, per this ticket's own
  // "he can find and read it without the app" criterion.
  safeHandle('liana-laboratory-list', async () => {
    try {
      const steps = listLaboratorySteps().map((r) => ({
        name: r.name,
        version: r.declaration.version,
        queryTextVerbatim: r.queryTextVerbatim,
        savedBy: r.savedBy,
        savedAt: r.savedAt,
        provenance: r.provenance,
      }));
      return { ok: true as const, steps };
    } catch (e) {
      return { ok: false as const, steps: [], error: e instanceof Error ? e.message : String(e) };
    }
  });
  // --- END APPEND ZONE: IPC-HANDLER --------------------------------------
}

// --- Mesh Results Watcher (SEG-U-7 BP078) ------------------------------------
// Parses a mesh results JSON and returns typed metrics, or null on failure.
function parseMeshResultsFile(filePath: string): {
  hot_accuracy_pct: number;
  cold_accuracy_pct: number;
  delta_pp: number;
  fast_cheap_good: string;
  svgPath?: string;
} | null {
  try {
    const raw = readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw) as Record<string, unknown>;

    const hot = typeof data.hot_accuracy_pct === 'number' ? data.hot_accuracy_pct
      : typeof data.hot_accuracy === 'number' ? data.hot_accuracy * 100
      : null;
    const cold = typeof data.cold_accuracy_pct === 'number' ? data.cold_accuracy_pct
      : typeof data.cold_accuracy === 'number' ? data.cold_accuracy * 100
      : null;

    if (hot === null || cold === null) return null;

    const delta = typeof data.delta_pp === 'number' ? data.delta_pp : hot - cold;
    const fcg = typeof data.fast_cheap_good === 'string' ? data.fast_cheap_good
      : typeof data.fast_cheap_good === 'number' ? String(data.fast_cheap_good)
      : '';

    return { hot_accuracy_pct: hot, cold_accuracy_pct: cold, delta_pp: delta, fast_cheap_good: fcg };
  } catch {
    return null;
  }
}

// Scan a directory for files matching a glob-like prefix/suffix pattern.
function findMatchingFile(dir: string, prefix: string, suffix: string): string | null {
  try {
    const files = readdirSync(dir);
    const match = files.find((f) => f.startsWith(prefix) && f.endsWith(suffix));
    return match ? join(dir, match) : null;
  } catch {
    return null;
  }
}

// Emit mesh-test-complete to all live windows that have a webContents.
function emitMeshComplete(metrics: {
  hot_accuracy_pct: number;
  cold_accuracy_pct: number;
  delta_pp: number;
  fast_cheap_good: string;
  svgPath?: string;
}): void {
  [overlayWindow, dashboardWindow].forEach((win) => {
    if (win && !win.isDestroyed()) {
      win.webContents.send('mesh-test-complete', metrics);
    }
  });
}

// ─── BP080 Genesis Mint ───────────────────────────────────────────────────────
// STAGED — NOT called from app startup. Triggered only via ip-ledger:execute-genesis-mint
// IPC after Founder confirms the payload in GENESIS_MINT_DRAFT_PAYLOAD_BP080.md.
// Federal Body Cam doctrine: once written, the entry cannot be deleted — only superseded.

/** Generate vCard QR PNG for the Founder at resources/founder-vcard.png. */
async function generateFounderVcardQr(genesisLedgerId: string): Promise<string> {
  const QRCode = await import('qrcode');
  const qr = (QRCode.default ?? QRCode) as typeof import('qrcode');
  const vcard = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    'FN:FounderDenken',
    'ORG:MnemosyneC Cooperative',
    'EMAIL:Founder@LianaBanyan.com',
    'URL:https://mnemosynec.ai',
    `NOTE:User 000001 · MnemosyneC Cooperative Founder · 21 provisional filings · genesis:user:000001 · genesis_ledger_id: ${genesisLedgerId}`,
    'END:VCARD',
  ].join('\n');
  const outputPath = join(__dirname, '..', '..', 'resources', 'founder-vcard.png');
  await qr.toFile(outputPath, vcard, { width: 300, margin: 2 });
  return outputPath;
}

async function mintGenesisIfAbsent(): Promise<void> {
  try {
    const entries = loadAllEntries();
    if (entries.some(e => e.claim === 'genesis:user:000001')) return;
    registerClaim({
      registered_by: 'member_000001',
      claim: 'genesis:user:000001',
      claim_body: JSON.stringify({
        display_name: 'FounderDenken',
        cooperative_role: 'founder',
        provisional_filings: 21,
        filing_refs: [
          'LB-PROV-001 through LB-PROV-021',
          'USPTO App #64/079,336 (most recent, 2026-06-01)',
        ],
        cooperative_name: 'MnemosyneC',
        genesis_timestamp: new Date().toISOString(),
      }),
      evidence: [
        'Asteroid-ProofVault/BP070_CLOSE_STAMP.md',
        'USPTO App #64/079,336 filed 2026-06-01',
      ],
      category: 'provisional',
    });
    console.log('[Genesis] User 000001 minted in IP Ledger');
  } catch (e) {
    console.error('[Genesis] Mint failed:', e);
  }
}

// BP104 D4 — expire stale relay_routes for this peer at boot + every 60 min
async function bootZombieFlush(peerId: string, supabaseUrl: string, anonKey: string): Promise<number> {
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/expire_stale_routes_for_peer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`,
      },
      body: JSON.stringify({ p_peer_id: peerId }),
    });
    if (!res.ok) {
      console.warn('[boot] zombie flush RPC non-200:', res.status);
      return 0;
    }
    const data = await res.json() as Array<{ expired_count?: number }> | { expired_count?: number };
    const count = Array.isArray(data) ? (data[0]?.expired_count ?? 0) : (data?.expired_count ?? 0);
    if (count > 0) {
      console.log(`[boot] flushed ${count} zombie routes`);
      for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) {
          win.webContents.send('boot-zombie-flush', { count });
        }
      }
    }
    return count;
  } catch (e) {
    console.warn('[boot] zombie flush non-fatal:', e instanceof Error ? e.message : String(e));
    return 0;
  }
}

function scheduleZombieFlush(peerId: string): void {
  const supabaseUrl = getSupabaseUrl();
  const anonKey =
    getAnonKey();
  if (!supabaseUrl || !anonKey) return;

  if (_zombieFlushInterval) clearInterval(_zombieFlushInterval);
  _zombieFlushInterval = setInterval(() => {
    bootZombieFlush(peerId, supabaseUrl, anonKey).catch(() => { /* non-fatal */ });
  }, 60 * 60 * 1000);
}

// D6c — relay poll counter; incremented on each pollOnce() tick for watchdog monitoring
let _relayPollCount = 0;
let _relayPollInterval: NodeJS.Timeout | null = null;

// BP086 I5c: relay_routes poll loop — answers questions dispatched by orchestrator
// Polls every 5s; handles cross-WAN peers without IP-to-IP routing
function startRelayRoutePoll(peerId: string): NodeJS.Timeout {
  const supabaseUrl = getSupabaseUrl();
  const supabaseKey =
    getAnonKey();

  if (!supabaseUrl || !supabaseKey) {
    console.warn('[relay-poll] SUPABASE_URL or SUPABASE_ANON_KEY not set — relay poll disabled');
    return setInterval(() => {}, 999999);
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`,
  };

  async function pollOnce() {
    _relayPollCount++;
    // K-D6-6-10: sync _relayPollCount to peer_presence every ~30s (every 6 polls × 5s cadence)
    // The heartbeat_worker sends relay_poller_poll_count:null which never updates the field;
    // this PATCH from the main thread is the only path that writes the actual count to Supabase.
    if (_relayPollCount % 6 === 1) {
      fetch(`${supabaseUrl}/rest/v1/peer_presence?peer_id=eq.${encodeURIComponent(peerId)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ relay_poller_poll_count: _relayPollCount }),
        signal: AbortSignal.timeout(10_000),
      }).catch(() => { /* non-fatal */ });
    }
    try {
      const url = `${supabaseUrl}/rest/v1/relay_routes?target_peer_id=eq.${encodeURIComponent(peerId)}&status=eq.pending&select=id,hex_frame,payload_json,session_id`;
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) });
      if (!res.ok) return;
      const routes: Array<{ id: string; hex_frame: string; payload_json: Record<string, unknown> | null; session_id: string | null }> = await res.json();

      for (const route of routes) {
        // Mark processing
        await fetch(`${supabaseUrl}/rest/v1/relay_routes?id=eq.${route.id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ status: 'processing' }),
        });

        const startMs = Date.now();
        try {
          const payload = (route.payload_json as Record<string, unknown>) ?? {};

          // BP135 Phase 3 (Layer B: federated substrate). A `query_type:'eblet_topical'`
          // route is NOT an MMLU-Pro answer request -- it is the asker (see wan_dispatch.ts's
          // queryTopicalEbletsFromPeers()) asking THIS peer for its own topical eblets so the
          // asker can pool them across all live peers before the real answer round. Handled
          // here, first, so it short-circuits the entire plow/single-shot/Minor-Council
          // machinery below -- that machinery is for answering MC questions, not this.
          if (payload.query_type === 'eblet_topical') {
            const topicalQuestion: string = typeof payload.question_text === 'string' ? payload.question_text : '';
            const topicalDomain: string = typeof payload.domain === 'string' ? payload.domain : 'general';
            const topicalTopK: number = typeof payload.top_k === 'number' ? (payload.top_k as number) : 3;
            // Same guard as every other topical caller in this codebase (substrate_toggle.ts,
            // one_click_mmlu_pro.ts): queryVerifiedEbletsTopical() -- never the exact-match
            // queryVerifiedEblets() -- so a federated peer can never leak an answer-key hit.
            const { queryVerifiedEbletsTopical } = await import('./mnem_eblet_store');
            const hits = await queryVerifiedEbletsTopical(topicalQuestion, topicalDomain, topicalTopK);
            await fetch(`${supabaseUrl}/rest/v1/relay_route_replies`, {
              method: 'POST',
              headers: { ...headers, 'Prefer': 'return=minimal' },
              body: JSON.stringify({
                route_id: route.id,
                peer_id: peerId,
                answer_json: {
                  query_type: 'eblet_topical',
                  eblets: hits.map((e) => ({
                    question: e.question, answer: e.answer, provenance: e.provenance, timestamp: e.timestamp,
                    // BP135 Yoke #34 (0.9.7) argument-ledger: surfaced additively so a federated
                    // asker can apply the same KNOWN-WRONG treatment as the local-only path
                    // (substrate_toggle.ts) -- absent on eblets written before 0.9.7, which the
                    // asker must treat as verdict='unverified' (see readVerdict() convention).
                    ...(e.verdict !== undefined ? { verdict: e.verdict } : {}),
                    ...(e.reasoning !== undefined ? { reasoning: e.reasoning } : {}),
                  })),
                  responder_peer_id: peerId,
                },
                processing_ms: Date.now() - startMs,
              }),
            });
            await fetch(`${supabaseUrl}/rest/v1/relay_routes?id=eq.${route.id}`, {
              method: 'PATCH',
              headers,
              body: JSON.stringify({ status: 'answered' }),
            });
            console.log(`[relay-poll] eblet_topical query answered route=${route.id.slice(0, 8)} hits=${hits.length}`);
            continue;
          }

          // BP138 Yoke Phase 3: option-fan-out verification mode.
          // When the asker dispatched this question with `assigned_option` (a specific MC letter)
          // AND `research_arm_option_fan_out: true`, this peer verifies ONLY that option's
          // foundation fact instead of running the full plow. Returns `option_verdict` in
          // answer_json so the asker can pool verdicts and apply elimination logic.
          // GATING: unreachable when either field is absent/off -- byte-identical behavior for
          // every pre-Phase-3 relay route.
          const assignedOptionForFanOut: string | null =
            typeof payload.assigned_option === 'string' ? (payload.assigned_option as string).toUpperCase() : null;
          const optionFanOutEnabled: boolean = payload.research_arm_option_fan_out === true;
          if (assignedOptionForFanOut && optionFanOutEnabled && isNexusAuthorityFlagEnabled()) {
            try {
              const { verifyAssignedOption } = await import('./plow/plow_mc_decompose');
              const questionText: string = typeof payload.question_text === 'string' ? payload.question_text as string : '';
              const questionOptions: string[] = Array.isArray(payload.options)
                ? (payload.options as unknown[]).map((o) => String(o))
                : [];
              const optionIdx = assignedOptionForFanOut.charCodeAt(0) - 'A'.charCodeAt(0);
              const optionText = optionIdx >= 0 && optionIdx < questionOptions.length
                ? questionOptions[optionIdx]
                : assignedOptionForFanOut;
              const fanOutBridge: import('./plow/browser_authority_adapter').BrowserAuthorityBridge = {
                async runQueryInUserBrowser(query) {
                  try { return await runBrowserAuthorityQueryFromMain(query); } catch { return null; }
                },
              };
              const verdictResult = await verifyAssignedOption({
                question: questionText,
                assignedOption: assignedOptionForFanOut,
                optionText,
                ollamaBaseUrl: 'http://127.0.0.1:11434',
                model: 'gemma4:12b',
                bridge: fanOutBridge,
                config: { researchArmMode: true, researchArmBrowserAuthority: true },
                onProgress: (msg) => console.log(`[relay-poll] option-fanout route=${route.id.slice(0, 8)}: ${msg}`),
              });
              const processingMs = Date.now() - startMs;
              await fetch(`${supabaseUrl}/rest/v1/relay_route_replies`, {
                method: 'POST',
                headers: { ...headers, 'Prefer': 'return=minimal' },
                body: JSON.stringify({
                  route_id: route.id,
                  peer_id: peerId,
                  answer_json: {
                    query_type: 'option_verdict',
                    option_verdict: verdictResult,
                    peer_id: peerId,
                  },
                  processing_ms: processingMs,
                }),
              });
              await fetch(`${supabaseUrl}/rest/v1/relay_routes?id=eq.${route.id}`, {
                method: 'PATCH',
                headers,
                body: JSON.stringify({ status: 'answered' }),
              });
              console.log(`[relay-poll] option-fanout answered route=${route.id.slice(0, 8)} option=${assignedOptionForFanOut} verdict=${verdictResult.verdict}`);
              continue;
            } catch (err) {
              // Non-fatal -- fall through to normal plow path for this route
              console.warn('[relay-poll] option-fanout threw (non-fatal, falling through to plow):', err);
            }
          }

          const prompt: string = (payload.prompt as string) || route.hex_frame;
          const plowMaxIter: number = typeof payload.plow_max_iterations === 'number'
            ? (payload.plow_max_iterations as number) : 0;

          // BP105 K-D6-6-15: BEDROCK MODE RESTORED — the M14 Block 2 R1 hard-reject below
          // was PERMANENTLY REMOVED. It blocked plow_max_iterations=0/absent as an error,
          // which broke the Founder-direct Truthstone doctrine (Coffee BP104 §5):
          //   Layer 1-6 = substrate BEDROCK (single-shot inference, no Plow)
          //   Layer 7   = Truthstone GATE (test if bedrock answer is correct)
          //   Layer 8+  = 12-Blade Plow, ESCALATION-ONLY for questions that failed bedrock
          // plow_max_iterations=0 (or absent) is a LEGITIMATE bedrock-mode request, not an
          // error condition — it now falls through naturally to the pre-existing baseline
          // single-shot path (`else` branch below, "Baseline path: single-shot") which
          // already implements exactly this behavior. No new code path was needed.
          // Empirical anchor: BP105 T2 batch-1 (2026-07-04) — v0.5.17+ peers were rejecting
          // every bedrock-mode relay_route with error_reason: 'plow_none_rejected'.
          // Canon: canon_no_manual_unstick_no_pluto_screwdriver_ship_the_real_fix_from_source_to_hugo_bp105

          // BP090 TRIPLE-MAMBA: allotted_timeout_ms for approaching_timeout signal emission
          const allottedTimeoutMs: number = typeof payload.allotted_timeout_ms === 'number'
            ? (payload.allotted_timeout_ms as number) : 0;
          const isStarChamber: boolean = payload.is_star_chamber === true;
          const isTiebreaker: boolean = payload.is_tiebreaker === true;
          const tiebreakerModel: string = typeof payload.tiebreaker_model === 'string'
            ? (payload.tiebreaker_model as string) : 'qwen2.5:7b';

          // BP135 Yoke #35: resolve THIS box's actual answer model instead of hardcoding
          // 'gemma4:12b' everywhere below. Priority: an explicit per-request override
          // (payload.model -- reserved for a future asker; no current caller sets it) >
          // this peer's own ASK-selector active local brain (brain_registry.ts -- confirmed
          // the SAME store ai-dispatch:query's real Ask handler reads via getActiveBrain(),
          // see that file's activeBrainLocalModel comment) > ollamaManager's auto-detected
          // best-installed-gemma fallback > the hardcoded floor for boxes with no selection
          // at all. A 32GB peer whose Ask dropdown is set to gemma2:9b must answer the mesh
          // plow with gemma2:9b, not silently run 12b, split VRAM, and time out to ABSTAIN.
          //
          // hasPersistedBrainChoice() guard: brain_registry.json's DEFAULT_ACTIVE_BRAIN_ID
          // ('gemma4-12b') is NOT hardware-aware -- it's the naive baked-in default returned
          // by getActiveBrain() before the user (or ensureFreeLocalDefaultOnFirstRun) has ever
          // actually persisted a choice. Trusting it unconditionally would silently reintroduce
          // this exact bug for any box that has never opened the Ask model picker (which, since
          // CleanShell un-routed LeanAskTab/BrainSwapSelector -- see YOKE_35 -- is now the
          // common case, not the exception). Only defer to the local brain once a real choice
          // is on disk; otherwise fall through to the hardware-aware chain below.
          const activeBrain = hasPersistedBrainChoice() ? getActiveBrain() : undefined;
          const activeBrainLocalModel = activeBrain?.kind === 'local' ? activeBrain.model_id : undefined;
          const answerModel: string =
            (typeof payload.model === 'string' ? (payload.model as string) : undefined) ||
            activeBrainLocalModel ||
            ollamaManager.getSelectedModel() ||
            'gemma4:12b';

          // BP133 Yoke #24 Task 1: single authoritative substrate toggle, responder side.
          // The asker (wan_dispatch.ts) sets payload.substrate_enabled explicitly; this is
          // the ONLY place in this function that decides whether substrate context is
          // fetched, and applySubstrateToggle makes zero eblet-store calls when it is false
          // -- see substrate_toggle.ts for the full correctness-gate rationale. The SAME
          // effectivePrompt (not the raw `prompt`) is used below in BOTH the Minor Council
          // branch and the baseline single-shot branch, so the flag is honored everywhere
          // this function calls Ollama, not just one of the two paths.
          const substrateEnabled: boolean = payload.substrate_enabled === true;
          const domainForSubstrate: string = typeof payload.domain === 'string' ? payload.domain : 'general';
          // BP135 Phase 3 (Layer B: federated substrate): when the asker has pooled topical
          // eblets from ALL live peers (see wan_dispatch.ts's queryTopicalEbletsFromPeers()),
          // they arrive here via payload.pooled_substrate_eblets and take priority over this
          // peer's own local-only substrate query -- see applySubstrateToggle()'s pooledHits
          // branch. Absent/empty falls through to the pre-existing local-only behavior.
          const pooledSubstrateEblets = Array.isArray(payload.pooled_substrate_eblets)
            ? (payload.pooled_substrate_eblets as Array<{
                question: string; answer: string; provenance: string; peerId?: string;
                // BP135 Yoke #34 (0.9.7) argument-ledger: additive, optional -- see eblet_topical
                // responder above and substrate_toggle.ts's KNOWN-WRONG formatting.
                verdict?: 'correct' | 'wrong' | 'unverified'; reasoning?: string;
              }>)
            : undefined;
          const { prompt: effectivePrompt, contextInjected, ebletCount } = await applySubstrateToggle(
            prompt, prompt, domainForSubstrate, substrateEnabled, 3, pooledSubstrateEblets,
          );

          // BP133 Yoke #24 Task 2: explicit opt-in to answer this question via the 12-Blade
          // Column Plow (plow_mc_answerer.ts) instead of single-shot or Minor Council. Default
          // is false/absent -- an old or non-plow-aware asker never silently gets plow behavior.
          // plowAndonEnabled distinguishes Condition B (single pass, no retry) from Condition C
          // (retry with widened specialists on gate failure) -- both conditions run the SAME
          // plow machinery, differing only in whether the Andon cord is allowed to fire.
          const plowEnabled: boolean = payload.plow_enabled === true;
          const plowAndonEnabled: boolean = payload.plow_andon_enabled === true;
          // BP137 Yoke v2b (Research Arm): explicit opt-in, ignored unless plowEnabled is also
          // true (see the runCanonicalPlowMcAnswer config below). Bundles Stage A.0 (relevance
          // gate upstream of the MC voters) + Stage A (answer-type classifier + compute
          // sidecar) behind one wire flag -- default is false/absent, an old or
          // research-arm-unaware asker never silently gets this behavior.
          const researchArmModeForPlow: boolean = payload.research_arm_mode === true;
          const researchQuery: string = typeof payload.question_text === 'string' ? payload.question_text : prompt;
          const choiceCountForPlow: number = typeof payload.choice_count === 'number' ? payload.choice_count : 10;
          // BP135 Yoke #34 Phase (0.9.6): opt-in reasoning-mode voter prompt, DEFAULT FALSE --
          // an asker that predates this field (or never sets it) gets byte-identical bare-letter
          // voter behavior. See plow_mc_answerer.ts's CanonicalPlowMcConfig.reasoningMode for the
          // full rationale (gemma4:12b engineering/51 empirical finding this session).
          const reasoningModeForPlow: boolean = payload.reasoning_mode === true;
          // BP135 Yoke #34 (0.9.7) argument-ledger: LOCAL, POST-HOC verdict tagging ONLY -- see
          // plow_mc_answerer.ts's CanonicalPlowMcConfig.testModeCorrectAnswerLetter doc comment.
          // Never fed into any prompt; only used after the plow's own chosenLetter is finalized,
          // to tag the eblets THIS run writes to substrate as correct/wrong/unverified.
          const testModeCorrectAnswerLetterForPlow: string | null =
            typeof payload.correct_answer_letter === 'string' ? payload.correct_answer_letter : null;
          // BP138 Yoke Phase 2: decompose-and-eliminate engine wire flag. Absent/false on every
          // pre-Phase-2 payload -- defaults to false so old askers never silently get this behavior.
          const researchArmDecomposeForPlow: boolean = payload.research_arm_decompose === true;
          // BP137 Yoke v2b Stage F3 (mesh synergy): its OWN wire flag, deliberately NOT fanned
          // in from payload.research_arm_mode the way researchArmBrowserAuthority/
          // researchArmStarChamber above are -- mesh-synergy dispatch is an ASKER-side decision
          // (does this question's live-peer count justify distributing authorities across
          // peers?) genuinely independent of whether research_arm_mode is on for the swarm
          // itself, so an asker must opt in explicitly. Absent/false on every pre-Stage-F3
          // payload (every existing wan_dispatch.ts call), matching this field's own
          // conditional-spread convention there.
          const researchArmMeshSynergyForPlow: boolean = payload.research_arm_mesh_synergy === true;
          // BP137 Yoke v2b Stage F3: which authority (if any) the asker's round-robin dispatch
          // loop assigned THIS peer for THIS question. Validated against the exact 3-value
          // vocabulary wan_dispatch.ts's assignment emits -- an unrecognized/malformed value
          // (e.g. a future asker sending something new this build doesn't understand) degrades
          // to undefined (treated identically to "no assignment", i.e. run the full plow), never
          // a crash or a guessed authority.
          const assignedAuthorityForPlow: 'user_google' | 'user_perplexity' | 'swarm' | undefined =
            payload.assigned_authority === 'user_google' || payload.assigned_authority === 'user_perplexity' || payload.assigned_authority === 'swarm'
              ? payload.assigned_authority
              : undefined;
          if (isDebugPromptLoggingEnabled()) {
            try {
              const debugDir = join(app.getPath('userData'), 'substrate');
              if (!existsSync(debugDir)) mkdirSync(debugDir, { recursive: true });
              appendFileSync(
                join(debugDir, 'debug_outbound_prompts.jsonl'),
                buildOutboundPromptLogLine({
                  ts: new Date().toISOString(),
                  source: 'wan_responder',
                  routeId: route.id,
                  sessionId: route.session_id ?? undefined,
                  mode: plowEnabled ? 'canonical_plow' : plowMaxIter > 0 ? 'minor_council' : 'single_shot',
                  // BP135 Yoke #35: log the REAL resolved model, not a hardcoded label -- a
                  // stale 'gemma4:12b' string here would misreport what actually answered.
                  model: plowEnabled ? `${answerModel}(canonical plow)` : plowMaxIter > 0 ? `${answerModel}(x3 council)` : (isTiebreaker ? tiebreakerModel : answerModel),
                  substrateEnabled,
                  contextInjected,
                  ebletCount,
                  domain: domainForSubstrate,
                  promptChars: effectivePrompt.length,
                  prompt: effectivePrompt,
                }) + '\n',
                'utf8',
              );
            } catch (e) {
              console.warn('[relay-poll] debug prompt log write failed (non-fatal):', e);
            }
          }

          let answer: string | null = null;
          let plowIterations = 0;
          let councilVariance = 0;
          let approachingTimeoutSignalSent = false;
          // BP093 Phase 3: Minor Council receipt per iteration
          const councilVotesPerIteration: Array<{ iter: number; valid: number; invalid: number; refine: number }> = [];
          // BP133 Yoke #24 Task 2: 12-Blade Column Plow trace, populated only when plowEnabled.
          // Surfaced verbatim in answer_json so the asker can persist a scored receipt (Task
          // 2.3) without needing a second round-trip to reconstruct HOW the answer was reached.
          let plowTrace: Record<string, unknown> | null = null;

          if (plowEnabled) {
            // BP133 Yoke #24 Task 2: the plow answerer reuses the SAME specialist swarm,
            // Miner/Saladin/Furnace filters, and Andon/Detective-Team widening cord as
            // canonical_pipeline.ts's free-text pipeline (see plow_mc_answerer.ts's own header
            // for why only the final arbitration stage differs). effectivePrompt is passed
            // through unchanged -- it already carries injected substrate context iff
            // substrateEnabled is true, via the SAME applySubstrateToggle call used by every
            // other branch in this function, so Condition A (plow, substrate OFF) is genuinely
            // cold and Condition B/C (plow, substrate ON) genuinely see the same context a
            // single-shot substrate-ON run would see.
            //
            // WIRE-THE-LOOP fix (single-box local plow): the config-construction +
            // result-to-plowTrace mapping that used to live inline here was extracted verbatim
            // into plow_mc_answerer.ts's callCanonicalPlowMcAnswererForMeshTest(), so this WAN
            // responder and one_click_mmlu_pro.ts's new local-mode full-plow path (runLocalMode)
            // share exactly ONE call site into runCanonicalPlowMcAnswer -- never two
            // independently-drifting copies. Every field passed below is byte-identical in
            // meaning to the pre-extraction inline call (see that function's own doc comment for
            // the full per-field rationale, condensed there to avoid duplicating documentation).
            const { callCanonicalPlowMcAnswererForMeshTest } = await import('./plow/plow_mc_answerer');
            const callResult = await callCanonicalPlowMcAnswererForMeshTest({
              effectivePrompt,
              researchQuery,
              domain: domainForSubstrate,
              ollamaBaseUrl: 'http://127.0.0.1:11434',
              model: answerModel,
              choiceCount: choiceCountForPlow,
              substrateEnabled,
              plowAndonEnabled,
              reasoningMode: reasoningModeForPlow,
              testModeCorrectAnswerLetter: testModeCorrectAnswerLetterForPlow,
              researchArmMode: researchArmModeForPlow,
              researchArmMeshSynergy: researchArmMeshSynergyForPlow,
              ...(assignedAuthorityForPlow ? { assignedAuthority: assignedAuthorityForPlow } : {}),
              researchArmDecompose: researchArmDecomposeForPlow,
              logLabel: `relay-poll route=${route.id.slice(0, 8)}`,
            });
            answer = callResult.answer; // null = genuine no-answer, handled by abstain logic below
            plowTrace = callResult.plowTrace;
          } else if (plowMaxIter > 0) {
            // BP090 Plow Loop 12 + Minor Council Star Chamber
            // Fires 3 local judges per iteration; plurality-votes for answer letter;
            // iterates until confidence >= 0.75 (variance <= 0.25) or maxIterations reached.
            // BP106 v0.8.29 (Founder-empirical 2026-07-05): single-model council.
            // The pre-v0.8.29 array included llama3.1:8b + mistral:7b which were NOT
            // installed on most of the peer fleet. Those 2 calls per iteration hit
            // 404 model-not-found and were silently excluded from letterVotes, making
            // the "3-model council" empirically a 1-model council that wasted 2/3 of
            // the network round-trips. Council diversity now comes from per-member
            // temperature spread (see memberTemperature below) — 3 samples of the
            // same model at 3 different temperatures gives real plurality-vote
            // diversity without needing 3 distinct model files.
            // BP135 Yoke #35: that one model is now answerModel (this box's real
            // ASK-selector/hardware-sized model), NOT a hardcoded 'gemma4:12b' --
            // see the answerModel derivation above for the full fallback chain.
            const COUNCIL_MODELS = [answerModel, answerModel, answerModel];
            const CONF_THRESHOLD = 0.75;
            const APPROACH_THRESHOLD = 0.80; // 80% of allotted timeout triggers signal

            for (let iter = 1; iter <= plowMaxIter; iter++) {
              plowIterations = iter;

              // BP090: approaching_timeout signal — emit once when >80% allotted time elapsed AND variance > 15%
              if (
                !approachingTimeoutSignalSent &&
                allottedTimeoutMs > 0 &&
                (Date.now() - startMs) > (allottedTimeoutMs * APPROACH_THRESHOLD) &&
                councilVariance > 0.15 &&
                answer !== null
              ) {
                approachingTimeoutSignalSent = true;
                // Build partial council votes from current best answer
                const partialVotes = [{ peer_id: peerId, answer: (() => {
                  const lm = answer?.match(/^\s*([A-J])\b/i)
                    || answer?.match(/Answer[:\s]+([A-J])\b/i)
                    || answer?.match(/\b([A-J])\s*\)/i);
                  return lm ? lm[1].toUpperCase() : null;
                })(), confidence: 1 - councilVariance }];
                // Write approaching_timeout signal to relay_route_replies (I8 MIC open-relay)
                fetch(`${supabaseUrl}/rest/v1/relay_route_replies`, {
                  method: 'POST',
                  headers: { ...headers, 'Prefer': 'return=minimal' },
                  body: JSON.stringify({
                    route_id: route.id,
                    peer_id: peerId,
                    answer_json: {
                      reply_type: 'approaching_timeout',
                      question_id: payload.question_id ?? route.id,
                      partial_council_votes: partialVotes,
                      best_guess_answer: partialVotes[0]?.answer ?? null,
                      plow_loop_iteration: iter,
                      elapsed_ms: Date.now() - startMs,
                      allotted_timeout_ms: allottedTimeoutMs,
                      council_variance: councilVariance,
                    },
                    processing_ms: Date.now() - startMs,
                  }),
                }).catch(() => { /* non-fatal — signal is best-effort */ });
                console.log(`[relay-poll] approaching_timeout signal sent: route=${route.id.slice(0, 8)} iter=${iter} variance=${councilVariance.toFixed(3)} elapsed=${Date.now()-startMs}ms`);
              }

              // BP106 v0.8.29 (Founder-empirical 2026-07-05): per-council-member temperature
              // spread. Since all 3 council members are now the same gemma4:12b (v0.8.29
              // fix above), diversity across the 3 samples comes from temperature spacing
              // per index (0.15 spacing) plus a per-iteration bump (0.04 spacing).
              //   iter=1 · [temp 0.60, 0.75, 0.90] → 3 clearly-distinct samples
              //   iter=4 · [temp 0.72, 0.87, 1.00-clamped] → hot-spread final iter
              // Empirical rationale: 3 identical gemma4:12b calls at same temp DO produce
              // slightly-different outputs (ollama re-samples each call) but spread is
              // narrow. Explicit temperature spread widens the plurality-vote signal.
              const memberResults = await Promise.allSettled(
                COUNCIL_MODELS.map(async (m, idx) => {
                  const memberTemperature = Math.min(0.6 + (iter - 1) * 0.04 + idx * 0.15, 1.0);
                  // BP135 Phase 1: `think` must be a TOP-LEVEL request field (not nested in
                  // `options`) -- mirrors canonical_pipeline.ts's callOllama() (BP134 Deep RCA).
                  // Without it, a thinking-capable model (e.g. gemma4:12b) can consume its
                  // whole generation budget on internal reasoning and return an empty response.
                  const buildMemberBody = (includeThink: boolean) => ({
                    model: m,
                    // BP133 Yoke #24 Task 1: substrate-gated prompt, not the raw payload prompt.
                    prompt: effectivePrompt,
                    stream: false,
                    keep_alive: '24h',
                    ...(includeThink ? { think: false } : {}),
                    options: { temperature: memberTemperature },
                  });
                  let r = await fetch('http://localhost:11434/api/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(buildMemberBody(true)),
                    // D6a: 8-min hard ceiling per ollama call — prevents relay-poll worker hang on frozen model
                    signal: AbortSignal.timeout(480_000),
                  });
                  if (r.status === 400) {
                    // BP083 fallback (mirrored from canonical_pipeline.ts callOllama()): this
                    // peer's Ollama version rejects the top-level `think` field outright --
                    // retry once without it rather than hard-failing this council member.
                    r = await fetch('http://localhost:11434/api/generate', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(buildMemberBody(false)),
                      signal: AbortSignal.timeout(480_000),
                    });
                  }
                  if (!r.ok) return { model: m, text: null as string | null };
                  const d = await r.json() as { response?: string };
                  return { model: m, text: d?.response ?? null };
                })
              );

              // Extract MMLU-Pro answer letter (A-J) from each member response
              const letterVotes: Array<{ letter: string; text: string }> = [];
              for (const res of memberResults) {
                if (res.status !== 'fulfilled' || !res.value?.text) continue;
                const t = res.value.text;
                // BP106 K-D6-6-16: added lax bare-A-J fallback so models that produce
                // prose without a canonical "Answer: X" prefix still contribute a vote.
                let lm = t.match(/^\s*([A-J])\s*$/i)
                  || t.match(/^\s*([A-J])\b/i)
                  || t.match(/Answer[:\s]+([A-J])\b/i)
                  || t.match(/\b([A-J])\s*\)/i)
                  || t.match(/\b([A-J])\./i)
                  || t.match(/^\s*([A-J])/im);
                if (!lm) {
                  // Last-resort: last bare A-J letter anywhere in text (often the model's final answer)
                  const allBare = t.match(/\b([A-J])\b/gi);
                  if (allBare && allBare.length > 0) {
                    const lastLetter = allBare[allBare.length - 1]!.toUpperCase();
                    lm = [lastLetter, lastLetter] as unknown as RegExpMatchArray;
                  }
                }
                if (lm) letterVotes.push({ letter: lm[1]!.toUpperCase(), text: t });
              }

              // BP106 K-D6-6-16 (Founder-empirical BP106 chunk-01 · 2026-07-05):
              // OLD behavior: `if (letterVotes.length === 0) break;` bailed the whole
              // loop at iter=1 whenever all 3 models produced prose without a letter —
              // making plow_max_iterations decorative and defaulting to ABSTAIN. NEW:
              // record a no-vote iteration receipt, keep councilVariance pinned to 1.0
              // (no convergence), and CONTINUE to the next iteration so we get another
              // shot at a valid letter under different temperature.
              if (letterVotes.length === 0) {
                councilVariance = 1.0;
                councilVotesPerIteration.push({ iter, valid: 0, invalid: COUNCIL_MODELS.length, refine: 0 });
                continue;
              }

              // Plurality vote across judges
              const counts: Record<string, number> = {};
              for (const v of letterVotes) counts[v.letter] = (counts[v.letter] ?? 0) + 1;
              const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
              const topLetter = sorted[0]![0];
              const topCount = sorted[0]![1];
              // BP106 K-D6-6-16 (Founder-empirical BP106 chunk-01 · 2026-07-05):
              // OLD: `councilVariance = 1.0 - (topCount / letterVotes.length);`
              // computed against the SUBSET that parsed, not the full council. When
              // 1-of-3 parses a letter with 2-of-3 failing: 1/1 = 1.0 → variance 0.0 →
              // FALSE convergence at iter=1 with only 33% of the council responding.
              // Correct: use full council size as denominator. 1-of-3 → variance 0.667
              // → above threshold → keep iterating. Real convergence still allowed
              // when 3-of-3 agree (variance 0.0) or 2-of-3 agree (variance 0.333).
              councilVariance = 1.0 - (topCount / COUNCIL_MODELS.length);

              // Use the full response text of a judge that voted for the plurality letter
              answer = letterVotes.find((v) => v.letter === topLetter)?.text ?? letterVotes[0]!.text;

              // BP093 Phase 3: record per-iteration Minor Council vote receipt
              // Maps letter-vote plurality to VALID/INVALID/NEEDS_REFINEMENT semantics:
              //   valid  = judges that voted for the plurality (consensus) letter
              //   refine = judges that voted for a different letter (disagreement)
              //   invalid = council models that gave no parseable letter response
              const validVotes = topCount;
              const refineVotes = letterVotes.length - topCount;
              const invalidVotes = COUNCIL_MODELS.length - letterVotes.length;
              councilVotesPerIteration.push({ iter, valid: validVotes, invalid: invalidVotes, refine: refineVotes });

              // Early stop when confidence (1 - variance) >= threshold
              // NOTE: variance now computed against full council (not the parsed subset)
              // so this only fires on genuine majority-convergence, not 1-of-3-artifact.
              if (councilVariance <= (1.0 - CONF_THRESHOLD)) break;
            }
            if (isStarChamber) {
              console.log(`[relay-poll] star-chamber-council: route=${route.id.slice(0, 8)} iter=${plowIterations}/${plowMaxIter} variance=${councilVariance.toFixed(3)}`);
            } else {
              console.log(`[relay-poll] plow-council: route=${route.id.slice(0, 8)} iter=${plowIterations}/${plowMaxIter} variance=${councilVariance.toFixed(3)}`);
            }

          } else {
            // Baseline path: single-shot (pre-BP090 behaviour); tiebreaker model override per M14 Block 3
            const model = isTiebreaker ? tiebreakerModel : answerModel;
            // BP135 Phase 1: `think` must be a TOP-LEVEL request field (not nested in
            // `options`) -- mirrors canonical_pipeline.ts's callOllama() (BP134 Deep RCA).
            const buildBaselineBody = (includeThink: boolean) => ({
              model,
              // BP133 Yoke #24 Task 1: substrate-gated prompt, not the raw payload prompt.
              prompt: effectivePrompt,
              stream: false,
              keep_alive: '24h',
              ...(includeThink ? { think: false } : {}),
            });
            let ollamaRes = await fetch('http://localhost:11434/api/generate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(buildBaselineBody(true)),
              // D6a: 8-min hard ceiling per ollama call — prevents relay-poll worker hang on frozen model
              signal: AbortSignal.timeout(480_000),
            });
            if (ollamaRes.status === 400) {
              // BP083 fallback (mirrored from canonical_pipeline.ts callOllama()): this peer's
              // Ollama version rejects the top-level `think` field outright -- retry once
              // without it rather than hard-failing the single-shot baseline answer.
              ollamaRes = await fetch('http://localhost:11434/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(buildBaselineBody(false)),
                signal: AbortSignal.timeout(480_000),
              });
            }
            const ollamaData = ollamaRes.ok ? await ollamaRes.json() as { response?: string } : null;
            answer = ollamaData?.response ?? null;
          }

          // BP094 Session 9 BLOCK D: guard against negative processingMs (clock skew / async drift)
          const rawProcessingMs = Date.now() - startMs;
          const processingMs = rawProcessingMs >= 0 ? rawProcessingMs : 0;
          if (rawProcessingMs < 0) {
            console.warn(`[WARN] negative delay corrected to 0 (raw=${rawProcessingMs}ms) in relay-poll processingMs -- clock skew detected`);
          }

          // M14 Block 2: structured ABSTAIN when answer is null
          let abstainReason: string | null = null;
          if (answer === null) {
            if (plowEnabled) {
              abstainReason = plowTrace?.error ? 'plow_error' : 'plow_discordant_no_majority';
            } else if (plowMaxIter > 0 && plowIterations >= plowMaxIter) {
              abstainReason = 'max_iterations_reached';
            } else if (plowMaxIter > 0) {
              abstainReason = 'council_did_not_converge';
            } else {
              abstainReason = 'model_empty_response';
            }
          }

          // BP133 Yoke #24 Task 2: Truth-Always requirement -- a result can never be misread
          // as answered by a different mechanism than it actually was. Surfaced in EVERY
          // answer_json (success or abstain), all three branches.
          const answeredBy: 'plow' | 'minor_council' | 'single_shot' =
            plowEnabled ? 'plow' : plowMaxIter > 0 ? 'minor_council' : 'single_shot';

          await fetch(`${supabaseUrl}/rest/v1/relay_route_replies`, {
            method: 'POST',
            headers: { ...headers, 'Prefer': 'return=minimal' },
            body: JSON.stringify({
              route_id: route.id,
              peer_id: peerId,
              answer_json: abstainReason !== null ? {
                answer: 'ABSTAIN',
                abstain_reason: abstainReason,
                correct: false,
                escalation_eligible: true,
                plow_loop_iterations: plowIterations,
                legacy_null: null,
                // BP133 Yoke #24 Task 1: Truth-Always -- a result can never be misread as
                // substrate-on/off or context-injected/not from outside this function.
                substrate_enabled: substrateEnabled,
                substrate_context_injected: contextInjected,
                answered_by: answeredBy,
                plow_trace: plowTrace,
              } : {
                answer,
                plow_loop_iterations: plowIterations,
                iterations_run: plowIterations,
                council_variance: councilVariance,
                council_votes_per_iteration: councilVotesPerIteration,
                approaching_timeout_signal_sent: approachingTimeoutSignalSent,
                is_star_chamber: isStarChamber,
                substrate_enabled: substrateEnabled,
                substrate_context_injected: contextInjected,
                answered_by: answeredBy,
                plow_trace: plowTrace,
              },
              processing_ms: processingMs,
            }),
          });

          await fetch(`${supabaseUrl}/rest/v1/relay_routes?id=eq.${route.id}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ status: 'answered' }),
          });

          console.log(`[relay-poll] answered route ${route.id.slice(0, 8)} in ${processingMs}ms`);
        } catch (err) {
          // D6a: detect AbortSignal timeout from ollama call — log + write structured error row
          const isOllamaTimeout = err instanceof Error &&
            (err.name === 'TimeoutError' || err.name === 'AbortError') &&
            (err.message?.includes('11434') || String(err).includes('11434') || true);
          if (isOllamaTimeout && err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
            console.warn(`[WORKER] ollama call aborted after 8min · marking route error · route=${route.id.slice(0, 8)}`);
            try {
              await fetch(`${supabaseUrl}/rest/v1/relay_route_replies`, {
                method: 'POST',
                headers: { ...headers, 'Prefer': 'return=minimal' },
                body: JSON.stringify({
                  route_id: route.id,
                  peer_id: peerId,
                  answer_json: { status: 'error', error_message: 'ollama_timeout_8min', error_detail: 'AbortSignal.timeout(480000) fired — ollama did not respond within 8 minutes' },
                  processing_ms: Date.now() - startMs,
                }),
              });
            } catch { /* best-effort */ }
          } else {
            console.warn(`[relay-poll] error on route ${route.id.slice(0, 8)}:`, err);
          }
          await fetch(`${supabaseUrl}/rest/v1/relay_routes?id=eq.${route.id}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ status: 'error' }),
          });
        }
      }
    } catch {
      // Silent — don't crash main process on poll error
    }
  }

  console.log(`[relay-poll] started for peer=${peerId.slice(0, 8)}`);
  const interval = setInterval(pollOnce, 5000);
  _relayPollInterval = interval;
  return interval;
}

// D6c — self-heal watchdog: monitors relay_poller_poll_count delta; respawns poll loop when frozen
function startRelayPollWatchdog(peerId: string): void {
  const { app: electronApp } = require('electron') as typeof import('electron');
  const { join: pathJoin } = require('path') as typeof import('path');
  const { mkdirSync: fsMkdirSync, appendFileSync: fsAppendFileSync } = require('fs') as typeof import('fs');

  let lastPollCount = _relayPollCount;
  const watchdogLogDir = pathJoin(electronApp.getPath('appData'), 'MnemosyneC', 'logs');
  try { fsMkdirSync(watchdogLogDir, { recursive: true }); } catch { /* ignore */ }
  const watchdogLogPath = pathJoin(watchdogLogDir, 'watchdog.log');

  function watchdogLog(msg: string): void {
    const line = `${new Date().toISOString()} [watchdog] ${msg}\n`;
    console.log(`[watchdog] ${msg}`);
    try { fsAppendFileSync(watchdogLogPath, line, 'utf8'); } catch { /* non-fatal */ }
  }

  watchdogLog(`watchdog started · peer=${peerId.slice(0, 8)} · log=${watchdogLogPath}`);

  setInterval(() => {
    const currentCount = _relayPollCount;
    const delta = currentCount - lastPollCount;
    lastPollCount = currentCount;

    watchdogLog(`poll_count_check · delta=${delta} · total=${currentCount}`);

    // If fewer than 3 polls happened in 60s (5s cadence → ~12/min expected), worker is frozen
    if (delta < 3) {
      watchdogLog(`FROZEN DETECTED: delta=${delta} < 3 · killing relay-poll interval and respawning`);
      if (_relayPollInterval) {
        clearInterval(_relayPollInterval);
        _relayPollInterval = null;
      }
      // Respawn — peer_id preserved via D3 keypair (already on disk)
      const newInterval = startRelayRoutePoll(peerId);
      _relayPollInterval = newInterval;
      watchdogLog(`respawned relay-poll · new interval registered · peer=${peerId.slice(0, 8)}`);
    }
  }, 60_000);
}

// BP086 I7c: MIC fleet broadcast listener — subscribes to fleet_broadcast Realtime channel
// Handles 6 broadcast_types; writes acks via REST. Real implementations (PATH X).

async function postAck(
  broadcastId: string,
  peerId: string,
  appVersion: string,
  ackType: string,
  resultJson: Record<string, unknown>,
): Promise<void> {
  const supabaseUrl = getSupabaseUrl();
  const supabaseKey =
    getAnonKey();
  if (!supabaseUrl || !supabaseKey) return;

  await fetch(`${supabaseUrl}/rest/v1/fleet_broadcast_ack`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Prefer': 'resolution=merge-duplicates,return=minimal',
      'on_conflict': 'broadcast_id,peer_id',
    },
    body: JSON.stringify({
      broadcast_id: broadcastId,
      peer_id: peerId,
      app_version: appVersion,
      ack_type: ackType,
      result_json: resultJson,
    }),
  }).then(async (res) => {
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.warn(`[mic-broadcast] ack POST failed HTTP ${res.status}: ${body.slice(0, 200)}`);
    }
  }).catch((e) => {
    console.warn(`[mic-broadcast] ack POST threw: ${String(e).slice(0, 200)}`);
  });
}

function startMicBroadcastListener(peerId: string, appVersion: string): void {
  const supabaseUrl = getSupabaseUrl();
  const supabaseKey =
    getAnonKey();

  if (!supabaseUrl || !supabaseKey) {
    console.warn('[mic-broadcast] SUPABASE_URL or SUPABASE_ANON_KEY not set — listener disabled');
    return;
  }

  // Use Supabase Realtime JS-compatible WebSocket polling via REST long-poll fallback.
  // We poll fleet_broadcast for active rows and dispatch on new ones not yet acked.
  // Full WebSocket Realtime would require the @supabase/supabase-js in main process;
  // for now we use a 10s poll which is reliable across all network conditions.

  const processedIds = new Set<string>();

  async function dispatchBroadcast(payload: {
    id: string;
    broadcast_type: string;
    payload_json: Record<string, unknown>;
    target_version: string | null;
    target_tier: string;
    target_peer_ids: string[] | null;
  }): Promise<void> {
    const broadcastId = payload.id;

    // Skip if this peer is not targeted
    if (
      payload.target_peer_ids &&
      payload.target_peer_ids.length > 0 &&
      !payload.target_peer_ids.includes(peerId)
    ) return;

    console.log(`[mic-broadcast] dispatching type=${payload.broadcast_type} id=${broadcastId.slice(0, 8)}`);

    switch (payload.broadcast_type) {
      case 'noop_test': {
        await postAck(broadcastId, peerId, appVersion, 'completed', {
          ok: true,
          message: 'noop received',
          peer_id: peerId,
          app_version: appVersion,
          platform: process.platform,
        });
        console.log(`[mic-broadcast] noop_test acked`);
        break;
      }

      case 'health_snapshot': {
        try {
          const psRes = await fetch('http://localhost:11434/api/ps', {
            signal: AbortSignal.timeout(5000),
          });
          const psData = psRes.ok ? await psRes.json() : null;
          const loadedModels: Array<{ name: string; size_vram: number; expires_at: string }> =
            psData?.models ?? [];

          const tagsRes = await fetch('http://localhost:11434/api/tags', {
            signal: AbortSignal.timeout(5000),
          });
          const tagsData = tagsRes.ok ? await tagsRes.json() : null;
          const availableModels: string[] = (tagsData?.models ?? []).map(
            (m: { name: string }) => m.name,
          );

          await postAck(broadcastId, peerId, appVersion, 'completed', {
            app_version: appVersion,
            peer_id: peerId,
            platform: process.platform,
            ollama_reachable: psRes.ok,
            loaded_models: loadedModels.map(m => ({
              name: m.name,
              size_vram_mb: Math.round((m.size_vram ?? 0) / 1024 / 1024),
              expires_at: m.expires_at,
            })),
            available_models: availableModels,
          });
        } catch (err) {
          await postAck(broadcastId, peerId, appVersion, 'error', {
            error: String(err),
            ollama_reachable: false,
          });
        }
        break;
      }

      case 'fleet_warmup': {
        const warmModel =
          (payload.payload_json?.model as string) || 'gemma4:12b';
        const warmupPrompt =
          (payload.payload_json?.prompt as string) ||
          'Answer with only the letter A. What is 1+1? A) 2 B) 3\nAnswer:';

        await postAck(broadcastId, peerId, appVersion, 'processing', {
          model: warmModel,
          status: 'warming',
        });

        const warmStart = Date.now();
        try {
          const res = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: warmModel,
              prompt: warmupPrompt,
              stream: false,
              keep_alive: '24h',
            }),
            signal: AbortSignal.timeout(120000),
          });
          const warmMs = Date.now() - warmStart;
          const data = res.ok ? await res.json() : null;

          await postAck(broadcastId, peerId, appVersion, 'completed', {
            model: warmModel,
            status: 'hot',
            load_latency_ms: warmMs,
            keep_alive: '24h',
            test_answer: (data?.response as string)?.trim()?.slice(0, 5) ?? null,
          });
          console.log(`[mic-broadcast] warmed ${warmModel} in ${warmMs}ms`);
        } catch (err) {
          await postAck(broadcastId, peerId, appVersion, 'error', {
            model: warmModel,
            error: String(err),
          });
        }
        break;
      }

      case 'config_set': {
        const key = payload.payload_json?.key as string;
        const value = payload.payload_json?.value as string;

        if (key === 'ollama.model_pull' && value) {
          await postAck(broadcastId, peerId, appVersion, 'processing', {
            model: value,
            status: 'pulling',
          });

          const pullStart = Date.now();
          try {
            const { execFile } = await import('child_process');
            const { promisify } = await import('util');
            const execFileAsync = promisify(execFile);

            await execFileAsync('ollama', ['pull', value], { timeout: 1800000 });
            const pullMs = Date.now() - pullStart;

            await postAck(broadcastId, peerId, appVersion, 'completed', {
              model: value,
              status: 'ready',
              pull_ms: pullMs,
              pull_seconds: Math.round(pullMs / 1000),
            });
            console.log(`[mic-broadcast] pulled ${value} in ${Math.round(pullMs / 1000)}s`);
            // BP092 I12 — Stamp-Certify hook: config_set model pull (fire-and-forget)
            void Promise.all([
              import('./ip_ledger/stamp_certify'),
              import('./ip_ledger/ring_bearer_keygen'),
            ]).then(([{ stampCertify }, { getRingBearerIdentity }]) => {
              const identity = getRingBearerIdentity();
              return stampCertify({
                contribution_type: 'config_set_model_pull',
                payload: JSON.stringify({ event: 'config_set_model_pull', model_id: value, peer_id: identity.peer_id, timestamp: Date.now() }),
              });
            }).catch((e: Error) => console.error('[ip_ledger hook] config_set_model_pull:', e));
          } catch (err) {
            await postAck(broadcastId, peerId, appVersion, 'error', {
              model: value,
              error: String(err),
            });
          }
        } else {
          await postAck(broadcastId, peerId, appVersion, 'completed', {
            key,
            value,
            applied: true,
          });
        }
        break;
      }

      case 'auto_update': {
        const version = payload.payload_json?.version as string || payload.target_version;
        const restartMode = (payload.payload_json?.restart_mode as string) || 'prompt';
        console.log(`[mic-broadcast] auto_update broadcast received: v${version} restart_mode=${restartMode}`);
        await postAck(broadcastId, peerId, appVersion, 'received', {
          target_version: version,
          restart_mode: restartMode,
          message: 'auto_update received — triggering autoUpdater.checkForUpdates()',
        });
        // Trigger the electron autoUpdater to check for the new version
        try {
          const { autoUpdater } = await import('electron-updater');
          autoUpdater.checkForUpdates().catch(e =>
            console.warn('[mic-broadcast] autoUpdater.checkForUpdates error:', e),
          );
        } catch (e) {
          console.warn('[mic-broadcast] autoUpdater import error:', e);
        }
        break;
      }

      case 'benchmark_run': {
        const benchmarkId = payload.payload_json?.benchmark_id as string;
        const coordinationToken = payload.payload_json?.coordination_token as string;
        console.log(`[mic-broadcast] benchmark_run dispatch received: benchmark_id=${benchmarkId}`);
        await postAck(broadcastId, peerId, appVersion, 'received', {
          benchmark_id: benchmarkId,
          coordination_token: coordinationToken,
          message: 'benchmark_run received — participation via wan-relay-route',
        });
        break;
      }

      default:
        console.warn(`[mic-broadcast] unknown broadcast_type: ${payload.broadcast_type}`);
        break;
    }
  }

  async function pollBroadcasts(): Promise<void> {
    try {
      // BP087 I10: 600s lookback = 2× default TTL (was 60s — missed broadcasts issued before relaunch)
      const since = new Date(Date.now() - 600000).toISOString();
      const url =
        `${supabaseUrl}/rest/v1/fleet_broadcast` +
        `?status=eq.active&created_at=gte.${encodeURIComponent(since)}` +
        `&select=id,broadcast_type,payload_json,target_version,target_tier,target_peer_ids`;

      const res = await fetch(url, {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
        });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        console.warn(`[mic-broadcast] poll HTTP ${res.status}: ${body.slice(0, 200)}`);
        return;
      }

      const broadcasts: Array<{
        id: string;
        broadcast_type: string;
        payload_json: Record<string, unknown>;
        target_version: string | null;
        target_tier: string;
        target_peer_ids: string[] | null;
      }> = await res.json();

      for (const bc of broadcasts) {
        if (processedIds.has(bc.id)) continue;
        processedIds.add(bc.id);
        dispatchBroadcast(bc).catch(e =>
          console.warn(`[mic-broadcast] dispatch error for ${bc.id.slice(0, 8)}:`, e),
        );
      }

      // Trim processedIds set to prevent unbounded growth
      if (processedIds.size > 500) {
        const arr = Array.from(processedIds);
        arr.slice(0, 250).forEach(id => processedIds.delete(id));
      }
    } catch (e) {
      console.warn(`[mic-broadcast] poll failed: ${String(e).slice(0, 200)}`);
    }
  }

  setInterval(pollBroadcasts, 10000);
  // Poll immediately on startup to catch any recent broadcasts
  setTimeout(pollBroadcasts, 2000);

  console.log(`[mic-broadcast] listener started peer=${peerId.slice(0, 8)} version=${appVersion}`);
}

function setupMeshResultsWatcher(): void {
  const bishopDropDir = join(__dirname, '..', '..', 'BISHOP_DROPZONE', '00_FOUNDER_REVIEW');
  const localResultsDir = join(homedir(), '.mnemosynec', 'test-data', 'mmlu-pro', 'results');

  // Check-and-emit helper; also looks for a companion SVG.
  function checkAndEmit(dir: string, prefix: string, suffix: string): void {
    const filePath = findMatchingFile(dir, prefix, suffix);
    if (!filePath || !existsSync(filePath)) return;

    const metrics = parseMeshResultsFile(filePath);
    if (!metrics) return;

    const svgMatch = findMatchingFile(dir, 'MESH_TEST_BIG_NUMBERS_', '.svg');
    if (svgMatch) metrics.svgPath = svgMatch;

    emitMeshComplete(metrics);
  }

  function checkAndEmitShard(dir: string): void {
    const filePath = join(dir, 'shard_M1_results.json');
    if (!existsSync(filePath)) return;

    const metrics = parseMeshResultsFile(filePath);
    if (!metrics) return;

    emitMeshComplete(metrics);
  }

  // Startup scan -- fire immediately if files already present.
  checkAndEmit(bishopDropDir, 'MESH_TEST_RESULTS_v0135_', '.json');
  checkAndEmitShard(localResultsDir);

  // Watch BISHOP_DROPZONE dir for new results files (fs.watch; chokidar would be more robust).
  if (existsSync(bishopDropDir)) {
    try {
      fsWatch(bishopDropDir, { persistent: false }, (_eventType, filename) => {
        if (!filename) return;
        if (filename.startsWith('MESH_TEST_RESULTS_v0135_') && filename.endsWith('.json')) {
          checkAndEmit(bishopDropDir, 'MESH_TEST_RESULTS_v0135_', '.json');
        }
      });
    } catch (e) {
      console.warn('[mesh-watcher] Could not watch', bishopDropDir, e);
    }
  }

  // Watch local results dir for shard_M1_results.json.
  if (existsSync(localResultsDir)) {
    try {
      fsWatch(localResultsDir, { persistent: false }, (_eventType, filename) => {
        if (filename === 'shard_M1_results.json') {
          checkAndEmitShard(localResultsDir);
        }
      });
    } catch (e) {
      console.warn('[mesh-watcher] Could not watch', localResultsDir, e);
    }
  }
}

// --- App Lifecycle ------------------------------------------------------------

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.whenReady().then(async () => {
  // BP094 v0.8.0 - DevTools enablement + verbose logging for beta build
  process.env.ELECTRON_ENABLE_LOGGING = '1';
  if (!process.env.NODE_ENV) process.env.NODE_ENV = 'development';

  // BP038 Frame-boilerplate ? pre-bind port guard (singleton reuse pattern).
  // If another AMPLIFY is already on API_PORT, exit cleanly instead of EADDRINUSE crash.
  const probe = await probeSubstrateApiPort(API_PORT);
  if (probe.occupied) {
    if (probe.holder === 'another_amplify') {
      console.warn(`[LB Frame] another AMPLIFY is already running on :${API_PORT} ? this duplicate instance will exit cleanly (singleton reuse). Close the existing instance first if you intended to restart.`);
    } else {
      console.error(`[LB Frame] :${API_PORT} is held by an unknown service. AMPLIFY cannot bind. Free the port or set SUBSTRATE_API_PORT to an alternate.`);
    }
    app.quit();
    return;
  }

  // SEG-V0148-P1-RENAME-USERDATA: migrate amplify-computer → mnemosynec on first launch after rename
  migrateUserDataIfNeeded();

  // v0.4.1 BP083: Catacomb migration check (Preserved-Forever 1-year pheromone-fade)
  runCatacombMigrationCheck().catch((err) =>
    console.error('[Main] CatacombMigrationCheck error (non-fatal):', err),
  );

  // BP083 SEG-1/2/4: ensure 6-folder substrate scaffold + MEMORY.md + TestData seeds
  try {
    const mnemoBaseDir = ensureMnemosyneCFolders();
    generateMemoryMd(mnemoBaseDir, app.getVersion());
    populateTestDataSeeds(mnemoBaseDir);
    console.log(`[BP083] MnemosyneC substrate scaffold ready at ${mnemoBaseDir}`);
  } catch (err) {
    console.error('[BP083] Scaffold failed (non-fatal):', err);
  }

  // SEG-1 v0.3.7: pre-seed substrate with Starter Chocolate Pack (idempotent)
  installStarterChocolate((msg) => console.log(msg)).then(({ installed, skipped, error }) => {
    if (error) {
      console.warn('[StarterChocolate] Non-fatal install error:', error);
    } else if (!skipped) {
      console.log(`[StarterChocolate] First-launch seeding complete: ${installed} eblets written`);
    }
  }).catch((e) => console.warn('[StarterChocolate] Unexpected error (non-fatal):', e));

  // A-2 BP081 v0.1.59.1: Startup eblet store integrity check (non-fatal)
  try {
    const { runStartupIntegrityCheck } = await import('./mnem_eblet_store');
    await runStartupIntegrityCheck();
  } catch (e) {
    console.error('[Startup] Eblet integrity check failed (non-fatal):', e);
  }

  // BP132 Yoke #21 E10: warm the eblet + canonical index on boot (fire-and-forget,
  // non-blocking) instead of only ever lazily rebuilding on the first Ask. See
  // mnem_eblet_store.ts warmEbletIndex() for the full rationale.
  import('./mnem_eblet_store')
    .then(({ warmEbletIndex }) => warmEbletIndex())
    .catch((e) => console.error('[Startup] Eblet index warm-up failed (non-fatal):', e));

  // Initialize substrate API server (Phase 3: full implementation)
  substrateServer = new SubstrateAPIServer();
  await substrateServer.start();

  // SEG-V0148-P0-GLANCE: wire mesh progress update to tray tooltip refresh
  substrateServer.setMeshProgressUpdateHook(() => updateTrayTooltip());

  // Initialize federation client (uses the substrate index from the API server)
  federationClient = new FederationClient(substrateServer.getIndex());
  substrateServer.setFederationClient(federationClient);
  await federationClient.start();

  // Initialize Ollama manager singleton (SEG-1 v0.1.55)
  // SEG-V0147-FIX-1 / SEG-V0148-P2: wire IPC heartbeat callback BEFORE init() so renderer
  // never goes silent >3s, and so _capturedOllamaBranch is updated for the diagnostic log.
  ollamaManager.setStatusUpdateCallback((update) => {
    _capturedOllamaBranch = update.branch;
    BrowserWindow.getAllWindows().forEach((w) => {
      if (!w.isDestroyed()) w.webContents.send('ollama-status-update', update);
    });
  });
  await ollamaManager.init();

  // SEG-V0148-P2: capture resolved path + branch after init() completes
  _capturedOllamaPath = ollamaManager.getResolvedBinaryPath();
  _capturedOllamaBranch = ollamaManager.getResolvedBranch();

  // BP138 Yoke 0.9.13 F4 item 4: nomic-embed-text self-heal check. Deliberately NOT awaited --
  // ensureEmbeddingModel() is internally fire-and-forget (fires its own background pull when
  // needed and returns immediately), so this line never adds boot latency, let alone hangs it.
  ollamaManager.ensureEmbeddingModel();

  // SEG-V0148-P0-SKU-MODEL: promote to full-tier model if sku_tier.json says 'full'
  {
    const skuPromo = await ollamaManager.resolveActiveModel();
    _capturedActiveModel = skuPromo.activeModel;
    _capturedTargetModel = skuPromo.targetModel;
    if (skuPromo.mismatch) {
      console.warn(
        `[SKU] Full tier active but targetModel=${skuPromo.targetModel} not in ollama list — ` +
        `mesh test results will NOT be comparable to published benchmarks.`,
      );
    }
  }

  // M18b: Resolve effective model (honors right-size.json override) once at startup
  {
    const { resolveEffectiveModel, setCachedEffectiveModel } = await import('./hardware/ram_detector');
    try {
      const effectiveResult = await resolveEffectiveModel();
      setCachedEffectiveModel(effectiveResult);
      if (effectiveResult.overrideActive) {
        console.log(`[M18b] Override active: ${effectiveResult.model} (auto was ${effectiveResult.autoDetectedModel})`);
      }
      if (effectiveResult.warning) {
        console.warn(`[M18b] ${effectiveResult.warning}`);
      }
    } catch (e) {
      console.error('[M18b] resolveEffectiveModel failed (non-fatal):', e);
    }
  }

  // SAGA 4 ? In Conjunction Agent Panel: load persisted keys + plugins at startup
  loadPersistedApiKeys();
  ensurePluginDir();
  const { errors: pluginErrors } = loadPlugins();
  if (pluginErrors.length > 0) {
    console.warn('[SAGA4 plugins] Load errors:', pluginErrors);
  }
  watchPluginDir((_updatedAgents) => {
    // Notify conjunction window when plugins change (future: push IPC event)
    console.log('[SAGA4 plugins] Plugin roster updated');
  });

  // Initialize auto-updater
  autoUpdater = new AutoUpdateManager();
  autoUpdater.init();
  // KniPr026: reflect update state in tray tooltip (available / downloading / ready)
  autoUpdater.onStateChanged((state) => updateTrayTooltip(state.status));

  // M21: Automatic update scheduler startup (Block 2, 4, 6)
  migrateAutoInstallConfig();
  checkAndTriggerPendingInstall().catch((e) =>
    console.error('[auto-update] checkAndTriggerPendingInstall error:', e),
  );
  if (getAutoUpdateConfig().autoUpdates) {
    startAutoUpdateLoop();
  }

  // MV-CN: Peer discovery + WAN relay (SAGA 3 BP045 W1)
  // BP104 D3: load Ed25519 keypair-derived peer_id before mesh init
  await initializeLocalPeerKeypair();
  const peerId = getStablePeerId();
  peerDiscovery = new PeerDiscovery(peerId);
  relayClient = new RelayClient(peerId, peerDiscovery);
  peerDiscovery.startLAN().catch((e) => console.warn('[PeerDiscovery] LAN start error:', e));
  relayClient.start();

  // MESH-6: Wire relay inbound hook for sid_fetch_*, pointer_advance
  relayClient.setInboundHook(_handleInboundMeshMsg);

  // BP087 MAMBA-Row3: wire relay emit hook for substrace_wake_complete outbound
  setRelayEmitHook((msg, toPeerId) => {
    relayClient?.sendToPeer(toPeerId, msg as import('../shared/federation-protocol').FedMsg);
  });

  // BP072: Initialize Paired-Frame Mutual-Aid layer
  pairedFrameManager = new PairedFrameManager(peerId, peerDiscovery, relayClient);
  pairedFrameManager.start();
  // Wire TCP inbound hook so pair_*/assist_* messages arriving on port 11481 are handled
  federationClient?.setInboundHook((msg) => pairedFrameManager?.handleInbound(msg as FedMsg));
  // Log assist-mode state changes
  pairedFrameManager.on('assist-mode-entered', (partnerId) => {
    console.log(`[BP072] ASSIST_MODE ENTERED for partner=${partnerId} ? healthy frame now serving`);
    _broadcastMeshStateChanged();
  });
  pairedFrameManager.on('assist-mode-exited', (partnerId) => {
    console.log(`[BP072] ASSIST_MODE EXITED ? partner=${partnerId ?? 'none'} back online`);
    _broadcastMeshStateChanged();
  });

  // MESH-6: Wire pointer-advance hook from caithedral tools IPC
  setMeshPointerAdvanceHook(_emitPointerAdvanceToPeers);

  // BP067 Correction 2: Wire folder?DAG bridge mesh hook
  setDagBridgeMeshHook(_emitPointerAdvanceToPeers);

  // MESH-6 Option-B: Wire HTTP /dag/emit endpoint to the same pointer_advance broadcast
  setDagEmitMeshHook(_emitPointerAdvanceToPeers);

  // SEG-WAN-2: Wire WAN soccerball hook + status emitter
  setWanSoccerballHook(createWanSoccerballResolver(async (_peerId: string) => {
    // TODO: wire to wan-lookup-by-email when session has LB auth
    return null;
  }));
  setWanStatusEmitter((status: string) => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('wan-status-update', { status, ts: new Date().toISOString() });
      }
    }
  });

  // MESH-6 Option-B: Wire HTTP /dag/fetch_from_peer to _fetchSidViaTCP
  setFetchSidFromPeerHook(async (address, port, dag_id) => {
    const peer = {
      peerId: 'http-test-peer',
      displayName: 'HTTP test peer',
      address,
      port,
      transport: 'lan' as const,
      phase: 'identified' as const,
      lastSeen: new Date().toISOString(),
    };
    const reqMsg: FedMsg = {
      type: 'sid_fetch_request',
      peerId: getStablePeerId(),
      payload: { dag_id, requester_peer_id: getStablePeerId() } satisfies SidFetchRequestPayload,
      ts: new Date().toISOString(),
    };
    return _fetchSidViaTCP(peer, dag_id, reqMsg);
  });

  // MESH-6: Inject mDNS peer source into FederationClient
  federationClient?.setPeerDiscoverySource(() =>
    (peerDiscovery?.getAllPeers() ?? [])
      .filter((p) => p.transport === 'lan')
      .map((p) => ({ address: p.address, port: p.port })),
  );

  const firstRun = isFirstRun();
  if (firstRun) {
    lanHandshakeEligible = true;
    setTimeout(() => { lanHandshakeEligible = false; }, 90_000);
    setupLanHandshakeDiscovery();
  }

  // Initialize auth manager (Phase 7)
  authManager = new AuthManager();
  authManager.init();
  authManager.onStateChanged((state) => {
    substrateServer?.setDegradedMode(state.degraded);
    if (state.degraded && substrateServer?.getEffectiveMode() === 'ai_burst') {
      setMode('fallback');
    }
  });

  // ?6 BP041 ? Hide Electron menu bar by default (non-technical member protection).
  // Ctrl+Shift+D toggles developer menu on/off at runtime.
  Menu.setApplicationMenu(null);

  // SAGA-? v0.1.10 ? SubstratedFolderWatcher? singleton (must be after app.ready for getPath)
  folderWatcher = new SubstratedFolderWatcher();

  // Create tray only ? overlay is opt-in (tray ? Show Overlay, or Burst Mode).
  // SAGA-1 BP055: Dashboard is the default boot surface; overlay never auto-creates.
  createTray();
  registerIPCHandlers();

  // KN-BP142-5: start the Liana Cycle Engine's idle-check scheduler and register its own
  // liana-cycle:* IPC handlers. Off by default (kill switch, see liana_cycle_scheduler.ts's own
  // readLianaCycleEnabledFromSettings) -- this call only starts the (cheap, no-op-until-enabled)
  // poll loop, it does not itself run a turn.
  initLianaCycleScheduler();

  // KN-BP144-10 T1-T4: start the Grand Central board watcher and register its own board-*
  // IPC handlers. Same convention as initLianaCycleScheduler() immediately above -- this call
  // only starts the (cheap) recompute poll loop; it touches no answering/plow code at all.
  initBoardWatcher();

  // BP137 0.9.12 Stage F1 build item 1: warm the persistent nexus-authority session at app
  // lifetime start, NOT tied to any tab's open/close lifecycle. ensureNexusAuthoritySession()
  // is its own flag gate -- when researchArmMode + researchArmBrowserAuthority aren't both on
  // (the default), this is a single cheap file-read that returns null; no BrowserWindow, no
  // `persist:nexus-authority` session partition, and no other new side effect occurs. See
  // nexus_authority_persistent_session.ts's header for the full flag-mirror mechanism.
  ensureNexusAuthoritySession();

  // --- APPEND ZONE: INIT-CALL -- new init()-style registration calls go below this line, per KN-BP145-E
  // One no-arg init() call per new registration module (same pattern as initBoardWatcher()
  // above). Never insert a new call between the init() calls above; always append here instead.
  // (currently empty -- the next new registration init() call lands here)
  initOpenAiCompatServer(); // KN-BP145-M3: THE NEXUS, local OpenAI-compat substrate-injecting server, 127.0.0.1 only

  // D-BP151-042/BISHOP/seg-battery-dispatch-endpoint -- Founder BP151: "Battery Dispatch is local
  // plugins, so build the endpoint." Off by default (isBatteryDispatchPluginEndpointEnabled()
  // reads BATTERY_DISPATCH_ENDPOINT=1); when off this is a single no-op function call that opens
  // no socket. See battery_dispatch_plugin_endpoint.ts's own header for the full verb set, auth,
  // and session-isolation mechanism.
  initBatteryDispatchPluginEndpoint();

  // KN-BP147-M2: THE RESIDENT CONSUMER, OD-04, THE RED QUEEN. Reads the persisted WATCH-armed
  // switch (resident/resident_settings.ts, app.getPath('userData')) FIRST -- if the user has
  // not elected persistence, this call only logs its own dormancy and starts no interval.
  // When armed, starts the free, read-only yoke poll loop (BLOCKED/RETURNS/HEARTBEAT under
  // HARDWIRE\LEDGER) that survives this session's death because it runs in this process, not
  // in any IDE. No ACT-class capability is reachable from this call -- see resident/autopilot_grant.ts.
  startResidentWatcher();

  // KN-BP147-M2 (D-BP147-005): THE CRYSTAL, WIRED. Probe-load the Crystal store once here so a
  // load failure is discovered and logged at boot, not silently deferred to the first renderer
  // call. getCrystalStore() (defined just above registerIPCHandlers()) is the single FAIL-OPEN
  // loader shared with the crystal:* IPC handlers registered in registerIPCHandlers()'s own
  // IPC-HANDLER append zone -- see that function's header for the full contract. This call
  // cannot throw and never blocks app startup either way.
  getCrystalStore();
  // --- END APPEND ZONE: INIT-CALL -----------------------------------------

  // SAGA 10 BP045 W1 ? Register mnemosyne:// + mnemo:// deep-link protocols (BP065)
  registerDeepLinkProtocol(
    () => dashboardWindow ?? hearthConjunctionWindow ?? overlayWindow ?? null,
    (payload: DeepLinkPayload) => {
      if (payload.type === 'accept-invite') {
        console.log('[deep-link] accept-invite received for slug:', payload.slug, 'token prefix:', payload.token.slice(0, 12));
        // SEG-V0153A: open dashboard (default boot surface) and route to Accept tab
        openDashboard({ focus: true });
        const wins = [dashboardWindow, hearthConjunctionWindow, overlayWindow];
        for (const win of wins) {
          if (win && !win.isDestroyed()) {
            win.webContents.send('federation:deep-link-accept', {
              slug: payload.slug,
              token: payload.token,
            });
          }
        }
      } else if (payload.type === 'focus-tab') {
        // BP067 Phase 3B ? mnemo://focus/<tab_id> ? navigate to tab
        console.log('[deep-link] focus-tab received:', payload.tabId);
        openDashboard({ focus: true });
        const win = dashboardWindow;
        if (win && !win.isDestroyed()) {
          win.webContents.send('navigate:focus-tab', { tabId: payload.tabId });
        }
      } else if (payload.type === 'lb-auth-callback') {
        // BP065 Part A ? Complete the LB Account magic-link auth flow
        console.log('[deep-link] lb-auth-callback received');
        void (async () => {
          const result = await completeLBAuth(
            payload.access_token,
            payload.refresh_token,
            payload.email,
          );
          // Broadcast auth-complete to all windows so LBAccountTab updates
          const wins = [dashboardWindow, hearthConjunctionWindow, overlayWindow];
          for (const win of wins) {
            if (win && !win.isDestroyed() && result.ok && result.session) {
              win.webContents.send('lb:auth-complete', {
                user_id: result.session.user_id,
                email: result.session.email,
                peer_id: result.session.peer_id,
                crewman_number: result.session.crewman_number,
              });
            }
          }
        })();
      } else if (payload.type === 'membership-activated') {
        // BP085 — mnemosynec://membership-active?member_id=...&token=...
        // NEVER log token value (BP085 BLOOD)
        console.log('[deep-link] membership-activated received for member_id:', payload.memberId);
        void (async () => {
          await handleMembershipReturn(payload.memberId, payload.token);
        })();
      }
    },
  );
  // Handle cold-start deep-link (Windows: URL passed via argv)
  handleStartupDeepLink(process.argv, () => hearthConjunctionWindow ?? overlayWindow ?? null);

  // SAGA-1 BP055: Dashboard is now the default boot surface on every launch.
  // Overlay only appears via tray right-click ? Show Overlay / Burst Mode (opt-in).
  // MNEMOSYNE_NO_AUTO_OPEN=1 skips auto-open (CI / headless environments).
  if (process.env.MNEMOSYNE_NO_AUTO_OPEN !== '1') {
    openDashboard({ focus: true });
    // BP067: first_run.flag is set only after launch-walk completes (mark-bp067-first-run-complete IPC).
  }

  // BP092 I12 — Start IP Ledger Mesh Diff Loop (battery-aware · LAN-as-WAN · 15min)
  // Close keeps mesh alive; loop stops only on Quit (canon_close_keeps_mesh_alive).
  import('./ip_ledger/mesh_diff_loop').then(({ startMeshDiffLoop }) => {
    startMeshDiffLoop();
  }).catch((e: Error) => console.error('[mesh_diff_loop] start failed:', e));

  const okQuit = globalShortcut.register('CommandOrControl+Shift+Alt+Q', () => {
    app.quit();
  });
  const okHide = globalShortcut.register('CommandOrControl+Shift+Alt+H', () => {
    overlayWindow?.hide();
    dashboardWindow?.hide();
  });

  // BP041 SAGA 3 + SEG-5 v0.1.59: Ctrl+Shift+M.
  // When dashboard is open: trigger clipboard Q+A capture (SEG-5).
  // Otherwise: toggle HearthConjunctionWindow between Watch View and Configure View (BP041).
  const okWatchToggle = globalShortcut.register('CommandOrControl+Shift+M', () => {
    // SEG-5 v0.1.59: clipboard capture → dashboard (highest priority when dashboard is open)
    if (dashboardWindow && !dashboardWindow.isDestroyed()) {
      dashboardWindow.webContents.send('clipboard:capture-qa');
      return;
    }
    // BP041 SAGA 3 fallback: HearthConjunctionWindow toggle when dashboard is not open
    if (!hearthConjunctionWindow || hearthConjunctionWindow.isDestroyed()) {
      openHearthConjunctionWindow();
      return;
    }
    if (hearthConjunctionWindow.isVisible()) {
      hearthConjunctionWindow.hide();  // ? Watch View
    } else {
      hearthConjunctionWindow.show();  // ? Configure View
      hearthConjunctionWindow.focus();
    }
  });
  if (!okWatchToggle) {
    console.warn('[index] Ctrl+Shift+M shortcut registration failed (already registered by another app)');
  }

  // ?6 ? Dev menu toggle: Ctrl+Shift+D shows/hides the Electron application menu
  let devMenuVisible = false;
  const okDevMenu = globalShortcut.register('CommandOrControl+Shift+D', () => {
    devMenuVisible = !devMenuVisible;
    if (devMenuVisible) {
      const devMenu = Menu.buildFromTemplate([
        { label: 'Developer', submenu: [
          { label: 'Reload', role: 'reload' },
          { label: 'Force Reload', role: 'forceReload' },
          { label: 'Toggle DevTools', role: 'toggleDevTools' },
          { type: 'separator' },
          { label: 'Quit MnemosyneC', click: () => app.quit() },
        ]},
      ]);
      Menu.setApplicationMenu(devMenu);
    } else {
      Menu.setApplicationMenu(null);
    }
    if (IS_DEV) {
      console.log(`[Frame] Dev menu ${devMenuVisible ? 'shown' : 'hidden'} via Ctrl+Shift+D`);
    }
  });

  if (!okQuit || !okHide) {
    console.warn(
      `[Frame] Global escape shortcuts unavailable (quitRegistered=${okQuit} hideRegistered=${okHide}); another app may own the accelerator`,
    );
  }
  if (!okDevMenu) {
    console.warn('[Frame] Ctrl+Shift+D dev-menu toggle unavailable ? another app may own the accelerator');
  }

  // BP094 -- F12 as DevTools toggle alias (Founder-direct, pairs with Ctrl+Shift+D)
  const okF12 = globalShortcut.register('F12', () => {
    const focused = BrowserWindow.getFocusedWindow();
    if (focused) {
      if (focused.webContents.isDevToolsOpened()) {
        focused.webContents.closeDevTools();
      } else {
        focused.webContents.openDevTools({ mode: 'detach' });
      }
    }
  });
  if (!okF12) console.warn('[Frame] F12 dev-tools toggle unavailable - another app may own the accelerator');

  // Register auth IPC handlers (after windows are created)
  authManager.registerIPCHandlers();

  // Initial mode detection
  const aiAvailable = await ollamaManager.isReachable();
  const fedStatus = federationClient.getStatus();
  const forcedMode = substrateServer.getForcedMode();
  const mode = detectMode({
    aiAvailable,
    substrateIndexAvailable: true,
    peerNodesAvailable: fedStatus.peerCount,
    forcedMode,
  });
  setMode(mode, false);

  // Start periodic connectivity polling ? auto mode transitions
  connectivityTimer = setInterval(runConnectivityPoll, CONNECTIVITY_POLL_MS);

  // SEG-Q-4 BP078: auto-prepare FULL upgrade on launch (if enabled)
  runAutoPrepareIfNeeded();
  scheduleAutoPrepareIdle();

  // BP081 K-2 — start local MCP substrate bridge server (failure is non-fatal)
  try {
    await startMcpServer();
  } catch (e) {
    console.error('[Frame] MCP server failed to start (non-fatal):', e);
  }

  // SEG-U-7 BP078: mesh-test-complete file watcher
  // Watches two locations for mesh results JSON; sends IPC to renderer on detection.
  // Uses fs.watch (chokidar would be more robust but is not in this project's dependencies).
  setupMeshResultsWatcher();

  // BP086 I3a: Wire presence config so publishPresence() passes its null-guard
  // BP104 D5: wan_soccerball_id derived from Ed25519 publicKeyHex (D3 keypair)
  // BP132 Yoke #21 A2: MOVED to run BEFORE startPeerServer() (was after). startPeerServer()'s
  // .listen() callback fires publishPresence() immediately on the 'listening' event, and that
  // first call was silently no-op'ing because _peerId/_supabaseUrl (module-local state in
  // peer_server.ts, set only by registerPresenceConfig) were still unset at that point.
  {
    const { randomUUID, createHash } = require('crypto') as typeof import('crypto');
    const _presencePeerId = getStablePeerId();
    const _presenceSupabaseUrl = getSupabaseUrl();
    let _wanSoccerballId: string;
    try {
      const { ensureLocalPeerKeypair } = require('./identity/localPeerKeypair') as typeof import('./identity/localPeerKeypair');
      const kp = ensureLocalPeerKeypair();
      _wanSoccerballId = createHash('sha256').update(kp.publicKeyHex).digest('hex').slice(0, 32);
    } catch {
      _wanSoccerballId = (_presencePeerId + _presencePeerId).slice(0, 32);
    }
    const { getLBSession } = require('./lb_auth') as typeof import('./lb_auth');
    const _session = getLBSession();
    const _emailHash = _session?.email
      ? createHash('sha256').update(_session.email.trim().toLowerCase()).digest('hex').slice(0, 32)
      : null;
    registerPresenceConfig({
      peerId: _presencePeerId,
      emailHash: _emailHash ?? null,
      wanSoccerballId: _wanSoccerballId,
      relaySessionId: randomUUID().replace(/-/g, ''),
      supabaseUrl: _presenceSupabaseUrl,
    });
    console.log('[presence] registered tier=base default, peer=' + _presencePeerId.slice(0, 8));
  }

  // v0.4.0 BP083 SEG-1: Start peer HTTP server on port 7474 (SCAFFOLD transport)
  try {
    await startPeerServer();
    console.log('[BP083] Peer server started on port 7474 (SCAFFOLD v0.4.0)');
  } catch (e) {
    console.warn('[BP083] Peer server start failed (non-fatal):', e);
  }

  // BP134 Yoke #29 Part 2: Start peer artifact server on port 47213 -- serves this node's
  // cached installer bytes + hash to peers so mesh update propagation has a source. Plain
  // HTTP, no auth (matches the existing SCAFFOLD trust model of startPeerServer() above);
  // a peer's self-reported hash from this server is never trusted for install decisions --
  // see mesh_update_propagation.ts's pullAndVerifyFromPeers().
  try {
    startPeerArtifactServer();
  } catch (e) {
    console.warn('[BP134 Yoke #29] Peer artifact server start failed (non-fatal):', e);
  }

  // BP086 I5c: start relay poll (answers cross-WAN questions from orchestrator)
  {
    const _relayPeerId = getStablePeerId();
    const _supabaseUrl = getSupabaseUrl();
    const _anonKey =
      getAnonKey();
    if (_supabaseUrl && _anonKey) {
      _bootZombieCount = await bootZombieFlush(_relayPeerId, _supabaseUrl, _anonKey);
      scheduleZombieFlush(_relayPeerId);
    }
    startRelayRoutePoll(_relayPeerId);
    // D6c — self-heal watchdog starts 60s after poll loop; monitors poll_count delta
    startRelayPollWatchdog(_relayPeerId);

    // BP132 Yoke #21 A1: startRelayAnswerPoller() was fully built (PID-lock singleton,
    // exponential backoff, crash-loop guard, liveness watchdog) but never called anywhere
    // in src/ — confirmed by repo-wide search. This is the WAN answer-side of the mesh:
    // without it, this peer never answers cross-WAN questions routed to it via Supabase.
    if (_supabaseUrl && _anonKey) {
      startRelayAnswerPoller({
        peerId: _relayPeerId,
        supabaseUrl: _supabaseUrl,
        anonKey: _anonKey,
      });
      console.log('[BP132 A1] relay-answer poller start requested peer=' + _relayPeerId.slice(0, 8));
    } else {
      console.error('[BP132 A1] relay-answer poller NOT started — Supabase URL/anon key unresolved');
    }

    // BP132 Yoke #21 A1: submitStartupDiagnostic() writes the peer_startup_state row
    // (relay_answer_poller_started, beacons_lit state, ollama reachability, etc.) but was
    // also never called anywhere in src/ — confirmed by repo-wide search. Delay 15s so the
    // relay-answer worker has time to fork + send its 'started' IPC message first, so the
    // very first row already reflects relay_answer_poller_started=true instead of a false
    // reported at t=0. Re-submitted every 10 min so Bishop's DB view stays current, not
    // just a single boot-time snapshot (Truth-Always: state must not go stale silently).
    setTimeout(() => {
      submitStartupDiagnostic().catch((e) => console.error('[BP132 A1] startup diagnostic submit failed:', e));
    }, 15_000);
    setInterval(() => {
      submitStartupDiagnostic().catch((e) => console.error('[BP132 A1] startup diagnostic resubmit failed:', e));
    }, 10 * 60_000);
  }

  // BP086 I7c: MIC broadcast listener (auto_update / config_set / fleet_warmup /
  // health_snapshot / benchmark_run / noop_test)
  {
    startMicBroadcastListener(getStablePeerId(), app.getVersion());
  }

  // BP132 Yoke #22 (Help tab Diagnostic Mode UI) — startDiagnosticPoller() (BP099-K16,
  // the 6-command READ_ONLY remote-hand allowlist) was fully built but never called
  // anywhere in src/, confirmed by repo-wide search (same pattern as Yoke #21 A1's
  // startRelayAnswerPoller gap). Safe to always start: the poller itself is a no-op
  // 60s Supabase check-in until a local user explicitly grants a TTL'd permission
  // window via the new diagnostic-mode:activate-permission IPC below — it does not
  // execute anything on its own.
  {
    import('./diagnostic_mode').then(({ startDiagnosticPoller }) => {
      startDiagnosticPoller();
      console.log('[BP132 Yoke22] diagnostic mode poller started (idle until local permission granted)');
    }).catch((e) => console.error('[BP132 Yoke22] diagnostic poller start failed (non-fatal):', e));
  }

  // v0.4.0 BP083 SEG-5 (carried forward v0.4.2): Post-install restart prompt (version-bump detection)
  {
    const lastVersionPath = join(app.getPath('appData'), 'MnemosyneC', '.last_version');
    const currentVersion = app.getVersion();
    const lastVersion = existsSync(lastVersionPath) ? readFileSync(lastVersionPath, 'utf8').trim() : null;
    if (lastVersion && lastVersion !== currentVersion) {
      writeFileSync(lastVersionPath, currentVersion, 'utf8');
      // Send once window finishes loading
      const sendRestartPrompt = () => {
        for (const win of BrowserWindow.getAllWindows()) {
          if (!win.isDestroyed()) {
            win.webContents.send('show-restart-prompt', {
              version: currentVersion,
              message: `MnemosyneC v${currentVersion} installed. Please close and reopen once for full UI initialization. Federation features require a clean renderer state.`,
            });
          }
        }
      };
      // Defer to ensure windows are ready
      setTimeout(sendRestartPrompt, 3000);
    } else if (!lastVersion) {
      writeFileSync(lastVersionPath, currentVersion, 'utf8');
    }
  }

  // v0.4.2 BP083 SEG-5: Surface Plow Resume modal if an interrupted checkpoint exists
  {
    setTimeout(async () => {
      try {
        const { readCheckpoint } = await import('./plow/plow_checkpoint');
        const cp = readCheckpoint();
        if (cp && cp.status === 'interrupted') {
          const completedPct = cp.totalQuestionsTarget > 0
            ? Math.round((cp.totalQuestionsCompleted / cp.totalQuestionsTarget) * 100)
            : 0;
          const lastUpdated = new Date(cp.lastUpdatedAt).toLocaleString();
          for (const win of BrowserWindow.getAllWindows()) {
            if (!win.isDestroyed()) {
              win.webContents.send('plow:resume-prompt', {
                sessionId: cp.sessionId,
                startedAt: cp.startedAt,
                lastUpdatedAt: cp.lastUpdatedAt,
                totalQuestionsCompleted: cp.totalQuestionsCompleted,
                totalQuestionsTarget: cp.totalQuestionsTarget,
                completedPct,
                lastUpdated,
                config: cp.config,
                completedQuestions: cp.completedQuestions,
              });
            }
          }
          console.log(`[Main] Plow resume prompt sent: ${cp.totalQuestionsCompleted}/${cp.totalQuestionsTarget} Q completed (${completedPct}%) last=${lastUpdated}`);
        }
      } catch (err) {
        console.warn('[Main] Plow resume check error (non-fatal):', err);
      }
    }, 4000);
  }

  app.on('activate', () => {
    // SAGA-1 BP055: macOS dock click ? open Dashboard (not overlay).
    openDashboard({ focus: true });
  });
});

app.on('window-all-closed', () => {
  // Keep running in tray on all platforms for AMPLIFY
});

app.on('before-quit', async () => {
  // BP134 Yoke #32 Phase G — "improves-over-time": fold this session's live plow writes
  // back into the deduped, versioned Chocolate Pack packages before exit. Time-boxed and
  // best-effort (consolidateChocolatePackagesOnQuit never throws) so a slow/failed refresh
  // can never delay or block shutdown.
  try {
    const { consolidateChocolatePackagesOnQuit } = await import('./plow/chocolate_consolidator');
    await consolidateChocolatePackagesOnQuit();
  } catch { /* non-fatal -- consolidateChocolatePackagesOnQuit already swallows internally */ }
  // v0.4.2: Mark running Plow as interrupted before exit so Resume is offered next launch
  try {
    const { onAppQuit } = await import('./plow/plow_worker_service');
    onAppQuit();
  } catch { /* non-fatal */ }
  // BP092 I12 — Stop IP Ledger Mesh Diff Loop on Quit (not on Close per close-keeps-alive canon)
  try {
    const { stopMeshDiffLoop } = await import('./ip_ledger/mesh_diff_loop');
    stopMeshDiffLoop();
  } catch { /* non-fatal */ }
  // BP140-K3 — Stop Homework idle-time background loop on Quit (same close-keeps-alive /
  // quit-exits semantic as the mesh diff loop above — clears its setInterval cleanly).
  try {
    const { stopHomeworkLoop } = await import('./homework/homework_runner');
    stopHomeworkLoop();
  } catch { /* non-fatal */ }
  stopOverlayWatchdog();
  if (connectivityTimer) clearInterval(connectivityTimer);
  pairedFrameManager?.stop();
  folderWatcher?.stopAll();
  autoUpdater?.destroy();
  await ollamaManager.shutdown();
  await federationClient?.stop();
  await substrateServer?.stop();
  await stopMcpServer();
  await stopPeerServer();
});
