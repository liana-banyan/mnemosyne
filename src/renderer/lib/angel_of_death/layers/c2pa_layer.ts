// Angel of Death™ · Layer 1 · C2PA Content Credentials
// Bishop scaffold BP051 close 2026-05-22 · KniPr implementation TBD
//
// Industry standard: ISO/IEC 22144 · C2PA 2.1
// Library to install: @contentauth/c2pa-js (browser/renderer) OR c2pa-node (main process)
//
// KNIGHT TODO: Choose between c2pa-js (runs in renderer, WASM-based) and c2pa-node
// (runs in main process via IPC). c2pa-node is preferred for Electron because it
// gives access to the native C2PA Rust SDK. Wire via window.amplify IPC bridge if
// using main-process approach.

import type {
  Asset,
  LayerResult,
  LayerRunOptions,
  VerificationLayer,
  C2paAttribution,
  C2paAction,
} from '../types';

// ─── Constants ────────────────────────────────────────────────────────────────

const LAYER_NAME = 'c2pa';
const LAYER_LABEL = 'C2PA Content Credentials';
const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Known trust anchors for C2PA certificate chain validation.
 * KNIGHT TODO: Pull the latest trust list from https://c2pa.org/specifications/
 * and supplement with the LB Cooperative Federation root (once that cert is minted).
 */
const KNOWN_TRUST_ANCHORS: string[] = [
  'Adobe Content Authenticity Initiative',
  'Microsoft Azure AI Content Safety',
  'Google DeepMind',
  'OpenAI',
  'Truepic',
  'BBC',
  'Intel',
  // LB Cooperative Federation root — add when cert is minted BP053+
];

// ─── Layer implementation ─────────────────────────────────────────────────────

/**
 * Layer 1: C2PA Content Credentials Verifier.
 *
 * Extracts C2PA manifests from images, video, and audio.
 * Verifies the certificate chain against known trust anchors.
 * Returns WHO signed, WHEN, WHICH tool/model, and WHAT edits were applied.
 *
 * Processing is entirely local — zero upload-back per member-sovereignty canon.
 *
 * Supported formats: JPEG, PNG, WebP, AVIF, HEIC, MP4, MOV, WAV, MP3, PDF.
 * Unsupported formats return verdict 'detection-unavailable'.
 */
export class C2paLayer implements VerificationLayer {
  readonly name = LAYER_NAME;
  readonly layerLabel = LAYER_LABEL;

  /**
   * KNIGHT TODO: Inject c2pa-node / c2pa-js SDK instance here.
   * The constructor should accept an optional pre-initialized SDK handle so
   * tests can pass a mock without loading WASM.
   *
   * Example:
   *   constructor(private readonly sdk: C2paSdk = defaultC2paSdk) {}
   */
  constructor() {
    // KNIGHT TODO: Initialize c2pa-js WASM or wire IPC to c2pa-node main process.
  }

