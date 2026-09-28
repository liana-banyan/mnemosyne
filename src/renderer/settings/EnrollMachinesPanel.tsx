// EnrollMachinesPanel.tsx -- D-BP223-X043-007 (c). Settings: "Enroll my machines".
//
// Two halves, one per machine:
//   "This machine's code": shows a code (public keys and signatures only) with a Copy button.
//   "Enroll another machine": paste that code from the other machine, check who it is, type the
//   6-digit authenticator code, click Enroll. Then do the same in the other direction.
// Main-process side: src/main/thorax/enroll_by_code_ipc.ts (all checks live in enroll_by_code.ts).
//
// D-BP223-X044-020 (0.9.40), Founder ruling 2026-09-28 (PQ008 item 1): FOUNDER ONLY and labelled so.
// The label shows first, always. The steps stay closed until the Founder opens them; the only thing
// that can enroll is the Founder's authenticator code, verified by founder-code-verify on the server
// (the seed never lives on a machine). Anyone else sees the label and nothing happens. The live
// verifier locks after 5 wrong codes (15 minutes, doubling); that answer is shown as one clean sentence.

import React, { useCallback, useEffect, useState } from 'react';
import {
  ENROLL_TITLE,
  FOUNDER_ONLY_DETAIL,
  FOUNDER_ONLY_LABEL,
  OPEN_BUTTON,
  describeEnrollResult,
  noLongDashes,
} from './enroll_ui_text';

type Amp = {
  enrollGetMyCode?: () => Promise<{ ok: boolean; code?: string; peerId?: string; label?: string; error?: string }>;
  enrollPreview?: (code: string) => Promise<{ ok: boolean; peerId?: string; label?: string; thoraxFingerprint?: string; identityFingerprint?: string; alreadyEnrolled?: boolean; error?: string }>;
  enrollSubmit?: (code: string, authCode: string) => Promise<{ ok: boolean; peerId?: string; label?: string; error?: string }>;
  enrollList?: () => Promise<{ ok: boolean; peers: Array<{ peerId: string; keyId: string; enrolledAt: string; label: string }> }>;
};

function amp(): Amp {
  if (typeof window === 'undefined') return {};
  return ((window as unknown as { amplify?: Amp }).amplify) ?? {};
}

const box: React.CSSProperties = { background: '#0d1117', border: '1px solid #1e2a38', borderRadius: 10, padding: 16, marginBottom: 14 };
const small: React.CSSProperties = { fontSize: 11, color: '#94a3b8', lineHeight: 1.5 };
const btn: React.CSSProperties = { padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: '1px solid #334155', background: 'none', color: '#cbd5e1' };

