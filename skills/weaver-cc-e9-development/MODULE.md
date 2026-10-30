---
name: weaver-cc-e9-development
description: 处理泛微 E9 Action、定时任务、流程/建模表单、Ecode 与集成代码的局部开发和排障；不使用 E10 初始化、登录或打包工具冒充 E9 工具。
metadata:
  title: "CC E9 开发与排障"
  aliases: "CC E9 开发与排障"
  domain: "ai-resources"
  category: "skill"
  note_type: "skill"
  status: "internal-trial"
  language: "zh-CN"
  summary: "处理泛微 E9 Action、定时任务、流程/建模表单、Ecode 与集成代码的局部开发和排障；不使用 E10 初始化、登录或打包工具冒充 E9 工具。"
  source_path: "skills/weaver-cc-e9-development/MODULE.md"
  tags: "domain/ai-resources,type/skill,folder/02-skills"
---

# CC E9 开发与排障

先核对当前 E9 工程、目标模块、现场字段与用户授权，读取最近的同类实现；不按工作目录猜交付模块。平台事实从 [共享知识](../weaver-cc-knowledge/MODULE.md) 先检索后读正文。

- 前端：区分 WfForm、ModeForm 与 Ecode，核实生命周期、已有明细/新增明细、回调和组件挂载；不得以隐藏/拦截替代服务端权限。
- 列表、筛选或导出：先读取 [列表取数与导出](../../references/e9-list-export.md)，核对真实查询链，不能将条件值当数据或静默忽略筛选失败。
- Java：沿用客户导出的类和实际 SDK 签名；数据库值参数化，动态标识符白名单；要求整批事务时核实同一真实事务连接。
- 集成：普通接口开发在当前项目实现；组织快照或 E9→E10 同步才转 [集成工具](../weaver-cc-integration/MODULE.md)。
- 用户要求安全/性能审查时分别转对应专业 Skill；审查只读，不自动修复。

E10 专用前端打包器和后端工程模板不能用于 E9。E9 编译、测试、打包使用目标项目已有命令和依赖，不自行虚构通用 E9 工具。只有明确实现授权后修改指定本地范围；部署与生产执行不包含在内。交付报告列出实际改动、运行的检查和仍需客户验证的流程/权限/接口行为。
