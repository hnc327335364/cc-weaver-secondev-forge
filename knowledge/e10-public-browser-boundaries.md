---
title: "E10公共浏览框与业务查询接口边界"
platform: "E10"
status: internal-trial
source_record: "e10-public-browser-boundaries"
source_manifest: manifest.json
---
# E10公共浏览框与业务查询接口边界

> 随包解释卡，供内部试用。通用正文、API、案例与已有本地附件先查 [资料导航](../library/catalog.md)，按标题或符号检索后使用 document_id 读取；不依赖维护者电脑路径。本页的核读日期、数量与行号描述当时的整理范围，不代表当前整库验收。详细维护记录不随包，客户工程与现场配置另行提供；知识卡指纹见 [manifest.json](manifest.json)。
> 分发说明：此为已纳入当前清单的随包副本。原稿“未将新卡片自动装入”描述入库当时状态；正文提到的同目录来源JSON未随包，仅留维护知识库。原稿的核读范围是维护记录，不代表当前AI读过原件。

先分清要做的是“已有 ID 回显”“名称反查 ID”“查询可选数据”还是“建立事项关联”。这四件事对应的接口、方向和授权条件不同，不能仅因名称都含 browser 就替换调用。

本页完整核读工具包归档模块的 **12 篇正文（1,754 行）和 3 条结构化 API（252 行，含 raw）**；连同模块说明、3 个导航文件，共 19 份非脚本文本、2,064 行。另选读本库 3 页共 281 行。2 个搜索脚本只登记文件指纹，未阅读、未执行；没有打开源中外链或图片，不能声称截图和外部对接清单也已核验。具体范围见同目录 来源核对记录（来源记录，未随包）。

这是来源知识整理，不是已部署接口规范：e-code 工具包 **1.3.4 不是 E10 业务基线**。A01/A02 自报最低 `10.0.2307.00`，A03 为 `10.0.2511.01`；正文未统一给最低基线，不把 API 记录的基线扩展到所有浏览按钮、组件或 Hook。（A01:11–18；A02:11–18；A03:9–18）

## 1. 按要解决的问题选入口

| 需要 | 来源入口 | 结果和边界 |
|---|---|---|
| 表单已经选了浏览值，只想读名称或对象 | `getBrowserShowName`、`getBrowserOptionEntity`；字段对象含 `specialObj` | 先用当前表单实例的数据，不必为已存在的展示信息另造远程查询。（L03:240–277、1248–1280、1340–1355） |
| 只有 ID，批量补显示内容 | `RemoteBrowserService.queryBrowserByParam(List<BrowserParam>)` | 按 `browserType` 分组的 `Map<String,List<BrowserEntity>>`；不是候选列表分页 API。（D01:25–44、568–597） |
| Excel 名称需要转成存储 ID | `RemoteBrowserQueryByNameService.queryBrowserDataIdsByName(...)` | 每项有 `name/count/dataId/module/browserType`；重名数量必须保留，不能将返回一个 ID 当作唯一匹配。（D03:14–51） |
| 查询浏览框可选数据或数量 | 开放平台 POST 转发，或内部 `RestBrowserRequest` | 按实际模块的 data/count/complete 合同取数；不是上述 ID 回显接口。（D02:60–95；D04:6–28） |
| 查询自定义浏览框配置/类型 | `RemoteCustomBrowserService`，无 group | 提供配置元信息，不等于执行该浏览框的业务数据查询。（D05:6–26） |
| 建立对象之间的事项关联 | `create.common` / `createByList.common` | 是写关联；回显、跳转和权限传递仍是独立对接点。（D07:6–115；D08:26–51） |

## 2. ID、回显对象和协议层不要混用

### 2.1 已有 ID → 回显

`BrowserParam` 的有用字段为 `user/module/fromModule/browserType/languageId/dataIds/customParam`。`user` 表示当前用户，`module` 为被调用模块，`fromModule` 为调用来源；`customParam` 可能有模块特殊要求，不能把它写成“任意填空即可”。正文明确不同模块还需要查实际对接约定。（D01:109–155、645–649）

正文记载 2022-12-14 将旧 `id` 换为 `dataId`，请求的 `ids` 也标废弃，应采用 `dataIds`。其示例兼容类的 getter 会在新字段为 null 时退回旧字段；`setDataIds/setDataId` 同时写新旧字段，旧 setter 只写旧字段。因此这是**该源码样例的兼容行为**，不是承诺任意版本、HTTP 接口都已统一改名。内部 `Browser.getBrowserEntities` 示例仍以 Map 键 `ids` 承接 `param.getDataIds()`，不可全局替换字符串 `ids`。（D01:12–15、135–155、192–231、258–262、499–512、541–550）

