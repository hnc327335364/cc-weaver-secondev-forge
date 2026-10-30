---
title: "E10人员组织查询与身份回显边界"
platform: "E10"
status: internal-trial
source_record: "e10-hr-identity-boundaries"
source_manifest: manifest.json
---
# E10人员组织查询与身份回显边界

> 随包解释卡，供内部试用。通用正文、API、案例与已有本地附件先查 [资料导航](../library/catalog.md)，按标题或符号检索后使用 document_id 读取；不依赖维护者电脑路径。本页的核读日期、数量与行号描述当时的整理范围，不代表当前整库验收。详细维护记录不随包，客户工程与现场配置另行提供；知识卡指纹见 [manifest.json](manifest.json)。
> 分发说明：此为已纳入当前清单的随包副本。原稿“本页不进入助手运行稿”描述入库当时状态；“同目录 E10人员组织查询来源核对-20261022.json”仅为维护来源记录，未随包，不是接收方路径。原稿的核读范围是维护记录，不代表当前AI读过原件。

本页用于先选对查询入口、ID和返回对象，避免“找到了人但身份不对”“空过滤范围反而扩大”“能回显就当作有权限”。来源是e-code 工具包 **1.3.4 中的文档快照，不是 E10 产品版本号**；本文没有编译、调用或现场验收。20篇正文逐篇完整阅读，API记录含 `raw` 完整核读；具体指纹、行范围与当时未读文件记录在维护知识库的 `E10人员组织查询来源核对-20261022.json`，该维护记录不随包。

## 1. 先确认需要的是哪一种对象

| 业务目标 | 对象/入口 | 不可混用的边界 |
|---|---|---|
| 按部门、状态、工号等查人员 | `HrmOrgEmpCondition`，`HrmCommonEmployeeService#queryEmpsByCondidtion`（D05） | `ids` 是人员ID；`userIds` 是登录账号ID。二者不是同一条件 |
| 查集成所需人员字段 | `HrmRemoteIntegrationSyncDataService#pageEmployeeData`（D06） | `fieldList` 使用 `full_code`，例如 `employee.user_id`；不是通用查询的表字段名列表 |
| 找同一人员的兼职组织/岗位 | `HrmCommonExtraOrganizationService`；`HrmComEmployeeExtraOrgHandler`（D10–D13） | 兼职身份 `id`、主身份 `employeeId/mainId`、部门ID各有含义 |
| 找主次账号关系 | `listBelongtoEmployee` / `batchListBelongtoEmployee`（D14–D15） | `accounttype/belongto` 是主次账号关系，不等于兼职的 `mainId` |
| 由全路径识别组织 | `HrmBrowserUtil#findOrgIdByAllPath` 或 `#queryDepartmentIdByFullPathName`（D02–D03） | 返回值分别是组织对象和ID的逐项结果，不能只取批量第一项 |
| 浏览字段显示名称 | `hrmcombination` 回显载荷（D16） | 回显协议、表单 `specialObj`、人员范围选择不是同一数据结构 |

登录认证映射另见 [E10集成登录与认证Dubbo接口边界](e10-auth-boundaries.md)；流程找人另见 E10流程操作者矩阵与权限扩展边界（来源资料，需在 library 按标题检索）。本页补的是组织人事查询契约，不把它们改写成另一套账号认证或流程权限逻辑。

## 2. 人员查询：先收窄，再核对返回层级

### 2.1 通用查询与分页

D05 给出本地 `com.weaver.common.hrm.service.HrmCommonEmployeeService` 的 `queryEmpsByCondidtion`、`pageEmpsByCondtion`、`countEmpsByCondition`，以及远程 `com.weaver.common.hrm.remote.HrmRemoteEmployeeService` 的前两种方法。**拼写按来源保留**，不要自行“纠错”后生成调用。

