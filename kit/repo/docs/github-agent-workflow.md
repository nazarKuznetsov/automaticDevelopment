# GitHub-native Codex Agent Workflow

This guide defines a GitHub-native workflow for running Codex App as an autonomous local Orchestrator over a GitHub repository. GitHub is the runtime ledger. Codex threads and worktrees are execution surfaces.

## Operating Model

The workflow has three long-lived roles and one short-lived delivery role:

- Brainstorm: captures project intent and constraints.
- Planner: audits the repository and writes the Project Intake Packet and GitHub Setup Packet.
- Orchestrator: executes the queue, creates Worker packets, verifies evidence, and manages handoff.
- Worker: delivers one GitHub Issue through one branch and one pull request.

Canonical state lives in:

- GitHub Issues;
- GitHub Project v2 fields;
- labels;
- linked pull requests;
- GitHub Actions checks;
- issue comments used as State Ledger Comments.

Documentation explains the rules. GitHub state decides what is true.

## Required Project Schema

GitHub Project v2 is required.

Fields:

```text
Status: Intake, Ready, In Progress, Review, Blocked, Done
Work Type: Guide, Template, Automation, Site, Docs, Feature, Bug, Refactor
Risk: Low, Medium, High
QA Required: Yes, No
```

Labels:

```text
agent-ready
blocked
qa-required
security-review
design-review
docs
automation
workflow
human-action-required
```

Ready filter:

```text
Project Status = Ready
label:agent-ready
no open blockers
```

## Limits

```text
Max active workers: 2
Max worker launches per Orchestrator: 5
Heartbeat cadence: 20-30 minutes
State ledger: GitHub issue comments
Notification surface: Codex thread + GitHub issue comment
```

The Orchestrator enters `DRAINING` after its fifth Worker launch. It becomes `RETIRED` only after a replacement Orchestrator completes takeover audit and writes `handoff accepted`.

## Human Gates

The Orchestrator can work mostly autonomously, but it must stop for explicit human approval before:

- merge;
- deploy or release;
- secrets, credentials, tokens, or key rotation;
- billing or paid infrastructure changes;
- destructive commands or deletion;
- production data access or modification;
- migrations;
- auth, permissions, public API, or security-sensitive behavior;
- new production dependencies.

When blocked, write `Human action required` with exact commands, URLs, issue bodies, labels, project fields, and the reason automation stopped.

## Data Contracts

### Project Intake Packet

Planner creates this after repository audit. The goal is to ask the human once for missing product and permission context.

```yaml
project_intake_packet:
  project:
    repository: owner/repo
    default_branch: main
    github_project:
      owner:
      number:
      url:
  product:
    goal:
    audience:
    out_of_scope:
    acceptance_criteria:
      - ""
  autonomy:
    mode: mostly_autonomous_with_conservative_human_gates
    allow_orchestrator_to_create_issues: true
    allow_orchestrator_to_create_worker_threads: true
    allow_orchestrator_to_create_branches_and_prs: true
  human_gates:
    - merge
    - deploy
    - secrets
    - billing
    - destructive_ops
    - production_data
    - migrations
    - auth_permissions_public_api
    - production_dependencies
  repository_commands:
    install:
    test:
    lint:
    typecheck:
    build:
  ci:
    provider: github_actions
    required_checks:
      - ""
  notifications:
    codex_thread: true
    github_issue_comments: true
  risks:
    security:
    ui_design:
    data:
    release:
  first_pilot:
    scope: workflow_setup_plus_low_risk_issue
```

### GitHub Setup Packet

Planner returns this. Orchestrator applies it through `gh`, GitHub tools, or the GitHub API.

```yaml
github_setup_packet:
  repo_settings:
    issues: enabled
    actions: enabled
    projects: required
  labels:
    - agent-ready
    - blocked
    - qa-required
    - security-review
    - design-review
    - docs
    - automation
    - workflow
    - human-action-required
  project_fields:
    Status: [Intake, Ready, In Progress, Review, Blocked, Done]
    Work Type: [Guide, Template, Automation, Site, Docs, Feature, Bug, Refactor]
    Risk: [Low, Medium, High]
    QA Required: [Yes, No]
  ready_queue:
    filter: "Project Status = Ready + label:agent-ready + no open blockers"
  template_files:
    - AGENTS.md
    - docs/github-agent-workflow.md
    - .github/ISSUE_TEMPLATE/agent-task.yml
    - .github/ISSUE_TEMPLATE/config.yml
    - .github/pull_request_template.md
    - .github/workflows/readiness-audit.yml
    - .agents/skills/github-agent-orchestrator/SKILL.md
    - .agents/skills/github-agent-worker/SKILL.md
  fallback_commands: true
```

### Agent Task Issue

Every executable task must include:

- Goal;
- Acceptance Criteria;
- Dependency / Blocker State;
- Validation Expectations;
- Security Impact;
- UI / Design Impact;
- QA Requirement;
- Primary Signal;
- Secondary Signals;
- Model / Risk expectation;
- TDD, docs-only, or config-only expectation;
- Graphify or fallback repository tracing requirement.

