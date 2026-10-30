---
title: "E10统一待办ECODE与审批推送边界"
platform: "E10"
status: internal-trial
source_record: "e10-unified-todo-boundaries"
source_manifest: manifest.json
---
# E10统一待办ECODE与审批推送边界

> 随包解释卡，供内部试用。通用正文、API、案例与已有本地附件先查 [资料导航](../library/catalog.md)，按标题或符号检索后使用 document_id 读取；不依赖维护者电脑路径。本页的核读日期、数量与行号描述当时的整理范围，不代表当前整库验收。详细维护记录不随包，客户工程与现场配置另行提供；知识卡指纹见 [manifest.json](manifest.json)。

## 先选方向，不按“统一待办”四个字拼接口

本次工具包资料补的是**标准 HTTP/MQ 推送出口及统一待办中心接收线索**，不是用来替换 统一审批推送开发手册（来源资料，需在 library 按标题检索） 的自定义 `WPush` 扩展。工具包标题里的 ECODE 表示可承接订阅数据的二开平台；本模块未提供浏览器 JS-SDK、页面覆盖或前端事件契约，不能据此让浏览器承担服务端推送、凭据保管或 MQ 消费。

| 需要完成的事 | 资料能支撑的入口 | 边界 |
|---|---|---|
| E10 流程变更交给外部业务处理 | 标准 `WPushRequestForECODE` + `TodoURL`，或 `WPushRequestForMQ` + `queueName` | 是 E10 向外发送；接收方仍须核实鉴权、回执、重试与状态处理 |
| 在 E10 服务端定制转换、调用第三方及逐条结果 | 旧手册的 `WPushRequest` / `WPushRequestBoot`、`List<ResultMessage>` | 是自定义扩展层；不要把这两个父类替换成两个标准出口实现类 |
| 外部系统把任务同步进 E10 统一待办中心 | `POST /api/open{}intunifytodo/server{}engine/receiveRequestInfo` | 是外部向 E10 写入；不是前两项的原样转发地址 |
| 流程浏览按钮选择异构系统流程 | API 目录中的外链线索 | 无 URL、请求/响应参数，不足以实现调用或前端按钮 |

上表依据 H01:18–31、37–166，H02:6–124，L01:54–70、145–150、210–325；编号见文末。客户目标系统、人员匹配规则、字段映射、认证及验收仍属于项目材料，本页不把任何客户实现提升为平台通用合同。

## 1. 标准 HTTP / MQ 出口：可以确认哪些配置

配置入口为“统一待办推送 → 基础设置 → 新建推送信息”（H01:39–53）。

| 方式 | 来源声明的配置 | 使用前仍需确认 |
|---|---|---|
| HTTP | 推送类型“自定义”；推送类 `com.weaver.intunifytodo.client.engine.push.request.interfaces.WPushRequestForECODE`；配置项 `TodoURL` 为接收接口地址 | 现场实现是否存在；实际 HTTP 方法、请求头/认证、超时、成功回执与错误处理。当前摘要只说明 HTTP 订阅和 JSON 推送体，不能借用接收中心 API 的 POST/返回码作为此出口合同 |
| MQ 方式 1 | 来源称公有云和私有化均可用；推送类型“自定义”；推送类 `com.weaver.intunifytodo.client.engine.push.request.interfaces.WPushRequestForMQ`；配置 `queueName` | 现场消息系统、访问权限、队列声明参数、确认/重投/死信、顺序与重复消费规则；上述契约未给出 |
| MQ 方式 2 | 来源称私有化可选推送类型 `ToMQ`，其他配置同方式 1 | 不把私有化选项推广为公有云可用；仍须核对当前版本后台 |

H01:140–166 还声明：`maxLength`“暂无实际作用”；队列“可能”实际消费时才自动生成，并建议预建。它们是该资料的描述，不是本次消息系统实测；不能以 `maxLength` 作为容量/背压保障，也不能未经授权替项目创建队列。

H01:53 的“所有流程信息”不可理解为绕过流程/人员过滤。旧手册明确先检查租户开关和合法性，再做流程、人员过滤、人员转换并调用推送实现（L01:64–70、100–120）。两份资料层级不同；标准出口现场是否沿用全部链路仍应核查，不能承诺所有租户/所有流程无条件发送。

