# Codex Automation Guide v2

Lifecycle-driven, GitHub-native development for Codex: Canonical Brief → global roadmap → design gate → rolling waves → isolated TDD Workers → independent SHA-bound admission → human merge.

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

## Install into a target repository

```bash
scripts/install-kit.sh --target /path/to/target-repo --dry-run
scripts/install-kit.sh --target /path/to/target-repo --apply
```

For an installed v2 kit:

```bash
scripts/install-kit.sh --target /path/to/target-repo --upgrade
```

The installer uses `kit/manifest.json` and `.codex/kit-lock.json`. It never blindly overwrites host-owned `AGENTS.md`, templates, workflows, product contracts, or workflow configuration; manually merged host files require an explicit path-scoped `--accept-host`. See [INSTALL.md](INSTALL.md).

Repositories that already used workflow v1 should follow the canonical [Existing Products migration](kit/repo/docs/guide/existing-products.md): preserve the current Project/history, reconcile contracts and baseline, then continue from the evidence-backed phase instead of repeating bootstrap.

## Scope

The kit uses Codex desktop tasks/worktrees and native GitHub Issues, Project v2, Actions, PRs, sub-issues, and dependencies. It adds no hosted controller, database, webhook service, or required Figma integration. Scheduled local heartbeats require the Codex desktop app and an available checkout.

No live GitHub pilot, Issue, branch, or PR is created by repository tests. The dogfood pilot requires a separate human approval.
