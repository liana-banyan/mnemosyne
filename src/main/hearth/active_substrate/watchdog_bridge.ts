// B83d — Watchdog Bridge (main-process)
// Polls 9-subject health daemon status via substrate API
// R-MECHANISM-VERIFY: Watchdog Knight LANDED BP034 — verify tool names before G11
// Expected: mcp__watchdog__status, mcp__watchdog__history
// HTTP fallback: http://127.0.0.1:11480/watchdog/status

const SUBSTRATE_API = 'http://127.0.0.1:11480';

export type SubjectStatus = 'green' | 'yellow' | 'red' | 'gray';

export interface SubjectHealth {
  name: string;
  short_name: string;
  status: SubjectStatus;
  last_heartbeat: string | null;
  last_error: string | null;
  stack_ref: string;
  description: string;
}

export interface WatchdogStatus {
  subjects: SubjectHealth[];
  watchdog_status: SubjectStatus; // the 10th — meta
  polled_at: string;
}

// The 9 canonical substrate-discipline subjects (Coffee §9 "9 of 9 operational")
const SUBJECT_DEFINITIONS: Array<Omit<SubjectHealth, 'status' | 'last_heartbeat' | 'last_error'>> = [
  { name: 'Coroner Scribe', short_name: 'coroner', stack_ref: 'LB-STACK-0171', description: 'Reactive event logging — records substrate events post-occurrence' },
  { name: 'A+F Ledger', short_name: 'af_ledger', stack_ref: 'LB-STACK-0177', description: 'Reflective ledger — tracks attribution and forfeiture events' },
  { name: 'Stitchpunks', short_name: 'stitchpunks', stack_ref: 'LB-STACK-0178', description: 'Proactive cathedral substrate — scribes for persistent AI memory' },
  { name: 'Reminder Scribe', short_name: 'reminder', stack_ref: 'BP017', description: 'Pre-authoring discipline — catches rule violations at response-draft tier' },
  { name: 'Toolsmith', short_name: 'toolsmith', stack_ref: 'BP028', description: 'Tool-discipline scribe — validates tool usage patterns' },
  { name: 'Forager Scribe', short_name: 'forager', stack_ref: 'LB-STACK-0197', description: 'Aspirational-inventory scribe — discovers novel context' },
  { name: 'Advisor Scribe Quartet', short_name: 'advisor', stack_ref: 'LB-STACK-0202', description: 'Deliberative-advisory — 4-voice advisory assembly' },
  { name: 'Sweat Scribe', short_name: 'sweat', stack_ref: 'LB-STACK-0215', description: 'Effort-class discipline — tracks work effort per session (B80)' },
  { name: 'Tears Scribe', short_name: 'tears', stack_ref: 'LB-STACK-0216', description: 'Loss-after-effort discipline — tracks abandonment and errors (B81)' },
];

// Last known status cache (initialized to gray = not registered / unknown)
let cachedStatus: WatchdogStatus = {
  subjects: SUBJECT_DEFINITIONS.map((s) => ({
    ...s,
    status: 'gray',
    last_heartbeat: null,
    last_error: null,
  })),
  watchdog_status: 'gray',
  polled_at: new Date(0).toISOString(),
};

export async function pollWatchdogStatus(): Promise<WatchdogStatus> {
  // Try Watchdog-specific endpoint
  try {
    const res = await fetch(`${SUBSTRATE_API}/watchdog/status`, {
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const data = await res.json() as {
        subjects?: Array<{
          name: string;
          status: SubjectStatus;
          last_heartbeat?: string;
          last_error?: string;
        }>;
      };

      if (data.subjects && Array.isArray(data.subjects)) {
        cachedStatus = {
          subjects: SUBJECT_DEFINITIONS.map((def) => {
            const live = data.subjects!.find((s) =>
              s.name.toLowerCase().includes(def.short_name) ||
              def.name.toLowerCase().includes(s.name.toLowerCase()),
            );
            return {
              ...def,
              status: live?.status ?? 'gray',
              last_heartbeat: live?.last_heartbeat ?? null,
              last_error: live?.last_error ?? null,
            };
          }),
          watchdog_status: 'green',
          polled_at: new Date().toISOString(),
        };
        return { ...cachedStatus };
      }
    }
  } catch {
    /* Watchdog endpoint not exposed — fall back to substrate health check */
  }

  // Fallback: infer health from substrate API liveness
  try {
    const res = await fetch(`${SUBSTRATE_API}/health`, {
      signal: AbortSignal.timeout(2000),
    });
    const substrateLive = res.ok;

    cachedStatus = {
      subjects: cachedStatus.subjects.map((s) => ({
        ...s,
        // Sweat and Tears can be verified via pending files; others remain gray
        status: s.short_name === 'sweat' || s.short_name === 'tears'
          ? (substrateLive ? 'green' : 'red')
          : s.status === 'gray' ? 'gray' : s.status,
        last_heartbeat: substrateLive ? new Date().toISOString() : s.last_heartbeat,
      })),
      watchdog_status: substrateLive ? 'yellow' : 'red', // yellow = degraded (no Watchdog server)
      polled_at: new Date().toISOString(),
    };
  } catch {
    cachedStatus = {
      ...cachedStatus,
      watchdog_status: 'red',
      polled_at: new Date().toISOString(),
    };
  }

  return { ...cachedStatus };
}

export async function getSubjectHistory(
  short_name: string,
  window_hours = 1,
): Promise<Array<{ ts: string; level: string; message: string }>> {
  try {
    const res = await fetch(
      `${SUBSTRATE_API}/watchdog/history?subject=${encodeURIComponent(short_name)}&window_hours=${window_hours}`,
      { signal: AbortSignal.timeout(3000) },
    );
    if (res.ok) {
      const data = await res.json() as { events?: Array<{ ts: string; level: string; message: string }> };
      return data.events ?? [];
    }
  } catch {
    /* not available */
  }
  return [];
}

export function getCachedWatchdogStatus(): WatchdogStatus {
  return { ...cachedStatus };
}

// Update a subject heartbeat (called when scribe signals are received)
export function recordSubjectHeartbeat(short_name: string, error?: string): void {
  cachedStatus = {
    ...cachedStatus,
    subjects: cachedStatus.subjects.map((s) =>
      s.short_name === short_name
        ? {
            ...s,
            status: error ? 'red' : 'green',
            last_heartbeat: new Date().toISOString(),
            last_error: error ?? null,
          }
        : s,
    ),
    polled_at: new Date().toISOString(),
  };
}
