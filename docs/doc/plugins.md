# 插件

Crystalith 支持通过后端插件系统（Python `entry_points`）扩展：

- AI 提供商（chat + embeddings）
- 文档解析器（文件摄入）
- 输出生成 schema（覆盖现有输出类型）
- Web 内容提取器（URL 抓取模式）
- 源连接器（外部仓库 / 文件夹）

插件在应用启动时通过 Python `entry_points` 被发现。

## 官方插件套件

本仓库在 `backend/py/plugins/*` 下提供了一套**官方可选能力插件**。

安装配置：

- 仅核心: `pip install crystalith`（最小摄入 + 最小输出；默认 docker 镜像）
- 官方完整版（推荐）: `pip install 'crystalith[official-full]'`
- 较小 bundles: `official-connectors`、`official-outputs`、`official-parsers`、`official-extractors`

另见：[官方插件（自动生成）](reference/plugins.gen.md)

官方插件 ID 遵循稳定命名约定：

- 输出类型: `output-<type>`（如 `output-quiz`）
- 解析器: `parser-<kind>`（如 `parser-pdf`）
- Web 提取器: `extractor-<kind>`（如 `extractor-trafilatura`）
- 源连接器: `connector-<kind>`（如 `connector-obsidian`）

当能力缺失或被跳过时，API 会暴露可操作的提示：

- `GET /v1/workspace/tools` → `diagnostics.plugins` + `diagnostics.official`
- `GET /v1/notebooks/{notebook_id}/sources/extractors` → 每个 extractor 的 `error_code` + `recovery_hint`
- `GET /v1/notebooks/{notebook_id}/source-connectors` → 可用连接器 + 连接器诊断（仅已安装且已启用）

## 1) 发现

插件必须在 entry point 组 `crystalith.plugins` 下注册：

```toml
[project.entry-points."crystalith.plugins"]
my-provider = "my_pkg.plugin:plugin"
```

**entry point 名称**（`my-provider`）在配置中用作 provider id：

```yaml
models:
  available:
    - id: "my-chat-model"
      provider: "my-provider"
      model: "..."
      roles: [chat]
```

## 2) 启用 / 禁用 / 排序

使用 `plugins.enabled`（白名单）或 `plugins.disabled`（黑名单）：

```yaml
plugins:
  enabled: ["output-faq", "parser-pdf", "extractor-trafilatura"]
  disabled: ["output-quiz"]
  # Optional deterministic order for conflict resolution.
  # Plugins listed here (and enabled) are loaded last, in the given order.
  # Under last-wins conflict resolution, later plugins win.
  load_order: ["output-faq"]
```

- 若设置了 `plugins.enabled`，则仅加载列出的 id。
- `plugins.disabled` 始终跳过匹配的 id。

## 3) 接口

所有插件接口位于 `backend/py/src/crystalith/shared/plugins/interfaces.py`。

插件必须声明 `api_version`，且必须是 `SUPPORTED_PLUGIN_API_VERSIONS` 之一（当前为 `v1`）。不兼容的插件在启动时会被跳过，并附带结构化原因。

## 3.1) 合规检查脚本

提供轻量级合规检查脚本：

```bash
cd backend/py
uv run python scripts/check_plugins.py --json
```

JSON 报告包含：
- `host.plugin_api_version` + `host.supported_api_versions`
- `loaded`: 已加载的插件 id
- `skipped`: 插件 id → `{ error_code, message, hint?, details? }`
- `issues`: 已加载插件的合规问题（人类可读字符串）

### AIProviderPlugin

实现 `create_chat_provider()` 和 `create_embedding_provider()`，返回满足以下接口的对象：

- `crystalith.shared.ai.interfaces.ChatProvider`
- `crystalith.shared.ai.interfaces.EmbeddingProvider`

### ParserPlugin

实现一个工厂，包含：

- `parser_type: str`
- `supported_mime_types: set[str]`
- `supported_extensions: set[str]`
- `create_parser(...) -> Parser`

### OutputTypePlugin

输出插件当前**覆盖现有**输出类型（按 `OutputType.value`），因为输出以 DB enum 持久化。

- `output_type: str`（如 `"FAQ"`、`"GUIDE"`）
- `schema: type[pydantic.BaseModel]`
- `default_prompt: str | None`

#### 可选扩展属性

输出类型插件可选择性提供额外 UI 元数据：

- `metadata: OutputTypePluginMeta | None` — UI 元数据（description、display_text、tone）
- `render_descriptor: RenderDescriptor | None` — 声明式前端布局描述符
- `config_schema: PluginConfigSchema | None` — 生成对话框配置

这些 Pydantic 模型位于：

- `backend/py/src/crystalith/shared/plugins/render_types.py`

