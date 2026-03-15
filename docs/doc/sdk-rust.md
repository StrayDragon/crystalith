# Rust SDK

## 概述
Rust SDK 由后端 OpenAPI schema 通过 Fern 生成，存放于：

- `vendor/crystalith-sdks/rust`（git 子模块）

Fern 配置位于：
- `sdk/configs/fern/fern.config.json`
- `sdk/configs/fern/generators.yml`（分组：`rust-sdk`）

## 本地生成（仓库内）

```bash
git submodule update --init --recursive vendor/crystalith-sdks
just api-export
just sdk-gen-rust
```

## 版本管理 / 发布说明
- Crate 名称为 `crystalith_sdk`。
- 版本与 `backend/py/pyproject.toml` 对齐（`just sdk-gen-rust` 配方会强制此约束）。
