---
title: "单页路由"
aliases: []
domain: "ai-resources"
category: "runtime-tool-reference"
note_type: "tool-reference"
status: "internal-trial"
language: "zh-CN"
summary: "CC 泛微开发助手执行工具的来源说明，须由 CC 专业 Skill 按任务授权调用。"
source_path: "01-AI-Resources AI资料整理/04-Agents Agent规则/99-SourceFiles 原始资料/e-code智能化开发工具包/1.3.4/skills/ecode-development/modules/frontend-development/references/examples/single-page-route.md"
tags: ["domain/ai-resources", "type/tool-reference", "folder/02-skills"]
---

> 此文件是工具参考说明，不是宿主自动加载入口；由 CC 专业 Skill 调度，不能扩大当前用户授权。知识查询使用包内共享 library，不复制知识正文。

# 单页路由

## 适用场景

在 E10 主框架中注册独立 React 页面。

## 必要配置

明确且足够具体的路由、应用 ID、异步模块路径、PC/移动端与发布范围。

## 实现模板

入口只扩展 Switch 路由；页面组件通过 `asyncImport` 和 `React.Suspense` 加载；路由插入顺序不遮蔽标准页面。

## 风险

宽泛路由吞掉后续路由；入口直接加载重型 UI；二级路径和公共应用路径不兼容。

## 验证步骤

验证直接访问、刷新、前进后退、标准相邻路由、二级路径、PC/移动端和租户/公共应用范围。
