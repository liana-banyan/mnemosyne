// savings_receipt_block.ts -- D-BP223-BM09-ARCHBISHOP-004-016 (REDO of 004-010)
//
// Pure text renderer + parser/verifier for the "My Savings Receipt" v1 signed block. No Electron
// import -- this module never touches safeStorage, ipcMain, or app -- so it is unit-testable
// standalone and ai_dispatch_ipc.ts's IPC handler (the only Electron-aware caller) stays the sole
// place that decides WHEN to sign and WHAT the numbers are. Node's built-in crypto (not Electron)
// is used here only to VERIFY a signature against an embedded public key: verification needs no
// secret material, so it carries none of the safeStorage/private-key constraints signing does --
// see identity/localPeerKeypair.ts's signWithLocalPeerKey() for the (Electron-dependent) signer.
//
// The website intake (mnemosynec.org/post-your-receipt/) parses the first line and the
// `install_key:` / `chain_head:` lines with strict regexes -- keep RECEIPT_HEADER_LINE and the
// two matching field regexes below EXACTLY in this shape if the block format ever changes.

import { createPublicKey, verify } from 'crypto';
import type { SavingsReceiptWindow } from './savings_receipt_milestones';

export type { SavingsReceiptWindow };

export interface ReceiptBlockFields {
  window: SavingsReceiptWindow;
  from: string; // ISO UTC
  to: string; // ISO UTC
  queries: number;
  cost_avoided_usd: number;
  /** The aggregate's own measurement_scope wording -- sanitized to a single line, see
   *  toSingleLine() below, in case an upstream string ever grows an embedded newline. */
  scope: string;
  chain_head: string; // 64 lowercase hex chars (sha256), or the chain's GENESIS sentinel never
                       // reaches this field in practice -- the IPC handler only renders a block
                       // once chain_records > 0, at which point chain_head is always a real hash.
  chain_records: number;
  app_version: string;
  /** This install's PUBLIC Ed25519 key, DER/SPKI hex -- the exact encoding
   *  identity/localPeerKeypair.ts's ensureLocalPeerKeypair() already returns as publicKeyHex.
   *  Public by design: this is what a stranger verifies the signature against. */
  install_key: string;
  /** The signing keypair's real algorithm, e.g. "ed25519" (Node's KeyObject.asymmetricKeyType). */
  sig_alg: string;
}

export const RECEIPT_HEADER_LINE = 'MNEMOSYNEC SAVINGS RECEIPT v1';

class ReceiptBlockParseError extends Error {}

/** Strips CR/LF so a field that is supposed to render on one line always does. */
function toSingleLine(s: string): string {
  return s.replace(/[\r\n]+/g, ' ').trim();
}

function formatCostAvoided(n: number): string {
  return n.toFixed(4);
}

/**
 * Builds every line of the block EXCEPT the trailing `signature:` line, joined with '\n' and no
 * trailing newline -- this exact string is what gets signed AND what verifyReceiptBlock()
 * recomputes to check a signature against. Keeping this separate from renderReceiptBlock() is
 * what makes "sign the block" and "render the block" separable: the signer
 * (identity/localPeerKeypair.ts's signWithLocalPeerKey, Electron-only) never needs to import this
 * module's formatting logic, and this module never needs Electron.
 */
export function receiptBlockSigningText(fields: ReceiptBlockFields): string {
  const lines = [
    RECEIPT_HEADER_LINE,
    `window: ${fields.window}`,
    `from: ${fields.from}`,
    `to: ${fields.to}`,
    `queries: ${Math.trunc(fields.queries)}`,
    `cost_avoided_usd: ${formatCostAvoided(fields.cost_avoided_usd)}`,
    `scope: ${toSingleLine(fields.scope)}`,
    `chain_head: ${fields.chain_head}`,
    `chain_records: ${Math.trunc(fields.chain_records)}`,
    `app_version: ${fields.app_version}`,
    `install_key: ${fields.install_key}`,
    `sig_alg: ${fields.sig_alg}`,
  ];
  return lines.join('\n');
}

/**
 * The full v1 block, with the `signature:` line appended. `signatureHex` must already be
 * computed (by signWithLocalPeerKey against receiptBlockSigningText(fields)) -- this function
 * never signs anything itself. Byte-stable: the same fields + signature always render to the
 * same string.
 */
export function renderReceiptBlock(fields: ReceiptBlockFields, signatureHex: string): string {
  return `${receiptBlockSigningText(fields)}\nsignature: ${signatureHex}`;
}

export interface ReceiptBlockVerifyResult {
  ok: boolean;
  reason: string | null;
  fields?: ReceiptBlockFields;
}

