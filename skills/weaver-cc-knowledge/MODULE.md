---
name: weaver-cc-knowledge
description: 检索泛微 E9/E10 随包正文、API、Hook、案例、字段与表结构；只读共享资料库，不联网或执行来源代码。
metadata:
  title: "CC 共享知识与数据库字典"
  aliases: "CC 共享知识与数据库字典"
  domain: "ai-resources"
  category: "skill"
  note_type: "skill"
  status: "internal-trial"
  language: "zh-CN"
  summary: "检索泛微 E9/E10 随包正文、API、Hook、案例、字段与表结构；只读共享资料库，不联网或执行来源代码。"
  source_path: "skills/weaver-cc-knowledge/MODULE.md"
  tags: "domain/ai-resources,type/skill,folder/02-skills"
---

# CC 共享知识检索

所有专业模块共用包根 `library/`，不复制资料到本目录。命令中的 `<包目录>` 从本 Skill 向上两级取得，不依赖当前工作目录或发送方路径。

## 全文与来源

E10 先解析随包 `00-E10 资料索引.md`，由索引选精确主题或来源路径；已有路径直接用 `source`，只有主题时先查元数据候选再读正文。无需从 `HR` 等短词做全库扫描。

```text
python3 "<包目录>/scripts/knowledge_lookup.py" source "02-Weaver-Knowledge 泛微知识库/02-E10 E10资料/00-E10 资料索引.md" --compact
python3 "<包目录>/scripts/library_reader.py" search "主次账号" --platform E10 --scope metadata
python3 "<包目录>/scripts/library_reader.py" search "关键词" --platform E9
python3 "<包目录>/scripts/library_reader.py" read <document_id> --lines 120 --compact
python3 "<包目录>/scripts/knowledge_lookup.py" source "skills/e10-local-knowledge/modules/模块/具体原文件" --compact
```

元数据范围只查标题和来源路径，输出 `body_searched=false`，不能以零命中断言全库无资料。未命中时换精确主题、同义词或 `--scope full`；如 `HR集成` 可明确改为 `HR 集成`，不自动改写技术符号。省略 `--scope` 仍查全文。

先查后读。`--compact` 仅省略重复 `lines` 数组，保留正文 `text`、来源哈希及 `next_line/next_column`；结果截断时按返回位置继续，不把摘要当契约。不加开关和 Python API 的默认结果保持兼容。开发路由返回的 `skills/...` 原版资料路径，使用 source 解析为共享对象，不能拼成接收方本机路径。未唯一命中再用元数据或全文检索，不自动联网补猜。E9/E10、资料基线与现场契约分别标明；普通查询不启动登录工具。

## E9/E10 统一字典

```text
python3 "<包目录>/scripts/knowledge_lookup.py" dictionary search "表单字段" --platform E10
python3 "<包目录>/scripts/knowledge_lookup.py" dictionary find-column "创建人" --platform E10 --limit 10
python3 "<包目录>/scripts/knowledge_lookup.py" dictionary load form_field --database formreport --source ecode-toolkit
python3 "<包目录>/scripts/knowledge_lookup.py" dictionary load form_field --database project
python3 "<包目录>/scripts/knowledge_lookup.py" dictionary load workflow_requestbase --platform E9
```

统一结构索引覆盖原版 E10 JSON、本地 E10 单表 Markdown、E9 标准 HTML 字典；只保存名称、标签和正文定位，不复制完整字段正文。`load` 回读所选来源的全部字段，不连接客户数据库、不执行 SQL。旧的关系、枚举、约定以及非标准附件继续通过全文检索读取，不把字段索引当作全部数据库知识。

同名表有多份来源时返回 `ambiguous` 及候选，不能拼接字段或默认选择“更新”的一份。结合当前项目已确认的数据库和来源选择；仍有歧义时用 `--document-id <候选编号>` 明确回读，并将冲突保留为待现场确认项。支持 `--source`、`--version`、`--module` 过滤及 `--offset` 分页；`source_version` 是资料包标签，不等于客户平台基线。E9 来源未给数据库名时保持空值，不猜 `ecology`。

例如 `form_field` 在 `formreport` 与 `project` 两库的长度和字段数量不同，不能从表名推断数据库。结果中的空值不推断为允许、否或默认值；无字段明细、重复字段名、生命周期警告均需说明。值必须参数化，动态表/字段需同时按已核实字典及现场元数据白名单校验。未命中先切换表名、中文名、字段名及全文检索，不凭相似名称造表。提供给客户的引用不带私有链接、令牌或本机路径。
