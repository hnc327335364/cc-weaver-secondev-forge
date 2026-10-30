---
title: "数据查询选择与版本卡"
aliases: []
domain: "ai-resources"
category: "runtime-tool-reference"
note_type: "tool-reference"
status: "internal-trial"
language: "zh-CN"
summary: "CC 泛微开发助手执行工具的来源说明，须由 CC 专业 Skill 按任务授权调用。"
source_path: "01-AI-Resources AI资料整理/04-Agents Agent规则/99-SourceFiles 原始资料/e-code智能化开发工具包/1.3.4/skills/ecode-development/modules/e10-backend-db/references/query-selection.md"
tags: ["domain/ai-resources", "type/tool-reference", "folder/02-skills"]
---

> 此文件是工具参考说明，不是宿主自动加载入口；由 CC 专业 Skill 调度，不能扩大当前用户授权。知识查询使用包内共享 library，不复制知识正文。

# 数据查询选择与版本卡

## 先选查询意图

1. 记录业务对象、调用方、读取/写入、权限/租户范围、目标 E10 完整基线与来源。仅分析可暂缺基线；选择具体 API 或生成平台业务代码前必须核验。
2. 优先标准业务 API 或现有已验证服务。按业务模块 search-api→load 契约，确认字段、过滤、分页、权限和适用版本；不因查询请求直接创建 DAO/Mapper。
3. 标准能力不足且确需平台数据源查询时，检索 DataSetService、`dataSetService.executeSql`、ExecuteSqlEntity 或已有封装。符号命中只作候选，继续 load 真实章节/代码和依赖。不能从实例变量名推定导入包或注入方式。
4. 确需 SQL 时，必须经过 `skills/e10-data-dictionary/SKILL.md` 的 search→load columns，验证全部表、字段、关联与排序。禁止 MyBatis 直连平台库或自行降级 JDBC；未经核验的 HTTP/RPC 也不是退路。

## 版本卡：原文命名原样保留

证据文件：[database.md](database.md)，下列章节各自独立；不要拼接成一个跨版本可用方法。

| 原文版本/章节 | 可得结论 | 不能据此推定 |
|---|---|---|
| `241201基线及以前` / 获取groupId、执行sql | 示例使用 dataSetService.getDataGroups、executeSql(ExecuteSqlEntity)，groupId 与 SourceType 对应数据源 | 不能仅凭固定 SQL 示例假定支持外部值绑定，也不能猜 DataSetService 的包名/签名/版本依赖 |
| `250101基线--250401基线` | 原文进入数据源服务接口及参数示例 | 不能回填到更旧基线，不能省略调用方/权限/结果契约核验 |
| `1201基线及以上支持的LOGIC与EXTERNAL统一接口，1101基线及以下不支持` | 原文给出了版本边界与聚合接口候选 | 1201/1101 缺年份，不自动转换为完整 E10 基线；须目标依赖或明确版本资料裁决 |
| `250501基线提供二开执行sql工具类` | 原文提供 SecondevDataSetUtil 封装候选；按目标依赖核验其真实方法与参数绑定 | 不把该工具类用于未证明兼容的旧版本，也不据简称猜完整基线 |
| `公共数据库表操作` 中 `24.1101` | 原文标注公共库占位能力的起点 | 不把此能力当作所有查询方式的统一版本门槛；库名与表字段仍须核验 |

若目标为 `10.2024.1001` 等完整旧基线，先将目标与原文章节版本作有来源的匹配；缺映射记录时停止具体实现。不能因为数值小于某个简称就自动裁定兼容。

## 安全参数与依赖

外部值必须使用目标版本实际支持的预编译/参数绑定。Base64 只是编码，不是 SQL 注入防护。固定 SQL 历史示例不证明绑定方式；禁止虚构 setParams、参数数组或把新版本绑定方法移植到旧版本。若原文/项目依赖无法证明安全绑定，则优先回到标准业务 API；仍无证据，停止含外部输入的 SQL 实现。

数据源/groupId/SourceType 必须有实际来源，不在生产环境穷举试探；动态标识使用已核验白名单。写入、事务、超时、分页上限、失败返回和敏感日志分别核验。版本、表字段、API/绑定、依赖、执行权限任一关键项缺失，记录具体阻塞项；不得“先写可配置代码”。

交付记录应列出基线来源、采用标准业务 API 或数据源方案的理由、加载原文章节、实际依赖/签名、字典记录、实测命令及未验证项。本地编译不代表客户数据库执行通过。
