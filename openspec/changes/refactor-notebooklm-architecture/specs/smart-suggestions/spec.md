## ADDED Requirements

### Requirement: 问题生成
系统必须能够基于文档内容自动生成建议问题。

#### Scenario: 生成建议问题
- **WHEN** 用户打开 Notebook
- **THEN** 系统生成 3-5 个与来源内容相关的建议问题

### Requirement: 上下文感知建议
系统必须根据会话历史生成上下文相关的建议。

#### Scenario: 上下文建议
- **WHEN** 用户在会话中提问后
- **THEN** 系统生成与当前话题相关的后续问题建议

### Requirement: 深度问题引导
系统必须支持苏格拉底式的深度问题引导。

#### Scenario: 深度引导
- **WHEN** 用户选择 "深入探索" 选项
- **THEN** 系统生成引导用户深入思考的问题序列

### Requirement: 问题分类
系统必须对建议问题进行分类。

#### Scenario: 问题分类
- **WHEN** 生成建议问题
- **THEN** 系统标注问题类型：事实性、分析性、比较性、创意性

### Requirement: 建议刷新
系统必须支持刷新建议问题。

#### Scenario: 刷新建议
- **WHEN** 用户点击刷新按钮
- **THEN** 系统生成新的建议问题集

### Requirement: 建议 API
系统必须提供建议问题的 REST API。

#### Scenario: 建议 API
- **WHEN** 客户端调用 `/v1/notebooks/{id}/suggestions` 端点
- **THEN** 系统返回建议问题列表，包含问题文本和类型

#### Scenario: 会话建议 API
- **WHEN** 客户端调用 `/v1/sessions/{id}/suggestions` 端点
- **THEN** 系统返回基于会话上下文的建议问题

---

## 技能要求

### 后端实现技能

1. **uv Python 项目管理** (`uv`)
   - 无需新增依赖

2. **Python 测试** (`python-testing`)
   - 测试问题生成逻辑
   - 测试问题分类
   - Mock LLM 响应

3. **Prompt 工程**
   - 设计问题生成 Prompt
   - 设计问题分类 Prompt
   - 设计深度引导 Prompt

4. **API 设计**
   - Suggestion 模型包含 question, type, context
   - 支持刷新（重新生成）

### 前端实现技能

1. **UI/UX Pro Max** (`ui-ux-pro-max`)
   - 建议问题使用卡片样式
   - 问题类型使用不同颜色标签
   - 点击问题自动填充到输入框
   - 刷新按钮使用旋转动画

2. **Vercel React Best Practices** (`vercel-react-best-practices`)
   - 使用 SWR 获取建议，支持刷新
   - 建议列表使用 `useMemo` 缓存

3. **Web Interface Guidelines** (`web-design-guidelines`)
   - 建议卡片可通过键盘选择
   - 问题类型标签有 `aria-label`

### 代码组织

**后端**：
```
backend/py/src/crystalith/suggestions/
├── __init__.py
├── types.py                    # SuggestionType 枚举
├── generator.py                # 问题生成逻辑
└── api.py                      # Suggestions API
```

**前端**：
```
frontend/web/src/features/workspace/components/
├── SuggestionPanel.tsx         # 建议面板
├── SuggestionCard.tsx          # 单个建议卡片
└── SuggestionTypeTag.tsx       # 类型标签
```

### 问题类型

```python
class SuggestionType(StrEnum):
    FACTUAL = "factual"         # 事实性问题
    ANALYTICAL = "analytical"   # 分析性问题
    COMPARATIVE = "comparative" # 比较性问题
    CREATIVE = "creative"       # 创意性问题
    DEEP_DIVE = "deep_dive"     # 深度探索
```
