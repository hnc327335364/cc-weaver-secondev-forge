---
name: frontend-development
description: Use when E10/e-code work involves frontend development, 前端开发规范、React、Vue、请求拦截、组件复写、组件替换、新页面、样式隔离、加载边界或前端调试。
title: "前端开发"
aliases: []
domain: "ai-resources"
category: "runtime-tool-reference"
note_type: "tool-reference"
status: "internal-trial"
language: "zh-CN"
summary: "CC 泛微开发助手执行工具的来源说明，须由 CC 专业 Skill 按任务授权调用。"
source_path: "01-AI-Resources AI资料整理/04-Agents Agent规则/99-SourceFiles 原始资料/e-code智能化开发工具包/1.3.4/skills/ecode-development/modules/frontend-development/MODULE.md"
tags: ["domain/ai-resources", "type/tool-reference", "folder/02-skills"]
---

> 此文件是工具参考说明，不是宿主自动加载入口；由 CC 专业 Skill 调度，不能扩大当前用户授权。知识查询使用包内共享 library，不复制知识正文。

# 前端开发

前端业务开发规范 Skill。工程检查和初始化只由 `e10-frontend-local-tooling` 负责；本 Skill 只处理业务实现、组件复写、请求和调试。

## 工作流程

1. 先加载 `baseline`。
2. React、Vue、请求拦截、调试按场景追加单篇文档。
3. UI 组件调用 `读取内部模块`，`skills/e10-local-knowledge/modules/e10-ui-components/MODULE.md`；Utils 调用 `读取内部模块`，`skills/e10-local-knowledge/modules/e10-utils-knowledge/MODULE.md`。
4. 不批量读取 `references/`。

```bash
node skills/ecode-development/modules/frontend-development/scripts/search.mjs search "请求拦截"
node skills/ecode-development/modules/frontend-development/scripts/search.mjs load request-interceptor --section summary
```

## 与工程初始化的边界

- 前端新需求进入业务实现前，必须先触发 `e10-frontend-local-tooling` 检查或初始化完整前端项目工程。
- `e10-frontend-local-tooling` 返回工程完整或已初始化后，继续执行业务实现。
- `e10-frontend-local-tooling` 判断工程缺失或不完整时，先完成初始化；本 Skill 不自行补齐工程骨架。
- 禁止跳过初始化后只创建单个业务文件；缺口仅为业务文件时，由本 Skill 按现有入口和目录约定创建业务文件。
- 工程完整后，发布工具链调用 `读取内部模块`，`skills/ecode-development/modules/e10-frontend-local-tooling/MODULE.md`，按需执行 `init`、`compile` 或 `build`。

## 实现门禁

- 业务源码只允许 `.js`；禁止创建或输出 `.jsx`、`.ts`、`.tsx`，禁止 TypeScript 配置、类型语法和构建链。
- `resources/` 只允许存放资源文件、图片、字体、样式资源、第三方 JS 库等静态资源；AI 生成的前端业务代码、入口代码、组件代码、工具代码和配置代码禁止放入 `resources/`。
- React 为默认路径；只有用户明确要求 Vue 时加载 Vue 专题。
- 前置加载文件禁止直接使用 `@weapp/ui`；异步组件使用平台加载方式并由 `React.Suspense` 包裹。
- 组件复写限定路由、业务 props 或稳定 `weId` 末段；CSS 限定应用或业务容器。
- 先用 React DevTools 确认组件名、props 与稳定 `weId` 末段；不得依赖完整动态路径。
- UI 选型顺序固定为：直接使用公共组件、`regOvProps` 微调、`regOvComponent` 替换、最后自定义组件。
- 组件替换必须保留原 props、事件和 ref；需要 ref 时使用 `React.forwardRef`。
- 请求使用 `devRequest`，拦截使用 `regApiInterceptor`，不得绕过准入名单直调 OpenAPI 或 `/openserver/`。
- 明确 PC/移动端、登录态、租户应用/公共应用和发布端 `P`/`M`/`ALL`，并验证目标页面生效与非目标页面隔离。

## 组件复写交付流程

组件复写、参数调整或组件替换请求默认完成以下交付，不只返回示例代码块：

1. 确认 `e10-frontend-local-tooling` 已返回工程完整或已初始化。
2. 复用现有入口和目录约定，定位或创建入口注册文件。
3. 先确认组件名、原 props、事件、ref 和稳定生效范围。
4. 仅修改 props、样式或事件时使用 `regOvProps`；需要替换渲染结构时使用
   `regOvComponent`，并保留原 props、事件和 ref。
5. 仅将已定位、已核验契约下的 `route`、稳定 `weId` 末段、`appId` 等环境差异值提取为集中配置常量。未知组件名、关键事件、ref 或作用域不能以占位配置绕过定位。
   启动注册前校验必需配置，缺失时明确失败并指出配置名，禁止静默全局生效。
6. 调用 `读取内部模块`，`skills/ecode-development/modules/e10-frontend-local-tooling/MODULE.md`，执行 `compile`；需要交付补丁时
   继续执行 `build`。验证目标页面生效、非目标页面隔离，并确认产物位于
   `.target/*.zip`。
7. 最终报告修改文件、组件复写行为、实际验证命令和结果、补丁产物位置及待配置项。

资料未命中时，仅完成不依赖缺失证据的独立工作。组件名、关键事件契约、生效范围或基线未核验时停止对应平台实现，列出精确缺口；不得先产出猜测注册代码。

## 1.3.1 开发参考卡

- 非标准组件、名称或位置未知：[组件定位](references/component-location.md)。
- 浏览按钮页签、选择/回显、历史接口：[浏览按钮定制](references/browser-customization.md)。
- 新工程目录、函数组件、状态归属；存量 class/store 保持：[工程约定](references/project-conventions.md)。
- EB 设计器扩展与页面 SDK 不混用：[EB 组件](../eb-component-development/MODULE.md)。

这些参考卡是当前选择规则，历史 class 示例不构成新工程统一采用 class/store 的要求。compile/build 成功只验证本地产物；目标页面、隔离、PC/移动端、真实数据和登录租户行为未实测须标 `UNVERIFIED`。
