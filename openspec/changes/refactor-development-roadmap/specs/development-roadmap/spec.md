# Development Roadmap Specification

## Overview

本规范定义 Crystalith 项目的开发路线图结构和执行原则。

---

## ADDED Requirements

### Requirement: Roadmap Document Structure
路线图文档 (`PLANS.md`) 必须包含以下章节：
1. Project Snapshot（项目现状快照）
2. Assumptions & Open Questions（假设与待确认问题）
3. Dependency Graph（依赖关系图）
4. Task Breakdown（任务详细分解）
5. Execution Phases（执行阶段）
6. Risk Matrix（风险矩阵）
7. Definition of Done（完成标准）

#### Scenario: Roadmap document exists
- Given 项目根目录
- When 检查 `PLANS.md` 是否存在
- Then 文件存在且包含所有必需章节

### Requirement: Task Dependency DAG
任务依赖关系必须形成有向无环图（DAG），使用 Mermaid 语法定义。

#### Scenario: No circular dependencies
- Given 依赖关系图定义
- When 验证图结构
- Then 不存在循环依赖

### Requirement: Low Priority Warning
路线图变更提案必须包含低优先级警告，提示用户在有其他活跃 changes 时不应执行。

#### Scenario: Warning displayed in proposal
- Given `refactor-development-roadmap/proposal.md`
- When 读取文件内容
- Then 包含 "LOW PRIORITY" 警告
- And 包含活跃 changes 检查提示

---

## Cross-references

- 关联规范：所有 14 个活跃变更提案
- 关联文档：`PLANS.md`, `NEXT.md`
