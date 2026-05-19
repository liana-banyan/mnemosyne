// CaiSymbol — Cooperative AI (CAI) canonical glyph
// Doublebar backwards C — Founder canon · replaces Đ placeholder throughout Mnemosyne
// BP047: created to replace Đ (D-with-crossbar, wrong glyph) with correct doublebar-backwards-C
// Shape: right-opening arc (backwards C) with two horizontal strokes through the arc body
// BARN DRAFT — show screenshot to Founder for ratification of exact bar placement + arc curve

import type { CSSProperties } from 'react';

interface CaiSymbolProps {
  size?: string | number;
  color?: string;
  style?: CSSProperties;
  className?: string;
  'aria-label'?: string;
}

export function CaiSymbol({
  size = '1em',
  color = 'currentColor',
  style,
  className,
  'aria-label': ariaLabel = 'CAI',
}: CaiSymbolProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke={color}
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'inline-block', verticalAlign: '-0.15em', flexShrink: 0, ...style }}
      className={className}
      aria-label={ariaLabel}
      role="img"
    >
      {/* Backwards C arc — opens to the right; curves left through 3/4 of a circle */}
      <path d="M16 4 C10 4, 6 8, 6 12 C6 16, 10 20, 16 20" />
      {/* Upper bar — through the arc body at 1/3 height */}
      <line x1="6" y1="9" x2="16" y2="9" />
      {/* Lower bar — through the arc body at 2/3 height */}
      <line x1="6" y1="15" x2="16" y2="15" />
    </svg>
  );
}
