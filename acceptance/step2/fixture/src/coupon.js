export const MIN_ORDER = 10000;

const MAX_RATE = 0.5;

export function applyCoupon(coupon, subtotal, today) {
  if (coupon.expiresOn < today) {
    throw new Error('만료된 쿠폰입니다');
  }
  if (subtotal < MIN_ORDER) {
    return 0;
  }
  return Math.floor(subtotal * Math.min(coupon.rate, MAX_RATE));
}
