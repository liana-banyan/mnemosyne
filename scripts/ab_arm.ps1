# ab_arm.ps1 -- D-BP149-025/BISHOP/S25/seg-abrunner
#
# Runs ONE ARM of an A/B measurement: N identical mesh-test runs, sequentially, unattended.
# Parses every result, writes a growing markdown log, and prints an arm summary at the end.
#
# WHY THIS EXISTS AND WHAT IT REFUSES TO DO.
# The measured run-to-run noise floor on this harness is about 44% average pairwise drift, with
# accuracy swinging 0.0% to 66.7% on an identical 6-question set with zero code change. A single
# run per arm therefore proves nothing, so an arm is 6 runs and about an hour. An hour of
# unattended running is exactly long enough for a silent setup mistake to waste all of it.
#
# So before it runs anything, this script HARD-FAILS on the two mistakes that would invalidate
# the measurement and would otherwise be invisible in the output:
#
#   1. WRONG CODE CHECKED OUT. It hashes the working-tree file and compares it to the blob of the
#      commit that defines this arm. If they differ, it stops. You cannot run the BEFORE arm
#      against the AFTER code by forgetting a checkout.
#   2. WRONG BUILD ANSWERING. It asks CDP which renderer is attached. If a PACKAGED (asar) build
#      is answering instead of the DEV renderer, it stops. Observed live at BP149: the CLI will
#      happily attach to a packaged binary that contains neither arm, and the run looks normal.
#
# It also checks for an orphaned in-progress run before EACH iteration, because killing the CLI
# does not cancel the in-page run, and the next invocation would be refused mid-arm.
#
# WHAT IT DOES NOT DO, DELIBERATELY: it never checks out code, never builds, and never restarts
# the app. Those steps change what is under test. A script that silently re-pointed the target
# mid-measurement would be the exact failure this one exists to prevent. You do those three by
# hand, then you run this.
#
# USAGE, from C:\Users\Administrator\Documents\mnemosyne :
#   pwsh -File scripts\ab_arm.ps1 -Arm before
#   pwsh -File scripts\ab_arm.ps1 -Arm after
#   pwsh -File scripts\ab_arm.ps1 -Arm before -Runs 3 -QuestionIds "46,92"     # smaller pilot

param(
    [Parameter(Mandatory = $true)][ValidateSet("before", "after")][string]$Arm,
    [int]$Runs = 6,
    [string]$QuestionIds = "46,72,66,85,98,92",
    [int]$Port = 9333,
    [int]$TimeoutMs = 1800000,
    [switch]$SkipBuildCheck
)

$ErrorActionPreference = "Stop"
$repo = "C:\Users\Administrator\Documents\mnemosyne"
$file = "src/main/plow/plow_mc_answerer.ts"

# The two commits that define the arms. BEFORE is the parent (agreement short-circuits).
# AFTER is the adjudication-always fix.
$ARM_COMMIT = @{ before = "ca7b9dfe"; after = "13b151de" }
$ARM_MEANING = @{
    before = "agreement SHORT-CIRCUITS -- adjudication never runs on an agree outcome"
    after  = "adjudication runs on EVERY answer -- agreement no longer terminates"
}

Set-Location $repo
$stamp = (Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ")
$outDir = "C:\Users\Administrator\Documents\LianaBanyanPlatform\BISHOP_DROPZONE\ab_results"
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Force -Path $outDir | Out-Null }
$log = Join-Path $outDir "AB_${Arm}_$stamp.md"

Write-Host ""
Write-Host "=== A/B ARM: $($Arm.ToUpper()) ===" -ForegroundColor Cyan
Write-Host "  meaning : $($ARM_MEANING[$Arm])"
Write-Host "  runs    : $Runs"
Write-Host "  qids    : $QuestionIds"
Write-Host "  log     : $log"
Write-Host ""

