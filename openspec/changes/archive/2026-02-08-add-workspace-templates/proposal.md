## Why

用户在使用 Crystalith 时经常需要重复创建类似配置的 notebook（如 "论文研究" 模板带有特定的输出类型偏好、"项目文档" 模板带有特定的 session 结构等）。当前每次都需要从零开始配置，效率低下。工作区模板系统可让用户保存和复用常见的工作流配置。

## What Changes

- 支持将当前 notebook 的配置保存为模板
- 支持从模板创建新 notebook（预配置 session、输出类型偏好等）
- 提供系统内置模板（论文研究、项目文档、知识收集等）
- 模板管理（列表、删除、更新）

## Impact

- 受影响的规范：`workspace-ui`（MODIFIED）
- 受影响的系统：
  - 后端 notebook 创建流程
  - 前端 notebook 创建对话框
  - 数据库 schema（template 表）
