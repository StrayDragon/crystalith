## 1. Packaging and versions

- [ ] 1.1 定义 knowledge pack 的对象边界与最小元数据
- [ ] 1.2 定义 artifact version history、release channels 与 stable refs
- [ ] 1.3 定义 Git/PR-based publishing 与 release history 的衔接方式

## 2. Interoperability and review bundles

- [ ] 2.1 定义 notebook import/export formats 与 downgrade/fidelity report
- [ ] 2.2 定义 reading packets、evidence packets 与 offline review bundles 的关系
- [ ] 2.3 定义 review bundle 与正式 artifact / version / provenance 的回链规则

## 3. Delivery flow coherence

- [ ] 3.1 定义 pack、version、export 与 review bundle 的统一交付链
- [ ] 3.2 定义哪些对象可作为正式发布源，哪些只作为审读/中间态
- [ ] 3.3 复核 packaging / versioning / interoperability 语义互相支撑

## 4. Verification

- [ ] 4.1 复核 merged proposal 已吸收 4 个旧 change 的关键约束
- [ ] 4.2 复核没有留下平行的导出/发布/审读真相
- [ ] 4.3 运行 `openspec validate c4084-artifact-packaging-versioning-interoperability-and-review-bundles`
