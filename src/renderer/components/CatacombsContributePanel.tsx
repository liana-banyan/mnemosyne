/**
 * CatacombsContributePanel -- Member contribution form for Catacombs
 * BP087 Wave 5
 *
 * 2-of-3 corroboration pipeline: Star Chamber + Triple Scrambler + Keys & Engines
 */

import React, { useState } from 'react';
import type { ContributeResult } from '../../main/catacombs/contribute_to_category';

// ---- Types ------------------------------------------------------------------

interface Props {
  defaultSlug?: string;
  onSuccess?: (result: ContributeResult) => void;
  onClose?: () => void;
}

type PipelineStatus = 'pending' | 'running' | 'green' | 'red';

interface PipelineState {
  star_chamber: PipelineStatus;
  scrambler: PipelineStatus;
  keys_engines: PipelineStatus;
}

// ---- Constants --------------------------------------------------------------

const MMLU_SLUGS = [
  '01_biology',
  '02_business',
  '03_chemistry',
  '04_computer_science',
  '05_economics',
  '06_engineering',
  '07_health',
  '08_history',
  '09_law',
  '10_math',
  '11_other',
  '12_philosophy',
  '13_physics',
  '14_psychology',
];

const SLUG_LABELS: Record<string, string> = {
  '01_biology': 'Biology',
  '02_business': 'Business',
  '03_chemistry': 'Chemistry',
  '04_computer_science': 'Computer Science',
  '05_economics': 'Economics',
  '06_engineering': 'Engineering',
  '07_health': 'Health',
  '08_history': 'History',
  '09_law': 'Law',
  '10_math': 'Math',
  '11_other': 'Other',
  '12_philosophy': 'Philosophy',
  '13_physics': 'Physics',
  '14_psychology': 'Psychology',
};

// ---- Styles -----------------------------------------------------------------

const S = {
  panel: {
    background: '#0d1526',
    border: '1px solid rgba(100,116,139,0.25)',
    borderRadius: 10,
    padding: 20,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 14,
    maxWidth: 560,
    width: '100%',
  } as React.CSSProperties,
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  } as React.CSSProperties,
  title: {
    fontSize: 14,
    fontWeight: 700,
    color: '#6ee7b7',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#475569',
    cursor: 'pointer',
    fontSize: 16,
    padding: '2px 6px',
  } as React.CSSProperties,
  label: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 4,
    display: 'block',
  },
  select: {
    width: '100%',
    background: '#111827',
    border: '1px solid rgba(100,116,139,0.3)',
    borderRadius: 6,
    color: '#e2e8f0',
    fontSize: 12,
    padding: '6px 10px',
    outline: 'none',
  } as React.CSSProperties,
  textarea: {
    width: '100%',
    background: '#111827',
    border: '1px solid rgba(100,116,139,0.3)',
    borderRadius: 6,
    color: '#e2e8f0',
    fontSize: 11,
    padding: '8px 10px',
    resize: 'vertical' as const,
    fontFamily: 'monospace',
    minHeight: 120,
    outline: 'none',
    boxSizing: 'border-box' as const,
  } as React.CSSProperties,
  input: {
    width: '100%',
    background: '#111827',
    border: '1px solid rgba(100,116,139,0.3)',
    borderRadius: 6,
    color: '#e2e8f0',
    fontSize: 12,
    padding: '6px 10px',
    outline: 'none',
    boxSizing: 'border-box' as const,
  } as React.CSSProperties,
  submitBtn: (disabled: boolean): React.CSSProperties => ({
    background: disabled ? 'rgba(110,231,183,0.05)' : 'rgba(110,231,183,0.12)',
    border: '1px solid rgba(110,231,183,0.3)',
    borderRadius: 6,
    color: disabled ? '#475569' : '#6ee7b7',
    fontSize: 12,
    fontWeight: 700,
    padding: '8px 16px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    alignSelf: 'flex-start',
  }),
  pipelineRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontSize: 12,
  } as React.CSSProperties,
  chip: (status: PipelineStatus): React.CSSProperties => {
    const colorMap: Record<PipelineStatus, string> = {
      pending: 'rgba(100,116,139,0.3)',
      running: 'rgba(250,204,21,0.25)',
      green: 'rgba(34,197,94,0.25)',
      red: 'rgba(239,68,68,0.25)',
    };
    const textMap: Record<PipelineStatus, string> = {
      pending: '#64748b',
      running: '#fbbf24',
      green: '#4ade80',
      red: '#f87171',
    };
    return {
      background: colorMap[status],
      color: textMap[status],
      borderRadius: 12,
      padding: '2px 10px',
      fontSize: 10,
      fontWeight: 700,
    };
  },
  successBox: {
    background: 'rgba(34,197,94,0.08)',
    border: '1px solid rgba(34,197,94,0.3)',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 11,
    color: '#4ade80',
    lineHeight: 1.5,
  } as React.CSSProperties,
  errorBox: {
    background: 'rgba(239,68,68,0.08)',
    border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 11,
    color: '#f87171',
    lineHeight: 1.5,
  } as React.CSSProperties,
};

