---
title: Planning
description: Global roadmap, Issue hierarchy, rolling waves, and decomposition rules.
order: 3
slug: planning
---

# Planning and rolling waves

`$github-project-planner` owns planning; Orchestrator owns execution. Keeping those responsibilities separate stops delivery agents from inventing product work when a queue is empty.

Run the read-only `planner` custom agent with high reasoning effort. The kit deliberately does not pin a model slug that may become stale. If the current client exposes an inspectable model catalog, Planner may report a stronger planning option and let the human choose; otherwise it must say model availability is unverified and continue without inventing a ranking.

## Detail by horizon

- Every phase has outcomes, Epics, dependencies, risks, entry criteria, and exit criteria.
- The current phase has executable hierarchy and acceptance-ready leaf Issues.
- The next phase has draft Capabilities and cross-phase dependencies.
- Later phases remain roadmap-level and are refined only when evidence improves.

The current wave contains at most five unblocked leaf Issues. Valid executable sizes are XS, S, and M. L/XL work is decomposed before `agent-ready`.

## Hierarchy

Use at most four levels:

```text
Epic → Capability/Module → Deliverable → Task/Bug
```

The portable Work Type field intentionally stays smaller than the structural vocabulary: use `Capability` for a Capability or Module, and `Task` for either a parent Deliverable or a leaf Task. Native sub-issues—not Work Type text—decide whether an Issue is a leaf. Only a leaf may have a Worker, branch, or PR. Use native GitHub sub-issues as hierarchy and native dependencies as blocking truth. A comment may explain a dependency but cannot replace it.

## Issue quality

Each executable Issue defines an observable goal, three to five acceptance checks, primary user/runtime signal, targeted and full validation expectations, scope and non-goals, risk/size/priority, QA, design/security impact, TDD policy, dependencies, owner-layer hints, and human gates.

Tasks should be independently mergeable. If two tasks must change one unstable owner layer concurrently, sequence them with a dependency instead of relying on worktree isolation.

## Continuation planning

When a wave drains, Planner reads the approved brief, current code, open/recent Issues, merged/open PRs, completion reports, phase-exit evidence, and latest handoff. It preserves completed work, updates risks, and proposes the next wave. It summarizes completed phases instead of recreating historical Issues merely to fill the hierarchy. Growth is the same continuation mechanism driven by production evidence, not a new bootstrap.

A wave is complete only when every selected leaf is Done or Canceled with evidence. If remaining leaves are Blocked, the wave is paused, not silently “drained”; Planner may propose independent work only when phase approval, dependencies, and acceptance boundaries allow it, and cannot advance the phase around a blocking criterion.