`HrmOrgEmpCondition` 的可用定位条件包括人员 `ids`、登录账号 `userIds`、`departmentIds/subcompanyIds`、`jobNumList`、`nameList/nameLikeList`、`outKeyList/adoutKeyList`。关键区别（D05:34–65）：

- `tenantKey` 明确必须提供；从已授权的当前上下文确认，不能拿调用参数的任意租户值直接扩权。
- `typeList` 默认内部人员 `inside`，外部联系人为 `external`；`userStatusList` 默认在职 `normal`，离职为 `unavailable`。查不到不等于人员不存在。
- `containOtherDepartment` 是指定分部/部门时是否包含兼职，`containSubordinates` 是相同条件下是否含下级；`containExtra` 也称包含兼职且默认不包含。来源未解释两个兼职开关组合，不能把它们当同义字段替换。
- `returnFieldList` 要与 `employee` 表字段一致；`returnContainSubcompany` 仅在 `resultType=bean` 且租户开启分部时有效。示例区分 `HrmConditionResultType.ID.name()` 与 `.BEAN.name()`，不要将 `List<Long>` 当人员详情。
- `updateTimeRange/rehireTimeRange` 的 `from/to` 不可同时为空；页数起点、最大页长、排序稳定性和批量未命中契约在这篇未给。全量需求不能仅取第一页就判定完成。

### 2.2 集成字段查询不是原样取整条人员记录

D06 的 `pageEmployeeData` 使用查询条件、`fieldList`、`dataConfig`、`current/pageSize`；`fullcodeMap` 仅支持基本信息字段，`fieldList` 必须使用 `full_code`。`dataConfig.browserIdAndName` 用于系统浏览字段额外返回 `{full_code}Info`；原字段值和显示对象应分别处理。

来源请求示例是 `cmd` 调试载荷，不是正式 Java 签名。响应示例存在两层 `WeaResult`，没有解释哪层来自测试包装；不能固定写成 `data.data.data` 客户解析器。先用现场已授权、脱敏的成功/空集/失败响应确认包装、分页和字段类型，再实施映射。（D06:6–24、26–105）

### 2.3 多维、删除、离职权限是不同条件

- `HrmCommonEmployeeService#getEmployeeByIdsFilterMeta` 接受可含兼职身份的 `ids`、`tenantKey`、`HrmEmployeIdFilterMeta`。来源字段原拼写 `corvertExtraOrg` 表示是否兼职转主身份；`includeDelete`、`includeDifTenantKey` 分别描述包含删除人员、不同租户。没有默认值、返回表或授权说明，**不能为了查全而全部设 true**。（D07）
- `HrmComConfigurationDimissionService#getDimissionAuth` 的 `DimissionAuthReqDto` 要操作者 `currentEmployeeId` 与 `tenantKey`，返回 `dimissionView`。能传离职查询条件不证明操作者获准看离职人员；该结果也不替代业务记录或字段访问权限。（D08）
- `HrmCommonEmployeeVirtualPlusService#listByCondition`：`departmentList` 可传分部，但传分部时只查直接归属人员；`containSub` 与它配合才含下级；`subcompanyList` 描述为直接归属分部及下级部门人员。别把两种字段视为等价。`virtualIdList` 指维度，`HrmEmpVirtualLinkService#queryLinkByCondition` 的关系记录另有 `virtualId/pid/cid`。（D09）
- D09 暴露 `sqlwhere/selectList`，不等于允许拼接用户输入或绕过租户/权限；本文不提供 SQL 字符串模板。

## 3. 组织：方向、停用和空范围影响结果

D01 的组织查询条件 `HrmOrgCondition` 包含 `tenantKey`（必须）、`ids/parentOrgIds`、`statusList/typeList`、名称和编号。`statusList` 默认启用，`1/0` 表启用/停用，二者同时提供表全部；`typeList` 默认不过滤。来源称分部ID可放在部门ID参数中，**按部门逻辑**返回，不能推导所有组织接口都按分部逻辑处理。

