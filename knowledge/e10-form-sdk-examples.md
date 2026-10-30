---
title: "E10表单SDK实例与字段操作示例补充"
platform: "E10"
status: internal-trial
source_record: "e10-form-sdk-examples"
source_manifest: manifest.json
---
# E10表单SDK实例与字段操作示例补充

> 随包解释卡，供内部试用。通用正文、API、案例与已有本地附件先查 [资料导航](../library/catalog.md)，按标题或符号检索后使用 document_id 读取；不依赖维护者电脑路径。本页的核读日期、数量与行号描述当时的整理范围，不代表当前整库验收。详细维护记录不随包，客户工程与现场配置另行提供；知识卡指纹见 [manifest.json](manifest.json)。

**本页补“怎么调用”，不替换完整参数手册。** 8 张卡将 E10表单引擎JSSDK文档（来源资料，需在 library 按标题检索） 的参数正文与工具包代码合在一起；每张卡保留原章节号、双源行号和修正说明。原稿、工具包快照均未修改。

这里的代码是**部门整理的独立教学片段，不是原样摘录，也不是粘贴即运行的客户脚本**：函数只声明、不自动调用，参数由项目提供；没有虚构客户字段、表单 ID、返回数据或挂载位置。片段不负责初始化、重复注册清理、业务校验和发布。运行前必须确认 E10 基线、页面入口、当前表单实例和实际字段类型。E9 的 `specialobj` 不适用本页的 E10 `specialObj`。

## 来源定位及使用范围

- **L**：本库 `E10表单引擎JSSDK文档.md`，整理日期 2026-07-14，SHA-256：`4c4190f5384710272f26303c71b8247afd7fe522bf833b5ae505a175594f8ee7`。
- **H**：工具包归档 `e10-form-jsapi/references/form-jsapi.md`，同步日期 2026-06-24，SHA-256：`3200172e8ab1349f5cc1e929a21d06d390ee5cf65f952c5bee15c7785d769391`。完整库内路径由维护知识库源稿的 `source_docs` 保留；接收方按上述路径片段在 library 检索。
- 本页行号均为**对应完整文件的 1 起始行号**，不是提取后正文偏移。逐段 SHA-256、子文档 ID 及检查范围在 来源核对数据（来源记录，未随包）。若来源哈希改变，应重新核对，而不是沿用旧行号。
- 工具包 `1.3.4` 是工具包版本，不是 E10 产品基线；下文 `240601` 等写法照来源保留，不自行扩展成完整版本号。

| 卡片 | 原章节 / 子文档 ID | L 参数/说明行 | H 参数及示例行 |
|---|---|---|---|
| F01 实例与加载 | §1.1 `253276494820802560`；§1.2 `253276566593732608`；§1.3 `253276611208544256` | 63–98；1522–1533；1553–1557 | 114–184；2329–2350 |
| F02 字段定位与行读取 | §3.1 `253277224944271360`；§3.2 `253277251066396672`；§5.7 `253278239085035520` | 169–192；262–279；993–1009 | 350–425；1320–1343 |
| F03 浏览显示对象读取 | §3.12 `253277557728739328` | 235–260 | 821–864 |
| F04 文本、固定选项、日期赋值 | §3.3 `253277288206958592` | 281–325 | 429–521 |
| F05 浏览赋值/清空及附件边界 | 同 §3.3 | 290–317 | 437–464；495–509 |
| F06 保存前拦截 | §2.1 `253277078751805440` | 102–132 | 188–261 |
| F07 保存/联动后钩子 | §2.2 `253277096900558848` | 134–165 | 265–346 |
| F08 主表/明细值变化事件 | §4.1 `253277643862966272`；§4.2 `253277686913302528` | 450–517 | 868–986 |

## F01｜先确认实例归属，再选加载方式

**解决问题**：同页打开多个表单、弹窗后写错表单，以及把旧 `formReady` 模板套到所有入口。

