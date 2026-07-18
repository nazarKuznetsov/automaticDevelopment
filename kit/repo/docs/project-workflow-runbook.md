# Project workflow runbook

This host-owned file records repository facts that the managed guide must not guess. Replace each angle-bracket value with verified readback before enabling autonomous GitHub writes.

## Repository

- Repository: `<repository>`
- Default branch: `<default-branch>`
- Owner type: `<personal-or-organization>`
- GitHub Project owner/number: `<project-owner>` / `<project-number>`
- Saved Codex project: `<saved-project-name>`

The machine-readable values belong in `.codex/agent-workflow.json`. Keep this runbook aligned with that file and record the evidence source for every changed value.

## Validation and protections

- Targeted commands: `<commands>`
- Full commands: `<commands>`
- Integration commands: `<commands>`
- Visual commands or explicit not-configured reason: `<commands-or-reason>`
- Branch CI workflow: `<workflow-file>`
- Observed required check names: `<check-names-from-successful-runs>`
- Ruleset readback: `<ruleset-url-or-not-configured>`

Never invent a check name from a workflow or job title. Record the name only after a successful GitHub check-run readback.

## Optional exact admission authorities

Leave the matching `.codex/agent-workflow.json` value `null` unless the human has approved the exact repository, branch, base SHA, revision, and scope.

### One-time control-plane bootstrap

- Authority: `one-time-automated-control-plane-bootstrap`
- Repository/branch/base SHA: `<repository>` / `<agent-bootstrap-branch>` / `<full-base-sha>`
- Canonical revision: `<canonical-revision>`
- Human approval source: `<source>`
- Lifecycle state: `<unused-consumed-or-retired>`

### Canonical Brief publication

- Authority: `human-approved-canonical-publication`
- Repository/branch/base binding: `<repository>` / `<agent-canonical-branch>` / `authoritative-origin-default-branch-at-launch`
- Canonical revision and superseded revision: `<new-revision>` / `<previous-revision>`
- Approved by/source: `<identity>` / `<codex-task-id>`
- Allowed paths and SHA-256 hashes: `<path-hash-map>`
- Exact supersession text: `<text>`
- Lifecycle state: `<unused-consumed-or-retired>`

Both authorities are narrow exceptions to Issue-based execution. They authorize at most one Draft PR creation for the admitted exact target; they do not authorize merge, product work, Issue materialization, or reuse after a SHA/base/config change.

## Human gates and operational notes

- Current approved phase/wave: `<phase-and-wave>`
- Open high-risk decisions: `<links-or-none>`
- Current Orchestrator task and heartbeat: `<task-id-and-schedule-id-or-none>`
- Migration or rollout constraints: `<constraints-or-none>`
- Known baseline Bugs: `<issue-links-or-none>`
