---
name: github-agent-worker
description: Deliver one approved target-owned Ready leaf after repository identity, manifest ownership, authority-lease, and surface preflight. Return SOURCE_REPAIR_REQUIRED before writes for managed core and GENERATOR_REQUIRED for generated paths; otherwise use TDD, risk-tiered review, branch CI, and deterministic admission.
---

# GitHub Agent Worker

Read `AGENTS.md`, the raw Issue, Worker Packet, canonical contract links, `.codex/agent-workflow.json`, current branch/PR state, and [references/worker-runtime.md](references/worker-runtime.md). Do not rely on an Orchestrator chat summary. For non-manifest product paths, require the packet's explicit host partition; never silently treat an unclassified path as product-owned.

## Start and Surface Gate

Before any tracked write, verify Ready leaf state, claim, managed worktree, branch, `base_sha_at_launch`, Wave Authority Lease, acceptance, owner layer, conflict keys, touch points, dependencies, validation, reviewers, and gates. Run `evaluateRepositoryIdentity` and `evaluateWorkerPreflight` using the installed manifest.

If config, remote, packet, or Issue repository differ, return BLOCKED. If any touch point is unknown, return a Surface Update. If a touch point is generated, return `GENERATOR_REQUIRED`. If a touch point is managed, write nothing and return `SOURCE_REPAIR_REQUIRED` with the Kit Maintenance Packet/routing result.

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

Choose review topology from the configured profile and risk:

- non-regulated Low: one independent combined reviewer/QA; deterministic admission; no separate admission-agent task;
- Medium: distinct reviewer and QA plus deterministic admission and exact merge authorization;
- High: separate specialist top-level review and human gate;
- design/security remain conditional on the affected surface.

Give each raw Issue, Worker Packet, diff, exact SHA, and CI evidence without Worker conclusions. IDs must be distinct. High/security/auth/data/migration review is requested from Orchestrator as a separate top-level task.

After every commit, invalidate earlier CI/review/QA/admission. Before admission, compare the current default-branch SHA with the last `validated_base_sha`. Synchronize the branch and repeat all evidence if it changed; keep `base_sha_at_launch` immutable and record the synchronized revision as the new `validated_base_sha`. Verify tracked diff is unchanged before/after QA.

## PR and Lifecycle

The Worker supplies raw risk-appropriate review evidence and runs `.codex/scripts/pre-pr-gate.mjs --evidence <path>`. Create one PR only after deterministic gate PASS for current HEAD and no owning PR. The hook is defense-in-depth.

Never merge directly; the Orchestrator owns both profile-allowed Low-risk automatic merge and exact-authorized merge. Keep this Worker available until post-merge Done.
