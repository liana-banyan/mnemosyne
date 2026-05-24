// Angel of Death™ · Layer 3 · LB Cooperative Stamp Verification
// Bishop scaffold BP051 close 2026-05-22 · KniPr implementation TBD
//
// THE COOPERATIVE-CLASS MOAT: every other verifier returns "AI / not AI."
// LB returns "AI / not AI · PLUS which cooperative member vouched for this
// asset, through which Cathedral Federation node, and when."
//
// Per Cathedral Federation Protocol B122 canon ("Basically TCP/IP"):
// - Stamps are stored on Cathedral Federation nodes
// - Cross-federation provenance chain is cryptographically attested
// - Revocation is first-class (revoked stamp → 'unsigned-ambiguous')
//
// KNIGHT TODO: Wire to the Cathedral Federation Protocol API.
// Endpoint contract is defined below in _FEDERATION_API_CONTRACT.
// Auth: requires valid lbAuthToken (member JWT from Supabase auth).

import type {
  Asset,
  LayerResult,
  LayerRunOptions,
  VerificationLayer,
  CooperativeStamp,
  FederationHop,
} from '../types';

// ─── Constants ────────────────────────────────────────────────────────────────

const LAYER_NAME = 'lb-stamp';
const LAYER_LABEL = 'LB Cooperative Stamp';
const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Cathedral Federation Protocol endpoint.
 * KNIGHT TODO: Replace with canonical production URL once Federation Stage 6 is live.
 * For now, use the MoneyPenny-resolved Hearth URL from window.amplify.getMoneyPennyUrl().
 */
const FEDERATION_STAMP_LOOKUP_PATH = '/api/v1/federation/stamp-lookup';

// ─── Federation API contract (for Knight's reference) ────────────────────────

/**
 * _FEDERATION_API_CONTRACT — NOT an import, just documentation.
 *
 * POST {HEARTH_URL}/api/v1/federation/stamp-lookup
 * Authorization: Bearer {lbAuthToken}
 * Content-Type: application/json
 *
 * Request body:
 * {
 *   "asset_hash": string,      // SHA-256 hex of the asset bytes
 *   "asset_url": string | null // optional — for URL-based lookups
 * }
 *
 * Response 200:
 * {
 *   "found": true,
 *   "stamp": {
 *     "member_id": string,
 *     "member_display_name": string | null,
 *     "attesting_cathedral_node": string,
 *     "stamped_at": string,       // ISO-8601
 *     "revoked": boolean,
 *     "revocation_reason": string | null,
 *     "federation_hops": Array<{
 *       "node_id": string,
 *       "node_label": string,
 *       "recorded_at": string,
 *       "signature_valid": boolean
 *     }>
 *   }
 * }
 *
 * Response 200 (not found):
 * { "found": false }
 *
 * Response 401: missing/invalid auth token → return 'detection-unavailable'
 * Response 429: rate-limited → return 'detection-unavailable' with explanation
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _FEDERATION_API_CONTRACT = null;

// ─── Response shapes ──────────────────────────────────────────────────────────

interface FederationStampLookupResponse {
  found: boolean;
  stamp?: {
    member_id: string;
    member_display_name: string | null;
    attesting_cathedral_node: string;
    stamped_at: string;
    revoked: boolean;
    revocation_reason: string | null;
    federation_hops: Array<{
      node_id: string;
      node_label: string;
      recorded_at: string;
      signature_valid: boolean;
    }>;
  };
}

// ─── Layer implementation ─────────────────────────────────────────────────────

/**
 * Layer 3: LB Cooperative Stamp Verifier.
 *
 * Checks whether a cooperative-class LB member has applied a Stamp to this
 * asset through the Cathedral Federation Protocol.
 *
 * A valid Stamp means: "A cooperative member vouched for this asset's
 * attribution. The Cathedral Federation recorded and cross-attested the claim."
 *
 * A revoked Stamp is treated as 'unsigned-ambiguous' — revocation is visible,
 * not silently hidden.
 *
 * Requires lbAuthToken to talk to the Federation endpoint.
 * Without a token, returns 'detection-unavailable'.
 *
 * This layer makes ONE network call (to the member's own Hearth node or the
 * public Cathedral Federation API). No asset bytes leave the device.
 */
export class LbStampLayer implements VerificationLayer {
  readonly name = LAYER_NAME;
  readonly layerLabel = LAYER_LABEL;

  constructor() {
    // No initialization needed — stateless HTTP client.
    // KNIGHT TODO: If MoneyPenny URL resolution is needed, inject a resolver here
    // rather than calling window.amplify directly from within the layer.
  }

