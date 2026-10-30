---
name: ecode-development
description: Use when analyzing, planning, implementing, debugging, testing, building, packaging, or delivering Weaver E10/e-code frontend, backend, or full-stack secondary development.
title: "e-code 二次开发"
aliases: []
domain: "ai-resources"
category: "runtime-tool-reference"
note_type: "tool-reference"
status: "internal-trial"
language: "zh-CN"
summary: "CC 泛微开发助手执行工具的来源说明，须由 CC 专业 Skill 按任务授权调用。"
source_path: "01-AI-Resources AI资料整理/04-Agents Agent规则/99-SourceFiles 原始资料/e-code智能化开发工具包/1.3.4/skills/ecode-development/SKILL.md"
tags: ["domain/ai-resources", "type/tool-reference", "folder/02-skills"]
---

> 此文件是工具参考说明，不是宿主自动加载入口；由 CC 专业 Skill 调度，不能扩大当前用户授权。知识查询使用包内共享 library，不复制知识正文。

# e-code 二次开发

先遵守项目根 `AGENTS.md`。只加载当前任务需要的模块和证据，避免批量加载。

## 开发路由

1.3.4 页面制作入口：E10/ECode/OA 页面生成、截图复刻或整页修改优先加载 `weaver-e10-page-generator`；普通存量 e-code 小补丁、API 拦截和后端任务仍走原链。页面工具按需安装 npm 最新版；支持 static-html 与 e10-page 打包、受控发布及真实业务数据写入。每次远程写入前必须确认目标环境、租户、用户与具体变更。主登录仍由 e10-login-cli 管理。

E9 组织人员读取、E9→E10 同步、E10 开放平台 OAuth 或 HR 集成管理加载 `../ecode-integration/TOOL-REFERENCE.md`，四种能力只占一个入口。执行客户端不要求新建后端工程；同步先生成离线计划，HR 会话认证复用主登录，开放平台认证保持独立。

1. 执行 `node skills/ecode-development/scripts/prepare-task.mjs "<需求>"` 识别技术域和风险。
2. 前端读取 `modules/e10-frontend-local-tooling/MODULE.md`，再按需读取 `modules/frontend-development/MODULE.md`。
3. 后端新建/初始化工程执行 `backend-project-init` 的 `init`，默认从 E10 运维平台取得 `lib.zip` 和 `classes.zip` 并导入；仅明确只要骨架时用 `--skeleton-only`。已有工程补依赖执行 `download`，新增子模块执行 `create-module`。后端读取 `modules/backend-project-init/MODULE.md` 和 `modules/backend-development/MODULE.md`，再按场景补读 API、SDK 或数据库模块。
4. E10 产品能力、业务模块、案例、API、Hook、组件和原始文档证据使用 `../e10-local-knowledge/SKILL.md`。
5. SQL、表、字段、DAO、Repository、Mapper、JDBC 或 MyBatis 任务使用 `../e10-data-dictionary/SKILL.md`；必须先检索，再加载目标表字段。
6. 用户要求安全审核时使用 `../ecode-security-review/TOOL-REFERENCE.md`；要求性能审核时使用 `../ecode-performance-review/TOOL-REFERENCE.md`。
7. 服务端 e-code 项目、文件或包操作使用 `../ecode-cli/TOOL-REFERENCE.md`，认证与租户操作使用 `../e10-login-cli/TOOL-REFERENCE.md`。
8. 实现后按 `AGENTS.md` 执行适用测试、编译或打包，只报告真实结果。

自然语言场景路由：

`node skills/ecode-development/scripts/route-scenario.mjs "<需求>" --json`

## 1.3.1 场景分流

- 需求可行性、功能分析、配置/低代码/二开比较：[需求评估](modules/requirement-assessment/MODULE.md)。
- EB 页面 SDK、页面插入、设计器组件：[EB 组件](modules/eb-component-development/MODULE.md)。
- 编辑器业务组件 React 应用：[业务组件](modules/business-component-development/MODULE.md)。
- 特色主题 React 应用：[特色主题](modules/feature-theme-development/MODULE.md)。
- 前后端联动、同根目录组织：[全栈开发](modules/fullstack-development/MODULE.md)。
- 数据查询优先标准业务 API，再读 [查询选型](modules/e10-backend-db/references/query-selection.md)；基线未知可以分析，禁止具体平台业务代码。
- “对外接口”必须确定调用方；读 [接口选型](modules/e10-backend-api/references/interface-selection.md)，不得只据“对外”选择 `/sapi`。
- 存量下载、修改、验证、导入读 [存量应用闭环](../ecode-cli/references/existing-app-workflow.md)。

路由输出不是需求分析完成证明。按 [任务记录模板](assets/task-record.template.json) 保存用户目标、实现单元与依赖、基线来源、实际加载证据、采用方案、待确认项、模板/工程约定、授权及验证。最多三个模块/文档的预算按单元计算；混合需求不得只保留前三个目标。已有明确同范围授权持续有效；只做分析或不发布的限制同样持续有效。
