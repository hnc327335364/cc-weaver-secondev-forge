---
title: "CC 正式交付文档"
aliases: []
domain: "ai-resources"
category: "skill-module"
note_type: "skill-module"
status: "internal-trial"
language: "zh-CN"
summary: "按需复用交付对象清单、离线HTML模板和校验器"
source_path: "skills/weaver-cc-delivery/MODULE.md"
tags: ["domain/ai-resources", "type/skill", "folder/02-skills"]
source_docs: ["weaver-e9e10-delivery-docs/SKILL.md"]
---


# 泛微 E9/E10 交付说明

Create an offline HTML handover that lets an implementation, operations, or
follow-up delivery person locate every included maintenance object, its source,
maintenance entry, verification path, and rollback boundary without relying on
chat history.

This is a **manifest-driven** workflow. Do not draft tables before establishing
which actual objects the document must cover.

## Scope and sources

- Start from `<Skill根>/assets/delivery/template.html`.
  It applies to both E9 and E10; do not turn the shared template into a
  customer-specific template.
- Only the generic template is bundled. Customer examples are not bundled; do not copy customer values or scope without current project evidence.
- `文书定与档案项目交付清单（模板）.md` is an optional project-management
  checklist for records/archive projects. It is neither a prerequisite for nor
  part of this HTML handover.
- Local agent instructions, such as `AGENTS.md`, local path mappings, and
  Codex/host configuration are internal working context, never customer-facing
  delivery evidence. Do not cite, link, quote, or list them in the HTML or its
  object manifest.
- Platform-managed standard fields, such as `FORM_DATA_ID`, are not delivery
  configuration and must not appear in field tables or object descriptions.
  Document only project-created fields and fields whose business maintenance
  rule is genuinely delivered in this project. An explicit user request is
  required to make an exception.
- Gather only evidenced facts. Missing material facts become `待确认` with the
  responsible party, or the optional object is excluded. Never infer schedules,
  URLs, fields, classes, or production settings from an example.
- Never include passwords, Tokens, keys, credentials, private production
  addresses, or local absolute paths in the document, screenshots, logs,
  remarks, examples, or the object manifest.

Ask one focused question only when the target project, output name, or delivery
scope cannot be safely determined. Otherwise prepare the manifest internally
and continue without making the user repeatedly restate its structure.

## 1. Build the temporary delivery-object manifest

Before editing HTML, create a temporary JSON manifest using
[`references/object-manifest.md`](references/object-manifest.md). It is a
generation and validation aid, not a second delivery artifact; remove it after
validation unless the user asks to retain a source manifest.

Inventory every included, independently maintainable object. A separate row is
required for each physical configuration file, configuration form/table,
scheduled job, Action, page or button, endpoint, third-party interface, and
custom Bean/service that is part of the handoff. Record excluded objects with a
reason instead of silently dropping a discovered delivery item.

Treat the object manifest as a customer-project evidence index, not a dump of
the local workspace. It must not contain internal instruction files or
platform-standard field rows.

The manifest is the source of truth for granularity:

- A summary on the cover may state counts and link to details, but it must not
  replace the per-object sections.
- Main/detail tables remain separate objects even when they serve one feature.
- One properties/configuration file is one object; one editable property key is
  one row in that object's table. A single confirmed Serverless registration
  XML is the exception: it is one whole registration object, not three
  separately maintained XML attributes.
- One modeled configuration table is one object; one field is one row in that
  object's table. For a table that this project creates, each field row must
  also state its field type, length or precision where applicable, and required
  / default rule. Project staff need this information to create the form.
- For a standard or pre-existing table that this project does not alter, state
  “沿用既有字段类型，本期不改结构” instead of inventing a field type from a
  field name or code.
- One job, Action, button, endpoint, interface, Bean, or service is one object.
  Group only the chapter navigation, never their operational descriptions.
- Ordinary implementation-only helper classes need not be manifest objects.
  Include them only when a maintainer configures, invokes, diagnoses, or rolls
  them back as part of the delivery.

### Choose the presentation from the maintenance task

