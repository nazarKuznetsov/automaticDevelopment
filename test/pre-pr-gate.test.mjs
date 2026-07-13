import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import test from "node:test";

const sourceRoot = resolve(import.meta.dirname, "..", "kit", "repo", ".codex");

function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function copy(source, target) {
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
}

function evidence(sha, branchCi = "PASS") {
  const trace = (source, observed) => ({ source, observed });
  const review = (id) => ({
    status: "PASS",
    commit_sha: sha,
    source: { kind: "agent_task", id },
    evidence: [trace(`task:${id}`, "Exact SHA reviewed with no blocking finding.")],
  });
  return {
    schema_version: 2,
    packet_type: "pre_pr_admission",
    commit_sha: sha,
    worker: { source: { kind: "agent_task", id: "worker-task-1" } },
    issue: { number: 1, is_leaf: true, unresolved_dependencies: [] },
    acceptance: { passed: true, evidence: [trace("fixture:acceptance", "Fixture behavior was observed.")] },
    tdd: {
      status: "PASS",
      red: { command: "node --test", exit_code: 1, observed: "Fixture test failed before implementation." },
      green: { command: "node --test", exit_code: 0, observed: "Fixture test passed after implementation." },
    },
    local_validation: {
      targeted: { status: "PASS", commit_sha: sha, commands: [{ command: "node -e \"process.exit(0)\"", exit_code: 0, observed: "Targeted fixture passed." }] },
      full: { status: "PASS", commit_sha: sha, commands: [{ command: "node -e \"process.exit(0)\"", exit_code: 0, observed: "Full fixture passed." }] },
    },
    reviews: {
      reviewer: review("reviewer-task-1"),
      qa: review("qa-task-1"),
      design: { status: "NOT_REQUIRED", reason: "No UI surface." },
      security: { status: "NOT_REQUIRED", reason: "No security surface." },
    },
    branch_ci: { status: branchCi, commit_sha: sha, workflow: "agent-branch-validation.yml", run_url: "https://github.com/example/repo/actions/runs/123" },
    baseline: { new_failures: [], affected_failures: [], legacy_failures: [] },
    documentation: { status: "NOT_REQUIRED", reason: "Fixture behavior only." },
    rollout: { status: "NOT_REQUIRED", reason: "No rollout impact." },
    human_gates: { status: "CLEAR", reason: "No unresolved gate; human merge remains." },
  };
}

