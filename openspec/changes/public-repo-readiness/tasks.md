## 1. 治理文件补齐

- [ ] 1.1 新增 `SECURITY.md`：说明漏洞报告渠道、响应范围与不应公开的信息类型。
- [ ] 1.2 新增/完善 `CONTRIBUTING.md`：给出最小开发/测试命令、代码结构指引与提交流程（可指向 `docs/` 深入说明）。

## 2. 模板与可维护性入口

- [ ] 2.1 增加 Issue 模板（bug/feature）与最小字段（复现步骤、期望/实际、环境）。
- [ ] 2.2 增加 PR 模板（变更说明、关联 issue/spec、测试结果、截图/GIF（如 UI 变更））。

## 3. 元数据一致性修正

- [ ] 3.1 修正后端包元数据中的占位字段（如 description），确保与 README/Docs 的产品定位一致。
- [ ] 3.2（可选）补充 `CHANGELOG.md` 或发布说明入口（如仅写“发布以 tag 驱动”与链接到 Releases）。

## 4. Verification

- [ ] 4.1 检查仓库入口可发现：README/Docs 能找到部署与贡献入口（手动验收）。
- [ ] 4.2 `just docs-build`
- [ ] 4.3（如涉及脚本/配置调整）`just test`
