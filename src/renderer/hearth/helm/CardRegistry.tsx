// SAGA 5 — HELM VIEW: Card Registry
// Maps CardId → React component + metadata catalog.
// All cards listed in project_helm_view_collapsible_shelves_deck_card_swap_bp041.

import type { CardId, CardMeta } from './HelmTypes';
import { ConjunctionPanel } from '../conjunction/ConjunctionPanel';
import { useConjunction } from '../conjunction/conjunction_state';
import { ActiveSubstratePanel } from '../active_substrate/ActiveSubstratePanel';
import { DrekaskipStatusPanel } from '../drekaskip_status/DrekaskipStatusPanel';
import { OnDeckPanel } from '../on_deck/OnDeckPanel';

// ── Placeholder card for not-yet-built cards ────────────────────────────────
function PlaceholderCard({ icon, label, desc }: { icon: string; label: string; desc: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: '0.5rem', color: '#718096', padding: '1.5rem', height: '100%', textAlign: 'center',
    }}>
      <span style={{ fontSize: '2rem' }}>{icon}</span>
      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#a0aec0' }}>{label}</span>
      <span style={{ fontSize: '0.72rem', lineHeight: 1.5, maxWidth: 260 }}>{desc}</span>
      <span style={{ fontSize: '0.65rem', color: '#4a5568', marginTop: '0.25rem' }}>Coming soon · SAGA 5+</span>
    </div>
  );
}

// ── Card components ──────────────────────────────────────────────────────────
// InConjunctionCard reads from ConjunctionContext (always provided by HearthConjunctionWindow).
const InConjunctionCard = () => {
  const { panelState, selectMode, probeAgent, tierChoices, apiKeyStatus, agents, probeMap, setTierChoice, openApiKeySettings } = useConjunction();
  return (
    <ConjunctionPanel
      panelState={panelState}
      agents={agents}
      probeMap={probeMap}
      tierChoices={tierChoices}
      apiKeyStatus={apiKeyStatus}
      onSelect={selectMode}
      onProbeAgent={probeAgent}
      onTierChange={setTierChoice}
      onOpenApiKeySettings={openApiKeySettings}
    />
  );
};

const ActiveSubstrateCard = () => <ActiveSubstratePanel />;
const DrekaskipCard = () => <DrekaskipStatusPanel />;
const OnDeckCard = () => <OnDeckPanel />;

const BanyanMetricCard = () => <PlaceholderCard icon="📊" label="Banyan Metric" desc="Cooperative platform metrics — member activity, wave volume, cost avoided." />;
const MyTabletsCard = () => <PlaceholderCard icon="📋" label="My Tablets" desc="Your personal substrate tablets — notes, decisions, and session anchors." />;
const HearthPantheonCard = () => <PlaceholderCard icon="🏛️" label="Hearth Pantheon" desc="All active Pantheon agents — their status, queue depth, and last dispatch." />;
const PheromoneStreamCard = () => <PlaceholderCard icon="🌿" label="Pheromone Stream" desc="Live pheromone trail — recent retrieval hits, weight updates, hot paths." />;
const CrystalInspectorCard = () => <PlaceholderCard icon="🔮" label="Crystal Inspector" desc="Deep-inspect any substrate record — full metadata, lineage, and scores." />;
const YokeBusCard = () => <PlaceholderCard icon="🔗" label="Yoke Bus" desc="CAI Yoke channel monitor — message queue, agent handoffs, Conductor routing." />;
const FederationPeersCard = () => <PlaceholderCard icon="🌐" label="Federation Peers" desc="Connected cooperative peers — sync status, latency, record exchange counts." />;
const K533HistoryCard = () => <PlaceholderCard icon="📜" label="K533 History" desc="Wave archive — all dispatched waves, results, and synthesis receipts." />;
const IpLedgerCard = () => <PlaceholderCard icon="⚖️" label="IP Ledger" desc="Cooperative IP registry — claims, supersedes-chains, and dispute status." />;
const ThreeCurrencyCard = () => <PlaceholderCard icon="💰" label="Three-Currency" desc="Creator earnings · Platform margin · Member savings — live ledger view." />;
const InitiativeBoardCard = () => <PlaceholderCard icon="🌳" label="Initiative Board" desc="Sweet Sixteen initiative tracker — activity, participation, milestones." />;

