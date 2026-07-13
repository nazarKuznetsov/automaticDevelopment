---
title: Quickstart
description: Install workflow schema v2 and create the first approved rolling wave.
order: 1
slug: quickstart
---

# Quickstart

Use v2 in two stages: install files safely, then configure and approve the workflow. The installer never creates live GitHub state.

If the repository already used workflow v1 or already has a product/backlog, follow `docs/guide/existing-products.md` instead of repeating new-project Discovery.

## Install

Clone this guide, preview the exact target changes, and apply only when the merge plan is clean:

```bash
git clone https://github.com/nazarKuznetsov/automaticDevelopment.git
cd automaticDevelopment
scripts/install-kit.sh --target /path/to/target-repo --dry-run
scripts/install-kit.sh --target /path/to/target-repo --apply
```

Use `--upgrade` for a repository with `.codex/kit-lock.json`; `--dry-run` infers whether it is previewing install or upgrade. Existing `AGENTS.md`, templates, and workflows are host-owned: conflicts stop with `MERGE REQUIRED`. Merge each such file manually, then acknowledge the exact preserved path with `--accept-host <path>`. `--force` is upgrade-only and can overwrite only a managed file already recorded by the kit.

## Configure

Edit `.codex/agent-workflow.json`:

1. Set the repository, owner type, Project owner/number, and default branch.
2. Add real targeted, full, and optional visual validation commands.
3. Set `configured` to `true` only after every command is verified locally.
4. Create the documented Project fields/labels and ruleset required checks.
5. Review and trust the project-local [Codex hooks](https://learn.chatgpt.com/docs/hooks) through `/hooks`; hooks are defense-in-depth and project-local hooks do not run in an untrusted project.

Then approve `docs/product/canonical.md`, run `$github-project-planner`, and approve the global roadmap plus current phase entry. Only then run `$github-agent-orchestrator`.

## New project prompt — EN

```text
Use $project-brainstorm. We are starting a new project under Codex Automation Guide v2.
Target repository: <owner/repo>
Idea: <idea>
Do not create backlog or change code. Produce Canonical Brief Packet v2, a complete docs/product/canonical.md draft, material open decisions, and an approval checklist. Treat Figma as optional and mark security/data/migration/product ambiguity as human gates.
```

## Промпт нового проекта — RU

```text
Используй $project-brainstorm. Мы начинаем новый проект по Codex Automation Guide v2.
Целевой репозиторий: <owner/repo>
Идея: <идея>
Не создавай backlog и не меняй код. Подготовь Canonical Brief Packet v2, полный черновик docs/product/canonical.md, существенные открытые решения и checklist для утверждения. Считай Figma опциональным и помечай security/data/migration/product ambiguity как human gates.
```

## Continue project prompt — EN

```text
Use $github-project-planner in continuation mode for <owner/repo>. Read the approved canonical brief, current Project, open and recently closed Issues, merged/open PRs, phase-exit reports, and latest handoff. Do not repeat bootstrap. Return the refreshed global roadmap, next current-phase wave of at most five XS–M Ready leaf Issues, native hierarchy/dependencies, and required phase approval. Do not mutate GitHub until I approve.
```

## Промпт продолжения — RU

```text
Используй $github-project-planner в continuation mode для <owner/repo>. Прочитай утверждённый canonical brief, текущий Project, открытые и недавно закрытые Issues, merged/open PRs, phase-exit reports и последний handoff. Не повторяй bootstrap. Верни обновлённый global roadmap, следующую wave текущей фазы максимум из пяти Ready leaf Issues размера XS–M, native hierarchy/dependencies и необходимое утверждение фазы. Не изменяй GitHub до моего подтверждения.
```

The first live pilot must be a separate human-approved GitHub write: intentionally fail branch CI and verify that no PR is created; fix it, obtain independent review/QA and admission PASS, then verify exactly one PR.
