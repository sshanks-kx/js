const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const vm = require('node:vm');

test('Node.js ES modules can import both functions by name', async () => {
  const { serialize, deserialize } = await import('kdb-js');
  assert.deepEqual(deserialize(serialize({ code: '`GBP', ok: true })), { code: 'GBP', ok: true });
});

test('a classic browser script exposes the same global functions', () => {
  const context = vm.createContext({});
  const source = readFileSync(require.resolve('kdb-js'), 'utf8');
  vm.runInContext(source, context, { filename: 'c.js' });
  assert.equal(context.deserialize(context.serialize('sum-demo')), 'sum-demo');
});
