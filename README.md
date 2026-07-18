# Codex Automation Guide v2

Lifecycle-driven, GitHub-native development for Codex: Canonical Brief → global roadmap → design gate → approved wave → fresh top-level TDD Workers → independent head/remote-base admission → repository/PR/head/base/digest-bound human authorization → Orchestrator merge → merge-commit-bound post-merge Done.

- Published guide: <https://nazarkuznetsov.github.io/automaticDevelopment/>
- Installable kit: `kit/repo/`
- Canonical documentation source: `kit/repo/docs/guide/*.md`

## Local development

```bash
git clone https://github.com/nazarKuznetsov/automaticDevelopment.git
cd automaticDevelopment
npm install
npm test
npm run check
npm run build
```

Run the visual suite against a local preview:

```bash
npm run preview
PREVIEW_URL=http://127.0.0.1:4321/automaticDevelopment/ npm run test:visual
```

Every pull request targeting `main` runs the remote required-check candidates `PR Validation / quality` and `PR Validation / visual`. Quality covers tests, repository checks, and the production build; visual starts the production preview and verifies it with Chromium.

## Install into a target repository

```bash
scripts/install-kit.sh --target /path/to/target-repo --dry-run
scripts/install-kit.sh --target /path/to/target-repo --apply
```

For an installed v2 kit:

```bash
scripts/install-kit.sh --target /path/to/target-repo --upgrade
```

The installer uses `kit/manifest.json` and `.codex/kit-lock.json`. It never blindly overwrites host-owned `AGENTS.md`, templates, workflows, product contracts, workflow configuration, or the project runbook; reviewed host files require an explicit path-scoped `--accept-host`. Generic bootstrap, Canonical publication, and exact-target PR admission stay managed by the kit, so repository values do not require managed-file overrides. See [INSTALL.md](INSTALL.md).

Repositories that already used workflow v1 should follow the canonical [Existing Products migration](kit/repo/docs/guide/existing-products.md): preserve the current Project/history, reconcile contracts and baseline, then continue from the evidence-backed phase instead of repeating bootstrap.

## Scope

The kit uses one fresh Orchestrator task per wave and one fresh top-level managed-worktree Worker task per Ready leaf Issue. It uses native GitHub Issues, Project v2, Actions, PRs, sub-issues, and dependencies, with at most two Workers only on disjoint conflict keys. It adds no hosted controller, database, webhook service, required Figma integration, or pinned model slug. Scheduled local heartbeats require the Codex desktop app and an available checkout.

No live GitHub pilot, Issue, branch, or PR is created by repository tests. The dogfood pilot requires a separate human approval.
