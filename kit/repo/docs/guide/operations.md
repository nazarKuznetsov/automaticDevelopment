---
title: Operations
description: Installer upgrades, schedules, rulesets, phase exit, and live pilot.
order: 11
slug: operations
---

# Operations

## Safe upgrades

`kit/manifest.json` classifies host, managed, and generated files. Lock v3 records exact source repository/commit/tree and target repository/origin/default branch in addition to hashes. Preview every change from a clean verified source checkout:

```bash
scripts/install-kit.sh --target /path/to/repo --dry-run
scripts/install-kit.sh --target /path/to/repo --upgrade
```

Upgrade overwrites an installed file only when its current hash still matches the lock. Modified files stop during collision preflight with exact `MERGE REQUIRED` paths. `--force` affects only managed files; use it to retire a deliberate old managed override after the equivalent behavior ships in core. It never bypasses a host-owned conflict.

Here, “stop” refers to collision preflight, not rollback after an operating-system copy failure; always inspect the Git diff. `--dry-run` automatically previews install when no lock exists and upgrade when it does. `--force` is upgrade-only and only for a managed path already recorded by the kit. Preserve verified host values with repeatable `--accept-host <path>`; never use that option as a substitute for reviewing the host file.

Repository values belong only in host-owned configuration/runbook. Managed schemas, gates, hooks, skills, and guides remain byte-for-byte source-owned. A product requirement touching managed paths becomes a Kit Maintenance Packet; it is fixed at source and adopted through an exact-source upgrade. Generated paths are changed only through their owning generator.

Upgrade from lock v2 migrates to v3 without changing host files. Validator strengthening does not invalidate accepted product decisions or an otherwise matching Wave Authority Lease; only a semantic plan/scope change requires a new product approval. If a packet itself is invalid, repair the machine packet while preserving approved outcomes and stable IDs.

## Automation profiles

- `team_safe` is the unconfigured/default profile: routine scoped writes and launches are automatic; merges remain human-authorized.
- `solo_fast` additionally auto-merges Low-risk work after deterministic admission and repository checks.
- `regulated` requires explicit action gates and separate review identities.

Profile changes are host-owned policy changes. They never come from repository owner type, chat inference, or a Worker.
The merge capability flag is enabled by the Kit, but it is not authority by itself: only `solo_fast` plus Low risk plus complete admission may use it. `team_safe`, `regulated`, Medium, and High remain exact-human-authorized.

## Scheduled work

The 20-minute heartbeat uses task-attached Codex [scheduled work](https://developers.openai.com/codex/app/automations) only after the scheduling tool returns a schedule ID. It belongs to the current wave Orchestrator, needs the Codex desktop app running and an available checkout, and pauses when idle or awaiting a human. If scheduling is unavailable, record it and require explicit resumption; do not imply background monitoring continues. No database, webhook, hosted controller, or background service is required.

Test the heartbeat prompt manually before scheduling it. Scheduled runs use unattended sandbox/approval behavior, so grant only the permissions needed for the already approved phase. A schedule preserves cadence and context; it does not expand product scope, risk authority, merge authority, or permission to deploy.

## Repository protections

Require branch validation on `agent/**` and repeat relevant checks on PR/default branch. Do not infer required check names from YAML. Read the successful GitHub check runs, record their exact names in the host-owned project runbook, and then configure the default-branch ruleset to require those names, require the branch to be up to date before merge, require resolved conversations, and block merge while any required check is pending or failing. Do not mutate the ruleset without separate human approval. Merge queue may replace manual base synchronization only after its availability and behavior are verified in an organization repository.

## Dogfood pilot

The primary acceptance test is live but never automatic without consent:

1. do not interrupt active v1 write Workers in the target product;
2. migrate at a safe boundary through a separate workflow-only Issue/PR;
3. approve one Low-risk v2.1 pilot with one Wave Authority Lease;
4. verify source/target identity and explicit host/managed/generated ownership classification;
5. exercise a fingerprinted managed-core finding through source deduplication or `BLOCK_AND_REPORT`, never a target overlay;
6. verify Orchestrator creates a real fresh top-level Worker task and managed worktree for the target-owned leaf in the same session;
7. push an intentional branch CI failure and verify zero PR calls;
8. fix the branch and obtain the profile-appropriate review topology plus deterministic admission;
9. create exactly one PR;
10. verify `solo_fast` Low auto-merge or the configured exact authorization path;
11. verify expected head and merge-commit readback;
12. require post-merge CI bound to the merge commit before Done and Worker archive.

Record limitations if the pilot cannot run. Local tests validate contracts but do not replace this primary signal. Routine pilot writes stay inside the one lease; do not prompt separately for each mutation.
