---
title: "E10消息中心发送与状态处理边界"
platform: "E10"
status: internal-trial
source_record: "e10-message-center-boundaries"
source_manifest: manifest.json
---
# E10消息中心发送与状态处理边界

> 随包解释卡，供内部试用。通用正文、API、案例与已有本地附件先查 [资料导航](../library/catalog.md)，按标题或符号检索后使用 document_id 读取；不依赖维护者电脑路径。本页的核读日期、数量与行号描述当时的整理范围，不代表当前整库验收。详细维护记录不随包，客户工程与现场配置另行提供；知识卡指纹见 [manifest.json](manifest.json)。

## 先分清六件事

**消息接口受理成功，不等于渠道发送成功；渠道发送成功，不等于人已阅读、业务已办理或流程已办结。** 第三方对接说明明确发送为异步，调用时只检查参数；具体发送情况另查管理员日志（D15:90–92）。不要仅凭 HTTP 200、`code=200`、`status=true` 或拿到消息 ID 就认定整条业务链完成。

| 目标 | 本地来源支持的入口 | 不能顺带认定 |
|---|---|---|
| 发系统提醒、事项消息 | 内部 `AsyncSystemMessageRest.sendMsg(SendMessageEntity)`；第三方开放平台发送入口 | 不等于创建流程、统一待办记录或认证会话 |
| 通知已打开的前端刷新 | `sendNotice(NoticeEntity)`，浏览器/APP 注册回调后经 IM WebSocket/TCP 通知 | 不等于持久待办、必达队列或通知公告新建 |
| 更新消息已读/已处理 | 内部 `markRead(MarkReadEntity)`；第三方 `markMsg` | 消息状态不代替服务端业务权限、流程处理或真实完成状态 |
| 撤回/删除消息 | 内部 `deleteMsg(DeleteMessageEntity)`；第三方 `deleteMsg` | 不等于删除业务记录；也不是个人消息规则 `/user/delete` |
| 对消息按钮执行业务 | HTTP→消息中心/云桥→业务 Dubbo，或 IM 页面组件 | 点击、隐藏按钮和标记已处理均不是业务事务成功证明 |
| 查询发送情况 | `querySendResultByMsgId`；管理员发送日志 | 规则检查、渠道结果、阅读、业务处理是不同层次 |

依据 D01、D03–D05、D11、D15–D21；来源编号见文末及核对 JSON。本页仅作 E10 资料边界，不移植 E9 的令牌、RSA、消息类型、接口路径或返回约定。

## 1. 内部 SDK 与开放平台不是同一个 DTO 合同

### 内部服务发送

D09/D10 给出 `com.weaver:weaver-mc-api` 依赖与 `@Autowired AsyncSystemMessageRest`，并特别提醒此处不使用 `@RpcReference`；没有依赖版本或完整客户工程，不能据此保证可编译。

D01:20–247 的实体声明可用于定位以下字段，但应与现场 jar 核对：

- `module/event` 必填；自定义枚举不存在时有 `moduleId/eventId`。`businessId` 用于匹配已对接的规则数据范围，不是消息 ID 或通用幂等键。
- `sender` 必填；普通内部消息文档允许无实际发送人时使用 `UserEntity.SYSTEM_USER`，但外部人员发送明确另有限制，见 §5。
- 接收人 `receivers` 与 `userAllType` 二选一；`UserAllType.allUser=true` 会忽略 `users/userTypeIds`。这是扩大人员范围的真实开关，不能为“修复收不到消息”自动启用。
- `channels` 在实体注释中“不传用规则配置”，同页参数表却“不传推送所有渠道”；保留冲突。渠道设置不能绕过已关闭规则，实际渠道取值及规则结果要另核对。
- 事项 `entity.id` 关联打开详情及后续标记；`thirdId` 为第三方无法保存消息 ID 的关联线索，不证明服务端去重。`title` 文档优先级为 `title > entity.name > text`。
- `todo=true` 表示待办消息；业务处理后仍须调用标记接口。`emailInfo`、动态模板参数、非模板短信等是渠道特有字段，不照搬到 HTTP 的 `emailEntityVo`。

### 第三方接入

