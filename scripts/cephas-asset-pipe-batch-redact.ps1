<#
.SYNOPSIS
    Batch-redact companion: moves _redacted/ → _to-publish/ then runs the pipeline with -Class ssl-cert.

.DESCRIPTION
    Bishop's SCRN-REDACT-BATCH outputs pre-redacted files to _redacted/.
    This companion moves them to _to-publish/ and invokes cephas-asset-pipe.ps1
    with -Class ssl-cert so the ssl-cert auto-redaction rules apply as a second pass.

.PARAMETER Caption
    Optional caption override for all files in this batch.

.PARAMETER BpSession
    BP session tag. Defaults to "BP045_W1".

.PARAMETER DryRun
    Print what would be done without moving files or running the pipeline.
#>
param(
    [string]$Caption   = "BP045 W1 NOVACULA ssl-cert peer-witness",
    [string]$BpSession = "BP045_W1",
    [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$REDACTED    = "C:\Users\Administrator\Pictures\BeanSprouts\_redacted"
$TO_PUBLISH  = "C:\Users\Administrator\Pictures\BeanSprouts\_to-publish"
$PIPE_SCRIPT = "C:\Users\Administrator\Documents\LianaBanyanPlatform\scripts\cephas-asset-pipe.ps1"

Write-Host "[BATCH-REDACT] Scanning: $REDACTED"
$redactedFiles = @(Get-ChildItem -Path $REDACTED -File -Include "*.png","*.jpg","*.jpeg","*.webp" -ErrorAction SilentlyContinue)

if ($redactedFiles.Count -eq 0) {
    Write-Host "[INFO] No files in _redacted/. Bishop SCRN-REDACT-BATCH output goes there."
    exit 0
}

Write-Host "[INFO] Found $($redactedFiles.Count) pre-redacted file(s)."

$moved = 0
foreach ($f in $redactedFiles) {
    $dest = Join-Path $TO_PUBLISH $f.Name
    if ($DryRun) {
        Write-Host "  [DRY-RUN] Would move: $($f.Name) → _to-publish/"
        continue
    }
    Write-Host "  [MOVE] $($f.Name) → _to-publish/"
    Copy-Item -Path $f.FullName -Destination $dest -Force
    $moved++
}

if ($DryRun) {
    Write-Host "[DRY-RUN] Would invoke pipeline with -Class ssl-cert"
    exit 0
}

if ($moved -gt 0) {
    Write-Host ""
    Write-Host "[BATCH-REDACT] Invoking pipeline with -Class ssl-cert..."
    & pwsh $PIPE_SCRIPT -Caption $Caption -Class "ssl-cert" -BpSession $BpSession
} else {
    Write-Host "[INFO] No files moved. Nothing to process."
}
