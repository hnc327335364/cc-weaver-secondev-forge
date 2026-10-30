---
name: weaver-cc-e10-development
description: 在泛微 E10 本地工程中初始化前端或Java骨架、新增模块、编译检查与生成前端补丁；含需求场景分流，不处理生产发布。
metadata:
  title: "CC E10 工程开发"
  aliases: "CC E10 工程开发"
  domain: "ai-resources"
  category: "skill"
  note_type: "skill"
  status: "internal-trial"
  language: "zh-CN"
  summary: "在泛微 E10 本地工程中初始化前端或Java骨架、新增模块、编译检查与生成前端补丁；含需求场景分流，不处理生产发布。"
  source_path: "skills/weaver-cc-e10-development/MODULE.md"
  tags: "domain/ai-resources,type/skill,folder/02-skills"
---

# CC E10 工程开发

先确认目标基线、工程范围和现场 API；已有工程优先沿用现有结构。复杂需求可运行 prepare/route 辅助分流，但输出不是已验证的方案，不能丢弃用户目标。平台证据通过 [共享知识](../weaver-cc-knowledge/MODULE.md) 获取。页面整页生成转 [页面制作](../weaver-cc-e10-pages/MODULE.md)，普通存量补丁留在本模块。

## 已接入的本地工具

命令以包根定位；Windows 使用已确认的 Python 命令（例如 py -3），macOS 通常 python3。需要 Node.js 18+；不要求全局安装 ecodecmd 或 npm install。

```text
python3 "<包目录>/scripts/cc_tools.py" run prepare -- "<需求>"
python3 "<包目录>/scripts/cc_tools.py" run route -- "<需求>" --json
python3 "<包目录>/scripts/cc_tools.py" run frontend -- init "<父目录>" --project-name "<项目名>"
python3 "<包目录>/scripts/cc_tools.py" run frontend -- check "<项目目录>"
python3 "<包目录>/scripts/cc_tools.py" run frontend -- compile "<项目目录>"
python3 "<包目录>/scripts/cc_tools.py" run frontend -- build "<项目目录>"
python3 "<包目录>/scripts/cc_tools.py" run backend -- init "<后端目录>" --module secondev-demo --skeleton-only
python3 "<包目录>/scripts/cc_tools.py" run backend -- create-module "<后端目录>" --module secondev-orders
python3 "<包目录>/scripts/cc_tools.py" run backend -- inspect "<后端目录>"
```

前端类型按现场选择 --app-type eb-custom-component / business-component / feature-theme；普通补丁省略。先读取 [前端工具约定](../../tools/ecode/skills/ecode-development/modules/e10-frontend-local-tooling/MODULE.md)，不能把 EB/业务组件/特色主题混用。禁止 --force，不覆盖现有项目。生成 ZIP 不代表导入成功或客户运行正常。

后端示例明确只建骨架，不能称为完整可编译工程；inspect 退出2表示依赖/结构待补，不是工具不存在。完整初始化可用同时提供的 --lib-archive-file 与 --classes-archive-file，并核实 --baseline-version；在线下载必须按 [工具权限](../../references/tool-execution.md) 单独确认。读取 [后端约定](../../tools/ecode/skills/ecode-development/modules/backend-project-init/MODULE.md)。JDK、Gradle 与客户依赖仍由接收方提供，真实编译/测试/打包使用该工程命令；本轮骨架检查不替代这些验证。

来源工具说明中的其他 Skill 链接不改变 CC 分派与授权规则；运行统一通过 cc_tools.py，不直接绕过入口。