D22 要求先申请开放平台应用、取得认证能力，再配置消息模块、事件和规则。D17 的正文路由为 `/api/mc/msg/sendMsg`，A10 的记录则为 `POST /sapi/mc/msg/sendMsg`、`application/json`、最低基线 `10.0.2509.01`。**不能仅凭相似路径把两者当可互换网关别名**；D17 本身没有明确 HTTP 方法或最低基线。

HTTP 正文使用原拼写 `recivers`、`emailEntityVo`，内部实体使用 `receivers`、`emailInfo`；不要擅自“纠正拼写”后提交。`sender.workCode` / `recivers.workCode` 与 `employeeId` 二选一、同时存在优先后者，来源只说从“0402、0501基线的最新补丁”支持，没有年份/完整版本，不能套用到全部客户。

两个来源的必填性也不同：D17 将接收人及多个人员字段标为必填，A10 仅将 `moduleId/eventId/sender/entity.id` 标为必填；D17 的 `channels` 重复两行且一行“否”、一行“是”。这是待核实差异，不是自动放宽参数的理由。

来源将访问令牌放在查询参数中；本页不复制带令牌地址，不替平台发明另一个可用认证头。实施须由负责人确认实际网关、应用授权、凭据传输与日志脱敏，禁止把来源样例租户、手机号、邮箱、人员 ID 或真实地址直接用作项目配置。

## 2. 规则、渠道与待办消息

D14:1–33、47–53：模块+事件+已支持的业务数据范围匹配规则；按优先级只执行首个匹配规则，规则决定是否发送、渠道、模板和推送目标。个人规则生效以前提团队规则开启为限。D15:12 明确第三方系统在该说明中不支持数据范围；不要套内部 `businessId` 说明突破这一限制。

A10:290–301 / D17:76 给出的发送渠道为 `1 IM、2 云桥、3 邮件、4 短信`；显式传渠道也只有规则里配置了才有效。查询结果页 D21 另列 `5 消息订阅`；`getSupportChannel` 只返回 `[1,2,3,4,5]` 示例，不证明发送 DTO 接受第五项，也不证明某客户开通全部渠道。

D12:1–25 的待办消息有两种入口：规则统一将某些模块事件设为待办（来源推荐），或调用时 `todo=true`。云桥还需对应待办模板；**非待办消息配待办模板会发不出去**。IM 的非待办消息若推送目标设为“未处理”，来源提示“标记已读会同时标记已处理”，不能假设两种状态永远独立。

与 [E10统一待办ECODE与审批推送边界](e10-unified-todo-boundaries.md) 的关系：`WPushRequestForECODE/WPushRequestForMQ` 是 E10 流程信息向外推送，`receiveRequestInfo` 是外部写入 E10 统一待办中心；本页 `sendMsg` 是交给消息渠道，`todo` 是消息处理属性。三者业务上可能组合，但当前资料没有给出 ID、状态、重试或事务的通用映射。（C01:36–100）

## 3. 标记、删除与按钮：先界定影响对象

### 标记已读 / 已处理

D03 的 Java `MarkReadEntity` 用 `markers`，还列租户、单/多事项 ID、`msgIds`、`flag/statue`、按钮国际化。开发平台片段改用 `operator`；D18 的 HTTP 表又同时要求 `operator` 和 `markers`，示例却常漏掉 `markers`。不得将其合并成“任意字段均可”的通用载荷。

按 D18:36–41 / D03:73–107 的**业务示例**区分：

| 示例组合 | 来源意图 | 不可推导 |
|---|---|---|
| `flag=1, statue=0` | 标记已办 | 不是业务审批提交或流程办结 |
| `flag=1, statue=1` | 强制撤回时删除消息 | 不是执行流程强制撤回 |
| `flag=1, statue=2` | 删除流程时撤回消息 | 不是授权删除流程或表数据 |
| `flag=1, statue=3` | 退回时待办转已办、消息不删除 | 不表示下一节点新待办已自动创建 |

此表不是消除冲突后的权威枚举：D03 Java 注释另有 `flag=2` 删除，`statue` 注释仅列 0–2；参数表却说 `statue` “标记已读时使用”。D18 表明确企业微信/钉钉标记已处理时 `entityId` 必填，但类型表写 int、示例给字符串。应以现场接口和实际样例确认，不照状态数字猜调用。

