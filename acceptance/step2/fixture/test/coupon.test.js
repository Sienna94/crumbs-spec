import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyCoupon } from '../src/coupon.js';

test('정률 할인은 주문 금액의 50%를 넘지 않는다', () => {
  assert.equal(applyCoupon({ rate: 0.8, expiresOn: '2099-12-31' }, 20000, '2026-10-31'), 10000);
});

test('만료일이 지난 쿠폰은 거부된다', () => {
  assert.throws(() => applyCoupon({ rate: 0.1, expiresOn: '2020-01-01' }, 20000, '2026-10-31'));
});
