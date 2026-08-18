# LB Update Root: Key Ceremony

**Dispatch:** `D-BP157-036/BISHOP/seg-offline-key-ceremony`. **Founder ruling:** `FD-BP157-13`,
verbatim: "Generated offline, kept off every networked machine, used to sign manifests by hand.
Strictly stronger — a CI compromise cannot forge a manifest — at the cost of a manual step per
release."

**This document is the procedure the Founder performs himself, on an offline machine.** No
agent performs any step of it. The tools referenced below
(`scripts/trust_root_keygen.mjs`, `scripts/trust_root_sign_manifest.mjs`) run under plain Node
with no dependency outside the Node standard library and make no network call of any kind, so
they work unmodified on a machine that has never been connected to the internet.

Background reading: `SEG_RETURN_BP157_032_TRUST_ROOT_DESIGN.md` (the design),
`SEG_RETURN_BP157_035_BUILD_TRUST_ROOT.md` (what shipped: the `LB_PUBLIC_KEYS` registry in
`src/main/auto_update_scheduler.ts`, `verifyManifestEntrySignature()`, the placeholder that
fails closed).

---

## 1. Prepare an offline machine

- Any machine that can run Node (the version this repo targets is fine — the ceremony tool
  uses only `node:crypto`, `node:fs`, `node:path`, `node:os`, `node:child_process`, all present
  in every modern Node release).
- **Disconnect it from all networks before generating the key.** Wi-Fi off, ethernet
  unplugged, airplane mode on if it is a laptop. This does not need to be a machine dedicated
  to this purpose forever — it needs to be offline for the ten minutes the ceremony takes, and
  ideally stays the same machine for future rotations so its disk history is a known quantity.
- Copy this repository (or just the two `scripts/trust_root_*.mjs` files plus a Node install)
  onto that machine by USB drive, not by any network transfer.
- Confirm you have somewhere to write the private key that is **not**: inside this git
  repository, inside any other git working tree, or inside a folder synced by OneDrive,
  Dropbox, Google Drive, iCloud Drive, or Box. The keygen tool refuses to write to any such
  location and explains which check it tripped. A USB drive that is not itself cloud-synced is
  a reasonable choice, kept afterward with the offline machine or in a safe.

## 2. Generate the key

```
node scripts/trust_root_keygen.mjs D:\offline-keys\lb-root-2026-01.private.json --keyid lb-root-2026-01
```

Replace the path with wherever you decided in step 1. The `--keyid` should follow the existing
convention already live in `LB_PUBLIC_KEYS` (`'lb-root-2026-01'`) — bump the trailing number or
date segment for a new key; the tool will suggest `lb-root-<year>-<month>` if you omit
`--keyid`.

The tool will:
- Refuse and explain why if the output path is inside a repo, a cloud-synced folder, or already
  exists (pass `--force` only if you mean to overwrite a key you are deliberately retiring).
- Generate one Ed25519 keypair with `node:crypto`'s `generateKeyPairSync`, the same DER
  SPKI (public) / PKCS8 (private) hex encoding already used everywhere else in this codebase
  (`ed25519_keypair.ts`, `thorax/sign_verify.ts`).
- Write the private key to the path you gave it, as JSON, and attempt to restrict its file
  permissions. **On Windows this uses `icacls` to strip inherited permissions and grant access
  to the current user only** — this is a real ACL change, not merely the read-only attribute
  Node's `chmod` sets on Windows (the tool's own output tells you which of the two actually
  applied on your machine; MEASURED on the machine that built this tool: `icacls` succeeded and
  the report line read "This IS enforced"). On macOS/Linux it sets POSIX mode `0600`.
- Write a second file, `<path>.pubkey.txt`, next to it — plain text, contains only the public
  key and keyId, safe to copy anywhere.
- Print the public key hex and the keyId to the terminal. **It never prints, logs, or writes
  the private key anywhere except the one file path you gave it.**

## 3. Record the public key and keyId

