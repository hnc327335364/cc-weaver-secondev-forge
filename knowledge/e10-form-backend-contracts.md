---
title: "E10表单后端调用与数据操作契约补充"
platform: "E10"
status: internal-trial
source_record: "e10-form-backend-contracts"
source_manifest: manifest.json
---
# E10表单后端调用与数据操作契约补充

> 随包解释卡，供内部试用。通用正文、API、案例与已有本地附件先查 [资料导航](../library/catalog.md)，按标题或符号检索后使用 document_id 读取；不依赖维护者电脑路径。本页的核读日期、数量与行号描述当时的整理范围，不代表当前整库验收。详细维护记录不随包，客户工程与现场配置另行提供；知识卡指纹见 [manifest.json](manifest.json)。

本页是 EB表单RPC接口整理（来源资料，需在 library 按标题检索） 的增量，不重新复制其五种接口的完整骨架。重点补齐既有页未展开的操作开关、真实类型、模块边界和来源冲突。**e-code 工具包 1.3.4 是资料分发版本，不是 E10 基线；本页只做静态契约核对，没有编译客户工程、调用接口或验证租户。**

证据编号 H1–H14 为工具包归档，L1–L2 为本库旧页。完整路径、行段、SHA-256 与卡片映射见 证据记录（来源记录，未随包）。原文中的人员、租户、业务 ID 均未复制为可用配置。

## 先分清三类调用

| 调用层 | 已见实际入口 | 不能混用的部分 |
| --- | --- | --- |
| EB 业务 RPC | `com.weaver.ebuilder.form.client.service.data.RemoteSimpleDataService`，分组 `ebuilderform` | 使用 `EBDataChangeReqDto` / `EBDataDelDto`，保留 EB 后置动作、权限与应用路由语义。 |
| 表单引擎 RPC / SDK | RPC 由 `com.weaver.common.form.api.rest.FormRestFactory` 按 `module` 取得；SDK 文档列出 `com.weaver.common.form.formapi.FormAPIService` | 使用 `FormDataDto` 等，不是 EB DTO；不能仅凭方法同名互换。SDK 页标题叫 FormDataAPIService，但所属类写 FormAPIService，须核实客户依赖。 |
| EB 开放平台 HTTP | 原文列 `POST api/ebuilder/form/dataset/v2/updateFormData` | 使用 `datajson`、`operationinfo`、`userid` 等 HTTP 契约；不是 RPC 的 Java 方法，也不是可直接拼接的现场公网地址。 |

H11 明确：表单引擎接口涉及新建时，应先确认是否有关联模块业务；有关联则建议使用模块接口。不能因引擎接口“更底层”便绕过 EB/流程的权限或业务控制。后端 Controller 的路由和 `WeaResult` 规范仍查 后端二次开发规范（来源资料，需在 library 按标题检索）；RPC 返回 DTO 不需要被改写成 Controller 返回类型。

## C01｜应用路由和租户上下文是两个独立契约

**已知与增量：**旧页已提到 runtime RPC；新增明确其实际类、应用绑定约束和默认应用的使用边界。（H1:30–46、65–91；H4:15–33）

- 真实工具类方法为 `com.weaver.publishkit.api.util.PublishKitRuntimeUtil#buildRpcService(Class<T>, String defaultRpcGroup, String appId)`，返回对应接口代理。`appId` 是当前操作表单所属的应用 ID，与 `objId` 是两种含义的标识；H1 的“必须和当前操作的表单id一致”按所属关系理解，不能把两个 ID 强行赋成相同值。
- H1 解释固定 `@RpcReference` 只能定位固定 group，无法动态定位独立部署应用。H4 的注释要求 `10.0.2410.01`（含）以后使用独立部署方式；L1 写成“推荐”，强度不同。新实现按目标基线和部署方式核对，不沿用旧页的较弱表述。
- `getDefaultAppId()` 只在业务与具体应用无关时表示默认服务，不是找不到 `appId` 时的兜底，否则可能路由到错误服务或数据库。
- 免登录调用，H4 要求提前设置 `TenantRpcContext#setTargetTenantKey(String tenantKey)`；`EBDataReqHeader` 又独立携带 `objId`、`operator`、`tenantKey`。路由正确不代表身份可信，手工设置上下文也不等于完成认证。
- **部门实现边界：**用户/租户来自已认证且获授权的映射，不直接信任外部 JSON；异步线程不得假设自动继承上下文。来源未给出上下文清理/恢复 API，不能凭空补一个方法或把上下文永久留在线程中，须查目标框架实现。

