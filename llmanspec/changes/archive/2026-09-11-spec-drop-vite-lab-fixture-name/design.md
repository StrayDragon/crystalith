# Design：spec-drop-vite-lab-fixture-name

## 1. 决策：措辞收敛而非删除约束

`VITE_LAB_FIXTURE` 已 decommission（c22ddae6：Zod env SSOT 删除条目、e2e no-op 移除、
.env.example 再生）。r400/r453 两条 `@human` 规则以变量名表述的护栏改写为配置无关表述：

### r400（Lab is the only deep-research entry and Eden-only）

|     | 表述                                                                                                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------- |
| 旧  | MUST NOT 经 `VITE_LAB_FIXTURE` 或 mode=fixture 切换为 xlsx-lib 定时回放权威                                               |
| 新  | MUST NOT 切换为 xlsx-lib 定时回放权威（fixture 切换面已废除，MUST NOT 重新引入任何 fixture 切换面，含环境变量或查询参数） |

语义：等价或更强——原约束禁止「经特定变量切换」；新约束禁止「切换」本身并禁止
重新引入任何切换面（变量、查询参数等）。

### r453（Eden Lab production e2e gate）

|     | 表述                                      |
| --- | ----------------------------------------- |
| 旧  | 在 `VITE_LAB_FIXTURE` 未设时演练 Eden Lab |
| 新  | 在默认（生产）构建配置下演练 Eden Lab     |

语义：等价——变量删除后「未设」恒真，「默认（生产）构建配置」即原条件的规范化表述。

## 2. 备选与否决

- **保留变量名**（护栏作历史证据）：否决——变量已不存在，规范文本点名查无此物，
  读者按名索骥会失败；护栏本质是行为约束而非变量博物馆。
- **直接在 main 手改**：否决——本次为 `@human` 规则文本修改，走 Git-native 生命周期
  （branch binding + `rules_edit_acked: true`），门禁 INFO 可追溯。

## 3. 影响面

- 仅 `llmanspec/specs/deep-research-ui/deep-research-ui.feature` 两条规则正文；
  场景标题、`@req` 链、Gherkin 结构不变。
- 无应用代码、wire、HTTP 合约变更。
