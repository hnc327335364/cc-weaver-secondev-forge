---
name: backend-development
description: Use when E10/e-code work involves Java backend business development, detailed development and test specifications, backend routing, API/SDK/database skills, Service code, or Controller/service boundaries after project initialization.
title: "后端开发"
aliases: []
domain: "ai-resources"
category: "runtime-tool-reference"
note_type: "tool-reference"
status: "internal-trial"
language: "zh-CN"
summary: "CC 泛微开发助手执行工具的来源说明，须由 CC 专业 Skill 按任务授权调用。"
source_path: "01-AI-Resources AI资料整理/04-Agents Agent规则/99-SourceFiles 原始资料/e-code智能化开发工具包/1.3.4/skills/ecode-development/modules/backend-development/MODULE.md"
tags: ["domain/ai-resources", "type/tool-reference", "folder/02-skills"]
---

> 此文件是工具参考说明，不是宿主自动加载入口；由 CC 专业 Skill 调度，不能扩大当前用户授权。知识查询使用包内共享 library，不复制知识正文。

# 后端开发

后端业务开发路由 Skill。工程初始化、子模块规范、二开依赖导入、构建、打包和部署验证由 `backend-project-init` 负责；接口发布、平台 SDK、数据库分别交给更小的后端专题 Skill。

```bash
node skills/ecode-development/modules/backend-development/scripts/search.mjs load baseline --section summary
node skills/ecode-development/modules/backend-development/scripts/search.mjs search "Controller WeaResult"
node skills/ecode-development/modules/backend-development/scripts/search.mjs load dev-spec-full --section "3.1 Controller规范"
```

先读 `baseline`。再按用户意图选择一个专题 Skill：

- 发布 HTTP 接口、自定义 Action、开放平台或 WebService：调用 `读取内部模块`，`skills/ecode-development/modules/e10-backend-api/MODULE.md`。
- 调用标准服务、定时任务、配置、缓存、MQ、用户租户、UUID、锁、线程池、日志、国际化：调用 `读取内部模块`，`skills/ecode-development/modules/e10-backend-sdk/MODULE.md`。
- 数据库、自定义 SQL、事务、数据源、分页、迁移或 SQL 安全：调用 `读取内部模块`，`skills/ecode-development/modules/e10-backend-db/MODULE.md`。

后端数据库场景涉及 SQL、表名、字段名、DAO、Repository、Mapper、JDBC 或 MyBatis 时，强制叠加加载 `e10-data-dictionary`：

- 对目标表先 `search`，再 `load <tableName> --section columns`；表结构 / 字段含义 / 外键反查按其 `search` / `load` / `find-column` 流程拿证据，再回到 `e10-backend-db` 走预编译 SQL。
- 表、字段未命中或冲突未裁决时，停止数据库相关代码生成，输出待确认信息。不得猜测名称或复用未经字典验证的历史 SQL。

涉及平台 HTTP、Dubbo 或 Hook 能力时，先按业务对象进入对应业务 Skill，使用该 Skill 的
`scripts/search-api.mjs` 检索结构化 API 契约；需要原始上下文时，再用同一 Skill 的
`scripts/search.mjs` 补充证据。待决冲突保留在所属业务 Skill，并仅在显式冲突审计时返回。

流程接口按业务对象路由：发起流程实例优先 `createFlow`；新建流程定义或模板优先
`createPath`。“流程创建”无法区分时只询问“发起流程实例，还是新建流程定义？”，
不重复询问已知技术域、角色、协议或模块。

本地业务 API 索引最多检索一次。检索仅限当前工作区，禁止 `find /Users`、
`find /Applications`、从用户目录或根目录开始的无界搜索。

详细开发、测试、API 检索和模块基线规范位于本 Skill 的 `references/`。默认只加载命中章节，
不要一次性加载完整规范。

## 实现门禁

- 后端 Java 业务实现前，必须已经通过 `backend-project-init` 完成工程检查。
- 需要 E10 基线但项目与用户均未提供时，由 `backend-project-init` 只确认一次版本，不得猜测“最新版本”。
- 接口前缀使用 `/api/secondev/*` 或 `/sapi/secondev/*`，Controller 返回 `WeaResult`，包路径以 `com.weaver.seconddev` 开头。
- 数据库访问遵守事务、参数化 SQL 与平台数据源规范，优先复用内部 API、SDK 和扩展点。
- 构建、编译、打包、部署和部署验证全部交给 `backend-project-init`，本 Skill 不展开 Gradle、jar 或部署流程。
- Java 业务代码变更同步生成或更新单元测试；测试隔离真实平台 API、数据库、缓存和 HTTP。

## 1.3.1 先做意图与版本选择

- 数据读取先判断标准业务 API 是否覆盖，再读 [查询选型](../e10-backend-db/references/query-selection.md)。不因用户说“查数据”直接写 SQL 或 Mapper。
- 接口先确认调用方，读 [接口选型](../e10-backend-api/references/interface-selection.md)。不照抄历史 `publicPermission` 注解，不默认给所有方法增加当前用户或租户参数。
- Redis/缓存、DB、MQ、锁读 [基础设施场景卡](../e10-backend-sdk/references/infrastructure-patterns.md)，核验项目依赖和版本后才选类/方法。
- 后端工程缺失时执行 `backend-project-init` 的 `init`；已有工程新增模块执行 `create-module`，再导入对应基线依赖并实际验证构建。
