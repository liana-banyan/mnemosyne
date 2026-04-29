#!/usr/bin/env python3
"""
SEC Language Flagging Script — K-SEC-Cleanup (B131/B132)
Mechanical scan of Wave 1-5 letter drafts for SEC-violation language patterns.
FLAG ONLY — no modifications to letter content.
"""

import re
import os
from pathlib import Path
from dataclasses import dataclass, field
from typing import List, Tuple, Optional

# ── Base path ────────────────────────────────────────────────────────────────
BASE = Path(r"C:\Users\Administrator\Documents\LianaBanyanPlatform\BISHOP_DROPZONE\00_FOUNDER_REVIEW")
OUTPUT_PATH = Path(r"C:\Users\Administrator\Documents\LianaBanyanPlatform\BISHOP_DROPZONE\03_BishopHandoffs\B131_SEC_CLEANUP_WORKLIST.md")

WAVE_FOLDERS = [
    "Wave_1_Apr12-13_Soft_Open",
    "Wave_2_Apr14-15_Real_Launch_PRESTAGED",
    "Wave_3_Apr16-17_Media_Day",
    "Wave_4_Apr18-19_Community",
    "Wave_5_Apr20-21_Show_Is_Live",
]

# ── Non-letter artifacts to skip ─────────────────────────────────────────────
NON_LETTER_PREFIXES = (
    "BST_EPISODE",
    "SPOONFULS_",
    "SKIPPING_STONES_",
    "ACADEMIC_PAPER_",
    "COMPLETE-Academic",
    "PAPER_UNLIMITED",
    "GLASS_DOOR_",
    "CROWN_LETTER_PATCHES_",
)

# ── SEC-flag pattern set ──────────────────────────────────────────────────────
# Each entry: (severity, label, compiled_regex)
# HIGH-RISK: presents LB participation AS a security
HIGH_RISK_PATTERNS = [
    ("HIGH", "equity stake",        re.compile(r'\bequity\s+stake\b', re.I)),
    ("HIGH", "actual equity",       re.compile(r'\bactual\s+equity\b', re.I)),
    ("HIGH", "equity-verified",     re.compile(r'\bequity[-\s]verified\b', re.I)),
    ("HIGH", "N% equity",           re.compile(r'\b\d+\s*%\s*equity\b', re.I)),
    ("HIGH", "own equity",          re.compile(r'\bown\s+equity\b', re.I)),
    ("HIGH", "equity interest",     re.compile(r'\bequity\s+interest\b', re.I)),
    ("HIGH", "equity shares",       re.compile(r'\bequity\s+shares\b', re.I)),
    ("HIGH", "shares of platform",  re.compile(r'\bshares\s+of\s+(?:the\s+)?platform\b', re.I)),
    ("HIGH", "dividends",           re.compile(r'\bdividend[s]?\b', re.I)),
    ("HIGH", "return on investment",re.compile(r'\breturns?\s+on\s+investment\b', re.I)),
    ("HIGH", "ROI",                 re.compile(r'\bROI\b')),
    ("HIGH", "passive income",      re.compile(r'\bpassive\s+income\b', re.I)),
    ("HIGH", "seed capital",        re.compile(r'\bseed\s+capital\b', re.I)),
    ("HIGH", "stake generates",     re.compile(r'\bstake\s+generates?\b', re.I)),
    ("HIGH", "investment ask",      re.compile(r'\binvestment\s+ask\b', re.I)),
    ("HIGH", "equity allocation",   re.compile(r'\bequity\s+allocation\b', re.I)),
    ("HIGH", "equity tier",         re.compile(r'\bequity\s+tier\b', re.I)),
]

# MEDIUM-RISK: negative/ambiguous form
MEDIUM_RISK_PATTERNS = [
    ("MEDIUM", "sell your stake/ownership", re.compile(r'\bsell\s+(?:them|it|your\s+stake|your\s+ownership)\b', re.I)),
    ("MEDIUM", "sold to/on/for",            re.compile(r'\bsold\s+(?:to|on|for)\b', re.I)),
    ("MEDIUM", "tradeable/tradable",        re.compile(r'\btrade[ae]?ble\b', re.I)),
    ("MEDIUM", "exchange for cash/fiat",    re.compile(r'\bexchange\s+for\s+(?:cash|fiat|dollars?)\b', re.I)),
    ("MEDIUM", "cash out",                  re.compile(r'\bcash\s*[-\s]out\b', re.I)),
    ("MEDIUM", "secondary market",          re.compile(r'\bsecondary\s+market\b', re.I)),
    ("MEDIUM", "invest in",                 re.compile(r'\binvest(?:ing|ment|ed|s)?\s+in\b', re.I)),
    ("MEDIUM", "investment opportunity",    re.compile(r'\binvestment\s+opportunit', re.I)),
    ("MEDIUM", "traditional investment",    re.compile(r'\btraditional\s+invest', re.I)),
    ("MEDIUM", "financial return",          re.compile(r'\bfinancial\s+return\b', re.I)),
]

