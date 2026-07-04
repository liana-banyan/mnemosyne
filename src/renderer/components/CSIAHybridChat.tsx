// CSIAHybridChat.tsx -- CSIA-Hybrid Inference UI
// MnemosyneC v0.8.0 · BP094
//
// Cooperative-Substrate Inference Architecture chat surface.
// Calls window.amplify.csia.query (Electron IPC -> src/main/csia_hybrid/inference_pipeline.ts).
// Displays ANSWER/REFUSAL verdict with provenance chain and triple-verification badges.
// Renderer-native version: inline styles only (no Tailwind).

import React, { useState } from 'react';

// ---- Types (mirrored from inference_pipeline.ts) ----------------------------

interface ProvenanceLink {
  evidence_id: string;
  category_slug: string;
  content_preview: string;
  contributor_member_id: string;
  soccerball_hash?: string;
}

interface CSIAResult {
  verdict: 'ANSWER' | 'REFUSAL';
  answer?: string;
  refusal_reason?: string;
  provenance: ProvenanceLink[];
  system_prompt_used: string;
  model_used: string;
  star_chamber: 'GREEN' | 'RED' | 'SKIP';
  scrambler: 'GREEN' | 'RED' | 'SKIP';
  keys_engines: 'GREEN' | 'RED' | 'SKIP';
  green_count: number;
  run_id: string;
  elapsed_ms: number;
  evidence_count: number;
}

// ---- Styles -----------------------------------------------------------------

const S = {
  root: {
    height: '100%',
    overflowY: 'auto' as const,
    backgroundColor: '#09090b',
    color: '#f4f4f5',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    padding: '28px 24px',
    boxSizing: 'border-box' as const,
  },
  inner: {
    maxWidth: 720,
    margin: '0 auto',
  },
  header: {
    marginBottom: 28,
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  badge: {
    width: 32,
    height: 32,
    borderRadius: 6,
    background: 'rgba(245,158,11,0.15)',
    border: '1px solid rgba(245,158,11,0.35)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fbbf24',
    fontSize: 14,
    fontWeight: 700,
  },
  h1: {
    fontSize: 18,
    fontWeight: 700,
    color: '#f4f4f5',
    margin: 0,
  },
  versionPill: {
    fontSize: 11,
    fontFamily: 'monospace',
    background: 'rgba(120,53,15,0.35)',
    color: '#fcd34d',
    border: '1px solid rgba(120,53,15,0.6)',
    padding: '2px 7px',
    borderRadius: 4,
  },
  subtitle: {
    fontSize: 12,
    color: '#71717a',
    margin: 0,
  },
  textarea: {
    width: '100%',
    background: '#18181b',
    border: '1px solid #3f3f46',
    borderRadius: 8,
    padding: '12px 14px',
    fontSize: 13,
    color: '#f4f4f5',
    resize: 'vertical' as const,
    outline: 'none',
    boxSizing: 'border-box' as const,
    fontFamily: 'inherit',
    minHeight: 80,
  },
  submitBtn: (disabled: boolean) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    padding: '9px 18px',
    background: disabled ? '#3f3f46' : '#d97706',
    color: disabled ? '#71717a' : '#09090b',
    border: 'none',
    borderRadius: 7,
    fontWeight: 700,
    fontSize: 13,
    cursor: disabled ? 'default' : 'pointer',
    transition: 'background 0.15s',
    fontFamily: 'inherit',
  }),
  errorBox: {
    marginBottom: 12,
    padding: '12px 14px',
    background: 'rgba(127,29,29,0.2)',
    border: '1px solid #7f1d1d',
    borderRadius: 8,
    fontSize: 13,
    color: '#fca5a5',
  },
  verdictRow: (isAnswer: boolean) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 14px',
    borderRadius: 8,
    border: `1px solid ${isAnswer ? '#065f46' : '#7f1d1d'}`,
    background: isAnswer ? 'rgba(6,78,59,0.2)' : 'rgba(127,29,29,0.2)',
    marginBottom: 12,
    flexWrap: 'wrap' as const,
    gap: 8,
  }),
  verdictLabel: (isAnswer: boolean) => ({
    fontSize: 13,
    fontWeight: 700,
    fontFamily: 'monospace',
    color: isAnswer ? '#34d399' : '#f87171',
  }),
  badgesRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap' as const,
  },
  answerBox: {
    padding: '14px 16px',
    background: '#18181b',
    border: '1px solid #3f3f46',
    borderRadius: 8,
    marginBottom: 12,
    fontSize: 13,
    color: '#e4e4e7',
    lineHeight: 1.65,
    whiteSpace: 'pre-wrap' as const,
  },
  refusalBox: {
    padding: '14px 16px',
    background: '#18181b',
    border: '1px solid #27272a',
    borderRadius: 8,
    marginBottom: 12,
  },
  refusalLabel: {
    fontSize: 10,
    color: '#71717a',
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  refusalText: {
    fontSize: 13,
    color: '#a1a1aa',
  },
  metaRow: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '4px 16px',
    fontSize: 11,
    color: '#52525b',
    fontFamily: 'monospace',
    marginBottom: 12,
  },
  provenanceWrap: {
    border: '1px solid #3f3f46',
    borderRadius: 8,
    overflow: 'hidden',
  },
  provenanceToggle: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 14px',
    background: 'rgba(39,39,42,0.6)',
    border: 'none',
    cursor: 'pointer',
    color: '#a1a1aa',
    fontSize: 11,
    fontFamily: 'monospace',
    textAlign: 'left' as const,
  },
  provRow: {
    padding: '10px 14px',
    borderTop: '1px solid #27272a',
    background: 'rgba(9,9,11,0.5)',
  },
  provMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  provIndex: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#fbbf24',
  },
  provSlug: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#71717a',
    background: '#27272a',
    padding: '1px 6px',
    borderRadius: 3,
  },
  provHash: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#059669',
  },
  provContent: {
    fontSize: 12,
    color: '#d4d4d8',
    lineHeight: 1.55,
    marginBottom: 4,
  },
  provContributor: {
    fontSize: 11,
    color: '#52525b',
  },
};

