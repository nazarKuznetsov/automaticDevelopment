# Codex Lifecycle Workflow v2

GitHub Issues, native sub-issues/dependencies, Project v2, PRs, Actions, and comments are the durable ledger. Codex tasks and worktrees are execution surfaces, not state storage.

Read `docs/product/canonical.md`, `.codex/agent-workflow.json`, and `docs/guide/quickstart.md` before workflow actions.

## Lifecycle and authority

Phases are Discovery, Planning, Design, Foundation, MVP, Stabilization, Production, and Growth. Non-UI Foundation may overlap Design, but no MVP UI leaf becomes Ready before the Design Readiness gate passes.

Humans approve the Canonical Brief, global roadmap, every phase entry/exit, high-risk decisions, and every merge. Low/Medium leaf work inside an approved phase may run autonomously.

## Roles

- `$project-brainstorm` creates the Canonical Brief and no backlog.
- `$github-project-planner` plans all phases and only the current executable wave.
- `$github-agent-orchestrator` executes approved Ready work and triages Finding Packets.
- `$github-agent-worker` delivers one leaf Issue with TDD and independent evidence.
- `$github-pre-pr-reviewer` independently decides admission for one exact SHA.

Use project agents `planner`, `reviewer`, `qa`, `security-reviewer`, and `design-reviewer` only within their declared boundaries.

## Evidence and truthfulness

- Label material statements as observed, inferred, planned, or unknown when the distinction is not obvious.
- Never invent repository state, tool availability, model availability, commands, test results, approvals, URLs, IDs, SHAs, task/worktree creation, or GitHub mutations.
- A write is complete only after the tool returns a canonical identifier and a read-after-write check confirms the intended state. Until then, report it as planned or failed.
- A capability is available only when its tool is present and a non-mutating probe succeeds. Owner type, documentation, or memory alone is not proof that Issue Types, merge queue, task creation, worktrees, scheduling, or another optional feature is enabled.
- `Independent` means a distinct agent task/thread or a named human who inspects the exact SHA. The Worker cannot role-play its own reviewer or QA.
- Evidence must be traceable to an exact command/result, GitHub URL/ID, artifact, or human decision. Agent-authored prose is not proof of an external event.
- When verification is impossible, fail closed with `unknown` or `blocked` and use the documented fallback; never fill a gap with a plausible value.

## GitHub model

Hierarchy is at most `Epic → Capability/Module → Deliverable → Task/Bug`. In the portable Work Type field, `Capability` also represents Module, while `Task` represents either a parent Deliverable or a leaf Task. Native sub-issue state—not the word “Task”—decides whether work is a leaf. Only a leaf Issue sized XS–M may have `agent-ready`, a Worker, branch, or PR. Native sub-issues and dependencies are authoritative.

Leaf state is `Backlog → Ready → In Progress → Validation → Review → Done`. `Blocked` is reachable from active states; `Canceled` is terminal. Review requires an existing PR; PR creation requires Validation PASS.

Project fields and values come from `.codex/agent-workflow.json`. Use Work Type as the portable fallback even when organization Issue Types exist.

## Execution

- Keep no more than two write Workers active.
- Use one top-level Codex task and managed worktree per leaf Issue when available.
- Use one `agent/<issue>-<slug>` branch and one PR per Issue.
- Allow only bounded read-heavy subagents inside a Worker.
- If worktree/task isolation is unavailable, run one write Worker; keep reviewers read-only.
- Stop launching after five Workers and complete audited handoff before retiring.
- Run a 20-minute heartbeat only while executable work is active.

## TDD and findings

Use RED → GREEN → refactor for behavior. Only docs/config work with unchanged behavior may use a recorded exemption.

Workers never create Issues. They return a Finding Packet. Orchestrator deduplicates, returns in-scope fixes, creates proven independent Low/Medium Bug sub-issues, and escalates High/security/data/migration/product ambiguity to a human.

## Pre-PR admission

No PR creation tool may run until all acceptance, TDD/exemption, targeted/full local validation, independent reviewer/QA, conditional design/security review, branch CI for current SHA, dependency, baseline, documentation, rollout, and human-gate checks pass.

Run `.codex/scripts/pre-pr-gate.mjs --evidence <json>`. The generated marker is commit-bound and must remain untracked. Codex PreToolUse hooks are defense-in-depth, not the sole enforcement boundary.

After a new commit, prior admission is invalid. After post-PR failure or requested changes, convert the PR to Draft, return the Issue to In Progress, and reuse the same branch/PR. Never merge automatically.

After two failed attempts on one signal, change approach or add a specialist. On the third repetition, set Blocked and request human action.

## Safety

Never expose secrets or weaken auth/validation. Require explicit human approval for deploy/release, production data, destructive operations, billing, secrets, migrations, auth/permissions/public API changes, production dependencies, and other high-risk work.
