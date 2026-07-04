// TheDiagnosisTab.tsx — The Diagnosis v0.4.1 BP083
// NYT-column model: broadcast unresolved questions to human Members.
// "🧂 Just Add Salt · Ask the Network" — Human Salt is the 3rd layer.
//
// REGULATORY HYGIENE (BP051 NON-NEGOTIABLE):
//   medical/legal/financial domains show informational-only disclaimer.
// SUBSTITUTION CANON: Marks bounties only in v0.4.0 (Fiat deferred to v0.4.1).

import React, { useState, useEffect, useCallback } from 'react';
import { SaltLevelSelector, type SaltLevel, SALT_LEVEL_CONFIGS } from './SaltLevelSelector';
import { getGlowTier, getGlowClass } from '../utils/glow_tier';

// ─── Inline types (shared with diagnosis_types.ts in main process) ────────────

export type DiagnosisDomain =
  | 'medical' | 'mechanical' | 'practical' | 'legal'
  | 'financial' | 'scientific' | 'historical' | 'other';

export type SubstitutionRail = 'fiat' | 'marks' | 'barter';

export interface DiagnosisBounty {
  rail: SubstitutionRail;
  amount: number;
  barterDescription?: string;
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

export interface DiagnosisPost {
  id: string;
  question: string;
  domain: DiagnosisDomain;
  context: string;
  priorAttempts: string;
  bounty: DiagnosisBounty;
  visibility: 'lan' | 'constellation' | 'cross-cathedral';
  saltLevel?: SaltLevel;
  noAutoExpiry?: boolean;
  posterId: string;
  posterName?: string;
  timestamp: number;
  status: 'open' | 'answered' | 'resolved' | 'expired';
  answers: DiagnosisAnswer[];
  acceptedAnswerId?: string;
}

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

// ─── Styles ────────────────────────────────────────────────────────────────────

const S = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
    overflowY: 'auto' as const,
    padding: '20px 20px 32px',
    background: '#0a0f1a',
    color: '#e2e8f0',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    gap: 16,
  },
  header: { display: 'flex', flexDirection: 'column' as const, gap: 4 },
  title: { fontSize: 18, fontWeight: 700, color: '#6ee7b7', margin: 0 },
  tagline: { fontSize: 12, color: '#64748b', margin: 0 },
  modeToggle: { display: 'flex', gap: 8 },
  modeBtn: (active: boolean): React.CSSProperties => ({
    padding: '7px 18px',
    background: active ? 'rgba(110,231,183,0.13)' : 'none',
    border: active ? '1px solid rgba(110,231,183,0.4)' : '1px solid rgba(100,116,139,0.3)',
    borderRadius: 8,
    color: active ? '#6ee7b7' : '#94a3b8',
    fontSize: 13,
    fontWeight: active ? 600 : 400,
    cursor: 'pointer',
    fontFamily: 'inherit',
  }),
  card: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(100,116,139,0.2)',
    borderRadius: 10,
    padding: '16px 18px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 12,
  },
  label: { fontSize: 11, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.05em', textTransform: 'uppercase' as const },
  input: {
    width: '100%',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(100,116,139,0.3)',
    borderRadius: 6,
    color: '#e2e8f0',
    fontSize: 13,
    padding: '9px 12px',
    fontFamily: 'inherit',
    resize: 'vertical' as const,
    boxSizing: 'border-box' as const,
  },
  select: {
    background: 'rgba(15,23,42,0.9)',
    border: '1px solid rgba(100,116,139,0.3)',
    borderRadius: 6,
    color: '#e2e8f0',
    fontSize: 13,
    padding: '9px 12px',
    fontFamily: 'inherit',
    width: '100%',
  },
  disclaimer: {
    background: 'rgba(239,68,68,0.08)',
    border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: 6,
    padding: '10px 14px',
    fontSize: 12,
    color: '#fca5a5',
    lineHeight: 1.6,
  },
  submitBtn: (disabled: boolean): React.CSSProperties => ({
    padding: '10px 22px',
    background: disabled ? 'rgba(110,231,183,0.04)' : 'rgba(110,231,183,0.13)',
    border: disabled ? '1px solid rgba(110,231,183,0.15)' : '1px solid rgba(110,231,183,0.4)',
    borderRadius: 8,
    color: disabled ? '#475569' : '#6ee7b7',
    fontSize: 14,
    fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'inherit',
    alignSelf: 'flex-start',
  }),
  diagnosisItem: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(100,116,139,0.2)',
    borderRadius: 10,
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 8,
    cursor: 'pointer' as const,
  },
  tag: (color: string): React.CSSProperties => ({
    display: 'inline-block',
    background: `rgba(${color}, 0.1)`,
    border: `1px solid rgba(${color}, 0.3)`,
    borderRadius: 4,
    padding: '2px 8px',
    fontSize: 11,
    color: `rgb(${color})`,
    fontWeight: 600,
  }),
  answerCard: {
    background: 'rgba(110,231,183,0.04)',
    border: '1px solid rgba(110,231,183,0.15)',
    borderRadius: 8,
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 6,
  },
  emptyState: { color: '#475569', fontSize: 13, textAlign: 'center' as const, padding: '32px 0' },
};