### 删除 / 撤回

D04:20–44、68–94：内部 `DeleteMessageEntity` 支持 `msgId/thirdId/taskId/taskIds`；`taskId` 对应发送时 `entity.id`，`operator` 必填。**`recivers` 为空时删除所有人员的相关消息；指定时才限定人员，且人员 ID/租户必填。** 按事项可能覆盖同一事项的多条消息，不能只因方法名 delete 就用于单个接收人重试清理。

这些筛选条件同时存在时的优先级、空目标行为、跨租户约束、各渠道撤回能力/时限均未给出。D19 的 HTTP 筛选项仅明确必填 `msgId` 与可选 `recivers`，另要求操作人 `operator` 及其 `employeeId/tenantKey`；不能把内部支持的 `taskIds/thirdId` 无依据加到 HTTP。来源的默认操作人说明不等于允许任意用户冒用该身份，实际上下文与授权仍须确认。

### 自定义按钮

D07/D16：类型 1 由前端请求消息中心（云桥可能先转发），再调用业务实现 `com.weaver.mc.api.rest.ImExecuteRest#execute`，Dubbo group 来源为 `MessageModule` 的 `YqModule`；类型 2 打开业务组件，仅 IM 支持。`componmentName` 保留原拼写。它不是从消息任意执行一个外部 HTTP URL 的授权。

- `msgShareType=1` 为各人独立，`=2` 为一个人处理后所有接收人均被视作处理；这是业务范围决策，不应作为方便同步的默认值。
- 返回/后续调用的 `statues` 为列表：1 隐藏按钮、2 已读、3 已处理、4 修改内容；不是 `markRead.flag/statue` 的同一枚举。隐藏、已读、改内容限 IM；标记已处理在 IM/云桥支持，云桥可替换按钮文字。
- HTTP 模式可在业务结果中返回消息变更；组件模式或用户从业务页面直接办理后，可通过 `executeButtonMsg` 更新消息。D16:107–108 的处理人字段被注释，实际上下文仍需确认。
- 来源没有按钮回调的完整失败/超时/重放或并发合同。项目应先验证操作人对业务对象的权限、当前状态和重复提交，再按真实业务结果改消息；不能把隐藏按钮当安全控制。

## 4. 实时通知、发送结果与重试边界

`sendNotice` 用于前端实时数据变化通知：浏览器/APP 注册回调，服务端经 IM WebSocket/TCP 通道通知，D11 提供 PC 观察 `cmd=15422` 的调试线索。本地没有取得其所引 PC/APP 回调页，不能由此编造 SDK 注册/解绑方法。

D05 的 `NoticeEntity` 列 `recivers`、`isPush`、`toDev`、`msgType`、JSON 字符串 `content`；`toDev` 为 0 所有设备、1 PC、2 手机，表中 `isPush` 默认不发送推送。参数表/样例却分别用 `user`、`reciverIds`，还出现数字 `sender`；`msgType` 又分别称模块枚举 code 与调用者自定义。D20 HTTP 页写 `recivers` 和模块 ID，但开头错称“撤回接口”。应明确 SDK/HTTP 的实际模型，不能从字段近似推定兼容。

### 查询结果能证明到哪层

D21 为 `/api/mc/handle/log/querySendResultByMsgId`，只声明支持 **1 个月内**数据、必填 `msgId`；没有明确 HTTP 方法、最低基线、轮询间隔和限流值。返回示例把规则结果放在 `data.statue`，渠道结果放在 `data.sendResults[].statue`：

| 层次 | 来源枚举/含义 | 仍缺什么 |
|---|---|---|
| 规则检查 | 0 成功、1 限流、2 敏感词检查、3 规则检查失败、4 数据范围过滤、5 异常；末尾“无有消息消息接受人”文字不清，未给单独代码 | 完整错误描述、是否终态、允许重试条件 |
| 每渠道发送 | 0 成功、1 部分成功、2 全部失败 | 单个接收人结果、第三方投递回执、已送达/阅读含义、补偿细节 |
| 人员阅读 / 业务处理 | 不是此查询结果表的字段 | 必须另有业务与授权证据 |

