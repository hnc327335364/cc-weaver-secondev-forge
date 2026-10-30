---
title: "组件参数复写"
aliases: []
domain: "ai-resources"
category: "runtime-tool-reference"
note_type: "tool-reference"
status: "internal-trial"
language: "zh-CN"
summary: "CC 泛微开发助手执行工具的来源说明，须由 CC 专业 Skill 按任务授权调用。"
source_path: "01-AI-Resources AI资料整理/04-Agents Agent规则/99-SourceFiles 原始资料/e-code智能化开发工具包/1.3.4/skills/ecode-development/modules/frontend-development/references/examples/component-override.md"
tags: ["domain/ai-resources", "type/tool-reference", "folder/02-skills"]
---

> 此文件是工具参考说明，不是宿主自动加载入口；由 CC 专业 Skill 调度，不能扩大当前用户授权。知识查询使用包内共享 library，不复制知识正文。

# 组件参数复写

## 适用场景

修改标准组件的局部 props、样式或事件，不替换整个组件。

## 必要配置

组件库名、组件名、路由/业务 props/稳定 `weId` 末段和原行为要求。

## 实现模板

先用 React DevTools 定位组件和稳定标识，再注册 `regOvProps`；非目标组件立即返回原 props，目标组件返回合并后的 props。

## 风险

全局复写、直接修改共享对象、遗漏返回值、依赖易变完整 `weId`。

## 验证步骤

验证目标组件变化、同名非目标组件不变、原事件和 ref 正常、重复进入页面无副作用。
