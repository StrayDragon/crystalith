## 背景

当用户积累了多个 notebook 后，下一层需求不是把它们全部糊成一个万能容器，而是需要一个更大的工作现场，让多个 notebook 能在特定上下文下被组织、检索和产出。collection 的价值在于放大空间层，而不是吞掉 notebook 的边界。

## 已确定决策

### D1：collection 是 notebook 之上的聚合层
- collection 通过绑定多个 notebook 构成更大的工作现场。
- notebook 自身身份、边界和已有能力必须保留。

### D2：collection 需要自己的检索与导航语义
- collection 不是纯列表容器。
- 它需要支持 collection-scoped 导航、检索和上下文切换。

### D3：collection 不重写 notebook 语义
- collection 不替代 notebook。
- notebook 仍然是基础工作单元和来源归属边界。

### D4：v1 不做万能空间平台
- collection 先解决多 notebook 组织与工作上下文问题。
- collection 级模板、审阅和发布联动后置。

## 已确定的具体定义

### Collection 级上下文与 Notebook 上下文的共存

- 在 collection 上下文中进行生成/检索时，系统合并所有成员 notebook 的来源
- 来源保留 notebook 归属标签：`source.notebook_id` 始终可追溯
- collection 级配置（如默认生成类型、预设）可覆盖 notebook 级默认值
- 冲突处理优先级：collection 级 > notebook 级 > 系统默认

### 结果的 Notebook 来源归属

- collection 级生成的结果标记 `generated_in: collection_id`
- 结果中每条 citation 保留 `source_notebook_id`，用户可以追溯到具体 notebook
- 结果本身归属于 collection，但保留对来源 notebook 的引用

## collection 与 notebook 的绑定关系、身份边界与作用域（v1）

### 对象模型（最小集合）

```yaml
Collection:
  id: string
  workspace_id: string
  name: string
  description: string | null
  created_at: time
  updated_at: time
  notebook_ids: list[string]          # 绑定的成员 notebooks
  defaults:                           # collection 级默认配置（覆盖 notebook 级）
    generation_type_id: string | null
    preset_id: string | null
    source_mode: string | null
```

- collection 是 notebook 之上的聚合层：它不拥有“新的一套内容存储”，而是通过 `notebook_ids` 引用成员 notebook。
- v1 允许一个 notebook 绑定到多个 collections（多对多）；collection 也可动态增删成员 notebook。
- collection 可以为空（尚未绑定 notebook），但在为空时不提供检索/生成能力，只用于配置与组织。

### 身份边界（谁是谁）

- notebook 仍然是来源对象（sources）的归属边界：`source.notebook_id` 永远指向一个具体 notebook。
- collection 是“工作上下文”的归属边界：collection-scoped 的生成结果标记 `generated_in=collection_id`。
- collection 不重写 notebook 的名称、导航与内容结构；它只聚合与过滤。

### 作用域（scope）

- **collection-scoped 检索/QA/生成**：在 member notebooks 的来源集合上工作。
- **notebook-scoped 检索/QA/生成**：仍然只在单 notebook 范围内工作。
- UI 必须让用户显式知道当前上下文是哪一种 scope，避免误解“为什么检索结果来自别的 notebook”。

## collection-scoped 检索与导航的最小语义

### 检索语义

- collection-scoped 检索 = 对 member notebooks 的 sources 做联合检索：
  - 检索结果必须携带 `source_notebook_id`，用于展示归属与回溯入口。
  - UI 支持按 notebook 过滤（例如只看某个成员 notebook 的结果）。
- 排序/融合策略 v1 最小约束：
  - 在不丢失归属信息的前提下合并结果列表
  - 不在本 change 中引入跨 notebook 的复杂重排解释（后置）

### 导航语义

- collection 视图至少包含：
  - 成员 notebooks 列表（可跳转到 notebook）
  - collection 内的结果/产物入口（例如 results/artifacts 的 collection 过滤视图）
  - collection 内的 sources 聚合视图（按 notebook 分组展示）

## 接口语义（v1）

### collection 列表与详情

- `GET /v1/collections`：列出当前 workspace 的 collections（含 notebook_ids、defaults 概览）
- `POST /v1/collections`：创建 collection（允许为空）
- `GET /v1/collections/{collection_id}`：获取详情
- `PATCH /v1/collections/{collection_id}`：更新 name/description/defaults

### 绑定 notebook

- `POST /v1/collections/{collection_id}/notebooks`：绑定 notebook（追加到 notebook_ids）
- `DELETE /v1/collections/{collection_id}/notebooks/{notebook_id}`：解绑 notebook

### 上下文切换

- 前端在 workspace 级保存“当前上下文”：
  - `active_scope = notebook_id | collection_id`
- 切换 scope 不改变 notebook 本身数据，只改变检索/生成等行为的作用域参数。

## 产品体验（v1）

### 入口与主要视图

- workspace 左侧导航增加 “Collections” 分组。
- 进入某个 collection 后，顶部显式展示：
  - collection 名称
  - 成员 notebooks 数
  - 当前 scope 标记（Collection）
- 主视图建议三栏：
  - 成员 notebooks（左）
  - collection 工作对象（中：results/artifacts 快捷入口）
  - sources 聚合/筛选（右或 tab）

### 如何成为更大的工作现场（而不是更复杂的容器）

- collection 的核心价值是“把多个 notebook 组合成一次工作的上下文”，而不是增加新的嵌套层级。
- v1 不提供：
  - collection 内再嵌套 collection
  - collection 级复杂权限与角色
  - 把 notebook 的所有设置复制一份到 collection
- collection 的 defaults 只覆盖少量高价值项（生成类型/预设/来源模式等），避免配置爆炸。

### 后置：collection 级模板、审阅、发布联动

- collection 级模板、审阅、发布联动明确后置；v1 只提供聚合上下文与最小检索/导航语义。

### 后置项说明

- D4 中的"collection 级模板、审阅和发布联动"后置条件：**待 collection 基本功能验证后评估，属于"确认需要但延迟"类型**
- 权限系统（如果引入）：**不确定是否需要，待产品方向明确后观察**

## 非目标

- 不把 collection 做成万能容器。
- 不吞掉 notebook 的身份、导航和边界。
- 不在本 change 中扩展 collection 级模板、审阅和发布联动。
