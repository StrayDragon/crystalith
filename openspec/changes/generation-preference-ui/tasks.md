## 1. Preference UI & persistence

- [x] 1.1 定义前端 `GenerationPreference` 类型（`quality|speed|default`），并实现 localStorage 读写（例如 `crystalith_generation_preference`）
- [x] 1.2 在 Studio 工具“自定义参数”对话框中增加 preference 选择，并支持重置为默认（不发送）
- [x] 1.3 在 Slides 配置对话框中增加 preference 选择，并回填上次选择的值

## 2. Request propagation (outputs / slides)

- [x] 2.1 扩展输出队列 job 结构以携带 `preference`（用于重试与状态展示一致）
- [x] 2.2 在 outputs 生成请求（`POST /v1/notebooks/{id}/outputs/{type}`）中透传 `preference`（仅非默认时）
- [x] 2.3 在 slides draft create/update payload 的 `generation_config` 中透传 `preference`（仅非默认时）

## 3. Studio tool config binding (quick win)

- [ ] 3.1 将数量/难度/主题组合进最终 prompt（constraints 段落），确保“自定义参数”真实影响生成
- [ ] 3.2 确保队列重试复用同一份已组合的 prompt 与 preference（避免重试时丢参数）

## 4. Verification

- [x] 4.1 添加前端测试：选择 preference 后请求体包含/不包含 `preference` 的断言（outputs + slides draft）
- [ ] 4.2 手工验证：Studio tools 与 Slides 一键生成在 quality/speed 下均能完成，并可通过后端日志观察差异
- [ ] 4.3 若 OpenAPI types 有变更，运行 `pnpm -C frontend/web run api:generate` 并确认生成文件无未提交改动
