---
title: Operations
description: Installer upgrades, schedules, rulesets, phase exit, and live pilot.
order: 11
slug: operations
---

# Operations

## Safe upgrades

`kit/manifest.json` classifies host-owned and kit-managed files. `.codex/kit-lock.json` records installed hashes. Preview every change:

```bash
scripts/install-kit.sh --target /path/to/repo --dry-run
scripts/install-kit.sh --target /path/to/repo --upgrade
```

Upgrade overwrites an installed file only when its current hash still matches the lock. Modified files stop during collision preflight with exact `MERGE REQUIRED` paths. `--force` affects only managed files; use it to retire a deliberate old managed override after the equivalent behavior ships in core. It never bypasses a host-owned conflict.

Here, “stop” refers to collision preflight, not rollback after an operating-system copy failure; always inspect the Git diff. `--dry-run` automatically previews install when no lock exists and upgrade when it does. `--force` is upgrade-only and only for a managed path already recorded by the kit. Preserve verified host values with repeatable `--accept-host <path>`; never use that option as a substitute for reviewing the host file.

Repository values belong only in host-owned `.codex/agent-workflow.json` and `docs/project-workflow-runbook.md`. Managed schemas, gates, hooks, skills, and guide pages must remain byte-for-byte kit-owned. A normal repository should therefore upgrade without a managed-file merge. If a managed collision appears, identify whether it is an obsolete override that core now covers or an unmodeled project requirement; never copy repository-specific values into managed documentation.

Patch upgrades may strengthen managed schemas, validators, skills, and guide pages without changing workflow schema version 2. After such an upgrade, previously approved packets are not grandfathered into materialization: recompute them against the installed validators. If they fail, preserve accepted product decisions and stable IDs in a fresh read-only Planner Repair revision, then obtain a new exact approval. Do not edit an approved packet in place.

## Scheduled work

The 20-minute heartbeat uses task-attached Codex [scheduled work](https://developers.openai.com/codex/app/automations) only after the scheduling tool returns a schedule ID. It belongs to the current wave Orchestrator, needs the Codex desktop app running and an available checkout, and pauses when idle or awaiting a human. If scheduling is unavailable, record it and require explicit resumption; do not imply background monitoring continues. No database, webhook, hosted controller, or background service is required.

Test the heartbeat prompt manually before scheduling it. Scheduled runs use unattended sandbox/approval behavior, so grant only the permissions needed for the already approved phase. A schedule preserves cadence and context; it does not expand product scope, risk authority, merge authority, or permission to deploy.

## Repository protections

Require branch validation on `agent/**` and repeat relevant checks on PR/default branch. Do not infer required check names from YAML. Read the successful GitHub check runs, record their exact names in the host-owned project runbook, and then configure the default-branch ruleset to require those names, require the branch to be up to date before merge, require resolved conversations, and block merge while any required check is pending or failing. Do not mutate the ruleset without separate human approval. Merge queue may replace manual base synchronization only after its availability and behavior are verified in an organization repository.

## Dogfood pilot

The primary acceptance test is live but never automatic without consent:

1. do not interrupt active v1 write Workers in the target product;
2. migrate at a safe boundary through a separate workflow-only Issue/PR;
3. approve one Low-risk v2 pilot and its GitHub writes;
4. verify Orchestrator creates a real fresh top-level Worker task and managed worktree;
5. push an intentional branch CI failure and verify zero PR calls;
6. fix the branch and obtain distinct reviewer, non-authoring QA, and admission evidence for the exact SHA/base;
7. create exactly one PR;
8. have the human authorize repository, exact PR/head/base SHA, and admission report digest;
9. let Orchestrator merge with expected SHA and verify head/merge-commit readback;
10. require post-merge CI bound to the merge commit before Done and Worker archive.

Record limitations if the pilot cannot run. Local tests validate contracts but do not replace this primary signal. Every live migration/pilot write requires separate human confirmation.
