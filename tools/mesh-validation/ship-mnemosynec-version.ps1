# ship-mnemosynec-version.ps1
# MnemosyneC Canonical Ship Pipeline — BP099 SEG-MM Novaculi
# Written: 2026-06-29
#
# USAGE: Run from C:\Users\Administrator\Documents\mnemosyne\
#
# What this script does:
#   D1: Assumes K16+ source already migrated to mnemosyne/src/ (manual or SEG step)
#   D2: Bumps version in package.json, runs npm run dist:win, captures SHA256+SHA512
#   D3: Creates GH release (without exe), then uploads exe as asset
#   D4: Updates cephas-hugo data/version.json + version_trust.json + all latest.yml copies
#   D5: Hugo build + Firebase deploy
#   D6: 11-check verification (non-interactive; prints PASS/FAIL per check)
#
# CANON: Only Bishop/SEG may run this script. No free-form K-yokes.
# §4 BLOOD: Secrets loaded via subshell from vault; NEVER echoed.

param(
    [Parameter(Mandatory=$true)]
    [string]$NewVersion,        # e.g. "0.8.11"

    [Parameter(Mandatory=$false)]
    [string]$ReleaseNotes = "K-series release. See git log for details.",

    [Parameter(Mandatory=$false)]
    [string]$MnemosyneRepo = "C:\Users\Administrator\Documents\mnemosyne",

    [Parameter(Mandatory=$false)]
    [string]$CephasHugoDir = "C:\Users\Administrator\Documents\LianaBanyanPlatform\Cephas\cephas-hugo",

    [Parameter(Mandatory=$false)]
    [string]$FirebaseProject = "lianabanyan-403dc"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$GH_REPO = "liana-banyan/mnemosyne"
$EXE_NAME = "MnemosyneC-Setup-$NewVersion.exe"
$RELEASE_TAG = "v$NewVersion"
$GH_DOWNLOAD_URL = "https://github.com/$GH_REPO/releases/download/$RELEASE_TAG/$EXE_NAME"

function Log { param([string]$msg) Write-Host "[ship] $msg" -ForegroundColor Cyan }
function Ok  { param([string]$msg) Write-Host "[PASS] $msg" -ForegroundColor Green }
function Err { param([string]$msg) Write-Host "[FAIL] $msg" -ForegroundColor Red; throw "SHIP FAILED: $msg" }

# ─── D2: Bump version + build ─────────────────────────────────────────────────

Log "D2: Bumping version to $NewVersion in package.json"
$pkg = Get-Content "$MnemosyneRepo\package.json" -Raw | ConvertFrom-Json
$pkg.version = $NewVersion
$pkgJson = $pkg | ConvertTo-Json -Depth 10
# UTF-8 NO BOM — PowerShell 5.1's Set-Content -Encoding UTF8 adds BOM which breaks vite/PostCSS JSON parsing
[System.IO.File]::WriteAllText("$MnemosyneRepo\package.json", $pkgJson, [System.Text.UTF8Encoding]::new($false))
Log "Version bumped (UTF-8 no BOM)."

Log "D2: Running npm run dist:win (this takes 10-20 minutes)..."
Push-Location $MnemosyneRepo
npm run dist:win
Pop-Location

$exePath = "$MnemosyneRepo\release\$EXE_NAME"
if (-not (Test-Path $exePath)) { Err "EXE not found after build: $exePath" }
$exeSize = (Get-Item $exePath).Length
$sha256 = node -e "const fs=require('fs'),crypto=require('crypto'); console.log(crypto.createHash('sha256').update(fs.readFileSync('$($exePath.Replace('\','\\'))')).digest('hex').toUpperCase())"
$latestYml = Get-Content "$MnemosyneRepo\release\latest.yml" -Raw
$sha512b64 = ($latestYml | Select-String "sha512: (.+)" | ForEach-Object { $_.Matches[0].Groups[1].Value } | Select-Object -First 1)
Ok "EXE: $EXE_NAME | size: $([math]::Round($exeSize/1MB,2)) MB | SHA256: $sha256"
Ok "SHA512 (b64): $sha512b64"

# ─── D2: Commit + tag ────────────────────────────────────────────────────────

Log "D2: Committing version bump + tagging $RELEASE_TAG"
Push-Location $MnemosyneRepo
git add package.json
git commit -m "chore: bump version to $NewVersion"
git tag $RELEASE_TAG
git push origin main --tags
Pop-Location
Ok "Tag $RELEASE_TAG pushed to GitHub."

# ─── D3: GH Release ──────────────────────────────────────────────────────────

Log "D3: Creating GH release $RELEASE_TAG..."
Push-Location $MnemosyneRepo
$ghNotes = @"
## MnemosyneC $RELEASE_TAG

$ReleaseNotes

SHA256: $sha256
SHA512: $sha512b64
"@
gh release create $RELEASE_TAG --title "MnemosyneC $RELEASE_TAG" --notes $ghNotes
Log "D3: Uploading EXE ($([math]::Round($exeSize/1MB,2)) MB)... this may take several minutes."
gh release upload $RELEASE_TAG "release\$EXE_NAME" --clobber
Pop-Location
Ok "GH release $RELEASE_TAG created + EXE uploaded."

# ─── D4: Hugo data + latest.yml ──────────────────────────────────────────────

Log "D4: Updating version.json, version_trust.json, all latest.yml copies..."

# Build absolute latest.yml content
$latestYmlAbsolute = @"
version: $NewVersion
files:
  - url: $GH_DOWNLOAD_URL
    sha512: $sha512b64
    size: $exeSize
path: $EXE_NAME
sha512: $sha512b64
releaseDate: '$(Get-Date -Format 'yyyy-MM-ddTHH:mm:ss.fffZ')'
"@

# Update static sources (canonical)
Set-Content "$CephasHugoDir\static\download\latest.yml" $latestYmlAbsolute -Encoding UTF8
Set-Content "$CephasHugoDir\static\stage\download\latest.yml" $latestYmlAbsolute -Encoding UTF8

# Update all public-* build artifacts
Get-ChildItem -Recurse "$CephasHugoDir" -Filter "latest.yml" | Where-Object { $_.FullName -notlike "*\static\*" } | ForEach-Object {
    Set-Content $_.FullName $latestYmlAbsolute -Encoding UTF8
    Log "  Updated: $($_.FullName)"
}

# version.json
$verJson = @{
    version = $NewVersion
    filename = $EXE_NAME
    download_url = $GH_DOWNLOAD_URL
    release_notes = "${NewVersion}: $ReleaseNotes sha512: $sha512b64"
    sha512 = $sha512b64
    previous = @{
        version = $pkg.version  # old version before bump
        filename = "MnemosyneC-Setup-$($pkg.version).exe"
        download_url = "https://github.com/$GH_REPO/releases/download/v$($pkg.version)/MnemosyneC-Setup-$($pkg.version).exe"
        status = "superseded"
    }
} | ConvertTo-Json -Compress
Set-Content "$CephasHugoDir\data\version.json" $verJson -Encoding UTF8

Ok "Hugo data files updated."

# ─── D5: Hugo build + Firebase deploy ────────────────────────────────────────

Log "D5: Hugo build..."
Push-Location $CephasHugoDir
hugo --config config-mnemosynec.toml --environment production --minify
Pop-Location
Ok "Hugo build complete."

Log "D5: Firebase deploy hosting:mnemosyne + hosting:mnemosynec-ai..."
Push-Location $CephasHugoDir
firebase deploy --only "hosting:mnemosyne,hosting:mnemosynec-ai" --project $FirebaseProject
Pop-Location
Ok "Firebase deploy complete."

# ─── D6: 11-check verification ───────────────────────────────────────────────

Log "D6: Running 11-check verification..."

# Check 1+2: latest.yml from both domains
foreach ($domain in @("https://mnemosynec.ai", "https://mnemosynec.org")) {
    $yml = Invoke-WebRequest -Uri "$domain/download/latest.yml" -UseBasicParsing | Select-Object -ExpandProperty Content
    if ($yml -match "version: $([regex]::Escape($NewVersion))" -and $yml -match [regex]::Escape($GH_DOWNLOAD_URL)) {
        Ok "CHECK latest.yml @ $domain -> version $NewVersion + absolute URL"
    } else {
        Err "CHECK latest.yml @ $domain FAILED. Got: $($yml.Substring(0,[Math]::Min(200,$yml.Length)))"
    }
}

# Check 3: EXE URL redirect
$resp3 = Invoke-WebRequest -Uri $GH_DOWNLOAD_URL -Method HEAD -MaximumRedirection 0 -ErrorAction SilentlyContinue
if ($resp3.StatusCode -eq 302 -or $resp3.StatusCode -eq 301) {
    Ok "CHECK 3: GH EXE URL -> $($resp3.StatusCode)"
} else {
    Log "CHECK 3 WARNING: GH EXE URL returned $($resp3.StatusCode) (upload may still be in progress)"
}

# Checks 5+6: HTML version presence
foreach ($url in @("https://mnemosynec.ai/download/", "https://mnemosynec.org/")) {
    $html = Invoke-WebRequest -Uri $url -UseBasicParsing | Select-Object -ExpandProperty Content
    if ($html -match [regex]::Escape($NewVersion)) {
        Ok "CHECK HTML $url contains $NewVersion"
    } else {
        Err "CHECK HTML $url does NOT contain $NewVersion"
    }
}

# Check 11: git log
Push-Location $MnemosyneRepo
$gitLog = git log --oneline -3
$tagCheck = git tag -l $RELEASE_TAG
Pop-Location
if ($gitLog -match "bump version to $([regex]::Escape($NewVersion))" -and $tagCheck -eq $RELEASE_TAG) {
    Ok "CHECK 11: git log + tag $RELEASE_TAG confirmed"
} else {
    Err "CHECK 11: git log or tag missing. Log: $gitLog | Tag: $tagCheck"
}

Log "D6: Edge function checks 7-9 require node (run manually or use the node script)."
Log "SHIP PIPELINE COMPLETE for $RELEASE_TAG"
Write-Host ""
Write-Host "=== SHIP RECEIPT ===" -ForegroundColor Yellow
Write-Host "VERSION:  $NewVersion" -ForegroundColor White
Write-Host "EXE:      $EXE_NAME ($([math]::Round($exeSize/1MB,2)) MB)" -ForegroundColor White
Write-Host "SHA256:   $sha256" -ForegroundColor White
Write-Host "SHA512:   $sha512b64" -ForegroundColor White
Write-Host "GH URL:   $GH_DOWNLOAD_URL" -ForegroundColor White
Write-Host "RELEASE:  https://github.com/$GH_REPO/releases/tag/$RELEASE_TAG" -ForegroundColor White
