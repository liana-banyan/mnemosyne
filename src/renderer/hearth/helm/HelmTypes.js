// SAGA 5 — HELM VIEW Types
// Bridge canon: 8-station CAI Bridge (project_cai_conducted_ai_bridge_canon_bp041)
// Founder-coined names locked per R-FOUNDER-NAMING-PROVENANCE:
//   HELM VIEW · Deck Cards · Helm Decks Library · The Conductor · Bridge · Station
export const STATION_META = {
    helm: { icon: '🎯', label: 'Helm' },
    charts: { icon: '📜', label: 'Charts' },
    comms: { icon: '📡', label: 'Comms' },
    engineering: { icon: '⚙️', label: 'Engineering' },
    lookouts: { icon: '🔭', label: 'Lookouts' },
    quartermaster: { icon: '🧭', label: 'Quartermaster' },
    logs: { icon: '📋', label: 'Logs' },
    crows_nest: { icon: '🌌', label: "Crow's Nest" },
};
export const DEFAULT_HELM_LAYOUT = {
    shelves: {
        left: { cards: [], collapsed: true },
        right: { cards: ['in_conjunction', 'active_substrate'], collapsed: false },
        bottom: { cards: ['drekaskip'], collapsed: false, size: 260 },
    },
    preset: 'Default',
    version: 1,
};
export const PRESET_LAYOUTS = {
    'Default': DEFAULT_HELM_LAYOUT,
    'Power user': {
        shelves: {
            left: { cards: ['my_tablets', 'pheromone_stream'], collapsed: false },
            right: { cards: ['in_conjunction', 'active_substrate', 'yoke_bus'], collapsed: false },
            bottom: { cards: ['drekaskip', 'k533_history'], collapsed: false, size: 320 },
        },
        preset: 'Power user',
        version: 1,
    },
    'Pure substrate': {
        shelves: {
            left: { cards: [], collapsed: true },
            right: { cards: ['active_substrate', 'banyan_metric'], collapsed: false },
            bottom: { cards: ['drekaskip'], collapsed: false, size: 200 },
        },
        preset: 'Pure substrate',
        version: 1,
    },
    'Watch mode': {
        shelves: {
            left: { cards: [], collapsed: true },
            right: { cards: ['active_substrate'], collapsed: false },
            bottom: { cards: ['drekaskip'], collapsed: false, size: 160 },
        },
        preset: 'Watch mode',
        version: 1,
    },
};
