---
title: "E10档案归档Dubbo与HTTP接口边界"
platform: "E10"
status: internal-trial
source_record: "e10-archive-boundaries"
source_manifest: manifest.json
---
# E10档案归档Dubbo与HTTP接口边界

> 随包解释卡，供内部试用。通用正文、API、案例与已有本地附件先查 [资料导航](../library/catalog.md)，按标题或符号检索后使用 document_id 读取；不依赖维护者电脑路径。本页的核读日期、数量与行号描述当时的整理范围，不代表当前整库验收。详细维护记录不随包，客户工程与现场配置另行提供；知识卡指纹见 [manifest.json](manifest.json)。

`dataToArchive` 在本批资料中分别指向 **Dubbo 的 XML 入参接口**和 **HTTP 的 JSON 对外入口**。名称相同不足以证明参数、认证、返回及基线相同。既有 E10-对外归档（来源资料，需在 library 按标题检索）、收集库推送（来源资料，需在 library 按标题检索）、预归档库推送（来源资料，需在 library 按标题检索） 已覆盖第三方 JSON 结构；本页只补工具包 Dubbo、Hook 的可确认范围及交叉使用时的缺口。

本次完整读取工具包 `1.3.4` 快照内该模块的 20 份资料：`MODULE.md`、2 篇正文、13 条 API 记录及来源清单、别名、两类索引；另完整读取上述 3 页本库 HTTP 资料。13 条记录为 **3 条 Dubbo、10 条 Hook，其中 1 条已废弃**，不等于 13 条 Dubbo 归档接口。`appInitialize` 仅见于正文和正文索引，没有对应 API record。所有版本号均为来源声明，未在客户基线、租户或运行包验证。

## 1. 先按调用对象选择资料

| 场景 | 协议与入口 | 来源明确的请求 | 返回及适用边界 |
| --- | --- | --- | --- |
| E10 后端调用归档能力 | Dubbo：`com.weaver.archive.api.core.remote.DataToArchiveDubboService#dataToArchive`；服务 `weaver-archive-core-service`；`group=archive`，正文另写 `moduleFlag=archive` | 按顺序 `String xml, String tenantKey`，两项必填；正文写消息体不可超过 `7M`，未说明计量方式 | 正文写 `WeaResult`，业务明细为 `dealResult[].details[]`；API record 声明最低 `10.0.2508.01`，正文未标基线；见 D1、R144 |
| 第三方推收集库 | HTTP：`POST /papi/openapi/api/archive/core/openapi/dataToArchive`，`application/json` | 外层 `access_token:String`、`employeeId:String`、`data:String/Object` 必填；`data.datas[].arc` 重点为 `categoryCode`、`fondsCode`、`element`，可有条目层 `uniqueK/uniqueV` | `data.dealResult[]` 是扁平处理明细；版本未提供；见 H2，不能把 URL 当 Dubbo 服务名 |
| 第三方推预归档库 | 与收集库相同的 HTTP 入口 | 同一外层；`data.datas[].arc.appId:String` 表示接入场景；`files.fileList[].metadata` 及 `document` 保留原 HTTP 页结构 | 同样未标基线，示例中预归档标记有冲突；见 H3 |
| 档案应用初始化平移 | Dubbo：`com.weaver.archive.api.core.remote.ArchiveInitializeDubboService#appInitialize`；正文写 `group=archive,moduleFlag=archive` | 按顺序 `String tenantKey, Long employeeId`，均必填 | `WeaResult` 示例 `data:null`；无最低基线、操作范围及重入语义；见 D2 |

可直接采用的是“资料所声明的协议与字段差异”。以下关系仍未得到本批材料证明：HTTP JSON 是否由某一实现转成同一份 XML、两者是否落入完全相同的业务路径、HTTP `access_token/employeeId` 如何转换为 Dubbo 上下文、HTTP `appId` 是否等于 Hook 的档案应用 ID。不得自行合并字段或补上转换代码。

## 2. 新增的 Dubbo 能力与限制

### 2.1 归档提交：D1 与 R144 的交集

D1 第 8–30 行给出依赖 `com.weaver:weaver-archive-core-api`、服务接口、降级类 `com.weaver.archive.api.core.remote.impl.DefaultDataToArchiveServiceImpl` 和两项入参。R144 第 37–68 行再次确认 `xml/tenantKey`，并指向另一份“档案接收接口说明文档”的 XML 格式，但本模块没有该 XML 格式正文。**本批资料不能生成完整 XML 报文模板，也不能用现有 HTTP JSON 模板替代 XML。** 依赖版本未给出；`7M` 仅见于 D1，不外推成 HTTP 或其他接口的通用限制。

