## 1. 基础能力：Markdown 兼容层

- [x] 1.1 在标准 Markdown 上传链路中增加 Obsidian 兼容预处理（`wikilink` / `embed`）
- [x] 1.2 提取支持的 YAML frontmatter 字段并写入 `source metadata`
- [x] 1.3 添加后端测试，覆盖 Markdown 语义转换与 metadata 合并

## 2. 宿主连接器框架：后端契约

- [ ] 2.1 新增 `SourceConnectorPlugin` 接口，并接入统一插件发现、启用、兼容性和诊断体系
- [ ] 2.2 新增 notebook-scoped `connector binding` 模型，持久化 `connector_id`、`connection_config`、`import_scope`、`last_confirmed_snapshot`
- [ ] 2.3 新增连接器发现接口：列出可用连接器、配置 schema 与诊断信息
- [ ] 2.4 新增 binding 的 `snapshot`、`import-scope`、`sync-check` 三组核心接口
- [ ] 2.5 实现通用路径规范化、范围命中、快照差异计算与结构化恢复提示

## 3. 宿主连接器框架：前端通用组件

- [ ] 3.1 在 Sources 面板增加通用连接器入口，而不是“导入文件夹”入口
- [ ] 3.2 实现宿主内置的连接参数表单与快照预览 UI
- [ ] 3.3 实现目录 / 文件范围选择 UI，并清晰展示当前导入范围
- [ ] 3.4 实现宿主内置的 `sync_check` 结果展示与确认同步交互
- [ ] 3.5 实现通用导入进度、错误提示、诊断与恢复指引展示

## 4. 官方 Obsidian 插件

- [ ] 4.1 新建官方 Obsidian vault 插件包
- [ ] 4.2 实现 vault 快照枚举（路径、大小、修改时间、frontmatter 摘要）
- [ ] 4.3 实现内容读取并复用现有 source ingestion 链路导入已选笔记
- [ ] 4.4 实现显式 `sync_check`，输出范围内的新增 / 更新 / 缺失候选
- [ ] 4.5 明确 v1 连接器插件不自带前端工作流 UI，Obsidian 插件仅提供配置与数据能力

## 5. 验证

- [x] 5.1 运行 backend 相关测试子集并记录结果
  - [x] `cd backend/py && uv run pytest --no-cov tests/shared/test_parsers.py tests/features/sources/test_sources_api.py -q` → `34 passed`
- [ ] 5.2 准备 100+ 文件 vault 样本，验证快照与选择性导入模型
- [ ] 5.3 准备 1000+ 文件 vault 样本，验证 `sync_check` 的响应时间和候选稳定性
- [ ] 5.4 验证未确认前 `sync_check` 不会隐式修改现有来源
- [ ] 5.5 验证第二个非 Obsidian 连接器（**Local Directory**）可复用宿主通用 UI，而不需要重做整套流程

## 6. 框架通用性验证（合并自 source-connectors-framework）

- [ ] 6.1 定义 connector、binding、snapshot、import_scope、sync_check 的宿主对象模型
- [ ] 6.2 明确哪些能力属于宿主，哪些属于 connector 实现者（已在 design D2 确定）
- [ ] 6.3 明确 notebook-scoped binding 的持久化边界（已在 design D3 确定）
- [ ] 6.4 明确宿主通用 UI/流程壳子的责任范围（已在 design D2 确定）
- [ ] 6.5 实现 Local Directory 连接器插件作为第二验证者
