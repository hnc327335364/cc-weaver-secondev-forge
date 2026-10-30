---
title: "E10主明细局部更新契约与载荷示例"
platform: "E10"
status: internal-trial
source_record: "e10-partial-update"
source_manifest: manifest.json
---
# E10主明细局部更新契约与载荷示例

> 随包解释卡，供内部试用。通用正文、API、案例与已有本地附件先查 [资料导航](../library/catalog.md)，按标题或符号检索后使用 document_id 读取；不依赖维护者电脑路径。本页的核读日期、数量与行号描述当时的整理范围，不代表当前整库验收。详细维护记录不随包，客户工程与现场配置另行提供；知识卡指纹见 [manifest.json](manifest.json)。

本页补充“已经知道要用 `updateFormData`，但不知道主明细该怎么组装”的缺口。实际增量是两层 `detailDatas`、三项防误新增/覆盖策略，以及字段匹配和 ID 匹配的载荷区别；接口总览继续看 EB表单RPC接口整理（来源资料，需在 library 按标题检索），跨服务层约束看 [E10表单后端调用与数据操作契约补充](e10-form-backend-contracts.md)。

> 依据 e-code 工具包 1.3.4 归档的文档静态整理。示例是教学结构，不是已验证的客户实现；所有 `<...>` 和 Java 外部变量均须替换、核对，不能直接执行。没有运行来源程序、调用客户服务或数据库，也没有用客户 SDK 编译。

## 1. 先确定调用层和版本

本页主体只针对 `com.weaver.ebuilder.form.client.service.data.RemoteSimpleDataService#updateFormData(EBDataChangeReqDto)`，返回类型为 `EBDataChangeResult`。不要把下文 DTO 当成 HTTP 接口的请求体。

| 能力 | 归档中的版本说明 | 不能推导的结论 |
|---|---|---|
| EB 批量修改 | H1:1 写支持基线 `2304.01` | 不证明当前客户已安装所需依赖，或所有后来增加的策略都在此基线可用。 |
| 获取 RPC 服务 | H1:15–28 写 `10.0.2410.01` 起必须用 `PublishKitRuntimeUtil.buildRpcService(..., "ebuilderform", appId)`；之前可用静态引用 | `appId` 不是 `objId`。本库旧页 L1:80 的“推荐”弱于此归档“必须”，此处保留差异。 |
| RPC dataKey | H3:1 写 `10.0.2403.01`、服务 `1.17.0`，H3:6 注释却写 `1.7.0` | 不自行选择较低版本；须核对现场客户端和服务。 |
| HTTP v2 修改 | H4:3 写 `10.0.2404.01`、服务 `1.18.0` | 不代表其 `operationinfo`、`detail1` 可用于 EB RPC。 |

调用前确认目标应用、表单、租户、操作人及其权限；免登录场景的租户上下文要求见 H1:31–33，但设置租户不等于获得授权。不得使用文档示例的租户、人员、表单 ID。

## 2. 三件事分别配置，不能互相代替

| 业务目标 | 所在位置 | 本页处理 |
|---|---|---|
| 主表未命中时不新增 | `operation.mainData.needAdd` | 显式为 `false`；字段定义见 H2:45、53，H1 的主表示例反而是 `true`，不能直接照抄。 |
| 明细未命中时不追加 | `operation.detailDatas[明细表ID].needAdd` | 显式为 `false`；H1:271–315 给出按明细 ID 的实际“不追加”示例。 |
| 不用提交的几行覆盖原整表 | `operation.detailDatas[明细表ID].cover` | 显式为 `false`。H1:363–408 展示 `true` 的覆盖分支；本页根据 H2:55 的字段定义和 H1:242–248 的非覆盖写法组合使用，仍待目标 SDK 验证。 |

`updatePolicy=ALL` 是 H1“不追加”示例使用的数据更新策略，不等于 `cover=true`，也不能解读为“自动校验明细一定属于这条主表”。保留未提交行是本次需求的验收目标，不能只凭这三个参数就宣称已验证。明细所属主表、实际剩余行及未修改字段都要读回比对。

