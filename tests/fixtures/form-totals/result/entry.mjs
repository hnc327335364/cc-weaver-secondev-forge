// 离线演练：从总部条件汇总例抽取的现有业务模块，不是客户工程。
const mountedForms = new WeakMap();

// 按整数分计算；格式不合法时返回 null，不截断小数或吞掉错误。
function parseCents(value) {
  const text = value.trim();
  if (!text) return 0;
  if (!/^[+-]?\d+(?:\.\d{1,2})?$/.test(text)) return null;
  const negative = text.startsWith('-');
  const [whole, fraction = ''] = text.replace(/^[+-]/, '').split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return negative ? -cents : cents;
}

function formatCents(cents) {
  const absolute = Math.abs(cents);
  return `${cents < 0 ? '-' : ''}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, '0')}`;
}

export function mountTotals(formSdk, sdk, onInvalid) {
  const mounted = mountedForms.get(formSdk);
  if (mounted) {
    // 重绘只刷新提示回调与总计，不重复订阅；不同实例各自管理。
    mounted.onInvalid = onInvalid;
    mounted.calculate();
    return;
  }

  const category = formSdk.convertFieldNameToId('category');
  const total = formSdk.convertFieldNameToId('total');
  const detail = formSdk.convertFieldNameToId('items', 'main', true);
  const rowCategory = formSdk.convertFieldNameToId('category', detail);
  const amount = formSdk.convertFieldNameToId('amount', detail);
  const state = { onInvalid, calculate };

  function calculate() {
    const mainCategory = formSdk.getFieldValue(category);
    const selected = mainCategory === 'travel' ? 'trip'
      : mainCategory === 'equipment' ? 'device' : null;
    let sum = 0;

    if (selected) {
      for (const row of formSdk.getDetailAllRowIndexStr(detail).split(',')) {
        if (row && formSdk.getFieldValue(`${rowCategory}_${row}`) === selected) {
          const cents = parseCents(formSdk.getFieldValue(`${amount}_${row}`));
          if (cents === null) {
            formSdk.changeFieldValue(total, { value: '' });
            state.onInvalid('参与汇总的金额格式不正确，请填写最多两位小数的金额。');
            return;
          }
          sum += cents;
        }
      }
    }
    formSdk.changeFieldValue(total, { value: formatCents(sum) });
  }

  formSdk.bindFieldChangeEvent(category, calculate);
  formSdk.bindDetailFieldChangeEvent(`${rowCategory},${amount}`, calculate);
  formSdk.registerAction(sdk.ACTION_ADDROW + detail, calculate);
  formSdk.registerAction(sdk.ACTION_DELROW + detail, calculate);
  mountedForms.set(formSdk, state);
  calculate();
}