  async run(asset: Asset, options: LayerRunOptions = {}): Promise<LayerResult> {
    const startMs = Date.now();
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    try {
      // KNIGHT TODO: Load the asset bytes.
      // For 'file' source: read via window.amplify IPC or Node fs.
      // For 'url' source: fetch the resource (no-cors headers may block — handle gracefully).
      // For 'clipboard-image': asset.binaryData is already in memory.
      const assetBytes = await this._loadAssetBytes(asset, timeoutMs);

      if (!assetBytes) {
        return this._unavailableResult(startMs, 'Could not load asset bytes for C2PA inspection.');
      }

      // KNIGHT TODO: Call the C2PA SDK to extract the manifest store.
      // With c2pa-node (main process):
      //   const store = await c2pa.read(assetBytes, asset.mimeType);
      // With c2pa-js (renderer WASM):
      //   const store = await c2pa.read({ buffer: assetBytes, mimeType: asset.mimeType });
      const store = await this._extractManifestStore(assetBytes, asset.mimeType);

      if (!store) {
        // No C2PA manifest present — asset is unsigned.
        return {
          layer: LAYER_NAME,
          layerLabel: LAYER_LABEL,
          verdict: 'unsigned-ambiguous',
          confidence: 0,
          durationMs: Date.now() - startMs,
          explanation: 'No C2PA Content Credentials manifest found. The asset has no cryptographic attribution chain. This does not mean it is AI-generated — it may simply be unsigned.',
        };
      }

      // KNIGHT TODO: Parse the active manifest.
      const attribution = await this._parseManifest(store);
      const certValid = await this._verifyCertChain(store);

      // Determine verdict.
      // - If the manifest declares an AI generation tool → 'verified-ai-signed'
      // - If the manifest attests human capture (e.g., camera make/model) → 'verified-real'
      // - If the cert chain is invalid → downgrade to 'unsigned-ambiguous'
      const verdict = this._deriveVerdict(attribution, certValid);

      return {
        layer: LAYER_NAME,
        layerLabel: LAYER_LABEL,
        verdict,
        // Cryptographic verification = high confidence, but cert validity caps it.
        confidence: certValid ? 97 : 40,
        attribution: {
          signer: attribution.signer,
          timestamp: attribution.signedAt,
          tool: attribution.tool,
          c2pa: attribution,
        },
        durationMs: Date.now() - startMs,
        rawData: store,
        explanation: this._buildExplanation(attribution, certValid),
      };

    } catch (err) {
      return this._unavailableResult(
        startMs,
        `C2PA layer error: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  // ─── Private helpers (all KNIGHT TODO) ──────────────────────────────────────

  /**
   * KNIGHT TODO: Load asset bytes from the appropriate source.
   * Return null if loading fails — do not throw.
   */
  private async _loadAssetBytes(
    asset: Asset,
    _timeoutMs: number
  ): Promise<Uint8Array | null> {
    // TODO:
    // if (asset.source === 'file' && asset.filePath) → read via IPC
    // if (asset.source === 'url' && asset.url) → fetch with timeout
    // if (asset.source === 'clipboard-image') → return asset.binaryData
    void asset;
    return null; // STUB
  }

  /**
   * KNIGHT TODO: Call the C2PA SDK to extract the manifest store.
   * Return null if no manifest is present.
   * Return the raw store object (type depends on which SDK is used).
   */
  private async _extractManifestStore(
    _bytes: Uint8Array,
    _mimeType: string | undefined
  ): Promise<unknown | null> {
    // TODO: call c2pa.read(...)
    return null; // STUB
  }

  /**
   * KNIGHT TODO: Parse the active manifest from the store into our C2paAttribution shape.
   */
  private async _parseManifest(_store: unknown): Promise<C2paAttribution> {
    // TODO: extract claim_generator, signing_cert, actions, timestamps from SDK output
    return {
      signer: 'Unknown',
      signedAt: new Date().toISOString(),
      certChainValid: false,
      editHistory: [] as C2paAction[],
    }; // STUB
  }

  /**
   * KNIGHT TODO: Verify the certificate chain in the manifest store against
   * KNOWN_TRUST_ANCHORS. Return true if chain is valid and anchor is trusted.
   */
  private async _verifyCertChain(_store: unknown): Promise<boolean> {
    // TODO: c2pa SDK exposes validation status — map to boolean
    void KNOWN_TRUST_ANCHORS;
    return false; // STUB
  }

  /**
   * Derive the verdict from attribution data and cert validity.
   * AI-generation tools in the actions list → 'verified-ai-signed'.
   * Camera/human capture + valid cert → 'verified-real'.
   * Invalid cert → 'unsigned-ambiguous'.
   */
  private _deriveVerdict(attribution: C2paAttribution, certValid: boolean): LayerResult['verdict'] {
    if (!certValid) return 'unsigned-ambiguous';

    const tool = attribution.tool?.toLowerCase() ?? '';
    // KNIGHT TODO: expand this list as new AI generators adopt C2PA.
    const aiToolPatterns = [
      'dall-e', 'midjourney', 'stable diffusion', 'firefly', 'imagen',
      'gpt-4o', 'openai', 'gen-2', 'sora', 'runway',
    ];
    const isAiTool = aiToolPatterns.some((p) => tool.includes(p));

    if (isAiTool) return 'verified-ai-signed';
    return 'verified-real';
  }

  private _buildExplanation(attribution: C2paAttribution, certValid: boolean): string {
    if (!certValid) {
      return `C2PA manifest found but certificate chain is INVALID. The manifest may have been tampered with or the signing certificate has expired. Treat as unsigned.`;
    }
    const tool = attribution.tool ? ` using ${attribution.tool}` : '';
    return `C2PA Content Credentials verified. Signed by "${attribution.signer}"${tool} on ${attribution.signedAt}. Certificate chain validates against ${attribution.trustAnchor ?? 'known trust anchor'}.`;
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
