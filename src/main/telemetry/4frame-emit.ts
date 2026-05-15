// Mnemosyne — 4-Frame Helena Telemetry Emitter
// SAGA 13 BP045 W1 — opt-in only · cooperative-class peer-class member-class trust class
//
// Posts PeerPhase updates to relay.mnemosynec.ai/4frame during the Helena LIVE test.
// Opt-in flag: process.env.FOUR_FRAME_SESSION_ID must be set (non-empty) for any
// emission to occur. Default: silent no-op (cooperative sovereignty right preserved).

import {
  RELAY_HTTP_URL,
  FOUR_FRAME_COLLECTOR_PATH,
  FourFrameEvent,
  PeerPhase,
  FrameIndex,
} from '../../shared/federation-protocol';

const COLLECTOR_URL = `${RELAY_HTTP_URL}${FOUR_FRAME_COLLECTOR_PATH}`;

// Set by Founder/operator before the 4-Frame LIVE test:
//   FOUR_FRAME_SESSION_ID=helena-2026-05-15  (any stable string)
//   FOUR_FRAME_INDEX=1|2|3|4                 (which family member this instance is)
const SESSION_ID = process.env.FOUR_FRAME_SESSION_ID ?? '';
const FRAME_INDEX = (parseInt(process.env.FOUR_FRAME_INDEX ?? '0', 10) as FrameIndex) || null;

/**
 * Emit a 4-Frame phase event.
 * Silent no-op if FOUR_FRAME_SESSION_ID is not configured.
 */
export async function emitFourFrameEvent(
  peerId: string,
  status: PeerPhase,
  opts: { networkType?: 'lan' | 'wan'; deviceHint?: string } = {},
): Promise<void> {
  if (!SESSION_ID || !FRAME_INDEX) return;

  const event: FourFrameEvent = {
    sessionId: SESSION_ID,
    frame: FRAME_INDEX,
    peerId,
    status,
    timestamp: new Date().toISOString(),
    networkType: opts.networkType,
    deviceHint: opts.deviceHint,
  };

  try {
    const resp = await fetch(COLLECTOR_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) {
      console.warn('[4Frame] Collector returned', resp.status);
    }
  } catch (err) {
    console.warn('[4Frame] Emit failed (non-fatal):', err);
  }
}

/**
 * Check current 4-Frame session status from the collector.
 */
export async function fetchFourFrameStatus(sessionId: string): Promise<{
  framesJoined: number;
  framesSynced: number;
  allSynced: boolean;
  events: FourFrameEvent[];
} | null> {
  try {
    const resp = await fetch(`${COLLECTOR_URL}/${sessionId}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) return null;
    return await resp.json() as {
      framesJoined: number;
      framesSynced: number;
      allSynced: boolean;
      events: FourFrameEvent[];
    };
  } catch {
    return null;
  }
}

export function isFourFrameSessionActive(): boolean {
  return !!SESSION_ID && !!FRAME_INDEX;
}