The issue body is the task contract. Labels and Project fields only route the work.

### State Ledger Comment

The Orchestrator writes or updates a State Ledger Comment before launching a Worker and on every heartbeat.

```md
## State Ledger Comment

Orchestrator: <thread-id-or-name>
Status: ACTIVE | DRAINING | RETIRED
Worker launches: <n>/5
Active workers: <n>/2

Claimed issues:
- #<issue>: claimed by <worker-thread-id>, branch <branch>, PR <url-or-none>, status <state>

Blocked:
- #<issue>: <blocker>; next action <human/orchestrator/planner>

Next action:
- <specific action>
```

### Worker Packet

The Orchestrator generates this for each ready issue.

```yaml
worker_packet:
  issue_number:
  repository: owner/repo
  branch: feat/123-short-slug
  base_branch: main
  scope:
    goal:
    acceptance_criteria:
      - ""
    out_of_scope:
      - ""
  readiness:
    project_status: Ready
    label_agent_ready: true
    blockers: none
  model_router:
    risk: Low
    recommended_model: default_codex_model
    reason:
  validation:
    primary_signal:
    secondary_commands:
      - ""
  evidence_required:
    tdd_red_green_or_exemption: true
    repository_tracing: true
    qa_notes: true
    security_design_notes: true
  human_gates:
    - merge
    - deploy
    - secrets
    - billing
    - destructive_ops
    - production_data
    - migrations
    - auth_permissions_public_api
    - production_dependencies
```

### Handoff YAML

The Orchestrator emits this after five Worker launches or when context risk is high.

```yaml
orchestrator_handoff:
  schema_version: 1
  handoff_reason: task_budget_reached
  previous_orchestrator:
    status: DRAINING
    task_count: 5
    thread_id:
  repo:
    name:
    base_branch:
  github_project:
    ready_filter: "Project Status = Ready + label:agent-ready + no open blockers"
    state_ledger_issue:
  active_workers:
    - issue_number:
      worker_thread_id:
      worktree_path:
      branch:
      pr_url:
      status:
  claimed_issues:
    - issue_number:
      status:
      owner_thread_id:
  blockers:
    - issue_number:
      blocker:
      next_decision_needed:
  next_executable_tasks:
    - issue_number:
      reason_ready:
      recommended_model:
  validation_security_design_risks:
    - issue_number:
      risk:
      required_gate:
  required_human_actions:
    - issue_number:
      action:
      reason:
      exact_command_or_url:
  continuation:
    new_orchestrator_created: yes/no
    new_orchestrator_thread_id:
    continuation_prompt_included: yes
```

The replacement Orchestrator must verify active workers, claimed issues, branches, PRs, blockers, and Project state from GitHub before launching any new Worker.

## Orchestrator Heartbeat

On every heartbeat:

1. Run access checks: `gh auth status`, repository visibility, Project access, issue access.
2. Read Ready Queue and In Progress issues from GitHub Project v2.
3. Read labels, issue bodies, comments, blockers, linked PRs, and GitHub Actions state.
4. Update the State Ledger Comment.
5. Verify existing Worker reports and PR evidence.
6. Move complete work to Review only when evidence is present.
7. Move blocked work to Blocked and add `human-action-required` when needed.
8. Select ready work until active workers reach 2.
9. Write claim state before launching any Worker.
10. Generate the Worker Packet and create or instruct a Worker thread.
11. Stop new launches after the fifth launch and emit Handoff YAML.

## Worker Delivery Loop

Worker must:

1. Read issue body, comments, labels, Project fields, linked PRs, blockers, `AGENTS.md`, and relevant docs.
2. Confirm Ready gate.
3. Create one issue-linked branch in an isolated worktree when available.
4. Run repository tracing before changes.
5. Use TDD RED/GREEN for behavior changes, or document a docs/config-only exemption.
6. Implement the smallest coherent change for the issue.
7. Run required validation.
8. Open one PR with `Closes #<issue-number>`.
9. Fill the PR template with evidence.
10. Post Worker Completion Report to the issue.

## Worker Completion Report

```md
## Worker Completion Report

Issue: #<number>
PR: <url>
Branch: <branch>

Acceptance:
- <criterion>: met/not met + evidence

TDD RED/GREEN:
- RED:
- GREEN:
- Refactor:
- Exemption:

Repository tracing:
- Owner layer:
- Files inspected:
- Contract/API impact:

Validation:
- Primary signal status:
- Secondary signal status:
- Commands:

Security / design:
- Security impact:
- UI/design impact:

QA:
- Evidence:
- Findings resolved:
- Remaining risk:

Human Gates:
- Required before merge/deploy/release:
```

## Human Action Required

Use this exact block when automation stops:

```md
## Human action required

Blocked action:
Reason:
Issue:
Required human decision:
Exact command or URL:
Exact labels / Project fields / issue body:
Safe to continue after:
```

## Setup Validation

The setup is valid when:

- `gh auth status` passes;
- required labels exist;
- required Project fields exist;
- issue form exists;
- PR template exists;
- readiness audit workflow exists;
- repo skills exist;
- one low-risk pilot issue completes the full flow.

