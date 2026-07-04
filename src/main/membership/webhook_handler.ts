/**
 * Stripe webhook handler -- BP087 Black Mamba Pay-to-Join
 * Real implementation with HMAC-SHA256 signature verification.
 * Handles: subscription lifecycle + checkout.session.completed + invoice events.
 */
import type { MembershipStatus } from '../../shared/membership_types';

// ---- Types ------------------------------------------------------------------

export type StripeEventType =
  | 'customer.subscription.created'
  | 'customer.subscription.updated'
  | 'customer.subscription.deleted'
  | 'checkout.session.completed'
  | 'invoice.payment_succeeded'
  | 'invoice.payment_failed';

export interface WebhookResult {
  handled: boolean;
  newStatus?: MembershipStatus;
  error?: string;
}

export interface StripeWebhookPayload {
  id: string;
  type: StripeEventType | string;
  data: {
    object: Record<string, unknown>;
  };
}

// ---- HMAC-SHA256 Stripe Signature Verification ------------------------------

/**
 * Verifies the Stripe-Signature header using HMAC-SHA256.
 * Pattern matches the reference handle-subscription-webhook implementation.
 *
 * Stripe signature format: t=<timestamp>,v1=<hex_sig>[,v1=<hex_sig>...]
 *
 * @param rawBody     - Raw request body as a string (must not be parsed first)
 * @param sigHeader   - Value of the stripe-signature header
 * @param secret      - STRIPE_MEMBERSHIP_WEBHOOK_SECRET from process.env
 */
export async function verifyStripeSignature(
  rawBody: string,
  sigHeader: string,
  secret: string
): Promise<boolean> {
  if (!secret || !sigHeader) return false;

  // Parse t= and v1= parts
  const parts = sigHeader.split(',').reduce<Record<string, string>>((acc, part) => {
    const eq = part.indexOf('=');
    if (eq !== -1) {
      acc[part.slice(0, eq)] = part.slice(eq + 1);
    }
    return acc;
  }, {});

  const timestamp = parts['t'];
  const v1Sig = parts['v1'];
  if (!timestamp || !v1Sig) return false;

  const payload = `${timestamp}.${rawBody}`;

  let key: CryptoKey;
  try {
    key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
  } catch {
    return false;
  }

  const sigBytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const expected = Array.from(new Uint8Array(sigBytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // Constant-time compare (length must match first)
  if (expected.length !== v1Sig.length) return false;

  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ v1Sig.charCodeAt(i);
  }
  return mismatch === 0;
}

// ---- Supabase membership record updater ------------------------------------

/**
 * Updates membership_payments + entity_memberships in Supabase
 * when checkout.session.completed fires for an lb_membership_stake payment.
 */
async function updateMembershipPaid(
  supabaseAdminKey: string,
  supabaseUrl: string,
  stripeSessionId: string,
  stripeCustomerId: string,
  stripeSubscriptionId: string | null
): Promise<void> {
  const headers = {
    apikey: supabaseAdminKey,
    Authorization: `Bearer ${supabaseAdminKey}`,
    'Content-Type': 'application/json',
    Prefer: 'return=minimal',
  };

  const now = new Date().toISOString();

  // 1. Update membership_payments: pending -> paid
  const paymentsUrl = `${supabaseUrl}/rest/v1/membership_payments?stripe_session_id=eq.${encodeURIComponent(stripeSessionId)}`;
  await fetch(paymentsUrl, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      status: 'paid',
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: stripeSubscriptionId,
      first_paid_at: now,
    }),
  });

  // 2. Upsert mnemosynec_members record
  const membersUrl = `${supabaseUrl}/rest/v1/mnemosynec_members`;
  await fetch(membersUrl, {
    method: 'POST',
    headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      stripe_session_id: stripeSessionId,
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: stripeSubscriptionId,
      status: 'active',
      first_paid_at: now,
      intent: 'join_cooperative',
    }),
  });

  console.log('[webhook_handler] Membership activated for session:', stripeSessionId);
}

// ---- Main handler -----------------------------------------------------------

/**
 * Handles a verified Stripe webhook event.
 *
 * Caller is responsible for:
 *   1. Reading the raw body as text (not parsed)
 *   2. Calling verifyStripeSignature() before calling this
 *   3. Parsing the JSON body into StripeWebhookPayload
 *
 * @param event           - Parsed Stripe event object
 * @param supabaseUrl     - SUPABASE_URL env var
 * @param supabaseAdminKey - SUPABASE_SERVICE_ROLE_KEY env var
 */
