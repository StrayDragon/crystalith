## ADDED Requirements

### Requirement: 多源关联检测
系统 MUST能够检测不同来源之间的内容关联。

#### Scenario: 检测关联
- **WHEN** 用户请求分析多个来源
- **THEN** 系统识别相似主题、引用关系、补充信息

### Requirement: 主题聚类
系统 MUST支持基于向量相似度的主题聚类。

#### Scenario: 主题聚类
- **WHEN** Notebook 包含多个来源
- **THEN** 系统自动识别主要主题，将相关 chunks 聚类

### Requirement: 矛盾检测
系统 MUST能够识别不同来源中的矛盾或对立观点。

#### Scenario: 检测矛盾
- **WHEN** 用户请求矛盾分析
- **THEN** 系统识别并高亮显示来源间的矛盾点

### Requirement: 关联可视化
系统 MUST提供来源关联的可视化展示。

#### Scenario: 关联图谱
- **WHEN** 用户查看分析结果
- **THEN** 系统展示来源间的关联图谱（节点为来源，边为关联）

### Requirement: 跨文档问答
系统 MUST支持跨多个来源的综合问答。

#### Scenario: 跨文档问答
- **WHEN** 用户提问涉及多个来源
- **THEN** 系统综合多个来源的信息生成回答，标注各来源贡献

### Requirement: 分析 API
系统 MUST提供跨文档分析的 REST API。

#### Scenario: 分析 API
- **WHEN** 客户端调用 `/v1/notebooks/{id}/analysis` 端点
- **THEN** 系统返回主题聚类、关联检测、矛盾检测结果

---

## 技能要求

### 后端实现技能

1. **uv Python 项目管理** (`uv`)
   - 聚类算法：`uv add scikit-learn`（可选）
   - 或使用向量相似度进行简单聚类

2. **Python 测试** (`python-testing`)
   - 测试关联检测逻辑
   - 测试主题聚类
   - Mock 向量存储

3. **算法设计**
   - 关联检测：基于向量余弦相似度
   - 主题聚类：K-means 或层次聚类
   - 矛盾检测：使用 LLM 判断

### 前端实现技能

1. **UI/UX Pro Max** (`ui-ux-pro-max`)
   - 关联图谱使用简单的节点-边可视化
   - 主题聚类使用标签云或分组列表
   - 矛盾点使用警告样式高亮

2. **Vercel React Best Practices** (`vercel-react-best-practices`)
   - 分析结果使用 SWR 缓存
   - 图谱渲染使用 Canvas 或 SVG

### 代码组织

**后端**：
```
backend/py/src/crystalith/analysis/
├── __init__.py
├── types.py                    # AnalysisResult, Topic, Relation
├── correlation.py              # 关联检测
├── clustering.py               # 主题聚类
├── contradiction.py            # 矛盾检测
└── api.py                      # Analysis API
```

### 响应模型

```python
class Topic(BaseModel):
    id: str
    name: str
    chunk_ids: list[int]
    keywords: list[str]

class Relation(BaseModel):
    source_chunk_id: int
    target_chunk_id: int
    relation_type: str          # similar | references | contradicts
    score: float

class AnalysisResult(BaseModel):
    topics: list[Topic]
    relations: list[Relation]
    contradictions: list[Relation]
```
