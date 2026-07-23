import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test, { after } from "node:test";

const repoRoot = resolve(import.meta.dirname, "..");
const sourceRoot = mkdtempSync(join(tmpdir(), "codex-guide-source-"));
cpSync(join(repoRoot, "kit"), join(sourceRoot, "kit"), { recursive: true });
cpSync(join(repoRoot, "scripts"), join(sourceRoot, "scripts"), { recursive: true });
execFileSync("git", ["init", "--quiet", "--initial-branch=main", sourceRoot]);
execFileSync("git", ["-C", sourceRoot, "config", "user.name", "Test"]);
execFileSync("git", ["-C", sourceRoot, "config", "user.email", "test@example.com"]);
execFileSync("git", ["-C", sourceRoot, "remote", "add", "origin", "https://github.com/example/automation-kit.git"]);
execFileSync("git", ["-C", sourceRoot, "add", "."]);
execFileSync("git", ["-C", sourceRoot, "commit", "--quiet", "-m", "source fixture"]);
const installer = join(sourceRoot, "scripts", "install-kit.sh");

after(() => rmSync(sourceRoot, { recursive: true, force: true }));

function repository(remote = "https://github.com/acme/example.git") {
  const directory = mkdtempSync(join(tmpdir(), "codex-guide-installer-"));
  execFileSync("git", ["init", "--quiet", "--initial-branch=main", directory]);
  execFileSync("git", ["-C", directory, "remote", "add", "origin", remote]);
  return directory;
}

