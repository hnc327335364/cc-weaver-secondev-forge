---
title: "前后端安全边界规则"
aliases: []
domain: "ai-resources"
category: "runtime-tool-reference"
note_type: "tool-reference"
status: "internal-trial"
language: "zh-CN"
summary: "CC 泛微开发助手执行工具的来源说明，须由 CC 专业 Skill 按任务授权调用。"
source_path: "01-AI-Resources AI资料整理/04-Agents Agent规则/99-SourceFiles 原始资料/e-code智能化开发工具包/1.3.4/skills/ecode-security-review/references/fullstack-security-boundaries.md"
tags: ["domain/ai-resources", "type/tool-reference", "folder/02-skills"]
---

> 此文件是工具参考说明，不是宿主自动加载入口；由 CC 专业 Skill 调度，不能扩大当前用户授权。知识查询使用包内共享 library，不复制知识正文。

# 前后端安全边界规则

## 目录

- [FSB-001 身份与会话归属](#fsb-001-身份与会话归属)
- [FSB-002 授权与租户边界](#fsb-002-授权与租户边界)
- [FSB-003 CSRF、CORS 与浏览器凭据](#fsb-003-csrfcors-与浏览器凭据)
- [FSB-004 输入、输出与数据最小化](#fsb-004-输入输出与数据最小化)
- [FSB-005 OAuth、OIDC 与 SSO 回调](#fsb-005-oauthoidc-与-sso-回调)
- [FSB-006 文件上传、预览与下载](#fsb-006-文件上传预览与下载)
- [FSB-007 WebSocket、SSE 与异步消息](#fsb-007-websocketsse-与异步消息)
- [FSB-008 代理、网关与安全响应头](#fsb-008-代理网关与安全响应头)
- [FSB-009 错误、日志与可观测性](#fsb-009-错误日志与可观测性)
- [FSB-010 发布证据与失败关闭](#fsb-010-发布证据与失败关闭)

## 使用原则

这些规则只在数据或信任跨越浏览器、网关、应用服务、RPC、中间件或存储边界时加载。前端控制不能替代后端控制；网关控制不能替代服务层对象授权；内网位置不能替代服务身份。

## FSB-001 身份与会话归属

- 认证凭据由服务端或受控身份系统签发、验证、轮换和撤销；浏览器不生成可信身份、角色或租户。
- 优先使用 `Secure`、`HttpOnly`、恰当 `SameSite`、最小 `Domain/Path` 的会话 Cookie 或 BFF。SPA 必须使用 Token 时，长期 Refresh Token 不进入 JavaScript 可读持久存储。
- 登录、注销、改密、权限提升、账号禁用和风险事件的会话失效必须有服务端证据。

## FSB-002 授权与租户边界

- 每个服务端请求和 Dubbo/RPC 操作验证主体、动作、对象、租户和数据范围。
- 前端路由守卫、按钮隐藏、MobX 状态、网关路由、IP 白名单和 Nacos 注册信息只作辅助，不能作为唯一授权。
- ID、用户 ID、组织 ID、租户 ID、角色、价格、状态和所有者字段来自客户端时一律不可信；数据库查询或策略层必须绑定可信上下文。

## FSB-003 CSRF、CORS 与浏览器凭据

- Cookie 或其他浏览器自动附带凭据保护的状态变更操作必须验证 CSRF Token；安全方法保持只读。
- CORS 使用精确 Origin、方法和请求头允许列表，但 CORS 不提供非浏览器调用方授权。
- axios/fetch 的 `withCredentials`/`credentials` 只能对批准 Origin 开启；跨 Origin 跳转或动态 URL 不得携带 Authorization、Cookie 或 CSRF Token。

## FSB-004 输入、输出与数据最小化

- 后端按类型、长度、格式、枚举、状态和对象权限验证；前端验证只提供及时反馈。
- 后端响应采用字段允许列表和字段级授权；前端状态、缓存、错误上报和分析事件只保留必要字段。
- 不可信数据进入 HTML、URL、CSS、SQL、命令、表达式、模板、日志和响应头时，分别使用对应安全 API 与上下文控制。

## FSB-005 OAuth、OIDC 与 SSO 回调

- 浏览器客户端使用 Authorization Code + PKCE；拒绝 Implicit Grant。
- 每次事务生成并验证 `state`、PKCE verifier/challenge；OIDC 同时验证 `nonce`、issuer、audience、签名和时效。
- 回调地址精确登记；授权码由正确客户端、正确回调地址和正确 issuer 兑换。回跳目标使用固定标识或站内允许列表。
- Token、授权码和敏感错误不进入 URL、Referer、分析事件或日志。

## FSB-006 文件上传、预览与下载

- 前端类型、大小和扩展名检查只作 UX；服务端执行内容识别、大小/数量限制、重命名、隔离存储、授权和恶意内容处理。
- 预览富文本、SVG、HTML、PDF、Office 或媒体文件时采用隔离 Origin、下载策略、沙箱或安全重编码。
- 下载通过授权对象 ID 定位，响应设置安全 `Content-Type`、`Content-Disposition`、`nosniff` 和缓存策略。

## FSB-007 WebSocket、SSE 与异步消息

- 握手验证可信 Origin、身份和会话；每条业务消息继续验证动作、对象和租户。
- 浏览器连接使用 `wss:`/HTTPS；不把长期 Token 放入查询参数。需要票据时使用短期、单次、受众受限票据。
- 客户端与服务端同时限制消息大小、频率、队列、重连、并发和处理时间。

## FSB-008 代理、网关与安全响应头

- 网关、反向代理、Tomcat/信创中间件和 Spring 对 Host、路径、方法、编码、Forwarded 头及消息边界的规范化必须一致。
- 只信任已知代理重写的 Forwarded 头；应用服务仍执行认证和授权。
- CSP、HSTS、`nosniff`、frame 限制、Referrer-Policy、缓存策略和必要的跨源隔离头在生产等价环境验证。

## FSB-009 错误、日志与可观测性

- 浏览器仅显示稳定错误码、用户消息和关联 ID；服务端日志不包含 Token、Cookie、密码、密钥、完整请求体或敏感响应。
- 前后端关联 ID 可追踪同一事务，但不能被客户端用于覆盖可信审计主体。
- 认证失败、授权拒绝、跨租户尝试、CSRF/CORS 拒绝、OAuth 异常、上传拒绝和高风险管理操作形成结构化审计与告警。

## FSB-010 发布证据与失败关闭

- 发布结论必须绑定当前源码、依赖锁、构建产物、配置、镜像/中间件版本和测试结果。
- 安全依赖、鉴权、策略、CSRF、签名、限流或审计不可用时，服务默认拒绝或停止启动，不返回伪成功。
- 缺少另一侧证据时标记 `UNVERIFIED`；高风险边界按 `BLOCK`，不得用“由其他团队负责”替代证据。

## 基线来源

- [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/)
- [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [OWASP OAuth2 Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/OAuth2_Cheat_Sheet.html)
- [OAuth 2.0 Security Best Current Practice, RFC 9700](https://datatracker.ietf.org/doc/html/rfc9700)
- [Spring Security CSRF](https://docs.spring.io/spring-security/reference/servlet/exploits/csrf.html)