// ---- Chip label helpers -----------------------------------------------------

function chipLabel(status: PipelineStatus): string {
  if (status === 'pending') return 'pending';
  if (status === 'running') return 'checking...';
  return status.toUpperCase();
}

// ---- Component --------------------------------------------------------------

export function CatacombsContributePanel({ defaultSlug, onSuccess, onClose }: Props) {
  const [slug, setSlug] = useState(defaultSlug ?? MMLU_SLUGS[0]);
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pipeline, setPipeline] = useState<PipelineState>({
    star_chamber: 'pending',
    scrambler: 'pending',
    keys_engines: 'pending',
  });
  const [result, setResult] = useState<ContributeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!content.trim() || submitting) return;
    setSubmitting(true);
    setResult(null);
    setError(null);
    setPipeline({ star_chamber: 'running', scrambler: 'running', keys_engines: 'running' });

    try {
      // Invoke IPC handler
      const res = await (window as any).electronAPI?.catacombsContribute?.(slug, content, 'anonymous')
        ?? await (window as any).ipcRenderer?.invoke?.('catacombs:contribute', slug, content, 'anonymous');

      if (!res) {
        throw new Error('IPC unavailable');
      }

      const typed = res as ContributeResult;
      setPipeline({
        star_chamber: typed.corroboration.star_chamber === 'GREEN' ? 'green' : 'red',
        scrambler: typed.corroboration.scrambler === 'GREEN' ? 'green' : 'red',
        keys_engines: typed.corroboration.keys_engines === 'GREEN' ? 'green' : 'red',
      });
      setResult(typed);
      if (typed.verdict === 'GREEN' && onSuccess) {
        onSuccess(typed);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPipeline({ star_chamber: 'red', scrambler: 'red', keys_engines: 'red' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={S.panel}>
      {/* Header */}
      <div style={S.header}>
        <span style={S.title}>Submit Eblet for Corroboration</span>
        {onClose && (
          <button style={S.closeBtn} onClick={onClose} aria-label="Close">x</button>
        )}
      </div>

      {/* Category selector */}
      <div>
        <label style={S.label}>Category</label>
        <select
          style={S.select}
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          disabled={submitting}
        >
          {MMLU_SLUGS.map((s) => (
            <option key={s} value={s}>{SLUG_LABELS[s] ?? s}</option>
          ))}
        </select>
      </div>

      {/* Optional title */}
      <div>
        <label style={S.label}>Title (optional)</label>
        <input
          style={S.input}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Short descriptive title..."
          disabled={submitting}
        />
      </div>

      {/* Eblet content */}
      <div>
        <label style={S.label}>Eblet JSON Content</label>
        <textarea
          style={S.textarea}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Paste your Eblet JSON content here..."
          disabled={submitting}
          rows={6}
        />
      </div>

      {/* Submit */}
      <button
        style={S.submitBtn(!content.trim() || submitting)}
        onClick={handleSubmit}
        disabled={!content.trim() || submitting}
      >
        {submitting ? 'Submitting...' : 'Submit for Corroboration'}
      </button>

      {/* Pipeline status */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 11, color: '#475569', fontWeight: 600, letterSpacing: '0.05em' }}>
          PIPELINE STATUS
        </div>
        {(
          [
            { key: 'star_chamber', label: 'Star Chamber' },
            { key: 'scrambler', label: 'Triple Scrambler' },
            { key: 'keys_engines', label: 'Keys and Engines' },
          ] as Array<{ key: keyof PipelineState; label: string }>
        ).map(({ key, label }) => (
          <div key={key} style={S.pipelineRow}>
            <span style={{ color: '#64748b', minWidth: 140, fontSize: 11 }}>{label}</span>
            <span style={S.chip(pipeline[key])}>{chipLabel(pipeline[key])}</span>
          </div>
        ))}
      </div>

      {/* Result */}
      {result && result.verdict === 'GREEN' && (
        <div style={S.successBox}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Corroboration passed -- Eblet published!</div>
          <div>Category: <strong>{SLUG_LABELS[slug] ?? slug}</strong></div>
          {result.soccerball_hash && (
            <div>Soccerball hash: <code>{result.soccerball_hash.slice(0, 16)}...</code></div>
          )}
          <div style={{ marginTop: 4, color: '#22c55e' }}>
            {result.corroboration.green_count}/3 verdicts GREEN
          </div>
        </div>
      )}

      {result && result.verdict === 'RED' && (
        <div style={S.errorBox}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Corroboration failed.</div>
          <div>Eblet remains staged in 15_USER. {result.corroboration.green_count}/3 verdicts GREEN.</div>
          {result.error && <div style={{ marginTop: 4 }}>Error: {result.error}</div>}
        </div>
      )}

      {error && (
        <div style={S.errorBox}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Submission error</div>
          <div>{error}</div>
        </div>
      )}
    </div>
  );
}
