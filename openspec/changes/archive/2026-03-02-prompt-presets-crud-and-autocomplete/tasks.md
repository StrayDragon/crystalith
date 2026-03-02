## 1. Backend: commands + prompt presets

- [x] 1.1 增加 `prompt_presets` 数据模型与 DB 迁移
- [x] 1.2 实现 `GET/POST/PATCH/DELETE /v1/prompt-presets`（builtin 只读，custom 可 CRUD，冲突返回 409）
- [x] 1.3 实现 `GET /v1/commands`（返回 builtin + custom，包含 `enabled/source/description`）
- [x] 1.4 QA `/prompt:` 指令解析支持 custom preset（覆盖 system prompt；builtin stats 保持结构化输出）
- [x] 1.5 后端测试：CRUD/冲突、commands 列表、QA preset 行为（含 disabled/unknown）

## 2. Frontend: autocomplete + system config

- [x] 2.1 后端 OpenAPI 更新后执行 `pnpm run api:sync`
- [x] 2.2 新增 `GET /v1/commands` 的数据获取 hook（支持 revalidate/mutate）
- [x] 2.3 Chat 输入实现命令自动补全 UI（↑↓/Tab/Enter/Esc；disabled 不可选；展示描述）
- [x] 2.4 Avatar 下拉新增“系统配置”入口并实现 modal overlay
- [x] 2.5 系统配置内实现 prompt presets CRUD（list/copy/edit/toggle/delete），并在 mutation 后刷新 commands
- [x] 2.6 前端测试：关键键盘行为 + CRUD flow（MSW）

## 3. Verification & release hygiene

- [x] 3.1 后端运行 `cd backend/py && just check-imports && just test` 并记录结果
- [x] 3.2 前端运行 `cd frontend/web && pnpm test && pnpm typecheck` 并记录结果
- [x] 3.3 手动验证（DevTools）：
  - 创建 custom preset 后，补全列表立即出现并可 Tab 补全
  - 发送 `/prompt:<custom> <query>` 后行为按 system prompt 覆盖生效
  - disable 后补全置灰且不可选择，发送时后端返回确定性错误
  - delete 后补全列表移除
- [x] 3.4 确保工作区干净并按 `feat:`/`fix:` 前缀提交
