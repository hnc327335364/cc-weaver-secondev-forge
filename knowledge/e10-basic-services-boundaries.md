---
title: "E10基础服务申请处理与模块权限接口边界"
platform: "E10"
status: internal-trial
source_record: "e10-basic-services-boundaries"
source_manifest: manifest.json
---
# E10基础服务申请处理与模块权限接口边界

> 随包解释卡，供内部试用。通用正文、API、案例与已有本地附件先查 [资料导航](../library/catalog.md)，按标题或符号检索后使用 document_id 读取；不依赖维护者电脑路径。本页的核读日期、数量与行号描述当时的整理范围，不代表当前整库验收。详细维护记录不随包，客户工程与现场配置另行提供；知识卡指纹见 [manifest.json](manifest.json)。

## 先看结论

“基础服务”不是一套可以统一调用的租户管理 API。工具包中的这个模块包含 **30 个 HTTP 入口及 6 条另外归档的 API 记录**，分别涉及申请处理、菜单配置、短信、当前身份、账号展示、系统消息、模块展示、租户许可和权限转移。它们不能互相代替：**能看到菜单、组织已认证、某模块未被禁用，都不等于当前人员有权读取或修改业务数据。**

本页适合先定位接口家族、识别缺失合同和估算前置工作，不是可直接执行的请求集合。尤其不能把文档里的 GET 都当只读：发短信、绑定联系人手机、保存账号展示配置、设置消息已读都被写成 GET；其中 `saveConfig` 明示“不传则更新为空”。

## 1. 适用范围、来源与本库增量

2026-10-21 核读 e-code 工具包 `1.3.4` 的 `e10-basic-services-docs`：MODULE 48 行、正文 6,019 行、6 条 API 共 371 行、3 个导航文件 17 行，共 **11 文件、6,455 个物理文本行**。正文重复展开的布局/错误表格部分采用“原始行文本＋全部对应行号”的无损归并阅读；不同文本均保留，不能据扁平表自行还原未知 JSON 层级。细节见 来源核对记录（来源记录，未随包）。

- `1.3.4` 是e-code 工具包版本，不是 E10 产品基线。正文 30 个入口未标逐接口最低基线；2 条 Dubbo 声明 `10.0.2307.00`；4 条权限转移 HTTP 声明 `10.0.2506.01`。不能把后两组的基线套给正文。
- 只读本地快照，未执行源码、检索脚本、接口、登录、短信、权限变更或客户操作。两份检索脚本未作代码审查；原文在线地址未重新访问，来源快照不证明文档最新或现场可用。
- 未复制来源租户值、人员值、客户名称、凭据和完整模块清单；示例出现的模块标识不是目标租户授权清单。
- 以下引用 `H02` 指正文物理行；`A01—A06` 指 6 条 API，详细路径、SHA-256、行数、阅读范围和断言证据均在来源核对记录。

本库相邻资料已按明确范围对照，结论是**链路相邻、非同源全文替换**：

| 已有资料与本次对照范围 | 本页只补什么 |
|---|---|
| E10登录与主框架前端扩展边界（来源资料，需在 library 按标题检索），40—115 行 | 其主语为前端登录/身份切换、菜单渲染和 LayoutSDK；本页补基础服务 HTTP、模块展示和许可 RPC，不把前端查询返回 void 补成数组。 |
| [E10集成登录与认证Dubbo接口边界](e10-auth-boundaries.md)，104—162 行 | 其主语为账号查询、校验、登录与有副作用的账号管理；本页不重复认证方案，补组织身份列表、申请处理和许可查询。 |
| [E10后端基础设施选型与上下文边界](e10-backend-infrastructure.md)，54—64 行 | 已有通用 RPC/SAPI 调用器版本分流；本页补具体业务合同缺口，不因调用器存在就补造签名。 |
| [E10表单必填与记录权限及双端入口核查](e10-form-permission-entry.md)，40—92 行 | 已有记录授权与界面展示区分；本页补个人菜单和模块许可的另一层边界，不扩大为完整平台授权模型。 |

## 2. 按业务分支定位，不按“基础服务”总名猜参数

