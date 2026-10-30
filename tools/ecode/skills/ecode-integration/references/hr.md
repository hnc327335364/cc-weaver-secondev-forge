---
title: "HR 集成管理"
aliases: []
domain: "ai-resources"
category: "runtime-tool-reference"
note_type: "tool-reference"
status: "internal-trial"
language: "zh-CN"
summary: "CC 泛微开发助手执行工具的来源说明，须由 CC 专业 Skill 按任务授权调用。"
source_path: "01-AI-Resources AI资料整理/04-Agents Agent规则/99-SourceFiles 原始资料/e-code智能化开发工具包/1.3.4/skills/ecode-integration/references/hr.md"
tags: ["domain/ai-resources", "type/tool-reference", "folder/02-skills"]
---

> 此文件是工具参考说明，不是宿主自动加载入口；由 CC 专业 Skill 调度，不能扩大当前用户授权。知识查询使用包内共享 library，不复制知识正文。

# HR 集成管理

原包 int-ai-hr-apis 合并为本模块。按需查 [API 目录与示例](hr/api-guide.md)、[详细接口](hr/api-details.md)、[实体字段](hr/entity-classes.md)、[集成类型](hr/integration-types.md)。原文覆盖 17 类主题，本版 catalog 收录其中明确方法和路径的 69 个操作；实时回调和 SAPI 任务只有基路径，未虚构执行方法。

```sh
node <本Skill>/scripts/integration.mjs hr list
node <本Skill>/scripts/integration.mjs hr call --config integration.json --operation HrSyncLog.getList --payload hr-query.json
node <本Skill>/scripts/integration.mjs hr call --config integration.json --operation HrBaseSetting.resetSchedule --payload hr-reset.json --allow-write --journal hr-audit.jsonl
```

读取日志 payload 示例：`{"body":{"page":1,"pageSize":20,"baseId":123}}`。resetSchedule payload 示例：`{"params":{"id":"123"}}`。params 替换路径变量，其余字段转查询参数；GET 不接受 body，秘密不得放查询参数。

hr.operations 对当前调用 ID 配置真实契约/权限证据字符串，例如 `{"HrSyncLog.getList":"目标版本接口文档位置及校验记录"}`。示例这句话本身不构成证据。HTTP 方法与路径不能任意传入，只能选择目录中的 operation。

认证按目标契约选择：
- `auth=session`：同包 e10-login-cli 管理登录和租户；可配置 hr.statePath；传输前强制核对 hr.origin。身份切换仍从主 CLI 操作，不另建登录流程。
- `auth=bearer`：用 hr.tokenEnv 指定的环境变量，仅发往 hr.origin。不从 ETEAMSID 推导 Token，不自动使用 OAuth Token。

getList、getFormData、getLogDetail 等按读取；保存、删除、执行、重试、resetSchedule、unLock、stop、连通性测试和类加载检查按有副作用处理。少数名字含“检查”的接口也可能执行任务，目录采用保守分类；不得仅凭 GET 判断只读。

写请求须有当前用户范围授权，再加 allow-write 和审计文件；不重复要求已有同范围授权。响应输出会去除 token/secret 等字段。`transportOk=true` 仅代表收到 HTTP JSON 响应，businessResultVerified=false，必须根据目标业务响应契约检查结果；不把 HTTP 200 当保存/同步成功。

目录是原包资料提取物，非官方已验收声明。来源摘要见 [source-manifest.json](hr/source-manifest.json)。本版不捆绑原 Spring RestTemplate 客户端，统一通过 Node 与主登录能力调用。
