# Canonical Brief Packet v2

Use this exact top-level shape. Keep each claim concise and evidence-linked when evidence exists.

```yaml
schema_version: 2
packet_type: canonical_brief
product:
  name: ""
  one_sentence_outcome: ""
audience:
  primary: ""
  excluded: []
problem:
  current_state: ""
  desired_state: ""
  evidence: []
scenarios:
  - actor: ""
    trigger: ""
    outcome: ""
mvp:
  in_scope: []
  non_goals: []
  acceptance: []
design:
  references: []
  required_flows: []
  constraints: []
architecture:
  constraints: []
  integrations: []
quality_bar:
  accessibility: ""
  performance: ""
  security: ""
release_criteria: []
risks: []
assumptions: []
open_decisions: []
human_approval:
  status: pending
  approved_by: null
  approved_at: null
```

The matching `docs/product/canonical.md` must contain Goal, Audience, Problem, Scenarios, MVP Scope, Non-goals, Design References, Architecture Constraints, Quality Bar, Risks, Release Criteria, Assumptions, and Open Decisions.
