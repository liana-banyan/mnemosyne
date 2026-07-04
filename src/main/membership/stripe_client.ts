/**
 * Stripe client wrapper — BP081 K-1 stub
 * Real Stripe calls wired in v0.1.61 wave. Today: structure + fail-loud config check.
 */
import { app } from 'electron';

export function getStripeApiKey(): string | null {
  const key = process.env.STRIPE_API_KEY;
  if (!key) {
    if (app.isPackaged) {
      console.error('[Stripe] STRIPE_API_KEY not set — membership checkout unavailable');
    } else {
      console.warn('[Stripe] STRIPE_API_KEY not set — running in dev stub mode');
    }
    return null;
  }
  return key;
}

export interface StripeClientConfig {
  apiKey: string | null;
  isStub: boolean;
  webhookSecret: string | null;
}

export function getStripeConfig(): StripeClientConfig {
  return {
    apiKey: process.env.STRIPE_API_KEY || null,
    isStub: !process.env.STRIPE_API_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || null,
  };
}
