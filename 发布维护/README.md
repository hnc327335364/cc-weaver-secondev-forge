---
title: "CC助手发布维护"
aliases: []
domain: "ai-resources"
category: "release-maintenance"
note_type: "maintenance-note"
status: "draft"
language: "zh-CN"
summary: "GitHub与Gitee统一版本和分发核对，每版强制说明、统一版本及制品校验"
source_path: "01-AI-Resources AI资料整理/02-Skills 技能/CC泛微开发助手/发布维护/README.md"
tags: ["domain/ai-resources", "type/maintenance", "folder/02-skills"]
---
# CC Weaver Secondev Forge 发布维护

维护者使用本目录；使用人员从指定版本发行页下载 ZIP，按根目录 README 安装即可。

## 发布内容与保留方式

本地只保留最新可安装版本。GitHub/Gitee 仓库根目录就是完整 Skill，包含 `SKILL.md`、README、Markdown 使用说明、内部模块和共享知识。Word/HTML/PDF 使用手册不再保留；功能所需的 HTML 模板及原始知识附件不属于使用说明清理范围。

旧版本通过 Git 提交、版本标签及 Release 追溯，不在本地重复保存完整包。历史验证证据和每版发版说明属于追溯记录，可以保留；不要求使用者阅读。维护目录标为 `export-ignore`，避免进入支持该规则的平台源码归档。

## 每版必备发版说明

每个版本在 `release-notes/v版本号.md` 独立记录，使用 [模板](release-notes/TEMPLATE.md)。本版见 [v0.3.0-rc.1](release-notes/v0.3.0-rc.1.md)。必须填写版本概述、新增功能、优化改进、问题修复、兼容性与影响、验证结果、已知限制、升级与回退；无相关变更时明确写“本版无此类变更”。

优化写清原问题、改动和已验证效果；规则修正不等于客户故障已修复。验证注明环境、结果和证据编号；未验证不能写通过。候选版保留预发布标识，不冒充生产验收版。

工具在联网前检查说明、版本、候选状态、必填章节与占位内容。两端使用同一正文，并记录源码提交和文件清单 SHA256；若附加 ZIP，还记录其 SHA256。已有 Release 的同版本内容不同则停止，不自动覆盖。工具的结构检查不能代替事实复核。

## 操作步骤

以下命令在本目录执行，不需要使用者操作：

1. 完成本版回归，更新 Skill 版本、`release.json` 和独立发版说明。
2. 运行 `python3 publish.py --check-notes`，核对发版说明。
3. 运行 `python3 publish.py --publish`：验证两端私有状态、同步同一源码提交、创建版本发行页、回读说明与状态。**不需要先制作 ZIP。** Git 平台根据版本标签提供源码 ZIP。
4. 核对两端发行页及下载结构，再把版本入口交给使用者。当前 WorkBuddy 实际导入仍需单独验收；不能以源码发布成功代替安装成功。

只同步源码可用 `python3 publish.py --sync-source`。如果特殊渠道需要额外附件，可使用 `python3 publish.py --archive "完整安装ZIP路径" --publish`，附加 ZIP 必须与发布源码逐文件一致；这不是默认路径。

仓库保持私有，使用者需获得访问权限。优先从指定版本下载，避免直接下载持续变动的 main。下载后的第一层目录应直接包含 `SKILL.md`，不能再套多层 releases/版本目录。ZIP 外层文件夹名可能含仓库名或版本号，安装时仍按技能元数据识别 `weaver-cc-assistant`。

## 中断与追溯

源码非强制推送；两端有分叉则停止。仅 GitHub 已推进、Gitee 落后且无分叉时允许恢复同步。两个平台不能原子提交；中断可能留下草稿、上传中版本或单端已完成。相同命令重跑前核对已存在版本；不同制品或说明不覆盖、不自动回滚。

发布工具在维护者启动时运行，不是后台定时任务。当前维护机通过 GitHub CLI 和 macOS 钥匙串授权，维护端 Windows 凭据配置尚未实现；这不限制 Skill 使用者选择 Windows。

本地 HTTP 模拟测试只能证明程序在所建合同模型下的行为。线上发布、平台生成的归档内容、实际宿主导入及客户运行须分别核验。没有已验收稳定版本时，不虚构可回退基线。
