## 1. Connector host framework

- [ ] 1.1 定义 binding、preflight、snapshot、sync_check、fetch、confirm_import 的统一边界
- [ ] 1.2 定义 notebook-scoped 状态持久化与 snapshot baseline 规则
- [ ] 1.3 复核宿主 UI 与 connector 实现职责分离清楚

## 2. Diagnostics and recovery

- [ ] 2.1 定义 connector diagnostics 模型、状态分层与 error_code 语义
- [ ] 2.2 定义 diagnostics export 的红线与脱敏要求
- [ ] 2.3 复核 preflight 不会变成阻塞性全量检查

## 3. Sync semantics

- [ ] 3.1 定义 sync_check 的 added/modified/deleted/reason 输出
- [ ] 3.2 定义 snapshot_id、last_confirmed_snapshot 与 dry-run 预估语义
- [ ] 3.3 明确 deleted 候选在 v1 不自动删除已导入来源

## 4. Official connector pack

- [ ] 4.1 定义 local-directory connector 的权限检查、过滤规则与 dry-run 预估
- [ ] 4.2 定义 obsidian-vault connector 的 wikilink/frontmatter/link graph 保留边界
- [ ] 4.3 定义 rss/atom connector 的 snapshot、import_scope 与 canonicalization 要求
- [ ] 4.4 定义 imap connector 的 secrets/redaction、筛选与最小预览边界

## 5. Integration contracts

- [ ] 5.1 明确 connector host 如何复用 optional readiness、error registry 与 diagnostics workbench
- [ ] 5.2 明确 official plugin catalog 如何呈现 source connectors pack
- [ ] 5.3 明确 workspace API/UI 如何返回 connector diagnostics、diff 与恢复动作

## 6. Verification

- [ ] 6.1 复核 merged proposal 没有重复定义 framework 与 pack 语义
- [ ] 6.2 复核旧 change 的关键信息都已被新 change 收口
- [ ] 6.3 运行 `openspec validate c4065-source-connectors-framework-and-official-plugins-pack`