两方 §1.1 都写：`250101` 及之后的**表单设计器源码、表单设置→自定义 e-code** 可用入口提供的闭包 `formSdk`；不是所有 Ecode 入口都自动有这个变量。历史/其他入口的 `getWeFormInstance` 有 4 个隔离粒度：无参数取顶层活动表单；依次加 `moduleKey`、`formId`、`dataId` 后进一步隔离。多表单时优先使用已经确认的较细上下文。

部门片段（据 H 136–144 行，仅封装参数，不创建 ID 或补全加载时机）：

```javascript
function locateConfirmedForm(moduleKey, formId, dataId) {
  return window.WeFormSDK.getWeFormInstance(moduleKey, formId, dataId);
}
```

此函数要求三个参数均由现场上下文确认；若入口只提供较粗上下文，应按原文选择对应的 0/1/2 参数形式，不向这里传“猜测 ID”。若已得到闭包 `formSdk`，直接使用该实例，不再调用上述函数替换它。

生命周期必须分开看：

| 入口/目的 | 来源声明 | 不应推导的结论 |
|---|---|---|
| 表单布局插入代码，旧加载方式 | H 157–162 行通过 `pageSdk.on('formReady', callback)`；L §1.2 写 `250101` 后直接使用 `formSdk` 时无需再绑定 | 不给所有入口强制加 `formReady`，也不认为所有入口都有 `pageSdk`。 |
| 全局观察每次打开的表单 | H 166–184、L §1.3：`window` 的 `onFormReady`，最低 `240601`；明确**不要放在表单源码** | 不把全局监听当当前单表单初始化器；示例的表单 ID 不可充当客户 ID。 |
| 同一包的“变更内容” | H 2333–2350 将内置 `formSdk` 变化写为 `241201`，但 §1.1 和本库写 `250101` | **来源冲突**，不能按较早数字直接承诺兼容。L 常见问题仍有旧加载建议（1555 行），也不能脱离入口使用。 |

## F02｜先定位主表/明细列，再拼真实行 ID

**解决问题**：字段 dataKey 同名时取错列、把显示行下标当行 ID、拿浏览显示名当存储值。

- `convertFieldNameToId(fieldName, symbol?, prefix?)`：主表字段显式传 `"main"`；明细表标识的转换按 §3.1 原例使用单参数；明细列必须传已转换的 `detailMark`，避免同名字段。第三参数默认为 `true`，表示含 `field` 前缀。
- 源签名把 `symbol` 写可选，参数表却标“是”；本页采用显式位置，不把“不传也能跑”当定位可靠性证据。
- 将**明细表 dataKey 直接作为第二参数**的能力，参数表标注 `260601`；下例先取明细表标识，不使用此新简写。
- `getFieldValue` 的主表参数是字段标识；明细是 `` `${列字段标识}_${真实行ID}` ``。选项通常返回选项 ID，显示对象看 F03。源签名返回 `any`、文字写 `string`，不要未确认就强制当数字/对象。

部门片段（据 H 375–424 行；补显式主表定位，行 ID 改由调用方传入，避免空明细强取第一行）：

```javascript
function readFormValues(formSdk, mainDataKey, detailDataKey, columnDataKey, rowId) {
  const mainMark = formSdk.convertFieldNameToId(mainDataKey, "main", true);
  const detailMark = formSdk.convertFieldNameToId(detailDataKey);
  const columnMark = formSdk.convertFieldNameToId(columnDataKey, detailMark, true);
  return {
    mainValue: formSdk.getFieldValue(mainMark),
    detailValue: formSdk.getFieldValue(`${columnMark}_${rowId}`),
  };
}
```

`rowId` 必须来自当前明细的已有行或已确认事件数据；不能为空，也不是 `0/1/2` 显示下标。若确实要按显示位置取行，§5.7 明确 `getDetailRowIdByIndex(detailMark, rowIndex)` 的下标**从 1 开始**（L 1005、H 1331），先确认该行存在。这个规则不应推广到其他 API 的行下标。

## F03｜读取浏览名称与完整字段对象

**解决问题**：`getFieldValue` 只拿到 ID，误把它当人员名/附件对象。

