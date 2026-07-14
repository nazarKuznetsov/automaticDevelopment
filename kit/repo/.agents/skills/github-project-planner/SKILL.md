---
name: github-project-planner
description: Plan an approved product as an eight-phase lifecycle roadmap and a rolling wave of PR-sized GitHub leaf Issues with stable plan_item_id values, native hierarchy/dependencies, owner layers, conflict keys, validation, and human gates. Use in a fresh read-only task for initial planning or in a new Continuation Planner task for each later wave; never implement code, estimate hours, or mutate GitHub.
---

# GitHub Project Planner

Plan Issues, not hours. Work in a fresh read-only Planner task. Read `AGENTS.md`, `docs/product/canonical.md`, `.codex/agent-workflow.json`, repository architecture, validation commands, Design Readiness evidence, and durable GitHub state.

## Modes

- Initial: describe Discovery through Growth, detail only the current phase, and keep the next phase at draft Capability/dependency level.
- Continuation: reconstruct current state from GitHub and canonical contracts in a fresh task. Do not depend on a prior chat, recreate completed work, or backfill decorative history.

Stop affected conclusions when inputs cannot be inspected. Require approved Canonical Brief and phase entry before proposing an executable wave.

## Plan

1. Define outcomes, Epics, risks, dependencies, entry criteria, and exit criteria for all eight phases.
2. Use at most `Epic → Capability/Module → Deliverable → Task/Bug`. Native sub-issues determine leaf status.
3. Assign every item a stable, semantic `plan_item_id`; retain it through materialization and later waves.
4. Select at most five Ready candidates sized XS–M. Decompose L/XL work first.
5. Apply the merge-unit rubric in [references/roadmap-packets.md](references/roadmap-packets.md). Every candidate must be independently acceptable as one Issue, one Worker task, one branch, and one PR.
6. Declare one owner layer, conservative `conflict_keys`, expected touch points, dependencies, integration order, exact targeted/full/integration validation, conditional reviewers, human gates, and out-of-scope.
7. Serialize work that shares an unstable owner surface. Never manufacture parallelism by omitting a conflict key.
8. Use Work Type as the portable fallback. Treat organization Issue Types and merge queue as optional until probed.
9. Return Global Roadmap and Phase Plan packets as proposed writes with a revision.
10. Request human approval of the exact revision. Do not label anything `agent-ready` and do not mutate GitHub.

## Boundaries

- Do not estimate dates or hours; use Priority, Size, Risk, Iteration, dependencies, and integration order.
- Do not invent product work outside the Canonical Brief or speculative Bug Issues.
- Do not claim a model ranking or capability unless the current client exposes and verifies it.
- Planner approval authorizes Orchestrator to materialize the packet exactly; it does not authorize content changes.

Return the roadmap, current Phase Plan, deferred/draft work, known unknowns, and explicit approval points.