test("gate fails closed, writes one SHA marker in a managed worktree, and hook rejects stale HEAD", () => {
  const root = mkdtempSync(join(tmpdir(), "codex-admission-root-"));
  const worktree = join(tmpdir(), `codex-admission-worktree-${process.pid}-${Date.now()}`);
  git(root, "init", "--quiet");
  git(root, "config", "user.name", "Codex Test");
  git(root, "config", "user.email", "codex@example.invalid");

  for (const file of ["workflow-contract.mjs", "pre-pr-gate.mjs", "run-validation.mjs"]) {
    copy(join(sourceRoot, "scripts", file), join(root, ".codex", "scripts", file));
  }
  copy(join(sourceRoot, "hooks", "pre_pr_admission.py"), join(root, ".codex", "hooks", "pre_pr_admission.py"));
  writeFileSync(join(root, ".codex", "agent-workflow.json"), `${JSON.stringify({
    schema_version: 2,
    configured: true,
    validation: {
      targeted: ["node -e \"process.exit(0)\""],
      full: ["node -e \"process.exit(0)\""],
      branch_ci_workflow: "agent-branch-validation.yml",
    },
  }, null, 2)}\n`);
  writeFileSync(join(root, "README.md"), "gate fixture\n");
  git(root, "add", ".");
  git(root, "commit", "--quiet", "-m", "fixture");
  git(root, "worktree", "add", "--quiet", "-b", "agent/1-gate", worktree);

  const sha = git(worktree, "rev-parse", "HEAD");
  const evidencePath = join(worktree, "evidence.json");
  const gatePath = join(worktree, ".codex", "scripts", "pre-pr-gate.mjs");
  writeFileSync(evidencePath, `${JSON.stringify(evidence(sha, "FAIL"))}\n`);
  const failed = spawnSync(process.execPath, [gatePath, "--evidence", evidencePath], { cwd: worktree, encoding: "utf8" });
  assert.equal(failed.status, 1);

  const gitDirValue = git(worktree, "rev-parse", "--git-dir");
  const gitDir = isAbsolute(gitDirValue) ? gitDirValue : resolve(worktree, gitDirValue);
  const markerPath = join(gitDir, "codex-agent", "pre-pr-admission.json");
  assert.equal(existsSync(markerPath), false);

  writeFileSync(evidencePath, `${JSON.stringify(evidence(sha))}\n`);
  const passed = spawnSync(process.execPath, [gatePath, "--evidence", evidencePath], { cwd: worktree, encoding: "utf8" });
  assert.equal(passed.status, 0, passed.stderr);
  assert.deepEqual(JSON.parse(readFileSync(markerPath, "utf8")).commit_sha, sha);

  const allowed = spawnSync("/usr/bin/python3", [join(worktree, ".codex", "hooks", "pre_pr_admission.py")], {
    cwd: worktree,
    input: JSON.stringify({ tool_name: "Bash", tool_input: { command: "gh pr create --title test" } }),
    encoding: "utf8",
  });
  assert.equal(allowed.status, 0);
  assert.equal(allowed.stdout, "");

  const replay = spawnSync("/usr/bin/python3", [join(worktree, ".codex", "hooks", "pre_pr_admission.py")], {
    cwd: worktree,
    input: JSON.stringify({ tool_name: "Bash", tool_input: { command: "gh pr create --title duplicate" } }),
    encoding: "utf8",
  });
  assert.equal(replay.status, 0);
  assert.match(replay.stdout, /already consumed/);

  writeFileSync(evidencePath, `${JSON.stringify(evidence(sha, "FAIL"))}\n`);
  const laterFailure = spawnSync(process.execPath, [gatePath, "--evidence", evidencePath], { cwd: worktree, encoding: "utf8" });
  assert.equal(laterFailure.status, 1);
  assert.equal(existsSync(markerPath), false);
  const invalidated = spawnSync("/usr/bin/python3", [join(worktree, ".codex", "hooks", "pre_pr_admission.py")], {
    cwd: worktree,
    input: JSON.stringify({ tool_name: "Bash", tool_input: { command: "gh pr create --title stale-pass" } }),
    encoding: "utf8",
  });
  assert.match(invalidated.stdout, /No valid Pre-PR Admission Report/);

  const configPath = join(worktree, ".codex", "agent-workflow.json");
  const validConfig = readFileSync(configPath, "utf8");
  const failingConfig = JSON.parse(validConfig);
  failingConfig.validation.targeted = ["node -e \"process.exit(1)\""];
  writeFileSync(configPath, `${JSON.stringify(failingConfig, null, 2)}\n`);
  writeFileSync(evidencePath, `${JSON.stringify(evidence(sha))}\n`);
  const realValidationFailure = spawnSync(process.execPath, [gatePath, "--evidence", evidencePath], { cwd: worktree, encoding: "utf8" });
  assert.equal(realValidationFailure.status, 1);
  assert.match(`${realValidationFailure.stdout}\n${realValidationFailure.stderr}`, /targeted validation failed during the gate/);
  assert.equal(existsSync(markerPath), false);
  writeFileSync(configPath, validConfig);

  const existingPrEvidence = evidence(sha);
  existingPrEvidence.existing_pr_for_sha = {
    number: 7,
    url: "https://github.com/example/repo/pull/7",
    commit_sha: sha,
  };
  writeFileSync(evidencePath, `${JSON.stringify(existingPrEvidence)}\n`);
  const existingPr = spawnSync(process.execPath, [gatePath, "--evidence", evidencePath], { cwd: worktree, encoding: "utf8" });
  assert.equal(existingPr.status, 0, existingPr.stderr);
  assert.match(existingPr.stdout, /PR action: USE_EXISTING/);
  assert.equal(existsSync(markerPath), false);

  writeFileSync(evidencePath, `${JSON.stringify(evidence(sha))}\n`);
  const repassed = spawnSync(process.execPath, [gatePath, "--evidence", evidencePath], { cwd: worktree, encoding: "utf8" });
  assert.equal(repassed.status, 0, repassed.stderr);

  writeFileSync(join(worktree, "README.md"), "changed HEAD\n");
  git(worktree, "add", "README.md");
  git(worktree, "commit", "--quiet", "-m", "change head");
  const blocked = spawnSync("/usr/bin/python3", [join(worktree, ".codex", "hooks", "pre_pr_admission.py")], {
    cwd: worktree,
    input: JSON.stringify({ tool_name: "mcp__github__create_pull_request", tool_input: {} }),
    encoding: "utf8",
  });
  assert.equal(blocked.status, 0);
  assert.match(blocked.stdout, /permissionDecision.*deny/);
});
