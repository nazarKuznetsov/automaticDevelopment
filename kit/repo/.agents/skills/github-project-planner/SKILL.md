---
name: github-project-planner
description: Plan an approved product as an eight-phase lifecycle roadmap and a schema-valid rolling wave of PR-sized GitHub leaf Issues with stable plan_item_id values, complete Project metadata, native hierarchy/dependencies, packet digests, validation, and human gates. Use in a fresh read-only task for initial planning, packet repair, or a new Continuation Planner task; never implement code, estimate hours, or mutate GitHub.
---

# GitHub Project Planner

Plan Issues, not hours. Work in a fresh read-only Planner task. Read `AGENTS.md`, `docs/product/canonical.md`, `.codex/agent-workflow.json`, repository architecture, validation commands, Design Readiness evidence, and durable GitHub state.

## Modes

- Initial: describe Discovery through Growth, detail only the current phase, and keep the next phase at draft Capability/dependency level.
- Repair: preserve approved product outcomes and stable IDs, but issue new revisions/digests when an earlier packet cannot be materialized. Never silently patch an approved revision.
- Continuation: reconstruct current state from GitHub and canonical contracts in a fresh task. Do not depend on a prior chat, recreate completed work, or backfill decorative history.

Stop affected conclusions when inputs cannot be inspected. Require approved Canonical Brief and phase entry before proposing an executable wave.

## Plan

1. Define outcomes, Epics, risks, dependencies, entry criteria, and exit criteria for all eight phases.
2. Use at most `Epic → Capability/Module → Deliverable → Task/Bug`. Native sub-issues determine leaf status.
3. Assign every item a stable, semantic `plan_item_id`; retain it through materialization and later waves. Give every Global Roadmap Epic and every Phase Plan hierarchy item an exact Issue title plus Phase, Work Type, Priority, Size, Risk, QA Required, and target Status.
4. Select at most five Ready candidates sized XS–M. Decompose L/XL work first.
5. Apply the merge-unit rubric in [references/roadmap-packets.md](references/roadmap-packets.md). Every candidate must be independently acceptable as one Issue, one Worker task, one branch, and one PR.
6. Declare one owner layer, conservative `conflict_keys`, expected touch points, dependencies, integration order, exact targeted/full/integration validation, conditional reviewers, human gates, and out-of-scope.
7. Serialize work that shares an unstable owner surface. Never manufacture parallelism by omitting a conflict key.
8. Use Work Type as the portable fallback. Treat organization Issue Types and merge queue as optional until probed.
9. Express every dependency only as typed `blocking` and `blocked` `plan_item_id` values. Do not use prose gates as dependency identities.
10. Choose one `materialization_report_parent_plan_item_id` from the Phase Plan hierarchy. The Orchestrator publishes the report as a durable comment on that exact Issue.
11. Return strict JSON Global Roadmap and Phase Plan packets, not narrative substitutes. Include exact revisions and SHA-256 packet digests computed over canonical key-sorted JSON with every `packet_digest`, `approval`, and `human_approvals` field omitted.
12. Before returning, use `packetDigest` and `validatePlanContracts(contracts, { require_approval: false })` from `.codex/scripts/workflow-contract.mjs`. A non-empty blocker list is a Planner failure; do not ask for approval.
13. Request human approval bound to both exact revisions and digests. Do not label anything `agent-ready` and do not mutate GitHub.

## Boundaries

- Do not estimate dates or hours; use Priority, Size, Risk, Iteration, dependencies, and integration order.
- Do not invent product work outside the Canonical Brief or speculative Bug Issues.
- Do not claim a model ranking or capability unless the current client exposes and verifies it.
- Planner approval authorizes Orchestrator to change approval metadata only and materialize the digest-bound content exactly; it does not authorize plan changes.

Return the two complete machine packets, a concise human-readable roadmap, deferred/draft work, known unknowns, the validation result, and one approval statement naming both revisions and both digests.
