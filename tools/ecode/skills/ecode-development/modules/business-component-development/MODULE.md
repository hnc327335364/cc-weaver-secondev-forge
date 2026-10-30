---
name: business-component-development
description: Use when developing an E10 editor business-component React application in project type C.
title: "业务组件应用开发"
aliases: []
domain: "ai-resources"
category: "runtime-tool-reference"
note_type: "tool-reference"
status: "internal-trial"
language: "zh-CN"
summary: "CC 泛微开发助手执行工具的来源说明，须由 CC 专业 Skill 按任务授权调用。"
source_path: "01-AI-Resources AI资料整理/04-Agents Agent规则/99-SourceFiles 原始资料/e-code智能化开发工具包/1.3.4/skills/ecode-development/modules/business-component-development/MODULE.md"
tags: ["domain/ai-resources", "type/tool-reference", "folder/02-skills"]
---

> 此文件是工具参考说明，不是宿主自动加载入口；由 CC 专业 Skill 调度，不能扩大当前用户授权。知识查询使用包内共享 library，不复制知识正文。

# 业务组件应用开发

业务组件是编辑器组件默认项目中的标准 React 应用，不是 EB 自定义组件，也不是公共业务组件 SDK。

## 应用身份

- 目标系统项目必须为 `projectType=C`。
- 应用必须为 React：`treeType=R`、`isVue=0`。
- 使用标准应用模式：`appMode=0`、`isTheme=n`。
- `projectType` 只作为本地工程和目标项目校验标记；不得伪造为服务端 `ecode.json` 根节点字段。

## 初始化

```bash
node skills/ecode-development/modules/e10-frontend-local-tooling/scripts/ecodecmd-e10/bin/ecodecmd-e10.mjs init ./apps --project-name demo --app-type business-component
```

标准结构包含 `entry.js`、四个配置文件、`resources/` 和 `build.json`。

## 代码与加载规则

- `entry.js` 为 `state=y`，允许注册、Hook 安装和轻量初始化代码。
- 其他前置文件允许存在，但前置代码不得直接渲染大型页面、请求业务数据或加载大型 UI 依赖。
- 页面组件、复杂交互和大型依赖默认写入 `state=n` 文件，按标准应用链路加载。
- 禁止使用自定义组件 `coms`、自定义函数 `func` 或特色主题 `theme` 专属加载路径。
- 保留公共/租户范围与 PC/移动端范围；AI 不得静默覆盖。

## 校验与交付

`check` 和 `build` 拦截错误项目类型、特殊 `appMode`、主题标记或 Vue 标记。导入时必须选择真实的编辑器组件默认项目。构建成功仅证明本地包结构有效；目标环境发布、加载范围和页面行为仍需验证。
