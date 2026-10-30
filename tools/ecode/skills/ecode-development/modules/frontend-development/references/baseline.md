---
description: e-code 前端开发强制基线
title: "前端开发基线"
aliases: []
domain: "ai-resources"
category: "runtime-tool-reference"
note_type: "tool-reference"
status: "internal-trial"
language: "zh-CN"
summary: "CC 泛微开发助手执行工具的来源说明，须由 CC 专业 Skill 按任务授权调用。"
source_path: "01-AI-Resources AI资料整理/04-Agents Agent规则/99-SourceFiles 原始资料/e-code智能化开发工具包/1.3.4/skills/ecode-development/modules/frontend-development/references/baseline.md"
tags: ["domain/ai-resources", "type/tool-reference", "folder/02-skills"]
---

> 此文件是工具参考说明，不是宿主自动加载入口；由 CC 专业 Skill 调度，不能扩大当前用户授权。知识查询使用包内共享 library，不复制知识正文。

# 前端开发基线

技术域包含前端时必须读取。本文件只放所有前端任务都要检查的规则。

## 1. 项目与加载

1. 前端新需求，或当前目录不存在完整 e-code 前端项目工程时，必须先调用 `e10-frontend-local-tooling` 检查或初始化完整前端项目，再在生成项目内开发和发布。
2. 禁止跳过初始化后只创建或交付单个业务文件。只有修改当前已存在的完整前端项目工程时，才可跳过重复初始化。
3. e-code 前端业务源码只允许 `.js`；禁止创建或输出 `.jsx`、`.ts`、`.tsx`，禁止引入 TypeScript 配置、类型语法或 TypeScript 构建链。
4. 工程完整后，发布工具链调用 `e10-frontend-local-tooling` 执行 `init`、`compile` 或 `build`，不得用单文件替代工程发布。
5. `resources/` 只允许存放资源文件、图片、字体、样式资源、第三方 JS 库等静态资源；AI 生成的前端业务代码、入口代码、组件代码、工具代码和配置代码禁止放入 `resources/`。
6. `.ecode` 中 Gradle、`secDevLib`、jar 打包相关模板是后端本地项目模板，不适用于前端。
7. `entry.js` 是前置加载默认入口并自动执行，必须放在前端项目源码位置，不得放入 `resources/`。
8. 前置加载文件只放注册、钩子、轻量判断；页面组件和非立即执行逻辑放非前置文件。
9. 前置加载仅使用平台允许的核心模块，如 React、ReactDOM、`@weapp/utils`、`@weapp/ecodesdk`、axios；不得直接使用 `@weapp/ui`。
10. 异步组件必须用 `asyncImport` 等平台方式加载，并由 `React.Suspense` 包裹。

## 2. 作用域隔离

1. 组件复写必须限定生效范围，优先组合页面路由、业务 props、稳定标识。
2. 使用 `weId` 时只匹配末段，例如 `weId.endsWith("_i83sct")`；禁止匹配完整拼接路径。
3. CSS 必须增加应用或业务容器 class 限定，禁止污染全局。
4. 不使用 DOM 上完整 `weId` 作为长期 CSS 选择器。
5. 多级路径或二级域名场景使用平台路径封装，避免硬编码部署根路径。

## 3. 请求与安全

1. 前端二开请求使用 `devRequest`，不直接使用普通 `request`。
2. 请求/响应拦截使用 `regApiInterceptor`，不直接注册 axios 全局拦截器。
3. 拦截器修改数据后必须返回 config/response；错误分支返回 `Promise.reject(error)`。
4. 前端只能调用准入名单允许的接口。
5. 前端禁止绕过 `devRequest` 使用 request/axios 直调开放平台接口；OpenAPI、`/openserver/` 等能力需要时由后端二开代理调用。请求 URL 还必须满足二开准入名单。

## 4. 发布与验证

1. 明确 PC、移动端、登录前后、公共应用或租户应用生效范围。
2. 组件替换、新页面注册和拦截逻辑必须保留原有行为或明确影响边界。
3. 验证至少包含：目标页面生效、非目标页面不生效、控制台/网络错误、屏蔽二开代码后的对比。

## 5. 按需专题

- React/组件/页面：[`react.md`](react.md)
- `@weapp/ui` 组件选型和 API：使用 `$e10-ui-components` Skill
- `@weapp/utils` 工具能力：使用 `$e10-utils-knowledge` Skill
- 外部三方网页接入 E10 组件化 JS-SDK：使用 `$e10-component-js-sdk` Skill
- Vue：仅用户明确要求时读取 [`vue.md`](vue.md)
- 请求与拦截：[`request-interceptor.md`](request-interceptor.md)
- 调试排障：[`debugging.md`](debugging.md)

Utils Skill 只在需求涉及 `@weapp/utils`、明确导出符号或对应工具场景时触发。先搜索，再按 `summary`、`example`、`all` 逐级加载单卡；禁止默认读取全部 51 张卡。
