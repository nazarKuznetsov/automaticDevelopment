# Roadmap and Phase Plan Packets v2

## Stable IDs

Use semantic lowercase IDs such as `mvp.reporting.export-csv`. Never derive the durable ID from a future GitHub number. Preserve it across replanning; replace an item with a new ID only when its accepted outcome materially changes.

## Merge-unit rubric

A Ready candidate is valid only when one independently reviewable PR can satisfy it. Require:

- one merge outcome and primary signal;
- three to five observable acceptance criteria;
- one owner layer;
- conservative conflict keys and expected touch points;
- native dependencies and integration order;
- exact targeted, full, and integration validation;
- reviewer, QA, admission-reviewer, and conditional specialists;
- human gates and explicit out-of-scope.

Do not make a task small by omitting a coupled contract. Decompose L/XL work or work with multiple independent outcomes.

## Global Roadmap Packet

```yaml
schema_version: 2
packet_type: global_roadmap
canonical_brief_revision: canonical-r1
current_phase: MVP
phases:
  - phase: Discovery
    outcomes: []
    epics:
      - plan_item_id: discovery.problem-contract
        title: Problem contract
    dependencies: []
    risks: []
    entry_criteria: []
    exit_criteria: []
human_approvals:
  roadmap: pending
  current_phase_entry: pending
```

Include all phases through Growth. Only the current phase contains executable leaves; the next phase may contain draft Capabilities; later phases remain outcome/Epic level.

## Phase Plan Packet

```yaml
schema_version: 2
packet_type: phase_plan
revision: phase-mvp-r3
phase: MVP
iteration: MVP Wave 1
hierarchy:
  - plan_item_id: mvp.reporting
    parent_plan_item_id: null
    title: Reporting
    work_type: Epic
  - plan_item_id: mvp.reporting.export-csv
    parent_plan_item_id: mvp.reporting
    title: Export visible report rows
    work_type: Task
dependencies: []
ready_wave:
  - plan_item_id: mvp.reporting.export-csv
    parent_plan_item_id: mvp.reporting
    title: Export visible report rows
    work_type: Task
    priority: P1
    size: S
    risk: Medium
    qa_required: Yes
    merge_outcome: One PR adds independently acceptable CSV export.
    primary_signal: The downloaded CSV matches the visible report rows.
    acceptance: [criterion-1, criterion-2, criterion-3]
    owner_layer: report-export-service
    conflict_keys: [request-contract, report-export]
    touch_points: [export-route, csv-serializer, export-contract-tests]
    dependencies: []
    integration_order: 1
    validation:
      targeted: [npm test -- export]
      full: [npm test]
      integration: [npm test -- export-integration]
    reviewers: [reviewer, qa, admission-reviewer, design-reviewer]
    human_gates: [exact-sha-merge]
    out_of_scope: [PDF export]
deferred: []
phase_exit_evidence: []
approval:
  status: PROPOSED
  revision: phase-mvp-r3
```

Every Ready leaf must also appear in `hierarchy` with a real parent; duplicate IDs join hierarchy metadata to the executable merge unit. Human approval changes only `approval` metadata. Orchestrator materializes the approved revision exactly and publishes the ID-to-Issue mapping.