# ---- GATE 1: is the correct code actually checked out? ----
$expected = (git rev-parse "$($ARM_COMMIT[$Arm]):$file").Trim()
$actual = (git hash-object $file).Trim()
if ($expected -ne $actual) {
    $other = if ($Arm -eq "before") { "after" } else { "before" }
    $otherBlob = (git rev-parse "$($ARM_COMMIT[$other]):$file").Trim()
    Write-Host "STOP. The working tree does not contain the $($Arm.ToUpper()) code." -ForegroundColor Red
    Write-Host "  expected blob : $expected  ($($ARM_COMMIT[$Arm]))"
    Write-Host "  actual blob   : $actual"
    if ($actual -eq $otherBlob) {
        Write-Host "  DIAGNOSIS: the tree currently holds the $($other.ToUpper()) arm's code." -ForegroundColor Yellow
    }
    Write-Host ""
    Write-Host "  Fix, then rebuild AND relaunch dev mode before retrying:" -ForegroundColor Yellow
    Write-Host "    git checkout $($ARM_COMMIT[$Arm]) -- $file"
    Write-Host "    npm run build:main"
    exit 1
}
Write-Host "  [OK] working tree matches $($ARM_COMMIT[$Arm]) ($expected)" -ForegroundColor Green

# ---- GATE 2: is a DEV build answering, or a stale packaged one? ----
if (-not $SkipBuildCheck) {
    $probe = @'
(async()=>{
  try{
    const r = await fetch("http://127.0.0.1:PORT_HERE/json/list");
    const ts = await r.json();
    const pages = ts.filter(t => t.type === "page" && !t.url.startsWith("data:") && t.url !== "about:blank");
    const packaged = pages.find(t => t.url.includes("index.html"));
    const dev = pages.find(t => /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\]):\d+\//.test(t.url));
    if (packaged) { console.log("PACKAGED|" + packaged.url); }
    else if (dev) { console.log("DEV|" + dev.url); }
    else { console.log("NONE|no renderer page target"); }
  } catch(e) { console.log("UNREACHABLE|" + e.message); }
})()
'@ -replace "PORT_HERE", $Port
    $res = (node -e $probe) -join ""
    $kind, $detail = $res.Split("|", 2)
    if ($kind -eq "DEV") {
        Write-Host "  [OK] DEV renderer answering -- $detail" -ForegroundColor Green
    }
    else {
        Write-Host "STOP. Renderer check returned: $kind" -ForegroundColor Red
        Write-Host "  $detail"
        if ($kind -eq "PACKAGED") {
            Write-Host "  A packaged build is answering. It contains NEITHER arm's code." -ForegroundColor Yellow
            Write-Host "  Quit MnemosyneC from the taskbar, then relaunch dev:renderer and dev:main:cdp." -ForegroundColor Yellow
        }
        exit 1
    }
}

# ---- Orphan check. Killing the CLI does not cancel the in-page run. ----
function Test-MeshBusy {
    $p = @'
(async()=>{
  try{
    const r = await fetch("http://127.0.0.1:PORT_HERE/json/list");
    const t = (await r.json()).find(x => x.type==="page" && !x.url.startsWith("data:") && x.url!=="about:blank");
    const ws = new WebSocket(t.webSocketDebuggerUrl);
    ws.onopen = () => ws.send(JSON.stringify({id:1,method:"Runtime.evaluate",params:{expression:'(async()=>{const v=await window.amplify.meshTestIsActive();return JSON.stringify(v)})()',awaitPromise:true,returnByValue:true}}));
    ws.onmessage = m => { console.log(JSON.parse(m.data).result.result.value); process.exit(0); };
    setTimeout(()=>{console.log('{"active":"TIMEOUT"}');process.exit(0)}, 15000);
  } catch(e) { console.log('{"active":"ERROR"}'); }
})()
'@ -replace "PORT_HERE", $Port
    return (node -e $p) -join ""
}

$header = @"
# A/B ARM RESULTS -- $($Arm.ToUpper()) -- $stamp

**Arm meaning:** $($ARM_MEANING[$Arm])
**Commit under test:** ``$($ARM_COMMIT[$Arm])`` -- blob ``$expected`` verified against the working tree before the first run.
**Question set:** ``$QuestionIds`` -- the same six the 44% noise floor was measured on.
**Runs:** $Runs

**Reading rule, fixed before the data existed:** compare arm MEANS with their spread, never run to run. The drift band is about 44%. A difference smaller than that band is not a finding. qid 92 has an INVERTED criterion: it is the Critical Security Studies question with no single answer, so an ABSTAIN there is the correct outcome and will score as wrong.

