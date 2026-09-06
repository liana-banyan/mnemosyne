import { jsx as _jsx } from "react/jsx-runtime";
// U+E000 — Private Use Area, first slot (CAINotCents font maps glyph here)
const NOTCENTS_CHAR = '\uE000';
export function NotCentsGlyph({ size = '1em', alt = 'NotCents', style, className, color, }) {
    return (_jsx("span", { className: `cai-glyph ${className ?? ''}`, "aria-label": alt, role: "img", style: {
            fontSize: size,
            color: color ?? 'currentColor',
            ...style,
        }, children: NOTCENTS_CHAR }));
}
