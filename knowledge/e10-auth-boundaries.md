---
title: "E10集成登录与认证Dubbo接口边界"
platform: "E10"
status: internal-trial
source_record: "e10-auth-boundaries"
source_manifest: manifest.json
---
# E10集成登录与认证Dubbo接口边界

> 随包解释卡，供内部试用。通用正文、API、案例与已有本地附件先查 [资料导航](../library/catalog.md)，按标题或符号检索后使用 document_id 读取；不依赖维护者电脑路径。本页的核读日期、数量与行号描述当时的整理范围，不代表当前整库验收。详细维护记录不随包，客户工程与现场配置另行提供；知识卡指纹见 [manifest.json](manifest.json)。

本页把容易混用的五类能力拆开：**E10 登录第三方、第三方认证登录 E10、E10 作为认证中心、内部账号服务、密码变更广播**。依据为e-code 工具包 1.3.4 认证模块的 31 份非脚本文件：4 篇正文、23 条 Dubbo 记录及 4 份模块/索引文件。全部本地核读不代表契约完整，更不代表接口已在客户现场验证。

本次未运行工具包程序或源示例，未编译、联网、调用认证服务、修改账号/密码/租户或调整系统配置。来源中的密码、令牌、手机号、真实地址及带访问参数的附件链接不复制到本页；现有知识正文与原件未改。需要实施时，仍须取得现场接口、依赖、认证配置及授权。

## 1. 先判断方向，不能只按“单点登录”选接口

| 目标 | 已有证据指向 | 不可混用的边界 |
|---|---|---|
| 已在 E10 的用户进入第三方 | S02：`loginSingle()`、`SecondSsoConfig`，前端 `/sp/custom/loginSingle` 与 `/mobile/custom/loginSingle`，示例后端 `/api/secondev/intlogin/sso/login` | 后端构造第三方地址和参数，前端完成跳转；不是把第三方票据换成 E10 身份。动态参数、最终返回对象和失败响应需按目标系统补齐。 |
| 第三方身份认证后进入 E10 | S03：`AuthSso()`、`AuthSsoLogout()`、`SecondAuthConfig`，认证前端 `intbssso/freepass` | 认证中心票据/授权码须经后端验证并映射身份；不能仅因前端有 ticket 就认定认证成功。正文与示例路由不一致，见 §6。 |
| 第三方把 E10 当认证中心 | S04：`/papi/sso/cas/*`、`/papi/sso/oauth2.0/*`、`/papi/sso/oidc/*` | E10 是票据/令牌签发与校验方，不是上行第三方认证中心。7 条 HTTP 入口按 §3 分开，不套用 Dubbo 的 DTO 或返回值。 |
| 服务内查询用户、校验、改密、锁定、建租户 | A01–A23：Dubbo 服务契约记录 | 不是公开 HTTP 路由，也不等于当前调用者有操作这些账号的权限。查询对象含敏感属性，应仅取业务必需字段。 |
| 密码变化通知下游 | S05：MQ topic `passport_pwd_change` | 广播中含明文/密文密码字段，属于敏感数据链路；不是可随手开启的日志或一般业务消息。 |

与既有笔记的关系：

- 统一认证接入-自定义接口开发（来源资料，需在 library 按标题检索） 是 `weaver-intunifyauth-client-service` 内实现 `AuthclientCustomService` 的另一条入口，含 `login/getUserInfo/logout/isRedirectLogin` 和 `/papi/iaauthclient/bs/custom/getUserInfo` 回调。该页适用基线待确认，不能把 S03 的最低基线或前端回调规范直接移植给它，也不能据 S03 的迁移描述判定旧实现已经失效。（C01:42–105、125–169）
- E9跳转E10免登配置与部署说明（来源资料，需在 library 按标题检索） 是项目沉淀的 E9 Servlet → E10 开放接口 `get_logintoken` → `singleSignon` 链路，约束当前 E9 会话、账号映射、待办接收人与目标地址。这不是上述 Dubbo 的同源实现，更不是两者兼容或已验收的证明；本次仅阅读笔记的适用范围、链路与安全章节，没有核查其外部工程。（C02:1–125、249–275）

## 2. 版本声明按能力拆开

