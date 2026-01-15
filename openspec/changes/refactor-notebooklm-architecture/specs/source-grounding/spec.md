## ADDED Requirements

> **背景**：Source-Grounding（基于来源的回复）是 NotebookLM 的核心机制。
> 这一机制确保 AI 的每一个回答都严格基于用户上传的文档，并附带内联引用（Inline Citations），
> 清晰标注答案的每一句话来自哪篇文档、哪一页、哪一段。
> 这种设计彻底解决了 AI 的"幻觉"问题，使 NotebookLM 从一个"创意玩具"转变为一个"严谨的研究工具"。
> 用户点击引用标记就能立刻跳转到原文中论述这一点的详细段落。

### Requirement: 来源锚定机制
系统必须确保所有 AI 回答严格基于用户提供的来源，实现 Source-Grounding，不引入外部知识。

#### Scenario: 基于来源的回答
- **WHEN** 用户提问
- **THEN** 系统仅使用检索到的来源内容生成回答，不引入训练数据中的外部知识

### Requirement: 精确引用定位
系统必须提供精确到段落或页码的引用定位，支持用户追溯原文。

#### Scenario: 引用定位
- **WHEN** 系统生成包含引用的回答
- **THEN** 每个引用包含：来源文件名、页码（如适用）、段落索引、chunk_id、原文片段（前 200 字符）

### Requirement: 内联引用格式
系统必须在回答中使用内联引用标记，便于用户识别和交互。

#### Scenario: 内联引用
- **WHEN** 回答引用来源内容
- **THEN** 使用 `[1]`、`[2]` 等数字标记，标记可点击，跳转到引用详情

### Requirement: 来源验证
系统必须验证引用的有效性和准确性，确保引用真实存在。

#### Scenario: 验证引用
- **WHEN** 生成引用
- **THEN** 系统检查引用的 chunk_id 存在、内容匹配、来源未被删除

### Requirement: 无证据检测
系统必须检测并提示无法从来源中找到证据的情况，避免生成无根据的回答。

#### Scenario: 无证据提示
- **WHEN** 检索结果相似度低于阈值（默认 0.2）或无匹配结果
- **THEN** 系统返回 "来源中未找到相关证据" 提示，evidence 字段为 false，不生成猜测性回答

### Requirement: 置信度评分
系统必须为回答提供置信度评分，帮助用户判断回答可靠性。

#### Scenario: 置信度评分
- **WHEN** 生成回答
- **THEN** 系统计算并返回置信度分数（0-1），基于：检索相似度平均值、来源覆盖率、引用数量

### Requirement: 引用聚合
系统必须支持将多个相关引用聚合展示，减少视觉干扰。

#### Scenario: 聚合同源引用
- **WHEN** 多个引用来自同一来源文件
- **THEN** 系统将其聚合展示，显示来源名称和引用数量（如 "需求说明.md [3 处引用]"）

### Requirement: 引用排序
系统必须按相关性对引用进行排序。

#### Scenario: 引用排序
- **WHEN** 展示引用列表
- **THEN** 按相似度分数降序排列，最相关的引用排在前面

---

## 技能要求

### 后端实现技能

1. **uv Python 项目管理** (`uv`)
   - 无需新增依赖

2. **Python 测试** (`python-testing`)
   - 测试引用生成逻辑
   - 测试无证据检测
   - 测试置信度计算

3. **Prompt 工程**
   - 系统提示强调"仅使用提供的来源"
   - 要求 LLM 在回答中标注引用编号
   - 提供无证据时的标准回复模板

4. **API 设计**
   - 扩展 QAResponse 模型，增加 confidence 字段
   - Citation 模型增加 page_number, paragraph_index 字段

### 代码组织

```
backend/py/src/crystalith/
├── ai/
│   └── grounding.py            # Source-Grounding 逻辑
├── api/
│   └── qa.py                   # 修改现有 QA API
└── schemas/
    └── qa.py                   # 扩展 QAResponse, Citation
```

### 增强的 Citation 模型

```python
class Citation(BaseModel):
    source_id: int
    source_name: str
    chunk_id: int
    chunk_index: int
    page_number: int | None      # PDF 页码
    paragraph_index: int | None  # 段落索引
    snippet: str                 # 原文片段（前 200 字符）
    score: float                 # 相似度分数

class QAResponse(BaseModel):
    answer: str
    citations: list[Citation]
    evidence: bool               # 是否有证据支持
    confidence: float            # 置信度 0-1
    created_at: datetime
```

### Prompt 模板

```python
GROUNDING_SYSTEM_PROMPT = """
You are a research assistant. Answer ONLY using the provided sources.
- If sources are insufficient, say "来源中未找到相关证据".
- Use [1], [2] etc. to cite sources inline.
- Do NOT use any external knowledge.
"""
```