const DOMAIN_OPTIONS: Array<{ value: DiagnosisDomain; label: string }> = [
  { value: 'medical', label: '🏥 Medical' },
  { value: 'mechanical', label: '🔧 Mechanical' },
  { value: 'practical', label: '🛠️ Practical' },
  { value: 'legal', label: '⚖️ Legal' },
  { value: 'financial', label: '💰 Financial' },
  { value: 'scientific', label: '🔬 Scientific' },
  { value: 'historical', label: '📜 Historical' },
  { value: 'other', label: '💬 Other' },
];

// ─── PostDiagnosisForm ────────────────────────────────────────────────────────

function PostDiagnosisForm() {
  const [question, setQuestion] = useState('');
  const [domain, setDomain] = useState<DiagnosisDomain>('other');
  const [context, setContext] = useState('');
  const [priorAttempts, setPriorAttempts] = useState('');
  const [bountyAmount, setBountyAmount] = useState(5);
  const [bountyRail, setBountyRail] = useState<DiagnosisBounty['rail']>('marks');
  const [barterDesc, setBarterDesc] = useState('');
  const [visibility, setVisibility] = useState<DiagnosisPost['visibility']>('constellation');
  // v0.4.1: Salt Level — default preserved_open for Diagnosis form
  const [saltLevel, setSaltLevel] = useState<SaltLevel>('preserved_open');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const disclaimer = DOMAIN_DISCLAIMERS[domain];
  const canSubmit = question.trim().length >= 10 && !submitting;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await window.amplify?.diagnosisPost?.({
        question: question.trim(),
        domain,
        context: context.trim(),
        priorAttempts: priorAttempts.trim(),
        bounty: {
          rail: bountyRail,
          amount: bountyAmount,
          barterDescription: bountyRail === 'barter' ? barterDesc : undefined,
        },
        visibility,
        saltLevel,
        source: 'manual',
      }) as { ok: boolean; id?: string; error?: string } | undefined;

      if (result?.ok) {
        setSubmitted(true);
      } else {
        setError(result?.error ?? 'Unknown error');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setSubmitting(false);
    }
  }, [question, domain, context, priorAttempts, bountyRail, bountyAmount, barterDesc, visibility, canSubmit]);

  if (submitted) {
    return (
      <div style={S.card}>
        <p style={{ color: '#6ee7b7', fontSize: 14, margin: 0 }}>
          ✅ Your Diagnosis has been posted to the Constellation.
        </p>
        <p style={{ color: '#94a3b8', fontSize: 12, margin: 0 }}>
          🧂 Just Add Salt — your question is now circulating to peers who may have the answer.
          You'll be notified when someone responds.
        </p>
        <button style={S.submitBtn(false)} onClick={() => { setSubmitted(false); setQuestion(''); setContext(''); setPriorAttempts(''); }}>
          Post another
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={S.card}>
        {/* Question */}
        <div>
          <div style={S.label}>Question <span style={{ color: '#ef4444' }}>*</span></div>
          <textarea
            style={{ ...S.input, minHeight: 80 }}
            placeholder="What question do you need the network's help answering?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            maxLength={2000}
          />
          <div style={{ fontSize: 11, color: '#475569', textAlign: 'right' }}>{question.length}/2000</div>
        </div>

        {/* Domain */}
        <div>
          <div style={S.label}>Domain</div>
          <select style={S.select} value={domain} onChange={(e) => setDomain(e.target.value as DiagnosisDomain)}>
            {DOMAIN_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Disclaimer — shown prominently for regulated domains */}
        {disclaimer && (
          <div style={S.disclaimer}>{disclaimer}</div>
        )}

        {/* Context */}
        <div>
          <div style={S.label}>Context <span style={{ color: '#64748b' }}>(optional)</span></div>
          <textarea
            style={{ ...S.input, minHeight: 60 }}
            placeholder="What's the situation? Any relevant background?"
            value={context}
            onChange={(e) => setContext(e.target.value)}
            maxLength={1000}
          />
        </div>

        {/* Prior attempts */}
        <div>
          <div style={S.label}>What have you tried? <span style={{ color: '#64748b' }}>(optional)</span></div>
          <textarea
            style={{ ...S.input, minHeight: 60 }}
            placeholder="What sources or approaches have you already tried?"
            value={priorAttempts}
            onChange={(e) => setPriorAttempts(e.target.value)}
            maxLength={500}
          />
        </div>

        {/* Bounty */}
        <div>
          <div style={S.label}>Bounty</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select style={{ ...S.select, width: 120 }} value={bountyRail} onChange={(e) => setBountyRail(e.target.value as DiagnosisBounty['rail'])}>
              <option value="marks">Marks</option>
              <option value="fiat">Fiat (v0.4.1)</option>
              <option value="barter">Barter</option>
            </select>
            {bountyRail !== 'barter' && (
              <input
                type="number"
                style={{ ...S.input, width: 80 }}
                min={0}
                max={bountyRail === 'marks' ? 1000 : 500}
                value={bountyAmount}
                onChange={(e) => setBountyAmount(parseInt(e.target.value) || 0)}
              />
            )}
          </div>
          {bountyRail === 'fiat' && (
            <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 4 }}>
              Fiat payouts coming in v0.4.1 — use Marks or Barter for now.
            </div>
          )}
          {bountyRail === 'barter' && (
            <input
              style={{ ...S.input, marginTop: 6 }}
              placeholder="Describe what you'll trade (e.g. 'I'll answer 3 of your questions')"
              value={barterDesc}
              onChange={(e) => setBarterDesc(e.target.value)}
              maxLength={200}
            />
          )}
        </div>

        {/* v0.4.1: Salt Level selector */}
        <div>
          <div style={S.label}>Persistence</div>
          <SaltLevelSelector
            value={saltLevel}
            onChange={(lvl) => {
              setSaltLevel(lvl);
              // Auto-set visibility for preserved tiers
              if (lvl === 'preserved_open' || lvl === 'preserved_forever') {
                setVisibility('cross-cathedral');
              } else if (lvl === 'seasoning') {
                setVisibility('constellation');
              }
            }}
            showPreservedSub={saltLevel === 'preserved_open' || saltLevel === 'preserved_forever'}
          />
        </div>

        {/* Visibility (advanced override) */}
        <div>
          <div style={S.label}>Visibility</div>
          <select style={S.select} value={visibility} onChange={(e) => setVisibility(e.target.value as DiagnosisPost['visibility'])}>
            <option value="lan">🏠 LAN only (same network)</option>
            <option value="constellation">🌌 Constellation (connected peers)</option>
            <option value="cross-cathedral">🌐 Cross-Caithedral™ (all Members)</option>
          </select>
        </div>

        {error && (
          <div style={{ color: '#ef4444', fontSize: 12 }}>Error: {error}</div>
        )}

        <button style={S.submitBtn(!canSubmit)} onClick={handleSubmit} disabled={!canSubmit}>
          {submitting ? 'Posting…' : '📤 Post Diagnosis'}
        </button>
      </div>
    </div>
  );
}