# LOW-RISK: bare words that have legitimate uses — flag for review
LOW_RISK_PATTERNS = [
    ("LOW", "equity (bare word)",  re.compile(r'\bequity\b', re.I)),
    ("LOW", "shares (bare word)",  re.compile(r'\bshare[s]?\b', re.I)),
    ("LOW", "invest (bare verb)",  re.compile(r'\binvest\b', re.I)),
    ("LOW", "sell (bare verb)",    re.compile(r'\bsell\b', re.I)),
    ("LOW", "stake (bare word)",   re.compile(r'\bstake[s]?\b', re.I)),
    ("LOW", "returns (bare word)", re.compile(r'\breturns?\b', re.I)),
    ("LOW", "capital (bare word)", re.compile(r'\bcapital\b', re.I)),
]

ALL_PATTERNS = HIGH_RISK_PATTERNS + MEDIUM_RISK_PATTERNS + LOW_RISK_PATTERNS

# ── Suppression rules ─────────────────────────────────────────────────────────
# If the LINE or SURROUNDING CONTEXT (±2 lines) contains these phrases, suppress
SUPPRESSION_PHRASES = [
    re.compile(r'cannot\s+be\s+sold', re.I),
    re.compile(r'cannot\s+be\s+traded', re.I),
    re.compile(r'never\s+traded', re.I),
    re.compile(r'no\s+secondary\s+market', re.I),
    re.compile(r'not\s+a\s+security', re.I),
    re.compile(r'are\s+NOT\s+securities', re.I),
    re.compile(r'non[-\s]trade[ae]?ble', re.I),
    re.compile(r'non[-\s]transferable', re.I),
    re.compile(r'membership[-\s]orthogonal', re.I),
    re.compile(r'\$5/year\s+membership\s+unchanged', re.I),
    re.compile(r'pricing\s+identical\s+for\s+all', re.I),
    re.compile(r'one[-\s]way\s+valve', re.I),
    re.compile(r'credits?\s+never\s+cash\s+out', re.I),
    re.compile(r'cannot\s+cash\s+out', re.I),
    re.compile(r'not\s+an?\s+investment', re.I),
    re.compile(r'this\s+is\s+not\s+an?\s+offer', re.I),
    re.compile(r'irrevocable', re.I),
]

# Context window for suppression check (lines around the match)
SUPPRESSION_CONTEXT_WINDOW = 3


@dataclass
class Flag:
    line_num: int
    line_text: str
    severity: str
    pattern_label: str
    context_lines: List[str] = field(default_factory=list)
    suppressed: bool = False
    suggested: str = ""


