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

An unchanged kit-origin file can update safely. A locally modified file produces `MERGE REQUIRED: <path>` and no writes. A host-preserved file requires a new explicit merge acknowledgment when the kit version changes. `--force` is valid only during upgrade and may overwrite only a managed path already recorded in `.codex/kit-lock.json`; it cannot claim or overwrite a pre-existing file during first install. It never bypasses conflicts for host-owned policy, templates, workflows, product contract, hooks configuration, or `.codex/agent-workflow.json`.

## Configure the target

1. Complete and approve `docs/product/canonical.md`.
2. Fill `.codex/agent-workflow.json` with repository/Project metadata and real validation commands; set `configured: true` only after verifying them.
3. Create Project fields and labels described in `docs/guide/github-model.md`.
4. Review and trust `.codex/hooks.json` with Codex `/hooks`.
5. Configure ruleset required checks and human review.
6. Use `$github-project-planner` to propose the roadmap/current wave, then approve it.
7. Use `$github-agent-orchestrator` to execute only the approved Ready wave.

For a repository that already used workflow v1, do not follow new-project bootstrap blindly. Use [Existing Products](kit/repo/docs/guide/existing-products.md) to drain v1 work, reconcile managed/host collisions, migrate the existing Project in place, establish a SHA-bound baseline, and invoke Planner in continuation mode.

## Validate the installed repository

```bash
node .codex/scripts/run-validation.mjs --scope targeted
node .codex/scripts/run-validation.mjs --scope full
```

Do not add `agent-ready` until the Issue is an unblocked XS–M leaf with complete form values and Project Status Ready.

## Live pilot

The pilot is intentionally not part of install. After a separate explicit approval, use one Low-risk Issue to prove: failing branch CI creates no PR; fixed CI plus independent review/QA and admission PASS creates exactly one PR; merge remains human-controlled.