“One object, one independently findable block” protects delivery granularity;
it does **not** mean “one object, one four-column table”. Use a table only
when a maintainer must compare multiple rows against stable column headings.
Do not turn sequences, responsibilities, or one-off operating boundaries into
field tables merely to make their objects look uniform.

| Object / reader task | Preferred independent presentation | When a table is required or useful |
| --- | --- | --- |
| Properties / configuration file, table, or configuration record | Field matrix | Required: one editable field/key per row. Project-created tables also show type, length / precision and required / default rule. |
| A single confirmed Serverless Action registration XML | Complete XML registration card: whole fragment, backup → save/restart → smallest verification/recovery | Do not use a `ref` / `interface` / `group` field table: project staff paste and restore the confirmed fragment as a whole. |
| Business / EB data table and field mapping | Field matrix | Required when fields, states, or mappings must be checked row by row. |
| Scheduled job | Operation card: entry, status, scope, smallest run, result, stop/recovery | Only for a genuine multi-parameter mapping. Never use a table just to restate the lifecycle. |
| Action / page / button | Trigger-to-result flow plus an input/disable boundary | Only for several independently maintainable input mappings. |
| Third-party interface / SFTP | Input → channel / call → output flow, with a failure boundary | Only for a real field contract or mapping. |
| Deployment artifact / dependency | Release-check card: package, target, gate, verification, rollback | Not needed for a short release checklist. |
| Bean / runtime service | Capability card: responsibility, related objects, diagnosis cue, maintenance boundary | Not needed for narrative operating responsibility. |

Use the template-supported `data-object-presentation` values
`field-matrix`, `operation-card`, `action-flow`, `interface-flow`,
`release-card`, `service-card`, and `xml-registration-card` on the object or its inner presentation
container. A presentation is still one object block with one manifest ID,
one heading, one anchor, and one sidebar entry. It is never a chapter-level
summary that hides separately maintainable objects.

### E10 二开发布、计划任务与 Serverless 的边界

When the project delivers an E10 second-development `build.zip`, document the
evidenced release flow in **发布物与部署**. Do not reduce it to “upload and
restart”. The operational sequence is:

1. Open E-code Monitoring Platform at `/ecode/monitor/loom/deploy/jar`, choose
   the confirmed second-development service, and upload the JAR package.
2. Complete code review. Treat **审核通过（review approved）** as a gate:
   restarting an unapproved package does not make the new code effective.
3. In the same platform, choose **配置文件编辑**, select the confirmed target
   service, query, edit, and save the XML configuration when this release has a
   configuration delta.
4. Restart the target second-development service from the operations platform.
   The E-code monitoring platform is only for JAR upload, review, and XML
   editing; do not describe it as the service-restart entry.
5. Confirm the deployed version and service startup, then run one smallest
   controlled business sample before enabling schedules or opening wider use.

Always use actual project evidence for the service name. For example,
`weaver-secondev-service` is written only when confirmed for the target
environment; it is never a universal template default. Show platform routes as
code text, not `file://`-unsafe links, in an offline HTML document.

For a Serverless custom Action, model the registration XML and the business
Action as two related but independent objects:

- The **发布物与部署** chapter is the single authority for XML file, target
  service, complete confirmed registration fragment, release order, restart,
  backup, and rollback. For one registration, show the whole XML fragment and
  operation cards; do not ask project staff to understand or separately edit
  `ref`, `interface`, and `group`.
- The **Serverless Action** chapter documents only its business trigger,
  group/version reference, input/output, first-run verification, and disable
  path. Link to the XML object; do not paste a second raw XML block.
- If the project confirms the standard Serverless RPC registration pattern,
  document that code must be released before XML; a missing code-side service
  registration can prevent the service from starting after restart.

Use a field matrix only when one XML file has multiple independently
maintained registrations or another genuine row-level mapping. Even then, each
registration still needs a complete, copyable fragment at its own maintenance
boundary; do not turn individual XML attributes into a pseudo-configuration
form.

