# doc-governance 规范增量

## MODIFIED Requirements

### Requirement: docs-site 允许并显式收录受控 generated reference 页面
docs-site（`docs/doc` + `docs/zensical.toml`）MUST 允许并约束受控生成的 reference 页面：
- 文件 MUST 放在 `docs/doc/reference/`
- 文件名 MUST 为 `*.gen.md`
- `docs/zensical.toml` nav MUST 显式收录这些页面

#### Scenario: 生成 reference 页面可在站点中发现
- **WHEN** 开发者生成了 `docs/doc/reference/*.gen.md`
- **THEN** 这些页面 SHALL 通过 docs-site 构建并在导航中可见
