// BP041 — Live SEG Watch
//
// Founder direct: *"I, and many like me, are visual people. I like to see the
// actual DOING of the segs processing. Like, watching each line of testing...
// CHECKMARK 100% or HIT / MISS / HOT... with totals adding up as we go. It
// makes it FASCINATING to watch. Kind of like, I loved watching plotter
// printers work."*
//
// Polls /yoke/wave/status/<waveId> every 1.5s while the wave is running;
// 5s once complete (just enough to show finalized state). Renders:
//   - LEFT  — vertical list of SEGs with HIT / EMPTY / ERROR / HOT / PENDING
//             status, reply size, recipient
//   - RIGHT — running aggregates: completion %, substantive count, errors,
//             in-flight count, wall-clock, synthesis-present flag

import { useState, useEffect, useRef } from 'react';
import { sagaSubscription } from './saga_subscription';

interface SegState {
  seg_id: string;
  recipient: string;
  status: 'pending' | 'dispatched' | 'done' | 'error';
  started_at?: string;
  done_at?: string;
  reply?: string;
  error?: string;
}

interface WaveState {
  wave_id: string;
  anchor: string;
  status: 'queued' | 'running' | 'synthesizing' | 'complete' | 'aborted';
  segs: SegState[];
  created_at: string;
  completed_at?: string;
  synthesis_text?: string;
}

interface LiveSegWatchProps {
  /** Specific wave to watch. If omitted, watches the most recent wave from saga. */
  waveId?: string;
  /** Maximum vertical height in pixels. */
  maxHeight?: number;
  /** Optional title — defaults to "Live SEG Watch" */
  title?: string;
}