Document every scheduled job as an independent object. Its maintenance entry
must state `/info/dispatch/escheduler/task` when that is the confirmed E10
route. Describe the job in operational terms: display name, system identifier,
parameters, cycle, enablement, test range, and stop/recovery. Put annotations,
Bean/class names, RPC/Dubbo chains, and algorithm details in **运行服务与规则**,
not in configuration or job-maintenance tables.

Configuration chapters use implementation-facing but non-development language:
maintenance entry, configuration code, what to fill, value provider, effective
scope, verification, and disable/recovery. Keep real configuration keys and
codes where they are required to operate the project; do not explain their Java
classes, Bean wiring, or internal calls there.

### 配置章节的三级目录

当一个配置章节同时包含两类以上职责不同的配置对象，并且每类至少有两个可独立维护
对象时，使用模板内置的三级目录结构。典型例子是“统一二开配置表 → 多个业务配置
编码 → 标准平台配置表”。这不是为了增加编号：二级分组必须回答该类对象负责什么、
与相邻分组如何关联、维护顺序是什么。

~~~html
<section data-toc-group id="config-project-codes">
  <h3>项目专用配置编码说明</h3>
  <p>这些编码都保存在统一配置表中；分别维护、分别验证。</p>
  <details class="object"
           data-object-id="config-example-api"
           data-object-kind="configuration-record">
    <summary><h4>EXAMPLE_API：接口参数配置</h4></summary>
    <!-- this object's one table -->
  </details>
</section>
~~~

- 章节开头的导读、维护边界或统一入口不是维护对象，不能使用普通
  <code>h3</code> 占用编号。必须写成下文的 <code>data-chapter-guide</code>，不进入
  左侧目录；本例的第一个分组才是 <code>4.1</code>。
- 分组容器必须带 <code>data-toc-group</code>；其直接 <code>h3</code> 显示为如
  <code>4.1</code>。
- 分组内每个 <code>details.object &gt; summary &gt; h4</code> 显示为如
  <code>4.1.1</code>。本分组中的对象是配置编码，因此仍必须各自拥有一张字段表；
  这条规则不外推到计划任务、接口或服务。
- 不要用一个普通 <code>h3</code> 伪装父级，再把它与对象标题平铺在目录中；这会
  造成正文和左侧目录的假层级。一个对象、单一配置文件或单一配置表不需要为了视觉
  效果建立分组。
- 共享 HTML 模板已兼容该标记并保留两级目录的向后兼容；不要为单份交付文档重写
  目录脚本或手工维护侧栏链接。

### 本章说明与可维护对象

“发布步骤”“统一维护入口”“使用边界”“接口资料边界”等只是帮助读者理解本章的
导读，不是与后续 JAR、计划任务、Action、接口或服务同级的维护对象。若将它们写成
编号 <code>h3</code>，而后续对象使用带边框的卡片，读者会自然误解为前者是后者的父级。

~~~html
<section class="chapter-guide" data-chapter-guide id="release-steps">
  <span class="chapter-guide-label">本章说明</span>
  <h3>发布步骤</h3>
  <p>说明发布顺序、审核边界和首次验证原则。</p>
</section>
<details class="object" data-object-id="xml-registration"
         data-object-kind="configuration-file"
         data-object-presentation="xml-registration-card">
  <summary><h3>Serverless Action 注册 XML</h3></summary>
  <!-- one confirmed XML fragment, backup/save/restart and recovery cards -->
</details>
~~~

- <code>data-chapter-guide</code> 中的标题不自动编号、不生成侧栏或打印目录项；哈希链接
  仍可直接定位到导读。
- 其后的第一个真正对象才显示为如 <code>3.1</code>、<code>7.1</code>。同一层级的对象
  必须使用相同的卡片结构，避免“一个 h3 + 多个卡片”造成假父子关系。
- 只有“配置表说明 → 配置编码说明 → 每个配置编码”这类真实的包含关系使用
  <code>data-toc-group</code> 三级目录。不要为了视觉排版把所有章节都机械改成三级。

Optional operational screenshots may clarify release steps. They must be
redacted for usernames, private URLs/IP addresses, credentials, tokens, keys,
and other environment identifiers, captioned as an operation reference rather
than proof of a target-environment release, and embedded as compressed data
images to preserve the single-file offline requirement.