## 2. 推送载荷与接收参数不能直接互换

### 2.1 向外推送的包络

H01:55–138 提供的是缩减后的字段摘要，而非完整长 JSON：

- 顶层：`id`、`sysCode`、`serverURL`、`data`、`paramJSON`；其中示例使用 `paramJSON.todoURL`。
- `data`：租户/时间、创建人、流程/节点、`flowStatus`、`operateType`、`pcUrl/appUrl/adapterUrl`、`wpushType`、`detailMap`、`detailList` 等。
- `detailMap` 示例包含 `TODO`、`DONE`、`OVER`、`DELETE` 四组；明细还有接收人、日志/关联 ID、节点、阅读/处理标识、办理链接等。
- 多语言示例键为 `nodeNameMultiLangNodeName`、`workFlowNameMultiLangList`、`currentNodeNameMultiLangList`，元素包含 `langType/langValue`。这里只保留原拼写，未证明所有版本均有这些字段。

此摘要没有完整类型/必填性、空值/缺组约定、`detailMap` 与 `detailList` 的对应规则、事件先后或唯一去重键。不能把四个空数组示例当成“无数据即删除”，也不能无依据合并两个明细来源后双重发送。`DELETE` 表示推送状态组线索，不代表获得物理删表授权。

### 2.2 外部向 E10 接收中心发送

H02:6–102 记录：

- 接口：`POST /api/open{}intunifytodo/server{}engine/receiveRequestInfo`，`Content-Type: application/json`。
- 服务：`weaver-intunifytodo-server-engine-service`；记录最低基线 `10.0.2307.00`。这是来源元数据，不是当前租户可用性证明。
- 字段分组：系统与流程标识 `syscode/flowid/workflowcode`；标题及节点 `requestname/workflowname/receivernodename/nodename`；链接 `pcurl/appurl`；人员和时间 `creator/receiver/createdatetime/receivedatetime/receivets`；状态/扩展 `isremark/viewtype/custom`。
- 响应示例分为 `message.errcode/errmsg` 与 `data.syscode/flowid/receiver/operResult/message`。`errcode="200"`、`operResult="1"` 仅是该成功示例的字符串值，不是完整结果枚举，也不等于 HTTP 状态码合同。

路径中的 `{}` 按来源保留；落地前应核对部署网关的真实路由，不能自行删改、替换或由它拼出公网 URL。现有记录无鉴权、租户/人员上下文、完整字段类型/必填性、状态枚举、重复/乱序处理、删除调用规则、限流或失败合同。`isremark="2"`、`viewtype="1"` 只给出示例，不能由此建立“TODO/DONE/OVER/DELETE → 数字”的映射。

特别注意：H02 的请求与响应示例采用**不同的系统码和流程标识**（27–49 对 76–89），并非可证明同次调用的一对报文；示例还有手机号式人员值。本页不复制这些值，也不推定人员一定以手机号匹配。

## 3. 与旧审批推送手册的交集和差异

旧手册保留标准内部链路、反射/SpringBoot 两种自定义加载方式、`@WPushClass`、逐条 `ResultMessage`、人员转换和 `SendGroup/ResultRule`。工具包新摘要增加可配置的标准 HTTP/MQ 出口与相反方向的待办接收 API。两者互补，不整段覆盖。

| 对照点 | 来源差异 | 采用边界 |
|---|---|---|
| 自定义参数包络 | H01:59–68 为 `paramJSON`；L01:360–374 的 `SendDataBean` 为 `param` | Java 成员与线上的序列化名称可能不同；未经真实报文/现场类确认，不擅自统一键名 |
| HTTP 地址配置 | H01:47–51 写 `TodoURL`；65–67 示例写 `todoURL` | 配置标签与载荷键的大小写各自保留，不宣称它们可随意互换 |
| `isProcessed` | H01:125 为“是否已处理”；L01:464–465 为“超时状态标记” | 明确含义冲突，不能用于成功判定或自动重试条件 |
| `isRemark` / `isremark` | 推送摘要称处理标识；旧实体称审批身份、类型 `OperateRemarkEnum`；接收 API 称处理状态且仅给值示例 | 名称近似不代表同一枚举，禁止直接透传推断 |
| 流程状态 | H01:85 称 `flowStatus` 为对象；L01:405–406 为 `RequestFlowStatusEnum` | 缺真实 JSON 序列化合同，不臆定对象结构或字符串枚举 |
| 自动补偿 | L01:139–143 限于 `ResultRule.PushError`；HQ HTTP/MQ 摘要未写成功回执与消费重试 | 不能把旧自定义扩展补偿机制等同于外部 HTTP/MQ 端到端“自动成功/恰好一次” |

