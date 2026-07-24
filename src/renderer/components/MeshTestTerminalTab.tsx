// MeshTestTerminalTab.tsx — BP133 Yoke #24 Task 3: Diagnostic tab as a read-only terminal
// event console for the one-click MMLU-Pro test.
//
// Design constraints (Founder-direct, Yoke #24):
//   - Terminal-styled, monospace, live-scrolling event console: peer discovered, question
//     dispatched to which machine, reply received, correct/wrong, running tally, timings.
//   - Read-only event stream plus a SMALL, FIXED set of typed commands: run, stop, peers,
//     tail, help. NO arbitrary command execution -- every line of input is matched against
//     an explicit allowlist regex BEFORE anything happens; anything else prints "unknown
//     command" and does nothing else. A shell inside an app that also accepts dispatched
//     work from remote peers over a WAN relay is a real security hole; this is not one --
//     there is no code path from typed text to a shell, a file write, or an eval.
//   - Every event line here is built from data the one-click test ALREADY produces via the
//     real mesh-test:progress IPC channel (see one_click_mmlu_pro.ts) -- nothing here is
//     fabricated or simulated for demo effect.

import React, { useCallback, useEffect, useRef, useState } from 'react';

interface QuestionOutcome {
  question_id: number;
  question: string;
  category: string;
  parsedLetter: string | null;
  correctLetter: string;
  isCorrect: boolean;
  latencyMs: number;
  error?: string;
  peerId?: string;
  machineLabel?: string;
  timedOut?: boolean;
  isAbstain?: boolean;
  substrateContextInjected?: boolean;
}

interface RunResult {
  total: number;
  scored: number;
  correct: number;
  accuracy: number | null;
  dispatchMode: string;
  substrateEnabled?: boolean;
  cancelled?: boolean;
  wanError?: string;
}

type ProgressEvent =
  | { type: 'start'; total: number }
  | { type: 'peers-discovered'; count: number }
  | { type: 'question-start'; index: number; total: number; question: string; category: string }
  | { type: 'question-complete'; index: number; total: number; outcome: QuestionOutcome }
  | { type: 'complete'; result: RunResult };

const ALLOWED_COMMAND = /^\s*(run(\s+\d{1,4})?|stop|peers|tail(\s+\d{1,3})?|help|clear)\s*$/i;

let lineSeq = 0;
function nextLineId(): number {
  lineSeq += 1;
  return lineSeq;
}

interface LogLine {
  id: number;
  ts: string;
  text: string;
  kind: 'info' | 'ok' | 'err' | 'cmd' | 'sys';
}

