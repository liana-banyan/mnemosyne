// Angel of Death™ · AI Content Verifier · Type Definitions
// Bishop scaffold BP051 close 2026-05-22 · KniPr implementation TBD
//
// "He doesn't hate. He doesn't rage. He simply arrives."
// — returns empirical signal · no editorializing · no policing

// ─── Asset input ──────────────────────────────────────────────────────────────

/** File-based asset (member drags-and-drops or pastes URL). */
export interface Asset {
  /** Stable local handle for this verification request. */
  id: string;
  /** How the asset was provided. */
  source: 'file' | 'url' | 'clipboard-image';
  /** Absolute file path on disk — only set when source === 'file'. */
  filePath?: string;
  /** Remote URL — only set when source === 'url'. */
  url?: string;
  /** In-memory binary for clipboard-pasted images. */
  binaryData?: Uint8Array;
  /** MIME type when known. */
  mimeType?: string;
  /** File name for display. */
  displayName: string;
  /** Byte size when known. */
  sizeBytes?: number;
}

// ─── Layer-level result ───────────────────────────────────────────────────────

/**
 * Verdicts are deliberately narrow.
 * - 'verified-real'       → cryptographic evidence of human attribution (C2PA + valid cert chain, or LB Stamp from human member)
 * - 'verified-ai-signed'  → AI-generated with a valid attribution chain (C2PA + AI tool manifest, SynthID hit, etc.)
 * - 'unsigned-ambiguous'  → no cryptographic signal · may be human · may be AI · layer cannot resolve
 * - 'detection-unavailable' → layer could not run (missing dependency, network error, unsupported format)
 *
 * Honest-uncertainty discipline: never claim certainty you don't have.
 */
export type LayerVerdict =
  | 'verified-real'
  | 'verified-ai-signed'
  | 'unsigned-ambiguous'
  | 'detection-unavailable';

/** LB Cooperative Stamp — Layer 3 specific attachment. */
export interface CooperativeStamp {
  /** LB member ID that applied the stamp. */
  memberId: string;
  /** Display name of the attesting member (may be null if member chose anonymity). */
  memberDisplayName: string | null;
  /** Cathedral Federation node that recorded the stamp attestation. */
  attesingCathedralNode: string;
  /** ISO-8601 timestamp of stamp application. */
  stampedAt: string;
  /** Has this stamp been revoked? Revoked stamps change verdict to 'unsigned-ambiguous'. */
  revoked: boolean;
  /** Revocation reason if revoked. */
  revocationReason?: string;
  /** Cross-federation provenance chain hops. */
  federationHops: FederationHop[];
}

/** Single hop in the Cathedral Federation provenance chain. */
export interface FederationHop {
  nodeId: string;
  nodeLabel: string;
  recordedAt: string;
  signatureValid: boolean;
}

/** C2PA-specific attribution data (Layer 1). */
export interface C2paAttribution {
  /** Subject of the signing certificate. */
  signer: string;
  /** Common name from cert. */
  signerCommonName?: string;
  /** ISO-8601 signing timestamp. */
  signedAt: string;
  /** Tool or model that generated or edited the asset. E.g. 'Midjourney v6', 'Adobe Photoshop 26', 'GPT-4o DALL·E'. */
  tool?: string;
  /** Ordered list of edits (C2PA actions). */
  editHistory: C2paAction[];
  /** Whether the certificate chain verifies against known trust anchors. */
  certChainValid: boolean;
  /** Trust anchor that validated the chain. E.g. 'Adobe Content Authenticity Initiative'. */
  trustAnchor?: string;
}

/** Single C2PA provenance action. */
export interface C2paAction {
  action: string;
  softwareAgent?: string;
  when?: string;
  parameters?: Record<string, unknown>;
}

/** SynthID-specific detection data (Layer 2). */
export interface SynthIdDetection {
  /** Was a SynthID watermark detected? */
  detected: boolean;
  /** Detection score from the model (0.0–1.0). */
  rawScore: number;
  /** Which SynthID model/version was used for detection. */
  detectorVersion: string;
}

/** Ensemble classifier per-model result (Layer 4). */
export interface EnsembleModelResult {
  /** Model/classifier name. E.g. 'hive-moderation', 'optic-ai-or-not', 'pangram-watermark'. */
  modelName: string;
  /** Model's AI-likelihood score (0–100). */
  aiLikelihoodScore: number;
  /** Whether this model ran successfully. */
  available: boolean;
  /** Error message if available === false. */
  error?: string;
}

/** Union of layer-specific attribution payloads. */
export interface LayerAttribution {
  /** C2PA cert subject OR LB member display name. */
  signer?: string;
  /** ISO-8601 timestamp. */
  timestamp?: string;
  /** Tool/model that generated the asset. */
  tool?: string;
  /** LB Cooperative Stamp (Layer 3 only). */
  stamp?: CooperativeStamp;
  /** C2PA-specific data (Layer 1 only). */
  c2pa?: C2paAttribution;
  /** SynthID-specific data (Layer 2 only). */
  synthId?: SynthIdDetection;
  /** Ensemble per-model breakdown (Layer 4 only). */
  ensembleBreakdown?: EnsembleModelResult[];
}

