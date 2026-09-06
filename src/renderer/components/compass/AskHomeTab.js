import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// compass/AskHomeTab.tsx -- BP138 Yoke 0.9.14: Compass nav tab 1 (Ask).
//
// Phase 1 (Nexus signal): Ask must carry a VISIBLE "attach your apps / route your AI here"
// entry point, not just a plain chat box. Investigation finding (reported honestly in the
// Yoke report): a real orchestration/multi-authority surface DOES already exist in this
// codebase -- NexusAuthoritySettings.tsx + NexusAuthoritySignInPanel.tsx (BP137 0.9.12), which
// let a member sign into their OWN Google/Perplexity accounts so the Plow's Research Arm can
// route specific answer arms (compute / lookup-fact / reasoning) through those authorities
// instead of (or alongside) this app's local model. Both components are real, already wired
// to live main-process IPC (ensureNexusAuthoritySession, probeAllNexusAuthorityStatuses, etc.
// in src/main/index.ts + src/main/plow/nexus_authority_persistent_session.ts) -- previously
// they were buried inside Settings only. Reused here as-is (not rebuilt) as the Ask tab's
// visible Nexus entry point, collapsed by default so the query field stays the primary focus.
//
// Phase 3 (first-run home): trust statement + "See proof" entry + Kitchen Table/Atlas
// quick-starts, all real navigation, no fabricated stats.
//
// Phase 4 (co-op story): CoopTouch banner, small and honest, canonical figures only.
//
// Phase 5 (Cue Deck card): "Share your savings" card, gated on real Answer-Cache Meter data
// (same IPC ProveItWorksTab.tsx already uses) -- skipped entirely (not shown) when the real
// meter has zero recorded queries, per the hard "never fabricate" constraint.
//
// SEG: D-BP148-001/KNIGHT/M3/seg-m3t4r -- adds the optional, OFF-BY-DEFAULT dial-up modem
// handshake sound checkbox (Founder request, BP148 release pass). Owned/persisted here (the
// home-tab shell) rather than inside LeanAskTab itself, since it is a standing user preference,
// not per-message chat state -- threaded down to LeanAskTab as a plain prop. Purely cosmetic;
// see modemHandshakeSound.ts for the hard "never gate the real connection" contract.
import { useCallback, useEffect, useState } from 'react';
import { LeanAskTab } from '../LeanAskTab';
import { NexusAuthoritySettings } from '../../settings/NexusAuthoritySettings';
import { NexusAuthoritySignInPanel } from '../../settings/NexusAuthoritySignInPanel';
import { CueDeckCardRenderer } from '../CueDeckCardRenderer';
import { CoopTouch } from './CoopTouch';
import { isModemHandshakeSoundSupported } from '../../lib/modemHandshakeSound';
const LS_HANDSHAKE_SOUND_KEY = 'mnemo_modem_handshake_sound_enabled';
function loadHandshakeSoundEnabled() {
    try {
        return localStorage.getItem(LS_HANDSHAKE_SOUND_KEY) === 'true';
    }
    catch {
        return false;
    }
}
export function AskHomeTab({ onNavigate }) {
    const [nexusOpen, setNexusOpen] = useState(false);
    const [meter, setMeter] = useState(null);
    const [shareOpen, setShareOpen] = useState(false);
    // SEG D-BP148-001/KNIGHT/M3: dial-up handshake sound preference -- OFF BY DEFAULT
    // (loadHandshakeSoundEnabled() returns false when the key has never been written), persisted
    // across sessions once the Founder opts in.
    const [handshakeSoundEnabled, setHandshakeSoundEnabled] = useState(loadHandshakeSoundEnabled);
    const handshakeSoundSupported = isModemHandshakeSoundSupported();
    const toggleHandshakeSound = useCallback(() => {
        setHandshakeSoundEnabled((prev) => {
            const next = !prev;
            try {
                localStorage.setItem(LS_HANDSHAKE_SOUND_KEY, String(next));
            }
            catch {
                // non-fatal -- the toggle still works for this session even if persistence fails
            }
            return next;
        });
    }, []);
    useEffect(() => {
        void (async () => {
            try {
                const res = await window.amplify?.aiDispatch?.getAnswerCacheMeterSummary?.();
                if (res?.ok && res.summary)
                    setMeter(res.summary);
            }
            catch {
                // non-fatal -- the share card below simply stays hidden
            }
        })();
    }, []);
    const shareTemplate = meter && meter.total_queries > 0 ? {
        id: 'doctrine-ask-savings-receipt',
        title: 'My Ask Receipt',
        subtitle: 'Served free from the substrate -- real counters only',
        body_text: `${meter.served_verbatim_count} of ${meter.total_queries} questions answered free (no model call), an estimated $${meter.cloud_cost_avoided_usd.toFixed(4)} in avoided cloud cost. Not a guarantee -- an honest estimate from this machine's own answer-cache log.`,
        accent_color: 'primary',
        background_type: 'gradient',
    } : null;
    return (_jsxs("div", { style: { height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }, children: [_jsxs("div", { style: { padding: '10px 16px 8px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }, children: [_jsx("div", { style: { fontSize: 11, color: '#64748b', lineHeight: 1.5 }, children: "Ask anything. Your AI runs locally and privately by default -- every answer carries an honest provenance trail, never a fabricated certainty." }), _jsxs("div", { style: { display: 'flex', gap: 8, flexWrap: 'wrap' }, children: [_jsx("button", { onClick: () => onNavigate('proof'), style: pillBtn(false, '#6ee7b7'), children: "\uD83D\uDD0E See proof" }), _jsx("button", { onClick: () => onNavigate('more', 'kitchen-table'), style: pillBtn(false, '#38bdf8'), children: "\uD83C\uDF7D\uFE0F Kitchen Table" }), _jsx("button", { onClick: () => onNavigate('more', 'atlas'), style: pillBtn(false, '#38bdf8'), children: "\uD83D\uDDD3\uFE0F Atlas" }), _jsxs("button", { onClick: () => setNexusOpen((v) => !v), style: pillBtn(nexusOpen, '#a78bfa'), children: ["\uD83D\uDD17 Nexus -- attach your apps ", nexusOpen ? '▲' : '▼'] }), shareTemplate && (_jsxs("button", { onClick: () => setShareOpen((v) => !v), style: pillBtn(shareOpen, '#facc15'), children: ["\uD83D\uDCE4 ", shareOpen ? 'Hide' : 'Share your savings'] }))] }), handshakeSoundSupported && (_jsxs("label", { style: {
                            display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#64748b',
                            cursor: 'pointer', userSelect: 'none', width: 'fit-content',
                        }, title: "Plays a synthesized dial-up modem handshake sound when a message is sent. Cosmetic only -- never delays the actual reply.", children: [_jsx("input", { type: "checkbox", checked: handshakeSoundEnabled, onChange: toggleHandshakeSound, style: { cursor: 'pointer' } }), "\uD83D\uDCDE Dial-up handshake sound on connect"] })), nexusOpen && (_jsxs("div", { style: {
                            background: '#0d1117', border: '1px solid #1e2a38', borderRadius: 8,
                            padding: 12, maxHeight: 320, overflowY: 'auto',
                        }, children: [_jsx("div", { style: { fontSize: 11, color: '#94a3b8', marginBottom: 10, lineHeight: 1.5 }, children: "Nexus lets you attach your own Google or Perplexity account so specific kinds of questions can be routed through YOUR logged-in session (at your own $0 quota) instead of this app's local model alone -- this is the real orchestration surface behind \"attach your apps.\" Enable it below, then sign in." }), _jsx(NexusAuthoritySettings, {}), _jsx(NexusAuthoritySignInPanel, {})] })), shareOpen && shareTemplate && (_jsx(CueDeckCardRenderer, { template: shareTemplate })), _jsx(CoopTouch, { compact: true, onLearnMore: () => onNavigate('more', 'membership') })] }), _jsx("div", { style: { flex: 1, overflow: 'hidden' }, children: _jsx(LeanAskTab, { handshakeSoundEnabled: handshakeSoundEnabled }) })] }));
}
function pillBtn(active, color) {
    return {
        background: active ? `${color}22` : 'none',
        color,
        border: `1px solid ${color}55`,
        borderRadius: 6,
        padding: '5px 11px',
        fontSize: 11,
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: 'system-ui, sans-serif',
        whiteSpace: 'nowrap',
    };
}
export default AskHomeTab;
