# Azure Artifact Signing Setup Guide
## Liana Banyan Platform — Mnemosyne Code Signing

**Canon source:** Pawn BP058 Part 4 + Part 5 (Gemini 3.1 Pro Thinking · 2026-05-26)
**GitHub Action:** `azure/trusted-signing-action@v0.3.18`
**Estimated cost:** ~$9.99/month (Basic Tier · 5,000 signatures/mo · $0.005/sig after cap)
**Annualized:** ~$120/yr (cheaper than EV cert)
**Geographic restriction:** US & Canada organizations only (LB is US-incorporated — CLEAR)

---

## §1 Why Code Signing Matters

When a Windows user downloads `Mnemosyne-Setup.exe` and double-clicks it, Microsoft SmartScreen checks
the file's digital signature against its reputation database. An **unsigned** or **unknown-signer**
binary triggers:

> "Windows protected your PC — Microsoft Defender SmartScreen prevented an unrecognized app from
> starting."

The user must click "More info → Run anyway" — a trust-breaking friction point that dramatically
reduces installs. A signed binary from a reputable certificate ELIMINATES this warning once
SmartScreen builds enough download telemetry (~hundreds of installs).

**Critical rule (canon BP058 drift correction):** Pick ONE signing method and stick with it.
Switching certificates or stacking multiple certs resets SmartScreen reputation to zero for each
new certificate thumbprint. Azure Artifact Signing is the selected method for Liana Banyan —
**do NOT also use SSL.com EV or any other cert simultaneously.**

---

## §2 Azure Account Setup

### 2.1 Prerequisites

| Item | Who | Notes |
|---|---|---|
| Microsoft Account (personal or org) | ⚠️ FOUNDER ONLY | account.microsoft.com |
| Azure subscription (Pay-As-You-Go is fine) | ⚠️ FOUNDER ONLY | portal.azure.com |
| Identity verification at au10tix | ⚠️ FOUNDER ONLY | Photo ID + selfie + Authenticator QR |

### 2.2 Step-by-Step (⚠️ = Founder-only browser steps)

**Step 1 — Microsoft Account** ⚠️ FOUNDER ONLY
Go to https://account.microsoft.com → Create or sign in to an existing Microsoft Account.

