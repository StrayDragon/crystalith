---
depends_on: ['c117-b-zone-ingestion-and-research']
branch: sdd/c118-b-zone-frontend-components
base_branch: main
base_sha: b36de59d6d1408a2c2646275c3f35257d9fb9414
---

# B 区第四批：前端组件与静态扫描（37 条）

## Why

B 区最后一大块：workspace-ui-panels（17）、workspace-ui-core（5）、studio-output-types（5）、deep-research-ui（9）、frontend-eden-migration（1）。web 侧 Rstest 组件测试基建已存在（OutputContent.test.tsx、ChatPanel.test.tsx、useWorkspaceReadiness.test 等先例），本批沿用既有模式补测试，无需新基建决策。

## What Changes

- 新增/扩展 apps/web Rstest 组件/hook 测试与 1 个静态扫描测试（frontend-eden-migration r158 禁 snake-to-camel 归一化），覆盖上述 37 条中可 hermetic 验证者；studio-output-types r306 为 server 侧 FK 断言。
- 已覆盖规则补嵌套场景（锚定新测试）；无法 hermetic 验证的保持裸规则并记录。
- 不改产品代码；测试暴露缺陷报告不动手。

## Capabilities

workspace-ui-panels、workspace-ui-core、studio-output-types、deep-research-ui、frontend-eden-migration

## Impact

review `pending` 144 → 126（18 条覆盖 / 5 条产品缺口保持裸规则：r405 tool_use 白名单、r411 三 tab、r413 消息状态派生、r416 面板级错误快照、r417 非上传区拖拽均无前端实现）。深研 ui 9 与 studio-output-types B 类顺延后续 change。