不要顺手把 `checkRight` 改为 `false`，也不要把“禁止新增”理解成“失败时必定抛异常”。原件未给 EB 未命中时的完整返回语义。

## 3. 双层结构：策略不是数据，表 ID 不是行 ID

| 路径 | Java 文档结构 | 内容 |
|---|---|---|
| `operation.detailDatas` | `Map<Long, EBDataReqOperationInfo>` | key 为明细表 `subformId`；value 是该明细表的更新策略。 |
| `datas[].detailDatas` | `Map<Long, List<List<EBDataReqDetailDto>>>` | 同一个明细表 ID 对应多行；每行是一组字段值。 |
| `datas[].mainDatas` 中 `fieldId="id"` | `EBDataReqDetailDto` | 按 ID 更新时的主表数据 ID。 |
| 每个明细行内 `fieldId="id"` | `EBDataReqDetailDto` | 按 ID 更新时的明细行 ID，不是主表 ID 或明细表 ID。 |

依据 H1:283–308、H2:45–46、59–74。两层 Map 的同一 key 必须指向同一明细表；不要把列表页显示行序号当成明细行 ID。

### A. 主表 ID + 明细 ID：局部更新的教学 JSON

**片段类型：EB DTO 结构示意，非可直接 POST 的 HTTP 载荷。** 由 H1 的主表 ID 更新和明细不追加示例、H2 的策略说明组合而成；不是原件逐字复制，也没有证明现场序列化名称与全部默认值。仅表示“一条主表 + 一个明细表 + 一行明细”；追加更多行应放进同一外层行数组，不要展开为字段平铺。

```json
{
  "header": {
    "objId": "<EB_FORM_ID>",
    "operator": "<OPERATOR_ID>",
    "tenantKey": "<TENANT_KEY>"
  },
  "operation": {
    "updateType": "ids",
    "checkRight": true,
    "needPostProcess": true,
    "asyncPostProcess": false,
    "mainData": {
      "needAdd": false
    },
    "detailDatas": {
      "<SUBFORM_ID>": {
        "needAdd": false,
        "cover": false,
        "updatePolicy": "ALL"
      }
    }
  },
  "datas": [
    {
      "mainDatas": [
        {"fieldId": "id", "content": "<MAIN_DATA_ID>", "matchByName": false},
        {"fieldId": "<MAIN_FIELD_ID>", "content": "<NEW_MAIN_VALUE>", "matchByName": false}
      ],
      "detailDatas": {
        "<SUBFORM_ID>": [
          [
            {"fieldId": "id", "content": "<DETAIL_ROW_ID>", "matchByName": false},
            {"fieldId": "<DETAIL_FIELD_ID>", "content": "<NEW_DETAIL_VALUE>", "matchByName": false}
          ]
        ]
      }
    }
  ]
}
```

替换要求：`<SUBFORM_ID>` 在真实 Java Map 中为已核验的 `Long`，不是文字占位符；主表/明细行 ID 和字段 ID 不可混用。示例只展示普通字段的赋值形状，选择框、附件、人员等须查对应字段契约，不把显示名称当存储值。

`needPostProcess=true` 是为了不把后置处理总开关顺手关闭；`asyncPostProcess=false` 来自 H1:102–103 的同步后置处理说明，但它不是事务或“全部动作已成功”的承诺。H2:31–35 写后置处理涉及权限、动作、ES 等；本例未关闭这些动作，真实项目必须明确是否应触发及是否可重复执行。

### B. 主表业务字段匹配：不要把匹配字段当更新白名单

H1:183–221 的实际示例使用 `EBDataUpdateType.updatePolicy` 和 `List<String> updateFieldIds`：列表内字段的 `mainDatas` 值负责匹配，另一个字段携带更新值。下面只展示这部分组装；**不是把 A 的 `"id"` 原封不动留下再叠加业务匹配**。

