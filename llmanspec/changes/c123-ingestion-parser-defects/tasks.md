# Tasks

- [ ] t1 parser 选择修复 + 415：`parser-registry.ts` 移除前缀匹配与默认回退、显式覆盖走 `getParser`；`errors.ts` 增 `UNSUPPORTED_MEDIA_TYPE`(415)；pipeline 无匹配/未知覆盖 → 415 + details{mimeType,filename,pluginHint}。验证：新 `tests/sources/parser-selection.test.ts` 选择矩阵与 415 分支全绿。
- [ ] t2 [blocked-by: t1] markdown 预处理：新 `markdown-preprocess.ts`（wikilink 归一 + frontmatter 提取/剥离），pipeline 接入并写 `source.metadata.frontmatter`。验证：同测试文件预处理用例全绿 + 零扰动对照。
- [ ] t3 [blocked-by: t2] specs 收口：r257/r258/r295/r287/r464/r465 场景化 + r52 改写为字节持久化合约并补场景（contentStorage 往返）。验证：validate specs 通过；review unbound 79 → 72。
- [ ] t4 [blocked-by: t3] 回归收口：`just test-bdd` + `just qa` 全绿；作战地图同步（finalize 后 main 提交）。
