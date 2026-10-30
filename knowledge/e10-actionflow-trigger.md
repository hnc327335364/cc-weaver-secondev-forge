---
title: "E10自定义动作流触发与迁移注意事项"
platform: "E10"
status: internal-trial
source_record: "e10-actionflow-trigger"
source_manifest: manifest.json
---
# E10自定义动作流触发与迁移注意事项

> 随包解释卡，供内部试用。通用正文、API、案例与已有本地附件先查 [资料导航](../library/catalog.md)，按标题或符号检索后使用 document_id 读取；不依赖维护者电脑路径。本页的核读日期、数量与行号描述当时的整理范围，不代表当前整库验收。详细维护记录不随包，客户工程与现场配置另行提供；知识卡指纹见 [manifest.json](manifest.json)。

自定义动作流可以通过 HTTP 或 Java SDK 触发，不应在需求阶段直接判定“必须重写一套集成”。先核实动作流已有能力、输入输出及权限，再决定配置、低代码或二开。

> 证据范围：2026-10-21 阅读工具包 `1.3.4` 随附 V2 原文与单条 API 记录。结构化记录注明 HTTP 接口最低基线 `10.0.2307.00`，但 V2 原文未标明 SDK及迁移能力的最低版本；不能把该基线套用到本文所有能力。未连接客户环境、未触发动作流、未验证返回值或迁移效果。

## 一、先选触发方式

| 方式 | 文档已说明的前提 | 仍须现场核实 |
|---|---|---|
| HTTP | `POST /api/esb/server/event/triggerActionFlow`，JSON 请求；需要 E10 登录验证 | 当前环境认可的会话承载方式、权限、跨域、返回成功/失败结构 |
| Java SDK | `com.weaver:weaver-esb-server-api`；`EsbActionFlow` 与 `EventParams`；依赖 E10 基座 MQ 正常运行 | 现场 JAR 版本、真实方法签名、注入条件、人员/租户上下文、MQ状态及返回语义 |

HTTP 原文提到 `eteamsId` 登录凭证，并明确动作流不提供后端获取它的机制。它不是可随意构造的请求参数；不要推测登录接口、复制他人会话或把凭证写入交付文档。后端调用是否应采用 SDK 或其他获批认证方式，由现场契约决定。

## 二、HTTP 请求：先从配置页取实际参数

在动作流配置页取得触发参数，再替换业务字段。下面只是结构示例，不是某客户可直接执行的请求：

```json
{
  "customParams": {
    "mainTable": {
      "dataId": "<实际业务记录ID>",
      "docType": "<实际业务类型>"
    }
  },
  "moduleSource": "ecode",
  "esbFlowId": "<现场动作流ID>"
}
```

- `esbFlowId` 为动作流 ID，不能复用原文中的示例 ID。
- `moduleSource` 为来源模块标识；原文说明 ecode 触发时传 `ecode`，其他调用方按实际约定。
- `customParams` 是动作流自定义输入。示例中的 `mainTable/dataId/docType` 并非所有动作流的固定字段；以配置页导出参数为准。
- 原文示例把两个业务字段及 `moduleSource` 标作可选，不代表现场业务规则不需要它们。
- 单条结构化 API 记录的请求/响应参数表为空；不能仅凭其 `active` 状态生成完整接口实现，也不能编造 `code=200` 等成功判断。

## 三、SDK：引用真实契约，不拼出不存在的调用代码

V2 原文列出的方法为：

```text
com.weaver.esb.api.service.EsbActionFlow#customTriggerEsbFlow(
  com.weaver.esb.api.entity.EventParams, java.lang.String, int
)
```

其说明对应 `params`、`tenantKey`、`timeout`；`timeout` 单位为秒。`EventParams` 需包含 `esbFlowId`、`employeeId`、`source`、`customParams`。注意 HTTP 的 `moduleSource` 与 SDK 的 `source` 字段名不同，不要直接把 HTTP JSON 当作 Java 对象契约。

原文未提供返回类型和完整对象构建代码，且对 SDK 的 `customParams` 使用了“上述步骤0中准备的触发参数”的描述，无法仅凭这一句话断定应嵌入整包还是业务参数对象。实现前读取现场 `EventParams`/方法签名或同环境已验证用例；未确认时保留这一待办，不创造 setter、返回类型或双层嵌套。

原文还说明 ecode 使用 SDK 需要对应 JAR。是否可上传、上传哪一版和依赖如何满足均属于环境变更，不能由本知识页直接授权执行。

## 四、动作流迁移：不要优先沿用旧唯一值方案

V2 原文已把 `uniqueIndent` 触发方式标为不推荐，并说明 ecode 代码中写死的动作流 ID 参数已支持在迁入迁出过程中替换，推荐使用 `esbFlowId`。但这项迁移能力没有单独最低基线，具体版本、支持位置及替换结果仍须在目标环境核实；不能据此承诺所有旧版本、普通 Java 工程或任意 JavaScript 都会自动替换。

旧方案以动作流唯一值取代 ID。原文指出，同一租户多次迁入或复制可能出现相同唯一值，此时只执行创建时间最新的动作流。因此存量系统使用 `uniqueIndent` 时，应先定位实际命中对象；不要未经评估就机械改为 ID，也不要把“唯一值”当成绝对唯一的业务保障。

## 五、首轮验证清单

1. 明确租户、人员、动作流ID、触发方式和测试环境；取得操作授权。本文不授权触发生产动作流。
2. 对照配置页核实输入/输出字段，留存脱敏参数；确认是否会新增业务记录或调用外部系统。
3. 若采用 SDK，核实 JAR、方法签名、租户与人员上下文及 MQ；若采用 HTTP，核实当前会话与权限要求。
4. 先用可识别的测试记录做一次受控调用，核对动作流日志、业务落库和实际返回值。
5. 超时或空响应先查执行结果，未确认幂等性前不自动重试；迁移后核对ID替换与实际目标，而不是只看请求成功。

第5项是部门交付安全建议，不是原文承诺的接口行为。验收证据应留在对应项目，不能回写为“所有 E10 环境已验证”。

## 来源与关联

- 维护知识库源稿的 `source_path` 指向归档 V2 正文，其中有配置截图引用；`source_docs` 中的 API 记录用于补充 HTTP 最低基线与元数据，不能取代 V2 参数说明。接收方按正文标题或接口符号在 library 定位，不依赖这些维护字段或假定远程图片已离线。
- [原文来源链接](https://weapp.eteams.cn/build/techdoc/wdoc/index.html#/public/doc/c1e03018-adaf-4004-9098-eb61a1fe4beb)：本次按随包快照整理，没有据此声称在线版本与快照完全一致。
- E10工具包1.3.4知识覆盖与补充清单（来源资料，需在 library 按标题检索）：查看本批资料覆盖、重叠和待补项。
- E10应用建模JS-SDK文档（来源资料，需在 library 按标题检索）：页面侧动作的关联入口；不要把该 SDK 的调用形式直接替代本文后端契约。
