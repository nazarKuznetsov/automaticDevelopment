---
title: Pre-PR Gate
description: Distinct admission agent, exact head/base SHA, clean tree, CI, baseline, and PR recovery.
order: 8
slug: pre-pr-gate
---

# Strict pre-PR admission

PR creation is a state transition. Admission accepts exactly one subject:

- an ordinary leaf Issue (`worker` + `issue`);
- an explicitly configured one-time control-plane bootstrap (`executor` + `bootstrap`);
- an explicitly configured Canonical Brief publication (`publisher` + `canonical_publication`).

Mixed, orphaned, or unknown subject fields fail closed. Bootstrap and Canonical publication are narrow setup/publication exceptions, not Issue or merge bypasses. Their exact repository, branch, base binding, revision, approval, allowed paths, content hashes, and supersession contract come only from the authoritative default-branch `.codex/agent-workflow.json`; human-readable readback belongs in the host-owned project runbook.

Before any PR tool runs, require:

1. all acceptance criteria and the primary signal;
2. TDD RED/GREEN or an allowed behavior-neutral exemption;
3. exact targeted, full, and integration validation;
4. clean tracked tree before/after QA and gate validation;
5. distinct reviewer, QA, and admission-reviewer identities, plus conditional specialists;
6. branch CI for the exact current head SHA;
7. unchanged default-branch SHA since Worker launch;
8. no blocking dependency or human gate;
9. no new/touched failure, and traceable legacy Bug exemptions;
10. documentation and rollout resolved.

The admission-reviewer runs `$github-pre-pr-reviewer` in a fresh non-authoring context and returns machine evidence. The Worker cannot author or “correct” that PASS. It invokes:

```bash
node .codex/scripts/pre-pr-gate.mjs --evidence /path/to/evidence.json
```

The script deletes an older unconsumed marker, verifies the required evidence shape, resolves actual HEAD and the authoritative default branch from `origin`, reads configuration from that exact remote base, preserves QA tracked-tree evidence, rejects a dirty gate worktree, reruns configured targeted/full/integration commands, rechecks tracked state, and evaluates raw evidence. Canonical publication additionally verifies the immutable configuration, exact changed paths, approved SHA-256 content hashes, revisions, approver, and supersession text.

`PASS + CREATE_ONCE` writes an untracked one-shot SHA/base/report-digest marker under the actual Git directory. A consumed authorization cannot be reissued for the same SHA. While an unconsumed marker exists, the Bash hook rejects any other shell command and known PR tools accept only the exact PR-create operation; this is defense in depth, not a universal tool lock. `PASS + USE_EXISTING` creates no marker. FAIL stays in Validation; BLOCKED moves to Blocked.

Any head or base change invalidates reviewer, QA, specialists, admission, and human merge authorization. Synchronize and start the evidence chain again; never copy PASS forward.

## Baseline

A legacy failure is exempt only when a separate Bug exists and exact base-SHA evidence proves it predates the branch. New or touched failures always block.

## Defense in depth

The hook recognizes known PR creation tools and shell payloads using either `command` or `cmd`. It requires one explicit Draft target matching the admitted repository, head branch, and base branch; missing flags, compound commands, substitutions, multiple PR calls, or a mismatched connector payload are denied. Hooks do not intercept every equivalent path and require project trust, so the skill contract and deterministic gate remain primary. GitHub rulesets protect merge.

## Recovery

On the first repeated signal, attempt a focused fix. After the second failure, change approach or add a specialist. On the third, set Blocked and request a human. After requested changes or failing PR checks, reuse the same Worker task/branch/Draft PR.