// ---- Verdict pill -----------------------------------------------------------

function VerdictPill({ label, verdict }: { label: string; verdict: 'GREEN' | 'RED' | 'SKIP' }) {
  const colors: Record<string, { bg: string; text: string; border: string }> = {
    GREEN: { bg: 'rgba(6,78,59,0.35)', text: '#34d399', border: '#065f46' },
    RED:   { bg: 'rgba(127,29,29,0.35)', text: '#f87171', border: '#7f1d1d' },
    SKIP:  { bg: 'rgba(39,39,42,0.35)', text: '#71717a', border: '#3f3f46' },
  };
  const c = colors[verdict];
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '2px 7px',
      borderRadius: 4,
      border: `1px solid ${c.border}`,
      background: c.bg,
      color: c.text,
      fontSize: 10,
      fontFamily: 'monospace',
      fontWeight: 600,
    }}>
      {verdict === 'GREEN' ? '\u2713' : verdict === 'RED' ? '\u2715' : '\u2013'} {label}: {verdict}
    </span>
  );
}

// ---- Provenance accordion ---------------------------------------------------

function ProvenancePanel({ provenance, systemPrompt }: { provenance: ProvenanceLink[]; systemPrompt: string }) {
  const [open, setOpen] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  if (provenance.length === 0) return null;

  return (
    <div style={S.provenanceWrap}>
      <button style={S.provenanceToggle} onClick={() => setOpen(v => !v)}>
        <span>PROVENANCE CHAIN ({provenance.length} evidence rows)</span>
        <span style={{ fontSize: 14 }}>{open ? '\u25b2' : '\u25bc'}</span>
      </button>
      {open && (
        <>
          {provenance.map((link, i) => (
            <div key={link.evidence_id} style={S.provRow}>
              <div style={S.provMeta}>
                <span style={S.provIndex}>#{i + 1}</span>
                <span style={S.provSlug}>{link.category_slug}</span>
                {link.soccerball_hash && (
                  <span style={S.provHash} title={link.soccerball_hash}>
                    {'\u26bd'} {link.soccerball_hash.slice(0, 8)}&hellip;
                  </span>
                )}
              </div>
              <p style={S.provContent}>{link.content_preview}</p>
              <p style={S.provContributor}>
                Contributor: <span style={{ fontFamily: 'monospace' }}>{link.contributor_member_id.slice(0, 12)}&hellip;</span>
              </p>
            </div>
          ))}
          <div style={{ padding: '8px 14px', borderTop: '1px solid #27272a', background: 'rgba(39,39,42,0.25)' }}>
            <button
              onClick={() => setShowPrompt(v => !v)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#52525b', fontSize: 11, fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              {showPrompt ? '\u25b2' : '\u25bc'} System prompt used
            </button>
            {showPrompt && (
              <pre style={{ marginTop: 6, fontSize: 11, color: '#a1a1aa', fontFamily: 'monospace', background: '#09090b', padding: '8px 10px', borderRadius: 6, maxHeight: 160, overflowY: 'auto', whiteSpace: 'pre-wrap' }}>
                {systemPrompt}
              </pre>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ---- Main component ---------------------------------------------------------

export function CSIAHybridChat() {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CSIAResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isElectron = typeof window !== 'undefined' && !!(window as Window & { amplify?: unknown }).amplify;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q || loading) return;

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      if (!isElectron) {
        throw new Error('CSIA-Hybrid requires the MnemosyneC desktop app (Electron). Running in browser mode -- IPC unavailable.');
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const amplify = (window as any).amplify as { csia?: { query?: (q: string) => Promise<CSIAResult> } };
      if (!amplify?.csia?.query) {
        throw new Error('csia.query IPC not available -- app may need a restart after update.');
      }

      const res = await amplify.csia.query(q);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = question.trim().length > 0 && !loading;

  return (
    <div style={S.root}>
      <div style={S.inner}>
        {/* Header */}
        <div style={S.header}>
          <div style={S.titleRow}>
            <div style={S.badge}>M</div>
            <h1 style={S.h1}>MnemosyneC CSIA-Hybrid</h1>
            <span style={S.versionPill}>v0.8.0</span>
          </div>
          <p style={S.subtitle}>
            Cooperative-substrate grounded inference. Answers verified by Star Chamber · Scrambler · Keys Engines.
          </p>
        </div>

        {/* Input form */}
        <form onSubmit={handleSubmit} style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <textarea
              value={question}
              onChange={e => setQuestion(e.target.value)}
              placeholder="Ask anything -- answers are grounded in triple-GREEN verified cooperative knowledge..."
              rows={3}
              style={S.textarea}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e as unknown as React.FormEvent);
                }
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, color: '#52525b', fontFamily: 'monospace' }}>
                Enter to submit &middot; Shift+Enter for newline
              </span>
              <button
                type="submit"
                disabled={!canSubmit}
                style={S.submitBtn(!canSubmit)}
              >
                {loading ? (
                  <>
                    <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite', fontSize: 14 }}>&#8635;</span>
                    Processing...
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: 13 }}>&rarr;</span>
                    Query Substrate
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

        {/* Error */}
        {error && (
          <div style={S.errorBox}>{error}</div>
        )}

        {/* Result */}
        {result && (
          <div>
            {/* Verdict + verification badges */}
            <div style={S.verdictRow(result.verdict === 'ANSWER')}>
              <span style={S.verdictLabel(result.verdict === 'ANSWER')}>{result.verdict}</span>
              <div style={S.badgesRow}>
                <VerdictPill label="StarChamber" verdict={result.star_chamber} />
                <VerdictPill label="Scrambler" verdict={result.scrambler} />
                <VerdictPill label="KeysEngines" verdict={result.keys_engines} />
              </div>
            </div>

            {/* Answer text */}
            {result.verdict === 'ANSWER' && result.answer && (
              <div style={S.answerBox}>{result.answer}</div>
            )}

            {/* Refusal */}
            {result.verdict === 'REFUSAL' && (
              <div style={S.refusalBox}>
                <p style={S.refusalLabel}>REFUSAL REASON</p>
                <p style={S.refusalText}>{result.refusal_reason}</p>
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #27272a' }}>
                  <p style={{ fontSize: 11, color: '#52525b' }}>
                    Help improve answers by contributing verified knowledge to the cooperative substrate.
                  </p>
                </div>
              </div>
            )}

            {/* Metadata strip */}
            <div style={S.metaRow}>
              <span>model: {result.model_used}</span>
              <span>evidence: {result.evidence_count} rows</span>
              <span>GREEN: {result.green_count}/3</span>
              <span>elapsed: {result.elapsed_ms}ms</span>
              <span>run: {result.run_id.slice(0, 8)}&hellip;</span>
            </div>

            {/* Provenance accordion */}
            <ProvenancePanel provenance={result.provenance} systemPrompt={result.system_prompt_used} />
          </div>
        )}
      </div>
    </div>
  );
}

export default CSIAHybridChat;
