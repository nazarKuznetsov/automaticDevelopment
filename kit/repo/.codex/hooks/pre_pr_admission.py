#!/usr/bin/env python3
"""Defense-in-depth guard for known pull-request creation tool paths."""

from __future__ import annotations

import json
import os
import pathlib
import re
import shlex
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


def normalize_github_repository(remote_url: str) -> str:
    value = remote_url.strip()
    match = re.fullmatch(r"https://github\.com/([^/]+/[^/]+?)(?:\.git)?", value)
    if match:
        return match.group(1)
    match = re.fullmatch(r"git@github\.com:([^/]+/[^/]+?)(?:\.git)?", value)
    return match.group(1) if match else ""


def option(tokens: list[str], name: str) -> str:
    matches: list[str] = []
    for index, token in enumerate(tokens):
        if token == name and index + 1 < len(tokens):
            matches.append(tokens[index + 1])
        elif token.startswith(f"{name}="):
            matches.append(token.split("=", 1)[1])
    return matches[0] if len(matches) == 1 else ""


def shell_tokens(command: str) -> list[str] | None:
    try:
        lexer = shlex.shlex(command, posix=True, punctuation_chars=";&|<>()")
        lexer.commenters = ""
        return list(lexer)
    except ValueError:
        return None


def pr_create_count(tokens: list[str] | None) -> int:
    if tokens is None:
        return 0
    return sum(tokens[index : index + 3] == ["gh", "pr", "create"] for index in range(len(tokens) - 2))


def requested_target(tool_name: str, tool_input: dict, command: str) -> dict:
    if re.search(r"^mcp__.*create_pull_request.*$", tool_name):
        return {
            "repository": str(tool_input.get("repository_full_name") or ""),
            "head": str(tool_input.get("head") or tool_input.get("head_branch") or ""),
            "head_repo": str(tool_input.get("head_repo") or ""),
            "base": str(tool_input.get("base") or tool_input.get("base_branch") or ""),
            "draft": tool_input.get("draft") is True,
        }
    tokens = shell_tokens(command)
    if (
        tokens is None
        or "\n" in command
        or "\r" in command
        or tokens[:3] != ["gh", "pr", "create"]
        or pr_create_count(tokens) != 1
        or any(
            re.fullmatch(r"[;&|<>()]+", token) or "$" in token or "`" in token
            for token in tokens
        )
    ):
        return {}
    return {
        "repository": option(tokens, "--repo"),
        "head": option(tokens, "--head"),
        "head_repo": "",
        "base": option(tokens, "--base"),
        "draft": "--draft" in tokens,
    }


try:
    event = json.load(sys.stdin)
except (json.JSONDecodeError, OSError):
    deny("Unable to parse hook input; PR creation is blocked safely.")

tool_name = str(event.get("tool_name", ""))
tool_input = event.get("tool_input") or {}
command = ""
if isinstance(tool_input, dict):
    command = str(tool_input.get("command") or tool_input.get("cmd") or "")
parsed_command = shell_tokens(command)
is_pr_create = (
    pr_create_count(parsed_command) > 0
    or bool(re.search(r"\bpr\s+create(?:\s|$)", command))
    or any(
        re.search(r"\bpr\s+create(?:\s|$)", token)
        for token in (parsed_command or [])
    )
)
is_pr_tool = bool(re.search(r"^mcp__.*create_pull_request.*$", tool_name))
admission_pending = False
if command:
    try:
        probe_root = pathlib.Path(
            subprocess.check_output(
                ["git", "rev-parse", "--show-toplevel"],
                text=True,
                stderr=subprocess.DEVNULL,
            ).strip()
        )
        probe_git_dir_value = subprocess.check_output(
            ["git", "rev-parse", "--git-dir"],
            cwd=probe_root,
            text=True,
            stderr=subprocess.DEVNULL,
        ).strip()
        probe_git_dir = pathlib.Path(probe_git_dir_value)
        if not probe_git_dir.is_absolute():
            probe_git_dir = probe_root / probe_git_dir
        probe_marker = probe_git_dir / "codex-agent" / "pre-pr-admission.json"
        probe_consumption = probe_git_dir / "codex-agent" / "pre-pr-admission.consume.json"
        admission_pending = probe_marker.exists() and not probe_consumption.exists()
    except (OSError, subprocess.SubprocessError):
        admission_pending = False

if not (is_pr_create or is_pr_tool or admission_pending):
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
    current_branch = subprocess.check_output(
        ["git", "branch", "--show-current"], cwd=root, text=True, stderr=subprocess.DEVNULL
    ).strip()
    git_dir_value = subprocess.check_output(
        ["git", "rev-parse", "--git-dir"], cwd=root, text=True, stderr=subprocess.DEVNULL
    ).strip()
    git_dir = pathlib.Path(git_dir_value)
    if not git_dir.is_absolute():
        git_dir = root / git_dir
    marker_path = git_dir / "codex-agent" / "pre-pr-admission.json"
    marker = json.loads(marker_path.read_text(encoding="utf-8"))
    origin_url = subprocess.check_output(
        ["git", "config", "--get", "remote.origin.url"],
        cwd=root,
        text=True,
        stderr=subprocess.DEVNULL,
    ).strip()
    repository = normalize_github_repository(origin_url)
    remote_head = subprocess.check_output(
        ["git", "ls-remote", "--symref", "origin", "HEAD"],
        cwd=root,
        text=True,
        stderr=subprocess.DEVNULL,
    )
    default_branch = re.search(r"^ref:\s+refs/heads/([^\s]+)\s+HEAD$", remote_head, re.MULTILINE).group(1)
    remote_line = subprocess.check_output(
        ["git", "ls-remote", "--exit-code", "origin", f"refs/heads/{default_branch}"],
        cwd=root,
        text=True,
        stderr=subprocess.DEVNULL,
    ).strip()
    current_base = remote_line.split()[0]
except (
    OSError,
    subprocess.SubprocessError,
    json.JSONDecodeError,
    KeyError,
    IndexError,
    AttributeError,
):
    deny("No valid Pre-PR Admission Report was found for this checkout.")

if (
    marker.get("status") != "PASS"
    or marker.get("commit_sha") != head
    or not re.fullmatch(r"[0-9a-f]{64}", str(marker.get("report_digest", "")))
    or marker.get("repository") != repository
    or marker.get("head_branch") != current_branch
    or marker.get("base_branch") != default_branch
    or marker.get("draft") is not True
):
    deny("Pre-PR Admission must PASS for the current commit SHA before PR creation.")
if not re.fullmatch(r"[0-9a-f]{40}", current_base) or marker.get("base_sha") != current_base:
    deny("The authoritative default-branch SHA changed after admission; synchronize and rerun the full gate.")

target = requested_target(tool_name, tool_input, command)
if (
    target.get("repository") != marker.get("repository")
    or target.get("head") != marker.get("head_branch")
    or target.get("base") != marker.get("base_branch")
    or target.get("draft") is not True
    or target.get("head_repo") not in {"", marker.get("repository")}
):
    deny("PR creation target must exactly match the admitted repository, head branch, base branch, and draft state.")

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
