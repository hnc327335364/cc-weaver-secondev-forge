// 离线演练：从总部条件汇总例抽取的现有业务模块，不是客户工程。
export function mountTotals(formSdk, sdk, onInvalid) {
  const category = formSdk.convertFieldNameToId('category');
  const total = formSdk.convertFieldNameToId('total');
  const detail = formSdk.convertFieldNameToId('items', 'main', true);
  const rowCategory = formSdk.convertFieldNameToId('category');
  const amount = formSdk.convertFieldNameToId('amount');
  const categories = { travel: 'trip', equipment: 'device' };
  function calculate() {
    const selected = categories[formSdk.getFieldValue(category)];
    let sum = 0;
    for (const row of formSdk.getDetailAllRowIndexStr(detail).split(',')) {
      if (row && formSdk.getFieldValue(`${rowCategory}_${row}`) === selected) {
        sum += parseInt(formSdk.getFieldValue(`${amount}_${row}`) || 0);
      }
    }
    formSdk.changeFieldValue(total, { value: sum });
  }
  formSdk.bindFieldChangeEvent(category, calculate);
  formSdk.bindFieldChangeEvent(`${rowCategory},${amount}`, calculate);
}