D1 第 32–58 行和 R144 第 128 行的响应示例均为 `code/msg/status/data/fail` 外壳，`data` 含 `xmlName`、`taskId` 和 `dealResult`，后者含 `dataReceive`、原拼写 `isSucess`、`details[].metadataId/documentId`。这是示例形状，不是所有分支的完整响应模式；记录内部另有冲突，见第 4 节。保留 `isSucess` 原拼写，不自动改成 `isSuccess`。

### 2.2 初始化平移：D2

D2 第 8–30 行同样列出 `weaver-archive-core-api`，降级类为 `com.weaver.archive.api.core.remote.impl.DefaultArchiveInitializeServiceImpl`。入参 `employeeId` 是 `Long`，与 HTTP 外层 `employeeId:String` 属于不同合同。返回 `data:null` 不能说明初始化哪些对象、已有数据会怎样处理、是否可以重复执行；消息示例还写成“xml接收成功!”，与初始化主题不匹配。资料只能支持定位此能力，不能支持在生产环境直接执行平移。

### 2.3 离线移交：R096

`DataToArchiveDubboService#dataExpEepData` 为 3 个 `String` 参数，参数表顺序是 `formId`、`dataIds`、`packageName`，全部必填；`dataIds` 说明为英文逗号分隔的数据 ID。`group=archive`，来源最低基线 `10.0.2507.01`。响应示例 `data` 包含 `flag`、`functionName`、`bizId`、`moduleName`，其中 `functionName` 示例是 `exportEepOrSipZip`。

资料没有提供最终压缩包 URL、下载方式、进度查询或失败重试合同。请求示例使用 `checkIds`，与参数表 `dataIds` 不一致；响应参数表的 `data` 名称还在结构化转换中丢失，不能直接生成客户端。

### 2.4 借阅单事件：R170

来源名称为“生成借阅单 esb 事件”，类路径 `com.weaver.archive.core.dubbo.borrow.impl.BorrowAction`，`group=BorrowAction`，最低基线 `10.0.2603.01`。它与归档提交不是同一操作。

| 参数组 | 来源合同 |
| --- | --- |
| 必填 | `borrowperson`、`borrowDateTime`、`returnDateTime`、`reason`、`borrowpart` 均为 `String`；`borrowIdAndType` 为 `com.alibaba.fastjson.JSONArray` |
| 可选 | `onlyborrow`、`lastoperator`、`isborrowagain`、`haswatermark`、`watermark`，均为 `String`；示例值不视为默认值 |
| 借阅对象关系 | 原文说明 `formBizId` 为“数据id_表单模型ID”；`borrowType` 为 `0` 电子查看、`1` 实体借阅、`2` 下载、`3` 打印 |
| 调用及返回缺口 | 调用说明只有“esb配置serverless/Action调用”；请求示例套 `entry` 且把数组写为字符串，方法签名却为 `JSONArray`；响应仅示例 `1`，无返回参数说明，不能推定 `1` 的业务含义或套用 `WeaResult` |

## 3. 10 个 Hook 是事件扩展入口

以下均属于 `weaver-archive-core-service` 的 Hook 记录，不能作为 HTTP 路由调用。表内参数为字段定位摘要，逐项类型、必填标记及原始行号保存在配套 JSON。除废弃项外，来源状态为 `active`，这不代表当前客户已安装或事件可触发。

