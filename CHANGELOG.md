---
title: "CC Weaver Secondev Forge 版本变更"
aliases: []
domain: "ai-resources"
category: "release-notes"
note_type: "release-record"
status: "internal-trial"
language: "zh-CN"
summary: "各版本新增、优化、修复与验证边界"
source_path: "CHANGELOG.md"
tags: ["domain/ai-resources", "type/release", "folder/02-skills"]
---
# 版本变更

当前使用版本：**v0.3.0-rc.3**。完整版本说明同步发布在 [GitHub Releases](https://github.com/hnc327335364/cc-weaver-secondev-forge/releases) 与 [Gitee 发行页](https://gitee.com/hou_nachuan/cc-weaver-secondev-forge/releases)。`rc` 表示内部候选版。

## v0.3.0-rc.3 · 2026-10-30

**新增**：根目录版本变更记录；首页提供发行页、安装与手册入口。

**优化**：README 按能力介绍、获取安装、使用示例与验证边界重新组织；私有访问与下载步骤更加明确。

**修复**：最新仓库不再包含发布维护目录、发布授权脚本或维护机配置；发布流程在复制前拒绝这些材料进入分发目录。

**兼容性**：安装标识仍为 `weaver-cc-assistant`。专业模块、知识正文和原有运行工具保持原样。使用说明仍只维护 Markdown。

**验证**：18 项本地回归通过；32,796 个知识、工具、模块及运行脚本文件与此前基线逐文件一致。

**验证边界**：本版聚焦文档与分发结构。原有宿主、客户接口及生产环境待验事项没有因文档调整而自动关闭；下载完整性与客户端实际导入分别验证。

## v0.3.0-rc.2 · 2026-10-30

**修复**：发布仓库禁用换行转换；增加逐文件 Git 暂存对象检查，防止原始字节被改变。

**验证**：两端发布相同提交；从平台实际下载的归档，各 32,863 个文件均与本地源码逐文件一致。这个结论针对 rc.2 归档，不代表 WorkBuddy 内的实际导入与客户业务验收。

## v0.3.0-rc.1 · 2026-10-30 · 已撤回

**新增与优化**：简单任务分流、需求事实边界、E9 列表导出取数约束、精确检索和正式交付模块；使用说明统一为 Markdown。

**撤回原因**：发布阶段继承本机 Git 换行转换设置，导致部分资料文件与随包校验值不一致。请勿安装该版本，使用后续版本。

## 版本使用原则

按版本页获取完整源码 ZIP；升级前保留接收方的个性化配置。历史版本在远端标签与发行记录中保留，维护端本地只保留最新可安装版本。回退应选择经过本项目验证的版本；目前没有全面验收的稳定版基线。
