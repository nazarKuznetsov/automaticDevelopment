---
title: Planning
description: Stable plan IDs, merge-unit Issue planning, rolling waves, and exact materialization.
order: 3
slug: planning
---

# Planning and rolling waves

Planner is read-only and plans Issues, not hours. Initial planning and every continuation wave use fresh tasks; each reconstructs context from canonical contracts, current code, and GitHub instead of inheriting chat history.

Do not pin model slugs. Use high reasoning for Planner, but treat model availability as unknown unless the current client exposes a verified catalog.

## Horizon

- All eight phases have outcomes, Epics, dependencies, risks, entry criteria, and exit criteria.
- The current phase has executable hierarchy and at most five Ready candidates.
- The next phase has draft Capabilities/dependencies.
- Later phases remain roadmap-level until evidence improves.

Use at most `Epic → Capability/Module → Deliverable → Task/Bug`. Only native leaf status permits execution. L/XL work is decomposed before `agent-ready`.

## Stable IDs and merge units

Every item receives a stable semantic `plan_item_id`, such as `mvp.reporting.export-csv`, before a GitHub number exists. Preserve it across continuation planning and materialization. Every roadmap Epic and every Phase Plan hierarchy item also contains its exact future Issue title and complete Phase, Work Type, Priority, Size, Risk, QA Required, and target Status values; the Orchestrator must never infer them from prose.

Every Ready candidate must define:

- one independently acceptable merge outcome and primary signal;
- three to five acceptance criteria;
- one owner layer, conservative `conflict_keys`, and expected touch points;
- native dependencies and integration order;
- exact targeted, full, and integration validation;
- reviewer, QA, admission-reviewer, and conditional design/security/high-risk review;
- human gates and explicit out-of-scope.

The Ready leaf must also appear in the Phase Plan hierarchy with its `parent_plan_item_id`, and every native blocker must be observed resolved. A leaf listed only in `ready_wave`, or still blocked, is invalid and must not receive `agent-ready`.

Two candidates that share an unstable owner surface are serialized. Worktrees isolate files; they do not make overlapping contracts safe to edit concurrently.

## Approval and materialization

Planner returns complete strict-JSON Global Roadmap and Phase Plan packets. Both carry a revision and a deterministic SHA-256 digest computed by `.codex/scripts/workflow-contract.mjs`; approval binds the exact revisions, digests, named human, and current phase. Before requesting approval, Planner must run `validatePlanContracts(contracts, { require_approval: false })`. A validator failure is a planning failure, not a field for Orchestrator to guess.

Human approval authorizes Orchestrator to reproduce the approved content exactly; it does not authorize scope repair. The Orchestrator Start Packet names approved `plan_item_id` values before Issue numbers exist. Materialization order is Issues top-down, native sub-issues, native dependencies, Project items/fields, read-after-write, stable-ID mapping, durable report comment, then `agent-ready` only for a non-empty approved Ready wave. PASS requires exact mapping and Project field readback for every item plus exact hierarchy/dependency/Ready readback where those sets are non-empty. If native relationship mutation is unavailable, stop with Human Action Required; a comment is not a fallback relationship.

If an approved packet is incomplete or fails the current schema, do not patch it in the Orchestrator chat. Run a fresh read-only Planner in Repair mode, preserve accepted outcomes and stable IDs, issue new revisions/digests, validate them, and request a new exact approval.

## Global Planner prompt — EN

```text
Use $github-project-planner in a fresh read-only Planner task for <owner/repo>.
Read the approved Canonical Brief revision, repository architecture and validation, design evidence, and durable GitHub state. Plan Issues, not hours. Describe Discovery through Growth, detail only the current executable phase, keep the next phase at draft Capability level, and later phases at roadmap level. Assign stable plan_item_id values and exact Issue title plus all required Project fields to every materialized item. Express dependencies only as typed blocking/blocked IDs and select a durable report parent from the Phase Plan hierarchy. For each Ready candidate include one merge outcome, primary signal, 3–5 acceptance criteria, owner layer, conflict_keys, touch points, dependencies/integration order, targeted/full/integration validation, conditional reviewers, human gates, and out-of-scope. Return complete strict-JSON Global Roadmap and Phase Plan packets with revisions/digests and a zero-blocker validatePlanContracts result. Do not mutate GitHub.
```

## Промпт Global Planner — RU

```text
Используй $github-project-planner в новой read-only Planner task для <owner/repo>.
Прочитай утверждённую ревизию Canonical Brief, архитектуру и validation репозитория, design evidence и durable GitHub state. Планируй Issues, не часы. Опиши Discovery–Growth, детализируй только текущую исполняемую фазу, следующую оставь на уровне draft Capability, дальние — roadmap-level. Назначь стабильные plan_item_id, точный Issue title и все обязательные Project fields каждому материализуемому элементу. Задавай зависимости только типизированными blocking/blocked IDs и выбери durable report parent из иерархии Phase Plan. Для каждого Ready-кандидата укажи один merge outcome, primary signal, 3–5 acceptance criteria, owner layer, conflict_keys, touch points, dependencies/integration order, targeted/full/integration validation, conditional reviewers, human gates и out-of-scope. Верни полные strict-JSON Global Roadmap и Phase Plan packets с revisions/digests и нулём blockers от validatePlanContracts. Не изменяй GitHub.
```

## Continuation Planner prompt — EN

```text
Use $github-project-planner in continuation mode in a fresh read-only task for <owner/repo>.
Reconstruct state from the approved canonical contracts, current Project, open/recently closed Issues, merged/open PRs, completion/phase reports, baseline, and latest accepted handoff. Do not copy a prior Planner chat, repeat bootstrap, recreate completed work, or mutate GitHub. Preserve stable plan_item_id values, infer the current phase only from evidence, and return complete strict-JSON Global Roadmap and Phase Plan revisions/digests with at most five complete XS–M merge units, deferred/draft work, a zero-blocker validatePlanContracts result, and required exact approval.
```

## Промпт Continuation Planner — RU

```text
Используй $github-project-planner в continuation mode в новой read-only task для <owner/repo>.
Восстанови состояние из утверждённых canonical contracts, текущего Project, открытых/недавно закрытых Issues, merged/open PRs, completion/phase reports, baseline и последнего принятого handoff. Не копируй прошлый Planner chat, не повторяй bootstrap, не пересоздавай завершённую работу и не изменяй GitHub. Сохрани стабильные plan_item_id, определяй текущую фазу только по evidence и верни полные strict-JSON ревизии/digests Global Roadmap и Phase Plan максимум с пятью полными XS–M merge units, deferred/draft work, нулём blockers от validatePlanContracts и необходимым точным утверждением.
```
