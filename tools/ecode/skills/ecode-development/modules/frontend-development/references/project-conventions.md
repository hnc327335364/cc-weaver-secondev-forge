---
title: "前端工程约定"
aliases: []
domain: "ai-resources"
category: "runtime-tool-reference"
note_type: "tool-reference"
status: "internal-trial"
language: "zh-CN"
summary: "CC 泛微开发助手执行工具的来源说明，须由 CC 专业 Skill 按任务授权调用。"
source_path: "01-AI-Resources AI资料整理/04-Agents Agent规则/99-SourceFiles 原始资料/e-code智能化开发工具包/1.3.4/skills/ecode-development/modules/frontend-development/references/project-conventions.md"
tags: ["domain/ai-resources", "type/tool-reference", "folder/02-skills"]
---

> 此文件是工具参考说明，不是宿主自动加载入口；由 CC 专业 Skill 调度，不能扩大当前用户授权。知识查询使用包内共享 library，不复制知识正文。

# 前端工程约定

新工程先使用 `e10-frontend-local-tooling` 创建完整工程，遵守 [baseline.md](baseline.md)。下列目录是 1.3.1 的业务组织约定，不是平台必须存在的额外配置，也不是可直接导入的应用模板。

```text
<frontend-root>/
  build.json           工程工具维护，标识不得重复生成
  entry.js             前置注册、轻量判断
  coms/                页面及复用组件 .js
  styles/              样式资源
  utils/               纯工具函数 .js
  services/            请求封装与结果适配 .js
  stores/              确有跨组件共享需求时建立 .js
  config/              已核验的环境差异值 .js
  resources/           仅静态资源
```

- 新 React 业务默认函数组件。局部交互状态归组件；多个组件共享状态提升到共同所有者，确有跨页面/复杂共享需要才沿平台现有能力建立 store。不要为简单页面强制创建全局 store 或添加新依赖。
- 服务器数据、请求生命周期与错误适配归 services/页面协调层；展示组件不散落相同请求。平台请求使用已核验的 devRequest 契约。
- 存量工程沿现有目录、class、store 和生命周期方式局部修改。不能因为新工程偏好函数组件自动重构存量 class/store；确需迁移时另说明目标、影响和验证。
- entry.js 仅注册/Hook/轻量判断；页面组件异步加载并保留 Suspense 边界。前置入口禁止直接依赖 @weapp/ui；业务源码仅 .js，不引入 .jsx/.ts/.tsx。
- 函数组件不是正确性的充分条件。副作用清理、受控状态、闭包、请求取消/过期结果、事件/ref 契约按实际组件评审。
- 不把 appId、appUUID、route、组件标识或 API 常量写成未经核验的示例值。配置只承载已确认契约的环境差异。

## 检查边界

只读检查可报告实际文件扩展名、resources 业务文件候选、入口与依赖引用等可观察事实；文本匹配只能产生候选或明确的结构违规，不能证明状态归属、权限、事件语义、组件定位或运行兼容正确。缺少证据、动态加载或存量结构应列入人工核验，不强制改写。检查状态采用 PASS/FAIL/N/A/UNVERIFIED。

可复制 `skills/ecode-development/assets/frontend-pattern/conventions.template.json` 记录所选约定；它是检查/评审元数据模板，不能代替真实 init/compile/build 或平台 UI 验证。

## 随包只读检查与纯 UI 模式

```bash
node skills/ecode-development/scripts/check-project-conventions.mjs <frontend-directory> --mode existing
```

新工程可使用 `--mode new`。检查器只核验基础目录、build.json 顶层对象及 codes 的路径、扩展名与文件是否存在。注册文件扩展名仅接受构建器支持的 .js/.css，业务 JavaScript 仍仅 .js；输出 status 为 PASS/FAIL，semanticValidation 为 UNVERIFIED。它不检查 React 行为、state/store 语义、注册契约、权限或目标 UI，不能称为全面自动门禁。

纯 UI 模式文件位于 `skills/ecode-development/modules/frontend-development/assets/function-page/coms/Page.js` 和 `skills/ecode-development/modules/frontend-development/assets/function-page/utils/map-result.js`。它们只提供普通 React 展示与结果适配示例，不是完整 E10 工程或 EB 组件。先通过 init/工程检查、核验基线与平台契约，再放入真实工程并按其入口异步加载；前置文件不直接引入 @weapp/ui，保留 Suspense 边界。平台注册、请求、组件标识和权限需要独立证据，不能从此模式推定。
