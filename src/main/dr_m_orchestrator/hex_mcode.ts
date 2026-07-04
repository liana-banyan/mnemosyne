// hex_mcode.ts -- Mountain 1 · I-C · HEX-MCODE Wire Format
// KNIGHT MARATHON 4 · BP089 · BLACK MAMBA
//
// Canon: canon_hexadecimal_machine_code_mnemosynec_wire_format_consolidation_bp085
//
// LBMC frame layout (hex string wire format):
//   HEADER   : 8 hex chars  (4 bytes)  = 0x4C424D43 ("LBMC")
//   TYPE     : 2 hex chars  (1 byte)   = see FRAME_TYPE_MAP
//   LEN      : 8 hex chars  (4 bytes)  = uint32 big-endian · byte count of JSON payload
//   PAYLOAD  : 2*N hex chars (N bytes) = JSON UTF-8 · hex-encoded
//   CRC      : 8 hex chars  (4 bytes)  = CRC-32 of HEADER+TYPE+LEN+PAYLOAD (big-endian)
//
// §3 Truth-Always: SSPS composition (BP055) is THEORIES_OPEN. This module implements
// the base frame layer only. Address layer is a later mountain when Founder confirms.
//
// No external dependencies. Pure node:crypto for CRC computation.

// ─── CRC-32 (standard reflected polynomial 0xEDB88320) ───────────────────────────

const CRC32_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c;
  }
  return table;
})();

function crc32(buf: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC32_TABLE[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function uint32ToHex(n: number): string {
  return (n >>> 0).toString(16).padStart(8, '0');
}

// ─── Frame type map ───────────────────────────────────────────────────────────────

const LBMC_MAGIC = '4c424d43';

export type FrameType =
  | 'dispatch_request'
  | 'dispatch_response'
  | 'substrate_bundle'
  | 'pearl_emit'
  | 'brain_swap_signal'
  | 'council_request'
  | 'council_response'
  | 'council_escalation'
  | 'error_frame';

const FRAME_TYPE_BYTE: Record<FrameType, string> = {
  dispatch_request:  '01',
  dispatch_response: '02',
  substrate_bundle:  '03',
  pearl_emit:        '04',
  brain_swap_signal: '05',
  council_request:   '06',
  council_response:  '07',
  council_escalation:'08',
  error_frame:       'ff',
};

const FRAME_TYPE_REVERSE: Record<string, FrameType> = Object.fromEntries(
  Object.entries(FRAME_TYPE_BYTE).map(([k, v]) => [v, k as FrameType])
);

// ─── Exported interface ───────────────────────────────────────────────────────────

export interface HexFrame {
  type: FrameType;
  payload: Record<string, unknown>;
  crc_valid: boolean;
}

// ─── encode ───────────────────────────────────────────────────────────────────────

/**
 * Encode a payload into an LBMC hex wire frame.
 * Returns full hex string: MAGIC(8) + TYPE(2) + LEN(8) + PAYLOAD(2*N) + CRC(8)
 */
export function encode(type: FrameType, payload: Record<string, unknown>): string {
  const typeHex = FRAME_TYPE_BYTE[type];
  if (!typeHex) throw new Error(`Unknown frame type: ${type}`);

  const jsonStr = JSON.stringify(payload);
  const payloadBytes = Buffer.from(jsonStr, 'utf8');
  const payloadHex = payloadBytes.toString('hex');

  const lenHex = uint32ToHex(payloadBytes.length);

  // CRC-32 over raw bytes: HEADER(4) + TYPE(1) + LEN(4) + PAYLOAD(N)
  const headerBuf = Buffer.from(LBMC_MAGIC, 'hex');
  const typeBuf = Buffer.from(typeHex, 'hex');
  const lenBuf = Buffer.from(lenHex, 'hex');
  const crcInput = Buffer.concat([headerBuf, typeBuf, lenBuf, payloadBytes]);
  const crcValue = crc32(new Uint8Array(crcInput));
  const crcHex = uint32ToHex(crcValue);

  return `${LBMC_MAGIC}${typeHex}${lenHex}${payloadHex}${crcHex}`;
}

// ─── decode ───────────────────────────────────────────────────────────────────────

/**
 * Decode an LBMC hex wire frame. Never throws.
 * Returns error_frame with crc_valid=false on any parse/CRC failure.
 */
export function decode(hex: string): HexFrame {
  // Minimum frame: 8 (magic) + 2 (type) + 8 (len) + 0 (payload) + 8 (crc) = 26
  if (hex.length < 26 || hex.length % 2 !== 0) {
    return { type: 'error_frame', payload: { _error: 'frame too short or odd length' }, crc_valid: false };
  }

  try {
    const magic = hex.slice(0, 8);
    if (magic.toLowerCase() !== LBMC_MAGIC) {
      return { type: 'error_frame', payload: { _error: `bad magic: ${magic}` }, crc_valid: false };
    }

    const typeHex = hex.slice(8, 10).toLowerCase();
    const lenHex = hex.slice(10, 18);
    const payloadLen = parseInt(lenHex, 16);

    const payloadStart = 18;
    const payloadEnd = payloadStart + payloadLen * 2;
    const crcStart = payloadEnd;
    const crcEnd = crcStart + 8;

    if (crcEnd !== hex.length) {
      return { type: 'error_frame', payload: { _error: 'frame length mismatch' }, crc_valid: false };
    }

    const payloadHex = hex.slice(payloadStart, payloadEnd);
    const crcHex = hex.slice(crcStart, crcEnd);

    // Verify CRC
    const headerBuf = Buffer.from(LBMC_MAGIC, 'hex');
    const typeBuf = Buffer.from(typeHex, 'hex');
    const lenBuf = Buffer.from(lenHex, 'hex');
    const payloadBytes = Buffer.from(payloadHex, 'hex');
    const crcInput = Buffer.concat([headerBuf, typeBuf, lenBuf, payloadBytes]);
    const expectedCrc = uint32ToHex(crc32(new Uint8Array(crcInput)));
    const crcValid = expectedCrc === crcHex.toLowerCase();

    // Parse payload JSON
    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(payloadBytes.toString('utf8')) as Record<string, unknown>;
    } catch {
      payload = { _raw: payloadBytes.toString('utf8') };
    }

    const frameType: FrameType = FRAME_TYPE_REVERSE[typeHex] ?? 'error_frame';

    return { type: frameType, payload, crc_valid: crcValid };
  } catch (err) {
    return {
      type: 'error_frame',
      payload: { _error: err instanceof Error ? err.message : String(err) },
      crc_valid: false,
    };
  }
}

// ─── validate ─────────────────────────────────────────────────────────────────────

/**
 * True if crc_valid and type !== error_frame.
 */
export function validate(frame: HexFrame): boolean {
  return frame.crc_valid && frame.type !== 'error_frame';
}