| 能力 | 本地资料的声明 | 使用限制 |
|---|---|---|
| ecode 自定义认证入站 | S03:30：最低 E10 `10.0.2503.01` | 不扩大为整个认证模块的统一最低版本。 |
| 全资源认证拦截 | S03:204–235：“250601 基线后支持” | 保留原记法，具体补丁、部署形态和生效方式须现场核实；不把它当任意页面免鉴权。 |
| 两个集成登录 Dubbo 目录项 | A18、A19：`10.0.2505.01` | 只有服务、类与名称，缺实际签名、参数、返回。 |
| 其余 21 条 Dubbo 记录 | A01–A17、A20–A23：`10.0.2307.00` | `status=active` 只是归档元数据；全部 group/version 为空，不代表现场可省略。 |
| 密码 MQ 广播 | S05:11：含 `20240402` 基线 | 发送代码注明 `20250901` 起消息由 String 调整为 JSONObject，消费者不能按一个固定类型跨版本解析。 |
| 改密强制 MQ 控制 | A01、A06 调用示例：“20250801 版本后支持” | 不回推到接口最低 `10.0.2307.00`；要区分该局部能力与接口本体。 |
| CAS/OAuth2/OIDC HTTP 与集成出站正文 | S04 更新于 2024-01-22；S02 为 2026-06-23 提取文本 | 未给可逐项确认的最低基线；文档日期不等于部署版本或验证日期。 |

S02/S03 提到 Java 1.8、Gradle、`secDevLib` 与二开服务现场 jar，且原时序图/代码图片未保留。它们是环境准备线索，不是完整可编译工程；链接附件及图片本次均未取回或核验。

## 3. E10 认证中心的 7 条 HTTP 入口

以下方法及必填项仅转录 S04 的表格，不提供带凭据的请求示例，也不补造未记载的 Content-Type、请求体位置或令牌策略。

| 协议与入口 | 文档请求方式 | 表中必填参数 | 返回证据及边界 |
|---|---|---|---|
| CAS `/papi/sso/cas/login` | GET，浏览器 302 | `appid`、`service` | 成功跳到 service 并带 ticket；失败跳提示页。 |
| CAS `/papi/sso/cas/serviceValidate` | GET/POST | `ticket`、`service` | 给出含 `cas:user` 的 XML 成功片段；没有完整错误协议或票据重放/有效期约定。 |
| OAuth2 `/papi/sso/oauth2.0/authorize` | GET，浏览器 302 | `client_id`、`redirect_uri`、`response_type` | 示例使用授权码模式；成功回调带 code。 |
| OAuth2 `/papi/sso/oauth2.0/accessToken` | GET/POST | `client_id`、`client_secret`、`code`、`redirect_uri`、`grant_type` | 成功示例含 `access_token`、`code`、`expire`、`status`；`expire` 样例值不是稳定默认期限承诺。 |
| OAuth2 `/papi/sso/oauth2.0/profile` | GET/POST | `access_token` | 样例含 `id` 与 `attributes`；不能把手机号形状的样例 id 定义为所有环境的固定标识类型。 |
| OIDC `/papi/sso/oidc/authorize` | GET，浏览器 302 | `client_id`、`redirect_uri`、`scope`、`response_type` | 示例却使用 OAuth2 路由且缺 scope，不能照抄。（S04:158–173） |
| OIDC `/papi/sso/oidc/accessToken` | GET/POST | `client_id`、`client_secret`、`code`、`redirect_uri`、`grant_type` | 返回样例重复 `access_token` 键，并含 `refresh_token/id_token/expires_in`；不能通过解析器“后值覆盖”替来源选择真实契约。（S04:179–208） |

安全与补证建议（本库要求，不冒充来源已实现）：凭据只在受控服务端保存；不沿用将密钥和 token 放在 URL 中的示例。上线前补齐平台实际支持的传输方式、应用授权、回调白名单、票据/令牌校验、防重放及注销策略；OAuth2/OIDC 的 state、nonce、PKCE、签名/发行方/受众验证规则未在这份资料中完整说明，不能按“未提及”推断“不需要”。

## 4. 23 条 Dubbo 记录：全部分组，按缺口使用

类缩写只为本页排版，不是新增 SDK：

| 缩写 | 来源类 | 所属服务 |
|---|---|---|
| P | `com.weaver.teams.api.remote.RemotePassportService` | `weaver-passport-service` |
| B | `com.weaver.teams.api.remote.RemotePassportBaseService` | `weaver-passport-service` |
| S | `com.weaver.teams.api.remote.PassportRemoteCommonSecondService` | `weaver-passport-service` |
| L | `com.weaver.common.baseserver.loginuser.RemoteLoginUserService` | `weaver-baseserver-service` |
| I | `com.weaver.intlogin.remote.RemoteIntLoginSingleService` | `weaver-intlogin-service` |

