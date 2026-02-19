## 1. Postprocessing module

- [x] 1.1 设计并实现 `postprocess_output(output_type, content, ...) -> (content, warnings)` 的公共入口
- [x] 1.2 为核心 output_type 实现确定性规则（FAQ/GUIDE/TIMELINE/MINDMAP/QUIZ/BRIEFING/BULLETS/STRUCTURED/PARAGRAPH）

## 2. Citations sanitization

- [x] 2.1 在 citations 映射前清洗 citations 索引（非整数/重复/越界）
- [x] 2.2 为 citations 兜底策略添加最小规则（避免关键字段完全无引用）

## 3. Integrate into OutputGraph

- [x] 3.1 在 GenerateOutput 与 MapCitations 之间加入 postprocessing 步骤（新节点或等价逻辑）
- [x] 3.2 将 `_warnings` 等元信息以兼容方式写入输出 content（不影响现有渲染）

## 4. Optional: repair pass (quality)

- [ ] 4.1 增加 repair 开关与触发条件（仅 quality，最多 1 次）
- [ ] 4.2 实现 repair prompt 与修复执行（失败回退到确定性后处理/原 fallback）

## 5. Verification

- [x] 5.1 为每个 output_type 增加后处理 golden cases（输入→输出可渲染且稳定）
- [ ] 5.2 回归：前端插件渲染不再因空列表/缺字段而崩溃或降级为 raw JSON
