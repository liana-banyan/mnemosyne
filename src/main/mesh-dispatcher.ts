// mesh-dispatcher.ts
// BP091 ┬╖ M22 ┬╖ v0.6.0
// Cooperative mesh task dispatcher ΓÇö routes tasks to eligible peers based on RAM tier,
// modality, urgency, and staleness. Implements MIC role rotation and FireGuard heartbeat.

// ΓöÇΓöÇΓöÇ Types ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

export type TaskDifficulty = 'HARD' | 'MEDIUM' | 'SHORT';
export type TaskModality   = 'REASONING' | 'VERIFICATION' | 'VOTING';
export type TaskUrgency    = 'REALTIME' | 'BATCH';
export type RamTier        = 'ULTRA' | 'FULL' | 'CORE' | 'LITE' | 'NANO';
export type WorkloadClass  = 'HEAVY-REASONING' | 'MIXED' | 'LIGHT' | 'VOTING-CONSENSUS' | 'ALL-STALE-EMERGENCY';
export type MICRole        = 'PRIMARY' | 'SHADOW' | 'WORKER';

export interface CooperativeTask {
  task_id:    string;           // uuid
  difficulty: TaskDifficulty;
  modality:   TaskModality;
  urgency:    TaskUrgency;
  payload:    string;           // question text / prompt
  timeout_ms?: number;          // optional override
  source:     string;           // 'plow_loop' | 'member_query' | 'thunderclap' | 'heartbeat_maintenance'
  domain_difficulty_hint?: 'math' | 'physics' | null;  // ┬ºB.3 ULTRA-direct routing hint
}

export interface PeerAssignment {
  peer_id:      string;         // Soccerball L1 full
  ramTier:      RamTier;
  ollamaModel:  string;
  timeout_ms:   number;
  rationale:    string;         // logged ΓÇö explains why this peer was chosen
}

export interface DispatchResult {
  task_id:    string;
  peer_id:    string;
  answer:     string;
  correct:    boolean | null;   // null when ground truth not available at dispatch time
  latency_ms: number;
  marks_earned: number;
}

export interface MICAssignment {
  primary_peer_id: string;
  shadow_peer_ids: string[];
  workload_class: WorkloadClass;
  wave_id: string;
}

export interface FireGuardState {
  primary_peer_id: string | null;
  shadow_peer_ids: string[];
  last_blip_at: number;          // Date.now() of last pheromone blip from PRIMARY
  wave_id: string | null;
}

// ΓöÇΓöÇΓöÇ Supabase client factory ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

function getSupabaseClient() {
  const { createClient } = require('@supabase/supabase-js') as typeof import('@supabase/supabase-js');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ws = require('ws') as typeof import('ws');
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!url || !key) throw new Error('[mesh-dispatcher] Supabase env vars not set');
  return createClient(url, key, {
    auth: { persistSession: false },
    realtime: { transport: ws as unknown as typeof WebSocket },
  });
}

// ΓöÇΓöÇΓöÇ Routing constants (canon_right_sized_cooperative_assignments ┬º3.2) ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

const STALE_THRESHOLD_MS = 60_000;

const ROUTING_TABLE: Record<string, RamTier[]> = {
  'HARD+REASONING+REALTIME':       ['ULTRA', 'FULL'],
  'HARD+REASONING+BATCH':          ['ULTRA', 'FULL', 'CORE'],
  'MEDIUM+REASONING+REALTIME':     ['ULTRA', 'FULL', 'CORE'],
  'MEDIUM+REASONING+BATCH':        ['ULTRA', 'FULL', 'CORE'],
  'SHORT+VERIFICATION+REALTIME':   ['ULTRA', 'FULL', 'CORE', 'LITE'],
  'SHORT+VERIFICATION+BATCH':      ['ULTRA', 'FULL', 'CORE', 'LITE', 'NANO'],
  'VOTING+CONSENSUS+REALTIME':     ['ULTRA', 'FULL', 'CORE', 'LITE', 'NANO'],
  'VOTING+CONSENSUS+BATCH':        ['ULTRA', 'FULL', 'CORE', 'LITE', 'NANO'],
};