/** Strict shape the website intake matches the install_key line against -- lowercase hex, any
 *  length (SPKI DER hex varies slightly by key type, though this estate's installs are always
 *  Ed25519, a fixed 44-byte/88-hex-char SPKI encoding). */
const INSTALL_KEY_LINE_RE = /^install_key: ([0-9a-f]+)$/m;
/** Strict shape the website intake matches the chain_head line against -- exactly 64 lowercase
 *  hex chars (a sha256 digest). */
const CHAIN_HEAD_LINE_RE = /^chain_head: ([0-9a-f]{64})$/m;

function matchLine(text: string, re: RegExp, name: string): string {
  const m = text.match(re);
  if (!m) throw new ReceiptBlockParseError(`missing or malformed "${name}:" line`);
  return m[1];
}

/**
 * Parses and verifies a v1 receipt block's signature against ITS OWN embedded install_key. Pure
 * -- no file/network I/O, no Electron. Returns ok:false with a `reason` on any parse failure or
 * signature mismatch; never throws.
 */
export function verifyReceiptBlock(text: string): ReceiptBlockVerifyResult {
  try {
    const firstLine = text.split('\n', 1)[0];
    if (firstLine !== RECEIPT_HEADER_LINE) {
      return { ok: false, reason: `first line is not "${RECEIPT_HEADER_LINE}"` };
    }

    const sigSplitAt = text.lastIndexOf('\nsignature: ');
    if (sigSplitAt === -1) {
      return { ok: false, reason: 'no "signature:" line found' };
    }
    const signedText = text.slice(0, sigSplitAt);
    const sigLine = text.slice(sigSplitAt + 1); // "signature: <hex>", no leading \n
    const sigMatch = sigLine.match(/^signature: ([0-9a-f]+)$/);
    if (!sigMatch) {
      return { ok: false, reason: 'malformed "signature:" line (expected lowercase hex)' };
    }
    const signatureHex = sigMatch[1];

    const windowStr = matchLine(signedText, /^window: (all|hour|day|week|fortnight|month|quarter)$/m, 'window');
    const from = matchLine(signedText, /^from: (.+)$/m, 'from');
    const to = matchLine(signedText, /^to: (.+)$/m, 'to');
    const queriesStr = matchLine(signedText, /^queries: (\d+)$/m, 'queries');
    const costStr = matchLine(signedText, /^cost_avoided_usd: (-?\d+\.\d{4})$/m, 'cost_avoided_usd');
    const scope = matchLine(signedText, /^scope: (.*)$/m, 'scope');
    const chain_head = matchLine(signedText, CHAIN_HEAD_LINE_RE, 'chain_head');
    const chainRecordsStr = matchLine(signedText, /^chain_records: (\d+)$/m, 'chain_records');
    const app_version = matchLine(signedText, /^app_version: (.+)$/m, 'app_version');
    const install_key = matchLine(signedText, INSTALL_KEY_LINE_RE, 'install_key');
    const sig_alg = matchLine(signedText, /^sig_alg: (.+)$/m, 'sig_alg');

    const fields: ReceiptBlockFields = {
      window: windowStr as SavingsReceiptWindow,
      from,
      to,
      queries: parseInt(queriesStr, 10),
      cost_avoided_usd: parseFloat(costStr),
      scope,
      chain_head,
      chain_records: parseInt(chainRecordsStr, 10),
      app_version,
      install_key,
      sig_alg,
    };

    // Defense in depth: the parsed fields must re-render byte-for-byte to the text that was
    // actually signed. In practice the crypto check below is what catches tampering (editing a
    // value the line-regex still accepts changes signedText, which breaks the signature) -- this
    // catches the separate case of a hand-built block whose formatting never matched the
    // renderer's own output (extra whitespace, wrong decimal places, etc.).
    const recomputed = receiptBlockSigningText(fields);
    if (recomputed !== signedText) {
      return { ok: false, reason: 'parsed fields do not re-render to the signed text byte-for-byte' };
    }

    const pubKey = createPublicKey({ key: Buffer.from(install_key, 'hex'), format: 'der', type: 'spki' });
    const sigOk = verify(null, Buffer.from(signedText, 'utf8'), pubKey, Buffer.from(signatureHex, 'hex'));
    if (!sigOk) {
      return { ok: false, reason: 'signature does not verify against the embedded install_key', fields };
    }
    return { ok: true, reason: null, fields };
  } catch (err) {
    if (err instanceof ReceiptBlockParseError) return { ok: false, reason: err.message };
    return { ok: false, reason: `verification threw: ${err instanceof Error ? err.message : String(err)}` };
  }
}
