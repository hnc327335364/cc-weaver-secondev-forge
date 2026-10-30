---
title: "E9 → E10 组织人员同步"
aliases: []
domain: "ai-resources"
category: "runtime-tool-reference"
note_type: "tool-reference"
status: "internal-trial"
language: "zh-CN"
summary: "CC 泛微开发助手执行工具的来源说明，须由 CC 专业 Skill 按任务授权调用。"
source_path: "01-AI-Resources AI资料整理/04-Agents Agent规则/99-SourceFiles 原始资料/e-code智能化开发工具包/1.3.4/skills/ecode-integration/references/sync.md"
tags: ["domain/ai-resources", "type/tool-reference", "folder/02-skills"]
---

> 此文件是工具参考说明，不是宿主自动加载入口；由 CC 专业 Skill 调度，不能扩大当前用户授权。知识查询使用包内共享 library，不复制知识正文。

# E9 → E10 组织人员同步

源材料：原包 E9ToE10Sync.java 与 sync-mapping.md。保留分部→部门→岗位→人员顺序、code/job_num 主键和每批最多 50 条；重写配置与执行边界，去掉固定公司、总经理 code=22 锚点写入、默认 optId=1、隐式状态映射及失败后继续。

## 映射

| 对象 | 来源字段 | E10 字段 |
| --- | --- | --- |
| 分部 | id/subcompanyname/supsubcomid | code/name/parent |
| 部门 | id/departmentname/supdepid/subcompanyid1 | code/name/parent（顶级部门指分部） |
| 岗位 | id/jobtitlename/parentjobtitleid/jobdepartmentid | code/name/parent/department |
| 人员 | workcode/lastname/departmentid/jobtitle/status | job_num/username/department/position/personnel_status |

人员岗位按 code 引用，不沿用原映射文档中的 name 描述。支持原始 Java 中的 mobile、email、createdate；sex 仅在显式 sexMap 提供时映射。

分部/部门/岗位编码可分别加 sync.codePrefixes；前缀会影响目标匹配，执行前检查既有 E10 编码，不能为消除冲突随意更改。部门和分部共用组织引用空间，编码重叠直接拒绝。父级按拓扑顺序排列；重复工号、循环、未映射状态和越界引用拒绝。

sync.subcompanyIds 是精确分部集合，包含所有待处理上下级分部；不自动含下级。外部已存在组织/岗位编码需列入 sync.existing 对应数组。可设 rootParent 或 positionRootCode，必须已在对应 existing 中确认；本程序不会创建/修改该锚点。sync.statusMap、orgStatus、positionCanceled 按目标状态枚举填写，无默认“在职/启用”猜测。

endpoints 逐类指定原 Java `/api/hrm/restful/sync...` 或离线知识出现的 `/sapi/hrm/restful/sync...`；在目标契约支持前不得改前缀，不能失败后自动 fallback。operatorId 由获得授权的目标操作主体决定。

## 离线计划与执行

```sh
node <本Skill>/scripts/integration.mjs sync plan --config integration.json --snapshot e9-snapshot.json --out sync-plan.json
node <本Skill>/scripts/integration.mjs sync apply --config integration.json --plan sync-plan.json --dry-run
node <本Skill>/scripts/integration.mjs sync apply --config integration.json --plan sync-plan.json --approve <计划输出的SHA256> --journal sync-audit.jsonl
```

前两条零请求，包括零认证。计划固定源/目标环境、目标版本、分部范围、配置摘要、逐批完整请求与总量上限。任何配置或计划内容变化后重新生成、审阅摘要；不可通过手工更新摘要跳过审阅。

执行前在 sync.backupEvidence 记录目标备份位置、恢复方法和核验时间；查看目标同编码/同工号已有记录，明确哪些覆盖可接受。工具只生成 upsert 请求，不自动读取 E10 全量目标，不提供自动差异比对或回滚。

执行请求前落审计 attempt 并刷盘；每批要求逐条 SUCCESS，返回数量匹配请求量。失败、返回结构未知或超时立即停，之前批次可能已提交；日志中 indeterminate 表示应先查目标状态。不得把同一计划从头自动重试。处理后重新采集/核对并生成剩余范围计划。

空数组允许跳过某类，但剩余对象的所有引用必须在当前计划或已核实 existing 中；默认完整链不删除目标数据，也不自动同步停用/离职的业务含义，statusMap 必须由目标契约裁决。