| 场景 | 入口/返回 | 关键核查 |
|---|---|---|
| 组织全字段分页 | `HrmRemoteIntegrationSyncDataService#pageOrgData`；声明 `WeaResult<Map<String,Object>>`（D01:60–80） | `fieldList/dataConfig/current/pageSize` 有表，返回内容表为空；不要照人员查询包装补猜 |
| 路径→组织对象 | `HrmBrowserUtil#findOrgIdByAllPath`；`Map<String,WeaResult<HrmDepartment>>`（D02） | 入参 `allPathList/split/tenantKey`；样例中部分路径成功、另一路径因多命中失败。逐路径检查 `status/data/msg`，不选第一个候选 |
| 路径→组织ID | `HrmBrowserUtil#queryDepartmentIdByFullPathName`；`Map<String,WeaResult<Long>>`（D03:35–56） | `fullPathNameList/tenantKey/separator/containDisable`；停用范围要明确，不与上一入口混为同一返回 |
| ID→路径显示 | `HrmBrowserUtil#buildOrgPathName`；`Map<Long,String>`（D03:6–33） | 配置 `levelType/levelSeparator/orderType`；参数 `idslist` 被标成单个 `Long`，批量形态须查实际签名 |
| 组织上下级 | `HrmCommonDepartmentService#findRelationOrgIdByCondition`（D04:6–48） | `org_direct_subcompany` 对部门先取归属分部、再取该分部上级；不是返回当前归属分部。分部查 `org_direct_department` 返回 null |
| 带范围组织关系 | `#findRelationOrgMapByCondition` / `#checkRelationOrgMapByCondition`（D04:71–112） | 条件含 `ids/tenantKey/queryType/containCurrent`；`targetIds=[]` 明确为**不过滤**，不是零权限/无结果。结果分别按输入ID返回列表/布尔值 |

`HrmOrgRelationCodition`、`constainDisableOrg`、`org_direct_child_sucompany`、`countReationOrgMapByCondition` 均为来源拼写。D04 的关系查询段将停用开关限定于两个直接下级类型，统计段又描述为“包含封存”；不要推广为所有关系查询均支持同样过滤。（D04:12–36、50–69）

## 4. 主次账号与主兼职身份分别映射

| 所需关系 | 已读来源提供的入口与字段 | 使用边界 |
|---|---|---|
| 按兼职条件查记录 | `HrmCommonExtraOrganizationService#queryByCondition`；远程 `HrmCommonRemoteEmployeeService#queryExtraOrgByCondition`（D10） | `HrmExtraOrganizationCondition.idList` 是兼职ID，`employeeIdList` 是主身份ID；返回 `HrmExtraOrganization.id/employeeId/departmentId/positionId/superiorId`。参数表没列租户，不证明接口无需租户上下文 |
| 主身份→所有兼职信息 | `#getAllExtraOrgInfos`，入参 `employeeId/tenantKey`（D11） | 表列 `QueryExtraBaseInfoResult.extraInfoId/departmentId/positionId`，但未给集合包装；不因标题“所有”就编造 `List<...>` 签名 |
| 保留所选身份查询属性 | `HrmComEmployeeExtraOrgHandler#listEmpAndExtraInfo`，`ids/tenantKey/extraType`（D13） | `extraType=superior/department/position`；返回 `Map<Long,T>` 的键保留人员或兼职身份ID，值依属性变化 |
| 保留所选身份查询详情 | `#listEmpAndExtraComInfo`；`Map<Long,HrmEmployeeComInfo>`（D13） | 兼职对象额外 `mainId` 指主身份，主身份时 `mainId` 为空；来源称比上一方法多一次IO。不要无条件转主身份而丢失兼职组织 |
| 主/兼职ID→对应岗位 | `#findEmployePostionInCludeExraOrg`；`Map<Long,Long>`（D12） | 原文称仅岗位非空时有键；缺键不是证明身份不存在或无权限 |
| 人员ID→主次账号 | `HrmCommonEmployeeService#listBelongtoEmployee` / `#batchListBelongtoEmployee`（D14–D15） | `accounttype=0/1` 对应主/次；仅次账号的 `belongto` 有效；`containMain` 控制是否含主账号。D15说明次账号入参会包含自己，主账号入参默认不包含自己 |
| 登录账号→主次及兼职 | `#getBelongtoEmployeesByUserIdAndConfig`（D14:44–55） | 入参 `userId` 明确为登录账号 `user_id`；`includeExtraOrg=true` 才表示包含兼职。该段缺完整返回与租户参数说明，不照其他入口补齐 |

