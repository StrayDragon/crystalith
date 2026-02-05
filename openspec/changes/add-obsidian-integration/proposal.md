## Why

Crystalith 目前仅支持逐个上传 txt/markdown 文件或从 URL 导入，缺少与主流知识管理工具的集成。Obsidian 是最受欢迎的本地知识库工具之一，用户积累了大量 Markdown 笔记。支持从 Obsidian vault 批量导入，可以让用户直接利用 Crystalith 的 RAG 分析、跨文档关联、结构化输出等能力来分析和组织现有知识，打通"知识积累 → 知识分析"的链路。

## What Changes

- 后端：新增文件夹批量导入 API，支持递归扫描目录中的 Markdown 文件
- 后端：Markdown 预处理器，处理 `[[wikilinks]]`、`![[嵌入]]` 语法转换为标准链接
- 后端：提取 YAML frontmatter 元数据（tags、aliases、date 等）作为 source 属性
- 前端：新增"导入文件夹"入口（Sources 面板 CTA 扩展）
- 前端：文件夹选择 + 预览界面，显示待导入文件列表、文件数量和总大小
- 前端：导入进度展示（已处理/总数、成功/失败计数）
- 通用：该功能同时适用于任意本地 Markdown 文件夹，不仅限于 Obsidian

## Impact

- 受影响的规范：`source-ingestion`（MODIFIED）
- 受影响的系统：
  - 后端 `features/sources/api.py` — 新增批量导入端点
  - 后端 `shared/parsers/` — Markdown wikilink 预处理
  - 前端 SourcesPanel — 文件夹导入入口和 UI
  - 前端 api/generated — 新 API 绑定
