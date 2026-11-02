export const MAX_QUANTITY = 99;

export class Cart {
  #items = new Map();

  add(productId, price, quantity = 1) {
    const item = this.#items.get(productId) ?? { price, quantity: 0 };
    const quantityAfter = item.quantity + quantity;
    if (quantityAfter > MAX_QUANTITY) {
      throw new RangeError(`수량은 ${MAX_QUANTITY}개를 넘을 수 없습니다`);
    }
    this.#items.set(productId, { price: item.price, quantity: quantityAfter });
  }

  remove(productId) {
    this.#items.delete(productId);
  }

  subtotal() {
    let sum = 0;
    for (const { price, quantity } of this.#items.values()) {
      sum += price * quantity;
    }
    return sum;
  }
}
