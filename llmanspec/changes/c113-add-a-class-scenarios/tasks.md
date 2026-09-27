# Tasks — c113-add-a-class-scenarios

> 计数类判据在 change 绑定分支上相对 merge-base 测量。

## t1 — 分片补场景（6 组串行，agent 落笔 + 逐组结构校验）

- [ ] t1.1 组1：workspace-api-contract（17A）
- [ ] t1.2 组2：source-ingestion 五件套（26A：connectors 6 / core 5 / upload-url 5 / mgmt-tags 5 / summary 5）
- [ ] t1.3 组3：openapi 4 / data-and-storage 2 / retrieval-and-cache 7 / web-extractor-plugins 4 / frontend-eden-migration 3
- [ ] t1.4 组4：output-rendering-and-typing 8 / chat-prompt-presets 4 / architecture-core 3 / architecture-plugin-and-agent 3
- [ ] t1.5 组5：generation-core 9 / workspace-ui-core 8 / studio-slides-workflow 11
- [ ] t1.6 组6：workspace-ui-panels 4 / studio-output-types 2 / generation-presets 1 / quality-and-regression 1 / generation-observability 1 / typed-generation 1

## t2 — 门禁

- [ ] t2.1 `just check-req-ids` 0 碰撞；`llman-sdd validate --specs --strict` 35/35。
- [ ] t2.2 review `pending` 下降数 == 本批实际补场景数（B/C 保持裸规则）；`spec next-req-id` 仍为 r474。
- [ ] t2.3 `just qa` 全绿。
