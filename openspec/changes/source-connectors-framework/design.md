## 背景

外部知识接入不应该从某个单一来源插件倒推出来。Crystalith 需要先把 connector 的宿主契约固定下来，再用官方样板验证这套契约是否足够稳。这样后续无论是 Obsidian、本地文档仓还是其他知识源，都能站在同一宿主模型之上。

## 已确定决策

### D1：宿主先于单个 connector
- 连接器发现、binding、snapshot、import_scope、sync_check 由宿主统一定义。
- 单个 connector 不拥有整套导入工作流定义权。

### D2：connector 只负责连接与枚举能力
- connector 负责连接参数 schema、数据枚举、内容读取和诊断。
- 通用快照预览、范围选择、同步检查交互由宿主提供。

### D3：binding 必须 notebook-scoped
- 外部来源接入状态以 notebook-scoped binding 持久化。
- 同步检查和导入都基于已保存 binding，而不是无状态临时请求。

### D4：v1 固定显式 sync_check 模型
- 同步先做检查、再确认应用。
- 本次不做后台常驻 watcher 或静默自动同步。

## 关键对象与边界

- `connector`: 外部来源接入插件。
- `binding`: notebook 作用域下的连接实例。
- `snapshot`: 某次来源枚举结果。
- `import_scope`: 被确认导入的目录/文件子集。
- `sync_check`: 当前快照与已确认基线之间的差异检查。

## 非目标

- 不为某个 connector 下放专属工作流 UI。
- 不在本 change 中定义后台自动同步调度器。
- 不把单个官方样板插件反向抬升为框架定义者。
