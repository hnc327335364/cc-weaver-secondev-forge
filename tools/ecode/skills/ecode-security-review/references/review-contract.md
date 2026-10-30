---
title: "Security review contract 1.1"
aliases: []
domain: "ai-resources"
category: "runtime-tool-reference"
note_type: "tool-reference"
status: "internal-trial"
language: "zh-CN"
summary: "CC 泛微开发助手执行工具的来源说明，须由 CC 专业 Skill 按任务授权调用。"
source_path: "01-AI-Resources AI资料整理/04-Agents Agent规则/99-SourceFiles 原始资料/e-code智能化开发工具包/1.3.4/skills/ecode-security-review/references/review-contract.md"
tags: ["domain/ai-resources", "type/tool-reference", "folder/02-skills"]
---

> 此文件是工具参考说明，不是宿主自动加载入口；由 CC 专业 Skill 调度，不能扩大当前用户授权。知识查询使用包内共享 library，不复制知识正文。

# Security review contract 1.1

The JSON document is canonical. Markdown, dashboards, and old templates are views derived from it and must not change the decision.

Allowed stages: `FILE_SAVE`, `PROJECT_IMPORT`, `PROJECT_MIGRATION`, `PROJECT_RELEASE`, `JAR_RELEASE`, `UNKNOWN`.

Required provenance:

- `reviewId`: deterministic identifier bound to audit type, stage, artifact hash, and rule-pack version.
- `artifactHash`: SHA-256 of the sorted `path:sha256` input inventory.
- `rulePackVersion`: SHA-256 of `TOOL-REFERENCE.md` and all files under `references/`.
- `inputFiles`: sorted project-relative path and SHA-256 pairs.
- `reviewInput.completeSnapshot`: false by default; true only after explicit project/JAR completeness attestation.
- `reviewInput.loadedChecklists`: `frontend`, `java`, or both. Complete project/JAR reviews must return every ID from each declared checklist exactly once.

Finding severity is `CRITICAL`, `HIGH`, `MEDIUM`, or `LOW`; `blocking` expresses decision effect. Checklist statuses are `PASS`, `FAIL`, `N/A`, and `UNVERIFIED`.

`rulesApplied` contains unique IDs. `rulesSkipped` contains ID and reason. They cannot overlap. `rootCauseKey` is unique among findings so one cause is not counted twice.

`verificationNeeded` is not a finding. Each item declares whether it is high risk and blocking. `errors` represents request, parse, snapshot, or contract failures and always blocks.

Validation with `--artifact` rehashes current files and the current rule pack. Changed input or rules produce a stale-review failure rather than reusing approval.

Compatibility: render former Markdown reports from this JSON. Schema 1.0 prose is historical input only and cannot be a 1.1 approval artifact.