export function MeshTestTerminalTab(): React.ReactElement {
  const [lines, setLines] = useState<LogLine[]>(() => [
    { id: nextLineId(), ts: tsNow(), kind: 'sys', text: 'MnemosyneC Diagnostic Terminal -- read-only event console.' },
    { id: nextLineId(), ts: tsNow(), kind: 'sys', text: 'Commands: run [n]  stop  peers  tail [n]  help  clear' },
  ]);
  const [input, setInput] = useState('');
  const [running, setRunning] = useState(false);
  const [tally, setTally] = useState({ correct: 0, total: 0 });
  const logEndRef = useRef<HTMLDivElement | null>(null);
  const allLinesRef = useRef<LogLine[]>([]);

  const appendLine = useCallback((text: string, kind: LogLine['kind'] = 'info') => {
    const line: LogLine = { id: nextLineId(), ts: tsNow(), text, kind };
    allLinesRef.current = [...allLinesRef.current, line];
    setLines((prev) => [...prev.slice(-499), line]);
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ block: 'end' });
  }, [lines]);

  useEffect(() => {
    const unsub = (window as any).amplify?.onMeshTestProgress?.((payload: ProgressEvent) => {
      if (payload.type === 'start') {
        setRunning(true);
        setTally({ correct: 0, total: 0 });
        appendLine(`RUN START -- ${payload.total} unit(s) queued`, 'sys');
      } else if (payload.type === 'peers-discovered') {
        appendLine(`peer discovery: ${payload.count} live peer(s) found`, 'info');
      } else if (payload.type === 'question-start') {
        appendLine(`-> Q[${payload.index + 1}/${payload.total}] dispatched [${payload.category}] ${truncate(payload.question, 70)}`, 'info');
      } else if (payload.type === 'question-complete') {
        const o = payload.outcome;
        setTally((prev) => ({
          correct: prev.correct + (o.isCorrect ? 1 : 0),
          total: prev.total + 1,
        }));
        const who = o.machineLabel ? `[${o.machineLabel}]` : '[local]';
        const verdict = o.timedOut ? 'TIMEOUT' : o.isAbstain ? 'ABSTAIN' : o.isCorrect ? 'CORRECT' : 'WRONG';
        const kind: LogLine['kind'] = o.timedOut || (!o.isCorrect && !o.isAbstain) ? 'err' : o.isCorrect ? 'ok' : 'info';
        appendLine(
          `<- ${who} reply: ${o.parsedLetter ?? '(none)'} vs key ${o.correctLetter} -- ${verdict} (${o.latencyMs}ms)` +
          (o.substrateContextInjected ? ' [substrate]' : ''),
          kind,
        );
      } else if (payload.type === 'complete') {
        const r = payload.result;
        setRunning(false);
        if (r.wanError) {
          appendLine(`RUN FAILED: ${r.wanError}`, 'err');
        } else {
          appendLine(
            `RUN ${r.cancelled ? 'STOPPED' : 'COMPLETE'} -- ${r.correct}/${r.scored} correct of ${r.total} ` +
            `(${r.accuracy !== null ? (r.accuracy * 100).toFixed(1) + '%' : 'unscored'}) ` +
            `mode=${r.dispatchMode} substrate=${r.substrateEnabled ? 'ON' : 'OFF'}`,
            r.cancelled ? 'err' : 'sys',
          );
        }
      }
    });
    return () => unsub?.();
  }, [appendLine]);

  const runCommand = useCallback(async (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed.length === 0) return;
    appendLine(`$ ${trimmed}`, 'cmd');

    // BP133 Yoke #24 Task 3: hard allowlist gate. No arbitrary command execution -- anything
    // not matching this exact pattern is rejected before any IPC call is made.
    if (!ALLOWED_COMMAND.test(trimmed)) {
      appendLine(`unknown command: "${trimmed}" -- try: run, stop, peers, tail, help`, 'err');
      return;
    }

    const [cmd, argRaw] = trimmed.split(/\s+/);
    const cmdLower = cmd.toLowerCase();

    if (cmdLower === 'help') {
      appendLine('run [n]  -- start a one-click MMLU-Pro test, optional question count (default 20)', 'sys');
      appendLine('stop     -- request cancellation of the running test (stops at next question boundary)', 'sys');
      appendLine('peers    -- list currently live WAN mesh peers (read-only query)', 'sys');
      appendLine('tail [n] -- reprint the last n event lines (default 20)', 'sys');
      appendLine('clear    -- clear the visible console (does not affect a running test)', 'sys');
      return;
    }

    if (cmdLower === 'clear') {
      setLines([]);
      return;
    }

    if (cmdLower === 'peers') {
      try {
        const resp = await (window as any).amplify?.meshTestListPeers?.();
        if (!resp?.ok) {
          appendLine('peers query failed', 'err');
          return;
        }
        if (resp.peers.length === 0) {
          appendLine('no live peers found (peer_presence has no recently-seen status=active rows besides this machine)', 'info');
        } else {
          for (const p of resp.peers) appendLine(`peer: ${p.machineLabel} (${p.peerId.slice(0, 8)})`, 'info');
        }
      } catch (e) {
        appendLine(`peers query error: ${String(e)}`, 'err');
      }
      return;
    }

    if (cmdLower === 'tail') {
      const n = argRaw ? Math.min(parseInt(argRaw, 10), 200) : 20;
      const recent = allLinesRef.current.slice(-n - 1, -1); // exclude the '$ tail' line itself
      if (recent.length === 0) {
        appendLine('(no prior events)', 'info');
      } else {
        for (const l of recent) appendLine(`  [${l.ts}] ${l.text}`, 'info');
      }
      return;
    }

    if (cmdLower === 'stop') {
      try {
        const resp = await (window as any).amplify?.meshTestStop?.();
        appendLine(resp?.wasRunning ? 'stop requested -- run will halt at next question boundary' : 'stop requested (no run was active)', 'sys');
      } catch (e) {
        appendLine(`stop error: ${String(e)}`, 'err');
      }
      return;
    }

    if (cmdLower === 'run') {
      const n = argRaw ? Math.max(1, Math.min(parseInt(argRaw, 10), 500)) : 20;
      try {
        const resp = await (window as any).amplify?.meshTestRunOneClick?.({
          mode: 'auto',
          substrateEnabled: false,
          maxTotalQuestions: n,
        });
        if (!resp?.ok) {
          appendLine(`run failed to start: ${resp?.error ?? 'unknown error'}`, 'err');
        }
        // Progress/completion is reported via the mesh-test:progress subscription above.
      } catch (e) {
        appendLine(`run error: ${String(e)}`, 'err');
      }
      return;
    }
  }, [appendLine]);

  return (
    <div style={{
      background: '#050a0f', border: '1px solid #1e2a38', borderRadius: 10,
      padding: 0, fontFamily: 'ui-monospace, SFMono-Regular, "Cascadia Code", Consolas, monospace',
      display: 'flex', flexDirection: 'column', height: 420,
    }}>
      <div style={{
        padding: '8px 12px', borderBottom: '1px solid #1e2a38', display: 'flex',
        alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ fontSize: 12, color: '#4ade80', fontWeight: 700 }}>
          ● mnemosynec-diagnostic-terminal{running ? ' [RUNNING]' : ''}
        </div>
        <div style={{ fontSize: 11, color: '#64748b' }}>
          tally: {tally.correct}/{tally.total}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px', fontSize: 12, lineHeight: 1.6 }}>
        {lines.map((l) => (
          <div key={l.id} style={{ color: colorFor(l.kind), whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            <span style={{ color: '#334155' }}>[{l.ts}]</span> {l.text}
          </div>
        ))}
        <div ref={logEndRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void runCommand(input);
          setInput('');
        }}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px',
          borderTop: '1px solid #1e2a38',
        }}
      >
        <span style={{ color: '#4ade80', fontSize: 13 }}>$</span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="run | stop | peers | tail | help"
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: '#e2e8f0', fontSize: 13, fontFamily: 'inherit',
          }}
          spellCheck={false}
          autoComplete="off"
        />
      </form>
    </div>
  );
}

function colorFor(kind: LogLine['kind']): string {
  switch (kind) {
    case 'ok': return '#4ade80';
    case 'err': return '#f87171';
    case 'cmd': return '#38bdf8';
    case 'sys': return '#facc15';
    default: return '#94a3b8';
  }
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function tsNow(): string {
  return new Date().toLocaleTimeString('en-US', { hour12: false });
}

export default MeshTestTerminalTab;
