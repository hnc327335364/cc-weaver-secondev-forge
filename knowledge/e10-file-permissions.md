---
title: "E10文件ID与文档ID及附件权限专题"
platform: "E10"
status: internal-trial
source_record: "e10-file-permissions"
source_manifest: manifest.json
---
# E10文件ID与文档ID及附件权限专题

> 随包解释卡，供内部试用。通用正文、API、案例与已有本地附件先查 [资料导航](../library/catalog.md)，按标题或符号检索后使用 document_id 读取；不依赖维护者电脑路径。本页的核读日期、数量与行号描述当时的整理范围，不代表当前整库验收。详细维护记录不随包，客户工程与现场配置另行提供；知识卡指纹见 [manifest.json](manifest.json)。

文件存在、能查到文件信息、有对应文档、当前人能下载，是四件不同的事。先确认输入 ID 的来源和目标操作，再选接口；不能把“找不到文档”直接判断成“文件丢失”。

本页补充 文件上传上传下载SDK（来源资料，需在 library 按标题检索） 未展开的 **ID 关系、文档查询和权限链路**，不重复收录上传下载全量接口，也不替代现场接口合同。来源为e-code 工具包 **1.3.4** 的只读快照，其中 ID 选型卡标题仍为 **1.3.3**；这些是资料版本，均不是客户 E10 基线。未执行工具包脚本、未访问客户系统，远程截图也未随本次整理验证。

## 1. 先把 ID 对准

| 标识 | 来源和用途 | 不能据此推断 |
|---|---|---|
| 文件/附件 ID | 文件服务对象 `fileobj.id`；文件上传结果、附件字段等是取值候选，仍要核对字段实际存储格式。用于附件元数据或文件内容查询。 | 不能直接当作 `document.id`；字段里的显示名、浏览器临时标识也不能未经确认就当文件 ID。 |
| 文档 ID | 知识管理对象 `document.id`；用于查文档信息、文档附件集合。 | 文档 ID 与文件 ID 即使类型都为 Long，也不是同一种 ID。 |
| 业务关联 ID `refId` | 上传时由业务模块传入，含义取决于 `module`；例如业务记录与附件建立关联。 | 不能无条件把 `refId` 当文档 ID；只有经原文确认的 `module=document` 关系适用。 |
| 字段 ID `fieldId` | 附件所在表单区域字段的标识，可参与鉴权上下文。 | 不是文件 ID，也不是业务记录 ID。 |

文件与文档的三种关联，来自来源 A 的“2、文件和文档如何进行关联的”：

| 场景 | 原文给出的关联 | 开发判断 |
|---|---|---|
| 上传文件并生成文档 | `fileobj.doc_id → document.id`；`document.DOC_FILE → fileobj.id` | 这是一种关联场景，不代表所有上传都会生成文档。 |
| 已有文档内再上传附件 | 文件的 `module=document`，`ref_id → document.id` | 通过业务关联定位文档，不能仅凭 `ref_id` 有值便认定。 |
| Office 文档正文 | `document.content → fileobj.id`；该正文文件的 `fileobj` 不记录文档 ID | 不能仅靠文件侧的 `doc_id/ref_id` 反查全部正文文档。普通附件查询也不能承诺包含正文。 |

这些是关系解释，不是授权直接查询或改写数据库。无关联文档不等于文件不存在；处理现有文件时也不能通过“补建文档”或改关联字段来试错。

## 2. 按目标选查询，不按相似名称猜接口

| 目标 | 已核对的原文入口 | 输入/返回与限制 |
|---|---|---|
| 取单个附件信息 | 来源 B §1.2：`FileClientService.getById` / `getByIdParam` | 输入附件 ID，返回 `FileObj` 元数据；不是文件字节。带参数版本接受 `FileInfoParam`，人员、租户和渲染需求需按实际场景核对。 |
| 取附件内容 | 来源 C §3：`FileDownloadService.downloadFile(Long fileId)` | 输入附件 ID，返回 `FileData`；`getData()` 取字节，`getInputStream()` 取流，`getFileObj()` 取信息。大文件一次取字节有内存风险；使用流后需关闭输入流和对应资源。 |
| 取某文档的附件集合 | 来源 B §1.2：`getFileByEntity(Long id, EntityType module)` 或 `getFileByEntity(Long id, Long docFileId)` | 第一个参数是**文档 ID**；前者文档模块默认传 `document`，后者第二个参数是文档关联的附件 ID，不是另一份文档 ID。返回 `List<FileObj>`；不要承诺覆盖 Office 正文文件。 |
| 批量取文档所属附件 ID | 来源 B §1.1：`getFileIdByDocId` | 输入文档 ID 集合、租户和人员；返回 `DocWithFileIdDto`，其中 `fileIdList` 是文件 ID 集合。原文没给完整的“每个文档→每个附件”映射契约，不能自行按列表位置配对。 |
| 取文档信息及附件列表 | 来源 F：`DocFileClientService.getDocFile` | 服务 `weaver-doc-service`；参数为文档 ID 集合、`tenantKey`、`getDocument`、`htmlContent`。后两项分别决定是否返回文档实体和 HTML 正文。示例为 `Map<Long, DocumentFileDto>`，但完整响应字段契约缺失且示例损坏，见 §4。 |

