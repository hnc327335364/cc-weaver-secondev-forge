---
name: weaver-cc-integration
description: 生成 E9→E10 组织同步计划、做离线预演，并在单独确认后执行非生产 E9读取、同步、E10 OAuth 或 HR 集成操作。
metadata:
  title: "CC E9/E10 集成工具"
  aliases: "CC E9/E10 集成工具"
  domain: "ai-resources"
  category: "skill"
  note_type: "skill"
  status: "internal-trial"
  language: "zh-CN"
  summary: "生成 E9→E10 组织同步计划、做离线预演，并在单独确认后执行非生产 E9读取、同步、E10 OAuth 或 HR 集成操作。"
  source_path: "skills/weaver-cc-integration/MODULE.md"
  tags: "domain/ai-resources,type/skill,folder/02-skills"
---

# CC E9/E10 集成工具

读取 [集成契约](../../tools/ecode/skills/ecode-integration/TOOL-REFERENCE.md) 中当前动作相关的参考，不批量加载。配置只写接收方受控工作目录；不放助手包或 Git，不在聊天复述凭据。E9认证、E10开放平台OAuth、网页登录会话是不同身份域，不混用。

## 先离线形成计划

```text
python3 "<包目录>/scripts/cc_tools.py" run integration -- help
python3 "<包目录>/scripts/cc_tools.py" run integration -- sync plan --config "<配置>" --snapshot "<脱敏快照>" --out "<新计划>"
python3 "<包目录>/scripts/cc_tools.py" run integration -- sync apply --config "<配置>" --plan "<计划>" --dry-run
```

这是实际调用已接纳同步规划器，不只是输出说明文字。离线预演验证计划，不请求客户系统。快照和计划可能含个人信息，保留在用户授权位置，不能加入发布包。

## 非生产执行

远端 E9 read/snapshot、OAuth check、HR call、sync apply 必须按 [工具权限](../../references/tool-execution.md) 明确授权。同步另需原工具计划摘要 --approve 和新 --journal；HR 写操作仍需 --allow-write 与 journal。外层确认不能替代内部校验。操作前核对环境、租户/人员、组织范围、编码规则、新增/覆盖影响与恢复办法。

HTTP成功不等于业务成功；首个失败或不明确响应即停，先核对目标状态，不自动重放。跨系统无自动事务回滚。生产禁用本工具；可继续离线分析。上线兼容性和接口契约需客户现场确认。