  async run(asset: Asset, options: LayerRunOptions = {}): Promise<LayerResult> {
    const startMs = Date.now();
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    if (!options.lbAuthToken) {
      return this._unavailableResult(
        startMs,
        'LB Stamp verification requires an active cooperative membership. Sign in to enable Layer 3.'
      );
    }

    try {
      // Compute SHA-256 hash of the asset bytes — the Federation looks up by content hash.
      const assetHash = await this._computeAssetHash(asset);

      if (!assetHash) {
        return this._unavailableResult(startMs, 'Could not compute asset hash for Federation lookup.');
      }

      // Resolve the Federation endpoint URL.
      const baseUrl = await this._resolveFederationBaseUrl();

      // Query the Cathedral Federation Protocol stamp-lookup endpoint.
      const response = await this._federationLookup(
        baseUrl,
        assetHash,
        asset.source === 'url' ? (asset.url ?? null) : null,
        options.lbAuthToken,
        timeoutMs
      );

      if (!response.found || !response.stamp) {
        return {
          layer: LAYER_NAME,
          layerLabel: LAYER_LABEL,
          verdict: 'unsigned-ambiguous',
          confidence: 0,
          durationMs: Date.now() - startMs,
          explanation: 'No LB Cooperative Stamp found for this asset in the Cathedral Federation. The asset has not been attested by any cooperative member.',
        };
      }

      const stamp = this._mapStamp(response.stamp);

      // Revoked stamp → downgrade to unsigned-ambiguous.
      if (stamp.revoked) {
        return {
          layer: LAYER_NAME,
          layerLabel: LAYER_LABEL,
          verdict: 'unsigned-ambiguous',
          confidence: 0,
          attribution: { stamp },
          durationMs: Date.now() - startMs,
          rawData: response,
          explanation: `LB Cooperative Stamp found but REVOKED. Revocation reason: "${stamp.revocationReason ?? 'not provided'}". Treat as unsigned.`,
        };
      }

      // Valid stamp — check that all federation hops have valid signatures.
      const allHopsValid = stamp.federationHops.every((h) => h.signatureValid);

      return {
        layer: LAYER_NAME,
        layerLabel: LAYER_LABEL,
        verdict: 'verified-real', // A cooperative member explicitly attested this asset.
        // Confidence reflects hop chain integrity.
        confidence: allHopsValid ? 96 : 70,
        attribution: {
          signer: stamp.memberDisplayName ?? stamp.memberId,
          timestamp: stamp.stampedAt,
          stamp,
        },
        durationMs: Date.now() - startMs,
        rawData: response,
        explanation: allHopsValid
          ? `LB Cooperative Stamp verified. Member "${stamp.memberDisplayName ?? stamp.memberId}" attested this asset on ${stamp.stampedAt} through ${stamp.attesingCathedralNode}. ${stamp.federationHops.length} federation hop(s) — all signatures valid.`
          : `LB Cooperative Stamp found but ${stamp.federationHops.filter((h) => !h.signatureValid).length} federation hop(s) have invalid signatures. Confidence reduced.`,
      };

    } catch (err) {
      return this._unavailableResult(
        startMs,
        `LB Stamp layer error: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  // ─── Private helpers (all KNIGHT TODO) ──────────────────────────────────────

  /**
   * KNIGHT TODO: Compute SHA-256 hex digest of the asset content.
   * For 'file': hash the file bytes.
   * For 'url': fetch and hash (or use URL as the lookup key if hashing is too slow).
   * For 'clipboard-image': hash asset.binaryData.
   * Use Web Crypto API (available in Electron renderer): crypto.subtle.digest('SHA-256', ...).
   */
  private async _computeAssetHash(_asset: Asset): Promise<string | null> {
    // TODO: implement via crypto.subtle.digest
    return null; // STUB
  }

  /**
   * KNIGHT TODO: Resolve the Cathedral Federation base URL.
   * Primary: call window.amplify.getMoneyPennyUrl() to get the local Hearth node URL.
   * Fallback: use the canonical public Cathedral Federation API URL.
   */
  private async _resolveFederationBaseUrl(): Promise<string> {
    // TODO: const { url } = await window.amplify.getMoneyPennyUrl();
    // TODO: return url or fallback to 'https://federation.lianabanyan.com'
    return 'https://federation.lianabanyan.com'; // STUB
  }

  /**
   * KNIGHT TODO: POST to the Federation stamp-lookup endpoint.
   * Handle 401 (not authenticated), 429 (rate limited), and network errors gracefully.
   */
  private async _federationLookup(
    _baseUrl: string,
    _assetHash: string,
    _assetUrl: string | null,
    _authToken: string,
    _timeoutMs: number
  ): Promise<FederationStampLookupResponse> {
    // TODO: fetch(`${baseUrl}${FEDERATION_STAMP_LOOKUP_PATH}`, {
    //   method: 'POST',
    //   headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ asset_hash: assetHash, asset_url: assetUrl }),
    //   signal: AbortSignal.timeout(timeoutMs),
    // })
    void FEDERATION_STAMP_LOOKUP_PATH;
    return { found: false }; // STUB
  }

  /** Map the raw API response shape to our CooperativeStamp type. */
  private _mapStamp(raw: NonNullable<FederationStampLookupResponse['stamp']>): CooperativeStamp {
    return {
      memberId: raw.member_id,
      memberDisplayName: raw.member_display_name,
      attesingCathedralNode: raw.attesting_cathedral_node,
      stampedAt: raw.stamped_at,
      revoked: raw.revoked,
      revocationReason: raw.revocation_reason ?? undefined,
      federationHops: raw.federation_hops.map((h): FederationHop => ({
        nodeId: h.node_id,
        nodeLabel: h.node_label,
        recordedAt: h.recorded_at,
        signatureValid: h.signature_valid,
      })),
    };
  }

  private _unavailableResult(startMs: number, explanation: string): LayerResult {
    return {
      layer: LAYER_NAME,
      layerLabel: LAYER_LABEL,
      verdict: 'detection-unavailable',
      confidence: 0,
      durationMs: Date.now() - startMs,
      explanation,
    };
  }
}
