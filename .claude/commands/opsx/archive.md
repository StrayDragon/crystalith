---
name: "OPSX: Archive"
description: Archive a completed change in the experimental workflow
category: Workflow
tags: [workflow, archive, experimental]
---

在实验性工作流中归档已完成的变更.

**输入**:可选在 `/opsx:archive` 后指定变更名称(例如 `/opsx:archive add-auth`).如果省略,先判断是否可从对话上下文推断;若含糊或不明确,必须提示可用的变更.

**步骤**

1. **如果未提供变更名称,提示进行选择**

   运行 `openspec list --json` 获取可用变更.使用 **AskUserQuestion 工具** 让用户选择.

   仅显示活动中的变更(未归档).
   如可用,包含每个变更使用的 schema.

   **重要**:不要猜测或自动选择变更.始终让用户选择.

2. **检查工件完成状态**

   运行 `openspec status --change "<name>" --json` 检查工件完成情况.

   解析 JSON 以了解:
   - `schemaName`:正在使用的工作流
   - `artifacts`:工件列表及其状态(`done` 或其他)

   **如果存在未完成工件:**
   - 显示警告并列出未完成工件
   - 提示用户确认是否继续
   - 用户确认后继续

3. **检查任务完成状态**

   读取任务文件(通常为 `tasks.md`)以检查未完成任务.

   统计 `- [ ]`(未完成)与 `- [x]`(完成).

   **如果存在未完成任务:**
   - 显示警告并提示未完成任务数量
   - 提示用户确认是否继续
   - 用户确认后继续

   **如果没有任务文件:** 跳过任务相关警告.

4. **评估 delta 规范同步状态**

   检查 `openspec/changes/<name>/specs/` 下是否存在 delta 规范.若不存在,则无需提示同步.

   **如果存在 delta 规范:**
   - 将每个 delta 规范与对应的主规范 `openspec/specs/<capability>/spec.md` 进行比较
   - 判断会应用哪些变更(新增、修改、移除、重命名)
   - 在提示前展示合并后的摘要

   **提示选项:**
   - 若需要同步:"现在同步(推荐)"、"不同步直接归档"
   - 若已同步:"立即归档"、"仍要同步"、"取消"

   如果用户选择同步,执行 `/opsx:sync` 逻辑.无论选择如何,继续归档.

5. **执行归档**

   若归档目录不存在,则创建:
   ```bash
   mkdir -p openspec/changes/archive
   ```

   使用当前日期生成目标名称:`YYYY-MM-DD-<change-name>`

   **检查目标是否已存在:**
   - 若存在:报错并建议重命名现有归档或使用不同日期
   - 若不存在:将变更目录移动到归档目录

   ```bash
   mv openspec/changes/<name> openspec/changes/archive/YYYY-MM-DD-<name>
   ```

6. **显示摘要**

   显示归档完成摘要,包括:
   - 变更名称
   - 使用的 schema
   - 归档位置
   - 规范同步状态(已同步 / 跳过同步 / 无 delta 规范)
   - 任何警告(未完成工件/任务)

**成功输出**

```
## 归档完成

**变更:** <change-name>
**Schema:** <schema-name>
**归档到:** openspec/changes/archive/YYYY-MM-DD-<name>/
**规范:** ✓ 已同步到主规范

所有工件完成.所有任务完成.
```

**成功输出(无 delta 规范)**

```
## 归档完成

**变更:** <change-name>
**Schema:** <schema-name>
**归档到:** openspec/changes/archive/YYYY-MM-DD-<name>/
**规范:** 无 delta 规范

所有工件完成.所有任务完成.
```

**成功输出(带警告)**

```
## 归档完成(含警告)

**变更:** <change-name>
**Schema:** <schema-name>
**归档到:** openspec/changes/archive/YYYY-MM-DD-<name>/
**规范:** 跳过同步(用户选择跳过)

**警告:**
- 归档时有 2 个未完成工件
- 归档时有 3 个未完成任务
- 已跳过 delta 规范同步(用户选择跳过)

如果这不是有意为之,请检查该归档.
```

**错误输出(归档已存在)**

```
## 归档失败

**变更:** <change-name>
**目标:** openspec/changes/archive/YYYY-MM-DD-<name>/

目标归档目录已存在.

**选项:**
1. 重命名现有归档
2. 如果是重复归档,删除现有归档
3. 等待不同日期再归档
```

**护栏**
- 若未提供变更名称,始终提示选择
- 使用工件图(openspec status --json)检查完成情况
- 不要因警告阻止归档——仅提示并确认
- 移动时保留 .openspec.yaml(目录整体移动)
- 清晰展示发生了什么
- 如果请求同步,使用 /opsx:sync 方式(agent 驱动)
- 若存在 delta 规范,始终进行同步评估并在提示前展示合并摘要
