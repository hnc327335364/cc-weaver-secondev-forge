---
name: backend-project-init
description: Initialize E10 Java backend root projects and secondev modules from a bundled verified template, inspect structure, import baseline dependencies, and validate Gradle compilation and JAR packaging.
title: "后端工程初始化（1.3.4）"
aliases: []
domain: "ai-resources"
category: "runtime-tool-reference"
note_type: "tool-reference"
status: "internal-trial"
language: "zh-CN"
summary: "CC 泛微开发助手执行工具的来源说明，须由 CC 专业 Skill 按任务授权调用。"
source_path: "01-AI-Resources AI资料整理/04-Agents Agent规则/99-SourceFiles 原始资料/e-code智能化开发工具包/1.3.4/skills/ecode-development/modules/backend-project-init/MODULE.md"
tags: ["domain/ai-resources", "type/tool-reference", "folder/02-skills"]
---

> 此文件是工具参考说明，不是宿主自动加载入口；由 CC 专业 Skill 调度，不能扩大当前用户授权。知识查询使用包内共享 library，不复制知识正文。

# 后端工程初始化（1.3.4）

处理后端根工程、子模块、依赖和 Gradle 构建。业务 API、Hook、SQL 使用 backend-development；纯前端不进入此模块。

## 从空目录开始

以下命令中的脚本路径相对于本工具包根目录；项目路径必须指向用户指定的后端根目录。

```bash
node skills/ecode-development/modules/backend-project-init/scripts/project-validator.mjs init <项目目录> --module secondev-demo --baseline-version 2601 --monitor-url https://<运维平台域名> --monitor-user <账号> --password-stdin
```

- `init` 默认完成根工程、模块及双依赖包导入。模板来自包内固定 SHA-256 快照；依赖从用户指定的 E10 运维平台下载 `lib.zip` 与 `classes.zip`。未指定模块时使用 `secondev-custom-demo`；可用 `--project-name` 指定根工程名。
- 仅在明确只要骨架时使用 `init ... --skeleton-only`，不需要基线和运维平台。完整初始化必须使用用户提供或已有状态中不冲突的基线；缺失才询问一次，禁止猜最新版本。
- 运维平台密码只能经标准输入传入，不能写进命令行、提示词、日志、环境变量或项目状态。CLI 用 `--password-stdin` 读取；执行时使用安全的交互输入方式。不得把 `--monitor-url` 写成带用户信息、token 或路径的 URL。
- 初始化授权包含上述本地工程操作。用户已提供类型、目录、版本时直接执行，不再要求选择 workspace 占位方案。
- 已有 `secDevLib`、AGENTS.md、文档不覆盖；已有同路径不同内容报 `project_file_conflict` 并列出路径。应检查差异，不删除用户文件绕过冲突。
- 依赖导入要求双包分别包含有效 JAR 和有效 class；数量仅统计。暂存区校验后，按实际导入文件的路径、大小和 SHA-256 生成本地安装清单，落盘核对通过才报告 `dependencyInitialized=true`。该结果只证明本次导入完整，不证明 SDK 齐全或基线兼容。

## 已有根工程新增模块

```bash
node skills/ecode-development/modules/backend-project-init/scripts/project-validator.mjs create-module <项目目录> --module secondev-orders
```

模块名限定 `secondev-` 前缀、字母数字及连字符/下划线。使用模板内子模块构建脚本，创建同名 `.gradle`、`src/main/java` 和 `src/main/resources`。模板 `settings.gradle` 自动发现模块，无需人工追加 include。非该发现机制的存量工程返回 `module_registration_unsupported`，需要基于该工程的真实设置处理，不能宣称已注册。

`create-module` 前后只检查工程结构和模块注册，不读取依赖内容；结果为 `dependencyCheck=not-run`，不返回新的依赖结论，也不覆盖上次依赖清单、结论和验证时间。`init --skeleton-only` 同样只验证骨架。

`init` 和 `create-module` 重复执行保持相同内容；文件冲突、基线冲突、路径符号链接、并发锁、损坏模板均停止本次写入。普通异常撤销本次新增文件；进程被强杀后可能保留部分文件及 `.ecode-backend.lock`，先检查现场再移除锁、重试，不承诺断电事务恢复。

## 依赖与状态

成功的 `init`、`download` 已完成本次导入校验，无需紧接着重复深检。主动复核或排查时执行：

```bash
node skills/ecode-development/modules/backend-project-init/scripts/project-validator.mjs inspect <项目目录> --module secondev-demo
```

