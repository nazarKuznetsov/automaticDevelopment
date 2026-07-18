---
title: Troubleshooting
description: Common fail-closed states and the next safe action.
order: 12
slug: troubleshooting
---

# Troubleshooting

## Materialization stopped before GitHub writes

This is the correct fail-closed result when either packet lacks an exact title/Project field, contains an unknown typed dependency, selects no valid report parent, has a stale digest/approval, or the Start Packet mode/authority does not match the Ready wave. Do not fill gaps in the Orchestrator chat and do not partially create Issues. Upgrade the managed kit files, run a fresh read-only Planner in Repair mode, validate the complete replacement packets locally, obtain exact revision/digest approval, then start a new Orchestrator task.

An empty Ready wave is not itself a blocker. Use `materialization_only`, approve the complete materialization item set, grant zero Worker authority, and expect an empty `agent_ready_readback`.

## GitHub authentication cannot mutate or read the Project

Run `gh auth status` and verify repository access plus Project scope, or prove equivalent GitHub App/API coverage with non-mutating probes. Reauthorize before retrying. Do not substitute browser clicks for typed, idempotent multi-item readback and do not repeat an ambiguous mutation until a stable plan ID search proves it was not created.

## Configured PR validation did not start

Confirm the PR targets the configured default branch, Actions are enabled, the repository's recorded PR workflow exists on the PR head, and it is not skipped or disabled in the Actions UI. Compare successful check-run names with the host-owned project runbook. Use manual dispatch only to diagnose the same committed workflow; a local PASS does not replace missing remote checks.

## Production preview is unavailable

Open the failed check and inspect its preview log. Verify the production build succeeded, the preview process stayed alive, and the exact isolated `PREVIEW_URL` recorded by the workflow returned a successful response before browser validation ran. Keep the check failed until that URL is genuinely reachable; do not bypass the readiness loop.

## Visual failure artifacts are missing

The failed visual job must upload the repository's recorded preview/browser logs and screenshots from its configured artifact location. If no artifact exists, require the upload step to fail when no files are found. Restore evidence rather than accepting a result without it.

## `agent-ready` keeps disappearing

Read the single `Agent readiness audit` comment. Fill real Issue Form values, decompose Epic/Capability or L/XL work, remove `blocked`, and let Orchestrator verify native dependencies and Project Ready status before restoring the label.

## Branch CI fails before a PR exists

This is expected. Keep the Issue in Validation, fix the same branch, and push a new commit. Do not create a draft PR as a workaround. Every new SHA requires fresh CI and admission.

## Admission says the SHA is stale

Run `git rev-parse HEAD`, compare the configured default-branch SHA with the admission evidence's `validated_base_sha`, and confirm branch CI/reviews tested current HEAD. Keep `base_sha_at_launch` unchanged. When the base advanced, synchronize, record the new validated base, then rerun reviewer, QA, specialists, admission, and human authorization. Never edit the marker by hand.

## Admission says the tracked tree is dirty

Inspect `git status --short`, identify the sole write owner, and either commit intended Worker changes or remove disposable QA artifacts from tracked paths. Do not stage QA/reviewer output to make the check pass.

## PR creation authorization was consumed

Query open and closed PRs for the Issue, branch, and SHA before doing anything else. If no PR exists, rebuild/rerun admission and make one new attempt. Do not delete or edit the consumption record by hand and do not retry the PR tool blindly.

## PR creation target does not match admission

Read the marker and remote state; do not edit the marker. Invoke exactly one Draft PR creation with explicit repository, head branch, and base branch matching the admitted target. For shell usage, pass `--repo`, `--head`, `--base`, and `--draft` directly without substitutions, wrappers, or compound commands. A changed repository, branch, base, config, or SHA requires fresh admission.

## Existing failure blocks admission

Prove it on the base revision, link a separate open Bug Issue, and show the current change neither created nor touched it. Without all three, treat it as a regression.

## Installer reports `MERGE REQUIRED`

No files were written. For a host-owned path, review the printed kit and host versions, preserve the verified repository values, and rerun with `--accept-host <path>`. For a formerly customized managed path whose generic behavior now exists in core, review the new managed source and use upgrade-only `--force` to retire the override. Never use `--force` for host-owned files or keep repository-specific text in a managed file.

## No task/worktree tools

Run one write Worker in the checkout and keep reviewer/admission read-only plus QA non-authoring. If sibling tasks are unavailable, use the generated prompt in a manually created fresh Codex task. Never fork Orchestrator history or run concurrent writers in one checkout.

## Worker creation returned only a client ID

Keep the claim in `CREATING`; do not increment launch count. Query task state until a canonical top-level task ID and managed-worktree state are verified. On ambiguity, search before retrying. On confirmed failure, release the claim.

## A claim appears stale

Do not reassign unless the task is absent, three heartbeats were missed, and no branch or PR exists. Any branch/PR requires investigation and same-task recovery.

## Human approved a merge but SHA changed

The approval is canceled. Synchronize if base changed; rerun CI, reviewer, QA, admission, and request a new exact PR/head-SHA authorization. Never merge a nearby SHA.

## Post-merge CI failed

Keep the parent outside Done, create the blocking Finding/Bug path, and leave the Worker unarchived until reconciliation. Do not rewrite merge history to simulate a green result.

## Heartbeat does nothing

Check that a real schedule ID was returned, Codex desktop is running, the task is active, a checkout is available, and executable work exists. Idle and human-only states intentionally pause heartbeat. Without a schedule ID, treat monitoring as unavailable and resume the task manually.

## An agent reports a write but no URL or ID

Treat the write as unverified. Read the owning GitHub/task state, search for the intended object before retrying, and relabel the claim `planned`, `failed`, or `unknown`. Do not create a duplicate to make the ledger match the narrative.

## Hooks do not block a PR path

Hooks are incomplete by design. Stop, invalidate the PR action, verify the contract/gate script, and strengthen repository rulesets. Never treat the hook as the only enforcement boundary.
