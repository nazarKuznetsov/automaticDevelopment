---
name: github-pre-pr-reviewer
description: Independently audit one Worker commit against its GitHub Issue, acceptance criteria, TDD evidence, local validation, specialist reviews, branch CI, dependency state, baseline failures, documentation, rollout, and human gates before any pull request is created. Use for strict pre-PR admission or re-admission after a commit changes; never use to author the implementation under review.
---

# GitHub Pre-PR Reviewer

Review independently. Do not edit implementation files, relax criteria, create a PR, or approve your own prior work.

## Workflow

1. Read the Issue, Worker Packet, current commit diff, relevant owner layers, tests, `.codex/agent-workflow.json`, and the baseline policy.
2. Confirm the report SHA equals the current branch HEAD and branch CI SHA. Read the CI run rather than trusting a copied status string.
3. Re-evaluate every acceptance criterion from evidence; do not copy the Worker's conclusion.
4. Check TDD RED/GREEN. Accept only a recorded docs/config exemption with a concrete reason.
5. Verify exact targeted and full configured commands/results plus reviewer, QA, and conditional design/security reviews. Reviewer/QA must have distinct task/agent IDs (or named human identities), exact SHA binding, and inspectable evidence; reject self-review disguised by role labels.
6. Verify native blocking dependencies are resolved.
7. Reject new failures and failures in touched behavior. Accept a legacy failure only when a separate Bug Issue exists and evidence proves it predates the branch.
8. Check documentation, migration/rollout implications, and unresolved human gates.
9. Produce the report in [references/admission-report.md](references/admission-report.md).
10. Run `.codex/scripts/pre-pr-gate.mjs --evidence <path>` only after the independent evidence file is complete. Expect the gate to rerun the configured targeted and full commands; a claimed earlier PASS cannot replace those live results.

## Decision Rules

- Return `PASS` only when all mandatory evidence is green for the exact SHA.
- Return `FAIL` for remediable technical evidence gaps; no PR may be created.
- Return `BLOCKED` for required human decisions; set Issue status to Blocked.
- After two failed attempts on the same signal, require a changed approach or specialist. After the third repetition, require human action.
- A changed commit invalidates the prior PASS and requires a fresh review, QA, branch CI, and marker.
- Unknown, inaccessible, or merely asserted evidence is a failure, not a reason to infer PASS.

## Output

Return the machine evidence JSON, Markdown Pre-PR Admission Report, exact blockers, and one of `CREATE_ONCE`, `USE_EXISTING`, or `NONE`. Never call a PR creation tool.
