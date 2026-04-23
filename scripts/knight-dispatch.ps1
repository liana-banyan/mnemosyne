#Requires -Version 5.1
<#
.SYNOPSIS
    Knight Dispatch Wrapper -- reads YAML frontmatter from a Knight prompt and
    opens Cursor with a prominent model recommendation.

.DESCRIPTION
    Parses the YAML frontmatter block (--- ... ---) at the top of a Knight
    prompt Markdown file.  Extracts complexity_tier and recommended_model.
    Opens the prompt file in Cursor.  Copies prompt content to clipboard.
    Displays model recommendation via terminal banner + Windows toast notification.
    Appends a dispatch event to scripts/knight_dispatch.log.jsonl.

    ---- Cursor CLI model-preselection status (Cursor 3.1.17, April 2026) ----
    Cursor 3.1.17 has NO --model flag.  CLI supports: file/folder open, --diff,
    --merge, --goto, --new-window, --reuse-window, --chat, --add-mcp, tunnel,
    serve-web, and "cursor agent".  None accept a model selector.
    The wrapper uses the "informed manual picker" approach (Half D):
    operator still selects the model inside Cursor, but the decision is
    pre-computed by Bishop's frontmatter score rather than guessed.
    -------------------------------------------------------------------------

.PARAMETER PromptFile
    Path to the Knight prompt Markdown file.  Accepts:
      - Absolute path
      - Path relative to current directory
      - Filename only  (resolved against BISHOP_DROPZONE/01_KnightPrompts/)
      - K-number shorthand, e.g. "K443"

.PARAMETER NewWindow
    Force Cursor to open in a new window (passes --new-window to cursor.exe).

.PARAMETER Finalize
    Knight session ID to finalize, e.g. "K443".  Use with -ActualCost.
    Finds the matching unfinalized log entry and enriches it with actual_cost_usd
    and finalized_at fields.  Enables Bishop's tier-vs-cost feedback loop.

.PARAMETER ActualCost
    Actual USD cost for the session being finalized.  Required with -Finalize.

.EXAMPLE
    .\scripts\knight-dispatch.ps1 K443

.EXAMPLE
    .\scripts\knight-dispatch.ps1 K443 -NewWindow

.EXAMPLE
    .\scripts\knight-dispatch.ps1 -PromptFile PROMPT_KNIGHT_K443_B117_MODEL_ROUTER_DISPATCH_WRAPPER.md

.EXAMPLE
    .\scripts\knight-dispatch.ps1 -Finalize K443 -ActualCost 18.50

.NOTES
    K443 / B117 -- LianaBanyan Platform
    Convention: YAML frontmatter added to all K-prompts from B118 onward.
    Absent frontmatter is handled gracefully (default: sonnet-4.6, WARN emitted).
    See scripts/KNIGHT_PROMPT_CONVENTIONS.md for the full frontmatter schema.
#>