## C02｜新增成功、后置处理完成、前台可见不是同一个状态

入口仍为 `RemoteSimpleDataService#saveFormData(EBDataChangeReqDto)`，返回 `EBDataChangeResult`；支持基线 `2304.01`。旧页已含主明细结构和 `asyncPostProcess=false`，本次补齐开关依赖与默认值。（H2:26–46；H4:105–161、168–192）

| `EBDataReqOperation` 字段 | 原文默认/语义 | 使用影响 |
| --- | --- | --- |
| `checkRight` | `true`，权限校验 | 新增示例 JSON 把它设成 `false`，不能把演示参数当安全默认。 |
| `needPostProcess` | `true`，全部后置动作的前提 | 涉及权限重构、action、ES 推送、关联流程的表单触发；关掉它后，不能仅设置某个子开关就声称动作执行。 |
| `asyncPostProcess` | `true`，异步后置处理 | H4 说明写入后立即前台查看/继续操作需要同步后置处理，权限处理完成再返回；不等于所有跨服务业务整体原子提交。 |
| `doActoin` | `true`，数据操作对应按钮 action | 此来源拼写确为 `Actoin`，不要擅自改成尚未由该 RPC 契约证明的 `doAction`。 |
| `doObjActoin` | `true`，表单拦截数据变更动作 | 与按钮 action 不同。 |
| `needDataChangeMonitor` | `true`，ESB 表单数据变更动作 | 与 `execMonitor` 不是一个开关。 |
| `execMonitor` / `execRelate` / `execIgnoreParam` | 均 `false`；运算 / 数据钻取 / 忽略运算入参 | 是否执行按需求与现场配置明确，不能默认把所有动作打开。 |
| `fieldNoFindRule` / `subFormNoFindRule` | `ignore`；可选 `throwException` | 字段或明细不存在可能被忽略；联调时应核对映射，不以“没报错”证明全部写入。 |
| `needPresetDataId` / `needDefaultValue` | 新增预设 ID / 是否使用字段默认值；未列统一默认值 | 不补造默认值；需要时核实当前 DTO。 |

成功样例是 `status=true` 与 `ids`；失败样例是 `status=false` 与 `message`。来源未证明逐条结果顺序、部分成功模式、重复请求幂等性或超时回滚。**部门验收：**分别检查响应、实际记录、权限可见性和应触发动作；响应缺失时先核查是否已写入，再决定重试。

## C03｜dataKey 模式需显式启用，不能只换字段名

H3:1–18 补齐旧页仅链接的实际契约：在既有 `EBDataChangeReqDto` 请求上，`EBDataReqOperation#setReqType(FieldOperationTypeEnum.dataKey)` 切换请求模式，再用 `EBDataReqDetailDto#setDataKey(...)` 设置字段编码；原有默认是 fieldId 模式。返回仍按所调用的新增/更新接口处理，dataKey 没有另造一套 RPC 返回。

- 能解决的范围：H3 说明应用迁入会使字段 ID 变化，编码模式减少硬编码 fieldId 的迁移负担；不保证所有应用编码自动一致，也不替代 `appId`/`objId`/明细表定位。
- 实现时复用并补全同一份 `operation`，不能为了设置 `reqType` 新建对象后丢掉 C02 的权限和后置处理配置。
- **版本冲突必须保留：**页首写 E10 `10.0.2403.01`（含）、服务 `weaver-ebuilder-form 1.17.0`（含），代码注释却写 `1.7.0`。没有证据裁定哪一个正确，不能仅凭该页承诺较早版本支持；检查现场 JAR 的 `setReqType`、枚举和服务基线。

## C04｜修改的“匹配依据”与“写入字段”要分开

入口 `RemoteSimpleDataService#updateFormData(EBDataChangeReqDto)`，返回 `EBDataChangeResult`，基线 `2304.01`。旧页已列三种更新方式与六种明细策略，不在此重复；增量是匹配字段的真实组装关系与参数表错误。（H2:48–57；H5:183–221）

