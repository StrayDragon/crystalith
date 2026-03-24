## 1. Locator and evidence chain

- [ ] 1.1 定义 CitationV2 locator、anchor confidence 与 span normalization
- [ ] 1.2 定义 remap、backfill、review queue 与 fix sweeps 语义
- [ ] 1.3 定义 source highlights、hover proof 与 sidecar 复用边界

## 2. Claim extraction and grading

- [ ] 2.1 定义 source-to-claim extraction workbench 与 candidate 状态
- [ ] 2.2 定义 claim strength、evidence weight 与 weakness types
- [ ] 2.3 定义 support balance、counterevidence quota 与 pressure tests

## 3. Claim map and traceback

- [ ] 3.1 定义 claim map 的最小对象与关系
- [ ] 3.2 定义 argument traceback 从输出段落回到 claim/source 的路径
- [ ] 3.3 复核审读模式与 review queue 使用同一定位规则

## 4. Review workflow

- [ ] 4.1 定义 citation/claim 问题如何进入 evidence review
- [ ] 4.2 定义 review note、repair action 与 confirmation 边界
- [ ] 4.3 复核低 confidence 与弱证据问题都能进入可运营队列

## 5. Verification

- [ ] 5.1 复核 merged proposal 没有重复定义 citation/claim/traceback 语义
- [ ] 5.2 复核旧 change 的关键信息都已被新 change 收口
- [ ] 5.3 运行 `openspec validate c4071-citation-claim-review-and-traceback-loop`
