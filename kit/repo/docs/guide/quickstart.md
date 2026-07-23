---
title: Quickstart
description: Install workflow schema v2 and start the first approved fresh-task wave.
order: 1
slug: quickstart
---

# Quickstart

The execution unit is one independently acceptable Ready leaf Issue: one fresh Worker task, one managed worktree, one branch, and one PR. The full task topology is defined once in [Orchestration](orchestration.md).

If this repository already used workflow v1 or already has a product/backlog, follow [Existing Products](existing-products.md) instead of repeating Discovery.

## 1. Verify the installation

Installation commands belong to the verified kit source checkout, not to this target repository. Read `.codex/kit-lock.json` after installation and verify that `kit.source_repository`/`kit.source_commit` and `target.repository` identify different, intended repositories. The installer must have printed the same `Kit source` and `Installation target`.

Use the source `INSTALL.md` for apply/upgrade commands. Existing `AGENTS.md`, templates, workflows, hooks config, product contract, and workflow config are host-owned. Managed files remain source-owned; a required managed change routes to the lock-recorded source and returns through an exact-source upgrade.

## 2. Configure and verify

Edit `.codex/agent-workflow.json`:

1. Set repository, owner type, Project owner/number, default branch, `automation_profile`, and `managed_change_policy`. Keep `merge.mode: profile_risk_then_orchestrator`; its enabled Low-risk capability is exercised only by `solo_fast` Low after full PASS.
2. Add real targeted, full, integration, and optional visual commands.
3. Verify commands locally, then set `configured` to `true`.
4. Create Project fields/labels, branch CI, and ruleset checks.
5. Review and trust project-local hooks through `/hooks`; hooks are defense-in-depth.
6. Save the repository as a Codex project and verify fresh top-level task plus managed-worktree creation at runtime. Do not store device project IDs or local worktree paths in configuration.

## 3. Approve product and plan

Run `$project-brainstorm` in a separate read-only task and approve the exact Canonical Brief revision. Then run `$github-project-planner` in a fresh read-only task. Planner describes all phases, details only the current wave, plans Issues rather than hours, and makes no GitHub writes.

After approving both exact packet revisions/digests, approve one Wave Authority Lease and create a fresh top-level Orchestrator task. The Start Packet binds the target repository, exact plan items, lease, and capability envelope. Orchestrator validates identity and ownership before writes, materializes only the current execution horizon, persists a resumable operation journal, and launches the first eligible Worker in the same session. A retry reuses the lease and completed operation IDs; it does not return to Planning.

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

The live dogfood is a separate approved pilot, never an installer side effect. It must prove source/target separation, ownership routing, resumable materialization, profile-appropriate review, and post-merge CI before Done/archive.