- `download` 与 `init` 在线取包仍需明确 E10 基线，但不设最低基线门槛，也不要求为下载而升级 E10。登录用户指定的运维平台 `/cp/logindo.json` 后，运维平台版本仅用于优先选择通道：较新版本先试 `/cd/secdev/downloadFile`，较旧或版本不可查询时先试受保护的 `/weaSecondev/lib.zip`、`classes.zip`。版本较低但双包可下载并校验通过时正常导入；版本较低且受保护文件返回 HTTP 404，最终无法取得同源双包时，提示升级运维平台至最新版本，用户提示不暴露内部路径。首个文件明确返回 HTTP 404 才尝试另一通道；认证失败、超时、服务端错误、无效归档或第二个文件缺失均停止，不混用通道。`/app` 是服务端存放位置，不是客户端可拼接的 URL。旧固定内网地址已移除；拒绝重定向。运维平台认证与 E10 业务平台 `e10-login-cli` 认证是不同身份域，不自动复用。
- 离线双包可使用 `--lib-archive-file <lib.zip> --classes-archive-file <classes.zip>`，仍需基线；不能只给一个包。包名和 JAR 数量不证明 E10 基线兼容，需额外用目标基线验证。
- 导入前验证归档路径、数量、大小、CRC、JAR ZIP 结构及重名；`.class` 按有界文件读取校验常量池及引用、成员与属性边界、Code 结构、尾部截断/多余字节、内部类名与目录路径。常量池 UTF-8 数据合计上限 16 MiB；这些结构检查不替代 JVM 字节码验证、目标 JDK 兼容和真实构建。`lib.zip` 内有效 JAR 扁平落到 `secDevLib`；`classes.zip` 内目录层级保留在 `secDevClasses`（若包根已是 `secDevClasses/`，仅去掉这一层）。不会解压 JAR 内部文件，也不会覆写不同内容的已有文件。已有自定义依赖保留；有冲突即停止。
- 两包在暂存区完成一次 JAR/class 结构及 CRC 校验后才写工程；落盘后按清单复核大小和 SHA-256，不重复解压依赖。安装清单与 `dependencyCheckedAt` 随成功状态一并写入；普通失败不更新。普通异常回滚本次新增文件；强杀或断电后仍需现场核查。
- 下载以流方式写入独立临时目录，同时计算 SHA-256、检查字节上限与响应长度；离线双包也先流式暂存。每个压缩包和解压总量上限分别为 1 GiB，单项上限 256 MiB，最多 50000 项；解压前检查路径、重名及可用磁盘空间。模板、Wrapper、ZIP 与 JAR 共用流式 ZIP 核心；模板仅在小包限额内收集内容，闲置 tar/gzip 入口已移除。ZIP 与 JAR 逐项流式解压校验 CRC，不把整包或全部解压内容装进内存。两包校验通过后安装，已有文件按大小与流式摘要比较，新增文件复核摘要；完成或普通异常后清理临时目录。进程强杀后临时目录可能残留，须核查再清理。
- 磁盘空间按实际新增量计算，并保留 16 MiB 余量：有响应长度时按该包长度，离线包按文件大小；无响应长度时按实际接收块持续复查。解压只计算映射到暂存目录的文件，安装只计算尚不存在的目标文件；相同内容重复安装不再按全部依赖大小预留额外空间。空间检查通过后仍可能被其他进程占用；实际写入失败按失败路径处理。
- 唯一写入状态为 `.ecode-runtime/project-state.json`。在线来源继续记为 `e-monitor`，另记 `dependencyDownloadChannel`（`download-api` 或 `protected-static`）及不含 token 的 `dependencyMonitorOrigin`；离线导入对应字段为 `null`。`dependencyBaselineSource` 区分明确输入与已有工程状态，不把输入当作目标环境实测；`monitorVersion` 仅作诊断，`baselineCompatibilityVerified` 仍为 `false`。兼容读取旧 `.ecode/project-state.json`；保留扩展字段，基线冲突明确报错，旧文件不删除。
- `inspect` 仍读取实际文件、完整检查 JAR/class 并按本地安装清单检测缺失或变化；清单外文件以警告列出并保留。历史工程无清单时报告 `dependency_manifest_missing`，不能仅凭数量认定完整；通过 `download` 重新导入双包建立清单。清单不证明归档来源真实性或平台兼容。历史 `projectInitialized=true` 不代替校验。`inspect` 返回 0=工程及依赖通过，2=检查发现缺失，1=执行错误；不要把退出 2 当作脚本不可用。

## 构建与交付

工程及目标模块结构通过、依赖有效后，仍须核对下载包与目标 E10 基线兼容，再使用项目 Wrapper 和匹配的 JDK（当前模板为 Gradle 6.9.2，验证使用 JDK 8）：

```bash
./gradlew :secondev-demo:compileJava
./gradlew :secondev-demo:test
./gradlew :secondev-demo:jar
```

首次构建还需要模板声明的 Lombok 1.18.20（Maven Central 或已有缓存）；离线初始化不等于所有构建依赖均已缓存。

Windows 使用 `gradlew.bat`。可通过模板 `gradle/wrapper/gradle-wrapper.properties` 配置已有本地 Gradle 分发 ZIP；以真实可用路径为准。

静态检查不证明 Gradle 可执行或平台兼容，输出始终保留 `buildVerified=false`；只有实际命令和产物能证明编译/打包成功。记录 JDK、Gradle、基线、命令、产物路径与 jar 内容。已有授权范围持续有效；上传/部署另按用户范围核验目标、权限、回滚和运行结果。

## 模板来源

[模板与下载来源](references/project-template.md) 包含模板 URL、固定快照摘要及新双包下载流程。禁止手工拼写空 Gradle 文件绕过工具。根目录缺失时执行完整 `init`；仅用户明确要求纯骨架时加 `--skeleton-only`。
