/**
 * license_gate.ts -- License-tier-aware Catacombs access gate
 * BP087 Wave 5 -- Android of AI licensing model + 30-day 50% commercial offer
 *
 * Canon refs:
 * - canon_android_of_ai_licensing_model_sspl_base_apache_library_pledge_2260_patent_upekrithen_llc_bp087
 * - canon_30_day_50_percent_commercial_license_offer_letter_campaign_ai_companies_sspl_section_13_forcing_function_bp087
 */

// ---- Types ------------------------------------------------------------------

export type MemberTier =
  | 'non_profit'
  | 'cooperative_member'
  | 'for_profit_licensed'
  | 'for_profit_unlicensed';

export type Operation = 'read' | 'contribute';

export interface AccessResult {
  allowed: boolean;
  gated?: boolean;
  show_offer?: boolean;
  offer_ref?: string;
}

// ---- Constants --------------------------------------------------------------

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? '';
const OFFER_REF = 'canon_30_day_50_percent_commercial_license_offer';

// ---- Helpers ----------------------------------------------------------------

/**
 * Query member tier from Supabase REST.
 * Defaults to 'cooperative_member' if unavailable (cooperative-first assumption).
 */
async function getMemberTier(memberId: string): Promise<MemberTier> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return 'cooperative_member';
  }

  try {
    const url = `${SUPABASE_URL}/rest/v1/member_tiers?member_id=eq.${encodeURIComponent(memberId)}&select=tier&limit=1`;
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      // Table may not exist yet -- cooperative-first default
      return 'cooperative_member';
    }

    const rows = await res.json() as Array<{ tier?: string }>;
    const tier = rows[0]?.tier;

    if (
      tier === 'non_profit' ||
      tier === 'cooperative_member' ||
      tier === 'for_profit_licensed' ||
      tier === 'for_profit_unlicensed'
    ) {
      return tier;
    }
    return 'cooperative_member';
  } catch {
    return 'cooperative_member';
  }
}

// ---- Public API -------------------------------------------------------------

/**
 * Check whether a member may perform the requested operation on the Catacombs.
 *
 * Free tiers (non_profit, cooperative_member, for_profit_licensed): always allowed.
 * for_profit_unlicensed + read: allowed but gated -- show 30-day 50% offer.
 * for_profit_unlicensed + contribute: not allowed -- show offer.
 */
export async function checkAccess(memberId: string, operation: Operation): Promise<AccessResult> {
  const tier = await getMemberTier(memberId);

  switch (tier) {
    case 'non_profit':
    case 'cooperative_member':
    case 'for_profit_licensed':
      return { allowed: true };

    case 'for_profit_unlicensed':
      if (operation === 'read') {
        return { allowed: true, gated: true, show_offer: true, offer_ref: OFFER_REF };
      }
      // contribute
      return { allowed: false, show_offer: true, offer_ref: OFFER_REF };

    default:
      return { allowed: true };
  }
}

/**
 * Returns the 30-day 50% commercial license offer copy for display in the UI.
 */
export function licenseOfferPrompt(): string {
  return [
    'Liana Banyan Cooperative Knowledge Library -- Commercial Access',
    '',
    'You are using the Alexandrian Catacombs under the SSPL base license.',
    'As a for-profit entity, Section 13 of SSPL requires a commercial license',
    'to offer this service to others.',
    '',
    'We are extending a 30-day 50% introductory offer:',
    '  -- Standard commercial license: contact licensing@lianabanyan.com',
    '  -- 50% off for first 30 days after first access',
    '',
    'Join as a cooperative member for $5/year to unlock full access.',
    'Reference: ' + OFFER_REF,
  ].join('\n');
}
