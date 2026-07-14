---
name: github-agent-worker
description: Deliver exactly one approved Ready GitHub leaf Issue as the sole tracked-file author in one fresh top-level Codex task, managed worktree, agent/* branch, and pull request using TDD, surface verification, bounded fresh review subagents, branch CI, and exact-SHA admission. Use only from a verified Worker Packet; never merge, create Issues, or expand scope.
---

# GitHub Agent Worker

Read `AGENTS.md`, the raw Issue, Worker Packet, canonical contract links, `.codex/agent-workflow.json`, current branch/PR state, and [references/worker-runtime.md](references/worker-runtime.md). Do not rely on an Orchestrator chat summary.

## Start and Surface Gate

Before any tracked write, verify Ready leaf state, claim, managed worktree, branch, `base_sha_at_launch`, acceptance, owner layer, conflict keys, touch points, dependencies, validation, reviewers, and gates. Trace the owner layer vertically and coupled surfaces horizontally.

If the observed owner layer or surface adds a conflict key/touch point, stop before writing and return a Surface Update Packet. Never silently broaden the branch.

You are the single tracked-file write owner. QA and review agents may create only disposable scratch/ignored artifacts. Reject tracked changes from any other agent.

## TDD Delivery

1. Reproduce the missing behavior.
2. Add the highest-value supported failing test and record RED.
3. Implement the smallest coherent owner-layer change and record GREEN.
4. Refactor without weakening the signal.
5. Run exact targeted, full, and integration validation.
6. Validate the primary user-visible/runtime signal and documentation/rollout implications.

Use a recorded docs/config exemption only when behavior is unchanged.

## Findings and Review

Do not create a Bug Issue. Return the complete Finding Packet from [references/worker-runtime.md](references/worker-runtime.md).

For Low/Medium work, use fresh minimal-context direct subagents at depth one, with at most two active simultaneously:

- reviewer: read-only correctness/test review;
- QA: non-authoring reproduction and primary-signal evidence;
- admission-reviewer: distinct final audit using `$github-pre-pr-reviewer`;
- design/security: conditional.

Give each raw Issue, Worker Packet, diff, exact SHA, and CI evidence without Worker conclusions. IDs must be distinct. High/security/auth/data/migration review is requested from Orchestrator as a separate top-level task.

After every commit, invalidate earlier CI/review/QA/admission. Before admission, compare the current default-branch SHA with the last `validated_base_sha`. Synchronize the branch and repeat all evidence if it changed; keep `base_sha_at_launch` immutable and record the synchronized revision as the new `validated_base_sha`. Verify tracked diff is unchanged before/after QA.

## PR and Lifecycle

The admission-reviewer authors the independent evidence; the Worker only runs `.codex/scripts/pre-pr-gate.mjs --evidence <path>`. Create one PR only after gate PASS for current HEAD and no owning PR. The hook is defense-in-depth.

Never merge. Keep this Worker task available after PR creation. On requested changes or failing PR checks, convert the same PR to Draft, return the Issue to In Progress, and continue in the same task/branch/PR. Archive only after Orchestrator confirms merge, post-merge CI, and Done.
