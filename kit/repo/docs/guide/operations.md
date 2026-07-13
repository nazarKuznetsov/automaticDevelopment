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

Upgrade overwrites an installed file only when its current hash still matches the lock. Modified files stop during collision preflight with exact `MERGE REQUIRED` paths. `--force` affects only managed files; it never bypasses a host-owned conflict.

Here, “stop” refers to collision preflight, not rollback after an operating-system copy failure; always inspect the Git diff. `--dry-run` automatically previews install when no lock exists and upgrade when it does. `--force` is upgrade-only and only for a managed path already recorded by the kit. After manually merging a host-owned file, preserve it explicitly with repeatable `--accept-host <path>`; never use that option as a substitute for reviewing the merge.

## Scheduled work

The 20-minute heartbeat uses task-attached Codex [scheduled work](https://developers.openai.com/codex/app/automations) only after the scheduling tool returns a schedule ID. It needs the Codex desktop app running and an available checkout. Pause it when idle or awaiting a human. If scheduling is unavailable, record that limitation and require explicit task resumption; do not imply background monitoring continues. No database, webhook, hosted controller, or background service is required.

Test the heartbeat prompt manually before scheduling it. Scheduled runs use unattended sandbox/approval behavior, so grant only the permissions needed for the already approved phase. A schedule preserves cadence and context; it does not expand product scope, risk authority, merge authority, or permission to deploy.

## Repository protections

Require the branch validation workflow on `agent/**` and repeat relevant checks on PRs. Configure a ruleset for required checks, human review, and resolved review conversations. Organization repositories may add merge queue.

## Dogfood pilot

The primary acceptance test is live but never automatic without consent:

1. approve a Low-risk pilot Issue and GitHub writes;
2. push an intentional branch CI failure and verify zero PR calls;
3. fix the branch;
4. obtain independent reviewer/QA evidence and admission PASS for the exact SHA;
5. create exactly one PR;
6. verify post-PR checks and leave merge to the human.

Record limitations if the pilot cannot run. Local tests validate contracts but do not replace this primary signal.
