# Usage: .\scripts\bishop_closeout.ps1 -SessionId B120 -Summary "one-line summary"
# OR:    .\scripts\bishop_closeout.ps1 B120 "one-line summary"
#
# Three-step atomic Bishop session closeout (Windows PowerShell variant):
#   1. Verify MILESTONE_B{N}_CLOSEOUT.md exists in BISHOP_DROPZONE\03_BishopHandoffs\
#   2. Run npm run rebuild in librarian-mcp\ — capture exit code + tail
#   3. Verify the new B{N} session appears in librarian-mcp\index\context.json
#
# Exit 0 = full success. Exit 1 = any step failed.
# Prints OK/FAIL lines for each step and a three-line success banner at the end.
#
# K453(B120): Closes the "session writeout gap" where B118+B119 were invisible
# to get_diff_since_session until manual rebuild at B120 open.

param(
    [Parameter(Position = 0, Mandatory = $true)]
    [string]$SessionId,

    [Parameter(Position = 1, Mandatory = $false)]
    [string]$Summary = ""
)

# Force UTF-8 output so Unicode tick/cross chars render correctly
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

# ── validate session ID ────────────────────────────────────────────────────────
if ($SessionId -notmatch '^B\d+$') {
    Write-Error "ERROR: Session ID must be in the form B<number> (e.g. B120). Got: '$SessionId'"
    exit 1
}
$BNum = [int]($SessionId -replace '^B', '')
$PrevId = "B$($BNum - 1)"

# ── paths ─────────────────────────────────────────────────────────────────────
$ScriptDir    = Split-Path -Parent $MyInvocation.MyCommand.Path
$PlatformRoot = Split-Path -Parent $ScriptDir
$MilestoneRel = "BISHOP_DROPZONE\03_BishopHandoffs\MILESTONE_${SessionId}_CLOSEOUT.md"
$MilestoneAbs = Join-Path $PlatformRoot $MilestoneRel
$LibrarianDir = Join-Path $PlatformRoot "librarian-mcp"
$ContextJson  = Join-Path $LibrarianDir "index\context.json"

Write-Host ""
Write-Host "=== Bishop Closeout: $SessionId ===================================" -ForegroundColor Cyan
if ($Summary) { Write-Host "    Summary: $Summary" }
Write-Host ""

# ── Step 1: Verify milestone file ─────────────────────────────────────────────
Write-Host "--- Step 1/3: Verifying milestone file ---"
if (Test-Path $MilestoneAbs) {
    Write-Host "  [OK]  Milestone file found: $MilestoneRel" -ForegroundColor Green
} else {
    Write-Host "  [FAIL]  Milestone file NOT found." -ForegroundColor Red
    Write-Host "          Searched: $MilestoneAbs"
    Write-Host ""
    Write-Host "  Bishop must write MILESTONE_${SessionId}_CLOSEOUT.md before calling this script."
    exit 1
}

# ── Step 2: Rebuild Librarian index ───────────────────────────────────────────
Write-Host ""
Write-Host "--- Step 2/3: Rebuilding Librarian index ---"
Write-Host "    Running: npm run rebuild (in librarian-mcp\)"

Push-Location $LibrarianDir
try {
    $RebuildOutput = npm run rebuild 2>&1
    $RebuildExit   = $LASTEXITCODE
} finally {
    Pop-Location
}

# Extract build time or "fresh" status from output
$RebuildOutputStr = ($RebuildOutput | ForEach-Object { "$_" }) -join "`n"
$RebuildTime = "?"
if ($RebuildOutputStr -match 'Index built in ([\d.]+s)') {
    $RebuildTime = $Matches[1]
} elseif ($RebuildOutputStr -match 'Index is FRESH') {
    $RebuildTime = "fresh/no-op"
}

# Read session count from context.json
$SessionCount = "?"
if (Test-Path $ContextJson) {
    try {
        $ctx = Get-Content $ContextJson -Raw | ConvertFrom-Json
        $SessionCount = $ctx.sessions.Count
    } catch { }
}

if ($RebuildExit -eq 0) {
    Write-Host "  [OK]  Librarian index rebuilt ($RebuildTime, $SessionCount sessions)" -ForegroundColor Green
} else {
    Write-Host "  [FAIL]  npm run rebuild exited non-zero (exit $RebuildExit)." -ForegroundColor Red
    Write-Host "          Last 20 lines of output:"
    ($RebuildOutputStr -split "`n") | Select-Object -Last 20 | ForEach-Object { Write-Host "          $_" }
    exit 1
}

# ── Step 3: Verify session appears in context.json ────────────────────────────
Write-Host ""
Write-Host "--- Step 3/3: Verifying $SessionId is indexed ---"

$SessionFound = $false
if (Test-Path $ContextJson) {
    try {
        $ctx = Get-Content $ContextJson -Raw | ConvertFrom-Json
        $ids = $ctx.sessions | ForEach-Object { $_.id }
        $SessionFound = $ids -contains $SessionId
    } catch {
        Write-Host "  [FAIL]  Could not parse context.json: $_" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "  [FAIL]  context.json not found at: $ContextJson" -ForegroundColor Red
    exit 1
}

if ($SessionFound) {
    Write-Host "  [OK]  Session $SessionId now visible in Librarian index" -ForegroundColor Green
} else {
    Write-Host "  [FAIL]  Session $SessionId not found in index after rebuild." -ForegroundColor Red
    Write-Host "          This means get_diff_since_session $PrevId would NOT list $SessionId."
    Write-Host ""
    Write-Host "          Check that the milestone file follows MILESTONE_B###_CLOSEOUT.md naming"
    Write-Host "          and contains a valid ## Headline section."
    exit 1
}

# ── Success banner ─────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "===================================================================" -ForegroundColor Green
Write-Host "  [OK]  Milestone file verified: $MilestoneRel" -ForegroundColor Green
Write-Host "  [OK]  Librarian index rebuilt ($RebuildTime, $SessionCount sessions)" -ForegroundColor Green
Write-Host "  [OK]  Session $SessionId now visible via get_diff_since_session $PrevId" -ForegroundColor Green
Write-Host "===================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "    Bishop closeout COMPLETE for $SessionId."
if ($Summary) { Write-Host "    Ledger entry: `"$Summary`"" }
Write-Host ""
