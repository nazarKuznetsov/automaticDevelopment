# Roadmap and Phase Plan Packets v2

## Machine-first output

Return strict JSON objects that conform to
`.codex/schemas/v2/global-roadmap.schema.json` and
`.codex/schemas/v2/phase-plan.schema.json`. Human-readable prose is secondary
and cannot replace either packet.

Compute `packet_digest` with the exported `packetDigest` helper. It canonicalizes
object keys and excludes every `packet_digest`, `approval`, and
`human_approvals` field, so human approval metadata can change without changing
planned content. Human approval names both revisions and both digests.

Run `validatePlanContracts(contracts, { require_approval: false })` before
returning a proposal. After approval, Orchestrator runs the same validator with
`require_approval: true`.

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

Include all eight phases through Growth in canonical order. Every dependency is
an object with exact `blocking` and `blocked` plan IDs. Every Epic has complete
Project metadata even when it stays Backlog. Only the current phase contains
executable leaves; the next phase may contain draft Capabilities; later phases
remain outcome/Epic level.

Do not copy a partial example into the packet. Construct the complete JSON
object directly from `global-roadmap.schema.json`, compute its digest, then run
the validator. The human approval must name the exact roadmap revision/digest
and the exact current phase; an approval without `approved_by` is not valid for
materialization.

## Phase Plan Packet

Every Ready leaf must also appear in `hierarchy` with a real parent and target
Status `Ready`; no other hierarchy item may target Ready. Duplicate IDs join
hierarchy metadata to the executable merge unit. Every merge-unit dependency
must also exist in the typed top-level dependency array. Human approval changes
only approval metadata. Orchestrator materializes the digest-bound revision
exactly and publishes the report on the selected parent Issue.

An empty `ready_wave` is valid when the current approved work is
roadmap/materialization only. In that case the Start Packet must use
`materialization_only`, authorize the exact complete materialization item set,
and grant no Worker authority. A non-empty `ready_wave` requires
`wave_execution`, one to five exact Ready leaves, and matching conflict keys.

Do not invent a report destination after Issues are created. Select
`materialization_report_parent_plan_item_id` from the Phase Plan hierarchy
before approval. Do not return YAML or an illustrative fragment as the machine
packet: the deliverable is the complete schema-valid JSON object.
