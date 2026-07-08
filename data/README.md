# data（运行时数据目录）

> 本目录存放运行时产生的数据：SQLite 数据库、向量索引、预览/导出产物等。
> 默认被 Git 忽略（`.gitignore` 包含 `data/`），不应提交真实数据文件。

## v2 用途

- SQLite 数据库文件（`crystalith.db`）— 包含业务数据 + sqlite-vec 向量索引，同库一体
- 导出/输出产物 — 按 session 或输出类型分目录存放
- 上传文件暂存 — source ingestion 时的临时文件

## 约定

- 所有持久化数据落在这个目录下
- 可通过环境变量 `CRYSTALITH_DATA_DIR` 覆盖默认路径
- 备份：直接复制整个 `data/` 目录即可（单文件 SQLite 架构）
