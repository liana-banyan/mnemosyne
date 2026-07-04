// ClipboardCaptureModal.tsx — SEG-5 v0.1.59 BP081
// Clipboard Q+A capture → MnemosyneC substrate dispatch.
// Triggered by: tray menu "Send last copied as Q+A → MnemosyneC"
//               or Ctrl+Shift+M when dashboard window is focused.

import React, { useCallback, useEffect, useRef, useState } from 'react';

// ─── Clipboard parse heuristics ───────────────────────────────────────────────

interface Parsed {
  question: string;
  answer: string;
}

function parseClipboard(text: string): Parsed {
  // Try explicit Q: / A: or Question: / Answer: markers
  const qaRe = /(?:^|\n)\s*(?:Q(?:uestion)?)[:\.\s]+([^\n]+(?:\n(?!A(?:nswer)?[:\.\s]).+)*)\s*\n\s*(?:A(?:nswer)?)[:\.\s]+([\s\S]+)$/im;
  const qaMatch = text.match(qaRe);
  if (qaMatch) {
    return { question: qaMatch[1].trim(), answer: qaMatch[2].trim() };
  }

  // Try ChatGPT-style turns: two blocks separated by one or more blank lines
  const blocks = text.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  if (blocks.length >= 2) {
    return { question: blocks[0], answer: blocks.slice(1).join('\n\n') };
  }

  // Single block — put everything in question, leave answer empty for user
  return { question: text.trim(), answer: '' };
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = {
  backdrop: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(0,0,0,0.74)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    backdropFilter: 'blur(4px)',
  },
  modal: {
    width: 520,
    maxWidth: '92vw',
    maxHeight: '82vh',
    overflowY: 'auto' as const,
    background: '#0f1726',
    border: '1px solid rgba(110,231,183,0.25)',
    borderRadius: 12,
    padding: '24px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 16,
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#e2e8f0',
  },
  title: {
    fontSize: 16,
    fontWeight: 700,
    color: '#6ee7b7',
    margin: 0,
  },
  subtitle: {
    fontSize: 12,
    color: '#64748b',
    margin: '4px 0 0',
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: '#94a3b8',
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    marginBottom: 4,
    display: 'block',
  },
  textarea: {
    width: '100%',
    minHeight: 72,
    padding: '10px 12px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(100,116,139,0.25)',
    borderRadius: 8,
    color: '#e2e8f0',
    fontSize: 13,
    fontFamily: 'inherit',
    resize: 'vertical' as const,
    boxSizing: 'border-box' as const,
    lineHeight: 1.5,
    outline: 'none',
  },
  toggleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontSize: 13,
    color: '#94a3b8',
    cursor: 'pointer',
    userSelect: 'none' as const,
  },
  checkbox: {
    accentColor: '#6ee7b7',
    width: 15,
    height: 15,
    cursor: 'pointer',
    flexShrink: 0,
  },
  btnRow: {
    display: 'flex',
    gap: 10,
    alignItems: 'center',
    flexWrap: 'wrap' as const,
  },
  primaryBtn: (disabled: boolean): React.CSSProperties => ({
    padding: '10px 20px',
    background: disabled ? 'rgba(110,231,183,0.04)' : 'rgba(110,231,183,0.14)',
    border: disabled ? '1px solid rgba(110,231,183,0.15)' : '1px solid rgba(110,231,183,0.4)',
    borderRadius: 8,
    color: disabled ? '#475569' : '#6ee7b7',
    fontSize: 13,
    fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.15s',
  }),
  cancelBtn: {
    padding: '10px 16px',
    background: 'transparent',
    border: '1px solid rgba(100,116,139,0.28)',
    borderRadius: 8,
    color: '#64748b',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  successBox: {
    padding: '12px 16px',
    borderRadius: 8,
    border: '1px solid rgba(110,231,183,0.3)',
    background: 'rgba(110,231,183,0.06)',
    color: '#6ee7b7',
    fontSize: 13,
    lineHeight: 1.5,
  },
  errorBox: {
    padding: '12px 16px',
    borderRadius: 8,
    border: '1px solid rgba(239,68,68,0.3)',
    background: 'rgba(239,68,68,0.05)',
    color: '#f87171',
    fontSize: 13,
    lineHeight: 1.5,
  },
  spinner: {
    display: 'inline-block',
    fontSize: 12,
    color: '#6ee7b7',
    animation: 'mnemo-pulse 1.4s ease-in-out infinite',
  },
};

// ─── Result type ──────────────────────────────────────────────────────────────

type SubmitResult =
  | { status: 'success'; eblets: number }
  | { status: 'error'; message: string };

// ─── Component ────────────────────────────────────────────────────────────────