function run(args) {
  return spawnSync(installer, args, { cwd: sourceRoot, encoding: "utf8" });
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

test("dry-run reports a plan without writing files", () => {
  const target = repository();
  const result = run(["--target", target, "--dry-run"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Dry run/);
  assert.throws(() => readFileSync(join(target, ".codex", "kit-lock.json"), "utf8"));
});

test("apply installs new lifecycle packets and admission agent as managed files", () => {
  const target = repository();
  const result = run(["--target", target, "--apply"]);
  assert.equal(result.status, 0, result.stderr);
  for (const path of [
    ".codex/agents/admission-reviewer.toml",
    ".codex/schemas/v2/orchestrator-start.schema.json",
    ".codex/schemas/v2/merge-authorization.schema.json",
    ".codex/schemas/v2/wave-completion.schema.json",
  ]) assert.equal(existsSync(join(target, path)), true, path);
  const lock = JSON.parse(readFileSync(join(target, ".codex", "kit-lock.json"), "utf8"));
  assert.equal(lock.schema_version, 3);
  assert.equal(lock.kit.version, "2.1.0");
  assert.equal(lock.kit.source_repository, "example/automation-kit");
  assert.match(lock.kit.source_commit, /^[0-9a-f]{40}$/);
  assert.match(lock.kit.manifest_sha256, /^[0-9a-f]{64}$/);
  assert.match(lock.kit.tree_sha256, /^[0-9a-f]{64}$/);
  assert.equal(lock.target.repository, "acme/example");
  assert.equal(lock.target.origin_url, "https://github.com/acme/example.git");
  assert.equal(lock.target.default_branch, "main");
  assert.equal(lock.files[".codex/agents/admission-reviewer.toml"].ownership, "managed");
});

test("installer prints distinct source and installation target identities", () => {
  const target = repository();
  const result = run(["--target", target, "--dry-run"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Kit source: example\/automation-kit@[0-9a-f]{40}/);
  assert.match(result.stdout, /Installation target: acme\/example \(main\)/);
});

test("upgrade rejects target remote and host configuration identity drift", () => {
  const target = repository();
  assert.equal(run(["--target", target, "--apply"]).status, 0);
  const configPath = join(target, ".codex", "agent-workflow.json");
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  config.github.repository = "acme/other";
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
  const result = run(["--target", target, "--upgrade", "--accept-host", ".codex/agent-workflow.json"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Target identity mismatch/);
});

test("upgrade rejects a different kit source than the one bound in lock v3", () => {
  const target = repository();
  assert.equal(run(["--target", target, "--apply"]).status, 0);
  const lockPath = join(target, ".codex", "kit-lock.json");
  const lock = JSON.parse(readFileSync(lockPath, "utf8"));
  lock.kit.source_repository = "other/automation-kit";
  writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`);

  const result = run(["--target", target, "--upgrade"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Kit source identity mismatch/);
});

test("installer accepts a managed worktree git pointer and records the shared target remote", () => {
  const root = repository("git@github.com:acme/worktree-target.git");
  execFileSync("git", ["-C", root, "config", "user.name", "Test"]);
  execFileSync("git", ["-C", root, "config", "user.email", "test@example.com"]);
  writeFileSync(join(root, "README.md"), "fixture\n");
  execFileSync("git", ["-C", root, "add", "README.md"]);
  execFileSync("git", ["-C", root, "commit", "--quiet", "-m", "fixture"]);
  const worktree = `${root}-worktree`;
  execFileSync("git", ["-C", root, "worktree", "add", "--quiet", "-b", "agent/1-test", worktree]);
  const result = run(["--target", worktree, "--apply"]);
  assert.equal(result.status, 0, result.stderr);
  const lock = JSON.parse(readFileSync(join(worktree, ".codex", "kit-lock.json"), "utf8"));
  assert.equal(lock.target.repository, "acme/worktree-target");
  assert.equal(lock.target.default_branch, "main");
});

test("installer normalizes ssh GitHub origins and does not mistake a feature branch for default", () => {
  const target = repository("ssh://git@github.com/acme/ssh-target.git");
  execFileSync("git", ["-C", target, "config", "user.name", "Test"]);
  execFileSync("git", ["-C", target, "config", "user.email", "test@example.com"]);
  writeFileSync(join(target, "README.md"), "fixture\n");
  execFileSync("git", ["-C", target, "add", "README.md"]);
  execFileSync("git", ["-C", target, "commit", "--quiet", "-m", "fixture"]);
  execFileSync("git", ["-C", target, "switch", "--quiet", "-c", "feature/local"]);

  const result = run(["--target", target, "--apply"]);
  assert.equal(result.status, 0, result.stderr);
  const lock = JSON.parse(readFileSync(join(target, ".codex", "kit-lock.json"), "utf8"));
  assert.equal(lock.target.repository, "acme/ssh-target");
  assert.equal(lock.target.default_branch, "main");
});

test("installer refuses a dirty manifest-listed source file", () => {
  const target = repository();
  const sourcePath = join(sourceRoot, "kit", "repo", ".codex", "scripts", "workflow-contract.mjs");
  const original = readFileSync(sourcePath, "utf8");
  writeFileSync(sourcePath, `${original}\n// dirty fixture\n`);
  try {
    const result = run(["--target", target, "--apply"]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Kit source has uncommitted manifest changes/);
  } finally {
    writeFileSync(sourcePath, original);
  }
});

test("installer refuses nested Git/submodule and local Codex task metadata paths", () => {
  const target = repository();
  const manifestPath = join(sourceRoot, "kit", "manifest.json");
  const original = readFileSync(manifestPath, "utf8");
  const manifest = JSON.parse(original);
  manifest.files.push(
    { path: "nested/.gitmodules", ownership: "managed" },
    { path: ".codex/session.json", ownership: "managed" },
  );
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  try {
    const result = run(["--target", target, "--dry-run"]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /unsafe path/);
  } finally {
    writeFileSync(manifestPath, original);
  }
});

test("upgrade migrates a v2 lock to provenance-bound schema v3", () => {
  const target = repository();
  assert.equal(run(["--target", target, "--apply"]).status, 0);
  const lockPath = join(target, ".codex", "kit-lock.json");
  const current = JSON.parse(readFileSync(lockPath, "utf8"));
  writeFileSync(lockPath, `${JSON.stringify({
    schema_version: 2,
    kit_version: "2.0.2",
    installed_at: current.installed_at,
    files: current.files,
  }, null, 2)}\n`);
  const upgraded = run(["--target", target, "--upgrade"]);
  assert.equal(upgraded.status, 0, upgraded.stderr);
  const migrated = JSON.parse(readFileSync(lockPath, "utf8"));
  assert.equal(migrated.schema_version, 3);
  assert.equal(migrated.kit.version, "2.1.0");
  assert.equal(migrated.target.repository, "acme/example");
});

test("upgrade refuses an unsupported or malformed lock schema", () => {
  const target = repository();
  assert.equal(run(["--target", target, "--apply"]).status, 0);
  const lockPath = join(target, ".codex", "kit-lock.json");
  const lock = JSON.parse(readFileSync(lockPath, "utf8"));
  lock.schema_version = 99;
  writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`);

  const result = run(["--target", target, "--upgrade"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unsupported kit lock schema/);
});

test("installer refuses to install the kit into its own source repository", () => {
  const target = repository("https://github.com/example/automation-kit.git");
  const result = run(["--target", target, "--apply"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /source and installation target must be different/);
});

test("repository values stay host-owned while admission core installs and upgrades without managed overrides", () => {
  const target = repository();
  assert.equal(run(["--target", target, "--apply"]).status, 0);

  const configPath = join(target, ".codex", "agent-workflow.json");
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  config.configured = true;
  config.github.repository = "acme/example";
  config.bootstrap = {
    authority: "one-time-automated-control-plane-bootstrap",
    repository: "acme/example",
    branch: "agent/bootstrap-control-plane",
    base_sha: "a".repeat(40),
    canonical_revision: "canonical-r1",
  };
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);

  const runbookPath = join(target, "docs", "project-workflow-runbook.md");
  writeFileSync(runbookPath, readFileSync(runbookPath, "utf8").replace("<repository>", "acme/example"));

  const upgrade = run([
    "--target", target,
    "--upgrade",
    "--accept-host", ".codex/agent-workflow.json",
    "--accept-host", "docs/project-workflow-runbook.md",
  ]);
  assert.equal(upgrade.status, 0, upgrade.stderr);
  assert.doesNotMatch(`${upgrade.stdout}\n${upgrade.stderr}`, /MERGE REQUIRED/);

  const managedAdmissionPaths = [
    ".codex/hooks/pre_pr_admission.py",
    ".codex/schemas/v2/pre-pr-admission.schema.json",
    ".codex/scripts/pre-pr-gate.mjs",
    ".codex/scripts/workflow-contract.mjs",
    "docs/guide/operations.md",
    "docs/guide/pre-pr-gate.md",
  ];
  for (const path of managedAdmissionPaths) {
    assert.equal(
      readFileSync(join(target, path), "utf8"),
      readFileSync(join(repoRoot, "kit", "repo", path), "utf8"),
      `${path} must remain an unmodified managed core file`,
    );
  }

  const lock = JSON.parse(readFileSync(join(target, ".codex", "kit-lock.json"), "utf8"));
  assert.equal(lock.files[".codex/agent-workflow.json"].ownership, "host");
  assert.equal(lock.files["docs/project-workflow-runbook.md"].ownership, "host");
  assert.equal(lock.files["docs/project-workflow-runbook.md"].content_origin, "host");

  for (const path of managedAdmissionPaths) {
    writeFileSync(join(target, path), `${readFileSync(join(target, path), "utf8")}\nLegacy managed override.\n`);
  }
  const retireOverrides = run([
    "--target", target,
    "--upgrade",
    "--force",
    "--accept-host", ".codex/agent-workflow.json",
    "--accept-host", "docs/project-workflow-runbook.md",
  ]);
  assert.equal(retireOverrides.status, 0, retireOverrides.stderr);
  assert.doesNotMatch(`${retireOverrides.stdout}\n${retireOverrides.stderr}`, /MERGE REQUIRED/);
  for (const path of managedAdmissionPaths) {
    assert.equal(
      readFileSync(join(target, path), "utf8"),
      readFileSync(join(repoRoot, "kit", "repo", path), "utf8"),
      `${path} must be restored to managed core without a three-way merge`,
    );
  }
});

test("apply refuses a pre-existing host-owned AGENTS.md and prints a merge plan", () => {
  const target = repository();
  writeFileSync(join(target, "AGENTS.md"), "# Host rules\n");
  const result = run(["--target", target, "--apply"]);
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /MERGE REQUIRED: AGENTS\.md/);
  assert.equal(readFileSync(join(target, "AGENTS.md"), "utf8"), "# Host rules\n");
});

test("force never overwrites a host-owned conflict", () => {
  const target = repository();
  writeFileSync(join(target, "AGENTS.md"), "# Host rules\n");
  const result = run(["--target", target, "--apply", "--force"]);
  assert.notEqual(result.status, 0);
  assert.equal(readFileSync(join(target, "AGENTS.md"), "utf8"), "# Host rules\n");
});

test("force cannot claim a pre-existing managed file during first install", () => {
  const target = repository();
  const skill = join(target, ".agents", "skills", "github-agent-worker", "SKILL.md");
  mkdirSync(join(target, ".agents", "skills", "github-agent-worker"), { recursive: true });
  writeFileSync(skill, "Host-managed-looking file\n");
  const result = run(["--target", target, "--apply", "--force"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /--force is allowed only for an upgrade/);
  assert.equal(readFileSync(skill, "utf8"), "Host-managed-looking file\n");
});

test("accept-host preserves an explicitly merged host file and records its origin", () => {
  const target = repository();
  writeFileSync(join(target, "AGENTS.md"), "# Host rules merged with workflow v2\n");
  const result = run(["--target", target, "--apply", "--accept-host", "AGENTS.md"]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(readFileSync(join(target, "AGENTS.md"), "utf8"), "# Host rules merged with workflow v2\n");
  const lock = JSON.parse(readFileSync(join(target, ".codex", "kit-lock.json"), "utf8"));
  assert.equal(lock.files["AGENTS.md"].content_origin, "host");
  assert.equal(lock.files["AGENTS.md"].hash, sha256("# Host rules merged with workflow v2\n"));

  const upgrade = run(["--target", target, "--upgrade"]);
  assert.notEqual(upgrade.status, 0);
  assert.match(upgrade.stderr, /MERGE REQUIRED: AGENTS\.md/);
});

test("dry-run with a lock previews upgrade semantics", () => {
  const target = repository();
  assert.equal(run(["--target", target, "--apply"]).status, 0);
  const skillPath = ".agents/skills/github-agent-worker/SKILL.md";
  const skill = join(target, skillPath);
  const old = "previous kit content\n";
  writeFileSync(skill, old);
  const lockPath = join(target, ".codex", "kit-lock.json");
  const lock = JSON.parse(readFileSync(lockPath, "utf8"));
  lock.files[skillPath] = {
    hash: sha256(old),
    source_hash: sha256(old),
    ownership: "managed",
    content_origin: "kit",
  };
  writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`);

  const result = run(["--target", target, "--dry-run"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Mode: dry-run \(upgrade preview\)/);
  assert.match(result.stdout, /UPDATE: \.agents\/skills\/github-agent-worker\/SKILL\.md/);
  assert.equal(readFileSync(skill, "utf8"), old);
});

test("upgrade preserves modified files and reports their exact paths", () => {
  const target = repository();
  assert.equal(run(["--target", target, "--apply"]).status, 0);
  const skill = join(target, ".agents", "skills", "github-agent-worker", "SKILL.md");
  writeFileSync(skill, `${readFileSync(skill, "utf8")}\nLocal policy.\n`);
  const result = run(["--target", target, "--upgrade"]);
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /MERGE REQUIRED: \.agents\/skills\/github-agent-worker\/SKILL\.md/);
  assert.match(readFileSync(skill, "utf8"), /Local policy\./);
});

test("upgrade force overwrites only a managed path already recorded by the kit", () => {
  const target = repository();
  assert.equal(run(["--target", target, "--apply"]).status, 0);
  const skill = join(target, ".agents", "skills", "github-agent-worker", "SKILL.md");
  const kitContent = readFileSync(join(repoRoot, "kit", "repo", ".agents", "skills", "github-agent-worker", "SKILL.md"), "utf8");
  writeFileSync(skill, "Local managed override.\n");

  const forced = run(["--target", target, "--upgrade", "--force"]);
  assert.equal(forced.status, 0, forced.stderr);
  assert.equal(readFileSync(skill, "utf8"), kitContent);
});

test("upgrade force refuses a managed collision missing from the prior lock", () => {
  const target = repository();
  assert.equal(run(["--target", target, "--apply"]).status, 0);
  const skillPath = ".agents/skills/github-agent-worker/SKILL.md";
  const skill = join(target, skillPath);
  const lockPath = join(target, ".codex", "kit-lock.json");
  const lock = JSON.parse(readFileSync(lockPath, "utf8"));
  delete lock.files[skillPath];
  writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
  writeFileSync(skill, "Unclaimed pre-existing file.\n");

  const forced = run(["--target", target, "--upgrade", "--force"]);
  assert.notEqual(forced.status, 0);
  assert.match(forced.stderr, /MERGE REQUIRED: \.agents\/skills\/github-agent-worker\/SKILL\.md/);
  assert.equal(readFileSync(skill, "utf8"), "Unclaimed pre-existing file.\n");
});
