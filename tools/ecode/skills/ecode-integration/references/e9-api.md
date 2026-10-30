---
title: "E9 读取"
aliases: []
domain: "ai-resources"
category: "runtime-tool-reference"
note_type: "tool-reference"
status: "internal-trial"
language: "zh-CN"
summary: "CC 泛微开发助手执行工具的来源说明，须由 CC 专业 Skill 按任务授权调用。"
source_path: "01-AI-Resources AI资料整理/04-Agents Agent规则/99-SourceFiles 原始资料/e-code智能化开发工具包/1.3.4/skills/ecode-integration/references/e9-api.md"
tags: ["domain/ai-resources", "type/tool-reference", "folder/02-skills"]
---

> 此文件是工具参考说明，不是宿主自动加载入口；由 CC 专业 Skill 调度，不能扩大当前用户授权。知识查询使用包内共享 library，不复制知识正文。

# E9 读取

读取原包 `int-ai-e9-api/scripts/E9Api.java` 后移植为 Node；不携带原连接地址、公钥、secret 或管理员身份。支持分部、部门、岗位、人员四类，不能据此宣称覆盖全部 E9 API。

## 已保留协议

- POST `/api/ec/dev/auth/applytoken`：appid 和经 RSA/PKCS1Padding 加密的 secret 放请求头。
- 业务 POST：请求头 `appid/token/userid`，userid 同样经 RSA 加密；form 字段 `params` 为 JSON。
- 资源路径在 `scripts/clients.mjs` 的 E9_PATHS，沿用原 Java 的 `resful` 拼写，不按语言习惯改成 restful。
- 按 `data.dataList` 和 `data.totalSize` 分页。每页 200，最多 1000 页，总量受 maxRecords 限制；重复 ID、总数变化、缺页均停止。

原 SKILL 的 GET/Authorization 描述与 Java 不一致，本版不保留两套冲突操作说明。目标 E9 版本与这些响应字段仍需确认。

## 配置与调用

填写 e9.origin/baseline/contractEvidence/appId/userId，运行环境提供 publicKeyEnv/secretEnv 对应变量。公钥可为 PEM 或原包使用的 Base64 DER 公钥。密钥不得经聊天或命令参数传递。

```sh
node <本Skill>/scripts/integration.mjs e9 read --config integration.json --resource department --out departments.json
node <本Skill>/scripts/integration.mjs e9 snapshot --config integration.json --out e9-snapshot.json
```

read 的可选 `--filters filters.json` 可传目标 API 已支持的过滤字段；页码/每页数由程序控制。snapshot 读取四类完整有界数据，再按 sync.subcompanyIds 精确分部集合筛选部门、人员及关联岗位/岗位祖先。不默认选任何公司，不隐式扩展全部下级分部。源账号必须具有对应读取权限；即使输出按范围过滤，采集过程仍会读取范围外数据，若权限或数据最小化要求不允许，使用 read + 已核验过滤条件获取所需数据后组装同步快照。

快照字段为 origin、capturedAt、subcompany、department、position、employee；四个资源值为原始记录数组。快照包含姓名、工号等个人信息，需受控保存。
