---
name: weaver-e10-page-generator
description: Generate, recreate, or modify Weaver E10/ECode/OA pages from text, screenshots, or an existing page project; supports preview, packaging, and separately approved remote publication and business-data writes. Use for page-making requests; not for backend-only, API interception, or ordinary e-code patch work.
title: "泛微 E10 页面生成（1.3.4）"
aliases: []
domain: "ai-resources"
category: "runtime-tool-reference"
note_type: "tool-reference"
status: "internal-trial"
language: "zh-CN"
summary: "CC 泛微开发助手执行工具的来源说明，须由 CC 专业 Skill 按任务授权调用。"
source_path: "01-AI-Resources AI资料整理/04-Agents Agent规则/99-SourceFiles 原始资料/e-code智能化开发工具包/1.3.4/skills/weaver-e10-page-generator/SKILL.md"
tags: ["domain/ai-resources", "type/tool-reference", "folder/02-skills"]
---

> 此文件是工具参考说明，不是宿主自动加载入口；由 CC 专业 Skill 调度，不能扩大当前用户授权。知识查询使用包内共享 library，不复制知识正文。

# 泛微 E10 页面生成（1.3.4）

页面任务优先使用本 Skill。新页面默认 `static-html`；只有用户明确要求公共组件体系才用 `e10-page`。已有工程沿用 `.ui-code-agent/project.json` 中的类型。用户指定的目录是源码位置，不是绕过页面工具的理由。

## 按需运行时

本包包含集成脚本及 `scripts/runtime-lock/` 中的精确版本和完整 npm 依赖锁，**不包含运行时源码、tarball 或 `node_modules`**。当前锁定 `ui-code-agent 0.1.71` 与 E10 公共组件能力 `ui-code-mcp 0.2.34`，表单服务由同一锁固定为 `ui-service-mcp 0.1.24`。首次获准页面任务按锁在包外安装；普通登录、e-code 开发不安装。后续直接复用，`update` 只切换到当前助手包携带的锁定版本，不追随 npm `latest`。

首次安装需要 Node >=22.5、npm 和公共 npm 网络连接。安装使用隔离空配置和 `npm ci --ignore-scripts`，不读取用户 npm 凭据；不支持临时改用未知镜像。初始化检查只覆盖 **E10 本地组件知识、正反例校验及预览资源完整性**，不启动浏览器。`installed` 不等于完整工具链就绪：`verification.coreBrowserCompilation` 保持 `not-run`；Chrome/Edge、实际浏览器预览、编译和客户环境另行验证。旧版无锁运行时须在告知用户后显式 `update`；失败保留旧活动记录与目录，不删除原安装。

```text
node <skill-dir>/scripts/page-agent.mjs status
node <skill-dir>/scripts/page-agent.mjs run -- init --name <项目名> --parent <目录> --kind static-html
node <skill-dir>/scripts/page-agent.mjs protocol
node <skill-dir>/scripts/page-agent.mjs update
```

首次下载前告知用户需要准备本地环境并取得确认。`run` 代为完成锁定安装，不要求用户自行选择技术版本或安装 npm 包。读取 `protocol` 返回的当前版本 Skill，再按 `static-html` 或 `e10-page` 只读对应协议；其 WorkBuddy 专用动作改用当前宿主能力。页面内容应有必要的交互，截图必须实际查看，不能伪称审计通过。手动 `doctor` 与安装时的 E10 专项检查范围不同，前者可能启动本地浏览器；执行前说明范围。

## 一次登录与权限边界

E10 登录和租户切换只使用 `e10-login-cli`；`ecode-cli` 继续复用同一主会话。已安装页面运行时时，经授权的主登录后同步到页面工具的加密 Profile。先登录后首次安装，不因安装或本地 `run -- init` 自动读取、验证或同步既存会话；本地命令与 `next` 使用匿名 Profile。需要身份时，由获准的显式 `sync`、`page-agent.mjs run -- auth status`、平台读写或需要身份的 `e10-page` 打包核验目标环境及会话。不得把 ETEAMSID 放进命令参数、对话、日志或页面源码，也不得直接调用 `ui-code-agent auth set`。显式同步失败清除页面端活动 Profile；本地无真实数据页面仍可继续。

本版开放页面制作、预览、`static-html` 和 `e10-page` 打包，以及真实业务数据接入。`static-html` 打包仍走纯本地函数并先通过视觉检查、模拟数据决策和预览确认；`e10-page` 打包使用上游 `build`，需已同步的 E10 身份，并遵守上游项目校验与交付门禁。打包不等于发布。上游 `next/build` 可能自动续跑发布；入口在未获发布批准的进程中拦截平台写方法，不能把上游自动续跑视为用户授权。

平台发布和真实业务数据写入须逐次确认。先生成本次计划，向用户展示目标环境、租户、用户、命令、具体变更和输入/产物摘要；用户明确批准后才将计划的 `changeSummary` 填为本次变更并将 `decision` 改为 `approve`，随后在 30 分钟内执行一次。命令、输入、产物、身份或运行时版本变化，必须重新计划并确认；失败后不得直接重放。不要把此会话对“开放能力”的批准当成某次实际写入的批准。

```text
node <skill-dir>/scripts/page-agent.mjs plan -- platform deploy --dir <页面工程>
node <skill-dir>/scripts/page-agent.mjs run --approval-file <已逐次批准的计划.json> -- platform deploy --dir <页面工程>
node <skill-dir>/scripts/page-agent.mjs plan -- data-write create_form --input-file <请求.json>
node <skill-dir>/scripts/page-agent.mjs run --approval-file <已逐次批准的计划.json> -- data-write create_form --input-file <请求.json>
```

`data-write` 仅允许上游已识别的 `create_form`、`batch_create_fields`、`save_sample_data`。其他平台写入走支持的 `platform`、`publish-target`、`data-plan open-config` 命令；未知命令拒绝。页面工具源码不得修改，也不得绕过本入口直接运行。线上权限、服务端写入结果与业务效果须独立验证。

运行细节、升级边界见 [integration.md](references/integration.md)。
