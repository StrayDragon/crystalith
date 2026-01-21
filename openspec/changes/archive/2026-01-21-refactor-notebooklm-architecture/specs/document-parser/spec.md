## ADDED Requirements

### Requirement: 文档解析器接口
系统 MUST提供 `Parser` 抽象接口，定义文档解析的标准操作。

#### Scenario: 定义解析器接口
- **WHEN** 开发者需要实现新的文档解析器
- **THEN** 系统提供 `Parser` Protocol，包含 `parse(content: bytes) -> list[Chunk]` 方法

### Requirement: 文本文档解析
系统 MUST支持解析纯文本和 Markdown 文档。

#### Scenario: 解析 Markdown 文件
- **WHEN** 用户上传 `.md` 文件
- **THEN** 系统使用 `TextParser` 解析内容，按段落分块

### Requirement: PDF 文档解析
系统 MUST支持解析 PDF 文档，提取文本内容。

#### Scenario: 解析 PDF 文件
- **WHEN** 用户上传 `.pdf` 文件
- **THEN** 系统使用 `PDFParser` 提取文本，按页面/段落分块，保留页码信息

#### Scenario: PDF 解析失败
- **WHEN** PDF 文件损坏或加密
- **THEN** 系统返回解析错误，Source 状态设为 `FAILED`

### Requirement: 网页内容解析
系统 MUST支持解析 HTML 网页内容。

#### Scenario: 解析网页链接
- **WHEN** 用户提交网页 URL
- **THEN** 系统抓取网页内容，使用 `HTMLParser` 提取正文，过滤导航/广告

### Requirement: 音频内容解析
系统 MUST支持解析音频文件，转换为文本。

#### Scenario: 解析音频文件
- **WHEN** 用户上传 `.mp3` 或 `.wav` 文件
- **THEN** 系统使用 Whisper API 转录音频，生成文本分块

### Requirement: 视频内容解析
系统 MUST支持解析视频文件，提取音频并转换为文本。

#### Scenario: 解析视频文件
- **WHEN** 用户上传视频文件或 YouTube 链接
- **THEN** 系统提取音频轨道，使用 Whisper API 转录，生成文本分块

### Requirement: 解析器工厂
系统 MUST提供 `ParserFactory`，根据文件类型自动选择合适的解析器。

#### Scenario: 自动选择解析器
- **WHEN** 用户上传文件
- **THEN** 系统根据 MIME 类型或文件扩展名选择对应的解析器

### Requirement: 解析元数据
系统 MUST在解析过程中提取并保存文档元数据。

#### Scenario: 保存解析元数据
- **WHEN** 文档解析完成
- **THEN** 系统保存元数据（页数、字数、解析时间、解析器类型）到 Source 记录

---

## 技能要求

### 后端实现技能

1. **uv Python 项目管理** (`uv`)
   - PDF 解析：`uv add pypdf` 或 `uv add pdfplumber`
   - HTML 解析：`uv add beautifulsoup4 lxml`
   - 音频转文本：`uv add openai-whisper` 或使用 OpenAI API

2. **Python 测试** (`python-testing`)
   - 准备测试文件（txt, md, pdf, html）
   - 测试解析结果的 chunk 数量和内容
   - 测试错误处理（损坏文件、加密 PDF）

3. **Ruff 代码质量** (`ruff`)
   - Parser Protocol 使用 `typing.Protocol`
   - 异步解析使用 `async def parse`

4. **异步处理**
   - 大文件解析使用后台任务
   - 更新 Source 状态：PROCESSING → READY/FAILED

### 代码组织

```
backend/py/src/crystalith/parsers/
├── __init__.py
├── interfaces.py               # Parser Protocol
├── types.py                    # ParseResult, ChunkInfo
├── text.py                     # TextParser (txt/markdown)
├── pdf.py                      # PDFParser
├── html.py                     # HTMLParser
├── audio.py                    # AudioParser (Whisper)
├── video.py                    # VideoParser (提取音频)
├── factory.py                  # ParserFactory
└── utils.py                    # 分块工具函数
```

### MIME 类型映射

| MIME Type | Parser | 扩展名 |
|-----------|--------|--------|
| text/plain | TextParser | .txt |
| text/markdown | TextParser | .md, .markdown |
| application/pdf | PDFParser | .pdf |
| text/html | HTMLParser | .html, .htm |
| audio/mpeg | AudioParser | .mp3 |
| audio/wav | AudioParser | .wav |
| video/mp4 | VideoParser | .mp4 |