不要把 RPC 文档里的 `default … { return new FileObj(); }`、空列表或 `return null` 当作业务实现复制；它们只是原文接口展示。本页没有提供可直接运行的调用代码。

原库已覆盖的 SDK 依赖、上传事务注意事项、流关闭、上传结果封装等继续从 文件上传上传下载SDK（来源资料，需在 library 按标题检索） 读取。工具包来源 C 另写明上传 `RemoteUploadParam.createDoc` 默认 `true`、`createDocContent` 默认 `false`；这是**该上传参数**的说明，不能套到复制文件等其他接口。改变 `createDoc` 会影响文档关联和权限路径，需明确业务要求后再改。

## 3. 附件权限不是“能拿到 ID 就能下载”

以下为来源 D §1–6 的文档规则，不是所有现场版本的已验证行为：

- **已登录且使用默认规则**：业务模块权限和附件对应文档权限取最大权限，不是二者必须同时通过。业务模块返回无权限时，若存在文档，还可能由文档权限放行。
- **没有生成文档**：只取业务模块权限；不能指望文档兜底。原文对未接入权限或返回空的登录场景描述了文档兜底，并说明文档默认只有上传人有权限；实际分享配置仍需现场核查。
- **免登录场景**：只走业务模块鉴权；未接入或返回空时无权限。SDK 中的公共资源等特殊标识不应作为解决普通业务权限故障的捷径。
- **上传**也有权限校验；传了目录 ID 时，业务模块权限后还涉及文档文件夹权限。上传成功不能代替后续预览、下载、编辑、删除各操作的权限验证。

上传的 `module` 决定业务归属，应与现场 `EntityType` 枚举及模块权限实现匹配。来源 D §3 给出的业务侧接入点是 `PermissionExternal.checkFileRight`，返回按 `FileOpType` 区分的权限 Map；人员、业务 ID、租户及可信业务上下文不能从任意客户端参数直接认定。

需要重点审查的变更项：

| 配置/参数 | 原文含义 | 使用边界 |
|---|---|---|
| `authModule` | 可指定鉴权模块；指定模块在鉴权白名单中可能不生效。原文特别说明：文件 `module=document` 时指定其他业务模块，将不再走文档鉴权。 | 是权限路径变更，不是下载失败时随便补一个参数。POST 等请求按接口要求放请求体，不能统一拼 URL。 |
| `documentCheck` / `previewDoc` 等 | 可控制是否继续文档鉴权；原文说明 `documentCheck` 全局优先，并举 `false` 仅走业务模块的例子。 | 不通过关闭校验来“修复”无权限；先确认目标权限模型、实际版本及组合行为。 |
| `customParam` | String，自定义格式，按原样传给模块解析。 | 不等于身份或授权证明；编码不是加密，也不能承载应保密的凭据。不要直接照抄原文示例值。 |
| `source=richText`、`refId`、`fieldId`、`commonText` | 来源 D §9–10 说明富文本附件的来源和业务信息传递。 | 富文本文件同样需要模块鉴权，不能当公开静态资源；预览 `sourceRefId` 是匹配业务来源的参数，不是替代 `fileId`。 |

第三方取文件优先核查来源 E 的 OpenAPI 业务鉴权方案，或有有效期的临时链接方案。临时链接仍需确认授权、有效期和可达域名；不能拼接私有下载地址、沿用他人会话，或把完整签名下载链接写进通用交付物。本页不提供缺少完整参数/响应证据的 OpenAPI 调用模板。

## 4. 版本与响应缺口：不要把不完整来源修成“确定契约”

