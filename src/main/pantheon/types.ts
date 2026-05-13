// Pantheon — Pixie Dust Mining types
// BP041 Founder direct: 6 agent personas, Iron/Stone Tablets, member sovereignty
// Canon: project_pixie_dust_mining_doctrine_bp041.md

import { homedir } from 'os';
import { resolve } from 'path';

// ─── Substrate paths ──────────────────────────────────────────────────────────

export const LB_SUBSTRATE_ROOT =
  process.env.LB_SUBSTRATE_ROOT ?? resolve(homedir(), '.lb_substrate');

export const TABLETS_ROOT = resolve(LB_SUBSTRATE_ROOT, 'tablets');
export const PANTHEON_SESSIONS_DIR = resolve(LB_SUBSTRATE_ROOT, 'pantheon', 'sessions');
export const FOLDER_PREFS_PATH = resolve(LB_SUBSTRATE_ROOT, 'pantheon', 'folder_prefs.json');

// ─── Tablet grades ────────────────────────────────────────────────────────────

/** Iron = mutable; can be updated as source changes */
export type TabletGrade = 'iron' | 'stone';

/** Sharing scope for the tablet and its source folder */
export type SharingScope = 'private' | 'federation';

// ─── Persona identifiers ──────────────────────────────────────────────────────

export type PersonaId =
  | 'miner'
  | 'fates'
  | 'forager'
  | 'pixies'
  | 'shadow_spider'
  | 'shadow_sprite';

export const PERSONA_META: Record<PersonaId, { icon: string; label: string; description: string }> = {
  miner: { icon: '🛠️', label: 'Miners', description: 'Extract structured data → Iron Tablets' },
  fates: { icon: '🧶', label: 'Fates', description: 'Detect patterns → Stone Tablets; promote Iron→Stone' },
  forager: { icon: '🦊', label: 'Foragers', description: 'Inventory scan → Iron Tablets' },
  pixies: { icon: '🧚', label: 'Pixies', description: 'Micro-attribution dusting → Pheromone dust' },
  shadow_spider: { icon: '🕷️', label: 'Shadow E-Spiders', description: 'Deep recursive crawl → Iron Tablets' },
  shadow_sprite: { icon: '🧝', label: 'Shadow E-Sprites', description: 'Nimble first-look → triage Iron Tablets' },
};

// ─── Eblet / Tablet schema ────────────────────────────────────────────────────

/** A single Eblet — the substrate's atomic unit of knowledge */
export interface Eblet {
  tablet_id: string;
  tablet_grade: TabletGrade;
  agent_persona: PersonaId;
  member_id: string;
  source_path: string;
  /** Source file type (file_metadata / directory_manifest / attribution_dust / pattern / etc.) */
  content_type: string;
  title: string;
  content: string;
  mined_at: string;
  sharing_scope: SharingScope;
  /** Chain back to the Iron Tablet this Stone Tablet supersedes (Fates only) */
  supersedes?: string;
  tags?: string[];
}

// ─── AgentPersona interface ───────────────────────────────────────────────────

/** The interface every Pantheon persona must satisfy */
export interface AgentPersona {
  id: PersonaId;
  displayName: string;
  icon: string;
  /**
   * Scan a folder and generate Eblets.
   * Emits progress events via the provided callback.
   * Returns array of Eblets; caller persists them via tablet_store.
   */
  scan(
    folderPath: string,
    memberId: string,
    opts: PersonaScanOpts,
  ): Promise<Eblet[]>;
}

export interface PersonaScanOpts {
  sharingScope: SharingScope;
  /** Max files to process (prevents runaway on enormous dirs) */
  maxFiles?: number;
  onProgress?: (evt: PersonaProgressEvent) => void;
}

export interface PersonaProgressEvent {
  persona: PersonaId;
  phase: 'scanning' | 'generating' | 'done' | 'error';
  message: string;
  tablets_written?: number;
  error?: string;
}

// ─── Pantheon orchestrator I/O ────────────────────────────────────────────────

export interface PantheonDispatchRequest {
  member_id: string;
  folder_path: string;
  sharing_scope: SharingScope;
  /** Optional subset of personas to run; default = all 6 */
  personas?: PersonaId[];
  session?: string;
}

export interface PantheonPersonaResult {
  persona: PersonaId;
  tablets_written: number;
  iron_count: number;
  stone_count: number;
  duration_ms: number;
  errors: string[];
}

export interface PantheonDispatchReceipt {
  session_id: string;
  member_id: string;
  folder_path: string;
  sharing_scope: SharingScope;
  started_at: string;
  completed_at: string;
  total_tablets: number;
  iron_tablets: number;
  stone_tablets: number;
  persona_results: PantheonPersonaResult[];
  errors: string[];
}

// ─── Progress event (emitted to renderer via IPC) ─────────────────────────────

export interface PantheonIpcProgress {
  session_id: string;
  persona: PersonaId;
  persona_label: string;
  persona_icon: string;
  phase: PersonaProgressEvent['phase'];
  message: string;
  tablets_written?: number;
  total_so_far?: number;
}