§3.12 `getFieldObj(fieldMark)` 返回字段数据对象；来源最低基线 `240701`。`value` 是文本值，`specialObj` 是浏览项数组；地理位置有 `longitude/latitude`；`type/contentObj` 的标注为 `241201`。这些键并不保证在所有字段上都存在。

部门片段（H 849–863 的最小归纳，调用方先按 F02 得到主表或明细行完整标识）：

```javascript
function readConfirmedFieldObject(formSdk, fieldMark) {
  return formSdk.getFieldObj(fieldMark);
}
```

读取后按实际字段类型检查 `specialObj` 中的 `id/name/data`，不要假设一定只有一项，也不要把名称反查成 ID。H 857 行原例获取明细列时没传位置；复用时改按 F02 显式限定明细表。本页不复制客户对象，也不输出完整字段对象到生产日志。

## F04｜文本、固定选项、日期赋值：纠正原例变量

**解决问题**：有赋值 API，但复制原例后报重复声明、写错字段或把选项模板当固定选项。

§3.3：文本等一般字段传 `{value: ...}`；**仅固定选项**可以用 `value` 传真实选项 ID。选项模板/浏览按 F05 传 `specialObj`。日期示例展示的是字符串，实际日期字段/区间格式须核对；本页不臆定任意日期都可接受。

部门片段（H 475–493 的变量修正版；字段标识及值由调用方确认，三个调用并非要求一次全部执行）：

```javascript
function assignText(formSdk, textFieldMark, confirmedText) {
  formSdk.changeFieldValue(textFieldMark, { value: confirmedText });
}

function assignFixedOption(formSdk, optionFieldMark, confirmedOptionId) {
  formSdk.changeFieldValue(optionFieldMark, { value: confirmedOptionId });
}

function assignDate(formSdk, dateFieldMark, confirmedDateText) {
  formSdk.changeFieldValue(dateFieldMark, { value: confirmedDateText });
}
```

**与工具包原例的差异，不能隐去**：

| H 行号 | 原例问题 | 本页处理 |
|---|---|---|
| 476–479 | 声明 `textFieldMark`，却调用未在该段声明的 `fieldMark` | 文本函数使用其 `textFieldMark` 参数。 |
| 483、488 | 同一个围栏、同一作用域两次 `const selectFieldMark` | 拆为独立教学函数，不把几种选项场景并排声明成同名常量；原围栏整体会语法失败。 |
| 492–493 | 声明 `dateFieldMark`，却给 `selectFieldMark` 赋日期 | 日期函数使用 `dateFieldMark`。 |
| 433、443、479 | 展示签名只有两个参数，但参数表/示例有第三个 `config` | 记录契约不一致；默认片段不改变联动开关。 |

需要控制联动时，参数表 `config` 最低 `241001`，可包含 `dataLinkage/viewLinkage/optionLinkage/dataValidate/jsApiChange`；`false` 不执行、`true` 执行、不传按系统。**第三参数和基线须现场确认后再用**。不要为了消除回调循环默认关闭所有联动或校验。

## F05｜浏览赋值、清空与附件不是同一数据结构

**解决问题**：把浏览仅赋 ID、把附件 `data:{}` 当完整可用附件、混用人员范围和普通浏览。

部门片段（H 495–509 的最小归纳；`confirmedItems` 必须是该字段已确认的合法项）：

```javascript
function assignBrowserItems(formSdk, browserFieldMark, confirmedItems) {
  formSdk.changeFieldValue(browserFieldMark, { specialObj: confirmedItems });
}

function clearBrowserItems(formSdk, browserFieldMark) {
  formSdk.changeFieldValue(browserFieldMark, { specialObj: [] });
}
```

