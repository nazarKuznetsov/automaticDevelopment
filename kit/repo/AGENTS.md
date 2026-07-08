# AGENTS.md

## GitHub-native Agent Workflow

This repository uses a GitHub-native Codex workflow. GitHub Issues, GitHub Project v2, labels, pull requests, Actions, and issue comments are the durable source of truth.

Use these roles:

- Planner: audits the repository, prepares the Project Intake Packet, GitHub Setup Packet, issue drafts, and process improvements.
- Orchestrator: runs the queue, applies setup, claims ready issues, creates Worker packets, tracks state, verifies evidence, and performs handoff.
- Worker: delivers exactly one ready GitHub Issue through one branch and one pull request.

## Autonomy

Default mode is mostly autonomous with conservative human gates.

The Orchestrator may create issues, labels, project state, Worker packets, Worker threads or worktrees, branches, pull requests, comments, and handoff records when tools and permissions allow it.

The Orchestrator must stop and request explicit human approval for:

- merge;
- deploy or release;
- secrets, tokens, credentials, or key rotation;
- billing or paid infrastructure changes;
- destructive commands or data deletion;
- production data access or modification;
- migrations;
- auth, permissions, public API, or security-sensitive behavior;
- adding production dependencies.

## GitHub Project v2 Contract

Required fields:

- `Status`: Intake, Ready, In Progress, Review, Blocked, Done.
- `Work Type`: Guide, Template, Automation, Site, Docs, Feature, Bug, Refactor.
- `Risk`: Low, Medium, High.
- `QA Required`: Yes, No.

Required labels:

- `agent-ready`
- `blocked`
- `qa-required`
- `security-review`
- `design-review`
- `docs`
- `automation`
- `workflow`
- `human-action-required`

Ready filter:

```text
Project Status = Ready
label:agent-ready
no open blockers
```

## Orchestrator Rules

- Never launch work from memory. Re-read the issue, labels, project fields, blockers, comments, linked PRs, and repository state on every heartbeat.
- Max active workers: 2.
- Max worker launches per Orchestrator: 5.
- Write a State Ledger Comment before launching a Worker.
- Do not launch a Worker if the issue is already claimed, blocked, missing readiness fields, or has an open linked PR.
- Move to `DRAINING` after the fifth Worker launch.
- Become `RETIRED` only after a replacement Orchestrator writes `handoff accepted`.

## Worker Rules

- One GitHub Issue maps to one Worker branch and one pull request.
- Use an isolated Codex worktree when available.
- Branch names should include the issue number, for example `feat/123-short-slug`, `fix/123-short-slug`, `docs/123-short-slug`, or `chore/123-short-slug`.
- The PR must include `Closes #<issue-number>`.
- The PR and issue must include validation evidence before Review.
- Do not bundle unrelated changes.

## Validation

Run the smallest meaningful validation for the changed surface. If the issue defines validation commands, run those commands and record exact results in the PR and Worker Completion Report.

If validation cannot run, explain why, provide the best substitute signal, and leave the issue in Review or Blocked according to the risk.

## Human Action Required

When tools, permissions, data, or safety gates block progress, write a precise `Human action required` block to the GitHub Issue and report it in the Codex thread. Include exact commands, URLs, issue bodies, labels, project fields, and the reason automation stopped.

