/**
 * peerIdentityCollector.ts — Collect all five peer_presence identity fields
 * BP104 D5 — populate machine_label, lan_addresses, wan_soccerball_id, email_hash, artifact_server_address
 */

import { networkInterfaces } from 'os';
import { join, dirname } from 'path';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { createHash } from 'crypto';

export interface PeerIdentityFields {
  machine_label: string;
  lan_addresses: string[];
  wan_soccerball_id: string | null;
  email_hash: string | null;
  artifact_server_address: string | null;
}

/** Label file path: %APPDATA%\\MnemosyneC\\config\\peer_label.txt */
export function peerLabelFilePath(): string {
  return join(process.env.APPDATA ?? '', 'MnemosyneC', 'config', 'peer_label.txt');
}

/** Read machine label from file or fallbacks (no write). */
export function getMachineLabel(peerId: string): string {
  const labelFile = peerLabelFilePath();
  try {
    if (existsSync(labelFile)) {
      return sanitizeMachineLabel(readFileSync(labelFile, 'utf8'));
    }
    const fallback = process.env.COMPUTERNAME ?? `peer-${peerId.slice(0, 8)}`;
    return sanitizeMachineLabel(fallback);
  } catch {
    return `peer-${peerId.slice(0, 8)}`;
  }
}

/** Collect the non-dynamic identity fields once at boot */
export function collectPeerIdentity(opts: {
  peerId: string;
  publicKeyHex?: string;
  memberEmail?: string;
  artifactServerPort?: number;
  /** When set, use these LAN addresses instead of re-scanning interfaces */
  lanAddressesOverride?: string[];
}): PeerIdentityFields {
  const machine_label = getMachineLabel(opts.peerId);

  const lan_addresses = opts.lanAddressesOverride ?? collectLanAddresses();

  const wan_soccerball_id = opts.publicKeyHex
    ? createHash('sha256').update(opts.publicKeyHex).digest('hex').slice(0, 32)
    : null;

  const email_hash = opts.memberEmail
    ? createHash('sha256').update(opts.memberEmail.trim().toLowerCase()).digest('hex').slice(0, 32)
    : null;

  let artifact_server_address: string | null = null;
  if (opts.artifactServerPort) {
    const primaryIp = lan_addresses[0] ?? '127.0.0.1';
    artifact_server_address = `http://${primaryIp}:${opts.artifactServerPort}`;
  }

  return { machine_label, lan_addresses, wan_soccerball_id, email_hash, artifact_server_address };
}

/** Collect non-loopback IPv4 addresses from all network interfaces */
export function collectLanAddresses(): string[] {
  const addrs: string[] = [];
  const ifaces = networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name] ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addrs.push(iface.address);
      }
    }
  }
  return addrs;
}

/** Sanitize a user-provided label to 64 chars, no control chars */
export function sanitizeMachineLabel(raw: string): string {
  return raw.replace(/[\x00-\x1f]/g, '').trim().slice(0, 64);
}

/** Persist user-edited machine label to peer_label.txt */
export function setMachineLabel(label: string): string {
  const clean = sanitizeMachineLabel(label);
  const labelFile = peerLabelFilePath();
  mkdirSync(dirname(labelFile), { recursive: true });
  writeFileSync(labelFile, clean, 'utf8');
  return clean;
}

/** Default artifact server port (Keys & Engines); null when server not started */
export function getArtifactServerPort(): number | undefined {
  const port = parseInt(process.env.PEER_ARTIFACT_PORT ?? '47213', 10);
  return Number.isFinite(port) && port > 0 ? port : undefined;
}
