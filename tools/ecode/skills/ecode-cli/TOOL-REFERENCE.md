---
name: ecode-cli
description: Operate E10 e-code server projects, download or inspect application trees, manage folders/files/source code, and validate or import .ecode packages through a bundled CLI using authentication managed by e10-login-cli.
title: "ECode CLI（E10 e-code 服务端操作）"
aliases: []
domain: "ai-resources"
category: "runtime-tool-reference"
note_type: "tool-reference"
status: "internal-trial"
language: "zh-CN"
summary: "CC 泛微开发助手执行工具的来源说明，须由 CC 专业 Skill 按任务授权调用。"
source_path: "01-AI-Resources AI资料整理/04-Agents Agent规则/99-SourceFiles 原始资料/e-code智能化开发工具包/1.3.4/skills/ecode-cli/SKILL.md"
tags: ["domain/ai-resources", "type/tool-reference", "folder/02-skills"]
---

> 此文件是工具参考说明，不是宿主自动加载入口；由 CC 专业 Skill 调度，不能扩大当前用户授权。知识查询使用包内共享 library，不复制知识正文。

# ECode CLI（E10 e-code 服务端操作）

通过随包 CLI 管理 E10 e-code 服务端项目、应用树、目录、文件和 `.ecode` 包。所有服务端读写必须使用该 CLI；不要自行拼接 HTTP 请求、Cookie 或认证头。

```bash
node <skill-dir>/scripts/ecode-cli.mjs <group> <action> [options]
```

参数、返回字段和导入行为见 [命令参考](references/commands.md)。读取命令可直接执行；创建、更新、上传校验和导入属于服务端写入，须遵守当前授权范围。

## 认证与会话

- 登录、会话验证和租户切换使用 `e10-login-cli`；本 CLI 不接受 Cookie 或 ETEAMSID。
- 登录使用自定义 `--state` 时，本 CLI 必须传完全相同的全局 `--state`。
- POSIX 会话文件要求 `0600`。Windows 按所有者 SID 和受保护 DACL 校验，仅允许当前用户、SYSTEM、Administrators；不得用 POSIX `stat.mode` 判断。
- 旧版 Windows 会话先运行一次 `e10-login-cli current --state <同一文件>` 收紧 ACL，无需重新登录。
- `AUTH_MISSING`、`AUTH_INVALID`、`AUTH_INSECURE`、`AUTH_ACL_UNVERIFIED`、`AUTH_EXPIRED` 均停止当前操作。ACL 无法核验时 fail closed；不得自动重试写入。

## 推荐流程

1. 不清楚 ID 或状态时先执行读取命令。
2. `app download --app-id <id> [--output <父目录>]` 下载应用源码、资源并维护 `build.json`。
3. `file update` 分别提供源码和编译产物。
4. `package check` 会上传 ZIP 校验但不导入；`package import` 会先校验再导入。
5. 导入成功后按 UUID、唯一名称、关键词解析应用；只有精确 UUID 唯一命中才允许回写 `build.json.appId`。
6. 始终报告 warnings。本地成功不代表客户页面或业务运行已验证。

## 写入与安全边界

- 版本冲突不自动重试；先读取服务端现状。
- UUID 匹配导入具有覆盖能力；自动发布和覆盖配置默认关闭。
- 不在 CLI 外增加原始服务端 URL，不绕过缺失的删除、取消发布、复制或重命名能力。
- 存量开发遵守 [存量应用开发闭环](references/existing-app-workflow.md)。用户只授权本地修改或明确不发布时，不执行 `package check` 或 `package import`。
