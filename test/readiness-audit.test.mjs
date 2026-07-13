import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { auditIssueBody, parseIssueForm } = require("../kit/repo/.github/scripts/readiness-audit.cjs");

const body = `### Goal

Export a report.

### Acceptance Criteria

- Given visible rows, when Export is selected, then a CSV downloads.
- The CSV contains the visible rows in the displayed order.
- A failed export shows an actionable error and no corrupt download.

### Dependency / Blocker State

None.

### Validation Expectations

npm test

### Primary Signal

CSV contains visible rows.

### Secondary Signals

Unit tests, typecheck, and branch CI.

### Work Type

Task

### Phase

MVP

### Size

S

### Risk

Medium

### QA Required

Yes

### Security Impact

None.

### UI / Design Impact

Export control states and accessible error copy.

### TDD / Exemption

TDD required.

### Repository Tracing

Export UI, API serializer, CSV service, and their tests.

### Human Gates

Human merge approval only.`;

test("Issue Form parser returns actual values instead of heading presence", () => {
  const fields = parseIssueForm(body);
  assert.equal(fields.goal, "Export a report.");
  assert.match(fields.acceptance, /Given visible rows/);
  assert.equal(fields.size, "S");
});

test("readiness audit passes a complete leaf-compatible body", () => {
  assert.deepEqual(auditIssueBody({ body, labels: ["agent-ready"] }), { ready: true, reasons: [] });
});

test("readiness audit rejects empty values, parent work types, large work, and blocked labels", () => {
  const result = auditIssueBody({
    body: body
      .replace("Export a report.", "  ")
      .replace("Task", "Epic")
      .replace("\nS\n", "\nXL\n"),
    labels: ["agent-ready", "blocked"],
  });
  assert.equal(result.ready, false);
  assert.ok(result.reasons.includes("Missing or placeholder value: Goal."));
  assert.ok(result.reasons.includes("Epic and Capability issues cannot be agent-ready."));
  assert.ok(result.reasons.includes("L and XL issues must be decomposed before agent-ready."));
  assert.ok(result.reasons.includes("Issue has the blocked label."));
});

test("readiness audit rejects placeholders, malformed acceptance, and unverifiable leaf state", () => {
  const result = auditIssueBody({
    body: body
      .replace("Export a report.", "TBD")
      .replace(/- Given visible rows[\s\S]*?- A failed export shows an actionable error and no corrupt download\./, "One prose criterion."),
    labels: ["agent-ready"],
    leafStateKnown: false,
  });
  assert.equal(result.ready, false);
  assert.ok(result.reasons.includes("Missing or placeholder value: Goal."));
  assert.ok(result.reasons.includes("Acceptance Criteria must contain three to five list items."));
  assert.ok(result.reasons.includes("Native sub-issue state could not be verified; readiness fails closed."));
});
