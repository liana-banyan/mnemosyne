/**
 * glow_tier.ts — v0.4.1 BP083
 *
 * Bounty-surfacing visibility via Glow tiers.
 * Per Founder ratified: "a mark makes it glow, and the more, the glowier it is."
 * Composes with Golden Keys canon (Code Breakers · Puzzle Treasure Hunters).
 *
 * VISIBILITY CANON (Heart of Peace BP051):
 *   Glow surfaces attention — NEVER gates access.
 *   All Diagnoses remain findable via search/browse.
 */

export type GlowTier = 'none' | 'dim' | 'visible' | 'bright' | 'golden';

/**
 * Compute glow tier from Marks bounty (+ optional fiat cents for ¢-class equivalent).
 *
 * 0 Marks       → none
 * 1-9 Marks     → dim
 * 10-99 Marks   → visible
 * 100-999 Marks → bright
 * 1000+ Marks   → golden (Golden Key max)
 * Fiat          → ¢-class equivalent (per Substitution canon — Marks/Fiat/Barter, NEVER converts)
 */
export function getGlowTier(marks: number, fiatCents?: number): GlowTier {
  const effective = marks + (fiatCents ? fiatCents / 100 : 0);
  if (effective >= 1000) return 'golden';
  if (effective >= 100)  return 'bright';
  if (effective >= 10)   return 'visible';
  if (effective >= 1)    return 'dim';
  return 'none';
}

/** CSS class name for a given glow tier. Applied to `.diagnosis-card`. */
export function getGlowClass(tier: GlowTier): string {
  return `glow-${tier}`;
}

/** Numeric priority for sorting (higher = more attention). */
export const GLOW_TIER_ORDER: Record<GlowTier, number> = {
  golden:  5,
  bright:  4,
  visible: 3,
  dim:     2,
  none:    1,
};
