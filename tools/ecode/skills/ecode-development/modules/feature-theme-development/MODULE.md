---
name: feature-theme-development
description: Use when developing an E10 special-theme React application in project type T.
title: "特色主题应用开发"
aliases: []
domain: "ai-resources"
category: "runtime-tool-reference"
note_type: "tool-reference"
status: "internal-trial"
language: "zh-CN"
summary: "CC 泛微开发助手执行工具的来源说明，须由 CC 专业 Skill 按任务授权调用。"
source_path: "01-AI-Resources AI资料整理/04-Agents Agent规则/99-SourceFiles 原始资料/e-code智能化开发工具包/1.3.4/skills/ecode-development/modules/feature-theme-development/MODULE.md"
tags: ["domain/ai-resources", "type/tool-reference", "folder/02-skills"]
---

> 此文件是工具参考说明，不是宿主自动加载入口；由 CC 专业 Skill 调度，不能扩大当前用户授权。知识查询使用包内共享 library，不复制知识正文。

# 特色主题应用开发

特色主题使用 React 工程结构，但服务端按特殊应用独立发布，不得当普通 React 应用处理。

## 应用身份

- 目标系统项目必须为 `projectType=T`。
- 必须为 React：`treeType=R`、`isVue=0`。
- 必须设置 `appMode=4`、`isTheme=y`。
- 发布产物进入独立 `theme/index.js`、`theme/index.css`，并触发主题版本刷新。
- `projectType` 只作为本地工程和目标项目校验标记，不写入服务端根节点。

## 初始化

```bash
node skills/ecode-development/modules/e10-frontend-local-tooling/scripts/ecodecmd-e10/bin/ecodecmd-e10.mjs init ./apps --project-name demo --app-type feature-theme
```

服务端默认 React 主题结构：

- `entry.js`：`state=y`，源码和编译内容必须为空。
- `config/config.js`、`config/config_default.js`：`state=y`，内容必须为空。
- `config/configLoad.js`、`config/configLoad_default.js`：`state=n`，允许写入和修改主题配置加载代码，并正常编译。
- 其他主题 JS/CSS：必须 `state=n`；AI 生成代码只写入非前置文件。

## 强制规则

- 只允许 `entry.js`、`config/config.js`、`config/config_default.js` 三个文件设置 `state=y`；其源码和编译内容都必须为空，空格、换行、注释和 BOM 均视为内容。
- 非前置的 `config/configLoad.js`、`config/configLoad_default.js` 允许承载代码；不得在构建时清空其源码或编译结果。
- 禁止 Vue 主题。
- 主题 CSS 只在平台激活主题时生效，不得提前注入普通应用前置资源。
- 全局选择器不是一律禁止，但必须限定到主框架主题目标；禁止无范围覆盖普通业务模块。
- 检查字体、图片、`url()` 和相对资源路径；切换回默认主题后不得残留样式或事件。

## 验证边界

接口返回成功或 `releaseFlag=y` 不证明异步静态文件已可读。验收还需检查 `theme/index.js`、`theme/index.css`、版本刷新、真实主题切换、默认主题恢复和跨租户隔离。