export function EnrollMachinesPanel(): React.ReactElement {
  const available = typeof amp().enrollGetMyCode === 'function';
  const [opened, setOpened] = useState(false);
  const [myCode, setMyCode] = useState<{ code: string; peerId: string; label: string } | null>(null);
  const [myErr, setMyErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pasted, setPasted] = useState('');
  const [preview, setPreview] = useState<{ peerId: string; label: string; thoraxFingerprint: string; alreadyEnrolled: boolean } | null>(null);
  const [previewErr, setPreviewErr] = useState<string | null>(null);
  const [authCode, setAuthCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; locked: boolean; text: string } | null>(null);
  const [peers, setPeers] = useState<Array<{ peerId: string; keyId: string; enrolledAt: string; label: string }>>([]);

  const refreshList = useCallback(() => {
    amp().enrollList?.().then((r) => setPeers(r?.peers ?? [])).catch(() => setPeers([]));
  }, []);

  useEffect(() => { if (available && opened) refreshList(); }, [available, opened, refreshList]);

  const showMyCode = useCallback(async () => {
    setMyErr(null);
    const r = await amp().enrollGetMyCode?.();
    if (r?.ok && r.code) { setMyCode({ code: r.code, peerId: r.peerId ?? '', label: r.label ?? '' }); setCopied(false); }
    else setMyErr(noLongDashes(r?.error ?? 'no answer from the app'));
  }, []);

  const copyMyCode = useCallback(async () => {
    if (!myCode) return;
    try { await navigator.clipboard.writeText(myCode.code); setCopied(true); } catch { setCopied(false); }
  }, [myCode]);

  const onPaste = useCallback(async (value: string) => {
    setPasted(value); setPreview(null); setPreviewErr(null); setResult(null);
    if (!value.trim()) return;
    const r = await amp().enrollPreview?.(value);
    if (r?.ok) setPreview({ peerId: r.peerId ?? '', label: r.label ?? '', thoraxFingerprint: r.thoraxFingerprint ?? '', alreadyEnrolled: !!r.alreadyEnrolled });
    else setPreviewErr(noLongDashes(r?.error ?? 'no answer from the app'));
  }, []);

  const enroll = useCallback(async () => {
    setBusy(true); setResult(null);
    try {
      const r = await amp().enrollSubmit?.(pasted, authCode);
      const outcome = describeEnrollResult(r);
      setResult({ ok: outcome.kind === 'enrolled', locked: outcome.kind === 'locked', text: outcome.text });
      if (outcome.kind === 'enrolled') { setPasted(''); setPreview(null); refreshList(); }
      setAuthCode('');
    } finally { setBusy(false); }
  }, [pasted, authCode, refreshList]);

  const header = (
    <>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#f0fdf4', marginBottom: 6 }}>{ENROLL_TITLE}</div>
      <div data-testid="enroll-founder-only-label" style={{ fontSize: 12, fontWeight: 700, color: '#fcd34d', marginBottom: 6 }}>{FOUNDER_ONLY_LABEL}</div>
      <div style={{ ...small, marginBottom: 12 }}>{FOUNDER_ONLY_DETAIL}</div>
    </>
  );

  if (!available) {
    return <div style={box} id="settings-section-enroll-founder">{header}<div style={small}>Enrollment is not available in this build.</div></div>;
  }

  if (!opened) {
    return (
      <div style={box} id="settings-section-enroll-founder">
        {header}
        <button style={btn} onClick={() => setOpened(true)}>{OPEN_BUTTON}</button>
      </div>
    );
  }

  return (
    <div style={box} id="settings-section-enroll-founder">
      {header}
      <div style={{ ...small, marginBottom: 12 }}>
        Enrolled machines trust each other's signed keys, so relayed messages between them are encrypted end to end.
        Do it once in each direction: show this machine's code, then paste it on the other machine and type the
        Founder's authenticator code there.
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 6 }}>1. This machine's code</div>
      {!myCode ? (
        <button style={btn} onClick={() => { void showMyCode(); }}>Show this machine's code</button>
      ) : (
        <div>
          <div style={small}>{myCode.label} ({myCode.peerId}). Valid for 24 hours. Public keys only; safe to copy.</div>
          <textarea readOnly value={myCode.code} rows={3} style={{ width: '100%', fontFamily: 'monospace', fontSize: 10, background: '#0a0f1a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 6, marginTop: 6 }} />
          <button style={btn} onClick={() => { void copyMyCode(); }}>{copied ? 'Copied' : 'Copy'}</button>
        </div>
      )}
      {myErr && <div style={{ ...small, color: '#fca5a5', marginTop: 6 }}>{myErr}</div>}

      <div style={{ fontSize: 12, fontWeight: 700, color: '#cbd5e1', margin: '16px 0 6px' }}>2. Enroll another machine</div>
      <textarea
        placeholder="Paste the other machine's code here"
        value={pasted}
        onChange={(e) => { void onPaste(e.target.value); }}
        rows={3}
        style={{ width: '100%', fontFamily: 'monospace', fontSize: 10, background: '#0a0f1a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 6 }}
      />
      {previewErr && <div style={{ ...small, color: '#fca5a5' }}>{previewErr}</div>}
      {preview && (
        <div style={{ marginTop: 6 }}>
          <div style={small}>
            Machine: <b>{preview.label || '(no name)'}</b> ({preview.peerId}). Key fingerprint {preview.thoraxFingerprint}.
            {preview.alreadyEnrolled ? ' Already enrolled with this key.' : ''}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
            <input
              inputMode="numeric"
              maxLength={6}
              placeholder="Founder's 6-digit code"
              value={authCode}
              onChange={(e) => setAuthCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              style={{ width: 170, fontSize: 12, padding: '4px 8px', background: '#0a0f1a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 6 }}
            />
            <button style={{ ...btn, opacity: busy || authCode.length !== 6 ? 0.5 : 1 }} disabled={busy || authCode.length !== 6} onClick={() => { void enroll(); }}>
              {busy ? 'Checking...' : 'Enroll'}
            </button>
          </div>
        </div>
      )}
      {result && (
        <div data-testid={result.locked ? 'enroll-locked' : 'enroll-result'} style={{ ...small, marginTop: 8, color: result.ok ? '#6ee7b7' : result.locked ? '#fcd34d' : '#fca5a5' }}>
          {result.text}
        </div>
      )}

      <div style={{ fontSize: 12, fontWeight: 700, color: '#cbd5e1', margin: '16px 0 6px' }}>Enrolled on this machine</div>
      {peers.length === 0 ? (
        <div style={small}>None yet.</div>
      ) : (
        peers.map((p) => (
          <div key={p.peerId} style={small}>{p.label || '(no name)'} ({p.peerId}), since {p.enrolledAt.slice(0, 10)}</div>
        ))
      )}
    </div>
  );
}

export default EnrollMachinesPanel;