同一数值类型 `Long` 不表示可互换；映射结果至少要记录当前租户、ID种类、主/兼职关系和所取业务属性。数据去重按需求选择人员维度或身份维度，不能默认按主身份合并后继续做岗位/部门审批判断。

## 5. 回显与返回 Hook：显示成功不是查询或授权成功

### 5.1 人员组织混合浏览的回显载荷

D16 只给回显载荷与返回示例，**未给 HTTP 路由、调用方法、认证、最低基线或失败契约**。载荷是一组对象，每项有 `module="hrm"`、`browserType="hrmcombination"`、`dataIds`，并在 `customParam.dataType` 按 `resource`（人员）和 `dept`（部门）分类。应使用当前字段实际选中对象与类型，不能按ID格式猜分类。

返回示例将两组请求合并在 `data.hrmcombination`，项包含 `id/content/dataId/delete/complete` 等；人员还见 `_entityType="user"` 和**字符串形式** `avatar`。这个例子不承诺返回顺序、不承诺可按两组请求下标切片，也不能推导 `complete=false` 的业务含义。不要把 `content` 直接重命名成所有组件的 `name`，或把 `resource` 无条件改成表单人员范围的 `user`。（D16:6–106）

表单赋值的 `specialObj` 与字段类型见 [E10表单SDK实例与字段操作示例补充](e10-form-sdk-examples.md)；浏览已有名称不会自动赋予人员、组织或业务记录访问权，也不证明数据已保存。

### 5.2 “公共SDK接口”标题下实际写的是后台拦截点

| 来源/标识 | 已写明的处理点 | 不直接照抄的部分 |
|---|---|---|
| D17 `HRM_Inter_ORG_001` | 组织全路径返回修改，明确 **202501基线支持**；`result` 中 `data` 为部门ID→名称列表、`config` 含分隔符及 `moduleForm` | 示例从每个列表 `remove(0)`，空列表会异常且改变列表；文表说回传result内容，例却回 `{"result":newMap}` 丢失原配置。返回包装和空值行为待现场确认 |
| D18 `HRM_INTER_HRMINFO_001` | `getEmployeeByIds` 返回内容拦截，表列 `userList: List<EMUser>` | 示例从 `params.result.userList` 取值，与表层级不同；回传 `{"result":userList}`。只检查手机号含 `**` 后设置 `send=0`，不是手机号权限模型 |
| D19 `HRM_COM_getEmployeeByKeyWords` | 关键字人员信息返回拦截 | 示例直接取 `params.userList` 并清空 `mobile/telephone`，不能套用D18嵌套层级；未给基线，不沿用D17的202501承诺 |

这三页没有提供前端 `getEmployeeByIds(...)` 的调用签名；不能仅凭标题生成浏览器调用。现场要分别核对Hook入参/返回形状、非目标页面、空列表、失败保留原结果和敏感字段规则；本文不发放未验证的Hook模板。

### 5.3 解密能力不等于查看权限

D20 `HrmCommDsDataSecurityHandler#decriptEmployeeSysField` 接受 `beans`、`tenantKey`、`getSetPairMap`；映射左值是字段getter，右值是setter。其示例对缓存取到对象的手机、邮箱解密并返回，未给访问权限、脱敏或共享缓存对象安全保证。需要先确认调用方授权与对象生命周期，再选择允许返回的字段；不能因为已有解密接口就将联系方式、密文或完整人员对象写日志或交付物。