**Step 2 — Azure Subscription** ⚠️ FOUNDER ONLY
Go to https://portal.azure.com → Subscriptions → Add → Pay-As-You-Go.
Note your **Subscription ID** (format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`).

**Step 3 — Create Resource Group**
In Azure Portal → Resource Groups → Create:
- **Name:** `rg-liana-banyan-signing`
- **Region:** East US (matches `eus.codesigning.azure.net` endpoint in workflow)

**Step 4 — Create Artifact Signing Account** ⚠️ FOUNDER ONLY
Search "Artifact Signing" in Azure Portal → Create:
- **Account name:** `liana-banyan-signing` (or similar — this is `AZURE_CODE_SIGNING_ACCOUNT_NAME`)
- **Resource group:** `rg-liana-banyan-signing`
- **Region:** East US

**Step 5 — Identity Verification** ⚠️ FOUNDER ONLY
Inside the Artifact Signing Account → Identity Validation → Create:
- Upload government-issued photo ID
- Take selfie photo
- Scan Microsoft Authenticator QR code
- **If automated check passes:** returns in HOURS
- **If escalated to manual review:** up to SEVERAL DAYS — plan accordingly

**Step 6 — Create Certificate Profile**
Inside the Artifact Signing Account → Certificate Profiles → Create:
- **Profile type:** PublicTrust (for public distribution)
- **Profile name:** note this as `AZURE_CERTIFICATE_PROFILE_NAME`

**Step 7 — Create App Registration (Service Principal)**
Azure Portal → Entra ID (Azure Active Directory) → App Registrations → New Registration:
- **Name:** `liana-banyan-code-signing-sp`
- After creation, note:
  - **Application (client) ID** → this is `AZURE_CLIENT_ID`
  - **Directory (tenant) ID** → this is `AZURE_TENANT_ID`

**Step 8 — Create Client Secret** ⚠️ FOUNDER ONLY
Inside the App Registration → Certificates & Secrets → New Client Secret:
- **Description:** `github-actions-signing`
- **Expires:** 18 months (matches rotation reminder ICS — see `docs/reminders/`)
- Copy the **Value** (shown ONCE) → this is `AZURE_CLIENT_SECRET`

**Step 9 — Assign Role**
Artifact Signing Account → Access Control (IAM) → Add Role Assignment:
- **Role:** `Artifact Signing Certificate Profile Signer`
  (formerly "Trusted Signing Certificate Profile Signer" — renamed Jan 2026)
- **Assign to:** the `liana-banyan-code-signing-sp` app registration

**Step 10 — Budget Alert**
Run the budget alert script (Knight-authored):
```bash
bash scripts/azure-budget-alert.sh
```
See `scripts/azure-budget-alert.sh` for details. Sets $10 warning + $20 critical alerts.

---

## §3 Filling GitHub Secrets

Go to: **GitHub → LianaBanyanPlatform repo → Settings → Secrets and variables → Actions → New repository secret**

Fill these 6 secrets (all values from §2 above):

| Secret Name | Where to find it | Example format |
|---|---|---|
| `AZURE_CLIENT_ID` | App Registration → Overview → Application ID | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |
| `AZURE_CLIENT_SECRET` | App Registration → Certificates & Secrets (copy when created) | long random string |
| `AZURE_TENANT_ID` | App Registration → Overview → Directory (tenant) ID | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |
| `AZURE_SUBSCRIPTION_ID` | Azure Portal → Subscriptions → Subscription ID | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |
| `AZURE_CODE_SIGNING_ACCOUNT_NAME` | Artifact Signing Account name you chose | `liana-banyan-signing` |
| `AZURE_CERTIFICATE_PROFILE_NAME` | Certificate Profile name you chose | `liana-banyan-public` |

---

## §4 How the Workflow Triggers

File: `.github/workflows/release-sign.yml`

**Trigger 1 — Tag push:**
```bash
git tag v0.1.17
git push origin v0.1.17
```
GitHub Actions fires automatically. Artifacts in `amplify-computer/dist/` are signed and uploaded
as release assets.

**Trigger 2 — Manual dispatch:**
GitHub → Actions → "Release — Azure Artifact Signing" → Run workflow → enter tag.

**What gets signed:**
All `.exe` and `.msi` files in `amplify-computer/dist/`. The build job (Electron Builder or NSIS)
must complete first and deposit artifacts there before signing runs.

**SmartScreen reputation building:**
After signing, have cooperative members download and run the installer. Each install-that-passes
adds to SmartScreen's telemetry for the certificate thumbprint. ~200-500 installs typically
sufficient for "Established publisher" status. Microsoft Store channel (AGPL accepted, $0 cost,
100% revenue — confirmed Pawn BP058 Part 3) also accelerates reputation.

---

## §5 Budget Alert

See `scripts/azure-budget-alert.sh`. Requires Azure CLI (`az`) installed.

After running, Azure will email `founder@lianabanyan.com` at:
- **$10/month**: warning threshold
- **$20/month**: critical threshold (this would mean ~2,000 signatures — highly unlikely at launch)

Basic Tier is $9.99 flat for 5,000 signatures/month. Overage at $0.005/sig.

---

## §6 Key Rotation Schedule

Calendar reminders have been authored in `docs/reminders/`:

| File | Date | Action |
|---|---|---|
| `azure-identity-renewal-11months.ics` | 2027-04-26 | Renew au10tix identity verification |
| `azure-client-secret-rotation-18months.ics` | 2027-11-26 | Rotate `AZURE_CLIENT_SECRET` GitHub secret |

**Import both ICS files into your calendar now** (Outlook, Google Calendar, or Apple Calendar —
all support `.ics` import).

**When rotating client secret:**
1. Create a NEW client secret in Azure (App Registration → Certificates & Secrets)
2. Update `AZURE_CLIENT_SECRET` in GitHub → Settings → Secrets
3. Delete the OLD secret in Azure
4. Run a test workflow dispatch to verify

---

## §7 SSL.com EV Cert — Action Required

Per Pawn BP058 Part 4 and canon `canon_ssl_com_30_day_full_refund_unissued_cert_bp058`:

The SSL.com EV cert has been at 10 days no-mint. **100% refund is available.**

**Action (Founder only — ASAP):**
Call SSL.com support → request cancellation and full refund for the unissued EV cert.
Redirect the refund dollars toward the first Azure Artifact Signing billing cycle.

**Do NOT stack SSL.com EV with Azure Artifact Signing.** Stacking resets SmartScreen reputation.
Pick Azure. One cert. Build reputation on that thumbprint.

---

*Authored K-C · BP058 W6 · 2026-05-25 · Knight (Cursor/Sonnet 4.6)*
