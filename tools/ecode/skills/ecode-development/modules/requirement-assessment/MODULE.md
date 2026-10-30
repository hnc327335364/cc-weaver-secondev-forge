---
name: requirement-assessment
description: Use for E10 requirement feasibility, functional analysis, standard configuration versus e-builder versus e-code implementation choices, and evidence-backed acceptance breakdown.
title: "需求分析与方案选择"
aliases: []
domain: "ai-resources"
category: "runtime-tool-reference"
note_type: "tool-reference"
status: "internal-trial"
language: "zh-CN"
summary: "CC 泛微开发助手执行工具的来源说明，须由 CC 专业 Skill 按任务授权调用。"
source_path: "01-AI-Resources AI资料整理/04-Agents Agent规则/99-SourceFiles 原始资料/e-code智能化开发工具包/1.3.4/skills/ecode-development/modules/requirement-assessment/MODULE.md"
tags: ["domain/ai-resources", "type/tool-reference", "folder/02-skills"]
---

> 此文件是工具参考说明，不是宿主自动加载入口；由 CC 专业 Skill 调度，不能扩大当前用户授权。知识查询使用包内共享 library，不复制知识正文。

# 需求分析与方案选择

本模块只组织开发前分析，不办理审批流程。先保存用户目标、业务对象/角色、触发条件、输入输出、端与租户范围、现有工程、E10 基线来源、约束和验收标准。版本未知允许分析；具体 API、SQL 或业务代码仍执行基线与证据门禁。

## 方案比较

1. 标准配置：先进入 `skills/e10-local-knowledge/modules/e10-module-knowledge/MODULE.md`，按业务对象 search→load 正文，确认配置入口、权限、版本和限制。未命中只能记“尚无可核验证据”，不能判定产品没有该能力。
2. e-builder：确实涉及低代码时再限定低代码平台；区分表单、页面 SDK、页面插入、设计器组件。引用已加载文档，不把配置文档当接口证据。
3. e-code 二开：配置不能满足的具体差异才进入案例 search→load 与标准 API search→load；涉及 SQL 另走字典。列出复用点、改造点、风险和未核验项。

每个需求点形成一行：目标行为、标准配置/低代码/二开可行性、正文证据与适用版本、选中方案、工作边界、依赖、验收方法。多意图拆分实现单元及先后依赖；最多三个模块/文档的加载预算逐单元计算，不静默丢弃需求。工作量只能依据已知范围给估计区间和假设，不把案例相似度当工期或正确率。

## 采纳后执行

用户已采纳方案，只做一次必要缺口核验；不反复重搜替代方案、不重新询问已给出的基线或授权。记录原始目标与方案理由，新增约束时只更新受影响部分。缺失证据不能由配置占位补成“已完成”；仅继续不依赖缺口的独立任务。

任务记录使用 `skills/ecode-development/assets/task-record.template.json`。路由脚本分类只是起点，不等于已完成分析。交付必须覆盖所有需求点、独立验收、待确认项，以及本地构建和线上业务验证的不同状态。