const TIER_TIMEOUT_REALTIME: Record<RamTier, number> = {
  ULTRA: 30_000, FULL: 45_000, CORE: 60_000, LITE: 90_000, NANO: 0,
};
const TIER_TIMEOUT_BATCH: Record<RamTier, number> = {
  ULTRA: 120_000, FULL: 180_000, CORE: 240_000, LITE: 360_000, NANO: 0,
};

const WORKLOAD_MIC_ELIGIBLE: Record<WorkloadClass, RamTier[]> = {
  'HEAVY-REASONING':      ['FULL', 'CORE', 'LITE', 'NANO'],  // NOT ULTRA
  'MIXED':                ['FULL', 'CORE', 'LITE', 'NANO'],
  'LIGHT':                ['CORE', 'LITE', 'NANO'],
  'VOTING-CONSENSUS':     ['FULL', 'CORE', 'LITE', 'NANO'],
  'ALL-STALE-EMERGENCY':  ['ULTRA'],                          // emergency only
};

const TIER_RANK: Record<RamTier, number> = {
  NANO: 0, LITE: 1, CORE: 2, FULL: 3, ULTRA: 4,
};

// ΓöÇΓöÇΓöÇ Peer row shape from peer_presence ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

interface PeerRow {
  peer_id: string;
  wan_soccerball_id: string | null;
  lan_addresses: string[] | null;
  relay_session_id: string | null;
  capabilities: {
    ramTier?: RamTier;
    ollamaModel?: string;
    mic_load_hours?: number;
  } | null;
  last_seen_at: string | null;
  machine_label: string | null;
  status: string | null;
  role?: string | null;
  wave_id?: string | null;
}

// ΓöÇΓöÇΓöÇ routeTask ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

export async function routeTask(task: CooperativeTask): Promise<PeerAssignment[]> {
  // R1 HARD-REJECT: empty payload
  if (!task.payload || task.payload.trim() === '') {
    throw new Error(`[mesh-dispatcher] R1 HARD-REJECT: task ${task.task_id} has empty payload`);
  }
  if (task.modality === 'VERIFICATION' && !task.payload) {
    throw new Error(`[mesh-dispatcher] R1 HARD-REJECT: VERIFICATION task ${task.task_id} requires non-empty payload`);
  }

  // plow=none guard
  if (task.source === 'plow_loop' && !task.payload) {
    console.warn('[mesh-dispatcher] plow=none is incompatible with v0.5.17+ peers ΓÇö ensure plow_max_iterations >= 4');
  }

  // ┬ºB.3 ULTRA-direct routing hint
  const ultraDirect = task.domain_difficulty_hint === 'math' || task.domain_difficulty_hint === 'physics';
  if (ultraDirect && task.difficulty === 'HARD') {
    console.log(`[mesh-dispatcher] ┬ºB.3 ultra-direct routing: domain=${task.domain_difficulty_hint} ΓÇö restricting to ULTRA only`);
  }

  const supabase = getSupabaseClient();
  const { data: peers, error } = await supabase
    .from('peer_presence')
    .select('*')
    .eq('status', 'active');

  if (error) throw new Error(`[mesh-dispatcher] peer_presence query error: ${error.message}`);

  const now = Date.now();
  const activePeers: PeerRow[] = [];

  for (const peer of (peers ?? []) as PeerRow[]) {
    const lastSeen = peer.last_seen_at ? new Date(peer.last_seen_at).getTime() : 0;
    const ageMs = now - lastSeen;
    if (ageMs > STALE_THRESHOLD_MS) {
      console.log(`[mesh-dispatcher] Heart-of-Peace skip: peer=${peer.peer_id} stale by ${Math.round(ageMs / 1000)}s ΓÇö last_seen=${peer.last_seen_at}`);
      continue;
    }
    activePeers.push(peer);
  }

  // Build routing key
  const routingKey = ultraDirect && task.difficulty === 'HARD'
    ? `${task.difficulty}+${task.modality}+${task.urgency}`
    : `${task.difficulty}+${task.modality}+${task.urgency}`;

  let eligibleTiers: RamTier[] = ROUTING_TABLE[routingKey] ?? ['ULTRA', 'FULL', 'CORE'];

  // ┬ºB.3: skip FULL/CORE for HARD+ultraDirect
  if (ultraDirect && task.difficulty === 'HARD') {
    eligibleTiers = ['ULTRA'];
  }

  // Check if ULTRA is stale ΓÇö extend FULL timeout for HARD+REASONING+REALTIME
  const ultraPeer = activePeers.find(p => p.capabilities?.ramTier === 'ULTRA');
  const isUltraAbsent = !ultraPeer;
  const extendFullTimeout = isUltraAbsent && task.difficulty === 'HARD' && task.modality === 'REASONING' && task.urgency === 'REALTIME';

  const timeoutTable = task.urgency === 'REALTIME' ? TIER_TIMEOUT_REALTIME : TIER_TIMEOUT_BATCH;

  const assignments: PeerAssignment[] = [];

  for (const peer of activePeers) {
    const tier = peer.capabilities?.ramTier;
    if (!tier || !eligibleTiers.includes(tier)) continue;

    let timeout = task.timeout_ms ?? timeoutTable[tier];
    if (extendFullTimeout && tier === 'FULL') {
      timeout = Math.round(timeout * 1.5);
      console.log(`[mesh-dispatcher] ULTRA absent ΓÇö extending FULL timeout to ${timeout}ms for task ${task.task_id}`);
    }

    assignments.push({
      peer_id:     peer.peer_id,
      ramTier:     tier,
      ollamaModel: peer.capabilities?.ollamaModel ?? 'unknown',
      timeout_ms:  timeout,
      rationale:   `tier=${tier} key=${routingKey} ageOk ultraDirect=${ultraDirect}`,
    });
  }

  console.log(`[mesh-dispatcher] routeTask ${task.task_id}: ${assignments.length} assignments for key=${routingKey}`);
  return assignments;
}