def get_suggested_replacement(pattern_label: str, line_text: str) -> str:
    """Return a Bishop-scaffolding suggested replacement (Founder writes prose)."""
    suggestions = {
        "equity stake":           '"participation allocation" (e.g., "your participation allocation in the platform")',
        "actual equity":          '"actual participation allocation" or "actual platform contribution credit"',
        "equity-verified":        '"participation-verified"',
        "N% equity":              '"N% participation allocation"',
        "own equity":             '"hold participation allocation"',
        "equity interest":        '"participation interest"',
        "equity shares":          '"participation credits"',
        "shares of platform":     '"participation credits in the platform"',
        "dividends":              '"contribution bonuses" or "earned credit distributions"',
        "return on investment":   '"benefit from contributions" (credits never generate returns; they back participation)',
        "ROI":                    'Remove or rephrase: "value of participation" or "what your contribution backs"',
        "passive income":         '"passive credit accumulation" or "ongoing participation credit"',
        "seed capital":           '"founding contribution" or "Patron contribution"',
        "stake generates":        '"allocation backs" or "participation allocation enables"',
        "investment ask":         '"contribution request" or "Patron commitment"',
        "equity allocation":      '"participation allocation"',
        "equity tier":            '"participation tier"',
        "sell your stake/ownership": 'Remove — platform allocations cannot be sold',
        "sold to/on/for":         'Verify context — if referring to LB allocations, remove entirely',
        "tradeable/tradable":     '"non-tradeable" (affirmative statement) or remove',
        "exchange for cash/fiat": 'Remove — credits are one-way; cannot exchange for cash',
        "cash out":               'Remove — credits never cash out (irrevocable one-way valve)',
        "secondary market":       'Affirm absence: "no secondary market exists"',
        "invest in":              '"contribute to" or "back" (e.g., "Patrons who back the platform")',
        "investment opportunity": '"contribution opportunity" or "Patron opportunity"',
        "traditional investment": '"traditional capital deployment" or "traditional financial vehicle"',
        "financial return":       '"financial benefit" or "platform-backed credit growth"',
        "equity (bare word)":     'Review context — if referring to LB participation, use "allocation" or "contribution credit"',
        "shares (bare word)":     'Review context — if referring to LB participation, use "credits" or "allocation units"',
        "invest (bare verb)":     'Review context — if referring to LB, use "contribute" or "back"',
        "sell (bare verb)":       'Review context — if selling LB allocations is implied, remove or negate explicitly',
        "stake (bare word)":      'Review context — if referring to LB, use "allocation" or "participation"',
        "returns (bare word)":    'Review context — if referring to LB outcomes, use "benefits" or "credit growth"',
        "capital (bare word)":    'Review context — if referring to LB contributions, use "contribution" or "Patron funds"',
    }
    return suggestions.get(pattern_label, "Review and rephrase to remove securities-language implication.")


def check_suppressed(line_idx: int, lines: List[str], pattern_label: str) -> bool:
    """Return True if the match context triggers suppression rules."""
    start = max(0, line_idx - SUPPRESSION_CONTEXT_WINDOW)
    end = min(len(lines), line_idx + SUPPRESSION_CONTEXT_WINDOW + 1)
    context_block = " ".join(lines[start:end])
    for sup in SUPPRESSION_PHRASES:
        if sup.search(context_block):
            return True
    return False


def is_non_letter(filename: str) -> bool:
    """Return True if the file is a non-letter artifact to skip."""
    for prefix in NON_LETTER_PREFIXES:
        if filename.upper().startswith(prefix.upper()):
            return True
    return False


def is_sec_fixed(filename: str) -> bool:
    """Return True if this is an already-SEC-fixed version (skip scan, skip original)."""
    return "SEC_FIXED" in filename.upper()


def get_sec_fixed_base(filename: str) -> Optional[str]:
    """
    Given a file like CROWN_LETTER_X_SEC_FIXED_V2.md, return the human-readable
    base name for matching originals. (Simple heuristic — used to document supersessions.)
    """
    return re.sub(r'_SEC_FIXED.*', '', filename, flags=re.I)


def scan_file(filepath: Path) -> List[Flag]:
    """Scan a single file for SEC-flag patterns. Returns list of Flag objects."""
    with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
        lines = f.readlines()

    flags = []
    seen_positions = set()  # (line_num, pattern_label) dedup

    for line_idx, raw_line in enumerate(lines):
        line_text = raw_line.rstrip('\n')
        line_stripped = line_text.strip()
        if not line_stripped:
            continue

        for severity, label, pattern in ALL_PATTERNS:
            if pattern.search(line_stripped):
                key = (line_idx, label)
                if key in seen_positions:
                    continue
                seen_positions.add(key)

                suppressed = check_suppressed(line_idx, [l.rstrip('\n') for l in lines], label)

                ctx_start = max(0, line_idx - 1)
                ctx_end = min(len(lines), line_idx + 2)
                context = [lines[i].rstrip('\n') for i in range(ctx_start, ctx_end)]

                flag = Flag(
                    line_num=line_idx + 1,
                    line_text=line_text,
                    severity=severity,
                    pattern_label=label,
                    context_lines=context,
                    suppressed=suppressed,
                    suggested=get_suggested_replacement(label, line_text),
                )
                flags.append(flag)

    return flags


