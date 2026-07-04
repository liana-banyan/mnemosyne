// ShareMnemosyneC.tsx — SEG-V0145-2 BP079
// Share modal: referral URL + clipboard copy + QR code.
// Closes on backdrop click or Escape key.

import React, { useState, useEffect, useCallback } from 'react';
import { QRCodeCanvas } from 'qrcode.react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRefUserId(): string {
  try {
    // Primary: LB auth user_id persisted by IPC on link (various keys tried)
    return (
      localStorage.getItem('mnemo_lb_user_id') ||
      localStorage.getItem('user_id') ||
      localStorage.getItem('member_id') ||
      ''
    );
  } catch {
    return '';
  }
}

function buildShareUrl(refUserId: string): string {
  const base = 'https://mnemosynec.ai/download/';
  if (refUserId) {
    return `${base}?ref=${encodeURIComponent(refUserId)}`;
  }
  return base;
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ShareMnemosyneCProps {
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ShareMnemosyneC({ onClose }: ShareMnemosyneCProps): React.ReactElement {
  const refUserId = getRefUserId();
  const shareUrl = buildShareUrl(refUserId);

  const [copied, setCopied] = useState(false);

  // Close on Escape key
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
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
    } catch {
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
      } catch { /* silent fail */ }
    }
  }, [shareUrl]);

  return (
    <div
      style={overlay}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Share MnemosyneC"
    >
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={header}>
          <div style={title}>Share MnemosyneC</div>
          <button
            onClick={onClose}
            style={closeBtn}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Tagline */}
        <p style={tagline}>
          Share the AI that remembers — free forever, runs locally, belongs to you.
        </p>

        {/* URL display */}
        <div style={urlBox}>
          <span style={urlText} title={shareUrl}>{shareUrl}</span>
        </div>

        {/* Copy button */}
        <button
          onClick={handleCopy}
          style={{
            ...copyBtn,
            ...(copied ? copyBtnCopied : {}),
          }}
        >
          {copied ? '✓ Copied!' : 'Copy Link'}
        </button>

        {/* Ref attribution note */}
        {refUserId ? (
          <div style={refNote}>
            Your referral ID is included. You may earn cooperative credit when
            someone joins through your link.
          </div>
        ) : (
          <div style={refNote}>
            Link your LB Account (Settings → LB Account) to add your referral ID
            and earn cooperative credit.
          </div>
        )}

        {/* QR code */}
        <div style={qrGap}>
          <div style={qrGapLabel}>QR Code</div>
          <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
            <QRCodeCanvas value={shareUrl} size={160} bgColor="#1a1a2e" fgColor="#e2e8f0" />
          </div>
        </div>

        {/* External open */}
        <button
          style={externalBtn}
          onClick={() => {
            try {
              (window as any).amplify?.openExternal?.(shareUrl);
            } catch {
              window.open(shareUrl, '_blank', 'noreferrer');
            }
          }}
        >
          Open in browser →
        </button>
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const overlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.72)',
  zIndex: 9800,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: 'system-ui, -apple-system, sans-serif',
};

const modal: React.CSSProperties = {
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

const header: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

const title: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: '#e2e8f0',
};

const closeBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#475569',
  fontSize: 13,
  cursor: 'pointer',
  padding: '2px 6px',
  borderRadius: 4,
  lineHeight: 1,
};

const tagline: React.CSSProperties = {
  fontSize: 11,
  color: '#64748b',
  lineHeight: 1.6,
  margin: 0,
};

const urlBox: React.CSSProperties = {
  background: 'rgba(15, 23, 42, 0.7)',
  border: '1px solid rgba(110, 231, 183, 0.25)',
  borderRadius: 7,
  padding: '9px 12px',
  overflow: 'hidden',
};

const urlText: React.CSSProperties = {
  fontSize: 11,
  color: '#6ee7b7',
  fontFamily: 'monospace',
  wordBreak: 'break-all',
  display: 'block',
};

const copyBtn: React.CSSProperties = {
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

const copyBtnCopied: React.CSSProperties = {
  background: 'rgba(110, 231, 183, 0.2)',
  borderColor: 'rgba(110, 231, 183, 0.6)',
  color: '#34d399',
};

const refNote: React.CSSProperties = {
  fontSize: 9,
  color: '#475569',
  lineHeight: 1.6,
  fontStyle: 'italic',
};

const qrGap: React.CSSProperties = {
  background: 'rgba(100, 116, 139, 0.05)',
  border: '1px dashed rgba(100, 116, 139, 0.2)',
  borderRadius: 7,
  padding: '10px 12px',
};

const qrGapLabel: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  color: '#475569',
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  marginBottom: 6,
};

const qrGapBody: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
};

const qrUrl: React.CSSProperties = {
  fontSize: 9,
  color: '#6ee7b7',
  fontFamily: 'monospace',
  wordBreak: 'break-all',
  background: 'rgba(15, 23, 42, 0.5)',
  padding: '4px 8px',
  borderRadius: 4,
  display: 'block',
};

const qrGapNote: React.CSSProperties = {
  fontSize: 9,
  color: '#475569',
  lineHeight: 1.6,
  fontStyle: 'italic',
};

const externalBtn: React.CSSProperties = {
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
