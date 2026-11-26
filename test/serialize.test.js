const assert = require('node:assert/strict');
const { test } = require('node:test');
const { serialize } = require('kdb-js');

function assertFrame(value, hex) {
  const encoded = serialize(value);
  assert.ok(encoded instanceof ArrayBuffer);
  assert.equal(Buffer.from(encoded).toString('hex'), hex.replaceAll(' ', ''));
}

test('booleans, floats and generic null are q atoms', () => {
  assertFrame(true, '010000000a000000 ff01');
  assertFrame(false, '010000000a000000 ff00');
  assertFrame(42, '0100000011000000 f7 0000000000004540');
  assertFrame(-0, '0100000011000000 f7 0000000000000080');
  assertFrame(Infinity, '0100000011000000 f7 000000000000f07f');
  assertFrame(null, '010000000a000000 6500');
});

test('strings encode as UTF-8 q char vectors or backtick-prefixed symbols', () => {
  assertFrame('', '010000000e000000 0a0000000000');
  assertFrame('é日', '0100000013000000 0a0005000000 c3a9e697a5');
  assertFrame('😀', '0100000012000000 0a0004000000 f09f9880');
  assertFrame('a\0b', '0100000011000000 0a0003000000 610062');
  assertFrame('`é日', '010000000f000000 f5 c3a9e697a5 00');
  assertFrame('`', '010000000a000000 f500');
});

test('arrays encode as general lists, including empty and nested arrays', () => {
  assertFrame([], '010000000e000000 000000000000');
  assertFrame([true, [null]], '0100000018000000 000002000000 ff01 000001000000 6500');
  assertFrame([true, false], '0100000012000000 000002000000 ff01 ff00');
});

test('plain objects encode as dictionaries with symbol keys in a general list', () => {
  assertFrame({}, '0100000015000000 63 000000000000 000000000000');
  assertFrame({ sym: '`IBM', active: true },
    '0100000029000000 63 000002000000 f573796d00 f561637469766500 000002000000 f549424d00 ff01');
});

test('a Date uses local clock fields with the q datetime epoch', () => {
  const localNoon = new Date(2000, 0, 1, 12);
  assertFrame(localNoon, '0100000011000000 f1 000000000000e03f');
});

test('undefined and BigInt are unsupported inputs', () => {
  assert.throws(() => serialize(undefined), /bad type undefined/);
  assert.throws(() => serialize([undefined]), /bad type undefined/);
  assert.throws(() => serialize(2n), /bad type bigint/);
});
