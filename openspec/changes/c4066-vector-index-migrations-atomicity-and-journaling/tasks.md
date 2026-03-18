## 1. Migration and metadata contract

- [ ] 1.1 定义 migration plan 的最小字段、范围与回滚窗口
- [ ] 1.2 定义 vector metadata v2 与 drift 分类
- [ ] 1.3 复核 provider parity 与 metadata round-trip 要求

## 2. Atomic write path

- [ ] 2.1 定义 staging generation、commit 点与 active swap 语义
- [ ] 2.2 定义 tombstone 的删除/替换边界
- [ ] 2.3 复核未提交写入绝不对读路径可见

## 3. Indexing journal and resumability

- [ ] 3.1 定义 parse/chunk/embed/upsert/verify/swap 阶段日志字段
- [ ] 3.2 定义 resumable backfill 的版本一致性条件
- [ ] 3.3 定义 recovery_hint、失败分类与幂等重跑边界

## 4. Audits, repair, and snapshots

- [ ] 4.1 定义 missing/orphan/drifted 审计输出
- [ ] 4.2 定义 repair jobs 与 dry-run cleanup 入口
- [ ] 4.3 定义 rolling snapshots、time-travel read 与 generation diff

## 5. Compaction and limits

- [ ] 5.1 定义 compaction 的保留窗口、暂停恢复与解释输出
- [ ] 5.2 定义存储硬上限与高风险迁移时的临时保留策略
- [ ] 5.3 复核 compaction 不破坏回滚与调试窗口

## 6. Verification

- [ ] 6.1 复核 merged proposal 没有重复定义 migration/atomicity/journal 语义
- [ ] 6.2 复核旧 change 的关键信息都已被新 change 收口
- [ ] 6.3 运行 `openspec validate c4066-vector-index-migrations-atomicity-and-journaling`