说明：
- Studio 工具配置对话框仅从 `GET /v1/workspace/tools` 渲染（使用 `config_schema`）。
- `GET /v1/workspace/tools/{tool_id}/config` 保留用于向后兼容，并从同一 schema 派生。
- 默认选项选择在存在时使用 `is_default=true`；否则 UI 回退到稳定默认值。

若扩展属性存在但类型错误，注册表会记录警告并忽略。

若多个插件注册相同 `output_type`，后者生效，注册表会记录警告。

#### 示例（OutputTypePlugin）

```py
from pydantic import BaseModel, Field

from crystalith.shared.plugins.render_types import (
    ConfigOption,
    FieldDescriptor,
    ItemSchema,
    OutputTypePluginMeta,
    PluginConfigSchema,
    RenderDescriptor,
)


class MyItem(BaseModel):
    text: str
    citations: list[int] = Field(default_factory=list)


class MyOutput(BaseModel):
    items: list[MyItem] = Field(default_factory=list)


class MyPlugin:
    api_version = "v1"

    output_type = "FAQ"
    schema = MyOutput
    default_prompt = "Generate a FAQ from the sources."

    metadata = OutputTypePluginMeta(
        description="问答清单",
        display_text="闪卡",
        tone="blue",
    )

    render_descriptor = RenderDescriptor(
        layout="list",
        item_schema=ItemSchema(
            fields=[
                FieldDescriptor(key="text", type="text", label="Text"),
                FieldDescriptor(key="citations", type="citation", label=None),
            ]
        ),
        options={"items_key": "items"},
    )

    config_schema = PluginConfigSchema(
        quantity_options=[ConfigOption(id="standard", label="Standard", is_default=True)],
        difficulty_options=[],
        topic_placeholder="Topic (optional)",
        supports_topic=True,
    )


plugin = MyPlugin()
```

### WebExtractorPlugin

实现一个工厂，包含：

- `extractor_type: str`（如 `"trafilatura"`）
- `display_name: str | None` / `description: str | None`（可选 UI 元数据）
- `requires_api_key: bool` / `requires_service: bool`（UI 提示）
- `create_extractor(settings, url_fetch_security=...) -> Extractor`

说明：
- 宿主 `ExtractorFactory` 负责 fallback/retry 语义及 SSRF 重定向重新校验。
- Notebook 级启用由 `PATCH /v1/notebooks/{notebook_id}/sources/extractors` 控制（`mode=inherit_global|custom`）。

### SourceConnectorPlugin

源连接器是后端插件，允许宿主枚举并从外部仓库导入文件（如 Obsidian vault 或本地目录）。

在 v1 中，连接器插件为**仅后端**：
- 宿主负责持久化（notebook 级绑定）和工作流 UI
- 连接器提供 config schema、诊断、快照枚举和文件读取

实现一个工厂，包含：

- `display_name: str` / `description: str | None`
- `connection_config_schema: dict`（JSON Schema）
- 能力: `supports_snapshot: bool`、`supports_sync_check: bool`
- `get_diagnostics(settings, connection_config=...) -> list[dict] | None`
- `list_snapshot_entries(settings, connection_config=...) -> list[dict]`
- `read_file_bytes(settings, connection_config=..., relative_path=...) -> bytes`

API 表面（宿主所有）：
- `GET /v1/notebooks/{notebook_id}/source-connectors`
- `POST /v1/notebooks/{notebook_id}/source-connectors/{connector_id}/bindings`
- `POST /v1/notebooks/{notebook_id}/source-connector-bindings/{binding_id}/snapshot`
- `POST /v1/notebooks/{notebook_id}/source-connector-bindings/{binding_id}/import-scope`
- `POST /v1/notebooks/{notebook_id}/source-connector-bindings/{binding_id}/sync-check`
- `POST /v1/notebooks/{notebook_id}/source-connector-bindings/{binding_id}/sync-check/apply`

## 4) 示例插件

参见 `backend/py/examples/crystalith-echo-plugin/`。

以可编辑方式安装并启动后端：

```bash
cd backend/py
pip install -e examples/crystalith-echo-plugin
just dev
```

然后添加使用 `provider: "echo"` 的 model 并重启。

OutputTypePlugin 示例参见：

- `backend/py/examples/crystalith-output-quiz/`
- `backend/py/examples/crystalith-output-timeline/`
- `backend/py/examples/crystalith-output-mindmap/`

## 5) Copier 模板

参见 `backend/py/tools/copier-crystalith-plugin/`：

```bash
copier copy backend/py/tools/copier-crystalith-plugin path/to/destination
```

模板会提示输入包名、模块名、插件 id 等。答案记录在 `.copier-answers.yml` 中，之后可通过以下命令更新：

```bash
copier update path/to/destination
```
