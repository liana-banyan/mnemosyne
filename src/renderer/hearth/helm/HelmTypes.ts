// SAGA 5 — HELM VIEW Types
// Bridge canon: 8-station CAI Bridge (project_cai_conducted_ai_bridge_canon_bp041)
// Founder-coined names locked per R-FOUNDER-NAMING-PROVENANCE:
//   HELM VIEW · Deck Cards · Helm Decks Library · The Conductor · Bridge · Station

export type CardId =
  | 'in_conjunction'
  | 'active_substrate'
  | 'on_deck'
  | 'banyan_metric'
  | 'drekaskip'
  | 'my_tablets'
  | 'hearth_pantheon'
  | 'pheromone_stream'
  | 'crystal_inspector'
  | 'yoke_bus'
  | 'federation_peers'
  | 'k533_history'
  | 'ip_ledger'
  | 'three_currency'
  | 'initiative_board';

export type CardCategory = 'substrate' | 'activity' | 'agent' | 'ledger' | 'custom';

export interface CardMeta {
  id: CardId;
  icon: string;
  label: string;
  category: CardCategory;
  description: string;
}

// Bridge station identities (8-station CAI Bridge canon)
export type StationId =
  | 'helm'        // 🎯 primary — Prove It! tab
  | 'charts'      // 📜 Substrate tab
  | 'comms'       // 📡 In Conjunction
  | 'engineering' // ⚙️ Active Substrate + Drekaskip
  | 'lookouts'    // 🔭 future
  | 'quartermaster' // 🧭 On Deck
  | 'logs'        // 📋 K533/wave_archive
  | 'crows_nest'; // 🌌 future

export const STATION_META: Record<StationId, { icon: string; label: string }> = {
  helm:         { icon: '🎯', label: 'Helm' },
  charts:       { icon: '📜', label: 'Charts' },
  comms:        { icon: '📡', label: 'Comms' },
  engineering:  { icon: '⚙️', label: 'Engineering' },
  lookouts:     { icon: '🔭', label: 'Lookouts' },
  quartermaster:{ icon: '🧭', label: 'Quartermaster' },
  logs:         { icon: '📋', label: 'Logs' },
  crows_nest:   { icon: '🌌', label: "Crow's Nest" },
};

export type ShelfId = 'left' | 'right' | 'bottom';

export type PresetName = 'Default' | 'Power user' | 'Pure substrate' | 'Watch mode';

export interface ShelfLayout {
  cards: CardId[];
  collapsed: boolean;
  size?: number;
}

export interface HelmLayout {
  shelves: Record<ShelfId, ShelfLayout>;
  preset: PresetName;
  version: 1;
}

export const DEFAULT_HELM_LAYOUT: HelmLayout = {
  shelves: {
    left:   { cards: [], collapsed: true },
    right:  { cards: ['in_conjunction', 'active_substrate'], collapsed: false },
    bottom: { cards: ['drekaskip'], collapsed: false, size: 260 },
  },
  preset: 'Default',
  version: 1,
};

export const PRESET_LAYOUTS: Record<PresetName, HelmLayout> = {
  'Default': DEFAULT_HELM_LAYOUT,
  'Power user': {
    shelves: {
      left:   { cards: ['my_tablets', 'pheromone_stream'], collapsed: false },
      right:  { cards: ['in_conjunction', 'active_substrate', 'yoke_bus'], collapsed: false },
      bottom: { cards: ['drekaskip', 'k533_history'], collapsed: false, size: 320 },
    },
    preset: 'Power user',
    version: 1,
  },
  'Pure substrate': {
    shelves: {
      left:   { cards: [], collapsed: true },
      right:  { cards: ['active_substrate', 'banyan_metric'], collapsed: false },
      bottom: { cards: ['drekaskip'], collapsed: false, size: 200 },
    },
    preset: 'Pure substrate',
    version: 1,
  },
  'Watch mode': {
    shelves: {
      left:   { cards: [], collapsed: true },
      right:  { cards: ['active_substrate'], collapsed: false },
      bottom: { cards: ['drekaskip'], collapsed: false, size: 160 },
    },
    preset: 'Watch mode',
    version: 1,
  },
};
