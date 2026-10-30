import test from 'node:test';
import assert from 'node:assert/strict';
import { mountTotals } from './entry.mjs';

const sdk = { ACTION_ADDROW: 'add:', ACTION_DELROW: 'delete:' };

// 只模拟 CONTRACT.md 提供的适配层；字段 ID 故意与业务名不同。
function createForm(category = 'travel', rows = [], prefix = 'formA') {
  const ids = {
    category: `${prefix}-main-category`, total: `${prefix}-main-total`,
    detail: `${prefix}-detail-items`,
    rowCategory: `${prefix}-column-category`, amount: `${prefix}-column-amount`,
  };
  const values = new Map([[ids.category, category], [ids.total, 'old-total']]);
  const rowIds = [];
  const writes = [];
  const mainBindings = [];
  const detailBindings = [];
  const actions = [];
  const errors = [];
  function putRow(id, rowCategory, amount) {
    rowIds.push(id);
    values.set(`${ids.rowCategory}_${id}`, rowCategory);
    values.set(`${ids.amount}_${id}`, amount);
  }
  for (const row of rows) putRow(...row);
  const formSdk = {
    convertFieldNameToId(name, detail, isDetail) {
      if (name === 'items') {
        assert.equal(detail, 'main');
        assert.equal(isDetail, true);
        return ids.detail;
      }
      if (detail === ids.detail) {
        assert.ok(['category', 'amount'].includes(name));
        return name === 'category' ? ids.rowCategory : ids.amount;
      }
      assert.equal(detail, undefined);
      assert.ok(['category', 'total'].includes(name), '明细字段定位必须带容器');
      return ids[name];
    },
    getDetailAllRowIndexStr(detail) {
      assert.equal(detail, ids.detail);
      return rowIds.join(',');
    },
    getFieldValue(mark) {
      assert.ok(values.has(mark), `未定义字段 ${mark}`);
      return values.get(mark);
    },
    changeFieldValue(mark, { value }) {
      assert.equal(mark, ids.total, '只允许写入总计');
      assert.equal(typeof value, 'string');
      values.set(mark, value);
      writes.push(value);
    },
    bindFieldChangeEvent(marks, callback) {
      assert.equal(marks, ids.category);
      mainBindings.push({ marks, callback });
    },
    bindDetailFieldChangeEvent(marks, callback) {
      assert.equal(marks, `${ids.rowCategory},${ids.amount}`);
      detailBindings.push({ marks, callback });
    },
    registerAction(type, callback) {
      assert.ok([sdk.ACTION_ADDROW + ids.detail, sdk.ACTION_DELROW + ids.detail].includes(type));
      actions.push({ type, callback });
    },
  };
  return {
    formSdk, ids, values, writes, errors, mainBindings, detailBindings, actions,
    mount(callback = message => errors.push(message)) { mountTotals(formSdk, sdk, callback); },
    total() { return values.get(ids.total); },
    setCategory(value) {
      values.set(ids.category, value);
      for (const binding of mainBindings) binding.callback();
    },
    setCell(id, column, value) {
      values.set(`${ids[column]}_${id}`, value);
      for (const binding of detailBindings) binding.callback();
    },
    addRow(...row) {
      putRow(...row);
      for (const action of actions) if (action.type === sdk.ACTION_ADDROW + ids.detail) action.callback();
    },
    deleteRow(id) {
      rowIds.splice(rowIds.indexOf(id), 1);
      values.delete(`${ids.rowCategory}_${id}`);
      values.delete(`${ids.amount}_${id}`);
      for (const action of actions) if (action.type === sdk.ACTION_DELROW + ids.detail) action.callback();
    },
  };
}

test('开表计算既有非连续行，保留小数、负数、空值且忽略非参与行', () => {
  const form = createForm('travel', [
    ['r2', 'trip', ' 12.34 '], ['r9', 'trip', '-2.3'],
    ['r14', 'trip', ''], ['r21', 'device', '非法金额'],
    ['r32', 'trip', '+0.06'],
  ]);
  const before = new Map(form.values);
  form.mount();
  assert.equal(form.total(), '10.10');
  assert.deepEqual(form.errors, []);
  for (const [mark, value] of before) if (mark !== form.ids.total) assert.equal(form.values.get(mark), value);
});

test('分类切换、明细金额及分类修改均触发汇总', () => {
  const form = createForm('travel', [['r2', 'trip', '1.25'], ['r9', 'device', '2.50']]);
  form.mount();
  form.setCategory('equipment');
  assert.equal(form.total(), '2.50');
  form.setCell('r9', 'amount', '3.75');
  assert.equal(form.total(), '3.75');
  form.setCell('r2', 'rowCategory', 'device');
  assert.equal(form.total(), '5.00');
  for (const category of ['', 'other', 'toString', '__proto__']) {
    form.setCategory(category);
    assert.equal(form.total(), '0.00');
  }
});

