// resident/index.ts -- KN-BP147-M2: THE RESIDENT CONSUMER. OD-04. THE RED QUEEN.
//
// Barrel for the resident module. index.ts (the app's registration surface) imports exactly
// one name from here for its INIT-CALL APPEND ZONE: startResidentWatcher. Everything else is
// exported for tests, probes, and a future control-surface (settings UI / IPC) to build on
// without widening this ticket's footprint on index.ts itself.
//
// SEQUENCING, PER THE TICKET: WATCH is built and proven here. ACT's only landed surface is
// requestAct(), which is REFUSED unconditionally in this build (see autopilot_grant.ts) --
// there is no spawn-on-demand mechanism in this module. That capability is explicitly
// sequenced after WATCH is exercised (ticket line 102) and is not built in this landing.

export {
  startResidentWatcher,
  armResidentWatch,
  disarmResidentWatch,
  pollOnce,
  scanYoke,
  getResidentStatus,
  readPersistedResidentStatus,
  _resetResidentWatcherForTests,
  _paths,
  type DispatchState,
  type DispatchStatus,
  type ResidentStatusSnapshot,
} from './yoke_watcher';

export {
  getResidentWatchSettings,
  setWatchArmed,
  isWatchArmed,
  setSupervisorPresence,
  getSupervisorPresence,
  _resetResidentWatchSettingsCacheForTests,
  type ResidentWatchSettings,
  type SupervisorPresence,
} from './resident_settings';

export {
  requestAct,
  buildWatchGrant,
  YOKE_ESCALATION_CHANNEL,
  type AutopilotGrant,
  type ActClass,
  type ActRequest,
  type ActDecision,
} from './autopilot_grant';
