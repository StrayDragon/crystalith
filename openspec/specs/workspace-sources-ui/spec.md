# workspace-sources-ui Specification

## Purpose

定义 Workspace 中 **Sources 面板**的交互契约：来源的上传、搜索结果队列化与“链接/获取内容”导入、来源列表的选择/排序/标签筛选/批量操作，以及来源详情对话框（摘要/chunks/source-scoped QA）的最小体验要求。

本规范只约束前端可见行为；后端摄取与管理语义见 `source-ingestion/spec.md` 与其子规范（upload/url/management/tags/summary-qa），搜索语义见 `search-engine/spec.md`。

## Related specs

- `GLOSSARY.md`
- `workspace-api/spec.md`（sources 相关端点与错误 envelope）
- `source-ingestion/spec.md`
- `source-ingestion-upload/spec.md`
- `source-ingestion-url/spec.md`
- `source-ingestion-management/spec.md`
- `source-ingestion-summary-qa/spec.md`
- `search-engine/spec.md`
- `research-ui/spec.md`（Deep Research 胶囊/详情）
- `workspace-ux-system/spec.md`（layer/z-index、toast、modal 等跨域 UX）

## Requirements

### Requirement: Sources panel composition
Sources 面板 MUST 提供以下区域（自上而下）：

- 添加来源入口（上传）
- Deep Research 入口（胶囊或等效 callout；细则见 `research-ui/spec.md`）
- 搜索行（query + engine + mode + search button）
- 搜索结果队列（可清理/可逐项移除）
- 来源列表（可选择/可排序/可按标签筛选/可批量操作）
上述区域 MUST 以固定顺序呈现，且在窄宽度下仍可访问（允许折行/收起非核心控件）。

### Requirement: Upload filters unsupported files (minimum: text/markdown)
Sources 面板的上传入口 MUST 至少支持文本与 Markdown 文件，并在 UI 侧过滤不支持文件：

- 扩展名：`.txt/.md/.markdown`
- MIME：`text/plain`, `text/markdown`
后端 ingest MAY 支持更多文件类型（例如 PDF/HTML/音视频；见 `source-ingestion-upload/spec.md`）。当 UI 尚未支持某格式时 MUST 过滤并提示；当用户选择/拖拽混合文件（含不支持格式）时，UI MUST 过滤不支持文件并继续上传支持文件，并给出 warning（说明已忽略不支持格式）。

### Requirement: Search results are queue-based (Fast Research)
Fast Research 模式下，来源搜索 MUST 以“队列项”形式呈现结果，支持并发多次搜索且互不覆盖。

最小行为：
- 每次点击搜索按钮 MUST 立即创建一个 `loading` 队列项（包含 query/engine/mode）
- 搜索按钮 MUST NOT 被全局禁用（允许继续发起新搜索）
- 多次搜索 MUST 追加为独立队列项；各队列项分别显示 `loading|success|error` 与 notice
- 移除队列项时 MUST 只移除该项，不影响其他队列项

### Requirement: Add search results to sources supports link/fetch modes
UI MUST 支持将搜索结果（URL）添加为来源，并提供两种导入模式：

- `link`：仅保存 URL + 元数据（标题/摘要）
- `fetch`：下载并解析网页内容后创建完整来源（语义见 `source-ingestion-url/spec.md`）

UI SHOULD 允许多选并批量添加，并在添加后保持搜索队列可继续使用。
批量添加时 UI MUST 以进度对话框展示状态；完成后 UI SHOULD 仅从队列中移除已成功添加的结果项（保留未添加/失败项）。对话框期间触发的下拉菜单/Toast 层级顺序 MUST 遵循 `workspace-ux-system/spec.md`。

### Requirement: Selection, status gating, and bulk actions
Sources 面板 MUST 以 **Source** 作为最小选择单元，并以索引状态约束可选范围：

- 列表 MUST 展示状态标识（已索引/处理中/失败）
- 仅 `ready` sources 可被选中；`processing|failed` MUST disabled 并提供原因提示
- 对于 `failed` sources，UI SHOULD 提供“重试索引/重新嵌入”入口
- sources 首次加载完成且用户尚未手动选择时，UI SHOULD 默认选中全部 `ready` sources
- 多选 SHOULD 支持 Ctrl/⌘ 点击切换与 Shift 点击范围选择（范围仅覆盖 `ready`）
- 当存在选中来源时，UI MUST 显示批量操作栏（至少包含删除；并可选支持批量标签/重嵌入，若后端支持）

### Requirement: Sort and tag filter controls
Sources 面板 MUST 提供来源列表的排序与标签筛选入口，并与后端 list 接口的 query 语义保持一致（见 `source-ingestion-management/spec.md`）：

- `sort_by: date|name|size|type`
- `sort_order: asc|desc`
- `tag: string | null`（按标签精确匹配过滤）

### Requirement: Source detail dialog
系统 SHALL 提供来源详情对话框，展示摘要与原始 chunks，并支持“基于该来源问答”。
打开来源详情对话框时，UI MUST 请求摘要并展示加载状态；失败 MUST 显示错误提示（不崩溃）。来源详情内的问答 MUST 仅使用该来源作为上下文，且 assistant 回复可被复制/下载（Markdown）。
