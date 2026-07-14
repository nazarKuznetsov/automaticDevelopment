import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { auditIssueBody, parseIssueForm } = require("../kit/repo/.github/scripts/readiness-audit.cjs");

const body = `### Plan Item ID

mvp.core-journey.export-report

### Goal

Export a report.

### Merge Outcome

One PR adds independently acceptable CSV export.

### Acceptance Criteria

- Given visible rows, when Export is selected, then a CSV downloads.
- The CSV contains the visible rows in the displayed order.
- A failed export shows an actionable error and no corrupt download.

### Dependency / Blocker State

None.

### Validation Expectations

npm test

### Integration Validation

npm test -- export-integration

### Integration Order

1

### Primary Signal

CSV contains visible rows.

### Secondary Signals

Unit tests, typecheck, and branch CI.

### Work Type

Task

### Phase

MVP

### Priority

P1

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

### Owner Layer

Report export service.

### Conflict Keys

request-contract, report-export

### Expected Touch Points

Export route, CSV serializer, contract tests, and user documentation.

### Conditional Reviewers

reviewer, qa, admission-reviewer, design-reviewer

### Out of Scope

PDF and spreadsheet export.

### Human Gates

Human merge approval only.`;

test("Issue Form parser returns actual values instead of heading presence", () => {
  const fields = parseIssueForm(body);
  assert.equal(fields.goal, "Export a report.");
  assert.match(fields.acceptance, /Given visible rows/);
  assert.equal(fields.size, "S");
  assert.equal(fields.priority, "P1");
  assert.equal(fields.plan_item_id, "mvp.core-journey.export-report");
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

test("readiness audit validates Priority and the new execution-surface fields", () => {
  const result = auditIssueBody({
    body: body
      .replace("\nP1\n", "\nUrgent\n")
      .replace("request-contract, report-export", "TBD"),
    labels: ["agent-ready"],
  });
  assert.equal(result.ready, false);
  assert.ok(result.reasons.includes("Invalid priority value: Urgent."));
  assert.ok(result.reasons.includes("Missing or placeholder value: Conflict Keys."));
});

test("readiness audit rejects unstable plan IDs, invalid order, and malformed conflict keys", () => {
  const result = auditIssueBody({
    body: body
      .replace("mvp.core-journey.export-report", "Issue 123")
      .replace("\n1\n", "\nzero\n")
      .replace("request-contract, report-export", "Request Contract, src/app.ts"),
    labels: ["agent-ready"],
  });
  assert.equal(result.ready, false);
  assert.ok(result.reasons.includes("Plan Item ID must be a stable lowercase semantic ID."));
  assert.ok(result.reasons.includes("Integration Order must be a positive integer."));
  assert.ok(result.reasons.includes("Conflict Keys must be comma-separated lowercase kebab-case values."));
});