export function ClipboardCaptureModal(): React.ReactElement | null {
  const [visible, setVisible] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [markVerified, setMarkVerified] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  const openModal = useCallback(async () => {
    setResult(null);
    setSubmitting(false);
    setMarkVerified(false);

    // Read clipboard via IPC
    let text = '';
    try {
      const raw = await window.amplify?.readClipboard?.();
      text = typeof raw === 'string' ? raw.trim() : '';
    } catch { /* noop */ }

    if (!text) {
      setQuestion('');
      setAnswer('');
      setResult({ status: 'error', message: 'No text in clipboard. Copy a Q+A pair first.' });
      setVisible(true);
      return;
    }

    const parsed = parseClipboard(text);
    setQuestion(parsed.question);
    setAnswer(parsed.answer);
    setVisible(true);
  }, []);

  // Register IPC event listener for clipboard:capture-qa
  useEffect(() => {
    const unsub = window.amplify?.onClipboardCaptureQA?.(() => {
      void openModal();
    });
    unsubRef.current = unsub ?? null;
    return () => { unsubRef.current?.(); };
  }, [openModal]);

  const handleClose = useCallback(() => {
    setVisible(false);
    setResult(null);
    setSubmitting(false);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!question.trim() || !answer.trim() || submitting) return;
    setSubmitting(true);
    setResult(null);

    try {
      if (markVerified) {
        // Mark-verified path: skip concordance, write directly to substrate
        const res = await window.amplify?.substrateWrite?.(
          `Q: ${question.trim()}\nA: ${answer.trim()}`,
          'clipboard-capture',
          ['clipboard'],
        );
        if (res?.ok) {
          setResult({ status: 'success', eblets: 1 });
        } else {
          setResult({ status: 'error', message: 'Substrate write failed. Please retry.' });
        }
      } else {
        // Concordance path: run through Andon plow (grades answer via local model)
        const res = await window.amplify?.runAndonReplowLoop?.(question.trim(), 'other');
        if (!res) {
          setResult({ status: 'error', message: 'Plow IPC unavailable — check that MnemosyneC is fully started.' });
        } else if (res.verdict === 'verified') {
          setResult({ status: 'success', eblets: res.ebletWritten ? 1 : 0 });
        } else if (res.verdict === 'rejected') {
          setResult({
            status: 'error',
            message: 'Concordance rejected this answer. Try editing the Q or A, or enable "Mark as verified" to bypass concordance.',
          });
        } else {
          setResult({
            status: 'error',
            message: res.error ?? 'Plow quarantined this entry. Check that Ollama is running.',
          });
        }
      }
    } catch (err) {
      setResult({ status: 'error', message: String(err) });
    } finally {
      setSubmitting(false);
    }
  }, [question, answer, markVerified, submitting]);

  if (!visible) return null;

  const isEmptyClipboard =
    result?.status === 'error' &&
    result.message.startsWith('No text in clipboard');

  return (
    <div
      style={S.backdrop}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div style={S.modal}>
        {/* Header */}
        <div>
          <h3 style={S.title}>Send to MnemosyneC 🌾</h3>
          <p style={S.subtitle}>Review the Q+A pair before sending to your substrate.</p>
        </div>

        {/* Success state */}
        {result?.status === 'success' ? (
          <>
            <div style={S.successBox}>
              {result.eblets > 0
                ? `Eblet written ✓ · Substrate +${result.eblets}`
                : 'Processed ✓ · Eblet already in substrate or was not verifiable by concordance.'}
            </div>
            <div style={S.btnRow}>
              <button type="button" style={S.primaryBtn(false)} onClick={handleClose}>
                Done
              </button>
            </div>
          </>
        ) : isEmptyClipboard ? (
          /* Empty clipboard state */
          <>
            <div style={S.errorBox}>{result?.message}</div>
            <div style={S.btnRow}>
              <button type="button" style={S.cancelBtn} onClick={handleClose}>
                Close
              </button>
            </div>
          </>
        ) : (
          /* Edit + submit state */
          <>
            <div>
              <span style={S.fieldLabel}>Question</span>
              <textarea
                style={S.textarea}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Paste or type a question here…"
                rows={3}
                disabled={submitting}
              />
            </div>

            <div>
              <span style={S.fieldLabel}>Answer</span>
              <textarea
                style={S.textarea}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Paste or type the answer here…"
                rows={3}
                disabled={submitting}
              />
            </div>

            <label style={S.toggleRow}>
              <input
                type="checkbox"
                style={S.checkbox}
                checked={markVerified}
                onChange={(e) => setMarkVerified(e.target.checked)}
                disabled={submitting}
              />
              <span>Mark as verified — skip concordance and write directly</span>
            </label>

            {result?.status === 'error' && (
              <div style={S.errorBox}>{result.message}</div>
            )}

            <div style={S.btnRow}>
              <button
                type="button"
                style={S.primaryBtn(submitting || !question.trim() || !answer.trim())}
                disabled={submitting || !question.trim() || !answer.trim()}
                onClick={() => { void handleSubmit(); }}
              >
                {submitting ? (
                  <><span style={S.spinner}>◌</span>{' '}Sending…</>
                ) : (
                  'Send to MnemosyneC 🌾'
                )}
              </button>
              <button
                type="button"
                style={S.cancelBtn}
                onClick={handleClose}
                disabled={submitting}
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
