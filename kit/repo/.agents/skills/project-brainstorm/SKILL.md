---
name: project-brainstorm
description: Turn a rough product idea, brainstorm, or initial prompt into a reviewable Canonical Brief Packet and docs/product/canonical.md contract without creating GitHub backlog. Use for new-project Discovery, MVP definition, audience and problem framing, scope and non-goals, product acceptance, design inputs, architecture constraints, risks, and release criteria.
---

# Project Brainstorm

Create the product contract that planning can safely consume. Do not create Issues, Project items, branches, or implementation tasks.

## Workflow

1. Read existing product notes, repository documentation, design references, and constraints.
2. Separate known facts, assumptions, open decisions, and rejected alternatives.
   Cite the source of known facts. If a source cannot be inspected, mark the claim `unknown`; do not reconstruct it from memory or a filename.
3. Resolve only questions that materially change audience, scope, acceptance, risk, or phase order. Make safe reversible assumptions explicit.
4. Define the smallest coherent MVP as user-visible outcomes, not a feature inventory.
5. Capture non-goals and release criteria strongly enough to resist scope creep.
6. Describe required design inputs and architecture constraints without prematurely choosing implementation details.
7. Produce the packet defined in [references/canonical-brief-packet.md](references/canonical-brief-packet.md).
8. Ask the human to approve the Canonical Brief before Planner handoff.

## Boundaries

- Keep Discovery independent from backlog creation.
- Mark security, data, migration, legal, billing, and irreversible decisions as human gates.
- Treat Figma as optional. Accept links, screenshots, prototypes, or written flows as design evidence.
- Do not claim product acceptance from tests alone; name the observable user outcome.
- Do not hand off while material product decisions remain disguised as assumptions.
- Do not report a document edit or approval as complete unless the write/approval is externally recorded and verified. Draft output in chat remains proposed.

## Output

Return:

1. `Canonical Brief Packet v2` in YAML.
2. A complete draft of `docs/product/canonical.md`.
3. A short approval checklist containing only unresolved human decisions.
4. `Planner handoff: READY` or `BLOCKED` with reasons.
