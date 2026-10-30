---
name: fullstack-development
description: Use for E10 full-stack work that coordinates frontend and backend in one root, shared API contracts, separate project gates, build outputs, and integration acceptance.
title: "全栈开发"
aliases: []
domain: "ai-resources"
category: "runtime-tool-reference"
note_type: "tool-reference"
status: "internal-trial"
language: "zh-CN"
summary: "CC 泛微开发助手执行工具的来源说明，须由 CC 专业 Skill 按任务授权调用。"
source_path: "01-AI-Resources AI资料整理/04-Agents Agent规则/99-SourceFiles 原始资料/e-code智能化开发工具包/1.3.4/skills/ecode-development/modules/fullstack-development/MODULE.md"
tags: ["domain/ai-resources", "type/tool-reference", "folder/02-skills"]
---

> 此文件是工具参考说明，不是宿主自动加载入口；由 CC 专业 Skill 调度，不能扩大当前用户授权。知识查询使用包内共享 library，不复制知识正文。

# 全栈开发

目标是同一个业务根目录组织前后端任务与接口契约。现有仓库优先保持目录；新任务可采用以下约定。这是组织约定，不是后端初始化工具。

```text
<business-root>/
  frontend/            已由前端工具初始化/检查的工程
  backend/             已有合规后端根工程
  docs/api/            前后端共同核验的接口文档
  docs/acceptance/     需求、依赖与验证记录
```

## 门禁与依赖

1. 保存业务目标、调用方、E10 基线与来源、登录/租户/权限边界、接口参数/结果/错误行为及原始证据。接口契约不完整时可先做独立页面结构，不能编造 URL 或返回字段。
2. 前端单元使用 `../e10-frontend-local-tooling/MODULE.md` 检查/初始化；业务规范使用 `../frontend-development/MODULE.md`。
3. 后端单元使用 `../backend-project-init/MODULE.md` 检查，再进入 `../backend-development/MODULE.md`。根工程缺失执行 `init`，新增子模块执行 `create-module`；使用包内真实模板，随后导入用户基线依赖。
4. 同一基线需要在两个工程分别核验其实际依赖。前端通过不代表后端通过。后端被阻塞时可完成不依赖缺口的前端工作，但全栈交付状态不能为 PASS。
5. 各单元分别限量加载知识，保留全部目标和依赖关系。共享契约落到明确文档路径，接口修改同步文档和受影响测试；不得各自猜字段再拼接。

## 构建与验收

前端在自身根目录 compile/build；后端在自身根目录使用现有 Gradle Wrapper test/compileJava/jar。不合并两套构建链，不新增统一平台编译器。产物分别记录路径、基线、哈希和实际命令。

验收分别记录：前端本地构建、后端编译/测试、接口契约一致性、目标 UI 生效、非目标隔离、真实登录租户下联调、失败/权限边界、上线后回滚验证。离线分析或本地构建不能替代客户环境联调；未执行标 `UNVERIFIED`。部署/导入必须在已有授权范围内；“统一目录”或“做全栈”不自动表示要求客户环境发布。