以下 8 组共 30 个正文入口，路径/方法是来源记载，不代表已经在目标环境验证。正文多数返回表含 `code/msg/status/data/outErrorCode/isFail`，但未定义统一成功码、字段优先级或全部失败语义；不能只凭 HTTP 200、字段存在或任一布尔值判定业务成功。

| 家族 | 入口数与正文范围 | 使用前的首个核查点 |
|---|---|---|
| 加入团队申请 | 5；H02:7—2172 | 申请记录、当前人员申请列表与处理动作分开，不能用查询记录接口创建人员。 |
| 解绑申请 | 3；H02:2173—4185 | 返回有申请设备及 `deviceConfigId`，不把它混为加入团队申请。 |
| 个人设置菜单 | 8；H02:4186—4959 | 实为四类动作各有两条路由；前台展示与后台配置/写入分开。 |
| 短信厂商配置 | 3；H02:4960—5227 | 查询响应列出密钥类字段；查配置不等于可安全公开返回，也不等于发送短信。 |
| 团队/当前人员身份列表 | 3；H02:5228—5440 | 当前身份、账号 ID、人员 ID 与租户 key 分开，不凭传入租户字符串证明授权。 |
| 手机验证码/租户联系人 | 3；H02:5441—5660 | 发码、验码、换联系人是不同阶段；全被记为 GET，不能用于只读探测。 |
| 个人账号信息展示设置 | 3；H02:5661—5863 | 保存 `showWays` 可清空设置；不是修改真实手机号/邮箱的接口。 |
| 基础系统消息 | 2；H02:5864—6019 | 查询收到的消息与标已读，不是创建消息或统一待办推送。 |

### 2.1 加入与解绑申请

| 动作 | 原路径 / 方法 | 已给合同及缺口 |
|---|---|---|
| 查询加入申请操作记录 | POST `/api/basicserver/operaterecord/pageOperateRecord` | JSON body 列六类条件数组、tenantKey、keywords、pageNo/pageSize、type、dealStatus；type 为 and/or，dealStatus 为 processed/untreated；分页默认值、上限和条件嵌套结构未完整说明。（H02:9—159） |
| 取消加入申请 | POST `/api/basicserver/operaterecord/cancelApplyMessageNew` | body 列 userId、tenantKey、applyRecordId，返回 data 为 boolean；三字段都标非必须，不据此生成无参取消或猜默认目标。（H02:161—234） |
| 批量处理加入申请 | POST `/api/basicserver/operaterecord/batchDealApply` | query `type` 必传：accepted 同意、refused 拒绝；body 为申请记录 ID 的 integer 数组，不擅自包装成 `{ids: ...}`；批次部分失败、重复处理和回滚规则缺失。（H02:236—313） |
| 查询个人申请的团队 | GET `/api/basicserver/operaterecord/queryCurrentEmployeeApplyTeams` | 无参数说明；data 为含申请记录与租户信息的对象数组，不是所有可登录团队，也不是全组织用户清单。（H02:315—383） |
| 加入申请高级搜索布局 | GET `/api/basicserver/operaterecord/getSearchCondition` | 可选 dealStatus；返回布局描述，不是待处理申请数据。（H02:385—2171） |
| 查询解绑申请 | POST `/api/basicserver/unbindapply/pageUnbindApply` | 与加入申请类似条件表，但有申请设备与设备配置 ID；不能将两类记录 ID 混用。（H02:2175—2324） |
| 批量处理解绑申请 | POST `/api/basicserver/unbindapply/batchDealApply` | 同样为 query type＋integer 数组 body；作用对象仍为解绑申请，不能因同名便共享业务状态机。（H02:2326—2403） |
| 解绑高级搜索布局 | GET `/api/basicserver/unbindapply/getSearchCondition` | 请求参数段为空；不可借用加入申请接口的 dealStatus 参数声明。（H02:2405—4184） |

条件/布局表反复使用相同 `├─` 层级，无法仅凭位置恢复全部对象嵌套。表内的可见、只读、禁用等布局字段也不是后端权限合同。实现前取实际接口声明或脱敏请求/响应，不提供猜测的完整 JSON。

### 2.2 个人菜单：四对路由不能自行归一

