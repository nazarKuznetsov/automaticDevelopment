# Worker runtime packets v2

## Surface Update

Return before tracked writes when reality exceeds the Worker Packet:

```yaml
schema_version: 2
packet_type: surface_update
source_task_id: task-id
issue: 123
base_sha_at_launch: full-sha
observed_owner_layer: request-contract
added_conflict_keys: [request-contract]
added_touch_points: [api-schema]
write_started: false
evidence: []
```

## Finding Packet

```yaml
schema_version: 2
packet_type: finding
source_task_id: task-id
source_issue: 123
commit_sha: full-sha
summary: Observed failure
reproduction: []
failure_signature: check-id:normalized-message
severity: Low
within_scope: false
affects_acceptance: false
affected_acceptance_ids: []
security: false
data_risk: false
migration_risk: false
product_ambiguity: false
evidence: []
duplicate_search_evidence:
  query: normalized terms
  lookback_days: 90
  matches: []
suggested_boundary: Separate Bug
```

Do not publish empty placeholder values. The Worker may propose duplicate-search terms, but Orchestrator performs and records the authoritative GitHub search.

## Minimal review context

Pass each fresh reviewer only:

- raw Issue and Worker Packet;
- exact base/head SHA and diff;
- configured validation and raw results;
- branch CI URL/evidence;
- relevant source and tests.

Do not pass Worker conclusions or full Orchestrator/roadmap history. Run at most two direct subagents simultaneously and never allow depth greater than one.

## Freshness

Before PR:

1. compare current default branch to the last `validated_base_sha` (initially `base_sha_at_launch`);
2. synchronize if changed and record the new `validated_base_sha` without rewriting launch provenance;
3. rerun targeted/full/integration validation;
4. push and obtain branch CI for new HEAD;
5. rerun reviewer, QA, conditional specialists, and admission;
6. verify tracked status before/after QA is empty.

Every new commit invalidates prior evidence. Do not copy a PASS forward.
