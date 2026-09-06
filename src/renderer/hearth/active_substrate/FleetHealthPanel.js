import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// D7 · BP105 — Fleet Health Panel
// Per-peer status panel: machine_label, version, LAN IPs, last_seen_at,
// poll_rate (relay_route_replies delta), last_answered_at, health verdict.
// Exposes the "peer heartbeats but can't answer" lie that the D6 hang caused.
import { useState, useEffect, useCallback } from 'react';
import { getSupabase } from '../../lib/supabase';
// ── Helpers ────────────────────────────────────────────────────────────────────
function ageSeconds(isoTs) {
    if (!isoTs)
        return null;
    return (Date.now() - new Date(isoTs).getTime()) / 1000;
}
function relativeTime(ageS) {
    if (ageS === null)
        return '—';
    if (ageS < 60)
        return `${Math.round(ageS)}s ago`;
    if (ageS < 3600)
        return `${Math.round(ageS / 60)}m ago`;
    return `${(ageS / 3600).toFixed(1)}h ago`;
}
function computeVerdict(peer) {
    const degraded = [
        !peer.heartbeat_ok ? 1 : 0,
        peer.worker_ok === false ? 1 : 0,
        peer.answering_ok === false ? 1 : 0,
    ].reduce((a, b) => a + b, 0);
    if (degraded === 0)
        return 'green';
    if (degraded === 1)
        return 'amber';
    return 'red';
}
function verdictColor(v) {
    switch (v) {
        case 'green': return '#22c55e';
        case 'amber': return '#f6ad55';
        case 'red': return '#ef4444';
        default: return '#4a5568';
    }
}
function verdictLabel(v) {
    switch (v) {
        case 'green': return 'Healthy';
        case 'amber': return 'Degraded';
        case 'red': return 'Critical';
        default: return 'Unknown';
    }
}
// ── Component ─────────────────────────────────────────────────────────────────
export function FleetHealthPanel() {
    const [peers, setPeers] = useState([]);
    const [lastAnswered, setLastAnswered] = useState({});
    const [prevPollCounts, setPrevPollCounts] = useState({});
    const [pollRates, setPollRates] = useState({});
    const [error, setError] = useState(null);
    const [tick, setTick] = useState(0);
    // Re-render every second for relative-time freshness
    useEffect(() => {
        const t = setInterval(() => setTick((n) => n + 1), 1000);
        return () => clearInterval(t);
    }, []);
    // Fetch peer_presence every 5s
    const fetchPeers = useCallback(async () => {
        const sb = getSupabase();
        if (!sb) {
            setError('Supabase unavailable');
            return;
        }
        try {
            // BP133 Yoke #26: peer_presence's column is `state`, not `status`.
            const { data, error: err } = await sb
                .from('peer_presence')
                .select('peer_id, machine_label, last_seen_at, lan_addresses, relay_poller_poll_count, capabilities')
                .eq('state', 'active')
                .order('last_seen_at', { ascending: false });
            if (err) {
                setError(err.message);
                return;
            }
            setError(null);
            const rows = (data ?? []);
            const now = Date.now();
            // Update poll rates from poll_count delta
            const newPrevCounts = {};
            const newPollRates = {};
            for (const row of rows) {
                if (row.relay_poller_poll_count !== null && row.relay_poller_poll_count !== undefined) {
                    const prev = prevPollCounts[row.peer_id];
                    if (prev) {
                        const deltaCount = row.relay_poller_poll_count - prev.count;
                        const deltaMs = now - prev.ts;
                        newPollRates[row.peer_id] = deltaMs > 0
                            ? (deltaCount / deltaMs) * 60000
                            : null;
                    }
                    newPrevCounts[row.peer_id] = { count: row.relay_poller_poll_count, ts: now };
                }
                else {
                    newPollRates[row.peer_id] = null;
                }
            }
            setPrevPollCounts((prev) => ({ ...prev, ...newPrevCounts }));
            setPollRates((prev) => ({ ...prev, ...newPollRates }));
            const updated = rows.map((row) => {
                const ageS = ageSeconds(row.last_seen_at);
                const heartbeatOk = ageS !== null && ageS < 90;
                const pollRate = pollRates[row.peer_id] ?? null;
                const workerOk = pollRate !== null ? pollRate >= 0.5 : null;
                const answeredAgeS = ageSeconds(lastAnswered[row.peer_id] ?? null);
                const answeringOk = answeredAgeS !== null ? answeredAgeS < 600 : null;
                const peer = {
                    peer_id: row.peer_id,
                    machine_label: row.machine_label,
                    version: row.capabilities?.version ?? null,
                    lan_addresses: row.lan_addresses ?? [],
                    last_seen_at: row.last_seen_at,
                    last_seen_age_s: ageS,
                    poll_rate_per_min: pollRate,
                    last_answered_at: lastAnswered[row.peer_id] ?? null,
                    last_answered_age_s: answeredAgeS,
                    heartbeat_ok: heartbeatOk,
                    worker_ok: workerOk,
                    answering_ok: answeringOk,
                    verdict: 'unknown',
                };
                peer.verdict = computeVerdict(peer);
                return peer;
            });
            setPeers(updated);
        }
        catch (e) {
            setError(String(e));
        }
    }, [lastAnswered, pollRates, prevPollCounts]);
    // Fetch relay_route_replies last_answered_at every 15s
    const fetchAnswered = useCallback(async () => {
        const sb = getSupabase();
        if (!sb)
            return;
        try {
            const since = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // last 10 min
            const { data } = await sb
                .from('relay_route_replies')
                .select('peer_id, created_at')
                .gte('created_at', since)
                .order('created_at', { ascending: false });
            if (!data)
                return;
            const byPeer = {};
            for (const row of data) {
                if (!byPeer[row.peer_id])
                    byPeer[row.peer_id] = row.created_at;
            }
            setLastAnswered(byPeer);
        }
        catch {
            /* non-fatal */
        }
    }, []);
    useEffect(() => {
        fetchPeers();
        fetchAnswered();
        const t1 = setInterval(fetchPeers, 5000);
        const t2 = setInterval(fetchAnswered, 15000);
        return () => { clearInterval(t1); clearInterval(t2); };
    }, [fetchPeers, fetchAnswered]);
    // Recompute peer verdicts when tick changes (for relative time freshness)
    const displayPeers = peers.map((peer) => {
        const ageS = ageSeconds(peer.last_seen_at);
        const heartbeatOk = ageS !== null && ageS < 90;
        const answeredAgeS = ageSeconds(peer.last_answered_at);
        const answeringOk = answeredAgeS !== null ? answeredAgeS < 600 : peer.answering_ok;
        const updated = {
            ...peer,
            last_seen_age_s: ageS,
            last_answered_age_s: answeredAgeS,
            heartbeat_ok: heartbeatOk,
            answering_ok: answeringOk,
            verdict: 'unknown',
        };
        updated.verdict = computeVerdict(updated);
        return updated;
    });
    return (_jsxs("div", { style: styles.container, children: [_jsxs("div", { style: styles.header, children: [_jsx("span", { style: styles.title, children: "Fleet Health" }), _jsxs("span", { style: styles.subtitle, children: [displayPeers.length, " peer", displayPeers.length !== 1 ? 's' : '', " active"] })] }), error && _jsx("div", { style: styles.error, children: error }), displayPeers.length === 0 && !error && (_jsx("div", { style: styles.empty, children: "No active peers in peer_presence" })), _jsx("div", { style: styles.grid, children: displayPeers.map((peer) => {
                    const color = verdictColor(peer.verdict);
                    return (_jsxs("div", { style: { ...styles.card, borderColor: color }, children: [_jsx("div", { style: { ...styles.badge, background: color }, children: verdictLabel(peer.verdict) }), _jsx("div", { style: styles.peerLabel, children: peer.machine_label ?? peer.peer_id.slice(0, 16) }), _jsxs("div", { style: styles.peerId, children: [peer.peer_id.slice(0, 16), "\u2026"] }), _jsxs("div", { style: styles.row, children: [_jsx("span", { style: styles.key, children: "version" }), _jsx("span", { style: styles.val, children: peer.version ?? '—' })] }), _jsxs("div", { style: styles.row, children: [_jsx("span", { style: styles.key, children: "LAN" }), _jsx("span", { style: styles.val, children: peer.lan_addresses.length > 0 ? peer.lan_addresses[0] : '—' })] }), _jsx("div", { style: styles.divider }), _jsx(AxisRow, { label: "heartbeat", ok: peer.heartbeat_ok, detail: relativeTime(peer.last_seen_age_s) }), _jsx(AxisRow, { label: "worker", ok: peer.worker_ok, detail: peer.poll_rate_per_min !== null
                                    ? `${peer.poll_rate_per_min.toFixed(1)}/min`
                                    : 'no poll data' }), _jsx(AxisRow, { label: "answering", ok: peer.answering_ok, detail: relativeTime(peer.last_answered_age_s) })] }, peer.peer_id));
                }) }), _jsxs("div", { style: styles.legend, children: [_jsx(LegendItem, { color: "#22c55e", label: "green = all 3 axes healthy" }), _jsx(LegendItem, { color: "#f6ad55", label: "amber = 1 axis degraded" }), _jsx(LegendItem, { color: "#ef4444", label: "red = \u22652 axes degraded" })] })] }));
}
function AxisRow({ label, ok, detail }) {
    const color = ok === null ? '#4a5568' : ok ? '#22c55e' : '#ef4444';
    const symbol = ok === null ? '○' : ok ? '●' : '✕';
    return (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.68rem' }, children: [_jsx("span", { style: { color, fontWeight: 700 }, children: symbol }), _jsx("span", { style: { color: '#94a3b8', minWidth: '5.5rem' }, children: label }), _jsx("span", { style: { color: '#64748b', fontFamily: 'monospace' }, children: detail })] }));
}
function LegendItem({ color, label }) {
    return (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '0.4rem' }, children: [_jsx("span", { style: { color, fontSize: '0.7rem' }, children: "\u25CF" }), _jsx("span", { style: { fontSize: '0.65rem', color: '#4a5568' }, children: label })] }));
}
// ── Styles ────────────────────────────────────────────────────────────────────
const styles = {
    container: {
        background: '#0f172a',
        borderRadius: '8px',
        border: '1px solid #1e293b',
        padding: '0.75rem',
        marginTop: '0.5rem',
    },
    header: {
        display: 'flex',
        alignItems: 'baseline',
        gap: '0.75rem',
        marginBottom: '0.5rem',
    },
    title: {
        fontSize: '0.8rem',
        fontWeight: 700,
        color: '#e2e8f0',
        letterSpacing: '0.03em',
    },
    subtitle: {
        fontSize: '0.65rem',
        color: '#4a5568',
    },
    error: {
        fontSize: '0.7rem',
        color: '#ef4444',
        marginBottom: '0.5rem',
        background: '#1e0000',
        padding: '0.3rem 0.5rem',
        borderRadius: '4px',
    },
    empty: {
        fontSize: '0.72rem',
        color: '#4a5568',
        padding: '0.5rem 0',
    },
    grid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: '0.5rem',
        marginBottom: '0.5rem',
    },
    card: {
        background: '#1a1a2e',
        border: '1.5px solid',
        borderRadius: '8px',
        padding: '0.6rem 0.7rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.2rem',
    },
    badge: {
        display: 'inline-block',
        fontSize: '0.6rem',
        fontWeight: 700,
        color: '#0f172a',
        borderRadius: '4px',
        padding: '0.1rem 0.4rem',
        alignSelf: 'flex-start',
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
    },
    peerLabel: {
        fontSize: '0.78rem',
        fontWeight: 600,
        color: '#e2e8f0',
        marginTop: '0.15rem',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    },
    peerId: {
        fontSize: '0.6rem',
        color: '#334155',
        fontFamily: 'monospace',
        marginBottom: '0.1rem',
    },
    row: {
        display: 'flex',
        gap: '0.5rem',
        fontSize: '0.67rem',
    },
    key: {
        color: '#4a5568',
        minWidth: '4rem',
    },
    val: {
        color: '#94a3b8',
        fontFamily: 'monospace',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        flex: 1,
    },
    divider: {
        borderTop: '1px solid #1e293b',
        margin: '0.3rem 0',
    },
    legend: {
        display: 'flex',
        gap: '1rem',
        flexWrap: 'wrap',
        marginTop: '0.3rem',
        paddingTop: '0.3rem',
        borderTop: '1px solid #1e293b',
    },
};
