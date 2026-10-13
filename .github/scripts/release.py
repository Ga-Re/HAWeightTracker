"""Create the GitHub releases that are missing for the versions in CHANGELOG.md.

- The version in manifest.json must have a section in CHANGELOG.md, otherwise
  the run fails (so a version bump is never released without notes).
- That version is tagged v<version> on the pushed commit and marked latest.
- Older versions get a release only if their tag already exists.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = ROOT / "custom_components" / "weight_tracker" / "manifest.json"
CHANGELOG = ROOT / "CHANGELOG.md"
HEADING = re.compile(r"^## \[(\d+\.\d+\.\d+)\](?:\s+[–-]\s+(\S+))?\s*$", re.MULTILINE)


def run(*args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(args, check=check, text=True, capture_output=True)


def sections() -> dict[str, str]:
    """Version -> release notes (text below its heading)."""
    text = CHANGELOG.read_text(encoding="utf-8")
    matches = list(HEADING.finditer(text))
    notes = {}
    for i, match in enumerate(matches):
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        notes[match.group(1)] = text[match.end():end].strip()
    return notes


def main() -> int:
    current = json.loads(MANIFEST.read_text(encoding="utf-8"))["version"]
    notes = sections()
    if current not in notes:
        print(f"::error::manifest.json has version {current}, but CHANGELOG.md has no section ## [{current}]")
        return 1

    listing = run("gh", "release", "list", "--limit", "500", "--json", "tagName").stdout
    released = {release["tagName"] for release in json.loads(listing or "[]")}
    tags = set(run("git", "tag", "--list", "v*").stdout.split())
    key = lambda v: tuple(int(p) for p in v.split("."))

    for version in sorted(notes, key=key):  # oldest first, newest ends up on top
        tag = f"v{version}"
        if tag in released:
            continue
        is_current = version == current
        if tag not in tags and not is_current:
            print(f"Skipping {tag}: no tag")
            continue
        with tempfile.NamedTemporaryFile("w", suffix=".md", delete=False, encoding="utf-8") as fh:
            fh.write(notes[version] + "\n")
        args = ["gh", "release", "create", tag, "--title", tag, "--notes-file", fh.name,
                f"--latest={'true' if is_current else 'false'}"]
        if tag in tags:
            args.append("--verify-tag")
        else:
            args += ["--target", os.environ.get("GITHUB_SHA", "HEAD")]
        result = run(*args, check=False)
        if result.returncode:
            print(f"::error::{tag}: {result.stderr.strip()}")
            return 1
        print(f"Released {tag}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
