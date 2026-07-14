---
title: Quickstart
description: Install workflow schema v2 and start the first approved fresh-task wave.
order: 1
slug: quickstart
---

# Quickstart

The execution unit is one independently acceptable Ready leaf Issue: one fresh Worker task, one managed worktree, one branch, and one PR. The full task topology is defined once in [Orchestration](orchestration.md).

If this repository already used workflow v1 or already has a product/backlog, follow [Existing Products](existing-products.md) instead of repeating Discovery.

## 1. Install safely

```bash
git clone https://github.com/nazarKuznetsov/automaticDevelopment.git
cd automaticDevelopment
scripts/install-kit.sh --target /path/to/target-repo --dry-run
scripts/install-kit.sh --target /path/to/target-repo --apply
```

Use `--upgrade` only when `.codex/kit-lock.json` exists. Existing `AGENTS.md`, templates, workflows, hooks config, product contract, and workflow config are host-owned. A collision stops before writes with `MERGE REQUIRED`; merge it manually and acknowledge only that path with `--accept-host <path>`. `--force` is upgrade-only and affects only previously recorded managed files.

## 2. Configure and verify

Edit `.codex/agent-workflow.json`:

1. Set repository, owner type, Project owner/number, and default branch.
2. Add real targeted, full, integration, and optional visual commands.
3. Verify commands locally, then set `configured` to `true`.
4. Create Project fields/labels, branch CI, and ruleset checks.
5. Review and trust project-local hooks through `/hooks`; hooks are defense-in-depth.
6. Save the repository as a Codex project and verify fresh top-level task plus managed-worktree creation at runtime. Do not store device project IDs or local worktree paths in configuration.

## 3. Approve product and plan

Run `$project-brainstorm` in a separate read-only task and approve the exact Canonical Brief revision. Then run `$github-project-planner` in a fresh read-only task. Planner describes all phases, details only the current wave, plans Issues rather than hours, and makes no GitHub writes.

After approving the exact Phase Plan revision, create a fresh top-level Orchestrator task with a Start Packet listing approved `plan_item_id` values—not nonexistent Issue numbers. Orchestrator materializes the approved hierarchy/dependencies/Project fields exactly, reads everything back, publishes `plan_item_id → Issue URL`, and only then applies `agent-ready` to passing leaves.

## New product brainstorm — EN

```text
Use $project-brainstorm in a fresh read-only task. We are starting a product under Codex Automation Guide v2.
Repository: <owner/repo>
Idea and evidence: <idea, links, files>
Do not create backlog, mutate GitHub, or change code. Produce Canonical Brief Packet v2, a complete docs/product/canonical.md draft, material open decisions, and an approval checklist. Treat Figma as optional and mark security/data/migration/product ambiguity as human gates.
```

## Брейншторм нового продукта — RU

```text
Используй $project-brainstorm в новой read-only task. Мы начинаем продукт по Codex Automation Guide v2.
Репозиторий: <owner/repo>
Идея и evidence: <идея, ссылки, файлы>
Не создавай backlog, не изменяй GitHub и код. Подготовь Canonical Brief Packet v2, полный черновик docs/product/canonical.md, существенные открытые решения и checklist для утверждения. Считай Figma опциональным и помечай security/data/migration/product ambiguity как human gates.
```

## 4. Prove the workflow later

The live dogfood is a separate human-approved migration/pilot, never an installer side effect. It must prove that failing branch CI creates zero PRs, fixed code receives distinct reviewer/QA/admission evidence, exact-SHA approval permits one merge, and post-merge CI is required before Done/archive.
