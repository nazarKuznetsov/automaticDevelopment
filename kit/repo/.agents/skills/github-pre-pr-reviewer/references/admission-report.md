# Pre-PR Admission Report v2

Bind every report to one commit SHA.

```md
## Pre-PR Admission Report

Schema: 2
Issue: #<number>
Commit SHA: <full-sha>
Status: PASS | FAIL | BLOCKED

Acceptance: PASS | FAIL — <evidence>
TDD: PASS | EXEMPT | FAIL — <RED/GREEN or allowed reason>
Targeted validation: PASS | FAIL — <exact commands, exit codes, observed result, SHA>
Full validation: PASS | FAIL — <exact commands, exit codes, observed result, SHA>
Independent reviewer: PASS | FAIL — <distinct task/human source ID, SHA, evidence>
QA: PASS | FAIL — <distinct task/human source ID, SHA, evidence>
Design review: PASS | NOT_REQUIRED | FAIL
Security review: PASS | NOT_REQUIRED | FAIL
Branch CI: PASS | FAIL — <run URL and matching SHA>
Dependencies: CLEAR | BLOCKED
Baseline: PASS | FAIL — <legacy Bug links>
Documentation: PASS | NOT_REQUIRED | FAIL
Migration / rollout: PASS | NOT_REQUIRED | FAIL
Human gates: CLEAR | BLOCKED

PR action: CREATE_ONCE | USE_EXISTING | NONE
Blockers: []
```

The machine evidence uses the strict object fields in `.codex/schemas/v2/pre-pr-admission.schema.json`: a Worker source, traceable `{source, observed}` evidence records, command/exit-code records, exact configured validation, distinct reviewer/QA sources, conditional-review reasons, CI workflow/run URL, and explicit documentation/rollout/human-gate reasons. A bare `"PASS"` string is invalid.

Store the local PASS marker under the actual Git directory at `codex-agent/pre-pr-admission.json`; do not commit it. The hook consumes one PR-creation attempt in `pre-pr-admission.consume.json`. If the attempt fails, query GitHub for an existing PR and rerun admission before another attempt.
