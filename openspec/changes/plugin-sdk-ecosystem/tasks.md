## 1. 插件兼容策略与诊断输出

- [ ] 1.1 明确宿主支持的 `api_version` 集合与兼容矩阵，并在 registry 中执行门禁。
- [ ] 1.2 扩展 `check_plugins.py --json` 输出：为 skipped 插件提供结构化原因与修复建议。
- [ ] 1.3 为兼容门禁与诊断输出增加后端测试用例。

## 2. SDK 文档与示例

- [ ] 2.1 文档化 Python/TS SDK 的版本对齐策略与生成命令（复用 justfile 入口）。
- [ ] 2.2 增加最小示例：如何初始化 client、如何调用 notebooks/sources/qa/outputs 的关键路径。

## 3. 插件模板增强

- [ ] 3.1 更新 copier 模板：增加测试骨架、元数据与常见扩展点说明。

## 4. Verification

- [ ] 4.1 `cd backend/py && just test`
- [ ] 4.2 `cd backend/py && uv run python scripts/check_plugins.py --json`
