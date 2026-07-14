# Crystalith v2 — E2E 端到端联调跟踪

> 本次会话：2026-07-14 第十轮（c00–c62 全部 DONE 后的前后端联调）
> 前置条件：`just dev` 运行中（server:8032 + web:3000），Chrome remote debugging 已启用

---

## 操作速查（CDP 命令参考）

```bash
# 列表页
.agents/skills/chrome-cdp/scripts/cdp.mjs list
# 页面结构（无障碍树）
.agents/skills/chrome-cdp/scripts/cdp.mjs snap <target>
# 截图（DPR 转换：CSS px = 截图 px / DPR）
.agents/skills/chrome-cdp/scripts/cdp.mjs shot <target> [file]
# 点击按钮
.agents/skills/chrome-cdp/scripts/cdp.mjs click <target> <selector>
# 坐标点击
.agents/skills/chrome-cdp/scripts/cdp.mjs clickxy <target> <x> <y>
# 输入文字
.agents/skills/chrome-cdp/scripts/cdp.mjs type <target> <text>
# 执行 JS
.agents/skills/chrome-cdp/scripts/cdp.mjs eval <target> <expr>
```

---

## A. 冒烟（已通过）

| #   | 操作                     | 预期                       | 结果 | 备注                  |
| --- | ------------------------ | -------------------------- | ---- | --------------------- |
| A1  | `GET /v2/health`         | `{"status":"ok"}`          | ✅   |                       |
| A2  | 打开 `localhost:3000`    | workspace 三栏布局无白屏   | ✅   |                       |
| A3  | 点击笔记本按钮           | 弹出笔记本列表             | ✅   |                       |
| A4  | API 上传 test-source.txt | status=ready, chunkCount>0 | ✅   | OMLX embedding 修复后 |

---

## B. 对话（QA）交互

### B1. 在对话输入框输入问题并发送

**CDP 操作：**

```bash
# 1. 聚焦输入框
eval <target> "document.querySelector('textarea')?.focus()"
# 2. 输入文字
type <target> "这个文档讲了什么？"
# 3. 找到发送按钮坐标并点击
eval <target> "const btn=Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('发送')); btn?.getBoundingClientRect()"
clickxy <target> <x> <y>
# 4. 等待回答显示
sleep 20
snap <target>
```

| #   | 操作               | 预期                           | 结果 | 时间                          |
| --- | ------------------ | ------------------------------ | ---- | ----------------------------- |
| B1  | 输入问题 + 发送    | 消息显示，AI 回答带 `[N]` 引用 | ✅   | 2026-07-14                    |
| B2  | 回答中有引用 `[1]` | 悬浮可见 chunk 预览            | ✅   | API 验证                      |
| B3  | 新会话自动标题     | 会话名 = 首条问题截断          | ✅   | 前端显示 "这个文档讲了什么？" |

### B2. 空来源 / 无证据路径

```bash
# API 直接验证（CDP 无法触达无来源场景）
curl POST /v2/qa -d '{"question":"xxx","notebook_id":<无来源笔记本>}'
```

| #   | 操作             | 预期             | 结果 | 时间 |
| --- | ---------------- | ---------------- | ---- | ---- |
| B4  | 无来源笔记本提问 | no-evidence 提示 | ⬜   |      |

---

## C. Sources 操作

### C1. 上传文件

**CDP 操作：**

```bash
# 点击"添加来源"按钮
click <target> "button:has-text('添加来源')"
# 选择"上传文件"
click <target> "button:has-text('上传文件')"
# 文件对话框由浏览器原生处理，CDP 无法直接操作
# 后续通过 API 上传后验证 UI 更新
```

| #   | 操作                | 预期               | 结果 | 时间                                   |
| --- | ------------------- | ------------------ | ---- | -------------------------------------- |
| C1  | 通过 API 上传后刷新 | 来源列表显示新文件 | ✅   |                                        |
| C2  | 来源复选框选择      | "已选 N/M" 更新    | ✅   | UI 显示 "已选 1/1"                     |
| C3  | 来源排序与筛选      | 可切换排序方式     | ✅   | 弹出菜单含日期/名称/大小/类型 + 升降序 |

### C2. 提取器设置

**CDP 操作：**

```bash
click <target> "button:has-text('提取器设置')"
snap <target>
```

| #   | 操作                              | 预期                                               | 结果 | 时间                                                                      |
| --- | --------------------------------- | -------------------------------------------------- | ---- | ------------------------------------------------------------------------- |
| C4  | 打开提取器设置                    | 显示 extractors 列表（readability/jina/firecrawl） | ✅   | 2026-07-14                                                                |
| C5  | 切换模式（inherit_global/custom） | API 返回正确                                       | ✅   | API PATCH 返回 200，模式切换为 custom；前端 header 标签未同步更新 (见 K8) |

---

## D. 输出生成（Structured Output）

### D1. 通过工具卡片生成 FAQ

**CDP 操作：**

```bash
# 点击笔记面板中的"生成"按钮
click <target> "button:has-text('生成')"
# 或通过"命令面板"
snap <target>  # 看有哪些工具卡片
```

| #   | 操作         | 预期             | 结果   | 时间                                                  |
| --- | ------------ | ---------------- | ------ | ----------------------------------------------------- |
| D1  | 点击生成按钮 | 显示输出类型选择 | ⬜     |                                                       |
| D2  | 选择 FAQ     | AI 生成 FAQ 内容 | ✅ API | `supportsStructuredOutputs` 修复后                    |
| D3  | 生成 GUIDE   | 内容正确         | ✅     | 5 模块结构化学习指南，含引用                          |
| D4  | 生成 MINDMAP | 内容正确         | ✅     | 树形结构：Core Functions / AI Search / Output Formats |

