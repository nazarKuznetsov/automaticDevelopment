# Install Codex Automation Guide v2

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

## Configure the target

1. Complete and approve `docs/product/canonical.md`.
2. Fill `.codex/agent-workflow.json` with repository/Project metadata and real targeted/full/integration validation commands; set `configured: true` only after verifying them. Keep optional `bootstrap` and `canonical_publication` values `null` unless a human has approved one exact target.
3. Record verified repository facts, observed check names, protection readback, and any active exact admission authority in host-owned `docs/project-workflow-runbook.md`. Keep device IDs, worktree paths, tokens, and secrets out.
4. Create Project fields and labels described in `docs/guide/github-model.md`.
5. Review and trust `.codex/hooks.json` with Codex `/hooks`.
6. Configure ruleset required checks and human review.
7. Save the repository as a Codex project and probe fresh top-level managed-worktree task creation; do not use `fork_thread` for Workers.
8. Use `$github-project-planner` in a fresh read-only task to propose a revision-bound roadmap/current wave, then approve it.
9. Use a fresh `$github-agent-orchestrator` task with an approved Start Packet to materialize and execute only that wave.

For a repository that already used workflow v1, do not follow new-project bootstrap blindly. Use [Existing Products](kit/repo/docs/guide/existing-products.md) to drain v1 work, reconcile managed/host collisions, migrate the existing Project in place, establish a SHA-bound baseline, and invoke Planner in continuation mode.

## Validate the installed repository

```bash
node .codex/scripts/run-validation.mjs --scope targeted
node .codex/scripts/run-validation.mjs --scope full
node .codex/scripts/run-validation.mjs --scope integration
```

Do not add `agent-ready` until the Issue is an unblocked XS–M leaf with complete form values and Project Status Ready.

## Live pilot

The pilot is intentionally not part of install. After separate approval, use one Low-risk Issue to prove: real fresh Worker task/worktree readback; zero PRs on failing branch CI; fixed CI plus distinct reviewer/QA/admission produces one PR; human authorizes repository/PR/head/base/admission digest; Orchestrator merges; merge-commit-bound post-merge CI gates Done/archive.
