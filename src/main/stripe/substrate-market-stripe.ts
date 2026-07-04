// substrate-market-stripe.ts
// 83.3% flows to restaurant via destination charge; 16.7% application fee
// Per canon: 83.3% creator keep CANONICAL -- DO NOT ALTER

export interface DestinationChargeParams {
  totalAmountCents: number;
  currency: string;
  stripeConnectAccountId: string;
  description: string;
  customerId?: string;
}

// 16.7% application fee; 83.3% to restaurant -- CANONICAL
export function computeApplicationFee(totalAmountCents: number): number {
  return Math.round(totalAmountCents * 0.167);
}

export async function createStripeConnectExpressAccount(
  entity_id: string,
  operator_email: string
): Promise<string> {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) throw new Error('STRIPE_SECRET_KEY not set');

  const params = new URLSearchParams({
    type: 'express',
    country: 'US',
    'capabilities[transfers][requested]': 'true',
    email: operator_email,
    'metadata[lb_entity_id]': entity_id,
  });

  const res = await fetch('https://api.stripe.com/v1/accounts', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(stripeKey + ':').toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  const account = await res.json();
  if (!res.ok) {
    throw new Error(account?.error?.message ?? 'Failed to create Stripe Connect Express account');
  }

  const stripeConnectAccountId: string = account.id;

  // Store stripe_connect_account_id in member_business_profile via Supabase REST
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (supabaseUrl && supabaseServiceKey) {
    const upsertRes = await fetch(
      `${supabaseUrl}/rest/v1/member_business_profile?entity_id=eq.${encodeURIComponent(entity_id)}`,
      {
        method: 'PATCH',
        headers: {
          apikey: supabaseServiceKey,
          Authorization: `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ stripe_connect_account_id: stripeConnectAccountId }),
      }
    );
    if (!upsertRes.ok) {
      console.error('[substrate-market-stripe] Failed to store stripe_connect_account_id for entity', entity_id);
    }
  }

  return stripeConnectAccountId;
}

export async function createDestinationCharge(
  params: DestinationChargeParams
): Promise<Record<string, unknown>> {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) throw new Error('STRIPE_SECRET_KEY not set');

  const applicationFeeCents = computeApplicationFee(params.totalAmountCents);

  const chargeParams = new URLSearchParams({
    amount: String(params.totalAmountCents),
    currency: params.currency,
    'transfer_data[destination]': params.stripeConnectAccountId,
    application_fee_amount: String(applicationFeeCents),
    description: params.description,
  });

  if (params.customerId) {
    chargeParams.set('customer', params.customerId);
  }

  const res = await fetch('https://api.stripe.com/v1/payment_intents', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(stripeKey + ':').toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: chargeParams.toString(),
  });

  const result = await res.json();
  if (!res.ok) {
    throw new Error(result?.error?.message ?? 'Failed to create destination charge');
  }

  return result as Record<string, unknown>;
}