| 来源 | 可确认的资料结论 | 尚不能确认 / 必须核对 |
|---|---|---|
| 文件关系、RPC、SDK、权限原文 A–D | 有字段关系、接口名称或权限规则。 | 这些章节未给出可核实的最低基线；不能从工具包版本推算 E10 支持版本。RPC 能取到元数据也不证明对外下载已鉴权。 |
| F：`getDocFile` | 记录标注最低基线 `10.0.2307.00`；文档 ID 集合与租户等四个入参明确。 | `responseParams` 为空；示例有乱码、非标准 JSON 格式，调用样例还有重复点号。不能据此生成固定 HTTP `code/data` 封装或判定必有某字段。以现场依赖签名及脱敏实际响应补齐。 |
| G：`checkMainAccessByUpload` | 记录标注最低基线 `10.0.2501.01`；用途是检查文档主附件，示例出现 `isMainAccess`、`mainAccessId`、`canSetMainAccess`。 | 签名和参数表把 `tenantKey` 写为 Long，代码示例却为 String；返回参数描述也不完整。这是**来源冲突**，不能替用户任选类型。该方法不是通用下载授权判断。 |

来源 F/G 的基线只作为资料声明保存，仍需验证客户安装版本和实际依赖。保留原文，未改写冲突源；本页不复制损坏的 Java/JSON 示例，也不携带原例的真实样式 ID、租户值或链接令牌。

## 5. 遇到“找不到文档 / 无法下载”怎么交接

项目人员提供四类材料即可：**目标操作、ID 从哪里取得、同一人员的页面现象、客户 E10 基线**。不要只发一个无来源数字，也不要提供会话 Cookie、密钥或完整临时链接。

开发排查顺序：

1. 核对输入是文件 ID 还是文档 ID，参数名、实际接口和目标是否一致；附件字段如果存 JSON/列表，按该字段真实契约取值。
2. 区分文件记录、文件内容和文档关联；Office 正文按其关联单独确认，不把普通附件查询的空结果扩大成“文件不存在”。
3. 核对租户、当前人员、`module`、`refId`、是否生成文档及所需操作权限；不要靠管理员账号成功推断普通账号有权限。
4. 来源 D §7 提供鉴权诊断项：`currentEmployeeId`、`moduleId`、`group`、`checkFileRightError`、`result`；下载接口可按其原文使用 `type=downloadUrl` 查看鉴权信息。仅在授权测试环境验证接口是否支持，不自行构造不存在的错误码。
5. 获取脱敏后的真实返回/异常；分别确认元数据、实际内容、普通用户权限与无权限拒绝结果。需要第三方下载时，再测有效期及接收方网络可达性。未执行的项目写“待现场验证”。

## 6. 来源定位与本次核对

下面路径均相对于库内只读快照目录：

`01-AI-Resources AI资料整理/04-Agents Agent规则/99-SourceFiles 原始资料/e-code智能化开发工具包/1.3.4/skills/e10-local-knowledge/modules/`

| 编号 | 相对原文 | 本页采用的章节 |
|---|---|---|
| A | `e10-file-service-docs/references/docs/linked/文件和文档的关系.md` | §2 三种关联；两个 §3 的文档/文件反查说明及“正文附件获取不到”限制 |
| B | `e10-file-service-docs/references/docs/linked/文件RPC接口.md` | §1.1 文档ID批量转附件ID；§1.2 文件信息及 `FileInfoParam` |
| C | `e10-file-service-docs/references/docs/linked/文件服务SDK能力.md` | §2 上传参数，§3 下载和 §3.1 `FileData` |
| D | `e10-file-service-docs/references/docs/linked/文件服务权限.md` | §1–3 权限模型与接入；§4–6 控制参数；§7 诊断；§8–10 参数透传与富文本 |
| E | `e10-file-service-docs/references/docs/linked/文件服务下载链接获取场景.md` | §1 提供下载链接给第三方：OpenAPI 与 ESB 临时链接 |
| F | `e10-knowledge-docs/references/api-records/knowledge-dubbo-getdocfile-055.json` | `minimumBaseline`、`details.params`、`details.responseParams`、`details.responseExample`、`details.codeExample` |
| G | `e10-knowledge-docs/references/api-records/knowledge-dubbo-checkmainaccessbyupload-127.json` | `methodSignature`、`minimumBaseline`、`details.params`、`details.requestExample`、`details.responseExample` |

检索导航另参考 `e10-file-service-docs/references/file-id-vs-document-id.md`。2026-10-21 静态核对范围：上述原文、既有上传下载 SDK 页和来源记录；**不包含**现场编译、实际文件下载、权限配置或客户验收。
