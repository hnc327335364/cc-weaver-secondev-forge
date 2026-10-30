---
name: weaver-cc-performance-review
description: 对前端或Java/JVM代码做静态性能审查，绑定制品与规则并验证结果；不伪造吞吐、P95、GC或浏览器实测指标。
metadata:
  title: "CC 性能审查"
  aliases: "CC 性能审查"
  domain: "ai-resources"
  category: "skill"
  note_type: "skill"
  status: "internal-trial"
  language: "zh-CN"
  summary: "对前端或Java/JVM代码做静态性能审查，绑定制品与规则并验证结果；不伪造吞吐、P95、GC或浏览器实测指标。"
  source_path: "skills/weaver-cc-performance-review/MODULE.md"
  tags: "domain/ai-resources,type/skill,folder/02-skills"
---

# CC 性能审查

先读 [性能审查工作流](../../tools/ecode/skills/ecode-performance-review/TOOL-REFERENCE.md)，只加载当前语言和范围的规则与审查契约。

```text
python3 "<包目录>/scripts/cc_tools.py" run performance -- prepare --stage FILE_SAVE --artifact "<源码文件>" --out "<新快照.json>"
python3 "<包目录>/scripts/cc_tools.py" run performance -- validate --output "<审查结果.json>" --input "<快照.json>" --artifact "<源码文件>"
```

由AI基于实际源码判断高频路径、循环、远程调用、缓存、资源和渲染风险；工具建立证据快照并验证报告，不代替性能测量。不要只凭方法名、一次初始化或所有循环判定风险。平台准入策略与已证明性能问题分开，不编造百分比或并发指标。

快照与报告写到用户指定位置，不改被审查代码；项目完整性未确认不传 --complete true。按 schema 1.1 保存结果并实际运行 validate，再向人员给中文摘要。没有客户压测或运行证据就保留 STATIC_ONLY 和待验证项。需要修复时另按用户授权进入开发模块。