export async function handleWebhookEvent(
  event: StripeWebhookPayload,
  supabaseUrl?: string,
  supabaseAdminKey?: string
): Promise<WebhookResult> {
  const obj = event.data.object;

  switch (event.type as StripeEventType) {
    case 'customer.subscription.created': {
      const customerId = obj.customer as string;
      const subscriptionId = obj.id as string;
      console.log('[webhook_handler] subscription.created:', subscriptionId, 'customer:', customerId);
      return { handled: true, newStatus: 'active' };
    }

    case 'customer.subscription.updated': {
      const stripeStatus = obj.status as string;
      const newStatus: MembershipStatus =
        stripeStatus === 'active' ? 'active'
        : stripeStatus === 'trialing' ? 'active'
        : stripeStatus === 'past_due' ? 'active'
        : 'expired';
      console.log('[webhook_handler] subscription.updated status:', stripeStatus, '->', newStatus);
      return { handled: true, newStatus };
    }

    case 'customer.subscription.deleted': {
      const customerId = obj.customer as string;
      console.log('[webhook_handler] subscription.deleted customer:', customerId);
      return { handled: true, newStatus: 'cancelled' };
    }

    case 'checkout.session.completed': {
      const paymentType = (obj.metadata as Record<string, string>)?.payment_type;
      const stripeSessionId = obj.id as string;
      const stripeCustomerId = obj.customer as string;
      const stripeSubscriptionId = (obj.subscription as string | null) ?? null;

      if (paymentType === 'lb_membership_stake') {
        if (supabaseUrl && supabaseAdminKey) {
          try {
            await updateMembershipPaid(
              supabaseAdminKey,
              supabaseUrl,
              stripeSessionId,
              stripeCustomerId,
              stripeSubscriptionId
            );
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error('[webhook_handler] Failed to update membership:', msg);
            return { handled: false, error: msg };
          }
        } else {
          console.warn('[webhook_handler] checkout.session.completed: no supabase credentials provided');
        }
        return { handled: true, newStatus: 'active' };
      }

      console.log('[webhook_handler] checkout.session.completed: unrelated payment_type:', paymentType);
      return { handled: false };
    }

    case 'invoice.payment_succeeded': {
      const subscriptionId = obj.subscription as string | null;
      console.log('[webhook_handler] invoice.payment_succeeded subscription:', subscriptionId);
      return { handled: true, newStatus: 'active' };
    }

    case 'invoice.payment_failed': {
      const subscriptionId = obj.subscription as string | null;
      const failureReason =
        ((obj.last_payment_error as Record<string, string> | null)?.message) ?? 'Payment failed';
      console.log('[webhook_handler] invoice.payment_failed subscription:', subscriptionId, failureReason);
      return { handled: true, newStatus: 'expired' };
    }

    default:
      console.log('[webhook_handler] Unhandled event type:', event.type);
      return { handled: false };
  }
}

// ---- Convenience: full request handler (for server/edge use) ----------------

/**
 * Full HTTP-level handler: reads body, verifies HMAC stripe-signature, dispatches event.
 * Reads STRIPE_MEMBERSHIP_WEBHOOK_SECRET from process.env.
 */
export async function handleStripeWebhookRequest(
  rawBody: string,
  stripeSignatureHeader: string,
  supabaseUrl: string,
  supabaseAdminKey: string
): Promise<{ status: number; body: WebhookResult | { error: string } }> {
  const secret = process.env.STRIPE_MEMBERSHIP_WEBHOOK_SECRET ?? '';

  if (!secret) {
    console.error('[webhook_handler] STRIPE_MEMBERSHIP_WEBHOOK_SECRET not set');
    return { status: 500, body: { error: 'Webhook secret not configured' } };
  }

  const valid = await verifyStripeSignature(rawBody, stripeSignatureHeader, secret);
  if (!valid) {
    console.error('[webhook_handler] Invalid stripe-signature');
    return { status: 400, body: { error: 'Invalid signature' } };
  }

  let event: StripeWebhookPayload;
  try {
    event = JSON.parse(rawBody) as StripeWebhookPayload;
  } catch {
    return { status: 400, body: { error: 'Invalid JSON body' } };
  }

  const result = await handleWebhookEvent(event, supabaseUrl, supabaseAdminKey);
  return { status: 200, body: result };
}
