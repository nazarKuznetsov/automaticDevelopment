import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const hook = resolve(import.meta.dirname, "..", "kit", "repo", ".codex", "hooks", "pre_pr_admission.py");
const head = "a".repeat(40);
const base = "b".repeat(40);

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "codex-pre-pr-hook-"));
  const root = join(directory, "root");
  const gitDir = join(directory, "git-dir");
  const bin = join(directory, "bin");
  mkdirSync(join(gitDir, "codex-agent"), { recursive: true });
  mkdirSync(root, { recursive: true });
  mkdirSync(bin, { recursive: true });
  writeFileSync(join(gitDir, "codex-agent", "pre-pr-admission.json"), JSON.stringify({
    status: "PASS",
    commit_sha: head,
    base_sha: base,
    report_digest: "c".repeat(64),
    repository: "acme/example",
    head_branch: "agent/17-contract",
    base_branch: "main",
    draft: true,
    subject: "issue:17",
  }));
  const fakeGit = join(bin, "git");
  writeFileSync(fakeGit, `#!/bin/sh
if [ "$1" = "rev-parse" ] && [ "$2" = "--show-toplevel" ]; then printf '%s\n' '${root}'; exit 0; fi
if [ "$1" = "rev-parse" ] && [ "$2" = "HEAD" ]; then printf '%s\n' '${head}'; exit 0; fi
if [ "$1" = "rev-parse" ] && [ "$2" = "--git-dir" ]; then printf '%s\n' '${gitDir}'; exit 0; fi
if [ "$1" = "branch" ] && [ "$2" = "--show-current" ]; then printf '%s\n' 'agent/17-contract'; exit 0; fi
if [ "$1" = "config" ] && [ "$2" = "--get" ]; then printf '%s\n' 'https://github.com/acme/example.git'; exit 0; fi
if [ "$1" = "ls-remote" ] && [ "$2" = "--symref" ]; then printf 'ref: refs/heads/main\tHEAD\n%s\tHEAD\n' '${base}'; exit 0; fi
if [ "$1" = "ls-remote" ] && [ "$2" = "--exit-code" ]; then printf '%s\trefs/heads/main\n' '${base}'; exit 0; fi
exit 1
`);
  chmodSync(fakeGit, 0o755);
  return { directory, bin };
}

function runHook(toolName, toolInput, state = fixture()) {
  const result = spawnSync("/usr/bin/python3", [hook], {
    input: JSON.stringify({ tool_name: toolName, tool_input: toolInput, tool_use_id: "tool-use" }),
    encoding: "utf8",
    env: { ...process.env, PATH: `${state.bin}:${process.env.PATH}` },
  });
  return { result, state };
}

function assertDenied(result) {
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /"permissionDecision": "deny"/);
}

test("hook binds connector PR creation to the admitted exact target and consumes it once", () => {
  const target = {
    repository_full_name: "acme/example",
    head_branch: "agent/17-contract",
    base_branch: "main",
    draft: true,
  };
  const first = runHook("mcp__codex_apps__github_create_pull_request", target);
  try {
    assert.equal(first.result.status, 0, first.result.stderr);
    assert.equal(first.result.stdout, "");
    assertDenied(runHook("mcp__codex_apps__github_create_pull_request", target, first.state).result);
  } finally {
    rmSync(first.state.directory, { recursive: true, force: true });
  }

  for (const invalid of [
    { ...target, repository_full_name: "other/repository" },
    { ...target, head_branch: "agent/other" },
    { ...target, base_branch: "develop" },
    { ...target, draft: false },
    { ...target, head_repo: "other/repository" },
  ]) {
    const attempt = runHook("mcp__codex_apps__github_create_pull_request", invalid);
    try {
      assertDenied(attempt.result);
    } finally {
      rmSync(attempt.state.directory, { recursive: true, force: true });
    }
  }
});

test("hook accepts one explicit gh target through cmd and rejects hidden or incomplete commands", () => {
  const valid = runHook("exec_command", {
    cmd: "gh pr create --repo acme/example --head agent/17-contract --base main --draft",
  });
  try {
    assert.equal(valid.result.status, 0, valid.result.stderr);
    assert.equal(valid.result.stdout, "");
  } finally {
    rmSync(valid.state.directory, { recursive: true, force: true });
  }

  for (const command of [
    "gh pr create --draft",
    "true\ngh pr create --repo other/repository --head bad --base main --draft",
    "gh pr create --repo acme/example --head agent/17-contract --base main --draft; gh pr create --draft",
    "gh pr create --repo acme/example --head agent/17-contract --base main --draft $(gh pr create --draft)",
    "sh -c 'gh pr create --repo other/repository --head bad --base main --draft'",
    "gh pr create --repo acme/example --head agent/17-contract --base main --draft --title \"$TITLE\"",
    "git status",
  ]) {
    const attempt = runHook("exec_command", { command });
    try {
      assertDenied(attempt.result);
    } finally {
      rmSync(attempt.state.directory, { recursive: true, force: true });
    }
  }
});
