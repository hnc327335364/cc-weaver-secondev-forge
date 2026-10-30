---
name: e10-backend-db
description: Use when E10/e-code backend work involves database operations, custom SQL, platform datasource APIs, prepared statements, transactions, pagination, data migration, table or field operations, multi-database compatibility, or SQL safety review.
title: "E10 后端数据库"
aliases: []
domain: "ai-resources"
category: "runtime-tool-reference"
note_type: "tool-reference"
status: "internal-trial"
language: "zh-CN"
summary: "CC 泛微开发助手执行工具的来源说明，须由 CC 专业 Skill 按任务授权调用。"
source_path: "01-AI-Resources AI资料整理/04-Agents Agent规则/99-SourceFiles 原始资料/e-code智能化开发工具包/1.3.4/skills/ecode-development/modules/e10-backend-db/MODULE.md"
tags: ["domain/ai-resources", "type/tool-reference", "folder/02-skills"]
---

> 此文件是工具参考说明，不是宿主自动加载入口；由 CC 专业 Skill 调度，不能扩大当前用户授权。知识查询使用包内共享 library，不复制知识正文。

# E10 后端数据库

用于后端数据访问与 SQL 场景。数据库是高风险能力，必须先加载强制规则。

```bash
node skills/ecode-development/modules/e10-backend-db/scripts/search.mjs search "预编译 SQL"
node skills/ecode-development/modules/e10-backend-db/scripts/search.mjs load database --section "3.2.1 数据库操作"
```

## 强制规则

1. 优先使用平台 API、SDK 或已有服务。
2. 必须执行自定义 SQL 时，使用平台数据源接口。
3. 禁止使用 MyBatis 直接访问平台数据库。
4. 外部输入必须通过预编译参数绑定，禁止拼接值。
5. 动态表名、字段名、排序字段必须来自固定白名单。
6. 事务只在平台支持的数据源和接口范围内使用。
7. 不在日志或前端响应中暴露 SQL、连接信息、租户密钥。
8. 任何自定义 SQL、DAO、Repository、Mapper、JDBC 或 MyBatis 场景，生成代码前必须使用 `e10-data-dictionary` 验证目标表和全部引用字段；用户提供或既有代码中的标识不能跳过验证。
9. 表未命中、字段未收录或冲突未裁决时，禁止猜测、禁止生成降级 SQL，必须输出待确认信息。

## 加载

- 常规查询、更新、分页、数据源：加载 `database` 对应子章节。
- 事务、多数据库兼容、迁移脚本：先读原文，再核对 `backend-development` 的数据库规范。
- 涉及表单物理表、字段或 dataKey：同时检索 `e10-form-backend-api-docs`，优先复用表单 API。

## 表结构反查（无 API 场景）

E10 平台部分表缺少 API（跨模块、跨版本、业务表单 formdata_* 物理表）。Agent 必须基于表结构生成自定义 SQL 时，先加载 `e10-data-dictionary`：

按 `e10-data-dictionary` SKILL.md 工作流执行 `search` / `load <tableName>` / `find-column` / `load _conflicts`。

表名、字段名、排序字段、JOIN 字段必须来自以上检索结果。冲突表（同名异结构）必须先 `load _conflicts` 查看候选版本，不得随机选择。同名字段跨表 JOIN 用 `find-column`。

未取得完整证据时，统一输出：

```text
缺少关键数据表信息，暂不生成代码。

待确认：
1. 目标表准确名称及所属数据库
2. 实现所需字段、主键和关联字段
3. 表结构来源或可核验的数据字典记录
```

不得用相似表名、模块前缀、字段语义、旧版本代码或模型记忆补齐缺口。

## 1.3.1 选择规则

实现前先读 [查询选型](references/query-selection.md)，再按其目标章节加载原始证据。历史代码片段不得绕过基线、权限或参数绑定门禁。