| 动作 | 来源列出的两条路径 | 输入/输出要点 |
|---|---|---|
| 前台列表 GET | `/api/basicserver/queryFrontSingleNavigationMenuList`；`/api/basicserver/singlenavimenu/queryFrontSingleNavigationMenuList` | query clientType 可选，未列端类型枚举；data 为菜单对象数组。（H02:4188—4374） |
| 后台新增 POST | `/api/bs/basicserver/batchAddSingleNavigationMenu`；`/api/bs/basicserver/singlenavimenu/batchAddSingleNavigationMenu` | JSON body 为菜单项数组；返回 data boolean。（H02:4376—4572） |
| 后台更新 POST | `/api/bs/basicserver/batchUpdateSingleNavigationMenu`；`/api/bs/basicserver/singlenavimenu/batchUpdateSingleNavigationMenu` | 同样为菜单数组，未定义省略字段保留还是清空、批次是否原子。（H02:4574—4770） |
| 后台配置列表 GET | `/api/bs/basicserver/querySingleNavigationMenuList`；`/api/bs/basicserver/singlenavimenu/querySingleNavigationMenuList` | query clientType 可选，data 为菜单对象数组。（H02:4772—4958） |

菜单字段包含 menuName/customMenuName、menuEnable、url、openWay、useLimit、orderNo、menuType、menuAuth、menuKey、clientType 及国际化字段。文档没有给 menuEnable/openWay/useLimit/menuAuth 的完整取值或权限计算规则；不把字段名翻译成具体配置值。`i18nMenuName/i18nCustomMenuName` 被标为展示用非入库字段，也不能因它们同时出现在请求表就建议写入数据库。

来源没有标两套路由的别名/废弃/迁移/兼容关系。不得随机选一条、将失败路由自动重试到另一条写入接口，或据前台列表可见就认为后台配置与目标业务数据也有权访问。

### 2.3 当前身份、组织认证和许可状态分开

- GET `/api/app/basicserver/siblingstenant/list`：来源为当前用户组织/人员列表，含 employeeId、tenantKey、tenantName、isCurrent、identityEmployee 等；另有 userId、accounttype、belongto、externalTenant 等字段。账号 ID 与人员 ID 不可互换，列表结果不自动授予跨组织访问权。`isAuthStatus` 描述为“组织认证信息”，不是模块授权布尔值。（H02:5230—5348）
- GET `/api/app/basicserver/siblingstenant`：仅写“查询租户组”，请求为空，返回表只有 `key / null`；不能从相邻列表入口搬入同一 schema。（H02:5350—5366）
- GET `/api/basicserver/external/queryExternalEmployees`：标题写按 user_id 和 tenant_key 查外部联系人，但请求参数段为空；返回列 employeeId/customerName/userName/contactName/showName/tenantKey/userId/isCurrent。不能按标题生成 query 参数名称、必填或授权规则。（H02:5368—5439）

身份列表存在客户定制注释字段重复、`uuid` 被标 integer 等来源特征；这里只保留缺口，不抄客户身份、不把定制字段当标准必有字段，也不擅自把来源类型改成通常猜测的 UUID 字符串。

### 2.4 短信、账号与消息：GET 也可能写入或外发

