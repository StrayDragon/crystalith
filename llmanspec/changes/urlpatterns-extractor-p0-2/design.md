# Design — urlpatterns-extractor-p0-2

## 决策摘要

在 extractor 插件接口上声明可选 `urlPatterns`（regex source 字符串数组），经
`listExtractorMetadata` → `GET /extractors` 透出；前端在 URL 导入对话框 fetch 模式
本地匹配并展示轻量推荐行，提交时复用既有 `extractor` 请求字段。

## 权衡

### urlPatterns 放插件接口 vs 独立端点

| 方案                           | 优点                                       | 缺点                                                |
| ------------------------------ | ------------------------------------------ | --------------------------------------------------- |
| **插件接口字段（选用）**       | 与提取器元数据同源；无额外请求；插件自描述 | 需在 `CrystalithPlugin` 扩展可选字段                |
| 独立 `/extractor-url-patterns` | 与插件解耦                                 | 第二份 SSOT；前端多一次请求；与 extractors 列表重复 |

选用插件接口字段：`urlPatterns` 是提取器自描述元数据，与 `displayName`/`capabilities`
同级，不应拆端点。

### from-url `extractor` 白名单校验位置

| 方案                                                           | 优点                                            | 缺点                         |
| -------------------------------------------------------------- | ----------------------------------------------- | ---------------------------- |
| **shared schema 格式校验 + 路由/服务层 registry 校验（选用）** | 与 PATCH extractors 一致；支持动态插件（arxiv） | 两处校验（格式 vs 存在性）   |
| shared schema 硬编码白名单（现状）                             | 简单                                            | 无法传 `arxiv`；与插件化矛盾 |

修法：`SourceFromUrlRequestSchema.extractor` 放宽为「可空小写标识符」；
`ingestFromUrl` 在 fetch 模式且 `extractor` 非空时调用 `extractorNames()` 校验，
未知名抛 `INVALID_REQUEST`（与 PATCH policy 同文案风格）。

### 前端匹配与提交语义

- 匹配：纯函数 `matchExtractorsForUrl(url, extractors)`，对每个 extractor 的
  `urlPatterns` 做 `new RegExp(pattern)`（try/catch 跳过非法 pattern），仅考虑
  `enabled && available` 的项。
- UI：仅 fetch 模式展示推荐行；link 模式零提取器 UI。
- 预选：命中项默认勾选；用户可取消勾选（「增删」= 勾选/取消，不另做全量 picker，
  非命中提取器仍由 ExtractorPolicyDialog 管理——out of scope）。
- 提交：有且仅有一个逻辑选中项时传 `extractor`；多命中默认全勾选时取 **priority
  最高（数值最小）** 的一项；全无勾选 → `extractor: null` 走默认链。
- **铁律**：urlPatterns 不改变服务端 `extractUrl` fall-through；显式 `extractor`
  仅收窄**单次请求**的尝试顺序（既有 `order = [extractor]` 语义），与 r55 一致。

## 偏差记录

（实施时填写；当前与 proposal 一致。）
