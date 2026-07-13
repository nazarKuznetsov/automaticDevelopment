---
title: Contracts
description: Canonical files, machine configuration, and versioned packet schemas.
order: 10
slug: contracts
---

# Public contracts

Workflow v2 has three kinds of durable interface.

## Product contract

`docs/product/canonical.md` is human-readable and approved. It defines goal, audience, problem, scenarios, MVP scope/non-goals, design references, architecture constraints, quality bar, risks, release criteria, assumptions, and open decisions.

## Machine contract

`.codex/agent-workflow.json` is versioned, repository-scoped, and secret-free. It contains GitHub/Project metadata, fields, validation commands, branch CI, concurrency, heartbeat, baseline policy, and gates. `configured: false` is fail-closed. Set it true only after live verification.

## Packet schemas

Schemas live in `.codex/schemas/v2/`:

- Canonical Brief;
- Global Roadmap and Phase Plan;
- Design Readiness;
- Worker;
- Finding;
- Pre-PR Admission;
- Worker Completion;
- Phase Exit;
- Human Action Required.

Packets include `schema_version: 2` and a fixed `packet_type`. Store orchestration evidence in Issue/PR comments or GitHub fields. Local admission markers and temporary evidence belong under the Git directory or scratch storage and must not be committed.

## Evidence semantics

Use four truth states consistently: `observed` (read directly), `inferred` (derived from cited observations), `planned` (not executed), and `unknown` (not verifiable). Do not silently promote one state to another.

A command, GitHub mutation, task/worktree creation, schedule, approval, or review is complete only when it returns a traceable result—such as an exact command/exit status, canonical URL/ID, commit SHA, run/artifact, or named human decision—and the owning state is read back when mutation is involved. A tool description proves that a capability exists in principle; only a present tool plus a successful probe proves it is available in the current environment.

Independent review cannot be simulated inside the Worker context. It requires a distinct task/thread/agent identifier or a named human, exact SHA binding, and inspectable evidence. If any required fact cannot be verified, the packet says `unknown`, `FAIL`, or `BLOCKED`; plausible filler is invalid evidence.

## Compatibility

Existing skill names `github-agent-orchestrator` and `github-agent-worker` remain stable. Status migration maps `Intake → Backlog`; compatible existing statuses remain. Add fields without deleting existing Project data. Personal repositories use Work Type; organization repositories may additionally use native Issue Types and merge queue only after those repository capabilities are verified.
