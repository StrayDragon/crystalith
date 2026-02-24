## 1. URL 安全策略与配置

- [x] 1.1 在 `Settings` 中为 URL fetch 增加 SSRF 安全策略字段（默认拒绝私网/localhost/元数据），并更新 `config/app.schema.json` 生成流程
- [x] 1.2 实现共享 URL 安全校验 helper（解析/规范化、拒绝 userinfo、DNS 解析、IP 网段判定、allowlist 命中规则）
- [x] 1.3 为 URL 安全校验 helper 添加单测（覆盖：localhost、127.0.0.0/8、10.0.0.0/8、172.16/12、192.168/16、169.254.169.254、IPv6 loopback/link-local、allowlist 放行）

## 2. from-url(fetch) SSRF 防护落地

- [x] 2.1 在 `from-url(fetch)` 路径“任何网络请求发生前”调用 URL 安全校验，失败返回 400 且不创建 Source
- [x] 2.2 将抓取逻辑改为手动重定向（禁用自动 follow），对每一跳 `Location` 逐跳重验并限制最大跳数
- [x] 2.3 为 `from-url(fetch)` 添加集成测试：不安全 URL 返回 400；重定向到私网返回 400；allowlist 命中可继续执行（可用本地测试 server/fixture）

## 3. Upload ingest 的 4xx/5xx 分层与记录策略

- [x] 3.1 在创建 Source 记录前读取上传内容并对空文件（0 bytes）直接返回 400
- [x] 3.2 将“解析后无 chunks”映射为 400（并避免创建 Source）；保留运行时异常为 500 + failed Source 的行为
- [x] 3.3 调整 ingestion 端点的异常捕获：`HTTPException` 原样抛出；仅未知异常转换为 500（并在已创建 Source 时写入 failed + error_message）
- [x] 3.4 为 upload ingest 添加/更新测试：空文件返回 400 且 sources 列表不新增；解析无 chunks 返回 400 且不新增

## 4. 测试套件与验收

- [x] 4.1 后端测试：`cd backend/py && just test`（覆盖 sources ingest 新增/修改用例）
- [x] 4.2 提供部署后手动验收清单（DevTools）

### 部署后手动验收清单（DevTools / Network）

- 启动服务：
  - 后端：`cd backend/py && uv sync && just dev`
  - 前端：`cd frontend/web && pnpm install && pnpm dev`
- SSRF 拦截：
  - 在 UI 触发“从 URL 导入（fetch）”，输入 `http://127.0.0.1:1` 或 `http://169.254.169.254/`（任选其一）
  - 观察对应 API 请求返回 **400**（而非 500），响应体为标准错误 envelope（`error_code/message`）
  - 随后触发 `GET /v1/notebooks/{id}/sources`，确认 sources 列表未新增失败条目
- 空文件上传：
  - 上传 0 bytes 文件，观察返回 **400**
  - 刷新 sources 列表，确认未新增失败 Source
- 回归：
  - 对一个正常公网 URL 执行 fetch，确认仍可成功创建 Source（201）并可在 sources 列表中查看

## 5. 文档与配置示例

- [x] 5.1 更新部署/配置文档：说明 SSRF 默认拒绝策略、allowlist 的配置方式与安全注意事项
