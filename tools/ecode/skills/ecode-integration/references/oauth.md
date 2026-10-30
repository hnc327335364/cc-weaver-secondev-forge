---
title: "E10 开放平台 OAuth"
aliases: []
domain: "ai-resources"
category: "runtime-tool-reference"
note_type: "tool-reference"
status: "internal-trial"
language: "zh-CN"
summary: "CC 泛微开发助手执行工具的来源说明，须由 CC 专业 Skill 按任务授权调用。"
source_path: "01-AI-Resources AI资料整理/04-Agents Agent规则/99-SourceFiles 原始资料/e-code智能化开发工具包/1.3.4/skills/ecode-integration/references/oauth.md"
tags: ["domain/ai-resources", "type/tool-reference", "folder/02-skills"]
---

> 此文件是工具参考说明，不是宿主自动加载入口；由 CC 专业 Skill 调度，不能扩大当前用户授权。知识查询使用包内共享 library，不复制知识正文。

# E10 开放平台 OAuth

来自原包 `int-ai-oauth/scripts/E10Api.java` 的特定平台协议：GET `/oauth2/authorize` 使用 corpid/response_type=code，再 POST `/oauth2/access_token`，form 参数为 app_key、app_secret、code、grant_type=authorization_code。它不是可替换任意 OAuth/OIDC 提供方的通用客户端。

兼容返回 access_token/accessToken/acessToken；业务调用在 JSON body 加 access_token。只在当前进程内缓存，按 expires_in 提前 300 秒失效，退出即清除；不再生成 `.token_cache.json` 或提供裸 Token 查看命令。

```sh
node <本Skill>/scripts/integration.mjs oauth check --config integration.json
node <本Skill>/scripts/integration.mjs oauth check --config integration.json --refresh
```

配置 e10 的 origin、baseline、contractEvidence、appKey、corpId、appSecretEnv 和 auth=oauth。输出认证状态与有效期，不输出 Token。该认证供同步 API 调用，独立于 e10-login-cli 的 ETEAMSID；HR Bearer 是否接受同一种令牌没有证据时不得共用。

每个 CLI 调用是新进程，会重新认证；长时间同步在同进程内复用/刷新。这是避免新增持久秘密存储的明确取舍。
