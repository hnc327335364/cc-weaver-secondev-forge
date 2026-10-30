---
name: e10-backend-api
description: Use when E10/e-code backend work needs to publish/expose interfaces or implement backend hook instrumentation, including /api/secondev HTTP Controller APIs, custom Action APIs, Open Platform exposure, WebService second-development方案, external callbacks, WeaHookApi, WeaHookReg, RegHookEvent, WeaHookRequest, WeaHookResponse, or backend 埋点二开.
title: "E10 后端接口发布"
aliases: []
domain: "ai-resources"
category: "runtime-tool-reference"
note_type: "tool-reference"
status: "internal-trial"
language: "zh-CN"
summary: "CC 泛微开发助手执行工具的来源说明，须由 CC 专业 Skill 按任务授权调用。"
source_path: "01-AI-Resources AI资料整理/04-Agents Agent规则/99-SourceFiles 原始资料/e-code智能化开发工具包/1.3.4/skills/ecode-development/modules/e10-backend-api/MODULE.md"
tags: ["domain/ai-resources", "type/tool-reference", "folder/02-skills"]
---

> 此文件是工具参考说明，不是宿主自动加载入口；由 CC 专业 Skill 调度，不能扩大当前用户授权。知识查询使用包内共享 library，不复制知识正文。

# E10 后端接口发布

用于后端“对外提供能力”的场景。先判断调用方和协议，再只加载对应章节。

```bash
node skills/ecode-development/modules/e10-backend-api/scripts/search.mjs search "发布http接口"
node skills/ecode-development/modules/e10-backend-api/scripts/search.mjs load interface-publication --section "3.2.2 发布http接口"
node skills/ecode-development/modules/e10-backend-api/scripts/search.mjs search "WeaHookReg"
node skills/ecode-development/modules/e10-backend-api/scripts/search.mjs load backend-hook-development --section "二开跨服务触发使用"
```

## 选型

- E10 登录用户或前端补丁调用：读 `3.2.2 发布http接口`，优先 `/api/secondev/*`。
- 动作流或平台 Action 扩展：读 `3.2.3 自定义action接口`。
- 外部系统通过开放平台调用：读 `3.2.5 发布接口到开放平台`。
- 旧系统要求 WebService：读 `3.2.10 webservice 二开方案`，同时评估是否可改 HTTP/OpenAPI。
- 模块标准方法需要开放二开拦截：读 `backend-hook-development`，优先 `@WeaHookApi`、`@WeaHook`、`@WeaHookReg`。
- 二开服务要实现后端埋点：读 `backend-hook-development` 的 `模块二开埋点` 和 `二开埋点基础属性解析`。
- 本服务临时测试后端埋点不内置独立文档；只保留原则：本服务测试方式仅用于调试，不允许实际二开使用。

## 门禁

- 后端工程必须先通过 `backend-project-init`。
- Controller 返回 `WeaResult`，包路径以 `com.weaver.seconddev` 开头。
- 后端埋点二开包路径前三段必须是 `com.weaver.seconddev`。
- 禁止发布未鉴权、未限定调用方或直接暴露内部异常堆栈的接口。
- 涉及标准业务能力时，先按业务域调用对应业务 Skill 的 `search-api.mjs`；冲突审计显式增加
  `--include-conflict`。
- 开放给外部系统前，明确认证方式、调用方、入参来源、错误码和回滚方案。

## 1.3.1 选择规则

实现前先读 [接口选型](references/interface-selection.md)，再按其目标章节加载原始证据。历史代码片段不得绕过基线、权限或参数绑定门禁。