因此部分成功后不能整批重发并假设不会重复；`thirdId` 可关联删除不等于已实现幂等。超时也不能直接断定未发送。建议项目记录脱敏的业务事件、租户/对象关联、接收范围、消息 ID 和确认的渠道结果，先查现状再决定失败子集补偿；这些是本库工程要求，**不是来源承诺已有恰好一次或自动重试**。

## 5. 人员、租户、链接与外部消息

D08 与 D01:73–74、119–138：外部人员仅声明邮件、短信、云桥支持；`outMessage=true`，发送人须为实际当前团队身份，不能沿用系统默认人去匹配别的租户模板。接收人的手机号/邮箱由调用方避免重复；外部人员场景的 `employeeId/tenantKey` 校验占位不能推广为内部人员任意填写或跨租户发送。

还须保留一处不一致：D01 把 `thirdAppId` 注释为第三方 appId，D08:18 却要求公众号关注者的 `openId` 放在该字段；实际渠道合同未核实时不得选择一个解释上线。D08:14 “消息发送人必须为…tenantKey”自身也混用了对象与字段，应与实际 sender/tenantKey 模型核对。

D06:35–44 明确 E10 内部事项 PC/H5 使用相对地址，外部系统可用绝对地址；`pcLinkeType/h5LinkeType` 为不同终端打开行为，不能借路由跳转绕过认证和对象权限。D01 的云桥 `pcUrl/appUrl` 与事项的 `entity.pcUrl/h5Url` 不是同一层字段；对外图文 `picUrl` 的免登录访问提示也不授权公开客户附件。

与 [E10集成登录与认证Dubbo接口边界](e10-auth-boundaries.md) 的关系：`loginSingle()` 是 E10 出站进入第三方，第三方进入 E10 属另一条认证链。消息链接本身没有免登能力；消息接收人、当前账号、租户及对象权限要分别校验，不能以“收到了消息”证明有权打开该事项。（C02:54–81）

## 6. 10 条结构化 API 记录：全部核读，不能补造空契约

下表基线均为来源声明，不等于现场验收；HTTP 记录的 `serviceName` 混入“创建时间”文本，不可直接当服务发现名称。

| 编号 | 入口 / 最低基线 | 已有证据及采用边界 |
|---|---|---|
| A01 | `AssembleMsgRest.sendMultiMsg` / `10.0.2501.01` | `weaver-em-msg-service`，参数 `MsgDataInfoVo vo`，WeaResult 示例给 `data.traceId`；真实方法签名、group/version 和 VO 字段合同未齐。不是 `AsyncSystemMessageRest.sendMsg` 的别名，也不能拿 traceId 当消息中心 msgId。 |
| A02 | `MailSendWorkService.sendRemindMail` / `10.0.2508.01` | `weaver-mail-send-service`；签名、参数、响应全空，不能生成无参调用或照搬 EmailEntity。 |
| A03 | POST `/api/mc/handle/config/getSupportChannel` / `10.0.2307.00` | JSON 请求 `{}` 与渠道数组成功例；不是渠道已授权或已配置的证明。 |
| A04 | POST `/api/mc/handle/messageRule/user/delete` / 同上 | 必填规则 `id`；删个人规则，不是删除消息。 |
| A05 | POST `/api/mc/handle/messageRule/user/queryByModule` / 同上 | 必填 `moduleId`；返回规则 ID、事件、渠道和状态；示例混入大量 `?`，不当有效 JSON。 |
| A06 | POST `/api/mc/handle/messageRule/user/queryModule` / 同上 | `{}` 请求与模块/状态成功例；无完整响应参数表。 |
| A07 | POST `/api/mc/handle/messageRule/user/update` / 同上 | 必填规则 `id`，个人规则 type=13、statue=1 开/2 关、ruleChannels；改发送配置，不是消息处理。 |
| A08 | POST `/api/mc/handle/messageRule/user/updateModuleRuleStatue` / 同上 | 必填 `moduleId/statue`，批量更新模块规则；参数表未列完整状态枚举，不能从消息标记的 statue 拷值。 |
| A09 | POST `/api/placard/createPlacard` / 同上 | 通知公告新建，仅有入口元数据；Content-Type、参数、响应空，不是 sendNotice。 |
| A10 | POST `/sapi/mc/msg/sendMsg` / `10.0.2509.01` | 消息发送记录，原始 raw 与结构化字段均核读；与 D17 的路由、必填性、类型差异见 §1。 |

