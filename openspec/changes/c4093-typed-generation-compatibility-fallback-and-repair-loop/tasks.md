## 1. Compatibility control plane

- [ ] 1.1 定义 generation type 上的 compatibility、fallback 和 repair hooks
- [ ] 1.2 定义 model capability profile、output compatibility 与 preflight 分类
- [ ] 1.3 定义 hard block、soft warning、fallback-eligible 的稳定判定边界

## 2. Recovery loop

- [ ] 2.1 定义 structured generation error taxonomy 与 retry buckets
- [ ] 2.2 定义 safe degradation 的能力损失说明和结果状态
- [ ] 2.3 定义 output validation repair 的 auto/confirm/rerun 边界

## 3. Pipeline and UX integration

- [ ] 3.1 定义 generation core 如何接入 preflight、bucketed decision 和 repair loop
- [ ] 3.2 定义生成入口和结果页的兼容性、降级、重试与修补解释
- [ ] 3.3 复核 typed generation framework 成为唯一治理控制面且没有输出类型私有 recovery 真相

## 4. Verification

- [ ] 4.1 复核 merged proposal 已吸收 `c1014`、`c2065`、`c2068`、`c2071`、`c2218` 的核心约束
- [ ] 4.2 复核 preflight、fallback、retry、repair 语义互相支撑且边界清晰
- [ ] 4.3 运行 `openspec validate c4093-typed-generation-compatibility-fallback-and-repair-loop`