旧手册的开发示例也不是现成可用的调用器：`postData` 在 L01:306–311 仅返回空对象，随后 L01:285 对 `resultMessage` 调用 `toString()` 存在缺值风险。这里只指出边界，未改旧文、补写客户接口或编译验证；不要把示例直接用作已交付实现。

## 4. 浏览按钮、原文及版本缺口

1. **浏览按钮仍只有线索。** H02:104–124 的本地记录 `e10-http-7424bb43a938365a` 声明 POST、最低基线 `10.0.2307.00`、服务 `weaver-workflow-list-service`，但没有 URL、Content-Type、请求或响应参数，只指向外部文档 3.5 节。本次未联网访问；不得补造按钮接口、返回结构或权限逻辑。
2. **两个 reference 不是同一完整合同的重复副本。** H01 自称从“【34507】新增功能：统一待办推送支持ECODE方式开发.docx”提取，负责推送订阅；H02 自称 API 整合记录，负责接收中心和浏览按钮线索。它们没有证明可直接串联，也没有提供独立原文交叉认证。
3. **原件与截图未在该模块随附。** 实际模块只有 `MODULE.md` 和两份 reference；H01:168 明确省略截图与超长 JSON。按工具包 1.3.4 文件名搜索未找到其声明的 `34507`/同名 DOCX，不能称本次已核读原 DOCX、截图或完整报文。目录里的“文档版本控制”也没有对应的版本正文。
4. **版本不可外推。** H01 的提取日期 `2026-06-23`、H02 的归并日期 `2026-06-26` 不等于功能基线；两条 API 的基线不覆盖 HTTP/MQ 标准出口、自定义父类、所有字段或所有部署方式。旧手册也明确未标基线，原始 HTML 留存状态为“已失效”（L01:50–56）。

## 5. 项目接入前的最小证据

这是待接收方核验的资料清单，不是已通过的测试：

1. 确定数据方向与目标：向外订阅、服务端自定义推送，还是外部写入 E10；确认现场版本、开关、过滤范围和对应类/路由。
2. 取得脱敏后的真实请求、成功/失败回执和认证说明；明确人员标识、租户隔离、状态映射、时间格式/单位、唯一键，以及重复、乱序、删除和异常重试规则。客户证据留在项目文档，不回写为所有 E10 的默认值。
3. 经授权在测试环境验证待办→已办→办结/删除、代理人员、重复事件、断网/超时、权限失败、PC/移动链接；逐条记录预期、实际与未通过项。使用 MQ 时另外验证确认、重投和队列配置。测试结果不跨租户、版本或宿主套用。

本次仅做离线资料核对，未请求接口、访问外链、执行工具包程序、修改配置、编译或操作客户环境。

## 来源定位与维护

完整 SHA-256、逐文件行数、核读范围、差异及检查结果见 E10统一待办来源核对-20261021.json（来源记录，未随包）。

| 编号 | 文件（相对工具包模块或本 E10 目录） | 本次核读范围 |
|---|---|---|
| H00 | `e10-intunifytodo-push/MODULE.md` | 1–37，路由摘要，不作为独立原始 API 合同 |
| H01 | `e10-intunifytodo-push/references/source-doc.md` | 1–168，HTTP/MQ 功能提取稿，含原文省略声明 |
| H02 | `e10-intunifytodo-push/references/api-docs.md` | 1–125，接收 API 与浏览按钮目录线索 |
| L01 | `统一审批推送开发手册.md` | 1–478，既有整理页；原始 HTML 未重新取得 |

其他工具包模块、数据库表原件、客户工程和远程链接不属于本次逐正文核读范围。保持原件、旧手册及客户资料不变；按主审统一更新索引与覆盖台账，不将“已核对本模块三份文本”写成“端到端统一待办已验证”。