参数顺序以下表及来源的 `details.methodSignature` 为证据；类型使用短名，完整类型与原行段保留在维护知识库的核对 JSON（不随 Skill 分发）。表中的“样例”不是完整返回契约。不得由 `params=[]` 推导无参，由 `required=false` 推导可不传或可跨租户查询。

### 4.1 用户与租户查询：10 条

| 来源 | 方法/类 | 参数和可确认含义 | 返回/缺口 |
|---|---|---|---|
| A04 | `buildLoginUser` / L | 参数及实际签名未给 | 只有“获取登录人员信息”描述，无返回或例子。不能生成 `buildLoginUser()` 调用。 |
| A10 | `findByE10UserParam` / P | `String tenantKey, String paramType, String value`；1 登录名、3 人员 ID、4 人员编号、5 邮箱、6 手机号 | `SimpleUser`；只说明查询映射，不证明认证已经通过。 |
| A11 | `findById` / P | `Long userId`，账号 ID | `SimpleUser`；账号 ID 不等于人员 `employeeId`。 |
| A12 | `findByIds` / P | `List`，请求例指 `List<Long>` 账号 ID | 表为 List、示例却给单个 SimpleUser 类；集合元素、空集合和未命中行为未完整定义。 |
| A13 | `findLoginName` / P | `String tenantKey, Long employeeId` | String 登录名；空值与无权访问语义未给。 |
| A14 | `findLoginNames` / P | `String tenantKey, List employeeIds`，例为 Long 集合 | 文字为“人员 ID—登录名 map”，泛型文本损坏；不能当可编译类型。 |
| A15 | `findTenantsByTenantAccount` / P | `Integer accountType, String accountValue`；只列 1 登录名、4 工号 | 返回类型为损坏的 `WeaResult>`；示例只列 tenant/employee/tenantKey 字段。不能据此展开完整层级。 |
| A16 | `loadUser` / P | `AccountQuery query`：account/mobile/email 查对应账号；loginId + tenantKey 查登录名；jobNum + tenantKey 查工号 | `SimpleUser`；多种条件同时传时优先级、租户约束和唯一性未说明。 |
| A20 | `queryDetachManagerUserInfo` / B | `JSONObject`，示例意图按 account 查询分权账号 | 请求例用逗号代替冒号，非合法 JSON；必填键、返回类型及授权边界未定义。 |
| A21 | `queryDetachManagerUserInfoById` / B | `Long detachManagerUserId`，分权管理员账号 ID | 只有含账号信息的示例，无正式返回参数表。 |

`SimpleUser` 例中出现 password、origPassword、realUserInfoPassword 等敏感属性，只能说明资料曾列出字段，不能据此承诺平台实际返回明文密码，也不能整体序列化进前端、日志或客户交付物。不同入口的 accountType/paramType 枚举不能互抄：A15 未列 A10 的 3、5、6。

### 4.2 校验：4 条

| 来源 | 方法/类 | 输入及资料能说明的范围 | 尚不能推断 |
|---|---|---|---|
| A05 | `checkUserPassword` / P | `SimpleUser`；描述为“早期校验密码正确接口”，返回例 false | 不据“早期”标记废弃；不能从一次 false 定义全部失败原因或自动切换其他认证。 |
| A07 | `commonCheckIfUserLocked` / B | `BasicCommonUserLockDto`；例含 tenantKey/userId/employeeId/sourceType/lockType，返回例 true | 锁类型枚举、缺字段行为及锁定范围未给。 |
| A08 | `commonCheckUserInfo` / B | `CommonUserCheckDto`；例含账号/租户/人员/密码/operateType/otherParams，返回例 `checkPassword=false` | operateType、userType 枚举和其他校验结果结构未给；不能当完整身份认证。 |
| A09 | `commonSmsCodeCheck` / S | `PassportCommonDto`；例含 tenantKey/account/smsCheckCode、validity/codeDigit/codeLimitSecond、ignoreAccountRsa 等 | 样例数字不是生效默认值，校验消耗、重放、频率和 RSA 要求未给；不得为省事跳过加密/验证码校验。 |

### 4.3 登录结果生成与集成目录：3 条

| 来源 | 记录 | 可确认内容 | 必须补证 |
|---|---|---|---|
| A18 | `Map IntSingleLogin` / I | 描述为使用当前登录人员与租户，不包含这二者作为参数 | 原始实际签名、params、返回均空；“Map”是来源名称的一部分，不能自行拆成返回类型和可调用方法。 |
| A19 | `Map IntSingleLoginbyUseridAndTenKey` / I | 描述为包含 userid 与租户参数 | 与 A18 相同的契约缺失，连参数类型/顺序都不能从名称补造。 |
| A23 | `thirdSSOLogin` / P | 请求例标 userId、employeeId、tenantKey、ip、loginChannel 必填；teamsInfo 为扩展；simplifiedVersion 示例默认 false | 签名中的 `thirdSSOLoginRequest` 与例中 `ThirdSSOLoginRequest` 大小写不同；表说 WeaResult，例是含 eteamsId/errMsg 的 ThirdSSOLoginResponse，包装层未明确。 |