| 目标 | 原入口 / 参数 | 不能省略的边界 |
|---|---|---|
| 新增/修改短信厂商配置 | POST `/api/bs/basicserver/basicsmsconfig/addBasicSmsConfig`、`updateBasicSmsConfig`；JSON body 列 `smsProvider`、租户、启用状态和各厂商凭据字段 | 字段存在不说明不同厂商需要全部同时填写，也没给更新时保留/清空规则；不能写试验密钥探测。（H02:4962—5140） |
| 查询短信配置 | GET `/api/bs/basicserver/basicsmsconfig/queryBasicSmsConfig`；query tenantKey 可选 | 响应表列 appSecret、AccessSecret、AuthToken、Password 类字段，未说明实际是否掩码或过滤；避免整包记录日志、返回浏览器或写入交付物。（H02:5142—5226） |
| 发送联系人手机验证码 | GET `/api/bs/basicserver/tenantInfo/sendMobileCode`；mobile、cacheMark 必传 | cacheMark 仅举 `TENANT_INFO_VERIFY`；此处是外发短信，非只读验证。频率、有效期、验证码绑定与重试合同未给。（H02:5443—5513） |
| 校验验证码 | GET `/api/bs/basicserver/tenantInfo/checkMobileCode`；mobile、cacheMark、verifyCode 必传；data string | 没有说明字符串成功码、空值、失败格式及一次性消费规则；不猜 `data` 必然就是下步 successCode。（H02:5515—5586） |
| 更新当前租户联系人手机 | GET `/api/bs/basicserver/tenantInfo/bindTenantContactMobile`；mobile、verifyCode、successCode 都标可选，后者备注为前序步骤成功码 | 不因“可选”绕过验证码，不猜 verifyCode 与 successCode 是二选一或必须同时传；先补顺序、绑定范围及失效合同。（H02:5588—5659） |
| 前台/后台查询账号展示设置 | GET `/api/basicserver/personalaccount/queryConfigFront`、`/api/bs/basicserver/personalaccount/queryConfig`；data string | 未定义完整字符串返回格式；不把设置查询当实际邮箱/手机号查询。（H02:5663—5726、5799—5862） |
| 保存账号展示设置 | GET `/api/bs/basicserver/personalaccount/saveConfig`；query showWays 可选，email/mobile 逗号拼接 | **明确“不传则更新为空”**，不可自动在缺参数时调用，也不做 URL 可访问性探测。（H02:5728—5797） |
| 查询当前人员基础系统消息 | GET `/api/basicserver/tenantSysMsg/queryTenantSysMsg`；pageSize/pageNo 示例分别为 10/1 | 这两个数字处于“示例”列，不宣称平台默认值；返回含 currentPage/pageSize/indexNum/totalCount/datas，未给统一待办推送合同。（H02:5866—5948） |
| 标记系统消息已读 | GET `/api/basicserver/tenantSysMsg/setMsgReadable`；query msgId 可选；data object | 属于状态修改；未说明省略 msgId 的作用范围，不能自动标全部已读。（H02:5950—6019） |

手机、验证码、successCode 以及配置凭据应按敏感信息处理；来源的 GET/Query 形式不构成向日志、聊天或交付材料复制真实 URL 的理由。本页只记录事实，不能未经现场确认改写 HTTP 方法或加密协议；安全传输及日志屏蔽方案另行确认。

## 3. 模块展示、租户许可与权限转移：6 条 API 的真实合同深度

### A01｜listDisplayModules：有展示模块列表，不等于已证明数据授权

- 服务 `weaver-basic-web-service`，类 `com.weaver.teams.domain.appmgmt.RemoteAppModuleService`，最低基线声明 `10.0.2307.00`；group/version 空。
- 签名原文是 `listDisplayModules(java.lang.Lang,java.lang.String)`；参数表把 employeeId 写成 `java.lang.Lang`、标非必选，tenantKey 为 String、必选。调用示例却只传一个租户字符串。**类型拼写与参数数量存在冲突**，不能擅自修成 Long 后声称可调用，也不能据此确认有一参重载。
- 返回参数表为 `java.util.List`、名称 displayModules、描述“展示模块”，示例是模块字符串列表。未定义无权/无许可/空值/异常等完整语义，亦未说明模块内记录和动作权限。实施前先核实实际签名和人员/租户来源。

### A02｜queryLicenseModuleListByStatus：查询禁用许可，不生成“已授权模块”

- 服务 `weaver-tenant-service`，类 `com.weaver.teams.api.remote.RemoteTenantLicenseService`；签名 `queryLicenseModuleListByStatus(java.lang.String,java.lang.String)`，最低基线声明 `10.0.2307.00`；group/version 空。
- tenantKey、status 都必传；资料只解释 `disable` 为禁用，没有给全部 status 枚举，不能自造 enable/active 查询。
- 描述为“内部查询租户禁用模块信息”；responseParams 为空，响应示例是模块字符串数组，不能据此确定 Java 泛型、完整返回包装和错误语义。示例指向实现方法位置，不是可直接复制的调用语句。
- 禁用列表的补集不自动等于“所有已购且当前人员有权的模块”；许可范围、模块展示、业务记录授权须分别核对。

### A03—A06｜权限转移：四个 POST 只有元数据，不能组装执行器

