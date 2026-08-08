// LianaCycleTab.tsx -- D-BP149-034/BISHOP/S34/seg-lianaterminal
//
// THE LIANA CYCLE TERMINAL. Ratified canon:
//   Asteroid-ProofVault/state/eblets/CANON/canon_liana_cycle_terminal_window_we_fight_as_we_train_bp148.eblet.md
// Founder, BP148: "the liana cycle is exactly that process, and we need it anyway, so why not
// make the terminal window view, and use it, so we can save what we can token wise, while
// actually using the real deal as practice? We fight as we train."
// Founder, BP149: "Seriously, build it, and use gemma to do it with our MIC method, if possible."
//
// Two panes. LEFT: a live, scrolling, monospace transcript of the cascade executing -- the same
// stage-by-stage output scripts/founder_cascade_v2.mjs prints to console, streamed here via
// window.amplify.onLianaTerminalEvent instead of pasted back from a separate terminal window
// (BP138 standing rule: the Founder must SEE the run live, question by question). RIGHT: the
// prompt -- a question or a bundled MMLU-Pro question id, Enter to run.
//
// Placement: a sibling Compass tab (see compass/types.ts's CompassTab union + CompassShell.tsx's
// TABS array), not folded into LeanAskTab.tsx. LeanAskTab is a chat-bubble surface built around
// ai-dispatch:query's chat/escalation ladder; this is a two-pane terminal built around a
// completely different engine (the ported cascade). Read LeanAskTab.tsx before this decision was
// made -- its Hex Terminal (D-BP148-001) is a real, separate, already-shipped feature (handle/
// celpane minting over a chat reply) with no natural extension point for a live multi-stage
// transcript; forcing this feature into that file's chat-bubble model would have been the
// dishonest fit.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { LianaTerminalEvent, LianaTerminalOutcome } from '../../../shared/liana_cycle/liana_terminal_types';

const LS_LAST_RUNS_KEY = 'liana_terminal_recent_inputs';
const MAX_RECENT = 12;

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(LS_LAST_RUNS_KEY);
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveRecent(list: string[]): void {
  try { localStorage.setItem(LS_LAST_RUNS_KEY, JSON.stringify(list.slice(0, MAX_RECENT))); } catch { /* non-fatal */ }
}

function eventColor(kind: LianaTerminalEvent['kind']): string {
  switch (kind) {
    case 'header': return '#f0fdf4';
    case 'stage': return '#22d3ee';
    case 'fact': return '#4ade80';
    case 'result': return '#fbbf24';
    case 'error': return '#f87171';
    case 'note':
    default: return '#64748b';
  }
}

