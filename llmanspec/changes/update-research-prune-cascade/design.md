# Design: prune closure B + failed merges

## Decision

**Adopt exclusive-parent cascade (B)** for `prune` on ResearchRun graphs.

| Option | Behavior                                                                          | Verdict                              |
| ------ | --------------------------------------------------------------------------------- | ------------------------------------ |
| A      | Cascade all non-merge descendants                                                 | Rejects: shared children over-pruned |
| **B**  | Cascade only when every non-protected inbound parent is already pruned/in-closure | **Adopt**                            |
| C      | Client submits full closure                                                       | Defer: thicker contract              |
| D      | DFS + ban sink only                                                               | Insufficient for multi-parent DAG    |

## Closure algorithm (normative sketch)

1. Start from prune target `T` (research node). If `T` is protected (`node_root_*` / `node_conclusion_*` / role question|conclusion) → reject.
2. Walk only edges with `kind != merge`.
3. Enqueue child `C` iff every non-protected inbound parent of `C` is already in the closure or already `conclusionStatus=pruned`.
4. Never add protected nodes.
5. Mark closure nodes `pruned`; **do not** delete their merge edges into the conclusion (failed contribution / 失败汇入).

## Lab ↔ Runtime

Lab fake `collectPruneClosure` is the behavioral twin of server `collectResearchPruneClosure`. Report UX (`[^@nodeId]`, 部分汇入失败文案) is FE-only until report SSOT grows node anchors (out of this change’s MUST).

## Non-goals

- Un-prune / undo
- Client-authored arbitrary closures (C)
- Changing EdgeKind 闭集