回显 `BrowserEntity` 的关键含义：`dataId` 是数据 ID，`content` 是内容，`title` 是提示文本，另有头像/图标、时间、`isDelete/isComplete`、`custom/customFields` 及组合浏览字段。`content/title` 不等于唯一业务键，`isDelete/isComplete` 也不是访问权限证明。（D01:256–309；后一句为本页使用边界）

提供方按模块注册带 group 的 `RemoteBrowserService`，同服务内由 `browserType` 分流；调用方使用默认、**不带 group** 的入口，由 `module` 路由到提供方。D01 的 `ModuleGroup` 大小写混合，并明确要求注意大小写：例如文档 group 常量为 `DOCUMENT`，调用样例却传 `module="doc"`。这是 group 与模块路由的映射问题，不宜自行统一大小写；映射清单在外部，本次没有读取。A02 空 group 与默认调用说明相符。（D01:47–89、635–678；A02:11–18、29–34）

### 2.2 回显对象 → 表单字段

本库表单 SDK 明确浏览字段传 `specialObj:[{id,name,data?}]`，清空用 `specialObj:[]`；自定义浏览的 `data` 还可能包含 `linkUrl/appLinkUrl` 等模块属性。后台回显的 `dataId/content` 与表单的 `id/name` **不是同一对象合同**。需要转换时先确认目标控件 ID 类型、展示字段和专有 `data`，不要直接把 `BrowserEntity` 整个塞进 `changeFieldValue`，也不要丢失已有模块数据。（L03:286–307；本页适配建议）

本库配置指引规定自定义浏览 `module=bcw`、`type=customBrowser_` 加后台配置标识；这描述组件参数，不是通用 Dubbo group。`moduleSignToModule` 提供 PC/H5 路径和事项卡片信息，也不是浏览数据接口或授权依据。（L01:2924–2934；L02:4490–4529）

### 2.3 名称 → ID 时，保留歧义

名称反查单独使用 `RemoteBrowserQueryByNameService`。入参含 `user`、`tenantKey`、`module`、`browserType`、`names`、`languageId`、`customParam`；`fromModule` 用于模块间特殊约定，原文说一般为空。返回 Map 的 key 是 `browserType`，每个名称记录中有 `count` 和 `dataId`。（D03:14–51、80–104）

原文允许同名只返回其中一个 ID，示例直接 `ids.get(0)`。**来源支持“给一个候选并报告同名数”，不支持“重名自动正确消歧”**。本页建议导入前约定 0/1/多命中策略：未命中留错误、单命中采用、重名由唯一编码/业务范围进一步确认，不能无声取第一条。该建议不是源接口保证，也不代表已实现批量导入。原文“如何测试”仍为待补充。（D03:14、91–100、118–124）

## 3. 列表查询、开放平台转发与自定义元信息

开放平台转发路径是 `POST /api/component/browser/v1/{module}/common/browser/{queryType}/{browserType}`；原文将普通浏览路径 `/api/...` 改为 `/api/component/browser/v1/...`，列 `tenantKey/employeeId` 为必填 header。请求体沿用**对应浏览按钮**的参数，不是全模块统一 schema；`queryType=data` 查列表、`count` 查数量。示例 body 的 `browserMultiple/current/pageSize/type` 只是示例，不能据此声称通用默认值或全部必填项。（D02:60–95）

返回样例是列表型浏览框，业务项使用 `id/content/title`，置于 `data.data` 下；正文明确其他浏览类型可能不同。这与 Dubbo 的 `dataId` 迁移不构成 HTTP 字段改名授权。文档虽然给了身份 header，却未给完整开放平台认证、授权与签名合同；不能将“能填 employeeId”理解为可以冒用身份。（D02:78–95、97–125、226–232）

内部跨模块示例有原始 Map 返回、`ResultParsers.commonCompleteResultParser`、固定参数 Map，以及 `CompleteRestBrowserRequest` 简化封装；原文提示失败时检查是否触发准入拦截。没有完整鉴权/超时/错误码约定，不把失败统一解释为“没数据”，也不把这个内部封装替换成对外 HTTP 的固定 JSON。（D04:6–28）

