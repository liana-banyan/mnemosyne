/**
 * local_answer_classifier.ts — v0.4.1 BP083
 *
 * Heuristics for detecting investigation/diagnostic question shapes.
 * Used to decide whether to show the inline "upgrade to Seasoning/Preserved" footer
 * after a Pinch Ask completes.
 *
 * Per BP078 every-click-feedback canon: suggestion is shown as inline footer ONLY —
 * NEVER as a popup. The renderer handles display; this module provides the signal.
 *
 * Triggers:
 *   - BMV < 70 (configurable via BMV_UPGRADE_THRESHOLD)
 *   - Question shape matches diagnostic/investigative indicators
 */

// ─── Diagnostic shape patterns ────────────────────────────────────────────────

const DIAGNOSTIC_PATTERNS: RegExp[] = [
  /\bmy\s+\w+/i,                                  // "my car", "my dog"
  /\bthis\s+(rash|pain|issue|problem|error)\b/i,  // "this rash", "this error"
  /\bby\s+(friday|monday|today|tomorrow|tonight)\b/i, // time-bound urgency
  /\bit'?s\s+doing\b/i,                           // "it's doing X"
  /\bi\s+have\b/i,                                // "I have..."
  /\bin\s+[A-Z][a-z]+/,                           // "in San Antonio", "in Austin"
  /\bdiagnos/i,                                   // "diagnose", "diagnosis"
  /\bundiagnosed\b/i,
  /\bwhy\s+(won't|doesn't|isn't|can't)\b/i,       // "why won't it..."
];

// ─── Threshold ────────────────────────────────────────────────────────────────

export const BMV_UPGRADE_THRESHOLD = 70;

// ─── Types ────────────────────────────────────────────────────────────────────

export type UpgradeReason = 'low_bmv' | 'diagnostic_shape';

export interface UpgradeSuggestion {
  show: boolean;
  reason: UpgradeReason | null;
  bmv?: number;
}

// ─── Classifier ───────────────────────────────────────────────────────────────

/**
 * Determine whether to show an upgrade suggestion after a Pinch Ask completes.
 *
 * @param question  The question the user asked
 * @param bmv       The final BMV score (0–100) from the canonical pipeline
 */
export function classifyForUpgrade(question: string, bmv: number): UpgradeSuggestion {
  if (bmv < BMV_UPGRADE_THRESHOLD) {
    return { show: true, reason: 'low_bmv', bmv };
  }
  const isDiagnostic = DIAGNOSTIC_PATTERNS.some((p) => p.test(question));
  if (isDiagnostic) {
    return { show: true, reason: 'diagnostic_shape' };
  }
  return { show: false, reason: null };
}
