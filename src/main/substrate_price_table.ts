// substrate_price_table.ts -- D-BP155-024 / BISHOP / seg-savings-meter
//
// PART ONE of the Coupon Clipper spec (LianaBanyanPlatform/BISHOP_DROPZONE/
// SPEC_THE_COUPON_CLIPPER_PRICE_AWARE_ROUTING_AND_SAVINGS_METER_BP143.md): a versioned, dated
// table of model costs, loaded from a Founder-controlled config file, never a constant in code.
//
// This is the honesty gate for the whole savings-receipt instrument. A stale or missing rate
// must produce UNMEASURED, never a guess and never a silent fallback to the last known number.
// A confidently wrong dollar amount in front of a licensee is worse than an honest blank.

import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

export interface PriceTableRate {
  model_id: string;
  provider: string;
  input_per_mtok_usd: number;
  output_per_mtok_usd: number;
  effective_from: string; // ISO date
  effective_until: string | null; // ISO date, null = open-ended
  source_url: string;
  verified_on: string; // ISO date
  verified_by: string;
  note?: string;
}

interface PriceTableFile {
  table_version: string;
  stale_after_days: number;
  default_counterfactual_model: string;
  counterfactual_tokens_per_char: { value: number; basis: string };
  rates: PriceTableRate[];
}

export type RateLookupResult =
  | {
      ok: true;
      rate: PriceTableRate;
      table_version: string;
    }
  | {
      ok: false;
      reason: 'no_rate_for_model' | 'stale_price_table' | 'table_unreadable';
      detail: string;
      table_version: string | 'UNMEASURED';
    };

const DEFAULT_TABLE_PATH = resolve(__dirname, '..', '..', 'config', 'substrate_price_table.json');

function loadTable(tablePath: string): PriceTableFile | null {
  if (!existsSync(tablePath)) return null;
  try {
    const raw = readFileSync(tablePath, 'utf-8');
    return JSON.parse(raw) as PriceTableFile;
  } catch {
    return null;
  }
}

/**
 * Look up the rate for a model as of a given date, from a Founder-controlled price table file.
 * Refuses (returns ok:false) rather than guessing when:
 *   - the table file cannot be read/parsed
 *   - no rate entry covers this model_id for the given date
 *   - the covering entry's verified_on is older than the table's own stale_after_days window
 * `tablePath` is injectable so tests never touch the real config file.
 */
export function lookupRate(
  modelId: string,
  asOfIso: string,
  tablePath: string = DEFAULT_TABLE_PATH,
): RateLookupResult {
  const table = loadTable(tablePath);
  if (!table) {
    return {
      ok: false,
      reason: 'table_unreadable',
      detail: `price table not found or unparsable at ${tablePath}`,
      table_version: 'UNMEASURED',
    };
  }

  const asOf = new Date(asOfIso).getTime();
  const candidates = table.rates.filter((r) => {
    if (r.model_id !== modelId) return false;
    const from = new Date(r.effective_from).getTime();
    const until = r.effective_until ? new Date(r.effective_until).getTime() : Infinity;
    return asOf >= from && asOf <= until;
  });

  if (candidates.length === 0) {
    return {
      ok: false,
      reason: 'no_rate_for_model',
      detail: `no price-table entry for model_id="${modelId}" effective on ${asOfIso}`,
      table_version: table.table_version,
    };
  }

  // Most-recently-effective entry wins if more than one candidate window overlaps.
  const rate = candidates.sort(
    (a, b) => new Date(b.effective_from).getTime() - new Date(a.effective_from).getTime(),
  )[0];

  const verifiedAgeDays = (asOf - new Date(rate.verified_on).getTime()) / 86_400_000;
  if (verifiedAgeDays > table.stale_after_days) {
    return {
      ok: false,
      reason: 'stale_price_table',
      detail: `rate for "${modelId}" was verified_on ${rate.verified_on}, which is ${Math.floor(
        verifiedAgeDays,
      )} days before ${asOfIso}, older than the table's stale_after_days=${table.stale_after_days} window`,
      table_version: table.table_version,
    };
  }

  return { ok: true, rate, table_version: table.table_version };
}

/** Returns the table's declared default counterfactual model and char->token heuristic, or null
 *  if the table is unreadable. Used only to size a hypothetical flagship response from a real
 *  served answer's character length -- never to fabricate an actual-cost token count. */
export function getCounterfactualDefaults(
  tablePath: string = DEFAULT_TABLE_PATH,
): { defaultModel: string; tokensPerChar: number; basis: string } | null {
  const table = loadTable(tablePath);
  if (!table) return null;
  return {
    defaultModel: table.default_counterfactual_model,
    tokensPerChar: table.counterfactual_tokens_per_char.value,
    basis: table.counterfactual_tokens_per_char.basis,
  };
}

export { DEFAULT_TABLE_PATH };
