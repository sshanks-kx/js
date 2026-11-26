const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const { deserialize } = require('kdb-js');

function fromPayload(hex) {
  const payload = Buffer.from(hex.replaceAll(' ', ''), 'hex');
  const frame = new ArrayBuffer(8 + payload.length);
  const header = new DataView(frame);
  header.setUint8(0, 1);
  header.setUint8(1, 2);
  header.setUint32(4, frame.byteLength, true);
  new Uint8Array(frame).set(payload, 8);
  return deserialize(frame);
}

function fixture(name) {
  return readFileSync(join(__dirname, 'fixtures', name));
}

test('q numeric, boolean, GUID and byte atoms decode to JavaScript values', () => {
  assert.equal(fromPayload('ff01'), true);
  assert.equal(fromPayload('ff00'), false);
  assert.equal(fromPayload('fe 00112233445566778899aabbccddeeff'), '00112233-4455-6677-8899-aabbccddeeff');
  assert.equal(fromPayload('fc ff'), 255);
  assert.equal(fromPayload('fb feff'), -2);
  assert.equal(fromPayload('fa 78563412'), 0x12345678);
  assert.equal(fromPayload('f9 fffffffffeffffff'), -4294967297);
  assert.equal(fromPayload('f9 0100000001000000'), 4294967297);
  assert.equal(fromPayload('f8 0000c03f'), 1.5);
  assert.equal(fromPayload('f7 000000000000f8bf'), -1.5);
  assert.equal(fromPayload('f6 41'), 'A');
});

test('q shorts and ints map their null and infinity sentinels', () => {
  assert.deepEqual(fromPayload('050003000000 0080 0180 ff7f'), [NaN, -Infinity, Infinity]);
  assert.deepEqual(fromPayload('060003000000 00000080 01000080 ffffff7f'), [NaN, -Infinity, Infinity]);
  assert.ok(Number.isNaN(fromPayload('f7 000000000000f87f')));
});

test('q char vectors and symbols decode UTF-8 and keep different wire shapes', () => {
  assert.equal(fromPayload('0a0006000000 41c3a9e697a5'), 'Aé日');
  assert.equal(fromPayload('0a0003000000 610062'), 'a\0b');
  assert.equal(fromPayload('f5 c3a9e697a5 00'), 'é日');
  assert.deepEqual(fromPayload('0b0002000000 49424d00 00'), ['IBM', '']);
  assert.equal(fromPayload('0a0000000000'), '');
});

test('q homogeneous and general lists decode to arrays', () => {
  assert.deepEqual(fromPayload('010002000000 0100'), [true, false]);
  assert.deepEqual(fromPayload('040002000000 00ff'), [0, 255]);
  assert.deepEqual(fromPayload('090002000000 000000000000f03f 00000000000004c0'), [1, -2.5]);
  assert.deepEqual(fromPayload('000003000000 ff01 f56100 000000000000'), [true, 'a', []]);
});

test('q generic null, operators and lambda bodies follow the legacy mapping', () => {
  assert.equal(fromPayload('6500'), null);
  assert.equal(fromPayload('6501'), 'func');
  assert.equal(fromPayload('6600'), 'func');
  assert.equal(fromPayload('6700'), 'func');
  assert.equal(fromPayload('6400 0a0002000000 7b7d'), '{}');
  assert.equal(fromPayload('6802000000 6600 ff01'), 'func');
  assert.equal(fromPayload('6a6600'), 'func');
});

test('q temporal types decode to Dates relative to the UTC q epoch', () => {
  const cases = [
    ['f4 40420f0000000000', '2000-01-01T00:00:00.001Z'], // timestamp
    ['f3 ffffffff', '1999-12-01T00:00:00.000Z'], // month
    ['f2 01000000', '2000-01-02T00:00:00.000Z'], // date
    ['f1 000000000000e03f', '2000-01-01T12:00:00.000Z'], // datetime
    ['f0 c0bdf0ffffffffff', '1999-12-31T23:59:59.999Z'], // timespan
    ['ef 02000000', '2000-01-01T00:02:00.000Z'], // minute
    ['ee 02000000', '2000-01-01T00:00:02.000Z'], // second
    ['ed 02000000', '2000-01-01T00:00:00.002Z'], // time
  ];
  for (const [payload, expected] of cases) {
    assert.equal(fromPayload(payload).toISOString(), expected, payload);
  }
  assert.ok(Number.isNaN(fromPayload('f2 00000080').getTime()));
});

test('q symbol-keyed dictionaries decode to plain objects', () => {
  assert.deepEqual(
    fromPayload('63 0b0002000000 61006200 060002000000 01000000 02000000'),
    { a: 1, b: 2 },
  );
});

test('q tables and keyed tables decode to row objects', () => {
  const rows = [{ sym: 'GBP', size: 42 }, { sym: 'EUR', size: -2 }];
  assert.deepEqual(deserialize(fixture('table.ipc')), rows);
  assert.deepEqual(deserialize(fixture('keyed-table.ipc')), [
    [{ sym: 'GBP' }, { sym: 'EUR' }],
    [{ size: 42 }, { size: -2 }],
  ]);
  assert.deepEqual(fromPayload('620063 0b0001000000 6100 000001000000 060000000000'), []);
});

test('compressed q IPC frames decode through literals and backreferences', () => {
  const frame = fixture('compressed-chars.ipc');
  assert.equal(frame[2], 1);
  assert.equal(deserialize(frame), 'ABCD'.repeat(1024));
  assert.equal(Object.hasOwn(globalThis, 'm'), false);
});

test('Uint8Array and Buffer slices use only the bytes in the supplied view', () => {
  const prefix = Buffer.from('abcd', 'hex');
  const message = fixture('table.ipc');
  const padded = Buffer.concat([prefix, message, prefix]);
  const buffer = padded.subarray(prefix.length, prefix.length + message.length);
  const slice = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const expected = [{ sym: 'GBP', size: 42 }, { sym: 'EUR', size: -2 }];
  assert.deepEqual(deserialize(buffer), expected);
  assert.deepEqual(deserialize(slice), expected);
});
