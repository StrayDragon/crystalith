## 1. 后端：Markdown 预处理器

- [ ] 1.1 在 `shared/parsers/` 新增 `markdown_preprocessor.py`，实现 wikilink 转换（`[[page]]` → `[page](page.md)`，`![[file]]` → `[嵌入: file]`）
- [ ] 1.2 实现 YAML frontmatter 提取（tags、aliases、title、date）
- [ ] 1.3 编写单元测试：覆盖 wikilink、嵌入、frontmatter、混合内容场景
- [ ] 1.4 验证：处理包含 100+ wikilinks 的 Markdown 文件，输出纯文本保留语义

## 2. 后端：批量文件导入 API

- [ ] 2.1 在 `features/sources/api.py` 新增 `POST /v1/notebooks/{id}/sources/batch-upload` 端点，接受 multipart/form-data 多文件上传
- [ ] 2.2 实现文件过滤逻辑：排除 `.obsidian/`、`.git/`、`.trash/`、`node_modules/` 路径
- [ ] 2.3 实现逐文件处理流程：预处理 → 分块 → 嵌入 → 存储，返回每个文件的处理状态
- [ ] 2.4 添加进度 SSE 端点 `GET /v1/notebooks/{id}/sources/batch-upload/{task_id}/stream`，推送处理进度
- [ ] 2.5 编写集成测试：批量上传 10 个 Markdown 文件，验证全部成功入库
- [ ] 2.6 验证：上传含 wikilink 的 Obsidian vault 样本（5-10 文件），QA 可检索到内容

## 3. 前端：文件夹导入 UI

- [ ] 3.1 在 SourcesPanel 的 CTA 区域添加"导入文件夹"按钮
- [ ] 3.2 实现文件夹选择器（`webkitdirectory` attribute），并过滤仅 `.md` 文件
- [ ] 3.3 实现导入预览对话框：文件列表、文件数量、总大小、可取消选择
- [ ] 3.4 实现导入进度对话框：进度条、已处理/总数、成功/失败计数
- [ ] 3.5 调用 `pnpm run api:generate` 生成新 API 绑定
- [ ] 3.6 编写组件测试：验证文件夹选择、预览、进度展示的交互流程
- [ ] 3.7 验证：从真实 Obsidian vault 导入 20+ 文件，确认进度展示正确，导入完成后可正常 QA

## 4. 端到端验证

- [ ] 4.1 准备 Obsidian vault 测试样本：含 wikilinks、frontmatter、嵌入、子目录
- [ ] 4.2 执行完整导入流程，验证 source 数量与预期一致
- [ ] 4.3 对导入的内容执行 QA，验证 wikilink 引用的页面名称可被检索
- [ ] 4.4 执行跨文档分析，验证导入内容参与关联检测
