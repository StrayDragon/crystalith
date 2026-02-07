## ADDED Requirements

### Requirement: 嵌入批处理
系统 MUST 在文档索引时按可配置的 batch_size 分批调用嵌入 API，避免单次调用超限。

#### Scenario: 大文档分批嵌入
- **WHEN** 文档分块数超过 batch_size（默认 100）
- **THEN** 系统按 batch_size 分片依次调用嵌入 API
- **AND** 所有分片完成后合并结果
- **AND** 单片失败不影响其他片的结果

#### Scenario: 小文档单批嵌入
- **WHEN** 文档分块数不超过 batch_size
- **THEN** 系统以单次调用完成嵌入
- **AND** 行为与未启用批处理时一致

### Requirement: 嵌入内容缓存
系统 MUST 对嵌入结果按内容哈希缓存，避免相同内容重复调用嵌入 API。

#### Scenario: 缓存命中
- **WHEN** 待嵌入文本的 SHA256 哈希在缓存中存在
- **THEN** 系统直接返回缓存的嵌入向量
- **AND** 不调用嵌入 API

#### Scenario: 缓存未命中
- **WHEN** 待嵌入文本的 SHA256 哈希在缓存中不存在
- **THEN** 系统调用嵌入 API 获取结果
- **AND** 将结果存入缓存

### Requirement: Source 解析异步化
系统 MUST 将同步的文档解析操作移至线程池执行，不阻塞异步事件循环。

#### Scenario: 大文档解析不阻塞
- **WHEN** 用户上传大 PDF/HTML 文档
- **THEN** 系统在线程池中执行解析
- **AND** 同时接受的其他 API 请求不因解析阻塞而延迟
