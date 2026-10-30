---
title: "组件定位与复写选择"
aliases: []
domain: "ai-resources"
category: "runtime-tool-reference"
note_type: "tool-reference"
status: "internal-trial"
language: "zh-CN"
summary: "CC 泛微开发助手执行工具的来源说明，须由 CC 专业 Skill 按任务授权调用。"
source_path: "01-AI-Resources AI资料整理/04-Agents Agent规则/99-SourceFiles 原始资料/e-code智能化开发工具包/1.3.4/skills/ecode-development/modules/frontend-development/references/component-location.md"
tags: ["domain/ai-resources", "type/tool-reference", "folder/02-skills"]
---

> 此文件是工具参考说明，不是宿主自动加载入口；由 CC 专业 Skill 调度，不能扩大当前用户授权。知识查询使用包内共享 library，不复制知识正文。

# 组件定位与复写选择

非标准组件没有可直接假定的组件名或 weId。先定位，再选择扩展方式；业务按钮名称、截图文字和 DOM 标签只能作线索。

## 定位证据卡

- 目标页面与功能：可复现入口、PC/移动端、登录/租户/应用范围、E10 基线来源。
- 组件来源：实际 React DevTools 或项目源码位置、组件显示名、父子关系、props、事件及 ref 契约；记录观测方式和文件/位置。
- 稳定范围：实际路由、业务 props、已证实稳定的 weId 末段，以及至少一个非目标页面。不要从完整动态 weId 截取未经复验的后缀。
- 行为：原始渲染、回调参数、事件顺序、受控值、禁用/只读与权限语义。
- 状态：源码定位可核验和真实 UI 定位分别记录；没有浏览器/DevTools 访问时，明确尚未完成 UI 定位。

## 选择顺序

公共组件直接使用 → `regOvProps` 微调 → `regOvComponent` 替换 → 自定义组件。选择依据必须是当前基线已加载的契约；名字相似不证明可复写。

只改 props/样式/事件优先微调；替换渲染时保留原 props、事件、ref、受控状态和权限。需要 ref 时按原契约转发。以路由、业务 props 和稳定标识限制生效范围；CSS 限定应用或业务容器，禁止全局污染。

未知组件名、事件/ref、稳定范围或基线时，停止对应注册实现；仅生成证据卡与不依赖平台标识的独立内容。外置配置只处理已经核验的环境差异值，不允许把未知标识包装为“填配置即可运行”。

## 验证

目标页面有效、非目标页面不变、原回调恰当触发、ref/受控值保留、禁用与只读、重复进入/退出后的注册生命周期、目标端差异、控制台及网络错误分别验收。UI 未实测标 `UNVERIFIED`。原文来源：同目录 [baseline.md](baseline.md)、[react.md](react.md)、[debugging.md](debugging.md)；按需只读对应章节。
