---
description: E10 前端项目初始化、规则校验、编译检查与补丁包构建
title: "E10 前端补丁"
aliases: []
domain: "ai-resources"
category: "runtime-tool-reference"
note_type: "tool-reference"
status: "internal-trial"
language: "zh-CN"
summary: "CC 泛微开发助手执行工具的来源说明，须由 CC 专业 Skill 按任务授权调用。"
source_path: "01-AI-Resources AI资料整理/04-Agents Agent规则/99-SourceFiles 原始资料/e-code智能化开发工具包/1.3.4/skills/ecode-development/modules/e10-frontend-local-tooling/references/frontend-package.md"
tags: ["domain/ai-resources", "type/tool-reference", "folder/02-skills"]
---

> 此文件是工具参考说明，不是宿主自动加载入口；由 CC 专业 Skill 调度，不能扩大当前用户授权。知识查询使用包内共享 library，不复制知识正文。

# E10 前端补丁

## 普通 React 项目

```bash
node skills/ecode-development/modules/e10-frontend-local-tooling/scripts/ecodecmd-e10/bin/ecodecmd-e10.mjs init ./apps --project-name demo
```

普通项目生成 `resources/`、`config/`、`entry.js` 和 `build.json`，现有前置入口规则保持不变。

## 业务组件项目

```bash
node skills/ecode-development/modules/e10-frontend-local-tooling/scripts/ecodecmd-e10/bin/ecodecmd-e10.mjs init ./apps --project-name demo --app-type business-component
```

生成 `projectType=C`、`appMode=0`、`isTheme=n`、`isVue=0` 的标准 React 工程。`entry.js` 保持 `state=y`，允许正常初始化代码。目标导入项目必须为编辑器组件默认项目。

## 特色主题项目

```bash
node skills/ecode-development/modules/e10-frontend-local-tooling/scripts/ecodecmd-e10/bin/ecodecmd-e10.mjs init ./apps --project-name demo --app-type feature-theme
```

生成 `projectType=T`、`appMode=4`、`isTheme=y`、`isVue=0`。`entry.js`、`config/config.js`、`config/config_default.js` 为 `state=y`，源码和编译内容必须为空；`config/configLoad.js`、`config/configLoad_default.js` 为 `state=n`，允许写入主题配置加载代码并正常编译。其他主题 JS/CSS 禁止设为前置。

## EB 自定义组件项目

```bash
node skills/ecode-development/modules/e10-frontend-local-tooling/scripts/ecodecmd-e10/bin/ecodecmd-e10.mjs init ./apps --project-name demo --app-type eb-custom-component
```

生成结构：

```text
demo/
├── Design.js
├── View.js
├── Config.js
├── MDesign.js
├── MView.js
├── StyleConfig.js
├── entry.js
├── config/
└── resources/
```

`build.json` 记录 `projectType=E`、`appMode=2`、`pcOrMobile=A`、`commonFlag=n`。工具未定义 `locked`、`contentPolicy` 等伪字段；保护由初始化、`check` 和构建门禁执行。

前置规则：

- `entry.js`：`state=y`，源码必须零字节，编译代码必须为空。
- `config/config.js`、`config/config_default.js`：系统配置前置文件，必须为空，AI 禁止修改。
- `config/configLoad.js`、`config/configLoad_default.js`：系统非前置空文件，AI 禁止修改。
- 其余 JS/CSS：必须 `state=n`；AI 生成代码全部写入这些非前置文件。
- 禁止通过注释、空格、换行或 BOM 向空文件写入内容。

## 检查、编译与构建

```bash
node skills/ecode-development/modules/e10-frontend-local-tooling/scripts/ecodecmd-e10/bin/ecodecmd-e10.mjs check ./apps/demo
node skills/ecode-development/modules/e10-frontend-local-tooling/scripts/ecodecmd-e10/bin/ecodecmd-e10.mjs compile ./apps/demo
node skills/ecode-development/modules/e10-frontend-local-tooling/scripts/ecodecmd-e10/bin/ecodecmd-e10.mjs build ./apps/demo
```

EB 自定义组件构建允许空 `entry.js` 进入编译检查，但不会追加 JSONP 模块包装；最终源码和编译字段都保持为空。构建读取 `build.json` 并生成 `.target/<appId>.zip`；新包通过结构校验后才替换旧 ZIP。

构建后检查：

```bash
unzip -l ./apps/demo/.target/<appId>.zip
```

本地 `check/compile/build` 通过不证明组件已经在目标 EB 设计器可见或运行正确；这些状态必须标 `UNVERIFIED`，直到完成目标环境验证。

## 导入

```bash
ecode-cli package import --file <zip> --project-id <id> --build-json <build.json>
```

仅单个 `appUUID` 精确匹配时回写平台 `appId`。EB 自定义组件必须选择编辑器自定义组件项目。

业务组件必须选择编辑器组件默认项目；特色主题必须选择编辑器组件主题项目。`build.json.projectType` 是本地校验标记，不替代远端项目查询。
