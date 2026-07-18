import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const repoRoot = resolve(import.meta.dirname, "..");
const installer = join(repoRoot, "scripts", "install-kit.sh");

function repository() {
  const directory = mkdtempSync(join(tmpdir(), "codex-guide-installer-"));
  execFileSync("git", ["init", "--quiet", directory]);
  return directory;
}

function run(args) {
  return spawnSync(installer, args, { cwd: repoRoot, encoding: "utf8" });
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
  assert.equal(lock.kit_version, "2.0.1");
  assert.equal(lock.files[".codex/agents/admission-reviewer.toml"].ownership, "managed");
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