## 7. 来源问题与采用限制

除前述路由、必填性、状态和身份差异，还保留以下问题：

1. D01 的 `optType/opType`、`roles/role`、`I18nEntity.i18nKey` 字符串/表中 long、`AtUserEntity.id` 字符串/表中 long 不一致；D01 示例 `setI18nId` 与 D02 `setI18nKey` 不同。查当前 jar，不编造兼容 setter。
2. D06 `h5Url` 类成员 String、表 int；打开方式类 int、部分表 string；D01 表将原本可选的 URL 标必填。不可凭表格自动生成 SDK 类型。
3. 邮件附件内部字段写“附件 ID”，HTTP 表写“附件地址”；抄送/密送有邮箱与人员 ID 的例子差异。未确认之前，不透传附件 ID/URL 或人员值。
4. D01/D02/D09 的 Java 例包含多字符单引号字符串、旧 setter 等；多页返回用了中文逗号/引号，HTTP 记录还有问号污染，JSON 例含注释/尾逗号。这里只静态指出，不执行、不自动修成“已验证代码”。
5. 大多数 Markdown 页无最低版本；文档更新时间、归档 1.3.4 和 API `status=active` 都不能替代功能基线。HTTP 记录基线不得套到内部 SDK、所有渠道和按钮能力。
6. MODULE 声称有 `references/excluded.json`，本地不存在；因此无法复核“已排除废弃/不推荐内容”。正文仍含 `userType(废弃)`，也不能因模块排除声明就忽略它。

## 8. 项目使用前的最小自检

1. 明确目标：普通提醒、消息待办、实时通知、业务统一待办、通知公告，或认证跳转；确认租户版本、消息模块/事件、规则、渠道和精确入口。
2. 取得脱敏真实成功/失败报文与依赖签名，核对身份来源、DTO 拼写、状态枚举、实际租户与接收范围；禁止默认 `allUser` 或删除全员。
3. 经授权的测试环境先验证单人单渠道，再验证部分失败、重复/超时、业务办结后的消息同步、撤回/删除影响、共享按钮并发和 PC/移动跳转权限；不向真实用户“试发”来探测合同。
4. 将预期/实际/未通过项写入项目文档。发送受理、规则通过、渠道发送、阅读、业务完成分别记录；本页不替接收方填写通过结论。

## 来源范围与维护

本次完整核读 **22 篇正文 2,057 行、10 条 API 记录 1,179 行、MODULE 51 行、API 来源目录 14 行**；22 篇包含系统消息接口全部 8 篇，以及发送规则、异步调用、待办、按钮、第三方接口与结果查询的必要前置。完整来源共 3,301 行，另按 C01/C02 指定范围对照本库相邻知识。

模块实际有 **355 篇正文（20,391 行）**，`index.jsonl` 也有 355 条；本次索引仅做库存对应检查，**其余 333 篇正文未消化**，不是“已完成整个消息中心模块”。其中收藏/待办/关注/标签全域、更多渠道与规则 API、组件等保留后续盘点；脚本、附件外链、图片、未附排除清单、客户环境均未核验。

编号：D01–D08 为系统消息 8 篇；D09–D10 为接口调用/异步调用；D11–D16 为通知、待办、业务提醒、规则、第三方对接、按钮功能说明；D17–D22 为第三方发送、标记、撤回、通知、结果查询、发送前置。A01–A10 顺序同 §6；C01 为统一待办边界全文 1–132，C02 为认证边界 1–130。

逐文件相对路径、SHA-256、物理行数、核读范围、逐项结论证据、333 篇实际未读文件集合及缺失来源见 E10消息中心来源核对-20261021.json（来源记录，未随包）。不改工具包原件、旧知识正文、索引或发布稿；由主审统一挂索引并复核。本次未执行工具包程序、联网、登录、读取会话、调用接口或发送/删除消息。
