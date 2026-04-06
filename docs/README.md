# docs（文档站点）

> TL;DR：Crystalith 的文档站点基于 Zensical，源文件在 `docs/doc/`，站点输出到 `docs/site/`（配置：`docs/zensical.toml`；依赖：`docs/pyproject.toml`）。部分参考页为生成物（`*.gen.md`），由 `backend/py/scripts/gen_docs.py` 生成（入口：`justfile:gen-docs`）。

## Scope（责任边界）

### 做什么
- 承载文档内容：`docs/doc/*.md`（导航由 `docs/zensical.toml:nav` 定义）。
- 承载生成的参考页：
  - `docs/doc/reference/config-schema.gen.md`
  - `docs/doc/reference/env-vars.gen.md`
  - `docs/doc/reference/plugins.gen.md`
  （这些是生成物；生成器：`backend/py/scripts/gen_docs.py`；导航中引用：`docs/zensical.toml`；治理检查：`backend/py/scripts/check_doc_governance.py`）

### 不做什么
- 不直接包含业务逻辑实现；实现位于 `backend/` 与 `frontend/`。
- 不手改生成文件或注入块：
  - `*.gen.*` 文件是生成物（规则：`AGENTS.md`）
  - `<!-- BEGIN AUTOGEN:... --> ... <!-- END AUTOGEN:... -->` 块内容不要手改（规则：`AGENTS.md` + 生成器：`backend/py/scripts/gen_docs.py`）。

## Integration（与项目的关系）

### 上游依赖
- 后端生成器：`backend/py/scripts/gen_docs.py`（读取 `config/app.schema.gen.json` 等并写入 docs）。
- 配置 schema：`config/app.schema.gen.json`（生成：`backend/py/justfile:config-schema`；被 docs generator 读取：`backend/py/scripts/gen_docs.py`）。

### 下游使用者
- 项目 README 指向 docs：`README.md`（Docs 段落）。
- CI/本地质量门会检查 docs 漂移与治理规则（根目录：`justfile:check` → `justfile:doc-governance-check` / `justfile:docs-drift-check`）。

### 依赖关系图
~~~text
config/app.schema.gen.json  --> backend/py/scripts/gen_docs.py --> docs/doc/reference/*.gen.md
                                              |
                                              +--> injected AUTOGEN blocks in docs/doc/*.md (when present)
docs/zensical.toml --> zensical build/serve --> docs/site/
~~~

## Core Logic（核心概念与核心数据流）

### 术语表
- Zensical：docs 工具（依赖：`docs/pyproject.toml`；运行入口：根目录 `justfile:docs-serve` / `justfile:docs-build`）。
- reference pages：生成的参考页（列表与校验：`backend/py/scripts/check_doc_governance.py`）。
- “drift check”：不生成，只检查生成物是否与源码一致（`justfile:docs-drift-check`）。

### 主流程（写文档/生成参考/构建站点）
1. 写/改手写文档：`docs/doc/*.md`（导航见 `docs/zensical.toml`）。
2. 生成参考页/注入块：
   - `just gen-docs` → `backend/py/scripts/gen_docs.py`（`justfile:gen-docs`）。
3. 构建/预览站点：
   - `just docs-serve` / `just docs-build`（`justfile`；调用 `uv run --project docs zensical ...`）。

### 重要边界条件
- `backend/py/scripts/check_doc_governance.py` 会强制：
  - `CLAUDE.md` 必须是 `AGENTS.md` 的 symlink（同脚本 `_check_claude_symlink`）
  - `docs/zensical.toml` nav 必须包含三张 reference 页（同脚本 `REQUIRED_REFERENCE_PAGES`）
  - reference 页头部必须包含 “AUTO-GENERATED” 与 “just gen-docs” 提示（同脚本 `_check_reference_headers`）

## Dev / Run / Test（开发者使用指南）
```bash
# repo root：安装 docs 依赖（会写 venv/cache；谨慎执行）
uv sync --project docs                   # 依据：README.md + docs/pyproject.toml

# repo root：本地预览/构建
just docs-serve                          # 依据：justfile:docs-serve
just docs-build                          # 依据：justfile:docs-build

# 生成/校验生成物
just gen-docs                            # 依据：justfile:gen-docs + backend/py/scripts/gen_docs.py
just docs-drift-check                    # 依据：justfile:docs-drift-check
just doc-governance-check                # 依据：justfile:doc-governance-check + backend/py/scripts/check_doc_governance.py
```

## Config / Observability（配置与可观测性）
- docs 配置（导航/主题）：`docs/zensical.toml`
- docs 依赖与 Python 版本：`docs/pyproject.toml`（`requires-python >=3.12`）
- 生成器入口与来源提示：`backend/py/scripts/gen_docs.py`（常量：`GENERATOR_ID` / `JUST_ENTRYPOINT`）

## Roadmap（未来方向与优化建议）
- 近期（1–2 周）
  - 为生成参考页补“来源索引”（动机：读者快速跳到 SSOT；收益：更易维护；风险：生成器改动；方案：沿用 `backend/py/scripts/gen_docs.py:_render_generated_header` 的 Source 字段扩展）。
  - 统一文档中的“生成物”提示规范（动机：防止手改；收益：减少 drift；风险：需要清点；方案：用 `backend/py/scripts/check_doc_governance.py` 的规则做 checklist）。
- 中期（1–2 月）
  - 把部署/排障的“配方（recipes）”抽成可复用章节（动机：自托管常见问题；收益：更少 issue；风险：需要持续维护；方案：从 `docs/doc/deployment.md` 与 `scripts/*` 的可观测命令（smoke/health）整理）。
  - 将 openspec 的核心流程以图示方式嵌入 docs（动机：降低参与门槛；收益：协作更顺；风险：需要与 openspec 同步；方案：依据 `openspec/AGENTS.md` 与 `openspec/config.yaml` 绘制流程图）。
- 长期（季度+）
  - 建立 docs 的“版本化与兼容策略”（动机：减少 breaking；收益：升级更平滑；风险：需要规划；方案：与 SDK release 流程（`scripts/sdk_release.sh`、`vendor/crystalith-sdks/DEVELOPMENT.md`）一致地写清楚版本语义）。

## Assumptions / TODO to Verify（已知未知）
- docs 是否在 CI 中独立构建：从 `.github/workflows` 与 `justfile:check` 的调用链确认。
- docs 的生成物是否只来自后端（config/env/plugins）或还有其它来源：从 `backend/py/scripts/gen_docs.py` 的目标集合与写入路径确认。
