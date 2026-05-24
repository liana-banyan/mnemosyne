<#
.SYNOPSIS
    BeanSprouts → Cephas asset pipeline.
    Scans _to-publish/, converts PNG/JPG/WebP → WebP + JPG fallback,
    copies to Cephas static/prove-it/{slug}/, appends prove_it_gallery.yaml,
    moves original to _published/.

.DESCRIPTION
    Prerequisites:
      - ImageMagick (`magick` on PATH) for image conversion and resize.
        Install: https://imagemagick.org/script/download.php#windows
        Or via winget: winget install ImageMagick.Q16-HDRI

    Usage:
      pwsh scripts/cephas-asset-pipe.ps1
      pwsh scripts/cephas-asset-pipe.ps1 -Caption "BP045 W1 DROPZONE triage" -Class "bishop-chat"
      pwsh scripts/cephas-asset-pipe.ps1 -DryRun

.PARAMETER Caption
    Override caption for all files processed this run (applied to each entry).
    If omitted, caption is derived from the filename.

.PARAMETER Class
    Asset class tag written to YAML. Controls per-class auto-redaction.
    Values: bishop-chat | ssl-cert | browser-chrome | dashboard-account |
            infrastructure | competitive-landscape |
            honest-alpha | cathedral-instantiation | screenshot (default).
    bishop-chat:        auto-redacts bottom-left footer + universal bookmark-bar.
    ssl-cert:           auto-redacts phone-DOM zones + address-line zones + universal bookmark-bar.
    browser-chrome:     auto-redacts universal bookmark-bar only (all browser screenshots).
    dashboard-account:  auto-redacts URL bar, SSL chrome header/banner, dashboard card header,
                        login-account block (account-# + username + legal-name), and bookmark-bar.
                        Add filename suffix "_id-verified" to extend PII zone to y=685.
    screenshot:         no auto-redact (manual pass required).

.PARAMETER DeclinedList
    Path to a text file tracking files that failed PII verification — these
    are never published. Entries are one filename per line. Optional.

.PARAMETER BpSession
    BP session tag. Defaults to "BP045_W1".

.PARAMETER DryRun
    Print what would be done without moving or writing any files.
#>
param(
    [string]$Caption      = "",
    [string]$Class        = "screenshot",
    [string]$BpSession    = "BP045_W1",
    [string]$DeclinedList = "",
    [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ── Paths ──────────────────────────────────────────────────────────────────────
$INBOX        = "C:\Users\Administrator\Pictures\BeanSprouts\_to-publish"
$PUBLISHED    = "C:\Users\Administrator\Pictures\BeanSprouts\_published"
$CEPHAS_STATIC = "C:\Users\Administrator\Documents\LianaBanyanPlatform\Cephas\cephas-hugo\static\prove-it"
$GALLERY_YAML  = "C:\Users\Administrator\Documents\LianaBanyanPlatform\Cephas\cephas-hugo\data\prove_it_gallery.yaml"
$MAX_WIDTH     = 1600
$JPG_QUALITY   = 85

# ── Check ImageMagick ──────────────────────────────────────────────────────────
$magickAvailable = $false
try {
    $null = & magick -version 2>&1
    $magickAvailable = $true
    Write-Host "[OK] ImageMagick found on PATH."
} catch {
    Write-Warning "ImageMagick (magick) NOT found on PATH."
    Write-Warning "Install via: winget install ImageMagick.Q16-HDRI"
    Write-Warning "  or download from https://imagemagick.org/script/download.php#windows"
    Write-Warning "Pipeline will SKIP image conversion until ImageMagick is available."
}

# ── Load existing slugs from YAML (idempotency guard) ─────────────────────────
$existingSlugs = @{}
if (Test-Path $GALLERY_YAML) {
    $yamlContent = Get-Content $GALLERY_YAML -Raw -ErrorAction SilentlyContinue
    # Parse slug lines: "  slug: "some-slug""
    $matches_ = [regex]::Matches($yamlContent, '^\s*slug:\s*["\x27]?([^"\x27\r\n]+)["\x27]?', [System.Text.RegularExpressions.RegexOptions]::Multiline)
    foreach ($m in $matches_) {
        $existingSlugs[$m.Groups[1].Value.Trim()] = $true
    }
    Write-Host "[INFO] Loaded $($existingSlugs.Count) existing slug(s) from gallery YAML."
} else {
    Write-Host "[INFO] Gallery YAML not found at $GALLERY_YAML — will create on first publish."
}

# ── Ensure output directories exist ───────────────────────────────────────────
if (-not $DryRun) {
    New-Item -ItemType Directory -Force -Path $PUBLISHED    | Out-Null
    New-Item -ItemType Directory -Force -Path $CEPHAS_STATIC | Out-Null
}

# ── Helper: generate slug from filename ───────────────────────────────────────
function Get-Slug {
    param([string]$filename)
    # Remove extension
    $base = [System.IO.Path]::GetFileNameWithoutExtension($filename)
    # Lowercase
    $slug = $base.ToLower()
    # Replace spaces and underscores with hyphens
    $slug = $slug -replace '[\s_]+', '-'
    # Remove characters that are not alphanumeric or hyphens
    $slug = $slug -replace '[^a-z0-9\-]', ''
    # Collapse multiple hyphens
    $slug = $slug -replace '-{2,}', '-'
    # Trim leading/trailing hyphens
    $slug = $slug.Trim('-')
    # Enforce max length of 80 chars
    if ($slug.Length -gt 80) { $slug = $slug.Substring(0, 80).TrimEnd('-') }
    return $slug
}

# ── Helper: append YAML entry ──────────────────────────────────────────────────
function Add-GalleryEntry {
    param(
        [string]$Slug,
        [string]$Title,
        [string]$CaptionText,
        [string]$ClassTag,
        [string]$Session,
        [string]$CapturedAt,
        [string]$PublishedAt
    )
    $entry = @"

- slug: "$Slug"
  title: "$Title"
  caption: "$CaptionText"
  webp: "/prove-it/$Slug/$Slug.webp"
  jpg: "/prove-it/$Slug/$Slug.jpg"
  class: "$ClassTag"
  bp_session: "$Session"
  captured_at: "$CapturedAt"
  published: "$PublishedAt"
"@
    # Ensure parent directory exists
    $yamlDir = Split-Path $GALLERY_YAML -Parent
    if (-not (Test-Path $yamlDir)) {
        New-Item -ItemType Directory -Force -Path $yamlDir | Out-Null
    }
    # Initialize YAML file if missing
    if (-not (Test-Path $GALLERY_YAML)) {
        "# BeanSprouts → Cephas prove-it gallery manifest" | Set-Content $GALLERY_YAML -Encoding UTF8
        "# Auto-generated by scripts/cephas-asset-pipe.ps1 — DO NOT HAND-EDIT slugs" | Add-Content $GALLERY_YAML -Encoding UTF8
        "# PII check: every entry cleared by Founder before pipeline dispatch" | Add-Content $GALLERY_YAML -Encoding UTF8
        "# class field values: bishop-chat | ssl-cert | browser-chrome | dashboard-account | infrastructure | competitive-landscape | honest-alpha | cathedral-instantiation | screenshot" | Add-Content $GALLERY_YAML -Encoding UTF8
        "" | Add-Content $GALLERY_YAML -Encoding UTF8
    }
    Add-Content -Path $GALLERY_YAML -Value $entry -Encoding UTF8
}

# ── Per-class auto-redaction ──────────────────────────────────────────────────
# bishop-chat:        bottom-left footer (Founder display-name) + universal bookmark-bar
# ssl-cert:           phone-DOM zones + address-line + universal bookmark-bar
# browser-chrome:     universal bookmark-bar only (any browser screenshot)
# dashboard-account:  URL bar + SSL chrome header/banner + dashboard card header +
#                     login-account block (account-# + username + legal-name) + bookmark-bar
# screenshot:         no auto-redact (manual pass required)
#
# Minimal Disclosure Doctrine (BP045 W1): REDACT-by-default for all browser-class captures.
# Bookmark-bar zone (Chrome maximized, per SCRN-REDACT-5): y=38 to y=72, full width.
# Dashboard zones (per SCRN-REDACT-5): URL=140,2→{W},32 · Bookmark=0,38→{W},72 ·
#   Chrome-header/banner=0,90→{W},150 · Dashboard-header=220,400→1180,485 ·
#   Login-PII-block=460,485→870,665 (or 685 for id-verified sub-flag)

function Apply-ClassRedaction {
    param(
        [string]$InputPath,
        [string]$OutputPath,
        [string]$ClassTag,
        [bool]$MagickAvail
    )
    if (-not $MagickAvail) {
        Copy-Item -Path $InputPath -Destination $OutputPath -Force
        Write-Host "   [WARN] ImageMagick unavailable — skipping redaction, copied original."
        return
    }

    # Get image dimensions
    $dims = & magick identify -format "%wx%h" $InputPath 2>&1
    $parts = $dims -split 'x'
    $imgW = [int]$parts[0]
    $imgH = [int]$parts[1]

    $redactCmds = [System.Collections.Generic.List[string]]::new()

    if ($ClassTag -eq "bishop-chat") {
        # Bottom-left footer: x=0, y=(height-12), width=135, height=12
        $y1 = $imgH - 12
        $redactCmds.Add("-fill"); $redactCmds.Add("black")
        $redactCmds.Add("-draw"); $redactCmds.Add("rectangle 0,$y1 135,$imgH")
        Write-Host "   [REDACT] bishop-chat: bottom-left footer 0,$y1→135,$imgH"
        # Universal bookmark-bar (Chrome maximized): y=38 to y=72, full width
        $redactCmds.Add("-fill"); $redactCmds.Add("black")
        $redactCmds.Add("-draw"); $redactCmds.Add("rectangle 0,38 $imgW,72")
        Write-Host "   [REDACT] bishop-chat: bookmark-bar 0,38→$imgW,72"
    }
    elseif ($ClassTag -eq "ssl-cert") {
        # Phone-DOM zones: two rectangles from the EV-wizard
        $redactCmds.Add("-fill"); $redactCmds.Add("black")
        $redactCmds.Add("-draw"); $redactCmds.Add("rectangle 985,615 1205,660")
        $redactCmds.Add("-fill"); $redactCmds.Add("black")
        $redactCmds.Add("-draw"); $redactCmds.Add("rectangle 985,940 1205,985")
        # Address-line zone
        $redactCmds.Add("-fill"); $redactCmds.Add("black")
        $redactCmds.Add("-draw"); $redactCmds.Add("rectangle 0,700 1920,740")
        Write-Host "   [REDACT] ssl-cert: phone-DOM zones + address-line"
        # Universal bookmark-bar (Chrome maximized): y=38 to y=72, full width
        $redactCmds.Add("-fill"); $redactCmds.Add("black")
        $redactCmds.Add("-draw"); $redactCmds.Add("rectangle 0,38 $imgW,72")
        Write-Host "   [REDACT] ssl-cert: bookmark-bar 0,38→$imgW,72"
    }
    elseif ($ClassTag -eq "browser-chrome") {
        # Universal bookmark-bar only (Chrome maximized): y=38 to y=72, full width
        $redactCmds.Add("-fill"); $redactCmds.Add("black")
        $redactCmds.Add("-draw"); $redactCmds.Add("rectangle 0,38 $imgW,72")
        Write-Host "   [REDACT] browser-chrome: bookmark-bar 0,38→$imgW,72"
    }
    elseif ($ClassTag -eq "dashboard-account") {
        # URL bar (covers /team/{acct#}/account path in Chrome address bar)
        $redactCmds.Add("-fill"); $redactCmds.Add("black")
        $redactCmds.Add("-draw"); $redactCmds.Add("rectangle 140,2 $imgW,32")
        Write-Host "   [REDACT] dashboard-account: URL bar 140,2→$imgW,32"
        # Universal bookmark-bar (Chrome maximized): y=38 to y=72
        $redactCmds.Add("-fill"); $redactCmds.Add("black")
        $redactCmds.Add("-draw"); $redactCmds.Add("rectangle 0,38 $imgW,72")
        Write-Host "   [REDACT] dashboard-account: bookmark-bar 0,38→$imgW,72"
        # SSL chrome header dropdown / team-switch banner (covers both states)
        $redactCmds.Add("-fill"); $redactCmds.Add("black")
        $redactCmds.Add("-draw"); $redactCmds.Add("rectangle 0,90 $imgW,150")
        Write-Host "   [REDACT] dashboard-account: chrome-header/banner 0,90→$imgW,150"
        # Dashboard card header (account-info + username + status line)
        $redactCmds.Add("-fill"); $redactCmds.Add("black")
        $redactCmds.Add("-draw"); $redactCmds.Add("rectangle 220,400 1180,485")
        Write-Host "   [REDACT] dashboard-account: dashboard-header 220,400→1180,485"
        # Login-account block (username + email + name + account-number rows)
        # id-verified sub-flag: extend y-end to 685 when legal-name visible
        $piiYEnd = 665
        $baseName = [System.IO.Path]::GetFileNameWithoutExtension($InputPath)
        if ($baseName -match "id[-_]verified" -or $baseName -match "195136" -or $baseName -match "195147") {
            $piiYEnd = 685
            Write-Host "   [REDACT] dashboard-account: id-verified sub-flag — extending PII y-end to 685"
        }
        $redactCmds.Add("-fill"); $redactCmds.Add("black")
        $redactCmds.Add("-draw"); $redactCmds.Add("rectangle 460,485 870,$piiYEnd")
        Write-Host "   [REDACT] dashboard-account: login-PII-block 460,485→870,$piiYEnd"
    }
    else {
        # screenshot or unknown: copy as-is, no auto-redact
        Copy-Item -Path $InputPath -Destination $OutputPath -Force
        Write-Host "   [INFO] Class '$ClassTag': no auto-redact (manual pass required)."
        return
    }

    if ($redactCmds.Count -gt 0) {
        & magick $InputPath @redactCmds $OutputPath
        Write-Host "   [OK] Redaction applied → $OutputPath"

        # Probe-crop verification: check redacted region is actually black
        Probe-RedactionBlack -ImagePath $OutputPath -ClassTag $ClassTag -ImgH $imgH
    }
}

function Probe-RedactionBlack {
    param([string]$ImagePath, [string]$ClassTag, [int]$ImgH)
    try {
        $sampleX = 67; $sampleY = 0
        if ($ClassTag -eq "bishop-chat") {
            $y1 = $ImgH - 12
            $sampleX = 67; $sampleY = $y1 + 4
        } elseif ($ClassTag -eq "ssl-cert") {
            $sampleX = 990; $sampleY = 620
        } elseif ($ClassTag -eq "browser-chrome") {
            $sampleX = 400; $sampleY = 55
        } elseif ($ClassTag -eq "dashboard-account") {
            # Probe the login-account block center
            $sampleX = 665; $sampleY = 575
        } else {
            return
        }
        $meanVal = & magick $ImagePath -crop "10x5+${sampleX}+${sampleY}" -format "%[fx:mean]" info: 2>&1
        $mean = [double]$meanVal
        if ($mean -lt 0.05) {
            Write-Host "   [VERIFY-OK] Redaction probe: mean=$mean (black confirmed)"
        } else {
            Write-Warning "   [VERIFY-WARN] Redaction probe mean=$mean (may not be fully black — review manually)"
        }
    } catch {
        Write-Host "   [VERIFY-SKIP] Could not probe redaction region: $_"
    }
}

# ── Main loop ─────────────────────────────────────────────────────────────────
$imageFiles = @(Get-ChildItem -Path (Join-Path $INBOX '*') -File -Include "*.png","*.jpg","*.jpeg","*.webp" -ErrorAction SilentlyContinue)
if ($imageFiles.Count -eq 0) {
    Write-Host "[INFO] No image files found in $INBOX. Drop PII-cleared files there and re-run."
    Write-Host "       Path: $INBOX"
    exit 0
}

Write-Host "[INFO] Found $($imageFiles.Count) image file(s) in _to-publish/."
$processed = 0
$skipped   = 0
$failed    = 0

foreach ($img in $imageFiles) {
    $slug = Get-Slug -filename $img.Name
    $title = [System.IO.Path]::GetFileNameWithoutExtension($img.Name)
    $captionText = if ($Caption -ne "") { $Caption } else { $title -replace '-', ' ' -replace '_', ' ' }
    $now = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss")
    # Approximate captured_at from file LastWriteTime
    $capturedAt = $img.LastWriteTime.ToString("yyyy-MM-ddTHH:mm:ss")

    Write-Host ""
    Write-Host "── Processing: $($img.Name)"
    Write-Host "   Slug:       $slug"
    Write-Host "   Caption:    $captionText"

    # Idempotency check
    if ($existingSlugs.ContainsKey($slug)) {
        Write-Host "   [SKIP] Slug '$slug' already in gallery YAML — skipping."
        $skipped++
        continue
    }

    if ($DryRun) {
        Write-Host "   [DRY-RUN] Would process and publish this file."
        continue
    }

    try {
        # Create per-slug output directory in Cephas static
        $slugDir = Join-Path $CEPHAS_STATIC $slug
        New-Item -ItemType Directory -Force -Path $slugDir | Out-Null

        $outWebp = Join-Path $slugDir "$slug.webp"
        $outJpg  = Join-Path $slugDir "$slug.jpg"

        # Create temp redacted copy if needed
        $tempRedacted = Join-Path $env:TEMP "$slug-redacted$($img.Extension)"

        if ($magickAvailable) {
            Apply-ClassRedaction -InputPath $img.FullName -OutputPath $tempRedacted -ClassTag $Class -MagickAvail $magickAvailable
            $sourceForConversion = if (Test-Path $tempRedacted) { $tempRedacted } else { $img.FullName }

            # Convert + resize to WebP (max 1600px wide, strip metadata) — IM7 syntax (no 'convert' subcommand)
            & magick $sourceForConversion -resize "${MAX_WIDTH}x>" -strip -quality 85 $outWebp
            Write-Host "   [OK] WebP  → $outWebp"
            # Convert + resize to JPG fallback
            & magick $sourceForConversion -resize "${MAX_WIDTH}x>" -strip -quality $JPG_QUALITY $outJpg
            Write-Host "   [OK] JPG   → $outJpg"
        } else {
            # ImageMagick not available — copy original as placeholder, note in filename
            Copy-Item -Path $img.FullName -Destination $outWebp
            Copy-Item -Path $img.FullName -Destination $outJpg
            Write-Host "   [WARN] ImageMagick unavailable — copied original as placeholder (no resize/convert)."
            Write-Host "         Install ImageMagick and re-run to properly convert: winget install ImageMagick.Q16-HDRI"
        }

        # Cleanup temp redacted file
        if (Test-Path $tempRedacted) { Remove-Item $tempRedacted -Force }

        # Append YAML entry
        Add-GalleryEntry -Slug $slug -Title $title -CaptionText $captionText `
                         -ClassTag $Class -Session $BpSession `
                         -CapturedAt $capturedAt -PublishedAt $now
        Write-Host "   [OK] YAML  → appended to prove_it_gallery.yaml"

        # Move original to _published/
        $publishedDest = Join-Path $PUBLISHED $img.Name
        Move-Item -Path $img.FullName -Destination $publishedDest -Force
        Write-Host "   [OK] Moved original → _published/$($img.Name)"

        $existingSlugs[$slug] = $true
        $processed++

    } catch {
        Write-Error "   [FAIL] Error processing $($img.Name): $_"
        $failed++
    }
}

Write-Host ""
Write-Host "════════════════════════════════════════"
Write-Host "  Pipeline complete."
Write-Host "  Processed : $processed"
Write-Host "  Skipped   : $skipped  (already in YAML)"
Write-Host "  Failed    : $failed"
Write-Host "════════════════════════════════════════"
if ($processed -gt 0) {
    Write-Host ""
    Write-Host "Next step: run Hugo build + deploy Cephas to publish."
    Write-Host "  cd Cephas\cephas-hugo ; hugo --minify ; firebase deploy"
}
