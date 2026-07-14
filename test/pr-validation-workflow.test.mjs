import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const workflowPath = resolve(import.meta.dirname, "..", ".github", "workflows", "pr-validation.yml");

test("root PR validation remains fail-closed with stable quality and visual checks", () => {
  const workflow = readFileSync(workflowPath, "utf8");

  assert.match(workflow, /^name: PR Validation$/m);
  assert.match(workflow, /^on:\n  pull_request:\n    branches:\n      - main$/m);
  assert.match(workflow, /^  workflow_dispatch:$/m);
  assert.match(workflow, /^permissions:\n  contents: read$/m);
  assert.doesNotMatch(workflow, /\b(?:write-all|write)\b/);
  assert.doesNotMatch(workflow, /\$\{\{\s*secrets\./);

  assert.match(workflow, /^  quality:\n    name: quality$/m);
  assert.match(workflow, /^  visual:\n    name: visual\n    needs: quality$/m);
  assert.match(workflow, /cancel-in-progress: true/);
  assert.match(workflow, /github\.event\.pull_request\.number/);
  assert.match(workflow, /node-version: 22/);
  assert.match(workflow, /run: npm ci/);

  for (const command of ["npm test", "npm run check", "npm run build", "npm run test:visual"]) {
    assert.ok(workflow.includes(command), `missing required command: ${command}`);
  }

  assert.match(workflow, /npx playwright install --with-deps chromium/);
  assert.match(workflow, /curl --fail/);
  assert.match(workflow, /kill -0/);
  assert.match(workflow, /trap cleanup EXIT/);
  assert.match(workflow, /PREVIEW_URL=.*npm run test:visual/);
  assert.match(workflow, /test -s test-results\/desktop\.png/);
  assert.match(workflow, /test -s test-results\/mobile\.png/);
  assert.match(workflow, /if: failure\(\)/);
  assert.match(workflow, /uses: actions\/upload-artifact@v4/);
  assert.match(workflow, /if-no-files-found: error/);
});
