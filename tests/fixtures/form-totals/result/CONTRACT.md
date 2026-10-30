# 离线开发演练的输入合同

这是模拟E10 PC表单适配层的小型项目，不是客户环境；以下仅为本题已给定的对象契约，不能用它证明真实E10所有版本支持。根文件中的错误代码源于总部条件汇总案例的计算/绑定模式，已用合成字段与数据替换。只改本目录，不接触原知识或总部源码。

## 入口和对象

- `mountTotals(formSdk, sdk, onInvalid)` 在当前目标表单数据已加载后被调用；目标筛选已在上游完成。本模块不负责Title覆盖、轮询、寻找全局实例或SDK初始化。
- 页面重绘可能再次传入同一个formSdk对象；关闭重开则传入新的对象。同页可存在两个独立formSdk。
- `onInvalid(message)` 是本项目提供的提示回调，不是平台方法；调用时只给简短的错误说明，不输出原始数据。
- `convertFieldNameToId(dataKey)` 定位主表字段，`convertFieldNameToId('items','main',true)` 定位明细容器；明细列通过 `convertFieldNameToId(dataKey, detailMark)` 定位，不能省明细容器。实际字段ID不固定。
- `getDetailAllRowIndexStr(detailMark)` 返回逗号分隔的行标识，如 `r2,r9`，空表为 `''`；行标识不是连续数组下标。
- `getFieldValue(mark)` 返回字段字符串。单元格mark为 `列字段ID_行标识`。
- `changeFieldValue(mark,{value})` 写字段；写total不会改变输入字段。
- `bindFieldChangeEvent(commaSeparatedMarks, callback)` 仅监听主字段；`bindDetailFieldChangeEvent(commaSeparatedColumnMarks,callback)` 监听指定明细列的所有行。回调参数可不使用。
- `registerAction(type,callback)` 注册数据完成变更后的回调。明细新增与删除类型分别是 `sdk.ACTION_ADDROW + detailMark`、`sdk.ACTION_DELROW + detailMark`。本题不提供解除绑定方法，不得猜一个。

## 已确定业务

- 主表category为travel时汇总明细category=trip；equipment对应device；其他选择或空值时总计0.00。
- 金额为字符串、单位元；正负整数、1位或2位小数有效，允许前后空格；空金额按0。不会超过1000行，每笔绝对值不超过1000000元。不使用千分位、货币符号或科学计数法；出现其他格式或超过2位小数视为错误，不静默截断或四舍五入。
- 总计写入两位小数字符串，不能出现浮点尾差。只校验参与本次汇总的行；其他类别的非法金额不影响当前汇总。
- 参与汇总的金额非法时，清空total并调用onInvalid，不能把错误当0或留下旧的可用总计；修正后恢复正常计算。
- 首次打开既有明细、主分类变更、明细分类/金额变更、增删行完成后均需更新。不得删除或修改明细，不影响其他表单。
- 重复挂载同一对象不得重复绑定；新对象必须正常初始化和绑定。

## 交付要求

只修改entry.mjs，可以在此目录增加必要的本地测试与简短交付说明。不安装依赖；可使用Node内置能力做静态或模拟检查。说明每项实际验证与仍待真实PC/客户SDK确认的边界，不声称平台验收通过。
