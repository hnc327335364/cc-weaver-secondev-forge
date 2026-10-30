---
title: "API 模块基线（本地基础）"
aliases: []
domain: "ai-resources"
category: "runtime-tool-reference"
note_type: "tool-reference"
status: "internal-trial"
language: "zh-CN"
summary: "CC 泛微开发助手执行工具的来源说明，须由 CC 专业 Skill 按任务授权调用。"
source_path: "01-AI-Resources AI资料整理/04-Agents Agent规则/99-SourceFiles 原始资料/e-code智能化开发工具包/1.3.4/skills/ecode-development/modules/backend-development/references/api-module-baseline.md"
tags: ["domain/ai-resources", "type/tool-reference", "folder/02-skills"]
---

> 此文件是工具参考说明，不是宿主自动加载入口；由 CC 专业 Skill 调度，不能扩大当前用户授权。知识查询使用包内共享 library，不复制知识正文。

# API 模块基线（本地基础）

以下已知模块用于业务 Skill 的结构化 API 定向检索：

1. 工作流程_dubbo
2. 工作流程_http
3. 流程流转_dubbo
4. 流程流转_http
5. 流程数据列表及统计_dubbo
6. 流程数据列表及统计_http
7. 流程规则_dubbo

使用规则：
- 先按业务对象选择唯一主 Skill。
- 使用该 Skill 的 `scripts/search-api.mjs search`，以上述完整模块名作为检索词或 `--module` 参数。
- 对最终候选执行 `scripts/search-api.mjs load`，核对接口签名、参数、协议和版本范围。
- 结构化契约不足时，再使用同一 Skill 的 `scripts/search.mjs` 检索原始文档。
- 全部未命中时，按本地知识证据门禁处理，不猜测模块名或接口。
