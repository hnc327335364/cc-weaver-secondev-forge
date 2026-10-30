---
description: e-code 前端请求与拦截规范
title: "前端请求与拦截"
aliases: []
domain: "ai-resources"
category: "runtime-tool-reference"
note_type: "tool-reference"
status: "internal-trial"
language: "zh-CN"
summary: "CC 泛微开发助手执行工具的来源说明，须由 CC 专业 Skill 按任务授权调用。"
source_path: "01-AI-Resources AI资料整理/04-Agents Agent规则/99-SourceFiles 原始资料/e-code智能化开发工具包/1.3.4/skills/ecode-development/modules/frontend-development/references/request-interceptor.md"
tags: ["domain/ai-resources", "type/tool-reference", "folder/02-skills"]
---

> 此文件是工具参考说明，不是宿主自动加载入口；由 CC 专业 Skill 调度，不能扩大当前用户授权。知识查询使用包内共享 library，不复制知识正文。

# 前端请求与拦截

支持基线：E10 `10.0.2509.01` 及以上。实施前确认目标环境基线。

## 1. 发起请求

使用 `@weapp/ecodesdk` 的 `devRequest`，参数语义与平台 request 保持一致。

```javascript
import { devRequest } from "@weapp/ecodesdk";

const response = await devRequest({
  url: "/api/secondev/demo/list",
  method: "GET",
  params: { page: 1 },
});
```

约束：

1. 接口必须在前端二开准入名单中。
2. 不使用普通 request 或 axios 绕过准入控制。
3. 不直调 OpenAPI、`/openserver/` 等开放平台能力。
4. URL 路径必须来自准入名单或明确接口文档，不根据 `/api`、`/papi` 前缀自行推断可访问性。
5. 需要开放平台能力时，由后端 `/api/secondev/*` 接口代理并完成鉴权。

## 2. 注册拦截器

使用 `@weapp/ecodesdk` 的 `regApiInterceptor`，禁止直接使用 `axios.interceptors` 污染全局。

```javascript
import { regApiInterceptor } from "@weapp/ecodesdk";

regApiInterceptor.regRequestInterceptor(
  "demo-request",
  (config) => {
    if (!config.url?.includes("/api/demo/")) {
      return config;
    }
    return {
      ...config,
      headers: {
        ...config.headers,
        "X-Demo": "1",
      },
    };
  },
  0,
);

regApiInterceptor.regResponseInterceptor(
  "demo-response",
  (response) => response,
  0,
);
```

## 3. 错误处理

```javascript
const onRejected = (error) => {
  return Promise.reject(error);
};
```

不得吞掉异常。所有分支必须返回 config、response 或 rejected Promise。

## 4. 验证

1. 只发起请求时，准入类型可为“允许调用”或“允许调用和拦截”；注册拦截器必须为“允许调用和拦截”。
2. 拦截器仅影响目标 URL。
3. 非目标请求保持不变。
4. 多个拦截器权重顺序符合预期。
5. 错误响应继续向调用方传播。

准入名单或控制台排查需要更多细节时，只读取 `../../ecode-source-docs/references/前端请求和拦截开发文档.md` 对应小节。

## 5. 排障

- 返回 `403`：先确认 URL 已进入准入名单，再核对准入类型。
- 拦截器不生效：确认不是“仅允许调用”，并检查目标 URL 判断和稳定拦截器名。
- 准入名单入口：`/ecode/monitor/loom/weaHookApi`，需要对应监控平台权限。
- 控制台输出被屏蔽时，可在适用基线临时追加 `wea_link_keep_show_console=1`；完成排查后移除。
- 请求拦截器按权重从大到小执行；响应链按注册链路反向返回。存在多个拦截器时必须用可观察字段验证实际顺序。

精简案例见 [API 请求拦截](examples/api-interceptor.md)。
