---
depends_on: ['c116-b-zone-gates-and-server']
branch: sdd/c117-b-zone-ingestion-and-research
base_branch: main
base_sha: 49e8b0768b737b51a177ee9c15c74da21b3c36db
---

# B 区第三批：摄取/抽取族 + 深研运行时（28 条）

## Why

B 区服务侧第二批：source-ingestion 三件套与 web-extractor-plugins 的 B 类全部是 server 侧可 hermetic 验证的行为（415/413/400 状态族、markdown 预处理、CSV chunking、dedup 门控、缓存与 epoch、extractor 选择与回退、registry 形状）；deep-research-runtime 3 条（agent 页读取上限、客户端整图提交拒绝、chat 与 run 事件分离）在 research 集成面可测。

## What Changes

- 新增/扩展 server 测试覆盖上述 28 条可判定行为；对应 spec 规则补嵌套场景（锚定新测试）。
- 无法 hermetic 验证或测试暴露产品缺陷的保持裸规则并记录；产品代码零改动。

## Capabilities

source-ingestion-upload-and-url、source-ingestion-summary-and-conversion、source-ingestion-management-and-tags、web-extractor-plugins、deep-research-runtime

## Impact

review `pending` 167 → 约 139；qa 门禁内新增对应测试。