// ΓöÇΓöÇΓöÇ selectMIC ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

export async function selectMIC(workloadClass: WorkloadClass, currentWaveId: string): Promise<MICAssignment> {
  const supabase = getSupabaseClient();
  const { data: peers, error } = await supabase
    .from('peer_presence')
    .select('*')
    .eq('status', 'active');

  if (error) throw new Error(`[mesh-dispatcher] selectMIC peer query error: ${error.message}`);

  const now = Date.now();
  const eligibleTiers = WORKLOAD_MIC_ELIGIBLE[workloadClass];

  const eligible = ((peers ?? []) as PeerRow[]).filter(p => {
    const lastSeen = p.last_seen_at ? new Date(p.last_seen_at).getTime() : 0;
    if (now - lastSeen > STALE_THRESHOLD_MS) return false;
    const tier = p.capabilities?.ramTier;
    return tier && eligibleTiers.includes(tier);
  });

  // ALL-STALE-EMERGENCY: fall back to ULTRA
  if (eligible.length === 0 && workloadClass !== 'ALL-STALE-EMERGENCY') {
    console.warn(`[mesh-dispatcher] selectMIC: no eligible peers for ${workloadClass} ΓÇö falling back to ALL-STALE-EMERGENCY`);
    return selectMIC('ALL-STALE-EMERGENCY', currentWaveId);
  }
  if (eligible.length === 0) {
    throw new Error('[mesh-dispatcher] selectMIC: no peers available even for ALL-STALE-EMERGENCY');
  }

  // Sort: tier_rank ASC (NANO first), mic_load_hours ASC, peer_id ASC
  eligible.sort((a, b) => {
    const aTier = TIER_RANK[a.capabilities?.ramTier ?? 'ULTRA'];
    const bTier = TIER_RANK[b.capabilities?.ramTier ?? 'ULTRA'];
    if (aTier !== bTier) return aTier - bTier;
    const aLoad = a.capabilities?.mic_load_hours ?? 0;
    const bLoad = b.capabilities?.mic_load_hours ?? 0;
    if (aLoad !== bLoad) return aLoad - bLoad;
    return a.peer_id.localeCompare(b.peer_id);
  });

  if (workloadClass === 'ALL-STALE-EMERGENCY') {
    console.warn('[mesh-dispatcher] selectMIC EMERGENCY MODE ΓÇö only ULTRA available');
  }

  const primaryPeer = eligible[0];
  const shadowPeers = eligible.slice(1);

  // Atomic CAS: set role='MIC' only if not already MIC
  const { data: casData } = await supabase
    .from('peer_presence')
    .update({ role: 'MIC', wave_id: currentWaveId })
    .eq('peer_id', primaryPeer.peer_id)
    .neq('role', 'MIC')
    .select('peer_id');

  if (!casData || casData.length === 0) {
    console.warn(`[mesh-dispatcher] selectMIC CAS miss for ${primaryPeer.peer_id} ΓÇö already MIC`);
  }

  const assignment: MICAssignment = {
    primary_peer_id: primaryPeer.peer_id,
    shadow_peer_ids: shadowPeers.map(p => p.peer_id),
    workload_class:  workloadClass,
    wave_id:         currentWaveId,
  };

  console.log(`[mesh-dispatcher] MIC assigned: primary=${primaryPeer.peer_id} shadows=${assignment.shadow_peer_ids.length} workload=${workloadClass}`);
  return assignment;
}