| 字段类型 | 来源给出的数据形状 | 本页可复用与不能补猜的部分 |
|---|---|---|
| 普通浏览/选项 | `specialObj` 数组项有 `id`、`name` | 使用真实选项 ID 和匹配名称，不能只传显示名；多选保留数组。 |
| 自定义浏览 | 项可有 `data.linkUrl/appLinkUrl` 等；需符合 BCW 配置 | 链接/数据对象以实际字段配置为准，不能复制来源或客户链接充数。 |
| 人员范围选择 | 项有 `type`，枚举 `user/dept/subcompany/organization/group/role/position/all` | 与普通人员浏览区分；来源说明表单 JS 没有提供类型判定方式，不能按 ID 形状猜 `type`。 |
| 附件 | 项有 `id/name/data`，`data` 是附件模块对象，涉及权限与操作按钮 | H 500 行的 `data:{}` 是未展开的教学占位，**不是完整附件契约**；先核对 [E10文件ID与文档ID及附件权限专题](e10-file-permissions.md) 及现场真实合法对象。 |

清空只针对当前已确认字段；不得为了“修复显示”自动创建文档、复制他人附件对象或关闭附件权限。前端赋值也不是后端保存成功或有权访问附件的证明。

## F06｜保存前拦截要显式放行或失败

**解决问题**：注册后表单卡住，或把表单保存拦截误当流程提交、后台权限校验。

§2.1 `registerCheckEvent` 支持按注册顺序多次执行；回调必须按结果调用 `successFn` 或 `failFn`。`OPER_SAVE` 针对**表单数据保存**；流程提交和模块按钮使用对应模块 SDK，不从这个名字推导流程事务时机。

部门片段（H 223–227 改成传入已确认的**同步布尔校验**，移除原例“非移动端禁止提交”的演示业务）：

```javascript
function registerConfirmedSaveCheck(formSdk, validateCurrentForm) {
  formSdk.registerCheckEvent(window.WeFormSDK.OPER_SAVE, (successFn, failFn) => {
    if (validateCurrentForm() === true) {
      successFn();
    } else {
      failFn({ msg: "当前表单校验未通过，请检查已标明的输入项" });
    }
  });
}
```

`validateCurrentForm` 是项目提供的同步函数，必须返回布尔值且自行处理异常；本片段**不是异步请求模板**。若要异步校验，须另设计超时/异常/当前输入变动的结算逻辑，不能把 Promise 当真值直接放行。注册函数由已确认入口调用一次；没有证据的通用卸载/覆盖 API 不在此虚构。前端拦截不替代后端权限与数据一致性检查。

## F07｜保存后、数据联动后、数据钻取后分别处理

**解决问题**：把不同“后置事件”当一个事件，或在普通回调里错读 `runData`。

§2.2 `registerAction(type, callback)` 是动作完成后钩子；表单保存后为 `ACTION_FORM_SAVE`。顶部字段联动/函数公式为 `ACTION_DATA_LINKAGE`；字段上的函数、关联取数和运算控件对应 `ACTION_DATA_RELATE`。不能把后者随意改名为前者。

部门片段（保留 H 315–319 的调用形状，转为项目提供的处理函数；不解释未声明的回调对象字段）：

```javascript
function registerAfterFormSave(formSdk, handleSaveEvent) {
  formSdk.registerAction(window.WeFormSDK.ACTION_FORM_SAVE, handleSaveEvent);
}
```

数据联动后示例在 H 322–329 读取 `data.runData` 的 `actionType/resultFields/triggerFields/triggerRowIds`，其注释标注 `runData` 不低于 `240601`，且仅支持这些列出属性；数据钻取后的 H 333–338 读取 `arg.fieldIds/rowIds/tableId`。两种结构不要交叉套用。`ACTION_FORM_SAVE` 的 `arg` 未有本页可确认的完整返回结构，不宣称包含请求 ID、成功码或数据库结果。

另一个原例问题：H 301 使用 `weFormSdk.convertFieldNameToId`，后续却使用 `formSdk.registerAction`，该代码块未定义 `weFormSdk`。若复用明细新增/删除钩子，统一为已经确认的同一表单实例；H 注释还把 `rowIds` 描述为从 0 开始下标，不能据变量名直接认作 F02 的行 ID，需要现场核对回调。

## F08｜主表与明细值变化：先默认范围，再考虑联动

