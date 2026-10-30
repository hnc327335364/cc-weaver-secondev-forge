---
description: e-code React 组件复写、替换与页面开发
title: "React 开发专题"
aliases: []
domain: "ai-resources"
category: "runtime-tool-reference"
note_type: "tool-reference"
status: "internal-trial"
language: "zh-CN"
summary: "CC 泛微开发助手执行工具的来源说明，须由 CC 专业 Skill 按任务授权调用。"
source_path: "01-AI-Resources AI资料整理/04-Agents Agent规则/99-SourceFiles 原始资料/e-code智能化开发工具包/1.3.4/skills/ecode-development/modules/frontend-development/references/react.md"
tags: ["domain/ai-resources", "type/tool-reference", "folder/02-skills"]
---

> 此文件是工具参考说明，不是宿主自动加载入口；由 CC 专业 Skill 调度，不能扩大当前用户授权。知识查询使用包内共享 library，不复制知识正文。

# React 开发专题

涉及 `@weapp/ui` 组件选型、属性、事件或示例时，使用 `$e10-ui-components`
检索组件知识库，只加载命中组件的必要章节。

## 0. 定位与选型

1. 打开 React DevTools 的 Components 面板，选取目标元素。
2. 记录真实组件名、所属库、关键 props 和稳定 `weId` 末段。
3. 按“公共组件直接使用 → `regOvProps` 微调 → `regOvComponent` 替换 → 自定义组件”选择最小改动方案。
4. 不把 DOM 完整 `weId`、偶然父级结构或易变 class 当长期定位依据。

## 1. 组件参数复写

使用 `@weapp/utils` 的 `regOvProps`。必须：

1. 指定正确库名和组件名。
2. 用路由、业务 props 或 `weId` 末段限定范围。
3. 返回修改后的 props。
4. 不在回调中执行重型同步逻辑。

```javascript
import { regOvProps } from "@weapp/utils";

regOvProps("weappUi", "Table", (props) => {
  const { weId = "" } = props;
  if (!weId.endsWith("_i83sct")) {
    return props;
  }
  return {
    ...props,
    pagination: false,
  };
}, 0);
```

## 2. 组件替换

1. 被替换组件放非前置文件。
2. 前置入口只注册替换逻辑。
3. 异步组件外层使用 `React.Suspense`。
4. 保留原组件必要 props、事件和 ref 行为。
5. 需要透传 ref 时使用 `React.forwardRef`，不得静默截断平台 ref。

```javascript
import { asyncImport } from "@weapp/ecodesdk";

const CustomComponent = React.lazy(() =>
  asyncImport("${appId}", "CustomComponent"),
);

const replacement = (
  <React.Suspense fallback={null}>
    <CustomComponent />
  </React.Suspense>
);
```

## 3. 新页面

1. 通过 `weappEcodesdk` 的 Switch 扩展机制注册路由。
2. 路由必须足够具体，避免吞掉后续标准路由。
3. 页面组件异步加载。
4. 同时验证 PC/移动端和二级路径场景。

## 4. 样式

```css
.app-720941244693372928-container .custom-button {
  color: red;
}
```

禁止无容器限定地改写通用标签或平台公共 class。

## 5. 完整案例

本 Skill 内置精简案例：

- [组件参数复写](examples/component-override.md)
- [单页路由](examples/single-page-route.md)

仅当前专题示例不足时，定向读取：

- `../../../../e10-local-knowledge/modules/ecode-source-docs/references/前后端二次开发规范.md` 的 `1.1`、`1.2` 对应小节。
- `../../../../e10-local-knowledge/modules/ecode-source-docs/references/开发指引.md` 的 `2.3`、`2.4` 对应小节。

## 6. 发布边界

- 租户应用：只在目标租户及登录后范围验证。
- 公共应用：额外验证登录前、登录后和免登页面边界。
- 发布端明确选择 PC (`P`)、移动端 (`M`) 或全部 (`ALL`)；不能用 PC 通过推断移动端也通过。