// ΓöÇΓöÇΓöÇ FireGuard ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

const FIREGUARD_BLIP_TIMEOUT_MS = 5_000;

export async function runFireGuardHeartbeat(state: FireGuardState): Promise<void> {
  const now = Date.now();
  const blipAge = now - state.last_blip_at;

  if (blipAge > FIREGUARD_BLIP_TIMEOUT_MS) {
    console.warn(`[fireguard] PRIMARY ${state.primary_peer_id} blip timeout: ${blipAge}ms ΓÇö triggering ┬ºA.6 election`);
    const newPrimary = await electNewMIC(state.wave_id);
    if (newPrimary) {
      state.primary_peer_id = newPrimary;
      state.last_blip_at = Date.now();
      console.log(`[fireguard] election complete ΓÇö new PRIMARY: ${newPrimary}`);
    } else {
      console.error('[fireguard] election failed ΓÇö no eligible candidates');
    }
  }
}

// ΓöÇΓöÇΓöÇ electNewMIC ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

export async function electNewMIC(waveId: string | null): Promise<string | null> {
  const supabase = getSupabaseClient();
  const { data: peers, error } = await supabase
    .from('peer_presence')
    .select('*')
    .eq('status', 'active');

  if (error) {
    console.error('[mesh-dispatcher] electNewMIC query error:', error.message);
    return null;
  }

  const now = Date.now();
  const eligible = ((peers ?? []) as PeerRow[]).filter(p => {
    const lastSeen = p.last_seen_at ? new Date(p.last_seen_at).getTime() : 0;
    if (now - lastSeen > STALE_THRESHOLD_MS) return false;
    const tier = p.capabilities?.ramTier;
    // For FireGuard failover: FULL+ preferred
    return tier && (tier === 'FULL' || tier === 'CORE' || tier === 'LITE' || tier === 'NANO');
  });

  // Sort by tier_rank DESC (FULL=3 first as best inference fallback), then mic_load_hours ASC, peer_id ASC
  eligible.sort((a, b) => {
    const aTier = TIER_RANK[a.capabilities?.ramTier ?? 'NANO'];
    const bTier = TIER_RANK[b.capabilities?.ramTier ?? 'NANO'];
    if (aTier !== bTier) return bTier - aTier; // DESC
    const aLoad = a.capabilities?.mic_load_hours ?? 0;
    const bLoad = b.capabilities?.mic_load_hours ?? 0;
    if (aLoad !== bLoad) return aLoad - bLoad;
    return a.peer_id.localeCompare(b.peer_id);
  });

  for (const candidate of eligible) {
    const { data: electedData } = await supabase
      .from('peer_presence')
      .update({ role: 'MIC', wave_id: waveId })
      .eq('peer_id', candidate.peer_id)
      .neq('role', 'MIC')
      .select('peer_id');

    if (electedData && electedData.length > 0) {
      console.log(`[mesh-dispatcher] electNewMIC: elected ${candidate.peer_id}`);
      return candidate.peer_id;
    }
    console.log(`[mesh-dispatcher] electNewMIC: CAS miss for ${candidate.peer_id} ΓÇö trying next`);
  }

  console.error('[mesh-dispatcher] electNewMIC: all candidates exhausted');
  return null;
}
// --- emitPheromoneBlip + FireGuard reciprocal heartbeat (BP094 §3 + §A.5) ---

