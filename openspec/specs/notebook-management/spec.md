# notebook-management Specification

## Purpose

定义 Notebook 的生命周期与基础管理能力：创建、列出、重命名、删除，以及删除时对其下属资源（sources/sessions/outputs 等）的可达性约束。

## Related specs

- `GLOSSARY.md`
- `workspace-api/spec.md`
- `data-access/spec.md`

## API

- `POST /v1/notebooks?template_id=<int|null>`：创建 Notebook（template 不存在返回 404）
- `GET /v1/notebooks`：列出 Notebooks
- `GET /v1/notebooks/{notebook_id}`：读取单个 Notebook
- `PATCH /v1/notebooks/{notebook_id}`：重命名 Notebook
- `DELETE /v1/notebooks/{notebook_id}`：删除 Notebook（204）

## Requirements

### Requirement: Notebook CRUD endpoints are stable
系统 MUST 提供创建/列出/读取/重命名/删除 Notebook 的稳定端点（见 `workspace-api/spec.md` 的字段契约）。
最小字段：`id`, `name`, `created_at`, `updated_at`。

### Requirement: Template id not found returns 404
- **WHEN** 创建 Notebook 时 `template_id` 指向不存在的 template
- **THEN** 返回 404

### Requirement: Deletion makes notebook-scoped resources unreachable
删除 Notebook 后，该 Notebook 及其下属资源（sources/sessions/messages/outputs/research 等）MUST 不再可访问（例如返回 404）。