**片段类型：Java 组装摘编，非完整可运行类。** `operation` 是调用方已持有的同一个 `EBDataReqOperation`，字段 ID、匹配值和新值均为经核验的外部变量；需要当前客户端依赖、实际 imports 与 SDK 签名确认。现成示例只有主表字段匹配，不据此编造“明细按业务字段匹配”调用。

```java
// 在原 operation 上补充，保留调用方已确认的明细、权限及后置策略。
operation.setUpdateType(EBDataUpdateType.updatePolicy);
EBDataReqOperationInfo mainPolicy = new EBDataReqOperationInfo();
mainPolicy.setNeedAdd(false);
mainPolicy.setUpdateFieldIds(
    java.util.Arrays.asList(businessKeyFieldId, scopeKeyFieldId));
operation.setMainData(mainPolicy);

EBDataReqDto row = new EBDataReqDto();
row.setMainDatas(java.util.Arrays.asList(
    new EBDataReqDetailDto(businessKeyFieldId, businessKeyValue),
    new EBDataReqDetailDto(scopeKeyFieldId, scopeKeyValue),
    new EBDataReqDetailDto(changedFieldId, changedValue)));
```

此片段没有把 `row` 加入请求，也没有调用写入接口；若组合主明细操作，需要在明确的业务对象上装配 A 中的明细行。H1 有主表字段匹配与明细 ID 更新各自的示例，但没有完整展示这两种策略的组合，组合效果属于待验收项。

H2:54 把 `updateFieldIds` 标为 `String`，并写成 `updateType=updateFieldIds`，与 H1 实际列表/枚举相矛盾。此处以 H1 作为代码定位线索，不宣称已裁决 SDK 签名；不得自行造 `EBDataUpdateType.updateFieldIds`。`updateFieldIds` 不是允许改哪些字段的白名单，仍须在调用方限制可修改字段范围。

### C. dataKey：只替换有依据的字段表达，不整体换掉 operation

**片段类型：Java 字段组装摘编，非完整请求。** H3:7–15 明确了 `setReqType(FieldOperationTypeEnum.dataKey)` 与 `EBDataReqDetailDto#setDataKey(...)`。它的示例新建 operation，不能机械复制到 A/B 之后覆盖掉既有策略。

```java
// operation 为已经配置好的同一实例；确认基线及服务版本后才能使用。
operation.setReqType(FieldOperationTypeEnum.dataKey);
EBDataReqDetailDto field = new EBDataReqDetailDto();
field.setDataKey(confirmedDataKey);
field.setContent(confirmedValue);
```

该片段不证明以下事项：`updateFieldIds` 是否改传 dataKey、系统定位字段 `id` 在此模式怎样表达、明细表 ID 是否能换成编码、编码重复或不存在如何处理。H3 未展开这些组合；应读取当前 SDK/客户同类成功实现后再组装，不能把“其余逻辑照旧”扩写成未经核对的全套载荷。

## 4. 多命中、未命中、空值和返回值

| 事项 | 已有证据 | 必须保留的边界 |
|---|---|---|
| 主表未命中 | `mainData.needAdd` 表示未找到是否新增（H2:53） | `false` 不能证明返回错误或报错文案；禁止失败后直接改成 `true`。 |
| 明细未命中 | H1:293–305 的 `needAdd=false` + `ALL` + 明细 `id` | 没有展示逐行未命中报告，也没有证明错误归属/部分成功策略。 |
| 主表字段匹配多命中 | H2:52 列 `FIRST/MORE/ZERO/ADD/LAST/EXCEPTION/ALL` | 没有默认值、排序保证和完整触发规则，不能声称设某枚举就实现“多命中报错且全回滚”。 |
| 标识为空、匹配键为空 | 已读 EB 文档未提供完整语义 | 调用方在写入前拒绝缺失、空字符串或空白定位值；不能退化成无条件更新。 |
| 普通字段不传、空字符串、`null` | H2:73 仅标 `content:String`；H1 覆盖示例出现空串，但非清空契约 | 三者不能等同；仅发送本次授权修改的字段，“主动清空”另设明确需求与测试。 |
| 成功返回 | H1:487–496 示例为 `status:true`、`ids` 列表 | 未说明 IDs 是主表还是明细、与输入顺序对应关系或逐行结果；不可仅凭数量断言每条更新正确。 |
| 失败返回 | H1:499–511 示例包含无权限、有效字段为空 | 未覆盖网络超时但已落库、部分成功、并发修改及回滚；不得自动重发写入。 |