// ── Registry ────────────────────────────────────────────────────────────────

export const CARD_COMPONENTS: Record<CardId, React.ComponentType> = {
  in_conjunction:   InConjunctionCard,
  active_substrate: ActiveSubstrateCard,
  on_deck:          OnDeckCard,
  banyan_metric:    BanyanMetricCard,
  drekaskip:        DrekaskipCard,
  my_tablets:       MyTabletsCard,
  hearth_pantheon:  HearthPantheonCard,
  pheromone_stream: PheromoneStreamCard,
  crystal_inspector:CrystalInspectorCard,
  yoke_bus:         YokeBusCard,
  federation_peers: FederationPeersCard,
  k533_history:     K533HistoryCard,
  ip_ledger:        IpLedgerCard,
  three_currency:   ThreeCurrencyCard,
  initiative_board: InitiativeBoardCard,
};

export const CARD_META_LIST: CardMeta[] = [
  { id: 'in_conjunction',   icon: '📡', label: 'In Conjunction',    category: 'agent',     description: '8-agent CAI Bridge panel — select and dispatch AI modes.' },
  { id: 'active_substrate', icon: '🔬', label: 'Active Substrate',  category: 'substrate', description: 'Live scribe monitor — substrate metrics, flip-card detail.' },
  { id: 'drekaskip',        icon: '🌊', label: 'Drekaskip',         category: 'activity',  description: 'Wave status panel — live SEG progression and dispatch receipts.' },
  { id: 'on_deck',          icon: '🧭', label: 'On Deck',           category: 'activity',  description: 'Task queue staging — pending Mnemosyne work items.' },
  { id: 'banyan_metric',    icon: '📊', label: 'Banyan Metric',     category: 'ledger',    description: 'Cooperative platform metrics — member activity, cost avoided.' },
  { id: 'my_tablets',       icon: '📋', label: 'My Tablets',        category: 'substrate', description: 'Personal substrate tablets — notes, decisions, session anchors.' },
  { id: 'hearth_pantheon',  icon: '🏛️', label: 'Hearth Pantheon',  category: 'agent',     description: 'Active Pantheon agents — status, queue depth, last dispatch.' },
  { id: 'pheromone_stream', icon: '🌿', label: 'Pheromone Stream',  category: 'substrate', description: 'Live pheromone trail — retrieval hits, weight updates, hot paths.' },
  { id: 'crystal_inspector',icon: '🔮', label: 'Crystal Inspector', category: 'substrate', description: 'Deep-inspect any substrate record — metadata, lineage, scores.' },
  { id: 'yoke_bus',         icon: '🔗', label: 'Yoke Bus',          category: 'agent',     description: 'CAI Yoke channel — message queue, agent handoffs, routing.' },
  { id: 'federation_peers', icon: '🌐', label: 'Federation Peers',  category: 'substrate', description: 'Connected cooperative peers — sync status, record exchange.' },
  { id: 'k533_history',     icon: '📜', label: 'K533 History',      category: 'activity',  description: 'Wave archive — all dispatched waves, results, synthesis receipts.' },
  { id: 'ip_ledger',        icon: '⚖️', label: 'IP Ledger',         category: 'ledger',    description: 'Cooperative IP registry — claims, supersedes-chains, disputes.' },
  { id: 'three_currency',   icon: '💰', label: 'Three-Currency',    category: 'ledger',    description: 'Creator earnings · Platform margin · Member savings.' },
  { id: 'initiative_board', icon: '🌳', label: 'Initiative Board',  category: 'custom',    description: 'Sweet Sixteen initiative tracker — activity, milestones.' },
];

// Re-export CardMeta type for convenience
export type { CardMeta };
