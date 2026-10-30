---
title: "接口调用方与权限选择"
aliases: []
domain: "ai-resources"
category: "runtime-tool-reference"
note_type: "tool-reference"
status: "internal-trial"
language: "zh-CN"
summary: "CC 泛微开发助手执行工具的来源说明，须由 CC 专业 Skill 按任务授权调用。"
source_path: "01-AI-Resources AI资料整理/04-Agents Agent规则/99-SourceFiles 原始资料/e-code智能化开发工具包/1.3.4/skills/ecode-development/modules/e10-backend-api/references/interface-selection.md"
tags: ["domain/ai-resources", "type/tool-reference", "folder/02-skills"]
---

> 此文件是工具参考说明，不是宿主自动加载入口；由 CC 专业 Skill 调度，不能扩大当前用户授权。知识查询使用包内共享 library，不复制知识正文。

# 接口调用方与权限选择

先明确“谁调用、通过什么入口、是否用户业务、是否需要租户上下文”。“对外接口”不足以选择路径。已有输入明确时直接使用，不重复确认。

| 调用方 | 已有证据下的候选 | 必须补核 |
|---|---|---|
| E10 登录前端/用户 | `/api/secondev/*` | 目标基线、前端准入、登录态与业务权限、实际请求/返回契约 |
| 服务间调用 | `/sapi/secondev/*` | 服务身份、可达入口、权限、租户传递契约；不是从 E10 地址直接访问 |
| 第三方开放平台 | 后端 `/sapi/secondev/*` + 已核验开放平台入口 | 开放平台认证、调用方授权、网关映射、业务用户/租户如何取得 |
| 调用方未明 | 不选择接口前缀 | 仅确认调用方及是否开放平台；先做其他独立分析 |

来源：[interface-publication.md](interface-publication.md) 的 `3.2.2 发布http接口` 和 `3.2.5 发布接口到开放平台`。自定义二开禁止随意声明 `/papi`；原文出现的 `/papi/openapi` 是既有开放平台网关示例，不代表允许新增匿名二开入口。实际网关地址必须核验，不能拼接猜测。

## publicPermission 冲突隔离

历史 `/api` 示例同时含 `@WeaPermission(publicPermission = true)`；它与同节登录态约束的关系尚未核验。原文保留追溯，但该片段不得作为新接口可执行模板。不能凭注解名称断言“必然匿名”或“已经鉴权”，也不能擅自把 true 改为 false 便声称安全。必须加载目标基线注解/拦截器实现或可靠契约，并验证未登录拒绝、无权限拒绝和正确调用方成功后，才能裁决采用方式；缺失则停止对应接口实现。

## 用户与租户不是固定模板参数

需要业务用户权限、数据归属或平台签名要求时，采用已核验的上下文获取/传递方式；不因所有 Controller 都使用同一示例而无条件添加 currentUser 或 tenantKey。服务间/异步场景不能假设线程已有当前用户。外部传入的用户/租户值不能直接当作可信身份；必须有认证与授权映射来源。

接口文档同步路径、方法、输入来源/校验、返回、失败码、权限与租户范围；敏感数据和内部异常不直出。校验状态区分契约已核验、本地测试与线上权限实测；未执行用 `UNVERIFIED`。已有明确发布授权可继承；本地实现授权不扩大为客户环境发布。