// ─── IncomingDiagnosisInbox ────────────────────────────────────────────────────

function IncomingDiagnosisInbox() {
  const [diagnoses, setDiagnoses] = useState<DiagnosisPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<DiagnosisPost | null>(null);
  const [answerText, setAnswerText] = useState('');
  const [sources, setSources] = useState('');
  const [credentials, setCredentials] = useState('');
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [answerResult, setAnswerResult] = useState<string | null>(null);

  const loadDiagnoses = useCallback(async () => {
    setLoading(true);
    try {
      const result = await window.amplify?.diagnosisList?.({ status: 'open' }) as { ok: boolean; posts?: DiagnosisPost[] } | undefined;
      setDiagnoses(result?.posts ?? []);
    } catch {
      setDiagnoses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadDiagnoses(); }, [loadDiagnoses]);

  // Listen for incoming Diagnoses
  useEffect(() => {
    const unsub = window.amplify?.onDiagnosisIncoming?.((_data: unknown) => { void loadDiagnoses(); });
    return () => { unsub?.(); };
  }, [loadDiagnoses]);

  const handleSubmitAnswer = async () => {
    if (!selected || !answerText.trim()) return;
    setSubmittingAnswer(true);
    setAnswerResult(null);
    try {
      const result = await window.amplify?.diagnosisAnswer?.({
        diagnosisId: selected.id,
        answerText: answerText.trim(),
        sources: sources.split('\n').map((s) => s.trim()).filter(Boolean),
        credentials: credentials.trim() || undefined,
      }) as { ok: boolean; error?: string } | undefined;
      setAnswerResult(result?.ok ? 'Answer submitted!' : (result?.error ?? 'Unknown error'));
      if (result?.ok) {
        setAnswerText('');
        setSources('');
        setCredentials('');
        void loadDiagnoses();
      }
    } catch (err) {
      setAnswerResult(String(err));
    } finally {
      setSubmittingAnswer(false);
    }
  };

  const handleUpvote = async (diagnosisId: string, answerId: string) => {
    await window.amplify?.diagnosisUpvote?.({ diagnosisId, answerId });
    void loadDiagnoses();
  };

  if (loading) return <div style={S.emptyState}>Loading Diagnoses…</div>;

  if (selected) {
    const disclaimer = DOMAIN_DISCLAIMERS[selected.domain];
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <button style={S.submitBtn(false)} onClick={() => { setSelected(null); setAnswerResult(null); }}>
          ← Back to inbox
        </button>

        <div style={S.card}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={S.tag('110,231,183')}>{DOMAIN_LABELS[selected.domain]}</span>
            <span style={{ fontSize: 11, color: '#64748b' }}>{new Date(selected.timestamp).toLocaleDateString()}</span>
          </div>
          <p style={{ margin: 0, fontSize: 14, color: '#f0fdf4', fontWeight: 600 }}>{selected.question}</p>
          {selected.context && <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}><b>Context:</b> {selected.context}</p>}
          {selected.priorAttempts && <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}><b>Tried:</b> {selected.priorAttempts}</p>}
          <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
            💰 Bounty: {selected.bounty.amount} {selected.bounty.rail}
          </p>

          {disclaimer && <div style={S.disclaimer}>{disclaimer}</div>}
        </div>

        {/* Existing answers */}
        {selected.answers.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={S.label}>Existing answers ({selected.answers.length})</div>
            {selected.answers.map((answer) => (
              <div key={answer.id} style={S.answerCard}>
                <p style={{ margin: 0, fontSize: 13, color: '#e2e8f0' }}>{answer.answerText}</p>
                {answer.sources.length > 0 && (
                  <p style={{ margin: 0, fontSize: 11, color: '#64748b' }}>Sources: {answer.sources.join(', ')}</p>
                )}
                {answer.credentials && (
                  <p style={{ margin: 0, fontSize: 11, color: '#6ee7b7' }}>Credentials: {answer.credentials}</p>
                )}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button
                    style={{ ...S.submitBtn(false), padding: '4px 12px', fontSize: 12 }}
                    onClick={() => handleUpvote(selected.id, answer.id)}
                  >
                    👍 {answer.upvotes}
                  </button>
                  <span style={{ fontSize: 11, color: '#64748b' }}>{new Date(answer.timestamp).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Submit answer form */}
        <div style={S.card}>
          <div style={S.label}>Submit your answer</div>
          <textarea
            style={{ ...S.input, minHeight: 80 }}
            placeholder="Share what you know. Be specific and cite sources where possible."
            value={answerText}
            onChange={(e) => setAnswerText(e.target.value)}
          />
          <textarea
            style={{ ...S.input, minHeight: 40 }}
            placeholder="Sources (one per line, optional)"
            value={sources}
            onChange={(e) => setSources(e.target.value)}
          />
          <input
            style={S.input}
            placeholder="Your credentials or expertise (optional, but builds trust)"
            value={credentials}
            onChange={(e) => setCredentials(e.target.value)}
          />
          {answerResult && (
            <div style={{ fontSize: 12, color: answerResult.startsWith('Error') ? '#ef4444' : '#6ee7b7' }}>
              {answerResult}
            </div>
          )}
          <button style={S.submitBtn(!answerText.trim() || submittingAnswer)} onClick={handleSubmitAnswer} disabled={!answerText.trim() || submittingAnswer}>
            {submittingAnswer ? 'Submitting…' : '📥 Submit Answer'}
          </button>
        </div>
      </div>
    );
  }

  if (diagnoses.length === 0) {
    return (
      <div style={S.emptyState}>
        No open Diagnoses from your Constellation yet.<br />
        <span style={{ fontSize: 12, color: '#334155' }}>Connect with peers to see their questions here.</span>
      </div>
    );
  }

  // v0.4.1: sort by glow tier descending (golden → bright → visible → dim → none)
  const GLOW_TIER_ORDER_LOCAL: Record<string, number> = { golden: 5, bright: 4, visible: 3, dim: 2, none: 1 };
  const sortedDiagnoses = [...diagnoses].sort((a, b) => {
    const tierA = getGlowTier(a.bounty?.amount ?? 0);
    const tierB = getGlowTier(b.bounty?.amount ?? 0);
    return (GLOW_TIER_ORDER_LOCAL[tierB] ?? 1) - (GLOW_TIER_ORDER_LOCAL[tierA] ?? 1);
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={S.label}>Open Diagnoses ({diagnoses.length})</div>
        {/* v0.4.1: Visibility canon — MUST be displayed per Heart of Peace BP051 */}
        <div style={{ fontSize: 10, color: '#475569', fontStyle: 'italic' }}
          title="All Diagnoses are visible regardless of glow. Glow surfaces attention, never restricts access.">
          All visible · glow = attention ✦
        </div>
      </div>
      {sortedDiagnoses.map((d) => {
        const glowTier = getGlowTier(d.bounty?.amount ?? 0);
        const glowClass = getGlowClass(glowTier);
        return (
          <div
            key={d.id}
            className={`diagnosis-card ${glowClass}`}
            style={S.diagnosisItem}
            onClick={() => setSelected(d)}
          >
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={S.tag('110,231,183')}>{DOMAIN_LABELS[d.domain]}</span>
              <span style={{ fontSize: 11, color: '#64748b' }}>{new Date(d.timestamp).toLocaleDateString()}</span>
              {d.answers.length > 0 && (
                <span style={S.tag('251,191,36')}>💬 {d.answers.length} answer{d.answers.length !== 1 ? 's' : ''}</span>
              )}
              {glowTier === 'golden' && (
                <span style={{ fontSize: 11, color: '#fbbf24', fontWeight: 700 }}>🗝️ Golden Key</span>
              )}
              {d.saltLevel && d.saltLevel !== 'preserved_open' && (
                <span style={{ fontSize: 10, color: '#64748b' }}>
                  {SALT_LEVEL_CONFIGS[d.saltLevel]?.icon} {SALT_LEVEL_CONFIGS[d.saltLevel]?.label}
                </span>
              )}
            </div>
            <p style={{ margin: 0, fontSize: 13, color: '#e2e8f0', lineHeight: 1.5 }}>
              {d.question.slice(0, 120)}{d.question.length > 120 ? '…' : ''}
            </p>
            <p style={{ margin: 0, fontSize: 11, color: '#475569' }}>
              💰 {d.bounty.amount} {d.bounty.rail} · {d.visibility}
            </p>
          </div>
        );
      })}
    </div>
  );
}

// ─── TheDiagnosisTab ──────────────────────────────────────────────────────────

// SEG-4 tagline rotation — alternates between canonical phrases
const DIAGNOSIS_TAGLINES = [
  '🧂 The Secret of Mnem... is Salt',
  '🌐 Ask the Network · Human Salt is the 3rd layer',
];

export function TheDiagnosisTab() {
  const [mode, setMode] = useState<'ask' | 'answer'>('ask');
  const [taglineIdx, setTaglineIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTaglineIdx((i) => (i + 1) % DIAGNOSIS_TAGLINES.length), 6000);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={S.container}>
      <div style={S.header}>
        <h2 style={S.title}>🩺 The Diagnosis</h2>
        <p style={S.tagline}>{DIAGNOSIS_TAGLINES[taglineIdx]}</p>
      </div>

      <div style={S.modeToggle}>
        <button style={S.modeBtn(mode === 'ask')} onClick={() => setMode('ask')}>
          📤 Ask
        </button>
        <button style={S.modeBtn(mode === 'answer')} onClick={() => setMode('answer')}>
          📥 Answer
        </button>
      </div>

      {mode === 'ask' && <PostDiagnosisForm />}
      {mode === 'answer' && <IncomingDiagnosisInbox />}
    </div>
  );
}
