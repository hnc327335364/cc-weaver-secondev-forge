---
title: "Performance review contract 1.1"
aliases: []
domain: "ai-resources"
category: "runtime-tool-reference"
note_type: "tool-reference"
status: "internal-trial"
language: "zh-CN"
summary: "CC 泛微开发助手执行工具的来源说明，须由 CC 专业 Skill 按任务授权调用。"
source_path: "01-AI-Resources AI资料整理/04-Agents Agent规则/99-SourceFiles 原始资料/e-code智能化开发工具包/1.3.4/skills/ecode-performance-review/references/review-contract.md"
tags: ["domain/ai-resources", "type/tool-reference", "folder/02-skills"]
---

> 此文件是工具参考说明，不是宿主自动加载入口；由 CC 专业 Skill 调度，不能扩大当前用户授权。知识查询使用包内共享 library，不复制知识正文。

# Performance review contract 1.1

JSON is canonical. Markdown or legacy views must be rendered from it and cannot alter the decision.

Allowed stages: `FILE_SAVE`, `PROJECT_IMPORT`, `PROJECT_MIGRATION`, `PROJECT_RELEASE`, `JAR_RELEASE`, `UNKNOWN`.

`artifactHash` is SHA-256 of the sorted `path:sha256` input inventory. `rulePackVersion` is SHA-256 of `TOOL-REFERENCE.md` plus `references/`. `reviewId` binds audit type, stage, artifact hash, and rule pack. Project/JAR completeness stays false unless explicitly attested during `prepare`; `validate --artifact` rehashes files and rules before accepting the result.

Every finding has a unique `rootCauseKey`, `findingType`, rule ID, original severity, evidence, trigger path, impact, remediation, and minimal example. All `Weaver-*` findings use `PLATFORM_POLICY`; all `PERF-*` findings use `PERFORMANCE_RISK`.

`rulesApplied` and `rulesSkipped` are disjoint. `verificationNeeded` is not a finding and produces `riskState=WARNINGS`. `errors` always block. Summary counts are recomputed by the validator.

Compatibility: schema 1.0 consumers may read shared fields, but only schema 1.1 with matching provenance can be used as a current approval artifact.
