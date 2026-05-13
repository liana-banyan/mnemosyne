// BP041 — NotCents canonical glyph (D with two vertical strokes).
//
// Unicode "Đ" (U+0110 Latin D With Stroke) is a near-match but visually wrong:
// it has ONE horizontal stroke through the body. The canonical NotCents is
// D with TWO vertical strokes (carries NO-FIAT-CONVERSION Blood Rule visually).
//
// IMMEDIATE: this component renders the canonical PNG at text-height.
// FUTURE: replace `<img>` with `<span className="cai-font">{''}</span>`
// once the single-glyph custom font lands (see Knight ticket
// P-NOTCENTS-CUSTOM-FONT). The font path maps the glyph to PUA codepoint
// U+E000 so it behaves like real Unicode within Mnemosyne — selectable,
// resizable, color-stylable.
//
// Founder direct (BP041): *"NotCents is not accurate. My png is. How do we
// get a character set that adds NotCents to the normal things operating
// systems and such use? Take the Font route, but just one character."*

import type { CSSProperties } from 'react';

interface NotCentsGlyphProps {
  size?: string;           // e.g. '1em' (default) or '1.4rem'
  alt?: string;            // accessibility label
  style?: CSSProperties;   // additional override
  className?: string;
}

export function NotCentsGlyph({
  size = '1em',
  alt = 'NotCents',
  style,
  className,
}: NotCentsGlyphProps) {
  return (
    <img
      src="/icons/notcents.png"
      alt={alt}
      className={className}
      style={{
        height: size,
        width: 'auto',
        verticalAlign: '-0.14em',
        display: 'inline-block',
        // BP041 — Founder direct: "Can we not invert the colors, so that it is
        // white outlined in black, so you can see it on a dark background or
        // light regardless, and the white box is transparent or nonexistent?"
        //
        // Source PNG: black glyph on white background.
        // filter: invert(1)         → white glyph on black background
        // mix-blend-mode: screen   → black "falls away" on any non-pure-black
        //                            surface → effectively transparent bg
        // brightness lift           → glyph reads crisp at small sizes
        //
        // Future (P-NOTCENTS-CUSTOM-FONT): replace img+filter with font
        // glyph at PUA U+E000; CSS `color` controls the rendered fill.
        filter: 'invert(1) brightness(1.15) contrast(1.1)',
        mixBlendMode: 'screen',
        imageRendering: 'auto',
        ...style,
      }}
    />
  );
}