| Hook / 来源基线 | 触发范围与输入字段 | 返回线索与缺口 |
| --- | --- | --- |
| `Arc_XmlPath` / `10.0.2505.01`（R211） | 档案接收生成电子原文时；`appId:Long`、`path:String`、`fileName:String` | 返回 `path/fileName`；示例仅在新值非空时覆盖。没有下载认证、可达性和失败重试保证 |
| `Arc_AutoGroup` / `10.0.2506.01`（R178） | **已废弃、原文“是否对外：否”**；`appId`、`tenantKey`、`categoryId`、`customParams` | 参数表、返回表与代码字段不一致，触发说明又混入附件路径内容；仅留作历史识别，不作新方案入口 |
| `Arc_extendObj` / `10.0.2509.01`（R192） | 开启全文检索前扩展关联表字段索引；`appId`、`tenantKey`、`employeeId`、`objId`、`tableName`、`category_code`、`level` | 返回 `tableNameField/extendForeignKeyField`；表示原文表里存关联表名的字段及存关联数据 ID 的字段；示例关系不是数据库外键证明 |
| `Arc_searchByModule` / `10.0.2509.01`（R206） | 全文检索前过滤；参数表列 `appId`、`tenantKey`、`employeeId`、`type1`、`type2`、`key`，示例从 `FullSearchPO` 取非空属性 | 返回 `sql:String` 并拼接已有 SQL；缺完整参数模型、可用列、参数绑定和权限约束，不能直接给出任意 SQL 模板 |
| `Arc_handlerResult` / `10.0.2509.01`（R209） | 全文检索后扩展展示；参数表同搜索前记录，请求示例却给 `secondDevArr[].id/objId` | 表列 `id/key/showName/value/removeKeys`；示例期待两层数组并检查前四个键，`secondDevArr` 未进参数表；示例通用复制所有键，但未展示按 `removeKeys` 移除字段的处理 |
| `Arc_docUp_metaType` / `10.0.2511.01`（R194） | 原文上传时筛选单据类型；表列 `employeeId`、`tableId`、`tableName`、`arcFileId` | 示例读取额外的 `tenantKey`，并输出 `status/docUpMetaType/errMsg`；响应表为空，不证明缺失租户时的行为或自动回滚 |
| `Arc_log_push` / `10.0.2511.01`（R190） | 日志保存后；`tenantKey`、`employeeId`、`context`；`context` 为 `LoggerContext` 的 JSON 字符串 | 示例在线程池提交 Hook，返回原保存结果；响应表为空，不能当作同步归档成功回执 |
| `Arc_process_push` / `10.0.2511.01`（R182） | 过程信息保存后；`tenantKey`、`employeeId`、`billIds`、`serviceType`、`finalSuggestion`、`categoryId`、`formTag` | 示例在线程池内先插过程信息，再调用 Hook；按卷先查卷内数据，Hook 仍传原 `billIds`；无响应、重试、投递保证 |
| `Arc_updateDocument` / `10.0.2511.01`（R210） | 附件变更后；`appId`、`tenantKey`、`employeeId`、`formTag`、`tableName`、`category_code`、`ids`；后者定义为电子原文数据 ID | 响应表为空；样例含乱码和字段尾部空格，不能当成已可运行的处理模板 |
| `Arc_addBorrowCar` / `10.0.2512.01`（R202） | 加入借阅车前扩展字段；`appId`、`tenantKey`、`employeeId`、`objId`、`tableName`、`category_code`、`ids` | 示例读取返回 `fieldNames`，响应表为空；字段格式与如何复制至借阅车仍需完整合同 |

Hook 的 `appId` 多数是 `Long` 档案应用 ID，HTTP `arc.appId` 是 `String` 接入场景 ID；`category_code` 在 Hook 中表示分类 ID，而 HTTP `categoryCode` 表示分类标识。字段名近似不能建立相等、互换或类型转换关系。`employeeId` 也应按每条记录读取：R190 表为 `String`，多数其他 Hook 表为 `Long`。

## 4. 必须保留的来源冲突

| 编号 | 具体证据 | 对采用范围的影响 |
| --- | --- | --- |
| C01 | R144 第 128 行和 D1 第 32–58 行是归档 `dealResult`；R144 第 136 行 `raw` 的响应参数却出现离线导出的 `flag/functionName/bizId/moduleName`；第 112–125 行结构化响应参数名为空、类型为 `String` | 不把导出返回并入归档 DTO；保留两处冲突，待接口方确认 |
| C02 | R096 第 54–65 行写 `dataIds`，第 142 行请求示例写 `checkIds`；第 127–140 行响应参数名为空，`raw` 中该项实际叫 `data` | 方法参数和外层示例不能混接；原始响应表 `String` 与对象形状仍需核验 |
| C03 | R096 第 142–144 行、R144 第 127、129 行及多份 Hook 示例含 `?`、乱码或 `dataToArchiv` 拼写 | 不原样发布为可运行样例，不凭整理猜测缺失字符 |
| C04 | D2 未标基线；第 35 行初始化响应消息为“xml接收成功!” | 消息不作为初始化完成判据，补版本与真实返回后再实现 |
| C05 | R194 参数表无 `tenantKey`，代码读取它；响应表为空但示例写 `docUpMetaType/status/errMsg` | 参数及返回均不完整；不得从示例推定异常阻断或回滚保证 |
| C06 | R192 第 114–125 行 `category_code:Long`，第 174 行示例变量 `categoryIdByFormId` 是 `String` | 记录类型冲突，按现场入参核定，不能统一转成 Long |
| C07 | R209 第 37–128 行参数表与第 196 行请求示例不一致；第 198 行消费两层数组并遍历复制所有键，但未展示按返回表中的 `removeKeys` 移除字段 | 缺少可直接使用的请求/响应完整模式，不把通用键复制等同于已实现字段移除 |
| C08 | R178 第 17 行废弃；返回表 `infileGroup`，代码却读 `actionInfo` 内 `infilesGroup`；第 156 行触发说明描述附件链接 | 保留废弃和内部冲突，不宣称有可用替代接口 |
| C09 | R202、R210 返回表均为空；R202 代码读 `fieldNames`，R210 仅强转返回对象 | 不能把两者返回默认当布尔成功或统一 JSON 合同 |
| C10 | H2 第 138–143 行、H3 第 127–132 行表述 `path` 是路径、`arc_document_name` 是名称；H2 第 313–323 行、H3 第 276–286 行实例反向放值 | 旧正文保留，采用前按字段表与档案方核对，不复制有冲突的实例 |
| C11 | H2 第 122–124 行定义 `name=字段名/content=字段值`；第 352–361 行实例 `name` 放数值、`content` 放字段名，另项把值放到 `title` | 实例不能作为收集库字段映射标准 |
| C12 | H3 第 213 行定义 `is_pre_arc:0=预归档、1=收集库`，第 235 行预归档示例为 `1` | 无法据示例确认目标库；需要真实响应和配置核验 |
| C13 | H2 第 106 行、H3 第 101 行 `metadata.type` 举例数值场景 ID，正文 JSON 第 205/186 行使用表单 tag；H2 第 276 行与第 366 行的元数据唯一值也不同 | 不把示例值当普适类型、ID映射或幂等规则 |
| C14 | D1/R144 的 `metadataId/documentId` 位于 `details[]`，H2/H3 为 `dealResult[].metadata_id/data_id`；Dubbo 示例 `taskId` 为数字，HTTP 表和示例为字符串 | 分协议解析原字段；无法据同一 `msg` 或外层 `code=200` 推导所有业务明细成功 |