- `updateType=EBDataUpdateType.updatePolicy` 时，示例将 `List<String>` 传给 `EBDataReqOperationInfo#setUpdateFieldIds(...)`；这些字段在 `mainDatas` 内的值承担匹配条件，另外的字段承担更新值。不能把 `updateFieldIds` 理解为“仅允许更新的字段白名单”。
- H2 参数表把 `updateFieldIds` 标为 `String`，又写 `updateType=updateFieldIds`；H5 的实际调用是列表与 `updatePolicy`。本页记录冲突并以示例作为定位线索，仍须用目标依赖的签名确认，不能生成名为 `updateFieldIds` 的枚举值。
- `needAdd=true` 是“找不到时新增”，不代表天然幂等。业务键不唯一、并发写入或跨租户匹配未查清时，不应自动开启补新增。
- H2 列 `FIRST/MORE/ZERO/ADD/LAST/EXCEPTION/ALL`，H5 的明细删除另实际使用 `DataUpdatePolicy.DELETE`。参数表不是完整枚举；不要把缺项等同于能力不存在，也不能把 SDK 的枚举清单套到 EB。
- 明细 `cover=true` 与 `DELETE` 都有破坏性；操作前明确主记录、明细表、命中范围及预期保留行，不能把“更新几行”误解释成覆盖全表。

## C05｜删除的结果字段与新增不同，彻底删除也不是即时物理清理

入口 `RemoteSimpleDataService#deleteFormData(EBDataDelDto)`，返回 `EBDataChangeResult`，基线 `2506.01`。（H6:1、41–64、72–115）

- `dataIds` 为 `List<String>`，只在 `deleteType=ids` 时生效；条件删除使用 `mainData`。原文“单次最多 1000 条”具体写在外部传入数据 ID 的示例，不应扩张为任意条件查询永远最多 1000 条。
- `EBDataDelOperation.doActoin` 默认 `true`，示例显式关掉；它控制删除按钮动作，不能不经业务确认照搬。
- `thoroughDelete=false` 进入表单数据回收站；`true` 的注释写先将 `delete_type` 置为 3，再由架构扫描物理清理，提到正常情况 14 天。该说明不是现场保留周期保证，更不是要求二开直接改字段或直接删库。
- 成功样例字段是 `status`、`message`、`dataIds`，不是新增/修改样例的 `ids`。失败样例把“无权限删除或数据不存在”合并，不能仅凭这条信息断定是哪一种。
- 页首基线已为 `2506.01`，正文仍保留“`10.0.2410.01` 之前可用”的通用旧调用片段；这不能证明该删除方法在旧版本可用。

## C06｜分页查询的上下文优先级明确，otherParm 类型仍未裁决

入口 `com.weaver.ebuilder.form.client.service.emobile.IEtFormDatasetService#getDatas`，分组 `ebuilderform`，最低基线 `2501.01`。（H7:1–83、115–140、187–197）

- 现有四参数顺序为 `objId`、`module`、`query`、`otherParm`；`query` 是 `Query` JSON 的 Base64 字符串，不能把 Java 对象直接作为该参数传入。`module` 可空不等于应用/人员/租户也可空。
- 人员来源顺序：`Query.ebSimpleEmployee` → `RpcContext` → `UserContext` → 组织信息获取异常。缺少人员时不应随意补一个管理员或生成新人员 ID。
- 默认权限校验。原文的 `dataPermission="ALL"` 是绕开权限的配置，不是“查不到就加上”的通用解法；必须先定位身份、租户和实际授权。
- `otherParm` 在表中为 `String`，明细字段示例却调用 `otherParm.put("tableField", ...)`；原例传 `null` 也不能证明 String/Map 哪个正确。调用前查当前 `IEtFormDatasetService` 的真实重载及序列化要求；本页不提供臆造的完整 Java 签名。
- 返回样例含 `count`、`list`、`field_map`；`id` 与 `form_data_id` 在同一记录内是两个不同值，不能直接互换后喂给表单引擎接口。需通过实际业务模型确认映射。

## C07｜已知 ID 的简化查询要显式核对权限开关和数值类型

`com.weaver.ebuilder.form.client.service.esb.EsbDubboService#getFormFieldValues(EsbFormFieldValueQueryDto)` 返回 `Map<String, List<FieldValue>>`。（H8:11–65；未注明最低基线）

新增类型信息：`dataIds: List<Long>`、`objId: Long`、`tenantKey: String`、`employeeId: Long` 均标 `@NotNull`；不要因为删除接口使用字符串 ID 就复制 DTO 类型。`onlyDeletedDatas=false` 是显式初始化，默认查询未删除数据。

