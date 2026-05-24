"""
Index all canon Eblets at  ~/.claude/state/eblets/CANON/  into the Spider FAISS index.

Reads each .eblet.md file (truncating to a sensible char budget for the model context),
posts to /index, prints stats.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from urllib import request

CANON_DIR = Path(os.path.expanduser("~/.claude/state/eblets/CANON"))
SIDECAR = "http://127.0.0.1:8765"
CHAR_BUDGET = 8000  # generous for canon snippets; model truncates at 256 tokens anyway
BATCH = 32


def post_json(path: str, payload: dict) -> dict:
    body = json.dumps(payload).encode("utf-8")
    req = request.Request(
        f"{SIDECAR}{path}",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with request.urlopen(req, timeout=120) as resp:
        return json.loads(resp.read().decode("utf-8"))


def get_json(path: str) -> dict:
    with request.urlopen(f"{SIDECAR}{path}", timeout=10) as resp:
        return json.loads(resp.read().decode("utf-8"))


def collect_items() -> list[dict]:
    items = []
    for p in sorted(CANON_DIR.glob("*.eblet.md")):
        try:
            text = p.read_text(encoding="utf-8", errors="replace")
        except Exception as e:
            print(f"  skip {p.name}: {e}", file=sys.stderr)
            continue
        if not text.strip():
            continue
        # ID is the filename stem (no .eblet.md)
        eblet_id = p.name[: -len(".eblet.md")] if p.name.endswith(".eblet.md") else p.stem
        items.append(
            {
                "id": eblet_id,
                "path": str(p).replace("\\", "/"),
                "text": text[:CHAR_BUDGET],
            }
        )
    return items


def main() -> int:
    print(f"Sidecar: {SIDECAR}")
    print(f"Health: {get_json('/health')}")
    items = collect_items()
    print(f"Collected {len(items)} canon eblets from {CANON_DIR}")
    if not items:
        return 1

    # Replace the index from scratch on first run for determinism.
    total_added = 0
    for i in range(0, len(items), BATCH):
        chunk = items[i : i + BATCH]
        payload = {"items": chunk, "replace_all": (i == 0)}
        resp = post_json("/index", payload)
        total_added += resp["added"]
        print(f"  batch {i // BATCH + 1}: added={resp['added']} total={resp['total']}")

    stats = get_json("/stats")
    print(f"Final: {stats}")
    print(f"Total added across batches: {total_added}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
