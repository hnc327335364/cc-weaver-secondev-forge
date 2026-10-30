---
title: "存量应用下载、开发、验证与导入"
aliases: []
domain: "ai-resources"
category: "runtime-tool-reference"
note_type: "tool-reference"
status: "internal-trial"
language: "zh-CN"
summary: "CC 泛微开发助手执行工具的来源说明，须由 CC 专业 Skill 按任务授权调用。"
source_path: "01-AI-Resources AI资料整理/04-Agents Agent规则/99-SourceFiles 原始资料/e-code智能化开发工具包/1.3.4/skills/ecode-cli/references/existing-app-workflow.md"
tags: ["domain/ai-resources", "type/tool-reference", "folder/02-skills"]
---

> 此文件是工具参考说明，不是宿主自动加载入口；由 CC 专业 Skill 调度，不能扩大当前用户授权。知识查询使用包内共享 library，不复制知识正文。

# 存量应用下载、开发、验证与导入

实际命令/参数以 [commands.md](commands.md) 和随包 `--help` 为准。只使用随包 ecode-cli；登录与会话仍由 `skills/e10-login-cli/TOOL-REFERENCE.md` 管理，不读出或复制认证文件内容。

1. 确认目标环境、应用 ID、线上名称、已有本地目录和用户授权范围。读取可以直接执行；已明确授权的同目标/范围开发和导入不反复确认。用户明确“不发布”时保留此约束。
2. 下载前检查目标目录的用户改动。已有目录包含修改时下载到隔离父目录，用路径/内容差异比较后应用最小变更；不盲目覆盖、删除或强行清理本地文件。
3. 使用 `app download --app-id <id> --output <父目录>`。线上应用名决定目录；只保存源码及 resources 二进制资源，维护 build.json，不保存 compiledContent 或 .compiled。不得另外拼 HTTP 请求或递归下载脚本。
4. 保存来源环境、appId、appUUID、下载时间和比较依据。检查工程与基线后开发；沿用存量 class/store/入口，按前端工具 compile，要求产物时再 build。应用标识只生成一次；不能在每次构建重置 UUID。
5. 记录实际本地编译/测试结果、变更文件与 ZIP。`package check` 会上传校验包，即使不导入也属于联网上传；用户只授权本地修改或明确不发布时不执行。`package import` 会再次校验；调用参数以命令参考为准。
6. 需要导入时，确认已有授权包含环境、应用和覆盖范围，再执行既有 CLI。匹配 appUUID 可能覆盖已有应用，事先说明影响；范围未变且已获授权不反复确认。版本冲突先读取现状，不盲目重试。
7. CLI 退出码非 0 或 ok:false 视为失败。网络/认证导致结果不确定时，先读取服务端状态识别上次结果，再决定是否需要后续写入；不得把失败响应直接当未写入而重复导入。新范围或新的破坏性影响需单独授权。
8. 需要回写 build.json.appId 时传 CLI 的 `--build-json`；仅精确 appUUID 唯一命中正整数 appId 才能回写。名称、关键词、歧义解析不回写，保留原文件并报告 BUILD_JSON_APP_ID_NOT_UPDATED。始终呈现 warnings；导入成功与链接/回写成功分别报告。
9. 返回 CLI 实际解析的 pageUrl，不用包内旧 ID 手拼链接。验证目标页面、非目标隔离、权限/租户与实际业务；导入成功并不等于 UI 或业务已验证。

本地修改、编译、打包、上传校验、导入、标识回写、UI 和线上业务验证分别记录 PASS/FAIL/N/A/UNVERIFIED。不新增 CLI 命令、不绕过其缺失的删除/取消发布能力、不自动开启覆盖配置。

用户提到“发布”、询问发布方式或要求发布方案，不等于已授权执行上传/导入。只有明确执行请求或已批准且包含对应环境、目标和影响范围的方案才构成写入授权；同范围已有明确授权持续有效。
