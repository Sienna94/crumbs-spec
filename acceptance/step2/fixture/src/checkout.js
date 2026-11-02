import { applyCoupon } from './coupon.js';

const SHIPPING_THRESHOLD = 30000;
const SHIPPING_FEE = 3000;

export function checkout(cart, coupon, today) {
  const subtotal = cart.subtotal();
  const discount = coupon ? applyCoupon(coupon, subtotal, today) : 0;
  const items = Math.max(0, subtotal - discount);
  return items < SHIPPING_THRESHOLD ? items + SHIPPING_FEE : items;
}