自定义浏览元信息服务包含：`getEbuilderSourceInfo(browserTypes,tenantKey)`、`getBrowserType(browserTypes,tenantKey)`、`getBrowserInfo(browserType,tenantKey)`、`getBrowserInfoById(browserId,tenantKey)`。类型已列 `list/tree`，后续可扩展；两个 default 方法示例直接返回空 Map，缺少完整字段合同，空 Map 不足以断言浏览框不存在。（D05:6–26）

## 4. 数据范围：配置、变量解析和三种取数要一起对齐

数据范围的定位是为特定场景下的浏览按钮增加过滤条件。标准对接分开启设置入口、前端配置页、后端应用过滤三步，**配置保存不等于过滤已生效**。`scopeType/scopeInfo/scopeInfoRender` 由模块约定：前两者描述过滤含义，后者主要用于前端回显；来源提及统一保存表仅为机制说明，不构成本页的直接写库方案。（D06:11–56）

| 处理层 | 来源约定 | 对开发的具体要求 |
|---|---|---|
| 普通配置 | 组件把 `BrowserDataScope` 放入 `scopeConfig` | 业务实现解析本模块 `scopeType/scopeInfo` 后过滤，不复制另一模块的枚举。（D06:48–74） |
| 表单变量 | 配置中保存控件 ID，运行时 `variableMap` 以控件 ID 为键、值为选中数据数组 | 区分“控件 ID”和“实际部门/业务数据 ID”；缺失、清空、多值的处理源未定义，需现场补合同。（D06:79–131） |
| 变量发现 | `AbstractDataScopeHandler.determineBrowserType/acquireVariableKeys` | 表单先获取控件变量映射，再给取数请求加变量；示例 `demoBrowserAssemble` 返回 null，不能当完成实现。（D06:135–165） |
| 三个取数入口 | `getBrowserData/browserAutoComplete/getTotal` 对应 `/data`、`/complete`、`/count` | 三条路线都要应用同一范围；只过滤列表仍可能在补全或数量里泄露/矛盾。（D06:50–56；后半为本页核查建议） |
| 条件设计器 | 布局 `getScopeConditionLayout/{type}`；业务浏览可由高级搜索转换，数据源浏览可用后置 Hook 调整 | 先辨认原生数据源支持情况，不把布局 Hook 当运行时权限处理。（D06:168–213） |

条件设计器路线与前面的手工变量路线也不要混为一谈：前者原文说组件统一替换变量，运行时补 `scopeSql` 或 `customTreeDto`（`ConditionTreeDto`，文中仅供自定义浏览使用）；后者示例由业务代码解析 `variableMap`。正文没有证明所有模块、所有版本都支持二者。（D06:102–131、220–228）

原文让接收方拼接 `scopeSql`，但未给可信来源校验、参数绑定或防注入合同。本页只记录这一扩展点，**不将请求方任意 SQL 文本直接拼接作为可复用方案**；实施时须确认参数由可信服务端组件生成、条件语义和参数绑定链路，不接受客户端任意改写过滤规则。`appendBrowserDataUrlParam` 仅向 POST body 加参数，是否生效仍由数据提供方决定，也不能替代后端授权。（D06:222–228；L03:1229–1244）

## 5. 事项关联不是授权动作的同义词

D07 分别给 `create.common` 与 `createByList.common`，各列模块/子模块/三级模块以及 `/api/app/...` 共 6 种路径形态。单条输入为 `module/objectId/objectName/relevance`，批量将关联字段换为 `relevances:List`；其中 `object*` 是发起关联的对象，`target*` 是被关联对象。单条成功样例返回 `data.relevance.id`，批量成功样例只有状态和 `actionMsg`，不应套用单条返回结构。（D07:8–49、51–115）

上述创建页没有明确 HTTP 动词、参数必填性、幂等键、批量部分失败/事务语义或重试规则；请求示例额外出现 `objectModuleId`，字段表没有解释。不要根据 `create` 名称补造 POST 合同，不要把批量 `success` 展开为“每条均成功”，也不要不查已写关联就重试。（D07:14–49、80–115）

对接页把关联卡片、组合浏览、IM 分享分开：都涉及名称、多语言、module/type、回显和点击跳转，IM 分享还要 `imId`；“是否要对接权限传递”被列为额外问题。由此应分别验关联写入、回显、跳转、对象访问权限，不能把“关联存在”当作“已向接收人授权”。截图和已对接清单没有随此文本形成完整内容，D12 只有外链，当前不能枚举哪些模块已完成对接。（D08:6–51；D12:1–6）

## 6. 其他公共业务能力：知道入口，不补造合同

