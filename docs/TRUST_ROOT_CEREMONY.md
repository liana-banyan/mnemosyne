# LB Update Root: Key Ceremony

**Dispatch:** `D-BP157-044/BISHOP/seg-supersede-offline-ceremony` (this rewrite). Originally
filed under `D-BP157-036/BISHOP/seg-offline-key-ceremony`.

## 0. What actually happened (read this first)

The offline procedure this document used to open with was never performed. Instead, on the
Founder's explicit instruction ("Oh, yes, generate it on M0 anyway then"), the root key was
generated directly on M0:

- **keyId:** `lb-root-2026-01`
- **Algorithm:** Ed25519
- **Generated:** 2026-08-18 (BP157), on M0, a networked machine
- **Private key path:** `C:\Users\Administrator\.lb-root-keys\lb-root-2026-01.private.json`
  (MEASURED present, 299 bytes, `icacls`-restricted, owner-only ACL) — OUTSIDE both repos, not
  inside any git working tree.
- **Public key file:** `C:\Users\Administrator\.lb-root-keys\lb-root-2026-01.private.json.pubkey.txt`
  (safe to copy; contains no secret material)
- **Registry status:** `status: 'active'` in `LB_PUBLIC_KEYS` in
  `C:/Users/Administrator/Documents/mnemosyne/src/main/auto_update_scheduler.ts`. Committed at
  `26720f39`. 25 of 25 trust-root and ceremony tests pass.
- **No key material of any kind appears in this document.** Only the public key hex (already
  public by design) and file paths are referenced below.

The rest of this document is reorganized around that fact. Section 1 is the current governing
ruling. Section 2 is the now-superseded plan and why it is kept, not deleted. Sections 3 onward
give the accurate current procedure.

## 1. Governing ruling: `FD-BP157-14` supersedes `FD-BP157-13`

**`FD-BP157-13`, the original plan, verbatim:**

> "Generated offline, kept off every networked machine, used to sign manifests by hand. Strictly
> stronger — a CI compromise cannot forge a manifest — at the cost of a manual step per release."

**`FD-BP157-14`, the ruling that supersedes it, verbatim:**

> "I'm never running it on an offline machine, bc there is no point in an offline machine."

The Founder's reasoning, as given to him before this ruling: air-gapping a machine, generating a
key on it, then reconnecting it protects only the ten minutes of generation — the key then lives
on a networked box anyway for its entire operational life. Offline-generation-only is meaningful
protection solely when the key is generated, stored, AND used on a machine that never reconnects.
He judged a ceremony that does not sustain that property for the life of the key not worth the
manual-signing cost, and ruled it out. There is **no pending rotation** to an offline-born root,
and no one is waiting to perform one.

## 2. The offline procedure — RETAINED, but NOT CURRENT PRACTICE

**Everything in this section is demoted, not deleted.** It remains the correct procedure if this
estate ever adopts a dedicated offline signing box, or as reference for how the tooling
(`scripts/trust_root_keygen.mjs`, `scripts/trust_root_sign_manifest.mjs`) was designed to run
in an air-gapped context — both scripts still work exactly as described here, with no network
dependency of any kind. It is kept because throwing away a designed and tested procedure loses
institutional knowledge that a future rotation decision may need; it is relabeled because a
reader must not mistake it for what this estate actually does today.

Background reading: `SEG_RETURN_BP157_032_TRUST_ROOT_DESIGN.md` (the design),
`SEG_RETURN_BP157_035_BUILD_TRUST_ROOT.md` (what shipped: the `LB_PUBLIC_KEYS` registry,
`verifyManifestEntrySignature()`, the placeholder that fails closed).

### 2.1. Prepare an offline machine (NOT PERFORMED, NOT PLANNED)

- Any machine that can run Node — the ceremony tool uses only `node:crypto`, `node:fs`,
  `node:path`, `node:os`, `node:child_process`, all present in every modern Node release.
- Disconnect it from all networks before generating the key. Wi-Fi off, ethernet unplugged,
  airplane mode on if it is a laptop.
- Copy the two `scripts/trust_root_*.mjs` files plus a Node install onto that machine by USB
  drive, not by any network transfer.
