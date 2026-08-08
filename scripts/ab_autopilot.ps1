# ab_autopilot.ps1 -- D-BP149-029/BISHOP/S29/seg-autopilot
#
# Runs the FULL adjudication A/B unattended: BEFORE arm, arm swap with rebuild and app restart,
# AFTER arm. Founder grant, BP149: "monitored and overwatched Autopilot, engage with Mnemosynec."
#
# GOVERNED BY THE DECLARED ENVELOPE at
#   LianaBanyanPlatform\BISHOP_DROPZONE\AUTOPILOT_ENVELOPE_BP149.md
# (HARDWIRE-09 LAW 2: scope, act class, cost ceiling, supervisor presence, refusal duties,
# heartbeat. Never self-granted, never self-widened, narrows when unwatched.)
#
# IT STOPS RATHER THAN GUESSES. Every refusal duty below halts the run, writes the reason to the
# heartbeat, and waits for the Founder. A boundary found and stopped at is the feature.
#   - arm blob gate fails            (measurement would be invalid)
#   - a PACKAGED renderer answers    (contains neither arm)
#   - build returns non-zero errors
#   - CDP does not return after restart within the bound
#   - an arm produces no parseable results
# It never pushes, never writes a database, never touches the Vault, never edits
# plow_mc_answerer.ts except by the two `git checkout` calls that DEFINE the arms.
#
# PROCESS DISCIPLINE: it kills Electron ONLY where the executable path is under this repo.
# Estate rule, earned at BP148 Lazarus: target narrowly, never a broad process match.
#
# USAGE, from C:\Users\Administrator\Documents\mnemosyne, with dev:renderer already running:
#   pwsh -File scripts\ab_autopilot.ps1
#   pwsh -File scripts\ab_autopilot.ps1 -Runs 3          # shorter pilot
#   pwsh -File scripts\ab_autopilot.ps1 -StartArm after  # resume if BEFORE already completed

param(
    [int]$Runs = 6,
    [string]$QuestionIds = "46,72,66,85,98,92",
    [int]$Port = 9333,
    [ValidateSet("before", "after")][string]$StartArm = "before",
    [int]$CdpWaitSeconds = 120
)

$ErrorActionPreference = "Stop"
$repo = "C:\Users\Administrator\Documents\mnemosyne"
$file = "src/main/plow/plow_mc_answerer.ts"
$beat = "C:\Users\Administrator\Documents\LianaBanyanPlatform\HARDWIRE\LEDGER\YOKE\HEARTBEAT\D-BP149-AUTOPILOT.beat"
$ARM_COMMIT = @{ before = "ca7b9dfe"; after = "13b151de" }

Set-Location $repo
$beatDir = Split-Path $beat -Parent
if (-not (Test-Path $beatDir)) { New-Item -ItemType Directory -Force -Path $beatDir | Out-Null }

function Beat([string]$msg, [string]$level = "INFO") {
    # Real clock call. Never a session-local guess -- that error is already on record at BP148.
    $ts = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    $line = "$ts  D-BP149-AUTOPILOT  BISHOP  [$level]  $msg"
    Add-Content -LiteralPath $beat -Value $line -Encoding UTF8
    $color = switch ($level) { "STOP" { "Red" } "WARN" { "Yellow" } "DONE" { "Green" } default { "Cyan" } }
    Write-Host $line -ForegroundColor $color
}

function Halt([string]$why) {
    Beat "HALTED. $why" "STOP"
    Beat "Autopilot stopped at a boundary rather than guessing across it. Founder decision needed." "STOP"
    exit 1
}

function Get-RepoElectron {
    # Narrow match only: Electron processes whose executable lives inside THIS repo.
    try { return @(Get-Process -Name electron -ErrorAction SilentlyContinue | Where-Object { $_.Path -and $_.Path.StartsWith($repo, [StringComparison]::OrdinalIgnoreCase) }) }
    catch { return @() }
}

function Test-Cdp {
    $probe = @'
(async()=>{
  try{
    const r = await fetch("http://127.0.0.1:PORT_HERE/json/list");
    const ts = await r.json();
    const pages = ts.filter(t => t.type==="page" && !t.url.startsWith("data:") && t.url!=="about:blank");
    const packaged = pages.find(t => t.url.includes("index.html"));
    const dev = pages.find(t => /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\]):\d+\//.test(t.url));
    if (dev) console.log("DEV|" + dev.url);
    else if (packaged) console.log("PACKAGED|" + packaged.url);
    else console.log("NONE|no renderer page target");
  } catch(e) { console.log("UNREACHABLE|" + e.message); }
})()
'@ -replace "PORT_HERE", $Port
    return ((node -e $probe) -join "")
}

