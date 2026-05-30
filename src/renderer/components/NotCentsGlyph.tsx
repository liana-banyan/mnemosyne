// BP041 SAGA 3 — NotCents custom font glyph (replaces inline-PNG stopgap).
//
// Renders the canonical NotCents character (D with two vertical strokes)
// via the CAINotCents single-glyph font at PUA codepoint U+E000.
//
// Font file: src/renderer/public/fonts/cai-notcents.{woff2,ttf}
// Generated: scripts/generate_notcents_font.py (fonttools; SSPL · Pledge #2260)
//
// Benefits over inline-PNG (Bishop stopgap in fd17e52):
//   - CSS-styleable (color, size, weight, opacity, transform)
//   - Selectable text — member can copy NotCents in any text context
//   - Resolution-independent vector — crisp at any zoom level
//   - Lighter (916-byte WOFF2 vs per-call image load)
//   - Works in any text flow without vertical-align hacks
//
// Founder direct (BP041): "Take the Font route, but just one character."
// Canon: project_notcents_custom_font_one_glyph_bp041.md
// NO-FIAT-CONVERSION Blood Rule — this glyph IS the visual identity of
// substitution-only cooperative economics.

import type { CSSProperties } from 'react';

interface NotCentsGlyphProps {
  size?: string;         // e.g. '1em' (default) or '1.4rem'
  alt?: string;          // accessibility label for aria-label
  style?: CSSProperties; // additional style overrides
  className?: string;
  color?: string;        // override glyph fill color (defaults to currentColor)
}

// U+E000 — Private Use Area, first slot (CAINotCents font maps glyph here)
const NOTCENTS_CHAR = '\uE000';

export function NotCentsGlyph({
  size = '1em',
  alt = 'NotCents',
  style,
  className,
  color,
}: NotCentsGlyphProps) {
  return (
    <span
      className={`cai-glyph ${className ?? ''}`}
      aria-label={alt}
      role="img"
      style={{
        fontSize: size,
        color: color ?? 'currentColor',
        ...style,
      }}
    >
      {NOTCENTS_CHAR}
    </span>
  );
}