- Confirm the private-key output path is not inside a git repository, not inside any other git
  working tree, and not inside a folder synced by OneDrive, Dropbox, Google Drive, iCloud Drive,
  or Box. The keygen tool refuses and explains which check it tripped if it is.

### 2.2. Generate the key (NOT HOW THIS KEY WAS GENERATED)

```
node scripts/trust_root_keygen.mjs D:\offline-keys\lb-root-2026-02.private.json --keyid lb-root-2026-02
```

This is the command a FUTURE rotation onto a genuinely offline, never-reconnected machine would
use. `lb-root-2026-01`, the key actually in use, was generated on M0 instead — see Section 3.

### 2.3. Record the public key and keyId, and Section 2.4, transfer only the public half back

Unchanged in mechanics from the original design (read the value back on the networked machine
and diff it character-for-character against an independently recorded copy before pasting it
into source; the DER SPKI Ed25519 prefix is the fixed string `302a300506032b6570032100`). Not
performed for `lb-root-2026-01`, since no transfer between machines was needed — the key never
left M0.

## 3. What is actually done: generation and signing on M0

`lb-root-2026-01` was generated directly on M0 with the same tool referenced above, run on the
networked machine rather than an offline one:

```
node scripts/trust_root_keygen.mjs C:\Users\Administrator\.lb-root-keys\lb-root-2026-01.private.json --keyid lb-root-2026-01
```

The registry update this produced (`LB_PUBLIC_KEYS['lb-root-2026-01']`, `status: 'active'`) is
already committed at `26720f39` in `C:/Users/Administrator/Documents/mnemosyne`; there is no
pending step 5-equivalent registry update to perform.

### 3.1. Per release: sign the manifest on M0

Each release, on M0, with the real key at its real path:

```
node scripts/trust_root_sign_manifest.mjs \
  --key C:\Users\Administrator\.lb-root-keys\lb-root-2026-01.private.json \
  --keyid lb-root-2026-01 \
  --version 0.9.26 \
  --url https://mnemosynec.org/dl/MnemosyneC-Setup-0.9.26.exe \
  --sha256 <the real sha256 of that installer, 64 hex chars> \
  --tier latest \
  --manifest C:\path\to\version_trust.json \
  --out C:\path\to\version_trust.signed.json
```

`--manifest` is optional: pass an existing `version_trust.json` to have the tool insert or
replace the matching `{version, tier}` entry and write out the whole updated manifest; omit it
to get just the one signed entry's JSON. The tool makes no network call of any kind. Because
signing now happens on the same machine that serves and builds the release, there is no USB
transfer step and no independent-channel verification step for this file — that safeguard was
specific to the offline design and does not apply to the current practice (see Section 4 for
what this costs).

As of the last check under `D-BP157-035`, the CI pipeline that publishes `version_trust.json`
was NOT FOUND in `.github/workflows/release.yml` in this repo — that publish step is still
separate, not-yet-built work; this ceremony produces the signed file that step needs to serve.

### 3.2. Rotation procedure (unchanged mechanics, now on M0 by default)

1. Generate a new keypair with a new `keyId` (bump the date/number, e.g. `lb-root-2026-02`), on
   M0 unless a future ruling reinstates an offline machine for this step.
2. Add the new entry to `LB_PUBLIC_KEYS` alongside the old one, `status: 'active'`. Do not
   remove the old entry yet.
3. Ship that as a normal Authenticode-signed release.
4. Once enough of the install base has updated to a build that recognizes the new `keyId`, start
   signing new manifests with the new key.
5. Only in a later release, remove the old `keyId` from `LB_PUBLIC_KEYS` — never by hot-patching
   the manifest, never by any means other than a normal shipped code change.

A machine offline across a rotation keeps trusting whichever `keyId`s its currently-installed
build's `LB_PUBLIC_KEYS` map contains, and fails closed on an unrecognized `keyId` — it never
bricks and never accepts something it cannot verify.

## 4. Accepted risk (read this section plainly)

Keeping the root key on M0, a networked machine, for its entire operational life means:

- **A compromise of M0 is equivalent to manifest forgery.** Whoever can read
  `C:\Users\Administrator\.lb-root-keys\lb-root-2026-01.private.json` can sign a manifest entry
  that every client with `lb-root-2026-01` in its `LB_PUBLIC_KEYS` map will accept as
  legitimate.
- **This is not a theoretical risk for this estate.** This estate leaked credentials off a
  networked machine once before, at BP155. The threat model this ruling accepts — secrets on a
  networked box being exposed — is the same threat model that already produced a real incident
  here, not a hypothetical one raised for the first time by this key.
- **The only upgrade path still open, and NOT taken:** a non-extractable HSM key, such as Azure
  Key Vault, alongside the existing Azure Trusted Signing code-signing identity. That would
  remove the copy-the-file-off-disk attack entirely, at the cost of concentrating both the
  code-signing identity and the manifest root inside one Azure tenancy — trading a
  disk-compromise risk for a single-tenancy-compromise risk, not eliminating risk outright. This
  is a Founder decision and has not been made. The keyId registry design makes adopting it, if
  it is ever decided, a normal signed release rather than a breaking change.

## 5. Backup and recovery (unchanged in importance)

**A root key that exists on exactly one disk is one hardware failure away from never being able
to ship a signed update again.** That was true under the offline design and remains equally true
now that the key lives on M0.

**MEASURED, by path and file-size existence only — no key content was read, copied, or moved by
this dispatch:** a backup of the private key currently exists in two locations beyond the
primary `C:\Users\Administrator\.lb-root-keys\` copy:

- `D:\LB_ROOT_KEY_BACKUP\lb-root-2026-01.private.json` (299 bytes, matches primary's size)
- `F:\LB_ROOT_KEY_BACKUP\lb-root-2026-01.private.json` (299 bytes, matches primary's size)

Both carry a matching `.pubkey.txt` sibling and both are on separate drives from the primary
copy and from each other. Whether either backup drive is encrypted was NOT checked (verifying
that would require reading beyond file existence/size, which this dispatch's standing rules
prohibit). If neither backup drive is confirmed encrypted, that is worth a follow-up check by an
actor authorized to inspect drive-level encryption state — this dispatch does not perform that
check.

- **What is lost if the key is destroyed with no backup:** every future release needs a new root
  key (Section 3.2) shipped in a normal Authenticode-signed release before that release's
  manifest can be trusted by clients that already require signatures. Releases already signed
  under the lost key stay verifiable; no new signature can ever be produced under that `keyId`
  again. Recoverable, not catastrophic, as long as at least one build still in the field has an
  `LB_PUBLIC_KEYS` map you can still ship an update to.
- **The one truly unrecoverable case:** losing the private key for the only `keyId` any shipped
  client currently trusts, with no other trusted `keyId` yet provisioned, before ever
  successfully shipping a rotation.

## 6. If the key is suspected compromised

1. Treat every release signed by the suspected key as still cryptographically valid but no
   longer trustworthy in intent — a compromised key can sign a legitimate-looking but malicious
   manifest entry that would pass `verifyManifestEntrySignature()` cleanly.
2. Immediately begin rotation (Section 3.2) with a freshly generated key. Given `FD-BP157-14`,
   the default assumption is that the new key is generated on M0 again, not on a newly
   air-gapped machine, unless a future ruling changes that.
3. Ship the rotation release as fast as the normal release process allows; this is the only
   mechanism that gets a new trusted `keyId` in front of clients.
4. Do not remove the compromised `keyId` from `LB_PUBLIC_KEYS` in the same release as adding the
   new one if any currently-served manifest entries still rely on it for legitimate reasons —
   remove it once nothing being served needs it, per the normal rotation Section 3.2 step 5.
5. Investigate how the key was exposed before generating its replacement.

---
Filed by `D-BP157-044/BISHOP/seg-supersede-offline-ceremony`, model Sonnet 5, superseding the
original `D-BP157-036/BISHOP/seg-offline-key-ceremony` version of this document. Rule 66 sibling
`TRUST_ROOT_CEREMONY.md.superseded.20260818T172006Z` was written and `cmp`-verified byte-identical
to the pre-edit file before this rewrite. No key material of any kind appears in this document.
