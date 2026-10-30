import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toPosItems } from '../api/_lib/inventa.js';
import { keyHint } from '../api/_lib/config.js';

test('one POS item per variant, one per product without variants', () => {
  const items = toPosItems([
    { id: 'p1', name: 'Juice', category: 'Beverages', variants: [{ sku: 'J1', flavor: 'Mango', size: '1L' }, { sku: 'J2', flavor: 'Apple', size: '1L' }] },
    { id: 'p2', name: 'Soap', size: '90g', variants: [] },
  ]);
  assert.deepEqual(items.map(i => [i.id, i.variant, i.sku]), [
    ['p1::J1', 'Mango · 1L', 'J1'],
    ['p1::J2', 'Apple · 1L', 'J2'],
    ['p2::base', '90g', null],
  ]);
});

test('key hint never reveals the whole key', () => {
  assert.equal(keyHint('abcdef1234567890wxyz'), 'abcdef…wxyz');
  assert.equal(keyHint('short'), '••••');
  assert.equal(keyHint(''), null);
});
