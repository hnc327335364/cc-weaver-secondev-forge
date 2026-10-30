---
title: "页面运行时与权限边界（1.3.4）"
aliases: []
domain: "ai-resources"
category: "runtime-tool-reference"
note_type: "tool-reference"
status: "internal-trial"
language: "zh-CN"
summary: "CC 泛微开发助手执行工具的来源说明，须由 CC 专业 Skill 按任务授权调用。"
source_path: "01-AI-Resources AI资料整理/04-Agents Agent规则/99-SourceFiles 原始资料/e-code智能化开发工具包/1.3.4/skills/weaver-e10-page-generator/references/integration.md"
tags: ["domain/ai-resources", "type/tool-reference", "folder/02-skills"]
---

> 此文件是工具参考说明，不是宿主自动加载入口；由 CC 专业 Skill 调度，不能扩大当前用户授权。知识查询使用包内共享 library，不复制知识正文。

# 页面运行时与权限边界（1.3.4）

- 包内分发本 Skill、适配脚本与 `scripts/runtime-lock/` 三个小型 JSON 文件；不分发 `node_modules`、运行时源码或 npm tarball。当前固定 `ui-code-agent 0.1.71`、显式 E10 依赖 `ui-code-mcp 0.2.34`，完整锁同时确定 `ui-service-mcp 0.1.24` 等传递依赖。首次获准页面调用按锁安装到当前用户主目录下的 `.weaver-cc-assistant/page-runtime/1.3.4`；可用 `ECODE_PAGE_RUNTIME_HOME` 改为包外独立隔离目录。`update` 只采用当前助手包携带的锁；npm `latest` 只能只读查询，未经配套核验不能自动安装。
- 下载候选使用独立临时目录、空 npm 用户/全局配置、无鉴权环境和临时缓存，执行 `npm ci --ignore-scripts --no-audit --no-fund`。锁中所有下载来源必须为公共 npm，拒绝环境覆盖到未知 registry。安装后核对完整锁文件、每项实际依赖版本及清单摘要、协议文件和关键接口；无需每次遍历全部知识正文做哈希。只有成功才原子切换 `active.json`，临时候选与缓存随即清理。锁与摘要用于可复现和变更检测，不是软件安全审计或供应商签名。
- 候选必须实际通过 `doctor --json --only e10-page`，并明确返回 E10 组件服务与预览资源检查通过。`ui-code-mcp` 虽被主包声明为 optional peer，本适配器仍将其列为必装精确依赖，缺失或版本/资料契约不符即拒绝。默认 core doctor 可以跳过该 peer，因此不能代替此检查。`verification` 明确区分 `e10Page: passed` 与 `coreBrowserCompilation: not-run`、`customerEnvironment: not-run`；上游 E10-only 返回的“已由 core 验证”跳过说明不作为本助手的事实。浏览器交互、实际编译及客户效果必须另外取得证据。
- 活动记录采用 schema 2，并绑定锁摘要、依赖清单和关键合同文件。旧 schema 1 无锁记录不会静默迁移；提示取得确认后执行 `update`，成功才切换到锁定副本，旧版本目录保留。安装、自检或切换前失败均不修改旧活动记录。已有同版本锁目录发生内容冲突时停止，不覆盖；不得以删除现有安装来掩盖冲突。
- E10 登录拥有者是 `e10-login-cli`。经授权登录或切租户后，集成桥只在受控进程内把有效会话交给工具的 `setEnvironmentAuth`，核对环境、用户、租户；凭据不经 CLI argv。页面桥接仅接受 HTTPS（或本机 loopback HTTP），远程明文 HTTP 不同步。该入口不属于 npm 包公开 exports，未来版本不兼容时停用页面端同步，不猜测新接口。首次安装和本地 `run` 不自动补同步，不读取或验证既存会话。需要访问客户环境时，先确认环境和本次动作，再显式 `sync`、检查 `auth status` 或执行获准的平台操作。
- 本地页面命令与 `next` 使用与认证 Profile 不同的匿名 `UI_CODE_AGENT_HOME`，不试探同步既存身份；`next` 需要真实平台数据时须改走明确且已授权的平台命令。认证读取和 e10-page 打包使用核验并同步后的 Profile。入口只承认明确列出的命令类别，未知命令拒绝。`ui-code-agent` 工具源码不改；外层启动器在内存中为平台写方法和表单写工具加门禁，并在每次按需安装或升级时检查关键接口。固定版本仍须满足合同；不通过时停止，不降低安全检查以兼容未知版本。
- 未修改工具的 `build` 会自动继续 `next`，`next` 可能把跳过发布重置为发布意图。static-html 打包因此单独调用上游纯本地打包函数，先核验视觉检查、模拟数据决策和预览确认；e10-page 可调用上游 `build`，但该进程的平台写方法被禁用，不能因自动续跑而发布。e10-page 打包仍可能依赖 E10 读取、表单服务及本地 `ecodecmd-e10`，不等于离线或已在目标环境验收。
- 平台发布和表单写入只有在 `plan` 生成操作绑定计划、用户逐次确认环境/租户/用户/变更、计划补充明确摘要并批准之后才可 `run --approval-file`。计划绑定命令、输入文件 SHA-256、工程发布状态与现有 ZIP SHA-256、工具版本和身份；30 分钟有效，使用一次即作废。不能把此前的能力开放许可复用为具体写入批准。
- `data-write` 只允许 `create_form`、`batch_create_fields`、`save_sample_data`，通过同步 Profile 调用上游表单 MCP。若 `save_sample_data` 指向生产/真实业务表单，应先核对具体对象与数据影响。平台操作按上游命令语义执行，入口不承诺服务器事务回滚；失败后应查实际状态、重新计划，不能重放批准文件。
- 静态 HTML ZIP 与 e-code 补丁 ZIP 不能互相冒充。普通入口门禁不是恶意代码沙箱；不要直接执行上游 CLI 来绕过。目标 E10 环境、权限、发布和业务效果仍需独立验证。