// Per-wave pheromone blip: PRIMARY MIC peer emits state blip; SHADOW subscribes for liveness.
// Persists last_blip_at to peer_presence via service-role REST.
export async function emitPheromoneBlip(
  waveId: string,
  state: {
    wave_id: string;
    dispatch_timestamp: number;
    task_queue_state: string;
    tier_assignments: Record<string, string>;
    aggregation_progress: string;
    next_action_intent: string;
    role: 'PRIMARY' | 'SHADOW';
    emitting_peer_id: string;
  }
): Promise<void> {
  console.log(`[fireguard-pheromone] wave=${waveId} peer=${state.emitting_peer_id.slice(0, 8)} role=${state.role} blip=${JSON.stringify(state)}`);
  try {
    const supabase = getSupabaseClient();
    await supabase
      .from('peer_presence')
      .update({ last_blip_at: new Date(state.dispatch_timestamp).toISOString(), wave_id: waveId })
      .eq('peer_id', state.emitting_peer_id);
  } catch (err) {
    console.warn('[fireguard-pheromone] Supabase persist failed (non-fatal):', err);
  }
}

// Per-wave alternating PRIMARY/SHADOW: Wave 1: c532e740=PRIMARY, 49f3e597=SHADOW; Wave 2: reversed.
// Neither permanent PRIMARY -- reciprocal pairing per BP091 §4.1.
export function assignFireGuardRoles(
  waveIndex: number,
  coreMicPeers: string[]
): { primary: string; shadow: string } | null {
  if (coreMicPeers.length < 2) return null;
  const [peerA, peerB] = coreMicPeers;
  return waveIndex % 2 === 0
    ? { primary: peerA, shadow: peerB }
    : { primary: peerB, shadow: peerA };
}

// SHADOW monitors PRIMARY's last_blip_at in peer_presence.
// Continuous poll: if PRIMARY emits no blip within 5 seconds, SHADOW promotes.
// Reciprocal: c532e740 watches 49f3e597 and vice versa.
export async function watchHeartbeat(
  primaryPeerId: string,
  shadowPeerId: string,
  waveId: string,
  blipTimeoutMs = 5000
): Promise<{ promoted: boolean; reason: string }> {
  const POLL_INTERVAL_MS = 1000;
  const start = Date.now();
  while (Date.now() - start < blipTimeoutMs) {
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
    try {
      const supabase = getSupabaseClient();
      const { data: row } = await supabase
        .from('peer_presence')
        .select('last_blip_at, wave_id')
        .eq('peer_id', primaryPeerId)
        .single();
      if (row?.last_blip_at) {
        const lastBlip = new Date(row.last_blip_at as string).getTime();
        if (Date.now() - lastBlip < blipTimeoutMs) {
          return { promoted: false, reason: 'primary_alive' };
        }
      }
    } catch {
      // non-fatal poll error -- continue watching
    }
  }
  // PRIMARY blip not seen within timeout -- SHADOW promotes
  console.warn(`[fireguard] SHADOW ${shadowPeerId.slice(0, 8)} promoting after ${blipTimeoutMs}ms -- PRIMARY ${primaryPeerId.slice(0, 8)} blip timeout wave=${waveId}`);
  try {
    const supabase = getSupabaseClient();
    await supabase
      .from('peer_presence')
      .update({ role: 'MIC', wave_id: waveId })
      .eq('peer_id', shadowPeerId);
  } catch (err) {
    console.warn('[fireguard] SHADOW promotion persist failed:', err);
  }
  return { promoted: true, reason: 'primary_blip_timeout' };
}