| 能力 | 当前可确证内容 | 仍不能从材料推出的内容 |
|---|---|---|
| `BusinessRest.getRelateDataInfo` | `weaver-bcw-service`、group `bcw`；参数 `SearchRelateEntity` 与 `SimpleEmployee`；返回 Map 浏览数据，最低 `10.0.2307.00` | 没有实体字段、可用请求/响应样例；不是 `RemoteBrowserService` 的同签名别名。必选栏“关闭”不等于可以任意传 null。（A01:11–18、29–94） |
| 企业信息 GET | `/api/component/modules/enterpriseInfo/findEnterpriseInfo`；`keyword` 与 `types` 为 String，例 `jcxx,qylb`；最低 `10.0.2511.01` | 服务名混入创建时间，样例不是合法 JSON；没有明确 GET 参数位置/认证/工商信息 schema。显示的 `qxbOnOff/typeMap` 更像开关/映射，不能冒充完整企业信息返回合同。（A03:9–18、29–91） |
| 公共配置 | `RemoteConfigurationExtService.getMainConfigExt(configKey,tenantKey)`；`RemoteConfigurationService` 列用户/租户/全局及批量查询、写入、删除方法；旧 `getConfigByKey` 标废弃 | 缺 group、版本、实体字段、错误/鉴权和并发合同；无 tenantKey 重载不能直接推定是当前租户。查询、创建、更新、删除不能混成“只读配置查询”。（D10:6–67） |
| 行政区域 | `queryByDataId(Long)`、`queryByDataIds(List<Long>,tenantKey)`、`queryAllByName(List<String>)` 三个签名 | 缺 group、实体结构、同名消歧、区域层级和租户选择语义；不能凭名称查询直接确定唯一地区。（D11:6–15） |
| 多 EB 小组件 | 工具包文档描述独立组件 jar 引入公共服务、REST 前缀、RPC scope、契约包和 Nacos 命名约定 | 是平台公共服务组织规范，不是客户 e-code 项目部署操作授权；文中脚本升级和注册机制仍有“待完成”，不能冒充已落地能力。（D09:6–140） |

公共小组件资料强调宿主默认安装并不替组件完成 license 控制，跨服务能力优先干净契约包；拦截器、启动类、全局异常和 AOP 等可能影响全服务的配置需统一协调。这些适合作为组件接入审查项，不应要求每个客户项目复制平台服务结构。（D09:102–136）

## 7. 来源冲突与不宜照抄的示例

| 编号 | 证据 | 保留问题及处理 |
|---|---|---|
| C01 | D01:379–393、671–678 | `setIsDelete/setIsComplete` 只给形参自赋值；第二段构造 `param2` 却追加 `param`。均为可见源码问题，未编译验证；不整段复制。 |
| C02 | D01:15、135–155、541–550；D02:120；A02:55–56 | Dubbo 新旧 ID 兼容、内部 Map 的 `ids`、HTTP 的 `id` 并存；按协议/层次核对，不能全文替换。 |
| C03 | D01:47–89、645–678；D12:6 | group 与 module 映射不完整、部分只在外部清单；不臆造所有模块同名或大小写自动兼容。 |
| C04 | A02:37–56、64 | responseExample 用数组括号包对象成员，非合法 JSON；`responseParams` 空，required 结构化值 false 但其字段 raw 为空。完整 raw 又含“关闭”，仍没有 null 语义证明。 |
| C05 | D03:91–100、118–124；D05:13–21 | 反查示例空集合直接 `get(0)`；测试章节空；旧 Dubbo 代理不支持 default 的说明与自定义元信息 default 方法同时存在。可能版本/实现不同，不合并为一套兼容保证。 |
| C06 | D06:61、119–120、149–163 | `Optional.of` 不能处理缺失 null；变量 Map 的兜底却是 List；注释 `VariableMap` 与读取 `variableMap` 大小写不同；变量组装返回 null。示意代码不是可直接运行实现。 |
| C07 | D06:178–228 | 布局 Hook 的 `bcw_customBrowser` 不能替代具体浏览框 `type`；SQL 来源/绑定和 `customTreeDto` 的通用可用范围缺失。 |
| C08 | D07:14–49、80–115 | 额外 `objectModuleId` 无字段定义，HTTP 动词与批量失败合同缺失；保持未知。 |
| C09 | A03:11、32、82–91 | serviceName 混入创建时间，GET 示例无引号并含乱码；不得把解析污染转写到服务配置或“修正”为未经来源证明的请求。 |
| C10 | D09:84–96 | scope 说明为 `rpcservice.modules.xxx..scope`，XML 为 `modules.example.rpcservice.scope`，还出现宿主拼写 `weaver-componnet-web`。配置键需按真实服务核实，不选一项当确定答案。 |
| C11 | D01:21；D02:8；D06:6；D08:13–33；D12:6 | 原始文本含内网图、鉴权分享链接或只有外链的清单。本页不复制这些地址，未将其内容算作已读取、已脱敏原件或现场证据。 |

