---
name: eb-component-development
description: Use for E10 e-builder page SDK, page component insertion, or designer custom component development; distinguish their contracts and validate baseline before reuse.
title: "EB 组件开发"
aliases: []
domain: "ai-resources"
category: "runtime-tool-reference"
note_type: "tool-reference"
status: "internal-trial"
language: "zh-CN"
summary: "CC 泛微开发助手执行工具的来源说明，须由 CC 专业 Skill 按任务授权调用。"
source_path: "01-AI-Resources AI资料整理/04-Agents Agent规则/99-SourceFiles 原始资料/e-code智能化开发工具包/1.3.4/skills/ecode-development/modules/eb-component-development/MODULE.md"
tags: ["domain/ai-resources", "type/tool-reference", "folder/02-skills"]
---

> 此文件是工具参考说明，不是宿主自动加载入口；由 CC 专业 Skill 调度，不能扩大当前用户授权。知识查询使用包内共享 library，不复制知识正文。

# EB 组件开发

先确定交付位置；三类能力不能互相替代。已有需求能判断时直接分流，只确认真正缺少的信息。

| 场景 | 证据入口（包根相对路径） | 必须核验 |
|---|---|---|
| 页面 SDK 操作既有页面/组件 | `skills/e10-local-knowledge/modules/e10-ebuilder-page-jsapi/MODULE.md` | 页面类型、API 参数、生命周期、基线；页面 SDK 不证明设计器注册 |
| 在现有页面插入或替换 UI | `skills/ecode-development/modules/frontend-development/MODULE.md` | 真实扩展点、目标组件、props/事件/ref、路由与隔离；先读组件定位卡 |
| 设计器可拖拽、可配置组件 | 本模块“EB 自定义组件应用”及 `e10-frontend-local-tooling` | `projectType=E`、`appMode=2`、标准模板、设计态/运行态/移动端、配置与样式协议 |

## EB 自定义组件应用

空白组件使用 `eb-custom-component` 专用模板初始化：

```bash
node skills/ecode-development/modules/e10-frontend-local-tooling/scripts/ecodecmd-e10/bin/ecodecmd-e10.mjs init ./apps --project-name demo --app-type eb-custom-component
```

模板固定包含 `Design.js`、`View.js`、`Config.js`、`MDesign.js`、`MView.js`、`StyleConfig.js`、空 `entry.js`、平台 `config/` 和 `resources/`。应用身份固定为 `projectType=E`、`appMode=2`、`pcOrMobile=A`、`commonFlag=n`。

`entry.js` 必须存在且保持 `state=y`，但源码和构建后的代码都必须严格为空。除空的系统配置文件 `config/config.js`、`config/config_default.js` 外，禁止其他前置加载文件。AI 生成的组件、业务逻辑、配置和样式代码全部写入 `state=n` 的非前置文件；不得向 `entry.js` 或平台配置文件写代码，也不得为解决加载问题把业务文件改为前置。

修改后先执行：

```bash
node skills/ecode-development/modules/e10-frontend-local-tooling/scripts/ecodecmd-e10/bin/ecodecmd-e10.mjs check <项目目录>
node skills/ecode-development/modules/e10-frontend-local-tooling/scripts/ecodecmd-e10/bin/ecodecmd-e10.mjs build <项目目录>
```

校验失败时禁止打包和导入。

## 最小契约

记录：目标 E10 基线及来源、EB 场景类型、组件唯一标识及来源、属性定义与默认值、事件参数、数据请求与权限、PC/移动端差异、资源路径、构建产物与实际导入入口。`Design/MDesign` 提供设计态与默认配置，`View/MView` 提供运行态，`Config` 提供属性项，`StyleConfig` 提供样式项。自定义 props 禁止使用平台保留的 `type` 字段。

## 设计器案例候选

案例 `1060802908740067329` 可补充复杂结构，但不是初始化模板或跨版本承诺。使用案例前按 `ecode-case-catalog` 的 `search-case → load-case → search-code/load-code` 顺序限量取证；案例源码不得覆盖上述模板和前置加载硬规则。

## 交付边界

本地 `check`、编译和 ZIP 构建成功，只证明静态结构与本地打包通过。设计器可见、属性保存重开、运行态、事件、权限和目标端兼容仍需目标环境验证，未验证项标 `UNVERIFIED`。