`checkRight` 只是未初始化的基本类型 `boolean` 声明。Java 对象字段初始值为 false，但**不证明服务端最终不校验，也不证明可省略安全选择**；项目需明确是否按业务用户权限查询并核实 DTO setter/服务端实现。此处不能沿用 C02 的 `checkRight` 默认 true。

原文没有说明返回 Map 的键规则、ID 顺序、缺失项表达、最大批次或部分失败方式；这些仍是现场契约缺口。禁止凭 Map 类型自动断言“key 就是输入 dataId”。

## C08｜HTTP v2 与 RPC 即使都更新表单，字段名和默认值也不同

H13:1–23、79–125 的 HTTP v2 修改页给出基线 `10.0.2404.01`（含）、`weaver-ebuilder-form 1.18.0`（含）；HTTP `Content-Type` 为 `application/json`，要求 `access_token`、`userid`、`datajson`。凭据如何放入实际网关请求、有效入口与权限须结合现场开放平台文档确认，不能只拼接页内路径。

| 项目 | HTTP v2 修改 | EB RPC 修改 |
| --- | --- | --- |
| 主/明细载荷 | `datajson.datas[].mainTable` 与 `detail1/detail2`；字段键是 dataKey | `datas[].mainDatas` 与按 subFormId 分组的 `detailDatas` |
| 动作开关 | `operationinfo.doAction` 是 String，文档默认不执行，`y/true` 开启 | `operation.doActoin` 是 boolean，H2 默认 true |
| 未匹配新增 | `operationinfo.needAdd` 是 String，默认不新增 | `mainData.needAdd` 是 boolean，未给统一默认，示例常显式 true |
| 修改模式 | `ids/updatePolicy`；原文称空或错误值默认 ids | `ids/conditions/updatePolicy`；不照抄 HTTP 的错误值回退 |
| 响应 | 示例外层 `message.code/msg`，内层 `data.datajson.status/dataIds` | `EBDataChangeResult`；示例 `status/ids` |

HTTP 页的 `status` 参数表写 String，样例却是 JSON boolean；不能只按一处生成严格响应模型。先核验真实返回类型，同时检验业务成功状态；HTTP 请求成功不等于数据操作成功。上述差异说明不能把 HTTP JSON 塞给 RPC DTO，也不能把 HTTP 的 `doAction` 改名后当作完整转换器。

## C09｜表单引擎读取可请求显示内容，但类名与 ID 语义要核实

H10 的 SDK 页所属包为 `weaver-common-form-extend`，所属类写 `com.weaver.common.form.formapi.FormAPIService`，没有给出最低基线。以下是文档签名摘录，**不是现成可运行项目代码，也不是 HTTP 路径**。（H10:851–913）

- `List<FormDataDetail> getByFormDataIdsAndField(FormDataShowContentParam param, SimpleEmployee employee)`：`param.formId: Long`、`dataIds: List<Long>` 必传，`fieldIds: List<Long>` 可选；还可请求 `needShowContent`（币种等显示拼接）、`containsOptionContent`（最新选项名）、`needEncrypt`（加密信息换星）、`needDesensitization`（脱敏）。这些 Boolean 的统一默认值、权限行为和 `FormDataShowContentParam` 完整包名未在该段给出。
- `FormDataRowNumberDto getMaxRowNumberByDataIds(Long formId, List<Long> dataIds, SimpleEmployee employee)`：文档称无效参数或无数据返回 `null`，结果用于单记录最大行号 `maxRowNumber` 与汇总总行数 `sumRowNumber`。不把 `null` 擅自等同为已查询且为零。
- `SimpleEmployee` 必须有人员 ID 与 tenantKey；来源示例里生成随机人员 ID 只是示例，不得用于正式身份。
- H10 参数表把 `param.formId` 的描述写成“表单字段Id”，与参数名和同页相邻接口不一致。不能依此传 fieldId；须核实实际类字段含义。C06 返回的 `form_data_id`、EB 业务 `id` 也不得未经映射直接替换。

## C10｜表单引擎批量写入存在直接冲突，暂不作为生成模板

H9 的页标题为 FormDataRest，页首“所属类”却写 `FormLayoutRest`；H12:27、74 的实际 import/XML 能定位到 `com.weaver.common.form.api.rest.data.FormDataRest`。这是来源错误线索，不是对客户依赖的验证。

