---
title: "API 请求拦截"
aliases: []
domain: "ai-resources"
category: "runtime-tool-reference"
note_type: "tool-reference"
status: "internal-trial"
language: "zh-CN"
summary: "CC 泛微开发助手执行工具的来源说明，须由 CC 专业 Skill 按任务授权调用。"
source_path: "01-AI-Resources AI资料整理/04-Agents Agent规则/99-SourceFiles 原始资料/e-code智能化开发工具包/1.3.4/skills/ecode-development/modules/frontend-development/references/examples/api-interceptor.md"
tags: ["domain/ai-resources", "type/tool-reference", "folder/02-skills"]
---

> 此文件是工具参考说明，不是宿主自动加载入口；由 CC 专业 Skill 调度，不能扩大当前用户授权。知识查询使用包内共享 library，不复制知识正文。

# API 请求拦截

## 适用场景

只对准入名单中的目标接口补充参数、请求头或响应字段。

## 必要配置

目标 URL、准入类型、稳定拦截器名、权重和错误传播方式。

## 实现模板

使用 `regApiInterceptor`，先判断目标 URL；请求回调返回 config，响应回调返回 response，失败回调返回 rejected Promise。

## 风险

范围过宽会污染全局请求；接口仅“允许调用”时拦截不生效；多个权重顺序理解错误。

## 验证步骤

验证目标请求被修改、非目标请求不变、请求与响应顺序、403 和网络异常继续传播。
