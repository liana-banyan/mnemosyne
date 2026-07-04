/**
 * LB Membership types — BP081 K-1
 * Canonical: $5/year · 83.3% creator-keep · Cost+20% platform margin
 * Three-currency system: Credits / Marks / Joules (no fiat conversion at this layer)
 */

export type MembershipTier = 'founder' | 'standard' | 'forked';

export type MembershipStatus =
  | 'active'
  | 'expired'
  | 'pending_payment'
  | 'cancelled'
  | 'never_joined';

export interface PaymentRecord {
  id: string;
  amount: number;           // in cents (500 = $5.00)
  currency: 'usd';          // fiat only at payment layer; internal rewards use Credits/Marks/Joules
  paidAt: string;           // ISO8601
  method: 'stripe' | 'manual';
  stripeSessionId?: string;
}

export interface MembershipMetadata {
  tier: MembershipTier;
  status: MembershipStatus;
  joinedAt: string | null;   // ISO8601
  expiresAt: string | null;  // ISO8601
  renewsAt: string | null;   // ISO8601
  paymentHistory: PaymentRecord[];
  stripeCustomerId?: string;
  // Canonical pricing — read-only derivations
  readonly annualFeeUsd: 5;           // $5/year — CANONICAL
  readonly creatorKeepPercent: 83.3;  // CANONICAL — never 83
  readonly platformMarginFormula: 'cost_plus_20_percent'; // CANONICAL
}

// Canonical price helper
export const MEMBERSHIP_ANNUAL_FEE_USD = 5 as const;
export const CREATOR_KEEP_PERCENT = 83.3 as const;
export const PLATFORM_MARGIN = 'cost_plus_20_percent' as const;

// Three-currency system — no fiat conversion at data layer
export type InternalCurrency = 'credits' | 'marks' | 'joules';
export interface InternalBalance {
  credits: number;
  marks: number;
  joules: number;
  // Note: these never convert to/from fiat USD at this layer
}
