---
description: e-code 前端代码调试与屏蔽排障
title: "前端调试"
aliases: []
domain: "ai-resources"
category: "runtime-tool-reference"
note_type: "tool-reference"
status: "internal-trial"
language: "zh-CN"
summary: "CC 泛微开发助手执行工具的来源说明，须由 CC 专业 Skill 按任务授权调用。"
source_path: "01-AI-Resources AI资料整理/04-Agents Agent规则/99-SourceFiles 原始资料/e-code智能化开发工具包/1.3.4/skills/ecode-development/modules/frontend-development/references/debugging.md"
tags: ["domain/ai-resources", "type/tool-reference", "folder/02-skills"]
---

> 此文件是工具参考说明，不是宿主自动加载入口；由 CC 专业 Skill 调度，不能扩大当前用户授权。知识查询使用包内共享 library，不复制知识正文。

# 前端调试

## 1. 最小排查顺序

1. 确认应用、文件、入口文件已发布，且发布端与当前 PC/移动端一致。
2. 检查 Network 中静态资源、global 接口和业务接口状态。
3. 检查异常堆栈；控制台被屏蔽时按目标基线允许的方式临时显示。
4. 使用 e-code 调试工具按应用或资源路径屏蔽，比较问题是否仍存在。
5. 检查页面刷新缓存、登录前后范围、租户/公共应用范围。

## 2. 屏蔽调试

1. 调试权限和授权码只由有权限人员配置。
2. 指定页面时必须使用完整页面地址。
3. 新基线优先使用调试工具，不依赖已废弃的地址栏授权码方式。
4. 可按资源文件路径或 e-code 应用维度禁用。
5. 应用维度屏蔽不一定屏蔽前置 CSS，判断样式问题时单独检查。
6. 完成后恢复禁用项并关闭临时调试开关。

## 3. 版本约束

调试方式随基线变化。涉及授权码有效期、应用/资源维度屏蔽时，定向读取：

- `../../ecode-source-docs/references/前端代码块屏蔽调试手册.md` 的“功能版本变更”。

一般不生效问题按错误关键词读取：

- `../../ecode-source-docs/references/e-code常见问题及解决方案.md` 的命中小节。

禁止默认加载完整 FAQ。
