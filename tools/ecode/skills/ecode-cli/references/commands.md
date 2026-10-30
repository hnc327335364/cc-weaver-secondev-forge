---
title: "命令参考 / Command reference"
aliases: []
domain: "ai-resources"
category: "runtime-tool-reference"
note_type: "tool-reference"
status: "internal-trial"
language: "zh-CN"
summary: "CC 泛微开发助手执行工具的来源说明，须由 CC 专业 Skill 按任务授权调用。"
source_path: "01-AI-Resources AI资料整理/04-Agents Agent规则/99-SourceFiles 原始资料/e-code智能化开发工具包/1.3.4/skills/ecode-cli/references/commands.md"
tags: ["domain/ai-resources", "type/tool-reference", "folder/02-skills"]
---

> 此文件是工具参考说明，不是宿主自动加载入口；由 CC 专业 Skill 调度，不能扩大当前用户授权。知识查询使用包内共享 library，不复制知识正文。

# 命令参考 / Command reference

本参考只说明随包 `ecode-cli` 的服务端操作命令。登录、会话和租户切换请使用 `e10-login-cli`；不要通过参数传入密码、Cookie 或 ETEAMSID。

Set `CLI="node <skill-dir>/scripts/ecode-cli.mjs"`. Global `--state <session-file>` may appear before command group.

Authentication is external. Use `e10-login-cli` for login and tenant session management. This CLI reads its Cookie jar and origin from `.weaver-cc-assistant/sessions/default.json` under the current user's home directory, outside this package; when login used a custom `--state`, pass the same package-external path here. Never pass credentials or Cookie on the command line.

## 读取 / Read

`system version` 查询当前登录环境 E10 基线，调用 `GET /api/security/license/getVersion`。支持 `data` 为 JSON 字符串或对象；返回 `data.version` 与 `data.versionShowSwitch`。缺失或无效版本返回 `INVALID_RESPONSE`，不推测默认版本。复用同一 `--state` 会话。

```bash
$CLI system version
$CLI project list [--name <text>] [--app-name <text>] [--app-id <id>] [--system-project <true|false>]
$CLI tree list --parent-id <id>
$CLI app download --app-id <id> [--output <parent-directory>]
$CLI file get --id <id> [--source-out <path>] [--compiled-out <path>]
$CLI package check --file <package.zip> --project-id <id>
```

`project list` 会加载全部结果页。`file get` 仅返回元数据，解码后的内容只写入显式指定的新输出文件；已有文件一律拒绝覆盖。`package check` 会上传 ZIP 进行服务端校验但不会导入；输出包含应用摘要和覆盖冲突，不包含导入传输句柄。

`project list --app-id <id> --system-project false` 和 `--system-project true` 分别查询当前租户非系统/系统项目。`app download` 固定按此顺序自动查询两次；只有唯一项目命中才读取项目树，并按 appId 精确取得线上应用信息。未命中或多项目命中均停止，禁止猜测。

`app download` 把 `--output` 解释为父目录，在其下使用**线上应用名称**新建应用文件夹；同名目录已存在时停止，不刷新或覆盖已有工程。未传父目录时使用当前目录。需要重新下载时指定另一个受控父目录，再比较差异。它递归读取应用树，只保存服务端源码，**绝不写入** `compiledContent` 或 `.compiled` 文件。遇到系统 `resources` 目录时创建同名本地目录，读取 `tree.list` 返回的 `resources[]`，再通过 `/api/ecode/resource/view/{appId}/{name}` 下载原始二进制内容；图片、字体、压缩包和 JS 均不得按文本转码。下载在新建工程内生成 `<父目录>/<线上应用名称>/build.json`：`codes` 记录代码文件的 `id`、`sourceId`、`state`、`compress`，`resources` 记录资源文件的 `id`、`fileId`、`extension`。配置目录状态固定设置为：`config.js`、`config_default.js` 为 `"y"`（前置加载）；`configLoad.js`、`configLoad_default.js` 为 `"n"`（非前置加载）。不在本命令中删除已有本地文件。

## 创建与更新 / Create and update

```bash
$CLI app create --project-id <id> --name <name> [--project-type react] [--vue] [--theme]
$CLI folder create --parent-id <id> --name <name>
$CLI file create --parent-id <id> --name <name> --type <js|css|md|func|cron|ts>
$CLI file update --id <id> --source-file <path> --compiled-file <path>
```

`file update` 会先读取最新版本。遇到冲突时停止并展示当前服务端状态，禁止静默重试。

## 导入 / Import

```bash
$CLI package import --file <package.zip> --project-id <id> \
  [--auto-publish] [--cover-config] [--relevance-config-file <json>] \
  [--build-json <path>]
```

默认行为：导入全部应用、覆盖 UUID 匹配的应用、不自动发布、不覆盖配置、不强制沿用旧 ID。

导入成功后，CLI 查询目标项目树并返回每个应用的新 `appId` 和 `pageUrl`（`<E10 origin>/ecode/main/item/<new appId>`）。解析顺序为精确 UUID、唯一精确名称、关键词；无法解析或结果歧义时输出告警和空 URL，禁止用包内旧 ID 生成页面链接。将非空 `pageUrl` 作为可点击链接反馈给用户。

传入 `--build-json <path>` 时，CLI 只会在该文件的 `appUUID` 对应**唯一一个**导入应用、且该应用由精确 UUID 匹配解析出正整数 `appId` 后，将 `appId` 回写该 JSON 文件。名称或关键词匹配不回写；UUID 未解析、歧义、缺失或文件无法写入时，导入仍成功但输出 `BUILD_JSON_APP_ID_NOT_UPDATED` 告警，原文件不变。

## 输出与退出码 / Output

Success:

```json
{"ok":true,"command":"file.update","data":{},"warnings":[]}
```

Failure:

```json
{"ok":false,"command":"file.update","error":{"type":"VERSION_CONFLICT","message":"...","code":"..."}}
```

退出码：`2` 输入错误、`3` 认证错误、`4` 网络错误、`5` HTTP 错误、`6` 服务端业务错误、`7` 版本冲突、`8` 本地文件错误、`9` 加密错误。
