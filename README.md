# Codex Automation Guide v2.1

Lifecycle-driven, GitHub-native development for Codex: Canonical Brief → approved roadmap → one Wave Authority Lease → monotonic/resumable execution horizon → ownership-routed Workers → risk-tiered admission and merge → merge-commit-bound Done.

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

The installer uses `kit/manifest.json` and a provenance-bound `.codex/kit-lock.json` v3. It records the exact kit source repository/commit separately from the installation target, rejects dirty source content and target identity drift, and never copies Git metadata. Host-owned files require an explicit path-scoped `--accept-host`; managed changes route back to the recorded kit source instead of becoming target overrides. See [INSTALL.md](INSTALL.md).

Repositories that already used workflow v1 should follow the canonical [Existing Products migration](kit/repo/docs/guide/existing-products.md): preserve the current Project/history, reconcile contracts and baseline, then continue from the evidence-backed phase instead of repeating bootstrap.

## Scope

The kit uses one fresh Orchestrator task per wave and one fresh top-level managed-worktree Worker task per Ready leaf Issue. Only the current execution horizon is materialized. `solo_fast`, `team_safe`, and `regulated` profiles keep human gates proportional to risk while one durable authority lease covers routine scoped GitHub writes and retries. The kit adds no hosted controller, database, webhook service, required Figma integration, or pinned model slug.

No live GitHub pilot, Issue, branch, or PR is created by repository tests. The dogfood pilot requires a separate human approval.
