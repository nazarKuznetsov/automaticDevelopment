---
title: Troubleshooting
description: Common fail-closed states and the next safe action.
order: 12
slug: troubleshooting
---

# Troubleshooting

## `agent-ready` keeps disappearing

Read the single `Agent readiness audit` comment. Fill real Issue Form values, decompose Epic/Capability or L/XL work, remove `blocked`, and let Orchestrator verify native dependencies and Project Ready status before restoring the label.

## Branch CI fails before a PR exists

This is expected. Keep the Issue in Validation, fix the same branch, and push a new commit. Do not create a draft PR as a workaround. Every new SHA requires fresh CI and admission.

## Admission says the SHA is stale

Run `git rev-parse HEAD`, confirm branch CI tested that SHA, rebuild independent evidence, and rerun the gate. Never edit the marker by hand.

## PR creation authorization was consumed

Query open and closed PRs for the Issue, branch, and SHA before doing anything else. If no PR exists, rebuild/rerun admission and make one new attempt. Do not delete or edit the consumption record by hand and do not retry the PR tool blindly.

## Existing failure blocks admission

Prove it on the base revision, link a separate open Bug Issue, and show the current change neither created nor touched it. Without all three, treat it as a regression.

## Installer reports `MERGE REQUIRED`

No files were written. Review the printed kit and host paths, merge the policy intentionally, then rerun the same mode with `--accept-host <path>` for each reviewed host-owned file. `--force` cannot overwrite host-owned files.

## No task/worktree tools

Run one write Worker in the checkout and keep reviewer/QA tasks read-only. If even sibling tasks are unavailable, use the generated Worker prompt in a manually created Codex task. Never run concurrent writers in one checkout.

## Heartbeat does nothing

Check that a real schedule ID was returned, Codex desktop is running, the task is active, a checkout is available, and executable work exists. Idle and human-only states intentionally pause heartbeat. Without a schedule ID, treat monitoring as unavailable and resume the task manually.

## An agent reports a write but no URL or ID

Treat the write as unverified. Read the owning GitHub/task state, search for the intended object before retrying, and relabel the claim `planned`, `failed`, or `unknown`. Do not create a duplicate to make the ledger match the narrative.

## Hooks do not block a PR path

Hooks are incomplete by design. Stop, invalidate the PR action, verify the contract/gate script, and strengthen repository rulesets. Never treat the hook as the only enforcement boundary.
