---
title: Pre-PR Gate
description: Independent SHA-bound admission, baseline policy, hooks, and post-PR recovery.
order: 8
slug: pre-pr-gate
---

# Strict pre-PR admission

PR creation is a state transition, not a hopeful request for CI. Before any PR tool runs, all eight admission groups must pass:

1. acceptance criteria with evidence;
2. TDD RED/GREEN or allowed docs/config exemption;
3. targeted and full local validation from workflow config;
4. independent reviewer and QA, plus conditional design/security;
5. branch CI on the exact `agent/**` HEAD SHA;
6. no unresolved native blocking dependency;
7. baseline comparison with no new or touched failure;
8. documentation, migration/rollout, and human gates resolved.

Create machine evidence matching `.codex/schemas/v2/pre-pr-admission.schema.json`, then run:

```bash
node .codex/scripts/pre-pr-gate.mjs --evidence /path/to/evidence.json
```

The gate invalidates any older marker first, verifies workflow configuration, and itself reruns the exact configured targeted and full commands. It then compares the evidence command list with configuration before evaluating the remaining groups.

`PASS + CREATE_ONCE` writes an untracked marker under the actual Git directory, so managed worktrees are supported. `PASS + USE_EXISTING` writes no creation marker. Any commit change invalidates the marker, and any subsequent gate run invalidates the previous marker before evaluating new evidence. The hook consumes the marker for one PR-creation attempt; after an ambiguous or failed attempt, query GitHub for an existing PR and rerun admission instead of retrying blindly. FAIL keeps the Issue in Validation and authorizes no PR. BLOCKED moves it to Blocked.

The evidence behind a PASS uses exact commands/results, canonical run/artifact links, distinct reviewer/QA task or human identities, and the current SHA. A copied `PASS` string, inaccessible URL, or same-context role-play is not independent evidence and fails closed.

## Baseline policy

A legacy failure is exempt only when a separate Bug Issue exists and evidence proves the failure predates the branch. A new failure or a failure in touched behavior always blocks admission.

## Defense in depth

Project hooks intercept known `gh pr create` and MCP PR creation paths. Codex hooks do not intercept every equivalent path, so the Worker/Orchestrator contract and gate script remain the primary boundary. GitHub rulesets remain the merge boundary.

## Recovery

After two unsuccessful fixes for the same signal, change approach or engage a specialist. On the third repetition, set Blocked and request a human. If post-PR checks fail or changes are requested, convert the PR to Draft, return the Issue to In Progress, and continue in the same branch/PR. Never open a replacement PR for the same work.
