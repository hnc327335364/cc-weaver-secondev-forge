---
name: e10-frontend-local-tooling
description: Use when Weaver E10/e-code frontend work requires checking or initializing a patch project, checking JavaScript compilation, or building a patch zip without a globally installed ecodecmd.
title: "E10 前端本地工程工具"
aliases: []
domain: "ai-resources"
category: "runtime-tool-reference"
note_type: "tool-reference"
status: "internal-trial"
language: "zh-CN"
summary: "CC 泛微开发助手执行工具的来源说明，须由 CC 专业 Skill 按任务授权调用。"
source_path: "01-AI-Resources AI资料整理/04-Agents Agent规则/99-SourceFiles 原始资料/e-code智能化开发工具包/1.3.4/skills/ecode-development/modules/e10-frontend-local-tooling/MODULE.md"
tags: ["domain/ai-resources", "type/tool-reference", "folder/02-skills"]
---

> 此文件是工具参考说明，不是宿主自动加载入口；由 CC 专业 Skill 调度，不能扩大当前用户授权。知识查询使用包内共享 library，不复制知识正文。

# E10 前端本地工程工具

定位：前端本地工程初始化、规则校验、编译检查和补丁打包。工具只支持 E10，使用 Node.js 18+，无需执行 `npm install`。

## 场景路由

- 普通 React 前端补丁：`init`
- EB 自定义组件应用：`init --app-type eb-custom-component`
- 业务组件应用：`init --app-type business-component`
- 特色主题应用：`init --app-type feature-theme`
- 校验工程和应用类型规则：`check`
- 检查 JavaScript/JSX 编译：`compile`
- 构建补丁 ZIP：`build`

## 命令

```bash
node skills/ecode-development/modules/e10-frontend-local-tooling/scripts/ecodecmd-e10/bin/ecodecmd-e10.mjs init <父目录> --project-name <项目名>
node skills/ecode-development/modules/e10-frontend-local-tooling/scripts/ecodecmd-e10/bin/ecodecmd-e10.mjs init <父目录> --project-name <项目名> --app-type eb-custom-component
node skills/ecode-development/modules/e10-frontend-local-tooling/scripts/ecodecmd-e10/bin/ecodecmd-e10.mjs init <父目录> --project-name <项目名> --app-type business-component
node skills/ecode-development/modules/e10-frontend-local-tooling/scripts/ecodecmd-e10/bin/ecodecmd-e10.mjs init <父目录> --project-name <项目名> --app-type feature-theme
node skills/ecode-development/modules/e10-frontend-local-tooling/scripts/ecodecmd-e10/bin/ecodecmd-e10.mjs check <项目目录>
node skills/ecode-development/modules/e10-frontend-local-tooling/scripts/ecodecmd-e10/bin/ecodecmd-e10.mjs compile <文件或目录>
node skills/ecode-development/modules/e10-frontend-local-tooling/scripts/ecodecmd-e10/bin/ecodecmd-e10.mjs build <项目目录>
```

## 强制规则

1. `init` 必须显式提供 `--project-name`；目标已存在时默认停止。
2. 普通 React 项目保持原初始化和构建规则。
3. EB 自定义组件必须使用 `--app-type eb-custom-component`，生成 `projectType=E/appMode=2` 和标准六文件模板。
4. EB 自定义组件 `entry.js` 为前置文件，但源码和编译代码必须为空。
5. 除空的系统 `config/config.js`、`config/config_default.js` 外，EB 自定义组件禁止其他前置文件；AI 代码只写入非前置文件。
6. `build` 自动执行与 `check` 相同的规则；校验失败不得生成新 ZIP，原 ZIP 保留。
7. `resources/` 只存静态资源；业务源码只允许 `.js`，禁止 `.jsx/.ts/.tsx`。
8. 本地通过不代表目标 EB 设计器运行验证通过。
9. 业务组件使用 `projectType=C/appMode=0/isTheme=n`，`entry.js` 可写前置初始化代码；禁止混入特殊应用标记。
10. 特色主题使用 `projectType=T/appMode=4/isTheme=y/isVue=0`；`entry.js`、`config/config.js`、`config/config_default.js` 是唯一允许的前置文件，源码和编译内容必须为空；两个 `configLoad*.js` 为可编辑、正常编译的非前置系统配置文件，其他业务 JS/CSS 也必须非前置。

## 导入

```bash
ecode-cli package import --file <zip> --project-id <id> --build-json <build.json>
```

只在 `appUUID` 精确匹配单个应用时回写平台 `appId`。EB 自定义组件必须导入编辑器自定义组件项目，不得使用普通 React 创建命令替代。

## 详细参考

- [`references/frontend-package.md`](references/frontend-package.md)
- [`references/project-initialization.md`](references/project-initialization.md)
