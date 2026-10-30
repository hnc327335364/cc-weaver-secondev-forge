---
title: "基础设施场景规范卡"
aliases: []
domain: "ai-resources"
category: "runtime-tool-reference"
note_type: "tool-reference"
status: "internal-trial"
language: "zh-CN"
summary: "CC 泛微开发助手执行工具的来源说明，须由 CC 专业 Skill 按任务授权调用。"
source_path: "01-AI-Resources AI资料整理/04-Agents Agent规则/99-SourceFiles 原始资料/e-code智能化开发工具包/1.3.4/skills/ecode-development/modules/e10-backend-sdk/references/infrastructure-patterns.md"
tags: ["domain/ai-resources", "type/tool-reference", "folder/02-skills"]
---

> 此文件是工具参考说明，不是宿主自动加载入口；由 CC 专业 Skill 调度，不能扩大当前用户授权。知识查询使用包内共享 library，不复制知识正文。

# 基础设施场景规范卡

先确认完整 E10 基线、模块依赖、项目已有封装与平台原文。以下是决策与验收要求，不是统一跨版本 Java 模板。每次只加载 [platform-sdk.md](platform-sdk.md) 的对应章节，再核验真实类、方法和配置。

| 场景 | 原文章节 | 决策与验收 |
|---|---|---|
| 标准服务调用 | 3.2.6 | 优先业务 API；核验签名、模块依赖、调用方、错误返回，按需要传用户/租户 |
| Redis/缓存 | 3.2.8 | 优先平台缓存封装；键归属、租户隔离、TTL、失效、序列化与故障降级明确。原文给出 SECONDEV_ 键前缀与 BaseCache 示例；实际接口须匹配依赖 |
| 特殊 Redis 操作 | 3.2.8 末段 | 原文称 setnx/Hash/set 可用 redisTemplate；仅为候选，不能推定具体 Bean、泛型、序列化或分布式锁语义 |
| DB | 查询选择参考卡 | 标准业务 API 优先；再按版本核验数据源/绑定/事务；字典门禁独立执行 |
| MQ Queue/Topic | 3.2.9 | 明确单消费者或广播、消息契约、幂等键、重试/失败处置、超时、顺序要求；实际确认/重投语义需来源，不臆造 exactly-once |
| 定时任务 | 3.2.4 | 仅原文入口不足以证明具体调度 API；核验注册、并发/重复执行、超时、停止与失败处置 |
| 锁/线程池 | 3.2.12 | 使用已证实的平台能力，核验超时、释放、任务上下文与资源清理；不新建无限线程或全局静态状态 |
| 配置/日志 | 3.2.7、3.2.12 | 使用项目既有机制；区分环境配置与秘密，日志脱敏，不记录 Cookie/token、敏感参数 |

缓存不要替代事务或业务权限检查；MQ 消费不能假设请求线程的当前用户/租户仍存在。是否需要上下文由实际调用契约决定；不得把租户字段机械添加到所有数据结构。

交付前列明：已加载证据、目标依赖/签名、超时与容量、幂等/重试边界、资源清理、故障日志、回滚与验证。缺基线、签名、配置或安全语义时停止对应实现，不用 TODO 或泛用 Java 代码伪装平台适配。编译/单测与真实 Redis/DB/MQ 集成分别记录；未连接环境记 `UNVERIFIED`。
