---
name: weaver-cc-e10-platform
description: 在接收方逐项确认后使用非生产 E10 登录、租户、应用下载、文件和应用包工具；不开放生产操作或任意认证请求。
metadata:
  title: "CC E10 环境与工程操作"
  aliases: "CC E10 环境与工程操作"
  domain: "ai-resources"
  category: "skill"
  note_type: "skill"
  status: "internal-trial"
  language: "zh-CN"
  summary: "在接收方逐项确认后使用非生产 E10 登录、租户、应用下载、文件和应用包工具；不开放生产操作或任意认证请求。"
  source_path: "skills/weaver-cc-e10-platform/MODULE.md"
  tags: "domain/ai-resources,type/skill,folder/02-skills"
---

# CC E10 环境与工程操作

这是已接入的在线工具，不是自动登录功能。运行前读 [工具权限](../../references/tool-execution.md)，核对目标测试/开发环境与操作范围。任何凭据由接收方在安全输入中提供；不读/打印会话文件，不把密码放命令行。

- 身份和租户：[登录说明](../../tools/ecode/skills/e10-login-cli/TOOL-REFERENCE.md)。
- 应用、源码及包：[工程操作](../../tools/ecode/skills/ecode-cli/TOOL-REFERENCE.md) 与其中 commands.md。
- 下载/修改/导入：[存量开发闭环](../../tools/ecode/skills/ecode-cli/references/existing-app-workflow.md)。

```text
python3 "<包目录>/scripts/cc_tools.py" run login --allow-network --environment test --confirmed -- login --url "<测试环境>" --account "<账号>" --password-stdin
python3 "<包目录>/scripts/cc_tools.py" run platform --allow-network --environment test --confirmed -- app download --app-id "<已核实ID>" --output "<本地父目录>"
```

密码必须通过接收方可用的隐藏交互输入传给stdin，不在聊天或脚本参数中提供；宿主无法提供安全输入时暂停登录，不退回明文命令。输出目录必须是用户允许的位置。下载的客户代码不能加入共享知识库。

创建、更新、上传校验、导入都按远端写入逐次确认，使用 --allow-remote-write --change-note 并满足原工具条件。通用 login request 在 CC 入口禁用，不因 GET 名称自动认为无副作用。生产或环境不明时停止在线操作；不得直接调用底层脚本绕过。导入成功不等于客户业务验收通过。