function TranscriptLine({ evt }: { evt: LianaTerminalEvent }) {
  const hhmmss = (() => {
    try { return evt.ts.slice(11, 19); } catch { return ''; }
  })();
  return (
    <div style={{ display: 'flex', gap: 8, padding: '1px 0', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
      <span style={{ color: '#334155', flexShrink: 0, userSelect: 'none' }}>{hhmmss}</span>
      <span style={{ color: eventColor(evt.kind), fontWeight: evt.kind === 'header' || evt.kind === 'result' ? 700 : 400 }}>
        {evt.text}
      </span>
    </div>
  );
}

// D-BP149-043/BISHOP/S43/seg-method2build -- THE TEACH BOX. method_registry.ts's own header
// named the gap this closes: "The terminal can ask and cannot listen. It reports 'recognized
// shape, not yet taught' [or 'no method matches'] and gives the operator nowhere to teach it."
// A run ends in exactly one of those two states via `outcome.error` -- 'method_not_yet_taught'
// (a registered method's shapeTest matched but its `run` is null, e.g. a future stub) or
// 'no_method_matched' (nothing on file fits at all). Both are teaching opportunities, not
// failures, so both trigger this box.
function isTeachableOutcome(outcome: LianaTerminalOutcome | null): boolean {
  return outcome?.error === 'no_method_matched' || outcome?.error === 'method_not_yet_taught';
}

function shapeTestSummaryFor(outcome: LianaTerminalOutcome): string {
  if (outcome.error === 'no_method_matched') {
    return 'NO METHOD MATCHES -- this question does not fit any recorded method.';
  }
  if (outcome.error === 'method_not_yet_taught') {
    return `NOT YET TAUGHT -- method "${outcome.method ?? '(unknown)'}" matched this question's shape but has no runner yet.`;
  }
  return '(unknown shape-test outcome)';
}

export function LianaCycleTab() {
  const [transcript, setTranscript] = useState<LianaTerminalEvent[]>([]);
  const [input, setInput] = useState('');
  const [running, setRunning] = useState(false);
  const [lastOutcome, setLastOutcome] = useState<LianaTerminalOutcome | null>(null);
  const [recent, setRecent] = useState<string[]>(loadRecent);
  const [bridgeMissing, setBridgeMissing] = useState(false);
  const [teachText, setTeachText] = useState('');
  const [teachSubmitting, setTeachSubmitting] = useState(false);
  const [teachResult, setTeachResult] = useState<{ ok: boolean; filePath?: string; bytes?: number; error?: string } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  useEffect(() => {
    if (!window.amplify?.onLianaTerminalEvent) {
      setBridgeMissing(true);
      return;
    }
    const unsub = window.amplify.onLianaTerminalEvent((evt) => {
      setTranscript((prev) => [...prev, evt]);
    });
    return () => { unsub?.(); };
  }, []);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleRun = useCallback(async () => {
    const text = input.trim();
    if (!text || running) return;
    if (!window.amplify?.lianaTerminalRun) {
      setBridgeMissing(true);
      return;
    }
    setRunning(true);
    setLastOutcome(null);
    setTeachText('');
    setTeachResult(null);
    setTranscript((prev) => [
      ...prev,
      { kind: 'header', text: `═══ RUN  "${text}"`, ts: new Date().toISOString() },
    ]);
    const nextRecent = [text, ...recent.filter((r) => r !== text)].slice(0, MAX_RECENT);
    setRecent(nextRecent);
    saveRecent(nextRecent);
    setInput('');
    try {
      const outcome = await window.amplify.lianaTerminalRun(text);
      setLastOutcome(outcome);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setTranscript((prev) => [...prev, { kind: 'error', text: `IPC threw: ${msg}`, ts: new Date().toISOString() }]);
    } finally {
      setRunning(false);
      inputRef.current?.focus();
    }
  }, [input, running, recent]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); void handleRun(); }
  };

  const handleClear = useCallback(() => {
    setTranscript([]);
    setLastOutcome(null);
    setTeachText('');
    setTeachResult(null);
  }, []);

  // THE TEACH BOX submit. Writes the operator's `teachText` to disk EXACTLY as typed -- this
  // function never touches, trims (beyond the browser's own textarea value), reformats, or
  // summarizes it. window.amplify.lianaTeachSubmit (preload.ts) forwards it verbatim to
  // index.ts's 'liana-teach-submit' handler, which is the only place the file actually gets
  // written. Never auto-generates a method from this text -- a human reads the file later.
  const handleTeachSubmit = useCallback(async () => {
    const text = teachText; // VERBATIM -- no .trim(), no reformatting of the operator's words
    if (!text.trim() || !lastOutcome || teachSubmitting) return;
    if (!window.amplify?.lianaTeachSubmit) {
      setTeachResult({ ok: false, error: 'Preload bridge missing (lianaTeachSubmit) -- rebuild main and restart the app.' });
      return;
    }
    setTeachSubmitting(true);
    try {
      const result = await window.amplify.lianaTeachSubmit({
        teachingText: text,
        question: lastOutcome.question,
        options: lastOutcome.options ?? null,
        qid: lastOutcome.qid,
        shapeTestSummary: shapeTestSummaryFor(lastOutcome),
      });
      setTeachResult(result);
      if (result.ok && result.filePath) {
        setTranscript((prev) => [
          ...prev,
          {
            kind: 'result',
            text: `TEACHING WRITTEN -- ${result.filePath}  (${result.bytes ?? '?'} bytes)`,
            ts: new Date().toISOString(),
          },
        ]);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setTeachResult({ ok: false, error: msg });
    } finally {
      setTeachSubmitting(false);
    }
  }, [teachText, lastOutcome, teachSubmitting]);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '14px 16px 8px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#f0fdf4', flex: 1 }}>
          Liana Cycle
        </h2>
        <span style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>
          Google is the only source · Gemma extracts · the code decides · $0
        </span>
        <button
          type="button"
          onClick={handleClear}
          disabled={transcript.length === 0}
          style={{
            background: 'none', border: '1px solid #334155', borderRadius: 5,
            color: transcript.length === 0 ? '#334155' : '#94a3b8', fontSize: 11, padding: '3px 9px',
            cursor: transcript.length === 0 ? 'default' : 'pointer', fontFamily: 'system-ui, sans-serif', outline: 'none',
          }}
        >
          Clear
        </button>
      </div>

      {bridgeMissing && (
        <div style={{ margin: '0 16px 8px', padding: '8px 12px', background: '#7f1d1d', border: '1px solid #991b1b', borderRadius: 6, color: '#fca5a5', fontSize: 12 }}>
          Preload bridge missing (liana-terminal-run / liana-terminal-event) -- rebuild main and restart the app.
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', minHeight: 0, gap: 1, background: '#1e2a38' }}>
        {/* LEFT: the live transcript */}
        <div style={{
          flex: 1.6, minWidth: 0, background: '#05080d', overflowY: 'auto', padding: '10px 14px',
          fontFamily: 'Consolas, "Courier New", monospace', fontSize: 12, lineHeight: 1.5,
        }}>
          {transcript.length === 0 && (
            <div style={{ color: '#334155' }}>
              Type a bundled MMLU-Pro question id (e.g. 98) or a plain question in the panel on the right, then press Enter.
              {'\n'}The cascade runs here, live, stage by stage -- nothing is pasted in from outside.
            </div>
          )}
          {transcript.map((evt, i) => <TranscriptLine key={i} evt={evt} />)}
          {running && (
            <div style={{ color: '#22d3ee', marginTop: 4 }}>
              <span style={{ opacity: 0.6 }}>▌ running…</span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* RIGHT: the prompt */}
        <div style={{ width: 280, flexShrink: 0, background: '#0d1117', padding: 14, display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>
          <label style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'system-ui, sans-serif' }}>
            Question or qid
          </label>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={running}
            placeholder="98  or  What is..."
            style={{
              background: '#05080d', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0',
              padding: '8px 10px', fontSize: 13, fontFamily: 'Consolas, monospace', outline: 'none',
            }}
          />
          <button
            type="button"
            onClick={() => void handleRun()}
            disabled={running || !input.trim()}
            style={{
              background: running || !input.trim() ? '#1e2a38' : 'linear-gradient(135deg, #059669, #10b981)',
              color: running || !input.trim() ? '#64748b' : '#fff', border: 'none', borderRadius: 6,
              padding: '8px 10px', fontSize: 13, fontWeight: 700, cursor: running || !input.trim() ? 'default' : 'pointer',
              fontFamily: 'system-ui, sans-serif', outline: 'none',
            }}
          >
            {running ? 'Running…' : 'Run ▸'}
          </button>

          {lastOutcome && (
            <div style={{
              marginTop: 4, padding: '8px 10px', borderRadius: 6, fontSize: 11, fontFamily: 'monospace',
              background: lastOutcome.abstain ? '#3f2d0a' : lastOutcome.ok ? '#052e1e' : '#3f0a0a',
              border: `1px solid ${lastOutcome.abstain ? '#a16207' : lastOutcome.ok ? '#059669' : '#991b1b'}`,
              color: lastOutcome.abstain ? '#facc15' : lastOutcome.ok ? '#6ee7b7' : '#fca5a5',
            }}>
              {lastOutcome.freeText
                ? (lastOutcome.abstain ? 'ABSTAIN (no extractable answer)' : `ANSWER: ${lastOutcome.verdict}`)
                : (lastOutcome.abstain ? `ABSTAIN  key=${lastOutcome.correct ?? '?'}` : `${lastOutcome.ok ? 'CORRECT' : 'WRONG'}  ${lastOutcome.verdict}  key=${lastOutcome.correct ?? '?'}`)}
              {lastOutcome.basis && <div style={{ marginTop: 3, opacity: 0.8 }}>{lastOutcome.basis}</div>}
            </div>
          )}

          {isTeachableOutcome(lastOutcome) && lastOutcome && (
            <div style={{ marginTop: 4, padding: '8px 10px', borderRadius: 6, background: '#1e2a38', border: '1px solid #334155' }}>
              <div style={{ fontSize: 11, color: '#facc15', fontFamily: 'system-ui, sans-serif', fontWeight: 700, marginBottom: 4 }}>
                Teach the terminal
              </div>
              <div style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'system-ui, sans-serif', marginBottom: 6, lineHeight: 1.4 }}>
                {shapeTestSummaryFor(lastOutcome)} Type how you would work this one, in your own words. Written to disk verbatim -- nothing here is summarized, and no method is auto-generated from it.
              </div>
              <textarea
                value={teachText}
                onChange={(e) => setTeachText(e.target.value)}
                disabled={teachSubmitting}
                placeholder="First I would..."
                rows={6}
                style={{
                  width: '100%', boxSizing: 'border-box', background: '#05080d', border: '1px solid #334155',
                  borderRadius: 6, color: '#e2e8f0', padding: '8px 10px', fontSize: 12,
                  fontFamily: 'Consolas, monospace', outline: 'none', resize: 'vertical',
                }}
              />
              <button
                type="button"
                onClick={() => void handleTeachSubmit()}
                disabled={teachSubmitting || !teachText.trim()}
                style={{
                  marginTop: 6, width: '100%',
                  background: teachSubmitting || !teachText.trim() ? '#1e2a38' : 'linear-gradient(135deg, #b45309, #f59e0b)',
                  color: teachSubmitting || !teachText.trim() ? '#64748b' : '#fff', border: 'none', borderRadius: 6,
                  padding: '7px 10px', fontSize: 12, fontWeight: 700,
                  cursor: teachSubmitting || !teachText.trim() ? 'default' : 'pointer',
                  fontFamily: 'system-ui, sans-serif', outline: 'none',
                }}
              >
                {teachSubmitting ? 'Writing…' : 'Teach ▸'}
              </button>
              {teachResult && (
                <div style={{
                  marginTop: 6, fontSize: 10, fontFamily: 'monospace', wordBreak: 'break-word',
                  color: teachResult.ok ? '#6ee7b7' : '#fca5a5',
                }}>
                  {teachResult.ok
                    ? `written: ${teachResult.filePath} (${teachResult.bytes} bytes)`
                    : `failed: ${teachResult.error}`}
                </div>
              )}
            </div>
          )}

          {recent.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4, fontFamily: 'system-ui, sans-serif' }}>Recent</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {recent.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setInput(r)}
                    disabled={running}
                    style={{
                      background: 'none', border: '1px solid #1e2a38', borderRadius: 5, color: '#94a3b8',
                      fontSize: 11, padding: '4px 8px', textAlign: 'left', cursor: running ? 'default' : 'pointer',
                      fontFamily: 'Consolas, monospace', outline: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginTop: 'auto', fontSize: 10, color: '#334155', fontFamily: 'system-ui, sans-serif', lineHeight: 1.5 }}>
            Every completed question writes one heartbeat line to the yoke ledger
            (HARDWIRE\LEDGER\YOKE\HEARTBEAT\LIANA-TERMINAL.beat) -- visible to Bishop without
            copying anything back.
          </div>
        </div>
      </div>
    </div>
  );
}

export default LianaCycleTab;