Copy down, from the terminal output or from `<path>.pubkey.txt`:
- `keyId` (e.g. `lb-root-2026-01`)
- `publicKeyHex` (a long hex string, DER SPKI encoding)

Write these somewhere durable outside the offline machine too — a password manager entry, a
printed copy in a safe — since they are what step 4 needs and they are not secret (they are the
public half).

## 4. Transfer ONLY the public half back to a networked machine

Copy `<path>.pubkey.txt` (or just the `keyId`/`publicKeyHex` pair, retyped) to a networked
machine by USB drive, or by retyping it by hand for a value this short. **Never copy the
private key file itself anywhere off the offline machine's storage.**

**How to verify it was not tampered with in transit:** the public key is 32 raw bytes (a
64-character hex payload inside the longer DER-wrapped 44-byte / 88-hex-character
`publicKeyHex` string — the DER SPKI header for Ed25519 is a fixed, known prefix
`302a300506032b6570032100`, so the string should always start with that; anything else means it
was corrupted or is not an Ed25519 SPKI key at all). Read the value back on the networked
machine and diff it character-for-character against what you recorded in step 3 by an
independent channel (read it aloud, or compare the printed copy in the safe) before pasting it
into source. A one-character transcription error here silently changes the trust root to a key
nobody holds the private half of, which is a self-inflicted denial of service, not a
compromise — annoying, not dangerous, but worth avoiding by checking.

## 5. Update the registry and rebuild

In `C:/Users/Administrator/Documents/mnemosyne/src/main/auto_update_scheduler.ts`, in the
`LB_PUBLIC_KEYS` map:

```ts
const LB_PUBLIC_KEYS: Record<string, RootKeyEntry> = {
  'lb-root-2026-01': {
    publicKeyHex: '<the publicKeyHex from step 3, exactly as recorded>',
    algorithm: 'ed25519',
    status: 'active',   // was 'placeholder'
  },
};
```

This is a normal, reviewed code change, committed and shipped in a normal Authenticode-signed
release (this is the "bootstrap path independent of the compromised Ed25519 key" the design
names — trust in a brand-new root key rides on the existing Microsoft code-signing trust for
this one release, not on the new key itself). Rebuild and ship as usual. Only once a release
with `status: 'active'` and a real key is out does `verifyManifestEntrySignature()` accept
anything signed by it — before that, every manifest entry naming this `keyId` is refused
identically to a missing signature (see `SEG_RETURN_BP157_035_BUILD_TRUST_ROOT.md` §3).

## 6. Per release: sign the manifest offline, carry the signature over

Each release, on the same offline machine, with the same private key file from step 2:

```
node scripts/trust_root_sign_manifest.mjs \
  --key D:\offline-keys\lb-root-2026-01.private.json \
  --keyid lb-root-2026-01 \
  --version 0.9.26 \
  --url https://mnemosynec.org/dl/MnemosyneC-Setup-0.9.26.exe \
  --sha256 <the real sha256 of that installer, 64 hex chars> \
  --tier latest \
  --manifest D:\transfer\version_trust.json \
  --out D:\transfer\version_trust.signed.json
```

`--manifest` is optional: pass an existing `version_trust.json` (fetched or copied over from
the networked machine beforehand, by USB, same as step 4) to have the tool insert or replace
the matching `{version, tier}` entry and write out the whole updated manifest; omit it to get
just the one signed entry's JSON. The tool makes **no network call of any kind** — nothing here
could transmit even if the machine were online.

Carry `version_trust.signed.json` back to a networked machine (USB, same discipline as step 4 —
this file is not secret, but corruption in transit would just mean a failed signature check on
every client, so treat it with the same "verify it matches" care) and publish it as
`version_trust.json` wherever that file is served from today (as of `D-BP157-035`, the CI
pipeline that publishes it was NOT FOUND in this repo's `.github/workflows/release.yml` — that
publish step is a separate, not-yet-built piece of work; this ceremony produces the signed file
that step needs to serve).

## 7. Rotation procedure

1. Run steps 1–4 again for a brand-new keypair, with a new `keyId` (bump the date/number, e.g.
   `lb-root-2026-02`).