部门建议：业务键应按目标表真实规则做唯一性和范围核对；查到零条或多条先停止并返回可处理原因。预查询只能降低误写风险，**不构成并发唯一性或事务保证**。有唯一约束/版本条件/并发检测时也须核对其真实能力，不能在文档里虚构支持。

## 5. 不把相似名称拼成另一套 API

- **EB RPC 与 HTTP v2：**H4 使用 `operationinfo.updateField`、`mainTable`、`detail1` 等；示例里的 `"ids/updatePolicy"` 是选项提示，不应作为实际 `updateType` 值。HTTP 的 `needAdd` 为 String，文档默认不新增；RPC 为 boolean 且默认值未写。HTTP 只明确 `operateType[detailN]="cover"` 的覆盖入口，不能凭空加出“append/partial”值或套用 A 的分明细 `needAdd`。
- **EB 与表单引擎：**H5 的 `FormDataDtoParam/SubFormMatchDto` 有 `matchMore/noMatch/subFieldIds/subFormMatchMore/subFormNoMatch`；H6 又列排序、错误数据及行数限制。这些属于 `com.weaver.common.form...` 的契约，不是 `EBDataReqOperationInfo` 的字段。不得把引擎的“EXCEPTION 抛异常回滚”、`cover=false` 的累加说明或更新上限，直接当成 EB RPC 已验证的行为。
- **尚未补齐的真实缺口：**明细按业务字段而非行 ID 匹配；dataKey 与匹配字段/系统 ID 的组合；多命中时原子失败；未传/空/null 的清空语义。当前已读材料不足以产出可靠的通用成品实现，应向当前 SDK/现场实现取证，而不是增加更多看似完整的示例。

## 6. 接收方验证清单：未执行，不能预打勾

| 用例 | 需要证明的结果 |
|---|---|
| 一条主表、两行明细，只提交其中一行 | 主表目标字段和指定明细字段改变；另一行仍存在且值未变。 |
| 目标行含其他未提交字段 | 明确其值保持还是触发了默认/运算变化，不能把二者混为局部更新。 |
| 主表 ID 不存在、业务键无匹配 | 不产生新主表，不通过重试偷偷切换新增。 |
| 明细 ID 不存在或属于另一主表 | 不追加、不误改另一主表；核实真实返回与调用方错误处理。 |
| 业务键重复、空、仅空白 | 调用方拒绝或按已批准策略处理；无扩大更新范围。 |
| 主动清空与未提交 | 分别验证空串、null、缺字段，仅允许已确认的清空方式。 |
| 无权限、租户错误、字段/明细表映射错误 | 不绕过权限，不把忽略字段或零行处理记成成功。 |
| 后置动作、超时、重复请求和并发 | 核对实际变更及副作用，识别已成功写入；无证据时不自动重试，不宣称事务或幂等。 |

## 来源与本页检查

来源编号 H1–H6、L1 的完整库内路径、SHA-256 和已读行段见 来源核对记录（来源记录，未随包）。H1–H4 是工具包归档 EB 文档；H5–H6 仅用于识别跨层误用，L1 是既有本库整理页。原件均未改写。

本页只提供静态证据和教学片段；本地 JSON 解析、结构断言或括号检查不验证 DTO 真实签名、RPC 序列化、权限、事务、后置动作或客户数据结果。维护时应先比对来源哈希，再更新冲突说明，不把未验证项改成肯定结论。