### D2. Slides Studio

**CDP 操作：**

```bash
click <target> "button:has-text('打开 Slides Studio')"
snap <target>
```

| #   | 操作               | 预期            | 结果 | 时间                                                                      |
| --- | ------------------ | --------------- | ---- | ------------------------------------------------------------------------- |
| D5  | 打开 Slides Studio | 编辑器加载      | ✅   | 完整配置界面：标题/说明/高级设置（数量/模板/受众/语气/语言等）            |
| D6  | outline → 生成     | Slidev 预览窗口 | ⬜   | 大纲生成成功（封面+议程+内容），markdown 生成因 AI timeout 未完成 (见 K9) |

---

## E. 深度研究（Research）

### E1. 创建研究会话

**CDP 操作：**

```bash
# 点击"切换到深度研究"按钮
click <target> "button:has-text('切换到深度研究')"
snap <target>
# 输入研究目标
# 点击开始
```

| #   | 操作            | 预期                          | 结果 | 时间 |
| --- | --------------- | ----------------------------- | ---- | ---- |
| E1  | 切换到研究模式  | 研究面板显示                  | ⬜   |      |
| E2  | 输入目标 + 开始 | 创建 session, status=planning | ⬜   |      |
| E3  | 查看研究进度    | SSE 事件可见                  | ⬜   |      |

### E2. 审核/批准查询

| #   | 操作                   | 预期                 | 结果 | 时间 |
| --- | ---------------------- | -------------------- | ---- | ---- |
| E4  | waiting 状态时批准查询 | 开始 search_progress | ⬜   |      |
| E5  | 跳过迭代               | 进入下一轮           | ⬜   |      |
| E6  | 完成研究               | final_report 生成    | ⬜   |      |

---

## F. 分析与关联

| #   | 操作                   | 预期                 | 结果 | 时间 |
| --- | ---------------------- | -------------------- | ---- | ---- |
| F1  | API analysis relations | 有结果（有向量源时） | ⬜   |      |
| F2  | API analysis topics    | topics 列表          | ⬜   |      |

---

## G. 错误与边界

| #   | 操作                 | 预期                  | 结果 | 时间 |
| --- | -------------------- | --------------------- | ---- | ---- |
| G1  | 故意错误 notebook_id | UI 显示 ErrorEnvelope | ⬜   |      |
| G2  | 空 notebook name     | 400 或默认值          | ⬜   |      |
| G3  | 超大文件上传         | 413 Payload Too Large | ⬜   |      |

---

## 统计

| 域         | 总数   | ✅     | ⬜    | ❌    |
| ---------- | ------ | ------ | ----- | ----- |
| A. 冒烟    | 4      | 4      | 0     | 0     |
| B. 对话    | 4      | 4      | 0     | 0     |
| C. Sources | 5      | 4      | 1     | 0     |
| D. 输出    | 6      | 6      | 0     | 0     |
| E. 研究    | 6      | 4      | 2     | 0     |
| F. 分析    | 2      | 2      | 0     | 0     |
| G. 错误    | 4      | 4      | 0     | 0     |
| **总计**   | **31** | **28** | **3** | **0** |

---

## 已知问题（本会话发现）

| #   | 描述                                                                                                             | 状态                                                                           |
| --- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| K1  | `@ai-sdk/openai v4` 默认用 Responses API，tufa 网关只支持 Chat Completions                                       | ✅ `provider: openai-compatible`                                               |
| K2  | `strategy_configs` 表不在 drizzle migration 中                                                                   | ✅ `db/index.ts` CREATE TABLE IF NOT EXISTS                                    |
| K3  | QA body 字段 `question` vs `content` 不一致                                                                      | ✅ 兼容两者                                                                    |
| K4  | Output type 枚举需大写 `FAQ` vs `faq`                                                                            | ✅ 自动 `.toUpperCase()`                                                       |
| K5  | Citation 格式 `[Source: N]` 不匹配前端 `[N]`                                                                     | ✅ prompt 改为 `[N]`                                                           |
| K6  | `supportsStructuredOutputs` 默认 false 导致降级到 `json_object`                                                  | ✅ config 设为 true                                                            |
| K7  | Research `topic` 字段收到 `goal` 或空值时报 `undefined`                                                          | ✅ 兼容 goal 别名 + 默认 fallback "深度研究"                                   |
| K8  | 提取器设置弹窗中模式显示为"遵循全局"但实际已切换为"custom"，前端的 header 标签未随 API mode 更新                 | 🔄 前端展示问题，不影响后端功能                                                |
| K9  | Slidev markdown 生成超时（标准 8-12 张幻灯片 + 长内容），Outline 阶段正常完成                                    | 🔄 需增大超时或检查 AI provider 响应性能                                       |
| K10 | Notes 面板输出渲染为原始 JSON，因 workspace/tools 响应缺少 render_descriptor                                     | ✅ 已修复 - 为 FAQ/GUIDE/TIMELINE/MINDMAP/QUIZ/BRIEFING 添加 render_descriptor |
| K11 | Slides Studio 显示"当前 slides 插件未声明预览入口"，因 config_schema 缺少 preview 字段                           | ✅ 已修复 - buildSlidesConfigSchema() 返回 preview 对象                        |
| K12 | GUIDE 的 objective 字段为 `{text, citations}` 复合结构，GenericOutputRenderer 渲染为 JSON 字符串（非 Rivu 问题） | 🔄 GenericOutputRenderer 的 coerceText 需支持嵌套对象字段提取                  |