// If only 1 CORE-MIC peer active, raise FireGuard degraded warning per BP091 §4.4 + BP094 §3.
// Substrate continues with reactive failover only when degraded.
export async function checkFireGuardDegraded(): Promise<{ degraded: boolean; activeCount: number }> {
  try {
    const supabase = getSupabaseClient();
    const { data: rows } = await supabase
      .from('peer_presence')
      .select('peer_id')
      .eq('status', 'active')
      .filter('capabilities->>ramTier', 'eq', 'CORE');
    const activeCount = (rows ?? []).length;
    if (activeCount <= 1) {
      console.warn(`[fireguard] DEGRADED: only ${activeCount} CORE-MIC peer(s) active -- reactive failover only -- Bishop notification required`);
      return { degraded: true, activeCount };
    }
    return { degraded: false, activeCount };
  } catch (err) {
    console.warn('[fireguard] degraded check failed:', err);
    return { degraded: true, activeCount: 0 };
  }
}

// ΓöÇΓöÇΓöÇ accrueMarks ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

export async function accrueMarks(result: DispatchResult, source: string): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('peer_marks_log')
      .insert({
        peer_id:      result.peer_id,
        task_id:      result.task_id,
        task_source:  source,
        marks_earned: result.marks_earned,
      });
    if (error) {
      console.error(`[mesh-dispatcher] accrueMarks insert error for peer=${result.peer_id}: ${error.message}`);
    }
  } catch (err) {
    console.error('[mesh-dispatcher] accrueMarks non-fatal error:', err);
  }
}

// ΓöÇΓöÇΓöÇ dispatchToAssignedPeers ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

export async function dispatchToAssignedPeers(
  assignments: PeerAssignment[],
  task: CooperativeTask,
): Promise<DispatchResult[]> {
  // TODO(M24): wire full hex-wire dispatch via validate-relay.mjs IPC layer
  // For now: mock HTTP dispatch stub ΓÇö returns placeholder results per peer

  if (task.urgency === 'REALTIME') {
    // REALTIME: return first answer with any response
    for (const assignment of assignments) {
      const start = Date.now();
      try {
        const answer = await mockDispatch(assignment, task);
        const result: DispatchResult = {
          task_id:      task.task_id,
          peer_id:      assignment.peer_id,
          answer,
          correct:      null,
          latency_ms:   Date.now() - start,
          marks_earned: 1,
        };
        console.log(`[mesh-dispatcher] REALTIME first-response from peer=${assignment.peer_id} latency=${result.latency_ms}ms`);
        return [result];
      } catch (err) {
        console.warn(`[mesh-dispatcher] REALTIME dispatch failed for peer=${assignment.peer_id}:`, err);
      }
    }
    return [];
  } else {
    // BATCH: fan out to all assigned peers, collect results
    const results = await Promise.allSettled(
      assignments.map(async (assignment) => {
        const start = Date.now();
        const answer = await mockDispatch(assignment, task);
        const result: DispatchResult = {
          task_id:      task.task_id,
          peer_id:      assignment.peer_id,
          answer,
          correct:      null,
          latency_ms:   Date.now() - start,
          marks_earned: 1,
        };
        return result;
      }),
    );

    const fulfilled: DispatchResult[] = [];
    for (const r of results) {
      if (r.status === 'fulfilled') {
        fulfilled.push(r.value);
      } else {
        console.warn('[mesh-dispatcher] BATCH dispatch rejected:', r.reason);
      }
    }
    console.log(`[mesh-dispatcher] BATCH dispatch complete: ${fulfilled.length}/${assignments.length} peers responded`);
    return fulfilled;
  }
}

// Mock dispatch ΓÇö replaced by hex-wire IPC in M24
async function mockDispatch(assignment: PeerAssignment, task: CooperativeTask): Promise<string> {
  // TODO(M24): replace with actual relay IPC call using peer_id + task.payload
  // Full dispatch goes via validate-relay.mjs --wire=hex-mcode
  return `[mock] peer=${assignment.peer_id} model=${assignment.ollamaModel} task=${task.task_id}`;
}
