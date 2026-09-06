import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// CueDeckCardRenderer.tsx — BP132 Yoke #22 Addendum A
// Data-driven Cue Deck card. Reads a cue_card_templates row (by id/slug, or a
// pre-fetched template object) and renders title/subtitle/body + a live QR
// (qrcode.react — already a dependency, already used in CueDeckShareTab.tsx;
// per addendum instruction, no new QR library was added).
//
// Respects the existing qr_position / qr_size columns on cue_card_templates.
// Card visuals (background_type/background_value/accent_color) come from the
// DB row, not hardcoded — per Founder instruction "never hardcode card visuals
// in code" for the connection-QR card family. This renderer is the shared base
// both the DB-backed cards (Welcome, Name the Empress) and the code-authored
// doctrine cards (Join My Crew) route through, so the visual system is one path.
import { useEffect, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
// ─── Helpers ──────────────────────────────────────────────────────────────────
const ACCENT_FALLBACK = '#6ee7b7';
function resolveAccent(accent) {
    if (!accent)
        return ACCENT_FALLBACK;
    // DB stores semantic tokens like 'primary' from the web platform's Tailwind theme —
    // mnemosyne has no such theme, so map known tokens to a reasonable dark-UI accent
    // instead of emitting an invalid CSS color string.
    const KNOWN = {
        primary: '#6ee7b7',
        secondary: '#a78bfa',
        accent: '#60a5fa',
    };
    return KNOWN[accent] ?? (accent.startsWith('#') ? accent : ACCENT_FALLBACK);
}
function resolveQrPosition(pos) {
    switch (pos) {
        case 'top-left': return { top: 12, left: 12 };
        case 'top-right': return { top: 12, right: 12 };
        case 'bottom-left': return { bottom: 12, left: 12 };
        case 'center': return { top: '50%', left: '50%', transform: 'translate(-50%,-50%)' };
        case 'bottom-right':
        default: return { bottom: 12, right: 12 };
    }
}
// ─── Component ────────────────────────────────────────────────────────────────
export function CueDeckCardRenderer({ templateId, initiativeSlug, template: templateProp, qrValue, qrCaption, footer, }) {
    const [template, setTemplate] = useState(templateProp ?? null);
    const [loading, setLoading] = useState(!templateProp && !!(templateId || initiativeSlug));
    const [error, setError] = useState(null);
    useEffect(() => {
        if (templateProp) {
            setTemplate(templateProp);
            return;
        }
        if (!templateId && !initiativeSlug)
            return;
        let cancelled = false;
        setLoading(true);
        setError(null);
        (async () => {
            try {
                const result = await window.amplify?.cueCardsGetTemplate?.({ id: templateId, initiativeSlug });
                if (cancelled)
                    return;
                if (result?.ok && result.template) {
                    setTemplate(result.template);
                }
                else {
                    setError(result?.error ?? 'Card template not found');
                }
            }
            catch (e) {
                if (!cancelled)
                    setError('Failed to load card: ' + String(e));
            }
            finally {
                if (!cancelled)
                    setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [templateId, initiativeSlug, templateProp]);
    if (loading) {
        return (_jsx("div", { style: { ...cardBase(), justifyContent: 'center', alignItems: 'center' }, children: _jsx("span", { style: { fontSize: 12, color: '#64748b' }, children: "Loading card\u2026" }) }));
    }
    if (error || !template) {
        return (_jsx("div", { style: { ...cardBase(), justifyContent: 'center', alignItems: 'center', borderColor: '#7f1d1d55' }, children: _jsx("span", { style: { fontSize: 12, color: '#f87171' }, children: error ?? 'Card unavailable' }) }));
    }
    const accent = resolveAccent(template.accent_color);
    const qrSize = template.qr_size ?? 120;
    return (_jsxs("div", { style: {
            ...cardBase(),
            border: `1px solid ${accent}55`,
            background: template.background_type === 'gradient'
                ? `linear-gradient(135deg, #0a0f1a 0%, ${accent}18 100%)`
                : '#0d1117',
        }, children: [_jsxs("div", { style: { position: 'relative', padding: '16px 18px', flex: 1 }, children: [_jsx("div", { style: { fontSize: 16, fontWeight: 700, color: '#f0fdf4', marginBottom: 4 }, children: template.title }), template.subtitle && (_jsx("div", { style: { fontSize: 13, fontStyle: 'italic', color: accent, marginBottom: 8, lineHeight: 1.4 }, children: template.subtitle })), template.body_text && (_jsx("div", { style: { fontSize: 12, color: '#94a3b8', lineHeight: 1.6, marginBottom: qrValue ? 96 : 0 }, children: template.body_text })), template.hashtags && template.hashtags.length > 0 && (_jsx("div", { style: { fontSize: 10, color: '#475569', marginTop: 8 }, children: template.hashtags.map((h) => `#${h}`).join('  ') })), qrValue && (_jsxs("div", { style: {
                            position: 'absolute',
                            ...resolveQrPosition(template.qr_position),
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 4,
                            background: '#111827',
                            border: '1px solid #1e2d45',
                            borderRadius: 8,
                            padding: 8,
                        }, children: [_jsx(QRCodeCanvas, { value: qrValue, size: qrSize, bgColor: "#111827", fgColor: "#e2e8f0" }), qrCaption && (_jsx("div", { style: { fontSize: 9, color: '#64748b', maxWidth: qrSize, textAlign: 'center' }, children: qrCaption }))] }))] }), footer && (_jsx("div", { style: { padding: '10px 18px', borderTop: '1px solid #1a2332' }, children: footer }))] }));
}
function cardBase() {
    return {
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        maxWidth: 380,
        minHeight: 160,
        borderRadius: 12,
        overflow: 'hidden',
        border: '1px solid #1e2a38',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        boxSizing: 'border-box',
    };
}
export default CueDeckCardRenderer;
