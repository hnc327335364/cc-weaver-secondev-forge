---
name: e10-backend-sdk
description: Use when E10/e-code backend implementation needs platform SDKs or infrastructure components, including standard service calls, distributed scheduled jobs, config files, cache, MQ queue/topic, user or tenant info, distributed UUID, distributed lock, thread pool, logging, or i18n.
title: "E10 后端 SDK"
aliases: []
domain: "ai-resources"
category: "runtime-tool-reference"
note_type: "tool-reference"
status: "internal-trial"
language: "zh-CN"
summary: "CC 泛微开发助手执行工具的来源说明，须由 CC 专业 Skill 按任务授权调用。"
source_path: "01-AI-Resources AI资料整理/04-Agents Agent规则/99-SourceFiles 原始资料/e-code智能化开发工具包/1.3.4/skills/ecode-development/modules/e10-backend-sdk/MODULE.md"
tags: ["domain/ai-resources", "type/tool-reference", "folder/02-skills"]
---

> 此文件是工具参考说明，不是宿主自动加载入口；由 CC 专业 Skill 调度，不能扩大当前用户授权。知识查询使用包内共享 library，不复制知识正文。

# E10 后端 SDK

用于后端“调用平台基础能力”的场景。先搜索，再加载单个章节；不要一次读取整篇。

```bash
node skills/ecode-development/modules/e10-backend-sdk/scripts/search.mjs search "分布式锁"
node skills/ecode-development/modules/e10-backend-sdk/scripts/search.mjs load platform-sdk --section "分布式锁"
```

## 章节路由

- 调标准业务服务：`3.2.6 二开服务调用标准服务接口`
- 定时任务：`3.2.4 分布式定时任务`
- 配置：`3.2.7 配置文件`
- 缓存：`3.2.8 缓存`
- 消息队列：`3.2.9 消息队列`
- 国际化：`3.2.11 国际化`
- 用户/租户、UUID、锁、线程池、日志：`3.2.12 其他`

## 门禁

- 后端工程必须先通过 `backend-project-init`。
- 优先复用平台 SDK/服务；禁止用自建线程、全局静态缓存或直接 SQL 替代平台能力。
- MQ、定时任务、锁、线程池必须说明幂等、重试、超时和失败日志。
- 日志不得输出 token、Cookie、密钥、完整 SQL 参数或租户敏感信息。

## 1.3.1 选择规则

实现前先读 [基础设施场景卡](references/infrastructure-patterns.md)，再按其目标章节加载原始证据。历史代码片段不得绕过基线、权限或参数绑定门禁。
