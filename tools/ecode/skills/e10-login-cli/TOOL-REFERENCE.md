---
name: e10-login-cli
description: Log in to a user-specified E10 environment, reuse its authenticated session, list or switch tenants, inspect current tenant, and call authenticated same-origin APIs through bundled Node.js CLI.
title: "E10 登录会话 CLI"
aliases: []
domain: "ai-resources"
category: "runtime-tool-reference"
note_type: "tool-reference"
status: "internal-trial"
language: "zh-CN"
summary: "CC 泛微开发助手执行工具的来源说明，须由 CC 专业 Skill 按任务授权调用。"
source_path: "01-AI-Resources AI资料整理/04-Agents Agent规则/99-SourceFiles 原始资料/e-code智能化开发工具包/1.3.4/skills/e10-login-cli/SKILL.md"
tags: ["domain/ai-resources", "type/tool-reference", "folder/02-skills"]
---

> 此文件是工具参考说明，不是宿主自动加载入口；由 CC 专业 Skill 调度，不能扩大当前用户授权。知识查询使用包内共享 library，不复制知识正文。

# E10 登录会话 CLI

## 中文说明

本 Skill 负责 E10 环境登录、复用已认证会话、查看或切换租户，以及调用同源 API。它只管理认证和租户，不执行 e-code 项目、文件或包操作；后者使用 `ecode-cli` Skill。

运行环境要求 Node.js 18+，支持 macOS、Linux 和 Windows，无需额外安装依赖。

## 运行方式

Run on macOS/Linux:

```sh
<skill-dir>/scripts/e10-login-cli <command> [options]
```

Run on Windows:

```bat
<skill-dir>\scripts\e10-login-cli.cmd <command> [options]
```

两个启动器会把参数原样传给 `e10-login-cli.mjs`。Windows 使用 `.cmd` 启动器。

## 推荐流程

1. 首次登录：获取环境 URL 和账号，交互式输入密码时保持隐藏。
2. 非交互式场景：使用 `login --password-stdin` 从标准输入读取密码；密码绝不能出现在命令参数中。
3. 使用 `tenants` 列出租户，`current` 查看当前租户，`switch` 按精确名称或 `tenantKey` 切换；`request` 只允许同源路径。
4. 成功 JSON 从 stdout 读取，失败 JSON 从 stderr 读取；退出码 `0` 表示成功，`1` 表示失败。

## 命令说明

```text
<cli> login --url <url> --account <account> [--tenant <exact-name-or-key>]
            [--password-stdin] [--state <path>] [--insecure]
<cli> tenants [--state <path>]
<cli> current [--state <path>]
<cli> switch <exact-name-or-key> [--state <path>]
<cli> request <same-origin-path> [--method <method>] [--data <json>] [--state <path>]
```

## 安全边界

### 1.3.3 页面工具会话同步

页面运行时已安装时，经授权的 login/switch 成功后通过 CLI 内部受控桥验证并同步有效同源 ETEAMSID；结果包含 pageAgent.status。凭据不经过 argv/stdout，Agent 不读取保存的会话文件。未安装返回 not-installed，不因同步桥安装运行时；sync-failed 不撤销主登录，但页面端不能继续真实请求。安装完成后，只有在已获准访问对应客户环境时才显式调用页面入口 sync，不需重新输入密码；首次本地 run 不会自动读取或同步历史会话。传了 --state 时页面入口也使用同一路径。开放平台 OAuth 与此网页会话无关。

以下“不得复制/读取会话”约束针对 Agent 与非受控脚本；本版明确授权的 CLI 内部会话同步属于认证组件本身，仍必须校验同源、Cookie 有效期、用户和租户，不输出凭据。

主会话写入使用 `<state>.lock`；页面验证后保存比较读取快照，有新登录/切租户则拒绝旧会话覆盖并要求重试。锁忙最多等待 15 秒；遗留锁须核查进程后人工处理，不盲删。

- 不得查看、打印、复制、编辑或提交已保存的会话文件、Cookie、ETEAMSID、密码、RSA 材料或票据。
- 同源校验是最终限制；不要在 CLI 外重建或转发认证头。
- `--insecure` 仅可在用户明确批准后使用。
- 租户必须精确匹配；重名租户必须指定 `tenantKey`。
- POSIX 会话文件固定为 `0600`。Windows 使用当前用户所有者 SID 和受保护 DACL，仅允许当前用户、SYSTEM、Administrators；不使用 `stat.mode` 的 POSIX 组/其他用户位。旧版 Windows 会话执行一次 `current --state <同一文件>` 即可收紧 ACL，无需重新登录；ACL 无法核验时 fail closed。

### HTTP 传输警告

已确认需保留旧版 `http://` 登录兼容性。但 HTTP 会明文传输认证数据，可能被中间人截获或篡改；环境支持时必须优先使用 HTTPS。
