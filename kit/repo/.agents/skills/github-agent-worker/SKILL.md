---
name: github-agent-worker
description: Use when Codex must deliver exactly one ready GitHub Issue from a GitHub-native Orchestrator Worker Packet through one isolated worktree or branch, one pull request, validation evidence, and a Worker Completion Report.
---

# GitHub Agent Worker

## Overview

Deliver exactly one GitHub Issue. Do not expand scope, create extra PRs, or change unrelated files.

Before acting, read `AGENTS.md`, `docs/github-agent-workflow.md`, the assigned issue, comments, labels, Project fields, linked PRs, and the Worker Packet.

## Required Invariants

- One issue.
- One branch.
- One pull request.
- `Closes #<issue-number>` in the PR.
- Validation evidence in the PR and issue.
- No merge, deploy, secrets, billing, destructive ops, production data, migrations, auth/permissions/public API changes, or production dependency changes without explicit human approval.

## Start Gate

Do not edit files until all are true:

- Project `Status = Ready`;
- label `agent-ready`;
- no `blocked` label;
- no unresolved blocker;
- Worker Packet issue number matches the GitHub Issue;
- no open linked PR already owns this issue;
- validation expectations are clear.

If the gate fails, stop and write `Human action required` or return the exact missing readiness item.

## Delivery Loop

1. Confirm repository state and active instructions.
2. Create or use an isolated Codex worktree when available.
3. Create an issue-linked branch such as `feat/123-short-slug`, `fix/123-short-slug`, `docs/123-short-slug`, or `chore/123-short-slug`.
4. Trace the owner layer before changes: caller, route, component, service, schema, tests, and docs as relevant.
5. For behavior changes, use TDD RED/GREEN. For docs/config-only work, record the exemption before editing.
6. Implement the smallest coherent change that satisfies the issue.
7. Run the issue's primary validation command and nearest cheap secondary checks.
8. Fill the pull request template with evidence.
9. Open one PR with `Closes #<issue-number>`.
10. Post Worker Completion Report to the issue.

## Scope Discipline

Stop and ask Orchestrator for decomposition when the issue:

- contains multiple independent PR-sized changes;
- requires a blocked human gate;
- needs missing product decisions;
- needs permissions or credentials not available;
- cannot be validated with repository tooling;
- conflicts with active work or an existing PR.

## Worker Completion Report

Use this format:

```md
## Worker Completion Report

Issue: #<number>
PR: <url>
Branch: <branch>

Acceptance:
- <criterion>: met/not met + evidence

TDD RED/GREEN:
- RED:
- GREEN:
- Refactor:
- Exemption:

Repository tracing:
- Owner layer:
- Files inspected:
- Contract/API impact:

Validation:
- Primary signal status:
- Secondary signal status:
- Commands:

Security / design:
- Security impact:
- UI/design impact:

QA:
- Evidence:
- Findings resolved:
- Remaining risk:

Human Gates:
- Required before merge/deploy/release:
```

## PR Evidence

The PR must include:

- linked issue;
- what changed;
- acceptance evidence;
- validation commands and results;
- TDD RED/GREEN or exemption;
- repository tracing;
- security/design notes;
- QA evidence or no-QA rationale;
- risks and rollout notes;
- human gates that still apply.

## Human Action Required

Use this exact shape when blocked:

```md
## Human action required

Blocked action:
Reason:
Issue:
Required human decision:
Exact command or URL:
Exact labels / Project fields / issue body:
Safe to continue after:
```
