// autopilot_grant.ts -- KN-BP147-M2: the Autopilot Grant, implemented, not assumed.
//
// Source of the eight parameters (verbatim naming, do not invent a different taxonomy --
// ticket line 76): BISHOP_DROPZONE/PROV_24_HARVEST_AUTOPILOT_AND_RED_CARPET_BP146.md lines
// 25-38, "THE PARAMETER SET." Scope, Act class, Cost ceiling, Supervisor presence, Expiry,
// Escalation channel, Liveness obligation, Refusal duties.
//
// Two act classes only (ticket lines 88-91, PROV_24 table): WATCH (free, read-only yoke
// polling, persists across sessions once the user elects it -- see resident_settings.ts) and
// ACT (metered, spawns/dispatches, OFF until explicitly scoped, halts-and-asks at any cost
// ceiling).
//
// REFUSAL DUTIES ARE PART OF THE GRANT, NOT A COMMENT ABOUT IT (ticket line 80, PROV_24 lines
// 40-48). This module enforces them mechanically:
//   1. Never fabricate a precondition to pass a gate.
//   2. Never widen a gate on its own authority.
//   3. Never take an irreversible or outward-facing action while no supervisor is
//      present/awake.
// When supervisor presence is unknown, default to the narrowest envelope: WATCH-only, no ACT
// (ticket line 78, PROV_24 line 78-ish "default to the narrowest envelope when presence is
// unknown").

import { getSupervisorPresence, type SupervisorPresence } from './resident_settings';

export type ActClass = 'WATCH' | 'ACT';

/** The eight-parameter grant, named exactly as PROV_24 names them. */
export interface AutopilotGrant {
  /** Exact paths/targets the actor may touch under this grant. */
  scope: string[];
  /** read / write / deploy / irreversible / outward-facing -- collapsed here to the two
   *  act classes this ticket actually builds (WATCH, ACT), per the ticket's own split. */
  actClass: ActClass;
  /** Token or currency budget that HALTS and asks. null means "no ceiling was ever supplied,"
   *  which requestAct() below treats as UNKNOWN COST -- and unknown cost is metered cost
   *  (ticket line 97), never free cost. */
  costCeilingUsd: number | null;
  /** awake / walking_alongside / asleep / unknown, as an input, not a boolean. */
  supervisorPresence: SupervisorPresence;
  /** Wall-clock ISO 8601 deadline, or a dispatch id string this grant is scoped to. null means
   *  "no expiry was ever supplied" -- treated as ALREADY EXPIRED for ACT (fail closed), and as
   *  "no expiry" for WATCH (fail open -- a watcher with no expiry keeps running, which is the
   *  entire point of "persist across sessions"). */
  expiry: string | null;
  /** Where the actor writes when it hits the boundary. Fixed to the real yoke path for this
   *  estate; not user-configurable, because a configurable escalation channel is itself an
   *  escalation-channel-widening act. */
  escalationChannel: string;
  /** Proof-of-life cadence description. For WATCH this is "one status-file write per poll
   *  interval"; ACT has none yet because ACT cannot run at all until KN-BP147-M2's own spawn
   *  phase (sequenced second, ticket line 102) lands. */
  livenessObligation: string;
  /** Acts this grant's holder must refuse even if instructed. Never empty. */
  refusalDuties: string[];
}

export const YOKE_ESCALATION_CHANNEL =
  'C:\\Users\\Administrator\\Documents\\LianaBanyanPlatform\\HARDWIRE\\LEDGER\\YOKE\\BLOCKED\\';

const STANDARD_REFUSAL_DUTIES: string[] = [
  'never fabricate a precondition to make a gate pass',
  'never widen a gate to force a pass',
  'never take an irreversible or outward-facing act under a sleeping or unknown-presence supervisor',
];

/** The grant that WATCH actually runs under. Cost is real-zero (file stats on local disk),
 *  so no ceiling is meaningful -- costCeilingUsd is 0, not null, because WATCH's cost IS known
 *  and IS zero (this is the one case where "no ceiling supplied" would be dishonest; the
 *  ceiling was supplied, and it is 0). Supervisor presence does not gate WATCH at all -- it is
 *  read-only monitoring, per the ticket's own table row. Expiry is null (no expiry while
 *  armed) because persistence across sessions is the entire point of the WATCH class. */
