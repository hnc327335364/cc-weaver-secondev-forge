---
title: "E9 列表取数与导出约定"
aliases: []
domain: "ai-resources"
category: "skill-reference"
note_type: "reference-note"
status: "internal-trial"
language: "zh-CN"
summary: "E9 列表取数与导出约定"
source_path: "references/e9-list-export.md"
tags: ["domain/ai-resources", "type/reference", "folder/02-skills"]
confidence: "medium"
source_docs: ["library/catalog.sqlite", "CC泛微开发助手实际使用复盘-2026-10-30"]
---
# E9 列表取数与导出

仅在列表查询、筛选、分页、选中项或导出任务加载。先识别实际组件：建模 ModeList、WeaTable/业务组件、自定义列表的取数方式不同，不能提供一套通用的“取全部数据”函数。

## 先看决定取数的证据

读当前列表代码或一份脱敏请求/响应，确认用户说的是当前页、选中记录还是筛选后的全部记录；已有材料明确时不再问。核对查询入口、参数编码和返回结构、默认过滤、排序、分页以及服务端数据权限。

`ModeList.getHighSearchDatas()`、`getTopSearchDatas()` 在随包《E9表单建模前端接口API》中有文档，但提供的是查询条件。它们不代表列表结果集合，也没有证明自建 SQL 会复现快速查询、复杂条件、明细过滤及权限。实际补丁版本与可用方法仍需在项目核对。

优先复用已验证的列表服务或项目已有导出链路。必须自行取数时，先证明同一用户、同一查询状态的记录范围一致；不要因会写 SQL 就另造查询解释器。查不到真实入口时，指出只缺哪段调用或响应；其余文件生成逻辑可独立完成，但不能报告端到端已完成。

## 实现时保留语义

- 筛选函数不存在、抛错或响应无法解析是失败；与用户明确清空筛选不同。不得 catch 后返回 `{}` 并继续全量导出。
- 不支持的查询条件不能忽略或扩大匹配字段。空结果返回正常的无数据结果，不构造 `IN ()`，也不回写标记。
- JSON 请求体、表单参数、URL 参数须与接收端一致；确认用户身份与权限沿实际查询链传递。前端隐藏数据不替代服务端权限。
- 全量分页必须确认终止条件、稳定排序和去重；需要严格快照一致性时核对平台支持，不能把变化中的多页合并称为同一时刻快照。
- 若有导出标记，明确它代表文件生成、响应发出还是业务确认；不能从 HTTP 响应推断用户已保存文件。报告生成和回写各自结果，部分失败不得一律报成功；重复操作的处理按已确认业务约定实现。

## 针对性验证

比较预期列表 ID 与导出 ID 的集合，并检查重复和用户要求的顺序。覆盖本次受影响的正常筛选、空结果、读取条件失败、复杂条件、权限差异和跨页；带回写时验证失败与重复行为。仅有样例响应时写“样例验证”，没有现场条件时提供具体待验项，不编造验收。

## 随包来源定位

```text
python "<Skill根>/scripts/knowledge_lookup.py" topic e9-list-export
python "<Skill根>/scripts/library_reader.py" locate doc-c67a80895c59b33a729afbc9 getHighSearchDatas --context 6
```

来源为共享库中的《E9表单建模前端接口API》《WeaTable组件开发专题》，以及 2026-10-30 使用记录复盘形成的边界整理。前两份是方法参考，复盘是失败模式证据；均不是任意客户环境的可运行保证。不随包复制客户会话或客户代码。
