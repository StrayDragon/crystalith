## 1. Define dataset and report schema

- [x] 1.1 定义评测样例数据格式（prompt/output_type/preference/最小约束），并提供少量代表性样例
- [x] 1.2 定义评测报告结构（JSON）：包含样例级结果与汇总统计（pass/fallback/repair、citations 合法性、timings、query_count）

## 2. Implement evaluation runner

- [x] 2.1 在 `backend/py/scripts/` 实现评测 runner（默认不依赖外网/真实模型）
- [x] 2.2 支持可选切换到真实模型进行对比（明确开关与安全提示）
- [x] 2.3 输出人类可读汇总（Markdown/console）与机器可读 JSON

## 3. CI + docs

- [x] 3.1 增加运行入口（just task 或文档命令），并说明如何生成/对比基线
- [x] 3.2 在 CI 中以非阻塞方式运行并上传报告 artifact（后续再引入 gating）

## 4. Tests

- [x] 4.1 为关键指标计算与数据解析添加单元测试（不依赖网络）
