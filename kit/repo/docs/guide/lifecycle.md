---
title: Lifecycle
description: Phase order, entry and exit gates, and what humans approve.
order: 2
slug: lifecycle
---

# Product lifecycle

The lifecycle prevents an agent from treating “write code” as the first product decision.

| Phase | Outcome | Entry gate | Exit evidence |
| --- | --- | --- | --- |
| Discovery | Approved problem, audience, MVP, non-goals, quality bar | Product owner available | Canonical Brief approved |
| Planning | Global roadmap, boundaries, risks, hierarchy | Brief approved | Roadmap and current phase approved |
| Design | Complete MVP UX/UI contract | Flows and product acceptance known | Design Readiness PASS |
| Foundation | CI, architecture skeleton, tokens, test infrastructure | Technical boundaries approved | Foundation checks green |
| MVP | Complete vertical user scenarios | Design gate passed for UI work | MVP acceptance and bug threshold met |
| Stabilization | Regression, QA, performance/security baseline | MVP feature scope frozen | Phase Exit Report PASS |
| Production | Observability, runbooks, release readiness | Operational owner identified | Human release approval |
| Growth | Evidence-based next outcomes | Production feedback available | Next approved rolling wave |

Non-UI Foundation may proceed in parallel with Design when it cannot constrain an unapproved user flow. MVP UI work stays Backlog until Design Readiness passes.

## Human control points

Humans approve the Canonical Brief, global roadmap, phase entry, phase exit, high-risk/security/data/migration/product decisions, release/deploy, and every merge. Routine Low/Medium XS–M leaf Issues inside an approved phase run autonomously.

Phase approval is evidence, not a meeting. Record the approved revision, approver, timestamp, entry/exit criteria, accepted risks, and next phase in GitHub or the relevant packet.

## Phase exit

The Orchestrator drains active Workers before phase exit. Planner produces a Phase Exit Report from merged work, open Bugs, validation evidence, design/operational checks, and unresolved risks. Failed criteria create approved follow-up work or keep the phase open; they are never hidden by advancing the Project field.
