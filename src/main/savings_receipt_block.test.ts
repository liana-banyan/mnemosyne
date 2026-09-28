// savings_receipt_block.test.ts -- D-BP223-BM09-ARCHBISHOP-004-016 (REDO of 004-010)
// Pure block renderer/parser/verifier -- no Electron. Signs with a plain node:crypto Ed25519
// keypair generated in-test (standing in for identity/localPeerKeypair.ts's real, safeStorage-
// backed keypair, which this module never touches) to exercise renderReceiptBlock/
// verifyReceiptBlock exactly the way the real signer (signWithLocalPeerKey) is meant to be used.

import { describe, it, expect } from 'vitest';
import { generateKeyPairSync, sign } from 'crypto';
import {
  RECEIPT_HEADER_LINE,
  receiptBlockSigningText,
  renderReceiptBlock,
  verifyReceiptBlock,
  type ReceiptBlockFields,
} from './savings_receipt_block';

function testKeypair() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return {
    publicKeyHex: (publicKey.export({ type: 'spki', format: 'der' }) as Buffer).toString('hex'),
    privateKey,
  };
}

const FIXED_FIELDS = (installKey: string): ReceiptBlockFields => ({
  window: 'week',
  from: '2026-09-01T00:00:00.000Z',
  to: '2026-09-08T00:00:00.000Z',
  queries: 42,
  cost_avoided_usd: 12.3,
  scope: 'NET figure across ALL traffic that reached a routing decision in this window',
  chain_head: 'a'.repeat(64),
  chain_records: 42,
  app_version: '0.9.31',
  install_key: installKey,
  sig_alg: 'ed25519',
});

function signAndRender(fields: ReceiptBlockFields, privateKey: ReturnType<typeof generateKeyPairSync>['privateKey']): string {
  const signingText = receiptBlockSigningText(fields);
  const signatureHex = sign(null, Buffer.from(signingText, 'utf8'), privateKey).toString('hex');
  return renderReceiptBlock(fields, signatureHex);
}

describe('savings_receipt_block: receiptBlockSigningText is byte-stable', () => {
  it('renders the exact fixed shape for a fixed aggregate, twice, identically', () => {
    const fields = FIXED_FIELDS('deadbeef'.repeat(11)); // 88 hex chars, arbitrary fixture
    const a = receiptBlockSigningText(fields);
    const b = receiptBlockSigningText(fields);
    expect(a).toBe(b);
    expect(a).toBe(
      [
        RECEIPT_HEADER_LINE,
        'window: week',
        'from: 2026-09-01T00:00:00.000Z',
        'to: 2026-09-08T00:00:00.000Z',
        'queries: 42',
        'cost_avoided_usd: 12.3000',
        'scope: NET figure across ALL traffic that reached a routing decision in this window',
        `chain_head: ${'a'.repeat(64)}`,
        'chain_records: 42',
        'app_version: 0.9.31',
        `install_key: ${'deadbeef'.repeat(11)}`,
        'sig_alg: ed25519',
      ].join('\n'),
    );
  });

  it('sanitizes an embedded newline in scope to a single line', () => {
    const fields = { ...FIXED_FIELDS('ab'.repeat(44)), scope: 'line one\nline two' };
    const text = receiptBlockSigningText(fields);
    expect(text.split('\n')).toHaveLength(12); // still exactly 12 header/field lines, not 13
    expect(text).toContain('scope: line one line two');
  });

  it('formats cost_avoided_usd to a fixed 4 decimals regardless of input precision', () => {
    const fields = { ...FIXED_FIELDS('cd'.repeat(44)), cost_avoided_usd: 1 / 3 };
    expect(receiptBlockSigningText(fields)).toContain('cost_avoided_usd: 0.3333');
  });
});

describe('savings_receipt_block: sign then verify', () => {
  it('a correctly signed block verifies true and returns the parsed fields', () => {
    const { publicKeyHex, privateKey } = testKeypair();
    const fields = FIXED_FIELDS(publicKeyHex);
    const block = signAndRender(fields, privateKey);

    const result = verifyReceiptBlock(block);
    expect(result.ok).toBe(true);
    expect(result.reason).toBeNull();
    expect(result.fields).toEqual(fields);
  });

  it('any edited line fails verification', () => {
    const { publicKeyHex, privateKey } = testKeypair();
    const fields = FIXED_FIELDS(publicKeyHex);
    const block = signAndRender(fields, privateKey);

    const tampered = block.replace('queries: 42', 'queries: 999999');
    const result = verifyReceiptBlock(tampered);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/signature does not verify/);
  });

  it('editing the cost_avoided_usd line also fails verification', () => {
    const { publicKeyHex, privateKey } = testKeypair();
    const fields = FIXED_FIELDS(publicKeyHex);
    const block = signAndRender(fields, privateKey);

    const tampered = block.replace('cost_avoided_usd: 12.3000', 'cost_avoided_usd: 99.9999');
    const result = verifyReceiptBlock(tampered);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/signature does not verify/);
  });

  it('a signature from a DIFFERENT keypair fails verification (wrong install_key embedded)', () => {
    const signer = testKeypair();
    const other = testKeypair();
    // Block claims to be signed by `other`'s public key, but is actually signed by `signer`'s
    // private key -- simulates a forged install_key line.
    const fields = FIXED_FIELDS(other.publicKeyHex);
    const block = signAndRender(fields, signer.privateKey);
    const result = verifyReceiptBlock(block);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/signature does not verify/);
  });

  it('rejects a block with the wrong header line', () => {
    const { publicKeyHex, privateKey } = testKeypair();
    const fields = FIXED_FIELDS(publicKeyHex);
    const block = signAndRender(fields, privateKey).replace(RECEIPT_HEADER_LINE, 'SOMETHING ELSE v1');
    const result = verifyReceiptBlock(block);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/first line/);
  });

  it('rejects a block missing the signature line entirely', () => {
    const { publicKeyHex } = testKeypair();
    const fields = FIXED_FIELDS(publicKeyHex);
    const result = verifyReceiptBlock(receiptBlockSigningText(fields));
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/no "signature:" line/);
  });

  it('rejects a block with a missing required field line', () => {
    const { publicKeyHex, privateKey } = testKeypair();
    const fields = FIXED_FIELDS(publicKeyHex);
    const block = signAndRender(fields, privateKey);
    const withoutChainHead = block.split('\n').filter((l) => !l.startsWith('chain_head:')).join('\n');
    const result = verifyReceiptBlock(withoutChainHead);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/chain_head/);
  });
});
