import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// SAGA-2 BP055 — Corner affordance refactored into 3-option popover menu.
// Options: Open Dashboard · Burst Mode · Fallback Mode
// UX: click pill to open popover; close on outside-click or Escape key.
// Voice: Heart-of-Peace labels ("Open Dashboard" not "Click here to open").
import { useCallback, useState, useRef, useEffect } from 'react';
export const DashboardCornerAffordance = () => {
    const [open, setOpen] = useState(false);
    const containerRef = useRef(null);
    const handleEnter = useCallback(() => {
        window.amplify?.setClickthrough?.(false);
    }, []);
    const handleLeave = useCallback(() => {
        if (!open)
            window.amplify?.setClickthrough?.(true);
    }, [open]);
    const toggleMenu = useCallback(() => {
        window.amplify?.setClickthrough?.(false);
        setOpen((prev) => !prev);
    }, []);
    const closeMenu = useCallback(() => {
        setOpen(false);
        window.amplify?.setClickthrough?.(true);
    }, []);
    const handleOpenDashboard = useCallback(() => {
        closeMenu();
        window.amplify?.openDashboard?.();
    }, [closeMenu]);
    const handleBurstMode = useCallback(() => {
        closeMenu();
        window.amplify?.setFrameMode?.('ai_burst');
        // Burst Mode surfaces the overlay — request it via show-overlay IPC.
        window.amplify?.showOverlay?.();
    }, [closeMenu]);
    const handleFallbackMode = useCallback(() => {
        closeMenu();
        window.amplify?.setFrameMode?.('fallback');
    }, [closeMenu]);
    // Close on outside-click
    useEffect(() => {
        if (!open)
            return;
        const onPointerDown = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                closeMenu();
            }
        };
        document.addEventListener('pointerdown', onPointerDown);
        return () => document.removeEventListener('pointerdown', onPointerDown);
    }, [open, closeMenu]);
    // Close on Escape key
    useEffect(() => {
        if (!open)
            return;
        const onKey = (e) => {
            if (e.key === 'Escape')
                closeMenu();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, closeMenu]);
    const pillStyle = {
        position: 'fixed',
        top: 12,
        left: 12,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        background: open ? 'rgba(15, 15, 30, 0.95)' : 'rgba(10, 10, 20, 0.88)',
        border: '1px solid rgba(110,231,183,0.35)',
        borderRadius: open ? '10px 10px 0 0' : 20,
        color: '#6ee7b7',
        fontSize: 13,
        fontWeight: 600,
        fontFamily: "'NotCents-CAI', 'CAINotCents', system-ui, sans-serif",
        cursor: 'pointer',
        backdropFilter: 'blur(6px)',
        boxShadow: '0 2px 10px rgba(0,0,0,0.45)',
        userSelect: 'none',
        transition: 'border-radius 80ms ease, background 80ms ease',
    };
    const popoverStyle = {
        position: 'absolute',
        top: '100%',
        left: 0,
        minWidth: '100%',
        background: 'rgba(15, 15, 30, 0.95)',
        border: '1px solid rgba(110,231,183,0.35)',
        borderTop: 'none',
        borderRadius: '0 0 10px 10px',
        overflow: 'hidden',
        backdropFilter: 'blur(6px)',
        boxShadow: '0 6px 18px rgba(0,0,0,0.55)',
    };
    const menuItemStyle = {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 12px',
        color: '#e2e8f0',
        fontSize: 12,
        fontWeight: 500,
        fontFamily: "'NotCents-CAI', 'CAINotCents', system-ui, sans-serif",
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        transition: 'background 80ms ease',
    };
    return (_jsxs("div", { ref: containerRef, style: { position: 'fixed', top: 12, left: 12, zIndex: 99999 }, onMouseEnter: handleEnter, onMouseLeave: handleLeave, children: [_jsxs("button", { type: "button", onClick: toggleMenu, title: open ? 'Close menu' : 'Open menu', "aria-label": "MnemosyneC quick actions", "aria-expanded": open, "aria-haspopup": "menu", style: pillStyle, children: [_jsx("span", { "aria-hidden": true, style: { fontSize: 16, lineHeight: 1 }, children: "\u2183" }), _jsx("span", { style: { fontSize: 11, opacity: 0.9 }, children: "Dashboard" }), _jsx("span", { "aria-hidden": true, style: { fontSize: 9, opacity: 0.6, marginLeft: 2 }, children: open ? '▲' : '▼' })] }), open && (_jsxs("div", { role: "menu", "aria-label": "MnemosyneC actions", style: popoverStyle, children: [_jsxs("div", { role: "menuitem", tabIndex: 0, onClick: handleOpenDashboard, onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleOpenDashboard();
                        } }, style: menuItemStyle, onMouseEnter: (e) => { e.currentTarget.style.background = 'rgba(110,231,183,0.1)'; }, onMouseLeave: (e) => { e.currentTarget.style.background = 'transparent'; }, children: [_jsx("span", { "aria-hidden": true, children: "\uD83E\uDE9F" }), _jsx("span", { children: "Open Dashboard" })] }), _jsxs("div", { role: "menuitem", tabIndex: 0, onClick: handleBurstMode, onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleBurstMode();
                        } }, style: menuItemStyle, onMouseEnter: (e) => { e.currentTarget.style.background = 'rgba(250,204,21,0.08)'; }, onMouseLeave: (e) => { e.currentTarget.style.background = 'transparent'; }, children: [_jsx("span", { "aria-hidden": true, children: "\uD83D\uDD25" }), _jsx("span", { children: "Burst Mode" })] }), _jsxs("div", { role: "menuitem", tabIndex: 0, onClick: handleFallbackMode, onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleFallbackMode();
                        } }, style: { ...menuItemStyle, borderTop: '1px solid rgba(110,231,183,0.1)' }, onMouseEnter: (e) => { e.currentTarget.style.background = 'rgba(59,130,246,0.08)'; }, onMouseLeave: (e) => { e.currentTarget.style.background = 'transparent'; }, children: [_jsx("span", { "aria-hidden": true, children: "\u2744\uFE0F" }), _jsx("span", { children: "Fallback Mode" })] })] }))] }));
};
export default DashboardCornerAffordance;
