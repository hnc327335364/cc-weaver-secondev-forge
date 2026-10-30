---
title: "双平台发布模拟验证"
aliases: []
domain: "ai-resources"
category: "release-validation"
note_type: "verification-record"
status: "internal-trial"
language: "zh-CN"
summary: "发版说明与双平台上传一致性的真实本地HTTP模拟验证"
source_path: "01-AI-Resources AI资料整理/02-Skills 技能/CC泛微开发助手/发布维护/tests/release.context.md"
tags: ["domain/ai-resources", "type/validation", "folder/02-skills"]
---
# 双平台发布模拟验证

## Purpose

验证实际 `publish.py` 对两端发行接口的请求与失败处理，不替换被测发布函数。GitHub 依据官方 REST Releases 文档，Gitee 依据官方 `/api/v5/doc_json` 的 v5.4.93 合同；未登录 Postman，未搜索供应方工作区 mock。只模型化本工具使用的路径，其他路径返回 501。

## Execution

从发布维护目录，在一个终端运行 `postman simulation run tests/release.sim.yaml --port 4900 --no-history --output ndjson`，确认 listening 事件端口为 4900；另一终端运行 `PYTHONDONTWRITEBYTECODE=1 python3 tests/test_publish.py`。检查两个 routeKey 的 request 事件，完成后在服务器终端 Ctrl+C 停止。只使用临时微型 ZIP 和虚构令牌，不制作分发包。

## Assumptions

2026-10-30：Postman CLI 1.75.0；本机监听需环境授权。模型使用进程内状态和 Node 原始二进制流解析 multipart；不模拟线上限流、所有重定向、平台权限及存储配额。Gitee 线上 Bearer 认证与私有仓库读取另已验证，上传仍待真实制品核验。

## Observations

<!-- begin:observations -->
2026-10-30：13 项测试通过；GitHub 54 次、Gitee 53 次真实本地 HTTP 请求，均非静默依赖。说明缺失/内容变化、上传失败和回下载损坏按预期阻断；重复上传不产生重复附件；无需手工ZIP也可创建源码发行。见 validation.json。本地结果不证明线上发布成功。
<!-- end:observations -->

## What didn't work

2026-10-30：首次真实源码推送超过旧300秒上限，远端仍为空；推送时限改为1800秒并增加进程组清理，3项本地命令回归通过。真实上传结果另记，不能由模拟推断。

2026-10-30：本 CLI 的模拟成员 path 传目录报错，改为指向 config.yaml 后通过；受限环境监听出现 EPERM，按授权启动本机测试后通过。