def determine_active_drafts(wave_folder: Path) -> Tuple[List[Path], List[str]]:
    """
    Enumerate active drafts in a wave folder.
    Returns (active_files, skip_reasons_log).
    """
    all_files = sorted(wave_folder.glob("*.md"))
    sec_fixed_files = {f for f in all_files if is_sec_fixed(f.name)}
    sec_fixed_bases = {get_sec_fixed_base(f.name).upper() for f in sec_fixed_files}

    active = []
    skipped = []

    for f in all_files:
        name = f.name
        name_upper = name.upper()

        if is_sec_fixed(name):
            skipped.append(f"SKIP (already SEC-fixed): {name}")
            continue
        if is_non_letter(name):
            skipped.append(f"SKIP (non-letter artifact): {name}")
            continue
        # Check if superseded by a SEC_FIXED version (heuristic: SEC_FIXED base matches stem)
        stem_upper = re.sub(r'[_-]V\d+.*$', '', re.sub(r'[_-]SEC_FIXED.*$', '', name_upper, flags=re.I), flags=re.I)
        superseded = False
        for base in sec_fixed_bases:
            clean_base = re.sub(r'[_-]V\d+.*$', '', base, flags=re.I).upper()
            if clean_base and stem_upper.startswith(clean_base[:20]) and len(clean_base) > 8:
                superseded = True
                break
        if superseded:
            skipped.append(f"SKIP (superseded by SEC_FIXED version): {name}")
            continue

        active.append(f)

    return active, skipped


def severity_sort_key(flag: Flag) -> int:
    return {"HIGH": 0, "MEDIUM": 1, "LOW": 2}[flag.severity]


def generate_worklist(results: dict) -> str:
    """Generate the full worklist markdown document."""
    total_high = 0
    total_medium = 0
    total_low = 0
    total_suppressed = 0
    letters_with_flags = 0
    letters_clean = 0

    lines = []
    lines.append("# SEC Cleanup Worklist — B132 Prose-Pass Checklist")
    lines.append("")
    lines.append("**Generated**: K-SEC-Cleanup session, B131/B132")
    lines.append("**Purpose**: Mechanical flag of SEC-violation language across Wave 1–5 active letter drafts. "
                 "Founder reviews and applies single prose-pass. Knight did NOT modify any letter content.")
    lines.append("**Scope**: Wave 1–5 FOUNDER_REVIEW folders. SEC_FIXED versions excluded (already clean). "
                 "Non-letter artifacts excluded. LOW-risk bare-word flags shown for completeness — many may be fine in context.")
    lines.append("**Suppression**: Lines with explicit negation context (e.g., 'cannot be sold', 'not a security', "
                 "'one-way valve') auto-suppressed and shown separately at bottom of each letter section.")
    lines.append("")
    lines.append("---")
    lines.append("")

    # Per-wave, per-letter sections
    for wave_name, wave_data in sorted(results.items()):
        lines.append(f"## {wave_name}")
        lines.append("")

        skipped = wave_data["skipped"]
        if skipped:
            lines.append("**Files skipped** (SEC_FIXED / superseded / non-letter artifacts):")
            for s in skipped:
                lines.append(f"- {s}")
            lines.append("")

        letter_results = wave_data["letters"]
        if not letter_results:
            lines.append("_No active letter drafts found._")
            lines.append("")
            continue

        for letter_path, flags in letter_results:
            rel_path = letter_path.relative_to(
                Path(r"C:\Users\Administrator\Documents\LianaBanyanPlatform")
            )
            active_flags = [f for f in flags if not f.suppressed]
            suppressed_flags = [f for f in flags if f.suppressed]

            high_flags = [f for f in active_flags if f.severity == "HIGH"]
            medium_flags = [f for f in active_flags if f.severity == "MEDIUM"]
            low_flags = [f for f in active_flags if f.severity == "LOW"]

            total_high += len(high_flags)
            total_medium += len(medium_flags)
            total_low += len(low_flags)
            total_suppressed += len(suppressed_flags)

            if active_flags:
                letters_with_flags += 1
                severity_tag = "🔴 HIGH-RISK" if high_flags else ("🟡 MEDIUM" if medium_flags else "🟢 LOW-ONLY")
                lines.append(f"### `{rel_path.name}` — {severity_tag} ({len(high_flags)}H / {len(medium_flags)}M / {len(low_flags)}L active flags)")
            else:
                letters_clean += 1
                lines.append(f"### `{rel_path.name}` — ✅ CLEAN (0 active flags, {len(suppressed_flags)} suppressed)")

            lines.append(f"**Path**: `{rel_path}`")
            lines.append("")

            if active_flags:
                sorted_flags = sorted(active_flags, key=severity_sort_key)
                for flag in sorted_flags:
                    sev_icon = {"HIGH": "🔴", "MEDIUM": "🟡", "LOW": "🟢"}[flag.severity]
                    lines.append(f"- [ ] **Line {flag.line_num}**: `{flag.line_text.strip()[:120]}`")
                    lines.append(f"      → PATTERN: `{flag.pattern_label}` | SEVERITY: {sev_icon} {flag.severity}")
                    lines.append(f"      → SUGGESTED (Bishop scaffold — Founder writes prose): {flag.suggested}")
                    lines.append("")

            if suppressed_flags:
                lines.append(f"<details><summary>Suppressed flags ({len(suppressed_flags)} — explicit negation context)</summary>")
                lines.append("")
                for flag in suppressed_flags:
                    lines.append(f"- **Line {flag.line_num}** [`{flag.pattern_label}` / {flag.severity}]: `{flag.line_text.strip()[:100]}` ← suppressed (negation context)")
                lines.append("")
                lines.append("</details>")
                lines.append("")

            lines.append("---")
            lines.append("")

    # Summary section
    total_active_flags = total_high + total_medium + total_low
    lines.insert(lines.index("---") + 1, "")
    summary_idx = lines.index("---") + 2

    summary = [
        "## Summary",
        "",
        f"| Metric | Count |",
        f"|--------|-------|",
        f"| Letters scanned (active drafts) | {letters_with_flags + letters_clean} |",
        f"| Letters with active flags | {letters_with_flags} |",
        f"| Letters clean (0 active flags) | {letters_clean} |",
        f"| 🔴 HIGH-RISK flags | {total_high} |",
        f"| 🟡 MEDIUM flags | {total_medium} |",
        f"| 🟢 LOW flags (bare-word, review in context) | {total_low} |",
        f"| Total active flags | {total_active_flags} |",
        f"| Suppressed flags (negation context) | {total_suppressed} |",
        "",
        "**Founder action**: Single prose-pass session using this checklist. "
        "Check off each item as addressed. LOW flags may be acceptable — verify context. "
        "HIGH flags require explicit replacement or removal before dispatch.",
        "",
        "**Publication gate**: Knight produced worklist; Founder applies fixes; "
        "Founder alone fires actual letter dispatch.",
        "",
        "---",
        "",
    ]
    for i, s in enumerate(summary):
        lines.insert(summary_idx + i, s)

    return "\n".join(lines)


