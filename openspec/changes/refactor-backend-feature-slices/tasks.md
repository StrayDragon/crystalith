## 1. Preparation
- [x] 1.1 盘点现有后端模块依赖与循环导入点（记录现状与迁移优先级）
- [x] 1.2 确定业务域切片清单与模块归属（例如 notebooks/sources/research/outputs/studio/analysis/tasks 等）
- [x] 1.3 明确 TDD 范围与 tests2 目录结构（pytest 发现路径与执行命令）
- [x] 1.4 新增临时测试命令 `just test2`（仅跑 tests2）

## 2. Structure Refactor
- [x] 2.1 创建 `crystalith/features/`、`crystalith/shared/`、`crystalith/web/` 目录结构与最小 `__init__`
- [x] 2.2 创建 `tests2/` 并搭建最小 pytest 结构（TDD 起步）
- [x] 2.3 迁移共享基础设施到 `shared`（config/db/ai/vector_storage/utils/search/parsers/schemas）
- [x] 2.4 迁移业务域 feature 到 `features/<feature>/`（api/service/repo/schemas 等）
- [x] 2.5 更新 `crystalith/web/app.py` 与路由注册（统一聚合 routers）

## 3. Dependency Hygiene
- [x] 3.1 统一依赖方向（web -> features -> shared），移除反向引用
- [x] 3.2 处理跨 feature 依赖（抽取 shared 接口或服务门面）
- [x] 3.3 清理 `__init__` 中的 eager import，避免隐式循环
- [x] 3.4 添加 `just check-imports` 静态检查（rg 规则），阻止运行时层级反向导入

## 4. Compatibility & Cleanup
- [x] 4.1 更新内部文档与 README（结构图/入口路径）
- [x] 4.2 完成 `tests2` 覆盖后，移除旧 `tests/` 与 `crystalith/`
- [x] 4.3 重命名 `crystalith2 -> crystalith`、`tests2 -> tests`

## 5. Verification
- [x] 5.1 `cd backend/py && just test2`（迁移期间）
- [x] 5.2 `cd backend/py && just test`（切换前后各执行一次）
- [x] 5.3 手工启动 `cd backend/py && just dev` 验证 API 路由加载
