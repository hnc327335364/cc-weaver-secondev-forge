---
title: "浏览按钮定制"
aliases: []
domain: "ai-resources"
category: "runtime-tool-reference"
note_type: "tool-reference"
status: "internal-trial"
language: "zh-CN"
summary: "CC 泛微开发助手执行工具的来源说明，须由 CC 专业 Skill 按任务授权调用。"
source_path: "01-AI-Resources AI资料整理/04-Agents Agent规则/99-SourceFiles 原始资料/e-code智能化开发工具包/1.3.4/skills/ecode-development/modules/frontend-development/references/browser-customization.md"
tags: ["domain/ai-resources", "type/tool-reference", "folder/02-skills"]
---

> 此文件是工具参考说明，不是宿主自动加载入口；由 CC 专业 Skill 调度，不能扩大当前用户授权。知识查询使用包内共享 library，不复制知识正文。

# 浏览按钮定制

适用于已确认的 Browser 类组件；具体派生组件、PC/移动端和旧基线必须加载各自契约。先按 [组件定位](component-location.md) 确认目标，而不是把“浏览按钮”路由成公共业务查询 API。

## 页签与历史记录

原文：`skills/e10-local-knowledge/modules/e10-ui-components/references/pc/browser.md` 的“设置tabs属性”示例及底部属性表。

- `tabs`：显式页签数据。原文注明 `getTabs` 优先级比 `props.tabs` 低；已传 tabs 时，不要期待 getTabs 再加工结果。
- `getTabs`：加工接口返回的页签。先读取默认项的真实结构与标识，保留默认项及必要事件；需要增删时说明影响。不要照抄示例中直接 push 原数组的写法，优先产生新数组，避免污染复用对象。
- `historyURL`：点击确认时记录已选数据；`historyParams` 是其参数，`disabledCallHistory` 控制此请求。该行为不等于“历史记录页签”，也不等于 React Router 的 `history`。不要只为隐藏页签而禁用记录请求。
- 默认页签、活动页签和选择范围按实际目标组件契约核验；不要猜页签 id。保留原 onChange/确认/清空事件参数和时序；回显与受控 value 以契约为准，不臆断置空一定可恢复选择。

## 验证矩阵

| 维度 | 必测行为 |
|---|---|
| 默认与新增页签 | 默认项保留/明确删除、默认激活、切换、返回后状态 |
| 选择与回显 | 单选/多选、已有值、搜索、清空后重新选择、确认/取消 |
| 请求与事件 | 原事件、参数、次数、history 记录与相关权限 |
| 状态与作用域 | 禁用/只读、目标页面、非目标页面、重复打开 |
| 端与组件变体 | 所要求 PC/移动端、标准/派生组件逐个核验 |

业务不适用的维度记 `N/A` 并给原因；未实际执行记 `UNVERIFIED`。PC Browser 文档不构成所有派生组件和移动端通用证明。替换请求实现需要另外核验准入接口和权限，不能从浏览器组件文档推导任意 API 可调用。
