#!/usr/bin/env python3
"""Generate tutor/files.json — a {path: byte-size} map of every Markdown file.

Why: the reader needs to know which manifest-listed chapters actually exist on
disk (and which are sub-200-byte stubs). Locally it can probe with HEAD requests,
but over a network — e.g. GitHub Pages — 100+ round trips is slow. This bakes the
same information into one small file the reader fetches once.

Run from the repo root:  python3 tutor/build-index.py
(read.sh runs it automatically, so the local copy never goes stale.)
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
DIRS = ["modules", "engineering", "tutor", "blueprints", "curriculum"]

sizes = {}

# root-level markdown
for p in ROOT.glob("*.md"):
    sizes[p.name] = p.stat().st_size

# tracked directories
for d in DIRS:
    for p in (ROOT / d).rglob("*.md"):
        sizes[str(p.relative_to(ROOT))] = p.stat().st_size

out = ROOT / "tutor" / "files.json"
out.write_text(json.dumps(sizes, indent=0, sort_keys=True))

readable = sum(1 for v in sizes.values() if v > 200)
print(f"wrote {out.relative_to(ROOT)} — {len(sizes)} files, {readable} readable "
      f"({len(sizes) - readable} stub/empty)")