test('增删行使用变更后的实际行标识，删空后归零', () => {
  const form = createForm('travel', [['r2', 'trip', '1.11']]);
  form.mount();
  form.addRow('r99', 'trip', '2.22');
  assert.equal(form.total(), '3.33');
  form.deleteRow('r2');
  assert.equal(form.total(), '2.22');
  form.deleteRow('r99');
  assert.equal(form.total(), '0.00');
});

test('非法参与金额清空旧总计并提示，修正后自动恢复', () => {
  const form = createForm('travel', [['r2', 'trip', '7.00'], ['r9', 'trip', '2']]);
  form.mount();
  for (const invalid of ['1.234', '1,000.00', '￥1', '$1', '1e2', 'abc', 'NaN', 'Infinity', '.', '.5', '1.', '--1', '1 2']) {
    const previousErrors = form.errors.length;
    form.setCell('r9', 'amount', invalid);
    assert.equal(form.total(), '', invalid);
    assert.equal(form.errors.length, previousErrors + 1, invalid);
    assert.equal(form.errors.at(-1), '参与汇总的金额格式不正确，请填写最多两位小数的金额。');
    form.setCell('r9', 'amount', '2.01');
    assert.equal(form.total(), '9.01');
  }
});

test('非参与行不校验；切换到其分类后清空并提示', () => {
  const form = createForm('travel', [['r2', 'trip', '0.30'], ['r9', 'device', '9.999']]);
  form.mount();
  assert.equal(form.total(), '0.30');
  assert.equal(form.errors.length, 0);
  form.setCategory('equipment');
  assert.equal(form.total(), '');
  assert.equal(form.errors.length, 1);
  form.setCategory('unknown');
  assert.equal(form.total(), '0.00');
  assert.equal(form.errors.length, 1);
});

test('首次非法、空表与合法金额格式', () => {
  const invalid = createForm('travel', [['r2', 'trip', '4.001']]);
  invalid.mount();
  assert.equal(invalid.total(), '');
  assert.equal(invalid.errors.length, 1);
  const empty = createForm();
  empty.mount();
  assert.equal(empty.total(), '0.00');
  const cases = [['', '0.00'], ['  ', '0.00'], ['0', '0.00'], ['-0.00', '0.00'],
    ['42', '42.00'], ['-42', '-42.00'], ['+42', '42.00'], [' 001.2 ', '1.20'],
    ['-0.01', '-0.01'], ['999999.99', '999999.99'], ['1000000', '1000000.00']];
  for (const [input, expected] of cases) {
    const form = createForm('travel', [['r2', 'trip', input]]);
    form.mount();
    assert.equal(form.total(), expected, input);
  }
});

test('整数分累加消除尾差，并覆盖 1000 行金额上界及抵消', () => {
  const decimal = createForm('travel', [['r2', 'trip', '0.1'], ['r9', 'trip', '0.2']]);
  decimal.mount();
  assert.equal(decimal.total(), '0.30');
  const rows = Array.from({ length: 1000 }, (_, i) => [`row${i * 7}`, 'trip', '1000000']);
  const positive = createForm('travel', rows);
  positive.mount();
  assert.equal(positive.total(), '1000000000.00');
  const negative = createForm('travel', rows.map(([id, category]) => [id, category, '-1000000']));
  negative.mount();
  assert.equal(negative.total(), '-1000000000.00');
  const canceled = createForm('travel', rows.map(([id, category], i) => [id, category, i % 2 ? '-999999.99' : '999999.99']));
  canceled.mount();
  assert.equal(canceled.total(), '0.00');
});

test('同对象重复挂载不重复绑定，并使用当前提示回调', () => {
  const form = createForm('travel', [['r2', 'trip', '1']]);
  form.mount();
  const nextErrors = [];
  form.mount(message => nextErrors.push(message));
  assert.equal(form.mainBindings.length, 1);
  assert.equal(form.detailBindings.length, 1);
  assert.equal(form.actions.length, 2);
  const writesBeforeChange = form.writes.length;
  form.setCell('r2', 'amount', '2.34');
  assert.equal(form.writes.length, writesBeforeChange + 1);
  assert.equal(form.total(), '2.34');
  form.setCell('r2', 'amount', 'invalid');
  assert.equal(form.errors.length, 0);
  assert.equal(nextErrors.length, 1);
});

test('同页两个对象与关闭重开新对象互不影响且正常绑定', () => {
  const first = createForm('travel', [['r2', 'trip', '1.20']], 'sameIds');
  const second = createForm('equipment', [['r9', 'device', '8.90']], 'sameIds');
  first.mount();
  second.mount();
  first.setCell('r2', 'amount', '3.40');
  assert.equal(first.total(), '3.40');
  assert.equal(second.total(), '8.90');
  assert.equal(second.writes.length, 1);
  const reopened = createForm('travel', [['r99', 'trip', '6.70']], 'sameIds');
  reopened.mount();
  assert.equal(reopened.total(), '6.70');
  assert.equal(reopened.mainBindings.length, 1);
  assert.equal(reopened.detailBindings.length, 1);
  assert.equal(reopened.actions.length, 2);
});
