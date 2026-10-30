---
description: e-code Vue 专项开发规范
title: "Vue 开发专题"
aliases: []
domain: "ai-resources"
category: "runtime-tool-reference"
note_type: "tool-reference"
status: "internal-trial"
language: "zh-CN"
summary: "CC 泛微开发助手执行工具的来源说明，须由 CC 专业 Skill 按任务授权调用。"
source_path: "01-AI-Resources AI资料整理/04-Agents Agent规则/99-SourceFiles 原始资料/e-code智能化开发工具包/1.3.4/skills/ecode-development/modules/frontend-development/references/vue.md"
tags: ["domain/ai-resources", "type/tool-reference", "folder/02-skills"]
---

> 此文件是工具参考说明，不是宿主自动加载入口；由 CC 专业 Skill 调度，不能扩大当前用户授权。知识查询使用包内共享 library，不复制知识正文。

# Vue 开发专题

仅当用户明确要求 Vue 时加载。基线要求：文档所述能力适用于 E10 `10.0.2502.01` 及以上版本；实施前确认目标环境基线。

## 1. 适用场景

- Vue 组件参数复写或组件替换。
- Vue 新页面。
- e-Builder、门户自定义 Vue 组件。
- React 与 Vue 组件互相引用。
- 流程代码块引入 Vue 组件。

## 2. 强制规则

1. 仍遵循 [`baseline.md`](baseline.md) 的加载、作用域、请求和安全要求。
2. 使用 e-code 提供的 Vue 集成能力，不自行创建脱离平台生命周期的全局 Vue 根实例。
3. React/Vue 桥接时明确 props、事件、挂载节点和卸载流程。
4. 组件替换和新页面必须限定路由或业务范围。
5. 发布前确认 Vue 版本、组件库版本和目标 E10 基线兼容。

## 3. 渐进读取

根据任务只读取原始归档中的对应标题：

- 技术方案：`../../ecode-source-docs/references/vue开发文档与案例.md` 的第三章。
- React/Vue 互调：第四章第 1 节。
- 参数复写：第四章第 2 节。
- 组件替换：第四章第 3 节。
- 新页面：第四章第 4 节。
- EB/门户组件：第四章第 5 节。
- 流程代码块：第四章第 6 节。

禁止默认加载整份 Vue 文档。
