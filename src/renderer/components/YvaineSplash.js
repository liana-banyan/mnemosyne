import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// YvaineSplash — BP063 SEG-3 · Yvaine "What do stars do? SHINE." greeting
// Mnemosyne-native mirror of the platform Yvaine HEOHO splash.
// Shown once on first launch (before ThreeOptionAsk).
// LocalStorage key: mnemo_yvaine_seen
import { useState, useEffect, useCallback } from 'react';
export function YvaineSplash({ onDismiss }) {
    const [visible, setVisible] = useState(true);
    const [shineGlow, setShineGlow] = useState(false);
    // Pulse the SHINE glow every 2.5s
    useEffect(() => {
        const id = setInterval(() => setShineGlow((g) => !g), 1200);
        return () => clearInterval(id);
    }, []);
    const handleDismiss = useCallback(() => {
        setVisible(false);
        // Small fade delay before calling parent dismiss
        setTimeout(onDismiss, 350);
    }, [onDismiss]);
    if (!visible)
        return null;
    return (_jsxs("div", { style: {
            position: 'fixed',
            inset: 0,
            zIndex: 9000,
            background: 'rgba(4, 7, 16, 0.97)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 32,
            animation: 'yvaine-fade-in 0.6s ease',
        }, role: "dialog", "aria-modal": "true", "aria-label": "Yvaine greeting", children: [_jsx("style", { children: `
        @keyframes yvaine-fade-in {
          from { opacity: 0; transform: scale(0.97); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes shine-pulse {
          0%, 100% { text-shadow: 0 0 12px #fff8, 0 0 32px #fffb, 0 0 64px #6ee7b740; }
          50%       { text-shadow: 0 0 24px #ffff, 0 0 60px #fff, 0 0 120px #6ee7b7aa; }
        }
        .yvaine-shine {
          animation: shine-pulse 2.4s ease-in-out infinite;
        }
        @keyframes star-drift {
          0%   { opacity: 0; transform: translateY(0px); }
          30%  { opacity: 0.6; }
          100% { opacity: 0; transform: translateY(-60px); }
        }
      ` }), _jsx("div", { style: { position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }, children: [...Array(18)].map((_, i) => (_jsx("div", { style: {
                        position: 'absolute',
                        left: `${5 + (i * 5.3) % 90}%`,
                        top: `${10 + (i * 7.1) % 75}%`,
                        width: i % 3 === 0 ? 3 : 2,
                        height: i % 3 === 0 ? 3 : 2,
                        borderRadius: '50%',
                        background: '#fff',
                        opacity: 0.15 + (i % 4) * 0.08,
                        animation: `star-drift ${3 + (i % 4)}s ease-in-out ${i * 0.3}s infinite`,
                    } }, i))) }), _jsxs("div", { style: { textAlign: 'center', padding: '0 32px', position: 'relative', zIndex: 1 }, children: [_jsx("p", { style: {
                            fontFamily: "'Georgia', 'Crimson Pro', 'Times New Roman', serif",
                            fontSize: 22,
                            fontWeight: 400,
                            color: 'rgba(250, 245, 235, 0.85)',
                            letterSpacing: '0.04em',
                            marginBottom: 12,
                            lineHeight: 1.6,
                        }, children: "What do stars do?" }), _jsx("p", { className: "yvaine-shine", style: {
                            fontFamily: "'Georgia', 'Crimson Pro', 'Times New Roman', serif",
                            fontSize: 52,
                            fontWeight: 700,
                            color: '#ffffff',
                            letterSpacing: '0.12em',
                            textTransform: 'uppercase',
                            lineHeight: 1,
                            marginBottom: 0,
                        }, children: "SHINE." }), _jsx("p", { style: {
                            marginTop: 18,
                            fontSize: 11,
                            color: 'rgba(250,245,235,0.38)',
                            fontStyle: 'italic',
                            letterSpacing: '0.06em',
                        }, children: "\u2014 Yvaine, Stardust (2007)" })] }), _jsx("button", { onClick: handleDismiss, style: {
                    background: 'none',
                    border: 'none',
                    color: 'rgba(255,255,255,0.3)',
                    fontSize: 11,
                    cursor: 'pointer',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    position: 'relative',
                    zIndex: 1,
                    padding: '4px 12px',
                    transition: 'color 0.2s ease',
                }, onMouseEnter: (e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }, onMouseLeave: (e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.3)'; }, "aria-label": "Continue to Mnemosyne", children: "Continue \u2192" })] }));
}
