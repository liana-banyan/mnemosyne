import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// AMPLIFY Computer — Shareable Savings Summary Card
// B37 Phase 4 — opt-in shareable "AMPLIFY saved me $X this month" card
//
// Renders a styled card. On "Copy Text", copies plain-text summary to clipboard.
// On "Save PNG", renders the card to a canvas and downloads as amplify-savings.png.
import { useRef, useState, useEffect } from 'react';
const CARD_W = 640;
const CARD_H = 360;
export const ShareCard = ({ costAvoided, totalQueries, substratePct, tokensSaved, latencyImprovementPct, period, onClose, }) => {
    const canvasRef = useRef(null);
    const [copied, setCopied] = useState(false);
    const [saved, setSaved] = useState(false);
    // ── Render card to canvas ──────────────────────────────────────────────────
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas)
            return;
        renderToCanvas(canvas);
    });
    const renderToCanvas = (canvas) => {
        canvas.width = CARD_W;
        canvas.height = CARD_H;
        const ctx = canvas.getContext('2d');
        if (!ctx)
            return;
        // Background gradient
        const bg = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
        bg.addColorStop(0, '#0f172a');
        bg.addColorStop(1, '#1e293b');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, CARD_W, CARD_H);
        // Subtle grid lines
        ctx.strokeStyle = 'rgba(255,255,255,0.03)';
        ctx.lineWidth = 1;
        for (let x = 0; x < CARD_W; x += 40) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, CARD_H);
            ctx.stroke();
        }
        for (let y = 0; y < CARD_H; y += 40) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(CARD_W, y);
            ctx.stroke();
        }
        // Border glow — gold (AI Burst color)
        const glow = ctx.createLinearGradient(0, 0, CARD_W, 0);
        glow.addColorStop(0, '#f59e0b');
        glow.addColorStop(0.5, '#fbbf24');
        glow.addColorStop(1, '#f59e0b');
        ctx.strokeStyle = glow;
        ctx.lineWidth = 3;
        ctx.strokeRect(1.5, 1.5, CARD_W - 3, CARD_H - 3);
        // Logo / brand mark
        ctx.font = 'bold 13px system-ui, sans-serif';
        ctx.fillStyle = 'rgba(245,158,11,0.85)';
        ctx.fillText('MnemosyneC', 32, 40);
        ctx.font = '11px system-ui, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillText('MnemosyneC CAI Amplifier · lianabanyan.com', 32, 58);
        // Main headline
        ctx.font = `bold 52px system-ui, sans-serif`;
        ctx.fillStyle = '#f0fdf4';
        const savingsText = `$${costAvoided.toFixed(2)}`;
        ctx.fillText(savingsText, 32, 148);
        ctx.font = '18px system-ui, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.fillText(`saved in cloud AI costs — ${period}`, 32, 178);
        // Stats row
        const stats = [
            { label: 'Queries', value: totalQueries.toLocaleString() },
            { label: 'Local served', value: `${substratePct.toFixed(0)}%` },
            { label: 'Tokens saved', value: tokensSaved > 1000 ? `${(tokensSaved / 1000).toFixed(1)}K` : tokensSaved.toString() },
            { label: 'Latency ↓', value: latencyImprovementPct > 0 ? `${latencyImprovementPct}%` : '—' },
        ];
        const colW = (CARD_W - 64) / stats.length;
        stats.forEach((stat, i) => {
            const x = 32 + i * colW;
            const y = 234;
            ctx.font = 'bold 22px system-ui, sans-serif';
            ctx.fillStyle = '#e2e8f0';
            ctx.fillText(stat.value, x, y);
            ctx.font = '11px system-ui, sans-serif';
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.fillText(stat.label.toUpperCase(), x, y + 18);
        });
        // Separator
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(32, 266);
        ctx.lineTo(CARD_W - 32, 266);
        ctx.stroke();
        // Footer
        ctx.font = '11px system-ui, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillText('NOT AnyWair — It\'s CAI™  ·  Powered by the Liana Banyan Cooperative  ·  lianabanyan.com', 32, CARD_H - 24);
        // Cooperative tagline
        ctx.font = 'bold 11px system-ui, sans-serif';
        ctx.fillStyle = 'rgba(245,158,11,0.5)';
        ctx.fillText('Join for $5/year →', CARD_W - 160, CARD_H - 24);
    };
    // ── Copy text ──────────────────────────────────────────────────────────────
    const copyText = async () => {
        const text = [
            `MnemosyneC — ${period} Savings Report`,
            `Cloud cost avoided: $${costAvoided.toFixed(2)}`,
            `Total queries: ${totalQueries.toLocaleString()}`,
            `Local served: ${substratePct.toFixed(0)}% (substrate + Ollama)`,
            `Tokens saved: ${tokensSaved.toLocaleString()}`,
            latencyImprovementPct > 0
                ? `Latency improvement: ${latencyImprovementPct}% faster than cloud`
                : '',
            '',
            'NOT AnyWair — It\'s CAI™',
            'Join the Liana Banyan Cooperative for $5/year: lianabanyan.com',
        ]
            .filter(Boolean)
            .join('\n');
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
        catch {
            // Fallback: select text
        }
    };
    // ── Save PNG ───────────────────────────────────────────────────────────────
    const savePNG = () => {
        const canvas = canvasRef.current;
        if (!canvas)
            return;
        const link = document.createElement('a');
        link.download = `amplify-savings-${new Date().toISOString().slice(0, 10)}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };
    // ── Render ─────────────────────────────────────────────────────────────────
    return (_jsxs("div", { style: {
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            flexDirection: 'column',
            gap: 16,
        }, onClick: (e) => e.target === e.currentTarget && onClose(), children: [_jsx("canvas", { ref: canvasRef, style: {
                    width: CARD_W / 2,
                    height: CARD_H / 2,
                    borderRadius: 8,
                    boxShadow: '0 0 40px rgba(245,158,11,0.25)',
                } }), _jsxs("div", { style: { display: 'flex', gap: 10 }, children: [_jsx("button", { onClick: copyText, style: {
                            padding: '10px 20px',
                            background: copied ? '#16a34a' : 'rgba(255,255,255,0.1)',
                            border: '1px solid rgba(255,255,255,0.2)',
                            borderRadius: 8,
                            color: 'white',
                            fontSize: 13,
                            cursor: 'pointer',
                        }, children: copied ? '✓ Copied!' : '📋 Copy Text' }), _jsx("button", { onClick: savePNG, style: {
                            padding: '10px 20px',
                            background: saved ? '#16a34a' : 'rgba(245,158,11,0.2)',
                            border: '1px solid rgba(245,158,11,0.4)',
                            borderRadius: 8,
                            color: 'white',
                            fontSize: 13,
                            cursor: 'pointer',
                        }, children: saved ? '✓ Saved!' : '💾 Save PNG' }), _jsx("button", { onClick: onClose, style: {
                            padding: '10px 20px',
                            background: 'transparent',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: 8,
                            color: 'rgba(255,255,255,0.5)',
                            fontSize: 13,
                            cursor: 'pointer',
                        }, children: "Close" })] }), _jsx("div", { style: { fontSize: 10, color: 'rgba(255,255,255,0.3)' }, children: "opt-in sharing \u2014 your data stays on your device" })] }));
};
export default ShareCard;