2. Add the new entry to `LB_PUBLIC_KEYS` **alongside** the old one, `status: 'active'`. Do not
   remove the old entry yet.
3. Ship that as a normal release (step 5).
4. Once enough of the install base has updated to a build that recognizes the new `keyId`,
   start signing new manifests with the new key (step 6, new `--keyid`).
5. Only in a **later** release, remove the old `keyId` from `LB_PUBLIC_KEYS` — never by
   hot-patching the manifest, never by any means other than a normal shipped code change.

**What happens to machines offline across a rotation:** nothing bad. A machine keeps trusting
whichever `keyId`s its currently-installed build's `LB_PUBLIC_KEYS` map contains. It will
refuse a manifest signed only with a `keyId` it does not recognize (fail closed — see
`verifyManifestEntrySignature()`'s "unknown keyId" branch), which means it simply does not
update until it eventually installs a build that knows the new key — it never bricks, and it
never accepts something it can't verify.

## 8. Backup and recovery

**A root key that exists on exactly one disk is one hardware failure away from never being able
to ship a signed update again.** Say that plainly, because it is the real cost of this design
(`FD-BP157-13` accepted this cost explicitly: "at the cost of a manual step per release" —
losing the key entirely is a much bigger cost than the manual step, and needs its own plan, not
an assumption that the manual step covers it).

- Make at least one offline, encrypted backup of the private key file immediately after
  generation — a second USB drive, kept in a physically separate location from the first,
  ideally encrypted (e.g. with a tool already on the offline machine, or a hardware-encrypted
  drive) so a stolen backup drive alone is not a compromise.
- **What is lost if the key is destroyed with no backup:** every future release needs a new
  root key (rotation, step 7) shipped in a normal Authenticode-signed release before that
  release's manifest can be trusted by clients that already require signatures — i.e., you can
  still ship, but only after burning a full rotation cycle, and any release signed by the lost
  key that has NOT yet been superseded stays verifiable (old signatures don't stop working) but
  you can never produce a NEW valid signature under that `keyId` again. This is recoverable, not
  catastrophic, as long as at least one build still in the field has an `LB_PUBLIC_KEYS` map you
  can still ship an update to (i.e., as long as `status: 'placeholder'` never became the only
  state — see the note below on the very first key).
- **The one truly unrecoverable case:** losing the private key for the *only* `keyId` any
  shipped client currently trusts, with no other trusted `keyId` yet provisioned, before ever
  successfully shipping a rotation. Avoid this by never treating "the key ceremony is done" as
  finished without a verified backup existing first — do the backup in the same sitting as
  generation, on the same offline machine, before that machine ever reconnects to a network.

## 9. If the key is suspected compromised

1. Treat every release signed by the suspected key as still cryptographically valid but no
   longer trustworthy in intent — a compromised key can sign a legitimate-looking but malicious
   manifest entry that would pass `verifyManifestEntrySignature()` cleanly. Signature validity
   is not the same question as "should this be trusted"; a compromise means the second question
   now has an unknown answer for anything signed after the compromise.
2. Immediately begin rotation (§7) with a freshly generated key on a freshly verified-offline
   machine — do not reuse the same offline machine without first confirming how the suspected
   key was exposed (a compromised offline machine is a compromised machine regardless of
   whether it ever touched a network itself — e.g. an infected USB drive).
3. Ship the rotation release (§7 step 3) as fast as the normal release process allows; this is
   the only mechanism that gets a new trusted `keyId` in front of clients, since the manifest
   itself cannot un-trust a key client-side until clients update.
4. Do not remove the compromised `keyId` from `LB_PUBLIC_KEYS` in the same release as adding the
   new one if any currently-served manifest entries still rely on it for legitimate reasons —
   remove it once nothing being served needs it, per the normal rotation §7 step 5.
5. Investigate how the key was exposed before generating its replacement on the same physical
   machine or media.

---
Filed alongside `D-BP157-036/BISHOP/seg-offline-key-ceremony`. No key material of any kind
appears in this document.
