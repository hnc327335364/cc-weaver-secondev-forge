---
title: "后端模板来源与参数"
aliases: []
domain: "ai-resources"
category: "runtime-tool-reference"
note_type: "tool-reference"
status: "internal-trial"
language: "zh-CN"
summary: "CC 泛微开发助手执行工具的来源说明，须由 CC 专业 Skill 按任务授权调用。"
source_path: "01-AI-Resources AI资料整理/04-Agents Agent规则/99-SourceFiles 原始资料/e-code智能化开发工具包/1.3.4/skills/ecode-development/modules/backend-project-init/references/project-template.md"
tags: ["domain/ai-resources", "type/tool-reference", "folder/02-skills"]
---

> 此文件是工具参考说明，不是宿主自动加载入口；由 CC 专业 Skill 调度，不能扩大当前用户授权。知识查询使用包内共享 library，不复制知识正文。

# 后端模板来源与参数

原始规范：仓库历史 `779ee788^:.ecode/docs/specs/init-spec-full.md` 第四节；发布源码留存 `scripts/ecode-dev-tools-1.3.2/evidence/original-init-spec.md`。历史文档用于来源追溯，其中“未知版本下载最新”已被当前显式基线规则替代。

模板来源为内部地址，不随分发包保留。CC 仅使用下列固定摘要快照，不开放远程模板下载。

包内 `assets/secondev-demo.zip` 是既有本机下载缓存的固定快照，SHA-256：`b49bd903227ca7411c0e9227cc23b4cfd8c930bb8e1fbe375019a13ba5c6b877`。2026-09-15 对远程模板连接超时，未声称快照等同远端最新内容。

默认 `init` 使用快照，解压时定位唯一模板根目录，再直接落入目标工程，不增加一层 `secondev-demo/`。保留模板根构建脚本、Wrapper、BuildArchPlugin、资源清单打包逻辑。根名按目标目录生成；仅复制指定的模块，不复制两个示例模块。完整初始化同时导入 `lib.zip` 与 `classes.zip`；`--skeleton-only` 才只建模板骨架。

- `--template-file <zip>`：从本地读取同摘要模板。
- `--template-url`：CC 入口禁用；模板更新须由维护人员审核后发布，不从历史内网地址下载。
- 不通过 `ecode-cli app download` 替代 Gradle 根模板。

在线依赖仅从用户指定的 E10 运维平台获取，要求明确 E10 基线，但不设最低基线门槛；不按基线映射旧内网地址。登录 `/cp/logindo.json` 获取短期 token，`/cp/getMasterAndAgentVersionLog.json` 返回的运维平台版本只用于决定通道顺序，不作为下载硬门槛。较新平台先试 `/cd/secdev/downloadFile?fileName=lib.zip` 和 `classes.zip`；较旧或版本不可查询的平台先试受保护的 `/weaSecondev/lib.zip` 和 `classes.zip`。只有首包 HTTP 404 才切换通道，两包不得混源。较旧平台只要双包可用就正常导入；版本确认较低、受保护文件返回 HTTP 404 且最终无法取得同源双包时提示升级运维平台，提示中不暴露内部路径。认证、网络、超时、服务端错误和无效归档按真实原因报错，不误判为版本不足。`/app` 为服务端物理存放位置，不是 HTTP 路径。下载不跟随重定向，不输出 token、密码或含 token 的请求 URL；HTTP 200 的认证错误 JSON 也不能当作 ZIP。在线下载和本地完整性检查均不证明双包匹配目标 E10 基线。

任务准备和初始化共用基线解析，支持 `2607`、`26.07`、`10.0.2607.01` 等格式；检查月份合法性，不固定可用月份范围。未知或冲突基线不下载；无可核对的包基线元数据时，状态标记 `baselineCompatibilityVerified=false`，交付前需用目标平台和实际 Gradle 构建确认。双包也可由本地 `--lib-archive-file` 和 `--classes-archive-file` 一起提供，不接受单包。ZIP 支持 Store/Deflate；链接、路径穿越、重复项和 Zip64 显式拒绝。

根目录检查包含有效文件、真实 Wrapper JAR、插件源码、构建脚本、`secDevLib` 有效 JAR、`secDevClasses` 类文件及模块；检查结果不代表业务代码编译通过。状态仅写 `.ecode-runtime/project-state.json`。

依赖数量仅统计。本地安装清单保存在 `.ecode-runtime/project-state.json` 的 `dependencyManifest`，记录实际导入文件的相对路径、大小和 SHA-256；两个归档摘要及验证时间另存于同一状态。`inspect` 核对清单与真实文件；无清单的历史工程须重新导入后才能证明本次安装完整。
