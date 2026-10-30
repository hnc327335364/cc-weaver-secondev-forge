---
title: "交付对象清单约定"
aliases: []
domain: "ai-resources"
category: "skill-module"
note_type: "reference-note"
status: "internal-trial"
language: "zh-CN"
summary: "正式交付HTML内部清单约定"
source_path: "skills/weaver-cc-delivery/references/object-manifest.md"
tags: ["domain/ai-resources", "type/skill", "folder/02-skills"]
source_docs: ["weaver-e9e10-delivery-docs/SKILL.md"]
---
# 临时交付对象台账

在生成交付 HTML 之前创建一份临时 JSON 文件。它用于让生成过程和校验器共享同一份“应交付对象清单”，不是客户交付物，也不应包含敏感值、本机绝对路径、`AGENTS.md` 等内部工作指令，或 `FORM_DATA_ID` 等平台标准字段。

```json
{
  "document": "客户-功能-V1.0",
  "objects": [
    {
      "id": "config-archive-properties",
      "kind": "configuration-file",
      "name": "archive.properties",
      "chapter": "properties-config",
      "maintain_at": "ecology/WEB-INF/prop",
      "source": "e9customer/WEB-INF/prop/archive.properties",
      "status": "included"
    },
    {
      "id": "job-archive-push",
      "kind": "scheduled-job",
      "name": "凭证归档推送任务",
      "chapter": "job-config",
      "maintain_at": "系统管理 → 计划任务管理",
      "source": "com.customer.archive.PushArchiveJob",
      "status": "included"
    },
    {
      "id": "action-legacy-example",
      "kind": "action",
      "name": "旧示例 Action",
      "chapter": "action-config",
      "maintain_at": "不适用",
      "source": "项目材料中的历史说明",
      "status": "excluded",
      "reason": "本次未交付，不能写入本期交付说明"
    }
  ]
}
```

## 字段规则

| 字段 | 规则 |
| --- | --- |
| `id` | 全文唯一、稳定的 kebab-case 标识；与 HTML 的 `data-object-id` 一致。 |
| `kind` | `configuration-file`、`configuration-table`、`scheduled-job`、`action`、`page-or-button`、`endpoint`、`third-party-interface`、`bean-or-service`、`deployment-artifact` 或 `dependency-file`。其他类型使用简短 kebab-case 并说明。 |
| `presentation`（可选） | `field-matrix`、`operation-card`、`action-flow`、`interface-flow`、`release-card`、`service-card` 或 `xml-registration-card`。它帮助生成时选择结构；不改变一对象一章节、一锚点的粒度。 |
| `name` | 交付人员能识别的实际对象名称；不是泛称，如“所有计划任务”。 |
| `chapter` | 该对象在最终 HTML 所在 `<section class="chapter">` 的 `id`。 |
| `maintain_at` | 项目人员实际定位或维护它的位置；可为相对路径或系统菜单，不写本机绝对路径。 |
| `source` | 已核验的客户项目相对代码/配置路径、类名或材料名称；用于追溯事实，不写凭据、本机工作指令或主机配置。 |
| `status` | `included` 或 `excluded`。`excluded` 必须额外给出 `reason`。 |

不把普通私有工具类、纯 DTO、重复的调用链中间层、平台标准字段或系统关联字段机械列入台账；只有后续人员需要配置、调用、诊断或回退的项目交付对象才纳入。

若项目包含 Serverless Action，XML 服务注册与 Action 本身分别登记：前者属于
`configuration-file`，放在“发布物与部署”；后者属于 `action`，放在“Serverless
Action”。单个已确认的 XML 注册使用 `xml-registration-card`，展示完整可复制片段以及
备份、保存/重启、验证和回退；不要将 `ref`、`interface`、`group` 误做成项目人员逐项维护的字段表。
Action 通过章节内链接引用 XML 发布项，不复制同一段 XML。计划任务则分别登记为
`scheduled-job`，其 HTML 说明应给出已确认的前端维护入口、参数、启停及验证范围。

## HTML 绑定

每个 `included` 对象均使用一个独立的 `<details class="object">`，并设置：

```html
<details class="object"
         data-object-id="job-archive-push"
         data-object-kind="scheduled-job">
  <summary><h3>凭证归档推送任务</h3></summary>
  <div class="object-content">
    <!-- 该对象独有的说明，以及字段表或与维护动作匹配的展示单元 -->
  </div>
</details>
```

校验器要求：每个 `included` 台账 ID 在 HTML 中恰好出现一次、位于对应章节、类型相同，并拥有自己的独立说明单元；`excluded` 对象不能出现在 HTML 的对象块中。

字段型对象（配置文件、配置表、配置编码、业务字段映射）必须有自己的字段表；但单个
`xml-registration-card` 配置文件除外。项目新建的 EB 配置表或数据表，其字段表还必须
标出“字段类型 / 长度 / 约束”（包括类型、长度/精度〔适用时〕和必填/默认规则）；既有标准表或本期不改的表只写“沿用既有
字段类型，本期不改结构”，不得凭字段名补造类型。计划任务、
Action、接口、发布物、依赖和运行服务可以不用表格，但必须拥有自己的
`.object-presentation`，并设置匹配的 `data-object-presentation`。例如任务使用
`operation-card`，接口使用 `interface-flow`，服务使用 `service-card`。不要用一张章节
级汇总表取代对象块，也不要为了通过校验把职责、步骤或失败边界硬塞进表格。