function Restart-DevMain {
    Beat "Stopping the Electron dev main process (narrow match: executables under this repo only)."
    $procs = Get-RepoElectron
    if ($procs.Count -eq 0) { Beat "No repo-scoped Electron process found. Nothing to stop." "WARN" }
    foreach ($p in $procs) {
        Beat "  killing PID $($p.Id)  $($p.Path)"
        try { Stop-Process -Id $p.Id -Force -ErrorAction Stop } catch { Beat "  could not kill PID $($p.Id): $_" "WARN" }
    }
    Start-Sleep -Seconds 3

    Beat "Relaunching dev:main:cdp detached."
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "npm run dev:main:cdp" -WorkingDirectory $repo -WindowStyle Minimized | Out-Null

    Beat "Waiting up to $CdpWaitSeconds s for a DEV renderer on CDP $Port."
    $deadline = (Get-Date).AddSeconds($CdpWaitSeconds)
    while ((Get-Date) -lt $deadline) {
        Start-Sleep -Seconds 5
        $res = Test-Cdp
        $kind, $detail = $res.Split("|", 2)
        if ($kind -eq "DEV") { Beat "DEV renderer up: $detail" "DONE"; return }
        if ($kind -eq "PACKAGED") { Halt "A PACKAGED renderer answered on CDP $Port. It contains neither arm. $detail" }
    }
    Halt "CDP did not present a DEV renderer within $CdpWaitSeconds s. Refusing to run against an unknown build."
}

function Invoke-Arm([string]$arm) {
    Beat "=== ARM $($arm.ToUpper()) : checking out $($ARM_COMMIT[$arm]) -- $file"
    git checkout $ARM_COMMIT[$arm] -- $file
    $expected = (git rev-parse "$($ARM_COMMIT[$arm]):$file").Trim()
    $actual = (git hash-object $file).Trim()
    if ($expected -ne $actual) { Halt "Blob gate failed for the $arm arm. expected=$expected actual=$actual" }
    Beat "Blob verified: $actual"

    Beat "Building (npm run build:main)."
    $buildOut = & npm run build:main 2>&1
    if ($LASTEXITCODE -ne 0) {
        $buildOut | Select-Object -Last 20 | ForEach-Object { Beat "  build: $_" "WARN" }
        Halt "npm run build:main exited $LASTEXITCODE for the $arm arm."
    }
    Beat "Build clean, exit 0." "DONE"

    Restart-DevMain

    Beat "Handing off to ab_arm.ps1 for $Runs runs. Expect roughly $([int]($Runs * 9)) minutes."
    & pwsh -File (Join-Path $repo "scripts\ab_arm.ps1") -Arm $arm -Runs $Runs -QuestionIds $QuestionIds -Port $Port
    if ($LASTEXITCODE -ne 0) { Halt "ab_arm.ps1 returned $LASTEXITCODE for the $arm arm. Its own gate refused, see its output." }
    Beat "ARM $($arm.ToUpper()) COMPLETE." "DONE"
}

# ─────────────────────────── ENGAGE ───────────────────────────
Beat "AUTOPILOT ENGAGED. Envelope: BISHOP_DROPZONE\AUTOPILOT_ENVELOPE_BP149.md"
Beat "Runs per arm: $Runs. Question set: $QuestionIds. Supervisor: ABSENT, envelope narrowed."
Beat "Refusals armed: blob gate, packaged-renderer, build errors, CDP timeout, unparseable arm."

$armsToRun = if ($StartArm -eq "before") { @("before", "after") } else { @("after") }
if ($StartArm -eq "after") { Beat "StartArm=after -- skipping the BEFORE arm on the Founder's instruction." "WARN" }

foreach ($a in $armsToRun) { Invoke-Arm $a }

# Leave the tree on the FIX. Never leave it on the parent by accident.
Beat "Restoring the working tree to the fix (13b151de)."
git checkout 13b151de -- $file
$final = (git hash-object $file).Trim()
$expectFix = (git rev-parse "13b151de:$file").Trim()
if ($final -ne $expectFix) { Beat "Working tree did NOT restore to the fix. actual=$final" "STOP" }
else { Beat "Working tree restored to the fix." "DONE" }

Beat "AUTOPILOT COMPLETE. Arm logs: LianaBanyanPlatform\BISHOP_DROPZONE\ab_results\" "DONE"
Beat "NOTE FOR THE FOUNDER: the working tree still holds the fix but it is UNSTAGED and UNCOMMITTED. Bishop commits nothing under autopilot." "WARN"