## 6. 必须保留的资料缺口

| 编号 | 来源 | 可确认问题与处理 |
|---|---|---|
| C01 | D01:10–24、42–55 | “本地接口”和“远程接口”都写同一Remote类，但例用Common服务。仅做定位，实际依赖与签名需核对 |
| C02 | D05:82–90 | 排序示例没有填该文声称必需的 `tenantKey`；不得照抄为完整实现 |
| C03 | D02:29–31 | Java围栏用 `[...]` 列表字面值，不是可编译Java；全文样例标识不作为客户默认值 |
| C04 | D03:16、D01:75–80、D06:26–105 | 分别存在组织ID参数类型歧义、返回空表及测试响应双层包装；不能拼成统一数据查询合同 |
| C05 | D07、D10–D15 | 过滤默认值、若干租户入参、集合包装、空值和主次/兼职组合未完整定义；保留方法级差异 |
| C06 | D17–D19 | Hook入参位置和返回结构各不相同，组织例还有列表越界/修改风险；只登记候选扩展点 |
| C07 | A01–A02 | `HrmRemotingConfigSetService#selectData` 是基础配置查询，不是人员查询；`HrmRemoteEmployeeService#getById` 标人员查询。二者实际 `methodSignature/params/responseParams` 和例子均空，即使顶层有方法名、基线 `10.0.2307.00`、status=active，也不能生成调用 |
| C08 | A03 | `POST /api/bs/hrm/contact/main/table` 有请求样例，但请求/响应参数表为空，响应在 `operates.visible` 后截断；`serviceName` 混入创建时间。只能定位通讯录查询，不能据例确认必填项、分页、授权或完整响应 |
| C09 | H01及模块实盘 | MODULE称有 `references/filter-report.json`，实际文件缺失；不能宣称过滤日志证明所有上游页已收齐 |

## 7. 落地前最小核对与本次完成范围

实施前拿到实际版本依赖、目标方法签名及脱敏返回，至少核对：普通/离职/删除人员、内部/外部人员、无兼职/多兼职、主/次账号、同名与重复路径、启停组织、空范围、无结果、无权限及不同租户。权限、结果包装和跨租户默认值未核实前，不将本页转成批量导出或身份转换程序。

本次完整核读20/121篇正文及3/16条API记录；另读MODULE和API来源导航。其余101篇正文、13条API、9张图片、2个检索脚本以及未全文读取的索引/别名文件未消化，逐项清单见JSON。没有执行工具包脚本，没有访问远端文档/真实接口、登录、解密或客户数据；本页已作为随包参考卡，具体 API 的适用性仍须现场验证。

### 来源定位

D01–D04：`组织接口/` 下“1-组织查询和全字段查询”“2-组织-根据全路径查询组织”“3-组织全路径接口”“5-组织上下级查询”。D05–D09：`人员接口/1.人员查询接口/` 下“人员查询接口-通用接口”“人员全信息查询接口”“根据人员id查询人员信息-多个过滤条件”“查询当前人员是否可以查看离职人员”“多维维度人员接口”。

D10–D13：`人员兼职接口/` 下1-1至1-4四篇。D14：`人员接口/1.人员查询接口/主次账号查询.md`；D15：`组织人事功能对接/主次账号相关/根据人员id获取主次账号及多身份接口.md`；D16：`功能对接/1-浏览按钮回显.md`。D17–D19：`组织人事二开口子/4. 公共SDK接口/` 三篇。D20：`功能对接/2-组织人事字段解密.md`。

A01/A02/A03：`hr-dubbo-selectdata-001.json`、`hr-dubbo-getbyid-032.json`、`hr-http-api-bs-hrm-contact-main-table-268.json`。H01为MODULE；全部精确库内路径、docId、指纹与结论来源均在JSON。结构化记录、原文和既有本库整理可能同源，交叉定位不算独立现场证据。
