---
title: GitHub Model
description: Project fields, native hierarchy and dependencies, labels, and state transitions.
order: 5
slug: github-model
---

# GitHub model

GitHub is the durable ledger. A Codex task may disappear without losing ownership, evidence, dependencies, or the next action.

The hierarchy/blocking contract uses native GitHub [sub-issues](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/adding-sub-issues) and [issue dependencies](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/creating-issue-dependencies), both of which require repository permissions and must be verified after mutation.

## Project fields

- `Status`: Backlog, Ready, In Progress, Validation, Blocked, Review, Done, Canceled.
- `Phase`: Discovery, Planning, Design, Foundation, MVP, Stabilization, Production, Growth.
- `Work Type`: Epic, Capability, Task, Bug, Docs, Automation, Refactor.
- `Priority`: P0–P3.
- `Size`: XS–XL.
- `Risk`: Low, Medium, High.
- `QA Required`: Yes, No.
- Built-ins: Iteration and, when exposed by the target Project, Parent issue and Sub-issue progress.

For organization repositories, native [Issue Types](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/managing-issue-types-in-an-organization) and [merge queue](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/incorporating-changes-from-a-pull-request/merging-a-pull-request-with-a-merge-queue) may augment this model when the repository/plan supports them. They are not prerequisites. Always fill Work Type as the personal-repository fallback.

Do not infer these optional capabilities from organization ownership. Verify each on the target repository and reflect the result in `.codex/agent-workflow.json`. `Capability` also covers Module; `Task` may be a parent Deliverable or a leaf Task, so native sub-issue state remains the leaf test.

## State machine

```text
Backlog → Ready → In Progress → Validation → Review → Done
                ↘ Blocked ↗
Canceled is terminal
```

Review requires an existing PR. PR creation requires Validation and a head/base-SHA-bound Admission PASS. Review remains until merge readback and post-merge CI PASS; only then is Done valid. `Blocked` is for a real unresolved dependency or human decision, not ordinary implementation difficulty.

## Labels and automation

Required workflow labels include `agent-ready`, `blocked`, `qa-required`, `security-review`, `design-review`, `human-action-required`, `docs`, `automation`, and `workflow`.

Readiness Action validates substantive Issue Form values and enums, including stable Plan Item ID, Priority, merge outcome, owner layer, conflict keys, touch points, integration validation/order, reviewers, and out-of-scope. It requires three to five acceptance checks, rejects Epic/Capability and L/XL work, fails closed when native leaf state cannot be queried, removes invalid `agent-ready`, and updates one idempotent audit comment. Orchestrator separately verifies Project Status, native dependencies, claims, and owning PRs; the Action therefore needs no PAT for a user-owned Project.

Configure branch [rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets) to require branch/PR checks, resolved review threads, and human approval. The human records the exact PR/head SHA; Orchestrator executes the verified merge. Merge queue remains an optional organization capability.
