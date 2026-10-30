---
name: weaver-cc-e10-pages
description: 使用已接入的页面工具适配器生成或修改 E10 页面、预览、打包，并按独立授权接入非生产平台及表单MCP；首次需下载运行时。
metadata:
  title: "CC E10 页面制作"
  aliases: "CC E10 页面制作"
  domain: "ai-resources"
  category: "skill"
  note_type: "skill"
  status: "internal-trial"
  language: "zh-CN"
  summary: "使用已接入的页面工具适配器生成或修改 E10 页面、预览、打包，并按独立授权接入非生产平台及表单MCP；首次需下载运行时。"
  source_path: "skills/weaver-cc-e10-pages/MODULE.md"
  tags: "domain/ai-resources,type/skill,folder/02-skills"
---

# CC E10 页面制作

整页生成、截图复刻、已有页面项目修改使用本模块；普通 Ecode 小补丁使用 E10 开发模块。先读 [页面工具约定](../../tools/ecode/skills/weaver-e10-page-generator/TOOL-REFERENCE.md) 及其 integration.md。

```text
python3 "<包目录>/scripts/cc_tools.py" run pages -- status
python3 "<包目录>/scripts/cc_tools.py" run pages --allow-network --environment development --confirmed -- run -- init --name "<页面名>" --parent "<用户目录>" --kind static-html
```

随包已经包含可执行适配器，但没有打包 ui-code-agent、浏览器或 npm 缓存。首次使用需接收方同意联网下载，Node >=22.5、Chrome/Edge。一个分发包不等于所有机器无需运行环境；不能把桥接脚本存在说成运行时已安装。普通开发、资料问答不会自动安装它。

首次按CC随包审核锁下载固定版本（ui-code-agent 0.1.71、ui-code-mcp 0.2.34及完整依赖锁），不自动跟随npm latest；新审核锁随助手升级，运行时更新仍需单独确认。必须读取实际安装版本返回的 protocol，不按旧文档猜上游命令。若无法联网或依赖缺失，明确当前页面工具未就绪，不悄悄输出假打包结果。

组件知识、校验器和预览资源已在macOS隔离环境实际验证；安装器的E10专项检查不等于浏览器、真实编译、业务MCP或发布验收。按返回的verification范围报告，不能只凭installed或gated-full宣称全部能力就绪。浏览器/编译检查与客户在线操作仍按实际任务单独核验。

本地页面优先模拟数据；静态HTML打包与e10-page打包的身份条件不同，按运行时协议执行。真实业务数据、表单MCP、平台发布必须另行核对测试环境、租户、用户和本次影响范围；沿用上游 plan/approval-file 检查，再满足 [CC权限](../../references/tool-execution.md)。MCP属于页面工具执行链，不是共享知识库的检索后端。本轮包内验证不等于该下载运行时或客户平台验收。