## 2. Assemble from the protected template

1. Copy the universal template to the target project's
   user-confirmed delivery directory; use `04-Implementation 实施记录/01-DeliveryDocuments 开发交付文档/` only when the project already follows that layout.
   For a new version, use `<平台>-客户名称-需求名称-开发交付说明-Vx.y.html`; do not
   prefix the filename with a date or silently overwrite an accepted version.
   For an E10 project, the filename is exactly
   `E10-客户名称-需求名称-开发交付说明-Vx.y.html`.
2. Fill the cover, version record, scope, included-object overview, source
   boundaries, deployment, validation, and rollback before detailed tables.
3. Map each included manifest row to exactly one independently findable block.
   Choose the markup from the reader task rather than forcing a table:

   ```html
   <details class="object"
            data-object-id="config-archive-properties"
            data-object-kind="configuration-file"
            data-object-presentation="field-matrix">
     <!-- one object heading, compact context, and its own field table -->
   </details>
   ```

   The `data-object-id`, `data-object-kind`, and enclosing chapter ID must match
   the manifest. A configuration/field object has exactly one independent field
   table, except a `configuration-file` presented as a single
   `xml-registration-card`. A project-created EB table's field matrix includes
   a **字段类型 / 长度 / 约束** column with type, length / precision where applicable, and
   required / default rule; existing tables only state that their types are
   retained unless project evidence confirms a structural change. A non-field
   object has either one genuine mapping table or one
   `.object-presentation` block with a matching `data-object-presentation`.
   For runtime objects, cover entry/trigger, input or scope, result, failure
   boundary, first-run verification, and disable or rollback method. For
   example, a job should be an operation card; an interface should be an
   input-to-output flow; and a service should be a capability card.
4. Remove irrelevant template chapters as complete units. Do not retain blank
   headings/tables, stale navigation, or placeholders. Preserve the desired
   outer chapter order; reordering one group does not authorize removing other
   applicable groups.
5. Treat the template shell as protected. Do not rebuild the page or replace
   its stylesheet/script. The final document must retain the template's
   `aside.sidebar`, `.toc`, `.print-toc`, `.breadcrumb`, `[data-fold]`, embedded
   styles, and embedded interaction script. Only document content and the
   template's intended labels/sections may change.
6. Keep the result an offline, static, single HTML file. Do not add a “copy
   current link” control to a local `file://` document and do not require a web
   server.

## 3. Validate before handoff

Run the deterministic document check before presenting the result:

```bash
python3 "<Skill根>/scripts/validate_delivery_html.py" \
  <output.html> \
  --template "<Skill根>/assets/delivery/template.html" \
  --manifest <temporary-manifest.json>
```

It checks manifest-to-object one-to-one coverage, required field tables or
semantic object presentations, chapter placement, placeholders, local paths,
and the protected template core.
`quick_validate.py` validates only the Skill folder's metadata; never describe
it as proof that a generated delivery document is correct.

Then open the local HTML and verify observable behavior:

- clicking a first-level, a second-level, and (when present) a third-level
  directory entry highlights the exact content displayed on the right;
- every visible third-level item has a matching second-level group and follows
  continuous numbering; the sidebar, body headings, and printed directory use
  the same hierarchy;
- full-text search, detail folding, table controls, and the acceptance checklist
  work where present;
- desktop-width visual inspection confirms headings, table columns, text
  contrast, and left navigation are legible; and
- print preview hides interactive controls while retaining the full content and
  printable directory.

If browser or print-preview verification is unavailable, state that exact
boundary rather than claiming it passed.

## 4. Handoff report and boundaries

Report the exact output path, manifest counts by object type, deliberately
excluded object types and reasons, deterministic-check result, browser/print
evidence, and facts still awaiting confirmation. Delete the temporary manifest
after reporting unless retention was requested.

This skill documents a delivery. It does not authorize code changes, deployment,
configuration writes, customer communication, or knowledge-base backfill. Do not invoke unrelated orchestration or install additional Skills merely because a delivery document is requested.
