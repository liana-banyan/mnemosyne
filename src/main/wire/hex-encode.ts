// BP087 MAMBA-δ1: Hexadecimal Machine Code wire format v1
// Canon: canon_hexadecimal_machine_code_mnemosynec_wire_format_consolidation_bp085
//
// Frame layout (all chars are lowercase hex ASCII):
//   Header  — 20 chars (10 bytes):
//     [0..15]  16-hex dispatch-id  (8 bytes — strip hyphens, first 16 chars, pad right)
//     [16..19]  4-hex frame-type   (2 bytes — see FRAME_TYPE_MAP)
//   Body    — even-length hex string (hex-encoded UTF-8 JSON payload)
//   Footer  — 8 chars (4 bytes): SHA256[:4] of header+body as 8-char hex
//
// Difference vs platform/mesh-orchestrator/hex-encoder.ts:
//   That encoder JSON-wraps the frame object THEN hex-encodes it (frame-in-frame).
//   This encoder uses a compact flat binary header suited to wan-relay-route dispatch (δ4).

import { createHash } from 'node:crypto';

export type FrameType = 'question' | 'answer' | 'noop' | 'broadcast';

export const FRAME_TYPE_MAP: Record<FrameType, string> = {
  question:  '0001',
  answer:    '0002',
  noop:      '0003',
  broadcast: '0004',
};

export const FRAME_TYPE_REVERSE: Record<string, FrameType | undefined> = Object.fromEntries(
  Object.entries(FRAME_TYPE_MAP).map(([k, v]) => [v, k as FrameType])
);

/**
 * CRC-like checksum: first 4 bytes of SHA256(utf8(header+body)).
 * Deterministic across Node versions; no native CRC32 dependency.
 */
function checksumHex(headerPlusBody: string): string {
  return createHash('sha256')
    .update(Buffer.from(headerPlusBody, 'utf8'))
    .digest()
    .slice(0, 4)
    .toString('hex')
    .padStart(8, '0');
}

/**
 * Encode a payload into a flat hex wire frame.
 * @param dispatchId  UUID or any string — hyphens stripped, first 16 hex chars used
 * @param frameType   'question' | 'answer' | 'noop' | 'broadcast'
 * @param payload     Serialisable object (must round-trip through JSON.stringify)
 * @returns           Full hex frame string (header + body + footer)
 */
export function encodeFrame(
  dispatchId: string,
  frameType: FrameType,
  payload: Record<string, unknown>
): string {
  const typeHex = FRAME_TYPE_MAP[frameType];
  if (!typeHex) throw new Error(`Unknown frame type: ${frameType}`);

  // Normalise dispatch ID: strip hyphens, lowercase, pad/truncate to 16 hex chars
  const idHex = dispatchId.replace(/-/g, '').slice(0, 16).padEnd(16, '0').toLowerCase();

  const bodyJson = JSON.stringify(payload);
  const bodyHex  = Buffer.from(bodyJson, 'utf8').toString('hex');

  const headerHex = `${idHex}${typeHex}`;
  const footerHex = checksumHex(headerHex + bodyHex);

  return `${headerHex}${bodyHex}${footerHex}`;
}

export interface DecodedFrame {
  /** Raw 16-char dispatch-id hex */
  dispatchId: string;
  /** Symbolic frame type (e.g. 'question') or raw hex if unknown */
  frameType: string;
  /** Parsed JSON payload */
  payload: Record<string, unknown>;
  /** True if footer checksum matches recomputed checksum */
  crcValid: boolean;
  /** Raw body hex (for downstream diagnostics) */
  rawBodyHex: string;
  /** Total byte length of the frame (hex.length / 2) */
  byteLength: number;
}

/**
 * Decode a flat hex wire frame produced by encodeFrame.
 * Throws if the frame is shorter than the minimum (28 chars: 20 header + 8 footer).
 */
export function decodeFrame(hex: string): DecodedFrame {
  if (hex.length < 28) {
    throw new Error(`Frame too short: ${hex.length} chars (min 28)`);
  }
  if (hex.length % 2 !== 0) {
    throw new Error(`Frame has odd length: ${hex.length} — not valid hex`);
  }

  const headerHex = hex.slice(0, 20);
  const footerHex = hex.slice(-8);
  const bodyHex   = hex.slice(20, -8);

  const dispatchId    = headerHex.slice(0, 16);
  const frameTypeHex  = headerHex.slice(16, 20);
  const frameType     = FRAME_TYPE_REVERSE[frameTypeHex] ?? frameTypeHex;

  const expectedCrc = checksumHex(headerHex + bodyHex);
  const crcValid    = expectedCrc === footerHex;

  const bodyJson = Buffer.from(bodyHex, 'hex').toString('utf8');
  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(bodyJson) as Record<string, unknown>;
  } catch {
    payload = { _raw: bodyJson };
  }

  return {
    dispatchId,
    frameType,
    payload,
    crcValid,
    rawBodyHex: bodyHex,
    byteLength: hex.length / 2,
  };
}