**解决问题**：新明细行不触发、只监听到用户改值、联动回写重复触发形成循环。

- §4.1 文字说明：文本值变化在失焦时触发，选项在选择后触发；字段联动带出的变化**默认不触发**。
- §4.1 的展示签名写 `(id?, value?)`，但参数表和 H 910–926 例子用单个 `data`，读 `data.id/data.value`。本页按**参数表＋例子**记录；现场须先验证回调结构，不能混用 E9 回调约定。
- §4.2 明细事件覆盖已有行和之后新增行。H 968–969 用到 `detailMark` 却未在该段定义；本页先显式转换，不从别的代码块继承变量。

部门片段（从 H 907–926、968–985 归纳；未启用全局联动开关，不包含业务回写）：

```javascript
function registerMainValueChange(formSdk, dataKey, handleChange) {
  const fieldMark = formSdk.convertFieldNameToId(dataKey, "main", true);
  formSdk.bindFieldChangeEvent(fieldMark, handleChange);
}

function registerDetailValueChange(formSdk, detailDataKey, columnDataKey, handleChange) {
  const detailMark = formSdk.convertFieldNameToId(detailDataKey);
  const columnMark = formSdk.convertFieldNameToId(columnDataKey, detailMark, true);
  formSdk.bindDetailFieldChangeEvent(columnMark, handleChange);
}
```

`handleChange` 由项目提供；默认应观察实际回调形状后再处理，而不是本页替客户写业务。H 的明细例子额外使用 `data.rowId`，参数表只写 `id/value`，需在具体基线核对，不能当所有事件统一保证字段。监听“值变化”不等于新增/删除行事件，也不等于首屏已有数据已自动计算。

| 能力 | 来源标注 | 采用限制 |
|---|---|---|
| §4.1 `ext.scope = window.WeFormSDK.CHANGE_EVENT_SCOPE` | 至少 `250401` | 仅值变化，不含新增/删除明细行；确认会不会回写自身并形成循环。 |
| §4.2 相同 `ext.scope` | 不低于 `250901` | 不把主表事件的较早基线推广给明细 API。 |
| `window.__FORM_JS_LINKAGE_EVENT_CHANGE__ = true`、`CHANGE_EVENT_LINKAGE` | `251101` | 全局开关，来源要求事件绑定前设置；会扩大影响，不能作为单字段问题的默认修复。 |
| 明细增删联动事件 | §2.2 另有 `251101` 全局开启说明 | 不能用值变化订阅代替行结构变化处理。 |

多字段串联使用逗号；明细字段与行 ID 使用下划线。表单可能重复挂载、打开或注册；本页不声称上述函数幂等，集成前复用当前项目的实例生命周期管理，避免重复调用注册函数。

## 本次验证与接收方最小复核

2026-10-21 执行 `scripts/check_e10_form_example_cards.py`：核对双源文件指纹及 8 张卡引用的原文片段指纹；独立解析本页的 8 个 JavaScript 围栏，逐块做 Node 语法检查。此检查不执行 SDK、不注册事件、不访问客户网络，也不能证明所选挂载位置或产品版本兼容。来源 H §3.3 整个原代码块另做负向语法检查，确认为重复 `selectFieldMark` 声明导致失败，未修改原件。

接收方针对真实需求至少确认：

1. 当前入口/基线支持的实例获取方式；同页同时开两张表单时不会取错实例。
2. 主表与明细存在相同 dataKey 时，显式位置仍选中目标；空明细不强取第一行，排序后不混用下标和行 ID。
3. 固定选项、选项模板、普通浏览、附件分别按真实结构取值/赋值；名称显示正常不等于已经持久化。
4. 保存前校验的通过、失败与异常路径；流程提交仍走其真实 SDK 时机，不以本页保存事件替代。
5. 已有明细、新增明细、删除明细、用户修改、联动修改、重新打开页面分别检查；无重复注册、遗漏和循环。

**尚未执行**：真实 E10/浏览器/移动端运行、客户字段联调、前端打包或生产验收。本页属于来源核对后的知识增量，而非已经交付的客户功能。
