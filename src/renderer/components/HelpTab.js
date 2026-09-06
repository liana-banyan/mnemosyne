import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// MnemosyneC · v0.5.1 · BP085 · 2026-06-18
// §2 Truth-Always · §3 Sonnet 4.6 · Founder-ratified
//
// HelpTab — Peer-to-peer copy/paste pipeline (Founder↔Son).
// Sends text + screenshots via Supabase help_messages table.
// Realtime subscription forwarded from main process via help:new-message push.
// No horizontal scroll (NEVER SCROLL SIDEWAYS BP081 canon).
// ErrorBoundary wrapping at bottom of file.
import { useState, useEffect, useRef, useCallback, Component, } from 'react';
class HelpTabErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, message: '' };
    }
    static getDerivedStateFromError(err) {
        return {
            hasError: true,
            message: err instanceof Error ? err.message : 'Unknown error',
        };
    }
    componentDidCatch(err, info) {
        console.error('[HelpTab] Unhandled render error:', err, info);
    }
    render() {
        if (this.state.hasError) {
            return (_jsx("div", { style: s.errorBoundaryContainer, children: _jsxs("div", { style: s.errorBoundaryBox, children: [_jsx("p", { style: { margin: '0 0 12px', color: '#f87171', fontSize: 14, fontWeight: 600 }, children: "Help tab encountered an error." }), _jsx("p", { style: { margin: '0 0 16px', color: '#94a3b8', fontSize: 12 }, children: this.state.message }), _jsx("button", { style: s.reloadBtn, onClick: () => this.setState({ hasError: false, message: '' }), children: "Reload tab" })] }) }));
        }
        return this.props.children;
    }
}
// ─── HelpTabInner ─────────────────────────────────────────────────────────────
function HelpTabInner() {
    const [state, setState] = useState({
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
    const threadRef = useRef(null);
    const textareaRef = useRef(null);
    // ── Load peer ID + initial messages on mount ──────────────────────────────
    useEffect(() => {
        let unsubRealtime;
        async function init() {
            try {
                // Get stable peer ID from main process
                const peerIdResult = await window.amplify?.helpGetPeerId?.();
                const myPeerId = peerIdResult?.peerId ?? 'unknown';
                setState(prev => ({ ...prev, myPeerId }));
                // Load existing messages
                const loadResult = await window.amplify?.helpLoadMessages?.({ limit: 50 });
                if (loadResult && 'error' in loadResult) {
                    setState(prev => ({ ...prev, loadError: `Could not load messages · ${loadResult.error}`, peerStatus: 'disconnected' }));
                }
                else if (loadResult && Array.isArray(loadResult)) {
                    setState(prev => ({
                        ...prev,
                        messages: loadResult,
                        peerStatus: 'connected',
                    }));
                }
                // Start realtime subscription via main process push
                const subResult = await window.amplify?.helpStartRealtimeSub?.();
                if (subResult && 'error' in subResult) {
                    setState(prev => ({
                        ...prev,
                        error: 'Realtime reconnecting · messages may be delayed',
                    }));
                }
                else {
                    setState(prev => ({ ...prev, peerStatus: 'connected' }));
                }
                // Listen for pushed realtime messages
                unsubRealtime = window.amplify?.onHelpMessageReceived?.((msg) => {
                    setState(prev => {
                        // De-duplicate by id
                        if (prev.messages.some(m => m.id === msg.id))
                            return prev;
                        return { ...prev, messages: [msg, ...prev.messages] };
                    });
                });
            }
            catch (err) {
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
    // Auto-scroll thread to top (newest first) on new messages
    useEffect(() => {
        if (threadRef.current) {
            threadRef.current.scrollTop = 0;
        }
    }, [state.messages.length]);
    // ── Image paste handler ────────────────────────────────────────────────────
    const handlePaste = useCallback(async (e) => {
        const items = e.clipboardData?.items;
        if (!items)
            return;
        for (const item of Array.from(items)) {
            if (item.type.startsWith('image/')) {
                e.preventDefault();
                const blob = item.getAsFile();
                if (!blob)
                    return;
                setState(prev => ({ ...prev, uploadingImage: true, error: null }));
                try {
                    // Convert File blob to base64 for IPC transfer
                    const arrayBuffer = await blob.arrayBuffer();
                    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
                    const uploadResult = await window.amplify?.helpUploadScreenshot?.({
                        base64Data: base64,
                        mimeType: blob.type,
                    });
                    if (!uploadResult || 'error' in uploadResult) {
                        const reason = uploadResult ? uploadResult.error : 'No response from upload handler';
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
                }
                catch (err) {
                    setState(prev => ({
                        ...prev,
                        uploadingImage: false,
                        error: `Could not upload screenshot · ${err instanceof Error ? err.message : 'Upload failed'}`,
                    }));
                }
                return; // Only handle first image per paste event
            }
        }
    }, []);
    // ── Send message ──────────────────────────────────────────────────────────
    const handleSend = useCallback(async () => {
        const { draftText, draftImageUrl, myPeerId, sending } = state;
        if (sending)
            return;
        if (!draftText.trim() && !draftImageUrl)
            return;
        setState(prev => ({ ...prev, sending: true, error: null }));
        try {
            const result = await window.amplify?.helpSendMessage?.({
                text: draftText.trim(),
                imageUrl: draftImageUrl,
                fromPeer: myPeerId ?? 'unknown',
                toPeer: null, // broadcast
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
            // Optimistically add to thread
            const optimisticMsg = {
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
        }
        catch (err) {
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
        }
        catch (err) {
            console.error('[HelpTab] openExternal failed:', err);
        }
    }, []);
    const handleImageClick = useCallback((url) => {
        try {
            window.amplify?.openExternal?.(url);
        }
        catch (err) {
            console.error('[HelpTab] openExternal image failed:', err);
        }
    }, []);
    // ── Render ────────────────────────────────────────────────────────────────
    const { messages, draftText, draftImageUrl, peerStatus, error, loadError, myPeerId, sending, uploadingImage } = state;
    const peerStatusColor = peerStatus === 'connected' ? '#4ade80' :
        peerStatus === 'connecting' ? '#fbbf24' : '#f87171';
    const peerStatusLabel = peerStatus === 'connected' ? 'Connected' :
        peerStatus === 'connecting' ? 'Connecting…' : 'Disconnected';
    const canSend = !sending && !uploadingImage && (draftText.trim().length > 0 || draftImageUrl !== null);
    const shortPeer = myPeerId ? myPeerId.slice(0, 8) + '…' : '—';
    return (_jsxs("div", { style: s.outer, children: [_jsxs("div", { style: s.header, children: [_jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [_jsx("div", { style: s.headerTitle, children: "HELP PIPELINE" }), _jsx("div", { style: s.headerSub, children: "Copy / paste IO \u00B7 Founder \u2194 Son \u00B7 peer-to-peer via Supabase" }), myPeerId && (_jsxs("div", { style: s.peerIdRow, children: ["Peer: ", _jsx("span", { style: s.peerIdValue, children: shortPeer })] }))] }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }, children: [_jsx("span", { style: { width: 8, height: 8, borderRadius: '50%', background: peerStatusColor, display: 'inline-block', flexShrink: 0 } }), _jsx("span", { style: { fontSize: 11, color: peerStatusColor, fontWeight: 600 }, children: peerStatusLabel })] })] }), (error || loadError) && (_jsxs("div", { style: s.errorBanner, children: [_jsx("span", { style: { flex: 1, fontSize: 11, color: '#fca5a5' }, children: error ?? loadError }), _jsx("button", { onClick: () => setState(prev => ({ ...prev, error: null, loadError: null })), style: s.errorDismiss, children: "\u00D7" })] })), _jsxs("div", { ref: threadRef, style: s.thread, children: [messages.length === 0 && !loadError && (_jsx("div", { style: s.emptyThread, children: "No messages yet. Type below and press Send \u2192" })), messages.map(msg => (_jsx(MessageRow, { msg: msg, myPeerId: myPeerId, onImageClick: handleImageClick }, msg.id)))] }), _jsxs("div", { style: s.compose, children: [_jsx("div", { style: s.composeLabel, children: "Compose" }), _jsx("textarea", { ref: textareaRef, style: s.textarea, value: draftText, onChange: e => setState(prev => ({ ...prev, draftText: e.target.value })), onPaste: handlePaste, onKeyDown: e => {
                            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                e.preventDefault();
                                if (canSend)
                                    handleSend();
                            }
                        }, placeholder: "Type a message \u00B7 or paste a screenshot (Ctrl+V)", rows: 4, disabled: sending }), uploadingImage && (_jsx("div", { style: s.uploadingIndicator, children: "Uploading screenshot\u2026" })), draftImageUrl && !uploadingImage && (_jsxs("div", { style: s.imagePreview, children: [_jsx("img", { src: draftImageUrl, alt: "Draft screenshot preview", style: s.previewImg }), _jsx("button", { style: s.removeImageBtn, onClick: () => setState(prev => ({ ...prev, draftImageUrl: null, draftImageBlob: null })), title: "Remove image", children: "\u00D7" })] }))] }), _jsxs("div", { style: s.actions, children: [_jsx("button", { style: { ...s.sendBtn, ...(canSend ? {} : s.sendBtnDisabled) }, disabled: !canSend, onClick: handleSend, children: sending ? 'Sending…' : 'Send →' }), _jsx("button", { style: s.clearBtn, onClick: handleClear, disabled: sending, children: "Clear" }), _jsx("div", { style: { flex: 1 } }), _jsx("button", { style: s.channelLink, onClick: handleOpenChannel, children: "Manage update channel \u2192" })] })] }));
}
// ─── MessageRow ───────────────────────────────────────────────────────────────
function MessageRow({ msg, myPeerId, onImageClick, }) {
    const isOwn = msg.from_peer === myPeerId;
    const shortFrom = msg.from_peer.slice(0, 8) + '…';
    const ts = (() => {
        try {
            return new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        catch {
            return msg.created_at;
        }
    })();
    return (_jsxs("div", { style: { ...s.msgRow, ...(isOwn ? s.msgRowOwn : {}) }, children: [_jsxs("div", { style: s.msgMeta, children: [_jsx("span", { style: { ...s.msgFrom, ...(isOwn ? { color: '#6ee7b7' } : {}) }, children: isOwn ? 'You' : shortFrom }), _jsx("span", { style: s.msgTime, children: ts })] }), msg.content_text && (_jsx("div", { style: s.msgText, children: msg.content_text })), msg.content_image_url && (_jsx("img", { src: msg.content_image_url, alt: "Help screenshot", style: s.msgImg, onClick: () => onImageClick(msg.content_image_url), title: "Click to open full size" }))] }));
}
// ─── HelpTab (exported with ErrorBoundary) ────────────────────────────────────
export function HelpTab() {
    return (_jsx(HelpTabErrorBoundary, { children: _jsx(HelpTabInner, {}) }));
}
// ─── Styles ───────────────────────────────────────────────────────────────────
const s = {
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