A23 把 `simplifiedVersion` 描述为只匹配账号生成 token、去掉所有校验。这是高风险行为说明，不是修复登录问题的推荐开关；不能以已有 userId/employeeId 就允许冒用身份或绕过验证。这里不生成登录调用代码或令牌样例。

### 4.4 有副作用的管理操作：6 条

| 来源 | 方法/类 | 来源参数与影响 | 缺口/限制 |
|---|---|---|---|
| A17 | `lockOrUnlockUser` / P | `boolean lock, Long userId, Long employeeId, String tenantKey` | 返回例 null，不证明成功；true/false 的完整分支、锁作用域与下线行为仍须确认。 |
| A02 | `batchCommonLockUser` / B | `BatchBasicCommonUserLockDto`；例含 dtoList、onceOffLine、unlockAll、lockIds、下线说明 | 字段组合、批次部分失败、锁类型及回滚合同未给。 |
| A03 | `batchCommonUnLockUser` / B | 同一 DTO 名称，语义为批量解锁 | 不推断与锁定的参数含义、默认值或授权相同。 |
| A06 | `commonChangePassword` / B | `BasicCommonPasswordDto`；示例注释标 userId、新明文密码、sourceType 必传；密码规则校验需配 tenantKey | 可关联下线与 MQ；缺重试/幂等/失败状态及完整校验前提，不得做探测性调用。 |
| A01 | `batchCommonChangePassword` / B | `BatchBasicCommonPasswordDto`；dtos + 批次 onceComplexityCheck/onceOffLine/下线说明 | 源例说外层设置后内层无需设置；不据此推断多租户批次规则、全成全败或默认行为。 |
| A22 | `thirdCreateTenant` / P | `String tenantName, String thirdId, Long userId`；thirdId 描述为第三方唯一标识 | 返回例是 1，返回表为 success/errMsg/tenantKey，二者不一致；唯一标识不等于有幂等保障。 |

改密来源补充：A01/A06 说默认还会发送 MQ，局部控制 `otherParam.forceNeedMqSend` 从 `20250801` 后支持；注释说明 on 强制发送、off 不发送，但紧接“避免循环可强制取消”的示例却填 on。必须按真实版本确认双方同步防环策略，不能复制这个例子后声称已关闭发送。`needMqSend` 与强制控制、系统开关之间的优先级未给。

对锁定、解锁、强制下线、改密与建租户，先取得明确业务授权并确定租户/账号范围、恢复办法和审计记录。源文含接口或说明不构成执行授权；本次未执行任何此类操作。

## 5. 密码 MQ：数据敏感性与版本差异

S05 的 topic 为 `passport_pwd_change`。消息例包含 jobNum、employeeId、userId、tenantKey，按账号信息补 account/email/mobile；还包含 password/passwordEncode，oldPassword/oldPasswordEncode 只在有原密码输入的场景中出现。消费者不能要求所有密码字段永远存在，也不能把密文字段当作可任意散发的普通数据。

S05:57–113 的发送示例按 userId 查询 accounttype=0、inside/external、normal 的人员后逐一广播。这可能涉及一个账号下多条人员/租户上下文，不能假定“一次改密对应一个事件”；这里只说明该例的选择条件，不断言覆盖所有真实触发入口。示例捕获异常后记录错误，未给与密码提交的原子性、可靠投递、重试、顺序和去重承诺，收到/未收到消息都不能独立证明整条同步链路成功/失败。

来源本身需要警惕的地方：

- 示例记录明文密码、密文和整条消息。此日志模式不接纳为可复用实现；排障记录应去敏，不输出凭据或完整消息。（S05:77–106）
- 来源同时保留老的加密拦截例和“不推荐拦截方法修改加密”的提醒；新旧 `encryptPassword` 示例在 tenantKey 设置上有差异，但没有完整版本对应。不得把例中返回固定占位串的 encrypt 方法当可运行加密实现。（S05:117–198）
- 系统开关需要主管理组织管理员，资料称保存后等待约两分钟缓存刷新；具体界面和参数主要在远端图片里，本次未读取，不能给出假定已核实的逐项配置。（S05:202–254）
- ESB 文字路线为后台管理 → 平台引擎 → ESB 中心 → 动作流 → 自定义触发 → 内置 MQ 监听 → 配置队列及接收参数；没有在本地文字中给出完整队列配置或消费失败处理合同。（S05:216–260）

