---
name: github-project-planner
description: Convert an approved Canonical Brief into a lifecycle roadmap, GitHub Epic hierarchy, phase dependencies, and a rolling wave of executable leaf Issues. Use for initial project planning, phase-entry planning, continuation planning, backlog decomposition, or Growth waves. Do not use to implement tasks or invent product scope outside the approved brief.
---

# GitHub Project Planner

Plan globally and detail only the current horizon. Describe every lifecycle phase and Epic, but expand only the current phase into executable Issues. “Plan” never means `git commit` or GitHub mutation.

## Inputs

Read `docs/product/canonical.md`, `.codex/agent-workflow.json`, repository architecture and validation commands, design evidence, current GitHub Project state, open Issues, recently closed Issues, and merged PRs.

Treat each input as observed only after reading it. If Project, Issue, PR, model-catalog, or repository data cannot be queried, mark that input unknown and stop the affected conclusion instead of inventing state.

Require human approval for the Canonical Brief before initial planning and for phase entry before materializing a new phase wave.

## Workflow

1. Verify the product contract is approved and internally consistent.
2. Build all eight phases: Discovery, Planning, Design, Foundation, MVP, Stabilization, Production, Growth.
3. Define Epics, outcomes, risks, exit criteria, and cross-phase dependencies for every phase.
4. Detail the current phase as `Epic → Capability/Module → Deliverable → Task/Bug`, with at most four levels. In Work Type, use Capability for Module and Task for either a parent Deliverable or a leaf Task; native sub-issues determine leaf status.
5. Keep the next phase at draft Capability/dependency level and later phases at roadmap level.
6. Select at most five unblocked leaf Issues for the current wave.
7. Refuse `agent-ready` for any parent, unresolved dependency, or Size L/XL Issue. Decompose L/XL work first.
8. Preserve native GitHub sub-issues and dependencies as hierarchy/blocking truth. Use comments only to explain them.
9. Produce packets from [references/roadmap-packets.md](references/roadmap-packets.md).
10. Request human approval for the global roadmap and phase entry before GitHub mutation.
11. In continuation mode, infer the current phase from approved evidence, summarize completed phases, and never recreate completed work or backfill historical Issues merely to make the hierarchy look complete.

## Planning Rules

- Express tasks as observable outcomes with acceptance and validation, not agent instructions alone.
- Make independent Issues PR-sized and ownership-safe.
- Identify design/security/QA reviewer requirements before Ready.
- Use organization Issue Types and merge queue only when available; always populate `Work Type` as the portable fallback.
- Do not create speculative bug Issues. Bugs enter through proven Finding Packets or human reports.
- When continuing, re-plan from durable GitHub state instead of replaying the original roadmap.
- Do not claim that a model is strongest or available unless the current client exposes a model catalog that was inspected. Model choice is a user/client setting, not a planning fact.

## Output

Return the Global Roadmap Packet, current Phase Plan Packet, Project field setup/mapping, proposed hierarchy/dependencies, wave selection, and explicit human approval points. Mark each proposed write as `planned`, not completed, until the mutation returns a canonical ID/URL and a read-after-write check verifies hierarchy, dependency, fields, and status.