| 来源位置 | 标题/语义 | 实际列出的方法 | 裁决 |
| --- | --- | --- | --- |
| H9:115–130 | 标题“批量新增/更新”，注释“只修改、不新增、dataId 必传” | `saveFormDatas(FormDataDtoParam, SimpleEmployee)` | 同段内部冲突。 |
| H9:229–245 | 标题“批量更新（非新增）”，注释“支持批量新增、覆盖” | `saveFieldDatas(FormDataDtoParam, SimpleEmployee)` | 同段内部冲突。 |
| H10:728–758 | `saveFieldDatas` 为只修改、dataId 必传；`saveFormDatasByCondition` 支持按条件改/增 | 均返回 `List<FormDataDto>` | 与 H9 不一致，且 RPC/SDK 可能本来就有差别，不能拼成统一映射。 |

共同限制仅能按各段原文记录：同表、不支持多布局保存。H9 参数表还列 `singleDataMaxRows` 与 `allDataMaxRows`（总更新行数不超过 10000）、`needCheckData/checkResult` 等，但**不能反推 EB 的 saveFormData 批次也有相同上限或预校验协议**。

单条引擎 RPC `saveFormData(FormDataDto, SimpleEmployee)` 的 H9:22–46 列出新增不传 `dataId`、更新必传、`formId` 与 `module` 必传、附件/事项公共关联需 `objectId`、删除明细需 `delRowIds` 的 `subFormId/rowId`。这些是引擎 DTO 语义，不应替换 C02 的 EB 主明细结构。涉及 EB 或流程模块的新建仍先用模块接口（H11），不以此跨层绕过模块业务。

## 部门落地与验证边界

以下是结合缺口提出的实施要求，不冒充已由来源证明的平台保证：

1. **先固定契约：**记录目标 E10 基线、相关 client/API/服务版本、应用部署模式、实际类签名、可信人员/租户来源、表单及字段映射；来源有冲突时用实际依赖/服务契约裁决并留证。
2. **权限与租户：**测试正确用户成功、无权用户拒绝、跨租户/错应用不可越界；不能用关闭权限或管理员兜底把错误变成通过。
3. **事务与重试：**已读材料没有跨 RPC、本地 SQL、ESB/后置动作统一事务、超时撤销或自动幂等的保证。不能把 `asyncPostProcess=false` 或本地事务注解当作分布式原子性证明；批量部分失败、重试去重和补偿必须另行验证。
4. **数据写入：**核对未匹配/多匹配、明细追加/覆盖/删除、字段不存在、动作触发、权限可见性、响应丢失但已写入等用例。删除或覆盖需有明确对象/范围授权及恢复方案。
5. **SQL 边界：**L1 的“结果导向 SQL 更直接”只是旧页选型意见，不代表可以绕过应用路由、权限/动作或直接写系统表；L2 要求官方数据源接口。不得以本页为依据新增直连 MyBatis、任意 SQL 或未核验的数据库修复程序。

## 核验范围与来源清单

2026-10-21 由 Codex 对照 2 篇本库既有页、14 篇工具包归档正文/选型页，形成 C01–C10。来源 hash 与行段已记录；没有运行工具包脚本、自动安装、外部认证、数据库读写或客户编译测试。

| 证据 ID | 文档 |
| --- | --- |
| L1 / L2 | EB表单RPC接口整理 / 后端二次开发规范 |
| H1 | ebuilder应用独立部署二开规范 |
| H2 / H3 | 数据操作说明/参数说明 / dataKey的方式请求操作数据 |
| H4 / H5 / H6 | 批量新增 / 批量修改 / 批量删除 |
| H7 / H8 | 获取表单数据 / 获取表单数据-简化 |
| H9 / H10 | 表单数据：FormDataRest / 表单数据：FormDataAPIService |
| H11 / H12 | 表单引擎 RPC 接口说明 / 标准RPC开放说明 |
| H13 | HTTP v2 修改表单数据 |
| H14 | e-code 工具包 的 interface-selection（规则提炼，不等同平台运行时契约） |

正文涉及类型、版本或语义冲突的项均保留待裁决状态，不计为“现场已验证”。本页不覆盖完整后端接口清单，原始 API、代码与既有笔记仍保留只读来源地位。
