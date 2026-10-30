---
description: e-code 后端开发强制基线
title: "后端开发基线"
aliases: []
domain: "ai-resources"
category: "runtime-tool-reference"
note_type: "tool-reference"
status: "internal-trial"
language: "zh-CN"
summary: "CC 泛微开发助手执行工具的来源说明，须由 CC 专业 Skill 按任务授权调用。"
source_path: "01-AI-Resources AI资料整理/04-Agents Agent规则/99-SourceFiles 原始资料/e-code智能化开发工具包/1.3.4/skills/ecode-development/modules/backend-development/references/baseline.md"
tags: ["domain/ai-resources", "type/tool-reference", "folder/02-skills"]
---

> 此文件是工具参考说明，不是宿主自动加载入口；由 CC 专业 Skill 调度，不能扩大当前用户授权。知识查询使用包内共享 library，不复制知识正文。

# 后端开发基线

技术域包含后端时必须读取。

## 1. 基础规范

1. Java 包路径以 `com.weaver.seconddev` 为前缀。
2. 登录用户访问接口使用 `/api/secondev/*`。
3. 服务间或第三方开放接口使用 `/sapi/secondev/*`，通过开放平台认证调用。
4. Controller 返回 `com.weaver.common.base.entity.result.WeaResult`。
5. 优先复用平台 API、SDK、Hook 和案例，不以自定义 SQL 替代已有能力。
6. 自定义 SQL 必须使用平台数据源接口和预编译参数，不使用 MyBatis。
7. 日志不输出 token、Cookie、SQL 参数中的敏感值或完整异常给前端。

## 2. 项目边界

后端工程初始化、二开依赖导入、子模块规范检查、Gradle 构建、jar 打包和部署验证由 `backend-project-init` 负责。纯前端任务不得执行项目初始化、依赖下载、Gradle 构建或 jar 打包。

## 3. 按需专题

- 工程准备：使用 `backend-project-init`
- HTTP/Action/API/Open Platform/WebService：使用 `e10-backend-api`
- 标准服务、定时任务、配置、缓存、MQ、用户租户、UUID、锁、线程池、日志、国际化：使用 `e10-backend-sdk`
- 数据库、自定义 SQL、事务、数据源：使用 `e10-backend-db`
- Java 测试：`../../backend-development/references/test-spec-full.md`

详细后端规范只按目标章节读取 `../../backend-development/references/dev-spec-full.md`。
