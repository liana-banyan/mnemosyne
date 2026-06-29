// MnemosyneC · v0.5.1 · BP085 · 2026-06-18
// §2 Truth-Always · §3 Sonnet 4.6 · Founder-ratified
//
// HelpTab — Peer-to-peer copy/paste pipeline (Founder↔Son).
// Sends text + screenshots via Supabase help_messages table.
// Realtime subscription forwarded from main process via help:new-message push.
// No horizontal scroll (NEVER SCROLL SIDEWAYS BP081 canon).
// ErrorBoundary wrapping at bottom of file.
//
// K16 v0.8.10 -- Diagnostic Mode panel added (grant Bishop scoped terminal access
// with Brand Stamp/TTL/audit/revoke + Remote Terminals pane).
// Migrated to mnemosyne repo: 2026-06-28 -- SEG-MM Novaculi BP099

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  Component,
  type ReactNode,
} from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HelpMessage {
  id: string;
  from_peer: string;
  to_peer: string | null;
  content_text: string;
  content_image_url: string | null;
  created_at: string;
}

interface HelpTabState {
  messages: HelpMessage[];
  draftText: string;
  draftImageUrl: string | null;
  draftImageBlob: File | null;
  peerStatus: 'connected' | 'disconnected' | 'connecting';
  error: string | null;
  myPeerId: string | null;
  sending: boolean;
  loadError: string | null;
  uploadingImage: boolean;
}

// ─── ErrorBoundary ────────────────────────────────────────────────────────────

interface EBState { hasError: boolean; message: string }

class HelpTabErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(err: unknown): EBState {
    return {
      hasError: true,
      message: err instanceof Error ? err.message : 'Unknown error',
    };
  }

  componentDidCatch(err: Error, info: React.ErrorInfo) {
    console.error('[HelpTab] Unhandled render error:', err, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={s.errorBoundaryContainer}>
          <div style={s.errorBoundaryBox}>
            <p style={{ margin: '0 0 12px', color: '#f87171', fontSize: 14, fontWeight: 600 }}>
              Help tab encountered an error.
            </p>
            <p style={{ margin: '0 0 16px', color: '#94a3b8', fontSize: 12 }}>
              {this.state.message}
            </p>
            <button
              style={s.reloadBtn}
              onClick={() => this.setState({ hasError: false, message: '' })}
            >
              Reload tab
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Diagnostic Mode types ────────────────────────────────────────────────────

type DiagPermStatus = 'DENIED' | 'ACTIVE' | 'EXPIRED' | 'REVOKED';
type DiagTier = 'READ_ONLY' | 'WRITE' | 'ADMIN';

interface DiagPermission {
  id: string;
  peer_id: string;
  status: string;
  expires_at: string;
  granted_at: string;
  granted_to: string;
  scope_set: string;
}

interface DiagCommand {
  id: string;
  command_key?: string;
  command_text?: string;
  tier?: string;
  status: string;
  created_at: string;
  output_blob?: string;
  output_text?: string;
  requested_by: string;
}

interface TerminalLine {
  type: 'input' | 'output' | 'error';
  text: string;
  ts: string;
}

interface PeerTerminal {
  peerId: string;
  label: string;
  ttlRemaining: number;
  lines: TerminalLine[];
  input: string;
  submitting: boolean;
}

// ─── HelpTabInner ─────────────────────────────────────────────────────────────

function HelpTabInner({ onSwitchTab }: { onSwitchTab?: (tab: string) => void } = {}) {
  const [state, setState] = useState<HelpTabState>({
    messages: [],
    draftText: '',
    draftImageUrl: null,
    draftImageBlob: null,
    peerStatus: 'connecting',
    error: null,
    myPeerId: null,
    sending: false,
    loadError: null,
    uploadingImage: false,
  });

  const threadRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Diagnostic Mode state ────────────────────────────────────────────────
  const [diagOpen, setDiagOpen] = useState(false);
  const [diagPermStatus, setDiagPermStatus] = useState<DiagPermStatus>('DENIED');
  const [diagPerm, setDiagPerm] = useState<DiagPermission | null>(null);
  const [diagTtl, setDiagTtl] = useState<5 | 15 | 60>(15);
  const [diagTier, setDiagTier] = useState<DiagTier>('READ_ONLY');
  const [diagAudit, setDiagAudit] = useState<DiagCommand[]>([]);
  const [diagGranting, setDiagGranting] = useState(false);
  const [diagRevoking, setDiagRevoking] = useState(false);
  const [diagError, setDiagError] = useState<string | null>(null);
  const [peerTerminals, setPeerTerminals] = useState<PeerTerminal[]>([]);
  const [activeTerminalPeer, setActiveTerminalPeer] = useState<string | null>(null);
  const diagPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Load peer ID + initial messages on mount ──────────────────────────────

  useEffect(() => {
    let unsubRealtime: (() => void) | undefined;

    async function init() {
      try {
        const peerIdResult = await window.amplify?.helpGetPeerId?.();
        const myPeerId = peerIdResult?.peerId ?? 'unknown';
        setState(prev => ({ ...prev, myPeerId }));

        const loadResult = await window.amplify?.helpLoadMessages?.({ limit: 50 });
        if (loadResult && 'error' in loadResult) {
          setState(prev => ({ ...prev, loadError: `Could not load messages · ${loadResult.error}`, peerStatus: 'disconnected' }));
        } else if (loadResult && Array.isArray(loadResult)) {
          setState(prev => ({
            ...prev,
            messages: loadResult as HelpMessage[],
            peerStatus: 'connected',
          }));
        }

        const subResult = await window.amplify?.helpStartRealtimeSub?.();
        if (subResult && 'error' in subResult) {
          setState(prev => ({
            ...prev,
            error: 'Realtime reconnecting · messages may be delayed',
          }));
        } else {
          setState(prev => ({ ...prev, peerStatus: 'connected' }));
        }

        unsubRealtime = window.amplify?.onHelpMessageReceived?.((msg: HelpMessage) => {
          setState(prev => {
            if (prev.messages.some(m => m.id === msg.id)) return prev;
            return { ...prev, messages: [msg, ...prev.messages] };
          });
        });
      } catch (err) {
        console.error('[HelpTab] init error:', err);
        setState(prev => ({
          ...prev,
          loadError: `Initialization error · ${err instanceof Error ? err.message : String(err)}`,
          peerStatus: 'disconnected',
        }));
      }
    }

    init();

    return () => {
      unsubRealtime?.();
    };
  }, []);

  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = 0;
    }
  }, [state.messages.length]);

  // ── Image paste handler ────────────────────────────────────────────────────

  const handlePaste = useCallback(async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const blob = item.getAsFile();
        if (!blob) return;

        setState(prev => ({ ...prev, uploadingImage: true, error: null }));

        try {
          const arrayBuffer = await blob.arrayBuffer();
          const base64 = btoa(
            String.fromCharCode(...new Uint8Array(arrayBuffer))
          );

          const uploadResult = await window.amplify?.helpUploadScreenshot?.({
            base64Data: base64,
            mimeType: blob.type,
          });

          if (!uploadResult || 'error' in uploadResult) {
            const reason = uploadResult ? (uploadResult as { error: string }).error : 'No response from upload handler';
            setState(prev => ({
              ...prev,
              uploadingImage: false,
              error: `Could not upload screenshot · ${reason}`,
            }));
            return;
          }

          setState(prev => ({
            ...prev,
            uploadingImage: false,
            draftImageUrl: uploadResult.url,
            draftImageBlob: blob,
          }));
        } catch (err) {
          setState(prev => ({
            ...prev,
            uploadingImage: false,
              error: `Could not upload screenshot · ${err instanceof Error ? err.message : 'Upload failed'}`,
          }));
        }
        return;
      }
    }
  }, []);

  // ── Send message ──────────────────────────────────────────────────────────

  const handleSend = useCallback(async () => {
    const { draftText, draftImageUrl, myPeerId, sending } = state;
    if (sending) return;
    if (!draftText.trim() && !draftImageUrl) return;

    setState(prev => ({ ...prev, sending: true, error: null }));

    try {
      const result = await window.amplify?.helpSendMessage?.({
        text: draftText.trim(),
        imageUrl: draftImageUrl,
        fromPeer: myPeerId ?? 'unknown',
        toPeer: null,
      });

      if (!result || result.success === false) {
        const reason = result ? result.error : 'No response from send handler';
        setState(prev => ({
          ...prev,
          sending: false,
          error: `Could not send message · ${reason ?? 'check connection'}`,
        }));
        return;
      }

      const optimisticMsg: HelpMessage = {
        id: result.id ?? `opt-${Date.now()}`,
        from_peer: myPeerId ?? 'unknown',
        to_peer: null,
        content_text: draftText.trim(),
        content_image_url: draftImageUrl,
        created_at: new Date().toISOString(),
      };

      setState(prev => ({
        ...prev,
        messages: [optimisticMsg, ...prev.messages],
        draftText: '',
        draftImageUrl: null,
        draftImageBlob: null,
        sending: false,
      }));

      textareaRef.current?.focus();
    } catch (err) {
      console.error('[HelpTab] send error:', err);
      setState(prev => ({
        ...prev,
        sending: false,
          error: `Could not send message · ${err instanceof Error ? err.message : 'check connection'}`,
      }));
    }
  }, [state]);

  const handleClear = useCallback(() => {
    setState(prev => ({
      ...prev,
      draftText: '',
      draftImageUrl: null,
      draftImageBlob: null,
      error: null,
    }));
    textareaRef.current?.focus();
  }, []);

  const handleOpenChannel = useCallback(() => {
    try {
      window.amplify?.openExternal?.('https://mnemosynec.ai/download#channel');
    } catch (err) {
      console.error('[HelpTab] openExternal failed:', err);
    }
  }, []);

  // ── Diagnostic Mode helpers ──────────────────────────────────────────────

  const getSupabaseConfig = useCallback((): { url: string; anonKey: string } | null => {
    const url = (window as any).__SUPABASE_URL__ ||
      (window as any).amplify?._supabaseUrl ||
      '';
    const anonKey = (window as any).__SUPABASE_ANON_KEY__ ||
      (window as any).amplify?._anonKey ||
      '';
    if (!url || !anonKey) return null;
    return { url, anonKey };
  }, []);

  const loadDiagPermission = useCallback(async () => {
    try {
      const peerId = (await window.amplify?.helpGetPeerId?.())?.peerId;
      if (!peerId) return;
      const cfg = getSupabaseConfig();
      if (!cfg) return;
      const res = await fetch(
        `${cfg.url}/rest/v1/diagnostic_permissions?peer_id=eq.${encodeURIComponent(peerId)}&order=created_at.desc&limit=1`,
        { headers: { apikey: cfg.anonKey, Authorization: `Bearer ${cfg.anonKey}` } }
      );
      const rows = await res.json() as DiagPermission[];
      if (!rows || rows.length === 0) {
        setDiagPermStatus('DENIED');
        setDiagPerm(null);
        return;
      }
      const row = rows[0];
      setDiagPerm(row);
      const now = Date.now();
      const expiresAt = new Date(row.expires_at).getTime();
      if (row.status === 'revoked') setDiagPermStatus('REVOKED');
      else if (row.status === 'expired' || expiresAt < now) setDiagPermStatus('EXPIRED');
      else if (row.status === 'active') setDiagPermStatus('ACTIVE');
      else setDiagPermStatus('DENIED');
    } catch { /* non-fatal */ }
  }, [getSupabaseConfig]);

  const loadDiagAudit = useCallback(async () => {
    try {
      const peerId = (await window.amplify?.helpGetPeerId?.())?.peerId;
      if (!peerId) return;
      const cfg = getSupabaseConfig();
      if (!cfg) return;
      const res = await fetch(
        `${cfg.url}/rest/v1/diagnostic_commands?target_peer_id=eq.${encodeURIComponent(peerId)}&order=created_at.desc&limit=20`,
        { headers: { apikey: cfg.anonKey, Authorization: `Bearer ${cfg.anonKey}` } }
      );
      const rows = await res.json() as DiagCommand[];
      setDiagAudit(Array.isArray(rows) ? rows : []);
    } catch { /* non-fatal */ }
  }, [getSupabaseConfig]);

  useEffect(() => {
    if (!diagOpen) return;
    void loadDiagPermission();
    void loadDiagAudit();
    diagPollRef.current = setInterval(() => {
      void loadDiagPermission();
      void loadDiagAudit();
    }, 15_000);
    return () => {
      if (diagPollRef.current) clearInterval(diagPollRef.current);
    };
  }, [diagOpen, loadDiagPermission, loadDiagAudit]);

  const handleGrantAccess = useCallback(async () => {
    setDiagGranting(true);
    setDiagError(null);
    try {
      const peerId = (await window.amplify?.helpGetPeerId?.())?.peerId;
      if (!peerId) throw new Error('Cannot determine peer ID');
      const cfg = getSupabaseConfig();
      if (!cfg) throw new Error('Supabase not configured');
      const expiresAt = new Date(Date.now() + diagTtl * 60 * 1000).toISOString();
      const res = await fetch(`${cfg.url}/rest/v1/diagnostic_permissions`, {
        method: 'POST',
        headers: {
          apikey: cfg.anonKey,
          Authorization: `Bearer ${cfg.anonKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          peer_id: peerId,
          expires_at: expiresAt,
          granted_to: 'bishop',
          scope_set: diagTier,
          brand_stamp_signature: '',
          peer_key_signature: '',
        }),
      });
      if (!res.ok) {
        const err = await res.json() as { message?: string };
        throw new Error(err.message ?? `HTTP ${res.status}`);
      }
      setDiagPermStatus('ACTIVE');
      await loadDiagPermission();
    } catch (err: unknown) {
      setDiagError(`Grant failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setDiagGranting(false);
    }
  }, [diagTtl, diagTier, getSupabaseConfig, loadDiagPermission]);

  const handleRevokeAccess = useCallback(async () => {
    if (!diagPerm) return;
    setDiagRevoking(true);
    setDiagError(null);
    try {
      const cfg = getSupabaseConfig();
      if (!cfg) throw new Error('Supabase not configured');
      const res = await fetch(
        `${cfg.url}/rest/v1/diagnostic_permissions?id=eq.${encodeURIComponent(diagPerm.id)}`,
        {
          method: 'PATCH',
          headers: {
            apikey: cfg.anonKey,
            Authorization: `Bearer ${cfg.anonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status: 'revoked', revoked_at: new Date().toISOString() }),
        }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDiagPermStatus('REVOKED');
      await loadDiagPermission();
    } catch (err: unknown) {
      setDiagError(`Revoke failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setDiagRevoking(false);
    }
  }, [diagPerm, getSupabaseConfig, loadDiagPermission]);

  useEffect(() => {
    if (diagPermStatus !== 'ACTIVE' || !diagOpen) return;
    void (async () => {
      try {
        const res = await window.amplify?.helpGetPeerId?.();
        const peerId = (res as { peerId?: string } | undefined)?.peerId;
        if (!peerId) return;
        setPeerTerminals((prev) => {
          if (prev.some((t) => t.peerId === peerId)) return prev;
          return [...prev, { peerId, label: peerId.slice(0, 8), ttlRemaining: diagTtl * 60, lines: [], input: '', submitting: false }];
        });
        if (!activeTerminalPeer) setActiveTerminalPeer(peerId);
      } catch { /* non-fatal */ }
    })();
  }, [diagPermStatus, diagOpen, diagTtl, activeTerminalPeer]);

  const handleTerminalSubmit = useCallback(async (peerId: string, permissionId: string) => {
    const term = peerTerminals.find((t) => t.peerId === peerId);
    if (!term || !term.input.trim()) return;
    const commandText = term.input.trim();

    setPeerTerminals((prev) => prev.map((t) =>
      t.peerId !== peerId ? t : {
        ...t,
        submitting: true,
        lines: [...t.lines, { type: 'input', text: commandText, ts: new Date().toISOString() }],
        input: '',
      }
    ));

    try {
      const cfg = getSupabaseConfig();
      if (!cfg) throw new Error('Supabase not configured');
      const res = await fetch(`${cfg.url}/functions/v1/submit-diagnostic-command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cfg.anonKey}`,
        },
        body: JSON.stringify({
          permission_id: permissionId,
          target_peer_id: peerId,
          command_key: 'command_text',
          command_text: commandText,
          tier: diagTier,
        }),
      });
      const json = await res.json() as { id?: string; status?: string; ok?: boolean; error?: string };
      if (json.id) {
        let attempts = 0;
        const pollOutput = setInterval(async () => {
          attempts++;
          try {
            const pollRes = await fetch(
              `${cfg.url}/rest/v1/diagnostic_commands?id=eq.${encodeURIComponent(json.id!)}&select=status,output_blob,output_text`,
              { headers: { apikey: cfg.anonKey, Authorization: `Bearer ${cfg.anonKey}` } }
            );
            const rows = await pollRes.json() as Array<{ status: string; output_blob?: string; output_text?: string }>;
            if (rows?.[0]?.status === 'executed') {
              clearInterval(pollOutput);
              const out = rows[0].output_text ?? rows[0].output_blob ?? '(no output)';
              setPeerTerminals((prev) => prev.map((t) =>
                t.peerId !== peerId ? t : {
                  ...t, submitting: false,
                  lines: [...t.lines, { type: 'output', text: out, ts: new Date().toISOString() }],
                }
              ));
            }
          } catch { /* ignore */ }
          if (attempts > 30) {
            clearInterval(pollOutput);
            setPeerTerminals((prev) => prev.map((t) =>
              t.peerId !== peerId ? t : { ...t, submitting: false }
            ));
          }
        }, 2000);
      } else {
        throw new Error(json.error ?? 'Submit failed');
      }
    } catch (err: unknown) {
      setPeerTerminals((prev) => prev.map((t) =>
        t.peerId !== peerId ? t : {
          ...t,
          submitting: false,
          lines: [...t.lines, { type: 'error', text: `ERROR: ${err instanceof Error ? err.message : String(err)}`, ts: new Date().toISOString() }],
        }
      ));
    }
  }, [peerTerminals, diagTier, getSupabaseConfig]);

  const handleImageClick = useCallback((url: string) => {
    try {
      window.amplify?.openExternal?.(url);
    } catch (err) {
      console.error('[HelpTab] openExternal image failed:', err);
    }
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  const { messages, draftText, draftImageUrl, peerStatus, error, loadError, myPeerId, sending, uploadingImage } = state;

  const peerStatusColor =
    peerStatus === 'connected' ? '#4ade80' :
    peerStatus === 'connecting' ? '#fbbf24' : '#f87171';

  const peerStatusLabel =
    peerStatus === 'connected' ? 'Connected' :
    peerStatus === 'connecting' ? 'Connecting…' : 'Disconnected';

  const canSend = !sending && !uploadingImage && (draftText.trim().length > 0 || draftImageUrl !== null);

  const shortPeer = myPeerId ? myPeerId.slice(0, 8) + '…' : '—';

  return (
    <div style={s.outer}>
      {/* ── Header ── */}
      <div style={s.header}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={s.headerTitle}>HELP PIPELINE</div>
          <div style={s.headerSub}>Copy / paste IO · Founder ↔ Son · peer-to-peer via Supabase</div>
          {myPeerId && (
            <div style={s.peerIdRow}>Peer: <span style={s.peerIdValue}>{shortPeer}</span></div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: peerStatusColor, display: 'inline-block', flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: peerStatusColor, fontWeight: 600 }}>{peerStatusLabel}</span>
        </div>
      </div>

      {/* ── Global error banner ── */}
      {(error || loadError) && (
        <div style={s.errorBanner}>
          <span style={{ flex: 1, fontSize: 11, color: '#fca5a5' }}>{error ?? loadError}</span>
          <button
            onClick={() => setState(prev => ({ ...prev, error: null, loadError: null }))}
            style={s.errorDismiss}
          >×</button>
        </div>
      )}

      {/* ── Message Thread ── */}
      <div ref={threadRef} style={s.thread}>
        {messages.length === 0 && !loadError && (
          <div style={s.emptyThread}>
            No messages yet. Type below and press Send →
          </div>
        )}
        {messages.map(msg => (
          <MessageRow
            key={msg.id}
            msg={msg}
            myPeerId={myPeerId}
            onImageClick={handleImageClick}
          />
        ))}
      </div>

      {/* ── Compose Area ── */}
      <div style={s.compose}>
        <div style={s.composeLabel}>Compose</div>
        <textarea
          ref={textareaRef}
          style={s.textarea}
          value={draftText}
          onChange={e => setState(prev => ({ ...prev, draftText: e.target.value }))}
          onPaste={handlePaste}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              if (canSend) handleSend();
            }
          }}
          placeholder="Type a message · or paste a screenshot (Ctrl+V)"
          rows={4}
          disabled={sending}
        />

        {uploadingImage && (
          <div style={s.uploadingIndicator}>Uploading screenshot…</div>
        )}
        {draftImageUrl && !uploadingImage && (
          <div style={s.imagePreview}>
            <img
              src={draftImageUrl}
              alt="Draft screenshot preview"
              style={s.previewImg}
            />
            <button
              style={s.removeImageBtn}
              onClick={() => setState(prev => ({ ...prev, draftImageUrl: null, draftImageBlob: null }))}
              title="Remove image"
            >×</button>
          </div>
        )}
      </div>

      {/* ── Action Buttons ── */}
      <div style={s.actions}>
        <button
          style={{ ...s.sendBtn, ...(canSend ? {} : s.sendBtnDisabled) }}
          disabled={!canSend}
          onClick={handleSend}
        >
          {sending ? 'Sending…' : 'Send →'}
        </button>
        <button style={s.clearBtn} onClick={handleClear} disabled={sending}>
          Clear
        </button>
        <div style={{ flex: 1 }} />
        <button style={s.channelLink} onClick={handleOpenChannel}>
          Manage update channel →
        </button>
      </div>

      {/* ── Diagnostic Mode Panel ── */}
      <div style={{ borderTop: '1px solid #1e2a38', flexShrink: 0 }}>
        <button
          onClick={() => setDiagOpen((v) => !v)}
          style={{
            width: '100%', padding: '8px 12px', background: 'transparent',
            border: 'none', borderBottom: diagOpen ? '1px solid #1e2a38' : 'none',
            color: '#64748b', fontSize: 11, fontWeight: 600, cursor: 'pointer',
            textAlign: 'left', display: 'flex', justifyContent: 'space-between',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <span>🔬 Diagnostic Mode</span>
          <span style={{ color: diagPermStatus === 'ACTIVE' ? '#22c55e' : '#475569', fontSize: 10 }}>
            {diagPermStatus === 'ACTIVE' ? 'ACTIVE' : diagPermStatus === 'DENIED' ? 'DENIED' : diagPermStatus} {diagOpen ? '▲' : '▼'}
          </span>
        </button>

        {diagOpen && (
          <div style={{ padding: '12px', background: '#0a0f1a', overflowY: 'auto', maxHeight: 520 }}>
            {diagError && (
              <div style={{ background: '#3b0b0b', border: '1px solid #7f1d1d', borderRadius: 6, padding: '6px 10px', marginBottom: 8, fontSize: 11, color: '#fca5a5' }}>
                {diagError}
                <button onClick={() => setDiagError(null)} style={{ float: 'right', background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', fontSize: 13 }}>x</button>
              </div>
            )}

            {/* (a) Permission status badge */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{
                  padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700,
                  background:
                    diagPermStatus === 'ACTIVE' ? 'rgba(34,197,94,0.15)' :
                    diagPermStatus === 'REVOKED' ? 'rgba(249,115,22,0.15)' :
                    diagPermStatus === 'EXPIRED' ? 'rgba(100,116,139,0.15)' :
                    'rgba(239,68,68,0.15)',
                  color:
                    diagPermStatus === 'ACTIVE' ? '#22c55e' :
                    diagPermStatus === 'REVOKED' ? '#f97316' :
                    diagPermStatus === 'EXPIRED' ? '#94a3b8' : '#ef4444',
                  border: '1px solid',
                  borderColor:
                    diagPermStatus === 'ACTIVE' ? 'rgba(34,197,94,0.3)' :
                    diagPermStatus === 'REVOKED' ? 'rgba(249,115,22,0.3)' :
                    diagPermStatus === 'EXPIRED' ? 'rgba(100,116,139,0.3)' : 'rgba(239,68,68,0.3)',
                }}>
                  {diagPermStatus === 'ACTIVE' && diagPerm
                    ? `ACTIVE - ${Math.max(0, Math.round((new Date(diagPerm.expires_at).getTime() - Date.now()) / 60000))} min remaining`
                    : diagPermStatus}
                </span>
                {onSwitchTab && (
                  <button
                    onClick={() => onSwitchTab('federation')}
                    style={{
                      padding: '3px 8px', borderRadius: 6, fontSize: 10, cursor: 'pointer',
                      background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)',
                      color: '#60a5fa', fontWeight: 600, fontFamily: 'system-ui, sans-serif',
                    }}
                  >
                    View Federation →
                  </button>
                )}
              </div>
              {diagPerm && diagPermStatus !== 'DENIED' && (
                <div style={{ fontSize: 10, color: '#475569' }}>
                  Granted to: {diagPerm.granted_to} · at {new Date(diagPerm.granted_at).toLocaleString()}
                </div>
              )}
            </div>

            {/* (b) Grant access button + brand stamp */}
            {diagPermStatus !== 'ACTIVE' && (
              <div style={{ marginBottom: 12 }}>
                <div style={{
                  background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)',
                  borderRadius: 8, padding: '8px 12px', marginBottom: 8,
                  fontSize: 10, color: '#64748b',
                }}>
                  <div style={{ fontWeight: 700, color: '#94a3b8', marginBottom: 2 }}>Brand Stamped by Liana Banyan Cooperative</div>
                  <div>Allows Bishop to run curated diagnostic commands on this peer. All commands logged to immutable audit chain.</div>
                </div>

                {/* (d) TTL selector */}
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4 }}>Duration:</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {([5, 15, 60] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setDiagTtl(t)}
                        style={{
                          padding: '3px 10px', borderRadius: 6, fontSize: 10, cursor: 'pointer',
                          background: diagTtl === t ? 'rgba(59,130,246,0.2)' : 'transparent',
                          border: `1px solid ${diagTtl === t ? 'rgba(59,130,246,0.5)' : 'rgba(100,116,139,0.2)'}`,
                          color: diagTtl === t ? '#60a5fa' : '#64748b',
                          fontFamily: 'system-ui, sans-serif',
                        }}
                      >
                        {t} min
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tier selector */}
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4 }}>Scope tier:</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {(['READ_ONLY', 'WRITE', 'ADMIN'] as DiagTier[]).map((t) => (
                      <button
                        key={t}
                        onClick={() => setDiagTier(t)}
                        style={{
                          padding: '3px 10px', borderRadius: 6, fontSize: 9, cursor: 'pointer',
                          background: diagTier === t ? 'rgba(59,130,246,0.2)' : 'transparent',
                          border: `1px solid ${diagTier === t ? 'rgba(59,130,246,0.5)' : 'rgba(100,116,139,0.2)'}`,
                          color: diagTier === t ? '#60a5fa' : '#64748b',
                          fontFamily: 'system-ui, sans-serif',
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => void handleGrantAccess()}
                  disabled={diagGranting}
                  style={{
                    padding: '6px 14px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                    cursor: diagGranting ? 'not-allowed' : 'pointer',
                    background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.35)',
                    color: '#22c55e', fontFamily: 'system-ui, sans-serif',
                  }}
                >
                  {diagGranting ? 'Granting...' : 'Grant Diagnostic Access'}
                </button>
              </div>
            )}

            {/* (c) Scoped command preview */}
            <details style={{ marginBottom: 12 }}>
              <summary style={{ fontSize: 10, color: '#475569', cursor: 'pointer', marginBottom: 4 }}>
                Permitted commands ({diagTier})
              </summary>
              <div style={{ fontSize: 10, color: '#64748b', paddingLeft: 8 }}>
                {diagTier === 'READ_ONLY' ? (
                  <>
                    <div>ollama_tags -- list local Ollama models</div>
                    <div>peer_presence_self -- own presence row</div>
                    <div>bonfire_lit_self -- bonfire state (last 10)</div>
                    <div>log_tail -- last 100 lines of app log</div>
                    <div>env_loader_status -- env paths checked at startup</div>
                    <div>relay_answer_poller_state -- relay poller status</div>
                    <div>ollama list / dir / Get-* / curl / ipconfig</div>
                  </>
                ) : diagTier === 'WRITE' ? (
                  <>
                    <div>All READ_ONLY commands plus:</div>
                    <div>setx / Copy-Item / Set-Content / npm install</div>
                  </>
                ) : (
                  <>
                    <div>All WRITE commands plus:</div>
                    <div>Remove-Item / Stop-Process / npm uninstall</div>
                    <div>Any command (with confirmation modal)</div>
                  </>
                )}
              </div>
            </details>

            {/* (f) Revoke access */}
            {diagPermStatus === 'ACTIVE' && (
              <button
                onClick={() => void handleRevokeAccess()}
                disabled={diagRevoking}
                style={{
                  padding: '5px 12px', borderRadius: 6, fontSize: 10, fontWeight: 600,
                  cursor: diagRevoking ? 'not-allowed' : 'pointer',
                  background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.3)',
                  color: '#f97316', fontFamily: 'system-ui, sans-serif', marginBottom: 12,
                }}
              >
                {diagRevoking ? 'Revoking...' : 'Revoke Access'}
              </button>
            )}

            {/* ── Remote Terminals ── */}
            {diagPermStatus === 'ACTIVE' && peerTerminals.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Remote Terminals
                </div>
                <div style={{ display: 'flex', gap: 4, marginBottom: 6, flexWrap: 'wrap' }}>
                  {peerTerminals.map((t) => (
                    <button
                      key={t.peerId}
                      onClick={() => setActiveTerminalPeer(t.peerId)}
                      style={{
                        padding: '3px 8px', borderRadius: 6, fontSize: 10, cursor: 'pointer',
                        background: activeTerminalPeer === t.peerId ? 'rgba(59,130,246,0.2)' : 'rgba(30,42,56,0.5)',
                        border: `1px solid ${activeTerminalPeer === t.peerId ? 'rgba(59,130,246,0.5)' : 'rgba(100,116,139,0.2)'}`,
                        color: activeTerminalPeer === t.peerId ? '#60a5fa' : '#64748b',
                        fontFamily: 'system-ui, sans-serif',
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                {peerTerminals.filter((t) => t.peerId === activeTerminalPeer).map((term) => (
                  <div key={term.peerId}>
                    <div style={{
                      background: '#050a14', border: '1px solid #1e2a38', borderRadius: 6,
                      padding: '8px', fontFamily: 'monospace', fontSize: 11,
                      height: 160, overflowY: 'auto', marginBottom: 6,
                    }}>
                      {term.lines.length === 0 && (
                        <span style={{ color: '#475569' }}>No output yet. Type a command below.</span>
                      )}
                      {term.lines.map((line, i) => (
                        <div key={i} style={{
                          color: line.type === 'input' ? '#60a5fa' : line.type === 'error' ? '#f87171' : '#94a3b8',
                          marginBottom: 2,
                          whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                        }}>
                          {line.type === 'input' ? `> ${line.text}` : line.text}
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        value={term.input}
                        onChange={(e) => setPeerTerminals((prev) => prev.map((t) =>
                          t.peerId !== term.peerId ? t : { ...t, input: e.target.value }
                        ))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !term.submitting && diagPerm) {
                            void handleTerminalSubmit(term.peerId, diagPerm.id);
                          }
                        }}
                        placeholder="Type command + Enter"
                        disabled={term.submitting}
                        style={{
                          flex: 1, background: '#0d1526', border: '1px solid #1e2a38',
                          borderRadius: 6, padding: '5px 8px', color: '#e2e8f0',
                          fontFamily: 'monospace', fontSize: 11, outline: 'none',
                        }}
                      />
                      <button
                        onClick={() => { if (diagPerm) void handleTerminalSubmit(term.peerId, diagPerm.id); }}
                        disabled={term.submitting || !term.input.trim()}
                        style={{
                          padding: '5px 10px', borderRadius: 6, fontSize: 10,
                          cursor: term.submitting || !term.input.trim() ? 'not-allowed' : 'pointer',
                          background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)',
                          color: '#60a5fa', fontFamily: 'system-ui, sans-serif',
                        }}
                      >
                        {term.submitting ? '...' : 'Run'}
                      </button>
                    </div>
                    {diagTier !== 'READ_ONLY' && (
                      <div style={{ fontSize: 9, color: '#ef4444', marginTop: 3 }}>
                        {diagTier} scope active -- commands outside allowlist will be rejected by peer
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* (e) Audit log */}
            <div>
              <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Audit Log
              </div>
              {diagAudit.length === 0 ? (
                <div style={{ fontSize: 10, color: '#475569' }}>No audit entries yet.</div>
              ) : (
                <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                  {diagAudit.map((cmd) => (
                    <div key={cmd.id} style={{
                      fontSize: 10, color: '#64748b', padding: '4px 0',
                      borderBottom: '1px solid rgba(30,42,56,0.5)',
                    }}>
                      <span style={{
                        color: cmd.status === 'executed' ? '#22c55e' : cmd.status === 'rejected' ? '#ef4444' : '#94a3b8',
                        fontWeight: 700, marginRight: 6,
                      }}>
                        {cmd.status.toUpperCase()}
                      </span>
                      <span style={{ color: '#94a3b8', marginRight: 6 }}>{cmd.command_text ?? cmd.command_key}</span>
                      <span style={{ color: '#475569' }}>by {cmd.requested_by}</span>
                      <span style={{ color: '#334155', marginLeft: 6 }}>
                        {new Date(cmd.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── MessageRow ───────────────────────────────────────────────────────────────

function MessageRow({
  msg,
  myPeerId,
  onImageClick,
}: {
  msg: HelpMessage;
  myPeerId: string | null;
  onImageClick: (url: string) => void;
}) {
  const isOwn = msg.from_peer === myPeerId;
  const shortFrom = msg.from_peer.slice(0, 8) + '…';
  const ts = (() => {
    try {
      return new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return msg.created_at;
    }
  })();

  return (
    <div style={{ ...s.msgRow, ...(isOwn ? s.msgRowOwn : {}) }}>
      <div style={s.msgMeta}>
        <span style={{ ...s.msgFrom, ...(isOwn ? { color: '#6ee7b7' } : {}) }}>
          {isOwn ? 'You' : shortFrom}
        </span>
        <span style={s.msgTime}>{ts}</span>
      </div>
      {msg.content_text && (
        <div style={s.msgText}>{msg.content_text}</div>
      )}
      {msg.content_image_url && (
        <img
          src={msg.content_image_url}
          alt="Help screenshot"
          style={s.msgImg}
          onClick={() => onImageClick(msg.content_image_url!)}
          title="Click to open full size"
        />
      )}
    </div>
  );
}

// ─── HelpTab (exported with ErrorBoundary) ────────────────────────────────────

export function HelpTab({ onSwitchTab }: { onSwitchTab?: (tab: string) => void } = {}) {
  return (
    <HelpTabErrorBoundary>
      <HelpTabInner onSwitchTab={onSwitchTab} />
    </HelpTabErrorBoundary>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  outer: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    background: '#0a0f1a',
    color: '#e2e8f0',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  header: {
    padding: '12px 14px 10px',
    borderBottom: '1px solid #1e2a38',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: '#f0fdf4',
    letterSpacing: '0.06em',
    marginBottom: 2,
  },
  headerSub: {
    fontSize: 10,
    color: '#475569',
    marginBottom: 4,
  },
  peerIdRow: {
    fontSize: 10,
    color: '#475569',
  },
  peerIdValue: {
    color: '#64748b',
    fontFamily: 'monospace',
  },
  errorBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: '#1c0a0a',
    border: '1px solid #7f1d1d',
    borderRadius: 0,
    padding: '6px 12px',
    flexShrink: 0,
  },
  errorDismiss: {
    background: 'transparent',
    border: 'none',
    color: '#94a3b8',
    cursor: 'pointer',
    fontSize: 14,
    padding: '0 2px',
    lineHeight: 1,
    flexShrink: 0,
  },
  thread: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  emptyThread: {
    color: '#334155',
    fontSize: 12,
    textAlign: 'center',
    paddingTop: 20,
  },
  msgRow: {
    background: '#0d1629',
    border: '1px solid #1e2a38',
    borderRadius: 6,
    padding: '8px 10px',
    maxWidth: '100%',
    wordBreak: 'break-word',
    overflowWrap: 'break-word',
  },
  msgRowOwn: {
    background: '#0a1f0a',
    borderColor: '#166534',
  },
  msgMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  msgFrom: {
    fontSize: 10,
    fontWeight: 700,
    color: '#64748b',
    fontFamily: 'monospace',
  },
  msgTime: {
    fontSize: 10,
    color: '#334155',
  },
  msgText: {
    fontSize: 12,
    color: '#cbd5e1',
    lineHeight: 1.55,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    overflowWrap: 'break-word',
  },
  msgImg: {
    display: 'block',
    marginTop: 6,
    maxWidth: '100%',
    maxHeight: 400,
    objectFit: 'contain',
    borderRadius: 4,
    cursor: 'pointer',
    border: '1px solid #1e2a38',
  },
  compose: {
    padding: '8px 12px',
    borderTop: '1px solid #1e2a38',
    flexShrink: 0,
  },
  composeLabel: {
    fontSize: 9,
    fontWeight: 700,
    color: '#334155',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    marginBottom: 5,
  },
  textarea: {
    width: '100%',
    background: '#0d1629',
    color: '#e2e8f0',
    border: '1px solid #1e2a38',
    borderRadius: 6,
    padding: '8px 10px',
    fontSize: 12,
    fontFamily: 'system-ui, sans-serif',
    lineHeight: 1.5,
    resize: 'vertical',
    outline: 'none',
    boxSizing: 'border-box',
    minHeight: 72,
  },
  uploadingIndicator: {
    marginTop: 6,
    fontSize: 11,
    color: '#fbbf24',
  },
  imagePreview: {
    marginTop: 6,
    position: 'relative',
    display: 'inline-block',
    maxWidth: '100%',
  },
  previewImg: {
    display: 'block',
    maxWidth: '100%',
    maxHeight: 160,
    objectFit: 'contain',
    borderRadius: 4,
    border: '1px solid #166534',
  },
  removeImageBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    background: 'rgba(0,0,0,0.7)',
    border: '1px solid #334155',
    borderRadius: '50%',
    color: '#e2e8f0',
    cursor: 'pointer',
    width: 20,
    height: 20,
    fontSize: 12,
    lineHeight: '18px',
    textAlign: 'center',
    padding: 0,
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    borderTop: '1px solid #1e2a38',
    flexShrink: 0,
  },
  sendBtn: {
    background: '#166534',
    color: '#f0fdf4',
    border: 'none',
    borderRadius: 6,
    padding: '6px 16px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'system-ui, sans-serif',
    flexShrink: 0,
  },
  sendBtnDisabled: {
    background: '#1e2a38',
    color: '#475569',
    cursor: 'default',
  },
  clearBtn: {
    background: 'transparent',
    color: '#64748b',
    border: '1px solid #1e2a38',
    borderRadius: 6,
    padding: '6px 12px',
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: 'system-ui, sans-serif',
    flexShrink: 0,
  },
  channelLink: {
    background: 'transparent',
    border: 'none',
    color: '#475569',
    fontSize: 10,
    cursor: 'pointer',
    fontFamily: 'system-ui, sans-serif',
    padding: '2px 0',
    textDecoration: 'underline',
    flexShrink: 0,
  },
  errorBoundaryContainer: {
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0a0f1a',
    padding: 20,
  },
  errorBoundaryBox: {
    background: '#1c0a0a',
    border: '1px solid #7f1d1d',
    borderRadius: 10,
    padding: 24,
    maxWidth: 380,
    textAlign: 'center',
  },
  reloadBtn: {
    background: '#7f1d1d',
    color: '#fca5a5',
    border: 'none',
    borderRadius: 6,
    padding: '6px 16px',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
    fontFamily: 'system-ui, sans-serif',
  },
};