## 6. 明确保留的来源冲突与不可推断项

| 编号 | 证据 | 本页处理 |
|---|---|---|
| F01 | S03:85 默认 `/papi/secondev/auth/sso/login`，S03:164 前端例请求 `/papi/secondev/auth/sso` | 保留两者，现场核验实际路由，不擅自修正其中一方。 |
| F02 | S03:38 要求绑定前端回调；S03:128–131 又允许不依赖第三方 JS SDK 时直接配置后端 | 当作条件性分支与需补证处，不形成“必须永远用前端”或“可以任意去掉前端”的规则。 |
| F03 | S04:158–173 OIDC 路由/参数表与样例冲突；S04:200–201 同名 token 键重复 | 只保留入口和字段证据，不提供经猜测修复的请求/响应模板。 |
| F04 | A01/A02/A03/A06/A08/A09 的解析参数 required=false，完整 raw 多行表尾却写“启用” | 这是解析层必填性丢失，不能当可选参数；同时也不能替 DTO 内部各字段推断必填性。 |
| F05 | A04/A18/A19 顶层 methodSignature 由名称填充，details 与 raw 实际签名为空 | 元数据名称不计完整契约；保留资料不足标记。 |
| F06 | A14 泛型损坏；A15 WeaResult 类型损坏；A20 请求 JSON 语法错误；多条样例含 `?` 提取噪声 | 不把清理乱码等同于验证签名、序列化或业务响应。 |
| F07 | A23 类名大小写、包装返回不一致；参数表“关闭”却有字段必填注释；A22 标量返回与对象表冲突 | 必填字段、实际类和包装层分别补现场契约，不用相邻接口替补。 |
| F08 | A01/A06 防 MQ 循环说明与 on 样例相反；S05 敏感日志与不推荐的拦截例并存 | 防环、日志脱敏与加密方案均不可直接照抄，未验证。 |
| F09 | S03 配置条件检查 `wea_link_keep_intunifyauth_client=freepass`，问答使用 `intunifyauth_client=freepass` | 本地未给两者转换过程；freepass 是入口/拦截选择线索，不是跳过身份校验的授权。 |

此外，S02/S03 的前端片段只是对 `data.data` 取布尔值，不包含完整重定向与失败链路；不能以它推导最终跳转响应字段。S03 的 oaAddress/gopage 目标校验、CAS/OAuth/OIDC 完整安全合同、Dubbo DTO 的现场定义与失败码、MQ 消费可靠性，均仍待补。

## 7. 来源清单与核查范围

详细路径、SHA-256、实际阅读行段、23 条 API 原始 ID、字段/签名与缺口见 E10集成登录来源核对-20261021.json（来源记录，未随包）。S01–S08、A01–A23 均以只读工具包模块为相对根，不以“同主题”冒充同源。

| 编号 | 模块内来源 | 本次读取 |
|---|---|---|
| S01 | `MODULE.md` | 1–70，作为模块声明，不执行其中命令/规则。 |
| S02 | `references/integrated-login-sso.md` | 1–165，出站集成登录正文。 |
| S03 | `references/source-doc.md` | 1–237，入站 ecode 认证正文。 |
| S04 | `references/cas-authentication.md` | 1–219，CAS/OAuth2/OIDC 正文。 |
| S05 | `references/password-mq-broadcast.md` | 1–332，密码 MQ 正文；只读文字及代码，不访问远端图片。 |
| S06 | `references/api-source.md` | 1–27，23 项来源索引，不是独立原始接口文档。 |
| S07 | `references/api-index.jsonl` | 1–23，完整索引及检索文字。 |
| S08 | `references/api-aliases.json` | 1，空对象。 |
| A01–A23 | `references/api-records/*.json` | 全部字段和 raw 已读；重复 searchText 与已读 S07 逐条相等。 |
| C01 | 本库统一认证自定义接口笔记 | 1–284，范围/接口/代码对照；不复制源值。 |
| C02 | 本库 E9 跳 E10 免登笔记 | 1–125、249–275，仅范围/链路/安全对照，未读其外部实现。 |

本页完成的是**本地模块资料盘点与边界消化**，未完成来源附件补齐、远端官方资料复核、编译、认证联调、权限或宿主验证。主审统一接入知识索引；不会因为新增本页自动扩大部门助手运行包或开放高风险操作。