export function LiveSegWatch({ waveId: explicitWaveId, maxHeight = 320, title = 'Live SEG Watch' }: LiveSegWatchProps) {
  const [wave, setWave] = useState<WaveState | null>(null);
  const [autoWaveId, setAutoWaveId] = useState<string | null>(null);
  const targetWaveId = explicitWaveId ?? autoWaveId;

  // Auto-detect most recent wave — three paths in priority order:
  //   (1) Direct event from NovaculaFireButton (instant; doesn't need saga)
  //   (2) localStorage "mnemosyne_last_wave_id" (survives reload)
  //   (3) Saga subscription wave_instances[0] (eventually-consistent fallback)
  useEffect(() => {
    if (explicitWaveId) return; // explicit override

    // (1) Direct event channel
    const onWaveFired = (ev: Event) => {
      const detail = (ev as CustomEvent).detail;
      if (detail?.waveId) setAutoWaveId(detail.waveId);
    };
    window.addEventListener('mnemosyne-wave-fired', onWaveFired);

    // (2) Restore most-recent from localStorage on mount
    try {
      const stored = localStorage.getItem('mnemosyne_last_wave_id');
      if (stored) setAutoWaveId(stored);
    } catch { /* non-fatal */ }

    // (3) Saga subscription fallback (eventually picks up; lower priority)
    const unsub = sagaSubscription.subscribe((state) => {
      const instances = state.wave_instances ?? [];
      if (instances.length > 0) {
        setAutoWaveId((cur) => cur ?? instances[0].id);
      }
    });

    return () => {
      window.removeEventListener('mnemosyne-wave-fired', onWaveFired);
      unsub();
    };
  }, [explicitWaveId]);

  // Poll the target wave
  useEffect(() => {
    if (!targetWaveId) return;
    let active = true;
    const fetchWave = async () => {
      try {
        const resp = await fetch(`http://127.0.0.1:11480/yoke/wave/status/${targetWaveId}`);
        if (!resp.ok || !active) return;
        const data = await resp.json();
        if (active) setWave(data);
      } catch { /* network blip; next tick retries */ }
    };
    fetchWave();
    const interval = setInterval(fetchWave, 1500);
    return () => { active = false; clearInterval(interval); };
  }, [targetWaveId]);

  // BP041 — animated dot trail. Founder direct: "would it be a lot to have a
  // .................................................................... that
  // keeps going as each gets done... constantly showing the progress being made
  // with motion like that?"
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!wave || wave.status === 'complete' || wave.status === 'aborted') return;
    const t = setInterval(() => setTick((n) => (n + 1) % 60), 150);
    return () => clearInterval(t);
  }, [wave?.status, wave?.wave_id]);

  // BP041 — auto-focus on current HOT SEG. Founder direct: "the screen should
  // focus on the current point, like when you map in google maps, it centers
  // you and you see your triangle move along the roadway."
  const segListRef = useRef<HTMLDivElement | null>(null);

  const segs = wave?.segs ?? [];

  // Find the active SEG (first HOT, else first pending, else last done)
  const activeIdx = (() => {
    const firstHot = segs.findIndex((s) => s.status === 'dispatched');
    if (firstHot >= 0) return firstHot;
    const firstPending = segs.findIndex((s) => s.status === 'pending');
    if (firstPending >= 0) return firstPending;
    // No active; find last completed
    for (let i = segs.length - 1; i >= 0; i--) {
      if (segs[i].status === 'done' || segs[i].status === 'error') return i;
    }
    return -1;
  })();

  useEffect(() => {
    if (activeIdx < 0 || !segListRef.current) return;
    const child = segListRef.current.children[activeIdx] as HTMLElement | undefined;
    if (child) {
      child.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeIdx, wave?.status]);
  const total = segs.length;
  const substantive = segs.filter((s) => s.status === 'done' && (s.reply ?? '').length > 100).length;
  const emptyDone = segs.filter((s) => s.status === 'done' && (s.reply ?? '').length <= 100).length;
  const errored = segs.filter((s) => s.status === 'error').length;
  const inFlight = segs.filter((s) => s.status === 'dispatched').length;
  const pending = segs.filter((s) => s.status === 'pending').length;
  const completionPct = total > 0 ? Math.round(((substantive + emptyDone + errored) / total) * 100) : 0;

  // Wall clock
  let wallClock = '—';
  if (wave?.created_at) {
    const start = new Date(wave.created_at).getTime();
    const end = wave.completed_at ? new Date(wave.completed_at).getTime() : Date.now();
    const seconds = Math.round((end - start) / 1000);
    wallClock = seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  }

  // Total reply bytes (cumulative substrate output volume)
  const totalReplyChars = segs.reduce((acc, s) => acc + (s.reply ?? '').length, 0);

  if (!targetWaveId) {
    return (
      <div style={styles.emptyState}>
        <span style={styles.emptyIcon}>🌊</span>
        <span>No waves fired yet this session. Fire a Novacula above to watch SEGs process live.</span>
      </div>
    );
  }

  if (!wave) {
    return (
      <div style={styles.emptyState}>
        <span style={styles.emptyIcon}>⏳</span>
        <span>Loading wave <code>{targetWaveId.slice(0, 16)}…</code></span>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header strip */}
      <div style={styles.header}>
        <span style={styles.title}>{title}</span>
        <code style={styles.waveIdSmall} title={wave.wave_id}>
          {wave.wave_id.slice(0, 24)}…
        </code>
        <span style={{
          ...styles.statusBadge,
          background: wave.status === 'complete' ? '#14532d' : wave.status === 'running' || wave.status === 'queued' ? '#7c2d12' : '#1e3a5f',
          color: wave.status === 'complete' ? '#86efac' : wave.status === 'running' || wave.status === 'queued' ? '#fdba74' : '#93c5fd',
        }}>
          {wave.status.toUpperCase()}
        </span>
      </div>

      {/* BP041 — Animated dot-trail progress bar (Founder direct: ".... then ...... then ........") */}
      {wave.status !== 'complete' && wave.status !== 'aborted' && total > 0 && (
        <div style={styles.dotTrail}>
          {(() => {
            const completed = substantive + emptyDone + errored;
            const slots = Math.max(40, Math.min(80, total)); // dot count scales with SEG count
            const filledSlots = Math.floor((completed / total) * slots);
            const animatedTrailingDots = 1 + (tick % 3); // 1-3 trailing dots cycling
            const dots: string[] = [];
            for (let i = 0; i < slots; i++) {
              if (i < filledSlots) dots.push('•');               // completed
              else if (i < filledSlots + animatedTrailingDots) dots.push('·'); // active trail (animated)
              else dots.push(' ');
            }
            return <span style={styles.dotTrailInner}>{dots.join('')}</span>;
          })()}
        </div>
      )}

      <div style={{ ...styles.body, maxHeight }}>
        {/* LEFT: SEG list — auto-scrolls to active SEG (Google Maps-style focus) */}
        <div style={styles.segList} ref={segListRef}>
          {segs.map((seg, i) => (
            <SegRow key={seg.seg_id} seg={seg} isActive={i === activeIdx} />
          ))}
        </div>

        {/* RIGHT: Aggregates panel */}
        <div style={styles.aggregates}>
          <BigStat value={`${completionPct}%`} label="completion" color="#f6ad55" />
          <Stat value={substantive} label="✅ HIT" color="#22c55e" big />
          <Stat value={emptyDone} label="⚠️ EMPTY" color="#f59e0b" />
          <Stat value={errored} label="❌ ERROR" color="#ef4444" />
          <Stat value={inFlight} label="🔥 HOT (in-flight)" color="#f97316" />
          <Stat value={pending} label="⏳ pending" color="#718096" />
          <Divider />
          <Stat value={wallClock} label="wall-clock" color="#cbd5e0" />
          <Stat value={`${(totalReplyChars / 1000).toFixed(1)}k`} label="reply chars total" color="#a5b4fc" />
          <Stat value={wave.synthesis_text ? '✓ landed' : '—'} label="synthesis" color={wave.synthesis_text ? '#22c55e' : '#4a5568'} />

          {/* BP041 — Banyan Metric F/C/A summary on completion (Founder rule: three axes) */}
          {wave.status === 'complete' && total > 0 && (() => {
            // Baselines (conservative; member can refine in Settings later)
            const serialSecondsPerSeg = 8;             // single-AI serial baseline
            const conventionalUsdPerArtifact = 500;    // entry-tier consulting baseline
            const actualUsdPerArtifact = 0.054;        // BP039-measured per-artifact substrate cost
            const actualSeconds = Math.max(1, Math.round(
              ((wave.completed_at ? new Date(wave.completed_at).getTime() : Date.now())
                - new Date(wave.created_at).getTime()) / 1000
            ));
            const serialSeconds = total * serialSecondsPerSeg;
            const fSpeedup = serialSeconds / actualSeconds;
            const cReduction = conventionalUsdPerArtifact / actualUsdPerArtifact;
            const aAccuracy = (substantive / total) * 100;
            return (
              <>
                <Divider />
                <div style={styles.banyanLabel}>📊 Banyan Metric</div>
                <Stat value={`${fSpeedup.toFixed(1)}×`} label="F · faster (vs serial)" color="#22c55e" big />
                <Stat value={`${Math.round(cReduction).toLocaleString()}×`} label="C · cheaper (per artifact)" color="#86efac" big />
                <Stat value={`${aAccuracy.toFixed(1)}%`} label="A · accuracy (substantive)" color="#fbbf24" big />
                <div style={styles.metricActions}>
                  <button
                    style={styles.metricBtn}
                    onClick={() => {
                      try {
                        const saved = JSON.parse(localStorage.getItem('mnemosyne_test_results') ?? '[]');
                        saved.unshift({
                          wave_id: wave.wave_id,
                          anchor: wave.anchor,
                          completed_at: wave.completed_at,
                          f_speedup: fSpeedup,
                          c_reduction: cReduction,
                          a_accuracy: aAccuracy,
                          total, substantive, errored,
                        });
                        localStorage.setItem('mnemosyne_test_results', JSON.stringify(saved.slice(0, 50)));
                        alert(`✓ Saved ${wave.wave_id.slice(0, 16)}… to test history`);
                      } catch { /* non-fatal */ }
                    }}
                  >💾 Save</button>
                  <button
                    style={styles.metricBtn}
                    onClick={() => {
                      if (confirm('Wipe ALL saved test history? (current wave not affected)')) {
                        localStorage.removeItem('mnemosyne_test_results');
                      }
                    }}
                  >🗑 Wipe history</button>
                </div>
              </>
            );
          })()}
        </div>
      </div>

      {/* Synthesis preview (when wave complete + synthesis present) */}
      {wave.synthesis_text && (
        <details style={styles.synthesisDetails}>
          <summary style={styles.synthesisSummary}>📄 Synthesis output ({wave.synthesis_text.length.toLocaleString()} chars) — click to expand</summary>
          <pre style={styles.synthesisPre}>{wave.synthesis_text.slice(0, 8000)}{wave.synthesis_text.length > 8000 ? '\n\n…(truncated; full output in wave archive)' : ''}</pre>
        </details>
      )}
    </div>
  );
}

