/**
 * diagnosis_types.ts — The Diagnosis v0.4.1 BP083
 *
 * NYT-column model: persistent questions broadcast to human Members.
 * Bounty paid via Substitution Rails (Fiat/Marks/Barter).
 * REGULATORY HYGIENE (BP051 Saladin's Pattern — NON-NEGOTIABLE):
 *   medical/legal/financial domains MUST show informational-only disclaimer.
 * v0.4.1: Salt Level persistence tiers (Pinch / Seasoning / Preserved).
 */

// ─── Salt Level persistence tiers (v0.4.1) ───────────────────────────────────

export type SaltLevel = 'pinch' | 'seasoning' | 'preserved_open' | 'preserved_forever';

export interface SaltLevelConfig {
  level: SaltLevel;
  label: string;
  icon: string;
  description: string;
  autoExpiry?: number;         // ms — undefined = no auto-expiry
  networkScope: 'local' | 'constellation' | 'cross-cathedral';
  autoEscalateAfter?: number;  // ms — Seasoning: escalate to Diagnosis after this window
}

export const SALT_LEVEL_CONFIGS: Record<SaltLevel, SaltLevelConfig> = {
  pinch: {
    level: 'pinch',
    label: 'A Pinch of Salt',
    icon: '🧂',
    description: 'Quick local answer · ephemeral · no network',
    networkScope: 'local',
  },
  seasoning: {
    level: 'seasoning',
    label: 'Seasoning',
    icon: '🌿',
    description: 'Ask + Linger · Constellation keeps working · 24h–1 week',
    autoExpiry: 7 * 24 * 60 * 60 * 1000,        // 1 week max
    autoEscalateAfter: 24 * 60 * 60 * 1000,      // 24h before auto-escalating to Diagnosis
    networkScope: 'constellation',
  },
  preserved_open: {
    level: 'preserved_open',
    label: 'Preserved in Salt',
    icon: '🫙',
    description: 'Post as Diagnosis · open until answered · optional bounty',
    networkScope: 'cross-cathedral',
  },
  preserved_forever: {
    level: 'preserved_forever',
    label: 'Preserved Forever',
    icon: '♾️',
    description: 'Canon-class archival · never auto-deletes · 1-year pheromone-fade → Catacomb',
    autoExpiry: 365 * 24 * 60 * 60 * 1000,       // 1 year → Catacomb relocation
    networkScope: 'cross-cathedral',
  },
};

// ─── Domain types ─────────────────────────────────────────────────────────────

export type DiagnosisDomain =
  | 'medical'
  | 'mechanical'
  | 'practical'
  | 'legal'
  | 'financial'
  | 'scientific'
  | 'historical'
  | 'other';

export type DiagnosisStatus = 'open' | 'answered' | 'resolved' | 'expired';

export type SubstitutionRail = 'fiat' | 'marks' | 'barter';

export interface DiagnosisBounty {
  rail: SubstitutionRail;
  amount: number;
  barterDescription?: string;
}

export interface DiagnosisPost {
  id: string;
  question: string;
  domain: DiagnosisDomain;
  context: string;
  priorAttempts: string;
  bounty: DiagnosisBounty;
  visibility: 'lan' | 'constellation' | 'cross-cathedral';
  saltLevel: SaltLevel;        // v0.4.1: persistence tier
  noAutoExpiry?: boolean;      // v0.4.1: preserved_forever flag
  posterId: string;
  posterName?: string;
  timestamp: number;
  status: DiagnosisStatus;
  answers: DiagnosisAnswer[];
  acceptedAnswerId?: string;
  source?: string; // 'manual' | 'andon_auto_escalation' | 'seasoning_auto_escalation'
}

export interface DiagnosisAnswer {
  id: string;
  diagnosisId: string;
  responderId: string;
  responderName?: string;
  answerText: string;
  sources: string[];
  credentials?: string;
  timestamp: number;
  upvotes: number;
}

export interface DiagnosisCreateInput {
  question: string;
  domain: DiagnosisDomain;
  context: string;
  priorAttempts: string;
  bounty: DiagnosisBounty;
  visibility: DiagnosisPost['visibility'];
  saltLevel?: SaltLevel;       // v0.4.1: defaults to 'preserved_open'
  posterName?: string;
  source?: string;
}

// ─── Regulatory disclaimers (NON-NEGOTIABLE BP051) ───────────────────────────

export const DOMAIN_DISCLAIMERS: Record<DiagnosisDomain, string> = {
  medical:
    '⚠️ INFORMATIONAL ONLY — not medical advice. Responses from peers are not from licensed medical professionals unless explicitly disclosed. Consult a licensed healthcare provider for all medical decisions. In an emergency, call 911.',
  legal:
    '⚠️ INFORMATIONAL ONLY — not legal advice. Responses are not from licensed attorneys unless explicitly disclosed. Consult a licensed attorney for all legal matters.',
  financial:
    '⚠️ INFORMATIONAL ONLY — not financial advice. Responses are not from licensed financial advisors unless explicitly disclosed. Consult a licensed financial professional for all financial decisions.',
  mechanical:
    'ℹ️ Information shared by cooperative peers. Verify with a qualified mechanic or engineer before acting on any mechanical advice.',
  practical: '',
  scientific: '',
  historical: '',
  other: '',
};

export const DOMAIN_LABELS: Record<DiagnosisDomain, string> = {
  medical: '🏥 Medical',
  mechanical: '🔧 Mechanical',
  practical: '🛠️ Practical',
  legal: '⚖️ Legal',
  financial: '💰 Financial',
  scientific: '🔬 Scientific',
  historical: '📜 Historical',
  other: '💬 Other',
};
