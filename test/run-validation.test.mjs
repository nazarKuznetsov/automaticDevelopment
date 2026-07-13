import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const runner = resolve(import.meta.dirname, "..", "kit", "repo", ".codex", "scripts", "run-validation.mjs");

function fixture(command) {
  const root = mkdtempSync(join(tmpdir(), "codex-validation-"));
  mkdirSync(join(root, ".codex"));
  writeFileSync(join(root, ".codex", "agent-workflow.json"), `${JSON.stringify({
    schema_version: 2,
    configured: true,
    validation: { targeted: [command] },
  })}\n`);
  return root;
}

test("validation runner rejects blank and comment-only commands", () => {
  for (const command of ["   ", "# npm test"]) {
    const result = spawnSync(process.execPath, [runner, "--scope", "targeted"], { cwd: fixture(command), encoding: "utf8" });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /No substantive targeted validation commands/);
  }
});

test("validation runner executes a substantive configured command", () => {
  const result = spawnSync(process.execPath, [runner, "--scope", "targeted"], {
    cwd: fixture("node -e \"process.exit(0)\""),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /PASS: targeted validation/);
});
