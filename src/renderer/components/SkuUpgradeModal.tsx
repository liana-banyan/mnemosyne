// SkuUpgradeModal.tsx -- SEG-UX-2
// Modal wrapper around SkuUpgradePanel for the titlebar pill fast-path.
// role="dialog" + aria-modal + focus trap + Escape close + overlay click policy.
// Single source of truth for the upgrade UI; reused by Check-for-Update (SEG-UX-6).

import React, { useEffect, useRef, useCallback } from 'react';
import { SkuUpgradePanel } from './SkuUpgradePanel';

export interface SkuUpgradeModalProps {
  onClose: () => void;
  onOpenSettings: () => void;
  onUpgradeComplete?: () => void;
  // SEG-UX-6: optional update status to show alongside upgrade panel
  updateStatusLine?: string | null;
}

export function SkuUpgradeModal({
  onClose,
  onOpenSettings,
  onUpgradeComplete,
  updateStatusLine,
}: SkuUpgradeModalProps): React.ReactElement {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  // Focus trap + initial focus + Escape
  useEffect(() => {
    // Focus close button immediately on open
    closeBtnRef.current?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'Tab') {
        const modal = modalRef.current;
        if (!modal) return;
        const focusable = Array.from(
          modal.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => el.offsetParent !== null);
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9000,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={handleOverlayClick}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sku-modal-title"
        style={{
          background: '#0d1117',
          border: '1px solid rgba(110,231,183,0.25)',
          borderRadius: 14,
          maxWidth: 620,
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 24px 64px rgba(0,0,0,0.55)',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div
          style={{
            padding: '20px 24px 16px',
            borderBottom: '1px solid rgba(100,116,139,0.15)',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 12,
            }}
          >
            <h2
              id="sku-modal-title"
              style={{
                margin: 0,
                fontSize: 13,
                fontWeight: 700,
                color: '#e2e8f0',
                lineHeight: 1.55,
                flex: 1,
              }}
            >
              FULL is the in-app upgrade to Google's Gemma 4 12B, a FREE flagship open model. Bigger
              download, better performance, still free.
            </h2>
            <button
              ref={closeBtnRef}
              type="button"
              onClick={onClose}
              aria-label="Close upgrade modal"
              style={{
                background: 'none',
                border: 'none',
                color: '#475569',
                cursor: 'pointer',
                fontSize: 18,
                padding: '0 4px',
                flexShrink: 0,
                lineHeight: 1,
                borderRadius: 4,
              }}
            >
              x
            </button>
          </div>
        </div>

        {/* SEG-UX-6: app-update status line (optional) */}
        {updateStatusLine && (
          <div
            style={{
              padding: '10px 24px',
              background: 'rgba(15,23,42,0.5)',
              borderBottom: '1px solid rgba(100,116,139,0.1)',
              fontSize: 11,
              color: '#64748b',
              flexShrink: 0,
            }}
          >
            {updateStatusLine}
          </div>
        )}

        {/* SkuUpgradePanel embedded (single source of truth) */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <SkuUpgradePanel
            analytics={undefined}
            onUpgradeComplete={onUpgradeComplete}
          />
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '10px 24px 16px',
            borderTop: '1px solid rgba(100,116,139,0.1)',
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={() => {
              onOpenSettings();
              onClose();
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#475569',
              fontSize: 11,
              cursor: 'pointer',
              textDecoration: 'underline',
              padding: 0,
            }}
          >
            Open AI Tier in Settings
          </button>
        </div>
      </div>
    </div>
  );
}
