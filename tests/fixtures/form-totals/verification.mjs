import assert from 'node:assert/strict';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
const { mountTotals } = await import(pathToFileURL(process.argv[2]).href);
const sdk = { ACTION_ADDROW: 'add:', ACTION_DELROW: 'delete:' };

function form(category, rows, prefix = 'A') {
  const marks = { category: prefix + '_c', total: prefix + '_t', detail: prefix + '_d', rowCategory: prefix + '_dc', amount: prefix + '_a' };
  const fields = { [marks.category]: category, [marks.total]: 'old' };
  let ids = [];
  const mainListeners = [], detailListeners = [], actions = [], errors = [], writes = [];
  function putRow(id, kind, amount) {
    if (!ids.includes(id)) ids.push(id);
    fields[`${marks.rowCategory}_${id}`] = kind;
    fields[`${marks.amount}_${id}`] = amount;
  }
  for (const row of rows) putRow(...row);
  const adapter = {
    convertFieldNameToId(key, scope, container) {
      if (key === 'items' && scope === 'main' && container === true) return marks.detail;
      if (scope === marks.detail && !container && key === 'category') return marks.rowCategory;
      if (scope === marks.detail && !container && key === 'amount') return marks.amount;
      if (scope === undefined && key === 'category') return marks.category;
      if (scope === undefined && key === 'total') return marks.total;
      throw new Error('本题合同不支持的字段定位');
    },
    getFieldValue(mark) { assert.ok(Object.hasOwn(fields, mark)); return fields[mark]; },
    getDetailAllRowIndexStr(mark) { assert.equal(mark, marks.detail); return ids.join(','); },
    changeFieldValue(mark, value) {
      assert.equal(mark, marks.total, '不能写其他字段');
      assert.deepEqual(Object.keys(value), ['value']);
      fields[mark] = value.value;
      writes.push([mark, value.value]);
    },
    bindFieldChangeEvent(keys, callback) {
      const set = keys.split(',');
      assert.ok(set.every(k => k === marks.category));
      mainListeners.push([set, callback]);
    },
    bindDetailFieldChangeEvent(keys, callback) {
      const set = keys.split(',');
      assert.ok(set.every(k => k === marks.rowCategory || k === marks.amount));
      detailListeners.push([set, callback]);
    },
    registerAction(type, callback) {
      assert.ok(type === sdk.ACTION_ADDROW + marks.detail || type === sdk.ACTION_DELROW + marks.detail);
      actions.push([type, callback]);
    }
  };
  return {
    adapter, marks, fields, errors, writes, mainListeners, detailListeners, actions,
    mount() { return mountTotals(adapter, sdk, m => errors.push(m)); },
    total() { return fields[marks.total]; },
    category(value) { fields[marks.category] = value; for (const [keys, cb] of mainListeners) if (keys.includes(marks.category)) cb(); },
    cell(id, column, value) {
      const key = column === 'category' ? marks.rowCategory : marks.amount;
      fields[`${key}_${id}`] = value;
      for (const [keys, cb] of detailListeners) if (keys.includes(key)) cb();
    },
    add(id, kind, amount) { putRow(id, kind, amount); for (const [type, cb] of actions) if (type === sdk.ACTION_ADDROW + marks.detail) cb(); },
    remove(id) { ids = ids.filter(row => row !== id); for (const [type, cb] of actions) if (type === sdk.ACTION_DELROW + marks.detail) cb(); }
  };
}

test('首次打开非连续行：保留小数、负数，忽略非当前类', () => {
  const f = form('travel', [['r2', 'trip', '12.34'], ['r9', 'trip', ' 0.10 '], ['r12', 'trip', '-0.44'], ['r20', 'device', 'bad']]);
  f.mount(); assert.equal(f.total(), '12.00'); assert.equal(f.errors.length, 0);
});

test('主表选择切换与空/未知分类清零', () => {
  const f = form('travel', [['r1', 'trip', '1.25'], ['r7', 'device', '99.99']]);
  f.mount(); f.category('equipment'); assert.equal(f.total(), '99.99');
  f.category(''); assert.equal(f.total(), '0.00');
  f.category('other'); assert.equal(f.total(), '0.00');
});

test('金额/分类变更、增删行后均按现有数据计算', () => {
  const f = form('travel', [['r2', 'trip', '0.10'], ['r9', 'device', '0.20']]);
  f.mount(); f.cell('r9', 'category', 'trip'); assert.equal(f.total(), '0.30');
  f.cell('r2', 'amount', '-1.01'); assert.equal(f.total(), '-0.81');
  f.add('r55', 'trip', '10'); assert.equal(f.total(), '9.19');
  f.remove('r55'); assert.equal(f.total(), '-0.81');
  f.remove('r2'); f.remove('r9'); assert.equal(f.total(), '0.00');
});

test('非法参与金额清空并提示，修正恢复；空金额合法', () => {
  const f = form('travel', [['r2', 'trip', '1.00'], ['r9', 'trip', '2.00']]);
  f.mount();
  for (const bad of ['1.234', '1e2', '1,000', '￥1', 'hello', '1.2suffix']) {
    f.cell('r2', 'amount', bad); assert.equal(f.total(), '');
    assert.equal(typeof f.errors.at(-1), 'string'); assert.ok(f.errors.at(-1).length > 0);
  }
  f.cell('r2', 'amount', ''); assert.equal(f.total(), '2.00');
  f.cell('r2', 'amount', '0.01'); assert.equal(f.total(), '2.01');
});

test('同一实例重复挂载不重复绑定，仍可响应事件', () => {
  const f = form('travel', [['r2', 'trip', '1']]); f.mount();
  const counts = [f.mainListeners.length, f.detailListeners.length, f.actions.length];
  f.mount(); assert.deepEqual([f.mainListeners.length, f.detailListeners.length, f.actions.length], counts);
  const before = f.writes.length; f.cell('r2', 'amount', '2.45'); assert.equal(f.total(), '2.45');
  assert.equal(f.writes.length - before, 1);
});

test('两个表单与重新打开的新实例相互独立', () => {
  const a = form('travel', [['r1', 'trip', '1']], 'A');
  const b = form('equipment', [['r1', 'device', '5']], 'B');
  a.mount(); b.mount(); a.cell('r1', 'amount', '2'); assert.equal(a.total(), '2.00'); assert.equal(b.total(), '5.00');
  const reopened = form('travel', [['r1', 'trip', '9']], 'A'); reopened.mount(); assert.equal(reopened.total(), '9.00');
  a.cell('r1', 'amount', '3'); assert.equal(reopened.total(), '9.00');
});

test('初始化不改输入字段与明细数据', () => {
  const f = form('travel', [['r2', 'trip', '12.34'], ['r9', 'device', 'x']]);
  const before = { ...f.fields }; delete before[f.marks.total]; f.mount();
  const after = { ...f.fields }; delete after[f.marks.total]; assert.deepEqual(after, before);
});

test('最大约定数据量仍按分精确累加；零不输出负零', () => {
  const f = form('travel', Array.from({ length: 1000 }, (_, i) => ['r' + i, 'trip', '1000000.00']));
  f.mount(); assert.equal(f.total(), '1000000000.00');
  const z = form('travel', [['r1', 'trip', '-0.00'], ['r3', 'trip', '0.10'], ['r7', 'trip', '-0.10']]);
  z.mount(); assert.equal(z.total(), '0.00');
});
