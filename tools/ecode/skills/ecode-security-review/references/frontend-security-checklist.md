---
title: "前端安全漏洞防御检查清单"
aliases: []
domain: "ai-resources"
category: "runtime-tool-reference"
note_type: "tool-reference"
status: "internal-trial"
language: "zh-CN"
summary: "CC 泛微开发助手执行工具的来源说明，须由 CC 专业 Skill 按任务授权调用。"
source_path: "01-AI-Resources AI资料整理/04-Agents Agent规则/99-SourceFiles 原始资料/e-code智能化开发工具包/1.3.4/skills/ecode-security-review/references/frontend-security-checklist.md"
tags: ["domain/ai-resources", "type/tool-reference", "folder/02-skills"]
---

> 此文件是工具参考说明，不是宿主自动加载入口；由 CC 专业 Skill 调度，不能扩大当前用户授权。知识查询使用包内共享 library，不复制知识正文。

# 前端安全漏洞防御检查清单

## 目录

- [XSS 与输出编码](#1-xss-与输出编码)
- [敏感数据与凭据管理](#2-敏感数据与凭据管理)
- [CSRF 与请求安全](#3-csrf-与请求安全)
- [客户端授权与路由安全](#4-客户端授权与路由安全)
- [代码执行与注入防护](#5-代码执行与注入防护)
- [postMessage 与 iframe](#6-postmessage-与-iframe-安全)
- [CSS 与样式安全](#7-css-与样式安全)
- [CSP 与浏览器安全头](#8-csp-与浏览器安全头)
- [第三方资源与供应链](#9-第三方资源与供应链安全)
- [Cookie 与存储](#10-cookie-与存储安全)
- [WebSocket](#11-websocket-与实时通信)
- [文件上传与下载](#12-文件上传与下载)
- [错误处理与调试](#13-错误处理与调试安全)
- [SSR](#14-ssr-与初始状态安全)
- [OAuth/OIDC](#15-oauthoidc-与-sso)
- [Trusted Types](#16-trusted-types-与-dom-sink)
- [DOM Clobbering](#17-dom-clobbering)
- [Service Worker](#18-service-worker-与缓存)
- [请求凭据边界](#19-axiosfetch-请求凭据边界)
- [客户端资源限制](#20-客户端资源限制)
- [下载与导出](#21-下载与导出安全)
- [第三方数据边界](#22-第三方脚本与数据边界)

## 使用方法

对每项填写 `PASS / FAIL / N/A / UNVERIFIED`，并附代码位置、配置、测试报告或运行证据。`FAIL` 以及高风险项的 `UNVERIFIED` 阻断发布。`N/A` 必须说明不可达原因。

## 1. XSS 与输出编码

- [ ] `FE-001` React 应用中 `dangerouslySetInnerHTML` 的每个使用点均有 DOMPurify 净化和允许列表配置，并有负面测试。
- [ ] `FE-002` Vue 应用中 `v-html` 的每个使用点均有 DOMPurify 净化和允许列表配置，并有负面测试。
- [ ] `FE-003` 不使用 `element.innerHTML`、`outerHTML`、`insertAdjacentHTML`、`document.write` 处理不可信数据。
- [ ] `FE-004` 用户可控的 `href`、`src`、`action` 属性值经过 URL 协议校验，拒绝 `javascript:`、`data:`、`vbscript:`。
- [ ] `FE-005` 自定义 Vue 指令不使用 `el.innerHTML` 写入不可信数据。
- [ ] `FE-006` Markdown 渲染器配置了 HTML 净化（如 `rehype-sanitize`），不使用 `marked` + `dangerouslySetInnerHTML`。
- [ ] `FE-007` 富文本编辑器输出在渲染前经过 DOMPurify 净化，不信任编辑器自身的过滤。
- [ ] `FE-008` `target="_blank"` 的外部链接至少添加 `rel="noopener"`；是否添加 `noreferrer` 按 Referrer-Policy 决定。

## 2. 敏感数据与凭据管理

- [ ] `FE-101` 认证 Token 不存储在 `localStorage` 或 `sessionStorage`；优先使用 `httpOnly` Cookie。
- [ ] `FE-102` 前端源码中无硬编码的 API Key、Secret Key、JWT 签名密钥或加密密钥。
- [ ] `FE-103` `REACT_APP_*` 或 `VITE_*` 环境变量不存储不应暴露给浏览器的秘密。
- [ ] `FE-104` MobX/Redux/Context 状态中不存储密码、密钥、完整支付卡号等高度敏感数据。
- [ ] `FE-105` 生产日志、控制台和遥测不包含凭据、个人信息、完整请求/响应或内部错误对象。
- [ ] `FE-106` Source Map 不含秘密或生产配置；公开发布是明确风险决策，私有 Source Map 受访问控制。
- [ ] `FE-107` `.env` 文件不在版本控制中，`.env.example` 不包含真实秘密。
- [ ] `FE-108` CI/CD 流程中执行秘密扫描，检测前端源码和构建产物中的泄露秘密。

## 3. CSRF 与请求安全

- [ ] `FE-201` 基于 Cookie 认证的状态变更请求携带 CSRF Token。
- [ ] `FE-202` axios 请求拦截器自动添加 CSRF Token 到请求头。
- [ ] `FE-203` 不使用 GET/HEAD/OPTIONS 方法执行状态变更操作。
- [ ] `FE-204` axios 全局超时已配置。
- [ ] `FE-205` 跨域请求的 CORS 后端配置使用精确 Origin 允许列表，不使用 `*` + `credentials: true`。
- [ ] `FE-206` CSRF Token 不长期存储在 `localStorage`；Synchronizer Token 来自受控响应，Double Submit Cookie 需要前端读取时不设置 `HttpOnly`，并使用签名/会话绑定。

## 4. 客户端授权与路由安全

- [ ] `FE-301` 所有授权检查在后端执行；前端路由守卫仅用于 UX 优化。
- [ ] `FE-302` 前端权限判断使用从后端获取的权限列表，不硬编码角色到权限的映射。
- [ ] `FE-303` 不把动态导入、代码分包、混淆、路由守卫或菜单隐藏当作授权或保密控制。
- [ ] `FE-304` 嵌套路由权限检查只用于 UX；每个后端操作仍执行独立对象级和租户级授权。
- [ ] `FE-305` 路由参数（`:id`）在用于 API 请求前做格式和范围校验。
- [ ] `FE-306` 对象不存在与无权限的响应策略基于枚举风险，且不返回未授权对象详情。
- [ ] `FE-307` 重定向目标经过校验，拒绝协议相对 URL（`//evil.com`）和站外 URL。
- [ ] `FE-308` 登录后回跳 URL 使用白名单域名或路径匹配。

## 5. 代码执行与注入防护

- [ ] `FE-401` 不使用 `eval()` 处理不可信数据。
- [ ] `FE-402` 不使用 `new Function()` 从不可信数据创建函数。
- [ ] `FE-403` `setTimeout` 和 `setInterval` 使用函数引用，不使用字符串参数。
- [ ] `FE-404` 不将不可信数据作为 Vue 模板字符串编译。
- [ ] `FE-405` 不将不可信数据作为 React 组件名或 JSX 标签名。
- [ ] `FE-406` JSON 解析使用 `JSON.parse()`，不使用 `eval`。
- [ ] `FE-407` 对象合并操作防御原型污染（过滤 `__proto__`、`constructor`、`prototype`）。
- [ ] `FE-408` `lodash`、`immer` 等库的版本无已知原型污染漏洞。

## 6. postMessage 与 iframe 安全

- [ ] `FE-501` `postMessage` 接收端校验 `event.origin`，使用精确 origin 允许列表。
- [ ] `FE-502` `postMessage` 发送端使用精确 `targetOrigin`，不使用 `*`。
- [ ] `FE-503` 消息体使用结构化格式（对象 + `type` 字段），不传字符串命令名。
- [ ] `FE-504` iframe 嵌入第三方内容时使用 `sandbox` 属性限制能力。
- [ ] `FE-505` iframe 添加 `referrerpolicy="no-referrer"` 防止 referer 泄露。

## 7. CSS 与样式安全

- [ ] `FE-601` 不可信数据不直接作为 `style` 属性值或 `<style>` 标签内容。
- [ ] `FE-602` 样式值使用对象语法，仅允许用户控制特定安全属性。
- [ ] `FE-603` CSS `url()` 函数不引用用户可控 URL。
- [ ] `FE-604` 颜色值校验格式（`#RRGGBB`、`rgb()`、命名颜色）。

## 8. CSP 与浏览器安全头

- [ ] `FE-701` 生产环境通过 HTTP 响应头设置 CSP。
- [ ] `FE-702` CSP `script-src` 不使用 `unsafe-inline`（使用 `nonce` 或 `hash` 替代）。
- [ ] `FE-703` CSP `script-src` 不使用 `unsafe-eval`。
- [ ] `FE-704` CSP 不使用 `default-src *` 或 `script-src *`。
- [ ] `FE-705` CSP 通过 HTTP 头设置（非仅 `<meta>` 标签）。
- [ ] `FE-706` 有运营能力时配置 `Reporting-Endpoints`/`report-to`；报告被监控、限流并作为不可信输入处理。
- [ ] `FE-707` `X-Frame-Options: DENY` 或 CSP `frame-ancestors` 已设置。
- [ ] `FE-708` 敏感操作页面设置 `frame-ancestors 'none'`。
- [ ] `FE-709` `X-Content-Type-Options: nosniff` 已设置。
- [ ] `FE-710` `Referrer-Policy` 已设置（如 `strict-origin-when-cross-origin`）。
- [ ] `FE-711` HSTS 已启用（`Strict-Transport-Security`）。

## 9. 第三方资源与供应链安全

- [ ] `FE-801` 内容固定的第三方脚本添加 SRI；动态脚本无法使用 SRI 时具备隔离、数据最小化、严格 CSP、变更监控和审批。
- [ ] `FE-802` 不从 `polyfill.io` 或关联域名加载 polyfill。
- [ ] `FE-803` polyfill 通过 npm 包（如 `core-js`）引入，而非 CDN。
- [ ] `FE-804` CDN 引入的脚本使用受信任来源并固定版本号。
- [ ] `FE-805` 依赖使用 `package-lock.json` 或 `yarn.lock` 锁定版本。
- [ ] `FE-806` 定期执行 `npm audit` 或使用 Snyk/Dependabot 扫描漏洞。
- [ ] `FE-807` 依赖漏洞按可利用性、暴露面、数据影响和组织 SLA 处置；已知被利用且影响当前路径的问题阻断发布。
- [ ] `FE-808` CI/CD 使用 `npm ci` 安装依赖。
- [ ] `FE-809` CI 使用锁文件和完整性摘要；不存在无锁安装的 `latest`、`*` 或宽泛漂移。
- [ ] `FE-810` 审计 `preinstall`/`postinstall` 脚本的安全性。

## 10. Cookie 与存储安全

- [ ] `FE-901` 前端创建的 Cookie 设置 `Secure` 和 `SameSite`。
- [ ] `FE-902` Cookie 的 `Path` 限定到最小必要范围。
- [ ] `FE-903` 敏感 Cookie 由后端设置 `httpOnly`，前端不直接读取。
- [ ] `FE-904` Cookie 中不包含密码、完整支付信息等敏感数据。
- [ ] `FE-905` `localStorage`/`sessionStorage` 中不存储 Token、密钥或密码。
- [ ] `FE-906` 状态持久化（`mobx-persist`、`redux-persist`）不持久化敏感字段。

## 11. WebSocket 与实时通信

- [ ] `FE-1001` 生产环境 WebSocket 使用 `wss://` 连接。
- [ ] `FE-1002` WebSocket 使用安全会话 Cookie 或短期单次票据认证；长期 Token 不进入查询参数。
- [ ] `FE-1003` WebSocket 消息做输入验证，消息体使用结构化格式。
- [ ] `FE-1004` 组件卸载时关闭 WebSocket 连接。
- [ ] `FE-1005` WebSocket 设置心跳和重连退避策略。

## 12. 文件上传与下载

- [ ] `FE-1101` 前端文件检查只作 UX；服务端重新识别内容、限制大小/数量并执行权威校验。
- [ ] `FE-1102` 文件大小有上限校验。
- [ ] `FE-1103` 大文件使用分片上传，不一次性读入内存。
- [ ] `FE-1104` 前端按纯文本显示文件名；服务端负责重命名、路径规范化和隔离存储。
- [ ] `FE-1105` 图片预览使用 `URL.createObjectURL()` 而非 base64，预览后 `revokeObjectURL()`。

## 13. 错误处理与调试安全

- [ ] `FE-1201` 生产环境错误提示使用通用用户友好消息，不展示堆栈、SQL、内部路径。
- [ ] `FE-1202` Error Boundary 的 fallback UI 不展示技术细节。
- [ ] `FE-1203` API 错误响应处理做字段过滤，仅展示用户可理解的错误消息。
- [ ] `FE-1204` 安全敏感 Promise 在调用边界处理拒绝；全局 `unhandledrejection` 仅作脱敏告警，不替代业务处理。
- [ ] `FE-1205` 错误上报使用关联 ID（traceId），不传输敏感数据。

## 14. SSR 与初始状态安全

- [ ] `FE-1301` SSR 初始状态中不包含敏感数据（Token、密码、密钥）。
- [ ] `FE-1302` 初始状态 JSON 序列化时防御 `</script>` 注入。
- [ ] `FE-1303` SSR 渲染的 HTML 对用户可控内容使用框架自动转义。
- [ ] `FE-1304` SSR 应用中 `process.env` 的使用区分服务端和客户端。
- [ ] `FE-1305` SSR 的 CSP nonce 在每次请求时生成。

## 15. OAuth、OIDC 与 SSO

- [ ] `FE-1401` SPA 使用 Authorization Code + PKCE S256，不使用 Implicit Grant。
- [ ] `FE-1402` 每次授权事务生成并验证高熵 `state`、PKCE verifier/challenge；OIDC 同时验证 `nonce`。
- [ ] `FE-1403` 精确校验回调 URI、issuer、audience、签名和时效，授权码不可重放。
- [ ] `FE-1404` Client Secret、Access Token 和 Refresh Token 不进入前端 URL、bundle、日志、Referer 或分析事件。
- [ ] `FE-1405` 回调完成后清理 URL 和事务临时状态，并测试错误 issuer、错误 state、PKCE 降级与开放回跳。

## 16. Trusted Types 与 DOM sink

- [ ] `FE-1501` 已盘点 `innerHTML`、`dangerouslySetInnerHTML`、`v-html`、脚本 URL 等危险 sink。
- [ ] `FE-1502` Trusted Types policy 集中、命名、可审计，不存在返回原始字符串的宽松 default policy。
- [ ] `FE-1503` CSP 限制可创建 policy，并逐步启用 `require-trusted-types-for 'script'`。
- [ ] `FE-1504` Trusted Types 未被当成 HTML 清洗、上下文编码或 CSP 的替代品。
- [ ] `FE-1505` 负面测试覆盖普通字符串写 sink、policy 绕过和清洗后再拼接。

## 17. DOM Clobbering

- [ ] `FE-1601` 安全配置、URL、Token 和函数不通过 `window.name`、命名表单属性或 DOM 全局变量读取。
- [ ] `FE-1602` 不可信 HTML 的 `id`/`name` 被过滤或前缀化，不可覆盖安全关键属性。
- [ ] `FE-1603` DOM 查询结果校验节点类型、来源和预期容器。
- [ ] `FE-1604` 用户可控键使用 `Map`、无原型对象或固定允许列表。

## 18. Service Worker 与缓存

- [ ] `FE-1701` Worker 脚本和 scope 固定、同源、可追溯，CSP `worker-src` 精确限制。
- [ ] `FE-1702` Service Worker 不动态执行不可信脚本，不缓存 `no-store`、凭据或个人敏感响应。
- [ ] `FE-1703` 用户/租户/权限相关缓存隔离，并在注销、切换租户和撤权时清除。
- [ ] `FE-1704` 缓存前验证方法、最终 URL、Origin、状态、响应类型、Content-Type 和大小。
- [ ] `FE-1705` Cache Storage 版本化，激活阶段只删除本应用明确拥有的旧缓存。

## 19. axios/fetch 请求凭据边界

- [ ] `FE-1801` axios `baseURL`、fetch URL 和代理目标不由不可信输入控制。
- [ ] `FE-1802` 最终 URL 使用 `URL` 规范化并精确校验 protocol、origin 和路径。
- [ ] `FE-1803` Authorization、CSRF、Cookie 和签名只发送到批准 Origin；跨 Origin 时显式剥离。
- [ ] `FE-1804` API client 按信任域拆分，`withCredentials`/`credentials: include` 不做全局宽开。
- [ ] `FE-1805` 超时、取消、响应 Content-Type、schema 和业务大小上限均有验证。

## 20. 客户端资源限制

- [ ] `FE-1901` 不可信输入处理具备字符串、数组、深度、DOM、并发、重试、缓存和时间硬上限。
- [ ] `FE-1902` 正则不存在灾难性回溯，最坏输入有测试或严格短输入上限。
- [ ] `FE-1903` 不使用无界 `Promise.all`、定时器、重连、MobX reaction 或 React effect。
- [ ] `FE-1904` 大列表分页/虚拟化，异步任务有有界并发、取消和卸载清理。
- [ ] `FE-1905` Worker 仅改善可用性，不被当成不可信代码沙箱。

## 21. 下载与导出安全

- [ ] `FE-2001` CSV/表格导出防公式注入，并按目标办公软件验证转义策略。
- [ ] `FE-2002` Blob 内容类型和大小受限；不可信 HTML/SVG 不在同源上下文直接打开。
- [ ] `FE-2003` Blob URL 在完成、卸载或超时后撤销，敏感下载链接短期、单次、授权绑定。
- [ ] `FE-2004` 服务端设置可信 Content-Type、Content-Disposition、`nosniff`、授权和缓存策略。
- [ ] `FE-2005` 测试 CR/LF 文件名、活动内容、超大 Blob、撤权重放和对象 URL 释放。

## 22. 第三方脚本与数据边界

- [ ] `FE-2101` 第三方脚本、Tag Manager 和远程组件只读取字段允许列表 data layer。
- [ ] `FE-2102` 第三方不读取 Token、敏感表单、完整 DOM、URL 参数或全局 MobX 状态。
- [ ] `FE-2103` 优先服务端转发或独立 Origin sandbox iframe；权限由 CSP、Permissions Policy、iframe `allow` 和 `sandbox` 最小化。
- [ ] `FE-2104` 脚本固定版本/内容，使用自托管或 HTTPS + SRI + CSP，并监控内容变化。
- [ ] `FE-2105` Tag Manager 关闭任意自定义脚本，配置变更具备最小权限、审批和审计。

## 审查结论模板

| 状态 | 数量 | 说明 |
|---|---:|---|
| PASS |  | 证据充分 |
| FAIL |  | 阻断发布 |
| N/A |  | 逐项写明原因 |
| UNVERIFIED |  | 高风险项按阻断处理 |

最终结论：`PASS / CONDITIONAL / BLOCK`

阻断项：

1. `[检查 ID] 位置 — 证据 — 风险 — 必需修复`

发布前验证：

1. `测试/扫描 — 负责人 — 通过标准`
