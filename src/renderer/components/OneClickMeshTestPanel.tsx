// OneClickMeshTestPanel.tsx — BP132 Yoke #21 D9 / Yoke #22 "one-click staged test"
//
// See src/main/mesh_test/one_click_mmlu_pro.ts for the full Truth-Always scope note.
// Short version shown to the user in this panel's footer: real ground-truth-scored
// MMLU-Pro-format questions, dispatched locally to this machine's Ollama today —
// full WAN-mesh-distributed dispatch is a flagged follow-up, not yet wired.
//
// Writes its last result to localStorage so the Social tab's "Check My Math" card
// (CueDeckCardRenderer-based) can display the real number without prop-drilling
// across tabs — see LS_LAST_RESULT below.

import React, { useCallback, useEffect, useState } from 'react';

export const LS_LAST_RESULT = 'mnemo_last_mesh_test_result';

interface QuestionOutcome {
  question_id: number;
  question: string;
  category: string;
  modelRawAnswer: string;
  parsedLetter: string | null;
  correctLetter: string;
  isCorrect: boolean;
  latencyMs: number;
  error?: string;
}

export interface OneClickRunResult {
  startedAt: string;
  completedAt: string;
  total: number;
  scored: number;
  correct: number;
  accuracy: number | null;
  outcomes: QuestionOutcome[];
  dispatchMode: string;
  datasetLabel: string;
}

type ProgressEvent =
  | { type: 'start'; total: number }
  | { type: 'question-start'; index: number; total: number; question: string; category: string }
  | { type: 'question-complete'; index: number; total: number; outcome: QuestionOutcome }
  | { type: 'complete'; result: OneClickRunResult };

export function loadLastMeshTestResult(): OneClickRunResult | null {
  try {
    const raw = localStorage.getItem(LS_LAST_RESULT);
    if (!raw) return null;
    return JSON.parse(raw) as OneClickRunResult;
  } catch {
    return null;
  }
}

export interface OneClickMeshTestPanelProps {
  onShareResult?: (result: OneClickRunResult) => void;
}

export function OneClickMeshTestPanel({ onShareResult }: OneClickMeshTestPanelProps): React.ReactElement {
  const [state, setState] = useState<'idle' | 'running' | 'complete' | 'error'>('idle');
  const [total, setTotal] = useState(0);
  const [doneCount, setDoneCount] = useState(0);
  const [liveOutcomes, setLiveOutcomes] = useState<QuestionOutcome[]>([]);
  const [result, setResult] = useState<OneClickRunResult | null>(() => loadLastMeshTestResult());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const unsub = (window as any).amplify?.onMeshTestProgress?.((payload: ProgressEvent) => {
      if (payload.type === 'start') {
        setTotal(payload.total);
        setDoneCount(0);
        setLiveOutcomes([]);
      } else if (payload.type === 'question-complete') {
        setDoneCount(payload.index + 1);
        setLiveOutcomes((prev) => [...prev, payload.outcome]);
      } else if (payload.type === 'complete') {
        setResult(payload.result);
        setState('complete');
        try { localStorage.setItem(LS_LAST_RESULT, JSON.stringify(payload.result)); } catch { /* non-fatal */ }
      }
    });
    return () => unsub?.();
  }, []);

  const handleRun = useCallback(async () => {
    setState('running');
    setErrorMsg(null);
    try {
      const resp = await (window as any).amplify?.meshTestRunOneClick?.({});
      if (!resp?.ok) {
        setErrorMsg(resp?.error ?? 'Test run failed to start');
        setState('error');
      }
      // Completion is reported via the mesh-test:progress 'complete' event above.
    } catch (e) {
      setErrorMsg(String(e));
      setState('error');
    }
  }, []);

  const runningAccuracy = liveOutcomes.length > 0
    ? liveOutcomes.filter((o) => o.isCorrect).length / liveOutcomes.length
    : null;

  return (
    <div style={{
      background: '#0d1117',
      border: '1px solid #1e2a38',
      borderRadius: 10,
      padding: 16,
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#f0fdf4', marginBottom: 4 }}>
        🧪 One-Click Staged Test
      </div>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 12, lineHeight: 1.5 }}>
        Runs real MMLU-Pro-format multiple-choice questions (ground truth answers,
        not fabricated) and scores your machine's answers live.
      </div>

      {state !== 'running' && (
        <button
          onClick={() => void handleRun()}
          style={{
            background: '#10b981', color: '#fff', border: 'none', borderRadius: 6,
            padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          ▶ Run the Test
        </button>
      )}

      {state === 'running' && (
        <div>
          <div style={{ fontSize: 12, color: '#6ee7b7', marginBottom: 8, animation: 'mnemo-pulse 1.5s ease-in-out infinite' }}>
            ◌ Question {doneCount}/{total || '?'}
            {runningAccuracy !== null && (
              <span style={{ marginLeft: 10, color: '#94a3b8' }}>
                running accuracy: {(runningAccuracy * 100).toFixed(0)}%
              </span>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {liveOutcomes.map((o) => (
              <div key={o.question_id} style={{ fontSize: 11, color: o.isCorrect ? '#4ade80' : '#f87171', display: 'flex', gap: 8 }}>
                <span>{o.isCorrect ? '✓' : '✗'}</span>
                <span style={{ color: '#64748b' }}>[{o.category}]</span>
                <span style={{ color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {o.question}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {state === 'error' && (
        <div style={{ fontSize: 12, color: '#f87171', marginTop: 8 }}>✗ {errorMsg}</div>
      )}

      {(state === 'complete' || (state === 'idle' && result)) && result && (
        <div style={{ marginTop: state === 'complete' ? 12 : 0 }}>
          <div style={{
            background: '#111827', border: '1px solid #1e2d45', borderRadius: 8,
            padding: '10px 14px', marginBottom: 8,
          }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#6ee7b7' }}>
              {result.accuracy !== null ? `${(result.accuracy * 100).toFixed(0)}% accuracy` : 'No scored answers'}
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
              {result.correct}/{result.scored} correct (of {result.total} questions run) ·{' '}
              {result.dispatchMode === 'local_ollama' ? 'dispatched locally on this machine' : result.dispatchMode}
            </div>
            <div style={{ fontSize: 10, color: '#475569', marginTop: 4, fontStyle: 'italic' }}>
              {result.datasetLabel}
            </div>
          </div>
          {onShareResult && (
            <button
              onClick={() => onShareResult(result)}
              style={{
                background: 'none', color: '#6ee7b7', border: '1px solid #1e4038', borderRadius: 6,
                padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'system-ui, sans-serif',
              }}
            >
              📤 Share your results
            </button>
          )}
        </div>
      )}

      <div style={{ fontSize: 10, color: '#334155', marginTop: 12, lineHeight: 1.5 }}>
        Scope note: this build dispatches questions to your local AI engine and scores
        them against real answer keys. Distributing the same scored questions across
        your WAN mesh peers (so the accuracy reflects the whole Constellation, not just
        this machine) is a flagged follow-up — see Yoke #21 D9 in the Bishop handoff.
      </div>
    </div>
  );
}

export default OneClickMeshTestPanel;
