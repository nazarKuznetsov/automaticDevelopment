# Install Codex Automation Guide v2.1

## Requirements

- Target repository with GitHub Issues and Actions enabled.
- GitHub Project v2 owned by a user or organization.
- Node.js 22+ for the kit scripts and configured validation runner.
- Codex desktop app for managed worktrees, top-level tasks, and scheduled heartbeat.
- Authenticated GitHub access for the human/agent actions you approve.

Organization-only Issue Types and merge queue are optional. Personal repositories use the `Work Type` Project field as the complete fallback.

## Preview and apply

```bash
git clone https://github.com/nazarKuznetsov/automaticDevelopment.git
cd automaticDevelopment
scripts/install-kit.sh --target /path/to/target-repo --dry-run
scripts/install-kit.sh --target /path/to/target-repo --apply
```

`--apply` performs a complete collision preflight before copying: any unsafe collision stops the run before a file is written. It is not a filesystem transaction, so an operating-system write failure can still leave a partial copy; always review the Git diff. A successful install writes `.codex/kit-lock.json` with the installed version, ownership class, content origin, and hashes.

The source checkout must have a GitHub `origin`, an exact commit, and no uncommitted changes in the manifest, kit tree, or installer. The target must be a different GitHub repository or managed worktree root. The installer prints `Kit source` and `Installation target` separately, rejects identity drift, and records source repository/commit plus target repository/origin/default branch in lock schema v3. Git metadata, submodule metadata, source symlinks, local task IDs, and worktree paths are never installable manifest entries.

When a host-owned file already exists, merge the kit requirements into that file manually, then acknowledge only that exact path:

```bash
scripts/install-kit.sh --target /path/to/target-repo --apply --accept-host AGENTS.md
```

`--accept-host` means “I reviewed and merged this host file”; it preserves the target content and records its hash. Repeat the option for multiple files. It never applies to managed files.

## Upgrade

```bash
scripts/install-kit.sh --target /path/to/target-repo --dry-run
scripts/install-kit.sh --target /path/to/target-repo --upgrade
```

An unchanged kit-origin file can update safely. A locally modified file produces `MERGE REQUIRED: <path>` and no writes. A host-preserved file requires a new explicit acknowledgment when the kit version changes. `--force` is valid only during upgrade and may overwrite only a managed path already recorded in `.codex/kit-lock.json`; use it after review to retire a managed override whose generic behavior now ships in core. It cannot claim or overwrite a pre-existing file during first install, and never bypasses conflicts for host-owned policy, templates, workflows, product contract, project runbook, hooks configuration, or `.codex/agent-workflow.json`.

Upgrade reads legacy v2 locks and writes lock v3 after a successful provenance-bound migration. A non-empty configured repository, current target remote, and any v3 lock target must all identify the same repository.

## Configure the target

1. Complete and approve `docs/product/canonical.md`.
2. Fill `.codex/agent-workflow.json` with repository/Project metadata, real validation commands, one explicit automation profile, and managed-change policy; keep merge mode `profile_risk_then_orchestrator` with the Low-risk capability enabled, because the selected profile/risk—not that capability flag alone—decides automation. Set `configured: true` only after verifying the values. Use `team_safe` until deliberately selecting `solo_fast` or `regulated`.
3. Record verified repository facts, observed check names, protection readback, and any active exact admission authority in host-owned `docs/project-workflow-runbook.md`. Keep device IDs, worktree paths, tokens, and secrets out.
4. Create Project fields and labels described in `docs/guide/github-model.md`.
5. Review and trust `.codex/hooks.json` with Codex `/hooks`.
6. Configure ruleset required checks and human review.
7. Save the repository as a Codex project and probe fresh top-level managed-worktree task creation; do not use `fork_thread` for Workers.
8. Use `$github-project-planner` in a fresh read-only task to propose a revision-bound roadmap/current wave, then approve it.
9. Approve one Wave Authority Lease and use a fresh `$github-agent-orchestrator` task to materialize the execution horizon and launch the same wave without a second planning approval.

For a repository that already used workflow v1, do not follow new-project bootstrap blindly. Use [Existing Products](kit/repo/docs/guide/existing-products.md) to drain v1 work, reconcile managed/host collisions, migrate the existing Project in place, establish a SHA-bound baseline, and invoke Planner in continuation mode.

## Validate the installed repository

```bash
node .codex/scripts/run-validation.mjs --scope targeted
node .codex/scripts/run-validation.mjs --scope full
node .codex/scripts/run-validation.mjs --scope integration
```

Do not add `agent-ready` until the Issue is an unblocked XS–M leaf with complete form values and Project Status Ready.

## Live pilot

The pilot is intentionally not part of install. Under one Wave Authority Lease, use one Low-risk Issue to prove: source/target and ownership preflight; real fresh Worker task/worktree readback in the same orchestration session; zero PRs on failing branch CI; profile-appropriate review plus deterministic admission produces one PR; profile-appropriate merge authorization; Orchestrator merge readback; merge-commit-bound post-merge CI gates Done/archive. A retry must resume the same operation journal without duplicate GitHub objects or renewed roadmap approval.