/** Result from a single verification layer. */
export interface LayerResult {
  /** Layer name. E.g. 'c2pa', 'synthid', 'lb-stamp', 'ensemble-fallback'. */
  layer: string;
  /** Human-readable layer label for display. */
  layerLabel: string;
  verdict: LayerVerdict;
  /**
   * Confidence 0–100.
   * Discipline: Layer 4 ensemble MUST cap at 95. Never return 100 from any layer without
   * a valid cryptographic chain — that would be false-confidence.
   */
  confidence: number;
  attribution?: LayerAttribution;
  /** Duration of this layer's run in milliseconds. */
  durationMs: number;
  /** Raw library output — stored for debuggability, NOT shown to member by default. */
  rawData?: unknown;
  /** Human-readable explanation of the verdict. */
  explanation: string;
}

// ─── Ensemble result ──────────────────────────────────────────────────────────

/**
 * Rolled-up verdict across all four layers.
 * Priority: Layer 1 (C2PA) > Layer 3 (LB Stamp) > Layer 2 (SynthID) > Layer 4 (Ensemble).
 * 'verified-real' from Layer 1 C2PA is the strongest possible verdict.
 */
export type EnsembleVerdict =
  | 'verified-real'          // Cryptographically proven human origin
  | 'verified-ai-attributed' // AI-generated but attribution chain is intact
  | 'lb-stamp-attested'      // LB cooperative member attested this asset
  | 'synthid-detected'       // SynthID watermark found, no stronger signal
  | 'likely-ai'              // Ensemble says AI but no cryptographic proof
  | 'likely-human'           // Ensemble says human but no cryptographic proof
  | 'inconclusive'           // No layer returned a usable signal

// ─── Full verification result ─────────────────────────────────────────────────

/** Complete result returned to the member after running all four layers. */
export interface VerificationResult {
  /** Stable request ID (matches VerificationRequest.id). */
  requestId: string;
  asset: Asset;
  /** ISO-8601 timestamp of when verification completed. */
  verifiedAt: string;
  /** Total wall-clock duration across all layers. */
  totalDurationMs: number;
  /** Rolled-up verdict. */
  ensembleVerdict: EnsembleVerdict;
  /**
   * Ensemble confidence (0–100).
   * If ensembleVerdict derives from a cryptographic layer (C2PA or LB Stamp), this may be 99.
   * If ensembleVerdict derives from Layer 4 ensemble only, capped at 95.
   */
  ensembleConfidence: number;
  /** Individual layer results in run order: [c2pa, synthid, lb-stamp, ensemble-fallback]. */
  layerResults: LayerResult[];
  /** Whether the member consented to server-side Layer 4 fallback processing. */
  memberConsentedToServerFallback: boolean;
  /** Brief summary for display. E.g. "Signed by Adobe Photoshop — human-attributed". */
  summaryLine: string;
}

// ─── Verification request ─────────────────────────────────────────────────────

/** Input to AngelOfDeathVerifier.verify(). */
export interface VerificationRequest {
  id: string;
  asset: Asset;
  /**
   * If true, Layer 4 may call the Edge Function for server-side ensemble compute.
   * Requires explicit member consent banner acknowledgment before being set true.
   * Per member-sovereignty canon: default is FALSE.
   */
  consentToServerFallback: boolean;
  /** LB auth token — required for Layer 3 LB Stamp verification. */
  lbAuthToken?: string;
}

// ─── Progress updates ─────────────────────────────────────────────────────────

/** Emitted during a verification run so the UI can show layer-by-layer progress. */
export interface VerificationProgress {
  requestId: string;
  phase: 'starting' | 'layer-running' | 'layer-complete' | 'finalizing' | 'complete' | 'error';
  layerName?: string;
  layerIndex?: number; // 0-based
  totalLayers: number;
  partialLayerResult?: LayerResult;
  error?: string;
}

// ─── Layer interface (contract for all four layers) ──────────────────────────

/**
 * Every layer implements this interface.
 * The orchestrator calls run() and wraps timing/error handling.
 */
export interface VerificationLayer {
  /** Short machine name. E.g. 'c2pa', 'synthid', 'lb-stamp', 'ensemble-fallback'. */
  readonly name: string;
  /** Display label. E.g. 'C2PA Content Credentials'. */
  readonly layerLabel: string;
  /**
   * Run the layer against the asset.
   * MUST NOT throw — return verdict 'detection-unavailable' on any error.
   */
  run(asset: Asset, options?: LayerRunOptions): Promise<LayerResult>;
}

/** Options passed to each layer's run() call. */
export interface LayerRunOptions {
  /** LB auth token — required by Layer 3. */
  lbAuthToken?: string;
  /** Timeout in ms before the layer should self-abort. */
  timeoutMs?: number;
  /** Whether Layer 4 may use the server-side Edge Function endpoint. */
  serverFallbackAllowed?: boolean;
  /** Edge function URL (if serverFallbackAllowed). */
  edgeFunctionUrl?: string;
}
