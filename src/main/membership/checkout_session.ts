/**
 * Stripe checkout session helper -- BP087 Black Mamba Pay-to-Join
 * Real implementation: calls create-membership-checkout Edge Function.
 */
import { MEMBERSHIP_ANNUAL_FEE_USD } from '../../shared/membership_types';

export interface CheckoutSessionResult {
  success: boolean;
  sessionId?: string;
  checkoutUrl?: string;
  error?: string;
  isStub: false;
}

/**
 * Creates a Stripe Checkout session for cooperative membership ($5/year).
 * Delegates to the create-membership-checkout Supabase Edge Function.
 *
 * @param supabaseUrl - Supabase project URL (VITE_SUPABASE_URL)
 * @param userJwt     - Authenticated user JWT from supabase.auth.session()
 * @param opts        - Optional: inviteCode, isRenewal, autoRenew, introducer_user_id
 */
export async function createMembershipCheckoutSession(
  supabaseUrl: string,
  userJwt: string,
  opts?: {
    inviteCode?: string;
    isRenewal?: boolean;
    autoRenew?: boolean;
    introducer_user_id?: string;
  }
): Promise<CheckoutSessionResult> {
  if (!supabaseUrl || !userJwt) {
    return {
      success: false,
      error: 'supabaseUrl and userJwt are required',
      isStub: false,
    };
  }

  const fnUrl = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/create-membership-checkout`;

  console.log(
    `[Membership] createCheckoutSession -- $${MEMBERSHIP_ANNUAL_FEE_USD}/year -- calling ${fnUrl}`
  );

  let resp: Response;
  try {
    resp = await fetch(fnUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userJwt}`,
      },
      body: JSON.stringify({
        inviteCode: opts?.inviteCode ?? '',
        isRenewal: opts?.isRenewal ?? false,
        autoRenew: opts?.autoRenew ?? false,
        introducer_user_id: opts?.introducer_user_id ?? '',
      }),
    });
  } catch (networkErr) {
    const msg = networkErr instanceof Error ? networkErr.message : String(networkErr);
    console.error('[Membership] Network error calling Edge Function:', msg);
    return { success: false, error: `Network error: ${msg}`, isStub: false };
  }

  let data: Record<string, unknown>;
  try {
    data = (await resp.json()) as Record<string, unknown>;
  } catch {
    return {
      success: false,
      error: `Edge Function returned non-JSON (HTTP ${resp.status})`,
      isStub: false,
    };
  }

  if (!resp.ok) {
    const errMsg = typeof data?.error === 'string' ? data.error : `HTTP ${resp.status}`;
    console.error('[Membership] Edge Function error:', errMsg);
    return { success: false, error: errMsg, isStub: false };
  }

  const checkoutUrl = typeof data?.url === 'string' ? data.url : undefined;
  if (!checkoutUrl) {
    return {
      success: false,
      error: 'Edge Function did not return a checkout URL',
      isStub: false,
    };
  }

  // Stripe session ID is embedded in the URL as a query param or path segment
  const sessionIdMatch = checkoutUrl.match(/cs_[a-zA-Z0-9_]+/);
  const sessionId = sessionIdMatch ? sessionIdMatch[0] : undefined;

  console.log('[Membership] Checkout session created:', sessionId ?? '(no session id extracted)');

  return {
    success: true,
    sessionId,
    checkoutUrl,
    isStub: false,
  };
}
