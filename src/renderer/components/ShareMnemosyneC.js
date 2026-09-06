import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// ShareMnemosyneC.tsx — SEG-V0145-2 BP079
// Share modal: referral URL + clipboard copy + QR code.
// Closes on backdrop click or Escape key.
import { useState, useEffect, useCallback } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
// ─── Helpers ──────────────────────────────────────────────────────────────────
function getRefUserId() {
    try {
        // Primary: LB auth user_id persisted by IPC on link (various keys tried)
        return (localStorage.getItem('mnemo_lb_user_id') ||
            localStorage.getItem('user_id') ||
            localStorage.getItem('member_id') ||
            '');
    }
    catch {
        return '';
    }
}
function buildShareUrl(refUserId) {
    const base = 'https://mnemosynec.ai/download/';
    if (refUserId) {
        return `${base}?ref=${encodeURIComponent(refUserId)}`;
    }
    return base;
}
// ─── Component ────────────────────────────────────────────────────────────────
export function ShareMnemosyneC({ onClose }) {
    const refUserId = getRefUserId();
    const shareUrl = buildShareUrl(refUserId);
    const [copied, setCopied] = useState(false);
    // Close on Escape key
    useEffect(() => {
        function onKey(e) {
            if (e.key === 'Escape')
                onClose();
        }
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);
    const handleCopy = useCallback(() => {
        try {
            navigator.clipboard.writeText(shareUrl).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2200);
            });
        }
        catch {
            // Fallback for Electron contexts where clipboard API may not be available
            try {
                const ta = document.createElement('textarea');
                ta.value = shareUrl;
                ta.style.position = 'fixed';
                ta.style.opacity = '0';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
                setCopied(true);
                setTimeout(() => setCopied(false), 2200);
            }
            catch { /* silent fail */ }
        }
    }, [shareUrl]);
    return (_jsx("div", { style: overlay, onClick: onClose, role: "dialog", "aria-modal": "true", "aria-label": "Share MnemosyneC", children: _jsxs("div", { style: modal, onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { style: header, children: [_jsx("div", { style: title, children: "Share MnemosyneC" }), _jsx("button", { onClick: onClose, style: closeBtn, "aria-label": "Close", children: "\u2715" })] }), _jsx("p", { style: tagline, children: "Share the AI that remembers \u2014 free forever, runs locally, belongs to you." }), _jsx("div", { style: urlBox, children: _jsx("span", { style: urlText, title: shareUrl, children: shareUrl }) }), _jsx("button", { onClick: handleCopy, style: {
                        ...copyBtn,
                        ...(copied ? copyBtnCopied : {}),
                    }, children: copied ? '✓ Copied!' : 'Copy Link' }), refUserId ? (_jsx("div", { style: refNote, children: "Your referral ID is included. You may earn cooperative credit when someone joins through your link." })) : (_jsx("div", { style: refNote, children: "Link your LB Account (Settings \u2192 LB Account) to add your referral ID and earn cooperative credit." })), _jsxs("div", { style: qrGap, children: [_jsx("div", { style: qrGapLabel, children: "QR Code" }), _jsx("div", { style: { display: 'flex', justifyContent: 'center', padding: '12px 0' }, children: _jsx(QRCodeCanvas, { value: shareUrl, size: 160, bgColor: "#1a1a2e", fgColor: "#e2e8f0" }) })] }), _jsx("button", { style: externalBtn, onClick: () => {
                        try {
                            window.amplify?.openExternal?.(shareUrl);
                        }
                        catch {
                            window.open(shareUrl, '_blank', 'noreferrer');
                        }
                    }, children: "Open in browser \u2192" })] }) }));
}
// ─── Styles ───────────────────────────────────────────────────────────────────
const overlay = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.72)',
    zIndex: 9800,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'system-ui, -apple-system, sans-serif',
};
const modal = {
    background: '#111827',
    border: '1px solid rgba(100, 116, 139, 0.25)',
    borderRadius: 12,
    padding: '20px 22px',
    maxWidth: 380,
    width: '90%',
    boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6)',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
};
const header = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
};
const title = {
    fontSize: 14,
    fontWeight: 700,
    color: '#e2e8f0',
};
const closeBtn = {
    background: 'none',
    border: 'none',
    color: '#475569',
    fontSize: 13,
    cursor: 'pointer',
    padding: '2px 6px',
    borderRadius: 4,
    lineHeight: 1,
};
const tagline = {
    fontSize: 11,
    color: '#64748b',
    lineHeight: 1.6,
    margin: 0,
};
const urlBox = {
    background: 'rgba(15, 23, 42, 0.7)',
    border: '1px solid rgba(110, 231, 183, 0.25)',
    borderRadius: 7,
    padding: '9px 12px',
    overflow: 'hidden',
};
const urlText = {
    fontSize: 11,
    color: '#6ee7b7',
    fontFamily: 'monospace',
    wordBreak: 'break-all',
    display: 'block',
};
const copyBtn = {
    background: 'rgba(110, 231, 183, 0.1)',
    border: '1px solid rgba(110, 231, 183, 0.35)',
    borderRadius: 7,
    color: '#6ee7b7',
    fontSize: 12,
    fontWeight: 700,
    padding: '8px 18px',
    cursor: 'pointer',
    transition: 'background 0.15s, border-color 0.15s',
    width: '100%',
};
const copyBtnCopied = {
    background: 'rgba(110, 231, 183, 0.2)',
    borderColor: 'rgba(110, 231, 183, 0.6)',
    color: '#34d399',
};
const refNote = {
    fontSize: 9,
    color: '#475569',
    lineHeight: 1.6,
    fontStyle: 'italic',
};
const qrGap = {
    background: 'rgba(100, 116, 139, 0.05)',
    border: '1px dashed rgba(100, 116, 139, 0.2)',
    borderRadius: 7,
    padding: '10px 12px',
};
const qrGapLabel = {
    fontSize: 9,
    fontWeight: 700,
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    marginBottom: 6,
};
const qrGapBody = {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
};
const qrUrl = {
    fontSize: 9,
    color: '#6ee7b7',
    fontFamily: 'monospace',
    wordBreak: 'break-all',
    background: 'rgba(15, 23, 42, 0.5)',
    padding: '4px 8px',
    borderRadius: 4,
    display: 'block',
};
const qrGapNote = {
    fontSize: 9,
    color: '#475569',
    lineHeight: 1.6,
    fontStyle: 'italic',
};
const externalBtn = {
    background: 'none',
    border: 'none',
    color: '#6ee7b7',
    fontSize: 10,
    fontWeight: 500,
    cursor: 'pointer',
    padding: 0,
    textDecoration: 'underline',
    textDecorationColor: 'rgba(110, 231, 183, 0.35)',
    alignSelf: 'flex-start',
};
export default ShareMnemosyneC;
