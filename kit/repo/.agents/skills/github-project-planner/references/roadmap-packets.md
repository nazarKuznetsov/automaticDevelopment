# Roadmap and Phase Plan Packets v2

## Global Roadmap Packet

```yaml
schema_version: 2
packet_type: global_roadmap
canonical_brief_revision: ""
current_phase: ""
phases:
  - phase: Discovery
    outcomes: []
    epics: []
    dependencies: []
    risks: []
    entry_criteria: []
    exit_criteria: []
human_approvals:
  roadmap: pending
  current_phase_entry: pending
```

Include all phases through Growth. Only the current phase may contain executable leaf detail; the next phase may contain draft Capabilities; later phases remain outcome/Epic level.

## Phase Plan Packet

```yaml
schema_version: 2
packet_type: phase_plan
phase: ""
iteration: ""
hierarchy: []
dependencies: []
ready_wave:
  - issue_ref: ""
    work_type: Task
    priority: P1
    size: S
    risk: Medium
    qa_required: Yes
    acceptance: []
    validation: []
deferred: []
phase_exit_evidence: []
```

Limit `ready_wave` to five leaf Issues. Valid executable sizes are XS, S, and M.