| 来源 | 路径（均为 POST） | 原说明 |
|---|---|---|
| A03 | `/api/architecture/permission/transfer/module/v1/opt/extend` | 执行权限转移 |
| A04 | `/api/architecture/permission/transfer/module/v1/opt/extend/refresh` | 查询权限转移执行结果 |
| A05 | `/api/architecture/permission/transfer/query/v1/module` | 查询某个人员组织的可以转移的权限数据 |
| A06 | `/api/architecture/permission/transfer/query/v1/module/content` | 查询具体转移的数据 |

四条最低基线均记 `10.0.2506.01`，raw 中服务为 `weaver-architecture-service`。结构化 `serviceName` 却混入换行及创建时间，这是解析污染，不是服务注册名。虽然记录标 active、raw 写“是否对外：是”，但 Content-Type、请求参数、响应参数、请求/响应示例和调用示例全部为空；**空数组不等于无参**，也不证明无需登录或任意用户可转移权限。

此处只能形成补证清单：转移主体与接收者、租户/组织边界、可转移对象类型、授权前提、执行任务标识、状态枚举、部分失败、重试/幂等、撤销/恢复与审计。不能从 refresh 名称推定可靠轮询机制，更不能默认先执行 A03 以获得其余参数。

## 4. 来源冲突与缺口保留清单

| 编号 | 证据 / 问题 | 本页处理 |
|---|---|---|
| F01 | H02 多数字段“非必须”、返回 code/status/isFail 无明确成功语义；大量错误与布局表扁平展开 | 不生成未知嵌套 JSON、不推导无参成功或 HTTP 200 业务成功。 |
| F02 | H02 个人菜单四对不同路由，基线及兼容关系未标 | 原路径分别保留，不声明别名或废弃，也不自动重试写入。 |
| F03 | H02:5350—5366 租户组返回仅 key/null；5368—5379 标题有查询条件而参数段空 | 把它们作为合同不足的独立入口，不挪用相邻接口结构。 |
| F04 | H02:5254 组织认证状态；5298—5303 客户定制字段重复 | 组织认证不是许可/数据授权，定制字段不升级为标准必有。 |
| F05 | H02:5443—5660、5728—5797、5950—6019 GET 含外发/写入，saveConfig 有缺省清空 | 保留原方法但明确副作用；只读任务不调用这些入口。 |
| F06 | H02:4990—4999、5175—5184 密钥类字段在请求和响应均列出 | 只保留字段类别与风险，不推断已脱敏、不复制真实配置。 |
| F07 | A01 签名与参数表含 java.lang.Lang，两参签名与单参例不符 | 标明类型/参数冲突，待实际依赖与服务确认。 |
| F08 | A02 只给 disable，正式返回参数为空 | 不补其他枚举、完整返回类型或授权补集。 |
| F09 | A03—A06 的 serviceName 混入创建时间，业务参数/返回全空 | 区分原始服务名与解析污染；仅保留定位线索，不准入调用工具。 |
| F10 | 正文无最低基线；Dubbo 与权限转移分属不同最低基线声明 | 分组记录，不将助手版本或其他组基线当统一兼容性结论。 |

## 5. 项目人员下一步：只补当前分支所需材料

1. 先说清楚这次是查当前身份、处理申请、改菜单、查许可、转移权限，还是改联系人/账号展示。先完成分类，避免为一个列表需求顺带设计权限转移。
2. 选定一条实际接口后，取得目标 E10 基线/依赖、真实路由与方法、认证角色/租户范围、脱敏参数和成功/失败返回；有冲突的签名按现场声明确认，不让开发凭本页“补全”。
3. 写操作另确认目标、审批授权、重复执行/部分失败和恢复策略。查询与写入的验收分开；只读任务不以发送验证码、保存配置、批量批准或权限转移作为连通性验证。
4. 获授权测试时只验证本次需求涉及的链路：正确角色/租户应成功、不应有权者应被拒绝，且业务状态与返回一致。保留脱敏证据，不能把本地文档检查当现场验收。

当前完成的是模块文本消化和契约边界整理，**不是 API 调用验证、SDK 编译验证、客户验收、工具安全准入或宿主兼容性测试**。原件和旧正文保持只读；新增知识页由维护索引接入，不要求使用人员逐份阅读所有来源。