export function buildWatchGrant(scope: string[]): AutopilotGrant {
  return {
    scope,
    actClass: 'WATCH',
    costCeilingUsd: 0,
    supervisorPresence: getSupervisorPresence(),
    expiry: null,
    escalationChannel: YOKE_ESCALATION_CHANNEL,
    livenessObligation: 'writes resident_watch_status.json to userData on every poll tick',
    refusalDuties: [...STANDARD_REFUSAL_DUTIES],
  };
}

export interface ActRequest {
  /** What the ACT would do, for the refusal message and the escalation file if one is written. */
  description: string;
  scope: string[];
  costCeilingUsd: number | null;
  expiry: string | null;
}

export type ActDecision =
  | { granted: true; grant: AutopilotGrant }
  | { granted: false; reason: string; refusalDuty: string };

/**
 * requestAct -- the ONLY entry point through which an ACT-class act may be attempted.
 *
 * SEQUENCED SECOND, PER THE TICKET (line 102): "Do not build spawn-on-demand until the
 * watcher is exercised." No ACT grant exists yet anywhere in this codebase -- there is no
 * caller that has ever constructed one, no settings flag that turns ACT on, and no UI that
 * could scope one. That is not a bug in this function; it is this ticket's own sequencing,
 * honestly enforced in code rather than merely stated in a comment. Every call to this
 * function -- today, in this landing -- is REFUSED, and the refusal explains exactly why,
 * naming the specific missing precondition rather than a vague "not allowed."
 *
 * FAIL CLOSED ON THE ACT TIER (ticket line 98): "An actor that cannot confirm its ceiling
 * does not spend." This function never fabricates a grant to let a caller proceed -- that
 * would itself violate refusal duty #1 (never fabricate a precondition to pass a gate).
 */
export function requestAct(request: ActRequest): ActDecision {
  // Refusal duty #3 first: presence is the hard gate for anything outward-facing/irreversible,
  // and ACT is defined as exactly that class (spawn an actor, dispatch a SEG, call a metered
  // model). Unknown or asleep presence narrows the envelope to WATCH-only, no exception.
  const presence = getSupervisorPresence();
  if (presence === 'unknown' || presence === 'asleep') {
    return {
      granted: false,
      reason: `ACT refused: supervisor presence is '${presence}'. Refusal duty: never take an irreversible or outward-facing act under a sleeping or unknown-presence supervisor. Default envelope when presence is unknown is WATCH-only. Requested act: "${request.description}".`,
      refusalDuty: STANDARD_REFUSAL_DUTIES[2],
    };
  }

  // Unknown cost is metered cost, never free cost (ticket line 97). This function has no
  // mechanism today to confirm a real ceiling against a real spend counter -- that mechanism
  // is the spawn-on-demand capability this ticket explicitly sequences AFTER the watcher is
  // proven (line 102), and it does not exist yet. Widening this check to "just let it through"
  // would be refusal duty #2 violated: widening a gate on the actor's own authority.
  if (request.costCeilingUsd === null || request.costCeilingUsd <= 0) {
    return {
      granted: false,
      reason: `ACT refused: no confirmed, positive cost ceiling was supplied ("${request.costCeilingUsd}"). Unknown cost is treated as metered cost, never free cost. An actor that cannot confirm its ceiling does not spend. Requested act: "${request.description}".`,
      refusalDuty: 'if cost cannot be determined for an act, treat it as metered',
    };
  }

  // Even with presence and a ceiling supplied, there is still no spawn/dispatch mechanism
  // wired to actually perform an ACT -- KN-BP147-M2 builds WATCH first and sequences ACT
  // second, and the ticket is explicit that spawn-on-demand has not been exercised yet in
  // this landing. Refusing here rather than fabricating a "granted: true" with nothing behind
  // it is the same refusal duty (#1) applied to the mechanism itself, not just its inputs.
  return {
    granted: false,
    reason: `ACT refused: no ACT-class execution mechanism exists in this landing. KN-BP147-M2 sequences ACT strictly after WATCH is exercised and proven (ticket line 102: "Detection first, proven. Do not build spawn-on-demand until the watcher is exercised."). This refusal is structural, not a missing permission -- there is nothing yet for a grant to authorize. Requested act: "${request.description}".`,
    refusalDuty: 'never fabricate a precondition to make a gate pass (a grant with no mechanism behind it is exactly such a fabrication)',
  };
}