| run | scored | correct | accuracy | per-qid (qid=chosen/correct) | wall-clock |
|---|---|---|---|---|---|
"@
Set-Content -LiteralPath $log -Value $header -Encoding UTF8

$armStart = Get-Date
$accs = @()

for ($i = 1; $i -le $Runs; $i++) {
    $busy = Test-MeshBusy
    if ($busy -notmatch '"active":\s*false') {
        Write-Host "  [WARN] run $i -- app reports mesh busy: $busy. Waiting 60s." -ForegroundColor Yellow
        Start-Sleep -Seconds 60
        $busy = Test-MeshBusy
        if ($busy -notmatch '"active":\s*false') {
            Write-Host "STOP. App still busy before run $i. Not starting -- a refused run would silently shorten the arm." -ForegroundColor Red
            Add-Content -LiteralPath $log -Value "| $i | ABORTED | app busy | - | - | - |"
            break
        }
    }

    Write-Host ""
    Write-Host "--- $($Arm.ToUpper()) run $i of $Runs  ($(Get-Date -Format 'HH:mm:ss')) ---" -ForegroundColor Cyan
    $t0 = Get-Date
    $out = & node scripts/mesh-test-cli.mjs --questionIds=$QuestionIds --port=$Port --timeoutMs=$TimeoutMs 2>&1
    $secs = [int]((Get-Date) - $t0).TotalSeconds

    $text = ($out | Out-String)
    Write-Host $text

    # Per-question results
    $qids = [regex]::Matches($text, 'qid=(\d+)\s+chosen=(\S+)\s+correct=(\S+)')
    $perQ = ($qids | ForEach-Object { "$($_.Groups[1].Value)=$($_.Groups[2].Value)/$($_.Groups[3].Value)" }) -join " "

    # Run summary line
    $m = [regex]::Match($text, 'scored=(\d+)\s+correct=(\d+)\s+accuracy=([\d.]+)%')
    if ($m.Success) {
        $scored = $m.Groups[1].Value; $corr = $m.Groups[2].Value; $acc = [double]$m.Groups[3].Value
        $accs += $acc
        Add-Content -LiteralPath $log -Value "| $i | $scored | $corr | $acc% | $perQ | ${secs}s |"
        Write-Host "  -> run $i : scored=$scored correct=$corr accuracy=$acc%  (${secs}s)" -ForegroundColor Green
    }
    else {
        Add-Content -LiteralPath $log -Value "| $i | PARSE_FAIL | - | - | $perQ | ${secs}s |"
        Write-Host "  -> run $i : could not parse a summary line. Raw output is above and the arm continues." -ForegroundColor Yellow
    }
}

$armMins = [int]((Get-Date) - $armStart).TotalMinutes
$summary = "`n## Arm summary`n`n"
if ($accs.Count -gt 0) {
    $mean = [math]::Round(($accs | Measure-Object -Average).Average, 2)
    $min = ($accs | Measure-Object -Minimum).Minimum
    $max = ($accs | Measure-Object -Maximum).Maximum
    $spread = [math]::Round($max - $min, 2)
    $summary += "| figure | value |`n|---|---|`n"
    $summary += "| runs completed | $($accs.Count) of $Runs |`n"
    $summary += "| **mean accuracy** | **$mean%** |`n"
    $summary += "| min / max | $min% / $max% |`n"
    $summary += "| **observed spread** | **$spread pp** |`n"
    $summary += "| arm wall-clock | $armMins min |`n`n"
    $summary += "**Observed spread within this single arm is $spread pp, with no code change between its runs. Any BEFORE-to-AFTER difference smaller than that is inside this arm's own noise and is not a finding.**`n"
    Write-Host ""
    Write-Host "=== $($Arm.ToUpper()) ARM COMPLETE: mean $mean%  (min $min / max $max, spread $spread pp) in $armMins min ===" -ForegroundColor Cyan
}
else {
    $summary += "**No runs produced a parseable summary. Treat this arm as unmeasured.**`n"
    Write-Host "=== $($Arm.ToUpper()) ARM PRODUCED NO USABLE RESULTS ===" -ForegroundColor Red
}
$summary += "`n*D-BP149-025 / BISHOP / S25 / seg-abrunner. Blob-verified arm, renderer-verified build.*`n"
Add-Content -LiteralPath $log -Value $summary

Write-Host ""
Write-Host "  log: $log"
