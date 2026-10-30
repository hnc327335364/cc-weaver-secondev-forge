---
title: "前端性能审核规则"
aliases: []
domain: "ai-resources"
category: "runtime-tool-reference"
note_type: "tool-reference"
status: "internal-trial"
language: "zh-CN"
summary: "CC 泛微开发助手执行工具的来源说明，须由 CC 专业 Skill 按任务授权调用。"
source_path: "01-AI-Resources AI资料整理/04-Agents Agent规则/99-SourceFiles 原始资料/e-code智能化开发工具包/1.3.4/skills/ecode-performance-review/references/frontend-performance-rules.md"
tags: ["domain/ai-resources", "type/tool-reference", "folder/02-skills"]
---

> 此文件是工具参考说明，不是宿主自动加载入口；由 CC 专业 Skill 调度，不能扩大当前用户授权。知识查询使用包内共享 library，不复制知识正文。

# 前端性能审核规则

## 目录

- [执行约定](#执行约定)
- [执行元数据](#执行元数据)
- [请求与副作用](#请求与副作用)
- [渲染与状态](#渲染与状态)
- [DOM、事件与资源](#dom事件与资源)
- [数据、脚本与 CSS](#数据脚本与-css)
- [React 扩展规则](#react-扩展规则)
- [Vue 扩展规则](#vue-扩展规则)
- [e-code 平台扩展规则](#e-code-平台扩展规则)
- [DOM 与 CSS 扩展规则](#dom-与-css-扩展规则)
- [前端制品与构建规则](#前端制品与构建规则)
- [新增规则测试矩阵](#新增规则测试矩阵)
- [修复示例](#修复示例)

## 执行约定

- 适用范围：React、Vue、JavaScript、JSX、TS/TSX、CSS 及前端源码。编译产物缺少可定位语义时，不猜测源码级性能问题。
- 能从源码证明会形成请求风暴、无限反馈、资源泄漏或主线程长时间阻塞的规则为 `ERROR`；依赖数据规模、交互频率或浏览器测量确认的规则为 `WARN`。
- 报告组件、Hook/composable、事件或请求的触发链。仅出现某 API 名称不足以命中。
- 对 Vue 同时检查 Options API、Composition API；对 React 同时检查函数组件、Hooks 和 class 生命周期。
- `stages` 缩写：`FS`=`FILE_SAVE`，`PI`=`PROJECT_IMPORT`，`PM`=`PROJECT_MIGRATION`，`PR`=`PROJECT_RELEASE`。源码规则默认适用全部阶段；制品规则只适用 `PI/PM/PR`。
- 每个命中必须引用最短可定位源码、CSS、构建清单或制品统计证据。表中“修复要求”是 `remediation` 与 `fixExample` 的生成依据；示例必须使用当前 React/Vue/e-code 上下文。

## 执行元数据

下表覆盖本文件每个规则。`appliesTo` 是必需证据类型；`mode` 定义见 `../TOOL-REFERENCE.md`。

| 规则范围 | appliesTo | stages | mode | 必需证据 |
|---|---|---|---|---|
| `PERF-FE-001`～`PERF-FE-021` | React/Vue/JS/CSS 源码 | FS/PI/PM/PR | HYBRID | 组件、Hook/composable、事件、请求或资源生命周期；明确 API 禁用模式可按 STATIC 处理 |
| `PERF-FE-022`～`PERF-FE-039` | React/Vue/JS/CSS/e-code 源码 | FS/PI/PM/PR | 以规则表为准 | 规则表要求的渲染、注册、DOM 或 CSS 上下文 |
| `PERF-ART-001`～`PERF-ART-005` | 构建清单/前端制品 | PI/PM/PR | DEPENDENCY | 文件、Chunk、依赖模块、体积及预算 |

## 请求与副作用

| 规则 ID | 等级 | 命中条件 | 排除条件 | 修复要求 |
|---|---|---|---|---|
| `PERF-FE-001` | ERROR | React render、Vue render/computed 或模板求值期间发请求、设置状态或产生副作用 | 无 | 移到 effect/lifecycle/action，并设置稳定触发条件 |
| `PERF-FE-002` | ERROR | `useEffect`/`watch` 依赖其内部更新的状态，形成可证明的反馈循环或重复请求 | 有显式收敛条件且代码可证明 | 拆分状态与副作用；使用稳定依赖和函数式更新 |
| `PERF-FE-003` | ERROR | 循环中逐项发 HTTP/RPC 请求，或逐项更新状态，且循环规模由输入/接口数据决定或无硬上限 | 代码可证明最多执行一次 | 使用批量接口；必要时有界并发并一次提交状态 |
| `PERF-FE-004` | ERROR | 轮询间隔过短、无停止条件、组件卸载后继续，或错误后立即无限重试 | 有明确停止、退避和清理 | 优先推送；否则设置下限、退避、可见性暂停和 cleanup |
| `PERF-FE-005` | WARN | 相互独立的请求被无必要串行执行 | 后续请求依赖前序结果 | 使用 `Promise.all`/`allSettled`，并保留错误与取消语义 |
| `PERF-FE-006` | WARN | 相同参数的请求在同一交互/生命周期重复发起，缺少去重、缓存或取消 | 明确需要强制刷新 | 请求去重、缓存、AbortController 或共享数据层 |

## 渲染与状态

| 规则 ID | 等级 | 命中条件 | 排除条件 | 修复要求 |
|---|---|---|---|---|
| `PERF-FE-007` | ERROR | React/Vue 状态、computed、watch 或组件更新形成无终止渲染/更新循环 | 有可证明的单次收敛条件 | 消除反馈依赖，分离派生状态与源状态 |
| `PERF-FE-008` | WARN | 列表无稳定 `key`，或用数组索引作为会增删重排列表的 key | 静态且永不重排列表 | 使用稳定业务 ID |
| `PERF-FE-009` | WARN | 每次渲染创建对象/数组/函数作为已 memo 子组件属性，导致 memo 失效 | 子组件未 memo 且成本可忽略 | 直接传稳定对象；必要时使用 `useMemo`/`useCallback`，不要盲目缓存 |
| `PERF-FE-010` | WARN | 大列表/表格一次渲染全部元素，无分页、分片或虚拟滚动 | 元素数量有严格小上限 | 分页、虚拟列表或增量渲染 |
| `PERF-FE-011` | WARN | render/computed 中重复执行排序、深拷贝、大 JSON 解析或 O(n²) 查找 | 数据规模有严格小上限且计算廉价 | 预计算、索引化、缓存派生结果或移到 Worker |
| `PERF-FE-012` | WARN | Vue 对大型对象使用深度 watch，或 watchEffect 依赖范围过宽 | 对象规模有严格小上限 | 监听精确字段，使用浅响应或拆分状态 |

## DOM、事件与资源

| 规则 ID | 等级 | 命中条件 | 排除条件 | 修复要求 |
|---|---|---|---|---|
| `PERF-FE-013` | ERROR | 定时器、事件监听、Observer、WebSocket 或需显式注销的订阅在卸载时未清理 | 生命周期由框架/库明确自动管理且有证据 | cleanup 中清理资源，并使用同一稳定 handler 引用 |
| `PERF-FE-014` | ERROR | 循环内交替读取布局并写 DOM/CSS，形成可证明的布局抖动 | 操作发生在脱离文档的 fragment 且批量提交 | 批量读后批量写，使用 class/fragment/requestAnimationFrame |
| `PERF-FE-015` | WARN | scroll、resize、mousemove、input 等高频事件直接执行重计算、请求或密集状态更新 | 处理函数仅做常量级轻量操作 | throttle/debounce；被动监听；减少状态更新 |
| `PERF-FE-016` | WARN | 在循环中反复 `querySelector`、逐个插入节点或重复计算样式 | 固定微小次数 | 缓存节点，使用 fragment/class 批量处理 |

## 数据、脚本与 CSS

| 规则 ID | 等级 | 命中条件 | 排除条件 | 修复要求 |
|---|---|---|---|---|
| `PERF-FE-017` | ERROR | 启动/首屏同步执行由外部数据决定且无硬上限的循环、JSON 解析、加密压缩或同类 CPU 密集任务 | 数据存在代码可证明的严格小上限 | 限制输入并分片、延迟加载、移到 Worker 或服务端预处理 |
| `PERF-FE-018` | WARN | 大型模块、编辑器、图表等无条件进入首屏依赖，或路由无懒加载 | 首屏核心功能且已有体积证据 | 动态 import、路由/组件懒加载并拆分包 |
| `PERF-FE-019` | WARN | 大图片/字体无尺寸约束、响应式资源或懒加载，或把大资源内联为 base64 | 小图标且内联收益明确 | 压缩并使用合适格式、尺寸、srcset、lazy loading |
| `PERF-FE-020` | WARN | CSS 使用过深后代选择器、通配符大范围匹配，或通过 JS 高频切换大量内联样式 | 作用域很小且可证明 | 缩短选择器、限定作用域、切换 class |
| `PERF-FE-021` | WARN | 大对象频繁深拷贝、全量持久化或跨组件重复序列化 | 数据规模有严格小上限 | 状态规范化、结构共享、增量更新和选择性持久化 |

## React 扩展规则

| 规则 ID | 等级 | mode | 命中条件 | 排除条件 | 必需证据 | 修复要求与示例 |
|---|---|---|---|---|---|---|
| `PERF-FE-022` | WARN | HYBRID | Context Provider 在每次 render 创建新对象/数组/函数，导致所有消费者随无关更新重渲染 | Provider 极小且消费者无性能敏感路径 | Provider value 表达式、父组件更新源和消费者范围 | 拆分 Context 并稳定 value；示例：`const value = useMemo(() => ({items}), [items])` |
| `PERF-FE-023` | WARN | STATIC | 在函数组件 render 内声明子组件，导致每次渲染产生新组件类型并重建子树 | 仅普通回调函数，未作为组件类型渲染 | 组件声明位置及 JSX 使用点 | 把子组件移到模块作用域；示例：`function Row(...) { ... }` 定义在 `Page` 外 |
| `PERF-FE-024` | WARN | STATIC | 在组件函数、render 或循环内调用 `React.lazy`，重复创建懒组件类型 | 模块顶层单次创建 | `React.lazy` 调用作用域和 JSX 使用点 | 移到模块顶层；示例：`const Panel = React.lazy(() => import('./Panel'))` |
| `PERF-FE-025` | WARN | HYBRID | `useState(expensive())`、render 内解析/索引构建等昂贵初始化在每次渲染执行 | 初始化为常量级轻量表达式 | 初始化调用、输入规模和组件渲染路径 | 使用惰性初始化或稳定缓存；示例：`useState(() => buildIndex(items))` |
| `PERF-FE-026` | WARN | HYBRID | render 内反复创建 debounce/throttle 包装器，导致定时状态丢失、取消失效或调用放大 | 包装器未跨调用保存状态且行为等价普通函数 | 包装器创建位置、事件绑定和 cleanup | 使用 `useMemo` 并在卸载时 cancel；示例：`useMemo(() => debounce(load, 300), [load])` |
| `PERF-FE-027` | WARN | HYBRID | 状态选择器每次返回新对象，或组件订阅整个 Store/大型状态树而只使用少数字段 | Store 保证浅比较且返回引用稳定 | selector、订阅 API、实际读取字段和比较策略 | 订阅最小字段并使用稳定选择器；示例：`useStore(s => s.userId)` |

## Vue 扩展规则

| 规则 ID | 等级 | mode | 命中条件 | 排除条件 | 必需证据 | 修复要求与示例 |
|---|---|---|---|---|---|---|
| `PERF-FE-028` | WARN | STATIC | 同一 Vue 节点同时使用 `v-for` 与 `v-if`，导致每轮迭代执行条件或产生优先级歧义 | Vue 编译结果证明已在循环前过滤 | 模板节点、列表和条件表达式 | 用 computed 预过滤或外层 `<template v-if>`；示例：`visibleItems` 后只执行 `v-for` |
| `PERF-FE-029` | WARN | HYBRID | 大型、近似不可变对象或第三方实例被 `reactive/ref` 深度代理 | 对象规模严格小，或确需每层响应 | 对象来源、规模和实际更新字段 | 使用 `shallowRef`、`shallowReactive` 或 `markRaw`；示例：`const chart = shallowRef(null)` |
| `PERF-FE-030` | WARN | AI | 高频切换的大型组件使用 `v-if` 反复销毁创建，或长期不可见重型组件使用 `v-show` 常驻 DOM | 切换频率和生命周期选择与业务匹配 | 切换入口、频率语义和组件成本 | 高频切换用 `v-show`，低频重型组件用 `v-if`/异步组件 |
| `PERF-FE-031` | WARN | HYBRID | computed/watch 每次返回新对象或 `flush:'sync'` 回调执行排序、深拷贝、请求等重型同步工作 | 数据严格小且回调为常量级 | watcher/computed 定义、flush 模式和回调体 | 返回稳定派生值；改用默认调度并拆分重型任务 |

## e-code 平台扩展规则

| 规则 ID | 等级 | mode | 命中条件 | 排除条件 | 必需证据 | 修复要求与示例 |
|---|---|---|---|---|---|---|
| `PERF-FE-032` | ERROR | STATIC | e-code 预加载文件直接引入 `@weapp/ui`、编辑器、图表等重型模块，使其进入启动链路 | 平台明确要求的轻量预加载依赖 | 文件角色、import 语句和模块类型 | 预加载文件只注册轻量入口；重型模块移入按需业务组件 |
| `PERF-FE-033` | ERROR | HYBRID | e-code 异步组件直接同步 import，或未使用平台异步加载能力与 `React.Suspense` 边界 | 组件本就是首屏必需且平台配置明确同步加载 | import 方式、组件注册点和 Suspense 边界 | 使用平台 `asyncImport` 并配置 `React.Suspense` fallback |
| `PERF-FE-034` | ERROR | STATIC | `regOvProps`、`regReactChildren` 在 render、effect、事件或重复初始化路径执行，造成重复注册 | 模块初始化时可证明只执行一次 | 注册 API、调用作用域和加载入口 | 移到模块级幂等注册入口，并用稳定扩展标识防重复 |
| `PERF-FE-035` | WARN | DEPENDENCY | 源码/构建配置把 React、ReactDOM、Vue 或 e-code 公共库作为私有副本打入业务包 | 平台不提供该运行时且构建已明确 external | package/构建配置、模块解析和产物模块清单 | 将平台公共库声明为 external/peer dependency，统一版本来源 |

## DOM 与 CSS 扩展规则

| 规则 ID | 等级 | mode | 命中条件 | 排除条件 | 必需证据 | 修复要求与示例 |
|---|---|---|---|---|---|---|
| `PERF-FE-036` | WARN | HYBRID | `useLayoutEffect` 或同步回调中交替读取 `getBoundingClientRect/offset*` 与写 style/class，形成强制同步布局 | 单次测量后批量写入且不循环 | 调用顺序、循环/渲染入口和 DOM 写入点 | 批量读后在 `requestAnimationFrame` 批量写；能用 `useEffect` 时不用 `useLayoutEffect` |
| `PERF-FE-037` | WARN | HYBRID | 列表中每个节点注册相同事件，或更新时重复绑定大量监听器而未采用委托 | 节点数量严格小且监听随节点完整销毁 | 节点规模、监听注册位置和 cleanup | 在稳定父节点使用事件委托；示例：一个 click handler 通过 `closest()` 定位项 |
| `PERF-FE-038` | WARN | STATIC | 高频动画修改 `top/left/width/height/margin` 等布局属性，持续触发布局与绘制 | 非动画的一次性状态变化 | CSS transition/animation 属性及触发频率 | 改用 `transform`、`opacity`；示例：`transform: translate3d(...)` |
| `PERF-FE-039` | WARN | HYBRID | 大面积或长期使用 `will-change`、`filter`、`backdrop-filter`、多层阴影，造成合成层和 GPU/内存压力 | 小面积短时效果，并在动画后移除 `will-change` | 选择器范围、持续时间和效果属性 | 缩小作用域、降低效果复杂度，动画结束后移除 `will-change` |

## 前端制品与构建规则

以下规则只在平台提供构建清单、依赖模块或制品统计时执行；未提供数据不得命中。

| 规则 ID | 等级 | mode | 命中条件 | 排除条件 | 必需证据 | 修复要求与示例 |
|---|---|---|---|---|---|---|
| `PERF-ART-001` | WARN | DEPENDENCY | JS、CSS、单个 Chunk 或静态资源超过平台统一配置的性能预算 | 已批准例外且资源采用按需加载 | 文件路径、原始/压缩大小、预算名称和值 | 拆包、压缩或外置资源；示例：配置 bundle budget 并按路由拆 Chunk |
| `PERF-ART-002` | WARN | DEPENDENCY | 构建清单证明多个路由/模块全部进入首屏入口，缺少异步 Chunk | 应用极小且入口未超过预算 | entry 与 Chunk 归属、路由映射及大小 | 使用动态 `import()`、平台 `asyncImport` 和路由级拆分 |
| `PERF-ART-003` | WARN | DEPENDENCY | 产物包含多个 React/Vue 主版本、ReactDOM 副本或平台公共运行时副本 | 隔离沙箱明确要求独立运行时 | 模块名、版本、Chunk 和引入路径 | 统一版本、声明 external/peer dependency 并去除重复传递依赖 |
| `PERF-ART-004` | WARN | DEPENDENCY | 构建分析证明全量引入大型库、CommonJS 副作用或 barrel export 使 Tree Shaking 失效 | 实际使用全部能力且制品仍满足预算 | 模块占比、import 路径、sideEffects/模块格式 | 使用按需 ESM import，修正 `sideEffects`，避免全量入口导入 |
| `PERF-ART-005` | WARN | DEPENDENCY | 生产包包含 Source Map、测试夹具、调试快照、重复静态文件或未使用的大型资源 | 明确作为生产功能资源且有体积预算 | 文件路径、类型、大小、重复哈希和 Chunk 归属 | 从生产构建排除 Source Map、测试和调试资源，并按内容哈希去重 |

## 新增规则测试矩阵

每行固定包含两个命中样例（P1/P2）和两个反例（N1/N2）。测试夹具应替换为等价可解析源码或制品清单，并校验规则 ID、等级和证据位置。

| 规则 | P1 命中 | P2 命中 | N1 反例 | N2 反例 |
|---|---|---|---|---|
| PERF-FE-022 | Provider value 使用对象字面量 | value 内联创建回调 | useMemo 稳定 value | 拆分后直接传稳定标量 |
| PERF-FE-023 | 函数组件内声明 Child | render 内声明并渲染 Row | 子组件在模块作用域 | 内部函数只作事件回调 |
| PERF-FE-024 | 组件函数内调用 React.lazy | map 内创建 lazy 组件 | 模块顶层创建 lazy | 普通动态 import 非组件类型 |
| PERF-FE-025 | `useState(buildIndex())` | render 中反复解析大 JSON | `useState(() => buildIndex())` | 常量级字面量初始化 |
| PERF-FE-026 | render 内创建 debounce | 每次更新重建 throttle handler | useMemo 后 cleanup cancel | 普通无状态事件函数 |
| PERF-FE-027 | selector 每次返回新对象 | 订阅整个 Store 只读一个字段 | 订阅单个标量 | 浅比较且返回引用稳定 |
| PERF-FE-028 | 同节点同时 v-for/v-if | 列表项逐个执行昂贵条件 | computed 先过滤 | 外层 template 使用 v-if |
| PERF-FE-029 | 大 JSON 使用 reactive 深代理 | 第三方图表实例放入 ref 深代理 | shallowRef 保存实例 | 小型可变表单对象 |
| PERF-FE-030 | 高频切换大组件使用 v-if | 永久隐藏重型组件使用 v-show | 高频轻组件使用 v-show | 低频重组件使用 v-if |
| PERF-FE-031 | sync watch 内深拷贝排序 | computed 每次返回无关新对象 | 精确 watch 轻量字段 | 默认调度且计算常量级 |
| PERF-FE-032 | 预加载文件 import @weapp/ui | 预加载入口同步引入图表库 | 业务组件按需引入 | 预加载仅注册轻量入口 |
| PERF-FE-033 | 异步业务组件同步 import | asyncImport 外无 Suspense 边界 | asyncImport 加 Suspense | 平台明确的首屏同步组件 |
| PERF-FE-034 | render 中 regOvProps | effect 更新时重复 regReactChildren | 模块入口幂等注册 | 单次启动注册且 ID 稳定 |
| PERF-FE-035 | React 私有副本打入业务包 | 平台公共库未 external | peer/external 统一运行时 | 隔离沙箱明确要求自带运行时 |
| PERF-FE-036 | 循环交替读 rect 与写 style | useLayoutEffect 读写多节点布局 | 批量读后 rAF 写 | 单次读取且不触发写入 |
| PERF-FE-037 | 千行列表逐项 addEventListener | 更新时重复绑定监听器 | 父节点事件委托 | 少量节点且卸载完整清理 |
| PERF-FE-038 | 动画持续修改 left/top | transition width/height | transform/opacity 动画 | 非动画的一次性布局变化 |
| PERF-FE-039 | 大容器长期 will-change | 全屏 backdrop-filter 多层阴影 | 动画后移除 will-change | 小面积短时轻量效果 |
| PERF-ART-001 | 主 JS Chunk 超预算 | 单个字体资源超预算 | 全部资源低于预算 | 已批准并按需加载的例外 |
| PERF-ART-002 | 所有路由进入入口 Chunk | 编辑器与图表进入首屏包 | 路由动态 import | 极小应用且入口满足预算 |
| PERF-ART-003 | 两个 React 主版本 | ReactDOM 与平台副本并存 | external 统一版本 | 隔离沙箱独立运行时 |
| PERF-ART-004 | 全量引入大型组件库 | CommonJS 副作用阻止摇树 | 按需 ESM import | 确实使用全库且仍满足预算 |
| PERF-ART-005 | 生产包携带 Source Map | 测试快照与重复资源进入产物 | 生产构建排除调试资源 | 生产必需且低于预算的资源 |

## 修复示例

### React：稳定 effect 并清理资源

```jsx
useEffect(() => {
  const controller = new AbortController();
  const timer = window.setInterval(loadUsers, 30_000);
  loadUsers({ signal: controller.signal });

  return () => {
    controller.abort();
    window.clearInterval(timer);
  };
}, [tenantId]);
```

### Vue：精确监听并清理

```js
const stop = watch(
  () => filters.value.keyword,
  debounce(() => loadUsers(), 300)
)

onUnmounted(stop)
```

### 批量请求并一次更新状态

```js
const response = await fetch('/api/users/batch', {
  method: 'POST',
  body: JSON.stringify({ ids })
})
setUsers(await response.json())
```