def main():
    print("K-SEC-Cleanup: SEC Language Flagging Sweep")
    print("=" * 60)

    results = {}
    all_scanned = []
    all_active_letters = []

    for wave_name in WAVE_FOLDERS:
        wave_folder = BASE / wave_name
        if not wave_folder.exists():
            print(f"  [MISSING] {wave_name}")
            continue

        print(f"\n[WAVE] {wave_name}")
        active_files, skipped = determine_active_drafts(wave_folder)

        print(f"  Active drafts: {len(active_files)}, Skipped: {len(skipped)}")

        letter_results = []
        for filepath in active_files:
            flags = scan_file(filepath)
            active_flags = [f for f in flags if not f.suppressed]
            print(f"  {filepath.name}: {len(active_flags)} active flags "
                  f"({sum(1 for f in active_flags if f.severity=='HIGH')}H "
                  f"{sum(1 for f in active_flags if f.severity=='MEDIUM')}M "
                  f"{sum(1 for f in active_flags if f.severity=='LOW')}L), "
                  f"{sum(1 for f in flags if f.suppressed)} suppressed")
            letter_results.append((filepath, flags))
            all_scanned.append(filepath)
            all_active_letters.append((filepath, flags))

        results[wave_name] = {
            "skipped": skipped,
            "letters": letter_results,
        }

    print(f"\n[TOTAL] {len(all_scanned)} letters scanned")

    # Generate worklist
    worklist_md = generate_worklist(results)
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        f.write(worklist_md)
    print(f"\n[OUTPUT] Worklist written to: {OUTPUT_PATH}")

    # Quick severity summary
    high_total = sum(
        sum(1 for f in flags if not f.suppressed and f.severity == "HIGH")
        for _, flags in all_active_letters
    )
    med_total = sum(
        sum(1 for f in flags if not f.suppressed and f.severity == "MEDIUM")
        for _, flags in all_active_letters
    )
    low_total = sum(
        sum(1 for f in flags if not f.suppressed and f.severity == "LOW")
        for _, flags in all_active_letters
    )
    print(f"\n[SEVERITY TOTALS] HIGH: {high_total}  MEDIUM: {med_total}  LOW: {low_total}")
    print("\nDone. Worklist ready for Founder prose-pass.")


if __name__ == "__main__":
    main()