[CmdletBinding(DefaultParameterSetName = 'Dispatch')]
param(
    [Parameter(ParameterSetName = 'Dispatch', Mandatory = $true, Position = 0)]
    [string]$PromptFile,

    [Parameter(ParameterSetName = 'Dispatch')]
    [switch]$NewWindow,

    [Parameter(ParameterSetName = 'Finalize', Mandatory = $true)]
    [string]$Finalize,

    [Parameter(ParameterSetName = 'Finalize', Mandatory = $true)]
    [decimal]$ActualCost
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# --------------------------------------------------------------------------
# Constants
# --------------------------------------------------------------------------
$SCRIPT_DIR     = Split-Path -Parent $MyInvocation.MyCommand.Path
$WORKSPACE_ROOT = Split-Path -Parent $SCRIPT_DIR
$PROMPT_DIR     = Join-Path $WORKSPACE_ROOT 'BISHOP_DROPZONE\01_KnightPrompts'
$LOG_FILE       = Join-Path $SCRIPT_DIR 'knight_dispatch.log.jsonl'
$DEFAULT_MODEL  = 'sonnet-4.6'
$LAUNCHED_VIA   = 'cursor-cli-fallback'   # no --model flag in Cursor 3.1.17

$KNOWN_MODELS = @('haiku-4.5', 'sonnet-4.6', 'opus-4.6', 'opus-4.7')

$MODEL_DISPLAY = @{
    'haiku-4.5'  = 'Claude Haiku 4.5   (fast + cheap,   ~$1-5/session)'
    'sonnet-4.6' = 'Claude Sonnet 4.6  (balanced,       ~$5-20/session)'
    'opus-4.6'   = 'Claude Opus 4.6    (powerful,       ~$20-50/session)'
    'opus-4.7'   = 'Claude Opus 4.7    (most powerful,  ~$30-120/session)'
}

$TIER_COLOR = @{
    'SIMPLE'   = 'Green'
    'MODERATE' = 'Yellow'
    'COMPLEX'  = 'Red'
}

# --------------------------------------------------------------------------
# Helper: Append-LogEntry
# --------------------------------------------------------------------------
function Append-LogEntry {
    param([System.Collections.Specialized.OrderedDictionary]$Entry)
    $json  = $Entry | ConvertTo-Json -Compress -Depth 3
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($json + "`n")
    # FileShare.Read allows readers to tail the log during write
    $stream = [System.IO.File]::Open(
        $LOG_FILE,
        [System.IO.FileMode]::Append,
        [System.IO.FileAccess]::Write,
        [System.IO.FileShare]::Read
    )
    try   { $stream.Write($bytes, 0, $bytes.Length) }
    finally { $stream.Close() }
}

# --------------------------------------------------------------------------
# Helper: Show-Toast  (Windows 10+ WinRT; fails silently if unavailable)
# --------------------------------------------------------------------------
function Show-Toast {
    param([string]$Title, [string]$Body)
    try {
        # Load WinRT types -- single-line, no spaces in the type annotation
        $null = [Windows.UI.Notifications.ToastNotificationManager,Windows.UI.Notifications,ContentType=WindowsRuntime]
        $null = [Windows.Data.Xml.Dom.XmlDocument,Windows.Data.Xml.Dom,ContentType=WindowsRuntime]

        $template  = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent(
            [Windows.UI.Notifications.ToastTemplateType]::ToastText02
        )
        $textNodes = $template.GetElementsByTagName('text')
        $null = $textNodes.Item(0).AppendChild($template.CreateTextNode($Title))
        $null = $textNodes.Item(1).AppendChild($template.CreateTextNode($Body))

        $toast    = [Windows.UI.Notifications.ToastNotification]::new($template)
        $notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('KnightDispatch')
        $notifier.Show($toast)
        return $true
    } catch {
        return $false
    }
}

# --------------------------------------------------------------------------
# Helper: Parse-YamlFrontmatter
# --------------------------------------------------------------------------
function Parse-YamlFrontmatter {
    param([string]$Content)

    $result = [ordered]@{
        HasFrontmatter           = $false
        knight_session           = $null
        bishop_session           = $null
        complexity_tier          = $null
        recommended_model        = $null
        escalation_trigger       = $null
        estimated_duration_hours = $null
    }

    # Frontmatter must start at the top of the file (allow optional BOM/whitespace)
    $rx = [regex]::Match($Content, '(?s)\A\s*---\s*\r?\n(.*?)\r?\n---')
    if (-not $rx.Success) { return $result }

    $result.HasFrontmatter = $true
    $block = $rx.Groups[1].Value

    foreach ($line in ($block -split '\r?\n')) {
        # Quoted value:   key: "value with spaces"
        if ($line -match '^\s*(\w+)\s*:\s*"([^"]*)"') {
            $k = $Matches[1].Trim()
            $v = $Matches[2]
            if ($result.Contains($k)) { $result[$k] = $v }
        }
        # Unquoted value: key: value   # optional inline comment
        elseif ($line -match '^\s*(\w+)\s*:\s*([^"#][^#\r\n]*)') {
            $k = $Matches[1].Trim()
            $v = $Matches[2].Trim()
            if ($result.Contains($k)) { $result[$k] = $v }
        }
    }

    return $result
}

# --------------------------------------------------------------------------
# Helper: Show-DispatchBanner
# --------------------------------------------------------------------------
function Show-DispatchBanner {
    param(
        [string]$KnightSession,
        [string]$Model,
        [string]$Tier,
        [string]$EscalationTrigger,
        [string]$EstimatedHours,
        [bool]$ModelWasDefault,
        [string]$PromptBasename
    )

    $sep       = '=' * 72
    $innerSep  = '-' * 72
    $tierColor = if ($TIER_COLOR.ContainsKey($Tier)) { $TIER_COLOR[$Tier] } else { 'White' }
    $modelLine = if ($MODEL_DISPLAY.ContainsKey($Model)) { $MODEL_DISPLAY[$Model] } else { $Model }

    Write-Host ''
    Write-Host $sep -ForegroundColor Cyan
    Write-Host "  KNIGHT DISPATCH  --  $KnightSession" -ForegroundColor Cyan
    Write-Host $sep -ForegroundColor Cyan
    Write-Host ''
    Write-Host ("  Prompt     : " + $PromptBasename)
    Write-Host '  Complexity : ' -NoNewline
    Write-Host $Tier -ForegroundColor $tierColor

    if ($EstimatedHours) {
        Write-Host ("  Est. hours : " + $EstimatedHours + 'h')
    }

    Write-Host ''
    Write-Host ('  +' + ('-' * 60) + '+') -ForegroundColor White
    Write-Host '  |  RECOMMENDED MODEL:                                       |' -ForegroundColor White
    $padded = ('  |    ' + $modelLine)
    $padded = $padded.PadRight(63) + '|'
    Write-Host $padded -ForegroundColor Yellow
    Write-Host ('  +' + ('-' * 60) + '+') -ForegroundColor White
    Write-Host ''

    if ($ModelWasDefault) {
        Write-Host '  [WARN] recommended_model not in frontmatter -- defaulted to sonnet-4.6' -ForegroundColor DarkYellow
    }

    if ($EscalationTrigger) {
        Write-Host '  Escalation trigger:' -ForegroundColor Magenta
        Write-Host ("    " + $EscalationTrigger) -ForegroundColor Magenta
        Write-Host ''
    }

    Write-Host '  ACTION -> Open Cursor model picker and select the model shown above.' -ForegroundColor Green
    Write-Host '  NOTE   -> Cursor 3.1.17 has no --model CLI flag; manual selection required.' -ForegroundColor DarkGray
    Write-Host ''
    Write-Host $sep -ForegroundColor Cyan
    Write-Host ''
}

# ==========================================================================
# FINALIZE MODE  (Half E -- post-session cost tracking)
# ==========================================================================
if ($PSCmdlet.ParameterSetName -eq 'Finalize') {
    if (-not (Test-Path $LOG_FILE)) {
        Write-Error "Log file not found: $LOG_FILE  (Has this session been dispatched yet?)"
        exit 1
    }

    $lines   = Get-Content $LOG_FILE -Encoding UTF8
    $updated = $false
    $newLines = foreach ($line in $lines) {
        if ([string]::IsNullOrWhiteSpace($line)) { continue }
        $obj = $line | ConvertFrom-Json
        $alreadyFinalized = $obj.PSObject.Properties.Name -contains 'actual_cost_usd'
        if ($obj.knight_session -eq $Finalize -and -not $alreadyFinalized) {
            $rebuilt = [ordered]@{}
            foreach ($prop in $obj.PSObject.Properties) { $rebuilt[$prop.Name] = $prop.Value }
            $rebuilt['actual_cost_usd'] = [double]$ActualCost
            $rebuilt['finalized_at']    = [datetime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ')
            $updated = $true
            $rebuilt | ConvertTo-Json -Compress -Depth 3
        } else {
            $line
        }
    }

    if ($updated) {
        $newLines | Set-Content $LOG_FILE -Encoding UTF8
        Write-Host "Session $Finalize finalized  actual_cost=`$$ActualCost  log=$LOG_FILE" -ForegroundColor Green
    } else {
        Write-Warning "No unfinalized log entry found for knight_session='$Finalize'. Check the log."
    }
    exit 0
}

# ==========================================================================
# DISPATCH MODE
# ==========================================================================

# ---- 1. Resolve prompt file path -----------------------------------------
$resolvedPath = $null

# (a) As-is: absolute or relative to CWD
if (Test-Path $PromptFile) {
    $resolvedPath = (Resolve-Path $PromptFile).Path
}

# (b) Filename only -- look in BISHOP_DROPZONE/01_KnightPrompts/
if (-not $resolvedPath) {
    $candidate = Join-Path $PROMPT_DIR $PromptFile
    if (Test-Path $candidate) { $resolvedPath = $candidate }
}

# (c) K-number shorthand, e.g. "K443"
if (-not $resolvedPath -and $PromptFile -match '^K\d+$') {
    $glob = Join-Path $PROMPT_DIR ("PROMPT_KNIGHT_$PromptFile" + '_*.md')
    $hits = @(Get-ChildItem -Path $glob -ErrorAction SilentlyContinue)
    if ($hits.Count -eq 1) {
        $resolvedPath = $hits[0].FullName
    } elseif ($hits.Count -gt 1) {
        Write-Error "Ambiguous: $($hits.Count) prompts match '$PromptFile'. Provide a more specific name."
        exit 1
    }
}

if (-not $resolvedPath) {
    Write-Error ("Prompt file not found: '$PromptFile'" + [Environment]::NewLine +
        "Searched: cwd, '$PROMPT_DIR\$PromptFile', K-number glob in prompt dir.")
    exit 1
}

$promptBasename = Split-Path -Leaf $resolvedPath
$promptContent  = Get-Content $resolvedPath -Raw -Encoding UTF8

# ---- 2. Parse frontmatter ------------------------------------------------
$fm = Parse-YamlFrontmatter -Content $promptContent

if (-not $fm.HasFrontmatter) {
    Write-Warning ("No YAML frontmatter found in '$promptBasename'." + [Environment]::NewLine +
        "  Defaulting to model=$DEFAULT_MODEL, tier=UNKNOWN." + [Environment]::NewLine +
        "  Bishop adds frontmatter to every new K-prompt from B118 onward." + [Environment]::NewLine +
        "  See scripts/KNIGHT_PROMPT_CONVENTIONS.md for the schema.")
}

# ---- 3. Resolve model ----------------------------------------------------
$modelWasDefault = $false
$model = $fm.recommended_model

if (-not $model) {
    $model           = $DEFAULT_MODEL
    $modelWasDefault = $true
    if ($fm.HasFrontmatter) {
        Write-Warning "Frontmatter present but 'recommended_model' field is absent. Defaulting to $DEFAULT_MODEL."
    }
}

if ($KNOWN_MODELS -notcontains $model) {
    Write-Warning "Unknown recommended_model value '$model'. Defaulting to $DEFAULT_MODEL."
    $model           = $DEFAULT_MODEL
    $modelWasDefault = $true
}

# ---- 4. Resolve remaining fields -----------------------------------------
$tier       = if ($fm.complexity_tier)          { $fm.complexity_tier }          else { 'UNKNOWN' }
$escalation = if ($fm.escalation_trigger)        { $fm.escalation_trigger }       else { '' }
$estHours   = if ($fm.estimated_duration_hours)  { $fm.estimated_duration_hours } else { '' }

$knightSession = if ($fm.knight_session) {
    $fm.knight_session
} else {
    if ($promptBasename -match '^PROMPT_KNIGHT_(K\d+)') { $Matches[1] } else { 'UNKNOWN' }
}
$bishopSession = if ($fm.bishop_session) { $fm.bishop_session } else { 'unknown' }

# ---- 5. Terminal banner --------------------------------------------------
Show-DispatchBanner `
    -KnightSession     $knightSession `
    -Model             $model `
    -Tier              $tier `
    -EscalationTrigger $escalation `
    -EstimatedHours    $estHours `
    -ModelWasDefault   $modelWasDefault `
    -PromptBasename    $promptBasename

# ---- 6. Copy prompt to clipboard -----------------------------------------
try {
    Set-Clipboard -Value $promptContent
    Write-Host '  [OK] Prompt content copied to clipboard.' -ForegroundColor DarkGray
} catch {
    Write-Warning "Could not copy to clipboard: $_"
}

# ---- 7. Open Cursor ------------------------------------------------------
$cursorArgs = [System.Collections.Generic.List[string]]::new()
$cursorArgs.Add($resolvedPath)
if ($NewWindow) { $cursorArgs.Add('--new-window') }

try {
    Start-Process 'cursor' -ArgumentList $cursorArgs
    Write-Host ("  [OK] Cursor launched with prompt file.") -ForegroundColor DarkGray
} catch {
    Write-Warning "Could not launch Cursor: $_  (Is cursor.exe on PATH?)"
}

# ---- 8. Windows toast notification (bonus; fails gracefully) -------------
$modelLabel = if ($MODEL_DISPLAY.ContainsKey($model)) { $MODEL_DISPLAY[$model] } else { $model }
$toastTitle = "Knight $knightSession -- Select Model in Cursor"
$toastBody  = "RECOMMENDED: $modelLabel  Tier: $tier"
if ($escalation) { $toastBody = $toastBody + "  Escalation: $escalation" }

$toastShown = Show-Toast -Title $toastTitle -Body $toastBody
if (-not $toastShown) {
    Write-Host '  [INFO] Windows toast unavailable -- see banner above for recommendation.' -ForegroundColor DarkGray
}

# ---- 9. Append to dispatch log -------------------------------------------
$estHoursValue = $null
if ($estHours -and $estHours -match '^\d+(\.\d+)?$') {
    $estHoursValue = [double]$estHours
}

$logEntry = [ordered]@{
    ts                       = [datetime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ')
    prompt_file              = $promptBasename
    knight_session           = $knightSession
    bishop_session           = $bishopSession
    complexity_tier          = $tier
    recommended_model        = $model
    launched_via             = $LAUNCHED_VIA
    estimated_duration_hours = $estHoursValue
    escalation_trigger       = if ($escalation) { $escalation } else { $null }
    model_was_default        = $modelWasDefault
}

Append-LogEntry -Entry $logEntry
Write-Host ("  [OK] Dispatch logged -> " + $LOG_FILE) -ForegroundColor DarkGray
Write-Host ''
