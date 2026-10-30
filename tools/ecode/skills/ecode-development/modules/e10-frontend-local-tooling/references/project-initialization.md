---
title: "前端工程初始化与完整性判定"
aliases: []
domain: "ai-resources"
category: "runtime-tool-reference"
note_type: "tool-reference"
status: "internal-trial"
language: "zh-CN"
summary: "CC 泛微开发助手执行工具的来源说明，须由 CC 专业 Skill 按任务授权调用。"
source_path: "01-AI-Resources AI资料整理/04-Agents Agent规则/99-SourceFiles 原始资料/e-code智能化开发工具包/1.3.4/skills/ecode-development/modules/e10-frontend-local-tooling/references/project-initialization.md"
tags: ["domain/ai-resources", "type/tool-reference", "folder/02-skills"]
---

> 此文件是工具参考说明，不是宿主自动加载入口；由 CC 专业 Skill 调度，不能扩大当前用户授权。知识查询使用包内共享 library，不复制知识正文。

# 前端工程初始化与完整性判定

只处理 e-code 前端补丁工程检查、创建和初始化。业务开发、组件复写、接口调用继续交给 `frontend-development`。

## 触发

- 纯前端开发进入实际开发前。
- 当前前端工程为空、不完整，或用户要求新建前端子工程。
- 目标目录缺少 `build.json`、入口 JS、源码目录或必要配置。
- `frontend-development` 要求先确认工程状态。

## 最小校验

只检查目标前端工程目录：

- `build.json`
- `config/config.js`
- `config/config_default.js`
- `config/configLoad.js`
- 根目录 `entry.js` 或现有入口 JS，入口 JS 不得位于 `resources/`
- `resources/` 只作为静态资源目录存在，不作为源码目录
- `coms/`、`styles/`、`utils/` 中实际需要的源码目录

`resources/` 只允许存放资源文件、图片、字体、样式资源、第三方 JS 库等静态资源。AI 生成的前端业务代码、入口代码、组件代码、工具代码和配置代码禁止放入 `resources/`。

## 判定

- 完整工程：上述最小校验通过。返回“工程完整”，后续交给 `frontend-development`。
- 不完整工程：缺少构建、配置、入口或源码骨架。先初始化或补齐工程骨架。
- 业务缺口：只缺业务组件、样式、请求封装或页面文件。不要初始化，交给 `frontend-development`。

已有完整前端工程时复用，不重复初始化。

## 初始化

需要新建或补齐完整前端工程时，使用本 Skill 的 `init`：

```bash
node .ecode/skills/e10-frontend-local-tooling/scripts/ecodecmd-e10/bin/ecodecmd-e10.mjs init <父目录> --project-name <项目名>
```

目标目录已存在时默认停止；只有用户明确允许覆盖时才使用 `--force`。

## 禁止

- 不读取后端 Gradle、`settings.gradle`、`gradlew`。
- 不检查或修改 `secDevLib`、`secDevClasses`、`devLib`。
- 不执行 Java 构建、jar 打包或后端依赖导入。
- 不因后端 `secondev-*` 子模块缺依赖而初始化前端工程。
