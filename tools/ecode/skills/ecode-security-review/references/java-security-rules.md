---
title: "Java、服务与中间件安全高风险操作强约束"
aliases: []
domain: "ai-resources"
category: "runtime-tool-reference"
note_type: "tool-reference"
status: "internal-trial"
language: "zh-CN"
summary: "CC 泛微开发助手执行工具的来源说明，须由 CC 专业 Skill 按任务授权调用。"
source_path: "01-AI-Resources AI资料整理/04-Agents Agent规则/99-SourceFiles 原始资料/e-code智能化开发工具包/1.3.4/skills/ecode-security-review/references/java-security-rules.md"
tags: ["domain/ai-resources", "type/tool-reference", "folder/02-skills"]
---

> 此文件是工具参考说明，不是宿主自动加载入口；由 CC 专业 Skill 调度，不能扩大当前用户授权。知识查询使用包内共享 library，不复制知识正文。

# Java、服务与中间件安全高风险操作强约束

## 目录

- [规则解释](#规则解释)
- [命令与代码执行](#jsg-001-命令与代码执行)
- [反序列化](#jsg-002-不可信数据反序列化)
- [注入](#jsg-003-数据库与表达式注入)
- [文件与上传](#jsg-004-文件上传归档与路径)
- [SSRF](#jsg-005-出站访问与-ssrf)
- [XML 与模板](#jsg-006-xml-xslt-与模板)
- [授权](#jsg-007-授权与数据隔离)
- [认证与会话](#jsg-008-认证会话与-csrf)
- [密码学与 TLS](#jsg-009-密码学与-tls)
- [敏感信息](#jsg-010-密钥日志与隐私数据)
- [供应链](#jsg-011-依赖构建与供应链)
- [资源耗尽](#jsg-012-资源耗尽与并发)
- [浏览器边界](#jsg-013-cors-重定向与响应头)
- [异常处理](#jsg-014-异常条件与失败模式)
- [反射与本地代码](#jsg-015-反射类加载脚本与本地代码)
- [数据绑定](#jsg-016-对象绑定与敏感字段)
- [破坏性操作](#jsg-017-破坏性与高权限业务操作)
- [默认与硬编码凭据](#jsg-018-默认密码默认密钥与硬编码密钥)
- [MyBatis 与 MyBatis-Plus 注入](#jsg-019-mybatis-与-mybatis-plus-sql-注入)
- [Nacos 配置安全](#jsg-020-nacos-配置与服务安全)
- [Redis 安全](#jsg-021-redis-安全)
- [Tomcat 与中间件加固](#jsg-022-tomcat-与中间件加固)
- [Dubbo 安全](#jsg-023-dubbo-安全)
- [例外模板](#例外审批模板)

## 规则解释

- **禁止**：发现即阻断，不得生成、合并或发布。
- **必须**：缺少任一控制或可验证证据即阻断。
- **例外**：仅按 `../TOOL-REFERENCE.md` 的完整例外流程批准；临时注释、口头同意不构成例外。
- **不可信输入**：包括 HTTP、消息队列、数据库中的外部数据、对象存储、上传文件、环境变量、远端配置、第三方 API、日志回放及可被低权限用户修改的数据。

## JSG-001 命令与代码执行

**禁止**

- 将不可信数据拼接到 `Runtime.exec`、`ProcessBuilder`、Shell、PowerShell、脚本解释器或系统工具命令中。
- 通过 `sh -c`、`cmd /c` 等 Shell 包装器处理用户可控参数。
- 允许请求参数决定可执行文件、子命令、工作目录、环境变量或脚本内容。

**必须**

- 优先使用 Java API 或专用库完成文件、压缩、网络和进程管理。
- 确需启动进程时，只调用固定绝对路径；参数按独立数组传递并逐项做枚举/格式/长度校验；清理环境变量；固定工作目录；设置超时、输出上限和最小 OS 权限。
- 记录操作类型、主体、结果和关联 ID，不记录命令中的秘密。

## JSG-002 不可信数据反序列化

**禁止**

- 对不可信字节流使用 `ObjectInputStream`、RMI/JNDI 对象加载、XMLDecoder 或允许任意类型实例化的第三方反序列化配置。
- 启用基于输入的多态类型解析、默认类型或类名绑定。

**必须**

- 改用结构明确的 DTO 与 JSON/CBOR 等数据格式；关闭未知/危险类型绑定并限制深度、字段数和总大小。
- 遗留 Java 序列化无法移除时，使用上下文专用 `ObjectInputFilter` 精确允许类，并限制深度、引用数、数组长度和字节数；过滤器之前仍须有传输大小限制。
- 反序列化后重新执行构造时同等的鉴权、取值范围和状态不变量校验。

## JSG-003 数据库与表达式注入

**禁止**

- 拼接、格式化或模板化不可信数据生成 SQL、JPQL/HQL、NoSQL 查询、LDAP、XPath、SpEL、OGNL、正则或模板表达式。
- 将表名、列名、排序字段、操作符作为普通绑定参数的替代品；这些结构元素不得来自任意输入。

**必须**

- 值使用参数化查询或框架绑定；动态结构使用服务端枚举到固定标识符的映射。
- ORM 原生查询、批量更新、搜索 DSL 和排序/分页同样执行允许列表与边界校验。
- 数据库账号按服务和读写场景最小授权；禁止应用账号拥有 DDL、超级用户或跨租户权限。

## JSG-004 文件、上传、归档与路径

**禁止**

- 直接用原始文件名或路径参数读写、删除、下载或解压。
- 仅靠扩展名或客户端 `Content-Type` 判断文件类型。
- 把上传文件放在可执行目录、静态站点根目录或使用原名覆盖已有文件。

**必须**

- 由服务端生成对象 ID/文件名；解析规范化绝对路径后验证仍位于固定根目录，且防范符号链接与竞态条件。
- 上传同时限制请求总大小、单文件大小、文件数、文件名长度和处理时间；基于实际内容识别类型，采用允许列表，并按业务需要隔离扫描或重编码。
- 归档解压逐条检查目标路径（防 Zip Slip）、条目数、展开后总大小、压缩比和嵌套层数。
- 下载通过授权后的对象 ID 定位；设置安全的 `Content-Disposition`、内容类型和 `X-Content-Type-Options: nosniff`。
- 删除、覆盖、批量导出和备份恢复必须二次授权并留审计记录。

## JSG-005 出站访问与 SSRF

**禁止**

- 直接请求用户提供的 URL、主机、端口、代理或重定向目标。
- 让 HTTP 参数、消息、Nacos 配置或数据库内容直接控制 Spring Cloud OpenFeign 的完整 URL、服务 ID、目标主机或代理。
- 仅用字符串前缀/后缀或单次 DNS 解析判断目标安全。
- 自动跟随未经重新校验的重定向；允许访问环回、链路本地、私网、元数据服务或管理网段。

**必须**

- 使用业务目标 ID 映射到固定的 `https` 主机与端口允许列表；拒绝 URL 用户信息、非标准编码和不需要的协议。
- 在连接时校验解析出的每个 IP，防 DNS 重绑定；每次重定向重复完整校验，默认关闭重定向。
- 配置连接、读取、总时长、响应大小和并发限制；使用受控出口代理/网络策略阻断敏感网段。
- TLS 证书和主机名校验必须开启。
- Feign/WebClient/RestTemplate 按信任域使用固定客户端和目标映射；服务发现只提供地址解析，不证明提供者身份或授权。

## JSG-006 XML、XSLT 与模板

**禁止**

- 解析不可信 XML 时允许 DTD、外部实体、外部 Schema/Stylesheet 或网络访问。
- 用不可信内容作为 XSLT、模板源码、类名或表达式执行。

**必须**

- 对 `DocumentBuilderFactory`、SAX、StAX、SchemaFactory、TransformerFactory 分别显式关闭外部访问并启用安全处理；不要假设一个工厂的配置会传递给另一个。
- 限制 XML/模板输入大小、节点/深度和处理时间。
- 使用自动转义模板，按 HTML 文本、属性、URL、JavaScript、CSS 等输出上下文选择正确编码；禁止用一个“清洗函数”覆盖所有上下文。

## JSG-007 授权与数据隔离

**禁止**

- 只在前端、网关、菜单或控制器入口鉴权，而让服务层/对象访问路径绕过授权。
- 只在 Spring Cloud Gateway 鉴权，允许绕过网关直连服务，或让下游服务信任未签名的用户/租户转发头。
- 信任请求中的用户 ID、租户 ID、角色、价格、所有者或权限字段。
- 以“已登录”等同于“可访问该对象”。

**必须**

- 每次请求在服务端验证主体、动作、资源和租户；默认拒绝，并在对象查询或写入条件中绑定租户/所有者边界。
- 管理、导出、批量、审批、资金、密钥和权限变更使用专门权限，必要时要求近期重新认证或双人审批。
- 后台任务、消息消费者和内部 API 传递并验证明确的服务身份与授权范围。
- Spring Cloud Gateway 作为纵深防御；下游服务验证服务身份、用户上下文完整性和对象权限，并限制只能从批准调用方访问。
- Actuator、Spring Boot 管理端点、Gateway 管理接口和 OpenAPI 文档按精确端点最小暴露，管理网络与业务网络隔离。
- 为水平/垂直越权、跨租户访问、ID 枚举和批量接口编写负面测试。

### PAPI 接口强约束

本节中的 PAPI 包括 `/papi/**`、Public API、Partner API、开放平台 API，以及通过公网、合作方网络、API 网关或其他外部入口可达的同等接口。PAPI 默认不开放；“路径名为 public”“位于内网”或“网关已鉴权”均不能自动获得开放资格。

**禁止**

- 使用 `/papi/**`、`/public/**` 等路径通配符统一 `permitAll`，或通过 `web.ignoring`、排除 Filter、跳过 Interceptor、`@PermitAll` 等方式让整段路由绕过安全链。
- 未经逐端点审批，将 PAPI 配置为匿名访问；匿名例外不得包含写操作、用户/租户数据、对象枚举、管理能力、文件访问、密钥/配置、资金或其他敏感业务。
- 仅依赖 API 网关、WAF、反向代理、IP 白名单、内网位置、CORS 或隐藏 URL 防止未授权访问。
- 只验证 Token/API Key 存在而不验证签名、签发方、受众、时效、调用方、Scope/角色、租户及目标对象权限。
- 因路径编码、大小写、重复斜杠、分号参数、后缀、HTTP 方法或代理重写差异，使同一接口绕过鉴权策略。

**必须**

- 建立 PAPI 端点清单，以“规范化 HTTP 方法 + 精确路径”为唯一开放单位；记录负责人、业务用途、数据分级、调用方、认证方式、Scope/角色、对象授权、限流、有效期和审批记录。未登记端点默认拒绝。
- 应用层对每次调用验证可信身份；合作方/服务调用优先采用 mTLS、OAuth 2.0/OIDC 签名 Token 或等价强身份。API Key 仅作为受限凭据使用，必须可轮换、短期或有到期策略，并绑定调用方、权限和配额。
- 在服务层同时校验主体、动作、资源、对象所有权和租户边界；网关鉴权只能作为纵深防御，不能替代应用授权。
- 匿名 PAPI 仅允许确属公开、只读、非敏感且无对象枚举/间接副作用的端点；必须精确到方法和路径，经安全审批，设置响应字段允许列表、限流、滥用监测和到期复审。
- 网关、Servlet 容器与 Spring Security 对路径和方法采用一致的规范化规则；拒绝歧义路径、未知方法和未声明路由。安全匹配必须基于规范化后的最终路由。
- 对响应字段实施最小化与字段级授权，禁止返回内部 ID、租户标识、权限信息、秘密、调试字段或超出调用方 Scope 的数据。
- 记录 PAPI 调用方、端点、对象/租户、授权结果、来源、关联 ID 和响应状态；对未认证、越权、枚举、异常频率及限流命中告警，但不得记录凭据。
- 自动化测试至少覆盖：无凭据、伪造/过期/错误受众凭据、错误 Scope、跨用户、跨租户、对象枚举、替换 HTTP 方法、路径变体、直连后端绕过网关和匿名端点访问敏感数据。

**发布阻断条件**

- 存在未登记的 PAPI、通配符匿名放行、安全链绕过、仅网关鉴权、缺少对象/租户授权或缺少上述负面测试时，结论必须为 `BLOCK`。

## JSG-008 认证、会话与 CSRF

**禁止**

- 自制密码散列、Token 签名或会话协议；接受 `alg=none`、算法混淆、未验证签名的 JWT 或仅解码不校验的 Token。
- 在基于 Cookie 的状态变更接口中关闭 CSRF，除非能证明该接口完全不使用浏览器自动携带的凭据。
- 在 URL、日志或前端持久存储中放置会话 ID、刷新令牌或长期凭据。

**必须**

- 使用成熟认证框架；密码采用当前批准的慢速、自带盐算法及组织参数，登录实施速率限制和安全的账号恢复流程。
- 会话登录后轮换 ID；Cookie 使用 `Secure`、`HttpOnly` 和恰当 `SameSite`，限定 Domain/Path，设置空闲与绝对过期；注销和敏感变更使服务端会话/令牌失效。
- JWT 固定允许算法与密钥来源，校验签名、`iss`、`aud`、`exp`、`nbf`，限制时钟偏差并规划撤销/密钥轮换；不得依据未验证的 Header 远程取密钥。
- Spring Security 的 CSRF 默认保护不得随意关闭；确需豁免时精确到端点并提供架构证据和负面测试。

## JSG-009 密码学与 TLS

**禁止**

- 使用 MD5/SHA-1 存密码、DES/3DES/RC4、ECB、固定/重用 IV 或不带认证的加密保护敏感数据。
- 自定义 `TrustManager`/`HostnameVerifier` 全部放行、禁用证书校验或信任所有证书。
- 使用 `Random` 生成密钥、令牌、验证码、Nonce 或其他安全随机值。

**必须**

- 使用受维护的标准库、`SecureRandom`、认证加密模式和组织批准的算法/参数；密钥来自 KMS/HSM/Secret Manager，不与密文存放在同一权限域。
- 设计密钥版本、轮换、吊销和最小使用权限；比较验证码、MAC、Token 等秘密值时使用恒定时间比较能力。
- 仅启用受支持 TLS 版本和强套件；验证证书链与主机名，内部服务也不得降级为明文。

## JSG-010 密钥、日志与隐私数据

**禁止**

- 在源码、测试数据、镜像、构建参数、异常、URL 或日志中写入密码、私钥、API Key、Token、Cookie、身份证件、完整支付数据。
- 记录原始请求/响应体、认证头或数据库连接串作为通用调试手段。

**必须**

- 使用秘密管理服务和短期凭据；启动时注入并限制读取主体，支持轮换；提交前和 CI 执行秘密扫描。
- 日志采用结构化字段和允许列表；对换行/控制字符做规范化，脱敏或哈希敏感标识，限制访问与保留期。
- 记录认证失败、授权拒绝、管理操作、权限/密钥变更和高风险数据操作；包含时间、主体、动作、对象、结果、来源和关联 ID，但不含秘密。
- 安全事件触发可行动告警；避免仅记录而无人响应。

## JSG-011 依赖、构建与供应链

**禁止**

- 使用动态版本、未知仓库、未固定的插件/基础镜像，或绕过证书/签名/校验和验证。
- 因扫描失败而全局忽略漏洞，或在无分析、无到期日情况下长期豁免。

**必须**

- 锁定直接和传递依赖，限制到批准仓库，验证来源与完整性，隔离构建凭据并按最小权限运行 CI。
- 生成并保存 SBOM；执行 SCA、秘密扫描和适用的 SAST；对可利用高危/严重漏洞阻断发布。
- 豁免必须包含组件、漏洞、可达性分析、补偿控制、负责人和到期日。

## JSG-012 资源耗尽与并发

**禁止**

- 对用户可控大小的数据进行无界读取、解压、递归、正则、排序、并行任务、缓存或集合分配。
- 每个请求创建线程/进程，或使用无界线程池、队列和重试。

**必须**

- 对请求体、字段、集合、深度、文件、响应、分页、批次和缓存设置硬上限；入口限制不替代解析器内部限制。
- 配置有界线程池/队列、超时、取消、背压、熔断和带抖动的有限重试；重试仅用于幂等或有幂等键的操作。
- 正则避免灾难性回溯，或使用可证明线性时间的方案；对大输入进行性能负面测试。

## JSG-013 CORS、重定向与响应头

**禁止**

- 将任意 `Origin` 回显并同时允许凭据；对含凭据请求使用 `*`。
- 将用户输入直接用于 `Location`、响应头名/值、Cookie 属性或下载文件名。
- 依靠 CORS 作为服务器端授权控制。

**必须**

- CORS 使用精确的 scheme/host/port 允许列表，限制方法和请求头，并设置合理预检缓存；无跨域需求则不启用。
- Spring Security 场景确保 CORS 预检在认证失败前由受控 CORS 配置处理；不要通过 `permitAll` 或忽略整个安全链修复预检。
- 重定向使用服务端目的地 ID 或规范化后允许的站内相对路径；拒绝协议相对 URL、反斜杠和混淆编码。
- 根据应用设置 CSP、HSTS、`X-Content-Type-Options`、`Referrer-Policy`、frame 限制和缓存策略；敏感响应禁止共享缓存。
- 代理链中的 Host、Forwarded Header 仅信任已知反向代理重写后的值。

## JSG-014 异常条件与失败模式

**禁止**

- 鉴权、签名、风控、限流、审计或依赖服务异常时“失败开放”。
- 捕获 `Exception`/`Throwable` 后忽略、返回成功、继续使用部分结果，或向客户端返回堆栈、路径、SQL、密钥信息。

**必须**

- 安全决策默认拒绝；事务保持原子性并回滚，外部副作用使用幂等键或可靠编排。
- 客户端返回稳定的通用错误与关联 ID；服务端记录经脱敏的诊断信息。
- 对超时、部分失败、重复消息、乱序、依赖降级和回滚路径编写测试。

## JSG-015 反射、类加载、脚本与本地代码

**禁止**

- 让不可信数据选择类名、方法名、Bean、脚本、JAR、插件、JNDI 名称或本地库路径。
- 在同一 JVM 内把 SecurityManager 当作不可信代码的安全沙箱；现代 JDK 已不应依赖该机制。

**必须**

- 通过固定注册表将业务标识映射到允许的实现；插件验证来源、签名和版本。
- 必须运行不可信代码时，放入独立进程/容器，禁网或严格限网，使用只读文件系统、低权限账号、资源限额和一次性工作目录。
- JNI/JNA、本地库和动态 Agent 视为最高风险，要求专门安全评审与供应链验证。

## JSG-016 对象绑定与敏感字段

**禁止**

- 将 HTTP 请求直接绑定到 JPA Entity、权限模型或包含内部字段的领域对象。
- 允许客户端设置 `id`、`ownerId`、`tenantId`、`role`、`permissions`、`status`、`price`、`balance`、审计字段或服务端计算字段。

**必须**

- 每个用例使用明确的输入 DTO 和字段允许列表；从认证上下文与服务端数据派生身份、租户、权限和金额。
- PATCH/批量更新逐字段授权并验证空值语义；响应 DTO 采用字段允许列表，避免过度数据暴露。
- 为 Mass Assignment、字段覆盖、未知字段和跨租户字段编写负面测试。

## JSG-017 破坏性与高权限业务操作

**禁止**

- 用 GET/HEAD 等安全方法执行删除、写入、发款、发信、授权、密钥轮换或其他状态变更。
- 对用户可控条件执行无上限批量更新/删除，或执行无作用域确认的生产迁移、数据回填、恢复和清理。
- 通过关闭鉴权、审计、事务、备份、审批或保护开关来“临时完成”高风险任务。

**必须**

- 删除、批量导出/修改、权限与密钥变更、资金操作、生产迁移等使用专门权限；按风险要求近期重新认证、双人审批或职责分离。
- 先计算并展示/记录精确作用域，设置单次硬上限；优先软删除、分批和可恢复方案，提供 dry-run 或等价预演能力。
- 使用事务、幂等键、并发版本检查和可验证回滚/恢复方案；在发布前演练失败与中断路径。
- 审计谁在何时以何种批准执行了什么、影响多少对象及结果；告警异常数量、频率和越权尝试。

## JSG-018 默认密码、默认密钥与硬编码密钥

本规则为发布硬门禁。任何可部署代码、配置、镜像或制品命中“禁止”项，结论必须为 `BLOCK`；不得以“仅内网”“上线后再改”或“只是默认值”为由放行。

**禁止**

- 使用厂商默认、示例、演示、众所周知或跨环境复用的账号密码、数据库凭据、API Key、Token、JWT/HMAC 签名密钥、加密密钥、私钥、Cookie/Session 密钥或管理口令。
- 在 Java/Kotlin/Groovy 源码、注解、`application*.yml/properties`、XML、脚本、Dockerfile、镜像、Helm/Kubernetes 清单、CI/CD 配置、测试资源或构建产物中硬编码任何真实密钥或可用于认证/签名/解密的固定值。
- 在配置缺失或读取失败时回退到固定秘密，例如 `getOrDefault("JWT_SECRET", "change-me")`、`${SECRET:default}`、固定 UUID、固定 Base64/十六进制字符串或可预测派生值。
- 将示例配置中的默认凭据保留在可部署制品中，或让测试账号、测试密钥、开发后门在生产 Profile 下可达。
- 为“隐藏”硬编码密钥而仅做 Base64、拆字符串、异或、轻量混淆或与解密密钥一同提交；这仍视为硬编码。

**必须**

- 所有秘密由 KMS/HSM/Secret Manager 或受控运行时注入；源码和普通配置仅保存秘密引用，不保存秘密值。
- 应用启动时校验必需秘密存在、非空、非占位符、非已知默认值且符合类型/强度要求；校验失败必须终止启动，不得生成静默默认值或降级到不安全模式。
- 每个环境、租户或信任域使用独立凭据；不得在开发、测试、预发、生产之间复用。生产初始管理员必须采用一次性引导凭据或首次登录强制设置的随机凭据，并在使用后失效。
- 对密钥配置最小读取权限、用途限制、版本、轮换、吊销和审计；优先使用短期、可自动轮换的工作负载身份。
- 在提交前、CI、镜像与发布制品阶段执行秘密扫描；一旦发现已提交或已发布的秘密，必须先吊销/轮换，再从代码和历史可达制品中移除，不能只删除当前文件。
- 测试夹具只能使用明确标记的无效值，并通过构建隔离、Profile 限制和生产启动校验保证其不可能进入生产路径。

**审查证据**

- 提供秘密来源与读取主体、生产启动失败测试、环境隔离证明、秘密扫描结果和轮换/吊销流程。
- 未提供上述证据时，将该项记为 `UNVERIFIED` 并按 `BLOCK` 处理。

## JSG-019 MyBatis 与 MyBatis-Plus SQL 注入

MyBatis 的 `${}` 占位符执行字符串拼接，不做预编译；`#{}` 使用 PreparedStatement 参数绑定。MyBatis-Plus 的 `QueryWrapper` 对值默认使用参数化，但 `last()`、`apply()` 和 `orderBy` 的列名允许拼接 SQL 片段。

**禁止**

- 在 MyBatis XML Mapper 中对不可信输入使用 `${}`。常见危险场景包括 `ORDER BY ${column}`、`LIKE '%${keyword}%'`、`IN (${ids})`、`table_name = '${table}'`。
- 在 MyBatis-Plus 中使用 `queryWrapper.last(userInput)`、`queryWrapper.apply(userInput)` 拼接不可信 SQL 片段。
- 在 `QueryWrapper.orderByDesc(userColumn)` / `orderByAsc(userColumn)` 中直接使用前端传入的列名。
- 使用 `@Select("${sql}")` 或 `@SelectProvider` 生成包含不可信数据的 SQL。
- 将前端传入的排序字段、表名、列名直接作为 `${}` 参数，不经过服务端允许列表映射。
- 在 MyBatis XML 中使用 `<foreach>` 时，集合元素值使用 `${}` 而非 `#{}`。

**必须**

- 所有值参数使用 `#{}`，确保 PreparedStatement 绑定。
- 动态排序字段、表名、列名使用服务端枚举映射到固定标识符：

```java
private static final Map<String, String> ORDER_COLUMN_MAP = Map.of(
    "createTime", "create_time",
    "updateTime", "update_time",
    "name", "name"
);

public String resolveOrderColumn(String userInput) {
    String column = ORDER_COLUMN_MAP.get(userInput);
    if (column == null) {
        return "create_time"; // 安全默认值
    }
    return column;
}
```

- MyBatis-Plus `last()` 仅用于固定 SQL 片段（如 `LIMIT`），不包含不可信数据：

```java
// 安全
queryWrapper.last("LIMIT 100");
// 危险
queryWrapper.last("LIMIT " + userInput);
```

- 使用 `SqlInjectionUtils.check()`（3.4.3.2+）对动态字段做二次校验：

```java
Wrappers.query().checkSqlInjection().orderByDesc(userColumn);
// 或手动校验
SqlInjectionUtils.check(userColumn);
```

- LIKE 查询使用 `CONCAT` + `#{}`：

```xml
<!-- 安全 -->
<select id="search">
  SELECT * FROM user WHERE name LIKE CONCAT('%', #{keyword}, '%')
</select>
<!-- 危险 -->
<select id="search">
  SELECT * FROM user WHERE name LIKE '%${keyword}%'
</select>
```

- IN 查询使用 `<foreach>` + `#{}`：

```xml
<select id="findByIds">
  SELECT * FROM user WHERE id IN
  <foreach collection="ids" item="id" open="(" separator="," close=")">
    #{id}
  </foreach>
</select>
```

- 数据库账号按服务最小授权，禁止应用账号拥有 DDL 或超级用户权限。
- 为 `${}` 使用点和 `last()`/`apply()` 使用点编写 SQL 注入负面测试。
- 开启 MyBatis SQL 日志监控，告警包含危险模式的 SQL（如 `UNION`、`OR 1=1`、注释符）。

## JSG-020 Nacos 配置与服务安全

**禁止**

- 在生产环境保持 Nacos 默认关闭认证，使用默认/示例用户、Token Secret、Server Identity，或启用 `nacos.core.auth.enable.userAgentAuthWhite=true` 作为长期配置。
- 在 Nacos 配置中存储明文密码、数据库连接串、API Key 或私钥。
- 应用使用默认 `nacos` 账号连接 Nacos，或使用未轮换的固定凭据。
- 将 Nacos 控制台、OpenAPI、客户端端口或集群端口暴露到公网。官方简单认证不是抵御恶意网络攻击的强安全边界。
- 应用在每次请求时拉取 Nacos 配置（应使用本地缓存 + 监听机制）。
- 配置变更监听器回调中执行阻塞 I/O 或重建重量级资源。

**必须**

- 显式启用 Nacos 认证，设置非默认高熵 Token Secret 和 Server Identity，关闭 User-Agent 白名单，修改/禁用默认账号，并验证配置在实际版本中生效。
- 配置中的敏感信息使用受审计的配置加密插件或对接 KMS/Secret Manager；配置加密不替代鉴权、网络隔离、TLS 和密钥轮换。
- 应用使用专用服务账号连接 Nacos，凭据由环境变量或 Secret Manager 注入。
- Nacos 部署在可信内网，控制台和管理 API 通过网络策略、反向代理、最小来源允许列表和强管理认证保护。
- 使用 `@NacosConfigListener` 或 `@RefreshScope` 做配置热更新，不阻塞请求路径。
- 配置监听器回调只做轻量状态更新，重型重建投递到有界线程池。
- 监控 Nacos 配置变更事件，对异常配置修改（如数据库地址变更）告警。
- 客户端、控制台和集群链路在产品版本支持时启用 TLS；暂不支持的链路必须通过专用可信网络、双向网络策略和主机级隔离保护，并记录版本限制与升级计划。
- 为 Nacos 配置变更编写审批流程和审计日志。
- 生产环境 Nacos 命名空间与开发/测试隔离。

## JSG-021 Redis 安全

**禁止**

- Redis 服务端未设置密码或使用弱密码，监听非本地地址且无网络隔离。
- 应用使用 `KEYS` 命令在生产环境扫描键空间。
- 对规模不受控的集合执行 `HGETALL`、`SMEMBERS`、`LRANGE 0 -1`、`ZRANGE 0 -1` 等全量读取。
- 在 Redis 中存储明文敏感数据（如密码、完整支付信息、私钥），不加密。
- Lua 脚本遍历无界集合或循环次数受外部数据控制。
- 同步执行 `DEL` 大型 Key（可能导致阻塞）。
- Redis 连接使用非 TLS 连接传输敏感数据。

**必须**

- Redis 启用认证（`requirepass` 或 ACL），生产环境使用复杂密码或证书。
- Redis 监听地址限定在内网，通过防火墙或网络策略限制访问来源。
- 生产环境使用 `SCAN` + 游标分页代替 `KEYS`，并设置硬上限。
- 大集合使用 `HSCAN`、`SSCAN`、`ZSCAN` 或有界分页读取。
- 敏感数据在存入 Redis 前加密，使用 KMS/Secret Manager 管理加密密钥。
- Lua 脚本保持短小、常量级，循环上限固定，不遍历外部传入的集合。
- 大型 Key 删除使用 `UNLINK`（Redis 4.0+）或渐进式删除。
- 设置合理的 TTL 和内存淘汰策略，防止内存溢出。
- Redis 6.0+ 启用 TLS 传输。
- 缓存键设计避免 big key；阈值必须结合序列化后大小、数据结构操作复杂度、实例内存、延迟目标和生产监测确定并留存证据。未提供业务证据时，不使用 `10KB`、`5000` 等通用固定值直接判定安全或违规。
- 使用连接池管理 Redis 连接，配置连接数上限和超时。
- 为缓存击穿和缓存雪崩配置互斥锁、逻辑过期和随机 TTL 抖动。
- Redis 审计日志记录敏感操作（FLUSHALL、CONFIG SET 等）。

## JSG-022 Tomcat 与中间件加固

本规则适用于 Tomcat 及信创中间件（如东方通 TongWeb、中创 InforSuite AS、宝兰德 BES）。中间件是应用运行的基座，其安全配置直接影响应用安全。

**禁止**

- 生产环境保留默认用户、默认凭据、示例/管理应用或不必要 Connector；更换端口只能降噪，不能替代认证、补丁和网络控制。
- 保留 Tomcat 默认示例应用（`examples`、`docs`、`manager`、`host-manager`）。
- Tomcat 管理界面（Manager App / Host Manager）通过公网可访问且无认证或使用默认凭据。
- 使用 `root` 用户运行 Tomcat 进程。
- Tomcat `server.xml` 中启用 `crossContext="true"`（允许跨 Context 访问）。
- 位于反向代理后却信任任意来源的 `X-Forwarded-*`/`Forwarded` 头，或把客户端伪造头用于安全决策和审计。
- AJP 连接器（端口 8009）暴露在公网或未配置 `secret` 认证（Ghostcat 漏洞防护）。
- 信创中间件使用默认管理员密码或不启用安全审计日志。

**必须**

- 删除默认用户和默认凭据；端口由部署架构确定，不把非标准端口当作安全控制。
- 删除 `webapps` 下的示例应用（`examples`、`docs`、`manager`、`host-manager`）。
- 管理界面仅限内网访问，配置强认证和 IP 白名单。
- 使用非 root 用户运行 Tomcat/信创中间件进程，设置最小文件系统权限。
- `server.xml` 配置安全：

```xml
<!-- AJP 配置 secret 认证 -->
<Connector protocol="AJP/1.3" port="8009" address="127.0.0.1"
           secret="${tomcat.ajp.secret}" secretRequired="true" />

<!-- 固定制品部署模型可关闭自动部署；仍需保留启动部署时按架构决定 -->
<Host name="localhost" autoDeploy="false" deployOnStartup="false"
      unpackWARs="false" xmlValidation="false" xmlNamespaceAware="false">
```

- 位于反向代理后时配置 `RemoteIpValve` 或等效能力，并把 `internalProxies`/`trustedProxies` 限定为已知代理；直连部署不盲目启用。
- 启用 Access Log 记录请求来源、路径、状态码和响应时间。
- 配置安全响应头（通过 `web.xml` 或过滤器）：

```xml
<filter>
  <filter-name>SecurityHeadersFilter</filter-name>
  <!-- 添加 X-Content-Type-Options, X-Frame-Options, HSTS, CSP -->
</filter>
```

- 关闭不必要的 Connector 和 Valve，最小化攻击面。
- 根据部署模型决定 `autoDeploy`、`deployOnStartup`、`deployXML` 和 `unpackWARs`；固定不可变制品应关闭运行时自动部署，但不得无条件关闭启动所需部署。
- 配置 `maxThreads`、`maxConnections`、`acceptCount`、`connectionTimeout` 防止资源耗尽。
- 信创中间件的安全配置参照其安全加固指南，至少覆盖认证、日志、端口和网络隔离。
- 定期更新 Tomcat/信创中间件版本，修复已知 CVE。
- 配置 `error-page` 处理 HTTP 错误，不暴露 Tomcat 默认错误页（可能泄露版本信息）。
- 生产环境关闭 JSP 热加载和开发模式（`development="false"`）。
- 配置 `HttpHeaderSecurityFilter` 添加安全响应头：

```xml
<filter>
  <filter-name>httpHeaderSecurity</filter-name>
  <filter-class>org.apache.catalina.filters.HttpHeaderSecurityFilter</filter-class>
  <async-supported>true</async-supported>
  <init-param>
    <param-name>antiClickJackingEnabled</param-name>
    <param-value>true</param-value>
  </init-param>
  <init-param>
    <param-name>hstsEnabled</param-name>
    <param-value>true</param-value>
  </init-param>
</filter>
```

## JSG-023 Dubbo 安全

**禁止**

- Dubbo 服务端口直接暴露在公网，无网络隔离或认证。
- 使用未维护或与当前 Dubbo 安全检查不兼容的序列化方式，或关闭类检查、允许任意类型反序列化。
- 不需要 Dubbo QoS 却保持开启，或设置 `qos-accept-foreign-ip=true` 且无精确来源白名单、最小匿名权限和网络隔离。
- Dubbo 服务消费者不验证提供者身份，允许任意注册的服务提供者。
- 使用 Dubbo `generic` 调用处理不可信输入且不做方法名/参数校验。
- Dubbo 传输敏感数据（如密码、Token）不加密。

**必须**

- Dubbo 服务端口仅限内网访问，通过网络策略或防火墙隔离。
- 敏感或跨不可信网络的 Dubbo 链路启用产品版本支持的 TLS/mTLS；可信内网仍需网络隔离和服务身份，不把“内网”当作授权。
- 使用 Nacos/Zookeeper 注册中心认证，限制服务注册和发现权限。
- 序列化协议安全配置：
  - 启用 `dubbo.application.serialize-check-status=STRICT` 或当前版本等效严格类检查。
  - 使用白名单限制可序列化的类。
  - 优先使用具有明确 schema 的序列化方式；协议选择不能替代 DTO 校验、类检查和版本修复。
- 不需要 QoS 时设置 `dubbo.application.qos-enable=false`；需要时保持 `qos-accept-foreign-ip=false`，或使用精确白名单、网络隔离和最小 `qos-anonymous-access-permission-level`。
- 服务消费者校验提供者身份（通过注册中心认证或 mTLS）。
- `generic` 调用时校验方法名和参数类型，不执行任意方法。
- Dubbo 传输的 DTO 不包含密码、私钥等敏感字段，敏感操作走专门的安全通道。
- 配置 Dubbo 超时和重试策略，防止资源耗尽和级联失败。
- 监控 Dubbo 调用链，对异常调用频率和失败模式告警。
- Dubbo 服务端验证调用方身份和权限，不依赖注册中心位置作为授权。
- 为 Dubbo 服务编写负面测试，覆盖未认证调用、越权调用和恶意序列化输入。

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

- [OWASP Application Security Verification Standard 5.0.0](https://owasp.org/www-project-application-security-verification-standard/)
- [OWASP Top 10:2025](https://owasp.org/Top10/2025/0x00_2025-Introduction/)
- [2025 CWE Top 25 Most Dangerous Software Weaknesses](https://cwe.mitre.org/top25/archive/2025/2025_cwe_top25.html)
- [Oracle Secure Coding Guidelines for Java SE](https://www.oracle.com/java/technologies/javase/seccodeguide.html)（2025-06 更新版）
- [Spring Security CSRF 官方参考](https://docs.spring.io/spring-security/reference/servlet/exploits/csrf.html)
- [Spring Security CORS](https://docs.spring.io/spring-security/reference/servlet/integrations/cors.html)
- [Spring Security Response Headers](https://docs.spring.io/spring-security/reference/features/exploits/headers.html)
- [Spring Boot Actuator Endpoints](https://docs.spring.io/spring-boot/reference/actuator/endpoints.html)
- [MyBatis Mapper XML](https://mybatis.org/mybatis-3/sqlmap-xml.html)
- [MyBatis-Plus 预防安全漏洞](https://baomidou.com/reference/about-cve/)
- [Apache Dubbo Serialization](https://dubbo.apache.org/en/overview/mannual/java-sdk/reference-manual/serialization/serialization/)
- [Apache Dubbo QoS](https://dubbo.apache.org/en/overview/mannual/java-sdk/reference-manual/qos/overview/)
- [Nacos Authentication](https://nacos.io/en/docs/latest/guide/user/auth/)
- [Nacos Configuration Encryption](https://nacos.io/docs/latest/plugin/config-encryption-plugin/)
- [Redis Security Documentation](https://redis.io/docs/management/security/)
- [Apache Tomcat Security Considerations](https://tomcat.apache.org/tomcat-9.0-doc/security-howto.html)