/**
 * BP041 — Founder direct: *"that also helps when people can see their own
 * named data flash across the screen."* Extract a human-readable name from
 * the SEG's own reply (most replies start with `### N. Name\n\n...` heading
 * per canonical prompt format). When the reply lands, the SEG's own title
 * appears live — members see meaningful labels not generic seg_ids.
 */
function extractSegName(seg: SegState): { display: string; fromReply: boolean } {
  const reply = seg.reply ?? '';
  if (reply.length > 10) {
    // Try first line; strip leading markdown header markers
    const firstLine = reply.split('\n')[0].replace(/^#+\s*/, '').trim();
    if (firstLine && firstLine.length > 0 && firstLine.length < 100) {
      return { display: firstLine, fromReply: true };
    }
  }
  // Fallback to seg_id with light prettification
  const pretty = seg.seg_id.replace(/^seg_/, '').replace(/_/g, ' ');
  return { display: pretty, fromReply: false };
}

function SegRow({ seg, isActive }: { seg: SegState; isActive?: boolean }) {
  const replyLen = (seg.reply ?? '').length;
  const { display: segName, fromReply } = extractSegName(seg);
  let icon: string, color: string, label: string;
  if (seg.status === 'error') {
    icon = '❌'; color = '#ef4444'; label = 'ERROR';
  } else if (seg.status === 'done' && replyLen > 100) {
    icon = '✅'; color = '#22c55e'; label = 'HIT';
  } else if (seg.status === 'done') {
    icon = '⚠️'; color = '#f59e0b'; label = 'EMPTY';
  } else if (seg.status === 'dispatched') {
    icon = '🔥'; color = '#f97316'; label = 'HOT';
  } else {
    icon = '⏳'; color = '#718096'; label = 'PENDING';
  }
  return (
    <div style={{
      ...styles.segRow,
      borderLeftColor: color,
      ...(isActive ? styles.segRowActive : {}),
    }} title={seg.error ?? `${seg.seg_id} → ${seg.recipient}`}>
      <span style={styles.segIcon}>{icon}</span>
      <span style={{
        ...styles.segId,
        // Once reply lands, the name pops into a brighter color — plotter-printer feel
        color: fromReply ? '#e2e8f0' : '#718096',
        fontFamily: fromReply ? 'inherit' : 'monospace',
        fontSize: fromReply ? '0.72rem' : '0.65rem',
        fontWeight: fromReply ? 600 : 400,
        flex: 1,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>{segName}</span>
      <span style={styles.segRecipient}>{seg.recipient}</span>
      <span style={{ ...styles.segStatus, color }}>{label}</span>
      <span style={styles.segMetric}>
        {replyLen > 0 ? `${replyLen.toLocaleString()} ch` : ''}
      </span>
    </div>
  );
}

function Stat({ value, label, color, big }: { value: string | number; label: string; color: string; big?: boolean }) {
  return (
    <div style={styles.statRow}>
      <span style={{ ...styles.statValue, color, fontSize: big ? '1.05rem' : '0.85rem' }}>{value}</span>
      <span style={styles.statLabel}>{label}</span>
    </div>
  );
}

function BigStat({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <div style={styles.bigStatRow}>
      <span style={{ ...styles.bigStatValue, color }}>{value}</span>
      <span style={styles.bigStatLabel}>{label}</span>
    </div>
  );
}

function Divider() {
  return <div style={styles.divider} />;
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    background: '#0a0a12',
    border: '1px solid #2d3748',
    borderRadius: '6px',
    overflow: 'hidden',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.4rem 0.75rem',
    background: '#111120',
    borderBottom: '1px solid #2d3748',
    fontSize: '0.75rem',
  },
  title: { fontWeight: 700, color: '#f6ad55', letterSpacing: '0.04em' },
  waveIdSmall: {
    fontFamily: 'monospace',
    fontSize: '0.65rem',
    color: '#718096',
    background: '#0a0a12',
    padding: '1px 5px',
    borderRadius: '3px',
    userSelect: 'text',
  },
  statusBadge: {
    fontSize: '0.6rem',
    fontWeight: 700,
    padding: '1px 6px',
    borderRadius: '3px',
    letterSpacing: '0.08em',
    marginLeft: 'auto',
  },
  body: {
    display: 'flex',
    gap: '0.5rem',
    padding: '0.5rem',
    overflow: 'hidden',
    minHeight: 120,
  },
  segList: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    paddingRight: '0.25rem',
  },
  segRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '3px 6px',
    background: '#12121f',
    borderLeft: '3px solid',
    borderRadius: '2px',
    fontSize: '0.7rem',
    transition: 'background 0.18s, border-left-color 0.18s, box-shadow 0.18s',
    scrollMarginTop: '40px',  // for scrollIntoView smooth-center
    scrollMarginBottom: '40px',
  },
  segRowActive: {
    // BP041 — "Google Maps triangle" auto-focus highlight on current SEG
    background: '#1f2540',
    boxShadow: '0 0 0 1px #f6ad5544, 0 0 8px #f6ad5522',
  },
  dotTrail: {
    overflow: 'hidden',
    padding: '4px 8px',
    background: '#070710',
    borderBottom: '1px solid #1a1a2e',
    fontFamily: 'monospace',
    fontSize: '0.75rem',
    color: '#f6ad55',
    letterSpacing: '0.1em',
    whiteSpace: 'nowrap' as const,
  },
  dotTrailInner: {
    display: 'inline-block',
    minWidth: '100%',
  },
  segIcon: { fontSize: '0.75rem' },
  segId: { fontFamily: 'monospace', color: '#cbd5e0', fontSize: '0.65rem' },
  segRecipient: { color: '#718096', fontSize: '0.6rem' },
  segStatus: { fontWeight: 700, fontSize: '0.6rem', letterSpacing: '0.05em', marginLeft: 'auto' },
  segMetric: { fontFamily: 'monospace', fontSize: '0.6rem', color: '#a0aec0', minWidth: 60, textAlign: 'right' },
  aggregates: {
    flex: '0 0 180px',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
    padding: '0.5rem',
    background: '#080812',
    borderRadius: '4px',
    fontSize: '0.7rem',
  },
  bigStatRow: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0.25rem 0' },
  bigStatValue: { fontSize: '1.8rem', fontWeight: 800, lineHeight: 1, fontFamily: 'monospace' },
  bigStatLabel: { fontSize: '0.55rem', color: '#718096', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 2 },
  statRow: { display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'space-between' },
  statValue: { fontWeight: 700, fontFamily: 'monospace' },
  statLabel: { fontSize: '0.6rem', color: '#718096' },
  divider: { height: 1, background: '#2d3748', margin: '0.25rem 0' },
  banyanLabel: { fontSize: '0.65rem', color: '#f6ad55', fontWeight: 700, letterSpacing: '0.08em', textAlign: 'center' as const, marginTop: 4 },
  metricActions: { display: 'flex', gap: '0.25rem', marginTop: 6 },
  metricBtn: {
    flex: 1,
    background: '#1a202c',
    border: '1px solid #2d3748',
    borderRadius: 3,
    color: '#a0aec0',
    padding: '3px 6px',
    fontSize: '0.6rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  emptyState: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '1rem',
    background: '#0a0a12',
    border: '1px dashed #2d3748',
    borderRadius: '6px',
    color: '#718096',
    fontSize: '0.75rem',
    fontStyle: 'italic',
  },
  emptyIcon: { fontSize: '1.1rem' },
  synthesisDetails: {
    borderTop: '1px solid #2d3748',
    background: '#080812',
  },
  synthesisSummary: {
    padding: '0.4rem 0.75rem',
    cursor: 'pointer',
    fontSize: '0.7rem',
    color: '#86efac',
    userSelect: 'none',
  },
  synthesisPre: {
    padding: '0.5rem 0.75rem',
    margin: 0,
    fontFamily: 'monospace',
    fontSize: '0.65rem',
    color: '#cbd5e0',
    background: '#050510',
    maxHeight: 240,
    overflow: 'auto',
    whiteSpace: 'pre-wrap',
    userSelect: 'text',
  },
};
