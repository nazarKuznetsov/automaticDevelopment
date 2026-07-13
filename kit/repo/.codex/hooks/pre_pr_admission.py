#!/usr/bin/env python3
"""Defense-in-depth guard for known pull-request creation tool paths."""

import json
import os
import pathlib
import re
import subprocess
import sys


def deny(reason: str) -> None:
    payload = {
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": reason,
        }
    }
    print(json.dumps(payload))
    raise SystemExit(0)


try:
    event = json.load(sys.stdin)
except (json.JSONDecodeError, OSError):
    deny("Unable to parse hook input; PR creation is blocked safely.")

tool_name = str(event.get("tool_name", ""))
tool_input = event.get("tool_input") or {}
command = str(tool_input.get("command", "")) if isinstance(tool_input, dict) else ""
is_pr_create = bool(re.search(r"(^|[;&|]\s*)gh\s+pr\s+create(?:\s|$)", command))
is_pr_tool = bool(re.search(r"^mcp__.*create_pull_request.*$", tool_name))

if not (is_pr_create or is_pr_tool):
    raise SystemExit(0)

try:
    root = pathlib.Path(
        subprocess.check_output(
            ["git", "rev-parse", "--show-toplevel"], text=True, stderr=subprocess.DEVNULL
        ).strip()
    )
    head = subprocess.check_output(
        ["git", "rev-parse", "HEAD"], cwd=root, text=True, stderr=subprocess.DEVNULL
    ).strip()
    git_dir_value = subprocess.check_output(
        ["git", "rev-parse", "--git-dir"], cwd=root, text=True, stderr=subprocess.DEVNULL
    ).strip()
    git_dir = pathlib.Path(git_dir_value)
    if not git_dir.is_absolute():
        git_dir = root / git_dir
    marker_path = git_dir / "codex-agent" / "pre-pr-admission.json"
    marker = json.loads(marker_path.read_text(encoding="utf-8"))
except (OSError, subprocess.SubprocessError, json.JSONDecodeError):
    deny("No valid Pre-PR Admission Report was found for this checkout.")

if marker.get("status") != "PASS" or marker.get("commit_sha") != head:
    deny("Pre-PR Admission must PASS for the current commit SHA before PR creation.")

consumption_path = git_dir / "codex-agent" / "pre-pr-admission.consume.json"
consumption = {
    "schema_version": 2,
    "commit_sha": head,
    "tool_name": tool_name,
    "tool_use_id": event.get("tool_use_id"),
}
try:
    descriptor = os.open(consumption_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    with os.fdopen(descriptor, "w", encoding="utf-8") as stream:
        json.dump(consumption, stream)
        stream.write("\n")
except FileExistsError:
    deny("The SHA-bound PR creation authorization was already consumed. Query for an existing PR before re-running admission.")
except OSError:
    deny("Unable to reserve the one-shot PR creation authorization; PR creation is blocked safely.")

raise SystemExit(0)
