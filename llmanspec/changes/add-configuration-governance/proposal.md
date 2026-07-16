---
depends_on: []
batch: false
---

# add-configuration-governance — 配置管理体系规范

## Why

项目目前存在多处硬编码配置（文件路径、URL、端口、超时）且缺乏统一的配置管理约定：

- `data_root` 刚刚配置化，但 `LocalStorage` 仍用独立的 `CL_STORAGE_PATH` + `~/.crystalith/storage`
- 超时/限值分散在代码各处（`20000ms`、`10000ms`）不与 config schema 同步
- fallback URL 硬编码（`http://localhost:8080`、`http://127.0.0.1:8000`）
- `getOptionalServices()` 等 accessor 手写解构未走统一 `parseSection()`

需要一个正式的 SDD spec 来约束所有配置管理行为，确保新功能自然遵循同一套规则。

## What Changes

- **NEW** Spec `configuration-governance` — 定义配置管理体系的 MUST/SHALL 行为
  - 配置源优先级链：env → YAML → 硬编码默认值
  - `CL_*` 环境变量命名约定
  - YAML 配置段落命名约定（`snake_case`）
  - 加载/校验机制（模板渲染 → YAML parse → Zod validate）
  - 存储路径派生规则：所有运行时文件路径 MUST 从 `storage.data_root` 派生
  - Accessor 规范：配置访问 MUST 通过 typed accessor 函数，MUST 使用 `parseSection()` + Zod schema
  - 超时/限值规范：业务超时 MUST 从 config 读取而非硬编码
- **FIX** `shared/storage.ts` 对齐 `data_root` — 改为 `join(getDataRoot(), 'storage')`
- **FIX** `research/agent.ts` 消除 `http://localhost:8080` 硬编码 fallback

## Capabilities

- configuration-governance (new spec)

## Impact

- 少量代码对齐（storage.ts, agent.ts）
- 新建 spec 不改变现有外部行为
- 为未来所有配置相关代码提供规范依据
