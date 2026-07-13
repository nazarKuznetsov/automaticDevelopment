---
name: github-agent-worker
description: Deliver exactly one Ready GitHub leaf Issue in one isolated Codex worktree and agent/* branch using TDD-first implementation, Finding Packets, independent validation, branch CI, strict SHA-bound pre-PR admission, one pull request, and a Worker Completion Report. Use only from an Orchestrator Worker Packet; never merge or create additional Issues.
---

# GitHub Agent Worker

Deliver one Issue without expanding scope. Read `AGENTS.md`, `docs/product/canonical.md`, `.codex/agent-workflow.json`, the Issue and dependencies, Worker Packet, current branch, linked PRs, and relevant guide pages.

## Start Gate

Do not edit until all are true:

- the Issue is a Ready, `agent-ready` leaf sized XS–M;
- no native dependency, blocked label, owning PR, or conflicting claim exists;
- the assigned worktree and `agent/<issue>-<slug>` branch are isolated;
- acceptance, primary signal, validation commands, TDD policy, and conditional reviewers are explicit;
- the Packet matches the Issue and approved phase.

Return an exact readiness failure instead of guessing.

Do not claim a branch, push, CI run, reviewer, QA task, report, PR, or status transition exists until its command/tool result and canonical SHA/ID/URL are verified. An intended action or agent-authored summary is not evidence.

## TDD Delivery Loop

1. Trace the owner layer vertically and check coupled surfaces horizontally.
2. Reproduce the missing behavior or failure.
3. Add the highest-value failing test supported by the repository and capture RED evidence.
4. Implement the smallest coherent owner-layer fix.
5. Capture GREEN evidence, then refactor without weakening the test.
6. Run targeted checks, then the full commands configured in `.codex/agent-workflow.json`.
7. Validate the primary user-visible signal; tests alone are secondary when they do not exercise it.
8. Check documentation and migration/rollout impact.

Use a docs/config exemption only when behavior is unchanged. Record exemption type and reason before editing.

## Finding Packet

Do not create an Issue. Return every out-of-scope defect to Orchestrator:

```yaml
schema_version: 2
packet_type: finding
source_issue: 0
commit_sha: ""
summary: ""
reproduction: []
severity: Low | Medium | High
within_scope: false
affects_acceptance: false
security: false
data_risk: false
migration_risk: false
product_ambiguity: false
evidence: []
suggested_boundary: ""
```

Continue only when Orchestrator returns the finding as in-scope. Do not silently fold independent work into the branch.

## Independent Validation

After implementation:

1. Push the branch so branch CI runs on current HEAD.
2. Request independent `reviewer` and `qa` evidence. Add design/security reviewers when the Issue requires them.
3. Fix findings in the same branch and invalidate prior evidence after every commit.
4. Assemble machine evidence and use `$github-pre-pr-reviewer`.
5. Run `.codex/scripts/pre-pr-gate.mjs --evidence <path>`.

Do not call `gh pr create` or any GitHub PR creation tool unless the exact SHA receives `PASS`. A hook also guards known paths, but the contract is the primary boundary.

Reviewer and QA evidence must come from distinct agent tasks/threads or named humans, identify the exact commit SHA, and link inspectable evidence. Never fill a missing reviewer field by reviewing your own work under another heading.

## PR and Recovery

After PASS, verify no existing PR owns the Issue/SHA, then create one PR with `Closes #<issue>`. Set the Issue to Review only after PR creation. Never merge.

If post-PR checks fail or review requests changes, convert the PR to Draft, return the Issue to In Progress, remove the local admission marker, and continue in the same branch and PR.

## Completion Report

```md
## Worker Completion Report

Schema: 2
Status: PASS
Issue: #<number>
PR: <url>
Branch: <branch>
Commit SHA: <sha>

Acceptance: <criteria and evidence>
TDD: <RED, GREEN, refactor or exemption>
Owner layer: <where behavior is owned>
Primary signal status: met
Secondary checks: <exact commands/results>
Independent review: <reviewer/QA/design/security evidence>
Admission report: <PASS report link bound to SHA>
Documentation: updated | not needed
Migration / rollout: <impact>
Findings: <resolved packets and remaining risk>
Human gates: <merge and any additional gate>
```

Post this report only after the PR exists and every completion field is verified. A blocked or partially validated Worker returns a Finding Packet and/or Human Action Required instead; it must not publish a completion report.