## 5. 采用前尚需补齐的合同

1. 核实目标协议、具体产品/补丁版本、接口依赖版本及服务注册；R144 的最低基线不覆盖 D2 或两份 HTTP 资料，Hook 基线逐条判断。
2. Dubbo 归档需取得完整 XML 格式、字段映射、消息体 `7M` 的计算口径和真实响应；HTTP 需确认令牌取得/有效期、操作人权限、接入场景与分类标识，以及来源实例冲突。已有 HTTP 页没有授权将令牌方式移植为 Dubbo 认证。
3. 区分接收成功、明细处理成功、电子原文下载成功、最终归档完成。当前资料没有证明它们等价；也未给出全量错误码、事务边界、幂等、部分失败重试、超时和回查规则。
4. `uniqueK/uniqueV` 在 HTTP 来源中用于更新定位，不足以保证整个请求幂等；初始化、借阅、导出、Hook 的重复调用或副作用更不能套用该结论。
5. 新增或调试 Hook 前取得完整触发上下文及返回消费合同。日志/过程事件的示例异步提交，不证明事务提交完成、可靠投递或失败重试；扩展检索也不替代标准权限判断。

本轮只做本地资料读取、索引与记录一致性核对、来源哈希及知识页检查。未执行工具包脚本、调用接口、访问来源网页/远程图片、编译示例或验证任何客户环境。源文件未改动；本页不提供补造的 XML、Java 或 HTTP 调用模板。

## 6. 来源定位与复核

配套 E10档案归档来源核对-20261021.json（来源记录，未随包） 保存 23 份来源的 SHA-256、完整读取行范围、13 条记录原参数/返回字段、来源关系、冲突位置和未核验范围。引用编号定义如下。

| 编号 | 本地来源 |
| --- | --- |
| D1 | 工具包模块 `references/docs/档案管理dubbo接口/档案归档接口.md`，全文 1–58 行 |
| D2 | 工具包模块 `references/docs/档案管理dubbo接口/档案应用初始化平移.md`，全文 1–40 行 |
| R096 / R144 / R170 | 工具包模块 `references/api-records/` 下 ID 尾号相同的 3 份 Dubbo JSON |
| R178 / R182 / R190 / R192 / R194 / R202 / R206 / R209 / R210 / R211 | 同目录下 ID 尾号相同的 10 份 Hook JSON |
| H1 | E10-对外归档（来源资料，需在 library 按标题检索），全文 1–49 行；已覆盖 HTTP 两场景概览 |
| H2 | 收集库推送（来源资料，需在 library 按标题检索），全文 1–379 行；本轮未访问末尾远程图片 |
| H3 | 预归档库推送（来源资料，需在 library 按标题检索），全文 1–335 行；本轮未访问末尾远程图片 |

工具包模块根为 `01-AI-Resources AI资料整理/04-Agents Agent规则/99-SourceFiles 原始资料/e-code智能化开发工具包/1.3.4/skills/e10-local-knowledge/modules/e10-archive-dubbo`。正文两篇保留官方来源标识；API record 的 `sourceDoc` 仅回指本模块 `api-source.md` 清单，清单又指回 record，不额外构成原始接口仓库证据。`api-aliases.json` 为空对象；`api-index.jsonl` 的 13 条索引字段与对应 record 一致，但这只能证明本地一致，不能消除正文、示例和参数表的冲突。