## 8. 现场最小核查清单

以下是待执行建议，不是本次已测试结果：

1. 先记录真实浏览框 `module/type`、平台/组件版本、当前用户与租户、入口是表单实例/HTTP/Dubbo，确认专有 `customParam` 和返回层级。
2. 回显至少验一个存在 ID、删除/不可见 ID、多选 ID、跨模块同名 type；分别记录 ID、展示名、跳转和权限结果，不能用显示成功代替访问授权。
3. 名称反查验未命中、单命中、重名及多语言；由业务方确认歧义处理，不让任意第一个 ID 进入正式导入。
4. 数据范围同时验列表、自动补全、数量；再验变量未填、清空、多值、篡改输入和无权账号，确认客户端参数无法扩大后端权限。
5. 只有明确要求建立事项关联时才测试写入口；先补齐真实 HTTP 合同、失败/重复策略，并分别验证关系、回显、点击和权限，不自动重试写入。

前端字段合同继续查 E10表单引擎JSSDK文档（来源资料，需在 library 按标题检索）；实例与安全的最小字段操作参考 [E10表单SDK实例与字段操作示例补充](e10-form-sdk-examples.md)。本页未改这些旧正文，也未将新卡片自动装入部门助手运行稿。

## 来源定位

下表相对文件路径统一接在库内前缀 `01-AI-Resources AI资料整理/04-Agents Agent规则/99-SourceFiles 原始资料/e-code智能化开发工具包/1.3.4/skills/e10-local-knowledge/modules/e10-public-business-docs/` 后；L01–L03 接在 `02-Weaver-Knowledge 泛微知识库/02-E10 E10资料/` 后。正文中的 `D01:25–44` 即对应源文件行号。**行号按 UTF-8 解码后 splitlines 计算**；D03、D06、D08 含孤立 CR，已按此口径重新完整编号阅读，可能与仅按 LF 计行的编辑器不同。JSON 保留逐文件 SHA、字节数、行数、实际阅读范围和未读项。

| 来源 | 相对文件路径 | 已核读范围 |
|---|---|---|
| H01 | `MODULE.md` | 1–47，作为归档说明，不执行其中指令 |
| D01 | `references/docs/浏览按钮回显.md` | 1–721 |
| D02 | `references/docs/浏览按钮开放接口.md` | 1–233 |
| D03 | `references/docs/浏览按钮名称转id对接方案.md` | 1–124 |
| D04 | `references/docs/浏览按钮跨模块调用方案.md` | 1–28 |
| D05 | `references/docs/自定义浏览按钮rpc.md` | 1–26 |
| D06 | `references/docs/数据范围定义对接.md` | 1–228 |
| D07 | `references/docs/事项关联.md` | 1–115 |
| D08 | `references/docs/事项关联对接.md` | 1–51 |
| D09 | `references/docs/公共小组件机制.md` | 1–140 |
| D10 | `references/docs/公共配置项.md` | 1–67 |
| D11 | `references/docs/行政区域.md` | 1–15 |
| D12 | `references/docs/关联浏览组件已对接浏览按钮清单.md` | 1–6，外链正文未读 |
| A01 | `references/api-records/public-business-dubbo-getrelatedatainfo-034.json` | 1–95，含 raw |
| A02 | `references/api-records/public-business-dubbo-querybrowserbyparam-138.json` | 1–65，含 raw |
| A03 | `references/api-records/public-business-http-api-component-modules-enterpriseinfo-findenterpriseinfo-271.json` | 1–92，含 raw |
| N01–N03 | `references/api-source.md`、`references/api-aliases.json`、`references/api-index.jsonl` | 分别 1–7、1、1–3 |
| L01 | `e10平台定制开发指引.md` | 2910–2955，仅相关选段 |
| L02 | `E10-weappUtils工具库总览.md` | 4490–4565，仅相关选段 |
| L03 | `E10表单引擎JSSDK文档.md` | 240–310、1229–1287、1340–1368，仅相关选段 |

本次未运行工具包代码、编译示例或访问业务接口，未进行 WorkBuddy/Codex/DSH、Windows/macOS 或客户现场验收。
