import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ConjunctionPanel } from '../conjunction/ConjunctionPanel';
import { useConjunction } from '../conjunction/conjunction_state';
import { ActiveSubstratePanel } from '../active_substrate/ActiveSubstratePanel';
import { DrekaskipStatusPanel } from '../drekaskip_status/DrekaskipStatusPanel';
import { OnDeckPanel } from '../on_deck/OnDeckPanel';
// ── Placeholder card for not-yet-built cards ────────────────────────────────
function PlaceholderCard({ icon, label, desc }) {
    return (_jsxs("div", { style: {
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: '0.5rem', color: '#718096', padding: '1.5rem', height: '100%', textAlign: 'center',
        }, children: [_jsx("span", { style: { fontSize: '2rem' }, children: icon }), _jsx("span", { style: { fontSize: '0.85rem', fontWeight: 600, color: '#a0aec0' }, children: label }), _jsx("span", { style: { fontSize: '0.72rem', lineHeight: 1.5, maxWidth: 260 }, children: desc }), _jsx("span", { style: { fontSize: '0.65rem', color: '#4a5568', marginTop: '0.25rem' }, children: "Coming soon \u00B7 SAGA 5+" })] }));
}
// ── Card components ──────────────────────────────────────────────────────────
// InConjunctionCard reads from ConjunctionContext (always provided by HearthConjunctionWindow).
const InConjunctionCard = () => {
    const { panelState, selectMode, probeAgent, tierChoices, apiKeyStatus, agents, probeMap, setTierChoice, openApiKeySettings } = useConjunction();
    return (_jsx(ConjunctionPanel, { panelState: panelState, agents: agents, probeMap: probeMap, tierChoices: tierChoices, apiKeyStatus: apiKeyStatus, onSelect: selectMode, onProbeAgent: probeAgent, onTierChange: setTierChoice, onOpenApiKeySettings: openApiKeySettings }));
};
const ActiveSubstrateCard = () => _jsx(ActiveSubstratePanel, {});
const DrekaskipCard = () => _jsx(DrekaskipStatusPanel, {});
const OnDeckCard = () => _jsx(OnDeckPanel, {});
const BanyanMetricCard = () => _jsx(PlaceholderCard, { icon: "\uD83D\uDCCA", label: "Banyan Metric", desc: "Cooperative platform metrics \u2014 member activity, wave volume, cost avoided." });
const MyTabletsCard = () => _jsx(PlaceholderCard, { icon: "\uD83D\uDCCB", label: "My Tablets", desc: "Your personal substrate tablets \u2014 notes, decisions, and session anchors." });
const HearthPantheonCard = () => _jsx(PlaceholderCard, { icon: "\uD83C\uDFDB\uFE0F", label: "Hearth Pantheon", desc: "All active Pantheon agents \u2014 their status, queue depth, and last dispatch." });
const PheromoneStreamCard = () => _jsx(PlaceholderCard, { icon: "\uD83C\uDF3F", label: "Pheromone Stream", desc: "Live pheromone trail \u2014 recent retrieval hits, weight updates, hot paths." });
const CrystalInspectorCard = () => _jsx(PlaceholderCard, { icon: "\uD83D\uDD2E", label: "Crystal Inspector", desc: "Deep-inspect any substrate record \u2014 full metadata, lineage, and scores." });
const YokeBusCard = () => _jsx(PlaceholderCard, { icon: "\uD83D\uDD17", label: "Yoke Bus", desc: "CAI Yoke channel monitor \u2014 message queue, agent handoffs, Conductor routing." });
const FederationPeersCard = () => _jsx(PlaceholderCard, { icon: "\uD83C\uDF10", label: "Federation Peers", desc: "Connected cooperative peers \u2014 sync status, latency, record exchange counts." });
const K533HistoryCard = () => _jsx(PlaceholderCard, { icon: "\uD83D\uDCDC", label: "K533 History", desc: "Wave archive \u2014 all dispatched waves, results, and synthesis receipts." });
const IpLedgerCard = () => _jsx(PlaceholderCard, { icon: "\u2696\uFE0F", label: "IP Ledger", desc: "Cooperative IP registry \u2014 claims, supersedes-chains, and dispute status." });
const ThreeCurrencyCard = () => _jsx(PlaceholderCard, { icon: "\uD83D\uDCB0", label: "Three-Currency", desc: "Creator earnings \u00B7 Platform margin \u00B7 Member savings \u2014 live ledger view." });
const InitiativeBoardCard = () => _jsx(PlaceholderCard, { icon: "\uD83C\uDF33", label: "Initiative Board", desc: "Sweet Sixteen initiative tracker \u2014 activity, participation, milestones." });
// ── Registry ────────────────────────────────────────────────────────────────
export const CARD_COMPONENTS = {
    in_conjunction: InConjunctionCard,
    active_substrate: ActiveSubstrateCard,
    on_deck: OnDeckCard,
    banyan_metric: BanyanMetricCard,
    drekaskip: DrekaskipCard,
    my_tablets: MyTabletsCard,
    hearth_pantheon: HearthPantheonCard,
    pheromone_stream: PheromoneStreamCard,
    crystal_inspector: CrystalInspectorCard,
    yoke_bus: YokeBusCard,
    federation_peers: FederationPeersCard,
    k533_history: K533HistoryCard,
    ip_ledger: IpLedgerCard,
    three_currency: ThreeCurrencyCard,
    initiative_board: InitiativeBoardCard,
};
export const CARD_META_LIST = [
    { id: 'in_conjunction', icon: '📡', label: 'In Conjunction', category: 'agent', description: '8-agent CAI Bridge panel — select and dispatch AI modes.' },
    { id: 'active_substrate', icon: '🔬', label: 'Active Substrate', category: 'substrate', description: 'Live scribe monitor — substrate metrics, flip-card detail.' },
    { id: 'drekaskip', icon: '🌊', label: 'Drekaskip', category: 'activity', description: 'Wave status panel — live SEG progression and dispatch receipts.' },
    { id: 'on_deck', icon: '🧭', label: 'On Deck', category: 'activity', description: 'Task queue staging — pending MnemosyneC work items.' },
    { id: 'banyan_metric', icon: '📊', label: 'Banyan Metric', category: 'ledger', description: 'Cooperative platform metrics — member activity, cost avoided.' },
    { id: 'my_tablets', icon: '📋', label: 'My Tablets', category: 'substrate', description: 'Personal substrate tablets — notes, decisions, session anchors.' },
    { id: 'hearth_pantheon', icon: '🏛️', label: 'Hearth Pantheon', category: 'agent', description: 'Active Pantheon agents — status, queue depth, last dispatch.' },
    { id: 'pheromone_stream', icon: '🌿', label: 'Pheromone Stream', category: 'substrate', description: 'Live pheromone trail — retrieval hits, weight updates, hot paths.' },
    { id: 'crystal_inspector', icon: '🔮', label: 'Crystal Inspector', category: 'substrate', description: 'Deep-inspect any substrate record — metadata, lineage, scores.' },
    { id: 'yoke_bus', icon: '🔗', label: 'Yoke Bus', category: 'agent', description: 'CAI Yoke channel — message queue, agent handoffs, routing.' },
    { id: 'federation_peers', icon: '🌐', label: 'Federation Peers', category: 'substrate', description: 'Connected cooperative peers — sync status, record exchange.' },
    { id: 'k533_history', icon: '📜', label: 'K533 History', category: 'activity', description: 'Wave archive — all dispatched waves, results, synthesis receipts.' },
    { id: 'ip_ledger', icon: '⚖️', label: 'IP Ledger', category: 'ledger', description: 'Cooperative IP registry — claims, supersedes-chains, disputes.' },
    { id: 'three_currency', icon: '💰', label: 'Three-Currency', category: 'ledger', description: 'Creator earnings · Platform margin · Member savings.' },
    { id: 'initiative_board', icon: '🌳', label: 'Initiative Board', category: 'custom', description: 'Sweet Sixteen initiative tracker — activity, milestones.' },
];
