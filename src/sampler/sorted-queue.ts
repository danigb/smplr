/**
 * A sorted queue that uses binary search to insert items in sorted order.
 * @private
 */
export class SortedQueue<T> {
  readonly queue: T[] = [];
  constructor(public readonly compare: (a: T, b: T) => number) {}

  push(item: T) {
    const { queue, compare } = this;
    const len = queue.length;

    let left = 0;
    let right = len - 1;
    let index = len;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      if (compare(item, queue[mid]) < 0) {
        index = mid;
        right = mid - 1;
      } else {
        left = mid + 1;
      }
    }

    queue.splice(index, 0, item);
  }

  pop() {
    return this.queue.shift();
  }

  peek(): T | undefined {
    return this.queue[0];
  }

  size() {
    return this.queue.length;
  }
}
