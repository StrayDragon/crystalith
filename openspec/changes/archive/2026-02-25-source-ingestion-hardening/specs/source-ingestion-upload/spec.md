# source-ingestion-upload (delta) Specification

## ADDED Requirements

### Requirement: Empty upload MUST return 400 and MUST NOT create Source
对确定性用户输入错误（例如空文件或解析后无有效内容），系统 MUST 返回 400，且 MUST NOT 创建 Source 记录。

#### Scenario: Empty file upload
- **WHEN** 客户端上传的文件内容为空（0 bytes）
- **THEN** 系统返回 400 且不创建 Source

#### Scenario: Parser yields no chunks
- **WHEN** 解析成功但产出 chunks 为空（无可索引内容）
- **THEN** 系统返回 400 且不创建 Source

## MODIFIED Requirements

### Requirement: Status transitions and failures
系统 MUST 遵循以下状态转换：

- ingest 成功：`processing -> ready`（解析 + 嵌入 + 向量写入）
- ingest 失败：`processing -> failed`（写入 `error_message`）

对运行时异常（解析/嵌入/向量写入发生异常）Source 记录 MUST 保留且 `status = failed`，客户端收到 500（Ingestion failed）。

对确定性用户输入错误（例如空文件/空内容）系统 MUST 返回 400，且 MUST NOT 创建 Source 记录（因此不会出现 `failed` Source）。

#### Scenario: Runtime failure after Source creation
- **WHEN** Source 已创建且在解析/嵌入/向量写入阶段发生异常
- **THEN** Source 保留并标记为 `failed`，客户端收到 500

#### Scenario: Deterministic user error does not create Source
- **WHEN** 上传内容为空或无可索引内容
- **THEN** 系统返回 400 且不创建 Source
