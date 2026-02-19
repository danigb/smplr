/**
 * A sorted items that uses binary search to insert items in sorted order.
 * @private
 */
export class SortedQueue<T> {
  #items: T[] = [];
  constructor(public readonly compare: (a: T, b: T) => number) {}

  push(item: T) {
    const len = this.#items.length;

    let left = 0;
    let right = len - 1;
    let index = len;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      if (this.compare(item, this.#items[mid]) < 0) {
        index = mid;
        right = mid - 1;
      } else {
        left = mid + 1;
      }
    }

    this.#items.splice(index, 0, item);
  }

  pop() {
    return this.#items.shift();
  }

  peek(): T | undefined {
    return this.#items[0];
  }

  removeAll(predicate: (item: T) => boolean) {
    const len = this.#items.length;
    this.#items = this.#items.filter((item) => !predicate(item));
    return this.#items.length !== len;
  }

  clear() {
    this.#items = [];
  }

  size() {
    return this.#items.length;
  }
}
