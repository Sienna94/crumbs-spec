import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Cart, MAX_QUANTITY } from '../src/cart.js';

test('같은 상품을 다시 담으면 수량이 합산된다', () => {
  const cart = new Cart();
  cart.add('apple', 1000, 2);
  cart.add('apple', 1000, 3);
  assert.equal(cart.subtotal(), 5000);
});

test('수량이 99를 넘으면 오류가 난다', () => {
  const cart = new Cart();
  cart.add('apple', 1000, MAX_QUANTITY);
  assert.throws(() => cart.add('apple', 1000, 1));
});
