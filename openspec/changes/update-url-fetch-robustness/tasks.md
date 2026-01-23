## 1. 前端 UI 修复

- [ ] 1.1 修改 `SearchResultsQueue.tsx`：在触发 `onAddToSources` 前先关闭全屏对话框 (`setIsFullscreen(false)`)
- [ ] 1.2 为 `AddSearchResultDialog` 添加明确的 z-index class (如 `z-[9999]`)
- [ ] 1.3 测试验证：从全屏模式点击"作为全文导入"后进度对话框正确显示

## 2. 后端 HTTP 请求优化

- [ ] 2.1 在 `sources.py` 的 `create_source_from_url` 函数中添加浏览器伪装请求头
- [ ] 2.2 添加请求重试逻辑（最多 2 次，间隔 1 秒）
- [ ] 2.3 改进错误消息，区分网络错误、HTTP 错误和解析错误

## 3. 代理配置支持

- [ ] 3.1 在 `config/models.py` 中添加 HTTP 代理配置模型（支持 http_url、https_url、socks5_url、no_proxy）
- [ ] 3.2 更新 `config/app.yaml` 添加完整代理配置示例（默认禁用）
- [ ] 3.3 在 `sources.py` 中读取代理配置并应用到 httpx client（支持 SOCKS5 需要 httpx[socks] 依赖）
- [ ] 3.4 添加 no_proxy 域名匹配逻辑
- [ ] 3.5 更新 `config/schema.json`

## 4. 验证

- [ ] 4.1 前端测试：全屏对话框内触发添加，进度对话框正确显示
- [ ] 4.2 后端测试：抓取常见网站（如维基百科）成功
- [ ] 4.3 错误场景测试：验证友好的错误提示
